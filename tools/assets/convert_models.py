#!/usr/bin/env python3
"""Turns raw Poly Haven scans (millions of triangles) into game-ready .glb files.

Runs Blender as a Python module (pip install bpy). Every mesh is decimated to a
triangle budget, textures are downscaled, and the result is written to
res://assets/env/models/<id>.glb. Godot then builds the distance LODs on import.

  python3 tools/assets/convert_models.py [<id> ...]
"""
import os
import sys

import bpy

CACHE = os.environ.get("ASSET_CACHE", os.path.expanduser("~/asset_cache"))
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "env", "models")

# id: (triangle budget for the whole asset, max texture size)
BUDGET = {
	"coast_rocks_01": (60000, 2048), "coast_rocks_02": (60000, 2048), "coast_rocks_03": (45000, 2048),
	"coast_rocks_05": (20000, 1024), "coast_land_rocks_02": (30000, 2048), "coast_land_rocks_03": (30000, 2048),
	"coastal_cliff_01": (60000, 2048), "coastal_cliff_02": (60000, 2048), "sand_rocks_small_01": (20000, 1024),
	"boulder_01": (12000, 1024), "rock_moss_set_01": (30000, 1024), "rock_moss_set_02": (24000, 1024),
	"rock_07": (3000, 512), "rock_09": (2000, 512), "stone_01": (2500, 512), "lambis_shell": (2500, 512),
	"dead_tree_trunk": (10000, 1024), "dead_tree_trunk_02": (12000, 1024), "tree_stump_01": (8000, 1024),
	"root_cluster_01": (15000, 1024), "dry_branches_medium_01": (6000, 512),
	"island_tree_01": (110000, 2048), "island_tree_02": (90000, 2048), "island_tree_03": (110000, 2048),
	"shrub_01": (15000, 1024), "shrub_02": (20000, 1024), "shrub_03": (6000, 512), "shrub_04": (6000, 1024),
	"pachira_aquatica_01": (25000, 1024), "fern_02": (6232, 1024), "grass_medium_01": (8000, 1024),
	"grass_medium_02": (5000, 1024), "grass_bermuda_01": (2000, 512), "nettle_plant": (8000, 512),
	"weed_plant_02": (8000, 512),
}


def tris(o) -> int:
	return sum(len(p.vertices) - 2 for p in o.data.polygons)


def convert(asset_id: str) -> None:
	budget, tex_max = BUDGET[asset_id]
	bpy.ops.wm.read_factory_settings(use_empty=True)
	bpy.ops.import_scene.gltf(filepath=f"{CACHE}/model/{asset_id}/{asset_id}.gltf")
	meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
	total = sum(tris(o) for o in meshes)
	ratio = min(1.0, budget / max(1, total))
	if ratio < 0.98:
		for o in meshes:
			m = o.modifiers.new("dec", "DECIMATE")
			m.decimate_type = "COLLAPSE"
			m.ratio = ratio
			m.use_collapse_triangulate = True
			bpy.context.view_layer.objects.active = o
			bpy.ops.object.modifier_apply(modifier="dec")
	for img in bpy.data.images:
		if img.size[0] > tex_max:
			img.scale(tex_max, tex_max * img.size[1] // img.size[0])
	os.makedirs(OUT, exist_ok=True)
	dest = os.path.abspath(os.path.join(OUT, asset_id + ".glb"))
	bpy.ops.export_scene.gltf(filepath=dest, export_format="GLB", export_image_format="JPEG",
		export_jpeg_quality=90, export_apply=True, export_yup=True)
	after = sum(tris(o) for o in bpy.context.scene.objects if o.type == "MESH")
	print(f"## {asset_id}: {total} -> {after} tris, {os.path.getsize(dest) // 1024} KB", flush=True)


if __name__ == "__main__":
	for i in (sys.argv[1:] or sorted(BUDGET)):
		convert(i)
