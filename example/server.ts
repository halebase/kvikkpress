import { createKvikkPress } from "../mod.ts";

const engine = createKvikkPress({
  content: "./content",
  site: { title: "My Docs" },
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
Deno.serve({ port: 3000 }, engine.app.fetch);
