// The filesystem engine (spec sections 6-10, 20, 24, 54).
// This is the ONLY place that touches the actual Windows filesystem.
// It is the authoritative validation/execution boundary -- it does not
// trust that operations.rs::FsRequest::validate() was called, and it
// does not trust the AI. Every item is independently checked here.

use crate::operations::{
    FsErrorCode, FsItemError, FsOperation, FsOperationResult, ItemKind,
};
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

/// Characters Windows forbids in file/directory names.
const INVALID_WINDOWS_CHARS: &[char] = &['<', '>', ':', '"', '|', '?', '*'];

/// Executes a single FsOperation: creates its directories, then its
/// files, under root_path. Never touches anything outside root_path.
/// Continues past individual item failures and reports them, rather
/// than aborting the whole operation on the first error.
pub fn execute_operation(op: &FsOperation) -> FsOperationResult {
    let mut result = FsOperationResult {
        root_path: op.root_path.clone(),
        created_directories: Vec::new(),
        created_files: Vec::new(),
        errors: Vec::new(),
    };

    let root = PathBuf::from(&op.root_path);

    // The root itself must be a valid, absolute Windows path.
    if let Err(code) = validate_root_path(&root) {
        result.errors.push(FsItemError {
            path: op.root_path.clone(),
            item_kind: ItemKind::Directory,
            error: code,
        });
        return result; // nothing under an invalid root can be attempted
    }

    // Directories first, so files can land inside freshly created dirs.
    for rel_dir in &op.directories {
        match resolve_and_check(&root, rel_dir) {
            Ok(full_path) => match fs::create_dir_all(&full_path) {
                Ok(()) => result.created_directories.push(rel_dir.clone()),
                Err(e) => result.errors.push(FsItemError {
                    path: rel_dir.clone(),
                    item_kind: ItemKind::Directory,
                    error: map_io_error(&e, &full_path),
                }),
            },
            Err(code) => result.errors.push(FsItemError {
                path: rel_dir.clone(),
                item_kind: ItemKind::Directory,
                error: code,
            }),
        }
    }

    for rel_file in &op.files {
        match resolve_and_check(&root, rel_file) {
            Ok(full_path) => match create_empty_file(&full_path) {
                Ok(()) => result.created_files.push(rel_file.clone()),
                Err(e) => result.errors.push(FsItemError {
                    path: rel_file.clone(),
                    item_kind: ItemKind::File,
                    error: map_io_error(&e, &full_path),
                }),
            },
            Err(code) => result.errors.push(FsItemError {
                path: rel_file.clone(),
                item_kind: ItemKind::File,
                error: code,
            }),
        }
    }

    result
}

/// Root path must be absolute (Windows drive-letter form) to avoid any
/// ambiguity about where on disk the app is about to write.
fn validate_root_path(root: &Path) -> Result<(), FsErrorCode> {
    let s = root.to_string_lossy();
    let looks_like_drive_path = s.len() >= 3
        && s.as_bytes()[1] == b':'
        && (s.as_bytes()[2] == b'\\' || s.as_bytes()[2] == b'/');

    if !looks_like_drive_path {
        return Err(FsErrorCode::InvalidPath);
    }
    Ok(())
}

/// Joins root + relative path and rejects anything that would escape
/// root_path (parent-dir traversal, absolute overrides) or that uses
/// characters Windows disallows in filenames (section 54).
fn resolve_and_check(root: &Path, relative: &str) -> Result<PathBuf, FsErrorCode> {
    if relative.trim().is_empty() {
        return Err(FsErrorCode::InvalidFilename);
    }

    let rel_path = Path::new(relative);

    // Reject absolute paths and any parent-dir (..) traversal component.
    for component in rel_path.components() {
        match component {
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err(FsErrorCode::InvalidPath);
            }
            Component::Normal(part) => {
                let part_str = part.to_string_lossy();
                if part_str.chars().any(|c| INVALID_WINDOWS_CHARS.contains(&c)) {
                    return Err(FsErrorCode::InvalidCharacters);
                }
                if part_str.trim_end_matches('.').is_empty() {
                    return Err(FsErrorCode::InvalidFilename);
                }
            }
            Component::CurDir => {}
        }
    }

    let full = root.join(rel_path);

    // Belt-and-suspenders: resulting path must still be under root.
    if !full.starts_with(root) {
        return Err(FsErrorCode::InvalidPath);
    }

    Ok(full)
}

/// Creates a file with zero bytes of content (section 7). Fails if the
/// file already exists rather than silently truncating it, so an
/// existing file's contents are never touched (section 22).
fn create_empty_file(path: &Path) -> std::io::Result<()> {
    fs::OpenOptions::new().write(true).create_new(true).open(path)?;
    Ok(())
}

/// Maps a raw std::io::Error into the structured, non-technical
/// FsErrorCode categories the frontend/AI are allowed to see
/// (section 20 -- no "WinError 183" ever reaches the user).
fn map_io_error(err: &std::io::Error, path: &Path) -> FsErrorCode {
    match err.kind() {
        ErrorKind::AlreadyExists => FsErrorCode::AlreadyExists,
        ErrorKind::NotFound => FsErrorCode::PathNotFound,
        ErrorKind::PermissionDenied => FsErrorCode::AccessDenied,
        _ => {
            if !path.starts_with(path) {
                FsErrorCode::InvalidPath
            } else {
                FsErrorCode::Other
            }
        }
    }
}