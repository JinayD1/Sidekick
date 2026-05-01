import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Central configuration. Importing this module loads .env / .env.local first,
// so any module that reads process.env at load time should import from here.

export const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = path.resolve(__dirname, '..')
export const tokenPath = path.join(__dirname, '.tokens.json')
export const productsPath = path.join(__dirname, '.products.json')

loadEnv(path.join(projectRoot, '.env'))
loadEnv(path.join(projectRoot, '.env.local'))

export const PORT = Number(process.env.API_PORT || 8787)
export const API_ORIGIN = process.env.API_ORIGIN || `http://127.0.0.1:${PORT}`
export const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'

export const providerConfig = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${API_ORIGIN}/api/oauth/google/callback`,
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly',
    ].join(' '),
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${API_ORIGIN}/api/oauth/microsoft/callback`,
    scope: ['offline_access', 'User.Read', 'Files.Read'].join(' '),
  },
}

function loadEnv(filePath) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}
