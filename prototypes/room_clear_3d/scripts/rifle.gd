class_name Rifle
extends Node3D
## Procedural assault rifle. Local frame: origin at the pistol grip, barrel along -Z, +Y up.
## Carries the hand targets for the arm IK, the muzzle point, a weapon light and the muzzle flash.

var muzzle := Marker3D.new()
var grip_r := Marker3D.new()      # right wrist target (firing hand)
var grip_l := Marker3D.new()      # left wrist target (support hand on the handguard)
var mag_well := Marker3D.new()
var mag: Node3D
var light: SpotLight3D
var flash_root := Node3D.new()
var flash_light := OmniLight3D.new()
var _flash_t := 0.0

static var _flash_tex: Texture2D
static var _mats := {}


func _ready() -> void:
	var poly := _mat("poly", Color(0.045, 0.047, 0.05), 0.0, 0.62)
	var metal := _mat("metal", Color(0.07, 0.072, 0.075), 0.75, 0.38)
	var tan := _mat("tan", Color(0.34, 0.29, 0.2), 0.0, 0.7)
	# receiver, rail, handguard
	_box(Vector3(0.056, 0.074, 0.30), Vector3(0, 0.045, -0.10), metal)
	_box(Vector3(0.03, 0.014, 0.40), Vector3(0, 0.089, -0.14), metal)
	_box(Vector3(0.062, 0.066, 0.27), Vector3(0, 0.042, -0.385), tan)
	for i in 6:
		_box(Vector3(0.066, 0.008, 0.018), Vector3(0, 0.077, -0.27 - i * 0.045), poly)
	# barrel + muzzle brake
	_cyl(0.011, 0.24, Vector3(0, 0.045, -0.63), metal)
	_cyl(0.017, 0.06, Vector3(0, 0.045, -0.77), poly)
	# stock + buffer tube + butt pad
	_cyl(0.017, 0.16, Vector3(0, 0.05, 0.11), metal)
	_box(Vector3(0.046, 0.095, 0.20), Vector3(0, 0.03, 0.20), tan)
	_box(Vector3(0.05, 0.13, 0.03), Vector3(0, 0.012, 0.305), poly)
	# pistol grip, trigger guard
	_box(Vector3(0.034, 0.11, 0.042), Vector3(0, -0.035, 0.012), poly, Vector3(-0.35, 0, 0))
	_box(Vector3(0.012, 0.012, 0.07), Vector3(0, -0.012, -0.045), metal)
	# magazine (curved look: two boxes)
	mag = Node3D.new()
	add_child(mag)
	mag.position = Vector3(0, 0.0, -0.15)
	var m1 := _box(Vector3(0.03, 0.10, 0.07), Vector3(0, -0.05, 0), metal)
	var m2 := _box(Vector3(0.03, 0.09, 0.068), Vector3(0, -0.13, -0.022), metal, Vector3(0.32, 0, 0))
	for m in [m1, m2]:
		m.reparent(mag, false)
	mag_well.position = Vector3(0, -0.02, -0.15)
	add_child(mag_well)
	# optic
	_cyl(0.024, 0.13, Vector3(0, 0.125, -0.12), poly)
	_box(Vector3(0.02, 0.03, 0.02), Vector3(0, 0.103, -0.08), poly)
	_box(Vector3(0.02, 0.03, 0.02), Vector3(0, 0.103, -0.16), poly)
	var lens := StandardMaterial3D.new()
	lens.albedo_color = Color(0.05, 0.1, 0.12)
	lens.metallic = 1.0
	lens.roughness = 0.05
	lens.emission_enabled = true
	lens.emission = Color(1.0, 0.1, 0.05)
	lens.emission_energy_multiplier = 0.6
	_cyl(0.02, 0.004, Vector3(0, 0.125, -0.187), lens)
	# weapon light under the handguard
	_cyl(0.015, 0.09, Vector3(0.042, 0.02, -0.44), metal)
	light = SpotLight3D.new()
	add_child(light)
	light.position = Vector3(0.042, 0.02, -0.49)
	light.spot_angle = 24.0
	light.spot_angle_attenuation = 0.8
	light.spot_range = 13.0
	light.spot_attenuation = 0.7
	light.light_energy = 5.0
	light.light_color = Color(1.0, 0.95, 0.85)
	light.light_volumetric_fog_energy = 1.4
	light.light_size = 0.05
	light.shadow_enabled = true
	light.shadow_bias = 0.05
	# markers
	muzzle.position = Vector3(0, 0.045, -0.81)
	grip_r.position = Vector3(0.012, 0.005, 0.085)
	grip_l.position = Vector3(-0.02, -0.025, -0.33)
	for m in [muzzle, grip_r, grip_l]:
		add_child(m)
	_build_flash()
	for c in find_children("*", "MeshInstance3D", true, false):
		(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func flash() -> void:
	_flash_t = 0.055
	flash_root.visible = true
	flash_root.rotation.z = randf() * TAU
	var s := randf_range(0.8, 1.25)
	flash_root.scale = Vector3(s, s, randf_range(0.8, 1.4))
	flash_light.visible = true
	flash_light.light_energy = randf_range(5.0, 8.0)


func _process(delta: float) -> void:
	if _flash_t > 0.0:
		_flash_t -= delta
		if _flash_t <= 0.0:
			flash_root.visible = false
			flash_light.visible = false


func _build_flash() -> void:
	add_child(flash_root)
	flash_root.position = muzzle.position
	flash_root.visible = false
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_texture = _flash_texture()
	mat.albedo_color = Color(1.0, 0.78, 0.42) * 2.5
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.no_depth_test = false
	for i in 3:
		var q := MeshInstance3D.new()
		var qm := QuadMesh.new()
		q.mesh = qm
		q.material_override = mat
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flash_root.add_child(q)
		if i < 2:
			qm.size = Vector2(0.18, 0.42)
			q.position.z = -0.17
			q.rotation = Vector3(-PI / 2, 0, i * PI / 2)
		else:
			qm.size = Vector2(0.2, 0.2)
	flash_light.position = Vector3(0, 0.05, -0.1)
	flash_light.light_color = Color(1.0, 0.72, 0.38)
	flash_light.omni_range = 7.0
	flash_light.omni_attenuation = 1.6
	flash_light.shadow_enabled = false
	flash_light.visible = false
	flash_light.light_volumetric_fog_energy = 0.0
	flash_root.add_child(flash_light)


static func _flash_texture() -> Texture2D:
	if _flash_tex:
		return _flash_tex
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var p := Vector2(x + 0.5, y + 0.5) / n * 2.0 - Vector2.ONE
			var r := p.length()
			var a := atan2(p.y, p.x)
			var spikes := pow(absf(cos(a * 3.0)), 6.0) * 0.6 + pow(absf(cos(a * 5.0 + 0.4)), 10.0) * 0.4
			var v := clampf(1.0 - r / (0.35 + 0.6 * spikes), 0.0, 1.0)
			v = v * v
			var core := clampf(1.0 - r * 3.0, 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, 0.85 + core * 0.15, 0.6 + core * 0.4, clampf(v + core, 0.0, 1.0)))
	_flash_tex = ImageTexture.create_from_image(img)
	return _flash_tex


func _mat(key: String, c: Color, metal: float, rough: float) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = metal
	m.roughness = rough
	_mats[key] = m
	return m


func _box(size: Vector3, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	add_child(mi)
	return mi


func _cyl(r: float, length: float, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = length
	cm.radial_segments = 12
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	mi.rotation.x = PI / 2
	add_child(mi)
	return mi
