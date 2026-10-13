class_name GameCamera
extends Camera3D
## Over-the-shoulder third-person camera (pulled in when a wall is behind the operator),
## trauma shake, a kill cam and a menu orbit.

enum Mode { ORBIT, FOLLOW, KILLCAM }

var mode := Mode.ORBIT
var follow: Soldier
var focus: Node3D
var threat: Soldier          ## kept in frame while he is close and aware
var bounds := Rect2(-6.0, -3.2, 12.0, 6.2)
var offset_dir := Vector3(0, 10.2, 4.7)
var zoom := 1.0
var trauma := 0.0

var _pos := Vector3.ZERO
var _look := Vector3.ZERO
var _orbit_t := 0.0
var _noise := FastNoiseLite.new()
var _t := 0.0


const SHOULDER := Vector3(0.72, 1.85, 2.75)   ## right, up, back from the operator's feet


func _ready() -> void:
	fov = 70.0
	near = 0.06
	far = 80.0
	_noise.frequency = 1.6
	Fx.trauma_added.connect(func(a: float) -> void: trauma = minf(trauma + a, 1.0))


func snap() -> void:
	_compute(1.0)


func _process(delta: float) -> void:
	_t += delta
	var rd := delta / maxf(Engine.time_scale, 0.05)   # real time even in slow motion
	_compute(1.0 - exp(-6.0 * rd))
	trauma = maxf(trauma - rd * 1.6, 0.0)
	var s := trauma * trauma
	var shake_off := Vector3(_noise.get_noise_2d(_t * 40.0, 0), _noise.get_noise_2d(0, _t * 40.0), 0) * s * 0.35
	var shake_rot := _noise.get_noise_2d(_t * 40.0, 100) * s * 0.04
	look_at_from_position(_pos + basis * shake_off, _look, Vector3.UP)
	rotate_object_local(Vector3.FORWARD, shake_rot)


func _compute(k: float) -> void:
	var want_pos := _pos
	var want_look := _look
	match mode:
		Mode.ORBIT:
			_orbit_t += get_process_delta_time() * 0.12
			var c := Vector3(0, 0, 0)
			want_look = c
			want_pos = c + Vector3(sin(_orbit_t) * 11.0, 11.0, cos(_orbit_t) * 9.0 + 2.0)
		Mode.FOLLOW:
			if follow:
				var yaw: float = follow.get("view_yaw") if follow.get("view_yaw") != null else follow.aim_yaw
				var b := Basis(Vector3.UP, yaw)
				var head := follow.global_position + Vector3(0, 1.55, 0)
				var crouch: float = follow.crouch_k * 0.45
				var want := follow.global_position + b * (SHOULDER - Vector3(0, crouch, 0))
				want_pos = _spring(head, want)
				want_look = follow.global_position + Vector3(0, 1.6 - crouch, 0) + b * Vector3(0.72, 0, -9.0)
				# camera follows tight; position smoothing only (no look-ahead lag)
				k = maxf(k, 0.45)
		Mode.KILLCAM:
			if focus:
				var c := focus.global_position
				want_look = c + Vector3(0, 0.6, 0)
				_orbit_t += get_process_delta_time() * 0.35
				want_pos = _spring(c + Vector3(0, 1.2, 0), c + Vector3(sin(_orbit_t) * 2.6, 1.9, cos(_orbit_t) * 2.6))
	_pos = _pos.lerp(want_pos, k)
	_look = _look.lerp(want_look, k)


## Keeps the camera inside the room: pulls it toward the pivot when a wall is in between.
func _spring(pivot: Vector3, want: Vector3) -> Vector3:
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(pivot, want, 1)
	var h := space.intersect_ray(q)
	if h.is_empty():
		return want
	var d := (want - pivot)
	var hit_d := pivot.distance_to(h.position)
	return pivot + d.normalized() * maxf(hit_d - 0.25, 0.2)
