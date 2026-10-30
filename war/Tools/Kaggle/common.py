# Shared helpers for the Kaggle kernels (copied next to each kernel script by run.sh).
import os, subprocess, sys, time

T0 = time.time()


def sh(c, check=False, tail=4000):
    print(f"[{time.time()-T0:6.0f}s] $ {c}", flush=True)
    r = subprocess.run(c, shell=True, executable="/bin/bash", capture_output=True, text=True)
    out = (r.stdout + r.stderr)[-tail:]
    print(out, flush=True)
    if check and r.returncode != 0:
        sys.exit(f"failed ({r.returncode}): {c}")
    return out


def setup_vulkan():
    """Kaggle keeps NVIDIA's Vulkan driver outside the loader path and ships no ICD file."""
    sh("apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libvulkan1 vulkan-tools zstd ffmpeg > /dev/null 2>&1; echo apt=$?")
    nv = sh("find / -name 'libGLX_nvidia.so.0' 2>/dev/null | head -1").strip().splitlines()
    nv = nv[-1] if nv else ""
    if not nv:
        print("no NVIDIA driver found: is the GPU accelerator on?", flush=True)
        return False
    libdir = os.path.dirname(nv)
    open("/etc/ld.so.conf.d/nvidia-kaggle.conf", "w").write(libdir + "\n")
    sh("ldconfig")
    os.environ["LD_LIBRARY_PATH"] = libdir + ":" + os.environ.get("LD_LIBRARY_PATH", "")
    os.makedirs("/usr/share/vulkan/icd.d", exist_ok=True)
    open("/usr/share/vulkan/icd.d/nvidia_icd.json", "w").write(
        '{"file_format_version":"1.0.1","ICD":{"library_path":"%s","api_version":"1.4.0"}}' % nv)
    os.environ["NVIDIA_DRIVER_CAPABILITIES"] = "all"
    sh("vulkaninfo --summary 2>&1 | grep -E 'deviceName|apiVersion' | head -4")
    return True
