# Windows Offline Bundle (Tauri v2 + Python gRPC + Ollama)

Package the React + Tauri app, the Python gRPC backend, and a local Ollama LLM into a single Windows desktop installer that runs fully offline.

Targets: Windows 10/11 x86_64, no internet at runtime.

This guide matches the current repo layout and Tauri v2 config under `video-analyzer-app/my-tauri-app`. It also includes notes for when you move `video-analyser-backend` into the app repo.

## What We’re Shipping

- UI: React/Vite frontend inside a Tauri v2 app
- Backend: Python gRPC server (`server.py`) packaged as a Windows EXE (sidecar)
- LLM: Ollama Windows binary + preloaded model(s)
- Offline ML assets: Whisper S2T weights + YOLO weights in `ml-models/`
- Optional binaries: ffmpeg.exe (recommended), tesseract-ocr (optional for OCR)

Tauri spawns the Ollama and backend EXEs as sidecars, then the Rust layer connects to the backend over `localhost:50051`.

## Build Host Prereqs (Windows machine)

- Node.js 18+ and a package manager (pnpm, npm, or yarn)
- Rust stable toolchain + Tauri CLI (`cargo install tauri-cli`)
- Visual Studio Build Tools (MSVC) + Windows 10/11 SDK
- Python 3.10+ and a venv tool (`uv` recommended: `pip install uv`)
- PyInstaller (`pip install pyinstaller`) or Nuitka (alternative)
- NSIS (Tauri’s default Windows installer backend)

GPU optional: install CUDA/cuDNN and a matching PyTorch build if you intend to ship GPU inference.

## Repo Layout Assumptions

- Backend: `video-analyser-backend/` (this repo)
- Tauri v2 app: `video-analyzer-app/my-tauri-app/`

If/when you move the backend into the app repo, replace paths accordingly. The steps and artifacts are the same.

## Step 0 — Backend env for offline

Create `video-analyser-backend/.env` from the template and switch everything to local/offline:

```
cp .env.example .env
```

Recommended values for fully offline:
- `FUNCTION_CALLING_BACKEND=ollama`
- `CHAT_BACKEND=ollama`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
- `HF_HUB_OFFLINE=true`
- `TRANSFORMERS_OFFLINE=true`
- `ML_MODEL_CACHE_DIR=./ml-models`

Note: the backend listens on gRPC port 50051 by default (see `server.py`). The Tauri app connects using `GRPC_SERVER_URL=http://127.0.0.1:50051`.

## Step 1 — Prepare offline ML assets

Use the provided build-time script to fetch Whisper and YOLO weights into `ml-models/` on a connected machine:

```
cd video-analyser-backend
uv sync
uv run python scripts/download_models.py
```

You should see something like:

```
ml-models/
  whisper/*.pt
  yolo/yolov8n.pt  (or other sizes)
```

Keep this folder; we’ll embed it in the backend EXE or ship it next to the EXE (details below).

## Step 2 — Prepare Ollama + model(s) for offline

On a connected Windows machine:

1) Install Ollama and pull your model(s), e.g. `qwen3:0.6b`.

```
ollama pull qwen3:0.6b
```

2) Make the model portable. Use one of:
- Export/import (if your Ollama version supports it):
  - `ollama export qwen3:0.6b > qwen3_0.6b.ollama`
  - Ship that `.ollama` file and run `ollama import qwen3_0.6b.ollama` on first launch
- Copy the models store (works on all versions):
  - Windows store: `%LOCALAPPDATA%\Ollama\models`
  - Ship that `models/` directory and point `OLLAMA_MODELS` to it at runtime

3) Files we will ship with the Tauri app:
- `ollama.exe`
- Either: `qwen3_0.6b.ollama` tarball(s), or a pre-populated `models/` directory

## Step 3 — Bundle ffmpeg (recommended)

The transcription path depends on `ffmpeg`. For a true offline install:
- Download a static Windows build of `ffmpeg.exe`
- Ship it as a sidecar or place it in `bundle.resources`
- Ensure it’s on `PATH` when launching the backend, or set `IMAGEIO_FFMPEG_EXE` to its full path

## Step 4 — Build the Python backend EXE

We’ll use PyInstaller. Two viable approaches:

Approach A (simple): one-file EXE including `ml-models/` as data. Larger EXE, but the backend finds models via `sys._MEIPASS/ml-models` automatically (matches `Config.get_ml_model_cache_dir`).

```
cd video-analyser-backend
uv sync
uv run pyinstaller \
  --name video_analyzer_backend \
  --onefile \
  --noconsole \
  --add-data "templates;templates" \
  --add-data "protos;protos" \
  --add-data "ml-models;ml-models" \
  --hidden-import langchain \
  --hidden-import tiktoken \
  --hidden-import whisper \
  --hidden-import ultralytics \
  server.py
```

Approach B (robust): use a `.spec` file to collect dynamic libs (torch, opencv, etc.). Create `video_analyser_backend.spec` like:

```
# video_analyser_backend.spec (Windows)
from PyInstaller.utils.hooks import collect_dynamic_libs, collect_submodules

hiddenimports = []
hiddenimports += collect_submodules('whisper')
hiddenimports += collect_submodules('ultralytics')
hiddenimports += collect_submodules('cv2')
hiddenimports += [
  'langchain', 'langchain_core', 'langchain_community',
  'tiktoken', 'transformers', 'torch', 'torchvision'
]

binaries = []
binaries += collect_dynamic_libs('torch')
binaries += collect_dynamic_libs('torchvision')
binaries += collect_dynamic_libs('cv2')

block_cipher = None

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=binaries,
    datas=[
      ('templates', 'templates'),
      ('protos', 'protos'),
      ('ml-models', 'ml-models'),
    ],
    hiddenimports=hiddenimports,
    noarchive=False
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(
    pyz,
    a.scripts,
    name='video_analyzer_backend',
    console=False,
)
```

Build with:

```
uv run pyinstaller video_analyser_backend.spec
```

Output appears in `dist/video_analyzer_backend.exe`.

Notes
- If packaging fails on Windows due to MSVC or SDK issues, re-run VS Build Tools installer and ensure “Desktop development with C++” components are present.
- If you prefer smaller size and faster startup, consider Nuitka with `--onefile` as an alternative compiler.

## Step 5 — Wire sidecars in Tauri v2

Tauri v2 uses `bundle.externalBin` to ship sidecar binaries and `bundle.resources` for folders/files. Update `video-analyzer-app/my-tauri-app/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Video Analyzer",
  "identifier": "com.example.videoanalyzer",
  "version": "0.1.0",
  "build": { "beforeBuildCommand": "npm run build", "frontendDist": "../dist" },
  "app": { "windows": [{ "title": "Video Analyzer" }], "security": { "csp": null } },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "externalBin": [
      "sidecars/video_analyzer_backend.exe",
      "sidecars/ollama.exe",
      "sidecars/ffmpeg.exe"
    ],
    "resources": [
      "resources/ollama_models/**"
    ]
  }
}
```

Then spawn sidecars in Rust before the UI is used. Example (simplified):

```rust
use std::time::Duration;
use tauri::Manager;

fn wait_for_port(host: &str, port: u16, timeout_ms: u64) -> bool {
  let addr = format!("{}:{}", host, port);
  let start = std::time::Instant::now();
  while start.elapsed() < Duration::from_millis(timeout_ms) {
    if std::net::TcpStream::connect(&addr).is_ok() { return true; }
    std::thread::sleep(Duration::from_millis(300));
  }
  false
}

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // 1) Start Ollama
      let mut ollama = tauri::process::Command::new_sidecar("ollama")
        .expect("sidecar 'ollama' not found")
        .env("OLLAMA_MODELS", app.path().resource_dir().unwrap().join("ollama_models"))
        .args(["serve", "--host", "127.0.0.1"]).spawn().expect("start ollama");

      assert!(wait_for_port("127.0.0.1", 11434, 30_000), "ollama not ready");

      // 2) Start backend (uses embedded ml-models via PyInstaller or your default)
      let mut backend = tauri::process::Command::new_sidecar("video_analyzer_backend")
        .expect("sidecar 'video_analyzer_backend' not found")
        .env("FUNCTION_CALLING_BACKEND", "ollama")
        .env("CHAT_BACKEND", "ollama")
        .env("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        .env("HF_HUB_OFFLINE", "true")
        .env("TRANSFORMERS_OFFLINE", "true")
        .spawn().expect("start backend");

      assert!(wait_for_port("127.0.0.1", 50051, 30_000), "backend not ready");

      // ensure children die when app closes
      app.manage(ollama);
      app.manage(backend);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

The frontend/Rust client currently reads `GRPC_SERVER_URL` from env; set it to `http://127.0.0.1:50051` in your run environment if needed.

## Step 6 — Place artifacts into the Tauri app

Place the following under `video-analyzer-app/my-tauri-app/src-tauri`:

- `sidecars/video_analyzer_backend.exe` (from `video-analyser-backend/dist/`)
- `sidecars/ollama.exe`
- `sidecars/ffmpeg.exe` (recommended)
- `resources/ollama_models/` (either `.ollama` tarballs or a `models/` store)

Because the backend EXE already embeds `ml-models/` (Approach A), you don’t need to duplicate those under Tauri resources. If you used a `--onedir` build and want models next to the EXE instead, change the backend pathing logic or adjust the `.spec` to omit embedded models and add `resources/ml-models/**` in `bundle.resources`.

## Step 7 — Build the Windows installer

From the Tauri app dir:

```
cd video-analyzer-app/my-tauri-app
npm i   # or pnpm i / yarn
npm run build
npm run tauri build
```

Outputs appear in `src-tauri/target/release/bundle/` (including an NSIS installer).

## Step 8 — Validate completely offline

On a clean Windows VM without Internet:
- Install the app
- Confirm `ollama.exe` is running and listening on 11434
- Confirm backend gRPC is listening on 50051 (e.g., `grpcurl` or app UI connects)
- Ask for a short transcription and a simple detection; ensure no downloads occur
- Check outputs in `%USERPROFILE%\Documents\VideoAnalyzer\outputs` (see `storage_paths.py`)

## Alternative: Run backend externally (no sidecars)

Your current Rust app connects to a running backend at `GRPC_SERVER_URL`.
If you prefer two-process installs (separate backend installer or service):
- Ship only the Tauri app
- Provide a separate installer for `video_analyzer_backend.exe` and `ollama.exe`
- Set `GRPC_SERVER_URL` to that machine’s hostname:port

This is simpler to maintain but not a single “self-contained” installer.

## Common pitfalls and fixes

- Missing DLLs on Windows: reinstall VS Build Tools + Windows SDK; ensure `vcruntime140.dll` et al. are present.
- PyInstaller can miss dynamic libs; prefer a `.spec` with `collect_dynamic_libs` for torch/opencv.
- Large size: choose smaller models (`qwen3:0.6b`, `whisper base`, `yolov8n`), and prune debug symbols.
- Ollama model not found: set `OLLAMA_MODELS` to your shipped store or import `.ollama` tarballs on first run.
- ffmpeg not found: ship `ffmpeg.exe` and add its folder to `PATH` or set `IMAGEIO_FFMPEG_EXE` for Python.
- Tesseract OCR: if you enable OCR, ship Tesseract-OCR for Windows and set `TESSDATA_PREFIX` accordingly.

## When you move backend into the app repo

If you relocate `video-analyser-backend` under the Tauri project (e.g., into `video-analyzer-app/backend/`):
- Keep the backend build steps the same; only path prefixes change
- Output EXE to `my-tauri-app/src-tauri/sidecars/` directly
- Keep Ollama models and ffmpeg under `src-tauri/resources` and `src-tauri/sidecars` as above
- Update any relative docs and CI paths accordingly

## Appendix A — Offline-friendly backend env (.env)

```
FUNCTION_CALLING_BACKEND=ollama
CHAT_BACKEND=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
HF_HUB_OFFLINE=true
TRANSFORMERS_OFFLINE=true
ML_MODEL_CACHE_DIR=./ml-models
LOG_LEVEL=INFO
```

## Appendix B — Re-generate protobufs (if you change .proto)

```
cd video-analyser-backend
uv run python -m grpc_tools.protoc \
  --python_out=protos/ \
  --grpc_python_out=protos/ \
  --proto_path=protos/ \
  protos/video_analyzer.proto

# Fix import path in generated gRPC file
sed -i "s/^import video_analyzer_pb2/from protos import video_analyzer_pb2/" protos/video_analyzer_pb2_grpc.py
```

---

With the above, the Windows installer bundles the UI, backend, Ollama, and all offline assets into a single, self-contained app that runs without Internet access.
