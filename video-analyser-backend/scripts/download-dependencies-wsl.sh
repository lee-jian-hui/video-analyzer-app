#!/bin/bash
# ========================================
# Download Dependencies from WSL
# ========================================
# Downloads all required system dependencies
# for bundling with the Windows installer

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${1:-$SCRIPT_DIR/../../my-tauri-app/src-tauri}"

INSTALLERS_DIR="$TARGET_DIR/resources/installers"
SIDECARS_DIR="$TARGET_DIR/sidecars"
TEMP_DIR="/tmp/video-analyzer-deps"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Downloading Windows Dependencies${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""
echo "Target directory: $TARGET_DIR"
echo ""

# Create directories
mkdir -p "$INSTALLERS_DIR"
mkdir -p "$SIDECARS_DIR"
mkdir -p "$TEMP_DIR"

# URLs
VCREDIST_URL="https://aka.ms/vs/17/release/vc_redist.x64.exe"
DIRECTX_URL="https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe"
FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
TESSERACT_URL="https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe"

download_file() {
    local url=$1
    local output=$2
    local description=$3

    if [ -f "$output" ]; then
        echo -e "${YELLOW}⚠${NC} $description already exists, skipping"
        return 0
    fi

    echo -e "${CYAN}⬇${NC} Downloading $description..."

    if curl -L -f -o "$output" "$url" --progress-bar; then
        local size=$(du -h "$output" | cut -f1)
        echo -e "${GREEN}✓${NC} Downloaded $description ($size)"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to download $description"
        return 1
    fi
}

# ========================================
# 1. Visual C++ Redistributable (REQUIRED)
# ========================================
echo -e "${CYAN}[1/4] Visual C++ Redistributable${NC}"
download_file "$VCREDIST_URL" "$INSTALLERS_DIR/vc_redist.x64.exe" "VC++ Redistributable"
echo ""

# ========================================
# 2. DirectX End-User Runtime (Recommended)
# ========================================
echo -e "${CYAN}[2/4] DirectX End-User Runtime${NC}"
download_file "$DIRECTX_URL" "$INSTALLERS_DIR/dxwebsetup.exe" "DirectX Runtime"
echo ""

# ========================================
# 3. ffmpeg (REQUIRED)
# ========================================
echo -e "${CYAN}[3/4] ffmpeg${NC}"

if [ -f "$SIDECARS_DIR/ffmpeg.exe" ]; then
    echo -e "${YELLOW}⚠${NC} ffmpeg.exe already exists, skipping"
else
    echo -e "${CYAN}⬇${NC} Downloading ffmpeg..."

    if curl -L -f -o "$TEMP_DIR/ffmpeg.zip" "$FFMPEG_URL" --progress-bar; then
        echo -e "${CYAN}📦${NC} Extracting ffmpeg..."

        if unzip -q "$TEMP_DIR/ffmpeg.zip" -d "$TEMP_DIR"; then
            # Find ffmpeg.exe in extracted folders
            FFMPEG_EXE=$(find "$TEMP_DIR" -name "ffmpeg.exe" -type f 2>/dev/null | head -n 1)

            if [ -n "$FFMPEG_EXE" ]; then
                cp "$FFMPEG_EXE" "$SIDECARS_DIR/ffmpeg.exe"
                local size=$(du -h "$SIDECARS_DIR/ffmpeg.exe" | cut -f1)
                echo -e "${GREEN}✓${NC} Extracted ffmpeg.exe ($size)"
            else
                echo -e "${RED}✗${NC} Could not find ffmpeg.exe in archive"
            fi
        else
            echo -e "${RED}✗${NC} Failed to extract ffmpeg"
        fi

        rm -f "$TEMP_DIR/ffmpeg.zip"
    else
        echo -e "${RED}✗${NC} Failed to download ffmpeg"
    fi
fi
echo ""

# ========================================
# 4. Tesseract-OCR (Optional)
# ========================================
echo -e "${CYAN}[4/4] Tesseract-OCR (Optional)${NC}"

if [ -f "$INSTALLERS_DIR/tesseract-ocr-setup.exe" ]; then
    echo -e "${YELLOW}⚠${NC} Tesseract-OCR already exists, skipping"
else
    read -p "Download Tesseract-OCR for OCR features? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        download_file "$TESSERACT_URL" "$INSTALLERS_DIR/tesseract-ocr-setup.exe" "Tesseract-OCR"
    else
        echo -e "${YELLOW}⚠${NC} Skipping Tesseract-OCR"
    fi
fi
echo ""

# ========================================
# Cleanup
# ========================================
rm -rf "$TEMP_DIR"

# ========================================
# Summary
# ========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo "Downloaded files:"
echo ""

if [ -f "$INSTALLERS_DIR/vc_redist.x64.exe" ]; then
    echo -e "${GREEN}✓${NC} VC++ Redistributable: $(du -h "$INSTALLERS_DIR/vc_redist.x64.exe" | cut -f1)"
fi

if [ -f "$INSTALLERS_DIR/dxwebsetup.exe" ]; then
    echo -e "${GREEN}✓${NC} DirectX Runtime: $(du -h "$INSTALLERS_DIR/dxwebsetup.exe" | cut -f1)"
fi

if [ -f "$SIDECARS_DIR/ffmpeg.exe" ]; then
    echo -e "${GREEN}✓${NC} ffmpeg.exe: $(du -h "$SIDECARS_DIR/ffmpeg.exe" | cut -f1)"
fi

if [ -f "$INSTALLERS_DIR/tesseract-ocr-setup.exe" ]; then
    echo -e "${GREEN}✓${NC} Tesseract-OCR: $(du -h "$INSTALLERS_DIR/tesseract-ocr-setup.exe" | cut -f1)"
fi

echo ""
echo -e "${GREEN}✓${NC} All dependencies downloaded!"
echo ""
echo "Location: $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  1. Build Python backend: cd .. && uv run pyinstaller ..."
echo "  2. Get Ollama executable and models"
echo "  3. Run: ./verify-bundle-ready.sh"
echo ""
