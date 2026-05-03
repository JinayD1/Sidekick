import { fetchJson } from '../lib/http.js'
import { callAnthropicReasoning } from './anthropic.js'
import { getAccessToken } from './oauth.js'

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const IMAGE_MIME_QUERY = IMAGE_MIME_TYPES.map((m) => `mimeType = '${m}'`).join(' or ')

export const IMAGE_HERO_KEYWORDS = ['front', 'hero', 'product', 'lifestyle', 'main', 'cover', 'primary', 'feature']

export async function searchDriveImagesInFolder(folderId) {
  const token = await getAccessToken('google')
  if (!token) return []

  const params = new URLSearchParams({
    q: `trashed=false and '${folderId}' in parents and (${IMAGE_MIME_QUERY})`,
    pageSize: '20',
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  try {
    const data = await fetchJson(`https://www.googleapis.com/drive/v3/files?${params}`, token)
    return data.files || []
  } catch {
    return []
  }
}

export async function searchDriveImagesGlobal(productTitle, fallbackQueries) {
  const token = await getAccessToken('google')
  if (!token) return []

  const terms = [productTitle, ...fallbackQueries].filter(Boolean)
  const searchWord = terms[0]?.split(/\s+/).find((w) => w.length > 2) || terms[0] || 'product'
  const escaped = searchWord.replaceAll("'", "\\'")

  const params = new URLSearchParams({
    q: `trashed=false and (${IMAGE_MIME_QUERY}) and name contains '${escaped}'`,
    pageSize: '15',
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })

  try {
    const data = await fetchJson(`https://www.googleapis.com/drive/v3/files?${params}`, token)
    return data.files || []
  } catch {
    return []
  }
}

export async function rankAndSelectImages(images, productTitle, productDescription) {
  const titleWords = productTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  // Heuristic pre-score
  const prescored = images.map((img) => {
    const nameLower = img.name.toLowerCase()
    let score = 0
    for (const kw of IMAGE_HERO_KEYWORDS) {
      if (nameLower.includes(kw)) score += 2
    }
    for (const w of titleWords) {
      if (nameLower.includes(w)) score += 3
    }
    return { ...img, _score: score }
  })

  const seen = new Set()
  const candidates = prescored
    .filter((img) => {
      if (seen.has(img.id)) return false
      seen.add(img.id)
      return true
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, 8) // gather more before AI filtering

  if (!candidates.length) return []

  // AI validation: ask Haiku which images actually match this product
  try {
    const imageList = candidates.map((img, i) => `${i + 1}. "${img.name}"`).join('\n')
    const aiResponse = await callAnthropicReasoning({
      system: `You are an image relevance validator for an e-commerce product upload system.
Given a product title, optional description, and a list of image filenames from Google Drive,
decide which images actually depict or directly relate to this product.
Return ONLY a JSON array of the 1-indexed positions that are relevant, e.g. [1,3].
If none match, return []. No explanation — only the JSON array.`,
      messages: [
        {
          role: 'user',
          content: `Product title: "${productTitle}"
${productDescription ? `Product description: "${productDescription.slice(0, 300)}"` : ''}

Image filenames:
${imageList}

Which image numbers actually match this product?`,
        },
      ],
      maxTokens: 200,
    })

    const match = aiResponse.match(/\[[\d,\s]*\]/)
    if (match) {
      const kept = JSON.parse(match[0])
      if (Array.isArray(kept) && kept.length > 0) {
        const filtered = kept.map((i) => candidates[i - 1]).filter(Boolean).slice(0, 3)
        if (filtered.length > 0) return filtered
      }
    }
  } catch {
    // fall through to heuristic result
  }

  return candidates.slice(0, 3)
}

export function driveImageToMediaDraft(image) {
  return {
    originalSource: `https://drive.google.com/uc?export=download&id=${image.id}`,
    mediaContentType: 'IMAGE',
    alt: image.name.replace(/\.[^.]+$/, ''),
    sourceFileName: image.name,
    driveFileId: image.id,
    thumbnailLink: image.thumbnailLink || null,
  }
}

export async function findDriveImagesForProduct(sourceFile, productTitle, fallbackQueries, productDescription) {
  try {
    let images = []

    if (sourceFile.provider === 'google') {
      const parentIds = sourceFile.parents?.length ? sourceFile.parents : []
      if (parentIds.length) {
        images = await searchDriveImagesInFolder(parentIds[0])
      }
    }

    if (!images.length) {
      images = await searchDriveImagesGlobal(productTitle, fallbackQueries)
    }

    const ranked = await rankAndSelectImages(images, productTitle, productDescription)
    return ranked.map(driveImageToMediaDraft)
  } catch {
    return []
  }
}
