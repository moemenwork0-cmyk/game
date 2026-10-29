"""Lay out the first street and generate every building with Blender (parallel).
Run from hara/:  python3 gen/build_street.py [blender_path]
Writes assets/generated/street1/b<NN>.glb/.json and assets/generated/street1/layout.json.
Godot axes: the street runs along -Z, left facades at x=-HALF facing +X, right at x=+HALF facing -X."""
import json, os, random, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

BLENDER = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BLENDER", "blender")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "generated", "street1")
HALF = 4.0                       # half the distance between facing facades (m)
Z0, Z1 = 14.0, -112.0           # street extent
rnd = random.Random(1906)
os.makedirs(OUT, exist_ok=True)

jobs, layout = [], {"half": HALF, "z0": Z0, "z1": Z1, "buildings": []}
n = 0
for side in ("L", "R"):
    z = Z0
    while z > Z1:
        style = rnd.choices(["old", "ahali", "unfinished"], [0.35, 0.45, 0.2])[0]
        w = round(rnd.uniform(6.0, 11.0) if style != "old" else rnd.uniform(6.0, 9.0), 1)
        floors = rnd.randint(3, 5) if style == "old" else rnd.randint(4, 7)
        depth = 12.0
        name = f"b{n:02d}"
        setback = round(rnd.uniform(0.0, 0.35), 2)
        layout["buildings"].append({"file": name, "side": side, "z": z, "w": w, "setback": setback,
                                    "style": style, "floors": floors})
        jobs.append([str(1000 + n), str(w), str(depth), str(floors), style, os.path.join(OUT, name + ".glb")])
        z -= w
        n += 1


def run(a):
    r = subprocess.run([BLENDER, "-b", "--python-exit-code", "1", "-P", os.path.join(HERE, "building.py"), "--", *a],
                       capture_output=True, text=True)
    line = [l for l in r.stdout.splitlines() if l.startswith("BUILDING")]
    return line[0] if line else ("FAILED " + a[-1] + r.stderr[-500:])


with ThreadPoolExecutor(4) as ex:
    for res in ex.map(run, jobs):
        print(res)
json.dump(layout, open(os.path.join(OUT, "layout.json"), "w"), indent=1)
print("buildings:", n)
