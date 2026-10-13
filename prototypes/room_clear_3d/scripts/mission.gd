class_name Mission
extends Node3D
## One operation: generates the building from the mission seed, spawns the squad of hostiles,
## sets up the mission objective, extraction, pickups, scoring, stars and the end screen.
## Types: eliminate, clear, intel, docs, rescue (1-2 hostages), defuse, sabotage (plant charges
## and get clear), stealth (being seen raises an alarm + response team), runner (target bolts
## for an escape point) and defend (call the chopper from the radio room and hold out).

signal objective_changed

var def: Dictionary
var type := "eliminate"
var map: MapGen
var level: Level
var player: Player
var enemies: Array[Enemy] = []
var target: Enemy
var hostage: Hostage                 ## first hostage (kept for older callers)
var hostage_list: Array[Hostage] = []
var cam: GameCamera
var hud: Hud
var env: Environment
var zones: Array[Zone] = []
var obj_zones: Array[Zone] = []      ## stage-0 objectives still to complete
var obj_total := 0
var obj_done := 0
var extract_zone: Zone
var objective_zone: Zone
var escape_zone: Zone
var bomb: Node3D
var charges: Array[Node3D] = []
var state := "intro"        # intro | play | over
var stage := 0              # 0 main objective, 1 extract / hold
var play_time := 0.0
var deadline := -1.0        # play_time at which the running timer hits zero
var score := 0
var kills := 0
var stealth_kills := 0
var alarm := false
var difficulty := 1.0
var _last_kill_t := -10.0
var _multi := 0
var _hb_t := 0.0
var _wave_t := 0.0
var _siren_t := 0.0
var _cull_t := 0.0
var _marks: MultiMeshInstance3D
var _marks_t := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	Engine.time_scale = 1.0
	def = Game.mission_def()
	type = def["type"]
	_rng.seed = int(def["seed"]) * 7 + 3
	var idx: int = Game.current if Game.current >= 0 else 6
	difficulty = lerpf(0.45, 1.15, clampf(idx / 11.0, 0.0, 1.0))
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
	_build_route_marks()
	Sfx.ambience.play()
	Sfx.music("combat_bed", -14.0)
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
	env.glow_enabled = Game.quality > 0
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
	# rooms ordered by distance from the entrance (deeper rooms get more guards)
	var order: Array = range(map.rooms.size())
	order.sort_custom(func(a: int, b: int) -> bool: return map.rooms[a]["dist"] > map.rooms[b]["dist"])
	var kinds: Array[String] = []
	if type in ["eliminate", "runner"]:
		kinds.append("target")
	for i in heavies:
		kinds.append("heavy")
	while kinds.size() < n + (1 if type in ["eliminate", "runner"] else 0):
		kinds.append("shotgunner" if idx >= 3 and _rng.randf() < 0.25 else "rifleman")
	var used_room_count := {}
	for k in kinds.size():
		var kind := kinds[k]
		var room: int
		if kind == "target":
			room = map.far_room
		else:
			# weighted toward deep rooms, rarely the entrance room
			var pick: int = order[mini(int(pow(_rng.randf(), 1.6) * order.size()), order.size() - 1)]
			if pick == map.entrance_room and _rng.randf() < 0.85:
				pick = order[0]
			room = pick
		used_room_count[room] = used_room_count.get(room, 0) + 1
		var spots: Array = map.free_spots[room]
		var pos: Vector3 = spots[(used_room_count[room] - 1) % spots.size()]
		var rt: Array[Vector3] = []
		if kind != "target" and _rng.randf() < 0.55:
			rt = _route_from(room)
		var e := _spawn_enemy(kind, pos, rt)
		if kind == "target":
			target = e
			if type == "runner":
				e.max_hp = 110.0
				e.hp = e.max_hp


func _spawn_enemy(kind: String, pos: Vector3, rt: Array[Vector3] = []) -> Enemy:
	var e := Enemy.new()
	e.kind = kind
	e.level = level
	e.player = player
	e.difficulty = difficulty
	e.aim_yaw = _rng.randf() * TAU
	e.route = rt
	add_child(e)
	e.add_to_group("enemies")
	e.global_position = pos
	e.died.connect(_on_enemy_died.bind(e))
	e.spotted.connect(_on_spotted.bind(e))
	e.alerted.connect(func(kind_s: String) -> void: hud.on_alert(e, kind_s))
	enemies.append(e)
	return e


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


## Rooms for spread-out objectives: deepest first, skipping the entrance, one per room.
func _objective_rooms(count: int) -> Array:
	var order: Array = range(map.rooms.size())
	order.erase(map.entrance_room)
	order.sort_custom(func(a: int, b: int) -> bool: return map.rooms[a]["dist"] > map.rooms[b]["dist"])
	var out := []
	# take every other room so the objectives sit in different parts of the building
	var stride := maxi(1, order.size() / maxi(count, 1))
	var i := 0
	while out.size() < count and i < order.size():
		out.append(order[i])
		i += stride
	for r in order:
		if out.size() >= count:
			break
		if not r in out:
			out.append(r)
	return out


func _setup_objective() -> void:
	var spots: Array = map.free_spots[map.far_room]
	match type:
		"intel", "stealth":
			var at: Vector3 = spots[spots.size() - 1]
			if not level.intel_props.is_empty():
				at = level.intel_props[0].global_position
				at.y = 0
			objective_zone = _zone(at, 1.4, 1.6, "laptop", Color(0.4, 0.85, 1.0))
			obj_zones.append(objective_zone)
		"docs":
			for r in _objective_rooms(int(def.get("docs", 3))):
				var sp: Array = map.free_spots[r]
				var at: Vector3 = sp[_rng.randi() % sp.size()]
				var z := _zone(at, 1.1, 0.7, "files", Color(0.95, 0.85, 0.45))
				z.set_meta("item", _make_docs(at))
				obj_zones.append(z)
		"rescue":
			var rooms := _objective_rooms(int(def.get("hostages", 1)))
			for r in rooms:
				var sp: Array = map.free_spots[r]
				var h := Hostage.new()
				h.level = level
				add_child(h)
				h.global_position = sp[sp.size() - 1]
				h.died.connect(func(_k: Soldier, _h: bool) -> void: _fail("A HOSTAGE WAS KILLED"))
				hostage_list.append(h)
				var z := _zone(h.global_position, 1.3, 1.2, "handcuffed", Color(0.4, 0.85, 1.0))
				z.set_meta("hostage", h)
				obj_zones.append(z)
			hostage = hostage_list[0]
		"defuse":
			bomb = _make_bomb(spots[spots.size() - 1])
			objective_zone = _zone(bomb.global_position, 1.3, 4.0, "time-bomb", Color(1.0, 0.35, 0.25))
			obj_zones.append(objective_zone)
			deadline = float(def.get("time", 150))
		"sabotage":
			for at in _cache_spots(int(def.get("caches", 3))):
				var z := _zone(at, 1.7, 2.0, "dynamite", Color(1.0, 0.55, 0.2))
				obj_zones.append(z)
		"runner":
			# his escape car waits in the room furthest from his own
			var tr: Rect2 = map.rooms[map.far_room]["rect"]
			var best := map.entrance_room
			var bd := -1.0
			for i in map.rooms.size():
				if i == map.far_room or i == map.entrance_room:
					continue
				var d: float = (map.rooms[i]["rect"] as Rect2).get_center().distance_to(tr.get_center())
				if d > bd:
					bd = d
					best = i
			var sp: Array = map.free_spots[best]
			escape_zone = _zone(sp[sp.size() - 1], 1.2, 99.0, "run", UiKit.RED)
			escape_zone.active = false
			target.escape_to = escape_zone.global_position
		"defend":
			var at: Vector3 = spots[spots.size() - 1]
			objective_zone = _zone(at, 1.6, 2.5, "radio-tower", Color(0.4, 0.85, 1.0))
			obj_zones.append(objective_zone)
	obj_total = obj_zones.size()
	for z in obj_zones:
		z.completed.connect(_on_objective_zone.bind(z))
	extract_zone = _zone(map.player_spawn + Vector3(0, 0, -0.2), 1.6, 1.0, "exit-door", Color(0.55, 0.92, 0.45))
	extract_zone.active = false
	extract_zone.completed.connect(_on_extracted)


## Weapon caches: existing crates in different rooms, or a free spot when a room has none.
func _cache_spots(count: int) -> Array:
	var out := []
	var used := {}
	for r in _objective_rooms(count * 2):
		if out.size() >= count:
			break
		var found := false
		for pr in map.props:
			var id: String = pr["id"]
			var pp: Vector3 = pr["pos"]
			if "crate" in id and pp.y < 0.05 and not pr["opts"].get("dynamic", false) and level.room_at(pp) == r:
				out.append(pp)
				found = true
				break
		if not found:
			var sp: Array = map.free_spots[r]
			out.append(sp[0])
		used[r] = true
	return out


func _make_docs(at: Vector3) -> Node3D:
	var root := Node3D.new()
	add_child(root)
	root.global_position = Vector3(at.x, 0, at.z)
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.92, 0.88, 0.76)
	m.emission_enabled = true
	m.emission = Color(1.0, 0.85, 0.45)
	m.emission_energy_multiplier = 0.6
	for i in 3:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.32, 0.025, 0.24)
		mi.mesh = bm
		mi.material_override = m
		mi.position = Vector3(0.03 * i, 0.02 + 0.026 * i, -0.02 * i)
		mi.rotation.y = 0.3 * i - 0.2
		root.add_child(mi)
	return root


func _make_charge(at: Vector3) -> Node3D:
	var root := Node3D.new()
	add_child(root)
	root.global_position = at + Vector3(0, 1.0, 0)
	var q := PhysicsRayQueryParameters3D.create(at + Vector3(0, 2.0, 0), at - Vector3(0, 0.2, 0), 1 | 4)
	var h := get_world_3d().direct_space_state.intersect_ray(q)
	if not h.is_empty():
		root.global_position = h.position
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.55, 0.42, 0.24)
	for i in 3:
		var c := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.05
		cm.bottom_radius = 0.05
		cm.height = 0.34
		c.mesh = cm
		c.material_override = m
		c.rotation.z = PI / 2
		c.position = Vector3(0, 0.05, -0.1 + i * 0.1)
		root.add_child(c)
	var l := OmniLight3D.new()
	l.light_color = Color(1, 0.15, 0.1)
	l.omni_range = 1.8
	l.light_energy = 1.4
	l.position.y = 0.25
	l.name = "Blink"
	root.add_child(l)
	return root


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

func hostages() -> Array[Hostage]:
	return hostage_list


func objective_text() -> String:
	match type:
		"eliminate":
			return "ELIMINATE THE TARGET" if stage == 0 else "TARGET DOWN"
		"runner":
			return "STOP THE RUNNER" if stage == 0 else "TARGET DOWN"
		"clear":
			return "CLEAR ALL HOSTILES  %d / %d" % [kills, enemies.size()]
		"intel":
			return "RECOVER THE INTEL" if stage == 0 else "EXTRACT WITH THE INTEL"
		"stealth":
			return "STEAL THE CODES" if stage == 0 else "EXTRACT WITH THE CODES"
		"docs":
			return "COLLECT THE DOCUMENTS  %d / %d" % [obj_done, obj_total] if stage == 0 else "EXTRACT WITH THE DOCUMENTS"
		"rescue":
			if stage == 0:
				return "FREE THE HOSTAGE" if obj_total == 1 else "FREE THE HOSTAGES  %d / %d" % [obj_done, obj_total]
			return "ESCORT THE HOSTAGE OUT" if obj_total == 1 else "ESCORT THE HOSTAGES OUT"
		"defuse":
			return "DEFUSE THE BOMB" if stage == 0 else "BOMB DEFUSED"
		"sabotage":
			return "PLANT CHARGES ON THE CACHES  %d / %d" % [obj_done, obj_total] if stage == 0 else "GET CLEAR OF THE BLAST"
		"defend":
			return "REACH THE RADIO ROOM" if stage == 0 else "HOLD THE LINE"
	return ""


## Second line under the objective: [text, colour] ("" for none).
func objective_sub() -> Array:
	var tl := time_left()
	var clock := "%d:%02d" % [int(tl) / 60, int(tl) % 60] if tl >= 0.0 else ""
	match type:
		"defuse":
			if stage == 0:
				return ["DETONATION IN  " + clock, UiKit.RED if tl < 20.0 else UiKit.AMBER]
		"sabotage":
			if stage == 1:
				return ["CHARGES BLOW IN  " + clock + "   ·   GET 8 m AWAY OR EXTRACT", UiKit.RED if tl < 10.0 else UiKit.AMBER]
			return ["HOLD POSITION AT EACH CACHE TO PLANT", UiKit.DIM]
		"defend":
			if stage == 1:
				return ["CHOPPER INBOUND  " + clock, UiKit.CYAN]
			return ["CALL IN THE EXTRACTION CHOPPER", UiKit.DIM]
		"stealth":
			return ["ALARM RAISED  ·  RESPONSE TEAM INBOUND", UiKit.RED] if alarm else ["UNDETECTED  ·  STAY OUT OF THEIR LIGHTS", UiKit.GREEN]
		"runner":
			if target and target.alive and target.aware:
				return ["HE'S RUNNING FOR THE EXIT!", UiKit.RED]
			return ["DON'T LET HIM HEAR YOU COMING", UiKit.DIM]
		"rescue":
			if stage == 1:
				return ["KEEP THEM CLOSE", UiKit.DIM]
		"eliminate":
			if stage == 0:
				return ["HIGH VALUE TARGET", UiKit.DIM]
		"clear":
			var left := 0
			for e in enemies:
				if e.alive:
					left += 1
			if left <= 2 and left > 0:
				return ["LAST HOSTILES MARKED", UiKit.AMBER]
	return ["", UiKit.DIM]


func objective_icon() -> String:
	if stage == 1 and extract_zone.active:
		return "exit-door"
	return Game.TYPE_INFO[type]["icon"]


## World positions the HUD should mark (objective first).
func markers() -> Array:
	var out := []
	if state != "play":
		return out
	if target and target.alive:
		out.append({"pos": target.head_pos() + Vector3(0, 0.5, 0), "icon": "targeted", "col": UiKit.RED, "who": target})
	if stage == 0:
		for z in obj_zones:
			if z.active:
				out.append({"pos": z.global_position + Vector3(0, 1.4, 0), "icon": z.icon, "col": z.color, "who": null})
	if escape_zone and escape_zone.active:
		out.append({"pos": escape_zone.global_position + Vector3(0, 1.4, 0), "icon": "run", "col": UiKit.RED, "who": null})
	if type == "clear":
		var alive := enemies.filter(func(e: Enemy) -> bool: return e.alive)
		if alive.size() <= 2:
			for e in alive:
				out.append({"pos": e.head_pos() + Vector3(0, 0.5, 0), "icon": "targeted", "col": UiKit.RED, "who": e})
	if extract_zone.active:
		out.append({"pos": extract_zone.global_position + Vector3(0, 1.4, 0), "icon": "exit-door", "col": UiKit.GREEN, "who": null})
	return out


## Where the minimap route should lead (Vector3.INF for nowhere).
func route_goal() -> Vector3:
	if state != "play":
		return Vector3.INF
	if type == "defend" and stage == 1:
		return Vector3.INF
	if extract_zone.active:
		return extract_zone.global_position
	if target and target.alive:
		return target.global_position
	var best := Vector3.INF
	var bd := 1e9
	var pp := player.global_position
	for z in obj_zones:
		if z.active:
			var d := z.global_position.distance_to(pp)
			if d < bd:
				bd = d
				best = z.global_position
	if best == Vector3.INF and type == "clear":
		for e in enemies:
			if e.alive:
				var d := e.global_position.distance_to(pp)
				if d < bd:
					bd = d
					best = e.global_position
	return best


func time_left() -> float:
	return maxf(deadline - play_time, 0.0) if deadline > 0.0 else -1.0


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
	_update_route_marks(delta)
	_cull_t -= delta
	if _cull_t <= 0.0:
		_cull_t = 0.2
		_cull()
	var tl := time_left()
	if tl >= 0.0 and tl < 15.0 and int(tl) != int(tl + delta) and type in ["defuse", "sabotage"]:
		Sfx.play("beep", -6.0, 1.0 + (15.0 - tl) * 0.03)
	match type:
		"defuse":
			var b := bomb.get_node_or_null("Blink") as OmniLight3D
			if b:
				b.visible = fmod(play_time, 0.5 if tl > 20.0 else 0.2) < 0.1
			if stage == 0 and tl <= 0.0:
				Fx.explosion(bomb.global_position + Vector3(0, 0.3, 0))
				Fx.explosion(bomb.global_position + Vector3(0.8, 0.5, 0.4))
				_fail("THE BOMB DETONATED")
		"sabotage":
			for c in charges:
				var b := c.get_node_or_null("Blink") as OmniLight3D
				if b:
					b.visible = fmod(play_time, 0.6 if tl > 10.0 or tl < 0.0 else 0.2) < 0.1
			if stage == 1 and tl <= 0.0:
				_detonate_caches()
		"rescue":
			# extraction only counts once every hostage made it too
			if stage == 1 and extract_zone.active:
				for h in hostage_list:
					if h.alive and h.global_position.distance_to(extract_zone.global_position) > 3.5:
						extract_zone.progress = minf(extract_zone.progress, 0.6)
		"runner":
			if target and target.alive and target.aware and escape_zone:
				if not escape_zone.active:
					escape_zone.active = true
					objective_changed.emit()
				var d := target.global_position - escape_zone.global_position
				if Vector2(d.x, d.z).length() < 1.0:
					_fail("THE TARGET ESCAPED")
		"defend":
			if stage == 1:
				_wave_t -= delta
				if _wave_t <= 0.0 and tl > 6.0:
					_wave_t = 13.0
					_spawn_wave(2)
				if tl <= 0.0:
					Sfx.play("objective", -2.0)
					_add_score(800, "CHOPPER ARRIVED", UiKit.GREEN)
					_win(false)
		"stealth":
			if alarm:
				_siren_t -= delta
				if _siren_t <= 0.0:
					_siren_t = 1.4
					Sfx.play("siren", -14.0)


const MARKS := 7
const MARK_GAP := 1.3


## Glowing chevrons on the floor that lead the way along the minimap route.
func _build_route_marks() -> void:
	var L := Vector3(-0.2, 0, 0.1)
	var T := Vector3(0, 0, -0.12)
	var R := Vector3(0.2, 0, 0.1)
	var L2 := L + Vector3(0, 0, 0.11)
	var T2 := T + Vector3(0, 0, 0.11)
	var R2 := R + Vector3(0, 0, 0.11)
	var v := PackedVector3Array([L, T, T2, L, T2, L2, T, R, R2, T, R2, T2])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.vertex_color_use_as_albedo = true
	m.albedo_color = Color(2.2, 1.6, 0.5)
	mesh.surface_set_material(0, m)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = MARKS
	_marks = MultiMeshInstance3D.new()
	_marks.multimesh = mm
	_marks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_marks)


func _update_route_marks(delta: float) -> void:
	_marks_t += delta
	var mm := _marks.multimesh
	var rt := hud.route
	var total := 0.0
	for i in range(1, rt.size()):
		total += rt[i - 1].distance_to(rt[i])
	var shift := fmod(_marks_t * 1.6, MARK_GAP)
	for k in MARKS:
		var d := 1.2 + k * MARK_GAP + shift
		if rt.size() < 2 or d > total - 0.6 or not player.alive:
			mm.set_instance_transform(k, Transform3D(Basis.from_scale(Vector3.ZERO), Vector3.ZERO))
			continue
		# walk the polyline to distance d
		var acc := 0.0
		var pos := rt[0]
		var dir := Vector3.FORWARD
		for i in range(1, rt.size()):
			var seg := rt[i - 1].distance_to(rt[i])
			if acc + seg >= d:
				dir = (rt[i] - rt[i - 1]).normalized()
				pos = rt[i - 1] + dir * (d - acc)
				break
			acc += seg
		var basis := Basis(Vector3.UP, atan2(-dir.x, -dir.z))
		mm.set_instance_transform(k, Transform3D(basis, Vector3(pos.x, 0.03, pos.z)))
		# fade in near the operator, fade out toward the end of the trail
		var a := clampf((d - 1.2) / 1.0, 0.0, 1.0) * clampf(1.0 - (d - 1.2) / (MARKS * MARK_GAP), 0.0, 1.0)
		mm.set_instance_color(k, Color(1, 1, 1, 0.55 * a))


## Keeps the frame cheap: only the lamps nearest the camera are lit (every extra light costs
## a pass in the web / mobile renderers), and soldiers far off screen stop animating.
func _cull() -> void:
	var f := player.global_position
	var fc := Vector2(f.x, f.z)
	var max_lamps := 4 if Game.quality == 0 else (6 if Game.quality == 1 else 10)
	var lamps := level.lamps.duplicate()
	lamps.sort_custom(func(a: OmniLight3D, b: OmniLight3D) -> bool:
		return Vector2(a.position.x, a.position.z).distance_squared_to(fc) < Vector2(b.position.x, b.position.z).distance_squared_to(fc))
	for i in lamps.size():
		var o: OmniLight3D = lamps[i]
		o.visible = i < max_lamps and Vector2(o.position.x, o.position.z).distance_to(fc) < 15.0
	var max_spots := 2 if Game.quality == 0 else 4
	var lit := 0
	var near: Array = enemies.filter(func(e: Enemy) -> bool: return e.alive)
	near.sort_custom(func(a: Enemy, b: Enemy) -> bool:
		return a.global_position.distance_squared_to(f) < b.global_position.distance_squared_to(f))
	for e: Enemy in near:
		var d := e.global_position.distance_to(f)
		var on := d < 17.0
		if e.tree:
			e.tree.active = on
		if e.rig:
			e.rig.active = on
		if e.rifle and e.rifle.light:
			var l := on and lit < max_spots and d < 13.0
			e.rifle.light.visible = l
			lit += int(l)


## Spawns a response squad in the room furthest from the operator, already hunting him.
func _spawn_wave(count: int) -> void:
	var best := -1
	var bd := 0.0
	var pp := Vector2(player.global_position.x, player.global_position.z)
	for i in map.rooms.size():
		var d: float = (map.rooms[i]["rect"] as Rect2).get_center().distance_to(pp)
		if d > bd and d > 7.0:
			bd = d
			best = i
	if best < 0:
		best = map.entrance_room
	var sp: Array = map.free_spots[best]
	for i in count:
		var kind := "shotgunner" if _rng.randf() < 0.3 else "rifleman"
		var e := _spawn_enemy(kind, sp[i % sp.size()])
		e.alert_to(player.global_position)


func _on_objective_zone(z: Zone) -> void:
	obj_done += 1
	match type:
		"intel", "stealth":
			Sfx.play("objective", -2.0)
			if not level.intel_props.is_empty():
				level.intel_props[0].queue_free()
			_add_score(400, "INTEL SECURED" if type == "intel" else "CODES STOLEN", UiKit.CYAN)
		"docs":
			Sfx.play("pickup", -2.0)
			if z.has_meta("item"):
				(z.get_meta("item") as Node3D).queue_free()
			_add_score(200, "DOCUMENT %d / %d" % [obj_done, obj_total], UiKit.AMBER)
		"rescue":
			var h: Hostage = z.get_meta("hostage")
			h.freed = true
			h.leader = player
			Sfx.play("objective", -2.0)
			_add_score(400, "HOSTAGE FREED", UiKit.CYAN)
		"defuse":
			Sfx.play("objective", -2.0)
			_add_score(500 + int(time_left()) * 5, "BOMB DEFUSED", UiKit.GREEN)
			var b := bomb.get_node_or_null("Blink") as OmniLight3D
			if b:
				b.queue_free()
			stage = 1
			deadline = -1.0
			objective_changed.emit()
			_win(false)
			return
		"sabotage":
			Sfx.play("plant", -2.0)
			charges.append(_make_charge(z.global_position))
			_add_score(250, "CHARGE PLANTED", UiKit.AMBER)
		"defend":
			Sfx.play("radio", -2.0)
			_add_score(300, "CHOPPER CALLED", UiKit.CYAN)
			stage = 1
			deadline = play_time + float(def.get("hold", 60))
			_wave_t = 3.0
			for e in enemies:
				e.alert_to(player.global_position)
			objective_changed.emit()
			return
	if obj_done >= obj_total:
		stage = 1
		extract_zone.active = true
		if type == "sabotage":
			deadline = play_time + float(def.get("fuse", 45))
			Sfx.play("alert", -4.0, 0.8)
	objective_changed.emit()


func _detonate_caches() -> void:
	if state != "play":
		return
	for c in charges:
		Fx.explosion(c.global_position + Vector3(0, 0.3, 0))
		c.queue_free()
	charges.clear()
	deadline = -1.0
	var near := false
	for z in obj_zones:
		if z.global_position.distance_to(player.global_position) < 8.0:
			near = true
	if near:
		player.take_hit(500.0, Vector3.UP, player.chest_pos(), null)
		_fail("CAUGHT IN THE BLAST")
		return
	_add_score(600, "CACHES DESTROYED", UiKit.GREEN)
	_win(false)


func _on_extracted() -> void:
	_add_score(300, "EXTRACTED", UiKit.GREEN)
	if type == "stealth" and not alarm:
		_add_score(1000, "GHOST - NEVER SEEN", UiKit.CYAN)
	if type == "sabotage" and not charges.is_empty():
		_detonate_caches()
		return
	_win(false)


func _on_spotted(pos: Vector3, who: Enemy) -> void:
	for e in enemies:
		if e != who and e.alive and e.global_position.distance_to(who.global_position) < 14.0:
			e.alert_to(pos)
	if type == "stealth" and not alarm and state == "play":
		alarm = true
		Sfx.play("siren", -8.0)
		_siren_t = 1.4
		Fx.popup_text(who.head_pos() + Vector3(0, 0.6, 0), "ALARM!", UiKit.RED, 1.4)
		_spawn_wave(3)
		objective_changed.emit()


func _on_enemy_died(killer: Soldier, head: bool, e: Enemy) -> void:
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
	if _rng.randf() < 0.35:
		_drop(e.global_position, "medkit" if _rng.randf() < 0.65 else "grenade")
	var alive_n := 0
	for x in enemies:
		if x.alive:
			alive_n += 1
	if type in ["eliminate", "runner"] and e == target:
		stage = 1
		if escape_zone:
			escape_zone.active = false
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
	return 30.0 + map.rooms.size() * 12.0 + (float(def.get("hold", 60)) if type == "defend" else 0.0)


func _finish(win: bool, reason: String) -> void:
	set_meta("win", win)
	set_meta("reason", reason)
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
