import { dedupeFiles, readFileText, searchGoogleDrive } from '../integrations/drive.js'
import { getAccessToken } from '../integrations/oauth.js'
import { isShopifyConfigured, publishToAllChannels, shopifyAdminGraphQL, shopifyRest } from '../integrations/shopify.js'
import { parseJson } from '../lib/utils.js'

// Implementations of the storefront agent's Shopify tools.
export async function toolGetStorefrontAudit() {
  const results = {}

  // Fetch products via GraphQL
  try {
    const data = await shopifyAdminGraphQL(`
      {
        products(first: 10) {
          nodes {
            id
            title
            status
            handle
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
            }
            totalInventory
          }
        }
      }
    `)
    results.products = data?.products?.nodes || []
  } catch (err) {
    results.productsError = err.message
  }

  // Fetch pages via REST
  try {
    const pagesData = await shopifyRest('GET', '/pages.json?limit=10')
    results.pages = (pagesData.pages || []).map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      published: p.published_at !== null,
    }))
  } catch (err) {
    results.pagesError = err.message
  }

  // Fetch active theme settings summary
  try {
    const settings = await toolGetThemeSettings()
    results.themeSettings = settings
      ? { fetched: true, colorSchemeCount: Object.keys(settings.current || {}).length }
      : { fetched: false }
  } catch (err) {
    results.themeSettingsError = err.message
  }

  return results
}

export async function toolGetThemeSettings() {
  if (!isShopifyConfigured()) throw new Error('Shopify not configured')
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env

  // Get active theme id
  const themesUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/themes.json`
  const themesRes = await fetch(themesUrl, {
    headers: { 'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN },
  })
  if (!themesRes.ok) throw new Error(`Could not fetch themes: ${themesRes.status}`)
  const themesData = await themesRes.json()
  const activeTheme = (themesData.themes || []).find((t) => t.role === 'main')
  if (!activeTheme) throw new Error('No active theme found')

  const assetUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`
  const assetRes = await fetch(assetUrl, {
    headers: { 'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN },
  })
  if (!assetRes.ok) throw new Error(`Could not fetch settings_data.json: ${assetRes.status}`)
  const assetData = await assetRes.json()
  const rawValue = assetData?.asset?.value
  if (!rawValue) throw new Error('settings_data.json value is empty')
  return parseJson(rawValue, {})
}

export async function toolUpdateThemeSettings(updates) {
  if (!isShopifyConfigured()) throw new Error('Shopify not configured')
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_API_VERSION } = process.env

  // Get active theme id
  const themesUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/themes.json`
  const themesRes = await fetch(themesUrl, {
    headers: { 'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN },
  })
  if (!themesRes.ok) throw new Error(`Could not fetch themes: ${themesRes.status}`)
  const themesData = await themesRes.json()
  const activeTheme = (themesData.themes || []).find((t) => t.role === 'main')
  if (!activeTheme) throw new Error('No active theme found')

  // Read current settings
  const current = await toolGetThemeSettings()

  // Deep merge updates into current
  function deepMerge(target, source) {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }
  const merged = deepMerge(current, updates)

  // Write back
  const putUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/themes/${activeTheme.id}/assets.json`
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ asset: { key: 'config/settings_data.json', value: JSON.stringify(merged) } }),
  })
  if (!putRes.ok) {
    const text = await putRes.text()
    throw new Error(`Could not update settings_data.json: ${putRes.status} ${text.slice(0, 200)}`)
  }
  return { updated: true }
}

export async function toolListThemes() {
  const data = await shopifyRest('GET', '/themes.json')
  return (data.themes || []).map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role, // "main" = currently active, "unpublished" = installed but inactive
    themeStoreId: t.theme_store_id,
    updatedAt: t.updated_at,
  }))
}

export async function toolActivateTheme(themeId) {
  const numericId = String(themeId).replace(/\D/g, '')
  if (!numericId) throw new Error('Invalid themeId — must be a numeric ID from list_themes.')
  const data = await shopifyRest('PUT', `/themes/${numericId}.json`, {
    theme: { id: Number(numericId), role: 'main' },
  })
  return {
    id: data.theme?.id,
    name: data.theme?.name,
    role: data.theme?.role,
    activatedAt: new Date().toISOString(),
  }
}

export async function toolGetPages() {
  const data = await shopifyRest('GET', '/pages.json?limit=25')
  return (data.pages || []).map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    body_html: p.body_html,
    published: p.published_at !== null,
    created_at: p.created_at,
  }))
}

export async function toolCreateOrUpdatePage({ id, title, body_html, handle, published }) {
  if (id) {
    const data = await shopifyRest('PUT', `/pages/${id}.json`, {
      page: { id, title, body_html, handle, published },
    })
    return data.page
  }
  const data = await shopifyRest('POST', '/pages.json', {
    page: { title, body_html, handle, published: published ?? true },
  })
  return data.page
}

export async function toolGetMenus() {
  const data = await shopifyAdminGraphQL(`
    {
      menus(first: 10) {
        nodes {
          id
          title
          handle
          items {
            title
            url
          }
        }
      }
    }
  `)
  return data?.menus?.nodes || []
}

export async function toolCreateCollection({ title, descriptionHtml, published }) {
  const data = await shopifyAdminGraphQL(
    `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
          handle
        }
        userErrors { field message }
      }
    }
  `,
    { input: { title, descriptionHtml, published: published ?? true } },
  )
  const result = data?.collectionCreate
  if (result?.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '))
  }
  return result?.collection
}

export async function toolPublishProduct(productId) {
  const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`
  const data = await shopifyAdminGraphQL(
    `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title status }
        userErrors { field message }
      }
    }
  `,
    { input: { id: gid, status: 'ACTIVE' } },
  )
  const result = data?.productUpdate
  if (result?.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '))
  }
  // Also publish to the Online Store sales channel so it appears on the storefront
  try { await publishToAllChannels(gid) } catch { /* non-fatal */ }
  return result?.product
}

export async function toolScanDriveForProduct(query) {
  const token = await getAccessToken('google')
  if (!token) return { error: 'Google Drive not connected', files: [] }

  const results = await searchGoogleDrive(query)
  if (!results.length) return { files: [], message: 'No Drive files found for query: ' + query }

  const deduped = dedupeFiles(results).slice(0, 5)
  const withText = await Promise.all(
    deduped.map(async (file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webUrl: file.webUrl,
      text: await readFileText(file),
    })),
  )
  return { files: withText }
}

// ─── Audit Agents ────────────────────────────────────────────────────────────

export async function toolDeleteProduct(productId) {
  const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`
  const data = await shopifyAdminGraphQL(`
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
      }
    }
  `, { input: { id: gid } })
  if (data?.productDelete?.userErrors?.length) {
    throw new Error(data.productDelete.userErrors.map((e) => e.message).join('; '))
  }
  return { success: true, deletedId: data?.productDelete?.deletedProductId }
}

export async function toolUnpublishProduct(productId) {
  const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`
  const data = await shopifyAdminGraphQL(`
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id status }
        userErrors { field message }
      }
    }
  `, { input: { id: gid, status: 'DRAFT' } })
  if (data?.productUpdate?.userErrors?.length) {
    throw new Error(data.productUpdate.userErrors.map((e) => e.message).join('; '))
  }
  return data?.productUpdate?.product
}

export async function toolUpdateProduct(productId, fields) {
  const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`
  const inputFields = { id: gid }
  if (fields.title) inputFields.title = fields.title
  if (fields.descriptionHtml) inputFields.descriptionHtml = fields.descriptionHtml
  if (fields.vendor) inputFields.vendor = fields.vendor
  if (fields.productType) inputFields.productType = fields.productType
  if (fields.tags) inputFields.tags = fields.tags

  const data = await shopifyAdminGraphQL(`
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title status handle }
        userErrors { field message }
      }
    }
  `, { input: inputFields })
  if (data?.productUpdate?.userErrors?.length) {
    throw new Error(data.productUpdate.userErrors.map((e) => e.message).join('; '))
  }

  // Update price if provided
  if (fields.price) {
    const product = data?.productUpdate?.product
    if (product) {
      const varData = await shopifyAdminGraphQL(`
        { product(id: "${gid}") { variants(first:1) { nodes { id } } } }
      `)
      const variantId = varData?.product?.variants?.nodes?.[0]?.id
      if (variantId) {
        const priceStr = parseFloat(String(fields.price).replace(/[^0-9.]/g, '')).toFixed(2)
        await shopifyAdminGraphQL(`
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }
        `, { productId: gid, variants: [{ id: variantId, price: priceStr }] })
      }
    }
  }

  return data?.productUpdate?.product
}

export async function toolDeletePage(pageId) {
  await shopifyRest('DELETE', `/pages/${pageId}.json`)
  return { success: true, deletedId: pageId }
}

export async function toolDeleteCollection(collectionId) {
  const gid = collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`
  const data = await shopifyAdminGraphQL(`
    mutation collectionDelete($input: CollectionDeleteInput!) {
      collectionDelete(input: $input) {
        deletedCollectionId
        userErrors { field message }
      }
    }
  `, { input: { id: gid } })
  if (data?.collectionDelete?.userErrors?.length) {
    throw new Error(data.collectionDelete.userErrors.map((e) => e.message).join('; '))
  }
  return { success: true, deletedId: data?.collectionDelete?.deletedCollectionId }
}

export async function toolAddProductToCollection(productId, collectionId) {
  const productGid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`
  const collectionGid = collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`
  const data = await shopifyAdminGraphQL(`
    mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id title }
        userErrors { field message }
      }
    }
  `, { id: collectionGid, productIds: [productGid] })
  if (data?.collectionAddProducts?.userErrors?.length) {
    throw new Error(data.collectionAddProducts.userErrors.map((e) => e.message).join('; '))
  }
  return data?.collectionAddProducts?.collection
}
