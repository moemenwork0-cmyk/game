class_name DayNight
extends Node
## Sun/moon cycle driving lights, sky, fog and exposure.

var time_hours := 7.2
var day_minutes := 16.0  # real minutes per full day
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var env: Environment
var sky_mat: ShaderMaterial
var daylight := 1.0
var last_hours_step := 0.0
var underwater := false
var _uw := 0.0
var _materials: Array[ShaderMaterial] = []


func setup(p_env: Environment, p_sky: ShaderMaterial, p_sun: DirectionalLight3D, p_moon: DirectionalLight3D, mats: Array[ShaderMaterial]) -> void:
	env = p_env
	sky_mat = p_sky
	sun = p_sun
	moon = p_moon
	_materials = mats
	_update(0.0)


func _process(delta: float) -> void:
	_update(delta)


func clock_text() -> String:
	var h := int(time_hours)
	var m := int((time_hours - h) * 60.0)
	return "Day %d  ·  %02d:%02d" % [Game.day_number, h, m]


func _update(delta: float) -> void:
	var speed := 24.0 / (day_minutes * 60.0)
	if Input.is_action_pressed("time_skip"):
		speed *= 90.0
	time_hours += delta * speed
	last_hours_step = delta * speed
	if Game.weather:
		Game.weather.advance(delta * speed, delta)
	if time_hours >= 24.0:
		time_hours -= 24.0
		Game.day_number += 1
		Game.toast.emit("Day %d" % Game.day_number)
	var ang := (time_hours - 6.0) / 24.0 * TAU
	var dir := Vector3(cos(ang), sin(ang) * 0.9, sin(ang) * 0.42 + 0.12).normalized()
	var elev := dir.y
	daylight = smoothstep(-0.12, 0.18, elev)

	sun.global_basis = Basis.looking_at(-dir, Vector3(0, 0, 1) if absf(dir.y) > 0.99 else Vector3.UP)
	var warm := smoothstep(0.0, 0.45, elev)
	sun.light_color = Color(1.0, 0.5, 0.26).lerp(Color(1.0, 0.95, 0.88), warm)
	var w_sun := Game.weather.sun_mult if Game.weather else 1.0
	var w_rain := Game.weather.rain if Game.weather else 0.0
	var w_cloud := Game.weather.cloud if Game.weather else 0.0
	var w_flash := Game.weather.flash() if Game.weather else 0.0
	sun.light_energy = smoothstep(-0.04, 0.2, elev) * 1.9 * w_sun + w_flash * 3.0
	sun.shadow_opacity = lerpf(1.0, 0.35, smoothstep(0.4, 1.0, w_cloud))
	sky_mat.set_shader_parameter("overcast", smoothstep(0.25, 1.0, w_cloud))
	sky_mat.set_shader_parameter("cloud_coverage", 0.4 + w_cloud * 0.45)
	sky_mat.set_shader_parameter("flash", w_flash)
	sun.visible = elev > -0.06

	var mdir := -dir
	moon.global_basis = Basis.looking_at(-mdir, Vector3(0, 0, 1) if absf(mdir.y) > 0.99 else Vector3.UP)
	moon.light_energy = smoothstep(-0.04, 0.2, mdir.y) * 0.16
	moon.visible = mdir.y > -0.06 and not sun.visible

	sky_mat.set_shader_parameter("sun_dir", dir)
	env.ambient_light_energy = lerpf(0.18, 1.0, daylight) * lerpf(1.0, 0.75, w_cloud) * lerpf(1.0, 0.55, w_rain) + w_flash * 1.5
	env.tonemap_exposure = lerpf(1.9, 1.0, daylight)

	var sunset := 1.0 - smoothstep(0.0, 0.3, absf(elev))
	var fog_day := Color(0.62, 0.74, 0.88).lerp(Color(0.95, 0.6, 0.4), sunset * 0.6)
	fog_day = fog_day.lerp(Color(0.5, 0.54, 0.58), w_cloud * 0.8).lerp(Color(0.2, 0.23, 0.26), w_rain * 0.75)
	var fog_col := Color(0.02, 0.03, 0.06).lerp(fog_day, daylight)
	_uw = move_toward(_uw, 1.0 if underwater else 0.0, delta * 6.0)
	env.fog_light_color = fog_col.lerp(Color(0.03, 0.2, 0.26) * maxf(daylight, 0.15), _uw)
	env.fog_density = lerpf(0.0035 + w_rain * 0.009, 0.09, _uw)
	env.fog_sky_affect = lerpf(0.25, 1.0, _uw)
	env.volumetric_fog_albedo = Color(0.9, 0.93, 1.0)

	var wt := Game.ocean.time if Game.ocean else 0.0
	for m in _materials:
		m.set_shader_parameter("daylight", daylight)
		m.set_shader_parameter("wave_time", wt)
