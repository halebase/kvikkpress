---
title: "CSS"
order: 6
---

# CSS

When `theme.css` is configured, KvikkPress manages Tailwind:

- `build()` runs `@tailwindcss/cli --minify`
- `startDev()` runs `@tailwindcss/cli --watch`

## Setup

```css title="templates/main.css"
@import "tailwindcss";

@theme {
  --color-primary-500: oklch(0.59 0.20 260);
}
```

No separate build step needed. KvikkPress handles compilation at startup (`build()`) and file watching in dev mode (`startDev()`).

## Markdown pipeline

Default pipeline: remark-gfm, remark-frontmatter, rehype-slug, rehype-autolink-headings, rehype-pretty-code (shiki), rehype-stringify.

Extend with `remarkPlugins` and `rehypePlugins` — appended to the defaults.
