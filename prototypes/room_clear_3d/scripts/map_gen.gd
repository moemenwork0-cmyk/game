class_name MapGen
extends RefCounted
## Procedural building generator. The same seed always gives the same building.
##  1. footprint sized for the room count, split with BSP into rooms
##  2. adjacency between rooms, doors along a random spanning tree plus a few loops (flank routes)
##  3. walls = split lines and the outer shell minus door gaps; entrance on the south side
##  4. every room gets a type and is furnished from templates; a per-room flood fill guarantees
##     that every door stays reachable after each prop is placed
##  5. lights, windows, spawn points and room graph distances for mission placement

const SNAP := 0.5
const MIN_ROOM := 3.6
const DOOR_W := 1.3
const WALL_H := 3.0

## footprint (width x, depth z), height, scale for each prop id (front faces +Z)
const FOOT := {
	"metal_office_desk": [2.0, 0.95, 0.79, 1.0],
	"Sofa_01": [1.57, 0.66, 0.8, 1.0],
	"WoodenTable_01": [1.8, 0.66, 0.55, 1.0],
	"modern_wooden_cabinet": [2.44, 0.52, 0.68, 1.0],
	"steel_frame_shelves_01": [1.1, 0.5, 2.14, 0.1],
	"wooden_military_crate": [1.24, 0.52, 0.46, 1.0],
	"wooden_crate_01": [0.83, 0.41, 0.35, 1.0],
	"old_military_crate": [1.82, 0.98, 0.3, 1.0],
	"Barrel_01": [0.6, 0.6, 0.88, 1.0],
	"potted_plant_04": [0.5, 0.5, 0.85, 3.2],
	"plastic_monobloc_chair_01": [0.64, 0.63, 0.88, 1.0],
	"Television_01": [0.54, 0.42, 0.41, 0.9],
}

var rng := RandomNumberGenerator.new()
var bounds: Rect2
var rooms: Array = []        # {rect, type, dist, doors:[], center:Vector2}
var splits: Array = []       # {axis, c, a, b}
var adj: Array = []          # {i, j, axis, c, lo, hi}
var doors: Array = []        # {pos:Vector2, axis, c, w, rooms:[i,j], leaf:bool, entrance:bool}
var walls: Array = []        # {a:Vector2, b:Vector2, h:float, outer:bool, y0:float}
var windows: Array = []      # {x0, x1, z}
var props: Array = []        # {id, pos:Vector3, yaw, opts}
var lights: Array = []       # {pos:Vector3, energy, color, flicker}
var free_spots: Array = []   # per room: Array[Vector3]
var player_spawn := Vector3.ZERO
var entrance_room := 0
var far_room := 0
var _placed: Array = []      # per room: Array[Rect2] blocking footprints


static func generate(seed: int, room_count: int, preview_only := false) -> MapGen:
	var g := MapGen.new()
	g.rng.seed = seed
	g._preview_only = preview_only
	g._build(clampi(room_count, 3, 14))
	return g


var _preview_only := false


func _snap(v: float) -> float:
	return roundf(v / SNAP) * SNAP


func _build(n: int) -> void:
	var area := n * rng.randf_range(27.0, 34.0)
	var aspect := rng.randf_range(1.25, 1.75)
	var w := clampf(_snap(sqrt(area * aspect)), 12.0, 40.0)
	var d := clampf(_snap(area / w), 9.0, 26.0)
	bounds = Rect2(-w * 0.5, -d * 0.5, w, d)
	_bsp(n)
	_adjacency()
	_pick_entrance()
	_doors()
	_room_graph()
	_walls()
	_types()
	if _preview_only:
		return
	_furnish()
	_lights()


# ------------------------------------------------------------------ layout

func _bsp(n: int) -> void:
	var rects: Array[Rect2] = [bounds]
	var guard := 0
	while rects.size() < n and guard < 200:
		guard += 1
		var best := -1
		var best_a := 0.0
		for i in rects.size():
			var r := rects[i]
			if maxf(r.size.x, r.size.y) >= MIN_ROOM * 2.0 and r.get_area() > best_a:
				best_a = r.get_area()
				best = i
		if best < 0:
			break
		var r := rects[best]
		var vertical := r.size.x > r.size.y * 1.15 or (r.size.x >= r.size.y * 0.87 and rng.randf() < 0.5)
		if vertical and r.size.x < MIN_ROOM * 2.0:
			vertical = false
		if not vertical and r.size.y < MIN_ROOM * 2.0:
			vertical = true
		var t := rng.randf_range(0.36, 0.64)
		if vertical:
			var c := clampf(_snap(r.position.x + r.size.x * t), r.position.x + MIN_ROOM, r.end.x - MIN_ROOM)
			rects[best] = Rect2(r.position, Vector2(c - r.position.x, r.size.y))
			rects.append(Rect2(Vector2(c, r.position.y), Vector2(r.end.x - c, r.size.y)))
			splits.append({"axis": "x", "c": c, "a": r.position.y, "b": r.end.y})
		else:
			var c := clampf(_snap(r.position.y + r.size.y * t), r.position.y + MIN_ROOM, r.end.y - MIN_ROOM)
			rects[best] = Rect2(r.position, Vector2(r.size.x, c - r.position.y))
			rects.append(Rect2(Vector2(r.position.x, c), Vector2(r.size.x, r.end.y - c)))
			splits.append({"axis": "z", "c": c, "a": r.position.x, "b": r.end.x})
	for r in rects:
		rooms.append({"rect": r, "type": "", "dist": 0, "doors": [], "center": r.get_center()})


func _adjacency() -> void:
	for i in rooms.size():
		for j in range(i + 1, rooms.size()):
			var a: Rect2 = rooms[i]["rect"]
			var b: Rect2 = rooms[j]["rect"]
			for pair in [[a, b], [b, a]]:
				var p: Rect2 = pair[0]
				var q: Rect2 = pair[1]
				if absf(p.end.x - q.position.x) < 0.01:
					var lo := maxf(p.position.y, q.position.y)
					var hi := minf(p.end.y, q.end.y)
					if hi - lo >= 2.0:
						adj.append({"i": i, "j": j, "axis": "x", "c": p.end.x, "lo": lo, "hi": hi})
				if absf(p.end.y - q.position.y) < 0.01:
					var lo := maxf(p.position.x, q.position.x)
					var hi := minf(p.end.x, q.end.x)
					if hi - lo >= 2.0:
						adj.append({"i": i, "j": j, "axis": "z", "c": p.end.y, "lo": lo, "hi": hi})


func _pick_entrance() -> void:
	var best := 0
	var best_w := -1.0
	for i in rooms.size():
		var r: Rect2 = rooms[i]["rect"]
		if absf(r.end.y - bounds.end.y) < 0.01:
			var score := r.size.x + rng.randf() * 2.0 - absf(r.get_center().x - bounds.get_center().x) * 0.3
			if score > best_w:
				best_w = score
				best = i
	entrance_room = best
	var r: Rect2 = rooms[best]["rect"]
	var x := _snap(clampf(r.get_center().x + rng.randf_range(-1.0, 1.0), r.position.x + 1.0, r.end.x - 1.0))
	doors.append({"pos": Vector2(x, bounds.end.y), "axis": "z", "c": bounds.end.y, "w": 1.5, "rooms": [best, -1], "leaf": false, "entrance": true})
	rooms[best]["doors"].append(0)
	player_spawn = Vector3(x, 0, bounds.end.y + 1.6)


func _doors() -> void:
	# Prim's spanning tree from the entrance, then extra loops
	var in_tree := {entrance_room: true}
	var used := {}
	while in_tree.size() < rooms.size():
		var cands := []
		for k in adj.size():
			var e: Dictionary = adj[k]
			if in_tree.has(e["i"]) != in_tree.has(e["j"]):
				cands.append(k)
		if cands.is_empty():
			break
		var k: int = cands[rng.randi() % cands.size()]
		used[k] = true
		in_tree[adj[k]["i"]] = true
		in_tree[adj[k]["j"]] = true
		_add_door(adj[k])
	for k in adj.size():
		if not used.has(k) and rng.randf() < 0.3:
			_add_door(adj[k])


func _add_door(e: Dictionary) -> void:
	var lo: float = e["lo"] + 1.0
	var hi: float = e["hi"] - 1.0
	var t := snappedf(rng.randf_range(lo, maxf(lo, hi)), 0.1)
	var pos := Vector2(e["c"], t) if e["axis"] == "x" else Vector2(t, e["c"])
	var idx := doors.size()
	doors.append({"pos": pos, "axis": e["axis"], "c": e["c"], "w": DOOR_W, "rooms": [e["i"], e["j"]], "leaf": rng.randf() < 0.45, "entrance": false})
	rooms[e["i"]]["doors"].append(idx)
	rooms[e["j"]]["doors"].append(idx)


func _room_graph() -> void:
	for r in rooms:
		r["dist"] = 999
	rooms[entrance_room]["dist"] = 0
	var q := [entrance_room]
	while not q.is_empty():
		var i: int = q.pop_front()
		for di in rooms[i]["doors"]:
			for j in doors[di]["rooms"]:
				if j >= 0 and rooms[j]["dist"] > rooms[i]["dist"] + 1:
					rooms[j]["dist"] = rooms[i]["dist"] + 1
					q.append(j)
	var best := -1
	for i in rooms.size():
		if best < 0 or rooms[i]["dist"] > rooms[best]["dist"] or (rooms[i]["dist"] == rooms[best]["dist"] and (rooms[i]["rect"] as Rect2).get_area() > (rooms[best]["rect"] as Rect2).get_area()):
			best = i
	far_room = best


func _walls() -> void:
	# interior: split lines minus door gaps
	for s in splits:
		var gaps := []
		for d in doors:
			if d["axis"] == s["axis"] and absf(d["c"] - s["c"]) < 0.01:
				var t: float = d["pos"].y if s["axis"] == "x" else d["pos"].x
				if t > s["a"] and t < s["b"]:
					gaps.append([t - d["w"] * 0.5, t + d["w"] * 0.5])
		_wall_line(s["axis"], s["c"], s["a"], s["b"], gaps, WALL_H, false)
	# outer shell; windows on the north side
	var b := bounds
	for r in rooms:
		var rr: Rect2 = r["rect"]
		if absf(rr.position.y - b.position.y) < 0.01 and rr.size.x >= 3.4 and rng.randf() < 0.6:
			var cx := _snap(rr.get_center().x)
			windows.append({"x0": cx - 0.8, "x1": cx + 0.8, "z": b.position.y})
	var north_gaps := []
	for w in windows:
		north_gaps.append([w["x0"], w["x1"]])
	_wall_line("z", b.position.y, b.position.x - 0.15, b.end.x + 0.15, north_gaps, WALL_H, true)
	for w in windows:
		walls.append({"a": Vector2(w["x0"], w["z"]), "b": Vector2(w["x1"], w["z"]), "h": 0.9, "y0": 0.0, "outer": true})
		walls.append({"a": Vector2(w["x0"], w["z"]), "b": Vector2(w["x1"], w["z"]), "h": WALL_H - 2.2, "y0": 2.2, "outer": true})
	_wall_line("x", b.position.x, b.position.y, b.end.y, [], WALL_H, true)
	_wall_line("x", b.end.x, b.position.y, b.end.y, [], WALL_H, true)
	var e: Dictionary = doors[0]
	_wall_line("z", b.end.y, b.position.x - 0.15, b.end.x + 0.15, [[e["pos"].x - 0.75, e["pos"].x + 0.75]], 0.55, true)


func _wall_line(axis: String, c: float, a: float, b: float, gaps: Array, h: float, outer: bool) -> void:
	gaps.sort_custom(func(p: Array, q: Array) -> bool: return p[0] < q[0])
	var cur := a
	for g in gaps:
		if g[0] - cur > 0.05:
			_seg(axis, c, cur, g[0], h, outer)
		cur = maxf(cur, g[1])
	if b - cur > 0.05:
		_seg(axis, c, cur, b, h, outer)


func _seg(axis: String, c: float, t0: float, t1: float, h: float, outer: bool) -> void:
	var a := Vector2(c, t0) if axis == "x" else Vector2(t0, c)
	var b := Vector2(c, t1) if axis == "x" else Vector2(t1, c)
	walls.append({"a": a, "b": b, "h": h, "y0": 0.0, "outer": outer})


# ------------------------------------------------------------------ furnishing

func _types() -> void:
	var pool := ["office", "storage", "lounge", "armory", "storage", "office", "barracks"]
	for i in rooms.size():
		var r: Rect2 = rooms[i]["rect"]
		var aspect := maxf(r.size.x, r.size.y) / minf(r.size.x, r.size.y)
		if i == entrance_room:
			rooms[i]["type"] = "lobby"
		elif i == far_room:
			rooms[i]["type"] = "command"
		elif aspect > 2.3 or r.get_area() < 14.0:
			rooms[i]["type"] = "hall"
		else:
			rooms[i]["type"] = pool[rng.randi() % pool.size()]


func _furnish() -> void:
	for i in rooms.size():
		_placed.append([])
		free_spots.append([])
	for i in rooms.size():
		var t: String = rooms[i]["type"]
		match t:
			"lobby":
				_corner(i, "potted_plant_04")
				_along_wall(i, "plastic_monobloc_chair_01", true)
				_cluster(i, "Barrel_01", 1)
			"office", "command":
				var desk := _center(i, "metal_office_desk")
				if desk:
					var top := 0.79
					var p: Vector3 = desk["pos"]
					var yb := Basis(Vector3.UP, deg_to_rad(desk["yaw"]))
					props.append({"id": "classic_laptop", "pos": p + yb * Vector3(-0.35, top, -0.05), "yaw": desk["yaw"] + 10, "opts": {"dynamic": true, "mass": 2.5, "surface": "metal", "scale": 0.75, "intel": t == "command"}})
					props.append({"id": "ammo_box", "pos": p + yb * Vector3(0.65, top, -0.2), "yaw": desk["yaw"] + 80, "opts": {"dynamic": true, "mass": 2.0, "surface": "metal", "scale": 1.6}})
					props.append({"id": "medical_box", "pos": p + yb * Vector3(0.4, top, 0.25), "yaw": desk["yaw"] + 5, "opts": {"dynamic": true, "mass": 1.0, "surface": "metal"}})
					for k in 2:
						var cp := p + yb * Vector3(-0.5 + k * 1.0, 0, 0.9 if k == 0 else -0.95)
						props.append({"id": "plastic_monobloc_chair_01", "pos": cp, "yaw": desk["yaw"] + (180 if k == 0 else 0) + rng.randf_range(-25, 25), "opts": {"dynamic": true, "mass": 4.0, "surface": "fabric"}})
				_along_wall(i, "steel_frame_shelves_01")
				if t == "command":
					_along_wall(i, "modern_wooden_cabinet")
				_corner(i, "potted_plant_04")
			"lounge":
				var sofa := _along_wall(i, "Sofa_01")
				if sofa:
					var yb := Basis(Vector3.UP, deg_to_rad(sofa["yaw"]))
					_try_place(i, "WoodenTable_01", sofa["pos"] + yb * Vector3(0, 0, 1.25), sofa["yaw"], {})
				_along_wall(i, "steel_frame_shelves_01")
				var tv := _along_wall(i, "wooden_crate_01")
				if tv:
					props.append({"id": "Television_01", "pos": tv["pos"] + Vector3(0, 0.35, 0), "yaw": tv["yaw"], "opts": {"dynamic": true, "mass": 8.0, "surface": "metal", "scale": 0.9}})
				_corner(i, "potted_plant_04")
			"storage":
				_along_wall(i, "steel_frame_shelves_01")
				_along_wall(i, "steel_frame_shelves_01")
				_cluster(i, "wooden_crate_01", 3)
				_corner(i, "Barrel_01")
				_corner(i, "Barrel_01")
				_scatter_dyn(i, "metal_jerrycan_green", 2, {"dynamic": true, "mass": 6.0, "surface": "metal"})
			"armory":
				var c1 := _along_wall(i, "wooden_military_crate")
				if c1:
					props.append({"id": "ammo_box", "pos": c1["pos"] + Vector3(0, 0.46, 0), "yaw": c1["yaw"] + 90, "opts": {"dynamic": true, "mass": 2.0, "surface": "metal", "scale": 1.6}})
				_center(i, "old_military_crate")
				_along_wall(i, "steel_frame_shelves_01")
				_cluster(i, "wooden_crate_01", 2)
			"barracks":
				_along_wall(i, "Sofa_01")
				_center(i, "WoodenTable_01")
				_scatter_dyn(i, "plastic_monobloc_chair_01", 2, {"dynamic": true, "mass": 4.0, "surface": "fabric"})
				_cluster(i, "Barrel_01", 1)
			"hall":
				_corner(i, "Barrel_01")
				_corner(i, "potted_plant_04")
		_collect_free(i)


func _inner(i: int) -> Rect2:
	return (rooms[i]["rect"] as Rect2).grow(-0.2)


func _door_zones(i: int) -> Array[Rect2]:
	var out: Array[Rect2] = []
	for di in rooms[i]["doors"]:
		var d: Dictionary = doors[di]
		var p: Vector2 = d["pos"]
		out.append(Rect2(p - Vector2(1.4, 1.4), Vector2(2.8, 2.8)))
	return out


func _rect_for(id: String, pos: Vector3, yaw: float) -> Rect2:
	var f: Array = FOOT[id]
	var w: float = f[0]
	var d: float = f[1]
	var rot90 := absf(fmod(absf(yaw), 180.0) - 90.0) < 1.0
	var sx := d if rot90 else w
	var sz := w if rot90 else d
	return Rect2(pos.x - sx * 0.5, pos.z - sz * 0.5, sx, sz)


## Places a static blocking prop if it fits inside the room, clear of doors and other props,
## and every door of the room is still reachable. Returns the prop entry or {}.
func _try_place(i: int, id: String, pos: Vector3, yaw: float, opts: Dictionary) -> Dictionary:
	var r := _rect_for(id, pos, yaw)
	var inner := _inner(i)
	if not inner.encloses(r):
		return {}
	for z in _door_zones(i):
		if z.intersects(r):
			return {}
	for p in _placed[i]:
		if (p as Rect2).grow(0.3).intersects(r):
			return {}
	_placed[i].append(r)
	if not _room_connected(i):
		_placed[i].pop_back()
		return {}
	var f: Array = FOOT[id]
	var o := opts.duplicate()
	o["scale"] = f[3]
	if not o.has("surface"):
		o["surface"] = "metal" if id in ["steel_frame_shelves_01", "Barrel_01", "metal_office_desk", "Television_01"] else ("fabric" if id in ["Sofa_01", "potted_plant_04"] else "wood")
	var e := {"id": id, "pos": pos, "yaw": yaw, "opts": o}
	props.append(e)
	return e


func _along_wall(i: int, id: String, dyn := false) -> Dictionary:
	var inner := _inner(i)
	var f: Array = FOOT[id]
	for attempt in 14:
		var side := rng.randi() % 4
		var yaw: float = [0.0, 180.0, 90.0, -90.0][side]
		var along_len: float = f[0]
		var depth: float = f[1]
		var pos := Vector3.ZERO
		match side:
			0: pos = Vector3(rng.randf_range(inner.position.x + along_len * 0.5, inner.end.x - along_len * 0.5), 0, inner.position.y + depth * 0.5 + 0.02)
			1: pos = Vector3(rng.randf_range(inner.position.x + along_len * 0.5, inner.end.x - along_len * 0.5), 0, inner.end.y - depth * 0.5 - 0.02)
			2: pos = Vector3(inner.position.x + depth * 0.5 + 0.02, 0, rng.randf_range(inner.position.y + along_len * 0.5, inner.end.y - along_len * 0.5))
			3: pos = Vector3(inner.end.x - depth * 0.5 - 0.02, 0, rng.randf_range(inner.position.y + along_len * 0.5, inner.end.y - along_len * 0.5))
		if dyn:
			var r := _rect_for(id, pos, yaw)
			var ok := _inner(i).encloses(r)
			for z in _door_zones(i):
				ok = ok and not z.intersects(r)
			if ok:
				props.append({"id": id, "pos": pos, "yaw": yaw + rng.randf_range(-15, 15), "opts": {"dynamic": true, "mass": 4.0, "surface": "fabric"}})
				return props[-1]
			continue
		var e := _try_place(i, id, pos, yaw, {})
		if not e.is_empty():
			return e
	return {}


func _center(i: int, id: String) -> Dictionary:
	var inner := _inner(i)
	var yaw := 0.0 if inner.size.x >= inner.size.y else 90.0
	for attempt in 8:
		var c := inner.get_center() + Vector2(rng.randf_range(-0.6, 0.6), rng.randf_range(-0.5, 0.5))
		var e := _try_place(i, id, Vector3(c.x, 0, c.y), yaw + (180.0 if rng.randf() < 0.5 else 0.0), {})
		if not e.is_empty():
			return e
	return {}


func _corner(i: int, id: String) -> Dictionary:
	var inner := _inner(i)
	var f: Array = FOOT[id]
	var corners := [inner.position, Vector2(inner.end.x, inner.position.y), Vector2(inner.position.x, inner.end.y), inner.end]
	corners.shuffle()
	for c in corners:
		var off := Vector2(f[0] * 0.5 + 0.08, f[1] * 0.5 + 0.08)
		var p := Vector2(c.x + (off.x if c.x < inner.get_center().x else -off.x), c.y + (off.y if c.y < inner.get_center().y else -off.y))
		var e := _try_place(i, id, Vector3(p.x, 0, p.y), rng.randf_range(0, 360) if id == "Barrel_01" else 0.0, {})
		if not e.is_empty():
			return e
	return {}


func _cluster(i: int, id: String, count: int) -> void:
	var inner := _inner(i)
	var anchor := Vector2(rng.randf_range(inner.position.x + 1.0, inner.end.x - 1.0), rng.randf_range(inner.position.y + 1.0, inner.end.y - 1.0))
	var placed := 0
	for attempt in count * 6:
		if placed >= count:
			break
		var p := anchor + Vector2(rng.randf_range(-1.2, 1.2), rng.randf_range(-1.0, 1.0))
		var yaw: float = [0.0, 90.0][rng.randi() % 2]
		if not _try_place(i, id, Vector3(p.x, 0, p.y), yaw, {}).is_empty():
			placed += 1


func _scatter_dyn(i: int, id: String, count: int, opts: Dictionary) -> void:
	var inner := _inner(i).grow(-0.5)
	for k in count:
		for attempt in 6:
			var p := Vector2(rng.randf_range(inner.position.x, inner.end.x), rng.randf_range(inner.position.y, inner.end.y))
			var r := Rect2(p - Vector2(0.35, 0.35), Vector2(0.7, 0.7))
			var ok := true
			for z in _door_zones(i):
				ok = ok and not z.intersects(r)
			for q in _placed[i]:
				ok = ok and not (q as Rect2).intersects(r)
			if ok:
				props.append({"id": id, "pos": Vector3(p.x, 0, p.y), "yaw": rng.randf_range(0, 360), "opts": opts})
				break


## Flood fill over the room on a 0.25 m grid (props inflated by a body radius):
## every door of the room must be reachable from the first one.
func _room_connected(i: int) -> bool:
	var r: Rect2 = rooms[i]["rect"]
	var cell := 0.25
	var nx := int(ceil(r.size.x / cell))
	var nz := int(ceil(r.size.y / cell))
	var solid := PackedByteArray()
	solid.resize(nx * nz)
	for z in nz:
		for x in nx:
			var p := r.position + Vector2((x + 0.5) * cell, (z + 0.5) * cell)
			var s := 0
			if p.x < r.position.x + 0.45 or p.x > r.end.x - 0.45 or p.y < r.position.y + 0.45 or p.y > r.end.y - 0.45:
				s = 1
			for q in _placed[i]:
				if (q as Rect2).grow(0.38).has_point(p):
					s = 1
					break
			solid[z * nx + x] = s
	var targets: Array[Vector2i] = []
	for di in rooms[i]["doors"]:
		var dp: Vector2 = doors[di]["pos"]
		var inside := dp.lerp(r.get_center(), clampf(0.7 / dp.distance_to(r.get_center()), 0.0, 1.0))
		var c := Vector2i(clampi(int((inside.x - r.position.x) / cell), 0, nx - 1), clampi(int((inside.y - r.position.y) / cell), 0, nz - 1))
		targets.append(c)
	targets.append(Vector2i(nx / 2, nz / 2))
	var start := targets[0]
	if solid[start.y * nx + start.x] == 1:
		return false
	var seen := PackedByteArray()
	seen.resize(nx * nz)
	var q: Array[Vector2i] = [start]
	seen[start.y * nx + start.x] = 1
	var h := 0
	while h < q.size():
		var c := q[h]
		h += 1
		for dd in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var nn: Vector2i = c + dd
			if nn.x < 0 or nn.y < 0 or nn.x >= nx or nn.y >= nz:
				continue
			var k := nn.y * nx + nn.x
			if seen[k] == 0 and solid[k] == 0:
				seen[k] = 1
				q.append(nn)
	for t in targets:
		if seen[t.y * nx + t.x] == 0:
			return false
	return true


func _collect_free(i: int) -> void:
	var inner := _inner(i).grow(-0.5)
	for k in 30:
		var p := Vector2(rng.randf_range(inner.position.x, inner.end.x), rng.randf_range(inner.position.y, inner.end.y))
		var ok := true
		for q in _placed[i]:
			if (q as Rect2).grow(0.5).has_point(p):
				ok = false
				break
		if ok:
			free_spots[i].append(Vector3(p.x, 0, p.y))
		if free_spots[i].size() >= 6:
			break
	if free_spots[i].is_empty():
		var c: Vector2 = rooms[i]["center"]
		free_spots[i].append(Vector3(c.x, 0, c.y))


func _lights() -> void:
	for i in rooms.size():
		var r: Rect2 = rooms[i]["rect"]
		var t: String = rooms[i]["type"]
		var warm := Color(1.0, 0.8, 0.56)
		var cool := Color(0.75, 0.85, 1.0)
		var col := cool if t in ["storage", "armory", "hall"] else warm
		var c := r.get_center()
		lights.append({"pos": Vector3(c.x, 2.62, c.y), "energy": 1.6 + r.get_area() * 0.02, "range": maxf(r.size.x, r.size.y) * 0.75 + 1.0,
			"color": col, "flicker": rng.randf() < 0.18})


## Simple description for the menu's map preview.
func preview() -> Dictionary:
	var rs := []
	for r in rooms:
		rs.append(r["rect"])
	return {"bounds": bounds, "rooms": rs, "walls": walls, "doors": doors, "far": far_room, "entrance": entrance_room}
