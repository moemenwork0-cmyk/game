class_name StoryCrate
extends StaticBody3D
## A crate from the Murjan. E to open: items, and sometimes a page of the story.

var contents := {}
var story_key := ""     # e.g. "wreck" for the main find
var opened := false
var _lid: MeshInstance3D


static func create(pos: Vector3, items: Dictionary, key: String = "") -> StoryCrate:
	var c := StoryCrate.new()
	c.contents = items
	c.story_key = key
	Game.props.add_child(c)
	c.global_position = pos
	c.rotation.y = randf() * TAU
	return c


func _ready() -> void:
	add_to_group("story_crates")
	collision_layer = Game.L_STRUCT
	collision_mask = 0
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.0, 0.7, 0.7)
	body.mesh = bm
	body.material_override = Mats.get_mat("wood")
	body.position.y = 0.35
	add_child(body)
	_lid = MeshInstance3D.new()
	var lm := BoxMesh.new()
	lm.size = Vector3(1.04, 0.08, 0.74)
	_lid.mesh = lm
	_lid.material_override = Mats.get_mat("wood")
	_lid.position.y = 0.74
	add_child(_lid)
	for x in [-0.45, 0.45]:
		var band := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3(0.06, 0.72, 0.72)
		band.mesh = b
		band.material_override = Mats.get_mat("metal")
		band.position = Vector3(x, 0.36, 0)
		add_child(band)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(1.0, 0.78, 0.7)
	cs.shape = bs
	cs.position.y = 0.39
	add_child(cs)
	if opened:
		_show_open()


func open() -> void:
	if opened:
		return
	opened = true
	_show_open()
	Game.sfx.play("break", global_position, -6.0)
	for id in contents:
		Game.add_item(id, int(contents[id]))
	if Game.story:
		Game.story.on_crate_opened(self)


func _show_open() -> void:
	if _lid:
		_lid.position = Vector3(0.0, 0.62, -0.5)
		_lid.rotation.x = -1.2
