# ========================================
# Backend Debug Script
# ========================================
# This script helps debug why the backend isn't starting
# Run this from the installation directory: D:\my-tauri-app

param(
    [string]$InstallDir = $PSScriptRoot
)

Write-Host "=== Video Analyzer Backend Debug ===" -ForegroundColor Cyan
Write-Host "Installation Directory: $InstallDir`n" -ForegroundColor Gray

# ========================================
# 1. Verify File Existence
# ========================================
Write-Host "1. Checking required files..." -ForegroundColor Yellow

$requiredFiles = @(
    "sidecars\ollama.exe",
    "sidecars\video_analyzer_backend\video_analyzer_backend.exe",
    "sidecars\ffmpeg.exe",
    "resources\ollama_models\models\blobs",
    "resources\ollama_models\models\manifests"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    $path = Join-Path $InstallDir $file
    if (Test-Path $path) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file MISSING" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "`nError: Some required files are missing. Reinstall the application." -ForegroundColor Red
    exit 1
}

# ========================================
# 2. Check Port Availability
# ========================================
Write-Host "`n2. Checking port availability..." -ForegroundColor Yellow

$OLLAMA_PORT = 11434
$BACKEND_PORT = 50051

function Test-PortInUse {
    param([int]$Port)
    $connections = netstat -ano | Select-String ":$Port "
    if ($connections) {
        return $true
    }
    return $false
}

if (Test-PortInUse -Port $OLLAMA_PORT) {
    Write-Host "  ⚠ Port $OLLAMA_PORT (Ollama) is already in use" -ForegroundColor Yellow
    $existingOllama = netstat -ano | Select-String ":$OLLAMA_PORT " | Select-Object -First 1
    Write-Host "    $existingOllama" -ForegroundColor Gray
    Write-Host "    This might be your existing Ollama installation" -ForegroundColor Gray
} else {
    Write-Host "  ✓ Port $OLLAMA_PORT (Ollama) is available" -ForegroundColor Green
}

if (Test-PortInUse -Port $BACKEND_PORT) {
    Write-Host "  ⚠ Port $BACKEND_PORT (Backend) is already in use" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Port $BACKEND_PORT (Backend) is available" -ForegroundColor Green
}

# ========================================
# 3. Check Running Processes
# ========================================
Write-Host "`n3. Checking running processes..." -ForegroundColor Yellow

$ollamaProcs = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
$backendProcs = Get-Process -Name "video_analyzer_backend" -ErrorAction SilentlyContinue

if ($ollamaProcs) {
    Write-Host "  Found Ollama processes:" -ForegroundColor Cyan
    $ollamaProcs | ForEach-Object {
        Write-Host "    PID: $($_.Id), Path: $($_.Path)" -ForegroundColor Gray
    }
} else {
    Write-Host "  No Ollama processes running" -ForegroundColor Gray
}

if ($backendProcs) {
    Write-Host "  ✓ Backend is running (PID: $($backendProcs.Id))" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  ✗ Backend is NOT running" -ForegroundColor Red
}

# ========================================
# 4. Try Starting Backend Manually
# ========================================
Write-Host "`n4. Attempting to start backend manually..." -ForegroundColor Yellow
Write-Host "   This will show any error messages from the backend startup`n" -ForegroundColor Gray

$backendExe = Join-Path $InstallDir "sidecars\video_analyzer_backend\video_analyzer_backend.exe"
$ollamaModelsDir = Join-Path $InstallDir "resources\ollama_models"

# Set environment variables
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:GRPC_PORT = "50051"
$env:FUNCTION_CALLING_BACKEND = "ollama"
$env:CHAT_BACKEND = "ollama"
$env:HF_HUB_OFFLINE = "true"
$env:TRANSFORMERS_OFFLINE = "true"
$env:LOG_LEVEL = "DEBUG"
$env:OLLAMA_MODELS = $ollamaModelsDir

Write-Host "Environment:" -ForegroundColor Cyan
Write-Host "  OLLAMA_BASE_URL: $env:OLLAMA_BASE_URL" -ForegroundColor Gray
Write-Host "  GRPC_PORT: $env:GRPC_PORT" -ForegroundColor Gray
Write-Host "  OLLAMA_MODELS: $env:OLLAMA_MODELS" -ForegroundColor Gray
Write-Host "  LOG_LEVEL: $env:LOG_LEVEL`n" -ForegroundColor Gray

Write-Host "Starting backend (press Ctrl+C to stop)..." -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor DarkGray

try {
    # Run backend with visible output
    & $backendExe
} catch {
    Write-Host "`nBackend crashed with error: $_" -ForegroundColor Red
}

Write-Host "`n================================================" -ForegroundColor DarkGray
Write-Host "Backend exited. Check the output above for errors." -ForegroundColor Yellow
