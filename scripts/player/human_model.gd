class_name HumanModel
extends Node3D
## Realistic rigged human (Mixamo skeleton) driven by an AnimationTree:
## idle / walk / run blended by speed, swimming pose, tool swing layered on the arm,
## and the active tool held in the right hand. Any Mixamo animation can be added
## later because the skeleton is the standard Mixamo rig.

const SCENE_PATH := "res://assets/characters/castaway.glb"
const TARGET_HEIGHT := 1.78
const WALK_SPEED := 1.4   # m/s the Walk clip was authored at
const RUN_SPEED := 3.9    # m/s the Run clip was authored at

var swing := 0.0
var model: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var tree: AnimationTree
var hand: BoneAttachment3D
var _pivot := Node3D.new()
var _meshes: Array[MeshInstance3D] = []
var _held: Node3D
var _held_id := ""
var _r_arm := -1
var _r_fore := -1
var _spine := -1
var _swim := 0.0
var _air := 0.0


func _ready() -> void:
	add_child(_pivot)
	_pivot.position.y = 1.0
	model = load(SCENE_PATH).instantiate()
	_pivot.add_child(model)
	model.position.y = -1.0
	# the imported Mixamo rig already faces -Z like the player
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	skel = model.find_children("*", "Skeleton3D", true, false)[0]
	for n in ["Idle", "Walk", "Run"]:
		anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	for m in model.find_children("*", "MeshInstance3D", true, false):
		_meshes.append(m)
	_r_arm = _bone("RightArm")
	_r_fore = _bone("RightForeArm")
	_spine = _bone("Spine1")

	tree = AnimationTree.new()
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(anim)
	var bt := AnimationNodeBlendTree.new()
	var bs := AnimationNodeBlendSpace1D.new()
	for e in [["Idle", 0.0], ["Walk", WALK_SPEED], ["Run", RUN_SPEED]]:
		var a := AnimationNodeAnimation.new()
		a.animation = e[0]
		bs.add_blend_point(a, e[1])
	bs.min_space = 0.0
	bs.max_space = RUN_SPEED
	bt.add_node("move", bs)
	var ts := AnimationNodeTimeScale.new()
	bt.add_node("speed", ts)
	bt.connect_node("speed", 0, "move")
	bt.connect_node("output", 0, "speed")
	tree.tree_root = bt
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	tree.advance(0.0)

	# scale the character to a real human height
	var head := _bone("HeadTop_End")
	if head >= 0:
		var h := (skel.global_transform * skel.get_bone_global_pose(head)).origin.y - global_position.y
		if h > 0.01:
			model.scale *= TARGET_HEIGHT / h

	hand = BoneAttachment3D.new()
	skel.add_child(hand)
	hand.bone_idx = _bone("RightHand")


func _bone(short: String) -> int:
	for n in ["mixamorig_" + short, "mixamorig:" + short, short]:
		var i := skel.find_bone(n)
		if i >= 0:
			return i
	return -1


func set_first_person(fp: bool) -> void:
	for m in _meshes:
		# in first person the body still casts its shadow, but the camera never sees it
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY if fp else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	if _held:
		_held.visible = not fp


## Shows a copy of the tool viewmodel in the right hand (third person).
func hold(id: String, source: Node3D) -> void:
	if id == _held_id:
		return
	_held_id = id
	if _held:
		_held.queue_free()
		_held = null
	if source == null or source.get_child_count() == 0:
		return
	_held = source.duplicate()
	_held.visible = true
	hand.add_child(_held)
	# undo the skeleton's centimetre scale so the tool keeps its real size
	var s := hand.global_transform.basis.get_scale().x
	_held.scale = Vector3.ONE / maxf(s, 0.0001)
	_held.rotation = Vector3(deg_to_rad(-90), 0, deg_to_rad(90))
	_held.position = Vector3(0, 8.0, 2.0)
	for m in _held.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func animate(delta: float, h_speed: float, on_floor: bool, swimming: bool, vy: float) -> void:
	_swim = move_toward(_swim, 1.0 if swimming else 0.0, delta * 2.5)
	_air = move_toward(_air, 0.0 if (on_floor or swimming) else 1.0, delta * 4.0)
	var blend := clampf(h_speed, 0.0, RUN_SPEED)
	var scale := 1.0
	if h_speed > RUN_SPEED:
		scale = clampf(h_speed / RUN_SPEED, 1.0, 1.6)
	elif h_speed > 0.2 and h_speed < WALK_SPEED:
		scale = clampf(h_speed / WALK_SPEED, 0.6, 1.0)
	if swimming:
		blend = WALK_SPEED * 0.7
		scale = 0.6 + h_speed * 0.3
	if _air > 0.5:
		scale = 0.15
	tree.set("parameters/move/blend_position", blend)
	tree.set("parameters/speed/scale", scale)
	tree.advance(delta)

	# body lies flat to swim, leans slightly into a sprint
	var lean := -1.3 * _swim * (1.0 if h_speed > 0.3 else 0.35)
	lean += -0.08 * clampf((h_speed - 4.0) / 3.0, 0.0, 1.0) * (1.0 - _swim)
	_pivot.rotation.x = lerp_angle(_pivot.rotation.x, lean, 1.0 - exp(-6.0 * delta))

	# tool swing layered over the animation on the right arm
	if swing > 0.01 and _r_arm >= 0:
		var sw := sin(swing * PI)
		var arm_q := skel.get_bone_pose_rotation(_r_arm)
		skel.set_bone_pose_rotation(_r_arm, arm_q * Quaternion(Vector3.FORWARD, -1.6 * sw) * Quaternion(Vector3.RIGHT, -0.6 * sw))
		if _r_fore >= 0:
			var fq := skel.get_bone_pose_rotation(_r_fore)
			skel.set_bone_pose_rotation(_r_fore, fq * Quaternion(Vector3.FORWARD, -0.8 * sw))
