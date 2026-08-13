// App entry point. Declares the module tree and registers every
// Tauri command from commands.rs as the app's IPC surface (section 18).
// Kept intentionally thin -- no business logic lives here.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod filesystem;
mod operations;
mod storage;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::execute_fs_request,
            commands::list_conversations,
            commands::search_conversations,
            commands::get_conversation,
            commands::create_conversation,
            commands::save_conversation,
            commands::set_api_key,
            commands::has_api_key,
            commands::get_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}