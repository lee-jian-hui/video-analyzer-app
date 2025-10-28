# Windows Installer Scripts

Scripts and configuration for building a Windows installer with automatic system dependency installation.

## Quick Start (Windows Only)

```powershell
# 1. Download system dependencies
.\download-dependencies.ps1

# 2. Copy hooks file to Tauri project
Copy-Item .\hooks.nsh ..\..\..\my-tauri-app\src-tauri\windows\hooks.nsh

# 3. Build installer
cd ..\..\..\my-tauri-app
npm run tauri build
```

## Files

| File | Purpose | Destination |
|------|---------|-------------|
| `hooks.nsh` | NSIS installer hooks for dependency installation | `my-tauri-app/src-tauri/windows/` |
| `download-dependencies.ps1` | Downloads VC++, DirectX, ffmpeg installers | Run in this directory |
| `USAGE_GUIDE.md` | Complete documentation | Reference only |

## What Gets Installed Automatically

✅ **Visual C++ Redistributable** - Required for PyTorch/OpenCV (silent install)
✅ **DirectX Runtime** - Optional for video processing (user prompted)
✅ **ffmpeg** - Bundled as sidecar executable
❌ **Tesseract-OCR** - Optional for OCR features (user prompted)

## System Requirements

### Build Machine (You):
- Windows 10/11
- PowerShell 5.1+
- Internet connection (for downloading dependencies)
- Node.js, Rust, Tauri CLI

### End User Machine:
- Windows 10/11 (x64)
- 5GB+ free disk space
- **NO internet required** (fully offline after installation)
- **NO admin rights required** (if using `installMode: "perUser"`)

## File Sizes

- VC++ Redistributable: ~25MB
- DirectX: ~100KB
- ffmpeg: ~80MB
- Backend EXE: ~800MB-1.2GB (with ML models)
- Ollama + models: ~500MB-2GB
- **Total installer: 1.5GB - 3.5GB**

## Detailed Documentation

See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for:
- Step-by-step setup instructions
- Detailed explanation of what happens during install/uninstall
- Troubleshooting guide
- Advanced configuration options
- Testing procedures

See [../documentation/WINDOWS_OFFLINE_BUNDLE.md](../documentation/WINDOWS_OFFLINE_BUNDLE.md) for:
- Complete build workflow
- Backend EXE creation with PyInstaller
- Ollama setup and model bundling
- Tauri configuration

## Common Issues

### "Script cannot be loaded"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Could not find Tauri directory"
```powershell
.\download-dependencies.ps1 -TargetDir "C:\full\path\to\my-tauri-app\src-tauri"
```

### End user: "App crashes on launch"
VC++ failed to install. User should install manually: https://aka.ms/vs/17/release/vc_redist.x64.exe

## License

These scripts are part of the Video Analyzer project.
