# Kaggle kernel (CPU, internet): downloads the Unreal Engine Linux build once, trims what we never
# use (debug symbols, templates, samples) and stores it as split .tar.zst parts in a private
# dataset that the render kernels mount, so the 40 GB zip is downloaded only once.
from common import sh
import os, sys

URL = "__URL__"
USER = "__USER__"
TOKEN = "__TOKEN__"
W = "/kaggle/working"

sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq zstd > /dev/null 2>&1; echo apt=$?")
sh("df -h /tmp /kaggle/working; nproc; free -g")
# One request (the signed link is only checked when it starts). Streaming the zip through bsdtar
# silently dropped entries, so the zip is stored whole and re-packed from its central directory.
sh(f"curl -sS --fail -o /tmp/ue.zip '{URL}'; ls -la /tmp/ue.zip", check=True)

import stat, subprocess, tarfile, zipfile
D = "/tmp/ds"
os.makedirs(D, exist_ok=True)
SKIP_EXT = (".debug", ".sym", ".pdb")
SKIP_DIR = ("Templates/", "Samples/", "FeaturePacks/", "Engine/Documentation/")
pack = subprocess.Popen(f"zstd -T0 -6 | split -b 3900M - {D}/ue.tar.zst.part-", shell=True,
                        executable="/bin/bash", stdin=subprocess.PIPE)
kept = skipped = 0
with zipfile.ZipFile("/tmp/ue.zip") as zf, tarfile.open(fileobj=pack.stdin, mode="w|", format=tarfile.PAX_FORMAT) as tf:
    for zi in zf.infolist():
        name = zi.filename
        if zi.is_dir() or name.endswith(SKIP_EXT) or name.startswith(SKIP_DIR):
            skipped += 1
            continue
        mode = (zi.external_attr >> 16) & 0xFFFF
        ti = tarfile.TarInfo(name)
        ti.mtime = 1700000000
        if stat.S_ISLNK(mode):
            ti.type = tarfile.SYMTYPE
            ti.linkname = zf.read(zi).decode()
            tf.addfile(ti)
        else:
            ti.size = zi.file_size
            ti.mode = stat.S_IMODE(mode) or 0o644
            with zf.open(zi) as f:
                tf.addfile(ti, f)
        kept += 1
pack.stdin.close()
pack.wait()
print(f"kept {kept} files, skipped {skipped}", flush=True)
sh("rm -f /tmp/ue.zip")
sh(f"ls -la {D}; du -sh {D}")
# Parts go into a private dataset (the kernel output is capped at 20 GB).
open(f"{D}/dataset-metadata.json", "w").write(
    '{"title": "unreal-engine-linux", "id": "%s/unreal-engine-linux", "licenses": [{"name": "other"}]}' % USER)
os.makedirs(os.path.expanduser("~/.kaggle"), exist_ok=True)
open(os.path.expanduser("~/.kaggle/access_token"), "w").write(TOKEN)
sh("pip install -q -U kaggle 2>&1 | tail -1; kaggle --version")
out = sh(f"kaggle datasets create -p {D} -q -r skip 2>&1 | tail -5")
if "already" in out.lower():
    out = sh(f"kaggle datasets version -p {D} -q -r skip -m 'engine repack' 2>&1 | tail -5")
if "error" in out.lower():
    # Never lose a 40 GB download to an upload problem: keep the parts as this kernel's output
    # (20 GB cap) as far as they fit, and fail loudly.
    sh(f"cp {D}/ue.tar.zst.part-a[a-d] {W}/ 2>/dev/null; ls -la {W}")
    sys.exit("dataset upload failed")
sh(f"kaggle datasets status {USER}/unreal-engine-linux")
