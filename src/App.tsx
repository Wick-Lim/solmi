import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Terminal from "./components/Terminal";
import GitPanel from "./components/GitPanel";
import SearchPanel from "./components/SearchPanel";
import SettingsPanel from "./components/SettingsPanel";
import AIPanel from "./components/AIPanel";
// import configureMonacoTypings from 'monaco-editor-auto-typings';
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
  const [terminals, setTerminals] = useState<Array<{ id: number; name: string }>>([]);
  const [activeTerminal, setActiveTerminal] = useState<number | null>(null);
  const [terminalCounter, setTerminalCounter] = useState(0);
  const [activePanel, setActivePanel] = useState<"files" | "git" | "search" | "ai">("files");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [splitView, setSplitView] = useState(false);
  const [splitFile] = useState<string>("");
  const [splitContent] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    theme: "solmi-dark",
    fontSize: 14,
    tabSize: 2,
  });
  const editorRef = useRef<any>(null);
  const splitEditorRef = useRef<any>(null);

  // Sidebar resize handlers
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX - 48; // 48 is activity bar width
      if (newWidth >= 150 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Define custom theme
  useEffect(() => {
    const defineTheme = async () => {
      const monaco = await import('@monaco-editor/react');
      if (monaco && monaco.loader) {
        const monacoInstance = await monaco.loader.init();
        monacoInstance.editor.defineTheme('solmi-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'c678dd' },
            { token: 'string', foreground: '98c379' },
            { token: 'number', foreground: 'd19a66' },
            { token: 'regexp', foreground: 'e06c75' },
            { token: 'type', foreground: 'e5c07b' },
            { token: 'class', foreground: 'e5c07b' },
            { token: 'function', foreground: '61afef' },
            { token: 'variable', foreground: 'e06c75' },
            { token: 'constant', foreground: 'd19a66' },
          ],
          colors: {
            'editor.background': '#282c34',
            'editor.foreground': '#abb2bf',
            'editorLineNumber.foreground': '#5c6370',
            'editorLineNumber.activeForeground': '#abb2bf',
            'editor.selectionBackground': '#3e4451',
            'editor.inactiveSelectionBackground': '#2c313c',
            'editor.lineHighlightBackground': '#2c313c',
            'editorCursor.foreground': '#528bff',
            'editor.findMatchBackground': '#42557b',
            'editor.findMatchHighlightBackground': '#314365',
            'editorWidget.background': '#21252b',
            'editorWidget.border': '#181a1f',
            'editorSuggestWidget.background': '#21252b',
            'editorSuggestWidget.border': '#181a1f',
            'editorSuggestWidget.selectedBackground': '#2c313c',
            'editorHoverWidget.background': '#21252b',
            'editorHoverWidget.border': '#181a1f',
            'input.background': '#282c34',
            'input.border': '#3e4451',
            'inputOption.activeBorder': '#528bff',
            'scrollbarSlider.background': '#3e445180',
            'scrollbarSlider.hoverBackground': '#3e4451',
            'scrollbarSlider.activeBackground': '#528bff80',
          }
        });
      }
    };
    defineTheme();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Command Palette: Cmd/Ctrl+Shift+P
      if (modifier && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Save: Cmd/Ctrl+S
      if (modifier && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile();
      }
      // Toggle Terminal: Cmd/Ctrl+`
      if (modifier && e.key === "`") {
        e.preventDefault();
        if (showTerminal) {
          setShowTerminal(false);
        } else {
          if (terminals.length === 0) {
            createNewTerminal();
          } else {
            setShowTerminal(true);
          }
        }
      }
      // Toggle Search: Cmd/Ctrl+Shift+F
      if (modifier && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActivePanel("search");
      }
      // Toggle Git: Cmd/Ctrl+Shift+G
      if (modifier && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setActivePanel("git");
      }
      // Close Tab: Cmd/Ctrl+W
      if (modifier && !e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (activeFile) {
          closeTab(activeFile);
        }
      }
      // Open Folder: Cmd/Ctrl+O
      if (modifier && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openFolder();
      }
      // Toggle Split View: Cmd/Ctrl+\
      if (modifier && e.key === "\\") {
        e.preventDefault();
        setSplitView(!splitView);
      }
      // Settings: Cmd/Ctrl+,
      if (modifier && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
      // Close Settings/Panels: Escape
      if (e.key === "Escape") {
        e.preventDefault();
        if (showSettings) setShowSettings(false);
        if (commandPaletteOpen) setCommandPaletteOpen(false);
      }
      // Navigate tabs: Cmd/Ctrl+1-9
      if (modifier && !e.shiftKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (openTabs[tabIndex]) {
          openFile(openTabs[tabIndex]);
        }
      }
      // Next tab: Cmd/Ctrl+Tab or Cmd/Ctrl+PageDown
      if (modifier && (e.key === "Tab" || e.key === "PageDown")) {
        e.preventDefault();
        const currentIndex = openTabs.indexOf(activeFile);
        if (currentIndex !== -1 && openTabs.length > 1) {
          const nextIndex = (currentIndex + 1) % openTabs.length;
          openFile(openTabs[nextIndex]);
        }
      }
      // Previous tab: Cmd/Ctrl+Shift+Tab or Cmd/Ctrl+PageUp
      if (modifier && e.shiftKey && (e.key === "Tab" || e.key === "PageUp")) {
        e.preventDefault();
        const currentIndex = openTabs.indexOf(activeFile);
        if (currentIndex !== -1 && openTabs.length > 1) {
          const prevIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
          openFile(openTabs[prevIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTerminal, activePanel, showSettings, commandPaletteOpen, activeFile, openTabs, splitView]);

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

        // 백그라운드에서 인덱싱 시작 (await 없이)
        invoke<string>("index_project", { folderPath })
          .then(msg => console.log("Search index ready:", msg))
          .catch(err => console.warn("Indexing failed:", err));
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }

  async function toggleFolder(path: string) {
    const isExpanded = expandedFolders.has(path);

    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    // If expanding and children not loaded yet, load them
    if (!isExpanded) {
      const node = findNodeByPath(fileTree, path);
      if (node && node.is_dir && node.children && node.children.length === 0) {
        try {
          const children = await invoke<FileNode[]>("expand_folder", { folderPath: path });
          setFileTree(prev => updateNodeChildren(prev, path, children));
        } catch (error) {
          console.error("Failed to expand folder:", error);
        }
      }
    }
  }

  function findNodeByPath(nodes: FileNode[], path: string): FileNode | null {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  function updateNodeChildren(nodes: FileNode[], path: string, children: FileNode[]): FileNode[] {
    return nodes.map(node => {
      if (node.path === path) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, path, children) };
      }
      return node;
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

      // Update Monaco model for this file if it exists
      if (editorRef.current) {
        const monaco = (window as any).monaco;
        if (monaco) {
          const uri = monaco.Uri.file(filepath);
          let model = monaco.editor.getModel(uri);

          if (model) {
            // Update existing model
            editorRef.current.setModel(model);
          } else {
            // Create new model
            const ext = filepath.split('.').pop();
            let language = 'javascript';
            if (ext === 'ts') language = 'typescript';
            if (ext === 'tsx') language = 'typescript';
            if (ext === 'jsx') language = 'javascript';
            if (ext === 'json') language = 'json';

            model = monaco.editor.createModel(content, language, uri);
            editorRef.current.setModel(model);
          }
        }
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

  async function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;

    // Store monaco globally for access in other functions
    (window as any).monaco = monaco;

    // Track selection changes
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      const selectedText = editor.getModel()?.getValueInRange(selection);
      if (selectedText && selectedText.trim()) {
        setSelectedCode(selectedText);
      }
    });

    // Configure TypeScript/JavaScript language features
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      checkJs: false,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
      strict: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      checkJs: false,
      allowSyntheticDefaultImports: true,
      skipLibCheck: true,
    });

    // Enable diagnostics but be more lenient
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2307], // Ignore "Cannot find module" errors
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2307], // Ignore "Cannot find module" errors
    });

    // Load all project files into Monaco's in-memory file system
    if (currentFolder) {
      await loadProjectFiles(monaco, currentFolder);
    }

    // Configure auto-typings for npm packages
    // try {
    //   await configureMonacoTypings(monaco, {
    //     onlySpecifiedPackages: false,
    //     shareCache: true,
    //     versions: {}, // Will auto-detect from package.json if available
    //   });
    //   console.log('Auto-typings configured successfully');
    // } catch (error) {
    //   console.warn('Failed to configure auto-typings:', error);
    // }
  }

  async function loadProjectFiles(monaco: any, folderPath: string) {
    try {
      // Get all files recursively
      const allFiles = await getAllProjectFiles(folderPath);

      // Dispose all existing models except the current one
      const models = monaco.editor.getModels();
      for (const model of models) {
        const modelUri = model.uri.toString();
        if (!modelUri.includes(activeFile)) {
          model.dispose();
        }
      }

      for (const filePath of allFiles) {
        // Only load JS/TS/JSX/TSX files
        if (filePath.match(/\.(ts|tsx|js|jsx|json)$/)) {
          try {
            const content = await invoke<string>("read_file", { path: filePath });

            // Use file:// URI scheme with full path
            const uri = monaco.Uri.file(filePath);

            // Check if model already exists
            let model = monaco.editor.getModel(uri);
            if (!model) {
              // Determine language from file extension
              const ext = filePath.split('.').pop();
              let language = 'javascript';
              if (ext === 'ts') language = 'typescript';
              if (ext === 'tsx') language = 'typescript';
              if (ext === 'jsx') language = 'javascript';
              if (ext === 'json') language = 'json';

              monaco.editor.createModel(content, language, uri);
            }
          } catch (err) {
            console.warn(`Failed to load file ${filePath}:`, err);
          }
        }
      }

      console.log(`Loaded ${allFiles.length} files into Monaco workspace`);
    } catch (error) {
      console.error("Failed to load project files:", error);
    }
  }

  async function getAllProjectFiles(folderPath: string): Promise<string[]> {
    const files: string[] = [];

    async function scanDirectory(dirPath: string) {
      try {
        const children = await invoke<FileNode[]>("expand_folder", { folderPath: dirPath });

        for (const child of children) {
          if (child.is_dir) {
            // Skip node_modules, .git, dist, build directories
            if (!child.name.match(/^(node_modules|\.git|dist|build|\.next|out)$/)) {
              await scanDirectory(child.path);
            }
          } else {
            files.push(child.path);
          }
        }
      } catch (err) {
        console.warn(`Failed to scan directory ${dirPath}:`, err);
      }
    }

    await scanDirectory(folderPath);
    return files;
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

  function createNewTerminal() {
    const newId = terminalCounter;
    setTerminals([...terminals, { id: newId, name: "New Terminal" }]);
    setActiveTerminal(newId);
    setTerminalCounter(newId + 1);
    setShowTerminal(true);
  }

  function closeTerminal(id: number) {
    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);
    if (activeTerminal === id) {
      setActiveTerminal(newTerminals.length > 0 ? newTerminals[0].id : null);
    }
    if (newTerminals.length === 0) {
      setShowTerminal(false);
    }
  }

  const commands = [
    { name: "Open Folder", action: openFolder },
    { name: "Save File", action: saveFile },
    { name: "Toggle Terminal", action: () => {
      if (showTerminal) {
        setShowTerminal(false);
      } else {
        if (terminals.length === 0) {
          createNewTerminal();
        } else {
          setShowTerminal(true);
        }
      }
    }},
    { name: "New Terminal", action: createNewTerminal },
    { name: "Show Git Panel", action: () => setActivePanel("git") },
    { name: "Show Search Panel", action: () => setActivePanel("search") },
    { name: "Show Files Panel", action: () => setActivePanel("files") },
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

      {/* Sidebar with Activity Bar */}
      <div className="sidebar-container" style={{ width: `${48 + sidebarWidth}px`, position: 'relative' }}>
        {/* Activity Bar */}
        <div className="activity-bar">
          <button
            className={activePanel === "files" ? "active" : ""}
            onClick={() => setActivePanel("files")}
            title="Explorer"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 2zm-.51 8.49V13H2V2h4.29l.85.85.36.15H14v7.49z"/>
            </svg>
          </button>
          <button
            className={activePanel === "search" ? "active" : ""}
            onClick={() => setActivePanel("search")}
            title="Search"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13 6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0 .52-.09.7-.3a.996.996 0 0 0 0-1.41v.01zM7 10.7c-2.59 0-4.7-2.11-4.7-4.7 0-2.59 2.11-4.7 4.7-4.7 2.59 0 4.7 2.11 4.7 4.7 0 2.59-2.11 4.7-4.7 4.7z"/>
            </svg>
          </button>
          <button
            className={activePanel === "git" ? "active" : ""}
            onClick={() => setActivePanel("git")}
            title="Source Control"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.62 2.38L12.24 1l-1.38 1.38L9.48 1l-1.38 1.38L6.72 1 5.34 2.38 4.96 2H2l-.5.5v11l.5.5h12l.5-.5V4.83l-.88-.45zm-.12 10.12h-11V3h1.34l1.37 1.38L6.6 5.76l1.38-1.38L9.36 5.76l1.38-1.38L12.12 5.76l1.38-1.38V12.5z"/>
            </svg>
          </button>
          <button
            className={activePanel === "ai" ? "active" : ""}
            onClick={() => setActivePanel("ai")}
            title="AI Assistant"
          >
            🤖
          </button>
        </div>

        {/* Sidebar Panel */}
        <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
          {activePanel === "files" && (
            <>
              <div className="sidebar-header">
                <span>EXPLORER</span>
                <button onClick={openFolder} title="Open Folder">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M14.5 2H7.71l-.85-.85L6.51 1h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 2zm-.51 8.49V13H2V2h4.29l.85.85.36.15H14v7.49z"/>
                  </svg>
                </button>
              </div>
              <div className="file-tree">
                {renderFileTree(fileTree)}
              </div>
            </>
          )}

          {activePanel === "search" && (
            <SearchPanel folderPath={currentFolder} onResultClick={handleSearchResultClick} />
          )}

          {activePanel === "git" && (
            <GitPanel repoPath={currentFolder} onOpenFile={openFile} />
          )}
          {activePanel === "ai" && (
            <AIPanel selectedCode={selectedCode} filePath={openTabs[openTabs.length - 1] || ""} />
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="sidebar-resize-handle"
          onMouseDown={handleMouseDown}
          style={{ cursor: isResizing ? 'col-resize' : 'ew-resize' }}
        />
      </div>

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
              <div className="terminal-tabs">
                {terminals.map((term) => (
                  <div
                    key={term.id}
                    className={`terminal-tab ${activeTerminal === term.id ? "active" : ""}`}
                    onClick={() => setActiveTerminal(term.id)}
                  >
                    <span>{term.name}</span>
                    <span
                      className="terminal-tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminal(term.id);
                      }}
                    >
                      ×
                    </span>
                  </div>
                ))}
                <button className="new-terminal-btn" onClick={createNewTerminal} title="New Terminal">
                  +
                </button>
              </div>
              <button className="close-panel-btn" onClick={() => setShowTerminal(false)}>×</button>
            </div>
            <div className="terminal-content">
              {terminals.map((term) => (
                <div
                  key={term.id}
                  style={{ display: activeTerminal === term.id ? "block" : "none", height: "100%" }}
                >
                  <Terminal cwd={currentFolder || "."} terminalId={term.id} />
                </div>
              ))}
            </div>
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
