extends TrailerShot
## Silence after the crash. Extreme close-up: sand on her cheek, foam hissing in,
## her eyes flutter and open into the light.

var set_: BeachWake


func build(tr: Trailer) -> void:
	duration = 4.8
	set_ = BeachWake.new()
	tr.add_child(set_)
	await set_.build(tr)
	events = [[0.0, _frame]]


func _frame() -> void:
	var h := set_.head()
	var up := set_.face_dir()
	var side := up.cross(Vector3.FORWARD).normalized()
	keys = [
		[0.0, h + up * 0.42 + side * 0.12, h + up * 0.05, 26.0, 0.42],
		[4.8, h + up * 0.3 + side * 0.08, h + up * 0.06, 24.0, 0.3],
	]


func tick(time: float, _dt: float) -> void:
	var lids := 1.0
	if time > 1.6:
		lids = 1.0 - smoothstep(1.6, 2.0, time) * 0.5     # first flutter
	if time > 2.0:
		lids = 0.5 + smoothstep(2.0, 2.3, time) * 0.45     # squeezes shut against the light
	if time > 2.6:
		lids = 0.95 - smoothstep(2.6, 3.6, time) * 0.95    # and opens
	set_.layla.face.lids = lids
