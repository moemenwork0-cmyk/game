extends TrailerShot
## Slow motion: the bow buries itself in a green wall of water, spray exploding over
## the rail towards the camera on the foredeck.

var ship: Murjan
var spray: GPUParticles3D


func build(tr: Trailer) -> void:
	duration = 3.0
	speed = 0.3
	tr.sky.hour = 18.7
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(2.4)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.0)
	ship.speed = 6.0
	spray = _make_spray()
	ship.add_child(spray)
	spray.position = Vector3(0, ship.deck_y + 1.0, -ship.length * 0.46)
	follow = ship
	shake = 0.03
	keys = [
		[0.0, Vector3(1.4, ship.deck_y + 1.7, -ship.length * 0.3), Vector3(0, ship.deck_y + 0.6, -ship.length * 0.75), 60.0, 0.0],
		[3.0, Vector3(1.0, ship.deck_y + 1.5, -ship.length * 0.34), Vector3(0, ship.deck_y + 1.8, -ship.length * 0.8), 56.0, 0.0],
	]
	events = [
		[0.6, func() -> void: spray.restart(); spray.emitting = true],
		[1.8, func() -> void: tr.lightning(ship.deck_point(-40, -80, 70), 1.0)],
	]


func _make_spray() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 3000
	p.lifetime = 2.4
	p.one_shot = true
	p.explosiveness = 0.85
	p.emitting = false
	p.local_coords = false
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(3.5, 0.5, 1.0)
	m.direction = Vector3(0, 0.8, 1.0)
	m.spread = 35.0
	m.initial_velocity_min = 6.0
	m.initial_velocity_max = 16.0
	m.gravity = Vector3(0, -9.8, 0)
	m.scale_min = 0.05
	m.scale_max = 0.5
	m.damping_min = 0.5
	m.damping_max = 2.0
	p.process_material = m
	var q := QuadMesh.new()
	q.size = Vector2(0.4, 0.4)
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	mat.albedo_color = Color(0.85, 0.9, 0.95, 0.35)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	var g := GradientTexture2D.new()
	g.fill = GradientTexture2D.FILL_RADIAL
	g.fill_from = Vector2(0.5, 0.5)
	g.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	g.gradient = gr
	mat.albedo_texture = g
	q.material = mat
	p.draw_pass_1 = q
	p.visibility_aabb = AABB(Vector3(-30, -10, -30), Vector3(60, 40, 60))
	return p
