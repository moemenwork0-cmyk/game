extends TrailerCard
## The title slam: JAZIRA / جزيرة, a band of light sweeps the letters, then the
## promise of the game underneath.

var _sweep: ShaderMaterial


func build(tr: Trailer) -> void:
	duration = 4.4
	fade_in = 0.12
	fade_out = 0.6
	lines = [
		["جزيرة", "res://assets/fonts/ArefRuqaa-Bold.ttf", 120, Color(0.95, 0.86, 0.66)],
		["J A Z I R A", "res://assets/fonts/Cinzel.ttf", 150],
		["ابنِ.  أبحِر.  احكُم.", "res://assets/fonts/Amiri-Regular.ttf", 54, Color(0.8, 0.78, 0.72)],
	]
	setup_card(tr)
	_sweep = ShaderMaterial.new()
	_sweep.shader = preload("res://shaders/trailer/title_sweep.gdshader")
	_labels[1].material = _sweep
	_labels[0].material = _sweep


func tick(time: float, dt: float) -> void:
	super.tick(time, dt)
	_labels[0].modulate.a = smoothstep(0.0, 0.15, time) * (1.0 - smoothstep(duration - fade_out, duration, time))
	_labels[1].modulate.a = _labels[0].modulate.a
	_labels[2].modulate.a = smoothstep(1.6, 2.4, time) * (1.0 - smoothstep(duration - fade_out, duration, time))
	_sweep.set_shader_parameter("sweep", lerpf(-0.4, 1.5, smoothstep(0.1, 2.2, time)))
	# the slam: starts big and settles in a few frames
	var k := 1.0 + 0.18 * exp(-time * 9.0)
	_root.scale = Vector2(k, k) * (1.0 + 0.03 * time / duration)
