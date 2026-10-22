extends TrailerShot
## Crane up from Layla on the wet sand: the cove opens up, the Murjan lies wrecked
## on the reef, gulls over the morning sea.

var set_: BeachWake


func build(tr: Trailer) -> void:
	duration = 6.0
	set_ = BeachWake.new()
	tr.add_child(set_)
	await set_.build(tr)
	events = [[0.0, _frame]]


func _frame() -> void:
	var h := set_.head()
	var to_sea := (set_.wreck.global_position - h)
	to_sea.y = 0.0
	to_sea = to_sea.normalized()
	var side := to_sea.cross(Vector3.UP)
	keys = [
		[0.0, h - to_sea * 1.4 + side * 0.6 + Vector3(0, 0.6, 0), h + Vector3(0, 0.1, 0), 40.0, 1.6],
		[3.0, h - to_sea * 4.0 + side * 2.5 + Vector3(0, 3.5, 0), h + to_sea * 30.0, 44.0, 0.0],
		[6.0, h - to_sea * 9.0 + side * 4.0 + Vector3(0, 9.0, 0), set_.wreck.global_position + Vector3(0, 4, 0), 46.0, 0.0],
	]
