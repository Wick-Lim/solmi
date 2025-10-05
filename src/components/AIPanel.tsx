import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./AIPanel.css";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIPanelProps {
  selectedCode?: string;
  filePath?: string;
}

export default function AIPanel({ selectedCode, filePath }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages([...messages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 컨텍스트 구성
      let context = "";
      if (selectedCode) {
        context += `\nSelected code from ${filePath || "file"}:\n\`\`\`\n${selectedCode}\n\`\`\`\n`;
      }

      const response = await invoke<string>("ask_ai", {
        apiKey,
        messages: [...messages, userMessage],
        context,
      });

      const aiMessage: Message = { role: "assistant", content: response };
      setMessages([...messages, userMessage, aiMessage]);
    } catch (error) {
      console.error("AI request failed:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error}`,
      };
      setMessages([...messages, userMessage, errorMessage]);
    }

    setLoading(false);
  }

  function clearChat() {
    setMessages([]);
  }

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <h3>AI Assistant</h3>
        <div className="ai-actions">
          <button onClick={() => setShowSettings(!showSettings)}>⚙️</button>
          <button onClick={clearChat}>Clear</button>
        </div>
      </div>

      {showSettings && (
        <div className="ai-settings">
          <input
            type="password"
            placeholder="Claude API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      )}

      {selectedCode && (
        <div className="ai-context">
          <span>📎 Using selected code as context</span>
        </div>
      )}

      <div className="ai-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`ai-message ${msg.role}`}>
            <div className="message-role">{msg.role === "user" ? "You" : "AI"}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="ai-message assistant">
            <div className="message-role">AI</div>
            <div className="message-content">Thinking...</div>
          </div>
        )}
      </div>

      <div className="ai-input">
        <textarea
          placeholder="Ask AI about your code..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
