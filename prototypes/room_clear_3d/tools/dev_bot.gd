extends Node
## Dev only (not exported). Usage: godot -- --bot=<mode> [--mission=N] [--shots=dir]
##   menu      screenshots of every menu screen
##   play      starts mission N and plays it (paths to objectives, shoots, throws grenades)
##   top       starts mission N and saves a top-down overview of the generated building
var menu: Node
var mission: Node
var mode := "menu"
var mission_index := 0
var out := "/tmp/claude-0/shots/"
var t := 0.0
var taken := {}
var log_t := 0.0
var _goal_i := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bot="): mode = a.split("=")[1]
		if a.begins_with("--mission="): mission_index = int(a.split("=")[1])
		if a.begins_with("--shots="): out = a.split("=")[1]
	DirAccess.make_dir_recursive_absolute(out)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--quality="):
			Game.quality = int(a.split("=")[1])


func _shot(name: String) -> void:
	if taken.has(name):
		return
	taken[name] = true
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + name + ".png")
	print("shot ", name)


func _process(delta: float) -> void:
	t += delta / maxf(Engine.time_scale, 0.05)
	if menu:
		_menu_flow()
	elif mission:
		_mission_flow(delta)
	if t > 240.0:
		print("TIMEOUT")
		get_tree().quit()


func _reach_report() -> void:
	for mi in Game.MISSIONS.size():
		var m: Dictionary = Game.MISSIONS[mi]
		var g := MapGen.generate(m["seed"], m["rooms"])
		var lv := Level.new()
		add_child(lv)
		lv.build(g)
		var bad := 0
		var total := 0
		var a := lv.free_cell(lv.to_cell(g.player_spawn))
		for ri in g.rooms.size():
			for sp in g.free_spots[ri]:
				total += 1
				var b := lv.to_cell(sp)
				if lv.nav.is_point_solid(b) or lv.nav.get_id_path(a, b).is_empty():
					bad += 1
					print("  m%d room %d (%s) spot %s unreachable solid=%s" % [mi, ri, g.rooms[ri]["type"], sp, lv.nav.is_point_solid(b)])
		print("mission %d: rooms=%d doors=%d props=%d spots=%d unreachable=%d" % [mi, g.rooms.size(), g.doors.size(), g.props.size(), total, bad])
		lv.free()
	get_tree().quit()


func _menu_flow() -> void:
	if mode == "reach":
		if t > 0.3:
			menu = null
			_reach_report()
		return
	if mode != "menu":
		if t > 0.5:
			Game.current = mission_index
			Game.start_mission(mission_index)
			menu = null
		return
	if t > 2.0: _shot("m1_main")
	if t > 2.2 and t < 2.4: menu.show_screen("campaign")
	if t > 3.6: _shot("m2_campaign")
	if t > 3.8 and t < 4.0: menu._open_brief(3)
	if t > 4.8: _shot("m3_brief")
	if t > 5.0 and t < 5.2:
		menu._brief.visible = false
		menu.show_screen("loadout")
	if t > 6.4: _shot("m4_loadout")
	if t > 6.6 and t < 6.8: menu.show_screen("settings")
	if t > 7.8: _shot("m5_settings")
	if t > 8.5: get_tree().quit()


func _mission_flow(delta: float) -> void:
	var m: Mission = mission
	var p: Player = m.player
	if mode == "perf":
		if t > 4.0:
			var lights := 0
			var shadowed := 0
			for n in m.find_children("*", "Light3D", true, false):
				if n.is_visible_in_tree():
					lights += 1
					shadowed += int(n.shadow_enabled)
			print("PERF q=%d draw_calls=%d objects=%d primitives=%d lights=%d shadowed=%d tex_MB=%.0f" % [Game.quality,
				Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
				Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
				Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME), lights, shadowed,
				Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0])
			get_tree().quit()
		return
	if mode == "top":
		if t > 1.0 and t < 1.2:
			var c := m.cam
			c.mode = GameCamera.Mode.ORBIT
			c.set_process(false)
			var b: Rect2 = m.map.bounds
			var h := maxf(b.size.x, b.size.y * 1.6) * 0.95
			c.look_at_from_position(Vector3(b.get_center().x, h, b.get_center().y + h * 0.25), Vector3(b.get_center().x, 0, b.get_center().y), Vector3.UP)
			m.hud.visible = false
		if t > 2.5: _shot("top_%02d" % mission_index)
		if t > 3.0: get_tree().quit()
		return
	if t > 2.0: _shot("g1_start_%02d" % mission_index)
	log_t -= delta
	if log_t <= 0.0 and m.state == "play":
		log_t = 1.0
		var alive := 0
		var st := []
		for e in m.enemies:
			if e.alive:
				alive += 1
				st.append(e.state_name())
		var gl := _goal(m)
		print("   goal=%s path=%d" % [gl.snapped(Vector3.ONE * 0.1), m.level.find_path(p.global_position, gl).size()])
		print("t=%.1f hp=%d ammo=%d nades=%d score=%d stage=%d kills=%d alive=%d %s pos=%s" % [t, p.hp, p.ammo, p.grenades, m.score, m.stage, m.kills, alive, str(st), p.global_position.snapped(Vector3.ONE * 0.1)])
	if m.state == "play" and p.alive:
		p.max_hp = 400.0 if t < 1.0 else p.max_hp   # bot gets a cushion so it can finish the run
		if t < 1.0:
			p.hp = 400.0
		var goal := _goal(m)
		var path: PackedVector3Array = m.level.find_path(p.global_position, goal)
		var mv := Vector2.ZERO
		if path.size() > 0:
			var d := path[0] - p.global_position
			mv = Vector2(d.x, d.z).normalized()
		var target: Soldier = null
		for e in m.enemies:
			if e.alive and e.global_position.distance_to(p.global_position) < 14.0 and p.can_see(e):
				target = e
				break
		if target:
			var to := target.global_position - p.global_position
			p.input_aim = Vector2(to.x, to.z).normalized()
			p.aim_trigger = true
			if to.length() < 6.0:
				mv = Vector2.ZERO
			if p.grenades > 0 and randf() < 0.004:
				p.throw_grenade(target.global_position)
		else:
			p.input_aim = Vector2.ZERO
			p.aim_trigger = false
		p.input_move = mv
		m.hud.move_id = 0 if mv.length() > 0 else -1
		m.hud.move_knob = m.hud.move_base + mv * m.hud.stick_r
		m.hud.aim_id = 1 if target else -1
		m.hud.aim_knob = m.hud.aim_base + p.input_aim * m.hud.stick_r
		m.hud.touch_seen = true
		if p.ammo < 5 and not target:
			p.start_reload()
	if m.state == "play" and t > 8.0: _shot("g2_fight_%02d" % mission_index)
	if m.state == "play" and m.kills >= 1: _shot("g3_kill_%02d" % mission_index)
	if m.state == "play" and p.is_throwing(): _shot("g4_grenade_%02d" % mission_index)
	if m.state == "over": _shot("g5_over_%02d" % mission_index)
	if m.hud.end_layer.visible and t > 0:
		if not taken.has("g6_end_wait"):
			taken["g6_end_wait"] = t
		elif t - float(taken["g6_end_wait"]) > 4.0:
			_shot("g6_end_%02d" % mission_index)
			if t - float(taken["g6_end_wait"]) > 4.5:
				print("END state=", m.state, " score=", m.score, " kills=", m.kills, " hp=", p.hp)
				get_tree().quit()


func _goal(m: Mission) -> Vector3:
	match m.type:
		"eliminate":
			if m.target and m.target.alive:
				return m.target.global_position
		"intel", "rescue", "defuse":
			if m.stage == 0 and m.objective_zone:
				return m.objective_zone.global_position
			if m.extract_zone.active:
				return m.extract_zone.global_position
	for e in m.enemies:
		if e.alive:
			return e.global_position
	return m.player.global_position
