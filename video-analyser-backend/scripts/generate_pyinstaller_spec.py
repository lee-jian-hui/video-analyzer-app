"""
Generates a PyInstaller spec file dynamically from requirements and project structure.
"""
import os
import sys
from PyInstaller.utils.hooks import collect_submodules

# Ensure base project directory (2 levels up from this script)
SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))
BASE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

# Main entrypoint of your backend (adjust if needed)
ENTRYPOINT = "server.py"

# Data directories to include in the build
DATA_DIRS = ["protos", "ml-models"]
DATAS = [
    (os.path.join(BASE_DIR, d), d)
    for d in DATA_DIRS
    if os.path.exists(os.path.join(BASE_DIR, d))
]

# Include .env if present
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    DATAS.append((env_path, "."))

# Dynamically collect hidden imports for common ML/AI packages
PACKAGES = [
    "torch",
    "transformers",
    "langchain",
    "langgraph",
    "openai_whisper",
    "ultralytics",
    "cv2",
]
hiddenimports = []
for pkg in PACKAGES:
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        pass

spec_content = f"""
# Auto-generated PyInstaller spec
# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None
project_dir = r"{BASE_DIR}"

a = Analysis(
    ["{ENTRYPOINT}"],
    pathex=[project_dir],
    binaries=[],
    datas={DATAS!r},
    hiddenimports={hiddenimports!r},
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="video_analyzer_backend",
    console=True,
    upx=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name="video_analyzer_backend",
)
"""

# Always write spec file to the project root (not /scripts/)
spec_path = os.path.join(BASE_DIR, "video_analyzer_backend.spec")

os.makedirs(BASE_DIR, exist_ok=True)
with open(spec_path, "w", encoding="utf-8") as f:
    f.write(spec_content)

# Safe print for Windows CP1252 terminals
try:
    print(f"✅ Spec file generated at {spec_path}")
except UnicodeEncodeError:
    print(f"Spec file generated at {spec_path}")_
