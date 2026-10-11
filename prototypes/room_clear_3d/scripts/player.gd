class_name Player
extends Soldier
## Player soldier: virtual joystick (or WASD) moves and aims; soft auto-aim locks onto the
## target when he is visible near the stick direction; fire button / LMB shoots; reload button / R.

const SPEED := 4.2

var input_move := Vector2.ZERO     ## set by the HUD each frame (-1..1)
var fire_held := false
var mouse_aim := false
var mouse_point := Vector3.ZERO
var target: Soldier
var locked := false
var _face := 0.0
var _laser: MeshInstance3D
var _dot: MeshInstance3D
var _laser_mat := StandardMaterial3D.new()


func _ready() -> void:
	team = 0
	avatar_dir = "res://assets/characters/player/"
	uniform_tint = Color(0.74, 0.84, 0.66)
	damage = 25.0
	spread = 0.012
	super._ready()
	_face = aim_yaw
	aim_up = 1.0
	# soft key light that keeps the operator readable in the dark rooms
	var key := OmniLight3D.new()
	key.position = Vector3(0.6, 2.6, 0.9)
	key.light_color = Color(0.85, 0.9, 1.0)
	key.light_energy = 0.9
	key.omni_range = 3.2
	key.omni_attenuation = 1.4
	key.light_volumetric_fog_energy = 0.0
	add_child(key)
	_laser = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.006, 0.006, 1.0)
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
	sm.radius = 0.025
	sm.height = 0.05
	_dot.mesh = sm
	_dot.material_override = _laser_mat
	add_child(_dot)
	_dot.top_level = true


## Laser sight: red beam from the muzzle to whatever it touches; brighter when locked on.
func _process(delta: float) -> void:
	super._process(delta)
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
	_laser_mat.albedo_color = Color(3.0, 0.2, 0.15, 0.75 if locked else 0.3)


func think(delta: float) -> void:
	var mv := input_move
	var kb := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if Input.is_key_pressed(KEY_A): kb.x -= 1
	if Input.is_key_pressed(KEY_D): kb.x += 1
	if Input.is_key_pressed(KEY_W): kb.y -= 1
	if Input.is_key_pressed(KEY_S): kb.y += 1
	if kb.length() > 0.1:
		mv = kb.limit_length(1.0)
	move_target = Vector3(mv.x, 0, mv.y) * SPEED * (0.8 if is_reloading() else 1.0)
	# where do we want to point?
	if mouse_aim:
		var d := mouse_point - global_position
		if Vector2(d.x, d.z).length() > 0.5:
			_face = atan2(-d.x, -d.z)
	elif mv.length() > 0.25:
		_face = atan2(-mv.x, -mv.y)
	var want := _face
	locked = false
	var aim_at := global_position + Basis(Vector3.UP, aim_yaw) * Vector3(0, 1.25, -20)
	if target and target.alive:
		var to := target.global_position - global_position
		var yaw_t := atan2(-to.x, -to.z)
		var tol := 0.55 if mouse_aim else (1.0 if fire_held else 0.8)
		if to.length() < 22.0 and absf(angle_difference(_face, yaw_t)) < tol and can_see(target):
			want = yaw_t
			locked = true
			aim_at = target.chest_pos() + Vector3(0, randf_range(-0.25, 0.4), 0)
	aim_yaw = rotate_toward(aim_yaw, want, 13.0 * delta)
	aim_up = 1.0
	if fire_held and alive:
		if ammo <= 0:
			start_reload()
		elif absf(angle_difference(aim_yaw, want)) < 0.2:
			if not locked:
				aim_at = global_position + Basis(Vector3.UP, aim_yaw) * Vector3(0, 1.25, -20)
			fire(aim_at, Vector2(velocity.x, velocity.z).length() * 0.006)


func can_see(other: Soldier) -> bool:
	var space := get_world_3d().direct_space_state
	for p in [other.chest_pos(), other.head_pos()]:
		var q := PhysicsRayQueryParameters3D.create(eye_pos(), p, 1 | 2 | 4, [get_rid()])
		var h := space.intersect_ray(q)
		if not h.is_empty() and h.collider == other:
			return true
	return false
