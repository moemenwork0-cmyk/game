#!/usr/bin/env python3
"""Downloads CC0 assets from Poly Haven (https://polyhaven.com) into a raw cache.

  polyhaven.py tex  <id> [<id> ...] [--res 2k]   -> <cache>/tex/<id>/{diff,nor_gl,rough,disp,ao}.jpg
  polyhaven.py model <id> [<id> ...] [--res 2k]  -> <cache>/model/<id>/<id>.gltf (+ bin, textures)
  polyhaven.py hdri <id> [--res 4k]              -> <cache>/hdri/<id>.exr

The cache lives outside the project (default ~/asset_cache); tools/assets/*.py then
convert what the game needs into res://assets/env/.
"""
import argparse
import json
import os
import sys
import time
import urllib.request

API = "https://api.polyhaven.com"
CACHE = os.environ.get("ASSET_CACHE", os.path.expanduser("~/asset_cache"))
TEX_MAPS = {"Diffuse": "diff", "nor_gl": "nor_gl", "Rough": "rough", "Displacement": "disp", "AO": "ao"}


def fetch(url: str, dest: str = "") -> bytes:
	for attempt in range(4):
		try:
			req = urllib.request.Request(url, headers={"User-Agent": "jazira-asset-pipeline"})
			with urllib.request.urlopen(req, timeout=120) as r:
				data = r.read()
			if dest:
				os.makedirs(os.path.dirname(dest), exist_ok=True)
				with open(dest, "wb") as f:
					f.write(data)
			return data
		except Exception as e:  # network hiccup: back off and retry
			print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
			time.sleep(2 ** (attempt + 1))
	raise RuntimeError("failed: " + url)


def files(asset_id: str) -> dict:
	return json.loads(fetch(f"{API}/files/{asset_id}"))


def texture(asset_id: str, res: str) -> None:
	out = os.path.join(CACHE, "tex", asset_id)
	f = files(asset_id)
	for key, name in TEX_MAPS.items():
		if key not in f:
			continue
		dest = os.path.join(out, name + ".jpg")
		if os.path.exists(dest):
			continue
		node = f[key].get(res) or f[key][sorted(f[key])[-1]]
		fmt = "jpg" if "jpg" in node else "png"
		fetch(node[fmt]["url"], dest if fmt == "jpg" else dest[:-3] + "png")
	print("tex", asset_id, "ok")


def model(asset_id: str, res: str) -> None:
	out = os.path.join(CACHE, "model", asset_id)
	g = files(asset_id)["gltf"]
	g = (g.get(res) or g[sorted(g)[0]])["gltf"]
	dest = os.path.join(out, asset_id + ".gltf")
	if not os.path.exists(dest):
		for rel, inc in g.get("include", {}).items():
			fetch(inc["url"], os.path.join(out, rel))
		fetch(g["url"], dest)
	print("model", asset_id, "ok")


def hdri(asset_id: str, res: str) -> None:
	h = files(asset_id)["hdri"][res]
	fetch(h["exr"]["url"], os.path.join(CACHE, "hdri", asset_id + ".exr"))
	print("hdri", asset_id, "ok")


if __name__ == "__main__":
	ap = argparse.ArgumentParser()
	ap.add_argument("kind", choices=["tex", "model", "hdri"])
	ap.add_argument("ids", nargs="+")
	ap.add_argument("--res", default="2k")
	a = ap.parse_args()
	for i in a.ids:
		{"tex": texture, "model": model, "hdri": hdri}[a.kind](i, a.res)
