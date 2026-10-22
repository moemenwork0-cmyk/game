extends TrailerShot
## The reveal: craning up and over the Murjan's mast, the morning haze parts on what is
## left of the old world, the tops of drowned towers and the clock tower's spire standing
## out of a calm sea.

var ship: Murjan
var city: DrownedCity


func build(tr: Trailer) -> void:
	duration = 5.6
	tr.sky.hour = 6.7
	tr.sky.storm = 0.0
	tr.sky.cloudiness = 0.3
	var sea := tr.add_ocean(1.1)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3(0, 0, 0), 0.0)   # sailing towards -Z, towards the city
	ship.speed = 4.0
	city = DrownedCity.new()
	tr.add_child(city)
	city.build(-88.0, 0.0, 0.0, 0.0, 6, 77)
	city.position = Vector3(40, 0, -900)
	for t in city.towers:
		if t.global_position.y + (t.mesh as BoxMesh).size.y * 0.5 < 1.0:
			t.visible = false  # fully under: not worth drawing
	keys = [
		[0.0, Vector3(6, 6, 34), Vector3(0, 12, 0), 46.0, 0.0],
		[2.6, Vector3(3, 24, 26), Vector3(10, 18, -300), 42.0, 0.0],
		[5.6, Vector3(0, 46, 30), Vector3(30, 10, -900), 34.0, 0.0],
	]
