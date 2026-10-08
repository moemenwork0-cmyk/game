#!/usr/bin/env bash
# Renders slice screenshots on a free Kaggle GPU and downloads them.
#   tools/kaggle/render.sh <out_dir> [game args...]     e.g. --close --frames=90 --quality=3
# Needs the Kaggle CLI authenticated (~/.kaggle/access_token or KAGGLE_API_TOKEN).
set -euo pipefail
OUT=${1:?out dir}; shift
ARGS=${*:-"--close --frames=90 --quality=3"}
BRANCH=$(git -C "$(dirname "$0")/../.." rev-parse --abbrev-ref HEAD)
USER_NAME=$(kaggle config view 2>/dev/null | awk '/username/{print $3}')
RES=${RES:-1920x1080}
K=$(mktemp -d)
sed -e "s|__BRANCH__|$BRANCH|" -e "s|__ARGS__|$ARGS|" -e "s|__RES__|$RES|" "$(dirname "$0")/render.py" > "$K/render.py"
cat > "$K/kernel-metadata.json" <<JSON
{"id": "$USER_NAME/jazira-render", "title": "jazira-render", "code_file": "render.py", "language": "python",
 "kernel_type": "script", "is_private": true, "enable_gpu": true, "enable_internet": true,
 "dataset_sources": [], "competition_sources": [], "kernel_sources": []}
JSON
kaggle kernels push -p "$K"
until s=$(kaggle kernels status "$USER_NAME/jazira-render" 2>&1); echo "$s" | grep -qiE 'complete|error|cancel'; do sleep 20; done
echo "$s"
mkdir -p "$OUT"
kaggle kernels output "$USER_NAME/jazira-render" -p "$OUT" -o > /dev/null
ls -la "$OUT" "$OUT/shots" 2>/dev/null || true
