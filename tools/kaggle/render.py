# Runs on a Kaggle GPU machine (pushed by tools/kaggle/render.sh).
# Clones the game at a commit, imports it with Godot 4.7.2 and renders the slice
# viewpoints at full quality into /kaggle/working (downloaded afterwards).
import os, subprocess, sys, time

BRANCH = "__BRANCH__"
ARGS = "__ARGS__"
RES = "__RES__"
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
# NVIDIA's Vulkan driver lives in libGLX_nvidia; register it if the container lacks the ICD file
icd = "/usr/share/vulkan/icd.d/nvidia_icd.json"
if not os.path.exists(icd) and not os.path.exists("/etc/vulkan/icd.d/nvidia_icd.json"):
    lib = sh("ldconfig -p | grep -o '/.*libGLX_nvidia.so.0' | head -1").strip().splitlines()
    lib = lib[-1] if lib else "libGLX_nvidia.so.0"
    os.makedirs(os.path.dirname(icd), exist_ok=True)
    open(icd, "w").write('{"file_format_version":"1.0.0","ICD":{"library_path":"%s","api_version":"1.3.0"}}' % lib)
sh("vulkaninfo --summary 2>&1 | grep -E 'deviceName|driverName|apiVersion' | head")

os.chdir("/tmp")
sh("wget -q https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip && unzip -q -o Godot_v4.7.2-stable_linux.x86_64.zip && mv Godot_v4.7.2-stable_linux.x86_64 /usr/local/bin/godot", True)
sh(f"git clone -q --depth 1 -b {BRANCH} https://github.com/moemenwork0-cmyk/game.git game", True)
os.chdir("/tmp/game")
sh("git log -1 --format='%h %s'")
sh("godot --headless --import > /tmp/import.log 2>&1; tail -3 /tmp/import.log")
sh("godot --headless --import > /tmp/import2.log 2>&1; grep -c ERROR /tmp/import2.log")
shots = f"{W}/shots"
os.makedirs(shots, exist_ok=True)
log = sh(f"timeout 2400 xvfb-run -a -s '-screen 0 {RES}x24' godot --resolution {RES} res://scenes/slice.tscn -- --shots={shots} {ARGS} > {W}/render.log 2>&1; echo exit=$?")
sh(f"grep -aE 'Vulkan|Device|SCRIPT ERROR|crash|^shot|terrain:' {W}/render.log | head -30")
sh(f"ls -la {shots}")
print(f"total {time.time()-T0:.0f}s")
