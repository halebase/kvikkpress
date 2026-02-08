import type { ContentCache } from "../content/cache.ts";

export function startContentWatcher(
  contentDir: string,
  cache: ContentCache
): void {
  console.log("Starting markdown file watcher...");
  const watcher = Deno.watchFs([contentDir], { recursive: true });
  let debounceTimer: number | null = null;

  (async () => {
    for await (const e of watcher) {
      if (!e.paths.some((p) => p.endsWith(".md") && !p.includes(".git")))
        continue;

      console.log("Markdown changed:", e.paths);

      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        console.log("\nRebuilding content index...");
        try {
          await cache.rebuild();
          console.log("OK: Content index rebuilt\n");
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
