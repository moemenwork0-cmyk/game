extends Node
## Global game state (autoload "Game").

signal inventory_changed
signal toast(text: String)

const L_TERRAIN := 1
const L_PROPS := 2
const L_PLAYER := 4
const L_STRUCT := 8
const L_TREES := 16

var world: VoxelWorld
var ocean: Ocean
var player: Player
var hud: Hud
var sfx: Sfx
var structures: StructureManager
var day_night: DayNight
var props: Node3D
var grass_density := 1.0
var day_number := 1
## set before reloading the scene: "" = show main menu, "new" = start fresh, "load" = continue the save
var start_mode := ""
var playing := false
var grass_range := 70.0

var inventory := {"log": 0, "plank": 0, "stone": 0, "dirt": 0, "sand": 0}

const ITEM_NAMES := {
	"log": "Log", "plank": "Plank", "stone": "Stone", "dirt": "Dirt", "sand": "Sand",
}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_input()


## Clears per-run state before the scene is rebuilt.
func reset() -> void:
	world = null
	ocean = null
	player = null
	hud = null
	structures = null
	day_night = null
	props = null
	playing = false
	day_number = 1
	inventory = {"log": 0, "plank": 0, "stone": 0, "dirt": 0, "sand": 0}


func restart(mode: String) -> void:
	start_mode = mode
	get_tree().paused = false
	reset()
	get_tree().reload_current_scene()


func add_item(id: String, n: int = 1, announce: bool = true) -> void:
	if n <= 0:
		return
	inventory[id] = int(inventory.get(id, 0)) + n
	inventory_changed.emit()
	if announce:
		toast.emit("+%d %s" % [n, ITEM_NAMES.get(id, id)])


func count(id: String) -> int:
	if id == "plank":
		return int(inventory["plank"]) + int(inventory["log"]) * 4
	return int(inventory.get(id, 0))


## Removes items; planks are sawn from logs automatically (1 log -> 4 planks).
func take(cost: Dictionary) -> bool:
	for id in cost:
		if count(id) < int(cost[id]):
			return false
	for id in cost:
		var n: int = int(cost[id])
		if id == "plank":
			while int(inventory["plank"]) < n:
				inventory["log"] = int(inventory["log"]) - 1
				inventory["plank"] = int(inventory["plank"]) + 4
		inventory[id] = int(inventory[id]) - n
	inventory_changed.emit()
	return true


func water_height(x: float, z: float) -> float:
	return ocean.get_height(x, z) if ocean else 0.0


## Called after any terrain modification so physics objects react.
func on_terrain_edited(center: Vector3, radius: float) -> void:
	if structures:
		structures.on_terrain_edited(center, radius)
	for t in get_tree().get_nodes_in_group("trees"):
		var tree: IslandTree = t
		if tree.global_position.distance_to(center) < radius + 2.0:
			tree.check_ground()
	if props:
		for p in props.get_children():
			if p is RigidBody3D and p.global_position.distance_to(center) < radius + 3.0:
				p.sleeping = false


func cast_ray(from: Vector3, to: Vector3, mask: int, exclude: Array[RID] = []) -> Dictionary:
	var space := get_viewport().get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to, mask, exclude)
	return space.intersect_ray(q)


func _setup_input() -> void:
	_key("move_forward", [KEY_W, KEY_UP])
	_key("move_back", [KEY_S, KEY_DOWN])
	_key("move_left", [KEY_A, KEY_LEFT])
	_key("move_right", [KEY_D, KEY_RIGHT])
	_key("jump", [KEY_SPACE])
	_key("sprint", [KEY_SHIFT])
	_key("crouch", [KEY_CTRL, KEY_C])
	_key("interact", [KEY_E])
	_key("rotate", [KEY_R])
	_key("rotate_back", [KEY_Q])
	_key("tilt", [KEY_F])
	_key("snap", [KEY_G])
	_key("time_skip", [KEY_T])
	_key("toggle_hud", [KEY_F1])
	_key("pause", [KEY_ESCAPE])
	for i in 9:
		_key("slot_%d" % (i + 1), [KEY_1 + i])
	_mouse("primary", MOUSE_BUTTON_LEFT)
	_mouse("secondary", MOUSE_BUTTON_RIGHT)


func _key(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)


func _mouse(action: String, button: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var ev := InputEventMouseButton.new()
	ev.button_index = button
	InputMap.action_add_event(action, ev)
