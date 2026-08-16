// Top-level orchestrator for the Windows editor -- direct equivalent
// of Android's EditorScreen.kt. Owns workspace/tree/open-file/nav-
// history/auto-save state and all create/rename/delete/search logic.
//
// Windows differences from Android, per the integration spec:
// - No swipe gestures; navigation back to AI is an explicit button
//   (rendered by EditorRail).
// - Explorer is a toggleable persistent side panel (not an overlay),
//   handled by ExplorerPanel.tsx.
// - No lifecycle "onResume" concept on desktop -- the resume-refresh
//   behavior we added on Android is replaced here with: refresh the
//   tree every time the Explorer panel is opened (same as Android's
//   second safety net), plus a refresh on window focus regain, which
//   is the closest desktop equivalent to "app returned to foreground."
// - This component is meant to stay mounted (hidden via CSS) rather
//   than unmounted when switching to the AI view -- App.tsx controls
//   visibility, not mount/unmount -- so no separate "session state"
//   file is needed the way Android's EditorSessionState.kt was.

import { useCallback, useEffect, useState } from "react";
import * as editorFs from "../../lib/editorFs";
import type {
  EditorNode,
  FileSearchResult,
  InlineEditState,
  NavigationHistory,
  OpenFile,
  TextSearchResult,
  WorkspaceSearchMode,
} from "../../lib/editorTypes";
import {
  canGoBack,
  canGoForward,
  emptyNavigationHistory,
  goBack,
  goForward,
  navigateTo,
} from "../../lib/editorTypes";
import { EditorRail } from "./EditorRail";
import { EditorTopBar } from "./EditorTopBar";
import { ExplorerPanel } from "./ExplorerPanel";
import { EditorMenu } from "./EditorMenu";
import { TextEditor } from "./TextEditor";

interface EditorViewProps {
  onBackToAi: () => void;
}

function findNode(node: EditorNode | null, path: string): EditorNode | null {
  if (!node) return null;
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}

function updateNode(
  node: EditorNode,
  targetPath: string,
  transform: (n: EditorNode) => EditorNode
): EditorNode {
  if (node.path === targetPath) return transform(node);
  if (node.children.length === 0) return node;
  return { ...node, children: node.children.map((c) => updateNode(c, targetPath, transform)) };
}

function isUnderOrEqual(targetPath: string, node: EditorNode): boolean {
  if (targetPath === node.path) return true;
  function search(n: EditorNode): boolean {
    if (n.path === targetPath) return true;
    return n.children.some(search);
  }
  return node.children.some(search);
}

export function EditorView({ onBackToAi }: EditorViewProps) {
  const [workspaceRoot, setWorkspaceRootState] = useState<string | null>(null);
  const [tree, setTree] = useState<EditorNode | null>(null);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [navHistory, setNavHistory] = useState<NavigationHistory>(emptyNavigationHistory);
  const [autoSave, setAutoSave] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [unsavedEdits, setUnsavedEdits] = useState<Record<string, string>>({});
  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(null);

  const [explorerOpen, setExplorerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [searchMode, setSearchMode] = useState<WorkspaceSearchMode>("file_name");
  const [highlightRequest, setHighlightRequest] = useState<TextSearchResult | null>(null);

  const refreshTree = useCallback(
    async (preserveExpansion = true) => {
      if (!workspaceRoot) return;
      const newTree = await editorFs.loadTree(workspaceRoot).catch(() => null);
      if (!newTree) return;

      if (!preserveExpansion || !tree) {
        setTree(newTree);
        return;
      }

      const expandedPaths = new Set<string>();
      (function collect(n: EditorNode) {
        if (n.isExpanded) expandedPaths.add(n.path);
        n.children.forEach(collect);
      })(tree);

      (function applyExpansion(n: EditorNode): EditorNode {
        return {
          ...n,
          isExpanded: expandedPaths.has(n.path),
          children: n.children.map(applyExpansion),
        };
      })(newTree);

      setTree(newTree);
    },
    [workspaceRoot, tree]
  );

  // Desktop equivalent of Android's onResume tree refresh: catches
  // files created/changed by another app while this window didn't
  // have focus.
  useEffect(() => {
    function onFocus() {
      refreshTree();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshTree]);

  async function setWorkspaceRoot(path: string) {
    setWorkspaceRootState(path);
    setSelectedPath(null);
    setOpenFile(null);
    setUnsupportedMessage(null);
    setNavHistory(emptyNavigationHistory);
    setUnsavedEdits({});
    const loaded = await editorFs.loadTree(path).catch(() => null);
    if (loaded) setTree({ ...loaded, isExpanded: true });
  }

  async function openFileAt(path: string, addToHistory = true) {
    const name = findNode(tree, path)?.name ?? path.split(/[\\/]/).pop() ?? path;

    if (!(path in unsavedEdits) && (await editorFs.isLikelyBinary(path).catch(() => true))) {
      setUnsupportedMessage(`"${name}" doesn't look like a text file and can't be opened here.`);
      setOpenFile(null);
      setSelectedPath(path);
      setExplorerOpen(false);
      return;
    }

    const content = unsavedEdits[path] ?? (await editorFs.readFile(path).catch(() => ""));
    setUnsupportedMessage(null);
    setOpenFile({ path, name, content, isDirty: path in unsavedEdits });
    setSelectedPath(path);
    setExplorerOpen(false);
    if (addToHistory) setNavHistory((h) => navigateTo(h, path));
  }

  function toggleExpand(path: string) {
    setTree((t) => (t ? updateNode(t, path, (n) => ({ ...n, isExpanded: !n.isExpanded })) : t));
  }

  function expandPath(path: string) {
    setTree((t) => (t ? updateNode(t, path, (n) => ({ ...n, isExpanded: true })) : t));
  }

  function selectNode(node: EditorNode) {
    if (node.isDirectory) {
      setSelectedPath(node.path);
      toggleExpand(node.path);
    } else {
      openFileAt(node.path);
    }
  }

  function resolveCreationParent(): string {
    if (!selectedPath) return workspaceRoot ?? "";
    const node = findNode(tree, selectedPath);
    if (!node) return workspaceRoot ?? "";
    return node.isDirectory ? node.path : node.parentPath ?? workspaceRoot ?? "";
  }

  function beginCreate(isDirectory: boolean) {
    const parent = resolveCreationParent();
    expandPath(parent);
    setInlineEdit({ parentPath: parent, isRename: false, isDirectory, initialText: "", error: "none" });
  }

  function beginRename(node: EditorNode) {
    setInlineEdit({
      parentPath: node.parentPath ?? "",
      isRename: true,
      isDirectory: node.isDirectory,
      existingPath: node.path,
      existingName: node.name,
      initialText: node.name,
      error: "none",
    });
  }

  async function submitInlineEdit(name: string) {
    const edit = inlineEdit;
    if (!edit) return;
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      setInlineEdit(null);
      return;
    }

    if (edit.isRename && edit.existingPath && edit.existingName) {
      if (trimmed === edit.initialText) {
        setInlineEdit(null);
        return;
      }

      const result = await editorFs.rename(edit.parentPath, edit.existingName, trimmed);
      if (result.kind === "Success") {
        const newPath = result.new_path;
        const oldPath = edit.existingPath;
        setInlineEdit(null);
        setTree((t) =>
          t ? updateNode(t, oldPath, (n) => ({ ...n, path: newPath, name: trimmed })) : t
        );
        setOpenFile((f) => (f && f.path === oldPath ? { ...f, path: newPath, name: trimmed } : f));
        setSelectedPath((p) => (p === oldPath ? newPath : p));
        refreshTree();
      } else if (result.kind === "DuplicateName") {
        setInlineEdit({ ...edit, error: "duplicate_name" });
      } else {
        setInlineEdit(null);
      }
      return;
    }

    const result = edit.isDirectory
      ? await editorFs.createFolder(edit.parentPath, trimmed)
      : await editorFs.createFile(edit.parentPath, trimmed);

    if (result.kind === "Success") {
      setInlineEdit(null);
      refreshTree();
      setSelectedPath(result.path);
    } else if (result.kind === "DuplicateName") {
      setInlineEdit({ ...edit, error: "duplicate_name" });
    } else {
      setInlineEdit(null);
    }
  }

  async function deleteNode(node: EditorNode) {
    const ok = await editorFs.deletePath(node.path);
    if (!ok) return;

    if (openFile && isUnderOrEqual(openFile.path, node)) {
      setOpenFile(null);
      setUnsupportedMessage(null);
    }
    setUnsavedEdits((edits) =>
      Object.fromEntries(Object.entries(edits).filter(([path]) => !isUnderOrEqual(path, node)))
    );
    if (selectedPath && isUnderOrEqual(selectedPath, node)) {
      setSelectedPath(node.parentPath);
    }
    refreshTree();
  }

  function onContentChange(newContent: string) {
    const current = openFile;
    if (!current) return;
    setOpenFile({ ...current, content: newContent, isDirty: true });
    setUnsavedEdits((edits) => ({ ...edits, [current.path]: newContent }));
    if (autoSave) {
      editorFs.writeFile(current.path, newContent);
      setUnsavedEdits((edits) => {
        const { [current.path]: _removed, ...rest } = edits;
        return rest;
      });
      setOpenFile((f) => (f ? { ...f, isDirty: false } : f));
    }
  }

  async function saveCurrent() {
    const current = openFile;
    if (!current) return;
    await editorFs.writeFile(current.path, current.content);
    setUnsavedEdits((edits) => {
      const { [current.path]: _removed, ...rest } = edits;
      return rest;
    });
    setOpenFile((f) => (f ? { ...f, isDirty: false } : f));
  }

  async function saveAll() {
    await Promise.all(
      Object.entries(unsavedEdits).map(([path, content]) => editorFs.writeFile(path, content))
    );
    setUnsavedEdits({});
    setOpenFile((f) => (f ? { ...f, isDirty: false } : f));
  }

  async function startNewWorkspace(createFileNotFolder: boolean) {
    if (!workspaceRoot) return;
    const uniqueName = await editorFs.uniqueWorkspaceFolderName(workspaceRoot);
    const result = await editorFs.createFolder(workspaceRoot, uniqueName);
    if (result.kind === "Success") {
      await setWorkspaceRoot(workspaceRoot);
      setSelectedPath(result.path);
      setExplorerOpen(true);
      beginCreate(!createFileNotFolder);
    }
  }

  async function handleOpenFolderDialog() {
    const picked = await editorFs.pickFolder();
    if (picked) await setWorkspaceRoot(picked);
  }

  async function handleOpenFileDialog() {
    await editorFs.pickFile();
    // Windows Open File just opens the picker; unlike Android there's
    // no SAF permission grant step needed. Deliberately not opening
    // the picked file directly into a fresh workspace here yet --
    // see note in EditorMenu.tsx wiring below.
  }

  return (
    <div className="editor-root">
      <EditorRail
        onBackToAi={onBackToAi}
        onMenuClick={() => setMenuOpen(true)}
        onExplorerClick={() => {
          if (workspaceRoot) {
            refreshTree();
            setExplorerOpen((v) => !v);
          }
        }}
        explorerOpen={explorerOpen}
      />

      <ExplorerPanel
        visible={explorerOpen && tree !== null}
        tree={tree}
        selectedPath={selectedPath}
        onToggleExpand={toggleExpand}
        onSelectNode={selectNode}
        onCreateFile={() => beginCreate(false)}
        onCreateFolder={() => beginCreate(true)}
        onRenameRequest={beginRename}
        onDeleteRequest={deleteNode}
        inlineEdit={inlineEdit}
        onSubmitInlineEdit={submitInlineEdit}
        onCancelInlineEdit={() => setInlineEdit(null)}
      />

      <div className="editor-main">
        <EditorTopBar
          canGoBack={canGoBack(navHistory)}
          canGoForward={canGoForward(navHistory)}
          onBack={() => {
            setNavHistory((h) => {
              const next = goBack(h);
              if (next.current) openFileAt(next.current, false);
              return next;
            });
          }}
          onForward={() => {
            setNavHistory((h) => {
              const next = goForward(h);
              if (next.current) openFileAt(next.current, false);
              return next;
            });
          }}
          tree={tree}
          openFileContent={openFile?.content ?? null}
          currentFileName={openFile?.name ?? null}
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
          onSelectFileResult={(r: FileSearchResult) => openFileAt(r.path)}
          onSelectTextResult={(r: TextSearchResult) => setHighlightRequest(r)}
        />

        {workspaceRoot === null ? (
          <EditorStartScreen
            onOpenFile={handleOpenFileDialog}
            onOpenFolder={handleOpenFolderDialog}
          />
        ) : unsupportedMessage !== null ? (
          <div className="editor-unsupported">{unsupportedMessage}</div>
        ) : (
          <TextEditor
            openFile={openFile}
            onContentChange={onContentChange}
            highlightRequest={highlightRequest}
            onHighlightConsumed={() => setHighlightRequest(null)}
          />
        )}
      </div>

      <EditorMenu
        visible={menuOpen}
        autoSave={autoSave}
        onAutoSaveToggle={setAutoSave}
        onNewFile={() => {
          setMenuOpen(false);
          startNewWorkspace(true);
        }}
        onNewFolder={() => {
          setMenuOpen(false);
          startNewWorkspace(false);
        }}
        onOpenFile={() => {
          setMenuOpen(false);
          handleOpenFileDialog();
        }}
        onOpenFolder={() => {
          setMenuOpen(false);
          handleOpenFolderDialog();
        }}
        onSave={() => {
          setMenuOpen(false);
          saveCurrent();
        }}
        onSaveAll={() => {
          setMenuOpen(false);
          saveAll();
        }}
        onDismiss={() => setMenuOpen(false)}
      />
    </div>
  );
}

function EditorStartScreen({
  onOpenFile,
  onOpenFolder,
}: {
  onOpenFile: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div className="editor-start">
      <h3>Start</h3>
      <button className="editor-start-action" onClick={onOpenFile}>
        Open File...
      </button>
      <button className="editor-start-action" onClick={onOpenFolder}>
        Open Folder...
      </button>
      <h3 style={{ marginTop: 16 }}>Recent</h3>
      <p className="editor-start-recent">
        You have no recent folders,{" "}
        <span className="editor-start-link" onClick={onOpenFolder}>
          open a folder
        </span>{" "}
        to start.
      </p>
    </div>
  );
}