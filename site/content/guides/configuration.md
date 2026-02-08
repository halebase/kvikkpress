---
title: "Configuration"
order: 4
---

# Configuration

```ts title="full config"
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

## Required fields

- `content` — path to markdown directory
- `site.title` — shown in templates
- `theme.templates` — must contain `layout.html`
- `theme.static` — served at `/static/*`

## Optional fields

- `theme.css` — enables Tailwind CSS build/watch
- `theme.hashFiles` — files to SHA-256 hash for cache busting (defaults to `["output.css", "main.js"]`)
- `markdown` — extend the remark/rehype pipeline
- `templateGlobals` — extra variables available in every template
- `version` — shown in templates (defaults to `"dev"`)
- `noTemplateCache` — disable nunjucks cache for dev
