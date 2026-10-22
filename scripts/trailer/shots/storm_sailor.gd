extends TrailerShot
## Saeed clings to the rail as the ship rolls; a sea comes green over the side and
## tears him away into the dark water. Slightly slowed, handheld.

var ship: Murjan
var sailor: Actor
var spray: GPUParticles3D


func build(tr: Trailer) -> void:
	duration = 3.0
	speed = 0.6
	tr.sky.hour = 19.2
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(2.3)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.0)
	ship.speed = 5.0
	sailor = Actor.create("sailor", {"hold": "m_idle_nervous_02"})
	ship.add_child(sailor)
	var rail_x := -ship.beam * 0.36
	sailor.position = Vector3(rail_x + 0.5, ship.deck_y, -2.0)
	sailor.rotation.y = -PI * 0.5   # facing the port rail
	sailor.ready.connect(func() -> void:
		sailor.play("hold", 0.0, 1.4)
		sailor.feel({"fear": 1.0}, 0.1))
	spray = _spray()
	ship.add_child(spray)
	spray.position = Vector3(rail_x - 1.0, ship.deck_y + 0.5, -2.0)
	follow = ship
	shake = 0.08
	var c := Vector3(1.8, ship.deck_y + 1.7, 1.2)
	keys = [
		[0.0, c, Vector3(rail_x, ship.deck_y + 1.2, -2.0), 44.0, 0.0],
		[3.0, c + Vector3(-0.3, 0.1, -0.4), Vector3(rail_x - 2.0, ship.deck_y + 0.6, -2.4), 48.0, 0.0],
	]
	events = [
		[0.5, func() -> void: tr.lightning(ship.deck_point(-60, -40, 80), 0.8)],
		[1.1, func() -> void: spray.restart(); spray.emitting = true],
		[1.25, func() -> void:
			sailor.feel({"shock": 1.0, "fear": 1.0}, 0.05)
			sailor.go_limp(ship.global_basis * Vector3(-160, 120, 30))],
	]


func tick(time: float, _dt: float) -> void:
	if time > 1.1:
		shake = 0.08 + 0.3 * exp(-(time - 1.1) * 3.0)


func _spray() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 2500
	p.lifetime = 2.0
	p.one_shot = true
	p.explosiveness = 0.8
	p.emitting = false
	p.local_coords = false
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(0.5, 0.5, 4.0)
	m.direction = Vector3(1, 0.7, 0)
	m.spread = 30.0
	m.initial_velocity_min = 5.0
	m.initial_velocity_max = 12.0
	m.gravity = Vector3(0, -9.8, 0)
	m.scale_min = 0.1
	m.scale_max = 0.6
	p.process_material = m
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 0.5)
	var sm := Fx.soft_sprite_material(false)
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	sm.albedo_color = Color(0.8, 0.86, 0.9, 0.5)
	q.material = sm
	p.draw_pass_1 = q
	p.visibility_aabb = AABB(Vector3(-30, -10, -30), Vector3(60, 40, 60))
	return p
