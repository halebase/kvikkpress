import type { Hono } from "jsr:@hono/hono@^4.10.4";
import type { ContentData } from "../serve/routes.ts";
import type { McpConfig } from "./types.ts";
import { handleMcpRequest, type McpHandlerContext } from "./handler.ts";

/**
 * Register the MCP endpoint on the Hono app.
 * Must be called before the catch-all route in registerRoutes().
 */
export function registerMcpRoutes(
  app: Hono,
  content: ContentData,
  config: McpConfig,
): void {
  const serverName = config.name;
  const serverId = config.id;

  if (config.infoPage) {
    const extra = typeof config.infoPage === "string" ? config.infoPage : undefined;
    app.get("/mcp", (c) => {
      const origin = new URL(c.req.url).origin;
      const endpoint = `${origin}/mcp`;
      return c.html(mcpInfoPage(serverName, endpoint, extra));
    });
  }

  app.post("/mcp", async (c) => {
    // 1. Authenticate
    const authorization = extractBearerToken(c.req.header("authorization"));
    const auth = await config.authenticate(authorization, c);

    if (!auth) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32001, message: "Unauthorized" },
        },
        401,
      );
    }

    // 2. Parse JSON-RPC request
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
      );
    }

    if (
      !body || typeof body !== "object" || !("method" in body) ||
      typeof (body as Record<string, unknown>).method !== "string"
    ) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid request" },
        },
        400,
      );
    }

    // 3. Dispatch
    const ctx: McpHandlerContext = {
      serverName,
      serverId,
      markdown: content.markdown,
      contentIndex: content.contentIndex,
      auth,
    };

    const result = handleMcpRequest(
      body as Parameters<typeof handleMcpRequest>[0],
      ctx,
    );

    return c.json(result);
  });
}

/** Extract token from "Bearer <token>" header, or return null. */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function mcpInfoPage(name: string, endpoint: string, extra?: string): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MCP — ${e(name)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  p.subtitle { color: #666; margin-top: 0; }
  code { background: #f3f3f3; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f3f3; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85em; line-height: 1.5; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  .endpoint { font-size: 1.1em; font-weight: 600; }
</style>
</head>
<body>
<h1>MCP Server</h1>
<p class="subtitle">${e(name)}</p>

<p>This documentation site exposes an <a href="https://modelcontextprotocol.io">MCP</a> endpoint. Point your client to:</p>
<p class="endpoint"><code>${e(endpoint)}</code></p>
<p>Authentication is required. Use the token provided by your site administrator as a Bearer token.</p>

<h2>Claude Desktop</h2>
<pre>{
  "mcpServers": {
    "${e(name)}": {
      "url": "${e(endpoint)}",
      "headers": {
        "Authorization": "Bearer &lt;YOUR_TOKEN&gt;"
      }
    }
  }
}</pre>

<h2>Cursor</h2>
<p>Settings → MCP Servers → Add new server:</p>
<pre>Name: ${e(name)}
Type: streamable-http
URL:  ${e(endpoint)}</pre>
<p>Set the <code>Authorization</code> header to <code>Bearer &lt;YOUR_TOKEN&gt;</code> in the server config.</p>

<h2>Claude Code</h2>
<pre>{
  "mcpServers": {
    "${e(name)}": {
      "url": "${e(endpoint)}",
      "headers": {
        "Authorization": "Bearer &lt;YOUR_TOKEN&gt;"
      }
    }
  }
}</pre>
${extra ? `\n${extra}` : ""}
</body>
</html>`;
}
