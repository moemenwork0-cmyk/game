class_name Hostage
extends Soldier
## Captive civilian. Kneels with hands tied until freed, then follows the player to extraction,
## keeping a short distance and staying low when bullets fly. If he dies the mission fails.

var level: Level
var leader: Soldier
var freed := false
var _path := PackedVector3Array()
var _repath := 0.0


func _ready() -> void:
	team = 0
	armed = false
	avatar_dir = "res://assets/characters/hostage/"
	super._ready()
	max_hp = 60.0
	hp = max_hp
	crouching = true
	remove_from_group("soldiers")
	add_to_group("soldiers")


func think(delta: float) -> void:
	if not freed or leader == null:
		crouching = true
		move_target = Vector3.ZERO
		return
	crouching = false
	_repath -= delta
	var to := leader.global_position - global_position
	var dist := Vector2(to.x, to.z).length()
	if dist < 1.8:
		move_target = Vector3.ZERO
		aim_yaw = atan2(-to.x, -to.z)
		return
	if _repath <= 0.0:
		_repath = 0.4
		_path = level.find_path(global_position, leader.global_position)
	while _path.size() > 0 and Vector2(_path[0].x - global_position.x, _path[0].z - global_position.z).length() < 0.3:
		_path.remove_at(0)
	if _path.is_empty():
		move_target = Vector3.ZERO
		return
	var d := _path[0] - global_position
	d.y = 0
	var spd := 4.2 if dist > 4.0 else 2.4
	move_target = d.normalized() * spd
	aim_yaw = atan2(-d.x, -d.z)
