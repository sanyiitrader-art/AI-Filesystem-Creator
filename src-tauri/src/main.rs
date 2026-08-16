#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod editor_fs;
mod filesystem;
mod operations;
mod storage;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            editor_fs::editor_load_tree,
            editor_fs::editor_is_likely_binary,
            editor_fs::editor_read_file,
            editor_fs::editor_write_file,
            editor_fs::editor_create_file,
            editor_fs::editor_create_folder,
            editor_fs::editor_rename,
            editor_fs::editor_delete,
            editor_fs::editor_unique_workspace_folder_name,
            editor_fs::editor_pick_folder,
            editor_fs::editor_pick_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}