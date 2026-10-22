extends TrailerShot
## Captain Nasser fights the wheel, rain lashing his face, shouting orders into the
## gale. Lightning freezes his expression for a heartbeat. Camera rides the deck.

var ship: Murjan
var captain: Actor


func build(tr: Trailer) -> void:
	duration = 3.2
	tr.sky.hour = 18.8
	tr.sky.storm = 1.0
	var sea := tr.add_ocean(1.7)
	ship = Murjan.new()
	tr.add_child(ship)
	ship.ocean = sea
	ship.place(Vector3.ZERO, 0.0)
	ship.speed = 4.0
	captain = Actor.create("captain", {"angry": "m_idle_angry_01", "talk": "m_gestic_talk_excited_01"})
	ship.add_child(captain)
	captain.position = Vector3(0, ship.deck_y, ship.length * 0.22)
	captain.rotation.y = 0.0
	captain.when_ready(func() -> void:
		captain.play("talk", 0.0, 1.15)
		captain.feel({"anger": 1.0, "fear": 0.45}, 0.1)
		captain.talk(3.0, 1.6)
		captain.look_at_point(captain.global_position + Vector3(0, 1.6, -20)))
	follow = ship
	shake = 0.05
	var head := Vector3(0, ship.deck_y + 1.62, ship.length * 0.22)
	keys = [
		[0.0, head + Vector3(0.75, -0.55, -1.35), head + Vector3(0, 0.12, 0), 36.0, 1.5],
		[3.2, head + Vector3(0.4, -0.45, -1.0), head + Vector3(0, 0.1, 0), 32.0, 1.1],
	]
	# a swinging deck lantern for the warm key, a cold rim from the lightning side
	var key := OmniLight3D.new()
	key.light_color = Color(1.0, 0.6, 0.3)
	key.light_energy = 3.0
	key.omni_range = 4.0
	key.shadow_enabled = true
	key.position = head + Vector3(-0.9, 0.5, -0.8)
	ship.add_child(key)
	var rim := SpotLight3D.new()
	rim.light_color = Color(0.6, 0.72, 1.0)
	rim.light_energy = 6.0
	rim.spot_range = 10.0
	rim.spot_angle = 25.0
	rim.position = head + Vector3(1.5, 1.5, 3.0)
	ship.add_child(rim)
	rim.look_at_from_position(rim.position, head, Vector3.UP)
	events = [
		[0.9, func() -> void: tr.lightning(ship.deck_point(-6, -10, 18), 1.2)],
		[2.3, func() -> void: tr.lightning(ship.deck_point(-30, -40, 60), 0.7)],
	]
