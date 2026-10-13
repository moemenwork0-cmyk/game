class_name UiKit
extends RefCounted
## Shared look for every screen: palette, fonts, icons (game-icons.net silhouettes, tinted at
## draw time), styled plates / buttons, and small drawing helpers used by the HUD and menus.

const AMBER := Color(0.98, 0.72, 0.2)
const AMBER_D := Color(0.62, 0.42, 0.08)
const RED := Color(1.0, 0.3, 0.24)
const GREEN := Color(0.55, 0.92, 0.45)
const CYAN := Color(0.4, 0.85, 1.0)
const INK := Color(0.93, 0.95, 0.9)
const DIM := Color(0.62, 0.66, 0.6)
const STEEL := Color(0.075, 0.085, 0.09)
const STEEL_L := Color(0.13, 0.145, 0.15)

static var _icons := {}
static var _fonts := {}


static func icon(name: String) -> Texture2D:
	if not _icons.has(name):
		var p := "res://assets/ui/gi/%s.svg" % name
		if not ResourceLoader.exists(p):
			p = "res://assets/ui/%s.svg" % name
		_icons[name] = load(p)
	return _icons[name]


static func font(kind := "bold") -> Font:
	if not _fonts.has(kind):
		var f := FontVariation.new()
		f.base_font = load("res://assets/fonts/Rajdhani-Bold.ttf" if kind != "mid" else "res://assets/fonts/Rajdhani-SemiBold.ttf")
		if kind == "wide":
			f.spacing_glyph = 3
		_fonts[kind] = f
	return _fonts[kind]


static func theme() -> Theme:
	var th := Theme.new()
	th.default_font = font()
	th.default_font_size = 22
	return th


## Skewed plate style used for buttons and cards.
static func plate(bg: Color, border := Color(1, 1, 1, 0.08), accent_left := 0, radius := 4, skew := 0.18) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(1)
	if accent_left > 0:
		sb.border_width_left = accent_left
	sb.set_corner_radius_all(radius)
	sb.skew = Vector2(skew, 0)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 10
	sb.content_margin_bottom = 10
	sb.anti_aliasing = true
	return sb


static func label(text: String, size: int, col := INK, kind := "bold") -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font(kind))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.55))
	l.add_theme_constant_override("shadow_offset_y", 2)
	return l


## A big menu button: skewed steel plate, icon, title + subtitle, amber edge that lights up.
static func menu_button(title: String, sub: String, icon_name: String, primary := false) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(380, 76)
	b.focus_mode = Control.FOCUS_NONE
	var base := Color(0.62, 0.42, 0.08, 0.95) if primary else Color(0.06, 0.07, 0.075, 0.82)
	var hov := Color(0.85, 0.6, 0.12, 1.0) if primary else Color(0.12, 0.13, 0.14, 0.92)
	b.add_theme_stylebox_override("normal", plate(base, Color(AMBER, 0.35), 5))
	b.add_theme_stylebox_override("hover", plate(hov, Color(AMBER, 0.8), 9))
	b.add_theme_stylebox_override("pressed", plate(hov.darkened(0.2), Color(AMBER, 1.0), 12))
	b.add_theme_stylebox_override("disabled", plate(Color(0.05, 0.05, 0.05, 0.6), Color(1, 1, 1, 0.05), 3))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var hb := HBoxContainer.new()
	hb.set_anchors_preset(Control.PRESET_FULL_RECT)
	hb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_theme_constant_override("separation", 16)
	hb.offset_left = 28
	b.add_child(hb)
	var ic := TextureRect.new()
	ic.texture = icon(icon_name)
	ic.custom_minimum_size = Vector2(40, 40)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	ic.modulate = Color(0.08, 0.06, 0.02) if primary else AMBER
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(ic)
	var vb := VBoxContainer.new()
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", -6)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(vb)
	var t := label(title, 30, Color(0.07, 0.06, 0.03) if primary else INK, "wide")
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.add_child(t)
	if sub != "":
		var s := label(sub, 15, Color(0.15, 0.11, 0.04) if primary else DIM, "mid")
		s.mouse_filter = Control.MOUSE_FILTER_IGNORE
		vb.add_child(s)
	b.mouse_entered.connect(func() -> void:
		Sfx.play("ui_hover", -14.0)
		b.create_tween().tween_property(hb, "offset_left", 38.0, 0.12))
	b.mouse_exited.connect(func() -> void: b.create_tween().tween_property(hb, "offset_left", 28.0, 0.15))
	b.button_down.connect(func() -> void: Sfx.play("ui_click", -6.0))
	return b


## Small square icon button (pause, back...).
static func icon_button(icon_name: String, size := 56.0) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(size, size)
	b.focus_mode = Control.FOCUS_NONE
	b.icon = icon(icon_name)
	b.expand_icon = true
	b.add_theme_constant_override("icon_max_width", int(size * 0.55))
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	for st in ["normal", "hover", "pressed"]:
		var sb := plate(Color(0.05, 0.06, 0.06, 0.7 if st == "normal" else 0.9), Color(AMBER, 0.3 if st == "normal" else 0.8), 0, 6, 0.0)
		sb.content_margin_left = 8
		sb.content_margin_right = 8
		b.add_theme_stylebox_override(st, sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("icon_normal_color", INK)
	b.add_theme_color_override("icon_hover_color", AMBER)
	b.button_down.connect(func() -> void: Sfx.play("ui_click", -6.0))
	return b


# ------------------------------------------------------------------ canvas helpers

## Parallelogram (skewed rect) for bars and plates drawn in _draw().
static func para(ci: CanvasItem, r: Rect2, skew: float, col: Color) -> void:
	var o := r.size.y * skew
	var pts := PackedVector2Array([r.position + Vector2(o, 0), r.position + Vector2(r.size.x + o, 0),
		r.position + Vector2(r.size.x, r.size.y), r.position + Vector2(0, r.size.y)])
	ci.draw_colored_polygon(pts, col)


## Icon with a soft dark halo so it reads on any background.
static func draw_icon(ci: CanvasItem, name: String, c: Vector2, size: float, col := Color.WHITE, rot := 0.0, halo := true) -> void:
	var tex := icon(name)
	ci.draw_set_transform(c, rot, Vector2.ONE)
	if halo:
		for o in [Vector2(1.5, 1.5), Vector2(-1, 1.5)]:
			ci.draw_texture_rect(tex, Rect2(-Vector2.ONE * size * 0.5 + o, Vector2.ONE * size), false, Color(0, 0, 0, col.a * 0.55))
	ci.draw_texture_rect(tex, Rect2(-Vector2.ONE * size * 0.5, Vector2.ONE * size), false, col)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


static func text(ci: CanvasItem, p: Vector2, s: String, size: float, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, kind := "bold") -> void:
	var f := font(kind)
	var pos := p
	var w := -1.0
	if align != HORIZONTAL_ALIGNMENT_LEFT:
		w = 1200.0
		pos.x -= w * (0.5 if align == HORIZONTAL_ALIGNMENT_CENTER else 1.0)
	ci.draw_string(f, pos + Vector2(0, 2), s, align, w, int(size), Color(0, 0, 0, col.a * 0.6))
	ci.draw_string(f, pos, s, align, w, int(size), col)


static func text_width(s: String, size: float, kind := "bold") -> float:
	return font(kind).get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, int(size)).x


## Five-point star (filled or outline) for mission ratings.
static func star(ci: CanvasItem, c: Vector2, r: float, filled: bool, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 10:
		var a := -PI / 2 + i * PI / 5
		var rr := r if i % 2 == 0 else r * 0.45
		pts.append(c + Vector2(cos(a), sin(a)) * rr)
	if filled:
		ci.draw_colored_polygon(pts, col)
	else:
		pts.append(pts[0])
		ci.draw_polyline(pts, col, maxf(1.5, r * 0.12), true)
