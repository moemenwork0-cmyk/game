class_name Campfire
extends StaticBody3D
## Stone ring + logs + fire/smoke particles + flickering light + crackle.

var _light: OmniLight3D
var _t := 0.0
var _rng := RandomNumberGenerator.new()
var cooking := 0
var _cook_t := 0.0
var _skewer: Node3D
const COOK_TIME := 6.0


static func create(pos: Vector3) -> Campfire:
	var c := Campfire.new()
	Game.props.add_child(c)
	c.global_position = pos
	return c


func _ready() -> void:
	_rng.randomize()
	add_to_group("campfires")
	collision_layer = Game.L_STRUCT
	collision_mask = 0
	var cs := CollisionShape3D.new()
	var cy := CylinderShape3D.new()
	cy.radius = 0.55
	cy.height = 0.3
	cs.shape = cy
	cs.position.y = 0.1
	add_child(cs)
	for i in 9:
		var a := TAU * i / 9.0
		var r := MeshInstance3D.new()
		r.mesh = Mats.rock_mesh(0.13, _rng, 0.7)
		r.material_override = Mats.get_mat("rock")
		r.position = Vector3(cos(a) * 0.48, 0.04, sin(a) * 0.48)
		add_child(r)
	for i in 4:
		var l := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.05
		cm.bottom_radius = 0.06
		cm.height = 0.75
		cm.material = Mats.get_mat("bark")
		l.mesh = cm
		var a := TAU * i / 4.0
		l.rotation = Vector3(0, a, deg_to_rad(62))
		l.position = Vector3(cos(a) * -0.1, 0.18, sin(a) * 0.1)
		add_child(l)

	var fire := GPUParticles3D.new()
	fire.amount = 90
	fire.lifetime = 0.9
	var fm := ParticleProcessMaterial.new()
	fm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	fm.emission_sphere_radius = 0.18
	fm.direction = Vector3.UP
	fm.spread = 12.0
	fm.initial_velocity_min = 0.4
	fm.initial_velocity_max = 1.0
	fm.gravity = Vector3(0, 1.4, 0)
	fm.scale_min = 0.6
	fm.scale_max = 1.2
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.6))
	sc.add_point(Vector2(0.3, 1.0))
	sc.add_point(Vector2(1, 0.0))
	var sct := CurveTexture.new()
	sct.curve = sc
	fm.scale_curve = sct
	var ramp := GradientTexture1D.new()
	ramp.gradient = Mats.gradient([Color(1.0, 0.9, 0.6, 1), Color(1.0, 0.45, 0.1, 0.9), Color(0.6, 0.1, 0.02, 0.0)], [0.0, 0.4, 1.0])
	fm.color_ramp = ramp
	fire.process_material = fm
	var q := QuadMesh.new()
	q.size = Vector2(0.35, 0.45)
	var mat := Fx.soft_sprite_material(true)
	mat.albedo_color = Color(4.0, 2.5, 1.2)
	q.material = mat
	fire.draw_pass_1 = q
	fire.position.y = 0.15
	fire.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(fire)

	var smoke := GPUParticles3D.new()
	smoke.amount = 40
	smoke.lifetime = 4.0
	var sm := ParticleProcessMaterial.new()
	sm.direction = Vector3.UP
	sm.spread = 10.0
	sm.initial_velocity_min = 0.5
	sm.initial_velocity_max = 0.9
	sm.gravity = Vector3(0.25, 0.3, 0.1)
	sm.scale_min = 1.0
	sm.scale_max = 2.0
	var sc2 := Curve.new()
	sc2.add_point(Vector2(0, 0.3))
	sc2.add_point(Vector2(1, 1.0))
	var sct2 := CurveTexture.new()
	sct2.curve = sc2
	sm.scale_curve = sct2
	var ramp2 := GradientTexture1D.new()
	ramp2.gradient = Mats.gradient([Color(0.3, 0.3, 0.3, 0.0), Color(0.35, 0.35, 0.35, 0.3), Color(0.5, 0.5, 0.5, 0.0)], [0.0, 0.2, 1.0])
	sm.color_ramp = ramp2
	smoke.process_material = sm
	var q2 := QuadMesh.new()
	q2.size = Vector2(0.6, 0.6)
	q2.material = Fx.soft_sprite_material(false)
	smoke.draw_pass_1 = q2
	smoke.position.y = 0.7
	smoke.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(smoke)

	_light = OmniLight3D.new()
	_light.light_color = Color(1.0, 0.55, 0.25)
	_light.omni_range = 9.0
	_light.light_energy = 2.5
	_light.shadow_enabled = Settings.quality >= 2
	_light.position.y = 0.6
	add_child(_light)

	var crackle := AudioStreamPlayer3D.new()
	crackle.stream = Game.sfx.streams["fire"][0]
	crackle.unit_size = 3.0
	crackle.volume_db = -4.0
	crackle.autoplay = true
	add_child(crackle)


func _process(delta: float) -> void:
	_t += delta
	var rain := Game.weather.rain if Game.weather else 0.0
	var strength := 1.0 - rain * 0.55
	_light.light_energy = (2.2 + sin(_t * 11.0) * 0.25 + sin(_t * 23.0 + 1.3) * 0.2 + _rng.randf() * 0.25) * strength
	if cooking > 0:
		_cook_t += delta
		_skewer.visible = true
		if _cook_t >= COOK_TIME:
			_cook_t = 0.0
			cooking -= 1
			Game.add_item("fish_cooked", 1)
			Game.sfx.play("pickup", global_position, -4.0)
	elif _skewer:
		_skewer.visible = false
	_light.position = Vector3(sin(_t * 7.0) * 0.04, 0.6 + sin(_t * 9.0) * 0.04, cos(_t * 5.0) * 0.04)


func set_shadows(on: bool) -> void:
	_light.shadow_enabled = on


## Puts all raw fish on the fire; each one is done after COOK_TIME seconds.
func cook_fish() -> void:
	var n := Game.count("fish_raw")
	if n <= 0:
		Game.toast.emit(tr("Catch fish with a spear, then cook them here"))
		return
	Game.inventory["fish_raw"] = 0
	Game.inventory_changed.emit()
	cooking += n
	if _skewer == null:
		_skewer = Node3D.new()
		var stick := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.012
		cm.bottom_radius = 0.012
		cm.height = 0.9
		cm.material = Mats.get_mat("handle")
		stick.mesh = cm
		stick.rotation.z = PI / 2
		_skewer.add_child(stick)
		var fish := MeshInstance3D.new()
		fish.mesh = FishSchool.fish_mesh()
		fish.material_override = FishSchool.cooked_material()
		fish.rotation.y = PI / 2
		_skewer.add_child(fish)
		_skewer.position.y = 0.55
		add_child(_skewer)
	Game.sfx.play("sizzle", global_position)
	Game.toast.emit(tr("Cooking %d fish…") % n)
