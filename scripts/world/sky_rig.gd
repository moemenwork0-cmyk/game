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

var env: Environment
var world_env: WorldEnvironment
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var sky_mat: ShaderMaterial
var clouds: SunshineCloudsDriverGD
var cam_attr: CameraAttributesPractical
var latitude := 12.0  # degrees north: a tropical island
var _cloud_drift := Vector2.ZERO


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
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_white = 12.0
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_radius = 1.6
	env.ssao_intensity = 1.6
	env.ssao_power = 1.4
	env.ssil_enabled = Settings.indirect_light
	env.sdfgi_enabled = Settings.quality >= 2
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 6
	env.sdfgi_min_cell_size = 0.4
	env.sdfgi_energy = 0.9
	env.glow_enabled = Settings.bloom
	env.glow_intensity = 0.35
	env.glow_bloom = 0.04
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
	env.volumetric_fog_density = 0.0035
	env.volumetric_fog_albedo = Color(0.92, 0.95, 1.0)
	env.volumetric_fog_anisotropy = 0.6
	env.volumetric_fog_length = 160.0
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
	sun.light_volumetric_fog_energy = 1.4
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
	_update_sun()


func _process(delta: float) -> void:
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
	sun.light_energy = 3.2 * day * lerpf(0.55, 1.0, smoothstep(0.0, 0.3, elev)) * (1.0 - cloudiness * 0.35)
	sun.shadow_enabled = elev > 0.0  # stays visible: the sky shader reads it as LIGHT0
	var md := -d
	moon.look_at_from_position(Vector3.ZERO, -md, Vector3.UP if absf(md.y) < 0.99 else Vector3.FORWARD)
	var night := smoothstep(0.0, -0.15, elev)
	moon.light_energy = 0.12 * night
	moon.shadow_enabled = night > 0.01
	env.ambient_light_energy = lerpf(0.25, 1.0, day)
	env.ambient_light_sky_contribution = 1.0
	env.fog_light_color = Color(0.62, 0.74, 0.86).lerp(Color(0.95, 0.62, 0.42), warm * day)
	env.fog_light_energy = lerpf(0.05, 1.0, day)
	env.volumetric_fog_emission_energy = 0.0
	if clouds and clouds.clouds_resource:
		clouds.clouds_resource.clouds_coverage = lerpf(0.55, 0.92, cloudiness)
	# the 2D cloud deck stands in for volumetric clouds when those are off
	sky_mat.set_shader_parameter("cloud_coverage", lerpf(0.3, 0.85, cloudiness))
	sky_mat.set_shader_parameter("cloud_opacity", 0.35 if clouds else 1.0)
