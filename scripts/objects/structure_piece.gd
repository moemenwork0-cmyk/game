class_name StructurePiece
extends PhysicsItem
## A placed building piece. Frozen while supported; falls as a real rigid body
## when it loses support (structural integrity propagates from the ground).

const DEFS := {
	"plank": {"name": "Beam", "size": Vector3(2.4, 0.12, 0.3), "mat": "wood", "cost": {"plank": 1}, "density": 550.0, "vloss": 0.1, "hloss": 0.2},
	"post": {"name": "Post", "size": Vector3(0.24, 2.4, 0.24), "mat": "wood", "cost": {"plank": 1}, "density": 550.0, "vloss": 0.08, "hloss": 0.25},
	"panel": {"name": "Panel", "size": Vector3(1.2, 0.08, 1.2), "mat": "wood", "cost": {"plank": 2}, "density": 550.0, "vloss": 0.1, "hloss": 0.2},
	"stone": {"name": "Stone block", "size": Vector3(0.8, 0.4, 0.4), "mat": "rock", "cost": {"stone": 2}, "density": 2400.0, "vloss": 0.03, "hloss": 0.5},
}

var kind := "plank"
var size := Vector3.ONE
var support := 1.0
var grounded := false
var loose := false
var neighbors := {}
var hp := 3


static func create(p_kind: String) -> StructurePiece:
	var p := StructurePiece.new()
	p.kind = p_kind
	var def: Dictionary = DEFS[p_kind]
	p.size = def["size"]
	p.display_name = def["name"]
	var cost: Dictionary = def["cost"]
	p.item_id = cost.keys()[0]
	p.amount = int(cost.values()[0])
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = p.size
	mi.mesh = bm
	mi.material_override = Mats.get_mat(def["mat"])
	p.add_child(mi)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = p.size
	cs.shape = bs
	p.add_child(cs)
	p.volume = p.size.x * p.size.y * p.size.z
	p.mass = p.volume * float(def["density"])
	var h := p.size * 0.4
	for sx in [-1, 1]:
		for sy in [-1, 1]:
			for sz in [-1, 1]:
				p.float_points.append(Vector3(h.x * sx, h.y * sy, h.z * sz))
	p.freeze_mode = RigidBody3D.FREEZE_MODE_STATIC
	p.freeze = true
	return p


func _ready() -> void:
	super._ready()
	if not loose:
		collision_layer = Game.L_STRUCT


func is_wood() -> bool:
	return DEFS[kind]["mat"] == "wood"


func make_loose() -> void:
	if loose:
		return
	loose = true
	neighbors.clear()
	collision_layer = Game.L_PROPS
	freeze = false
	sleeping = false


func damage(point: Vector3, n: int) -> void:
	hp -= n
	var c := Color(0.6, 0.45, 0.28) if is_wood() else Color(0.5, 0.5, 0.48)
	Fx.burst(point, c, 10, 2.5, 0.05, 1.0)
	Game.sfx.play("wood" if is_wood() else "rock", point)
	if hp <= 0:
		Game.add_item(item_id, amount)
		Game.sfx.play("break", point, -3.0)
		Fx.burst(global_position, c, 30, 3.0, 0.07, 1.4)
		Game.structures.remove(self)
		queue_free()
