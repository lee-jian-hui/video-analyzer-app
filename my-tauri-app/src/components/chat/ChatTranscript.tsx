import type { ConversationEntry } from "./types";

interface ChatTranscriptProps {
  conversation: ConversationEntry[];
  renderContent: (text: string) => React.ReactNode;
}

export function ChatTranscript({ conversation, renderContent }: ChatTranscriptProps) {
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
      <h3 style={{ marginBottom: "0.75rem" }}>Chat transcript</h3>
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
          <p style={{ color: "#6c757d" }}>No conversation yet. Send a prompt to get started.</p>
        )}
        {conversation.map((entry) => {
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
      </div>
    </div>
  );
}

export type { ConversationEntry };
