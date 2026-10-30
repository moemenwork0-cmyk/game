# Kaggle kernel (CPU, internet): downloads the Unreal Engine Linux build once, trims what we never
# use (debug symbols, templates, samples) and leaves it in /kaggle/working as split .tar.zst parts.
# Later kernels mount this kernel's output (kernel_sources) instead of downloading 20+ GB again.
from common import sh
import os, sys

URL = "__URL__"
USER = "__USER__"
TOKEN = "__TOKEN__"
W = "/kaggle/working"

sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd libarchive-tools > /dev/null 2>&1; echo apt=$?")
sh("df -h /tmp /kaggle/working; nproc; free -g")
# The disk (~70 GB) cannot hold the 40 GB zip and its contents: stream the zip straight into a
# trimmed tar.zst (bsdtar reads zip entries from the pipe), never storing it. The signed link is
# only checked when the single request starts.
D = "/tmp/ds"
os.makedirs(D, exist_ok=True)
EXCL = " ".join(f"--exclude '{x}'" for x in ["*.debug", "*.sym", "*.pdb", "*/Templates/*", "*/Samples/*",
                                             "*/FeaturePacks/*", "*/Engine/Documentation/*"])
sh(f"set -o pipefail; curl -sS --fail --retry 0 '{URL}' | bsdtar -cf - --format=pax {EXCL} @- "
   f"| zstd -T0 -6 | split -b 3900M - {D}/ue.tar.zst.part-; echo pipe=$?", check=True)
sh(f"ls -la {D}; du -sh {D}")
sh(f"cat {D}/ue.tar.zst.part-* | zstd -dc | tar -tf - | head -20")
# Parts go into a private dataset (the kernel output is capped at 20 GB).
open(f"{D}/dataset-metadata.json", "w").write(
    '{"title": "war-engine", "id": "%s/war-engine", "licenses": [{"name": "other"}]}' % USER)
os.makedirs(os.path.expanduser("~/.kaggle"), exist_ok=True)
open(os.path.expanduser("~/.kaggle/access_token"), "w").write(TOKEN)
sh("pip install -q -U kaggle 2>&1 | tail -1; kaggle --version")
sh(f"kaggle datasets create -p {D} -q -r skip 2>&1 | tail -5")
sh(f"kaggle datasets status {USER}/war-engine")
