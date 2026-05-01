import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkConfirmation, _resetConfirmations } from '../server/lib/confirm.js'

beforeEach(() => _resetConfirmations())

test('non-destructive tools pass straight through', () => {
  assert.equal(checkConfirmation('get_pages', {}, 'run1').allowed, true)
})

test('destructive tool is held on first call', () => {
  const r = checkConfirmation('delete_product', { productId: '1' }, 'run1')
  assert.equal(r.allowed, false)
  assert.equal(r.result.requiresConfirmation, true)
})

test('model cannot self-approve within the same run', () => {
  checkConfirmation('activate_theme', { themeId: '9' }, 'run1')
  assert.equal(checkConfirmation('activate_theme', { themeId: '9' }, 'run1').allowed, false)
})

test('same call from a later user turn is allowed once', () => {
  checkConfirmation('delete_page', { pageId: '5' }, 'run1')
  assert.equal(checkConfirmation('delete_page', { pageId: '5' }, 'run2').allowed, true)
  // approval is consumed
  assert.equal(checkConfirmation('delete_page', { pageId: '5' }, 'run3').allowed, false)
})

test('approval does not transfer to different input', () => {
  checkConfirmation('delete_product', { productId: '1' }, 'run1')
  assert.equal(checkConfirmation('delete_product', { productId: '2' }, 'run2').allowed, false)
})

test('held confirmations expire', () => {
  const t0 = 1_000_000
  checkConfirmation('delete_product', { productId: '1' }, 'run1', t0)
  assert.equal(checkConfirmation('delete_product', { productId: '1' }, 'run2', t0 + 11 * 60 * 1000).allowed, false)
})
