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
	keys = [
		[0.0, h + Vector3(0.12, 0.62, 0.18), h + Vector3(0, 0.04, 0), 30.0, 0.62],
		[4.8, h + Vector3(0.06, 0.42, 0.1), h + Vector3(0, 0.05, 0), 28.0, 0.42],
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
