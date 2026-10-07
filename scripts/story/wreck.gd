class_name Wreck
extends StaticBody3D
## The Murjan, run aground on the reef: bow up, stern under water, listing.
## You can swim out, climb aboard and search her.

const POS := Vector3(29.0, -5.6, -29.0)


static func create(parent: Node) -> Wreck:
	var w := Wreck.new()
	parent.add_child(w)
	return w


func _ready() -> void:
	add_to_group("wreck")
	collision_layer = Game.L_TERRAIN
	collision_mask = 0
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var ship := ShipBuilder.build_ship(rng, true)
	add_child(ship)
	# bow points toward the island, pitched up onto the reef and listing to port
	var to_island := -Vector3(POS.x, 0, POS.z).normalized()
	var yaw := atan2(-to_island.x, -to_island.z)
	global_transform = Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, 0.24) * Basis(Vector3.FORWARD, 0.3), POS)
	ShipBuilder.add_collision(ship, self)


## Where the searchable cargo lies (on the raised fore-deck).
func crate_position() -> Vector3:
	var z := -8.5
	var s := (ShipBuilder.LENGTH * 0.5 - z) / ShipBuilder.LENGTH
	return global_transform * Vector3(0.6, ShipBuilder.DEPTH + s * s * 0.8 + 0.01, z)
