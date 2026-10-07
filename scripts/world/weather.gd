class_name Weather
extends Node3D
## Weather state machine: clear / cloudy / rain / storm. Values ease toward targets
## so changes roll in over in-game hours. Drives sky, light, fog, rain, wind and waves.

const STATES := {
	"clear": {"cloud": 0.1, "rain": 0.0, "wind": 0.15},
	"cloudy": {"cloud": 0.6, "rain": 0.0, "wind": 0.35},
	"rain": {"cloud": 0.85, "rain": 0.6, "wind": 0.45},
	"storm": {"cloud": 1.0, "rain": 1.0, "wind": 1.0},
}

var state := "clear"
var cloud := 0.1
var rain := 0.0
var wind := 0.15
var hours_left := 5.0
var sun_mult := 1.0
var _rng := RandomNumberGenerator.new()
var _rain_fx: GPUParticles3D
var _rain_mat: ParticleProcessMaterial
var _lightning_t := 8.0
var _flash := 0.0


func _ready() -> void:
	_rng.randomize()
	_rain_fx = GPUParticles3D.new()
	_rain_fx.amount = 2600
	_rain_fx.lifetime = 1.1
	_rain_fx.visibility_aabb = AABB(Vector3(-25, -25, -25), Vector3(50, 50, 50))
	_rain_mat = ParticleProcessMaterial.new()
	_rain_mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	_rain_mat.emission_box_extents = Vector3(18, 1, 18)
	_rain_mat.direction = Vector3(0, -1, 0)
	_rain_mat.spread = 3.0
	_rain_mat.initial_velocity_min = 16.0
	_rain_mat.initial_velocity_max = 20.0
	_rain_mat.gravity = Vector3(0, -9.8, 0)
	_rain_mat.particle_flag_align_y = true
	_rain_mat.color = Color(0.75, 0.82, 0.9, 0.35)
	_rain_fx.process_material = _rain_mat
	var q := QuadMesh.new()
	q.size = Vector2(0.012, 0.5)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	m.billboard_keep_scale = true
	q.material = m
	_rain_fx.draw_pass_1 = q
	_rain_fx.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_rain_fx.emitting = false
	add_child(_rain_fx)


func to_dict() -> Dictionary:
	return {"state": state, "cloud": cloud, "rain": rain, "wind": wind, "left": hours_left}


func from_dict(d: Dictionary) -> void:
	state = String(d.get("state", "clear"))
	cloud = float(d.get("cloud", 0.1))
	rain = float(d.get("rain", 0.0))
	wind = float(d.get("wind", 0.15))
	hours_left = float(d.get("left", 4.0))


func force(p_state: String) -> void:
	state = p_state
	var t: Dictionary = STATES[state]
	cloud = t["cloud"]
	rain = t["rain"]
	wind = t["wind"]
	hours_left = 6.0


## Called every frame with the elapsed in-game hours.
func advance(hours: float, delta: float) -> void:
	hours_left -= hours
	if hours_left <= 0.0:
		_pick_next()
	var t: Dictionary = STATES[state]
	var k := clampf(hours * 0.9, 0.0, 1.0)
	cloud = lerpf(cloud, t["cloud"], k)
	rain = lerpf(rain, t["rain"], k * (1.6 if t["rain"] > rain else 1.0))
	wind = lerpf(wind, t["wind"], k)
	sun_mult = 1.0 - 0.72 * smoothstep(0.3, 1.0, cloud)
	_apply(delta)


func _pick_next() -> void:
	var r := _rng.randf()
	if r < 0.48:
		state = "clear"
	elif r < 0.73:
		state = "cloudy"
	elif r < 0.93:
		state = "rain"
	else:
		state = "storm"
	hours_left = _rng.randf_range(3.0, 7.0)
	if state == "storm" and Game.playing:
		Game.toast.emit(tr("A storm is coming…"))


func _apply(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam:
		_rain_fx.global_position = cam.global_position + Vector3(0, 12, 0) + cam.global_basis.z * -4.0
	_rain_fx.emitting = rain > 0.03
	_rain_fx.amount_ratio = clampf(rain, 0.0, 1.0)
	_rain_mat.direction = Vector3(wind * 0.35, -1, wind * 0.15).normalized()
	if Game.world:
		Game.world.grass_material.set_shader_parameter("wind_strength", 0.12 + wind * 0.4)
		Game.world.terrain_material.set_shader_parameter("wetness", rain)
	for id in ["leaves", "palm_leaves", "leaves_bush"]:
		(Mats.get_mat(id) as ShaderMaterial).set_shader_parameter("wind", 0.8 + wind * 2.6)
	if Game.ocean:
		Game.ocean.wave_scale = 0.85 + wind * 1.1
	if Game.sfx:
		Game.sfx.rain_level = rain
		Game.sfx.wind_level = wind

	# lightning during storms
	_flash = maxf(_flash - delta * 6.0, 0.0)
	if state == "storm" and rain > 0.7:
		_lightning_t -= delta
		if _lightning_t <= 0.0:
			_lightning_t = _rng.randf_range(6.0, 18.0)
			_flash = 1.0
			var dist := _rng.randf_range(300.0, 1500.0)
			get_tree().create_timer(dist / 343.0).timeout.connect(func() -> void:
				if Game.sfx:
					Game.sfx.play("thunder", null, clampf(6.0 - dist / 250.0, -8.0, 4.0), 0.15))


func flash() -> float:
	return _flash
