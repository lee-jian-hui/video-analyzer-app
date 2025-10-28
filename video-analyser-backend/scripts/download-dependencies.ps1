# ========================================
# Video Analyzer Dependency Downloader
# ========================================
# This script downloads all required system dependencies for bundling
# with the Windows installer.
#
# Usage:
#   .\download-dependencies.ps1 [-TargetDir <path>]
#
# Requirements:
#   - Internet connection
#   - PowerShell 5.1 or higher
#   - ~200MB free disk space
#
# Downloads:
#   - Visual C++ Redistributable 2015-2022 x64
#   - DirectX End-User Runtime
#   - ffmpeg static build
#   - (Optional) Tesseract-OCR

param(
    [string]$TargetDir = "",
    [switch]$SkipTesseract = $false,
    [switch]$Help = $false
)

$ErrorActionPreference = "Stop"

# ========================================
# Help Message
# ========================================
if ($Help) {
    Write-Host @"
Video Analyzer Dependency Downloader

Usage:
    .\download-dependencies.ps1 [-TargetDir <path>] [-SkipTesseract] [-Help]

Parameters:
    -TargetDir       : Target directory for Tauri app (default: auto-detect)
    -SkipTesseract   : Skip downloading Tesseract-OCR installer
    -Help            : Show this help message

Examples:
    .\download-dependencies.ps1
    .\download-dependencies.ps1 -TargetDir "C:\Projects\my-tauri-app\src-tauri"
    .\download-dependencies.ps1 -SkipTesseract

This script will download:
    - Visual C++ Redistributable (~25MB) - REQUIRED
    - DirectX End-User Runtime (~100KB) - Recommended
    - ffmpeg static build (~80MB) - REQUIRED
    - Tesseract-OCR installer (~40MB) - Optional

Total download size: ~150MB (or ~110MB with -SkipTesseract)
"@
    exit 0
}

# ========================================
# Configuration
# ========================================
$URLS = @{
    VCRedist = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    DirectX = "https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe"
    FFmpeg = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    Tesseract = "https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe"
}

# ========================================
# Functions
# ========================================

function Write-Banner {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor White
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutputPath,
        [string]$Description
    )

    Write-Info "Downloading $Description..."
    Write-Info "  URL: $Url"
    Write-Info "  Output: $OutputPath"

    try {
        # Use Invoke-WebRequest with progress
        $ProgressPreference = 'Continue'
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing

        if (Test-Path $OutputPath) {
            $fileSize = (Get-Item $OutputPath).Length / 1MB
            Write-Success "Downloaded $Description ($([math]::Round($fileSize, 2)) MB)"
            return $true
        } else {
            Write-Error "Failed to download $Description"
            return $false
        }
    } catch {
        Write-Error "Failed to download $Description : $_"
        return $false
    }
}

function Find-TauriDirectory {
    Write-Info "Attempting to auto-detect Tauri directory..."

    # Look for common patterns
    $searchPaths = @(
        "$PSScriptRoot\..\..\video-analyzer-app\my-tauri-app\src-tauri",
        "$PSScriptRoot\..\..\..\my-tauri-app\src-tauri",
        "$PSScriptRoot\..\..\..\video-analyzer-app\my-tauri-app\src-tauri"
    )

    foreach ($path in $searchPaths) {
        $resolved = Resolve-Path -Path $path -ErrorAction SilentlyContinue
        if ($resolved -and (Test-Path "$resolved\tauri.conf.json")) {
            Write-Success "Found Tauri directory: $resolved"
            return $resolved.Path
        }
    }

    Write-Warning "Could not auto-detect Tauri directory."
    return $null
}

# ========================================
# Main Script
# ========================================

Write-Banner "Video Analyzer Dependency Downloader"

# Determine target directory
if ([string]::IsNullOrEmpty($TargetDir)) {
    $TargetDir = Find-TauriDirectory

    if ([string]::IsNullOrEmpty($TargetDir)) {
        Write-Error "Could not find Tauri directory automatically."
        Write-Info "Please specify the target directory with -TargetDir parameter."
        Write-Info "Example: .\download-dependencies.ps1 -TargetDir 'C:\path\to\my-tauri-app\src-tauri'"
        exit 1
    }
} else {
    if (-not (Test-Path $TargetDir)) {
        Write-Error "Target directory does not exist: $TargetDir"
        exit 1
    }
}

Write-Info "Target directory: $TargetDir"

# Create directory structure
$InstallersDir = Join-Path $TargetDir "resources\installers"
$SidecarsDir = Join-Path $TargetDir "sidecars"
$TempDir = Join-Path $env:TEMP "video-analyzer-deps"

Write-Info "Creating directory structure..."
New-Item -ItemType Directory -Force -Path $InstallersDir | Out-Null
New-Item -ItemType Directory -Force -Path $SidecarsDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Success "Directories created."

# ========================================
# Download Dependencies
# ========================================

$downloadResults = @{}

# 1. Visual C++ Redistributable (CRITICAL)
Write-Banner "1/4: Visual C++ Redistributable"
$vcPath = Join-Path $InstallersDir "vc_redist.x64.exe"
if (Test-Path $vcPath) {
    Write-Warning "VC++ Redistributable already exists. Skipping download."
    $downloadResults["VCRedist"] = "Skipped"
} else {
    $downloadResults["VCRedist"] = Download-File -Url $URLS.VCRedist -OutputPath $vcPath -Description "Visual C++ Redistributable"
}

# 2. DirectX End-User Runtime
Write-Banner "2/4: DirectX End-User Runtime"
$dxPath = Join-Path $InstallersDir "dxwebsetup.exe"
if (Test-Path $dxPath) {
    Write-Warning "DirectX installer already exists. Skipping download."
    $downloadResults["DirectX"] = "Skipped"
} else {
    $downloadResults["DirectX"] = Download-File -Url $URLS.DirectX -OutputPath $dxPath -Description "DirectX End-User Runtime"
}

# 3. ffmpeg
Write-Banner "3/4: ffmpeg"
$ffmpegPath = Join-Path $SidecarsDir "ffmpeg.exe"
if (Test-Path $ffmpegPath) {
    Write-Warning "ffmpeg.exe already exists. Skipping download."
    $downloadResults["FFmpeg"] = "Skipped"
} else {
    $ffmpegZip = Join-Path $TempDir "ffmpeg.zip"

    if (Download-File -Url $URLS.FFmpeg -OutputPath $ffmpegZip -Description "ffmpeg") {
        Write-Info "Extracting ffmpeg..."
        try {
            Expand-Archive -Path $ffmpegZip -DestinationPath $TempDir -Force

            # Find ffmpeg.exe in extracted folders
            $ffmpegExe = Get-ChildItem -Path $TempDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1

            if ($ffmpegExe) {
                Copy-Item -Path $ffmpegExe.FullName -Destination $ffmpegPath -Force
                Write-Success "Extracted ffmpeg.exe to sidecars/"
                $downloadResults["FFmpeg"] = $true
            } else {
                Write-Error "Could not find ffmpeg.exe in downloaded archive"
                $downloadResults["FFmpeg"] = $false
            }

            # Cleanup
            Remove-Item -Path $ffmpegZip -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Error "Failed to extract ffmpeg: $_"
            $downloadResults["FFmpeg"] = $false
        }
    } else {
        $downloadResults["FFmpeg"] = $false
    }
}

# 4. Tesseract-OCR (Optional)
Write-Banner "4/4: Tesseract-OCR (Optional)"
if ($SkipTesseract) {
    Write-Warning "Tesseract-OCR download skipped (--SkipTesseract flag)"
    $downloadResults["Tesseract"] = "Skipped"
} else {
    $tessPath = Join-Path $InstallersDir "tesseract-ocr-setup.exe"
    if (Test-Path $tessPath) {
        Write-Warning "Tesseract-OCR installer already exists. Skipping download."
        $downloadResults["Tesseract"] = "Skipped"
    } else {
        Write-Warning "Tesseract-OCR is optional. Only needed if using OCR features."
        $response = Read-Host "Download Tesseract-OCR? (Y/N)"
        if ($response -eq 'Y' -or $response -eq 'y') {
            $downloadResults["Tesseract"] = Download-File -Url $URLS.Tesseract -OutputPath $tessPath -Description "Tesseract-OCR"
        } else {
            Write-Info "Skipping Tesseract-OCR download."
            $downloadResults["Tesseract"] = "Skipped"
        }
    }
}

# ========================================
# Cleanup
# ========================================

Write-Info "Cleaning up temporary files..."
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# ========================================
# Summary
# ========================================

Write-Banner "Download Summary"

foreach ($dep in $downloadResults.GetEnumerator()) {
    $status = if ($dep.Value -eq $true) {
        "OK"
    } elseif ($dep.Value -eq "Skipped") {
        "SKIPPED"
    } else {
        "FAILED"
    }

    $color = if ($dep.Value -eq $true) { "Green" }
             elseif ($dep.Value -eq "Skipped") { "Yellow" }
             else { "Red" }

    Write-Host "  $($dep.Key): " -NoNewline
    Write-Host $status -ForegroundColor $color
}

# Check for critical failures
$criticalFailed = ($downloadResults["VCRedist"] -eq $false) -or ($downloadResults["FFmpeg"] -eq $false)

if ($criticalFailed) {
    Write-Error "Critical dependencies failed to download!"
    Write-Error "The application will NOT work without these dependencies."
    exit 1
}

Write-Banner "All Done!"

Write-Success "Dependencies downloaded successfully to:"
Write-Host "  Installers: $InstallersDir" -ForegroundColor Cyan
Write-Host "  Sidecars: $SidecarsDir" -ForegroundColor Cyan

Write-Info ""
Write-Info "Next steps:"
Write-Info "  1. Copy hooks.nsh to: $TargetDir\windows\hooks.nsh"
Write-Info "  2. Update tauri.conf.json to include:"
Write-Info "       - resources/installers/** in bundle.resources"
Write-Info "       - ./windows/hooks.nsh in bundle.windows.nsis.installerHooks"
Write-Info "  3. Run: npm run tauri build"

Write-Host ""
