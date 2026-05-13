import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardRequest } from '../server/lib/guard.js'

const cfg = { appOrigin: 'http://127.0.0.1:5173', apiOrigin: 'http://127.0.0.1:8787' }
const req = (method, headers) => ({ method, headers: { host: '127.0.0.1:8787', ...headers } })

test('allows requests from the Sidekick app', () => {
  const r = guardRequest(req('POST', { origin: cfg.appOrigin, 'content-type': 'application/json' }), cfg)
  assert.equal(r.ok, true)
})

test('allows originless requests (curl, OAuth navigation)', () => {
  assert.equal(guardRequest(req('GET', {}), cfg).ok, true)
})

test('blocks a foreign Origin', () => {
  const r = guardRequest(req('POST', { origin: 'https://evil.example', 'content-type': 'application/json' }), cfg)
  assert.equal(r.ok, false)
  assert.equal(r.status, 403)
})

test('blocks DNS-rebinding Host headers', () => {
  const r = guardRequest(req('GET', { host: 'evil.example:8787' }), cfg)
  assert.equal(r.ok, false)
  assert.equal(r.status, 403)
})

test('requires JSON content type on POST (blocks simple-request CSRF)', () => {
  const r = guardRequest(req('POST', { 'content-type': 'text/plain' }), cfg)
  assert.equal(r.ok, false)
  assert.equal(r.status, 415)
  assert.equal(guardRequest(req('POST', {}), cfg).ok, false)
})

test('accepts JSON content type with charset', () => {
  assert.equal(guardRequest(req('POST', { 'content-type': 'application/json; charset=utf-8' }), cfg).ok, true)
})

test('treats localhost and 127.0.0.1 as the same app', () => {
  const r = guardRequest(
    req('POST', { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json' }),
    cfg,
  )
  assert.equal(r.ok, true)
})
