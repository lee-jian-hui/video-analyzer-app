import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ChatComponentProps {
  uploadedVideoId: string;
}

export function ChatComponent({ uploadedVideoId }: ChatComponentProps) {
  const [queryResponse, setQueryResponse] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function processQuery(queryType: string, predefinedQuery?: string) {
    if (!uploadedVideoId) {
      setQueryResponse("❌ Please upload a video first");
      return;
    }

    const query = predefinedQuery || customQuery || `Process video with type: ${queryType}`;
    setLoading(true);
    setQueryResponse("Processing...");

    try {
      const response = await invoke("process_query", {
        video_id: uploadedVideoId,
        query: query,
        query_type: queryType
      });

      const result = response as { result: string; success: boolean; error_message: string };

      if (result.success) {
        setQueryResponse(result.result);
      } else {
        setQueryResponse(`❌ Error: ${result.error_message}`);
      }
    } catch (error) {
      setQueryResponse(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Query Section */}
      <div className="query-section" style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
        <h2>🤖 AI Video Analysis</h2>

        {/* Predefined Queries */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h3>Quick Actions:</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button
              onClick={() => processQuery("transcribe", "Transcribe the video")}
              disabled={loading || !uploadedVideoId}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
            >
              📝 Transcribe
            </button>
            <button
              onClick={() => processQuery("summarize", "Summarize the key points")}
              disabled={loading || !uploadedVideoId}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px" }}
            >
              📋 Summarize
            </button>
            <button
              onClick={() => processQuery("analyze", "What objects are shown in the video?")}
              disabled={loading || !uploadedVideoId}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "4px" }}
            >
              🔍 Analyze Objects
            </button>
            <button
              onClick={() => processQuery("extract", "Are there any graphs? Describe them.")}
              disabled={loading || !uploadedVideoId}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#ffc107", color: "black", border: "none", borderRadius: "4px" }}
            >
              📊 Extract Data
            </button>
          </div>
        </div>

        {/* Custom Query */}
        <div style={{ marginBottom: "1rem" }}>
          <h3>Custom Query:</h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Ask anything about your video..."
              style={{ flex: 1, padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px" }}
              disabled={loading}
            />
            <button
              onClick={() => processQuery("analyze")}
              disabled={loading || !uploadedVideoId || !customQuery.trim()}
              style={{ padding: "0.5rem 1rem", backgroundColor: "#6f42c1", color: "white", border: "none", borderRadius: "4px" }}
            >
              🚀 Process
            </button>
          </div>
        </div>

        {loading && <p style={{ color: "#007bff" }}>🔄 Processing your request...</p>}
      </div>

      {/* Results Section */}
      <div className="results-section">
        <h2>📄 Results</h2>
        <div style={{
          backgroundColor: "#fff",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          minHeight: "200px",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          lineHeight: "1.5"
        }}>
          {queryResponse || "Upload a video and ask questions to see results here..."}
        </div>
      </div>
    </>
  );
}