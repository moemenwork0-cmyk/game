// Builds the whole static world and keeps the depth-driven lighting in sync with the camera.
import * as THREE from 'three';
import { Track } from './track.js';
import { Terrain } from './terrain.js';
import { buildRoad } from './roadmesh.js';
import { terrainMaterial, buildTerrainMeshes } from './terrainmesh.js';
import { createWaterSky } from '../render/environment.js';
import { UW } from '../render/underwater.js';
import { loadPBR, loadTexture } from '../core/assets.js';
import { createEnvMap } from '../render/environment.js';
import { Scenery } from './scenery.js';
import { GodRays, MarineSnow, Particles } from '../render/effects.js';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.name = 'world';
  }

  async load(renderer, quality, progress = () => {}) {
    this.quality = quality;
    const tex = {};
    const names = { asphalt: 'asphalt_track', sand: 'coast_sand_01', ripple: 'aerial_beach_01', rock: 'rock_face_03', coral: 'coral_ground_02', gravel: 'coral_gravel', barrier: 'large_sandstone_blocks_01', ruins: 'seaworn_sandstone_brick', darkrock: 'dark_rock', rust: 'rusty_metal_02', blocks: 'large_sandstone_blocks_01', coralstone: 'coral_stone_wall' };
    await Promise.all(Object.entries(names).map(async ([k, n]) => { tex[k] = await loadPBR(n); }));
    this.tex = tex;
    progress(0.35, 'Charting the circuit');
    UW.uCaustics.value = await loadTexture('tex/caustics.png', { aniso: 4 });
    this.track = new Track();
    progress(0.45, 'Shaping the seabed');
    this.terrain = new Terrain(this.track, { step: quality.terrainStep ?? 4 });
    this.scene.add(createWaterSky());
    this.terrainGroup = buildTerrainMeshes(this.terrain, this.track, terrainMaterial(tex));
    this.scene.add(this.terrainGroup);
    progress(0.55, 'Paving the road');
    this.road = buildRoad(this.track, tex);
    this.scene.add(this.road.group);
    progress(0.6, 'Raising the sunken city');
    this.env = createEnvMap(renderer);
    this.scenery = new Scenery(this, quality);
    await this.scenery.load(this.env);
    progress(0.75, 'Growing the reef');
    this.scenery.build();
    this.godRays = new GodRays(this.scene, quality.godRays ?? 26);
    this.snow = new MarineSnow(this.scene, quality.snow ?? 1600);
    this.particles = new Particles(this.scene, quality.particles ?? 1);
    // lights: sun through the water, sky/seabed bounce
    this.sun = new THREE.DirectionalLight(0xc8f0ff, 2.4);
    this.sun.position.copy(UW.uSunDir.value).multiplyScalar(60);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x6fc8e0, 0x24343a, 1.0);
    this.scene.add(this.hemi);
    if (quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const s = 22;
      Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 140 });
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
  }

  update(dt, time, cam, threats = []) {
    this.scenery.update(dt, time, threats);
    this.scenery.bank.cull(cam);
    this.godRays.update(cam);
    const depth = UW.uSurfaceY.value - cam.y;
    this.snow.update(cam, this.pxScale ?? 1, Math.min(1, Math.max(0, (depth - 60) / 30)));
    this.particles.update(dt);
  }

  /** Depth-dependent light: sunlight fades and turns blue with depth; the abyss is nearly black. */
  updateLighting(camPos, focus) {
    const depth = UW.uSurfaceY.value - camPos.y;
    const k = Math.exp(-Math.max(0, depth - 18) * 0.03);
    this.sun.intensity = 2.6 * k;
    this.sun.color.setRGB(0.70 + 0.2 * k, 0.9 + 0.05 * k, 1.0);
    this.hemi.intensity = 0.25 + 0.95 * k;
    this.hemi.color.setRGB(0.25 + 0.2 * k, 0.55 + 0.25 * k, 0.75 + 0.1 * k);
    this.hemi.groundColor.setRGB(0.10 * k + 0.02, 0.15 * k + 0.03, 0.17 * k + 0.04);
    const f = focus || camPos;
    this.sun.position.set(f.x, f.y, f.z).addScaledVector(UW.uSunDir.value, 60);
    this.sun.target.position.copy(f);
    this.depthLight = k;
  }
}
