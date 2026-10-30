# Downloads the free ready-made assets the Breach scene uses into Content/Raw/Downloaded.
# Poly Haven and Unity Labs need no account; the Sketchfab models need SKETCHFAB_API_TOKEN
# (or ~/.sketchfab_token). Run it on the build machine.
#   python3 Tools/Assets/fetch.py [dest]
import json, os, sys, urllib.request, zipfile

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
RES = "2k"


def api(url):
    req = urllib.request.Request(url, headers={"User-Agent": "desert-breach-fetch"})
    return json.load(urllib.request.urlopen(req))


def get(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "desert-breach-fetch"})
    with urllib.request.urlopen(req) as r, open(path + ".part", "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
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
