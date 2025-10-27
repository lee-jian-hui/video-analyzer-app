import type { ConversationEntry } from "./types";

interface LiveChatProps {
  conversation: ConversationEntry[];
  renderContent: (text: string) => React.ReactNode;
  customQuery: string;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  loading: boolean;
  resumeLoading?: boolean;
  activeVideoName?: string;
  uploadStatus: string;
  onUploadClick: () => void;
  onQuickAction: (prompt: string) => void;
  videoId: string;
  onClearChat: () => void;
  clearing?: boolean;
}

export function LiveChat({
  conversation,
  renderContent,
  customQuery,
  onQueryChange,
  onSend,
  canSend,
  loading,
  resumeLoading,
  activeVideoName,
  uploadStatus,
  onUploadClick,
  onQuickAction,
  videoId,
  onClearChat,
  clearing
}: LiveChatProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };
  return (
    <div
      style={{
        marginTop: "1.25rem",
        background: "#fff",
        borderRadius: "16px",
        border: "1px solid #e9ecef",
        padding: "1rem",
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      <h3 style={{ marginBottom: "0.75rem" }}>💬 Live Chat</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxHeight: "350px",
          overflowY: "auto"
        }}
      >
        {conversation.length === 0 && (
          <p style={{ color: "#6c757d" }}>
            {resumeLoading ? "Loading previous session summary…" : "No conversation yet. Send a prompt to get started."}
          </p>
        )}
        {conversation
          .filter((entry) => entry && entry.content && entry.content.trim())
          .map((entry) => {
            const isUser = entry.role === "user";
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start"
                }}
              >
                <div
                  style={{
                    width: "min(70%, 560px)",
                    maxWidth: "100%",
                    padding: "0.85rem 1rem",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser ? "#dbe7ff" : "#f2f4f7",
                    color: "#1f1f1f",
                    textAlign: "left",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
                    wordBreak: "break-word",
                    boxSizing: "border-box"
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.35rem",
                      color: "#6c757d"
                    }}
                  >
                    {isUser ? "You" : "Assistant"}
                  </div>
                  {renderContent(entry.content)}
                </div>
              </div>
            );
          })}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "18px 18px 18px 4px",
                background: "#f2f4f7",
                color: "#6c757d",
                fontStyle: "italic"
              }}
            >
              Assistant is typing...
            </div>
          </div>
        )}
        {resumeLoading && !loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "18px 18px 18px 4px",
                background: "#f2f4f7",
                color: "#6c757d",
                fontStyle: "italic"
              }}
            >
              Loading previous session summary…
            </div>
          </div>
        )}
      </div>

      {/* Upload Status and Quick Actions */}
      <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
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
              fontWeight: 600,
              cursor: "pointer"
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            onClick={() => onQuickAction("Transcribe the entire video and provide the full transcript.")}
            disabled={!videoId || loading || !!resumeLoading}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              background: videoId && !loading && !resumeLoading ? "#fff" : "#f8f9fa",
              cursor: videoId && !loading && !resumeLoading ? "pointer" : "not-allowed"
            }}
          >
            📝 Transcribe
          </button>
          <button
            onClick={() => onQuickAction("Summarize the key points and main themes of this video.")}
            disabled={!videoId || loading || !!resumeLoading}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              background: videoId && !loading && !resumeLoading ? "#fff" : "#f8f9fa",
              cursor: videoId && !loading && !resumeLoading ? "pointer" : "not-allowed"
            }}
          >
            📋 Summarize
          </button>
          <button
            onClick={() => onQuickAction("Detect all obejcts in the video")}
            disabled={!videoId || loading || !!resumeLoading}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              background: videoId && !loading && !resumeLoading ? "#fff" : "#f8f9fa",
              cursor: videoId && !loading && !resumeLoading ? "pointer" : "not-allowed"
            }}
          >
            🔍 Analyze Objects
          </button>
          <button
            onClick={() => onQuickAction("Generate a PDF Report of the video")}
            disabled={!videoId || loading || !!resumeLoading}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
              background: videoId && !loading && !resumeLoading ? "#fff" : "#f8f9fa",
              cursor: videoId && !loading && !resumeLoading ? "pointer" : "not-allowed"
            }}
          >
            📊 PDF Report
          </button>

          <button
            onClick={onClearChat}
            disabled={!videoId || loading || clearing}
            title={videoId ? "Clear current chat history" : "No active video"}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid #f1c0c0",
              background: !videoId || loading || clearing ? "#f8f9fa" : "#fff4f4",
              color: "#b02a37",
              cursor: !videoId || loading || clearing ? "not-allowed" : "pointer"
            }}
          >
            {clearing ? "Clearing…" : "🧹 Clear Chat"}
          </button>
        </div>
      </div>

      {/* Prompt Input */}
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
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
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
          disabled={loading || !!resumeLoading}
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
    </div>
  );
}

export type { ConversationEntry };
