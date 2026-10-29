# Hara — الحارة

Open-world game in an Egyptian neighbourhood (GTA-style third-person), built to run on weak PCs.
Plan: `../docs/hara/MASTER_PLAN.md`. Asset requests: `../docs/hara/ASSET_REQUESTS.md`.

## Build the world, then run
Generated geometry is not committed; it is rebuilt from the generators:
```
python3 tools/fetch_textures.py                 # CC0 textures from ambientCG (already committed)
python3 gen/build_street.py /path/to/blender     # buildings of the first street (Blender 4.2+)
blender -b -P gen/minaret.py -- assets/generated/minaret.glb
godot --path .                                   # Godot 4.7, opens the street
```
Controls: WASD walk, Shift run, Space jump, mouse orbits the camera (click to capture, Esc to release), gamepad works.

Screenshots: `godot --path . -- --shot=res://shots/a.png [--cam=chase|right|left|back|wide] [--z=-6] [--nopeople]`
High quality renderer: add `--rendering-method forward_plus` before `--`.

## Layout
- `gen/` Blender generators (buildings, minaret, street layout)
- `scripts/` game code: street assembly, materials, player + GTA chase camera, humans
- `assets/tex` CC0 textures (ambientCG), `assets/characters` Microsoft Rocketbox (MIT), `assets/fonts` (OFL)
