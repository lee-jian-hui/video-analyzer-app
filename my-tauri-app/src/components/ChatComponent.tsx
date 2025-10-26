import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ChatResponseItem {
  type: number;
  content: string;
  agent_name?: string;
  result_json?: string;
}

interface ChatMessage {
  role?: string;
  content?: string;
  timestamp?: number;
}

interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatComponentProps {
  videoId: string;
  activeVideoName?: string;
  onVideoUploaded: (videoId: string, filename: string) => void;
  onChatAction: (query: string, summary: string) => void;
}

const RESPONSE_LABELS: Record<number, string> = {
  0: "Message",
  1: "Progress",
  2: "Result",
  3: "Error"
};

const DEFAULT_RESULT_COPY =
  "Run a query to see the assistant response. Streaming chunks will be rendered here.";
const MAX_INLINE_CHARS = 400;

export function ChatComponent({ videoId, activeVideoName, onVideoUploaded, onChatAction }: ChatComponentProps) {
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatStream, setChatStream] = useState<ChatResponseItem[]>([]);
  const [resultSummary, setResultSummary] = useState(DEFAULT_RESULT_COPY);
  const [uploadStatus, setUploadStatus] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [historyError, setHistoryError] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    setConversation([]);
    setResultSummary(DEFAULT_RESULT_COPY);
    setChatStream([]);
  }, [videoId]);

  function triggerFileDialog() {
    fileInputRef.current?.click();
  }

  function addConversationEntry(role: "user" | "assistant", content: string) {
    if (!content) return;
    setConversation((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content: content.trim()
      }
    ]);
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".mp4")) {
      setUploadStatus("Only MP4 files are supported right now.");
      event.target.value = "";
      return;
    }

    setUploadStatus("Uploading...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const videoData = Array.from(new Uint8Array(arrayBuffer));

      const response = await invoke("upload_video", {
        filename: file.name,
        video_data: videoData
      });

      const result = response as { file_id?: string; fileId?: string; success: boolean; message?: string };
      const fileId = result.file_id ?? result.fileId ?? "";

      if (result.success && fileId) {
        setUploadStatus(`✅ Uploaded ${file.name}`);
        onVideoUploaded(fileId, file.name);
      } else {
        setUploadStatus(`❌ Upload failed${result.message ? `: ${result.message}` : ""}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Upload error: ${error}`);
    } finally {
      event.target.value = "";
    }
  }

  function formatHistoryTimestamp(ts?: number) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleString();
  }

  function summarizeStream(stream: ChatResponseItem[]) {
    if (!stream.length) {
      setResultSummary(DEFAULT_RESULT_COPY);
      return DEFAULT_RESULT_COPY;
    }

    const reversed = [...stream].reverse();
    const bestChunk =
      reversed.find((chunk) => chunk.type === 2 && chunk.content) ||
      reversed.find((chunk) => chunk.content);

    if (bestChunk?.content) {
      const summary = bestChunk.content.trim();
      setResultSummary(summary);
      return summary;
    }

    if (bestChunk?.result_json) {
      setResultSummary(bestChunk.result_json);
      return bestChunk.result_json;
    }

    setResultSummary(DEFAULT_RESULT_COPY);
    return DEFAULT_RESULT_COPY;
  }

function formatChunk(chunk: ChatResponseItem) {
  const label = RESPONSE_LABELS[chunk.type] ?? `Type ${chunk.type}`;
  const agent = chunk.agent_name ? ` · ${chunk.agent_name}` : "";
  return `${label}${agent}`;
}

function renderConversationContent(text: string) {
  if (!text) return null;
  if (text.length <= MAX_INLINE_CHARS) {
    return <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</div>;
  }

  const preview = text.slice(0, MAX_INLINE_CHARS);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{preview}…</div>
      <details
        style={{
          background: "#f8f9fa",
          borderRadius: "8px",
          padding: "0.5rem",
          border: "1px solid #dee2e6"
        }}
      >
        <summary style={{ cursor: "pointer", color: "#0d6efd", fontWeight: 600 }}>
          View full response
        </summary>
        <pre
          style={{
            marginTop: "0.35rem",
            background: "#212529",
            color: "#f8f9fa",
            padding: "0.5rem",
            borderRadius: "6px",
            maxHeight: "240px",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {text}
        </pre>
      </details>
    </div>
  );
}

  async function refreshHistory(limit = 10) {
    setHistoryStatus("loading");
    setHistoryError("");
    try {
      const response = await invoke("get_processing_status", { limit });
      const parsed = response as { messages?: ChatMessage[] };
      setHistory(parsed.messages ?? []);
      setHistoryStatus("idle");
    } catch (error) {
      setHistoryStatus("error");
      setHistoryError(String(error));
    }
  }

  async function processQuery(queryType: string, predefinedQuery?: string) {
    if (!videoId) {
      setResultSummary("❌ Upload a video first – there is no active video.");
      return;
    }

    const query =
      predefinedQuery || customQuery.trim() || `Process video with type: ${queryType}`;

    if (!query) {
      setResultSummary("❌ Please provide a query.");
      return;
    }

    addConversationEntry("user", query);

    setLoading(true);
    setResultSummary("Processing...");

    try {
      const response = await invoke("process_query", {
        video_id: videoId,
        query,
        query_type: queryType
      });

      if (Array.isArray(response)) {
        const stream = response as ChatResponseItem[];
        setChatStream(stream);
        const summary = summarizeStream(stream);
        onChatAction(query, summary);
        addConversationEntry("assistant", summary);
      } else {
        const result = response as { result?: string; success?: boolean; error_message?: string };
        if (result.success && result.result) {
          setResultSummary(result.result);
          setChatStream([]);
          onChatAction(query, result.result);
          addConversationEntry("assistant", result.result);
        } else {
          const errorMessage =
            result.error_message ? `❌ Error: ${result.error_message}` : "Unexpected response from backend";
          setResultSummary(errorMessage);
          setChatStream([]);
          addConversationEntry("assistant", errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = `❌ Error sending query: ${error}`;
      setResultSummary(errorMessage);
      setChatStream([]);
      addConversationEntry("assistant", errorMessage);
    } finally {
      setLoading(false);
      refreshHistory();
    }
  }

  return (
    <div className="chat-layout" style={{ display: "grid", gap: "1.5rem" }}>
      <input
        type="file"
        accept=".mp4,video/mp4"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <section
        className="interaction-panel"
        style={{
          background: "#f8f9fa",
          padding: "1.5rem",
          borderRadius: "16px",
          border: "1px solid #e3e6ea",
          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.06)"
        }}
      >
        <h2>🤖 Assistant Workspace</h2>
        <p style={{ color: "#555" }}>
          Upload a video using the icon, then send prompts. The result panel shows structured responses and streaming status.
        </p>

        <div
          style={{
            marginTop: "1rem",
            background: "#fff",
            borderRadius: "16px",
            padding: "1rem",
            border: "1px solid #e9ecef"
          }}
        >
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>Prompt</label>
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
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Ask anything about the video..."
              rows={3}
              style={{
                flex: 1,
                border: "none",
                resize: "none",
                fontFamily: "inherit",
                fontSize: "1rem",
                outline: "none",
                background: "transparent"
              }}
              disabled={loading}
            />
            <button
              onClick={() => processQuery("custom")}
              disabled={loading || !customQuery.trim() || !videoId}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "999px",
                background: videoId ? "#6f42c1" : "#ccc",
                color: "#fff",
                border: "none",
                cursor: loading || !customQuery.trim() || !videoId ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <button
              onClick={triggerFileDialog}
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
        </div>

        <div
          style={{
            marginTop: "1.25rem",
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #e9ecef",
            padding: "1rem"
          }}
        >
          <h3 style={{ marginBottom: "0.75rem" }}>Chat transcript</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                      maxWidth: "85%",
                      padding: "0.85rem 1rem",
                      borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      background: isUser ? "#dbe7ff" : "#f2f4f7",
                      color: "#1f1f1f",
                      textAlign: "left",
                      boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)"
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
                    {renderConversationContent(entry.content)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
          <button onClick={() => processQuery("transcribe", "Transcribe the video")} disabled={loading || !videoId}>
            📝 Transcribe
          </button>
          <button onClick={() => processQuery("summarize", "Summarize the key points")} disabled={loading || !videoId}>
            📋 Summarize
          </button>
          <button onClick={() => processQuery("analyze", "What objects are shown in the video?")} disabled={loading || !videoId}>
            🔍 Analyze Objects
          </button>
          <button onClick={() => processQuery("extract", "Extract any tables or graphs.")} disabled={loading || !videoId}>
            📊 Extract Data
          </button>
        </div>

        {loading && <p style={{ marginTop: "1rem", color: "#0d6efd" }}>Streaming response...</p>}
      </section>

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
                  {chunk.content && <p style={{ marginBottom: "0.35rem" }}>{chunk.content}</p>}
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

      <section
        className="history-panel"
        style={{
          background: "#fff",
          borderRadius: "16px",
          border: "1px solid #e9ecef",
          padding: "1.5rem",
          boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>🕒 Recent Chat History</h2>
          <button onClick={() => refreshHistory()} disabled={historyStatus === "loading"}>
            {historyStatus === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {historyStatus === "error" && (
          <p style={{ color: "#dc3545", marginTop: "0.5rem" }}>Failed to load history: {historyError}</p>
        )}
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {history.length === 0 && historyStatus !== "loading" && (
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
                  {formatHistoryTimestamp(message.timestamp)}
                </span>
              </div>
              <p style={{ marginTop: "0.35rem" }}>{message.content ?? "(empty)"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
