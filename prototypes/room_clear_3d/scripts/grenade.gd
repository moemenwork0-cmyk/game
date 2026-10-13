class_name Grenade
extends RigidBody3D
## Frag grenade: thrown on a ballistic arc, bounces, explodes after its fuse. Damage falls off
## with distance and is blocked by walls; the blast throws props and ragdolls around.

signal exploded(pos: Vector3)

const RADIUS := 5.0
const DAMAGE := 160.0

var thrower: Soldier
var fuse := 1.7
var _bounced := false

static var _mat: StandardMaterial3D


static func spawn(by: Soldier, from: Vector3, at: Vector3) -> Grenade:
	var g := Grenade.new()
	g.thrower = by
	Fx.world.add_child(g)
	g.global_position = from
	# ballistic velocity reaching `at` with a fixed flight time
	var flat := Vector3(at.x - from.x, 0, at.z - from.z)
	var dist := clampf(flat.length(), 1.0, 13.0)
	var t := clampf(dist / 11.0, 0.35, 0.95)
	var vy := (at.y + 0.1 - from.y + 4.9 * t * t) / t
	g.linear_velocity = flat.normalized() * dist / t + Vector3(0, vy, 0)
	g.angular_velocity = Vector3(randf_range(-12, 12), randf_range(-8, 8), randf_range(-12, 12))
	Fx.grenade_thrown(g)
	return g


func _ready() -> void:
	add_to_group("grenades")
	mass = 0.45
	collision_layer = 4
	collision_mask = 1 | 4 | 16
	continuous_cd = true
	var pm := PhysicsMaterial.new()
	pm.bounce = 0.35
	pm.friction = 0.8
	physics_material_override = pm
	linear_damp = 0.15
	angular_damp = 1.2
	var cs := CollisionShape3D.new()
	var sh := SphereShape3D.new()
	sh.radius = 0.055
	cs.shape = sh
	add_child(cs)
	if _mat == null:
		_mat = StandardMaterial3D.new()
		_mat.albedo_color = Color(0.2, 0.25, 0.14)
		_mat.roughness = 0.55
		_mat.metallic = 0.3
	var body := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.055
	sm.height = 0.13
	sm.radial_segments = 12
	sm.rings = 6
	body.mesh = sm
	body.material_override = _mat
	add_child(body)
	var top := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.02
	cm.bottom_radius = 0.025
	cm.height = 0.04
	top.mesh = cm
	top.position.y = 0.07
	top.material_override = _mat
	add_child(top)
	# blinking fuse light so it reads on screen
	var blink := OmniLight3D.new()
	blink.light_color = Color(1, 0.2, 0.1)
	blink.omni_range = 1.2
	blink.light_energy = 1.5
	blink.name = "Blink"
	add_child(blink)
	contact_monitor = true
	max_contacts_reported = 2
	body_entered.connect(func(_b: Node) -> void:
		if linear_velocity.length() > 1.2:
			Sfx.play_at("grenade_bounce", global_position, -6.0, randf_range(0.9, 1.15))
		_bounced = true)


func _physics_process(delta: float) -> void:
	fuse -= delta
	var b := get_node_or_null("Blink") as OmniLight3D
	if b:
		b.visible = fmod(fuse, 0.3 if fuse > 0.6 else 0.12) < 0.06
	if fuse <= 0.0:
		_explode()


func _explode() -> void:
	var pos := global_position + Vector3(0, 0.15, 0)
	var space := get_world_3d().direct_space_state
	for n in get_tree().get_nodes_in_group("soldiers"):
		var s := n as Soldier
		if not s.alive:
			continue
		var c := s.chest_pos()
		var d := c.distance_to(pos)
		if d > RADIUS:
			continue
		var q := PhysicsRayQueryParameters3D.create(pos, c, 1, [get_rid()])
		if not space.intersect_ray(q).is_empty():
			continue
		var k := 1.0 - d / RADIUS
		s.take_hit(DAMAGE * k * k + 15.0 * k, (c - pos).normalized(), c, thrower, false, 6.0 * k)
	# throw everything loose around
	for n in get_tree().get_nodes_in_group("physics_props"):
		var rb := n as RigidBody3D
		if rb == null or not is_instance_valid(rb):
			continue
		var d := rb.global_position.distance_to(pos)
		if d < RADIUS * 1.2:
			var dir := (rb.global_position - pos + Vector3(0, 0.4, 0)).normalized()
			rb.apply_impulse(dir * (1.0 - d / (RADIUS * 1.2)) * 14.0 * clampf(rb.mass, 0.5, 6.0))
	for n in get_tree().get_nodes_in_group("ragdoll_bones"):
		var pb := n as PhysicalBone3D
		if pb and is_instance_valid(pb):
			var d := pb.global_position.distance_to(pos)
			if d < RADIUS:
				pb.apply_central_impulse((pb.global_position - pos + Vector3(0, 0.6, 0)).normalized() * (1.0 - d / RADIUS) * 25.0)
	Fx.explosion(pos)
	exploded.emit(pos)
	queue_free()
