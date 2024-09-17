import Editor from "@monaco-editor/react";
import { Box, Button, ButtonBase, Divider, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { RichTreeView, TreeItem2, TreeItem2IconContainer, TreeViewBaseItem } from "@mui/x-tree-view";
import { invoke } from "@tauri-apps/api/tauri";
import { registerCopilot } from "monacopilot";
import { useEffect, useState } from "react";
import Column from "./components/Column";
import Row from "./components/Row";
import { Article, Folder, FolderOpen } from "@mui/icons-material";

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
  const theme = useTheme();

  const [tab, setTab] = useState("0");

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
        <Row p='8px'>
          <Typography component={ButtonBase} variant="subtitle2" fontWeight='bold'>
            solmi
          </Typography>
        </Row>
        <Divider />
        <Tabs variant="fullWidth">
          <Tab icon={<Article />} sx={{ minWidth: 0 }} />
          <Tab icon={<Article />} sx={{ minWidth: 0 }} />
          <Tab icon={<Article />} sx={{ minWidth: 0 }} />
          <Tab icon={<Article />} sx={{ minWidth: 0 }} />
          <Tab icon={<Article />} sx={{ minWidth: 0 }} />
        </Tabs>
        <Divider />
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
      </Column>
      <Divider orientation="vertical" flexItem sx={{ borderWidth: 2 }} />
      <Column flex="1">
        <Tabs value={tab} onChange={(_, tab) => setTab(tab)}>
          <Tab value="0" label="file231231.tsx" />
          <Tab value="1" label="file231231.tsx" />
          <Tab value="2" label="file231231.tsx" />
        </Tabs>
        <Box
          flex="1"
          position="relative"
          py="8px"
          bgcolor={theme.palette.grey[900]}
        >
          <Editor
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            defaultValue=""
            onMount={(editor, monaco) => {
              registerCopilot(monaco, editor, {
                endpoint: "https://solmi.vercel.app/api/complete",
                language: "javascript",
              });
            }}
          />
        </Box>
      </Column>
    </Row>
  );
}

export default App;
