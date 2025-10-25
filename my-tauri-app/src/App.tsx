import { useState } from "react";
import "./App.css";
import { GreetComponent } from "./components/GreetComponent";
import { VideoUploadComponent } from "./components/VideoUploadComponent";
import { ChatComponent } from "./components/ChatComponent";

function App() {
  const [uploadedVideoId, setUploadedVideoId] = useState("");

  return (
    <main className="container">
      <h1>🎥 Video AI Processor</h1>
      <p>Upload MP4 videos and interact with them using natural language</p>

      <GreetComponent />
      <VideoUploadComponent onVideoUploaded={setUploadedVideoId} />
      <ChatComponent uploadedVideoId={uploadedVideoId} />
    </main>
  );
}

export default App;
