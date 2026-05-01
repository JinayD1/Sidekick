/**
 * Process items through an async mapper in sequential chunks so that at most
 * `concurrency` calls are in flight at once (avoids Anthropic rate limits).
 */
export async function batchMap(items, mapper, concurrency = 3) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    results.push(...(await Promise.all(chunk.map(mapper))))
  }
  return results
}

/**
 * Parse JSON from model output. Falls back to the first {...} block found in
 * the text (models often wrap JSON in prose), then to `fallback`.
 */
export function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/)
    if (!match) return fallback
    try {
      return JSON.parse(match[0])
    } catch {
      return fallback
    }
  }
}
