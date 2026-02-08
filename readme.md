# KvikkPress

A simple documentation server. Markdown files in, docs site out.

A Deno server that pre-renders markdown at startup and serves from cache. No client-side framework. No build graph. Add Hono middleware for auth, sessions, or custom routes.

```
content/*.md ──→ KvikkPress (Deno) ──→ /page      HTML for browsers
                                  ──→ /page.md   raw markdown for agents
                                  ──→ /static/*  hashed assets
```

## Why

What happens when you "just" need to render markdown docs conditionally based on session? Static site generators can't do server-side auth, and every page still needs to be crawlable as clean markdown. KvikkPress needs a folder of markdown files and a Deno server.

When you need backend logic — auth, sessions, custom API routes — it's standard Hono middleware. Not a framework-specific escape hatch.

## Quick start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/).

```ts
import { createKvikkPress } from "kvikkpress";

const docs = createKvikkPress({
  content: "./content",
  site: { title: "My Docs" },
  theme: {
    templates: "./templates",
    static: "./static",
  },
});

await docs.start();
Deno.serve({ port: 3000 }, docs.app.fetch);
```

Put markdown files in `content/`, a `layout.html` template in `templates/`, done.

## How it works

All pages are pre-rendered at startup into an in-memory cache. Requests hit the cache, not the filesystem. This gives you static-site throughput with a running server behind it.

```
build()      Compile CSS. Run once at Docker build time.
start()      Pre-render content, hash assets, register routes. Run at server startup.
startDev()   build() + start() + file watchers for content and CSS.
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

KvikkPress exposes a Hono app. Add middleware and routes before calling `start()`:

```ts
const docs = createKvikkPress({ ... });

// Auth: protect HTML, leave markdown open for agents
docs.app.use("/*", async (c, next) => {
  if (c.req.path.endsWith(".md")) return next();
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

// Custom routes alongside docs
docs.app.get("/api/search", searchHandler);

await docs.start();
Deno.serve({ port: 3000 }, docs.app.fetch);
```

## Configuration

```ts
createKvikkPress({
  content: "./content",

  site: {
    title: "My Docs",
    description: "Optional",
  },

  theme: {
    templates: "./templates",     // Nunjucks templates. Must have layout.html.
    static: "./static",           // Served at /static/*
    css: {                        // Optional. Tailwind CSS build.
      input: "./templates/main.css",
      output: "./static/output.css",
      tailwindConfig: "./tailwind.config.js",
    },
    hashFiles: ["output.css", "main.js"],
  },

  markdown: {                     // All optional
    remarkPlugins: [],
    rehypePlugins: [],
    shiki: { theme: "github-dark" },
  },

  templateGlobals: { ... },       // Extra variables in every template render
  version: "1.0.0",              // Defaults to "dev"
  noTemplateCache: false,         // Set true for dev
});
```

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

When `theme.css` is configured, KvikkPress manages Tailwind:

- `build()` runs `@tailwindcss/cli --minify`
- `startDev()` runs `@tailwindcss/cli --watch`

```css
@import "tailwindcss";

@theme {
  --color-primary-500: oklch(0.59 0.23 332);
}
```

No separate build step needed.

## Docker

```dockerfile
RUN deno run ... build.ts          # CSS compilation (build time)
CMD ["deno", "run", ... "server.ts"]  # Content rendering (startup)
```

`build()` and `start()` are separate so assets compile once at image build time.

---

*Named after eating one too many Kvikk Lunsjes while XC-skiing in Norway.*
