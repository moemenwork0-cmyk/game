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
   "cp $(find /kaggle/input -path '*desert-breach-animations*' \\( -name '*.fbx' -o -name '*.png' \\)) /tmp/game/war/Content/Raw/Downloaded/Mixamo/; "
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
GAME = (f"timeout 14000 {U} {UE}/Engine/Binaries/Linux/UnrealEditor {P} /Game/Maps/Breach -game -RenderOffscreen "
        f"-unattended -nosound -ResX={x} -ResY={y} -windowed -benchmark -fps=30")
# The gameplay view (with the touch HUD) becomes the video; fixed review cameras give stills.
# Views: name, frames, extra args (x,y,z,pitch,yaw in cm/degrees).
VIEWS = [("play", FRAMES, "-autodetonate"),
         ("wide", 3, "-nohud -nostory -captureview=-1800,-2600,1100,-14,40"),
         ("bunker", 3, "-nohud -nostory -captureview=1300,-500,230,-3,12")]
os.makedirs(f"{W}/stills", exist_ok=True)
for name, n, extra in VIEWS:
    d = f"{W}/frames_{name}"
    os.makedirs(d, exist_ok=True)
    sh(f"chown ue {d}")
    sh(f"{GAME} -capture={d} -captureframes={n} {extra} > {W}/game_{name}.log 2>&1; echo {name}=$?; "
       f"grep -aE 'Fatal|Capture:' {W}/game_{name}.log | tail -5; ls {d} | wc -l")
    sh(f"cp $(ls {d}/*.png | tail -1) {W}/stills/{name}.png 2>/dev/null")
# Story beats for review, plus frames right after the blast (frame from the SFX log).
import re as _re
_m = _re.search(r"SFX ExplosionPunch (\d+)", open(f"{W}/game_play.log", errors="ignore").read())
if _m:
    _b = int(_m.group(1))
    sh(f"for f in {' '.join(str(_b + d).zfill(5) for d in (2, 8, 15, 25, 40, 60))}; do "
       f"cp {W}/frames_play/frame_$f.png {W}/stills/blast_$f.png 2>/dev/null; done")
sh(f"for f in {' '.join(str(i).zfill(5) for i in range(60, FRAMES, 120))}; do "
   f"cp {W}/frames_play/frame_$f.png {W}/stills/play_$f.png 2>/dev/null; done; ls {W}/stills")
# Soundtrack rebuilt from the director's SFX log (the offline capture runs without audio).
import re
AUD = "/tmp/game/war/Content/Raw/Downloaded/Audio"
events = re.findall(r"(SFX|SFXLOOP) (\w+) (-?\d+) ([\d.]+)", open(f"{W}/game_play.log", errors="ignore").read())
dur = FRAMES / 30.0
inputs, chains = [], []
for i, (kind, name, frame, vol) in enumerate(events):
    t = max(0, int(frame)) / 30.0
    loop = "-stream_loop -1 " if kind == "SFXLOOP" else ""
    inputs.append(f"{loop}-i {AUD}/{name}.wav")
    chains.append(f"[{i}:a]atrim=0:{dur - t:.2f},adelay={int(t * 1000)}|{int(t * 1000)},volume={vol}[a{i}]")
if events:
    mix = "".join(f"[a{i}]" for i in range(len(events)))
    graph = ";".join(chains) + f";{mix}amix=inputs={len(events)}:normalize=0,alimiter=limit=0.95[out]"
    sh(f"ffmpeg -y -loglevel error {' '.join(inputs)} -filter_complex \"{graph}\" -map [out] -t {dur:.2f} {W}/soundtrack.wav; ls -la {W}/soundtrack.wav")
print(f"{len(events)} sound events", flush=True)
audio = f"-i {W}/soundtrack.wav -c:a aac -b:a 192k -shortest" if events else ""
sh(f"ffmpeg -y -loglevel error -framerate 30 -i {W}/frames_play/frame_%05d.png {audio} -c:v libx264 -pix_fmt yuv420p -crf 18 "
   f"{W}/breach.mp4 && rm -rf {W}/frames_*; ls -la {W}")
sh(f"grep -aE 'Director:|soldier|Soldier:|prop |audio:|Warning: .*(missing|Failed)' {W}/game_play.log {W}/map.log | head -40")
