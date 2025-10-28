#!/bin/bash
# ========================================
# Ollama Setup Script for Windows Installer
# ========================================
# Downloads Windows Ollama executable and copies models

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$SCRIPT_DIR/../../my-tauri-app/src-tauri"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Ollama Setup for Windows Installer${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# ========================================
# Step 1: Download Windows Ollama Executable
# ========================================
echo -e "${CYAN}[1/2] Downloading Windows Ollama executable...${NC}"

OLLAMA_TARGET="$TAURI_DIR/sidecars/ollama.exe"

if [ -f "$OLLAMA_TARGET" ]; then
    SIZE=$(du -h "$OLLAMA_TARGET" | cut -f1)
    echo -e "${YELLOW}⚠${NC} ollama.exe already exists ($SIZE)"
    read -p "Re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠${NC} Skipping download"
        DOWNLOAD_OLLAMA=false
    else
        DOWNLOAD_OLLAMA=true
    fi
else
    DOWNLOAD_OLLAMA=true
fi

if [ "$DOWNLOAD_OLLAMA" = true ]; then
    echo -e "${CYAN}⬇${NC} Downloading ollama-windows-amd64.exe..."

    TEMP_OLLAMA="/tmp/ollama-windows.exe"

    if curl -L "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.exe" \
         -o "$TEMP_OLLAMA" --progress-bar; then

        mkdir -p "$TAURI_DIR/sidecars"
        cp "$TEMP_OLLAMA" "$OLLAMA_TARGET"
        rm "$TEMP_OLLAMA"

        SIZE=$(du -h "$OLLAMA_TARGET" | cut -f1)
        echo -e "${GREEN}✓${NC} Downloaded ollama.exe ($SIZE)"
    else
        echo -e "${RED}✗${NC} Failed to download ollama.exe"
        exit 1
    fi
fi

echo ""

# ========================================
# Step 2: Copy Ollama Models
# ========================================
echo -e "${CYAN}[2/2] Setting up Ollama models...${NC}"

MODELS_TARGET="$TAURI_DIR/resources/ollama_models"

# Find WSL Ollama models location
WSL_MODELS=""

# Check common locations
if [ -d "/usr/share/ollama/.ollama/models" ]; then
    WSL_MODELS="/usr/share/ollama/.ollama/models"
elif [ -d "$HOME/.ollama/models" ]; then
    WSL_MODELS="$HOME/.ollama/models"
elif [ -d "/var/lib/ollama/models" ]; then
    WSL_MODELS="/var/lib/ollama/models"
fi

if [ -z "$WSL_MODELS" ]; then
    echo -e "${YELLOW}⚠${NC} Could not find Ollama models in WSL"
    echo ""
    echo "Please ensure you have downloaded models first:"
    echo -e "  ${CYAN}ollama pull qwen2.5:0.5b${NC}"
    echo ""

    # Try to find models
    echo "Searching for models..."
    FOUND_MODELS=$(sudo find /usr /var -name "manifests" -type d 2>/dev/null | grep ollama | head -1)

    if [ -n "$FOUND_MODELS" ]; then
        WSL_MODELS=$(dirname "$FOUND_MODELS")
        echo -e "${GREEN}✓${NC} Found models at: $WSL_MODELS"
    else
        echo -e "${RED}✗${NC} No models found"
        echo ""
        echo "To download models:"
        echo "  1. ollama serve &"
        echo "  2. ollama pull qwen2.5:0.5b"
        echo "  3. Run this script again"
        exit 1
    fi
fi

echo -e "${CYAN}📦${NC} Copying models from: $WSL_MODELS"

# Create target directory
mkdir -p "$MODELS_TARGET"

# Copy models (may need sudo if in /usr/share)
if [ -r "$WSL_MODELS" ]; then
    cp -r "$WSL_MODELS"/* "$MODELS_TARGET/" 2>/dev/null || \
    sudo cp -r "$WSL_MODELS"/* "$MODELS_TARGET/"
else
    sudo cp -r "$WSL_MODELS"/* "$MODELS_TARGET/"
fi

# Fix permissions
if [ "$(stat -c %U "$MODELS_TARGET" 2>/dev/null)" != "$USER" ]; then
    sudo chown -R $USER:$USER "$MODELS_TARGET"
fi

# Count files
if [ -d "$MODELS_TARGET/models" ]; then
    MODEL_COUNT=$(find "$MODELS_TARGET/models" -type f 2>/dev/null | wc -l)
    TOTAL_SIZE=$(du -sh "$MODELS_TARGET" 2>/dev/null | cut -f1)
    echo -e "${GREEN}✓${NC} Copied Ollama models ($MODEL_COUNT files, $TOTAL_SIZE)"
else
    echo -e "${RED}✗${NC} Models directory structure not found"
    echo "Expected: $MODELS_TARGET/models/"
    exit 1
fi

echo ""

# ========================================
# Verification
# ========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Verification${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

ERRORS=0

# Check ollama.exe
if [ -f "$OLLAMA_TARGET" ]; then
    SIZE=$(du -h "$OLLAMA_TARGET" | cut -f1)
    echo -e "${GREEN}✓${NC} ollama.exe: $SIZE"
else
    echo -e "${RED}✗${NC} ollama.exe: MISSING"
    ERRORS=$((ERRORS + 1))
fi

# Check models
if [ -d "$MODELS_TARGET/models" ]; then
    COUNT=$(find "$MODELS_TARGET/models" -type f | wc -l)
    SIZE=$(du -sh "$MODELS_TARGET" | cut -f1)
    echo -e "${GREEN}✓${NC} ollama_models/: $COUNT files, $SIZE"

    # List available models
    if [ -d "$MODELS_TARGET/models/manifests" ]; then
        echo ""
        echo -e "${CYAN}Available models:${NC}"
        find "$MODELS_TARGET/models/manifests" -type d -mindepth 3 2>/dev/null | \
        sed 's|.*/manifests/[^/]*/[^/]*/||' | \
        while read model; do
            echo -e "  • $model"
        done
    fi
else
    echo -e "${RED}✗${NC} ollama_models/: MISSING"
    ERRORS=$((ERRORS + 1))
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ Ollama Setup Complete! ✓✓✓${NC}"
    echo ""
    echo "Files are ready at:"
    echo -e "  ${CYAN}$TAURI_DIR/sidecars/ollama.exe${NC}"
    echo -e "  ${CYAN}$TAURI_DIR/resources/ollama_models/${NC}"
    echo ""
else
    echo -e "${RED}✗ Setup incomplete ($ERRORS errors)${NC}"
    exit 1
fi
