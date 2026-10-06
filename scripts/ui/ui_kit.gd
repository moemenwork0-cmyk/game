class_name UiKit
extends RefCounted
## Shared look for every menu.

const ACCENT := Color(1.0, 0.82, 0.45)
const PANEL_BG := Color(0.05, 0.07, 0.09, 0.92)

static var _theme: Theme


static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font_size = 17
	var normal := _box(Color(1, 1, 1, 0.06), Color(1, 1, 1, 0.1))
	var hover := _box(Color(1, 1, 1, 0.13), ACCENT * Color(1, 1, 1, 0.7))
	var pressed := _box(Color(1, 0.82, 0.45, 0.25), ACCENT)
	var disabled := _box(Color(1, 1, 1, 0.02), Color(1, 1, 1, 0.05))
	for cls in ["Button", "OptionButton"]:
		t.set_stylebox("normal", cls, normal)
		t.set_stylebox("hover", cls, hover)
		t.set_stylebox("pressed", cls, pressed)
		t.set_stylebox("disabled", cls, disabled)
		t.set_stylebox("focus", cls, hover)
		t.set_color("font_color", cls, Color(1, 1, 1, 0.92))
		t.set_color("font_hover_color", cls, ACCENT)
		t.set_color("font_disabled_color", cls, Color(1, 1, 1, 0.3))
	var panel := StyleBoxFlat.new()
	panel.bg_color = PANEL_BG
	panel.set_corner_radius_all(14)
	panel.set_content_margin_all(28)
	panel.border_color = Color(1, 1, 1, 0.08)
	panel.set_border_width_all(1)
	t.set_stylebox("panel", "PanelContainer", panel)
	var grab := StyleBoxFlat.new()
	grab.bg_color = ACCENT
	grab.set_corner_radius_all(3)
	var track := StyleBoxFlat.new()
	track.bg_color = Color(1, 1, 1, 0.15)
	track.set_corner_radius_all(3)
	track.content_margin_top = 3
	track.content_margin_bottom = 3
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", grab)
	t.set_stylebox("grabber_area_highlight", "HSlider", grab)
	_theme = t
	return t


static func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.border_color = border
	b.set_border_width_all(1)
	b.set_corner_radius_all(8)
	b.content_margin_left = 22
	b.content_margin_right = 22
	b.content_margin_top = 10
	b.content_margin_bottom = 10
	return b


static func button(text: String, cb: Callable, min_w: float = 260.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, 46)
	b.pressed.connect(func() -> void:
		if Game.sfx:
			Game.sfx.play("pickup", null, -10.0, 0.0)
		cb.call())
	return b


static func label(text: String, size: int = 17, color: Color = Color(1, 1, 1, 0.9)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l
