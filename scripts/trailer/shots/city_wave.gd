extends TrailerShot
## Dusk, 2031. The city's lights flicker. Over the skyline, past the old clock tower,
## a wall of water taller than the towers rises out of the haze.

var city: DrownedCity
var wave: Tsunami


func build(tr: Trailer) -> void:
	duration = 4.2
	tr.sky.hour = 18.35
	tr.sky.storm = 0.55
	city = DrownedCity.new()
	tr.add_child(city)
	city.build(0.0, -1000.0, 0.35, 0.25, 8)
	wave = Tsunami.new()
	tr.add_child(wave)
	wave.build(4200.0, 170.0)
	wave.position = Vector3(0, 0, -780)
	wave.speed = 48.0
	shake = 0.0
	keys = [
		[0.0, Vector3(70, 96, 420), Vector3(10, 70, -300), 34.0, 0.0],
		[4.2, Vector3(62, 92, 380), Vector3(10, 95, -300), 30.0, 0.0],
	]
