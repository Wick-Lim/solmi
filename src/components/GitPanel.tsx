import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./GitPanel.css";

interface GitPanelProps {
  repoPath: string;
  onOpenFile: (filepath: string) => void;
}

interface GitFile {
  path: string;
  status: string;
}

export default function GitPanel({ repoPath, onOpenFile }: GitPanelProps) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function refreshStatus() {
    if (!repoPath) return;
    try {
      const result = await invoke<GitFile[]>("git_status_short", { repoPath });
      setFiles(result);
    } catch (error) {
      console.error("Failed to get git status:", error);
      setFiles([]);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, [repoPath]);

  async function handleFileClick(file: GitFile) {
    // Open file in editor with full path
    const fullPath = `${repoPath}/${file.path}`;
    onOpenFile(fullPath);
  }

  async function handleStageFile(filePath: string) {
    try {
      await invoke("git_add", { repoPath, filePath });
      await refreshStatus();
    } catch (error) {
      alert(`Failed to stage file: ${error}`);
    }
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    setLoading(true);
    try {
      await invoke("git_commit", { repoPath, message: commitMessage });
      setCommitMessage("");
      await refreshStatus();
    } catch (error) {
      alert(`Commit failed: ${error}`);
    }
    setLoading(false);
  }

  async function handlePush() {
    setLoading(true);
    try {
      await invoke("git_push", { repoPath });
      await refreshStatus();
    } catch (error) {
      alert(`Push failed: ${error}`);
    }
    setLoading(false);
  }

  async function handlePull() {
    setLoading(true);
    try {
      await invoke("git_pull", { repoPath });
      await refreshStatus();
    } catch (error) {
      alert(`Pull failed: ${error}`);
    }
    setLoading(false);
  }

  function getStatusLabel(status: string): string {
    const trimmed = status.trim();
    if (trimmed === "M" || trimmed.includes("M")) return "M";
    if (trimmed === "A" || trimmed.includes("A")) return "A";
    if (trimmed === "D" || trimmed.includes("D")) return "D";
    if (trimmed === "??" || trimmed.includes("?")) return "U";
    if (trimmed === "R") return "R";
    if (trimmed === "C") return "C";
    return trimmed;
  }

  function getStatusTitle(status: string): string {
    const trimmed = status.trim();
    if (trimmed === "M" || trimmed.includes("M")) return "Modified";
    if (trimmed === "A" || trimmed.includes("A")) return "Added";
    if (trimmed === "D" || trimmed.includes("D")) return "Deleted";
    if (trimmed === "??" || trimmed.includes("?")) return "Untracked";
    if (trimmed === "R") return "Renamed";
    if (trimmed === "C") return "Copied";
    return status;
  }

  function getStatusColor(status: string): string {
    const trimmed = status.trim();
    if (trimmed === "M" || trimmed.includes("M")) return "#e5c07b"; // Modified - yellow
    if (trimmed === "A" || trimmed.includes("A")) return "#98c379"; // Added - green
    if (trimmed === "D" || trimmed.includes("D")) return "#e06c75"; // Deleted - red
    if (trimmed === "??" || trimmed.includes("?")) return "#61afef"; // Untracked - blue
    if (trimmed === "R") return "#c678dd"; // Renamed - purple
    if (trimmed === "C") return "#56b6c2"; // Copied - cyan
    return "#abb2bf";
  }

  if (!repoPath) {
    return (
      <div className="git-panel">
        <div className="git-header">
          <h3>Source Control</h3>
        </div>
        <div className="git-empty-state">
          <div className="empty-state-icon">📁</div>
          <div className="empty-state-text">No folder opened</div>
          <div className="empty-state-hint">Open a folder to use source control</div>
        </div>
      </div>
    );
  }

  return (
    <div className="git-panel">
      <div className="git-header">
        <h3>Source Control</h3>
        <button onClick={refreshStatus}>↻</button>
      </div>

      <div className="git-changes">
        <div className="git-files-list">
          {files.length === 0 ? (
            <div className="no-changes">No changes</div>
          ) : (
            files.map((file) => (
              <div
                key={file.path}
                className="git-file-item"
                onClick={() => handleFileClick(file)}
              >
                <span
                  className="git-file-status"
                  style={{ color: getStatusColor(file.status) }}
                  title={getStatusTitle(file.status)}
                >
                  {getStatusLabel(file.status)}
                </span>
                <span className="git-file-path">{file.path}</span>
                <button
                  className="git-stage-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageFile(file.path);
                  }}
                >
                  +
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="git-commit">
        <input
          type="text"
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCommit()}
        />
        <button onClick={handleCommit} disabled={loading || !commitMessage.trim()}>
          ✓
        </button>
      </div>

      <div className="git-actions">
        <button onClick={handlePull} disabled={loading}>
          ↓ Pull
        </button>
        <button onClick={handlePush} disabled={loading}>
          ↑ Push
        </button>
      </div>
    </div>
  );
}
