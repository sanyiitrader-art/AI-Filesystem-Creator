// Renders a single message. Branches on role (spec sections 32-34):
// - user: bubble style, width driven by content up to a max-width
// - assistant: unboxed, on the clean chat surface, with rich
//   formatting (paragraphs, lists, headings, inline code, code blocks)
//
// No external markdown library is used -- the AI's replies are meant
// to be simple structured text (spec section 34 explicitly says "do
// not force unnecessary formatting on short responses"), so a small
// self-contained formatter is enough and keeps the dependency surface
// minimal (section 44).

import type { Message as MessageType } from "../lib/types";

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  if (message.role === "user") {
    return (
      <div className="message-row message-row-user">
        <div className="message-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-row message-row-assistant">
      <div className="message-assistant">
        {renderFormatted(message.content)}
      </div>
    </div>
  );
}

/**
 * Minimal formatter: splits assistant text into blocks (code fences,
 * headings, list groups, paragraphs) and renders inline code/emphasis
 * within non-code blocks. Deliberately simple -- not a full markdown
 * parser, just enough for section 34's requirements.
 */
function renderFormatted(text: string) {
  const lines = text.split("\n");
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre className="message-code-block" key={key++}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const HeadingTag = (`h${Math.min(level + 2, 6)}` as unknown) as "h3";
      blocks.push(
        <HeadingTag className="message-heading" key={key++}>
          {renderInline(headingMatch[2])}
        </HeadingTag>
      );
      i++;
      continue;
    }

    // List group (contiguous "- " or "* " lines)
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul className="message-list" key={key++}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Blank line -- skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: consume until blank line, heading, list, or fence
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^#{1,3}\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p className="message-paragraph" key={key++}>
        {paraLines.map((l, idx) => (
          <span key={idx}>
            {renderInline(l)}
            {idx < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
}

/** Renders inline `code` spans within an already-block-level line. */
function renderInline(line: string): (string | JSX.Element)[] {
  const parts = line.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return <code key={idx} className="message-inline-code">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}