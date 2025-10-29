# ========================================
# Video Analyzer Launcher Script
# ========================================
# Compiled into launcher.exe — main entry point.
# Responsibilities:
#   1. Starts Ollama service
#   2. Starts Python backend
#   3. Launches the Tauri UI
#   4. Monitors processes and cleans up on exit
#
# To compile:
#   ps2exe launcher.ps1 launcher.exe -noConsole -title "Video Analyzer"

param(
    [string]$InstallDir = $PSScriptRoot
)

$ErrorActionPreference = "SilentlyContinue"

# ========================================
# Configuration
# ========================================

$OLLAMA_EXE  = Join-Path $InstallDir "ollama.exe"
$BACKEND_EXE = Join-Path $InstallDir "video_analyzer_backend.exe"
$TAURI_EXE   = Join-Path $InstallDir "Video Analyzer.exe"

$OLLAMA_PORT = 11434
$BACKEND_PORT = 50051
$STARTUP_TIMEOUT = 300  # seconds

# ========================================
# Functions
# ========================================

function Test-PortListening {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient("127.0.0.1", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$Timeout = 30,
        [string]$ServiceName = "Service"
    )

    $elapsed = 0
    while ($elapsed -lt $Timeout) {
        if (Test-PortListening -Port $Port) {
            return $true
        }
        Start-Sleep -Milliseconds 500
        $elapsed++
    }

    [System.Windows.Forms.MessageBox]::Show(
        "$ServiceName failed to start within $Timeout seconds.",
        "Startup Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    return $false
}

function Start-ServiceProcess {
    param(
        [string]$ExePath,
        [string]$ServiceName,
        [hashtable]$EnvVars = @{}
    )

    # Debug info
    Write-Host "Launching $ServiceName"
    Write-Host " → Path: $ExePath"
    Write-Host " → Exists: $(Test-Path $ExePath)"

    if (-not (Test-Path $ExePath)) {
        [System.Windows.Forms.MessageBox]::Show(
            "Cannot find $ServiceName at: $ExePath",
            "Missing Component",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $null
    }

    # Check if already running
    $processName = [System.IO.Path]::GetFileNameWithoutExtension($ExePath)
    $existing = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($existing) {
        return $existing
    }

    # Create log directory in the app folder
    $logDir = Join-Path $InstallDir "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $logPath = Join-Path $logDir "$($ServiceName.ToLower())_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
    Write-Host " → Logging to: $logPath"

    # Prepare process start info
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $ExePath
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

    foreach ($key in $EnvVars.Keys) {
        $startInfo.EnvironmentVariables[$key] = $EnvVars[$key]
    }

    try {
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        $process.Start() | Out-Null

        # Async logging to file
        Start-Job {
            $out = $using:process.StandardOutput.ReadToEnd() + "`n" + $using:process.StandardError.ReadToEnd()
            Add-Content -Path $using:logPath -Value $out
        } | Out-Null

        return $process
    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Failed to start $ServiceName`n`nError: $_",
            "Startup Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
        return $null
    }
}

function Stop-ServiceProcess {
    param([string]$ProcessName)

    Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $_.Kill()
            $_.WaitForExit(5000)
        } catch { }
    }
}

# ========================================
# Main Launcher Logic
# ========================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Prevent duplicate instances
$mutex = New-Object System.Threading.Mutex($false, "Global\VideoAnalyzerLauncher")
if (-not $mutex.WaitOne(0)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Video Analyzer is already running.",
        "Already Running",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
    exit 0
}

# ========================================
# Step 1: Start Ollama
# ========================================

$ollamaEnv = @{
    "OLLAMA_HOST"   = "127.0.0.1:$OLLAMA_PORT"
    "OLLAMA_MODELS" = Join-Path $InstallDir "ollama_models"
}

$ollamaProcess = Start-ServiceProcess -ExePath $OLLAMA_EXE -ServiceName "Ollama" -EnvVars $ollamaEnv
if (-not $ollamaProcess) {
    $mutex.ReleaseMutex()
    exit 1
}

if (-not (Wait-ForPort -Port $OLLAMA_PORT -Timeout 120 -ServiceName "Ollama")) {
    Stop-ServiceProcess -ProcessName "ollama"
    $mutex.ReleaseMutex()
    exit 1
}

# ========================================
# Step 2: Start Backend
# ========================================

$backendEnv = @{
    "OLLAMA_BASE_URL"       = "http://127.0.0.1:$OLLAMA_PORT"
    "FUNCTION_CALLING_BACKEND" = "ollama"
    "CHAT_BACKEND"             = "ollama"
    "HF_HUB_OFFLINE"           = "true"
    "TRANSFORMERS_OFFLINE"     = "true"
    "GRPC_PORT"                = "$BACKEND_PORT"
}

$backendProcess = Start-ServiceProcess -ExePath $BACKEND_EXE -ServiceName "Backend" -EnvVars $backendEnv
if (-not $backendProcess) {
    Stop-ServiceProcess -ProcessName "ollama"
    $mutex.ReleaseMutex()
    exit 1
}

if (-not (Wait-ForPort -Port $BACKEND_PORT -Timeout $STARTUP_TIMEOUT -ServiceName "Backend")) {
    Stop-ServiceProcess -ProcessName "video_analyzer_backend"
    Stop-ServiceProcess -ProcessName "ollama"
    $mutex.ReleaseMutex()
    exit 1
}

# ========================================
# Step 3: Launch Tauri UI
# ========================================

if (-not (Test-Path $TAURI_EXE)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Cannot find Video Analyzer UI at: $TAURI_EXE",
        "Missing Component",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    Stop-ServiceProcess -ProcessName "video_analyzer_backend"
    Stop-ServiceProcess -ProcessName "ollama"
    $mutex.ReleaseMutex()
    exit 1
}

$tauriProcess = Start-Process -FilePath $TAURI_EXE -PassThru

# ========================================
# Step 4: Monitor and Cleanup
# ========================================

$tauriProcess.WaitForExit()

Stop-ServiceProcess -ProcessName "video_analyzer_backend"
Stop-ServiceProcess -ProcessName "ollama"

$mutex.ReleaseMutex()
exit 0
