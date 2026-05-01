import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { APP_ORIGIN, __dirname, providerConfig, tokenPath } from '../config.js'
import { postForm, redirect } from '../lib/http.js'

// OAuth flow and token storage for Google Drive / Microsoft OneDrive.
export function startOAuth(res, provider) {
  const config = providerConfig[provider]
  if (!config.clientId || !config.clientSecret) {
    redirect(res, `${APP_ORIGIN}?oauth_error=${provider}_not_configured`)
    return
  }

  const authUrl = new URL(config.authUrl)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', config.scope)

  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
  } else {
    authUrl.searchParams.set('prompt', 'select_account')
  }

  redirect(res, authUrl.toString())
}

export async function finishOAuth(res, provider, url) {
  const code = url.searchParams.get('code')
  if (!code) {
    redirect(res, `${APP_ORIGIN}?oauth_error=${provider}_missing_code`)
    return
  }

  const config = providerConfig[provider]
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  })

  const token = await postForm(config.tokenUrl, params)
  await saveProviderToken(provider, normalizeToken(token))
  redirect(res, `${APP_ORIGIN}?connected=${provider}`)
}

export async function getAccessToken(provider) {
  const tokens = await readTokens()
  const token = tokens[provider]
  if (!token) return null

  if (token.access_token && token.expires_at && token.expires_at > Date.now() + 60_000) {
    return token.access_token
  }

  if (!token.refresh_token) return token.access_token || null

  const config = providerConfig[provider]
  const refreshed = await postForm(
    config.tokenUrl,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  )
  const nextToken = normalizeToken({ ...refreshed, refresh_token: refreshed.refresh_token || token.refresh_token })
  await saveProviderToken(provider, nextToken)
  return nextToken.access_token
}

export function normalizeToken(token) {
  return {
    ...token,
    expires_at: Date.now() + Number(token.expires_in || 3600) * 1000,
  }
}

export async function getStatus() {
  const tokens = await readTokens()
  return {
    google: Boolean(tokens.google?.refresh_token || tokens.google?.access_token),
    microsoft: Boolean(tokens.microsoft?.refresh_token || tokens.microsoft?.access_token),
  }
}

export async function readTokens() {
  if (!existsSync(tokenPath)) return {}
  return JSON.parse(await readFile(tokenPath, 'utf8'))
}

export async function saveProviderToken(provider, token) {
  await mkdir(__dirname, { recursive: true })
  const tokens = await readTokens()
  tokens[provider] = token
  await writeFile(tokenPath, JSON.stringify(tokens, null, 2))
}
