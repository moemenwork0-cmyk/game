"""Procedural Cairo building -> GLB + JSON metadata.

Run headless:  blender -b -P gen/building.py -- <seed> <width> <depth> <floors> <style> <out.glb>
style: old | ahali | unfinished

Blender axes: X along the street, the facade faces -Y (plane y=0), Z up, origin at the facade's
bottom centre. Every part is a box with a material slot (named for the Godot material library) and a
vertex colour (tint/variation). UVs are box-projected in metres, so tiling textures line up.
The JSON lists anchor points the game dresses at runtime: shop signs (Arabic text), lamps, wire hooks.
"""
import bpy, bmesh, json, math, random, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SEED, W, D, FLOORS, STYLE, OUT = int(argv[0]), float(argv[1]), float(argv[2]), int(argv[3]), argv[4], argv[5]
rnd = random.Random(SEED)

MATS = ["plaster_a", "plaster_b", "plaster_c", "brick", "stone", "concrete", "trim", "wood", "metal",
        "shutter", "glass", "interior", "cloth", "sign", "dark"]
GH, FH, T = 3.7, 3.05, 0.3          # ground floor height, upper floor height, wall thickness
H = GH + FH * (FLOORS - 1)

bm = bmesh.new()
col_layer = bm.loops.layers.color.new("Col")
meta = {"width": W, "depth": D, "height": H, "style": STYLE, "signs": [], "lamps": [], "hooks": [], "doors": []}

PAINTS = [(0.93, 0.80, 0.58), (0.86, 0.66, 0.55), (0.80, 0.84, 0.82), (0.95, 0.90, 0.80), (0.74, 0.80, 0.70),
          (0.90, 0.74, 0.50), (0.78, 0.72, 0.68), (0.96, 0.86, 0.70), (0.70, 0.76, 0.84)]
WOODS = [(0.25, 0.42, 0.33), (0.45, 0.30, 0.20), (0.30, 0.38, 0.48), (0.55, 0.40, 0.28)]
CLOTH = [(0.8, 0.15, 0.15), (0.95, 0.95, 0.92), (0.2, 0.35, 0.75), (0.9, 0.65, 0.2), (0.3, 0.6, 0.35), (0.6, 0.2, 0.5),
         (0.15, 0.15, 0.18)]


def jitter(c, a=0.06):
    return tuple(max(0.0, min(1.0, x * (1 + rnd.uniform(-a, a)))) for x in c)


def box(mat, x0, y0, z0, x1, y1, z1, color=(1, 1, 1), rot=None, pivot=None):
    """Axis-aligned box from min to max corner (optionally rotated about Z around pivot)."""
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r["verts"]
    cx, cy, cz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    for v in vs:
        v.co = Vector((v.co.x * sx + cx, v.co.y * sy + cy, v.co.z * sz + cz))
    if rot:
        bmesh.ops.rotate(bm, verts=vs, cent=pivot or (cx, cy, cz), matrix=Matrix.Rotation(rot, 3, "Z"))
    mi = MATS.index(mat)
    faces = {f for v in vs for f in v.link_faces}
    for f in faces:
        f.material_index = mi
        for l in f.loops:
            l[col_layer] = (*color, 1.0)
    return vs


def cyl(mat, x, y, z0, z1, r, seg=8, color=(1, 1, 1), axis="Z"):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=abs(z1 - z0))
    vs = res["verts"]
    if axis == "X":
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif axis == "Y":
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    for v in vs:
        v.co += Vector((x, y, (z0 + z1) / 2))
    for f in {f for v in vs for f in v.link_faces}:
        f.material_index = MATS.index(mat)
        for l in f.loops:
            l[col_layer] = (*color, 1.0)


# ---------------------------------------------------------------- choices per building
if STYLE == "old":
    wall_mat = rnd.choice(["plaster_a", "plaster_b", "plaster_c"])
elif STYLE == "ahali":
    wall_mat = rnd.choice(["plaster_a", "plaster_b", "plaster_c", "plaster_b"])
else:
    wall_mat = "brick"
paint = jitter(rnd.choice(PAINTS)) if wall_mat != "brick" else (1, 1, 1)
trim_col = jitter((0.92, 0.88, 0.80)) if STYLE == "old" else jitter((0.85, 0.83, 0.80))
wood_col = jitter(rnd.choice(WOODS))
n_bays = max(1, round(W / (2.9 if STYLE == "old" else 3.3)))
bw = W / n_bays
xs = [-W / 2 + i * bw for i in range(n_bays + 1)]
floor_z = [0.0] + [GH + i * FH for i in range(FLOORS - 1)] + [H]

# ---------------------------------------------------------------- body: back, sides (raw brick), roof slab
box("brick", -W / 2, T, 0, -W / 2 + 0.25, D, H, (1, 1, 1))            # left side wall
box("brick", W / 2 - 0.25, T, 0, W / 2, D, H, (1, 1, 1))              # right side wall
box("brick", -W / 2, D - 0.25, 0, W / 2, D, H, (1, 1, 1))             # back wall
box("concrete", -W / 2, 0, H - 0.2, W / 2, D, H, (0.9, 0.9, 0.9))      # roof slab
for f in range(1, FLOORS):                                             # slab edges on the side walls
    z = floor_z[f]
    for sx in (-W / 2 - 0.01, W / 2 - 0.24):
        box("concrete", sx, T, z - 0.1, sx + 0.25, D, z + 0.12, (0.85, 0.85, 0.85))


def wall_piece(x0, x1, z0, z1):
    if x1 - x0 > 0.01 and z1 - z0 > 0.01:
        box(wall_mat, x0, 0, z0, x1, T, z1, paint)


def window(cx, z_sill, ww, wh, balcony_door=False):
    """Opening with reveal, frame, glass, sill and (maybe) wooden louvred shutters."""
    x0, x1 = cx - ww / 2, cx + ww / 2
    # glazing set back in the reveal
    fr = 0.06
    inset = 0.17
    box("wood" if STYLE == "old" or rnd.random() < 0.4 else "metal", x0, inset, z_sill, x1, inset + 0.06, z_sill + fr, wood_col)
    box("wood" if STYLE == "old" else "metal", x0, inset, z_sill + wh - fr, x1, inset + 0.06, z_sill + wh, wood_col)
    box("wood" if STYLE == "old" else "metal", x0, inset, z_sill, x0 + fr, inset + 0.06, z_sill + wh, wood_col)
    box("wood" if STYLE == "old" else "metal", x1 - fr, inset, z_sill, x1, inset + 0.06, z_sill + wh, wood_col)
    box("wood" if STYLE == "old" else "metal", cx - 0.025, inset, z_sill, cx + 0.025, inset + 0.06, z_sill + wh, wood_col)
    box("glass", x0, inset + 0.02, z_sill, x1, inset + 0.04, z_sill + wh)
    if rnd.random() < 0.35:   # curtain behind glass
        box("cloth", x0 + 0.05, inset + 0.08, z_sill + 0.1, cx, inset + 0.1, z_sill + wh - 0.05, jitter(rnd.choice(CLOTH)))
    box("dark", x0, inset + 0.15, z_sill, x1, inset + 0.17, z_sill + wh)            # room behind
    if not balcony_door:   # sill
        box("trim", x0 - 0.08, -0.07, z_sill - 0.07, x1 + 0.08, T * 0.6, z_sill, trim_col)
    if STYLE == "old":     # moulded hood above
        box("trim", x0 - 0.12, -0.10, z_sill + wh + 0.06, x1 + 0.12, 0.05, z_sill + wh + 0.2, trim_col)
        box("trim", x0 - 0.06, -0.05, z_sill + wh, x1 + 0.06, 0.05, z_sill + wh + 0.06, trim_col)
    # louvred shutters
    s = rnd.random()
    if s < 0.55 and STYLE != "unfinished":
        lw = ww / 2
        for side, hx in ((-1, x0), (1, x1)):
            state = rnd.random()
            if state < 0.5:   # folded open against the wall
                lx0, lx1 = (hx - lw - 0.02, hx - 0.02) if side < 0 else (hx + 0.02, hx + lw + 0.02)
                ly0, ly1 = -0.05, -0.01
            else:             # closed in the opening
                lx0, lx1 = (hx, hx + lw) if side < 0 else (hx - lw, hx)
                ly0, ly1 = 0.03, 0.07
            box("wood", lx0, ly0, z_sill, lx1, ly1, z_sill + wh, wood_col)
            n = max(4, int(wh / 0.16))
            for k in range(n):   # slats
                z = z_sill + 0.08 + k * (wh - 0.16) / n
                box("wood", lx0 + 0.04, ly0 - 0.025, z, lx1 - 0.04, ly0, z + 0.05, tuple(c * 0.85 for c in wood_col))


def balcony(x0, x1, z, kind):
    depth = 1.0 if kind != "mashrabiya" else 0.7
    box("concrete", x0, -depth, z - 0.16, x1, 0, z, (0.88, 0.88, 0.86))                      # slab
    box("trim", x0 - 0.02, -depth - 0.02, z - 0.2, x1 + 0.02, -depth + 0.06, z, trim_col)     # fascia
    if kind == "solid":
        box(wall_mat, x0, -depth, z, x1, -depth + 0.12, z + 0.95, paint)
        box(wall_mat, x0, -depth, z, x0 + 0.12, 0, z + 0.95, paint)
        box(wall_mat, x1 - 0.12, -depth, z, x1, 0, z + 0.95, paint)
        box("trim", x0 - 0.02, -depth - 0.03, z + 0.95, x1 + 0.02, -depth + 0.14, z + 1.02, trim_col)
    elif kind == "rail":
        box("metal", x0, -depth, z + 0.95, x1, -depth + 0.05, z + 1.0, (0.2, 0.2, 0.2))
        box("metal", x0, -depth, z + 0.08, x1, -depth + 0.04, z + 0.12, (0.2, 0.2, 0.2))
        k = int((x1 - x0) / 0.13)
        for i in range(k + 1):
            x = x0 + 0.04 + i * (x1 - x0 - 0.08) / k
            box("metal", x - 0.012, -depth + 0.01, z, x + 0.012, -depth + 0.035, z + 0.97, (0.2, 0.2, 0.2))
        for xx in (x0, x1 - 0.05):
            box("metal", xx, -depth, z + 0.95, xx + 0.05, 0, z + 1.0, (0.2, 0.2, 0.2))
    elif kind == "closed":   # enclosed with aluminium and glass (very common)
        box(wall_mat, x0, -depth, z, x1, -depth + 0.12, z + 0.95, paint)
        al = (0.75, 0.75, 0.72)
        for zz in (z + 0.95, z + FH - 0.25):
            box("metal", x0, -depth - 0.02, zz, x1, -depth + 0.06, zz + 0.05, al)
        n = max(2, int((x1 - x0) / 0.8))
        for i in range(n + 1):
            x = x0 + i * (x1 - x0) / n
            box("metal", x - 0.025, -depth - 0.02, z + 0.95, x + 0.025, -depth + 0.06, z + FH - 0.2, al)
        box("glass", x0, -depth + 0.01, z + 1.0, x1, -depth + 0.03, z + FH - 0.25)
        box("concrete", x0, -depth, z + FH - 0.2, x1, 0, z + FH - 0.05, (0.88, 0.88, 0.86))
    elif kind == "mashrabiya":   # wooden lattice bay
        top = z + FH - 0.35
        box("wood", x0, -depth, z, x1, 0, z + 0.12, wood_col)
        box("wood", x0 - 0.05, -depth - 0.08, top, x1 + 0.05, 0, top + 0.15, wood_col)
        box("wood", x0, -depth, z + 0.12, x1, -depth + 0.06, z + 0.8, wood_col)
        box("dark", x0 + 0.05, -depth + 0.15, z + 0.8, x1 - 0.05, -depth + 0.17, top)
        nx, nz = int((x1 - x0) / 0.12), int((top - z - 0.8) / 0.12)
        for i in range(nx + 1):
            x = x0 + i * (x1 - x0) / nx
            box("wood", x - 0.015, -depth, z + 0.8, x + 0.015, -depth + 0.04, top, wood_col)
        for j in range(nz + 1):
            zz = z + 0.8 + j * (top - z - 0.8) / nz
            box("wood", x0, -depth, zz - 0.015, x1, -depth + 0.04, zz + 0.015, wood_col)
        for xx in (x0, x1 - 0.06):
            box("wood", xx, -depth, z, xx + 0.06, 0, top, wood_col)
    if kind in ("rail", "solid") and rnd.random() < 0.65:   # laundry line
        ly = -depth - 0.25
        box("metal", x0 + 0.05, ly, z + 1.25, x1 - 0.05, ly + 0.01, z + 1.26, (0.1, 0.1, 0.1))
        for xx in (x0 + 0.05, x1 - 0.07):
            box("metal", xx, ly, z + 0.95, xx + 0.02, -depth + 0.05, z + 1.27, (0.1, 0.1, 0.1))
        x = x0 + 0.15
        while x < x1 - 0.4:
            w = rnd.uniform(0.25, 0.6)
            h = rnd.uniform(0.35, 0.9)
            if x + w > x1 - 0.1:
                break
            box("cloth", x, ly - 0.005, z + 1.25 - h, x + w, ly + 0.015, z + 1.25, jitter(rnd.choice(CLOTH), 0.15))
            x += w + rnd.uniform(0.03, 0.15)


def ac_unit(x, z):
    box("metal", x - 0.4, -0.38, z, x + 0.4, -0.02, z + 0.55, (0.88, 0.87, 0.82))
    cyl("dark", x + 0.1, -0.385, z + 0.08, z + 0.47, 0.19, 12, axis="Y")
    box("metal", x - 0.38, -0.4, z - 0.04, x - 0.34, 0, z, (0.3, 0.3, 0.3))
    box("metal", x + 0.34, -0.4, z - 0.04, x + 0.38, 0, z, (0.3, 0.3, 0.3))


# ---------------------------------------------------------------- upper floors
for f in range(1, FLOORS):
    z0, z1 = floor_z[f], floor_z[f + 1]
    for b in range(n_bays):
        bx0, bx1 = xs[b], xs[b + 1]
        cx = (bx0 + bx1) / 2
        has_balc = rnd.random() < (0.5 if STYLE != "unfinished" else 0.25)
        if STYLE == "old":
            ww, wh, sill = 1.0, 1.9, 0.75
        else:
            ww, wh, sill = rnd.choice([1.2, 1.4]), 1.4, 0.95
        if has_balc:
            ww, wh, sill = 1.0, 2.25, 0.0
        if STYLE == "unfinished" and rnd.random() < 0.12:   # bay still open, no infill
            box("dark", bx0, T * 0.9, z0, bx1, T, z1)
            continue
        wall_piece(bx0, cx - ww / 2, z0, z1)
        wall_piece(cx + ww / 2, bx1, z0, z1)
        wall_piece(cx - ww / 2, cx + ww / 2, z0, z0 + sill)
        wall_piece(cx - ww / 2, cx + ww / 2, z0 + sill + wh, z1)
        window(cx, z0 + sill, ww, wh, balcony_door=has_balc)
        if has_balc:
            kind = rnd.choice(["mashrabiya", "rail", "rail"]) if STYLE == "old" else rnd.choice(["rail", "solid", "closed", "closed"])
            if STYLE == "unfinished":
                kind = "rail"
            balcony(bx0 + 0.25, bx1 - 0.25, z0 + 0.02, kind)
        elif rnd.random() < 0.3:
            ac_unit(cx + ww / 2 + 0.55 if cx + ww / 2 + 0.95 < bx1 else cx - ww / 2 - 0.55, z0 + sill + 0.2)
    # floor band / slab edge
    if STYLE == "old":
        box("trim", -W / 2, -0.12, z0 - 0.12, W / 2, 0.1, z0 + 0.12, trim_col)
    else:
        box("concrete", -W / 2, -0.04, z0 - 0.1, W / 2, 0.1, z0 + 0.12, (0.86, 0.85, 0.83))

# columns of the concrete frame (ahali / unfinished)
if STYLE != "old":
    for x in xs:
        x0 = max(-W / 2, x - 0.15)
        x1 = min(W / 2, x + 0.15)
        box("concrete", x0, -0.03, GH, x1, 0.2, H, (0.86, 0.85, 0.83))
else:   # pilasters at the corners
    for x in (-W / 2, W / 2 - 0.35):
        box("trim", x, -0.06, GH, x + 0.35, 0.1, H, trim_col)

# ---------------------------------------------------------------- ground floor: shops and one entrance
entrance = rnd.randrange(n_bays)
plinth = "stone" if STYLE == "old" else "concrete"
for b in range(n_bays):
    bx0, bx1 = xs[b], xs[b + 1]
    cx = (bx0 + bx1) / 2
    pier = 0.35
    box(plinth, bx0, -0.04, 0, bx0 + pier, T, GH, (0.95, 0.92, 0.88))        # piers
    box(plinth, bx1 - pier, -0.04, 0, bx1, T, GH, (0.95, 0.92, 0.88))
    ox0, ox1 = bx0 + pier, bx1 - pier
    if b == entrance:
        dw = 1.3
        wall_piece(ox0, cx - dw / 2, 0, GH)
        wall_piece(cx + dw / 2, ox1, 0, GH)
        wall_piece(cx - dw / 2, cx + dw / 2, 2.55, GH)
        box("wood", cx - dw / 2, 0.2, 0.15, cx + dw / 2, 0.27, 2.55, wood_col)      # double door
        box("wood", cx - 0.02, 0.15, 0.15, cx + 0.02, 0.2, 2.55, tuple(c * 0.7 for c in wood_col))
        for zz in (0.6, 1.5):
            box("wood", cx - dw / 2 + 0.1, 0.17, zz, cx + dw / 2 - 0.1, 0.2, zz + 0.6, tuple(c * 0.85 for c in wood_col))
        box("trim", cx - dw / 2 - 0.1, -0.08, 2.55, cx + dw / 2 + 0.1, 0.1, 2.7, trim_col)
        box("stone", cx - dw / 2 - 0.2, -0.35, 0, cx + dw / 2 + 0.2, 0.2, 0.15, (0.9, 0.88, 0.85))  # step
        meta["doors"].append([cx, 0.0, 0.0])
        meta["lamps"].append([cx, -0.3, 2.85])
        box("metal", cx - 0.03, -0.25, 2.75, cx + 0.03, 0, 2.8, (0.15, 0.15, 0.15))
        continue
    # shop
    top = 2.85
    wall_piece(ox0, ox1, top + 0.65, GH)
    box("interior", ox0, 2.6, 0, ox1, 2.7, top)                       # back of shop
    box("interior", ox0, T, 0, ox0 + 0.05, 2.7, top)
    box("interior", ox1 - 0.05, T, 0, ox1, 2.7, top)
    box("interior", ox0, T, top - 0.05, ox1, 2.7, top)
    box("stone", ox0, T, -0.02, ox1, 2.7, 0.0, (0.7, 0.68, 0.65))
    state = rnd.random()
    shut_h = 0.0 if state < 0.55 else (rnd.uniform(0.6, 1.6) if state < 0.8 else top)
    box("shutter", ox0, 0.02, top - 0.32, ox1, 0.3, top, (0.75, 0.78, 0.8))          # shutter box
    if shut_h > 0:
        box("shutter", ox0 + 0.02, 0.06, top - 0.32 - shut_h, ox1 - 0.02, 0.1, top - 0.32, jitter((0.7, 0.75, 0.78), 0.1))
    if shut_h < top - 0.5:
        meta["lamps"].append([cx, 1.5, top - 0.3])      # warm light inside the open shop
        # counter / shelves suggestion
        box("wood", ox0 + 0.2, 1.6, 0, ox1 - 0.2, 2.2, 0.95, wood_col)
        for zz in (1.3, 1.8, 2.3):
            box("wood", ox0 + 0.1, 2.3, zz, ox1 - 0.1, 2.6, zz + 0.04, (0.5, 0.4, 0.3))
            k = int((ox1 - ox0 - 0.3) / 0.22)
            for i in range(k):
                xx = ox0 + 0.2 + i * 0.22
                box("cloth", xx, 2.35, zz + 0.04, xx + 0.16, 2.55, zz + rnd.uniform(0.15, 0.35), jitter(rnd.choice(CLOTH), 0.2))
    # sign board above the opening
    sb = rnd.choice(["sign"])
    box("sign", ox0 - 0.1, -0.12, top + 0.05, ox1 + 0.1, -0.04, top + 0.6, jitter(rnd.choice(
        [(0.1, 0.4, 0.25), (0.65, 0.1, 0.1), (0.1, 0.25, 0.55), (0.9, 0.75, 0.15), (0.15, 0.15, 0.15), (0.9, 0.9, 0.88)]), 0.1))
    meta["signs"].append({"x": cx, "y": -0.125, "z": top + 0.325, "w": ox1 - ox0 + 0.2, "h": 0.55})
    if rnd.random() < 0.4:   # fabric awning
        aw = jitter(rnd.choice(CLOTH), 0.1)
        verts = box("cloth", ox0 - 0.05, -1.3, top - 0.05, ox1 + 0.05, 0.0, top + 0.0, aw)
        for v in verts:      # slope it down toward the street
            if v.co.y < -0.5:
                v.co.z -= 0.45
    # lamp hook over the shop
    if rnd.random() < 0.5:
        meta["lamps"].append([cx, -0.6, top + 0.75])
        box("metal", cx - 0.015, -0.6, top + 0.75, cx + 0.015, 0, top + 0.78, (0.1, 0.1, 0.1))

# plinth band and ground-floor cornice
box("trim" if STYLE == "old" else "concrete", -W / 2, -0.14, GH - 0.18, W / 2, 0.1, GH + 0.05, trim_col)

# ---------------------------------------------------------------- top: cornice / parapet / unfinished columns
if STYLE == "old":
    box("trim", -W / 2 - 0.05, -0.25, H - 0.35, W / 2 + 0.05, 0.1, H - 0.15, trim_col)
    box("trim", -W / 2 - 0.1, -0.38, H - 0.15, W / 2 + 0.1, 0.1, H, trim_col)
    box(wall_mat, -W / 2, 0, H, W / 2, 0.2, H + 0.9, paint)
    box("trim", -W / 2 - 0.03, -0.05, H + 0.9, W / 2 + 0.03, 0.25, H + 1.0, trim_col)
elif STYLE == "ahali":
    box(wall_mat, -W / 2, 0, H, W / 2, 0.15, H + 1.0, paint)
    box("concrete", -W / 2, -0.03, H + 1.0, W / 2, 0.18, H + 1.08, (0.85, 0.85, 0.83))
if STYLE != "old" and rnd.random() < (0.9 if STYLE == "unfinished" else 0.45):
    for x in xs:   # columns waiting for the next floor, rebar sticking out
        x = min(max(x, -W / 2 + 0.15), W / 2 - 0.15)
        for y in (0.15, D - 0.15):
            box("concrete", x - 0.15, y - 0.15, H, x + 0.15, y + 0.15, H + 0.6, (0.82, 0.82, 0.8))
            for dx in (-0.08, 0.08):
                for dy in (-0.08, 0.08):
                    cyl("metal", x + dx + rnd.uniform(-0.02, 0.02), y + dy, H + 0.6, H + rnd.uniform(1.4, 2.1), 0.012, 5, (0.45, 0.25, 0.15))

# ---------------------------------------------------------------- roof clutter
for i in range(rnd.randint(1, 3)):     # black plastic water tanks on a stand
    x, y = rnd.uniform(-W / 2 + 1, W / 2 - 1), rnd.uniform(1.5, D - 1.5)
    box("metal", x - 0.6, y - 0.6, H, x + 0.6, y + 0.6, H + 0.6, (0.25, 0.25, 0.25))
    cyl("dark", x, y, H + 0.6, H + 1.8, 0.55, 12, (0.08, 0.08, 0.09))
for i in range(rnd.randint(1, 3)):     # satellite dishes
    x, y = rnd.uniform(-W / 2 + 0.6, W / 2 - 0.6), rnd.uniform(0.5, 1.5)
    box("metal", x - 0.03, y - 0.03, H, x + 0.03, y + 0.03, H + 1.3, (0.3, 0.3, 0.3))
    res = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=7, radius=0.45)
    for v in res["verts"]:
        v.co = Vector((v.co.x, min(v.co.y, 0.0) * 0.45, v.co.z))
    bmesh.ops.rotate(bm, verts=res["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(rnd.uniform(-0.6, 0.6), 3, "Z") @ Matrix.Rotation(-0.5, 3, "X"))
    for v in res["verts"]:
        v.co += Vector((x, y - 0.1, H + 1.3))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = MATS.index("metal")
        for l in f.loops:
            l[col_layer] = (0.92, 0.92, 0.9, 1.0)
if rnd.random() < 0.35:                # pigeon tower (ghayya)
    px, py = rnd.uniform(-W / 2 + 1.5, W / 2 - 1.5), rnd.uniform(2.0, D - 2.0)
    for dx in (-0.9, 0.9):
        for dy in (-0.9, 0.9):
            box("wood", px + dx - 0.05, py + dy - 0.05, H, px + dx + 0.05, py + dy + 0.05, H + 3.2, (0.45, 0.35, 0.25))
    box("wood", px - 1.0, py - 1.0, H + 2.0, px + 1.0, py + 1.0, H + 2.1, (0.45, 0.35, 0.25))
    for k in range(9):
        t = -0.95 + k * 0.2375
        box("wood", px + t, py - 1.0, H + 2.1, px + t + 0.03, py - 0.98, H + 3.2, (0.4, 0.32, 0.22))
        box("wood", px + t, py + 0.98, H + 2.1, px + t + 0.03, py + 1.0, H + 3.2, (0.4, 0.32, 0.22))
    box("wood", px - 1.1, py - 1.1, H + 3.2, px + 1.1, py + 1.1, H + 3.28, (0.4, 0.32, 0.22))
if rnd.random() < 0.4:                 # rooftop room
    rx = rnd.uniform(-W / 2, W / 2 - 3)
    box("brick", rx, D - 3.2, H, rx + 3.0, D - 0.2, H + 2.6)
    box("concrete", rx - 0.1, D - 3.3, H + 2.6, rx + 3.1, D - 0.1, H + 2.75, (0.85, 0.85, 0.83))

# ---------------------------------------------------------------- facade services: drain pipe, cables, meters
px = rnd.choice(xs[1:-1] or [W / 2 - 0.5]) + 0.25
cyl("metal", px, -0.08, 0.1, H, 0.05, 6, (0.35, 0.33, 0.3))
cz = GH + 0.35
for k in range(rnd.randint(2, 4)):
    cyl("dark", 0, -0.04 - k * 0.025, cz + k * 0.07, cz + k * 0.07 + W, 0.012, 4, axis="X")
box("metal", -W / 2 + 0.5, -0.12, 1.6, -W / 2 + 0.85, 0.0, 2.1, (0.6, 0.62, 0.6))
meta["hooks"] = [[-W / 2 + 0.3, -0.05, GH + 0.4 + i * 1.2] for i in range(3)] + [[W / 2 - 0.3, -0.05, GH + 0.4 + i * 1.2] for i in range(3)]

# ---------------------------------------------------------------- finish: UVs (metres, box projection), mesh, export
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
uv = bm.loops.layers.uv.new("UVMap")
for f in bm.faces:
    n = f.normal
    ax = max(range(3), key=lambda i: abs(n[i]))
    for l in f.loops:
        c = l.vert.co
        l[uv].uv = (c.x, c.y) if ax == 2 else ((c.y, c.z) if ax == 0 else (c.x, c.z))
bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new(f"building_{SEED}")
bm.to_mesh(me)
bm.free()
for m in MATS:
    me.materials.append(bpy.data.materials.get(m) or bpy.data.materials.new(m))
ca = me.color_attributes["Col"]
me.color_attributes.active_color = ca
me.color_attributes.render_color_index = me.color_attributes.find("Col")
ob = bpy.data.objects.new(f"building_{SEED}", me)
bpy.context.collection.objects.link(ob)
# drop empty material slots
used = {p.material_index for p in me.polygons}
tris = sum(len(p.vertices) - 2 for p in me.polygons)
kw = dict(filepath=OUT, export_format="GLB", export_apply=True)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE")
except TypeError:
    bpy.ops.export_scene.gltf(**kw, export_colors=True)
json.dump(meta, open(OUT.replace(".glb", ".json"), "w"), indent=1)
print(f"BUILDING seed={SEED} style={STYLE} {W:.1f}x{D:.1f} floors={FLOORS} tris={tris} mats={len(used)}")
