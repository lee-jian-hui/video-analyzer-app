import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface VideoUploadComponentProps {
  onVideoUploaded: (videoId: string) => void;
}

export function VideoUploadComponent({ onVideoUploaded }: VideoUploadComponentProps) {
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

      console.log("Calling upload_video with:", { filename: file.name, video_data: videoData });

      const response = await invoke("upload_video", {
        filename: file.name,
        video_data: videoData
      });

      const result = response as { video_id: string; success: boolean; message: string };

      if (result.success) {
        onVideoUploaded(result.video_id);
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

  return (
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
        backgroundColor: uploadStatus.includes("✅") ? "#d4edda" : "#f8f9fa",
        padding: "0.75rem",
        borderRadius: "4px",
        border: uploadStatus.includes("✅") ? "1px solid #c3e6cb" : "1px solid #e9ecef"
      }}>
        {uploadStatus || "No video uploaded yet"}
      </div>
    </div>
  );
}