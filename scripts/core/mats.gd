class_name Mats
extends RefCounted
## Procedural materials and textures (no external assets needed).

static var _cache := {}


static func noise_tex(freq: float, size: int = 512, normal: bool = false, bump: float = 8.0,
		octaves: int = 5, ramp: Gradient = null, type: int = FastNoiseLite.TYPE_SIMPLEX_SMOOTH,
		seed_v: int = 0) -> NoiseTexture2D:
	var n := FastNoiseLite.new()
	n.noise_type = type
	n.frequency = freq
	n.fractal_octaves = octaves
	n.seed = seed_v if seed_v != 0 else randi()
	var t := NoiseTexture2D.new()
	t.width = size
	t.height = size
	t.seamless = true
	t.noise = n
	t.as_normal_map = normal
	t.bump_strength = bump
	t.generate_mipmaps = true
	if ramp:
		t.color_ramp = ramp
	return t


static func gradient(colors: Array, offsets: Array = []) -> Gradient:
	var g := Gradient.new()
	var cols := PackedColorArray()
	var offs := PackedFloat32Array()
	for i in colors.size():
		cols.append(colors[i])
		offs.append(offsets[i] if i < offsets.size() else float(i) / max(colors.size() - 1, 1))
	g.colors = cols
	g.offsets = offs
	return g


static func get_mat(id: String) -> Material:
	if _cache.has(id):
		return _cache[id]
	var m: Material = _build(id)
	_cache[id] = m
	return m


static func _build(id: String) -> Material:
	match id:
		"bark":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.02, 256, false, 8.0, 5,
				gradient([Color(0.13, 0.09, 0.06), Color(0.27, 0.2, 0.14), Color(0.36, 0.29, 0.21)]),
				FastNoiseLite.TYPE_CELLULAR)
			m.normal_enabled = true
			m.normal_texture = noise_tex(0.02, 256, true, 14.0, 5, null, FastNoiseLite.TYPE_CELLULAR)
			m.normal_scale = 1.4
			m.uv1_scale = Vector3(2.0, 0.35, 1.0)
			m.roughness = 0.95
			return m
		"palm_bark":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.03, 256, false, 8.0, 4,
				gradient([Color(0.3, 0.24, 0.17), Color(0.45, 0.37, 0.27), Color(0.55, 0.47, 0.36)]))
			m.normal_enabled = true
			m.normal_texture = noise_tex(0.03, 256, true, 10.0)
			m.uv1_scale = Vector3(1.0, 0.6, 1.0)
			m.roughness = 0.9
			return m
		"cut_wood":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.04, 128, false, 4.0, 3,
				gradient([Color(0.55, 0.4, 0.24), Color(0.72, 0.56, 0.36)]))
			m.roughness = 0.8
			return m
		"wood":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.015, 512, false, 6.0, 4,
				gradient([Color(0.38, 0.25, 0.14), Color(0.55, 0.39, 0.23), Color(0.62, 0.46, 0.29)]))
			m.normal_enabled = true
			m.normal_texture = noise_tex(0.015, 512, true, 3.0, 4)
			m.normal_scale = 0.6
			m.uv1_triplanar = true
			m.uv1_scale = Vector3(0.15, 1.6, 1.6)
			m.roughness = 0.75
			return m
		"rock":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.012, 512, false, 8.0, 6,
				gradient([Color(0.22, 0.21, 0.2), Color(0.42, 0.4, 0.37), Color(0.5, 0.49, 0.45), Color(0.33, 0.36, 0.25)], [0.0, 0.45, 0.8, 1.0]))
			m.normal_enabled = true
			m.normal_texture = noise_tex(0.02, 512, true, 12.0, 6)
			m.normal_scale = 1.3
			m.uv1_triplanar = true
			m.uv1_scale = Vector3(0.6, 0.6, 0.6)
			m.roughness = 0.9
			return m
		"metal":
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.55, 0.56, 0.58)
			m.metallic = 0.9
			m.roughness = 0.38
			m.albedo_texture = noise_tex(0.05, 128, false, 4.0, 4,
				gradient([Color(0.45, 0.44, 0.43), Color(0.7, 0.7, 0.72)]))
			return m
		"handle":
			var m := StandardMaterial3D.new()
			m.albedo_texture = noise_tex(0.03, 128, false, 4.0, 3,
				gradient([Color(0.35, 0.22, 0.11), Color(0.5, 0.34, 0.18)]))
			m.uv1_scale = Vector3(1.0, 0.2, 1.0)
			m.roughness = 0.6
			return m
		"coconut":
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.3, 0.22, 0.12)
			m.roughness = 0.8
			return m
		"sand_flat":
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.5, 0.44, 0.32)
			m.roughness = 1.0
			return m
		"leaves":
			var m := ShaderMaterial.new()
			m.shader = load("res://shaders/leaves.gdshader")
			return m
		"leaves_bush":
			var m := ShaderMaterial.new()
			m.shader = load("res://shaders/leaves.gdshader")
			m.set_shader_parameter("leaf_a", Color(0.09, 0.2, 0.05))
			m.set_shader_parameter("leaf_b", Color(0.22, 0.34, 0.08))
			return m
		"palm_leaves":
			var m := ShaderMaterial.new()
			m.shader = load("res://shaders/leaves.gdshader")
			m.set_shader_parameter("palm", true)
			m.set_shader_parameter("leaf_a", Color(0.16, 0.3, 0.06))
			m.set_shader_parameter("leaf_b", Color(0.36, 0.45, 0.12))
			return m
	push_error("unknown material " + id)
	return StandardMaterial3D.new()


## Seamless icosphere (no UV seam), displaced by noise -> natural rock.
static func rock_mesh(radius: float, rng: RandomNumberGenerator, flatten: float = 0.72) -> ArrayMesh:
	var t := (1.0 + sqrt(5.0)) / 2.0
	var verts: Array[Vector3] = [
		Vector3(-1, t, 0), Vector3(1, t, 0), Vector3(-1, -t, 0), Vector3(1, -t, 0),
		Vector3(0, -1, t), Vector3(0, 1, t), Vector3(0, -1, -t), Vector3(0, 1, -t),
		Vector3(t, 0, -1), Vector3(t, 0, 1), Vector3(-t, 0, -1), Vector3(-t, 0, 1)]
	var faces: Array = [
		[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
		[11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
		[3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
	for i in verts.size():
		verts[i] = verts[i].normalized()
	for _s in 2:
		var mid := {}
		var nf: Array = []
		for f in faces:
			var m: Array = []
			for e in 3:
				var a: int = f[e]
				var b: int = f[(e + 1) % 3]
				var key := Vector2i(mini(a, b), maxi(a, b))
				if not mid.has(key):
					verts.append((verts[a] + verts[b]).normalized())
					mid[key] = verts.size() - 1
				m.append(mid[key])
			nf.append([f[0], m[0], m[2]])
			nf.append([f[1], m[1], m[0]])
			nf.append([f[2], m[2], m[1]])
			nf.append([m[0], m[1], m[2]])
		faces = nf
	var n := FastNoiseLite.new()
	n.seed = rng.randi()
	n.frequency = 0.9
	n.fractal_octaves = 4
	var stretch := Vector3(rng.randf_range(0.85, 1.25), flatten * rng.randf_range(0.8, 1.15), rng.randf_range(0.85, 1.25))
	for i in verts.size():
		var v := verts[i]
		var d := 1.0 + n.get_noise_3dv(v * 1.3) * 0.35
		# a few flat facets for a chipped look
		d = minf(d, 1.05 + v.x * 0.15)
		verts[i] = v * d * stretch * radius
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for v in verts:
		st.add_vertex(v)
	for f in faces:
		# Godot front faces are clockwise
		var a: Vector3 = verts[f[0]]
		var b: Vector3 = verts[f[1]]
		var c: Vector3 = verts[f[2]]
		var outward := (a + b + c)
		if (b - a).cross(c - a).dot(outward) > 0.0:
			st.add_index(f[0]); st.add_index(f[2]); st.add_index(f[1])
		else:
			st.add_index(f[0]); st.add_index(f[1]); st.add_index(f[2])
	st.generate_normals()
	return st.commit()
