class_name Rifle
extends Node3D
## Procedural firearm (rifle / smg / shotgun / ak). Local frame: origin at the pistol grip,
## barrel along -Z, +Y up. Carries the hand targets for the arm IK, the muzzle point,
## a weapon light, the magazine (dropped on reload) and a layered muzzle flash.

var kind := "rifle"
var muzzle := Marker3D.new()
var grip_r := Marker3D.new()
var grip_l := Marker3D.new()
var mag_well := Marker3D.new()
var eject := Marker3D.new()
var mag: Node3D
var light: SpotLight3D
var flash_root := Node3D.new()
var flash_light := OmniLight3D.new()
var _flash_t := 0.0
var _smoke: GPUParticles3D

static var _flash_tex: Texture2D
static var _mats := {}
static var _merged := {}     # kind -> [body ArrayMesh, mag ArrayMesh]


func _ready() -> void:
	var blk := _mat("blk", Color(0.035, 0.037, 0.04), 0.35, 0.5)
	var metal := _mat("metal", Color(0.11, 0.115, 0.12), 0.85, 0.32)
	var poly := _mat("poly", Color(0.05, 0.052, 0.055), 0.0, 0.7)
	var tan := _mat("tan", Color(0.42, 0.36, 0.25), 0.0, 0.62)
	var wood := _mat("wood", Color(0.33, 0.16, 0.07), 0.0, 0.45)
	var steel := _mat("steel", Color(0.32, 0.33, 0.34), 1.0, 0.25)
	mag = Node3D.new()
	add_child(mag)
	match kind:
		"smg": _build_smg(blk, metal, poly, steel)
		"shotgun": _build_shotgun(blk, metal, wood, steel)
		"ak": _build_ak(blk, metal, wood, steel)
		_: _build_rifle(blk, metal, poly, tan, steel)
	for m in [muzzle, grip_r, grip_l, mag_well, eject]:
		add_child(m)
	_build_light()
	_merge_parts()
	_build_flash()
	for c in find_children("*", "MeshInstance3D", true, false):
		(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func _build_rifle(blk: Material, metal: Material, poly: Material, tan: Material, steel: Material) -> void:
	_box(Vector3(0.05, 0.068, 0.30), Vector3(0, 0.045, -0.10), metal)            # upper receiver
	_box(Vector3(0.046, 0.05, 0.2), Vector3(0, 0.0, -0.06), blk)                  # lower receiver
	_box(Vector3(0.028, 0.012, 0.42), Vector3(0, 0.086, -0.15), blk)              # top rail
	for i in 9:
		_box(Vector3(0.032, 0.006, 0.012), Vector3(0, 0.095, -0.0 - i * 0.042), metal)
	_box(Vector3(0.062, 0.064, 0.29), Vector3(0, 0.042, -0.39), tan)              # handguard
	for i in 5:
		_box(Vector3(0.066, 0.016, 0.026), Vector3(0, 0.042, -0.29 - i * 0.05), blk)
	_cyl(0.011, 0.25, Vector3(0, 0.045, -0.645), steel)
	_cyl(0.016, 0.07, Vector3(0, 0.045, -0.79), blk)                             # flash hider
	_cyl(0.0175, 0.17, Vector3(0, 0.05, 0.11), metal)                            # buffer tube
	_box(Vector3(0.046, 0.085, 0.17), Vector3(0, 0.03, 0.22), tan)               # stock
	_box(Vector3(0.05, 0.12, 0.028), Vector3(0, 0.01, 0.31), poly)
	_box(Vector3(0.034, 0.105, 0.042), Vector3(0, -0.04, 0.02), poly, Vector3(-0.38, 0, 0))   # grip
	_box(Vector3(0.012, 0.01, 0.07), Vector3(0, -0.018, -0.05), metal)           # trigger guard
	# optic
	_box(Vector3(0.036, 0.022, 0.08), Vector3(0, 0.104, -0.12), blk)
	_cyl(0.025, 0.11, Vector3(0, 0.137, -0.12), blk)
	_glass(Vector3(0, 0.137, -0.177))
	# curved STANAG mag
	var m1 := _box(Vector3(0.026, 0.1, 0.066), Vector3(0, -0.05, 0), metal, Vector3.ZERO, mag)
	var m2 := _box(Vector3(0.026, 0.07, 0.064), Vector3(0, -0.12, -0.018), metal, Vector3(0.3, 0, 0), mag)
	mag.position = Vector3(0, 0.0, -0.15)
	_set_markers(Vector3(0, 0.045, -0.83), Vector3(0.012, 0.005, 0.085), Vector3(-0.02, -0.025, -0.36), Vector3(0, -0.02, -0.15))
	m1.name = "m1"
	m2.name = "m2"


func _build_smg(blk: Material, metal: Material, poly: Material, steel: Material) -> void:
	_box(Vector3(0.05, 0.075, 0.30), Vector3(0, 0.04, -0.13), blk)
	_cyl(0.022, 0.2, Vector3(0, 0.05, -0.28), blk)                              # cocking tube
	_box(Vector3(0.056, 0.06, 0.16), Vector3(0, 0.01, -0.33), poly)              # handguard
	_cyl(0.011, 0.09, Vector3(0, 0.045, -0.45), steel)
	_cyl(0.019, 0.06, Vector3(0, 0.045, -0.52), blk)
	_box(Vector3(0.02, 0.02, 0.2), Vector3(0, 0.04, 0.12), metal)                # collapsible stock rails
	_box(Vector3(0.05, 0.1, 0.03), Vector3(0, 0.02, 0.22), poly)
	_box(Vector3(0.034, 0.1, 0.04), Vector3(0, -0.04, 0.02), poly, Vector3(-0.3, 0, 0))
	_box(Vector3(0.03, 0.022, 0.06), Vector3(0, 0.095, -0.1), blk)
	_cyl(0.016, 0.07, Vector3(0, 0.115, -0.1), blk)
	_glass(Vector3(0, 0.115, -0.136))
	_box(Vector3(0.022, 0.07, 0.04), Vector3(0, -0.04, 0), metal, Vector3.ZERO, mag)
	_box(Vector3(0.022, 0.08, 0.04), Vector3(0, -0.105, -0.015), metal, Vector3(0.35, 0, 0), mag)
	mag.position = Vector3(0, 0.0, -0.17)
	_set_markers(Vector3(0, 0.045, -0.56), Vector3(0.012, 0.005, 0.085), Vector3(-0.02, -0.03, -0.33), Vector3(0, -0.02, -0.17))


func _build_shotgun(blk: Material, metal: Material, wood: Material, steel: Material) -> void:
	_box(Vector3(0.05, 0.07, 0.24), Vector3(0, 0.04, -0.08), metal)
	_cyl(0.014, 0.62, Vector3(0, 0.07, -0.5), steel)                             # barrel
	_cyl(0.015, 0.5, Vector3(0, 0.035, -0.45), blk)                              # magazine tube
	_box(Vector3(0.06, 0.06, 0.2), Vector3(0, 0.03, -0.42), wood)                # pump
	for i in 6:
		_box(Vector3(0.064, 0.01, 0.01), Vector3(0, 0.03, -0.35 - i * 0.03), blk)
	_box(Vector3(0.048, 0.1, 0.3), Vector3(0, 0.0, 0.2), wood, Vector3(-0.12, 0, 0))   # stock
	_box(Vector3(0.05, 0.12, 0.03), Vector3(0, -0.02, 0.35), blk)
	_box(Vector3(0.012, 0.01, 0.07), Vector3(0, -0.01, -0.03), metal)
	_box(Vector3(0.01, 0.012, 0.02), Vector3(0, 0.085, -0.8), steel)             # bead sight
	_box(Vector3(0.01, 0.01, 0.01), Vector3(0, -0.3, 0), metal, Vector3.ZERO, mag)   # (no detachable mag)
	_set_markers(Vector3(0, 0.07, -0.83), Vector3(0.012, -0.005, 0.07), Vector3(-0.02, -0.0, -0.42), Vector3(0, -0.02, -0.1))


func _build_ak(blk: Material, metal: Material, wood: Material, steel: Material) -> void:
	_box(Vector3(0.05, 0.07, 0.32), Vector3(0, 0.04, -0.1), metal)
	_box(Vector3(0.05, 0.03, 0.3), Vector3(0, 0.087, -0.1), metal)               # dust cover
	_box(Vector3(0.058, 0.06, 0.2), Vector3(0, 0.035, -0.38), wood)              # handguard
	_box(Vector3(0.046, 0.03, 0.14), Vector3(0, 0.085, -0.38), wood)
	_cyl(0.011, 0.3, Vector3(0, 0.05, -0.62), steel)
	_cyl(0.015, 0.05, Vector3(0, 0.05, -0.79), blk)
	_box(Vector3(0.01, 0.04, 0.012), Vector3(0, 0.09, -0.74), steel)              # front sight
	_cyl(0.008, 0.25, Vector3(0, 0.085, -0.52), steel)                           # gas tube
	_box(Vector3(0.046, 0.09, 0.26), Vector3(0, 0.0, 0.2), wood, Vector3(-0.15, 0, 0))
	_box(Vector3(0.05, 0.11, 0.025), Vector3(0, -0.03, 0.33), blk)
	_box(Vector3(0.034, 0.1, 0.04), Vector3(0, -0.04, 0.02), wood, Vector3(-0.35, 0, 0))
	_box(Vector3(0.012, 0.01, 0.07), Vector3(0, -0.012, -0.04), metal)
	var orange := _mat("ak_mag", Color(0.36, 0.17, 0.06), 0.2, 0.5)
	_box(Vector3(0.026, 0.08, 0.07), Vector3(0, -0.04, 0), orange, Vector3(0.15, 0, 0), mag)
	_box(Vector3(0.026, 0.08, 0.066), Vector3(0, -0.11, -0.03), orange, Vector3(0.5, 0, 0), mag)
	mag.position = Vector3(0, 0.0, -0.17)
	_set_markers(Vector3(0, 0.05, -0.83), Vector3(0.012, 0.005, 0.085), Vector3(-0.02, -0.025, -0.37), Vector3(0, -0.02, -0.17))


func _set_markers(mz: Vector3, gr: Vector3, gl: Vector3, mw: Vector3) -> void:
	muzzle.position = mz
	grip_r.position = gr
	grip_l.position = gl
	mag_well.position = mw
	eject.position = Vector3(0.035, 0.06, -0.08)


func _build_light() -> void:
	_cyl(0.015, 0.08, Vector3(0.042, 0.02, grip_l.position.z - 0.08), _mat("blk", Color(), 0, 0))
	light = SpotLight3D.new()
	add_child(light)
	light.position = Vector3(0.042, 0.02, grip_l.position.z - 0.13)
	light.spot_angle = 26.0
	light.spot_angle_attenuation = 0.9
	light.spot_range = 12.0
	light.spot_attenuation = 0.8
	light.light_energy = 4.0
	light.light_color = Color(1.0, 0.95, 0.85)
	light.light_volumetric_fog_energy = 1.2
	light.shadow_enabled = false
	light.shadow_bias = 0.05


## Collapses the dozens of little parts into one mesh (one draw call per material) and
## caches it per weapon kind, so a squad of ten armed soldiers stays cheap to render.
func _merge_parts() -> void:
	if not _merged.has(kind):
		_merged[kind] = [_combine(self), _combine(mag)]
	for holder in [self, mag]:
		for c in holder.get_children():
			if c is MeshInstance3D and c.get_parent() == holder:
				c.free()
	var body := MeshInstance3D.new()
	body.mesh = _merged[kind][0]
	add_child(body)
	var mm := MeshInstance3D.new()
	mm.mesh = _merged[kind][1]
	mag.add_child(mm)


func _combine(holder: Node3D) -> ArrayMesh:
	var by_mat := {}
	for c in holder.get_children():
		if c is MeshInstance3D:
			var mi := c as MeshInstance3D
			var key := mi.material_override
			if not by_mat.has(key):
				by_mat[key] = []
			by_mat[key].append(mi)
	var out := ArrayMesh.new()
	for mat in by_mat:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for mi in by_mat[mat]:
			st.append_from(mi.mesh, 0, mi.transform)
		st.set_material(mat)
		st.commit(out)
	return out


func flash() -> void:
	_flash_t = 0.05
	flash_root.visible = true
	flash_root.rotation.z = randf() * TAU
	var s := randf_range(0.85, 1.25) * (1.5 if kind == "shotgun" else 1.0)
	flash_root.scale = Vector3(s, s, randf_range(0.8, 1.5))
	flash_light.visible = true
	flash_light.light_energy = randf_range(5.0, 8.0)
	if _smoke:
		_smoke.restart()
		_smoke.emitting = true


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
	mat.albedo_color = Color(1.0, 0.78, 0.42) * 3.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	for i in 3:
		var q := MeshInstance3D.new()
		var qm := QuadMesh.new()
		q.mesh = qm
		q.material_override = mat
		q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flash_root.add_child(q)
		if i < 2:
			qm.size = Vector2(0.2, 0.5)
			q.position.z = -0.2
			q.rotation = Vector3(-PI / 2, 0, i * PI / 2)
		else:
			qm.size = Vector2(0.24, 0.24)
	flash_light.position = Vector3(0, 0.05, -0.1)
	flash_light.light_color = Color(1.0, 0.72, 0.38)
	flash_light.omni_range = 6.0
	flash_light.omni_attenuation = 1.6
	flash_light.shadow_enabled = false
	flash_light.visible = false
	flash_light.light_volumetric_fog_energy = 0.0
	flash_root.add_child(flash_light)
	# barrel smoke wisp
	_smoke = GPUParticles3D.new()
	_smoke.one_shot = true
	_smoke.emitting = false
	_smoke.amount = 5
	_smoke.lifetime = 0.9
	_smoke.explosiveness = 0.8
	_smoke.local_coords = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0.3, -1)
	pm.spread = 20.0
	pm.initial_velocity_min = 0.4
	pm.initial_velocity_max = 1.2
	pm.gravity = Vector3(0, 0.25, 0)
	pm.damping_min = 1.5
	pm.damping_max = 2.5
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.3, 1.0])
	g.colors = PackedColorArray([Color(0.8, 0.8, 0.8, 0.0), Color(0.75, 0.75, 0.75, 0.28), Color(0.7, 0.7, 0.7, 0.0)])
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	var c := Curve.new()
	c.add_point(Vector2(0, 0.4))
	c.add_point(Vector2(1, 1.6))
	var ct := CurveTexture.new()
	ct.curve = c
	c.max_value = 2.0
	pm.scale_curve = ct
	_smoke.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.18, 0.18)
	_smoke.draw_pass_1 = q
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.vertex_color_use_as_albedo = true
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	sm.albedo_texture = Fx.soft_texture()
	_smoke.material_override = sm
	_smoke.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_smoke)
	_smoke.position = muzzle.position


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
	m.metallic_specular = 0.6
	_mats[key] = m
	return m


func _glass(pos: Vector3) -> void:
	var lens := _mat("lens", Color(0.05, 0.12, 0.16), 1.0, 0.05)
	lens.emission_enabled = true
	lens.emission = Color(1.0, 0.15, 0.08)
	lens.emission_energy_multiplier = 0.8
	_cyl(0.021, 0.004, pos, lens)


func _box(size: Vector3, pos: Vector3, mat: Material, rot := Vector3.ZERO, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	(parent if parent else self).add_child(mi)
	return mi


func _cyl(r: float, length: float, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = length
	cm.radial_segments = 10
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = pos
	mi.rotation.x = PI / 2
	add_child(mi)
	return mi
