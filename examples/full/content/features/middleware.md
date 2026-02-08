---
title: "Middleware"
order: 6
---

# Middleware

KvikkPress exposes a Hono app at `engine.app`. Add middleware and routes **before** calling `engine.mount()`.

## Auth example

```ts title="server.ts"
const engine = createKvikkPress({ ... });

// Protect HTML pages, leave markdown open for agents
engine.app.use("/*", async (c, next) => {
  if (c.req.path.endsWith(".md")) return next();
  if (c.req.path.startsWith("/static/")) return next();
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

engine.mount();  // KvikkPress routes registered after middleware
Deno.serve({ port: 3600 }, engine.app.fetch);
```

## Custom routes

Add routes alongside docs:

```ts title="custom routes"
engine.app.get("/api/search", searchHandler);
engine.app.get("/health", (c) => c.json({ ok: true }));
```

## mount() order

`engine.mount()` registers KvikkPress's catch-all route (`GET /*`). Any middleware or routes added after `mount()` won't be reached for paths that KvikkPress handles.

Pattern: create engine, add middleware, add custom routes, then `mount()`.
