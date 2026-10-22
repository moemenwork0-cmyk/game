#!/usr/bin/env bash
# Renders trailer shots on a free Kaggle GPU into motion-blurred clips and downloads them.
#   tools/kaggle/render_video.sh <out_dir> "<shot> <shot> ..."   (env: RES, SUB, QUALITY)
# Needs the Kaggle CLI authenticated (~/.kaggle/access_token or KAGGLE_API_TOKEN).
set -euo pipefail
OUT=${1:?out dir}; shift
SHOTS=${1:?shots}; SUB=${SUB:-4}; QUALITY=${QUALITY:-3}
BRANCH=$(git -C "$(dirname "$0")/../.." rev-parse --abbrev-ref HEAD)
USER_NAME=$(kaggle config view 2>/dev/null | awk '/username/{print $3}')
RES=${RES:-1920x1080}
K=$(mktemp -d)
sed -e "s|__BRANCH__|$BRANCH|" -e "s|__SHOTS__|$SHOTS|" -e "s|__RES__|$RES|" -e "s|__SUB__|$SUB|" -e "s|__QUALITY__|$QUALITY|" "$(dirname "$0")/render_video.py" > "$K/render_video.py"
cat > "$K/kernel-metadata.json" <<JSON
{"id": "$USER_NAME/${KERNEL:-jazira-video}", "title": "${KERNEL:-jazira-video}", "code_file": "render_video.py", "language": "python",
 "kernel_type": "script", "is_private": true, "enable_gpu": true, "enable_internet": true,
 "dataset_sources": [], "competition_sources": [], "kernel_sources": []}
JSON
kaggle kernels push -p "$K"
until s=$(kaggle kernels status "$USER_NAME/${KERNEL:-jazira-video}" 2>&1); echo "$s" | grep -qiE 'complete|error|cancel'; do sleep 20; done
echo "$s"
mkdir -p "$OUT"
kaggle kernels output "$USER_NAME/${KERNEL:-jazira-video}" -p "$OUT" -o > /dev/null
ls -la "$OUT/clips" 2>/dev/null || true
