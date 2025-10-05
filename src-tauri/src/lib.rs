use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::Serialize;

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
fn search_in_files(folder_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    let path = PathBuf::from(folder_path);
    let mut results = Vec::new();

    search_recursive(&path, &query, &mut results)?;

    Ok(results)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
