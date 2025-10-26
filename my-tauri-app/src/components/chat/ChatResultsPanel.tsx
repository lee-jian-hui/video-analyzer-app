import type { ChatResponseItem } from "./types";

interface ChatResultsPanelProps {
  resultSummary: string;
  chatStream: ChatResponseItem[];
  formatChunk: (chunk: ChatResponseItem) => string;
}

export function ChatResultsPanel({ resultSummary, chatStream, formatChunk }: ChatResultsPanelProps) {
  return (
    <section
      className="results-panel"
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid #e9ecef",
        padding: "1.5rem",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)"
      }}
    >
      <h2>📄 Assistant Response</h2>
      <div
        style={{
          marginTop: "0.5rem",
          background: "#f8f9fa",
          borderRadius: "12px",
          padding: "1rem",
          border: "1px solid #e3e6ea",
          minHeight: "120px",
          maxHeight: "260px",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}
      >
        {resultSummary}
      </div>

      {chatStream.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginBottom: "0.75rem" }}>Stream details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {chatStream.map((chunk, index) => (
              <div
                key={`${chunk.type}-${index}`}
                style={{
                  border: "1px solid #dee2e6",
                  borderRadius: "12px",
                  padding: "0.75rem",
                  background: chunk.type === 3 ? "#fff5f5" : "#fdfdfd"
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{formatChunk(chunk)}</div>
                {chunk.content && (
                  <p style={{ marginBottom: "0.35rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {chunk.content}
                  </p>
                )}
                {chunk.result_json && (
                  <pre
                    style={{
                      background: "#212529",
                      color: "#f8f9fa",
                      padding: "0.5rem",
                      borderRadius: "6px",
                      overflowX: "auto",
                      fontSize: "0.85rem"
                    }}
                  >
                    {chunk.result_json}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
