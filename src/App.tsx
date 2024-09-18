import Editor from "@monaco-editor/react";
import { ChevronLeftOutlined, CloudOutlined, Extension, ExtensionOutlined, FileCopyOutlined, Folder, FolderOpen, MenuOutlined, OpenInBrowserOutlined, SearchOutlined } from "@mui/icons-material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Divider, IconButton, InputAdornment, ListItemButton, ListItemIcon, ListItemText, Tab, Tabs, TextField, Typography } from "@mui/material";
import { RichTreeView, TreeItem2 } from "@mui/x-tree-view";
import { open } from '@tauri-apps/api/dialog';
import { FileEntry, readDir, readTextFile } from '@tauri-apps/api/fs';
import { registerCopilot } from "monacopilot";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import Column from "./components/Column";
import Row from "./components/Row";
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [tab, setTab] = useState("file");
  const [file, setFile] = useState("0");

  const [root, setRoot] = useLocalStorage<string>('root', '');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const hierarchy = useMemo(() => {
    return files.map((file) => ({
      id: file.path,
      label: file.name,
      children: [],
    }));
  }, [files]);

  useEffect(() => {
    if (root) {
      invoke('load_project_directory_async', { path: root });
      readDir(root).then((files) => {
        setFiles(files);
      });
    }
  }, [root]);

  useEffect(() => {
    if (selected) {
      readTextFile(selected).then((text) => {
        console.log(text);
      });
    }
  }, [selected]);

  useEffect(() => {
    invoke('run_command', { command: 'ls -al /' });
    listen('command-output', (event) => {
      console.log(event.payload);
    });
  }, []);

  return (
    <Row flex="1">
      <Column width={300}>
        <TabContext value={tab}>
          <Row p='8px' alignItems='center'>
            <Typography variant="subtitle2" fontWeight='bold' onClick={async () => {
              const root = await open({ directory: true, multiple: false });
              if (!root) return;

              setRoot(root as string);
            }}>
              {root?.split('/').pop() ?? 'No Project'}
            </Typography>
            <Row flex="1" />
            <IconButton size="small">
              <MenuOutlined fontSize="small" />
            </IconButton>
          </Row>
          <Divider />
          <TabList variant="fullWidth" onChange={(_, tab) => setTab(tab)} TabIndicatorProps={{ hidden: true }}>
            <Tab value="file" icon={<FileCopyOutlined />} sx={{ minWidth: 0 }} />
            <Tab value="search" icon={<SearchOutlined />} sx={{ minWidth: 0 }} />
            <Tab value="git" icon={<CloudOutlined />} sx={{ minWidth: 0 }} />
            <Tab value="extension" icon={<ExtensionOutlined />} sx={{ minWidth: 0 }} />
          </TabList>
          <Divider />
          <Column flex="1" position="relative">
            <Column position="absolute" sx={{ inset: 0, overflowY: 'scroll' }}>
              <Column height='fit-content'>
                <TabPanel value="file" sx={{ p: '8px 0' }}>
                  <RichTreeView
                    items={hierarchy}
                    slots={{ item: TreeItem2 }}
                    slotProps={{
                      item: {
                        slots: {
                          // @ts-ignore
                          label: Typography,
                          expandIcon: Folder,
                          collapseIcon: FolderOpen,
                        },
                        slotProps: {
                          // @ts-ignore
                          label: {
                            variant: "caption",
                          },
                        },
                        sx: {
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }
                      }
                    }}
                    onItemClick={(_, itemId) => setSelected(itemId)}
                  />
                </TabPanel>
                <TabPanel value="search" sx={{ p: '8px 0' }}>
                  <TextField size="small" variant="outlined" slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small">
                            <SearchOutlined />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }} fullWidth sx={{ px: '8px' }} />
                </TabPanel>
                <TabPanel value="git" sx={{ p: '8px 0' }}>
                </TabPanel>
                <TabPanel value="extension" sx={{ p: '8px 0' }}>
                  <ListItemButton>
                    <ListItemIcon>
                      <Extension />
                    </ListItemIcon>
                    <ListItemText primary="Copilot" secondary="code development assistant" />
                  </ListItemButton>
                </TabPanel>
              </Column>
            </Column>
          </Column>
        </TabContext>
      </Column>
      <Divider orientation="vertical" flexItem sx={{ borderWidth: 2 }} />
      <Column flex="1">
        <Row alignItems="flex-end">
          <IconButton size="small">
            <ChevronLeftOutlined fontSize="small" />
          </IconButton>
          <Tabs value={file} onChange={(_, tab) => setFile(tab)}>
            <Tab value="0" label="file231231.tsx" />
            <Tab value="1" label="file231231.tsx" />
            <Tab value="2" label="file231231.tsx" />
          </Tabs>
        </Row>
        <Column flex="1" position="relative">
          <Column position="absolute" py="8px" bgcolor="#1e1e1e" sx={{ inset: 0 }}>
            <Editor
              theme="vs-dark"
              path={'sample.tsx'}
              defaultLanguage="typescript"
              value={`
class Foo {
    private value = 42;
    render() {
        return <div>
            <div>
                Hello World
            </div>
            <div>The value is {this.value}</div>
        </div>
    }
}
`}
              onMount={(editor, monaco) => {
                monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                  jsx: monaco.languages.typescript.JsxEmit.React, // JSX 지원 설정
                  target: monaco.languages.typescript.ScriptTarget.ESNext, // 최신 ESNext 문법 사용
                  module: monaco.languages.typescript.ModuleKind.ESNext,  // ESNext 모듈 시스템 사용
                  allowJs: true,  // JavaScript 파일도 허용
                  strict: true,  // 엄격한 타입 검사 설정
                  noImplicitAny: true,  // any 타입 암시적 사용 금지
                });

                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: false,
                  noSyntaxValidation: false
                });

                registerCopilot(monaco, editor, {
                  endpoint: "https://solmi.vercel.app/api/complete",
                  language: "typescript",
                });
              }}
              onChange={(value, e) => console.log(value, e)}
            />
          </Column>
        </Column>
        <Column height={200}>
        </Column>
      </Column>
    </Row>
  );
}

export default App;
