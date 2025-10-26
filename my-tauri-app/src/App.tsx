import { useEffect, useState } from "react";
import "./App.css";
import { ChatComponent } from "./components/ChatComponent";
import { ActionHistoryPanel, ActionEntry } from "./components/ActionHistoryPanel";

const HISTORY_STORAGE_KEY = "videoAnalyzerActionHistory";
const LAST_VIDEO_STORAGE_KEY = "videoAnalyzerLastVideoId";
const MAX_ACTIONS = 40;

function App() {
  const [currentVideoId, setCurrentVideoId] = useState("");
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]);

  useEffect(() => {
    const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (storedHistory) {
      try {
        setActionHistory(JSON.parse(storedHistory));
      } catch {
        setActionHistory([]);
      }
    }
    const storedVideoId = localStorage.getItem(LAST_VIDEO_STORAGE_KEY);
    if (storedVideoId) {
      setCurrentVideoId(storedVideoId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LAST_VIDEO_STORAGE_KEY, currentVideoId);
  }, [currentVideoId]);

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
    setCurrentVideoId(videoId);
    pushAction({
      type: "upload",
      title: "Uploaded video",
      subtitle: filename,
      videoId
    });
  }

  function handleChatAction(query: string, summary: string) {
    pushAction({
      type: "chat",
      title: "Chat prompt sent",
      subtitle: `${query}\n---\n${summary}`,
      videoId: currentVideoId
    });
  }

  function clearHistory() {
    setActionHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  return (
    <main className="container" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1>🎥 Video AI Processor</h1>
      <p>Upload MP4 files, then chat with them. All actions are logged so you always know the active video.</p>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <ChatComponent
          videoId={currentVideoId}
          onVideoUploaded={handleUploadComplete}
          onChatAction={handleChatAction}
        />
        <ActionHistoryPanel actions={actionHistory} onClearHistory={clearHistory} />
      </div>
    </main>
  );
}

export default App;
