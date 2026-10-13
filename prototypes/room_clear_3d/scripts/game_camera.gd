class_name GameCamera
extends Camera3D
## Tilted top-down follow camera with aim look-ahead, trauma shake, a kill cam and a menu orbit.

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


func _ready() -> void:
	fov = 46.0
	near = 0.3
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
				var ahead := Basis(Vector3.UP, follow.aim_yaw) * Vector3(0, 0, -1.3)
				var base := follow.global_position + ahead
				if threat and threat.alive and threat.get("aware"):
					var d := threat.global_position - follow.global_position
					if d.length() < 13.0:
						base = follow.global_position + d * 0.4
				base.x = clampf(base.x, bounds.position.x, bounds.end.x)
				base.z = clampf(base.z, bounds.position.y, bounds.end.y)
				want_look = base + Vector3(0, 0.6, 0)
				want_pos = base + offset_dir * zoom
		Mode.KILLCAM:
			if focus:
				var c := focus.global_position
				want_look = c + Vector3(0, 0.5, 0)
				want_pos = c + Vector3(1.6, 4.2, 3.6)
	_pos = _pos.lerp(want_pos, k)
	_look = _look.lerp(want_look, k)
