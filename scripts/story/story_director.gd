class_name StoryDirector
extends Node
## Runs the narrative. Each new game rolls who you are and why the Murjan sank,
## then reacts to what you do: missions, an inner voice that speaks at the right
## moments, a journal that writes itself, random events with choices, and an
## Act One finale that differs per mystery and per decision.

const D := preload("res://scripts/story/story_data.gd")

var backstory := "engineer"
var mystery := "cargo"
var mission := 0
var flags := {}
var journal: Array = []          # [{day, time, text}]
var letters_read: Array = []     # "pool:index"
var logs_collected := 0
var start_pos := Vector3.ZERO
var start_day := 1
var current_line := ""
var line_alpha := 0.0
var _queue: Array[String] = []
var _line_t := 0.0
var _voice_cd := {}
var _event_hours := 5.0
var _rng := RandomNumberGenerator.new()
var _last_state := ""
var _last_hour := -1
var _ship_t := 0.0
var _hallucinate: Hallucinations


func _ready() -> void:
	_rng.randomize()
	_hallucinate = Hallucinations.new()
	add_child(_hallucinate)


# ---------------------------------------------------------------- lifecycle

func start_new() -> void:
	var keys := D.BACKSTORIES.keys()
	backstory = keys[_rng.randi() % keys.size()]
	mystery = D.MYSTERIES[_rng.randi() % D.MYSTERIES.size()]
	mission = 0
	flags = {}
	journal = []
	letters_read = []
	logs_collected = 0
	start_day = Game.day_number
	if Game.player:
		start_pos = Game.player.global_position
	var bs: Dictionary = D.BACKSTORIES[backstory]
	add_journal({"en": "I am %s. %s." % [bs["name"]["en"], bs["role"]["en"]],
		"ar": "أنا %s. %s." % [bs["name"]["ar"], bs["role"]["ar"]]})
	add_journal(bs["memory"])


func to_dict() -> Dictionary:
	return {"backstory": backstory, "mystery": mystery, "mission": mission, "flags": flags.duplicate(),
		"journal": journal.duplicate(true), "letters": letters_read.duplicate(), "logs": logs_collected,
		"start_pos": start_pos, "start_day": start_day, "event_hours": _event_hours}


func from_dict(d: Dictionary) -> void:
	backstory = String(d.get("backstory", "engineer"))
	mystery = String(d.get("mystery", "cargo"))
	mission = int(d.get("mission", 0))
	flags = Dictionary(d.get("flags", {})).duplicate()
	journal = Array(d.get("journal", [])).duplicate(true)
	letters_read = Array(d.get("letters", [])).duplicate()
	logs_collected = int(d.get("logs", 0))
	start_pos = d.get("start_pos", Vector3.ZERO)
	start_day = int(d.get("start_day", 1))
	_event_hours = float(d.get("event_hours", 5.0))


func bio() -> Dictionary:
	return D.BACKSTORIES[backstory]


func mission_def() -> Dictionary:
	return D.MISSIONS[mini(mission, D.MISSIONS.size() - 1)]


func act_over() -> bool:
	return flags.get("act1_done", false)


# ---------------------------------------------------------------- voice & journal

## Queues a line of inner monologue (subtitle) and optionally writes it in the journal.
func say(text: Variant, write: bool = true) -> void:
	var s := D.t(text)
	if s == "":
		return
	_queue.append(s)
	if write:
		add_journal(text)


func add_journal(text: Variant) -> void:
	var t := Game.day_night.time_hours if Game.day_night else 7.0
	journal.append({"day": Game.day_number, "time": t, "text": text})


## Situational line with a cooldown (in game hours) so it never nags.
func voice(key: String, cooldown: float = 10.0) -> void:
	var now := Game.day_number * 24.0 + (Game.day_night.time_hours if Game.day_night else 0.0)
	if now < float(_voice_cd.get(key, -999.0)):
		return
	_voice_cd[key] = now + cooldown
	var lines: Array = D.VOICE.get(key, [])
	if not lines.is_empty():
		say(lines[_rng.randi() % lines.size()])


func _process(delta: float) -> void:
	# subtitles
	if current_line == "" and not _queue.is_empty():
		current_line = _queue.pop_front()
		_line_t = 2.5 + current_line.length() * 0.055
	if current_line != "":
		_line_t -= delta
		line_alpha = clampf(minf(_line_t, 4.0 - _line_t + (_line_t - 4.0) * 0.0), 0.0, 1.0)
		line_alpha = clampf(_line_t, 0.0, 1.0)
		if _line_t <= 0.0:
			current_line = ""
	if not Game.playing or Game.player == null or get_tree().paused:
		return
	var hours := Game.day_night.last_hours_step
	_check_mission()
	_situational()
	_storyteller(hours, delta)
	_hallucinate.intensity = clampf((35.0 - Game.player.vitals.morale) / 30.0, 0.0, 1.0)


# ---------------------------------------------------------------- missions

func _complete(id: String) -> void:
	var m := mission_def()
	if String(m["id"]) != id:
		return
	if m.has("done"):
		say(m["done"])
	Game.player.vitals.cheer(10.0)
	Game.sfx.play("ui", null, -4.0)
	mission += 1
	_on_mission_start()


func _on_mission_start() -> void:
	var m := mission_def()
	Game.toast.emit(D.t({"en": "New objective: ", "ar": "هدف جديد: "}) + D.t(m["title"]))
	if m.has("start"):
		say(m["start"])
	if String(m["id"]) == "wreck" and Game.hud:
		Game.hud.ping_objective()


func on_item(id: String, n: int) -> void:
	if id == "log":
		logs_collected += n
	if id == "fish_raw" and not flags.get("first_fish", false):
		flags["first_fish"] = true
		voice("first_fish", 1.0)


func on_event(e: String) -> void:
	match e:
		"drink":
			flags["drank"] = true
		"tree_felled":
			if not flags.get("first_tree", false):
				flags["first_tree"] = true
				voice("first_tree", 1.0)
		"collapse":
			voice("collapse", 6.0)


func _check_mission() -> void:
	var p := Game.player
	match String(mission_def()["id"]):
		"alive":
			if p.global_position.distance_to(start_pos) > 8.0:
				_complete("alive")
		"thirst":
			if flags.get("drank", false):
				_complete("thirst")
		"wood":
			if logs_collected >= 3 or Game.count("log") >= 3:
				_complete("wood")
		"fire":
			if get_tree().get_nodes_in_group("campfires").size() > 0:
				_complete("fire")
		"night":
			var t := Game.day_night.time_hours
			if Game.day_number > start_day and t >= 6.0 and t < 12.0:
				_complete("night")
		"wreck":
			if flags.get("wreck_found", false):
				_complete("wreck")
		"shelter":
			if Game.structures.pieces.size() >= 4 or get_tree().get_nodes_in_group("beds").size() > 0:
				_complete("shelter")
		"signal":
			for c in get_tree().get_nodes_in_group("campfires"):
				if (c as Node3D).global_position.y > 7.0:
					_complete("signal")
					break
		"finale":
			var t2 := Game.day_night.time_hours
			if (t2 >= 20.5 or t2 < 4.0) and not flags.get("finale_shown", false) and not Game.ui_open:
				flags["finale_shown"] = true
				_finale()


func on_crate_opened(crate: StoryCrate) -> void:
	if crate.story_key == "wreck":
		flags["wreck_found"] = true
		say(D.WRECK_FIND[mystery])
		Game.player.vitals.cheer(8.0)
	else:
		voice("crate", 4.0)


func read_letter(letter: Dictionary) -> void:
	add_journal(letter)
	Game.player.vitals.cheer(5.0)
	await Game.hud.choose(D.t(letter), [D.t({"en": "Fold the letter away", "ar": "اطوِ الرسالة"})])


# ---------------------------------------------------------------- situational voice

func _situational() -> void:
	var p := Game.player
	var v := p.vitals
	var t := Game.day_night.time_hours
	if t > 17.8 and t < 19.5 and p._fire_warmth() < 0.1:
		voice("dusk_no_fire", 20.0)
	if v.food < 15.0:
		voice("hungry", 12.0)
	if v.water < 15.0:
		voice("thirsty", 10.0)
	if v.body_temp < 35.5:
		voice("cold", 8.0)
	if v.morale < 25.0:
		voice("low_morale", 6.0)
	if v.health < 20.0 and not v.dead:
		voice("near_death", 6.0)
	var ws := Game.weather.state if Game.weather else "clear"
	if ws == "storm" and _last_state != "storm":
		voice("storm", 12.0)
	_last_state = ws
	# a new morning: a line, a journal entry, a little hope
	var hour := int(t)
	if hour == 6 and _last_hour == 5:
		voice("morning", 20.0)
		v.cheer(5.0)
	_last_hour = hour


# ---------------------------------------------------------------- storyteller

func _storyteller(hours: float, delta: float) -> void:
	if mission < 2:
		return
	_event_hours -= hours
	if _ship_t > 0.0:
		_ship_t -= delta
	if _event_hours > 0.0:
		return
	_event_hours = _rng.randf_range(4.0, 9.0)
	var options := ["crate", "crate", "bottle", "bottle"]
	if not flags.get("gull_spawned", false) and Game.day_number >= 2:
		options.append("gull")
	if Game.day_number >= 2 and Game.day_night.daylight > 0.6 and not flags.get("ship_day_%d" % Game.day_number, false):
		options.append("ship")
	if mystery == "survivor" and flags.get("wreck_found", false) and not flags.get("footprints", false):
		options.append("footprints")
	match options[_rng.randi() % options.size()]:
		"crate":
			_spawn_crate()
		"bottle":
			_spawn_bottle()
		"gull":
			_spawn_gull()
		"ship":
			_distant_ship()
		"footprints":
			_footprints()


func _beach_point() -> Vector3:
	for i in 60:
		var a := _rng.randf() * TAU
		for r in range(30, 14, -1):
			var x := cos(a) * r
			var z := sin(a) * r
			var h := Game.world.surface_height(x, z)
			if h > 0.5 and h < 1.6:
				return Vector3(x, h, z)
	return Game.player.global_position + Vector3(3, 0, 0)


func _spawn_crate() -> void:
	if get_tree().get_nodes_in_group("story_crates").filter(func(c: Node) -> bool: return not c.opened).size() >= 3:
		return
	var loot := [{"plank": _rng.randi_range(4, 8)}, {"tin": _rng.randi_range(1, 2)}, {"waterbottle": _rng.randi_range(1, 2)},
		{"medkit": 1}, {"log": 2, "tin": 1}, {"waterbottle": 1, "plank": 3}]
	StoryCrate.create(_beach_point(), loot[_rng.randi() % loot.size()])
	Game.toast.emit(D.t({"en": "Something washed ashore…", "ar": "قذف البحر شيئًا إلى الشاطئ…"}))


func _spawn_bottle() -> void:
	var pools := [mystery, "common"]
	for pool in pools:
		var arr: Array = D.LETTERS[pool]
		for i in arr.size():
			var key := "%s:%d" % [pool, i]
			if not letters_read.has(key):
				letters_read.append(key)
				var p := _beach_point()
				MessageBottle.create(p + Vector3(0, 0.05, 0), arr[i])
				Game.toast.emit(D.t({"en": "A bottle glints in the surf.", "ar": "زجاجة تلمع بين الأمواج."}))
				return


func _spawn_gull() -> void:
	flags["gull_spawned"] = true
	var p := _beach_point()
	Gull.create(Game.props, p + Vector3(0, 0.12, 0), "injured")
	Game.toast.emit(D.t({"en": "A bird is crying somewhere on the beach.", "ar": "طائر يصرخ في مكان ما على الشاطئ."}))


func gull_choice(g: Gull) -> void:
	var opts := [D.t(D.GULL["feed"]), D.t(D.GULL["eat"]), D.t(D.GULL["leave"])]
	var pick: int = await Game.hud.choose(D.t(D.GULL["text"]), opts)
	match pick:
		0:
			if Game.count("berry") >= 2:
				Game.take({"berry": 2})
				flags["gull_friend"] = true
				say(D.GULL["fed"])
				Game.player.vitals.cheer(15.0)
				Gull.create(Game.props, g.global_position + Vector3(0, 2, 0), "friend")
				g.queue_free()
			else:
				Game.toast.emit(D.t({"en": "You need 2 berries.", "ar": "تحتاج إلى حبّتي توت."}))
		1:
			Game.player.vitals.food = minf(Game.player.vitals.food + 18.0, 100.0)
			Game.player.vitals.cheer(-12.0)
			flags["gull_eaten"] = true
			say(D.GULL["ate"])
			g.queue_free()
		_:
			flags["gull_left"] = true
			say(D.GULL["left"])
			g.queue_free()


func _distant_ship() -> void:
	flags["ship_day_%d" % Game.day_number] = true
	var ship := DistantShip.new()
	get_parent().add_child(ship)
	ship.saw_signal.connect(func() -> void:
		flags["ship_saw_signal"] = true
		Game.player.vitals.cheer(25.0)
		say({"en": "The horn — twice, long. They answered. They SAW the fire. Someone knows I'm here.",
			"ar": "البوق… مرتين، طويلتين. ردّوا عليّ. رأوا النار. أحدٌ ما يعرف الآن أنني هنا."}))
	ship.passed.connect(func() -> void:
		if not flags.get("ship_saw_signal", false):
			voice("ship_passed", 1.0)
			Game.player.vitals.cheer(-10.0))
	Game.toast.emit(D.t({"en": "A ship on the horizon!", "ar": "سفينة في الأفق!"}))


func _footprints() -> void:
	flags["footprints"] = true
	var start := _beach_point()
	var dir := Vector3(-start.x, 0, -start.z).normalized().rotated(Vector3.UP, 1.2)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.45, 0.38, 0.28)
	mat.roughness = 1.0
	for i in 14:
		var p := start + dir * i * 0.7 + dir.cross(Vector3.UP) * (0.14 if i % 2 == 0 else -0.14)
		p.y = Game.world.surface_height(p.x, p.z) + 0.01
		var fp := MeshInstance3D.new()
		var q := BoxMesh.new()
		q.size = Vector3(0.1, 0.01, 0.24)
		fp.mesh = q
		fp.material_override = mat
		Game.props.add_child(fp)
		fp.global_position = p
		fp.look_at(p + dir, Vector3.UP)
	say({"en": "Footprints. Small, barefoot — and they are not mine.", "ar": "آثار أقدام. صغيرة، حافية… وليست آثاري."})


func on_sleep() -> void:
	var v := Game.player.vitals
	if v.morale < 50.0:
		say(D.NIGHTMARE[_rng.randi() % D.NIGHTMARE.size()])
		v.cheer(-8.0)
		Game.sfx.play("heartbeat", null, -2.0, 0.0)


# ---------------------------------------------------------------- finale

func _finale() -> void:
	var f: Dictionary = D.FINALE[mystery]
	var props := []
	if mystery == "survivor":
		props.append(_cliff_fire())
	elif mystery == "cargo":
		props.append(_smuggler_boat())
	Game.sfx.play("heartbeat", null, -4.0, 0.0)
	var pick: int = await Game.hud.choose(D.t(f["text"]), [D.t(f["a"]), D.t(f["b"])])
	var res: Dictionary = f["ra"] if pick == 0 else f["rb"]
	add_journal(f["text"])
	say(res)
	var v := Game.player.vitals
	flags["finale_choice"] = "a" if pick == 0 else "b"
	match mystery + flags["finale_choice"]:
		"cargoa":
			flags["smugglers_know"] = true
			v.cheer(-12.0)
		"cargob":
			flags["smugglers_unaware"] = true
			Game.add_item("flare", 1)
		"survivora":
			v.hurt(15.0)
			v.cheer(18.0)
			flags["layla_close"] = true
		"survivorb":
			v.cheer(10.0)
		"nassera":
			flags["map_found"] = true
			v.cheer(6.0)
		"nasserb":
			flags["notebook_burned"] = true
			v.cheer(10.0)
	await get_tree().create_timer(12.0).timeout
	for n in props:
		if is_instance_valid(n):
			n.queue_free()
	flags["act1_done"] = true
	mission = D.MISSIONS.size()
	Game.hud.show_act_end(D.t(D.ACT_END), D.t(D.ACT_END_SUB), _choices_summary())
	SaveGame.save_now()


func _choices_summary() -> String:
	var lines := PackedStringArray()
	var bs := bio()
	lines.append(D.t(bs["name"]) + " — " + D.t(bs["role"]))
	if flags.get("gull_friend", false):
		lines.append(D.t({"en": "You saved the gull.", "ar": "أنقذتَ النورس."}))
	elif flags.get("gull_eaten", false):
		lines.append(D.t({"en": "You ate the gull.", "ar": "أكلتَ النورس."}))
	lines.append(D.t({"en": "Letters found: ", "ar": "رسائل وجدتها: "}) + str(letters_read.size()))
	lines.append(D.t({"en": "Days survived: ", "ar": "أيام النجاة: "}) + str(Game.day_number))
	return "\n".join(lines)


func _cliff_fire() -> Node3D:
	# the highest point on the north cliff
	var best := Vector3(0, -99, -15)
	for i in 200:
		var x := _rng.randf_range(-12.0, 12.0)
		var z := _rng.randf_range(-22.0, -8.0)
		var h := Game.world.surface_height(x, z)
		if h > best.y:
			best = Vector3(x, h, z)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.55, 0.25)
	light.omni_range = 14.0
	light.light_energy = 3.0
	get_parent().add_child(light)
	light.global_position = best + Vector3(0, 0.8, 0)
	var glow := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.25
	sm.height = 0.5
	var gm := StandardMaterial3D.new()
	gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	gm.albedo_color = Color(1.0, 0.6, 0.2)
	gm.emission_enabled = true
	gm.emission = Color(1.0, 0.5, 0.15)
	gm.emission_energy_multiplier = 6.0
	sm.material = gm
	glow.mesh = sm
	light.add_child(glow)
	return light


func _smuggler_boat() -> Node3D:
	var boat := Node3D.new()
	var hull := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(2.4, 1.0, 7.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.05, 0.06)
	bm.material = mat
	hull.mesh = bm
	boat.add_child(hull)
	var spot := SpotLight3D.new()
	spot.light_energy = 8.0
	spot.spot_range = 60.0
	spot.spot_angle = 12.0
	spot.position = Vector3(0, 1.4, -3.0)
	boat.add_child(spot)
	get_parent().add_child(boat)
	var w: Node3D = get_tree().get_first_node_in_group("wreck")
	var target := w.global_position if w else Vector3(30, 0, -30)
	boat.global_position = Vector3(target.x * 1.25, 0.3, target.z * 1.25)
	boat.look_at(Vector3(target.x, 0.3, target.z), Vector3.UP)
	spot.look_at(Game.player.global_position)
	var tw := boat.create_tween()
	tw.tween_property(boat, "global_position", Vector3(target.x * 1.08, 0.3, target.z * 1.08), 10.0)
	return boat
