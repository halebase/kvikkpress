---
title: "Templates"
order: 4
---

# Templates

KvikkPress uses Nunjucks for HTML templates. The main template is `layout.html`.

## Template variables

`layout.html` receives these variables on every render:

| Variable | Type | Description |
|---|---|---|
| `title` | `string` | Page title from frontmatter |
| `content` | `string` | Rendered HTML (use `{{ content \| safe }}`) |
| `toc` | `TocItem[]` | Table of contents entries (h2/h3 headings) |
| `currentPath` | `string` | Current URL path (e.g. `/features/templates`) |
| `meta` | `PageMeta` | All frontmatter data |
| `siteTitle` | `string` | From config `site.title` |
| `contentTree` | `ContentNode[]` | Full content hierarchy for sidebar |
| `fileHashes` | `Record<string, string>` | Cache-busting hashes |
| `year` | `number` | Current year |
| `version` | `string` | From config (defaults to `"dev"`) |
| `...templateGlobals` | | Your custom variables |

## Template globals

Pass extra variables to every template render via `templateGlobals`:

```ts title="server.ts"
const engine = await dev({
  // ...
  templateGlobals: {
    gitRemote: {
      remoteUrl: "https://github.com/your-org/your-docs",
      branch: "main",
    },
  },
});
```

Access them directly in templates: `{{ gitRemote.remoteUrl }}`.

## engine.render()

Render any template programmatically (useful for custom routes):

```ts title="custom route"
engine.app.get("/waiting-room", (c) => {
  const html = engine.render("waiting-room.html", {
    siteTitle: "My Docs",
  });
  return c.html(html);
});
```
