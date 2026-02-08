import type { Context } from "jsr:@hono/hono@^4.10.4";

/**
 * MCP server config. Providing this config enables the POST /mcp route.
 * The authenticate hook is required — there is no unauthenticated mode.
 */
export interface McpConfig {
  /** Display name shown to MCP clients (e.g. "My Project Docs"). */
  name: string;

  /** Short identifier used in the tool name. Normalized to snake_case → query_docs_{id}. */
  id: string;

  /** Serve an HTML info page at GET /mcp with client connection instructions. Pass a string to include extra content (rendered as HTML) below the default instructions. */
  infoPage: boolean | string;

  /**
   * Authenticate an MCP request. Receives the Authorization Bearer value
   * (or null if absent) and the Hono request context.
   *
   * Return an McpAuth object to grant access, or null to deny (401).
   */
  authenticate: (
    authorization: string | null,
    c: Context,
  ) => McpAuth | null | Promise<McpAuth | null>;
}

/** Auth context returned by the authenticate hook. */
export interface McpAuth {
  /** Return true if this authenticated session can access the given page path. */
  canAccess(path: string): boolean;
}
