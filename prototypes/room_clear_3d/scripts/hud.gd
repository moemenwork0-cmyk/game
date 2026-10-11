class_name Hud
extends CanvasLayer
## HUD, touch controls and the start / end screens. Dynamic parts (bars, markers, stick,
## buttons) are drawn by one overlay Control; screens are regular Controls with tweens.

signal play_pressed
signal restart_pressed

const AMBER := Color(0.85, 0.65, 0.18)
const RED := Color(0.88, 0.28, 0.23)
const GREEN := Color(0.62, 0.83, 0.42)
const INK := Color(0.91, 0.93, 0.87)
const PANEL := Color(0.05, 0.06, 0.05, 0.72)

var player: Player
var enemy: Enemy
var cam: Camera3D
var playing := false

var font: Font
var font_mid: Font
var icons := {}
var overlay: Control
var vignette: ColorRect
var start_screen: Control
var end_screen: Control
var fade: ColorRect

# touch state
var stick_id := -1
var stick_base := Vector2.ZERO
var stick_knob := Vector2.ZERO
var stick_home := Vector2.ZERO
var stick_r := 70.0
var fire_ids := {}
var fire_c := Vector2.ZERO
var fire_r := 60.0
var reload_c := Vector2.ZERO
var reload_r := 36.0
var mouse_fire := false
var touch_seen := false

# feedback
var banner_t := 0.0
var hit_t := 0.0
var hit_head := false
var dmg_marks: Array = []        # [angle, t]
var alert_txt := ""
var alert_t := 0.0
var hurt_k := 0.0
var _t := 0.0
var _u := 1.0


func _ready() -> void:
	layer = 10
	font = load("res://assets/fonts/Rajdhani-Bold.ttf")
	font_mid = load("res://assets/fonts/Rajdhani-SemiBold.ttf")
	for k in ["heart", "bullet", "target", "crosshair", "reload", "chevron", "arrow", "shield_ok", "shield_fail", "skull", "play"]:
		icons[k] = load("res://assets/ui/%s.svg" % k)
	var th := Theme.new()
	th.default_font = font
	th.default_font_size = 22
	var root := Control.new()
	root.theme = th
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	vignette = ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = load("res://scripts/vignette.gdshader")
	vignette.material = sm
	root.add_child(vignette)
	overlay = Control.new()
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.draw.connect(_draw_overlay)
	root.add_child(overlay)
	_build_start(root)
	_build_end(root)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade)
	create_tween().tween_property(fade, "color:a", 0.0, 0.9)


func _layout() -> void:
	var s := overlay.size
	_u = clampf(minf(s.y / 720.0, s.x / 1280.0) * 1.25, 0.75, 1.6)
	stick_r = 74.0 * _u
	stick_home = Vector2(stick_r + 70.0 * _u, s.y - stick_r - 54.0 * _u)
	fire_r = 66.0 * _u
	fire_c = Vector2(s.x - fire_r - 64.0 * _u, s.y - fire_r - 60.0 * _u)
	reload_r = 40.0 * _u
	reload_c = fire_c + Vector2(-fire_r - 58.0 * _u, fire_r * 0.45)
	if stick_id < 0:
		stick_base = stick_home
		stick_knob = stick_home


func _process(delta: float) -> void:
	_t += delta
	var rd := delta / maxf(Engine.time_scale, 0.05)
	banner_t = maxf(banner_t - rd, 0.0)
	hit_t = maxf(hit_t - rd, 0.0)
	alert_t = maxf(alert_t - rd, 0.0)
	hurt_k = maxf(hurt_k - rd * 1.4, 0.0)
	for m in dmg_marks:
		m[1] -= rd
	dmg_marks = dmg_marks.filter(func(m: Array) -> bool: return m[1] > 0.0)
	_layout()
	if player:
		var low := clampf((40.0 - player.hp) / 40.0, 0.0, 1.0) if player.alive else 0.0
		(vignette.material as ShaderMaterial).set_shader_parameter("hurt", hurt_k)
		(vignette.material as ShaderMaterial).set_shader_parameter("low", low)
		if playing:
			var mv := Vector2.ZERO
			if stick_id >= 0:
				var d := stick_knob - stick_base
				mv = d / stick_r
				if mv.length() < 0.12:
					mv = Vector2.ZERO
			player.input_move = mv
			player.fire_held = fire_ids.size() > 0 or mouse_fire or Input.is_key_pressed(KEY_SPACE)
		else:
			player.input_move = Vector2.ZERO
			player.fire_held = false
	overlay.queue_redraw()


# ------------------------------------------------------------------ input

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		touch_seen = true
		var e := event as InputEventScreenTouch
		if e.pressed:
			if not playing:
				return
			if e.position.distance_to(reload_c) < reload_r * 1.35:
				if player:
					player.start_reload()
				Sfx.play("click", -6.0)
				return
			if e.position.x > overlay.size.x * 0.48:
				fire_ids[e.index] = true
				return
			if stick_id < 0:
				stick_id = e.index
				stick_base = Vector2(clampf(e.position.x, stick_r + 16, overlay.size.x * 0.45 - stick_r), clampf(e.position.y, stick_r + 120 * _u, overlay.size.y - stick_r - 10))
				_drag(e.position)
		else:
			fire_ids.erase(e.index)
			if e.index == stick_id:
				stick_id = -1
				stick_base = stick_home
				stick_knob = stick_home
	elif event is InputEventScreenDrag:
		var e := event as InputEventScreenDrag
		if e.index == stick_id:
			_drag(e.position)
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION:
		var e := event as InputEventMouseButton
		if e.button_index == MOUSE_BUTTON_LEFT and playing:
			mouse_fire = e.pressed and not _over_screen_button(e.position)
			if player:
				player.mouse_aim = true
	elif event is InputEventMouseMotion and event.device != InputEvent.DEVICE_ID_EMULATION and not touch_seen:
		if player and playing:
			player.mouse_aim = true
			_update_mouse_point((event as InputEventMouseMotion).position)
	elif event is InputEventKey and event.pressed and not event.echo:
		var k := (event as InputEventKey).keycode
		if k == KEY_R and player and playing:
			player.start_reload()
		if k in [KEY_W, KEY_A, KEY_S, KEY_D] and player:
			pass


func _over_screen_button(_p: Vector2) -> bool:
	return false


func _update_mouse_point(p: Vector2) -> void:
	if cam == null:
		return
	var o := cam.project_ray_origin(p)
	var d := cam.project_ray_normal(p)
	if absf(d.y) < 0.001:
		return
	var t := (1.2 - o.y) / d.y
	player.mouse_point = o + d * t


func _physics_process(_d: float) -> void:
	if player and player.mouse_aim and playing and not touch_seen:
		_update_mouse_point(overlay.get_local_mouse_position())


func _drag(p: Vector2) -> void:
	var d := p - stick_base
	if d.length() > stick_r:
		stick_base += d.normalized() * (d.length() - stick_r)
		d = p - stick_base
	stick_knob = stick_base + d


func release_all() -> void:
	fire_ids.clear()
	stick_id = -1
	stick_base = stick_home
	stick_knob = stick_home
	mouse_fire = false


# ------------------------------------------------------------------ events from the game

func show_banner() -> void:
	banner_t = 3.0


func on_hit_enemy(head: bool) -> void:
	hit_t = 0.22
	hit_head = head


func on_player_hurt(from: Vector3) -> void:
	hurt_k = minf(hurt_k + 0.55, 1.0)
	if player and cam:
		var a := cam.unproject_position(player.global_position + Vector3(0, 1.2, 0))
		var b := cam.unproject_position(from + Vector3(0, 1.2, 0))
		dmg_marks.append([(b - a).angle(), 1.2])


func on_alert(kind: String) -> void:
	alert_txt = kind
	alert_t = 2.2


# ------------------------------------------------------------------ drawing

func _txt(p: Vector2, s: String, size: float, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, f: Font = null, width := -1.0) -> void:
	var fo := f if f else font
	var w := width
	var pos := p
	if align != HORIZONTAL_ALIGNMENT_LEFT and w < 0:
		w = 800.0
		pos.x -= w * (0.5 if align == HORIZONTAL_ALIGNMENT_CENTER else 1.0)
	overlay.draw_string(fo, pos + Vector2(1.5, 2), s, align, w, int(size), Color(0, 0, 0, col.a * 0.6))
	overlay.draw_string(fo, pos, s, align, w, int(size), col)


func _icon(k: String, c: Vector2, size: float, mod := Color.WHITE, rot := 0.0) -> void:
	var tex: Texture2D = icons[k]
	if rot != 0.0:
		overlay.draw_set_transform(c, rot, Vector2.ONE)
		overlay.draw_texture_rect(tex, Rect2(-Vector2.ONE * size * 0.5, Vector2.ONE * size), false, mod)
		overlay.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	else:
		overlay.draw_texture_rect(tex, Rect2(c - Vector2.ONE * size * 0.5, Vector2.ONE * size), false, mod)


func _panel(r: Rect2, accent := AMBER) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = PANEL
	sb.set_corner_radius_all(int(8 * _u))
	sb.border_color = Color(accent, 0.35)
	sb.set_border_width_all(1)
	sb.border_width_left = int(4 * _u)
	overlay.draw_style_box(sb, r)


func _draw_overlay() -> void:
	if player == null:
		return
	var u := _u
	var s := overlay.size
	if not playing and start_screen.visible:
		return
	# damage direction arcs
	if player.alive and cam:
		var pc := cam.unproject_position(player.global_position + Vector3(0, 1.2, 0))
		for m in dmg_marks:
			var a: float = m[0]
			var k: float = clampf(m[1] / 1.2, 0.0, 1.0)
			overlay.draw_arc(pc, 120.0 * u, a - 0.45, a + 0.45, 24, Color(1, 0.15, 0.1, k * 0.85), 10.0 * u, true)
	_draw_target(u, s)
	if not playing and not end_screen.visible:
		return
	# --- health panel
	var x := 20.0 * u
	var y := 16.0 * u
	_panel(Rect2(x, y, 300 * u, 100 * u))
	var beat := 1.0 + (0.12 * maxf(sin(_t * 9.0), 0.0) if player.hp < 35 and player.alive else 0.0)
	_icon("heart", Vector2(x + 34 * u, y + 30 * u), 38 * u * beat)
	var bx := x + 64 * u
	var bw := 170 * u
	var hp_k := clampf(player.hp / player.max_hp, 0.0, 1.0)
	var col := GREEN if hp_k > 0.5 else (AMBER if hp_k > 0.25 else RED)
	var segs := 10
	for i in segs:
		var sx := bx + i * bw / segs
		var on := float(i + 1) / segs <= hp_k + 0.049
		overlay.draw_rect(Rect2(sx, y + 22 * u, bw / segs - 3 * u, 16 * u), col if on else Color(1, 1, 1, 0.08))
	_txt(Vector2(x + 290 * u, y + 40 * u), str(int(ceil(player.hp))), 30 * u, INK, HORIZONTAL_ALIGNMENT_RIGHT)
	# --- ammo
	_icon("bullet", Vector2(x + 34 * u, y + 72 * u), 36 * u)
	if player.is_reloading():
		overlay.draw_rect(Rect2(bx, y + 64 * u, bw, 14 * u), Color(1, 1, 1, 0.08))
		overlay.draw_rect(Rect2(bx, y + 64 * u, bw * player.reload_progress(), 14 * u), AMBER)
		_txt(Vector2(bx, y + 95 * u), "RELOADING", 15 * u, AMBER, HORIZONTAL_ALIGNMENT_LEFT, font_mid)
	else:
		var pw := bw / player.mag_size
		for i in player.mag_size:
			var c := INK if i < player.ammo else Color(1, 1, 1, 0.09)
			if i < player.ammo and player.ammo <= 8:
				c = AMBER
			overlay.draw_rect(Rect2(bx + i * pw, y + 62 * u, maxf(pw - 2.0 * u, 1.0), 20 * u), c)
	_txt(Vector2(x + 290 * u, y + 84 * u), str(player.ammo), 30 * u, RED if player.ammo == 0 else INK, HORIZONTAL_ALIGNMENT_RIGHT)
	# --- objective chip
	var label := "ELIMINATE THE TARGET" if enemy and enemy.alive else "TARGET ELIMINATED"
	var tw := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, int(24 * u)).x
	var cw := tw + 80 * u
	var cr := Rect2(s.x * 0.5 - cw * 0.5, 16 * u, cw, 50 * u)
	_panel(cr, GREEN if enemy and not enemy.alive else AMBER)
	_icon("target", Vector2(cr.position.x + 30 * u, cr.position.y + 25 * u), 32 * u)
	_txt(Vector2(cr.position.x + 56 * u, cr.position.y + 34 * u), label, 24 * u, GREEN if enemy and not enemy.alive else INK)
	if player.ammo == 0 and not player.is_reloading() and player.alive:
		_txt(Vector2(s.x * 0.5, s.y - 40 * u), "NO AMMO  —  RELOAD", 26 * u, Color(RED, 0.6 + 0.4 * sin(_t * 9.0)), HORIZONTAL_ALIGNMENT_CENTER)
	elif player.ammo <= 6 and not player.is_reloading() and player.alive:
		_txt(Vector2(s.x * 0.5, s.y - 40 * u), "LOW AMMO", 22 * u, Color(AMBER, 0.85), HORIZONTAL_ALIGNMENT_CENTER)
	if playing:
		_draw_controls(u)
	if banner_t > 0.0:
		_draw_banner(u, s)


func _draw_target(u: float, s: Vector2) -> void:
	if enemy == null or cam == null or not enemy.alive:
		return
	var wp := enemy.head_pos() + Vector3(0, 0.55, 0)
	var behind := cam.is_position_behind(wp)
	var sp := cam.unproject_position(wp)
	var m := 50.0 * u
	var on := not behind and sp.x > m and sp.x < s.x - m and sp.y > 90 * u and sp.y < s.y - m
	if on:
		var bob := sin(_t * 4.0) * 4.0 * u
		_icon("chevron", sp + Vector2(0, bob), 34 * u)
		var bw := 64 * u
		var by := sp.y - 30 * u + bob
		overlay.draw_rect(Rect2(sp.x - bw * 0.5 - 1, by - 1, bw + 2, 7 * u + 2), Color(0, 0, 0, 0.6))
		overlay.draw_rect(Rect2(sp.x - bw * 0.5, by, bw * enemy.hp / enemy.max_hp, 7 * u), RED)
		_txt(Vector2(sp.x, by - 6 * u), "TARGET", 16 * u, Color(1, 0.82, 0.78), HORIZONTAL_ALIGNMENT_CENTER)
		if alert_t > 0.0:
			var a := clampf(alert_t, 0.0, 1.0)
			var big := 1.0 + maxf(0.0, alert_t - 1.9) * 2.0
			_txt(Vector2(sp.x + 34 * u, by + 10 * u), alert_txt, 40 * u * big, Color(RED if alert_txt == "!" else AMBER, a))
		if hit_t > 0.0:
			var c := cam.unproject_position(enemy.chest_pos())
			var hc := Color(1, 0.25, 0.2) if hit_head else Color(1, 1, 1)
			hc.a = hit_t / 0.22
			var g := 9 * u
			var l := 20 * u
			for d in [Vector2(1, 1), Vector2(1, -1), Vector2(-1, 1), Vector2(-1, -1)]:
				overlay.draw_line(c + d * g, c + d * l, hc, 3.0 * u, true)
			if hit_head:
				_txt(c + Vector2(0, -40 * u), "HEADSHOT", 22 * u, hc, HORIZONTAL_ALIGNMENT_CENTER)
	else:
		var center := s * 0.5
		var dir := (sp - center)
		if behind:
			dir = -dir
		var ang := dir.angle()
		var e := Vector2(clampf(center.x + cos(ang) * s.x, m, s.x - m), clampf(center.y + sin(ang) * s.y, 100 * u, s.y - m))
		overlay.draw_circle(e, 26 * u, Color(0.05, 0.06, 0.05, 0.75))
		_icon("target", e, 34 * u, Color(1, 0.55, 0.5))
		_icon("arrow", e + Vector2(cos(ang), sin(ang)) * 38 * u, 28 * u, Color.WHITE, ang)
		var dist := enemy.global_position.distance_to(player.global_position)
		_txt(e + Vector2(0, 48 * u), "%dm" % int(dist), 18 * u, Color(1, 0.82, 0.78), HORIZONTAL_ALIGNMENT_CENTER)


func _draw_controls(u: float) -> void:
	if touch_seen or OS.has_feature("mobile") or OS.has_feature("web") or true:
		# stick
		var act := stick_id >= 0
		overlay.draw_circle(stick_base, stick_r, Color(0.05, 0.07, 0.05, 0.35 if act else 0.22))
		overlay.draw_arc(stick_base, stick_r, 0, TAU, 48, Color(INK, 0.4 if act else 0.25), 3.0 * u, true)
		for i in 4:
			var a := i * PI / 2
			var p := stick_base + Vector2(cos(a), sin(a)) * stick_r * 0.78
			_icon("arrow", p, 18 * u, Color(INK, 0.35), a)
		overlay.draw_circle(stick_knob + Vector2(2, 4), stick_r * 0.42, Color(0, 0, 0, 0.3))
		overlay.draw_circle(stick_knob, stick_r * 0.42, Color(0.85, 0.88, 0.82, 0.75 if act else 0.5))
		overlay.draw_circle(stick_knob - Vector2(stick_r * 0.1, stick_r * 0.12), stick_r * 0.16, Color(1, 1, 1, 0.3))
		# fire
		var held := fire_ids.size() > 0 or mouse_fire
		var fr := fire_r * (0.93 if held else 1.0)
		overlay.draw_circle(fire_c, fr, Color(0.75, 0.16, 0.12, 0.78 if held else 0.55))
		overlay.draw_arc(fire_c, fr, 0, TAU, 56, Color(1, 0.65, 0.55, 0.8), 3.0 * u, true)
		if held:
			overlay.draw_arc(fire_c, fr + 8 * u + sin(_t * 30.0) * 2.0 * u, 0, TAU, 56, Color(1, 0.5, 0.4, 0.35), 3.0 * u, true)
		_icon("crosshair", fire_c - Vector2(0, 6 * u), fr * 1.05)
		_txt(Vector2(fire_c.x, fire_c.y + fr * 0.78), "FIRE", 17 * u, Color(1, 0.9, 0.86), HORIZONTAL_ALIGNMENT_CENTER)
		# reload
		overlay.draw_circle(reload_c, reload_r, Color(0.05, 0.07, 0.05, 0.6))
		var rc := Color(RED, 0.95) if player.ammo == 0 else Color(INK, 0.45)
		overlay.draw_arc(reload_c, reload_r, 0, TAU, 40, rc, 3.0 * u, true)
		if player.is_reloading():
			overlay.draw_arc(reload_c, reload_r - 2 * u, -PI / 2, -PI / 2 + TAU * player.reload_progress(), 40, AMBER, 5.0 * u, true)
		_icon("reload", reload_c, reload_r * 1.25, Color(INK, 0.95))


func _draw_banner(u: float, s: Vector2) -> void:
	var k := clampf(minf((3.0 - banner_t) / 0.35, banner_t / 0.5), 0.0, 1.0)
	var e := 1.0 - pow(1.0 - k, 3.0)
	var w := 560 * u
	var h := 104 * u
	var r := Rect2(s.x * 0.5 - w * 0.5 + (1.0 - e) * 120 * u, s.y * 0.34 - h * 0.5, w, h)
	overlay.draw_rect(r, Color(0.04, 0.05, 0.04, 0.86 * e))
	overlay.draw_rect(Rect2(r.position, Vector2(w * e, 4 * u)), Color(AMBER, e))
	overlay.draw_rect(Rect2(r.position + Vector2(0, h - 4 * u), Vector2(w * e, 4 * u)), Color(AMBER, e))
	_icon("target", r.position + Vector2(58 * u, h * 0.5), 64 * u, Color(1, 1, 1, e))
	_txt(r.position + Vector2(108 * u, h * 0.5 - 12 * u), "NEW OBJECTIVE", 20 * u, Color(AMBER, e), HORIZONTAL_ALIGNMENT_LEFT, font_mid)
	_txt(r.position + Vector2(106 * u, h * 0.5 + 26 * u), "ELIMINATE THE TARGET", 40 * u, Color(INK, e))


# ------------------------------------------------------------------ screens

func _label(text: String, size: int, col: Color, f: Font = null) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_y", 3)
	if f:
		l.add_theme_font_override("font", f)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


func _button(text: String, icon_key: String) -> Button:
	var b := Button.new()
	b.text = "  " + text
	b.icon = icons[icon_key]
	b.expand_icon = true
	b.add_theme_font_size_override("font_size", 34)
	b.add_theme_constant_override("icon_max_width", 30)
	for st in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = AMBER.lightened(0.12 if st == "hover" else 0.0).darkened(0.15 if st == "pressed" else 0.0)
		sb.set_corner_radius_all(8)
		sb.content_margin_left = 54
		sb.content_margin_right = 60
		sb.content_margin_top = 12
		sb.content_margin_bottom = 12
		sb.shadow_color = Color(0, 0, 0, 0.5)
		sb.shadow_size = 10
		sb.shadow_offset = Vector2(0, 5)
		if st == "focus":
			sb.draw_center = false
			sb.shadow_size = 0
		b.add_theme_stylebox_override(st, sb)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, Color(0.07, 0.08, 0.06))
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.pivot_offset = Vector2(150, 30)
	return b


func _screen_base(root: Control) -> Control:
	var scr := Control.new()
	scr.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(scr)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://scripts/screen_bg.gdshader")
	bg.material = sm
	scr.add_child(bg)
	return scr


func _build_start(root: Control) -> void:
	start_screen = _screen_base(root)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 14)
	start_screen.add_child(box)
	box.add_child(_label("OPERATION NIGHTFALL   ·   SINGLE TARGET", 22, AMBER, font_mid))
	var title := _label("ROOM CLEAR", 112, INK)
	title.add_theme_constant_override("shadow_offset_y", 6)
	box.add_child(title)
	# objective card
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.07, 0.06, 0.85)
	sb.border_color = Color(AMBER, 0.6)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 26
	sb.content_margin_right = 30
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	card.add_theme_stylebox_override("panel", sb)
	card.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 20)
	card.add_child(hb)
	var ic := TextureRect.new()
	ic.texture = icons["target"]
	ic.custom_minimum_size = Vector2(64, 64)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	hb.add_child(ic)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 0)
	hb.add_child(vb)
	var l1 := _label("OBJECTIVE", 18, AMBER, font_mid)
	l1.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	vb.add_child(l1)
	var l2 := _label("ELIMINATE THE TARGET", 38, INK)
	l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	vb.add_child(l2)
	var l3 := _label("A hostile officer is holed up in a two-room safehouse. He will fight from cover.", 18, Color(0.7, 0.73, 0.66), font_mid)
	l3.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	vb.add_child(l3)
	box.add_child(card)
	box.add_child(_label("LEFT THUMB  move + aim      ·      RIGHT THUMB  fire      ·      ↻  reload", 18, Color(0.62, 0.65, 0.58), font_mid))
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 8)
	box.add_child(sp)
	var play := _button("PLAY", "play")
	play.pressed.connect(func() -> void:
		Sfx.play("click")
		play_pressed.emit())
	box.add_child(play)
	var t := play.create_tween().set_loops()
	t.tween_property(play, "scale", Vector2(1.05, 1.05), 0.7).set_trans(Tween.TRANS_SINE)
	t.tween_property(play, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_SINE)


func _build_end(root: Control) -> void:
	end_screen = _screen_base(root)
	end_screen.visible = false


func hide_start() -> void:
	var t := create_tween()
	t.tween_property(start_screen, "modulate:a", 0.0, 0.45)
	t.tween_callback(func() -> void: start_screen.visible = false)


func show_end(win: bool, stats: Dictionary) -> void:
	playing = false
	release_all()
	for c in end_screen.get_children():
		if c is VBoxContainer:
			c.queue_free()
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 12)
	end_screen.add_child(box)
	var ic := TextureRect.new()
	ic.texture = icons["shield_ok" if win else "shield_fail"]
	ic.custom_minimum_size = Vector2(110, 110)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	box.add_child(ic)
	box.add_child(_label("TARGET ELIMINATED" if win else "KILLED IN ACTION", 24, AMBER, font_mid))
	box.add_child(_label("MISSION COMPLETE" if win else "MISSION FAILED", 96, GREEN if win else RED))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 56)
	for k in stats:
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", -6)
		v.add_child(_label(str(stats[k]), 44, INK))
		v.add_child(_label(k, 18, Color(0.66, 0.69, 0.62), font_mid))
		row.add_child(v)
	box.add_child(row)
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 10)
	box.add_child(sp)
	var b := _button("RESTART", "reload")
	b.pressed.connect(func() -> void:
		Sfx.play("click")
		restart_pressed.emit())
	box.add_child(b)
	end_screen.visible = true
	end_screen.modulate.a = 0.0
	box.scale = Vector2(0.92, 0.92)
	var t := create_tween().set_parallel()
	t.tween_property(end_screen, "modulate:a", 1.0, 0.6)
	t.tween_property(box, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	box.pivot_offset = box.size * 0.5


func fade_out(dur: float) -> void:
	create_tween().tween_property(fade, "color:a", 1.0, dur)
