import bpy, sys
out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
macro = TargetService.get_default_macro_info_dict()
macro.update({"gender": 1.0, "age": 0.5, "muscle": 0.55, "weight": 0.6, "height": 0.5,
              "race": {"african": 0.25, "asian": 0.05, "caucasian": 0.7}})
h = HumanService.create_human(macro_detail_dict=macro)
print("HUMAN", h.name, len(h.data.vertices))
rig = HumanService.add_builtin_rig(h, "game_engine")
print("RIG", rig.name if rig else None, len(rig.data.bones) if rig else 0)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True)
print("TRIS", sum(len(p.vertices) - 2 for p in h.data.polygons))
