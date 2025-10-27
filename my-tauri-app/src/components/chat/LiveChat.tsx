import type { ConversationEntry } from "./types";
import { useEffect, useRef } from "react";

interface LiveChatProps {
  conversation: ConversationEntry[];
  renderContent: (text: string) => React.ReactNode;
  customQuery: string;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  loading: boolean;
  resumeLoading?: boolean;
  backendReady?: boolean;
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
  backendReady,
  activeVideoName,
  uploadStatus,
  onUploadClick,
  onQuickAction,
  videoId,
  onClearChat,
  clearing
}: LiveChatProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };
  // Auto-scroll to the latest message when conversation updates or resume completes
  useEffect(() => {
    // Allow the DOM to paint before scrolling
    const id = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [conversation.length]);

  useEffect(() => {
    if (!resumeLoading && conversation.length > 0) {
      const id = requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [resumeLoading]);

  return (
    <div
      style={{
        marginTop: "1.25rem",
        background: "var(--panel-bg)",
        borderRadius: "16px",
        border: "1px solid var(--panel-border)",
        padding: "1rem",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)"
      }}
    >
      <h3 style={{ marginBottom: "0.75rem" }}>💬 Live Chat</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          flex: 1,
          minHeight: 0,
          overflowY: "auto"
        }}
        ref={listRef}
      >
        {conversation.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            {!backendReady
              ? "Backend warming up…"
              : resumeLoading
              ? "Loading previous session ..."
              : "No conversation yet. Send a prompt to get started."}
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
                    background: isUser ? "var(--bubble-user)" : "var(--bubble-assistant)",
                    color: "var(--text)",
                    textAlign: "left",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
                    wordBreak: "break-word",
                    boxSizing: "border-box",
                    border: "1px solid var(--panel-border)"
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "0.35rem",
                      color: "var(--muted)"
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
                background: "var(--bubble-assistant)",
                color: "var(--muted)",
                fontStyle: "italic"
              }}
            >
              Assistant is typing...
            </div>
          </div>
        )}
        {(resumeLoading || !backendReady) && !loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "18px 18px 18px 4px",
                background: "var(--bubble-assistant)",
                color: "var(--muted)",
                fontStyle: "italic"
              }}
            >
              {!backendReady ? "Backend warming up…" : "Loading previous session ..."}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Upload Status and Quick Actions */}
      <div style={{ marginTop: "1rem", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <button
            onClick={onUploadClick}
            disabled={!backendReady}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              borderRadius: "999px",
              border: "1px solid var(--btn-border)",
              padding: "0.4rem 0.95rem",
              background: backendReady ? "var(--btn-bg)" : "var(--btn-hover)",
              color: backendReady ? "var(--text)" : "var(--muted)",
              fontWeight: 600,
              cursor: backendReady ? "pointer" : "not-allowed"
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
            <span style={{ fontWeight: 600, color: activeVideoName ? "var(--text)" : "var(--muted)" }}>
              {activeVideoName ? `Active video: ${activeVideoName}` : "No active video"}
            </span>
            <small style={{ color: "var(--muted)" }}>
              {uploadStatus || "Attach an MP4 and it becomes your chat context"}
            </small>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button
            onClick={() => onQuickAction("Transcribe the entire video and provide the full transcript.")}
            disabled={!videoId || loading || !!resumeLoading || !backendReady}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid var(--btn-border)",
              background: videoId && !loading && !resumeLoading && backendReady ? "var(--btn-bg)" : "var(--btn-hover)",
              cursor: videoId && !loading && !resumeLoading && backendReady ? "pointer" : "not-allowed"
            }}
          >
            📝 Transcribe
          </button>
          <button
            onClick={() => onQuickAction("“Summarize our discussion so far")}
            disabled={!videoId || loading || !!resumeLoading || !backendReady}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid var(--btn-border)",
              background: videoId && !loading && !resumeLoading && backendReady ? "var(--btn-bg)" : "var(--btn-hover)",
              cursor: videoId && !loading && !resumeLoading && backendReady ? "pointer" : "not-allowed"
            }}
          >
            📋 Summarize
          </button>
          <button
            onClick={() => onQuickAction("Detect all objects and entities in the video")}
            disabled={!videoId || loading || !!resumeLoading || !backendReady}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid var(--btn-border)",
              background: videoId && !loading && !resumeLoading && backendReady ? "var(--btn-bg)" : "var(--btn-hover)",
              cursor: videoId && !loading && !resumeLoading && backendReady ? "pointer" : "not-allowed"
            }}
          >
            🔍 Analyze Objects
          </button>
          <button
            onClick={() => onQuickAction("Generate a PDF Report of the video")}
            disabled={!videoId || loading || !!resumeLoading || !backendReady}
            style={{
              padding: "0.4rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid var(--btn-border)",
              background: videoId && !loading && !resumeLoading && backendReady ? "var(--btn-bg)" : "var(--btn-hover)",
              cursor: videoId && !loading && !resumeLoading && backendReady ? "pointer" : "not-allowed"
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
              border: "1px solid var(--btn-border)",
              background: !videoId || loading || clearing ? "var(--btn-hover)" : "#fff4f4",
              color: "var(--danger)",
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
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)"
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
            color: "var(--text)",
            minHeight: "96px"
          }}
          disabled={loading || !!resumeLoading || !backendReady}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "999px",
            background: canSend ? "var(--btn-bg)" : "var(--btn-hover)",
            color: "var(--text)",
            border: `1px solid var(--btn-border)`,
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
