import { ANTHROPIC_MODEL } from '../config.js'

// Anthropic Messages API wrappers (fast chat call + reasoning call with prompt caching).
export async function callAnthropic({ system, messages, maxTokens }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.content?.map((block) => block.text || '').join('\n').trim() || ''
}

// Uses claude-opus-4-7 with adaptive thinking + prompt caching for high-stakes reasoning.
// System prompt is cached so repeated calls (rerank, extract) don't re-process the large prompt.
export async function callAnthropicReasoning({ system, messages, maxTokens }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')

  // Cache the system prompt — stable across calls, saves tokens on repeated reranks
  const systemBlocks = [
    {
      type: 'text',
      text: system,
      cache_control: { type: 'ephemeral' },
    },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system: systemBlocks,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic reasoning API failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.content?.map((b) => b.text || '').join('\n').trim() || ''
}
