# Renders a contact sheet of the prepared soldier in a few clips (Cycles, CPU) to check the transfer.
#   python check_soldier.py <out_dir_with_soldier_check.blend> <png>
import bpy, math, sys
OUT, PNG = sys.argv[-2:]
bpy.ops.wm.open_mainfile(filepath=OUT + "/soldier_check.blend")
sol = bpy.data.objects["Soldier"]
scn = bpy.context.scene
scn.render.engine = "CYCLES"
scn.cycles.samples = 12
scn.render.resolution_x, scn.render.resolution_y = 360, 480
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scn.collection.objects.link(cam)
cam.location = (2.6, -4.2, 1.3)
cam.rotation_euler = (math.radians(85), 0, math.radians(32))
scn.camera = cam
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 4
sun.rotation_euler = (math.radians(40), 0, math.radians(30))
scn.collection.objects.link(sun)
scn.world = bpy.data.worlds.new("W")
scn.world.color = (0.5, 0.5, 0.55)
shots = [("Breathing_Idle", 1), ("Walking", 10), ("Running", 6), ("Kneeling_Down", 40), ("Left_Turn", 20), ("Descending_Stairs", 15), ("Jump_Away", 35), ("Getting_Up", 40)]
paths = []
for clip, fr in shots:
    sol.animation_data_create()
    sol.animation_data.action = bpy.data.actions[clip]
    scn.frame_set(fr)
    scn.render.filepath = f"{OUT}/check_{clip}.png"
    bpy.ops.render.render(write_still=True)
    paths.append(scn.render.filepath)
print("rendered", paths)
