class_name Intro
extends Node3D
## The opening: the Murjan at night, in the storm. She rides the real ocean surface
## (pitch and roll sampled from the waves), the sky splits, she takes the sea over
## the stern and goes down. Narration is the character's own memory, so it differs
## per playthrough. Any key (Space / Enter / Esc) skips.

signal finished

const LENGTH := 34.0

var _cam: Camera3D
var _ship: Node3D
var _lights: Array[OmniLight3D] = []
var _layer: CanvasLayer
var _sub: Label
var _bars: Array[ColorRect] = []
var _t := 0.0
var _done := false
var _cues: Array = []
var _heading := Vector3.ZERO
var _origin := Vector3.ZERO
var _sink := 0.0
var _prev_sat := 1.0


func _ready() -> void:
	var w: Node3D = get_tree().get_first_node_in_group("wreck")
	if w:
		w.visible = false
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	_ship = ShipBuilder.build_ship(rng, false)
	add_child(_ship)
	for l in _ship.find_children("*", "OmniLight3D", true, false):
		_lights.append(l)
	# she comes in from the open sea toward the reef where she will die
	var reef := Wreck.POS * Vector3(1, 0, 1)
	_heading = -reef.normalized()
	_origin = reef - _heading * 70.0
	_cam = Camera3D.new()
	_cam.fov = 50.0
	_cam.far = 1500.0
	add_child(_cam)
	_cam.current = true
	Game.day_night.time_hours = 1.2
	Game.day_night.day_minutes = 600.0
	Game.weather.force("storm")
	Game.weather._lightning_t = 2.5
	_build_overlay()
	var bio: Dictionary = Game.story.bio()
	var intro: Array = StoryData.INTRO
	_cues = [
		[0.8, "say", intro[0]],
		[6.5, "say", intro[1]],
		[9.0, "flash"],
		[9.4, "horn"],
		[12.5, "groan"],
		[13.0, "say", bio["memory"]],
		[15.0, "sink"],
		[16.0, "flash"],
		[19.5, "groan"],
		[22.0, "lights_out"],
		[24.5, "say", intro[3]],
		[26.0, "under"],
		[30.0, "end"],
	]


func _build_overlay() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 4
	add_child(_layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.theme()
	_layer.add_child(root)
	for top in [true, false]:
		var b := ColorRect.new()
		b.color = Color.BLACK
		b.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE if top else Control.PRESET_BOTTOM_WIDE)
		if top:
			b.offset_bottom = 0
		else:
			b.offset_top = 0
		root.add_child(b)
		_bars.append(b)
	_sub = Label.new()
	_sub.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	_sub.offset_top = -150
	_sub.offset_bottom = -60
	_sub.offset_left = 120
	_sub.offset_right = -120
	_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sub.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_sub.add_theme_font_size_override("font_size", 26)
	_sub.add_theme_color_override("font_color", Color(1, 0.95, 0.88))
	_sub.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_sub.add_theme_constant_override("shadow_outline_size", 6)
	_sub.modulate.a = 0.0
	root.add_child(_sub)
	var skip := Label.new()
	skip.text = StoryData.t({"en": "SPACE — skip", "ar": "مسافة — تخطٍّ"})
	skip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	skip.offset_left = -220
	skip.offset_top = -40
	skip.offset_right = -24
	skip.offset_bottom = -12
	skip.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	skip.add_theme_font_size_override("font_size", 15)
	skip.add_theme_color_override("font_color", Color(1, 1, 1, 0.4))
	root.add_child(skip)


func _unhandled_input(event: InputEvent) -> void:
	if _done or _t < 1.0:
		return
	if event.is_action_pressed("jump") or event.is_action_pressed("pause") or event.is_action_pressed("ui_accept"):
		get_viewport().set_input_as_handled()
		_finish()


func _process(delta: float) -> void:
	if _done:
		return
	_t += delta
	var vh := get_viewport().get_visible_rect().size.y
	var bar := vh * 0.11 * clampf(_t, 0.0, 1.0)
	_bars[0].offset_bottom = bar
	_bars[1].offset_top = -bar
	while not _cues.is_empty() and _t >= float(_cues[0][0]):
		_cue(_cues.pop_front())
	_move_ship(delta)
	_move_camera()


func _cue(c: Array) -> void:
	match String(c[1]):
		"say":
			_sub.text = StoryData.t(c[2])
			var tw := _sub.create_tween()
			tw.tween_property(_sub, "modulate:a", 1.0, 0.6)
			tw.tween_interval(4.6)
			tw.tween_property(_sub, "modulate:a", 0.0, 0.8)
		"flash":
			Game.weather._flash = 1.0
			Game.sfx.play("thunder", null, 4.0, 0.1)
		"horn":
			Game.sfx.play("horn", _ship.global_position, 2.0, 0.0)
		"groan":
			Game.sfx.play("groan", _ship.global_position, 0.0, 0.15)
		"sink":
			var tw2 := create_tween()
			tw2.tween_property(self, "_sink", 1.0, 13.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		"lights_out":
			for l in _lights:
				var tw3 := l.create_tween()
				for i in 4:
					tw3.tween_property(l, "light_energy", 0.0, 0.08)
					tw3.tween_property(l, "light_energy", 1.6, 0.12)
				tw3.tween_property(l, "light_energy", 0.0, 0.1)
		"under":
			Game.sfx.play("splash", _cam.global_position, 2.0)
			Game.hud.fade(1.0, 3.0)
		"end":
			_finish()


## The ship floats on the actual Gerstner surface: height from the hull centre,
## pitch from bow vs stern, roll from port vs starboard.
func _move_ship(delta: float) -> void:
	var ocean := Game.ocean
	var travel := minf(_t, 15.0) * 2.2 + maxf(_t - 15.0, 0.0) * 0.6
	var c := _origin + _heading * travel
	var side := _heading.cross(Vector3.UP)
	var half := ShipBuilder.LENGTH * 0.45
	var hb := ocean.get_height(c.x + _heading.x * half, c.z + _heading.z * half)
	var hs := ocean.get_height(c.x - _heading.x * half, c.z - _heading.z * half)
	var hp := ocean.get_height(c.x - side.x * 3.0, c.z - side.z * 3.0)
	var hst := ocean.get_height(c.x + side.x * 3.0, c.z + side.z * 3.0)
	var hc := ocean.get_height(c.x, c.z)
	var pitch := atan2(hb - hs, half * 2.0) * 0.8 + _sink * 0.55
	var roll := atan2(hst - hp, 6.0) * 0.7 + _sink * 0.35
	var draft := 2.3 + _sink * 16.0
	var yaw := atan2(-_heading.x, -_heading.z)
	var target := Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch) * Basis(Vector3.FORWARD, roll),
		Vector3(c.x, (hb + hs + hc) / 3.0 - draft, c.z))
	# inertia: a 1,200-tonne hull does not snap to the water
	_ship.global_transform = _ship.global_transform.interpolate_with(target, 1.0 - exp(-2.2 * delta)) if _t > 0.1 else target


func _move_camera() -> void:
	var sp := _ship.global_position
	var side := _heading.cross(Vector3.UP)
	var u := clampf(_t / 26.0, 0.0, 1.0)
	# start wide and high, end low and close, at the waterline
	var dist := lerpf(46.0, 22.0, u)
	var height := lerpf(9.0, 1.2, smoothstep(0.3, 1.0, u))
	var off := side * dist - _heading * lerpf(18.0, 4.0, u)
	var pos := sp + off
	var wave := Game.ocean.get_height(pos.x, pos.z)
	pos.y = maxf(wave + height, wave + 0.6)
	# handheld shake, stronger in the storm and when she breaks
	var shake := 0.08 + _sink * 0.12
	pos += Vector3(sin(_t * 7.3), sin(_t * 5.1 + 1.0), cos(_t * 6.2)) * shake
	_cam.global_position = pos
	_cam.look_at(sp + Vector3(0, 5.0 - _sink * 4.0, 0), Vector3.UP)


func _finish() -> void:
	if _done:
		return
	_done = true
	await Game.hud.fade(1.0, 0.8)
	var w: Node3D = get_tree().get_first_node_in_group("wreck")
	if w:
		w.visible = true
	_sub.modulate.a = 0.0
	finished.emit()
	queue_free()
