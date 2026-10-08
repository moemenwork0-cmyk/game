#!/usr/bin/env python3
"""Builds coconut palms procedurally (Blender as a Python module) -> assets/env/models/palms.glb

  - trunk: a leaning, gently S-curved tube with a swollen base, Poly Haven palm bark
  - fronds: arched V-folded strips with a painted leaflet atlas (alpha cut-out),
    young fronds pointing up, old ones drooping, a few dead brown ones hanging
  - a cluster of coconuts under the crown
Several variants (height, lean, frond count) go into one file; the game scatters them.
"""
import math
import os
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "assets", "env", "models")
CACHE = os.environ.get("ASSET_CACHE", os.path.expanduser("~/asset_cache"))
TMP = os.path.join(CACHE, "palm_build")
os.makedirs(TMP, exist_ok=True)


# ---------------------------------------------------------------------------------------
# frond texture atlas: top half = green frond, bottom half = dry frond. Base at u=0.
def frond_textures(w=2048, h=1024):
	col = Image.new("RGBA", (w, h), (0, 0, 0, 0))
	nrm = Image.new("RGB", (w, h), (128, 128, 255))
	d = ImageDraw.Draw(col)
	dn = ImageDraw.Draw(nrm)
	rng = random.Random(11)
	for half, dry in ((0, False), (1, True)):
		cy = h * (0.25 + 0.5 * half)
		hh = h * 0.25  # half height of the strip region
		n = 64
		for i in range(n):
			t = (i + 0.5) / n
			x0 = w * (0.04 + 0.94 * t)
			# leaflet length profile: short at the base, longest at ~40 %, short at the tip
			ln = hh * 0.98 * math.sin(math.pi * min(1.0, (t * 0.92 + 0.05))) ** 0.7
			ln *= rng.uniform(0.85, 1.0)
			for side in (-1, 1):
				ang = math.radians(rng.uniform(52, 64))  # leaning towards the tip
				tipx = x0 + math.cos(ang) * ln * 0.9
				tipy = cy + side * math.sin(ang) * ln
				wid = w * 0.0075 * (1.0 - 0.4 * t)
				if dry:
					base_c = (rng.randint(120, 150), rng.randint(92, 112), rng.randint(52, 66))
					tip_c = (rng.randint(95, 120), rng.randint(70, 85), rng.randint(40, 50))
				else:
					g = rng.randint(-10, 10)
					base_c = (70 + g, 112 + g, 32)
					tip_c = (98 + g, 128 + g, 40) if rng.random() < 0.8 else (150, 140, 60)
				segs = 10
				prev_l = prev_r = None
				for s in range(segs + 1):
					k = s / segs
					px = x0 + (tipx - x0) * k
					py = cy + (tipy - cy) * k + side * 6 * math.sin(k * math.pi) * 0  # straight
					# droop: leaflets curl slightly towards the tip
					px += (k ** 2) * ln * 0.12
					wk = wid * (1.0 - k ** 1.6) + 1.0
					c = tuple(int(base_c[j] + (tip_c[j] - base_c[j]) * k) for j in range(3))
					# perpendicular in image space
					dx, dy = (tipx - x0), (tipy - cy)
					L = math.hypot(dx, dy) + 1e-6
					nx, ny = -dy / L, dx / L
					lp = (px + nx * wk, py + ny * wk)
					rp = (px - nx * wk, py - ny * wk)
					if prev_l is not None:
						d.polygon([prev_l, lp, rp, prev_r], fill=c + (255,))
						# fake normal: tilt either side of the leaflet midrib
						dn.polygon([prev_l, lp, (px, py), ((prev_l[0] + prev_r[0]) / 2, (prev_l[1] + prev_r[1]) / 2)],
							fill=(int(128 + nx * 60), int(128 + ny * 60), 230))
						dn.polygon([(px, py), rp, prev_r, ((prev_l[0] + prev_r[0]) / 2, (prev_l[1] + prev_r[1]) / 2)],
							fill=(int(128 - nx * 60), int(128 - ny * 60), 230))
					prev_l, prev_r = lp, rp
		# rachis (midrib)
		rc = (150, 135, 70) if not dry else (110, 85, 50)
		for x in range(int(w * 0.0), int(w * 0.99)):
			t = x / w
			r = 7.0 * (1.0 - t) + 1.5
			d.ellipse([x - r, cy - r, x + r, cy + r], fill=rc + (255,))
	col = col.filter(ImageFilter.SMOOTH)
	# dilate colour under transparent texels so mip-maps don't bleed black
	arr = np.array(col).astype(np.float32)
	a = arr[..., 3:4] / 255.0
	rgb = arr[..., :3]
	blur = np.array(Image.fromarray(rgb.astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
	ab = np.array(Image.fromarray((a[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None] / 255.0
	fill = blur / np.maximum(ab, 1e-3)
	arr[..., :3] = np.where(a > 0.5, rgb, np.clip(fill, 0, 255))
	Image.fromarray(arr.astype(np.uint8), "RGBA").save(os.path.join(TMP, "frond_col.png"))
	nrm.filter(ImageFilter.SMOOTH).save(os.path.join(TMP, "frond_nrm.png"))


def bark_textures():
	src = os.path.join(CACHE, "tex", "palm_tree_bark")
	for n in ("diff", "nor_gl", "rough"):
		im = Image.open(os.path.join(src, n + ".jpg")).convert("RGB").resize((512, 1024), Image.LANCZOS)
		if n == "diff":  # weathered grey-brown coconut trunk
			a = np.asarray(im).astype(np.float32) * np.array([0.72, 0.64, 0.54])
			im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
		im.save(os.path.join(TMP, "bark_%s.jpg" % n), quality=90)


# ---------------------------------------------------------------------------------------
def image_node(nt, path, non_color=False):
	img = bpy.data.images.load(path)
	if non_color:
		img.colorspace_settings.name = "Non-Color"
	n = nt.nodes.new("ShaderNodeTexImage")
	n.image = img
	return n


def make_materials():
	bark = bpy.data.materials.new("palm_bark")
	bark.use_nodes = True
	nt = bark.node_tree
	bsdf = nt.nodes["Principled BSDF"]
	c = image_node(nt, os.path.join(TMP, "bark_diff.jpg"))
	nt.links.new(c.outputs["Color"], bsdf.inputs["Base Color"])
	r = image_node(nt, os.path.join(TMP, "bark_rough.jpg"), True)
	nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
	nm = image_node(nt, os.path.join(TMP, "bark_nor_gl.jpg"), True)
	nmap = nt.nodes.new("ShaderNodeNormalMap")
	nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
	nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

	frond = bpy.data.materials.new("palm_leaves")
	frond.use_nodes = True
	nt = frond.node_tree
	bsdf = nt.nodes["Principled BSDF"]
	c = image_node(nt, os.path.join(TMP, "frond_col.png"))
	nt.links.new(c.outputs["Color"], bsdf.inputs["Base Color"])
	nt.links.new(c.outputs["Alpha"], bsdf.inputs["Alpha"])
	bsdf.inputs["Roughness"].default_value = 0.55
	nm = image_node(nt, os.path.join(TMP, "frond_nrm.png"), True)
	nmap = nt.nodes.new("ShaderNodeNormalMap")
	nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
	nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
	frond.blend_method = "CLIP" if hasattr(frond, "blend_method") else None
	frond.use_backface_culling = False

	nut = bpy.data.materials.new("coconut")
	nut.use_nodes = True
	b = nut.node_tree.nodes["Principled BSDF"]
	b.inputs["Base Color"].default_value = (0.20, 0.24, 0.07, 1)
	b.inputs["Roughness"].default_value = 0.45
	return bark, frond, nut


# ---------------------------------------------------------------------------------------
def palm(name, seed, height, lean, fronds, mats):
	rng = random.Random(seed)
	bark, frond_mat, nut_mat = mats
	verts, faces, uvs, mat_idx = [], [], [], []

	# trunk path: lean in a random direction, S-curve: the tip turns back up towards the sun
	heading = rng.uniform(0, math.tau)
	hd = Vector((math.cos(heading), math.sin(heading), 0))
	pts = []
	segs = 22
	for i in range(segs + 1):
		t = i / segs
		bend = math.sin(lean) * height * (t ** 1.6) * 0.75 - math.sin(lean) * height * 0.18 * max(0, t - 0.6) ** 2
		p = hd * bend + Vector((0, 0, height * t * math.cos(lean * 0.6)))
		pts.append(p)
	ring = 14
	base = len(verts)
	for i, p in enumerate(pts):
		t = i / segs
		tan = (pts[min(i + 1, segs)] - pts[max(i - 1, 0)]).normalized()
		side = tan.cross(Vector((0, 0, 1)))
		if side.length < 1e-3:
			side = Vector((1, 0, 0))
		side.normalize()
		up = side.cross(tan).normalized()
		r = 0.15 + 0.07 * (1 - t) + 0.2 * math.exp(-t * 14.0)  # swollen base
		r *= 1.0 + 0.04 * math.sin(i * 2.3)  # leaf-scar rings
		for k in range(ring + 1):
			a = k / ring * math.tau
			off = side * math.cos(a) * r + up * math.sin(a) * r
			verts.append(p + off)
			uvs.append((k / ring, t * height / 2.2))
	for i in range(segs):
		for k in range(ring):
			a = base + i * (ring + 1) + k
			b = a + ring + 1
			faces.append((a, a + 1, b + 1, b))
			mat_idx.append(0)
	top = pts[-1]
	top_dir = (pts[-1] - pts[-3]).normalized()

	def add_frond(az, elev, length, dry, droop):
		# rachis arcs downward under its own weight
		n = 12
		b0 = len(verts)
		dirh = Vector((math.cos(az), math.sin(az), 0))
		width_max = length * 0.32
		twist = rng.uniform(-0.25, 0.25)
		for j in range(n + 1):
			t = j / n
			ang = elev - droop * (t ** 1.4)
			# integrate the arc
			p = top.copy()
			steps = 8
			for s in range(steps):
				tt = t * (s + 0.5) / steps
				a2 = elev - droop * (tt ** 1.4)
				p += (dirh * math.cos(a2) + Vector((0, 0, math.sin(a2)))) * (length * t / steps)
			tan = dirh * math.cos(ang) + Vector((0, 0, math.sin(ang)))
			side = tan.cross(Vector((0, 0, 1))).normalized()
			nrm = side.cross(tan).normalized()
			prof = math.sin(math.pi * min(1.0, t * 0.92 + 0.05)) ** 0.7
			wv = width_max * prof
			fold = 0.35 * wv  # V-fold: leaflets hang below the rachis
			tw = Matrix.Rotation(twist * t, 3, tan)
			lft = tw @ (side * wv - nrm * fold)
			rgt = tw @ (-side * wv - nrm * fold)
			v_off = 0.0 if dry else 0.5  # Blender UV v=0 is the bottom of the image (dry half)
			verts.extend([p + lft, p, p + rgt])
			u = 0.04 + 0.94 * t
			uvs.extend([(u, v_off + 0.0), (u, v_off + 0.25), (u, v_off + 0.5)])
		for j in range(n):
			a = b0 + j * 3
			faces.append((a, a + 1, a + 4, a + 3))
			faces.append((a + 1, a + 2, a + 5, a + 4))
			mat_idx.extend([1, 1])

	golden = math.pi * (3 - math.sqrt(5))
	for f in range(fronds):
		age = f / fronds  # 0 young (up) -> 1 old (drooping)
		az = f * golden + rng.uniform(-0.15, 0.15)
		elev = math.radians(65 - 95 * age + rng.uniform(-8, 8))
		length = rng.uniform(3.8, 5.2) * (0.75 if age < 0.15 else 1.0)
		droop = math.radians(35 + 60 * age)
		add_frond(az, elev, length, False, droop)
	for f in range(rng.randint(2, 4)):  # dead fronds hanging against the trunk
		add_frond(rng.uniform(0, math.tau), math.radians(-60), rng.uniform(3.0, 4.0), True, math.radians(20))

	me = bpy.data.meshes.new(name)
	me.from_pydata([tuple(v) for v in verts], [], faces)
	uvl = me.uv_layers.new(name="UVMap")
	for poly in me.polygons:
		for li in poly.loop_indices:
			uvl.data[li].uv = uvs[me.loops[li].vertex_index]
	me.materials.append(bark)
	me.materials.append(frond_mat)
	me.materials.append(nut_mat)
	for poly, mi in zip(me.polygons, mat_idx):
		poly.material_index = mi
		poly.use_smooth = True
	obj = bpy.data.objects.new(name, me)
	bpy.context.scene.collection.objects.link(obj)

	# coconuts
	for c in range(rng.randint(5, 10)):
		bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=7, radius=0.13)
		nut = bpy.context.active_object
		nut.scale = (1.0, 1.0, 1.15)
		a = rng.uniform(0, math.tau)
		nut.location = top + Vector((math.cos(a) * 0.28, math.sin(a) * 0.28, -0.35 - rng.uniform(0, 0.25)))
		nut.data.materials.append(nut_mat)
		for p in nut.data.polygons:
			p.use_smooth = True
		bpy.ops.object.select_all(action="DESELECT")
		nut.select_set(True)
		obj.select_set(True)
		bpy.context.view_layer.objects.active = obj
		bpy.ops.object.join()
	obj.location = (seed * 12.0, 0, 0)  # spread out in the file; the game ignores the offset
	return obj


def main():
	frond_textures()
	bark_textures()
	bpy.ops.wm.read_factory_settings(use_empty=True)
	mats = make_materials()
	specs = [  # height m, lean rad, fronds
		(11.0, 0.35, 18), (13.5, 0.22, 20), (8.5, 0.55, 16), (15.0, 0.12, 22), (9.5, 0.75, 17), (6.0, 0.25, 14),
	]
	for i, (h, lean, fr) in enumerate(specs):
		palm("palm_%d" % i, i, h, lean, fr, mats)
	os.makedirs(OUT, exist_ok=True)
	dest = os.path.abspath(os.path.join(OUT, "palms.glb"))
	bpy.ops.export_scene.gltf(filepath=dest, export_format="GLB", export_image_format="AUTO", export_yup=True)
	tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
	print("## palms.glb", tris, "tris total,", os.path.getsize(dest) // 1024, "KB")


main()
