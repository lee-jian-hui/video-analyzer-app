import { useEffect, useState, type CSSProperties } from "react";
import "./App.css";
import { ChatComponent } from "./components/ChatComponent";
import type { ConversationEntry } from "./components/chat/types";
import { appLayoutConfig, isFullscreenViewport, historyConfig } from "./configs";
import { invoke } from "@tauri-apps/api/core";
// Removed localStorage persistence; backend is the source of truth

const DEFAULT_RESULT_COPY = "Run a query to see the assistant response. Streaming chunks will be rendered here.";

function App() {
  const [currentVideo, setCurrentVideo] = useState<{ id: string; name: string } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : appLayoutConfig.defaultWidth
  );

  // Chat results state
  // Results panel removed; keep minimal state only if needed later

  // Chat history state
  // History panel removed
  const [initialAssistantMessage, setInitialAssistantMessage] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [initialConversation, setInitialConversation] = useState<ConversationEntry[] | undefined>(undefined);

  // No local persistence or action history

  // Do not persist active video locally; derive it from backend last session instead

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // No local persistence for action history

  // No history panel refresh

  // Poll backend readiness (simple ping via get_last_session)
  useEffect(() => {
    let cancelled = false;
    async function pollReadiness() {
      console.log("[Ready] Polling backend readiness...");
      const start = Date.now();
      let attempts = 0;
      while (!cancelled && attempts < 30) {
        try {
          const resp = await invoke("check_backend_ready");
          const res = resp as { ready?: boolean; message?: string };
          console.log("[Ready] check_backend_ready:", res);
          if (res.ready) {
            setBackendReady(true);
            return;
          }
        } catch (e) {
          console.warn("[Ready] readiness check error:", e);
        }
        attempts += 1;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) {
        setBackendReady(false);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.warn(`[Ready] Backend not ready after ${elapsed}s`);
      }
    }
    pollReadiness();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prompt user to optionally continue from last session and seed chat
  // Runs once after backend becomes ready
  const [resumeChecked, setResumeChecked] = useState(false);
  useEffect(() => {
    async function maybeResumeLastSession() {
      try {
        if (!backendReady) {
          console.log("[Resume] Backend not ready yet; deferring last session check");
          return;
        }
        if (resumeChecked) {
          return;
        }
        console.log("[Resume] Checking last session (backend ready)…");
        const resp = await invoke("get_last_session");
        const last = resp as {
          has_session?: boolean;
          video_id?: string;
          video_name?: string;
        };

        console.log("[Resume] get_last_session response:", last);
        if (!last?.has_session) {
          console.log("[Resume] No previous session found.");
          setResumeChecked(true);
          return;
        }
        if (typeof window === "undefined") return;

        // Prefetch minimal history to decide whether to prompt at all
        if (!last.video_id) {
          setResumeChecked(true);
          return;
        }

        try {
          setResumeLoading(true);
          console.log("[Resume] Prefetching chat history to decide prompt for:", last.video_id);
          // Ensure backend restores the previous session context first
          try {
            const resumeResp = await invoke("resume_session", { video_id: last.video_id });
            console.log("[Resume] resume_session response:", resumeResp);
          } catch (resumeErr) {
            console.warn("[Resume] resume_session failed (continuing anyway):", resumeErr);
          }

          const includeFullForDecision = true; // fetch recent messages to check if any exist
          const histResp = await invoke("get_chat_history", {
            video_id: last.video_id,
            include_full_messages: includeFullForDecision,
          });
          const preHistory = histResp as {
            conversation_summary?: string;
            recent_messages?: { role?: string; content?: string }[];
          };

          const hasSummary = !!preHistory?.conversation_summary && preHistory.conversation_summary.trim().length > 0;
          const hasMessages = !!preHistory?.recent_messages && preHistory.recent_messages.length > 0;

          if (!hasSummary && !hasMessages) {
            console.log("[Resume] No prior summary or messages. Skipping resume prompt.");
            setResumeChecked(true);
            setResumeLoading(false);
            return;
          }

          const name = last.video_name ?? "previous video";
          const shouldContinue = window.confirm(
            `Continue from previous session with \"${name}\"?\nClick OK to resume, or Cancel to start fresh.`
          );

          if (shouldContinue) {
            // Set active video and seed using the pre-fetched history according to config
            setCurrentVideo({ id: last.video_id, name: last.video_name ?? "Untitled" });

            if (historyConfig.resumeUseSummary && hasSummary) {
              const msg = preHistory.conversation_summary!.trim();
              setInitialAssistantMessage(msg);
              setInitialConversation(undefined);
            } else if (hasMessages && preHistory.recent_messages) {
              const entries: ConversationEntry[] = preHistory.recent_messages
                .map((m, i) => ({
                  id: `resume-${Date.now()}-${i}`,
                  role: (m.role === 'user' ? 'user' : 'assistant') as const,
                  content: (m.content ?? '').trim(),
                }))
                .filter((e) => e.content.length > 0);
              setInitialAssistantMessage(null);
              setInitialConversation(entries);
            }
            setResumeChecked(true);
          } else {
            // User opted out; clear server-side history and start fresh
            try {
              console.log("[Resume] Clearing chat history for:", last.video_id);
              await invoke("clear_chat_history", { video_id: last.video_id });
            } catch (err) {
              console.error("Failed to clear chat history:", err);
            } finally {
              // Also clear local active video so it doesn't persist on restart
              setCurrentVideo(null);
              setInitialAssistantMessage(null);
              setInitialConversation(undefined);
              setResumeChecked(true);
            }
          }
        } finally {
          setResumeLoading(false);
        }
      } catch (error) {
        console.error("Failed to check last session:", error);
        setResumeChecked(true);
      }
    }

    if (backendReady && !resumeChecked) {
      maybeResumeLastSession();
    }
  }, [backendReady, resumeChecked]);

  // Removed history/results helpers

  function handleUploadComplete(videoId: string, filename: string) {
    const nextVideo = { id: videoId, name: filename };
    setCurrentVideo(nextVideo);
  }

  function handleClearActiveVideo() {
    console.log("[App] Clearing active video selection");
    setCurrentVideo(null);
    setInitialAssistantMessage(null);
    setInitialConversation(undefined);
  }

  function handleChatAction(_query?: unknown, _summary?: unknown, _stream?: unknown) {
    // Results/action history panels removed; no-op hook for now
  }

  // Action history removed

  const fullscreen = isFullscreenViewport(viewportWidth);
  const containerStyle: CSSProperties = {
    maxWidth: fullscreen ? "min(1250px, 95vw)" : `${appLayoutConfig.defaultWidth}px`,
    width: "100%",
    height: "100vh",
    margin: "0 auto",
    paddingTop: `${appLayoutConfig.containerPaddingTopVH}vh`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    boxSizing: "border-box",
    paddingLeft: "1.25rem",
    paddingRight: "1.25rem",
    overflow: "hidden"
  };

  return (
    <main className="container" style={containerStyle}>
      <h1>🎥 Video AI Processor</h1>
      <p>Upload MP4 files, then chat with them. All actions are logged so you always know the active video.</p>
      <div
        style={{
          display: "grid",
          gridTemplateRows: "1fr",
          gap: "1.5rem",
          width: "100%",
          flex: 1,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >

        <ChatComponent
          videoId={currentVideo?.id ?? ""}
          activeVideoName={currentVideo?.name}
          onVideoUploaded={handleUploadComplete}
          onChatAction={handleChatAction}
          initialAssistantMessage={initialAssistantMessage ?? undefined}
          initialConversation={initialConversation}
          resumeLoading={resumeLoading}
          backendReady={backendReady}
          onClearActiveVideo={handleClearActiveVideo}
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
