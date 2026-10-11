class_name AimRig
extends SkeletonModifier3D
## Runs after the mocap locomotion every frame and layers the combat pose on top:
## torso twist toward the aim, hit flinch, head look, and two-bone IK that puts
## both hands on the rifle (or the left hand on a reload target).

var rifle: Rifle
var twist := 0.0                 ## torso yaw relative to the hips (rad, about world up)
var lean := Vector3.ZERO         ## flinch: world-space rotation vector (axis * angle)
var aim_dir := Vector3.FORWARD   ## world direction the head should look
var weight := 1.0                ## 0 = pure animation (dead), 1 = full combat pose
var left_override := false       ## reload: left hand goes to left_target instead of the handguard
var left_target := Vector3.ZERO
var pole_r := Vector3.ZERO       ## elbow hints (world)
var pole_l := Vector3.ZERO

var _b := {}


func setup(sk: Skeleton3D) -> void:
	for key in ["Spine", "Spine1", "Spine2", "Neck", "Head", "MNose",
			"R UpperArm", "R Forearm", "R Hand", "R Finger2", "L UpperArm", "L Forearm", "L Hand", "L Finger2",
			"R Clavicle", "L Clavicle"]:
		_b[key] = sk.find_bone("Bip01 " + key)


func bone_world(name: String) -> Vector3:
	var sk := get_skeleton()
	return sk.global_transform * sk.get_bone_global_pose(_b[name]).origin


func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null or rifle == null or weight <= 0.001:
		return
	var inv := sk.global_transform.affine_inverse()
	var up := (inv.basis * Vector3.UP).normalized()
	# torso twist + flinch, spread over the three spine bones
	var lean_axis := Vector3.ZERO
	var lean_ang := lean.length()
	if lean_ang > 0.0001:
		lean_axis = (inv.basis * (lean / lean_ang)).normalized()
	for e in [["Spine", 0.25], ["Spine1", 0.3], ["Spine2", 0.35]]:
		var i: int = _b[e[0]]
		var g := sk.get_bone_global_pose(i)
		var q := Quaternion(up, twist * e[1] * weight)
		if lean_ang > 0.0001:
			q = Quaternion(lean_axis, lean_ang * e[1] * weight) * q
		g.basis = Basis(q) * g.basis
		_set_global(sk, i, g)
	# head turns the rest of the way toward the aim
	_look_head(sk, inv, up)
	# arms onto the rifle
	var tr := inv * rifle.grip_r.global_position
	var tl := inv * (left_target if left_override else rifle.grip_l.global_position)
	_two_bone(sk, _b["R UpperArm"], _b["R Forearm"], _b["R Hand"], tr, inv * pole_r)
	_two_bone(sk, _b["L UpperArm"], _b["L Forearm"], _b["L Hand"], tl, inv * pole_l)
	# hands: fingers along the rifle
	var rb := inv.basis * rifle.global_transform.basis
	_point_bone(sk, _b["R Hand"], _b["R Finger2"], (rb * Vector3(0.0, -0.75, -1.0)).normalized())
	if not left_override:
		_point_bone(sk, _b["L Hand"], _b["L Finger2"], (rb * Vector3(0.75, 0.35, -0.55)).normalized())


func _look_head(sk: Skeleton3D, inv: Transform3D, up: Vector3) -> void:
	var hi: int = _b["Head"]
	var g := sk.get_bone_global_pose(hi)
	var nose := sk.get_bone_global_pose(_b["MNose"]).origin - g.origin
	var want := (inv.basis * aim_dir).normalized()
	var a := nose - up * nose.dot(up)
	var b := want - up * want.dot(up)
	if a.length() < 0.001 or b.length() < 0.001:
		return
	var ang := a.signed_angle_to(b, up)
	g.basis = Basis(Quaternion(up, clampf(ang, -1.0, 1.0) * 0.8 * weight)) * g.basis
	_set_global(sk, hi, g)


func _two_bone(sk: Skeleton3D, iu: int, il: int, ih: int, target: Vector3, pole: Vector3) -> void:
	var gu := sk.get_bone_global_pose(iu)
	var a := gu.origin
	var b := sk.get_bone_global_pose(il).origin
	var c := sk.get_bone_global_pose(ih).origin
	var l1 := a.distance_to(b)
	var l2 := b.distance_to(c)
	var t := c.lerp(target, weight)
	var d := clampf(a.distance_to(t), 0.02, (l1 + l2) * 0.999)
	var dir := (t - a).normalized()
	var x := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var h := sqrt(maxf(l1 * l1 - x * x, 0.0))
	var pd := pole - a
	pd = pd - dir * pd.dot(dir)
	if pd.length() < 0.0001:
		pd = (b - a) - dir * (b - a).dot(dir)
	var e := a + dir * x + pd.normalized() * h
	gu.basis = Basis(_arc(b - a, e - a)) * gu.basis
	_set_global(sk, iu, gu)
	var gl := sk.get_bone_global_pose(il)
	var c2 := sk.get_bone_global_pose(ih).origin
	gl.basis = Basis(_arc(c2 - gl.origin, a + dir * d - gl.origin)) * gl.basis
	_set_global(sk, il, gl)


func _point_bone(sk: Skeleton3D, i: int, child: int, want: Vector3) -> void:
	var g := sk.get_bone_global_pose(i)
	var cur := sk.get_bone_global_pose(child).origin - g.origin
	if cur.length() < 0.0001:
		return
	var q := _arc(cur, want)
	g.basis = Basis(Quaternion.IDENTITY.slerp(q, weight)) * g.basis
	_set_global(sk, i, g)


static func _arc(from: Vector3, to: Vector3) -> Quaternion:
	var f := from.normalized()
	var t := to.normalized()
	if f.dot(t) > 0.99999:
		return Quaternion.IDENTITY
	if f.dot(t) < -0.9999:
		var ax := f.cross(Vector3.UP)
		if ax.length() < 0.01:
			ax = f.cross(Vector3.RIGHT)
		return Quaternion(ax.normalized(), PI)
	return Quaternion(f, t)


static func _set_global(sk: Skeleton3D, i: int, g: Transform3D) -> void:
	var p := sk.get_bone_parent(i)
	var pg := sk.get_bone_global_pose(p) if p >= 0 else Transform3D()
	var local := pg.affine_inverse() * g
	sk.set_bone_pose_rotation(i, local.basis.get_rotation_quaternion())
