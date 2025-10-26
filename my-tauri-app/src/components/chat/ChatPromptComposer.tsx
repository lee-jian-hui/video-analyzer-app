interface ChatPromptComposerProps {
  customQuery: string;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  loading: boolean;
  activeVideoName?: string;
  uploadStatus: string;
  onUploadClick: () => void;
  onQuickAction: (type: string, prompt: string) => void;
  videoId: string;
}

export function ChatPromptComposer({
  customQuery,
  onQueryChange,
  onSend,
  canSend,
  loading,
  activeVideoName,
  uploadStatus,
  onUploadClick,
  onQuickAction,
  videoId
}: ChatPromptComposerProps) {
  return (
    <div
      style={{
        marginTop: "1rem",
        background: "#fff",
        borderRadius: "16px",
        padding: "1rem",
        border: "1px solid #e9ecef",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem"
      }}
    >
      <label style={{ fontWeight: 600 }}>Prompt</label>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          padding: "0.5rem",
          borderRadius: "12px",
          border: "1px solid #dee2e6",
          background: "#fdfdfd"
        }}
      >
        <textarea
          value={customQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ask anything about the video..."
          rows={3}
          style={{
            flex: 1,
            border: "none",
            resize: "none",
            fontFamily: "inherit",
            fontSize: "1rem",
            outline: "none",
            background: "transparent",
            minHeight: "96px"
          }}
          disabled={loading}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "999px",
            background: canSend ? "#6f42c1" : "#ccc",
            color: "#fff",
            border: "none",
            cursor: canSend ? "pointer" : "not-allowed"
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap"
        }}
      >
        <button
          onClick={onUploadClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            borderRadius: "999px",
            border: "1px solid #0d6efd",
            padding: "0.4rem 0.95rem",
            background: "#e7f0ff",
            color: "#0d6efd",
            fontWeight: 600
          }}
          title="Upload MP4"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            <polyline points="7 9 12 4 17 9" />
            <line x1="12" y1="4" x2="12" y2="16" />
          </svg>
          Upload File
        </button>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, color: activeVideoName ? "#198754" : "#6c757d" }}>
            {activeVideoName ? `Active video: ${activeVideoName}` : "No active video"}
          </span>
          <small style={{ color: "#6c757d" }}>
            {uploadStatus || "Attach an MP4 and it becomes your chat context"}
          </small>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={() => onQuickAction("transcribe", "Transcribe the video")} disabled={!videoId || loading}>
          📝 Transcribe
        </button>
        <button onClick={() => onQuickAction("summarize", "Summarize the key points")} disabled={!videoId || loading}>
          📋 Summarize
        </button>
        <button
          onClick={() => onQuickAction("analyze", "What objects are shown in the video?")}
          disabled={!videoId || loading}
        >
          🔍 Analyze Objects
        </button>
        <button onClick={() => onQuickAction("extract", "Extract any tables or graphs.")} disabled={!videoId || loading}>
          📊 Extract Data
        </button>
      </div>
    </div>
  );
}
