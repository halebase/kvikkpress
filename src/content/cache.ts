import { buildContentIndex, flattenForSidebar } from "./discovery.ts";
import { renderMarkdown, parseFrontmatter, extractToc } from "./render.ts";
import type { MarkdownConfig } from "./render.ts";
import type { ContentNode, CachedPage } from "./types.ts";

export class ContentCache {
  private contentDir: string;
  private markdownConfig?: MarkdownConfig;
  private _contentIndex: ContentNode[] = [];
  private _pageCache = new Map<string, CachedPage>();

  constructor(contentDir: string, markdownConfig?: MarkdownConfig) {
    this.contentDir = contentDir;
    this.markdownConfig = markdownConfig;
  }

  get contentIndex(): ContentNode[] {
    return this._contentIndex;
  }

  get pageCache(): Map<string, CachedPage> {
    return this._pageCache;
  }

  async build(): Promise<void> {
    console.log("Building content index...");
    this._contentIndex = await buildContentIndex(this.contentDir);
    console.log(`Found ${this._contentIndex.length} top-level items`);
    await this.buildPageCache();
  }

  async rebuild(): Promise<void> {
    this._contentIndex = await buildContentIndex(this.contentDir);
    await this.buildPageCache();
  }

  private async buildPageCache(): Promise<void> {
    console.log("\nBuilding page cache...");
    const allFiles = flattenForSidebar(this._contentIndex);

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

        const md = await Deno.readTextFile(filePath);
        const { meta, markdown } = parseFrontmatter(md);
        const htmlBody = await renderMarkdown(markdown, this.markdownConfig);
        const toc = extractToc(htmlBody);

        this._pageCache.set(file.path, { html: htmlBody, toc, meta });
        console.log(`  ok ${file.path}`);
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  x ${file.path}: ${message}`);
        errorCount++;
      }
    }

    console.log(
      `\nPage cache built: ${successCount} pages compiled, ${errorCount} errors\n`
    );

    if (errorCount > 0) {
      throw new Error(`Failed to compile ${errorCount} page(s)`);
    }
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
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
