class_name Gull
extends Node3D
## A seagull built from simple shapes. Mode "injured": lying on the beach,
## waiting for your choice. Mode "friend": circles above you, cries now and then.

var mode := "injured"
var _wings: Array[Node3D] = []
var _t := 0.0
var _cry_t := 8.0
var _body: StaticBody3D


static func create(parent: Node, pos: Vector3, p_mode: String) -> Gull:
	var g := Gull.new()
	g.mode = p_mode
	parent.add_child(g)
	g.global_position = pos
	return g


func _ready() -> void:
	add_to_group("gulls")
	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.92, 0.92, 0.9)
	white.roughness = 0.8
	var grey := StandardMaterial3D.new()
	grey.albedo_color = Color(0.55, 0.58, 0.62)
	grey.roughness = 0.8
	var beak := StandardMaterial3D.new()
	beak.albedo_color = Color(0.95, 0.65, 0.1)
	_part(SphereMesh.new(), white, Vector3.ZERO, Vector3(0.13, 0.11, 0.28))
	_part(SphereMesh.new(), white, Vector3(0, 0.07, -0.2), Vector3(0.09, 0.09, 0.1))
	var bk := CylinderMesh.new()
	bk.top_radius = 0.0
	bk.bottom_radius = 0.018
	bk.height = 0.09
	_part(bk, beak, Vector3(0, 0.06, -0.3), Vector3.ONE, Vector3(-PI / 2, 0, 0))
	_part(SphereMesh.new(), grey, Vector3(0, 0.02, 0.25), Vector3(0.06, 0.03, 0.14))
	for side in [-1.0, 1.0]:
		var pivot := Node3D.new()
		pivot.position = Vector3(side * 0.08, 0.05, 0.0)
		add_child(pivot)
		var w := MeshInstance3D.new()
		var wm := BoxMesh.new()
		wm.size = Vector3(0.6, 0.015, 0.2)
		w.mesh = wm
		w.material_override = grey
		w.position = Vector3(side * 0.3, 0, 0.02)
		pivot.add_child(w)
		_wings.append(pivot)
	if mode == "injured":
		_wings[0].rotation.z = 0.2
		_wings[1].rotation.z = -1.1   # the broken wing
		_body = StaticBody3D.new()
		_body.collision_layer = Game.L_STRUCT
		var cs := CollisionShape3D.new()
		var sp := SphereShape3D.new()
		sp.radius = 0.35
		cs.shape = sp
		_body.add_child(cs)
		add_child(_body)
		_body.set_meta("gull", self)


func _part(mesh: PrimitiveMesh, mat: Material, pos: Vector3, scl: Vector3, rot: Vector3 = Vector3.ZERO) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.scale = scl
	mi.rotation = rot
	add_child(mi)


func _process(delta: float) -> void:
	_t += delta
	if mode == "injured":
		_wings[0].rotation.z = 0.2 + sin(_t * 0.8) * 0.05
		return
	var p := Game.player
	if p == null:
		return
	# circle over the player
	var center := p.global_position + Vector3(0, 9.0, 0)
	var target := center + Vector3(cos(_t * 0.35) * 7.0, sin(_t * 0.7) * 1.0, sin(_t * 0.35) * 7.0)
	var prev := global_position
	global_position = global_position.lerp(target, 1.0 - exp(-0.8 * delta))
	var vel := global_position - prev
	if vel.length() > 0.0005:
		look_at(global_position + vel, Vector3.UP)
	var flap := sin(_t * 9.0) * 0.6 if fmod(_t, 4.0) < 1.2 else 0.12
	_wings[0].rotation.z = flap
	_wings[1].rotation.z = -flap
	_cry_t -= delta
	if _cry_t <= 0.0:
		_cry_t = randf_range(15.0, 35.0)
		Game.sfx.play("gull", global_position, -6.0)
