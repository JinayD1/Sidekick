import { APP_ORIGIN } from '../config.js'

// Small HTTP helpers shared by routes and integrations.
export async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Cloud API failed: ${response.status} ${await response.text()}`)
  return response.json()
}

export async function fetchText(url, token) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`File download failed: ${response.status}`)
  const text = await response.text()
  return text.slice(0, 12000)
}

export async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  })
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`)
  return response.json()
}

export async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

export function sendJson(res, status, data) {
  setCors(res)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function redirect(res, location) {
  res.writeHead(302, { location })
  res.end()
}

export function setCors(res) {
  res.setHeader('access-control-allow-origin', APP_ORIGIN)
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
}

// ─── Product Launch Agent ────────────────────────────────────────────────────
