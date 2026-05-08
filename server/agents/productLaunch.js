import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { __dirname, productsPath } from '../config.js'
import { callAnthropicReasoning } from '../integrations/anthropic.js'
import { dedupeFiles, readFileText, searchGoogleDrive, searchMicrosoftDrive, toDisplayFile } from '../integrations/drive.js'
import { findDriveImagesForProduct } from '../integrations/driveImages.js'
import { parseJson } from '../lib/utils.js'

// Product launch agent: find a doc in Drive, extract a draft, create the product.
export async function rerankForProductCreate(message, candidates) {
  const DEV_NAME = /changelog|readme|package|license|contributing|config|setup|install|makefile|dockerfile|gruntfile|gemfile|procfile/i
  const DEV_EXT = /\.(md|json|js|ts|jsx|tsx|py|rb|go|java|css|html|xml|yaml|yml|lock|log|sh|env|toml|ini|cfg)$/i
  // "project" in name = planning/meta doc, not a product brief
  const META_NAME = /project|roadmap|strategy|proposal|planning|vision|sprint|backlog|milestone|saas|app\s*idea/i
  const STOREFRONT_NAME = /storefront|store\s*front/i
  const PRODUCT_BRIEF_NAME = /product\s*(brief|idea|ideas|launch|listing)|brief|launch\s*doc|product\s*spec/i
  const PRICE_IN_TEXT = /\$\s*\d+|\d+\s*(dollars?|USD|per\s+\w+)/i
  const PRODUCT_ITEM_TEXT = /add\s+\w+\s+product|new\s+product|item\s+to\s+(add|list|sell)|price\s+it\s+at/i

  const scored = candidates.map((file) => {
    let score = 0
    const name = file.name || ''
    const mime = file.mimeType || ''
    const snippet = (file.text || '').slice(0, 800)

    // File type scoring
    if (mime === 'application/vnd.google-apps.document') score += 15
    else if (mime === 'application/vnd.google-apps.spreadsheet') score += 8
    else if (DEV_EXT.test(name)) score -= 25
    else if (mime.startsWith('text/plain')) score -= 5

    // Name: developer files → hard penalize
    if (DEV_NAME.test(name)) score -= 30

    // Name: meta/project docs → penalize (not product briefs)
    if (META_NAME.test(name)) score -= 20

    // Name: storefront-specific → strong boost
    if (STOREFRONT_NAME.test(name)) score += 18

    // Name: looks like a product brief → boost
    if (PRODUCT_BRIEF_NAME.test(name)) score += 14

    // Name: has "ideas" without "project" → moderate boost
    if (/ideas?/i.test(name) && !META_NAME.test(name)) score += 8

    // Content: price mentioned → very strong signal this has a real product
    if (PRICE_IN_TEXT.test(snippet)) score += 20

    // Content: "add X product", "new product", "price it at" → strongest content signal
    if (PRODUCT_ITEM_TEXT.test(snippet)) score += 25

    // Content: dev/changelog signals → penalize
    if (/changelog|version\s*\d|bug\s*fix|release\s*notes|commit|pull\s*request/i.test(snippet)) score -= 20

    // Content: SaaS/tech project language → penalize
    if (/saas|api\s+endpoint|microservice|database\s+schema|deployment|kubernetes|docker/i.test(snippet)) score -= 15

    // Recency bonus
    if (file.modifiedTime) {
      const days = (Date.now() - new Date(file.modifiedTime).getTime()) / 86400000
      if (days < 1) score += 8
      else if (days < 7) score += 4
      else if (days < 30) score += 1
    }

    return { ...file, _hScore: score }
  })

  scored.sort((a, b) => b._hScore - a._hScore)

  // If top candidate is clearly dominant (score gap > 15), trust heuristics alone
  if (scored.length > 1 && scored[0]._hScore - scored[1]._hScore > 15) return scored

  // LLM validation over top 6 when scores are close
  const top = scored.slice(0, 6)
  if (top.length <= 1 || !process.env.ANTHROPIC_API_KEY) return scored

  const summaries = top.map((file, i) => ({
    index: i,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    heuristicScore: file._hScore,
    snippet: (file.text || '').slice(0, 500).replace(/\s+/g, ' ').trim(),
  }))

  const text = await callAnthropicReasoning({
    system: [
      'You are selecting the ONE document that contains specific retail products to add to a Shopify storefront.',
      'The ideal document has: a list of physical/digital products to sell, their prices, and descriptions.',
      '',
      'CRITICAL DISTINCTIONS:',
      '- "Storefront Ideas" = ideas for products to sell → CORRECT (this is a product brief)',
      '- "Shopify Project Ideas" = a planning doc for a software project → WRONG (this is a meta doc)',
      '- A doc saying "Add water bottle, price $20" → CORRECT (concrete product to create)',
      '- A doc about SaaS features, APIs, or app architecture → WRONG (not a product brief)',
      '',
      'STRONGLY PREFER:',
      '- Google Docs with product names, prices ($X), or "add [item]" instructions',
      '- Names like "Storefront Ideas", "Product Brief", "New Products", "Product Launch"',
      '- Content that looks like a merchant\'s product wishlist or product spec',
      '',
      'STRONGLY AVOID:',
      '- "Project Ideas" docs — these are feature/project planning, not product briefs',
      '- CHANGELOG.md, README.md, technical docs, code files',
      '- Docs about SaaS, APIs, apps, or software development',
      '',
      'Think carefully about the file names and content snippets before ranking.',
      'Return ONLY JSON: {"order":[0,1,2,...]} — best product brief first. Include every index exactly once.',
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify({ userRequest: message, candidates: summaries }) }],
    maxTokens: 3000,
  })

  const parsed = parseJson(text, null)
  if (!parsed?.order || !Array.isArray(parsed.order)) return scored

  const seen = new Set()
  const ordered = []
  for (const i of parsed.order) {
    if (Number.isInteger(i) && i >= 0 && i < top.length && !seen.has(i)) {
      ordered.push(top[i])
      seen.add(i)
    }
  }
  for (let i = 0; i < top.length; i++) {
    if (!seen.has(i)) ordered.push(top[i])
  }
  for (const file of scored.slice(6)) ordered.push(file)

  return ordered
}

export async function productAgentFlow(emit, message, plan, status) {
  if (!status.google && !status.microsoft) {
    emit({
      type: 'final',
      display: {
        answer: 'Connect Google Drive first so I can find your product launch doc.',
        files: [],
      },
      raw: { plan },
    })
    return
  }

  const providerNames = plan.providers?.length
    ? plan.providers.filter((p) => status[p])
    : ['google', 'microsoft'].filter((p) => status[p])
  const queries = plan.queries?.length ? plan.queries.slice(0, 5) : [message]

  // Also always search for "product" + "ideas" + "brief" + "storefront" to cast a wide net
  const discoveryQueries = ['product ideas', 'product brief', 'storefront ideas', 'new product', 'product launch']
  const allQueries = [...new Set([...queries, ...discoveryQueries])]

  const results = []
  for (const provider of providerNames) {
    for (const query of allQueries.slice(0, 8)) {
      const found = provider === 'google'
        ? await searchGoogleDrive(query)
        : await searchMicrosoftDrive(query)
      results.push(...found)
    }
  }

  const deduped = dedupeFiles(results)
  if (deduped.length === 0) {
    emit({
      type: 'final',
      display: {
        answer: "I couldn't find a product launch doc matching your query in Google Drive. Try rephrasing or check that the doc exists.",
        files: [],
      },
      raw: { plan },
    })
    return
  }

  // Read content for top candidates so the reranker can see what's inside
  const withText = await Promise.all(
    deduped.slice(0, 15).map(async (file) => ({ ...file, text: await readFileText(file) })),
  )

  const ranked = await rerankForProductCreate(message, withText)
  emit({ type: 'rerank', candidates: withText.length, kept: 1 })

  const sourceFile = ranked[0]
  const docText = sourceFile.text || await readFileText(sourceFile)

  if (!process.env.ANTHROPIC_API_KEY) {
    emit({
      type: 'final',
      display: {
        answer: `I found "${sourceFile.name}" but need an Anthropic API key to extract product data from it.`,
        files: [toDisplayFile(sourceFile)],
      },
      raw: { plan, sourceFile },
    })
    return
  }

  const draft = await extractAndGenerateDraft(docText)
  if (!draft) {
    emit({
      type: 'final',
      display: {
        answer: `I found "${sourceFile.name}" but couldn't extract structured product data from it. The document may not contain enough product information.`,
        files: [toDisplayFile(sourceFile)],
      },
      raw: { plan, sourceFile },
    })
    return
  }

  // Search for product images in the same Drive folder (or globally as fallback)
  const imageMedia = await findDriveImagesForProduct(sourceFile, draft.title, plan.queries || [], draft.description)
  if (imageMedia.length) {
    draft.media = imageMedia
    // Remove any "Missing product images" warning since we found some
    if (draft.warnings) {
      draft.warnings = draft.warnings.filter((w) => !w.toLowerCase().includes('missing product image'))
    }
  } else {
    if (!draft.warnings) draft.warnings = []
    if (!draft.warnings.some((w) => w.toLowerCase().includes('image'))) {
      draft.warnings.push('No product images found in Drive folder')
    }
  }

  const validation = validateProductDraft(draft)
  const noteMultiple = ranked.length > 1 ? ` (${ranked.length - 1} other doc${ranked.length > 2 ? 's' : ''} found — using the most relevant one)` : ''
  const imageNote = imageMedia.length ? ` Found ${imageMedia.length} image${imageMedia.length > 1 ? 's' : ''} in Drive.` : ''
  const answer = validation.valid
    ? `I found "${sourceFile.name}" in your Google Drive${noteMultiple} and extracted a product draft for "${draft.title}".${imageNote} Review the details below and click Create Draft Product to add it to your store.`
    : `I found "${sourceFile.name}"${noteMultiple} and extracted a draft for "${draft.title}", but ${validation.missingRequired.length} required field(s) are missing.${imageNote} Review the warnings before creating.`

  emit({
    type: 'final',
    display: {
      answer,
      files: [toDisplayFile(sourceFile)],
      product: draft,
      visual: null,
    },
    raw: { plan, sourceFile, validation },
  })
}

export async function extractAndGenerateDraft(docText) {
  const text = await callAnthropicReasoning({
    system: [
      'You extract product data from a launch brief and return a Shopify product draft as compact JSON only.',
      'Return ONLY a valid JSON object — no markdown, no explanation.',
      '',
      'Required schema:',
      '{',
      '  "title": "string (required)",',
      '  "descriptionHtml": "<p>...</p> (required)",',
      '  "price": "89.00 as string, or null if not stated in the document",',
      '  "vendor": "string or null",',
      '  "productType": "string or null",',
      '  "status": "ACTIVE",',
      '  "tags": ["string"],',
      '  "options": [{"name": "Size", "values": ["S", "M", "L", "XL"]}],',
      '  "variants": [{"title": "S / Black", "price": "89.00", "sku": "", "inventoryQuantity": 0}],',
      '  "metafields": [{"namespace": "custom", "key": "use_case", "value": "commuting"}],',
      '  "seo": {"title": "string", "description": "string"},',
      '  "warnings": ["string"]',
      '}',
      '',
      'Rules:',
      '- NEVER invent a price. If no price appears in the document, set price to null and add "Missing price" to warnings.',
      '- Generate all cartesian-product variant combinations from options (max 20 variants).',
      '- Always set status to "ACTIVE".',
      '- Add a warning for every important missing field: "Missing product images", "Missing inventory quantity", "Missing vendor", etc.',
      '- Keep descriptionHtml concise — 1-2 sentences as a <p> tag.',
      '- Infer sensible tags from the product category, use case, and features.',
      '- Return ONLY the JSON object, no markdown, no code fences.',
    ].join('\n'),
    messages: [{ role: 'user', content: docText.slice(0, 10000) }],
    maxTokens: 4000,
  })

  return parseJson(text, null)
}

/**
 * @param {object} draft
 * @returns {{ valid: boolean, warnings: string[], missingRequired: string[] }}
 */

export function validateProductDraft(draft) {
  const warnings = [...(draft.warnings || [])]
  const missingRequired = []

  if (!draft.title) missingRequired.push('title')
  if (!draft.price) {
    missingRequired.push('price')
    if (!warnings.some((w) => w.toLowerCase().includes('price'))) {
      warnings.push('Missing price')
    }
  }
  if (!draft.options?.length) {
    if (!warnings.some((w) => w.toLowerCase().includes('variant'))) {
      warnings.push('No product variants defined')
    }
  }

  return { valid: missingRequired.length === 0, warnings, missingRequired }
}

export async function readMockProducts() {
  if (!existsSync(productsPath)) return []
  try {
    return JSON.parse(await readFile(productsPath, 'utf8'))
  } catch {
    return []
  }
}

export async function saveMockProduct(product) {
  await mkdir(__dirname, { recursive: true })
  const products = await readMockProducts()
  products.push(product)
  await writeFile(productsPath, JSON.stringify(products, null, 2))
}

export async function createMockProduct(draft) {
  if (!draft?.title) return { ok: false, error: 'title is required' }
  if (!draft?.price) return { ok: false, error: 'price is required — fill in the price field before creating' }

  const inventoryLabel = draft.variants?.length
    ? `${draft.variants.length} variant${draft.variants.length > 1 ? 's' : ''}`
    : '0 in stock'

  const product = {
    id: `mock-${Date.now()}`,
    title: draft.title,
    status: 'Draft',
    inventory: inventoryLabel,
    type: draft.productType || 'Uncategorized',
    vendor: draft.vendor || '',
    price: draft.price,
    tags: draft.tags || [],
    createdAt: new Date().toISOString(),
  }

  await saveMockProduct(product)
  return { ok: true, product }
}
