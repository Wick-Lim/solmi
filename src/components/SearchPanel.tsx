import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./SearchPanel.css";

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

interface SearchPanelProps {
  folderPath: string;
  onResultClick: (file: string, line: number) => void;
}

export default function SearchPanel({ folderPath, onResultClick }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!query.trim() || !folderPath) return;

    setLoading(true);
    try {
      const searchResults = await invoke<SearchResult[]>("search_in_files", {
        folderPath,
        query: query.trim(),
      });
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    }
    setLoading(false);
  }

  return (
    <div className="search-panel">
      <div className="search-header">
        <h3>Search</h3>
      </div>
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search in files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
      <div className="search-results">
        {results.length === 0 && !loading && query && (
          <div className="no-results">No results found</div>
        )}
        {results.map((result, idx) => (
          <div
            key={idx}
            className="search-result-item"
            onClick={() => onResultClick(result.file, result.line)}
          >
            <div className="result-file">{result.file.split('/').pop()}</div>
            <div className="result-line">Line {result.line}</div>
            <div className="result-content">{result.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
