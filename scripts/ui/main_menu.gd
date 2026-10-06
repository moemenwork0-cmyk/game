class_name MainMenu
extends Control
## Title screen shown over a slowly orbiting view of the island.

var _buttons: VBoxContainer
var _settings: SettingsPanel
var _confirm: PanelContainer


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

	# soft dark gradient on the left so the text reads over the island
	var shade := TextureRect.new()
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(0.02, 0.03, 0.05, 0.85), Color(0.02, 0.03, 0.05, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0.5)
	gt.fill_to = Vector2(0.7, 0.5)
	shade.texture = gt
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.stretch_mode = TextureRect.STRETCH_SCALE
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_CENTER_LEFT)
	col.grow_vertical = Control.GROW_DIRECTION_BOTH
	col.offset_left = 90
	col.offset_right = 600
	col.add_theme_constant_override("separation", 6)
	add_child(col)

	var title := UiKit.label("J A Z I R A", 76, Color(1, 0.97, 0.9))
	title.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	title.add_theme_constant_override("shadow_offset_y", 3)
	col.add_child(title)
	col.add_child(UiKit.label("One tiny island. One day, a nation.", 20, Color(1, 0.85, 0.6, 0.85)))
	var spacer := Control.new()
	spacer.custom_minimum_size.y = 36
	col.add_child(spacer)

	_buttons = VBoxContainer.new()
	_buttons.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_buttons.add_theme_constant_override("separation", 10)
	col.add_child(_buttons)
	if SaveGame.exists():
		_buttons.add_child(UiKit.button("Continue", func() -> void: Game.restart("load")))
		_buttons.add_child(UiKit.label("   " + SaveGame.describe(), 13, Color(1, 1, 1, 0.45)))
	_buttons.add_child(UiKit.button("New Game", _on_new_game))
	_buttons.add_child(UiKit.button("Settings", _open_settings))
	if not OS.has_feature("web"):
		_buttons.add_child(UiKit.button("Quit", func() -> void: get_tree().quit()))

	var ver := UiKit.label("Early prototype · " + ProjectSettings.get_setting("application/config/version", "0.1"), 13, Color(1, 1, 1, 0.35))
	ver.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	ver.offset_left = 24
	ver.offset_top = -34
	add_child(ver)
	_buttons.get_child(0).grab_focus.call_deferred()


func _on_new_game() -> void:
	if not SaveGame.exists():
		_start_new()
		return
	_buttons.visible = false
	_confirm = PanelContainer.new()
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	vb.add_child(UiKit.label("Start a new island?", 24))
	vb.add_child(UiKit.label("Your saved island will be replaced the next time the game saves.", 15, Color(1, 1, 1, 0.6)))
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 10)
	hb.add_child(UiKit.button("Start new", _start_new, 160))
	hb.add_child(UiKit.button("Cancel", func() -> void:
		_confirm.queue_free()
		_buttons.visible = true, 160))
	vb.add_child(hb)
	_confirm.add_child(vb)
	_confirm.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_confirm.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_confirm.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_confirm)


func _start_new() -> void:
	var main := get_tree().current_scene
	main.start_play({})
	queue_free()


func _open_settings() -> void:
	_buttons.get_parent().visible = false
	_settings = SettingsPanel.new()
	_settings.closed.connect(func() -> void:
		_settings.queue_free()
		_buttons.get_parent().visible = true)
	add_child(_settings)
