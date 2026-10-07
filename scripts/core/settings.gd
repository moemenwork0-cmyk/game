extends Node
## Player settings (autoload "Settings"), persisted to user://settings.cfg.

signal changed

const PATH := "user://settings.cfg"
const QUALITY_NAMES := ["Low", "Medium", "High", "Ultra"]

var quality := 2
var render_scale := 1.0
var fullscreen := false
var mouse_sens := 0.0022
var fov := 75.0
var volume := 0.8
var language := "en"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var cf := ConfigFile.new()
	if cf.load(PATH) == OK:
		quality = int(cf.get_value("video", "quality", quality))
		render_scale = float(cf.get_value("video", "render_scale", render_scale))
		fullscreen = bool(cf.get_value("video", "fullscreen", fullscreen))
		fov = float(cf.get_value("video", "fov", fov))
		mouse_sens = float(cf.get_value("input", "mouse_sens", mouse_sens))
		volume = float(cf.get_value("audio", "volume", volume))
		language = String(cf.get_value("game", "language", language))
	else:
		_auto_detect()
		language = "ar" if OS.get_locale_language() == "ar" else "en"
		save()
	apply_window()
	apply_audio()


## First launch: pick a preset that suits the hardware.
func _auto_detect() -> void:
	if OS.has_feature("web"):
		quality = 0
		render_scale = 0.75
		return
	match RenderingServer.get_video_adapter_type():
		RenderingDevice.DEVICE_TYPE_DISCRETE_GPU:
			quality = 2
			render_scale = 1.0
		RenderingDevice.DEVICE_TYPE_INTEGRATED_GPU:
			quality = 0
			render_scale = 0.77
		_:
			quality = 1
			render_scale = 0.85


func save() -> void:
	var cf := ConfigFile.new()
	cf.set_value("video", "quality", quality)
	cf.set_value("video", "render_scale", render_scale)
	cf.set_value("video", "fullscreen", fullscreen)
	cf.set_value("video", "fov", fov)
	cf.set_value("input", "mouse_sens", mouse_sens)
	cf.set_value("audio", "volume", volume)
	cf.set_value("game", "language", language)
	cf.save(PATH)


func set_value(key: String, value: Variant) -> void:
	set(key, value)
	save()
	if key == "fullscreen":
		apply_window()
	elif key == "volume":
		apply_audio()
	changed.emit()


func apply_window() -> void:
	if OS.has_feature("web"):
		return
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if fullscreen else DisplayServer.WINDOW_MODE_WINDOWED)


func apply_audio() -> void:
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(volume, 0.0001)))
