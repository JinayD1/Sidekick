import { callAnthropic } from '../integrations/anthropic.js'
import { dedupeFiles, readFileText, searchGoogleDrive, searchMicrosoftDrive, toDisplayFile } from '../integrations/drive.js'
import { getStatus } from '../integrations/oauth.js'
import { parseJson } from '../lib/utils.js'
import { productAgentFlow } from './productLaunch.js'
import { runStorefrontAgentForChat } from './storefrontAgent.js'

// Chat agent: intent planning, Drive search + rerank, and answer synthesis.
export async function answerFromCloudFiles(emit, message, history) {
  if (!message.trim()) {
    emit({ type: 'final', display: { answer: 'Message is required', files: [] }, raw: {} })
    return
  }

  const status = await getStatus()
  const plan = await createSearchPlan(message, history)
  emit({ type: 'plan', plan })

  if (plan.intent === 'product_create') {
    await productAgentFlow(emit, message, plan, status)
    return
  }

  if (plan.intent === 'storefront_agent') {
    await runStorefrontAgentForChat(emit, message, history)
    return
  }

  if (!plan.needsFiles) {
    const answer = await chatReply(message, history)
    emit({
      type: 'final',
      display: { answer, files: [], data: [], visual: null },
      raw: { plan },
    })
    return
  }

  if (!status.google && !status.microsoft) {
    emit({
      type: 'final',
      display: {
        answer:
          'Connect Google Drive first, then I can search your files and answer from their contents.',
        files: [],
      },
      raw: { plan, status },
    })
    return
  }

  const providerNames = plan.providers?.length
    ? plan.providers.filter((provider) => status[provider])
    : ['google', 'microsoft'].filter((provider) => status[provider])
  const queries = plan.queries?.length ? plan.queries.slice(0, 5) : [message]

  const results = []
  for (const provider of providerNames) {
    for (const query of queries) {
      const found = provider === 'google'
        ? await searchGoogleDrive(query)
        : await searchMicrosoftDrive(query)
      results.push(...found)
    }
  }

  const uniqueResults = dedupeFiles(results).slice(0, 15)
  const candidates = await Promise.all(
    uniqueResults.slice(0, 12).map(async (file) => ({
      ...file,
      text: await readFileText(file),
    })),
  )

  const ranked = await rerankCandidates(message, candidates)
  emit({ type: 'rerank', candidates: candidates.length, kept: Math.min(ranked.length, 5) })

  const filesWithText = ranked.slice(0, 5)
  const display = await synthesizeAnswer(message, filesWithText)
  emit({
    type: 'final',
    display,
    raw: {
      plan,
      candidatesConsidered: candidates.map(({ text, ...file }) => ({ ...file, textPreview: (text || '').slice(0, 200) })),
      files: filesWithText.map(({ text, ...file }) => ({
        ...file,
        textPreview: (text || '').slice(0, 800),
      })),
    },
  })
}

export async function rerankCandidates(question, candidates) {
  if (candidates.length <= 5 || !process.env.ANTHROPIC_API_KEY) return candidates

  const summaries = candidates.map((file, index) => ({
    index,
    name: file.name,
    mimeType: file.mimeType,
    snippet: (file.text || '').slice(0, 400).replace(/\s+/g, ' ').trim(),
  }))

  const text = await callAnthropic({
    system: [
      'You are a relevance ranker for cloud-file search results.',
      'Given a user question and candidate files (name, MIME type, content snippet),',
      'rank ALL candidates from most to least likely to answer the question.',
      '',
      'Return ONLY JSON: {"order":[<index>,<index>,...]} where each index is an integer referring to a candidate.',
      'Include EVERY candidate index exactly once. Most relevant first, irrelevant last.',
      '',
      'Heuristics:',
      '- A small spreadsheet whose content matches the question topic is MORE relevant than a large unrelated PDF that happens to mention the same word.',
      '- Filename signals matter: a file named "Sales Report" is more relevant to a sales question than a generic doc.',
      '- For numerical/quantitative questions, prefer spreadsheets and structured data over prose.',
      '- For prose questions, prefer documents and presentations over spreadsheets.',
    ].join('\n'),
    messages: [{ role: 'user', content: JSON.stringify({ question, candidates: summaries }) }],
    maxTokens: 300,
  })

  const parsed = parseJson(text, null)
  if (!parsed?.order || !Array.isArray(parsed.order)) return candidates

  const seen = new Set()
  const ordered = []
  for (const i of parsed.order) {
    if (Number.isInteger(i) && i >= 0 && i < candidates.length && !seen.has(i)) {
      ordered.push(candidates[i])
      seen.add(i)
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    if (!seen.has(i)) ordered.push(candidates[i])
  }
  return ordered
}

export async function createSearchPlan(message, history) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { needsFiles: false, providers: [], queries: [], reason: 'Anthropic API key missing.' }
  }

  const text = await callAnthropic({
    system: [
      'You are the routing layer for Sidekick, a Shopify assistant.',
      'For every user message, decide whether it requires searching the user\'s Google Drive / OneDrive files,',
      'and if so, produce search keywords.',
      '',
      'Return ONLY compact JSON: {"intent":"chat|files|product_create|storefront_agent","needsFiles":bool,"providers":["google","microsoft"],"queries":["kw1","kw2"],"reason":"..."}',
      '',
      'BIAS: When in doubt, ALWAYS prefer needsFiles=true and search. A false positive (searching when not needed) is harmless. A false negative (not searching when the user wanted Drive data) makes you useless.',
      '',
      'INTENT RULES (in priority order):',
      '- intent:"storefront_agent" when the user wants to publish, upload, push, or add something to their live website/store/storefront WITHOUT asking to scan Drive for a new doc first. Also covers: audit store, change theme, create pages/collections, delete/unpublish products, "publish it", "add it to my store", "upload it to my website". Set needsFiles:false.',
      '  KEY: if the conversation already has a product draft and the user says "publish it", "upload it", "add it to my site/store/website" → ALWAYS storefront_agent.',
      '  Triggers: "publish it", "upload it to my website", "add it to my store", "push it live", "audit my store", "update theme", "create a page", "create a collection", "list my pages", "publish all products", "show me my store", "make changes to the storefront".',
      '- intent:"product_create" ONLY when the user explicitly asks to SCAN Drive / find a doc / create a NEW product from scratch with no prior context. Set needsFiles:true.',
      '  Triggers: "scan for new product", "find a product doc", "create product from drive", "scan storefront ideas", "scan and upload".',
      '  DO NOT use product_create if the user is referring to something already shown in the conversation.',
      '- intent:"files" when the user wants to search, read, browse, or analyze files but not create a product. Set needsFiles:true.',
      '  Triggers: "drive" alone, "check my files", "what\'s in my drive", "show me my docs", vague file references.',
      '- intent:"chat" ONLY for: pure greetings ("hi", "hello"), pure chit-chat ("how are you"), or questions answerable entirely from general knowledge with zero need for the user\'s personal files.',
      '',
      'ROUTING — when needsFiles=true:',
      '- ANY mention of "drive", "docs", "files", "my data", "my store", "my products", "my sales", "our roadmap", named files, or personal storage.',
      '- Action verbs aimed at the storefront: scan, upload, sync, publish, create, draft, add.',
      '- Requests to summarize, analyze, find, look up, or report on anything specific.',
      '- VAGUE messages that could relate to Drive (e.g. just "drive", "show me", "what do I have").',
      '',
      'ROUTING — when needsFiles=false (VERY restrictive):',
      '- Pure greetings with no action intent ("hi", "hello", "thanks", "how are you").',
      '- Purely hypothetical or educational Shopify questions with zero reference to the user\'s own store or files.',
      '- Meta questions about the assistant only ("what can you do?").',
      'When needsFiles=false, return queries:[] and providers:[].',
      '',
      'QUERY RULES (only matter when needsFiles=true; the API does literal substring matching):',
      '- Each query is passed verbatim to Drive\'s `name contains` and `fullText contains` operators.',
      '- NO operators, NO quotes, NO field prefixes. Never emit `filename:`, `name:`, `:`, AND/OR, parentheses, or wildcards.',
      '- Prefer single distinctive words. Multi-word phrases only match if a file name/content contains that exact substring.',
      '- Output 3-5 candidate keywords covering different angles: the topic, distinctive nouns the user said, likely file-name fragments, related synonyms.',
      '- The user may NOT name a file. Infer keywords from the topic. Example: "what was my Q1 revenue?" -> ["revenue","sales","Q1","quarterly","financial"].',
      '- If the user does name a file, include that name AND 2-3 fallback keywords from the rest of the question.',
      '- For vague Drive browse requests (e.g. "drive" alone), use discovery keywords: ["product","sales","report","inventory","launch"].',
      '',
      'PROVIDER RULES:',
      '- Default to both ["google","microsoft"] unless the user explicitly names one.',
      '',
      'Examples:',
      'User: "hello" -> {"intent":"chat","needsFiles":false,"providers":[],"queries":[],"reason":"greeting"}',
      'User: "what can you do?" -> {"intent":"chat","needsFiles":false,"providers":[],"queries":[],"reason":"meta question"}',
      'User: "drive" -> {"intent":"files","needsFiles":true,"providers":["google","microsoft"],"queries":["product","sales","report","inventory","launch"],"reason":"user wants to browse Drive"}',
      'User: "what is in my Sidekick Test Sale sheet?" -> {"intent":"files","needsFiles":true,"providers":["google","microsoft"],"queries":["Sidekick","Test Sale","Sidekick Test"],"reason":"named file plus fallbacks"}',
      'User: "summarize my recent sales numbers" -> {"intent":"files","needsFiles":true,"providers":["google","microsoft"],"queries":["sales","revenue","quarterly","report"],"reason":"topic keywords for discovery"}',
      'User: "what is a good discount strategy for new customers?" -> {"intent":"chat","needsFiles":false,"providers":[],"queries":[],"reason":"general advice, no user data needed"}',
      'User: "scan for new product and upload to storefront" -> {"intent":"product_create","needsFiles":true,"providers":["google","microsoft"],"queries":["product","launch","brief","new","storefront"],"reason":"scan Drive for product brief and publish"}',
      'User: "create a product from the StormLite launch doc" -> {"intent":"product_create","needsFiles":true,"providers":["google","microsoft"],"queries":["StormLite","launch","product brief","StormLite launch"],"reason":"product creation from Drive doc"}',
      'User: "draft a product from my jacket brief in Drive" -> {"intent":"product_create","needsFiles":true,"providers":["google","microsoft"],"queries":["jacket","brief","launch","product"],"reason":"product creation from Drive doc"}',
      'User: "scan storefront ideas doc" -> {"intent":"product_create","needsFiles":true,"providers":["google","microsoft"],"queries":["storefront","ideas","product","brief"],"reason":"scan a doc for product/storefront ideas"}',
      'User: "audit my store" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"storefront audit request"}',
      'User: "publish it" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"follow-up publish action"}',
      'User: "upload it to my website" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"follow-up upload to storefront"}',
      'User: "no, i want you to upload it to my website" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"user wants storefront publish not another Drive scan"}',
      'User: "add it to my store" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"follow-up store publish"}',
      'User: "push it live" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"follow-up publish to storefront"}',
      'User: "create a Summer Sale collection" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"collection creation — store-level operation"}',
      'User: "what pages do I have?" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"listing store pages"}',
      'User: "publish all my draft products" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"publishing products — store-level operation"}',
      'User: "update my theme colors" -> {"intent":"storefront_agent","needsFiles":false,"providers":[],"queries":[],"reason":"theme modification"}',
    ].join('\n'),
    messages: [
      ...history.slice(-4).map((entry) => ({
        role: entry.sender === 'assistant' ? 'assistant' : 'user',
        content: entry.text || '',
      })),
      { role: 'user', content: message },
    ],
    maxTokens: 500,
  })

  return parseJson(text, { needsFiles: true, providers: [], queries: [message], reason: 'Could not parse plan; defaulting to file search.' })
}

export async function chatReply(message, history) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'I need an Anthropic API key to answer. Add ANTHROPIC_API_KEY to .env.local.'
  }
  return callAnthropic({
    system: [
      'You are Sidekick, a friendly Shopify assistant.',
      'Reply conversationally and concisely in plain text. No JSON, no markdown headers.',
      'You can answer general questions about Shopify, e-commerce, and have casual chat.',
      'Keep replies under 4 sentences unless the user asks for detail.',
    ].join('\n'),
    messages: [
      ...history.slice(-6).map((entry) => ({
        role: entry.sender === 'assistant' ? 'assistant' : 'user',
        content: entry.text || '',
      })),
      { role: 'user', content: message },
    ],
    maxTokens: 400,
  })
}

export async function synthesizeAnswer(question, files) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      answer:
        files.length === 0
          ? 'I did not find matching cloud files. Add an Anthropic API key to enable smart synthesis.'
          : `I found ${files.length} matching file${files.length === 1 ? '' : 's'}, but Anthropic is not configured yet. Open the source files below to inspect them.`,
      files: files.map(toDisplayFile),
      visual: null,
    }
  }

  const context = files.map((file, index) => ({
    index: index + 1,
    provider: file.provider,
    name: file.name,
    mimeType: file.mimeType,
    url: file.webUrl,
    text: file.text.slice(0, 7000),
  }))

  const today = new Date().toISOString().slice(0, 10)
  const text = await callAnthropic({
    system: [
      `Today's date is ${today}. Use it when the user says "this year", "last year", "Q2 last year", "recent", etc.`,
      'Answer the user question from the provided cloud file excerpts.',
      'Return ONLY JSON in this shape:',
      '{',
      '  "answer": "plain English answer, 1-4 sentences",',
      '  "files": [{"title":"file name","provider":"google|microsoft","url":"https://...","reason":"why used"}],',
      '  "data": [{"label":"...","value":"..."}],',
      '  "visual": null OR a chart OR a table',
      '}',
      '',
      'Visual format options:',
      '- Omit (null) when a chart/table adds no value over the prose answer.',
      '- Bar/line chart: {"type":"bar"|"line","title":"...","points":[{"label":"Q1","value":150000}, ...]}',
      '  Use bar for category comparisons. Use line for time series / trends.',
      '- Table: {"type":"table","title":"...","headers":["Col 1","Col 2"],"rows":[["a","b"],["c","d"]]}',
      '  Use a table when the answer is best expressed as multiple rows × multiple columns (>= 2 columns).',
      '',
      'Choose the visual format that best fits the data:',
      '- Pure single-metric breakdowns (revenue by quarter) -> bar or line chart.',
      '- Trends over time -> line chart.',
      '- Multi-attribute comparisons (rows = items, columns = attributes) -> table.',
      '- Plain prose answers (no quantities) -> visual: null.',
      '',
      'If the files do not answer the question, set visual to null and say what is missing in answer.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ question, files: context }),
      },
    ],
    maxTokens: 1400,
  })

  const parsed = parseJson(text, null)
  if (!parsed) {
    return {
      answer: text,
      files: files.map(toDisplayFile),
      visual: null,
    }
  }

  return {
    answer: parsed.answer || 'I searched the connected files and prepared the result.',
    files: Array.isArray(parsed.files) ? parsed.files : files.map(toDisplayFile),
    data: Array.isArray(parsed.data) ? parsed.data : [],
    visual: parsed.visual || null,
  }
}
