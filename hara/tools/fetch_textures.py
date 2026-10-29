"""Download the CC0 ambientCG materials the game uses into assets/tex/<id>/ (1K JPG: color, normal GL, roughness, AO).
Run: python3 tools/fetch_textures.py   (from the hara/ folder). Source: https://ambientcg.com (CC0)."""
import io, os, sys, urllib.request, zipfile
from PIL import Image
IDS = {
    "PaintedPlaster010": "plaster peeling to red brick",
    "PaintedPlaster014": "white plaster peeling",
    "PaintedPlaster006": "cracked plaster",
    "Plaster006": "weathered plaster",
    "Bricks097": "rough red brick (unfinished buildings)",
    "Bricks109A": "sandstone blocks (old buildings)",
    "Concrete036": "concrete frame / slabs",
    "PavingStones049": "dark basalt cobbles (street)",
    "PavingStones119": "worn pavers (sidewalk)",
    "CorrugatedSteel007A": "shop shutters",
    "Metal041B": "rusty painted metal",
    "Planks037A": "dark wood (doors, shutters)",
    "Fabric030": "cloth (awnings, laundry)",
}
MAPS = ("Color", "NormalGL", "Roughness")
GRAY = {"CorrugatedSteel007A"}   # colour comes from the vertex tint instead
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "tex")
for aid in IDS:
    out = os.path.join(root, aid)
    if os.path.isdir(out) and not "--force" in sys.argv:
        continue
    os.makedirs(out, exist_ok=True)
    req = urllib.request.Request(f"https://ambientcg.com/get?file={aid}_1K-JPG.zip", headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req).read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for n in z.namelist():
            for m in MAPS:
                if n.endswith(f"_{m}.jpg"):
                    im = Image.open(io.BytesIO(z.read(n)))
                    if m == "Color" and aid in GRAY:   # keep 3 channels: a 1-channel JPG imports as red-only
                        im = im.convert("L")
                    im = im.convert("L") if m == "Roughness" else im.convert("RGB")
                    im.save(os.path.join(out, f"{m.lower()}.jpg"), quality=80, optimize=True)
    print("ok", aid, sorted(os.listdir(out)))
