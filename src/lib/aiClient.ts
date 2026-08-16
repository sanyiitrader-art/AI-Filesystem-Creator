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

// Switched from gemini-3.5-flash to gemini-3.5-flash-lite: 1000
// requests/day vs 120/day, well suited to this app's structured,
// low-complexity interpretation task -- same change already made on
// the Android version.
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

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

You must reply with ONLY a single JSON object and NOTHING else -- no
markdown code fences, no commentary before or after it, matching
exactly this shape:

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

CRITICAL: Windows paths contain backslashes (e.g. C:\\Users\\name).
Whenever a path appears anywhere in your JSON output, every backslash
MUST be written as a doubled backslash ("\\\\") so the JSON stays
valid. Never write a single backslash inside a JSON string.

Keep replyText brief and to the point -- do not add extra commentary.

Set "fsRequest" to null for purely conversational turns. Only populate
"fsRequest" when the user has explicitly instructed creation of
specific directories/files. Never include file contents.`;

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
        thinkingConfig: { thinkingLevel: "minimal" },
        maxOutputTokens: 4096,
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