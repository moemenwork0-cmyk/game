extends SceneTree
func _init() -> void:
	var root := Node3D.new(); get_root().add_child(root)
	var e := Environment.new(); e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.55, 0.68, 0.82)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; e.ambient_light_color = Color(0.55, 0.6, 0.7); e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new(); we.environment = e; root.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-35, -30, 0); sun.light_energy = 1.3; sun.shadow_enabled = true; root.add_child(sun)
	var x := -10.0
	for f in ["t_1", "t_2", "t_3"]:
		var b: Node3D = load("res://assets/generated/%s.glb" % f).instantiate(); root.add_child(b); Mats.apply(b)
		var meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/generated/%s.json" % f))
		b.position.x = x + meta.width / 2; x += meta.width + 0.5
	var cam := Camera3D.new(); root.add_child(cam); cam.fov = 55
	cam.look_at_from_position(Vector3(4, 7, 24), Vector3(2, 8, 0))
	for i in 6: await process_frame
	get_root().get_texture().get_image().save_png("res://shots/preview.png"); quit()
