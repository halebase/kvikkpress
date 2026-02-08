import { dev } from "@halebase/kvikkpress/dev";
// import { logger } from "./src/middleware.ts";

// 1. Create the engine — builds content index, compiles CSS, starts file watcher.
const engine = await dev({
  content: "./content",
  site: { title: "My Docs" },
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },

  // Uncomment to enable MCP server at POST /mcp.
  // LLM clients can search and retrieve docs via standard MCP tool calls.
  // mcp: {
  //   name: "My Docs",
  //   id: "my_project",
  //   infoPage: true,
  //   authenticate: (authorization, c /* c.req.header(), c.req.query() */) => {
  //     if (!authorization) return null;
  //     // Validate token here (HMAC, KV lookup, JWT, etc.)
  //     return { canAccess: (path /* e.g. "/guides/auth" */) => true };
  //   },
  // },
});

// 2. Add your middleware before mount() — auth, logging, custom routes, etc.
//    engine.app is a standard Hono app, so any Hono middleware works here.
//    Put your custom code in src/ and import it (see src/middleware.ts).
// engine.app.use("/*", logger);

// 3. Mount KvikkPress routes, then serve.
engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
