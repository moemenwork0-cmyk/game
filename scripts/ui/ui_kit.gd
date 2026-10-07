class_name UiKit
extends RefCounted
## The game's visual identity, shared by every screen.
##   • Display type: Cinzel (Roman capitals) — with Reem Kufi for Arabic
##   • Narrative type: Cormorant Garamond — with Amiri for Arabic
##   • Interface type: Rajdhani — with Cairo for Arabic
##   • Colour: night-sea ink, salt white and a single brass/sunset accent

const ACCENT := Color(0.96, 0.74, 0.38)
const ACCENT_DIM := Color(0.96, 0.74, 0.38, 0.35)
const INK := Color(0.02, 0.035, 0.05)
const PANEL_BG := Color(0.025, 0.04, 0.055, 0.94)
const SALT := Color(0.95, 0.94, 0.9)
const MUTED := Color(0.95, 0.94, 0.9, 0.5)

static var _theme: Theme
static var _fonts := {}


static func _ff(path: String, fallback: String = "") -> Font:
	var key := path + "|" + fallback
	if _fonts.has(key):
		return _fonts[key]
	var f: FontFile = load(path)
	if f and fallback != "" and f.fallbacks.is_empty():
		var fb: FontFile = load(fallback)
		if fb:
			f.fallbacks = [fb]
	_fonts[key] = f
	return f


## Rajdhani for Latin text, with Cairo behind it so Arabic renders (and shapes) correctly.
static func font(weight: String = "SemiBold") -> Font:
	return _ff("res://assets/fonts/Rajdhani-%s.ttf" % weight, "res://assets/fonts/Cairo.ttf")


## Titles and headings.
static func display_font(weight: int = 600) -> Font:
	var key := "display%d" % weight
	if not _fonts.has(key):
		var fv := FontVariation.new()
		fv.base_font = _ff("res://assets/fonts/Cinzel.ttf", "res://assets/fonts/ReemKufi.ttf")
		fv.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): weight}
		_fonts[key] = fv
	return _fonts[key]


## Story text, quotes, the narration in cinematics.
static func story_font(weight: int = 500) -> Font:
	var key := "story%d" % weight
	if not _fonts.has(key):
		var fv := FontVariation.new()
		fv.base_font = _ff("res://assets/fonts/Cormorant.ttf", "res://assets/fonts/Amiri-Regular.ttf")
		fv.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): weight}
		_fonts[key] = fv
	return _fonts[key]


## The Arabic calligraphic mark under the logo.
static func calligraphy_font() -> Font:
	return _ff("res://assets/fonts/ArefRuqaa-Bold.ttf")


static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = font("SemiBold")
	t.default_font_size = 19
	var normal := _box(Color(1, 1, 1, 0.0), Color(1, 1, 1, 0.0))
	var hover := _box(Color(0.96, 0.74, 0.38, 0.1), Color(0.96, 0.74, 0.38, 0.0))
	hover.border_width_left = 3
	hover.border_color = ACCENT
	var pressed := _box(Color(0.96, 0.74, 0.38, 0.2), ACCENT)
	var disabled := _box(Color(1, 1, 1, 0.0), Color(1, 1, 1, 0.0))
	for cls in ["Button", "OptionButton"]:
		t.set_stylebox("normal", cls, normal)
		t.set_stylebox("hover", cls, hover)
		t.set_stylebox("pressed", cls, pressed)
		t.set_stylebox("disabled", cls, disabled)
		t.set_stylebox("focus", cls, hover)
		t.set_color("font_color", cls, Color(1, 1, 1, 0.86))
		t.set_color("font_hover_color", cls, ACCENT)
		t.set_color("font_focus_color", cls, ACCENT)
		t.set_color("font_pressed_color", cls, ACCENT)
		t.set_color("font_disabled_color", cls, Color(1, 1, 1, 0.25))
	var panel := StyleBoxFlat.new()
	panel.bg_color = PANEL_BG
	panel.set_corner_radius_all(2)
	panel.set_content_margin_all(32)
	panel.border_color = Color(0.96, 0.74, 0.38, 0.22)
	panel.border_width_top = 2
	t.set_stylebox("panel", "PanelContainer", panel)
	var grab := StyleBoxFlat.new()
	grab.bg_color = ACCENT
	grab.set_corner_radius_all(1)
	var track := StyleBoxFlat.new()
	track.bg_color = Color(1, 1, 1, 0.12)
	track.content_margin_top = 2
	track.content_margin_bottom = 2
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", grab)
	t.set_stylebox("grabber_area_highlight", "HSlider", grab)
	t.set_icon("grabber", "HSlider", _dot(8, SALT))
	t.set_icon("grabber_highlight", "HSlider", _dot(9, ACCENT))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.08)
	var sg := StyleBoxFlat.new()
	sg.bg_color = ACCENT_DIM
	t.set_stylebox("scroll", "VScrollBar", sb)
	t.set_stylebox("grabber", "VScrollBar", sg)
	t.set_stylebox("grabber_highlight", "VScrollBar", sg)
	t.set_stylebox("grabber_pressed", "VScrollBar", sg)
	var le := StyleBoxFlat.new()
	le.bg_color = Color(1, 1, 1, 0.06)
	le.border_color = ACCENT_DIM
	le.border_width_bottom = 2
	le.set_content_margin_all(10)
	t.set_stylebox("normal", "LineEdit", le)
	t.set_stylebox("focus", "LineEdit", le)
	t.set_color("font_color", "Label", Color(1, 1, 1, 0.9))
	_theme = t
	return t


static func _dot(r: int, c: Color) -> ImageTexture:
	var img := Image.create(r * 2 + 2, r * 2 + 2, false, Image.FORMAT_RGBA8)
	for y in img.get_height():
		for x in img.get_width():
			var d := Vector2(x - r - 0.5, y - r - 0.5).length()
			img.set_pixel(x, y, Color(c.r, c.g, c.b, clampf(r - d + 0.5, 0.0, 1.0) * c.a))
	return ImageTexture.create_from_image(img)


static func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = bg
	b.border_color = border
	b.set_border_width_all(0)
	b.content_margin_left = 22
	b.content_margin_right = 22
	b.content_margin_top = 10
	b.content_margin_bottom = 10
	return b


static func button(text: String, cb: Callable, min_w: float = 260.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, 46)
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.mouse_entered.connect(func() -> void:
		if Game.sfx and not b.disabled:
			Game.sfx.play("ui", null, -14.0, 0.05, "UI"))
	b.pressed.connect(func() -> void:
		if Game.sfx:
			Game.sfx.play("pickup", null, -10.0, 0.0, "UI")
		cb.call())
	return b


## A boxed, centred button for dialogs.
static func solid_button(text: String, cb: Callable, min_w: float = 200.0, danger: bool = false) -> Button:
	var b := button(text, cb, min_w)
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	var c := Color(0.85, 0.25, 0.2) if danger else ACCENT
	var n := _box(Color(c.r, c.g, c.b, 0.12), c)
	n.set_border_width_all(1)
	var h := _box(Color(c.r, c.g, c.b, 0.28), c)
	h.set_border_width_all(1)
	b.add_theme_stylebox_override("normal", n)
	b.add_theme_stylebox_override("hover", h)
	b.add_theme_stylebox_override("focus", h)
	b.add_theme_stylebox_override("pressed", h)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_focus_color", Color.WHITE)
	return b


static func label(text: String, size: int = 17, color: Color = Color(1, 1, 1, 0.9)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


static func heading(text: String, size: int = 34, color: Color = SALT) -> Label:
	var l := label(text, size, color)
	l.add_theme_font_override("font", display_font(600))
	return l


## A thin brass rule with a diamond in the middle — used under titles.
static func rule(width: float = 220.0) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(width, 14)
	c.draw.connect(func() -> void:
		var y := 7.0
		c.draw_line(Vector2(0, y), Vector2(width * 0.5 - 9, y), ACCENT_DIM, 1.0)
		c.draw_line(Vector2(width * 0.5 + 9, y), Vector2(width, y), ACCENT_DIM, 1.0)
		var d := PackedVector2Array([Vector2(width * 0.5, y - 4), Vector2(width * 0.5 + 4, y), Vector2(width * 0.5, y + 4), Vector2(width * 0.5 - 4, y)])
		c.draw_colored_polygon(d, ACCENT))
	return c
