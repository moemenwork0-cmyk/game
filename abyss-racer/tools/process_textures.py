"""Resize Poly Haven texture sets into public/assets/tex/<name>/{diff,nor,arm}.jpg."""
import os
from PIL import Image
SRC = 'assets_src/tex'; DST = 'public/assets/tex'
SIZES = {'asphalt_track': 1024}
for name in sorted(os.listdir(SRC)):
    os.makedirs(f'{DST}/{name}', exist_ok=True)
    size = SIZES.get(name, 1024)
    for src, dst, q in (('Diffuse', 'diff', 88), ('nor_gl', 'nor', 92), ('arm', 'arm', 85)):
        p = f'{SRC}/{name}/{src}.jpg'
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGB')
        if im.size[0] != size:
            im = im.resize((size, size), Image.LANCZOS)
        im.save(f'{DST}/{name}/{dst}.jpg', quality=q, optimize=True)
print('done')
