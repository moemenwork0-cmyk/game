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
# Mixamo animations live in a private dataset (Adobe's terms forbid putting them in a public repo).
sh("mkdir -p /tmp/game/war/Content/Raw/Downloaded/Mixamo && "
   "cp $(find /kaggle/input -path '*desert-breach-animations*' \\( -name '*.fbx' -o -name '*.png' \\)) /tmp/game/war/Content/Raw/Downloaded/Mixamo/ && "
   "mkdir -p /tmp/game/war/Content/Raw/Downloaded/Audio && "
   "cp $(find /kaggle/input -path '*desert-breach-animations*' -name '*.wav') /tmp/game/war/Content/Raw/Downloaded/Audio/; "
   "ls /tmp/game/war/Content/Raw/Downloaded/Mixamo")
# Prepared sounds come from the dataset; fetch.py only downloads what is still missing.
sh("python3 /tmp/game/war/Tools/Assets/fetch.py 2>&1 | tail -3", check=True)
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
         ("wide", 3, "-nohud -nostory -captureview=-600,-2600,1100,-14,40"),
         ("bunker", 3, "-nohud -nostory -captureview=1700,-300,230,-3,8")]
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
_m = _re.search(r"SFX Explosion (\d+)", open(f"{W}/game_play.log", errors="ignore").read())
if _m:
    _b = int(_m.group(1))
    sh(f"for f in {' '.join(str(_b + d).zfill(5) for d in (2, 8, 15, 25, 40, 60))}; do "
       f"cp {W}/frames_play/frame_$f.png {W}/stills/blast_$f.png 2>/dev/null; done")
sh(f"for f in {' '.join(str(i).zfill(5) for i in range(60, FRAMES, 120))}; do "
   f"cp {W}/frames_play/frame_$f.png {W}/stills/play_$f.png 2>/dev/null; done; ls {W}/stills")
# Soundtrack rebuilt from the director's SFX log (the offline capture runs without audio): every
# sound at its frame, with the gain/pan the listener had, pitch, and the post-blast muffling.
import re, wave
import numpy as np
from scipy.signal import butter, sosfilt
AUD = "/tmp/game/war/Content/Raw/Downloaded/Audio"
SR = 48000
log = open(f"{W}/game_play.log", errors="ignore").read()
events = re.findall(r"SFX (\w+) (-?\d+) ([\d.]+) (-?[\d.]+) (\d) ([\d.]+)", log)
loops = re.findall(r"SFXLOOP (\w+) (-?\d+) ([\d.]+)", log)
muffles = [(int(f) / 30.0, int(on)) for f, on in re.findall(r"SFXMUFFLE (-?\d+) (\d)", log)]
dur = FRAMES / 30.0
N = int(dur * SR)
out = np.zeros((N, 2), np.float32)
cache = {}
LP = butter(4, 650, "lowpass", fs=SR, output="sos")


def load(name):
    if name not in cache:
        with wave.open(f"{AUD}/{name}.wav") as w:
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768.0
            x = x.reshape(-1, w.getnchannels())
            if w.getframerate() != SR:
                t = np.arange(0, len(x), w.getframerate() / SR)
                x = np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(x.shape[1])], 1)
        cache[name] = x if x.shape[1] == 2 else np.repeat(x, 2, 1)
    return cache[name]


def place(x, t, gain, pan=0.0, pitch=1.0, lp=False):
    if pitch != 1.0:
        idx = np.arange(0, len(x) - 1, pitch)
        x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1)
    if lp:
        x = sosfilt(LP, x, axis=0)
    a = (pan + 1.0) * np.pi / 4.0                     # equal-power pan, unity in the centre
    x = x * gain * np.array([np.cos(a), np.sin(a)]) * np.sqrt(2.0)
    i = int(t * SR)
    if i >= N:
        return
    n = min(len(x), N - i)
    out[i:i + n] += x[:n]


for name, frame, gain, pan, lp, pitch in events:
    try:
        place(load(name), max(0, int(frame)) / 30.0, float(gain), float(pan), float(pitch), lp == "1")
    except FileNotFoundError:
        print("missing sound", name, flush=True)
# Loops: wind for the whole piece (muffled while deafened), the heartbeat until the player is up.
for name, frame, vol in loops:
    try:
        x = load(name)
    except FileNotFoundError:
        continue
    t0 = max(0, int(frame)) / 30.0
    reps = int(np.ceil((dur - t0) * SR / len(x))) + 1
    y = np.tile(x, (reps, 1))[: N - int(t0 * SR)] * float(vol)
    if name == "Heartbeat":
        y[int(8.7 * SR):] = 0
        y[int(7.2 * SR):int(8.7 * SR)] *= np.linspace(1, 0, int(8.7 * SR) - int(7.2 * SR))[:, None]
    dull = sosfilt(LP, y, axis=0)
    mask = np.zeros(len(y), np.float32)
    state = 0
    edges = sorted(muffles)
    for k, (tm, on) in enumerate(edges):
        nxt = edges[k + 1][0] if k + 1 < len(edges) else dur
        if on:
            a0, a1 = int(max(0, tm - t0) * SR), int(max(0, nxt - t0) * SR)
            mask[a0:a1] = 1
    y = y * (1 - mask[:, None]) + dull * mask[:, None]
    out[int(t0 * SR):int(t0 * SR) + len(y)] += y
peak = np.abs(out).max() or 1.0
out = np.tanh(out / max(peak, 1.0) * 1.2) * 0.95      # soft limiting
with wave.open(f"{W}/soundtrack.wav", "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print(f"{len(events)} sound events, {len(loops)} loops", flush=True)
audio = f"-i {W}/soundtrack.wav -c:a aac -b:a 192k -shortest" if events else ""
sh(f"ffmpeg -y -loglevel error -framerate 30 -i {W}/frames_play/frame_%05d.png {audio} -c:v libx264 -pix_fmt yuv420p -crf 18 "
   f"{W}/breach.mp4 && rm -rf {W}/frames_*; ls -la {W}")
sh(f"grep -aE 'Director:|soldier|Soldier:|prop |audio:|Warning: .*(missing|Failed)' {W}/game_play.log {W}/map.log | head -40")
