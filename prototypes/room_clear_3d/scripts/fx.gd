extends Node
## Visual effects (autoload "Fx"). Particle emitters are pooled and re-used (no node churn,
## shaders compile once during prewarm). Tracers, impacts, blood, decals, casings, dropped
## mags / weapons, explosions, hit flash, camera trauma, hitstop and floating score popups.

signal trauma_added(amount: float)
signal popup(pos: Vector3, text: String, col: Color, size: float)

var world: Node3D           ## where effects are spawned (set by the game scene)
var _decals: Array[Node3D] = []
var _casings: Array[RigidBody3D] = []
var _pools := {}
var _pool_i := {}
var _tex := {}
var _mats := {}
var _brass: StandardMaterial3D
var _shell: StandardMaterial3D
var _dark_metal: StandardMaterial3D
var _hitstop_t := 0.0

const SURF_COLORS := {
	"concrete": Color(0.55, 0.54, 0.5), "plaster": Color(0.72, 0.7, 0.64), "wood": Color(0.45, 0.3, 0.17),
	"fabric": Color(0.32, 0.34, 0.28), "metal": Color(0.35, 0.35, 0.36),
}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_tex["soft"] = _make_tex(64, func(p: Vector2) -> Color:
		var a := clampf(1.0 - p.length(), 0.0, 1.0)
		return Color(1, 1, 1, a * a))
	_tex["hole"] = _make_tex(64, _hole_px)
	_tex["blood"] = _make_blood_tex(128, 7)
	_tex["splat"] = _make_blood_tex(128, 13)
	_tex["scorch"] = _make_tex(128, func(p: Vector2) -> Color:
		var r := p.length()
		var n := sin(atan2(p.y, p.x) * 7.0) * 0.08
		var a := clampf(1.0 - (r + n) / 0.95, 0.0, 1.0)
		return Color(0.05, 0.045, 0.04, pow(a, 0.7)))
	_brass = _metal(Color(0.8, 0.6, 0.25), 1.0, 0.28)
	_shell = _metal(Color(0.7, 0.08, 0.06), 0.2, 0.45)
	_dark_metal = _metal(Color(0.06, 0.06, 0.065), 0.7, 0.4)


func _metal(c: Color, m: float, r: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = c
	mat.metallic = m
	mat.roughness = r
	return mat


func soft_texture() -> Texture2D:
	return _tex["soft"]


func low_quality() -> bool:
	return Game.quality == 0


## Called by the game scene after the level exists: builds the emitter pools and fires every
## effect once out of sight so all shaders are compiled before the player can see a hitch.
func setup(w: Node3D) -> void:
	world = w
	_pools.clear()
	_pool_i.clear()
	_decals.clear()
	_casings.clear()
	var n := 5 if low_quality() else 9
	for k in ["spark", "dust", "chip", "blood", "mist"]:
		_pools[k] = []
		for i in n:
			var p := _make_emitter(k)
			world.add_child(p)
			p.global_position = Vector3(0, -50, 0)
			_pools[k].append(p)
		_pool_i[k] = 0
	for k in ["fire", "smoke", "debris", "bigspark"]:
		_pools[k] = []
		for i in 2:
			var p := _make_emitter(k)
			world.add_child(p)
			p.global_position = Vector3(0, -50, 0)
			_pools[k].append(p)
		_pool_i[k] = 0
	# prewarm: one of everything, far below the floor
	for k in _pools:
		_emit(k, Vector3(0, -50, 0), Vector3.UP, 4, Color.WHITE)
	tracer(Vector3(0, -50, 0), Vector3(1, -50, 0), 0)
	tracer(Vector3(0, -50, 0), Vector3(1, -50, 0), 1)
	var d := _decal(Vector3(0, -50, 0), Vector3.UP, _tex["hole"], 0.1, Color.WHITE)
	d.queue_free()
	_decals.clear()


func shake(amount: float) -> void:
	trauma_added.emit(amount)


## Freeze-frame for impact (kills, explosions). Real-time, so it ignores slow motion.
func hitstop(dur: float, scale := 0.05) -> void:
	if Engine.time_scale < 0.9 and _hitstop_t <= 0.0:
		return
	_hitstop_t = maxf(_hitstop_t, dur)
	Engine.time_scale = scale


func _process(delta: float) -> void:
	if _hitstop_t > 0.0:
		_hitstop_t -= delta / maxf(Engine.time_scale, 0.01)
		if _hitstop_t <= 0.0:
			Engine.time_scale = 1.0


# ------------------------------------------------------------------ tracers

func tracer(a: Vector3, b: Vector3, team: int) -> void:
	if world == null:
		return
	var len := a.distance_to(b)
	if len < 0.3:
		return
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	var streak := minf(2.4, len)
	bm.size = Vector3(0.02, 0.02, streak)
	mi.mesh = bm
	mi.material_override = _glow_mat("tracer%d" % team, Color(1.0, 0.85, 0.5) if team == 0 else Color(1.0, 0.42, 0.22), 10.0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(mi)
	var dir := (b - a).normalized()
	mi.look_at_from_position(a + dir * streak * 0.5, a + dir * (streak * 0.5 + 1.0), Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT)
	var t := mi.create_tween()
	t.tween_property(mi, "global_position", b - dir * streak * 0.5, len / 150.0)
	t.tween_callback(mi.queue_free)


# ------------------------------------------------------------------ impacts

func impact(pos: Vector3, normal: Vector3, dir: Vector3, surface: String) -> void:
	if world == null:
		return
	var col: Color = SURF_COLORS.get(surface, SURF_COLORS["concrete"])
	if surface != "fabric":
		_emit("spark", pos, normal, 14 if surface in ["concrete", "metal", "plaster"] else 6)
	_emit("dust", pos, normal, 6, col)
	_emit("chip", pos, normal, 10, col)
	_decal(pos, normal, _tex["hole"], randf_range(0.07, 0.11), Color(1, 1, 1, 0.92))
	match surface:
		"wood": Sfx.play_at("imp_wood", pos, -2.0, randf_range(0.85, 1.15))
		"metal": Sfx.play_at("imp_metal", pos, -2.0, randf_range(0.85, 1.15))
		"fabric": Sfx.play_at("imp_fabric", pos, -4.0, randf_range(0.85, 1.15))
		_:
			Sfx.play_at("imp_concrete", pos, -2.0, randf_range(0.85, 1.2))
			if randf() < 0.2:
				Sfx.play_at("ricochet", pos, -6.0, randf_range(0.8, 1.25))


func blood(pos: Vector3, dir: Vector3, k: float) -> void:
	if world == null:
		return
	var d := dir.normalized()
	_emit("blood", pos, d, int(18 * k))
	_emit("mist", pos, d, 3)
	var space := world.get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(pos, pos + (d + Vector3(0, -0.6, 0)).normalized() * 2.2, 1 | 4)
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		_decal(hit.position, hit.normal, _tex["splat"], randf_range(0.35, 0.7) * k, Color(0.45, 0.02, 0.02, 0.95))
	else:
		_decal(Vector3(pos.x + d.x, 0.0, pos.z + d.z), Vector3.UP, _tex["blood"], randf_range(0.3, 0.6) * k, Color(0.4, 0.02, 0.02, 0.9))


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
			if mat and mat.emission_enabled:
				mat.emission_energy_multiplier = 1.8
				m.create_tween().set_ignore_time_scale(true).tween_property(mat, "emission_energy_multiplier", 0.0, 0.14)


func dust_puff(pos: Vector3, dir: Vector3) -> void:
	_emit("dust", pos + Vector3(0, 0.1, 0), (-dir + Vector3.UP * 0.5).normalized(), 8, Color(0.6, 0.6, 0.58))


func grenade_thrown(_g: Node3D) -> void:
	pass


func explosion(pos: Vector3) -> void:
	if world == null:
		return
	_emit("fire", pos, Vector3.UP, 24)
	_emit("smoke", pos, Vector3.UP, 14)
	_emit("bigspark", pos, Vector3.UP, 40)
	_emit("debris", pos, Vector3.UP, 22, Color(0.3, 0.3, 0.28))
	_decal(Vector3(pos.x, 0.0, pos.z), Vector3.UP, _tex["scorch"], 2.6, Color(1, 1, 1, 0.95))
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.62, 0.3)
	l.omni_range = 9.0
	l.light_energy = 14.0
	l.shadow_enabled = false
	world.add_child(l)
	l.global_position = pos + Vector3(0, 0.8, 0)
	var t := l.create_tween().set_ignore_time_scale(true)
	t.tween_property(l, "light_energy", 0.0, 0.5).set_ease(Tween.EASE_OUT)
	t.tween_callback(l.queue_free)
	# shockwave ring on the floor
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.9
	tm.outer_radius = 1.0
	tm.rings = 24
	ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	rm.albedo_color = Color(1.0, 0.7, 0.4, 0.6)
	ring.material_override = rm
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(ring)
	ring.global_position = Vector3(pos.x, 0.08, pos.z)
	ring.scale = Vector3(0.3, 0.1, 0.3)
	var rt := ring.create_tween().set_parallel()
	rt.tween_property(ring, "scale", Vector3(5.5, 0.2, 5.5), 0.35).set_ease(Tween.EASE_OUT)
	rt.tween_property(rm, "albedo_color:a", 0.0, 0.35)
	rt.chain().tween_callback(ring.queue_free)
	Sfx.play_at("explosion", pos, 6.0, randf_range(0.92, 1.05))
	shake(0.9)
	hitstop(0.06, 0.08)


func popup_text(pos: Vector3, txt: String, col := Color.WHITE, size := 1.0) -> void:
	popup.emit(pos, txt, col, size)


# ------------------------------------------------------------------ physical debris

func casing(rifle_xf: Transform3D, shooter_vel: Vector3, shell := false) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 0.02
	rb.collision_layer = 0
	rb.collision_mask = 1
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 0.014 if shell else 0.012
	sh.height = 0.07 if shell else 0.05
	cs.shape = sh
	rb.add_child(cs)
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.011 if shell else 0.006
	cm.bottom_radius = cm.top_radius
	cm.height = 0.065 if shell else 0.045
	cm.radial_segments = 6
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _shell if shell else _brass
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
	var cap := 12 if low_quality() else 28
	while _casings.size() > cap:
		var old: RigidBody3D = _casings.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	get_tree().create_timer(1.6).timeout.connect(_settle.bind(rb.get_instance_id(), false))


func drop_mag(xf: Transform3D, vel: Vector3) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 0.4
	rb.collision_layer = 4
	rb.collision_mask = 1 | 4 | 16
	rb.add_to_group("physics_props")
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
	get_tree().create_timer(6.0).timeout.connect(_settle.bind(rb.get_instance_id(), true))


## Timer callback by instance id (a lambda capturing a freed body would log errors).
func _settle(id: int, remove: bool) -> void:
	var rb := instance_from_id(id) as RigidBody3D
	if rb == null or not is_instance_valid(rb):
		return
	if remove:
		rb.queue_free()
	else:
		rb.contact_monitor = false
		rb.freeze = true


func drop_weapon(rifle: Rifle, dir: Vector3) -> void:
	if world == null:
		return
	var rb := RigidBody3D.new()
	rb.mass = 3.5
	rb.collision_layer = 4
	rb.collision_mask = 1 | 4 | 16
	rb.add_to_group("physics_props")
	rb.set_meta("surface", "metal")
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(0.07, 0.16, 1.05)
	cs.shape = sh
	cs.position = Vector3(0, 0.03, -0.24)
	rb.add_child(cs)
	world.add_child(rb)
	rb.global_transform = rifle.global_transform
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


# ------------------------------------------------------------------ pooled particles

func _emit(kind: String, pos: Vector3, dir: Vector3, amount: int, tint := Color.WHITE) -> void:
	if not _pools.has(kind) or amount <= 0:
		return
	var arr: Array = _pools[kind]
	var i: int = _pool_i[kind]
	_pool_i[kind] = (i + 1) % arr.size()
	var p: GPUParticles3D = arr[i]
	if not is_instance_valid(p):
		return
	if low_quality():
		amount = maxi(2, amount / 2)
	p.amount_ratio = clampf(float(amount) / p.amount, 0.05, 1.0)
	var pm := p.process_material as ParticleProcessMaterial
	if kind == "chip" or kind == "debris":
		pm.color = tint.darkened(0.2)
	elif kind == "dust":
		var c := tint.lightened(0.15)
		pm.color = c
	p.global_position = pos + dir * 0.02
	var n := dir.normalized()
	if absf(n.dot(Vector3.UP)) < 0.999:
		p.look_at(pos + n, Vector3.UP)
		p.rotate_object_local(Vector3.RIGHT, -PI / 2)
	else:
		p.rotation = Vector3.ZERO if n.y > 0 else Vector3(PI, 0, 0)
	p.restart()
	p.emitting = true


func _make_emitter(kind: String) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.explosiveness = 0.95
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visibility_aabb = AABB(Vector3(-6, -6, -6), Vector3(12, 12, 12))
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	var q := QuadMesh.new()
	match kind:
		"spark", "bigspark":
			var big := kind == "bigspark"
			p.amount = 40 if big else 16
			p.lifetime = 0.6 if big else 0.35
			pm.spread = 80.0 if big else 55.0
			pm.initial_velocity_min = 4.0 if big else 3.0
			pm.initial_velocity_max = 14.0 if big else 8.5
			pm.gravity = Vector3(0, -9.8, 0)
			pm.scale_min = 0.6
			pm.scale_max = 1.3
			pm.color_ramp = _ramp([Color(1, 0.95, 0.7, 1), Color(1, 0.55, 0.15, 1), Color(1, 0.3, 0.05, 0)])
			pm.collision_mode = ParticleProcessMaterial.COLLISION_RIGID
			pm.collision_bounce = 0.35
			pm.collision_friction = 0.2
			p.collision_base_size = 0.01
			q.size = Vector2(0.03, 0.03)
			p.material_override = _particle_mat("spark", true, null, 6.0)
		"dust":
			p.amount = 10
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
			pm.color_ramp = _ramp([Color(1, 1, 1, 0.55), Color(1, 1, 1, 0.3), Color(1, 1, 1, 0.0)])
			q.size = Vector2(0.3, 0.3)
			p.material_override = _particle_mat("dust", false, _tex["soft"], 0.0)
		"chip", "debris":
			var big := kind == "debris"
			p.amount = 24 if big else 12
			p.lifetime = 1.6 if big else 1.2
			pm.spread = 70.0 if big else 50.0
			pm.initial_velocity_min = 3.0 if big else 1.5
			pm.initial_velocity_max = 9.0 if big else 4.0
			pm.gravity = Vector3(0, -9.8, 0)
			pm.angular_velocity_min = -600
			pm.angular_velocity_max = 600
			pm.scale_min = 0.5
			pm.scale_max = 1.6 if big else 1.4
			pm.collision_mode = ParticleProcessMaterial.COLLISION_RIGID
			pm.collision_bounce = 0.25
			pm.collision_friction = 0.6
			var bm := BoxMesh.new()
			bm.size = Vector3(0.04, 0.03, 0.05) if big else Vector3(0.018, 0.012, 0.022)
			p.draw_pass_1 = bm
			p.material_override = _lit_mat("chip")
		"blood":
			p.amount = 24
			p.lifetime = 0.7
			pm.spread = 28.0
			pm.initial_velocity_min = 1.8
			pm.initial_velocity_max = 5.0
			pm.gravity = Vector3(0, -9.8, 0)
			pm.scale_min = 0.5
			pm.scale_max = 1.5
			pm.color_ramp = _ramp([Color(0.55, 0.02, 0.02, 1), Color(0.35, 0.01, 0.01, 0.9), Color(0.25, 0.0, 0.0, 0)])
			pm.collision_mode = ParticleProcessMaterial.COLLISION_HIDE_ON_CONTACT
			q.size = Vector2(0.05, 0.05)
			p.material_override = _particle_mat("blood", false, _tex["soft"], 0.0)
		"mist":
			p.amount = 4
			p.lifetime = 0.6
			pm.spread = 30.0
			pm.initial_velocity_min = 0.6
			pm.initial_velocity_max = 1.4
			pm.damping_min = 2.0
			pm.damping_max = 3.0
			pm.scale_curve = _curve_tex([0.5, 1.8])
			pm.color_ramp = _ramp([Color(0.5, 0.03, 0.03, 0.55), Color(0.4, 0.02, 0.02, 0.0)])
			q.size = Vector2(0.38, 0.38)
			p.material_override = _particle_mat("mist", false, _tex["soft"], 0.0)
		"fire":
			p.amount = 24
			p.lifetime = 0.55
			p.explosiveness = 1.0
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
			pm.emission_sphere_radius = 0.35
			pm.spread = 180.0
			pm.initial_velocity_min = 2.0
			pm.initial_velocity_max = 6.0
			pm.damping_min = 6.0
			pm.damping_max = 9.0
			pm.gravity = Vector3(0, 2.0, 0)
			pm.scale_curve = _curve_tex([0.6, 2.2, 1.2])
			pm.angle_min = -180
			pm.angle_max = 180
			pm.color_ramp = _ramp([Color(1, 0.95, 0.75, 1), Color(1, 0.55, 0.15, 0.95), Color(0.5, 0.15, 0.05, 0.0)])
			q.size = Vector2(1.1, 1.1)
			p.material_override = _particle_mat("fire", true, _tex["soft"], 3.0)
		"smoke":
			p.amount = 14
			p.lifetime = 2.6
			p.explosiveness = 0.9
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
			pm.emission_sphere_radius = 0.5
			pm.spread = 180.0
			pm.initial_velocity_min = 1.0
			pm.initial_velocity_max = 3.0
			pm.damping_min = 2.0
			pm.damping_max = 3.0
			pm.gravity = Vector3(0, 0.5, 0)
			pm.scale_curve = _curve_tex([0.8, 2.6])
			pm.angle_min = -180
			pm.angle_max = 180
			pm.color_ramp = _ramp([Color(0.1, 0.09, 0.08, 0.0), Color(0.12, 0.11, 0.1, 0.7), Color(0.2, 0.2, 0.2, 0.0)])
			q.size = Vector2(1.4, 1.4)
			p.material_override = _particle_mat("smoke", false, _tex["soft"], 0.0)
	if p.draw_pass_1 == null:
		p.draw_pass_1 = q
	p.process_material = pm
	return p


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
	var cap := 30 if low_quality() else 80
	while _decals.size() > cap:
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
