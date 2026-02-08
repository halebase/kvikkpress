import { build } from "../../build.ts";

await build({
  content: "./content",
  templates: "./templates",
  static: "./static",
  css: {
    input: "./templates/main.css",
    output: "./_build/output.css",
    tailwindConfig: "./tailwind.config.js",
  },
  outDir: "./_build",
});
