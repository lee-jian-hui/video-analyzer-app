import { useEffect, useState, type CSSProperties } from "react";
import "./App.css";
import { ChatComponent } from "./components/ChatComponent";
import { ActionHistoryPanel, ActionEntry } from "./components/ActionHistoryPanel";
import { appLayoutConfig, isFullscreenViewport } from "./configs";

const HISTORY_STORAGE_KEY = "videoAnalyzerActionHistory";
const LAST_VIDEO_STORAGE_KEY = "videoAnalyzerLastVideo";
const MAX_ACTIONS = 40;

function App() {
  const [currentVideo, setCurrentVideo] = useState<{ id: string; name: string } | null>(null);
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : appLayoutConfig.defaultWidth
  );

  useEffect(() => {
    const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (storedHistory) {
      try {
        setActionHistory(JSON.parse(storedHistory));
      } catch {
        setActionHistory([]);
      }
    }
    const storedVideo = localStorage.getItem(LAST_VIDEO_STORAGE_KEY);
    if (storedVideo) {
      try {
        const parsed = JSON.parse(storedVideo);
        if (parsed?.id && parsed?.name) {
          setCurrentVideo(parsed);
        }
      } catch {
        setCurrentVideo(null);
        localStorage.removeItem(LAST_VIDEO_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (currentVideo?.id && currentVideo?.name) {
      localStorage.setItem(LAST_VIDEO_STORAGE_KEY, JSON.stringify(currentVideo));
    } else {
      localStorage.removeItem(LAST_VIDEO_STORAGE_KEY);
    }
  }, [currentVideo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(actionHistory));
  }, [actionHistory]);

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

  function handleChatAction(query: string, summary: string) {
    pushAction({
      type: "chat",
      title: "Chat prompt sent",
      subtitle: `${query}\n---\n${summary}`,
      videoId: currentVideo?.id,
      videoName: currentVideo?.name
    });
  }

  function clearHistory() {
    setActionHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
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
        <ActionHistoryPanel actions={actionHistory} onClearHistory={clearHistory} />
      </div>
    </main>
  );
}

export default App;
