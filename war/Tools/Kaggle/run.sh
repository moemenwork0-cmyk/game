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
# Kaggle uploads only the code file, so the shared helpers are prepended to it.
bundle() { { cat "$HERE/common.py"; grep -v '^from common import' "$1"; } > "$K/$(basename "$1")"; }
if [ "$KIND" = engine ]; then
  SLUG=war-engine; CODE=engine_fetch.py; GPU=false; SOURCES='[]'
  bundle "$HERE/engine_fetch.py"
  # The kernel (private) uploads the engine into a private dataset with the account's own token.
  python3 - "$K/engine_fetch.py" "$HERE/engine_url.txt" "$USER_NAME" <<'PY'
import os, sys
p, url, user = sys.argv[1:]
s = open(p).read().replace("__URL__", open(url).read().strip()).replace("__USER__", user)
s = s.replace("__TOKEN__", open(os.path.expanduser("~/.kaggle/access_token")).read().strip())
open(p, "w").write(s)
PY
else
  SLUG=war-render; CODE=render.py; GPU=true; SOURCES='[]'; DATA="[\"$USER_NAME/war-engine\"]"
  BRANCH=$(git -C "$HERE" rev-parse --abbrev-ref HEAD)
  bundle "$HERE/render.py"
  SF=${SKETCHFAB_API_TOKEN:-$(cat ~/.sketchfab_token 2>/dev/null || true)}
  sed -i -e "s|__SKETCHFAB__|$SF|" -e "s|__BRANCH__|$BRANCH|" -e "s|__FRAMES__|${3:-150}|" -e "s|__RES__|${4:-1920x1080}|" "$K/render.py"
fi
cat > "$K/kernel-metadata.json" <<JSON
{"id": "$USER_NAME/$SLUG", "title": "$SLUG", "code_file": "$CODE", "language": "python",
 "kernel_type": "script", "is_private": true, "enable_gpu": $GPU, "enable_internet": true,
 "dataset_sources": ${DATA:-[]}, "competition_sources": [], "kernel_sources": $SOURCES}
JSON
if [ "$GPU" = true ]; then kaggle kernels push -p "$K" --accelerator NvidiaTeslaT4; else kaggle kernels push -p "$K"; fi
until s=$(kaggle kernels status "$USER_NAME/$SLUG" 2>&1); echo "$s" | grep -qiE 'complete|error|cancel'; do sleep 30; done
echo "$s"
mkdir -p "$OUT"
kaggle kernels output "$USER_NAME/$SLUG" -p "$OUT" -o > /dev/null
ls -la "$OUT"
