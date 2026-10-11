extends Node
## Dev only (not exported): `godot -- --autoplay=<win|lose|menu> --shots=<dir>` plays the game
## by itself, saves screenshots along the way and prints a log, then quits.
var main: Node
var mode := "win"
var out := "/tmp/claude-0/shots/"
var t := 0.0
var shots_taken := {}
var log_t := 0.0

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--autoplay="): mode = a.split("=")[1]
		if a.begins_with("--shots="): out = a.split("=")[1]
	DirAccess.make_dir_recursive_absolute(out)
	process_mode = Node.PROCESS_MODE_ALWAYS

func _shot(name: String) -> void:
	if shots_taken.has(name): return
	shots_taken[name] = true
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + name + ".png")
	print("shot ", name)

func _process(delta: float) -> void:
	var rd := delta / maxf(Engine.time_scale, 0.05)
	t += rd
	var p: Player = main.player
	var e: Enemy = main.enemy
	if t > 1.5: _shot("01_menu")
	if mode == "menu":
		if t > 2.0: get_tree().quit()
		return
	if t > 2.0 and main.state == "menu": main.start_game()
	if t > 3.0: _shot("02_banner")
	log_t -= rd
	if log_t <= 0.0 and main.state == "play":
		log_t = 1.0
		print("t=%.1f p=%s hp=%d ammo=%d | e=%s hp=%d state=%s sees=%s crouch=%s" % [t, p.global_position.snapped(Vector3.ONE*0.1), p.hp, p.ammo, e.global_position.snapped(Vector3.ONE*0.1), e.hp, e.state_name(), e._sees, e.crouching])
	if main.state == "play" and p.alive:
		if mode == "cover":
			p.damage = 9.0
		if mode == "win" or mode == "cover":
			# path toward the target; hold position and shoot once locked on
			var path: PackedVector3Array = main.level.find_path(p.global_position, e.global_position)
			var mv := Vector2.ZERO
			if path.size() > 0:
				var d := path[0] - p.global_position
				mv = Vector2(d.x, d.z).normalized()
			var dist := p.global_position.distance_to(e.global_position)
			if p.locked and dist < 8.0:
				mv = Vector2.ZERO if fmod(t, 3.0) < 2.0 else mv.orthogonal() * 0.6
			p.input_move = mv
			p.fire_held = p.locked
			main.hud.stick_id = 0 if mv.length() > 0 else -1
			main.hud.stick_knob = main.hud.stick_base + mv * main.hud.stick_r
			if p.ammo < 6 and not p.locked: p.start_reload()
		else:
			# "lose": walk into the open east room and stand there, firing a few wild shots
			var goal := Vector3(5.0, 0, 2.8)
			var path: PackedVector3Array = main.level.find_path(p.global_position, goal)
			var mv := Vector2.ZERO
			if path.size() > 0 and p.global_position.distance_to(goal) > 0.4:
				var d := path[0] - p.global_position
				mv = Vector2(d.x, d.z).normalized()
			p.input_move = mv
			p.fire_held = p.locked and fmod(t, 4.0) < 0.5
	if main.state == "play" and t > 9.0: _shot("03_fight")
	if main.state == "play" and e.state == Enemy.S.COVER and e._cover_phase == 0: _shot("04_cover_run")
	if main.state == "play" and e.state == Enemy.S.COVER and e._cover_phase == 1 and e.crouch_k > 0.9: _shot("04_cover_crouch")
	if main.state == "play" and e.state == Enemy.S.COVER and e._cover_phase == 2: _shot("04_cover_peek")
	if main.state == "play" and p.hits > 0 and e.alive: _shot("03b_hit")
	if main.state == "play" and p.is_reloading(): _shot("05_reload")
	if main.state == "over": _shot("06_killcam")
	if main.hud.end_screen.visible and main.hud.end_screen.modulate.a > 0.95:
		_shot("07_end")
		print("END win=", not e.alive, " shots=", p.shots, " hits=", p.hits)
		get_tree().quit()
	if t > 120.0:
		print("TIMEOUT"); get_tree().quit()
