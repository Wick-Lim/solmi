import Editor from "@monaco-editor/react";
import { registerCopilot } from "monacopilot";

function App() {
  return (
    <Editor
      height="90vh"
      defaultLanguage="javascript"
      defaultValue="// some comment"
      onMount={(editor, monaco) => {
        registerCopilot(monaco, editor, {
          endpoint: "https://solmi.vercel.app/api/complete",
          language: "javascript",
        });
      }}
    />
  );
}

export default App;
