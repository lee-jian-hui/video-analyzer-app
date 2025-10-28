; ========================================
; Video Analyzer NSIS Installer Hooks
; ========================================
; This file contains installer hooks for automatic system dependency installation
; Place this file in: my-tauri-app/src-tauri/windows/hooks.nsh
;
; Handles:
; - Visual C++ Redistributable detection and installation
; - DirectX End-User Runtime installation
; - Tesseract-OCR optional installation
; - Process cleanup during uninstallation
; - Registry management for first-run detection

!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"

; ========================================
; PREINSTALL HOOK
; ========================================
; Runs before any files are copied
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Checking system requirements..."

  ; Check Windows version
  ${If} ${IsWin7}
    MessageBox MB_ICONINFORMATION "Windows 7 detected. Some features may require system updates.$\n$\nPlease ensure Windows Update is current."
  ${EndIf}

  ; Check available disk space (require at least 5GB free)
  ${GetRoot} "$INSTDIR" $0
  ${DriveSpace} "$0" "/D=F /S=M" $1
  ${If} $1 < 5120  ; 5GB in MB
    MessageBox MB_ICONEXCLAMATION "Warning: Low disk space detected.$\n$\nAvailable: $1 MB$\nRecommended: 5120 MB (5 GB)$\n$\nInstallation may fail if disk space is insufficient."
  ${EndIf}

  DetailPrint "System check complete."
!macroend

; ========================================
; POSTINSTALL HOOK
; ========================================
; Runs after all files are copied, before shortcuts are created
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Installing system dependencies..."

  ; ========================================
  ; 1. Visual C++ Redistributable (CRITICAL)
  ; ========================================
  DetailPrint "Checking Visual C++ Redistributable..."

  ; Check if VC++ 2015-2022 is installed (x64)
  ; Registry path: HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64
  ReadRegDWord $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

  ${If} $0 == 1
    DetailPrint "Visual C++ Redistributable already installed."
    Goto vcredist_done
  ${EndIf}

  ; Not installed - check if we have the installer
  ${If} ${FileExists} "$INSTDIR\resources\installers\vc_redist.x64.exe"
    DetailPrint "Visual C++ Redistributable not found. Installing..."

    ; Copy to TEMP to avoid path/permission issues
    CopyFiles /SILENT "$INSTDIR\resources\installers\vc_redist.x64.exe" "$TEMP\vc_redist.x64.exe"

    ; Install silently with no restart
    ; /install = Install
    ; /quiet = No UI
    ; /norestart = Don't restart automatically
    ExecWait '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart' $1

    ; Check exit code
    ${If} $1 == 0
      DetailPrint "Visual C++ Redistributable installed successfully."
    ${ElseIf} $1 == 3010
      DetailPrint "Visual C++ Redistributable installed (restart required)."
      ; Set reboot flag for NSIS
      SetRebootFlag true
    ${ElseIf} $1 == 1638
      DetailPrint "Visual C++ Redistributable: Newer version already installed."
    ${Else}
      ; Installation failed
      DetailPrint "Warning: Visual C++ installation returned code $1"
      MessageBox MB_ICONEXCLAMATION "Visual C++ Redistributable installation encountered an issue (code $1).$\n$\nThe application may not function correctly.$\n$\nYou can install it manually from:$\nhttps://aka.ms/vs/17/release/vc_redist.x64.exe"
    ${EndIf}

    ; Clean up temporary installer
    Delete "$TEMP\vc_redist.x64.exe"

    ; Clean up from installed location (no longer needed)
    Delete "$INSTDIR\resources\installers\vc_redist.x64.exe"
  ${Else}
    ; Installer not bundled - warn user
    MessageBox MB_ICONEXCLAMATION "Visual C++ Redistributable is required but was not bundled.$\n$\nPlease install it manually from:$\nhttps://aka.ms/vs/17/release/vc_redist.x64.exe$\n$\nThe application will not work without this."
  ${EndIf}

  vcredist_done:

  ; ========================================
  ; 2. DirectX End-User Runtime (Optional)
  ; ========================================
  DetailPrint "Checking DirectX runtime..."

  ; Check if DirectX 9.0c DLLs are present
  IfFileExists "$SYSDIR\d3dx9_43.dll" dx_found dx_check_install

  dx_check_install:
    DetailPrint "DirectX runtime components may be missing."

    ${If} ${FileExists} "$INSTDIR\resources\installers\dxwebsetup.exe"
      ; Ask user if they want to install (this one requires internet for full install)
      ; Or use offline installer if bundled
      MessageBox MB_YESNO "Install DirectX End-User Runtime?$\n$\n(Recommended for video processing)" IDYES dx_install IDNO dx_skip

      dx_install:
        DetailPrint "Installing DirectX runtime..."
        CopyFiles /SILENT "$INSTDIR\resources\installers\dxwebsetup.exe" "$TEMP\dxwebsetup.exe"

        ; DirectX web setup - silent install
        ExecWait '"$TEMP\dxwebsetup.exe" /Q' $2

        ${If} $2 == 0
          DetailPrint "DirectX runtime installed successfully."
        ${Else}
          DetailPrint "DirectX runtime installation returned code $2"
        ${EndIf}

        Delete "$TEMP\dxwebsetup.exe"
        Delete "$INSTDIR\resources\installers\dxwebsetup.exe"
        Goto dx_found

      dx_skip:
        DetailPrint "DirectX runtime installation skipped."
    ${EndIf}

  dx_found:

  ; ========================================
  ; 3. Tesseract-OCR (Optional)
  ; ========================================
  ${If} ${FileExists} "$INSTDIR\resources\installers\tesseract-ocr-setup.exe"
    DetailPrint "Tesseract-OCR installer found."

    ; Ask user if they want OCR features
    MessageBox MB_YESNO "Install Tesseract-OCR for text recognition features?$\n$\n(Optional - adds ~150MB)" IDYES tess_install IDNO tess_skip

    tess_install:
      DetailPrint "Installing Tesseract-OCR..."

      ; Tesseract silent install
      ; /S = Silent
      ; /D= = Install directory (must be last parameter, no quotes)
      ExecWait '"$INSTDIR\resources\installers\tesseract-ocr-setup.exe" /S /D=$PROGRAMFILES64\Tesseract-OCR' $3

      ${If} $3 == 0
        DetailPrint "Tesseract-OCR installed successfully."

        ; Set environment variable for the backend to find it
        ; Note: This sets it for current user only
        WriteRegStr HKCU "Environment" "TESSDATA_PREFIX" "$PROGRAMFILES64\Tesseract-OCR\tessdata"

        ; Notify system of environment variable change
        SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
      ${Else}
        DetailPrint "Tesseract-OCR installation returned code $3"
      ${EndIf}

      Delete "$INSTDIR\resources\installers\tesseract-ocr-setup.exe"
      Goto tess_done

    tess_skip:
      DetailPrint "Tesseract-OCR installation skipped."
      Delete "$INSTDIR\resources\installers\tesseract-ocr-setup.exe"
  ${EndIf}

  tess_done:

  ; ========================================
  ; 4. Registry Entries for Application
  ; ========================================
  DetailPrint "Creating application registry entries..."

  ; Store installation path
  WriteRegStr HKCU "Software\VideoAnalyzer" "InstallPath" "$INSTDIR"

  ; First run marker (app can check this and show welcome screen)
  WriteRegStr HKCU "Software\VideoAnalyzer" "FirstRun" "1"

  ; Store version
  WriteRegStr HKCU "Software\VideoAnalyzer" "Version" "${VERSION}"

  ; Installation timestamp
  WriteRegStr HKCU "Software\VideoAnalyzer" "InstallDate" "$YEAR-$MONTH-$DAY"

  DetailPrint "Installation complete!"

!macroend

; ========================================
; PREUNINSTALL HOOK
; ========================================
; Runs before any files are removed
!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping Video Analyzer processes..."

  ; Kill all related processes
  ; /F = Force termination
  ; /IM = Image name (process name)
  ; /T = Terminate child processes too

  ; Kill backend
  nsExec::ExecToLog 'taskkill /F /IM video_analyzer_backend.exe /T'
  Pop $0

  ; Kill Ollama
  nsExec::ExecToLog 'taskkill /F /IM ollama.exe /T'
  Pop $0

  ; Kill ffmpeg (might be running)
  nsExec::ExecToLog 'taskkill /F /IM ffmpeg.exe /T'
  Pop $0

  ; Wait for processes to terminate
  Sleep 2000

  DetailPrint "Processes stopped."

  ; Clean up registry entries
  DeleteRegKey HKCU "Software\VideoAnalyzer"

!macroend

; ========================================
; POSTUNINSTALL HOOK
; ========================================
; Runs after all files are removed
!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Performing final cleanup..."

  ; Ask user if they want to remove user data
  MessageBox MB_YESNO "Remove all user data, videos, and outputs?$\n$\n(This cannot be undone)" IDYES cleanup IDNO skip_cleanup

  cleanup:
    DetailPrint "Removing user data..."

    ; Remove user data folders
    RMDir /r "$PROFILE\Documents\VideoAnalyzer"
    RMDir /r "$LOCALAPPDATA\VideoAnalyzer"
    RMDir /r "$APPDATA\VideoAnalyzer"

    DetailPrint "User data removed."
    Goto done

  skip_cleanup:
    DetailPrint "User data preserved."
    MessageBox MB_ICONINFORMATION "User data has been preserved at:$\n$\n$PROFILE\Documents\VideoAnalyzer"

  done:

  ; Note: We do NOT remove Tesseract-OCR or VC++ Redistributable
  ; as other applications may depend on them

  DetailPrint "Uninstallation complete."

!macroend
