class_name TerrainChunk
extends StaticBody3D

var coord := Vector3i.ZERO
var _mesh := MeshInstance3D.new()
var _shape := CollisionShape3D.new()
var _grass := MultiMeshInstance3D.new()


func _init() -> void:
	collision_layer = 1
	collision_mask = 0
	var pm := PhysicsMaterial.new()
	pm.friction = 0.9
	physics_material_override = pm
	add_child(_mesh)
	add_child(_shape)
	_grass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_grass)


func apply(data: Dictionary, mat: Material, grass_mesh: Mesh, grass_mat: Material) -> void:
	var verts: PackedVector3Array = data["verts"]
	var idx: PackedInt32Array = data["idx"]
	if idx.is_empty():
		_mesh.mesh = null
		_shape.shape = null
		_grass.multimesh = null
		return
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = data["norms"]
	arr[Mesh.ARRAY_COLOR] = data["cols"]
	arr[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	am.surface_set_material(0, mat)
	_mesh.mesh = am
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(data["faces"])
	_shape.shape = shape

	var gx: Array[Transform3D] = data["grass"]
	if gx.is_empty():
		_grass.multimesh = null
		return
	var gc: PackedColorArray = data["grass_cols"]
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = grass_mesh
	mm.instance_count = gx.size()
	for i in gx.size():
		mm.set_instance_transform(i, gx[i])
		mm.set_instance_color(i, gc[i])
	_grass.multimesh = mm
	_grass.material_override = grass_mat
	apply_grass_settings()


func apply_grass_settings() -> void:
	_grass.visibility_range_end = Game.grass_range
	var mm := _grass.multimesh
	if mm:
		# instances are randomly ordered, so drawing the first N thins the grass evenly
		mm.visible_instance_count = int(mm.instance_count * Game.grass_density)
