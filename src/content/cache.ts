import { buildContentIndex, flattenForSidebar } from "./discovery.ts";
import { renderMarkdown, parseFrontmatter, extractToc } from "./render.ts";
import type { MarkdownConfig } from "./render.ts";
import type { ContentNode, CachedPage } from "./types.ts";

export class ContentCache {
  private contentDir: string;
  private markdownConfig?: MarkdownConfig;
  private _contentIndex: ContentNode[] = [];
  private _pageCache: Record<string, CachedPage> = {};
  private _markdown: Record<string, string> = {};

  constructor(contentDir: string, markdownConfig?: MarkdownConfig) {
    this.contentDir = contentDir;
    this.markdownConfig = markdownConfig;
  }

  get contentIndex(): ContentNode[] {
    return this._contentIndex;
  }

  get pageCache(): Record<string, CachedPage> {
    return this._pageCache;
  }

  get markdown(): Record<string, string> {
    return this._markdown;
  }

  /** Full build: discover all content, compile all pages. */
  async build(): Promise<void> {
    console.log("Building content index...");
    const nodes = await buildContentIndex(this.contentDir);
    this._contentIndex.length = 0;
    this._contentIndex.push(...nodes);
    console.log(`Found ${this._contentIndex.length} top-level items`);
    await this.buildAllPages();
  }

  /** Full rebuild: re-discover and re-compile everything. */
  async rebuild(): Promise<void> {
    const nodes = await buildContentIndex(this.contentDir);
    this._contentIndex.length = 0;
    this._contentIndex.push(...nodes);
    await this.buildAllPages();
  }

  /** Incremental: re-compile a single page. */
  async updatePage(pathname: string): Promise<void> {
    const filePath = await this.findFile(pathname);
    if (!filePath) {
      console.error(`  x ${pathname}: File not found`);
      return;
    }

    const raw = await Deno.readTextFile(filePath);
    this._markdown[pathname] = raw;

    const { meta, markdown } = parseFrontmatter(raw);
    const html = await renderMarkdown(markdown, this.markdownConfig);
    const toc = extractToc(html);

    this._pageCache[pathname] = { html, toc, meta };
    console.log(`  ok ${pathname} (updated)`);
  }

  /** Incremental: remove a page from cache. */
  removePage(pathname: string): void {
    delete this._pageCache[pathname];
    delete this._markdown[pathname];
    console.log(`  ok ${pathname} (removed)`);
  }

  async findFile(pathname: string): Promise<string | null> {
    const path = pathname.replace(/^\//, "");
    const base = path
      ? `${this.contentDir}/${path}`
      : this.contentDir;

    if (await exists(`${base}/index.md`)) return `${base}/index.md`;
    if (await exists(`${base}.md`)) return `${base}.md`;

    return null;
  }

  private async buildAllPages(): Promise<void> {
    console.log("\nBuilding page cache...");
    const allFiles = flattenForSidebar(this._contentIndex);

    // Clear caches
    for (const key of Object.keys(this._pageCache)) delete this._pageCache[key];
    for (const key of Object.keys(this._markdown)) delete this._markdown[key];

    let successCount = 0;
    let errorCount = 0;

    for (const file of allFiles) {
      try {
        const filePath = await this.findFile(file.path);
        if (!filePath) {
          console.error(`  x ${file.path}: File not found`);
          errorCount++;
          continue;
        }

        const raw = await Deno.readTextFile(filePath);
        this._markdown[file.path] = raw;

        const { meta, markdown } = parseFrontmatter(raw);
        const htmlBody = await renderMarkdown(markdown, this.markdownConfig);
        const toc = extractToc(htmlBody);

        this._pageCache[file.path] = { html: htmlBody, toc, meta };
        console.log(`  ok ${file.path}`);
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  x ${file.path}: ${message}`);
        errorCount++;
      }
    }

    console.log(
      `\nPage cache built: ${successCount} pages compiled, ${errorCount} errors\n`,
    );

    if (errorCount > 0) {
      throw new Error(`Failed to compile ${errorCount} page(s)`);
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
