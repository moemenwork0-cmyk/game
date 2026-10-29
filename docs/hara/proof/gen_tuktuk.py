# Blender headless: low-poly Egyptian tuk-tuk (Bajaj RE style) built from code -> glb
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = []
def mat(n):
    return bpy.data.materials.get(n) or bpy.data.materials.new(n)
def add(me_name, bm, m):
    me = bpy.data.meshes.new(me_name); bm.to_mesh(me); bm.free(); me.materials.append(mat(m))
    o = bpy.data.objects.new(me_name, me); bpy.context.collection.objects.link(o); objs.append(o); return o
def loft(name, m, sections, close=True):
    """sections: list of (x, [(y,z)...]) closed profiles along X -> skin"""
    bm = bmesh.new(); rings = []
    for x, prof in sections:
        rings.append([bm.verts.new((x, y, z)) for y, z in prof])
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if close:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return add(name, bm, m)
def box(name, m, c, s):
    bm = bmesh.new(); r = bmesh.ops.create_cube(bm, size=1)
    for v in r["verts"]: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2])) + Vector(c)
    return add(name, bm, m)
def wheel(name, c, r=0.24, w=0.12):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=r, radius2=r, depth=w)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    for v in bm.verts: v.co += Vector(c)
    add(name, bm, "tire")
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r * 0.55, radius2=r * 0.55, depth=w + 0.01)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    for v in bm.verts: v.co += Vector(c)
    add(name + "_hub", bm, "chrome")
# X forward. Lower body tub: tapered nose, wide rear
def prof(hw, z0, z1, bevel=0.06):
    return [(-hw + bevel, z0), (hw - bevel, z0), (hw, z0 + bevel), (hw, z1), (-hw, z1), (-hw, z0 + bevel)]
loft("tub", "body_paint", [(1.05, prof(0.18, 0.28, 0.7)), (0.8, prof(0.42, 0.25, 0.85)), (0.45, prof(0.62, 0.25, 0.75)),
                          (-0.9, prof(0.66, 0.25, 0.75)), (-1.15, prof(0.62, 0.3, 0.8))])
# front cowl/windshield frame + dashboard
loft("cowl", "body_paint", [(0.95, prof(0.3, 0.7, 0.95)), (0.7, prof(0.5, 0.75, 1.15))])
box("windshield", "glass", (0.68, 0, 1.45), (0.03, 1.0, 0.6))
box("ws_frame_top", "trim", (0.66, 0, 1.76), (0.08, 1.06, 0.06))
# canvas roof: arched, from windshield to rear
arch = [(math.cos(t) * 0.68, 1.75 + math.sin(t) * 0.22) for t in [i * math.pi / 8 for i in range(9)]]
arch_in = [(y * 0.97, z - 0.04) for y, z in arch[::-1]]
loft("roof", "canvas", [(0.72, arch + arch_in), (-1.2, arch + arch_in)])
loft("roof_back", "canvas", [(-1.18, [(y, z) for y, z in arch] + [(0.68, 1.0), (-0.68, 1.0)][::-1]), (-1.2, [(y, z) for y, z in arch] + [(0.68, 1.0), (-0.68, 1.0)][::-1])])
# side rails / pillars
for y in (-0.66, 0.66):
    box("pillar_f", "trim", (0.64, y, 1.3), (0.05, 0.05, 0.95))
    box("pillar_m", "trim", (-0.25, y, 1.3), (0.05, 0.05, 0.95))
    box("rail", "chrome", (-0.6, y * 1.02, 1.0), (0.8, 0.03, 0.03))
# seats
box("driver_seat", "seat", (0.25, 0, 0.9), (0.35, 0.45, 0.12))
box("rear_seat", "seat", (-0.75, 0, 0.88), (0.45, 1.2, 0.14))
box("rear_back", "seat", (-1.0, 0, 1.15), (0.1, 1.2, 0.45))
# handlebar
box("bar", "chrome", (0.55, 0, 1.15), (0.04, 0.6, 0.04))
# front fender + headlight + mirrors + decor
loft("fender", "body_paint", [(1.25, prof(0.1, 0.4, 0.52, 0.03)), (0.95, prof(0.12, 0.45, 0.55, 0.03))])
box("headlight", "light", (1.07, 0, 0.82), (0.04, 0.16, 0.12))
for y in (-0.5, 0.5): box("mirror", "chrome", (0.75, y, 1.3), (0.03, 0.1, 0.08))
box("plate", "plate", (-1.16, 0, 0.5), (0.02, 0.36, 0.14))
box("stripe_l", "decal", (-0.2, 0.665, 0.55), (1.6, 0.01, 0.06))
box("stripe_r", "decal", (-0.2, -0.665, 0.55), (1.6, 0.01, 0.06))
box("fringe", "decal", (0.68, 0, 1.68), (0.02, 0.98, 0.08))
# wheels
wheel("wf", (1.1, 0, 0.24)); wheel("wrl", (-0.75, 0.6, 0.24)); wheel("wrr", (-0.75, -0.6, 0.24))
bpy.ops.object.select_all(action="SELECT"); bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
o = bpy.context.active_object; o.name = "tuktuk"
print("TRIS", sum(len(p.vertices) - 2 for p in o.data.polygons))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB")
