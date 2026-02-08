---
title: "Quick Start"
order: 1
---

# Quick Start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/). Create a project and start the dev server:

```sh title="terminal"
deno run -A --reload=https://raw.githubusercontent.com/halebase/kvikkpress https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts my-docs
cd my-docs
deno task dev
```

Open `http://localhost:3600`. Edit `content/index.md`, refresh.

## How it works

Every `.md` file in `content/` becomes two URLs:

- `/page` — rendered HTML for browsers
- `/page.md` — raw markdown for agents, with navigation links for traversal

Content is rendered at build time — GFM tables, syntax-highlighted code blocks (Shiki), auto-linked headings, table of contents. No client-side JS for markup. The runtime serves pre-rendered HTML from memory.

## Three entry points

```text title="entry points"
dev(config)              Async. In-memory build + file watchers + CSS watch. Deno-only.
build(config)            Compile CSS + content + templates + hashes → _build/site.ts
createKvikkPress(config) Sync. Runtime engine from pre-built data. No filesystem, WinterTC-compatible.
```

`dev()` is for local development. `build()` + `createKvikkPress()` is for production.

## Dev server

```ts title="server.ts"
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
Deno.serve({ port: 3600 }, engine.app.fetch);
```

`engine.app` is a standard [Hono](https://hono.dev) app. Add middleware, auth, custom routes — anything Hono supports — before calling `engine.mount()`.
