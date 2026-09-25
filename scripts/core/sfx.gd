class_name Sfx
extends Node
## All sounds are synthesized at startup; ambience (surf + wind) is streamed live.

const RATE := 22050

var streams := {}
var _gen_player: AudioStreamPlayer
var _playback: AudioStreamGeneratorPlayback
var _crickets: AudioStreamPlayer
var _t := 0.0
var _brown := 0.0
var _hiss := 0.0
var _wind := 0.0
var _wind2 := 0.0
var _lp := Vector2.ZERO
var _rng := RandomNumberGenerator.new()
var _bird_timer := 3.0
var muffled := 0.0


func _ready() -> void:
	_rng.randomize()
	streams["chop"] = [_make_impact(150.0, 0.28, 0.55, 900.0), _make_impact(135.0, 0.3, 0.55, 800.0)]
	streams["wood"] = [_make_impact(320.0, 0.16, 0.35, 2200.0), _make_impact(280.0, 0.18, 0.35, 2000.0)]
	streams["rock"] = [_make_impact(900.0, 0.12, 0.6, 6000.0), _make_impact(1100.0, 0.1, 0.6, 7000.0)]
	streams["dig"] = [_make_noise(0.28, 700.0, 9.0), _make_noise(0.3, 600.0, 8.0)]
	streams["step_grass"] = [_make_noise(0.12, 2600.0, 30.0), _make_noise(0.11, 3000.0, 32.0), _make_noise(0.13, 2200.0, 28.0)]
	streams["step_sand"] = [_make_noise(0.16, 1400.0, 20.0), _make_noise(0.15, 1200.0, 22.0)]
	streams["step_stone"] = [_make_impact(420.0, 0.07, 0.8, 5000.0), _make_impact(380.0, 0.07, 0.8, 5000.0)]
	streams["step_water"] = [_make_noise(0.3, 1800.0, 9.0), _make_noise(0.28, 2000.0, 10.0)]
	streams["splash"] = [_make_noise(0.8, 2500.0, 4.5)]
	streams["pickup"] = [_make_tone(660.0, 990.0, 0.12)]
	streams["place"] = [_make_impact(240.0, 0.2, 0.3, 1600.0)]
	streams["break"] = [_make_noise(0.5, 3000.0, 6.0)]
	streams["tree_fall"] = [_make_creak()]
	streams["swing"] = [_make_noise(0.18, 900.0, 14.0)]
	streams["bird"] = [_make_chirp(3200.0, 4400.0, 3), _make_chirp(2600.0, 3800.0, 2), _make_chirp(3800.0, 2900.0, 4)]
	streams["fire"] = [_make_crackle()]

	var gen := AudioStreamGenerator.new()
	gen.mix_rate = RATE
	gen.buffer_length = 0.4
	_gen_player = AudioStreamPlayer.new()
	_gen_player.stream = gen
	_gen_player.volume_db = -6.0
	add_child(_gen_player)
	_gen_player.play()
	_playback = _gen_player.get_stream_playback()

	_crickets = AudioStreamPlayer.new()
	_crickets.stream = _make_crickets()
	_crickets.volume_db = -80.0
	add_child(_crickets)
	_crickets.play()


func play(id: String, pos: Variant = null, vol_db: float = 0.0, pitch_var: float = 0.12) -> void:
	if not streams.has(id):
		return
	var arr: Array = streams[id]
	var s: AudioStream = arr[_rng.randi() % arr.size()]
	var p: Node
	if pos == null:
		var ap := AudioStreamPlayer.new()
		ap.stream = s
		ap.volume_db = vol_db
		ap.pitch_scale = 1.0 + _rng.randf_range(-pitch_var, pitch_var)
		ap.finished.connect(ap.queue_free)
		p = ap
		add_child(p)
		ap.play()
	else:
		var ap3 := AudioStreamPlayer3D.new()
		ap3.stream = s
		ap3.volume_db = vol_db
		ap3.unit_size = 6.0
		ap3.max_distance = 80.0
		ap3.pitch_scale = 1.0 + _rng.randf_range(-pitch_var, pitch_var)
		ap3.finished.connect(ap3.queue_free)
		add_child(ap3)
		ap3.global_position = pos
		ap3.play()


func _process(delta: float) -> void:
	_fill_ambience()
	var night := 0.0
	if Game.day_night:
		night = 1.0 - Game.day_night.daylight
	_crickets.volume_db = linear_to_db(clampf(night * 0.35 * (1.0 - muffled), 0.0001, 1.0))
	_bird_timer -= delta
	if _bird_timer <= 0.0:
		_bird_timer = _rng.randf_range(2.5, 9.0)
		if night < 0.5 and muffled < 0.5:
			var trees := get_tree().get_nodes_in_group("trees")
			if trees.size() > 0:
				var t: Node3D = trees[_rng.randi() % trees.size()]
				play("bird", t.global_position + Vector3(0, 5, 0), -8.0, 0.2)


func _fill_ambience() -> void:
	if _playback == null:
		return
	var n := _playback.get_frames_available()
	if n <= 0:
		return
	var coast := 1.0
	var height := 0.0
	if Game.player:
		var pp := Game.player.global_position
		var r := Vector2(pp.x, pp.z).length()
		coast = clampf(1.0 - (26.0 - r) / 20.0, 0.25, 1.0)
		height = clampf(pp.y / 14.0, 0.0, 1.0)
	var lp_a := lerpf(0.35, 0.04, muffled)
	var dt := 1.0 / RATE
	for i in n:
		_t += dt
		var white := _rng.randf() * 2.0 - 1.0
		_brown = (_brown + white * 0.03) * 0.996
		_hiss += (white - _hiss) * 0.25
		# slow breaking-wave envelope
		var ph := sin(_t * TAU / 7.3 + sin(_t * 0.37) * 1.4) * 0.5 + 0.5
		var env := pow(ph, 3.0)
		var surf := (_brown * 1.4 + _hiss * 0.3 * env) * (0.35 + env) * coast
		# wind
		_wind += (white - _wind) * 0.02
		_wind2 += (_wind - _wind2) * 0.02
		var gust := 0.5 + 0.5 * sin(_t * 0.23 + sin(_t * 0.07) * 3.0)
		var w := _wind2 * (0.6 + 1.6 * height) * gust * 3.0
		var sL := surf * 0.8 + w * 0.8
		var sR := surf * 0.75 + w * 0.9
		_lp.x += (sL - _lp.x) * lp_a
		_lp.y += (sR - _lp.y) * lp_a
		_playback.push_frame(_lp * (1.0 + muffled * 1.5))


# ---------- synthesis helpers ----------

func _wav(samples: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(samples.size() * 2)
	for i in samples.size():
		data.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = samples.size()
	return w


func _make_impact(freq: float, dur: float, noise_amt: float, cutoff: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var lp := 0.0
	var a := clampf(cutoff / RATE * TAU, 0.0, 1.0)
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var f := freq * (1.0 - 0.35 * t / dur)
		ph += TAU * f / RATE
		var body := sin(ph) * exp(-t * 22.0) + sin(ph * 2.37) * 0.3 * exp(-t * 40.0)
		lp += ((_rng.randf() * 2.0 - 1.0) - lp) * a
		s[i] = (body * (1.0 - noise_amt) + lp * noise_amt * 2.0 * exp(-t * 35.0)) * 0.9
	return _wav(s)


func _make_noise(dur: float, cutoff: float, decay: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var lp := 0.0
	var lp2 := 0.0
	var a := clampf(cutoff / RATE * TAU, 0.0, 1.0)
	for i in n:
		var t := float(i) / RATE
		lp += ((_rng.randf() * 2.0 - 1.0) - lp) * a
		lp2 += (lp - lp2) * a
		var att := minf(t * 200.0, 1.0)
		s[i] = lp2 * 2.2 * exp(-t * decay) * att
	return _wav(s)


func _make_tone(f0: float, f1: float, dur: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var ph := 0.0
	for i in n:
		var t := float(i) / n
		ph += TAU * lerpf(f0, f1, t) / RATE
		s[i] = sin(ph) * 0.35 * sin(PI * t)
	return _wav(s)


func _make_chirp(f0: float, f1: float, count: int) -> AudioStreamWAV:
	var note := 0.09
	var gap := 0.06
	var n := int((note + gap) * count * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var k := fmod(t, note + gap)
		if k < note:
			var u := k / note
			ph += TAU * (lerpf(f0, f1, u) + sin(u * 40.0) * 150.0) / RATE
			s[i] = sin(ph) * 0.3 * sin(PI * u)
	return _wav(s)


func _make_creak() -> AudioStreamWAV:
	var dur := 1.6
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var ph := 0.0
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var f := 70.0 + 30.0 * sin(t * 9.0) + 40.0 * t
		ph += TAU * f / RATE
		var saw := fmod(ph / TAU, 1.0) * 2.0 - 1.0
		lp += (saw - lp) * 0.08
		var crack := 0.0
		if t > 1.1:
			crack = (_rng.randf() * 2.0 - 1.0) * exp(-(t - 1.1) * 8.0)
		s[i] = lp * 0.5 * smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(1.2, 1.6, t)) + crack * 0.6
	return _wav(s)


func _make_crickets() -> AudioStreamWAV:
	var dur := 2.0
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	for i in n:
		var t := float(i) / RATE
		var pulse := 1.0 if fmod(t * 14.0, 1.0) < 0.5 and fmod(t, 0.7) < 0.35 else 0.0
		var p2 := 1.0 if fmod(t * 11.0 + 0.3, 1.0) < 0.45 and fmod(t + 0.4, 0.9) < 0.3 else 0.0
		s[i] = sin(TAU * 4300.0 * t) * pulse * 0.25 + sin(TAU * 3900.0 * t) * p2 * 0.18
	return _wav(s, true)


func _make_crackle() -> AudioStreamWAV:
	var dur := 3.0
	var n := int(dur * RATE)
	var s := PackedFloat32Array()
	s.resize(n)
	var lp := 0.0
	var pop := 0.0
	for i in n:
		lp += ((_rng.randf() * 2.0 - 1.0) - lp) * 0.05
		if _rng.randf() < 0.0012:
			pop = 1.0
		pop *= 0.992
		s[i] = lp * 0.5 + (_rng.randf() * 2.0 - 1.0) * pop * 0.6
	return _wav(s, true)
