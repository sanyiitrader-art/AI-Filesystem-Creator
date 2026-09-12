import { useState } from "react";
import { Copy, Edit2, RefreshCw, ThumbsDown, ThumbsUp, Paperclip, Download } from "lucide-react";
import { highlightSyntax, isHighlightableExtension } from "../lib/syntaxHighlighter";
import { parseInline, type InlineSegment } from "../lib/markdownInline";
import type { Message as MessageType, Attachment } from "../lib/types";

interface MessageBubbleProps {
  message: MessageType;
  isLatestUserMessage?: boolean;
  isLatestAiMessage?: boolean;
  onLike?: () => void;
  onDislike?: () => void;
  onRetry?: () => void;
  onSaveEdit?: (newText: string) => void;
}

export function MessageBubble({
  message,
  isLatestUserMessage = false,
  isLatestAiMessage = false,
  onLike = () => {},
  onDislike = () => {},
  onRetry = () => {},
  onSaveEdit = () => {},
}: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <UserMessage
        message={message}
        isLatest={isLatestUserMessage}
        onSaveEdit={onSaveEdit}
      />
    );
  }
  return (
    <AiMessage
      message={message}
      isLatest={isLatestAiMessage}
      onLike={onLike}
      onDislike={onDislike}
      onRetry={onRetry}
    />
  );
}

// Renders parseInline()'s flat InlineSegment[] (text + bold/italic/
// strike/code/href booleans) as JSX -- lives here rather than in
// markdownInline.ts because that file is plain .ts and can't contain
// JSX; this keeps that file as the single source of truth for the
// parsing logic while this component owns only the rendering.
function renderInlineSegments(text: string, keyPrefix: string): JSX.Element[] {
  return parseInline(text).map((seg: InlineSegment, idx: number) => {
    const key = `${keyPrefix}-${idx}`;

    if (seg.code) {
      return (
        <span key={key} className="inline-token">
          {seg.text}
        </span>
      );
    }

    if (seg.href) {
      const url = seg.href;
      return (
        
          key={key}
          href={url}
          className="message-link"
          onClick={(e) => {
            e.preventDefault();
            window.open(url, "_blank");
          }}
        >
          {seg.text}
        </a>
      );
    }

    let node: JSX.Element = <>{seg.text}</>;
    if (seg.bold) node = <strong>{node}</strong>;
    if (seg.italic) node = <em>{node}</em>;
    if (seg.strike) node = <s>{node}</s>;
    return <span key={key}>{node}</span>;
  });
}

function UserMessage({
  message,
  isLatest,
  onSaveEdit,
}: {
  message: MessageType;
  isLatest: boolean;
  onSaveEdit: (newText: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showAttachments, setShowAttachments] = useState(false);

  function startEdit() {
    setEditText(message.content);
    setIsEditing(true);
  }

  return (
    <div className="message-row message-row-user">
      {message.attachments.length > 0 && (
        <div className="attachment-indicator" onClick={() => setShowAttachments(true)}>
          <Paperclip size={12} />
          <span>
            {message.attachments.length} attached file{message.attachments.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {isEditing ? (
        <div className="message-edit-box">
          <textarea
            className="message-edit-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
          />
          <div className="message-edit-actions">
            <button
              className="message-edit-discard"
              onClick={() => {
                setEditText(message.content);
                setIsEditing(false);
              }}
            >
              Discard
            </button>
            <button
              className="message-edit-save"
              onClick={() => {
                setIsEditing(false);
                onSaveEdit(editText.trim());
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className="message-bubble-wrapper"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {hovered && (
            <div className="message-hover-actions message-hover-actions-user">
              <button
                className="message-hover-btn"
                title="Copy"
                onClick={() => navigator.clipboard.writeText(message.content)}
              >
                <Copy size={13} />
              </button>
              <button
                className="message-hover-btn"
                title={isLatest ? "Edit" : "Only the latest prompt can be edited"}
                disabled={!isLatest}
                onClick={startEdit}
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}
          <div className="message-bubble">{message.content}</div>
        </div>
      )}

      {showAttachments && (
        <AttachmentListDialog
          attachments={message.attachments}
          onClose={() => setShowAttachments(false)}
        />
      )}
    </div>
  );
}

function AiMessage({
  message,
  isLatest,
  onLike,
  onDislike,
  onRetry,
}: {
  message: MessageType;
  isLatest: boolean;
  onLike: () => void;
  onDislike: () => void;
  onRetry: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (message.is_stopped) {
    return (
      <div
        className="message-row message-row-assistant"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="message-stopped-text">You stopped this response.</div>
        <div className={`message-action-row${hovered ? " message-action-row-visible" : ""}`}>
          <button
            className="message-hover-btn"
            title={isLatest ? "Retry" : "Only the latest response can be retried"}
            disabled={!isLatest}
            onClick={onRetry}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="message-row message-row-assistant"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FormattedContent text={message.content} />

      <div className={`message-action-row${hovered ? " message-action-row-visible" : ""}`}>
        <button
          className="message-hover-btn"
          title="Copy"
          onClick={() => navigator.clipboard.writeText(message.content)}
        >
          <Copy size={14} />
        </button>
        <button className="message-hover-btn" title="Like" onClick={onLike}>
          <ThumbsUp size={14} color={message.liked ? "var(--color-mint)" : undefined} />
        </button>
        <button className="message-hover-btn" title="Dislike" onClick={onDislike}>
          <ThumbsDown size={14} color={message.disliked ? "var(--color-mint)" : undefined} />
        </button>
        <button
          className="message-hover-btn"
          title={isLatest ? "Retry" : "Only the latest response can be retried"}
          disabled={!isLatest}
          onClick={onRetry}
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

function extensionForLanguage(language: string): string {
  const key = language.trim().toLowerCase();
  const map: Record<string, string> = {
    python: "py", py: "py", kotlin: "kt", kt: "kt",
    javascript: "js", js: "js", typescript: "ts", ts: "ts",
    java: "java", c: "c", cpp: "cpp", "c++": "cpp",
    csharp: "cs", "c#": "cs", cs: "cs", html: "html", css: "css",
    json: "json", bash: "sh", sh: "sh", shell: "sh", sql: "sql",
    ruby: "rb", rb: "rb", php: "php", go: "go", rust: "rs", rs: "rs",
    swift: "swift", xml: "xml", yaml: "yml", yml: "yml",
  };
  return map[key] ?? "txt";
}

function downloadCodeSnippet(language: string, code: string) {
  const ext = extensionForLanguage(language);
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `snippet_${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CodeBlock({ language, codeText }: { language: string; codeText: string }) {
  const ext = extensionForLanguage(language);
  const segments = isHighlightableExtension(ext)
    ? highlightSyntax(codeText, ext)
    : [{ text: codeText, className: null as string | null }];
  const lineCount = codeText.split("\n").length;

  return (
    <div className="message-code-block">
      <div className="message-code-header">
        <span className="message-code-lang">{language}</span>
        <div className="message-code-actions">
          <button
            className="message-code-btn"
            title="Copy code"
            onClick={() => navigator.clipboard.writeText(codeText)}
          >
            <Copy size={13} />
          </button>
          <button
            className="message-code-btn"
            title="Download code"
            onClick={() => downloadCodeSnippet(language, codeText)}
          >
            <Download size={13} />
          </button>
        </div>
      </div>
      <div className="message-code-block-inner">
        <div className="message-code-gutter">
          {Array.from({ length: lineCount }, (_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>
        <div className="message-code-body-scroll">
          <pre>
            <code>
              {segments.map((seg, idx) =>
                seg.className ? (
                  <span key={idx} className={seg.className}>
                    {seg.text}
                  </span>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}

function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const language = line.trim().replace(/^```/, "").trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(<CodeBlock key={key++} language={language} codeText={codeLines.join("\n")} />);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const HeadingTag = (`h${Math.min(level + 2, 6)}` as unknown) as "h3";
      blocks.push(
        <HeadingTag className="message-heading" key={key++}>
          {renderInlineSegments(headingMatch[2], `h${key}`)}
        </HeadingTag>
      );
      i++;
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const quoteKey = key++;
      blocks.push(
        <blockquote className="message-blockquote" key={quoteKey}>
          {quoteLines.map((l, idx) => (
            <span key={idx}>
              {renderInlineSegments(l, `bq${quoteKey}-${idx}`)}
              {idx < quoteLines.length - 1 && <br />}
            </span>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      const listKey = key++;
      blocks.push(
        <ul className="message-list" key={listKey}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineSegments(item, `li${listKey}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^#{1,6}\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraKey = key++;
    blocks.push(
      <p className="message-paragraph" key={paraKey}>
        {paraLines.map((l, idx) => (
          <span key={idx}>
            {renderInlineSegments(l, `p${paraKey}-${idx}`)}
            {idx < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return <div className="message-assistant">{blocks}</div>;
}

function AttachmentListDialog({
  attachments,
  onClose,
}: {
  attachments: Attachment[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Attachments</h2>
        <div className="attachment-dialog-list">
          {attachments.map((a, i) => (
            <div key={i} className="attachment-dialog-item">
              {a.name}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="modal-button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}