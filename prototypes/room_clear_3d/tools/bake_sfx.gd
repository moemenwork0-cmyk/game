extends SceneTree
## Renders every synthesised sound to assets/sfx/*.wav so the game does not spend
## seconds generating audio at startup (matters most in the browser).
func _init() -> void:
	var sfx = load("res://scripts/sfx.gd").new()
	var all: Dictionary = sfx.synth_everything()
	DirAccess.make_dir_recursive_absolute("res://assets/sfx")
	for id in all:
		var w: AudioStreamWAV = all[id]
		w.save_to_wav("res://assets/sfx/%s.wav" % id)
	print("baked ", all.size(), " sounds")
	sfx.free()
	quit()
