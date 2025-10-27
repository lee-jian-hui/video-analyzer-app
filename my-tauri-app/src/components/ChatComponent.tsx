import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LiveChat } from "./chat/LiveChat";
import type { ChatResponseItem, ConversationEntry } from "./chat/types";

interface ChatComponentProps {
  videoId: string;
  activeVideoName?: string;
  onVideoUploaded: (videoId: string, filename: string) => void;
  onChatAction: (query: string, summary: string, stream: ChatResponseItem[]) => void;
  initialAssistantMessage?: string;
  resumeLoading?: boolean;
  backendReady?: boolean;
}

const DEFAULT_RESULT_COPY =
  "Run a query to see the assistant response. Streaming chunks will be rendered here.";
const MAX_INLINE_CHARS = 400;

export function ChatComponent({ videoId, activeVideoName, onVideoUploaded, onChatAction, initialAssistantMessage, resumeLoading, backendReady }: ChatComponentProps) {
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("[Chat] Active video changed:", videoId, "— clearing local conversation");
    setConversation([]);
  }, [videoId]);

  // Seed assistant message when resuming a session
  useEffect(() => {
    const msg = initialAssistantMessage?.trim();
    if (msg && conversation.length === 0) {
      console.log("[Chat] Seeding assistant resume message (chars):", msg.length);
      setConversation([
        {
          id: `assistant-seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          content: msg,
        },
      ]);
    }
  }, [initialAssistantMessage, videoId]);

  function triggerFileDialog() {
    if (!backendReady) {
      console.warn("[Chat] Upload blocked — backend not ready");
      return;
    }
    fileInputRef.current?.click();
  }

  function addConversationEntry(role: "user" | "assistant", content: string) {
    // Ensure content is valid and not empty
    if (!content || typeof content !== 'string' || !content.trim()) {
      console.warn(`Skipping conversation entry with invalid content:`, content);
      return;
    }

    const trimmedContent = content.trim();

    // Avoid adding duplicate DEFAULT_RESULT_COPY messages
    if (trimmedContent === DEFAULT_RESULT_COPY) {
      console.warn(`Skipping default placeholder message`);
      return;
    }

    setConversation((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content: trimmedContent
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

  async function handleClearChat() {
    if (!videoId) return;
    if (typeof window !== "undefined") {
      const yes = window.confirm("Clear chat history for the current video? This cannot be undone.");
      if (!yes) return;
    }
    setClearing(true);
    try {
      console.log("[Chat] Clearing server chat history for:", videoId);
      await invoke("clear_chat_history", { video_id: videoId });
      setConversation([]);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    } finally {
      setClearing(false);
    }
  }

  function summarizeStream(stream: ChatResponseItem[]) {
    if (!stream.length) {
      return DEFAULT_RESULT_COPY;
    }

    const reversed = [...stream].reverse();
    const bestChunk =
      reversed.find((chunk) => chunk.type === 2 && chunk.content) ||
      reversed.find((chunk) => chunk.content);

    if (bestChunk?.content) {
      return bestChunk.content.trim();
    }

    if (bestChunk?.result_json) {
      return bestChunk.result_json;
    }

    return DEFAULT_RESULT_COPY;
  }

function renderConversationContent(text: string) {
  // Handle undefined, null, or empty strings
  if (!text || typeof text !== 'string' || !text.trim()) {
    return <div style={{ color: "#dc3545", fontStyle: "italic" }}>(empty response)</div>;
  }

  const trimmedText = text.trim();

  if (trimmedText.length <= MAX_INLINE_CHARS) {
    return <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{trimmedText}</div>;
  }

  const preview = trimmedText.slice(0, MAX_INLINE_CHARS);
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
          {trimmedText}
        </pre>
      </details>
    </div>
  );
}

  async function processQuery() {
    if (!videoId) {
      console.warn("[Chat] Cannot send — no active video");
      return;
    }

    const query = customQuery.trim();

    if (!query) {
      return;
    }

    addConversationEntry("user", query);
    setCustomQuery(""); // Clear input after sending

    console.log("[Chat] Sending query:", query);
    setLoading(true);

    try {
      const response = await invoke("process_query", {
        video_id: videoId,
        query,
        query_type: "custom"
      });

      if (Array.isArray(response)) {
        const stream = response as ChatResponseItem[];
        const summary = summarizeStream(stream);
        onChatAction(query, summary, stream);
        addConversationEntry("assistant", summary);
      } else {
        const result = response as { result?: string; success?: boolean; error_message?: string };
        if (result.success && result.result) {
          onChatAction(query, result.result, []);
          addConversationEntry("assistant", result.result);
        } else {
          const errorMessage =
            result.error_message ? `❌ Error: ${result.error_message}` : "Unexpected response from backend";
          addConversationEntry("assistant", errorMessage);
          onChatAction(query, errorMessage, []);
        }
      }
    } catch (error) {
      const errorMessage = `❌ Error sending query: ${error}`;
      addConversationEntry("assistant", errorMessage);
      onChatAction(query, errorMessage, []);
    } finally {
      console.log("[Chat] Done handling query");
      setLoading(false);
    }
  }

  function handleQuickAction(prompt: string) {
    setCustomQuery(prompt);
  }

  return (
    <>
      <input
        type="file"
        accept=".mp4,video/mp4"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <LiveChat
        conversation={conversation}
        renderContent={renderConversationContent}
        customQuery={customQuery}
        onQueryChange={(value) => setCustomQuery(value)}
        onSend={processQuery}
        canSend={!!customQuery.trim() && !!videoId && !loading && !resumeLoading && !!backendReady}
        loading={loading}
        resumeLoading={!!resumeLoading}
        backendReady={!!backendReady}
        activeVideoName={activeVideoName}
        uploadStatus={uploadStatus}
        onUploadClick={triggerFileDialog}
        onQuickAction={handleQuickAction}
        videoId={videoId}
        onClearChat={handleClearChat}
        clearing={clearing}
      />
    </>
  );
}
