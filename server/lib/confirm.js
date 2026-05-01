// Server-side human-in-the-loop gate for destructive agent tools.
//
// The first time the agent calls a destructive tool with a given input, the
// call is HELD and the agent is told to ask the user. The call only executes
// when the same tool + input is requested again from a *later* user turn
// (a different runId) within the TTL. The model cannot approve its own action
// inside a single run, regardless of what it says.

export const DESTRUCTIVE_TOOLS = new Set([
  'activate_theme',
  'delete_product',
  'delete_page',
  'delete_collection',
  'unpublish_product',
])

const TTL_MS = 10 * 60 * 1000
const pending = new Map()

function keyFor(name, input) {
  return `${name}:${JSON.stringify(input ?? {})}`
}

export function checkConfirmation(name, input, runId, now = Date.now()) {
  if (!DESTRUCTIVE_TOOLS.has(name)) return { allowed: true }

  for (const [k, v] of pending) if (now - v.at > TTL_MS) pending.delete(k)

  const key = keyFor(name, input)
  const held = pending.get(key)
  if (held && held.runId !== runId) {
    pending.delete(key)
    return { allowed: true }
  }

  pending.set(key, { runId, at: held?.runId === runId ? held.at : now })
  return {
    allowed: false,
    result: {
      requiresConfirmation: true,
      tool: name,
      input,
      message:
        'NOT EXECUTED. This action is destructive or customer-visible. Describe it to the user and ask them to confirm. If they say yes, call this same tool again with the same input.',
    },
  }
}

export function _resetConfirmations() {
  pending.clear()
}
