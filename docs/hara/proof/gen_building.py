# Blender headless: procedural Cairo "ahali" building -> glb. Material slots by name; Godot maps them.
import bpy, bmesh, random, math, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
seed, W, D, FLOORS, out = int(argv[0]), float(argv[1]), float(argv[2]), int(argv[3]), argv[4]
random.seed(seed)
bpy.ops.wm.read_factory_settings(use_empty=True)
H = 3.0
parts = {}  # material -> bmesh
def bm_for(m):
    if m not in parts: parts[m] = bmesh.new()
    return parts[m]
def box(m, c, s, rot=0.0):
    bm = bm_for(m)
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r["verts"]:
        p = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
        if rot: p.rotate(__import__("mathutils").Euler((0, 0, rot)))
        v.co = p + Vector(c)
def cyl(m, c, r, h, seg=8):
    bm = bm_for(m)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    for v in res["verts"]: v.co += Vector(c)

paint = random.choice(["plaster_ochre", "plaster_rose", "plaster_blue", "plaster_cream", "plaster_green"])
cols_x = [(-W/2 + i * W / max(1, round(W / 3.6))) for i in range(int(max(1, round(W / 3.6))) + 1)]
top_unfinished = random.random() < 0.7
for f in range(FLOORS):
    z0 = f * H
    finished = random.random() < (0.55 if f > 0 else 0.9)
    wall_m = paint if finished else "brick"
    # walls: front (y=-D/2) has openings; back/sides solid
    box(wall_m if f else paint, (0, D/2 - 0.1, z0 + H/2), (W, 0.2, H))
    box(wall_m, (-W/2 + 0.1, 0, z0 + H/2), (0.2, D, H))
    box(wall_m, (W/2 - 0.1, 0, z0 + H/2), (0.2, D, H))
    bays = len(cols_x) - 1
    for b in range(bays):
        x0, x1 = cols_x[b], cols_x[b + 1]; cx = (x0 + x1) / 2; bw = x1 - x0
        if f == 0:  # shops: rolling shutter + sign
            box("concrete", (cx, -D/2, z0 + 2.75), (bw, 0.25, 0.5))
            if random.random() < 0.6:
                box("shutter", (cx, -D/2 + 0.05, z0 + 1.25), (bw - 0.3, 0.06, 2.5))
            else:
                box("dark", (cx, -D/2 + 0.3, z0 + 1.25), (bw - 0.3, 0.06, 2.5))
            box(random.choice(["sign_red", "sign_yellow", "sign_green", "sign_blue"]), (cx, -D/2 - 0.12, z0 + 2.75), (bw - 0.2, 0.06, 0.45))
            continue
        # wall piece with window hole: build 4 pieces around a 1.2x1.4 hole
        ww, wh, sill = 1.2, 1.4, 0.9
        side = (bw - ww) / 2
        box(wall_m, (x0 + side / 2, -D/2 + 0.1, z0 + H/2), (side, 0.2, H))
        box(wall_m, (x1 - side / 2, -D/2 + 0.1, z0 + H/2), (side, 0.2, H))
        box(wall_m, (cx, -D/2 + 0.1, z0 + sill / 2), (ww, 0.2, sill))
        box(wall_m, (cx, -D/2 + 0.1, z0 + sill + wh + (H - sill - wh) / 2), (ww, 0.2, H - sill - wh))
        box("glass", (cx, -D/2 + 0.18, z0 + sill + wh / 2), (ww, 0.04, wh))
        sh = random.random()
        if sh < 0.5:  # wooden shutters, one open
            box("wood_green" if random.random() < 0.5 else "wood_brown", (cx - ww / 4, -D/2 + 0.05, z0 + sill + wh / 2), (ww / 2, 0.04, wh))
            box("wood_green", (x1 - side + 0.02, -D/2 - 0.25, z0 + sill + wh / 2), (0.04, ww / 2, wh))
        box("concrete", (cx, -D/2 - 0.05, z0 + sill - 0.05), (ww + 0.2, 0.25, 0.08))
        if random.random() < 0.45:  # balcony
            box("concrete", (cx, -D/2 - 0.55, z0 + 0.06), (bw - 0.4, 1.1, 0.14))
            for k in range(int((bw - 0.4) / 0.14)):
                box("metal", (x0 + 0.25 + k * 0.14, -D/2 - 1.07, z0 + 0.6), (0.025, 0.025, 1.0))
            box("metal", (cx, -D/2 - 1.07, z0 + 1.1), (bw - 0.4, 0.05, 0.05))
            if random.random() < 0.6:  # laundry
                box("metal", (cx, -D/2 - 1.2, z0 + 1.5), (bw - 0.3, 0.01, 0.01))
                for k in range(random.randint(3, 6)):
                    box(random.choice(["cloth_a", "cloth_b", "cloth_c", "cloth_d"]), (x0 + 0.4 + k * 0.42, -D/2 - 1.2, z0 + 1.15), (0.35, 0.01, random.uniform(0.4, 0.75)))
        if random.random() < 0.35:  # AC unit
            box("ac", (cx + ww / 2 + 0.35, -D/2 - 0.2, z0 + 2.2), (0.8, 0.35, 0.5))
    # slab
    box("concrete", (0, 0, z0 + H), (W + 0.1, D + 0.1, 0.2))
# columns
for x in cols_x:
    box("concrete", (x, -D/2 + 0.1, FLOORS * H / 2), (0.3, 0.3, FLOORS * H))
    box("concrete", (x, D/2 - 0.1, FLOORS * H / 2), (0.3, 0.3, FLOORS * H))
    if top_unfinished:
        for y in (-D/2 + 0.1, D/2 - 0.1):
            box("concrete", (x, y, FLOORS * H + 0.5), (0.3, 0.3, 1.0))
            for dx in (-0.08, 0.08):
                for dy in (-0.08, 0.08):
                    cyl("rebar", (x + dx, y + dy, FLOORS * H + 1.6), 0.012, 1.2, 4)
# roof clutter
zt = FLOORS * H + 0.1
for i in range(random.randint(1, 3)):
    cyl("tank", (random.uniform(-W/2 + 1, W/2 - 1), random.uniform(0, D/2 - 1), zt + 0.6), 0.55, 1.2, 12)
for i in range(random.randint(1, 4)):
    x, y = random.uniform(-W/2 + 0.6, W/2 - 0.6), random.uniform(-D/2 + 0.6, D/2 - 0.6)
    box("metal", (x, y, zt + 0.5), (0.05, 0.05, 1.0))
    bm = bm_for("dish")
    r = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=0.45)
    for v in r["verts"]:
        v.co = Vector((v.co.x, min(v.co.y, 0) * 0.5 if True else v.co.y, v.co.z)) + Vector((x, y - 0.1, zt + 1.1))
if random.random() < 0.5:  # pigeon tower
    px, py = random.uniform(-W/2 + 1.5, W/2 - 1.5), random.uniform(-D/2 + 1.5, D/2 - 1.5)
    for dx in (-0.8, 0.8):
        for dy in (-0.8, 0.8): box("wood_brown", (px + dx, py + dy, zt + 1.5), (0.08, 0.08, 3.0))
    box("wood_brown", (px, py, zt + 3.0), (1.9, 1.9, 1.2))
    box("cage", (px, py, zt + 3.0), (2.0, 2.0, 1.25))
# parapet
box(paint if not top_unfinished else "brick", (0, D/2 - 0.05, zt + 0.5), (W, 0.1, 1.0))

col = bpy.context.collection
for m, bm in parts.items():
    me = bpy.data.meshes.new(m); bm.to_mesh(me); bm.free()
    mat = bpy.data.materials.get(m) or bpy.data.materials.new(m); me.materials.append(mat)
    ob = bpy.data.objects.new(m, me); col.objects.link(ob)
# merge to one object with multiple material slots, cube-project UVs (1 UV unit = 1 m)
bpy.ops.object.select_all(action="SELECT"); bpy.context.view_layer.objects.active = col.objects[0]
bpy.ops.object.join()
ob = bpy.context.active_object; ob.name = f"building_{seed}"
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.001)
bpy.ops.uv.cube_project(cube_size=1.0, scale_to_bounds=False, correct_aspect=False)
bpy.ops.object.mode_set(mode="OBJECT")
print("TRIS", sum(len(p.vertices) - 2 for p in ob.data.polygons), "MATS", len(ob.data.materials))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True)
