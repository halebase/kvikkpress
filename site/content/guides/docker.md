---
title: "Docker"
order: 9
---

# Docker

## Build and deploy

`build()` pre-renders all content to a single `site.ts` module. In production, import it and serve:

```ts title="build.ts"
import { build } from "@halebase/kvikkpress/build";

await build({
  content: "./content",
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  outDir: "./_build",
});
```

```ts title="server.ts (production)"
import { createKvikkPress } from "@halebase/kvikkpress";
import * as site from "./_build/site.ts";

const engine = createKvikkPress({ site: { title: "My Docs" }, ...site });
engine.mount();
Deno.serve({ port: 3600 }, engine.app.fetch);
```

## Example Dockerfile

```dockerfile title="Dockerfile"
FROM denoland/deno:2.5.4
WORKDIR /app
COPY . .
RUN deno cache server.ts
RUN deno run -A build.ts
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "server.ts"]
```

## Build vs Runtime

| Phase | Function | When | What |
|---|---|---|---|
| Build | `build()` | Docker image build | Compile CSS + content + templates → `_build/site.ts` |
| Runtime | `createKvikkPress()` | Container startup | Sync engine from pre-built data, no filesystem |
| Dev | `dev()` | Local development | In-memory build + file watchers + CSS watch |
