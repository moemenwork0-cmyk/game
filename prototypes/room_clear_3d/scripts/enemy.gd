class_name Enemy
extends Soldier
## The target. Patrols with his weapon light sweeping, investigates gunfire, engages
## with aimed bursts while side-stepping, and when hurt runs to real cover, crouches,
## reloads and peeks out to fire before falling back again. Flanking him breaks his cover.

signal alerted(kind: String)   # "?" heard something, "!" spotted the player

enum S { PATROL, INVESTIGATE, ENGAGE, COVER, SEARCH }

var level: Level
var player: Player
var state := S.PATROL
var aware := false

var _wp := 0
var _wait := 0.0
var _look_base := 0.0
var _path := PackedVector3Array()
var _goal := Vector3(1e9, 0, 1e9)
var _repath := 0.0
var _sense_t := 0.0
var _sees := false
var _lost_t := 99.0
var _last_known := Vector3.ZERO
var _reaction := 0.0
var _burst := 0
var _burst_pause := 0.0
var _strafe := 1.0
var _strafe_t := 0.0
var _stuck_t := 0.0
var _cover_pt := Vector3.ZERO
var _cover_cd := 0.0
var _cover_phase := 0          # 0 running, 1 hiding, 2 peeking
var _cover_t := 0.0
var _cover_cycles := 0
var _search_t := 0.0
var _state_t := 0.0


func _ready() -> void:
	team = 1
	avatar_dir = "res://assets/characters/enemy/"
	uniform_tint = Color(0.98, 0.8, 0.56)
	damage = 8.0
	spread = 0.045
	fire_interval = 0.12
	super._ready()
	hurt.connect(_on_hurt)
	_look_base = aim_yaw


func set_state(s: S) -> void:
	state = s
	_state_t = 0.0
	_repath = 0.0
	_search_t = 0.0


func hear_shot(from: Vector3) -> void:
	if not alive:
		return
	if global_position.distance_to(from) > 26.0:
		return
	if state == S.PATROL or state == S.SEARCH:
		_last_known = from + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1))
		if not aware:
			alerted.emit("?")
			Sfx.play_at("alert", eye_pos(), -6.0)
		aware = true
		_reaction = maxf(_reaction, 0.35)
		set_state(S.INVESTIGATE)


func _on_hurt(_amount: float, from: Vector3) -> void:
	if not alive:
		return
	_last_known = player.global_position if player else from
	_lost_t = 0.0
	if not aware:
		alerted.emit("!")
	aware = true
	_reaction = minf(_reaction, 0.15)
	if state in [S.PATROL, S.INVESTIGATE, S.SEARCH]:
		set_state(S.ENGAGE)
	if hp <= 70.0 and _cover_cd <= 0.0 and state != S.COVER:
		_take_cover()
	elif state == S.COVER and _cover_phase == 2:
		_cover_phase = 1
		_cover_t = randf_range(1.0, 1.6)
		crouching = true


func think(delta: float) -> void:
	_reaction -= delta
	_burst_pause -= delta
	_cover_cd -= delta
	_repath -= delta
	_strafe_t -= delta
	_state_t += delta
	_sense_t -= delta
	if _sense_t <= 0.0:
		_sense_t = 0.08
		_sense()
	if _sees:
		_lost_t = 0.0
		_last_known = player.global_position
	else:
		_lost_t += delta
	var to_p := player.global_position - global_position if player else Vector3.FORWARD
	var dist := to_p.length()
	var yaw_p := atan2(-to_p.x, -to_p.z)
	var mv := Vector3.ZERO
	var spd := 0.0
	var face := aim_yaw
	var want_up := 0.0
	crouching = false
	match state:
		S.PATROL:
			if _wait > 0.0:
				_wait -= delta
				face = _look_base + sin(_state_t * 1.3) * 0.9
			else:
				var wp := level.patrol[_wp]
				var d := _nav(wp)
				if d == Vector3.ZERO:
					_wp = (_wp + 1) % level.patrol.size()
					_wait = randf_range(1.2, 2.6)
					_look_base = aim_yaw
				else:
					mv = d
					spd = 1.35
					face = atan2(-d.x, -d.z) + sin(_state_t * 0.9) * 0.35
		S.INVESTIGATE, S.SEARCH:
			want_up = 1.0
			var d := _nav(_last_known)
			if d == Vector3.ZERO:
				_search_t += delta
				face = _look_base + sin(_search_t * 1.8) * 1.4
				if _search_t > 3.5:
					_wp = _nearest_wp()
					set_state(S.PATROL)
			else:
				mv = d
				spd = 2.6 if state == S.INVESTIGATE else 3.2
				face = atan2(-d.x, -d.z)
				_look_base = face
		S.ENGAGE:
			want_up = 1.0
			if _sees:
				face = yaw_p
				if dist > 11.0:
					mv = _nav(player.global_position)
					spd = 2.8
				else:
					if _strafe_t <= 0.0:
						_strafe = -1.0 if randf() < 0.5 else 1.0
						_strafe_t = randf_range(0.9, 2.0)
					var u := to_p.normalized()
					var side := Vector3(-u.z, 0, u.x) * _strafe
					var radial := -0.7 if dist < 4.0 else 0.0
					mv = (side + u * radial).normalized()
					spd = 1.6
				if ammo <= 0:
					if _cover_cd <= 0.0:
						_take_cover()
					else:
						start_reload()
			elif _lost_t > 0.9:
				_look_base = aim_yaw
				set_state(S.SEARCH)
			else:
				face = atan2(-(_last_known - global_position).x, -(_last_known - global_position).z)
		S.COVER:
			want_up = 1.0
			match _cover_phase:
				0:
					var d := _nav(_cover_pt)
					if d == Vector3.ZERO:
						_cover_phase = 1
						_cover_t = randf_range(1.4, 2.4)
					else:
						mv = d
						spd = 4.3
						want_up = 0.35
						face = yaw_p if _sees else atan2(-d.x, -d.z)
				1:
					crouching = true
					face = yaw_p
					_cover_t -= delta
					if ammo < 20:
						start_reload()
					if _sees and _cover_t < 1.2:
						# flanked: he can see me while I'm down, cover is useless
						_cover_cd = 3.0
						set_state(S.ENGAGE)
					elif _cover_t <= 0.0 and not is_reloading():
						_cover_phase = 2
						_cover_t = randf_range(1.6, 2.4)
				2:
					# peek: stand up; if he is not in sight, edge out toward where he was
					face = yaw_p
					_cover_t -= delta
					if not _sees:
						var d := _nav(_last_known)
						if d != Vector3.ZERO and global_position.distance_to(_cover_pt) < 3.0:
							mv = d
							spd = 1.7
					if _cover_t <= 0.0:
						_cover_cycles += 1
						if _cover_cycles >= 3:
							_cover_cd = 6.0
							set_state(S.ENGAGE)
						else:
							_cover_phase = 0     # fall back to the cover spot and hide again
	# movement + stuck handling
	move_target = mv * spd
	if spd > 0.0 and Vector2(velocity.x, velocity.z).length() < spd * 0.25 and _state_t > 0.4:
		_stuck_t += delta
		if _stuck_t > 0.35:
			_strafe *= -1.0
			_repath = 0.0
			_stuck_t = 0.0
	else:
		_stuck_t = 0.0
	aim_up = want_up
	aim_yaw = rotate_toward(aim_yaw, face, (7.5 if _sees else 3.5) * delta)
	# shooting
	if _sees and _reaction <= 0.0 and state != S.PATROL and not is_reloading() and absf(angle_difference(aim_yaw, yaw_p)) < 0.14:
		if _burst > 0:
			var moving := Vector2(velocity.x, velocity.z).length()
			var aim_pt := player.chest_pos() + Vector3(0, randf_range(-0.3, 0.35), 0)
			if fire(aim_pt, moving * 0.012 + (0.03 if state == S.COVER and _cover_phase == 0 else 0.0)):
				_burst -= 1
				if _burst == 0:
					_burst_pause = randf_range(0.6, 1.15)
		elif _burst_pause <= 0.0:
			_burst = randi_range(3, 5)


func _sense() -> void:
	_sees = false
	if player == null or not player.alive:
		return
	var to := player.global_position - global_position
	var dist := to.length()
	if dist > 20.0:
		return
	var yaw_p := atan2(-to.x, -to.z)
	var in_fov := absf(angle_difference(aim_yaw, yaw_p)) < deg_to_rad(68)
	if not (dist < 2.2 or (in_fov and dist < 15.0) or (aware and _lost_t < 2.5) or (aware and state != S.PATROL)):
		return
	var space := get_world_3d().direct_space_state
	for p in [player.chest_pos(), player.head_pos()]:
		var q := PhysicsRayQueryParameters3D.create(eye_pos(), p, 1 | 2 | 4, [get_rid()])
		var h := space.intersect_ray(q)
		if not h.is_empty() and h.collider == player:
			_sees = true
			break
	if _sees and not aware:
		aware = true
		_reaction = 0.5
		alerted.emit("!")
		Sfx.play_at("alert", eye_pos(), -4.0, 1.2)
	if _sees and state in [S.PATROL, S.INVESTIGATE, S.SEARCH]:
		set_state(S.ENGAGE)


func _take_cover() -> void:
	var best := Vector3.ZERO
	var best_s := 1e9
	var space := get_world_3d().direct_space_state
	var peye := player.eye_pos()
	for c in level.cover_points():
		var dp := c.distance_to(player.global_position)
		if dp < 3.5 or dp > 15.0:
			continue
		var de := c.distance_to(global_position)
		if de > 9.0:
			continue
		var hidden := true
		for hgt in [0.55, 1.0]:
			var q := PhysicsRayQueryParameters3D.create(peye, c + Vector3(0, hgt, 0), 1 | 4, [player.get_rid()])
			if space.intersect_ray(q).is_empty():
				hidden = false
				break
		if not hidden:
			continue
		# don't run across the player's line of fire
		var toward := (c - global_position).normalized().dot((player.global_position - global_position).normalized())
		var s := de + maxf(toward, 0.0) * 4.0 + maxf(0.0, 6.0 - dp) * 0.8
		if s < best_s:
			best_s = s
			best = c
	if best_s < 1e8:
		_cover_pt = best
		_cover_phase = 0
		_cover_cycles = 0
		set_state(S.COVER)
	else:
		_cover_cd = 2.0


func _nav(goal: Vector3) -> Vector3:
	var flat := Vector3(goal.x, 0, goal.z)
	if _repath <= 0.0 or flat.distance_to(_goal) > 0.6:
		_path = level.find_path(global_position, flat)
		_goal = flat
		_repath = 0.5
	while _path.size() > 0 and Vector2(_path[0].x - global_position.x, _path[0].z - global_position.z).length() < 0.3:
		_path.remove_at(0)
	if _path.is_empty():
		return Vector3.ZERO
	var d := _path[0] - global_position
	d.y = 0
	return d.normalized()


func _nearest_wp() -> int:
	var bi := 0
	var bd := 1e9
	for i in level.patrol.size():
		var d := level.patrol[i].distance_to(global_position)
		if d < bd:
			bd = d
			bi = i
	return bi


func state_name() -> String:
	return ["patrol", "investigate", "engage", "cover", "search"][state]
