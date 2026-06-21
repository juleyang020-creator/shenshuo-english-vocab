#!/bin/zsh
# Build the React app and bundle a self-contained Windows zip:
#   申硕英语词汇学习-Windows.zip/
#     ├ 启动学习软件.bat          ← user double-clicks this
#     ├ server.ps1               ← TcpListener-based mini HTTP server
#     ├ 使用说明.txt              ← Chinese readme
#     └ web/                      ← the production-built React app
#         ├ index.html
#         ├ assets/
#         └ data/vocab.json
#
# Why this layout? On a stock Windows box (no Node.js, no Python) we can
# still serve the SPA with built-in PowerShell. The bat file just launches
# the .ps1; the .ps1 binds 127.0.0.1:5173, opens the browser, and waits.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/vocab-study-app"
SRC_DIR="$ROOT/tools/windows-package"
OUT_DIR="$ROOT/dist-windows"
STAGE="$OUT_DIR/申硕英语词汇学习"
ZIP_PATH="$ROOT/申硕英语词汇学习-Windows.zip"

echo "==> 1/4  build the production bundle"
cd "$APP_DIR"
rm -rf dist
npm run build 2>&1 | tail -5

echo "==> 2/4  prepare staging directory"
rm -rf "$OUT_DIR"
mkdir -p "$STAGE/web"
# Copy build, but skip the old tesseract backup (~2MB of useless OCR junk)
rsync -a --exclude 'vocab.tesseract-backup.json' "$APP_DIR/dist/" "$STAGE/web/"

echo "==> 3/4  copy launcher + readme + server"
# .bat / .txt: convert to CRLF, NO BOM (cmd.exe is fussy about BOMs in .bat).
for src in "启动学习软件.bat" "使用说明.txt"; do
    /usr/bin/awk 'BEGIN{ORS="\r\n"} {sub(/\r$/,""); print}' "$SRC_DIR/$src" \
        > "$STAGE/$src"
done

# server.ps1: convert to CRLF AND prepend a UTF-8 BOM (EF BB BF). Without the
# BOM, Windows PowerShell 5.x reads the file as the system ANSI codepage —
# CP936 on a Chinese Windows — which mis-decodes the Chinese strings and
# crashes the parser ("Missing closing '}' …"). The BOM makes PS treat the
# file as UTF-8 unambiguously and is invisible to PowerShell 7 / pwsh as well.
{
    printf '\xef\xbb\xbf'
    /usr/bin/awk 'BEGIN{ORS="\r\n"} {sub(/\r$/,""); print}' "$SRC_DIR/server.ps1"
} > "$STAGE/server.ps1"

echo "==> 4/4  zip (via python so UTF-8 filenames work on Windows Explorer)"
rm -f "$ZIP_PATH"
python3 - "$OUT_DIR" "$ZIP_PATH" <<'PY'
"""Create the release zip with the UTF-8 EFS flag set on all entries so
Chinese filenames render correctly in Windows Explorer / WinRAR / 7-Zip."""
import os
import sys
import zipfile

stage_root, out_zip = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for current_dir, sub_dirs, files in os.walk(stage_root):
        sub_dirs.sort()
        files.sort()
        for name in files:
            if name == '.DS_Store':
                continue
            full = os.path.join(current_dir, name)
            arc = os.path.relpath(full, stage_root)
            # Force EFS / UTF-8 language-encoding flag.
            info = zipfile.ZipInfo.from_file(full, arc)
            info.flag_bits |= 0x800
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(full, 'rb') as src:
                zf.writestr(info, src.read())
print('wrote', out_zip)
PY

cd "$ROOT"
echo
echo "Done."
echo "  staging:   $STAGE"
echo "  zip:       $ZIP_PATH ($(du -h "$ZIP_PATH" | awk '{print $1}'))"
echo
echo "Send the zip to your friend. Unzip + double-click 启动学习软件.bat."
