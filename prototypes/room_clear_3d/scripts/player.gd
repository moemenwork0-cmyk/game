class_name Player
extends Soldier
## The operator. Twin-stick on touch: left stick moves, right stick aims and fires once pushed
## past the trigger point. Desktop: WASD + mouse aim + click. Aim assist gently bends the aim
## toward a visible hostile near the aim line (it never snaps across the screen).

const SPEED := 4.4

var input_move := Vector2.ZERO     ## left stick (-1..1), set by the HUD
var input_aim := Vector2.ZERO      ## right stick (-1..1)
var aim_trigger := false           ## right stick pushed far enough to shoot
var fire_held := false             ## desktop click / key
var mouse_aim := false
var mouse_point := Vector3.ZERO
var locked: Soldier                ## hostile the assist is pulling toward
var _face := 0.0
var _laser: MeshInstance3D
var _dot: MeshInstance3D
var _laser_mat := StandardMaterial3D.new()
var _xray_a := 0.0
var _since_hurt := 99.0


func _ready() -> void:
	team = 0
	avatar_dir = "res://assets/characters/player/"
	uniform_tint = Color(0.74, 0.84, 0.66)
	weapon_id = Game.weapon
	xray = true
	grenades = 2
	super._ready()
	max_hp = 100.0
	hp = max_hp
	_face = aim_yaw
	aim_up = 1.0
	hurt.connect(func(_a: float, _f: Vector3) -> void: _since_hurt = 0.0)
	rifle.light.shadow_enabled = Game.quality >= 2
	rifle.light.light_energy = 4.5
	# soft key light that keeps the operator readable in dark rooms
	var key := OmniLight3D.new()
	key.position = Vector3(0.6, 2.6, 0.9)
	key.light_color = Color(0.85, 0.9, 1.0)
	key.light_energy = 0.8
	key.omni_range = 3.2
	key.omni_attenuation = 1.4
	key.light_volumetric_fog_energy = 0.0
	add_child(key)
	_laser = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.008, 0.008, 1.0)
	_laser.mesh = bm
	_laser_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_laser_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_laser_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_laser_mat.albedo_color = Color(3.0, 0.2, 0.15, 0.5)
	_laser.material_override = _laser_mat
	_laser.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_laser)
	_laser.top_level = true
	_dot = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.03
	sm.height = 0.06
	_dot.mesh = sm
	_dot.material_override = _laser_mat
	add_child(_dot)
	_dot.top_level = true


## Laser sight from the muzzle to whatever it touches; brighter while the assist has a target.
func _process(delta: float) -> void:
	super._process(delta)
	# out of the fight for a few seconds: patch yourself up
	_since_hurt += delta
	if alive and _since_hurt > 4.0 and hp < max_hp:
		hp = minf(hp + 6.0 * delta, max_hp)
	if not alive:
		_laser.visible = false
		_dot.visible = false
		return
	var from := rifle.muzzle.global_position
	var dir := -rifle.global_transform.basis.z
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 25.0, 1 | 2 | 4, [get_rid()])
	var h := get_world_3d().direct_space_state.intersect_ray(q)
	var to: Vector3 = from + dir * 25.0 if h.is_empty() else h.position
	var len := from.distance_to(to)
	_laser.visible = len > 0.05
	_laser.global_transform = Transform3D(rifle.global_transform.basis.orthonormalized() * Basis.from_scale(Vector3(1, 1, len)), from + dir * len * 0.5)
	_dot.visible = not h.is_empty()
	_dot.global_position = to
	var on_enemy: bool = not h.is_empty() and h.collider is Enemy
	# x-ray silhouette only while a wall or prop hides the operator from the camera
	var cam := get_viewport().get_camera_3d()
	if cam:
		var cq := PhysicsRayQueryParameters3D.create(cam.global_position, chest_pos(), 1 | 4, [get_rid()])
		var hidden := not get_world_3d().direct_space_state.intersect_ray(cq).is_empty()
		_xray_a = move_toward(_xray_a, 0.6 if hidden else 0.0, delta * 4.0)
		Soldier.xray_material().set_shader_parameter("tint", Color(0.35, 0.85, 1.0, _xray_a))
	_laser_mat.albedo_color = Color(3.0, 0.2, 0.15, 0.85 if on_enemy else (0.45 if aim_trigger or fire_held else 0.25))


func think(delta: float) -> void:
	var mv := input_move
	var kb := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT): kb.x -= 1
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT): kb.x += 1
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP): kb.y -= 1
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN): kb.y += 1
	if kb.length() > 0.1:
		mv = kb.limit_length(1.0)
	move_target = Vector3(mv.x, 0, mv.y) * SPEED * (0.8 if is_reloading() else 1.0)
	# where do we want to point?
	var shooting := false
	if input_aim.length() > 0.2:
		_face = atan2(-input_aim.x, -input_aim.y)
		shooting = aim_trigger
	elif mouse_aim:
		var d := mouse_point - global_position
		if Vector2(d.x, d.z).length() > 0.4:
			_face = atan2(-d.x, -d.z)
		shooting = fire_held
	else:
		if mv.length() > 0.25:
			_face = atan2(-mv.x, -mv.y)
		shooting = fire_held
	var want := _assist(_face, shooting)
	aim_yaw = rotate_toward(aim_yaw, want, 16.0 * delta)
	aim_up = 1.0
	if shooting and alive:
		if ammo <= 0:
			start_reload()
		elif absf(angle_difference(aim_yaw, want)) < 0.18 and not is_throwing():
			var aim_at := global_position + Basis(Vector3.UP, aim_yaw) * Vector3(0, 1.25, -20)
			if locked:
				aim_at = locked.chest_pos() + Vector3(0, randf_range(-0.25, 0.42), 0)
				var flat := aim_at - global_position
				aim_at = global_position + Vector3(0, aim_at.y - global_position.y, 0) + Basis(Vector3.UP, aim_yaw) * Vector3(0, 0, -Vector2(flat.x, flat.z).length())
			fire(aim_at, Vector2(velocity.x, velocity.z).length() * 0.005)


## Soft aim assist: finds the visible hostile closest to the aim line inside a cone that widens
## a little while shooting, and bends the aim toward him (fully when he is very close to the line).
func _assist(face: float, shooting: bool) -> float:
	locked = null
	if not Game.aim_assist and not Game.is_phone():
		return face
	var best: Soldier
	var best_err := 1e9
	var cone := deg_to_rad(24.0 if shooting else 14.0)
	if mouse_aim and input_aim.length() < 0.2:
		cone = deg_to_rad(5.0)
	for n in get_tree().get_nodes_in_group("enemies"):
		var e := n as Soldier
		if not e.alive:
			continue
		var to := e.global_position - global_position
		var dist := to.length()
		if dist > 20.0:
			continue
		var yaw_t := atan2(-to.x, -to.z)
		var err := absf(angle_difference(face, yaw_t))
		var lim := cone + atan2(0.45, dist)   # wider for close targets
		if err > lim:
			continue
		var score := err + dist * 0.004
		if score < best_err and can_see(e):
			best_err = score
			best = e
	if best == null:
		return face
	locked = best
	var to := best.global_position - global_position
	var yaw_t := atan2(-to.x, -to.z)
	var err := absf(angle_difference(face, yaw_t))
	var k := clampf(1.3 - err / (cone + 0.05), 0.35, 1.0)
	return lerp_angle(face, yaw_t, k)


func can_see(other: Soldier) -> bool:
	var space := get_world_3d().direct_space_state
	for p in [other.chest_pos(), other.head_pos()]:
		var q := PhysicsRayQueryParameters3D.create(eye_pos(), p, 1 | 2 | 4, [get_rid()])
		var h := space.intersect_ray(q)
		if not h.is_empty() and h.collider == other:
			return true
	return false


## Grenade toward the aim, landing ~7 m ahead (or at the mouse point).
func throw_ahead() -> bool:
	var at := global_position + Basis(Vector3.UP, aim_yaw) * Vector3(0, 0, -7.0)
	if mouse_aim and input_aim.length() < 0.2:
		var d := mouse_point - global_position
		d.y = 0
		at = global_position + d.limit_length(12.0)
	if locked:
		at = locked.global_position
	return throw_grenade(at)
