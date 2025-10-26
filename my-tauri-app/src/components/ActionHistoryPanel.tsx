export interface ActionEntry {
  id: string;
  type: "upload" | "chat";
  timestamp: number;
  title: string;
  subtitle?: string;
  videoId?: string;
}

interface ActionHistoryPanelProps {
  actions: ActionEntry[];
  onClearHistory: () => void;
}

export function ActionHistoryPanel({
  actions,
  onClearHistory
}: ActionHistoryPanelProps) {
  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleString();
  }

  return (
    <section
      className="action-history-panel"
      style={{ background: "#fff", borderRadius: "10px", border: "1px solid #e9ecef", padding: "1.5rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>📚 Action Trail</h2>
        <button
          onClick={onClearHistory}
          disabled={!actions.length}
          style={{ padding: "0.35rem 0.75rem" }}
        >
          Clear
        </button>
      </div>
      <p style={{ color: "#6c757d", marginTop: "0.5rem" }}>
        Tracks uploads and chat prompts so you always know which video was processed last.
      </p>
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {actions.length === 0 && (
          <p style={{ color: "#6c757d" }}>No actions recorded yet. Upload a video or send a chat prompt.</p>
        )}
        {actions.map((action) => (
          <div
            key={action.id}
            style={{
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "0.75rem",
              background: action.type === "upload" ? "#e8f7ff" : "#f8f9fa"
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {action.title}
              <span style={{ marginLeft: "0.5rem", color: "#6c757d", fontWeight: 400 }}>
                {formatTimestamp(action.timestamp)}
              </span>
            </div>
            {action.subtitle && <p style={{ marginTop: "0.35rem" }}>{action.subtitle}</p>}
            {action.videoId && (
              <p style={{ marginTop: "0.35rem", fontSize: "0.9rem", color: "#0d6efd" }}>
                Video ID: {action.videoId}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
