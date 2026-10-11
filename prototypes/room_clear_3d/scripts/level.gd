class_name Level
extends Node3D
## The safehouse: two rooms split by a partition with a hinged physical door, scanned
## PBR furniture (Poly Haven, CC0), a window with moonlight falling through the blinds,
## hanging lamps, physics clutter, and the data the AI needs (nav grid, cover, patrol).

const X0 := -9.0
const X1 := 9.0
const Z0 := -5.5
const Z1 := 5.5
const WALL_T := 0.3
const WALL_H := 2.7
const PART_X := 2.9          # partition wall x (west face)
const DOOR_Z0 := -0.78
const DOOR_Z1 := 0.78
const CELL := 0.25

var nav := AStarGrid2D.new()
var footprints: Array[Rect2] = []     # static cover/obstacles (xz), for nav + cover search
var cover_sources: Array[Rect2] = []
var patrol: Array[Vector3] = [
	Vector3(7.6, 0, -3.6), Vector3(7.9, 0, 3.4), Vector3(4.3, 0, 3.6), Vector3(4.2, 0, -3.2),
	Vector3(3.6, 0, 0.0), Vector3(1.0, 0, -1.8), Vector3(-0.8, 0, 1.6), Vector3(1.6, 0, 2.4), Vector3(3.6, 0, 0.0),
]
var player_spawn := Vector3(-7.7, 0, 3.7)
var enemy_spawn := Vector3(7.4, 0, -1.6)
var lamps: Array[SpotLight3D] = []
var beacon: OmniLight3D
var door: RigidBody3D

var _mats := {}
var _mobile := false


func build() -> void:
	_mobile = OS.has_feature("mobile") or OS.has_feature("web")
	_floor()
	_walls()
	_window()
	_furniture()
	_door()
	_lights()
	_build_nav()


# ------------------------------------------------------------------ materials

func _pbr(key: String, dir: String, scale: float, tint := Color.WHITE, rough_mul := 1.0) -> StandardMaterial3D:
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
	m.roughness = rough_mul
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


# ------------------------------------------------------------------ shell

func _floor() -> void:
	var body := StaticBody3D.new()
	body.set_meta("surface", "concrete")
	add_child(body)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(60, 1, 60)
	cs.shape = bs
	cs.position.y = -0.5
	body.add_child(cs)
	# interior floor
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(X1 - X0, Z1 - Z0)
	mi.mesh = pm
	mi.position = Vector3((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5)
	mi.material_override = _pbr("floor", "concrete_floor_worn_001", 0.38, Color(0.78, 0.78, 0.76))
	body.add_child(mi)
	# outside: dark ground
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(60, 60)
	out.mesh = om
	out.position.y = -0.02
	out.material_override = _pbr("ground", "concrete_wall_008", 0.25, Color(0.16, 0.17, 0.18))
	body.add_child(out)
	# rugs
	_slab(Vector3(-3.6, 0.006, -0.55), Vector3(3.8, 0.012, 2.9), _pbr("rug", "dirty_carpet", 0.6, Color(0.55, 0.6, 0.5)), false)
	_slab(Vector3(-6.6, 0.006, -4.0), Vector3(2.6, 0.012, 2.0), _pbr("rug2", "dirty_carpet", 0.8, Color(0.6, 0.38, 0.32)), false)
	# particles bounce on the floor
	var pc := GPUParticlesCollisionBox3D.new()
	pc.size = Vector3(40, 1, 40)
	pc.position.y = -0.5
	add_child(pc)


func _walls() -> void:
	var t := WALL_T
	# north wall has a window gap (built in _window); west wall has the entry gap
	_wall(Rect2(X0 - t, Z0 - t, -2.45 - (X0 - t), t), WALL_H)
	_wall(Rect2(-0.75, Z0 - t, X1 + t - -0.75, t), WALL_H)
	_wall(Rect2(X0 - t, Z0, t, 2.4 - Z0), WALL_H)                 # west, north of the entry
	_wall(Rect2(X0 - t, 3.75, t, Z1 + t - 3.75), WALL_H)          # west, south of the entry
	_wall(Rect2(X0 - t, 2.4, t, 1.35), WALL_H - 2.15, 2.15)       # lintel over the entry
	_wall(Rect2(X1, Z0, t, Z1 - Z0), WALL_H)
	_wall(Rect2(X0 - t, Z1, X1 - X0 + 2 * t, t), 0.55)            # south wall cut away for the camera
	# partition with doorway
	_wall(Rect2(PART_X, Z0, t, DOOR_Z0 - Z0), WALL_H, 0.0, true)
	_wall(Rect2(PART_X, DOOR_Z1, t, Z1 - DOOR_Z1), WALL_H, 0.0, true)
	_wall(Rect2(PART_X, DOOR_Z0, t, DOOR_Z1 - DOOR_Z0), WALL_H - 2.2, 2.2)
	# door frame trims
	var trim := _flat("trim", Color(0.12, 0.1, 0.08), 0.6)
	for z in [DOOR_Z0, DOOR_Z1]:
		_slab(Vector3(PART_X + t * 0.5, 1.1, z), Vector3(t + 0.06, 2.2, 0.08), trim, false)
	for z in [2.4, 3.75]:
		_slab(Vector3(X0 - t * 0.5, 1.1, z), Vector3(t + 0.06, 2.2, 0.08), trim, false)
	# the open entry door leaf (player came in this way)
	var leaf := _slab(Vector3(X0 + 0.65, 1.05, 2.42), Vector3(1.25, 2.1, 0.05), _pbr("doorwood", "wood_floor_worn", 1.2, Color(0.55, 0.42, 0.3)), true)
	leaf.rotation.y = 0.12
	leaf.set_meta("surface", "wood")
	# entry corridor beyond the door: a dark slab with a faint light
	var cl := OmniLight3D.new()
	cl.position = Vector3(X0 - 1.6, 1.8, 3.1)
	cl.light_color = Color(0.9, 0.8, 0.62)
	cl.light_energy = 0.8
	cl.omni_range = 3.5
	add_child(cl)


func _wall(r: Rect2, h: float, y0 := 0.0, cover := false) -> void:
	var body := StaticBody3D.new()
	body.set_meta("surface", "plaster")
	add_child(body)
	var size := Vector3(r.size.x, h, r.size.y)
	var center := Vector3(r.position.x + r.size.x * 0.5, y0 + h * 0.5, r.position.y + r.size.y * 0.5)
	body.position = center
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _pbr("wall", "painted_plaster_wall", 0.45, Color(0.62, 0.66, 0.6))
	body.add_child(mi)
	# dark painted lower band + trim line, and a dark cap that reads as a cut section from above
	if y0 < 0.01 and h > 1.0:
		var band := MeshInstance3D.new()
		var bb := BoxMesh.new()
		bb.size = Vector3(size.x + 0.02, 1.05, size.z + 0.02)
		band.mesh = bb
		band.position.y = -h * 0.5 + 0.525
		band.material_override = _pbr("band", "concrete_wall_008", 0.5, Color(0.28, 0.33, 0.3))
		body.add_child(band)
		var line := MeshInstance3D.new()
		var lb := BoxMesh.new()
		lb.size = Vector3(size.x + 0.04, 0.05, size.z + 0.04)
		line.mesh = lb
		line.position.y = -h * 0.5 + 1.07
		line.material_override = _flat("line", Color(0.16, 0.14, 0.11), 0.5)
		body.add_child(line)
	var cap := MeshInstance3D.new()
	var cb := BoxMesh.new()
	cb.size = Vector3(size.x + 0.002, 0.01, size.z + 0.002)
	cap.mesh = cb
	cap.position.y = h * 0.5
	cap.material_override = _flat("cap", Color(0.035, 0.037, 0.04), 0.9)
	cap.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	body.add_child(cap)
	if y0 < 0.01:
		footprints.append(r)
		if cover:
			cover_sources.append(r)


func _slab(pos: Vector3, size: Vector3, mat: Material, collide: bool) -> Node3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	if not collide:
		mi.position = pos
		add_child(mi)
		return mi
	var body := StaticBody3D.new()
	body.position = pos
	add_child(body)
	body.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	return body


func _window() -> void:
	# opening in the north wall between x = -2.45 and -0.75, sill at 0.9, head at 2.2
	var x0 := -2.45
	var x1 := -0.75
	var t := WALL_T
	_wall(Rect2(x0, Z0 - t, x1 - x0, t), 0.9)
	_wall(Rect2(x0, Z0 - t, x1 - x0, t), WALL_H - 2.2, 2.2)
	var frame := _flat("wframe", Color(0.1, 0.1, 0.1), 0.5, 0.4)
	var cx := (x0 + x1) * 0.5
	var z := Z0 - t * 0.5
	_slab(Vector3(cx, 0.92, z), Vector3(x1 - x0, 0.05, t + 0.06), frame, false)
	_slab(Vector3(cx, 2.18, z), Vector3(x1 - x0, 0.05, t + 0.06), frame, false)
	_slab(Vector3(cx, 1.55, z), Vector3(0.04, 1.26, t), frame, false)
	# blinds: slats that throw moonlight stripes across the floor
	var slat := _flat("slat", Color(0.7, 0.7, 0.66), 0.6)
	for i in 14:
		var s := _slab(Vector3(cx, 1.0 + i * 0.085, z + 0.05), Vector3(x1 - x0 - 0.06, 0.012, 0.07), slat, false)
		s.rotation.x = 0.55
	# night outside
	var sky := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(4, 3)
	sky.mesh = qm
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.albedo_color = Color(0.1, 0.16, 0.3)
	sky.material_override = sm
	sky.position = Vector3(cx, 1.5, Z0 - 1.6)
	add_child(sky)
	var moon := SpotLight3D.new()
	add_child(moon)
	moon.position = Vector3(cx + 0.6, 4.0, Z0 - 3.2)
	moon.look_at(Vector3(cx - 0.4, 0.0, Z0 + 2.4), Vector3.UP)
	moon.light_color = Color(0.62, 0.74, 1.0)
	moon.light_energy = 9.0
	moon.spot_range = 12.0
	moon.spot_angle = 22.0
	moon.spot_attenuation = 0.5
	moon.light_volumetric_fog_energy = 3.0
	moon.shadow_enabled = true
	moon.shadow_blur = 0.6


# ------------------------------------------------------------------ props

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
		rb.collision_mask = 1 | 2 | 4 | 8
		rb.linear_damp = 0.3
		rb.angular_damp = 0.8
		rb.can_sleep = true
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
		(m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	if not dyn and opts.get("block", true):
		var r := _xz_rect(body.transform, ab)
		footprints.append(r)
		if opts.get("cover", true):
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


func _furniture() -> void:
	# --- west room: briefing desk, lounge, supply crates
	var desk := prop("metal_office_desk", Vector3(-3.6, 0, -0.55), 0, {"surface": "metal"})
	prop("classic_laptop", Vector3(-3.95, 0.79, -0.6), 15, {"dynamic": true, "mass": 2.5, "surface": "metal", "scale": 0.75})
	prop("binder_notebook", Vector3(-3.0, 0.79, -0.45), -30, {"dynamic": true, "mass": 0.6})
	prop("ammo_box", Vector3(-2.85, 0.79, -0.85), 80, {"dynamic": true, "mass": 2.0, "surface": "metal", "scale": 1.6})
	prop("medical_box", Vector3(-4.3, 0.79, -0.35), 10, {"dynamic": true, "mass": 1.0, "surface": "metal"})
	prop("plastic_monobloc_chair_01", Vector3(-3.3, 0, 0.45), 165, {"dynamic": true, "mass": 4.0, "surface": "fabric"})
	prop("plastic_monobloc_chair_01", Vector3(-4.3, 0, -1.55), 15, {"dynamic": true, "mass": 4.0, "surface": "fabric"})
	desk.set_meta("label", "table")
	prop("Sofa_01", Vector3(-6.6, 0, -5.08), 0, {"surface": "fabric"})
	prop("WoodenTable_01", Vector3(-6.6, 0, -3.75), 0, {"surface": "wood"})
	prop("Television_01", Vector3(-6.45, 0.55, -3.8), 180, {"dynamic": true, "mass": 8.0, "surface": "metal", "scale": 0.9})
	prop("potted_plant_04", Vector3(-8.5, 0, -5.0), 0, {"scale": 3.2, "block": false, "surface": "fabric"})
	prop("wooden_military_crate", Vector3(-0.6, 0, 3.95), 90, {"surface": "wood"})
	prop("wooden_military_crate", Vector3(-0.6, 0.465, 3.95), 92, {"surface": "wood", "block": false})
	prop("wooden_crate_01", Vector3(0.75, 0, 4.25), 10, {"surface": "wood"})
	prop("metal_jerrycan_green", Vector3(0.65, 0.35, 4.3), 70, {"dynamic": true, "mass": 6.0, "surface": "metal"})
	prop("metal_jerrycan_green", Vector3(-1.35, 0, 4.7), -20, {"dynamic": true, "mass": 6.0, "surface": "metal"})
	prop("Barrel_01", Vector3(2.15, 0, -4.75), 0, {"surface": "metal"})
	prop("Barrel_01", Vector3(1.45, 0, -4.95), 40, {"surface": "metal"})
	# --- east room: storage and the target's post
	prop("steel_frame_shelves_01", Vector3(4.6, 0, -5.18), 0, {"scale": 0.1, "surface": "metal"})
	prop("steel_frame_shelves_01", Vector3(5.75, 0, -5.18), 0, {"scale": 0.1, "surface": "metal"})
	prop("ammo_box", Vector3(4.5, 0.96, -5.2), 90, {"dynamic": true, "mass": 2.0, "surface": "metal", "scale": 1.6})
	prop("ammo_box", Vector3(5.8, 0.96, -5.15), 95, {"dynamic": true, "mass": 2.0, "surface": "metal", "scale": 1.6})
	prop("metal_jerrycan_green", Vector3(4.6, 0.02, -5.15), 0, {"dynamic": true, "mass": 6.0, "surface": "metal"})
	var cab := prop("modern_wooden_cabinet", Vector3(6.3, 0, 1.15), 90, {"surface": "wood"})
	cab.set_meta("label", "cabinet")
	prop("binder_notebook", Vector3(6.25, 0.68, 0.4), 60, {"dynamic": true, "mass": 0.6})
	prop("old_military_crate", Vector3(8.15, 0, -2.4), 90, {"surface": "wood"})
	prop("wooden_military_crate", Vector3(8.2, 0, 1.1), 90, {"surface": "wood"})
	prop("Barrel_01", Vector3(8.3, 0, 4.65), 0, {"surface": "metal"})
	prop("Barrel_01", Vector3(7.55, 0, 4.95), 60, {"surface": "metal"})
	prop("wooden_crate_01", Vector3(4.2, 0, 4.85), 0, {"surface": "wood"})
	prop("security_camera_01", Vector3(8.7, 2.45, -5.25), -135, {"block": false, "surface": "metal"})


func _door() -> void:
	# a real hinged door: bodies push it, bullets knock it
	door = RigidBody3D.new()
	door.mass = 18.0
	door.collision_layer = 16      # pushed by bodies; sight and bullets go through (thin wood)
	door.collision_mask = 2 | 4 | 8
	door.angular_damp = 3.0
	door.can_sleep = false
	door.set_meta("surface", "wood")
	var w := DOOR_Z1 - DOOR_Z0 - 0.06
	var hinge := Vector3(PART_X + WALL_T * 0.5, 0, DOOR_Z0 + 0.03)
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
	var km := SphereMesh.new()
	km.radius = 0.035
	km.height = 0.07
	knob.mesh = km
	knob.position = Vector3(0, 1.0, w - 0.1)
	knob.scale = Vector3(4.0, 1, 1)
	knob.material_override = _flat("brass", Color(0.7, 0.55, 0.3), 0.3, 1.0)
	door.add_child(knob)
	door.position = hinge
	door.rotation.y = deg_to_rad(-35.0)
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


func _lights() -> void:
	_lamp(Vector3(-3.6, 0, -0.55), 7.5, true)
	_lamp(Vector3(6.2, 0, 1.0), 6.5, true)
	_lamp(Vector3(-6.6, 0, -3.9), 4.0, not _mobile)
	_lamp(Vector3(5.2, 0, -3.8), 3.0, false)
	# red beacon in the east room
	beacon = OmniLight3D.new()
	beacon.position = Vector3(8.75, 2.2, 4.4)
	beacon.light_color = Color(1.0, 0.12, 0.06)
	beacon.light_energy = 2.0
	beacon.omni_range = 6.0
	beacon.light_volumetric_fog_energy = 1.5
	add_child(beacon)
	var bm := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.07
	sm.height = 0.1
	bm.mesh = sm
	var em := StandardMaterial3D.new()
	em.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	em.albedo_color = Color(4.0, 0.3, 0.2)
	bm.material_override = em
	bm.position = Vector3(8.95, 2.2, 4.4)
	add_child(bm)


func _lamp(at: Vector3, energy: float, shadow: bool) -> void:
	var l := prop("hanging_industrial_lamp", Vector3(at.x, 3.45, at.z), 0, {"block": false, "surface": "metal"})
	l.collision_layer = 0
	for m in l.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var s := SpotLight3D.new()
	s.position = Vector3(at.x, 2.08, at.z)
	s.rotation.x = -PI / 2
	s.spot_angle = 62.0
	s.spot_angle_attenuation = 1.3
	s.spot_range = 6.5
	s.light_energy = energy
	s.light_color = Color(1.0, 0.8, 0.56)
	s.light_volumetric_fog_energy = 0.6
	s.shadow_enabled = shadow
	s.shadow_blur = 1.5
	add_child(s)
	lamps.append(s)
	var bulb := OmniLight3D.new()
	bulb.position = s.position + Vector3(0, 0.12, 0)
	bulb.light_color = s.light_color
	bulb.light_energy = 0.5
	bulb.omni_range = 1.4
	add_child(bulb)


func _process(_delta: float) -> void:
	if beacon:
		var t := Time.get_ticks_msec() * 0.001
		beacon.light_energy = 0.4 + 2.2 * pow(maxf(sin(t * 4.0), 0.0), 3.0)


# ------------------------------------------------------------------ navigation & cover

func _build_nav() -> void:
	nav.region = Rect2i(0, 0, int((X1 - X0) / CELL), int((Z1 - Z0) / CELL))
	nav.cell_size = Vector2(CELL, CELL)
	nav.offset = Vector2(X0 + CELL * 0.5, Z0 + CELL * 0.5)
	nav.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	nav.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	nav.update()
	var inflate := 0.36
	for x in nav.region.size.x:
		for y in nav.region.size.y:
			var p := nav.get_point_position(Vector2i(x, y))
			var solid := p.x < X0 + inflate or p.x > X1 - inflate or p.y < Z0 + inflate or p.y > Z1 - inflate
			if not solid:
				for r in footprints:
					if r.grow(inflate).has_point(p):
						solid = true
						break
			nav.set_point_solid(Vector2i(x, y), solid)


func to_cell(p: Vector3) -> Vector2i:
	return Vector2i(clampi(int((p.x - X0) / CELL), 0, nav.region.size.x - 1), clampi(int((p.z - Z0) / CELL), 0, nav.region.size.y - 1))


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
	# string pulling over the grid
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
		var p := a.lerp(b, float(k) / n)
		if nav.is_point_solid(to_cell(p)):
			return false
	return true


## Candidate cover spots around furniture and the partition, as points on the floor.
func cover_points() -> Array[Vector3]:
	var out: Array[Vector3] = []
	for r in cover_sources:
		var g := r.grow(0.5)
		var step := 0.4
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
	var ok: Array[Vector3] = []
	for p in out:
		if p.x > X0 + 0.4 and p.x < X1 - 0.4 and p.z > Z0 + 0.4 and p.z < Z1 - 0.4 and not nav.is_point_solid(to_cell(p)):
			ok.append(p)
	return ok
