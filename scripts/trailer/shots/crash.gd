extends TrailerShot
## Night, the storm at its worst. From the helm, lightning shows black rocks dead ahead
## — too late. The hull strikes: the frame jolts, spray explodes, white-out.

var ship: Murjan
var captain: Actor
var _hit := false


func build(tr: Trailer) -> void:
	duration = 3.2
	tr.sky.hour = 20.2
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(2.3)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.0)
	ship.speed = 7.0
	var rock := load("res://assets/env/models/boulder_01.glb") as PackedScene
	for r in [[Vector3(-6, -3, -58), 9.0, 0.3], [Vector3(12, -4, -66), 12.0, 1.9], [Vector3(-22, -5, -74), 14.0, 4.0], [Vector3(26, -6, -90), 16.0, 2.6]]:
		var n := rock.instantiate() as Node3D
		tr.add_child(n)
		n.position = r[0]
		n.scale = Vector3.ONE * r[1]
		n.rotation.y = r[2]
	captain = Actor.create("captain", {"talk": "m_gestic_talk_excited_01"})
	ship.add_child(captain)
	captain.position = Vector3(0.6, ship.deck_y, ship.length * 0.2)
	captain.ready.connect(func() -> void:
		captain.play("talk", 0.0, 1.3)
		captain.feel({"fear": 1.0, "shock": 0.8}, 0.1)
		captain.talk(2.0, 1.8))
	follow = ship
	shake = 0.06
	var eye := Vector3(-0.8, ship.deck_y + 1.75, ship.length * 0.28)
	keys = [
		[0.0, eye, eye + Vector3(0.6, -0.4, -20), 50.0, 0.0],
		[2.0, eye + Vector3(0.1, 0.0, -0.4), eye + Vector3(0.4, -0.8, -20), 46.0, 0.0],
		[3.2, eye + Vector3(0.1, -0.3, -0.6), eye + Vector3(0.4, -2.5, -20), 46.0, 0.0],
	]
	events = [
		[0.7, func() -> void: tr.lightning(Vector3(-60, 120, -160), 1.3)],
		[0.9, func() -> void: tr.lightning(Vector3(-50, 110, -150), 0.7)],
		[2.05, func() -> void: _impact(tr)],
	]


func _impact(tr: Trailer) -> void:
	_hit = true
	ship.speed = 0.0
	ship.inertia = 0.3
	ship.draft += 0.8
	tr.lightning(ship.deck_point(0, -20, 6), 2.0)
	captain.go_limp(Vector3(0, 30, -90))
	Fx.burst(ship.deck_point(0, -ship.length * 0.5, 0), Color(0.85, 0.9, 0.95), 400, 14.0, 0.25, 2.0, 9.8, Vector3(0, 1, 1), 50.0)
	Fx.burst(ship.deck_point(0, -ship.length * 0.45, 0.5), Color(0.35, 0.25, 0.15), 120, 9.0, 0.3, 2.0, 9.8, Vector3(0, 1, 0.6), 60.0)


func tick(time: float, _dt: float) -> void:
	if _hit:
		shake = 0.6 * exp(-(time - 2.05) * 2.0) + 0.08
