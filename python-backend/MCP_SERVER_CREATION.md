# How to Create a Whisper MCP Server

This guide walks through how to build a **Whisper-based Model Context Protocol (MCP) server** that runs locally and integrates into the Tauri + Python architecture.

---

## 1. Overview

We use the **`mcp` Python package** (via `fastmcp`) to expose local AI tools that conform to the MCP standard. The Whisper MCP server provides a `transcribe_audio` tool, which the Python orchestrator or local Llama agent can invoke via JSON-RPC.

The MCP server runs as a **standalone process**, enabling process isolation, concurrency, and modularity.

---

## 2. Folder Structure

```
python-backend/
├── tools/
│   ├── whisper_tool.py     ← Our MCP server
│   ├── detection_tool.py
│   └── summarization_tool.py
├── core/
│   ├── orchestrator.py
│   └── llama_agent.py
└── models/
    └── whisper/
```

---

## 3. Installation

```bash
pip install mcp openai-whisper
```

Optional (if using faster inference):

```bash
pip install torch --extra-index-url https://download.pytorch.org/whl/cu121
```

---

## 4. Implementing the MCP Server

Below is a minimal example of a Whisper MCP server implemented using `fastmcp`:

```python
# whisper_tool.py
from mcp.server.fastmcp import FastMCP
import whisper
import os

# Initialize MCP server
server = FastMCP("Whisper Transcriber")

# Load Whisper model once (for performance)
model = whisper.load_model("base")

@server.tool()
def transcribe_audio(file_path: str) -> dict:
    """
    Transcribes an audio or video file using OpenAI's Whisper model.
    Returns JSON with the text result.
    """
    if not os.path.exists(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}

    print(f"🎤 Transcribing: {file_path}")
    result = model.transcribe(file_path)

    return {
        "success": True,
        "text": result["text"],
        "language": result["language"]
    }

if __name__ == "__main__":
    print("🚀 Starting Whisper MCP server...")
    server.run()
```

---

## 5. Testing the Server Standalone

You can manually test the MCP server using the **MCP Inspector** tool.

```bash
pip install mcp-inspector
mcp-inspector run python python-backend/tools/whisper_tool.py
```

You should see an interface listing your tools and allowing you to send a test JSON-RPC message:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "transcribe_audio",
    "arguments": { "file_path": "./data/uploads/sample.mp4" }
  },
  "id": 1
}
```

Expected response:

```json
{
  "id": 1,
  "result": {
    "success": true,
    "text": "Hello world from the Whisper model.",
    "language": "en"
  }
}
```

---

## 6. Integration with Orchestrator

In the **Python Orchestrator**, you can spawn and manage this MCP process:

```python
# core/orchestrator.py
import subprocess, json

def start_whisper_mcp():
    return subprocess.Popen(
        ["python", "tools/whisper_tool.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True
    )

def call_whisper_tool(server, file_path):
    msg = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "transcribe_audio", "arguments": {"file_path": file_path}},
        "id": 1
    })
    server.stdin.write(msg + "\n")
    server.stdin.flush()
    return json.loads(server.stdout.readline())
```

---

## 7. Full Local Workflow

1. **Start the Whisper MCP Server**:

   ```bash
   python python-backend/tools/whisper_tool.py
   ```
2. **Run Python Orchestrator**:

   ```bash
   python python-backend/server.py
   ```
3. **Start Tauri UI**:

   ```bash
   npm run tauri dev
   ```
4. **Upload a Video** → triggers gRPC → Orchestrator → Whisper MCP → returns transcription → shown in frontend.

---

## 8. Extending to Other Tools

Each new AI module (YOLO, summarizer, etc.) can follow the same pattern:

```python
server = FastMCP("YOLO Detector")
@server.tool()
def detect_objects(file_path: str) -> dict:
    # Perform inference using YOLOv8
    ...
```

The orchestrator dynamically registers and manages these MCP servers at startup.

---

## 9. Next Steps

* ✅ Add `MCPProcessManager` class for clean lifecycle management.
* ✅ Add tool schemas validation via Pydantic.
* ✅ Integrate local Llama 3.2 model to automatically select and call tools.
* 🚀 Bundle all Python binaries with Tauri for fully offline execution.
