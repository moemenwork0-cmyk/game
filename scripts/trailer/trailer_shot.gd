class_name TrailerShot
extends Node3D
## One shot of the trailer. A shot builds its own set in build(), then the trailer
## drives it: the camera follows `keys` (smooth Catmull-Rom through positions and
## look-at points, with fov and focus distance), timed `events` fire once, and tick()
## lets the shot animate anything else. `speed` < 1 gives true slow motion: the world
## clock and physics run slower while the camera move keeps its own timing.

## seconds of finished footage
var duration := 4.0
## world time per shot second (0.25 = quarter-speed slow motion)
var speed := 1.0
## [time, position, look_at, fov, focus distance (0 = no depth of field)]
var keys: Array = []
## [time, Callable] fired once when the shot clock passes `time`
var events: Array = []
## handheld / impact shake (metres of jitter); can be keyed by the shot over time
var shake := 0.0
## when set, camera keys are in this node's local space (camera rides the ship)
var follow: Node3D
var t: Trailer
var _fired := {}


## Build the set. Override.
func build(_trailer: Trailer) -> void:
	pass


## Per-frame animation (shot clock in seconds). Override when needed.
func tick(_time: float, _dt: float) -> void:
	pass


func run_events(time: float) -> void:
	for i in events.size():
		if not _fired.has(i) and time >= float(events[i][0]):
			_fired[i] = true
			(events[i][1] as Callable).call()


## Camera pose for the shot clock: position, look target, fov, focus.
func camera_at(time: float) -> Dictionary:
	if keys.is_empty():
		return {}
	if keys.size() == 1 or time <= float(keys[0][0]):
		return _key(keys[0])
	for i in keys.size() - 1:
		var k0: Array = keys[i]
		var k1: Array = keys[i + 1]
		if time <= float(k1[0]):
			var u := (time - float(k0[0])) / maxf(0.0001, float(k1[0]) - float(k0[0]))
			u = u * u * (3.0 - 2.0 * u) if keys.size() == 2 else u
			var km: Array = keys[maxi(i - 1, 0)]
			var kp: Array = keys[mini(i + 2, keys.size() - 1)]
			return {
				"pos": _cr(km[1], k0[1], k1[1], kp[1], u),
				"look": _cr(km[2], k0[2], k1[2], kp[2], u),
				"fov": lerpf(float(k0[3]), float(k1[3]), u),
				"focus": lerpf(float(k0[4]), float(k1[4]), u),
			}
	return _key(keys[-1])


func _key(k: Array) -> Dictionary:
	return {"pos": k[1], "look": k[2], "fov": float(k[3]), "focus": float(k[4])}


static func _cr(a: Vector3, b: Vector3, c: Vector3, d: Vector3, u: float) -> Vector3:
	var u2 := u * u
	var u3 := u2 * u
	return 0.5 * ((2.0 * b) + (-a + c) * u + (2.0 * a - 5.0 * b + 4.0 * c - d) * u2 + (-a + 3.0 * b - 3.0 * c + d) * u3)
