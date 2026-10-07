class_name Player
extends CharacterBody3D

const WALK := 3.4
const SPRINT := 6.2
const SWIM := 2.6
const JUMP_V := 4.9
const GRAVITY := 9.81
const REACH := 3.6
const EYE := 1.62
const GRAB_MAX_FORCE := 1100.0
const SLOTS := ["hand", "axe", "pickaxe", "shovel", "spear", "torch", "build", "place"]
const SLOT_NAMES := ["Hand", "Axe", "Pickaxe", "Shovel", "Spear", "Torch", "Build", "Place"]
const BUILD_KINDS := ["plank", "post", "panel", "stone"]
const PLACE_KINDS := ["campfire", "collector", "bed"]
const PLACE_SIZES := {"campfire": Vector3(1.1, 0.3, 1.1), "collector": Vector3(1.3, 1.5, 1.3), "bed": Vector3(1.0, 0.5, 2.1)}
const TP_OFFSET := Vector3(0.45, 0.3, 2.7)

var head := Node3D.new()
var camera := Camera3D.new()
var tool_pivot := Node3D.new()
var tool_models := {}
var vitals := Vitals.new()
var body := HumanModel.new()
var yaw := 0.0
var pitch := 0.0
var slot := 0
var build_idx := 0
var place_idx := 0
var stamina := 1.0
var breath := 1.0
var swimming := false
var head_under := false
var third_person := false
var cooldown := 0.0
var held: RigidBody3D = null
var held_dist := 2.0
var held_local := Vector3.ZERO
var build_yaw := 0.0
var build_tilt := 0
var snap := true
var hint := ""
var asleep := false
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
var _torch_light: OmniLight3D
var _torch_burn := 0.0
var _swing_amount := 0.0


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
	add_child(vitals)
	vitals.died.connect(_on_died)
	add_child(body)
	body.set_first_person(true)
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
	_ghost.material_override = _ghost_mat
	_ghost.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ghost.top_level = true
	_ghost.visible = false
	add_child(_ghost)
	_select_slot(0)


func look_toward(target: Vector3) -> void:
	var d := target - global_position
	yaw = atan2(-d.x, -d.z)


## The piece/placeable/tool id the current slot acts as.
func active_tool() -> String:
	match SLOTS[slot]:
		"build":
			return BUILD_KINDS[build_idx]
		"place":
			return PLACE_KINDS[place_idx]
	return SLOTS[slot]


func can_act() -> bool:
	return Game.playing and not Game.ui_open and not asleep and not vitals.dead and not get_tree().paused


# ---------------------------------------------------------------- input

func _unhandled_input(event: InputEvent) -> void:
	if get_tree().paused or not Game.playing:
		return
	if event.is_action_pressed("inventory") and not vitals.dead:
		Game.hud.toggle_survival_panel()
		return
	if Game.ui_open or vitals.dead:
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
	_refresh_tool_model()
	if Game.hud:
		Game.hud.set_slot(slot)


func _refresh_tool_model() -> void:
	var t := active_tool()
	if SLOTS[slot] == "build":
		t = "build_" + t
	elif SLOTS[slot] == "place":
		t = "place"
	for k in tool_models:
		tool_models[k].visible = (k == t) and not third_person
	body.hold(t, tool_models.get(t))
	if _torch_light:
		_torch_light.visible = SLOTS[slot] == "torch" and Game.has_tool("torch")


func toggle_camera() -> void:
	third_person = not third_person
	body.set_first_person(not third_person)
	_refresh_tool_model()


# ---------------------------------------------------------------- physics

func _physics_process(delta: float) -> void:
	rotation.y = yaw
	head.rotation.x = pitch
	var wh := Game.water_height(global_position.x, global_position.z)
	var depth := wh - global_position.y
	swimming = depth > 1.25
	head_under = (wh - (global_position.y + EYE + 0.05)) > 0.0

	var active := can_act()
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back") if active else Vector2.ZERO
	var wish := Basis(Vector3.UP, yaw) * Vector3(input.x, 0, input.y)
	var tired := vitals.energy < 12.0 or vitals.food <= 0.0
	var sprinting := active and Input.is_action_pressed("sprint") and input.y < 0.0 and stamina > 0.05 and not swimming and not tired
	var load_mult := clampf(1.0 - maxf(Game.carried_weight() - Items.MAX_CARRY, 0.0) / 80.0, 0.45, 1.0)

	if swimming:
		var look := camera.global_basis * Vector3(input.x, 0, input.y)
		if third_person:
			look = Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch) * Vector3(input.x, 0, input.y)
		var target := look * SWIM * load_mult
		if active and Input.is_action_pressed("jump"):
			target.y = SWIM * 0.9
		elif active and Input.is_action_pressed("crouch"):
			target.y = -SWIM
		elif not head_under or breath < 0.1:
			# float with chest at the surface, bobbing on the waves
			target.y = clampf((wh - 1.3 - global_position.y) * 3.0, -2.0, 2.0)
		else:
			target.y = maxf(target.y, 0.35)
		velocity = velocity.lerp(target, 1.0 - exp(-2.8 * delta))
		if is_on_wall() and active and Input.is_action_pressed("jump") and depth < 1.7:
			velocity.y = 3.5
	else:
		var speed := (SPRINT if sprinting else WALK) * load_mult
		if tired:
			speed *= 0.75
		if depth > 0.3:
			speed *= lerpf(1.0, 0.5, clampf((depth - 0.3) / 0.9, 0.0, 1.0))
		var accel := 11.0 if is_on_floor() else 1.8
		var k := 1.0 - exp(-accel * delta)
		velocity.x = lerpf(velocity.x, wish.x * speed, k)
		velocity.z = lerpf(velocity.z, wish.z * speed, k)
		if not is_on_floor():
			velocity.y -= GRAVITY * delta
			_fall_speed = maxf(_fall_speed, -velocity.y)
		if active and is_on_floor() and Input.is_action_just_pressed("jump"):
			velocity.y = JUMP_V
			stamina = maxf(stamina - 0.05, 0.0)

	if sprinting and wish.length() > 0.1:
		stamina = maxf(stamina - delta * 0.13, 0.0)
	else:
		var regen := 0.2 if vitals.food > 15.0 and vitals.water > 15.0 else 0.08
		stamina = minf(stamina + delta * regen, 1.0)
	breath = clampf(breath + (-delta / 28.0 if head_under else delta * 0.5), 0.0, 1.0)
	if breath <= 0.0:
		vitals.hurt(12.0 * delta)

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
		if _fall_speed > 9.0:
			vitals.hurt((_fall_speed - 9.0) * 9.0, "That was a hard fall")
			Game.sfx.play("hurt")
	if on_floor:
		_fall_speed = 0.0
		var hs := Vector2(velocity.x, velocity.z).length()
		_step += hs * delta
		if _step > (2.4 if sprinting else 1.9):
			_step = 0.0
			_footstep(-10.0)
	_was_floor = on_floor

	_update_needs(delta, sprinting, depth)
	_update_held(delta)


func _update_needs(delta: float, sprinting: bool, depth: float) -> void:
	var hours := Game.day_night.last_hours_step if Game.day_night else 0.0
	if hours <= 0.0 or asleep:
		return
	var exertion := 1.0
	if sprinting:
		exertion = 1.8
	elif swimming:
		exertion = 1.5
	# wetness: water soaks you, rain slowly, sun and fire dry you
	var rain := Game.weather.rain if Game.weather else 0.0
	var fire := _fire_warmth()
	if depth > 0.4:
		vitals.wetness = 1.0
	else:
		var dry := 0.35 + Game.day_night.daylight * 0.5 + fire * 2.5
		vitals.wetness = clampf(vitals.wetness + (rain * 0.9 - dry * (1.0 - rain)) * hours, 0.0, 1.0)
	var day := Game.day_night.daylight
	var wind := Game.weather.wind if Game.weather else 0.2
	var amb := 20.0 + 9.0 * day - 5.0 * rain - 3.0 * wind
	if depth > 0.8:
		amb -= 5.0
	amb -= vitals.wetness * 5.0
	amb += fire * 16.0
	vitals.ambient_temp = amb
	vitals.advance(hours, exertion)


func _fire_warmth() -> float:
	var best := 0.0
	for c in get_tree().get_nodes_in_group("campfires"):
		var d: float = c.global_position.distance_to(global_position)
		best = maxf(best, 1.0 - smoothstep(1.0, 5.0, d))
	if SLOTS[slot] == "torch" and Game.has_tool("torch"):
		best = maxf(best, 0.15)
	return best


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
	_camera_fx(delta)
	_update_torch(delta)
	body.swing = _swing_amount
	body.injured = vitals.health < 30.0 or vitals.energy < 8.0
	body.animate(delta, Vector2(velocity.x, velocity.z).length(), is_on_floor(), swimming, velocity.y)
	hint = ""
	if not can_act():
		_ghost.visible = false
		return
	for i in SLOTS.size():
		if Input.is_action_just_pressed("slot_%d" % (i + 1)):
			_select_slot(i)
	if Input.is_action_just_pressed("camera_toggle"):
		toggle_camera()
	if Input.is_action_just_pressed("cycle"):
		if SLOTS[slot] == "build":
			build_idx = (build_idx + 1) % BUILD_KINDS.size()
		elif SLOTS[slot] == "place":
			place_idx = (place_idx + 1) % PLACE_KINDS.size()
		_refresh_tool_model()
		Game.hud.set_slot(slot)
	if Input.is_action_just_pressed("eat"):
		_quick_eat()
	if OS.get_cmdline_user_args().has("--walk"):
		Input.action_press("move_forward")
	if Input.is_action_just_pressed("rotate"):
		build_yaw += deg_to_rad(15.0)
	if Input.is_action_just_pressed("rotate_back"):
		build_yaw -= deg_to_rad(15.0)
	if Input.is_action_just_pressed("tilt"):
		build_tilt = (build_tilt + 1) % 3
	if Input.is_action_just_pressed("snap"):
		snap = not snap
		Game.toast.emit("Grid snap " + ("ON" if snap else "OFF"))

	var tool := active_tool()
	_update_ghost(tool)
	var look := _look(REACH + 1.0)
	_update_hint(look, tool)

	if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		return
	if Input.is_action_just_pressed("interact"):
		_interact(look)
	match SLOTS[slot]:
		"hand":
			if Input.is_action_just_pressed("primary") and held == null:
				_try_grab(look)
			elif Input.is_action_just_released("primary") and held:
				_release()
			if Input.is_action_just_pressed("secondary") and held:
				_throw()
		"axe", "pickaxe":
			if Input.is_action_pressed("primary") and cooldown <= 0.0 and _require_tool(tool):
				_swing(tool)
		"shovel":
			if _require_tool("shovel"):
				if Input.is_action_pressed("primary") and cooldown <= 0.0:
					_dig(look)
				elif Input.is_action_pressed("secondary") and cooldown <= 0.0:
					_fill(look)
		"spear":
			if Input.is_action_just_pressed("primary") and cooldown <= 0.0 and _require_tool("spear"):
				_thrust()
		"place":
			if Input.is_action_just_pressed("primary"):
				_place_object(tool)
		"build":
			if Input.is_action_just_pressed("primary"):
				_place_piece(tool)


func _require_tool(id: String) -> bool:
	if Game.has_tool(id):
		return true
	if Input.is_action_just_pressed("primary"):
		Game.toast.emit("You have no %s — craft one (Tab)" % Items.item_name(id))
	return false


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
	if third_person:
		# pull the camera in when terrain or walls are behind the player
		var want := head.global_transform * TP_OFFSET
		var hit := Game.cast_ray(head.global_position, want, Game.L_TERRAIN | Game.L_STRUCT | Game.L_TREES, [get_rid()])
		var dist := TP_OFFSET.length()
		if not hit.is_empty():
			dist = maxf(head.global_position.distance_to(hit["position"]) - 0.25, 0.4)
		camera.position = camera.position.lerp(TP_OFFSET.normalized() * dist, 1.0 - exp(-12.0 * delta))
	else:
		camera.position = Vector3(cos(_bob) * 0.025 * amp, absf(sin(_bob)) * 0.05 * amp - _land_dip, 0)
	var sprint := Input.is_action_pressed("sprint") and hs > WALK + 0.5
	camera.fov = lerpf(camera.fov, Settings.fov + (7.0 if sprint else 0.0), 1.0 - exp(-6.0 * delta))
	if not _swinging:
		tool_pivot.position = tool_pivot.position.lerp(Vector3(0.3 + cos(_bob) * 0.012 * amp, -0.28 - absf(sin(_bob)) * 0.02 * amp, -0.46), 1.0 - exp(-10.0 * delta))
	var cam_under := Game.water_height(camera.global_position.x, camera.global_position.z) - camera.global_position.y > 0.05
	if Game.day_night:
		Game.day_night.underwater = cam_under
	if Game.sfx:
		Game.sfx.muffled = 1.0 if cam_under else 0.0
	if Game.hud:
		Game.hud.set_underwater(1.0 if cam_under else 0.0)
	if Game.world:
		Game.world.grass_material.set_shader_parameter("player_pos", global_position)


func _update_torch(delta: float) -> void:
	var lit: bool = SLOTS[slot] == "torch" and Game.has_tool("torch")
	if _torch_light:
		_torch_light.visible = lit
		if lit:
			_torch_light.light_energy = 1.6 + sin(Time.get_ticks_msec() * 0.013) * 0.15 + randf() * 0.15
			if third_person:
				_torch_light.global_position = global_position + Vector3(0, 1.7, 0) - global_basis.z * 0.4
			else:
				_torch_light.position = Vector3(0.0, 0.3, -0.05)
	if lit:
		_torch_burn += delta
		if _torch_burn >= 1.0:
			_torch_burn -= 1.0
			if not Game.use_tool("torch"):
				_refresh_tool_model()


## Ray from the eyes (in third person the camera sits behind, so start the ray level with the head).
func _look(dist: float, mask: int = Game.L_TERRAIN | Game.L_PROPS | Game.L_STRUCT | Game.L_TREES) -> Dictionary:
	var fwd := -camera.global_basis.z
	var from := camera.global_position
	if third_person:
		from += fwd * fwd.dot(head.global_position - camera.global_position)
	var to := from + fwd * dist
	var ex: Array[RID] = [get_rid()]
	if held:
		ex.append(held.get_rid())
	return Game.cast_ray(from, to, mask, ex)


func _reach_ok(look: Dictionary) -> bool:
	return head.global_position.distance_to(look["position"]) < REACH + 0.3


func _update_hint(look: Dictionary, tool: String) -> void:
	if held:
		hint = "Release LMB to drop   ·   RMB to throw   (%.0f kg)" % held.mass
		return
	if SLOTS[slot] == "spear":
		hint = "Fishing spear (%d) — LMB to thrust at fish in the water" % int(Game.tools.get("spear", 0)) if Game.has_tool("spear") else "No spear — craft one (Tab)"
	if look.is_empty() or not _reach_ok(look):
		return
	var col = look["collider"]
	if col is PhysicsItem and not (col is Boulder) and not (col is StructurePiece and not col.loose):
		hint = "[E] Pick up %s   ·   Hand: hold LMB to carry" % col.display_name
	elif col is Boulder:
		hint = "Boulder (%.0f kg) — Pickaxe to break" % col.mass
	elif col is StructurePiece:
		hint = "%s — support %d%%  ·  %s to dismantle" % [col.display_name, int(col.support * 100.0), "Axe" if col.is_wood() else "Pickaxe"]
	elif col is Campfire:
		if col.cooking > 0:
			hint = "Cooking %d fish…" % col.cooking
		else:
			hint = "[E] Cook raw fish (%d)" % Game.count("fish_raw") if Game.count("fish_raw") > 0 else "Campfire — warm yourself, cook fish here"
	elif col is RainCollector:
		hint = "[E] Drink rainwater (%d sips)" % int(col.water)
	elif col is Bed:
		hint = "[E] Sleep until morning"
	elif col is BerryBush:
		hint = "[E] Pick berries" if col.ripe() else ("Berries will grow back tomorrow" if col.has_berries else "")
	elif col is StaticBody3D and col.get_parent() is IslandTree:
		var tree: IslandTree = col.get_parent()
		hint = "Palm — chop for logs; coconuts may fall" if tree.kind == "palm" else "Tree — use the Axe"
	elif col is RigidBody3D:
		hint = "Felled tree (%.0f kg)" % col.mass
	elif col is StoryCrate:
		hint = "" if col.opened else StoryData.t({"en": "[E] Open the crate", "ar": "[E] افتح الصندوق"})
	elif col is MessageBottle:
		hint = StoryData.t({"en": "[E] Read the message in the bottle", "ar": "[E] اقرأ الرسالة داخل الزجاجة"})
	elif col is Object and (col as Object).has_meta("gull"):
		hint = StoryData.t({"en": "[E] The wounded gull", "ar": "[E] النورس الجريح"})


func _interact(look: Dictionary) -> void:
	if look.is_empty() or not _reach_ok(look):
		return
	var col = look["collider"]
	if col is PhysicsItem and not (col is Boulder) and col != held:
		if col is StructurePiece and not col.loose:
			return
		col.collect()
	elif col is Campfire:
		col.cook_fish()
	elif col is RainCollector:
		col.drink(vitals)
	elif col is Bed:
		sleep_in(col)
	elif col is BerryBush:
		col.pick()
	elif col is StoryCrate:
		col.open()
	elif col is MessageBottle:
		col.read()
	elif col is Object and (col as Object).has_meta("gull") and Game.story:
		Game.story.gull_choice((col as Object).get_meta("gull"))


func _quick_eat() -> void:
	for id in Items.EAT_ORDER:
		if Game.count(id) > 0:
			vitals.eat(id)
			return
	Game.toast.emit("Nothing to eat — find coconuts, berries or fish")


# ---------------------------------------------------------------- sleep & death

func sleep_in(bed: Bed) -> void:
	var t := Game.day_night.time_hours
	var night := t >= 19.0 or t < 5.5
	if not night and vitals.energy > 35.0:
		Game.toast.emit("You're not tired — sleep at night or when exhausted")
		return
	Game.respawn_point = bed.global_position + Vector3(0, 0.6, 0)
	asleep = true
	await Game.hud.fade(1.0, 1.2)
	var hours := fmod(6.5 - t + 24.0, 24.0)
	if not night:
		hours = 4.0
	vitals.advance(hours, 1.0, true)
	var dn := Game.day_night
	dn.time_hours += hours
	if dn.time_hours >= 24.0:
		dn.time_hours -= 24.0
		Game.day_number += 1
	if Game.weather:
		Game.weather.advance(hours, 0.0)
	await get_tree().create_timer(0.6).timeout
	Game.toast.emit("You wake up rested — day %d" % Game.day_number)
	if Game.story:
		Game.story.on_sleep()
	await Game.hud.fade(0.0, 1.2)
	asleep = false
	SaveGame.save_now()


func _on_died() -> void:
	held = null
	Game.sfx.play("hurt")
	Game.hud.show_death()


func respawn() -> void:
	# you lose half of what you carried
	for id in Game.inventory:
		Game.inventory[id] = int(Game.inventory[id]) / 2
	Game.inventory_changed.emit()
	vitals.reset_after_death()
	var p := Game.respawn_point
	if p == Vector3.INF:
		p = get_tree().current_scene.default_spawn()
	global_position = p
	velocity = Vector3.ZERO
	breath = 1.0
	stamina = 1.0


# ---------------------------------------------------------------- grabbing

func _try_grab(look: Dictionary) -> void:
	if look.is_empty():
		return
	var col = look["collider"]
	if col is RigidBody3D and not col.freeze and _reach_ok(look):
		var p: Vector3 = look["position"]
		held = col
		held_dist = clampf(head.global_position.distance_to(p), 1.3, 2.6)
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


func _update_held(_delta: float) -> void:
	if held == null:
		return
	if not is_instance_valid(held) or held.freeze:
		held = null
		return
	var target := head.global_position - camera.global_basis.z * held_dist
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
	tw.tween_property(tool_pivot, "rotation", Vector3(0.9, 0.2, 0.3), 0.14).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(self, "_swing_amount", 0.5, 0.14)
	tw.tween_property(tool_pivot, "rotation", Vector3(-0.9, -0.1, -0.2), 0.11).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.parallel().tween_property(self, "_swing_amount", 0.95, 0.11)
	tw.tween_callback(_apply_hit.bind(tool))
	tw.tween_property(tool_pivot, "rotation", Vector3.ZERO, 0.3).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(self, "_swing_amount", 0.0, 0.3)
	tw.tween_callback(func() -> void: _swinging = false)


func _apply_hit(tool: String) -> void:
	var look := _look(REACH)
	if look.is_empty():
		return
	var col = look["collider"]
	var p: Vector3 = look["position"]
	var n: Vector3 = look["normal"]
	var dir := -camera.global_basis.z
	var used := true
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
	else:
		used = false
	if used:
		Game.use_tool(tool)


func _thrust() -> void:
	cooldown = 0.7
	_swinging = true
	Game.sfx.play("spear", null, -6.0)
	var tw := create_tween()
	tw.tween_property(tool_pivot, "position", Vector3(0.2, -0.22, -0.95), 0.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void:
		var fwd := -camera.global_basis.z
		var from := head.global_position
		var caught := false
		for s in get_tree().get_nodes_in_group("fish_schools"):
			if s.try_spear(from, from + fwd * 2.8):
				caught = true
				break
		Game.use_tool("spear")
		if caught:
			Game.add_item("fish_raw", 1)
			Fx.splash(from + fwd * 2.0, 0.3)
		var tip := from + fwd * 2.4
		if Game.water_height(tip.x, tip.z) > tip.y:
			Game.sfx.play("step_water", tip, -4.0))
	tw.tween_property(tool_pivot, "position", Vector3(0.3, -0.28, -0.46), 0.3)
	tw.tween_callback(func() -> void: _swinging = false)


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
	if look.is_empty() or not (look["collider"] is TerrainChunk) or not _reach_ok(look):
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
	Game.use_tool("shovel")
	Game.on_terrain_edited(p, 1.4)


func _fill(look: Dictionary) -> void:
	if look.is_empty() or not _reach_ok(look):
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
	Game.use_tool("shovel")
	Game.on_terrain_edited(p, 1.3)


func _shovel_anim() -> void:
	_swinging = true
	var tw := create_tween()
	tw.tween_property(tool_pivot, "position", Vector3(0.22, -0.34, -0.72), 0.1)
	tw.parallel().tween_property(self, "_swing_amount", 0.6, 0.1)
	tw.tween_property(tool_pivot, "rotation", Vector3(0.5, 0, 0), 0.08)
	tw.tween_property(tool_pivot, "position", Vector3(0.3, -0.28, -0.46), 0.14)
	tw.parallel().tween_property(tool_pivot, "rotation", Vector3.ZERO, 0.14)
	tw.parallel().tween_property(self, "_swing_amount", 0.0, 0.14)
	tw.tween_callback(func() -> void: _swinging = false)


# ---------------------------------------------------------------- building & placing

func _update_ghost(tool: String) -> void:
	var is_piece: bool = StructurePiece.DEFS.has(tool) and SLOTS[slot] == "build"
	var is_place: bool = SLOTS[slot] == "place"
	if not is_piece and not is_place:
		_ghost.visible = false
		return
	var size: Vector3 = StructurePiece.DEFS[tool]["size"] if is_piece else PLACE_SIZES[tool]
	if _ghost_kind != tool:
		_ghost_kind = tool
		var bm := BoxMesh.new()
		bm.size = size
		_ghost.mesh = bm
	var look := _look(6.0)
	if look.is_empty():
		_ghost.visible = false
		_ghost_ok = false
		return
	var n: Vector3 = look["normal"]
	var col = look["collider"]
	if is_place:
		var b := Basis(Vector3.UP, snappedf(yaw, deg_to_rad(15.0)) + build_yaw)
		_ghost_xf = Transform3D(b, look["position"] + Vector3(0, size.y * 0.5, 0))
		_ghost.global_transform = _ghost_xf
		_ghost.visible = true
		var flat := n.y > 0.75 and (col is TerrainChunk or col is StructurePiece)
		var have := Game.count(tool) > 0
		_ghost_ok = flat and have
		_ghost_mat.albedo_color = Color(0.3, 1.0, 0.4, 0.35) if _ghost_ok else Color(1.0, 0.15, 0.15, 0.35)
		hint = "LMB place %s   ·   B switch   ·   R/Q rotate" % Items.item_name(tool)
		if not have:
			hint = "No %s — craft one (Tab)   ·   B switch" % Items.item_name(tool)
		elif not flat:
			hint = "Needs flat ground"
		return
	var base_yaw := snappedf(yaw, deg_to_rad(15.0))
	var ref: Node3D = null
	if col is StructurePiece and not col.loose:
		ref = col
		base_yaw = col.global_rotation.y
	var bb := Basis(Vector3.UP, base_yaw + build_yaw) * Basis(Vector3.RIGHT, deg_to_rad(45.0 * build_tilt))
	var support := absf(bb.x.dot(n)) * size.x * 0.5 + absf(bb.y.dot(n)) * size.y * 0.5 + absf(bb.z.dot(n)) * size.z * 0.5
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
	_ghost_xf = Transform3D(bb, pos)
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
	hint = "LMB place %s (%d %s)   ·   B switch piece   ·   R/Q rotate   ·   F tilt   ·   G snap   ·   support %d%%" % [
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


func _place_object(kind: String) -> void:
	if not _ghost.visible or not _ghost_ok:
		return
	if not Game.take({kind: 1}):
		return
	var pos := _ghost_xf.origin - Vector3(0, PLACE_SIZES[kind].y * 0.5, 0)
	var rot := _ghost_xf.basis.get_euler().y
	match kind:
		"campfire":
			Campfire.create(pos)
		"collector":
			RainCollector.create(pos, rot)
		"bed":
			Bed.create(pos, rot)
	Game.sfx.play("place", pos)


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
	tool_models["hand"] = Node3D.new()
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
	var spear := Node3D.new()
	_part(spear, _cyl(0.012, 1.3), "handle", Vector3(0, 0, -0.35), Vector3(PI / 2, 0, 0))
	_part(spear, _cyl(0.004, 0.12), "rock", Vector3(0, 0, -1.04), Vector3(-PI / 2, 0, 0))
	tool_models["spear"] = spear
	var torch := Node3D.new()
	_part(torch, _cyl(0.018, 0.45), "handle", Vector3(0, 0.05, 0))
	_part(torch, _cyl(0.035, 0.1), "bark", Vector3(0, 0.3, 0))
	var flame := GPUParticles3D.new()
	flame.amount = 24
	flame.lifetime = 0.5
	var fm := ParticleProcessMaterial.new()
	fm.direction = Vector3.UP
	fm.spread = 10.0
	fm.initial_velocity_min = 0.2
	fm.initial_velocity_max = 0.5
	fm.gravity = Vector3(0, 0.8, 0)
	fm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	fm.emission_sphere_radius = 0.03
	var ramp := GradientTexture1D.new()
	ramp.gradient = Mats.gradient([Color(1.0, 0.9, 0.6, 1), Color(1.0, 0.4, 0.1, 0.8), Color(0.5, 0.1, 0.0, 0.0)])
	fm.color_ramp = ramp
	flame.process_material = fm
	var q := QuadMesh.new()
	q.size = Vector2(0.08, 0.1)
	var qm := Fx.soft_sprite_material(true)
	qm.albedo_color = Color(4.0, 2.4, 1.0)
	q.material = qm
	flame.draw_pass_1 = q
	flame.position.y = 0.36
	torch.add_child(flame)
	tool_models["torch"] = torch
	_torch_light = OmniLight3D.new()
	_torch_light.light_color = Color(1.0, 0.6, 0.3)
	_torch_light.omni_range = 11.0
	_torch_light.shadow_enabled = false
	_torch_light.visible = false
	tool_pivot.add_child(_torch_light)
	for k in BUILD_KINDS:
		var m := Node3D.new()
		var sz: Vector3 = StructurePiece.DEFS[k]["size"]
		var s := 0.18 / maxf(sz.x, maxf(sz.y, sz.z))
		_part(m, _box(sz * s), StructurePiece.DEFS[k]["mat"], Vector3(0, 0.1, 0))
		tool_models["build_" + k] = m
	var cf := Node3D.new()
	_part(cf, _cyl(0.03, 0.2), "bark", Vector3(0, 0.1, 0), Vector3(0, 0, 1.2))
	_part(cf, _cyl(0.03, 0.2), "bark", Vector3(0, 0.12, 0), Vector3(1.2, 0, 0))
	tool_models["place"] = cf
	for k in tool_models:
		var n: Node3D = tool_models[k]
		n.rotation = tilt
		n.position = Vector3(0, -0.12, 0)
		tool_pivot.add_child(n)
