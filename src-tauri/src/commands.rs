// Tauri IPC surface (spec section 18). This is the ONLY bridge between
// the frontend and the native layer -- every filesystem execution,
// conversation read/write, and API key access goes through here.
// Handlers stay thin: they delegate to filesystem.rs / storage.rs and
// translate results into IPC-friendly Result<T, String> responses.

use crate::filesystem::execute_operation;
use crate::operations::{FsOperationResult, FsRequest};
use crate::storage::{self, Conversation, ConversationSummary};
use tauri::AppHandle;

/// Validates then executes an AI-produced request. Returns one
/// FsOperationResult per FsOperation so the frontend can hand a
/// structured summary (including any per-item errors) back to the AI
/// for natural-language explanation (section 20).
#[tauri::command]
pub fn execute_fs_request(request: FsRequest) -> Result<Vec<FsOperationResult>, String> {
    request.validate().map_err(|e| e.message)?;

    let results = request
        .operations
        .iter()
        .map(execute_operation)
        .collect();

    Ok(results)
}

/// Returns lightweight summaries (id, title, updated_at) for the
/// sidebar list and for search -- never the full message history,
/// to keep this call cheap regardless of conversation size.
#[tauri::command]
pub fn list_conversations(app: AppHandle) -> Result<Vec<ConversationSummary>, String> {
    storage::list_conversations(&app).map_err(|e| e.to_string())
}

/// Filters conversation summaries by title/content match, for the
/// sidebar's "search saved conversations" control (section 28).
#[tauri::command]
pub fn search_conversations(
    app: AppHandle,
    query: String,
) -> Result<Vec<ConversationSummary>, String> {
    storage::search_conversations(&app, &query).map_err(|e| e.to_string())
}

/// Loads one full conversation (all messages) so it can be resumed
/// with the correct isolated context (section 14).
#[tauri::command]
pub fn get_conversation(app: AppHandle, id: String) -> Result<Conversation, String> {
    storage::get_conversation(&app, &id).map_err(|e| e.to_string())
}

/// Creates a new, empty conversation with clean context (section 15).
#[tauri::command]
pub fn create_conversation(app: AppHandle) -> Result<Conversation, String> {
    storage::create_conversation(&app).map_err(|e| e.to_string())
}

/// Persists a conversation's full current state (messages appended by
/// the frontend as the chat progresses). Upsert by id.
#[tauri::command]
pub fn save_conversation(app: AppHandle, conversation: Conversation) -> Result<(), String> {
    storage::save_conversation(&app, &conversation).map_err(|e| e.to_string())
}

/// Persists the user's Gemini API key locally. Overwrites any existing
/// key. The key is never echoed back in this response.
#[tauri::command]
pub fn set_api_key(app: AppHandle, key: String) -> Result<(), String> {
    storage::set_api_key(&app, &key).map_err(|e| e.to_string())
}

/// Returns whether a key is currently saved, without exposing its
/// value -- used only to decide UI state (e.g. whether "Edit API"
/// has something to edit), never to render the key itself.
#[tauri::command]
pub fn has_api_key(app: AppHandle) -> Result<bool, String> {
    storage::has_api_key(&app).map_err(|e| e.to_string())
}

/// Returns the actual key value. Called only by the frontend's
/// aiClient.ts immediately before making a Gemini request, and never
/// used to populate any visible UI field (the modal always starts
/// blank on edit, per spec).
#[tauri::command]
pub fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    storage::get_api_key(&app).map_err(|e| e.to_string())
}