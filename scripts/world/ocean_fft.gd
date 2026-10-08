class_name OceanFFT
extends MeshInstance3D
## Open ocean: FFT wave cascades simulated on the GPU (addons/ocean_waves), drawn on a
## camera-following CDLOD grid. Waves calm down in the island lagoon (shore distance
## field), and the shader handles refraction, absorption and shoreline foam.

const RINGS := [  # spacing (m), outer half-extent (m)
	Vector2(0.5, 40.0), Vector2(1.0, 80.0), Vector2(2.0, 160.0),
	Vector2(4.0, 320.0), Vector2(8.0, 640.0), Vector2(16.0, 1600.0),
]
const SNAP := 16.0     # = 2 x the spacing of the last morphing ring
const HORIZON := 30000.0

## sea state: 0 = glassy calm, 1 = trade-wind swell, 2+ = storm
@export var sea_state := 1.0:
	set(v):
		sea_state = v
		_apply_sea_state()

var mat: ShaderMaterial
var time := 0.0
var wave_scale := 1.0:
	set(v):
		wave_scale = v
		if mat:
			mat.set_shader_parameter("wave_scale", v)

var _cascades: Array[WaveCascadeParameters] = []
var _gen: WaveGenerator
var _disp := Texture2DArrayRD.new()
var _norm := Texture2DArrayRD.new()
var _next_update := 0.0
var _updates_per_second := 30.0


func _ready() -> void:
	mesh = _build_mesh()
	extra_cull_margin = 16384.0
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/ocean_fft.gdshader")
	mat.render_priority = 1
	var fn := NoiseTexture2D.new()
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_CELLULAR
	n.frequency = 0.035
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = 3
	fn.noise = n
	fn.seamless = true
	fn.width = 512
	fn.height = 512
	fn.generate_mipmaps = true
	mat.set_shader_parameter("foam_noise", fn)
	material_override = mat

	# three cascades: long swell, medium chop, fine ripples (tile sizes avoid repetition)
	var tiles := [Vector2(250, 250), Vector2(67, 67), Vector2(17, 17)]
	var disp := [1.0, 0.75, 0.0]
	var nrm := [1.0, 1.0, 0.35]
	for i in 3:
		var c := WaveCascadeParameters.new()
		c.tile_length = tiles[i]
		c.displacement_scale = disp[i]
		c.normal_scale = nrm[i]
		c.spectrum_seed = Vector2i(1234 + i * 97, -771 + i * 31)
		c.time = 120.0 + PI * i
		_cascades.append(c)
	_apply_sea_state()
	_gen = WaveGenerator.new()
	_gen.map_size = 512 if Settings.quality >= 2 else 256
	add_child(_gen)
	_gen.init_gpu(_cascades.size())
	_disp.texture_rd_rid = _gen.descriptors[&"displacement_map"].rid
	_norm.texture_rd_rid = _gen.descriptors[&"normal_map"].rid
	mat.set_shader_parameter("displacements", _disp)
	mat.set_shader_parameter("normals", _norm)
	mat.set_shader_parameter("num_cascades", _cascades.size())
	var scales := PackedVector4Array()
	for c in _cascades:
		scales.append(Vector4(1.0 / c.tile_length.x, 1.0 / c.tile_length.y, c.displacement_scale, c.normal_scale))
	mat.set_shader_parameter("map_scales", scales)


## island shore distance field (ImageTexture, metres, + inland) covering rect (x0, z0, size)
func set_shore(tex: Texture2D, x0: float, z0: float, size: float) -> void:
	mat.set_shader_parameter("shore_sdf", tex)
	mat.set_shader_parameter("shore_rect", Vector4(x0, z0, size, 0))


func _apply_sea_state() -> void:
	var s := clampf(sea_state, 0.0, 3.0)
	for i in _cascades.size():
		var c := _cascades[i]
		c.wind_speed = lerpf(4.0, 14.0, minf(s, 1.0)) + maxf(0.0, s - 1.0) * 9.0
		c.wind_direction = -35.0 + i * 12.0
		c.fetch_length = 300.0
		c.swell = 0.9
		c.spread = 0.25
		c.detail = 1.0
		c.whitecap = lerpf(0.9, 0.45, minf(s / 2.0, 1.0))
		c.foam_amount = lerpf(1.5, 6.0, minf(s / 2.0, 1.0))


func _process(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam:
		var p := cam.global_position
		global_position = Vector3(snappedf(p.x, SNAP), 0.0, snappedf(p.z, SNAP))
	time += delta
	if _gen == null:
		return
	if time >= _next_update:
		var step := 1.0 / _updates_per_second
		var d := step + (time - _next_update)
		_next_update = time + step
		for c in _cascades:
			c.time += d
			c.foam_grow_rate = d * c.foam_amount * 7.5
			c.foam_decay_rate = d * maxf(0.5, 10.0 - c.foam_amount) * 1.15
		_gen.pass_parameters = _cascades
		_gen.pass_num_cascades_remaining = _cascades.size()


## Approximate surface height for gameplay (buoyancy uses its own swell model until the
## GPU read-back lands): calm lagoon ~0, long swell from the largest cascade.
func get_height(x: float, z: float) -> float:
	var t := time
	return (sin(x * 0.025 + t * 0.6) * 0.35 + sin(z * 0.031 - t * 0.5 + 1.3) * 0.25) * wave_scale * clampf(sea_state, 0.0, 3.0) * 0.6


func _build_mesh() -> ArrayMesh:
	var verts := PackedVector3Array()
	var uv2 := PackedVector2Array()
	var idx := PackedInt32Array()
	var inner := 0.0
	for li in RINGS.size():
		var s: float = RINGS[li].x
		var e: float = RINGS[li].y
		var tag := Vector2(s, e if li < RINGS.size() - 1 else 1e9)
		var n := int(round(e * 2.0 / s))
		var base := verts.size()
		for j in n + 1:
			for i in n + 1:
				verts.append(Vector3(-e + i * s, 0.0, -e + j * s))
				uv2.append(tag)
		for j in n:
			var cz := -e + (j + 0.5) * s
			for i in n:
				var cx := -e + (i + 0.5) * s
				if absf(cx) < inner and absf(cz) < inner:
					continue
				var a := base + j * (n + 1) + i
				idx.append_array([a, a + 1, a + n + 2, a, a + n + 2, a + n + 1])
		inner = e
	# a flat skirt from the last ring out to the horizon
	var e: float = RINGS[-1].y
	var h := HORIZON
	var b := verts.size()
	for p in [Vector2(-h, -h), Vector2(h, -h), Vector2(h, h), Vector2(-h, h),
			Vector2(-e, -e), Vector2(e, -e), Vector2(e, e), Vector2(-e, e)]:
		verts.append(Vector3(p.x, 0.0, p.y))
		uv2.append(Vector2(64.0, 1e9))
	for k in 4:
		var o0 := b + k
		var o1 := b + (k + 1) % 4
		var i0 := b + 4 + k
		var i1 := b + 4 + (k + 1) % 4
		idx.append_array([o0, o1, i1, o0, i1, i0])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_TEX_UV2] = uv2
	arrays[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	m.custom_aabb = AABB(Vector3(-h, -20, -h), Vector3(h * 2, 40, h * 2))
	return m
