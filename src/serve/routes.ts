import { Hono } from "jsr:@hono/hono@^4.10.4";
import { logger } from "jsr:@hono/hono@^4.10.4/logger";
import type nunjucks from "npm:nunjucks@^3.2.4";
import type { ContentNode, CachedPage } from "../content/types.ts";

/** Mutable content data — routes read from this on every request. */
export interface ContentData {
  contentIndex: ContentNode[];
  pages: Record<string, CachedPage>;
  markdown: Record<string, string>;
}

export interface RouteConfig {
  siteTitle: string;
  templateGlobals?: Record<string, unknown>;
  fileHashes: Record<string, string>;
  version: string;
}

export function registerRoutes(
  app: Hono,
  nunjucksEnv: nunjucks.Environment,
  content: ContentData,
  config: RouteConfig,
): void {
  app.use("*", logger());

  // Dual-serve catch-all: .md → raw markdown, otherwise → HTML
  app.get("/*", (c) => {
    const pathname = c.req.path;

    // Serve raw markdown from pre-built data
    if (pathname.endsWith(".md")) {
      const pathWithoutMd = pathname.slice(0, -3);
      const md = content.markdown[pathWithoutMd];
      if (!md) {
        return c.text(`Not found: ${pathname}`, 404);
      }
      c.res.headers.set(
        "cache-control",
        "no-store, no-cache, must-revalidate",
      );
      return c.text(md, 200, {
        "content-type": "text/markdown; charset=utf-8",
      });
    }

    // Serve HTML from pre-built page cache
    const cached = content.pages[pathname];
    if (!cached) {
      return c.text(`Not found: ${pathname}`, 404);
    }

    const html = nunjucksEnv.render("layout.html", {
      title: cached.meta.title || "Documentation",
      siteTitle: config.siteTitle,
      contentTree: content.contentIndex,
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
