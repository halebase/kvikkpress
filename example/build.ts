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
});

await engine.build();
console.log("Build complete");
