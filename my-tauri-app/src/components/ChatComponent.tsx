import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChatPromptComposer } from "./chat/ChatPromptComposer";
import { ChatTranscript } from "./chat/ChatTranscript";
import { ChatResultsPanel } from "./chat/ChatResultsPanel";
import { ChatHistoryPanel } from "./chat/ChatHistoryPanel";
import type { ChatResponseItem, ChatMessage, ConversationEntry } from "./chat/types";

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

        <ChatPromptComposer
          customQuery={customQuery}
          onQueryChange={(value) => setCustomQuery(value)}
          onSend={() => processQuery("custom")}
          canSend={!!customQuery.trim() && !!videoId && !loading}
          loading={loading}
          activeVideoName={activeVideoName}
          uploadStatus={uploadStatus}
          onUploadClick={triggerFileDialog}
          onQuickAction={(type, prompt) => processQuery(type, prompt)}
          videoId={videoId}
        />

        <ChatTranscript conversation={conversation} renderContent={renderConversationContent} />

        {loading && <p style={{ marginTop: "1rem", color: "#0d6efd" }}>Streaming response...</p>}
      </section>

      <ChatResultsPanel resultSummary={resultSummary} chatStream={chatStream} formatChunk={formatChunk} />

      <ChatHistoryPanel
        history={history}
        status={historyStatus}
        errorMessage={historyError}
        onRefresh={refreshHistory}
        formatTimestamp={formatHistoryTimestamp}
      />
    </div>
  );
}
