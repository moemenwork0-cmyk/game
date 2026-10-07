class_name ShipBuilder
extends RefCounted
## Builds the Murjan: a small coastal cargo ship (hull lofted from cross-sections,
## bridge, mast, deck containers). Local space: bow toward -Z, keel at y = 0.

const LENGTH := 26.0
const BEAM := 7.0
const DEPTH := 5.0


static func hull_material() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Mats.noise_tex(0.03, 256, false, 8.0, 5,
		Mats.gradient([Color(0.55, 0.35, 0.25), Color(1, 1, 1), Color(1, 1, 1), Color(0.6, 0.38, 0.25)], [0.0, 0.3, 0.7, 1.0]))
	m.uv1_triplanar = true
	m.uv1_scale = Vector3(0.12, 0.35, 0.12)
	m.metallic = 0.45
	m.roughness = 0.72
	m.normal_enabled = true
	m.normal_texture = Mats.noise_tex(0.05, 256, true, 3.0, 4)
	m.normal_scale = 0.4
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


static func _half_width(s: float) -> float:
	# s = 0 at the stern, 1 at the bow
	var w := BEAM * 0.5
	if s > 0.68:
		var u := (s - 0.68) / 0.32
		w *= sqrt(maxf(1.0 - u * u, 0.0))
	if s < 0.04:
		w *= 0.85 + s / 0.04 * 0.15
	return w


static func _keel(s: float) -> float:
	return pow(maxf(s - 0.78, 0.0) / 0.22, 2.0) * 2.6


static func build_hull() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var stations := 26
	var profile := [Vector2(-1.0, 1.0), Vector2(-1.0, 0.22), Vector2(-0.92, 0.07), Vector2(-0.7, 0.0),
		Vector2(-0.25, -0.02), Vector2(0.25, -0.02), Vector2(0.7, 0.0), Vector2(0.92, 0.07), Vector2(1.0, 0.22), Vector2(1.0, 1.0)]
	var rings: Array = []
	for i in stations + 1:
		var s := float(i) / stations
		var z := lerpf(LENGTH * 0.5, -LENGTH * 0.5, s)
		var w := _half_width(s)
		var k := _keel(s)
		var deck := DEPTH + s * s * 0.8   # deck sheer rises toward the bow
		var ring: Array = []
		for p: Vector2 in profile:
			var y: float = k + p.y * (deck - k) if p.y > 0.5 else k + p.y * 2.0 * (1.0 - k / 3.0)
			if p.y >= 0.99:
				y = deck
			ring.append(Vector3(p.x * maxf(w, 0.02), y, z))
		rings.append(ring)
	for i in stations:
		for j in profile.size() - 1:
			var a: Vector3 = rings[i][j]
			var b: Vector3 = rings[i][j + 1]
			var c: Vector3 = rings[i + 1][j + 1]
			var d: Vector3 = rings[i + 1][j]
			_quad(st, a, b, c, d)
	# deck
	for i in stations:
		var a: Vector3 = rings[i][0]
		var b: Vector3 = rings[i][profile.size() - 1]
		var c: Vector3 = rings[i + 1][profile.size() - 1]
		var d: Vector3 = rings[i + 1][0]
		_quad(st, a, d, c, b, Color(0.32, 0.3, 0.27))
	# transom
	var r0: Array = rings[0]
	for j in range(1, profile.size() - 1):
		_tri(st, r0[0], r0[j + 1], r0[j])
	st.generate_normals()
	return st.commit()


static func _hull_color(p: Vector3) -> Color:
	# red antifouling below the waterline, dark navy above, a white boot stripe between
	if p.y < 2.2:
		return Color(0.42, 0.08, 0.06)
	if p.y < 2.45:
		return Color(0.85, 0.85, 0.82)
	return Color(0.07, 0.1, 0.16)


static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color = Color(-1, 0, 0)) -> void:
	_tri(st, a, b, c, col)
	_tri(st, a, c, d, col)


static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color = Color(-1, 0, 0)) -> void:
	for v in [a, b, c]:
		st.set_color(_hull_color(v) if col.r < 0.0 else col)
		st.add_vertex(v)


## Full ship: hull + superstructure + containers. Returns a Node3D (no physics).
static func build_ship(rng: RandomNumberGenerator, wrecked: bool) -> Node3D:
	var root := Node3D.new()
	var hull := MeshInstance3D.new()
	hull.mesh = build_hull()
	var hm := hull_material()
	hull.material_override = hm
	hull.name = "Hull"
	root.add_child(hull)
	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.82, 0.82, 0.8)
	white.roughness = 0.6
	white.metallic = 0.2
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.05, 0.07, 0.09)
	glass.roughness = 0.1
	glass.metallic = 0.6
	if not wrecked:
		glass.emission_enabled = true
		glass.emission = Color(1.0, 0.8, 0.5)
		glass.emission_energy_multiplier = 1.5
	# bridge at the stern
	_box(root, Vector3(6.0, 2.8, 4.5), Vector3(0, DEPTH + 1.4, 9.0), white)
	_box(root, Vector3(5.0, 2.2, 3.5), Vector3(0, DEPTH + 3.9, 9.4), white)
	_box(root, Vector3(4.8, 0.9, 0.08), Vector3(0, DEPTH + 4.2, 7.62), glass)
	_box(root, Vector3(0.5, 3.0, 0.5), Vector3(0, DEPTH + 6.5, 10.0), hm)
	# mast and boom
	_box(root, Vector3(0.35, 7.5, 0.35), Vector3(0, DEPTH + 3.7, -6.0), hm)
	_box(root, Vector3(0.18, 0.18, 6.0), Vector3(0, DEPTH + 6.0, -3.5), hm, Vector3(0.35, 0, 0))
	# containers
	var colors := [Color(0.55, 0.12, 0.08), Color(0.1, 0.25, 0.45), Color(0.15, 0.35, 0.18), Color(0.7, 0.5, 0.1), Color(0.35, 0.36, 0.38)]
	var slots := [Vector3(-1.5, 0, 2.5), Vector3(1.5, 0, 2.5), Vector3(-1.5, 0, -2.0), Vector3(1.5, 0, -2.0), Vector3(0, 2.6, 0.2)]
	for i in slots.size():
		if wrecked and rng.randf() < 0.45:
			continue   # lost overboard
		var cm := StandardMaterial3D.new()
		cm.albedo_color = colors[rng.randi() % colors.size()]
		cm.albedo_texture = Mats.noise_tex(0.02, 128, false, 4.0, 3, Mats.gradient([Color(0.75, 0.75, 0.75), Color(1, 1, 1)]))
		cm.uv1_triplanar = true
		cm.uv1_scale = Vector3(2.5, 0.2, 0.2)
		cm.roughness = 0.65
		cm.metallic = 0.3
		var p: Vector3 = slots[i] + Vector3(0, DEPTH + 1.3, 0)
		var rot := Vector3(0, 0, rng.randf_range(-0.25, 0.25)) if wrecked else Vector3.ZERO
		_box(root, Vector3(2.4, 2.6, 4.2), p, cm, rot)
	# railings
	for side in [-1.0, 1.0]:
		_box(root, Vector3(0.06, 0.9, LENGTH * 0.62), Vector3(side * (BEAM * 0.5 - 0.1), DEPTH + 0.5, 1.5), white)
	if not wrecked:
		var mast_light := OmniLight3D.new()
		mast_light.light_color = Color(1.0, 0.85, 0.6)
		mast_light.omni_range = 18.0
		mast_light.light_energy = 2.0
		mast_light.position = Vector3(0, DEPTH + 7.6, -6.0)
		root.add_child(mast_light)
		var deck_light := OmniLight3D.new()
		deck_light.light_color = Color(1.0, 0.75, 0.5)
		deck_light.omni_range = 12.0
		deck_light.light_energy = 1.5
		deck_light.position = Vector3(0, DEPTH + 3.0, 6.5)
		root.add_child(deck_light)
	return root


static func _box(parent: Node3D, size: Vector3, pos: Vector3, mat: Material, rot: Vector3 = Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi


## Collision for every mesh in the ship (trimesh), added to `body`.
static func add_collision(ship: Node3D, body: CollisionObject3D) -> void:
	for mi in ship.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		var cs := CollisionShape3D.new()
		cs.shape = m.mesh.create_trimesh_shape()
		body.add_child(cs)
		cs.global_transform = m.global_transform
