---
title: "Templates"
order: 5
---

# Templates

KvikkPress uses Nunjucks for HTML templates. Your `templates/` directory must contain a `layout.html`.

## Template variables

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

## Cache busting

Use `fileHashes` to append content hashes to asset URLs:

```html title="layout.html"
<link href="/static/output.css?h={{ fileHashes['/static/output.css'] }}" rel="stylesheet">
<script src="/static/kvikkpress.js?h={{ fileHashes['/static/kvikkpress.js'] }}"></script>
```

URLs with `?h=<hash>` get `Cache-Control: public, max-age=31536000, immutable`. Without the hash, `Cache-Control: no-cache`. The hash changes when content changes, so browsers fetch fresh automatically.

## Sidebar rendering

The `contentTree` variable contains the full page hierarchy. Iterate recursively to build sidebar navigation:

```html title="sidebar macro"
{% macro render_node(node) %}
  {% if node.isDir %}
    <div>{{ node.title }}</div>
    {% for child in node.children %}
      {{ render_node(child) }}
    {% endfor %}
  {% else %}
    <a href="{{ node.path }}">{{ node.title }}</a>
  {% endif %}
{% endmacro %}
```
