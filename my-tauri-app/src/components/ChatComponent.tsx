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

interface ChatComponentProps {
  videoId: string;
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

export function ChatComponent({ videoId, onVideoUploaded, onChatAction }: ChatComponentProps) {
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatStream, setChatStream] = useState<ChatResponseItem[]>([]);
  const [resultSummary, setResultSummary] = useState(DEFAULT_RESULT_COPY);
  const [uploadStatus, setUploadStatus] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [historyError, setHistoryError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshHistory();
  }, []);

  function triggerFileDialog() {
    fileInputRef.current?.click();
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
      } else {
        const result = response as { result?: string; success?: boolean; error_message?: string };
        if (result.success && result.result) {
          setResultSummary(result.result);
          setChatStream([]);
          onChatAction(query, result.result);
        } else {
          setResultSummary(
            result.error_message ? `❌ Error: ${result.error_message}` : "Unexpected response from backend"
          );
          setChatStream([]);
        }
      }
    } catch (error) {
      setResultSummary(`❌ Error sending query: ${error}`);
      setChatStream([]);
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
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "#fff",
            borderRadius: "999px",
            padding: "0.25rem 0.75rem",
            border: "1px solid #dee2e6",
            marginTop: "1rem"
          }}
        >
          <button
            onClick={triggerFileDialog}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              border: "none",
              background: "#0d6efd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
            title="Upload video"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              <polyline points="7 9 12 4 17 9" />
              <line x1="12" y1="4" x2="12" y2="16" />
            </svg>
          </button>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, color: videoId ? "#198754" : "#6c757d" }}>
              {videoId ? `Active video: ${videoId}` : "No active video"}
            </span>
            <small style={{ color: "#6c757d" }}>{uploadStatus || "Click to upload an MP4 video"}</small>
          </div>
        </div>

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
            whiteSpace: "pre-wrap"
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
