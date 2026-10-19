#!/usr/bin/env python3
"""يجهز صور التطبيق: بيصغّرها لـ WebP في assets/img ويكتب js/assets.js (الصور جوه الكود عشان التطبيق يشتغل من ملف واحد).

    python3 tools/make_assets.py <fluent-png-dir> <car-render-dir>

الأيقونات الثلاثية الأبعاد من Microsoft Fluent Emoji (رخصة MIT).
العربيات متولّدة بـ tools/car-render.html (three.js).
"""
import base64
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"

ICONS = """house office_building airplane shopping_bags hospital stadium classical_building mosque
graduation_cap round_pushpin world_map dollar_banknote credit_card mobile_phone star glowing_star
telephone_receiver speech_balloon link shield bell crescent_moon speaker_high_volume gear bookmark
receipt locked wrapped_gift party_popper check_mark_button information red_question_mark door
wastebasket busts_in_silhouette sparkles alarm_clock chequered_flag police_car_light waving_hand
stopwatch spiral_calendar cross_mark money_bag national_park thumbs_up hourglass_not_done""".split()
PEOPLE = "man man_beard man_curly_hair man_office_worker man_bald old_man person person_curly_hair".split()
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


def main(fluent_dir, car_dir):
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for n in ICONS:
        made.append(save(Image.open(Path(fluent_dir) / f"{n}.png"), n, (128, 128)))
    for n in PEOPLE:
        made.append(save(Image.open(Path(fluent_dir) / f"{n}.png"), "av_" + n, (144, 144)))
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
    main(sys.argv[1], sys.argv[2])
