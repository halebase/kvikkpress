---
title: "KvikkPress"
order: 1
---

# KvikkPress

A documentation server. Markdown in, docs site out — with a real backend when you need one.

```text title="how it works"
build time:   content/*.md + templates/ ──→ _build/site.ts
runtime:      site.ts ──→ fetch(Request) ──→ /page      HTML for browsers
                                          ──→ /page.md   raw markdown for agents
                                          ──→ /static/*  hashed assets
```

Runs on Deno, should run on Cloudflare Workers, or any WinterTC-compatible platform.

## Why

You want to render a folder of markdown as a docs site. Every page should also be available as clean `.md` — for agents, crawlers, LLMs. Static site generators get you there.

Then you need auth. Maybe session-gated pages or feature flags. You want LLM agents to access your gated docs. Now you need a server. Static generators can't do that, so you reach for a framework and suddenly you're deep in something complex that doesn't allow the gated security efficiently.

All you wanted was getting pure markdown with a session check live.

KvikkPress stays in the simple lane. A folder of markdown files, a `fetch` handler, and whatever backend logic you wire up yourself. It's fast, stateless, and implements clean HTTP caching so your public docs play well with CDNs out of the box.

## Features

- **Pure markdown in/out** — HTML for browsers, raw `.md` for LLM agents. Fewer tokens, better generative results.
- **Built at deploy** — CDN-optimized with immutable-cached assets, real backend available when you need it.
- **Auth and gating** — sessions, scoped HMAC tokens for agents, protected pages.
- **Syntax-highlighted code blocks** — Shiki, server-rendered, no client JS.
- **Hackable** — it's a [Hono](https://hono.dev) app. Middleware, custom routes, whatever you need.
- **MCP server** — expose docs as an authenticated MCP endpoint. LLM clients search and retrieve pages via standard tool calls.
