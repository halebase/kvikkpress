import { createKvikkPress } from "../mod.ts";

const engine = createKvikkPress({
  content: "./content",
  site: { title: "KvikkPress" },
  theme: {
    templates: "./templates",
    static: "./static",
    css: {
      input: "./templates/main.css",
      output: "./static/output.css",
      tailwindConfig: "./tailwind.config.js",
    },
  },
  noTemplateCache: true,
});

await engine.startDev();
Deno.serve({ port: 3001 }, engine.app.fetch);
