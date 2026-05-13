// Request guard for the local API.
//
// The API binds to 127.0.0.1 but that alone doesn't protect it: any web page
// open in the user's browser can still send requests to localhost, and some
// of our endpoints can delete products or switch the live theme. This guard
// blocks the two browser-based attacks that apply:
//
//   1. Cross-site request forgery: a hostile page POSTing to our API. We
//      reject any request whose Origin isn't the Sidekick app, and require
//      Content-Type: application/json on POST, which browsers won't send
//      cross-origin without a CORS preflight that we also reject.
//   2. DNS rebinding: a hostile domain resolving to 127.0.0.1 so its page
//      counts as "same origin". We reject any Host header we don't expect.
//
// Requests with no Origin header (curl, server-side tools, top-level
// navigations such as the OAuth redirect) are allowed.

const LOOPBACK = new Set(['127.0.0.1', 'localhost'])

// Expand a configured origin to its loopback twins, so the app works whether
// the browser uses http://localhost:5173 or http://127.0.0.1:5173.
function originVariants(origin) {
  try {
    const url = new URL(origin)
    if (!LOOPBACK.has(url.hostname)) return [url.origin]
    return [...LOOPBACK].map((h) => `${url.protocol}//${h}${url.port ? `:${url.port}` : ''}`)
  } catch {
    return []
  }
}

export function guardRequest(req, { appOrigin, apiOrigin }) {
  const allowedOrigins = new Set([...originVariants(appOrigin), ...originVariants(apiOrigin)])
  const allowedHosts = new Set([...allowedOrigins].map((o) => new URL(o).host))

  const host = req.headers.host
  if (!host || !allowedHosts.has(host)) {
    return { ok: false, status: 403, error: 'Forbidden: unexpected Host header.' }
  }

  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    return { ok: false, status: 403, error: 'Forbidden: cross-origin request blocked.' }
  }

  if (req.method === 'POST') {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (type !== 'application/json') {
      return { ok: false, status: 415, error: 'POST requests must use Content-Type: application/json.' }
    }
  }

  return { ok: true }
}
