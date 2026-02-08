import { dev } from "../../dev.ts";
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
});

// 2. Add your middleware before mount() — auth, logging, custom routes, etc.
//    engine.app is a standard Hono app, so any Hono middleware works here.
//    Put your custom code in src/ and import it (see src/middleware.ts).
// engine.app.use("/*", logger);

// 3. Mount KvikkPress routes, then serve.
engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
