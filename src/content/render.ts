import { unified } from "npm:unified@11.0.5";
import remarkParse from "npm:remark-parse@11.0.0";
import remarkGfm from "npm:remark-gfm@4.0.1";
import remarkFrontmatter from "npm:remark-frontmatter@5.0.0";
import remarkRehype from "npm:remark-rehype@11.1.2";
import rehypeSlug from "npm:rehype-slug@6.0.0";
import rehypeAutolinkHeadings from "npm:rehype-autolink-headings@7.1.0";
import rehypePrettyCode from "npm:rehype-pretty-code@0.14.1";
import rehypeStringify from "npm:rehype-stringify@10.0.1";
import matter from "npm:gray-matter@4.0.3";
import type { PageMeta, TocItem } from "./types.ts";

export interface MarkdownConfig {
  remarkPlugins?: any[];
  rehypePlugins?: any[];
  shiki?: {
    theme?: string;
  };
}

export async function renderMarkdown(
  md: string,
  config?: MarkdownConfig
): Promise<string> {
  // deno-lint-ignore no-explicit-any
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml"]);

  // Add custom remark plugins
  if (config?.remarkPlugins) {
    for (const plugin of config.remarkPlugins) {
      if (Array.isArray(plugin)) {
        processor = processor.use(plugin[0], plugin[1]);
      } else {
        processor = processor.use(plugin);
      }
    }
  }

  processor = processor
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: { class: "anchor-link" },
      content: { type: "text", value: "#" },
    })
    .use(rehypePrettyCode, {
      theme: config?.shiki?.theme || "github-dark",
      keepBackground: false,
    });

  // Add custom rehype plugins
  if (config?.rehypePlugins) {
    for (const plugin of config.rehypePlugins) {
      if (Array.isArray(plugin)) {
        processor = processor.use(plugin[0], plugin[1]);
      } else {
        processor = processor.use(plugin);
      }
    }
  }

  processor = processor.use(rehypeStringify);

  const file = await processor.process(md);
  return String(file);
}

export function parseFrontmatter(md: string): {
  meta: PageMeta;
  markdown: string;
} {
  const { data, content } = matter(md);
  return { meta: data as PageMeta, markdown: content };
}

export function extractToc(html: string): TocItem[] {
  const headingRegex = /<h([23])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/g;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const id = match[2];
    const text = match[3]
      .replace(/<a[^>]*class="anchor-link"[^>]*>.*?<\/a>/g, "")
      .replace(/<[^>]*>/g, "");
    toc.push({ id, text, level });
  }

  return toc;
}
