import { walk } from "jsr:@std/fs@1/walk";
import matter from "npm:gray-matter@4.0.3";
import { capitalCase } from "npm:change-case@5.4.4";
import type { ContentNode, ContentFile, ContentDir, PageMeta } from "./types.ts";

export async function buildContentIndex(contentDir: string): Promise<ContentNode[]> {
  const allFiles: Array<{ path: string; meta: PageMeta; hasContent: boolean }> = [];

  for await (const entry of walk(contentDir, {
    includeDirs: false,
    exts: [".md"],
  })) {
    const content = await Deno.readTextFile(entry.path);
    const { data, content: markdown } = matter(content);
    const meta = data as PageMeta;
    const hasContent = markdown.trim().length > 0;

    // Normalize: walk() may return paths with or without ./ prefix
    const normalizedDir = contentDir.replace(/^\.\//, "");
    const relativePath = entry.path
      .replace(new RegExp(`^(\\.\\/)?(${normalizedDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\/?`), "")
      .replace(/\.md$/, "");
    const parts = relativePath.split("/");
    const fileName = parts[parts.length - 1];

    let path: string;
    if (fileName === "index") {
      const folderParts = parts.slice(0, -1);
      path = folderParts.length === 0 ? "/" : `/${folderParts.join("/")}`;
    } else {
      path = `/${relativePath}`;
    }

    allFiles.push({ path, meta, hasContent });
  }

  return buildTree(allFiles);
}

function buildTree(
  allFiles: Array<{ path: string; meta: PageMeta; hasContent: boolean }>
): ContentNode[] {
  const tree: ContentNode[] = [];
  const folderMap = new Map<string, ContentDir>();

  for (const file of allFiles) {
    const parts = file.path.split("/").filter((p) => p);

    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = `/${parts.slice(0, i + 1).join("/")}`;
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, {
          path: folderPath,
          isDir: true,
          title: capitalCase(parts[i]),
          order: 999,
          children: [],
          hidden: false,
        });
      }
    }
  }

  for (const file of allFiles) {
    const parts = file.path.split("/").filter((p) => p);
    const visibility = file.meta.visibility
      ? String(file.meta.visibility)
          .split(",")
          .map((v) => v.trim())
      : [];
    const hidden = file.meta.hidden === true;

    if (file.path === "/") {
      if (file.hasContent) {
        tree.push({
          path: "/",
          isDir: false,
          title: file.meta.title || "Index",
          order: file.meta.order || 999,
          visibility,
          hidden,
          meta: file.meta,
        });
      }
      continue;
    }

    const folder = folderMap.get(file.path);
    if (folder) {
      folder.title = file.meta.title || folder.title;
      folder.order = file.meta.order || 999;
      folder.hidden = hidden;
      if (file.hasContent) {
        folder.indexPath = file.path;
      }
    } else if (file.hasContent) {
      const parentPath =
        parts.length === 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
      const parent = folderMap.get(parentPath);
      const node: ContentFile = {
        path: file.path,
        isDir: false,
        title: file.meta.title || capitalCase(parts[parts.length - 1]),
        order: file.meta.order || 999,
        visibility,
        hidden,
        meta: file.meta,
      };
      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    }
  }

  for (const [path, folder] of folderMap) {
    const parts = path.split("/").filter((p) => p);
    if (parts.length === 1) {
      tree.push(folder);
    } else {
      const parentPath = `/${parts.slice(0, -1).join("/")}`;
      const parent = folderMap.get(parentPath);
      if (parent) {
        parent.children.push(folder);
      }
    }
  }

  sortNodes(tree);
  return tree;
}

function sortNodes(nodes: ContentNode[]): void {
  nodes.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title);
  });

  for (const node of nodes) {
    if (node.isDir) {
      sortNodes(node.children);
    }
  }
}

export function flattenForSidebar(
  nodes: ContentNode[],
  filter?: string[]
): Array<{ path: string; title: string }> {
  const result: Array<{ path: string; title: string }> = [];

  for (const node of nodes) {
    if (node.isDir) {
      if (node.indexPath) {
        result.push({ path: node.indexPath, title: node.title });
      }
      result.push(...flattenForSidebar(node.children, filter));
    } else {
      if (filter && node.visibility.length > 0) {
        const hasMatch = node.visibility.some((v) => filter.includes(v));
        if (!hasMatch) continue;
      }
      result.push({ path: node.path, title: node.title });
    }
  }

  return result;
}
