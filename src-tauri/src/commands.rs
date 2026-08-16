// Tauri IPC surface (spec section 18). This is the ONLY bridge between
// the frontend and the native layer -- every filesystem execution,
// conversation read/write, and API key access goes through here.
// Handlers stay thin: they delegate to filesystem.rs / storage.rs and
// translate results into IPC-friendly Result<T, String> responses.

use crate::filesystem::execute_operation;
use crate::operations::{FsOperationResult, FsRequest};
use crate::storage::{self, Conversation, ConversationSummary};
use tauri::AppHandle;

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

#[tauri::command]
pub fn list_conversations(app: AppHandle) -> Result<Vec<ConversationSummary>, String> {
    storage::list_conversations(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_conversations(
    app: AppHandle,
    query: String,
) -> Result<Vec<ConversationSummary>, String> {
    storage::search_conversations(&app, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_conversation(app: AppHandle, id: String) -> Result<Conversation, String> {
    storage::get_conversation(&app, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_conversation(app: AppHandle) -> Result<Conversation, String> {
    storage::create_conversation(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_conversation(app: AppHandle, conversation: Conversation) -> Result<(), String> {
    storage::save_conversation(&app, &conversation).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_conversation(app: AppHandle, id: String) -> Result<(), String> {
    storage::delete_conversation(&app, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_api_key(app: AppHandle, key: String) -> Result<(), String> {
    storage::set_api_key(&app, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_api_key(app: AppHandle) -> Result<bool, String> {
    storage::has_api_key(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    storage::get_api_key(&app).map_err(|e| e.to_string())
}