import { dev } from "../dev.ts";

const engine = await dev({
  content: "./content",
  site: { title: "KvikkPress" },
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
});

engine.mount();
Deno.serve({ port: 3601 }, engine.app.fetch);
