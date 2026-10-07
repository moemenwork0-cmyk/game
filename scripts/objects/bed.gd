class_name Bed
extends StaticBody3D
## Simple wooden bed with a woven mat. Sleep until morning; also your respawn point.


static func create(pos: Vector3, yaw: float = 0.0) -> Bed:
	var b := Bed.new()
	Game.props.add_child(b)
	b.global_position = pos
	b.rotation.y = yaw
	return b


func _ready() -> void:
	add_to_group("beds")
	collision_layer = Game.L_STRUCT
	collision_mask = 0
	var frame := MeshInstance3D.new()
	var fm := BoxMesh.new()
	fm.size = Vector3(1.0, 0.25, 2.1)
	fm.material = Mats.get_mat("wood")
	frame.mesh = fm
	frame.position.y = 0.2
	add_child(frame)
	var mat_mesh := MeshInstance3D.new()
	var mm := BoxMesh.new()
	mm.size = Vector3(0.9, 0.1, 1.95)
	var cloth := StandardMaterial3D.new()
	cloth.albedo_color = Color(0.55, 0.5, 0.36)
	cloth.roughness = 1.0
	mm.material = cloth
	mat_mesh.mesh = mm
	mat_mesh.position.y = 0.37
	add_child(mat_mesh)
	var pillow := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(0.6, 0.12, 0.3)
	pm.material = cloth
	pillow.mesh = pm
	pillow.position = Vector3(0, 0.47, -0.8)
	add_child(pillow)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(1.0, 0.45, 2.1)
	cs.shape = bs
	cs.position.y = 0.22
	add_child(cs)
