extends TrailerShot
## Dawn after everything. The repaired Murjan crests a long swell towards camera, sails
## full and lit gold from behind; the camera skims the water and rises with the wave.

var ship: Murjan


func build(tr: Trailer) -> void:
	duration = 4.8
	tr.sky.hour = 6.45
	tr.sky.storm = 0.0
	tr.sky.cloudiness = 0.35
	var sea := tr.add_ocean(1.9)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3(0, 0, 40), PI)   # sailing towards +Z, the camera
	ship.speed = 6.5
	shake = 0.04
	keys = [
		[0.0, Vector3(-9, 1.4, 92), Vector3(0, 9, 40), 38.0, 0.0],
		[4.8, Vector3(-14, 4.0, 98), Vector3(0, 12, 66), 44.0, 0.0],
	]
