class_name Vehicle
extends VehicleBody3D
## Any car / tuk-tuk / motorbike produced by gen/ingest.py: the body mesh plus wheel_N nodes with
## pivots at the hubs, and a JSON next to it with the size and wheel hubs. The wheels become
## VehicleWheel3D nodes at those hubs and keep their own meshes, so they spin and steer.

@export var asset := "test_sedan"
@export var max_engine := 2200.0
@export var max_steer := 0.55
var driver: Node = null
var info: Dictionary


func _ready() -> void:
	add_to_group("vehicles")
	info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/vehicles/%s.json" % asset))
	var size: Array = info.size_m
	mass = 900.0 if info.wheels.size() >= 4 else 350.0
	var model: Node3D = load("res://assets/vehicles/%s.glb" % asset).instantiate()
	add_child(model)
	# collision: a box for the body above the wheels (Godot axes: x = width, y = up, z = length)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	var w0: Dictionary = info.wheels[0] if info.wheels.size() else {"radius": 0.25}
	var clearance := float(w0.radius) * 0.9
	bs.size = Vector3(float(size[0]) * 0.92, float(size[2]) - clearance, float(size[1]) * 0.95)
	cs.shape = bs
	cs.position.y = clearance + bs.size.y / 2
	add_child(cs)
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = Vector3(0, clearance + 0.25, 0)
	for i in info.wheels.size():
		var wd: Dictionary = info.wheels[i]
		var hub := Vector3(wd.hub[0], wd.hub[2], -wd.hub[1])     # Blender (x, y, z) -> Godot (x, z, -y)
		var wh := VehicleWheel3D.new()
		wh.position = hub
		wh.wheel_radius = wd.radius
		wh.wheel_rest_length = 0.12
		wh.suspension_travel = 0.12
		wh.suspension_stiffness = 40.0
		wh.damping_compression = 1.6
		wh.damping_relaxation = 2.2
		wh.wheel_friction_slip = 2.6
		wh.use_as_steering = hub.z > 0          # front faces +Z
		wh.use_as_traction = hub.z <= 0 or info.wheels.size() == 2
		add_child(wh)
		var m := model.find_child("wheel_%d" % i, true, false) as Node3D
		if m:
			m.reparent(wh, false)
			m.position = Vector3.ZERO


func _physics_process(_dt: float) -> void:
	if driver == null:
		engine_force = 0.0
		brake = 8.0
		steering = move_toward(steering, 0.0, 0.05)
		return
	var throttle := Input.get_action_strength("fwd") - Input.get_action_strength("back")
	var turn := Input.get_action_strength("left") - Input.get_action_strength("right")
	var speed := linear_velocity.dot(global_basis.z)
	steering = move_toward(steering, turn * max_steer / (1.0 + absf(speed) * 0.06), 0.06)
	if throttle < 0.0 and speed > 1.0:
		brake = 12.0
		engine_force = 0.0
	else:
		brake = 0.0
		engine_force = throttle * max_engine
	if Input.is_action_pressed("jump"):   # handbrake
		brake = 20.0
