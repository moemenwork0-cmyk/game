// Poly Haven glTF -> optimised GLB for mobile: drop unwanted nodes, weld, simplify, resize textures to JPEG.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup, join, flatten } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const SRC = 'assets_src/models', DST = 'public/assets/models';
// id: [simplify ratio, texture size, drop-mesh regex]
const JOBS = {
  dutch_ship_large_01: [0.35, 1024, /sails|Plane/],
  bronze_shark_statue: [1, 512], bronze_whale_statue: [1, 512], bronze_ray_statue: [1, 512],
  namaqualand_boulder_02: [0.03, 512, null, 0.08], namaqualand_boulder_05: [0.03, 512, null, 0.08],
  rock_moss_set_01: [0.08, 512, null, 0.08], cannon_01: [0.25, 512], treasure_chest: [0.08, 512], wooden_barrels_01: [0.3, 512],
  Barrel_01: [1, 512], old_tyre: [1, 256], wooden_crate_01: [1, 512], lion_head: [0.2, 512], gothic_statue: [0.3, 512],
  marble_bust_01: [0.4, 512], ocean_buoy: [0.6, 512], old_military_crate: [0.5, 512], concrete_road_barrier: [0.15, 512],
  rusted_wheel_rim_01: [0.4, 256], horse_statue_01: [0.4, 512],
};
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(DST, { recursive: true });
for (const [id, [ratio, size, drop, err = 0.004]] of Object.entries(JOBS)) {
  const doc = await io.read(`${SRC}/${id}/${id}.gltf`);
  if (drop) {
    for (const n of doc.getRoot().listNodes()) {
      const m = n.getMesh();
      if (m && drop.test(m.getName())) n.dispose();
    }
  }
  await doc.transform(
    prune(), dedup(), weld(),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: err })] : []),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [size, size], quality: 82 }),
    prune(),
  );
  await io.write(`${DST}/${id}.glb`, doc);
  const tris = doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
  console.log(id, Math.round(tris), 'tris', (fs.statSync(`${DST}/${id}.glb`).size / 1024).toFixed(0), 'KB');
}
