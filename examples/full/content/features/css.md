---
title: "CSS"
order: 7
---

# CSS

KvikkPress manages Tailwind CSS compilation when `css` is configured.

## Setup

```ts title="build.ts"
await build({
  // ...
  css: {
    input: "./templates/main.css",       // Source CSS with @import "tailwindcss"
    output: "./_build/output.css",       // Compiled output (build artifact)
    tailwindConfig: "./tailwind.config.js",
  },
});
```

## Build vs dev

- `build()` runs `@tailwindcss/cli --minify` (one-shot, production)
- `dev()` runs `@tailwindcss/cli --watch` (incremental, dev)

The compiled CSS goes to `_build/output.css`. In dev mode, KvikkPress maps `/static/output.css` to serve it from there.

## Theme colors

Define a primary color scale in `main.css` using oklch:

```css title="templates/main.css"
@import "tailwindcss";

@theme {
  --color-primary-500: oklch(0.59 0.18 65);
}
```

The template uses `text-primary-600`, `bg-primary-50`, etc. for active states and accent colors. Change the hue to rebrand.

## Tailwind config

```js title="tailwind.config.js"
export default {
  content: [
    "./templates/**/*.html",
    "./content/**/*.md",
    "./static/**/*.js",
  ],
};
```

Point `content` at the directories Tailwind needs to scan for class names.
