// Builds and sends requests to Google AI Studio's Gemini API, and
// strictly parses/validates the model's response into an FsRequest
// before it is ever passed toward the Rust backend (spec section 54:
// never trust AI output blindly -- this is the first line of defense,
// commands.rs/filesystem.rs are the authoritative second line).

import { getApiKey } from "./tauri";
import type {
  Attachment,
  AiTurnResult,
  FsRequest,
  Message,
} from "./types";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

// System instruction encodes the AI-behavior rules from the spec:
// conversational, context-aware, interprets natural language/trees/
// attachments into the standardized operation format, never expands
// scope beyond what the user explicitly asked for, never writes file
// contents, and must reply in a strict, parseable envelope.
const SYSTEM_INSTRUCTION = `You are the interpreter for a Windows filesystem structure creator app.

You can ONLY create directories and empty files. You cannot write file
contents, edit, delete, move, copy, rename existing items, or run any
other operation.

You must NEVER suggest, recommend, or create anything the user did not
explicitly ask for. Suggestion is not authorization -- only an explicit
instruction may produce a creation operation. Do not propose additional
folders or files you think would be useful.

Interpret natural language, ASCII/markdown trees, and attached .txt/.md
files. Preserve exact filenames the user provides. When the user gives
a file type and a bare name with no extension, choose the extension.
When the user gives both an explicit filename AND a separate type,
append the type as an additional extension rather than replacing the
given name.

Maintain conversation context: resolve "it", "that", "the other one",
and similar references using prior turns in this conversation.

You must reply with ONLY a single JSON object, no other text, no
markdown fences, matching exactly this shape:

{
  "replyText": "<natural language reply to show the user>",
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

Set "fsRequest" to null for purely conversational turns (greetings,
clarifying questions, explanations, discussing what was requested
without being asked to create it). Only populate "fsRequest" when the
user has explicitly instructed creation of specific directories/files.
Never include file contents anywhere in your response.`;

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Sends the current user message, prior conversation history, and any
 * attachments to Gemini, and returns a strictly validated AiTurnResult.
 * Throws if no API key is configured or if the model's response cannot
 * be parsed into the expected shape.
 */
export async function sendTurn(
  history: Message[],
  userMessage: string,
  attachments: Attachment[]
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
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
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

  // Gemini 3.x models may return internal reasoning as separate parts
  // (marked "thought": true) alongside the real answer. Only the
  // non-thought parts contain the actual JSON response.
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

/**
 * Strictly parses and structurally validates the model's JSON envelope.
 * Rejects anything malformed rather than guessing -- a malformed or
 * out-of-scope response must never silently become an operation.
 */
function parseAiTurnResult(rawText: string): AiTurnResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Gemini's response was not valid JSON.");
  }

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