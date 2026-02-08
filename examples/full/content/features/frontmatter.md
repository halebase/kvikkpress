---
title: "Frontmatter"
order: 2
---

# Frontmatter

Every markdown file starts with YAML frontmatter between `---` fences.

## Required fields

```yaml title="frontmatter"
---
title: "Page Title"
order: 1
---
```

| Field | Type | Description |
|---|---|---|
| `title` | string | Page title shown in sidebar and browser tab |
| `order` | number | Sort order within the section |

## Optional fields

```yaml title="with visibility"
---
title: "Admin Guide"
order: 5
visibility: admin, auth
---
```

| Field | Type | Description |
|---|---|---|
| `visibility` | string | Comma-separated roles. Controls sidebar visibility. |

The `visibility` field hides pages from the sidebar for users without the listed roles. The page is still accessible by URL — visibility filtering is a UI concern, not access control. Use middleware for auth.
