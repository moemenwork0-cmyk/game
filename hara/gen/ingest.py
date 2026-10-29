"""Turn an AI-generated GLB (TRELLIS.2 / Meshy) into a game-ready asset.

blender -b -P gen/ingest.py -- <in.glb> <out.glb> --kind vehicle|prop --size <metres> [--axis length|height]
        [--tris N] [--tex 1024] [--wheels 3|4|2] [--turn 0|90|180|270] [--preview out.png]

Steps: join meshes, drop loose crumbs, put it on the ground centred, scale to real size, turn it so
the front faces -Y in Blender (= +Z in Godot), decimate to the triangle budget, shrink the baked
texture, and for vehicles cut the wheels out as separate objects (pivot at the hub) so they can spin.
Writes <out>.json with size and wheel hubs, and an optional 4-view preview for checking orientation.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
opt = {"kind": "prop", "size": "1.0", "axis": "", "tris": "", "tex": "", "wheels": "", "turn": "0", "preview": ""}
for i, a in enumerate(argv):
    if a.startswith("--") and a[2:] in opt:
        opt[a[2:]] = argv[i + 1]
KIND = opt["kind"]
SIZE = float(opt["size"])
AXIS = opt["axis"] or ("length" if KIND == "vehicle" else "height")
TRIS = int(opt["tris"] or (9000 if KIND == "vehicle" else 2500))
TEX = int(opt["tex"] or (1024 if KIND == "vehicle" else 512))
NWHEELS = int(opt["wheels"] or 0)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o.type == "MESH")
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in list(bpy.context.scene.objects):          # armatures / empties from the importer
    if o != ob:
        bpy.data.objects.remove(o, do_unlink=True)
ob.parent = None
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
src_tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)

# ---- clean: weld, drop tiny disconnected crumbs (floating noise from the generator)
bm = bmesh.new()
bm.from_mesh(ob.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.verts.ensure_lookup_table()
seen, islands = set(), []
for v in bm.verts:
    if v.index in seen:
        continue
    stack, isl = [v], []
    seen.add(v.index)
    while stack:
        x = stack.pop()
        isl.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen:
                seen.add(y.index)
                stack.append(y)
    islands.append(isl)
total = len(bm.verts)
crumbs = [v for isl in islands if len(isl) < max(12, total * 0.002) for v in isl]
bmesh.ops.delete(bm, geom=crumbs, context="VERTS")
bm.to_mesh(ob.data)
bm.free()

# ---- orientation: Blender Z up; longest horizontal extent along Y; extra turn on request
def bbox():
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi
lo, hi = bbox()
if KIND == "vehicle" and (hi.x - lo.x) > (hi.y - lo.y):
    ob.data.transform(Matrix.Rotation(math.pi / 2, 4, "Z"))
turn = int(opt["turn"]) % 360
if turn:
    ob.data.transform(Matrix.Rotation(math.radians(turn), 4, "Z"))
lo, hi = bbox()
dims = hi - lo
ref = {"length": max(dims.x, dims.y), "height": dims.z, "width": min(dims.x, dims.y)}[AXIS]
s = SIZE / ref
ob.data.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))))
ob.data.transform(Matrix.Scale(s, 4))
lo, hi = bbox()
dims = hi - lo

# ---- decimate to the budget
cur = sum(len(p.vertices) - 2 for p in ob.data.polygons)
if cur > TRIS:
    m = ob.modifiers.new("dec", "DECIMATE")
    m.ratio = TRIS / cur
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)

# ---- vehicles: cut out the wheels around the lowest clusters of vertices
wheels = []
if KIND == "vehicle" and NWHEELS:
    vs = [v.co.copy() for v in ob.data.vertices]
    low = [v for v in vs if v.z < dims.z * 0.16]
    # seed clusters: for 3 wheels (tuk-tuk) one front centre + two rear corners; 2 = moto; 4 = car
    L, Wd = dims.y / 2, dims.x / 2
    seeds = {2: [(0, -L * 0.7), (0, L * 0.7)], 3: [(0, -L * 0.75), (-Wd * 0.8, L * 0.6), (Wd * 0.8, L * 0.6)],
             4: [(-Wd * 0.8, -L * 0.65), (Wd * 0.8, -L * 0.65), (-Wd * 0.8, L * 0.65), (Wd * 0.8, L * 0.65)]}[NWHEELS]
    cents = [Vector((x, y, 0)) for x, y in seeds]
    for _ in range(12):   # k-means in the ground plane
        groups = [[] for _ in cents]
        for v in low:
            k = min(range(len(cents)), key=lambda i: (v.x - cents[i].x) ** 2 + (v.y - cents[i].y) ** 2)
            groups[k].append(v)
        cents = [Vector((sum(v.x for v in g) / len(g), sum(v.y for v in g) / len(g), 0)) if g else c for g, c in zip(groups, cents)]
    for c in cents:
        near = [v for v in vs if abs(v.y - c.y) < dims.z * 0.35 and abs(v.x - c.x) < dims.x * 0.3 and v.z < dims.z * 0.45]
        r = max(0.12, (max(v.z for v in near) if near else dims.z * 0.3) / 2.0 * 0.95)
        hub = Vector((c.x, c.y, r))
        # lateral extent: only vertices in the wheel disc and in the outer band on this side
        xs = [v.x for v in near if (Vector((0, v.y, v.z)) - Vector((0, hub.y, hub.z))).length < r * 1.05
              and abs(v.x - c.x) < dims.x * 0.16]
        half_w = min(dims.x * 0.14, max(0.04, (max(xs) - min(xs)) / 2 if xs else 0.08))
        if xs:
            hub.x = (max(xs) + min(xs)) / 2
        wheels.append({"hub": [hub.x, hub.y, hub.z], "radius": r, "half_width": half_w})
    # separate faces fully inside each wheel cylinder (axis along X)
    for i, w in enumerate(wheels):
        hub = Vector(w["hub"])
        bpy.ops.object.mode_set(mode="EDIT")
        bm = bmesh.from_edit_mesh(ob.data)
        for f in bm.faces:
            f.select = all((Vector((0, v.co.y, v.co.z)) - Vector((0, hub.y, hub.z))).length < w["radius"] * 1.02
                           and abs(v.co.x - hub.x) < w["half_width"] * 1.3 for v in f.verts)
        bmesh.update_edit_mesh(ob.data)
        bpy.ops.mesh.separate(type="SELECTED")
        bpy.ops.object.mode_set(mode="OBJECT")
        new = [o for o in bpy.context.scene.objects if o != ob and o.name.startswith(ob.name) and not o.name.startswith("wheel")]
        for o in new:
            o.name = f"wheel_{i}"
            o.data.transform(Matrix.Translation(-hub))
            o.location = hub
        bpy.context.view_layer.objects.active = ob
ob.name = os.path.splitext(os.path.basename(OUT))[0]

# ---- textures: shrink baked images
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=85)
info = {"kind": KIND, "size_m": [round(dims.x, 3), round(dims.y, 3), round(dims.z, 3)], "tris": tris,
        "source_tris": src_tris, "wheels": wheels, "front": "-Y blender / +Z godot"}
json.dump(info, open(OUT.replace(".glb", ".json"), "w"), indent=1)
print("INGEST", json.dumps(info))

# ---- optional 4-view preview to check orientation and the wheel cut
if opt["preview"]:
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    scn.cycles.samples = 12
    scn.cycles.device = "CPU"
    scn.render.resolution_x = scn.render.resolution_y = 400
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.8, 0.8, 1)
    scn.world = world
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scn.collection.objects.link(cam)
    scn.camera = cam
    d = max(dims) * 2.2
    for k, (name, ang) in enumerate([("front", -90), ("side", 0), ("back", 90), ("three_quarter", -45)]):
        a = math.radians(ang)
        cam.location = Vector((math.cos(a) * d, math.sin(a) * d, dims.z * 0.9 + d * 0.25))
        direction = Vector((0, 0, dims.z * 0.4)) - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scn.render.filepath = opt["preview"].replace(".png", f"_{name}.png")
        bpy.ops.render.render(write_still=True)
