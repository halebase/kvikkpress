import { dev } from "@halebase/kvikkpress/dev";

const engine = await dev({
  content: "./content",
  site: { title: "Full Example" },
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  templateGlobals: {
    gitRemote: {
      remoteUrl: "https://github.com/your-org/your-docs",
      branch: "main",
    },
  },
  version: "1.0.0",
});

engine.mount();
Deno.serve({ port: 3002 }, engine.app.fetch);
