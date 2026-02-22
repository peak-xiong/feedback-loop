#!/usr/bin/env bash
set -euo pipefail

# Render an SVG icon to PNG for VSIX packaging.
# Usage:
#   ICON_SVG=images/icon.svg ICON_PNG=images/icon.png ICON_SIZE=256 bash scripts/render-icon.sh
# or:
#   bash scripts/render-icon.sh images/icon.svg images/icon.png 256

svg_path="${1:-${ICON_SVG:-images/icon.svg}}"
png_path="${2:-${ICON_PNG:-images/icon.png}}"
size="${3:-${ICON_SIZE:-256}}"

if [[ ! -f "$svg_path" ]]; then
  echo "[render-icon] SVG not found: $svg_path" >&2
  exit 1
fi

# Ensure output directory exists
out_dir="$(dirname "$png_path")"
mkdir -p "$out_dir"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "[render-icon] Missing rsvg-convert. Install librsvg: brew install librsvg" >&2
  exit 1
fi

rsvg-convert -w "$size" -h "$size" "$svg_path" -o "$png_path"
echo "[render-icon] Wrote $png_path (${size}x${size} px) via rsvg-convert"
