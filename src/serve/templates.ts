import nunjucks from "npm:nunjucks@^3.2.4";

/**
 * Nunjucks loader that reads templates from an in-memory object
 * instead of the filesystem. Used in production with bundled templates.
 */
class BundledLoader {
  private templates: Record<string, string>;

  constructor(templates: Record<string, string>) {
    this.templates = templates;
  }

  getSource(name: string): { src: string; path: string; noCache: boolean } {
    const src = this.templates[name];
    if (src === undefined) {
      throw new Error(`Template not found: ${name}`);
    }
    return { src, path: name, noCache: false };
  }
}

/** Create a nunjucks Environment backed by bundled template strings. */
export function createBundledEnv(
  templates: Record<string, string>,
): nunjucks.Environment {
  return new nunjucks.Environment(
    new BundledLoader(templates) as nunjucks.ILoader,
    { autoescape: true, throwOnUndefined: false },
  );
}

/** Create a nunjucks Environment backed by the filesystem (for dev mode). */
export function createFilesystemEnv(
  templatesDir: string,
): nunjucks.Environment {
  return new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templatesDir),
    { autoescape: true, throwOnUndefined: false, noCache: true },
  );
}
