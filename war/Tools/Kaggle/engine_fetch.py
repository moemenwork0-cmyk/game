# Kaggle kernel (CPU, internet): downloads the Unreal Engine Linux build once, trims what we never
# use (debug symbols, templates, samples) and leaves it in /kaggle/working as split .tar.zst parts.
# Later kernels mount this kernel's output (kernel_sources) instead of downloading 20+ GB again.
from common import sh
import os, sys

URL = "__URL__"
USER = "__USER__"
TOKEN = "__TOKEN__"
W = "/kaggle/working"

sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd aria2 unzip > /dev/null 2>&1; echo apt=$?")
sh("df -h /tmp /kaggle/working; nproc; free -g")
os.makedirs("/tmp/ue", exist_ok=True)
# The link is signed for one hour: open every range request up front (16 big segments).
sh(f"cd /tmp && aria2c -q -x 16 -s 16 --min-split-size=1024M --max-tries=5 -o ue.zip '{URL}'; ls -la /tmp/ue.zip", check=True)
sh("cd /tmp/ue && unzip -q /tmp/ue.zip && rm /tmp/ue.zip && ls", check=True)
root = sh("dirname $(find /tmp/ue -maxdepth 3 -type d -name Engine | head -1)").strip().splitlines()[-1]
sh(f"du -sh {root}; du -h --max-depth=3 {root} | sort -rh | head -40")
sh(f"cat {root}/Engine/Build/Build.version")
# Trim: the editor never needs debug symbols at runtime, and we start from our own project.
sh(f"cd {root} && find . \\( -name '*.debug' -o -name '*.sym' -o -name '*.pdb' \\) -delete; "
   f"rm -rf Templates Samples FeaturePacks Engine/Documentation Engine/Extras/Maya Engine/Extras/3dsMax; du -sh .")
# Parts go into a private dataset (the kernel output is capped at 20 GB).
D = "/tmp/ds"
os.makedirs(D, exist_ok=True)
sh(f"cd {root} && tar -cf - . | zstd -T0 -6 | split -b 3900M - {D}/ue.tar.zst.part-", check=True)
sh(f"ls -la {D}; du -sh {D}")
open(f"{D}/dataset-metadata.json", "w").write(
    '{"title": "war-engine", "id": "%s/war-engine", "licenses": [{"name": "other"}]}' % USER)
os.makedirs(os.path.expanduser("~/.kaggle"), exist_ok=True)
open(os.path.expanduser("~/.kaggle/access_token"), "w").write(TOKEN)
sh("pip install -q -U kaggle 2>&1 | tail -1; kaggle --version")
sh(f"kaggle datasets create -p {D} -q -r skip 2>&1 | tail -5")
sh(f"kaggle datasets status {USER}/war-engine")
