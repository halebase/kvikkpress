import type { ContentCache } from "../content/cache.ts";

/**
 * Map a filesystem path to a KvikkPress page pathname.
 * e.g. "./content/guides/quick-start.md" → "/guides/quick-start"
 *      "./content/index.md" → "/"
 *      "./content/guides/index.md" → "/guides"
 *
 * Handles both relative and absolute paths from Deno.watchFs.
 */
function filePathToPagePath(
  absoluteContentDir: string,
  filePath: string,
): string | null {
  if (!filePath.startsWith(absoluteContentDir + "/")) return null;

  const relative = filePath
    .slice(absoluteContentDir.length + 1)
    .replace(/\.md$/, "");

  if (relative === "index") return "/";
  if (relative.endsWith("/index")) {
    return "/" + relative.slice(0, -"/index".length);
  }
  return "/" + relative;
}

export function startContentWatcher(
  contentDir: string,
  cache: ContentCache,
): void {
  console.log("Starting markdown file watcher...");
  const absoluteContentDir = Deno.realPathSync(contentDir);
  const watcher = Deno.watchFs([contentDir], { recursive: true });
  let debounceTimer: number | null = null;

  (async () => {
    for await (const e of watcher) {
      const mdPaths = e.paths.filter(
        (p) => p.endsWith(".md") && !p.includes(".git"),
      );
      if (mdPaths.length === 0) continue;

      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          if (e.kind === "modify") {
            // Incremental: re-compile changed pages, rebuild sidebar
            for (const path of mdPaths) {
              const pagePath = filePathToPagePath(absoluteContentDir, path);
              if (pagePath) {
                console.log(`\nUpdating ${pagePath}...`);
                await cache.updatePage(pagePath);
              }
            }
            await cache.rebuildIndex();
          } else {
            // Create/remove: rebuild everything
            console.log("\nRebuilding content index...");
            await cache.rebuild();
          }
          console.log("OK: Content rebuilt\n");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(`FAILED: Rebuild failed: ${message}\n`);
        }
        debounceTimer = null;
      }, 300);
    }
  })();
}
