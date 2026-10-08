#!/usr/bin/env python3
"""Procedural tropical undergrowth (Blender as a Python module) -> assets/env/models/plants_*.glb

  plants_grass.glb   tall tropical grass clumps (bent cards with painted blades)
  plants_banana.glb  banana plants: pseudostem + arching, wind-shredded leaves
  plants_taro.glb    taro / elephant-ear: heart-shaped leaves on long stalks
  plants_sapling.glb young coconut palms: fronds straight out of the sand
Textures are painted here with PIL; nothing is downloaded.
"""
import math
import os
import random

import bpy
import numpy as np
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "assets", "env", "models")
CACHE = os.environ.get("ASSET_CACHE", os.path.expanduser("~/asset_cache"))
TMP = os.path.join(CACHE, "plants_build")
os.makedirs(TMP, exist_ok=True)


def bleed(img: Image.Image) -> Image.Image:
	"""Fill transparent texels with nearby colour so mip-maps don't fringe dark."""
	arr = np.array(img).astype(np.float32)
	a = arr[..., 3:4] / 255.0
	rgb = arr[..., :3]
	blur = np.array(Image.fromarray(rgb.astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32)
	ab = np.array(Image.fromarray((a[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32)[..., None] / 255.0
	fill = blur / np.maximum(ab, 1e-3)
	arr[..., :3] = np.where(a > 0.5, rgb, np.clip(fill, 0, 255))
	return Image.fromarray(arr.astype(np.uint8), "RGBA")


def normal_from_height(h: np.ndarray, strength=2.0) -> Image.Image:
	gy, gx = np.gradient(h)
	n = np.dstack([-gx * strength, -gy * strength, np.ones_like(h)])
	n /= np.linalg.norm(n, axis=2, keepdims=True)
	return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8), "RGB")


# ---------------------------------------------------------------------------------------
def paint_grass(w=1024, h=1024):
	"""A card full of tall blades rooted at the bottom edge."""
	img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
	d = ImageDraw.Draw(img)
	rng = random.Random(3)
	for i in range(70):
		x0 = rng.uniform(0.08, 0.92) * w
		ht = rng.uniform(0.45, 0.98) * h
		lean = rng.uniform(-0.35, 0.35) * w * 0.4
		wid = rng.uniform(5, 11)
		g = rng.uniform(-14, 14)
		dry = rng.random() < 0.18
		base = (58 + g, 96 + g, 28) if not dry else (150, 130, 70)
		tip = (128 + g, 150 + g, 60) if not dry else (190, 170, 105)
		segs = 14
		prev = None
		for s in range(segs + 1):
			t = s / segs
			x = x0 + lean * t * t
			y = h - t * ht
			ww = wid * (1 - t) ** 0.8 + 0.6
			c = tuple(int(base[k] + (tip[k] - base[k]) * t) for k in range(3))
			if prev:
				d.polygon([(prev[0] - prev[2], prev[1]), (x - ww, y), (x + ww, y), (prev[0] + prev[2], prev[1])], fill=c + (255,))
			prev = (x, y, ww)
	img = bleed(img.filter(ImageFilter.SMOOTH))
	img.save(os.path.join(TMP, "grass_col.png"))
	hgt = np.array(img.split()[3]).astype(np.float32) / 255.0
	normal_from_height(np.array(Image.fromarray((hgt * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255.0, 3.0).save(os.path.join(TMP, "grass_nrm.png"))


def paint_banana(w=512, h=1024):
	"""Oblong leaf along v (base at bottom), midrib, parallel veins, wind tears."""
	img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
	d = ImageDraw.Draw(img)
	rng = random.Random(5)
	cx = w / 2
	hgt = np.zeros((h, w), np.float32)
	for y in range(h):
		t = 1 - y / h  # 0 base .. 1 tip
		half = (w * 0.47) * (math.sin(math.pi * min(1.0, t * 0.97 + 0.03)) ** 0.45)
		if t > 0.9:
			half *= (1 - t) / 0.1
		g = 0.5 + 0.5 * math.sin(y * 0.05)
		col = (int(66 + 14 * g), int(122 + 16 * g), int(36 + 6 * g), 255)
		d.line([(cx - half, y), (cx + half, y)], fill=col)
	# veins: lines from the midrib out to the edge, angled towards the tip
	for y in range(0, h, 9):
		for side in (-1, 1):
			d.line([(cx, y), (cx + side * w * 0.5, y - w * 0.18)], fill=(52, 104, 30, 0) if False else (58, 110, 32, 255), width=1)
	# wind tears: thin transparent slits from the edge towards the midrib
	for i in range(rng.randint(9, 14)):
		y = rng.uniform(0.1, 0.9) * h
		side = rng.choice((-1, 1))
		depth = rng.uniform(0.35, 0.98)
		d.line([(cx + side * w * 0.5, y - w * 0.18 * 1.0), (cx + side * w * 0.5 * (1 - depth), y)], fill=(0, 0, 0, 0), width=rng.randint(2, 5))
	# a few brown dry edges
	arr = np.array(img).astype(np.float32)
	yy, xx = np.mgrid[0:h, 0:w]
	edge = np.abs(xx - cx) / (w * 0.47)
	brown = np.clip((edge - 0.82) * 6, 0, 1)[..., None] * (rng.random() * 0.6 + 0.2)
	arr[..., :3] = arr[..., :3] * (1 - brown) + np.array([120, 100, 50]) * brown
	# midrib
	img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
	d = ImageDraw.Draw(img)
	d.rectangle([cx - 5, 0, cx + 5, h], fill=(150, 168, 90, 255))
	img = bleed(img)
	img.save(os.path.join(TMP, "banana_col.png"))
	vein = np.array(img.convert("L")).astype(np.float32) / 255.0
	normal_from_height(np.array(Image.fromarray((vein * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255.0, 2.0).save(os.path.join(TMP, "banana_nrm.png"))


def paint_taro(w=1024, h=1024):
	"""Heart-shaped leaf; the stalk joins at the notch (bottom centre of the texture)."""
	img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
	d = ImageDraw.Draw(img)
	cx, cy = w / 2, h * 0.32  # attachment point
	pts = []
	for i in range(181):
		a = math.radians(i * 2)
		# cardioid-like outline pointing up (tip at the top)
		r = (1 - math.sin(a)) * 0.5 + 0.02
		x = math.cos(a) * r
		y = math.sin(a) * r
		pts.append((cx + x * w * 0.62, cy - (y - 0.0) * h * 0.62 - h * -0.0))
	# simpler: a pointed heart via parametric curve
	pts = []
	for i in range(361):
		t = math.radians(i)
		x = 16 * math.sin(t) ** 3
		y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
		pts.append((cx + x * w / 36, h * 0.42 - y * h / 36))
	d.polygon(pts, fill=(54, 112, 40, 255))
	# veins radiating from the notch
	notch = (cx, h * 0.42 - 5 * h / 36 + h * 0.06)
	for k in range(-4, 5):
		a = math.radians(90 + k * 20)
		ex = notch[0] + math.cos(a) * w * 0.48
		ey = notch[1] - math.sin(a) * h * 0.48 if k != 0 else notch[1] - h * 0.42
		d.line([notch, (ex, ey)], fill=(110, 150, 70, 255), width=6 if k == 0 else 4)
	arr = np.array(img).astype(np.float32)
	# glossy lighter centre, darker rim
	yy, xx = np.mgrid[0:h, 0:w]
	r = np.hypot(xx - cx, yy - h * 0.45) / (w * 0.45)
	arr[..., :3] *= (1.12 - 0.3 * np.clip(r, 0, 1))[..., None]
	img = bleed(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA"))
	img.save(os.path.join(TMP, "taro_col.png"))
	vein = np.array(img.convert("L")).astype(np.float32) / 255.0
	normal_from_height(np.array(Image.fromarray((vein * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255.0, 2.5).save(os.path.join(TMP, "taro_nrm.png"))
	return notch[0] / w, 1 - notch[1] / h  # notch in UV


# ---------------------------------------------------------------------------------------
def material(name, col, nrm=None, rough=0.6, alpha=True, color=None):
	m = bpy.data.materials.new(name)
	m.use_nodes = True
	nt = m.node_tree
	b = nt.nodes["Principled BSDF"]
	b.inputs["Roughness"].default_value = rough
	if col:
		t = nt.nodes.new("ShaderNodeTexImage")
		t.image = bpy.data.images.load(os.path.join(TMP, col))
		nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
		if alpha:
			nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
	if color:
		b.inputs["Base Color"].default_value = color
	if nrm:
		n = nt.nodes.new("ShaderNodeTexImage")
		n.image = bpy.data.images.load(os.path.join(TMP, nrm))
		n.image.colorspace_settings.name = "Non-Color"
		nm = nt.nodes.new("ShaderNodeNormalMap")
		nt.links.new(n.outputs["Color"], nm.inputs["Color"])
		nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
	m.use_backface_culling = False
	return m


class Builder:
	def __init__(self):
		self.v, self.f, self.uv, self.mi = [], [], [], []

	def quad_strip(self, rows, mat):
		"""rows: list of lists of (pos, uv); consecutive rows are joined into quads."""
		base = len(self.v)
		n = len(rows[0])
		for row in rows:
			for p, uv in row:
				self.v.append(p)
				self.uv.append(uv)
		for j in range(len(rows) - 1):
			for i in range(n - 1):
				a = base + j * n + i
				self.f.append((a, a + 1, a + n + 1, a + n))
				self.mi.append(mat)

	def tube(self, pts, radii, mat, ring=6, v_scale=1.0):
		rows = []
		for i, p in enumerate(pts):
			tan = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
			side = tan.cross(Vector((0, 0, 1)))
			if side.length < 1e-3:
				side = Vector((1, 0, 0))
			side.normalize()
			up = side.cross(tan).normalized()
			row = []
			for k in range(ring + 1):
				a = k / ring * math.tau
				row.append((p + (side * math.cos(a) + up * math.sin(a)) * radii[i], (k / ring, i / (len(pts) - 1) * v_scale)))
			rows.append(row)
		self.quad_strip(rows, mat)

	def build(self, name, mats, x):
		me = bpy.data.meshes.new(name)
		me.from_pydata([tuple(p) for p in self.v], [], self.f)
		uvl = me.uv_layers.new(name="UVMap")
		for poly in me.polygons:
			for li in poly.loop_indices:
				uvl.data[li].uv = self.uv[me.loops[li].vertex_index]
		for m in mats:
			me.materials.append(m)
		for poly, mi in zip(me.polygons, self.mi):
			poly.material_index = mi
			poly.use_smooth = True
		ob = bpy.data.objects.new(name, me)
		bpy.context.scene.collection.objects.link(ob)
		ob.location = (x, 0, 0)
		return ob


def leaf_along(b, base, direction, length, width, droop, mat, uv_rect, fold=0.25, segs=10, twist=0.0, width_fn=None, swap_uv=False):
	"""A leaf surface following an arching midrib. uv_rect = (u0, v0, u1, v1): u across, v along."""
	dirh = Vector((direction.x, direction.y, 0)).normalized()
	elev = math.asin(max(-1, min(1, direction.z)))
	rows = []
	p = base.copy()
	for j in range(segs + 1):
		t = j / segs
		ang = elev - droop * t ** 1.5
		tan = dirh * math.cos(ang) + Vector((0, 0, math.sin(ang)))
		if j > 0:
			p = p + tan * (length / segs)
		side = tan.cross(Vector((0, 0, 1)))
		if side.length < 1e-4:
			side = Vector((1, 0, 0))
		side.normalize()
		side = side * math.cos(twist * t) + tan.cross(side) * math.sin(twist * t)
		nrm = side.cross(tan).normalized()
		wv = width * (width_fn(t) if width_fn else 1.0)
		u0, v0, u1, v1 = uv_rect
		v = v0 + (v1 - v0) * t
		uvs = [(u0, v), ((u0 + u1) / 2, v), (u1, v)]
		if swap_uv:  # atlas laid out along u (palm frond texture)
			uvs = [(v0 + (v1 - v0) * t, u0), (v0 + (v1 - v0) * t, (u0 + u1) / 2), (v0 + (v1 - v0) * t, u1)]
		rows.append([
			(p + side * wv - nrm * fold * wv, uvs[0]),
			(p, uvs[1]),
			(p - side * wv - nrm * fold * wv, uvs[2]),
		])
	b.quad_strip(rows, mat)
	return p


# ---------------------------------------------------------------------------------------
def grass_clump(name, seed, x, mat):
	rng = random.Random(seed)
	b = Builder()
	cards = rng.randint(5, 7)
	ht = rng.uniform(0.7, 1.3)
	for c in range(cards):
		a = c / cards * math.pi + rng.uniform(-0.2, 0.2)
		d = Vector((math.cos(a), math.sin(a), 0))
		w = rng.uniform(0.45, 0.7)
		lean = Vector((math.cos(a + math.pi / 2), math.sin(a + math.pi / 2), 0)) * rng.uniform(-0.25, 0.25)
		rows = []
		for j in range(4):
			t = j / 3
			off = lean * t * t * ht + Vector((0, 0, t * ht))
			rows.append([(d * -w + off, (0, t)), (d * w + off, (1, t))])
		b.quad_strip(rows, 0)
	return b.build(name, [mat], x)


def banana(name, seed, x, mats):
	rng = random.Random(seed)
	stem_m, leaf_m = mats
	b = Builder()
	h = rng.uniform(1.8, 3.2)
	pts = [Vector((0, 0, h * i / 6)) for i in range(7)]
	b.tube(pts, [0.24 - 0.09 * i / 6 for i in range(7)], 0, ring=8, v_scale=2.0)
	n = rng.randint(9, 13)
	for i in range(n):
		a = i * 2.4 + rng.uniform(-0.3, 0.3)
		age = i / n
		el = math.radians(70 - 75 * age + rng.uniform(-10, 10))
		direction = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
		top = Vector((0, 0, h * rng.uniform(0.85, 1.0)))
		# petiole then blade
		pet_end = top + direction * 0.35
		b.tube([top, pet_end], [0.035, 0.03], 0, ring=4)
		leaf_along(b, pet_end, direction, rng.uniform(2.0, 3.0), rng.uniform(0.32, 0.45), math.radians(40 + 50 * age),
			1, (0, 0, 1, 1), fold=0.2, segs=10, twist=rng.uniform(-0.4, 0.4),
			width_fn=lambda t: math.sin(math.pi * min(1.0, t * 0.97 + 0.03)) ** 0.45)
	return b.build(name, [stem_m, leaf_m], x)


def taro(name, seed, x, mat_stalk, mat_leaf, notch):
	rng = random.Random(seed)
	b = Builder()
	n = rng.randint(4, 7)
	for i in range(n):
		a = i * 2.39 + rng.uniform(-0.3, 0.3)
		ln = rng.uniform(0.8, 1.5)
		out = Vector((math.cos(a), math.sin(a), 0))
		pts = [out * ln * 0.45 * (k / 5) ** 1.3 + Vector((0, 0, ln * math.sin(math.pi * 0.5 * k / 5))) for k in range(6)]
		b.tube(pts, [0.04 - 0.015 * k / 5 for k in range(6)], 0, ring=5)
		tip = pts[-1]
		size = rng.uniform(0.85, 1.3)
		# the blade hangs from the stalk tip, drooping outward
		fwd = (out * 0.9 + Vector((0, 0, -0.45))).normalized()
		side = out.cross(Vector((0, 0, 1))).normalized()
		rows = []
		segs = 6
		for j in range(segs + 1):
			t = j / segs
			v = notch[1] + (1.0 - notch[1]) * t - notch[1] * 0  # notch -> tip
			vv = t
			row = []
			for k in range(5):
				s = k / 4 * 2 - 1
				cup = (s * s) * 0.12 * size
				p = tip + fwd * (t * size) * 1.0 + side * s * size * 0.55 + Vector((0, 0, cup - t * t * 0.18 * size))
				# map: u across (0..1), v from just below the notch (lobes) to the tip
				row.append((p, ((s + 1) / 2, max(0.0, notch[1] - 0.32) + (1.0 - max(0.0, notch[1] - 0.32)) * vv)))
			rows.append(row)
		b.quad_strip(rows, 1)
	return b.build(name, [mat_stalk, mat_leaf], x)


def sapling(name, seed, x, mat):
	rng = random.Random(seed)
	b = Builder()
	n = rng.randint(5, 8)
	base = Vector((0, 0, 0.05))
	for i in range(n):
		a = i * 2.4 + rng.uniform(-0.3, 0.3)
		age = i / n
		el = math.radians(75 - 55 * age)
		direction = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
		ln = rng.uniform(1.2, 2.2)
		leaf_along(b, base, direction, ln, ln * 0.28, math.radians(30 + 45 * age), 0, (0.5, 0.04, 1.0, 0.98),
			fold=0.3, segs=10, twist=rng.uniform(-0.25, 0.25), swap_uv=True,
			width_fn=lambda t: math.sin(math.pi * min(1.0, t * 0.92 + 0.05)) ** 0.7)
	return b.build(name, [mat], x)


def export(path):
	bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format="GLB", export_image_format="AUTO", export_yup=True)
	print("##", os.path.basename(path), os.path.getsize(path) // 1024, "KB")


def main():
	paint_grass()
	paint_banana()
	notch = paint_taro()
	os.makedirs(OUT, exist_ok=True)

	bpy.ops.wm.read_factory_settings(use_empty=True)
	m = material("tall_grass_leaves", "grass_col.png", "grass_nrm.png", 0.7)
	for i in range(5):
		grass_clump("tall_grass_%d" % i, i, i * 2.0, m)
	export(os.path.join(OUT, "plants_grass.glb"))

	bpy.ops.wm.read_factory_settings(use_empty=True)
	stem = material("banana_stem", None, None, 0.6, False, (0.24, 0.26, 0.11, 1))
	leaf = material("banana_leaves", "banana_col.png", "banana_nrm.png", 0.45)
	for i in range(4):
		banana("banana_%d" % i, 10 + i, i * 5.0, (stem, leaf))
	export(os.path.join(OUT, "plants_banana.glb"))

	bpy.ops.wm.read_factory_settings(use_empty=True)
	stalk = material("taro_stalk", None, None, 0.5, False, (0.30, 0.42, 0.16, 1))
	tleaf = material("taro_leaves", "taro_col.png", "taro_nrm.png", 0.35)
	for i in range(4):
		taro("taro_%d" % i, 20 + i, i * 3.0, stalk, tleaf, notch)
	export(os.path.join(OUT, "plants_taro.glb"))

	bpy.ops.wm.read_factory_settings(use_empty=True)
	frond = material("sapling_leaves", None, None, 0.55)
	nt = frond.node_tree
	t = nt.nodes.new("ShaderNodeTexImage")
	t.image = bpy.data.images.load(os.path.join(CACHE, "palm_build", "frond_col.png"))
	nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
	nt.links.new(t.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])
	for i in range(4):
		sapling("palm_sapling_%d" % i, 30 + i, i * 4.0, frond)
	export(os.path.join(OUT, "plants_sapling.glb"))


main()
