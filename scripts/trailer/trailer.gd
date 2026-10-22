class_name Trailer
extends Node3D
## Renders one shot of the «الطوفان» trailer in-engine. Run with Godot's movie maker at a
## high fixed frame rate; tools/trailer/ blends sub-frames into true motion blur and
## cuts the shots together on the music.
##   godot --write-movie out/frame.png --fixed-fps 96 res://scenes/trailer.tscn -- --shot=storm_wide
## Extra: --preroll=S (seconds rendered before the shot clock starts, trimmed later),
##        --quality=N, --preview (play in a window)


var sky: SkyRig
var ocean: OceanFFT
var cam: Camera3D
var attr: CameraAttributesPractical
var shot: TrailerShot
var preroll := 1.0
var clock := -1.0      # shot clock; negative during pre-roll
var _noise := FastNoiseLite.new()
var _flash_light: OmniLight3D
var terrain: Terrain3D
var scatter: Scatter
var _built := false


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var shot_name := "storm_wide"
	for a in args:
		if a.begins_with("--shot="):
			shot_name = a.trim_prefix("--shot=")
		elif a.begins_with("--preroll="):
			preroll = float(a.trim_prefix("--preroll="))
		elif a.begins_with("--quality="):
			Settings._preset(int(a.trim_prefix("--quality=")))
			Settings.render_scale = 1.0
	clock = -preroll
	_noise.frequency = 2.2
	_noise.fractal_octaves = 2

	sky = SkyRig.new()
	add_child(sky)
	cam = Camera3D.new()
	cam.near = 0.05
	cam.far = 30000.0
	add_child(cam)
	cam.make_current()
	attr = CameraAttributesPractical.new()
	attr.auto_exposure_enabled = true
	attr.auto_exposure_speed = 4.0
	attr.auto_exposure_scale = 0.15
	attr.auto_exposure_min_sensitivity = 40.0
	attr.auto_exposure_max_sensitivity = 1600.0
	cam.attributes = attr
	var vp := get_viewport()
	vp.use_taa = false  # motion blur comes from sub-frame blending; TAA would ghost
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_SMAA
	vp.msaa_3d = Viewport.MSAA_4X
	vp.mesh_lod_threshold = 0.5

	var path := "res://scripts/trailer/shots/%s.gd" % shot_name
	if not ResourceLoader.exists(path):
		push_error("trailer: unknown shot " + shot_name)
		get_tree().quit(2)
		return
	shot = (load(path) as GDScript).new()
	add_child(shot)
	shot.t = self
	await shot.build(self)
	_built = true
	print("TRAILER shot=%s duration=%.2f speed=%.2f preroll=%.2f" % [shot_name, shot.duration, shot.speed, preroll])


## Open ocean for sea shots. `state` 1 = trade winds, 2.5+ = storm.
func add_ocean(state: float) -> OceanFFT:
	ocean = OceanFFT.new()
	add_child(ocean)
	ocean.sea_state = state
	ocean.foam_scale = 0.4
	ocean.readback = true
	ocean.set_shore(ImageTexture.create_from_image(Image.create(4, 4, false, Image.FORMAT_RGBF)), -1e6, -1e6, 1.0)
	return ocean


## The island (terrain, shore-aware sea, river and lake, jungle planted around `center`).
func add_island(center: Vector3, radius := 220.0, sea_state := 1.0) -> void:
	const ISLAND := "res://assets/env/island"
	cam.global_position = center + Vector3(0, 2, 0)  # dynamic collision is built around the camera
	terrain = Terrain3D.new()
	add_child(terrain)
	await get_tree().process_frame
	terrain.mesh_size = 48
	terrain.mesh_lods = 7
	terrain.vertex_spacing = 1.0
	terrain.cast_shadows = RenderingServer.SHADOW_CASTING_SETTING_ON
	terrain.collision.mode = Terrain3DCollision.DYNAMIC_GAME
	terrain.material.world_background = Terrain3DMaterial.NONE
	terrain.material.auto_shader_enabled = false
	terrain.material.dual_scaling_enabled = true
	terrain.material.macro_variation_enabled = true
	terrain.data_directory = ISLAND + "/data"
	terrain.assets = load(ISLAND + "/assets.tres")
	terrain.set_camera(cam)
	var shore_tex: Texture2D = load(ISLAND + "/shore.res")
	ocean = OceanFFT.new()
	add_child(ocean)
	ocean.sea_state = sea_state
	ocean.readback = true
	ocean.set_shore(shore_tex, -1024, -1024, 2048)
	var fresh := FreshWater.new()
	fresh.name = "FreshWater"
	add_child(fresh)
	fresh.setup(ISLAND + "/water.json")
	scatter = Scatter.new()
	add_child(scatter)
	scatter.setup(terrain, shore_tex.get_image(), Rect2(-1024, -1024, 2048, 2048))
	scatter.set_process(false)
	BeachSlice.hero_rocks(scatter)
	await get_tree().process_frame
	await scatter.build_static(center, radius, Callable(), true)


## Ground height of the island at (x, z) (0 when off the terrain).
func ground(x: float, z: float) -> float:
	var h := terrain.data.get_height(Vector3(x, 0, z)) if terrain and terrain.data else 0.0
	return 0.0 if is_nan(h) else h


## A lightning strike: a blinding flash in the sky plus a bolt-lit fill light.
func lightning(at: Vector3, power := 1.0) -> void:
	sky._flash = power
	if _flash_light == null:
		_flash_light = OmniLight3D.new()
		_flash_light.omni_range = 400.0
		_flash_light.light_color = Color(0.75, 0.82, 1.0)
		_flash_light.shadow_enabled = true
		add_child(_flash_light)
	_flash_light.global_position = at
	_flash_light.light_energy = 60.0 * power


func _process(delta: float) -> void:
	if shot == null or not _built:
		return
	# Engine.time_scale scales delta; the shot clock runs in real (footage) time
	var dt := delta / maxf(Engine.time_scale, 0.0001)
	clock += dt
	# slow motion: the world runs at shot.speed, the camera keeps shot time
	Engine.time_scale = shot.speed if clock >= 0.0 else 1.0
	var st := maxf(clock, 0.0)
	shot.run_events(st)
	shot.tick(st, dt)
	var c := shot.camera_at(st)
	if not c.is_empty():
		var p: Vector3 = c["pos"]
		var look: Vector3 = c["look"]
		if shot.follow:
			p = shot.follow.to_global(p)
			look = shot.follow.to_global(look)
		if shot.shake > 0.0:
			var n := clock
			p += Vector3(_noise.get_noise_2d(n * 40.0, 0.0), _noise.get_noise_2d(0.0, n * 40.0), _noise.get_noise_2d(n * 40.0, 99.0)) * shot.shake
		# never dip under the waves (unless the shot is meant to be under water)
		if ocean and not sky.underwater:
			p.y = maxf(p.y, ocean.get_height(p.x, p.z) + 0.9)
		cam.global_position = p
		if not p.is_equal_approx(look):
			cam.look_at(look, Vector3.UP)
		cam.fov = c["fov"]
		var f: float = c["focus"]
		attr.dof_blur_far_enabled = f > 0.0
		attr.dof_blur_near_enabled = f > 0.0 and f < 4.0
		if f > 0.0:
			attr.dof_blur_far_distance = f * 1.6
			attr.dof_blur_far_transition = f * 2.0
			attr.dof_blur_near_distance = f * 0.5
			attr.dof_blur_near_transition = f * 0.4
			attr.dof_blur_amount = 0.12
	if _flash_light and _flash_light.light_energy > 0.0:
		_flash_light.light_energy = maxf(0.0, _flash_light.light_energy - delta * 260.0)
	if clock >= shot.duration:
		print("TRAILER DONE")
		get_tree().quit()
		await get_tree().create_timer(2.0).timeout
		OS.kill(OS.get_process_id())
