# Sidekick for Shopify Admin

An agentic AI assistant embedded in a Shopify Admin–style dashboard. Merchants ask in plain English and Sidekick reads their Google Drive, launches products to a live Shopify store, audits the storefront, and manages the theme — with a human confirmation gate on anything destructive.

**Demo:** https://youtu.be/bAQ27cwsIN8

Built with React 19 + Vite on the front end, a dependency-free Node HTTP server on the back end, the Anthropic Messages API (tool use) for the agents, and the Shopify Admin REST/GraphQL APIs.

## What it does

| Capability | How it works |
| --- | --- |
| **Drive → live product** | "Scan my Drive and launch the rain jacket." Searches Drive, reads the doc, extracts a structured product draft (title, price, tags, variants, media), lets the merchant edit it, then publishes it to the store as ACTIVE across sales channels. |
| **Storefront audits** | Three specialised agents: a **UX Auditor** (scores 5 dimensions against a fixed rubric), a **Product Clarity** agent (infers audience and scores every listing), and a **Discoverability Scout** (simulates shopper queries with a "cold" Claude to check whether an AI shopping assistant would recommend your products). Results render as score cards in the chat. |
| **Store management** | Create/update pages and collections, edit theme settings, list and activate themes, publish/unpublish/delete products. |
| **Intent routing** | A lightweight planner call classifies each message (`chat`, `files`, `product_create`, `storefront_agent`) so simple questions don't spin up tools. |
| **Streaming UI** | The server streams NDJSON events (`plan`, `tool_call`, `tool_result`, `audit_report`, `final`) so the panel shows live agent activity. |

## Architecture

```
React (Vite)  ──/api/chat (NDJSON stream)──▶  Node server (server/index.js)
  Sidekick panel                                 ├─ planner      (intent routing, Haiku)
  Audit cards                                    ├─ Drive agent  (search → rerank → extract)
                                                 ├─ Storefront agent (Claude tool-use loop, ≤10 rounds)
                                                 │     ├─ Shopify Admin REST / GraphQL
                                                 │     └─ audit agents (batched, prompt-cached)
                                                 └─ confirmation gate (server/lib/confirm.js)
```

Key design decisions:

- **Server-enforced human-in-the-loop.** `delete_*`, `unpublish_product` and `activate_theme` are *held* the first time the agent calls them. The agent must ask the user, and the action only runs when the same call is repeated from a **later user turn**. The model cannot approve its own action within a run, whatever it says. See `server/lib/confirm.js` and its tests.
- **Rate-limit aware fan-out.** Per-product and per-query scoring runs through `batchMap` (bounded concurrency) instead of an unbounded `Promise.all`.
- **Prompt caching** on the large, stable system prompts used by the reasoning/rerank calls.
- **Secrets stay server-side.** The browser never sees API keys; OAuth tokens are stored in a gitignored file.
- **No framework on the server.** Plain `node:http` keeps the request/stream handling explicit and the dependency surface tiny.

## Getting started

Prerequisites: Node 20+, an Anthropic API key, a Shopify development store with a custom app (Admin API token), and optionally a Google OAuth client for Drive.

```bash
npm install
cp .env.example .env     # fill in your own keys — never commit .env
npm run api              # API on http://127.0.0.1:8787
npm run dev              # app on http://127.0.0.1:5173 (proxies /api)
```

Other scripts: `npm test` (unit tests), `npm run lint`, `npm run build`.

## Project layout

```
src/                 React app (dashboard shell, Sidekick panel, audit cards)
server/index.js      HTTP routes, OAuth, Drive + Shopify integrations, agent loops
server/lib/          Pure, unit-tested helpers (confirmation gate, batching, JSON parsing)
test/                node:test suites
docs/                Original design notes (agentic audit plan, product-launch plan)
```

## Known limitations

- Single-merchant, single-store demo: no multi-tenant auth, and OAuth tokens live in a local file.
- Product creation does not yet set per-variant price/inventory, metafields or media via GraphQL bulk mutations.
- `server/index.js` is a large single file; splitting routes, integrations and agents into modules is the next refactor.
- The dashboard data (orders, customers, analytics) is mocked; only products, pages, themes and collections are live.
- Confirmation holds are in-memory and reset when the server restarts.

## Credits

Originally started as a collaboration with Sai Kodakalla, who built the initial dashboard shell and the Google Drive integration. The agentic product launch, Shopify publishing, storefront audit agents, theme tools, confirmation gate and tests were added on top by Jinay Desai.
