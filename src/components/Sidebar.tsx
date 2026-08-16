import { useEffect, useState } from "react";
import {
  Edit3,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { ApiKeyModal } from "./ApiKeyModal";
import {
  listConversations,
  searchConversations,
  deleteConversation,
} from "../lib/tauri";
import type { ConversationSummary } from "../lib/types";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  refreshToken: number;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  refreshToken,
}: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function refresh() {
    const query = searchQuery.trim();
    const load = query ? searchConversations(query) : listConversations();
    load.then(setConversations).catch(() => setConversations([]));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, refreshToken]);

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    await deleteConversation(pendingDeleteId);
    setPendingDeleteId(null);
    refresh();
  }

  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button
          className="icon-button"
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-search-row">
          <Search size={16} className="sidebar-search-icon" />
          <input
            className="sidebar-search-input"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="icon-button"
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button
        className="sidebar-action-button"
        onClick={() => setShowApiModal(true)}
      >
        <Edit3 size={16} />
        <span>Edit API</span>
      </button>

      <button className="sidebar-action-button" onClick={onNewChat}>
        <Plus size={16} />
        <span>New Chat</span>
      </button>

      <div className="conversation-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={
              "conversation-item-row" +
              (c.id === activeConversationId ? " conversation-item-row-active" : "")
            }
          >
            <button
              className={
                "conversation-item" +
                (c.id === activeConversationId ? " conversation-item-active" : "")
              }
              onClick={() => onSelectConversation(c.id)}
            >
              {c.title || "Untitled"}
            </button>
            <button
              className="conversation-item-delete"
              onClick={() => setPendingDeleteId(c.id)}
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {showApiModal && (
        <ApiKeyModal onClose={() => setShowApiModal(false)} />
      )}

      {pendingDeleteId && (
        <div className="modal-overlay" onClick={() => setPendingDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Delete conversation?</h2>
            <p className="modal-subtitle">This can't be undone.</p>
            <div className="modal-actions">
              <button
                className="modal-button-secondary"
                onClick={() => setPendingDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="modal-button-danger"
                onClick={handleConfirmDelete}
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