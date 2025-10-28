#!/bin/bash
# ========================================
# Build Launcher from WSL
# ========================================
# This script compiles launcher.ps1 to launcher.exe
# using PowerShell from within WSL

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Convert to Windows path
WINDOWS_PATH=$(wslpath -w "$SCRIPT_DIR" 2>/dev/null || echo "")

echo "========================================="
echo "Building launcher.exe from WSL"
echo "========================================="
echo "WSL Path: $SCRIPT_DIR"
echo "Windows Path: $WINDOWS_PATH"
echo ""

# Check if launcher.ps1 exists
if [ ! -f "$SCRIPT_DIR/launcher.ps1" ]; then
    echo "❌ Error: launcher.ps1 not found in $SCRIPT_DIR"
    exit 1
fi

echo "Step 1: Checking if ps2exe is installed..."
PS2EXE_CHECK=$(powershell.exe -Command "Get-Module -ListAvailable -Name ps2exe" 2>&1 || echo "NOT_FOUND")

if echo "$PS2EXE_CHECK" | grep -q "NOT_FOUND"; then
    echo "ps2exe not found. Installing..."
    powershell.exe -Command "Install-Module -Name ps2exe -Scope CurrentUser -Force"
    echo "✅ ps2exe installed"
elif [ -z "$PS2EXE_CHECK" ]; then
    echo "ps2exe not found. Installing..."
    powershell.exe -Command "Install-Module -Name ps2exe -Scope CurrentUser -Force"
    echo "✅ ps2exe installed"
else
    echo "✅ ps2exe is already installed"
fi

echo ""
echo "Step 2: Compiling launcher.ps1 to launcher.exe..."

# Escape the Windows path for PowerShell (using sed for compatibility)
ESCAPED_PATH=$(echo "$WINDOWS_PATH" | sed 's/\\/\\\\/g')

# Build the PowerShell command
PS_COMMAND="Set-Location '$ESCAPED_PATH'; ps2exe launcher.ps1 launcher.exe -noConsole -title 'Video Analyzer' -company 'Video Analyzer' -version '1.0.0'"

# Execute PowerShell command
powershell.exe -Command "$PS_COMMAND"

# Check if launcher.exe was created
if [ -f "$SCRIPT_DIR/launcher.exe" ]; then
    SIZE=$(du -h "$SCRIPT_DIR/launcher.exe" | cut -f1)
    echo ""
    echo "========================================="
    echo "✅ SUCCESS!"
    echo "========================================="
    echo "launcher.exe created: $SIZE"
    echo "Location: $SCRIPT_DIR/launcher.exe"
    echo ""
    echo "Next steps:"
    echo "  1. Copy to Tauri sidecars:"
    echo "     cp launcher.exe ../../my-tauri-app/src-tauri/sidecars/"
    echo ""
    echo "  2. Update tauri.conf.json to include 'sidecars/launcher.exe'"
    echo ""
    echo "  3. Build installer:"
    echo "     cd ../../my-tauri-app && npm run tauri build"
    echo ""
else
    echo ""
    echo "========================================="
    echo "❌ FAILED"
    echo "========================================="
    echo "launcher.exe was not created"
    echo "Check the PowerShell output above for errors"
    exit 1
fi
