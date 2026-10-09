#!/usr/bin/env python3
"""Channel-packs Poly Haven ground textures into Terrain3D texture sets.

  albedo:  RGB = diffuse,          A = height (displacement, contrast-stretched)
  normal:  RGB = OpenGL normal scaled by sqrt(ao)*0.5+0.5,  A = roughness

Written as lossy WebP (the sources are JPEG already) to
res://assets/env/terrain/<id>_{alb,nrm}.webp.
"""
import os
import sys

import numpy as np
from PIL import Image

CACHE = os.environ.get("ASSET_CACHE", os.path.expanduser("~/asset_cache"))
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "env", "terrain")
SIZE = 2048
# colour grading per texture (gain RGB), matched to the reference shots: warm,
# reddish-brown tropical sand rather than pale yellow
GRADE = {"coast_sand_01": (1.2, 1.02, 0.8), "damp_sand": (0.98, 0.85, 0.7), "coast_sand_rocks_02": (1.1, 0.95, 0.76),
	"forest_ground_04": (1.0, 0.92, 0.7), "leaves_forest_ground": (1.0, 0.9, 0.68), "aerial_grass_rock": (1.0, 1.0, 0.7)}


def load(path: str, mode: str) -> np.ndarray:
	im = Image.open(path).convert(mode)
	if im.size != (SIZE, SIZE):
		im = im.resize((SIZE, SIZE), Image.LANCZOS)
	return np.asarray(im).astype(np.float32) / 255.0


def pack(asset_id: str) -> None:
	src = os.path.join(CACHE, "tex", asset_id)
	diff = load(f"{src}/diff.jpg", "RGB")
	if asset_id in GRADE:
		diff = np.clip(diff * np.array(GRADE[asset_id], np.float32), 0, 1)
	h = load(f"{src}/disp.jpg", "L")
	lo, hi = np.percentile(h, 0.5), np.percentile(h, 99.5)
	h = np.clip((h - lo) / max(1e-4, hi - lo), 0.0, 1.0)
	n = load(f"{src}/nor_gl.jpg", "RGB") * 2.0 - 1.0
	n /= np.maximum(1e-4, np.linalg.norm(n, axis=2, keepdims=True))
	if os.path.exists(f"{src}/ao.jpg"):
		n *= (np.sqrt(load(f"{src}/ao.jpg", "L")) * 0.5 + 0.5)[..., None]
	rough = load(f"{src}/rough.jpg", "L")
	os.makedirs(OUT, exist_ok=True)
	alb = np.dstack([diff, h])
	nrm = np.dstack([n * 0.5 + 0.5, rough])
	for arr, suffix in ((alb, "alb"), (nrm, "nrm")):
		im = Image.fromarray((np.clip(arr, 0, 1) * 255.0 + 0.5).astype(np.uint8), "RGBA")
		im.save(os.path.join(OUT, f"{asset_id}_{suffix}.webp"), quality=92, alpha_quality=95, method=5)
	print("packed", asset_id)


if __name__ == "__main__":
	for i in sys.argv[1:]:
		pack(i)
