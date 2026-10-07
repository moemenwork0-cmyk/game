class_name SettingsPanel
extends PanelContainer
## Graphics / controls / audio settings. Changes apply immediately and are saved.

signal closed


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH
	custom_minimum_size = Vector2(560, 0)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	add_child(vb)
	vb.add_child(UiKit.label("Settings", 30))

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 12)
	vb.add_child(grid)

	var q := OptionButton.new()
	for n in Settings.QUALITY_NAMES:
		q.add_item(n)
	q.selected = Settings.quality
	q.item_selected.connect(func(i: int) -> void:
		Settings.set_value("quality", i)
		_apply_graphics())
	_row(grid, "Graphics quality", q)

	var lang := OptionButton.new()
	lang.add_item("English")
	lang.add_item("العربية")
	lang.selected = 1 if Settings.language == "ar" else 0
	lang.item_selected.connect(func(i: int) -> void: Settings.set_value("language", "ar" if i == 1 else "en"))
	_row(grid, "Story language", lang)

	_row(grid, "Render scale", _slider(50, 100, 5, Settings.render_scale * 100.0, "%d%%", func(v: float) -> void:
		Settings.set_value("render_scale", v / 100.0)
		_apply_graphics()))
	_row(grid, "Field of view", _slider(60, 100, 1, Settings.fov, "%d°", func(v: float) -> void:
		Settings.set_value("fov", v)))
	_row(grid, "Mouse sensitivity", _slider(5, 60, 1, Settings.mouse_sens * 10000.0, "%d", func(v: float) -> void:
		Settings.set_value("mouse_sens", v / 10000.0)))
	_row(grid, "Volume", _slider(0, 100, 1, Settings.volume * 100.0, "%d%%", func(v: float) -> void:
		Settings.set_value("volume", v / 100.0)))
	if not OS.has_feature("web"):
		var fs := CheckButton.new()
		fs.button_pressed = Settings.fullscreen
		fs.toggled.connect(func(on: bool) -> void: Settings.set_value("fullscreen", on))
		_row(grid, "Fullscreen", fs)

	vb.add_child(UiKit.label("Low/Medium + a lower render scale make the game run well on laptops.", 13, Color(1, 1, 1, 0.45)))
	var back := UiKit.button("Back", func() -> void: closed.emit())
	back.size_flags_horizontal = Control.SIZE_SHRINK_END
	back.custom_minimum_size.x = 140
	vb.add_child(back)


func _row(grid: GridContainer, text: String, control: Control) -> void:
	grid.add_child(UiKit.label(text))
	control.custom_minimum_size.x = 260
	grid.add_child(control)


func _slider(lo: float, hi: float, step: float, value: float, fmt: String, cb: Callable) -> Control:
	var hb := HBoxContainer.new()
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = step
	s.value = value
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := UiKit.label(fmt % value, 15, Color(1, 1, 1, 0.6))
	l.custom_minimum_size.x = 52
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	s.value_changed.connect(func(v: float) -> void:
		l.text = fmt % v
		cb.call(v))
	hb.add_child(s)
	hb.add_child(l)
	return hb


func _apply_graphics() -> void:
	var main := get_tree().current_scene
	if main and main.has_method("apply_quality"):
		main.apply_quality()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		closed.emit()
