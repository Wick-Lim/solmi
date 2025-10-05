import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./SearchPanel.css";

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

interface FTSResult {
  file_path: string;
  line_number: number;
  content: string;
  language: string;
}

interface SearchPanelProps {
  folderPath: string;
  onResultClick: (file: string, line: number) => void;
}

export default function SearchPanel({ folderPath, onResultClick }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [useFTS, setUseFTS] = useState(true);

  async function handleSearch() {
    if (!query.trim() || !folderPath) return;

    setLoading(true);

    try {
      if (useFTS) {
        // FTS 검색 (Rust에서 비동기 처리)
        const ftsResults = await invoke<FTSResult[]>("fts_search", {
          folderPath,
          query: query.trim(),
        });

        const convertedResults: SearchResult[] = ftsResults.map(r => ({
          file: r.file_path,
          line: r.line_number,
          content: r.content
        }));

        setResults(convertedResults);
      } else {
        // grep 방식 (Rust에서 비동기 처리)
        const searchResults = await invoke<SearchResult[]>("search_in_files", {
          folderPath,
          query: query.trim(),
        });
        setResults(searchResults);
      }
    } catch (error) {
      console.error("Search failed:", error);
      // FTS 실패 시 fallback
      if (useFTS) {
        console.log("FTS failed, trying grep fallback...");
        setUseFTS(false);
        handleSearch();
      } else {
        setResults([]);
      }
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
          placeholder="Search in files... (supports: AND, OR, NOT, *)"
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
