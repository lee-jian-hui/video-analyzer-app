import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [uploadedVideoId, setUploadedVideoId] = useState("");
  const [queryResponse, setQueryResponse] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadVideo() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadStatus("Please select a video file first");
      return;
    }

    if (!file.name.toLowerCase().endsWith('.mp4')) {
      setUploadStatus("Please select an MP4 file");
      return;
    }

    setLoading(true);
    setUploadStatus("Uploading video...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const videoData = Array.from(uint8Array);

      const response = await invoke("upload_video", {
        filename: file.name,
        video_data: videoData
      });

      const result = response as { video_id: string; success: boolean; message: string };

      if (result.success) {
        setUploadedVideoId(result.video_id);
        setUploadStatus(`✅ Upload successful! Video ID: ${result.video_id}`);
      } else {
        setUploadStatus(`❌ Upload failed: ${result.message}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }

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
    <main className="container">
      <h1>🎥 Video AI Processor</h1>
      <p>Upload MP4 videos and interact with them using natural language</p>

      {/* Video Upload Section */}
      <div className="upload-section" style={{ marginBottom: "2rem", padding: "1.5rem", border: "2px dashed #ccc", borderRadius: "8px" }}>
        <h2>📁 Upload Video</h2>

        <div style={{ marginBottom: "1rem" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,video/mp4"
            style={{ marginBottom: "1rem" }}
          />
          <br />
          <button onClick={uploadVideo} disabled={loading} style={{ padding: "0.5rem 1rem" }}>
            {loading ? "Uploading..." : "Upload Video"}
          </button>
        </div>

        <div style={{
          backgroundColor: uploadedVideoId ? "#d4edda" : "#f8f9fa",
          padding: "0.75rem",
          borderRadius: "4px",
          border: uploadedVideoId ? "1px solid #c3e6cb" : "1px solid #e9ecef"
        }}>
          {uploadStatus || "No video uploaded yet"}
        </div>
      </div>

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
    </main>
  );
}

export default App;
