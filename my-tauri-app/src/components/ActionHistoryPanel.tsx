import type { CSSProperties } from "react";

export interface ActionEntry {
  id: string;
  type: "upload" | "chat";
  timestamp: number;
  title: string;
  subtitle?: string;
  videoId?: string;
  videoName?: string;
}

interface ActionHistoryPanelProps {
  actions: ActionEntry[];
  onClearHistory: () => void;
}

const sectionStyle: CSSProperties = {
  background: "#fff",
  borderRadius: "10px",
  border: "1px solid #e9ecef",
  padding: "1.5rem",
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0 6px 14px rgba(15, 23, 42, 0.04)"
};

const detailsWrapperStyle: CSSProperties = {
  marginTop: "0.35rem"
};

const detailsStyle: CSSProperties = {
  marginTop: "0.35rem",
  background: "#f8f9fa",
  padding: "0.5rem",
  borderRadius: "6px",
  border: "1px solid #dee2e6"
};

const detailsSummaryStyle: CSSProperties = {
  cursor: "pointer",
  color: "#0d6efd",
  fontWeight: 600
};

const fullSubtitleStyle: CSSProperties = {
  marginTop: "0.35rem",
  background: "#212529",
  color: "#f8f9fa",
  padding: "0.5rem",
  borderRadius: "6px",
  maxHeight: "200px",
  overflow: "auto",
  whiteSpace: "pre-wrap"
};

const actionCardBaseStyle: CSSProperties = {
  border: "1px solid #dee2e6",
  borderRadius: "8px",
  padding: "0.75rem",
  boxSizing: "border-box"
};

export function ActionHistoryPanel({
  actions,
  onClearHistory
}: ActionHistoryPanelProps) {
  function formatTimestamp(ts: number) {
    return new Date(ts).toLocaleString();
  }

  function renderSubtitle(text?: string) {
    if (!text) return null;
    const MAX_SUBTITLE = 200;
    if (text.length <= MAX_SUBTITLE) {
      return <p style={{ marginTop: "0.35rem", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{text}</p>;
    }

    const preview = text.slice(0, MAX_SUBTITLE);
    return (
      <div style={detailsWrapperStyle}>
        <p style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{preview}…</p>
        <details style={detailsStyle}>
          <summary style={detailsSummaryStyle}>View full details</summary>
          <pre style={fullSubtitleStyle}>{text}</pre>
        </details>
      </div>
    );
  }

  return (
    <section className="action-history-panel" style={sectionStyle}>
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
              ...actionCardBaseStyle,
              background: action.type === "upload" ? "#e8f7ff" : "#f8f9fa"
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {action.title}
              <span style={{ marginLeft: "0.5rem", color: "#6c757d", fontWeight: 400 }}>
                {formatTimestamp(action.timestamp)}
              </span>
            </div>
            {renderSubtitle(action.subtitle)}
            {action.videoName && (
              <p style={{ marginTop: "0.35rem", fontSize: "0.9rem", color: "#0d6efd" }}>
                Video: {action.videoName}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
