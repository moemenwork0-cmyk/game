class_name Hud
extends CanvasLayer
## In-mission HUD: operator health card, objective tracker, live radar, score + kill feed,
## world markers, floating score popups, twin-stick touch controls with reload / grenade /
## dash buttons, pause menu and the end-of-mission debrief (stars, score tally, XP, unlocks).

const K = preload("res://scripts/ui_kit.gd")

var mission: Mission
var player: Player
var cam: Camera3D
var playing := true

var overlay: Control
var vignette: ColorRect
var fade: ColorRect
var pause_layer: Control
var end_layer: Control
var root: Control

# touch state
var move_id := -1
var move_base := Vector2.ZERO
var move_knob := Vector2.ZERO
var move_home := Vector2.ZERO
var aim_id := -1
var aim_base := Vector2.ZERO
var aim_knob := Vector2.ZERO
var aim_home := Vector2.ZERO
var stick_r := 70.0
var look_id := -1             # touch turning the view (right half, or the fire button)
var look_last := Vector2.ZERO
const LOOK_SENS := 3.2        # radians per screen-height of drag
var btn := {}                 # name -> [center, radius]
var mouse_fire := false
var touch_seen := false

# feedback
var hurt_k := 0.0
var dmg_marks: Array = []      # [angle, t]
var hit_marks: Array = []      # [enemy, t, head]
var alerts := {}               # enemy -> [kind, t]
var popups: Array = []         # [world pos, text, col, t, size]
var feed: Array = []           # [text, col, t]
var obj_flash := 0.0
var score_shown := 0.0
var trail_hp := 100.0
var _t := 0.0
var _u := 1.0
var _fps_t := 0.0
var _fps := 0
var map_r := 66.0
var map_c := Vector2.ZERO
var route := PackedVector3Array()
var _route_t := 0.0
var _route_goal := Vector3.INF


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.theme = K.theme()
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
	pause_layer = Control.new()
	pause_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_layer.visible = false
	root.add_child(pause_layer)
	end_layer = Control.new()
	end_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	end_layer.visible = false
	root.add_child(end_layer)
	fade = ColorRect.new()
	fade.color = Color(0, 0, 0, 1)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(fade)
	create_tween().tween_property(fade, "color:a", 0.0, 0.8)
	Fx.popup.connect(_on_popup)
	if mission:
		mission.objective_changed.connect(func() -> void: obj_flash = 1.0)


func _exit_tree() -> void:
	if Fx.popup.is_connected(_on_popup):
		Fx.popup.disconnect(_on_popup)


func _on_popup(pos: Vector3, txt: String, col: Color, size: float) -> void:
	popups.append([pos, txt, col, 1.3, size])


func uses_touch() -> bool:
	return touch_seen or Game.is_phone()


func _layout() -> void:
	var s := overlay.size
	var base := clampf(s.y / 720.0, 0.85, 1.6)
	_u = base * (1.45 if uses_touch() else 1.0)
	var m := 20.0 * base
	stick_r = 70.0 * base * 1.3
	move_home = Vector2(m + stick_r + 30.0 * base, s.y - m - stick_r - 10.0 * base)
	aim_home = Vector2(s.x - m - stick_r - 34.0 * base, s.y - m - stick_r - 10.0 * base)
	var br := 31.0 * base * 1.3
	var ring := stick_r * 0.78 + br + 22.0 * base
	# action buttons on an arc around the fire button, clear of each other
	for e in [["reload", 180.0], ["grenade", 222.0], ["dash", 264.0]]:
		var a := deg_to_rad(e[1])
		btn[e[0]] = [aim_home + Vector2(cos(a), sin(a)) * ring, br]
	# square pause + settings stacked on the right edge, minimap just left of them
	var sq := 21.0 * base * (1.2 if uses_touch() else 1.0)
	btn["pause"] = [Vector2(s.x - m - sq, m + sq), sq]
	btn["settings"] = [Vector2(s.x - m - sq, m + sq * 3.0 + 10.0 * base), sq]
	map_r = 66.0 * base * (1.12 if uses_touch() else 1.0)
	map_c = Vector2(s.x - m - sq * 2.0 - 16.0 * base - map_r, m + map_r + 2.0 * base)
	if move_id < 0:
		move_base = move_home
		move_knob = move_home
	if aim_id < 0:
		aim_base = aim_home
		aim_knob = aim_home


func _process(delta: float) -> void:
	var rd := delta / maxf(Engine.time_scale, 0.05)
	if get_tree().paused:
		rd = delta
	_t += rd
	hurt_k = maxf(hurt_k - rd * 1.4, 0.0)
	obj_flash = maxf(obj_flash - rd * 1.5, 0.0)
	for e in dmg_marks:
		e[1] -= rd
	for e in hit_marks:
		e[1] -= rd
	for e in popups:
		e[3] -= rd
	for e in feed:
		e[2] -= rd
	dmg_marks = dmg_marks.filter(func(e: Array) -> bool: return e[1] > 0.0)
	hit_marks = hit_marks.filter(func(e: Array) -> bool: return e[1] > 0.0)
	popups = popups.filter(func(e: Array) -> bool: return e[3] > 0.0)
	feed = feed.filter(func(e: Array) -> bool: return e[2] > 0.0)
	for k in alerts.keys():
		alerts[k][1] -= rd
		if alerts[k][1] <= 0.0:
			alerts.erase(k)
	_fps_t += delta
	if _fps_t > 0.5:
		_fps = int(Engine.get_frames_per_second())
		_fps_t = 0.0
	_layout()
	_update_route(rd)
	if mission:
		score_shown = lerpf(score_shown, mission.score, 1.0 - exp(-8.0 * rd))
	if player:
		trail_hp = move_toward(trail_hp, player.hp, rd * 30.0) if trail_hp > player.hp else player.hp
		var low := clampf((40.0 - player.hp) / 40.0, 0.0, 1.0) if player.alive else 0.0
		(vignette.material as ShaderMaterial).set_shader_parameter("hurt", hurt_k)
		(vignette.material as ShaderMaterial).set_shader_parameter("low", low)
		if playing and not get_tree().paused:
			player.input_move = (move_knob - move_base) / stick_r if move_id >= 0 else Vector2.ZERO
			if player.input_move.length() < 0.1:
				player.input_move = Vector2.ZERO
			player.fire_held = mouse_fire or aim_id >= 0
		else:
			player.input_move = Vector2.ZERO
			player.fire_held = false
	overlay.queue_redraw()
	if end_layer.visible:
		for c in end_layer.get_children():
			if c is Control and c.has_meta("debrief"):
				(c as Control).queue_redraw()


# ------------------------------------------------------------------ input

func _input(event: InputEvent) -> void:
	# desktop: the mouse drives the view directly, ignore its emulated touches
	if (event is InputEventScreenTouch or event is InputEventScreenDrag) and event.device == InputEvent.DEVICE_ID_EMULATION and not Game.is_phone():
		return
	if event is InputEventScreenTouch:
		touch_seen = true
		var e := event as InputEventScreenTouch
		if e.pressed:
			if not playing or get_tree().paused:
				return
			for k in btn:
				var b: Array = btn[k]
				if e.position.distance_to(b[0]) < b[1] * 1.3:
					_press(k)
					return
			if e.position.distance_to(aim_home) < stick_r * 0.95 and aim_id < 0:
				# fire button: shoots while held, turns the view when dragged
				aim_id = e.index
				aim_knob = e.position
				look_last = e.position
			elif e.position.x < overlay.size.x * 0.45:
				if move_id < 0:
					move_id = e.index
					move_base = _clamp_base(e.position, true)
					_drag_stick(e.position, true)
			elif look_id < 0:
				look_id = e.index
				look_last = e.position
		else:
			if e.index == move_id:
				move_id = -1
			if e.index == aim_id:
				aim_id = -1
			if e.index == look_id:
				look_id = -1
	elif event is InputEventScreenDrag:
		var e := event as InputEventScreenDrag
		if e.index == move_id:
			_drag_stick(e.position, true)
		elif e.index == aim_id or e.index == look_id:
			if e.index == aim_id:
				aim_knob = e.position
			_turn(e.position.x - look_last.x)
			look_last = e.position
	elif event is InputEventMouseButton:
		var e := event as InputEventMouseButton
		if not playing or get_tree().paused:
			return
		if e.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			for k in ["pause", "settings"]:
				if btn.has(k) and e.position.distance_to(btn[k][0]) < btn[k][1] * 1.3:
					_press(k)
					return
			if not Game.is_phone():
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		if e.button_index == MOUSE_BUTTON_LEFT:
			mouse_fire = e.pressed
		elif e.button_index == MOUSE_BUTTON_RIGHT and e.pressed:
			_press("grenade")
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if player and playing and not get_tree().paused:
			player.view_yaw -= (event as InputEventMouseMotion).relative.x * 0.0032
	elif event is InputEventKey and event.pressed and not event.echo:
		match (event as InputEventKey).keycode:
			KEY_R: _press("reload")
			KEY_G, KEY_Q: _press("grenade")
			KEY_SPACE, KEY_SHIFT: _press("dash")
			KEY_ESCAPE, KEY_P:
				if get_tree().paused:
					show_pause(false)
				else:
					_press("pause")


func _turn(dx: float) -> void:
	if player and playing and not get_tree().paused:
		player.view_yaw -= dx / maxf(overlay.size.y, 1.0) * LOOK_SENS


func _clamp_base(p: Vector2, left: bool) -> Vector2:
	var s := overlay.size
	var x := clampf(p.x, stick_r + 10, s.x * 0.45 - stick_r) if left else clampf(p.x, s.x * 0.55 + stick_r, s.x - stick_r - 10)
	return Vector2(x, clampf(p.y, stick_r + 90 * _u, s.y - stick_r - 10))


func _drag_stick(p: Vector2, left: bool) -> void:
	var base := move_base if left else aim_base
	var d := p - base
	if d.length() > stick_r:
		base += d.normalized() * (d.length() - stick_r)
		d = p - base
	if left:
		move_base = base
		move_knob = base + d
	else:
		aim_base = base
		aim_knob = base + d


func _press(k: String) -> void:
	if player == null or not playing:
		return
	match k:
		"reload":
			player.start_reload()
		"grenade":
			if player.throw_ahead():
				Sfx.play("ui_click", -8.0)
		"dash":
			var d := Basis(Vector3.UP, player.view_yaw) * Vector3(player.input_move.x, 0, player.input_move.y)
			if d.length() < 0.2:
				d = Vector3(player.velocity.x, 0, player.velocity.z)
			player.dash(d)
		"pause":
			show_pause(true)


func release_all() -> void:
	move_id = -1
	aim_id = -1
	look_id = -1
	if not Game.is_phone():
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	mouse_fire = false


# ------------------------------------------------------------------ events

## Mission start: no banner over the game, the objective chip just flashes.
func show_intro(_title: String, _obj: String, _icon: String) -> void:
	obj_flash = 1.0


func on_player_hurt(from: Vector3) -> void:
	hurt_k = minf(hurt_k + 0.5, 1.0)
	if player:
		var d := Basis(Vector3.UP, player.view_yaw).inverse() * (from - player.global_position)
		dmg_marks.append([atan2(d.z, d.x), 1.2])


func on_alert(e: Enemy, kind: String) -> void:
	alerts[e] = [kind, 2.2]


func on_kill(e: Enemy, head: bool) -> void:
	hit_marks.append([e, 0.6, head])


func on_score(pts: int, tag: String, col: Color, at: Vector3) -> void:
	popups.append([at, "+%d" % pts, col, 1.3, 1.0])
	feed.push_front([tag + "   +%d" % pts, col, 3.0])
	if feed.size() > 4:
		feed.pop_back()


# ------------------------------------------------------------------ drawing

func _draw_overlay() -> void:
	if player == null:
		return
	if btn.is_empty():
		_layout()
	var u := _u
	var s := overlay.size
	var ci := overlay
	if s.y > s.x and uses_touch():
		ci.draw_rect(Rect2(Vector2.ZERO, s), Color(0.02, 0.025, 0.02, 0.97))
		K.draw_icon(ci, "rotate", s * 0.5 - Vector2(0, 40 * u), 110 * u, Color.WHITE, -0.5 + sin(_t * 2.0) * 0.5)
		K.text(ci, Vector2(s.x * 0.5, s.y * 0.5 + 60 * u), "ROTATE YOUR PHONE", 26 * u, K.INK, HORIZONTAL_ALIGNMENT_CENTER)
		return
	_draw_world_marks(u, s)
	if end_layer.visible:
		return
	_draw_health(u)
	_draw_objective(u, s)
	_draw_radar(u, s)
	_draw_feed(u, s)
	if mission:
		_draw_zone_progress(u)
	if playing:
		if uses_touch():
			_draw_sticks(u)
		else:
			_draw_weapon_card(u, Vector2(s.x - 24 * u, s.y - 24 * u))
			if _t < 12.0:
				K.text(ci, Vector2(s.x * 0.5, s.y - 22 * u), "WASD move   ·   MOUSE look   ·   CLICK fire   ·   R reload   ·   SPACE dash   ·   G / RMB grenade   ·   ESC pause", 14 * u, Color(K.INK, 0.5), HORIZONTAL_ALIGNMENT_CENTER, "mid")
		_draw_square_btn("pause", "ic_pause")
		_draw_square_btn("settings", "cog")
	if Game.show_fps:
		K.text(ci, Vector2(24 * u, s.y * 0.5), "%d FPS" % _fps, 14 * u, K.GREEN if _fps >= 50 else (K.AMBER if _fps >= 30 else K.RED), HORIZONTAL_ALIGNMENT_LEFT, "mid")


func _draw_health(u: float) -> void:
	var ci := overlay
	var p := Vector2(22 * u, 18 * u)
	var w := 290 * u
	var h := 54 * u
	K.para(ci, Rect2(p, Vector2(w, h)), -0.25, Color(0.03, 0.035, 0.035, 0.72))
	K.para(ci, Rect2(p, Vector2(5 * u, h)), -0.25, K.AMBER)
	var hp_k := clampf(player.hp / player.max_hp, 0.0, 1.0)
	var col := K.GREEN if hp_k > 0.5 else (K.AMBER if hp_k > 0.25 else K.RED)
	var beat := 1.0 + (0.18 * maxf(sin(_t * 9.0), 0.0) if player.hp < 35 and player.alive else 0.0)
	K.draw_icon(ci, "heart-beats", p + Vector2(34 * u, h * 0.5), 34 * u * beat, col)
	var segs := 12
	var bx := p.x + 62 * u
	var bw := 150 * u
	var sw := bw / segs
	for i in segs:
		var k0 := float(i) / segs
		var r := Rect2(Vector2(bx + i * sw, p.y + 21 * u), Vector2(sw - 3 * u, 20 * u))
		var c := Color(1, 1, 1, 0.08)
		if k0 < hp_k:
			c = col
		elif k0 < trail_hp / player.max_hp:
			c = Color(1, 1, 1, 0.7)
		K.para(ci, r, -0.3, c)
	K.text(ci, Vector2(p.x + w - 16 * u, p.y + 40 * u), str(int(ceil(player.hp))), 30 * u, K.INK, HORIZONTAL_ALIGNMENT_RIGHT)
	K.text(ci, Vector2(p.x + 64 * u, p.y + 15 * u), "OPERATOR  ·  " + Game.rank_name(), 11 * u, Color(K.DIM, 0.9), HORIZONTAL_ALIGNMENT_LEFT, "mid")
	for i in player.grenades:
		K.draw_icon(ci, "grenade", Vector2(p.x + 22 * u + i * 22 * u, p.y + h + 16 * u), 20 * u, K.INK)


func _draw_objective(u: float, s: Vector2) -> void:
	if mission == null:
		return
	var ci := overlay
	var txt := mission.objective_text()
	var sa := mission.objective_sub()
	var sub: String = sa[0]
	var sub_col: Color = sa[1]
	var fs := 19 * u
	var tw := maxf(K.text_width(txt, fs), K.text_width(sub, 13 * u, "mid"))
	var w := tw + 84 * u
	var h := 50 * u
	# centred, but never under the health card or the minimap
	var x0 := clampf(s.x * 0.5 - w * 0.5, 22 * u + 300 * u, map_c.x - map_r - 16 * u - w)
	var r := Rect2(Vector2(x0, 16 * u), Vector2(w, h))
	var flash := obj_flash
	K.para(ci, r, -0.2, Color(0.03, 0.035, 0.035, 0.74).lerp(Color(K.AMBER, 0.6), flash * 0.5))
	K.para(ci, Rect2(r.position + Vector2(0, h - 3 * u), Vector2(w, 3 * u)), 0.0, Color(K.AMBER, 0.7 + flash * 0.3))
	var c := r.position + Vector2(30 * u, h * 0.5)
	var d := 17 * u
	ci.draw_colored_polygon(PackedVector2Array([c + Vector2(0, -d), c + Vector2(d, 0), c + Vector2(0, d), c + Vector2(-d, 0)]), K.AMBER)
	K.draw_icon(ci, mission.objective_icon(), c, 20 * u, Color(0.08, 0.06, 0.02), 0.0, false)
	K.text(ci, r.position + Vector2(58 * u, (24 if sub != "" else 32) * u), txt, fs, K.INK)
	if sub != "":
		K.text(ci, r.position + Vector2(58 * u, 42 * u), sub, 13 * u, sub_col, HORIZONTAL_ALIGNMENT_LEFT, "mid")


# ------------------------------------------------------------------ minimap

## Path from the operator to the current goal, refreshed a few times a second.
func _update_route(rd: float) -> void:
	_route_t -= rd
	if _route_t > 0.0 or mission == null or player == null or mission.level == null:
		return
	_route_t = 0.3
	_route_goal = mission.route_goal()
	if _route_goal == Vector3.INF or not player.alive:
		route = PackedVector3Array()
		return
	route = mission.level.find_path(player.global_position, _route_goal)
	route.insert(0, player.global_position)


const MAP_SPAN := 12.0   ## metres from the centre to the edge of the minimap


func _mm(p: Vector3) -> Vector2:
	var o := player.global_position
	return map_c + Vector2(p.x - o.x, p.z - o.z).rotated(player.view_yaw) * (map_r / MAP_SPAN)


func _clip_seg(a: Vector2, b: Vector2, r: float) -> Array:
	var ia := a.distance_to(map_c) <= r
	var ib := b.distance_to(map_c) <= r
	if ia and ib:
		return [a, b]
	var d := b - a
	var f := a - map_c
	var A := d.dot(d)
	if A < 0.0001:
		return []
	var B := 2.0 * f.dot(d)
	var C := f.dot(f) - r * r
	var disc := B * B - 4.0 * A * C
	if disc <= 0.0:
		return []
	var sq := sqrt(disc)
	var t0 := clampf((-B - sq) / (2.0 * A), 0.0, 1.0)
	var t1 := clampf((-B + sq) / (2.0 * A), 0.0, 1.0)
	if t1 - t0 < 0.001:
		return []
	return [a + d * t0, a + d * t1]


func _along(pts: PackedVector2Array, cum: PackedFloat32Array, d: float) -> Vector2:
	for i in range(1, pts.size()):
		if cum[i] >= d:
			var seg := cum[i] - cum[i - 1]
			return pts[i - 1].lerp(pts[i], (d - cum[i - 1]) / seg if seg > 0.0001 else 0.0)
	return pts[pts.size() - 1]


func _draw_radar(u: float, s: Vector2) -> void:
	if mission == null:
		return
	var ci := overlay
	var c := map_c
	var r := map_r
	var sc := r / MAP_SPAN
	# glass body
	ci.draw_circle(c + Vector2(0, 3 * u), r + 6 * u, Color(0, 0, 0, 0.35))
	ci.draw_circle(c, r + 2 * u, Color(0.13, 0.12, 0.08, 0.78))
	# rooms (clipped to the disc)
	var disc := PackedVector2Array()
	for i in 40:
		disc.append(c + Vector2.from_angle(i * TAU / 40.0) * r)
	for room in mission.map.rooms:
		var rr: Rect2 = room["rect"]
		var poly := PackedVector2Array([_mm(Vector3(rr.position.x, 0, rr.position.y)), _mm(Vector3(rr.end.x, 0, rr.position.y)), _mm(Vector3(rr.end.x, 0, rr.end.y)), _mm(Vector3(rr.position.x, 0, rr.end.y))])
		if (poly[0] + poly[2]).distance_to(c * 2.0) * 0.5 > r + rr.size.length() * sc * 0.5:
			continue
		for part in Geometry2D.intersect_polygons(poly, disc):
			ci.draw_colored_polygon(part, Color(0.42, 0.4, 0.3, 0.42))
	for w in mission.map.walls:
		if w["y0"] > 0.1:
			continue
		var wa: Vector2 = w["a"]
		var wb: Vector2 = w["b"]
		var seg := _clip_seg(_mm(Vector3(wa.x, 0, wa.y)), _mm(Vector3(wb.x, 0, wb.y)), r - 1.0)
		if seg.size() == 2:
			ci.draw_line(seg[0], seg[1], Color(0.92, 0.9, 0.82, 0.85), maxf(1.5, 2.2 * u))
	# route: marching dashes from the operator to the goal
	if route.size() >= 2:
		var dash := 7.0 * u
		var gap := 6.0 * u
		var phase := fmod(_t * 26.0 * u, dash + gap)
		var rc := Color(1.0, 0.82, 0.28, 0.95)
		var pts := PackedVector2Array()
		var cum := PackedFloat32Array()
		var total := 0.0
		for i in route.size():
			var q := _mm(route[i])
			if i > 0:
				total += q.distance_to(pts[i - 1])
			pts.append(q)
			cum.append(total)
		var period := dash + gap
		var start := phase - period
		var guard := 0
		while start < total and guard < 400:
			guard += 1
			var s0 := maxf(start, 0.0)
			var s1 := minf(start + dash, total)
			if s1 > s0:
				var seg := _clip_seg(_along(pts, cum, s0), _along(pts, cum, s1), r - 4 * u)
				if seg.size() == 2:
					ci.draw_line(seg[0], seg[1], rc, 3.2 * u, true)
			start += period
	# hostiles you know about, hostage
	for e in mission.enemies:
		if e.alive and (e.sees_player() or alerts.has(e) or player.locked == e):
			var ep := _mm(e.global_position)
			if ep.distance_to(c) < r - 4 * u:
				ci.draw_circle(ep, 4.0 * u, K.RED)
				ci.draw_arc(ep, 4.0 * u, 0, TAU, 12, Color(0, 0, 0, 0.6), 1.0, true)
	for h in mission.hostages():
		if h.alive:
			var hp := _mm(h.global_position)
			if hp.distance_to(c) < r - 4 * u:
				ci.draw_circle(hp, 4.0 * u, K.CYAN)
	# goal: on the map, or pinned to the rim pointing the way
	for mk in mission.markers():
		var mp := _mm(mk["pos"])
		var col: Color = mk["col"]
		var off := mp - c
		var pulse := 1.0 + 0.15 * sin(_t * 6.0)
		if off.length() > r - 9 * u:
			mp = c + off.normalized() * (r - 2 * u)
			ci.draw_circle(mp, 10 * u, Color(0.05, 0.05, 0.04, 0.95))
			ci.draw_arc(mp, 10 * u, 0, TAU, 20, col, 2.0 * u, true)
			K.draw_icon(ci, mk["icon"], mp, 13 * u, col, 0.0, false)
		else:
			ci.draw_circle(mp, 8 * u * pulse, Color(col, 0.25))
			ci.draw_circle(mp, 4.5 * u, col)
	# operator: view wedge + arrow in the centre
	var fwd := Vector2(-sin(player.aim_yaw), -cos(player.aim_yaw)).rotated(player.view_yaw)
	var ang := fwd.angle()
	var wedge := PackedVector2Array([c])
	for i in 9:
		wedge.append(c + Vector2.from_angle(ang - 0.5 + i * 0.125) * r * 0.55)
	ci.draw_colored_polygon(wedge, Color(1, 1, 1, 0.08))
	var side := Vector2(-fwd.y, fwd.x)
	ci.draw_colored_polygon(PackedVector2Array([c + fwd * 9 * u, c - fwd * 5 * u + side * 6 * u, c - fwd * 2 * u, c - fwd * 5 * u - side * 6 * u]), Color.WHITE)
	# silver rim + north tick
	ci.draw_arc(c, r + 1 * u, 0, TAU, 64, Color(0, 0, 0, 0.6), 4.0 * u, true)
	ci.draw_arc(c, r + 3 * u, PI, TAU, 48, Color(0.95, 0.95, 0.9, 0.95), 3.0 * u, true)
	ci.draw_arc(c, r + 3 * u, 0, PI, 48, Color(0.55, 0.55, 0.52, 0.95), 3.0 * u, true)
	ci.draw_arc(c, r - 2 * u, PI * 1.15, PI * 1.85, 24, Color(1, 1, 1, 0.18), 3.0 * u, true)
	var n := c + Vector2(0, -1).rotated(player.view_yaw) * (r + 3 * u)
	ci.draw_circle(n, 8 * u, Color(0.13, 0.12, 0.08, 0.95))
	ci.draw_arc(n, 8 * u, 0, TAU, 16, Color(0.9, 0.9, 0.85), 1.5 * u, true)
	K.text(ci, n + Vector2(0, 4.5 * u), "N", 12 * u, K.INK, HORIZONTAL_ALIGNMENT_CENTER)
	# score + kills under the map
	var y := c.y + r + 30 * u
	var sc_txt := _fmt(int(round(score_shown)))
	K.text(ci, Vector2(c.x + r, y), sc_txt, 22 * u, K.INK, HORIZONTAL_ALIGNMENT_RIGHT)
	K.draw_icon(ci, "death-skull", Vector2(c.x - r + 9 * u, y - 7 * u), 16 * u, K.INK)
	K.text(ci, Vector2(c.x - r + 21 * u, y), "%d" % mission.kills, 18 * u, K.INK)


func _draw_feed(u: float, s: Vector2) -> void:
	var ci := overlay
	var x := map_c.x + map_r
	var y := map_c.y + map_r + 46 * u
	for i in feed.size():
		var f: Array = feed[i]
		var a := clampf(f[2], 0.0, 1.0)
		var t: String = f[0]
		var w := K.text_width(t, 15 * u) + 24 * u
		K.para(ci, Rect2(Vector2(x - w, y + i * 28 * u), Vector2(w, 24 * u)), -0.2, Color(0, 0, 0, 0.45 * a))
		K.text(ci, Vector2(x - 10 * u, y + i * 28 * u + 18 * u), t, 15 * u, Color(f[1], a), HORIZONTAL_ALIGNMENT_RIGHT)


func _draw_world_marks(u: float, s: Vector2) -> void:
	if cam == null or mission == null:
		return
	var ci := overlay
	if player.alive:
		var pc := s * 0.5
		for d in dmg_marks:
			var k: float = clampf(d[1] / 1.2, 0.0, 1.0)
			ci.draw_arc(pc, 150.0 * u, d[0] - 0.42, d[0] + 0.42, 24, Color(1, 0.15, 0.1, k * 0.9), 7.0 * u, true)
	var m := 46.0 * u
	for mk in mission.markers():
		var wp: Vector3 = mk["pos"]
		var behind := cam.is_position_behind(wp)
		var sp := cam.unproject_position(wp)
		var on := not behind and sp.x > m and sp.x < s.x - m and sp.y > 120 * u and sp.y < s.y - m
		var col: Color = mk["col"]
		var bob := sin(_t * 4.0) * 3.0 * u
		if on:
			_badge(sp + Vector2(0, bob), 17 * u, mk["icon"], col)
			var who = mk["who"]
			if who and who is Soldier:
				var sd := who as Soldier
				var bw := 44 * u
				var by := sp.y + bob - 30 * u
				ci.draw_rect(Rect2(sp.x - bw * 0.5 - 1, by - 1, bw + 2, 5 * u + 2), Color(0, 0, 0, 0.6))
				ci.draw_rect(Rect2(sp.x - bw * 0.5, by, bw * sd.hp / sd.max_hp, 5 * u), K.RED)
		else:
			var center := s * 0.5
			var dir := sp - center
			if behind:
				dir = -dir
			var ang := dir.angle()
			var e := Vector2(clampf(center.x + cos(ang) * s.x, m, s.x - m), clampf(center.y + sin(ang) * s.y, 120 * u, s.y - m))
			_badge(e, 15 * u, mk["icon"], col)
			K.draw_icon(ci, "arrow", e + Vector2(cos(ang), sin(ang)) * 28 * u, 16 * u, col, ang, false)
			K.text(ci, e + Vector2(0, 34 * u), "%dm" % int(Vector3(wp.x, 0, wp.z).distance_to(player.global_position)), 13 * u, col, HORIZONTAL_ALIGNMENT_CENTER, "mid")
	for e in mission.enemies:
		if not e.alive:
			continue
		var wp := e.head_pos() + Vector3(0, 0.45, 0)
		if cam.is_position_behind(wp):
			continue
		var sp := cam.unproject_position(wp)
		if alerts.has(e):
			var a: Array = alerts[e]
			var k: float = clampf(a[1], 0.0, 1.0)
			var big := 1.0 + maxf(0.0, a[1] - 1.9) * 2.5
			var col := K.RED if a[0] == "!" else K.AMBER
			ci.draw_circle(sp, 13 * u * big, Color(0, 0, 0, 0.55 * k))
			ci.draw_arc(sp, 13 * u * big, 0, TAU, 24, Color(col, k), 2.0 * u, true)
			K.text(ci, sp + Vector2(0, 8 * u * big), a[0], 22 * u * big, Color(col, k), HORIZONTAL_ALIGNMENT_CENTER)
		elif e.hp < e.max_hp and e != mission.target:
			var bw := 34 * u
			ci.draw_rect(Rect2(sp.x - bw * 0.5 - 1, sp.y - 1, bw + 2, 4 * u + 2), Color(0, 0, 0, 0.55))
			ci.draw_rect(Rect2(sp.x - bw * 0.5, sp.y, bw * e.hp / e.max_hp, 4 * u), K.RED)
		if e.kind == "heavy":
			K.draw_icon(ci, "kevlar", sp + Vector2(-26 * u, 0), 16 * u, Color(K.INK, 0.8))
	for hm in hit_marks:
		var e: Enemy = hm[0]
		if not is_instance_valid(e):
			continue
		var sp := cam.unproject_position(e.chest_pos())
		var k: float = hm[1] / 0.6
		var sz := lerpf(46.0, 30.0, k) * u
		K.draw_icon(ci, "helmet-head-shot" if hm[2] else "death-skull", sp + Vector2(0, -20 * u * (1.0 - k)), sz, Color(K.RED if hm[2] else Color.WHITE, k))
	_draw_crosshair(u)
	if player.locked and player.alive:
		var c := cam.unproject_position(player.locked.chest_pos())
		var g := 16 * u + sin(_t * 10.0) * 2.0 * u
		var l := 7 * u
		for dd in [Vector2(1, 1), Vector2(1, -1), Vector2(-1, 1), Vector2(-1, -1)]:
			var corner: Vector2 = c + dd * g
			ci.draw_line(corner, corner - Vector2(dd.x * l, 0), Color(K.RED, 0.9), 2.0 * u)
			ci.draw_line(corner, corner - Vector2(0, dd.y * l), Color(K.RED, 0.9), 2.0 * u)
	for pp in popups:
		var wp: Vector3 = pp[0]
		if cam.is_position_behind(wp):
			continue
		var k: float = pp[3] / 1.3
		var sp := cam.unproject_position(wp) + Vector2(0, -(1.0 - k) * 50 * u)
		var sz: float = (22.0 + (1.0 - k) * 4.0) * u * float(pp[4])
		K.text(ci, sp, pp[1], sz, Color(pp[2], clampf(k * 1.5, 0.0, 1.0)), HORIZONTAL_ALIGNMENT_CENTER)


## Where the rifle points: a small four-tick reticle on the laser's end, red over a hostile.
func _draw_crosshair(u: float) -> void:
	if not player.alive or not playing or cam.is_position_behind(player.aim_point):
		return
	var c := cam.unproject_position(player.aim_point)
	var hot := player.locked != null
	var col := Color(1, 0.3, 0.25, 0.95) if hot else Color(1, 1, 1, 0.85)
	var g := (7.0 + player.spread * 60.0 + (4.0 if player.fire_held else 0.0)) * u
	var l := 7.0 * u
	for d in [Vector2.RIGHT, Vector2.LEFT, Vector2.UP, Vector2.DOWN]:
		overlay.draw_line(c + d * g + Vector2(1, 1), c + d * (g + l) + Vector2(1, 1), Color(0, 0, 0, 0.5), 2.5 * u)
		overlay.draw_line(c + d * g, c + d * (g + l), col, 2.0 * u)
	overlay.draw_circle(c, 1.6 * u, col)


func _badge(c: Vector2, r: float, icon: String, col: Color) -> void:
	var ci := overlay
	ci.draw_circle(c + Vector2(1, 2), r + 3, Color(0, 0, 0, 0.5))
	ci.draw_circle(c, r + 2, col)
	ci.draw_circle(c, r - 1, Color(0.04, 0.05, 0.05, 0.92))
	K.draw_icon(ci, icon, c, r * 1.2, col, 0.0, false)


func _draw_zone_progress(u: float) -> void:
	for z in mission.zones:
		if z.active and z.progress > 0.01 and cam:
			var sp := cam.unproject_position(player.global_position + Vector3(0, 2.3, 0))
			var r := 26 * u
			overlay.draw_circle(sp, r + 4, Color(0, 0, 0, 0.6))
			overlay.draw_arc(sp, r, -PI / 2, -PI / 2 + TAU, 40, Color(1, 1, 1, 0.15), 5 * u, true)
			overlay.draw_arc(sp, r, -PI / 2, -PI / 2 + TAU * z.progress, 40, z.color, 5 * u, true)
			K.draw_icon(overlay, z.icon, sp, r * 1.1, z.color, 0.0, false)


func _draw_weapon_card(u: float, br: Vector2) -> void:
	var ci := overlay
	var d := Weapons.get_def(player.weapon_id)
	var w := 250 * u
	var h := 70 * u
	var r := Rect2(br - Vector2(w, h), Vector2(w, h))
	K.para(ci, r, -0.22, Color(0.03, 0.035, 0.035, 0.72))
	K.draw_icon(ci, d["icon"], r.position + Vector2(62 * u, h * 0.42), 92 * u, K.INK)
	var ammo_col := K.RED if player.ammo == 0 else (K.AMBER if player.ammo <= player.mag_size * 0.25 else K.INK)
	K.text(ci, Vector2(r.end.x - 52 * u, r.position.y + 44 * u), str(player.ammo), 38 * u, ammo_col, HORIZONTAL_ALIGNMENT_RIGHT)
	K.text(ci, Vector2(r.end.x - 48 * u, r.position.y + 44 * u), "/ %d" % player.mag_size, 15 * u, K.DIM, HORIZONTAL_ALIGNMENT_LEFT, "mid")
	K.text(ci, r.position + Vector2(16 * u, h - 8 * u), d["name"], 12 * u, K.DIM, HORIZONTAL_ALIGNMENT_LEFT, "mid")
	if player.is_reloading():
		ci.draw_rect(Rect2(r.position + Vector2(10 * u, h - 4 * u), Vector2((w - 20 * u) * player.reload_progress(), 3 * u)), K.AMBER)
		K.text(ci, Vector2(r.end.x - 12 * u, r.position.y + 14 * u), "RELOADING", 11 * u, K.AMBER, HORIZONTAL_ALIGNMENT_RIGHT, "mid")
	elif player.ammo <= player.mag_size * 0.25:
		K.text(ci, Vector2(r.end.x - 12 * u, r.position.y + 14 * u), "RELOAD" if player.ammo == 0 else "LOW AMMO", 11 * u, Color(ammo_col, 0.6 + 0.4 * sin(_t * 9.0)), HORIZONTAL_ALIGNMENT_RIGHT, "mid")


func _tex(name: String, c: Vector2, size: float, col := Color.WHITE) -> void:
	overlay.draw_texture_rect(K.icon(name), Rect2(c - Vector2.ONE * size * 0.5, Vector2.ONE * size), false, col)


func _draw_sticks(u: float) -> void:
	var ci := overlay
	# movement: thin white ring with arrow ticks + glass knob
	var act := move_id >= 0
	_tex("stick_ring", move_base, stick_r * 2.0, Color(1, 1, 1, 0.9 if act else 0.55))
	if act:
		var d := move_knob - move_base
		if d.length() > 4:
			var a := d.angle()
			ci.draw_arc(move_base, stick_r * 0.98, a - 0.45, a + 0.45, 20, Color(1, 1, 1, 0.75), 4 * u, true)
	_tex("stick_knob", move_knob, stick_r * 0.86, Color(1, 1, 1, 1.0 if act else 0.8))
	if not act and _t < 10.0 and Game.current <= 1:
		K.text(ci, move_base + Vector2(0, -stick_r - 14 * u), "DRAG TO MOVE", 13 * u, Color(K.INK, 0.7), HORIZONTAL_ALIGNMENT_CENTER, "mid")
	# fire: big glass button with a cartridge; drag it to turn while shooting
	var aact := aim_id >= 0
	var fr := stick_r * 0.78
	var press := 0.93 if aact else 1.0
	_tex("btn_round", aim_home, fr * 2.0 * press, Color(1, 0.72, 0.66) if aact else Color.WHITE)
	_tex("ic_bullet", aim_home, fr * 1.15 * press, Color(1, 1, 1, 0.95))
	if aact:
		ci.draw_arc(aim_home, fr * 1.02, 0, TAU, 48, Color(1, 0.35, 0.25, 0.8), 3.0 * u, true)
	if _t < 10.0 and Game.current <= 1:
		K.text(ci, Vector2(overlay.size.x * 0.7, overlay.size.y * 0.47), "DRAG HERE TO LOOK AROUND", 14 * u, Color(K.INK, 0.5), HORIZONTAL_ALIGNMENT_CENTER, "mid")
		K.text(ci, Vector2(overlay.size.x * 0.7, overlay.size.y * 0.47 + 20 * u), "HOLD THE BULLET TO FIRE  ·  DRAG IT TO TURN", 12 * u, Color(K.INK, 0.4), HORIZONTAL_ALIGNMENT_CENTER, "mid")
	# ammo arc around the fire button
	var ak := float(player.ammo) / player.mag_size
	var ac := aim_home
	var arr := fr + 7 * u
	ci.draw_arc(ac, arr, -PI * 0.75, PI * 0.25, 48, Color(0, 0, 0, 0.35), 5 * u, true)
	if ak > 0:
		ci.draw_arc(ac, arr, -PI * 0.75, -PI * 0.75 + PI * ak, 48, K.RED if ak <= 0.25 else Color(0.96, 0.95, 0.9, 0.9), 3.5 * u, true)
	var ammo_col := K.RED if player.ammo == 0 else (K.AMBER if ak <= 0.25 else K.INK)
	var ap := aim_home + Vector2(cos(deg_to_rad(300.0)), sin(deg_to_rad(300.0))) * (stick_r + 34.0 * u)
	K.draw_icon(ci, Weapons.get_def(player.weapon_id)["icon"], ap + Vector2(-4 * u, -14 * u), 50 * u, Color(K.INK, 0.85))
	K.text(ci, ap + Vector2(0, 20 * u), "%d" % player.ammo, 24 * u, ammo_col, HORIZONTAL_ALIGNMENT_CENTER)
	_action("reload", "ic_reload", player.reload_progress() if player.is_reloading() else -1.0, player.ammo <= player.mag_size * 0.25, "")
	_action("grenade", "grenade", -1.0, false, str(player.grenades), player.grenades <= 0)
	_action("dash", "run", player.dash_ready() if player.dash_ready() < 1.0 else -1.0, false, "")


func _action(k: String, icon: String, progress: float, alarm: bool, badge: String, disabled := false) -> void:
	var ci := overlay
	var c: Vector2 = btn[k][0]
	var r: float = btn[k][1]
	var tint := Color(1, 1, 1, 0.5) if disabled else Color.WHITE
	_tex("btn_round", c, r * 2.0, tint)
	if alarm and not disabled:
		ci.draw_arc(c, r * 0.9, 0, TAU, 40, Color(K.RED, 0.55 + 0.45 * sin(_t * 8.0)), 3.0 * _u, true)
	if progress >= 0.0:
		ci.draw_arc(c, r * 0.8, 0, TAU, 40, Color(0, 0, 0, 0.45), 4.0 * _u, true)
		ci.draw_arc(c, r * 0.8, -PI / 2, -PI / 2 + TAU * progress, 40, Color(0.96, 0.95, 0.9), 4.0 * _u, true)
	var isz := r * (1.0 if icon == "ic_reload" else 1.12)
	_tex(icon, c + Vector2(1, 2), isz, Color(0, 0, 0, 0.45 * tint.a))
	_tex(icon, c, isz, Color(1, 1, 1, 0.3 if disabled else 0.97))
	if badge != "":
		var bc := c + Vector2(r * 0.72, -r * 0.72)
		ci.draw_circle(bc, 10.5 * _u, Color(0.1, 0.09, 0.06, 0.95))
		ci.draw_arc(bc, 10.5 * _u, 0, TAU, 20, Color(0.9, 0.9, 0.85), 1.5 * _u, true)
		K.text(ci, bc + Vector2(0, 5 * _u), badge, 14 * _u, K.INK, HORIZONTAL_ALIGNMENT_CENTER)


func _draw_square_btn(k: String, icon: String) -> void:
	if not btn.has(k):
		return
	var c: Vector2 = btn[k][0]
	var r: float = btn[k][1]
	_tex("btn_square", c, r * 2.3)
	_tex(icon, c + Vector2(1, 2), r * 1.05, Color(0, 0, 0, 0.45))
	_tex(icon, c, r * 1.05, Color(1, 1, 1, 0.96))


func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	for i in s.length():
		if i > 0 and (s.length() - i) % 3 == 0:
			out += ","
		out += s[i]
	return out


# ------------------------------------------------------------------ pause

func show_pause(on: bool) -> void:
	if end_layer.visible:
		return
	get_tree().paused = on
	release_all()
	for c in pause_layer.get_children():
		c.queue_free()
	pause_layer.visible = on
	if not on:
		return
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.015, 0.015, 0.8)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	pause_layer.add_child(bg)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 12)
	pause_layer.add_child(box)
	var t := K.label("PAUSED", 72, K.INK, "wide")
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(t)
	var sub := K.label(mission.def["name"] + "   ·   " + mission.objective_text(), 18, K.AMBER, "mid")
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(sub)
	var resume := K.menu_button("RESUME", "", "play-button", true)
	resume.pressed.connect(func() -> void: show_pause(false))
	box.add_child(resume)
	var rs := K.menu_button("RESTART", "same map, fresh start", "return-arrow")
	rs.pressed.connect(func() -> void:
		get_tree().paused = false
		mission.restart())
	box.add_child(rs)
	var aa := K.menu_button("AIM ASSIST: " + ("ON" if Game.aim_assist else "OFF"), "tap to toggle", "on-target")
	aa.pressed.connect(func() -> void:
		Game.aim_assist = not Game.aim_assist
		Game.save()
		show_pause(true))
	box.add_child(aa)
	var snd := K.menu_button("SOUND: " + ("ON" if Game.volume > 0.01 else "OFF"), "tap to toggle", "speaker")
	snd.pressed.connect(func() -> void:
		Game.volume = 0.0 if Game.volume > 0.01 else 0.8
		Game.apply_settings()
		Game.save()
		show_pause(true))
	box.add_child(snd)
	var q := K.menu_button("QUIT TO MENU", "", "exit-door")
	q.pressed.connect(func() -> void: Game.to_menu())
	box.add_child(q)


# ------------------------------------------------------------------ debrief

func show_end(r: Dictionary) -> void:
	playing = false
	release_all()
	end_layer.visible = true
	for c in end_layer.get_children():
		c.queue_free()
	var win: bool = r["win"]
	var bg := ColorRect.new()
	bg.color = Color(0.01, 0.015, 0.015, 0.0)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	end_layer.add_child(bg)
	create_tween().tween_property(bg, "color:a", 0.84, 0.5)
	var draw := Control.new()
	draw.set_anchors_preset(Control.PRESET_FULL_RECT)
	draw.mouse_filter = Control.MOUSE_FILTER_IGNORE
	draw.set_meta("debrief", true)
	end_layer.add_child(draw)
	var start := _t
	var shown := [0]
	draw.draw.connect(func() -> void: _draw_end(draw, r, _t - start, shown))
	var row := HBoxContainer.new()
	row.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	row.grow_horizontal = Control.GROW_DIRECTION_BOTH
	row.grow_vertical = Control.GROW_DIRECTION_BEGIN
	row.offset_bottom = -36
	row.add_theme_constant_override("separation", 18)
	end_layer.add_child(row)
	if win and Game.current >= 0 and Game.current + 1 < Game.MISSIONS.size():
		var nx := K.menu_button("NEXT MISSION", Game.MISSIONS[Game.current + 1]["name"], "play-button", true)
		nx.pressed.connect(func() -> void: mission.next_mission())
		row.add_child(nx)
	var rt := K.menu_button("REPLAY" if win else "RETRY", "", "return-arrow", not win)
	rt.pressed.connect(func() -> void: mission.restart())
	row.add_child(rt)
	var mn := K.menu_button("MENU", "", "exit-door")
	mn.pressed.connect(func() -> void: Game.to_menu())
	row.add_child(mn)
	row.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_interval(1.4)
	tw.tween_property(row, "modulate:a", 1.0, 0.4)


func _draw_end(ci: Control, r: Dictionary, t: float, shown: Array) -> void:
	var u := clampf(ci.size.y / 720.0, 0.85, 1.6)
	var s := ci.size
	var win: bool = r["win"]
	var col := K.GREEN if win else K.RED
	var cx := s.x * 0.5
	var y := s.y * 0.13
	var k := clampf(t / 0.4, 0.0, 1.0)
	K.text(ci, Vector2(cx, y), "OPERATION  " + str(mission.def["name"]), 20 * u, Color(K.AMBER, k), HORIZONTAL_ALIGNMENT_CENTER, "wide")
	var title := "MISSION COMPLETE" if win else "MISSION FAILED"
	K.text(ci, Vector2(cx, y + 74 * u), title, (76 + (1.0 - k) * 30) * u, Color(col, k), HORIZONTAL_ALIGNMENT_CENTER, "wide")
	if not win:
		K.text(ci, Vector2(cx, y + 108 * u), r["reason"], 20 * u, K.INK, HORIZONTAL_ALIGNMENT_CENTER, "mid")
	var sy := y + 150 * u
	for i in 3:
		var appear := clampf((t - 0.5 - i * 0.35) / 0.25, 0.0, 1.0)
		var filled: bool = i < int(r["stars"]) and appear > 0.0
		if filled and shown[0] <= i and appear > 0.5:
			shown[0] = i + 1
			Sfx.play("star", -2.0, 1.0 + i * 0.12)
		var sc := 1.0 + (1.0 - appear) * 0.8 if filled else 1.0
		K.star(ci, Vector2(cx + (i - 1) * 74 * u, sy), 30 * u * sc, filled, K.AMBER if filled else Color(1, 1, 1, 0.25))
	var labels := ["MISSION COMPLETE", "HEALTH 50+", "UNDER %d:%02d" % [int(r["par"]) / 60, int(r["par"]) % 60]]
	for i in 3:
		K.text(ci, Vector2(cx + (i - 1) * 74 * u, sy + 46 * u), labels[i], 10 * u, Color(K.DIM, k), HORIZONTAL_ALIGNMENT_CENTER, "mid")
	var by := sy + 86 * u
	var lines: Array = r["breakdown"]
	for i in lines.size():
		var a := clampf((t - 1.2 - i * 0.15) / 0.2, 0.0, 1.0)
		var ln: Array = lines[i]
		K.text(ci, Vector2(cx - 190 * u, by + i * 28 * u), ln[0], 16 * u, Color(K.DIM, a), HORIZONTAL_ALIGNMENT_LEFT, "mid")
		K.text(ci, Vector2(cx + 190 * u, by + i * 28 * u), "+" + _fmt(int(ln[1] * a)), 18 * u, Color(K.INK, a), HORIZONTAL_ALIGNMENT_RIGHT)
	var ty := by + lines.size() * 28 * u + 20 * u
	var tk := clampf((t - 1.8) / 0.8, 0.0, 1.0)
	ci.draw_line(Vector2(cx - 190 * u, ty - 20 * u), Vector2(cx + 190 * u, ty - 20 * u), Color(K.AMBER, 0.4 * tk), 1.5)
	K.text(ci, Vector2(cx - 190 * u, ty + 8 * u), "TOTAL", 20 * u, Color(K.AMBER, tk), HORIZONTAL_ALIGNMENT_LEFT, "wide")
	K.text(ci, Vector2(cx + 190 * u, ty + 10 * u), _fmt(int(r["score"] * tk)), 34 * u, Color(K.INK, tk), HORIZONTAL_ALIGNMENT_RIGHT)
	var st := "TIME %d:%02d   ·   ACCURACY %d%%   ·   KILLS %d   ·   HEADSHOTS %d" % [int(r["time"]) / 60, int(r["time"]) % 60, int(r["accuracy"]), r["kills"], r["headshots"]]
	K.text(ci, Vector2(cx, ty + 42 * u), st, 15 * u, Color(K.DIM, tk), HORIZONTAL_ALIGNMENT_CENTER, "mid")
	var xk := clampf((t - 2.4) / 0.6, 0.0, 1.0)
	K.text(ci, Vector2(cx, ty + 72 * u), "+%d XP   ·   %s" % [int(r["xp"] * xk), Game.rank_name()], 18 * u, Color(K.CYAN, xk), HORIZONTAL_ALIGNMENT_CENTER)
	if r["new_rank"] and xk >= 1.0:
		K.text(ci, Vector2(cx, ty + 96 * u), "PROMOTED!", 18 * u, Color(K.AMBER, 0.6 + 0.4 * sin(t * 6.0)), HORIZONTAL_ALIGNMENT_CENTER, "wide")
	for i in r["unlocks"].size():
		var id: String = r["unlocks"][i]
		var d := Weapons.get_def(id)
		var uy: float = ty + 126 * u + i * 40 * u
		K.draw_icon(ci, d["icon"], Vector2(cx - 150 * u, uy - 6 * u), 54 * u, Color(K.AMBER, xk))
		K.text(ci, Vector2(cx - 110 * u, uy), "NEW WEAPON UNLOCKED:  " + d["name"], 18 * u, Color(K.AMBER, xk))
