"""Mamluk-style Cairo minaret with its mosque block -> GLB (same material slots as buildings).
Run headless:  blender -b -P gen/minaret.py -- <out.glb>"""
import bpy, bmesh, math, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
MATS = ["stone", "trim", "dark", "metal", "plaster_c"]
bm = bmesh.new()
col = bm.loops.layers.color.new("Col")
STONE = (0.95, 0.85, 0.7)
TRIM = (0.98, 0.92, 0.8)


def paint(vs, mat, c):
    for f in {f for v in vs for f in v.link_faces}:
        f.material_index = MATS.index(mat)
        for l in f.loops:
            l[col] = (*c, 1.0)


def prism(mat, r0, r1, z0, z1, seg=8, c=STONE, rot=math.pi / 8):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=z1 - z0)
    vs = res["verts"]
    for v in vs:
        v.co = Vector((v.co.x * math.cos(rot) - v.co.y * math.sin(rot), v.co.x * math.sin(rot) + v.co.y * math.cos(rot), v.co.z + (z0 + z1) / 2))
    paint(vs, mat, c)


def box(mat, x0, y0, z0, x1, y1, z1, c=STONE):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r["verts"]:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    paint(r["verts"], mat, c)


# mosque block and dome
box("stone", -9, -9, 0, 9, 9, 12)
box("trim", -9.3, -9.3, 12, 9.3, 9.3, 12.6, TRIM)
for i in range(-4, 5):                       # crenellations
    for s in (-1, 1):
        box("trim", i * 2 - 0.4, s * 9.1 - 0.2, 12.6, i * 2 + 0.4, s * 9.1 + 0.2, 13.4, TRIM)
        box("trim", s * 9.1 - 0.2, i * 2 - 0.4, 12.6, s * 9.1 + 0.2, i * 2 + 0.4, 13.4, TRIM)
prism("stone", 4.5, 4.5, 12, 15, 16, STONE)
res = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=4.5)
for v in res["verts"]:
    v.co = Vector((v.co.x, v.co.y, max(v.co.z, 0) * 1.25 + 15))
paint(res["verts"], "stone", STONE)
for k in range(12):                          # arched window recesses on the block
    a = -8 + k * 1.45
    for s in (-1, 1):
        box("dark", a, s * 9.02 - 0.05, 6, a + 0.6, s * 9.02 + 0.05, 9.5, (1, 1, 1))
# minaret at the front corner
cx, cy = 6.5, -6.5
def at(fn, *a, **k):
    fn(*a, **k)
box("stone", cx - 2.4, cy - 2.4, 12, cx + 2.4, cy + 2.4, 24)
box("trim", cx - 2.6, cy - 2.6, 23.6, cx + 2.6, cy + 2.6, 24.4, TRIM)
for z in (15, 19):
    for s in (-1, 1):
        box("dark", cx - 0.35, cy + s * 2.42 - 0.05, z, cx + 0.35, cy + s * 2.42 + 0.05, z + 2.2, (1, 1, 1))
        box("dark", cx + s * 2.42 - 0.05, cy - 0.35, z, cx + s * 2.42 + 0.05, cy + 0.35, z + 2.2, (1, 1, 1))


def ring_balcony(z, r):
    # muqarnas suggested by stepped rings, then a balcony floor and a lattice parapet
    for i, rr in enumerate((r * 0.78, r * 0.86, r * 0.94)):
        prism("trim", rr, rr + 0.12, z - 1.2 + i * 0.4, z - 0.8 + i * 0.4, 16, TRIM)
    prism("trim", r, r, z, z + 0.25, 16, TRIM)
    for k in range(16):
        a = k * math.tau / 16
        x, y = cx + math.cos(a) * (r - 0.08), cy + math.sin(a) * (r - 0.08)
        box("trim", x - 0.06, y - 0.06, z + 0.25, x + 0.06, y + 0.06, z + 1.25, TRIM)
    prism("trim", r, r, z + 1.2, z + 1.32, 16, TRIM)


def shaft(seg, r, z0, z1):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - z0)
    for v in res["verts"]:
        v.co = Vector((v.co.x + cx, v.co.y + cy, v.co.z + (z0 + z1) / 2))
    paint(res["verts"], "stone", STONE)


shaft(8, 2.1, 24.4, 33)
ring_balcony(33.2, 2.6)
shaft(16, 1.6, 34.5, 41)
ring_balcony(41.2, 2.1)
for k in range(8):                            # open pavilion of columns
    a = k * math.tau / 8
    x, y = cx + math.cos(a) * 1.1, cy + math.sin(a) * 1.1
    box("trim", x - 0.1, y - 0.1, 42.5, x + 0.1, y + 0.1, 45.5, TRIM)
shaft(16, 1.25, 45.5, 46.0)
res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.25)
for v in res["verts"]:                        # onion bulb
    z = v.co.z
    k = 1.0 + 0.25 * math.sin(max(0.0, (z + 1.25) / 2.5) * math.pi) if z < 0.6 else max(0.05, (1.25 - z) / 0.65) * 0.75
    v.co = Vector((v.co.x * k + cx, v.co.y * k + cy, z * 1.4 + 47.6))
paint(res["verts"], "stone", STONE)
box("metal", cx - 0.04, cy - 0.04, 49.3, cx + 0.04, cy + 0.04, 51.0, (0.75, 0.62, 0.3))
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.35, radius2=0.35, depth=0.06)
for v in res["verts"]:
    v.co = Vector((v.co.x + cx, v.co.z + cy, v.co.y + 51.2))
paint(res["verts"], "metal", (0.75, 0.62, 0.3))

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uv = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    n = f.normal
    ax = max(range(3), key=lambda i: abs(n[i]))
    for l in f.loops:
        c = l.vert.co
        l[uv].uv = (c.x, c.y) if ax == 2 else ((c.y, c.z) if ax == 0 else (c.x, c.z))
bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new("minaret")
bm.to_mesh(me)
for m in MATS:
    me.materials.append(bpy.data.materials.new(m))
me.color_attributes.active_color = me.color_attributes["Col"]
me.color_attributes.render_color_index = me.color_attributes.find("Col")
ob = bpy.data.objects.new("minaret", me)
bpy.context.collection.objects.link(ob)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_vertex_color="ACTIVE")
print("MINARET tris", sum(len(p.vertices) - 2 for p in me.polygons))
