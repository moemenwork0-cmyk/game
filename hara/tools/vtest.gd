extends SceneTree
## Drive the tuk-tuk: full throttle, then steer left, and log speed, wheel spin/steer and body tilt.
func _init() -> void:
	for a in ["fwd", "back", "left", "right", "jump", "horn", "reset"]:
		InputMap.add_action(a)
	var root := Node3D.new(); get_root().add_child(root)
	var body := StaticBody3D.new(); var cs := CollisionShape3D.new(); var bs := BoxShape3D.new(); bs.size = Vector3(200, 1, 400)
	cs.shape = bs; cs.position = Vector3(0, -0.5, 0); body.add_child(cs); root.add_child(body)
	var car := Vehicle.new(); car.asset = "veh_tuktuk"; root.add_child(car); car.position = Vector3(0, 0.4, 0)
	car.driver = root
	for i in 30: await physics_frame
	var wheels := car.get_children().filter(func(c): return c is VehicleWheel3D)
	print("wheels ", wheels.size(), " ", wheels.map(func(w): return [w.position, w.wheel_radius, w.use_as_steering, w.use_as_traction, w.get_child_count()]))
	print("rest  y=%.2f  tilt=%s" % [car.position.y, car.rotation])
	Input.action_press("fwd")
	for i in 300:
		await physics_frame
		if i == 180: Input.action_press("left")
		if i % 30 == 0:
			var w: VehicleWheel3D = wheels[0]
			print("t=%.1fs speed=%.1f km/h  steer=%.2f  wheel0 rpm=%.0f contact=%s  rot=(%.2f, %.2f, %.2f)  y=%.2f" % [i / 60.0,
				car.linear_velocity.length() * 3.6, car.steering, w.get_rpm(), wheels.map(func(x): return x.is_in_contact()),
				car.rotation.x, car.rotation.y, car.rotation.z, car.position.y])
	quit()
