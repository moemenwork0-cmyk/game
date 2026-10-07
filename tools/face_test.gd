extends Node
## Renders head close-ups with one facial bone changed at a time, to learn the rig's axes.
class Op extends SkeletonModifier3D:
	var bone := -1
	var rot := Vector3.ZERO
	var mv := Vector3.ZERO
	func _process_modification() -> void:
		var sk := get_skeleton()
		if bone < 0: return
		sk.set_bone_pose_rotation(bone, sk.get_bone_pose_rotation(bone) * Quaternion.from_euler(rot))
		sk.set_bone_pose_position(bone, sk.get_bone_pose_position(bone) + mv)

func _ready():
	var root := self
	var out: String = OS.get_cmdline_user_args()[0]
	var who: String = OS.get_cmdline_user_args()[1]
	var ops: Array = OS.get_cmdline_user_args().slice(2)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.2, 0.2, 0.22)
	e.ambient_light_color = Color(0.5, 0.5, 0.5)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment = e
	root.add_child(env)
	var l := DirectionalLight3D.new()
	l.rotation = Vector3(-0.4, 2.8, 0)
	root.add_child(l)
	var act := Actor.create(who, {})
	root.add_child(act)
	await get_tree().process_frame
	act.face.process_mode = Node.PROCESS_MODE_DISABLED
	act.face.active = false
	var sk: Skeleton3D = act.skel
	var op := Op.new()
	sk.add_child(op)
	var cam := Camera3D.new()
	root.add_child(cam)
	cam.fov = 14
	await get_tree().process_frame
	var hb := sk.find_bone("Bip01 Head")
	var hp := (sk.global_transform * sk.get_bone_global_pose(hb)).origin
	cam.global_position = hp + Vector3(0.0, 0.08, -0.75)
	cam.look_at(hp + Vector3(0, 0.08, 0))
	print("skel scale ", sk.global_basis.get_scale(), " head ", hp)
	var i := 0
	for o in ops:
		if o.begins_with("expr="):
			op.bone = -1
			act.face.active = true
			act.face.process_mode = Node.PROCESS_MODE_INHERIT
			var d := {}
			for kv in o.trim_prefix("expr=").split(","):
				var q: PackedStringArray = String(kv).split("_")
				d[q[0]] = float(q[1])
			act.face._blink_t = 99.0
			act.feel(d, 0.01)
			if d.has("talk"):
				act.talk(5.0)
			for f in 12: await get_tree().process_frame
			get_viewport().get_texture().get_image().save_png("%s/f%02d.png" % [out, i])
			i += 1
			continue
		var p: PackedStringArray = o.split(":")
		op.bone = sk.find_bone("Bip01 " + p[0]) if p[0] != "none" else -1
		var v := p[2].split_floats(",")
		op.rot = Vector3.ZERO
		op.mv = Vector3.ZERO
		if p[1] == "r": op.rot = Vector3(v[0], v[1], v[2])
		else: op.mv = Vector3(v[0], v[1], v[2])
		for f in 4: await get_tree().process_frame
		var img := get_viewport().get_texture().get_image()
		img.save_png("%s/f%02d.png" % [out, i])
		i += 1
	get_tree().quit()
