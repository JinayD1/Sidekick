import { answerFromCloudFiles } from './agents/driveChat.js'
import { createMockProduct } from './agents/productLaunch.js'
import { runStorefrontAgent } from './agents/storefrontAgent.js'
import { ANTHROPIC_MODEL, API_ORIGIN, providerConfig } from './config.js'
import { finishOAuth, getAccessToken, readTokens, startOAuth } from './integrations/oauth.js'
import { createShopifyDraftProduct, isShopifyConfigured } from './integrations/shopify.js'
import { readJson, sendJson, setCors } from './lib/http.js'

// HTTP route table for the Sidekick API.
export async function route(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, API_ORIGIN)

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const tokens = await readTokens()
    sendJson(res, 200, {
      ok: true,
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      model: ANTHROPIC_MODEL,
      google: Boolean(tokens.google?.refresh_token || tokens.google?.access_token),
      microsoft: Boolean(tokens.microsoft?.refresh_token || tokens.microsoft?.access_token),
      googleConfigured: Boolean(providerConfig.google.clientId && providerConfig.google.clientSecret),
      microsoftConfigured: Boolean(providerConfig.microsoft.clientId && providerConfig.microsoft.clientSecret),
      shopifyConfigured: isShopifyConfigured(),
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/shopify/status') {
    sendJson(res, 200, {
      configured: isShopifyConfigured(),
      storeDomain: isShopifyConfigured() ? process.env.SHOPIFY_STORE_DOMAIN : null,
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/shopify/products/create') {
    const body = await readJson(req)
    const result = await createShopifyDraftProduct(body.draft)
    sendJson(res, result.success ? 200 : 400, result)
    return
  }

  const oauthStart = url.pathname.match(/^\/api\/oauth\/(google|microsoft)\/start$/)
  if (req.method === 'GET' && oauthStart) {
    startOAuth(res, oauthStart[1])
    return
  }

  const oauthCallback = url.pathname.match(/^\/api\/oauth\/(google|microsoft)\/callback$/)
  if (req.method === 'GET' && oauthCallback) {
    await finishOAuth(res, oauthCallback[1], url)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    const body = await readJson(req)
    setCors(res)
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
    const emit = (obj) => res.write(JSON.stringify(obj) + '\n')
    try {
      await answerFromCloudFiles(emit, body.message || '', body.history || [])
    } catch (error) {
      console.error(error)
      emit({ type: 'final', display: { answer: error.message || 'Unexpected error', files: [] }, raw: {} })
    }
    res.end()
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/products/create') {
    const body = await readJson(req)
    const result = await createMockProduct(body.draft)
    sendJson(res, result.ok ? 200 : 400, result)
    return
  }

  const thumbMatch = url.pathname.match(/^\/api\/drive\/thumbnail\/([^/]+)$/)
  if (req.method === 'GET' && thumbMatch) {
    const fileId = thumbMatch[1]
    try {
      const token = await getAccessToken('google')
      if (!token) { res.writeHead(401); res.end(); return }
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&acknowledgeAbuse=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!driveRes.ok) { res.writeHead(driveRes.status); res.end(); return }
      const contentType = driveRes.headers.get('content-type') || 'image/jpeg'
      setCors(res)
      res.writeHead(200, { 'content-type': contentType, 'cache-control': 'private, max-age=300' })
      driveRes.body.pipeTo(new WritableStream({ write(chunk) { res.write(chunk) }, close() { res.end() } }))
    } catch { res.writeHead(500); res.end() }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/storefront/agent') {
    const body = await readJson(req)
    setCors(res)
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' })
    const emit = (obj) => res.write(JSON.stringify(obj) + '\n')
    try {
      await runStorefrontAgent(emit, body.message || '', body.history || [])
    } catch (error) {
      console.error(error)
      emit({ type: 'final', answer: error.message || 'Unexpected error in storefront agent' })
    }
    res.end()
    return
  }

  sendJson(res, 404, { ok: false, error: 'Not found' })
}
