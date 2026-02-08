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
│   ├── llm-tokens.ts       # Stateless HMAC-SHA256 LLM session tokens
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
createKvikkPress()   Sync. Runtime engine from pre-built data. No filesystem, WinterTC-compatible.
dev()                Async (CSS build + content compilation). In-memory build + file watchers. Deno-only.
```

### Engine Lifecycle

1. `createKvikkPress(config)` (sync) or `await dev(config)` (async) → returns `KvikkPress` engine
2. Consumer adds middleware/routes to `engine.app` (standard Hono app)
3. `engine.mount()` registers KvikkPress catch-all routes (including LLM token endpoint if configured)
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

### LLM Session Tokens

When `llm` config is provided, KvikkPress gates `.md` endpoints with stateless HMAC-signed tokens:

1. `LlmConfig` (consumer-facing): `hmacKey` (CryptoKey — consumer imports it), `groups` (route prefix permissions), `isAuthenticated` callback
2. `initLlmRuntime()` validates config, stores CryptoKey → `LlmTokenRuntime` (internal, fully sync)
3. `.md` request flow: `isAuthenticated` callback → `?llm=` param → `llm_s` cookie → 401 markdown
4. `POST /api/llm-token` generates tokens (gated by `isAuthenticated`)

Token format: 8-byte payload + 10-byte HMAC-80 = 18 bytes → 24 chars base64url. Permission model: 8 groups × 24 entries = 192 route prefixes in 4 bytes.

All LLM plumbing lives in `src/llm-tokens.ts`. Routes integration is in `src/serve/routes.ts`. The consumer only passes config — KvikkPress handles auth, token generation, cookie fallback, and 401 responses internally.

### Dual-Serve

Every content page is served at two URLs:
- `/page` → rendered HTML (for browsers)
- `/page.md` → raw markdown (for agents, crawlers, LLMs)

`.md` responses include a `## Pages` navigation section at the bottom — the full content tree rendered as markdown links (e.g., `[Page Title](/path.md)`). This allows LLMs to discover and traverse the site without needing the HTML sidebar. Navigation is appended before the LLM footer (if token access).

### HTTP Caching

Clean HTTP caching based on content hashes. No dev vs prod distinction — the hash mechanism handles cache busting naturally.

**Static assets** (dev only — production serves static files externally):
- URLs with `?h=<hash>` → `Cache-Control: public, max-age=31536000, immutable`
- URLs without hash → `Cache-Control: no-cache`
- Templates reference assets as `/static/main.js?h={{ fileHashes['/static/main.js'] }}` — hash changes when content changes, URL changes, browser fetches fresh.

**HTML pages** → `Cache-Control: public, no-cache` + `ETag` (FNV-1a hash of rendered output). CDNs cache and revalidate. 304 when content unchanged.

**`.md` pages** → `Cache-Control: public, no-cache` + `ETag` for open routes. `private, no-cache` + `ETag` for protected routes (session or token auth). Token-authenticated responses include a personalized footer, so `private` prevents CDN caching of per-user content.

ETag computed via sync FNV-1a hash (`computeEtag()` in `routes.ts`) from the full response body. Fast enough for per-request computation — no precomputation needed.

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
