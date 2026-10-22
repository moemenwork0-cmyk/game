extends TrailerShot
## Night, the storm at its worst. From the helm, lightning shows black rocks dead ahead
## — too late. The hull strikes: the frame jolts, spray explodes, white-out.

var ship: Murjan
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
	ship.speed = 9.0
	var rock := load("res://assets/env/models/boulder_01.glb") as PackedScene
	# a reef of black rocks right in her path
	for r in [[Vector3(-4, -2, -34), 7.0, 0.3], [Vector3(6, -3, -40), 9.0, 1.9], [Vector3(-14, -3, -46), 10.0, 4.0], [Vector3(16, -4, -52), 11.0, 2.6]]:
		var n := rock.instantiate() as Node3D
		tr.add_child(n)
		n.position = r[0]
		n.scale = Vector3.ONE * r[1]
		n.rotation.y = r[2]
	# from the rocks, looking back at her coming on, lightning behind
	keys = [
		[0.0, Vector3(16, 7, -62), Vector3(0, 7, -14), 44.0, 0.0],
		[2.0, Vector3(15, 6.5, -58), Vector3(0, 6, -20), 40.0, 0.0],
		[3.2, Vector3(15, 6.5, -57), Vector3(0, 5, -24), 40.0, 0.0],
	]
	shake = 0.08
	events = [
		[0.7, func() -> void: tr.lightning(Vector3(-60, 120, 80), 1.4)],
		[0.9, func() -> void: tr.lightning(Vector3(-50, 110, 70), 0.7)],
		[2.05, func() -> void: _impact(tr)],
	]


func _impact(tr: Trailer) -> void:
	_hit = true
	ship.speed = 0.0
	ship.inertia = 0.3
	ship.draft -= 1.2
	var tw := create_tween().set_parallel()
	tw.tween_property(ship, "trim_pitch", 0.16, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(ship, "trim_roll", 0.22, 0.8).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tr.lightning(ship.deck_point(0, -20, 6), 2.0)
	Fx.burst(ship.deck_point(0, -ship.length * 0.5, -2), Color(0.85, 0.9, 0.95), 900, 16.0, 0.4, 2.5, 9.8, Vector3(0, 1, 1), 50.0)
	Fx.burst(ship.deck_point(0, -ship.length * 0.45, 0.5), Color(0.35, 0.25, 0.15), 120, 9.0, 0.3, 2.0, 9.8, Vector3(0, 1, 0.6), 60.0)


func tick(time: float, _dt: float) -> void:
	if _hit:
		shake = 0.6 * exp(-(time - 2.05) * 2.0) + 0.08
