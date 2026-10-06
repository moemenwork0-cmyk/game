class_name Player
extends CharacterBody3D

const WALK := 4.2
const SPRINT := 7.0
const SWIM := 2.6
const JUMP_V := 4.9
const GRAVITY := 9.81
const REACH := 3.6
const EYE := 1.62
const GRAB_MAX_FORCE := 1100.0
const SLOTS := ["hand", "axe", "pickaxe", "shovel", "plank", "post", "panel", "stone", "campfire"]
const SLOT_NAMES := ["Hand", "Axe", "Pickaxe", "Shovel", "Beam", "Post", "Panel", "Stone block", "Campfire"]
const CAMPFIRE_COST := {"log": 2, "stone": 4}

var head := Node3D.new()
var camera := Camera3D.new()
var tool_pivot := Node3D.new()
var tool_models := {}
var yaw := 0.0
var pitch := 0.0
var slot := 0
var stamina := 1.0
var breath := 1.0
var swimming := false
var head_under := false
var cooldown := 0.0
var held: RigidBody3D = null
var held_dist := 2.0
var held_local := Vector3.ZERO
var build_yaw := 0.0
var build_tilt := 0
var snap := true
var hint := ""
var _bob := 0.0
var _step := 0.0
var _was_floor := true
var _fall_speed := 0.0
var _land_dip := 0.0
var _ghost := MeshInstance3D.new()
var _ghost_mat := StandardMaterial3D.new()
var _ghost_kind := ""
var _ghost_xf := Transform3D()
var _ghost_ok := false
var _swinging := false
var _dig_acc := {}
var _fill_acc := 0.0


func _ready() -> void:
	collision_layer = Game.L_PLAYER
	collision_mask = Game.L_TERRAIN | Game.L_PROPS | Game.L_STRUCT | Game.L_TREES
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	head.position.y = EYE
	add_child(head)
	camera.fov = Settings.fov
	camera.near = 0.04
	camera.far = 1200.0
	head.add_child(camera)
	camera.current = true
	tool_pivot.position = Vector3(0.3, -0.28, -0.46)
	tool_pivot.scale = Vector3.ONE * 0.8
	camera.add_child(tool_pivot)
	_build_tools()
	floor_max_angle = deg_to_rad(52.0)
	floor_snap_length = 0.35
	floor_stop_on_slope = true
	floor_block_on_wall = false

	_ghost_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_ghost_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_ghost_mat.albedo_color = Color(0.3, 1.0, 0.4, 0.35)
	_ghost_mat.no_depth_test = false
	_ghost.material_override = _ghost_mat
	_ghost.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ghost.top_level = true
	_ghost.visible = false
	add_child(_ghost)
	_select_slot(0)


func look_toward(target: Vector3) -> void:
	var d := target - global_position
	yaw = atan2(-d.x, -d.z)


# ---------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if get_tree().paused:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * Settings.mouse_sens
		pitch = clampf(pitch - event.relative.y * Settings.mouse_sens, deg_to_rad(-88), deg_to_rad(88))
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_select_slot((slot + SLOTS.size() - 1) % SLOTS.size())
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_select_slot((slot + 1) % SLOTS.size())
		elif Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _select_slot(i: int) -> void:
	if held and i != 0:
		_release()
	slot = i
	for k in tool_models:
		tool_models[k].visible = (k == SLOTS[slot])
	if Game.hud:
		Game.hud.set_slot(slot)


# ---------------------------------------------------------------- physics

func _physics_process(delta: float) -> void:
	rotation.y = yaw
	head.rotation.x = pitch
	var wh := Game.water_height(global_position.x, global_position.z)
	var depth := wh - global_position.y
	swimming = depth > 1.25
	head_under = (wh - camera.global_position.y) > 0.05

	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var wish := Basis(Vector3.UP, yaw) * Vector3(input.x, 0, input.y)
	var sprinting := Input.is_action_pressed("sprint") and input.y < 0.0 and stamina > 0.05 and not swimming

	if swimming:
		var look := camera.global_basis * Vector3(input.x, 0, input.y)
		var target := look * SWIM
		if Input.is_action_pressed("jump"):
			target.y = SWIM * 0.9
		elif Input.is_action_pressed("crouch"):
			target.y = -SWIM
		elif not head_under or breath < 0.1:
			# float with chest at the surface, bobbing on the waves
			target.y = clampf((wh - 1.3 - global_position.y) * 3.0, -2.0, 2.0)
		else:
			target.y = maxf(target.y, 0.35)
		velocity = velocity.lerp(target, 1.0 - exp(-2.8 * delta))
		if is_on_wall() and Input.is_action_pressed("jump") and depth < 1.7:
			velocity.y = 3.5
	else:
		var speed := SPRINT if sprinting else WALK
		if depth > 0.3:
			speed *= lerpf(1.0, 0.5, clampf((depth - 0.3) / 0.9, 0.0, 1.0))
		var accel := 11.0 if is_on_floor() else 1.8
		var k := 1.0 - exp(-accel * delta)
		velocity.x = lerpf(velocity.x, wish.x * speed, k)
		velocity.z = lerpf(velocity.z, wish.z * speed, k)
		if not is_on_floor():
			velocity.y -= GRAVITY * delta
			_fall_speed = maxf(_fall_speed, -velocity.y)
		if is_on_floor() and Input.is_action_just_pressed("jump"):
			velocity.y = JUMP_V
			stamina = maxf(stamina - 0.05, 0.0)

	if sprinting and wish.length() > 0.1:
		stamina = maxf(stamina - delta * 0.13, 0.0)
	else:
		stamina = minf(stamina + delta * 0.2, 1.0)
	breath = clampf(breath + (-delta / 28.0 if head_under else delta * 0.5), 0.0, 1.0)

	# soft world boundary: currents push you back
	var hr := Vector2(global_position.x, global_position.z)
	if hr.length() > 44.0:
		var push := -hr.normalized() * (hr.length() - 44.0) * 2.0
		velocity.x += push.x * delta * 4.0
		velocity.z += push.y * delta * 4.0

	var pre_v := velocity
	move_and_slide()
	_push_bodies(pre_v, delta)

	var on_floor := is_on_floor()
	if on_floor and not _was_floor and _fall_speed > 4.0:
		_land_dip = clampf(_fall_speed * 0.018, 0.0, 0.14)
		_footstep(-2.0 + minf(_fall_speed, 10.0))
	if on_floor:
		_fall_speed = 0.0
		var hs := Vector2(velocity.x, velocity.z).length()
		_step += hs * delta
		if _step > (2.4 if sprinting else 1.9):
			_step = 0.0
			_footstep(-10.0)
	_was_floor = on_floor

	_update_held(delta)


func _push_bodies(pre_v: Vector3, delta: float) -> void:
	for i in get_slide_collision_count():
		var c := get_slide_collision(i)
		var col := c.get_collider()
		if col is RigidBody3D and not col.freeze and col != held:
			var n := -c.get_normal()
			n.y = maxf(n.y, 0.0)
			var force := clampf(Vector2(pre_v.x, pre_v.z).length(), 0.0, 7.0) * 55.0
			col.apply_impulse(n * force * delta, c.get_position() - col.global_position)


func _footstep(vol: float) -> void:
	if Game.sfx == null:
		return
	var wh := Game.water_height(global_position.x, global_position.z)
	if wh - global_position.y > 0.15:
		Game.sfx.play("step_water", null, vol)
		return
	var m := Game.world.material_at(global_position + Vector3(0, -0.3, 0))
	var id := "step_grass"
	if m == VoxelWorld.MAT_SAND:
		id = "step_sand"
	elif m == VoxelWorld.MAT_STONE:
		id = "step_stone"
	var floor_obj: Object = null
	for i in get_slide_collision_count():
		if get_slide_collision(i).get_normal().y > 0.6:
			floor_obj = get_slide_collision(i).get_collider()
	if floor_obj is StructurePiece:
		id = "step_stone" if not floor_obj.is_wood() else "wood"
		vol -= 8.0
	Game.sfx.play(id, null, vol, 0.15)


# ---------------------------------------------------------------- per-frame

func _process(delta: float) -> void:
	if get_tree().paused:
		return
	cooldown = maxf(cooldown - delta, 0.0)
	for i in SLOTS.size():
		if Input.is_action_just_pressed("slot_%d" % (i + 1)):
			_select_slot(i)
	if Input.is_action_just_pressed("rotate"):
		build_yaw += deg_to_rad(15.0)
	if Input.is_action_just_pressed("rotate_back"):
		build_yaw -= deg_to_rad(15.0)
	if Input.is_action_just_pressed("tilt"):
		build_tilt = (build_tilt + 1) % 3
	if Input.is_action_just_pressed("snap"):
		snap = not snap
		Game.toast.emit("Grid snap " + ("ON" if snap else "OFF"))

	_camera_fx(delta)
	hint = ""
	var tool: String = SLOTS[slot]
	_update_ghost(tool)
	var look := _look(REACH + 1.0)
	_update_hint(look, tool)

	if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		return
	if Input.is_action_just_pressed("interact"):
		_interact(look)
	match tool:
		"hand":
			if Input.is_action_just_pressed("primary") and held == null:
				_try_grab(look)
			elif Input.is_action_just_released("primary") and held:
				_release()
			if Input.is_action_just_pressed("secondary") and held:
				_throw()
		"axe", "pickaxe":
			if Input.is_action_pressed("primary") and cooldown <= 0.0:
				_swing(tool)
		"shovel":
			if Input.is_action_pressed("primary") and cooldown <= 0.0:
				_dig(look)
			elif Input.is_action_pressed("secondary") and cooldown <= 0.0:
				_fill(look)
		"campfire":
			if Input.is_action_just_pressed("primary"):
				_place_campfire(look)
		_:
			if Input.is_action_just_pressed("primary"):
				_place_piece(tool)


func _camera_fx(delta: float) -> void:
	var hs := Vector2(velocity.x, velocity.z).length()
	var amp := 0.0
	if is_on_floor():
		_bob += delta * hs * 1.9
		amp = clampf(hs / SPRINT, 0.0, 1.0)
	elif swimming:
		_bob += delta * 1.5
		amp = 0.3
	_land_dip = move_toward(_land_dip, 0.0, delta * 0.5)
	camera.position = Vector3(cos(_bob) * 0.025 * amp, absf(sin(_bob)) * 0.05 * amp - _land_dip, 0)
	var sprint := Input.is_action_pressed("sprint") and hs > WALK + 0.5
	camera.fov = lerpf(camera.fov, Settings.fov + (7.0 if sprint else 0.0), 1.0 - exp(-6.0 * delta))
	if not _swinging:
		tool_pivot.position = tool_pivot.position.lerp(Vector3(0.3 + cos(_bob) * 0.012 * amp, -0.28 - absf(sin(_bob)) * 0.02 * amp, -0.46), 1.0 - exp(-10.0 * delta))
	if Game.day_night:
		Game.day_night.underwater = head_under
	if Game.sfx:
		Game.sfx.muffled = 1.0 if head_under else 0.0
	if Game.hud:
		Game.hud.set_underwater(1.0 if head_under else 0.0)
	if Game.world:
		Game.world.grass_material.set_shader_parameter("player_pos", global_position)


func _look(dist: float, mask: int = Game.L_TERRAIN | Game.L_PROPS | Game.L_STRUCT | Game.L_TREES) -> Dictionary:
	var from := camera.global_position
	var to := from - camera.global_basis.z * dist
	var ex: Array[RID] = [get_rid()]
	if held:
		ex.append(held.get_rid())
	return Game.cast_ray(from, to, mask, ex)


func _update_hint(look: Dictionary, tool: String) -> void:
	if held:
		hint = "Release LMB to drop   ·   RMB to throw   (%.0f kg)" % held.mass
		return
	if look.is_empty():
		return
	var col = look["collider"]
	var dist: float = camera.global_position.distance_to(look["position"])
	if col is PhysicsItem and not (col is Boulder) and not (col is StructurePiece and not col.loose):
		if dist < REACH:
			hint = "[E] Pick up %s   ·   Hand: hold LMB to carry" % col.display_name
	elif col is Boulder and dist < REACH:
		hint = "Boulder (%.0f kg) — Pickaxe to break" % col.mass
	elif col is StructurePiece and dist < REACH:
		hint = "%s — support %d%%  ·  %s to dismantle" % [col.display_name, int(col.support * 100.0), "Axe" if col.is_wood() else "Pickaxe"]
	elif col is StaticBody3D and col.get_parent() is IslandTree and dist < REACH:
		hint = "Tree — use the Axe"
	elif col is RigidBody3D and dist < REACH:
		hint = "Felled tree (%.0f kg)" % col.mass


func _interact(look: Dictionary) -> void:
	if look.is_empty():
		return
	var col = look["collider"]
	if camera.global_position.distance_to(look["position"]) > REACH:
		return
	if col is PhysicsItem and not (col is Boulder) and col != held:
		if col is StructurePiece and not col.loose:
			return
		col.collect()


# ---------------------------------------------------------------- grabbing

func _try_grab(look: Dictionary) -> void:
	if look.is_empty():
		return
	var col = look["collider"]
	if col is RigidBody3D and not col.freeze:
		var p: Vector3 = look["position"]
		if camera.global_position.distance_to(p) > REACH:
			return
		held = col
		held_dist = clampf(camera.global_position.distance_to(p), 1.3, 2.6)
		held_local = held.to_local(p)
		held.sleeping = false


func _release() -> void:
	held = null


func _throw() -> void:
	if held == null:
		return
	var dir := -camera.global_basis.z
	held.apply_central_impulse(dir * minf(held.mass * 9.0, 55.0))
	Game.sfx.play("swing", null, -6.0)
	held = null


func _update_held(delta: float) -> void:
	if held == null:
		return
	if not is_instance_valid(held) or held.freeze:
		held = null
		return
	var target := camera.global_position - camera.global_basis.z * held_dist
	var gp := held.to_global(held_local)
	var err := target - gp
	if err.length() > 2.2:
		held = null
		return
	var r := gp - held.global_position
	var v := held.linear_velocity + held.angular_velocity.cross(r)
	var f := (err * 160.0 - v * 22.0) * held.mass + Vector3.UP * held.mass * GRAVITY
	if f.length() > GRAB_MAX_FORCE:
		f = f.normalized() * GRAB_MAX_FORCE
	held.apply_force(f, r)
	held.apply_torque(-held.angular_velocity * held.mass * 0.25)
	held.sleeping = false


# ---------------------------------------------------------------- tools

func _swing(tool: String) -> void:
	cooldown = 0.62
	_swinging = true
	Game.sfx.play("swing", null, -12.0)
	var tw := create_tween()
	var rest := Vector3.ZERO
	tw.tween_property(tool_pivot, "rotation", Vector3(0.9, 0.2, 0.3), 0.14).set_trans(Tween.TRANS_SINE)
	tw.tween_property(tool_pivot, "rotation", Vector3(-0.9, -0.1, -0.2), 0.11).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(_apply_hit.bind(tool))
	tw.tween_property(tool_pivot, "rotation", rest, 0.3).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: _swinging = false)


func _apply_hit(tool: String) -> void:
	var look := _look(REACH)
	if look.is_empty():
		return
	var col = look["collider"]
	var p: Vector3 = look["position"]
	var n: Vector3 = look["normal"]
	var dir := -camera.global_basis.z
	if col is StaticBody3D and col.get_parent() is IslandTree:
		if tool == "axe":
			col.get_parent().hit(dir, p)
		else:
			Game.sfx.play("wood", p)
	elif col is Boulder:
		if tool == "pickaxe":
			col.hit(p, dir)
		else:
			Game.sfx.play("rock", p, -4.0)
			Fx.burst(p, Color(1.0, 0.8, 0.4), 5, 3.0, 0.02, 0.3)
	elif col is StructurePiece and not col.loose:
		var right: bool = (tool == "axe") == col.is_wood()
		col.damage(p, 2 if right else 1)
	elif col is RigidBody3D:
		col.apply_impulse(dir * 40.0, p - col.global_position)
		Game.sfx.play("wood", p, -4.0)
	elif col is TerrainChunk and tool == "pickaxe":
		var got := Game.world.edit_sphere(p - n * 0.2, 1.1, -1.4)
		Fx.burst(p, Color(0.45, 0.42, 0.38), 12, 3.0, 0.05, 1.0)
		Game.sfx.play("rock", p)
		_collect_terrain(got)
		Game.on_terrain_edited(p, 1.1)
	elif col is TerrainChunk:
		Game.sfx.play("dig", p, -6.0)


func _collect_terrain(got: Dictionary) -> void:
	for m in got:
		var id := "dirt"
		if m == VoxelWorld.MAT_SAND:
			id = "sand"
		elif m == VoxelWorld.MAT_STONE:
			id = "stone"
		_dig_acc[id] = float(_dig_acc.get(id, 0.0)) + float(got[m]) * (1.0 if id == "stone" else 2.0)
		var whole := int(_dig_acc[id])
		if whole > 0:
			_dig_acc[id] -= whole
			Game.add_item(id, whole)


func _dig(look: Dictionary) -> void:
	if look.is_empty() or not (look["collider"] is TerrainChunk):
		return
	var p: Vector3 = look["position"]
	var n: Vector3 = look["normal"]
	cooldown = 0.32
	_shovel_anim()
	var mat := Game.world.material_at(p - n * 0.3)
	var amount := -1.6
	if mat == VoxelWorld.MAT_STONE:
		amount = -0.3
		hint = "Too hard for a shovel — use the pickaxe"
	var got := Game.world.edit_sphere(p - n * 0.25, 1.35, amount)
	var c := Color(0.8, 0.72, 0.52) if mat == VoxelWorld.MAT_SAND else Color(0.3, 0.22, 0.13)
	Fx.burst(p, c, 18, 3.2, 0.06, 1.2)
	Game.sfx.play("dig", p)
	_collect_terrain(got)
	Game.on_terrain_edited(p, 1.4)


func _fill(look: Dictionary) -> void:
	if look.is_empty():
		return
	var id := "dirt" if Game.count("dirt") > 0 else ("sand" if Game.count("sand") > 0 else "")
	if id == "":
		hint = "No dirt or sand — dig some with the shovel"
		return
	var p: Vector3 = look["position"] + look["normal"] * 0.55
	var feet := global_position
	if Vector2(p.x - feet.x, p.z - feet.z).length() < 1.3 and p.y > feet.y - 1.0 and p.y < feet.y + 2.2:
		return
	cooldown = 0.28
	_shovel_anim()
	var mat := VoxelWorld.MAT_DIRT if id == "dirt" else VoxelWorld.MAT_SAND
	var got := Game.world.edit_sphere(p, 1.25, 1.7, mat, (Game.count(id) - _fill_acc) * 0.5)
	for m in got:
		_fill_acc += float(got[m]) * 2.0
	var used := int(ceil(_fill_acc - 0.001))
	if used > 0:
		_fill_acc -= used
		Game.inventory[id] = maxi(Game.count(id) - used, 0)
		Game.inventory_changed.emit()
	Game.sfx.play("dig", p, -3.0)
	Game.on_terrain_edited(p, 1.3)


func _shovel_anim() -> void:
	_swinging = true
	var tw := create_tween()
	tw.tween_property(tool_pivot, "position", Vector3(0.22, -0.34, -0.72), 0.1)
	tw.tween_property(tool_pivot, "rotation", Vector3(0.5, 0, 0), 0.08)
	tw.tween_property(tool_pivot, "position", Vector3(0.3, -0.28, -0.46), 0.14)
	tw.parallel().tween_property(tool_pivot, "rotation", Vector3.ZERO, 0.14)
	tw.tween_callback(func() -> void: _swinging = false)


# ---------------------------------------------------------------- building

func _update_ghost(tool: String) -> void:
	if not StructurePiece.DEFS.has(tool):
		_ghost.visible = false
		return
	if _ghost_kind != tool:
		_ghost_kind = tool
		var bm := BoxMesh.new()
		bm.size = StructurePiece.DEFS[tool]["size"]
		_ghost.mesh = bm
	var look := _look(6.0)
	if look.is_empty():
		_ghost.visible = false
		_ghost_ok = false
		return
	var n: Vector3 = look["normal"]
	var col = look["collider"]
	var base_yaw := snappedf(yaw, deg_to_rad(15.0))
	var ref: Node3D = null
	if col is StructurePiece and not col.loose:
		ref = col
		base_yaw = col.global_rotation.y
	var b := Basis(Vector3.UP, base_yaw + build_yaw) * Basis(Vector3.RIGHT, deg_to_rad(45.0 * build_tilt))
	var size: Vector3 = StructurePiece.DEFS[tool]["size"]
	var support := absf(b.x.dot(n)) * size.x * 0.5 + absf(b.y.dot(n)) * size.y * 0.5 + absf(b.z.dot(n)) * size.z * 0.5
	var pos: Vector3 = look["position"] + n * (support + 0.005)
	if snap and ref:
		var lp := ref.to_local(pos)
		var sn := 0.1
		lp = Vector3(snappedf(lp.x, sn), snappedf(lp.y, sn), snappedf(lp.z, sn))
		# keep the snapped piece flush against the face we hit
		var ln := ref.global_basis.inverse() * n
		var ax := ln.abs().max_axis_index()
		var ls: Vector3 = ref.size
		lp[ax] = signf(ln[ax]) * ls[ax] * 0.5 + signf(ln[ax]) * support
		pos = ref.to_global(lp)
	_ghost_xf = Transform3D(b, pos)
	_ghost.global_transform = _ghost_xf
	_ghost.visible = true
	var free := Game.structures.can_place(tool, _ghost_xf)
	var sup := Game.structures.estimate_support(tool, _ghost_xf)
	var afford := Game.count(StructurePiece.DEFS[tool]["cost"].keys()[0]) >= int(StructurePiece.DEFS[tool]["cost"].values()[0])
	_ghost_ok = free and afford
	var c := Color(0.3, 1.0, 0.4).lerp(Color(1.0, 0.85, 0.2), clampf(1.0 - sup, 0.0, 1.0))
	if sup <= 0.0:
		c = Color(1.0, 0.45, 0.1)
	if not _ghost_ok:
		c = Color(1.0, 0.15, 0.15)
	c.a = 0.38
	_ghost_mat.albedo_color = c
	var cost: Dictionary = StructurePiece.DEFS[tool]["cost"]
	hint = "LMB place %s (%d %s)   ·   R/Q rotate   ·   F tilt   ·   G snap   ·   support %d%%" % [
		StructurePiece.DEFS[tool]["name"], cost.values()[0], cost.keys()[0], int(maxf(sup, 0.0) * 100.0)]
	if not afford:
		hint = "Not enough materials — chop trees (logs are sawn into planks) or mine stone"


func _place_piece(tool: String) -> void:
	if not _ghost.visible or not _ghost_ok:
		return
	var cost: Dictionary = StructurePiece.DEFS[tool]["cost"]
	if not Game.take(cost):
		return
	Game.structures.place(tool, _ghost_xf)
	Game.sfx.play("place", _ghost_xf.origin)


func _place_campfire(look: Dictionary) -> void:
	if look.is_empty() or not (look["collider"] is TerrainChunk):
		return
	var n: Vector3 = look["normal"]
	if n.y < 0.75:
		Game.toast.emit("Too steep for a campfire")
		return
	if not Game.take(CAMPFIRE_COST):
		Game.toast.emit("Campfire needs 2 logs and 4 stones")
		return
	Campfire.create(look["position"])
	Game.sfx.play("place", look["position"])


# ---------------------------------------------------------------- viewmodels

func _part(parent: Node3D, mesh: Mesh, mat_id: String, pos: Vector3, rot: Vector3 = Vector3.ZERO) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = Mats.get_mat(mat_id)
	mi.position = pos
	mi.rotation = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)


func _cyl(r: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r * 1.1
	c.height = h
	c.radial_segments = 10
	c.rings = 1
	return c


func _box(s: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = s
	return b


func _build_tools() -> void:
	var tilt := Vector3(deg_to_rad(-20), deg_to_rad(10), deg_to_rad(-12))
	var hand := Node3D.new()
	tool_models["hand"] = hand
	var axe := Node3D.new()
	_part(axe, _cyl(0.016, 0.55), "handle", Vector3(0, 0.1, 0))
	_part(axe, _box(Vector3(0.022, 0.09, 0.15)), "metal", Vector3(0, 0.33, -0.06))
	_part(axe, _box(Vector3(0.012, 0.12, 0.03)), "metal", Vector3(0, 0.33, -0.14))
	tool_models["axe"] = axe
	var pick := Node3D.new()
	_part(pick, _cyl(0.016, 0.55), "handle", Vector3(0, 0.1, 0))
	_part(pick, _box(Vector3(0.025, 0.035, 0.2)), "metal", Vector3(0, 0.36, -0.08), Vector3(deg_to_rad(-12), 0, 0))
	_part(pick, _box(Vector3(0.025, 0.035, 0.2)), "metal", Vector3(0, 0.36, 0.08), Vector3(deg_to_rad(12), 0, 0))
	tool_models["pickaxe"] = pick
	var shovel := Node3D.new()
	_part(shovel, _cyl(0.015, 0.7), "handle", Vector3(0, 0.05, 0))
	_part(shovel, _box(Vector3(0.16, 0.2, 0.012)), "metal", Vector3(0, 0.47, 0), Vector3(deg_to_rad(8), 0, 0))
	tool_models["shovel"] = shovel
	for k in ["plank", "post", "panel", "stone"]:
		var m := Node3D.new()
		var sz: Vector3 = StructurePiece.DEFS[k]["size"]
		var s := 0.18 / maxf(sz.x, maxf(sz.y, sz.z))
		_part(m, _box(sz * s), StructurePiece.DEFS[k]["mat"], Vector3(0, 0.1, 0))
		tool_models[k] = m
	var cf := Node3D.new()
	_part(cf, _cyl(0.03, 0.2), "bark", Vector3(0, 0.1, 0), Vector3(0, 0, 1.2))
	_part(cf, _cyl(0.03, 0.2), "bark", Vector3(0, 0.12, 0), Vector3(1.2, 0, 0))
	tool_models["campfire"] = cf
	for k in tool_models:
		var n: Node3D = tool_models[k]
		n.rotation = tilt
		n.position = Vector3(0, -0.12, 0)
		tool_pivot.add_child(n)
