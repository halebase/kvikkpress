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
│   ├── mcp/                # MCP (Model Context Protocol) server
│   │   ├── types.ts        # McpConfig, McpAuth interfaces
│   │   ├── handler.ts      # JSON-RPC dispatch: initialize, tools/list, tools/call
│   │   └── routes.ts       # Hono route registration: POST /mcp + optional GET /mcp info page
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

### Watcher: Content Index Must Rebuild on Modify

On macOS, `Deno.watchFs` debounces create+modify into just modify events. The watcher's modify path must call `cache.rebuildIndex()` after updating pages — otherwise the sidebar (which derives from `contentIndex`) won't reflect new/renamed pages. The `rebuildIndex()` method exists separately from `rebuild()` so modify events can update the index without recompiling all pages.

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

1. `LlmConfig` (consumer-facing): `hmacKey` (CryptoKey — consumer imports it), `groups` (route prefix permissions), `isAuthenticated` callback, `expiresInHours` (default: 8)
2. `initLlmRuntime()` validates config, stores CryptoKey → `LlmTokenRuntime` (internal, fully sync)
3. `.md` request flow: `isAuthenticated` callback → `?llm=` param → `llm_s` cookie → 401 markdown
4. `POST /api/llm-copy` — session-aware endpoint that returns `{ text }` with ready-to-paste clipboard content. If authenticated: generates a signed token. If not authenticated: returns `llm=public`. The server constructs the full text (title, curl command, instructions) — the client JS just POSTs and copies. **No client-side text construction.**

Token format: 8-byte payload + 10-byte HMAC-80 = 18 bytes → 24 chars base64url. Permission model: 8 groups × 24 entries = 192 route prefixes in 4 bytes.

All LLM plumbing lives in `src/llm-tokens.ts`. Routes integration is in `src/serve/routes.ts`. The consumer only passes config — KvikkPress handles auth, token generation, cookie fallback, and 401 responses internally.

### Public Nav Filtering

When `.md` is served on a public (non-protected) route, the `## Pages` navigation section is filtered to only include public pages — pages not covered by any `llm.groups` prefix. This prevents public LLM agents from seeing links to protected pages they can't access. Authenticated requests (session or valid token) get the full unfiltered navigation.

### MCP Server

When `mcp` config is provided, KvikkPress exposes a JSON-RPC 2.0 endpoint at `POST /mcp` implementing the MCP Streamable HTTP transport. No MCP SDK — hand-rolled ~150 lines to avoid Node.js dependencies (WinterTC compatibility). No inverted index — case-insensitive regex over the existing in-memory `markdown` map is fast enough for doc sites.

**Architecture:**
- `src/mcp/types.ts` — `McpConfig` and `McpAuth` interfaces. All fields are **required** (no optional fields, no defaults)
- `src/mcp/handler.ts` — Stateless JSON-RPC dispatch: `initialize`, `notifications/initialized`, `tools/list`, `tools/call`
- `src/mcp/routes.ts` — Hono route registration + optional info page at `GET /mcp`

**Two-level auth pattern:**
1. `authenticate(authorization, c)` — called **once per request**. Validates the Bearer token. Returns `McpAuth | null`
2. `McpAuth.canAccess(path)` — called **per page** during search to filter results by visibility

This separation exists because one MCP search request scans multiple pages. The authenticate hook resolves the session, the returned `canAccess` closure captures session context and filters which pages appear in results.

**Config design principles:**
- `name` = display name for MCP clients (e.g. "My Project Docs"). `id` = tool name identifier, auto-normalized to snake_case → `query_docs_{id}`. Separate fields to avoid `query_docs_my_project_docs` when users name their project "My Project Docs"
- `infoPage: boolean | string` — required, not optional. `true` = HTML info page at GET /mcp with client configs. String = same page + extra HTML. `false` = disabled
- Parameter naming: use `authorization` not `token` — makes it obvious this is the Authorization header value

**Search:** splits query into words, AND logic (all words must match), case-insensitive regex, returns top 5 hits as concatenated markdown with titles.

**Route registration order:** MCP routes register inside `mount()` BEFORE `registerRoutes()` (the catch-all). This is handled internally.

### Dual-Serve

Every content page is served at two URLs:
- `/page` → rendered HTML (for browsers)
- `/page.md` → raw markdown (for agents, crawlers, LLMs)

`.md` responses include a `## Pages` navigation section at the bottom — the content tree rendered as markdown links (e.g., `[Page Title](/path.md)`). This allows LLMs to discover and traverse the site without needing the HTML sidebar. Navigation is appended before the LLM footer (if token access). For public routes, the nav is filtered to only show public pages (see "Public Nav Filtering").

### HTTP Caching

Clean HTTP caching based on content hashes. No dev vs prod distinction — the hash mechanism handles cache busting naturally.

**Static assets** (dev only — production serves static files externally):
- URLs with `?h=<hash>` → `Cache-Control: public, max-age=31536000, immutable`
- URLs without hash → `Cache-Control: no-cache`
- Templates reference assets as `/static/kvikkpress.js?h={{ fileHashes['/static/kvikkpress.js'] }}` — hash changes when content changes, URL changes, browser fetches fresh.

**HTML pages** → `Cache-Control: public, no-cache` + `ETag` (FNV-1a hash of rendered output). CDNs cache and revalidate. 304 when content unchanged.

**`.md` pages** → `Cache-Control: public, no-cache` + `ETag` for open routes. `private, no-cache` + `ETag` for protected routes (session or token auth). Token-authenticated responses include a personalized footer, so `private` prevents CDN caching of per-user content.

ETag computed via sync FNV-1a hash (`computeEtag()` in `routes.ts`) from the full response body. Fast enough for per-request computation — no precomputation needed.

### Templates & Client-Side JS

See `templates/README.md` for the DOM contract, `kvikkpress.js` integration guide, Copy-for-LLM UI pattern, and template structure requirements.

The clipboard text for Copy-for-LLM is constructed server-side in `routes.ts` via `POST /api/llm-copy`. No client-side text construction.

### Dev Ports

Default ports in the 3600 range to avoid conflicts:
- **3600** — `examples/start/`, `init.ts` scaffold, README examples
- **3601** — `site/` (KvikkPress docs dogfooding)
- **3602** — `examples/full/`

### createEngine() Is Internal

`createEngine()` is shared between `createKvikkPress()` (bundled templates) and `dev()` (filesystem templates). It is not part of the public API — consumers use `createKvikkPress()` or `dev()`.

## Development

### Dev Server via Rig

```sh
cd kvikkpress/
rig up                 # Starts all services: site, start example, full example
rig up start           # Start only the start example
```

### Examples and Workspace

Examples are Deno workspace members (configured in root `deno.json` `"workspace"`). They import the package via jsr import maps with caret semver:

```json
{
  "imports": {
    "@halebase/kvikkpress/dev": "jsr:@halebase/kvikkpress@^0.1.3/dev",
    "@halebase/kvikkpress/build": "jsr:@halebase/kvikkpress@^0.1.3/build"
  }
}
```

**Workspace linking**: The root `deno.json` version must satisfy the caret range in examples' import maps (e.g., `0.1.99` satisfies `^0.1.3`). This makes the workspace resolve imports to local code during development. If the version doesn't match, Deno downloads from jsr instead of linking locally.

**`"lock": false`**: Examples have `"lock": false` in their own `deno.json` for standalone use (prevents lockfile pinning old versions). This produces a harmless warning during workspace development (`"lock" field can only be specified in the workspace root`). The root also has `"lock": false`.

**jsr import maps**: The trailing-slash pattern (`"@scope/pkg/": "jsr:@scope/pkg@version/"`) does NOT work for `jsr:` specifiers — Deno can't URL-parse them. Always use explicit entries per subpath export.

**Caret semver**: `^0.1.x` auto-resolves minor bumps within `>=0.1.x <0.2.0`. No need for CI to update example versions after each release.

- **examples/start/** — minimal copy-paste starter. `server.ts` has commented-out middleware example (`src/middleware.ts`) and MCP config that users uncomment to activate.
- **examples/full/** — comprehensive reference showcasing every feature including commented-out LLM gated content and MCP config.

### Init Script

`init.ts` fetches all files from `examples/start/` on GitHub and writes them to a target directory. **It must be a pure copy — no transformations, no logic beyond fetch-and-write.** Any config differences between examples (workspace members) and standalone projects must be handled by keeping examples valid for both contexts.

Run with `--reload=https://raw.githubusercontent.com/halebase/kvikkpress` to bust Deno's module cache.

### Publishing

The publish workflow (`.github/workflows/publish.yml`) injects the version from the git tag into `deno.json` before publishing to jsr. The sed pattern matches any version string, not a specific placeholder. No post-publish steps needed — caret semver in examples handles version resolution.

### When Modifying Public API

The three barrel files (`mod.ts`, `build.ts`, `dev.ts`) re-export from `src/`. When adding new public types or functions:
1. Add to the relevant `src/` module
2. Re-export from the appropriate barrel file
3. Update `deno.json` exports if adding a new entry point

### Testing

```sh
deno test src/                              # Unit tests
deno check examples/start/server.ts         # Workspace start example
deno check examples/start/build.ts
deno check examples/full/server.ts          # Workspace full example
deno check examples/full/build.ts
```

Consumer code (`docs/`) imports `kvikkpress/mod.ts`, `kvikkpress/build.ts`, `kvikkpress/dev.ts`. After changes, also verify:

```sh
deno check docs/src/server.ts    # Runtime consumer
deno check docs/build.ts         # Build consumer
```
