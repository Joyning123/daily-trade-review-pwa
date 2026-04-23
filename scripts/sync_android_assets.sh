#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
WEB_ASSET_DIR="$ANDROID_DIR/app/src/main/assets/web"
ICON_SOURCE="$ROOT_DIR/icons/icon-512.png"

mkdir -p "$WEB_ASSET_DIR"

rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude 'android/' \
  --exclude 'README.md' \
  --exclude 'rules/' \
  --exclude 'scripts/' \
  --exclude 'templates/' \
  --exclude 'reviews/*.md' \
  --exclude 'vercel.json' \
  --exclude '.gitignore' \
  --exclude '.nojekyll' \
  "$ROOT_DIR/" "$WEB_ASSET_DIR/"

if command -v sips >/dev/null 2>&1; then
  for density in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
    name="${density%%:*}"
    size="${density##*:}"
    target_dir="$ANDROID_DIR/app/src/main/res/mipmap-$name"
    mkdir -p "$target_dir"
    sips -z "$size" "$size" "$ICON_SOURCE" --out "$target_dir/ic_launcher.png" >/dev/null
    cp "$target_dir/ic_launcher.png" "$target_dir/ic_launcher_round.png"
  done
else
  echo "sips not found; keeping existing Android launcher icons"
fi

echo "Android web assets synced to $WEB_ASSET_DIR"
