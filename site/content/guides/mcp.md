---
title: "MCP Server"
order: 8
---

# MCP Server

Expose your documentation as an [MCP](https://modelcontextprotocol.io) server. LLM clients can search and retrieve pages via the standard Model Context Protocol over `POST /mcp`.

## Setup

```ts title="server.ts"
const engine = await dev({
  ...config,
  mcp: {
    name: "My Project Docs",
    id: "my_project",
    infoPage: true,
    authenticate: async (authorization, c) => {
      if (!authorization) return null;
      const user = await verifyToken(authorization);
      if (!user) return null;
      return {
        canAccess: (path) => user.allowedPrefixes.some((p) => path.startsWith(p)),
      };
    },
  },
});
```

The `authenticate` hook is required — there is no unauthenticated mode. It receives the Bearer token (or null) and the Hono request context. Return an `McpAuth` object with a `canAccess(path)` filter, or null to deny.

## McpConfig

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Display name shown to MCP clients (e.g. `"My Project Docs"`) |
| `id` | `string` | Short identifier for the tool name. Normalized to snake\_case → `query_docs_{id}` |
| `infoPage` | `boolean \| string` | Serve an HTML info page at `GET /mcp` with client connection instructions. Pass a string to append extra HTML |
| `authenticate` | `(authorization, c) => McpAuth \| null` | Auth hook. Receives Authorization Bearer value and Hono context |

## McpAuth

| Field | Type | Description |
|---|---|---|
| `canAccess(path)` | `(path: string) => boolean` | Return true if this session can access the given page path |

## How it works

The server exposes a single tool, `query_docs_{id}` (e.g. `query_docs_my_project`), which searches the in-memory markdown by keyword and returns matching pages filtered through `canAccess()`. The tool name is derived from the `id` field to avoid collisions when a client connects to multiple MCP servers.

Search splits the query into words, AND logic (all words must match), case-insensitive, returns top 5 hits as concatenated markdown with titles.

## Example client requests

```sh title="initialize"
curl -X POST http://localhost:3600/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

```sh title="search docs"
curl -X POST http://localhost:3600/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_docs_my_project","arguments":{"query":"authentication","topic":"/guides"}}}'
```
