class_name BoatFrame
extends Node3D
## A sewn-plank dhow taking shape on the sand: keel, stem and sternpost, ribs, then
## the strakes climbing up the hull. `progress` 0..1 reveals the parts in build order.

const LENGTH := 11.0
const BEAM := 3.4
const DEPTH := 1.8

var progress := 1.0:
	set(v):
		progress = v
		_reveal()
var _parts: Array[Node3D] = []
var _wood: StandardMaterial3D
var _fresh: StandardMaterial3D


func _ready() -> void:
	_wood = StandardMaterial3D.new()
	_wood.albedo_color = Color(0.42, 0.29, 0.17)
	_wood.roughness = 0.85
	_fresh = StandardMaterial3D.new()
	_fresh.albedo_color = Color(0.66, 0.5, 0.33)
	_fresh.roughness = 0.8
	# trestles
	for z in [-3.5, 0.0, 3.5]:
		_box(Vector3(0, 0.25, z), Vector3(2.2, 0.12, 0.25), _wood, 0.0, false)
	_box(Vector3(0, 0.45, 0), Vector3(0.22, 0.25, LENGTH), _wood)  # keel
	_post(-1.0)
	_post(1.0)
	var ribs := 11
	for i in ribs:
		var z := lerpf(-LENGTH * 0.4, LENGTH * 0.4, float(i) / (ribs - 1))
		_rib(z)
	for k in 7:
		for side in [-1.0, 1.0]:
			_strake(k, side)


func _half(z: float, h: float) -> float:
	var f := 1.0 - pow(absf(z) / (LENGTH * 0.5), 2.2)
	return BEAM * 0.5 * maxf(f, 0.05) * lerpf(0.35, 1.0, sqrt(h))


func _post(sgn: float) -> void:
	var n := Node3D.new()
	add_child(n)
	var b := _mesh_box(Vector3(0.2, DEPTH * 1.5, 0.22), _wood)
	b.position = Vector3(0, DEPTH * 0.75, 0)
	n.add_child(b)
	n.position = Vector3(0, 0.45, sgn * LENGTH * 0.5)
	n.rotation.x = sgn * 0.45
	_parts.append(n)


func _rib(z: float) -> void:
	var n := Node3D.new()
	add_child(n)
	var segs := 6
	for side in [-1.0, 1.0]:
		var prev := Vector3(0, 0.5, z)
		for s in segs:
			var h := float(s + 1) / segs
			var p := Vector3(side * _half(z, h), 0.5 + h * DEPTH, z)
			var mi := _mesh_box(Vector3(0.09, (p - prev).length() + 0.05, 0.12), _wood)
			mi.position = (p + prev) * 0.5
			mi.basis = Basis(Vector3(0, 0, 1), atan2(-(p.x - prev.x), p.y - prev.y))
			n.add_child(mi)
			prev = p
	_parts.append(n)


func _strake(k: int, side: float) -> void:
	var n := Node3D.new()
	add_child(n)
	var h := (k + 0.5) / 7.0
	var steps := 12
	for s in steps:
		var z0 := lerpf(-LENGTH * 0.47, LENGTH * 0.47, float(s) / steps)
		var z1 := lerpf(-LENGTH * 0.47, LENGTH * 0.47, float(s + 1) / steps)
		var p0 := Vector3(side * (_half(z0, h) + 0.06), 0.5 + h * DEPTH + absf(z0) * 0.05, z0)
		var p1 := Vector3(side * (_half(z1, h) + 0.06), 0.5 + h * DEPTH + absf(z1) * 0.05, z1)
		var mi := _mesh_box(Vector3(0.04, DEPTH / 7.0 * 1.05, (p1 - p0).length() + 0.02), _fresh)
		mi.position = (p0 + p1) * 0.5
		mi.basis = Basis.looking_at((p1 - p0).normalized(), Vector3.UP) * Basis(Vector3(0, 0, 1), side * 0.35 * (1.0 - h))
		n.add_child(mi)
	_parts.append(n)


func _box(p: Vector3, s: Vector3, m: Material, _r := 0.0, part := true) -> void:
	var mi := _mesh_box(s, m)
	mi.position = p
	add_child(mi)
	if part:
		_parts.append(mi)


func _mesh_box(s: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = s
	mi.mesh = bm
	mi.material_override = m
	return mi


func _reveal() -> void:
	var n := int(round(progress * _parts.size()))
	for i in _parts.size():
		_parts[i].visible = i < n
