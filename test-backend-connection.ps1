# ========================================
# Backend Connection Test Script
# ========================================
# This script tests if the backend gRPC server is responding
# Assumes backend is already running on port 50051

Write-Host "=== Backend Connection Test ===" -ForegroundColor Cyan

$BACKEND_PORT = 50051

# ========================================
# 1. Test Port Connectivity
# ========================================
Write-Host "`n1. Testing port connectivity..." -ForegroundColor Yellow

try {
    $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port $BACKEND_PORT -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "  ✓ Backend port $BACKEND_PORT is reachable" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Backend port $BACKEND_PORT is NOT reachable" -ForegroundColor Red
        Write-Host "    Make sure the backend is running first." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  ✗ Connection test failed: $_" -ForegroundColor Red
    exit 1
}

# ========================================
# 2. Check if gRPC Service is Responding
# ========================================
Write-Host "`n2. Testing gRPC service..." -ForegroundColor Yellow
Write-Host "   Note: This is a basic TCP test. For full gRPC test, use grpcurl or Python script." -ForegroundColor Gray

$socket = $null
try {
    $socket = New-Object System.Net.Sockets.TcpClient
    $socket.Connect("127.0.0.1", $BACKEND_PORT)

    if ($socket.Connected) {
        Write-Host "  ✓ Successfully connected to backend TCP socket" -ForegroundColor Green
        Write-Host "    The backend appears to be listening." -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Failed to connect: $_" -ForegroundColor Red
} finally {
    if ($socket) {
        $socket.Close()
    }
}

# ========================================
# 3. Check Backend Process
# ========================================
Write-Host "`n3. Checking backend process..." -ForegroundColor Yellow

$backendProc = Get-Process -Name "video_analyzer_backend" -ErrorAction SilentlyContinue

if ($backendProc) {
    Write-Host "  ✓ Backend process is running" -ForegroundColor Green
    Write-Host "    PID: $($backendProc.Id)" -ForegroundColor Gray
    Write-Host "    CPU: $($backendProc.CPU)" -ForegroundColor Gray
    Write-Host "    Memory: $([math]::Round($backendProc.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Backend process not found" -ForegroundColor Red
}

Write-Host "`nConnection test complete." -ForegroundColor Cyan
