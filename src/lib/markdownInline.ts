export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

// Order matters: code first (so ** inside `code` isn't parsed), then
// *** before ** before * (longest-match-first for asterisk runs).
const INLINE_REGEX =
  /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  INLINE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("`")) {
      segments.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith("***")) {
      segments.push({ text: token.slice(3, -3), bold: true, italic: true });
    } else if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("~~")) {
      segments.push({ text: token.slice(2, -2), strike: true });
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) segments.push({ text: linkMatch[1], href: linkMatch[2] });
    } else if (token.startsWith("*")) {
      segments.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}