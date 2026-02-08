---
title: "Backend Logic"
order: 3
---

# Backend Logic

KvikkPress exposes a Hono app. Add middleware and routes before calling `start()`.

## Auth middleware

```ts title="server.ts"
const docs = createKvikkPress({ ... });

// Protect HTML, leave markdown open for agents
docs.app.use("/*", async (c, next) => {
  if (c.req.path.endsWith(".md")) return next();
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

// Custom routes alongside docs
docs.app.get("/api/search", searchHandler);

await docs.start();
Deno.serve({ port: 3000 }, docs.app.fetch);
```

## Dual-serve

Every page is available in two formats at different URLs:

- `/page` — rendered HTML for browsers
- `/page.md` — raw markdown for agents, LLMs, and scripts

This lets you protect HTML with auth while keeping markdown open for automated tools.
