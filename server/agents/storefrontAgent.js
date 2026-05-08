import { randomUUID } from 'node:crypto'
import { ANTHROPIC_MODEL } from '../config.js'
import { createShopifyDraftProduct } from '../integrations/shopify.js'
import { checkConfirmation } from '../lib/confirm.js'
import { runDiscoverabilityAudit, runProductClarityAudit, runUXAudit } from './audits.js'
import { buildStorefrontPrompt } from '../prompts/storefront.js'
import { STOREFRONT_TOOLS } from './storefrontToolDefs.js'
import { toolActivateTheme, toolAddProductToCollection, toolCreateCollection, toolCreateOrUpdatePage, toolDeleteCollection, toolDeletePage, toolDeleteProduct, toolGetMenus, toolGetPages, toolGetStorefrontAudit, toolGetThemeSettings, toolListThemes, toolPublishProduct, toolScanDriveForProduct, toolUnpublishProduct, toolUpdateProduct, toolUpdateThemeSettings } from './storefrontTools.js'

// Storefront agent: Claude tool-use loop, tool dispatch and the confirmation gate.
export async function executeTool(name, input, emit = () => {}) {
  switch (name) {
    case 'get_storefront_audit':
      return toolGetStorefrontAudit()
    case 'get_theme_settings':
      return toolGetThemeSettings()
    case 'update_theme_settings':
      return toolUpdateThemeSettings(input.updates)
    case 'get_pages':
      return toolGetPages()
    case 'create_or_update_page':
      return toolCreateOrUpdatePage(input)
    case 'delete_page':
      return toolDeletePage(input.pageId)
    case 'get_menus':
      return toolGetMenus()
    case 'create_collection':
      return toolCreateCollection(input)
    case 'delete_collection':
      return toolDeleteCollection(input.collectionId)
    case 'add_product_to_collection':
      return toolAddProductToCollection(input.productId, input.collectionId)
    case 'publish_product':
      return toolPublishProduct(input.productId)
    case 'unpublish_product':
      return toolUnpublishProduct(input.productId)
    case 'delete_product':
      return toolDeleteProduct(input.productId)
    case 'update_product':
      return toolUpdateProduct(input.productId, input.fields)
    case 'scan_drive_for_product':
      return toolScanDriveForProduct(input.query)
    case 'create_shopify_product': {
      const draft = {
        title: input.title,
        descriptionHtml: input.descriptionHtml,
        price: input.price || null,
        vendor: input.vendor || null,
        productType: input.productType || null,
        tags: input.tags || [],
        status: input.status || 'ACTIVE',
      }
      return createShopifyDraftProduct(draft)
    }
    case 'run_ux_audit':
      return runUXAudit(emit)
    case 'run_product_clarity_audit':
      return runProductClarityAudit(emit)
    case 'run_discoverability_audit':
      return runDiscoverabilityAudit(emit)
    case 'list_themes':
      return toolListThemes()
    case 'activate_theme':
      return toolActivateTheme(input.themeId)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function runStorefrontAgentForChat(emit, message, history) {
  const chatHistory = history.slice(-6).map((m) => ({
    role: m.sender === 'assistant' ? 'assistant' : 'user',
    content: m.text || '',
  }))
  const wrapEmit = (event) => {
    if (event.type === 'final') {
      emit({ type: 'final', display: { answer: event.answer, files: [] }, raw: {} })
    } else {
      emit(event)
    }
  }
  await runStorefrontAgent(wrapEmit, message, chatHistory)
}

export async function runStorefrontAgent(emit, userMessage, history) {
  if (!process.env.ANTHROPIC_API_KEY) {
    emit({ type: 'final', answer: 'ANTHROPIC_API_KEY is not configured.' })
    return
  }

  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || ''
  const runId = randomUUID()
  const systemPrompt = buildStorefrontPrompt(storeDomain)

  const messages = [
    ...history.map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content || '',
    })),
    { role: 'user', content: userMessage },
  ]

  let iterations = 0
  const MAX_ITERATIONS = 10

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: STOREFRONT_TOOLS,
        messages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${errText.slice(0, 300)}`)
    }

    const data = await response.json()
    const { stop_reason, content } = data

    // Emit any text blocks from this turn as agent_text
    const textBlocks = content.filter((b) => b.type === 'text')
    for (const block of textBlocks) {
      if (block.text?.trim()) {
        emit({ type: 'agent_text', text: block.text.trim() })
      }
    }

    // Add assistant turn to messages
    messages.push({ role: 'assistant', content })

    if (stop_reason === 'end_turn' || stop_reason === 'stop_sequence') {
      const finalText = textBlocks.map((b) => b.text).join('\n').trim()
      emit({ type: 'final', answer: finalText || 'Done.' })
      return
    }

    // Process tool uses
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use')
    if (!toolUseBlocks.length) {
      const finalText = textBlocks.map((b) => b.text).join('\n').trim()
      emit({ type: 'final', answer: finalText || 'Done.' })
      return
    }

    const toolResultContents = []
    for (const toolUse of toolUseBlocks) {
      emit({ type: 'tool_call', name: toolUse.name, input: toolUse.input })

      let toolResult
      let isError = false
      try {
        const gate = checkConfirmation(toolUse.name, toolUse.input, runId)
        toolResult = gate.allowed
          ? await executeTool(toolUse.name, toolUse.input, emit)
          : gate.result
      } catch (err) {
        toolResult = { error: err.message }
        isError = true
      }

      emit({ type: 'tool_result', name: toolUse.name, result: toolResult, error: isError })

      toolResultContents.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      })
    }

    // Add tool results as user turn
    messages.push({ role: 'user', content: toolResultContents })
  }

  emit({ type: 'final', answer: 'Max iterations reached. The agent stopped after 10 rounds.' })
}
