class_name PhysicsItem
extends RigidBody3D
## Any loose physical object: logs, stones, planks. Real mass, real buoyancy.

const WATER_DENSITY := 1000.0

var item_id := "log"
var amount := 1
var volume := 0.05
var float_points: Array[Vector3] = []
var display_name := "Log"
var _was_in_water := false


func _ready() -> void:
	collision_layer = Game.L_PROPS
	collision_mask = Game.L_TERRAIN | Game.L_PROPS | Game.L_STRUCT | Game.L_PLAYER | Game.L_TREES
	if physics_material_override == null:
		var pm := PhysicsMaterial.new()
		pm.friction = 0.8
		pm.bounce = 0.05
		physics_material_override = pm
	linear_damp_mode = RigidBody3D.DAMP_MODE_COMBINE
	angular_damp_mode = RigidBody3D.DAMP_MODE_COMBINE


func _physics_process(_delta: float) -> void:
	if global_position.y < -40.0:
		queue_free()
		return
	if freeze or sleeping or Game.ocean == null or float_points.is_empty():
		return
	if global_position.y > 3.0:
		if _was_in_water:
			_was_in_water = false
			linear_damp = 0.0
			angular_damp = 0.0
		return
	var per := volume / float_points.size()
	var r := pow(per, 1.0 / 3.0) * 0.62
	var sub_total := 0.0
	var xf := global_transform
	for lp in float_points:
		var p := xf * lp
		var wh := Game.water_height(p.x, p.z)
		var sub := clampf((wh - p.y) / (2.0 * r) + 0.5, 0.0, 1.0)
		if sub > 0.0:
			apply_force(Vector3.UP * WATER_DENSITY * 9.81 * per * sub, p - xf.origin)
			sub_total += sub
	var frac := sub_total / float_points.size()
	linear_damp = frac * 1.6
	angular_damp = frac * 1.4
	var in_water := frac > 0.05
	if in_water and not _was_in_water and linear_velocity.length() > 2.5:
		Fx.splash(global_position, clampf(linear_velocity.length() / 8.0, 0.3, 1.5))
		if Game.sfx:
			Game.sfx.play("splash", global_position, -4.0)
	_was_in_water = in_water


func collect() -> void:
	Game.add_item(item_id, amount)
	if Game.sfx:
		Game.sfx.play("pickup")
	queue_free()


# ------------------------------------------------------------ factories

static func make_log(pos: Vector3, basis: Basis, radius: float, length: float) -> PhysicsItem:
	var it := PhysicsItem.new()
	it.item_id = "log"
	it.display_name = "Log"
	it.volume = PI * radius * radius * length
	it.mass = it.volume * 600.0
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius
	cm.bottom_radius = radius * 1.04
	cm.height = length
	cm.radial_segments = 14
	cm.rings = 1
	cm.material = Mats.get_mat("bark")
	mi.mesh = cm
	it.add_child(mi)
	for s in [-1.0, 1.0]:
		var cap := MeshInstance3D.new()
		var cc := CylinderMesh.new()
		cc.top_radius = radius * 0.97
		cc.bottom_radius = radius * 0.97
		cc.height = 0.01
		cc.radial_segments = 14
		cc.material = Mats.get_mat("cut_wood")
		cap.mesh = cc
		cap.position = Vector3(0, s * length * 0.5, 0)
		it.add_child(cap)
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = radius
	sh.height = length
	cs.shape = sh
	it.add_child(cs)
	for k in 5:
		var y := lerpf(-0.45, 0.45, k / 4.0) * length
		it.float_points.append(Vector3(0, y, 0))
	Game.props.add_child(it)
	it.global_transform = Transform3D(basis, pos)
	return it


static func make_stone(pos: Vector3, size: float, rng: RandomNumberGenerator) -> PhysicsItem:
	var it := PhysicsItem.new()
	it.item_id = "stone"
	it.display_name = "Stone"
	var mesh := Mats.rock_mesh(size, rng, 0.75)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = Mats.get_mat("rock")
	it.add_child(mi)
	var cs := CollisionShape3D.new()
	cs.shape = mesh.create_convex_shape(true, true)
	it.add_child(cs)
	it.volume = 4.0 / 3.0 * PI * pow(size, 3) * 0.7
	it.mass = maxf(it.volume * 2600.0, 0.5)
	it.float_points.append(Vector3.ZERO)
	it.continuous_cd = true
	Game.props.add_child(it)
	it.global_position = pos
	it.rotation = Vector3(rng.randf() * TAU, rng.randf() * TAU, rng.randf() * TAU)
	return it
