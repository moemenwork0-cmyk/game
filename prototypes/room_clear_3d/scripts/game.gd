extends Node
## Global state (autoload "Game"): campaign definition, progress + stars, rank / XP,
## selected weapon, settings (quality, aim assist, volume, FPS counter) and scene changes.

const SAVE_PATH := "user://roomclear.cfg"

## type: eliminate | clear | intel | rescue | defuse
const MISSIONS := [
	{"name": "FIRST CONTACT", "type": "eliminate", "seed": 1101, "rooms": 4, "enemies": 2, "brief": "A smuggler is hiding in a small safehouse. Take him down."},
	{"name": "DEAD DROP", "type": "intel", "seed": 2207, "rooms": 5, "enemies": 3, "brief": "Grab the laptop with the courier routes and get out."},
	{"name": "CLEAN SWEEP", "type": "clear", "seed": 3313, "rooms": 6, "enemies": 4, "brief": "Hostile cell inside. Clear every room."},
	{"name": "SILENT NIGHT", "type": "eliminate", "seed": 4421, "rooms": 6, "enemies": 4, "brief": "The cell leader sleeps on site. He does not wake up."},
	{"name": "LAST WITNESS", "type": "rescue", "seed": 5531, "rooms": 7, "enemies": 5, "brief": "A journalist is held captive. Free her and lead her out alive."},
	{"name": "TICKING", "type": "defuse", "seed": 6619, "rooms": 7, "enemies": 5, "time": 140, "brief": "A device is armed in the building. Defuse it before it blows."},
	{"name": "HEAVY METAL", "type": "clear", "seed": 7727, "rooms": 8, "enemies": 6, "heavy": 1, "brief": "Armoured gunmen guard the depot. Leave no one standing."},
	{"name": "BROKEN ARROW", "type": "intel", "seed": 8837, "rooms": 8, "enemies": 6, "heavy": 1, "brief": "Recover the stolen launch codes from their command room."},
	{"name": "THE GENERAL", "type": "eliminate", "seed": 9941, "rooms": 9, "enemies": 7, "heavy": 2, "brief": "The warlord himself. Heavy escort. End it."},
	{"name": "NO ONE LEFT BEHIND", "type": "rescue", "seed": 10357, "rooms": 9, "enemies": 7, "heavy": 1, "brief": "One of ours is held deep inside. Bring him home."},
	{"name": "COUNTDOWN", "type": "defuse", "seed": 11471, "rooms": 10, "enemies": 8, "heavy": 2, "time": 170, "brief": "Second device, bigger building, less time."},
	{"name": "ROOM CLEAR", "type": "clear", "seed": 12583, "rooms": 11, "enemies": 10, "heavy": 2, "brief": "The final stronghold. Every room. Every hostile."},
]

const TYPE_INFO := {
	"eliminate": {"title": "ELIMINATE THE TARGET", "icon": "targeted"},
	"clear": {"title": "CLEAR ALL HOSTILES", "icon": "multiple-targets"},
	"intel": {"title": "RECOVER THE INTEL", "icon": "laptop"},
	"rescue": {"title": "RESCUE THE HOSTAGE", "icon": "handcuffed"},
	"defuse": {"title": "DEFUSE THE BOMB", "icon": "time-bomb"},
}

const RANKS := ["RECRUIT", "PRIVATE", "CORPORAL", "SERGEANT", "LIEUTENANT", "CAPTAIN", "MAJOR", "COLONEL", "GENERAL"]

var quality := 1            ## 0 low, 1 medium, 2 high
var aim_assist := true
var show_fps := false
var volume := 0.8
var weapon := "rifle"
var stars := {}             ## mission index -> best stars
var xp := 0
var current := 0            ## mission index, -1 = quick op
var quick_seed := 0
var last_result := {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	quality = _detect_quality()
	_load()
	apply_settings()


func _detect_quality() -> int:
	if OS.has_feature("web_android") or OS.has_feature("web_ios"):
		return 0
	if OS.has_feature("web") or OS.has_feature("mobile"):
		return 1
	return 2


func is_phone() -> bool:
	return OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")


func apply_settings() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(volume, 0.001)))
	Engine.max_fps = 60 if quality < 2 else 0


# ------------------------------------------------------------------ progress

func unlocked(i: int) -> bool:
	return i == 0 or stars.has(i - 1)


func total_stars() -> int:
	var t := 0
	for k in stars:
		t += int(stars[k])
	return t


func completed_count() -> int:
	return stars.size()


func weapon_unlocked(id: String) -> bool:
	var u: int = Weapons.get_def(id)["unlock"]
	return u == 0 or stars.has(u - 1)


func rank_index() -> int:
	return clampi(int(sqrt(xp / 120.0)), 0, RANKS.size() - 1)


func rank_name() -> String:
	return RANKS[rank_index()]


func rank_progress() -> float:
	var r := rank_index()
	if r >= RANKS.size() - 1:
		return 1.0
	var a := r * r * 120.0
	var b := (r + 1) * (r + 1) * 120.0
	return clampf((xp - a) / (b - a), 0.0, 1.0)


func mission_def() -> Dictionary:
	if current >= 0:
		return MISSIONS[current]
	var rng := RandomNumberGenerator.new()
	rng.seed = quick_seed
	var types := ["eliminate", "clear", "intel", "rescue", "defuse"]
	var rooms := rng.randi_range(5, 10)
	return {"name": "QUICK OP #%d" % (quick_seed % 10000), "type": types[rng.randi() % types.size()], "seed": quick_seed,
		"rooms": rooms, "enemies": rooms - rng.randi_range(0, 2), "heavy": rng.randi_range(0, 2),
		"time": 150 + rooms * 5, "brief": "Randomly generated operation. Adapt and overcome."}


## Records a finished mission; returns {"xp": gained, "unlocks": [weapon ids], "new_rank": bool}
func record(win: bool, star_count: int, score: int) -> Dictionary:
	var before := rank_index()
	var unlocks := []
	var gained := int(score / 10) + (60 if win else 10)
	xp += gained
	if win and current >= 0:
		var had := stars.has(current)
		stars[current] = maxi(int(stars.get(current, 0)), star_count)
		if not had:
			for id in Weapons.ORDER:
				if int(Weapons.get_def(id)["unlock"]) == current + 1:
					unlocks.append(id)
	save()
	return {"xp": gained, "unlocks": unlocks, "new_rank": rank_index() > before}


func save() -> void:
	var c := ConfigFile.new()
	c.set_value("p", "stars", stars)
	c.set_value("p", "xp", xp)
	c.set_value("p", "weapon", weapon)
	c.set_value("s", "quality", quality)
	c.set_value("s", "aim_assist", aim_assist)
	c.set_value("s", "show_fps", show_fps)
	c.set_value("s", "volume", volume)
	c.save(SAVE_PATH)


func _load() -> void:
	var c := ConfigFile.new()
	if c.load(SAVE_PATH) != OK:
		return
	stars = c.get_value("p", "stars", {})
	xp = c.get_value("p", "xp", 0)
	weapon = c.get_value("p", "weapon", "rifle")
	quality = c.get_value("s", "quality", quality)
	aim_assist = c.get_value("s", "aim_assist", true)
	show_fps = c.get_value("s", "show_fps", false)
	volume = c.get_value("s", "volume", 0.8)
	if not weapon_unlocked(weapon):
		weapon = "rifle"


# ------------------------------------------------------------------ scenes

func start_mission(i: int) -> void:
	current = i
	if i < 0:
		quick_seed = randi() % 900000 + 1000
	_go("res://scenes/game.tscn")


func to_menu() -> void:
	_go("res://scenes/menu.tscn")


func _go(path: String) -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	get_tree().change_scene_to_file(path)
