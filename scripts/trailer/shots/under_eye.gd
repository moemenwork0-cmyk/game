extends TrailerShot
## The hook. Deep green silence under the sea. The drowned clock tower, its hands
## stopped at the hour the world ended. Layla drifts in front of the dial, hair and arms
## floating; light shafts from the surface; bubbles. Her eyes open.

var city: DrownedCity
var layla: Actor
var bubbles: GPUParticles3D


func build(tr: Trailer) -> void:
	duration = 6.6
	tr.sky.hour = 10.5
	tr.sky.storm = 0.0
	tr.sky.underwater = true
	city = DrownedCity.new()
	tr.add_child(city)
	city.build(-80.0, 0.0, 0.0, 0.0, 4)
	_surface(tr)
	var cp := city.clock_point()
	layla = Actor.create("layla", {"float": "f_idle_drunk_01"})
	tr.add_child(layla)
	layla.global_position = cp + Vector3(1.2, -1.75, 5.5)
	layla.rotation = Vector3(0.25, PI + 0.3, 0.1)
	layla.ready.connect(func() -> void:
		layla.play("float", 0.0, 0.25)
		layla.face.lids = 1.0
		layla.feel({"sad": 0.4}, 0.1))
	bubbles = _bubbles()
	layla.add_child(bubbles)
	bubbles.position = Vector3(0, 1.6, 0.1)
	_snow(tr, cp)
	var head := cp + Vector3(1.2, -0.1, 5.5)
	keys = [
		[0.0, cp + Vector3(-10, 1.0, 26), cp + Vector3(0, -1, 0), 40.0, 20.0],
		[3.6, head + Vector3(-1.6, 0.25, 3.0), head + Vector3(0, 0, 0), 30.0, 3.4],
		[6.6, head + Vector3(-0.35, 0.06, 0.75), head + Vector3(0, 0.02, 0), 24.0, 0.8],
	]


func tick(time: float, _dt: float) -> void:
	layla.face.lids = 1.0 - smoothstep(5.2, 6.2, time)
	layla.position.y += sin(time * 0.8) * 0.0015


func _surface(tr: Trailer) -> void:
	var q := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(3000, 3000)
	pm.flip_faces = true
	q.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/trailer/under_surface.gdshader")
	q.material_override = m
	q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	tr.add_child(q)


func _bubbles() -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 40
	p.lifetime = 4.0
	var m := ParticleProcessMaterial.new()
	m.direction = Vector3.UP
	m.spread = 12.0
	m.initial_velocity_min = 0.2
	m.initial_velocity_max = 0.5
	m.gravity = Vector3(0, 0.6, 0)
	m.turbulence_enabled = true
	m.turbulence_noise_strength = 0.3
	m.scale_min = 0.3
	m.scale_max = 1.0
	p.process_material = m
	var s := SphereMesh.new()
	s.radius = 0.012
	s.height = 0.024
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.8, 0.95, 1.0, 0.35)
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.metallic_specular = 1.0
	bm.roughness = 0.0
	bm.rim_enabled = true
	bm.rim = 1.0
	s.material = bm
	p.draw_pass_1 = s
	return p


## Drifting specks in the water column (marine snow) that sell depth and scale.
func _snow(tr: Trailer, at: Vector3) -> void:
	var p := GPUParticles3D.new()
	p.amount = 3000
	p.lifetime = 12.0
	p.preprocess = 12.0
	p.visibility_aabb = AABB(Vector3(-40, -20, -40), Vector3(80, 40, 80))
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	m.emission_box_extents = Vector3(30, 14, 30)
	m.gravity = Vector3(0, -0.03, 0)
	m.initial_velocity_max = 0.05
	m.turbulence_enabled = true
	m.turbulence_noise_strength = 0.05
	m.scale_min = 0.4
	m.scale_max = 1.2
	p.process_material = m
	var q := QuadMesh.new()
	q.size = Vector2(0.03, 0.03)
	var sm := Fx.soft_sprite_material(true)
	sm.albedo_color = Color(0.5, 0.65, 0.6, 0.5)
	q.material = sm
	p.draw_pass_1 = q
	p.position = at + Vector3(0, 0, 10)
	tr.add_child(p)
