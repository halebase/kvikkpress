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

What happens when you "just" need to render markdown docs conditionally based on session? Static site generators can't do server-side auth, and every page still needs to be crawlable as clean markdown. KvikkPress needs a folder of markdown files and a fetch handler.

When you need backend logic — auth, sessions, custom API routes — it's standard Hono middleware. Not a framework-specific escape hatch.

## Quick start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/).

**1. Build** — compile content + CSS + templates into a module:

```ts title="build.ts"
import { build } from "@halebase/kvikkpress/build";

await build({
  content: "./content",
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  outDir: "./_build",
});
```

**2. Serve** — create a runtime engine from the build output:

```ts title="server.ts"
import { createKvikkPress } from "@halebase/kvikkpress";
import * as site from "./_build/site.ts";

const engine = createKvikkPress({
  site: { title: "My Docs" },
  ...site,
});

engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

**3. Dev** — live reload without a build step:

```ts title="dev.ts"
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

engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

Put markdown files in `content/`, a `layout.html` template in `templates/`, done.

## How it works

Content is compiled at build time into a TypeScript module (`_build/site.ts`). At runtime, the engine serves everything from memory — no filesystem access needed.

```
build()              Compile CSS + content + templates → _build/site.ts. Run at deploy time.
createKvikkPress()   Create runtime engine from pre-built data. Filesystem-free.
dev()                Build in-memory + file watchers for content and CSS. Dev only.
```

## Content

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

Folders become sidebar sections. Files become pages. Frontmatter controls title, order, and visibility:

```yaml
---
title: "Page Title"
order: 1
visibility: admin, auth
---
```

Kebab-case folder names auto-convert to title case in the sidebar.

## Backend logic

KvikkPress exposes a Hono app. Add middleware and routes before calling `mount()`:

```ts
const engine = createKvikkPress({ ... });

// Auth: protect HTML, leave markdown open for agents
engine.app.use("/*", async (c, next) => {
  if (c.req.path.endsWith(".md")) return next();
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

// Custom routes alongside docs
engine.app.get("/api/search", searchHandler);

engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
```

## Configuration

**Build config** (passed to `build()` and `dev()`):

```ts
{
  content: "./content",           // Markdown content directory
  templates: "./templates",       // Nunjucks templates. Must have layout.html.
  static: "./static",             // Static assets, served at /static/*
  css: {                          // Optional. Tailwind CSS build.
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  markdown: {                     // All optional
    remarkPlugins: [],
    rehypePlugins: [],
    shiki: { theme: "github-dark" },
  },
  outDir: "./_build",             // Build output directory (build() only)
}
```

**Runtime config** (passed to `createKvikkPress()`):

```ts
{
  site: { title: "My Docs", description: "Optional" },
  contentIndex,                   // From build output
  pages,                          // From build output
  markdown,                       // From build output
  templates,                      // From build output
  fileHashes,                     // From build output
  templateGlobals: { ... },       // Extra variables in every template render
  version: "1.0.0",              // Defaults to "dev"
}
```

In practice, spread the build output: `createKvikkPress({ site: {...}, ...site })`.

## Template data

`layout.html` receives:

| Variable | Type | Description |
|---|---|---|
| `title` | `string` | Page title from frontmatter |
| `content` | `string` | Rendered HTML |
| `toc` | `TocItem[]` | Table of contents (h2/h3) |
| `currentPath` | `string` | Current URL path |
| `meta` | `PageMeta` | All frontmatter data |
| `siteTitle` | `string` | From config |
| `contentTree` | `ContentNode[]` | Full hierarchy for sidebar |
| `fileHashes` | `Record<string, string>` | Cache-busting hashes |
| `year` | `number` | Current year |
| `version` | `string` | From config |
| `...templateGlobals` | | Your custom variables |

## Markdown

Default pipeline: remark-gfm, remark-frontmatter, rehype-slug, rehype-autolink-headings, rehype-pretty-code (shiki), rehype-stringify.

Extend with `remarkPlugins` and `rehypePlugins` — appended to the defaults.

## CSS

When `css` is configured, KvikkPress manages Tailwind. CSS compiles to `_build/output.css` alongside other artifacts. The dev server maps it to `/static/output.css` automatically.

- `build()` runs `@tailwindcss/cli --minify`
- `dev()` runs `@tailwindcss/cli --watch`

```css
@import "tailwindcss";

@theme {
  --color-primary-500: oklch(0.59 0.23 332);
}
```

## Docker

```dockerfile
RUN deno run ... build.ts          # Compile CSS + content + templates (build time)
CMD ["deno", "run", ... "server.ts"]  # Serve from memory (runtime)
```

`build()` compiles everything at image build time. The runtime imports `_build/site.ts` and serves from memory.

## .gitignore

Add these generated files to `.gitignore`:

```
_build/
node_modules/
```

`_build/` contains all build artifacts: `site.ts` (compiled content/templates/hashes) and `output.css` (compiled Tailwind CSS). `node_modules/` is created by Deno's `--node-modules-dir` flag.

---

*Named after eating one too many Kvikk Lunsjes while XC-skiing in Norway.*
