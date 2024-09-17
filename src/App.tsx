import Editor from "@monaco-editor/react";
import { Copilot, registerCopilot } from "monacopilot";

const copilot = new Copilot(import.meta.env.VITE_OPENAI_API_KEY, {
  provider: "openai",
  model: "gpt-4o-mini",
});

function App() {
  return (
    <Editor
      height="90vh"
      defaultLanguage="javascript"
      defaultValue="// some comment"
      onMount={(editor, monaco) => {
        // registerCopilot(monaco, editor, {
        // });
      }}
    />
  );
}

export default App;
