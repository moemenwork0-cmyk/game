#!/usr/bin/env bash
# Pushes a Kaggle kernel, waits for it and downloads its output.
#   Tools/Kaggle/run.sh engine <out_dir>                 (needs Tools/Kaggle/engine_url.txt, not committed)
#   Tools/Kaggle/run.sh render <out_dir> [frames] [WxH]
# Needs the Kaggle CLI authenticated (~/.kaggle/access_token or KAGGLE_API_TOKEN).
set -euo pipefail
KIND=${1:?engine|render}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
USER_NAME=$(kaggle config view 2>/dev/null | awk '/username/{print $3}')
K=$(mktemp -d)
cp "$HERE/common.py" "$K/"
if [ "$KIND" = engine ]; then
  SLUG=war-engine; CODE=engine_fetch.py; GPU=false; SOURCES='[]'
  cp "$HERE/engine_fetch.py" "$HERE/engine_url.txt" "$K/"
else
  SLUG=war-render; CODE=render.py; GPU=true; SOURCES="[\"$USER_NAME/war-engine\"]"
  BRANCH=$(git -C "$HERE" rev-parse --abbrev-ref HEAD)
  sed -e "s|__BRANCH__|$BRANCH|" -e "s|__FRAMES__|${3:-150}|" -e "s|__RES__|${4:-1920x1080}|" "$HERE/render.py" > "$K/render.py"
fi
cat > "$K/kernel-metadata.json" <<JSON
{"id": "$USER_NAME/$SLUG", "title": "$SLUG", "code_file": "$CODE", "language": "python",
 "kernel_type": "script", "is_private": true, "enable_gpu": $GPU, "enable_internet": true,
 "dataset_sources": [], "competition_sources": [], "kernel_sources": $SOURCES}
JSON
if [ "$GPU" = true ]; then kaggle kernels push -p "$K" --accelerator NvidiaTeslaT4; else kaggle kernels push -p "$K"; fi
until s=$(kaggle kernels status "$USER_NAME/$SLUG" 2>&1); echo "$s" | grep -qiE 'complete|error|cancel'; do sleep 30; done
echo "$s"
mkdir -p "$OUT"
kaggle kernels output "$USER_NAME/$SLUG" -p "$OUT" -o > /dev/null
ls -la "$OUT"
