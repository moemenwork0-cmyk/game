class_name Enemy
extends Soldier
## Hostile soldier. Kinds: rifleman (balanced, uses cover), shotgunner (rushes you),
## heavy (armoured, slow, keeps pushing) and target (the HVT: tougher, falls back to cover).
## Patrols with a visible weapon light, investigates noise, calls nearby friends, engages with
## bursts that settle onto you over time, side-steps, takes cover, peeks, and runs from grenades.

signal alerted(kind: String)        # "?" heard something, "!" spotted the player
signal spotted(pos: Vector3)        # tell the squad

enum S { PATROL, INVESTIGATE, ENGAGE, COVER, SEARCH, FLEE }

var kind := "rifleman"
var level: Level
var player: Player
var route: Array[Vector3] = []
var state := S.PATROL
var aware := false
var difficulty := 1.0              ## 0.6 .. 1.4 from the mission number

var _wp := 0
var _wait := 0.0
var _look_base := 0.0
var _path := PackedVector3Array()
var _goal := Vector3(1e9, 0, 1e9)
var _repath := 0.0
var _sense_t := 0.0
var _sees := false
var _lost_t := 99.0
var _aim_time := 0.0
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
var _flee_from := Vector3.ZERO
var _engage_min := 4.0
var _engage_max := 11.0
var _uses_cover := true
var _speed_run := 2.8
var _cone: MeshInstance3D


func _ready() -> void:
	team = 1
	var tint := Color(0.98, 0.8, 0.56)
	match kind:
		"shotgunner":
			weapon_id = "shotgun"
			avatar_dir = "res://assets/characters/enemy/"
			tint = Color(0.75, 0.62, 0.48)
		"heavy":
			weapon_id = "smg"
			avatar_dir = "res://assets/characters/enemy/"
			tint = Color(0.42, 0.44, 0.42)
		"target":
			weapon_id = "ak"
			avatar_dir = "res://assets/characters/enemy/"
			tint = Color(0.55, 0.22, 0.18)
		_:
			weapon_id = "rifle"
			avatar_dir = "res://assets/characters/enemy/"
	uniform_tint = tint
	super._ready()
	match kind:
		"shotgunner":
			damage = 6.0 * difficulty
			spread = 0.08
			pellets = 7
			fire_interval = 0.9
			_engage_min = 1.5
			_engage_max = 5.0
			_uses_cover = false
			_speed_run = 3.4
			max_hp = 90.0
		"heavy":
			damage = 6.5 * difficulty
			spread = 0.055
			fire_interval = 0.085
			armor = 0.45
			max_hp = 200.0
			move_mul = 0.75
			_uses_cover = false
			_engage_min = 3.0
			_engage_max = 9.0
		"target":
			damage = 10.0 * difficulty
			spread = 0.04
			fire_interval = 0.14
			max_hp = 140.0
			_engage_min = 5.0
			_engage_max = 12.0
		_:
			damage = 7.5 * difficulty
			spread = 0.045
			fire_interval = 0.12
	hp = max_hp
	mag_size = maxi(mag_size, 6)
	ammo = mag_size
	hurt.connect(_on_hurt)
	_look_base = aim_yaw
	_add_light_cone()


func _add_light_cone() -> void:
	rifle.light.light_energy = 3.0
	rifle.light.spot_range = 9.0
	_cone = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.02
	cm.bottom_radius = 1.9
	cm.height = 6.5
	cm.radial_segments = 16
	cm.rings = 1
	cm.cap_top = false
	cm.cap_bottom = false
	_cone.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.albedo_color = Color(1.0, 0.9, 0.7, 0.05)
	m.proximity_fade_enabled = Game.quality > 0
	m.proximity_fade_distance = 0.5
	_cone.material_override = m
	_cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	rifle.light.add_child(_cone)
	_cone.rotation.x = PI / 2
	_cone.position.z = -3.25


func set_state(s: S) -> void:
	state = s
	_state_t = 0.0
	_repath = 0.0
	_search_t = 0.0


func hear_noise(from: Vector3, radius := 22.0) -> void:
	if not alive or global_position.distance_to(from) > radius:
		return
	if state == S.PATROL or state == S.SEARCH:
		_last_known = from + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1))
		if not aware:
			alerted.emit("?")
			Sfx.play_at("alert", eye_pos(), -8.0)
		aware = true
		_reaction = maxf(_reaction, 0.35)
		set_state(S.INVESTIGATE)


## A squad mate saw the player at `pos`.
func alert_to(pos: Vector3) -> void:
	if not alive or _sees:
		return
	if state in [S.PATROL, S.SEARCH, S.INVESTIGATE]:
		if not aware:
			alerted.emit("!")
		aware = true
		_last_known = pos
		_reaction = maxf(_reaction, 0.25)
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
	spotted.emit(_last_known)
	if state in [S.PATROL, S.INVESTIGATE, S.SEARCH]:
		set_state(S.ENGAGE)
	if _uses_cover and hp <= max_hp * 0.7 and _cover_cd <= 0.0 and state != S.COVER:
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
		_sense_t = 0.1
		_sense()
		_check_grenades()
	if _sees:
		_lost_t = 0.0
		_aim_time += delta
		_last_known = player.global_position
	else:
		_lost_t += delta
		_aim_time = maxf(_aim_time - delta * 2.0, 0.0)
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
			if route.size() < 2:
				face = _look_base + sin(_state_t * 0.7) * 1.1
			elif _wait > 0.0:
				_wait -= delta
				face = _look_base + sin(_state_t * 1.3) * 0.9
			else:
				var d := _nav(route[_wp])
				if d == Vector3.ZERO:
					_wp = (_wp + 1) % route.size()
					_wait = randf_range(1.2, 3.0)
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
				if _search_t > 4.0:
					_wp = _nearest_wp()
					set_state(S.PATROL)
			else:
				mv = d
				spd = 2.4 if state == S.INVESTIGATE else 3.0
				face = atan2(-d.x, -d.z)
				_look_base = face
		S.ENGAGE:
			want_up = 1.0
			if _sees:
				face = yaw_p
				if dist > _engage_max:
					mv = _nav(player.global_position)
					spd = _speed_run
				elif dist < _engage_min and kind != "shotgunner":
					mv = -to_p.normalized()
					spd = 1.8
				else:
					if _strafe_t <= 0.0:
						_strafe = -1.0 if randf() < 0.5 else 1.0
						_strafe_t = randf_range(0.9, 2.0)
					var u := to_p.normalized()
					var side := Vector3(-u.z, 0, u.x) * _strafe
					var push := 0.8 if kind in ["shotgunner", "heavy"] else 0.0
					mv = (side + u * push).normalized()
					spd = 1.7 if kind != "shotgunner" else 3.2
				if ammo <= 0:
					if _uses_cover and _cover_cd <= 0.0:
						_take_cover()
					else:
						start_reload()
			elif _lost_t > 0.9:
				_look_base = aim_yaw
				set_state(S.SEARCH)
			else:
				var dl := _last_known - global_position
				face = atan2(-dl.x, -dl.z)
				if kind in ["shotgunner", "heavy"]:
					mv = _nav(_last_known)
					spd = _speed_run
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
						spd = 4.2
						want_up = 0.35
						face = yaw_p if _sees else atan2(-d.x, -d.z)
				1:
					crouching = true
					face = yaw_p
					_cover_t -= delta
					if ammo < mag_size * 0.6:
						start_reload()
					if _sees and _cover_t < 1.2:
						_cover_cd = 3.0
						set_state(S.ENGAGE)
					elif _cover_t <= 0.0 and not is_reloading():
						_cover_phase = 2
						_cover_t = randf_range(1.6, 2.4)
				2:
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
							_cover_phase = 0
		S.FLEE:
			want_up = 0.3
			var away := global_position + (global_position - _flee_from).normalized() * 4.0
			var d := _nav(away)
			mv = d if d != Vector3.ZERO else (global_position - _flee_from).normalized()
			spd = 4.5
			face = atan2(-mv.x, -mv.z) if mv.length() > 0.1 else face
			if _state_t > 1.3:
				set_state(S.ENGAGE if aware else S.PATROL)
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
	aim_yaw = rotate_toward(aim_yaw, face, (7.0 if _sees else 3.5) * delta)
	if _cone:
		_cone.visible = alive and not aware
	_shoot(yaw_p, dist)


func _shoot(yaw_p: float, dist: float) -> void:
	if not _sees or _reaction > 0.0 or state in [S.PATROL, S.FLEE] or is_reloading() or is_throwing():
		return
	if absf(angle_difference(aim_yaw, yaw_p)) > 0.14:
		return
	if dist > 18.0:
		return
	if _burst > 0:
		var moving := Vector2(velocity.x, velocity.z).length()
		var pv := Vector2(player.velocity.x, player.velocity.z).length()
		# first shots are rushed; aim settles the longer he tracks you; dashing throws him off
		var settle := lerpf(2.0, 1.0, clampf(_aim_time / 1.4, 0.0, 1.0))
		var extra := moving * 0.012 + pv * 0.006 + (0.08 if player._dash_t > 0.0 else 0.0)
		spread_mul = settle
		var aim_pt := player.chest_pos() + Vector3(0, randf_range(-0.3, 0.35), 0)
		if fire(aim_pt, extra):
			_burst -= 1
			if _burst == 0:
				_burst_pause = randf_range(0.55, 1.1) / clampf(difficulty, 0.6, 1.4)
	elif _burst_pause <= 0.0:
		_burst = 1 if pellets > 1 else randi_range(3, 5)


var spread_mul := 1.0


func fire(at: Vector3, extra_spread := 0.0) -> bool:
	var s0 := spread
	spread *= spread_mul
	var ok := super.fire(at, extra_spread)
	spread = s0
	return ok


func _sense() -> void:
	_sees = false
	if player == null or not player.alive:
		return
	var to := player.global_position - global_position
	var dist := to.length()
	if dist > 20.0:
		return
	var yaw_p := atan2(-to.x, -to.z)
	var in_fov := absf(angle_difference(aim_yaw, yaw_p)) < deg_to_rad(62)
	var near := dist < (1.6 if player.crouching else 2.4)
	if not (near or (in_fov and dist < 14.0) or (aware and _lost_t < 2.5) or (aware and state != S.PATROL)):
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
		_reaction = lerpf(0.75, 0.4, clampf(difficulty - 0.6, 0.0, 1.0))
		alerted.emit("!")
		Sfx.play_at("alert", eye_pos(), -4.0, 1.2)
	if _sees:
		spotted.emit(player.global_position)
		if state in [S.PATROL, S.INVESTIGATE, S.SEARCH]:
			set_state(S.ENGAGE)


func _check_grenades() -> void:
	if state == S.FLEE:
		return
	for g in get_tree().get_nodes_in_group("grenades"):
		var gp: Vector3 = (g as Node3D).global_position
		if gp.distance_to(global_position) < 4.2 and gp.y < 1.0:
			_flee_from = gp
			aware = true
			set_state(S.FLEE)
			Sfx.play_at("alert", eye_pos(), -4.0, 0.8)
			return


func _take_cover() -> void:
	var best := Vector3.ZERO
	var best_s := 1e9
	var space := get_world_3d().direct_space_state
	var peye := player.eye_pos()
	var tested := 0
	for c in level.cover_points():
		var de := c.distance_to(global_position)
		if de > 9.0:
			continue
		var dp := c.distance_to(player.global_position)
		if dp < 3.5 or dp > 15.0:
			continue
		tested += 1
		if tested > 60:
			break
		var hidden := true
		for hgt in [0.55, 1.0]:
			var q := PhysicsRayQueryParameters3D.create(peye, c + Vector3(0, hgt, 0), 1 | 4, [player.get_rid()])
			if space.intersect_ray(q).is_empty():
				hidden = false
				break
		if not hidden:
			continue
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
		_repath = 0.5 + randf() * 0.2
	while _path.size() > 0 and Vector2(_path[0].x - global_position.x, _path[0].z - global_position.z).length() < 0.3:
		_path.remove_at(0)
	if _path.is_empty():
		return Vector3.ZERO
	var d := _path[0] - global_position
	d.y = 0
	return d.normalized()


func _nearest_wp() -> int:
	if route.is_empty():
		return 0
	var bi := 0
	var bd := 1e9
	for i in route.size():
		var d := route[i].distance_to(global_position)
		if d < bd:
			bd = d
			bi = i
	return bi


func sees_player() -> bool:
	return _sees


func state_name() -> String:
	return ["patrol", "investigate", "engage", "cover", "search", "flee"][state]
