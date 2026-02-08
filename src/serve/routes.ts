import { Hono } from "jsr:@hono/hono@^4.10.4";
import { serveStatic } from "jsr:@hono/hono@^4.10.4/deno";
import { logger } from "jsr:@hono/hono@^4.10.4/logger";
import nunjucks from "npm:nunjucks@^3.2.4";
import type { ContentCache } from "../content/cache.ts";

export interface RouteConfig {
  staticDir: string;
  siteTitle: string;
  templateGlobals?: Record<string, unknown>;
  fileHashes: Record<string, string>;
  version: string;
}

export function registerRoutes(
  app: Hono,
  cache: ContentCache,
  config: RouteConfig
): void {
  app.use("*", logger());

  // Static file serving — JS gets no-cache, images get 4h cache
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
    serveStatic({
      root: "./",
      rewriteRequestPath: (path) => path,
    })
  );

  // Dual-serve catch-all: .md → raw markdown, otherwise → HTML
  app.get("/*", async (c) => {
    const pathname = c.req.path;

    // Serve raw markdown
    if (pathname.endsWith(".md")) {
      const pathWithoutMd = pathname.slice(0, -3);
      const filePath = await cache.findFile(pathWithoutMd);
      if (!filePath) {
        return c.text(`Not found: ${pathname}`, 404);
      }
      const md = await Deno.readTextFile(filePath);
      c.res.headers.set(
        "cache-control",
        "no-store, no-cache, must-revalidate"
      );
      return c.text(md, 200, {
        "content-type": "text/markdown; charset=utf-8",
      });
    }

    // Serve HTML
    const cached = cache.pageCache.get(pathname);
    if (!cached) {
      return c.text(`Not found: ${pathname}`, 404);
    }

    const html = nunjucks.render("layout.html", {
      title: cached.meta.title || "Documentation",
      siteTitle: config.siteTitle,
      contentTree: cache.contentIndex,
      currentPath: pathname,
      content: cached.html,
      toc: cached.toc,
      meta: cached.meta,
      fileHashes: config.fileHashes,
      year: new Date().getFullYear(),
      version: config.version,
      ...config.templateGlobals,
    });

    c.res.headers.set("cache-control", "no-store, no-cache, must-revalidate");
    return c.html(html);
  });
}
