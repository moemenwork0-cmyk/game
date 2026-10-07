class_name Music
extends RefCounted
## The game's theme, composed and synthesised in code (no samples, no licences):
## a plucked-string melody (Karplus–Strong, close to an oud) in maqam Hijaz on D,
## over a slow drone, with a frame drum marking the phrases. Rendered once on a
## worker thread into a seamless loop.

const RATE := 22050
const BEAT := 0.78
const LENGTH := 49.92   # 64 beats
const D3 := 146.83

## Hijaz on D: D Eb F# G A Bb C D Eb F# G
const SCALE := [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99, 392.0]

## [scale degree, beats, tremolo?]  (-1 = rest)
const MELODY := [
	[4, 2.0, false], [5, 1.0, false], [4, 1.0, false], [3, 1.0, false], [2, 1.0, false], [-1, 1.0, false], [3, 0.5, false], [2, 0.5, false], [1, 1.0, false], [0, 3.0, true], [-1, 2.0, false],
	[7, 2.0, false], [6, 1.0, false], [5, 1.0, false], [4, 2.0, true], [5, 0.5, false], [4, 0.5, false], [3, 1.0, false], [2, 2.0, false], [3, 1.0, false], [4, 3.0, true], [-1, 1.0, false],
	[2, 0.5, false], [3, 0.5, false], [4, 0.5, false], [5, 0.5, false], [6, 1.0, false], [7, 2.0, true], [8, 1.0, false], [7, 1.0, false], [6, 1.0, false], [5, 1.0, false], [4, 3.0, true], [-1, 1.0, false],
	[4, 1.0, false], [5, 0.5, false], [4, 0.5, false], [3, 1.0, false], [2, 1.0, false], [1, 1.0, false], [2, 0.5, false], [1, 0.5, false], [0, 5.0, true], [-1, 2.0, false],
]

static var _stream: AudioStreamWAV
static var _task := -1
static var _samples := PackedFloat32Array()


## Starts rendering in the background (call early, e.g. during loading).
static func prepare() -> void:
	if _stream != null or _task >= 0:
		return
	_task = WorkerThreadPool.add_task(_render)


## The theme, or null while it is still being rendered.
static func theme() -> AudioStreamWAV:
	if _stream:
		return _stream
	if _task >= 0 and WorkerThreadPool.is_task_completed(_task):
		WorkerThreadPool.wait_for_task_completion(_task)
		_task = -1
		_stream = _to_wav(_samples)
	return _stream


static func _render() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 17
	var total := int((LENGTH + 6.0) * RATE)
	var out := PackedFloat32Array()
	out.resize(total)
	# drone: D2 + A2, breathing slowly
	for i in total:
		var t := float(i) / RATE
		var sw := 0.6 + 0.4 * sin(TAU * t / (LENGTH / 2.0))
		out[i] = (sin(TAU * 73.42 * t) * 0.5 + sin(TAU * 110.0 * t + sin(t * 0.3)) * 0.25 + sin(TAU * 146.83 * t) * 0.12) * 0.16 * sw
	# melody
	var t0 := 2.0 * BEAT
	for n in MELODY:
		var deg: int = n[0]
		var dur: float = float(n[1]) * BEAT
		if deg >= 0:
			var f: float = SCALE[deg]
			if n[2]:
				# oud tremolo (risha): quick repeated strokes, swelling then fading
				var k := 0.0
				while k < dur * 0.92:
					var a := 0.5 + 0.35 * sin(PI * k / dur)
					_pluck(out, t0 + k, f, a, rng, 0.45)
					k += 0.105
			else:
				_pluck(out, t0 + rng.randf_range(0.0, 0.015), f, 0.9, rng, 1.6)
		t0 += dur
	# frame drum: "dum" on the phrase downbeats, light "tak" between
	var beat := 0.0
	while beat < 64.0:
		var t := beat * BEAT
		var pos := fmod(beat, 16.0)
		if pos == 0.0 or pos == 10.0:
			_dum(out, t, 0.55)
		elif pos == 6.0 or pos == 14.0:
			_tak(out, t, 0.18, rng)
		beat += 1.0
	# fold the tail back onto the start so the loop is seamless
	var n_loop := int(LENGTH * RATE)
	for i in range(n_loop, total):
		out[i - n_loop] += out[i]
	out.resize(n_loop)
	var peak := 0.0001
	for v in out:
		peak = maxf(peak, absf(v))
	for i in out.size():
		out[i] = out[i] / peak * 0.8
	_samples = out


## Karplus–Strong plucked string with a soft attack (fingertip/plectrum on gut).
static func _pluck(out: PackedFloat32Array, start: float, f: float, amp: float, rng: RandomNumberGenerator, sustain: float) -> void:
	var period := maxi(int(RATE / f), 2)
	var buf := PackedFloat32Array()
	buf.resize(period)
	var lp := 0.0
	for i in period:
		lp += (rng.randf() * 2.0 - 1.0 - lp) * 0.55
		buf[i] = lp
	var s0 := int(start * RATE)
	var n := mini(int(sustain * 2.6 * RATE), out.size() - s0)
	var decay := pow(0.001, 1.0 / (sustain * f))
	var idx := 0
	var prev := 0.0
	for i in n:
		var cur := buf[idx]
		var nxt := buf[(idx + 1) % period]
		var v := (cur + nxt) * 0.5 * decay
		buf[idx] = v
		idx = (idx + 1) % period
		# body resonance: a gentle low-pass plus the fundamental's warmth
		prev += (cur - prev) * 0.45
		out[s0 + i] += prev * amp * 0.5 * minf(float(i) / 60.0, 1.0)


static func _dum(out: PackedFloat32Array, start: float, amp: float) -> void:
	var s0 := int(start * RATE)
	var ph := 0.0
	for i in mini(int(1.2 * RATE), out.size() - s0):
		var t := float(i) / RATE
		ph += TAU * lerpf(62.0, 95.0, exp(-t * 30.0)) / RATE
		out[s0 + i] += sin(ph) * exp(-t / 0.28) * amp * minf(t * 900.0, 1.0)


static func _tak(out: PackedFloat32Array, start: float, amp: float, rng: RandomNumberGenerator) -> void:
	var s0 := int(start * RATE)
	var hp := 0.0
	var prev := 0.0
	for i in mini(int(0.15 * RATE), out.size() - s0):
		var t := float(i) / RATE
		var x := rng.randf() * 2.0 - 1.0
		hp = x - prev
		prev = x
		out[s0 + i] += (hp * 0.5 + sin(TAU * 420.0 * t) * 0.6) * exp(-t / 0.03) * amp


static func _to_wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var data := PackedByteArray()
	data.resize(samples.size() * 2)
	for i in samples.size():
		data.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.data = data
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_end = samples.size()
	return w
