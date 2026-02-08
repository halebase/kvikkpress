---
title: "Content"
order: 2
---

# Content

## Directory structure

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

Folders become sidebar sections. Files become pages.

## Frontmatter

```yaml title="page frontmatter"
---
title: "Page Title"
order: 1
visibility: admin, auth
---
```

- `title` — required, shown in sidebar and page header
- `order` — sort position within section
- `visibility` — comma-separated roles (optional, for filtering)

## Folder naming

Use kebab-case: `getting-started`, `api-reference`.

Folder names auto-convert to title case in the sidebar (`getting-started` → "Getting Started").

## Section metadata

A file named after its parent folder (e.g. `guides/guides.md`) acts as the section index. If it has content, it's a navigable page. If it only has frontmatter, it provides metadata (title, order) without rendering a page.
