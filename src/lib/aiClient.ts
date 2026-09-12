import { getApiKey } from "./tauri";
import type {
  Attachment,
  AiTurnResult,
  FsRequest,
  Message,
} from "./types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

const SYSTEM_INSTRUCTION = `You are the assistant for a Windows filesystem structure creator app.

You have two roles at once, and both are always active:

1. NATIVE CONVERSATION: Chat naturally with the user about anything --
answer questions, discuss topics, make small talk, explain things, ask
useful follow-up questions, make reasonable suggestions, recommend ideas
when appropriate, explain alternatives, and brainstorm, exactly like a
normal capable conversational AI. Never refuse or deflect a normal
conversational message by saying you can only create files/folders.

2. FILESYSTEM CREATION: When the user explicitly asks you to create
directories or files, you can ONLY create directories and empty files.
You cannot write file contents, edit, delete, move, copy, rename existing
items, or run any other operation. Only populate "fsRequest" when the
user has explicitly instructed creation of specific directories/files in
this turn -- suggesting an idea in conversation is not the same as being
asked to create it, so never populate "fsRequest" from a suggestion alone.

RESPONSE QUALITY: Write responses that are natural, useful, and comfortable
to read. Use Markdown formatting intelligently, not automatically -- a
simple question deserves a simple answer; a complex explanation can use
headings, paragraphs, bullet or numbered lists, bold, italic, inline code,
code blocks, examples, or blockquotes where they genuinely help. Do not
over-format short or simple responses. Use standard Markdown syntax:
**bold**, *italic*, ***bold italic***, \`inline code\`, ~~strikethrough~~,
[link text](url), > blockquotes, and fenced code blocks with a language tag.
When explaining a symbol or character that could be interpreted as Markdown
formatting by the renderer (such as >, #, *, _, \`, -, [, ]), display it
inline, preferably using inline code, so the renderer treats it as a
literal symbol rather than applying unintended formatting -- for example,
write "The \\\`>\\\` symbol starts a blockquote in Markdown" rather than
placing a raw > at the start of a line when you don't intend to create one.

Maintain conversation context: resolve "it", "that", "the other one", and
similar references using prior turns in this conversation, for both
normal conversation and filesystem requests.

You must reply with ONLY a single JSON object and NOTHING else -- no
markdown code fences, no commentary before or after it, matching exactly
this shape:

{
  "replyText": "<your natural language reply, using Markdown where it
                  genuinely helps -- used for BOTH normal conversation
                  replies AND replies about a filesystem request>",
  "fsRequest": null | {
    "action": "create",
    "operations": [
      {
        "root_path": "<absolute Windows path>",
        "directories": ["<relative path>", ...],
        "files": ["<relative path>", ...]
      }
    ]
  }
}

CRITICAL: Windows paths contain backslashes (e.g. C:\\\\Users\\\\name).
Whenever a path appears anywhere in your JSON output, every backslash
MUST be written as a doubled backslash so the JSON stays valid. Never
write a single backslash inside a JSON string.

Set "fsRequest" to null for EVERY turn that is not an explicit creation
instruction. Never include file contents.`;

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

export async function sendTurn(
  history: Message[],
  userMessage: string,
  attachments: Attachment[],
  signal?: AbortSignal
): Promise<AiTurnResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "No API key configured. Add your Gemini API key via Edit API."
    );
  }

  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const attachmentText = attachments
    .map((a) => `--- Attached file: ${a.name} ---\n${a.content}`)
    .join("\n\n");

  const fullUserText = attachmentText
    ? `${userMessage}\n\n${attachmentText}`
    : userMessage;

  contents.push({ role: "user", parts: [{ text: fullUserText }] });

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "minimal" },
        maxOutputTokens: 4096,
      },
    }),
    signal,
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 400 || status === 401 || status === 403) {
      throw new Error("The saved API key was rejected. Please check it.");
    }
    throw new Error(`Gemini request failed (status ${status}).`);
  }

  const data = await response.json();
  const parts: GeminiPart[] | undefined = data?.candidates?.[0]?.content?.parts;

  const rawText = parts
    ?.filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  return parseAiTurnResult(rawText);
}

function stripCodeFences(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return fenced ? fenced[1] : text;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

function repairStrayBackslashes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
}

function robustJsonParse(rawText: string): unknown {
  const attempts = [
    rawText,
    stripCodeFences(rawText),
    extractJsonObject(rawText),
    extractJsonObject(stripCodeFences(rawText)),
    repairStrayBackslashes(rawText),
    repairStrayBackslashes(extractJsonObject(stripCodeFences(rawText))),
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }

  throw new Error("Gemini's response was not valid JSON.");
}

function parseAiTurnResult(rawText: string): AiTurnResult {
  const parsed = robustJsonParse(rawText);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Gemini's response was not a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.replyText !== "string") {
    throw new Error("Gemini's response was missing 'replyText'.");
  }

  if (obj.fsRequest === null || obj.fsRequest === undefined) {
    return { replyText: obj.replyText, fsRequest: null };
  }

  const fsRequest = validateFsRequestShape(obj.fsRequest);
  return { replyText: obj.replyText, fsRequest };
}

function validateFsRequestShape(value: unknown): FsRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Gemini's 'fsRequest' was malformed.");
  }
  const req = value as Record<string, unknown>;

  if (req.action !== "create") {
    throw new Error("Gemini's 'fsRequest.action' was not 'create'.");
  }
  if (!Array.isArray(req.operations) || req.operations.length === 0) {
    throw new Error("Gemini's 'fsRequest.operations' was missing or empty.");
  }

  for (const op of req.operations) {
    if (typeof op !== "object" || op === null) {
      throw new Error("Gemini produced a malformed operation.");
    }
    const o = op as Record<string, unknown>;
    if (typeof o.root_path !== "string" || o.root_path.trim() === "") {
      throw new Error("Gemini produced an operation with no root_path.");
    }
    if (!isStringArray(o.directories) || !isStringArray(o.files)) {
      throw new Error(
        "Gemini produced an operation with malformed directories/files."
      );
    }
  }

  return req as unknown as FsRequest;
}

function isStringArray(value: unknown): value is string[] {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((v) => typeof v === "string"))
  );
}