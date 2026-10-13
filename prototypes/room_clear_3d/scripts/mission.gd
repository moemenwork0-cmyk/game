class_name Mission
extends Node3D
## One operation: generates the building from the mission seed, spawns the squad of hostiles,
## sets up the objective (eliminate / clear / intel / rescue / defuse), extraction, pickups,
## scoring, stars, slow-motion finish and the end screen.

signal objective_changed

var def: Dictionary
var type := "eliminate"
var map: MapGen
var level: Level
var player: Player
var enemies: Array[Enemy] = []
var target: Enemy
var hostage: Hostage
var cam: GameCamera
var hud: Hud
var env: Environment
var zones: Array[Zone] = []
var extract_zone: Zone
var objective_zone: Zone
var bomb: Node3D
var state := "intro"        # intro | play | over
var stage := 0              # 0 main objective, 1 extract
var play_time := 0.0
var time_limit := 0.0
var score := 0
var kills := 0
var stealth_kills := 0
var _last_kill_t := -10.0
var _multi := 0
var _hb_t := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	Engine.time_scale = 1.0
	def = Game.mission_def()
	type = def["type"]
	_rng.seed = int(def["seed"]) * 7 + 3
	_environment()
	map = MapGen.generate(def["seed"], def["rooms"])
	level = Level.new()
	add_child(level)
	level.build(map)
	Fx.setup(self)
	_spawn_player()
	_spawn_enemies()
	_setup_objective()
	_spawn_pickups()
	cam = GameCamera.new()
	add_child(cam)
	cam.follow = player
	cam.current = true
	cam.mode = GameCamera.Mode.FOLLOW
	cam.bounds = map.bounds.grow(-1.5)
	cam.snap()
	hud = Hud.new()
	hud.mission = self
	hud.player = player
	hud.cam = cam
	add_child(hud)
	Sfx.ambience.play()
	Sfx.music("combat_bed", -16.0)
	state = "play"
	hud.show_intro(def["name"], Game.TYPE_INFO[type]["title"], Game.TYPE_INFO[type]["icon"])
	Sfx.play("stinger", -4.0)
	var dev := OS.get_cmdline_user_args()
	if dev.size() > 0 and ResourceLoader.exists("res://tools/dev_bot.gd"):
		var bot: Node = load("res://tools/dev_bot.gd").new()
		bot.set("mission", self)
		add_child(bot)


# ------------------------------------------------------------------ setup

func _environment() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	we.environment = env
	add_child(we)
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.012, 0.014, 0.018)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.38, 0.42, 0.5)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.15
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.07
	if Game.quality >= 2:
		env.ssao_enabled = true
		env.ssao_radius = 1.2
		env.ssao_intensity = 2.2
		env.volumetric_fog_enabled = true
		env.volumetric_fog_density = 0.012
		env.volumetric_fog_albedo = Color(0.8, 0.85, 0.9)
	var moon := DirectionalLight3D.new()
	moon.rotation = Vector3(deg_to_rad(-62), deg_to_rad(28), 0)
	moon.light_color = Color(0.6, 0.7, 1.0)
	moon.light_energy = 0.38
	moon.shadow_enabled = true
	moon.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	moon.directional_shadow_max_distance = 26.0
	moon.light_volumetric_fog_energy = 0.0
	add_child(moon)
	var vp := get_viewport()
	match Game.quality:
		0:
			vp.scaling_3d_scale = 0.7
			vp.msaa_3d = Viewport.MSAA_DISABLED
			vp.mesh_lod_threshold = 6.0
			moon.directional_shadow_max_distance = 18.0
		1:
			vp.scaling_3d_scale = 0.85 if OS.has_feature("web") else 1.0
			vp.msaa_3d = Viewport.MSAA_2X
			vp.mesh_lod_threshold = 3.0
		_:
			vp.scaling_3d_scale = 1.0
			vp.msaa_3d = Viewport.MSAA_2X
			vp.mesh_lod_threshold = 1.5


func _spawn_player() -> void:
	player = Player.new()
	player.aim_yaw = 0.0
	add_child(player)
	player.global_position = map.player_spawn
	player.fired.connect(func() -> void:
		for e in enemies:
			e.hear_noise(player.global_position, 20.0 if player.weapon_id != "shotgun" else 24.0)
		Fx.shake(0.05 * player.kick))
	player.hurt.connect(func(_a: float, from: Vector3) -> void:
		hud.on_player_hurt(from)
		Fx.shake(0.32)
		if Game.is_phone():
			Input.vibrate_handheld(35))
	player.died.connect(_on_player_died)


func _spawn_enemies() -> void:
	var n: int = def["enemies"]
	var heavies: int = def.get("heavy", 0)
	var idx: int = Game.current if Game.current >= 0 else 6
	var difficulty := lerpf(0.75, 1.3, clampf(idx / 11.0, 0.0, 1.0))
	# rooms ordered by distance from the entrance (deeper rooms get more guards)
	var order: Array = range(map.rooms.size())
	order.sort_custom(func(a: int, b: int) -> bool: return map.rooms[a]["dist"] > map.rooms[b]["dist"])
	var kinds: Array[String] = []
	if type == "eliminate":
		kinds.append("target")
	for i in heavies:
		kinds.append("heavy")
	while kinds.size() < n + (1 if type == "eliminate" else 0):
		kinds.append("shotgunner" if idx >= 2 and _rng.randf() < 0.25 else "rifleman")
	var used_room_count := {}
	for k in kinds.size():
		var kind := kinds[k]
		var room: int
		if kind == "target":
			room = map.far_room
		else:
			# weighted toward deep rooms, never the entrance room for the first guards
			var pick: int = order[mini(int(pow(_rng.randf(), 1.6) * order.size()), order.size() - 1)]
			if pick == map.entrance_room and _rng.randf() < 0.8:
				pick = order[0]
			room = pick
		used_room_count[room] = used_room_count.get(room, 0) + 1
		var spots: Array = map.free_spots[room]
		var pos: Vector3 = spots[(used_room_count[room] - 1) % spots.size()]
		var e := Enemy.new()
		e.kind = kind
		e.level = level
		e.player = player
		e.difficulty = difficulty
		e.aim_yaw = _rng.randf() * TAU
		# patrol route through neighbouring rooms (about half the guards); others hold posts
		if kind != "target" and _rng.randf() < 0.55:
			e.route = _route_from(room)
		add_child(e)
		e.add_to_group("enemies")
		e.global_position = pos
		e.died.connect(_on_enemy_died.bind(e))
		e.spotted.connect(_on_spotted.bind(e))
		e.alerted.connect(func(kind_s: String) -> void: hud.on_alert(e, kind_s))
		enemies.append(e)
		if kind == "target":
			target = e


func _route_from(room: int) -> Array[Vector3]:
	var r: Array[Vector3] = []
	r.append(map.free_spots[room][0])
	var cur := room
	for step in _rng.randi_range(1, 3):
		var nexts := []
		for di in map.rooms[cur]["doors"]:
			for j in map.doors[di]["rooms"]:
				if j >= 0 and j != cur:
					nexts.append(j)
		if nexts.is_empty():
			break
		cur = nexts[_rng.randi() % nexts.size()]
		var sp: Array = map.free_spots[cur]
		r.append(sp[_rng.randi() % sp.size()])
	return r


func _setup_objective() -> void:
	var far: Dictionary = map.rooms[map.far_room]
	var spots: Array = map.free_spots[map.far_room]
	match type:
		"intel":
			var at: Vector3 = spots[spots.size() - 1]
			if not level.intel_props.is_empty():
				at = level.intel_props[0].global_position
				at.y = 0
			objective_zone = _zone(at, 1.4, 1.6, "laptop", Color(0.4, 0.85, 1.0))
		"rescue":
			hostage = Hostage.new()
			hostage.level = level
			add_child(hostage)
			hostage.global_position = spots[spots.size() - 1]
			hostage.died.connect(func(_k: Soldier, _h: bool) -> void: _fail("THE HOSTAGE WAS KILLED"))
			objective_zone = _zone(hostage.global_position, 1.3, 1.2, "handcuffed", Color(0.4, 0.85, 1.0))
		"defuse":
			bomb = _make_bomb(spots[spots.size() - 1])
			objective_zone = _zone(bomb.global_position, 1.3, 4.0, "time-bomb", Color(1.0, 0.35, 0.25))
			time_limit = float(def.get("time", 150))
	if objective_zone:
		objective_zone.completed.connect(_on_objective_zone)
	extract_zone = _zone(map.player_spawn + Vector3(0, 0, -0.2), 1.6, 1.0, "exit-door", Color(0.55, 0.92, 0.45))
	extract_zone.active = false
	extract_zone.completed.connect(_on_extracted)


func _zone(at: Vector3, r: float, hold: float, icon: String, col: Color) -> Zone:
	var z := Zone.new()
	z.radius = r
	z.hold = hold
	z.icon = icon
	z.color = col
	z.player = player
	add_child(z)
	z.global_position = Vector3(at.x, 0, at.z)
	zones.append(z)
	return z


func _make_bomb(at: Vector3) -> Node3D:
	var root := StaticBody3D.new()
	root.set_meta("surface", "metal")
	add_child(root)
	root.global_position = at
	var case_mat := StandardMaterial3D.new()
	case_mat.albedo_color = Color(0.14, 0.16, 0.13)
	case_mat.roughness = 0.6
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.7, 0.32, 0.5)
	mi.mesh = bm
	mi.material_override = case_mat
	mi.position.y = 0.16
	root.add_child(mi)
	for i in 3:
		var c := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.07
		cm.bottom_radius = 0.07
		cm.height = 0.5
		c.mesh = cm
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.6, 0.45, 0.25)
		c.material_override = m
		c.rotation.z = PI / 2
		c.position = Vector3(0, 0.38, -0.15 + i * 0.15)
		root.add_child(c)
	var screen := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.22, 0.02, 0.12)
	screen.mesh = sm
	var em := StandardMaterial3D.new()
	em.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	em.albedo_color = Color(3.0, 0.3, 0.2)
	screen.material_override = em
	screen.position = Vector3(0.18, 0.33, 0.12)
	root.add_child(screen)
	var l := OmniLight3D.new()
	l.light_color = Color(1, 0.2, 0.1)
	l.omni_range = 2.5
	l.light_energy = 1.5
	l.position.y = 0.6
	l.name = "Blink"
	root.add_child(l)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = bm.size
	cs.shape = bs
	cs.position.y = 0.16
	root.add_child(cs)
	return root


func _spawn_pickups() -> void:
	var count := maxi(1, map.rooms.size() / 3)
	for i in count:
		var room := _rng.randi() % map.rooms.size()
		if room == map.entrance_room:
			continue
		var sp: Array = map.free_spots[room]
		_drop(sp[_rng.randi() % sp.size()], "medkit" if i % 2 == 0 else "grenade")


func _drop(at: Vector3, kind: String) -> void:
	var p := Pickup.new()
	p.kind = kind
	add_child(p)
	p.global_position = Vector3(at.x, 0, at.z)


# ------------------------------------------------------------------ objective state

func objective_text() -> String:
	match type:
		"eliminate":
			return "ELIMINATE THE TARGET" if stage == 0 else "TARGET DOWN"
		"clear":
			return "CLEAR ALL HOSTILES  %d / %d" % [kills, enemies.size()]
		"intel":
			return "RECOVER THE INTEL" if stage == 0 else "EXTRACT WITH THE INTEL"
		"rescue":
			return "FREE THE HOSTAGE" if stage == 0 else "ESCORT THE HOSTAGE OUT"
		"defuse":
			return "DEFUSE THE BOMB" if stage == 0 else "BOMB DEFUSED"
	return ""


func objective_icon() -> String:
	if stage == 1 and type in ["intel", "rescue"]:
		return "exit-door"
	return Game.TYPE_INFO[type]["icon"]


## World positions the HUD should mark (objective first).
func markers() -> Array:
	var out := []
	if state != "play":
		return out
	match type:
		"eliminate":
			if target and target.alive:
				out.append({"pos": target.head_pos() + Vector3(0, 0.5, 0), "icon": "targeted", "col": UiKit.RED, "who": target})
		"clear":
			pass
		_:
			if stage == 0 and objective_zone:
				out.append({"pos": objective_zone.global_position + Vector3(0, 1.4, 0), "icon": objective_zone.icon, "col": objective_zone.color, "who": null})
	if extract_zone.active:
		out.append({"pos": extract_zone.global_position + Vector3(0, 1.4, 0), "icon": "exit-door", "col": UiKit.GREEN, "who": null})
	return out


func time_left() -> float:
	return maxf(time_limit - play_time, 0.0) if time_limit > 0.0 else -1.0


func _process(delta: float) -> void:
	if state != "play":
		return
	play_time += delta
	# low health: drain colour, heartbeat
	var k := clampf(player.hp / 60.0, 0.0, 1.0) if player.alive else 0.0
	env.adjustment_saturation = lerpf(0.3, 1.0, k)
	if player.alive and player.hp < 35.0:
		_hb_t -= delta
		if _hb_t <= 0.0:
			_hb_t = 0.85
			Sfx.play("heartbeat", -2.0)
	# camera keeps the nearest engaged hostile in frame
	var best: Enemy
	var bd := 14.0
	for e in enemies:
		if e.alive and e.aware:
			var d := e.global_position.distance_to(player.global_position)
			if d < bd:
				bd = d
				best = e
	cam.threat = best
	if bomb:
		var b := bomb.get_node_or_null("Blink") as OmniLight3D
		if b:
			b.visible = fmod(play_time, 0.5 if time_left() > 20.0 else 0.2) < 0.1
		if stage == 0 and time_limit > 0.0:
			var tl := time_left()
			if int(tl) != int(tl + delta) and tl < 15.0:
				Sfx.play("beep", -6.0, 1.0 + (15.0 - tl) * 0.03)
			if tl <= 0.0:
				Fx.explosion(bomb.global_position + Vector3(0, 0.3, 0))
				Fx.explosion(bomb.global_position + Vector3(0.8, 0.5, 0.4))
				_fail("THE BOMB DETONATED")
	# rescue: extraction only counts when the hostage made it too
	if type == "rescue" and stage == 1 and extract_zone.active and hostage and hostage.alive:
		var hd := hostage.global_position.distance_to(extract_zone.global_position)
		if hd > 3.5:
			extract_zone.progress = minf(extract_zone.progress, 0.6)


func _on_objective_zone() -> void:
	match type:
		"intel":
			Sfx.play("objective", -2.0)
			if not level.intel_props.is_empty():
				level.intel_props[0].queue_free()
			_add_score(400, "INTEL SECURED", UiKit.CYAN)
			stage = 1
			extract_zone.active = true
		"rescue":
			hostage.freed = true
			hostage.leader = player
			Sfx.play("objective", -2.0)
			_add_score(400, "HOSTAGE FREED", UiKit.CYAN)
			stage = 1
			extract_zone.active = true
		"defuse":
			stage = 1
			Sfx.play("objective", -2.0)
			_add_score(500 + int(time_left()) * 5, "BOMB DEFUSED", UiKit.GREEN)
			var b := bomb.get_node_or_null("Blink") as OmniLight3D
			if b:
				b.queue_free()
			_win(false)
	objective_changed.emit()


func _on_extracted() -> void:
	_add_score(300, "EXTRACTED", UiKit.GREEN)
	_win(false)


func _on_spotted(pos: Vector3, who: Enemy) -> void:
	for e in enemies:
		if e != who and e.alive and e.global_position.distance_to(who.global_position) < 14.0:
			e.alert_to(pos)


func _on_enemy_died(killer: Soldier, head: bool, e: Enemy) -> void:
	if killer != player and killer != null and not (killer is Player):
		pass
	kills += 1
	var pts := 100
	var tag := "ELIMINATED"
	if head:
		pts += 50
		tag = "HEADSHOT"
	if not e.aware:
		pts += 75
		stealth_kills += 1
		tag = "SILENT KILL" if not head else "SILENT HEADSHOT"
	if play_time - _last_kill_t < 2.5:
		_multi += 1
		pts += 100 * _multi
		tag = ["", "DOUBLE KILL", "TRIPLE KILL", "MULTI KILL"][mini(_multi, 3)]
	else:
		_multi = 0
	_last_kill_t = play_time
	_add_score(pts, tag, UiKit.RED if head else UiKit.AMBER, e.head_pos() + Vector3(0, 0.4, 0))
	hud.on_kill(e, head)
	Fx.hitstop(0.05 if not head else 0.08)
	if _rng.randf() < 0.3:
		_drop(e.global_position, "medkit" if _rng.randf() < 0.6 else "grenade")
	var alive_n := 0
	for x in enemies:
		if x.alive:
			alive_n += 1
	if type == "eliminate" and e == target:
		stage = 1
		_add_score(500, "TARGET ELIMINATED", UiKit.GREEN)
		_win(true, e)
	elif type == "clear" and alive_n == 0:
		_add_score(500, "AREA CLEAR", UiKit.GREEN)
		_win(true, e)
	objective_changed.emit()


func _add_score(pts: int, tag: String, col: Color, at := Vector3.INF) -> void:
	score += pts
	hud.on_score(pts, tag, col, player.global_position + Vector3(0, 2.0, 0) if at == Vector3.INF else at)


# ------------------------------------------------------------------ end

func _win(killcam: bool, focus: Node3D = null) -> void:
	if state != "play":
		return
	state = "over"
	for e in enemies:
		e.set_physics_process(false)
	hud.playing = false
	if killcam and focus:
		cam.focus = focus
		cam.mode = GameCamera.Mode.KILLCAM
		Engine.time_scale = 0.2
		Fx.shake(0.4)
		await get_tree().create_timer(0.5, true, false, true).timeout
		create_tween().set_ignore_time_scale(true).tween_property(Engine, "time_scale", 1.0, 1.0)
		await get_tree().create_timer(1.8, true, false, true).timeout
	else:
		await get_tree().create_timer(1.0, true, false, true).timeout
	Engine.time_scale = 1.0
	Sfx.play("win", -2.0)
	_finish(true, "")


func _on_player_died(_k: Soldier, _h: bool) -> void:
	_fail("KILLED IN ACTION")


func _fail(reason: String) -> void:
	if state != "play":
		return
	state = "over"
	hud.playing = false
	cam.focus = player
	cam.mode = GameCamera.Mode.KILLCAM
	Engine.time_scale = 0.35
	await get_tree().create_timer(0.9, true, false, true).timeout
	Engine.time_scale = 1.0
	await get_tree().create_timer(0.9, true, false, true).timeout
	Sfx.play("lose", -2.0)
	_finish(false, reason)


func par_time() -> float:
	return 30.0 + map.rooms.size() * 12.0


func _finish(win: bool, reason: String) -> void:
	var acc := 100.0 * player.hits / maxf(player.shots, 1)
	var breakdown := []
	var total := score
	if win:
		var tb := int(maxf(par_time() - play_time, 0.0) * 5.0)
		var hb := int(player.hp * 2.0)
		var ab := int(acc * 3.0)
		breakdown = [["KILLS & OBJECTIVES", score], ["TIME BONUS", tb], ["HEALTH BONUS", hb], ["ACCURACY BONUS", ab]]
		total += tb + hb + ab
	var stars_n := 0
	if win:
		stars_n = 1 + (1 if player.hp >= 50.0 else 0) + (1 if play_time <= par_time() else 0)
	var rec := Game.record(win, stars_n, total)
	Sfx.music("", 0.0)
	hud.show_end({"win": win, "reason": reason, "stars": stars_n, "score": total, "breakdown": breakdown,
		"time": play_time, "par": par_time(), "accuracy": acc, "kills": kills, "headshots": player.headshots,
		"xp": rec["xp"], "unlocks": rec["unlocks"], "new_rank": rec["new_rank"]})


func restart() -> void:
	if Game.current >= 0:
		Game.start_mission(Game.current)
	else:
		Game._go("res://scenes/game.tscn")


func next_mission() -> void:
	if Game.current >= 0 and Game.current + 1 < Game.MISSIONS.size():
		Game.start_mission(Game.current + 1)
	else:
		Game.to_menu()
