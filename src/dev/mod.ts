import { Hono } from "jsr:@hono/hono@^4.10.4";
import { serveStatic } from "jsr:@hono/hono@^4.10.4/deno";
import { ContentCache } from "../content/cache.ts";
import { buildFileHashes, hashFile } from "../serve/assets.ts";
import { createFilesystemEnv } from "../serve/templates.ts";
import { createEngine, type KvikkPress } from "../engine.ts";
import { startContentWatcher } from "./watcher.ts";
import { buildCss, watchCss, type CssConfig } from "./css.ts";
import type { MarkdownConfig } from "../content/render.ts";

export interface DevConfig {
  /** Path to content directory (markdown files) */
  content: string;

  /** Path to templates directory (nunjucks .html files) */
  templates: string;

  /** Path to static assets directory */
  static: string;

  /** CSS build config */
  css?: CssConfig;

  /** Markdown pipeline configuration */
  markdown?: MarkdownConfig;

  /** Site metadata */
  site: {
    title: string;
    description?: string;
  };

  /** Files to hash for cache busting (relative to static dir). Defaults to ["output.css", "main.js"]. */
  hashFiles?: string[];

  /** Extra variables passed to every template render */
  templateGlobals?: Record<string, unknown>;

  /** Version string shown in templates. Defaults to "dev". */
  version?: string;
}

/**
 * Start KvikkPress in development mode.
 *
 * - Builds CSS + compiles all content in-memory
 * - Starts file watchers for incremental rebuilds
 * - Uses filesystem nunjucks loader (no cache — edit templates, refresh browser)
 * - Serves static files from disk
 */
export async function dev(config: DevConfig): Promise<KvikkPress> {
  // 1. Build CSS (output goes to _build/ alongside other artifacts)
  if (config.css) {
    const cssDir = config.css.output.substring(0, config.css.output.lastIndexOf("/"));
    if (cssDir) await Deno.mkdir(cssDir, { recursive: true });
    console.log("Building CSS...");
    await buildCss(config.css);
  }

  // 2. Build content in-memory
  const cache = new ContentCache(config.content, config.markdown);
  await cache.build();

  // 3. Hash static files
  const hashFiles = config.hashFiles || ["main.js"];
  const fileHashes = await buildFileHashes(config.static, hashFiles);

  // Hash CSS from build output (lives in _build/, not static/)
  if (config.css) {
    fileHashes["/static/output.css"] = await hashFile(config.css.output);
  }

  // 4. Set up nunjucks with filesystem loader (noCache for live edits)
  const nunjucksEnv = createFilesystemEnv(config.templates);

  // 5. Create Hono app with static file serving for dev
  const app = new Hono();

  // Serve CSS from _build/ (generated artifact, not a source file)
  if (config.css) {
    const cssOutputPath = config.css.output;
    app.get("/static/output.css", async (c) => {
      const content = await Deno.readFile(cssOutputPath);
      c.res.headers.set("cache-control", "no-store, no-cache, must-revalidate");
      return c.body(content, 200, { "content-type": "text/css; charset=utf-8" });
    });
  }

  app.use("/static/*.js", async (c, next) => {
    await next();
    c.res.headers.set("cache-control", "no-store, no-cache, must-revalidate");
  });

  app.use("/static/*", async (c, next) => {
    await next();
    if (c.res.headers.get("content-type")?.startsWith("image/")) {
      c.res.headers.set("cache-control", "public, max-age=14400");
    }
  });

  app.use(
    "/static/*",
    serveStatic({ root: "./", rewriteRequestPath: (path) => path }),
  );

  // 6. Create engine with mutable content data
  const engine = createEngine(app, nunjucksEnv, {
    site: config.site,
    contentIndex: cache.contentIndex,
    pages: cache.pageCache,
    markdown: cache.markdown,
    fileHashes,
    templateGlobals: config.templateGlobals,
    version: config.version,
  });

  // 7. Start watchers
  startContentWatcher(config.content, cache);
  if (config.css) {
    watchCss(config.css);
  }

  return engine;
}
