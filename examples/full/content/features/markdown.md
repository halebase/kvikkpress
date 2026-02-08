---
title: "Markdown"
order: 3
---

# Markdown

KvikkPress uses remark + rehype for markdown processing. GFM (GitHub Flavored Markdown) is enabled by default.

## Code blocks

Syntax highlighting via shiki. Add a `title` attribute for a filename header:

```ts title="server.ts"
import { dev } from "@halebase/kvikkpress/dev";

const engine = await dev({
  content: "./content",
  site: { title: "My Docs" },
  templates: "./templates",
  static: "./static",
});

engine.mount();
Deno.serve({ port: 3600 }, engine.app.fetch);
```

Hover over the code block to see the copy button (provided by `kvikkpress.js`).

## Tables

| Feature | Dev | Production |
|---|---|---|
| Content from | Filesystem | Build output |
| CSS | Watch mode | Minified |
| Templates | No cache | Bundled |
| Static files | `serveStatic` | Platform |

## Blockquotes

> KvikkPress needs a folder of markdown files and a fetch handler. No framework magic.

## Lists

Unordered:

- Sidebar navigation from folder structure
- Table of contents from h2/h3 headings
- Dark mode with system preference detection

Ordered:

1. Write markdown in `content/`
2. Run `build()` or `dev()`
3. Serve with any WinterTC-compatible runtime

## Pipeline

Default plugins: remark-gfm, remark-frontmatter, rehype-slug, rehype-autolink-headings, rehype-pretty-code (shiki), rehype-stringify.

Extend with `remarkPlugins` and `rehypePlugins` in your build/dev config.
