"""Sculpts the car bodies as signed distance fields, meshes them with marching cubes, smooths and decimates.

Axes: x = right, y = up, z = forward (nose at +z). Units: metres. Ground at y = 0.
Writes public/assets/cars/<id>.glb (body shell only; wheels, glass masks, lights and liveries are
built/shaded in the game) and public/assets/cars/cars.json (wheel placement and dimensions).
"""
import json, os, sys
import numpy as np
from scipy.interpolate import PchipInterpolator
from skimage.measure import marching_cubes
import trimesh
import fast_simplification
from scipy.ndimage import map_coordinates

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'cars')
VOX = 0.02


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def curve(zs, vs):
    f = PchipInterpolator(zs, vs, extrapolate=False)
    lo, hi = zs[0], zs[-1]
    return lambda z: f(np.clip(z, lo, hi))


def loft(X, Y, Z, zs, w, yb, yt, n, cap=0.12, xc=0.0):
    """Superellipse cross-sections along z: half width w(z), bottom yb(z), top yt(z)."""
    W, B, T = curve(zs, w)(Z), curve(zs, yb)(Z), curve(zs, yt)(Z)
    W = np.maximum(W, 1e-3)
    yc, h = (B + T) * 0.5, np.maximum((T - B) * 0.5, 1e-3)
    ax, ay = np.abs(X - xc) / W, np.abs(Y - yc) / h
    q = (ax ** n + ay ** n) ** (1.0 / n)
    d = (q - 1.0) * np.minimum(W, h) * 0.85
    dz = np.maximum(zs[0] - Z, Z - zs[-1])
    return smax(d, dz, cap)


def ellipsoid(X, Y, Z, c, r):
    k0 = np.sqrt(((X - c[0]) / r[0]) ** 2 + ((Y - c[1]) / r[1]) ** 2 + ((Z - c[2]) / r[2]) ** 2)
    k1 = np.sqrt(((X - c[0]) / r[0] ** 2) ** 2 + ((Y - c[1]) / r[1] ** 2) ** 2 + ((Z - c[2]) / r[2] ** 2) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def cyl_x(X, Y, Z, c, r, half):
    """Cylinder along x centred at c."""
    d2 = np.sqrt((Y - c[1]) ** 2 + (Z - c[2]) ** 2) - r
    dx = np.abs(X - c[0]) - half
    return np.maximum(d2, dx)


def box(X, Y, Z, c, h):
    q = np.stack([np.abs(X - c[0]) - h[0], np.abs(Y - c[1]) - h[1], np.abs(Z - c[2]) - h[2]])
    return np.linalg.norm(np.maximum(q, 0), axis=0) + np.minimum(q.max(0), 0)


CARS = {
    # Balanced GT hypercar
    'marlin': dict(
        length=4.62, width=2.0, wheelbase=2.72, zoff=0.06,
        track_f=1.66, track_r=1.68, r_f=0.345, r_r=0.355, tw_f=0.27, tw_r=0.32,
        tub=dict(zs=[-2.30, -2.18, -1.9, -1.37, -0.6, 0.4, 1.05, 1.6, 2.05, 2.26, 2.32],
                 w=[0.80, 0.90, 0.95, 0.96, 0.92, 0.92, 0.94, 0.94, 0.86, 0.66, 0.45],
                 yb=[0.30, 0.20, 0.15, 0.13, 0.12, 0.12, 0.12, 0.13, 0.15, 0.19, 0.24],
                 yt=[0.80, 0.88, 0.86, 0.80, 0.74, 0.71, 0.69, 0.62, 0.55, 0.47, 0.40], n=2.8),
        cabin=dict(zs=[-1.75, -1.4, -0.9, -0.3, 0.25, 0.75, 1.1, 1.3],
                   w=[0.38, 0.55, 0.63, 0.66, 0.66, 0.66, 0.66, 0.60],
                   yb=[0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55],
                   yt=[0.86, 0.96, 1.07, 1.13, 1.14, 1.04, 0.84, 0.70], n=2.6),
        fender_f=dict(r=(0.30, 0.43, 0.74), y=0.42, x=0.73), fender_r=dict(r=(0.34, 0.48, 0.92), y=0.44, x=0.74),
        intake=True, roof_scoop=False, blend=0.10,
    ),
    # Wide, heavy muscle GT
    'orca': dict(
        length=4.78, width=2.06, wheelbase=2.80, zoff=0.0,
        track_f=1.72, track_r=1.74, r_f=0.36, r_r=0.37, tw_f=0.30, tw_r=0.35,
        tub=dict(zs=[-2.39, -2.3, -2.0, -1.4, -0.5, 0.5, 1.2, 1.8, 2.2, 2.36, 2.40],
                 w=[0.90, 0.97, 0.99, 0.99, 0.96, 0.96, 0.98, 0.98, 0.95, 0.85, 0.65],
                 yb=[0.28, 0.20, 0.16, 0.14, 0.14, 0.14, 0.14, 0.15, 0.17, 0.22, 0.30],
                 yt=[0.88, 0.92, 0.90, 0.86, 0.80, 0.78, 0.78, 0.76, 0.72, 0.64, 0.52], n=3.4),
        cabin=dict(zs=[-1.9, -1.55, -1.0, -0.4, 0.2, 0.7, 1.0, 1.15],
                   w=[0.45, 0.60, 0.66, 0.68, 0.68, 0.68, 0.66, 0.60],
                   yb=[0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62],
                   yt=[0.92, 1.02, 1.17, 1.22, 1.22, 1.14, 0.93, 0.78], n=3.0),
        fender_f=dict(r=(0.34, 0.46, 0.78), y=0.46, x=0.75), fender_r=dict(r=(0.38, 0.50, 0.95), y=0.47, x=0.76),
        intake=False, roof_scoop=False, hood_scoop=True, blend=0.08,
    ),
    # Low, light Le-Mans-style prototype
    'barracuda': dict(
        length=4.70, width=1.96, wheelbase=2.80, zoff=0.0,
        track_f=1.64, track_r=1.62, r_f=0.34, r_r=0.35, tw_f=0.28, tw_r=0.33,
        tub=dict(zs=[-2.33, -2.2, -1.9, -1.2, -0.4, 0.4, 1.0, 1.7, 2.1, 2.3, 2.35],
                 w=[0.78, 0.88, 0.90, 0.86, 0.72, 0.72, 0.80, 0.88, 0.84, 0.70, 0.55],
                 yb=[0.32, 0.20, 0.14, 0.11, 0.10, 0.10, 0.10, 0.11, 0.13, 0.15, 0.18],
                 yt=[0.84, 0.90, 0.86, 0.72, 0.60, 0.58, 0.56, 0.50, 0.42, 0.34, 0.28], n=2.6),
        cabin=dict(zs=[-1.9, -1.3, -0.7, -0.1, 0.4, 0.9, 1.35, 1.6],
                   w=[0.20, 0.40, 0.50, 0.53, 0.53, 0.51, 0.40, 0.28],
                   yb=[0.48, 0.48, 0.48, 0.48, 0.48, 0.48, 0.48, 0.48],
                   yt=[0.84, 0.96, 1.04, 1.07, 1.06, 0.98, 0.78, 0.60], n=2.4),
        fender_f=dict(r=(0.30, 0.42, 0.80), y=0.42, x=0.74), fender_r=dict(r=(0.32, 0.46, 0.95), y=0.45, x=0.73),
        intake=True, roof_scoop=True, blend=0.12,
    ),
}


def sculpt(c, X, Y, Z):
    t, cb = c['tub'], c['cabin']
    zf, zr = c['wheelbase'] / 2 + c['zoff'], -c['wheelbase'] / 2 + c['zoff']
    tub = loft(X, Y, Z, t['zs'], t['w'], t['yb'], t['yt'], t['n'], cap=0.10)
    cab = loft(X, Y, Z, cb['zs'], cb['w'], cb['yb'], cb['yt'], cb['n'], cap=0.18)
    d = smin(tub, cab, 0.16)
    # fender pods over the wheels
    for fz, f, r in ((zf, c['fender_f'], c['r_f']), (zr, c['fender_r'], c['r_r'])):
        for s in (-1, 1):
            e = ellipsoid(X, Y, Z, (s * f['x'], f['y'], fz - 0.04), f['r'])
            d = smin(d, e, c['blend'])
    # wheel arches cut out
    for fz, r, tw, tr in ((zf, c['r_f'], c['tw_f'], c['track_f']), (zr, c['r_r'], c['tw_r'], c['track_r'])):
        for s in (-1, 1):
            arch = cyl_x(X, Y, Z, (s * (tr / 2 + 0.25), r, fz), r + 0.065, tw / 2 + 0.25 + 0.06)
            d = smax(d, -arch, 0.035)
    if c.get('intake'):
        for s in (-1, 1):
            e = ellipsoid(X, Y, Z, (s * 1.0, 0.50, zr + 0.95), (0.16, 0.15, 0.45))
            d = smax(d, -e, 0.05)
    if c.get('hood_scoop'):
        e = ellipsoid(X, Y, Z, (0, 0.74, zf - 0.35), (0.30, 0.10, 0.55))
        d = smin(d, e, 0.10)
        e = box(X, Y, Z, (0, 0.80, zf - 0.02), (0.20, 0.04, 0.14))
        d = smax(d, -e, 0.02)
    if c.get('roof_scoop'):
        e = ellipsoid(X, Y, Z, (0, 1.06, -0.75), (0.13, 0.12, 0.62))
        d = smin(d, e, 0.10)
        e = ellipsoid(X, Y, Z, (0, 1.15, -0.2), (0.09, 0.07, 0.10))
        d = smax(d, -e, 0.02)
    # flat floor
    d = smax(d, 0.105 - Y, 0.02)
    # front splitter lip + rear diffuser strakes are separate meshes in-game
    return d


def build(name, c):
    L, W = c['length'], c['width']
    xs = np.arange(-W / 2 - 0.1, W / 2 + 0.1, VOX)
    ys = np.arange(0.0, 1.45, VOX)
    zs = np.arange(-L / 2 - 0.1, L / 2 + 0.1, VOX)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    d = sculpt(c, X, Y, Z)
    verts, faces, _, _ = marching_cubes(d, 0.0, spacing=(VOX, VOX, VOX))
    verts += np.array([xs[0], ys[0], zs[0]])
    m = trimesh.Trimesh(verts, faces, process=True)
    trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=25)
    v, f = fast_simplification.simplify(m.vertices, m.faces, target_count=18000, agg=6)
    m = trimesh.Trimesh(v, f, process=True)
    m.fix_normals()
    # project vertices back onto the iso-surface and take normals from the SDF gradient: perfectly smooth
    gx, gy, gz = np.gradient(d, VOX)
    def sample(arr, pts):
        idx = ((pts - np.array([xs[0], ys[0], zs[0]])) / VOX).T
        return map_coordinates(arr, idx, order=1, mode='nearest')
    pts = m.vertices.copy()
    for _ in range(3):
        dv = sample(d, pts)
        g = np.stack([sample(gx, pts), sample(gy, pts), sample(gz, pts)], 1)
        gl = np.linalg.norm(g, axis=1, keepdims=True) + 1e-9
        step = np.clip(dv / gl[:, 0], -0.015, 0.015)
        pts -= (step[:, None] * g / gl) * 0.8
    g = np.stack([sample(gx, pts), sample(gy, pts), sample(gz, pts)], 1)
    nrm = g / (np.linalg.norm(g, axis=1, keepdims=True) + 1e-9)
    m = trimesh.Trimesh(pts, m.faces, vertex_normals=nrm, process=False)
    # glTF: flip winding so normals face out (trimesh.fix_normals already ensures outward)
    os.makedirs(OUT, exist_ok=True)
    m.export(os.path.join(OUT, f'{name}.glb'))
    b = m.bounds
    print(name, 'tris', len(m.faces), 'bounds', np.round(b, 3).tolist())
    return dict(
        length=L, width=W, height=float(b[1][1]), wheelbase=c['wheelbase'], zoff=c['zoff'],
        wheels=[
            dict(x=s * c['track_f'] / 2, z=c['wheelbase'] / 2 + c['zoff'], r=c['r_f'], w=c['tw_f'], front=True)
            for s in (-1, 1)] + [
            dict(x=s * c['track_r'] / 2, z=-c['wheelbase'] / 2 + c['zoff'], r=c['r_r'], w=c['tw_r'], front=False)
            for s in (-1, 1)],
        tub=c['tub'], cabin=c['cabin'],
    )


if __name__ == '__main__':
    names = sys.argv[1:] or list(CARS)
    meta_path = os.path.join(OUT, 'cars.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for n in names:
        meta[n] = build(n, CARS[n])
    json.dump(meta, open(meta_path, 'w'), indent=1)
