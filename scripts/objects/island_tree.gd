class_name IslandTree
extends Node3D
## Procedural tree (broadleaf or palm). Chop it and it falls as a rigid body,
## then splits into logs. Leaves a stump behind.

var kind := "oak"
var seed_value := 0
var hp := 6
var felled := false
var trunk_radius := 0.28
var height := 5.0
var cut_height := 0.35
var trunk_pts: Array[Vector3] = []
var canopy_center := Vector3.ZERO
var canopy_radius := 2.0
var visual := Node3D.new()
var body := StaticBody3D.new()
var _rng := RandomNumberGenerator.new()


func setup(p_kind: String, seed_v: int) -> void:
	kind = p_kind
	seed_value = seed_v
	_rng.seed = seed_v
	add_to_group("trees")
	add_to_group("island_trees")
	add_child(visual)
	add_child(body)
	body.collision_layer = Game.L_TREES
	body.collision_mask = 0
	if kind == "palm":
		_build_palm()
	else:
		_build_oak()
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = trunk_radius
	cap.height = maxf(height * 0.9, trunk_radius * 2.0 + 0.1)
	cs.shape = cap
	cs.position = Vector3(0, cap.height * 0.5, 0)
	body.add_child(cs)
	hp = int(3 + trunk_radius * 14.0)


# ---------------------------------------------------------------- geometry

static func _add_tube(st: SurfaceTool, p0: Vector3, p1: Vector3, r0: float, r1: float, sides: int, v0: float) -> float:
	var axis := (p1 - p0)
	var length := axis.length()
	axis /= length
	var ref := Vector3.UP if absf(axis.y) < 0.95 else Vector3.RIGHT
	var u := axis.cross(ref).normalized()
	var w := axis.cross(u)
	var v1 := v0 + length
	for s in sides:
		var a0 := TAU * s / sides
		var a1 := TAU * (s + 1) / sides
		var n0 := u * cos(a0) + w * sin(a0)
		var n1 := u * cos(a1) + w * sin(a1)
		var q := [
			[p0 + n0 * r0, n0, Vector2(float(s) / sides, v0)],
			[p0 + n1 * r0, n1, Vector2(float(s + 1) / sides, v0)],
			[p1 + n1 * r1, n1, Vector2(float(s + 1) / sides, v1)],
			[p1 + n0 * r1, n0, Vector2(float(s) / sides, v1)]]
		var tris := [[0, 1, 2], [0, 2, 3]]
		var outward := n0 + n1
		var geo: Vector3 = (q[1][0] - q[0][0]).cross(q[2][0] - q[0][0])
		for t in tris:
			var order: Array = t if geo.dot(outward) < 0.0 else [t[0], t[2], t[1]]
			for k in order:
				st.set_normal(q[k][1])
				st.set_uv(q[k][2])
				st.add_vertex(q[k][0])
	return v1


static func add_leaf_cluster(st: SurfaceTool, rng: RandomNumberGenerator, canopy: Vector3, center: Vector3, radius: float, count: int) -> void:
	for _i in count:
		var dir := Vector3(rng.randf_range(-1, 1), rng.randf_range(-0.6, 1), rng.randf_range(-1, 1)).normalized()
		var p := center + dir * radius * pow(rng.randf(), 0.5)
		var sz := rng.randf_range(0.28, 0.42)
		var n := (p - center).normalized()
		var t1 := n.cross(Vector3(rng.randf() - 0.5, 1, rng.randf() - 0.5).normalized()).normalized()
		if t1.length_squared() < 0.01:
			t1 = Vector3.RIGHT
		var t2 := n.cross(t1).normalized()
		t2 = (t2 + n * 0.3).normalized()
		var col := Color(rng.randf(), 1.0, 0, 1)
		var c0 := p - t1 * sz * 0.5 - t2 * sz
		var c1 := p + t1 * sz * 0.5 - t2 * sz
		var c2 := p + t1 * sz * 0.5 + t2 * sz
		var c3 := p - t1 * sz * 0.5 + t2 * sz
		var sn := (p - canopy).normalized()
		for v in [[c0, Vector2(0, 0)], [c1, Vector2(1, 0)], [c2, Vector2(1, 1)], [c0, Vector2(0, 0)], [c2, Vector2(1, 1)], [c3, Vector2(0, 1)]]:
			st.set_color(col)
			st.set_normal(sn)
			st.set_uv(v[1])
			st.add_vertex(v[0])


func _build_oak() -> void:
	height = _rng.randf_range(4.5, 6.5)
	trunk_radius = _rng.randf_range(0.22, 0.33)
	var bark := SurfaceTool.new()
	bark.begin(Mesh.PRIMITIVE_TRIANGLES)
	var leaves := SurfaceTool.new()
	leaves.begin(Mesh.PRIMITIVE_TRIANGLES)
	var lean := Vector3(_rng.randf_range(-0.3, 0.3), 0, _rng.randf_range(-0.3, 0.3))
	var trunk_top := Vector3(0, height * 0.6, 0) + lean
	trunk_pts = [Vector3(0, -0.6, 0), Vector3(0, height * 0.3, 0) + lean * 0.4, trunk_top]
	var v := 0.0
	v = _add_tube(bark, trunk_pts[0], trunk_pts[1], trunk_radius * 1.25, trunk_radius, 10, v)
	v = _add_tube(bark, trunk_pts[1], trunk_pts[2], trunk_radius, trunk_radius * 0.72, 10, v)
	canopy_center = trunk_top + Vector3(0, height * 0.28, 0)
	canopy_radius = height * 0.42
	var clusters: Array[Vector3] = [canopy_center + Vector3(0, 0.4, 0)]
	var nb := _rng.randi_range(3, 5)
	for b in nb:
		var ang := TAU * b / nb + _rng.randf_range(-0.4, 0.4)
		var out := Vector3(cos(ang), _rng.randf_range(0.5, 1.0), sin(ang)).normalized()
		var bl := _rng.randf_range(1.4, 2.2)
		var start := trunk_top - Vector3(0, _rng.randf_range(0.0, 0.6), 0)
		var mid := start + out * bl
		_add_tube(bark, start, mid, trunk_radius * 0.55, trunk_radius * 0.3, 7, 0.0)
		for s in 2:
			var a2 := ang + (s - 0.5) * 1.1
			var o2 := Vector3(cos(a2), _rng.randf_range(0.3, 0.9), sin(a2)).normalized()
			var tip := mid + o2 * _rng.randf_range(0.8, 1.3)
			_add_tube(bark, mid, tip, trunk_radius * 0.3, trunk_radius * 0.12, 5, 0.0)
			clusters.append(tip)
		clusters.append(mid + out * 0.3)
	for c in clusters:
		add_leaf_cluster(leaves, _rng, canopy_center, c, _rng.randf_range(1.0, 1.4), 90)
	_finish_mesh(bark, "bark")
	_finish_mesh(leaves, "leaves")
	trunk_pts.append(trunk_top + Vector3(0, 0.8, 0))


func _build_palm() -> void:
	height = _rng.randf_range(5.0, 7.5)
	trunk_radius = _rng.randf_range(0.17, 0.22)
	var bark := SurfaceTool.new()
	bark.begin(Mesh.PRIMITIVE_TRIANGLES)
	var fronds := SurfaceTool.new()
	fronds.begin(Mesh.PRIMITIVE_TRIANGLES)
	# lean away from the island centre, towards the sea, like real coastal palms
	var outward := Vector3(global_position.x, 0, global_position.z).normalized()
	if outward.length_squared() < 0.1:
		outward = Vector3.RIGHT
	var lean := (outward + Vector3(_rng.randf_range(-0.4, 0.4), 0, _rng.randf_range(-0.4, 0.4))).normalized() * height * _rng.randf_range(0.18, 0.32)
	var segs := 9
	trunk_pts = []
	for i in segs + 1:
		var t := float(i) / segs
		trunk_pts.append(Vector3(0, -0.5 + (height + 0.5) * t, 0) + lean * t * t)
	var v := 0.0
	for i in segs:
		var t := float(i) / segs
		var r0 := trunk_radius * (1.25 - 0.35 * t)
		var r1 := trunk_radius * (1.25 - 0.35 * (t + 1.0 / segs))
		# ring bumps
		var mid := trunk_pts[i].lerp(trunk_pts[i + 1], 0.5)
		v = _add_tube(bark, trunk_pts[i], mid, r0 * 1.06, r0 * 0.96, 9, v)
		v = _add_tube(bark, mid, trunk_pts[i + 1], r0 * 0.96, r1 * 1.06, 9, v)
	var top := trunk_pts[segs]
	canopy_center = top
	canopy_radius = 2.2
	var nf := _rng.randi_range(9, 12)
	for f in nf:
		var ang := TAU * f / nf + _rng.randf_range(-0.2, 0.2)
		var dir := Vector3(cos(ang), 0, sin(ang))
		var side := Vector3(-dir.z, 0, dir.x)
		var flen := _rng.randf_range(2.4, 3.2)
		var up0 := _rng.randf_range(0.3, 0.8)
		var col := Color(_rng.randf(), 1.0, 0, 1)
		var n := 10
		var prev: Array = []
		for s in n + 1:
			var t := float(s) / n
			var p := top + dir * flen * t + Vector3.UP * (up0 * t - 1.6 * t * t) * flen * 0.5
			var wdt := 0.55 * sin(PI * minf(t * 1.2, 1.0)) + 0.05
			var droop := Vector3.DOWN * wdt * 0.25
			var l := p - side * wdt + droop
			var r := p + side * wdt + droop
			var cur := [l, p, r, t]
			if s > 0:
				_frond_quad(fronds, prev[0], prev[1], cur[1], cur[0], 0.0, 0.5, prev[3], t, col)
				_frond_quad(fronds, prev[1], prev[2], cur[2], cur[1], 0.5, 1.0, prev[3], t, col)
			prev = cur
	_finish_mesh(bark, "palm_bark")
	_finish_mesh(fronds, "palm_leaves")
	# coconuts
	for i in _rng.randi_range(2, 4):
		var c := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.1
		sm.height = 0.22
		c.mesh = sm
		c.material_override = Mats.get_mat("coconut")
		var a := _rng.randf() * TAU
		c.position = top + Vector3(cos(a) * 0.18, -0.2, sin(a) * 0.18)
		visual.add_child(c)


func _frond_quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, u0: float, u1: float, v0: float, v1: float, col: Color) -> void:
	var n := (b - a).cross(d - a).normalized()
	if n.y < 0.0:
		n = -n
	for vv in [[a, Vector2(u0, v0)], [b, Vector2(u1, v0)], [c, Vector2(u1, v1)], [a, Vector2(u0, v0)], [c, Vector2(u1, v1)], [d, Vector2(u0, v1)]]:
		st.set_color(Color(col.r, v1, 0, 1))
		st.set_normal(n)
		st.set_uv(vv[1])
		st.add_vertex(vv[0])


func _finish_mesh(st: SurfaceTool, mat_id: String) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = Mats.get_mat(mat_id)
	visual.add_child(mi)


# ---------------------------------------------------------------- gameplay

func hit(dir: Vector3, point: Vector3) -> void:
	if felled:
		return
	hp -= 1
	Fx.burst(point, Color(0.62, 0.47, 0.3), 14, 3.0, 0.045, 1.1)
	Game.sfx.play("chop", point)
	var tw := create_tween()
	var axis := dir.cross(Vector3.UP).normalized()
	var q0 := visual.quaternion
	tw.tween_property(visual, "quaternion", Quaternion(axis, -0.025) * q0, 0.06)
	tw.tween_property(visual, "quaternion", q0, 0.35).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	if hp <= 0:
		fell(dir)


func check_ground() -> void:
	if felled or Game.world == null:
		return
	if Game.world.density_at(global_position + Vector3(0, -0.4, 0)) <= 0.0 and Game.world.density_at(global_position + Vector3(0, -1.2, 0)) <= 0.0:
		fell(Vector3(_rng.randf_range(-1, 1), 0, _rng.randf_range(-1, 1)).normalized(), false)


func fell(dir: Vector3, leave_stump: bool = true) -> void:
	if felled:
		return
	felled = true
	remove_from_group("trees")
	var rb := RigidBody3D.new()
	rb.collision_layer = Game.L_PROPS
	rb.collision_mask = Game.L_TERRAIN | Game.L_PROPS | Game.L_STRUCT | Game.L_TREES
	rb.mass = PI * trunk_radius * trunk_radius * height * 650.0 + 40.0
	var pm := PhysicsMaterial.new()
	pm.friction = 0.9
	pm.bounce = 0.02
	rb.physics_material_override = pm
	get_parent().add_child(rb)
	rb.global_transform = global_transform
	visual.reparent(rb)
	var start_y := cut_height if leave_stump else -0.6
	for i in trunk_pts.size() - 1:
		var a := trunk_pts[i]
		var b := trunk_pts[i + 1]
		if b.y < start_y:
			continue
		if a.y < start_y:
			a = a.lerp(b, (start_y - a.y) / (b.y - a.y))
		var seg := b - a
		if seg.length() < 0.1:
			continue
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = trunk_radius * 0.9
		cap.height = maxf(seg.length(), cap.radius * 2.0 + 0.01)
		cs.shape = cap
		cs.transform = Transform3D(_basis_y(seg.normalized()), (a + b) * 0.5)
		rb.add_child(cs)
	var cc := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = canopy_radius * (0.55 if kind == "oak" else 0.45)
	cc.shape = sp
	cc.position = canopy_center
	rb.add_child(cc)
	rb.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	rb.center_of_mass = Vector3(0, height * 0.45, 0)
	var push := Vector3(dir.x, 0, dir.z).normalized()
	rb.apply_impulse(push * rb.mass * 0.9, Vector3.UP * height * 0.8)
	Game.sfx.play("tree_fall", global_position + Vector3.UP * 3.0, 2.0)

	body.queue_free()
	if leave_stump:
		_make_stump()
	else:
		get_tree().create_timer(12.0).timeout.connect(queue_free)
	var info := {"rb": rb, "radius": trunk_radius, "pts": trunk_pts.duplicate(), "start": start_y,
		"canopy": canopy_center}
	get_tree().create_timer(5.5).timeout.connect(IslandTree._break_into_logs.bind(info))


## Restores an already-felled tree from a save: only the stump remains.
func make_stump_only() -> void:
	felled = true
	remove_from_group("trees")
	visual.queue_free()
	body.queue_free()
	_make_stump()


static func _basis_y(up: Vector3) -> Basis:
	var ref := Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
	var x := up.cross(ref).normalized()
	var z := x.cross(up).normalized()
	return Basis(x, up, z)


func _make_stump() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_add_tube(st, Vector3(0, -0.6, 0), Vector3(0, cut_height, 0), trunk_radius * 1.25, trunk_radius * 1.05, 10, 0.0)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = Mats.get_mat("palm_bark" if kind == "palm" else "bark")
	add_child(mi)
	var top := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = trunk_radius * 1.02
	cm.bottom_radius = trunk_radius * 1.02
	cm.height = 0.02
	cm.material = Mats.get_mat("cut_wood")
	top.mesh = cm
	top.position = Vector3(0, cut_height, 0)
	add_child(top)
	var sb := StaticBody3D.new()
	sb.collision_layer = Game.L_TREES
	var cs := CollisionShape3D.new()
	var cy := CylinderShape3D.new()
	cy.radius = trunk_radius * 1.1
	cy.height = cut_height + 0.6
	cs.shape = cy
	cs.position = Vector3(0, (cut_height - 0.6) * 0.5, 0)
	sb.add_child(cs)
	add_child(sb)


static func _break_into_logs(info: Dictionary) -> void:
	var rb: RigidBody3D = info["rb"]
	if not is_instance_valid(rb):
		return
	var xf := rb.global_transform
	var pts: Array = info["pts"]
	var start_y: float = info["start"]
	var radius: float = info["radius"]
	var vel := rb.linear_velocity
	# walk the trunk polyline, emitting ~1.2 m logs
	var poly: Array[Vector3] = []
	for i in pts.size():
		var p: Vector3 = pts[i]
		if p.y >= start_y:
			if poly.is_empty() and i > 0:
				var a: Vector3 = pts[i - 1]
				poly.append(a.lerp(p, (start_y - a.y) / (p.y - a.y)))
			poly.append(p)
	var seg_len := 1.2
	var acc := 0.0
	var last := poly[0] if poly.size() > 0 else Vector3.ZERO
	var logs := 0
	for i in range(1, poly.size()):
		var a := poly[i - 1]
		var b := poly[i]
		var d := a.distance_to(b)
		var t := 0.0
		while acc + (d - t) >= seg_len and logs < 6:
			var need := seg_len - acc
			t += need
			var p := a.lerp(b, t / d)
			var axis := (p - last).normalized()
			var mid := (p + last) * 0.5
			var r := radius * (0.95 - logs * 0.07)
			var lg := PhysicsItem.make_log(xf * mid, xf.basis * IslandTree._basis_y(axis), maxf(r, 0.1), seg_len - 0.04)
			lg.linear_velocity = vel
			last = p
			acc = 0.0
			logs += 1
		acc += d - t
	var canopy: Vector3 = info["canopy"]
	Fx.burst(xf * canopy, Color(0.25, 0.4, 0.1), 60, 3.0, 0.14, 2.2, 3.0, Vector3.UP, 180.0, true)
	if Game.sfx:
		Game.sfx.play("break", xf * canopy, -2.0)
	rb.queue_free()
