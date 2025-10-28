#!/bin/bash
# ========================================
# Prepare Large Files for GitHub Release
# ========================================
# This script packages all large files into uploadable assets
# for a GitHub Release, which the CI/CD workflow will download

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$SCRIPT_DIR/../../my-tauri-app/src-tauri"
OUTPUT_DIR="$SCRIPT_DIR/release-assets"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Preparing Release Assets${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo -e "${CYAN}[1/6] Copying launcher...${NC}"
if [ -f "$TAURI_DIR/sidecars/launcher-x86_64-pc-windows-msvc.exe" ]; then
  cp "$TAURI_DIR/sidecars/launcher-x86_64-pc-windows-msvc.exe" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ Launcher copied${NC}"
else
  echo -e "${RED}✗ Launcher not found${NC}"
  echo "Please build the launcher first: ./build-launcher-wsl.sh"
  exit 1
fi

echo ""
echo -e "${CYAN}[2/6] Copying Ollama...${NC}"
if [ -f "$TAURI_DIR/sidecars/ollama.exe" ]; then
  cp "$TAURI_DIR/sidecars/ollama.exe" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ Ollama copied${NC}"
else
  echo -e "${RED}✗ Ollama not found${NC}"
  echo "Please run: ./setup-ollama.sh"
  exit 1
fi

echo ""
echo -e "${CYAN}[3/6] Copying FFmpeg...${NC}"
if [ -f "$TAURI_DIR/sidecars/ffmpeg.exe" ]; then
  cp "$TAURI_DIR/sidecars/ffmpeg.exe" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ FFmpeg copied${NC}"
else
  echo -e "${RED}✗ FFmpeg not found${NC}"
  echo "Please run: ./download-dependencies-wsl.sh"
  exit 1
fi

echo ""
echo -e "${CYAN}[4/6] Packaging Python backend...${NC}"
if [ -d "$TAURI_DIR/sidecars/video_analyzer_backend" ]; then
  cd "$TAURI_DIR/sidecars"
  zip -r "$OUTPUT_DIR/video_analyzer_backend.zip" video_analyzer_backend/ > /dev/null
  cd - > /dev/null
  SIZE=$(du -sh "$OUTPUT_DIR/video_analyzer_backend.zip" | cut -f1)
  echo -e "${GREEN}✓ Backend packaged ($SIZE)${NC}"
else
  echo -e "${RED}✗ Backend not found${NC}"
  echo "Please build the backend first: ./build-backend.sh"
  exit 1
fi

echo ""
echo -e "${CYAN}[5/6] Copying system dependencies...${NC}"
# Check both possible locations
if [ -f "$TAURI_DIR/resources/installers/vc_redist.x64.exe" ] && [ -f "$TAURI_DIR/resources/installers/dxwebsetup.exe" ]; then
  cp "$TAURI_DIR/resources/installers/vc_redist.x64.exe" "$OUTPUT_DIR/"
  cp "$TAURI_DIR/resources/installers/dxwebsetup.exe" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ System dependencies copied${NC}"
elif [ -f "$TAURI_DIR/resources/vc_redist.x64.exe" ] && [ -f "$TAURI_DIR/resources/dxwebsetup.exe" ]; then
  cp "$TAURI_DIR/resources/vc_redist.x64.exe" "$OUTPUT_DIR/"
  cp "$TAURI_DIR/resources/dxwebsetup.exe" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ System dependencies copied${NC}"
else
  echo -e "${RED}✗ System dependencies not found${NC}"
  echo "Please run: ./download-dependencies-wsl.sh"
  exit 1
fi

echo ""
echo -e "${CYAN}[6/6] Packaging Ollama models...${NC}"
# Check both possible locations
if [ -d "$TAURI_DIR/resources/ollama_models/models" ]; then
  cd "$TAURI_DIR/resources/ollama_models"
  zip -r "$OUTPUT_DIR/ollama-models.zip" models/ > /dev/null
  cd - > /dev/null
  SIZE=$(du -sh "$OUTPUT_DIR/ollama-models.zip" | cut -f1)
  echo -e "${GREEN}✓ Models packaged ($SIZE)${NC}"
elif [ -d "$TAURI_DIR/resources/models" ]; then
  cd "$TAURI_DIR/resources"
  zip -r "$OUTPUT_DIR/ollama-models.zip" models/ > /dev/null
  cd - > /dev/null
  SIZE=$(du -sh "$OUTPUT_DIR/ollama-models.zip" | cut -f1)
  echo -e "${GREEN}✓ Models packaged ($SIZE)${NC}"
else
  echo -e "${YELLOW}⚠ Models not found (optional)${NC}"
  echo "Models will need to be added manually if required"
fi

echo ""
echo -e "${CYAN}[7/7] Copying NSIS hooks...${NC}"
if [ -f "$TAURI_DIR/windows/hooks.nsh" ]; then
  cp "$TAURI_DIR/windows/hooks.nsh" "$OUTPUT_DIR/"
  echo -e "${GREEN}✓ NSIS hooks copied${NC}"
else
  echo -e "${RED}✗ NSIS hooks not found${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo -e "${GREEN}Release assets prepared in:${NC}"
echo "  $OUTPUT_DIR"
echo ""

echo -e "${GREEN}Files ready for upload:${NC}"
ls -lh "$OUTPUT_DIR" | tail -n +2 | awk '{printf "  %-40s %5s\n", $9, $5}'

TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo ""
echo -e "${CYAN}Total size: $TOTAL_SIZE${NC}"

echo ""
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Next Steps${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""
echo "1. Create a GitHub Release:"
echo "   - Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/releases/new"
echo "   - Tag: large-files"
echo "   - Title: Large Binary Assets"
echo "   - Description: Large files for CI/CD builds"
echo ""
echo "2. Upload all files from:"
echo "   $OUTPUT_DIR"
echo ""
echo "3. Or use GitHub CLI:"
echo "   gh release create large-files \\"
echo "     --title \"Large Binary Assets\" \\"
echo "     --notes \"Large files for CI/CD\" \\"
echo "     $OUTPUT_DIR/*"
echo ""
echo "4. Push your code and trigger the workflow!"
echo ""
