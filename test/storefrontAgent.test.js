// Agent-loop tests with Anthropic and Shopify mocked at the fetch boundary.
// They prove the safety property end to end: a destructive tool the model asks
// for is NOT executed against Shopify until the user confirms in a later turn.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// Set fake credentials BEFORE importing the app: config.js only fills in env
// vars that are missing, so a developer's real .env can never leak into tests.
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.SHOPIFY_STORE_DOMAIN = 'test-store.myshopify.com'
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'test-token'
process.env.SHOPIFY_API_VERSION = '2026-01'

const { runStorefrontAgent } = await import('../server/agents/storefrontAgent.js')
const { _resetConfirmations } = await import('../server/lib/confirm.js')

const realFetch = globalThis.fetch
let anthropicRequests
let shopifyCalls

const toolUse = (name, input, id = 'tu_1') => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name, input }],
})
const finish = (text = 'Done.') => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] })
const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

// script: the sequence of assistant turns the fake model will produce.
function mockNetwork(script) {
  const turns = [...script]
  anthropicRequests = []
  shopifyCalls = []
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url)
    if (target.startsWith('https://api.anthropic.com/')) {
      anthropicRequests.push(JSON.parse(options.body))
      const next = turns.shift()
      assert.ok(next, 'the model was called more times than the test scripted')
      return json(next)
    }
    if (target.startsWith('https://test-store.myshopify.com/')) {
      const body = options.body ? JSON.parse(options.body) : null
      shopifyCalls.push({ url: target, method: options.method || 'GET', body })
      if (body?.query?.includes('productDelete')) {
        return json({ data: { productDelete: { deletedProductId: 'gid://shopify/Product/123', userErrors: [] } } })
      }
      return json({ pages: [], data: {} })
    }
    throw new Error(`Unmocked network call in test: ${target}`)
  }
}

async function run(message = 'delete that product') {
  const events = []
  await runStorefrontAgent((e) => events.push(e), message, [])
  return events
}

const deleteCalls = () => shopifyCalls.filter((c) => c.body?.query?.includes('productDelete'))

beforeEach(() => _resetConfirmations())
afterEach(() => {
  globalThis.fetch = realFetch
})

test('a destructive tool call is held and never reaches Shopify on the first request', async () => {
  mockNetwork([toolUse('delete_product', { productId: '123' }), finish('Please confirm deleting product 123.')])

  const events = await run()

  assert.equal(deleteCalls().length, 0, 'Shopify must not receive a delete')
  const result = events.find((e) => e.type === 'tool_result')
  assert.equal(result.result.requiresConfirmation, true)
  // the model is told the action was NOT executed so it can ask the user
  const toolResultBlock = anthropicRequests[1].messages.at(-1).content[0]
  assert.match(toolResultBlock.content, /NOT EXECUTED/)
  assert.equal(events.at(-1).type, 'final')
})

test('the model cannot approve its own action by retrying within the same run', async () => {
  mockNetwork([
    toolUse('delete_product', { productId: '123' }, 'tu_1'),
    toolUse('delete_product', { productId: '123' }, 'tu_2'),
    finish(),
  ])

  await run()

  assert.equal(deleteCalls().length, 0)
})

test('the same call from a later user turn executes exactly once', async () => {
  mockNetwork([toolUse('delete_product', { productId: '123' }), finish('Confirm?')])
  await run('delete product 123')
  assert.equal(deleteCalls().length, 0)

  // user replies "yes" -> a NEW run; the model repeats the identical call
  mockNetwork([toolUse('delete_product', { productId: '123' }), finish('Deleted.')])
  const events = await run('yes, delete it')

  assert.equal(deleteCalls().length, 1)
  assert.equal(deleteCalls()[0].body.variables.input.id, 'gid://shopify/Product/123')
  assert.equal(events.find((e) => e.type === 'tool_result').result.success, true)

  // approval is single-use
  mockNetwork([toolUse('delete_product', { productId: '123' }), finish()])
  await run('delete it again')
  assert.equal(deleteCalls().length, 0)
})

test('confirming one product does not authorize deleting a different one', async () => {
  mockNetwork([toolUse('delete_product', { productId: '123' }), finish()])
  await run()

  mockNetwork([toolUse('delete_product', { productId: '999' }), finish()])
  await run('yes')

  assert.equal(deleteCalls().length, 0)
})

test('read-only tools run immediately without confirmation', async () => {
  mockNetwork([toolUse('get_pages', {}), finish('No pages yet.')])

  const events = await run('list my pages')

  assert.ok(shopifyCalls.some((c) => c.url.includes('/pages.json')))
  assert.equal(events.find((e) => e.type === 'tool_result').result.requiresConfirmation, undefined)
})
