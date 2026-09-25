class_name Hud
extends CanvasLayer

var _loading: ColorRect
var _load_label: Label
var _load_bar: ProgressBar
var _root: Control
var _cross: Control
var _slots: Array[PanelContainer] = []
var _slot_counts: Array[Label] = []
var _inv_label: Label
var _clock: Label
var _stamina: ProgressBar
var _breath: ProgressBar
var _hint: Label
var _toasts: VBoxContainer
var _uw_rect: ColorRect
var _uw_mat: ShaderMaterial
var _pause: Control
var _quality_btn: Button
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
	add_child(_root)

	_cross = Control.new()
	_cross.set_anchors_preset(Control.PRESET_CENTER)
	_cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cross.draw.connect(func() -> void:
		_cross.draw_circle(Vector2.ZERO, 2.5, Color(1, 1, 1, 0.85))
		_cross.draw_arc(Vector2.ZERO, 7.0, 0, TAU, 24, Color(1, 1, 1, 0.25), 1.0, true))
	_root.add_child(_cross)

	_slot_style = StyleBoxFlat.new()
	_slot_style.bg_color = Color(0.05, 0.07, 0.08, 0.55)
	_slot_style.set_corner_radius_all(8)
	_slot_style.set_border_width_all(2)
	_slot_style.border_color = Color(1, 1, 1, 0.12)
	_slot_style.set_content_margin_all(6)
	_slot_style_sel = _slot_style.duplicate()
	_slot_style_sel.border_color = Color(1.0, 0.85, 0.45, 0.95)
	_slot_style_sel.bg_color = Color(0.12, 0.1, 0.05, 0.7)

	var bar := HBoxContainer.new()
	bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	bar.add_theme_constant_override("separation", 6)
	bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.position.y = -18
	_root.add_child(bar)
	for i in Player.SLOTS.size():
		var pc := PanelContainer.new()
		pc.custom_minimum_size = Vector2(92, 58)
		pc.add_theme_stylebox_override("panel", _slot_style)
		var vb := VBoxContainer.new()
		vb.add_theme_constant_override("separation", 0)
		var l1 := Label.new()
		l1.text = "%d  %s" % [i + 1, Player.SLOT_NAMES[i]]
		l1.add_theme_font_size_override("font_size", 13)
		l1.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var l2 := Label.new()
		l2.add_theme_font_size_override("font_size", 12)
		l2.add_theme_color_override("font_color", Color(1, 1, 1, 0.6))
		l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vb.add_child(l1)
		vb.add_child(l2)
		pc.add_child(vb)
		bar.add_child(pc)
		_slots.append(pc)
		_slot_counts.append(l2)

	_hint = Label.new()
	_hint.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_hint.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_hint.position.y = -110
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint.add_theme_font_size_override("font_size", 15)
	_hint.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_hint.add_theme_constant_override("shadow_offset_y", 1)
	_root.add_child(_hint)

	var tl := VBoxContainer.new()
	tl.position = Vector2(20, 16)
	_root.add_child(tl)
	_clock = Label.new()
	_clock.add_theme_font_size_override("font_size", 22)
	_clock.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	tl.add_child(_clock)
	_stamina = _mk_bar(Color(0.95, 0.8, 0.35))
	tl.add_child(_stamina)
	_breath = _mk_bar(Color(0.45, 0.8, 1.0))
	tl.add_child(_breath)

	_inv_label = Label.new()
	_inv_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_inv_label.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_inv_label.position = Vector2(-20, 16)
	_inv_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_inv_label.add_theme_font_size_override("font_size", 16)
	_inv_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	_root.add_child(_inv_label)

	_toasts = VBoxContainer.new()
	_toasts.set_anchors_preset(Control.PRESET_CENTER_LEFT)
	_toasts.position = Vector2(22, 0)
	_root.add_child(_toasts)

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


func _build_pause() -> void:
	_pause = ColorRect.new()
	(_pause as ColorRect).color = Color(0, 0, 0, 0.6)
	_pause.set_anchors_preset(Control.PRESET_FULL_RECT)
	_pause.visible = false
	add_child(_pause)
	var panel := PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.06, 0.08, 0.1, 0.95)
	ps.set_corner_radius_all(12)
	ps.set_content_margin_all(26)
	panel.add_theme_stylebox_override("panel", ps)
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	_pause.add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	panel.add_child(vb)
	var t := Label.new()
	t.text = "JAZIRA — paused"
	t.add_theme_font_size_override("font_size", 28)
	vb.add_child(t)
	var help := Label.new()
	help.text = """WASD move · Shift sprint · Space jump / swim up · Ctrl dive
Mouse wheel or 1–9 select tool · E pick up item
Hand: hold LMB to carry objects (real mass), RMB throw
Axe: fell trees → logs · Pickaxe: boulders, rock, stone blocks
Shovel: LMB dig · RMB place dirt/sand
Beam / Post / Panel / Stone: LMB place · R/Q rotate · F tilt · G snap
   Pieces need support from the ground — overhangs collapse!
Campfire: 2 logs + 4 stones · Hold T to fast-forward time · F1 hide HUD"""
	help.add_theme_color_override("font_color", Color(1, 1, 1, 0.8))
	vb.add_child(help)
	var resume := Button.new()
	resume.text = "Resume"
	resume.pressed.connect(func() -> void: set_paused(false))
	vb.add_child(resume)
	_quality_btn = Button.new()
	_quality_btn.text = "Graphics: High"
	_quality_btn.pressed.connect(func() -> void:
		Game.quality_high = not Game.quality_high
		_quality_btn.text = "Graphics: " + ("High" if Game.quality_high else "Performance")
		get_tree().current_scene.apply_quality())
	vb.add_child(_quality_btn)
	var quit := Button.new()
	quit.text = "Quit"
	quit.pressed.connect(func() -> void: get_tree().quit())
	vb.add_child(quit)


func set_paused(p: bool) -> void:
	get_tree().paused = p
	_pause.visible = p
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if p else Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		set_paused(not get_tree().paused)
	elif event.is_action_pressed("toggle_hud"):
		_root.visible = not _root.visible


func set_slot(i: int) -> void:
	for k in _slots.size():
		_slots[k].add_theme_stylebox_override("panel", _slot_style_sel if k == i else _slot_style)


func set_underwater(s: float) -> void:
	_uw_rect.visible = s > 0.01
	_uw_mat.set_shader_parameter("strength", s)


func _refresh_inventory() -> void:
	var inv := Game.inventory
	_inv_label.text = "Logs  %d\nPlanks  %d\nStone  %d\nDirt  %d\nSand  %d" % [
		inv["log"], inv["plank"], inv["stone"], inv["dirt"], inv["sand"]]
	for i in Player.SLOTS.size():
		var s: String = Player.SLOTS[i]
		var txt := ""
		if StructurePiece.DEFS.has(s):
			var cost: Dictionary = StructurePiece.DEFS[s]["cost"]
			var id: String = cost.keys()[0]
			txt = "×%d" % (Game.count(id) / int(cost[id]))
		elif s == "shovel":
			txt = "dirt %d" % Game.count("dirt")
		elif s == "campfire":
			txt = "×%d" % mini(Game.count("log") / 2, Game.count("stone") / 4)
		_slot_counts[i].text = txt


func _on_toast(text: String) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 16)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_toasts.add_child(l)
	if _toasts.get_child_count() > 6:
		_toasts.get_child(0).queue_free()
	var tw := l.create_tween()
	tw.tween_interval(2.2)
	tw.tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


func _process(_delta: float) -> void:
	if Game.day_night:
		_clock.text = Game.day_night.clock_text()
	if Game.player:
		_stamina.value = Game.player.stamina
		_breath.value = Game.player.breath
		_breath.visible = Game.player.breath < 0.999
		_hint.text = Game.player.hint
