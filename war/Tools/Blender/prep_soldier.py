# Prepares the teammate for Unreal (run with Blender's Python, e.g. the `bpy` wheel):
#   python prep_soldier.py <soldier.glb> <mixamo_fbx_dir> <out_dir>
# - imports the Sketchfab KSK operator (Mixamo rig, bone names carry "_01" style suffixes),
#   cleans the hierarchy and scales him to 1.8 m;
# - transfers every Mixamo clip onto his skeleton as armature-space deltas from the T-pose rest,
#   so differing bone axes between the glTF and FBX importers do not matter;
# - makes walk/run clips play in place (the game moves the actor) and prints their speeds;
# - writes Soldier.fbx (mesh + skeleton) and Anim_<clip>.fbx (skeleton + one clip).
import bpy, json, math, os, re, sys
from mathutils import Matrix

GLB, ANIMS, OUT = sys.argv[-3:]
HEIGHT = 1.80
IN_PLACE = {"Walking", "Running", "Running_Jump", "Start_Walking", "Jump_Away"}
os.makedirs(OUT, exist_ok=True)


def armature():
    return [o for o in bpy.context.scene.objects if o.type == "ARMATURE"][-1]


def clean_name(n):
    return re.sub(r"_\d+$", "", n)


bpy.ops.wm.read_factory_settings(use_empty=True)
# Node transforms as rest (not the guessed bind pose): only then is the rest an upright T-pose
# matching Mixamo's (hips ~0.53 of the height, arms along +X, facing -Y).
bpy.ops.import_scene.gltf(filepath=GLB, guess_original_bind_pose=False)
sol = armature()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.parent == sol]
for o in list(bpy.context.scene.objects):
    if o.type == "MESH" and o not in meshes:
        bpy.data.objects.remove(o)  # a stray icosphere ships in the file
# Flatten the Sketchfab/FBX empties into the armature and meshes, then bake transforms.
for o in [sol] + meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(bpy.context.scene.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o)
for m in meshes:
    m.parent = sol
    m.matrix_parent_inverse = sol.matrix_world.inverted()
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = sol
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
for b in sol.data.bones:
    b.name = clean_name(b.name)  # vertex groups follow bone renames
# Size from the skeleton (mesh bounds ignore the skinning): top of the head over the toes.
top = sol.data.bones["mixamorig:HeadTop_End"].head_local.z
lo = min(b.head_local.z for b in sol.data.bones if "Toe" in b.name) - 0.08 * (top - 0)
print("before scale: armature scale", tuple(sol.scale), "head top", round(top, 3), "toes", round(lo, 3))
h = top + 0.04 * (top - lo)
k = HEIGHT / (h - lo)
sol.scale = (k, k, k)
sol.location.z -= lo * k
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
sol.name = "Soldier"
sol.data.name = "Soldier"
rest = {b.name: b.matrix_local.copy() for b in sol.data.bones}
order = [b.name for b in sol.data.bones]  # parents come before children
print("soldier bones", len(order), "height", HEIGHT, "hips z", round(rest["mixamorig:Hips"].translation.z, 3))

speeds = {}
for f in sorted(x for x in os.listdir(ANIMS) if x.endswith(".fbx")):
    clip = os.path.splitext(f)[0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(ANIMS, f))
    src = [o for o in bpy.data.objects if o not in before and o.type == "ARMATURE"][0]
    act = src.animation_data.action
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    # Hips forward travel (in the source's bone space, channel 2) -> in-place + speed.
    if clip in IN_PLACE:
        fc = [c for c in act.fcurves if c.data_path == 'pose.bones["mixamorig:Hips"].location' and c.array_index == 2][0]
        v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
        for kp in fc.keyframe_points:
            t = (kp.co[0] - f0) / max(1, f1 - f0)
            d = (v1 - v0) * t
            kp.co[1] -= d
            kp.handle_left[1] -= d
            kp.handle_right[1] -= d
    src_rest = {b.name: (src.matrix_world @ b.matrix_local) for b in src.data.bones}
    scale = rest["mixamorig:Hips"].translation.z / max(1e-6, src_rest["mixamorig:Hips"].translation.z)
    if clip in IN_PLACE:
        speeds[clip] = round(abs(v1 - v0) * src.matrix_world.to_scale()[0] * scale * 100 / ((f1 - f0) / 30.0), 1)
    out = bpy.data.actions.new(clip)
    out.use_fake_user = True
    sol.animation_data_create()
    sol.animation_data.action = out
    scn = bpy.context.scene
    for fr in range(f0, f1 + 1):
        scn.frame_set(fr)
        for name in order:
            sb = src.pose.bones.get(name)
            tb = sol.pose.bones.get(name)
            if not sb or not tb:
                continue
            src_pose = src.matrix_world @ sb.matrix
            delta = src_pose @ src_rest[name].inverted()
            m = delta @ rest[name]
            if name == "mixamorig:Hips":
                # Source hips travel, rescaled to the soldier's proportions.
                m.translation = (src_pose.translation - src_rest[name].translation) * scale + rest[name].translation
            tb.matrix = m
            bpy.context.view_layer.update()
            tb.keyframe_insert("rotation_quaternion", frame=fr - f0 + 1)
            if name == "mixamorig:Hips":
                tb.keyframe_insert("location", frame=fr - f0 + 1)
    # Export this clip: skeleton only.
    bpy.data.objects.remove(src)
    bpy.ops.object.select_all(action="DESELECT")
    sol.select_set(True)
    bpy.context.view_layer.objects.active = sol
    bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, f"Anim_{clip}.fbx"), use_selection=True, object_types={"ARMATURE"},
                             bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                             add_leaf_bones=False, apply_scale_options="FBX_SCALE_UNITS")
    print("clip", clip, "frames", f1 - f0 + 1)
    sol.animation_data.action = None
    for pb in sol.pose.bones:
        pb.matrix_basis = Matrix()

# Textures saved next to the FBX first, so the export references them by file name.
for img in bpy.data.images:
    if img.packed_file or img.has_data:
        name = bpy.path.clean_name(img.name)
        if not os.path.splitext(name)[1]:
            name += ".png"
        img.filepath_raw = os.path.join(OUT, name)
        img.file_format = "PNG" if name.endswith(".png") else "JPEG"
        img.save()
        print("texture", name)
bpy.ops.object.select_all(action="SELECT")
# One file with the mesh and every clip as its own take: Unreal binds the clips to the skeleton it
# creates on import, whichever FBX importer (legacy or Interchange) is active.
sol.animation_data.action = None
bpy.ops.export_scene.fbx(filepath=os.path.join(OUT, "Soldier.fbx"), use_selection=True, object_types={"ARMATURE", "MESH"},
                         bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
                         bake_anim_force_startend_keying=True, add_leaf_bones=False,
                         apply_scale_options="FBX_SCALE_UNITS", path_mode="STRIP")
json.dump(speeds, open(os.path.join(OUT, "speeds.json"), "w"), indent=1)
print("speeds cm/s", speeds)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "soldier_check.blend"))
