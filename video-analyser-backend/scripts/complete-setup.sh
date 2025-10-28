#!/bin/bash
# ========================================
# Complete Setup Script
# ========================================
# Completes all remaining setup tasks for Windows installer

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/.."
TAURI_DIR="$SCRIPT_DIR/../../my-tauri-app/src-tauri"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Video Analyzer Complete Setup${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# ========================================
# Step 1: Download ffmpeg if missing
# ========================================
echo -e "${CYAN}[1/5] Checking ffmpeg...${NC}"

if [ -f "$TAURI_DIR/sidecars/ffmpeg.exe" ]; then
    SIZE=$(du -h "$TAURI_DIR/sidecars/ffmpeg.exe" | cut -f1)
    echo -e "${GREEN}✓${NC} ffmpeg.exe already exists ($SIZE)"
else
    echo -e "${YELLOW}⚠${NC} ffmpeg.exe missing, downloading..."

    TEMP_DIR="/tmp/video-analyzer-ffmpeg"
    mkdir -p "$TEMP_DIR"

    if curl -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" \
         -o "$TEMP_DIR/ffmpeg.zip" --progress-bar; then

        echo -e "${CYAN}📦${NC} Extracting ffmpeg..."

        if unzip -q "$TEMP_DIR/ffmpeg.zip" -d "$TEMP_DIR" 2>/dev/null; then
            FFMPEG_EXE=$(find "$TEMP_DIR" -name "ffmpeg.exe" -type f 2>/dev/null | head -n 1)

            if [ -n "$FFMPEG_EXE" ]; then
                cp "$FFMPEG_EXE" "$TAURI_DIR/sidecars/ffmpeg.exe"
                SIZE=$(du -h "$TAURI_DIR/sidecars/ffmpeg.exe" | cut -f1)
                echo -e "${GREEN}✓${NC} Downloaded and extracted ffmpeg.exe ($SIZE)"
            else
                echo -e "${RED}✗${NC} Failed to find ffmpeg.exe in archive"
                echo "Please download manually from: https://github.com/BtbN/FFmpeg-Builds/releases"
            fi
        else
            echo -e "${RED}✗${NC} Failed to extract ffmpeg"
            echo "Is 'unzip' installed? Try: sudo apt-get install unzip"
        fi

        rm -rf "$TEMP_DIR"
    else
        echo -e "${RED}✗${NC} Failed to download ffmpeg"
    fi
fi
echo ""

# ========================================
# Step 2: Copy hooks.nsh
# ========================================
echo -e "${CYAN}[2/5] Copying hooks.nsh...${NC}"

mkdir -p "$TAURI_DIR/windows"

if [ -f "$SCRIPT_DIR/hooks.nsh" ]; then
    cp "$SCRIPT_DIR/hooks.nsh" "$TAURI_DIR/windows/"
    echo -e "${GREEN}✓${NC} Copied hooks.nsh to $TAURI_DIR/windows/"
else
    echo -e "${RED}✗${NC} hooks.nsh not found in $SCRIPT_DIR"
    exit 1
fi
echo ""

# ========================================
# Step 3: Build Python Backend
# ========================================
echo -e "${CYAN}[3/5] Building Python Backend...${NC}"

if [ -f "$TAURI_DIR/sidecars/video_analyzer_backend.exe" ]; then
    SIZE=$(du -h "$TAURI_DIR/sidecars/video_analyzer_backend.exe" | cut -f1)
    echo -e "${YELLOW}⚠${NC} video_analyzer_backend.exe already exists ($SIZE)"
    read -p "Rebuild? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠${NC} Skipping backend build"
        echo ""
        BUILD_BACKEND=false
    else
        BUILD_BACKEND=true
    fi
else
    BUILD_BACKEND=true
fi

if [ "$BUILD_BACKEND" = true ]; then
    cd "$BACKEND_DIR"

    # Check if ML models exist
    if [ ! -d "ml-models" ] || [ -z "$(ls -A ml-models 2>/dev/null)" ]; then
        echo -e "${CYAN}📦${NC} Downloading ML models (this may take a while)..."
        uv run python scripts/download_models.py
        echo -e "${GREEN}✓${NC} ML models downloaded"
    else
        echo -e "${GREEN}✓${NC} ML models already exist"
    fi

    echo -e "${CYAN}🔨${NC} Building backend with PyInstaller..."
    echo "   (This may take 5-10 minutes, please be patient...)"
    echo ""

    # Use --onedir instead of --onefile to avoid 4GB limit
    # This creates a directory with the exe and dependencies
    uv run pyinstaller \
      --name video_analyzer_backend \
      --onedir \
      --noconsole \
      --add-data "templates:templates" \
      --add-data "protos:protos" \
      --add-data "ml-models:ml-models" \
      --hidden-import langchain \
      --hidden-import tiktoken \
      --hidden-import whisper \
      --hidden-import ultralytics \
      server.py 2>&1 | grep -v "^[0-9]* INFO"

    # With --onedir, the output is a directory
    if [ -d "dist/video_analyzer_backend" ]; then
        # Copy the entire directory
        rm -rf "$TAURI_DIR/sidecars/video_analyzer_backend"
        cp -r dist/video_analyzer_backend "$TAURI_DIR/sidecars/"

        SIZE=$(du -sh "$TAURI_DIR/sidecars/video_analyzer_backend" | cut -f1)
        echo -e "${GREEN}✓${NC} Built video_analyzer_backend/ directory ($SIZE)"

        # The exe is inside the directory
        if [ -f "$TAURI_DIR/sidecars/video_analyzer_backend/video_analyzer_backend.exe" ]; then
            echo -e "${GREEN}✓${NC} Main exe: video_analyzer_backend/video_analyzer_backend.exe"
        fi
    else
        echo -e "${RED}✗${NC} Failed to build backend"
        echo "Check for errors above"
        exit 1
    fi

    cd "$SCRIPT_DIR"
fi
echo ""

# ========================================
# Step 4: Get Ollama
# ========================================
echo -e "${CYAN}[4/5] Checking Ollama...${NC}"

OLLAMA_MISSING=false

if [ -f "$TAURI_DIR/sidecars/ollama.exe" ]; then
    SIZE=$(du -h "$TAURI_DIR/sidecars/ollama.exe" | cut -f1)
    echo -e "${GREEN}✓${NC} ollama.exe already exists ($SIZE)"
else
    echo -e "${RED}✗${NC} ollama.exe missing"
    OLLAMA_MISSING=true
fi

# Check Ollama models
if [ -d "$TAURI_DIR/resources/ollama_models" ] && [ -n "$(ls -A "$TAURI_DIR/resources/ollama_models" 2>/dev/null)" ]; then
    COUNT=$(find "$TAURI_DIR/resources/ollama_models" -type f | wc -l)
    echo -e "${GREEN}✓${NC} Ollama models directory exists ($COUNT files)"
else
    echo -e "${RED}✗${NC} Ollama models directory missing or empty"
    OLLAMA_MISSING=true
fi

if [ "$OLLAMA_MISSING" = true ]; then
    echo ""
    echo -e "${CYAN}=========================================${NC}"
    echo -e "${CYAN}Ollama Setup Required${NC}"
    echo -e "${CYAN}=========================================${NC}"
    echo ""
    echo "Please complete these steps:"
    echo ""
    echo "1. Download and install Ollama for Windows:"
    echo -e "   ${CYAN}https://ollama.com/download/windows${NC}"
    echo ""
    echo "2. After installation, copy ollama.exe:"
    echo -e "   ${YELLOW}cp /mnt/c/Users/\$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')/AppData/Local/Programs/Ollama/ollama.exe ${TAURI_DIR}/sidecars/${NC}"
    echo ""
    echo "3. Start Ollama and download a model:"
    echo -e "   ${YELLOW}ollama serve${NC}  (in another terminal)"
    echo -e "   ${YELLOW}ollama pull qwen2.5:0.5b${NC}"
    echo ""
    echo "4. Copy the models directory:"
    echo -e "   ${YELLOW}mkdir -p ${TAURI_DIR}/resources/ollama_models${NC}"
    echo -e "   ${YELLOW}cp -r ~/.ollama/models ${TAURI_DIR}/resources/ollama_models/${NC}"
    echo ""
    echo "   Or from Windows location:"
    echo -e "   ${YELLOW}cp -r /mnt/c/Users/\$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')/.ollama/models ${TAURI_DIR}/resources/ollama_models/${NC}"
    echo ""
    read -p "Press Enter after you've completed these steps..."
    echo ""
fi
echo ""

# ========================================
# Step 5: Verification
# ========================================
echo -e "${CYAN}[5/5] Verifying Setup...${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check sidecars
echo -e "${CYAN}Sidecars:${NC}"
for file in launcher.exe video_analyzer_backend.exe ollama.exe ffmpeg.exe; do
    if [ -f "$TAURI_DIR/sidecars/$file" ]; then
        SIZE=$(du -h "$TAURI_DIR/sidecars/$file" | cut -f1)
        echo -e "  ${GREEN}✓${NC} $file ($SIZE)"
    else
        echo -e "  ${RED}✗${NC} $file ${RED}MISSING${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# Check resources
echo -e "${CYAN}Resources:${NC}"
if [ -f "$TAURI_DIR/resources/installers/vc_redist.x64.exe" ]; then
    SIZE=$(du -h "$TAURI_DIR/resources/installers/vc_redist.x64.exe" | cut -f1)
    echo -e "  ${GREEN}✓${NC} installers/vc_redist.x64.exe ($SIZE)"
else
    echo -e "  ${RED}✗${NC} installers/vc_redist.x64.exe ${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "$TAURI_DIR/resources/installers/dxwebsetup.exe" ]; then
    SIZE=$(du -h "$TAURI_DIR/resources/installers/dxwebsetup.exe" | cut -f1)
    echo -e "  ${GREEN}✓${NC} installers/dxwebsetup.exe ($SIZE)"
else
    echo -e "  ${YELLOW}⚠${NC} installers/dxwebsetup.exe ${YELLOW}missing (optional)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "$TAURI_DIR/resources/ollama_models" ] && [ -n "$(ls -A "$TAURI_DIR/resources/ollama_models" 2>/dev/null)" ]; then
    COUNT=$(find "$TAURI_DIR/resources/ollama_models" -type f | wc -l)
    echo -e "  ${GREEN}✓${NC} ollama_models/ ($COUNT files)"
else
    echo -e "  ${RED}✗${NC} ollama_models/ ${RED}MISSING or EMPTY${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check hooks
echo -e "${CYAN}NSIS Hooks:${NC}"
if [ -f "$TAURI_DIR/windows/hooks.nsh" ]; then
    echo -e "  ${GREEN}✓${NC} windows/hooks.nsh"
else
    echo -e "  ${RED}✗${NC} windows/hooks.nsh ${RED}MISSING${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${CYAN}=========================================${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ Setup Complete! ✓✓✓${NC}"
    echo ""
    echo "All required files are in place."
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo ""
    echo "1. Update tauri.conf.json:"
    echo "   Edit: ${TAURI_DIR}/tauri.conf.json"
    echo "   Add launcher.exe to externalBin"
    echo "   Add hooks configuration"
    echo ""
    echo "2. Build the installer:"
    echo -e "   ${YELLOW}cd $SCRIPT_DIR/../../my-tauri-app${NC}"
    echo -e "   ${YELLOW}npm install${NC}"
    echo -e "   ${YELLOW}npm run build${NC}"
    echo -e "   ${YELLOW}npm run tauri build${NC}"
    echo ""
    echo "3. Find your installer at:"
    echo "   src-tauri/target/release/bundle/nsis/Video-Analyzer_*_x64-setup.exe"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Setup incomplete${NC}"
    echo -e "  ${RED}$ERRORS error(s)${NC}, ${YELLOW}$WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before building."
    echo ""
    exit 1
fi
