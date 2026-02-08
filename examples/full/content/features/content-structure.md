---
title: "Content Structure"
order: 1
---

# Content Structure

Markdown files in `content/` become pages. Folders become sidebar sections.

## Directory layout

```text title="content/"
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

## How it works

- **Files** become pages at their path (minus `.md`)
- **Folders** become sidebar sections
- **Section index** (`folder-name.md` or `folder/index.md`) provides the section's title and order
- **Kebab-case** folder names auto-convert to title case in the sidebar

## Index pages

A section index file can be:

- **Metadata only** (just frontmatter, no body) — the section appears in the sidebar but isn't navigable
- **Content page** (frontmatter + body) — the section heading links to this page

This page you're reading is an example of a section index with content.
