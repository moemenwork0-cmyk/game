class_name Hud
extends CanvasLayer

var _loading: LoadingScreen
var _root: Control
var _cross: Control
var _slots: Array[PanelContainer] = []
var _slot_counts: Array[Label] = []
var _slot_names: Array[Label] = []
var _vbars := {}
var _temp_label: Label
var _status_label: Label
var _fade: ColorRect
var _death: Control
var _survival: SurvivalPanel
var _play: PlayHud
var _inv_label: Label
var _clock: Label
var _stamina: ProgressBar
var _breath: ProgressBar
var _hint: Label
var _toasts: VBoxContainer
var _uw_rect: ColorRect
var _uw_mat: ShaderMaterial
var _pause: Control
var _slot_style: StyleBoxFlat
var _slot_style_sel: StyleBoxFlat


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 5
	_uw_rect = ColorRect.new()
	_uw_mat = ShaderMaterial.new()
	_uw_mat.shader = load("res://shaders/underwater.gdshader")
	_uw_rect.material = _uw_mat
	_uw_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_uw_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_uw_rect.visible = false
	add_child(_uw_rect)

	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.theme = UiKit.theme()
	add_child(_root)

	_play = PlayHud.new()
	_root.add_child(_play)
	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_fade)
	_build_pause()
	_build_loading()
	Game.inventory_changed.connect(_refresh_inventory)
	Game.toast.connect(_on_toast)
	Game.picked.connect(func(id: String, n: int) -> void:
		if _play:
			_play.push_item(id, n))
	_refresh_inventory()


func _mk_bar(c: Color) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(160, 6)
	b.show_percentage = false
	b.max_value = 1.0
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.4)
	bg.set_corner_radius_all(3)
	var fg := StyleBoxFlat.new()
	fg.bg_color = c
	fg.set_corner_radius_all(3)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	return b


func _build_loading() -> void:
	_loading = LoadingScreen.new()
	add_child(_loading)


func set_loading(p: float, text: String) -> void:
	_loading.set_progress(p, text)


func hide_loading() -> void:
	_loading.set_progress(1.0, "")
	var tw := create_tween()
	tw.tween_interval(0.5)
	tw.tween_property(_loading, "modulate:a", 0.0, 1.4)
	tw.tween_callback(_loading.queue_free)


var _pause_menu: VBoxContainer
var _pause_sub: Control


func _build_pause() -> void:
	_pause = ColorRect.new()
	(_pause as ColorRect).color = Color(0.01, 0.015, 0.025, 0.78)
	_pause.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause.visible = false
	_pause.theme = UiKit.theme()
	add_child(_pause)
	var holder := VBoxContainer.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	holder.offset_left = 110
	holder.offset_right = 700
	holder.alignment = BoxContainer.ALIGNMENT_CENTER
	_pause.add_child(holder)
	_pause_menu = VBoxContainer.new()
	_pause_menu.add_theme_constant_override("separation", 6)
	holder.add_child(_pause_menu)
	_build_pause_items()


func _build_pause_items() -> void:
	for c in _pause_menu.get_children():
		c.queue_free()
	_pause_menu.add_child(UiKit.heading(tr("Paused").to_upper(), 48))
	_pause_menu.add_child(UiKit.rule(320))
	var sp := Control.new()
	sp.custom_minimum_size.y = 18
	_pause_menu.add_child(sp)
	_pause_menu.add_child(_pause_item(tr("Resume"), func() -> void: set_paused(false)))
	_pause_menu.add_child(_pause_item(tr("Save game"), func() -> void: SaveGame.save_now()))
	_pause_menu.add_child(_pause_item(tr("Settings"), func() -> void:
		var spn := SettingsPanel.new()
		spn.closed.connect(func() -> void:
			_close_sub()
			_build_pause_items())
		_open_sub(spn)))
	_pause_menu.add_child(_pause_item(tr("Controls"), func() -> void: _open_sub(_controls_panel())))
	_pause_menu.add_child(_pause_item(tr("Save & main menu"), func() -> void:
		SaveGame.save_now()
		Game.restart("")))
	if not OS.has_feature("web"):
		_pause_menu.add_child(_pause_item(tr("Save & quit"), func() -> void:
			SaveGame.save_now()
			get_tree().quit()))


func _pause_item(text: String, cb: Callable) -> Button:
	var b := UiKit.button(text.to_upper(), cb, 420)
	b.add_theme_font_override("font", UiKit.display_font(600))
	b.add_theme_font_size_override("font_size", 26)
	return b


func _controls_panel() -> Control:
	var cp := PanelContainer.new()
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	vb.add_child(UiKit.heading(tr("Controls").to_upper(), 34))
	vb.add_child(UiKit.rule(260))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 26)
	grid.add_theme_constant_override("v_separation", 6)
	vb.add_child(grid)
	var rows: Array = []
	for e in Settings.SCHEMA:
		if e["type"] == "key":
			rows.append([Settings.key_name(e["action"]), tr(e["label"])])
	rows.append_array([[tr("LMB"), tr("Use tool · hold to carry")], [tr("RMB"), tr("Throw · place dirt")], ["1 – 9", tr("Select tool")],
		["R / Q", tr("Rotate piece")], ["F", tr("Tilt piece")], ["G", tr("Grid snap")], ["F1", tr("Hide HUD")]])
	for r in rows:
		var k := UiKit.label(r[0], 17, UiKit.ACCENT)
		k.add_theme_font_override("font", UiKit.font("Bold"))
		grid.add_child(k)
		grid.add_child(UiKit.label(r[1], 17, Color(1, 1, 1, 0.8)))
	var back := UiKit.solid_button(tr("Back"), _close_sub, 160)
	back.size_flags_horizontal = Control.SIZE_SHRINK_END
	vb.add_child(back)
	cp.add_child(vb)
	cp.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	cp.grow_horizontal = Control.GROW_DIRECTION_BOTH
	cp.grow_vertical = Control.GROW_DIRECTION_BOTH
	return cp


func _open_sub(c: Control) -> void:
	_pause_menu.get_parent().visible = false
	_pause_sub = c
	_pause.add_child(c)


func _close_sub() -> void:
	if _pause_sub:
		_pause_sub.queue_free()
		_pause_sub = null
	_pause_menu.get_parent().visible = true


func set_paused(p: bool) -> void:
	if p and not Game.playing:
		return
	get_tree().paused = p
	_pause.visible = p
	if not p:
		_close_sub()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if p else Input.MOUSE_MODE_CAPTURED


func set_gameplay_visible(v: bool) -> void:
	_root.visible = v


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and _survival:
		toggle_survival_panel()
		return
	if event.is_action_pressed("pause") and _death:
		return
	if event.is_action_pressed("pause"):
		if _pause_sub:
			_close_sub()
		else:
			set_paused(not get_tree().paused)
	elif event.is_action_pressed("toggle_hud") and Game.playing:
		_root.visible = not _root.visible


func set_slot(_i: int) -> void:
	if _play:
		_play.slot_changed()


func toggle_survival_panel() -> void:
	if _survival:
		_survival.queue_free()
		_survival = null
		Game.ui_open = false
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	else:
		_survival = SurvivalPanel.new()
		add_child(_survival)
		Game.ui_open = true
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func fade(alpha: float, time: float) -> void:
	var tw := create_tween()
	tw.tween_property(_fade, "color:a", alpha, time)
	await tw.finished


func show_death() -> void:
	if _survival:
		toggle_survival_panel()
	Game.ui_open = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_death = ColorRect.new()
	(_death as ColorRect).color = Color(0.15, 0.0, 0.0, 0.0)
	_death.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_death.theme = UiKit.theme()
	add_child(_death)
	var vb := VBoxContainer.new()
	vb.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	vb.grow_horizontal = Control.GROW_DIRECTION_BOTH
	vb.grow_vertical = Control.GROW_DIRECTION_BOTH
	vb.add_theme_constant_override("separation", 14)
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	_death.add_child(vb)
	var t := UiKit.label("You did not survive", 40, Color(1, 0.9, 0.85))
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(t)
	var cause := "Keep fed, drink fresh water, stay warm and dry."
	var sub := UiKit.label(cause + "\nYou will wake up at your bed (or the beach) and lose half of what you carried.", 15, Color(1, 1, 1, 0.6))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(sub)
	var btn := UiKit.button("Wake up", func() -> void:
		Game.player.respawn()
		_death.queue_free()
		_death = null
		Game.ui_open = false
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	vb.add_child(btn)
	_death.create_tween().tween_property(_death, "color:a", 0.75, 1.5)


signal _chosen(i: int)


## Modal choice for story moments. Returns the chosen index (await it).
func choose(text: String, options: Array) -> int:
	if _survival:
		toggle_survival_panel()
	Game.ui_open = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var bg := ColorRect.new()
	bg.color = Color(0, 0, 0, 0.0)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.theme = UiKit.theme()
	add_child(bg)
	bg.create_tween().tween_property(bg, "color:a", 0.6, 0.6)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.custom_minimum_size = Vector2(640, 0)
	bg.add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	panel.add_child(vb)
	var l := UiKit.label(text, 21, Color(1, 0.95, 0.88))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(600, 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(l)
	for i in options.size():
		var idx := i
		var b := UiKit.button(String(options[i]), func() -> void: _chosen.emit(idx), 600)
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		vb.add_child(b)
	var pick: int = await _chosen
	bg.queue_free()
	Game.ui_open = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	return pick


## End-of-act card: fades to black, shows what this playthrough was, then lets you keep playing.
func show_act_end(title: String, sub: String, summary: String) -> void:
	Game.ui_open = true
	await fade(1.0, 2.5)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.theme = UiKit.theme()
	add_child(root)
	var vb := VBoxContainer.new()
	vb.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	vb.grow_horizontal = Control.GROW_DIRECTION_BOTH
	vb.grow_vertical = Control.GROW_DIRECTION_BOTH
	vb.add_theme_constant_override("separation", 18)
	root.add_child(vb)
	var t := UiKit.label(title, 52, UiKit.ACCENT)
	t.add_theme_font_override("font", UiKit.font("Bold"))
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(t)
	var s := UiKit.label(sub, 20, Color(1, 1, 1, 0.75))
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(s)
	var sm := UiKit.label(summary, 18, Color(1, 1, 1, 0.6))
	sm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(sm)
	var cont := UiKit.button(StoryData.t({"en": "Keep surviving", "ar": "واصل النجاة"}), func() -> void: _chosen.emit(0))
	cont.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	vb.add_child(cont)
	root.modulate.a = 0.0
	root.create_tween().tween_property(root, "modulate:a", 1.0, 1.5)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await _chosen
	root.queue_free()
	Game.ui_open = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	fade(0.0, 2.0)


func ping_objective() -> void:
	if _play:
		_play.ping_objective()


func set_underwater(s: float) -> void:
	_uw_rect.visible = s > 0.01
	_uw_mat.set_shader_parameter("strength", s)


func _refresh_inventory() -> void:
	if _play:
		_play.queue_redraw()


func _on_toast(text: String) -> void:
	if _play:
		_play.push_message(text)


