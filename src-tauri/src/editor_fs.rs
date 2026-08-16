// Editor-specific filesystem operations (text/code editor feature).
// Deliberately separate from filesystem.rs: that module is the AI's
// authoritative create-only engine, validated against a strict
// operation schema. This module gives the EDITOR arbitrary read/
// write/rename/delete access to files the user explicitly picks via
// a native dialog -- a genuinely different, broader capability that
// must not share (or accidentally loosen) the AI's constrained path.
//
// Unlike the Android version, there is no SAF/content-URI layer here
// -- Windows desktop apps have direct filesystem access, so this
// operates on plain paths. The dialog plugin supplies those paths
// only through an explicit user-driven native picker, never invented
// by the app itself.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorNode {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub parent_path: Option<String>,
    // Tracked here (rather than computed on the frontend) so it's
    // always consistent with the actual tree shape returned, and so
    // ExplorerPanel.tsx's indentation logic doesn't need to re-derive
    // it by walking the tree itself.
    pub depth: u32,
    pub children: Vec<EditorNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum EditorCreateResult {
    Success { path: String },
    DuplicateName,
    Failure,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum EditorRenameResult {
    Success { new_path: String },
    DuplicateName,
    Failure,
}

/// Loads the full nested tree under root_path. Mirrors the Android
/// WorkspaceStore.loadTree()'s recursive structure and sort order
/// (directories first, then alphabetical).
#[tauri::command]
pub fn editor_load_tree(root_path: String) -> Result<EditorNode, String> {
    build_node(Path::new(&root_path), None, 0)
        .ok_or_else(|| "Could not read that folder.".to_string())
}

fn build_node(path: &Path, parent_path: Option<String>, depth: u32) -> Option<EditorNode> {
    let metadata = fs::metadata(path).ok()?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let path_string = path.to_string_lossy().to_string();
    let is_directory = metadata.is_dir();

    let children = if is_directory {
        let mut entries: Vec<PathBuf> = fs::read_dir(path)
            .ok()?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .collect();

        entries.sort_by(|a, b| {
            let a_is_dir = a.is_dir();
            let b_is_dir = b.is_dir();
            match (a_is_dir, b_is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_lowercase()
                    .cmp(&b.file_name().unwrap_or_default().to_string_lossy().to_lowercase()),
            }
        });

        entries
            .iter()
            .filter_map(|child_path| build_node(child_path, Some(path_string.clone()), depth + 1))
            .collect()
    } else {
        Vec::new()
    };

    Some(EditorNode {
        path: path_string,
        name,
        is_directory,
        parent_path,
        depth,
        children,
    })
}

/// Sniffs the first few KB for binary content -- same heuristic as
/// the Android version (null byte, or >10% non-printable bytes),
/// deliberately not based on file extension.
#[tauri::command]
pub fn editor_is_likely_binary(path: String) -> Result<bool, String> {
    let bytes = match fs::read(&path) {
        Ok(b) => b,
        Err(_) => return Ok(true),
    };

    let sample = &bytes[..bytes.len().min(8192)];
    if sample.is_empty() {
        return Ok(false);
    }

    let mut suspicious = 0usize;
    for &b in sample {
        if b == 0 {
            return Ok(true);
        }
        let is_printable_or_whitespace =
            (0x20..=0x7E).contains(&b) || b == 0x09 || b == 0x0A || b == 0x0D || b >= 0x80;
        if !is_printable_or_whitespace {
            suspicious += 1;
        }
    }

    Ok((suspicious as f64 / sample.len() as f64) > 0.10)
}

#[tauri::command]
pub fn editor_read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn editor_write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn editor_create_file(parent_path: String, name: String) -> Result<EditorCreateResult, String> {
    let target = Path::new(&parent_path).join(&name);
    if target.exists() {
        return Ok(EditorCreateResult::DuplicateName);
    }
    match fs::File::create(&target) {
        Ok(_) => Ok(EditorCreateResult::Success {
            path: target.to_string_lossy().to_string(),
        }),
        Err(_) => Ok(EditorCreateResult::Failure),
    }
}

#[tauri::command]
pub fn editor_create_folder(parent_path: String, name: String) -> Result<EditorCreateResult, String> {
    let target = Path::new(&parent_path).join(&name);
    if target.exists() {
        return Ok(EditorCreateResult::DuplicateName);
    }
    match fs::create_dir(&target) {
        Ok(_) => Ok(EditorCreateResult::Success {
            path: target.to_string_lossy().to_string(),
        }),
        Err(_) => Ok(EditorCreateResult::Failure),
    }
}

/// Renames a file or folder within the same parent. Takes
/// parent_path + old_name (not a bare full path) for the same reason
/// the fixed Android version does: locating the item via its parent
/// is the reliable pattern, and returning the real resulting path
/// lets the caller patch in-memory state without a stale reference.
#[tauri::command]
pub fn editor_rename(
    parent_path: String,
    old_name: String,
    new_name: String,
) -> Result<EditorRenameResult, String> {
    if old_name == new_name {
        return Ok(EditorRenameResult::Success {
            new_path: Path::new(&parent_path)
                .join(&old_name)
                .to_string_lossy()
                .to_string(),
        });
    }

    let parent = Path::new(&parent_path);
    let old_path = parent.join(&old_name);
    let new_path = parent.join(&new_name);

    if new_path.exists() {
        return Ok(EditorRenameResult::DuplicateName);
    }

    match fs::rename(&old_path, &new_path) {
        Ok(_) => Ok(EditorRenameResult::Success {
            new_path: new_path.to_string_lossy().to_string(),
        }),
        Err(_) => Ok(EditorRenameResult::Failure),
    }
}

/// Deletes a file, or a folder and everything inside it.
#[tauri::command]
pub fn editor_delete(path: String) -> Result<bool, String> {
    let target = Path::new(&path);
    let result = if target.is_dir() {
        fs::remove_dir_all(target)
    } else {
        fs::remove_file(target)
    };
    Ok(result.is_ok())
}

/// Finds a unique root workspace folder name starting from "new
/// folder", appending " (2)", " (3)", etc. -- same behavior as the
/// Android version's menu New File/New Folder workspace creation.
#[tauri::command]
pub fn editor_unique_workspace_folder_name(parent_path: String) -> Result<String, String> {
    let parent = Path::new(&parent_path);
    let base = "new folder";
    if !parent.join(base).exists() {
        return Ok(base.to_string());
    }
    let mut counter = 2;
    loop {
        let candidate = format!("{base} ({counter})");
        if !parent.join(&candidate).exists() {
            return Ok(candidate);
        }
        counter += 1;
    }
}

/// Opens the native "pick a folder" dialog. Returns None if the user
/// cancels. This is the only way editor_fs ever learns about a path
/// outside what the user has already opened -- never invented by the
/// app itself.
#[tauri::command]
pub async fn editor_pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.map(|p| p.to_string()));
    });
    rx.await.map_err(|e| e.to_string())
}

/// Opens the native "pick a file" dialog. Returns None if cancelled.
#[tauri::command]
pub async fn editor_pick_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_file(move |file| {
        let _ = tx.send(file.map(|p| p.to_string()));
    });
    rx.await.map_err(|e| e.to_string())
}