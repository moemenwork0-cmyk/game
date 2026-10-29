class_name Player
extends CharacterBody3D
## On-foot player with a GTA-style chase camera: the camera orbits with the mouse (or right stick),
## the body walks in the camera's direction, and a SpringArm pulls the camera in when walls get close
## (narrow alleys) so it never clips through buildings.

const WALK := 1.6
const RUN := 4.2
const ACCEL := 9.0
const GRAVITY := 18.0

var human: Human
var cam_yaw := 0.0
var cam_pitch := -0.22
var pivot := Node3D.new()
var arm := SpringArm3D.new()
var cam := Camera3D.new()
var frozen := false
var vehicle: Vehicle = null


func _ready() -> void:
	var shape := CollisionShape3D.new()
	shape.name = "CollisionShape3D"
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)
	human = Human.new()
	add_child(human)
	# camera rig lives at the top level so it can lag smoothly behind the body
	add_child(pivot)
	pivot.top_level = true
	pivot.add_child(arm)
	arm.spring_length = 4.2
	arm.margin = 0.25
	arm.shape = SphereShape3D.new()
	(arm.shape as SphereShape3D).radius = 0.25
	arm.add_excluded_object(get_rid())
	arm.add_child(cam)
	cam.fov = 65.0
	cam.current = true
	_setup_input()
	pivot.global_position = global_position + Vector3(0, 1.65, 0)


func _setup_input() -> void:
	var keys := {"fwd": KEY_W, "back": KEY_S, "left": KEY_A, "right": KEY_D, "run": KEY_SHIFT, "jump": KEY_SPACE,
		"use": KEY_F, "horn": KEY_H, "reset": KEY_R}
	for a in keys:
		if not InputMap.has_action(a):
			InputMap.add_action(a)
			var e := InputEventKey.new()
			e.physical_keycode = keys[a]
			InputMap.action_add_event(a, e)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and e.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		cam_yaw -= e.relative.x * 0.0035
		cam_pitch = clampf(cam_pitch - e.relative.y * 0.0035, -1.1, 0.5)


## F: get into the nearest vehicle, or out of the one we are driving (GTA style).
func toggle_vehicle() -> void:
	if vehicle:
		var out := vehicle.global_position + vehicle.global_basis.x * -(float(vehicle.info.size_m[0]) / 2 + 0.7)
		vehicle.driver = null
		vehicle = null
		global_position = out + Vector3.UP * 0.2
		# the driver climbs out: back on our own feet
		human.reparent(self, false)
		human.transform = Transform3D(Basis(Vector3.UP, human.rotation.y), Vector3.ZERO)
		human.sit(false)
		human.visible = true
		process_mode = Node.PROCESS_MODE_INHERIT
		$CollisionShape3D.disabled = false
		arm.spring_length = 4.2
		return
	var best: Vehicle = null
	for v in get_tree().get_nodes_in_group("vehicles"):
		if v.global_position.distance_to(global_position) < 3.5 and (best == null or
				v.global_position.distance_to(global_position) < best.global_position.distance_to(global_position)):
			best = v
	if best:
		vehicle = best
		vehicle.driver = self
		# sit in the driver's seat; the body rides with the vehicle
		human.reparent(vehicle, false)
		human.transform = Transform3D(Basis.IDENTITY, vehicle.seat)
		human.sit(true)
		$CollisionShape3D.disabled = true
		arm.spring_length = 5.0 if vehicle.three_wheeler else 6.5
		cam_yaw = vehicle.global_rotation.y + PI


func _physics_process(dt: float) -> void:
	if Input.is_action_just_pressed("use") and not frozen:
		toggle_vehicle()
	if vehicle:
		global_position = vehicle.global_position
		velocity = Vector3.ZERO
		# camera swings back behind the car when the mouse is left alone
		if not frozen and (Input.mouse_mode != Input.MOUSE_MODE_CAPTURED or vehicle.linear_velocity.length() > 3.0):
			cam_yaw = lerp_angle(cam_yaw, vehicle.global_rotation.y + PI, minf(1.0, 2.0 * dt))
		return
	var inp := Vector2.ZERO
	if not frozen:
		inp = Input.get_vector("left", "right", "fwd", "back")
		var stick := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
		if stick.length() > 0.15:
			cam_yaw -= stick.x * 2.5 * dt
			cam_pitch = clampf(cam_pitch - stick.y * 2.0 * dt, -1.1, 0.5)
		var ls := Vector2(Input.get_joy_axis(0, JOY_AXIS_LEFT_X), Input.get_joy_axis(0, JOY_AXIS_LEFT_Y))
		if ls.length() > 0.15:
			inp = ls
	var basis_y := Basis(Vector3.UP, cam_yaw)
	var dir := basis_y * Vector3(inp.x, 0, inp.y)
	var target := dir.normalized() * (RUN if Input.is_action_pressed("run") else WALK) * minf(inp.length(), 1.0)
	var hv := Vector3(velocity.x, 0, velocity.z).lerp(target, minf(1.0, ACCEL * dt))
	velocity.x = hv.x
	velocity.z = hv.z
	velocity.y = 0.0 if is_on_floor() else velocity.y - GRAVITY * dt
	if is_on_floor() and Input.is_action_just_pressed("jump") and not frozen:
		velocity.y = 5.0
	move_and_slide()
	if hv.length() > 0.2:   # face the direction of travel
		human.rotation.y = lerp_angle(human.rotation.y, atan2(hv.x, hv.z), minf(1.0, 10.0 * dt))
	human.set_speed(hv.length())


func _process(dt: float) -> void:
	# camera follows with a little lag; pitch/yaw from input
	var head := global_position + Vector3(0, 1.65, 0)
	pivot.global_position = pivot.global_position.lerp(head, minf(1.0, 12.0 * dt))
	pivot.rotation = Vector3(cam_pitch, cam_yaw, 0)
	arm.position = Vector3(0.45, 0, 0)   # slightly over the right shoulder
