class_name Vehicle
extends VehicleBody3D
## Any car / tuk-tuk / motorbike produced by gen/ingest.py: the body mesh plus wheel_N nodes with
## pivots at the hubs, and a JSON next to it with the size and wheel hubs. The wheels become
## VehicleWheel3D nodes at those hubs and keep their own meshes, so they spin and steer.
## Arcade handling: speed-sensitive steering, a top speed, an anti-roll stabiliser (three-wheelers
## still lean, but only tip over when you really throw them), synthesized engine sound and a horn.
## With `ai` set it drives itself along the street lane.

@export var asset := "test_sedan"
@export var ai := false
var max_engine := 2200.0
var max_steer := 0.55
var top_speed := 90.0          # km/h
var driver: Node = null
var info: Dictionary
var seat := Vector3(0, 0.3, 0.3)   # where the driver's feet go, in vehicle space
var three_wheeler := false
var lane_x := 1.4
var z_from := 10.0
var z_to := -100.0
var _engine: AudioStreamPlayer3D
var _horn: AudioStreamPlayer3D
var _phase := 0.0
var _rpm := 0.0
var _horn_t := 0.0
var _flip_t := 0.0


func _ready() -> void:
	add_to_group("vehicles")
	info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/vehicles/%s.json" % asset))
	var size: Array = info.size_m
	three_wheeler = info.wheels.size() < 4
	if three_wheeler:
		mass = 420.0
		max_engine = 1100.0
		top_speed = 48.0
		max_steer = 0.5
	else:
		mass = 950.0
	var model: Node3D = load("res://assets/vehicles/%s.glb" % asset).instantiate()
	add_child(model)
	# collision: a box for the body above the wheels (Godot axes: x = width, y = up, z = length)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	var w0: Dictionary = info.wheels[0] if info.wheels.size() else {"radius": 0.25}
	var clearance := float(w0.radius) * 0.9
	bs.size = Vector3(float(size[0]) * 0.85, float(size[2]) - clearance, float(size[1]) * 0.95)
	cs.shape = bs
	cs.position.y = clearance + bs.size.y / 2
	add_child(cs)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, clearance * 0.8, 0)
	var front_z := -INF
	for i in info.wheels.size():
		var wd: Dictionary = info.wheels[i]
		var hub := Vector3(wd.hub[0], wd.hub[2], -wd.hub[1])     # Blender (x, y, z) -> Godot (x, z, -y)
		front_z = maxf(front_z, hub.z)
		var wh := VehicleWheel3D.new()
		wh.position = hub
		wh.wheel_radius = wd.radius
		wh.wheel_rest_length = 0.1
		wh.suspension_travel = 0.12
		wh.suspension_stiffness = 45.0
		wh.suspension_max_force = mass * 12.0
		wh.damping_compression = 1.8
		wh.damping_relaxation = 2.4
		wh.wheel_friction_slip = 2.2 if hub.z > 0 else 1.8   # rear lets go a little before it tips
		wh.wheel_roll_influence = 0.15                          # less body roll from cornering forces
		wh.use_as_steering = hub.z > 0          # front faces +Z
		wh.use_as_traction = hub.z <= 0 or info.wheels.size() == 2
		add_child(wh)
		var m := model.find_child("wheel_%d" % i, true, false) as Node3D
		if m:
			m.reparent(wh, false)
			m.position = Vector3.ZERO
	# driver sits just behind the front wheel (tuk-tuk / bike), or on the left seat in a car
	if three_wheeler:
		seat = Vector3(0, clearance + 0.12, front_z - 0.95)
	else:
		seat = Vector3(0.38, clearance + 0.05, 0.1)
	_setup_audio()


func speed_kmh() -> float:
	return linear_velocity.dot(global_basis.z) * 3.6


func _physics_process(dt: float) -> void:
	var throttle := 0.0
	var turn := 0.0
	var handbrake := false
	if driver != null:
		throttle = Input.get_action_strength("fwd") - Input.get_action_strength("back")
		turn = Input.get_action_strength("left") - Input.get_action_strength("right")
		handbrake = Input.is_action_pressed("jump")
		if InputMap.has_action("horn") and Input.is_action_just_pressed("horn"):
			honk()
		if InputMap.has_action("reset") and Input.is_action_just_pressed("reset"):
			upright()
	elif ai:
		var c := _ai_control()
		throttle = c.x
		turn = c.y
	var kmh := speed_kmh()
	# steering: quick at walking pace, gentle at speed
	var limit := lerpf(max_steer, max_steer * 0.28, clampf(absf(kmh) / top_speed, 0.0, 1.0))
	steering = move_toward(steering, turn * limit, 2.2 * dt)
	if driver == null and not ai:
		engine_force = 0.0
		brake = 6.0
	elif throttle < 0.0 and kmh > 2.0:
		engine_force = 0.0
		brake = 9.0
	elif throttle < 0.0:
		brake = 0.0
		engine_force = throttle * max_engine * 0.55 * clampf(1.0 - absf(kmh) / 15.0, 0.0, 1.0)   # slow reverse
	else:
		brake = 0.0 if throttle > 0.0 else 1.2   # engine braking when you let go
		engine_force = throttle * max_engine * sqrt(clampf(1.0 - kmh / top_speed, 0.0, 1.0))
	if handbrake:
		brake = 14.0
	_stabilise(dt)
	# engine note follows speed (and revs up a bit with the throttle)
	_rpm = lerpf(_rpm, 0.18 + absf(kmh) / top_speed * 0.75 + absf(throttle) * 0.15, minf(1.0, 4.0 * dt))


## Anti-roll: pull the body back toward upright and damp the wobble, like a low centre of mass would.
func _stabilise(dt: float) -> void:
	var up := global_basis.y
	var axis := up.cross(Vector3.UP)
	var tilt := asin(clampf(axis.length(), 0.0, 1.0))
	if tilt > 0.001 and tilt < 1.2:
		apply_torque(axis.normalized() * tilt * mass * (60.0 if three_wheeler else 40.0))
	var w := angular_velocity
	var roll_rate := w - up * w.dot(up)   # everything except yaw
	apply_torque(-roll_rate * mass * 2.0)
	# stuck on its side or roof for a while: put it back on its wheels
	if up.dot(Vector3.UP) < 0.3 and linear_velocity.length() < 1.0:
		_flip_t += dt
		if _flip_t > 2.5:
			upright()
	else:
		_flip_t = 0.0


func upright() -> void:
	var yaw := global_rotation.y
	global_transform = Transform3D(Basis(Vector3.UP, yaw), global_position + Vector3.UP * 0.5)
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	_flip_t = 0.0


# --------------------------------------------------------------------------- self-driving (street traffic)
func _ai_control() -> Vector2:
	var fwd := global_basis.z
	var dir := -1.0 if fwd.z < 0.0 else 1.0          # heading down (-Z) or up (+Z) the street
	var target := Vector3(lane_x * -dir, 0.0, global_position.z + dir * 8.0)   # right-hand lane, 8 m ahead
	var want := 18.0
	# parked or slower vehicles in our lane: swing out around them
	for v in get_tree().get_nodes_in_group("vehicles"):
		if v == self:
			continue
		var dv: Vector3 = (v as Node3D).global_position - global_position
		var along_v := dv.dot(fwd)
		var lat := (v as Node3D).global_position.x - target.x
		if along_v > -2.0 and along_v < 14.0 and absf(lat) < 1.9:
			target.x = clampf((v as Node3D).global_position.x - signf(lat if absf(lat) > 0.01 else 1.0) * 2.1, -1.9, 1.9)
			want = 10.0
	var d := target - global_position
	var err := wrapf(atan2(d.x, d.z) - global_rotation.y, -PI, PI)
	var turn := clampf(err * 2.0, -1.0, 1.0)
	# people in the way: honk, slow down and squeeze past; stop only if they are right in front
	for h in get_tree().get_nodes_in_group("people"):
		var dp: Vector3 = (h as Node3D).global_position - global_position
		var along := dp.dot(fwd)
		var latp := (h as Node3D).global_position.x - target.x
		if along > 0.0 and along < 14.0 and absf(latp) < 1.5:
			target.x = clampf((h as Node3D).global_position.x - signf(latp if absf(latp) > 0.01 else 1.0) * 1.8, -2.3, 2.3)
			want = minf(want, 7.0)
			if _horn_t <= 0.0:
				honk()
		if along > 0.0 and along < 2.4 and absf(dp.dot(global_basis.x)) < 0.75:
			want = 0.0
	d = target - global_position
	err = wrapf(atan2(d.x, d.z) - global_rotation.y, -PI, PI)
	turn = clampf(err * 2.0, -1.0, 1.0)
	var throttle := clampf((want - speed_kmh()) * 0.15, -1.0, 1.0)
	# end of the street: come back in from the other end, heading the other way
	if (dir < 0.0 and global_position.z < z_to) or (dir > 0.0 and global_position.z > z_from):
		var back_yaw := 0.0 if dir < 0.0 else PI
		var start := Vector3(-lane_x, 0.4, z_to + 2.0) if dir < 0.0 else Vector3(lane_x, 0.4, z_from - 2.0)
		global_transform = Transform3D(Basis(Vector3.UP, back_yaw), start)
		linear_velocity = Vector3.ZERO
		angular_velocity = Vector3.ZERO
	return Vector2(throttle, turn)


# --------------------------------------------------------------------------- sound
func _setup_audio() -> void:
	_engine = AudioStreamPlayer3D.new()
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = 22050.0
	gen.buffer_length = 0.15
	_engine.stream = gen
	_engine.unit_size = 6.0
	_engine.max_distance = 60.0
	_engine.volume_db = -6.0
	add_child(_engine)
	_engine.play()
	_horn = AudioStreamPlayer3D.new()
	_horn.stream = _make_horn()
	_horn.unit_size = 12.0
	add_child(_horn)


func honk() -> void:
	_horn.play()
	_horn_t = 1.5


## Two-stroke putter: a train of exhaust pops at the firing rate, plus a little rattle.
func _process(dt: float) -> void:
	_horn_t -= dt
	var pb := _engine.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		return
	var rate := 22050.0
	var fire := lerpf(26.0, 110.0, clampf(_rpm, 0.0, 1.2)) * (1.0 if three_wheeler else 0.6)
	var n := pb.get_frames_available()
	for i in n:
		_phase += fire / rate
		if _phase >= 1.0:
			_phase -= 1.0
		var pop := exp(-_phase * 9.0) * (0.55 + randf() * 0.25)
		var body := sin(_phase * TAU) * 0.25 + sin(_phase * TAU * 2.0) * 0.12
		var s := (pop * 0.7 + body * 0.4 + (randf() - 0.5) * 0.06) * (0.35 + _rpm * 0.4)
		pb.push_frame(Vector2(s, s))


func _make_horn() -> AudioStreamWAV:
	var rate := 22050
	var n := int(rate * 0.45)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var t := float(i) / rate
		var env := minf(1.0, t * 60.0) * minf(1.0, (0.45 - t) * 30.0)
		var v := (1.0 if fmod(t * 430.0, 1.0) < 0.5 else -1.0) * 0.5 + (1.0 if fmod(t * 515.0, 1.0) < 0.5 else -1.0) * 0.5
		data.encode_s16(i * 2, int(clampf(v * env * 0.35, -1.0, 1.0) * 32767))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = rate
	w.data = data
	return w
