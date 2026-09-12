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

export function MessageBubble(props: MessageBubbleProps) {
  const {
    message,
    isLatestUserMessage = false,
    isLatestAiMessage = false,
    onLike = () => {},
    onDislike = () => {},
    onRetry = () => {},
    onSaveEdit = () => {},
  } = props;

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

function renderCodeSegment(seg: InlineSegment, key: string): JSX.Element {
  return (
    <span key={key} className="inline-token">
      {seg.text}
    </span>
  );
}

function renderLinkSegment(seg: InlineSegment, key: string): JSX.Element {
  const url = seg.href as string;
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.open(url, "_blank");
  }
  return (
    <a key={key} href={url} className="message-link" onClick={handleClick}>
      {seg.text}
    </a>
  );
}

function renderPlainSegment(seg: InlineSegment, key: string): JSX.Element {
  let node: JSX.Element = <span>{seg.text}</span>;
  if (seg.bold) {
    node = <strong>{node}</strong>;
  }
  if (seg.italic) {
    node = <em>{node}</em>;
  }
  if (seg.strike) {
    node = <s>{node}</s>;
  }
  return <span key={key}>{node}</span>;
}

function renderInlineSegments(text: string, keyPrefix: string): JSX.Element[] {
  const parsed = parseInline(text);
  const out: JSX.Element[] = [];
  for (let idx = 0; idx < parsed.length; idx++) {
    const seg = parsed[idx];
    const key = keyPrefix + "-" + idx;
    if (seg.code) {
      out.push(renderCodeSegment(seg, key));
    } else if (seg.href) {
      out.push(renderLinkSegment(seg, key));
    } else {
      out.push(renderPlainSegment(seg, key));
    }
  }
  return out;
}

function UserMessage(props: {
  message: MessageType;
  isLatest: boolean;
  onSaveEdit: (newText: string) => void;
}) {
  const { message, isLatest, onSaveEdit } = props;
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

function AiMessage(props: {
  message: MessageType;
  isLatest: boolean;
  onLike: () => void;
  onDislike: () => void;
  onRetry: () => void;
}) {
  const { message, isLatest, onLike, onDislike, onRetry } = props;
  const [hovered, setHovered] = useState(false);
  const actionRowClass = hovered
    ? "message-action-row message-action-row-visible"
    : "message-action-row";

  if (message.is_stopped) {
    return (
      <div
        className="message-row message-row-assistant"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="message-stopped-text">You stopped this response.</div>
        <div className={actionRowClass}>
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

      <div className={actionRowClass}>
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
    python: "py",
    py: "py",
    kotlin: "kt",
    kt: "kt",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    java: "java",
    c: "c",
    cpp: "cpp",
    "c++": "cpp",
    csharp: "cs",
    "c#": "cs",
    cs: "cs",
    html: "html",
    css: "css",
    json: "json",
    bash: "sh",
    sh: "sh",
    shell: "sh",
    sql: "sql",
    ruby: "rb",
    rb: "rb",
    php: "php",
    go: "go",
    rust: "rs",
    rs: "rs",
    swift: "swift",
    xml: "xml",
    yaml: "yml",
    yml: "yml",
  };
  const found = map[key];
  return found ? found : "txt";
}

function downloadCodeSnippet(language: string, code: string) {
  const ext = extensionForLanguage(language);
  const fileName = "snippet_" + Date.now() + "." + ext;
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface CodeLineSegment {
  text: string;
  className: string | null;
}

function splitSegmentsIntoLines(
  segments: { text: string; className: string | null }[]
): CodeLineSegment[][] {
  const lines: CodeLineSegment[][] = [[]];
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    const parts = seg.text.split("\n");
    for (let p = 0; p < parts.length; p++) {
      if (p > 0) {
        lines.push([]);
      }
      if (parts[p].length > 0) {
        lines[lines.length - 1].push({ text: parts[p], className: seg.className });
      }
    }
  }
  return lines;
}

// Uses a fresh, unique CSS namespace (ai-codebox-*) so there is no
// possibility of silently colliding with any leftover CSS from
// earlier attempts at this feature.
function CodeBlock(props: { language: string; codeText: string }) {
  const { language, codeText } = props;
  const ext = extensionForLanguage(language);
  const highlightable = isHighlightableExtension(ext);
  const flatSegments = highlightable
    ? highlightSyntax(codeText, ext)
    : [{ text: codeText, className: null as string | null }];
  const lines = splitSegmentsIntoLines(flatSegments);

  function handleCopy() {
    navigator.clipboard.writeText(codeText);
  }

  function handleDownload() {
    downloadCodeSnippet(language, codeText);
  }

  return (
    <div className="ai-codebox">
      <div className="ai-codebox-header">
        <span className="ai-codebox-lang">{language}</span>
        <div className="ai-codebox-actions">
          <button className="ai-codebox-btn" title="Copy code" onClick={handleCopy}>
            <Copy size={13} />
          </button>
          <button className="ai-codebox-btn" title="Download code" onClick={handleDownload}>
            <Download size={13} />
          </button>
        </div>
      </div>
      <div className="ai-codebox-scroll">
        <div className="ai-codebox-rows">
          {lines.map((lineSegs, idx) => (
            <div className="ai-codebox-row" key={idx}>
              <span className="ai-codebox-linenum">{idx + 1}</span>
              <span className="ai-codebox-line-content">
                {lineSegs.length === 0
                  ? "\u00A0"
                  : lineSegs.map((seg, segIdx) =>
                      seg.className ? (
                        <span key={segIdx} className={seg.className}>
                          {seg.text}
                        </span>
                      ) : (
                        <span key={segIdx}>{seg.text}</span>
                      )
                    )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Heading color/size use inline style, not CSS classes -- inline
// style always wins over an external stylesheet rule regardless of
// specificity or declaration order, which is what actually guarantees
// headings render white even if some other rule elsewhere is still
// setting a heading color.
const HEADING_STYLE: Record<number, React.CSSProperties> = {
  1: { color: "var(--color-text-primary)", fontSize: "22px", fontWeight: 700, margin: "10px 0 4px 0" },
  2: { color: "var(--color-text-primary)", fontSize: "19px", fontWeight: 700, margin: "10px 0 4px 0" },
  3: { color: "var(--color-text-primary)", fontSize: "17px", fontWeight: 700, margin: "8px 0 4px 0" },
  4: { color: "var(--color-text-primary)", fontSize: "15.5px", fontWeight: 600, margin: "8px 0 3px 0" },
  5: { color: "var(--color-text-primary)", fontSize: "14.5px", fontWeight: 600, margin: "6px 0 3px 0" },
  6: { color: "var(--color-text-primary)", fontSize: "13.5px", fontWeight: 600, margin: "6px 0 3px 0" },
};

function renderHeadingBlock(headingText: string, level: number, keyNum: number): JSX.Element {
  const content = renderInlineSegments(headingText, "h" + keyNum);
  const style = HEADING_STYLE[level] || HEADING_STYLE[6];
  if (level === 1) return <h1 style={style} key={keyNum}>{content}</h1>;
  if (level === 2) return <h2 style={style} key={keyNum}>{content}</h2>;
  if (level === 3) return <h3 style={style} key={keyNum}>{content}</h3>;
  if (level === 4) return <h4 style={style} key={keyNum}>{content}</h4>;
  if (level === 5) return <h5 style={style} key={keyNum}>{content}</h5>;
  return <h6 style={style} key={keyNum}>{content}</h6>;
}

function renderQuoteBlock(quoteLines: string[], keyNum: number): JSX.Element {
  return (
    <blockquote className="message-blockquote" key={keyNum}>
      {quoteLines.map((l, idx) => (
        <span key={idx}>
          {renderInlineSegments(l, "bq" + keyNum + "-" + idx)}
          {idx < quoteLines.length - 1 ? <br /> : null}
        </span>
      ))}
    </blockquote>
  );
}

function renderListBlock(items: string[], keyNum: number): JSX.Element {
  return (
    <ul className="message-list" key={keyNum}>
      {items.map((item, idx) => (
        <li key={idx}>{renderInlineSegments(item, "li" + keyNum + "-" + idx)}</li>
      ))}
    </ul>
  );
}

function renderParagraphBlock(paraLines: string[], keyNum: number): JSX.Element {
  return (
    <p className="message-paragraph" key={keyNum}>
      {paraLines.map((l, idx) => (
        <span key={idx}>
          {renderInlineSegments(l, "p" + keyNum + "-" + idx)}
          {idx < paraLines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

function FormattedContent(props: { text: string }) {
  const lines = props.text.split("\n");
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().indexOf("```") === 0) {
      const language = line.trim().replace(/^```/, "").trim();
      const languageOrDefault = language.length > 0 ? language : "text";
      const codeLines: string[] = [];
      i = i + 1;
      while (i < lines.length && lines[i].trim().indexOf("```") !== 0) {
        codeLines.push(lines[i]);
        i = i + 1;
      }
      if (i < lines.length) {
        i = i + 1;
      }
      key = key + 1;
      blocks.push(
        <CodeBlock key={key} language={languageOrDefault} codeText={codeLines.join("\n")} />
      );
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      key = key + 1;
      blocks.push(renderHeadingBlock(headingMatch[2], level, key));
      i = i + 1;
      continue;
    }

    if (line.trim().indexOf(">") === 0) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().indexOf(">") === 0) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i = i + 1;
      }
      key = key + 1;
      blocks.push(renderQuoteBlock(quoteLines, key));
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i = i + 1;
      }
      key = key + 1;
      blocks.push(renderListBlock(items, key));
      continue;
    }

    if (line.trim().length === 0) {
      i = i + 1;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim().length > 0 &&
      lines[i].trim().indexOf("```") !== 0 &&
      lines[i].trim().indexOf(">") !== 0 &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^#{1,6}\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i = i + 1;
    }
    key = key + 1;
    blocks.push(renderParagraphBlock(paraLines, key));
  }

  return <div className="message-assistant">{blocks}</div>;
}

function AttachmentListDialog(props: { attachments: Attachment[]; onClose: () => void }) {
  const { attachments, onClose } = props;
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