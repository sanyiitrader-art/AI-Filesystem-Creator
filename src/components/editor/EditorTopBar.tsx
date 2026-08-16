// Back/forward navigation, dual-mode Workspace/Search-Text field, and
// live results list. Direct port of Android's EditorTopBar.kt logic
// (prefix-matched file search, substring-matched in-file text search,
// the "Search Text" toggle that stays highlighted while active).

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type {
  EditorNode,
  FileSearchResult,
  TextSearchResult,
  WorkspaceSearchMode,
} from "../../lib/editorTypes";

interface EditorTopBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  tree: EditorNode | null;
  openFileContent: string | null;
  currentFileName: string | null;
  searchMode: WorkspaceSearchMode;
  onSearchModeChange: (mode: WorkspaceSearchMode) => void;
  onSelectFileResult: (result: FileSearchResult) => void;
  onSelectTextResult: (result: TextSearchResult) => void;
}

function flattenFiles(node: EditorNode | null, acc: EditorNode[]) {
  if (!node) return;
  if (!node.isDirectory) acc.push(node);
  node.children.forEach((c) => flattenFiles(c, acc));
}

export function EditorTopBar({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  tree,
  openFileContent,
  currentFileName,
  searchMode,
  onSearchModeChange,
  onSelectFileResult,
  onSelectTextResult,
}: EditorTopBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const fileResults: FileSearchResult[] =
    searchMode === "file_name" && query.trim().length > 0
      ? (() => {
          const all: EditorNode[] = [];
          flattenFiles(tree, all);
          return all
            .filter((n) => n.name.toLowerCase().startsWith(query.toLowerCase()))
            .slice(0, 50)
            .map((n) => ({ path: n.path, name: n.name, pathHint: n.parentPath ?? "" }));
        })()
      : [];

  const textResults: TextSearchResult[] =
    searchMode === "text_in_file" && query.trim().length > 0 && openFileContent !== null
      ? (() => {
          const lines = openFileContent.split("\n");
          const results: TextSearchResult[] = [];
          lines.forEach((line, index) => {
            const idx = line.toLowerCase().indexOf(query.toLowerCase());
            if (idx >= 0) {
              results.push({
                lineNumber: index + 1,
                lineText: line,
                matchStart: idx,
                matchEnd: idx + query.length,
              });
            }
          });
          return results;
        })()
      : [];

  function clearSearch() {
    setQuery("");
    setFocused(false);
  }

  return (
    <div className="editor-topbar">
      <div className="editor-topbar-row">
        <button
          className="editor-icon-btn"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="editor-icon-btn"
          onClick={onForward}
          disabled={!canGoForward}
          aria-label="Forward"
          title="Forward"
        >
          <ArrowRight size={16} />
        </button>

        <input
          className="editor-search-input"
          placeholder="Workspace"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
        />
      </div>

      {currentFileName && <div className="editor-current-filename">{currentFileName}</div>}

      {focused && query.trim().length === 0 && (
        <div
          className={`editor-search-text-toggle${searchMode === "text_in_file" ? " editor-search-text-toggle-active" : ""}`}
          onClick={() =>
            onSearchModeChange(searchMode === "text_in_file" ? "file_name" : "text_in_file")
          }
        >
          Search Text
        </div>
      )}

      {query.trim().length > 0 && (
        <div className="editor-search-results">
          {searchMode === "file_name" ? (
            fileResults.length === 0 ? (
              <div className="editor-search-empty">No Result Found</div>
            ) : (
              fileResults.map((result) => (
                <div
                  key={result.path}
                  className="editor-search-result-item"
                  onClick={() => {
                    onSelectFileResult(result);
                    clearSearch();
                  }}
                >
                  {result.name}
                </div>
              ))
            )
          ) : textResults.length === 0 ? (
            <div className="editor-search-empty">No Result Found</div>
          ) : (
            textResults.map((result, i) => (
              <div
                key={i}
                className="editor-search-result-item"
                onClick={() => {
                  onSelectTextResult(result);
                  clearSearch();
                }}
              >
                L{result.lineNumber}: {result.lineText.trim()}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}