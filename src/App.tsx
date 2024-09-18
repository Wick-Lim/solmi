import Editor, { useMonaco } from "@monaco-editor/react";
import { ChevronLeftOutlined, CloudOutlined, Extension, ExtensionOutlined, FileCopyOutlined, Folder, FolderOpen, MenuOutlined, SearchOutlined } from "@mui/icons-material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Divider, IconButton, InputAdornment, ListItemButton, ListItemIcon, ListItemText, Tab, Tabs, TextField, Typography } from "@mui/material";
import { RichTreeView, TreeItem2, TreeViewBaseItem } from "@mui/x-tree-view";
import { invoke } from "@tauri-apps/api/tauri";
import { registerCopilot } from "monacopilot";
import { useEffect, useState } from "react";
import Column from "./components/Column";
import Row from "./components/Row";

const MUI_X_PRODUCTS: TreeViewBaseItem[] = [
  {
    id: "grid",
    label: "Data Grid",
    children: [
      { id: "grid-community", label: "@mui/x-data-grid" },
      { id: "grid-pro", label: "@mui/x-data-grid-pro" },
      { id: "grid-premium", label: "@mui/x-data-grid-premium" },
    ],
  },
  {
    id: "pickers",
    label: "Date and Time Pickers",
    children: [
      { id: "pickers-community", label: "@mui/x-date-pickers" },
      { id: "pickers-pro", label: "@mui/x-date-pickers-pro" },
    ],
  },
  {
    id: "charts",
    label: "Charts",
    children: [{ id: "charts-community", label: "@mui/x-charts" }],
  },
  {
    id: "tree-view",
    label: "Tree View",
    children: [{ id: "tree-view-community", label: "@mui/x-tree-view" }],
  },
];

function App() {
  const [tab, setTab] = useState("file");
  const [file, setFile] = useState("0");


  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      // TypeScript 컴파일러 설정 적용 (tsconfig.json의 설정 반영)
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
    }
  }, [monaco]);

  useEffect(() => {
    invoke("read_file", {
      path: "/Users/imjunhyeog/Documents/Workspaces/solmi/README.md",
    }).then((res) => {
      console.log(res);
    });
  }, []);

  return (
    <Row flex="1">
      <Column width={300}>
        <TabContext value={tab}>
          <Row p='8px' alignItems='center'>
            <Typography variant="subtitle2" fontWeight='bold'>
              solmi
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
                    items={MUI_X_PRODUCTS}
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
                // registerCopilot(monaco, editor, {
                //   endpoint: "https://solmi.vercel.app/api/complete",
                //   language: "typescript",
                // });
              }}
              onChange={(value, e) => console.log(value, e)}
            />
          </Column>
        </Column>
      </Column>
    </Row>
  );
}

export default App;
