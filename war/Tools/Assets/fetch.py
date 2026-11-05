# Downloads the free ready-made assets the Breach scene uses into Content/Raw/Downloaded.
# Poly Haven and Unity Labs need no account; the Sketchfab models need SKETCHFAB_API_TOKEN
# (or ~/.sketchfab_token). Run it on the build machine.
#   python3 Tools/Assets/fetch.py [dest]
import json, os, re, subprocess, sys, urllib.parse, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..", "Content", "Raw", "Downloaded")

# Poly Haven (CC0): cliffs for the mountain and the tunnel mouth, boulders, desert ground, sky.
POLYHAVEN_MODELS = ["namaqualand_cliff_01", "namaqualand_cliff_02", "namaqualand_boulder_02",
                    "namaqualand_boulder_04", "mountainside", "rock_face_01", "sand_rocks_small_01",
                    "ammo_box", "wooden_military_crate"]
POLYHAVEN_TEXTURES = ["aerial_sand", "gravelly_sand", "dry_ground_rocks", "cliff_side"]
POLYHAVEN_HDRIS = ["goegap"]
# Unity Labs VFX flipbooks (CC0, Houdini renders): the breach explosion, fireball, smoke and dust.
UNITY_VFX = ["Explosion00", "Explosion01", "Explosion02HD", "FireBall02", "WispySmoke02", "DiscSmoke01", "Cloud02"]
# Sketchfab (CC-BY, credited in CREDITS.md): name -> (uid, format). "gltf" keeps full-res textures.
SKETCHFAB = {
    "Bunker": ("e8d5052a3a8e46c3a7eecd89d01cac7f", "gltf"),     # Old Concrete Bunker PBR Scan, Pers Scans
    "C4": ("617d754683114b6a8244ececbd03365e", "glb"),          # C4 Explosive, _Vadim2020_
    "Detonator": ("3c8b9fe3d79a428cb70c8b1be27f1d04", "glb"),   # Detonator, BRAIN_ZIP
    "SoldierKSK": ("110daf3d1884412989e41dc95866c579", "glb"),  # German KSK operator - rigged, 42manako
}
# Sounds: hand-picked from the Sonniss GDC Game Audio Bundles (royalty-free, commercial use, no
# attribution required), fetched file by file from their archive.org mirrors; see sounds.json.
SOUNDS = json.load(open(os.path.join(HERE, "sounds.json")))
OGA = "https://opengameart.org/sites/default/files/"
RES = "2k"


def api(url):
    req = urllib.request.Request(url, headers={"User-Agent": "desert-breach-fetch"})
    return json.load(urllib.request.urlopen(req))


def get(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "desert-breach-fetch"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as r, open(path + ".part", "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            break
        except Exception as e:  # archive.org answers 5xx now and then
            print(f"retry {attempt + 1} {os.path.basename(path)}: {e}", flush=True)
            __import__("time").sleep(5 * (attempt + 1))
    else:
        raise RuntimeError(f"could not download {url}")
    os.replace(path + ".part", path)
    print("got", os.path.relpath(path, DEST), flush=True)


def polyhaven(asset, kind, fmt):
    files = api(f"https://api.polyhaven.com/files/{asset}")
    out = os.path.join(DEST, "PolyHaven", kind, asset)
    if kind == "HDRI":
        get(files["hdri"][RES]["hdr"]["url"], os.path.join(out, f"{asset}_{RES}.hdr"))
        return
    if kind == "Textures":
        for m in ["Diffuse", "nor_gl", "arm"]:
            get(files[m][RES]["jpg"]["url"], os.path.join(out, f"{asset}_{m}_{RES}.jpg"))
        return
    entry = files[fmt][RES][fmt]
    get(entry["url"], os.path.join(out, os.path.basename(entry["url"])))
    for rel, inc in entry.get("include", {}).items():
        get(inc["url"], os.path.join(out, rel))


def sketchfab(name, uid, fmt):
    token = os.environ.get("SKETCHFAB_API_TOKEN") or ""
    path = os.path.expanduser("~/.sketchfab_token")
    if not token and os.path.exists(path):
        token = open(path).read().strip()
    if not token:
        print(f"skip {name}: no SKETCHFAB_API_TOKEN", flush=True)
        return
    out = os.path.join(DEST, "Sketchfab", name)
    req = urllib.request.Request(f"https://api.sketchfab.com/v3/models/{uid}/download",
                                 headers={"Authorization": f"Token {token}", "User-Agent": "desert-breach-fetch"})
    url = json.load(urllib.request.urlopen(req))[fmt]["url"]
    if fmt == "glb":
        get(url, os.path.join(out, f"{name}.glb"))
    else:
        z = os.path.join(out, f"{name}.zip")
        get(url, z)
        with zipfile.ZipFile(z) as zf:
            zf.extractall(out)


def sounds():
    """Download, trim, peak-normalise and resample every game sound; footsteps get pitch variants."""
    out = os.path.join(DEST, "Audio")
    os.makedirs(out, exist_ok=True)
    for name, spec in SOUNDS.items():
        if os.path.exists(os.path.join(out, name + ".wav")):
            continue  # prepared copy (e.g. from the private dataset)
        src = os.path.join(out, "src_" + name + ".wav")
        get("https://archive.org/download/%s/%s" % (spec["item"], urllib.parse.quote(spec["path"])), src)
        chain = [f for f in [spec.get("filter", "")] if f]
        chain.append("aresample=48000")
        if spec["channels"] == "mono":
            chain.append("pan=mono|c0=0.5*c0+0.5*c1" if probe_channels(src) > 1 else "anull")
        filt = ",".join(chain)
        gain = peak_gain(src, filt, spec["peak_db"])
        os.system(f"ffmpeg -y -loglevel error -i '{src}' -af '{filt},volume={gain}dB' -c:a pcm_s16le '{os.path.join(out, name)}.wav'")
        if spec.get("loop"):
            seamless(os.path.join(out, name) + ".wav")
    # Six footstep variations per surface sample: small pitch/speed shifts, as boots never sound twice the same.
    for base in ("StepA", "StepB", "StepC", "StepD"):
        for i, k in enumerate((0.94, 1.06)):
            os.system(f"ffmpeg -y -loglevel error -i '{os.path.join(out, base)}.wav' -af 'asetrate=48000*{k},aresample=48000' "
                      f"'{os.path.join(out, base)}{i}.wav'")
    # Ear ringing: two close high tones beating against each other over a thin noise band, fading out.
    os.system(f"ffmpeg -y -loglevel error -f lavfi -i 'sine=f=7650:d=9' -f lavfi -i 'sine=f=7890:d=9' "
              f"-f lavfi -i 'anoisesrc=d=9:c=pink:a=0.05' -filter_complex "
              f"'[2]highpass=f=5000,lowpass=f=9000[n];[0][1][n]amix=inputs=3:normalize=0,"
              f"afade=t=in:d=0.04,afade=t=out:st=1.2:d=7.5,volume=1.1' -ar 48000 -ac 2 '{os.path.join(out, 'Tinnitus')}.wav'")


def seamless(path, fade=4.0):
    """Loop without a seam: the last `fade` seconds are cross-faded (equal power) into the start."""
    import wave
    import numpy as np
    with wave.open(path) as w:
        p = w.getparams()
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, p.nchannels)
    n = int(fade * p.framerate)
    body, tail = x[:-n].copy(), x[-n:]
    t = np.linspace(0, np.pi / 2, n)[:, None]
    body[:n] = body[:n] * np.sin(t) + tail * np.cos(t)
    with wave.open(path, "w") as w:
        w.setparams(p)
        w.writeframes(np.clip(body, -32768, 32767).astype(np.int16).tobytes())


def probe_channels(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return int(r.stdout.strip() or 1)
    except ValueError:
        return 1


def peak_gain(path, filt, target_db):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", filt + ",volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    return round(target_db - float(m.group(1)), 2) if m else 0.0


sounds()
for name, (uid, fmt) in SKETCHFAB.items():
    sketchfab(name, uid, fmt)
for a in POLYHAVEN_MODELS:
    polyhaven(a, "Models", "gltf")
for a in POLYHAVEN_TEXTURES:
    polyhaven(a, "Textures", None)
for a in POLYHAVEN_HDRIS:
    polyhaven(a, "HDRI", None)
for n in UNITY_VFX:
    z = os.path.join(DEST, "UnityVFX", f"{n}-flipbooks.zip")
    get(f"https://unity3d.com/files/labs/downloads/vfx/assets01/{n}/{n}-flipbooks.zip", z)
    with zipfile.ZipFile(z) as zf:
        zf.extractall(os.path.join(DEST, "UnityVFX", n))
print("assets ready in", os.path.abspath(DEST))
