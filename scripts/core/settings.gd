extends Node
## Player settings (autoload "Settings"), persisted to user://settings.cfg.
## SCHEMA drives both persistence and the settings screen: every option the
## game offers is declared once here, with its tab, type, range and default.

signal changed

const PATH := "user://settings.cfg"
const QUALITY_NAMES := ["Low", "Medium", "High", "Ultra"]
const BUSES := ["Music", "SFX", "Ambience", "UI"]

## type: option (options), slider (min/max/step/fmt), toggle, key (rebindable action)
const SCHEMA := [
	# ------------------------------------------------------------ display
	{"key": "window_mode", "tab": "Display", "label": "Display mode", "type": "option",
		"options": ["Windowed", "Borderless fullscreen", "Exclusive fullscreen"], "default": 1, "apply": "window", "desktop": true},
	{"key": "resolution", "tab": "Display", "label": "Window size", "type": "option",
		"options": ["1280 × 720", "1600 × 900", "1920 × 1080", "2560 × 1440", "3840 × 2160"], "default": 2, "apply": "window", "desktop": true},
	{"key": "vsync", "tab": "Display", "label": "V-Sync", "type": "toggle", "default": true, "apply": "window"},
	{"key": "max_fps", "tab": "Display", "label": "Frame rate limit", "type": "option",
		"options": ["Unlimited", "30", "60", "90", "120", "144", "165", "240"], "default": 0, "apply": "window"},
	{"key": "brightness", "tab": "Display", "label": "Brightness", "type": "slider", "min": 50, "max": 150, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "graphics"},
	{"key": "contrast", "tab": "Display", "label": "Contrast", "type": "slider", "min": 70, "max": 130, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "graphics"},
	{"key": "saturation", "tab": "Display", "label": "Colour saturation", "type": "slider", "min": 0, "max": 150, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "graphics"},
	{"key": "fov", "tab": "Display", "label": "Field of view", "type": "slider", "min": 60, "max": 110, "step": 1, "fmt": "%d°", "scale": 1.0, "default": 75.0, "apply": "none"},
	# ------------------------------------------------------------ graphics
	{"key": "quality", "tab": "Graphics", "label": "Quality preset", "type": "option",
		"options": ["Low", "Medium", "High", "Ultra", "Custom"], "default": 2, "apply": "preset"},
	{"key": "render_scale", "tab": "Graphics", "label": "Render resolution", "type": "slider", "min": 50, "max": 100, "step": 5, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "graphics"},
	{"key": "upscaler", "tab": "Graphics", "label": "Upscaling", "type": "option",
		"options": ["Bilinear", "AMD FSR 1.0", "AMD FSR 2.2"], "default": 1, "apply": "graphics"},
	{"key": "antialiasing", "tab": "Graphics", "label": "Anti-aliasing", "type": "option",
		"options": ["Off", "FXAA", "TAA", "FXAA + TAA"], "default": 1, "apply": "graphics"},
	{"key": "shadows", "tab": "Graphics", "label": "Shadow quality", "type": "option",
		"options": ["Low", "Medium", "High", "Ultra"], "default": 2, "apply": "graphics", "custom": true},
	{"key": "shadow_distance", "tab": "Graphics", "label": "Shadow distance", "type": "slider", "min": 30, "max": 150, "step": 5, "fmt": "%d m", "scale": 1.0, "default": 90.0, "apply": "graphics", "custom": true},
	{"key": "ambient_occlusion", "tab": "Graphics", "label": "Ambient occlusion (SSAO)", "type": "option",
		"options": ["Off", "Low", "High"], "default": 1, "apply": "graphics", "custom": true},
	{"key": "indirect_light", "tab": "Graphics", "label": "Indirect lighting (SSIL)", "type": "toggle", "default": false, "apply": "graphics", "custom": true},
	{"key": "reflections", "tab": "Graphics", "label": "Screen-space reflections", "type": "toggle", "default": false, "apply": "graphics", "custom": true},
	{"key": "volumetric_fog", "tab": "Graphics", "label": "Volumetric fog", "type": "toggle", "default": true, "apply": "graphics", "custom": true},
	{"key": "bloom", "tab": "Graphics", "label": "Bloom", "type": "toggle", "default": true, "apply": "graphics"},
	{"key": "grass", "tab": "Graphics", "label": "Vegetation density", "type": "option",
		"options": ["Low", "Medium", "High", "Ultra"], "default": 2, "apply": "graphics", "custom": true},
	{"key": "view_distance", "tab": "Graphics", "label": "Grass draw distance", "type": "slider", "min": 20, "max": 100, "step": 5, "fmt": "%d m", "scale": 1.0, "default": 65.0, "apply": "graphics", "custom": true},
	{"key": "film_grain", "tab": "Graphics", "label": "Film grain", "type": "toggle", "default": true, "apply": "graphics"},
	{"key": "vignette", "tab": "Graphics", "label": "Lens vignette", "type": "toggle", "default": true, "apply": "graphics"},
	{"key": "depth_of_field", "tab": "Graphics", "label": "Depth of field (cinematics)", "type": "toggle", "default": true, "apply": "none"},
	# ------------------------------------------------------------ audio
	{"key": "volume", "tab": "Audio", "label": "Master volume", "type": "slider", "min": 0, "max": 100, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 0.8, "apply": "audio"},
	{"key": "vol_music", "tab": "Audio", "label": "Music & cinematics", "type": "slider", "min": 0, "max": 100, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 0.85, "apply": "audio"},
	{"key": "vol_sfx", "tab": "Audio", "label": "Effects", "type": "slider", "min": 0, "max": 100, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "audio"},
	{"key": "vol_ambience", "tab": "Audio", "label": "Ambience (sea, wind, rain)", "type": "slider", "min": 0, "max": 100, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "audio"},
	{"key": "vol_ui", "tab": "Audio", "label": "Interface", "type": "slider", "min": 0, "max": 100, "step": 1, "fmt": "%d%%", "scale": 100.0, "default": 0.7, "apply": "audio"},
	{"key": "mute_unfocused", "tab": "Audio", "label": "Mute when the game is in the background", "type": "toggle", "default": true, "apply": "none"},
	{"key": "audio_device", "tab": "Audio", "label": "Output device", "type": "device", "default": "Default", "apply": "audio"},
	# ------------------------------------------------------------ controls
	{"key": "mouse_sens", "tab": "Controls", "label": "Mouse sensitivity", "type": "slider", "min": 5, "max": 60, "step": 1, "fmt": "%d", "scale": 10000.0, "default": 0.0022, "apply": "none"},
	{"key": "invert_y", "tab": "Controls", "label": "Invert vertical look", "type": "toggle", "default": false, "apply": "none"},
	{"key": "toggle_sprint", "tab": "Controls", "label": "Sprint: toggle instead of hold", "type": "toggle", "default": false, "apply": "none"},
	{"key": "bind_move_forward", "tab": "Controls", "label": "Move forward", "type": "key", "action": "move_forward"},
	{"key": "bind_move_back", "tab": "Controls", "label": "Move back", "type": "key", "action": "move_back"},
	{"key": "bind_move_left", "tab": "Controls", "label": "Move left", "type": "key", "action": "move_left"},
	{"key": "bind_move_right", "tab": "Controls", "label": "Move right", "type": "key", "action": "move_right"},
	{"key": "bind_jump", "tab": "Controls", "label": "Jump / swim up", "type": "key", "action": "jump"},
	{"key": "bind_sprint", "tab": "Controls", "label": "Sprint", "type": "key", "action": "sprint"},
	{"key": "bind_crouch", "tab": "Controls", "label": "Dive", "type": "key", "action": "crouch"},
	{"key": "bind_interact", "tab": "Controls", "label": "Interact", "type": "key", "action": "interact"},
	{"key": "bind_inventory", "tab": "Controls", "label": "Survival & journal", "type": "key", "action": "inventory"},
	{"key": "bind_eat", "tab": "Controls", "label": "Quick eat", "type": "key", "action": "eat"},
	{"key": "bind_camera_toggle", "tab": "Controls", "label": "First / third person", "type": "key", "action": "camera_toggle"},
	{"key": "bind_cycle", "tab": "Controls", "label": "Switch placeable", "type": "key", "action": "cycle"},
	{"key": "bind_time_skip", "tab": "Controls", "label": "Fast-forward time (hold)", "type": "key", "action": "time_skip"},
	# ------------------------------------------------------------ gameplay
	{"key": "language", "tab": "Gameplay", "label": "Language", "type": "option", "options": ["English", "العربية"], "values": ["en", "ar"], "default": "en", "apply": "language"},
	{"key": "subtitles", "tab": "Gameplay", "label": "Subtitles", "type": "toggle", "default": true, "apply": "none"},
	{"key": "subtitle_size", "tab": "Gameplay", "label": "Subtitle size", "type": "option", "options": ["Small", "Medium", "Large", "Huge"], "default": 1, "apply": "none"},
	{"key": "hud_scale", "tab": "Gameplay", "label": "HUD size", "type": "slider", "min": 75, "max": 140, "step": 5, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "none"},
	{"key": "hud_compass", "tab": "Gameplay", "label": "Show compass", "type": "toggle", "default": true, "apply": "none"},
	{"key": "hud_objective", "tab": "Gameplay", "label": "Show objective", "type": "toggle", "default": true, "apply": "none"},
	{"key": "hud_hints", "tab": "Gameplay", "label": "Show control hints", "type": "toggle", "default": true, "apply": "none"},
	{"key": "crosshair", "tab": "Gameplay", "label": "Crosshair", "type": "toggle", "default": true, "apply": "none"},
	{"key": "camera_shake", "tab": "Gameplay", "label": "Camera shake", "type": "slider", "min": 0, "max": 100, "step": 5, "fmt": "%d%%", "scale": 100.0, "default": 1.0, "apply": "none"},
	{"key": "head_bob", "tab": "Gameplay", "label": "Head bob", "type": "toggle", "default": true, "apply": "none"},
	{"key": "autosave", "tab": "Gameplay", "label": "Autosave", "type": "option", "options": ["Off", "Every 2 minutes", "Every 4 minutes", "Every 10 minutes"], "default": 2, "apply": "none"},
]

## preset → per-feature values (shadows, ao, ssil, ssr, fog, grass, view, shadow distance)
const PRESETS := [
	{"shadows": 0, "ambient_occlusion": 0, "indirect_light": false, "reflections": false, "volumetric_fog": false, "grass": 0, "view_distance": 28.0, "shadow_distance": 45.0},
	{"shadows": 1, "ambient_occlusion": 1, "indirect_light": false, "reflections": false, "volumetric_fog": false, "grass": 1, "view_distance": 45.0, "shadow_distance": 65.0},
	{"shadows": 2, "ambient_occlusion": 1, "indirect_light": false, "reflections": false, "volumetric_fog": true, "grass": 2, "view_distance": 65.0, "shadow_distance": 90.0},
	{"shadows": 3, "ambient_occlusion": 2, "indirect_light": true, "reflections": true, "volumetric_fog": true, "grass": 3, "view_distance": 85.0, "shadow_distance": 110.0},
]

var quality := 2
var render_scale := 1.0
var upscaler := 1
var antialiasing := 1
var shadows := 2
var shadow_distance := 90.0
var ambient_occlusion := 1
var indirect_light := false
var reflections := false
var volumetric_fog := true
var bloom := true
var grass := 2
var view_distance := 65.0
var film_grain := true
var vignette := true
var depth_of_field := true
var window_mode := 1
var resolution := 2
var vsync := true
var max_fps := 0
var brightness := 1.0
var contrast := 1.0
var saturation := 1.0
var fov := 75.0
var volume := 0.8
var vol_music := 0.85
var vol_sfx := 1.0
var vol_ambience := 1.0
var vol_ui := 0.7
var mute_unfocused := true
var audio_device := "Default"
var mouse_sens := 0.0022
var invert_y := false
var toggle_sprint := false
var language := "en"
var subtitles := true
var subtitle_size := 1
var hud_scale := 1.0
var hud_compass := true
var hud_objective := true
var hud_hints := true
var crosshair := true
var camera_shake := 1.0
var head_bob := true
var autosave := 2
## action -> physical keycode the player chose (only overrides are stored)
var bindings := {}
## true the very first time the game runs on this machine
var first_run := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for b in BUSES:
		if AudioServer.get_bus_index(b) < 0:
			AudioServer.add_bus()
			AudioServer.set_bus_name(AudioServer.bus_count - 1, b)
			AudioServer.set_bus_send(AudioServer.bus_count - 1, "Master")
	var cf := ConfigFile.new()
	if cf.load(PATH) == OK:
		for e in SCHEMA:
			if e["type"] == "key":
				continue
			var k: String = e["key"]
			var v: Variant = cf.get_value("settings", k, get(k))
			if typeof(v) == typeof(get(k)) or (typeof(get(k)) == TYPE_FLOAT and typeof(v) == TYPE_INT):
				set(k, v)
		bindings = cf.get_value("settings", "bindings", {})
	else:
		first_run = true
		_auto_detect()
		save()
	Lang.setup()
	Lang.apply(language)
	apply_window()
	apply_audio()


## First launch: pick a preset that suits the hardware.
func _auto_detect() -> void:
	if OS.has_feature("web"):
		_preset(0)
		render_scale = 0.75
		window_mode = 0
		return
	# entry-level laptop chips report as "discrete" but need the Low preset
	var gpu := RenderingServer.get_video_adapter_name().to_upper()
	for weak in ["940M", "930M", "920M", "MX1", "MX2", "MX3", "MX4", "GT 7", "GT 6", "GTX 9", "INTEL", "RADEON(TM) GRAPHICS", "VEGA"]:
		if gpu.contains(weak):
			_preset(0)
			render_scale = 0.75
			return
	match RenderingServer.get_video_adapter_type():
		RenderingDevice.DEVICE_TYPE_DISCRETE_GPU:
			_preset(2)
			render_scale = 1.0
		RenderingDevice.DEVICE_TYPE_INTEGRATED_GPU:
			_preset(0)
			render_scale = 0.77
		_:
			_preset(1)
			render_scale = 0.85


func _preset(q: int) -> void:
	quality = q
	if q < PRESETS.size():
		for k in PRESETS[q]:
			set(k, PRESETS[q][k])


func save() -> void:
	var cf := ConfigFile.new()
	for e in SCHEMA:
		if e["type"] != "key":
			cf.set_value("settings", e["key"], get(e["key"]))
	cf.set_value("settings", "bindings", bindings)
	cf.save(PATH)


func entry(key: String) -> Dictionary:
	for e in SCHEMA:
		if e["key"] == key:
			return e
	return {}


func set_value(key: String, value: Variant) -> void:
	set(key, value)
	var e := entry(key)
	match String(e.get("apply", "none")):
		"preset":
			_preset(int(value))
			_apply_graphics()
		"graphics":
			if e.get("custom", false):
				quality = 4
			_apply_graphics()
		"window":
			apply_window()
		"audio":
			apply_audio()
		"language":
			Lang.apply(language)
	if e.get("custom", false) and e.get("apply", "") != "graphics":
		quality = 4
	save()
	changed.emit()


func _apply_graphics() -> void:
	var main := get_tree().current_scene if get_tree() else null
	if main and main.has_method("apply_quality"):
		main.apply_quality()


func reset_defaults(tab: String) -> void:
	for e in SCHEMA:
		if e["tab"] != tab:
			continue
		if e["type"] == "key":
			bindings.erase(e["action"])
		elif e.has("default"):
			set(e["key"], e["default"])
	if tab == "Graphics":
		_preset(2)
	if tab == "Controls":
		apply_bindings()
	apply_window()
	apply_audio()
	Lang.apply(language)
	_apply_graphics()
	save()
	changed.emit()


func apply_window() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if vsync else DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = [0, 30, 60, 90, 120, 144, 165, 240][clampi(max_fps, 0, 7)]
	if OS.has_feature("web") or DisplayServer.get_name() == "headless" or _scripted_run():
		return
	match window_mode:
		0:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
			var sizes := [Vector2i(1280, 720), Vector2i(1600, 900), Vector2i(1920, 1080), Vector2i(2560, 1440), Vector2i(3840, 2160)]
			var want: Vector2i = sizes[clampi(resolution, 0, 4)]
			var screen := DisplayServer.screen_get_usable_rect().size
			want = Vector2i(mini(want.x, screen.x), mini(want.y, screen.y))
			DisplayServer.window_set_size(want)
			DisplayServer.window_set_position(DisplayServer.screen_get_usable_rect().position + (screen - want) / 2)
		1:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
		2:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)


## Automated runs (tests, screenshots, movie capture) keep the window the harness asked for.
func _scripted_run() -> bool:
	return not OS.get_cmdline_user_args().is_empty() or "--write-movie" in OS.get_cmdline_args()


func apply_audio() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(volume, 0.0001)))
	var vols := {"Music": vol_music, "SFX": vol_sfx, "Ambience": vol_ambience, "UI": vol_ui}
	for b in vols:
		var i := AudioServer.get_bus_index(b)
		if i >= 0:
			AudioServer.set_bus_volume_db(i, linear_to_db(maxf(float(vols[b]), 0.0001)))
	if audio_device in AudioServer.get_output_device_list():
		AudioServer.output_device = audio_device


## Applies the player's key overrides on top of the defaults Game registered.
func apply_bindings() -> void:
	for e in SCHEMA:
		if e["type"] != "key":
			continue
		var action: String = e["action"]
		if not InputMap.has_action(action):
			continue
		if bindings.has(action):
			for ev in InputMap.action_get_events(action):
				if ev is InputEventKey:
					InputMap.action_erase_event(action, ev)
			var k := InputEventKey.new()
			k.physical_keycode = int(bindings[action])
			InputMap.action_add_event(action, k)


func rebind(action: String, keycode: int) -> void:
	bindings[action] = keycode
	apply_bindings()
	save()
	changed.emit()


func key_name(action: String) -> String:
	if not InputMap.has_action(action):
		return "—"
	for ev in InputMap.action_get_events(action):
		if ev is InputEventKey:
			var kc: int = (ev as InputEventKey).physical_keycode
			return OS.get_keycode_string(DisplayServer.keyboard_get_keycode_from_physical(kc) if DisplayServer.get_name() != "headless" else kc)
	return "—"


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and mute_unfocused and not Engine.is_editor_hint():
		AudioServer.set_bus_mute(0, true)
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		AudioServer.set_bus_mute(0, false)
