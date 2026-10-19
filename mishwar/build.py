#!/usr/bin/env python3
"""يجمع التطبيق كله في ملف HTML واحد (dist/mishwar.html) سهل تبعته لأي حد ويفتح على الموبايل.

    python3 build.py              -> dist/mishwar.html
    python3 build.py --fragment   -> نسخة من غير <html>/<head>/<body> (للاستضافة جوه صفحة تانية)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def build(fragment: bool) -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    def inline_css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"

    def inline_js(m):
        return "<script>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
    html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)

    if fragment:
        head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
        body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
        # الصفحة المستضيفة بتتحكم في الهوامش الآمنة بنفسها
        head = re.sub(r'<meta (charset|name="viewport")[^>]*>\n?', "", head)
        html = head.strip() + "\n<style>:root{--safe-top:0px;--safe-bottom:0px}</style>\n" + body.strip() + "\n"
    return html


if __name__ == "__main__":
    fragment = "--fragment" in sys.argv
    out = Path(sys.argv[sys.argv.index("-o") + 1]) if "-o" in sys.argv else ROOT / "dist" / ("mishwar-fragment.html" if fragment else "mishwar.html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build(fragment), encoding="utf-8")
    print(out)
