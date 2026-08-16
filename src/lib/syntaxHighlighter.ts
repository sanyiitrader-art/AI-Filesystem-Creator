// Regex-only token coloring -- no parser, no AST, no language server
// (same lightweight-editor constraint as Android's SyntaxHighlighter.kt,
// which this is a direct port of, including the multi-language keyword
// sets added during Android development).

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
  return keywordsFor(extension).size > 0;
}

/** Tokenizes text into styled segments for the given file extension.
 *  Returns the whole text as one unstyled segment for extensions with
 *  no keyword set (spec: filename is just a filename, no hardcoded
 *  language dependency for unsupported types). */
export function highlightSyntax(text: string, extension: string): HighlightSegment[] {
  const keywords = keywordsFor(extension);
  if (keywords.size === 0) {
    return [{ text, className: null }];
  }

  const ext = extension.toLowerCase();
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

    // Plain character: merge into the previous unstyled segment when
    // possible, to avoid producing one DOM-relevant segment per char.
    const last = segments[segments.length - 1];
    if (last && last.className === null) {
      last.text += c;
    } else {
      segments.push({ text: c, className: null });
    }
    i++;
  }

  return segments;
}