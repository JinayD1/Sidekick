import { fetchJson, fetchText } from '../lib/http.js'
import { getAccessToken } from './oauth.js'

// Google Drive / OneDrive search and file reading.
export async function searchGoogleDrive(query) {
  const token = await getAccessToken('google')
  if (!token) return []

  const escaped = query.replaceAll("'", "\\'")
  const params = new URLSearchParams({
    q: `trashed=false and (name contains '${escaped}' or fullText contains '${escaped}')`,
    pageSize: '8',
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size,parents)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  const data = await fetchJson(`https://www.googleapis.com/drive/v3/files?${params}`, token)
  return (data.files || []).map((file) => ({
    provider: 'google',
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webUrl: file.webViewLink,
    modifiedTime: file.modifiedTime,
    size: file.size,
    parents: file.parents || [],
  }))
}

// ─── Drive Image Discovery ────────────────────────────────────────────────────

export async function searchMicrosoftDrive(query) {
  const token = await getAccessToken('microsoft')
  if (!token) return []

  const encoded = encodeURIComponent(query.replaceAll("'", "''"))
  const data = await fetchJson(
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encoded}')?$top=8&select=id,name,webUrl,file,folder,size,lastModifiedDateTime`,
    token,
  )
  return (data.value || [])
    .filter((item) => item.file)
    .map((file) => ({
      provider: 'microsoft',
      id: file.id,
      name: file.name,
      mimeType: file.file?.mimeType || 'application/octet-stream',
      webUrl: file.webUrl,
      modifiedTime: file.lastModifiedDateTime,
      size: file.size,
    }))
}

export async function readFileText(file) {
  try {
    const token = await getAccessToken(file.provider)
    if (!token) return ''

    if (file.provider === 'google') {
      const exportMime = googleExportMime(file.mimeType)
      const url = exportMime
        ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`
        : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
      return await fetchText(url, token)
    }

    if (!isLikelyText(file.mimeType, file.name)) {
      return `[${file.name}] is not a directly readable text/CSV file. Metadata matched the search.`
    }

    return await fetchText(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`, token)
  } catch (error) {
    return `[Could not read ${file.name}: ${error.message}]`
  }
}

export function googleExportMime(mimeType) {
  if (mimeType === 'application/vnd.google-apps.document') return 'text/plain'
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'text/csv'
  if (mimeType === 'application/vnd.google-apps.presentation') return 'text/plain'
  return null
}

export function isLikelyText(mimeType, name) {
  return (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('csv') ||
    /\.(txt|csv|json|md|tsv)$/i.test(name)
  )
}

export function dedupeFiles(files) {
  const seen = new Set()
  return files.filter((file) => {
    const key = `${file.provider}:${file.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function toDisplayFile(file) {
  return {
    title: file.name,
    provider: file.provider,
    url: file.webUrl,
    reason: 'Matched the query in connected cloud storage.',
  }
}
