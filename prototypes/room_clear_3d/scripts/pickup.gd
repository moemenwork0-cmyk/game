class_name Pickup
extends Area3D
## Medkit (+40 health) or grenade pickup. Spins and bobs; collected by walking over it.

signal taken(kind: String)

var kind := "medkit"
var _mesh: Node3D
var _t := randf() * 10.0


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = 0.6
	cs.shape = sh
	cs.position.y = 0.5
	add_child(cs)
	_mesh = Node3D.new()
	add_child(_mesh)
	var id := "medical_box" if kind == "medkit" else "ammo_box"
	var inst: Node3D = load("res://assets/props/%s/%s.gltf" % [id, id]).instantiate()
	inst.scale = Vector3.ONE * (1.1 if kind == "medkit" else 2.0)
	_mesh.add_child(inst)
	var l := OmniLight3D.new()
	l.light_color = Color(0.4, 1.0, 0.5) if kind == "medkit" else Color(1.0, 0.75, 0.3)
	l.light_energy = 1.2
	l.omni_range = 1.6
	l.position.y = 0.5
	add_child(l)
	body_entered.connect(_on_body)


func _process(delta: float) -> void:
	_t += delta
	_mesh.position.y = 0.35 + sin(_t * 3.0) * 0.06
	_mesh.rotation.y = _t * 1.4


func _on_body(b: Node) -> void:
	if b is Player and (b as Player).alive:
		var p := b as Player
		if kind == "medkit":
			if p.hp >= p.max_hp:
				return
			p.hp = minf(p.hp + 40.0, p.max_hp)
		else:
			p.grenades = mini(p.grenades + 1, 4)
		Sfx.play("pickup", -2.0)
		Fx.popup_text(global_position + Vector3(0, 1.0, 0), "+40 HP" if kind == "medkit" else "+1 GRENADE", Color(0.5, 1.0, 0.55) if kind == "medkit" else Color(1.0, 0.8, 0.35), 1.0)
		taken.emit(kind)
		queue_free()
