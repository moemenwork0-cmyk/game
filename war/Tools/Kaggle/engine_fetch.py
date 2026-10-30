# Kaggle kernel (CPU, internet): downloads the Unreal Engine Linux build once, trims what we never
# use (debug symbols, templates, samples) and leaves it in /kaggle/working as split .tar.zst parts.
# Later kernels mount this kernel's output (kernel_sources) instead of downloading 20+ GB again.
from common import sh
import os, sys

URL = open("engine_url.txt").read().strip()
W = "/kaggle/working"

sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd aria2 unzip > /dev/null 2>&1; echo apt=$?")
sh("df -h /tmp /kaggle/working; nproc; free -g")
os.makedirs("/tmp/ue", exist_ok=True)
sh(f"cd /tmp && aria2c -q -x 8 -s 8 -o ue.zip '{URL}'; ls -la /tmp/ue.zip", check=True)
sh("cd /tmp/ue && unzip -q /tmp/ue.zip && rm /tmp/ue.zip && ls", check=True)
root = sh("dirname $(find /tmp/ue -maxdepth 3 -type d -name Engine | head -1)").strip().splitlines()[-1]
sh(f"du -sh {root}")
sh(f"cat {root}/Engine/Build/Build.version")
# Trim: the editor never needs debug symbols at runtime, and we start from our own project.
sh(f"cd {root} && find . \\( -name '*.debug' -o -name '*.sym' -o -name '*.pdb' \\) -delete; "
   f"rm -rf Templates Samples FeaturePacks Engine/Documentation Engine/Extras/Maya Engine/Extras/3dsMax; du -sh .")
sh(f"cd {root} && tar -cf - . | zstd -T0 -10 | split -b 3900M - {W}/ue.tar.zst.part-", check=True)
sh(f"ls -la {W}; du -sh {W}")
