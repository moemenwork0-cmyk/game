class_name Shark
extends Node3D
## A tiger shark, lofted procedurally (body sections, fins, crescent tail) and swum by
## a travelling body wave in its shader. Swims along -Z of the node at `speed`.

var speed := 3.0
var length := 3.6


func _ready() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := 28
	var sides := 14
	var pts := []
	for i in rings + 1:
		var s := float(i) / rings  # 0 nose .. 1 tail root
		var z := lerpf(-length * 0.5, length * 0.32, s)
		var r := length * 0.11 * pow(sin(PI * pow(s, 0.7)), 0.8) + 0.01
		var row := []
		for j in sides:
			var a := TAU * j / sides
			# flatter belly, taller back
			var y := sin(a) * r * (1.15 if sin(a) > 0.0 else 0.85) - pow(1.0 - s, 4.0) * 0.08
			row.append(Vector3(cos(a) * r * 0.85, y, z))
		pts.append(row)
	for i in rings:
		for j in sides:
			var a: Vector3 = pts[i][j]
			var b: Vector3 = pts[i][(j + 1) % sides]
			var c: Vector3 = pts[i + 1][(j + 1) % sides]
			var d: Vector3 = pts[i + 1][j]
			_tri(st, a, c, b)
			_tri(st, a, d, c)
	var L := length
	# dorsal fin, pectorals, crescent tail
	_fin(st, Vector3(0, L * 0.1, -L * 0.08), Vector3(0, L * 0.26, L * 0.02), Vector3(0, L * 0.09, L * 0.1))
	for sx in [-1.0, 1.0]:
		_fin(st, Vector3(sx * L * 0.08, -L * 0.04, -L * 0.2), Vector3(sx * L * 0.3, -L * 0.12, -L * 0.02), Vector3(sx * L * 0.08, -L * 0.05, -L * 0.08))
	_fin(st, Vector3(0, 0, L * 0.3), Vector3(0, L * 0.22, L * 0.52), Vector3(0, L * 0.02, L * 0.4))
	_fin(st, Vector3(0, 0, L * 0.3), Vector3(0, -L * 0.14, L * 0.46), Vector3(0, -L * 0.01, L * 0.38))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/trailer/shark.gdshader")
	m.set_shader_parameter("length", length)
	mi.material_override = m
	add_child(mi)


func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)


func _fin(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	_tri(st, a, b, c)
	_tri(st, a, c, b)


func _process(delta: float) -> void:
	position += -global_basis.z * speed * delta
