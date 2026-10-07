class_name LoadingScreen
extends Control
## The first thing anyone sees: a full-bleed cinematic cover with a slow push-in,
## the logo, the current loading stage, a precise progress line, rotating tips
## and film grain.

const TIPS := [
	"Every new game rolls a different survivor and a different truth.",
	"Coconuts hold both food and water — your first days depend on them.",
	"Fire keeps more than the cold away. Your mind needs it at night.",
	"Your choices are written in your journal — and they are remembered.",
	"Everything has real weight. Logs float. Stones sink.",
	"Raw fish can make you sick. Cook it on a campfire first.",
	"Buildings need support. Remove a post and watch what happens.",
	"When your mind breaks, the island starts to show you things.",
]

var progress := 0.0
var _shown := 0.0
var _stage := ""
var _cover: TextureRect
var _stage_l: Label
var _pct: Label
var _tip_l: Label
var _tip_i := 0
var _tip_t := 0.0
var _t := 0.0
var _bar: Control
var _spin: Control


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = UiKit.INK
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	_cover = TextureRect.new()
	if ResourceLoader.exists("res://assets/ui/cover.jpg"):
		_cover.texture = load("res://assets/ui/cover.jpg")
	_cover.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_cover.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_cover.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_cover.modulate.a = 0.0
	add_child(_cover)
	_cover.create_tween().tween_property(_cover, "modulate:a", 1.0, 1.6)
	add_child(_gradient(Vector2(0.5, 1.0), Vector2(0.5, 0.35), Color(0.01, 0.015, 0.025, 0.96)))
	add_child(_gradient(Vector2(0.0, 0.5), Vector2(0.55, 0.5), Color(0.01, 0.015, 0.025, 0.7)))
	add_child(_grain())

	# logo, bottom-left
	var logo := VBoxContainer.new()
	logo.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	logo.offset_left = 90
	logo.offset_top = -330
	logo.offset_bottom = -140
	logo.offset_right = 900
	logo.add_theme_constant_override("separation", -8)
	add_child(logo)
	var tf := FontVariation.new()
	tf.base_font = UiKit.display_font(500)
	tf.spacing_glyph = 22
	var title := UiKit.label("JAZIRA", 92, UiKit.SALT)
	title.add_theme_font_override("font", tf)
	logo.add_child(title)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 18)
	logo.add_child(hb)
	var cal := UiKit.label("جزيرة", 48, UiKit.ACCENT)
	cal.add_theme_font_override("font", UiKit.calligraphy_font())
	hb.add_child(cal)
	var tag := UiKit.label(tr("One island. Every story is yours alone."), 22, UiKit.MUTED)
	tag.add_theme_font_override("font", UiKit.story_font(500))
	tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hb.add_child(tag)

	# tip, bottom-right
	var tipbox := VBoxContainer.new()
	tipbox.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	tipbox.offset_left = -560
	tipbox.offset_right = -90
	tipbox.offset_top = -230
	tipbox.offset_bottom = -110
	tipbox.alignment = BoxContainer.ALIGNMENT_END
	add_child(tipbox)
	var tl := UiKit.label(tr("TIP"), 15, UiKit.ACCENT)
	tl.add_theme_font_override("font", UiKit.display_font(700))
	tipbox.add_child(tl)
	_tip_l = UiKit.label("", 21, Color(1, 1, 1, 0.82))
	_tip_l.add_theme_font_override("font", UiKit.story_font(500))
	_tip_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tipbox.add_child(_tip_l)
	_tip_i = randi() % TIPS.size()
	_tip_l.text = tr(TIPS[_tip_i])

	# stage + percentage + the progress line
	_spin = Control.new()
	_spin.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_spin.offset_left = 90
	_spin.offset_top = -86
	_spin.offset_right = 112
	_spin.offset_bottom = -64
	_spin.draw.connect(_draw_spin)
	add_child(_spin)
	_stage_l = UiKit.label("", 16, Color(1, 1, 1, 0.75))
	_stage_l.add_theme_font_override("font", UiKit.display_font(600))
	_stage_l.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	_stage_l.offset_left = 124
	_stage_l.offset_top = -88
	_stage_l.offset_right = 900
	_stage_l.offset_bottom = -62
	add_child(_stage_l)
	_pct = UiKit.label("0%", 16, UiKit.ACCENT)
	_pct.add_theme_font_override("font", UiKit.display_font(600))
	_pct.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_pct.offset_left = -300
	_pct.offset_right = -90
	_pct.offset_top = -88
	_pct.offset_bottom = -62
	_pct.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_pct)
	_bar = Control.new()
	_bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_bar.offset_left = 90
	_bar.offset_right = -90
	_bar.offset_top = -52
	_bar.offset_bottom = -46
	_bar.draw.connect(_draw_bar)
	add_child(_bar)


func _gradient(from: Vector2, to: Vector2, c: Color) -> TextureRect:
	var g := Gradient.new()
	g.colors = PackedColorArray([c, Color(c.r, c.g, c.b, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = from
	gt.fill_to = to
	var tr_ := TextureRect.new()
	tr_.texture = gt
	tr_.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tr_.stretch_mode = TextureRect.STRETCH_SCALE
	tr_.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return tr_


func _grain() -> ColorRect:
	var r := ColorRect.new()
	r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type canvas_item;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void fragment() {
	float n = h(floor(FRAGCOORD.xy / 1.5) + fract(TIME * 7.13) * 91.7) - 0.5;
	float v = smoothstep(0.5, 1.1, length((UV - 0.5) * vec2(1.3, 1.0)) * 1.3) * 0.5;
	// grain over a darkening vignette, composited correctly ("over" operator)
	float ga = abs(n) * 0.06;
	float a = ga + v - ga * v;
	vec3 c = vec3(step(0.0, n)) * ga * (1.0 - v);
	COLOR = vec4(a > 0.0 ? c / a : vec3(0.0), a);
}"""
	m.shader = sh
	r.material = m
	return r


func set_progress(p: float, stage: String) -> void:
	progress = maxf(progress, p)
	_stage = stage


func _process(delta: float) -> void:
	_t += delta
	_shown = move_toward(_shown, progress, delta * maxf(0.6, (progress - _shown) * 4.0))
	_pct.text = "%d%%" % int(round(_shown * 100.0))
	_stage_l.text = tr(_stage).to_upper() if _stage != "" else tr("LOADING")
	# slow push-in on the cover, like the opening of a film
	var z := 1.0 + minf(_t / 40.0, 1.0) * 0.08
	_cover.pivot_offset = _cover.size * Vector2(0.62, 0.45)
	_cover.scale = Vector2(z, z)
	_tip_t += delta
	if _tip_t > 6.5:
		_tip_t = 0.0
		_tip_i = (_tip_i + 1) % TIPS.size()
		var tw := _tip_l.create_tween()
		tw.tween_property(_tip_l, "modulate:a", 0.0, 0.4)
		tw.tween_callback(func() -> void: _tip_l.text = tr(TIPS[_tip_i]))
		tw.tween_property(_tip_l, "modulate:a", 1.0, 0.6)
	_bar.queue_redraw()
	_spin.queue_redraw()


func _draw_bar() -> void:
	var w := _bar.size.x
	_bar.draw_rect(Rect2(0, 2, w, 1), Color(1, 1, 1, 0.16))
	var x := w * _shown
	_bar.draw_rect(Rect2(0, 1.5, x, 2), UiKit.ACCENT)
	# a glowing head on the line
	for i in 6:
		_bar.draw_circle(Vector2(x, 2.5), 7.0 - i, Color(1.0, 0.8, 0.5, 0.05 + i * 0.03))
	_bar.draw_circle(Vector2(x, 2.5), 2.0, Color(1, 0.95, 0.85))
	# quarter ticks
	for k in range(1, 4):
		_bar.draw_rect(Rect2(w * k / 4.0, -2, 1, 9), Color(1, 1, 1, 0.25))


func _draw_spin() -> void:
	# a compass rose turning slowly
	var c := _spin.size * 0.5
	var a := _t * 1.4
	_spin.draw_arc(c, 10, 0, TAU, 32, UiKit.ACCENT_DIM, 1.0, true)
	for i in 4:
		var d := Vector2.from_angle(a + i * PI / 2)
		var n := Vector2(-d.y, d.x)
		var col := UiKit.ACCENT if i == 0 else Color(1, 1, 1, 0.5)
		_spin.draw_colored_polygon(PackedVector2Array([c + d * 10, c + n * 2.5, c - n * 2.5]), col)
