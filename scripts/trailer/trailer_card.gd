class_name TrailerCard
extends TrailerShot
## A text card on black: lines fade up with a slow push, a soft glow and drifting dust,
## then fade away. Arabic is shaped by Godot's advanced text server.

var lines: Array = []          # [text, font path, size, colour]
var fade_in := 0.7
var fade_out := 0.5
var _root: Control
var _labels: Array[Label] = []


func setup_card(tr: Trailer) -> void:
	tr.cam.environment = _black_env()
	var cl := CanvasLayer.new()
	cl.layer = 10
	add_child(cl)
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cl.add_child(bg)
	_root = VBoxContainer.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	(_root as VBoxContainer).alignment = BoxContainer.ALIGNMENT_CENTER
	(_root as VBoxContainer).add_theme_constant_override("separation", 18)
	cl.add_child(_root)
	var vh := float(get_viewport().get_visible_rect().size.y)
	for l in lines:
		var lb := Label.new()
		lb.text = l[0]
		lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		if String(l[0]).unicode_at(String(l[0]).length() - 1) >= 0x0600 or String(l[0]).contains("ا"):
			lb.text_direction = Control.TEXT_DIRECTION_RTL
		var f := FontVariation.new()
		f.base_font = load(l[1])
		lb.add_theme_font_override("font", f)
		lb.add_theme_font_size_override("font_size", int(float(l[2]) * vh / 1080.0))
		lb.add_theme_color_override("font_color", l[3] if l.size() > 3 else Color(0.93, 0.89, 0.8))
		lb.add_theme_color_override("font_shadow_color", Color(1.0, 0.75, 0.45, 0.25))
		lb.add_theme_constant_override("shadow_outline_size", int(18 * vh / 1080.0))
		lb.add_theme_constant_override("shadow_offset_x", 0)
		lb.add_theme_constant_override("shadow_offset_y", 0)
		_root.add_child(lb)
		_labels.append(lb)


func _black_env() -> Environment:
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color.BLACK
	return e


func tick(time: float, _dt: float) -> void:
	if _root == null:
		return
	for i in _labels.size():
		var t0 := i * 0.35
		var a := smoothstep(t0, t0 + fade_in, time) * (1.0 - smoothstep(duration - fade_out, duration, time))
		_labels[i].modulate.a = a
	var vs := get_viewport().get_visible_rect().size
	_root.pivot_offset = vs * 0.5
	var s := 1.0 + 0.05 * time / duration
	_root.scale = Vector2(s, s)
