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
import type { Attachment, Conversation, Message, FsOperationResult } from "./lib/types";

function makeMessage(
  role: Message["role"],
  content: string,
  attachments: Attachment[] = []
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    created_at: new Date().toISOString(),
    liked: false,
    disliked: false,
    attachments,
  };
}

function summarizeResultsForAi(results: FsOperationResult[]): string {
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

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
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

  async function runTurn(
    historyBeforeThisTurn: Message[],
    userText: string,
    attachments: Attachment[]
  ): Promise<string> {
    const turn = await sendTurn(historyBeforeThisTurn, userText, attachments);

    if (!turn.fsRequest) return turn.replyText;

    const results = await executeFsRequest(turn.fsRequest);
    const summary = summarizeResultsForAi(results);

    const followUpHistory: Message[] = [
      ...historyBeforeThisTurn,
      makeMessage("user", userText, attachments),
      makeMessage("assistant", turn.replyText),
    ];

    const followUp = await sendTurn(followUpHistory, summary, []);
    return followUp.replyText;
  }

  async function handleSend(text: string, attachments: Attachment[]) {
    if (!conversation || sending) return;

    const userMessage = makeMessage("user", text, attachments);
    const historyBefore = conversation.messages;
    const isFirst = conversation.messages.length === 0;

    let working: Conversation = {
      ...conversation,
      title: isFirst ? deriveTitle(text) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updated_at: new Date().toISOString(),
    };

    setConversation(working);
    setSending(true);

    try {
      const assistantText = await runTurn(historyBefore, text, attachments);
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

  // Retry:
  // Remove the old response immediately so the existing loading animation
  // can appear while the new response is being generated.
  async function handleRetry(assistantMessageId: string) {
    if (!conversation || sending) return;

    const messages = conversation.messages;

    const assistantIndex = findLastIndex(
      messages,
      (m) => m.id === assistantMessageId
    );

    if (assistantIndex <= 0) return;

    const userMsg = messages[assistantIndex - 1];

    if (userMsg.role !== "user") return;

    const historyBefore = messages.slice(0, assistantIndex - 1);

    const stripped: Conversation = {
      ...conversation,
      messages: messages.slice(0, assistantIndex),
    };

    setConversation(stripped);
    setSending(true);

    try {
      const assistantText = await runTurn(
        historyBefore,
        userMsg.content,
        userMsg.attachments
      );

      const newAssistantMsg = makeMessage("assistant", assistantText);

      const updated: Conversation = {
        ...stripped,
        messages: [...stripped.messages, newAssistantMsg],
        updated_at: new Date().toISOString(),
      };

      setConversation(updated);
      await saveConversation(updated);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Something went wrong.";

      const errorMessage = makeMessage("assistant", errorText);

      const updated: Conversation = {
        ...stripped,
        messages: [...stripped.messages, errorMessage],
      };

      setConversation(updated);
      await saveConversation(updated);
    } finally {
      setSending(false);
    }
  }

  async function handleEditSave(userMessageId: string, newText: string) {
    if (!conversation || sending || !newText.trim()) return;

    const messages = conversation.messages;

    const userIndex = findLastIndex(
      messages,
      (m) => m.id === userMessageId
    );

    if (userIndex < 0) return;

    const original = messages[userIndex];

    if (original.role !== "user") return;

    const historyBefore = messages.slice(0, userIndex);

    const editedUserMsg: Message = {
      ...original,
      content: newText,
    };

    let working: Conversation = {
      ...conversation,
      messages: [...historyBefore, editedUserMsg],
      updated_at: new Date().toISOString(),
    };

    setConversation(working);
    setSending(true);

    try {
      const assistantText = await runTurn(
        historyBefore,
        newText,
        original.attachments
      );

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

  function handleLike(messageId: string) {
    if (!conversation) return;

    const updated: Conversation = {
      ...conversation,
      messages: conversation.messages.map((m) =>
        m.id === messageId
          ? { ...m, liked: !m.liked, disliked: false }
          : m
      ),
    };

    setConversation(updated);
    saveConversation(updated);
  }

  function handleDislike(messageId: string) {
    if (!conversation) return;

    const updated: Conversation = {
      ...conversation,
      messages: conversation.messages.map((m) =>
        m.id === messageId
          ? { ...m, disliked: !m.disliked, liked: false }
          : m
      ),
    };

    setConversation(updated);
    saveConversation(updated);
  }

  const messages = conversation?.messages ?? [];

  const latestUserId = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.id;

  const latestAiId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <div className="app-root">
      <div
        className="app-layout"
        style={{ display: view === "ai" ? "flex" : "none" }}
      >
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
              messages={messages}
              onSend={handleSend}
              sending={sending}
              latestUserId={latestUserId}
              latestAiId={latestAiId}
              onLike={handleLike}
              onDislike={handleDislike}
              onRetry={handleRetry}
              onSaveEdit={handleEditSave}
            />
          )}
        </div>
      </div>

      <div
        style={{
          display: view === "editor" ? "block" : "none",
          height: "100%",
        }}
      >
        <EditorView onBackToAi={() => setView("ai")} />
      </div>
    </div>
  );
}