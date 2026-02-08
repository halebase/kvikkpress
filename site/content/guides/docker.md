---
title: "Docker"
order: 7
---

# Docker

```dockerfile title="Dockerfile"
RUN deno run ... build.ts          # CSS compilation (build time)
CMD ["deno", "run", ... "server.ts"]  # Content rendering (startup)
```

`build()` and `start()` are separate so assets compile once at image build time.

## Example Dockerfile

```dockerfile title="Dockerfile"
FROM denoland/deno:2.5.4
WORKDIR /app
COPY . .
RUN deno cache --node-modules-dir server.ts
RUN deno run --node-modules-dir --allow-read --allow-write --allow-run --allow-env build.ts
CMD ["deno", "run", "--node-modules-dir", "--allow-net", "--allow-read", "--allow-env", "server.ts"]
```

## Build vs Start

| Phase | Method | When | What |
|---|---|---|---|
| Build | `engine.build()` | Docker image build | Compile CSS |
| Start | `engine.start()` | Container startup | Pre-render content, hash assets, register routes |
| Dev | `engine.startDev()` | Local dev | Both + file watchers |
