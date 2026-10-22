# Runs on a Kaggle GPU machine (pushed by tools/kaggle/render.sh).
# Clones the game at a commit, imports it with Godot 4.7.2 and renders the slice
# viewpoints at full quality into /kaggle/working (downloaded afterwards).
import os, shutil, subprocess, sys, time

BRANCH = "__BRANCH__"
SHOTS = "__SHOTS__".split()
RES = "__RES__"
SUB = int("__SUB__")        # sub-frames per output frame (motion blur samples)
QUALITY = "__QUALITY__"
W = "/kaggle/working"
T0 = time.time()


def sh(c, check=False):
    print(f"[{time.time()-T0:6.0f}s] $ {c}", flush=True)
    r = subprocess.run(c, shell=True, capture_output=True, text=True)
    out = (r.stdout + r.stderr)[-4000:]
    print(out, flush=True)
    if check and r.returncode != 0:
        sys.exit(f"failed: {c}")
    return out


sh("nvidia-smi --query-gpu=name,memory.total --format=csv")
sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb libvulkan1 vulkan-tools mesa-vulkan-drivers > /dev/null 2>&1; echo apt=$?")
# NVIDIA's Vulkan driver lives in libGLX_nvidia (Kaggle keeps it in /usr/local/nvidia/lib64,
# outside the loader path, and ships no ICD file): register both.
nv = sh("find / -name 'libGLX_nvidia.so.0' 2>/dev/null | head -1").strip().splitlines()
nv = nv[-1] if nv else ""
if nv:
    libdir = os.path.dirname(nv)
    open("/etc/ld.so.conf.d/nvidia-kaggle.conf", "w").write(libdir + "\n")
    sh("ldconfig")
    os.environ["LD_LIBRARY_PATH"] = libdir + ":" + os.environ.get("LD_LIBRARY_PATH", "")
    os.makedirs("/usr/share/vulkan/icd.d", exist_ok=True)
    open("/usr/share/vulkan/icd.d/nvidia_icd.json", "w").write(
        '{"file_format_version":"1.0.1","ICD":{"library_path":"%s","api_version":"1.4.0"}}' % nv)
    os.environ["NVIDIA_DRIVER_CAPABILITIES"] = "all"
sh("ls /usr/local/nvidia/lib64 | head -60")
sh("vulkaninfo --summary 2>&1 | head -40")

os.chdir("/tmp")
sh("wget -q https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip && unzip -q -o Godot_v4.7.2-stable_linux.x86_64.zip && mv Godot_v4.7.2-stable_linux.x86_64 /usr/local/bin/godot", True)
sh("apt-get install -y -qq ffmpeg > /dev/null 2>&1; ffmpeg -version | head -1")
sh(f"git clone -q --depth 1 -b {BRANCH} https://github.com/moemenwork0-cmyk/game.git game", True)
os.chdir("/tmp/game")
sh("git log -1 --format='%h %s'")
sh("godot --headless --import > /tmp/import.log 2>&1; tail -2 /tmp/import.log")
sh("godot --headless --import > /tmp/import2.log 2>&1; true")
FPS = 24
PRE = 1.5
os.makedirs(f"{W}/clips", exist_ok=True)
for shot in SHOTS:
    fr = f"/tmp/frames_{shot}"
    os.makedirs(fr, exist_ok=True)
    t0 = time.time()
    sh(f"timeout 3000 xvfb-run -a -s '-screen 0 {RES}x24' godot --resolution {RES} --write-movie {fr}/f.png --fixed-fps {FPS * SUB} "
       f"res://scenes/trailer.tscn -- --shot={shot} --preroll={PRE} --quality={QUALITY} > {W}/{shot}.log 2>&1; echo exit=$?")
    n = len(os.listdir(fr))
    print(f"{shot}: {n} frames in {time.time()-t0:.0f}s", flush=True)
    # the shot's set may take frames to build (island, jungle): count back from the end
    import re
    m = re.search(r"duration=([0-9.]+)", open(f"{W}/{shot}.log", errors="ignore").read())
    dur = float(m.group(1)) if m else 0.0
    skip = max(int(PRE * FPS * SUB), n - int(dur * FPS * SUB) - 1) if dur else int(PRE * FPS * SUB)
    # sub-frame blend = motion blur with a ~180 degree shutter, then keep every SUB-th frame
    blend = max(1, SUB // 2 + (SUB % 2))
    sh(f"ffmpeg -y -loglevel error -framerate {FPS * SUB} -start_number {skip} -i {fr}/f%08d.png "
       f"-vf \"tmix=frames={blend},framestep={SUB},format=yuv420p\" -r {FPS} -c:v libx264 -preset slow -crf 14 {W}/clips/{shot}.mp4")
    sh(f"ffmpeg -y -loglevel error -i {W}/clips/{shot}.mp4 -vf 'select=eq(n\\,{int(FPS*0.3)})+eq(n\\,{int(FPS*1.5)})+eq(n\\,{int(FPS*2.8)}),tile=3x1,scale=1920:-1' -frames:v 1 {W}/clips/{shot}_sheet.jpg")
    sh(f"grep -aE 'SCRIPT ERROR|TRAILER' {W}/{shot}.log | head -5")
    shutil.rmtree(fr, ignore_errors=True)
sh(f"ls -la {W}/clips")
print(f"total {time.time()-T0:.0f}s")
