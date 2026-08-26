export interface HighlightSegment {
  text: string;
  className: string | null;
}

const PYTHON_KEYWORDS = new Set([
  "def", "class", "return", "if", "elif", "else", "for", "while", "in",
  "import", "from", "as", "try", "except", "finally", "with", "pass",
  "break", "continue", "lambda", "None", "True", "False", "and", "or",
  "not", "is", "yield", "global", "nonlocal", "raise", "assert", "async",
  "await", "del",
]);

const C_STYLE_KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
  "return", "class", "struct", "enum", "interface", "extends", "implements",
  "public", "private", "protected", "static", "final", "void", "new",
  "this", "super", "try", "catch", "finally", "throw", "throws", "import",
  "package", "const", "let", "var", "function", "int", "float", "double",
  "boolean", "bool", "char", "string", "String", "null", "true", "false",
  "fun", "val", "when", "object", "companion", "override", "async", "await",
  "export", "default", "from", "as", "type", "interface", "namespace",
  "abstract", "instanceof", "trait", "def", "print",
]);

const RUBY_KEYWORDS = new Set([
  "def", "end", "class", "module", "if", "elsif", "else", "unless",
  "while", "until", "for", "in", "do", "begin", "rescue", "ensure",
  "raise", "return", "yield", "self", "nil", "true", "false", "and",
  "or", "not", "then", "case", "when", "require", "require_relative",
  "attr_accessor", "attr_reader", "attr_writer", "puts", "print",
]);

const PHP_KEYWORDS = new Set([
  "function", "class", "public", "private", "protected", "static",
  "if", "else", "elseif", "foreach", "for", "while", "do", "switch",
  "case", "break", "continue", "return", "echo", "print", "require",
  "require_once", "include", "include_once", "namespace", "use",
  "new", "extends", "implements", "interface", "abstract", "final",
  "try", "catch", "finally", "throw", "null", "true", "false", "array",
  "as", "global", "const", "isset", "unset",
]);

const SHELL_KEYWORDS = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "until", "do",
  "done", "case", "esac", "function", "return", "exit", "echo", "export",
  "local", "readonly", "shift", "break", "continue", "in", "select",
  "source", "alias", "unset", "true", "false",
]);

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "CREATE", "TABLE", "ALTER", "DROP", "JOIN", "INNER", "LEFT",
  "RIGHT", "OUTER", "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
  "AND", "OR", "NOT", "NULL", "IS", "IN", "AS", "DISTINCT", "UNION",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "INDEX", "VIEW",
]);

const C_STYLE_EXTENSIONS = new Set([
  "kt", "kts", "java", "c", "cpp", "h", "hpp", "cs", "js", "jsx", "ts",
  "tsx", "swift", "go", "rs", "dart", "scala", "groovy",
]);
const SHELL_EXTENSIONS = new Set(["sh", "bash", "zsh"]);

function keywordsFor(extension: string): Set<string> {
  const ext = extension.toLowerCase();
  if (ext === "py") return PYTHON_KEYWORDS;
  if (C_STYLE_EXTENSIONS.has(ext)) return C_STYLE_KEYWORDS;
  if (ext === "rb") return RUBY_KEYWORDS;
  if (ext === "php") return PHP_KEYWORDS;
  if (SHELL_EXTENSIONS.has(ext)) return SHELL_KEYWORDS;
  if (ext === "sql") return SQL_KEYWORDS;
  return new Set();
}

export function isHighlightableExtension(extension: string): boolean {
  const ext = extension.toLowerCase();
  if (ext === "html" || ext === "htm" || ext === "css") return true;
  return keywordsFor(ext).size > 0;
}

function pushPlain(segments: HighlightSegment[], ch: string) {
  const last = segments[segments.length - 1];
  if (last && last.className === null) last.text += ch;
  else segments.push({ text: ch, className: null });
}

/** Lightweight CSS tokenizer -- not a full parser, but covers what
 *  was requested: selectors, classes/IDs, properties, values,
 *  numbers/units, strings, hex colors, custom properties (--x) and
 *  var()/rgba()/etc. function calls, and comments. Tracks brace depth
 *  to distinguish selector context (outside {}) from property/value
 *  context (inside {}). */
function highlightCss(text: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let i = 0;
  let insideBlock = 0;

  const isIdentChar = (c: string) => /[A-Za-z0-9_-]/.test(c);

  while (i < text.length) {
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      segments.push({ text: text.slice(i, stop), className: "syntax-comment" });
      i = stop;
      continue;
    }

    const c = text[i];

    if (c === '"' || c === "'") {
      const close = text.indexOf(c, i + 1);
      const stop = close === -1 ? text.length : close + 1;
      segments.push({ text: text.slice(i, stop), className: "syntax-string" });
      i = stop;
      continue;
    }

    if (c === "{") {
      insideBlock++;
      pushPlain(segments, c);
      i++;
      continue;
    }
    if (c === "}") {
      insideBlock = Math.max(0, insideBlock - 1);
      pushPlain(segments, c);
      i++;
      continue;
    }

    if (c === "@") {
      let end = i + 1;
      while (end < text.length && isIdentChar(text[end])) end++;
      segments.push({ text: text.slice(i, end), className: "syntax-keyword" });
      i = end;
      continue;
    }

    if (c === "#" && /[0-9a-fA-F]/.test(text[i + 1] ?? "")) {
      let end = i + 1;
      while (end < text.length && /[0-9a-fA-F]/.test(text[end])) end++;
      if ([4, 5, 7, 9].includes(end - i)) {
        segments.push({ text: text.slice(i, end), className: "syntax-number" });
        i = end;
        continue;
      }
    }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(text[i + 1] ?? ""))) {
      let end = i;
      while (end < text.length && /[0-9.]/.test(text[end])) end++;
      while (end < text.length && /[a-zA-Z%]/.test(text[end])) end++;
      segments.push({ text: text.slice(i, end), className: "syntax-number" });
      i = end;
      continue;
    }

    if (c === "." || c === "#" || c === "-" || /[A-Za-z_]/.test(c)) {
      let end = i;
      if (text.startsWith("--", i)) end += 2;
      else if (c === "." || c === "#") end += 1;
      while (end < text.length && isIdentChar(text[end])) end++;
      const word = text.slice(i, end);
      const isFunctionCall = end < text.length && text[end] === "(";

      if (!insideBlock) {
        segments.push({ text: word, className: "syntax-keyword" });
      } else if (isFunctionCall || word.startsWith("--")) {
        segments.push({ text: word, className: "syntax-function" });
      } else {
        let peek = end;
        while (peek < text.length && (text[peek] === " " || text[peek] === "\t")) peek++;
        if (text[peek] === ":") {
          segments.push({ text: word, className: "syntax-function" });
        } else {
          segments.push({ text: word, className: null });
        }
      }
      i = end;
      continue;
    }

    pushPlain(segments, c);
    i++;
  }

  return segments;
}

/** Lightweight HTML tokenizer: tags, attributes, attribute values,
 *  comments, doctype. <style>...</style> blocks delegate their inner
 *  content to highlightCss() so embedded CSS is colored too, instead
 *  of the whole block falling back to plain text. */
function tokenizeHtmlTag(tag: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const nameMatch = /^<\/?[a-zA-Z][a-zA-Z0-9-]*/.exec(tag);
  const namePart = nameMatch ? nameMatch[0] : tag;
  segments.push({ text: namePart, className: "syntax-keyword" });

  const rest = tag.slice(namePart.length);
  const attrRegex = /([a-zA-Z-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
  let restCursor = 0;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rest)) !== null) {
    const [full, attrName, eq, attrValue] = match;
    if (match.index > restCursor) {
      segments.push({ text: rest.slice(restCursor, match.index), className: null });
    }
    segments.push({ text: attrName, className: "syntax-function" });
    segments.push({ text: eq, className: null });
    segments.push({ text: attrValue, className: "syntax-string" });
    restCursor = match.index + full.length;
  }
  if (restCursor < rest.length) {
    segments.push({ text: rest.slice(restCursor), className: null });
  }

  return segments;
}

function highlightHtml(text: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let i = 0;

  while (i < text.length) {
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      const stop = end === -1 ? text.length : end + 3;
      segments.push({ text: text.slice(i, stop), className: "syntax-comment" });
      i = stop;
      continue;
    }

    if (/^<!doctype/i.test(text.slice(i, i + 9))) {
      const end = text.indexOf(">", i);
      const stop = end === -1 ? text.length : end + 1;
      segments.push({ text: text.slice(i, stop), className: "syntax-keyword" });
      i = stop;
      continue;
    }

    const styleOpenMatch = /^<style\b[^>]*>/i.exec(text.slice(i));
    if (styleOpenMatch) {
      const openTag = styleOpenMatch[0];
      segments.push(...tokenizeHtmlTag(openTag));
      i += openTag.length;
      const closeIdx = text.toLowerCase().indexOf("</style>", i);
      const cssEnd = closeIdx === -1 ? text.length : closeIdx;
      const cssContent = text.slice(i, cssEnd);
      segments.push(...highlightCss(cssContent));
      i = cssEnd;
      if (closeIdx !== -1) {
        segments.push({ text: "</style>", className: "syntax-keyword" });
        i += "</style>".length;
      }
      continue;
    }

    if (text[i] === "<") {
      const tagMatch = /^<\/?[a-zA-Z][a-zA-Z0-9-]*(\s+[^<>]*)?\/?>/.exec(text.slice(i));
      if (tagMatch) {
        segments.push(...tokenizeHtmlTag(tagMatch[0]));
        i += tagMatch[0].length;
        continue;
      }
    }

    pushPlain(segments, text[i]);
    i++;
  }

  return segments;
}

export function highlightSyntax(text: string, extension: string): HighlightSegment[] {
  const ext = extension.toLowerCase();
  if (ext === "html" || ext === "htm") return highlightHtml(text);
  if (ext === "css") return highlightCss(text);

  const keywords = keywordsFor(ext);
  if (keywords.size === 0) {
    return [{ text, className: null }];
  }

  const isPython = ext === "py";
  const isRuby = ext === "rb";
  const isShell = SHELL_EXTENSIONS.has(ext);
  const hashCommentLanguage = isPython || isRuby || isShell;
  const lineCommentToken = hashCommentLanguage ? "#" : "//";
  const caseInsensitiveKeywords = ext === "sql";

  const segments: HighlightSegment[] = [];
  let i = 0;

  const isLetter = (c: string) => /[A-Za-z]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);
  const isLetterOrDigit = (c: string) => /[A-Za-z0-9]/.test(c);

  const isKeyword = (word: string): boolean => {
    if (caseInsensitiveKeywords) {
      const upper = word.toUpperCase();
      for (const k of keywords) {
        if (k.toUpperCase() === upper) return true;
      }
      return false;
    }
    return keywords.has(word);
  };

  while (i < text.length) {
    if (text.startsWith(lineCommentToken, i)) {
      const nlIndex = text.indexOf("\n", i);
      const end = nlIndex === -1 ? text.length : nlIndex;
      segments.push({ text: text.slice(i, end), className: "syntax-comment" });
      i = end;
      continue;
    }

    const c = text[i];
    if (c === '"' || c === "'") {
      const closeIndex = text.indexOf(c, i + 1);
      const end = closeIndex === -1 ? text.length : closeIndex + 1;
      segments.push({ text: text.slice(i, end), className: "syntax-string" });
      i = end;
      continue;
    }

    if (isDigit(c)) {
      let end = i;
      while (end < text.length && (isDigit(text[end]) || text[end] === ".")) end++;
      segments.push({ text: text.slice(i, end), className: "syntax-number" });
      i = end;
      continue;
    }

    if (isLetter(c) || c === "_") {
      let end = i;
      while (end < text.length && (isLetterOrDigit(text[end]) || text[end] === "_")) end++;
      const word = text.slice(i, end);
      if (isKeyword(word)) {
        segments.push({ text: word, className: "syntax-keyword" });
      } else if (end < text.length && text[end] === "(") {
        segments.push({ text: word, className: "syntax-function" });
      } else {
        segments.push({ text: word, className: null });
      }
      i = end;
      continue;
    }

    pushPlain(segments, c);
    i++;
  }

  return segments;
}