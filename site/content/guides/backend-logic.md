---
title: "Backend Logic"
order: 3
---

# Backend Logic

`engine.app` is a standard [Hono](https://hono.dev) app. Add middleware and routes before calling `engine.mount()`.

## Auth middleware

```ts title="server.ts"
import { dev } from "@halebase/kvikkpress/dev";

const engine = await dev({ ... });

// Protect HTML, leave markdown open for agents
engine.app.use("/*", async (c, next) => {
  if (c.req.path.endsWith(".md")) return next();
  if (!isAuthenticated(c)) return c.redirect("/login");
  return next();
});

// Custom routes alongside docs
engine.app.get("/api/search", searchHandler);

engine.mount();
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

Pattern: create engine → add middleware → add custom routes → `mount()`.
