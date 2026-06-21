#!/bin/sh
# Rebuild the React/Vite app and copy the production bundle into ios/web/,
# which the iOS app serves over its custom URL scheme.
#
# Run this whenever the web app under vocab-study-app/ changes, then rebuild
# in Xcode (or with xcodebuild). The bundled web/ folder is what ships inside
# the .app — there is no network fetch at runtime.

set -eu

IOS_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$IOS_DIR/.." && pwd)"
APP_DIR="$ROOT/vocab-study-app"
WEB_DST="$IOS_DIR/web"

echo "==> building web app"
( cd "$APP_DIR" && npm run build )

echo "==> syncing dist -> ios/web"
mkdir -p "$WEB_DST"
# --delete keeps the bundle from accumulating stale hashed assets.
# Skip the 2MB tesseract OCR backup; it isn't used at runtime.
rsync -a --delete \
  --exclude 'vocab.tesseract-backup.json' \
  "$APP_DIR/dist/" "$WEB_DST/"

echo
echo "Done. ios/web now contains:"
ls -1 "$WEB_DST"
echo
echo "Next: open ios/ShenShuoVocab.xcodeproj in Xcode and press Run,"
echo "or run:  cd ios && xcodegen generate && open ShenShuoVocab.xcodeproj"
