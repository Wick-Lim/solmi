// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|err| err.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
