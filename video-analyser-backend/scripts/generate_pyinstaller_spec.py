"""
Generates a PyInstaller spec file dynamically from requirements and project structure.
"""
import os
from PyInstaller.utils.hooks import collect_submodules

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Main entrypoint of your backend (change if needed)
ENTRYPOINT = "server.py"

# Directories/files to include
DATA_DIRS = ["protos", "ml-models"]
DATAS = [
    (os.path.join(BASE_DIR, d), d)
    for d in DATA_DIRS
    if os.path.exists(os.path.join(BASE_DIR, d))
]
if os.path.exists(os.path.join(BASE_DIR, ".env")):
    DATAS.append((os.path.join(BASE_DIR, ".env"), "."))

# Collect hidden imports dynamically
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

spec_path = os.path.join(BASE_DIR, "video_analyzer_backend.spec")
with open(spec_path, "w", encoding="utf-8") as f:
    f.write(spec_content)
print(f"Spec file generated at {spec_path}")
