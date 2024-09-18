// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use serde::Serialize;
use tokio::sync::mpsc;
use futures::future::BoxFuture;
use tokio::process::Command;
use std::process::Stdio;
use tauri::Window;

#[derive(Serialize, Clone)]  // Clone 트레이트 추가
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

// 비동기 재귀 호출을 위한 BoxFuture 사용
fn read_directory_async(
    path: PathBuf,
    sender: mpsc::Sender<Vec<FileEntry>>
) -> BoxFuture<'static, Result<(), String>> {
    Box::pin(async move {
        if path.is_dir() {
            let mut entries = Vec::new();
            for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let path_buf = entry.path();
                let file_name = entry.file_name().into_string().unwrap();
                let is_dir = path_buf.is_dir();

                entries.push(FileEntry {
                    name: file_name,
                    path: path_buf.to_str().unwrap().to_string(),
                    is_dir,
                });

                // 하위 디렉토리는 비동기로 처리
                if is_dir {
                    let sender_clone = sender.clone();
                    tokio::spawn(read_directory_async(path_buf, sender_clone));
                }
            }
            sender.send(entries).await.map_err(|_| "Failed to send file entries".to_string())?;
        }
        Ok(())
    })
}

#[tauri::command]
async fn load_project_directory_async(
    path: String,
    window: tauri::Window
) -> Result<(), String> {
    let project_path = Path::new(&path).to_path_buf();
    let (tx, mut rx) = mpsc::channel(32);

    tokio::spawn(read_directory_async(project_path, tx));

    while let Some(entries) = rx.recv().await {
        window.emit("file_entries", entries).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn run_command(command: String, window: Window) -> Result<(), String> {
    let mut child = Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .spawn()
        .expect("Failed to start command");

    let stdout = child.stdout.take().expect("Failed to capture stdout");

    tokio::spawn(async move {
        use tokio::io::{AsyncBufReadExt, BufReader};

        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Some(line) = lines.next_line().await.unwrap_or(None) {
            window.emit("command-output", line).unwrap();
        }
    });

    child.wait().await.map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_project_directory_async])
        .invoke_handler(tauri::generate_handler![run_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
