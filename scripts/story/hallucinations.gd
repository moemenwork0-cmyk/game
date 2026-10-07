class_name Hallucinations
extends Node
## What a breaking mind does to the world. Driven by `intensity` (0..1, from low morale):
## colour drains away, a figure stands at the edge of sight and is gone when you look,
## lights of a ship that is not there, whispers behind you, your own heartbeat.

var intensity := 0.0
var _shown := 0.0
var _figure: Node3D
var _figure_t := 0.0
var _lights: Node3D
var _lights_t := 0.0
var _whisper_t := 25.0
var _beat_t := 0.0
var _base_sat := -1.0


func _ready() -> void:
	_figure = _make_figure()
	_figure.visible = false
	add_child(_figure)
	_lights = Node3D.new()
	for i in 3:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.82, 0.5)
		l.light_energy = 0.0
		l.omni_range = 30.0
		l.position = Vector3(i * 2.6 - 2.6, 0, 0)
		_lights.add_child(l)
		var dot := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.35
		sm.height = 0.7
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = Color(1.0, 0.85, 0.55)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		sm.material = m
		dot.mesh = sm
		l.add_child(dot)
	_lights.visible = false
	add_child(_lights)


func _make_figure() -> Node3D:
	# a silhouette: no face, no detail — only the shape of a person
	var root := Node3D.new()
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.02, 0.02, 0.025)
	m.roughness = 1.0
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var parts := [
		[CapsuleMesh.new(), Vector3(0, 1.15, 0), Vector3(0.42, 0.75, 0.3)],
		[SphereMesh.new(), Vector3(0, 1.72, 0), Vector3(0.22, 0.26, 0.24)],
		[CapsuleMesh.new(), Vector3(-0.11, 0.42, 0), Vector3(0.16, 0.44, 0.16)],
		[CapsuleMesh.new(), Vector3(0.11, 0.42, 0), Vector3(0.16, 0.44, 0.16)],
		[CapsuleMesh.new(), Vector3(-0.27, 1.1, 0), Vector3(0.11, 0.36, 0.11)],
		[CapsuleMesh.new(), Vector3(0.27, 1.1, 0), Vector3(0.11, 0.36, 0.11)],
	]
	for p in parts:
		var mi := MeshInstance3D.new()
		mi.mesh = p[0]
		mi.material_override = m
		mi.position = p[1]
		mi.scale = p[2] * Vector3(1.0, 1.0, 1.0)
		if p[0] is CapsuleMesh:
			(p[0] as CapsuleMesh).radius = 0.5
			(p[0] as CapsuleMesh).height = 2.0
		else:
			(p[0] as SphereMesh).radius = 0.5
			(p[0] as SphereMesh).height = 1.0
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(mi)
	root.set_meta("mat", m)
	return root


func _env() -> Environment:
	var main := get_tree().current_scene
	if main and "env" in main:
		return main.env
	return null


func _process(delta: float) -> void:
	var p := Game.player
	if p == null or not Game.playing:
		return
	_shown = move_toward(_shown, intensity, delta * 0.05)
	var env := _env()
	if env:
		if _base_sat < 0.0:
			_base_sat = env.adjustment_saturation
		env.adjustment_saturation = lerpf(_base_sat, 0.35, _shown)
	_update_figure(delta, p)
	_update_lights(delta, p)
	# whispers and heartbeat
	if _shown > 0.3:
		_whisper_t -= delta * _shown
		if _whisper_t <= 0.0:
			_whisper_t = randf_range(18.0, 40.0)
			var behind := p.global_position + p.camera.global_basis.z * 4.0
			Game.sfx.play("whisper", behind, -10.0 + _shown * 6.0)
	if _shown > 0.55:
		_beat_t -= delta
		if _beat_t <= 0.0:
			_beat_t = lerpf(1.3, 0.75, _shown)
			Game.sfx.play("heartbeat", null, -18.0 + _shown * 8.0, 0.0)


func _update_figure(delta: float, p: Player) -> void:
	var mat: StandardMaterial3D = _figure.get_meta("mat")
	if _figure.visible:
		_figure_t -= delta
		var cam := p.camera
		var to := (_figure.global_position + Vector3(0, 1.2, 0) - cam.global_position).normalized()
		var looking := (-cam.global_basis.z).dot(to) > 0.93
		# it fades the moment you look straight at it
		var a := mat.albedo_color.a
		a = move_toward(a, 0.0 if looking or _figure_t < 0.0 else 0.92, delta * (2.5 if looking else 0.6))
		mat.albedo_color.a = a
		if a <= 0.0 and (looking or _figure_t < 0.0):
			_figure.visible = false
		return
	if _shown < 0.35 or Game.day_night.daylight > 0.55:
		return
	if randf() > delta * 0.02 * _shown:
		return
	# place it at the edge of vision, 18..30 m away, on land
	var cam2 := p.camera
	var fwd := -cam2.global_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized().rotated(Vector3.UP, (1.0 if randf() < 0.5 else -1.0) * randf_range(0.55, 0.8))
	var pos := p.global_position + fwd * randf_range(18.0, 30.0)
	var h := Game.world.surface_height(pos.x, pos.z)
	if h < 0.6:
		return
	_figure.global_position = Vector3(pos.x, h, pos.z)
	_figure.look_at(Vector3(p.global_position.x, h, p.global_position.z), Vector3.UP)
	mat.albedo_color.a = 0.0
	_figure.visible = true
	_figure_t = randf_range(6.0, 12.0)


func _update_lights(delta: float, p: Player) -> void:
	if _lights.visible:
		_lights_t -= delta
		var e := clampf(minf(_lights_t, 14.0 - _lights_t) * 0.4, 0.0, 1.0) * 1.6
		for l in _lights.get_children():
			(l as OmniLight3D).light_energy = e * (0.85 + randf() * 0.15)
			((l.get_child(0) as MeshInstance3D).mesh.material as StandardMaterial3D).albedo_color.a = e / 1.6
		_lights.global_position.x += delta * 1.2
		if _lights_t <= 0.0:
			_lights.visible = false
			if Game.story:
				Game.story.say({"en": "…There was a ship. I saw it. Didn't I?", "ar": "…كانت هناك سفينة. رأيتها. أليس كذلك؟"}, false)
		return
	if _shown < 0.5 or Game.day_night.daylight > 0.25:
		return
	if randf() > delta * 0.006 * _shown:
		return
	var a := randf() * TAU
	_lights.global_position = Vector3(cos(a) * 160.0, 2.5, sin(a) * 160.0)
	_lights.look_at(Vector3(p.global_position.x, 2.5, p.global_position.z), Vector3.UP)
	_lights.visible = true
	_lights_t = 14.0
