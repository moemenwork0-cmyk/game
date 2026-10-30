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
        t.filename = os.path.join(folder, f"{name}_2k.fbx")
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


def tiled_material(name, tiling):
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
sand = tiled_material("aerial_sand", 160.0)
dark = flat_material("M_TunnelDark", unreal.LinearColor(0.004, 0.0035, 0.003, 1.0))

les.new_level("/Game/Maps/Breach")

# --- light: low morning sun behind the player's right shoulder, hazy desert air
sun = spawn(unreal.DirectionalLight, (0, 0, 1000), (0, -24, -35), "Sun")
light = sun.get_component_by_class(unreal.DirectionalLightComponent)
light.set_editor_property("intensity", 8.0)
light.set_editor_property("light_color", unreal.Color(255, 228, 196, 255))
light.set_editor_property("atmosphere_sun_light", True)
light.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
light.set_editor_property("dynamic_shadow_distance_movable_light", 12000.0)
spawn(unreal.SkyAtmosphere, label="Sky")
sky = spawn(unreal.SkyLight, label="SkyLight").get_component_by_class(unreal.SkyLightComponent)
sky.set_editor_property("real_time_capture", True)
sky.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
fog = spawn(unreal.ExponentialHeightFog, label="Haze").get_component_by_class(unreal.ExponentialHeightFogComponent)
fog.set_editor_property("fog_density", 0.02)
fog.set_editor_property("fog_height_falloff", 0.35)
fog.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.95, 0.74, 0.52, 1.0))

# --- ground: 2 km of sand
floor = place(unreal.load_asset("/Engine/BasicShapes/Plane"), (0, 0, 0), scale=1.0, label="Sand", material=sand)
floor.set_actor_scale3d(unreal.Vector(2000, 2000, 1))

# --- the mountain: a wall of scaled-up cliff scans in an arc 60 m ahead, more mass behind it
W = 6000
for i, (y, yaw, s) in enumerate([(-9000, 200, 5.0), (-4200, 186, 4.4), (4200, 174, 4.4), (9000, 160, 5.0)]):
    place(m["namaqualand_cliff_02"], (W + abs(y) * 0.18, y, -150), yaw, s, f"CliffWall{i}")
for i, (x, y, yaw, s) in enumerate([(W + 2600, -2500, 30, 7.0), (W + 2800, 2600, 210, 7.5), (W + 4500, 0, 120, 9.0),
                                    (W + 7000, -9000, 75, 10.0), (W + 7500, 9000, 260, 10.0)]):
    place(m["mountainside"], (x, y, -200), yaw, s, f"Massif{i}")
# Far ridges that close the horizon.
for i in range(8):
    place(m["namaqualand_cliff_01"], (60000 + (i % 3) * 9000, -60000 + i * 17000, -800), 180 + i * 37, 22.0, f"Ridge{i}")

# --- the tunnel mouth: two rock faces as jambs, a dark throat behind, boulders plugging it
place(m["rock_face_01"], (W - 250, -520, 0), 165, 2.6, "MouthLeft")
place(m["rock_face_01"], (W - 250, 520, 0), 15, 2.6, "MouthRight")
throat = place(unreal.load_asset("/Engine/BasicShapes/Cube"), (W + 600, 0, 330), 0, 1.0, "TunnelThroat", dark)
throat.set_actor_scale3d(unreal.Vector(14, 7.5, 6.6))
for i, (x, y, z, yaw, s) in enumerate([(W - 180, -160, 0, 20, 1.5), (W - 160, 210, 0, 95, 1.6), (W - 120, 30, 230, 160, 1.3),
                                       (W - 260, -300, 0, 250, 1.1), (W - 240, 330, 0, 310, 1.0)]):
    place(m["namaqualand_boulder_04"], (x, y, z), yaw, s, f"Plug{i}")

# --- foreground: rubble, scattered boulders, the team's kit
for i, (x, y, yaw, s) in enumerate([(1800, -900, 40, 1.2), (2600, 1300, 140, 1.0), (3900, -2100, 220, 1.4),
                                    (4600, 1900, 300, 1.1), (900, 1700, 80, 0.8)]):
    place(m["namaqualand_boulder_02"], (x, y, 0), yaw, s, f"Boulder{i}")
for i, (x, y, yaw) in enumerate([(3000, -400, 10), (4800, 700, 200), (1400, 600, 120)]):
    place(m["sand_rocks_small_01"], (x, y, 0), yaw, 1.0, f"Rubble{i}")
place(m["wooden_military_crate"], (260, -180, 0), 70, 1.0, "Crate")
place(m["ammo_box"], (230, -60, 0), 15, 1.2, "Ammo")

spawn(unreal.PlayerStart, (0, 0, 100), (0, 0, 0), "Start")

les.save_current_level()
unreal.log("build_breach: done")
