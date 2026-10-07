class_name FishSchool
extends Node3D
## A small school of fish living in the shallow lagoon. They wander, keep to
## the water column and dart away from a swimmer. Catch them with the spear.

const MAX_FISH := 6
const RESPAWN_SECONDS := 50.0

var home := Vector3.ZERO
var fish: Array[Dictionary] = []
var _rng := RandomNumberGenerator.new()
var _respawn_t := 0.0

static var _mesh: ArrayMesh
static var _mat: ShaderMaterial
static var _cooked: StandardMaterial3D


static func fish_mesh() -> ArrayMesh:
	if _mesh:
		return _mesh
	# streamlined body: a sphere squashed sideways and stretched, plus a tail fin
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := 8
	var segs := 10
	var length := 0.32
	var pts: Array = []
	for r in rings + 1:
		var v := float(r) / rings
		var z := lerpf(-length * 0.5, length * 0.5, v)
		var rad := sin(PI * pow(v, 0.8)) * 0.045
		var row: Array = []
		for s in segs:
			var a := TAU * s / segs
			row.append(Vector3(cos(a) * rad * 0.55, sin(a) * rad, z))
		pts.append(row)
	for r in rings:
		for s in segs:
			var a: Vector3 = pts[r][s]
			var b: Vector3 = pts[r][(s + 1) % segs]
			var c: Vector3 = pts[r + 1][(s + 1) % segs]
			var d: Vector3 = pts[r + 1][s]
			for v in [a, c, b, a, d, c]:
				st.set_uv(Vector2(float(r) / rings, float(s) / segs))
				st.add_vertex(v)
	var tz := length * 0.5
	for v in [Vector3(0, 0, tz - 0.01), Vector3(0, 0.06, tz + 0.07), Vector3(0, -0.06, tz + 0.07)]:
		st.set_uv(Vector2(1, 0.5))
		st.add_vertex(v)
	for v in [Vector3(0, 0, tz - 0.01), Vector3(0, -0.06, tz + 0.07), Vector3(0, 0.06, tz + 0.07)]:
		st.set_uv(Vector2(1, 0.5))
		st.add_vertex(v)
	st.generate_normals()
	_mesh = st.commit()
	return _mesh


static func material() -> ShaderMaterial:
	if _mat == null:
		_mat = ShaderMaterial.new()
		_mat.shader = load("res://shaders/fish.gdshader")
	return _mat


static func cooked_material() -> StandardMaterial3D:
	if _cooked == null:
		_cooked = StandardMaterial3D.new()
		_cooked.albedo_color = Color(0.55, 0.33, 0.15)
		_cooked.roughness = 0.6
	return _cooked


static func create(parent: Node, center: Vector3, seed_v: int) -> FishSchool:
	var s := FishSchool.new()
	s.home = center
	s.add_to_group("fish_schools")
	s._rng.seed = seed_v
	parent.add_child(s)
	for i in MAX_FISH:
		s._spawn_fish()
	return s


func _spawn_fish() -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = fish_mesh()
	mi.material_override = material()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var sc := _rng.randf_range(0.8, 1.3)
	mi.scale = Vector3.ONE * sc
	add_child(mi)
	var p := home + Vector3(_rng.randf_range(-3, 3), 0, _rng.randf_range(-3, 3))
	p.y = _mid_depth(p)
	mi.global_position = p
	fish.append({"node": mi, "vel": Vector3.ZERO, "target": p, "t": 0.0})


func _water_column(p: Vector3) -> Vector2:
	var bed := Game.world.surface_height(p.x, p.z) if Game.world else -3.0
	var top := Game.water_height(p.x, p.z) - 0.35
	return Vector2(bed + 0.25, top)


func _mid_depth(p: Vector3) -> float:
	var col := _water_column(p)
	return lerpf(col.x, col.y, _rng.randf_range(0.25, 0.75))


func _process(delta: float) -> void:
	if Game.world == null:
		return
	var player_pos := Game.player.global_position + Vector3(0, 1.0, 0) if Game.player else Vector3(0, -999, 0)
	for f in fish:
		var node: MeshInstance3D = f["node"]
		var p := node.global_position
		f["t"] = float(f["t"]) - delta
		if float(f["t"]) <= 0.0 or p.distance_to(f["target"]) < 0.4:
			var tgt := home + Vector3(_rng.randf_range(-5, 5), 0, _rng.randf_range(-5, 5))
			tgt.y = _mid_depth(tgt)
			f["target"] = tgt
			f["t"] = _rng.randf_range(2.0, 6.0)
		var desired: Vector3 = (f["target"] - p).normalized() * 0.7
		var away := p - player_pos
		var fleeing := away.length() < 3.2
		if fleeing:
			desired = away.normalized() * 3.2
		var v: Vector3 = f["vel"]
		v = v.lerp(desired, 1.0 - exp(-(4.0 if fleeing else 1.2) * delta))
		var np := p + v * delta
		# stay in the water column; turn back from the beach
		var col := _water_column(np)
		if col.y - col.x < 0.3:
			v = -v
			np = p
		np.y = clampf(np.y, col.x, col.y)
		f["vel"] = v
		node.global_position = np
		if v.length() > 0.05:
			node.look_at(np - v, Vector3.UP)
	if fish.size() < MAX_FISH:
		_respawn_t += delta
		if _respawn_t > RESPAWN_SECONDS:
			_respawn_t = 0.0
			_spawn_fish()


## Returns true if a fish was within reach of the spear tip segment.
func try_spear(from: Vector3, to: Vector3) -> bool:
	for i in fish.size():
		var node: MeshInstance3D = fish[i]["node"]
		var p := node.global_position
		var closest := Geometry3D.get_closest_point_to_segment(p, from, to)
		if closest.distance_to(p) < 0.3:
			node.queue_free()
			fish.remove_at(i)
			return true
	return false
