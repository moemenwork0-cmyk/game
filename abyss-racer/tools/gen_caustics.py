"""Physically traced, tileable, looping caustics: light refracted through a periodic wave surface onto a
plane below. Output: 4x4 atlas of 16 frames (one loop), 256px each -> public/assets/tex/caustics.png"""
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

N = 256          # output texel per tile
S = 1024         # surface samples per side (photons = S*S)
FRAMES = 16
DEPTH = 1.9      # plane distance in tile units * (relative)
rng = np.random.default_rng(7)

# periodic waves: integer wave vectors so the surface tiles, integer temporal cycles so it loops
waves = []
for i in range(28):
    while True:
        k = rng.integers(-7, 8, size=2)
        if 2 <= np.hypot(*k) <= 7.5: break
    amp = 0.010 / np.hypot(*k) ** 1.2
    cycles = int(rng.integers(1, 3)) * (1 if rng.random() < 0.5 else -1)
    waves.append((k, amp, cycles, rng.random() * 2 * np.pi))

u = (np.arange(S) + 0.5) / S
X, Y = np.meshgrid(u, u, indexing='xy')
eta = 1.0 / 1.333
frames = []
for f in range(FRAMES):
    t = f / FRAMES
    gx = np.zeros_like(X); gy = np.zeros_like(X)
    for k, a, c, ph in waves:
        arg = 2 * np.pi * (k[0] * X + k[1] * Y + c * t) + ph
        d = a * 2 * np.pi * np.cos(arg)
        gx += d * k[0]; gy += d * k[1]
    # normal of z = h(x, y); incoming light straight down (0,0,-1); refract
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    I = np.array([0, 0, -1.0])
    cosi = -(n @ I)
    k2 = 1 - eta ** 2 * (1 - cosi ** 2)
    T = eta * I + (eta * cosi - np.sqrt(k2))[..., None] * n
    px = X + T[..., 0] / -T[..., 2] * DEPTH
    py = Y + T[..., 1] / -T[..., 2] * DEPTH
    ix = (np.floor(px * N).astype(np.int64)) % N
    iy = (np.floor(py * N).astype(np.int64)) % N
    img = np.bincount((iy * N + ix).ravel(), minlength=N * N).reshape(N, N).astype(np.float64)
    img = gaussian_filter(img, 0.7, mode='wrap')
    frames.append(img)

allf = np.stack(frames)
allf /= np.percentile(allf, 99.7)
allf = np.clip(allf, 0, 1) ** 1.25
atlas = np.zeros((N * 4, N * 4))
for f in range(FRAMES):
    r, c = divmod(f, 4)
    atlas[r * N:(r + 1) * N, c * N:(c + 1) * N] = allf[f]
Image.fromarray((atlas * 255).astype(np.uint8), 'L').save('public/assets/tex/caustics.png', optimize=True)
print('mean', allf.mean())
