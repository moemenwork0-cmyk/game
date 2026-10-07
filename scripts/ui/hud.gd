class_name Hud
extends CanvasLayer

var _loading: ColorRect
var _load_label: Label
var _load_bar: ProgressBar
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
	_loading = ColorRect.new()
	_loading.color = Color(0.02, 0.04, 0.06)
	_loading.theme = UiKit.theme()
	_loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_loading)
	var vb := VBoxContainer.new()
	vb.set_anchors_preset(Control.PRESET_CENTER)
	vb.grow_horizontal = Control.GROW_DIRECTION_BOTH
	vb.grow_vertical = Control.GROW_DIRECTION_BOTH
	vb.custom_minimum_size = Vector2(420, 0)
	_loading.add_child(vb)
	var title := Label.new()
	title.text = "J A Z I R A"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 44)
	vb.add_child(title)
	_load_label = Label.new()
	_load_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_load_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
	vb.add_child(_load_label)
	_load_bar = _mk_bar(Color(0.4, 0.8, 0.9))
	_load_bar.custom_minimum_size = Vector2(420, 6)
	vb.add_child(_load_bar)


func set_loading(p: float, text: String) -> void:
	_load_bar.value = p
	_load_label.text = text


func hide_loading() -> void:
	var tw := create_tween()
	tw.tween_property(_loading, "modulate:a", 0.0, 1.2)
	tw.tween_callback(_loading.queue_free)


const CONTROLS_TEXT := """WASD move · Shift sprint · Space jump / swim up · Ctrl dive
Mouse wheel or 1–9 select tool · E pick up item
Hand: hold LMB to carry objects (real mass), RMB throw
Axe: fell trees → logs · Pickaxe: boulders, rock, stone blocks
Shovel: LMB dig · RMB place dirt/sand
Beam / Post / Panel / Stone: LMB place · R/Q rotate · F tilt · G snap
   Pieces need support from the ground — overhangs collapse!
Tab: needs, food & crafting · X quick-eat · V third person
Spear: fish in the lagoon, cook them on a campfire (E)
Place (8): B switches campfire / rain collector / bed
Hold T to fast-forward time · F1 hide HUD"""

var _pause_menu: VBoxContainer
var _pause_sub: Control


func _build_pause() -> void:
	_pause = ColorRect.new()
	(_pause as ColorRect).color = Color(0, 0, 0, 0.55)
	_pause.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_pause.visible = false
	_pause.theme = UiKit.theme()
	add_child(_pause)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_pause.add_child(panel)
	_pause_menu = VBoxContainer.new()
	_pause_menu.add_theme_constant_override("separation", 10)
	panel.add_child(_pause_menu)
	_pause_menu.add_child(UiKit.label("Paused", 30))
	_pause_menu.add_child(UiKit.button("Resume", func() -> void: set_paused(false)))
	_pause_menu.add_child(UiKit.button("Save game", func() -> void: SaveGame.save_now()))
	_pause_menu.add_child(UiKit.button("Settings", func() -> void:
		var sp := SettingsPanel.new()
		sp.closed.connect(_close_sub)
		_open_sub(sp)))
	_pause_menu.add_child(UiKit.button("Controls", func() -> void:
		var cp := PanelContainer.new()
		var vb := VBoxContainer.new()
		vb.add_theme_constant_override("separation", 14)
		vb.add_child(UiKit.label("Controls", 30))
		vb.add_child(UiKit.label(CONTROLS_TEXT, 16, Color(1, 1, 1, 0.8)))
		vb.add_child(UiKit.button("Back", _close_sub, 140))
		cp.add_child(vb)
		cp.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
		cp.grow_horizontal = Control.GROW_DIRECTION_BOTH
		cp.grow_vertical = Control.GROW_DIRECTION_BOTH
		_open_sub(cp)))
	_pause_menu.add_child(UiKit.button("Save & main menu", func() -> void:
		SaveGame.save_now()
		Game.restart("")))
	if not OS.has_feature("web"):
		_pause_menu.add_child(UiKit.button("Save & quit", func() -> void:
			SaveGame.save_now()
			get_tree().quit()))


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


func set_underwater(s: float) -> void:
	_uw_rect.visible = s > 0.01
	_uw_mat.set_shader_parameter("strength", s)


func _refresh_inventory() -> void:
	if _play:
		_play.queue_redraw()


func _on_toast(text: String) -> void:
	if _play:
		_play.push_message(text)


