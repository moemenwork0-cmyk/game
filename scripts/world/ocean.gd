class_name Ocean
extends MeshInstance3D
## Gerstner-wave ocean. get_height() evaluates the same waves on the CPU for buoyancy.

const SIZE := 360.0
const SUBDIV := 239
# direction.x, direction.y, steepness, wavelength
const WAVES := [
	Vector4(1.0, 0.35, 0.07, 26.0),
	Vector4(0.55, 1.0, 0.06, 14.0),
	Vector4(-0.45, 0.8, 0.05, 8.0),
	Vector4(0.9, -0.55, 0.04, 4.5),
]

var time := 0.0
var mat: ShaderMaterial
var _far_mat: ShaderMaterial
var _k := PackedFloat32Array()
var _c := PackedFloat32Array()
var _a := PackedFloat32Array()
var _d: Array[Vector2] = []


func _ready() -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(SIZE, SIZE)
	pm.subdivide_width = SUBDIV
	pm.subdivide_depth = SUBDIV
	mesh = pm
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/ocean.gdshader")
	mat.set_shader_parameter("normal_a", Mats.noise_tex(0.02, 512, true, 6.0, 4))
	mat.set_shader_parameter("normal_b", Mats.noise_tex(0.035, 512, true, 5.0, 3))
	mat.set_shader_parameter("foam_tex", Mats.noise_tex(0.03, 256, false, 8.0, 4, null, FastNoiseLite.TYPE_CELLULAR))
	var names := ["wave_a", "wave_b", "wave_c", "wave_d"]
	for i in WAVES.size():
		var w: Vector4 = WAVES[i]
		mat.set_shader_parameter(names[i], w)
		var k := TAU / w.w
		_k.append(k)
		_c.append(sqrt(9.8 / k))
		_a.append(w.z / k)
		_d.append(Vector2(w.x, w.y).normalized())
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	extra_cull_margin = 4.0

	# flat far-ocean ring out to the horizon (no vertex waves, same look)
	var far := MeshInstance3D.new()
	far.mesh = _ring_mesh(SIZE * 0.5 - 2.0, 3500.0, 96)
	var fm: ShaderMaterial = mat.duplicate()
	fm.set_shader_parameter("displace", false)
	far.material_override = fm
	far.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	far.position.y = -0.05
	add_child(far)
	_far_mat = fm

	# distant seabed so the world never ends in a void
	var bed := MeshInstance3D.new()
	var bp := PlaneMesh.new()
	bp.size = Vector2(900, 900)
	bed.mesh = bp
	bed.material_override = Mats.get_mat("sand_flat")
	bed.position = Vector3(0, -7.75, 0)
	get_parent().add_child.call_deferred(bed)


func _process(delta: float) -> void:
	time += delta
	mat.set_shader_parameter("wave_time", time)
	_far_mat.set_shader_parameter("wave_time", time)
	var cam := get_viewport().get_camera_3d()
	if cam:
		var step := SIZE / float(SUBDIV + 1)
		var p := cam.global_position
		global_position = Vector3(snappedf(p.x, step), 0.0, snappedf(p.z, step))


func get_height(x: float, z: float) -> float:
	var h := 0.0
	var p := Vector2(x, z)
	for i in _k.size():
		var f := _k[i] * (_d[i].dot(p) - _c[i] * time)
		h += _a[i] * sin(f)
	return h


func _ring_mesh(r0: float, r1: float, seg: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in seg:
		var a0 := TAU * i / seg
		var a1 := TAU * (i + 1) / seg
		var p0 := Vector3(cos(a0), 0, sin(a0))
		var p1 := Vector3(cos(a1), 0, sin(a1))
		var quad := [p0 * r0, p1 * r0, p1 * r1, p0 * r1]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(Vector3.UP)
			st.set_tangent(Plane(1, 0, 0, 1))
			st.add_vertex(quad[k])
	return st.commit()
