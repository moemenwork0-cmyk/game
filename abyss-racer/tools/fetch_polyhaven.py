"""Download the CC0 Poly Haven textures and models the game uses into assets_src/ (not committed)."""
import json, os, sys, urllib.request, concurrent.futures as cf

UA = {'User-Agent': 'AbyssRacer-asset-fetch/1.0'}

def req(url):
    return urllib.request.Request(url, headers=UA)

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets_src')
TEXTURES = {  # id: resolution
    'asphalt_track': '2k', 'coast_sand_01': '1k', 'aerial_beach_01': '1k', 'sand_01': '1k',
    'rock_face_03': '1k', 'dark_rock': '1k', 'coral_stone_wall': '1k', 'coral_gravel': '1k',
    'large_sandstone_blocks_01': '1k', 'seaworn_sandstone_brick': '1k', 'rusty_metal_02': '1k',
    'coral_ground_02': '1k', 'rock_wall_08': '1k', 'metal_plate': '1k',
}
MAPS = ['Diffuse', 'nor_gl', 'arm']
MODELS = ['dutch_ship_large_01', 'bronze_shark_statue', 'bronze_whale_statue', 'bronze_ray_statue',
          'boulder_01', 'namaqualand_boulder_02', 'namaqualand_boulder_05', 'rock_moss_set_01', 'coast_rocks_01',
          'treasure_chest', 'wooden_barrels_01', 'Barrel_01', 'cannon_01', 'old_tyre', 'concrete_road_barrier',
          'wooden_crate_01', 'lambis_shell', 'ocean_buoy', 'marble_bust_01', 'lion_head', 'horse_statue_01',
          'ship_pinnace', 'old_military_crate', 'rusted_wheel_rim_01', 'gothic_statue']

def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(req(url), timeout=120) as r, open(dest + '.part', 'wb') as f:
        f.write(r.read())
    os.replace(dest + '.part', dest)

def files(asset):
    with urllib.request.urlopen(req(f'https://api.polyhaven.com/files/{asset}'), timeout=60) as r:
        return json.load(r)

jobs = []
for t, res in TEXTURES.items():
    f = files(t)
    for m in MAPS:
        if m in f:
            jobs.append((f[m][res]['jpg']['url'], os.path.join(ROOT, 'tex', t, f'{m}.jpg')))
for m in MODELS:
    f = files(m)
    g = f['gltf']['1k']['gltf']
    jobs.append((g['url'], os.path.join(ROOT, 'models', m, f'{m}.gltf')))
    for rel, inc in g['include'].items():
        jobs.append((inc['url'], os.path.join(ROOT, 'models', m, rel)))

with cf.ThreadPoolExecutor(8) as ex:
    for fut in cf.as_completed([ex.submit(get, u, d) for u, d in jobs]):
        fut.result()
print('ok', len(jobs))
