// Thin wrapper around Tauri's invoke() for every backend command
// registered in src-tauri/src/commands.rs. Nothing in this file
// contains business logic -- it exists so the rest of the frontend
// never calls invoke() directly, and so the IPC contract lives in
// exactly one place.

import { invoke } from "@tauri-apps/api/core";
import type {
  Conversation,
  ConversationSummary,
  FsOperationResult,
  FsRequest,
} from "./types";

// ---- Filesystem execution ----

export function executeFsRequest(
  request: FsRequest
): Promise<FsOperationResult[]> {
  return invoke("execute_fs_request", { request });
}

// ---- Conversations ----

export function listConversations(): Promise<ConversationSummary[]> {
  return invoke("list_conversations");
}

export function searchConversations(
  query: string
): Promise<ConversationSummary[]> {
  return invoke("search_conversations", { query });
}

export function getConversation(id: string): Promise<Conversation> {
  return invoke("get_conversation", { id });
}

export function createConversation(): Promise<Conversation> {
  return invoke("create_conversation");
}

export function saveConversation(
  conversation: Conversation
): Promise<void> {
  return invoke("save_conversation", { conversation });
}

export function deleteConversation(id: string): Promise<void> {
  return invoke("delete_conversation", { id });
}

// ---- API key ----

export function setApiKey(key: string): Promise<void> {
  return invoke("set_api_key", { key });
}

export function hasApiKey(): Promise<boolean> {
  return invoke("has_api_key");
}

export function getApiKey(): Promise<string | null> {
  return invoke("get_api_key");
}