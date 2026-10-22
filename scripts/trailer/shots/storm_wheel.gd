extends TrailerShot
## Captain Nasser fights the wheel, rain lashing his face, shouting orders into the
## gale. Lightning freezes his expression for a heartbeat. Camera rides the deck.

var ship: Murjan
var captain: Actor


func build(tr: Trailer) -> void:
	duration = 3.2
	tr.sky.hour = 18.8
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(2.6)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.0)
	ship.speed = 4.0
	captain = Actor.create("captain", {"angry": "m_idle_angry_01", "talk": "m_gestic_talk_excited_01"})
	ship.add_child(captain)
	captain.position = Vector3(0, ship.deck_y, ship.length * 0.22)
	captain.rotation.y = 0.0
	captain.ready.connect(func() -> void:
		captain.play("talk", 0.0, 1.15)
		captain.feel({"anger": 1.0, "fear": 0.45}, 0.1)
		captain.talk(3.0, 1.6)
		captain.look_at_point(captain.global_position + Vector3(0, 1.6, -20)))
	follow = ship
	shake = 0.05
	var head := Vector3(0, ship.deck_y + 1.62, ship.length * 0.22)
	keys = [
		[0.0, head + Vector3(0.55, 0.05, -1.25), head + Vector3(0, -0.02, 0), 38.0, 1.3],
		[3.2, head + Vector3(0.25, 0.0, -0.95), head + Vector3(0, 0.0, 0), 34.0, 1.0],
	]
	events = [
		[0.9, func() -> void: tr.lightning(ship.deck_point(-6, -10, 18), 1.2)],
		[2.3, func() -> void: tr.lightning(ship.deck_point(-30, -40, 60), 0.7)],
	]
