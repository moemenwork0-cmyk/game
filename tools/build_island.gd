extends SceneTree
## Imports the generated island (tools/assets/gen_island.py) into Terrain3D data.
##   godot --headless --script res://tools/build_island.gd -- <dir with height.f32 ...>
## Writes res://assets/env/island/data/*.res, assets.tres and shore.res.

const N := 2048
const DATA_DIR := "res://assets/env/island/data"
const OUT := "res://assets/env/island"
## id order must match gen_island.py
const TEXTURES := [
	# name, uv_scale (1/metres per tile), normal depth, roughness mod, detiling
	["coast_sand_01", 0.22, 1.0, 0.0, 0.6],
	["damp_sand", 0.22, 1.0, -0.1, 0.6],
	["coral_gravel", 0.30, 1.0, 0.0, 0.8],
	["coast_sand_rocks_02", 0.18, 1.0, 0.0, 0.6],
	["forest_ground_04", 0.25, 1.0, 0.0, 0.8],
	["leaves_forest_ground", 0.28, 1.0, 0.0, 0.8],
	["aerial_grass_rock", 0.12, 1.0, 0.0, 0.6],
	["cliff_side", 0.06, 1.2, 0.0, 0.3],
	["dark_rock", 0.10, 1.2, 0.0, 0.4],
	["mossy_rock", 0.12, 1.0, 0.0, 0.5],
]


func _initialize() -> void:
	_run()


func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var src: String = args[0] if args.size() > 0 else "."
	var t := Terrain3D.new()
	root.add_child(t)
	await process_frame  # Terrain3D creates its data when it enters the tree
	OS.move_to_trash(ProjectSettings.globalize_path(DATA_DIR)) if DirAccess.dir_exists_absolute(DATA_DIR) else OK
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DATA_DIR))
	t.data_directory = DATA_DIR

	var h := _img(src + "/height.f32", Image.FORMAT_RF)
	var c := _img(src + "/control.u32", Image.FORMAT_RF)
	var col := _img(src + "/color.rgba8", Image.FORMAT_RGBA8)
	t.data.import_images([h, c, col], Vector3(-N / 2.0, 0, -N / 2.0), 0.0, 1.0)
	t.data.save_directory(DATA_DIR)
	print("regions: ", t.data.get_region_count())

	var assets := Terrain3DAssets.new()
	for i in TEXTURES.size():
		var d: Array = TEXTURES[i]
		var ta := Terrain3DTextureAsset.new()
		ta.name = d[0]
		ta.id = i
		ta.albedo_texture = load("res://assets/env/terrain/%s_alb.webp" % d[0])
		ta.normal_texture = load("res://assets/env/terrain/%s_nrm.webp" % d[0])
		ta.uv_scale = d[1]
		ta.normal_depth = d[2]
		ta.roughness = d[3]
		ta.detiling_rotation = d[4]
		ta.detiling_shift = d[4] * 0.5
		assets.set_texture_asset(i, ta)
	print("save assets: ", ResourceSaver.save(assets, OUT + "/assets.tres"))

	# shore distance (metres, + inland) at 4 m resolution, for scatter rules and the ocean
	var sd := _img(src + "/shore.f32", Image.FORMAT_RGF)
	sd.resize(N / 4, N / 4, Image.INTERPOLATE_BILINEAR)
	print("save shore: ", ResourceSaver.save(ImageTexture.create_from_image(sd), OUT + "/shore.res"))
	quit()


func _img(path: String, fmt: Image.Format) -> Image:
	var bytes := FileAccess.get_file_as_bytes(path)
	return Image.create_from_data(N, N, false, fmt, bytes)
