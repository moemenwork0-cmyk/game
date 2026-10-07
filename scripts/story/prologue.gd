class_name Prologue
extends Node3D
## The opening film, played in-engine the first time a player starts the game.
##
##   black — "Arabian Sea" — the Murjan in the storm — inside the wheelhouse:
##   the captain, his daughter Layla, Saeed on the radio, and you — faces up close —
##   "Rocks! Dead ahead!" — the hull hits the reef: slow motion, the crew thrown
##   by real physics, glass, darkness, red light — she goes down — underwater —
##   the surface, a wave, the island — black — words — the title — you wake up.
##
## Everything is real-time: the ship rides the actual ocean surface, the crew are
## mocap-animated Rocketbox actors with bone-driven faces that become ragdolls,
## the lamp and loose objects are rigid bodies. Hold Space / Esc to skip.

signal wake_ready
signal finished

const IMPACT_T := 41.5
const SPEED := 1.7

var ship: Node3D
var bridge: BridgeSet
var cam: Camera3D
var actors := {}
var _t := 0.0
var _cues: Array = []
var _shot := {}
var _shot_t := 0.0
var _heading := Vector3.ZERO
var _origin := Vector3.ZERO
var _impact := 0.0
var _sink := 0.0
var _shake := 0.0
var _done := false
var _skip_hold := 0.0
var _attrs: CameraAttributesPractical
var _fill: DirectionalLight3D
var _bolt: DirectionalLight3D
var _taa_before := false
var _bubbles: GPUParticles3D
var _spray: GPUParticles3D
var _shards: GPUParticles3D
var _radio_player: AudioStreamPlayer
var _drone_player: AudioStreamPlayer
var _rush_player: AudioStreamPlayer
var _music_player: AudioStreamPlayer
var _wreck_hidden: Node3D
var _surf_pos := Vector3.ZERO
var _wake_cam: Camera3D
var _wake_t := -1.0
var _wake_from := Transform3D()
var _player: Player
var _rng := RandomNumberGenerator.new()

# overlay
var _layer: CanvasLayer
var _black: ColorRect
var _bars: Array[ColorRect] = []
var _speaker: Label
var _line: Label
var _narr: Label
var _card: VBoxContainer
var _title: Label
var _title_font: FontVariation
var _callig: Label
var _tagline: Label
var _eyes: ColorRect
var _eyes_mat: ShaderMaterial
var _skip: Control

const L := {
	"sea": {"en": "ARABIAN SEA", "ar": "بحر العرب"},
	"night": {"en": "The twelfth night aboard the Murjan", "ar": "الليلة الثانية عشرة على متن «المرجان»"},
	"cap1": {"en": "Hold her steady! Everybody — hold on to something!", "ar": "ثبّتوها! الجميع… تمسّكوا بأي شيء!"},
	"saeed1": {"en": "Mayday, mayday, mayday… this is the Murjan. We are taking water. Does anyone hear me?",
		"ar": "نداء استغاثة… نداء استغاثة… هنا «المرجان». المياه تغمرنا. هل يسمعني أحد؟"},
	"layla1": {"en": "Father… nobody is answering. Nobody is coming.", "ar": "أبي… لا أحد يجيب. لن يأتي أحد."},
	"cap2": {"en": "Then we don't need anybody, Layla. We never did.", "ar": "إذن لا نحتاج أحدًا يا ليلى. لم نحتج أحدًا يومًا."},
	"cap3": {"en": "%s! Get below — check the pumps! NOW!", "ar": "%s! انزل إلى الأسفل — افحص المضخات! الآن!"},
	"saeed2": {"en": "CAPTAIN — ROCKS! DEAD AHEAD!", "ar": "يا قبطان — صخور! أمامنا مباشرة!"},
	"layla2": {"en": "BABA!", "ar": "بابا!"},
	"n1": {"en": "The sea took the Murjan.", "ar": "أخذ البحرُ «المرجان»."},
	"n2": {"en": "It took the crew. The cargo. The captain's daughter.", "ar": "أخذ البحّارة. والحمولة. وابنة القبطان."},
	"n3": {"en": "It took everything —", "ar": "أخذ كلّ شيء…"},
	"n4": {"en": "— except you.", "ar": "…إلا أنت."},
	"n5": {"en": "And it left you somewhere no map remembers.", "ar": "وتركك في مكانٍ لا تذكره أيّ خريطة."},
	"tag": {"en": "Every story is yours alone.", "ar": "وكل قصة لك وحدك."},
}


func _t_(k: String) -> String:
	return StoryData.t(L[k])


func _ready() -> void:
	_rng.randomize()
	Game.sfx.ensure_cinematic()
	Music.prepare()
	_wreck_hidden = get_tree().get_first_node_in_group("wreck")
	if _wreck_hidden:
		_wreck_hidden.visible = false
	Game.day_night.time_hours = 1.4
	Game.day_night.day_minutes = 900.0
	Game.weather.force("storm")
	Game.weather._lightning_t = 99.0   # the film calls its own lightning
	# the ship: intact, with the wheelhouse interior
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	ship = ShipBuilder.build_ship(rng, false, true)
	add_child(ship)
	bridge = ship.get_node("Bridge")
	var reef := Vector3(Wreck.POS.x, 0, Wreck.POS.z)
	_heading = -reef.normalized()
	var stop := reef - _heading * 7.0
	_origin = stop - _heading * SPEED * IMPACT_T
	_place_ship(0.0, 1.0)
	bridge.settle_free_bodies()
	_cast()
	cam = Camera3D.new()
	cam.top_level = true
	cam.far = 1500.0
	add_child(cam)
	cam.current = true
	_attrs = CameraAttributesPractical.new()
	cam.attributes = _attrs
	_fill = DirectionalLight3D.new()
	_fill.light_color = Color(0.45, 0.55, 0.8)
	_fill.light_energy = 0.3
	_fill.rotation = Vector3(-0.6, 2.4, 0)
	add_child(_fill)
	# lightning lights the whole world for an instant (the island, the sea, the hull)
	_bolt = DirectionalLight3D.new()
	_bolt.light_color = Color(0.75, 0.82, 1.0)
	_bolt.light_energy = 0.0
	_bolt.shadow_enabled = true
	_bolt.rotation = Vector3(-0.9, 0.6, 0)
	add_child(_bolt)
	# temporal AA for the film: it cleans up soft shadows, AO and fog noise
	_taa_before = get_viewport().use_taa
	get_viewport().use_taa = RenderingServer.get_current_rendering_method() == "forward_plus"
	_particles()
	_overlay()
	_drone_player = _loop("drone", -8.0, "Music")
	if "--clean" in OS.get_cmdline_user_args():
		_layer.visible = false
	_schedule()
	# debug: jump into the film (--skipto=seconds)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--skipto="):
			_t = float(a.trim_prefix("--skipto="))
			while not _cues.is_empty() and float(_cues[0][0]) < _t - 0.01:
				_cues.pop_front()


# ------------------------------------------------------------------ cast

func _cast() -> void:
	var b := BridgeSet
	var spec := {
		"captain": ["captain", Vector3(0, b.FLOOR, 8.85), 0.0, {"idle": "m_idle_drunk_01", "talk": "m_gestic_talk_excited_01", "angry": "m_idle_angry_01"}],
		"saeed": ["sailor", Vector3(-2.35, b.FLOOR, 9.55), -PI / 2, {"idle": "m_idle_nervous_01", "talk": "m_gestic_talk_nervous_01"}],
		"layla": ["layla", Vector3(2.15, b.FLOOR, 8.45), PI * 0.62, {"idle": "f_idle_nervous_01", "talk": "f_gestic_talk_femalestressed_01"}],
		"you": ["castaway", Vector3(1.1, b.FLOOR, 10.55), 0.25, {"idle": "m_idle_nervous_02", "listen": "m_gestic_listen_nervous_01"}],
	}
	for k in spec:
		var e: Array = spec[k]
		var a := Actor.create(e[0], e[3])
		bridge.add_child(a)
		a.position = e[1]
		a.rotation.y = e[2]
		a.play("idle", 0.0, 1.0, _rng.randf_range(0.0, 8.0))
		actors[k] = a
	actors["captain"].feel({"fear": 0.3, "anger": 0.4})
	actors["saeed"].feel({"fear": 0.7})
	actors["layla"].feel({"fear": 0.8, "sad": 0.3})
	actors["you"].feel({"fear": 0.5, "sad": 0.3})


# ------------------------------------------------------------------ timeline

func _schedule() -> void:
	var name_dict: Dictionary = Game.story.bio()["name"]
	var cap3 := {"en": L["cap3"]["en"] % name_dict["en"].to_upper(), "ar": L["cap3"]["ar"] % name_dict["ar"]}
	_cues = [
		[0.0, func() -> void: _black.color.a = 1.0],
		[1.0, func() -> void: _card_show(_t_("sea"), _t_("night"))],
		[6.2, func() -> void: _card_hide()],
		[7.4, func() -> void:
			_cut({"kind": "world_track", "off": Vector3(-34, 6, 12), "off2": Vector3(-26, 3.5, -4), "look": Vector3(0, 5, 0), "fov": 42.0, "dur": 6.0})
			_fade_black(0.0, 2.0)
			_bars_in()],
		[9.2, func() -> void: _lightning(1.0)],
		[10.6, func() -> void: Game.sfx.play("horn", ship.global_position + Vector3.UP * 12.0, 4.0, 0.0)],
		[13.0, func() -> void:
			_cut({"kind": "ship", "from": Vector3(-2.7, 9.75, 11.05), "to": Vector3(-2.2, 9.6, 10.6), "look": Vector3(0.4, 9.0, 7.3), "look2": Vector3(0.2, 9.1, 7.3), "fov": 52.0, "dur": 5.0})
			Game.sfx.muffled = 0.35
			Game.sfx.play("creak", null, -4.0)],
		[14.6, func() -> void: _say("captain", "CAPTAIN NASSER", L["cap1"], "talk", {"anger": 0.8, "fear": 0.4}, 1.3)],
		[18.2, func() -> void:
			_cut({"kind": "face", "who": "saeed", "dist": 0.95, "dist2": 0.8, "side": -0.22, "fov": 30.0, "dur": 5.0})
			_radio_player = _loop("radio", -14.0, "SFX")],
		[18.6, func() -> void: _say("saeed", "SAEED", L["saeed1"], "talk", {"fear": 0.9}, 1.0)],
		[23.2, func() -> void:
			if _radio_player:
				_radio_player.queue_free()
			_cut({"kind": "face", "who": "layla", "dist": 0.9, "dist2": 0.72, "side": 0.18, "fov": 30.0, "dur": 4.0})],
		[23.5, func() -> void: _say("layla", "LAYLA", L["layla1"], "talk", {"fear": 1.0, "sad": 0.6}, 0.8)],
		[27.2, func() -> void: _cut({"kind": "face", "who": "captain", "dist": 0.85, "dist2": 0.75, "side": 0.12, "fov": 30.0, "dur": 4.0})],
		[27.5, func() -> void: _say("captain", "CAPTAIN NASSER", L["cap2"], "angry", {"anger": 0.5, "sad": 0.7}, 0.6)],
		[30.8, func() -> void:
			actors["captain"].look_at_point(null)
			_say("captain", "CAPTAIN NASSER", cap3, "talk", {"anger": 1.0, "fear": 0.3}, 1.4)],
		[32.4, func() -> void:
			_cut({"kind": "face", "who": "you", "dist": 0.9, "dist2": 0.62, "side": -0.15, "fov": 28.0, "dur": 5.6})
			actors["you"].play("listen", 0.5)
			actors["you"].feel({"fear": 0.8, "sad": 0.7}, 1.5)
			Game.sfx.play("heartbeat", null, -6.0, 0.0)],
		[33.6, func() -> void: _inner(Game.story.bio()["memory"])],
		[35.4, func() -> void: Game.sfx.play("heartbeat", null, -4.0, 0.0)],
		[38.0, func() -> void:
			_cut({"kind": "ship", "from": Vector3(0.55, 9.6, 9.9), "to": Vector3(0.35, 9.55, 9.3), "look": Vector3(0.0, 9.35, 5.0), "look2": Vector3(0.0, 9.3, 5.0), "fov": 58.0, "dur": 3.5})
			Game.sfx.play("creak", null, -2.0)],
		[39.0, func() -> void:
			_lightning(1.0)
			for k in actors:
				actors[k].feel({"shock": 1.0, "fear": 0.8}, 0.2)],
		[39.4, func() -> void:
			_say("saeed", "SAEED", L["saeed2"], "talk", {"shock": 1.0}, 1.6)
			var wheel: Node3D = bridge.get_node("Wheel")
			wheel.create_tween().tween_property(wheel, "rotation:z", wheel.rotation.z + 5.0, 1.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)],
		[IMPACT_T, func() -> void: _do_impact()],
		[IMPACT_T + 0.5, func() -> void: _say("layla", "LAYLA", L["layla2"], "", {"pain": 1.0, "shock": 1.0}, 1.0)],
		[IMPACT_T + 2.6, func() -> void: _blackout()],
		[IMPACT_T + 4.0, func() -> void:
			Engine.time_scale = 1.0
			Game.sfx.muffled = 0.0
			_cut({"kind": "world_track", "off": Vector3(-30, 1.6, -14), "off2": Vector3(-24, 1.2, -10), "look": Vector3(0, 3, 0), "fov": 40.0, "dur": 5.0})
			var tw := create_tween()
			tw.tween_property(self, "_sink", 1.0, 11.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
			_rush_player = _loop("water_rush", -6.0, "SFX")],
		[IMPACT_T + 5.0, func() -> void: _lightning(0.9)],
		[IMPACT_T + 6.5, func() -> void: Game.sfx.play("groan", ship.global_position, 6.0, 0.1)],
		[IMPACT_T + 9.0, func() -> void:
			# underwater
			_cut({"kind": "under", "dur": 4.5})
			Game.sfx.muffled = 1.0
			Game.hud.set_underwater(1.0)
			_bubbles.emitting = true
			Game.sfx.play("heartbeat", null, -2.0, 0.0)],
		[IMPACT_T + 10.0, func() -> void: _lightning(0.8)],
		[IMPACT_T + 11.0, func() -> void: Game.sfx.play("heartbeat", null, 0.0, 0.0)],
		[IMPACT_T + 13.5, func() -> void:
			# the surface — the island — a wave takes you
			_bubbles.emitting = false
			Game.hud.set_underwater(0.0)
			Game.sfx.muffled = 0.0
			Game.sfx.play("gasp", null, 2.0, 0.0)
			Game.sfx.play("splash", null, 0.0)
			_surf_pos = ship.global_position + _heading.cross(Vector3.UP) * 9.0 + _heading * 4.0
			_cut({"kind": "surface", "dur": 4.5})
			Game.sfx.play("riser", null, -2.0, 0.0)],
		[IMPACT_T + 14.6, func() -> void: _lightning(1.0)],
		[IMPACT_T + 18.0, func() -> void:
			# the rocks — black
			_black.color.a = 1.0
			Game.sfx.play("impact", null, -2.0, 0.0)
			Game.sfx.play("boom", null, 0.0, 0.0, "Music")
			Game.sfx.play("ring", null, -6.0, 0.0)
			if _rush_player:
				_rush_player.queue_free()
			AudioServer.set_bus_mute(AudioServer.get_bus_index("Ambience"), true)
			_bars_out()
			_speaker.text = ""
			_line.text = ""],
		[IMPACT_T + 20.0, func() -> void: _narrate(_t_("n1"), 3.2)],
		[IMPACT_T + 23.6, func() -> void: _narrate(_t_("n2"), 3.6)],
		[IMPACT_T + 27.6, func() -> void: _narrate(_t_("n3"), 2.2)],
		[IMPACT_T + 30.0, func() -> void:
			_narrate(_t_("n4"), 3.0)
			Game.sfx.play("heartbeat", null, -4.0, 0.0)],
		[IMPACT_T + 33.6, func() -> void: _narrate(_t_("n5"), 3.8)],
		[IMPACT_T + 38.4, func() -> void: _show_title()],
		[IMPACT_T + 45.5, func() -> void: _hide_title()],
		[IMPACT_T + 47.0, func() -> void: _to_wake()],
	]


func _process(delta: float) -> void:
	if _done:
		return
	var real := delta / maxf(Engine.time_scale, 0.01)
	_t += real
	while not _cues.is_empty() and _t >= float(_cues[0][0]):
		var c: Callable = _cues.pop_front()[1]
		c.call()
	_shot_t += real
	_update_camera(real)
	_update_skip(real)
	if _wake_t >= 0.0:
		_update_wake(real)


func _physics_process(delta: float) -> void:
	if _done or ship == null or not is_instance_valid(ship):
		return
	_place_ship(delta, 0.0)


# ------------------------------------------------------------------ the ship on the sea

func _place_ship(delta: float, snap: float) -> void:
	var ocean := Game.ocean
	var travel := SPEED * minf(_t, IMPACT_T)
	var c := _origin + _heading * travel
	var side := _heading.cross(Vector3.UP)
	var half := ShipBuilder.LENGTH * 0.45
	var hb := ocean.get_height(c.x + _heading.x * half, c.z + _heading.z * half)
	var hs := ocean.get_height(c.x - _heading.x * half, c.z - _heading.z * half)
	var hp := ocean.get_height(c.x - side.x * 3.0, c.z - side.z * 3.0)
	var hst := ocean.get_height(c.x + side.x * 3.0, c.z + side.z * 3.0)
	var hc := ocean.get_height(c.x, c.z)
	var calm := 1.0 - _impact   # aground, the sea no longer lifts her
	var pitch := atan2(hb - hs, half * 2.0) * 0.8 * calm + _impact * 0.2 + _sink * 0.5
	var roll := atan2(hst - hp, 6.0) * 0.9 * calm + _impact * 0.32 + _sink * 0.25
	var draft := 2.3 + _sink * 15.0 - _impact * 1.2
	var yaw := atan2(-_heading.x, -_heading.z) + _impact * 0.12
	var target := Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch) * Basis(Vector3.FORWARD, roll),
		Vector3(c.x, (hb + hs + hc) / 3.0 * calm - draft, c.z))
	if snap > 0.0:
		ship.global_transform = target
		return
	# a heavy hull lags the water; at the moment of impact she is stopped dead
	var k := 1.0 - exp(-(9.0 if _impact > 0.0 and _impact < 0.95 else 2.0) * delta)
	ship.global_transform = ship.global_transform.interpolate_with(target, k)


func _do_impact() -> void:
	Engine.time_scale = 0.3
	_shake = 1.0
	var tw := create_tween()
	tw.tween_property(self, "_impact", 1.0, 0.35).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	Game.sfx.play("impact", null, 4.0, 0.0)
	Game.sfx.play("boom", null, -2.0, 0.0, "Music")
	Game.sfx.play("glass", null, -2.0, 0.0)
	bridge.shatter_front()
	_shards.global_transform = bridge.global_transform * Transform3D(Basis(), Vector3(0, 9.4, 7.1))
	_shards.restart()
	_spray.global_transform = bridge.global_transform * Transform3D(Basis(), Vector3(0, 9.5, 6.6))
	_spray.restart()
	var fwd: Vector3 = -ship.global_basis.z
	for k in actors:
		var a: Actor = actors[k]
		a.go_limp(fwd * _rng.randf_range(55.0, 80.0) + Vector3.UP * _rng.randf_range(10.0, 25.0) + ship.global_basis.x * _rng.randf_range(-15.0, 15.0))
	for rb in bridge.loose:
		rb.apply_central_impulse(fwd * rb.mass * 6.0 + Vector3.UP * rb.mass * 2.0)
	bridge.lamp_body.apply_central_impulse(fwd * 6.0)
	_cut({"kind": "ship", "from": Vector3(-0.3, 10.15, 11.25), "to": Vector3(-0.2, 10.0, 11.0), "look": Vector3(0.3, 8.5, 8.2), "look2": Vector3(0.3, 8.4, 7.9), "fov": 74.0, "dur": 3.0})
	for i in 4:
		get_tree().create_timer(0.25 + i * 0.3, true, false, true).timeout.connect(func() -> void: Game.sfx.play("bodyfall", null, -4.0))


func _blackout() -> void:
	# the lights fight, then die; the emergency lamp takes over
	var tw := create_tween()
	for i in 5:
		tw.tween_callback(func() -> void: bridge.set_power(false))
		tw.tween_interval(0.06)
		tw.tween_callback(func() -> void: bridge.set_power(true))
		tw.tween_interval(0.05 + i * 0.03)
	tw.tween_callback(func() -> void:
		bridge.set_power(false)
		var e := bridge.emergency
		var t2 := e.create_tween().set_loops(8)
		t2.tween_property(e, "light_energy", 2.5, 0.25)
		t2.tween_property(e, "light_energy", 0.4, 0.35))
	Game.sfx.play("creak", null, 0.0)


func _lightning(strength: float) -> void:
	Game.weather._flash = strength
	var bt := create_tween()
	bt.tween_property(_bolt, "light_energy", 3.0 * strength, 0.04)
	bt.tween_property(_bolt, "light_energy", 0.3, 0.1)
	bt.tween_property(_bolt, "light_energy", 2.4 * strength, 0.05)
	bt.tween_property(_bolt, "light_energy", 0.0, 0.7)
	if not bridge:
		return
	var l := bridge.lightning
	var tw := create_tween()
	tw.tween_property(l, "light_energy", 6.0 * strength, 0.04)
	tw.tween_property(l, "light_energy", 0.5, 0.08)
	tw.tween_property(l, "light_energy", 5.0 * strength, 0.05)
	tw.tween_property(l, "light_energy", 0.0, 0.5)
	get_tree().create_timer(0.35).timeout.connect(func() -> void: Game.sfx.play("thunder", null, 6.0, 0.05))


# ------------------------------------------------------------------ camera

func _cut(shot: Dictionary) -> void:
	_shot = shot
	_shot_t = 0.0
	var w: Variant = shot.get("who")
	_attrs.dof_blur_far_enabled = Settings.depth_of_field and shot["kind"] == "face"
	_attrs.dof_blur_far_distance = float(shot.get("dist", 1.0)) + 0.5
	_attrs.dof_blur_far_transition = 1.4
	_attrs.dof_blur_amount = 0.12
	cam.fov = float(shot.get("fov", 50.0))
	# no rain indoors
	if Game.weather._rain_fx:
		Game.weather._rain_fx.visible = not (shot["kind"] in ["ship", "face"])
	if w != null:
		for k in actors:
			actors[k].look_at_point(cam.global_position if k == w else null)


func _update_camera(delta: float) -> void:
	if _shot.is_empty() or _wake_t >= 0.0:
		return
	var u := clampf(_shot_t / float(_shot.get("dur", 4.0)), 0.0, 1.0)
	var e := u * u * (3.0 - 2.0 * u)
	var pos := Vector3.ZERO
	var look := Vector3.ZERO
	match String(_shot["kind"]):
		"ship":
			var xf := ship.global_transform
			pos = xf * (_shot["from"] as Vector3).lerp(_shot["to"], e)
			look = xf * (_shot["look"] as Vector3).lerp(_shot.get("look2", _shot["look"]), e)
		"face":
			var a: Actor = actors[_shot["who"]]
			var hb := a.skel.find_bone("Bip01 Head")
			var head := (a.skel.global_transform * a.skel.get_bone_global_pose(hb)).origin
			var fwd := -a.global_basis.z
			var right := a.global_basis.x
			var dist := lerpf(float(_shot["dist"]), float(_shot.get("dist2", _shot["dist"])), e)
			pos = head + fwd * dist + right * float(_shot.get("side", 0.0)) + a.global_basis.y * 0.03
			look = head + a.global_basis.y * 0.02
			_attrs.dof_blur_far_distance = dist + 0.4
		"world_track":
			var sp := ship.global_position
			var basis := Basis(Vector3.UP, atan2(-_heading.x, -_heading.z))
			pos = sp + basis * (_shot["off"] as Vector3).lerp(_shot["off2"], e)
			var wave := Game.ocean.get_height(pos.x, pos.z)
			pos.y = maxf(pos.y, wave + 1.0)
			look = sp + basis * (_shot["look"] as Vector3)
		"under":
			var sp2 := ship.global_position
			var side := _heading.cross(Vector3.UP)
			pos = sp2 + side * 10.0 + Vector3(0, lerpf(-7.0, -2.5, e), 0) + _heading * 3.0
			look = pos + Vector3(0, 6.0, 0) + _heading * lerpf(-6.0, 2.0, e)
			_bubbles.global_position = pos + (look - pos).normalized() * 2.5 + Vector3(0, -1.5, 0)
		"surface":
			# carried toward the island on the back of a wave
			var target := Vector3.ZERO
			var p := _surf_pos.lerp(_surf_pos + _heading * 24.0, e * e)
			p.y = Game.ocean.get_height(p.x, p.z) + 0.35
			pos = p
			look = Vector3(target.x, 4.0, target.z)
	# handheld camera: a slow drift, plus shake after the impact
	var t := _t
	var hand := Vector3(sin(t * 0.9) * 0.012, sin(t * 1.3 + 1.0) * 0.01, 0.0)
	_shake = maxf(_shake - delta * 0.5, 0.0)
	var sk := _shake * Settings.camera_shake
	hand += Vector3(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * 0.06 * sk
	cam.global_position = pos + hand
	if look.distance_to(cam.global_position) > 0.01:
		var up := ship.global_basis.y if _shot["kind"] == "ship" or _shot["kind"] == "face" else Vector3.UP
		cam.look_at(look, up.lerp(Vector3.UP, 0.6).normalized())


# ------------------------------------------------------------------ effects

func _particles() -> void:
	_bubbles = _make_particles(160, 4.0, Color(0.7, 0.85, 1.0, 0.5), 0.05, Vector3(0, 1, 0), 1.5, 2.5, Vector3(4, 1, 4))
	_spray = _make_particles(260, 1.8, Color(0.8, 0.88, 0.95, 0.6), 0.06, Vector3(0, 0.3, 1), 6.0, 10.0, Vector3(3, 0.6, 0.2))
	_shards = _make_particles(180, 2.2, Color(0.75, 0.85, 0.9, 0.7), 0.035, Vector3(0, 0.2, 1), 3.0, 7.0, Vector3(2.8, 0.5, 0.05))
	for p in [_spray, _shards]:
		p.one_shot = true
		p.emitting = false
		p.explosiveness = 0.85
	_bubbles.emitting = false


func _make_particles(n: int, life: float, col: Color, size: float, dir: Vector3, v0: float, v1: float, box: Vector3) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = n
	p.lifetime = life
	var pm := ParticleProcessMaterial.new()
	pm.direction = dir
	pm.spread = 35.0
	pm.initial_velocity_min = v0
	pm.initial_velocity_max = v1
	pm.gravity = Vector3(0, -9.8, 0) if dir.y < 0.9 else Vector3(0, 0.6, 0)
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = box
	pm.scale_min = 0.5
	pm.scale_max = 1.5
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = col
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED if dir.y > 0.9 else BaseMaterial3D.SHADING_MODE_PER_PIXEL
	m.roughness = 0.1
	if dir.y > 0.9:
		# bubbles: a soft ring
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.6, 0.85, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 0.05), Color(1, 1, 1, 0.15), Color(1, 1, 1, 0.9), Color(1, 1, 1, 0.0)])
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5)
		gt.fill_to = Vector2(1.0, 0.5)
		m.albedo_texture = gt
	q.material = m
	p.draw_pass_1 = q
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-20, -20, -20), Vector3(40, 40, 40))
	add_child(p)
	return p


func _loop(id: String, vol: float, bus: String) -> AudioStreamPlayer:
	var ap := AudioStreamPlayer.new()
	ap.stream = Game.sfx.streams[id][0]
	ap.volume_db = vol
	ap.bus = bus
	add_child(ap)
	ap.play()
	return ap


# ------------------------------------------------------------------ overlay

func _overlay() -> void:
	_layer = CanvasLayer.new()
	_layer.layer = 7
	add_child(_layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.theme()
	_layer.add_child(root)
	_eyes = ColorRect.new()
	_eyes.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_eyes.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_eyes_mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type canvas_item;
uniform float open = 1.0;
void fragment() {
	vec2 p = UV - 0.5;
	float lid = open * 0.62 * (1.0 - 1.6 * p.x * p.x);
	float d = abs(p.y) - lid;
	float a = smoothstep(-0.06, 0.04, d);
	COLOR = vec4(0.0, 0.0, 0.0, a);
}"""
	_eyes_mat.shader = sh
	_eyes_mat.set_shader_parameter("open", 1.0)
	_eyes.material = _eyes_mat
	_eyes.visible = false
	root.add_child(_eyes)
	for top in [true, false]:
		var b := ColorRect.new()
		b.color = Color.BLACK
		b.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE if top else Control.PRESET_BOTTOM_WIDE)
		b.offset_top = 0
		b.offset_bottom = 0
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(b)
		_bars.append(b)
	_black = ColorRect.new()
	_black.color = Color(0, 0, 0, 1)
	_black.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_black.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_black)
	# dialogue: speaker in brass capitals, the line in salt white
	var sub := VBoxContainer.new()
	sub.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	sub.offset_top = -190
	sub.offset_bottom = -40
	sub.offset_left = 160
	sub.offset_right = -160
	sub.alignment = BoxContainer.ALIGNMENT_END
	sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(sub)
	_speaker = UiKit.label("", 17, UiKit.ACCENT)
	_speaker.add_theme_font_override("font", UiKit.display_font(700))
	_speaker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_child(_speaker)
	var fs: int = [22, 27, 32, 38][clampi(Settings.subtitle_size, 0, 3)]
	_line = UiKit.label("", fs, UiKit.SALT)
	_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_line.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.9))
	_line.add_theme_constant_override("shadow_outline_size", 8)
	sub.add_child(_line)
	# narration on black
	_narr = UiKit.label("", 46, UiKit.SALT)
	_narr.add_theme_font_override("font", UiKit.story_font(500))
	_narr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_narr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_narr.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_narr.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_narr.offset_left = 200
	_narr.offset_right = -200
	_narr.modulate.a = 0.0
	root.add_child(_narr)
	# location card
	_card = VBoxContainer.new()
	_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	_card.alignment = BoxContainer.ALIGNMENT_CENTER
	_card.add_theme_constant_override("separation", 10)
	_card.modulate.a = 0.0
	root.add_child(_card)
	# title
	var tv := VBoxContainer.new()
	tv.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tv.alignment = BoxContainer.ALIGNMENT_CENTER
	tv.add_theme_constant_override("separation", 0)
	tv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(tv)
	_title_font = FontVariation.new()
	_title_font.base_font = UiKit.display_font(500)
	_title_font.spacing_glyph = 60
	_title = UiKit.label("JAZIRA", 120, UiKit.SALT)
	_title.add_theme_font_override("font", _title_font)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.modulate.a = 0.0
	tv.add_child(_title)
	_callig = UiKit.label("جزيرة", 70, UiKit.ACCENT)
	_callig.add_theme_font_override("font", UiKit.calligraphy_font())
	_callig.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_callig.modulate.a = 0.0
	tv.add_child(_callig)
	_tagline = UiKit.label(_t_("tag"), 24, UiKit.MUTED)
	_tagline.add_theme_font_override("font", UiKit.story_font(500))
	_tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tagline.modulate.a = 0.0
	tv.add_child(_tagline)
	# skip ring
	_skip = Control.new()
	_skip.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	_skip.offset_left = -330
	_skip.offset_top = -64
	_skip.offset_right = -30
	_skip.offset_bottom = -24
	_skip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_skip.modulate.a = 0.0
	root.add_child(_skip)
	_skip.draw.connect(func() -> void:
		var c := Vector2(_skip.size.x - 16, _skip.size.y * 0.5)
		_skip.draw_arc(c, 12, 0, TAU, 32, Color(1, 1, 1, 0.2), 2.0, true)
		_skip.draw_arc(c, 12, -PI / 2, -PI / 2 + TAU * clampf(_skip_hold, 0.0, 1.0), 32, UiKit.ACCENT, 2.5, true)
		_skip.draw_string(UiKit.font(), Vector2(0, c.y + 6), tr("Hold SPACE to skip"), HORIZONTAL_ALIGNMENT_RIGHT, _skip.size.x - 40, 16, Color(1, 1, 1, 0.6)))


func _bars_in() -> void:
	var h := get_viewport().get_visible_rect().size.y * 0.12
	for i in 2:
		var b := _bars[i]
		var tw := b.create_tween()
		if i == 0:
			tw.tween_property(b, "offset_bottom", h, 1.5)
		else:
			tw.tween_property(b, "offset_top", -h, 1.5)


func _bars_out() -> void:
	_bars[0].offset_bottom = 0
	_bars[1].offset_top = 0


func _fade_black(a: float, time: float) -> void:
	_black.create_tween().tween_property(_black, "color:a", a, time)


func _card_show(a: String, b: String) -> void:
	for c in _card.get_children():
		c.queue_free()
	var f := FontVariation.new()
	f.base_font = UiKit.display_font(600)
	f.spacing_glyph = 14
	var l1 := UiKit.label(a, 40, UiKit.SALT)
	l1.add_theme_font_override("font", f)
	l1.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card.add_child(l1)
	var r := UiKit.rule(280)
	r.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_card.add_child(r)
	var l2 := UiKit.label(b, 24, UiKit.MUTED)
	l2.add_theme_font_override("font", UiKit.story_font(500))
	l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card.add_child(l2)
	_card.create_tween().tween_property(_card, "modulate:a", 1.0, 1.6)


func _card_hide() -> void:
	_card.create_tween().tween_property(_card, "modulate:a", 0.0, 1.0)


func _say(who: String, speaker: String, text: Variant, clip: String, expr: Dictionary, energy: float) -> void:
	var s := StoryData.t(text)
	var a: Actor = actors[who]
	if a.ragdoll == null:
		if clip != "":
			a.play(clip, 0.4)
		a.feel(expr, 0.35)
		a.talk(1.0 + s.length() * 0.055, energy)
	if not Settings.subtitles:
		return
	_speaker.text = tr(speaker)
	_line.text = s
	_line.add_theme_font_override("font", UiKit.font("SemiBold"))
	_line.modulate.a = 1.0
	_speaker.modulate.a = 1.0
	var hold := 1.4 + s.length() * 0.06
	var tw := create_tween()
	tw.tween_interval(hold)
	tw.tween_property(_line, "modulate:a", 0.0, 0.4)
	tw.parallel().tween_property(_speaker, "modulate:a", 0.0, 0.4)


## The character's own thought, in the narrative face, no speaker name.
func _inner(text: Variant) -> void:
	if not Settings.subtitles:
		return
	_speaker.text = ""
	_line.text = StoryData.t(text)
	_line.add_theme_font_override("font", UiKit.story_font(500))
	_line.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_line, "modulate:a", 1.0, 0.6)
	tw.tween_interval(3.0)
	tw.tween_property(_line, "modulate:a", 0.0, 0.6)


func _narrate(text: String, hold: float) -> void:
	_narr.text = text
	_narr.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_narr, "modulate:a", 1.0, 1.0)
	tw.tween_interval(hold - 1.6)
	tw.tween_property(_narr, "modulate:a", 0.0, 0.6)


func _show_title() -> void:
	var m := Music.theme()
	if m:
		_music_player = AudioStreamPlayer.new()
		_music_player.stream = m
		_music_player.bus = "Music"
		_music_player.volume_db = -4.0
		add_child(_music_player)
		_music_player.play()
	if _drone_player:
		_drone_player.create_tween().tween_property(_drone_player, "volume_db", -40.0, 4.0)
	Game.sfx.play("boom", null, -6.0, 0.0, "Music")
	var tw := create_tween()
	tw.tween_property(_title, "modulate:a", 1.0, 2.5)
	tw.parallel().tween_property(_title_font, "spacing_glyph", 22, 6.5).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(_callig, "modulate:a", 1.0, 2.0).set_delay(1.4)
	tw.parallel().tween_property(_tagline, "modulate:a", 1.0, 2.0).set_delay(2.6)


func _hide_title() -> void:
	var tw := create_tween()
	for n in [_title, _callig, _tagline]:
		tw.parallel().tween_property(n, "modulate:a", 0.0, 1.4)


# ------------------------------------------------------------------ skip

func _update_skip(delta: float) -> void:
	if _wake_t >= 0.0:
		_skip.modulate.a = 0.0
		return
	var held := Input.is_action_pressed("jump") or Input.is_action_pressed("pause") or Input.is_key_pressed(KEY_ENTER)
	if held and _t > 1.0:
		_skip_hold += delta / 1.1
		_skip.modulate.a = 1.0
	else:
		_skip_hold = maxf(_skip_hold - delta * 2.0, 0.0)
		_skip.modulate.a = move_toward(_skip.modulate.a, 0.0, delta)
	if Input.is_anything_pressed() and _t > 1.0 and _skip_hold == 0.0:
		_skip.modulate.a = 1.0
	_skip.queue_redraw()
	if _skip_hold >= 1.0:
		_skip_hold = 0.0
		_cues.clear()
		_black.color.a = 1.0
		_narr.modulate.a = 0.0
		_hide_title()
		_to_wake()


# ------------------------------------------------------------------ waking up

func _to_wake() -> void:
	if _wake_t >= 0.0:
		return
	Engine.time_scale = 1.0
	_cues.clear()
	_black.color.a = 1.0
	_speaker.text = ""
	_line.text = ""
	_bars_out()
	Game.hud.set_underwater(0.0)
	Game.sfx.muffled = 1.0
	AudioServer.set_bus_mute(AudioServer.get_bus_index("Ambience"), false)
	for p in [_radio_player, _rush_player, _drone_player]:
		if p and is_instance_valid(p):
			p.queue_free()
	if ship:
		ship.queue_free()
		ship = null
	actors.clear()
	_fill.queue_free()
	_bolt.queue_free()
	get_viewport().use_taa = _taa_before
	if Game.weather._rain_fx:
		Game.weather._rain_fx.visible = true
	if _wreck_hidden:
		_wreck_hidden.visible = true
	wake_ready.emit()


## Called by Main once the player stands on the beach (morning, calm sea).
func begin_wake(player: Player) -> void:
	_player = player
	_wake_cam = Camera3D.new()
	_wake_cam.fov = Settings.fov
	_wake_cam.far = 1500.0
	var wa := CameraAttributesPractical.new()
	wa.dof_blur_far_enabled = true
	wa.dof_blur_far_distance = 0.5
	wa.dof_blur_far_transition = 2.0
	wa.dof_blur_amount = 0.16
	_wake_cam.attributes = wa
	add_child(_wake_cam)
	# lying on the sand, cheek down, the sea sideways in front of you
	var eye := player.camera.global_transform
	var ground := player.global_position
	var look_dir := -eye.basis.z
	look_dir.y = 0.0
	look_dir = look_dir.normalized()
	var p := ground + Vector3(0, 0.22, 0) - look_dir * 0.3
	_wake_from = Transform3D(Basis.looking_at(look_dir + Vector3(0, 0.05, 0), Vector3.UP) * Basis(Vector3.FORWARD, 1.35), p)
	_wake_cam.global_transform = _wake_from
	_wake_cam.current = true
	_eyes.visible = true
	_eyes_mat.set_shader_parameter("open", 0.0)
	_black.create_tween().tween_property(_black, "color:a", 0.0, 0.6)
	_wake_t = 0.0
	Game.sfx.play("ring", null, -14.0, 0.0)


func _update_wake(delta: float) -> void:
	_wake_t += delta
	var t := _wake_t
	# eyelids: a flutter, a failed attempt, then open
	var keys := [[0.0, 0.0], [1.2, 0.18], [1.7, 0.0], [2.8, 0.45], [3.2, 0.12], [4.4, 0.75], [5.0, 0.6], [6.0, 1.15]]
	var open := 0.0
	for i in keys.size() - 1:
		if t >= keys[i][0] and t < keys[i + 1][0]:
			var u: float = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])
			open = lerpf(keys[i][1], keys[i + 1][1], u * u * (3.0 - 2.0 * u))
	if t >= keys[-1][0]:
		open = 1.2
	_eyes_mat.set_shader_parameter("open", open)
	(_wake_cam.attributes as CameraAttributesPractical).dof_blur_amount = lerpf(0.16, 0.0, clampf((t - 3.0) / 4.0, 0.0, 1.0))
	Game.sfx.muffled = clampf(1.0 - t / 5.0, 0.0, 1.0)
	if t > 1.0 and t - delta <= 1.0:
		Game.sfx.play("gasp", null, -4.0, 0.0)
	if t > 3.4 and t - delta <= 3.4:
		Game.sfx.play("cough", null, -2.0, 0.0)
	if t > 7.4 and t - delta <= 7.4:
		Game.sfx.play("cough", null, -6.0, 0.0)
	# getting up: roll level, push up, stand
	var g := clampf((t - 5.5) / 4.5, 0.0, 1.0)
	var ge := g * g * (3.0 - 2.0 * g)
	var target := _player.camera.global_transform
	_wake_cam.global_transform = _wake_from.interpolate_with(target, ge)
	if t > 10.4:
		_player.camera.current = true
		_eyes.visible = false
		Game.sfx.muffled = 0.0
		_done = true
		finished.emit()
		queue_free()
