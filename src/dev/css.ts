// Ensure tailwindcss is available in node_modules for CSS @import resolution.
// The Tailwind CLI resolves @import "tailwindcss" via Node module resolution,
// so the package must exist in the project's node_modules directory.
import "npm:tailwindcss@^4";

export interface CssConfig {
  /** Source CSS file (e.g. with @import "tailwindcss") */
  input: string;
  /** Output path for built CSS */
  output: string;
  /** Tailwind config path. Defaults to ./tailwind.config.js */
  tailwindConfig?: string;
}

function tailwindArgs(config: CssConfig, extra: string[]): string[] {
  const args = [
    "run", "--node-modules-dir",
    "--allow-read", "--allow-write", "--allow-env", "--allow-ffi",
    "npm:@tailwindcss/cli@^4",
    "-i", config.input,
    "-o", config.output,
    ...extra,
  ];
  if (config.tailwindConfig) {
    args.push("-c", config.tailwindConfig);
  }
  return args;
}

/** One-shot CSS build (minified). Run at build time. */
export async function buildCss(config: CssConfig): Promise<void> {
  const cmd = new Deno.Command("deno", {
    args: tailwindArgs(config, ["--minify"]),
    stdout: "inherit",
    stderr: "inherit",
  });

  const result = await cmd.output();
  if (!result.success) {
    throw new Error("CSS build failed");
  }
}

/** Start CSS watcher for dev mode. Returns the child process. */
export function watchCss(config: CssConfig): Deno.ChildProcess {
  const cmd = new Deno.Command("deno", {
    args: tailwindArgs(config, ["--watch"]),
    stdout: "inherit",
    stderr: "inherit",
  });

  return cmd.spawn();
}
