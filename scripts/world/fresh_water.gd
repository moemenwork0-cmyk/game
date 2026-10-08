class_name FreshWater
extends Node3D
## The island's lake and river (layout from res://assets/env/island/water.json, written by
## tools/assets/gen_island.py). The river is a ribbon that follows the carved bed downhill,
## its UV.y runs downstream so ripples and foam flow with the current.

const SHADER := preload("res://shaders/fresh_water.gdshader")

var water_data := {}


func setup(path: String) -> void:
	water_data = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(water_data) != TYPE_DICTIONARY:
		push_warning("fresh water: no layout at " + path)
		return
	var ra := _ripples(0.035, 11)
	var rb := _ripples(0.08, 23)
	var foam := NoiseTexture2D.new()
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_CELLULAR
	fn.frequency = 0.05
	foam.noise = fn
	foam.seamless = true
	foam.generate_mipmaps = true
	var lake: Dictionary = water_data.get("lake", {})
	if not lake.is_empty():
		var m := _material(ra, rb, foam, 0.0)
		var mi := MeshInstance3D.new()
		mi.mesh = _disc(float(lake["radius"]) * 1.3, 72, 10)
		mi.position = Vector3(float(lake["x"]), float(lake["level"]), float(lake["z"]))
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
	var river: Array = water_data.get("river", [])
	if river.size() > 1:
		var mr := MeshInstance3D.new()
		mr.mesh = _ribbon(river)
		mr.material_override = _material(ra, rb, foam, 0.6)
		mr.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mr)


func _material(ra: Texture2D, rb: Texture2D, foam: Texture2D, flow: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.render_priority = 1
	m.set_shader_parameter("ripple_a", ra)
	m.set_shader_parameter("ripple_b", rb)
	m.set_shader_parameter("foam_noise", foam)
	m.set_shader_parameter("flow_speed", flow)
	return m


func _ripples(freq: float, seed_: int) -> NoiseTexture2D:
	var t := NoiseTexture2D.new()
	var n := FastNoiseLite.new()
	n.seed = seed_
	n.frequency = freq
	n.fractal_octaves = 3
	t.noise = n
	t.seamless = true
	t.as_normal_map = true
	t.bump_strength = 6.0
	t.width = 512
	t.height = 512
	t.generate_mipmaps = true
	return t


func _disc(r: float, seg: int, rings: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for ri in rings:
		var r0 := r * float(ri) / rings
		var r1 := r * float(ri + 1) / rings
		for k in seg:
			var a0 := TAU * k / seg
			var a1 := TAU * (k + 1) / seg
			var p := [Vector3(cos(a0) * r0, 0, sin(a0) * r0), Vector3(cos(a1) * r0, 0, sin(a1) * r0),
				Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a0) * r1, 0, sin(a0) * r1)]
			for i in [0, 2, 1, 0, 3, 2]:
				st.set_normal(Vector3.UP)
				st.set_uv(Vector2(p[i].x, p[i].z) * 0.1)
				st.add_vertex(p[i])
	st.generate_tangents()
	return st.commit()


## River ribbon: [x, z, level, half width] per point; edges reach into the banks so the
## terrain hides them.
func _ribbon(pts: Array) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var along := 0.0
	var rows: Array = []
	for i in pts.size():
		var p: Array = pts[i]
		var a: Array = pts[maxi(i - 1, 0)]
		var b: Array = pts[mini(i + 1, pts.size() - 1)]
		var tan := Vector2(float(b[0]) - float(a[0]), float(b[1]) - float(a[1])).normalized()
		var side := Vector2(-tan.y, tan.x)
		var w := float(p[3]) + 3.0
		var y := float(p[2]) + 0.12
		if i > 0:
			var q: Array = pts[i - 1]
			along += Vector2(float(p[0]) - float(q[0]), float(p[1]) - float(q[1])).length()
		var c := Vector2(float(p[0]), float(p[1]))
		var l := c + side * w
		var r := c - side * w
		rows.append([Vector3(l.x, y, l.y), Vector3(r.x, y, r.y), along / (w * 2.0)])
	for i in rows.size() - 1:
		var r0: Array = rows[i]
		var r1: Array = rows[i + 1]
		var quad := [[r0[0], Vector2(0, r0[2])], [r0[1], Vector2(1, r0[2])], [r1[1], Vector2(1, r1[2])], [r1[0], Vector2(0, r1[2])]]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_uv(quad[k][1])
			st.add_vertex(quad[k][0])
	st.generate_tangents()
	return st.commit()
