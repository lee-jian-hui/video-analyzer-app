# Architecture Overview: Offline Video AI Desktop (Tauri + gRPC + MCP + Local Llama)

## 1. Overview

This architecture enables a **fully offline**, modular, and extensible desktop AI application built with **Tauri**, **Rust**, and **Python MCP servers**, augmented by a **local Llama 3.2 model** for intelligent orchestration and reasoning.

---

## 2. High-Level System Diagram

```
┌────────────────────────────────────────────────────────────┐
│        React (UI)         │
│  - File upload UI         │
│  - Display transcriptions │
│  - Interactive LLM chat   │
└──────────────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────┐
│       Rust Bridge (Tauri)    │
│  - Exposes commands:         │
│    • upload_video()          │
│    • process_query()         │
│    • get_processing_status() │
│  - Calls Python backend via  │
│    gRPC client               │
└──────────────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│     Python Backend (gRPC Orchestrator)        │
│-----------------------------------------------│
│  • server.py (entry point)                    │
│  • Implements gRPC service methods            │
│  • Delegates tasks to local MCP servers       │
│  • Hosts local Llama 3.2 agent with MCP       │
│-----------------------------------------------│
│    ┌──────────────────────────────────────────────────────┐     │
│    │ MCP Servers (fastmcp)              │     │
│    │ • Whisper MCP → transcription      │     │
│    │ • YOLO MCP → object detection      │     │
│    │ • LLM MCP → summarization          │     │
│    └──────────────────────────────────────────────────────┘     │
│                                               │
│    Storage: local SQLite + blob directory     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Goals

| Goal                       | Implementation                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| **Offline operation**      | All models and tools run locally — no external APIs               |
| **Process isolation**      | Each AI service (Whisper, YOLO, etc.) runs as its own MCP process |
| **Standardized interface** | All MCP servers follow the Model Context Protocol (MCP)           |
| **Dynamic extensibility**  | Add new tools (MCP servers) without modifying core orchestrator   |
| **Interoperability**       | gRPC used between Rust and Python for stability and type safety   |

---

## 4. Core Components

### 4.1 Tauri (Rust)

* Handles user actions and forwards requests to Python gRPC service.
* Uses tonic-generated stubs (`VideoProcessorServiceClient`).
* Calls async functions like:

  ```rust
  client.upload_video(tonic::Request::new(req)).await
  ```
* Built into the final desktop binary using `tauri build`.

---

### 4.2 Python Orchestrator (`server.py`)

* Implements gRPC service endpoints for:

  * `UploadVideo`
  * `ProcessQuery`
  * `GetProcessingStatus`

* On startup:

  1. Loads local Llama 3.2 (via Hugging Face).
  2. Starts or connects to MCP servers (Whisper, YOLO, etc.).
  3. Performs MCP handshake and tool registration.

* Handles logic like:

  ```python
  result = llama_agent.call_tool("transcribe_audio", {"file_path": "/data/uploads/test.mp4"})
  ```

---

### 4.3 MCP Servers (FastMCP)

Each model is encapsulated in an independent MCP server using the `mcp` Python package.

Examples:

* **Whisper MCP** → audio/video transcription
* **YOLO MCP** → object detection
* **Summarizer MCP** → text summarization

Each exposes one or more tools via:

```python
@server.tool()
def transcribe_audio(file_path: str) -> dict:
    ...
```

---

## 5. Data Flow Example

1⃣ **Frontend Uploads Video**
→ Calls Rust `upload_video()` command
→ gRPC → Python orchestrator

2⃣ **Python Backend Stores File**
→ Saves to `/data/uploads`
→ Registers file metadata in SQLite

3⃣ **Processing Request**
→ gRPC `process_query()`
→ Orchestrator forwards to appropriate MCP server (e.g., Whisper)

4⃣ **MCP Inference**
→ Runs local Whisper model
→ Returns JSON result

5⃣ **Response Back to UI**
→ gRPC response → Tauri Rust → React frontend

---

## 6. Folder Structure

```
project-root/
├── src-tauri/
│   ├── src/main.rs
│   ├── proto/videoprocessor.proto
│   └── target/release/bundle/
│
├── python-backend/
│   ├── server.py
│   ├── grpc/
│   │   ├── video_processor_pb2.py
│   │   └── video_processor_pb2_grpc.py
│   ├── core/
│   │   ├── llama_agent.py
│   │   ├── orchestrator.py
│   │   └── storage.py
│   ├── tools/
│   │   ├── whisper_tool.py
│   │   ├── detection_tool.py
│   │   └── summarization_tool.py
│   ├── data/uploads/
│   ├── models/whisper/
│   ├── models/yolo/
│   ├── models/llama/
│   └── requirements.txt
```

---

## 7. Model Context Protocol (MCP)

* Each tool conforms to the MCP spec (`fastmcp` implementation).
* Orchestrator uses JSON-RPC 2.0 messaging for:

  * `initialize`
  * `tools/list`
  * `tools/call`
* The local Llama agent interprets tool schemas and calls the correct MCP server.

---

## 8. Local Testing

```bash
# Start Whisper MCP server
python python-backend/tools/whisper_tool.py

# Run Python orchestrator
python python-backend/server.py

# Run Tauri (Rust + React)
npm run tauri dev
```

You should see:

```
🎷 Whisper: Transcribing test.mp4 using base model...
```

---

## 9. Future Extensions

* ✅ Integrate YOLO MCP for object detection
* ✅ Add summarization MCP using local LLM
* ✅ Implement centralized ModelRegistry class
* Ὠ0 Add health check / heartbeat system for MCP processes
* 🧩 Package everything into a single binary via PyInstaller + Tauri bundle
