class_name Soldier
extends CharacterBody3D
## A soldier: Rocketbox avatar with motion-captured locomotion, procedural combat
## upper body (AimRig), a rifle with recoil / reload, hit flinch and a ragdoll death.
## Player and Enemy extend this and only decide where to move, aim and when to shoot.

signal died(killer: Soldier, headshot: bool)
signal hurt(amount: float, from: Vector3)
signal fired

const ANIMS := {
	"idle": "m_idle_breathe_01", "look": "m_idle_look_around_01", "walk": "m_walk_neutral_01",
	"run": "m_run_neutral_01", "crouch": "m_crouch_idle",
}
const RIFLE_DMG := 25.0

var avatar_dir := "res://assets/characters/player/"
var uniform_tint := Color.WHITE
var team := 0
var max_hp := 100.0
var hp := 100.0
var alive := true
var move_target := Vector3.ZERO     ## desired horizontal velocity (m/s)
var aim_yaw := 0.0
var aim_up := 0.0                   ## 1 = rifle shouldered, 0 = low ready
var crouching := false
var mag_size := 30
var ammo := 30
var fire_interval := 0.105
var damage := RIFLE_DMG
var spread := 0.02
var accel := 14.0
var weapon_id := "rifle"
var pellets := 1
var kick := 1.0
var shot_sound := "shot"
var move_mul := 1.0
var armed := true
var armor := 0.0                    ## fraction of damage absorbed (heavies)
var grenades := 0
var xray := false                   ## silhouette through walls (player)
var stagger := Vector3.ZERO

var body_yaw := 0.0
var crouch_k := 0.0
var aim_k := 0.0
var recoil := 0.0
var reload_t := -1.0
var reload_time := 1.7
var shots := 0
var hits := 0
var headshots := 0
var last_attacker: Soldier

var model: Node3D
var skel: Skeleton3D
var rig: AimRig
var rifle: Rifle
var anim: AnimationPlayer
var tree: AnimationTree
var pivot := Node3D.new()
var shape := CollisionShape3D.new()
var capsule := CapsuleShape3D.new()

var _speeds := {}
var _fire_cd := 0.0
var _lean := Vector3.ZERO
var _lean_v := Vector3.ZERO
var _step_dist := 0.0
var _step_side := false
var _backwards := false
var _ragdoll: PhysicalBoneSimulator3D
var _dash_t := 0.0
var _dash_cd := 0.0
var _dash_dir := Vector3.ZERO
var _throw_t := -1.0
var _throw_at := Vector3.ZERO


func _ready() -> void:
	add_to_group("soldiers")
	collision_layer = 2
	collision_mask = 1 | 2 | 4 | 16
	capsule.radius = 0.3
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)
	add_child(pivot)
	model = load(avatar_dir + "soldier.fbx").instantiate()
	pivot.add_child(model)
	model.rotation.y = PI   # Rocketbox avatars face +Z; we face -Z
	skel = model.find_children("*", "Skeleton3D", true, false)[0]
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	for m in model.find_children("*", "MeshInstance3D", true, false):
		_setup_materials(m)
	_load_animations()
	_build_tree()
	set_weapon(weapon_id)
	rig = AimRig.new()
	rig.rifle = rifle
	skel.add_child(rig)
	rig.setup(skel)
	if not armed:
		rifle.visible = false
		rig.weight = 0.0
		rig.active = false
	body_yaw = aim_yaw
	process_priority = -5
	hp = max_hp


## Applies a weapon from the Weapons table and (re)builds its model.
func set_weapon(id: String) -> void:
	var d := Weapons.get_def(id)
	weapon_id = id
	damage = d["dmg"]
	fire_interval = d["rate"]
	mag_size = d["mag"]
	ammo = mag_size
	spread = d["spread"]
	pellets = d["pellets"]
	reload_time = d["reload"]
	kick = d["kick"]
	shot_sound = d["sound"]
	move_mul = d["move"]
	if rifle:
		rifle.queue_free()
	rifle = Rifle.new()
	rifle.kind = id
	add_child(rifle)
	rifle.top_level = true
	if rig:
		rig.rifle = rifle


static var _xray_mat: ShaderMaterial


static func xray_material() -> ShaderMaterial:
	if _xray_mat == null:
		_xray_mat = ShaderMaterial.new()
		_xray_mat.shader = load("res://scripts/xray.gdshader")
		_xray_mat.render_priority = 10
	return _xray_mat


func _setup_materials(mi: MeshInstance3D) -> void:
	for i in mi.mesh.get_surface_count():
		var src := mi.mesh.surface_get_material(i)
		var nm := src.resource_name if src else "body"
		var part := "body"
		for p in ["head", "helmet", "equipment", "pistol"]:
			if p in nm:
				part = p
		var m := StandardMaterial3D.new()
		if "opacity" in nm:
			m.albedo_texture = load(avatar_dir + "opacity.png")
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
			m.alpha_scissor_threshold = 0.45
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			mi.set_surface_override_material(i, m)
			continue
		m.albedo_texture = load(avatar_dir + part + "_color.jpg")
		m.normal_enabled = true
		m.normal_texture = load(avatar_dir + part + "_normal.png")
		m.roughness_texture = load(avatar_dir + part + "_rough.jpg")
		m.roughness = 1.0
		if part != "head":
			m.albedo_color = uniform_tint
		else:
			m.subsurf_scatter_enabled = true
			m.subsurf_scatter_strength = 0.2
		m.emission_enabled = true
		m.emission = Color(1.0, 0.86, 0.8)
		m.emission_energy_multiplier = 0.0
		m.rim_enabled = true
		m.rim = 0.25
		m.rim_tint = 0.6
		if xray:
			m.next_pass = xray_material()
		mi.set_surface_override_material(i, m)


func _load_animations() -> void:
	var lib := AnimationLibrary.new()
	for key in ANIMS:
		var a: Animation = (load("res://assets/characters/anims/%s.res" % ANIMS[key]) as Animation).duplicate(true)
		a.loop_mode = Animation.LOOP_LINEAR
		for t in a.get_track_count():
			if a.track_get_type(t) == Animation.TYPE_POSITION_3D and str(a.track_get_path(t)).ends_with(":Bip01"):
				var p0: Vector3 = a.position_track_interpolate(t, 0.0)
				var p1: Vector3 = a.position_track_interpolate(t, a.length)
				_speeds[key] = Vector2(p1.x - p0.x, p1.z - p0.z).length() / maxf(a.length, 0.01)
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
	var walk_v := clampf(float(_speeds.get("walk", 1.4)), 0.8, 2.0)
	var run_v := clampf(float(_speeds.get("run", 3.4)), 2.5, 5.0)
	_speeds["walk"] = walk_v
	_speeds["run"] = run_v
	for e in [["h/idle", 0.0], ["h/walk", walk_v], ["h/run", run_v]]:
		var a := AnimationNodeAnimation.new()
		a.animation = e[0]
		bs.add_blend_point(a, e[1], -1, e[0].get_file())
	bs.min_space = 0.0
	bs.max_space = run_v
	bt.add_node("move", bs)
	var ts := AnimationNodeTimeScale.new()
	bt.add_node("speed", ts)
	bt.connect_node("speed", 0, "move")
	var cr := AnimationNodeAnimation.new()
	cr.animation = "h/crouch"
	bt.add_node("crouch", cr)
	var mix := AnimationNodeBlend2.new()
	bt.add_node("crouchmix", mix)
	bt.connect_node("crouchmix", 0, "speed")
	bt.connect_node("crouchmix", 1, "crouch")
	bt.connect_node("output", 0, "crouchmix")
	tree.tree_root = bt
	tree.active = true


# ---------------------------------------------------------------- movement

func _physics_process(delta: float) -> void:
	if not alive:
		return
	think(delta)
	var tgt := move_target * move_mul
	if crouching:
		tgt *= 0.0
	var hv := Vector3(velocity.x, 0, velocity.z)
	hv = hv.lerp(tgt, 1.0 - exp(-accel * delta))
	_dash_cd -= delta
	if _dash_t > 0.0:
		_dash_t -= delta
		hv = _dash_dir * lerpf(5.0, 11.0, clampf(_dash_t / 0.3, 0.0, 1.0))
	hv += stagger
	stagger = stagger.lerp(Vector3.ZERO, 1.0 - exp(-10.0 * delta))
	velocity = Vector3(hv.x, -1.0, hv.z)
	move_and_slide()
	global_position.y = 0.0
	# shove doors, chairs and clutter out of the way
	for i in get_slide_collision_count():
		var c := get_slide_collision(i)
		var rb := c.get_collider() as RigidBody3D
		if rb:
			var push := -c.get_normal()
			push.y = 0.0
			rb.apply_impulse(push * clampf(hv.length(), 0.5, 4.5) * 0.45, c.get_position() - rb.global_position)
	_fire_cd -= delta
	# footsteps by distance travelled
	var spd := Vector2(velocity.x, velocity.z).length()
	_step_dist += spd * delta
	var stride := 0.62 if spd < 2.5 else 0.95
	if _step_dist > stride:
		_step_dist = 0.0
		_step_side = not _step_side
		Sfx.play_at("step", global_position, -8.0 + spd * 1.5, randf_range(0.9, 1.1))


## Overridden by Player / Enemy: set move_target, aim_yaw, aim_up, crouching, call fire().
func think(_delta: float) -> void:
	pass


func _process(delta: float) -> void:
	if not alive:
		return
	var spd := Vector2(velocity.x, velocity.z).length()
	# legs follow movement, torso twists to the aim; walking away from the aim plays the gait backwards
	var target_body := body_yaw
	_backwards = false
	if spd > 0.35:
		var mv_yaw := atan2(-velocity.x, -velocity.z)
		var diff := absf(angle_difference(aim_yaw, mv_yaw))
		if diff > deg_to_rad(115):
			target_body = mv_yaw + PI
			_backwards = true
		elif diff > deg_to_rad(70):
			target_body = lerp_angle(mv_yaw, aim_yaw, 0.35)
		else:
			target_body = mv_yaw
	elif absf(angle_difference(body_yaw, aim_yaw)) > 0.9 or crouching:
		target_body = aim_yaw
	body_yaw = lerp_angle(body_yaw, target_body, 1.0 - exp(-(9.0 if spd > 0.35 else 6.0) * delta))
	pivot.rotation.y = body_yaw
	var want_crouch := 1.0 if crouching else (0.55 if _dash_t > 0.0 else 0.0)
	crouch_k = move_toward(crouch_k, want_crouch, delta * (9.0 if _dash_t > 0.0 else 4.0))
	aim_k = move_toward(aim_k, aim_up, delta * 5.0)
	capsule.height = lerpf(1.8, 1.25, crouch_k)
	shape.position.y = capsule.height * 0.5
	# animation
	tree.set("parameters/move/blend_position", spd)
	var ts := 1.0
	if spd > float(_speeds["run"]):
		ts = spd / float(_speeds["run"])
	tree.set("parameters/speed/scale", -ts if _backwards else ts)
	tree.set("parameters/crouchmix/blend_amount", crouch_k)
	# springs
	recoil = move_toward(recoil, 0.0, delta * (4.5 if pellets > 1 else 9.0))
	var dt := minf(delta, 0.05)
	var n := int(ceil(dt / 0.008))
	for i in n:
		_lean_v += (-_lean * 90.0 - _lean_v * 12.0) * (dt / n)
		_lean += _lean_v * (dt / n)
	if not _lean.is_finite() or _lean.length() > 1.2:
		_lean = Vector3.ZERO
		_lean_v = Vector3.ZERO
	_update_reload(delta)
	_update_throw(delta)
	if armed:
		_place_rifle(spd)


func _place_rifle(spd: float) -> void:
	var yb := Basis(Vector3.UP, aim_yaw)
	var h := lerpf(1.3, 0.84, crouch_k)
	var t_ms := Time.get_ticks_msec() * 0.001
	var bob := sin(t_ms * (9.0 if spd > 2.5 else 6.5)) * 0.012 * clampf(spd / 2.0, 0.0, 1.0)
	var breathe := sin(t_ms * 1.7) * 0.004
	var aimed := Transform3D(yb, global_position + yb * Vector3(0.14, h + bob + breathe, -0.36))
	var low_b := yb * Basis(Vector3.UP, 0.55) * Basis(Vector3.RIGHT, -0.62)
	var low := Transform3D(low_b, global_position + yb * Vector3(0.09, h - 0.2 + bob, -0.26))
	var t := low.interpolate_with(aimed, aim_k)
	var rk0 := recoil * clampf(kick, 0.5, 2.5)
	t.origin += t.basis.z * rk0 * 0.06 + t.basis.y * rk0 * 0.012
	t.basis = t.basis * Basis(Vector3.RIGHT, rk0 * 0.1)
	var rk := _reload_tilt()
	if rk > 0.0:
		t.basis = t.basis * Basis(Vector3.FORWARD, -0.7 * rk) * Basis(Vector3.RIGHT, -0.35 * rk)
		t.origin += yb * Vector3(-0.06, -0.06, 0.12) * rk
	rifle.global_transform = t
	rig.twist = angle_difference(body_yaw, aim_yaw)
	rig.twist = clampf(rig.twist, -1.9, 1.9)
	var sprint := Vector3(velocity.x, 0, velocity.z)
	var lean_fwd := Vector3.ZERO
	if sprint.length() > 0.5:
		lean_fwd = Vector3.UP.cross(sprint.normalized()) * clampf(sprint.length() / 5.0, 0.0, 1.0) * 0.14
	rig.lean = _lean + lean_fwd
	rig.kick = recoil * 0.07 * kick
	rig.aim_dir = yb * Vector3.FORWARD
	rig.pole_r = global_position + yb * Vector3(0.55, h - 0.45, 0.15)
	rig.pole_l = global_position + yb * Vector3(-0.5, h - 0.55, -0.15)


# ---------------------------------------------------------------- combat

func can_fire() -> bool:
	return alive and reload_t < 0.0 and _fire_cd <= 0.0 and ammo > 0


## Fires one round toward a world point. Returns true if a shot left the barrel.
func fire(at: Vector3, extra_spread := 0.0) -> bool:
	if not can_fire():
		return false
	_fire_cd = fire_interval
	ammo -= 1
	shots += 1
	recoil = 1.0
	rifle.flash()
	var muzzle := rifle.muzzle.global_position
	var chest := global_position + Vector3(0, lerpf(1.3, 0.85, crouch_k), 0)
	var base_dir := (at - muzzle).normalized()
	var space := get_world_3d().direct_space_state
	var ex := [get_rid()]
	# make sure the barrel is not poking through a wall
	var q0 := PhysicsRayQueryParameters3D.create(chest, muzzle, 1 | 4, ex)
	var from := muzzle
	if not space.intersect_ray(q0).is_empty():
		from = chest
	var s := spread + extra_spread
	var ends: Array[Vector3] = []
	var hit_any := false
	for p in pellets:
		var dir := (base_dir + Vector3(randf_range(-s, s), randf_range(-s, s) * 0.5, randf_range(-s, s))).normalized()
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * 60.0, 1 | 2 | 4 | 8, ex)
		var hit := space.intersect_ray(q)
		var end := from + dir * 60.0
		if not hit.is_empty():
			end = hit.position
			var col: Object = hit.collider
			if col is Soldier:
				var sd := col as Soldier
				var head: bool = hit.position.y > sd.global_position.y + lerpf(1.57, 1.0, sd.crouch_k)
				var dmg := damage * (2.2 if head else 1.0)
				if pellets > 1:
					dmg *= clampf(1.25 - from.distance_to(end) / 11.0, 0.3, 1.0)
				if not hit_any:
					hits += 1
					if head:
						headshots += 1
				hit_any = true
				sd.take_hit(dmg, dir, hit.position, self, head, 0.6 * kick if pellets > 1 else 0.0)
			else:
				if p < 4:
					Fx.impact(hit.position, hit.normal, dir, _surface_of(col))
				if col is RigidBody3D:
					var rb := col as RigidBody3D
					rb.apply_impulse(dir * 4.0 * kick / sqrt(pellets) * clampf(rb.mass, 0.2, 3.0), hit.position - rb.global_position)
				elif col is PhysicalBone3D:
					(col as PhysicalBone3D).apply_impulse(dir * 6.0 * kick / sqrt(pellets), hit.position - (col as PhysicalBone3D).global_position)
		if p < 3:
			ends.append(end)
	for e in ends:
		Fx.tracer(muzzle, e, team)
	Fx.casing(rifle.global_transform, velocity, weapon_id == "shotgun")
	Sfx.play_at(shot_sound if team == 0 else "eshot", muzzle, 2.0 if team == 0 else 0.0, randf_range(0.94, 1.06))
	fired.emit()
	return true


func _surface_of(col: Object) -> String:
	if col is Node and (col as Node).has_meta("surface"):
		return (col as Node).get_meta("surface")
	return "concrete"


func take_hit(dmg: float, dir: Vector3, point: Vector3, attacker: Soldier, head := false, knock := 0.0) -> void:
	if not alive:
		if _ragdoll:
			_push_ragdoll(point, dir * (5.0 + knock * 4.0))
		Fx.blood(point, dir, 0.6)
		return
	hp -= dmg * (1.0 - (armor if not head else armor * 0.3))
	if knock > 0.0:
		stagger += Vector3(dir.x, 0, dir.z).normalized() * knock
	last_attacker = attacker
	var flat := Vector3(dir.x, 0, dir.z).normalized()
	_lean_v += Vector3.UP.cross(flat) * (5.0 if head else 3.2)
	Fx.blood(point, dir, 1.4 if head else 1.0)
	Fx.flash_hit(self)
	Sfx.play_at("hit_flesh", point, 0.0, randf_range(0.9, 1.1))
	hurt.emit(dmg, attacker.global_position if attacker else point - dir)
	if hp <= 0.0:
		hp = 0.0
		die(attacker, head, point, dir * (1.0 + knock * 0.5))


func start_reload() -> void:
	if not alive or reload_t >= 0.0 or ammo >= mag_size:
		return
	reload_t = 0.0
	Sfx.play_at("mag_out", global_position + Vector3.UP, -4.0)


func is_reloading() -> bool:
	return reload_t >= 0.0


func reload_progress() -> float:
	return clampf(reload_t / reload_time, 0.0, 1.0) if reload_t >= 0.0 else 0.0


func _reload_tilt() -> float:
	if reload_t < 0.0:
		return 0.0
	var k := reload_t / reload_time
	return smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.82, 1.0, k))


func _update_reload(delta: float) -> void:
	if reload_t < 0.0:
		rig.left_override = false
		return
	var prev := reload_t
	reload_t += delta
	var k := reload_t / reload_time
	var well := rifle.mag_well.global_position
	var pouch := global_position + Basis(Vector3.UP, body_yaw) * Vector3(-0.12, 1.0, -0.12)
	rig.left_override = true
	if k < 0.18:
		rig.left_target = rifle.grip_l.global_position.lerp(well + Vector3(0, -0.12, 0), k / 0.18)
	elif k < 0.42:
		rig.left_target = (well + Vector3(0, -0.12, 0)).lerp(pouch, (k - 0.18) / 0.24)
	elif k < 0.66:
		rig.left_target = pouch.lerp(well + Vector3(0, -0.1, 0), smoothstep(0.42, 0.66, k))
	elif k < 0.86:
		rig.left_target = (well + Vector3(0, -0.1, 0)).lerp(rifle.grip_l.global_position, (k - 0.66) / 0.2)
	else:
		rig.left_override = false
	var pk := prev / reload_time
	if pk < 0.2 and k >= 0.2:
		_drop_mag()
	if pk < 0.64 and k >= 0.64:
		rifle.mag.visible = true
		Sfx.play_at("mag_in", well, -2.0)
	if pk < 0.8 and k >= 0.8:
		Sfx.play_at("bolt", well, -3.0)
	if reload_t >= reload_time:
		reload_t = -1.0
		ammo = mag_size
		rig.left_override = false


func _drop_mag() -> void:
	if weapon_id == "shotgun":
		return
	rifle.mag.visible = false
	Fx.drop_mag(rifle.mag.global_transform, velocity)


# ---------------------------------------------------------------- death / ragdoll

func die(killer: Soldier, head: bool, point: Vector3, dir: Vector3) -> void:
	alive = false
	reload_t = -1.0
	shape.set_deferred("disabled", true)
	collision_layer = 0
	tree.active = false
	rig.weight = 0.0
	rig.active = false
	rifle.light.visible = false
	if armed:
		Fx.drop_weapon(rifle, dir)
	_start_ragdoll(point, dir * (9.0 if head else 7.0))
	Fx.blood_pool(global_position + Vector3(dir.x, 0, dir.z) * 0.6)
	died.emit(killer, head)


const RAGDOLL := [
	# bone, child (end point), radius, mass
	["Bip01 Pelvis", "Bip01 Spine1", 0.15, 12.0],
	["Bip01 Spine1", "Bip01 Neck", 0.16, 16.0],
	["Bip01 Head", "", 0.11, 5.0],
	["Bip01 L UpperArm", "Bip01 L Forearm", 0.055, 3.0],
	["Bip01 L Forearm", "Bip01 L Hand", 0.045, 2.0],
	["Bip01 R UpperArm", "Bip01 R Forearm", 0.055, 3.0],
	["Bip01 R Forearm", "Bip01 R Hand", 0.045, 2.0],
	["Bip01 L Thigh", "Bip01 L Calf", 0.075, 8.0],
	["Bip01 L Calf", "Bip01 L Foot", 0.055, 4.0],
	["Bip01 R Thigh", "Bip01 R Calf", 0.075, 8.0],
	["Bip01 R Calf", "Bip01 R Foot", 0.055, 4.0],
]


func _start_ragdoll(point: Vector3, impulse: Vector3) -> void:
	_ragdoll = PhysicalBoneSimulator3D.new()
	skel.add_child(_ragdoll)
	var inv := skel.global_transform.affine_inverse()
	var up_s := (inv.basis * Vector3.UP).normalized()
	for e in RAGDOLL:
		var bi := skel.find_bone(e[0])
		if bi < 0:
			continue
		var g := skel.get_bone_global_pose(bi)
		var end: Vector3
		if e[1] == "":
			end = g.origin + up_s * 0.22 / skel.global_transform.basis.get_scale().y
		else:
			end = skel.get_bone_global_pose(skel.find_bone(e[1])).origin
		var child_local := g.affine_inverse() * end   # end point in the bone's own frame
		var half := child_local.length() * 0.5
		var pb := PhysicalBone3D.new()
		pb.name = "PB_" + e[0].replace(" ", "_")
		pb.bone_name = e[0]
		var upv := Vector3.UP
		if absf(child_local.normalized().dot(upv)) > 0.98:
			upv = Vector3.BACK
		var bt := Transform3D()
		bt.basis = Basis.looking_at(child_local, upv)
		bt.origin = bt.basis * Vector3(0, 0, -half)
		pb.body_offset = bt
		pb.joint_offset = Transform3D(Basis(), Vector3(0, 0, half))
		pb.joint_type = PhysicalBone3D.JOINT_TYPE_CONE if e[0] != "Bip01 Pelvis" else PhysicalBone3D.JOINT_TYPE_NONE
		if pb.joint_type == PhysicalBone3D.JOINT_TYPE_CONE:
			var knee: bool = "Calf" in e[0] or "Forearm" in e[0]
			pb.set("joint_constraints/swing_span", 25.0 if knee else 45.0)
			pb.set("joint_constraints/twist_span", 10.0 if knee else 25.0)
		pb.mass = e[3]
		pb.friction = 0.9
		pb.linear_damp = 0.4
		pb.angular_damp = 3.0
		pb.collision_layer = 8
		pb.collision_mask = 1 | 4 | 8
		pb.add_to_group("ragdoll_bones")
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = e[2]
		cap.height = maxf(half * 2.0 + e[2] * 0.5, e[2] * 2.01)
		cs.shape = cap
		cs.rotation.x = PI / 2
		pb.add_child(cs)
		_ragdoll.add_child(pb)
	_ragdoll.physical_bones_start_simulation()
	await get_tree().physics_frame
	_push_ragdoll(point, impulse)


func _push_ragdoll(point: Vector3, impulse: Vector3) -> void:
	var best: PhysicalBone3D
	var bd := 1e9
	for pb in _ragdoll.get_children():
		if pb is PhysicalBone3D:
			var d: float = (pb as PhysicalBone3D).global_position.distance_to(point)
			if d < bd:
				bd = d
				best = pb
			(pb as PhysicalBone3D).apply_central_impulse(impulse * 0.35 * (pb as PhysicalBone3D).mass / 10.0)
	if best:
		best.apply_impulse(impulse * 3.0, point - best.global_position)


func eye_pos() -> Vector3:
	return global_position + Vector3(0, lerpf(1.62, 1.05, crouch_k), 0)


func chest_pos() -> Vector3:
	return global_position + Vector3(0, lerpf(1.25, 0.78, crouch_k), 0)


func head_pos() -> Vector3:
	return global_position + Vector3(0, lerpf(1.65, 1.08, crouch_k), 0)


# ---------------------------------------------------------------- dash / grenade

func can_dash() -> bool:
	return alive and _dash_cd <= 0.0 and _dash_t <= 0.0


func dash(dir: Vector3) -> bool:
	if not can_dash():
		return false
	var d := Vector3(dir.x, 0, dir.z)
	if d.length() < 0.1:
		d = Basis(Vector3.UP, body_yaw) * Vector3.FORWARD
	_dash_dir = d.normalized()
	_dash_t = 0.3
	_dash_cd = 1.1
	Sfx.play_at("dash", global_position + Vector3.UP, -4.0, randf_range(0.95, 1.1))
	Fx.dust_puff(global_position, _dash_dir)
	return true


func dash_ready() -> float:
	return clampf(1.0 - _dash_cd / 1.1, 0.0, 1.0)


func is_throwing() -> bool:
	return _throw_t >= 0.0


func throw_grenade(at: Vector3) -> bool:
	if not alive or grenades <= 0 or _throw_t >= 0.0 or is_reloading():
		return false
	grenades -= 1
	_throw_t = 0.0
	_throw_at = at
	return true


func _update_throw(delta: float) -> void:
	if _throw_t < 0.0:
		return
	var prev := _throw_t
	_throw_t += delta
	var yb := Basis(Vector3.UP, aim_yaw)
	var back := global_position + yb * Vector3(-0.2, 1.75, 0.3)
	var front := global_position + yb * Vector3(-0.15, 1.5, -0.55)
	rig.left_override = true
	if _throw_t < 0.25:
		rig.left_target = rifle.grip_l.global_position.lerp(back, smoothstep(0.0, 0.25, _throw_t))
	elif _throw_t < 0.4:
		rig.left_target = back.lerp(front, smoothstep(0.25, 0.4, _throw_t))
	elif _throw_t < 0.6:
		rig.left_target = front.lerp(rifle.grip_l.global_position, smoothstep(0.4, 0.6, _throw_t))
	if prev < 0.33 and _throw_t >= 0.33:
		var from := global_position + yb * Vector3(-0.15, 1.6, -0.45)
		Grenade.spawn(self, from, _throw_at)
		Sfx.play_at("throw", from, -4.0)
	if _throw_t >= 0.6:
		_throw_t = -1.0
		rig.left_override = false
