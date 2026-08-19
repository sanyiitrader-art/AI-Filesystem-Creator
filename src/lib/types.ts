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

export type MessageRole = "user" | "assistant";

export type AttachmentKind = "txt" | "md";

export interface Attachment {
  name: string;
  kind: AttachmentKind;
  content: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  liked: boolean;
  disliked: boolean;
  attachments: Attachment[];
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

export interface AiTurnResult {
  replyText: string;
  fsRequest: FsRequest | null;
}