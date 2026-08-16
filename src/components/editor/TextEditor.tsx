// The editable surface. Port of Android's TextEditorView.kt using the
// standard lightweight web technique for a highlighted plain-text
// editor: a transparent-text <textarea> layered exactly over a <pre>
// that renders the same content through syntaxHighlighter.ts, with
// scroll position synced between the two. No CodeMirror/Monaco --
// stays a plain text/code editor, not an IDE, per the spec.

import { useEffect, useMemo, useRef, useState } from "react";
import { highlightSyntax, isHighlightableExtension } from "../../lib/syntaxHighlighter";
import type { OpenFile, TextSearchResult } from "../../lib/editorTypes";

interface TextEditorProps {
  openFile: OpenFile | null;
  onContentChange: (content: string) => void;
  highlightRequest: TextSearchResult | null;
  onHighlightConsumed: () => void;
}

function absoluteOffset(content: string, lineNumber: number, column: number): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    offset += lines[i].length + 1;
  }
  return Math.min(offset + column, content.length);
}

export function TextEditor({
  openFile,
  onContentChange,
  highlightRequest,
  onHighlightConsumed,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [activeHighlight, setActiveHighlight] = useState<{ start: number; end: number } | null>(null);

  const extension = openFile ? (openFile.name.split(".").pop() ?? "") : "";

  // Reset highlight whenever the open file changes -- same as Android,
  // a stale highlight must never carry over between files.
  useEffect(() => {
    setActiveHighlight(null);
  }, [openFile?.path]);

  useEffect(() => {
    if (!highlightRequest || !openFile) return;

    const start = absoluteOffset(openFile.content, highlightRequest.lineNumber, highlightRequest.matchStart);
    const end = absoluteOffset(openFile.content, highlightRequest.lineNumber, highlightRequest.matchEnd);
    if (start >= end || end > openFile.content.length) {
      onHighlightConsumed();
      return;
    }

    setActiveHighlight({ start, end });

    // Scroll the match into view: measure via a hidden mirror of text
    // up to the match, using the textarea's own line-height metrics.
    const textarea = textareaRef.current;
    if (textarea) {
      const before = openFile.content.slice(0, start);
      const lineIndex = before.split("\n").length - 1;
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight || "18");
      const targetTop = Math.max(0, lineIndex * lineHeight - 80);
      textarea.scrollTop = targetTop;
      if (highlightRef.current) highlightRef.current.scrollTop = targetTop;
    }

    onHighlightConsumed();
  }, [highlightRequest, openFile, onHighlightConsumed]);

  const highlightedNodes = useMemo(() => {
    if (!openFile) return null;
    const segments = isHighlightableExtension(extension)
      ? highlightSyntax(openFile.content, extension)
      : [{ text: openFile.content, className: null as string | null }];

    if (!activeHighlight) {
      return segments.map((seg, i) => renderSegment(seg, i));
    }

    // Splice the search-match highlight span on top of the syntax
    // segments by walking character offsets.
    const nodes: JSX.Element[] = [];
    let pos = 0;
    let key = 0;
    for (const seg of segments) {
      const segStart = pos;
      const segEnd = pos + seg.text.length;
      const overlapStart = Math.max(segStart, activeHighlight.start);
      const overlapEnd = Math.min(segEnd, activeHighlight.end);

      if (overlapStart >= overlapEnd) {
        nodes.push(renderSegment(seg, key++));
      } else {
        if (overlapStart > segStart) {
          nodes.push(
            renderSegment({ text: seg.text.slice(0, overlapStart - segStart), className: seg.className }, key++)
          );
        }
        nodes.push(
          <span key={key++} className="syntax-search-highlight">
            {seg.text.slice(overlapStart - segStart, overlapEnd - segStart)}
          </span>
        );
        if (overlapEnd < segEnd) {
          nodes.push(
            renderSegment({ text: seg.text.slice(overlapEnd - segStart), className: seg.className }, key++)
          );
        }
      }
      pos = segEnd;
    }
    return nodes;
  }, [openFile, extension, activeHighlight]);

  function syncScroll() {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  if (!openFile) {
    return <div className="editor-text-empty">No file open</div>;
  }

  return (
    <div className="editor-text-container">
      <pre ref={highlightRef} className="editor-text-highlight-layer" aria-hidden="true">
        {highlightedNodes}
        {"\n"}
      </pre>
      <textarea
        ref={textareaRef}
        className="editor-text-input"
        value={openFile.content}
        spellCheck={false}
        onScroll={syncScroll}
        onMouseDown={() => setActiveHighlight(null)}
        onKeyDown={(e) => {
          // Any key press repositions the cursor -- clear the search
          // highlight the same way a click does, matching the Android
          // "continue typing clears it" behavior.
          if (activeHighlight) setActiveHighlight(null);
        }}
        onChange={(e) => onContentChange(e.target.value)}
      />
    </div>
  );
}

function renderSegment(seg: { text: string; className: string | null }, key: number) {
  return seg.className ? (
    <span key={key} className={seg.className}>
      {seg.text}
    </span>
  ) : (
    <span key={key}>{seg.text}</span>
  );
}