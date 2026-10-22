class_name Tsunami
extends Node3D
## A breaking mega-wave as a mesh: a profile swept along a wide front (the lip leans
## out over the face), its height varying along the front. Travels along +Z.

const PROFILE := [
	Vector2(-9.0, 0.0), Vector2(-5.0, 0.12), Vector2(-2.5, 0.42), Vector2(-1.2, 0.76), Vector2(-0.45, 0.95),
	Vector2(0.0, 1.0), Vector2(0.24, 0.98), Vector2(0.4, 0.9), Vector2(0.42, 0.78), Vector2(0.4, 0.62),
	Vector2(0.48, 0.42), Vector2(0.66, 0.2), Vector2(0.95, 0.06), Vector2(1.5, -0.02), Vector2(2.4, -0.05),
]

var width := 3000.0
var height := 120.0
var speed := 35.0
var mat: ShaderMaterial
var spray: GPUParticles3D
var mist: GPUParticles3D


func build(p_width: float, p_height: float) -> void:
	width = p_width
	height = p_height
	var nx := 260
	var ns := 140
	var noise := FastNoiseLite.new()
	noise.frequency = 0.004
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var crest_s := 0.0
	for j in ns + 1:
		var s := float(j) / ns
		if _profile(s).y > _profile(crest_s).y:
			crest_s = s
	for i in nx + 1:
		var u := float(i) / nx
		var x := (u - 0.5) * width
		var hk := 1.0 + noise.get_noise_1d(x) * 0.35
		var lead := noise.get_noise_1d(x + 999.0) * height * 0.6
		for j in ns + 1:
			var s := float(j) / ns
			var pr := _profile(s)
			st.set_uv(Vector2(u, s))
			st.add_vertex(Vector3(x, pr.y * height * hk, pr.x * height * hk + lead))
	for i in nx:
		for j in ns:
			var a := i * (ns + 1) + j
			var b := a + ns + 1
			st.add_index(a)
			st.add_index(b)
			st.add_index(a + 1)
			st.add_index(a + 1)
			st.add_index(b)
			st.add_index(b + 1)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mat = ShaderMaterial.new()
	mat.shader = preload("res://shaders/trailer/tsunami.gdshader")
	mat.set_shader_parameter("width", width)
	mat.set_shader_parameter("height", height)
	mat.set_shader_parameter("crest_s", crest_s)
	mi.material_override = mat
	mi.extra_cull_margin = height
	add_child(mi)
	spray = _emitter(Vector3(width, height * 0.1, height * 0.15), Vector3(0, height * 0.98, height * 0.1), height * 0.22, 1600, 5.0)
	mist = _emitter(Vector3(width, height * 0.1, height * 0.4), Vector3(0, height * 0.05, height * 0.9), height * 0.35, 900, 6.0)


## Catmull-Rom along the profile, s in 0..1.
func _profile(s: float) -> Vector2:
	var n := PROFILE.size() - 1
	var f := clampf(s, 0.0, 1.0) * n
	var i := mini(int(f), n - 1)
	var u := f - i
	var a: Vector2 = PROFILE[maxi(i - 1, 0)]
	var b: Vector2 = PROFILE[i]
	var c: Vector2 = PROFILE[i + 1]
	var d: Vector2 = PROFILE[mini(i + 2, n)]
	return 0.5 * ((2.0 * b) + (-a + c) * u + (2.0 * a - 5.0 * b + 4.0 * c - d) * u * u + (-a + 3.0 * b - 3.0 * c + d) * u * u * u)


func _emitter(box: Vector3, at: Vector3, size: float, amount: int, life: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = life
	p.preprocess = life
	p.visibility_aabb = AABB(Vector3(-width, -height, -height * 4), Vector3(width * 2, height * 4, height * 8))
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = box * 0.5
	m.direction = Vector3(0, 0.6, 1)
	m.spread = 35.0
	m.initial_velocity_min = height * 0.05
	m.initial_velocity_max = height * 0.15
	m.gravity = Vector3(0, -2.0, 0)
	m.damping_min = 1.0
	m.damping_max = 3.0
	m.scale_min = 0.6
	m.scale_max = 1.4
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.4))
	sc.add_point(Vector2(1, 1.6))
	var ct := CurveTexture.new()
	ct.curve = sc
	m.scale_curve = ct
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0)])
	g.offsets = PackedFloat32Array([0.0, 0.25, 1.0])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	m.color_ramp = gt
	p.process_material = m
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var sm := Fx.soft_sprite_material(false)
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	sm.albedo_color = Color(0.8, 0.84, 0.86)
	sm.disable_receive_shadows = true
	q.material = sm
	p.draw_pass_1 = q
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.position = at
	add_child(p)
	return p


func _process(delta: float) -> void:
	position.z += speed * delta
