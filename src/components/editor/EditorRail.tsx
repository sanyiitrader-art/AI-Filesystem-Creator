// Left vertical toolbar for the Windows editor. Desktop equivalent of
// Android's EditorRail (originally a private composable inside
// EditorScreen.kt) -- pulled into its own file here since this
// project's convention is one component per file, unlike Compose's
// looser private-composable pattern.
//
// Windows addition not present on Android: an explicit "back to AI
// chat" button, since there's no swipe gesture on desktop.

import { ArrowLeft, FolderTree, Menu, Settings } from "lucide-react";

interface EditorRailProps {
  onBackToAi: () => void;
  onMenuClick: () => void;
  onExplorerClick: () => void;
  explorerOpen: boolean;
}

export function EditorRail({ onBackToAi, onMenuClick, onExplorerClick, explorerOpen }: EditorRailProps) {
  return (
    <div className="editor-rail">
      <button className="editor-rail-btn" onClick={onBackToAi} aria-label="Back to chat" title="Back to chat">
        <ArrowLeft size={18} />
      </button>

      <div className="editor-rail-divider" />

      <button className="editor-rail-btn" onClick={onMenuClick} aria-label="Menu" title="Menu">
        <Menu size={18} />
      </button>

      <button
        className={`editor-rail-btn${explorerOpen ? " editor-rail-btn-active" : ""}`}
        onClick={onExplorerClick}
        aria-label="Explorer"
        title="Explorer"
      >
        <FolderTree size={18} />
      </button>

      <div className="editor-rail-spacer" />

      <button
        className="editor-rail-btn editor-rail-btn-inert"
        aria-label="Settings"
        title="Settings"
        disabled
      >
        <Settings size={18} />
      </button>
    </div>
  );
}