extends Node3D
## Proof scene: procedural Cairo alley + CC0/MIT assets, GTA-style third-person camera, compatibility renderer.
const ALLEY := 6.0
const SIGNS := ["كشري التحرير", "حلاق المعلم", "صيدلية الشفاء", "موبايلات النور", "عصير قصب", "بقالة الأمانة", "ورشة الأسطى سيد", "فول وطعمية", "مكوجي", "جزارة الحاج"]
var mats := {}

func tex_mat(tex: String, tint: Color, scale := 1.0, rough := 0.9) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load("res://tex/%s_1K-JPG_Color.jpg" % tex)
	m.albedo_color = tint
	m.normal_enabled = true
	m.normal_texture = load("res://tex/%s_1K-JPG_NormalGL.jpg" % tex)
	m.uv1_scale = Vector3(scale, scale, scale)
	m.roughness = rough
	return m

func flat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.albedo_color = c; m.roughness = rough; m.metallic = metal; return m

func _init_mats() -> void:
	mats = {
		"brick": tex_mat("Bricks076C", Color(1.0, 0.85, 0.8), 0.5),
		"plaster_ochre": tex_mat("PaintedPlaster017", Color(0.93, 0.78, 0.55), 0.4),
		"plaster_rose": tex_mat("PaintedPlaster017", Color(0.9, 0.7, 0.66), 0.4),
		"plaster_blue": tex_mat("PaintedPlaster017", Color(0.62, 0.75, 0.8), 0.4),
		"plaster_cream": tex_mat("PaintedPlaster017", Color(0.95, 0.9, 0.8), 0.4),
		"plaster_green": tex_mat("PaintedPlaster017", Color(0.7, 0.8, 0.68), 0.4),
		"concrete": tex_mat("Concrete034", Color(0.85, 0.83, 0.8), 0.5),
		"shutter": tex_mat("Concrete034", Color(0.45, 0.5, 0.52), 2.0, 0.5),
		"dark": flat(Color(0.05, 0.05, 0.05)), "glass": flat(Color(0.1, 0.14, 0.17), 0.15, 0.3),
		"wood_green": flat(Color(0.2, 0.36, 0.28)), "wood_brown": flat(Color(0.36, 0.24, 0.15)),
		"metal": flat(Color(0.12, 0.12, 0.12), 0.5, 0.6), "rebar": flat(Color(0.35, 0.2, 0.12), 0.7, 0.5),
		"ac": flat(Color(0.88, 0.88, 0.85), 0.5), "dish": flat(Color(0.92, 0.92, 0.9), 0.4),
		"tank": flat(Color(0.08, 0.08, 0.09), 0.6), "cage": flat(Color(0.3, 0.3, 0.3), 0.6),
		"cloth_a": flat(Color(0.8, 0.15, 0.15)), "cloth_b": flat(Color(0.95, 0.95, 0.9)),
		"cloth_c": flat(Color(0.2, 0.35, 0.7)), "cloth_d": flat(Color(0.85, 0.6, 0.2)),
		"sign_red": flat(Color(0.75, 0.1, 0.08), 0.4), "sign_yellow": flat(Color(0.95, 0.75, 0.1), 0.4),
		"sign_green": flat(Color(0.05, 0.5, 0.25), 0.4), "sign_blue": flat(Color(0.1, 0.3, 0.7), 0.4),
	}
	for m in mats.values():
		m.cull_mode = BaseMaterial3D.CULL_DISABLED

func apply_mats(n: Node) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var src: Material = mi.mesh.surface_get_material(i)
			var nm := src.resource_name if src else ""
			if mats.has(nm): mi.set_surface_override_material(i, mats[nm])

func building(idx: int, z: float, left: bool) -> float:
	var b: Node3D = load("res://b/b%d.glb" % idx).instantiate()
	add_child(b); apply_mats(b)
	var aabb := AABB()
	for mi in b.find_children("*", "MeshInstance3D", true, false): aabb = mi.get_aabb()
	var w := aabb.size.x
	b.rotation.y = PI / 2 if left else -PI / 2
	b.position = Vector3((-1 if left else 1) * (ALLEY / 2 + 5.0), 0, z - w / 2)
	var bays := maxi(1, roundi(w / 3.6))
	for k in bays:
		var l := Label3D.new(); l.font = load("res://fonts/%s" % ["Cairo.ttf", "ReemKufi.ttf", "ArefRuqaa-Bold.ttf"][randi() % 3])
		l.text = SIGNS[randi() % SIGNS.size()]; l.font_size = 64; l.pixel_size = 0.0045
		l.modulate = Color(1, 1, 1) if randf() < 0.7 else Color(0.1, 0.1, 0.1); l.outline_size = 0
		l.shaded = true; l.double_sided = false
		l.position = Vector3(-w / 2 + (k + 0.5) * w / bays, 2.75, 5.19); b.add_child(l)
	return w

func _ready() -> void:
	_init_mats()
	var env := WorldEnvironment.new(); var e := Environment.new()
	var sky := ProceduralSkyMaterial.new()
	sky.sky_top_color = Color(0.35, 0.55, 0.8); sky.sky_horizon_color = Color(0.85, 0.8, 0.7)
	sky.ground_horizon_color = Color(0.7, 0.62, 0.5)
	e.background_mode = Environment.BG_SKY; e.sky = Sky.new(); e.sky.sky_material = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; e.ambient_light_energy = 0.8
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC; e.tonemap_exposure = 1.1
	e.fog_enabled = true; e.fog_light_color = Color(0.85, 0.78, 0.65); e.fog_density = 0.006
	e.glow_enabled = true
	env.environment = e; add_child(env)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-62, 20, 0)
	sun.light_color = Color(1.0, 0.9, 0.75); sun.light_energy = 1.4
	sun.shadow_enabled = true; sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 40.0; add_child(sun)
	# ground
	var g := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(40, 140); g.mesh = pm
	var gm := tex_mat("Concrete034", Color(0.8, 0.7, 0.58), 30.0); g.material_override = gm
	g.position.z = -50; add_child(g)
	# two rows of buildings
	var order := [1, 2, 3, 4, 5, 6, 3, 1, 5, 2, 6, 4]
	for side in [true, false]:
		var z := 6.0
		for k in 6:
			z -= building(order[k + (0 if side else 6)], z, side) + 0.02
	# wires across the alley
	var wm := flat(Color(0.03, 0.03, 0.03))
	for k in 14:
		var w := MeshInstance3D.new(); var c := CylinderMesh.new()
		c.top_radius = 0.012; c.bottom_radius = 0.012; c.height = ALLEY + 3.0; c.radial_segments = 4
		w.mesh = c; w.material_override = wm; w.rotation_degrees = Vector3(randf_range(-6, 6), randf_range(-25, 25), 90)
		w.position = Vector3(0, randf_range(5.0, 9.5), -randf_range(0, 60)); add_child(w)
	# cars (Kenney CC0)
	for c in [["taxi", Vector3(1.6, 0, -14), 0.0], ["van", Vector3(-1.7, 0, -26), PI], ["sedan", Vector3(1.7, 0, -38), 0.1]]:
		var car: Node3D = load("res://cars/%s.glb" % c[0]).instantiate(); add_child(car)
		car.position = c[1]; car.rotation.y = c[2]; car.scale = Vector3.ONE * 0.85
	# tuk-tuk modelled from code (gen_tuktuk.py)
	var tm := {"body_paint": flat(Color(0.08, 0.22, 0.55), 0.35, 0.3), "canvas": flat(Color(0.06, 0.06, 0.06), 0.9),
		"glass": flat(Color(0.2, 0.25, 0.28), 0.1, 0.5), "trim": flat(Color(0.05, 0.05, 0.05), 0.5), "chrome": flat(Color(0.8, 0.8, 0.82), 0.2, 1.0),
		"seat": flat(Color(0.5, 0.06, 0.06), 0.5), "tire": flat(Color(0.04, 0.04, 0.04), 0.9), "plate": flat(Color(0.95, 0.95, 0.95), 0.5),
		"decal": flat(Color(0.95, 0.75, 0.1), 0.4), "light": flat(Color(1, 1, 0.9), 0.2)}
	tm["light"].emission_enabled = true; tm["light"].emission = Color(1, 1, 0.85)
	var tk: Node3D = load("res://tuktuk.glb").instantiate(); add_child(tk)
	for mi in tk.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var sm: Material = mi.mesh.surface_get_material(i)
			if sm and tm.has(sm.resource_name): mi.set_surface_override_material(i, tm[sm.resource_name])
	tk.position = Vector3(-1.5, 0, -8.5); tk.rotation.y = -PI / 2 + 0.25
	# player character (Microsoft Rocketbox, MIT) mid-walk
	var hm: Node3D = load("res://char/castaway/castaway.fbx").instantiate(); add_child(hm)
	hm.position = Vector3(0.3, 0, -3); hm.rotation.y = PI
	var ap: AnimationPlayer = hm.find_children("*", "AnimationPlayer", true, false)[0]
	var a: Animation = load("res://char/m_walk_neutral_01.res")
	if a:
		a = a.duplicate(true)
		for t in a.get_track_count():
			if a.track_get_type(t) == Animation.TYPE_POSITION_3D and str(a.track_get_path(t)).ends_with(":Bip01"):
				for k in a.track_get_key_count(t):
					var v: Vector3 = a.track_get_key_value(t, k); a.track_set_key_value(t, k, Vector3(0, v.y, 0))
		var lib := AnimationLibrary.new(); lib.add_animation("walk", a); ap.add_animation_library("x", lib)
		ap.play("x/walk"); ap.seek(0.35, true)
	_char_mats(hm)
	# GTA-style chase camera: behind and above the character
	var cam := Camera3D.new(); cam.fov = 62; add_child(cam)
	cam.position = hm.position + Vector3(0.0, 2.3, 4.6)
	cam.look_at(hm.position + Vector3(0, 1.5, -2.0))
	if "tuk" in OS.get_cmdline_user_args():
		cam.position = Vector3(1.3, 1.5, -5.0); cam.look_at(Vector3(-1.5, 0.9, -8.5))
	for i in 8: await get_tree().process_frame
	var t0 := Time.get_ticks_usec()
	for i in 30: await get_tree().process_frame
	var ms := (Time.get_ticks_usec() - t0) / 30000.0
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() else "res://shot.png")
	print("frame ms (llvmpipe CPU raster): %.1f  draw calls: %d  prims: %d" % [ms,
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
		RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)])
	get_tree().quit()

func _char_mats(hm: Node3D) -> void:
	var T := "res://char/castaway/"
	for mi in hm.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var src: Material = mi.mesh.surface_get_material(i); var nm: String = src.resource_name if src else ""
			var m := StandardMaterial3D.new()
			if "opacity" in nm:
				m.albedo_texture = load(T + "opacity.png"); m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
				m.cull_mode = BaseMaterial3D.CULL_DISABLED
			else:
				var part := "head" if "head" in nm else "body"
				m.albedo_texture = load(T + part + "_color.jpg"); m.normal_enabled = true
				m.normal_texture = load(T + part + "_normal.png")
			mi.set_surface_override_material(i, m)
