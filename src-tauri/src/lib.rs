use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::{Serialize, Deserialize};
use rusqlite::{Connection, params};

#[derive(Serialize)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileNode>>,
}

#[tauri::command]
fn open_folder(folder_path: String) -> Result<Vec<FileNode>, String> {
    let path = PathBuf::from(folder_path);

    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    read_dir_shallow(&path)
}

// Read only immediate children (lazy loading)
fn read_dir_shallow(dir: &PathBuf) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Skip hidden files and directories
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }

            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let is_dir = path.is_dir();

            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                children: if is_dir { Some(Vec::new()) } else { None },
            });
        }
    }

    // Sort: directories first, then files, both alphabetically
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

#[tauri::command]
fn expand_folder(folder_path: String) -> Result<Vec<FileNode>, String> {
    let path = PathBuf::from(folder_path);

    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    read_dir_shallow(&path)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn execute_command(command: String, args: Vec<String>, cwd: String) -> Result<String, String> {
    let output = Command::new(command)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("{}\n{}", stdout, stderr))
    }
}

#[derive(Serialize)]
struct GitFile {
    path: String,
    status: String, // "M" (modified), "A" (added), "D" (deleted), "??" (untracked)
}

#[tauri::command]
fn git_status(repo_path: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["status".to_string()], repo_path)
}

#[tauri::command]
fn git_status_short(repo_path: String) -> Result<Vec<GitFile>, String> {
    let output = execute_command("git".to_string(), vec!["status".to_string(), "--short".to_string()], repo_path)?;
    let mut files = Vec::new();

    for line in output.lines() {
        if line.len() >= 3 {
            let status = line[0..2].trim().to_string();
            let path = line[3..].trim().to_string();

            // Skip if it's a directory (ends with /)
            if path.ends_with('/') {
                continue;
            }

            files.push(GitFile { path, status });
        }
    }

    Ok(files)
}

#[tauri::command]
fn git_diff(repo_path: String, file_path: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["diff".to_string(), file_path], repo_path)
}

#[tauri::command]
fn git_add(repo_path: String, file_path: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["add".to_string(), file_path], repo_path)
}

#[tauri::command]
fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["commit".to_string(), "-m".to_string(), message], repo_path)
}

#[tauri::command]
fn git_push(repo_path: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["push".to_string()], repo_path)
}

#[tauri::command]
fn git_pull(repo_path: String) -> Result<String, String> {
    execute_command("git".to_string(), vec!["pull".to_string()], repo_path)
}

#[derive(Serialize)]
struct SearchResult {
    file: String,
    line: usize,
    content: String,
}

#[tauri::command]
async fn search_in_files(folder_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    // 별도 스레드에서 실행
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(folder_path);
        let mut results = Vec::new();

        search_recursive(&path, &query, &mut results)?;

        Ok(results)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn search_recursive(dir: &PathBuf, query: &str, results: &mut Vec<SearchResult>) -> Result<(), String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Skip hidden files and directories
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }

            if path.is_file() {
                if let Ok(content) = fs::read_to_string(&path) {
                    for (line_num, line) in content.lines().enumerate() {
                        if line.contains(query) {
                            results.push(SearchResult {
                                file: path.to_string_lossy().to_string(),
                                line: line_num + 1,
                                content: line.trim().to_string(),
                            });
                        }
                    }
                }
            } else if path.is_dir() {
                search_recursive(&path, query, results)?;
            }
        }
    }
    Ok(())
}

// FTS 기반 검색
#[derive(Serialize)]
struct FTSResult {
    file_path: String,
    line_number: i32,
    content: String,
    language: String,
}

#[tauri::command]
async fn index_project(folder_path: String) -> Result<String, String> {
    // 별도 스레드에서 실행
    tauri::async_runtime::spawn_blocking(move || {
        let db_path = format!("{}/.solmi_search.db", folder_path);
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        // FTS5 테이블 생성
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS code_search USING fts5(
                file_path UNINDEXED,
                line_number UNINDEXED,
                content,
                language UNINDEXED
            )",
            [],
        ).map_err(|e| format!("Failed to create FTS table: {}", e))?;

        // 기존 데이터 삭제
        conn.execute("DELETE FROM code_search", [])
            .map_err(|e| format!("Failed to clear table: {}", e))?;

        let path = PathBuf::from(&folder_path);
        let mut indexed_count = 0;

        fn index_dir(dir: &PathBuf, conn: &Connection, count: &mut i32) -> Result<(), String> {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();

                    if let Some(name) = path.file_name() {
                        let name_str = name.to_string_lossy();
                        if name_str.starts_with('.') ||
                           name_str == "node_modules" ||
                           name_str == "dist" ||
                           name_str == "build" ||
                           name_str == "target" {
                            continue;
                        }
                    }

                    if path.is_dir() {
                        index_dir(&path, conn, count)?;
                    } else if path.is_file() {
                        if let Some(ext) = path.extension() {
                            let ext_str = ext.to_string_lossy().to_lowercase();
                            if ["rs", "ts", "tsx", "js", "jsx", "css", "html", "json", "md", "txt", "toml", "yaml", "yml"].contains(&ext_str.as_str()) {
                                if let Ok(content) = fs::read_to_string(&path) {
                                    let file_path = path.to_string_lossy().to_string();

                                    for (line_num, line) in content.lines().enumerate() {
                                        if !line.trim().is_empty() {
                                            conn.execute(
                                                "INSERT INTO code_search (file_path, line_number, content, language) VALUES (?, ?, ?, ?)",
                                                params![
                                                    &file_path,
                                                    (line_num + 1) as i32,
                                                    line,
                                                    ext_str.as_str()
                                                ],
                                            ).map_err(|e| format!("Failed to index line: {}", e))?;
                                            *count += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(())
        }

        index_dir(&path, &conn, &mut indexed_count)?;
        Ok(format!("Indexed {} lines", indexed_count))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn fts_search(folder_path: String, query: String) -> Result<Vec<FTSResult>, String> {
    // 별도 스레드에서 실행
    tauri::async_runtime::spawn_blocking(move || {
        let db_path = format!("{}/.solmi_search.db", folder_path);
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let mut stmt = conn.prepare(
            "SELECT file_path, line_number, content, language
             FROM code_search
             WHERE code_search MATCH ?
             ORDER BY rank
             LIMIT 100"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let results = stmt.query_map([&query], |row| {
            Ok(FTSResult {
                file_path: row.get(0)?,
                line_number: row.get(1)?,
                content: row.get(2)?,
                language: row.get(3)?,
            })
        }).map_err(|e| format!("Failed to query: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

        Ok(results)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// AI Integration
#[derive(Deserialize)]
struct AIMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ClaudeMessage>,
}

#[derive(Deserialize)]
struct ClaudeContent {
    text: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
}

#[tauri::command]
async fn ask_ai(api_key: String, messages: Vec<AIMessage>, context: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::new();

        // 메시지 변환 및 컨텍스트 추가
        let mut claude_messages: Vec<ClaudeMessage> = messages
            .iter()
            .map(|m| ClaudeMessage {
                role: m.role.clone(),
                content: if m.role == "user" && !context.is_empty() {
                    format!("{}\n\n{}", context, m.content)
                } else {
                    m.content.clone()
                },
            })
            .collect();

        // 첫 메시지가 user가 아니면 시스템 메시지 추가
        if claude_messages.is_empty() || claude_messages[0].role != "user" {
            claude_messages.insert(0, ClaudeMessage {
                role: "user".to_string(),
                content: "You are a helpful coding assistant.".to_string(),
            });
        }

        let request_body = ClaudeRequest {
            model: "claude-3-5-sonnet-20241022".to_string(),
            max_tokens: 4096,
            messages: claude_messages,
        };

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request_body)
            .send()
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API error: {}", error_text));
        }

        let claude_response: ClaudeResponse = response
            .json()
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        claude_response
            .content
            .first()
            .map(|c| c.text.clone())
            .ok_or_else(|| "No response from AI".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_folder,
            expand_folder,
            read_file,
            write_file,
            create_file,
            delete_file,
            create_folder,
            execute_command,
            git_status,
            git_status_short,
            git_diff,
            git_add,
            git_commit,
            git_push,
            git_pull,
            search_in_files,
            index_project,
            fts_search,
            ask_ai,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
