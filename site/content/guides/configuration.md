---
title: "Configuration"
order: 4
---

# Configuration

## dev() / build()

```ts title="full config"
import { dev } from "@halebase/kvikkpress/dev";

const engine = await dev({
  content: "./content",                     // Path to markdown directory
  templates: "./templates",                 // Must contain layout.html
  static: "./static",                       // Served at /static/*

  site: {
    title: "My Docs",
    description: "Optional",
  },

  css: {                                    // Optional. Tailwind CSS.
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },

  markdown: {                               // Optional
    remarkPlugins: [],
    rehypePlugins: [],
    shiki: { theme: "github-dark" },
  },

  hashFiles: ["output.css", "kvikkpress.js"],     // Files to hash for cache busting
  templateGlobals: { ... },                 // Extra variables in every template render
  version: "1.0.0",                         // Defaults to "dev"
  llm: { ... },                             // LLM session token config
  mcp: { ... },                             // MCP server config
});
```

`build()` takes the same fields plus `outDir` for the build output directory.

## Required fields

| Field | Type | Description |
|---|---|---|
| `content` | `string` | Path to content directory |
| `templates` | `string` | Path to templates directory (must contain `layout.html`) |
| `static` | `string` | Path to static assets directory, served at `/static/*` |
| `site` | `{ title, description? }` | Site metadata |

## Optional fields

| Field | Type | Description |
|---|---|---|
| `css` | `{ input, output, tailwindConfig }` | Tailwind CSS paths |
| `markdown` | `{ remarkPlugins?, rehypePlugins?, shiki? }` | Markdown pipeline config |
| `hashFiles` | `string[]` | Files to hash for cache busting. Default: `["output.css", "kvikkpress.js"]` |
| `templateGlobals` | `Record<string, unknown>` | Extra variables for every template render |
| `version` | `string` | Shown in templates. Default: `"dev"` |
| `llm` | `LlmConfig` | LLM session token config (see [LLM Tokens](/guides/llm-tokens)) |
| `mcp` | `McpConfig` | MCP server config (see [MCP Server](/guides/mcp)) |

## createKvikkPress()

Production runtime. Takes pre-built data instead of filesystem paths:

```ts title="server.ts (production)"
import { createKvikkPress } from "@halebase/kvikkpress";
import * as site from "./_build/site.ts";

const engine = createKvikkPress({ site: { title: "My Docs" }, ...site });
engine.mount();
Deno.serve({ port: 3600 }, engine.app.fetch);
```

Typically you spread the build output: `createKvikkPress({ site: { title }, ...site })`.
