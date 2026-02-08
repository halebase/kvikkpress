import { Hono } from "jsr:@hono/hono@^4.10.4";
import nunjucks from "npm:nunjucks@^3.2.4";
import { ContentCache } from "./content/cache.ts";
import { registerRoutes } from "./serve/routes.ts";
import { buildFileHashes } from "./serve/assets.ts";
import { startContentWatcher } from "./dev/watcher.ts";
import { buildCss, watchCss, type CssConfig } from "./dev/css.ts";
import type { MarkdownConfig } from "./content/render.ts";
import type { ContentNode } from "./content/types.ts";

export interface KvikkPressConfig {
  /** Path to content directory (markdown files) */
  content: string;

  /** Site metadata */
  site: {
    title: string;
    description?: string;
  };

  /** Theme configuration */
  theme: {
    /** Directory containing nunjucks templates. Must have layout.html. */
    templates: string;
    /** Directory for static assets (served at /static/*) */
    static: string;
    /** CSS build config. */
    css?: CssConfig;
    /** Files to hash for cache busting (relative to static dir) */
    hashFiles?: string[];
  };

  /** Markdown pipeline configuration */
  markdown?: MarkdownConfig;

  /** Extra variables passed to every template render */
  templateGlobals?: Record<string, unknown>;

  /** Version string shown in templates. Defaults to "dev". */
  version?: string;

  /** Disable template caching (for development). Defaults to false. */
  noTemplateCache?: boolean;
}

export interface KvikkPress {
  /** The Hono app — add middleware and routes to this before calling start(). */
  app: Hono;

  /** Compile assets (CSS). Run once at build time (e.g. in Dockerfile). */
  build(): Promise<void>;

  /** Build content cache, hash assets, register routes. Call at server startup. */
  start(): Promise<void>;

  /** Rebuild content index and page cache (e.g. after content changes). */
  rebuild(): Promise<void>;

  /** Start content + CSS watchers for dev mode. Calls build() + start() first. */
  startDev(): Promise<void>;

  /** The current content tree. */
  get contentIndex(): ContentNode[];

  /** Shorthand for app.fetch — pass to Deno.serve(). */
  fetch: (request: Request, info?: Deno.ServeHandlerInfo) => Response | Promise<Response>;
}

export function createKvikkPress(config: KvikkPressConfig): KvikkPress {
  const app = new Hono();
  const cache = new ContentCache(config.content, config.markdown);
  let routesRegistered = false;

  // Configure nunjucks
  nunjucks.configure(config.theme.templates, {
    autoescape: true,
    throwOnUndefined: false,
    noCache: config.noTemplateCache ?? false,
  });

  const engine: KvikkPress = {
    app,

    async build() {
      if (config.theme.css) {
        console.log("Building CSS...");
        await buildCss(config.theme.css);
      }
    },

    async start() {
      // Hash static files for cache busting
      const filesToHash = config.theme.hashFiles || ["output.css", "main.js"];
      const fileHashes = await buildFileHashes(
        config.theme.static,
        filesToHash
      );

      // Build content index + page cache
      await cache.build();

      // Register engine routes (after consumer has added their middleware/routes)
      if (!routesRegistered) {
        registerRoutes(app, cache, {
          staticDir: config.theme.static,
          siteTitle: config.site.title,
          templateGlobals: config.templateGlobals,
          fileHashes,
          version: config.version || "dev",
        });
        routesRegistered = true;
      }
    },

    async rebuild() {
      await cache.rebuild();
    },

    async startDev() {
      await engine.build();
      await engine.start();
      startContentWatcher(config.content, cache);
      if (config.theme.css) {
        watchCss(config.theme.css);
      }
    },

    get contentIndex() {
      return cache.contentIndex;
    },

    fetch: app.fetch,
  };

  return engine;
}
