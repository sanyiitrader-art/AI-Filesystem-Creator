// Overlay menu: New File / New Folder / Open File / Open Folder /
// Save / Save All / Auto Save. Direct port of Android's EditorMenu.kt
// -- same items, same behavior (New File/New Folder trigger the
// fresh-workspace flow via EditorView's startNewWorkspace).

import { Check } from "lucide-react";

interface EditorMenuProps {
  visible: boolean;
  autoSave: boolean;
  onAutoSaveToggle: (value: boolean) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onDismiss: () => void;
}

export function EditorMenu({
  visible,
  autoSave,
  onAutoSaveToggle,
  onNewFile,
  onNewFolder,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAll,
  onDismiss,
}: EditorMenuProps) {
  if (!visible) return null;

  return (
    <div className="editor-menu-overlay" onClick={onDismiss}>
      <div className="editor-menu" onClick={(e) => e.stopPropagation()}>
        <MenuItem label="New File" onClick={onNewFile} />
        <MenuItem label="New Folder" onClick={onNewFolder} />
        <MenuItem label="Open File" onClick={onOpenFile} />
        <MenuItem label="Open Folder" onClick={onOpenFolder} />
        <MenuItem label="Save" onClick={onSave} />
        <MenuItem label="Save All" onClick={onSaveAll} />

        <div className="editor-menu-autosave" onClick={() => onAutoSaveToggle(!autoSave)}>
          <span className={`editor-checkbox${autoSave ? " editor-checkbox-checked" : ""}`}>
            {autoSave && <Check size={12} />}
          </span>
          <span>Auto Save</span>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="editor-menu-item" onClick={onClick}>
      {label}
    </div>
  );
}