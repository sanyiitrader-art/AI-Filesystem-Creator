// Top-level layout and orchestrator (spec section 2's full pipeline).
// Owns the active conversation's messages, drives the send flow:
// user message -> aiClient.sendTurn -> optional executeFsRequest ->
// structured result folded back to the AI as context -> persisted via
// saveConversation. Wires Sidebar and ChatArea together.
//
// Also owns the AI <-> editor view switch. EditorView stays mounted
// at all times once entered (hidden via CSS, not unmounted) so its
// internal state -- workspace, open file, nav history, auto save,
// unsaved edits -- survives switching back to the AI screen.

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { EditorView } from "./components/editor/EditorView";
import { sendTurn } from "./lib/aiClient";
import {
  createConversation,
  executeFsRequest,
  getConversation,
  saveConversation,
} from "./lib/tauri";
import type { Attachment, Conversation, Message } from "./lib/types";

function makeMessage(role: Message["role"], content: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    created_at: new Date().toISOString(),
  };
}

function summarizeResultsForAi(
  results: Awaited<ReturnType<typeof executeFsRequest>>
): string {
  const lines: string[] = [];
  for (const r of results) {
    for (const d of r.created_directories) {
      lines.push(`Created directory: ${r.root_path}\\${d}`);
    }
    for (const f of r.created_files) {
      lines.push(`Created file: ${r.root_path}\\${f}`);
    }
    for (const e of r.errors) {
      lines.push(
        `Failed (${e.error}) for ${e.item_kind} "${r.root_path}\\${e.path}"`
      );
    }
  }
  return lines.length > 0
    ? `[Execution result]\n${lines.join("\n")}`
    : "[Execution result]\nNo items were created.";
}

function deriveTitle(firstUserText: string): string {
  const trimmed = firstUserText.trim();
  if (!trimmed) return "New chat";
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed;
}

type TopLevelView = "ai" | "editor";

export default function App() {
  const [view, setView] = useState<TopLevelView>("ai");
  const [collapsed, setCollapsed] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    createConversation().then(setConversation).catch(() => {});
  }, []);

  async function handleNewChat() {
    const fresh = await createConversation();
    setConversation(fresh);
    setRefreshToken((t) => t + 1);
  }

  async function handleSelectConversation(id: string) {
    const loaded = await getConversation(id);
    setConversation(loaded);
  }

  async function persist(updated: Conversation) {
    await saveConversation(updated);
    setRefreshToken((t) => t + 1);
  }

  async function handleSend(text: string, attachments: Attachment[]) {
    if (!conversation || sending) return;

    const displayText =
      attachments.length > 0
        ? `${text}${text ? "\n" : ""}[Attached: ${attachments
            .map((a) => a.name)
            .join(", ")}]`
        : text;

    const userMessage = makeMessage("user", displayText || text);
    const isFirstMessage = conversation.messages.length === 0;

    const historyBeforeThisTurn = conversation.messages;

    let working: Conversation = {
      ...conversation,
      title: isFirstMessage ? deriveTitle(text) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updated_at: new Date().toISOString(),
    };
    setConversation(working);
    setSending(true);

    try {
      const turn = await sendTurn(historyBeforeThisTurn, text, attachments);
      let assistantText = turn.replyText;

      if (turn.fsRequest) {
        const results = await executeFsRequest(turn.fsRequest);
        const summary = summarizeResultsForAi(results);

        const followUpHistory: Message[] = [
          ...historyBeforeThisTurn,
          userMessage,
          makeMessage("assistant", turn.replyText),
        ];
        const followUp = await sendTurn(followUpHistory, summary, []);
        assistantText = followUp.replyText;
      }

      const assistantMessage = makeMessage("assistant", assistantText);
      working = {
        ...working,
        messages: [...working.messages, assistantMessage],
        updated_at: new Date().toISOString(),
      };
      setConversation(working);
      await persist(working);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Something went wrong.";
      const errorMessage = makeMessage("assistant", errorText);
      working = {
        ...working,
        messages: [...working.messages, errorMessage],
      };
      setConversation(working);
      await persist(working);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="app-root">
      <div className="app-layout" style={{ display: view === "ai" ? "flex" : "none" }}>
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          activeConversationId={conversation?.id ?? null}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          refreshToken={refreshToken}
        />
        <div className="app-ai-column">
          <div className="app-ai-topbar">
            <button
              className="app-editor-entry-btn"
              onClick={() => setView("editor")}
              aria-label="Open editor"
              title="Open editor"
            >
              <FileText size={18} />
            </button>
          </div>
          {conversation && (
            <ChatArea
              messages={conversation.messages}
              onSend={handleSend}
              sending={sending}
            />
          )}
        </div>
      </div>

      <div style={{ display: view === "editor" ? "block" : "none", height: "100%" }}>
        <EditorView onBackToAi={() => setView("ai")} />
      </div>
    </div>
  );
}