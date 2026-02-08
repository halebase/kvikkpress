export interface PageMeta {
  title?: string;
  section?: string;
  order?: number;
  visibility?: string;
  hidden?: boolean;
  [key: string]: unknown;
}

export interface ContentFile {
  path: string;
  isDir: false;
  title: string;
  order: number;
  visibility: string[];
  hidden: boolean;
  meta: PageMeta;
}

export interface ContentDir {
  path: string;
  isDir: true;
  title: string;
  order: number;
  children: ContentNode[];
  indexPath?: string;
  hidden: boolean;
}

export type ContentNode = ContentFile | ContentDir;

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface CachedPage {
  html: string;
  toc: TocItem[];
  meta: PageMeta;
}
