class_name VoxelWorld
extends Node3D
## Smooth, fully editable voxel island. Density field (>0 = solid) meshed with
## Surface Nets, so the terrain is continuous and organic instead of cubes.

const CHUNK := 16
const SX := 96
const SY := 48
const SZ := 96
const SXY := SX * SY
const ORIGIN := Vector3(-48.0, -14.0, -48.0)
const DMAX := 3.0
const NCX := 6  # ceil((SX-1)/CHUNK)
const NCY := 3
const NCZ := 6

enum { MAT_GRASS, MAT_SAND, MAT_STONE, MAT_DIRT }

const CORNER := [
	Vector3(0, 0, 0), Vector3(1, 0, 0), Vector3(0, 1, 0), Vector3(1, 1, 0),
	Vector3(0, 0, 1), Vector3(1, 0, 1), Vector3(0, 1, 1), Vector3(1, 1, 1)]
const CORNER_OFF := [0, 1, SX, SX + 1, SXY, SXY + 1, SXY + SX, SXY + SX + 1]
const EDGE_A := [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3]
const EDGE_B := [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7]
const MAT_COLORS := [Color(1, 0, 0, 0), Color(0, 1, 0, 0), Color(0, 0, 1, 0), Color(0, 0, 0, 1)]

var density := PackedFloat32Array()
var materials := PackedByteArray()
var heights := PackedFloat32Array()
var seed_value := 0
var chunks := {}
var terrain_material: ShaderMaterial
var grass_material: ShaderMaterial
var grass_mesh: ArrayMesh

var _noise_h := FastNoiseLite.new()
var _noise_c := FastNoiseLite.new()
var _noise_3 := FastNoiseLite.new()
var _noise_r := FastNoiseLite.new()
var _noise_dry := FastNoiseLite.new()
var _mutex := Mutex.new()
var _slices: Array = []
var _task_coords: Array[Vector3i] = []
var _task_results := {}


func _ready() -> void:
	_build_materials()


# ---------------------------------------------------------------- generation

## override: {density, materials} from a save replaces the generated field before meshing.
func generate(seed_v: int, progress: Callable, override: Dictionary = {}) -> void:
	seed_value = seed_v
	for n in [_noise_h, _noise_c, _noise_3, _noise_r, _noise_dry]:
		n.seed = seed_v
		seed_v += 17
	_noise_h.frequency = 0.035
	_noise_h.fractal_octaves = 5
	_noise_c.frequency = 0.06
	_noise_c.fractal_octaves = 3
	_noise_3.frequency = 0.075
	_noise_3.fractal_octaves = 3
	_noise_r.frequency = 0.028
	_noise_r.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	_noise_r.fractal_octaves = 3
	_noise_dry.frequency = 0.05

	heights.resize(SX * SZ)
	for z in SZ:
		for x in SX:
			heights[x + z * SX] = _height_at(ORIGIN.x + x, ORIGIN.z + z)
	progress.call(0.1, "Raising the island...")
	await get_tree().process_frame

	_slices.resize(SZ)
	var gid := WorkerThreadPool.add_group_task(_gen_slice, SZ, -1, true, "gen")
	WorkerThreadPool.wait_for_group_task_completion(gid)
	density = PackedFloat32Array()
	materials = PackedByteArray()
	for z in SZ:
		density.append_array(_slices[z][0])
		materials.append_array(_slices[z][1])
	_slices.clear()
	if not override.is_empty():
		density = override["density"]
		materials = override["materials"]
	progress.call(0.35, "Carving cliffs and caves...")
	await get_tree().process_frame

	var all: Array[Vector3i] = []
	for cz in NCZ:
		for cy in NCY:
			for cx in NCX:
				var c := Vector3i(cx, cy, cz)
				var ch := TerrainChunk.new()
				ch.coord = c
				chunks[c] = ch
				add_child(ch)
				all.append(c)
	_remesh(all)
	progress.call(0.6, "Growing grass...")
	await get_tree().process_frame


func _height_at(wx: float, wz: float) -> float:
	var r := sqrt(wx * wx + wz * wz)
	var ang := atan2(wz, wx)
	var R := 24.0 + _noise_c.get_noise_2d(cos(ang) * 18.0, sin(ang) * 18.0) * 6.0
	R += _noise_c.get_noise_2d(wx, wz) * 2.5
	var t := 1.0 - r / R
	# deep seabed -> shallow sandy shelf (turquoise lagoon) -> beach berm
	var base := lerpf(-7.5, -1.4, smoothstep(-0.85, -0.22, t))
	base = lerpf(base, 1.1, smoothstep(-0.22, 0.03, t))
	# north side rises as a steep sea cliff
	var cliff := clampf(-wz / (r + 0.01), 0.0, 1.0)
	cliff = cliff * cliff
	var hill := smoothstep(0.1 + 0.04 * cliff, 0.85 - 0.62 * cliff, t)
	var hn := _noise_h.get_noise_2d(wx, wz)
	var h := base + hill * (6.5 + 5.5 * (hn * 0.5 + 0.5))
	var rn := _noise_r.get_noise_2d(wx, wz)
	h += hill * maxf(rn, 0.0) * 3.0
	h += hn * 0.35 * (1.0 - hill)
	return h


func _gen_slice(z: int) -> void:
	var d := PackedFloat32Array()
	d.resize(SXY)
	var m := PackedByteArray()
	m.resize(SXY)
	var wz := ORIGIN.z + z
	var cave_a := Vector3(-1.0, 3.0, -25.0)
	var cave_b := Vector3(2.5, 3.6, -9.0)
	for x in SX:
		var h := heights[x + z * SX]
		var wx := ORIGIN.x + x
		for y in SY:
			var wy := ORIGIN.y + y
			var v := h - wy
			if h > 2.5 and v > -5.0 and v < 7.0 and wy > 1.0:
				v += _noise_3.get_noise_3d(wx, wy, wz) * 2.4 * clampf((wy - 1.0) / 3.0, 0.0, 1.0)
			# sea cave tunnel
			var p := Vector3(wx, wy, wz)
			var ab := cave_b - cave_a
			var tt := clampf((p - cave_a).dot(ab) / ab.length_squared(), 0.0, 1.0)
			var q := p - (cave_a + ab * tt)
			q.y *= 1.35
			var cr := 2.1 + _noise_3.get_noise_3d(wx * 2.0, wy * 2.0, wz * 2.0) * 0.6 - tt * 0.5
			v = minf(v, q.length() - cr)
			if y == 0:
				v = DMAX
			v = clampf(v, -DMAX, DMAX)
			var depth := h - wy
			var mat := MAT_STONE
			if h < 1.4:
				mat = MAT_SAND if depth < 3.5 else MAT_STONE
			elif depth < 1.1:
				mat = MAT_GRASS
			elif depth < 3.2:
				mat = MAT_DIRT
			var i := x + y * SX
			d[i] = v
			m[i] = mat
	_mutex.lock()
	_slices[z] = [d, m]
	_mutex.unlock()


# ---------------------------------------------------------------- meshing

func _remesh(coords: Array[Vector3i]) -> void:
	if coords.is_empty():
		return
	_task_coords = coords
	_task_results.clear()
	if OS.has_environment("JAZIRA_SERIAL_MESH"):
		for i in coords.size():
			_mesh_task(i)
	else:
		var gid := WorkerThreadPool.add_group_task(_mesh_task, coords.size(), -1, true, "mesh")
		WorkerThreadPool.wait_for_group_task_completion(gid)
	for c in coords:
		var ch: TerrainChunk = chunks[c]
		ch.apply(_task_results[c], terrain_material, grass_mesh, grass_material)
	_task_results.clear()


func _mesh_task(i: int) -> void:
	var c: Vector3i = _task_coords[i]
	var data := build_chunk(c)
	_mutex.lock()
	_task_results[c] = data
	_mutex.unlock()


static func _grad(density: PackedFloat32Array, x: int, y: int, z: int) -> Vector3:
	var x0 := maxi(x - 1, 0)
	var x1 := mini(x + 1, SX - 1)
	var y0 := maxi(y - 1, 0)
	var y1 := mini(y + 1, SY - 1)
	var z0 := maxi(z - 1, 0)
	var z1 := mini(z + 1, SZ - 1)
	var b := y * SX + z * SXY
	var gx := density[x1 + b] - density[x0 + b]
	var bx := x + z * SXY
	var gy := density[bx + y1 * SX] - density[bx + y0 * SX]
	var by := x + y * SX
	var gz := density[by + z1 * SXY] - density[by + z0 * SXY]
	return Vector3(gx, gy, gz)


func build_chunk(c: Vector3i) -> Dictionary:
	var x0 := c.x * CHUNK
	var y0 := c.y * CHUNK
	var z0 := c.z * CHUNK
	var x1 := mini(x0 + CHUNK, SX - 1)
	var y1 := mini(y0 + CHUNK, SY - 1)
	var z1 := mini(z0 + CHUNK, SZ - 1)
	var vx0 := maxi(x0 - 1, 0)
	var vy0 := maxi(y0 - 1, 0)
	var vz0 := maxi(z0 - 1, 0)
	var lw := x1 - vx0
	var lh := y1 - vy0
	var ld := z1 - vz0
	var vmap := PackedInt32Array()
	vmap.resize(lw * lh * ld)
	vmap.fill(-1)
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var cols := PackedColorArray()
	var idx := PackedInt32Array()
	var dens := density
	var mats := materials
	# thread-local copies of the lookup tables (shared const Arrays are not safe across worker threads)
	var corner := PackedVector3Array(CORNER)
	var corner_off := PackedInt32Array(CORNER_OFF)
	var edge_a := PackedInt32Array(EDGE_A)
	var edge_b := PackedInt32Array(EDGE_B)
	var mat_colors := PackedColorArray(MAT_COLORS)
	var cd := PackedFloat32Array()
	cd.resize(8)

	for z in range(vz0, z1):
		for y in range(vy0, y1):
			for x in range(vx0, x1):
				var i0 := x + y * SX + z * SXY
				var mask := 0
				for k in 8:
					var dv := dens[i0 + corner_off[k]]
					cd[k] = dv
					if dv > 0.0:
						mask |= 1 << k
				if mask == 0 or mask == 255:
					continue
				var sum := Vector3.ZERO
				var cnt := 0
				for e in 12:
					var a: int = edge_a[e]
					var b: int = edge_b[e]
					var da := cd[a]
					var db := cd[b]
					if (da > 0.0) != (db > 0.0):
						var t := da / (da - db)
						sum += corner[a].lerp(corner[b], t)
						cnt += 1
				var lp := sum / float(cnt)
				# smooth normal: trilinear blend of central-difference gradients
				var g := Vector3.ZERO
				for k in 8:
					var co: Vector3 = corner[k]
					var wgt := (lp.x if co.x > 0.5 else 1.0 - lp.x) * (lp.y if co.y > 0.5 else 1.0 - lp.y) * (lp.z if co.z > 0.5 else 1.0 - lp.z)
					g += _grad(dens, x + int(co.x), y + int(co.y), z + int(co.z)) * wgt
				var nrm := -g.normalized() if g.length_squared() > 0.000001 else Vector3.UP
				var col := Color(0, 0, 0, 0)
				var wsum := 0.0
				for k in 8:
					if cd[k] > 0.0:
						var w := minf(cd[k], 1.0) + 0.2
						var mc: Color = mat_colors[mats[i0 + corner_off[k]]]
						col += mc * w
						wsum += w
				col /= wsum
				vmap[(x - vx0) + (y - vy0) * lw + (z - vz0) * lw * lh] = verts.size()
				verts.append(ORIGIN + Vector3(x, y, z) + lp)
				norms.append(nrm)
				cols.append(col)

	var lwh := lw * lh
	for z in range(z0, z1):
		for y in range(y0, y1):
			for x in range(x0, x1):
				var i := x + y * SX + z * SXY
				var s0 := dens[i] > 0.0
				var lx := x - vx0
				var ly := y - vy0
				var lz := z - vz0
				if y > 0 and z > 0 and s0 != (dens[i + 1] > 0.0):
					_quad(idx, verts,
						vmap[lx + (ly - 1) * lw + (lz - 1) * lwh], vmap[lx + ly * lw + (lz - 1) * lwh],
						vmap[lx + ly * lw + lz * lwh], vmap[lx + (ly - 1) * lw + lz * lwh],
						Vector3(1, 0, 0) if s0 else Vector3(-1, 0, 0))
				if x > 0 and z > 0 and s0 != (dens[i + SX] > 0.0):
					_quad(idx, verts,
						vmap[(lx - 1) + ly * lw + (lz - 1) * lwh], vmap[lx + ly * lw + (lz - 1) * lwh],
						vmap[lx + ly * lw + lz * lwh], vmap[(lx - 1) + ly * lw + lz * lwh],
						Vector3(0, 1, 0) if s0 else Vector3(0, -1, 0))
				if x > 0 and y > 0 and s0 != (dens[i + SXY] > 0.0):
					_quad(idx, verts,
						vmap[(lx - 1) + (ly - 1) * lw + lz * lwh], vmap[lx + (ly - 1) * lw + lz * lwh],
						vmap[lx + ly * lw + lz * lwh], vmap[(lx - 1) + ly * lw + lz * lwh],
						Vector3(0, 0, 1) if s0 else Vector3(0, 0, -1))

	var faces := PackedVector3Array()
	faces.resize(idx.size())
	for k in idx.size():
		faces[k] = verts[idx[k]]

	# grass instances
	var gx: Array[Transform3D] = []
	var gc := PackedColorArray()
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(c)
	var k3 := 0
	while k3 < idx.size():
		var a := verts[idx[k3]]
		var b := verts[idx[k3 + 1]]
		var cc := verts[idx[k3 + 2]]
		var grass_w := (cols[idx[k3]].r + cols[idx[k3 + 1]].r + cols[idx[k3 + 2]].r) / 3.0
		k3 += 3
		if grass_w < 0.55 or minf(a.y, minf(b.y, cc.y)) < 1.0:
			continue
		var fn := (b - a).cross(cc - a)
		var area := fn.length() * 0.5
		if area < 0.0001:
			continue
		# clockwise front faces: geometric normal points into the ground
		var ny := -fn.y / (area * 2.0)
		if ny < 0.8:
			continue
		var expected := area * 5.5 * smoothstep(0.55, 0.9, grass_w)
		var n_inst := int(expected) + (1 if rng.randf() < expected - int(expected) else 0)
		for _j in n_inst:
			var u := rng.randf()
			var v := rng.randf()
			if u + v > 1.0:
				u = 1.0 - u
				v = 1.0 - v
			var p := a + (b - a) * u + (cc - a) * v
			var s := rng.randf_range(0.7, 1.35)
			var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.8, 1.3), s))
			gx.append(Transform3D(basis, p - Vector3(0, 0.03, 0)))
			var dry := clampf(_noise_dry.get_noise_2d(p.x, p.z) * 1.2 + 0.1, 0.0, 1.0)
			gc.append(Color(dry, rng.randf(), 0, 1))

	return {"verts": verts, "norms": norms, "cols": cols, "idx": idx, "faces": faces,
		"grass": gx, "grass_cols": gc}


func _quad(idx: PackedInt32Array, verts: PackedVector3Array, a: int, b: int, c: int, d: int, out_dir: Vector3) -> void:
	if a < 0 or b < 0 or c < 0 or d < 0:
		return
	var pa := verts[a]
	# Godot treats clockwise triangles as front-facing: (b-a)x(c-a) must point inward.
	if (verts[b] - pa).cross(verts[c] - pa).dot(out_dir) > 0.0:
		idx.append_array([a, c, b, a, d, c])
	else:
		idx.append_array([a, b, c, a, c, d])


# ---------------------------------------------------------------- queries / edits

func to_grid(p: Vector3) -> Vector3:
	return p - ORIGIN


func density_at(p: Vector3) -> float:
	var g := (p - ORIGIN).round()
	var x := int(g.x)
	var y := int(g.y)
	var z := int(g.z)
	if x < 0 or y < 0 or z < 0 or x >= SX or y >= SY or z >= SZ:
		return -1.0
	return density[x + y * SX + z * SXY]


func material_at(p: Vector3) -> int:
	# nearest solid voxel around p
	var g := (p - ORIGIN).round()
	var best := -1
	var bd := -99.0
	for dz in [-1, 0, 1]:
		for dy in [-1, 0]:
			for dx in [-1, 0, 1]:
				var x: int = int(g.x) + dx
				var y: int = int(g.y) + dy
				var z: int = int(g.z) + dz
				if x < 0 or y < 0 or z < 0 or x >= SX or y >= SY or z >= SZ:
					continue
				var i: int = x + y * SX + z * SXY
				if density[i] > bd:
					bd = density[i]
					best = materials[i]
	return maxi(best, 0)


## World-space height of the surface at (x, z), scanning from the top.
func surface_height(wx: float, wz: float) -> float:
	var x := int(round(wx - ORIGIN.x))
	var z := int(round(wz - ORIGIN.z))
	if x < 0 or z < 0 or x >= SX or z >= SZ:
		return -8.0
	for y in range(SY - 2, -1, -1):
		var d0 := density[x + y * SX + z * SXY]
		if d0 > 0.0:
			var d1 := density[x + (y + 1) * SX + z * SXY]
			var t := d0 / (d0 - d1)
			return ORIGIN.y + y + t
	return ORIGIN.y


## Adds (amount > 0) or removes (amount < 0) material in a sphere.
## Returns {material_id: volume_changed}. max_add caps the total solid volume added.
func edit_sphere(center: Vector3, radius: float, amount: float, add_mat: int = MAT_DIRT, max_add: float = 100000.0) -> Dictionary:
	var lc := center - ORIGIN
	var minx := maxi(1, floori(lc.x - radius))
	var maxx := mini(SX - 2, ceili(lc.x + radius))
	var miny := maxi(1, floori(lc.y - radius))
	var maxy := mini(SY - 2, ceili(lc.y + radius))
	var minz := maxi(1, floori(lc.z - radius))
	var maxz := mini(SZ - 2, ceili(lc.z + radius))
	var changed := {}
	var any := false
	var added := 0.0
	for z in range(minz, maxz + 1):
		for y in range(miny, maxy + 1):
			for x in range(minx, maxx + 1):
				var dist := Vector3(x, y, z).distance_to(lc)
				if dist > radius:
					continue
				var f := 1.0 - dist / radius
				f = f * f * (3.0 - 2.0 * f)
				var i := x + y * SX + z * SXY
				var old := density[i]
				var nv := clampf(old + amount * f, -DMAX, DMAX)
				# solid "volume" of a voxel ~ its density clamped to [0, 1]
				var vol_old := clampf(old + 0.5, 0.0, 1.0)
				var vol_new := clampf(nv + 0.5, 0.0, 1.0)
				if amount < 0.0:
					if vol_old > vol_new:
						changed[materials[i]] = float(changed.get(materials[i], 0.0)) + vol_old - vol_new
				else:
					if vol_new > vol_old:
						if added >= max_add:
							continue
						added += vol_new - vol_old
						changed[add_mat] = float(changed.get(add_mat, 0.0)) + vol_new - vol_old
					if old <= 0.0:
						materials[i] = add_mat
				if nv != old:
					density[i] = nv
					any = true
	if not any:
		return changed
	var coords: Array[Vector3i] = []
	for cz in range(maxi(0, (minz - 1) / CHUNK), mini(NCZ - 1, (maxz + 1) / CHUNK) + 1):
		for cy in range(maxi(0, (miny - 1) / CHUNK), mini(NCY - 1, (maxy + 1) / CHUNK) + 1):
			for cx in range(maxi(0, (minx - 1) / CHUNK), mini(NCX - 1, (maxx + 1) / CHUNK) + 1):
				coords.append(Vector3i(cx, cy, cz))
	_remesh(coords)
	return changed


# ---------------------------------------------------------------- materials

func _build_materials() -> void:
	terrain_material = ShaderMaterial.new()
	terrain_material.shader = load("res://shaders/terrain.gdshader")
	terrain_material.set_shader_parameter("tex_detail", Mats.noise_tex(0.012, 512, false, 8.0, 6))
	terrain_material.set_shader_parameter("tex_normal", Mats.noise_tex(0.018, 512, true, 10.0, 6))
	terrain_material.set_shader_parameter("tex_macro", Mats.noise_tex(0.006, 256, false, 8.0, 3))

	grass_material = ShaderMaterial.new()
	grass_material.shader = load("res://shaders/grass.gdshader")
	grass_material.set_shader_parameter("wind_noise", Mats.noise_tex(0.01, 256, false, 8.0, 3))
	grass_mesh = _build_grass_clump()


func _build_grass_clump() -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for _b in 12:
		var base := Vector3(rng.randf_range(-0.22, 0.22), 0, rng.randf_range(-0.22, 0.22))
		var yaw := rng.randf() * TAU
		var side := Vector3(cos(yaw), 0, sin(yaw))
		var fwd := Vector3(-side.z, 0, side.x)
		var hgt := rng.randf_range(0.18, 0.42)
		var lean := rng.randf_range(0.05, 0.2)
		var w := rng.randf_range(0.022, 0.035)
		var segs := 4
		var prev_l := Vector3.ZERO
		var prev_r := Vector3.ZERO
		for s in segs + 1:
			var t := float(s) / segs
			var center := base + Vector3.UP * hgt * t + fwd * lean * t * t
			var ww := w * (1.0 - t * 0.92)
			var l := center - side * ww
			var r := center + side * ww
			if s > 0:
				var t0 := float(s - 1) / segs
				for tri in [[prev_l, t0, prev_r, t0, r, t], [prev_l, t0, r, t, l, t]]:
					for k in 3:
						st.set_uv(Vector2(0.5, tri[k * 2 + 1]))
						st.set_normal(Vector3.UP)
						st.add_vertex(tri[k * 2])
			prev_l = l
			prev_r = r
	return st.commit()


func apply_grass_settings() -> void:
	for c in chunks.values():
		c.apply_grass_settings()
