extends TrailerShot
## Montage: time-lapse. Sun and shadows race across the beach while a boat grows from
## a keel into a hull; clouds stream; the tide comes and goes.

var boat: BoatFrame
var sky: SkyRig


func build(tr: Trailer) -> void:
	duration = 3.2
	sky = tr.sky
	sky.hour = 7.0
	var at := Vector3(-60, 0, 432)
	await tr.add_island(at, 140.0, 1.0)
	at.y = tr.ground(at.x, at.z)
	boat = BoatFrame.new()
	tr.add_child(boat)
	boat.global_position = at
	boat.rotation.y = 1.2
	boat.progress = 0.0
	var c := at + Vector3(9, 4.5, -6)
	keys = [
		[0.0, c, at + Vector3(0, 1.2, 0), 40.0, 0.0],
		[3.2, c + Vector3(-1.0, 0.5, -2.0), at + Vector3(0, 1.4, 0), 38.0, 0.0],
	]


func tick(time: float, _dt: float) -> void:
	var u := clampf(time / duration, 0.0, 1.0)
	sky.hour = lerpf(7.0, 17.6, u)
	sky._update_sun()
	boat.progress = smoothstep(0.02, 0.95, u)
