extends Node3D
## Main menu: a lit 3D set with the operator holding the equipped weapon, slow camera drift,
## dust in the light shafts; UI screens for campaign (mission cards with live map previews and
## stars), briefing, loadout (weapon stats, live swap on the model), settings and quick op.

const K = preload("res://scripts/ui_kit.gd")

var cam: Camera3D
var soldier: Soldier
var ui: Control
var screens := {}
var current := ""
var _t := 0.0
var _brief_index := -1


func _ready() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	_build_set()
	_build_ui()
	show_screen("main")
	Sfx.music("menu_music", -12.0)
	Sfx.ambience.stop()
	var dev := OS.get_cmdline_user_args()
	if dev.size() > 0 and ResourceLoader.exists("res://tools/dev_bot.gd"):
		var bot: Node = load("res://tools/dev_bot.gd").new()
		bot.set("menu", self)
		add_child(bot)


# ------------------------------------------------------------------ 3D set

func _build_set() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	we.environment = env
	add_child(we)
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.01, 0.012, 0.016)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.3, 0.34, 0.42)
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.2
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 0.85
	if Game.quality >= 2:
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = 0.01
		env.ssao_enabled = true
	# floor + back wall
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(30, 30)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_texture = load("res://assets/textures/concrete_floor_worn_001/diff.jpg")
	fm.normal_enabled = true
	fm.normal_texture = load("res://assets/textures/concrete_floor_worn_001/nor.jpg")
	fm.uv1_scale = Vector3(8, 8, 8)
	fm.albedo_color = Color(0.55, 0.55, 0.55)
	fm.roughness = 0.75
	floor.material_override = fm
	add_child(floor)
	var wall := MeshInstance3D.new()
	var wm := BoxMesh.new()
	wm.size = Vector3(30, 8, 0.4)
	wall.mesh = wm
	var wmat := StandardMaterial3D.new()
	wmat.albedo_texture = load("res://assets/textures/concrete_wall_008/diff.jpg")
	wmat.normal_enabled = true
	wmat.normal_texture = load("res://assets/textures/concrete_wall_008/nor.jpg")
	wmat.uv1_scale = Vector3(6, 2, 1)
	wmat.albedo_color = Color(0.32, 0.34, 0.33)
	wall.material_override = wmat
	wall.position = Vector3(0, 4, -3.2)
	add_child(wall)
	# props around the operator
	var lv := Level.new()
	add_child(lv)
	lv.prop("wooden_military_crate", Vector3(1.6, 0, -1.9), 12, {})
	lv.prop("wooden_military_crate", Vector3(1.55, 0.465, -1.95), 8, {})
	lv.prop("wooden_crate_01", Vector3(2.5, 0, -1.2), -20, {})
	lv.prop("Barrel_01", Vector3(-1.9, 0, -2.2), 0, {})
	lv.prop("Barrel_01", Vector3(-1.35, 0, -2.6), 50, {})
	lv.prop("steel_frame_shelves_01", Vector3(-3.4, 0, -2.75), 0, {"scale": 0.1})
	lv.prop("ammo_box", Vector3(1.4, 0.93, -1.9), 70, {"scale": 1.6})
	# the operator
	soldier = Soldier.new()
	soldier.avatar_dir = "res://assets/characters/player/"
	soldier.uniform_tint = Color(0.74, 0.84, 0.66)
	soldier.weapon_id = Game.weapon
	soldier.aim_yaw = PI - 0.45
	soldier.body_yaw = PI - 0.45
	soldier.aim_up = 0.15
	add_child(soldier)
	soldier.global_position = Vector3(0.3, 0, -0.6)
	soldier.set_physics_process(false)
	soldier.rifle.light.visible = false
	# lights: warm key, cold rim, light shafts, red beacon
	var key := SpotLight3D.new()
	key.position = Vector3(-2.8, 3.6, 3.0)
	key.look_at_from_position(key.position, Vector3(0.3, 1.0, -0.6))
	key.light_color = Color(1.0, 0.78, 0.55)
	key.light_energy = 18.0
	key.spot_range = 10.0
	key.spot_angle = 26.0
	key.shadow_enabled = true
	add_child(key)
	var rim := SpotLight3D.new()
	rim.position = Vector3(2.5, 3.2, -2.6)
	rim.look_at_from_position(rim.position, Vector3(0.3, 1.2, -0.6))
	rim.light_color = Color(0.45, 0.65, 1.0)
	rim.light_energy = 22.0
	rim.spot_range = 8.0
	rim.spot_angle = 30.0
	add_child(rim)
	var top := SpotLight3D.new()
	top.position = Vector3(0.3, 6.0, -0.6)
	top.rotation.x = -PI / 2
	top.light_color = Color(0.9, 0.95, 1.0)
	top.light_energy = 6.0
	top.spot_angle = 18.0
	top.spot_range = 9.0
	top.light_volumetric_fog_energy = 1.2
	add_child(top)
	var beacon := OmniLight3D.new()
	beacon.position = Vector3(-3.0, 2.4, -2.6)
	beacon.light_color = Color(1.0, 0.15, 0.08)
	beacon.light_energy = 2.0
	beacon.omni_range = 5.0
	beacon.name = "Beacon"
	add_child(beacon)
	_shaft(Vector3(0.3, 3.0, -0.6), 0.35, 1.3, 6.0)
	_dust()
	cam = Camera3D.new()
	cam.fov = 38.0
	add_child(cam)
	cam.current = true


func _shaft(at: Vector3, r0: float, r1: float, h: float) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r0
	cm.bottom_radius = r1
	cm.height = h
	cm.cap_top = false
	cm.cap_bottom = false
	cm.radial_segments = 24
	mi.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.albedo_color = Color(0.7, 0.8, 1.0, 0.028)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = at
	add_child(mi)


func _dust() -> void:
	var p := GPUParticles3D.new()
	p.amount = 90
	p.lifetime = 9.0
	p.preprocess = 9.0
	p.visibility_aabb = AABB(Vector3(-5, 0, -4), Vector3(10, 6, 8))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(3.5, 2.5, 2.0)
	pm.gravity = Vector3(0, -0.02, 0)
	pm.initial_velocity_min = 0.02
	pm.initial_velocity_max = 0.08
	pm.direction = Vector3(1, 0.2, 0)
	pm.spread = 180.0
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 0.3
	pm.scale_min = 0.4
	pm.scale_max = 1.0
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.025, 0.025)
	p.draw_pass_1 = q
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_texture = Fx.soft_texture()
	m.albedo_color = Color(1.0, 0.9, 0.75, 0.7)
	p.material_override = m
	p.position = Vector3(0, 2.5, -0.5)
	add_child(p)


func _process(delta: float) -> void:
	_t += delta
	var drift := sin(_t * 0.15) * 0.25
	var focus := Vector3(-0.55, 1.15, -0.6)
	var dist := 4.4 if current == "main" else 3.9
	var yaw := 0.28 + drift * 0.3
	if current == "loadout":
		yaw = 0.2 + drift * 0.15
		focus = Vector3(0.3, 1.1, -0.6)
	var want := focus + Vector3(sin(yaw) * dist, 0.35 + sin(_t * 0.2) * 0.08, cos(yaw) * dist)
	cam.global_position = cam.global_position.lerp(want, 1.0 - exp(-2.5 * delta)) if cam.global_position.length() > 0.1 else want
	cam.look_at(focus, Vector3.UP)
	var b := get_node_or_null("Beacon") as OmniLight3D
	if b:
		b.light_energy = 0.4 + 2.4 * pow(maxf(sin(_t * 3.5), 0.0), 3.0)
	soldier.aim_yaw = PI - 0.45 + sin(_t * 0.4) * 0.12


# ------------------------------------------------------------------ UI scaffolding

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	ui = Control.new()
	ui.theme = K.theme()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(ui)
	var shade := ColorRect.new()
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = load("res://scripts/menu_shade.gdshader")
	shade.material = sm
	ui.add_child(shade)
	screens["main"] = _main_screen()
	screens["campaign"] = _campaign_screen()
	screens["loadout"] = _loadout_screen()
	screens["settings"] = _settings_screen()
	for k in screens:
		ui.add_child(screens[k])
		screens[k].visible = false
	var fade := ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(fade)
	create_tween().tween_property(fade, "color:a", 0.0, 1.0)


func show_screen(name: String) -> void:
	if name == current:
		return
	if current != "" and screens.has(current):
		var old: Control = screens[current]
		var t := create_tween()
		t.tween_property(old, "modulate:a", 0.0, 0.15)
		t.tween_callback(func() -> void: old.visible = false)
	current = name
	var s: Control = screens[name]
	if name == "campaign":
		_refresh_campaign()
	if name == "main":
		_refresh_main()
	s.visible = true
	s.modulate.a = 0.0
	s.position.x = -40
	var t2 := create_tween().set_parallel()
	t2.tween_property(s, "modulate:a", 1.0, 0.3).set_delay(0.12)
	t2.tween_property(s, "position:x", 0.0, 0.35).set_delay(0.12).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _page(title: String, backdrop := 0.0) -> Control:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	if backdrop > 0.0:
		var bd := ColorRect.new()
		bd.color = Color(0.01, 0.014, 0.014, backdrop)
		bd.set_anchors_preset(Control.PRESET_FULL_RECT)
		bd.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(bd)
	var back := K.icon_button("return-arrow", 60)
	back.position = Vector2(36, 30)
	back.pressed.connect(func() -> void: show_screen("main"))
	root.add_child(back)
	var t := K.label(title, 52, K.INK, "wide")
	t.position = Vector2(112, 26)
	root.add_child(t)
	var bar := ColorRect.new()
	bar.color = K.AMBER
	bar.position = Vector2(114, 92)
	bar.size = Vector2(90, 4)
	root.add_child(bar)
	return root


# ------------------------------------------------------------------ main

var _main_btns := {}
var _rank_lbl: Label
var _rank_bar: ProgressBar
var _stars_lbl: Label


func _main_screen() -> Control:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	var col := VBoxContainer.new()
	col.position = Vector2(70, 60)
	col.add_theme_constant_override("separation", 0)
	root.add_child(col)
	var kick := K.label("TACTICAL  OPERATIONS", 22, K.AMBER, "wide")
	col.add_child(kick)
	var title := HBoxContainer.new()
	title.add_theme_constant_override("separation", 18)
	title.add_child(K.label("ROOM", 104, K.INK, "bold"))
	title.add_child(K.label("CLEAR", 104, K.AMBER, "bold"))
	col.add_child(title)
	var tag := K.label("ONE BUILDING.  ONE OBJECTIVE.  NO SECOND CHANCES.", 17, K.DIM, "mid")
	col.add_child(tag)
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 22)
	col.add_child(gap)
	var btns := VBoxContainer.new()
	btns.add_theme_constant_override("separation", 12)
	col.add_child(btns)
	var play := K.menu_button("CAMPAIGN", "", "targeted", true)
	play.pressed.connect(func() -> void: show_screen("campaign"))
	btns.add_child(play)
	var quick := K.menu_button("QUICK OP", "random building · random objective", "radar-sweep")
	quick.pressed.connect(func() -> void: _deploy(-1))
	btns.add_child(quick)
	var load := K.menu_button("LOADOUT", "", "reticule")
	load.pressed.connect(func() -> void: show_screen("loadout"))
	btns.add_child(load)
	var sett := K.menu_button("SETTINGS", "graphics · aim assist · sound", "cog")
	sett.pressed.connect(func() -> void: show_screen("settings"))
	btns.add_child(sett)
	_main_btns = {"play": play, "load": load}
	# rank card bottom-left
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", K.plate(Color(0.04, 0.05, 0.05, 0.8), Color(K.AMBER, 0.3), 4))
	root.add_child(card)
	card.anchor_left = 1.0
	card.anchor_right = 1.0
	card.offset_left = -400
	card.offset_right = -40
	card.offset_top = 40
	card.offset_bottom = 124
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 16)
	card.add_child(hb)
	var ic := TextureRect.new()
	ic.texture = K.icon("eagle-emblem")
	ic.custom_minimum_size = Vector2(54, 54)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = K.AMBER
	hb.add_child(ic)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 2)
	hb.add_child(vb)
	_rank_lbl = K.label("", 24, K.INK, "wide")
	vb.add_child(_rank_lbl)
	_rank_bar = ProgressBar.new()
	_rank_bar.custom_minimum_size = Vector2(240, 8)
	_rank_bar.show_percentage = false
	var bgsb := StyleBoxFlat.new()
	bgsb.bg_color = Color(1, 1, 1, 0.1)
	var fgsb := StyleBoxFlat.new()
	fgsb.bg_color = K.CYAN
	_rank_bar.add_theme_stylebox_override("background", bgsb)
	_rank_bar.add_theme_stylebox_override("fill", fgsb)
	_rank_bar.max_value = 1.0
	vb.add_child(_rank_bar)
	_stars_lbl = K.label("", 16, K.DIM, "mid")
	vb.add_child(_stars_lbl)
	var ver := K.label("v4.0  ·  third person", 13, Color(K.DIM, 0.5), "mid")
	ver.anchor_left = 1.0
	ver.anchor_right = 1.0
	ver.anchor_top = 1.0
	ver.anchor_bottom = 1.0
	ver.offset_left = -260
	ver.offset_top = -40
	ver.offset_right = -30
	ver.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(ver)
	return root


func _refresh_main() -> void:
	var nxt := 0
	for i in Game.MISSIONS.size():
		if Game.unlocked(i):
			nxt = i
	_set_sub(_main_btns["play"], "MISSION %02d  ·  %s" % [nxt + 1, Game.MISSIONS[nxt]["name"]])
	_set_sub(_main_btns["load"], Weapons.get_def(Game.weapon)["name"])
	_rank_lbl.text = Game.rank_name()
	_rank_bar.value = Game.rank_progress()
	_stars_lbl.text = "★ %d / %d     MISSIONS %d / %d" % [Game.total_stars(), Game.MISSIONS.size() * 3, Game.completed_count(), Game.MISSIONS.size()]


func _set_sub(b: Button, text: String) -> void:
	var labels := b.find_children("*", "Label", true, false)
	if labels.size() > 1:
		(labels[1] as Label).text = text


# ------------------------------------------------------------------ campaign

var _cards: HBoxContainer
var _brief: Control


func _campaign_screen() -> Control:
	var root := _page("CAMPAIGN", 0.72)
	var sc := ScrollContainer.new()
	sc.anchor_right = 1.0
	sc.anchor_bottom = 1.0
	sc.offset_left = 60
	sc.offset_top = 130
	sc.offset_right = -60
	sc.offset_bottom = -40
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(sc)
	_cards = HBoxContainer.new()
	_cards.add_theme_constant_override("separation", 22)
	sc.add_child(_cards)
	_brief = Control.new()
	_brief.set_anchors_preset(Control.PRESET_FULL_RECT)
	_brief.visible = false
	root.add_child(_brief)
	return root


func _refresh_campaign() -> void:
	for c in _cards.get_children():
		c.queue_free()
	for i in Game.MISSIONS.size():
		_cards.add_child(_mission_card(i))


func _mission_card(i: int) -> Control:
	var m: Dictionary = Game.MISSIONS[i]
	var locked := not Game.unlocked(i)
	var b := Button.new()
	b.custom_minimum_size = Vector2(270, 440)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_stylebox_override("normal", K.plate(Color(0.04, 0.05, 0.05, 0.96), Color(K.AMBER, 0.25), 0, 6, 0.0))
	b.add_theme_stylebox_override("hover", K.plate(Color(0.07, 0.08, 0.08, 0.95), Color(K.AMBER, 0.9), 0, 6, 0.0))
	b.add_theme_stylebox_override("pressed", K.plate(Color(0.1, 0.1, 0.1, 0.95), K.AMBER, 0, 6, 0.0))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var vb := VBoxContainer.new()
	vb.set_anchors_preset(Control.PRESET_FULL_RECT)
	vb.offset_left = 14
	vb.offset_right = -14
	vb.offset_top = 14
	vb.offset_bottom = -14
	vb.add_theme_constant_override("separation", 8)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(vb)
	var mp := MapPreview.new()
	mp.custom_minimum_size = Vector2(240, 170)
	mp.map = MapGen.generate(m["seed"], m["rooms"], true)
	mp.objective_icon = Game.TYPE_INFO[m["type"]]["icon"]
	mp.dim = locked
	mp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(mp)
	var num := K.label("MISSION %02d" % (i + 1), 15, K.AMBER, "wide")
	num.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(num)
	var nm := K.label(m["name"], 28, K.INK if not locked else K.DIM)
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD
	nm.custom_minimum_size = Vector2(240, 0)
	nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(nm)
	var tr := HBoxContainer.new()
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.add_theme_constant_override("separation", 8)
	var ti := TextureRect.new()
	ti.texture = K.icon(Game.TYPE_INFO[m["type"]]["icon"])
	ti.custom_minimum_size = Vector2(26, 26)
	ti.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ti.modulate = K.AMBER
	ti.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.add_child(ti)
	var tl := K.label(Game.TYPE_INFO[m["type"]]["title"], 15, K.DIM, "mid")
	tl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tr.add_child(tl)
	vb.add_child(tr)
	var info := K.label("%d ROOMS   ·   %d HOSTILES" % [m["rooms"], m["enemies"] + (1 if m["type"] in ["eliminate", "runner"] else 0)], 14, Color(K.DIM, 0.8), "mid")
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(info)
	var stars := Control.new()
	stars.custom_minimum_size = Vector2(240, 36)
	stars.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var got: int = Game.stars.get(i, 0)
	stars.draw.connect(func() -> void:
		for k in 3:
			K.star(stars, Vector2(20 + k * 38, 18), 15, k < got, K.AMBER if k < got else Color(1, 1, 1, 0.22))
		if locked:
			K.draw_icon(stars, "padlock", Vector2(220, 18), 30, K.DIM))
	vb.add_child(stars)
	b.disabled = locked
	b.pressed.connect(func() -> void: _open_brief(i))
	b.mouse_entered.connect(func() -> void: Sfx.play("ui_hover", -14.0))
	return b


func _open_brief(i: int) -> void:
	Sfx.play("ui_click", -4.0)
	_brief_index = i
	for c in _brief.get_children():
		c.queue_free()
	var m: Dictionary = Game.MISSIONS[i]
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.015, 0.015, 0.88)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed:
			_brief.visible = false)
	_brief.add_child(bg)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", K.plate(Color(0.035, 0.045, 0.045, 0.97), Color(K.AMBER, 0.5), 6, 6, 0.0))
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.custom_minimum_size = Vector2(1040, 520)
	_brief.add_child(panel)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 28)
	panel.add_child(hb)
	var mp := MapPreview.new()
	mp.custom_minimum_size = Vector2(520, 480)
	mp.map = MapGen.generate(m["seed"], m["rooms"], true)
	mp.objective_icon = Game.TYPE_INFO[m["type"]]["icon"]
	hb.add_child(mp)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	vb.custom_minimum_size = Vector2(440, 0)
	hb.add_child(vb)
	vb.add_child(K.label("MISSION %02d  ·  BRIEFING" % (i + 1), 16, K.AMBER, "wide"))
	vb.add_child(K.label(m["name"], 48, K.INK))
	var tr := HBoxContainer.new()
	tr.add_theme_constant_override("separation", 10)
	var ti := TextureRect.new()
	ti.texture = K.icon(Game.TYPE_INFO[m["type"]]["icon"])
	ti.custom_minimum_size = Vector2(34, 34)
	ti.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ti.modulate = K.AMBER
	tr.add_child(ti)
	tr.add_child(K.label(Game.TYPE_INFO[m["type"]]["title"], 24, K.AMBER))
	vb.add_child(tr)
	var brief := K.label(m["brief"], 19, K.DIM, "mid")
	brief.autowrap_mode = TextServer.AUTOWRAP_WORD
	brief.custom_minimum_size = Vector2(420, 0)
	vb.add_child(brief)
	var facts := "HOSTILES  %d" % (m["enemies"] + (1 if m["type"] in ["eliminate", "runner"] else 0))
	if m.get("heavy", 0) > 0:
		facts += "   (incl. %d ARMOURED)" % m["heavy"]
	facts += "\nBUILDING  %d ROOMS" % m["rooms"]
	if m["type"] == "defuse" and m.has("time"):
		facts += "\nTIME LIMIT  %d:%02d" % [int(m["time"]) / 60, int(m["time"]) % 60]
	match m["type"]:
		"sabotage":
			facts += "\nCHARGE FUSE  %d s" % int(m.get("fuse", 45))
		"defend":
			facts += "\nHOLD FOR  %d s" % int(m.get("hold", 60))
		"stealth":
			facts += "\nALARM BRINGS  3 REINFORCEMENTS"
		"rescue":
			facts += "\nHOSTAGES  %d" % int(m.get("hostages", 1))
		"docs":
			facts += "\nDOCUMENTS  %d" % int(m.get("docs", 3))
	vb.add_child(K.label(facts, 17, K.INK, "mid"))
	var wp := HBoxContainer.new()
	wp.add_theme_constant_override("separation", 12)
	var wi := TextureRect.new()
	wi.texture = K.icon(Weapons.get_def(Game.weapon)["icon"])
	wi.custom_minimum_size = Vector2(90, 46)
	wi.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	wi.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	wp.add_child(wi)
	wp.add_child(K.label("LOADOUT:  " + Weapons.get_def(Game.weapon)["name"] + "   + 2 GRENADES", 16, K.INK, "mid"))
	vb.add_child(wp)
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(sp)
	var go := K.menu_button("DEPLOY", "good luck, operator", "play-button", true)
	go.pressed.connect(func() -> void: _deploy(i))
	vb.add_child(go)
	_brief.visible = true
	panel.modulate.a = 0.0
	panel.scale = Vector2(0.96, 0.96)
	create_tween().tween_property(panel, "modulate:a", 1.0, 0.25)


func _deploy(i: int) -> void:
	Sfx.play("stinger", -6.0)
	var f := ColorRect.new()
	f.color = Color(0, 0, 0, 0)
	f.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.add_child(f)
	var t := create_tween()
	t.tween_property(f, "color:a", 1.0, 0.45)
	t.tween_callback(func() -> void: Game.start_mission(i))


# ------------------------------------------------------------------ loadout

var _sel_weapon := ""
var _load_detail: VBoxContainer
var _load_list: VBoxContainer


func _loadout_screen() -> Control:
	var root := _page("LOADOUT")
	_load_list = VBoxContainer.new()
	_load_list.position = Vector2(70, 140)
	_load_list.add_theme_constant_override("separation", 12)
	root.add_child(_load_list)
	_load_detail = VBoxContainer.new()
	_load_detail.anchor_left = 1.0
	_load_detail.anchor_right = 1.0
	_load_detail.offset_left = -470
	_load_detail.offset_right = -50
	_load_detail.offset_top = 140
	_load_detail.add_theme_constant_override("separation", 10)
	root.add_child(_load_detail)
	_sel_weapon = Game.weapon
	_refresh_loadout()
	return root


func _refresh_loadout() -> void:
	for c in _load_list.get_children():
		c.queue_free()
	for id in Weapons.ORDER:
		var d := Weapons.get_def(id)
		var ok := Game.weapon_unlocked(id)
		var sub := "EQUIPPED" if id == Game.weapon else ("" if ok else "UNLOCK: COMPLETE MISSION %02d" % int(d["unlock"]))
		var b := K.menu_button(d["name"], sub, d["icon"], id == _sel_weapon)
		b.custom_minimum_size = Vector2(420, 78)
		b.pressed.connect(func() -> void:
			_sel_weapon = id
			_refresh_loadout())
		if not ok:
			b.modulate = Color(1, 1, 1, 0.5)
		_load_list.add_child(b)
	for c in _load_detail.get_children():
		c.queue_free()
	var d := Weapons.get_def(_sel_weapon)
	var big := TextureRect.new()
	big.texture = K.icon(d["icon"])
	big.custom_minimum_size = Vector2(420, 130)
	big.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	big.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	big.modulate = K.INK
	_load_detail.add_child(big)
	_load_detail.add_child(K.label(d["name"], 46, K.INK))
	var desc := K.label(d["desc"], 18, K.DIM, "mid")
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	desc.custom_minimum_size = Vector2(420, 0)
	_load_detail.add_child(desc)
	var st := Weapons.stats(_sel_weapon)
	for k in st:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		var l := K.label(k, 15, K.DIM, "mid")
		l.custom_minimum_size = Vector2(110, 0)
		row.add_child(l)
		var bar := Control.new()
		bar.custom_minimum_size = Vector2(290, 18)
		var v: float = st[k]
		var shown := [0.0]
		bar.draw.connect(func() -> void:
			for s in 10:
				var on: bool = float(s) / 10.0 < shown[0]
				K.para(bar, Rect2(Vector2(s * 29, 2), Vector2(25, 14)), -0.3, K.AMBER if on else Color(1, 1, 1, 0.1)))
		var tw := bar.create_tween()
		tw.tween_method(func(x: float) -> void:
			shown[0] = x
			bar.queue_redraw(), 0.0, v, 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		row.add_child(bar)
		_load_detail.add_child(row)
	var ok := Game.weapon_unlocked(_sel_weapon)
	var eq := K.menu_button("EQUIP" if ok else "LOCKED", "" if ok else "complete mission %02d first" % int(d["unlock"]), "check-mark" if ok else "padlock", ok)
	eq.disabled = not ok or _sel_weapon == Game.weapon
	eq.pressed.connect(func() -> void:
		Game.weapon = _sel_weapon
		Game.save()
		soldier.set_weapon(_sel_weapon)
		soldier.rifle.light.visible = false
		Sfx.play("bolt", -2.0)
		_refresh_loadout())
	_load_detail.add_child(eq)
	if ok and _sel_weapon != soldier.weapon_id:
		soldier.set_weapon(_sel_weapon)
		soldier.rifle.light.visible = false


# ------------------------------------------------------------------ settings

func _settings_screen() -> Control:
	var root := _page("SETTINGS", 0.55)
	var vb := VBoxContainer.new()
	vb.position = Vector2(70, 150)
	vb.add_theme_constant_override("separation", 16)
	root.add_child(vb)
	vb.add_child(_segment("GRAPHICS", ["LOW", "MEDIUM", "HIGH"], Game.quality, func(i: int) -> void:
		Game.quality = i
		Game.apply_settings()
		Game.save()))
	vb.add_child(_segment("AIM ASSIST", ["OFF", "ON"], 1 if Game.aim_assist else 0, func(i: int) -> void:
		Game.aim_assist = i == 1
		Game.save()))
	vb.add_child(_segment("FPS COUNTER", ["OFF", "ON"], 1 if Game.show_fps else 0, func(i: int) -> void:
		Game.show_fps = i == 1
		Game.save()))
	var vrow := HBoxContainer.new()
	vrow.add_theme_constant_override("separation", 20)
	var vl := K.label("VOLUME", 22, K.INK, "wide")
	vl.custom_minimum_size = Vector2(220, 0)
	vrow.add_child(vl)
	var sl := HSlider.new()
	sl.custom_minimum_size = Vector2(380, 40)
	sl.min_value = 0.0
	sl.max_value = 1.0
	sl.step = 0.05
	sl.value = Game.volume
	sl.value_changed.connect(func(v: float) -> void:
		Game.volume = v
		Game.apply_settings()
		Game.save())
	vrow.add_child(sl)
	vb.add_child(vrow)
	var note := K.label("LOW is recommended for phones and older laptops.", 15, K.DIM, "mid")
	vb.add_child(note)
	return root


func _segment(title: String, opts: Array, sel: int, cb: Callable) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var l := K.label(title, 22, K.INK, "wide")
	l.custom_minimum_size = Vector2(220, 0)
	row.add_child(l)
	var buttons: Array[Button] = []
	for i in opts.size():
		var b := Button.new()
		b.text = opts[i]
		b.custom_minimum_size = Vector2(130, 52)
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 20)
		buttons.append(b)
		row.add_child(b)
	var paint := func(s: int) -> void:
		for i in buttons.size():
			var on := i == s
			buttons[i].add_theme_stylebox_override("normal", K.plate(K.AMBER_D if on else Color(0.05, 0.06, 0.06, 0.85), Color(K.AMBER, 0.8 if on else 0.2), 0))
			buttons[i].add_theme_stylebox_override("hover", K.plate(K.AMBER if on else Color(0.1, 0.11, 0.11, 0.9), K.AMBER, 0))
			buttons[i].add_theme_stylebox_override("pressed", K.plate(K.AMBER, K.AMBER, 0))
			buttons[i].add_theme_color_override("font_color", Color(0.07, 0.06, 0.03) if on else K.INK)
			buttons[i].add_theme_color_override("font_hover_color", Color(0.07, 0.06, 0.03) if on else K.AMBER)
	paint.call(sel)
	for i in buttons.size():
		buttons[i].pressed.connect(func() -> void:
			Sfx.play("ui_click", -6.0)
			paint.call(i)
			cb.call(i))
	return row
