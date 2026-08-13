// Standardized AI -> Application operation schema (spec section 17).
// This is the single source of truth for what a "valid operation" is.
// filesystem.rs validates against these types before touching disk.
// Mirrors the frontend's types in src/lib/types.ts.

use serde::{Deserialize, Serialize};

/// Top-level payload the frontend sends to the backend after the AI
/// client (lib/aiClient.ts) has parsed the model's JSON response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsRequest {
    /// Always "create" in v1 -- the app has no other capability (section 6).
    pub action: ActionKind,
    pub operations: Vec<FsOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActionKind {
    Create,
}

/// One independent structure targeting one root path (section 23:
/// a single request may contain multiple of these).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsOperation {
    /// Absolute Windows root path, e.g. "D:\\Projects".
    pub root_path: String,

    /// Directory paths, relative to root_path, to create.
    /// e.g. "Atlas\\src"
    #[serde(default)]
    pub directories: Vec<String>,

    /// File paths, relative to root_path, to create empty.
    /// e.g. "Atlas\\README.md"
    #[serde(default)]
    pub files: Vec<String>,
}

/// Result of executing a single FsOperation, returned to the frontend
/// so it can hand a structured summary back to the AI (section 20:
/// raw Windows errors are never shown to the user directly).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsOperationResult {
    pub root_path: String,
    pub created_directories: Vec<String>,
    pub created_files: Vec<String>,
    pub errors: Vec<FsItemError>,
}

/// A single failed item within an operation, with a structured error
/// code rather than a raw OS error string/number.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsItemError {
    /// The relative path that failed, exactly as given in the request.
    pub path: String,
    pub item_kind: ItemKind,
    pub error: FsErrorCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    Directory,
    File,
}

/// Structured, non-technical error categories (section 20).
/// filesystem.rs maps raw Windows/std::io errors into these before
/// anything crosses the IPC boundary to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FsErrorCode {
    AlreadyExists,
    PathNotFound,
    InvalidPath,
    AccessDenied,
    InvalidFilename,
    InvalidCharacters,
    Other,
}

/// Validation failure for a whole FsRequest before any filesystem
/// access is attempted -- e.g. malformed AI output, or a structurally
/// empty/invalid request (section 54: never trust AI output blindly).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationError {
    pub message: String,
}

impl FsRequest {
    /// Structural validation only (shape/emptiness). Does not touch disk
    /// and does not check path safety -- that is filesystem.rs's job,
    /// per-item, at execution time, as the independent authoritative
    /// boundary (section 54). This is a first-pass rejection of
    /// obviously malformed requests before they get that far.
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.operations.is_empty() {
            return Err(ValidationError {
                message: "Request contains no operations.".to_string(),
            });
        }

        for op in &self.operations {
            if op.root_path.trim().is_empty() {
                return Err(ValidationError {
                    message: "An operation is missing a root_path.".to_string(),
                });
            }
            if op.directories.is_empty() && op.files.is_empty() {
                return Err(ValidationError {
                    message: format!(
                        "Operation for '{}' has no directories or files.",
                        op.root_path
                    ),
                });
            }
        }

        Ok(())
    }
}