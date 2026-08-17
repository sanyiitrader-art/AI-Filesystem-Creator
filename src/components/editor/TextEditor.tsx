// The editable surface. Adds the line-number gutter feature ported
// from the Android version: mint-bordered, self-sized number squares
// per line; a number shows for any line with content OR any line at
// or before the cursor's current line (so a line you've typed past
// keeps its number even if you later delete its content back to
// empty -- and if you backspace-merge that empty line away entirely,
// it simply stops existing as a row, so its number naturally
// disappears with it); lines never wrap and extend right
// indefinitely; one shared horizontal scroll for the whole file,
// bounded by the longest line; the gutter scrolls vertically with
// the code but stays pinned horizontally; the caret is kept visible
// on both axes as you type or navigate.

import { useEffect, useMemo, useRef, useState } from "react";
import { highlightSyntax, isHighlightableExtension } from "../../lib/syntaxHighlighter";
import type { OpenFile, TextSearchResult } from "../../lib/editorTypes";

interface TextEditorProps {
  openFile: OpenFile | null;
  onContentChange: (content: string) => void;
  highlightRequest: TextSearchResult | null;
  onHighlightConsumed: () => void;
}

const FONT_SIZE_PX = 13;
const LINE_HEIGHT_PX = 20;
const PADDING_PX = 12;
const FONT_FAMILY = "'JetBrains Mono', 'Cascadia Code', Consolas, monospace";

function absoluteOffset(content: string, lineNumber: number, column: number): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    offset += lines[i].length + 1;
  }
  return Math.min(offset + column, content.length);
}

// Monospace guarantee: every character has the same pixel width.
// Measured once via canvas (no DOM element needed) -- lets cursor
// position and scroll targeting be computed directly (column *
// charWidth) instead of depending on layout measurement per keystroke.
function measureCharWidth(): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return FONT_SIZE_PX * 0.6;
  ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
  return ctx.measureText("M").width;
}

export function TextEditor({
  openFile,
  onContentChange,
  highlightRequest,
  onHighlightConsumed,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [activeHighlight, setActiveHighlight] = useState<{ start: number; end: number } | null>(null);
  const [cursorLine, setCursorLine] = useState(0);
  const charWidth = useMemo(measureCharWidth, []);

  const extension = openFile ? (openFile.name.split(".").pop() ?? "") : "";
  const content = openFile?.content ?? "";
  const lineTexts = useMemo(() => content.split("\n"), [content]);

  const longestLineChars = useMemo(
    () => Math.max(1, ...lineTexts.map((l) => l.length)),
    [lineTexts]
  );
  const contentWidthPx = longestLineChars * charWidth + 2 * PADDING_PX + 20;

  useEffect(() => {
    setActiveHighlight(null);
    setCursorLine(0);
  }, [openFile?.path]);

  function syncCursor() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const line = before.split("\n").length - 1;
    const column = before.slice(before.lastIndexOf("\n") + 1).length;
    setCursorLine(line);

    const container = scrollContainerRef.current;
    if (!container) return;

    const effectiveW = container.clientWidth - 2 * PADDING_PX;
    const effectiveH = container.clientHeight - 2 * PADDING_PX;
    const margin = 8;

    const cursorTop = line * LINE_HEIGHT_PX;
    const cursorBottom = cursorTop + LINE_HEIGHT_PX;
    const vTop = container.scrollTop;
    const vBottom = vTop + effectiveH;
    if (cursorBottom + margin > vBottom) {
      container.scrollTop = cursorBottom + margin - effectiveH;
    } else if (cursorTop - margin < vTop) {
      container.scrollTop = Math.max(0, cursorTop - margin);
    }

    const cursorX = column * charWidth;
    const hLeft = container.scrollLeft;
    const hRight = hLeft + effectiveW;
    if (cursorX + margin > hRight) {
      container.scrollLeft = cursorX + margin - effectiveW;
    } else if (cursorX - margin < hLeft) {
      container.scrollLeft = Math.max(0, cursorX - margin);
    }
  }

  useEffect(() => {
    if (!highlightRequest || !openFile) return;

    const start = absoluteOffset(openFile.content, highlightRequest.lineNumber, highlightRequest.matchStart);
    const end = absoluteOffset(openFile.content, highlightRequest.lineNumber, highlightRequest.matchEnd);
    if (start >= end || end > openFile.content.length) {
      onHighlightConsumed();
      return;
    }
    setActiveHighlight({ start, end });

    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = Math.max(0, (highlightRequest.lineNumber - 1) * LINE_HEIGHT_PX - 80);
      container.scrollLeft = Math.max(0, highlightRequest.matchStart * charWidth - 80);
    }
    onHighlightConsumed();
  }, [highlightRequest, openFile, onHighlightConsumed, charWidth]);

  const highlightedNodes = useMemo(() => {
    if (!openFile) return null;
    const segments = isHighlightableExtension(extension)
      ? highlightSyntax(openFile.content, extension)
      : [{ text: openFile.content, className: null as string | null }];

    if (!activeHighlight) return segments.map((seg, i) => renderSegment(seg, i));

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
          nodes.push(renderSegment({ text: seg.text.slice(0, overlapStart - segStart), className: seg.className }, key++));
        }
        nodes.push(
          <span key={key++} className="syntax-search-highlight">
            {seg.text.slice(overlapStart - segStart, overlapEnd - segStart)}
          </span>
        );
        if (overlapEnd < segEnd) {
          nodes.push(renderSegment({ text: seg.text.slice(overlapEnd - segStart), className: seg.className }, key++));
        }
      }
      pos = segEnd;
    }
    return nodes;
  }, [openFile, extension, activeHighlight]);

  function handleScroll() {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = container.scrollTop;
      highlightRef.current.scrollLeft = container.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = container.scrollTop;
    }
  }

  if (!openFile) {
    return <div className="editor-text-empty">No file open</div>;
  }

  return (
    <div className="editor-text-outer">
      <div className="editor-text-gutter" ref={gutterRef}>
        {lineTexts.map((lineText, index) =>
          lineText.length > 0 || index <= cursorLine ? (
            <div key={index} className="editor-text-line-number-row">
              <span className="editor-text-line-number">{index + 1}</span>
            </div>
          ) : (
            <div key={index} className="editor-text-line-spacer" />
          )
        )}
        <div className="editor-text-line-spacer" />
      </div>

      <div className="editor-text-scroll" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="editor-text-inner" style={{ width: contentWidthPx }}>
          <pre ref={highlightRef} className="editor-text-highlight-layer" aria-hidden="true">
            {highlightedNodes}
            {"\n"}
          </pre>
          <textarea
            ref={textareaRef}
            className="editor-text-input"
            value={openFile.content}
            spellCheck={false}
            wrap="off"
            onSelect={syncCursor}
            onKeyUp={syncCursor}
            onClick={syncCursor}
            onMouseDown={() => setActiveHighlight(null)}
            onKeyDown={() => {
              if (activeHighlight) setActiveHighlight(null);
            }}
            onChange={(e) => {
              onContentChange(e.target.value);
              setTimeout(syncCursor, 0);
            }}
          />
        </div>
      </div>
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