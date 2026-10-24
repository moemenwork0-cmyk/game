extends TrailerShot
## The first minute of the game as a player sees it: the loading screen, then black and
## a heartbeat, her eyes flutter open on the wet sand, she gets up, looks around the
## cove and the wreck of the Murjan, and the player takes control and walks the beach.

const LOAD_END := 8.0
const BLACK_END := 9.6
const EYES_END := 16.5
const STAND_END := 20.5

var loading: LoadingScreen
var lids: ShaderMaterial
var fade: ColorRect
var hud: Control
var layla: Actor
var wreck: Murjan
var spot := Vector3.ZERO
var _tr: Trailer
var _cam_pos := Vector3.ZERO
var _cam_look := Vector3.ZERO
var _path: Array[Vector3] = []
var _walk_d := 0.0
var _hud_t := 0.0
var _lid_rect: ColorRect


func build(tr: Trailer) -> void:
	_tr = tr
	duration = 46.0
	tr.sky.hour = 7.4
	tr.sky.storm = 0.0
	tr.sky.cloudiness = 0.4
	# the beach is found before planting so the walk can be kept clear of plants
	await tr.add_island(Vector3(-20, 0, 440), 0.0, 1.1)
	spot = _sand(-20.0, 2.0)
	for p in [spot, _sand(-27.0, 3.0), _sand(-34.0, 3.5), _sand(-40.0, 4.0), _sand(-43.0, 9.0)]:
		_path.append(p)
	var clear: Array[Vector3] = []
	for i in _path.size() - 1:
		for k in 6:
			var q := _path[i].lerp(_path[i + 1], k / 6.0)
			clear.append(Vector3(q.x, q.z, 5.5))
	tr.scatter.clearings = clear
	await tr.scatter.build_static(Vector3(-20, 0, 440), 220.0, Callable(), true)
	wreck = Murjan.new()
	tr.add_child(wreck)
	wreck.position = Vector3(10, -3.8, 540)
	wreck.rotation = Vector3(0.06, 2.3, 0.42)
	for l in wreck.lanterns:
		l.visible = false
	layla = Actor.create("layla", {"idle": "f_idle_nervous_01", "walk": "m_walk_bruised", "look": "m_idle_look_around_01"})
	tr.add_child(layla)
	layla.global_position = spot
	layla.visible = false
	layla.when_ready(func() -> void: layla.play("idle", 0.0))
	_overlays()
	tr.attr.dof_blur_far_enabled = false
	tr.attr.dof_blur_near_enabled = false


func _overlays() -> void:
	var cl := CanvasLayer.new()
	cl.layer = 20
	add_child(cl)
	lids = ShaderMaterial.new()
	lids.shader = preload("res://shaders/trailer/eyelids.gdshader")
	var lr := ColorRect.new()
	lr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	lr.material = lids
	_lid_rect = lr
	lr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cl.add_child(lr)
	lids.set_shader_parameter("open", 0.0)
	hud = _make_hud()
	hud.modulate.a = 0.0
	cl.add_child(hud)
	fade = ColorRect.new()
	fade.color = Color.BLACK
	fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cl.add_child(fade)
	var lc := CanvasLayer.new()
	lc.layer = 30
	add_child(lc)
	loading = LoadingScreen.new()
	lc.add_child(loading)


## A minimal survival HUD: vitals bottom-left, objective top-right, compass top-centre.
func _make_hud() -> Control:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.theme()
	var vb := VBoxContainer.new()
	vb.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	vb.offset_left = 48
	vb.offset_top = -170
	vb.offset_right = 420
	vb.offset_bottom = -48
	vb.add_theme_constant_override("separation", 10)
	root.add_child(vb)
	for v in [["HEALTH", 0.62, Color(0.85, 0.32, 0.28)], ["THIRST", 0.28, Color(0.35, 0.65, 0.95)], ["HUNGER", 0.55, Color(0.92, 0.66, 0.3)], ["MIND", 0.8, Color(0.7, 0.6, 0.95)]]:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		var l := UiKit.label(v[0], 17, Color(1, 1, 1, 0.8))
		l.add_theme_font_override("font", UiKit.display_font(700))
		l.custom_minimum_size.x = 80
		row.add_child(l)
		var bar := Control.new()
		bar.custom_minimum_size = Vector2(220, 8)
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var frac: float = v[1]
		var col: Color = v[2]
		bar.draw.connect(func() -> void:
			bar.draw_rect(Rect2(Vector2.ZERO, bar.size), Color(0, 0, 0, 0.45))
			bar.draw_rect(Rect2(Vector2.ZERO, Vector2(bar.size.x * frac, bar.size.y)), col)
			bar.draw_rect(Rect2(Vector2.ZERO, bar.size), Color(1, 1, 1, 0.2), false, 1.0))
		row.add_child(bar)
		vb.add_child(row)
	var obj := VBoxContainer.new()
	obj.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	obj.offset_left = -520
	obj.offset_right = -48
	obj.offset_top = 48
	obj.offset_bottom = 160
	root.add_child(obj)
	var oh := UiKit.label("OBJECTIVE", 17, UiKit.ACCENT)
	oh.add_theme_font_override("font", UiKit.display_font(700))
	oh.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	obj.add_child(oh)
	var ot := UiKit.label("Find fresh water before nightfall", 30, UiKit.SALT)
	ot.add_theme_font_override("font", UiKit.story_font(500))
	ot.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	obj.add_child(ot)
	var oa := UiKit.label("ابحث عن ماءٍ عذب قبل حلول الليل", 26, Color(1, 1, 1, 0.75))
	oa.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	oa.text_direction = Control.TEXT_DIRECTION_RTL
	obj.add_child(oa)
	# crosshair dot
	var dot := Control.new()
	dot.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	dot.draw.connect(func() -> void: dot.draw_circle(Vector2.ZERO, 2.5, Color(1, 1, 1, 0.7)))
	root.add_child(dot)
	return root


func tick(time: float, dt: float) -> void:
	var cam := _tr.cam
	# --- 1. loading screen (the real one from the game)
	if time < LOAD_END:
		var stages := [[0.0, "Raising the island"], [0.22, "Growing the jungle"], [0.55, "Filling the sea"], [0.82, "Waking up"]]
		var p := smoothstep(0.2, LOAD_END - 0.6, time)
		p = p * (0.85 + 0.15 * sin(p * 9.0) * (1.0 - p))
		var st := ""
		for s in stages:
			if p >= float(s[0]):
				st = s[1]
		loading.set_progress(clampf(p, 0.0, 1.0), st)
	loading.modulate.a = 1.0 - smoothstep(LOAD_END, LOAD_END + 0.8, time)
	loading.visible = loading.modulate.a > 0.0
	var head := spot + Vector3(0, 0.22, 0)
	# --- 2. black, then 3. eyes opening: lying on the sand, looking up past the palms
	if time < EYES_END:
		fade.color.a = 1.0 - smoothstep(BLACK_END, BLACK_END + 0.3, time)
		var e := time - BLACK_END
		var o := 0.0
		if e > 0.0:
			o = 0.35 * smoothstep(0.0, 0.6, e) * (1.0 - smoothstep(1.1, 1.4, e))      # first flutter, closes
			o += 0.55 * smoothstep(1.9, 2.6, e) * (1.0 - smoothstep(3.0, 3.25, e))    # opens, squeezes shut
			o += smoothstep(3.6, 5.2, e)                                              # and opens
		lids.set_shader_parameter("open", clampf(o, 0.0, 1.0))
		lids.set_shader_parameter("blur", lerpf(5.0, 0.0, smoothstep(3.5, 6.5, e)))
		lids.set_shader_parameter("tint", 0.4)
		# head rolls from the sky towards the sea
		var look := head + Vector3(0, 6, 4).lerp(Vector3(3, 1.2, 8), smoothstep(4.0, 6.8, e))
		_cam_pos = head
		_cam_look = look
	elif time < STAND_END:
		# --- 4. getting up: the view lifts, sways and settles on the wreck
		_lid_rect.visible = false
		var u := (time - EYES_END) / (STAND_END - EYES_END)
		var up := smoothstep(0.05, 0.45, u) * 0.75 + smoothstep(0.55, 0.85, u) * 0.68
		var sway := Vector3(sin(time * 2.1) * 0.08, 0, cos(time * 1.7) * 0.05) * (1.0 - u)
		_cam_pos = head + Vector3(0, up, 0) + sway
		_cam_look = _cam_pos + (Vector3(3, -0.5, 8).lerp(wreck.global_position + Vector3(0, 8, 0) - _cam_pos, smoothstep(0.4, 1.0, u)))
	else:
		# --- 5. the player has control: third person, walking the beach
		if not layla.visible:
			layla.visible = true
			layla.global_position = spot
			_face(wreck.global_position)
			_cam_pos = spot + Vector3(-1.2, 1.9, -2.8)
		var g := time - STAND_END
		if g > 3.0 and g < 21.0:
			if layla.anim.current_animation != "c/walk":
				layla.play("walk", 0.4, 0.9)
			_walk_d += dt * 1.15
			var p := _along(_walk_d)
			var ahead := _along(_walk_d + 1.0)
			layla.global_position = Vector3(p.x, _tr.ground(p.x, p.z), p.z)
			_face(ahead, dt)
		elif g >= 21.0 and layla.anim.current_animation != "c/look":
			layla.play("look", 0.5, 0.9)
		var fwd := -layla.global_basis.z
		var right := fwd.cross(Vector3.UP)
		# over-the-shoulder follow; the player swings the camera round to the sea for a moment
		var orbit := smoothstep(9.0, 11.5, g) * (1.0 - smoothstep(14.0, 16.5, g)) * 1.9
		var back := (-fwd).rotated(Vector3.UP, orbit)
		var want := layla.global_position + back * 3.0 + right * 0.55 + Vector3(0, 1.85, 0)
		var look := layla.global_position + Vector3(0, 1.45, 0) - back * 6.0
		if g < 0.05:
			_cam_pos = want
			_cam_look = look
		_cam_pos = _cam_pos.lerp(want, clampf(dt * 3.0, 0.0, 1.0))
		_cam_look = _cam_look.lerp(look, clampf(dt * 4.0, 0.0, 1.0))
		hud.modulate.a = smoothstep(1.0, 2.5, g)
		fade.color.a = smoothstep(duration - 1.6, duration - 0.2, time)
	cam.global_position = _cam_pos
	if not _cam_pos.is_equal_approx(_cam_look):
		cam.look_at(_cam_look, Vector3.UP)
	cam.fov = 62.0
	var tg := _tr.ground(_cam_pos.x, _cam_pos.z)
	if cam.global_position.y < tg + 0.15:
		cam.global_position.y = tg + 0.15


## A point on the sand `up` metres up the beach from the waterline at x.
func _sand(x: float, up: float) -> Vector3:
	var z := 420.0
	while z < 520.0 and _tr.ground(x, z) > 0.35:
		z += 0.5
	z -= up
	return Vector3(x, _tr.ground(x, z), z)


func _face(target: Vector3, dt := -1.0) -> void:
	var d := target - layla.global_position
	d.y = 0.0
	if d.length() < 0.01:
		return
	var yaw := atan2(-d.x, -d.z)
	layla.rotation.y = yaw if dt < 0.0 else lerp_angle(layla.rotation.y, yaw, clampf(dt * 3.0, 0.0, 1.0))


func _along(d: float) -> Vector3:
	var left := d
	for i in _path.size() - 1:
		var seg := _path[i].distance_to(_path[i + 1])
		if left <= seg:
			return _path[i].lerp(_path[i + 1], left / seg)
		left -= seg
	return _path[-1]
