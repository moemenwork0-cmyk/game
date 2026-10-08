class_name MainMenu
extends Control
## Title screen over a living view of the island at dusk, with the game's theme.
## Returning players see CONTINUE first, with who they are and how long they
## have survived. Starting over is deliberately quiet (bottom corner) and needs
## a confirmation that spells out what will be lost.

var _col: VBoxContainer
var _items: VBoxContainer
var _settings: SettingsPanel
var _modal: Control
var _t := 0.0
var _title_font: FontVariation
var _music: AudioStreamPlayer
var _music_wait := true


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_shade(Vector2(0.0, 0.5), Vector2(0.62, 0.5), Color(0.01, 0.015, 0.025, 0.9)))
	add_child(_shade(Vector2(0.5, 1.0), Vector2(0.5, 0.6), Color(0.01, 0.015, 0.025, 0.7)))
	add_child(_shade(Vector2(0.5, 0.0), Vector2(0.5, 0.18), Color(0.01, 0.015, 0.025, 0.5)))

	_col = VBoxContainer.new()
	_col.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	_col.offset_left = 110
	_col.offset_right = 760
	_col.offset_top = 0
	_col.offset_bottom = 0
	_col.alignment = BoxContainer.ALIGNMENT_CENTER
	_col.add_theme_constant_override("separation", 0)
	add_child(_col)

	_title_font = FontVariation.new()
	_title_font.base_font = UiKit.display_font(500)
	_title_font.spacing_glyph = 34
	var title := UiKit.label("JAZIRA", 104, UiKit.SALT)
	title.add_theme_font_override("font", _title_font)
	title.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.45))
	title.add_theme_constant_override("shadow_offset_y", 4)
	_col.add_child(title)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 20)
	_col.add_child(hb)
	var cal := UiKit.label("جزيرة", 54, UiKit.ACCENT)
	cal.add_theme_font_override("font", UiKit.calligraphy_font())
	hb.add_child(cal)
	var tag := UiKit.label(tr("One island. Every story is yours alone."), 23, Color(1, 1, 1, 0.66))
	tag.add_theme_font_override("font", UiKit.story_font(500))
	tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hb.add_child(tag)
	var sp := Control.new()
	sp.custom_minimum_size.y = 20
	_col.add_child(sp)
	_col.add_child(UiKit.rule(420))
	var sp2 := Control.new()
	sp2.custom_minimum_size.y = 30
	_col.add_child(sp2)

	_items = VBoxContainer.new()
	_items.add_theme_constant_override("separation", 4)
	_col.add_child(_items)
	var info := SaveGame.summary()
	var n := 1
	if not info.is_empty():
		var sub := tr("Day %d · %s") % [int(info.get("day", 1)), String(info.get("who", ""))]
		_items.add_child(_item(n, tr("Continue"), sub, func() -> void: Game.restart("load")))
		n += 1
	else:
		_items.add_child(_item(n, tr("New Game"), "", func() -> void: Game.restart("prologue")))
		n += 1
	_items.add_child(_item(n, tr("Explore the new island"), tr("Preview"), func() -> void:
		get_tree().change_scene_to_file("res://scenes/slice.tscn")))
	n += 1
	_items.add_child(_item(n, tr("Settings"), "", _open_settings))
	n += 1
	_items.add_child(_item(n, tr("Credits"), "", _open_credits))
	n += 1
	if not OS.has_feature("web"):
		_items.add_child(_item(n, tr("Quit"), "", func() -> void: get_tree().quit()))

	# the quiet corner: version, replay the prologue, start over
	var foot := HBoxContainer.new()
	foot.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	foot.offset_left = 110
	foot.offset_top = -56
	foot.offset_bottom = -24
	foot.offset_right = 1100
	foot.add_theme_constant_override("separation", 28)
	add_child(foot)
	var ver := UiKit.label("v" + str(ProjectSettings.get_setting("application/config/version", "0.4")) + "  ·  " + tr("Early access build"), 14, Color(1, 1, 1, 0.3))
	ver.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	foot.add_child(ver)
	if not info.is_empty():
		foot.add_child(_link(tr("Replay the prologue"), func() -> void: _confirm_restart(false)))
		foot.add_child(_link(tr("Start over"), func() -> void: _confirm_restart(true)))
	Music.prepare()
	(_items.get_child(0) as Control).grab_focus.call_deferred()
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 1.4)


func _process(delta: float) -> void:
	_t += delta
	if _music_wait:
		var m := Music.theme()
		if m:
			_music_wait = false
			_music = AudioStreamPlayer.new()
			_music.stream = m
			_music.bus = "Music"
			_music.volume_db = -30.0
			add_child(_music)
			_music.play()
			_music.create_tween().tween_property(_music, "volume_db", -6.0, 4.0)


func _shade(from: Vector2, to: Vector2, c: Color) -> TextureRect:
	var g := Gradient.new()
	g.colors = PackedColorArray([c, Color(c.r, c.g, c.b, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = from
	gt.fill_to = to
	var r := TextureRect.new()
	r.texture = gt
	r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	r.stretch_mode = TextureRect.STRETCH_SCALE
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


## A menu entry: "01  CONTINUE" in display capitals, a brass bar on hover,
## and an optional second line (who you are, which day).
func _item(index: int, text: String, sub: String, cb: Callable) -> Control:
	var b := Button.new()
	b.flat = true
	b.focus_mode = Control.FOCUS_ALL
	b.custom_minimum_size = Vector2(520, 70 if sub != "" else 56)
	var empty := StyleBoxEmpty.new()
	for st in ["normal", "hover", "pressed", "focus", "disabled"]:
		b.add_theme_stylebox_override(st, empty)
	# built from containers so the row mirrors itself in right-to-left languages
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.add_theme_constant_override("separation", 0)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(row)
	var bar := ColorRect.new()
	bar.color = UiKit.ACCENT
	bar.custom_minimum_size = Vector2(3, 0)
	bar.size_flags_vertical = Control.SIZE_FILL
	bar.modulate.a = 0.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(bar)
	var gap := Control.new()
	gap.custom_minimum_size.x = 18
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(gap)
	var num := UiKit.label("%02d" % index, 16, UiKit.ACCENT_DIM)
	num.add_theme_font_override("font", UiKit.display_font(600))
	num.custom_minimum_size.x = 40
	num.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	num.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(num)
	var slide := Control.new()
	slide.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(slide)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", -6)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(col)
	var l := UiKit.label(text.to_upper(), 34, Color(1, 1, 1, 0.82))
	l.add_theme_font_override("font", UiKit.display_font(600))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(l)
	if sub != "":
		var s := UiKit.label(sub, 17, Color(1, 1, 1, 0.45))
		s.add_theme_font_override("font", UiKit.story_font(600))
		s.mouse_filter = Control.MOUSE_FILTER_IGNORE
		col.add_child(s)
	var on := func(v: bool) -> void:
		var tw := b.create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tw.tween_property(slide, "custom_minimum_size:x", 14.0 if v else 0.0, 0.25)
		tw.tween_property(bar, "modulate:a", 1.0 if v else 0.0, 0.25)
		tw.tween_property(num, "modulate", Color(2.4, 2.4, 2.4) if v else Color.WHITE, 0.25)
		l.add_theme_color_override("font_color", UiKit.ACCENT if v else Color(1, 1, 1, 0.82))
		if v and Game.sfx:
			Game.sfx.play("ui", null, -14.0, 0.05, "UI")
	b.mouse_entered.connect(func() -> void: b.grab_focus())
	b.focus_entered.connect(func() -> void: on.call(true))
	b.focus_exited.connect(func() -> void: on.call(false))
	b.pressed.connect(func() -> void:
		if Game.sfx:
			Game.sfx.play("pickup", null, -8.0, 0.0, "UI")
		cb.call())
	return b


func _link(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.flat = true
	b.add_theme_font_size_override("font_size", 14)
	b.add_theme_color_override("font_color", Color(1, 1, 1, 0.38))
	b.add_theme_color_override("font_hover_color", UiKit.ACCENT)
	var empty := StyleBoxEmpty.new()
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, empty)
	b.pressed.connect(cb)
	return b


func _open_settings() -> void:
	_col.visible = false
	_settings = SettingsPanel.new()
	_settings.closed.connect(_close_settings)
	add_child(_settings)


func _close_settings() -> void:
	for c in get_children():
		if c is SettingsPanel:
			c.queue_free()
	_col.visible = true
	# a language change rebuilds the menu so every label follows it
	var fresh := MainMenu.new()
	get_parent().add_child(fresh)
	fresh.modulate.a = 1.0
	if _music:
		_music.reparent(fresh)
		fresh._music = _music
		fresh._music_wait = false
	queue_free()


func _open_credits() -> void:
	var lines := [
		["JAZIRA", ""],
		["Engine", "Godot Engine (MIT) · Jolt Physics (MIT)"],
		["Characters & motion capture", "Microsoft Rocketbox Avatar Library — © Microsoft, MIT License"],
		["Icons", "game-icons.net — CC BY 3.0"],
		["Typefaces", "Cinzel · Cormorant Garamond · Rajdhani · Cairo · Reem Kufi · Amiri · Aref Ruqaa — SIL Open Font License"],
		["Sound & music", "Synthesised in code for this game"],
	]
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	for e in lines:
		if e[1] == "":
			vb.add_child(UiKit.heading(e[0], 40))
			vb.add_child(UiKit.rule(300))
			continue
		var h := UiKit.label(tr(e[0]).to_upper(), 14, UiKit.ACCENT)
		h.add_theme_font_override("font", UiKit.display_font(700))
		vb.add_child(h)
		var v := UiKit.label(e[1], 18, Color(1, 1, 1, 0.8))
		v.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.custom_minimum_size.x = 640
		vb.add_child(v)
	var back := UiKit.solid_button(tr("Back"), func() -> void: _close_modal(), 200)
	back.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	vb.add_child(back)
	_show_modal(vb)


func _confirm_restart(erase: bool) -> void:
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 18)
	vb.custom_minimum_size.x = 640
	if erase:
		vb.add_child(UiKit.heading(tr("Start over from the very beginning?"), 30, Color(1, 0.85, 0.8)))
		var w := UiKit.label(tr("Your island, your journal, your choices and every day you survived will be erased forever. This cannot be undone."), 18, Color(1, 1, 1, 0.75))
		w.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		vb.add_child(w)
		var hint := UiKit.label(tr("Type ERASE to confirm"), 15, UiKit.MUTED)
		vb.add_child(hint)
		var le := LineEdit.new()
		le.placeholder_text = "ERASE"
		le.custom_minimum_size = Vector2(240, 44)
		vb.add_child(le)
		var hb := HBoxContainer.new()
		hb.add_theme_constant_override("separation", 14)
		var go := UiKit.solid_button(tr("Erase and start over"), func() -> void:
			SaveGame.erase_all()
			Game.restart("prologue"), 280, true)
		go.disabled = true
		le.text_changed.connect(func(t: String) -> void: go.disabled = t.strip_edges().to_upper() != "ERASE")
		hb.add_child(go)
		hb.add_child(UiKit.solid_button(tr("Cancel"), _close_modal, 180))
		vb.add_child(hb)
		le.grab_focus.call_deferred()
	else:
		vb.add_child(UiKit.heading(tr("Replay the prologue"), 30))
		var hb2 := HBoxContainer.new()
		hb2.add_theme_constant_override("separation", 14)
		hb2.add_child(UiKit.solid_button(tr("Replay the prologue"), func() -> void: Game.restart("replay"), 280))
		hb2.add_child(UiKit.solid_button(tr("Cancel"), _close_modal, 180))
		vb.add_child(hb2)
	_show_modal(vb)


func _show_modal(content: Control) -> void:
	_col.visible = false
	_modal = ColorRect.new()
	(_modal as ColorRect).color = Color(0.0, 0.0, 0.0, 0.7)
	_modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_modal)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.add_child(content)
	_modal.add_child(panel)


func _close_modal() -> void:
	if _modal:
		_modal.queue_free()
		_modal = null
	_col.visible = true


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and _modal:
		get_viewport().set_input_as_handled()
		_close_modal()
