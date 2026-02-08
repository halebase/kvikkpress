#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

// KvikkPress project initializer.
//
// Usage:
//   deno run -A --reload https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts my-docs
//
// Fetches the starter template from GitHub and writes standalone files
// with correct jsr imports. Aborts if target files already exist.

const REPO = "https://raw.githubusercontent.com/halebase/kvikkpress/main";

// Files fetched as-is from the starter template on GitHub.
const REMOTE_FILES = [
  "content/index.md",
  "src/middleware.ts",
  "static/main.js",
  "tailwind.config.js",
  "templates/layout.html",
  "templates/main.css",
];

// --- Standalone files (jsr imports, not monorepo-relative) ---

const GENERATED: Record<string, string> = {
  "deno.json": `{
  "tasks": {
    "dev": "deno run --node-modules-dir --allow-net --allow-read --allow-write --allow-run --allow-env server.ts",
    "build": "deno run --node-modules-dir --allow-net --allow-read --allow-write --allow-run --allow-env build.ts"
  }
}
`,
  "server.ts": `import { dev } from "jsr:@halebase/kvikkpress/dev";

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
// import { logger } from "./src/middleware.ts";
// engine.app.use("/*", logger);

// 3. Mount KvikkPress routes, then serve.
engine.mount();
Deno.serve({ port: 3000 }, engine.app.fetch);
`,
  "build.ts": `import { build } from "jsr:@halebase/kvikkpress/build";

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
`,
  ".gitignore": `_build/
node_modules/
`,
};

// --- ANSI ---

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// --- Helpers ---

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchRemote(path: string): Promise<string> {
  const url = `${REPO}/examples/start/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return await res.text();
}

async function writeFile(base: string, path: string, content: string) {
  const full = base === "." ? path : `${base}/${path}`;
  const dir = full.includes("/")
    ? full.substring(0, full.lastIndexOf("/"))
    : null;
  if (dir) await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(full, content);
  console.log(`  ${green("+")} ${path}`);
}

// --- Main ---

console.log();
console.log(`  ${bold("KvikkPress")} — create a new project`);
console.log();

let dir = Deno.args[0];

if (!dir) {
  console.log(`  This will create a new KvikkPress docs project.`);
  console.log(`  Pick a folder name — files will be created inside it.`);
  console.log();
  dir = prompt(`  ${bold("Folder name")} ${dim("(e.g. my-docs)")}:`) ?? "";
  dir = dir.trim();
}

if (!dir) {
  console.log();
  console.log(`  ${red("x")} No folder name.`);
  console.log();
  console.log(`  Usage:`);
  console.log(
    `    deno run -A --reload ${dim("https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts")} my-docs`,
  );
  console.log();
  Deno.exit(1);
}

// Check for conflicting files.
const allFiles = [...Object.keys(GENERATED), ...REMOTE_FILES];
const conflicts: string[] = [];
for (const file of allFiles) {
  const full = dir === "." ? file : `${dir}/${file}`;
  if (await fileExists(full)) conflicts.push(file);
}

if (conflicts.length > 0) {
  console.log(`  ${red("x")} These files already exist in ${dir}/:`);
  console.log();
  for (const f of conflicts) console.log(`      ${f}`);
  console.log();
  console.log(`  Remove them first or pick a different folder.`);
  console.log();
  Deno.exit(1);
}

console.log();
console.log(`  Fetching starter template...`);
console.log();

// Write generated files (standalone jsr imports).
for (const [path, content] of Object.entries(GENERATED)) {
  await writeFile(dir, path, content);
}

// Fetch and write remote files from GitHub.
for (const path of REMOTE_FILES) {
  const content = await fetchRemote(path);
  await writeFile(dir, path, content);
}

console.log();
console.log(`  ${green("Done!")} To start:`);
console.log();
console.log(`    cd ${dir}`);
console.log(`    deno task dev`);
console.log();
console.log(`  Then open ${bold("http://localhost:3000")}`);
console.log();
