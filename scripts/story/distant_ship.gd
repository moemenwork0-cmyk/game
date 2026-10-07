class_name DistantShip
extends Node3D
## A real ship crossing the horizon. It never turns. Unless you have a signal fire
## burning high enough when it passes, it never will. Emits `passed` when gone.

signal passed
signal saw_signal

const DIST := 210.0
const DURATION := 95.0

var _t := 0.0
var _from := Vector3.ZERO
var _to := Vector3.ZERO
var _horned := false


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var ship := ShipBuilder.build_ship(rng, false)
	ship.scale = Vector3.ONE * 1.6
	add_child(ship)
	var a := rng.randf() * TAU
	var side := Vector3(cos(a), 0, sin(a))
	var along := side.rotated(Vector3.UP, PI / 2)
	_from = side * DIST - along * 170.0 + Vector3(0, -1.2, 0)
	_to = side * DIST + along * 170.0 + Vector3(0, -1.2, 0)
	global_position = _from
	look_at(_to, Vector3.UP)


func _process(delta: float) -> void:
	_t += delta
	var u := _t / DURATION
	var p := _from.lerp(_to, u)
	if Game.ocean:
		p.y = Game.ocean.get_height(p.x, p.z) - 1.2
	global_position = p
	rotation.z = sin(_t * 0.6) * 0.03
	if not _horned and u > 0.45:
		_horned = true
		Game.sfx.play("horn", global_position.normalized() * 60.0, -6.0)
		if _signal_fire():
			saw_signal.emit()
	if u >= 1.0:
		passed.emit()
		queue_free()


func _signal_fire() -> bool:
	for c in get_tree().get_nodes_in_group("campfires"):
		var n := c as Node3D
		if n.global_position.y > 7.0:
			return true
	return false
