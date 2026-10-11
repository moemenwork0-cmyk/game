extends Node
## Visual effects (autoload "Fx"): tracers, impacts, blood, decals, casings,
## dropped mags / weapons, hit flash and camera trauma.

signal trauma_added(amount: float)

var world: Node3D           ## where effects are spawned (set by Main)
var _decals: Array[Node3D] = []
var _casings: Array[RigidBody3D] = []
var _tex := {}
var _mats := {}
var _brass: StandardMaterial3D
var _dark_metal: StandardMaterial3D

const SURF_COLORS := {
	"concrete": Color(0.55, 0.54, 0.5), "plaster": Color(0.7, 0.68, 0.62), "wood": Color(0.42, 0.28, 0.16),
	"fabric": Color(0.3, 0.32, 0.26), "metal": Color(0.3, 0.3, 0.3),
}


func _ready() -> void:
	_tex["soft"] = _make_tex(64, func(p: Vector2) -> Color:
		var a := clampf(1.0 - p.length(), 0.0, 1.0)
		return Color(1, 1, 1, a * a))
	_tex["hole"] = _make_tex(64, _hole_px)
	_tex["blood"] = _make_blood_tex(128, 7)
	_tex["splat"] = _make_blood_tex(128, 13)
	_brass = StandardMaterial3D.new()
	_brass.albedo_color = Color(0.78, 0.58, 0.25)
	_brass.metallic = 1.0
	_brass.roughness = 0.3
	_dark_metal = StandardMaterial3D.new()
	_dark_metal.albedo_color = Color(0.06, 0.06, 0.065)
	_dark_metal.metallic = 0.7
	_dark_metal.roughness = 0.4


func shake(amount: float) -> void:
	trauma_added.emit(amount)


# ------------------------------------------------------------------ tracers

func tracer(a: Vector3, b: Vector3, team: int) -> void:
	if world == null:
		return
	var len := a.distance_to(b)
	if len < 0.3:
		return
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	var streak := minf(2.2, len)
	bm.size = Vector3(0.018, 0.018, streak)
	mi.mesh = bm
	mi.material_override = _glow_mat("tracer%d" % team, Color(1.0, 0.82, 0.45) if team == 0 else Color(1.0, 0.45, 0.25), 9.0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)
	var dir := (b - a).normalized()
	mi.look_at_from_position(a + dir * streak * 0.5, a + dir * (streak * 0.5 + 1.0), Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT)
	var t := mi.create_tween()
	var dur := len / 140.0
	t.tween_property(mi, "global_position", b - dir * streak * 0.5, dur)
	t.tween_callback(mi.queue_free)


# ------------------------------------------------------------------ impacts

func impact(pos: Vector3, normal: Vector3, dir: Vector3, surface: String) -> void:
	if world == null:
		return
	var col: Color = SURF_COLORS.get(surface, SURF_COLORS["concrete"])
	if surface != "fabric":
		_burst(pos, normal, "spark", 12 if surface in ["concrete", "metal", "plaster"] else 5)
	_burst(pos, normal, "dust", 6, col)
	_burst(pos, normal, "chip", 9, col)
	_decal(pos, normal, _tex["hole"], randf_range(0.07, 0.11), Color(1, 1, 1, 0.92))
	match surface:
		"wood": Sfx.play_at("imp_wood", pos, -2.0, randf_range(0.85, 1.15))
		"metal": Sfx.play_at("imp_metal", pos, -2.0, randf_range(0.85, 1.15))
		"fabric": Sfx.play_at("imp_fabric", pos, -4.0, randf_range(0.85, 1.15))
		_:
			Sfx.play_at("imp_concrete", pos, -2.0, randf_range(0.85, 1.2))
			if randf() < 0.22:
				Sfx.play_at("ricochet", pos, -6.0, randf_range(0.8, 1.25))


func blood(pos: Vector3, dir: Vector3, k: float) -> void:
	if world == null:
		return
	_burst(pos, dir.normalized(), "blood", int(16 * k))
	_burst(pos, -dir.normalized(), "blood", int(5 * k))
	_burst(pos, dir.normalized(), "mist", 3)
	# splatter on whatever is behind the victim
	var space := world.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(pos, pos + (dir.normalized() + Vector3(0, -0.6, 0)).normalized() * 2.2, 1 | 4)
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		_decal(hit.position, hit.normal, _tex["splat"], randf_range(0.35, 0.7) * k, Color(0.45, 0.02, 0.02, 0.95))
	else:
		_decal(Vector3(pos.x + dir.x, 0.0, pos.z + dir.z), Vector3.UP, _tex["blood"], randf_range(0.3, 0.6) * k, Color(0.4, 0.02, 0.02, 0.9))


func blood_pool(pos: Vector3) -> void:
	if world == null:
		return
	var d := _decal(Vector3(pos.x, 0.0, pos.z), Vector3.UP, _tex["blood"], 0.2, Color(0.3, 0.01, 0.01, 0.97))
	d.create_tween().tween_property(d, "size", Vector3(1.9, 0.6, 1.9), 6.0).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)


func flash_hit(s: Soldier) -> void:
	for mi in s.model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for i in m.mesh.get_surface_count():
			var mat := m.get_surface_override_material(i) as StandardMaterial3D
			if mat:
				mat.emission_energy_multiplier = 1.6
				m.create_tween().set_ignore_time_scale(true).tween_property(mat, "emission_energy_multiplier", 0.0, 0.14)


# ------------------------------------------------------------------ physical debris

func casing(rifle_xf: Transform3D, shooter_vel: Vector3) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 0.02
	rb.collision_layer = 0
	rb.collision_mask = 1
	rb.continuous_cd = true
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 0.012
	sh.height = 0.05
	cs.shape = sh
	rb.add_child(cs)
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.006
	cm.bottom_radius = 0.006
	cm.height = 0.045
	cm.radial_segments = 6
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _brass
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	rb.add_child(mi)
	var pm := PhysicsMaterial.new()
	pm.bounce = 0.45
	pm.friction = 0.6
	rb.physics_material_override = pm
	world.add_child(rb)
	rb.global_transform = Transform3D(rifle_xf.basis * Basis(Vector3.RIGHT, PI / 2), rifle_xf * Vector3(0.04, 0.06, -0.08))
	var b := rifle_xf.basis
	rb.linear_velocity = shooter_vel * 0.8 + b.x * randf_range(1.8, 2.8) + Vector3.UP * randf_range(1.5, 2.5) + b.z * randf_range(0.2, 0.8)
	rb.angular_velocity = Vector3(randf_range(-20, 20), randf_range(-20, 20), randf_range(-20, 20))
	rb.contact_monitor = true
	rb.max_contacts_reported = 1
	rb.body_entered.connect(func(_b: Node) -> void:
		if rb.linear_velocity.length() > 0.6:
			Sfx.play_at("casing", rb.global_position, -10.0, randf_range(0.85, 1.25)), CONNECT_DEFERRED)
	_casings.append(rb)
	if _casings.size() > 36:
		var old: RigidBody3D = _casings.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	get_tree().create_timer(2.5).timeout.connect(func() -> void:
		if is_instance_valid(rb):
			rb.contact_monitor = false
			rb.freeze = true)


func drop_mag(xf: Transform3D, vel: Vector3) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 0.4
	rb.collision_layer = 4
	rb.collision_mask = 1 | 4 | 16
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(0.032, 0.19, 0.07)
	cs.shape = sh
	cs.position.y = -0.09
	rb.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = sh.size
	mi.mesh = bm
	mi.position.y = -0.09
	mi.material_override = _dark_metal
	rb.add_child(mi)
	world.add_child(rb)
	rb.global_transform = xf
	rb.linear_velocity = vel + Vector3(0, -1.0, 0)
	rb.angular_velocity = Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
	rb.contact_monitor = true
	rb.max_contacts_reported = 1
	rb.body_entered.connect(func(_b: Node) -> void:
		if rb.linear_velocity.length() > 0.8:
			Sfx.play_at("mag_drop", rb.global_position, -4.0, randf_range(0.9, 1.1)), CONNECT_DEFERRED)
	rb.set_meta("surface", "metal")


func drop_weapon(rifle: Rifle, dir: Vector3) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 3.5
	rb.collision_layer = 4
	rb.collision_mask = 1 | 4
	rb.set_meta("surface", "metal")
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(0.07, 0.16, 1.05)
	cs.shape = sh
	cs.position = Vector3(0, 0.03, -0.24)
	rb.add_child(cs)
	world.add_child(rb)
	var xf := rifle.global_transform
	rb.global_transform = xf
	rifle.top_level = false
	rifle.reparent(rb, false)
	rifle.transform = Transform3D()
	rb.linear_velocity = dir * 1.5 + Vector3.UP * 1.2
	rb.angular_velocity = Vector3(randf_range(-5, 5), randf_range(-6, 6), randf_range(-5, 5))
	rb.contact_monitor = true
	rb.max_contacts_reported = 1
	rb.body_entered.connect(func(_b: Node) -> void:
		if rb.linear_velocity.length() > 0.8:
			Sfx.play_at("gun_drop", rb.global_position, 0.0, randf_range(0.9, 1.1)), CONNECT_DEFERRED)


# ------------------------------------------------------------------ particles

func _burst(pos: Vector3, dir: Vector3, kind: String, amount: int, tint := Color.WHITE) -> void:
	if amount <= 0:
		return
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = amount
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	var q := QuadMesh.new()
	match kind:
		"spark":
			p.lifetime = 0.35
			pm.spread = 55.0
			pm.initial_velocity_min = 3.0
			pm.initial_velocity_max = 8.5
			pm.gravity = Vector3(0, -9.8, 0)
			pm.scale_min = 0.6
			pm.scale_max = 1.2
			pm.color_ramp = _ramp([Color(1, 0.95, 0.7, 1), Color(1, 0.55, 0.15, 1), Color(1, 0.3, 0.05, 0)])
			q.size = Vector2(0.025, 0.025)
			p.draw_pass_1 = q
			p.material_override = _particle_mat("spark", true, null, 6.0)
			p.collision_base_size = 0.01
			pm.collision_mode = ParticleProcessMaterial.COLLISION_RIGID
			pm.collision_bounce = 0.35
			pm.collision_friction = 0.2
		"dust":
			p.lifetime = 1.1
			pm.spread = 35.0
			pm.initial_velocity_min = 0.4
			pm.initial_velocity_max = 1.6
			pm.gravity = Vector3(0, 0.1, 0)
			pm.damping_min = 1.5
			pm.damping_max = 2.5
			pm.scale_min = 0.6
			pm.scale_max = 1.3
			pm.scale_curve = _curve_tex([0.4, 1.6])
			pm.angle_min = -180
			pm.angle_max = 180
			var c := tint.lightened(0.15)
			pm.color_ramp = _ramp([Color(c, 0.55), Color(c, 0.3), Color(c, 0.0)])
			q.size = Vector2(0.28, 0.28)
			p.draw_pass_1 = q
			p.material_override = _particle_mat("dust", false, _tex["soft"], 0.0)
		"chip":
			p.lifetime = 1.2
			pm.spread = 50.0
			pm.initial_velocity_min = 1.5
			pm.initial_velocity_max = 4.0
			pm.gravity = Vector3(0, -9.8, 0)
			pm.angular_velocity_min = -600
			pm.angular_velocity_max = 600
			pm.scale_min = 0.5
			pm.scale_max = 1.4
			pm.color = tint.darkened(0.2)
			pm.collision_mode = ParticleProcessMaterial.COLLISION_RIGID
			pm.collision_bounce = 0.25
			pm.collision_friction = 0.6
			var bm := BoxMesh.new()
			bm.size = Vector3(0.018, 0.012, 0.022)
			p.draw_pass_1 = bm
			p.material_override = _lit_mat("chip")
		"blood":
			p.lifetime = 0.7
			pm.spread = 28.0
			pm.initial_velocity_min = 1.8
			pm.initial_velocity_max = 5.0
			pm.gravity = Vector3(0, -9.8, 0)
			pm.scale_min = 0.5
			pm.scale_max = 1.5
			pm.color_ramp = _ramp([Color(0.55, 0.02, 0.02, 1), Color(0.35, 0.01, 0.01, 0.9), Color(0.25, 0.0, 0.0, 0)])
			pm.collision_mode = ParticleProcessMaterial.COLLISION_HIDE_ON_CONTACT
			q.size = Vector2(0.045, 0.045)
			p.draw_pass_1 = q
			p.material_override = _particle_mat("blood", false, _tex["soft"], 0.0)
		"mist":
			p.lifetime = 0.6
			pm.spread = 30.0
			pm.initial_velocity_min = 0.6
			pm.initial_velocity_max = 1.4
			pm.damping_min = 2.0
			pm.damping_max = 3.0
			pm.scale_curve = _curve_tex([0.5, 1.8])
			pm.color_ramp = _ramp([Color(0.5, 0.03, 0.03, 0.55), Color(0.4, 0.02, 0.02, 0.0)])
			q.size = Vector2(0.35, 0.35)
			p.draw_pass_1 = q
			p.material_override = _particle_mat("mist", false, _tex["soft"], 0.0)
	p.process_material = pm
	world.add_child(p)
	p.global_position = pos + dir * 0.02
	if absf(dir.normalized().dot(Vector3.UP)) < 0.999:
		p.look_at(pos + dir, Vector3.UP)
		p.rotate_object_local(Vector3.RIGHT, -PI / 2)
	p.emitting = true
	p.finished.connect(p.queue_free)


func _decal(pos: Vector3, normal: Vector3, tex: Texture2D, size: float, mod: Color) -> Decal:
	var d := Decal.new()
	d.texture_albedo = tex
	d.modulate = mod
	d.size = Vector3(size, 0.25, size)
	d.upper_fade = 0.3
	d.lower_fade = 0.3
	d.cull_mask = 1
	world.add_child(d)
	var n := normal.normalized()
	var x := n.cross(Vector3.UP if absf(n.y) < 0.95 else Vector3.RIGHT).normalized()
	var z := x.cross(n).normalized()
	d.global_transform = Transform3D(Basis(x, n, z) * Basis(Vector3.UP, randf() * TAU), pos)
	_decals.append(d)
	if _decals.size() > 90:
		var old: Node3D = _decals.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	return d


# ------------------------------------------------------------------ resources

func _glow_mat(key: String, c: Color, energy: float) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c * energy
	_mats[key] = m
	return m


func _particle_mat(key: String, additive: bool, tex: Texture2D, energy: float) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	if tex:
		m.albedo_texture = tex
	if energy > 0.0:
		m.albedo_color = Color(energy, energy, energy)
	_mats[key] = m
	return m


func _lit_mat(key: String) -> StandardMaterial3D:
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.9
	_mats[key] = m
	return m


func _ramp(cols: Array) -> GradientTexture1D:
	var g := Gradient.new()
	var offs := PackedFloat32Array()
	var cs := PackedColorArray()
	for i in cols.size():
		offs.append(float(i) / (cols.size() - 1))
		cs.append(cols[i])
	g.offsets = offs
	g.colors = cs
	var t := GradientTexture1D.new()
	t.gradient = g
	return t


func _curve_tex(vals: Array) -> CurveTexture:
	var c := Curve.new()
	c.max_value = 3.0
	for i in vals.size():
		c.add_point(Vector2(float(i) / (vals.size() - 1), vals[i]))
	var t := CurveTexture.new()
	t.curve = c
	return t


func _make_tex(n: int, f: Callable) -> ImageTexture:
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			img.set_pixel(x, y, f.call(Vector2(x + 0.5, y + 0.5) / n * 2.0 - Vector2.ONE))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


func _hole_px(p: Vector2) -> Color:
	var r := p.length()
	var a := atan2(p.y, p.x)
	var core := clampf(1.0 - r / 0.22, 0.0, 1.0)
	var crack := pow(absf(sin(a * 5.0 + 1.3)), 18.0) * clampf(1.0 - r, 0.0, 1.0) * 0.7
	var ring := clampf(1.0 - absf(r - 0.3) / 0.25, 0.0, 1.0) * 0.45
	var v := clampf(core + crack + ring, 0.0, 1.0)
	var c := lerpf(0.35, 0.03, core)
	return Color(c, c, c, v)


func _make_blood_tex(n: int, blobs: int) -> ImageTexture:
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var centers := []
	var rng := RandomNumberGenerator.new()
	rng.seed = blobs * 97
	centers.append([Vector2.ZERO, 0.42])
	for i in blobs:
		var ang := rng.randf() * TAU
		var dist := rng.randf_range(0.2, 0.8)
		centers.append([Vector2(cos(ang), sin(ang)) * dist, rng.randf_range(0.04, 0.16) * (1.2 - dist)])
	for y in n:
		for x in n:
			var p := Vector2(x + 0.5, y + 0.5) / n * 2.0 - Vector2.ONE
			var v := 0.0
			for c in centers:
				v += (c[1] * c[1]) / maxf((p - c[0]).length_squared(), 0.0001)
			var a := smoothstep(0.9, 1.2, v)
			var shade := clampf(0.75 + 0.25 * (1.0 - v * 0.1), 0.5, 1.0)
			img.set_pixel(x, y, Color(shade, shade, shade, a))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)
