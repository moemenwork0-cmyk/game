# Builds /Game/Maps/Breach from code, headless:
#   UnrealEditor-Cmd WarGame.uproject -run=pythonscript -script=Tools/Editor/build_breach.py
# Ready-made assets only (Tools/Assets/fetch.py): Poly Haven cliffs, boulders, ground and props.
# Layout: the player starts at the origin looking down +X at a cliff wall 60 m away; the tunnel
# mouth sits in the middle of the wall, plugged by boulders that the breach charges blow apart.
import os
import unreal

PROJECT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
RAW = os.path.join(PROJECT, "Content", "Raw")
DL = os.path.join(RAW, "Downloaded", "PolyHaven")
MEL = unreal.MaterialEditingLibrary
assets = unreal.AssetToolsHelpers.get_asset_tools()
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def import_files(folder, dest):
    tasks = []
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        t = unreal.AssetImportTask()
        t.filename = path
        t.destination_path = dest
        t.destination_name = ("T_" if name.endswith(".png") else "F_") + os.path.splitext(name)[0]
        t.replace_existing = True
        t.automated = True
        t.save = True
        tasks.append(t)
    assets.import_asset_tasks(tasks)
    for t in tasks:
        for p in t.imported_object_paths:
            tex = unreal.load_asset(p)
            if isinstance(tex, unreal.Texture2D):
                tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
                tex.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
                tex.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
                unreal.EditorAssetLibrary.save_loaded_asset(tex)
    unreal.log(f"imported {len(tasks)} files into {dest}")


def spawn(cls, loc=(0, 0, 0), rot=(0, 0, 0), label=None):
    a = eas.spawn_actor_from_class(cls, unreal.Vector(*loc), unreal.Rotator(*rot))
    if label:
        a.set_actor_label(label)
    return a


import_files(os.path.join(RAW, "UI", "Icons"), "/Game/UI/Icons")


def import_model(name):
    folder = os.path.join(DL, "Models", name)
    dest = f"/Game/Env/{name}"
    if not unreal.EditorAssetLibrary.does_directory_exist(dest):
        t = unreal.AssetImportTask()
        t.filename = os.path.join(folder, f"{name}_2k.gltf")
        t.destination_path = dest
        t.automated = True
        t.save = True
        t.replace_existing = True
        assets.import_asset_tasks([t])
    for path in unreal.EditorAssetLibrary.list_assets(dest, recursive=True):
        a = unreal.load_asset(path)
        if isinstance(a, unreal.StaticMesh):
            return a
    unreal.log_error(f"no static mesh imported for {name}")
    return None


def import_gltf(name, path):
    dest = f"/Game/Env/{name}"
    if not os.path.exists(path):
        unreal.log_error(f"missing {path} (run Tools/Assets/fetch.py with SKETCHFAB_API_TOKEN)")
        return None
    t = unreal.AssetImportTask()
    t.filename = path
    t.destination_path = dest
    t.automated = True
    t.save = True
    t.replace_existing = True
    assets.import_asset_tasks([t])
    for p in unreal.EditorAssetLibrary.list_assets(dest, recursive=True):
        a = unreal.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            return a
    unreal.log_error(f"no static mesh imported for {name}")
    return None


def import_texture(path, dest, normal=False, linear=False):
    t = unreal.AssetImportTask()
    t.filename = path
    t.destination_path = dest
    t.automated = True
    t.save = True
    t.replace_existing = True
    assets.import_asset_tasks([t])
    tex = unreal.load_asset(t.imported_object_paths[0])
    if normal:
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        tex.set_editor_property("flip_green_channel", True)  # Poly Haven ships OpenGL normals
    elif linear:
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
    unreal.EditorAssetLibrary.save_loaded_asset(tex)
    return tex


def tiled_material(name, tiling, tint=(1.0, 1.0, 1.0)):
    """Ground material from a Poly Haven texture set: albedo, normal, roughness from ARM.g."""
    folder = os.path.join(DL, "Textures", name)
    dest = f"/Game/Env/Ground/{name}"
    diff = import_texture(os.path.join(folder, f"{name}_Diffuse_2k.jpg"), dest)
    nor = import_texture(os.path.join(folder, f"{name}_nor_gl_2k.jpg"), dest, normal=True)
    arm = import_texture(os.path.join(folder, f"{name}_arm_2k.jpg"), dest, linear=True)
    mat = assets.create_asset(f"M_{name}", dest, unreal.Material, unreal.MaterialFactoryNew())
    uv = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureCoordinate, -900, 0)
    uv.set_editor_property("u_tiling", tiling)
    uv.set_editor_property("v_tiling", tiling)
    for i, (tex, prop, pin, kind) in enumerate([
            (diff, unreal.MaterialProperty.MP_BASE_COLOR, "RGB", unreal.MaterialSamplerType.SAMPLERTYPE_COLOR),
            (nor, unreal.MaterialProperty.MP_NORMAL, "RGB", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL),
            (arm, unreal.MaterialProperty.MP_ROUGHNESS, "G", unreal.MaterialSamplerType.SAMPLERTYPE_MASKS)]):
        s = MEL.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -500, i * 260)
        s.texture = tex
        s.sampler_type = kind
        MEL.connect_material_expressions(uv, "", s, "UVs")
        if prop == unreal.MaterialProperty.MP_BASE_COLOR:
            # Poly Haven's sand is shot grey: warm it towards desert ochre.
            mul = MEL.create_material_expression(mat, unreal.MaterialExpressionMultiply, -250, 0)
            col = MEL.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -500, -200)
            col.constant = unreal.LinearColor(tint[0], tint[1], tint[2], 1.0)
            MEL.connect_material_expressions(s, pin, mul, "A")
            MEL.connect_material_expressions(col, "", mul, "B")
            MEL.connect_material_property(mul, "", prop)
        else:
            MEL.connect_material_property(s, pin, prop)
    MEL.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return mat


def flat_material(name, color, roughness=1.0):
    mat = assets.create_asset(name, "/Game/Env/Materials", unreal.Material, unreal.MaterialFactoryNew())
    c = MEL.create_material_expression(mat, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c.constant = color
    MEL.connect_material_property(c, "", unreal.MaterialProperty.MP_BASE_COLOR)
    r = MEL.create_material_expression(mat, unreal.MaterialExpressionConstant, -400, 200)
    r.r = roughness
    MEL.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    return mat


def place(mesh, loc, yaw=0.0, scale=1.0, label=None, material=None):
    a = spawn(unreal.StaticMeshActor, loc, (0, 0, yaw), label)
    a.static_mesh_component.set_static_mesh(mesh)
    a.set_actor_scale3d(unreal.Vector(scale, scale, scale))
    if material:
        a.static_mesh_component.set_material(0, material)
    return a


m = {n: import_model(n) for n in ["namaqualand_cliff_01", "namaqualand_cliff_02", "namaqualand_boulder_02",
                                   "namaqualand_boulder_04", "mountainside", "rock_face_01",
                                   "sand_rocks_small_01", "wooden_military_crate", "ammo_box"]}
for src, fixed in (("namaqualand_boulder_04", "SM_Boulder"), ("namaqualand_boulder_02", "SM_Rock")):
    if m[src]:
        unreal.EditorAssetLibrary.duplicate_asset(m[src].get_path_name().split(".")[0], f"/Game/Props/{fixed}")
        unreal.EditorAssetLibrary.save_asset(f"/Game/Props/{fixed}", only_if_is_dirty=False)
sand = tiled_material("aerial_sand", 160.0, (1.25, 0.92, 0.62))

# --- story assets (used by AWarBreachDirector through fixed paths) --------------------------
unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
DLR = os.path.join(RAW, "Downloaded")


def fbx_task(path, dest, name, ui):
    t = unreal.AssetImportTask()
    t.filename = path
    t.destination_path = dest
    t.destination_name = name
    t.automated = True
    t.save = True
    t.replace_existing = True
    t.options = ui
    assets.import_asset_tasks([t])
    return [unreal.load_asset(p) for p in t.imported_object_paths]


def import_soldier():
    folder = os.path.join(DLR, "Mixamo")
    if not os.path.exists(os.path.join(folder, "Soldier.fbx")):
        unreal.log_error("Soldier.fbx missing (Tools/Blender/prep_soldier.py output)")
        return
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", True)
    ui.set_editor_property("import_animations", False)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", True)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
    got = fbx_task(os.path.join(folder, "Soldier.fbx"), "/Game/Chars/Soldier", "Soldier", ui)
    mesh = unreal.load_asset("/Game/Chars/Soldier/Soldier")
    skeleton = mesh.get_editor_property("skeleton") if mesh else None
    unreal.log(f"soldier: {got} skeleton {skeleton}")
    for f in sorted(os.listdir(folder)):
        if not (f.startswith("Anim_") and f.endswith(".fbx")):
            continue
        ui = unreal.FbxImportUI()
        ui.set_editor_property("import_mesh", False)
        ui.set_editor_property("import_as_skeletal", True)
        ui.set_editor_property("import_animations", True)
        ui.set_editor_property("skeleton", skeleton)
        ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)
        fbx_task(os.path.join(folder, f), "/Game/Chars/Soldier", os.path.splitext(f)[0], ui)
    unreal.log("soldier clips: " + ", ".join(unreal.EditorAssetLibrary.list_assets("/Game/Chars/Soldier")))


def import_prop(name, path, fixed):
    """Imports a downloaded glTF/GLB and keeps its first static mesh under a fixed name."""
    if not os.path.exists(path):
        unreal.log_error(f"missing {path}")
        return
    dest = f"/Game/Props/{name}"
    t = unreal.AssetImportTask()
    t.filename = path
    t.destination_path = dest
    t.automated = True
    t.save = True
    t.replace_existing = True
    assets.import_asset_tasks([t])
    meshes = [unreal.load_asset(p) for p in unreal.EditorAssetLibrary.list_assets(dest, recursive=True)]
    meshes = [a for a in meshes if isinstance(a, unreal.StaticMesh)]
    if meshes:
        unreal.EditorAssetLibrary.duplicate_asset(meshes[0].get_path_name().split(".")[0], f"/Game/Props/{fixed}")
        unreal.EditorAssetLibrary.save_asset(f"/Game/Props/{fixed}", only_if_is_dirty=False)
        unreal.log(f"prop {fixed} <- {meshes[0].get_path_name()} ({len(meshes)} meshes)")


def import_sheets():
    folder = os.path.join(DLR, "UnityVFX")
    tasks = []
    for d in sorted(os.listdir(folder)):
        if not os.path.isdir(os.path.join(folder, d)):
            continue  # the downloaded zips sit next to their extracted folders
        for f in os.listdir(os.path.join(folder, d)):
            if f.endswith(".tga") and "temperature" not in f:
                t = unreal.AssetImportTask()
                t.filename = os.path.join(folder, d, f)
                t.destination_path = "/Game/FX"
                t.destination_name = "T_" + os.path.splitext(f)[0]
                t.automated = True
                t.save = True
                t.replace_existing = True
                tasks.append(t)
    assets.import_asset_tasks(tasks)
    return unreal.load_asset(tasks[0].imported_object_paths[0]) if tasks and tasks[0].imported_object_paths else None


def flipbook_material(default_tex):
    """Unlit translucent sprite reading frame N of a Cols x Rows sheet."""
    mat = assets.create_asset("M_Flipbook", "/Game/FX", unreal.Material, unreal.MaterialFactoryNew())
    mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
    mat.set_editor_property("two_sided", True)
    E = lambda cls, x, y: MEL.create_material_expression(mat, cls, x, y)
    C = MEL.connect_material_expressions

    def scalar(name, value, y):
        p = E(unreal.MaterialExpressionScalarParameter, -1600, y)
        p.set_editor_property("parameter_name", name)
        p.set_editor_property("default_value", value)
        return p

    cols, rows, frame = scalar("Cols", 5.0, 0), scalar("Rows", 5.0, 120), scalar("Frame", 0.0, 240)
    opacity, glow = scalar("Opacity", 1.0, 600), scalar("Glow", 1.0, 720)
    tint = E(unreal.MaterialExpressionVectorParameter, -1600, 840)
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", unreal.LinearColor(1, 1, 1, 1))
    f = E(unreal.MaterialExpressionFloor, -1400, 240); C(frame, "", f, "")
    col = E(unreal.MaterialExpressionFmod, -1200, 160); C(f, "", col, "A"); C(cols, "", col, "B")
    dv = E(unreal.MaterialExpressionDivide, -1200, 300); C(f, "", dv, "A"); C(cols, "", dv, "B")
    row = E(unreal.MaterialExpressionFloor, -1050, 300); C(dv, "", row, "")
    cr = E(unreal.MaterialExpressionAppendVector, -900, 220); C(col, "", cr, "A"); C(row, "", cr, "B")
    uv = E(unreal.MaterialExpressionTextureCoordinate, -900, 60)
    add = E(unreal.MaterialExpressionAdd, -750, 120); C(uv, "", add, "A"); C(cr, "", add, "B")
    grid = E(unreal.MaterialExpressionAppendVector, -900, 400); C(cols, "", grid, "A"); C(rows, "", grid, "B")
    fuv = E(unreal.MaterialExpressionDivide, -600, 200); C(add, "", fuv, "A"); C(grid, "", fuv, "B")
    tex = E(unreal.MaterialExpressionTextureSampleParameter2D, -400, 200)
    tex.set_editor_property("parameter_name", "Tex")
    if default_tex:
        tex.set_editor_property("texture", default_tex)
    C(fuv, "", tex, "UVs")
    mask = E(unreal.MaterialExpressionComponentMask, -400, 840)
    for ch, on in (("r", True), ("g", True), ("b", True), ("a", False)):
        mask.set_editor_property(ch, on)
    C(tint, "", mask, "")
    m1 = E(unreal.MaterialExpressionMultiply, -200, 200); C(tex, "RGB", m1, "A"); C(mask, "", m1, "B")
    m2 = E(unreal.MaterialExpressionMultiply, -50, 200); C(m1, "", m2, "A"); C(glow, "", m2, "B")
    MEL.connect_material_property(m2, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    m3 = E(unreal.MaterialExpressionMultiply, -50, 400); C(tex, "A", m3, "A"); C(opacity, "", m3, "B")
    MEL.connect_material_property(m3, "", unreal.MaterialProperty.MP_OPACITY)
    MEL.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)


def import_audio():
    folder = os.path.join(DLR, "Audio")
    tasks = []
    for f in sorted(os.listdir(folder)):
        if f.endswith(".wav") and not f.startswith("src_"):
            t = unreal.AssetImportTask()
            t.filename = os.path.join(folder, f)
            t.destination_path = "/Game/Audio"
            t.destination_name = "S_" + os.path.splitext(f)[0]
            t.automated = True
            t.save = True
            t.replace_existing = True
            tasks.append(t)
    assets.import_asset_tasks(tasks)
    unreal.log("audio: " + ", ".join(unreal.EditorAssetLibrary.list_assets("/Game/Audio")))


import_soldier()
import_prop("C4", os.path.join(DLR, "Sketchfab", "C4", "C4.glb"), "SM_C4")
import_prop("Detonator", os.path.join(DLR, "Sketchfab", "Detonator", "Detonator.glb"), "SM_Detonator")
flipbook_material(import_sheets())
import_audio()

les.new_level("/Game/Maps/Breach")

# --- light: low morning sun behind the player's right shoulder, hazy desert air
sun = spawn(unreal.DirectionalLight, (0, 0, 1000), (0, -38, 25), "Sun")
light = sun.get_component_by_class(unreal.DirectionalLightComponent)
light.set_editor_property("intensity", 10.0)
light.set_editor_property("light_color", unreal.Color(255, 228, 196, 255))
light.set_editor_property("atmosphere_sun_light", True)
light.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
light.set_editor_property("dynamic_shadow_distance_movable_light", 12000.0)
spawn(unreal.SkyAtmosphere, label="Sky")
sky = spawn(unreal.SkyLight, label="SkyLight").get_component_by_class(unreal.SkyLightComponent)
sky.set_editor_property("real_time_capture", True)
sky.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
fog = spawn(unreal.ExponentialHeightFog, label="Haze").get_component_by_class(unreal.ExponentialHeightFogComponent)
fog.set_editor_property("fog_density", 0.012)
fog.set_editor_property("fog_height_falloff", 0.35)
fog.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.95, 0.74, 0.52, 1.0))
# Exposure held in a daylight range so pale sand and rock do not blow out.
ppv = spawn(unreal.PostProcessVolume, label="Grade")
ppv.set_editor_property("unbound", True)
pp = ppv.get_editor_property("settings")
for k, v in [("auto_exposure_min_brightness", 0.6), ("auto_exposure_max_brightness", 1.6), ("auto_exposure_bias", -0.5)]:
    pp.set_editor_property("override_" + k, True)
    pp.set_editor_property(k, v)
ppv.set_editor_property("settings", pp)

# --- ground: 2 km of sand
floor = place(unreal.load_asset("/Engine/BasicShapes/Plane"), (0, 0, 0), scale=1.0, label="Sand", material=sand)
floor.set_actor_scale3d(unreal.Vector(2000, 2000, 1))

# --- the mountain: a wall of scaled-up cliff scans in an arc 40 m ahead; lower mass behind it so
# the sky stays open above the ridge line
W = 4000
for i, (y, yaw, s) in enumerate([(-8000, 200, 4.6), (-3600, 186, 4.0), (3600, 174, 4.0), (8000, 160, 4.6)]):
    place(m["namaqualand_cliff_02"], (W + abs(y) * 0.2, y, -150), yaw, s, f"CliffWall{i}")
for i, (x, y, yaw, s) in enumerate([(W + 3200, -2600, 20, 4.0), (W + 3400, 2800, 200, 4.2), (W + 5200, 0, 180, 5.0),
                                    (W + 8000, -9000, 75, 6.0), (W + 8500, 9000, 260, 6.0)]):
    place(m["namaqualand_cliff_02"], (x, y, -100), yaw, s, f"Massif{i}")
place(m["mountainside"], (W + 4200, -6500, -300), 40, 3.5, "MassifSide")
# Fill the gaps between the cliff shells so the wall reads as one solid mountain.
for i, (x, y, yaw, s) in enumerate([(W + 1400, -1500, 175, 3.6), (W + 1500, 1700, 190, 3.6), (W + 1900, 0, 182, 4.2),
                                    (W + 1200, -5600, 200, 3.8), (W + 1300, 5800, 160, 3.8)]):
    place(m["namaqualand_cliff_02"], (x, y, -250), yaw, s, f"Fill{i}")
# Far ridges that close the horizon.
for i in range(8):
    place(m["namaqualand_cliff_01"], (60000 + (i % 3) * 9000, -60000 + i * 17000, -800), 180 + i * 37, 22.0, f"Ridge{i}")

# --- the breach target: the concrete bunker scan, 28 m ahead, gun slits facing the player
# (the scan's opening faces its local +X; yaw 180 turns it to the player). The scan carries its
# own earth below the slab: lift it so ~1.7 m of that stays under the sand.
BX = 2800
bunker = import_gltf("Bunker", os.path.join(RAW, "Downloaded", "Sketchfab", "Bunker", "scene.gltf"))
if bunker:
    bunker_actor = place(bunker, (BX, 0, 170), 180, 2.0, "Bunker")
    bunker_actor.tags = ["Bunker"]
for i, (x, y, z, yaw, s) in enumerate([(BX + 300, -1250, 0, 20, 2.2), (BX + 350, 1250, 0, 95, 2.4), (BX + 800, -800, 150, 160, 2.0),
                                       (BX + 850, 850, 150, 250, 2.1), (BX - 300, -1500, 0, 310, 1.3), (BX - 350, 1550, 0, 40, 1.2)]):
    place(m["namaqualand_boulder_04"], (x, y, z), yaw, s, f"Flank{i}")

# --- foreground: rubble, scattered boulders, the team's kit
for i, (x, y, yaw, s) in enumerate([(1500, -900, 40, 1.2), (1900, 1300, 140, 1.0), (3300, -2300, 220, 1.4),
                                    (3600, 2100, 300, 1.1), (800, 1700, 80, 0.8)]):
    place(m["namaqualand_boulder_02"], (x, y, 0), yaw, s, f"Boulder{i}")
for i, (x, y, yaw) in enumerate([(2200, -500, 10), (3400, 900, 200), (1200, 600, 120)]):
    place(m["sand_rocks_small_01"], (x, y, 0), yaw, 1.0, f"Rubble{i}")
place(m["wooden_military_crate"], (380, -260, 0), 70, 1.0, "Crate")
place(m["ammo_box"], (340, -140, 0), 15, 1.2, "Ammo")

spawn(unreal.PlayerStart, (0, 0, 100), (0, 0, 0), "Start")
director_class = unreal.load_class(None, "/Script/WarGame.WarBreachDirector")
spawn(director_class, (0, 0, 0), (0, 0, 0), "BreachDirector")

les.save_current_level()
unreal.log("build_breach: done")
