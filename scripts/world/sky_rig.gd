class_name SkyRig
extends Node3D
## Physical sky, sun and moon, volumetric clouds (SunshineClouds2) and the
## environment/post stack, all driven by a 24 h clock.

## hour of day, 0-24
@export var hour := 9.0:
	set(v):
		hour = fposmod(v, 24.0)
		if is_node_ready():
			_update_sun()
## real seconds per in-game hour (0 = frozen)
@export var seconds_per_hour := 0.0
## 0 clear, 1 overcast
@export var cloudiness := 0.45
## 0 fair weather .. 1 tropical storm (rain, wind, dark sky, lightning)
@export var storm := 0.0:
	set(v):
		storm = clampf(v, 0.0, 1.0)
		if is_node_ready():
			_update_sun()

var env: Environment
var world_env: WorldEnvironment
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var sky_mat: ShaderMaterial
var clouds: SunshineCloudsDriverGD
var cam_attr: CameraAttributesPractical
var latitude := 12.0  # degrees north: a tropical island
var _cloud_drift := Vector2.ZERO
var rain: GPUParticles3D
var _ambient := 1.0
var _flash := 0.0
var _next_flash := 6.0


func _ready() -> void:
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = load("res://shaders/island_sky.gdshader")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.radiance_size = Sky.RADIANCE_SIZE_256
	sky.process_mode = Sky.PROCESS_MODE_REALTIME
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_white = 8.0
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_radius = 1.6
	env.ssao_intensity = 2.2
	env.ssao_power = 1.4
	env.ssil_enabled = Settings.indirect_light or Settings.quality >= 2
	env.sdfgi_enabled = Settings.quality >= 2
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 6
	env.sdfgi_min_cell_size = 0.4
	env.sdfgi_energy = 0.9
	env.glow_enabled = Settings.bloom
	env.glow_intensity = 0.55
	env.glow_bloom = 0.07
	env.glow_hdr_threshold = 1.2
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 900.0
	env.fog_depth_end = 9000.0
	env.fog_depth_curve = 1.6
	env.fog_density = 0.12
	env.fog_aerial_perspective = 0.45
	env.fog_sky_affect = 0.0
	env.volumetric_fog_enabled = Settings.volumetric_fog
	env.volumetric_fog_density = 0.009
	env.volumetric_fog_albedo = Color(0.92, 0.95, 1.0)
	env.volumetric_fog_anisotropy = 0.78  # strong forward scatter: sun shafts through the palms
	env.volumetric_fog_length = 128.0
	env.volumetric_fog_ambient_inject = 0.4
	env.volumetric_fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.15 * Settings.saturation
	env.adjustment_contrast = 1.12 * Settings.contrast
	env.adjustment_brightness = Settings.brightness
	var args := OS.get_cmdline_user_args()
	if args.has("--nogi"):
		env.sdfgi_enabled = false
	if args.has("--nofog"):
		env.volumetric_fog_enabled = false
	if args.has("--nosky"):
		sky.process_mode = Sky.PROCESS_MODE_QUALITY
	world_env = WorldEnvironment.new()
	world_env.environment = env
	cam_attr = CameraAttributesPractical.new()
	cam_attr.auto_exposure_enabled = true
	cam_attr.auto_exposure_min_sensitivity = 60.0
	cam_attr.auto_exposure_max_sensitivity = 800.0
	cam_attr.auto_exposure_speed = 0.6
	cam_attr.auto_exposure_scale = 0.3
	world_env.camera_attributes = cam_attr
	add_child(world_env)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = maxf(Settings.shadow_distance * 2.5, 220.0)
	sun.directional_shadow_split_1 = 0.06
	sun.directional_shadow_split_2 = 0.16
	sun.directional_shadow_split_3 = 0.4
	sun.directional_shadow_blend_splits = true
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.4
	sun.shadow_blur = 1.2
	sun.light_angular_distance = 0.6
	sun.light_volumetric_fog_energy = 2.2
	sun.sky_mode = DirectionalLight3D.SKY_MODE_LIGHT_AND_SKY
	add_child(sun)
	moon = DirectionalLight3D.new()
	moon.name = "Moon"
	moon.light_color = Color(0.62, 0.72, 1.0)
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 120.0
	moon.sky_mode = DirectionalLight3D.SKY_MODE_LIGHT_AND_SKY
	add_child(moon)

	if not OS.get_cmdline_user_args().has("--noclouds"):
		clouds = SunshineCloudsDriverGD.new()
		add_child(clouds)
		clouds.tracked_directional_lights = [sun]
		clouds.tracked_directional_light_shadow_steps = [8]
		clouds.wind_direction = Vector3(1.0, 0.0, 0.35)
		clouds.build_new_clouds()
		var c := clouds.clouds_resource
		if c:
			c.cloud_floor = 1100.0
			c.cloud_ceiling = 9000.0
			c.clouds_density = 0.6
			c.atmospheric_density = 0.35
			c.resolution_scale = 1 if Settings.quality >= 2 else 2
			c.max_step_count = 160.0 if Settings.quality >= 2 else 90.0
	_build_rain()
	_update_sun()


## Rain: streaks in a box that follows the camera.
func _build_rain() -> void:
	rain = GPUParticles3D.new()
	rain.amount = 12000 if Settings.quality >= 2 else 5000
	rain.lifetime = 1.1
	rain.preprocess = 1.0
	rain.visibility_aabb = AABB(Vector3(-30, -30, -30), Vector3(60, 60, 60))
	rain.emitting = false
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(28, 2, 28)
	pm.direction = Vector3(0.18, -1, 0.06)
	pm.spread = 3.0
	pm.initial_velocity_min = 22.0
	pm.initial_velocity_max = 28.0
	pm.gravity = Vector3(0, -9.8, 0)
	pm.collision_mode = ParticleProcessMaterial.COLLISION_HIDE_ON_CONTACT
	rain.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.012, 0.75)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.75, 0.8, 0.88, 0.28)
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	m.billboard_keep_scale = true
	q.material = m
	rain.draw_pass_1 = q
	add_child(rain)


func _process(delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if rain and cam:
		rain.global_position = cam.global_position + Vector3(0, 16, 0)
		rain.emitting = storm > 0.25
		rain.amount_ratio = clampf((storm - 0.2) / 0.8, 0.05, 1.0)
	# lightning: a bright sky flash now and then during a storm
	if storm > 0.6:
		_next_flash -= delta
		if _next_flash <= 0.0:
			_flash = 1.0
			_next_flash = randf_range(4.0, 14.0)
	_flash = maxf(0.0, _flash - delta * 3.5)
	if env:
		env.background_energy_multiplier = 1.0 + _flash * 5.0 * (1.0 if randf() > 0.3 else 0.4)
		env.ambient_light_energy = _ambient + _flash * 2.5
	_cloud_drift += Vector2(0.004, 0.0015) * delta
	if sky_mat:
		sky_mat.set_shader_parameter("cloud_offset", _cloud_drift)
	if seconds_per_hour > 0.0:
		hour += delta / seconds_per_hour
	elif Engine.get_process_frames() % 30 == 0:
		_update_sun()


## Sun direction for the hour (sunrise ~6:00 in the east (+X), sunset ~18:00 west).
func sun_direction(h: float) -> Vector3:
	var a := (h - 6.0) / 12.0 * PI  # 0 at sunrise, PI at sunset
	var tilt := deg_to_rad(90.0 - latitude - 8.0)
	var d := Vector3(cos(a), sin(a) * sin(tilt), -sin(a) * cos(tilt) * 0.55)
	return d.normalized()


func _update_sun() -> void:
	if sun == null:
		return
	var d := sun_direction(hour)
	sun.look_at_from_position(Vector3.ZERO, -d, Vector3.UP if absf(d.y) < 0.99 else Vector3.FORWARD)
	var elev := d.y
	var day := smoothstep(-0.08, 0.12, elev)
	# warm, low sun -> white noon sun; air mass reddens it near the horizon
	var warm := 1.0 - smoothstep(0.02, 0.45, elev)
	sun.light_color = Color(1.0, 0.96, 0.9).lerp(Color(1.0, 0.55, 0.28), warm)
	sun.light_energy = 4.0 * day * (1.0 - storm * 0.8) * lerpf(0.55, 1.0, smoothstep(0.0, 0.3, elev)) * (1.0 - cloudiness * 0.35)
	sun.shadow_enabled = elev > 0.0  # stays visible: the sky shader reads it as LIGHT0
	var md := -d
	moon.look_at_from_position(Vector3.ZERO, -md, Vector3.UP if absf(md.y) < 0.99 else Vector3.FORWARD)
	var night := smoothstep(0.0, -0.15, elev)
	moon.light_energy = 0.12 * night
	moon.shadow_enabled = night > 0.01
	_ambient = lerpf(0.25, 1.0, day) * (1.0 - storm * 0.45)
	env.ambient_light_energy = _ambient
	env.ambient_light_sky_contribution = 1.0
	env.fog_light_color = Color(0.62, 0.74, 0.86).lerp(Color(0.95, 0.62, 0.42), warm * day)
	env.fog_light_energy = lerpf(0.05, 1.0, day)
	env.volumetric_fog_emission_energy = 0.0
	if clouds and clouds.clouds_resource:
		clouds.clouds_resource.clouds_coverage = lerpf(0.55, 0.92, cloudiness)
	# the 2D cloud deck stands in for volumetric clouds when those are off
	var cov := lerpf(lerpf(0.3, 0.85, cloudiness), 1.0, storm)
	sky_mat.set_shader_parameter("cloud_coverage", cov)
	sky_mat.set_shader_parameter("cloud_opacity", 0.35 if clouds and storm < 0.3 else 1.0)
	sky_mat.set_shader_parameter("storm", storm)
	env.volumetric_fog_density = lerpf(0.009, 0.03, storm)
	env.fog_density = lerpf(0.12, 0.6, storm)
	env.fog_depth_begin = lerpf(900.0, 150.0, storm)
	RenderingServer.global_shader_parameter_set(&"wind_strength", lerpf(0.5, 1.6, storm))
