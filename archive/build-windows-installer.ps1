# Build Windows Installer Script
# Run this on Windows (not WSL)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Video Analyzer Windows Installer" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$tools = @(
    @{Name="Node.js"; Command="node"; Args="--version"},
    @{Name="npm"; Command="npm"; Args="--version"},
    @{Name="Rust"; Command="cargo"; Args="--version"},
    @{Name="protoc"; Command="protoc"; Args="--version"}
)

foreach ($tool in $tools) {
    try {
        $version = & $tool.Command $tool.Args 2>&1
        Write-Host "  ✓ $($tool.Name): $version" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $($tool.Name) not found!" -ForegroundColor Red
        Write-Host "    Please install $($tool.Name)" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Check required files
Write-Host "`nChecking required files..." -ForegroundColor Yellow

$requiredFiles = @(
    "my-tauri-app/src-tauri/sidecars/launcher-x86_64-pc-windows-msvc.exe",
    "my-tauri-app/src-tauri/sidecars/video_analyzer_backend/video_analyzer_backend.exe",
    "my-tauri-app/src-tauri/sidecars/ollama.exe",
    "my-tauri-app/src-tauri/sidecars/ffmpeg.exe",
    "my-tauri-app/src-tauri/resources/installers/vc_redist.x64.exe",
    "my-tauri-app/src-tauri/resources/installers/dxwebsetup.exe"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $size = [math]::Round((Get-Item $file).Length / 1MB, 2)
        Write-Host "  ✓ $file ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing: $file" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Missing required files!" -ForegroundColor Red
    Write-Host "Please download or build the missing files." -ForegroundColor Yellow
    Write-Host "See BUILD_WINDOWS.md for instructions.`n" -ForegroundColor Yellow
    exit 1
}

# Step 3: Install frontend dependencies
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
Push-Location my-tauri-app
try {
    npm ci
    Write-Host "  ✓ Frontend dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to install frontend dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Step 4: Build Tauri application
Write-Host "`nBuilding Tauri application..." -ForegroundColor Yellow
Write-Host "This may take 10-15 minutes...`n" -ForegroundColor Gray

try {
    npm run tauri build
    Write-Host "`n✓ Build completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "`n✗ Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

# Step 5: Show build artifacts
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build Artifacts:" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Get-ChildItem -Path "my-tauri-app/src-tauri/target/release/bundle" -Recurse -File |
    Where-Object { $_.Extension -eq ".exe" -or $_.Extension -eq ".msi" } |
    ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  📦 $($_.Name) - ${size} MB" -ForegroundColor Green
        Write-Host "     $($_.FullName)" -ForegroundColor Gray
    }

Write-Host "`n✅ Done!" -ForegroundColor Green
