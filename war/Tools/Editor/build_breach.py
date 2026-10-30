# Builds /Game/Maps/Breach from code, headless:
#   UnrealEditor-Cmd WarGame.uproject -run=pythonscript -script=Tools/Editor/build_breach.py
# Step 0 (engine proof): UI textures + a lit desert floor, sun, sky, fog and a camera spot.
import os
import unreal

PROJECT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
RAW = os.path.join(PROJECT, "Content", "Raw")
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

les.new_level("/Game/Maps/Breach")

sun = spawn(unreal.DirectionalLight, (0, 0, 1000), (0, -38, 35), "Sun")
light = sun.get_component_by_class(unreal.DirectionalLightComponent)
light.set_editor_property("intensity", 9.0)
light.set_editor_property("light_color", unreal.Color(255, 236, 214, 255))
light.set_editor_property("atmosphere_sun_light", True)
light.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
spawn(unreal.SkyAtmosphere, label="Sky")
sky = spawn(unreal.SkyLight, label="SkyLight").get_component_by_class(unreal.SkyLightComponent)
sky.set_editor_property("real_time_capture", True)
sky.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
fog = spawn(unreal.ExponentialHeightFog, label="Haze").get_component_by_class(unreal.ExponentialHeightFogComponent)
fog.set_editor_property("fog_density", 0.012)
fog.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.85, 0.68, 0.48, 1.0))

plane = unreal.load_asset("/Engine/BasicShapes/Plane")
cube = unreal.load_asset("/Engine/BasicShapes/Cube")
floor = spawn(unreal.StaticMeshActor, label="Floor")
floor.static_mesh_component.set_static_mesh(plane)
floor.set_actor_scale3d(unreal.Vector(400, 400, 1))
# Stand-in for the tunnel mouth: a block of "mountain" 40 m ahead.
for i, (x, y, sx, sy, sz) in enumerate([(4000, 0, 30, 60, 12), (4300, -1500, 20, 25, 18), (4300, 1700, 22, 30, 15)]):
    rock = spawn(unreal.StaticMeshActor, (x, y, sz * 50), (0, 0, 10 * i), f"Rock{i}")
    rock.static_mesh_component.set_static_mesh(cube)
    rock.set_actor_scale3d(unreal.Vector(sx, sy, sz))
spawn(unreal.PlayerStart, (0, 0, 120), (0, 0, 0), "Start")

les.save_current_level()
unreal.log("build_breach: done")
