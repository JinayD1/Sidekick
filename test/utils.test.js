import { test } from 'node:test'
import assert from 'node:assert/strict'
import { batchMap, parseJson } from '../server/lib/utils.js'

test('parseJson parses plain JSON', () => {
  assert.deepEqual(parseJson('{"a":1}', null), { a: 1 })
})

test('parseJson extracts JSON wrapped in prose', () => {
  assert.deepEqual(parseJson('Sure! Here you go:\n{"score": 7}\nHope that helps.', null), { score: 7 })
})

test('parseJson returns fallback on garbage', () => {
  assert.equal(parseJson('no json here', 'fb'), 'fb')
  assert.equal(parseJson('{broken', 'fb'), 'fb')
})

test('batchMap preserves order and caps concurrency', async () => {
  let inFlight = 0
  let peak = 0
  const out = await batchMap([1, 2, 3, 4, 5, 6, 7], async (n) => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
    return n * 2
  }, 3)
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14])
  assert.equal(peak, 3)
})
