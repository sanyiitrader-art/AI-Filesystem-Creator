// Thin wrapper around Tauri's invoke() for every editor_fs command
// registered in src-tauri/src/editor_fs.rs. Mirrors the existing
// lib/tauri.ts pattern already used for the AI side -- nothing in
// this file contains editor logic, that lives in EditorView.tsx.

import { invoke } from "@tauri-apps/api/core";
import type { EditorNode } from "./editorTypes";

export type EditorCreateResult =
  | { kind: "Success"; path: string }
  | { kind: "DuplicateName" }
  | { kind: "Failure" };

export type EditorRenameResult =
  | { kind: "Success"; new_path: string }
  | { kind: "DuplicateName" }
  | { kind: "Failure" };

export function loadTree(rootPath: string): Promise<EditorNode> {
  return invoke<EditorNode>("editor_load_tree", { rootPath }).then(attachExpansionDefaults);
}

// The Rust side has no concept of isExpanded (that's client-only UI
// state) -- every node loaded fresh from disk starts collapsed, same
// as the Android version's buildNode().
function attachExpansionDefaults(node: EditorNode): EditorNode {
  return {
    ...node,
    isExpanded: false,
    children: node.children.map(attachExpansionDefaults),
  };
}

export function isLikelyBinary(path: string): Promise<boolean> {
  return invoke("editor_is_likely_binary", { path });
}

export function readFile(path: string): Promise<string> {
  return invoke("editor_read_file", { path });
}

export function writeFile(path: string, content: string): Promise<void> {
  return invoke("editor_write_file", { path, content });
}

export function createFile(parentPath: string, name: string): Promise<EditorCreateResult> {
  return invoke("editor_create_file", { parentPath, name });
}

export function createFolder(parentPath: string, name: string): Promise<EditorCreateResult> {
  return invoke("editor_create_folder", { parentPath, name });
}

export function rename(
  parentPath: string,
  oldName: string,
  newName: string
): Promise<EditorRenameResult> {
  return invoke("editor_rename", { parentPath, oldName, newName });
}

export function deletePath(path: string): Promise<boolean> {
  return invoke("editor_delete", { path });
}

export function uniqueWorkspaceFolderName(parentPath: string): Promise<string> {
  return invoke("editor_unique_workspace_folder_name", { parentPath });
}

export function pickFolder(): Promise<string | null> {
  return invoke("editor_pick_folder");
}

export function pickFile(): Promise<string | null> {
  return invoke("editor_pick_file");
}