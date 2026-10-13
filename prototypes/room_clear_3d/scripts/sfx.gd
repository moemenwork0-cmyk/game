extends Node
## Sound (autoload "Sfx"). Every sound is synthesised at startup, so the game ships no audio files.
## 3D one-shots go through a small voice pool on a bus with room reverb.

const RATE := 22050

var streams := {}
var _pool: Array[AudioStreamPlayer3D] = []
var _pool2d: Array[AudioStreamPlayer] = []
var _next := 0
var _next2d := 0
var ambience: AudioStreamPlayer
var music_player: AudioStreamPlayer
var _music_id := ""


func _ready() -> void:
	_setup_buses()
	_build_all()
	for i in 24:
		var p := AudioStreamPlayer3D.new()
		p.bus = "SFX"
		p.unit_size = 6.0
		p.max_distance = 40.0
		p.attenuation_filter_cutoff_hz = 9000.0
		p.panning_strength = 0.8
		add_child(p)
		_pool.append(p)
	for i in 6:
		var p := AudioStreamPlayer.new()
		p.bus = "UI"
		add_child(p)
		_pool2d.append(p)
	music_player = AudioStreamPlayer.new()
	music_player.bus = "UI"
	add_child(music_player)
	ambience = AudioStreamPlayer.new()
	ambience.stream = streams["ambience"]
	ambience.volume_db = -18.0
	ambience.bus = "UI"
	add_child(ambience)


func play_at(id: String, pos: Vector3, vol_db := 0.0, pitch := 1.0) -> void:
	if not streams.has(id):
		return
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	if not p.is_inside_tree():
		return
	p.stream = streams[id]
	p.global_position = pos
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()


## Starts a looping music bed ("" stops it). Built lazily the first time it is needed.
func music(id: String, vol_db := -10.0) -> void:
	if id == _music_id:
		return
	_music_id = id
	if id == "":
		var t := create_tween()
		t.tween_property(music_player, "volume_db", -60.0, 1.0)
		t.tween_callback(music_player.stop)
		return
	if not streams.has(id):
		streams[id] = _menu_music() if id == "menu_music" else _combat_bed()
	music_player.stream = streams[id]
	music_player.volume_db = -40.0
	music_player.play()
	create_tween().tween_property(music_player, "volume_db", vol_db, 1.5)


func play(id: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not streams.has(id):
		return
	var p := _pool2d[_next2d]
	_next2d = (_next2d + 1) % _pool2d.size()
	p.stream = streams[id]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()


func _setup_buses() -> void:
	if AudioServer.get_bus_index("SFX") >= 0:
		return
	AudioServer.add_bus()
	var i := AudioServer.bus_count - 1
	AudioServer.set_bus_name(i, "SFX")
	AudioServer.set_bus_send(i, "Master")
	var rev := AudioEffectReverb.new()
	rev.room_size = 0.42
	rev.damping = 0.55
	rev.wet = 0.16
	rev.dry = 1.0
	rev.spread = 0.8
	AudioServer.add_bus_effect(i, rev)
	AudioServer.add_bus()
	i = AudioServer.bus_count - 1
	AudioServer.set_bus_name(i, "UI")
	AudioServer.set_bus_send(i, "Master")
	var lim := AudioEffectHardLimiter.new()
	lim.ceiling_db = -0.5
	AudioServer.add_bus_effect(0, lim)


# ------------------------------------------------------------------ synthesis

const LOOPS := ["ambience", "menu_music", "combat_bed"]


## Pre-rendered sounds (assets/sfx/*.wav, made by tools/bake_sfx.gd) load instantly;
## anything missing is synthesised on the spot.
func _build_all() -> void:
	var dir := "res://assets/sfx/"
	if DirAccess.dir_exists_absolute(dir):
		for f in DirAccess.get_files_at(dir):
			# exported builds only list the .import remaps
			var name: String = f.trim_suffix(".import")
			if name.ends_with(".wav") and not streams.has(name.get_basename()):
				var id := name.get_basename()
				var w := load(dir + name) as AudioStreamWAV
				if w:
					if id in LOOPS:
						w.loop_mode = AudioStreamWAV.LOOP_FORWARD
						w.loop_end = int(w.get_length() * w.mix_rate)
					streams[id] = w
	if streams.has("shot"):
		return
	_synth_all()


func synth_everything() -> Dictionary:
	_synth_all()
	streams["menu_music"] = _menu_music()
	streams["combat_bed"] = _combat_bed()
	return streams


func _synth_all() -> void:
	streams["shot"] = _gunshot(1.0, 1.0)
	streams["eshot"] = _gunshot(0.85, 0.9)
	streams["step"] = _make(0.11, func(t: float, n: float) -> float:
		return (sin(TAU * 75.0 * t) * exp(-t * 55.0) * 0.7 + n * exp(-t * 90.0) * 0.35) * 0.8, 0.5)
	streams["hit_flesh"] = _make(0.16, func(t: float, n: float) -> float:
		return sin(TAU * (110.0 - t * 300.0) * t) * exp(-t * 30.0) * 0.8 + n * exp(-t * 40.0) * 0.4, 0.35)
	streams["imp_concrete"] = _make(0.12, func(t: float, n: float) -> float:
		return n * exp(-t * 70.0) * 0.9 + sin(TAU * 1900.0 * t) * exp(-t * 120.0) * 0.2, 0.92)
	streams["imp_wood"] = _make(0.14, func(t: float, n: float) -> float:
		return (sin(TAU * 310.0 * t) * 0.6 + sin(TAU * 540.0 * t) * 0.4) * exp(-t * 38.0) + n * exp(-t * 90.0) * 0.4, 0.6)
	streams["imp_metal"] = _make(0.5, func(t: float, n: float) -> float:
		return (sin(TAU * 880.0 * t) * 0.5 + sin(TAU * 1460.0 * t) * 0.35 + sin(TAU * 2310.0 * t) * 0.25) * exp(-t * 9.0) * 0.6 + n * exp(-t * 120.0) * 0.5, 0.8)
	streams["imp_fabric"] = _make(0.1, func(t: float, n: float) -> float:
		return n * exp(-t * 50.0) * 0.6, 0.2)
	streams["ricochet"] = _make(0.45, func(t: float, n: float) -> float:
		var f := 2600.0 - t * 2200.0 + sin(t * 90.0) * 60.0
		return sin(TAU * f * t) * exp(-t * 7.0) * 0.35 + n * exp(-t * 60.0) * 0.2, 0.9)
	streams["casing"] = _make(0.16, func(t: float, n: float) -> float:
		return (sin(TAU * 4100.0 * t) * 0.6 + sin(TAU * 6300.0 * t) * 0.4) * exp(-t * 32.0) * 0.5, 0.0)
	streams["mag_out"] = _make(0.22, func(t: float, n: float) -> float:
		return _click(t, 0.0, 2600.0) + n * smoothstep(0.03, 0.06, t) * exp(-(t - 0.06) * 30.0) * 0.25, 0.7)
	streams["mag_in"] = _make(0.2, func(t: float, n: float) -> float:
		return _click(t, 0.0, 1800.0) * 1.3 + _click(t, 0.05, 3200.0) * 0.6 + n * exp(-t * 80.0) * 0.4, 0.75)
	streams["bolt"] = _make(0.32, func(t: float, n: float) -> float:
		return _click(t, 0.0, 2200.0) + n * clampf(1.0 - absf(t - 0.09) * 25.0, 0.0, 1.0) * 0.3 + _click(t, 0.17, 1500.0) * 1.4, 0.75)
	streams["mag_drop"] = _make(0.25, func(t: float, n: float) -> float:
		return (sin(TAU * 620.0 * t) * 0.5 + sin(TAU * 1130.0 * t) * 0.3) * exp(-t * 22.0) + n * exp(-t * 60.0) * 0.5, 0.6)
	streams["gun_drop"] = _make(0.6, func(t: float, n: float) -> float:
		return (sin(TAU * 420.0 * t) * 0.5 + sin(TAU * 980.0 * t) * 0.3 + sin(TAU * 1720.0 * t) * 0.2) * exp(-t * 9.0) + n * exp(-t * 35.0) * 0.6, 0.5)
	streams["heartbeat"] = _make(0.9, func(t: float, n: float) -> float:
		return sin(TAU * 52.0 * t) * (exp(-t * 18.0) + exp(-maxf(t - 0.28, 0.0) * 22.0) * (1.0 if t > 0.28 else 0.0) * 0.8), 0.0)
	streams["click"] = _make(0.06, func(t: float, n: float) -> float:
		return _click(t, 0.0, 2400.0) * 0.6, 0.3)
	streams["alert"] = _make(0.42, func(t: float, n: float) -> float:
		var f := 880.0 if t < 0.12 else 1320.0
		return sin(TAU * f * t) * (0.4 if t < 0.36 else 0.0) * (1.0 - fmod(t, 0.12) / 0.4), 0.0)
	streams["stinger"] = _chord([55.0, 82.5, 110.0, 164.8], 2.6, 0.8)
	streams["win"] = _chord([110.0, 138.6, 164.8, 220.0, 277.2], 3.2, 1.6)
	streams["lose"] = _chord([55.0, 65.4, 82.4, 98.0], 3.2, 0.4)
	streams["ambience"] = _ambience()
	streams["smg"] = _gunshot(1.25, 0.8)
	streams["shot_heavy"] = _gunshot(0.8, 1.15)
	streams["shotgun"] = _boom(0.75, 1.25, 1.1)
	streams["explosion"] = _boom(2.0, 0.55, 1.6)
	streams["dash"] = _make(0.3, func(t: float, n: float) -> float:
		return n * sin(PI * t / 0.3) * 0.5 + _click(t, 0.25, 900.0) * 0.4, 0.75)
	streams["throw"] = _make(0.25, func(t: float, n: float) -> float:
		return n * sin(PI * t / 0.25) * 0.4, 0.6)
	streams["grenade_bounce"] = _make(0.2, func(t: float, n: float) -> float:
		return (sin(TAU * 700.0 * t) * 0.5 + sin(TAU * 1240.0 * t) * 0.3) * exp(-t * 26.0), 0.0)
	streams["pickup"] = _make(0.35, func(t: float, n: float) -> float:
		var f := 660.0 if t < 0.1 else (880.0 if t < 0.2 else 1320.0)
		return sin(TAU * f * t) * 0.35 * exp(-fmod(t, 0.1) * 12.0), 0.0)
	streams["objective"] = _chord([220.0, 277.2, 329.6, 440.0], 1.4, 1.2)
	streams["star"] = _make(0.45, func(t: float, n: float) -> float:
		return (sin(TAU * 1046.5 * t) + sin(TAU * 1568.0 * t) * 0.5) * 0.35 * exp(-t * 6.0), 0.0)
	streams["beep"] = _make(0.12, func(t: float, n: float) -> float:
		return sin(TAU * 1760.0 * t) * 0.4 * (1.0 if t < 0.09 else 0.0), 0.0)
	streams["ui_click"] = _make(0.08, func(t: float, n: float) -> float:
		return _click(t, 0.0, 1600.0) * 0.8 + n * exp(-t * 200.0) * 0.2, 0.4)
	streams["ui_hover"] = _make(0.05, func(t: float, n: float) -> float:
		return sin(TAU * 2400.0 * t) * exp(-t * 90.0) * 0.25, 0.0)


func _click(t: float, at: float, f: float) -> float:
	if t < at:
		return 0.0
	var u := t - at
	return sin(TAU * f * u) * exp(-u * 160.0) * 0.8


## Generic one-shot generator. f(t, noise) -> sample; lp = one-pole low-pass amount on the noise (0 = white).
func _make(dur: float, f: Callable, lp: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var y := 0.0
	for i in n:
		var t := float(i) / RATE
		var w := randf() * 2.0 - 1.0
		y = y * lp + w * (1.0 - lp)
		var s: float = f.call(t, y * (1.0 + lp * 2.0))
		s *= minf(1.0, (dur - t) * 60.0)
		data.encode_s16(i * 2, int(clampf(s, -1.0, 1.0) * 32000.0))
	return _wav(data)


func _gunshot(pitch: float, gain: float) -> AudioStreamWAV:
	var dur := 0.9
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var lp1 := 0.0
	var lp2 := 0.0
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var w := randf() * 2.0 - 1.0
		lp1 += (w - lp1) * 0.55
		lp2 += (w - lp2) * 0.06
		var crack := w * exp(-t * 900.0) * 1.2
		var body := lp1 * exp(-t * 28.0) * 0.9
		ph += TAU * (95.0 - t * 140.0) * pitch / RATE
		var thump := sin(ph) * exp(-t * 18.0) * 1.1
		var tail := lp2 * exp(-t * 4.5) * 1.6 * smoothstep(0.0, 0.05, t)
		var s := (crack + body + thump + tail) * gain
		s = tanh(s * 1.6) * 0.95
		data.encode_s16(i * 2, int(s * 32000.0))
	return _wav(data)


## Shotgun blasts and explosions: long low boom with a noisy crack and a rumbling tail.
func _boom(dur: float, pitch: float, gain: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var lp1 := 0.0
	var lp2 := 0.0
	var ph := 0.0
	for i in n:
		var t := float(i) / RATE
		var w := randf() * 2.0 - 1.0
		lp1 += (w - lp1) * 0.35
		lp2 += (w - lp2) * 0.03
		ph += TAU * (70.0 - t * 40.0) * pitch / RATE
		var s := w * exp(-t * 300.0) * 1.0 + lp1 * exp(-t * 14.0) * 1.1 + sin(ph) * exp(-t * 7.0) * 1.3 + lp2 * exp(-t * 2.2) * 2.2
		data.encode_s16(i * 2, int(tanh(s * gain * 1.4) * 0.95 * 32000.0))
	return _wav(data)


## Menu theme: slow minor pads over a soft pulse, 16 s loop.
func _menu_music() -> AudioStreamWAV:
	var dur := 16.0
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var chords := [[110.0, 130.8, 164.8], [87.3, 110.0, 130.8], [98.0, 123.5, 146.8], [82.4, 103.8, 123.5]]
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var ci := int(t / 4.0) % 4
		var lt := fmod(t, 4.0)
		var env := smoothstep(0.0, 1.2, lt) * (1.0 - smoothstep(3.2, 4.0, lt)) * 0.85 + 0.15
		var s := 0.0
		for f in chords[ci]:
			s += sin(TAU * f * t) * 0.18 + sin(TAU * f * 2.0 * t + sin(t * 0.7)) * 0.06
		s *= env
		var beat := fmod(t, 0.5)
		s += sin(TAU * 55.0 * t) * exp(-beat * 9.0) * 0.35
		lp += ((randf() * 2.0 - 1.0) - lp) * 0.02
		s += lp * exp(-fmod(t + 0.25, 0.5) * 30.0) * 0.4
		data.encode_s16(i * 2, int(clampf(s * 0.7, -1.0, 1.0) * 32000.0))
	var w := _wav(data)
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_end = n
	return w


## Mission bed: low tension drone with a heartbeat-like pulse, 8 s loop.
func _combat_bed() -> AudioStreamWAV:
	var dur := 8.0
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var t := float(i) / RATE
		var s := sin(TAU * 41.2 * t) * 0.25 + sin(TAU * 61.7 * t + sin(TAU * 0.25 * t) * 2.0) * 0.12
		s += sin(TAU * 82.4 * t) * 0.05 * (0.5 + 0.5 * sin(TAU * 0.125 * t))
		var beat := fmod(t, 1.0)
		s += sin(TAU * 48.0 * t) * (exp(-beat * 14.0) + exp(-maxf(beat - 0.22, 0.0) * 18.0) * (1.0 if beat > 0.22 else 0.0) * 0.6) * 0.45
		data.encode_s16(i * 2, int(clampf(s * 0.8, -1.0, 1.0) * 32000.0))
	var w := _wav(data)
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_end = n
	return w


func _chord(freqs: Array, dur: float, bright: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var t := float(i) / RATE
		var s := 0.0
		for k in freqs.size():
			var f: float = freqs[k]
			s += (sin(TAU * f * t) + sin(TAU * f * 2.003 * t) * 0.3 * bright + sin(TAU * f * 3.01 * t) * 0.12 * bright) / freqs.size()
		var env := smoothstep(0.0, 0.25, t) * exp(-t * 0.9)
		data.encode_s16(i * 2, int(clampf(s * env * 0.8, -1.0, 1.0) * 32000.0))
	return _wav(data)


func _ambience() -> AudioStreamWAV:
	var dur := 4.0
	var n := int(dur * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	var b := 0.0
	for i in n:
		var t := float(i) / RATE
		b = clampf(b + (randf() * 2.0 - 1.0) * 0.02, -1.0, 1.0) * 0.998
		var hum := sin(TAU * 50.0 * t) * 0.08 + sin(TAU * 100.0 * t) * 0.03
		data.encode_s16(i * 2, int(clampf(b * 0.6 + hum, -1.0, 1.0) * 32000.0))
	var w := _wav(data)
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_end = n
	return w


func _wav(data: PackedByteArray) -> AudioStreamWAV:
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w
