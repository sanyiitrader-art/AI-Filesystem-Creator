// Toggleable desktop side panel -- opens beside the left rail (never
// overlapping it), stays open until explicitly toggled closed, and
// uses right-click for context actions instead of Android's
// long-press. Everything else (tree indentation, expand/collapse,
// inline create/rename field rendered in place of the actual row,
// duplicate-name shake, delete confirmation) is preserved from
// ExplorerSidebar.kt.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, File, Folder, FolderPlus, FilePlus } from "lucide-react";
import type { EditorNode, InlineEditState } from "../../lib/editorTypes";

interface ExplorerPanelProps {
  visible: boolean;
  tree: EditorNode | null;
  selectedPath: string | null;
  onToggleExpand: (path: string) => void;
  onSelectNode: (node: EditorNode) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameRequest: (node: EditorNode) => void;
  onDeleteRequest: (node: EditorNode) => void;
  inlineEdit: InlineEditState | null;
  onSubmitInlineEdit: (name: string) => void;
  onCancelInlineEdit: () => void;
}

function flattenVisible(node: EditorNode): EditorNode[] {
  const result: EditorNode[] = [];
  function walk(n: EditorNode, includeSelf: boolean) {
    if (includeSelf) result.push(n);
    if (n.isDirectory && n.isExpanded) n.children.forEach((c) => walk(c, true));
  }
  node.children.forEach((c) => walk(c, true));
  return result;
}

export function ExplorerPanel({
  visible,
  tree,
  selectedPath,
  onToggleExpand,
  onSelectNode,
  onCreateFile,
  onCreateFolder,
  onRenameRequest,
  onDeleteRequest,
  inlineEdit,
  onSubmitInlineEdit,
  onCancelInlineEdit,
}: ExplorerPanelProps) {
  const [contextMenuNode, setContextMenuNode] = useState<EditorNode | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<EditorNode | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [shaking, setShaking] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  const editKey = inlineEdit
    ? `${inlineEdit.isRename}|${inlineEdit.existingPath}|${inlineEdit.parentPath}|${inlineEdit.isDirectory}`
    : null;

  useEffect(() => {
    if (!inlineEdit) return;
    if (inlineEdit.isRename) {
      const name = inlineEdit.initialText;
      const dotIndex = !inlineEdit.isDirectory ? name.lastIndexOf(".") : -1;
      setFieldValue(name);
      // Pre-select up to (not including) the extension for files,
      // whole name for folders -- same as Android's initial selection.
      requestAnimationFrame(() => {
        fieldRef.current?.focus();
        fieldRef.current?.setSelectionRange(0, dotIndex > 0 ? dotIndex : name.length);
      });
    } else {
      setFieldValue("");
      requestAnimationFrame(() => fieldRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);

  useEffect(() => {
    if (inlineEdit?.error === "duplicate_name") {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(t);
    }
  }, [inlineEdit?.error]);

  function commitOrCancel() {
    if (!inlineEdit) return;
    const trimmed = fieldValue.trim();
    if (trimmed.length === 0) onCancelInlineEdit();
    else onSubmitInlineEdit(trimmed);
  }

  function handleFieldKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitOrCancel();
    } else if (e.key === "Escape") {
      onCancelInlineEdit();
    }
  }

  function openContextMenu(e: React.MouseEvent, node: EditorNode) {
    e.preventDefault();
    setContextMenuNode(node);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }

  function closeContextMenu() {
    setContextMenuNode(null);
    setContextMenuPos(null);
  }

  if (!visible) return null;

  const visibleNodes = tree ? flattenVisible(tree) : [];

  return (
    <div className="explorer-panel" onClick={() => contextMenuNode && closeContextMenu()}>
      <div className="explorer-panel-toolbar">
        <button className="editor-icon-btn" onClick={onCreateFolder} title="New Folder" aria-label="New Folder">
          <FolderPlus size={16} />
        </button>
        <button className="editor-icon-btn" onClick={onCreateFile} title="New File" aria-label="New File">
          <FilePlus size={16} />
        </button>
      </div>

      <div
        className="explorer-panel-tree"
        onClick={(e) => {
          // Tapping empty space commits/discards the active inline
          // edit, same as the Android upgrade -- but only when the
          // click didn't originate on a row or the field itself.
          if (e.target === e.currentTarget && inlineEdit) commitOrCancel();
        }}
      >
        {visibleNodes.map((node) => {
          const isRenamingThisNode =
            inlineEdit?.isRename && inlineEdit.existingPath === node.path;

          if (isRenamingThisNode) {
            return (
              <InlineField
                key={node.path}
                depth={node.depth ?? 0}
                value={fieldValue}
                onChange={setFieldValue}
                onKeyDown={handleFieldKeyDown}
                shaking={shaking}
                inputRef={fieldRef}
              />
            );
          }

          return (
            <div key={node.path}>
              <ExplorerRow
                node={node}
                isSelected={node.path === selectedPath}
                onClick={() => onSelectNode(node)}
                onContextMenu={(e) => openContextMenu(e, node)}
              />
              {inlineEdit && !inlineEdit.isRename && inlineEdit.parentPath === node.path && (
                <InlineField
                  depth={(node.depth ?? 0) + 1}
                  value={fieldValue}
                  onChange={setFieldValue}
                  onKeyDown={handleFieldKeyDown}
                  shaking={shaking}
                  inputRef={fieldRef}
                />
              )}
            </div>
          );
        })}

        {inlineEdit && !inlineEdit.isRename && tree && inlineEdit.parentPath === tree.path && (
          <InlineField
            depth={1}
            value={fieldValue}
            onChange={setFieldValue}
            onKeyDown={handleFieldKeyDown}
            shaking={shaking}
            inputRef={fieldRef}
          />
        )}

        <div className="explorer-panel-blank-zone" />
      </div>

      {contextMenuNode && contextMenuPos && (
        <div
          className="explorer-context-menu"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`explorer-context-item${contextMenuNode.isDirectory ? "" : " explorer-context-item-disabled"}`}
            onClick={() => {
              if (contextMenuNode.isDirectory) {
                onSelectNode(contextMenuNode);
                onCreateFile();
              }
              closeContextMenu();
            }}
          >
            New File
          </div>
          <div
            className="explorer-context-item"
            onClick={() => {
              onRenameRequest(contextMenuNode);
              closeContextMenu();
            }}
          >
            Rename
          </div>
          <div
            className="explorer-context-item explorer-context-item-danger"
            onClick={() => {
              setPendingDeleteNode(contextMenuNode);
              closeContextMenu();
            }}
          >
            Delete
          </div>
        </div>
      )}

      {pendingDeleteNode && (
        <div className="editor-dialog-overlay" onClick={() => setPendingDeleteNode(null)}>
          <div className="editor-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Delete "{pendingDeleteNode.name}"?</h4>
            <p>
              {pendingDeleteNode.isDirectory
                ? "This folder and everything inside it will be deleted. This can't be undone."
                : "This can't be undone."}
            </p>
            <div className="editor-dialog-actions">
              <button className="editor-dialog-cancel" onClick={() => setPendingDeleteNode(null)}>
                Cancel
              </button>
              <button
                className="editor-dialog-delete"
                onClick={() => {
                  onDeleteRequest(pendingDeleteNode);
                  setPendingDeleteNode(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExplorerRow({
  node,
  isSelected,
  onClick,
  onContextMenu,
}: {
  node: EditorNode;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const depth = node.depth ?? 0;
  return (
    <div
      className={`explorer-row${isSelected ? " explorer-row-selected" : ""}`}
      style={{ paddingLeft: depth * 16 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {node.isDirectory ? (
        <>
          {node.isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
          <Folder size={14} className="explorer-row-folder-icon" />
        </>
      ) : (
        <File size={14} className="explorer-row-file-icon" style={{ marginLeft: 20 }} />
      )}
      <span className="explorer-row-name">{node.name}</span>
    </div>
  );
}

function InlineField({
  depth,
  value,
  onChange,
  onKeyDown,
  shaking,
  inputRef,
}: {
  depth: number;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  shaking: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      className={`explorer-inline-field${shaking ? " explorer-inline-field-shake" : ""}`}
      style={{ marginLeft: depth * 16 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}