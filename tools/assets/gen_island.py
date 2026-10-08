#!/usr/bin/env python3
"""Generates the island: height, Terrain3D control (texture) map and colour map.

Writes raw little-endian files that tools/build_island.gd imports into Terrain3D:
  height.f32   float32 metres          (N x N)
  control.u32  Terrain3D control bits (N x N)
  color.rgba8  macro tint + roughness  (N x N x 4)
  shore.f32    RG: signed distance to the coast (m, + inland), distance behind the dry beach

The wake-up beach is a sheltered crescent cove on the south (+Z) side, held
between two basalt headlands, with a fringing reef offshore and jungle hills behind.
"""
import os
import sys

import numpy as np
from scipy import ndimage

N = 2048            # metres (1 m vertex spacing)
SEED = 7
OUT = sys.argv[1] if len(sys.argv) > 1 else "."

# texture ids (must match tools/build_island.gd)
SAND, WET, GRAVEL, SANDROCK, FOREST, LEAVES, GRASS, CLIFF, BASALT, MOSS = range(10)

rng = np.random.default_rng(SEED)
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
X = xx - N / 2   # east
Z = yy - N / 2   # south (+Z is towards the camera on the wake-up beach)


def noise(scale: float, octaves: int = 5, persistence: float = 0.5, seed: int = 0) -> np.ndarray:
	"""Fractal value noise: random grids upsampled with cubic splines. Roughly in [-1, 1]."""
	r = np.random.default_rng(SEED * 1000 + seed)
	out = np.zeros((N, N), np.float32)
	amp, total, s = 1.0, 0.0, scale
	for _ in range(octaves):
		cells = max(2, int(N / s) + 3)
		g = r.standard_normal((cells, cells)).astype(np.float32)
		z = ndimage.zoom(g, s, order=3)
		ox, oy = r.integers(0, max(1, z.shape[0] - N)), r.integers(0, max(1, z.shape[1] - N))
		out += z[ox:ox + N, oy:oy + N] * amp
		total += amp
		amp *= persistence
		s /= 2.0
		if s < 2:
			break
	return out / total / 0.6


def smooth(a, b, x):
	t = np.clip((x - a) / (b - a), 0.0, 1.0)
	return t * t * (3 - 2 * t)


# --- coastline as an approximate signed distance (metres, + = land) -----------------
r = np.hypot(X, Z)
ang = np.arctan2(Z, X)
warp = noise(300, 5, 0.55, seed=1) * 110 + noise(60, 3, seed=2) * 10
radius = 600 + 60 * np.cos(ang - 2.2) + 35 * np.sin(3 * ang + 1.3)
d = radius + warp - r * (1.0 + 0.18 * np.cos(2 * ang + 0.4))

# the cove: a bite out of the south coast, framed by two headlands
cove_c = np.array([20.0, 760.0])
dc = np.hypot(X - cove_c[0], Z - cove_c[1])
cove_r = 300.0
d = np.minimum(d, dc - cove_r)
rim_ang = np.arctan2(Z - cove_c[1], X - cove_c[0])
headland = (np.exp(-((rim_ang + 2.35) / 0.28) ** 2) + np.exp(-((rim_ang + 0.8) / 0.28) ** 2))
headland *= np.exp(-np.abs(dc - cove_r) / 90)
in_cove = np.exp(-((rim_ang + 1.57) / 0.55) ** 2) * np.exp(-np.maximum(0, dc - cove_r) / 200)

land = d > 0
land = ndimage.binary_opening(land, iterations=3)
lab, nlab = ndimage.label(land)
sizes = ndimage.sum(land, lab, range(1, nlab + 1))
land = lab == (1 + int(np.argmax(sizes)))  # one island, no specks
dist_in = ndimage.distance_transform_edt(land)
dist_out = ndimage.distance_transform_edt(~land)
sd = np.where(land, dist_in, -dist_out).astype(np.float32)
sd = ndimage.gaussian_filter(sd, 2.0)

# --- height ---------------------------------------------------------------------------
n_small = noise(18, 3, seed=3)
n_mid = noise(90, 5, seed=4)
n_big = noise(380, 4, seed=11)
ridges = (1.0 - np.abs(noise(220, 5, 0.5, seed=5))) ** 2

# beach width varies: wide and soft in the cove, narrow or rocky elsewhere
rocky = smooth(0.15, 0.55, noise(160, 3, seed=12)) * (1 - smooth(0.2, 0.6, in_cove))
bw = (22 + 18 * noise(120, 3, seed=13)) * (1 - rocky * 0.85) + 55 * in_cove
bw = np.maximum(bw, 4)
s = sd - bw                                          # metres behind the beach
beach = sd * (0.055 - 0.015 * in_cove) + 0.2 + n_small * 0.12 * smooth(5, 30, sd)
berm = 0.9 * smooth(0.55, 0.9, sd / bw)
back = smooth(-6, 30, s)
# rounded jungle hills and a central volcanic peak
peak = 150 * np.exp(-(((X + 60) / 330) ** 2 + ((Z + 120) / 300) ** 2) * 1.0)
hills = (2.5 + smooth(0, 220, s) * (28 + 22 * n_big + 26 * ridges + 6 * n_mid) + peak * smooth(60, 520, s)
	+ n_small * 0.4)
h_land = (beach + berm) * (1 - back) + np.maximum(beach + berm, hills) * back
# rocky shores: basalt ledges instead of sand
h_land = np.maximum(h_land, rocky * (1.5 + 3.5 * smooth(0, 12, sd) + 2 * n_mid) * smooth(-2, 4, sd))
# volcanic headland cliffs rising straight out of the sea
cliff_h = (18 + 14 * n_mid + 4 * n_small) * smooth(-4, 18, sd)
h_land = np.maximum(h_land, cliff_h * np.clip(headland * 1.8, 0, 1))

# sea floor: sandy shelf, a broken fringing reef ~150 m out, then the drop-off
shelf = 0.2 + sd * (0.05 - 0.02 * in_cove)
reef_on = smooth(-0.25, 0.25, noise(90, 3, seed=6)) * (1 - 0.6 * in_cove)
reef = np.exp(-((sd + 150 + 25 * n_mid) / 20) ** 2) * (4.0 + 2.0 * n_small) * reef_on
drop = smooth(-200, -420, sd) * 35
h_sea = np.maximum(shelf, -7.0 + 1.5 * n_mid) + reef - drop + n_small * 0.25
h_sea = np.minimum(h_sea, -0.9 + 0.4 * n_small)  # reef stays submerged
wl = smooth(-14, 2, sd)
height = h_sea * (1 - wl) + h_land * wl
height = ndimage.gaussian_filter(height.astype(np.float32), 0.8)

# --- slope ----------------------------------------------------------------------------
gz, gx = np.gradient(height)
slope = np.degrees(np.arctan(np.hypot(gx, gz)))

# --- texturing (base / overlay / blend) -------------------------------------------------
base = np.full((N, N), SAND, np.uint32)
over = np.full((N, N), SAND, np.uint32)
blend = np.zeros((N, N), np.float32)
patch = noise(30, 4, seed=8)
patch2 = noise(60, 4, seed=9)


def put(mask, b, o=None, bl=None):
	base[mask] = b
	if o is not None:
		over[mask] = o
		blend[mask] = (bl[mask] if isinstance(bl, np.ndarray) else bl)


# underwater
put(height < 0.6, WET, GRAVEL, np.clip(smooth(-1, -6, height) * 0.8 + patch * 0.4, 0, 1))
put((height < -0.5) & (reef > 1.2), BASALT, GRAVEL, np.clip(0.5 + patch, 0, 1))
# swash zone -> dry sand
put((height >= 0.6) & (height < 1.6), SAND, WET, np.clip(1 - smooth(0.6, 1.6, height), 0, 1))
put((height >= 1.6) & (s < 10), SAND, SANDROCK, np.clip(patch2 * 1.4 - 0.5, 0, 1))
# beach -> jungle edge (leaf litter creeping onto the sand)
edge = (s >= -6) & (s < 30)
put(edge, SAND, LEAVES, np.clip(smooth(-6, 22, s) + patch * 0.3, 0, 1))
inland = s >= 30
put(inland, FOREST, LEAVES, np.clip(0.5 + patch * 0.9, 0, 1))
put(inland & (patch2 > 0.4) & (slope < 16), GRASS, FOREST, np.clip(1.3 - patch2, 0, 1))
# rock by slope: jungle holds on to everything below ~38 degrees
steep = (slope > 34) & (sd > 0)
put(steep, CLIFF, MOSS, np.clip(smooth(48, 36, slope) * 0.6 + patch * 0.3, 0, 1))
put(inland & (slope > 26) & (slope <= 34), FOREST, MOSS, np.clip(smooth(26, 34, slope), 0, 1))
# rocky shores and headlands: basalt
put((rocky > 0.4) & (sd > -6) & (s < 4), BASALT, WET, np.clip(smooth(1.5, 0.4, height), 0, 1))
put((headland > 0.2) & (sd > -8) & (slope > 16), BASALT, CLIFF, np.clip(patch * 0.5 + 0.3, 0, 1))

blend8 = (np.clip(blend, 0, 1) * 255).astype(np.uint32)
uv_angle = (rng.integers(0, 16, (N, N))).astype(np.uint32)
uv_angle = ndimage.zoom(rng.integers(0, 16, (N // 8, N // 8)), 8, order=0).astype(np.uint32)
uv_scale = np.zeros((N, N), np.uint32)
control = ((base & 0x1F) << 27) | ((over & 0x1F) << 22) | ((blend8 & 0xFF) << 14) | ((uv_angle & 0xF) << 10) | ((uv_scale & 7) << 7)
control |= ((height > 0.2) & (slope < 40)).astype(np.uint32) << 1  # navigation

# --- macro colour: wet darkening near the sea, sun-bleached dunes, large-scale variation --
tint = np.ones((N, N, 3), np.float32)
macro = noise(200, 4, seed=10)
tint *= (1.0 + 0.08 * macro)[..., None]
bleach = smooth(1.5, 4.0, height) * smooth(10, -10, s)
tint += np.array([0.06, 0.05, 0.02]) * bleach[..., None]
wet = smooth(1.5, 0.4, height) * (sd > -30)
tint *= (1 - 0.18 * wet)[..., None]
rough = np.clip(0.5 - 0.12 * wet, 0, 1)  # 0.5 = neutral; lower = wetter (subtle, avoids mirror patches)
color = np.dstack([np.clip(tint * 0.92, 0, 1), rough])  # multiplies albedo; 0.5 alpha = neutral roughness
color8 = (color * 255 + 0.5).astype(np.uint8)

os.makedirs(OUT, exist_ok=True)
height.astype("<f4").tofile(os.path.join(OUT, "height.f32"))
control.astype("<u4").tofile(os.path.join(OUT, "control.u32"))
color8.tofile(os.path.join(OUT, "color.rgba8"))
np.dstack([sd, s]).astype("<f4").tofile(os.path.join(OUT, "shore.f32"))  # R: shore distance, G: metres behind the beach
print("height range", float(height.min()), float(height.max()), "land %", float(land.mean() * 100))

# preview
try:
	from PIL import Image
	pal = np.array([[220, 200, 160], [150, 130, 100], [180, 170, 150], [170, 150, 120], [80, 70, 50],
		[110, 80, 50], [90, 130, 60], [120, 115, 110], [50, 50, 55], [70, 100, 60]], np.float32)
	img = pal[base] * (1 - blend[..., None]) + pal[over] * blend[..., None]
	shade = np.clip(1 - (gx - gz) * 0.6, 0.4, 1.5)[..., None]
	img = img * shade
	water = height < 0
	depth = np.clip(-height / 20, 0, 1)[..., None]
	img = np.where(water[..., None], img * (1 - depth * 0.8) * np.array([0.5, 0.85, 1.0]) + np.array([0, 40, 70]) * depth, img)
	Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((1024, 1024)).save(os.path.join(OUT, "preview.jpg"), quality=88)
except Exception as e:
	print("preview failed", e)
