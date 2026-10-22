extends TrailerShot
## Montage: a palm comes down towards camera, crashing into the undergrowth.

var palm: Node3D
var pivot: Node3D
var _fall_t := 0.5
var _dir := Vector3.ZERO


func build(tr: Trailer) -> void:
	duration = 2.4
	tr.sky.hour = 15.8
	var at := Vector3(10, 0, 365)
	await tr.add_island(at, 140.0, 1.0)
	at.y = tr.ground(at.x, at.z)
	pivot = Node3D.new()
	tr.add_child(pivot)
	pivot.global_position = at
	var scene := load("res://assets/env/models/palms.glb") as PackedScene
	palm = scene.instantiate()
	pivot.add_child(palm)
	# keep a single tall palm from the set
	var meshes := palm.find_children("*", "MeshInstance3D", true, false)
	for i in meshes.size():
		(meshes[i] as MeshInstance3D).visible = i == 0
	if meshes.size() > 0:
		var m := meshes[0] as MeshInstance3D
		var aabb := m.get_aabb()
		m.position = -Vector3(aabb.position.x + aabb.size.x * 0.5, aabb.position.y, aabb.position.z + aabb.size.z * 0.5)
		palm.scale = Vector3.ONE * (12.0 / maxf(aabb.size.y, 0.1))
	_dir = Vector3(0.3, 0, 1).normalized()
	var cam := at + Vector3(3.5, 1.2, 15)
	keys = [
		[0.0, cam, at + Vector3(0, 6, 0), 46.0, 0.0],
		[2.4, cam + Vector3(-0.4, -0.1, 0.6), at + Vector3(0, 1.5, 6), 50.0, 0.0],
	]


func tick(time: float, _dt: float) -> void:
	var u := maxf(time - _fall_t, 0.0)
	# a toppling column: slow start, accelerating, a bounce on impact
	var a := minf(0.18 * u * u * u * 5.0 + 0.02 * u, PI * 0.47)
	if a >= PI * 0.47:
		var after := time - _fall_t - pow(PI * 0.47 / 0.9, 1.0 / 3.0)
		a -= 0.06 * exp(-after * 6.0) * absf(sin(after * 18.0))
		shake = 0.25 * exp(-after * 4.0)
		if not has_meta("hit"):
			set_meta("hit", true)
			Fx.burst(pivot.global_position + _dir * 9.0 + Vector3.UP * 0.3, Color(0.45, 0.38, 0.25), 120, 6.0, 0.12, 1.6, 9.8, Vector3.UP, 70.0)
	pivot.basis = Basis(_dir.cross(Vector3.UP).normalized(), -a)
