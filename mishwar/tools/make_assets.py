#!/usr/bin/env python3
"""يجهز صور العربيات: بيصغّرها لـ WebP في assets/img ويكتب js/assets.js (الصور جوه الكود عشان التطبيق يشتغل من ملف واحد).

    python3 tools/make_assets.py <car-render-dir>

العربيات متولّدة بـ tools/car-render.html (three.js).
"""
import base64
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"

COLORS = "white black silver grey navy red beige orange".split()


def save(im, name, size, quality=84):
    im = im.convert("RGBA")
    bbox = im.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail(size, Image.LANCZOS)
    path = OUT / f"{name}.webp"
    im.save(path, "WEBP", quality=quality, method=6)
    return path


def main(car_dir):
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for c in COLORS:
        made.append(save(Image.open(Path(car_dir) / f"car_{c}.png"), "car_" + c, (480, 300), 86))
        made.append(save(Image.open(Path(car_dir) / f"top_{c}.png"), "top_" + c, (60, 120), 90))
    lines = ["/* مولّد تلقائياً بـ tools/make_assets.py — متعدلش يدوي */", "(function () {", "  window.MW = window.MW || {};", "  MW.IMG = {"]
    for p in made:
        b64 = base64.b64encode(p.read_bytes()).decode()
        lines.append(f"    {p.stem}: 'data:image/webp;base64,{b64}',")
    lines += ["  };", "})();", ""]
    (ROOT / "js" / "assets.js").write_text("\n".join(lines), encoding="utf-8")
    total = sum(p.stat().st_size for p in made)
    print(f"{len(made)} images, {total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1])
