class_name Human
extends Node3D
## A Rocketbox avatar (MIT) with idle / walk / run clips. Root motion is stripped so the parent's
## velocity moves the body; `set_speed()` picks and cross-fades the clip and matches its playback rate.

const ANIMS := {"idle": "m_idle_breathe_01", "walk": "m_walk_neutral_01", "run": "m_run_neutral_01",
	"sit": "m_sit_breathe"}
const CLIP_SPEED := {"idle": 0.0, "walk": 1.35, "run": 3.6}

@export var avatar := "castaway"
var anim: AnimationPlayer
var _state := ""


func _ready() -> void:
	var model: Node3D = load("res://assets/characters/%s/%s.fbx" % [avatar, avatar]).instantiate()
	add_child(model)
	_materials(model)
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	var lib := AnimationLibrary.new()
	for key in ANIMS:
		var a: Animation = (load("res://assets/characters/anims/%s.res" % ANIMS[key]) as Animation).duplicate(true)
		a.loop_mode = Animation.LOOP_LINEAR
		for t in a.get_track_count():
			if a.track_get_type(t) == Animation.TYPE_POSITION_3D and str(a.track_get_path(t)).ends_with(":Bip01"):
				for k in a.track_get_key_count(t):
					var v: Vector3 = a.track_get_key_value(t, k)
					a.track_set_key_value(t, k, Vector3(0, v.y, 0))
		lib.add_animation(key, a)
	anim.add_animation_library("h", lib)
	set_speed(0.0)


var sitting := false


func sit(on: bool) -> void:
	sitting = on
	_state = "sit" if on else ""
	if on:
		anim.play("h/sit", 0.2)
		anim.speed_scale = 1.0
	else:
		set_speed(0.0)


func set_speed(v: float) -> void:
	if sitting:
		return
	var s := "idle" if v < 0.3 else ("walk" if v < 2.4 else "run")
	if s != _state:
		_state = s
		anim.play("h/" + s, 0.25)
	anim.speed_scale = 1.0 if s == "idle" else clampf(v / CLIP_SPEED[s], 0.6, 1.5)


func _materials(model: Node3D) -> void:
	var base := "res://assets/characters/%s/" % avatar
	for mi: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		for i in mi.mesh.get_surface_count():
			var src := mi.mesh.surface_get_material(i)
			var nm := src.resource_name.to_lower() if src else ""
			var m := StandardMaterial3D.new()
			if "opacity" in nm:
				m.albedo_texture = load(base + "opacity.png")
				m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
				m.cull_mode = BaseMaterial3D.CULL_DISABLED
			else:
				var part := "body"
				for p in ["head", "helmet", "tools"]:
					if p in nm and FileAccess.file_exists(base + p + "_color.jpg"):
						part = p
				m.albedo_texture = load(base + part + "_color.jpg")
				m.normal_enabled = true
				m.normal_texture = load(base + part + "_normal.png")
				m.roughness_texture = load(base + part + "_rough.png")
			mi.set_surface_override_material(i, m)
