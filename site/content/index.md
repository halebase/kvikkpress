---
title: "KvikkPress"
order: 1
---

# KvikkPress

A simple documentation server. Markdown files in, docs site out.

A Deno server that pre-renders markdown at startup and serves from cache. No client-side framework. No build graph. Add Hono middleware for auth, sessions, or custom routes.

```text title="how it works"
content/*.md ──→ KvikkPress (Deno) ──→ /page      HTML for browsers
                                   ──→ /page.md   raw markdown for agents
                                   ──→ /static/*  hashed assets
```

## Why

What happens when you "just" need to render markdown docs conditionally based on session? Static site generators can't do server-side auth, and every page still needs to be crawlable as clean markdown. KvikkPress needs a folder of markdown files and a Deno server.

When you need backend logic — auth, sessions, custom API routes — it's standard Hono middleware. Not a framework-specific escape hatch.
