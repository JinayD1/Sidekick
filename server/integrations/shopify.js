import { getAccessToken } from './oauth.js'

// Shopify Admin API client: GraphQL product creation, REST helper, channel publishing.
export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN &&
    process.env.SHOPIFY_API_VERSION,
  )
}

export async function shopifyAdminGraphQL(query, variables = {}) {
  if (!isShopifyConfigured()) {
    throw new Error('Shopify Admin API is not configured. Add SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, and SHOPIFY_API_VERSION to .env.')
  }

  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env
  const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify API HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const json = await response.json()

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join('; ')
    throw new Error(`Shopify GraphQL errors: ${msg}`)
  }

  return json.data
}

export const STAGED_UPLOAD_MUTATION = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`

export async function stageAndUploadDriveImages(mediaItems) {
  const token = await getAccessToken('google')
  if (!token || !mediaItems.length) return []

  const results = []
  for (const item of mediaItems) {
    try {
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${item.driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!driveRes.ok) continue

      const imageBuffer = await driveRes.arrayBuffer()
      const mimeType = (driveRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()

      // Always derive extension from actual MIME to avoid Shopify "extension doesn't match format" error
      const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
      const ext = MIME_TO_EXT[mimeType] || 'jpg'
      const baseName = (item.sourceFileName || 'product-image').replace(/\.[^.]+$/, '')
      const filename = `${baseName}.${ext}`

      const stagedData = await shopifyAdminGraphQL(STAGED_UPLOAD_MUTATION, {
        input: [{
          filename,
          mimeType,
          resource: 'IMAGE',
          httpMethod: 'POST',
          fileSize: String(imageBuffer.byteLength),
        }],
      })

      const target = stagedData?.stagedUploadsCreate?.stagedTargets?.[0]
      if (!target) continue

      const formData = new FormData()
      for (const param of target.parameters) {
        formData.append(param.name, param.value)
      }
      formData.append('file', new Blob([imageBuffer], { type: mimeType }), filename)

      const uploadRes = await fetch(target.url, { method: 'POST', body: formData })
      if (!uploadRes.ok) continue

      results.push({ originalSource: target.resourceUrl, mediaContentType: 'IMAGE', alt: item.alt || null })
    } catch {
      // skip failed image
    }
  }
  return results
}

export const PRODUCT_CREATE_MUTATION = `
  mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        title
        status
        handle
        onlineStorePreviewUrl
        variants(first: 1) {
          nodes { id }
        }
        media(first: 5) {
          nodes {
            id
            alt
            mediaContentType
            status
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export const VARIANT_PRICE_MUTATION = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`

export function buildProductResult(p) {
  const numericId = p.id.replace('gid://shopify/Product/', '')
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || ''
  const storeSlug = storeDomain.replace('.myshopify.com', '')
  return {
    id: p.id,
    numericId,
    title: p.title,
    status: p.status,
    handle: p.handle,
    adminUrl: `https://admin.shopify.com/store/${storeSlug}/products/${numericId}`,
    previewUrl: p.onlineStorePreviewUrl || null,
    media: p.media?.nodes || [],
  }
}

export async function setVariantPrice(product, priceStr) {
  if (!priceStr || isNaN(parseFloat(priceStr))) return
  const variantId = product?.variants?.nodes?.[0]?.id
  if (!variantId) return
  try {
    await shopifyAdminGraphQL(VARIANT_PRICE_MUTATION, {
      productId: product.id,
      variants: [{ id: variantId, price: priceStr }],
    })
  } catch {
    // non-fatal — product still created
  }
}

export async function createShopifyDraftProduct(draft) {
  if (!draft?.title) {
    return { success: false, errors: [{ field: 'title', message: 'title is required' }] }
  }

  if (!isShopifyConfigured()) {
    return { success: false, errors: [{ field: null, message: 'Shopify Admin API is not configured on this server.' }] }
  }

  const input = { status: draft.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT' }
  if (draft.title) input.title = String(draft.title).trim()
  if (draft.descriptionHtml) input.descriptionHtml = String(draft.descriptionHtml)
  if (draft.vendor) input.vendor = String(draft.vendor)
  if (draft.productType) input.productType = String(draft.productType)
  if (Array.isArray(draft.tags) && draft.tags.length) input.tags = draft.tags

  // Price is applied after creation via productVariantsBulkUpdate (not supported in ProductCreateInput)
  const priceStr = draft.price
    ? parseFloat(String(draft.price).replace(/[^0-9.]/g, '')).toFixed(2)
    : null

  // Stage and upload Drive images so Shopify can fetch them
  const stagedMedia = await stageAndUploadDriveImages(
    (draft.media || []).filter((m) => m.driveFileId),
  )

  // Fall back to direct URL for any items without a driveFileId
  const directMedia = (draft.media || [])
    .filter((m) => !m.driveFileId && m.originalSource && m.mediaContentType)
    .map((m) => ({ originalSource: m.originalSource, mediaContentType: m.mediaContentType, alt: m.alt || null }))

  const mediaInput = [...stagedMedia, ...directMedia]

  try {
    const variables = { product: input }
    if (mediaInput.length) variables.media = mediaInput

    const data = await shopifyAdminGraphQL(PRODUCT_CREATE_MUTATION, variables)
    const result = data?.productCreate

    if (!result) {
      return { success: false, errors: [{ field: null, message: 'Unexpected empty response from Shopify.' }] }
    }

    if (result.userErrors?.length) {
      const mediaErrors = result.userErrors.filter((e) =>
        e.field?.includes('media') || e.message?.toLowerCase().includes('media') || e.message?.toLowerCase().includes('image'),
      )
      const otherErrors = result.userErrors.filter((e) => !mediaErrors.includes(e))
      if (otherErrors.length) {
        return { success: false, errors: result.userErrors }
      }
      // Product created but media failed — still set price then return
      await setVariantPrice(result.product, priceStr)
      return { success: true, mediaErrors, product: buildProductResult(result.product) }
    }

    // Set price on the default variant via a separate mutation
    await setVariantPrice(result.product, priceStr)

    // Publish to the Online Store channel so it appears on the storefront
    if (draft.status === 'ACTIVE') {
      try { await publishToAllChannels(result.product.id) } catch { /* non-fatal */ }
    }

    return {
      success: true,
      mediaErrors: [],
      product: buildProductResult(result.product),
    }
  } catch (error) {
    return { success: false, errors: [{ field: null, message: error.message }] }
  }
}

// ─── Legacy GraphQL input mapper (reference/P2) ──────────────────────────────
// Used when variants + options + metafields are added later.
// Required scope: write_products
// ─── Storefront Auditor ───────────────────────────────────────────────────────

export async function shopifyRest(method, path, body) {
  if (!isShopifyConfigured()) throw new Error('Shopify not configured')
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}${path}`
  const options = {
    method,
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
  }
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body)
  }
  const response = await fetch(url, options)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Shopify REST ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`)
  }
  return response.json()
}

export async function getProductsWithDetails() {
  const data = await shopifyAdminGraphQL(`{
    products(first: 10) {
      nodes {
        id title status handle descriptionHtml productType vendor tags
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        images(first: 3) { nodes { url altText } }
        variants(first: 5) { nodes { title price sku inventoryQuantity } }
        metafields(first: 5) { nodes { namespace key value } }
      }
    }
  }`)
  return data?.products?.nodes || []
}

let _allPublicationIds = null

export async function publishToAllChannels(productGid) {
  if (!_allPublicationIds) {
    const pubData = await shopifyAdminGraphQL(`{ publications(first: 50) { nodes { id name } } }`)
    const nodes = pubData?.publications?.nodes || []
    _allPublicationIds = nodes.map((p) => p.id)
  }
  if (!_allPublicationIds.length) return
  await shopifyAdminGraphQL(`
    mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `, { id: productGid, input: _allPublicationIds.map((publicationId) => ({ publicationId })) })
}
