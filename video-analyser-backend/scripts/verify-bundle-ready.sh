#!/bin/bash
# ========================================
# Verify Bundle Readiness
# ========================================
# This script checks if all required files are in place
# before building the Windows installer

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$SCRIPT_DIR/../../my-tauri-app/src-tauri"

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Checking Bundle Readiness${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

check_file() {
    local file_path=$1
    local description=$2
    local required=$3  # "required" or "optional"

    if [ -f "$file_path" ]; then
        local size=$(du -h "$file_path" | cut -f1)
        echo -e "${GREEN}✓${NC} $description: ${GREEN}Found${NC} ($size)"
        return 0
    else
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗${NC} $description: ${RED}MISSING${NC}"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}⚠${NC} $description: ${YELLOW}Not found (optional)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

check_dir() {
    local dir_path=$1
    local description=$2
    local required=$3

    if [ -d "$dir_path" ]; then
        local count=$(find "$dir_path" -type f | wc -l)
        echo -e "${GREEN}✓${NC} $description: ${GREEN}Found${NC} ($count files)"
        return 0
    else
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗${NC} $description: ${RED}MISSING${NC}"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}⚠${NC} $description: ${YELLOW}Not found (optional)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

# ========================================
# 1. Check Sidecars (Executables)
# ========================================
echo -e "${CYAN}[1] Checking Sidecars (Executables)${NC}"
echo "Location: $TAURI_DIR/sidecars/"
echo ""

check_file "$TAURI_DIR/sidecars/launcher.exe" "launcher.exe" "required"
check_dir "$TAURI_DIR/sidecars/video_analyzer_backend" "video_analyzer_backend/" "required"
if [ -d "$TAURI_DIR/sidecars/video_analyzer_backend" ]; then
    check_file "$TAURI_DIR/sidecars/video_analyzer_backend/video_analyzer_backend.exe" "  └─ video_analyzer_backend.exe" "required"
fi

echo ""

# ========================================
# 2. Check Resources (Data & Installers)
# ========================================
echo -e "${CYAN}[2] Checking Resources${NC}"
echo "Location: $TAURI_DIR/resources/"
echo ""

check_file "$TAURI_DIR/resources/ollama.exe" "ollama.exe" "required"
check_dir "$TAURI_DIR/resources/models" "models/" "required"
check_file "$TAURI_DIR/resources/vc_redist.x64.exe" "VC++ Redistributable" "required"
check_file "$TAURI_DIR/resources/dxwebsetup.exe" "DirectX Runtime" "optional"
check_file "$TAURI_DIR/resources/ffmpeg.exe" "ffmpeg.exe" "required"

echo ""

# ========================================
# 3. Check NSIS Hooks
# ========================================
echo -e "${CYAN}[3] Checking NSIS Hooks${NC}"
echo "Location: $TAURI_DIR/windows/"
echo ""

check_file "$TAURI_DIR/windows/hooks.nsh" "hooks.nsh" "required"

echo ""

# ========================================
# 4. Check tauri.conf.json
# ========================================
echo -e "${CYAN}[4] Checking tauri.conf.json Configuration${NC}"
echo "Location: $TAURI_DIR/tauri.conf.json"
echo ""

if [ -f "$TAURI_DIR/tauri.conf.json" ]; then
    # Check if launcher is in externalBin
    if grep -q '"sidecars/launcher"' "$TAURI_DIR/tauri.conf.json"; then
        echo -e "${GREEN}✓${NC} launcher listed in externalBin"
    else
        echo -e "${RED}✗${NC} launcher NOT in externalBin"
        ERRORS=$((ERRORS + 1))
    fi

    # Check if hooks.nsh is configured
    if grep -q '"installerHooks"' "$TAURI_DIR/tauri.conf.json"; then
        echo -e "${GREEN}✓${NC} installerHooks configured"
    else
        echo -e "${RED}✗${NC} installerHooks NOT configured"
        ERRORS=$((ERRORS + 1))
    fi

    # Check if resources are included
    if grep -q '"resources"' "$TAURI_DIR/tauri.conf.json"; then
        echo -e "${GREEN}✓${NC} bundle.resources configured"
    else
        echo -e "${RED}✗${NC} bundle.resources NOT configured"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} tauri.conf.json NOT FOUND"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ========================================
# 5. Check Build Tools
# ========================================
echo -e "${CYAN}[5] Checking Build Tools${NC}"
echo ""

# Check Rust
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version | cut -d' ' -f2)
    echo -e "${GREEN}✓${NC} Rust: $RUST_VERSION"
else
    echo -e "${RED}✗${NC} Rust NOT installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Windows target
if rustup target list | grep -q "x86_64-pc-windows-msvc (installed)"; then
    echo -e "${GREEN}✓${NC} Windows Rust target: x86_64-pc-windows-msvc"
else
    echo -e "${YELLOW}⚠${NC} Windows Rust target NOT installed"
    echo "      Run: rustup target add x86_64-pc-windows-msvc"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js NOT installed"
    ERRORS=$((ERRORS + 1))
fi

# Check Tauri CLI
if command -v cargo-tauri &> /dev/null; then
    echo -e "${GREEN}✓${NC} Tauri CLI installed"
elif [ -f "$TAURI_DIR/../../node_modules/.bin/tauri" ]; then
    echo -e "${GREEN}✓${NC} Tauri CLI (npm)"
else
    echo -e "${RED}✗${NC} Tauri CLI NOT installed"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ========================================
# Summary
# ========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo -e "${CYAN}You are ready to build the installer:${NC}"
    echo ""
    echo "  cd $SCRIPT_DIR/../../my-tauri-app"
    echo "  npm run tauri build"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s)${NC}"
    echo ""
    echo -e "${CYAN}You can build, but some optional components are missing.${NC}"
    echo ""
    echo "  cd $SCRIPT_DIR/../../my-tauri-app"
    echo "  npm run tauri build"
    echo ""
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo ""
    echo -e "${RED}Please fix the errors above before building.${NC}"
    echo ""

    # Provide helpful hints
    echo -e "${CYAN}Quick fixes:${NC}"
    echo ""

    if [ ! -f "$TAURI_DIR/sidecars/launcher.exe" ]; then
        echo "  # Copy launcher.exe:"
        echo "  cp $SCRIPT_DIR/launcher.exe $TAURI_DIR/sidecars/"
        echo ""
    fi

    if [ ! -f "$TAURI_DIR/windows/hooks.nsh" ]; then
        echo "  # Copy hooks.nsh:"
        echo "  cp $SCRIPT_DIR/hooks.nsh $TAURI_DIR/windows/"
        echo ""
    fi

    if [ ! -f "$TAURI_DIR/resources/installers/vc_redist.x64.exe" ]; then
        echo "  # Download system dependencies:"
        echo "  cd $SCRIPT_DIR"
        echo "  powershell.exe -File download-dependencies.ps1"
        echo ""
    fi

    if [ ! -f "$TAURI_DIR/sidecars/video_analyzer_backend.exe" ]; then
        echo "  # Build Python backend:"
        echo "  cd $SCRIPT_DIR/.."
        echo "  uv run pyinstaller server.py --name video_analyzer_backend --onefile"
        echo "  cp dist/video_analyzer_backend.exe $TAURI_DIR/sidecars/"
        echo ""
    fi

    exit 1
fi
