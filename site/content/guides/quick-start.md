---
title: "Quick Start"
order: 1
---

# Quick Start

KvikkPress runs on [Deno](https://docs.deno.com/runtime/).

## Setup

```ts title="server.ts"
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

```text title="lifecycle"
build()      Compile CSS. Run once at Docker build time.
start()      Pre-render content, hash assets, register routes. Run at server startup.
startDev()   build() + start() + file watchers for content and CSS.
```

## Running

```sh title="terminal"
deno run --node-modules-dir --allow-net --allow-read --allow-write --allow-run --allow-env server.ts
```
