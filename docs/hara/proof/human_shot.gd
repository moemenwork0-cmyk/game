extends SceneTree
func _init() -> void:
	var root := Node3D.new(); get_root().add_child(root)
	var e := Environment.new(); e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.55, 0.6, 0.65)
	e.ambient_light_color = Color(0.6, 0.6, 0.6); e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new(); we.environment = e; root.add_child(we)
	var sun := DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-35, 30, 0); sun.shadow_enabled = true; root.add_child(sun)
	var h: Node3D = load("res://human.glb").instantiate(); root.add_child(h)
	var skin := StandardMaterial3D.new(); skin.albedo_color = Color(0.62, 0.45, 0.34); skin.roughness = 0.6
	for mi in h.find_children("*", "MeshInstance3D", true, false): mi.material_override = skin
	var aabb := AABB(); for mi in h.find_children("*", "MeshInstance3D", true, false): aabb = aabb.merge(mi.global_transform * mi.get_aabb())
	print("height m: ", aabb.size.y)
	var cam := Camera3D.new(); root.add_child(cam); cam.look_at_from_position(Vector3(1.0, 1.1, 2.6), Vector3(0, 0.95, 0))
	for i in 6: await process_frame
	get_root().get_texture().get_image().save_png("/tmp/claude-0/proof/human.png"); quit()
