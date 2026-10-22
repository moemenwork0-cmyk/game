extends TrailerShot
## Montage: the first night. Sparks catch, the fire roars up between her hands; her face
## lit orange across the flames, the dark jungle behind.

var fire: TrailerFire
var layla: Actor


func build(tr: Trailer) -> void:
	duration = 2.6
	tr.sky.hour = 21.0
	tr.sky.storm = 0.0
	var at := Vector3(-30, 0, 420)
	await tr.add_island(at, 120.0, 0.8)
	at.y = tr.ground(at.x, at.z)
	fire = TrailerFire.create(1.0)
	tr.add_child(fire)
	fire.global_position = at
	fire.blaze = 0.05
	for i in 5:
		var l := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.05
		cm.bottom_radius = 0.07
		cm.height = 0.8
		var bm := StandardMaterial3D.new()
		bm.albedo_color = Color(0.25, 0.17, 0.1)
		cm.material = bm
		l.mesh = cm
		var a := TAU * i / 5.0
		l.rotation = Vector3(0, a, deg_to_rad(64))
		l.position = Vector3(cos(a) * -0.12, 0.16, sin(a) * 0.12)
		fire.add_child(l)
	layla = Actor.create("layla", {"crouch": "m_crouch_idle"})
	tr.add_child(layla)
	layla.global_position = at + Vector3(0, 0, -0.95)
	layla.rotation.y = PI  # facing the fire (+Z)
	layla.when_ready(func() -> void:
		layla.play("crouch", 0.0, 0.8)
		layla.feel({"fear": 0.3, "sad": 0.3}, 0.1)
		layla.look_at_point(at + Vector3(0, 0.3, 0)))
	keys = [
		[0.0, at + Vector3(0.6, 0.45, 2.4), at + Vector3(0, 0.75, -0.9), 30.0, 2.6],
		[2.6, at + Vector3(0.3, 0.5, 2.0), at + Vector3(0, 0.85, -0.9), 28.0, 2.3],
	]


func tick(time: float, _dt: float) -> void:
	fire.blaze = 0.05 + smoothstep(0.3, 1.2, time) * 0.95
