extends CanvasLayer
## Self-update for preview builds. Only on an exported Windows build, only when the
## game is opened: asks GitHub for the latest "build-N" release, and if it is newer than
## this build, downloads the new game data (Jazira.pck) next to the exe, then restarts
## through a tiny batch file (Windows can't replace a file the game is still using).
## Nothing runs in the background and nothing stays running after the game closes.

const REPO := "moemenwork0-cmyk/game"
const API := "https://api.github.com/repos/%s/releases/latest" % REPO
const FILES := ["Jazira.pck", "libterrain.windows.release.x86_64.dll"]

var _http: HTTPRequest
var _panel: PanelContainer
var _label: Label
var _bar: ProgressBar
var _downloading := ""
var _queue: Array = []
var _dir := ""
var _tag := ""


func _ready() -> void:
	layer = 100
	if not OS.has_feature("windows") or OS.has_feature("editor") or OS.get_cmdline_user_args().has("--noupdate"):
		return
	_dir = OS.get_executable_path().get_base_dir()
	_http = HTTPRequest.new()
	_http.timeout = 15.0
	add_child(_http)
	_http.request_completed.connect(_on_release)
	_http.request(API, ["User-Agent: Jazira-updater", "Accept: application/vnd.github+json"])


func _on_release(result: int, code: int, _h: PackedStringArray, body: PackedByteArray) -> void:
	_http.request_completed.disconnect(_on_release)
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		return  # offline or rate-limited: just play the current build
	var j: Variant = JSON.parse_string(body.get_string_from_utf8())
	if typeof(j) != TYPE_DICTIONARY:
		return
	var tag: String = j.get("tag_name", "")
	if not tag.begins_with("build-") or int(tag.trim_prefix("build-")) <= BuildInfo.BUILD:
		return
	_tag = tag
	if _last_attempt() == tag:
		# we already installed this one and are still on the old build: don't loop
		_save_attempt("")
		_show(tag)
		_bar.visible = false
		_label.text = tr("The update could not be installed automatically.\nPlease download it from github.com/%s/releases") % REPO
		await get_tree().create_timer(8.0).timeout
		_panel.queue_free()
		return
	for a in j.get("assets", []):
		if String(a.get("name", "")) in FILES:
			_queue.append([String(a["name"]), String(a["browser_download_url"]), int(a.get("size", 0))])
	if _queue.is_empty():
		return
	_show(tag)
	_http.request_completed.connect(_on_file)
	_next()


func _next() -> void:
	if _queue.is_empty():
		_install()
		return
	var f: Array = _queue.pop_front()
	_downloading = f[0]
	_http.download_file = _dir.path_join(f[0] + ".new")
	_http.timeout = 0.0
	_label.text = tr("Downloading the latest version… %s") % f[0]
	_http.request(f[1], ["User-Agent: Jazira-updater"])


func _on_file(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		_label.text = tr("Update failed - starting the current version.")
		DirAccess.remove_absolute(_dir.path_join(_downloading + ".new"))
		await get_tree().create_timer(2.0).timeout
		_panel.queue_free()
		return
	_next()


func _process(_d: float) -> void:
	if _bar and _downloading != "":
		var total := _http.get_body_size()
		if total > 0:
			_bar.value = float(_http.get_downloaded_bytes()) / total * 100.0


func _install() -> void:
	_label.text = tr("Installing the update…")
	_save_attempt(_tag)
	var exe := OS.get_executable_path().replace("/", "\\")
	var bat := _dir.path_join("jazira_update.bat")
	# The game must have fully closed (and antivirus finished scanning) before its data
	# file can be replaced, so each move is retried for up to a minute.
	var lines := ["@echo off", "setlocal enabledelayedexpansion", "set n=0", "timeout /t 2 /nobreak >nul"]
	for f in FILES:
		var p := _dir.path_join(String(f)).replace("/", "\\")
		var lbl := String(f).get_basename().replace(".", "_")
		lines.append(":retry_%s" % lbl)
		lines.append('if exist "%s.new" move /y "%s.new" "%s" >nul 2>&1' % [p, p, p])
		lines.append('if exist "%s.new" (set /a n+=1 & if !n! lss 60 (timeout /t 1 /nobreak >nul & goto retry_%s))' % [p, lbl])
	lines.append('start "" "%s"' % exe)
	lines.append('del "%~f0"')
	var fa := FileAccess.open(bat, FileAccess.WRITE)
	fa.store_string("\r\n".join(PackedStringArray(lines)) + "\r\n")
	fa.close()
	OS.create_process("cmd.exe", ["/c", bat.replace("/", "\\")])
	get_tree().quit()


## Remembers which release we tried to install, so a failed install is reported
## once instead of being downloaded again and again.
func _save_attempt(tag: String) -> void:
	var cf := ConfigFile.new()
	cf.set_value("update", "tried", tag)
	cf.save("user://update.cfg")


func _last_attempt() -> String:
	var cf := ConfigFile.new()
	if cf.load("user://update.cfg") != OK:
		return ""
	return String(cf.get_value("update", "tried", ""))


func _show(tag: String) -> void:
	_panel = PanelContainer.new()
	_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(520, 120)
	_panel.position -= _panel.custom_minimum_size * 0.5
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.05, 0.07, 0.95)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(20)
	_panel.add_theme_stylebox_override("panel", sb)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 12)
	_panel.add_child(vb)
	var title := Label.new()
	title.text = tr("A new version is available (%s)") % tag
	vb.add_child(title)
	_label = Label.new()
	vb.add_child(_label)
	_bar = ProgressBar.new()
	_bar.custom_minimum_size = Vector2(480, 14)
	vb.add_child(_bar)
	add_child(_panel)
