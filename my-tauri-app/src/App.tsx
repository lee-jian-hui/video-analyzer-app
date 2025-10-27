import { useEffect, useState, type CSSProperties } from "react";
import "./App.css";
import { ChatComponent } from "./components/ChatComponent";
import { ActionHistoryPanel, ActionEntry } from "./components/ActionHistoryPanel";
import { ChatResultsPanel } from "./components/chat/ChatResultsPanel";
import { ChatHistoryPanel } from "./components/chat/ChatHistoryPanel";
import type { ChatResponseItem, ChatMessage } from "./components/chat/types";
import { appLayoutConfig, isFullscreenViewport, historyConfig } from "./configs";
import { invoke } from "@tauri-apps/api/core";
import { storageManager, StorageKey } from "./utils/localStorageManager";

const MAX_ACTIONS = 40;
const DEFAULT_RESULT_COPY = "Run a query to see the assistant response. Streaming chunks will be rendered here.";
const RESPONSE_LABELS: Record<number, string> = {
  0: "Message",
  1: "Progress",
  2: "Result",
  3: "Error"
};

function App() {
  const [currentVideo, setCurrentVideo] = useState<{ id: string; name: string } | null>(null);
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : appLayoutConfig.defaultWidth
  );

  // Chat results state
  const [resultSummary, setResultSummary] = useState(DEFAULT_RESULT_COPY);
  const [chatStream, setChatStream] = useState<ChatResponseItem[]>([]);

  // Chat history state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("idle");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    // Restore action history from localStorage
    const storedHistory = storageManager.get(StorageKey.ACTION_HISTORY, []);
    setActionHistory(storedHistory);

    // Restore last video from localStorage
    const storedVideo = storageManager.get(StorageKey.LAST_VIDEO, null);
    if (storedVideo?.id && storedVideo?.name) {
      setCurrentVideo(storedVideo);
    }

    // Print debug summary in development
    if (import.meta.env.DEV) {
      storageManager.debugPrintSummary();
    }
  }, []);

  useEffect(() => {
    if (currentVideo?.id && currentVideo?.name) {
      storageManager.set(StorageKey.LAST_VIDEO, {
        id: currentVideo.id,
        name: currentVideo.name,
        uploadedAt: Date.now()
      });
    } else {
      storageManager.remove(StorageKey.LAST_VIDEO);
    }
  }, [currentVideo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    storageManager.set(StorageKey.ACTION_HISTORY, actionHistory);
  }, [actionHistory]);

  useEffect(() => {
    refreshChatHistory();
  }, []);

  async function refreshChatHistory(limit = historyConfig.limit) {
    setHistoryStatus("loading");
    setHistoryError("");
    try {
      const response = await invoke("get_processing_status", { limit });
      const parsed = response as { messages?: ChatMessage[] };
      setChatHistory(parsed.messages ?? []);
      setHistoryStatus("idle");
    } catch (error) {
      setHistoryStatus("error");
      setHistoryError(String(error));
    }
  }

  function formatHistoryTimestamp(ts?: number) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleString();
  }

  function formatChunk(chunk: ChatResponseItem) {
    const label = RESPONSE_LABELS[chunk.type] ?? `Type ${chunk.type}`;
    const agent = chunk.agent_name ? ` · ${chunk.agent_name}` : "";
    return `${label}${agent}`;
  }

  function pushAction(entry: Omit<ActionEntry, "id" | "timestamp">) {
    const newEntry: ActionEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now()
    };
    setActionHistory((prev) => [newEntry, ...prev].slice(0, MAX_ACTIONS));
  }

  function handleUploadComplete(videoId: string, filename: string) {
    const nextVideo = { id: videoId, name: filename };
    setCurrentVideo(nextVideo);
    pushAction({
      type: "upload",
      title: "Uploaded video",
      subtitle: filename,
      videoId,
      videoName: filename
    });
  }

  function handleChatAction(query: string, summary: string, stream: ChatResponseItem[]) {
    pushAction({
      type: "chat",
      title: "Chat prompt sent",
      subtitle: `${query}\n---\n${summary}`,
      videoId: currentVideo?.id,
      videoName: currentVideo?.name
    });

    // Update results panel
    setResultSummary(summary);
    setChatStream(stream);

    // Refresh chat history
    refreshChatHistory();
  }

  function clearHistory() {
    setActionHistory([]);
    storageManager.remove(StorageKey.ACTION_HISTORY);
  }

  const fullscreen = isFullscreenViewport(viewportWidth);
  const containerStyle: CSSProperties = {
    maxWidth: fullscreen ? "min(1250px, 95vw)" : `${appLayoutConfig.defaultWidth}px`,
    width: "100%",
    margin: "0 auto",
    paddingTop: `${appLayoutConfig.containerPaddingTopVH}vh`,
    minHeight: `${appLayoutConfig.defaultHeight}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    boxSizing: "border-box",
    paddingLeft: "1.25rem",
    paddingRight: "1.25rem"
  };

  return (
    <main className="container" style={containerStyle}>
      <h1>🎥 Video AI Processor</h1>
      <p>Upload MP4 files, then chat with them. All actions are logged so you always know the active video.</p>

      <div style={{ display: "grid", gap: "1.5rem" , width: "100%"}}>
        <ChatComponent
          videoId={currentVideo?.id ?? ""}
          activeVideoName={currentVideo?.name}
          onVideoUploaded={handleUploadComplete}
          onChatAction={handleChatAction}
        />

        {/* <ChatResultsPanel
          resultSummary={resultSummary}
          chatStream={chatStream}
          formatChunk={formatChunk}
        />

        <ChatHistoryPanel
          history={chatHistory}
          status={historyStatus}
          errorMessage={historyError}
          onRefresh={refreshChatHistory}
          formatTimestamp={formatHistoryTimestamp}
        />

        <ActionHistoryPanel actions={actionHistory} onClearHistory={clearHistory} /> */}
      </div>
    </main>
  );
}

export default App;
