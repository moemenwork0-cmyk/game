class_name Scatter
extends Node3D
## Places rocks, trees, shrubs, grass and beach debris over the island with
## MultiMeshes in 64 m cells. Placement follows the terrain (height, slope,
## texture under the point) and the shore distance field, so jungle stops at
## the beach, driftwood lies on the tide line and boulders sit on rocky shores.
## Dense layers (grass) stream around the camera.

const CELL := 64.0

var terrain: Terrain3D
var shore: Image
var shore_rect := Rect2(-1024, -1024, 2048, 2048)
var rules: Array[Dictionary] = []
var _variants := {}          # glb path -> Array of {mesh, basis, lift}
var _cells := {}             # "rule:cx:cz" -> Node3D
var _stream_t := 0.0
var _density_scale := 1.0
var _clump_noise := FastNoiseLite.new()


func setup(t: Terrain3D, shore_img: Image, rect: Rect2) -> void:
	terrain = t
	shore = shore_img
	shore_rect = rect
	_density_scale = [0.35, 0.6, 1.0, 1.4][clampi(Settings.grass, 0, 3)]
	_clump_noise.seed = 77
	_clump_noise.frequency = 0.01
	_clump_noise.fractal_octaves = 3
	rules = _rules()
	# draw distances follow the quality preset
	var k: float = [0.5, 0.75, 1.0, 1.25, 1.0][clampi(Settings.quality, 0, 4)]
	for r in rules:
		r["range"] = float(r["range"]) * k


## island texture ids (tools/assets/gen_island.py)
enum { SAND, WET, GRAVEL, SANDROCK, FOREST, LEAVES, GRASS, CLIFF, BASALT, MOSS }


func _rules() -> Array[Dictionary]:
	var M := "res://assets/env/models/%s.glb"
	var r: Array[Dictionary] = []
	# --- coast ---------------------------------------------------------------------
	r.append({"name": "coast_rocks", "models": [M % "coast_rocks_05", M % "coast_land_rocks_02", M % "coast_land_rocks_03"],
		"per_m2": 1.0 / 900.0, "shore": Vector2(-18, 10), "tex": [BASALT, WET], "scale": Vector2(0.7, 1.6),
		"sink": 0.35, "align": 0.6, "range": 1400.0, "shadow": true,
		"rock": {"tint": Color(1.45, 1.05, 0.72), "moss": 0.55}})
	r.append({"name": "beach_rocks", "models": [M % "sand_rocks_small_01", M % "boulder_01"],
		"per_m2": 1.0 / 5000.0, "shore": Vector2(-6, 40), "tex": [SAND, SANDROCK], "scale": Vector2(0.6, 1.3),
		"sink": 0.3, "align": 0.8, "range": 600.0, "shadow": true,
		"rock": {"tint": Color(1.4, 1.05, 0.75), "moss": 0.6}})
	r.append({"name": "cliffs", "models": [M % "coastal_cliff_01", M % "coastal_cliff_02"],
		"per_m2": 1.0 / 2600.0, "shore": Vector2(-8, 30), "tex": [BASALT, CLIFF], "slope": Vector2(14, 90),
		"scale": Vector2(0.6, 1.0), "sink": 0.45, "align": 0.0, "range": 2500.0, "shadow": true,
		"rock": {"tint": Color(1.35, 1.02, 0.76), "moss": 0.8}})
	r.append({"name": "driftwood", "models": [M % "dead_tree_trunk", M % "dead_tree_trunk_02", M % "dry_branches_medium_01"],
		"per_m2": 1.0 / 700.0, "height": Vector2(1.0, 3.0), "tex": [SAND, WET, SANDROCK], "scale": Vector2(0.7, 1.2),
		"sink": 0.15, "align": 1.0, "tilt": 0.0, "range": 260.0, "shadow": true})
	r.append({"name": "shells", "models": [M % "lambis_shell", M % "stone_01", M % "rock_09", M % "rock_07"],
		"per_m2": 1.0 / 60.0, "height": Vector2(0.4, 2.6), "tex": [SAND, WET, SANDROCK], "scale": Vector2(0.8, 1.6),
		"sink": 0.2, "align": 1.0, "range": 45.0, "shadow": false, "stream": true})
	# --- jungle edge and interior ------------------------------------------------------
	r.append({"name": "palms", "models": [M % "palms"],
		"per_m2": 1.0 / 240.0, "behind": Vector2(-30, 16), "slope": Vector2(0, 26), "scale": Vector2(0.85, 1.15),
		"sink": 0.0, "align": 0.0, "range": 2000.0, "shadow": true, "foliage": true})
	r.append({"name": "jungle_palms", "models": [M % "palms"],
		"per_m2": 1.0 / 1400.0, "behind": Vector2(16, 400), "slope": Vector2(0, 26), "scale": Vector2(1.0, 1.25),
		"sink": 0.0, "align": 0.0, "range": 2000.0, "shadow": true, "foliage": true})
	r.append({"name": "edge_trees", "models": [M % "island_tree_02", M % "island_tree_01"],
		"per_m2": 1.0 / 110.0, "behind": Vector2(-2, 40), "slope": Vector2(0, 30), "scale": Vector2(0.8, 1.35),
		"sink": 0.2, "align": 0.0, "range": 1600.0, "shadow": true, "foliage": true})
	r.append({"name": "jungle_trees", "models": [M % "island_tree_03", M % "island_tree_01", M % "island_tree_02"],
		"per_m2": 1.0 / 55.0, "behind": Vector2(30, 9999), "slope": Vector2(0, 36), "scale": Vector2(1.0, 1.9),
		"sink": 0.3, "align": 0.0, "range": 1600.0, "shadow": true, "foliage": true})
	r.append({"name": "roots", "models": [M % "root_cluster_01", M % "tree_stump_01"],
		"per_m2": 1.0 / 2500.0, "behind": Vector2(5, 9999), "slope": Vector2(0, 30), "scale": Vector2(0.8, 1.2),
		"sink": 0.2, "align": 0.7, "range": 300.0, "shadow": true})
	r.append({"name": "mossy_rocks", "models": [M % "rock_moss_set_01", M % "rock_moss_set_02"],
		"per_m2": 1.0 / 900.0, "behind": Vector2(10, 9999), "scale": Vector2(0.6, 1.5),
		"sink": 0.35, "align": 0.7, "range": 500.0, "shadow": true,
		"rock": {"tint": Color(1.1, 1.0, 0.9), "moss": 0.9}})
	r.append({"name": "shrubs", "models": [M % "shrub_02", M % "pachira_aquatica_01", M % "shrub_04", M % "fern_02"],
		"per_m2": 1.0 / 30.0, "behind": Vector2(-6, 9999), "slope": Vector2(0, 38), "scale": Vector2(0.7, 1.4),
		"sink": 0.05, "align": 0.3, "range": 140.0, "shadow": true, "foliage": true, "stream": true})
	r.append({"name": "ferns", "models": [M % "fern_02", M % "shrub_03", M % "nettle_plant", M % "weed_plant_02"],
		"per_m2": 1.0 / 6.0, "behind": Vector2(8, 9999), "slope": Vector2(0, 40), "scale": Vector2(0.8, 1.6),
		"sink": 0.02, "align": 0.6, "range": 60.0, "shadow": false, "foliage": true, "stream": true})
	# sandstone stacks standing in the lagoon, and big outcrops at the back of the beach
	r.append({"name": "sea_rocks", "models": [M % "coast_rocks_05", M % "coast_land_rocks_02", M % "coast_land_rocks_03", M % "boulder_01"],
		"per_m2": 1.0 / 1300.0, "height": Vector2(-3.2, -0.3), "shore": Vector2(-90, -3), "scale": Vector2(0.5, 1.4),
		"sink": 0.3, "align": 0.3, "range": 1400.0, "shadow": true,
		"rock": {"tint": Color(1.45, 1.05, 0.72), "moss": 0.35}})
	r.append({"name": "beach_outcrops", "models": [M % "coast_land_rocks_02", M % "coast_land_rocks_03", M % "rock_moss_set_01"],
		"per_m2": 1.0 / 2200.0, "behind": Vector2(-45, 10), "slope": Vector2(0, 25), "scale": Vector2(0.9, 1.8),
		"sink": 0.25, "align": 0.5, "range": 1400.0, "shadow": true,
		"rock": {"tint": Color(1.45, 1.05, 0.72), "moss": 0.85}})
	# the river: mossy stones in and along the water, lush banks
	r.append({"name": "river_rocks", "models": [M % "rock_moss_set_01", M % "rock_moss_set_02", M % "boulder_01"],
		"per_m2": 1.0 / 70.0, "water": Vector2(-4.0, 3.0), "height": Vector2(0.0, 40.0), "scale": Vector2(0.35, 1.0),
		"sink": 0.35, "align": 0.6, "range": 500.0, "shadow": true,
		"rock": {"tint": Color(1.15, 1.0, 0.85), "moss": 0.9}})
	r.append({"name": "riverbank", "models": [M % "fern_02", "res://assets/env/models/plants_taro.glb", "res://assets/env/models/plants_grass.glb"],
		"per_m2": 1.0 / 4.0, "water": Vector2(0.8, 12.0), "slope": Vector2(0, 40), "scale": Vector2(0.9, 1.6),
		"sink": 0.03, "align": 0.5, "range": 110.0, "shadow": true, "foliage": true, "stream": true})
	r.append({"name": "riverbank_bananas", "models": ["res://assets/env/models/plants_banana.glb"],
		"per_m2": 1.0 / 40.0, "water": Vector2(2.0, 18.0), "slope": Vector2(0, 30), "scale": Vector2(1.0, 1.5),
		"sink": 0.05, "align": 0.1, "range": 320.0, "shadow": true, "foliage": true})
	var P := "res://assets/env/models/plants_%s.glb"
	r.append({"name": "tall_grass", "models": [P % "grass"],
		"per_m2": 1.0 / 2.2, "behind": Vector2(-10, 9999), "slope": Vector2(0, 35), "scale": Vector2(0.8, 1.4),
		"clump": 0.035, "clump_cut": 0.42, "sink": 0.03, "align": 0.6, "range": 75.0, "shadow": true, "foliage": true, "stream": true})
	r.append({"name": "saplings", "models": [P % "sapling"],
		"per_m2": 1.0 / 70.0, "behind": Vector2(-28, 25), "slope": Vector2(0, 28), "scale": Vector2(0.8, 1.5),
		"sink": 0.0, "align": 0.3, "range": 260.0, "shadow": true, "foliage": true})
	r.append({"name": "bananas", "models": [P % "banana"],
		"per_m2": 1.0 / 45.0, "behind": Vector2(4, 500), "slope": Vector2(0, 28), "scale": Vector2(0.8, 1.25),
		"clump": 0.02, "clump_cut": 0.55, "sink": 0.05, "align": 0.1, "range": 320.0, "shadow": true, "foliage": true})
	r.append({"name": "taro", "models": [P % "taro"],
		"per_m2": 1.0 / 12.0, "behind": Vector2(6, 9999), "slope": Vector2(0, 30), "scale": Vector2(0.8, 1.3),
		"clump": 0.05, "clump_cut": 0.5, "sink": 0.02, "align": 0.4, "range": 110.0, "shadow": true, "foliage": true, "stream": true})
	r.append({"name": "grass", "models": [M % "grass_medium_01", M % "grass_medium_02"],
		"per_m2": 1.0 / 1.6, "behind": Vector2(-14, 9999), "tex": [GRASS, FOREST, SAND, LEAVES], "slope": Vector2(0, 32),
		"scale": Vector2(0.8, 1.5), "sink": 0.02, "align": 0.8, "range": 55.0, "shadow": false, "foliage": true, "stream": true})
	r.append({"name": "beach_grass", "models": [M % "grass_bermuda_01", M % "grass_medium_02"],
		"per_m2": 1.0 / 5.0, "behind": Vector2(-22, 6), "height": Vector2(2.2, 99), "scale": Vector2(0.9, 1.6),
		"sink": 0.02, "align": 0.8, "range": 70.0, "shadow": false, "foliage": true, "stream": true})
	return r


## Shore field at a point: x = distance to the coast (m, + inland), y = metres behind
## the dry beach (negative on the sand), z = distance to fresh water (negative inside the
## lake or river). Outside the island map: open sea.
func shore_at(x: float, z: float) -> Vector3:
	var u := (x - shore_rect.position.x) / shore_rect.size.x
	var v := (z - shore_rect.position.y) / shore_rect.size.y
	if u < 0.0 or v < 0.0 or u >= 1.0 or v >= 1.0:
		return Vector3(-2000.0, -2000.0, 999.0)
	var w := shore.get_width()
	var h := shore.get_height()
	var fx := u * w - 0.5
	var fz := v * h - 0.5
	var ix := clampi(int(floor(fx)), 0, w - 2)
	var iz := clampi(int(floor(fz)), 0, h - 2)
	var tx := clampf(fx - ix, 0.0, 1.0)
	var tz := clampf(fz - iz, 0.0, 1.0)
	var p00 := shore.get_pixel(ix, iz)
	var p10 := shore.get_pixel(ix + 1, iz)
	var p01 := shore.get_pixel(ix, iz + 1)
	var p11 := shore.get_pixel(ix + 1, iz + 1)
	var a := Vector3(p00.r, p00.g, p00.b).lerp(Vector3(p10.r, p10.g, p10.b), tx)
	var b := Vector3(p01.r, p01.g, p01.b).lerp(Vector3(p11.r, p11.g, p11.b), tx)
	return a.lerp(b, tz)


## Drop every cell (used by the screenshot tool between viewpoints).
func clear() -> void:
	for k in _cells:
		_cells[k].queue_free()
	_cells.clear()


## Fill every non-streamed rule within radius of a point (load time).
## include_streamed builds the dense near layers too (screenshots, no waiting for streaming).
func build_static(center: Vector3, radius: float, progress: Callable = Callable(), include_streamed := false) -> void:
	var n := 0
	var todo := []
	for ri in rules.size():
		if rules[ri].get("stream", false) and not include_streamed:
			continue
		var rad := minf(radius, rules[ri]["range"])
		var c0 := Vector2i(floori((center.x - rad) / CELL), floori((center.z - rad) / CELL))
		var c1 := Vector2i(floori((center.x + rad) / CELL), floori((center.z + rad) / CELL))
		for cz in range(c0.y, c1.y + 1):
			for cx in range(c0.x, c1.x + 1):
				var cc := Vector2((cx + 0.5) * CELL, (cz + 0.5) * CELL)
				if cc.distance_to(Vector2(center.x, center.z)) < rad + CELL:
					todo.append([ri, cx, cz])
	for t in todo:
		_build_cell(t[0], t[1], t[2])
		n += 1
		if n % 24 == 0:
			if progress.is_valid():
				progress.call(float(n) / todo.size())
			await get_tree().process_frame


func _process(delta: float) -> void:
	_stream_t -= delta
	if _stream_t > 0.0 or terrain == null:
		return
	_stream_t = 0.25
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var p := cam.global_position
	var budget := 3
	for ri in rules.size():
		var rule := rules[ri]
		if not rule.get("stream", false):
			continue
		var rad: float = rule["range"] + CELL * 0.5
		var c0 := Vector2i(floori((p.x - rad) / CELL), floori((p.z - rad) / CELL))
		var c1 := Vector2i(floori((p.x + rad) / CELL), floori((p.z + rad) / CELL))
		for cz in range(c0.y, c1.y + 1):
			for cx in range(c0.x, c1.x + 1):
				var key := "%d:%d:%d" % [ri, cx, cz]
				if _cells.has(key):
					continue
				if budget <= 0:
					return
				_build_cell(ri, cx, cz)
				budget -= 1
	# drop far streamed cells
	for key in _cells.keys():
		var parts: PackedStringArray = key.split(":")
		var rule2 := rules[int(parts[0])]
		if not rule2.get("stream", false):
			continue
		var cc := Vector2((int(parts[1]) + 0.5) * CELL, (int(parts[2]) + 0.5) * CELL)
		if cc.distance_to(Vector2(p.x, p.z)) > rule2["range"] + CELL * 2.0:
			_cells[key].queue_free()
			_cells.erase(key)


func _build_cell(ri: int, cx: int, cz: int) -> void:
	var rule := rules[ri]
	var key := "%d:%d:%d" % [ri, cx, cz]
	var holder := Node3D.new()
	holder.name = "c_%s_%d_%d" % [rule["name"], cx, cz]
	add_child(holder)
	_cells[key] = holder
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(key) ^ 0x5eed
	var count := int(CELL * CELL * float(rule["per_m2"]) * (_density_scale if rule.get("stream", false) else 1.0))
	count += 1 if rng.randf() < fmod(CELL * CELL * float(rule["per_m2"]), 1.0) else 0
	var vars := _get_variants(rule)
	if vars.is_empty():
		return
	var per_var: Array = []
	per_var.resize(vars.size())
	for i in vars.size():
		per_var[i] = []
	var data := terrain.data
	for i in count:
		var x := (cx + rng.randf()) * CELL
		var z := (cz + rng.randf()) * CELL
		var y := data.get_height(Vector3(x, 0, z))
		if is_nan(y):
			continue
		if rule.has("height"):
			var hr: Vector2 = rule["height"]
			if y < hr.x or y > hr.y:
				continue
		elif y < 0.25:
			continue
		var sh := shore_at(x, z)
		if rule.has("shore"):
			var sr: Vector2 = rule["shore"]
			if sh.x < sr.x or sh.x > sr.y:
				continue
		if rule.has("behind"):
			var br: Vector2 = rule["behind"]
			if sh.y < br.x or sh.y > br.y:
				continue
		if rule.has("water"):
			var wr: Vector2 = rule["water"]
			if sh.z < wr.x or sh.z > wr.y:
				continue
		elif sh.z < 0.8:
			continue  # nothing grows in the lake or the river
		var nrm := data.get_normal(Vector3(x, y, z))
		if not nrm.is_finite():
			continue
		var slope := rad_to_deg(acos(clampf(nrm.y, -1.0, 1.0)))
		var sl: Vector2 = rule.get("slope", Vector2(0, 45))
		if slope < sl.x or slope > sl.y:
			continue
		if rule.has("tex"):
			var tid := data.get_texture_id(Vector3(x, y, z))
			var tex_id := int(tid.x) if tid.z < 0.5 else int(tid.y)
			if not (tex_id in rule["tex"]):
				continue
		if rule.has("clump"):
			# plants grow in patches: keep only where a low-frequency noise is high
			var cn := _clump_noise.get_noise_2d(x * rule["clump"] * 100.0, z * rule["clump"] * 100.0) * 0.5 + 0.5
			if cn < rule["clump_cut"]:
				continue
		var vi := rng.randi() % vars.size()
		var v: Dictionary = vars[vi]
		var sc := rng.randf_range(rule["scale"].x, rule["scale"].y)
		var up := Vector3.UP.lerp(nrm, float(rule.get("align", 0.0))).normalized()
		var b := Basis(Quaternion(Vector3.UP, up)) * Basis(Vector3.UP, rng.randf() * TAU)
		if rule.get("tilt", 0.0) > 0.0:
			b = b * Basis(Vector3.RIGHT, rng.randf_range(-1, 1) * rule["tilt"])
		b = b * v["basis"] * Basis.from_scale(Vector3.ONE * sc)
		var sink: float = rule.get("sink", 0.0) * v["height"] * sc
		# big meshes rest on the lowest ground under their footprint, not on the centre
		var half: Vector2 = v["half"] * sc
		if half.x > 1.5 or half.y > 1.5:
			for c in [Vector3(half.x, 0, half.y), Vector3(-half.x, 0, half.y), Vector3(half.x, 0, -half.y), Vector3(-half.x, 0, -half.y)]:
				var w: Vector3 = b.orthonormalized() * c * 0.8
				var gy := data.get_height(Vector3(x + w.x, 0, z + w.z))
				if not is_nan(gy):
					y = minf(y, gy)
		var origin: Vector3 = Vector3(x, y, z) + up * (float(v["lift"]) * sc - sink)
		per_var[vi].append(Transform3D(b, origin - holder.global_position))
	for i in vars.size():
		var xs: Array = per_var[i]
		if xs.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = vars[i]["mesh"]
		mm.instance_count = xs.size()
		for k in xs.size():
			mm.set_instance_transform(k, xs[k])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.visibility_range_end = rule["range"]
		mmi.visibility_range_end_margin = minf(rule["range"] * 0.15, 30.0)
		mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if rule.get("shadow", true) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		holder.add_child(mmi)


func _get_variants(rule: Dictionary) -> Array:
	var all: Array = []
	for path in rule["models"]:
		if not _variants.has(path):
			_variants[path] = _load_variants(path, rule.get("foliage", false), rule.get("rock", {}))
		all.append_array(_variants[path])
	return all


func _load_variants(path: String, foliage: bool, rock: Dictionary = {}) -> Array:
	var out: Array = []
	if not ResourceLoader.exists(path):
		push_warning("scatter: missing " + path)
		return out
	var root: Node = (load(path) as PackedScene).instantiate()
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		stack.append_array(n.get_children())
		if n is MeshInstance3D and n.mesh:
			var mi := n as MeshInstance3D
			var basis := _global_basis(mi)
			var aabb: AABB = Transform3D(basis, Vector3.ZERO) * mi.mesh.get_aabb()
			_fix_materials(mi.mesh, foliage, mi.mesh.get_aabb(), rock)
			out.append({"mesh": mi.mesh, "basis": basis, "lift": -aabb.position.y, "height": aabb.size.y,
				"half": Vector2(aabb.size.x, aabb.size.z) * 0.5})
	root.free()
	return out


func _global_basis(n: Node3D) -> Basis:
	var b := n.basis
	var p := n.get_parent()
	while p is Node3D:
		b = (p as Node3D).basis * b
		p = p.get_parent()
	return b


const FOLIAGE_SHADER := preload("res://shaders/foliage.gdshader")
const ROCK_SHADER := preload("res://shaders/rock.gdshader")
const MOSS_TEX := preload("res://assets/env/textures/moss_col.jpg")
const MOSS_NRM := preload("res://assets/env/textures/moss_nrm.jpg")


## Vegetation gets the wind/transmission shader; everything else keeps its imported
## material with tidied-up filtering and alpha.
func _fix_materials(mesh: Mesh, foliage: bool, aabb: AABB, rock: Dictionary = {}) -> void:
	for s in mesh.get_surface_count():
		var m := mesh.surface_get_material(s) as StandardMaterial3D
		if m == null:
			continue
		var name := m.resource_name.to_lower()
		var leafy := m.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED or name.contains("lea") \
			or name.contains("grass") or name.contains("fern") or name.contains("frond")
		if not foliage and not rock.is_empty():
			var rm := ShaderMaterial.new()
			rm.shader = ROCK_SHADER
			rm.set_shader_parameter("albedo_tex", m.albedo_texture)
			if m.normal_enabled and m.normal_texture:
				rm.set_shader_parameter("normal_tex", m.normal_texture)
				rm.set_shader_parameter("use_normal", true)
			if m.roughness_texture:
				rm.set_shader_parameter("orm_tex", m.roughness_texture)
				rm.set_shader_parameter("use_orm", true)
			rm.set_shader_parameter("tint", rock.get("tint", Color.WHITE))
			rm.set_shader_parameter("moss_amount", rock.get("moss", 0.5))
			rm.set_shader_parameter("moss_tex", MOSS_TEX)
			rm.set_shader_parameter("moss_nrm", MOSS_NRM)
			mesh.surface_set_material(s, rm)
			continue
		if not foliage:
			if m.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
				m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
				m.alpha_scissor_threshold = 0.45
			m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
			continue
		var sm := ShaderMaterial.new()
		sm.shader = FOLIAGE_SHADER
		sm.set_shader_parameter("albedo_tex", m.albedo_texture)
		sm.set_shader_parameter("albedo_color", m.albedo_color)
		if m.normal_enabled and m.normal_texture:
			sm.set_shader_parameter("normal_tex", m.normal_texture)
			sm.set_shader_parameter("use_normal", true)
			sm.set_shader_parameter("normal_depth", m.normal_scale)
		if m.roughness_texture:
			sm.set_shader_parameter("orm_tex", m.roughness_texture)
			sm.set_shader_parameter("use_orm", true)
		sm.set_shader_parameter("roughness", m.roughness)
		sm.set_shader_parameter("alpha_cut", 0.45 if leafy else -1.0)
		sm.set_shader_parameter("is_leaf", leafy)
		sm.set_shader_parameter("transmission", Color(0.32, 0.38, 0.14) if leafy else Color.BLACK)
		var h := maxf(aabb.end.y, 0.2)
		sm.set_shader_parameter("plant_height", h)
		# tall plants sway further at the top; grass and ferns mostly flutter
		sm.set_shader_parameter("sway", clampf(h * 0.03, 0.04, 0.45))
		sm.set_shader_parameter("flutter", 0.02 if h < 2.0 else 0.035)
		mesh.surface_set_material(s, sm)
