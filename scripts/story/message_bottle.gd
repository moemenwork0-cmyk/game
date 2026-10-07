class_name MessageBottle
extends StaticBody3D
## A bottle with a letter inside, half-buried in the sand. E to read.

var letter := {}


static func create(pos: Vector3, p_letter: Dictionary) -> MessageBottle:
	var b := MessageBottle.new()
	b.letter = p_letter
	Game.props.add_child(b)
	b.global_position = pos
	b.rotation = Vector3(0.0, randf() * TAU, PI * 0.42)
	return b


func _ready() -> void:
	add_to_group("bottles")
	collision_layer = Game.L_STRUCT
	collision_mask = 0
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.35, 0.6, 0.45, 0.55)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.roughness = 0.05
	glass.metallic = 0.1
	var body := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.045
	cm.bottom_radius = 0.045
	cm.height = 0.24
	body.mesh = cm
	body.material_override = glass
	add_child(body)
	var neck := MeshInstance3D.new()
	var nm := CylinderMesh.new()
	nm.top_radius = 0.016
	nm.bottom_radius = 0.04
	nm.height = 0.1
	neck.mesh = nm
	neck.material_override = glass
	neck.position.y = 0.17
	add_child(neck)
	var paper := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.025
	pm.bottom_radius = 0.025
	pm.height = 0.16
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = Color(0.85, 0.8, 0.65)
	pm.material = pmat
	paper.mesh = pm
	add_child(paper)
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 0.2
	cs.shape = sp
	add_child(cs)


func read() -> void:
	Game.sfx.play("pickup", global_position)
	if Game.story:
		Game.story.read_letter(letter)
	queue_free()
