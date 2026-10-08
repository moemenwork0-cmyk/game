extends Node3D
## Boots the island: environment, terrain, ocean, vegetation, player.

const SEED := 20260925

var env: Environment
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var sky_mat: ShaderMaterial


const AUTOSAVE_SECONDS := 240.0

var _menu_cam: Camera3D
var _menu_t := 0.0
var _autosave_t := 0.0
var _autosave_every := AUTOSAVE_SECONDS


func _ready() -> void:
	# Phase 1 vertical slice: the new island cove (scenes/slice.tscn)
	if OS.get_cmdline_user_args().has("--slice"):
		get_tree().change_scene_to_file.call_deferred("res://scenes/slice.tscn")
		return
	var mode := Game.start_mode
	Game.start_mode = ""
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--test") or a.begins_with("--shot") or a.begins_with("--cover"):
			mode = "new"
		if a.begins_with("--introshot") or a == "--prologue":
			mode = "replay"
		if a == "--loadtest":
			mode = "load"
		if a.begins_with("--lang="):
			Settings.language = a.trim_prefix("--lang=")
			Lang.apply(Settings.language)
	# the very first launch on this machine goes straight into the prologue
	if mode == "" and args.is_empty() and not SaveGame.exists():
		mode = "prologue"
	Game.replay = mode == "replay"
	_want_intro = mode == "prologue" or mode == "replay"
	if _want_intro:
		mode = "new"
	var save_data := {}
	if mode == "load":
		save_data = SaveGame.read()
		if save_data.is_empty():
			mode = "new"

	var hud := Hud.new()
	add_child(hud)
	Game.hud = hud
	hud.set_gameplay_visible(false)
	hud.set_loading(0.02, "Tuning the sea")
	await get_tree().process_frame
	await get_tree().process_frame
	var sfx := Sfx.new()
	add_child(sfx)
	Game.sfx = sfx

	_setup_environment()
	_setup_post()
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	Game.props = props
	var sm := StructureManager.new()
	add_child(sm)
	Game.structures = sm

	var world := VoxelWorld.new()
	add_child(world)
	Game.world = world
	var override := {}
	if not save_data.is_empty():
		override = SaveGame.terrain_override(save_data)
	await world.generate(int(save_data.get("seed", SEED)), hud.set_loading, override)

	var ocean := Ocean.new()
	add_child(ocean)
	Game.ocean = ocean

	var dn := DayNight.new()
	add_child(dn)
	Game.day_night = dn
	var weather := Weather.new()
	add_child(weather)
	Game.weather = weather
	var story := StoryDirector.new()
	story.name = "Story"
	add_child(story)
	Game.story = story
	Wreck.create(self)
	var shader_mats: Array[ShaderMaterial] = [world.terrain_material, ocean.mat]
	dn.setup(env, sky_mat, sun, moon, shader_mats)

	hud.set_loading(0.75, "Waking the tide")
	for a in args:
		if a.begins_with("--loadshot="):
			for i in 30:
				await get_tree().process_frame
			get_viewport().get_texture().get_image().save_png(a.trim_prefix("--loadshot="))
	await get_tree().process_frame
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED
	_spawn_bushes()
	_spawn_fish()
	if save_data.is_empty():
		_populate(rng)
	else:
		SaveGame.restore_objects(save_data, self)
		dn.time_hours = float(save_data["time_hours"])
		await sm.restore(save_data["structures"])
	apply_quality()
	Settings.changed.connect(_on_settings_changed)

	hud.set_loading(0.95, "Letting the world settle")
	# the cover deserves a moment, even on a fast machine
	# (counted in game time, so a recorded movie shows it too)
	var shown := 0.0
	while shown < 4.0 and not ("--test" in args or "--loadtest" in args):
		await get_tree().process_frame
		shown += get_process_delta_time()
	for i in 40:
		await get_tree().physics_frame
	hud.hide_loading()
	if mode == "new" or mode == "load":
		start_play(save_data)
	else:
		_show_menu()
	_debug_shots()


var _want_intro := false


func _intro_enabled() -> bool:
	return _want_intro


## After the wreck: dawn, a calm sea, face down on the beach that looks out at her.
func _wake_up(player: Player) -> void:
	var dir := Vector3(Wreck.POS.x, 0, Wreck.POS.z).normalized()
	var spawn := default_spawn()
	for r in range(44, 8, -1):
		var x := dir.x * r
		var z := dir.z * r
		var h := Game.world.surface_height(x, z)
		if h > 0.9:
			var x2 := dir.x * (r - 2.0)
			var z2 := dir.z * (r - 2.0)
			spawn = Vector3(x2, Game.world.surface_height(x2, z2) + 1.0, z2)
			break
	player.global_position = spawn
	player.look_toward(Vector3(Wreck.POS.x, spawn.y + 1.0, Wreck.POS.z))
	player.pitch = -0.12
	player.camera.current = true
	Game.day_night.time_hours = 6.15
	Game.day_night.day_minutes = 16.0
	Game.weather.force("clear")
	Game.weather.wind = 0.35
	player.vitals.wetness = 1.0
	player.vitals.energy = 55.0
	player.vitals.water = 60.0
	player.vitals.morale = 55.0


## Leaves the Murjan's cargo on her deck and opens the first objective
## (start_new has already rolled who you are and why she sank).
func _begin_story() -> void:
	Game.story.start_pos = Game.player.global_position
	var w: Wreck = get_tree().get_first_node_in_group("wreck")
	if w:
		var cr := StoryCrate.create(w.crate_position(), {"plank": 4, "tin": 1, "medkit": 1, "waterbottle": 1}, "wreck")
		cr.global_basis = w.global_basis * Basis(Vector3.UP, 0.4)
	Game.story.say(StoryData.WAKE)
	Game.story._on_mission_start()


func _on_settings_changed() -> void:
	if Game.player:
		Game.player.camera.fov = Settings.fov
	_autosave_every = [0.0, 120.0, 240.0, 600.0][clampi(Settings.autosave, 0, 3)]


## Spawns the player and hands control over. data = save (empty for a new island).
func start_play(data: Dictionary) -> void:
	if _menu_cam:
		_menu_cam.queue_free()
		_menu_cam = null
	Game.day_night.day_minutes = 16.0
	var player := Player.new()
	add_child(player)
	Game.player = player
	if data.is_empty():
		Game.new_game_state()
		Game.respawn_point = Vector3.INF
		Game.weather.force("clear")
		var spawn := default_spawn()
		player.global_position = spawn
		player.look_toward(Vector3(0, spawn.y, 0))
		Game.day_night.time_hours = 7.2
		Game.story.start_new()
		if _intro_enabled():
			Game.hud.set_gameplay_visible(false)
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			var pro := Prologue.new()
			add_child(pro)
			await pro.wake_ready
			_wake_up(player)
			pro.begin_wake(player)
			await pro.finished
		_begin_story()
		if Game.replay:
			Game.playing = true
			Game.hud.set_gameplay_visible(true)
			await get_tree().create_timer(4.0).timeout
			var a := OS.get_cmdline_user_args()
			if "--prologue" in a:
				get_tree().quit()
			elif a.is_empty():
				Game.restart("")
			return
		SaveGame.save_now()
	else:
		var pd: Dictionary = data["player"]
		player.global_position = pd["pos"] + Vector3(0, 0.1, 0)
		player.yaw = float(pd["yaw"])
		player.pitch = float(pd["pitch"])
		player.stamina = float(pd.get("stamina", 1.0))
		player.vitals.from_dict(data.get("vitals", {}))
		if data.get("third_person", false):
			player.toggle_camera()
		Game.toast.emit(StoryData.t({"en": "Welcome back — day %d", "ar": "مرحبًا بعودتك — اليوم %d"}) % Game.day_number)
		if data.has("story"):
			Game.story.from_dict(data["story"])
		else:
			Game.story.start_new()
			_begin_story()
	Game.playing = true
	Game.hud.set_gameplay_visible(true)
	Game.hud._refresh_inventory()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_autosave_t = 0.0


func _show_menu() -> void:
	_menu_cam = Camera3D.new()
	_menu_cam.fov = 55.0
	_menu_cam.far = 1200.0
	add_child(_menu_cam)
	_menu_cam.current = true
	Game.day_night.time_hours = 17.0
	Game.day_night.day_minutes = 60.0
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	Game.hud.add_child(MainMenu.new())


func _process(delta: float) -> void:
	if _menu_cam:
		_menu_t += delta * 0.035
		var a := _menu_t + 2.3
		_menu_cam.global_position = Vector3(cos(a) * 52.0, 15.0 + sin(_menu_t * 2.0) * 2.0, sin(a) * 52.0)
		_menu_cam.look_at(Vector3(0, 3.5, 0))
		# frame the island beside the menu column, not behind it
		_menu_cam.rotate_object_local(Vector3.UP, 0.3 if not Lang.is_ar() else -0.3)
	if Game.playing and not get_tree().paused:
		_autosave_t += delta
		if _autosave_every > 0.0 and _autosave_t >= _autosave_every:
			_autosave_t = 0.0
			SaveGame.save_now()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST and Game.playing:
		SaveGame.save_now()


## Dev helper: godot -- --shot=out.png [--pose=x,y,z,yaw_deg,pitch_deg] [--hour=h]
func _debug_shots() -> void:
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else ""
	if args.has("dumpsfx"):
		for id in Game.sfx.streams:
			var w: AudioStreamWAV = Game.sfx.streams[id][0]
			w.save_to_wav(str(args["dumpsfx"]) + "/" + id + ".wav")
		get_tree().quit()
		return
	if args.has("test"):
		await _run_tests()
		SaveGame.save_now()
		print("SAVE ", _world_summary())
		get_tree().quit()
		return
	if args.has("loadtest"):
		for i in 30:
			await get_tree().physics_frame
		print("LOAD ", _world_summary())
		get_tree().quit()
		return
	if args.has("introshot"):
		# frames of the opening at the given seconds, then a few after waking up
		var times: PackedFloat64Array = str(args.get("at", "3,10,17,23")).split_floats(",")
		var intro: Prologue = null
		while intro == null:
			await get_tree().process_frame
			for c in get_children():
				if c is Prologue:
					intro = c
		for i in times.size():
			while is_instance_valid(intro) and intro._t < times[i]:
				await get_tree().process_frame
			get_viewport().get_texture().get_image().save_png("%s/intro_%d.png" % [args["introshot"], i])
		while not Game.playing:
			await get_tree().process_frame
		for i in 240:
			await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png("%s/wake.png" % args["introshot"])
		get_tree().quit()
		return
	if args.has("cover"):
		await _render_cover(str(args["cover"]), float(args.get("hour", "6.45")))
		get_tree().quit()
		return
	if args.has("menushot"):
		if args.has("settings"):
			SettingsPanel._tab = int(args.get("tab", "1"))
			for c in Game.hud.get_children():
				if c is MainMenu:
					c._open_settings()
		for i in 120:
			await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(str(args["menushot"]))
		get_tree().quit()
		return
	if not args.has("shot"):
		return
	if args.has("hour"):
		Game.day_night.time_hours = float(args["hour"])
		Game.day_night.day_minutes = 100000.0
	if args.has("pose"):
		var v: PackedFloat64Array = str(args["pose"]).split_floats(",")
		Game.player.global_position = Vector3(v[0], v[1], v[2])
		Game.player.yaw = deg_to_rad(v[3])
		Game.player.pitch = deg_to_rad(v[4])
		Game.player.set_physics_process(false)
		Game.player.rotation.y = Game.player.yaw
		Game.player.head.rotation.x = Game.player.pitch
	if args.has("campfire"):
		Game.add_item("log", 2, false)
		Game.add_item("stone", 4, false)
		var fp := Game.player.global_position - Game.player.global_basis.z * 3.0
		fp.y = Game.world.surface_height(fp.x, fp.z)
		Campfire.create(fp)
	if args.has("fx"):
		var f: String = args["fx"]
		env.ssao_enabled = "ao" in f
		env.ssil_enabled = "il" in f
		env.volumetric_fog_enabled = "vf" in f
		env.glow_enabled = "gl" in f
	if args.has("weather"):
		Game.weather.force(str(args["weather"]))
	if args.has("tp"):
		Game.player.toggle_camera()
	if args.has("panel"):
		Game.add_item("coconut", 2, false)
		Game.add_item("log", 3, false)
		Game.add_item("stone", 5, false)
		Game.hud.toggle_survival_panel()
	if args.has("clean"):
		Game.hud.visible = false
	if args.has("nowater"):
		Game.ocean.visible = false
	if args.has("slot"):
		Game.player._select_slot(int(args["slot"]))
	for i in 90:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_png(str(args["shot"]))
	get_tree().quit()


func _setup_environment() -> void:
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = load("res://shaders/sky.gdshader")
	sky_mat.set_shader_parameter("cloud_tex", Mats.noise_tex(0.008, 512, false, 8.0, 6))
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
	sky.radiance_size = Sky.RADIANCE_SIZE_128

	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_white = 6.0
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 1.6
	env.ssil_enabled = true
	env.glow_enabled = true
	env.glow_intensity = 0.45
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 1.3
	env.fog_enabled = true
	env.fog_density = 0.0035
	env.fog_aerial_perspective = 0.55
	env.fog_sky_affect = 0.25
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.0045
	env.volumetric_fog_anisotropy = 0.6
	env.volumetric_fog_length = 80.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.1
	env.adjustment_contrast = 1.04
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 90.0
	sun.light_angular_distance = 0.4
	sun.shadow_blur = 1.0
	sun.light_volumetric_fog_energy = 1.2
	add_child(sun)
	moon = DirectionalLight3D.new()
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 50.0
	moon.light_color = Color(0.6, 0.7, 1.0)
	moon.light_volumetric_fog_energy = 0.5
	add_child(moon)


## Applies the graphics preset (Settings.quality: 0 Low, 1 Medium, 2 High, 3 Ultra).
func apply_quality() -> void:
	var S := Settings
	var sh: int = S.shadows
	env.ssao_enabled = S.ambient_occlusion > 0
	RenderingServer.environment_set_ssao_quality(RenderingServer.ENV_SSAO_QUALITY_LOW if S.ambient_occlusion < 2 else RenderingServer.ENV_SSAO_QUALITY_MEDIUM,
		S.ambient_occlusion < 2, 0.5, 2, 50.0, 300.0)
	env.ssil_enabled = S.indirect_light
	env.ssr_enabled = S.reflections
	env.volumetric_fog_enabled = S.volumetric_fog
	env.glow_enabled = S.bloom
	env.sdfgi_enabled = false
	env.adjustment_enabled = true
	env.adjustment_brightness = S.brightness
	env.adjustment_contrast = 1.04 * S.contrast
	env.adjustment_saturation = 1.1 * S.saturation
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS if sh >= 2 else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = S.shadow_distance
	sun.light_angular_distance = 0.4 if sh >= 3 else 0.0
	moon.shadow_enabled = sh >= 1
	RenderingServer.directional_shadow_atlas_set_size([2048, 2048, 4096, 8192][sh], true)
	var soft: int = [RenderingServer.SHADOW_QUALITY_HARD, RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW,
		RenderingServer.SHADOW_QUALITY_SOFT_LOW, RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM][sh]
	RenderingServer.directional_soft_shadow_filter_set_quality(soft)
	RenderingServer.positional_soft_shadow_filter_set_quality(soft)
	var vp := get_viewport()
	# MSAA breaks the depth texture the water refraction relies on; FXAA / TAA are used instead
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if S.antialiasing in [1, 3] else Viewport.SCREEN_SPACE_AA_DISABLED
	var fwd := RenderingServer.get_current_rendering_method() == "forward_plus"
	vp.use_taa = fwd and S.antialiasing >= 2
	vp.scaling_3d_scale = clampf(S.render_scale, 0.5, 1.0)
	# FSR needs Forward+; the web/compatibility renderer falls back to bilinear
	var mode := Viewport.SCALING_3D_MODE_BILINEAR
	if fwd and S.upscaler == 1 and S.render_scale < 0.99:
		mode = Viewport.SCALING_3D_MODE_FSR
	elif fwd and S.upscaler == 2:
		mode = Viewport.SCALING_3D_MODE_FSR2
	vp.scaling_3d_mode = mode
	vp.fsr_sharpness = 0.4
	Game.grass_density = [0.35, 0.6, 0.85, 1.0][S.grass]
	Game.grass_range = S.view_distance
	if Game.world:
		Game.world.apply_grass_settings()
	for c in get_tree().get_nodes_in_group("campfires"):
		c.set_shadows(sh >= 2)
	_post_mat.set_shader_parameter("grain", 0.045 if S.film_grain else 0.0)
	_post_mat.set_shader_parameter("vignette", 0.32 if S.vignette else 0.0)


var _post_mat: ShaderMaterial


## Film grain and lens vignette, drawn under the HUD.
func _setup_post() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 1
	add_child(layer)
	var r := ColorRect.new()
	r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_post_mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type canvas_item;
uniform float grain = 0.045;
uniform float vignette = 0.32;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	vec2 px = floor(FRAGCOORD.xy / 1.5);
	float n = h(px + fract(TIME * 7.13) * 91.7) - 0.5;
	float v = smoothstep(0.45, 1.05, length((UV - 0.5) * vec2(1.25, 1.0)) * 1.25) * vignette;
	// grain over a darkening vignette, composited correctly ("over" operator)
	float ga = abs(n) * grain;
	float a = ga + v - ga * v;
	vec3 c = vec3(step(0.0, n)) * ga * (1.0 - v);
	COLOR = vec4(a > 0.0 ? c / a : vec3(0.0), a);
}"""
	_post_mat.shader = sh
	r.material = _post_mat
	layer.add_child(r)


func _slope(world: VoxelWorld, x: float, z: float) -> float:
	var hx := world.surface_height(x + 1.0, z) - world.surface_height(x - 1.0, z)
	var hz := world.surface_height(x, z + 1.0) - world.surface_height(x, z - 1.0)
	return Vector2(hx, hz).length() * 0.5


func _populate(rng: RandomNumberGenerator) -> void:
	var world := Game.world
	var placed: Array[Vector3] = []
	var oaks := 0
	var palms := 0
	var tries := 0
	while (oaks < 16 or palms < 13) and tries < 3000:
		tries += 1
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 30.0
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 0.9 or _slope(world, x, z) > 0.55:
			continue
		if world.density_at(Vector3(x, h + 1.5, z)) > 0.0:
			continue
		var kind := ""
		if h < 3.2 and r > 13.0 and palms < 13:
			kind = "palm"
		elif h > 3.0 and oaks < 16:
			kind = "oak"
		if kind == "":
			continue
		var p := Vector3(x, h, z)
		var ok := true
		for q in placed:
			if q.distance_to(p) < (3.2 if kind == "palm" else 4.2):
				ok = false
				break
		if not ok:
			continue
		placed.append(p)
		var t := IslandTree.new()
		add_child(t)
		t.global_position = p - Vector3(0, 0.1, 0)
		t.rotation.y = rng.randf() * TAU
		t.setup(kind, rng.randi())
		if kind == "palm":
			palms += 1
		else:
			oaks += 1

	# boulders on hills and at the cliff foot
	var b := 0
	tries = 0
	while b < 11 and tries < 800:
		tries += 1
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 28.0
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 0.6 or _slope(world, x, z) > 0.5:
			continue
		var ok := true
		for q in placed:
			if Vector2(q.x - x, q.z - z).length() < 2.5:
				ok = false
				break
		if not ok:
			continue
		var s := rng.randf_range(0.55, 1.25)
		Boulder.create(Vector3(x, h + s * 0.45, z), s, rng)
		placed.append(Vector3(x, h, z))
		b += 1

	# loose stones and driftwood on the beach
	for i in 22:
		var a := rng.randf() * TAU
		var r := rng.randf_range(15.0, 28.0)
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 0.3 or h > 4.0:
			continue
		PhysicsItem.make_stone(Vector3(x, h + 0.3, z), rng.randf_range(0.1, 0.18), rng)
	var logs := 0
	tries = 0
	while logs < 4 and tries < 400:
		tries += 1
		var a := rng.randf() * TAU
		var r := rng.randf_range(18.0, 28.0)
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 0.4 or h > 2.0:
			continue
		var bas := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, PI * 0.5)
		PhysicsItem.make_log(Vector3(x, h + 0.35, z), bas, rng.randf_range(0.12, 0.17), rng.randf_range(1.3, 2.0))
		logs += 1
	# a few coconuts have already fallen
	var palm_trees := get_tree().get_nodes_in_group("trees").filter(func(t: Node) -> bool: return t.kind == "palm")
	for i in mini(5, palm_trees.size()):
		var t: Node3D = palm_trees[i * 2 % palm_trees.size()]
		var off := Vector3(rng.randf_range(-1.5, 1.5), 0, rng.randf_range(-1.5, 1.5))
		var cp := t.global_position + off
		PhysicsItem.make_coconut(Vector3(cp.x, world.surface_height(cp.x, cp.z) + 0.3, cp.z))


## Bushes are pure decoration, so they are regenerated identically on every load.
func _spawn_bushes() -> void:
	var world := Game.world
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED + 99
	for i in 30:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 24.0
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 2.0 or _slope(world, x, z) > 0.6:
			continue
		BerryBush.create(self, Vector3(x, h - 0.1, z), rng, rng.randf() < 0.5)


func default_spawn() -> Vector3:
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED + 1
	return _find_spawn(rng)


## Fish schools live where the lagoon is 1–3 m deep.
func _spawn_fish() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED + 7
	var spots: Array[Vector3] = []
	var tries := 0
	while spots.size() < 4 and tries < 2000:
		tries += 1
		var a := rng.randf() * TAU
		var r := rng.randf_range(22.0, 34.0)
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		var bed := Game.world.surface_height(p.x, p.z)
		if bed > -3.2 and bed < -1.0:
			var far_enough := true
			for q in spots:
				if q.distance_to(p) < 12.0:
					far_enough = false
			if far_enough:
				p.y = bed + 0.6
				spots.append(p)
	for i in spots.size():
		FishSchool.create(self, spots[i], SEED + i)


func _find_spawn(rng: RandomNumberGenerator) -> Vector3:
	var world := Game.world
	for i in 400:
		var a := deg_to_rad(200.0) + rng.randf_range(-0.8, 0.8)
		for r in range(26, 8, -1):
			var x := cos(a) * r
			var z := sin(a) * r
			var h := world.surface_height(x, z)
			if h > 1.2 and h < 3.5 and _slope(world, x, z) < 0.3:
				return Vector3(x, h + 0.3, z)
	return Vector3(0, world.surface_height(0, 0) + 1.0, 0)


func _run_tests() -> void:
	var p := Game.player
	print("TEST spawn ", p.global_position, " on_floor=", p.is_on_floor())
	# 1) chop the nearest tree
	var best: IslandTree = null
	for t in get_tree().get_nodes_in_group("trees"):
		if best == null or t.global_position.distance_to(p.global_position) < best.global_position.distance_to(p.global_position):
			best = t
	print("TEST tree ", best.kind, " hp=", best.hp, " at ", best.global_position)
	while not best.felled:
		best.hit(Vector3(1, 0, 0), best.global_position + Vector3.UP)
	for i in 420:
		await get_tree().physics_frame
	var logs := 0
	for c in Game.props.get_children():
		if c is PhysicsItem and c.item_id == "log":
			logs += 1
	print("TEST logs in world after felling: ", logs)
	# 2) buoyancy: drop a log and a stone into the sea
	var rng := RandomNumberGenerator.new()
	var lg := PhysicsItem.make_log(Vector3(0, 2, 40), Basis(Vector3.RIGHT, PI / 2), 0.15, 1.2)
	var st := PhysicsItem.make_stone(Vector3(2, 2, 40), 0.15, rng)
	for i in 400:
		await get_tree().physics_frame
	print("TEST log y=%.2f (should float ~0)  stone y=%.2f (should sink)" % [lg.global_position.y, st.global_position.y])
	# 3) dig
	var h0 := Game.world.surface_height(5, 5)
	var got := Game.world.edit_sphere(Vector3(5, h0, 5), 1.4, -1.6)
	print("TEST dig at h=%.2f got %s new h=%.2f" % [h0, got, Game.world.surface_height(5, 5)])
	# 4) build: post on ground, beam on post, cantilever chain, then remove post
	var gx := Vector3(8, 0, 12)
	gx.y = Game.world.surface_height(gx.x, gx.z)
	var post := Game.structures.place("post", Transform3D(Basis(), gx + Vector3(0, 1.15, 0)))
	await get_tree().physics_frame
	var beams: Array = []
	for i in 7:
		var bx := Transform3D(Basis(), gx + Vector3(1.2 + i * 2.4, 2.41, 0))
		beams.append(Game.structures.place("plank", bx))
		await get_tree().physics_frame
	var sup := []
	for b in beams:
		sup.append("%.2f%s" % [b.support, "L" if b.loose else ""])
	print("TEST post grounded=", post.grounded, " beam supports=", sup)
	post.damage(post.global_position, 99)
	await get_tree().physics_frame
	var loose := 0
	for b in beams:
		if is_instance_valid(b) and b.loose:
			loose += 1
	print("TEST after removing post: loose beams=", loose, "/", beams.size())
	for i in 120:
		await get_tree().physics_frame
	print("TEST beam0 y after fall=%.2f" % beams[0].global_position.y)
	print("TEST inventory ", Game.inventory)
	# 5) player-level tool paths
	Game.add_item("log", 5, false)
	Game.add_item("stone", 10, false)
	var tgt: IslandTree = null
	for t in get_tree().get_nodes_in_group("trees"):
		if tgt == null or t.global_position.distance_to(p.global_position) < tgt.global_position.distance_to(p.global_position):
			tgt = t
	p.global_position = tgt.global_position + Vector3(2.0, 0.3, 0)
	p.look_toward(tgt.global_position)
	p.pitch = -0.2
	await get_tree().physics_frame
	await get_tree().physics_frame
	var hp0 := tgt.hp
	p._apply_hit("axe")
	print("TEST axe hit via ray: hp ", hp0, " -> ", tgt.hp)
	p.pitch = -1.2
	await get_tree().physics_frame
	p._dig(p._look(4.0))
	p._dig(p._look(4.0))
	print("TEST shovel dig -> inv dirt/sand ", Game.inventory["dirt"], "/", Game.inventory["sand"])
	p.pitch = -0.9
	p._select_slot(6)
	for i in 5:
		await get_tree().process_frame
	print("TEST ghost visible=", p._ghost.visible, " ok=", p._ghost_ok, " hint=", p.hint)
	p._place_piece("plank")
	print("TEST placed pieces=", Game.structures.pieces.size(), " planks left=", Game.inventory["plank"], " logs=", Game.inventory["log"])
	p._select_slot(0)
	var lg2 := PhysicsItem.make_log(p.camera.global_position - p.camera.global_basis.z * 2.0, Basis(), 0.12, 1.0)
	await get_tree().physics_frame
	await get_tree().physics_frame
	p._try_grab(p._look(4.0))
	print("TEST grabbed=", p.held)
	for i in 60:
		await get_tree().physics_frame
	print("TEST held log offset from target=%.2f" % (lg2.global_position.distance_to(p.head.global_position - p.camera.global_basis.z * p.held_dist)))
	p._throw()
	await _phase2_tests()
	await _story_tests()
	print("TEST done inventory ", Game.inventory)


## Key art for the loading screen, rendered in-engine: the survivor on the beach
## at dawn, looking out at the wreck of the Murjan.
func _render_cover(path: String, hour: float) -> void:
	Game.hud.set_gameplay_visible(false)
	var p := Game.player
	Game.playing = false
	p.visible = false
	Game.day_night.time_hours = hour
	Game.day_night.day_minutes = 100000.0
	Game.weather.force("cloudy")
	# a lone figure on the west beach, the sun going down over open sea
	var a := Actor.create("castaway", {"idle": "m_idle_look_around_01"})
	add_child(a)
	var spot := Vector3.ZERO
	for r in range(40, 5, -1):
		var h := Game.world.surface_height(-float(r), 2.0)
		if h > 1.0:
			spot = Vector3(-float(r) + 1.5, 0, 2.0)
			break
	spot.y = Game.world.surface_height(spot.x, spot.z)
	a.global_position = spot
	a.look_at(spot + Vector3(-1, 0, 0.15), Vector3.UP)
	a.play("idle", 0.0, 0.0, 1.0)
	var cam := Camera3D.new()
	cam.fov = 34.0
	cam.far = 2000.0
	add_child(cam)
	cam.global_position = spot + Vector3(4.2, 0.55, 1.6)
	cam.look_at(spot + Vector3(-30.0, 3.4, -3.0))
	cam.current = true
	get_viewport().use_taa = false
	for i in 160:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)


func _world_summary() -> String:
	var alive := get_tree().get_nodes_in_group("trees").size()
	var all_trees := get_tree().get_nodes_in_group("island_trees").size()
	var items := 0
	for c in Game.props.get_children():
		if c is PhysicsItem and not c.is_queued_for_deletion():
			items += 1
	var v := Game.player.vitals
	return "trees=%d stumps=%d items=%d pieces=%d campfires=%d collectors=%d beds=%d h(5,5)=%.2f day=%d food=%.0f water=%.0f tools=%s weather=%s inv=%s" % [
		alive, all_trees - alive, items, Game.structures.pieces.size(),
		get_tree().get_nodes_in_group("campfires").size(), get_tree().get_nodes_in_group("collectors").size(),
		get_tree().get_nodes_in_group("beds").size(), Game.world.surface_height(5, 5),
		Game.day_number, v.food, v.water, Game.tools, Game.weather.state, Game.inventory] + \
		" story=%s/%s mission=%d journal=%d morale=%.0f crates=%d bottles=%d gulls=%d" % [Game.story.backstory, Game.story.mystery,
		Game.story.mission, Game.story.journal.size(), v.morale, get_tree().get_nodes_in_group("story_crates").size(),
		get_tree().get_nodes_in_group("bottles").size(), get_tree().get_nodes_in_group("gulls").size()]


func _story_tests() -> void:
	var st := Game.story
	var p := Game.player
	print("TEST3 who=%s mystery=%s mission=%d (%s) journal=%d" % [st.backstory, st.mystery, st.mission, st.mission_def()["id"], st.journal.size()])
	# the wreck crate
	var wc: StoryCrate = null
	for c in get_tree().get_nodes_in_group("story_crates"):
		if c.story_key == "wreck":
			wc = c
	var w: Wreck = get_tree().get_first_node_in_group("wreck")
	print("TEST3 wreck at %s crate at %s" % [w.global_position, wc.global_position if wc else Vector3.INF])
	var hit := Game.cast_ray(wc.global_position + Vector3(0, 3, 0), wc.global_position + Vector3(0, -3, 0), Game.L_TERRAIN | Game.L_STRUCT)
	print("TEST3 crate ray hit=%s" % (hit.get("collider") == wc))
	var hit2 := Game.cast_ray(wc.global_position + Vector3(0.0, 0.3, 0.0), wc.global_position + Vector3(0, -3, 0), Game.L_TERRAIN, [wc.get_rid()])
	print("TEST3 deck under crate: %s dist=%.2f" % [hit2.get("collider") == w, wc.global_position.y - (hit2["position"].y if hit2 else -99.0)])
	wc.open()
	print("TEST3 wreck_found=%s tins=%d medkit=%d" % [st.flags.get("wreck_found", false), Game.count("tin"), Game.count("medkit")])
	# storyteller events
	st._spawn_crate()
	st._spawn_bottle()
	st._spawn_gull()
	print("TEST3 events: crates=%d bottles=%d gulls=%d letters=%s" % [get_tree().get_nodes_in_group("story_crates").size(),
		get_tree().get_nodes_in_group("bottles").size(), get_tree().get_nodes_in_group("gulls").size(), st.letters_read])
	var b: MessageBottle = get_tree().get_nodes_in_group("bottles")[0]
	b.read()
	await get_tree().process_frame
	Game.hud._chosen.emit(0)
	# the gull: feed it
	Game.add_item("berry", 3, false)
	var g: Gull = get_tree().get_nodes_in_group("gulls")[0]
	st.gull_choice(g)
	await get_tree().process_frame
	Game.hud._chosen.emit(0)
	await get_tree().process_frame
	await get_tree().process_frame
	print("TEST3 gull friend=%s gulls=%d" % [st.flags.get("gull_friend", false), get_tree().get_nodes_in_group("gulls").size()])
	# a passing ship
	st._distant_ship()
	var ship: DistantShip = null
	for c in get_children():
		if c is DistantShip:
			ship = c
	var passed := [false]
	ship.passed.connect(func() -> void: passed[0] = true)
	ship._t = DistantShip.DURATION - 0.1
	for i in 10:
		await get_tree().process_frame
	print("TEST3 ship passed=%s" % passed[0])
	# the mind: despair brings the hallucinations
	p.vitals.morale = 5.0
	p.vitals.advance(0.1)
	for i in 30:
		await get_tree().process_frame
	print("TEST3 morale=%.1f intensity=%.2f status=%s" % [p.vitals.morale, st._hallucinate.intensity, p.vitals.status])
	p.vitals.morale = 60.0
	# journal tab builds
	SurvivalPanel._tab = 1
	Game.hud.toggle_survival_panel()
	for i in 5:
		await get_tree().process_frame
	Game.hud.toggle_survival_panel()
	SurvivalPanel._tab = 0
	# subtitles flow
	st.say({"en": "Test line.", "ar": "سطر تجريبي."}, false)
	for i in 5:
		await get_tree().process_frame
	print("TEST3 subtitle='%s' alpha=%.2f" % [st.current_line, st.line_alpha])
	# Arabic switch
	Settings.language = "ar"
	print("TEST3 ar title=%s" % StoryData.t(st.mission_def()["title"]))
	Settings.language = "en"
	print("TEST3 ok mission=%d (%s) journal=%d" % [st.mission, st.mission_def()["id"], st.journal.size()])
	# the finale: a night choice, then the end-of-act card
	var saved := st.to_dict()
	st.mission = StoryData.MISSIONS.size() - 1
	Game.day_night.time_hours = 21.0
	for i in 5:
		await get_tree().process_frame
	Game.hud._chosen.emit(1)
	await get_tree().create_timer(15.5).timeout
	Game.hud._chosen.emit(0)
	await get_tree().process_frame
	print("TEST3 finale choice=%s act_over=%s ui_open=%s" % [st.flags.get("finale_choice", "-"), st.act_over(), Game.ui_open])
	st.from_dict(saved)


func _phase2_tests() -> void:
	var p := Game.player
	var v := p.vitals
	# needs drain over time
	var f0 := v.food
	var w0 := v.water
	v.advance(5.0)
	print("TEST2 5h: food %.0f->%.0f water %.0f->%.0f energy %.0f" % [f0, v.food, w0, v.water, v.energy])
	# coconut: food + water
	Game.add_item("coconut", 1, false)
	var fw := v.food + v.water
	v.eat("coconut")
	print("TEST2 coconut eaten: food+water +%.0f" % (v.food + v.water - fw))
	# crafting
	Game.add_item("log", 6, false)
	Game.add_item("stone", 12, false)
	var crafted := []
	for r in Items.RECIPES:
		if r["id"] in ["spear", "torch", "campfire", "collector", "bed"]:
			crafted.append("%s=%s" % [r["id"], Game.craft(r)])
	print("TEST2 crafted ", crafted, " spear=", Game.tools["spear"], " kits=", Game.count("campfire"), Game.count("collector"), Game.count("bed"))
	# fishing: put a fish right in front of the spear
	var school: FishSchool = get_tree().get_nodes_in_group("fish_schools")[0]
	p.global_position = school.home + Vector3(0, 0.5, 2.0)
	p.set_physics_process(false)
	p.look_toward(school.home)
	p.rotation.y = p.yaw
	p.pitch = 0.0
	p.head.rotation.x = 0.0
	await get_tree().process_frame
	var fish_node: Node3D = school.fish[0]["node"]
	school.set_process(false)
	fish_node.global_position = p.head.global_position - p.camera.global_basis.z * 1.5
	p._select_slot(4)
	p._thrust()
	await get_tree().create_timer(0.3).timeout
	print("TEST2 spear catch -> raw fish ", Game.count("fish_raw"), " schools=", get_tree().get_nodes_in_group("fish_schools").size())
	school.set_process(true)
	p.set_physics_process(true)
	# place campfire / collector / bed on flat ground and use them
	var base := default_spawn() + Vector3(0, 0, 0)
	var cf := Campfire.create(Vector3(base.x + 2, Game.world.surface_height(base.x + 2, base.z), base.z))
	Game.take({"campfire": 1})
	Game.add_item("fish_raw", 1, false)
	cf.cook_fish()
	await get_tree().create_timer(Campfire.COOK_TIME * 2 + 0.5).timeout
	print("TEST2 cooked fish=", Game.count("fish_cooked"), " raw left=", Game.count("fish_raw"))
	var rc := RainCollector.create(Vector3(base.x - 2, Game.world.surface_height(base.x - 2, base.z), base.z))
	rc.water = 0.0
	Game.weather.force("storm")
	Game.day_night.day_minutes = 2.0
	await get_tree().create_timer(3.0).timeout
	print("TEST2 storm: rain=%.2f wind=%.2f waves=%.2f collector water=%.2f" % [Game.weather.rain, Game.weather.wind, Game.ocean.wave_scale, rc.water])
	Game.day_night.day_minutes = 16.0
	v.water = 40.0
	rc.water = 5.0
	rc.drink(v)
	print("TEST2 drank from collector: water=%.0f collector=%.1f" % [v.water, rc.water])
	# sleep
	var bed := Bed.create(Vector3(base.x, Game.world.surface_height(base.x, base.z + 3), base.z + 3))
	Game.day_night.time_hours = 22.0
	var day0 := Game.day_number
	v.energy = 20.0
	await p.sleep_in(bed)
	print("TEST2 slept: time=%.1f day %d->%d energy=%.0f respawn_set=%s" % [Game.day_night.time_hours, day0, Game.day_number, v.energy, Game.respawn_point != Vector3.INF])
	Game.weather.force("clear")
	# coconuts fall when chopping palms
	var coco0 := 0
	for c in Game.props.get_children():
		if c is PhysicsItem and c.item_id == "coconut":
			coco0 += 1
	for t in get_tree().get_nodes_in_group("trees"):
		if t.kind == "palm" and not t.felled:
			for k in 4:
				t.hit(Vector3.RIGHT, t.global_position + Vector3.UP)
			break
	var coco1 := 0
	for c in Game.props.get_children():
		if c is PhysicsItem and c.item_id == "coconut":
			coco1 += 1
	print("TEST2 coconuts on ground %d -> %d" % [coco0, coco1])
	# death and respawn at the bed
	v.hurt(500.0)
	print("TEST2 dead=", v.dead)
	await get_tree().process_frame
	p.respawn()
	Game.hud._death.queue_free()
	Game.hud._death = null
	Game.ui_open = false
	print("TEST2 respawned health=%.0f near bed=%s" % [v.health, p.global_position.distance_to(bed.global_position) < 2.0])
	# third person view and the survival panel build without errors
	p.toggle_camera()
	Game.hud.toggle_survival_panel()
	for i in 10:
		await get_tree().process_frame
	Game.hud.toggle_survival_panel()
	p.toggle_camera()
	print("TEST2 ok")
