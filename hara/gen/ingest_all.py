"""Ingest every GLB the user sends (named as in docs/hara/ASSET_REQUESTS.md) in one go.
python3 gen/ingest_all.py <incoming_dir> [blender]   ->  assets/vehicles/*.glb|json and assets/props/*.glb|json
Real-world sizes come from the table below (metres): vehicles by length, props by height."""
import os, subprocess, sys

SPEC = {
    "veh_tuktuk": ("vehicle", 2.65, 3, 0.22), "veh_sedan128": ("vehicle", 3.87, 4, 0.29), "veh_moto": ("vehicle", 2.0, 2, 0.31),
    "prop_ahwa_chair": ("prop", 0.88, 0), "prop_ahwa_table": ("prop", 0.72, 0), "prop_shisha": ("prop", 0.8, 0),
    "prop_fruit_cart": ("prop", 1.35, 0), "prop_ac_unit": ("prop", 0.55, 0), "prop_sat_dish": ("prop", 0.75, 0),
    "prop_gas_cyl": ("prop", 0.62, 0), "prop_elec_box": ("prop", 1.3, 0), "prop_crates": ("prop", 0.9, 0),
    "prop_trash": ("prop", 0.7, 0), "prop_plant_tin": ("prop", 0.6, 0),
}
src = sys.argv[1]
blender = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("BLENDER", "blender")
here = os.path.dirname(os.path.abspath(__file__))
for f in sorted(os.listdir(src)):
    if not f.endswith(".glb"):
        continue
    base = f.rsplit("_v", 1)[0]
    if base not in SPEC:
        print("skip (unknown name)", f)
        continue
    kind, size, wheels = SPEC[base][:3]
    out_dir = os.path.join(here, "..", "assets", "vehicles" if kind == "vehicle" else "props")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, base + ".glb")
    cmd = [blender, "-b", "--python-exit-code", "1", "-P", os.path.join(here, "ingest.py"), "--", os.path.join(src, f), out,
           "--kind", kind, "--size", str(size), "--preview", os.path.join(src, base + "_preview.png")]
    if wheels:
        cmd += ["--wheels", str(wheels), "--wheel_r", str(SPEC[base][3])]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(f, "->", [l for l in r.stdout.splitlines() if l.startswith("INGEST")] or r.stderr[-400:])
