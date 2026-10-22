extends TrailerShot
## In the street below the clock tower: people would be running here. Looking up, the
## crest leans over the tower; it swallows the clock face; the ground shakes.

var city: DrownedCity
var wave: Tsunami


func build(tr: Trailer) -> void:
	duration = 3.4
	tr.sky.hour = 18.4
	tr.sky.storm = 0.4
	city = DrownedCity.new()
	tr.add_child(city)
	city.build(0.0, -1000.0, 0.12, 0.6, 6)
	wave = Tsunami.new()
	tr.add_child(wave)
	wave.build(3000.0, 190.0)
	wave.position = Vector3(0, 0, -330)
	wave.speed = 52.0
	# lightning shows the wall of water against the sky
	events = [
		[0.6, func() -> void: tr.lightning(Vector3(-300, 400, -1200), 1.4)],
		[1.9, func() -> void: tr.lightning(Vector3(200, 450, -1100), 1.0)],
		[2.9, func() -> void: tr.lightning(Vector3(-100, 420, -1000), 1.2)],
	]
	keys = [
		[0.0, Vector3(9, 1.7, 95), Vector3(0, 70, 0), 30.0, 0.0],
		[3.4, Vector3(8, 1.6, 102), Vector3(0, 110, -20), 36.0, 0.0],
	]


func tick(time: float, _dt: float) -> void:
	shake = 0.04 + smoothstep(1.0, 3.2, time) * 0.5
