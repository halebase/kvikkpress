import { Hono } from "jsr:@hono/hono@^4.10.4";
import { getCookie, setCookie } from "jsr:@hono/hono@^4.10.4/cookie";
import { logger } from "jsr:@hono/hono@^4.10.4/logger";
import type nunjucks from "npm:nunjucks@^3.2.4";
import type { ContentNode, CachedPage } from "../content/types.ts";
import {
  verifyLlmToken,
  canAccessRoute,
  isProtectedRoute,
  createLlmToken,
  resolveAllPermissions,
  llmFooter,
  llm401Response,
  type LlmTokenRuntime,
} from "../llm-tokens.ts";

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
  llm?: LlmTokenRuntime,
): void {
  app.use("*", logger());

  // LLM token generation endpoint
  if (llm) {
    app.post("/api/llm-token", async (c) => {
      if (llm.isAuthenticated && !await llm.isAuthenticated(c)) {
        return c.json({ error: "Not authenticated" }, 401);
      }

      const { groupBits, entryBits } = resolveAllPermissions(llm);
      const token = await createLlmToken(llm, groupBits, entryBits);
      const origin = new URL(c.req.url).origin;
      const path = c.req.query("path") || "/";

      return c.json({
        token,
        expiresIn: `${llm.expiresInHours}h`,
        usage: {
          curl: `curl -s "${origin}${path}?llm=${token}"`,
          hint: `Append ?llm=${token} to every link you follow on ${origin}`,
        },
      });
    });
  }

  // Dual-serve catch-all: .md → raw markdown, otherwise → HTML
  app.get("/*", async (c) => {
    const pathname = c.req.path;

    // Serve raw markdown from pre-built data
    if (pathname.endsWith(".md")) {
      const pathWithoutMd = pathname.slice(0, -3);
      const md = content.markdown[pathWithoutMd];
      if (!md) return c.text(`Not found: ${pathname}`, 404);

      const nav = renderNavigation(content.contentIndex);

      // LLM auth for protected routes
      if (llm && isProtectedRoute(llm, pathname)) {
        // Primary auth (consumer callback, e.g. browser cookie session)
        if (llm.isAuthenticated && await llm.isAuthenticated(c)) {
          return serveMd(c, md + nav, "private, no-cache");
        }

        // LLM token: ?llm= param or llm_s cookie
        const llmParam = c.req.query("llm");
        const tokenStr = llmParam || getCookie(c, "llm_s");
        if (tokenStr) {
          const data = await verifyLlmToken(llm, tokenStr);
          if (data && !data.expired && canAccessRoute(llm, data, pathname)) {
            if (llmParam) {
              const protocol = c.req.header("x-forwarded-proto") || "http";
              const hoursLeft = data.expiryHours - Math.floor(
                (Date.now() / 1000 - llm.epoch) / 3600,
              );
              setCookie(c, "llm_s", tokenStr, {
                httpOnly: true,
                secure: protocol === "https",
                sameSite: "Lax",
                path: "/",
                maxAge: Math.max(0, hoursLeft * 3600),
              });
            }
            const body = llmParam ? md + nav + llmFooter(llmParam) : md + nav;
            return serveMd(c, body, "private, no-cache");
          }
        }

        return c.text(llm401Response(), 401, {
          "content-type": "text/plain; charset=utf-8",
        });
      }

      return serveMd(c, md + nav, "public, no-cache");
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

    const tag = computeEtag(html);
    if (c.req.header("if-none-match") === tag) {
      return c.body(null, 304, { "cache-control": "public, no-cache", "etag": tag });
    }
    return c.html(html, 200, { "cache-control": "public, no-cache", "etag": tag });
  });
}

// deno-lint-ignore no-explicit-any
function serveMd(c: any, body: string, cacheControl: string) {
  const tag = computeEtag(body);
  if (c.req.header("if-none-match") === tag) {
    return c.body(null, 304, { "cache-control": cacheControl, "etag": tag });
  }
  return c.text(body, 200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": cacheControl,
    "etag": tag,
  });
}

/** FNV-1a hash → ETag string. Fast, sync, good enough for cache revalidation. */
function computeEtag(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `"${(h >>> 0).toString(36)}"`;
}

/** Render content tree as markdown navigation with .md links for LLM traversal. */
function renderNavigation(nodes: ContentNode[]): string {
  const lines: string[] = ["", "", "---", "", "## Pages"];
  appendNodes(nodes, lines, 0);
  return lines.join("\n");
}

function appendNodes(nodes: ContentNode[], lines: string[], depth: number): void {
  const indent = "  ".repeat(depth);
  for (const node of nodes) {
    if (node.hidden) continue;
    if (node.isDir) {
      if (node.indexPath) {
        lines.push(`${indent}- [${node.title}](${node.indexPath}.md)`);
      } else {
        lines.push(`${indent}- ${node.title}`);
      }
      appendNodes(node.children, lines, depth + 1);
    } else {
      lines.push(`${indent}- [${node.title}](${node.path}.md)`);
    }
  }
}
