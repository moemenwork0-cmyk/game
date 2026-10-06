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


func _ready() -> void:
	var mode := Game.start_mode
	Game.start_mode = ""
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--test") or a.begins_with("--shot"):
			mode = "new"
		if a == "--loadtest":
			mode = "load"
	var save_data := {}
	if mode == "load":
		save_data = SaveGame.read()
		if save_data.is_empty():
			mode = "new"

	var hud := Hud.new()
	add_child(hud)
	Game.hud = hud
	hud.set_gameplay_visible(false)
	var sfx := Sfx.new()
	add_child(sfx)
	Game.sfx = sfx
	hud.set_loading(0.02, "Preparing the sea...")
	await get_tree().process_frame

	_setup_environment()
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
	var shader_mats: Array[ShaderMaterial] = [world.terrain_material, ocean.mat]
	dn.setup(env, sky_mat, sun, moon, shader_mats)

	hud.set_loading(0.75, "Planting trees...")
	await get_tree().process_frame
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED
	_spawn_bushes()
	if save_data.is_empty():
		_populate(rng)
	else:
		SaveGame.restore_objects(save_data, self)
		dn.time_hours = float(save_data["time_hours"])
		await sm.restore(save_data["structures"])
	apply_quality()
	Settings.changed.connect(_on_settings_changed)

	hud.set_loading(0.95, "Letting the world settle...")
	for i in 40:
		await get_tree().physics_frame
	hud.hide_loading()
	if mode == "new" or mode == "load":
		start_play(save_data)
	else:
		_show_menu()
	_debug_shots()


func _on_settings_changed() -> void:
	if Game.player:
		Game.player.camera.fov = Settings.fov


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
		var rng := RandomNumberGenerator.new()
		rng.seed = SEED + 1
		var spawn := _find_spawn(rng)
		player.global_position = spawn
		player.look_toward(Vector3(0, spawn.y, 0))
		Game.day_night.time_hours = 7.2
		Game.toast.emit("Welcome to Jazira. Press Esc for the menu.")
	else:
		var pd: Dictionary = data["player"]
		player.global_position = pd["pos"] + Vector3(0, 0.1, 0)
		player.yaw = float(pd["yaw"])
		player.pitch = float(pd["pitch"])
		player.stamina = float(pd.get("stamina", 1.0))
		Game.toast.emit("Welcome back — day %d" % Game.day_number)
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
	if Game.playing and not get_tree().paused:
		_autosave_t += delta
		if _autosave_t >= AUTOSAVE_SECONDS:
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
	if args.has("menushot"):
		if args.has("settings"):
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
	var q := Settings.quality
	env.ssao_enabled = q >= 1
	RenderingServer.environment_set_ssao_quality(RenderingServer.ENV_SSAO_QUALITY_LOW if q < 3 else RenderingServer.ENV_SSAO_QUALITY_MEDIUM, q < 3, 0.5, 2, 50.0, 300.0)
	env.ssil_enabled = q >= 3
	env.volumetric_fog_enabled = q >= 2
	env.glow_enabled = true
	env.sdfgi_enabled = false
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS if q >= 2 else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = [45.0, 65.0, 90.0, 110.0][q]
	sun.light_angular_distance = 0.4 if q >= 3 else 0.0
	moon.shadow_enabled = q >= 1
	RenderingServer.directional_shadow_atlas_set_size([2048, 2048, 4096, 4096][q], true)
	var soft: int = [RenderingServer.SHADOW_QUALITY_HARD, RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW,
		RenderingServer.SHADOW_QUALITY_SOFT_LOW, RenderingServer.SHADOW_QUALITY_SOFT_MEDIUM][q]
	RenderingServer.directional_soft_shadow_filter_set_quality(soft)
	RenderingServer.positional_soft_shadow_filter_set_quality(soft)
	var vp := get_viewport()
	# MSAA breaks the depth texture the water refraction relies on; FXAA is used instead
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	vp.scaling_3d_scale = clampf(Settings.render_scale, 0.5, 1.0)
	# FSR upscaling needs Forward+; the web/compatibility renderer falls back to bilinear
	var fsr_ok := RenderingServer.get_current_rendering_method() == "forward_plus"
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if fsr_ok and Settings.render_scale < 0.99 else Viewport.SCALING_3D_MODE_BILINEAR
	vp.fsr_sharpness = 0.4
	Game.grass_density = [0.35, 0.6, 0.85, 1.0][q]
	Game.grass_range = [28.0, 45.0, 65.0, 85.0][q]
	if Game.world:
		Game.world.apply_grass_settings()
	for c in get_tree().get_nodes_in_group("campfires"):
		c.set_shadows(q >= 2)


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


## Bushes are pure decoration, so they are regenerated identically on every load.
func _spawn_bushes() -> void:
	var world := Game.world
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED + 99
	var bush_mat := Mats.get_mat("leaves_bush")
	for i in 26:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 24.0
		var x := cos(a) * r
		var z := sin(a) * r
		var h := world.surface_height(x, z)
		if h < 2.0 or _slope(world, x, z) > 0.6:
			continue
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for c in rng.randi_range(2, 4):
			IslandTree.add_leaf_cluster(st, rng, Vector3(0, 0.3, 0), Vector3(rng.randf_range(-0.5, 0.5), rng.randf_range(0.25, 0.55), rng.randf_range(-0.5, 0.5)), rng.randf_range(0.5, 0.8), 45)
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = bush_mat
		add_child(mi)
		mi.global_position = Vector3(x, h - 0.1, z)



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
	p._select_slot(4)
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
	print("TEST held log offset from target=%.2f" % (lg2.global_position.distance_to(p.camera.global_position - p.camera.global_basis.z * p.held_dist)))
	p._throw()
	p._select_slot(8)
	p.pitch = -1.3
	await get_tree().physics_frame
	p._place_campfire(p._look(4.0))
	for i in 30:
		await get_tree().process_frame
	print("TEST done inventory ", Game.inventory)


func _world_summary() -> String:
	var alive := get_tree().get_nodes_in_group("trees").size()
	var all_trees := get_tree().get_nodes_in_group("island_trees").size()
	var items := 0
	for c in Game.props.get_children():
		if c is PhysicsItem and not c.is_queued_for_deletion():
			items += 1
	return "trees=%d stumps=%d items=%d pieces=%d campfires=%d h(5,5)=%.2f day=%d inv=%s" % [
		alive, all_trees - alive, items, Game.structures.pieces.size(),
		get_tree().get_nodes_in_group("campfires").size(), Game.world.surface_height(5, 5),
		Game.day_number, Game.inventory]
