<div align="center">
  <img src="https://raw.githubusercontent.com/halebase/kvikkpress/main/assets/kvikkpress.png" width="600"/>
</div>

# KvikkPress

A documentation server. Markdown in, docs site out — with a real backend when you need one.

```
build time:   content/*.md + templates/ ──→ _build/site.ts
runtime:      site.ts ──→ fetch(Request) ──→ /page      HTML for browsers
                                          ──→ /page.md   raw markdown for agents
                                          ──→ /static/*  hashed assets
```

Runs on Deno, should run on Cloudflare Workers, or any WinterTC-compatible platform.

- **Pure markdown in/out** — HTML for browsers, raw `.md` for LLM agents. Fewer tokens, better generative results.
- **Built at deploy** — CDN-optimized with immutable-cached assets, real backend available when you need it.
- **Auth and gating** — sessions, scoped HMAC tokens for agents, protected pages.
- **Syntax-highlighted code blocks** — Shiki, server-rendered, no client JS.
- **Hackable** — it's a [Hono](https://hono.dev) app. Middleware, custom routes, whatever you need.

## Why

You want to render a folder of markdown as a docs site. Every page should also be available as clean `.md` — for agents, crawlers, LLMs. Static site generators like VitePress, Docusaurus or MkDocs get you there.

Then you need auth. Maybe session-gated pages or feature flags. You want LLM agents to access your gated docs. Now you need a server. Static generators can't do that, so you reach for Next.js or any other, and suddenly you're deep in a complex, slow framework that doesn't allow the gated security efficiently.

All you wanted was getting pure markdown with a session check live.

KvikkPress stays in the simple lane. A folder of markdown files, a `fetch` handler, and whatever backend logic you wire up yourself.

## Quick start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/). Create a project and start the dev server:

```sh
deno run -A --reload=https://raw.githubusercontent.com/halebase/kvikkpress https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts my-docs
cd my-docs
deno task dev
```

Open `http://localhost:3000`. Edit `content/index.md`, refresh.

## How it works

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

Content is rendered at build time — GFM tables, syntax-highlighted code blocks (Shiki), auto-linked headings, table of contents. No client-side JS for markup. The runtime serves pre-rendered HTML from memory.

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

### Middleware and custom routes

`engine.app` is a standard [Hono](https://hono.dev) app. Add middleware, auth, custom routes — anything Hono supports — before calling `engine.mount()`:

```ts
import { dev } from "@halebase/kvikkpress/dev";

const engine = await dev({
  content: "./content",
  site: { title: "My Docs" },
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
});

// Add middleware before mount() — auth, logging, custom routes, etc.
engine.app.use("/*", async (c, next) => {
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

engine.app.get("/api/search", searchHandler);

engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

### LLM session tokens

Gate `.md` endpoints with compact stateless HMAC-signed tokens. Authenticated browser users generate compact URL tokens (`?llm=...`) that LLM agents append to every request.

```ts
// 1. Create an HMAC key from a base64 secret (store in .env as HMAC_SIGNING_KEY)
const hmacKey = await crypto.subtle.importKey(
  "raw",
  Uint8Array.from(atob(Deno.env.get("HMAC_SIGNING_KEY")!), (c) => c.charCodeAt(0)),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

// 2. Pass it in the `llm` field of dev() or createKvikkPress()
const engine = await dev({
  ...config,
  llm: {
    hmacKey,
    groups: [[{ prefix: "/" }]],              // protect all routes
    isAuthenticated: (c) => checkSession(c),  // browser session check
    expiresInHours: 8,                        // token lifetime (default: 8)
  },
});
```

Request flow for protected `.md` routes:

1. `isAuthenticated(c)` — if true, serve immediately (browser session)
2. `?llm=` query param or `llm_s` cookie — verify HMAC signature and expiry
3. Neither — return 401 markdown with usage instructions

The "Copy for LLM" button in the UI calls `POST /api/llm-token` to generate a token for the current user's session. The `.md` responses themselves include navigation links and token instructions, so an LLM agent can traverse the site without additional guidance.

Tokens encode permissions as positional bit flags — each group and entry maps to its array index. Don't reorder or remove entries from `groups` while unexpired tokens exist, or those tokens will grant access to the wrong routes. Append new entries instead.

### Build and deploy

`build` pre-renders all content to a single `site.ts` module. In production, import it and serve:

```ts
// build.ts
import { build } from "@halebase/kvikkpress/build";

await build({
  content: "./content",
  templates: "./templates",
  static: "./static",
  css: { input: "./templates/main.css", output: "./_build/output.css", tailwindConfig: "./tailwind.config.js" },
  outDir: "./_build",
});
```

```ts
// server.ts (production)
import { createKvikkPress } from "@halebase/kvikkpress";
import * as site from "./_build/site.ts";

const engine = createKvikkPress({ site: { title: "My Docs" }, ...site });
engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

Not ideal yet, can be improved later. Works well for now.

### CSS

When `css` is configured, KvikkPress manages Tailwind. `build()` runs `--minify`, `dev()` runs `--watch`.

### Template data

`layout.html` receives: `title`, `content`, `toc`, `currentPath`, `meta`, `siteTitle`, `contentTree`, `fileHashes`, `year`, `version`, and your `templateGlobals`.

## API reference

### `dev(config)` / `build(config)`

| Field | Type | Description |
|---|---|---|
| `content` | `string` | Path to content directory |
| `templates` | `string` | Path to templates directory (must contain `layout.html`) |
| `static` | `string` | Path to static assets directory, served at `/static/*` |
| `site` | `{ title, description? }` | Site metadata |
| `css` | `{ input, output, tailwindConfig }` | Optional. Tailwind CSS paths |
| `markdown` | `{ remarkPlugins?, rehypePlugins?, shiki? }` | Optional. Markdown pipeline config |
| `hashFiles` | `string[]` | Optional. Files to hash for cache busting. Default: `["output.css", "main.js"]` |
| `templateGlobals` | `Record<string, unknown>` | Optional. Extra variables for every template render |
| `version` | `string` | Optional. Shown in templates. Default: `"dev"` |
| `llm` | [`LlmConfig`](#llmconfig) | Optional. LLM session token config |
| `outDir` | `string` | Build output directory (`build()` only) |

### `createKvikkPress(config)`

| Field | Type | Description |
|---|---|---|
| `site` | `{ title, description? }` | Site metadata |
| `contentIndex` | `ContentNode[]` | From build output |
| `pages` | `Record<string, CachedPage>` | From build output |
| `markdown` | `Record<string, string>` | From build output |
| `templates` | `Record<string, string>` | From build output |
| `fileHashes` | `Record<string, string>` | From build output |
| `templateGlobals` | `Record<string, unknown>` | Optional. Extra variables for every template render |
| `version` | `string` | Optional. Shown in templates. Default: `"dev"` |
| `llm` | [`LlmConfig`](#llmconfig) | Optional. LLM session token config |

Typically you spread the build output: `createKvikkPress({ site: { title }, ...site })`.

### `LlmConfig`

Passed as `llm` in `dev()`, `build()`, and `createKvikkPress()`.

| Field | Type | Description |
|---|---|---|
| `hmacKey` | `CryptoKey` | HMAC-SHA256 key for signing and verifying tokens |
| `groups` | `{ prefix: string }[][]` | Permission groups. Each group is an array of route prefixes. Max 8 groups, 24 entries each. Position-sensitive — don't reorder after issuing tokens |
| `expiresInHours` | `number` | Optional. Token lifetime in hours. Default: `8` |
| `isAuthenticated` | `(c: Context) => boolean \| Promise<boolean>` | Optional. Primary auth check (e.g. browser session). If true, serves without requiring LLM token |

### `KvikkPress`

Returned by `dev()` and `createKvikkPress()`.

| Member | Type | Description |
|---|---|---|
| `app` | `Hono` | The Hono app. Add middleware and routes before `mount()` |
| `mount()` | `() => void` | Register KvikkPress routes. Call after adding your middleware |
| `render(template, data)` | `(string, Record) => string` | Render a template with data |
| `contentIndex` | `ContentNode[]` | The current content tree |
| `fetch` | `(Request) => Response` | Shorthand for `app.fetch` — pass to `Deno.serve()` |

---

*Named after eating one too many Kvikk Lunsjes while XC-skiing in Norway.*

Generated with some LLM assistance.
