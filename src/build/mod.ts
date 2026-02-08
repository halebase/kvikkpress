import { walk } from "jsr:@std/fs@1/walk";
import { buildContentIndex, flattenForSidebar } from "../content/discovery.ts";
import {
  renderMarkdown,
  parseFrontmatter,
  extractToc,
  type MarkdownConfig,
} from "../content/render.ts";
import { buildFileHashes, hashFile } from "../serve/assets.ts";
import { buildCss, type CssConfig } from "../dev/css.ts";
import { generateBuildOutput } from "./output.ts";
import type { CachedPage } from "../content/types.ts";

export interface BuildConfig {
  /** Path to content directory (markdown files) */
  content: string;

  /** Path to templates directory (nunjucks .html files) */
  templates: string;

  /** Path to static assets directory */
  static: string;

  /** CSS build config */
  css?: CssConfig;

  /** Markdown pipeline configuration */
  markdown?: MarkdownConfig;

  /** Files to hash for cache busting (relative to static dir). Defaults to ["output.css", "kvikkpress.js"]. */
  hashFiles?: string[];

  /** Output directory for build artifacts. Defaults to "./_build". */
  outDir?: string;
}

/** Run the full KvikkPress build pipeline and write output to disk. */
export async function build(config: BuildConfig): Promise<void> {
  const outDir = config.outDir || "./_build";

  // 1. CSS compilation (output goes to _build/ alongside site.ts)
  await Deno.mkdir(outDir, { recursive: true });
  if (config.css) {
    console.log("Building CSS...");
    await buildCss(config.css);
  }

  // 2. Content discovery + tree
  console.log("Building content index...");
  const contentIndex = await buildContentIndex(config.content);
  const allFiles = flattenForSidebar(contentIndex);
  console.log(`Found ${allFiles.length} pages`);

  // 3. Markdown rendering + raw markdown capture
  console.log("Compiling pages...");
  const pages: Record<string, CachedPage> = {};
  const markdown: Record<string, string> = {};
  let errorCount = 0;

  for (const file of allFiles) {
    try {
      const filePath = await findFile(config.content, file.path);
      if (!filePath) {
        console.error(`  x ${file.path}: File not found`);
        errorCount++;
        continue;
      }

      const raw = await Deno.readTextFile(filePath);
      markdown[file.path] = raw;

      const { meta, markdown: mdContent } = parseFrontmatter(raw);
      const html = await renderMarkdown(mdContent, config.markdown);
      const toc = extractToc(html);

      pages[file.path] = { html, toc, meta };
      console.log(`  ok ${file.path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  x ${file.path}: ${message}`);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    throw new Error(`Failed to compile ${errorCount} page(s)`);
  }

  // 4. Template bundling
  console.log("Bundling templates...");
  const templates: Record<string, string> = {};
  for await (const entry of walk(config.templates, {
    includeDirs: false,
    exts: [".html"],
  })) {
    const name = entry.path.slice(config.templates.length + 1);
    templates[name] = await Deno.readTextFile(entry.path);
  }
  console.log(`  Bundled ${Object.keys(templates).length} templates`);

  // 5. Asset hashing
  const hashFiles = config.hashFiles || ["kvikkpress.js"];
  const fileHashes = await buildFileHashes(config.static, hashFiles);

  // Hash CSS from build output (lives in _build/, not static/)
  if (config.css) {
    fileHashes["/static/output.css"] = await hashFile(config.css.output);
  }

  // 6. Generate output module
  const output = generateBuildOutput({
    contentIndex,
    pages,
    markdown,
    templates,
    fileHashes,
  });

  const outPath = `${outDir}/site.ts`;
  await Deno.writeTextFile(outPath, output);
  console.log(`\nBuild complete → ${outPath}`);
}

/** Find the markdown file for a given page path. */
async function findFile(
  contentDir: string,
  pathname: string,
): Promise<string | null> {
  const path = pathname.replace(/^\//, "");
  const base = path ? `${contentDir}/${path}` : contentDir;

  if (await exists(`${base}/index.md`)) return `${base}/index.md`;
  if (await exists(`${base}.md`)) return `${base}.md`;

  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
