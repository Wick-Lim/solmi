import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Click the button to open a folder");

  async function openFolder() {
    try {
      const folderPath = await open({
        directory: true,
        multiple: false,
      });

      if (folderPath) {
        setMessage(`Selected folder: ${folderPath}`);
        const result = await invoke("open_folder", {
          folderPath: folderPath
        });
        setMessage(`Found ${JSON.stringify(result).length} bytes of data`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  }

  return (
    <div style={{ padding: "20px", color: "white", background: "#1e1e1e", minHeight: "100vh" }}>
      <h1>Solmi IDE Test</h1>
      <button onClick={openFolder} style={{ padding: "10px 20px", fontSize: "16px" }}>
        Open Folder
      </button>
      <p>{message}</p>
    </div>
  );
}

export default App;
