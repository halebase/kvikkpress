---
title: "Dual Serve"
order: 5
---

# Dual Serve

Every page is available in two formats:

- `/page` — rendered HTML for browsers
- `/page.md` — raw markdown for agents and CLI tools

## Try it

Click the **"View for LLM"** button in the breadcrumb bar above, or append `.md` to any page URL.

## Why

Bots, AI agents, and CLI tools prefer raw markdown over HTML. Dual-serve means the same URL structure works for both audiences without a separate API.

The `.md` endpoint returns the original frontmatter + markdown content with `Content-Type: text/markdown`.
