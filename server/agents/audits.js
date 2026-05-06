import { callAnthropic, callAnthropicReasoning } from '../integrations/anthropic.js'
import { getProductsWithDetails, shopifyAdminGraphQL } from '../integrations/shopify.js'
import { batchMap, parseJson } from '../lib/utils.js'
import { toolGetMenus, toolGetPages, toolGetStorefrontAudit, toolGetThemeSettings } from './storefrontTools.js'

// Structured storefront audit agents: UX, product clarity, discoverability.
export async function runUXAudit(emit) {
  emit({ type: 'audit_step', step: 'Initializing UX Auditor Agent…', agent: 'ux' })
  emit({ type: 'audit_step', step: 'Connecting to Shopify Admin — fetching theme, navigation, pages, and products in parallel…', agent: 'ux' })

  const [themeSettings, menus, pages, auditData, collectionsData] = await Promise.all([
    toolGetThemeSettings().catch(() => null),
    toolGetMenus().catch(() => []),
    toolGetPages().catch(() => []),
    toolGetStorefrontAudit().catch(() => ({})),
    shopifyAdminGraphQL(`{ collections(first: 10) { nodes { id title handle } } }`).catch(() => null),
  ])

  const snapshot = {
    products: (auditData.products || []).map((p) => ({
      title: p.title,
      status: p.status,
      hasPrice: !!(p.priceRangeV2?.minVariantPrice?.amount && parseFloat(p.priceRangeV2.minVariantPrice.amount) > 0),
    })),
    pages: (pages || []).map((p) => ({
      title: p.title,
      handle: p.handle,
      published: p.published,
      hasContent: (p.body_html || '').replace(/<[^>]+>/g, '').trim().length > 80,
    })),
    navigation: menus || [],
    collections: collectionsData?.collections?.nodes || [],
    theme: themeSettings
      ? {
          colorSchemeCount: Object.keys(themeSettings.current || {}).length,
          sectionTypes: Object.keys(themeSettings.sections || {}).slice(0, 20),
        }
      : null,
  }

  emit({ type: 'audit_step', step: 'Analyzing brand design system, navigation architecture, and trust signals…', agent: 'ux' })
  emit({ type: 'audit_step', step: 'Scoring 5 UX dimensions against rubric (First Impression, Navigation, Trust, Content, Design)…', agent: 'ux' })

  const raw = await callAnthropic({
    system: [
      'You are a senior UX auditor for Shopify storefronts.',
      'Given a store snapshot, score EACH of the following 5 dimensions from 0–10.',
      'For each dimension provide: score (integer 0-10), why (one sentence describing what you found), recommendation (one specific actionable fix, or "None needed" if score >= 9).',
      '',
      'Dimensions:',
      '1. First Impression & Homepage Clarity — Is there a clear hero/value proposition? Are trust signals visible? Key pages (home, about) exist?',
      '2. Navigation & Discoverability — Are menus clear and well-structured? Are collections organized? Can a shopper find a product in 3 clicks or fewer?',
      '3. Trust Signals & Credibility — Do About, Contact, and Policy pages exist WITH real content (hasContent: true)? Social proof indicators?',
      '4. Content Completeness — Are pages populated with real content? Are products ACTIVE with prices? No empty placeholders?',
      '5. Design Consistency & Usability — Does the theme have defined color schemes? Are section types varied and purposeful? Coherent visual system?',
      '',
      'Also output:',
      '  overallScore: weighted average rounded to one decimal',
      '  topFrictions: array of top 3 friction strings (most urgent issues)',
      '  topWins: array of top 3 wins (things already working well)',
      '',
      'Return ONLY valid compact JSON matching exactly:',
      '{"overallScore":7.2,"dimensions":[{"name":"...","score":8,"why":"...","recommendation":"..."}],"topFrictions":["..."],"topWins":["..."]}',
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify(snapshot) }],
    maxTokens: 1400,
  })

  const report = parseJson(raw, null)
  if (!report) return { error: 'Could not parse UX audit response from Claude.' }

  emit({ type: 'audit_step', step: `UX Auditor Agent complete — overall score ${report.overallScore}/10`, agent: 'ux', done: true })
  emit({ type: 'audit_report', auditType: 'ux', report })
  return report
}

export async function runProductClarityAudit(emit) {
  emit({ type: 'audit_step', step: 'Initializing Product Clarity Agent…', agent: 'product_clarity' })
  emit({ type: 'audit_step', step: 'Loading full product catalog from Shopify Admin (descriptions, images, variants, metafields)…', agent: 'product_clarity' })

  let products
  try {
    products = await getProductsWithDetails()
  } catch (err) {
    return { error: `Could not fetch products: ${err.message}` }
  }

  if (!products.length) return { error: 'No products found in store.' }

  emit({ type: 'audit_step', step: `Inferring target audiences and scoring clarity across ${products.length} product listings…`, agent: 'product_clarity' })

  // Score each product using Haiku — batched to stay within concurrent-connection limits
  const productScores = await batchMap(
    products,
    async (product) => {
      const snap = {
        title: product.title,
        vendor: product.vendor || '',
        productType: product.productType || '',
        descriptionText: (product.descriptionHtml || '').replace(/<[^>]+>/g, '').trim().slice(0, 1000),
        imageCount: product.images?.nodes?.length || 0,
        variants: (product.variants?.nodes || []).map((v) => ({
          title: v.title,
          price: v.price,
          sku: v.sku,
          inventory: v.inventoryQuantity,
        })),
        tags: product.tags || [],
        metafields: (product.metafields?.nodes || []).map((m) => `${m.namespace}.${m.key}: ${m.value}`),
        status: product.status,
      }

      const resp = await callAnthropicReasoning({
        system: [
          'You are a senior e-commerce copywriter and conversion specialist.',
          'Analyze this Shopify product listing and score it on 4 dimensions (each 0-10):',
          '',
          '1. descriptionQuality — Is the description compelling, benefit-led, and specific to a real use case?',
          '   0-3: missing or generic feature list. 4-6: adequate but not compelling. 7-8: benefit-focused with good specificity. 9-10: excellent — answers objections, paints a vivid use-case picture.',
          '2. visualCompleteness — 0 = no images, 5 = 1 image, 8 = 2 images, 10 = 3+ images.',
          '3. pricingVariantClarity — Are variants titled clearly? Are all prices set and sensible?',
          '   0 = no variants or $0 price. 5 = some variants missing price. 10 = all variants clearly named and priced.',
          '4. audienceKeywordClarity — Can a shopper or AI immediately tell who this is for and what problem it solves?',
          '   Look at title, tags, product type, description. 0 = no audience signal. 10 = crystal-clear audience + use case + benefit keywords.',
          '',
          'Also infer:',
          '- inferredAudience: a 1-sentence description of who this product is for (age, lifestyle, need), based only on the listing data.',
          '- inferredBusinessType: what kind of business this is (e.g. "outdoor gear brand targeting hikers", "premium skincare for professionals").',
          '- missingFields: list any important fields that are absent (e.g. "No description", "No images", "No variants", "No tags", "Price is $0").',
          '- topSuggestions: 2-3 specific, actionable improvements — not generic advice. Reference the actual product.',
          '',
          'Return ONLY compact JSON:',
          '{"productTitle":"...","inferredAudience":"...","inferredBusinessType":"...","scores":{"descriptionQuality":7,"visualCompleteness":10,"pricingVariantClarity":8,"audienceKeywordClarity":6},"averageScore":7.75,"missingFields":["..."],"topSuggestions":["...","..."]}',
        ].join('\n'),
        messages: [{ role: 'user', content: JSON.stringify(snap) }],
        maxTokens: 700,
      })

      return parseJson(resp, { productTitle: product.title, averageScore: null, error: 'Could not score' })
    },
  )

  const scored = productScores.filter((p) => p.averageScore !== null)
  const overall = scored.length
    ? parseFloat((scored.reduce((s, p) => s + p.averageScore, 0) / scored.length).toFixed(1))
    : null

  const report = {
    overallClarityScore: overall,
    products: productScores,
    topImprovements: productScores
      .flatMap((p) => (p.topSuggestions || []).map((s) => `${p.productTitle}: ${s}`))
      .slice(0, 5),
  }

  emit({ type: 'audit_step', step: `Product Clarity Agent complete — overall clarity score ${overall ?? 'n/a'}/10`, agent: 'product_clarity', done: true })
  emit({ type: 'audit_report', auditType: 'product_clarity', report })
  return report
}

export async function runDiscoverabilityAudit(emit) {
  emit({ type: 'audit_step', step: 'Initializing Discoverability Scout Agent…', agent: 'discoverability' })
  emit({ type: 'audit_step', step: 'Loading product catalog for agentic discovery simulation…', agent: 'discoverability' })

  let products
  try {
    products = await getProductsWithDetails()
  } catch (err) {
    return { error: `Could not fetch products: ${err.message}` }
  }

  if (!products.length) return { error: 'No products found in store.' }

  const catalog = products.map((p) => ({
    title: p.title,
    description: (p.descriptionHtml || '').replace(/<[^>]+>/g, '').slice(0, 500),
    tags: p.tags || [],
    productType: p.productType || '',
  }))

  emit({ type: 'audit_step', step: 'Generating 6 realistic AI shopper personas and purchase queries…', agent: 'discoverability' })

  const queriesRaw = await callAnthropicReasoning({
    system: [
      'You are a consumer research assistant.',
      'Given a product catalog, generate exactly 6 realistic shopper search queries that a typical customer might type into an AI shopping assistant.',
      'Vary the intent: specific product search, problem-based, gift idea, use-case, comparison, occasion-based.',
      'Return ONLY a JSON array of 6 strings: ["query1","query2","query3","query4","query5","query6"]',
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify(catalog) }],
    maxTokens: 300,
  })

  const queries = parseJson(queriesRaw, [])
  if (!Array.isArray(queries) || !queries.length) {
    return { error: 'Could not generate shopper queries.' }
  }

  emit({ type: 'audit_step', step: `Simulating ${queries.length} agentic discovery queries — would an AI shopping assistant recommend your products?`, agent: 'discoverability' })

  // For each query, ask a "cold" Claude (no store identity) if it would recommend any product
  // Batched to stay within concurrent-connection limits
  const queryResults = await batchMap(
    queries,
    async (query) => {
      const resp = await callAnthropicReasoning({
        system: [
          'You are a neutral AI shopping assistant. A shopper asked you a question.',
          'Based ONLY on the product catalog provided, decide if you would recommend any products.',
          'For each product, rate relevance: 0=not relevant, 1=loosely, 2=relevant, 3=highly relevant.',
          'Return ONLY compact JSON:',
          '{"query":"...","wouldRecommend":true,"recommendations":[{"productTitle":"...","relevance":2,"reason":"..."}],"gaps":"what is missing in the catalog for this query"}',
        ].join('\n'),
        messages: [{ role: 'user', content: JSON.stringify({ query, catalog }) }],
        maxTokens: 500,
      })
      const result = parseJson(resp, { query, wouldRecommend: false, recommendations: [], gaps: '' })
      result.query = query
      return result
    },
  )

  const queriesWithRec = queryResults.filter((q) => q.wouldRecommend).length
  const discoverabilityScore = Math.round((queriesWithRec / queries.length) * 100)

  const neverRecommended = catalog
    .filter((p) =>
      !queryResults.some((q) =>
        (q.recommendations || []).some((r) => r.productTitle === p.title && r.relevance >= 2),
      ),
    )
    .map((p) => p.title)

  const report = {
    overallDiscoverabilityScore: discoverabilityScore,
    queriesTested: queries.length,
    queriesWithRecommendation: queriesWithRec,
    neverRecommended,
    queryResults,
    topImprovements: queryResults
      .filter((q) => !q.wouldRecommend && q.gaps)
      .map((q) => `"${q.query}": ${q.gaps}`)
      .slice(0, 4),
  }

  emit({ type: 'audit_step', step: `Discoverability Scout complete — ${discoverabilityScore}% of queries matched at least one product`, agent: 'discoverability', done: true })
  emit({ type: 'audit_report', auditType: 'discoverability', report })
  return report
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
