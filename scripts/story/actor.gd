class_name Actor
extends Node3D
## A cast member for cinematics: a Rocketbox avatar (MIT) with motion-captured
## animation, a face driven through its facial bones (jaw, lips, mouth corners,
## eyelids, brows, eyes), lip movement while speaking, blinking, eye contact,
## and a physical ragdoll that takes over when the world throws them around.

const ROOT := "res://assets/characters/"

var id := ""
var model: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var face: FaceRig
var ragdoll: PhysicalBoneSimulator3D
var _clips := {}


static func create(p_id: String, clips: Dictionary) -> Actor:
	var a := Actor.new()
	a.id = p_id
	a._clips = clips
	return a


func _ready() -> void:
	model = load(ROOT + "%s/%s.fbx" % [id, id]).instantiate()
	add_child(model)
	model.rotation.y = PI
	skel = model.find_children("*", "Skeleton3D", true, false)[0]
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	for m in model.find_children("*", "MeshInstance3D", true, false):
		_materials(m)
	var lib := AnimationLibrary.new()
	for k in _clips:
		var a: Animation = (load(ROOT + "anims/%s.res" % _clips[k]) as Animation).duplicate(true)
		a.loop_mode = Animation.LOOP_LINEAR
		lib.add_animation(k, a)
	anim.add_animation_library("c", lib)
	face = FaceRig.new()
	skel.add_child(face)
	face.setup(skel)


func _materials(mi: MeshInstance3D) -> void:
	var dir := ROOT + id + "/"
	for i in mi.mesh.get_surface_count():
		var src := mi.mesh.surface_get_material(i)
		var nm := src.resource_name if src else ""
		var part := nm.substr(nm.find("_") + 1)
		var m := StandardMaterial3D.new()
		if part == "opacity":
			m.albedo_texture = load(dir + "opacity.png")
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
			m.alpha_scissor_threshold = 0.45
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			m.roughness = 0.7
		else:
			m.albedo_texture = load(dir + part + "_color.jpg")
			m.normal_enabled = true
			m.normal_texture = load(dir + part + "_normal.png")
			m.roughness_texture = load(dir + part + "_rough.png")
			if part == "head":
				m.subsurf_scatter_enabled = true
				m.subsurf_scatter_strength = 0.3
				m.subsurf_scatter_skin_mode = true
		mi.set_surface_override_material(i, m)


func play(clip: String, blend: float = 0.4, speed: float = 1.0, from: float = -1.0) -> void:
	anim.play("c/" + clip, blend, speed)
	if from >= 0.0:
		anim.seek(from, true)


## Expression: {"fear", "anger", "sad", "pain", "shock"} 0..1, blended smoothly.
func feel(expr: Dictionary, time: float = 0.6) -> void:
	face.target = expr.duplicate()
	face.blend_time = time


func talk(seconds: float, energy: float = 1.0) -> void:
	face.talk_t = seconds
	face.talk_energy = energy


func look_at_point(p: Variant) -> void:
	face.look_target = p


## Hands the body to physics. `impulse` is applied to the torso.
func go_limp(impulse: Vector3 = Vector3.ZERO) -> void:
	if ragdoll == null:
		_build_ragdoll()
	anim.pause()
	face.limp = true
	ragdoll.physical_bones_start_simulation()
	for b in ragdoll.get_children():
		if b is PhysicalBone3D:
			(b as PhysicalBone3D).apply_central_impulse(impulse * (1.0 if "Spine" in (b as PhysicalBone3D).bone_name else 0.35))


# ------------------------------------------------------------------ ragdoll

const BONES := [
	# bone, child (for length), radius, parent physical bone (or "")
	["Bip01 Pelvis", "Bip01 Spine", 0.13, ""],
	["Bip01 Spine1", "Bip01 Neck", 0.14, "Bip01 Pelvis"],
	["Bip01 Head", "", 0.11, "Bip01 Spine1"],
	["Bip01 L UpperArm", "Bip01 L Forearm", 0.05, "Bip01 Spine1"],
	["Bip01 L Forearm", "Bip01 L Hand", 0.045, "Bip01 L UpperArm"],
	["Bip01 R UpperArm", "Bip01 R Forearm", 0.05, "Bip01 Spine1"],
	["Bip01 R Forearm", "Bip01 R Hand", 0.045, "Bip01 R UpperArm"],
	["Bip01 L Thigh", "Bip01 L Calf", 0.075, "Bip01 Pelvis"],
	["Bip01 L Calf", "Bip01 L Foot", 0.06, "Bip01 L Thigh"],
	["Bip01 R Thigh", "Bip01 R Calf", 0.075, "Bip01 Pelvis"],
	["Bip01 R Calf", "Bip01 R Foot", 0.06, "Bip01 R Thigh"],
]


func _build_ragdoll() -> void:
	ragdoll = PhysicalBoneSimulator3D.new()
	skel.add_child(ragdoll)
	var sk_scale := skel.global_basis.get_scale().x
	for e in BONES:
		var bi := skel.find_bone(e[0])
		if bi < 0:
			continue
		var bone_g := skel.get_bone_global_pose(bi)
		var length := 0.0
		var dir := Vector3.UP
		if e[1] != "":
			var ci := skel.find_bone(e[1])
			var child_g := skel.get_bone_global_pose(ci)
			var d := bone_g.affine_inverse() * child_g.origin
			length = d.length()
			dir = d.normalized()
		else:
			length = 0.22 / sk_scale
			dir = (bone_g.affine_inverse().basis * Vector3.UP).normalized()
		var pb := PhysicalBone3D.new()
		pb.name = "PB " + e[0]
		pb.bone_name = e[0]
		pb.mass = 6.0 if "Pelvis" in e[0] or "Spine" in e[0] else 2.5
		pb.friction = 0.8
		pb.linear_damp = 0.1
		pb.angular_damp = 2.0
		pb.collision_layer = Game.L_PROPS
		pb.collision_mask = Game.L_TERRAIN | Game.L_STRUCT | Game.L_PROPS
		var up := Vector3.UP if absf(dir.dot(Vector3.UP)) < 0.95 else Vector3.FORWARD
		var body_xf := Transform3D(Basis.looking_at(dir, up), Vector3.ZERO)
		body_xf.origin = dir * length * 0.5
		pb.body_offset = body_xf
		pb.joint_offset = Transform3D(Basis(), Vector3(0, 0, length * 0.5))
		if e[3] != "":
			pb.joint_type = PhysicalBone3D.JOINT_TYPE_CONE
			pb.set("joint_constraints/swing_span", 50.0 if "Arm" in e[0] or "Thigh" in e[0] else 25.0)
			pb.set("joint_constraints/twist_span", 30.0)
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = e[2] / sk_scale
		cap.height = maxf(length, cap.radius * 2.2)
		cs.shape = cap
		cs.rotation = Vector3(PI / 2, 0, 0)
		pb.add_child(cs)
		ragdoll.add_child(pb)


# ------------------------------------------------------------------ face

class FaceRig extends SkeletonModifier3D:
	## Adds facial expression on top of whatever the body animation does.
	var target := {}
	var blend_time := 0.6
	var talk_t := 0.0
	var talk_energy := 1.0
	var look_target: Variant = null
	var limp := false
	var cur := {"fear": 0.0, "anger": 0.0, "sad": 0.0, "pain": 0.0, "shock": 0.0}
	var _sk: Skeleton3D
	var _b := {}
	var _blink := 0.0
	var _blink_t := 2.0
	var _jaw := 0.0
	var _t := 0.0
	var _rng := RandomNumberGenerator.new()

	func setup(sk: Skeleton3D) -> void:
		_sk = sk
		_rng.randomize()
		for n in ["MJaw", "REyeBlinkTop", "LEyeBlinkTop", "REyeBlinkBottom", "LEyeBlinkBottom", "RInnerEyebrow",
				"LInnerEyebrow", "MMiddleEyebrow", "ROuterEyebrow", "LOuterEyebrow", "RMouthCorner", "LMouthCorner",
				"MUpperLip", "MBottomLip", "REye", "LEye", "Head", "Neck", "RUpperlip", "LUpperlip", "RCheek", "LCheek"]:
			_b[n] = sk.find_bone("Bip01 " + n)

	func _process_modification() -> void:
		var dt := get_viewport().get_process_delta_time() if is_inside_tree() else 0.016
		_t += dt
		var k := clampf(dt / maxf(blend_time, 0.01), 0.0, 1.0)
		for key in cur:
			cur[key] = lerpf(cur[key], float(target.get(key, 0.0)), k)
		var fear: float = cur["fear"]
		var anger: float = cur["anger"]
		var sad: float = cur["sad"]
		var pain: float = cur["pain"]
		var shock: float = cur["shock"]
		# blinking (faster when afraid); eyes closed when limp
		_blink_t -= dt * (1.0 + fear * 1.5)
		if _blink_t <= 0.0:
			_blink_t = _rng.randf_range(2.0, 5.0)
			_blink = 1.0
		_blink = maxf(_blink - dt * 7.0, 0.0)
		var lid := sin(_blink * PI) if _blink > 0.0 else 0.0
		if limp:
			lid = 0.85
		# speaking: syllable-rate noise on the jaw
		var jaw_target := 0.0
		if talk_t > 0.0 and not limp:
			talk_t -= dt
			var syl := 0.5 + 0.5 * sin(_t * 15.0) * sin(_t * 6.3 + 1.0)
			jaw_target = clampf(syl * (0.55 + 0.45 * talk_energy) * (0.6 + 0.4 * absf(sin(_t * 2.1))), 0.0, 1.0)
		jaw_target = maxf(jaw_target, shock * 0.55 + pain * 0.25 + fear * 0.12)
		_jaw = lerpf(_jaw, jaw_target, clampf(dt * 22.0, 0.0, 1.0))
		# ---- apply. Axes measured on the Rocketbox rig: jaw opens around +Z, lids and
		# brows and mouth corners slide along local X (+ = up), eyes roll around Z (+ = down).
		_rot("MJaw", Vector3(0, 0, 0.26 * _jaw))
		var wide := fear * 0.6 + shock * 0.9 - pain * 0.5 - anger * 0.3
		var top := -0.0125 * lid + 0.0025 * wide
		_move("REyeBlinkTop", Vector3(top, 0, 0))
		_move("LEyeBlinkTop", Vector3(top, 0, 0))
		var bottom := 0.004 * lid + 0.003 * pain + 0.002 * anger
		_move("REyeBlinkBottom", Vector3(bottom, 0, 0))
		_move("LEyeBlinkBottom", Vector3(bottom, 0, 0))
		# brows: inner up = fear/sad, inner down = anger/pain, all up = shock
		var inner := (fear * 0.9 + sad * 0.8 + shock * 0.6 - anger * 1.0 - pain * 0.7) * 0.008
		var outer := (shock * 0.9 + fear * 0.25 - sad * 0.4 - anger * 0.2) * 0.006
		_move("RInnerEyebrow", Vector3(inner, 0, 0))
		_move("LInnerEyebrow", Vector3(inner, 0, 0))
		_move("MMiddleEyebrow", Vector3(inner * 0.6, 0, 0))
		_move("ROuterEyebrow", Vector3(outer, 0, 0))
		_move("LOuterEyebrow", Vector3(outer, 0, 0))
		# mouth corners down for sad/fear/pain; upper lip lifts in anger and pain
		var corner := (-sad * 0.9 - fear * 0.5 - pain * 0.4 - anger * 0.2) * 0.006
		_move("RMouthCorner", Vector3(corner, 0, 0))
		_move("LMouthCorner", Vector3(corner, 0, 0))
		_move("MUpperLip", Vector3((anger * 0.6 + pain * 0.8) * 0.004, 0, 0))
		# gaze: the eyes drop when sad, roll up when limp
		var gaze := sad * 0.15 - fear * 0.05 + (-0.25 if limp else 0.0)
		if look_target is Vector3 and not limp:
			var hb: int = _b["Head"]
			var g := _sk.global_transform * _sk.get_bone_global_pose(hb)
			gaze += clampf(-((look_target as Vector3) - g.origin).normalized().y * 0.6, -0.3, 0.3)
		_rot("REye", Vector3(0, 0, gaze))
		_rot("LEye", Vector3(0, 0, gaze))

	func _rot(n: String, e: Vector3) -> void:
		var bi: int = _b.get(n, -1)
		if bi < 0 or e == Vector3.ZERO:
			return
		_sk.set_bone_pose_rotation(bi, _sk.get_bone_pose_rotation(bi) * Quaternion.from_euler(e))

	func _move(n: String, d: Vector3) -> void:
		var bi: int = _b.get(n, -1)
		if bi < 0 or d == Vector3.ZERO:
			return
		# offsets are in metres; the skeleton is authored in its own units
		var s := _sk.global_basis.get_scale().x
		_sk.set_bone_pose_position(bi, _sk.get_bone_pose_position(bi) + d / maxf(s, 0.0001))
