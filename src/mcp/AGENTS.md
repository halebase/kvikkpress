# MCP Module

Minimal MCP (Model Context Protocol) server. JSON-RPC 2.0 over HTTP, no SDK, no Node.js deps — WinterTC-safe.

## Files

- `types.ts` — `McpConfig`, `McpAuth`. All config fields are **required**. No optional fields, no defaults, no unauthenticated mode.
- `handler.ts` — Stateless JSON-RPC dispatch. Pure function: `handleMcpRequest(body, ctx) → JsonRpcResponse`. No side effects, no async.
- `routes.ts` — Hono route registration. `POST /mcp` (JSON-RPC) + optional `GET /mcp` (HTML info page).

## Auth Pattern

Two-level design — do not flatten into a single callback:

```
authenticate(authorization, c)    ← once per request, validates session
  └→ McpAuth.canAccess(path)      ← per page, filters search results
```

`authenticate` resolves the session from the Bearer token. `canAccess` is a closure that captures session context and decides per-page visibility. One request searches many pages — the closure runs for each.

## API Design Rules

1. **Parameter naming matters for DX.** Use `authorization` not `token` — users immediately know what it is.
2. **`name` vs `id`** — `name` is a display string for MCP clients. `id` is a short identifier for the tool name (`query_docs_{id}`). These are separate because users name projects like "My Project Docs" and `query_docs_my_project_docs` is ugly.
3. **`id` is auto-normalized** to snake_case via `toSnakeCase()` in handler.ts.
4. **`infoPage` is required** (`boolean | string`), not optional. Forces explicit opt-in/opt-out at config time.
5. **All examples must show all parameters** with inline comments explaining what each receives and when it's called.

## Search

No inverted index. Case-insensitive regex over `Object.entries(markdown)`:
- Query split into words, each escaped for regex
- AND logic — all words must match
- `topic` prefix filter applied first, then `canAccess`, then regex
- Top 5 results returned as concatenated markdown

## Info Page

`GET /mcp` serves a self-contained HTML page (no templates, no CSS dependencies) with copy-paste client configs for Claude Desktop, Cursor, and Claude Code. `infoPage: true` for defaults, `infoPage: "extra html"` to append content, `infoPage: false` to disable.

## Protocol

Implements MCP protocol version `2025-03-26`. Methods:
- `initialize` → server info + capabilities
- `notifications/initialized` → empty result (stateless acknowledgement)
- `tools/list` → single tool `query_docs_{id}`
- `tools/call` → search + return markdown
