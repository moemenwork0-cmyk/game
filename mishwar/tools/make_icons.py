#!/usr/bin/env python3
"""يطلّع أيقونات Phosphor (رخصة MIT) اللي التطبيق محتاجها ويكتبها في js/icon-set.js.

    npm install @phosphor-icons/core@2.1.1
    python3 tools/make_icons.py node_modules/@phosphor-icons/core/assets
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = """house briefcase airplane-tilt shopping-bag bank mosque graduation-cap tree first-aid soccer-ball map-pin
map-trifold navigation-arrow crosshair magnifying-glass clock clock-countdown star user users-three phone
chat-circle-dots share-network shield-check siren lock-key money credit-card wallet device-mobile gear-six bell
moon speaker-high receipt bookmark-simple question info sign-out trash sparkle check-circle x-circle x check plus
minus arrow-right arrow-left caret-left caret-right arrows-down-up paper-plane-tilt car-profile car steering-wheel
hourglass-medium flag-checkered confetti heart thumbs-up gift path timer squares-four seal-check map-pin-line
clock-counter-clockwise lightning crown hand-coins coins identification-card buildings""".split()
WEIGHTS = ["duotone", "fill", "bold"]


def main(src):
    src = Path(src)
    out = ["/* مولّد تلقائياً بـ tools/make_icons.py من Phosphor Icons (رخصة MIT) — متعدلوش يدوي */",
           "(function () {", "  window.MW = window.MW || {};", "  MW.PH = {"]
    for w in WEIGHTS:
        out.append(f"    {w}: {{")
        for n in NAMES:
            svg = (src / w / f"{n}-{w}.svg").read_text()
            inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1).strip()
            out.append(f"      '{n}': '{inner}',")
        out.append("    },")
    out += ["  };", "})();", ""]
    (ROOT / "js" / "icon-set.js").write_text("\n".join(out), encoding="utf-8")
    print(len(NAMES), "icons x", len(WEIGHTS), "weights")


if __name__ == "__main__":
    main(sys.argv[1])
