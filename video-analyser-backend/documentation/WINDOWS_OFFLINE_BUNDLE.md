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

## Step 3 — Download System Dependencies for Bundling

The Python backend requires system-level dependencies that must be installed on the end user's machine. We'll bundle these installers and auto-install them via NSIS hooks.

**IMPORTANT:** PyInstaller cannot bundle these system dependencies. They must be installed on the target machine.

### Required Dependencies

| Dependency | Why Required | Size | Auto-Install |
|------------|--------------|------|--------------|
| **Visual C++ Redistributable 2015-2022 x64** | PyTorch, OpenCV, NumPy DLLs | ~25MB | Yes (CRITICAL) |
| **DirectX End-User Runtime** | OpenCV video/GPU operations | ~100KB | Yes (Optional) |
| **ffmpeg.exe** | Video transcription/processing | ~80MB | Bundle as sidecar |
| **Tesseract-OCR** | OCR text extraction (optional) | ~40MB | Yes (Optional) |

### Download Script

Run this script in your build environment (requires internet connection):

```bash
# Create directories for dependencies
mkdir -p video-analyzer-app/my-tauri-app/src-tauri/resources/installers
mkdir -p video-analyzer-app/my-tauri-app/src-tauri/sidecars

cd video-analyzer-app/my-tauri-app/src-tauri

# 1. Visual C++ Redistributable (MANDATORY)
curl -L "https://aka.ms/vs/17/release/vc_redist.x64.exe" \
  -o resources/installers/vc_redist.x64.exe

# 2. DirectX End-User Runtime (Recommended)
curl -L "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" \
  -o resources/installers/dxwebsetup.exe

# 3. ffmpeg static build (MANDATORY for transcription)
curl -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" \
  -o ffmpeg.zip
unzip ffmpeg.zip
cp ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe sidecars/ffmpeg.exe
rm -rf ffmpeg.zip ffmpeg-master-latest-win64-gpl

# 4. Tesseract-OCR (Optional - only if using OCR features)
# curl -L "https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe" \
#   -o resources/installers/tesseract-ocr-setup.exe
```

Or use the provided automated script (see `scripts/download-dependencies.ps1` below).

### Alternative: Manual Download

If you prefer manual downloads:
1. **VC++ Redistributable**: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. **DirectX Runtime**: https://www.microsoft.com/en-us/download/details.aspx?id=35
3. **ffmpeg**: https://github.com/BtbN/FFmpeg-Builds/releases
4. **Tesseract**: https://github.com/UB-Mannheim/tesseract/releases

Place them in the directories shown above

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

## Step 5 — Configure NSIS Installer Hooks for Automatic Dependency Installation

Create NSIS hooks to detect and install system dependencies automatically during installation.

Create `video-analyzer-app/my-tauri-app/src-tauri/windows/hooks.nsh`:

See the complete `hooks.nsh` file in the next section. This file will:
1. Check if Visual C++ Redistributable is installed (via Windows Registry)
2. Silently install it if missing
3. Optionally install DirectX runtime if needed
4. Clean up temporary installers after installation
5. Handle process cleanup during uninstallation

## Step 6 — Wire sidecars in Tauri v2

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
      "resources/ollama_models/**",
      "resources/installers/**"
    ],
    "windows": {
      "nsis": {
        "installerHooks": "./windows/hooks.nsh",
        "installMode": "perUser"
      }
    }
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

## Step 7 — Place artifacts into the Tauri app

Place the following under `video-analyzer-app/my-tauri-app/src-tauri`:

### Sidecars (executable binaries):
- `sidecars/video_analyzer_backend.exe` (from `video-analyser-backend/dist/`)
- `sidecars/ollama.exe`
- `sidecars/ffmpeg.exe` (from Step 3)

### Resources (data files and installers):
- `resources/ollama_models/` (either `.ollama` tarballs or a `models/` store)
- `resources/installers/vc_redist.x64.exe` (Visual C++ Redistributable)
- `resources/installers/dxwebsetup.exe` (DirectX runtime - optional)
- `resources/installers/tesseract-ocr-setup.exe` (OCR - optional)

### NSIS Hooks:
- `windows/hooks.nsh` (see section below for complete file)

Because the backend EXE already embeds `ml-models/` (Approach A), you don't need to duplicate those under Tauri resources. If you used a `--onedir` build and want models next to the EXE instead, change the backend pathing logic or adjust the `.spec` to omit embedded models and add `resources/ml-models/**` in `bundle.resources`.

Your directory structure should look like:
```
my-tauri-app/src-tauri/
├── sidecars/
│   ├── video_analyzer_backend.exe
│   ├── ollama.exe
│   └── ffmpeg.exe
├── resources/
│   ├── ollama_models/
│   │   └── models/  (or .ollama files)
│   └── installers/
│       ├── vc_redist.x64.exe
│       ├── dxwebsetup.exe
│       └── tesseract-ocr-setup.exe (optional)
└── windows/
    └── hooks.nsh
```

## Step 8 — Build the Windows installer

From the Tauri app dir:

```bash
cd video-analyzer-app/my-tauri-app
npm i   # or pnpm i / yarn
npm run build
npm run tauri build
```

Outputs appear in `src-tauri/target/release/bundle/nsis/` (NSIS installer with embedded dependencies).

The installer will be named something like: `Video-Analyzer_0.1.0_x64-setup.exe`

During installation on the end user's machine:
1. NSIS will check for Visual C++ Redistributable
2. If missing, it will silently install it (adds ~30 seconds to install time)
3. DirectX runtime will be installed if needed
4. All sidecars and resources will be placed in the installation directory
5. User data folders will be created in `%USERPROFILE%\Documents\VideoAnalyzer\`

## Step 9 — Validate completely offline

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

### Build-Time Issues:
- **Missing DLLs on Windows**: Reinstall VS Build Tools + Windows SDK; ensure `vcruntime140.dll` et al. are present on build machine.
- **PyInstaller missing dynamic libs**: Prefer a `.spec` file with `collect_dynamic_libs` for torch/opencv.
- **Large installer size**: Choose smaller models (`qwen2.5:0.5b`, `whisper base`, `yolov8n`), and prune debug symbols.

### Runtime Issues on End User Machines:
- **App crashes immediately on launch**: VC++ Redistributable failed to install. Check NSIS installer logs in `%TEMP%`. Manually install from https://aka.ms/vs/17/release/vc_redist.x64.exe
- **"ImportError: DLL load failed"**: DirectX runtime missing. Run `dxwebsetup.exe` manually or reinstall the app.
- **Ollama model not found**: Check `OLLAMA_MODELS` environment variable points to bundled models folder.
- **ffmpeg not found**: Verify `ffmpeg.exe` is in sidecars folder. Check PATH or set `IMAGEIO_FFMPEG_EXE` environment variable.
- **Tesseract OCR errors**: If OCR features are enabled, ensure Tesseract installer ran successfully. Check `TESSDATA_PREFIX` environment variable.

### Dependency Installation Troubleshooting:
- **VC++ install hangs**: End user may need to close other installers or reboot. Install with `/passive` flag shows progress.
- **"Installation failed (code 3010)"**: System restart required. This is normal; app should work after reboot.
- **Permission denied errors**: If using `installMode: "perMachine"`, installer requires Administrator privileges. Switch to `perUser` for non-admin installs.

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

## Appendix C — Complete Build Workflow Summary

Here's the complete workflow from start to finish:

### On Build Machine (One-Time Setup):
1. Run dependency download script (Step 3) to fetch VC++, DirectX, ffmpeg
2. Download ML models (Step 1)
3. Setup Ollama and pull models (Step 2)
4. Build Python backend EXE with PyInstaller (Step 4)
5. Create NSIS hooks file (see hooks.nsh below)
6. Configure tauri.conf.json (Step 6)
7. Place all artifacts in src-tauri directories (Step 7)

### Build the Installer:
```bash
cd video-analyzer-app/my-tauri-app
npm run tauri build
```

### On End User Machine (Automatic):
1. User runs `Video-Analyzer_0.1.0_x64-setup.exe`
2. NSIS checks for VC++ Redistributable
3. If missing, silently installs it (~30 seconds)
4. Installs DirectX runtime if needed
5. Copies sidecars and resources to install directory
6. Creates shortcuts and registry entries
7. User launches app
8. Tauri spawns Ollama and backend sidecars
9. App connects to backend via gRPC (localhost:50051)

### File Sizes (Approximate):
- Backend EXE (with ML models): ~800MB - 1.2GB
- Ollama + models: ~500MB - 2GB (depends on model size)
- ffmpeg: ~80MB
- VC++ Redistributable: ~25MB
- Total installer: **1.5GB - 3.5GB** (depends on model choices)

### Optimization Tips:
- Use CPU-only PyTorch builds (smaller, no CUDA needed)
- Choose smallest Ollama models (qwen2.5:0.5b ~500MB vs llama3:70b ~40GB)
- Use Whisper base/small models instead of large
- Use YOLOv8n (nano) instead of larger variants
- Enable compression in NSIS (already default in Tauri)

---

With the above, the Windows installer bundles the UI, backend, Ollama, and all offline assets into a single, self-contained app that runs without Internet access. System dependencies are automatically installed during setup.
