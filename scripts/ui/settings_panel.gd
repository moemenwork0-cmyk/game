class_name SettingsPanel
extends Control
## Full-screen settings, built from Settings.SCHEMA: Display, Graphics, Audio,
## Controls (with key rebinding) and Gameplay. Every change applies immediately
## and is saved; values use left/right selectors like a console game.

signal closed

const TABS := ["Display", "Graphics", "Audio", "Controls", "Gameplay"]

static var _tab := 0
var _rows: VBoxContainer
var _tab_buttons: Array[Button] = []
var _desc: Label
var _waiting_action := ""
var _waiting_button: Button
var _scroll: ScrollContainer


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.02, 0.03, 0.9)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var root := HBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 80
	root.offset_right = -80
	root.offset_top = 70
	root.offset_bottom = -60
	root.add_theme_constant_override("separation", 56)
	add_child(root)

	# left column: title + tabs
	var left := VBoxContainer.new()
	left.custom_minimum_size.x = 280
	left.add_theme_constant_override("separation", 6)
	root.add_child(left)
	left.add_child(UiKit.heading(tr("Settings").to_upper(), 40))
	left.add_child(UiKit.rule(240))
	var sp := Control.new()
	sp.custom_minimum_size.y = 24
	left.add_child(sp)
	for i in TABS.size():
		var idx := i
		var b := UiKit.button(tr(TABS[i]).to_upper(), func() -> void: _select(idx), 260)
		b.add_theme_font_override("font", UiKit.display_font(600))
		b.add_theme_font_size_override("font_size", 21)
		left.add_child(b)
		_tab_buttons.append(b)
	var fill := Control.new()
	fill.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(fill)
	left.add_child(UiKit.button(tr("Reset tab to defaults"), func() -> void:
		Settings.reset_defaults(TABS[_tab])
		_select(_tab), 260))
	left.add_child(UiKit.button("‹  " + tr("Back"), func() -> void: closed.emit(), 260))

	# right column: rows + description
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 12)
	root.add_child(right)
	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	right.add_child(_scroll)
	_rows = VBoxContainer.new()
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 2)
	_scroll.add_child(_rows)
	_desc = UiKit.label("", 15, UiKit.MUTED)
	right.add_child(_desc)
	_select(_tab)


func _select(i: int) -> void:
	_tab = i
	for j in _tab_buttons.size():
		var on := j == i
		_tab_buttons[j].add_theme_color_override("font_color", UiKit.ACCENT if on else Color(1, 1, 1, 0.6))
	for c in _rows.get_children():
		c.queue_free()
	for e in Settings.SCHEMA:
		if e["tab"] != TABS[i]:
			continue
		if e.get("desktop", false) and OS.has_feature("web"):
			continue
		_rows.add_child(_row(e))
	_desc.text = ""


func _row(e: Dictionary) -> Control:
	var panel := PanelContainer.new()
	var st := StyleBoxFlat.new()
	st.bg_color = Color(1, 1, 1, 0.025)
	st.content_margin_left = 20
	st.content_margin_right = 12
	st.content_margin_top = 6
	st.content_margin_bottom = 6
	var sth := st.duplicate() as StyleBoxFlat
	sth.bg_color = Color(0.96, 0.74, 0.38, 0.08)
	sth.border_color = UiKit.ACCENT
	sth.border_width_left = 3
	panel.add_theme_stylebox_override("panel", st)
	panel.mouse_entered.connect(func() -> void: panel.add_theme_stylebox_override("panel", sth))
	panel.mouse_exited.connect(func() -> void: panel.add_theme_stylebox_override("panel", st))
	var hb := HBoxContainer.new()
	panel.add_child(hb)
	var l := UiKit.label(tr(e["label"]), 19, Color(1, 1, 1, 0.88))
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(l)
	var ctl: Control
	match String(e["type"]):
		"option":
			var opts: Array = e["options"]
			var vals: Array = e.get("values", [])
			var cur: Variant = Settings.get(e["key"])
			var idx: int = vals.find(cur) if not vals.is_empty() else int(cur)
			ctl = _selector(opts, idx, func(n: int) -> void:
				Settings.set_value(e["key"], vals[n] if not vals.is_empty() else n)
				if e["key"] == "quality" or e["key"] == "language":
					_rebuild.call_deferred())
		"toggle":
			ctl = _selector(["Off", "On"], 1 if Settings.get(e["key"]) else 0, func(n: int) -> void:
				Settings.set_value(e["key"], n == 1))
		"slider":
			ctl = _slider(e)
		"key":
			ctl = _keybind(e["action"])
		"device":
			var devs: Array = Array(AudioServer.get_output_device_list())
			var idx2 := maxi(devs.find(Settings.audio_device), 0)
			ctl = _selector(devs, idx2, func(n: int) -> void: Settings.set_value("audio_device", devs[n]))
	ctl.custom_minimum_size.x = 380
	hb.add_child(ctl)
	return panel


## Rebuilds the whole screen (after the language or a preset changes).
func _rebuild() -> void:
	var parent := get_parent()
	var fresh := SettingsPanel.new()
	for c in closed.get_connections():
		fresh.closed.connect(c["callable"])
	parent.add_child(fresh)
	queue_free()


func _selector(options: Array, index: int, cb: Callable) -> Control:
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	var val := UiKit.label("", 19, UiKit.ACCENT)
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	val.custom_minimum_size.x = 280
	val.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var state := [clampi(index, 0, maxi(options.size() - 1, 0))]
	var show := func() -> void:
		val.text = tr(str(options[state[0]])) if not options.is_empty() else "—"
	show.call()
	var step := func(d: int) -> void:
		if options.is_empty():
			return
		state[0] = wrapi(state[0] + d, 0, options.size())
		show.call()
		cb.call(state[0])
	var lb := _arrow("‹", func() -> void: step.call(-1))
	var rb := _arrow("›", func() -> void: step.call(1))
	hb.add_child(lb)
	hb.add_child(val)
	hb.add_child(rb)
	return hb


func _arrow(t: String, cb: Callable) -> Button:
	var b := UiKit.button(t, cb, 44)
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_font_size_override("font_size", 26)
	b.custom_minimum_size = Vector2(44, 38)
	return b


func _slider(e: Dictionary) -> Control:
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 14)
	var s := HSlider.new()
	var sc: float = e["scale"]
	s.min_value = e["min"]
	s.max_value = e["max"]
	s.step = e["step"]
	s.value = float(Settings.get(e["key"])) * sc
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := UiKit.label(String(e["fmt"]) % s.value, 18, UiKit.ACCENT)
	l.custom_minimum_size.x = 70
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	s.value_changed.connect(func(v: float) -> void:
		l.text = String(e["fmt"]) % v
		Settings.set_value(e["key"], v / sc))
	hb.add_child(s)
	hb.add_child(l)
	return hb


func _keybind(action: String) -> Control:
	var b := UiKit.solid_button(Settings.key_name(action), Callable(), 200)
	b.pressed.connect(func() -> void:
		_waiting_action = action
		_waiting_button = b
		b.text = tr("Press a key…  (Esc to cancel)"))
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	hb.add_child(b)
	return hb


func _input(event: InputEvent) -> void:
	if _waiting_action == "" or not (event is InputEventKey) or not event.pressed:
		return
	get_viewport().set_input_as_handled()
	var k := event as InputEventKey
	if k.physical_keycode != KEY_ESCAPE:
		Settings.rebind(_waiting_action, k.physical_keycode)
	_waiting_button.text = Settings.key_name(_waiting_action)
	_waiting_action = ""


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		closed.emit()
