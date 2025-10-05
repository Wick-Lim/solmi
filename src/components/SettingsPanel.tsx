import { useState } from "react";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  onClose: () => void;
  currentSettings: {
    theme: string;
    fontSize: number;
    tabSize: number;
  };
  onSettingsChange: (settings: any) => void;
}

export default function SettingsPanel({ onClose, currentSettings, onSettingsChange }: SettingsPanelProps) {
  const [theme, setTheme] = useState(currentSettings.theme);
  const [fontSize, setFontSize] = useState(currentSettings.fontSize);
  const [tabSize, setTabSize] = useState(currentSettings.tabSize);

  function handleSave() {
    onSettingsChange({ theme, fontSize, tabSize });
    onClose();
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <label>Theme</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="vs-dark">Dark (default)</option>
              <option value="vs-light">Light</option>
              <option value="hc-black">High Contrast</option>
            </select>
          </div>

          <div className="setting-item">
            <label>Font Size</label>
            <input
              type="number"
              min="10"
              max="24"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>

          <div className="setting-item">
            <label>Tab Size</label>
            <input
              type="number"
              min="2"
              max="8"
              value={tabSize}
              onChange={(e) => setTabSize(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
