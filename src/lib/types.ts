// Shared TypeScript types. Mirrors the Rust schema in
// src-tauri/src/operations.rs (Fs* types) and storage.rs
// (Conversation, ConversationSummary) so the frontend and backend
// agree on shape across the Tauri IPC boundary.

// ---- Filesystem operation schema (spec section 17) ----

export type ActionKind = "create";

export interface FsOperation {
  root_path: string;
  directories: string[];
  files: string[];
}

export interface FsRequest {
  action: ActionKind;
  operations: FsOperation[];
}

export type ItemKind = "directory" | "file";

export type FsErrorCode =
  | "already_exists"
  | "path_not_found"
  | "invalid_path"
  | "access_denied"
  | "invalid_filename"
  | "invalid_characters"
  | "other";

export interface FsItemError {
  path: string;
  item_kind: ItemKind;
  error: FsErrorCode;
}

export interface FsOperationResult {
  root_path: string;
  created_directories: string[];
  created_files: string[];
  errors: FsItemError[];
}

// ---- Conversations (spec sections 14-16) ----

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

// ---- Attachments (spec section 12) ----

export type AttachmentKind = "txt" | "md";

export interface Attachment {
  name: string;
  kind: AttachmentKind;
  content: string;
}

// ---- AI client result (spec section 19: AI may respond without
// producing any operation -- purely conversational turns are valid) ----

export interface AiTurnResult {
  /** The natural-language reply to render as an assistant message. */
  replyText: string;
  /** Present only if the AI's response included a valid, parsed
   *  filesystem request. Absent for purely conversational replies. */
  fsRequest: FsRequest | null;
}