class_name Sfx
extends Node
## Physically modelled audio (no recorded assets, no licensing): every one-shot is
## synthesised at startup from models of how the sound is produced (resonant modes,
## granular grains, turbulent noise, bubbles), and the world ambience — individual
## breaking waves with backwash, gusting wind through leaves, rain drops, insects —
## is generated live and reacts to weather, time of day and where you stand.

const RATE := 44100
const AMB_RATE := 24000
## the live ambience runs at a lower rate on weak hardware and the web
var _amb_rate := AMB_RATE

var streams := {}
var muffled := 0.0
var rain_level := 0.0
var wind_level := 0.2
var _rng := RandomNumberGenerator.new()

# ambience state
var _playback: AudioStreamGeneratorPlayback
var _t := 0.0
var _rumble := 0.0
var _rumble2 := 0.0
var _waves: Array[Dictionary] = []
var _next_wave := 1.5
var _wind_a := 0.0
var _wind_b := 0.0
var _gust := 0.5
var _gust_target := 0.5
var _whistle := [0.0, 0.0]
var _leaf_hp := 0.0
var _leaf_prev := 0.0
var _leaf_am := 0.0
var _drops: Array[Dictionary] = []
var _rain_bed := 0.0
var _rain_bed2 := 0.0
var _cicada_ph := 0.0
var _cicada_env := 0.0
var _cicada_bp := [0.0, 0.0]
var _out_lp := Vector2.ZERO
var _coast := 1.0
var _shore_pan := 0.0
var _trees_near := 0.0
var _day := 1.0
var _bird_timer := 3.0
var _gull_timer := 6.0
var _crickets: AudioStreamPlayer


func _ready() -> void:
	_rng.seed = 1234
	_build_library()
	var gen := AudioStreamGenerator.new()
	_amb_rate = 16000 if (Settings.quality == 0 or OS.has_feature("web")) else AMB_RATE
	gen.mix_rate = _amb_rate
	gen.buffer_length = 0.35
	var ap := AudioStreamPlayer.new()
	ap.stream = gen
	ap.playback_type = AudioServer.PLAYBACK_TYPE_STREAM   # web needs stream playback for generators
	ap.volume_db = -3.0
	add_child(ap)
	ap.play()
	_playback = ap.get_stream_playback()
	_crickets = AudioStreamPlayer.new()
	_crickets.stream = streams["crickets"][0]
	_crickets.volume_db = -80.0
	add_child(_crickets)
	_crickets.play()
	_rng.randomize()


func play(id: String, pos: Variant = null, vol_db: float = 0.0, pitch_var: float = 0.08) -> void:
	if not streams.has(id):
		return
	var arr: Array = streams[id]
	var s: AudioStream = arr[_rng.randi() % arr.size()]
	if pos == null:
		var ap := AudioStreamPlayer.new()
		ap.stream = s
		ap.volume_db = vol_db
		ap.pitch_scale = 1.0 + _rng.randf_range(-pitch_var, pitch_var)
		ap.finished.connect(ap.queue_free)
		add_child(ap)
		ap.play()
	else:
		var ap3 := AudioStreamPlayer3D.new()
		ap3.stream = s
		ap3.volume_db = vol_db
		ap3.unit_size = 7.0
		ap3.max_distance = 120.0
		ap3.attenuation_filter_cutoff_hz = 9000.0
		ap3.attenuation_filter_db = -18.0
		ap3.pitch_scale = 1.0 + _rng.randf_range(-pitch_var, pitch_var)
		ap3.finished.connect(ap3.queue_free)
		add_child(ap3)
		ap3.global_position = pos
		ap3.play()


# ======================================================================== library

func _build_library() -> void:
	streams["step_sand"] = _variants(6, _step_sand)
	streams["step_grass"] = _variants(6, _step_grass)
	streams["step_stone"] = _variants(5, _step_stone)
	streams["step_water"] = _variants(5, _step_water)
	streams["wood"] = _variants(4, func() -> PackedFloat32Array: return _wood_knock(1.0))
	streams["chop"] = _variants(4, _chop)
	streams["rock"] = _variants(4, _rock_hit)
	streams["dig"] = _variants(4, _dig)
	streams["tree_fall"] = [_wav(_tree_fall())]
	streams["break"] = _variants(3, _wood_break)
	streams["splash"] = _variants(3, func() -> PackedFloat32Array: return _splash(1.0))
	streams["pickup"] = _variants(3, _pickup)
	streams["place"] = _variants(3, func() -> PackedFloat32Array: return _wood_knock(1.6))
	streams["swing"] = _variants(3, func() -> PackedFloat32Array: return _whoosh(0.22, 1.0))
	streams["spear"] = _variants(3, func() -> PackedFloat32Array: return _mix(_whoosh(0.18, 1.4), _splash(0.35), 0.08))
	streams["eat"] = _variants(3, _eat)
	streams["drink"] = _variants(3, _drink)
	streams["hurt"] = _variants(2, _hurt)
	streams["thunder"] = _variants(2, _thunder)
	streams["sizzle"] = [_wav(_sizzle(1.4))]
	streams["fire"] = [_wav(_fire_loop(4.0), true)]
	streams["bird"] = _variants(5, _bird_song)
	streams["gull"] = _variants(3, _gull)
	streams["crickets"] = [_wav(_crickets_loop(4.0), true)]
	streams["heartbeat"] = [_wav(_heartbeat())]
	streams["whisper"] = _variants(4, _whisper)
	streams["horn"] = [_wav(_ship_horn())]
	streams["groan"] = _variants(3, _metal_groan)
	streams["ui"] = [_wav(_ui_tick())]


func _variants(n: int, gen: Callable) -> Array:
	var out := []
	for i in n:
		out.append(_wav(gen.call()))
	return out


# ---------------------------------------------------------------- DSP helpers

func _buf(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(seconds * RATE))
	return b


func _noise() -> float:
	return _rng.randf() * 2.0 - 1.0


## Biquad (RBJ cookbook) applied in place. kind: "lp", "hp", "bp".
func _biquad(b: PackedFloat32Array, kind: String, freq: float, q: float = 0.707) -> PackedFloat32Array:
	var w0 := TAU * clampf(freq, 10.0, RATE * 0.45) / RATE
	var al := sin(w0) / (2.0 * q)
	var c := cos(w0)
	var b0 := 0.0
	var b1 := 0.0
	var b2 := 0.0
	match kind:
		"lp":
			b0 = (1.0 - c) * 0.5
			b1 = 1.0 - c
			b2 = b0
		"hp":
			b0 = (1.0 + c) * 0.5
			b1 = -(1.0 + c)
			b2 = b0
		_:
			b0 = al
			b1 = 0.0
			b2 = -al
	var a0 := 1.0 + al
	var a1 := -2.0 * c
	var a2 := 1.0 - al
	b0 /= a0
	b1 /= a0
	b2 /= a0
	a1 /= a0
	a2 /= a0
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0
	for i in b.size():
		var x := b[i]
		var y := b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		b[i] = y
	return b


## Sum of exponentially decaying sinusoids — the sound of a struck solid.
func _modes(b: PackedFloat32Array, start: float, freqs: Array, decays: Array, amps: Array) -> void:
	var s0 := int(start * RATE)
	for m in freqs.size():
		var f: float = freqs[m] * _rng.randf_range(0.96, 1.04)
		var d: float = decays[m]
		var a: float = amps[m]
		var ph := _rng.randf() * TAU
		var n := mini(int(d * 6.0 * RATE), b.size() - s0)
		for i in n:
			var t := float(i) / RATE
			b[s0 + i] += sin(ph + TAU * f * t) * a * exp(-t / d)


## Many tiny filtered impulses (sand grains, crunch, crackle).
func _grains(b: PackedFloat32Array, start: float, dur: float, count: int, amp: float, grain_ms: float = 2.0, shape: float = 1.5) -> void:
	for g in count:
		var u := pow(_rng.randf(), shape)
		var s0 := int((start + u * dur) * RATE)
		var gl := int(grain_ms * 0.001 * RATE * _rng.randf_range(0.5, 1.5))
		var ga := amp * _rng.randf_range(0.3, 1.0) * (1.0 - u * 0.6)
		for i in gl:
			if s0 + i >= b.size():
				break
			b[s0 + i] += _noise() * ga * (1.0 - float(i) / gl)


func _noise_burst(b: PackedFloat32Array, start: float, attack: float, decay: float, amp: float) -> void:
	var s0 := int(start * RATE)
	for i in range(s0, b.size()):
		var t := float(i - s0) / RATE
		var env := minf(t / maxf(attack, 0.0001), 1.0) * exp(-t / decay)
		b[i] += _noise() * env * amp


func _thump(b: PackedFloat32Array, start: float, f0: float, f1: float, decay: float, amp: float) -> void:
	var s0 := int(start * RATE)
	var ph := 0.0
	for i in range(s0, mini(b.size(), s0 + int(decay * 6.0 * RATE))):
		var t := float(i - s0) / RATE
		ph += TAU * lerpf(f1, f0, exp(-t * 25.0)) / RATE
		b[i] += sin(ph) * amp * exp(-t / decay) * minf(t * 800.0, 1.0)


func _bubble(b: PackedFloat32Array, start: float, f: float, dur: float, amp: float) -> void:
	# a collapsing air bubble: a sine whose pitch rises as it shrinks
	var s0 := int(start * RATE)
	var ph := 0.0
	for i in range(s0, mini(b.size(), s0 + int(dur * RATE))):
		var t := float(i - s0) / RATE
		ph += TAU * f * (1.0 + t / dur * 1.6) / RATE
		b[i] += sin(ph) * amp * exp(-t / (dur * 0.35))


func _mix(a: PackedFloat32Array, b: PackedFloat32Array, offset: float = 0.0, gain: float = 1.0) -> PackedFloat32Array:
	var o := int(offset * RATE)
	if a.size() < b.size() + o:
		a.resize(b.size() + o)
	for i in b.size():
		a[i + o] += b[i] * gain
	return a


func _normalize(b: PackedFloat32Array, peak: float = 0.85) -> PackedFloat32Array:
	var m := 0.0001
	for v in b:
		m = maxf(m, absf(v))
	var g := peak / m
	for i in b.size():
		b[i] *= g
	# short fade-out to avoid clicks
	var f := mini(200, b.size())
	for i in f:
		b[b.size() - 1 - i] *= float(i) / f
	return b


func _wav(samples: PackedFloat32Array, loop: bool = false, rate: int = RATE) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(samples.size() * 2)
	for i in samples.size():
		data.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = rate
	w.stereo = false
	w.data = data
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = samples.size()
	return w


# ---------------------------------------------------------------- footsteps

func _step_sand() -> PackedFloat32Array:
	var b := _buf(0.28)
	_thump(b, 0.0, 70.0, 140.0, 0.03, 0.35)
	_grains(b, 0.005, 0.16, 260, 0.35, 1.2, 1.8)
	_noise_burst(b, 0.0, 0.01, 0.06, 0.25)
	_biquad(b, "bp", _rng.randf_range(1800.0, 2600.0), 0.6)
	_thump(b, 0.0, 60.0, 110.0, 0.03, 0.25)
	return _normalize(b, 0.7)


func _step_grass() -> PackedFloat32Array:
	var b := _buf(0.3)
	_noise_burst(b, 0.0, 0.03, 0.07, 0.6)
	_grains(b, 0.0, 0.18, 70, 0.3, 3.0, 1.2)
	_biquad(b, "hp", 1400.0)
	_biquad(b, "lp", 7000.0)
	_thump(b, 0.0, 55.0, 100.0, 0.035, 0.35)
	return _normalize(b, 0.6)


func _step_stone() -> PackedFloat32Array:
	var b := _buf(0.25)
	_modes(b, 0.0, [1650.0, 2700.0, 4100.0], [0.012, 0.008, 0.005], [0.4, 0.25, 0.15])
	_grains(b, 0.003, 0.08, 60, 0.25, 0.8, 2.0)
	_biquad(b, "hp", 500.0)
	_thump(b, 0.0, 65.0, 130.0, 0.03, 0.5)
	return _normalize(b, 0.65)


func _step_water() -> PackedFloat32Array:
	var b := _splash(0.6)
	return _normalize(b, 0.7)


# ---------------------------------------------------------------- impacts

func _wood_knock(size: float) -> PackedFloat32Array:
	var b := _buf(0.4)
	var f := 1.0 / size
	_modes(b, 0.0, [210.0 * f, 470.0 * f, 820.0 * f, 1340.0 * f], [0.07, 0.045, 0.03, 0.015], [0.6, 0.4, 0.25, 0.12])
	_noise_burst(b, 0.0, 0.0005, 0.004, 0.5)
	_biquad(b, "lp", 6000.0)
	return _normalize(b, 0.8)


func _chop() -> PackedFloat32Array:
	var b := _buf(0.6)
	# blade bites: hard transient, then the trunk rings at low wooden modes
	_noise_burst(b, 0.0, 0.0002, 0.003, 1.0)
	_modes(b, 0.0, [118.0, 260.0, 415.0, 690.0, 1150.0], [0.16, 0.11, 0.08, 0.05, 0.025], [0.7, 0.5, 0.35, 0.22, 0.1])
	_grains(b, 0.002, 0.07, 120, 0.25, 0.7, 2.5)
	_thump(b, 0.0, 70.0, 150.0, 0.05, 0.4)
	_biquad(b, "lp", 7500.0)
	return _normalize(b, 0.9)


func _rock_hit() -> PackedFloat32Array:
	var b := _buf(0.6)
	# steel pick rings, stone cracks
	_modes(b, 0.0, [2240.0, 3710.0, 5120.0, 6800.0], [0.09, 0.06, 0.04, 0.025], [0.35, 0.25, 0.18, 0.1])
	_noise_burst(b, 0.0, 0.0002, 0.006, 0.8)
	_grains(b, 0.004, 0.25, 140, 0.35, 1.0, 2.2)
	_thump(b, 0.0, 80.0, 180.0, 0.04, 0.45)
	return _normalize(b, 0.85)


func _dig() -> PackedFloat32Array:
	var b := _buf(0.45)
	_noise_burst(b, 0.0, 0.02, 0.1, 0.5)
	_grains(b, 0.0, 0.3, 300, 0.25, 1.5, 1.4)
	_biquad(b, "lp", 2600.0)
	_thump(b, 0.02, 55.0, 110.0, 0.06, 0.6)
	return _normalize(b, 0.8)


func _wood_break() -> PackedFloat32Array:
	var b := _buf(1.0)
	_noise_burst(b, 0.0, 0.0002, 0.01, 1.0)
	_grains(b, 0.0, 0.7, 180, 0.5, 2.0, 2.0)
	_modes(b, 0.0, [180.0, 390.0, 650.0], [0.12, 0.08, 0.05], [0.4, 0.3, 0.2])
	_biquad(b, "lp", 6000.0)
	return _normalize(b, 0.85)


func _tree_fall() -> PackedFloat32Array:
	var b := _buf(3.4)
	# fibres tearing: stick-slip pulses through the trunk's resonances, speeding up
	var t := 0.0
	var pulses := PackedFloat32Array()
	pulses.resize(b.size())
	while t < 1.7:
		var rate := lerpf(25.0, 140.0, t / 1.7) * _rng.randf_range(0.7, 1.3)
		var i := int(t * RATE)
		if i < pulses.size():
			pulses[i] = _rng.randf_range(0.5, 1.0)
		t += 1.0 / rate
	var r1 := _biquad(pulses.duplicate(), "bp", 320.0, 6.0)
	var r2 := _biquad(pulses.duplicate(), "bp", 860.0, 5.0)
	for i in b.size():
		b[i] = r1[i] * 3.0 + r2[i] * 2.0
	# the crash: trunk hits the ground, branches snap, leaves thrash
	_thump(b, 2.0, 38.0, 90.0, 0.35, 1.6)
	_grains(b, 1.95, 1.2, 420, 0.4, 3.0, 1.6)
	var leaves := _buf(1.4)
	_noise_burst(leaves, 0.0, 0.05, 0.4, 0.5)
	_biquad(leaves, "hp", 1800.0)
	_mix(b, leaves, 1.95)
	_biquad(b, "lp", 8000.0)
	return _normalize(b, 0.95)


func _splash(size: float) -> PackedFloat32Array:
	var b := _buf(0.5 + size * 0.5)
	_noise_burst(b, 0.0, 0.004, 0.08 * (0.6 + size), 0.8)
	_biquad(b, "lp", 3500.0)
	for k in int(4 + size * 10):
		_bubble(b, _rng.randf_range(0.01, 0.25 + size * 0.2), _rng.randf_range(350.0, 1300.0), _rng.randf_range(0.02, 0.06), 0.25)
	_grains(b, 0.05, 0.3 + size * 0.3, int(80 * size), 0.12, 1.0, 1.5)
	return _normalize(b, 0.75)


func _whoosh(dur: float, pitch: float) -> PackedFloat32Array:
	var b := _buf(dur)
	var y1 := 0.0
	var y2 := 0.0
	for i in b.size():
		var t := float(i) / b.size()
		var env := sin(PI * t) * sin(PI * t)
		var f := (400.0 + 1600.0 * sin(PI * t)) * pitch
		# swept resonant band (simple state-variable filter)
		var fc := 2.0 * sin(PI * f / RATE)
		var hp := _noise() - y2 - 0.6 * y1
		y1 += fc * hp
		y2 += fc * y1
		b[i] = y1 * env
	return _normalize(b, 0.6)


func _pickup() -> PackedFloat32Array:
	var b := _buf(0.25)
	_noise_burst(b, 0.0, 0.01, 0.04, 0.4)
	_biquad(b, "bp", 2400.0, 1.2)
	_modes(b, 0.02, [520.0, 1180.0], [0.03, 0.02], [0.25, 0.12])
	return _normalize(b, 0.5)


func _eat() -> PackedFloat32Array:
	var b := _buf(1.1)
	for k in 3:
		var s := k * 0.32
		_grains(b, s, 0.12, 120 if k == 0 else 50, 0.5 if k == 0 else 0.25, 1.4, 1.5)
		_thump(b, s, 60.0, 90.0, 0.04, 0.3)
	_biquad(b, "lp", 3800.0)
	return _normalize(b, 0.6)


func _drink() -> PackedFloat32Array:
	var b := _buf(1.0)
	for k in 3:
		var s := k * 0.3
		_bubble(b, s, _rng.randf_range(180.0, 240.0), 0.12, 0.7)
		_noise_burst(b, s, 0.005, 0.03, 0.1)
	_biquad(b, "lp", 1600.0)
	return _normalize(b, 0.6)


func _hurt() -> PackedFloat32Array:
	var b := _buf(0.5)
	_thump(b, 0.0, 45.0, 110.0, 0.12, 1.0)
	_noise_burst(b, 0.0, 0.001, 0.03, 0.3)
	_biquad(b, "lp", 900.0)
	return _normalize(b, 0.8)


func _thunder() -> PackedFloat32Array:
	var b := _buf(5.0)
	var lp := 0.0
	var lp2 := 0.0
	var env := 0.0
	for i in b.size():
		var t := float(i) / RATE
		lp += (_noise() - lp) * 0.025
		lp2 += (lp - lp2) * 0.05
		var target := exp(-t * 0.9) * (0.5 + 0.5 * sin(t * 4.0 + sin(t * 1.7) * 3.0))
		if t < 0.06:
			target += 1.6
		env += (target - env) * 0.0015
		b[i] = lp2 * env
	_grains(b, 0.0, 0.4, 200, 0.05, 4.0, 2.0)
	return _normalize(b, 0.95)


func _sizzle(dur: float) -> PackedFloat32Array:
	var b := _buf(dur)
	_grains(b, 0.0, dur, int(dur * 900), 0.3, 0.6, 1.0)
	_biquad(b, "hp", 2500.0)
	return _normalize(b, 0.5)


func _fire_loop(dur: float) -> PackedFloat32Array:
	var b := _buf(dur)
	var lp := 0.0
	var lp2 := 0.0
	for i in b.size():
		lp += (_noise() - lp) * 0.015
		lp2 += (lp - lp2) * 0.03
		b[i] = lp2 * 6.0   # low roar of burning gas
	# resin pops ring briefly at high frequencies
	for k in int(dur * 14):
		var s := _rng.randf() * (dur - 0.05)
		_modes(b, s, [_rng.randf_range(2000.0, 5000.0)], [0.004], [_rng.randf_range(0.2, 0.6)])
	_grains(b, 0.0, dur, int(dur * 300), 0.08, 0.5, 1.0)
	# make the loop seamless
	var x := int(0.05 * RATE)
	for i in x:
		var a := float(i) / x
		b[i] = b[i] * a + b[b.size() - x + i] * (1.0 - a)
	b.resize(b.size() - x)
	return _normalize(b, 0.6)


func _bird_song() -> PackedFloat32Array:
	# a tropical songbird: a phrase of 3-9 FM trills with species-like contours
	var notes := _rng.randi_range(3, 9)
	var b := _buf(notes * 0.16 + 0.3)
	var base := _rng.randf_range(2200.0, 4200.0)
	var shape := _rng.randi_range(0, 2)
	var t0 := 0.0
	for n in notes:
		var dur := _rng.randf_range(0.05, 0.13)
		var s0 := int(t0 * RATE)
		var ph := 0.0
		var f0 := base * _rng.randf_range(0.85, 1.2)
		for i in int(dur * RATE):
			var u := float(i) / (dur * RATE)
			var f := f0
			match shape:
				0:
					f = f0 * (1.0 + 0.5 * u)            # upslur
				1:
					f = f0 * (1.4 - 0.6 * u)            # downslur
				2:
					f = f0 * (1.0 + 0.25 * sin(u * 30.0))  # warble
			ph += TAU * f / RATE
			if s0 + i < b.size():
				b[s0 + i] += sin(ph + 0.3 * sin(ph * 2.0)) * sin(PI * u)
		t0 += dur + _rng.randf_range(0.02, 0.08)
	return _normalize(b, 0.5)


func _gull() -> PackedFloat32Array:
	# laughing gull cry: harmonic-rich voice sweeping up then down, through formants
	var calls := _rng.randi_range(2, 4)
	var b := _buf(calls * 0.42 + 0.2)
	for c in calls:
		var s0 := int(c * 0.42 * RATE)
		var dur := 0.34
		var ph := 0.0
		for i in int(dur * RATE):
			var u := float(i) / (dur * RATE)
			var f := 700.0 + 600.0 * sin(PI * minf(u * 1.3, 1.0)) * (1.0 - u * 0.3)
			ph += TAU * f / RATE
			var saw := fmod(ph / TAU, 1.0) * 2.0 - 1.0
			b[s0 + i] += saw * sin(PI * u) * (0.8 + 0.2 * sin(u * 80.0))
	_biquad(b, "bp", 1600.0, 1.4)
	var b2 := _biquad(b.duplicate(), "bp", 2900.0, 2.0)
	for i in b.size():
		b[i] += b2[i] * 0.7
	return _normalize(b, 0.45)


func _crickets_loop(dur: float) -> PackedFloat32Array:
	var b := _buf(dur)
	for k in 3:
		var f := _rng.randf_range(3900.0, 4700.0)
		var rate := _rng.randf_range(12.0, 18.0)
		var chirp_len := _rng.randf_range(0.25, 0.5)
		var period := _rng.randf_range(0.6, 1.1)
		var off := _rng.randf() * period
		for i in b.size():
			var t := float(i) / RATE
			var in_chirp := fmod(t + off, period) < chirp_len
			if in_chirp and fmod(t * rate, 1.0) < 0.55:
				b[i] += sin(TAU * f * t) * (0.4 - k * 0.1)
	_biquad(b, "bp", 4300.0, 1.0)
	return _normalize(b, 0.4)


func _heartbeat() -> PackedFloat32Array:
	var b := _buf(1.0)
	_thump(b, 0.0, 42.0, 70.0, 0.09, 1.0)
	_thump(b, 0.22, 38.0, 60.0, 0.11, 0.7)
	_biquad(b, "lp", 200.0)
	return _normalize(b, 0.9)


func _whisper() -> PackedFloat32Array:
	# breathy pseudo-speech: noise through moving vowel formants, syllable by syllable
	var syl := _rng.randi_range(3, 7)
	var b := _buf(syl * 0.2 + 0.4)
	var formants := [[700.0, 1220.0], [300.0, 2300.0], [400.0, 800.0], [550.0, 1800.0], [350.0, 1000.0]]
	for s in syl:
		var seg := _buf(0.2)
		_noise_burst(seg, 0.0, 0.04, 0.07, 1.0)
		var fm: Array = formants[_rng.randi() % formants.size()]
		var a := _biquad(seg.duplicate(), "bp", fm[0], 5.0)
		var c := _biquad(seg.duplicate(), "bp", fm[1], 6.0)
		var sh := _biquad(seg.duplicate(), "hp", 4500.0)
		for i in seg.size():
			seg[i] = a[i] + c[i] * 0.7 + sh[i] * (0.6 if _rng.randf() < 0.3 else 0.15)
		_mix(b, seg, s * 0.2 + _rng.randf_range(0.0, 0.05))
	return _normalize(b, 0.4)


func _ship_horn() -> PackedFloat32Array:
	var b := _buf(4.0)
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		ph += TAU * 98.0 * (1.0 + 0.004 * sin(t * 5.0)) / RATE
		var env := minf(t * 3.0, 1.0) * (1.0 - smoothstep(3.0, 4.0, t))
		var v := 0.0
		for h in [1, 2, 3, 4, 5, 6]:
			v += sin(ph * h) / pow(h, 0.9)
		b[i] = v * env
	_biquad(b, "lp", 1400.0)
	return _normalize(b, 0.9)


func _metal_groan() -> PackedFloat32Array:
	# a steel hull straining: slow stick-slip excitation of low plate modes
	var b := _buf(2.6)
	var t := 0.0
	while t < 2.4:
		var i := int(t * RATE)
		if i < b.size():
			b[i] += _rng.randf_range(0.4, 1.0)
		t += 1.0 / (lerpf(18.0, 55.0, sin(PI * t / 2.4)) * _rng.randf_range(0.8, 1.2))
	var r1 := _biquad(b.duplicate(), "bp", 140.0, 12.0)
	var r2 := _biquad(b.duplicate(), "bp", 310.0, 10.0)
	var r3 := _biquad(b.duplicate(), "bp", 620.0, 8.0)
	for i in b.size():
		b[i] = r1[i] * 4.0 + r2[i] * 2.5 + r3[i] * 1.2
	return _normalize(b, 0.9)


func _ui_tick() -> PackedFloat32Array:
	var b := _buf(0.06)
	_modes(b, 0.0, [1800.0, 3100.0], [0.006, 0.004], [0.4, 0.2])
	return _normalize(b, 0.35)


# ======================================================================== live ambience

func _process(delta: float) -> void:
	_update_listener()
	_fill_ambience()
	var night := 1.0 - _day
	_crickets.volume_db = linear_to_db(clampf(night * 0.5 * (1.0 - muffled) * (1.0 - rain_level * 0.7), 0.0001, 1.0))
	if Game.playing or Game.player == null:
		_bird_timer -= delta
		if _bird_timer <= 0.0:
			_bird_timer = _rng.randf_range(2.0, 7.0)
			if _day > 0.5 and muffled < 0.5 and rain_level < 0.4:
				var trees := get_tree().get_nodes_in_group("trees")
				if trees.size() > 0:
					var t: Node3D = trees[_rng.randi() % trees.size()]
					play("bird", t.global_position + Vector3(0, 5, 0), -6.0, 0.15)
		_gull_timer -= delta
		if _gull_timer <= 0.0:
			_gull_timer = _rng.randf_range(8.0, 22.0)
			if _day > 0.4 and muffled < 0.5:
				var a := _rng.randf() * TAU
				play("gull", Vector3(cos(a) * 35.0, 14.0, sin(a) * 35.0), -4.0, 0.1)


func _update_listener() -> void:
	_day = Game.day_night.daylight if Game.day_night else 1.0
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var p := cam.global_position
	var r := Vector2(p.x, p.z).length()
	_coast = clampf(1.0 - (22.0 - r) / 18.0, 0.18, 1.0)
	# which ear faces the open sea
	var out := Vector3(p.x, 0, p.z).normalized()
	var right := cam.global_basis.x
	_shore_pan = clampf(right.dot(out), -1.0, 1.0) * 0.6
	var n := 0
	for t in get_tree().get_nodes_in_group("trees"):
		if (t as Node3D).global_position.distance_squared_to(p) < 144.0:
			n += 1
	_trees_near = lerpf(_trees_near, clampf(n / 5.0, 0.0, 1.0), 0.05)


func _fill_ambience() -> void:
	if _playback == null:
		return
	var n := _playback.get_frames_available()
	var bench := OS.has_environment("JAZIRA_AMB_BENCH")
	if bench:
		n = _amb_rate / 60
	if n <= 0:
		return
	var dt := 1.0 / _amb_rate
	var storm := clampf(wind_level, 0.0, 1.0)
	var lp_a := lerpf(0.55, 0.05, muffled)
	var wv := 0.55 + storm * 1.1
	for i in n:
		_t += dt
		var white := _rng.randf() * 2.0 - 1.0

		# --- ocean: distant rumble + discrete breaking waves with backwash fizz
		_rumble += (white - _rumble) * 0.004
		_rumble2 += (_rumble - _rumble2) * 0.01
		var sea_l := _rumble2 * 9.0 * (0.4 + storm)
		var sea_r := sea_l
		_next_wave -= dt
		if _next_wave <= 0.0:
			_next_wave = _rng.randf_range(4.5, 9.0) * (1.0 - storm * 0.4)
			_waves.append({"t": 0.0, "amp": _rng.randf_range(0.6, 1.0) * wv, "pan": _shore_pan + _rng.randf_range(-0.3, 0.3),
				"lp": 0.0, "dur": _rng.randf_range(2.2, 3.6)})
		var k := 0
		while k < _waves.size():
			var w: Dictionary = _waves[k]
			var wt: float = w["t"]
			var dur: float = w["dur"]
			if wt > dur + 2.5:
				_waves.remove_at(k)
				continue
			# the crash: brightens as the lip hits, then darkens as foam spreads
			var crash := smoothstep(0.0, 0.35, wt) * exp(-maxf(wt - 0.35, 0.0) / (dur * 0.35))
			var cut := lerpf(0.04, 0.35, exp(-wt * 1.2))
			w["lp"] = float(w["lp"]) + (white - float(w["lp"])) * cut
			var body: float = float(w["lp"]) * crash * 1.6
			# backwash: fine fizz of water draining through sand
			var back := smoothstep(dur * 0.5, dur, wt) * exp(-maxf(wt - dur, 0.0) * 1.2)
			var fizz := 0.0
			if _rng.randf() < 0.35:
				fizz = white * back * 0.22
			var v: float = (body + fizz) * float(w["amp"]) * _coast
			var pan: float = w["pan"]
			sea_l += v * (1.0 - pan * 0.5)
			sea_r += v * (1.0 + pan * 0.5)
			w["t"] = wt + dt
			k += 1

		# --- wind: gusting turbulence, whistle in strong wind, leaves rustling nearby
		if _rng.randf() < 0.0005:
			_gust_target = _rng.randf_range(0.2, 1.0)
		_gust += (_gust_target - _gust) * 0.00004
		_wind_a += (white - _wind_a) * 0.03
		_wind_b += (_wind_a - _wind_b) * 0.03
		var wind_amp := (0.25 + wind_level * 1.6) * (0.4 + _gust)
		var wind := _wind_b * 3.5 * wind_amp
		var wf := (500.0 + _gust * 500.0) / _amb_rate
		_whistle[0] += wf * (white - _whistle[0] - 0.15 * _whistle[1])
		_whistle[1] += wf * _whistle[0]
		wind += _whistle[1] * 0.15 * pow(wind_level, 2.0) * _gust
		_leaf_hp = 0.7 * (_leaf_hp + white - _leaf_prev)
		_leaf_prev = white
		if _rng.randf() < 0.002:
			_leaf_am = _rng.randf()
		_leaf_am *= 0.9997
		var leaves := _leaf_hp * _trees_near * (0.05 + wind_level * 0.25) * (0.3 + _leaf_am) * (0.3 + _gust)

		# --- rain: individual drops pattering on leaves and sand + a soft bed
		var rain_l := 0.0
		var rain_r := 0.0
		if rain_level > 0.01:
			_rain_bed += (white - _rain_bed) * 0.6
			_rain_bed2 += (_rain_bed - _rain_bed2) * 0.08
			var bed := (_rain_bed - _rain_bed2) * rain_level * 0.35
			rain_l = bed
			rain_r = bed
			if _rng.randf() < rain_level * 0.12:
				_drops.append({"t": 0.0, "f": _rng.randf_range(1800.0, 6500.0), "a": _rng.randf_range(0.05, 0.25), "p": _rng.randf_range(-1.0, 1.0)})
			var d := 0
			while d < _drops.size():
				var dr: Dictionary = _drops[d]
				var dtt: float = dr["t"]
				if dtt > 0.015:
					_drops.remove_at(d)
					continue
				var s := sin(TAU * float(dr["f"]) * dtt) * float(dr["a"]) * exp(-dtt * 400.0)
				rain_l += s * (1.0 - float(dr["p"]) * 0.5)
				rain_r += s * (1.0 + float(dr["p"]) * 0.5)
				dr["t"] = dtt + dt
				d += 1

		# --- cicadas: buzzing swells in the trees on hot afternoons
		var bug := 0.0
		if _day > 0.6 and _trees_near > 0.1:
			_cicada_ph += dt
			_cicada_env += ((0.5 + 0.5 * sin(_t * 0.15)) - _cicada_env) * 0.0001
			var am := 0.5 + 0.5 * sin(TAU * 32.0 * _cicada_ph)
			var cf := 4600.0 / _amb_rate
			_cicada_bp[0] += cf * (white - _cicada_bp[0] - 0.05 * _cicada_bp[1])
			_cicada_bp[1] += cf * _cicada_bp[0]
			bug = _cicada_bp[1] * am * _cicada_env * _trees_near * 0.05 * (1.0 - rain_level)

		var L := sea_l + wind * 0.9 + leaves + rain_l + bug
		var R := sea_r + wind + leaves * 0.9 + rain_r + bug
		_out_lp.x += (L - _out_lp.x) * lp_a
		_out_lp.y += (R - _out_lp.y) * lp_a
		var o := _out_lp * (0.6 + muffled * 1.2)
		if not bench:
			_playback.push_frame(Vector2(clampf(o.x, -1.0, 1.0), clampf(o.y, -1.0, 1.0)))
