<div align="center">
  <img src="https://raw.githubusercontent.com/halebase/kvikkpress/main/assets/kvikkpress.png" width="600"/>
</div>

# KvikkPress

A simple documentation server. Markdown files in, docs site out.

Build-first: compiles markdown, templates, and assets into a single module at deploy time. Runtime serves from memory — no filesystem access, works on Deno, Cloudflare Workers, or any WinterTC-compatible platform.

```
build time:   content/*.md + templates/ ──→ _build/site.ts
runtime:      site.ts ──→ fetch(Request) ──→ /page      HTML for browsers
                                          ──→ /page.md   raw markdown for agents
                                          ──→ /static/*  hashed assets
```

## Why

You "just" want to render a folder of markdown as a docs site. Every page should also be available as clean `.md` — for agents, crawlers, LLMs. Static site generators get you there.

Then you need auth. Maybe session-gated pages, maybe scoped tokens for LLM agents. Now you need a server. Static generators can't do that, so you reach for Next.js or Astro with SSR, and suddenly you're deep in a framework — layouts, routing conventions, build plugins, hydration, the works. All you wanted was markdown with a session check.

KvikkPress stays in the simple lane. A folder of markdown files, a `fetch` handler, and whatever backend logic you wire up yourself. Auth, sessions, custom API routes — it's standard Hono middleware, not a framework-specific escape hatch.

## Quick start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/). Create a project and start the dev server:

```sh
deno run -A --reload https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts my-docs
cd my-docs
deno task dev
```

Open `http://localhost:3000`. Edit `content/index.md`, refresh.

## What it does

Every `.md` file in `content/` becomes two URLs:

- `/page` — rendered HTML for browsers
- `/page.md` — raw markdown for agents, with site navigation links for traversal

Folders become sidebar sections. Frontmatter controls title and order:

```yaml
---
title: "Page Title"
order: 1
---
```

Markdown is rendered to HTML at build time — GFM tables, syntax-highlighted code blocks (Shiki), auto-linked headings, table of contents. No client-side JS needed for markup. The runtime serves pre-rendered HTML from memory.

`engine.app` is a standard [Hono](https://hono.dev) app — add middleware, auth, custom routes before calling `engine.mount()`.

## Reference

### Content structure

```
content/
├── index.md                    → /
├── getting-started/
│   ├── getting-started.md      → section metadata (title, order)
│   ├── install.md              → /getting-started/install
│   └── first-steps.md          → /getting-started/first-steps
└── api/
    ├── api.md                  → section metadata
    └── endpoints.md            → /api/endpoints
```

### Backend logic

```ts
const engine = createKvikkPress({ ... });

engine.app.use("/*", async (c, next) => {
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

engine.app.get("/api/search", searchHandler);

engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

### LLM session tokens

Gate `.md` endpoints with stateless HMAC-signed tokens. Authenticated users generate compact URL tokens (`?llm=...`) for LLM agents.

```ts
const hmacKey = await crypto.subtle.importKey(
  "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
);

const engine = createKvikkPress({
  ...site,
  llm: {
    hmacKey,
    groups: [[{ prefix: "/" }]],
    isAuthenticated: (c) => checkSession(c),
  },
});
```

When configured: protected `.md` routes check `isAuthenticated` first, then `?llm=` token, then `llm_s` cookie fallback, then 401. `POST /api/llm-token` generates tokens.

### Build & deploy

```ts title="build.ts"
import { build } from "@halebase/kvikkpress/build";

await build({
  content: "./content",
  templates: "./templates",
  static: "./static",
  css: { input: "./templates/main.css", output: "./_build/output.css", tailwindConfig: "./tailwind.config.js" },
  outDir: "./_build",
});
```

```ts title="server.ts"
import { createKvikkPress } from "@halebase/kvikkpress";
import * as site from "./_build/site.ts";

const engine = createKvikkPress({ site: { title: "My Docs" }, ...site });
engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

### Configuration

**Build config** — `build()` and `dev()`:

| Option | Description |
|---|---|
| `content` | Markdown content directory |
| `templates` | Nunjucks templates (must have `layout.html`) |
| `static` | Static assets, served at `/static/*` |
| `css` | Optional. Tailwind CSS: `input`, `output`, `tailwindConfig` |
| `markdown` | Optional. `remarkPlugins`, `rehypePlugins`, `shiki` theme |
| `outDir` | Build output directory (`build()` only) |

**Runtime config** — `createKvikkPress()`:

| Option | Description |
|---|---|
| `site` | `{ title, description? }` |
| `contentIndex`, `pages`, `markdown`, `templates`, `fileHashes` | From build output (spread `...site`) |
| `templateGlobals` | Extra variables for every template render |
| `version` | Shown in templates. Defaults to `"dev"` |
| `llm` | Optional. `{ hmacKey, groups, isAuthenticated? }` |

### Template data

`layout.html` receives: `title`, `content`, `toc`, `currentPath`, `meta`, `siteTitle`, `contentTree`, `fileHashes`, `year`, `version`, and your `templateGlobals`.

### CSS

When `css` is configured, KvikkPress manages Tailwind. `build()` runs `--minify`, `dev()` runs `--watch`.

### .gitignore

```
_build/
node_modules/
```

## TODO

- **Islands for dynamic code blocks** — a lightweight islands-like architecture to allow server-side rendering of user-specific code blocks in markdown output. Think personalized install commands, session-scoped API keys, or per-user examples — generated server-side per request, injected into the otherwise static page.

---

*Named after eating one too many Kvikk Lunsjes while XC-skiing in Norway.*

These are docs — don't take them too seriously.

Generated with some LLM assistance.
