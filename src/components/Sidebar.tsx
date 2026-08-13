// Left sidebar (spec sections 27-29): Edit API button (same size as
// New Chat, positioned above it), New Chat, search-saved-conversations,
// panel toggle, and the conversation list itself. No Home tab, no
// account/profile area, no navigation tabs -- all removed per spec.

import { useEffect, useState } from "react";
import { Pencil, Plus, Search, PanelLeftClose, PanelLeft } from "lucide-react";
import { ApiKeyModal } from "./ApiKeyModal";
import { listConversations, searchConversations } from "../lib/tauri";
import type { ConversationSummary } from "../lib/types";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  /** Bumped by App.tsx whenever a conversation is created/renamed/saved,
   *  so the list refreshes without the sidebar owning save logic itself. */
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

  useEffect(() => {
    const query = searchQuery.trim();
    const load = query ? searchConversations(query) : listConversations();
    load.then(setConversations).catch(() => setConversations([]));
  }, [searchQuery, refreshToken]);

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
        <Pencil size={16} />
        <span>Edit API</span>
      </button>

      <button className="sidebar-action-button" onClick={onNewChat}>
        <Plus size={16} />
        <span>New Chat</span>
      </button>

      <div className="conversation-list">
        {conversations.map((c) => (
          <button
            key={c.id}
            className={
              "conversation-item" +
              (c.id === activeConversationId ? " conversation-item-active" : "")
            }
            onClick={() => onSelectConversation(c.id)}
          >
            {c.title || "Untitled"}
          </button>
        ))}
      </div>

      {showApiModal && (
        <ApiKeyModal onClose={() => setShowApiModal(false)} />
      )}
    </div>
  );
}