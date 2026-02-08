---
title: "Welcome"
order: 1
---

# Welcome

This is a minimal KvikkPress example. Edit `content/index.md` to get started.

## Running

```sh title="terminal"
deno run --node-modules-dir --allow-net --allow-read --allow-write --allow-run --allow-env server.ts
```

Open [http://localhost:3600](http://localhost:3600).

## Adding pages

Create markdown files in `content/`. Folders become sidebar sections:

```text title="content structure"
content/
├── index.md              → /
├── guides/
│   ├── guides.md         → section metadata
│   ├── install.md        → /guides/install
│   └── first-steps.md    → /guides/first-steps
```

Each file needs frontmatter:

```yaml title="frontmatter"
---
title: "Page Title"
order: 1
---
```
