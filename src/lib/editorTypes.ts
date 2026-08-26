export interface EditorNode {
  path: string;
  name: string;
  isDirectory: boolean;
  parentPath: string | null;
  depth: number;
  children: EditorNode[];
  isExpanded: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

export interface NavigationHistory {
  back: string[];
  current: string | null;
  forward: string[];
}

export const emptyNavigationHistory: NavigationHistory = {
  back: [],
  current: null,
  forward: [],
};

export function navigateTo(history: NavigationHistory, path: string): NavigationHistory {
  const newBack = history.current !== null ? [...history.back, history.current] : history.back;
  return { back: newBack, current: path, forward: [] };
}

export function goBack(history: NavigationHistory): NavigationHistory {
  if (history.back.length === 0) return history;
  const newCurrent = history.back[history.back.length - 1];
  const newForward = history.current !== null ? [history.current, ...history.forward] : history.forward;
  return { back: history.back.slice(0, -1), current: newCurrent, forward: newForward };
}

export function goForward(history: NavigationHistory): NavigationHistory {
  if (history.forward.length === 0) return history;
  const newCurrent = history.forward[0];
  const newBack = history.current !== null ? [...history.back, history.current] : history.back;
  return { back: newBack, current: newCurrent, forward: history.forward.slice(1) };
}

export function canGoBack(history: NavigationHistory): boolean {
  return history.back.length > 0;
}

export function canGoForward(history: NavigationHistory): boolean {
  return history.forward.length > 0;
}

export interface FileSearchResult {
  path: string;
  name: string;
  pathHint: string;
}

export interface TextSearchResult {
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export type WorkspaceSearchMode = "file_name" | "text_in_file";

export type CreationErrorState = "none" | "duplicate_name";

export interface InlineEditState {
  parentPath: string;
  isRename: boolean;
  isDirectory: boolean;
  existingPath?: string;
  existingName?: string;
  initialText: string;
  error: CreationErrorState;
}

export const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "jpe", "jif", "jfif", "jfi", "png", "gif", "webp", "avif", "tiff", "tif",
  "bmp", "dib", "heif", "heic", "ico", "svg", "svgz", "ai", "eps", "pdf", "jp2", "j2k", "jpf",
  "jpx", "jpm", "mj2", "jxl", "bpg", "dng", "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf",
  "sr2", "raf", "orf", "rw2", "pef", "psd", "pdn", "xcf", "ind", "indd", "indt", "pbm", "pgm",
  "ppm", "ras", "rgb", "tga",
]);

export function isImageExtension(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg", jfif: "image/jpeg", jfi: "image/jpeg", jif: "image/jpeg",
  png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  bmp: "image/bmp", dib: "image/bmp", ico: "image/x-icon",
  svg: "image/svg+xml", svgz: "image/svg+xml",
  tiff: "image/tiff", tif: "image/tiff",
};

export function mimeForExtension(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}