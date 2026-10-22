extends TrailerShot
## Murjan ploughs through a storm at dusk; lightning cracks open the sky behind her.
## Camera skims the wave tops off her starboard bow, handheld, as she crests a swell.

var ship: Murjan


func build(tr: Trailer) -> void:
	duration = 4.5
	tr.sky.hour = 18.7
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(1.75)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.15)
	ship.speed = 5.0
	shake = 0.18
	keys = [
		[0.0, Vector3(40, 6.0, -50), Vector3(0, 8, -4), 50.0, 0.0],
		[2.2, Vector3(37, 7.0, -20), Vector3(0, 9, 2), 46.0, 0.0],
		[4.5, Vector3(33, 8.5, 8), Vector3(-2, 10, 10), 42.0, 0.0],
	]
	events = [
		[1.35, func() -> void: tr.lightning(Vector3(-220, 260, -380), 1.0)],
		[1.55, func() -> void: tr.lightning(Vector3(-200, 240, -360), 0.6)],
		[3.6, func() -> void: tr.lightning(Vector3(150, 280, -500), 0.8)],
	]
