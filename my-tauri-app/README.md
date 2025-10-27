# Video AI Processor - Tauri Desktop App

A desktop application for video analysis powered by AI, built with Tauri, React, TypeScript, and a Python gRPC backend.

## Architecture

```
Frontend (React/TS) ←→ Tauri (Rust Client) ←→ Python gRPC Server
```

- **Frontend**: React + TypeScript + Vite (UI layer)
- **Tauri/Rust**: Desktop wrapper + gRPC client (connects to Python)
- **Python Backend**: Video processing + AI analysis (runs separately)

---

## Environment Configuration

This application uses environment variables for configuration in **two separate layers**:

### 1. Frontend Configuration (React/TypeScript)

**File**: `.env` (root directory)
**Template**: `.env.example`

```bash
# Copy example and customize
cp .env.example .env
```

**Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_DEFAULT_WIDTH` | `1200` | Default window width (pixels) |
| `VITE_APP_DEFAULT_HEIGHT` | `800` | Default window height (pixels) |
| `VITE_APP_FULLSCREEN_BREAKPOINT` | `1400` | Fullscreen mode trigger width |
| `VITE_APP_CONTAINER_PADDING_TOP` | `4` | Top padding (vh units) |
| `VITE_APP_HISTORY_LIMIT` | `10` | Max chat history items to fetch |

**Note**: Vite requires `VITE_` prefix for all environment variables.

### 2. Backend Configuration (Rust/Tauri)

**File**: `src-tauri/.env`
**Template**: `src-tauri/.env.example`

```bash
# Copy example and customize
cp src-tauri/.env.example src-tauri/.env
```

**Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_SERVER_URL` | `http://127.0.0.1:50051` | Python backend gRPC server URL |
| `VIDEO_CHUNK_SIZE` | `524288` | Upload chunk size in bytes (512 KB) |
| `LOG_LEVEL` | `info` | Logging level: trace/debug/info/warn/error |
| `DEV` | auto-detected | Development mode flag |

**Important**: The Rust layer is a **gRPC CLIENT** that connects to your Python backend server.

---

## Development Setup

### Prerequisites

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

**System Dependencies:**

1. **Node.js 18+** (includes npm)
2. **Rust toolchain** via [rustup](https://rustup.rs/)
3. **Protobuf compiler**: `sudo apt install protobuf-compiler`
4. **Tauri dependencies** (Ubuntu/Debian):
   ```bash
   sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev \
     libayatana-appindicator3-dev librsvg2-dev fonts-noto-color-emoji
   ```

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional)
cp .env.example .env
cp src-tauri/.env.example src-tauri/.env
# Edit .env files as needed

# 3. Start development server
npm run tauri dev

# Try this if intermittment failures
# WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11 WINIT_UNIX_BACKEND=x11 npm run tauri dev

```

**Note**: Ensure your Python gRPC backend is running on `http://127.0.0.1:50051` (or update `GRPC_SERVER_URL`)

---

## Common Commands

### Development

```bash
# Start dev server (with hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Frontend only (no Tauri)
npm run dev
```

### Rust/Tauri Specific

```bash
# Clean and rebuild
cd src-tauri
cargo clean && cargo check

# Rebuild with verbose logging
RUST_LOG=trace npm run tauri dev

# Maximum logging (nuclear option)
RUST_LOG=trace,tauri=trace,tonic=trace npm run tauri dev -- --verbose
```

### Configuration Examples

**Development (local Python server):**
```bash
# src-tauri/.env
GRPC_SERVER_URL=http://127.0.0.1:50051
LOG_LEVEL=debug
```

**Production (remote Python server):**
```bash
# src-tauri/.env
GRPC_SERVER_URL=http://production-server.example.com:50051
LOG_LEVEL=warn
```

**Custom window size:**
```bash
# .env
VITE_APP_DEFAULT_WIDTH=1600
VITE_APP_DEFAULT_HEIGHT=1000
```


## Notable articles / references
- https://stackoverflow.com/questions/78432685/why-does-tauri-modify-the-parameter-names-of-invoked-functionsQ
