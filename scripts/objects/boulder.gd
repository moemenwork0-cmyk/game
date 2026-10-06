class_name Boulder
extends PhysicsItem
## Heavy rock. Mine it with the pickaxe to break it into stones.

var hp := 6
var size := 1.0


static func create(pos: Vector3, p_size: float, rng: RandomNumberGenerator, fixed_seed: int = -1) -> Boulder:
	var b := Boulder.new()
	var shape_seed := fixed_seed if fixed_seed >= 0 else rng.randi() % 2147483647
	rng = RandomNumberGenerator.new()
	rng.seed = shape_seed
	b.save_info = {"type": "boulder", "size": p_size, "seed": shape_seed}
	b.size = p_size
	b.item_id = "stone"
	b.display_name = "Boulder"
	b.hp = int(3 + p_size * 4)
	var mesh := Mats.rock_mesh(p_size, rng, 0.68)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = Mats.get_mat("rock")
	b.add_child(mi)
	var cs := CollisionShape3D.new()
	cs.shape = mesh.create_convex_shape(true, true)
	b.add_child(cs)
	b.volume = 4.0 / 3.0 * PI * pow(p_size, 3) * 0.68
	b.mass = b.volume * 2600.0
	for v in [Vector3(0.5, 0, 0), Vector3(-0.5, 0, 0), Vector3(0, 0, 0.5), Vector3(0, 0, -0.5)]:
		b.float_points.append(v * p_size)
	b.can_sleep = true
	Game.props.add_child(b)
	b.global_position = pos
	b.rotation.y = rng.randf() * TAU
	return b


func hit(point: Vector3, dir: Vector3) -> void:
	hp -= 1
	Fx.burst(point, Color(0.55, 0.53, 0.5), 14, 3.5, 0.05, 1.0)
	Game.sfx.play("rock", point)
	apply_impulse(dir * 30.0, point - global_position)
	if hp <= 0:
		_shatter()


func _shatter() -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var n := int(clampf(size * 5.0, 3.0, 7.0))
	Game.sfx.play("break", global_position)
	Fx.burst(global_position, Color(0.5, 0.48, 0.45), 40, 4.0, 0.09, 1.5)
	for i in n:
		var off := Vector3(rng.randf_range(-1, 1), rng.randf_range(0, 1), rng.randf_range(-1, 1)) * size * 0.5
		var s := PhysicsItem.make_stone(global_position + off, rng.randf_range(0.14, 0.24) * clampf(size, 0.8, 1.4), rng)
		s.amount = 2
		s.linear_velocity = off.normalized() * rng.randf_range(1.0, 3.0)
	queue_free()
