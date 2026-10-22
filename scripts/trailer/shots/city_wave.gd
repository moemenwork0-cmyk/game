extends TrailerShot
## Dusk, 2031. The city's lights flicker. Over the skyline, past the old clock tower,
## a wall of water taller than the towers rises out of the haze.

var city: DrownedCity
var wave: Tsunami


func build(tr: Trailer) -> void:
	duration = 4.2
	tr.sky.hour = 18.35
	tr.sky.storm = 0.35
	city = DrownedCity.new()
	tr.add_child(city)
	city.build(0.0, -1000.0, 0.14, 0.25, 8)
	wave = Tsunami.new()
	tr.add_child(wave)
	wave.build(4200.0, 230.0)
	wave.position = Vector3(0, 0, -780)
	wave.speed = 48.0
	shake = 0.0
	# lightning shows the wall of water against the sky
	events = [
		[0.6, func() -> void: tr.lightning(Vector3(-300, 400, -1200), 1.4)],
		[1.9, func() -> void: tr.lightning(Vector3(200, 450, -1100), 1.0)],
		[2.9, func() -> void: tr.lightning(Vector3(-100, 420, -1000), 1.2)],
	]
	keys = [
		[0.0, Vector3(70, 150, 520), Vector3(10, 90, -300), 34.0, 0.0],
		[4.2, Vector3(62, 140, 480), Vector3(10, 120, -300), 30.0, 0.0],
	]
