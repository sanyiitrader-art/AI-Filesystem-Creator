// Shared editor data schema. Direct TypeScript port of the Android
// EditorModels.kt, adapted for plain filesystem paths instead of SAF
// content URIs (Windows has direct filesystem access -- no document
// tree layer needed).

export interface EditorNode {
  path: string;
  name: string;
  isDirectory: boolean;
  parentPath: string | null;
  // Computed once in Rust's build_node() and sent with every tree
  // load -- root is 0, each nesting level adds 1. Used directly by
  // ExplorerPanel.tsx for row indentation, so it never has to
  // re-derive depth by walking the tree itself.
  depth: number;
  children: EditorNode[];
  // isExpanded is UI state, not part of the backend's tree shape --
  // kept client-side only, same separation as the Android version
  // (Rust's EditorNode has no isExpanded field; the frontend applies
  // it when merging a fresh tree load with prior expansion state).
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