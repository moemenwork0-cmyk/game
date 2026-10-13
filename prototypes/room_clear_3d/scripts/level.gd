class_name Level
extends Node3D
## Builds a playable 3D building from a MapGen layout: floors, walls (merged into a few meshes
## per material to keep draw calls low), hinged physical doors, windows with blinds, scanned PBR
## furniture (Poly Haven, CC0), physics clutter, per-room lamps, and the AI data (A* grid,
## cover points, room spots).

const CELL := 0.25
const WALL_T := 0.3

var map: MapGen
var nav := AStarGrid2D.new()
var footprints: Array[Rect2] = []
var cover_sources: Array[Rect2] = []
var player_spawn := Vector3.ZERO
var lamps: Array[OmniLight3D] = []
var intel_props: Array[Node3D] = []
var _flicker: Array = []
var _mats := {}
var _origin := Vector2.ZERO
var _cover_cache: Array[Vector3] = []


func build(m: MapGen) -> void:
	map = m
	player_spawn = m.player_spawn
	_floor()
	_walls()
	_windows()
	_doors()
	_props()
	_lights()
	_build_nav()


# ------------------------------------------------------------------ materials

func _pbr(key: String, dir: String, scale: float, tint := Color.WHITE) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	var base := "res://assets/textures/%s/" % dir
	m.albedo_texture = load(base + "diff.jpg")
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = load(base + "nor.jpg")
	var arm: Texture2D = load(base + "arm.jpg")
	m.roughness_texture = arm
	m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	if Game.quality > 0:
		m.ao_enabled = true
		m.ao_texture = arm
		m.ao_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_mats[key] = m
	return m


func _flat(key: String, c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	_mats[key] = m
	return m


# ------------------------------------------------------------------ merged box geometry

var _batches := {}   # material key -> SurfaceTool


func _batch(key: String) -> SurfaceTool:
	if not _batches.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_batches[key] = st
	return _batches[key]


func _add_box(key: String, center: Vector3, size: Vector3) -> void:
	var st := _batch(key)
	var h := size * 0.5
	var faces := [
		[Vector3.UP, Vector3(-h.x, h.y, -h.z), Vector3(h.x, h.y, -h.z), Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z)],
		[Vector3.DOWN, Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z), Vector3(h.x, -h.y, -h.z), Vector3(-h.x, -h.y, -h.z)],
		[Vector3.FORWARD, Vector3(h.x, -h.y, -h.z), Vector3(-h.x, -h.y, -h.z), Vector3(-h.x, h.y, -h.z), Vector3(h.x, h.y, -h.z)],
		[Vector3.BACK, Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z), Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z)],
		[Vector3.LEFT, Vector3(-h.x, -h.y, -h.z), Vector3(-h.x, -h.y, h.z), Vector3(-h.x, h.y, h.z), Vector3(-h.x, h.y, -h.z)],
		[Vector3.RIGHT, Vector3(h.x, -h.y, h.z), Vector3(h.x, -h.y, -h.z), Vector3(h.x, h.y, -h.z), Vector3(h.x, h.y, h.z)],
	]
	var uvs := [Vector2.ZERO, Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)]
	for f in faces:
		var n: Vector3 = f[0]
		for idx in [1, 3, 2, 1, 4, 3]:
			var v: Vector3 = center + f[idx]
			st.set_normal(n)
			# world-space planar UVs so normal maps get proper tangents
			var uv := Vector2(v.x, v.z) if absf(n.y) > 0.5 else (Vector2(v.z, -v.y) if absf(n.x) > 0.5 else Vector2(v.x, -v.y))
			st.set_uv(uv * 0.5)
			st.add_vertex(v)


func _flush_batches() -> void:
	var mats := {
		"plaster": _pbr("wall", "painted_plaster_wall", 0.45, Color(0.6, 0.64, 0.58)),
		"band": _pbr("band", "concrete_wall_008", 0.5, Color(0.27, 0.32, 0.29)),
		"trim": _flat("trim", Color(0.12, 0.1, 0.08), 0.6),
		"cap": _flat("cap", Color(0.03, 0.032, 0.035), 0.9),
		"frame": _flat("wframe", Color(0.1, 0.1, 0.1), 0.5, 0.4),
		"slat": _flat("slat", Color(0.7, 0.7, 0.66), 0.6),
		"floor_c": _pbr("floor", "concrete_floor_worn_001", 0.38, Color(0.78, 0.78, 0.76)),
		"floor_w": _pbr("floorw", "wood_floor_worn", 0.5, Color(0.7, 0.62, 0.55)),
		"rug": _pbr("rug", "dirty_carpet", 0.6, Color(0.55, 0.6, 0.5)),
		"rug2": _pbr("rug2", "dirty_carpet", 0.8, Color(0.62, 0.4, 0.33)),
	}
	for key in _batches:
		var st: SurfaceTool = _batches[key]
		st.generate_tangents()
		st.index()
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = mats.get(key, _flat("x", Color.MAGENTA))
		if key == "cap":
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if key.begins_with("floor") or key.begins_with("rug"):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
	_batches.clear()


# ------------------------------------------------------------------ shell

func _floor() -> void:
	var body := StaticBody3D.new()
	body.set_meta("surface", "concrete")
	add_child(body)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(120, 1, 120)
	cs.shape = bs
	cs.position.y = -0.5
	body.add_child(cs)
	for r in map.rooms:
		var rr: Rect2 = r["rect"]
		var key := "floor_w" if r["type"] in ["lounge", "command", "barracks"] else "floor_c"
		_add_box(key, Vector3(rr.get_center().x, -0.05, rr.get_center().y), Vector3(rr.size.x, 0.1, rr.size.y))
		if r["type"] in ["office", "command", "lounge"] and rr.size.x > 3.5 and rr.size.y > 3.5:
			var rs := Vector2(minf(rr.size.x - 1.6, 4.0), minf(rr.size.y - 1.6, 3.0))
			_add_box("rug2" if r["type"] == "lounge" else "rug", Vector3(rr.get_center().x, 0.006, rr.get_center().y), Vector3(rs.x, 0.012, rs.y))
	# entrance step
	var e: Vector2 = map.doors[0]["pos"]
	_add_box("floor_c", Vector3(e.x, -0.05, e.y + 0.9), Vector3(2.4, 0.1, 1.8))
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(120, 120)
	out.mesh = om
	out.position.y = -0.03
	out.material_override = _pbr("ground", "concrete_wall_008", 0.25, Color(0.15, 0.16, 0.17))
	out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	body.add_child(out)
	var pc := GPUParticlesCollisionBox3D.new()
	pc.size = Vector3(80, 1, 80)
	pc.position.y = -0.5
	add_child(pc)


func _walls() -> void:
	var body := StaticBody3D.new()
	body.set_meta("surface", "plaster")
	add_child(body)
	for w in map.walls:
		var a: Vector2 = w["a"]
		var b: Vector2 = w["b"]
		var h: float = w["h"]
		var y0: float = w["y0"]
		var horiz := absf(a.y - b.y) < 0.01
		var len := a.distance_to(b)
		var center := Vector3((a.x + b.x) * 0.5, y0 + h * 0.5, (a.y + b.y) * 0.5)
		var size := Vector3(len + WALL_T, h, WALL_T) if horiz else Vector3(WALL_T, h, len + WALL_T)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.position = center
		body.add_child(cs)
		if y0 < 0.01 and h > 1.0:
			var band_h := 1.05
			_add_box("band", Vector3(center.x, band_h * 0.5, center.z), Vector3(size.x + 0.02, band_h, size.z + 0.02))
			_add_box("trim", Vector3(center.x, band_h + 0.02, center.z), Vector3(size.x + 0.04, 0.05, size.z + 0.04))
			_add_box("plaster", Vector3(center.x, band_h + (h - band_h) * 0.5, center.z), Vector3(size.x, h - band_h, size.z))
		else:
			_add_box("band" if y0 < 0.01 else "plaster", center, size)
		_add_box("cap", Vector3(center.x, y0 + h + 0.004, center.z), Vector3(size.x + 0.002, 0.008, size.z + 0.002))
		var r := Rect2(Vector2(center.x - size.x * 0.5, center.z - size.z * 0.5), Vector2(size.x, size.z))
		if y0 < 0.01:
			footprints.append(r)
			if not w["outer"]:
				cover_sources.append(r)
	# door frames
	for d in map.doors:
		var p: Vector2 = d["pos"]
		var half: float = d["w"] * 0.5
		for s in [-1.0, 1.0]:
			if d["axis"] == "x":
				_add_box("trim", Vector3(p.x, 1.1, p.y + s * half), Vector3(WALL_T + 0.06, 2.2, 0.08))
			else:
				_add_box("trim", Vector3(p.x + s * half, 1.1, p.y), Vector3(0.08, 2.2, WALL_T + 0.06))
		if not d["entrance"]:
			var lintel := Vector3(WALL_T, 0.4, d["w"]) if d["axis"] == "x" else Vector3(d["w"], 0.4, WALL_T)
			_add_box("plaster", Vector3(p.x, 2.4, p.y), lintel)
			_add_box("cap", Vector3(p.x, 2.604, p.y), lintel + Vector3(0.002, -0.39, 0.002))
			var lc := CollisionShape3D.new()
			var lb := BoxShape3D.new()
			lb.size = lintel
			lc.shape = lb
			lc.position = Vector3(p.x, 2.4, p.y)
			body.add_child(lc)


func _windows() -> void:
	for w in map.windows:
		var cx: float = (w["x0"] + w["x1"]) * 0.5
		var z: float = w["z"]
		var wl: float = w["x1"] - w["x0"]
		_add_box("frame", Vector3(cx, 0.92, z), Vector3(wl, 0.05, WALL_T + 0.06))
		_add_box("frame", Vector3(cx, 2.18, z), Vector3(wl, 0.05, WALL_T + 0.06))
		_add_box("frame", Vector3(cx, 1.55, z), Vector3(0.04, 1.26, WALL_T))
		for i in 13:
			_add_box("slat", Vector3(cx, 1.0 + i * 0.09, z + 0.05), Vector3(wl - 0.06, 0.014, 0.06))
		var sky := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(wl, 1.3)
		sky.mesh = qm
		sky.material_override = _sky_mat()
		sky.position = Vector3(cx, 1.55, z - 0.4)
		add_child(sky)
		if Game.quality >= 1:
			var moon := SpotLight3D.new()
			add_child(moon)
			moon.position = Vector3(cx + 0.5, 3.8, z - 2.8)
			moon.look_at(Vector3(cx - 0.3, 0.0, z + 2.6), Vector3.UP)
			moon.light_color = Color(0.62, 0.74, 1.0)
			moon.light_energy = 6.0
			moon.spot_range = 9.0
			moon.spot_angle = 20.0
			moon.light_volumetric_fog_energy = 2.5
			moon.shadow_enabled = Game.quality >= 2


func _sky_mat() -> StandardMaterial3D:
	if not _mats.has("sky"):
		var sm := StandardMaterial3D.new()
		sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		sm.albedo_color = Color(0.12, 0.18, 0.32)
		_mats["sky"] = sm
	return _mats["sky"]


func _doors() -> void:
	for d in map.doors:
		if not d["leaf"]:
			continue
		var p: Vector2 = d["pos"]
		var w: float = d["w"] - 0.06
		var door := RigidBody3D.new()
		door.mass = 16.0
		door.collision_layer = 16
		door.collision_mask = 2 | 4 | 8
		door.angular_damp = 3.0
		door.can_sleep = true
		door.set_meta("surface", "wood")
		door.add_to_group("physics_props")
		var hinge: Vector3
		var yaw: float
		if d["axis"] == "x":
			hinge = Vector3(p.x, 0, p.y - d["w"] * 0.5 + 0.03)
			yaw = 0.0
		else:
			hinge = Vector3(p.x - d["w"] * 0.5 + 0.03, 0, p.y)
			yaw = -PI / 2
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(0.05, 2.1, w)
		cs.shape = bs
		cs.position = Vector3(0, 1.06, w * 0.5)
		door.add_child(cs)
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = bs.size
		mi.mesh = bm
		mi.position = cs.position
		mi.material_override = _pbr("doorwood", "wood_floor_worn", 1.2, Color(0.55, 0.42, 0.3))
		door.add_child(mi)
		var knob := MeshInstance3D.new()
		var km := BoxMesh.new()
		km.size = Vector3(0.12, 0.03, 0.03)
		knob.mesh = km
		knob.position = Vector3(0, 1.0, w - 0.1)
		knob.material_override = _flat("brass", Color(0.7, 0.55, 0.3), 0.3, 1.0)
		door.add_child(knob)
		door.position = hinge
		door.rotation.y = yaw + deg_to_rad(randf_range(-40, 40))
		add_child(door)
		var anchor := StaticBody3D.new()
		anchor.collision_layer = 0
		anchor.position = hinge
		add_child(anchor)
		var j := HingeJoint3D.new()
		j.position = hinge
		j.rotation.x = -PI / 2
		add_child(j)
		j.node_a = j.get_path_to(anchor)
		j.node_b = j.get_path_to(door)
		j.set_flag(HingeJoint3D.FLAG_USE_LIMIT, true)
		j.set_param(HingeJoint3D.PARAM_LIMIT_UPPER, deg_to_rad(100))
		j.set_param(HingeJoint3D.PARAM_LIMIT_LOWER, deg_to_rad(-100))


# ------------------------------------------------------------------ props

func _props() -> void:
	for e in map.props:
		var n := prop(e["id"], e["pos"], e["yaw"], e["opts"])
		if e["opts"].get("intel", false):
			intel_props.append(n)
	_flush_batches()


## Loads a Poly Haven glTF prop and wraps it in a static or rigid body with a fitted box.
func prop(id: String, pos: Vector3, yaw_deg: float, opts := {}) -> Node3D:
	var sc: float = opts.get("scale", 1.0)
	var inst: Node3D = load("res://assets/props/%s/%s.gltf" % [id, id]).instantiate()
	inst.scale = Vector3.ONE * sc
	var ab := _local_aabb(inst)
	var dyn: bool = opts.get("dynamic", false)
	var body: PhysicsBody3D
	if dyn:
		var rb := RigidBody3D.new()
		rb.mass = opts.get("mass", 5.0)
		rb.collision_layer = 4
		rb.collision_mask = 1 | 2 | 4 | 8 | 16
		rb.linear_damp = 0.3
		rb.angular_damp = 0.8
		rb.add_to_group("physics_props")
		body = rb
	else:
		body = StaticBody3D.new()
		body.collision_layer = 1
	body.set_meta("surface", opts.get("surface", "wood"))
	body.add_child(inst)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = ab.size.max(Vector3.ONE * 0.04)
	cs.shape = bs
	cs.position = ab.get_center()
	body.add_child(cs)
	body.position = pos
	body.rotation.y = deg_to_rad(yaw_deg)
	add_child(body)
	for m in inst.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (not dyn or ab.size.y > 0.4) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visibility_range_end = 0.0
	if not dyn and pos.y < 0.05:
		var r := _xz_rect(body.transform, ab)
		footprints.append(r)
		if ab.size.y > 0.4:
			cover_sources.append(r)
	return body


func _local_aabb(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	for m in root.find_children("*", "MeshInstance3D", true, false):
		var xf := Transform3D()
		var n: Node = m
		while n != null and n != root.get_parent():
			if n is Node3D:
				xf = (n as Node3D).transform * xf
			if n == root:
				break
			n = n.get_parent()
		var b := xf * (m as MeshInstance3D).get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out


func _xz_rect(xf: Transform3D, ab: AABB) -> Rect2:
	var mn := Vector2(1e9, 1e9)
	var mx := Vector2(-1e9, -1e9)
	for i in 8:
		var p := xf * ab.get_endpoint(i)
		mn = Vector2(minf(mn.x, p.x), minf(mn.y, p.z))
		mx = Vector2(maxf(mx.x, p.x), maxf(mx.y, p.z))
	return Rect2(mn, mx - mn)


# ------------------------------------------------------------------ lights

func _lights() -> void:
	var shade_mat := _flat("lampshade", Color(0.42, 0.46, 0.42), 0.4, 0.7)
	var bulb_mat := StandardMaterial3D.new()
	bulb_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bulb_mat.albedo_color = Color(4.0, 3.4, 2.4)
	for L in map.lights:
		var p: Vector3 = L["pos"]
		var o := OmniLight3D.new()
		o.position = p
		o.light_color = L["color"]
		o.light_energy = L["energy"]
		o.omni_range = L["range"]
		o.omni_attenuation = 1.2
		o.light_volumetric_fog_energy = 0.4
		o.shadow_enabled = false
		add_child(o)
		lamps.append(o)
		if L["flicker"]:
			_flicker.append([o, L["energy"], randf() * 10.0])
		# simple pendant lamp: cord + shade + glowing bulb
		var shade := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.06
		cm.bottom_radius = 0.2
		cm.height = 0.16
		cm.radial_segments = 14
		cm.rings = 1
		shade.mesh = cm
		shade.material_override = shade_mat
		shade.position = p + Vector3(0, 0.12, 0)
		shade.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(shade)
		var bulb := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.07
		sm.height = 0.12
		sm.radial_segments = 8
		sm.rings = 4
		bulb.mesh = sm
		bulb.material_override = bulb_mat
		bulb.position = p + Vector3(0, 0.02, 0)
		bulb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(bulb)
	# light spilling in from the street at the entrance
	var e: Vector2 = map.doors[0]["pos"]
	var street := OmniLight3D.new()
	street.position = Vector3(e.x, 2.0, e.y + 3.0)
	street.light_color = Color(1.0, 0.75, 0.45)
	street.light_energy = 1.6
	street.omni_range = 6.0
	add_child(street)


func _process(_delta: float) -> void:
	var t := Time.get_ticks_msec() * 0.001
	for f in _flicker:
		var o: OmniLight3D = f[0]
		var k := sin(t * 13.0 + f[2]) * sin(t * 7.3 + f[2] * 2.0)
		o.light_energy = f[1] * (0.25 if k > 0.75 else 1.0)


# ------------------------------------------------------------------ navigation & cover

func _build_nav() -> void:
	var b := map.bounds.grow(2.5)
	_origin = b.position
	nav.region = Rect2i(0, 0, int(b.size.x / CELL), int(b.size.y / CELL))
	nav.cell_size = Vector2(CELL, CELL)
	nav.offset = b.position + Vector2(CELL * 0.5, CELL * 0.5)
	nav.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	nav.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	nav.update()
	var inflate := 0.36
	var grown: Array[Rect2] = []
	for r in footprints:
		grown.append(r.grow(inflate))
	for x in nav.region.size.x:
		for y in nav.region.size.y:
			var p := nav.get_point_position(Vector2i(x, y))
			for r in grown:
				if r.has_point(p):
					nav.set_point_solid(Vector2i(x, y), true)
					break


func to_cell(p: Vector3) -> Vector2i:
	return Vector2i(clampi(int((p.x - _origin.x) / CELL), 0, nav.region.size.x - 1), clampi(int((p.z - _origin.y) / CELL), 0, nav.region.size.y - 1))


func free_cell(c: Vector2i) -> Vector2i:
	if not nav.is_point_solid(c):
		return c
	for r in range(1, 12):
		for dx in range(-r, r + 1):
			for dy in range(-r, r + 1):
				var n := c + Vector2i(dx, dy)
				if nav.is_in_boundsv(n) and not nav.is_point_solid(n):
					return n
	return c


func find_path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var a := free_cell(to_cell(from))
	var b := free_cell(to_cell(to))
	var ids := nav.get_id_path(a, b, true)
	var pts: Array[Vector3] = [from]
	for id in ids:
		var p := nav.get_point_position(id)
		pts.append(Vector3(p.x, 0, p.y))
	if not nav.is_point_solid(to_cell(to)):
		pts.append(Vector3(to.x, 0, to.z))
	var out := PackedVector3Array()
	var i := 0
	while i < pts.size() - 1:
		var j := pts.size() - 1
		while j > i + 1 and not walkable(pts[i], pts[j]):
			j -= 1
		out.append(pts[j])
		i = j
	return out


func walkable(a: Vector3, b: Vector3) -> bool:
	var n := int(ceil(a.distance_to(b) / (CELL * 0.5)))
	for k in range(1, n + 1):
		if nav.is_point_solid(to_cell(a.lerp(b, float(k) / n))):
			return false
	return true


func cover_points() -> Array[Vector3]:
	if not _cover_cache.is_empty():
		return _cover_cache
	var out: Array[Vector3] = []
	for r in cover_sources:
		var g := r.grow(0.5)
		var step := 0.5
		var x := g.position.x
		while x <= g.end.x + 0.01:
			out.append(Vector3(x, 0, g.position.y))
			out.append(Vector3(x, 0, g.end.y))
			x += step
		var z := g.position.y + step
		while z < g.end.y - 0.01:
			out.append(Vector3(g.position.x, 0, z))
			out.append(Vector3(g.end.x, 0, z))
			z += step
	var bb := map.bounds.grow(-0.4)
	for p in out:
		if bb.has_point(Vector2(p.x, p.z)) and not nav.is_point_solid(to_cell(p)):
			_cover_cache.append(p)
	return _cover_cache


func room_at(p: Vector3) -> int:
	for i in map.rooms.size():
		if (map.rooms[i]["rect"] as Rect2).has_point(Vector2(p.x, p.z)):
			return i
	return -1
