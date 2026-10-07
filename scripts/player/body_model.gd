class_name BodyModel
extends Node3D
## Placeholder castaway body built from primitives, animated procedurally
## (walk/run cycle, swimming, jumping, tool swing, breathing).
## Will be swapped for a rigged, realistic character model later.

var _joints := {}
var _meshes: Array[MeshInstance3D] = []
var _phase := 0.0
var _t := 0.0
var swing := 0.0   # 0..1 driven by the player's tool animation
var _visible_mode := true


func _ready() -> void:
	var skin := _mat(Color(0.63, 0.45, 0.33), 0.7)
	var shirt := _mat(Color(0.82, 0.8, 0.72), 0.95)
	var shorts := _mat(Color(0.16, 0.22, 0.32), 0.95)
	var hair := _mat(Color(0.12, 0.08, 0.05), 0.8)

	var hips := _joint("hips", self, Vector3(0, 0.95, 0))
	_part(hips, _capsule(0.15, 0.32), shorts, Vector3(0, 0.02, 0), Vector3(0, 0, PI / 2))
	var spine := _joint("spine", hips, Vector3(0, 0.08, 0))
	_part(spine, _capsule(0.16, 0.5), shirt, Vector3(0, 0.24, 0))
	_part(spine, _capsule(0.13, 0.42), shirt, Vector3(0, 0.38, 0), Vector3(0, 0, PI / 2))
	var neck := _joint("neck", spine, Vector3(0, 0.52, 0))
	_part(neck, _capsule(0.05, 0.14), skin, Vector3(0, 0.05, 0))
	var head := _joint("head", neck, Vector3(0, 0.12, 0))
	_part(head, _sphere(0.105, 0.26), skin, Vector3(0, 0.1, 0.01))
	_part(head, _sphere(0.112, 0.16), hair, Vector3(0, 0.15, 0.025))
	_part(head, _sphere(0.02, 0.04), skin, Vector3(0, 0.09, -0.105))  # nose

	for side in [-1.0, 1.0]:
		var nm := "l" if side < 0 else "r"
		var sh := _joint(nm + "_shoulder", spine, Vector3(0.21 * side, 0.43, 0))
		_part(sh, _capsule(0.055, 0.3), shirt, Vector3(0, -0.13, 0))
		var el := _joint(nm + "_elbow", sh, Vector3(0, -0.28, 0))
		_part(el, _capsule(0.045, 0.27), skin, Vector3(0, -0.13, 0))
		_part(el, _sphere(0.045, 0.1), skin, Vector3(0, -0.29, 0))
		var hip := _joint(nm + "_hip", hips, Vector3(0.1 * side, -0.04, 0))
		_part(hip, _capsule(0.075, 0.46), shorts, Vector3(0, -0.21, 0))
		var knee := _joint(nm + "_knee", hip, Vector3(0, -0.43, 0))
		_part(knee, _capsule(0.055, 0.44), skin, Vector3(0, -0.21, 0))
		var ankle := _joint(nm + "_ankle", knee, Vector3(0, -0.43, 0))
		_part(ankle, _box(Vector3(0.09, 0.06, 0.24)), skin, Vector3(0, -0.04, -0.05))


func set_first_person(fp: bool) -> void:
	_visible_mode = not fp
	for m in _meshes:
		# in first person the body still casts a shadow, but the camera never sees it
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if fp else GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func animate(delta: float, h_speed: float, on_floor: bool, swimming: bool, vy: float) -> void:
	_t += delta
	var run := clampf(h_speed / 7.0, 0.0, 1.0)
	var j := _joints
	var hips: Node3D = j["hips"]
	var spine: Node3D = j["spine"]
	var target_pitch := 0.0
	var breathe := sin(_t * 1.6) * 0.012

	if swimming:
		_phase += delta * (2.0 + h_speed * 1.5)
		target_pitch = -1.25 if h_speed > 0.4 else -0.35
		var kick := sin(_phase * 3.0) * 0.35
		_pose("l_hip", Vector3(kick, 0, 0.08))
		_pose("r_hip", Vector3(-kick, 0, -0.08))
		_pose("l_knee", Vector3(maxf(-kick, 0.0) * 0.6, 0, 0))
		_pose("r_knee", Vector3(maxf(kick, 0.0) * 0.6, 0, 0))
		var stroke := sin(_phase)
		_pose("l_shoulder", Vector3(-2.4 + stroke * 0.6, 0, -0.5 - stroke * 0.5))
		_pose("r_shoulder", Vector3(-2.4 + stroke * 0.6, 0, 0.5 + stroke * 0.5))
		_pose("l_elbow", Vector3(-0.5 - maxf(stroke, 0.0), 0, 0))
		_pose("r_elbow", Vector3(-0.5 - maxf(stroke, 0.0), 0, 0))
		hips.position.y = 0.95
	elif not on_floor:
		var tuck := clampf(-vy * 0.1, -0.3, 0.6)
		_pose("l_hip", Vector3(-0.5 + tuck, 0, 0.05))
		_pose("r_hip", Vector3(-0.2 + tuck, 0, -0.05))
		_pose("l_knee", Vector3(0.9, 0, 0))
		_pose("r_knee", Vector3(0.5, 0, 0))
		_pose("l_shoulder", Vector3(-0.3, 0, -0.5))
		_pose("r_shoulder", Vector3(-0.3, 0, 0.5))
		_pose("l_elbow", Vector3(-0.4, 0, 0))
		_pose("r_elbow", Vector3(-0.4, 0, 0))
	else:
		_phase += delta * h_speed * 2.4
		var amp := clampf(h_speed / 4.2, 0.0, 1.0)
		var leg := 0.45 + 0.25 * run
		var s := sin(_phase)
		var c := cos(_phase)
		_pose("l_hip", Vector3(-s * leg * amp, 0, 0.03))
		_pose("r_hip", Vector3(s * leg * amp, 0, -0.03))
		_pose("l_knee", Vector3(maxf(c, 0.0) * (0.6 + 0.6 * run) * amp + 0.05, 0, 0))
		_pose("r_knee", Vector3(maxf(-c, 0.0) * (0.6 + 0.6 * run) * amp + 0.05, 0, 0))
		_pose("l_ankle", Vector3(-maxf(c, 0.0) * 0.3 * amp, 0, 0))
		_pose("r_ankle", Vector3(-maxf(-c, 0.0) * 0.3 * amp, 0, 0))
		var arm := (0.35 + 0.45 * run) * amp
		_pose("l_shoulder", Vector3(s * arm, 0, -0.08))
		_pose("r_shoulder", Vector3(-s * arm, 0, 0.08))
		_pose("l_elbow", Vector3(-0.15 - 0.8 * run * amp, 0, 0))
		_pose("r_elbow", Vector3(-0.15 - 0.8 * run * amp, 0, 0))
		hips.position.y = 0.95 - absf(c) * 0.03 * amp - 0.04 * run * amp
		target_pitch = -0.18 * run * amp

	# tool swing overrides the right arm
	if swing > 0.01:
		var sw := sin(swing * PI)
		_pose("r_shoulder", Vector3(-2.2 * sw, 0, 0.2))
		_pose("r_elbow", Vector3(-0.9 * sw, 0, 0))
	hips.rotation.x = lerp_angle(hips.rotation.x, target_pitch, 1.0 - exp(-8.0 * delta))
	spine.scale = Vector3(1.0 + breathe, 1.0, 1.0 + breathe)


func _pose(joint: String, rot: Vector3) -> void:
	var n: Node3D = _joints[joint]
	n.rotation = n.rotation.lerp(rot, 0.35)


func _joint(nm: String, parent: Node3D, pos: Vector3) -> Node3D:
	var n := Node3D.new()
	n.name = nm
	n.position = pos
	parent.add_child(n)
	_joints[nm] = n
	return n


func _part(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot: Vector3 = Vector3.ZERO) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	_meshes.append(mi)


func _mat(c: Color, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	return m


func _capsule(r: float, h: float) -> CapsuleMesh:
	var c := CapsuleMesh.new()
	c.radius = r
	c.height = maxf(h, r * 2.0 + 0.01)
	c.radial_segments = 12
	c.rings = 4
	return c


func _sphere(r: float, h: float) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = h
	s.radial_segments = 14
	s.rings = 8
	return s


func _box(sz: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = sz
	return b
