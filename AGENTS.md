# KvikkPress Library

## Architecture

### Package Layout

```
kvikkpress/
├── mod.ts                  # Public API: createKvikkPress, types
├── build.ts                # Build entry: re-exports from src/build/
├── dev.ts                  # Dev entry: re-exports from src/dev/
├── deno.json               # @halebase/kvikkpress — exports ".", "./build", "./dev"
├── src/                    # Library source
│   ├── engine.ts           # Engine factory: createKvikkPress(), createEngine()
│   ├── content/            # Content pipeline
│   │   ├── discovery.ts    # Walk content dir, build ContentNode tree
│   │   ├── render.ts       # Markdown → HTML (remark + rehype + shiki)
│   │   ├── cache.ts        # ContentCache: in-memory page store with rebuild/update
│   │   └── types.ts        # ContentNode, CachedPage, PageMeta, TocItem
│   ├── serve/              # HTTP layer
│   │   ├── routes.ts       # Dual-serve routes: /page (HTML) + /page.md (raw markdown)
│   │   ├── templates.ts    # Nunjucks: filesystem env (dev) and bundled env (prod)
│   │   └── assets.ts       # Static file serving + file hash cache-busting
│   ├── build/              # Build pipeline
│   │   ├── mod.ts          # build(): CSS + content + templates → _build/site.ts
│   │   └── output.ts       # Generate site.ts module source code
│   └── dev/                # Dev mode
│       ├── mod.ts          # dev(): in-memory build + file watchers + CSS watch
│       ├── watcher.ts      # Deno.watchFs for content changes → cache rebuild
│       └── css.ts          # Tailwind CSS: buildCss() and watchCss()
├── examples/
│   ├── start/              # Minimal starter — copy this to begin a new project
│   └── full/               # Feature showcase — demonstrates every feature
├── site/                   # KvikkPress docs (dogfooding)
└── readme.md
```

### Three Entry Points

```
build()              Compile CSS + content + templates + hashes → _build/site.ts
createKvikkPress()   Runtime engine from pre-built data. No filesystem, WinterTC-compatible.
dev()                In-memory build + file watchers for content and CSS. Deno-only.
```

### Engine Lifecycle

1. `createKvikkPress(config)` or `dev(config)` → returns `KvikkPress` engine
2. Consumer adds middleware/routes to `engine.app` (standard Hono app)
3. `engine.mount()` registers KvikkPress catch-all routes
4. `Deno.serve(engine.app.fetch)` or `export default { fetch: engine.fetch }`

**mount() must be called AFTER consumer middleware.** KvikkPress routes are catch-all — anything registered after mount() will never match.

## Key Patterns

### Mutable In-Place References

`ContentCache` mutates arrays/objects in place so engine references stay valid across rebuilds:

```ts
// CORRECT — engine keeps its reference
this._contentIndex.length = 0;
this._contentIndex.push(...nodes);

// WRONG — breaks engine's reference to the old array
this._contentIndex = nodes;
```

Same applies to `pages` and `markdown` objects — use `delete` + assign, never reassign the container.

### Absolute Paths in Watchers

`Deno.watchFs` emits absolute paths. Always resolve `contentDir` to absolute before comparing:

```ts
const absoluteContentDir = Deno.realPathSync(contentDir);
```

### CSS Build Artifacts

All build artifacts go to `_build/`, including Tailwind CSS output. The dev server maps `/static/output.css` → `_build/output.css` via an explicit route. Never put generated CSS in `static/`.

### File Hashing

Static files (from `static/` dir) and CSS (from `_build/output.css`) are hashed separately:

```ts
const fileHashes = await buildFileHashes(config.static, hashFiles);  // static dir
fileHashes["/static/output.css"] = await hashFile(config.css.output); // CSS artifact
```

### Dual-Serve

Every content page is served at two URLs:
- `/page` → rendered HTML (for browsers)
- `/page.md` → raw markdown (for agents, crawlers, LLMs)

### createEngine() Is Internal

`createEngine()` is shared between `createKvikkPress()` (bundled templates) and `dev()` (filesystem templates). It is not part of the public API — consumers use `createKvikkPress()` or `dev()`.

## Development

### Dev Server via Rig

```sh
cd kvikkpress/
rig up                 # Starts all services: site, start example, full example
rig up start           # Start only the start example
```

### Examples

- **examples/start/** — minimal copy-paste starter. `server.ts` has commented-out middleware example (`src/middleware.ts`) that users uncomment to activate.
- **examples/full/** — comprehensive reference showcasing every feature (sidebar, TOC, dual-serve, templates, CSS theming, middleware).

### When Modifying Public API

The three barrel files (`mod.ts`, `build.ts`, `dev.ts`) re-export from `src/`. When adding new public types or functions:
1. Add to the relevant `src/` module
2. Re-export from the appropriate barrel file
3. Update `deno.json` exports if adding a new entry point

### Testing

Consumer code (`docs/`) imports `kvikkpress/mod.ts`, `kvikkpress/build.ts`, `kvikkpress/dev.ts`. After changes, verify:

```sh
deno check docs/src/server.ts    # Runtime consumer
deno check docs/build.ts         # Build consumer
```
