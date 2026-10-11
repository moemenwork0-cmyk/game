extends Node3D
## Game flow: menu (orbiting camera over the live level) → objective banner → fight →
## kill cam / death → Mission Complete or Mission Failed → restart.

static var quick_restart := false

var level: Level
var player: Player
var enemy: Enemy
var cam: GameCamera
var hud: Hud
var env: Environment
var state := "menu"
var t_start := 0.0
var play_time := 0.0
var _hb_t := 0.0


func _ready() -> void:
	Engine.time_scale = 1.0
	_environment()
	level = Level.new()
	add_child(level)
	level.build()
	Fx.world = self
	player = Player.new()
	player.aim_yaw = -PI / 2
	add_child(player)
	player.global_position = level.player_spawn
	enemy = Enemy.new()
	enemy.level = level
	enemy.player = player
	enemy.aim_yaw = PI
	add_child(enemy)
	enemy.global_position = level.enemy_spawn
	player.target = enemy
	if OS.has_feature("web_android") or OS.has_feature("web_ios"):
		# phone browsers: keep the moonlight, the player's weapon light and one lamp shadowed
		enemy.rifle.light.shadow_enabled = false
		for i in level.lamps.size():
			level.lamps[i].shadow_enabled = i == 0
	cam = GameCamera.new()
	add_child(cam)
	cam.follow = player
	cam.threat = enemy
	cam.current = true
	hud = Hud.new()
	add_child(hud)
	hud.player = player
	hud.enemy = enemy
	hud.cam = cam
	hud.play_pressed.connect(start_game)
	hud.restart_pressed.connect(restart)
	player.fired.connect(func() -> void:
		enemy.hear_shot(player.global_position)
		Fx.shake(0.08))
	enemy.fired.connect(func() -> void: pass)
	player.hurt.connect(func(_a: float, from: Vector3) -> void:
		hud.on_player_hurt(from)
		Fx.shake(0.35)
		Input.vibrate_handheld(40))
	enemy.hurt.connect(func(_a: float, _f: Vector3) -> void:
		hud.on_hit_enemy(enemy.last_attacker == player and enemy.hp > 0 and _last_head()))
	enemy.alerted.connect(hud.on_alert)
	enemy.died.connect(_on_enemy_died)
	player.died.connect(_on_player_died)
	_set_active(false)
	Sfx.ambience.play()
	var dev := OS.get_cmdline_user_args()
	if dev.size() > 0 and ResourceLoader.exists("res://tools/dev_bot.gd"):
		var bot: Node = load("res://tools/dev_bot.gd").new()
		bot.set("main", self)
		add_child(bot)
	if quick_restart:
		quick_restart = false
		hud.start_screen.visible = false
		start_game()
	else:
		cam.mode = GameCamera.Mode.ORBIT
		cam.snap()


var _heads_seen := 0


func _last_head() -> bool:
	var h := player.headshots > _heads_seen
	_heads_seen = player.headshots
	return h


func _environment() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	we.environment = env
	add_child(we)
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.012, 0.014, 0.018)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.36, 0.4, 0.46)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.15
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.ssao_enabled = true
	env.ssao_radius = 1.2
	env.ssao_intensity = 2.2
	env.volumetric_fog_enabled = true
	env.volumetric_fog_density = 0.012
	env.volumetric_fog_albedo = Color(0.8, 0.85, 0.9)
	env.volumetric_fog_emission_energy = 0.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.0
	var moon := DirectionalLight3D.new()
	moon.rotation = Vector3(deg_to_rad(-64), deg_to_rad(28), 0)
	moon.light_color = Color(0.6, 0.7, 1.0)
	moon.light_energy = 0.32
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 28.0
	moon.light_volumetric_fog_energy = 0.0
	add_child(moon)
	if OS.has_feature("web"):
		get_viewport().msaa_3d = Viewport.MSAA_2X
	if OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios"):
		get_viewport().scaling_3d_scale = 0.8
		env.ssao_enabled = false
		env.volumetric_fog_enabled = false


func _set_active(on: bool) -> void:
	for s in [player, enemy]:
		s.set_physics_process(on)


func start_game() -> void:
	state = "play"
	hud.hide_start()
	hud.playing = true
	hud.show_banner()
	cam.mode = GameCamera.Mode.FOLLOW
	_set_active(true)
	t_start = Time.get_ticks_msec() * 0.001
	Sfx.play("stinger", -4.0)
	if DisplayServer.get_name() != "headless" and OS.has_feature("mobile"):
		DisplayServer.screen_set_orientation(DisplayServer.SCREEN_SENSOR_LANDSCAPE)


func _process(delta: float) -> void:
	if state != "play":
		return
	play_time += delta
	# low health: drain colour, heartbeat
	var k := clampf(player.hp / 60.0, 0.0, 1.0) if player.alive else 0.0
	env.adjustment_saturation = lerpf(0.25, 1.0, k)
	if player.alive and player.hp < 35.0:
		_hb_t -= delta
		if _hb_t <= 0.0:
			_hb_t = 0.85
			Sfx.play("heartbeat", -2.0)


func _on_enemy_died(_killer: Soldier, head: bool) -> void:
	if state != "play":
		return
	state = "over"
	hud.on_hit_enemy(head)
	cam.focus = enemy
	cam.mode = GameCamera.Mode.KILLCAM
	Engine.time_scale = 0.22
	Fx.shake(0.5)
	await get_tree().create_timer(0.45, true, false, true).timeout
	var t := create_tween().set_ignore_time_scale(true)
	t.tween_property(Engine, "time_scale", 1.0, 1.2)
	await get_tree().create_timer(2.0, true, false, true).timeout
	cam.mode = GameCamera.Mode.FOLLOW
	Sfx.play("win", -2.0)
	_finish(true)


func _on_player_died(_killer: Soldier, _head: bool) -> void:
	if state != "play":
		return
	state = "over"
	cam.focus = player
	cam.mode = GameCamera.Mode.KILLCAM
	Engine.time_scale = 0.35
	await get_tree().create_timer(0.8, true, false, true).timeout
	Engine.time_scale = 1.0
	await get_tree().create_timer(1.0, true, false, true).timeout
	Sfx.play("lose", -2.0)
	_finish(false)


func _finish(win: bool) -> void:
	var secs := int(play_time)
	var acc := int(round(100.0 * player.hits / maxf(player.shots, 1)))
	hud.show_end(win, {
		"TIME": "%d:%02d" % [secs / 60, secs % 60],
		"ACCURACY": "%d%%" % acc,
		"HEADSHOTS": str(player.headshots),
		"HEALTH": str(int(ceil(maxf(player.hp, 0.0)))),
	})


func restart() -> void:
	quick_restart = true
	Engine.time_scale = 1.0
	hud.fade_out(0.3)
	await get_tree().create_timer(0.32, true, false, true).timeout
	get_tree().reload_current_scene()
