class_name DrownedCity
extends Node3D
## A coastal city of glass towers around an old stone clock tower, built procedurally.
## The same city plays twice: alive at dusk as the wave comes (water far below), and
## drowned decades later (`water_y` above the streets, towers rising out of the sea).

const BLOCK := 64.0
const STREET := 18.0

var base_y := 0.0
var water_y := -1000.0
var clock_tower: Node3D
var clock_faces: Array[MeshInstance3D] = []
var towers: Array[MeshInstance3D] = []
var _mats: Array[ShaderMaterial] = []
var _rng := RandomNumberGenerator.new()


func build(p_base_y: float, p_water_y: float, lit := 0.25, flicker := 0.0, blocks := 7, seed_v := 31) -> void:
	base_y = p_base_y
	water_y = p_water_y
	_rng.seed = seed_v
	var palette := [Color(0.55, 0.53, 0.5), Color(0.62, 0.58, 0.52), Color(0.4, 0.42, 0.44), Color(0.7, 0.66, 0.6)]
	var glasses := [Color(0.05, 0.08, 0.1), Color(0.08, 0.1, 0.09), Color(0.1, 0.09, 0.07), Color(0.04, 0.06, 0.09)]
	for i in 8:
		var m := ShaderMaterial.new()
		m.shader = preload("res://shaders/trailer/tower.gdshader")
		m.set_shader_parameter("concrete", palette[i % palette.size()])
		m.set_shader_parameter("glass", glasses[(i * 3) % glasses.size()])
		m.set_shader_parameter("floor_h", 3.4 + (i % 3) * 0.3)
		m.set_shader_parameter("bay_w", 2.6 + (i % 4) * 0.5)
		m.set_shader_parameter("lit", lit * (0.6 + 0.2 * (i % 3)))
		m.set_shader_parameter("flicker", flicker)
		m.set_shader_parameter("water_y", water_y)
		m.set_shader_parameter("seed", float(i))
		m.set_shader_parameter("broken", 0.05 if water_y < base_y else 0.35)
		_mats.append(m)
	# streets
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1) * (blocks * 2 + 2) * BLOCK * 1.2
	g.mesh = pm
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.13, 0.13, 0.13) if water_y < base_y else Color(0.2, 0.19, 0.15)
	gm.roughness = 0.9
	g.material_override = gm
	g.position = Vector3(0, base_y, 0)
	add_child(g)
	for bz in range(-blocks, blocks + 1):
		for bx in range(-blocks, blocks + 1):
			var c := Vector3(bx * BLOCK, base_y, bz * BLOCK)
			if c.length() < BLOCK * 1.1:
				continue  # the plaza around the clock tower
			_block(c, Vector2(bx, bz).length() / blocks)
	_clock_tower(Vector3(0, base_y, 0))


func _block(c: Vector3, ring: float) -> void:
	var size := BLOCK - STREET
	var n := _rng.randi_range(1, 3)
	for i in n:
		var w := _rng.randf_range(14.0, size / (1.0 if n == 1 else 1.6))
		var d := _rng.randf_range(14.0, size / (1.0 if n == 1 else 1.6))
		var off := Vector3(_rng.randf_range(-1, 1) * (size - w) * 0.5, 0, _rng.randf_range(-1, 1) * (size - d) * 0.5)
		# taller downtown, some landmark spikes
		var h := _rng.randf_range(30.0, 110.0) * lerpf(1.4, 0.6, clampf(ring, 0.0, 1.0))
		if _rng.randf() < 0.08:
			h *= 1.8
		var mat := _mats[_rng.randi() % _mats.size()]
		var y := 0.0
		var steps := _rng.randi_range(1, 3)
		for s in steps:
			var sh := h / steps * (1.2 if s == 0 else 0.9)
			_box(c + off + Vector3(0, y + sh * 0.5, 0), Vector3(w, sh, d), mat)
			y += sh
			w *= _rng.randf_range(0.65, 0.9)
			d *= _rng.randf_range(0.65, 0.9)
		# roof furniture
		if _rng.randf() < 0.6:
			_box(c + off + Vector3(w * 0.2, y + 2.0, 0), Vector3(4, 4, 4), mat)
		if _rng.randf() < 0.3:
			_box(c + off + Vector3(0, y + 9.0, d * 0.1), Vector3(0.5, 18, 0.5), mat)


func _box(p: Vector3, s: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = s
	mi.mesh = bm
	mi.material_override = mat
	mi.position = p
	add_child(mi)
	towers.append(mi)
	return mi


func _clock_tower(at: Vector3) -> void:
	clock_tower = Node3D.new()
	clock_tower.position = at
	add_child(clock_tower)
	var sm := ShaderMaterial.new()
	sm.shader = preload("res://shaders/trailer/stone.gdshader")
	sm.set_shader_parameter("water_y", water_y)
	var parts := [
		[Vector3(0, 4, 0), Vector3(18, 8, 18)],      # plinth
		[Vector3(0, 33, 0), Vector3(13, 50, 13)],    # shaft
		[Vector3(0, 65, 0), Vector3(16, 14, 16)],    # clock stage
		[Vector3(0, 72.5, 0), Vector3(17, 1.2, 17)], # cornice
		[Vector3(0, 79, 0), Vector3(12, 12, 12)],    # belfry
	]
	for p in parts:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = p[1]
		mi.mesh = bm
		mi.material_override = sm
		mi.position = p[0]
		clock_tower.add_child(mi)
	# pilasters on the shaft corners
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			var mi := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(1.6, 64, 1.6)
			mi.mesh = bm
			mi.material_override = sm
			mi.position = Vector3(sx * 7.2, 40, sz * 7.2)
			clock_tower.add_child(mi)
	var spire := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.2
	cm.bottom_radius = 9.0
	cm.height = 26.0
	cm.radial_segments = 4
	spire.mesh = cm
	var roof := StandardMaterial3D.new()
	roof.albedo_color = Color(0.22, 0.3, 0.27)
	roof.metallic = 0.6
	roof.roughness = 0.5
	spire.material_override = roof
	spire.position = Vector3(0, 98, 0)
	spire.rotation.y = PI * 0.25
	clock_tower.add_child(spire)
	var cf := ShaderMaterial.new()
	cf.shader = preload("res://shaders/trailer/clock_face.gdshader")
	cf.set_shader_parameter("drowned", 1.0 if water_y > base_y + 70 else 0.0)
	for k in 4:
		var q := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(11, 11)
		q.mesh = qm
		q.material_override = cf
		var a := k * PI * 0.5
		q.position = Vector3(sin(a) * 8.05, 65, cos(a) * 8.05)
		q.rotation.y = a
		clock_tower.add_child(q)
		clock_faces.append(q)


## World position of the clock face looking along +Z (towards the camera side).
func clock_point() -> Vector3:
	return clock_tower.global_position + Vector3(0, 65, 8.1)
