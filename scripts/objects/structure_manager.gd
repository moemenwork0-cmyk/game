class_name StructureManager
extends Node3D
## Tracks placed pieces and their connectivity. Support flows from pieces
## touching the ground; each link loses some support (more for cantilevers).

var pieces: Array[StructurePiece] = []


func _space() -> PhysicsDirectSpaceState3D:
	return get_world_3d().direct_space_state


func _overlaps(size: Vector3, xf: Transform3D, grow: float, mask: int, exclude: Array[RID] = []) -> Array[Dictionary]:
	var q := PhysicsShapeQueryParameters3D.new()
	var bs := BoxShape3D.new()
	bs.size = (size + Vector3.ONE * grow * 2.0).max(Vector3.ONE * 0.02)
	q.shape = bs
	q.transform = xf
	q.collision_mask = mask
	q.exclude = exclude
	return _space().intersect_shape(q, 32)


func can_place(kind: String, xf: Transform3D) -> bool:
	var size: Vector3 = StructurePiece.DEFS[kind]["size"]
	return _overlaps(size, xf, -0.04, Game.L_STRUCT | Game.L_PROPS | Game.L_PLAYER | Game.L_TREES).is_empty()


## Estimated support a new piece would receive at xf.
func estimate_support(kind: String, xf: Transform3D) -> float:
	var def: Dictionary = StructurePiece.DEFS[kind]
	var size: Vector3 = def["size"]
	if not _overlaps(size, xf, 0.06, Game.L_TERRAIN).is_empty():
		return 1.0
	var best := 0.0
	for hit in _overlaps(size, xf, 0.06, Game.L_STRUCT):
		var other = hit["collider"]
		if other is StructurePiece and not other.loose:
			best = maxf(best, other.support - _loss(other.global_position, xf.origin, def))
	return best


func place(kind: String, xf: Transform3D) -> StructurePiece:
	var p := StructurePiece.create(kind)
	add_child(p)
	p.global_transform = xf
	var size := p.size
	p.grounded = not _overlaps(size, xf, 0.06, Game.L_TERRAIN).is_empty()
	for hit in _overlaps(size, xf, 0.06, Game.L_STRUCT, [p.get_rid()]):
		var other = hit["collider"]
		if other is StructurePiece and not other.loose and other != p:
			p.neighbors[other] = true
			other.neighbors[p] = true
	pieces.append(p)
	recompute()
	return p


func remove(p: StructurePiece) -> void:
	for n in p.neighbors.keys():
		if is_instance_valid(n):
			n.neighbors.erase(p)
	p.neighbors.clear()
	pieces.erase(p)
	recompute()


func on_terrain_edited(center: Vector3, radius: float) -> void:
	var touched := false
	for p in pieces:
		if p.global_position.distance_to(center) < radius + 3.0:
			p.grounded = not _overlaps(p.size, p.global_transform, 0.06, Game.L_TERRAIN).is_empty()
			touched = true
	if touched:
		recompute()


func _loss(from_pos: Vector3, to_pos: Vector3, def: Dictionary) -> float:
	var dy := to_pos.y - from_pos.y
	return float(def["vloss"]) if dy > 0.15 else float(def["hloss"])


func recompute() -> void:
	for p in pieces:
		p.support = 1.0 if p.grounded else -1.0
	var changed := true
	var guard := 0
	while changed and guard < 64:
		changed = false
		guard += 1
		for p in pieces:
			if p.support <= 0.0:
				continue
			for n in p.neighbors.keys():
				if not is_instance_valid(n):
					continue
				var q: StructurePiece = n
				var cand := p.support - _loss(p.global_position, q.global_position, StructurePiece.DEFS[q.kind])
				if cand > q.support + 0.0001:
					q.support = cand
					changed = true
	var falling: Array[StructurePiece] = []
	for p in pieces:
		if p.support <= 0.0:
			falling.append(p)
	for p in falling:
		pieces.erase(p)
		for n in p.neighbors.keys():
			if is_instance_valid(n):
				n.neighbors.erase(p)
		p.make_loose()
		# reparent loose debris to the props node so it can be picked up like any item
		p.reparent(Game.props)
	if not falling.is_empty() and Game.sfx:
		Game.sfx.play("tree_fall", falling[0].global_position, -6.0, 0.3)
