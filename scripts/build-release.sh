#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(python3 -c 'import json, pathlib; print(json.loads(pathlib.Path("'"$EXTENSION_DIR"'", "manifest.json").read_text())["version"])')"
ZIP_NAME="binance-square-workflow-v${VERSION}.zip"

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/$ZIP_NAME"

(
  cd "$EXTENSION_DIR"
  zip -FS -q "$DIST_DIR/$ZIP_NAME" \
    background.js \
    content-binance.js \
    content-x.js \
    demo-checkout.js \
    formatter.html \
    formatter.js \
    manifest.json \
    popup.html \
    popup.js \
    styles.css
)

unzip -t "$DIST_DIR/$ZIP_NAME" >/dev/null
printf '%s\n' "$DIST_DIR/$ZIP_NAME"
