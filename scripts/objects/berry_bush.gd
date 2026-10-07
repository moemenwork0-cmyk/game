class_name BerryBush
extends StaticBody3D
## A low bush. Some carry berries you can pick (E); they grow back the next day.

var has_berries := false
var regrow_day := 0
var _berries: MultiMeshInstance3D


static func create(parent: Node, pos: Vector3, rng: RandomNumberGenerator, berries: bool) -> BerryBush:
	var b := BerryBush.new()
	b.has_berries = berries
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var clusters: Array[Vector3] = []
	for c in rng.randi_range(2, 4):
		var cc := Vector3(rng.randf_range(-0.5, 0.5), rng.randf_range(0.25, 0.55), rng.randf_range(-0.5, 0.5))
		clusters.append(cc)
		IslandTree.add_leaf_cluster(st, rng, Vector3(0, 0.3, 0), cc, rng.randf_range(0.5, 0.8), 45)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = Mats.get_mat("leaves_bush")
	b.add_child(mi)
	if berries:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		var sm := SphereMesh.new()
		sm.radius = 0.035
		sm.height = 0.07
		sm.radial_segments = 6
		sm.rings = 3
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.55, 0.04, 0.1)
		mat.roughness = 0.25
		sm.material = mat
		mm.mesh = sm
		mm.instance_count = 30
		for i in 30:
			var c: Vector3 = clusters[i % clusters.size()]
			var d := Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.3, 1), rng.randf_range(-1, 1)).normalized()
			mm.set_instance_transform(i, Transform3D(Basis(), c + d * rng.randf_range(0.35, 0.6)))
		b._berries = MultiMeshInstance3D.new()
		b._berries.multimesh = mm
		b.add_child(b._berries)
	b.collision_layer = Game.L_TREES
	b.collision_mask = 0
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 0.6
	cs.shape = sp
	cs.position.y = 0.4
	b.add_child(cs)
	b.add_to_group("bushes")
	parent.add_child(b)
	b.global_position = pos
	return b


func ripe() -> bool:
	return has_berries and Game.day_number >= regrow_day


func pick() -> void:
	if not ripe():
		return
	Game.add_item("berry", 4)
	regrow_day = Game.day_number + 1
	Game.sfx.play("pickup", global_position)
	_refresh()


func set_regrow_day(d: int) -> void:
	regrow_day = d
	_refresh()


func _process(_delta: float) -> void:
	if _berries and _berries.visible != ripe():
		_refresh()


func _refresh() -> void:
	if _berries:
		_berries.visible = ripe()
