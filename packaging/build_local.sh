#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON:-python}"
cd "$ROOT_DIR"
"$PYTHON_BIN" -m PyInstaller --noconfirm --clean --onefile --name 3dmapgen --collect-data mapgen packaging/launcher_cli.py
"$PYTHON_BIN" -m PyInstaller --noconfirm --clean --onefile --name 3dmapgen-web --collect-data mapgen packaging/launcher_web.py
chmod +x dist/3dmapgen dist/3dmapgen-web 2>/dev/null || true
