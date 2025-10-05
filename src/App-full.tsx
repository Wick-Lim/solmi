import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Terminal from "./components/Terminal";
import GitPanel from "./components/GitPanel";
import SearchPanel from "./components/SearchPanel";
import SettingsPanel from "./components/SettingsPanel";
import "./App.css";

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

function App() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState<string>("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [splitView, setSplitView] = useState(false);
  const [splitFile, setSplitFile] = useState<string>("");
  const [splitContent, setSplitContent] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    theme: "vs-dark",
    fontSize: 14,
    tabSize: 2,
  });
  const editorRef = useRef(null);
  const splitEditorRef = useRef(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Save: Ctrl+S
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      // Toggle Terminal: Ctrl+`
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setShowTerminal(!showTerminal);
      }
      // Toggle Search: Ctrl+Shift+F
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTerminal, showSearch, activeFile]);

  async function openFolder() {
    try {
      const folderPath = await open({
        directory: true,
        multiple: false,
      });

      if (folderPath) {
        const result = await invoke<FileNode[]>("open_folder", {
          folderPath: folderPath
        });
        setFileTree(result);
        setCurrentFolder(folderPath);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  async function openFile(filepath: string) {
    try {
      const content = await invoke<string>("read_file", { path: filepath });
      setFileContent(content);
      setActiveFile(filepath);

      // Add to tabs if not already open
      if (!openTabs.includes(filepath)) {
        setOpenTabs([...openTabs, filepath]);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  }

  function closeTab(filepath: string) {
    const newTabs = openTabs.filter(f => f !== filepath);
    setOpenTabs(newTabs);

    if (activeFile === filepath) {
      const idx = openTabs.indexOf(filepath);
      const nextFile = newTabs[idx] || newTabs[idx - 1] || "";

      if (nextFile) {
        openFile(nextFile);
      } else {
        setActiveFile("");
        setFileContent("");
      }
    }
  }

  async function saveFile() {
    if (!activeFile || !editorRef.current) return;

    try {
      const content = (editorRef.current as any).getValue();
      await invoke("write_file", { path: activeFile, content });
      console.log("File saved!");
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }

  function handleEditorDidMount(editor: any) {
    editorRef.current = editor;
  }

  function renderFileTree(nodes: FileNode[], depth = 0) {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className="file-item"
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          onClick={() => {
            if (node.is_dir) {
              toggleFolder(node.path);
            } else {
              openFile(node.path);
            }
          }}
        >
          {node.is_dir ? (expandedFolders.has(node.path) ? "📂 " : "📁 ") : "📄 "}
          {node.name}
        </div>
        {node.is_dir && expandedFolders.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  }

  async function handleSearchResultClick(file: string, line: number) {
    await openFile(file);
    // Wait for editor to mount and then reveal line
    setTimeout(() => {
      if (editorRef.current) {
        (editorRef.current as any).revealLineInCenter(line);
        (editorRef.current as any).setPosition({ lineNumber: line, column: 1 });
      }
    }, 100);
  }

  async function openInSplit(filepath: string) {
    try {
      const content = await invoke<string>("read_file", { path: filepath });
      setSplitContent(content);
      setSplitFile(filepath);
      setSplitView(true);
    } catch (error) {
      console.error("Failed to open file in split:", error);
    }
  }

  const commands = [
    { name: "Open Folder", action: openFolder },
    { name: "Save File", action: saveFile },
    { name: "Toggle Terminal", action: () => setShowTerminal(!showTerminal) },
    { name: "Toggle Git Panel", action: () => setShowGit(!showGit) },
    { name: "Toggle Search Panel", action: () => setShowSearch(!showSearch) },
    { name: "Toggle Split View", action: () => setSplitView(!splitView) },
    { name: "Open Settings", action: () => setShowSettings(true) },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="ide-container">
      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          currentSettings={settings}
          onSettingsChange={setSettings}
        />
      )}

      {/* Command Palette */}
      {commandPaletteOpen && (
        <div className="command-palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
          <div className="command-palette" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Type a command..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="command-list">
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={idx}
                  className="command-item"
                  onClick={() => {
                    cmd.action();
                    setCommandPaletteOpen(false);
                    setSearchQuery("");
                  }}
                >
                  {cmd.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-icons">
          <button onClick={openFolder} title="Open Folder">📁</button>
          <button onClick={() => setShowGit(!showGit)} title="Git">🔀</button>
          <button onClick={() => setShowSearch(!showSearch)} title="Search">🔍</button>
        </div>
        <div className="file-tree">
          {renderFileTree(fileTree)}
        </div>
      </div>

      {/* Git Panel */}
      {showGit && (
        <div className="git-sidebar">
          <GitPanel repoPath={currentFolder} />
        </div>
      )}

      {/* Search Panel */}
      {showSearch && (
        <div className="search-sidebar">
          <SearchPanel folderPath={currentFolder} onResultClick={handleSearchResultClick} />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="editor-container">
        <div className="editor-area" style={{ height: showTerminal ? "60%" : "100%" }}>
          <div className="editor-tabs">
            {openTabs.map((filepath) => (
              <div
                key={filepath}
                className={`tab ${activeFile === filepath ? "active" : ""}`}
                onClick={() => openFile(filepath)}
              >
                {filepath.split('/').pop()}
                <span
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(filepath);
                  }}
                >
                  ×
                </span>
              </div>
            ))}
            <div className="tab-actions">
              <button onClick={saveFile} disabled={!activeFile}>Save</button>
              <button onClick={() => setSplitView(!splitView)}>
                {splitView ? "Close Split" : "Split"}
              </button>
              <button onClick={() => setShowTerminal(!showTerminal)}>
                {showTerminal ? "Hide Terminal" : "Show Terminal"}
              </button>
            </div>
          </div>

          {/* Breadcrumb */}
          {activeFile && (
            <div className="breadcrumb">
              {activeFile.split('/').map((part, idx, arr) => (
                <span key={idx}>
                  {part}
                  {idx < arr.length - 1 && <span className="breadcrumb-sep"> / </span>}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
            <div style={{ flex: splitView ? 1 : "none", width: splitView ? "50%" : "100%" }}>
              <Editor
                height="100%"
                defaultLanguage="typescript"
                language={getLanguageFromFile(activeFile)}
                value={fileContent}
                onMount={handleEditorDidMount}
                theme={settings.theme}
                options={{
                  minimap: { enabled: true },
                  fontSize: settings.fontSize,
                  tabSize: settings.tabSize,
                  lineNumbers: "on",
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  find: {
                    addExtraSpaceOnTop: false,
                    autoFindInSelection: "never",
                    seedSearchStringFromSelection: "selection",
                  },
                }}
              />
            </div>
            {splitView && (
              <div style={{ flex: 1, width: "50%", borderLeft: "1px solid #3e3e42" }}>
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  language={getLanguageFromFile(splitFile)}
                  value={splitContent}
                  onMount={(editor) => { splitEditorRef.current = editor; }}
                  theme={settings.theme}
                  options={{
                    minimap: { enabled: true },
                    fontSize: settings.fontSize,
                    tabSize: settings.tabSize,
                    lineNumbers: "on",
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Terminal Panel */}
        {showTerminal && (
          <div className="terminal-panel" style={{ height: "40%" }}>
            <div className="terminal-header">
              <span>Terminal</span>
              <button onClick={() => setShowTerminal(false)}>×</button>
            </div>
            <Terminal cwd={currentFolder || "."} />
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguageFromFile(filepath: string): string {
  const ext = filepath.split('.').pop();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'go': 'go',
    'rs': 'rust',
    'py': 'python',
    'json': 'json',
    'md': 'markdown',
  };
  return langMap[ext || ''] || 'plaintext';
}

export default App;
