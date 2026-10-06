class_name SaveGame
extends RefCounted
## Whole-world save/load: terrain edits, trees, loose items, buildings, campfires,
## inventory, player and time of day. One compressed file per slot.

const VERSION := 1
const DIR := "user://saves"


static func path(slot: int = 1) -> String:
	return "%s/slot%d.sav" % [DIR, slot]


static func exists(slot: int = 1) -> bool:
	return FileAccess.file_exists(path(slot))


## "Saved 2026-10-06 21:14 · day 3"
static func describe(slot: int = 1) -> String:
	if not exists(slot):
		return ""
	var t := FileAccess.get_modified_time(path(slot))
	return "Last saved " + Time.get_datetime_string_from_unix_time(t + int(Time.get_time_zone_from_system()["bias"]) * 60, true).substr(0, 16)


static func capture() -> Dictionary:
	var world := Game.world
	var p := Game.player
	var data := {
		"version": VERSION,
		"seed": world.seed_value,
		"time_hours": Game.day_night.time_hours,
		"day": Game.day_number,
		"inventory": Game.inventory.duplicate(),
		"player": {"pos": p.global_position, "yaw": p.yaw, "pitch": p.pitch, "stamina": p.stamina},
		"density": density_bytes(world.density),
		"materials": world.materials.compress(FileAccess.COMPRESSION_ZSTD),
		"trees": [],
		"items": [],
		"structures": [],
		"campfires": [],
	}
	for t in Game.get_tree().get_nodes_in_group("island_trees"):
		var tree: IslandTree = t
		data["trees"].append({"kind": tree.kind, "seed": tree.seed_value, "xf": tree.global_transform, "felled": tree.felled})
	for c in Game.props.get_children():
		if c is PhysicsItem and not c.save_info.is_empty() and not c.is_queued_for_deletion():
			var it: PhysicsItem = c
			var e := it.save_info.duplicate()
			e["xf"] = it.global_transform
			e["lv"] = it.linear_velocity
			e["av"] = it.angular_velocity
			e["amount"] = it.amount
			e["sleeping"] = it.sleeping
			data["items"].append(e)
		elif c is Campfire:
			data["campfires"].append(c.global_position)
	for piece in Game.structures.pieces:
		data["structures"].append({"kind": piece.kind, "xf": piece.global_transform})
	return data


static func density_bytes(d: PackedFloat32Array) -> PackedByteArray:
	return d.to_byte_array().compress(FileAccess.COMPRESSION_ZSTD)


static func write(data: Dictionary, slot: int = 1) -> bool:
	DirAccess.make_dir_recursive_absolute(DIR)
	# write to a temp file first so a crash mid-save never corrupts the old save
	var tmp := path(slot) + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		push_error("save failed: %s" % FileAccess.get_open_error())
		return false
	f.store_var(data)
	f.close()
	DirAccess.rename_absolute(tmp, path(slot))
	return true


static func read(slot: int = 1) -> Dictionary:
	if not exists(slot):
		return {}
	var f := FileAccess.open(path(slot), FileAccess.READ)
	if f == null:
		return {}
	var v: Variant = f.get_var()
	f.close()
	if typeof(v) != TYPE_DICTIONARY or int(v.get("version", 0)) != VERSION:
		return {}
	return v


static func save_now(slot: int = 1) -> bool:
	if Game.player == null:
		return false
	var ok := write(capture(), slot)
	if ok:
		Game.toast.emit("Game saved")
	return ok


## Decompressed terrain arrays for VoxelWorld.generate().
static func terrain_override(data: Dictionary) -> Dictionary:
	var n := VoxelWorld.SX * VoxelWorld.SY * VoxelWorld.SZ
	var d: PackedByteArray = data["density"]
	var m: PackedByteArray = data["materials"]
	return {
		"density": d.decompress(n * 4, FileAccess.COMPRESSION_ZSTD).to_float32_array(),
		"materials": m.decompress(n, FileAccess.COMPRESSION_ZSTD),
	}


## Spawns everything except terrain (already restored during generation).
static func restore_objects(data: Dictionary, parent: Node) -> void:
	var rng := RandomNumberGenerator.new()
	for e in data["trees"]:
		var t := IslandTree.new()
		parent.add_child(t)
		t.global_transform = e["xf"]
		t.setup(e["kind"], int(e["seed"]))
		if e["felled"]:
			t.make_stump_only()
	for e in data["items"]:
		var xf: Transform3D = e["xf"]
		var it: PhysicsItem = null
		match String(e["type"]):
			"log":
				it = PhysicsItem.make_log(xf.origin, xf.basis, e["radius"], e["length"])
			"stone":
				it = PhysicsItem.make_stone(xf.origin, e["size"], rng, int(e["seed"]))
			"boulder":
				it = Boulder.create(xf.origin, e["size"], rng, int(e["seed"]))
			"piece":
				var piece := StructurePiece.create(e["kind"])
				Game.props.add_child(piece)
				piece.make_loose()
				it = piece
		if it == null:
			continue
		it.global_transform = xf
		it.amount = int(e.get("amount", it.amount))
		it.linear_velocity = e.get("lv", Vector3.ZERO)
		it.angular_velocity = e.get("av", Vector3.ZERO)
		if e.get("sleeping", false):
			it.sleeping = true
	for pos in data["campfires"]:
		Campfire.create(pos)
	Game.inventory = data["inventory"].duplicate()
	Game.day_number = int(data.get("day", 1))
	Game.inventory_changed.emit()
