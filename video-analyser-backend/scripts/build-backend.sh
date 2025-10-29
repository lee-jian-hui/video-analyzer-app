#!/bin/bash
# ========================================
# Python Backend Build Script
# ========================================
# Builds the Python backend with PyInstaller for Windows

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
echo -e "${CYAN}Python Backend Build${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# ========================================
# Step 1: Check Prerequisites
# ========================================
echo -e "${CYAN}[1/4] Checking prerequisites...${NC}"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo -e "${RED}✗${NC} uv is not installed"
    echo "Install with: pip install uv"
    exit 1
else
    echo -e "${GREEN}✓${NC} uv is installed"
fi

# Check if pyinstaller is available in the environment
cd "$BACKEND_DIR"
if ! uv run python -c "import PyInstaller" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} PyInstaller not found, installing..."
    uv add pyinstaller
    echo -e "${GREEN}✓${NC} PyInstaller installed"
else
    echo -e "${GREEN}✓${NC} PyInstaller is available"
fi

echo ""

# ========================================
# Step 2: Download ML Models
# ========================================
echo -e "${CYAN}[2/4] Checking ML models...${NC}"

# if [ ! -d "ml-models" ] || [ -z "$(ls -A ml-models 2>/dev/null)" ]; then
#     echo -e "${YELLOW}⚠${NC} ML models not found, downloading..."
#     echo "   (This may take 10-20 minutes depending on your connection...)"
#     echo ""

#     if [ -f "scripts/download_models.py" ]; then
#         uv run python scripts/download_models.py
#         echo -e "${GREEN}✓${NC} ML models downloaded"
#     else
#         echo -e "${RED}✗${NC} download_models.py script not found"
#         echo "Cannot proceed without ML models"
#         exit 1
#     fi
# else
#     MODEL_COUNT=$(find ml-models -type f | wc -l)
#     MODEL_SIZE=$(du -sh ml-models | cut -f1)
#     echo -e "${GREEN}✓${NC} ML models exist ($MODEL_COUNT files, $MODEL_SIZE)"
# fi

echo ""

# ========================================
# Step 3: Check if Rebuild is Needed
# ========================================
echo -e "${CYAN}[3/4] Checking existing build...${NC}"

BUILD_NEEDED=true

if [ -d "dist/video_analyzer_backend" ]; then
    SIZE=$(du -sh "dist/video_analyzer_backend" | cut -f1)
    echo -e "${YELLOW}⚠${NC} Existing build found: $SIZE"
    echo ""
    read -p "Rebuild? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠${NC} Using existing build"
        BUILD_NEEDED=false
    else
        echo -e "${CYAN}🧹${NC} Cleaning old build..."
        rm -rf build dist *.spec
        echo -e "${GREEN}✓${NC} Cleaned"
    fi
else
    echo -e "${CYAN}📦${NC} No existing build found, will build fresh"
fi

echo ""

# ========================================
# Step 4: Build with PyInstaller
# ========================================
if [ "$BUILD_NEEDED" = true ]; then
    echo -e "${CYAN}[4/4] Building backend with PyInstaller...${NC}"
    echo "   (This may take 5-10 minutes, please be patient...)"
    echo ""

    # Use --onedir to avoid 4GB file size limit
    # The backend will be a directory with the exe + dependencies
    uv run pyinstaller \
      --name video_analyzer_backend \
      --onedir \
      --noconsole \
      --add-data "templates:templates" \
      --add-data "protos:protos" \
      --hidden-import langchain \
      --hidden-import tiktoken \
      --hidden-import whisper \
      --hidden-import ultralytics \
      server.py 2>&1 | grep -E "^(Building|Copying|WARNING|ERROR|Traceback)" || true

    echo ""

    # Check if build succeeded
    if [ -d "dist/video_analyzer_backend" ]; then
        SIZE=$(du -sh "dist/video_analyzer_backend" | cut -f1)
        echo -e "${GREEN}✓${NC} Build complete: $SIZE"

        # Verify the exe exists
        if [ -f "dist/video_analyzer_backend/video_analyzer_backend.exe" ]; then
            EXE_SIZE=$(du -sh "dist/video_analyzer_backend/video_analyzer_backend.exe" | cut -f1)
            echo -e "${GREEN}✓${NC} Main executable: $EXE_SIZE"
        else
            echo -e "${RED}✗${NC} Main executable not found!"
            exit 1
        fi
    else
        echo -e "${RED}✗${NC} Build failed"
        echo "Check errors above"
        exit 1
    fi
else
    echo -e "${CYAN}[4/4] Skipping build (using existing)${NC}"
fi

echo ""

# ========================================
# Step 5: Copy to Tauri Sidecars
# ========================================
echo -e "${CYAN}[5/5] Copying to Tauri sidecars...${NC}"

TARGET_DIR="$TAURI_DIR/sidecars/video_analyzer_backend"

# Remove old version
if [ -d "$TARGET_DIR" ]; then
    echo -e "${CYAN}🧹${NC} Removing old version..."
    rm -rf "$TARGET_DIR"
fi

# Copy new build
mkdir -p "$TAURI_DIR/sidecars"
cp -r "dist/video_analyzer_backend" "$TARGET_DIR"

# Verify copy
if [ -f "$TARGET_DIR/video_analyzer_backend.exe" ]; then
    SIZE=$(du -sh "$TARGET_DIR" | cut -f1)
    echo -e "${GREEN}✓${NC} Copied to: $TARGET_DIR ($SIZE)"
else
    echo -e "${RED}✗${NC} Copy failed"
    exit 1
fi

echo ""

# ========================================
# Summary
# ========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Build Summary${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo -e "${GREEN}✓${NC} Backend built successfully"
echo ""
echo "Location:"
echo -e "  ${CYAN}$TARGET_DIR/${NC}"
echo ""
echo "Structure:"
echo -e "  video_analyzer_backend/"
echo -e "    ├─ video_analyzer_backend.exe  ${YELLOW}(launcher)${NC}"
echo -e "    └─ _internal/                   ${YELLOW}(dependencies)${NC}"
echo ""
echo "Next steps:"
echo "  1. Update tauri.conf.json:"
echo "     externalBin: [\"sidecars/video_analyzer_backend/video_analyzer_backend.exe\"]"
echo ""
echo "  2. Update launcher.ps1:"
echo "     \$BACKEND_EXE = Join-Path \$InstallDir \"video_analyzer_backend\\video_analyzer_backend.exe\""
echo ""
echo "  3. Build installer:"
echo "     cd ../../my-tauri-app && npm run tauri build"
echo ""
