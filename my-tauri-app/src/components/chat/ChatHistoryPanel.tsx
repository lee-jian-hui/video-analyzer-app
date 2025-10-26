import type { ChatMessage } from "./types";

interface ChatHistoryPanelProps {
  history: ChatMessage[];
  status: "idle" | "loading" | "error";
  errorMessage: string;
  onRefresh: () => void;
  formatTimestamp: (value?: number) => string;
}

export function ChatHistoryPanel({
  history,
  status,
  errorMessage,
  onRefresh,
  formatTimestamp
}: ChatHistoryPanelProps) {
  return (
    <section
      className="history-panel"
      style={{
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid #e9ecef",
        padding: "1.5rem",
        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>🕒 Recent Chat History</h2>
        <button onClick={onRefresh} disabled={status === "loading"}>
          {status === "loading" ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {status === "error" && (
        <p style={{ color: "#dc3545", marginTop: "0.5rem" }}>Failed to load history: {errorMessage}</p>
      )}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxHeight: "300px",
          overflowY: "auto"
        }}
      >
        {history.length === 0 && status !== "loading" && (
          <p style={{ color: "#6c757d" }}>No cached history yet. Run a query to populate this panel.</p>
        )}
        {history.map((message, index) => (
          <div
            key={`${message.timestamp}-${index}`}
            style={{ border: "1px solid #dee2e6", borderRadius: "12px", padding: "0.75rem", background: "#f8f9fa" }}
          >
            <div style={{ fontWeight: 600 }}>
              {message.role ?? "system"}
              <span style={{ marginLeft: "0.5rem", color: "#6c757d", fontWeight: 400 }}>
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <p style={{ marginTop: "0.35rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {message.content ?? "(empty)"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
