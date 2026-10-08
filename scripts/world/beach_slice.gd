extends Node3D
## Phase 1 vertical slice: the wake-up cove at final visual quality.
## Free camera (WASD + mouse, Shift fast, Q/E down/up, T time of day, 1-9 viewpoints).
##   godot res://scenes/slice.tscn                   explore
##   godot res://scenes/slice.tscn -- --shots=DIR    render every viewpoint to DIR and quit
##   extra: --hour=H  --noclouds  --frames=N (frames to settle before each shot)

const ISLAND := "res://assets/env/island"
# viewpoints: position, look-at target, hour
const VIEWS := [
	[Vector3(20, 0, 452), Vector3(-160, 1.0, 520), 8.5],        # at the waterline, along the cove
	[Vector3(-40, 0, 425), Vector3(0, 6.0, 340), 16.5],         # dry sand towards the jungle edge
	[Vector3(240, 38, 560), Vector3(0, 0, 440), 10.0],          # from the east headland over the cove
	[Vector3(100, 0, 465), Vector3(-200, 0.0, 560), 17.8],      # sunset over the sea, looking west
	[Vector3(-250, 160, 900), Vector3(0, 20, 300), 7.0],        # aerial sunrise over the island
	[Vector3(0, 0, 340), Vector3(-40, 6, 280), 12.0],           # inside the jungle edge
	[Vector3(-20, 0, 432), Vector3(10, 9, 330), 15.0, 1.0],     # a tropical storm rolls in over the jungle
	[Vector3(30, 0, 455), Vector3(80, 0, 1000), 11.0],          # the lagoon and the palm islets
]

# close-up review shots: position, look-at, hour, storm
const CLOSE := [
	[Vector3(-25, 0, 446), Vector3(-160, 1.2, 478), 9.0],       # on the beach: sand, surf, palms, rocks
	[Vector3(-8, 0, 372), Vector3(-55, 2.5, 330), 15.5],        # in the vegetation at the jungle edge
	[Vector3(-20, 0, 432), Vector3(10, 9, 330), 15.0, 1.0],     # a storm rolling in over the jungle
]

var terrain: Terrain3D
var ocean: OceanFFT
var sky: SkyRig
var scatter: Scatter
var cam: Camera3D
var _yaw := 0.0
var _pitch := 0.0
var _speed := 6.0
var _ready_done := false
var _label: Label


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--quality="):  # render farm / benchmarks: force a preset
			Settings._preset(int(a.trim_prefix("--quality=")))
			Settings.render_scale = 1.0
	for a in args:
		if a.begins_with("--shots="):  # watchdog: never hang a headless render
			get_tree().create_timer(2300.0).timeout.connect(get_tree().quit.bind(3))
	sky = SkyRig.new()
	add_child(sky)
	for a in args:
		if a.begins_with("--hour="):
			sky.hour = float(a.trim_prefix("--hour="))

	terrain = Terrain3D.new()
	terrain.name = "Terrain"
	add_child(terrain)
	await get_tree().process_frame  # Terrain3D builds its subsystems on entering the tree
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
	print("terrain: regions %d, textures %d" % [terrain.data.get_region_count(), terrain.assets.get_texture_count()])

	cam = Camera3D.new()
	cam.fov = Settings.fov
	cam.near = 0.08
	cam.far = 30000.0
	add_child(cam)
	cam.make_current()
	terrain.set_camera(cam)

	var shore_tex: Texture2D = load(ISLAND + "/shore.res")
	ocean = OceanFFT.new()
	ocean.name = "Ocean"
	add_child(ocean)
	ocean.set_shore(shore_tex, -1024, -1024, 2048)

	if OS.get_cmdline_user_args().has("--noocean"):
		ocean.queue_free()
	scatter = Scatter.new()
	scatter.name = "Scatter"
	add_child(scatter)
	scatter.setup(terrain, shore_tex.get_image(), Rect2(-1024, -1024, 2048, 2048))
	_set_view(0)
	await get_tree().process_frame
	var shooting := false
	for a in args:
		shooting = shooting or a.begins_with("--shots=")
	if args.has("--noscatter"):
		scatter.set_process(false)
	elif shooting:
		scatter.set_process(false)  # the screenshot tool builds around each viewpoint itself
	else:
		var cover := _loading_cover()
		await get_tree().process_frame
		await scatter.build_static(Vector3(0, 0, 450), 900.0, func(p: float) -> void:
			cover.get_node("L").text = tr("Growing the jungle… %d%%") % int(p * 100.0))
		cover.queue_free()
	_ready_done = true
	_apply_quality()

	_label = Label.new()
	_label.position = Vector2(16, 12)
	_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	add_child(_label)

	for a in args:
		if a.begins_with("--shots="):
			_shoot_all(a.trim_prefix("--shots="))
			return
	if args.has("--bench"):
		_bench()
		return
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## Full-screen cover with a progress line while the island is planted.
func _loading_cover() -> CanvasLayer:
	var cl := CanvasLayer.new()
	cl.layer = 50
	add_child(cl)
	var bg := ColorRect.new()
	bg.color = Color(0.02, 0.04, 0.06)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cl.add_child(bg)
	var l := Label.new()
	l.name = "L"
	l.text = tr("Loading the island…")
	l.add_theme_font_size_override("font_size", 28)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cl.add_child(l)
	return cl


func _apply_quality() -> void:
	var vp := get_viewport()
	vp.use_taa = Settings.antialiasing >= 1
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR2 if Settings.upscaler >= 1 and Settings.render_scale < 0.99 else Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = Settings.render_scale
	vp.mesh_lod_threshold = 1.0


func _set_view(i: int) -> void:
	_apply_view(VIEWS[i % VIEWS.size()])


func _apply_view(v: Array) -> void:
	var p: Vector3 = v[0]
	var ground := terrain.data.get_height(p) if terrain.data else 0.0
	if not is_nan(ground):
		p.y = maxf(p.y, ground + 1.7)
	cam.global_position = p
	cam.look_at(v[1])
	_yaw = cam.rotation.y
	_pitch = cam.rotation.x
	sky.hour = v[2]
	sky.storm = v[3] if v.size() > 3 else 0.0
	if is_instance_valid(ocean):
		ocean.sea_state = 1.0 + sky.storm * 1.4


func _shoot_all(dir: String) -> void:
	DirAccess.make_dir_recursive_absolute(dir)
	var frames := 40
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--frames="):
			frames = int(a.trim_prefix("--frames="))
	_label.visible = false
	var only := -1
	var list: Array = VIEWS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="):
			only = int(a.trim_prefix("--only="))
		if a == "--close":
			list = CLOSE
	var near := 260.0
	for i in list.size():
		if only >= 0 and i != only:
			continue
		_apply_view(list[i])
		if not OS.get_cmdline_user_args().has("--noscatter"):
			scatter.clear()
			await scatter.build_static(cam.global_position, near, Callable(), true)
		for f in frames:
			await get_tree().process_frame
		var img := get_viewport().get_texture().get_image()
		img.save_jpg("%s/view_%d.jpg" % [dir, i], 0.92)
		print("shot ", i)
	get_tree().quit()


## Flies through every viewpoint (10 s each) and reports frame times. The result is
## printed and saved to user://bench.txt so players can send it in.
func _bench() -> void:
	var times := PackedFloat32Array()
	var per_view: Array[String] = []
	for i in VIEWS.size():
		var v: Array = VIEWS[i]
		var a: Vector3 = v[0]
		var b: Vector3 = a.lerp(v[1], 0.35)
		sky.hour = v[2]
		var vt := PackedFloat32Array()
		var t := 0.0
		for f in 30:  # settle (shaders, streaming)
			await get_tree().process_frame
		while t < 10.0:
			var dt := get_process_delta_time()
			t += dt
			var p := a.lerp(b, t / 10.0)
			var g := terrain.data.get_height(p)
			if not is_nan(g):
				p.y = maxf(p.y, g + 1.7)
			cam.global_position = p
			cam.look_at(v[1])
			_yaw = cam.rotation.y
			_pitch = cam.rotation.x
			await get_tree().process_frame
			vt.append(dt * 1000.0)
		times.append_array(vt)
		per_view.append("view %d: avg %.1f fps" % [i, 1000.0 / _avg(vt)])
	var sorted := times.duplicate()
	sorted.sort()
	var low1 := sorted[int(sorted.size() * 0.99)]
	var report := "Jazira beach benchmark\n%s\nGPU: %s\nresolution %s, render scale %.2f, quality %d\naverage %.1f fps (%.2f ms), 1%% low %.1f fps, worst frame %.1f ms\n%s\n" % [
		Time.get_datetime_string_from_system(), RenderingServer.get_video_adapter_name(),
		str(get_viewport().get_visible_rect().size), Settings.render_scale, Settings.quality,
		1000.0 / _avg(times), _avg(times), 1000.0 / low1, sorted[-1], "\n".join(per_view)]
	print(report)
	var f := FileAccess.open("user://bench.txt", FileAccess.WRITE)
	if f:
		f.store_string(report)
	_label.text = report + "\n(saved to %s)" % ProjectSettings.globalize_path("user://bench.txt")
	_label.visible = true


func _avg(a: PackedFloat32Array) -> float:
	var s := 0.0
	for x in a:
		s += x
	return s / maxf(1.0, a.size())


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= e.relative.x * 0.0022
		_pitch = clampf(_pitch - e.relative.y * 0.0022, -1.5, 1.5)
	elif e is InputEventKey and e.pressed:
		match e.keycode:
			KEY_ESCAPE:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
			KEY_BACKSPACE, KEY_F10:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
				get_tree().change_scene_to_file("res://scenes/main.tscn")
			KEY_T:
				sky.hour += 1.0
			KEY_C:
				ocean.sea_state = fmod(ocean.sea_state + 0.5, 3.0)
			_:
				if e.keycode >= KEY_1 and e.keycode <= KEY_9:
					_set_view(e.keycode - KEY_1)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			_speed *= 1.25
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_speed /= 1.25


func _process(delta: float) -> void:
	if cam == null:
		return
	cam.rotation = Vector3(_pitch, _yaw, 0)
	var dir := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): dir -= cam.global_basis.z
	if Input.is_key_pressed(KEY_S): dir += cam.global_basis.z
	if Input.is_key_pressed(KEY_A): dir -= cam.global_basis.x
	if Input.is_key_pressed(KEY_D): dir += cam.global_basis.x
	if Input.is_key_pressed(KEY_E): dir += Vector3.UP
	if Input.is_key_pressed(KEY_Q): dir -= Vector3.UP
	var sp := _speed * (6.0 if Input.is_key_pressed(KEY_SHIFT) else 1.0)
	cam.global_position += dir.normalized() * sp * delta
	if _label:
		_label.text = "%d fps   %.1f h   pos %s   [1-8 views, T time, C sea, wheel speed, Backspace menu]" % [
			Engine.get_frames_per_second(), sky.hour, str(cam.global_position.round())]
