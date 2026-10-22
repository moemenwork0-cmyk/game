class_name Murjan
extends Node3D
## Murjan, the survivors' galleon (Poly Haven dutch_ship_large_01, CC0). Rides the FFT
## sea: heave, pitch and roll come from the real wave heights under bow, stern and
## both sides, smoothed like a heavy hull. Sails whip in the wind, deck lanterns sway.

const MODEL := "res://assets/env/models/dutch_ship_large_01.glb"

var ocean: OceanFFT
## metres the hull sits below the local water line
var draft := 3.2
## smoothing of the hull response (higher = heavier, slower ship)
var inertia := 1.6
var length := 30.0
var beam := 8.0
var heading := 0.0
var speed := 3.0
var deck_y := 0.0           # deck height above the hull origin (measured from the model)
var model: Node3D
var _pos := Vector3.ZERO
var _h := 0.0
var _pitch := 0.0
var _roll := 0.0
var lanterns: Array[OmniLight3D] = []


func _ready() -> void:
	model = (load(MODEL) as PackedScene).instantiate()
	add_child(model)
	var aabb := _bounds(model)
	# hull runs along X in the scan; centre it, bow towards -Z of this node
	model.rotation.y = PI * 0.5
	model.position = Vector3(-(aabb.position.z + aabb.size.z * 0.5), -aabb.position.y, (aabb.position.x + aabb.size.x * 0.5))
	length = aabb.size.x
	beam = aabb.size.z
	var hull := AABB()
	for mi in model.find_children("*hull*", "MeshInstance3D", true, false):
		hull = (mi as MeshInstance3D).transform * (mi as MeshInstance3D).mesh.get_aabb()
	deck_y = (hull.size.y if hull.size.y > 0.0 else 12.0) * 0.46
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.name.contains("sails"):
			_sail_material(m)
	for p in [Vector3(0, deck_y + 2.2, length * 0.42), Vector3(1.8, deck_y + 2.0, -length * 0.05), Vector3(-1.8, deck_y + 2.6, length * 0.3)]:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.62, 0.3)
		l.light_energy = 2.2
		l.omni_range = 9.0
		l.shadow_enabled = true
		l.position = p
		add_child(l)
		lanterns.append(l)
	_pos = position


func place(at: Vector3, yaw: float) -> void:
	_pos = at
	heading = yaw
	position = at


func _bounds(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var b: AABB = m.transform * m.mesh.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out


func _sail_material(m: MeshInstance3D) -> void:
	for i in m.mesh.get_surface_count():
		var src := m.mesh.surface_get_material(i) as StandardMaterial3D
		if src == null:
			continue
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://shaders/sail.gdshader")
		sm.set_shader_parameter("albedo_tex", src.albedo_texture)
		if src.normal_texture:
			sm.set_shader_parameter("normal_tex", src.normal_texture)
		m.set_surface_override_material(i, sm)


func _physics_process(delta: float) -> void:
	if ocean == null:
		return
	var fwd := Vector3(sin(heading), 0, -cos(heading))
	var side := Vector3(fwd.z, 0, -fwd.x)
	_pos += fwd * speed * delta
	var bow := ocean.get_height(_pos.x + fwd.x * length * 0.4, _pos.z + fwd.z * length * 0.4)
	var stern := ocean.get_height(_pos.x - fwd.x * length * 0.4, _pos.z - fwd.z * length * 0.4)
	var port := ocean.get_height(_pos.x - side.x * beam * 0.6, _pos.z - side.z * beam * 0.6)
	var star := ocean.get_height(_pos.x + side.x * beam * 0.6, _pos.z + side.z * beam * 0.6)
	var mid := ocean.get_height(_pos.x, _pos.z)
	var k := 1.0 - exp(-delta * 3.0 / inertia)
	_h = lerpf(_h, (bow + stern + port + star + mid * 2.0) / 6.0, k)
	_pitch = lerpf(_pitch, atan2(bow - stern, length * 0.8), k)
	_roll = lerpf(_roll, atan2(star - port, beam * 1.2) * 1.3, k)
	position = Vector3(_pos.x, _h - draft, _pos.z)
	basis = Basis(Vector3.UP, -heading) * Basis(Vector3.RIGHT, _pitch) * Basis(Vector3.FORWARD, _roll)
	var t := Time.get_ticks_msec() * 0.001
	for i in lanterns.size():
		lanterns[i].light_energy = 2.0 + 0.5 * sin(t * 7.0 + i * 2.1) + 0.3 * sin(t * 13.0 + i)


## A point on the deck in world space (x across, z along the ship; + = towards stern).
func deck_point(x: float, z: float, up := 0.0) -> Vector3:
	return to_global(Vector3(x, deck_y + up, z))
