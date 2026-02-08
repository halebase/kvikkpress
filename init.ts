#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

// KvikkPress project initializer.
//
// Usage:
//   deno run -A --reload=https://raw.githubusercontent.com/halebase/kvikkpress https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts my-docs
//
// Fetches the starter template from GitHub. Aborts if target files already exist.

const REPO = "https://raw.githubusercontent.com/halebase/kvikkpress/main";

// Every file in examples/start — fetched as-is.
const FILES = [
  "deno.json",
  "server.ts",
  "build.ts",
  ".gitignore",
  "content/index.md",
  "src/middleware.ts",
  "static/main.js",
  "tailwind.config.js",
  "templates/layout.html",
  "templates/main.css",
];

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

async function fetchFile(path: string): Promise<string> {
  const url = `${REPO}/examples/start/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return await res.text();
}

async function writeFile(base: string, path: string, content: string) {
  const full = base === "." ? path : `${base}/${path}`;
  const parent = full.includes("/")
    ? full.substring(0, full.lastIndexOf("/"))
    : null;
  if (parent) await Deno.mkdir(parent, { recursive: true });
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
    `    deno run -A --reload=https://raw.githubusercontent.com/halebase/kvikkpress ${dim("https://raw.githubusercontent.com/halebase/kvikkpress/main/init.ts")} my-docs`,
  );
  console.log();
  Deno.exit(1);
}

// Check for conflicting files.
const conflicts: string[] = [];
for (const file of FILES) {
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

for (const path of FILES) {
  const content = await fetchFile(path);
  await writeFile(dir, path, content);
}

console.log();
console.log(`  ${green("Done!")} To start:`);
console.log();
console.log(`    cd ${dir}`);
console.log(`    deno task dev`);
console.log();
console.log(`  Then open ${bold("http://localhost:3600")}`);
console.log();
