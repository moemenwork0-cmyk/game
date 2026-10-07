class_name HumanModel
extends Node3D
## Realistic human (Microsoft Rocketbox avatar, MIT licence) with motion-captured
## animations: idle / look-around / walk / run / sprint / injured walk, blended by
## real movement speed (root motion stripped so physics drives the body).
## Layered on top: swimming pose, tool swing on the right arm, tool in hand.

const SCENE_PATH := "res://assets/characters/castaway/castaway.fbx"
const TEX := "res://assets/characters/castaway/"
const ANIMS := {
	"idle": "m_idle_breathe_01", "look": "m_idle_look_around_01", "walk": "m_walk_neutral_01",
	"run": "m_run_neutral_01", "sprint": "m_run_fast_01", "limp": "m_walk_bruised", "crouch": "m_crouch_idle",
}

var swing := 0.0
var injured := false
var model: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var tree: AnimationTree
var hand: BoneAttachment3D
var speeds := {}
var _pivot := Node3D.new()
var _meshes: Array[MeshInstance3D] = []
var _held: Node3D
var _held_id := ""
var _r_arm := -1
var _r_fore := -1
var _swim := 0.0
var _air := 0.0
var _idle_t := 0.0


func _ready() -> void:
	add_child(_pivot)
	_pivot.position.y = 1.0
	model = load(SCENE_PATH).instantiate()
	_pivot.add_child(model)
	model.position.y = -1.0
	model.rotation.y = PI   # Rocketbox avatars walk toward +Z; the player faces -Z
	skel = model.find_children("*", "Skeleton3D", true, false)[0]
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	for m in model.find_children("*", "MeshInstance3D", true, false):
		_meshes.append(m)
		_setup_materials(m)
	_load_animations()
	_r_arm = skel.find_bone("Bip01 R UpperArm")
	_r_fore = skel.find_bone("Bip01 R Forearm")
	_build_tree()
	hand = BoneAttachment3D.new()
	skel.add_child(hand)
	hand.bone_idx = skel.find_bone("Bip01 R Hand")


func _setup_materials(mi: MeshInstance3D) -> void:
	for i in mi.mesh.get_surface_count():
		var src := mi.mesh.surface_get_material(i)
		var nm := src.resource_name if src else ""
		var m := StandardMaterial3D.new()
		if "opacity" in nm:
			# hair and eyelashes: alpha-tested cards
			m.albedo_texture = load(TEX + "opacity.png")
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
			m.alpha_scissor_threshold = 0.45
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			m.roughness = 0.7
		else:
			var part := "head" if "head" in nm else "body"
			m.albedo_texture = load(TEX + part + "_color.jpg")
			m.normal_enabled = true
			m.normal_texture = load(TEX + part + "_normal.png")
			m.roughness_texture = load(TEX + part + "_rough.png")
			m.roughness = 1.0
			if part == "head":
				# a little light scattering through skin
				m.subsurf_scatter_enabled = true
				m.subsurf_scatter_strength = 0.25
		mi.set_surface_override_material(i, m)


func _load_animations() -> void:
	var lib := AnimationLibrary.new()
	for key in ANIMS:
		var a: Animation = (load("res://assets/characters/anims/%s.res" % ANIMS[key]) as Animation).duplicate(true)
		a.loop_mode = Animation.LOOP_LINEAR
		# strip root motion: measure the clip's real speed, then pin the root in place
		for t in a.get_track_count():
			if a.track_get_type(t) == Animation.TYPE_POSITION_3D and str(a.track_get_path(t)).ends_with(":Bip01"):
				var p0: Vector3 = a.position_track_interpolate(t, 0.0)
				var p1: Vector3 = a.position_track_interpolate(t, a.length)
				speeds[key] = Vector2(p1.x - p0.x, p1.z - p0.z).length() / maxf(a.length, 0.01)
				for k in a.track_get_key_count(t):
					var v: Vector3 = a.track_get_key_value(t, k)
					a.track_set_key_value(t, k, Vector3(p0.x, v.y, p0.z))
		lib.add_animation(key, a)
	anim.add_animation_library("h", lib)


func _build_tree() -> void:
	tree = AnimationTree.new()
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(anim)
	var bt := AnimationNodeBlendTree.new()
	var bs := AnimationNodeBlendSpace1D.new()
	var pts := [["h/idle", 0.0], ["h/walk", float(speeds.get("walk", 1.0))],
		["h/run", float(speeds.get("run", 2.9))], ["h/sprint", float(speeds.get("sprint", 5.0))]]
	for e in pts:
		var a := AnimationNodeAnimation.new()
		a.animation = e[0]
		bs.add_blend_point(a, e[1])
	bs.min_space = 0.0
	bs.max_space = pts[3][1]
	bt.add_node("move", bs)
	# injured gait replaces walking when badly hurt
	var limp := AnimationNodeAnimation.new()
	limp.animation = "h/limp"
	bt.add_node("limp", limp)
	var mix := AnimationNodeBlend2.new()
	bt.add_node("hurt", mix)
	bt.connect_node("hurt", 0, "move")
	bt.connect_node("hurt", 1, "limp")
	var ts := AnimationNodeTimeScale.new()
	bt.add_node("speed", ts)
	bt.connect_node("speed", 0, "hurt")
	bt.connect_node("output", 0, "speed")
	tree.tree_root = bt
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	tree.advance(0.0)


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
	_held.rotation = Vector3(0, 0, deg_to_rad(-90))
	_held.position = Vector3(0.09, 0.0, 0.0)
	for m in _held.find_children("*", "MeshInstance3D", true, false):
		(m as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func animate(delta: float, h_speed: float, on_floor: bool, swimming: bool, _vy: float) -> void:
	_swim = move_toward(_swim, 1.0 if swimming else 0.0, delta * 2.5)
	_air = move_toward(_air, 0.0 if (on_floor or swimming) else 1.0, delta * 4.0)
	var top := float(speeds.get("sprint", 5.0))
	var blend := clampf(h_speed, 0.0, top)
	var scale := 1.0
	if h_speed > top:
		scale = clampf(h_speed / top, 1.0, 1.4)
	if swimming:
		blend = float(speeds.get("walk", 1.0)) * 0.8
		scale = 0.55 + h_speed * 0.25
	if _air > 0.5:
		scale = 0.2
	tree.set("parameters/move/blend_position", blend)
	tree.set("parameters/hurt/blend_amount", 1.0 if (injured and h_speed > 0.3 and not swimming) else 0.0)
	tree.set("parameters/speed/scale", scale)
	tree.advance(delta)

	# lie flat to swim, lean into a sprint
	var lean := -1.3 * _swim * (1.0 if h_speed > 0.3 else 0.35)
	lean += -0.1 * clampf((h_speed - 4.0) / 3.0, 0.0, 1.0) * (1.0 - _swim)
	_pivot.rotation.x = lerp_angle(_pivot.rotation.x, lean, 1.0 - exp(-6.0 * delta))

	# tool swing layered over the motion capture on the right arm
	if swing > 0.01 and _r_arm >= 0:
		var sw := sin(swing * PI)
		var q := skel.get_bone_pose_rotation(_r_arm)
		skel.set_bone_pose_rotation(_r_arm, q * Quaternion(Vector3(0, 0, 1), 1.7 * sw) * Quaternion(Vector3(0, 1, 0), 0.5 * sw))
		if _r_fore >= 0:
			var fq := skel.get_bone_pose_rotation(_r_fore)
			skel.set_bone_pose_rotation(_r_fore, fq * Quaternion(Vector3(0, 0, 1), 0.9 * sw))
