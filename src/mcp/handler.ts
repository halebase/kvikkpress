/**
 * Minimal MCP (Model Context Protocol) handler.
 *
 * Implements JSON-RPC 2.0 dispatch for the MCP Streamable HTTP transport.
 * Speaks just enough protocol for a single-tool read-only docs server:
 * initialize, tools/list, tools/call.
 */

import type { ContentNode } from "../content/types.ts";
import type { McpAuth } from "./types.ts";

const PROTOCOL_VERSION = "2025-03-26";
const MAX_RESULTS = 5;

// --- JSON-RPC types (minimal subset) ---

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// --- Public API ---

export interface McpHandlerContext {
  serverName: string;
  serverId: string;
  markdown: Record<string, string>;
  contentIndex: ContentNode[];
  auth: McpAuth;
}

/**
 * Handle a single MCP JSON-RPC request. Returns a JSON-RPC response object.
 */
export function handleMcpRequest(
  req: JsonRpcRequest,
  ctx: McpHandlerContext,
): JsonRpcResponse {
  const id = req.id ?? null;

  switch (req.method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: ctx.serverName, version: "1.0.0" },
        capabilities: { tools: {} },
      });

    case "notifications/initialized":
      // Client acknowledgement — no response needed for notifications,
      // but since we're stateless we just return an empty result.
      return jsonRpcResult(id, {});

    case "tools/list":
      return jsonRpcResult(id, { tools: [buildToolDef(ctx.serverId)] });

    case "tools/call":
      return handleToolCall(id, req.params, ctx);

    default:
      return jsonRpcError(id, -32601, `Method not found: ${req.method}`);
  }
}

// --- Tool definition ---

/** Convert a name to snake_case: "My Project" / "my-project" → "my_project" */
function toSnakeCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/gi, "")
    .toLowerCase();
}

/** Derive the tool name from the project name: query_docs_{name} */
function toolName(serverName: string): string {
  return `query_docs_${toSnakeCase(serverName)}`;
}

function buildToolDef(serverId: string) {
  return {
    name: toolName(serverId),
    description: "Search documentation and return relevant pages as markdown",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Search query — keywords or phrase to find in documentation",
        },
        topic: {
          type: "string" as const,
          description:
            "Optional path prefix to narrow results (e.g. '/api', '/guides')",
        },
      },
      required: ["query"],
    },
  };
}

// --- Tool execution ---

function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown> | undefined,
  ctx: McpHandlerContext,
): JsonRpcResponse {
  const name = params?.name;
  if (name !== toolName(ctx.serverId)) {
    return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
  }

  const args = (params?.arguments ?? {}) as Record<string, unknown>;
  const query = args.query;
  if (typeof query !== "string" || query.trim() === "") {
    return jsonRpcError(id, -32602, "Missing or empty 'query' parameter");
  }

  const topic = typeof args.topic === "string" ? args.topic : undefined;
  const results = searchMarkdown(query, topic, ctx);

  if (results.length === 0) {
    return jsonRpcResult(id, {
      content: [{ type: "text", text: "No matching documentation found." }],
    });
  }

  const text = results
    .map((r) => `# ${r.path} — ${r.title}\n\n${r.markdown}`)
    .join("\n\n---\n\n");

  return jsonRpcResult(id, {
    content: [{ type: "text", text }],
  });
}

// --- Search ---

interface SearchHit {
  path: string;
  title: string;
  markdown: string;
}

function searchMarkdown(
  query: string,
  topic: string | undefined,
  ctx: McpHandlerContext,
): SearchHit[] {
  // Build case-insensitive regex, escaping special characters.
  // Split query into words and match all of them (AND logic).
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(escapeRegex);

  if (words.length === 0) return [];

  const patterns = words.map((w) => new RegExp(w, "i"));
  const titleMap = buildTitleMap(ctx.contentIndex);
  const hits: SearchHit[] = [];

  for (const [path, md] of Object.entries(ctx.markdown)) {
    // Path prefix filter
    if (topic && !path.startsWith(topic)) continue;

    // Auth filter
    if (!ctx.auth.canAccess(path)) continue;

    // Match all query words against the markdown content
    if (patterns.every((p) => p.test(md))) {
      hits.push({
        path,
        title: titleMap.get(path) || path,
        markdown: md,
      });
    }

    if (hits.length >= MAX_RESULTS) break;
  }

  return hits;
}

/** Build a flat path → title map from the content tree. */
function buildTitleMap(nodes: ContentNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (list: ContentNode[]) => {
    for (const node of list) {
      if (node.isDir) {
        if (node.indexPath) map.set(node.indexPath, node.title);
        walk(node.children);
      } else {
        map.set(node.path, node.title);
      }
    }
  };
  walk(nodes);
  return map;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- JSON-RPC helpers ---

function jsonRpcResult(
  id: string | number | null,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
