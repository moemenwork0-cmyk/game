# Kaggle kernel (GPU T4): unpacks the engine from the war-engine kernel output, builds the game,
# builds the Breach map from code and records frames from the game camera into /kaggle/working.
from common import sh, setup_vulkan
import glob, os, sys

BRANCH = "__BRANCH__"
FRAMES = int("__FRAMES__")
RES = "__RES__"
W = "/kaggle/working"
UE = "/tmp/ue"

sh("nvidia-smi --query-gpu=name,memory.total --format=csv")
gpu = setup_vulkan()
parts = sorted(glob.glob("/kaggle/input/**/ue.tar.zst.part-*", recursive=True))
if not parts:
    sys.exit("engine parts missing: run engine_fetch first and attach its output")
os.makedirs(UE, exist_ok=True)
sh(f"cat {' '.join(parts)} | zstd -d -T0 | tar -xf - -C {UE}; du -sh {UE}; df -h /tmp", check=True)
# The zip-to-tar conversion drops execute bits: restore them on scripts and binaries.
sh(f"find {UE} -type f \\( -name '*.sh' -o -name '*.command' -o -path '*/Binaries/*' -o -path '*/ThirdParty*/bin/*' "
   f"-o -path '*/SDKs/HostLinux/*/bin/*' -o -name 'dotnet' \\) -exec chmod +x {{}} +; "
   f"ls -la {UE}/Engine/Build/BatchFiles/Linux/Build.sh {UE}/Engine/Binaries/Linux/UnrealEditor; mount | grep -E ' /tmp | / ' | head -3")
sh(f"git clone -q --depth 1 -b {BRANCH} https://github.com/moemenwork0-cmyk/game.git /tmp/game", check=True)
P = "/tmp/game/war/WarGame.uproject"
os.environ["SKETCHFAB_API_TOKEN"] = "__SKETCHFAB__"
sh("python3 /tmp/game/war/Tools/Assets/fetch.py 2>&1 | tail -3", check=True)
# Mixamo animations live in a private dataset (Adobe's terms forbid putting them in a public repo).
sh("mkdir -p /tmp/game/war/Content/Raw/Downloaded/Mixamo && "
   "cp $(find /kaggle/input -path '*desert-breach-animations*' -name '*.fbx') /tmp/game/war/Content/Raw/Downloaded/Mixamo/; "
   "ls /tmp/game/war/Content/Raw/Downloaded/Mixamo")
# The engine refuses to run as root.
sh("useradd -m ue 2>/dev/null; chown -R ue /tmp/ue /tmp/game " + W)
U = f"runuser -u ue -- env LD_LIBRARY_PATH={os.environ.get('LD_LIBRARY_PATH', '')} HOME=/home/ue"
sh(f"{U} {UE}/Engine/Build/BatchFiles/Linux/Build.sh WarGameEditor Linux Development -project={P} -waitmutex > {W}/build.log 2>&1; echo build=$?; tail -30 {W}/build.log")
sh(f"{U} {UE}/Engine/Binaries/Linux/UnrealEditor-Cmd {P} -run=pythonscript -script=/tmp/game/war/Tools/Editor/build_breach.py "
   f"-unattended -nosplash -nullrhi > {W}/map.log 2>&1; echo map=$?; grep -aE 'Error|build_breach|imported' {W}/map.log | tail -30")
if not gpu:
    sys.exit("no GPU: the map is built but cannot be rendered")
x, y = RES.split("x")
os.makedirs(f"{W}/frames", exist_ok=True)
sh(f"chown ue {W}/frames")
sh(f"timeout 14000 {U} {UE}/Engine/Binaries/Linux/UnrealEditor {P} /Game/Maps/Breach -game -RenderOffscreen -unattended -nosound "
   f"-ResX={x} -ResY={y} -windowed -benchmark -fps=30 -capture={W}/frames -captureframes={FRAMES} "
   f"> {W}/game.log 2>&1; echo game=$?; grep -aE 'Error|Fatal|Vulkan|RHI' {W}/game.log | tail -30")
sh(f"ls {W}/frames | wc -l")
# A few stills for review next to the video.
sh(f"mkdir -p {W}/stills && for f in 00000 00060 00120; do cp {W}/frames/frame_$f.png {W}/stills/ 2>/dev/null; done; ls {W}/stills")
sh(f"ffmpeg -y -loglevel error -framerate 30 -i {W}/frames/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 {W}/breach.mp4 && rm -rf {W}/frames; ls -la {W}")
