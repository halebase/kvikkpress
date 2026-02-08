import { Hono } from "jsr:@hono/hono@^4.10.4";
import type nunjucks from "npm:nunjucks@^3.2.4";
import { registerRoutes, type ContentData } from "./serve/routes.ts";
import { createBundledEnv } from "./serve/templates.ts";
import type { ContentNode, CachedPage } from "./content/types.ts";
import { initLlmRuntime, type LlmConfig, type LlmTokenRuntime } from "./llm-tokens.ts";
import { registerMcpRoutes } from "./mcp/routes.ts";
import type { McpConfig } from "./mcp/types.ts";

export type { LlmConfig, McpConfig };

export interface KvikkPressConfig {
  /** Site metadata */
  site: {
    title: string;
    description?: string;
  };

  /** Pre-built content index (from build output) */
  contentIndex: ContentNode[];

  /** Pre-built page cache (from build output) */
  pages: Record<string, CachedPage>;

  /** Pre-built raw markdown for .md endpoint (from build output) */
  markdown: Record<string, string>;

  /** Pre-built template strings (from build output) */
  templates: Record<string, string>;

  /** Pre-built file hashes for cache busting (from build output) */
  fileHashes: Record<string, string>;

  /** Extra variables passed to every template render */
  templateGlobals?: Record<string, unknown>;

  /** Version string shown in templates. Defaults to "dev". */
  version?: string;

  /** LLM session token config. When provided, .md routes require auth via ?llm= token. */
  llm?: LlmConfig;

  /** MCP server config. When provided, POST /mcp serves MCP tool calls. */
  mcp?: McpConfig;
}

export interface KvikkPress {
  /** The Hono app — add middleware and routes before calling mount(). */
  app: Hono;

  /** Register KvikkPress routes. Call after adding consumer middleware. */
  mount(): void;

  /** Render a template with data. Uses bundled templates (prod) or filesystem (dev). */
  render(template: string, data: Record<string, unknown>): string;

  /** The current content tree. */
  get contentIndex(): ContentNode[];

  /** Shorthand for app.fetch — pass to Deno.serve() or export default. */
  // deno-lint-ignore no-explicit-any
  fetch: (request: Request, ...args: any[]) => Response | Promise<Response>;
}

/**
 * Create a KvikkPress engine from pre-built content.
 * The engine is runtime-only — no filesystem access, no Deno APIs.
 * Use `build()` from `@halebase/kvikkpress/build` to generate the build output.
 */
export function createKvikkPress(config: KvikkPressConfig): KvikkPress {
  const app = new Hono();
  const nunjucksEnv = createBundledEnv(config.templates);

  const llmRuntime = config.llm ? initLlmRuntime(config.llm) : undefined;

  return createEngine(app, nunjucksEnv, config, llmRuntime, config.mcp);
}

/**
 * Internal: create a KvikkPress engine from an existing Hono app and nunjucks env.
 * Used by both the production `createKvikkPress()` and the dev `dev()` function.
 */
export function createEngine(
  app: Hono,
  nunjucksEnv: nunjucks.Environment,
  config: {
    site: { title: string; description?: string };
    contentIndex: ContentNode[];
    pages: Record<string, CachedPage>;
    markdown: Record<string, string>;
    fileHashes: Record<string, string>;
    templateGlobals?: Record<string, unknown>;
    version?: string;
  },
  llmRuntime?: LlmTokenRuntime,
  mcpConfig?: McpConfig,
): KvikkPress {
  let mounted = false;

  const content: ContentData = {
    contentIndex: config.contentIndex,
    pages: config.pages,
    markdown: config.markdown,
  };

  const engine: KvikkPress = {
    app,

    mount() {
      if (mounted) return;
      // MCP routes must register before the catch-all in registerRoutes()
      if (mcpConfig) {
        registerMcpRoutes(app, content, mcpConfig);
      }
      registerRoutes(app, nunjucksEnv, content, {
        siteTitle: config.site.title,
        templateGlobals: config.templateGlobals,
        fileHashes: config.fileHashes,
        version: config.version || "dev",
      }, llmRuntime);
      mounted = true;
    },

    render(template: string, data: Record<string, unknown>): string {
      return nunjucksEnv.render(template, data);
    },

    get contentIndex() {
      return content.contentIndex;
    },

    fetch: app.fetch,
  };

  return engine;
}
