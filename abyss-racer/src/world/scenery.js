// Populates each zone of the circuit. Static dressing goes into bucketed instances; things cars can hit
// at the roadside (barrels, crates, column drums, amphora-like buoys) are returned as dynamic prop specs.
import * as THREE from 'three';
import { InstanceBank } from './instancing.js';
import { TRACK } from './trackdef.js';
import { ZONE_IDS } from './track.js';
import { patchMaterial } from '../render/underwater.js';
import * as F from './flora.js';
import * as Ru from './ruins.js';
import { FishSchool, Mantas, Jellyfish, Whale } from './life.js';
import { loadGLTF } from '../core/assets.js';

const MODELS = ['dutch_ship_large_01', 'bronze_shark_statue', 'bronze_whale_statue', 'bronze_ray_statue', 'namaqualand_boulder_02',
  'namaqualand_boulder_05', 'rock_moss_set_01', 'cannon_01', 'treasure_chest', 'wooden_barrels_01', 'Barrel_01', 'old_tyre',
  'wooden_crate_01', 'lion_head', 'gothic_statue', 'marble_bust_01', 'ocean_buoy', 'old_military_crate', 'rusted_wheel_rim_01', 'horse_statue_01'];

export class Scenery {
  constructor(world, quality) {
    this.world = world; this.q = quality;
    this.track = world.track; this.terrain = world.terrain;
    this.scene = world.scene;
    this.bank = new InstanceBank(this.scene);
    this.props = [];       // dynamic prop specs {model, pos, quat, scale, mass, half}
    this.colliders = [];   // static collider specs {type:'box'|'cyl', pos, quat, half/radius,height}
    this.animated = [];
    this.models = {};
    this.rng = 12345;
  }

  rand() { this.rng = (this.rng * 16807) % 2147483647; return (this.rng - 1) / 2147483646; }
  range(a, b) { return a + (b - a) * this.rand(); }

  async load(env) {
    await Promise.all(MODELS.map(async (m) => { this.models[m] = (await loadGLTF(`models/${m}.glb`)).scene; }));
    this.env = env;
    // patch all model materials
    for (const [name, root] of Object.entries(this.models)) {
      root.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.userData.uw) return;
          m.userData.uw = true;
          if (/bronze|statue|lion|bust|cannon|rim/.test(name)) { m.envMap = env; m.envMapIntensity = 1.0; }
          patchMaterial(m, { key: 'model' });
        });
      });
    }
  }

  /** Random roadside spot beyond the barriers that does not intrude on another part of the track. */
  spot(k, minOff, maxOff, side = 0) {
    const t = this.track;
    const s = side || (this.rand() < 0.5 ? -1 : 1);
    const off = (TRACK.halfWidth + TRACK.shoulder + 1.2 + this.range(minOff, maxOff)) * s;
    const p = t.lateralPoint(k, off);
    p.x += this.range(-3, 3); p.z += this.range(-3, 3);
    const near = this.terrain.sampleAt(p.x, p.z);
    if (near.d < TRACK.halfWidth + TRACK.shoulder + 1.5) return null;
    p.y = this.terrain.heightAt(p.x, p.z);
    return p;
  }

  inZone(k, ...zones) { return zones.includes(ZONE_IDS[this.track.zone[this.track.wrap(k)]]); }

  groundQuat(p, yaw, tilt = 0.15) {
    const n = this.terrain.normalAt(p.x, p.z, new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0).lerp(n, 0.7).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((this.rand() - 0.5) * tilt, yaw, (this.rand() - 0.5) * tilt)));
    return q;
  }

  build() {
    const t = this.track, tex = this.world.tex, B = this.bank;
    const dens = this.q.density ?? 1;
    const C = (r, g, b) => new THREE.Color(r, g, b);

    // ---------- definitions ----------
    const coralMat = F.materials.coral();
    const softMat = F.materials.soft();
    const staghorn = [0, 1, 2].map((v) => F.staghornGeometry(v));
    staghorn.forEach((g, i) => B.define('stag' + i, [{ geometry: g, material: coralMat }]));
    B.define('brain', [{ geometry: F.brainCoralGeometry(), material: coralMat }]);
    B.define('table', [{ geometry: F.tableCoralGeometry(), material: coralMat }]);
    B.define('sponge', [{ geometry: F.tubeSpongeGeometry(), material: coralMat }]);
    B.define('fan', [{ geometry: F.seaFanGeometry(), material: softMat }]);
    B.define('anemone', [{ geometry: F.anemoneGeometry(), material: F.materials.anemone() }]);
    B.define('kelp', [{ geometry: F.kelpGeometry(), material: F.kelpMaterial() }], { cullDist: 200 });
    B.define('worms', [{ geometry: F.tubeWormGeometry(), material: F.materials.worm() }]);
    const rockMatHook = (m) => m;
    B.defineFromGLTF('rockA', this.models.namaqualand_boulder_02, { cullDist: 260 }, rockMatHook);
    B.defineFromGLTF('rockB', this.models.namaqualand_boulder_05, { cullDist: 260 }, rockMatHook);
    B.defineFromGLTF('rockSet', this.models.rock_moss_set_01, { cullDist: 260 }, rockMatHook);
    const stone = Ru.stoneMaterial(tex.ruins, 0xd8d0c0, 3.0);
    const stone2 = Ru.stoneMaterial(tex.blocks, 0xc8c4b8, 4.0);
    B.define('column', [{ geometry: Ru.columnGeometry(12, 0.9, false), material: stone }], { cullDist: 280 });
    B.define('columnBroken', [{ geometry: Ru.columnGeometry(12, 0.9, true), material: stone }], { cullDist: 280 });
    B.define('arch', [{ geometry: Ru.archGeometry(36, 15, 3.4), material: stone2 }], { cullDist: 320 });
    B.define('temple', [{ geometry: Ru.templeGeometry(44, 5), material: stone2 }], { cullDist: 420 });
    B.define('wall', [{ geometry: Ru.wallGeometry(16, 7), material: stone2 }], { cullDist: 280 });
    const lan = Ru.lanternGeometries();
    B.define('lantern', [{ geometry: lan.stone, material: stone }, { geometry: lan.orb, material: Ru.glowMaterial(0x40e0ff, 6) }], { cullDist: 300 });
    B.define('ventChimney', [{ geometry: F.ventGeometry(), material: F.ventMaterial() }], { cullDist: 300 });
    for (const m of ['bronze_shark_statue', 'bronze_whale_statue', 'bronze_ray_statue', 'gothic_statue', 'lion_head', 'marble_bust_01', 'horse_statue_01', 'cannon_01', 'treasure_chest', 'wooden_barrels_01', 'old_tyre', 'rusted_wheel_rim_01', 'ocean_buoy', 'old_military_crate']) {
      B.defineFromGLTF(m, this.models[m], { cullDist: 260 });
    }
    const coralColors = [C(1.0, 0.45, 0.25), C(0.95, 0.3, 0.55), C(0.6, 0.35, 0.95), C(1.0, 0.8, 0.25), C(0.3, 0.85, 0.75), C(1.0, 0.55, 0.6), C(0.95, 0.95, 0.85)];
    const pickColor = () => coralColors[Math.floor(this.rand() * coralColors.length)].clone().multiplyScalar(0.8 + this.rand() * 0.4);
    const Y = new THREE.Vector3(0, 1, 0);

    // ---------- everywhere: rocks framing the road ----------
    for (let k = 0; k < t.N; k += Math.round(9 / dens)) {
      if (t.gap[k]) continue;
      const trench = this.inZone(k, 'trench');
      const n = trench ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const p = this.spot(k, 1, trench ? 22 : 45);
        if (!p) continue;
        const kind = ['rockA', 'rockB', 'rockSet'][Math.floor(this.rand() * 3)];
        const s = kind === 'rockSet' ? this.range(0.8, 2.2) : this.range(1.5, trench ? 7 : 5);
        p.y -= s * 0.15;
        B.add(kind, p, this.groundQuat(p, this.rand() * 6.28, 0.6), new THREE.Vector3(s, s * this.range(0.7, trench ? 2.2 : 1.3), s), trench ? C(0.35, 0.33, 0.36) : C(0.85, 0.85, 0.8));
      }
    }

    // ---------- reef ----------
    for (let k = 0; k < t.N; k += 1) {
      if (!this.inZone(k, 'reef', 'climb', 'city') || t.gap[k]) continue;
      const reef = this.inZone(k, 'reef');
      const chance = (reef ? 2.6 : 0.5) * dens;
      let c = chance;
      while (c > 0) {
        if (this.rand() > c) break;
        c -= 1;
        const p = this.spot(k, 0, reef ? 40 : 25);
        if (!p) continue;
        const r = this.rand();
        const q = this.groundQuat(p, this.rand() * 6.28, 0.3);
        if (r < 0.32) B.add('stag' + Math.floor(this.rand() * 3), p, q, this.range(0.9, 2.2), pickColor());
        else if (r < 0.5) { p.y -= 0.2; B.add('brain', p, q, this.range(0.6, 1.8), pickColor()); }
        else if (r < 0.62) B.add('table', p, q, this.range(0.8, 2.0), pickColor());
        else if (r < 0.74) B.add('sponge', p, q, this.range(0.8, 2.0), pickColor());
        else if (r < 0.88) B.add('fan', p, this.groundQuat(p, this.rand() * 6.28, 0.2), this.range(1.2, 2.6), pickColor());
        else B.add('anemone', p, q, this.range(0.8, 1.8), pickColor());
      }
    }

    // ---------- kelp forest ----------
    for (let k = 0; k < t.N; k += 1) {
      if (!this.inZone(k, 'kelp', 'canyon') || t.gap[k]) continue;
      const kelpZone = this.inZone(k, 'kelp');
      let c = (kelpZone ? 3.2 : 0.6) * dens;
      while (c > 0) {
        if (this.rand() > c) break;
        c -= 1;
        const p = this.spot(k, 0, 50);
        if (!p) continue;
        const h = this.range(10, 24);
        B.add('kelp', p, new THREE.Quaternion().setFromAxisAngle(Y, this.rand() * 6.28), new THREE.Vector3(h * 0.9, h, h * 0.9), C(this.range(0.8, 1.1), this.range(0.85, 1.05), this.range(0.7, 0.9)));
      }
    }

    // ---------- sunken city ----------
    const cityK = [];
    for (let k = 0; k < t.N; k++) if (this.inZone(k, 'city')) cityK.push(k);
    // arches over the main straight
    for (let i = 0; i < cityK.length; i += 75) {
      const k = cityK[i];
      if (i < 20 || i > cityK.length - 25) continue;
      const P = t.P(k), T = t.T(k);
      const yaw = Math.atan2(T.x, T.z);
      const q = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      const p = P.clone(); p.y -= 1.0;
      B.add('arch', p, q, 1, C(0.9, 0.88, 0.84));
      // pier colliders
      for (const s of [-1, 1]) {
        const R = t.R(k);
        const pp = P.clone().addScaledVector(R, s * (18 + 1.7)); pp.y += 6.5;
        this.colliders.push({ type: 'box', pos: pp, quat: q.clone(), half: new THREE.Vector3(1.7, 8, 1.7) });
      }
    }
    // colonnades, lanterns, walls, temples, statues
    for (let i = 0; i < cityK.length; i += 14) {
      const k = cityK[i];
      for (const s of [-1, 1]) {
        const p = this.spot(k, 4, 7, s);
        if (!p) continue;
        const broken = this.rand() < 0.35;
        p.y -= 0.6;
        B.add(broken ? 'columnBroken' : 'column', p, this.groundQuat(p, this.rand() * 6.28, broken ? 0.12 : 0.04), 1, C(0.95, 0.92, 0.86));
        this.colliders.push({ type: 'cyl', pos: p.clone().add(new THREE.Vector3(0, 6, 0)), radius: 1.1, height: 12 });
      }
    }
    for (let i = 7; i < cityK.length; i += 14) {
      const k = cityK[i];
      for (const s of [-1, 1]) {
        const p = this.spot(k, 0.2, 0.8, s);
        if (!p) continue;
        B.add('lantern', p, new THREE.Quaternion(), 1);
      }
    }
    for (let i = 0; i < cityK.length; i += 22) {
      const k = cityK[i];
      const p = this.spot(k, 14, 60);
      if (!p) continue;
      const T = t.T(k);
      B.add('wall', p, this.groundQuat(p, Math.atan2(T.x, T.z) + (this.rand() < 0.5 ? 0 : Math.PI / 2), 0.08), this.range(0.8, 1.4), C(0.9, 0.88, 0.85));
    }
    for (let i = 30; i < cityK.length; i += 160) {
      const k = cityK[i];
      const p = this.spot(k, 45, 80);
      if (!p) continue;
      p.y -= 2;
      B.add('temple', p, new THREE.Quaternion().setFromAxisAngle(Y, this.rand() * 6.28), this.range(0.9, 1.3), C(0.85, 0.83, 0.8));
    }
    const statues = ['bronze_shark_statue', 'bronze_whale_statue', 'bronze_ray_statue', 'gothic_statue', 'horse_statue_01'];
    for (let i = 40, j = 0; i < cityK.length; i += 95, j++) {
      const k = cityK[i];
      const p = this.spot(k, 10, 22);
      if (!p) continue;
      const m = statues[j % statues.length];
      const sc = { bronze_shark_statue: 9, bronze_whale_statue: 7, bronze_ray_statue: 10, gothic_statue: 6, horse_statue_01: 30 }[m];
      // plinth
      B.add('wall', p.clone().add(new THREE.Vector3(0, -3, 0)), new THREE.Quaternion(), new THREE.Vector3(0.35, 0.6, 3.5), C(0.8, 0.78, 0.75));
      const pp = p.clone(); pp.y += 1.2;
      const P = t.P(k);
      const yaw = Math.atan2(P.x - pp.x, P.z - pp.z);
      B.add(m, pp, new THREE.Quaternion().setFromAxisAngle(Y, yaw), sc, C(0.75, 0.9, 0.8));
    }

    // ---------- canyon & jump ----------
    const jk = Math.round(t.jumpS / t.ds);
    for (let j = -60; j < 80; j += 6) {
      const k = t.wrap(jk + j);
      if (t.gap[k]) continue;
      for (const s of [-1, 1]) {
        if (this.rand() < 0.35) continue;
        const p = this.spot(k, 0.5, 6, s);
        if (!p) continue;
        B.add('ocean_buoy', p, new THREE.Quaternion().setFromAxisAngle(Y, this.rand() * 6), 1.6);
      }
    }
    // glowing warning lights at the lip and landing (instanced glow orbs via lantern)
    for (const off of [-2, Math.round(t.jumpGap / t.ds) + 2]) {
      const k = t.wrap(jk + off);
      for (const s of [-1, 1]) {
        const p = t.lateralPoint(k, s * (TRACK.halfWidth + TRACK.shoulder + 1.5));
        p.y -= 0.4;
        B.add('lantern', p, new THREE.Quaternion(), 1.3);
      }
    }

    // ---------- wreck ----------
    const wreckK = [];
    for (let k = 0; k < t.N; k++) if (this.inZone(k, 'wreck')) wreckK.push(k);
    if (wreckK.length) {
      const k = wreckK[Math.floor(wreckK.length * 0.45)];
      const P = t.P(k), T = t.T(k), R = t.R(k);
      const pos = P.clone().addScaledVector(R, -(TRACK.halfWidth + TRACK.shoulder + 17));
      pos.y = this.terrain.heightAt(pos.x, pos.z) - 2.5;
      const ship = this.models.dutch_ship_large_01.clone();
      ship.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      const sc = 1.55;
      ship.scale.setScalar(sc);
      ship.position.copy(pos);
      ship.rotation.set(-0.36, Math.atan2(T.x, T.z) + Math.PI / 2 + 0.25, 0.07, 'YXZ');
      // ship axis: its long axis is x in model space; rotate so it lies along the track
      this.scene.add(ship);
      this.ship = ship;
      // hull collider (rough box)
      const q = new THREE.Quaternion().setFromEuler(ship.rotation);
      this.colliders.push({ type: 'box', pos: pos.clone().add(new THREE.Vector3(0, 8, 0)), quat: q, half: new THREE.Vector3(26, 8, 6.5) });
      // debris field
      for (let i = 0; i < wreckK.length; i += 3) {
        const kk = wreckK[i];
        if (this.rand() < 0.35) continue;
        const p = this.spot(kk, 0, 30);
        if (!p) continue;
        const items = ['cannon_01', 'treasure_chest', 'wooden_barrels_01', 'old_tyre', 'rusted_wheel_rim_01', 'old_military_crate'];
        const m = items[Math.floor(this.rand() * items.length)];
        const sc2 = { cannon_01: 1.4, treasure_chest: 1.3, wooden_barrels_01: 1, old_tyre: 1.6, rusted_wheel_rim_01: 2.2, old_military_crate: 1.2 }[m];
        B.add(m, p, this.groundQuat(p, this.rand() * 6.28, 0.5), sc2, C(0.75, 0.82, 0.75));
      }
    }

    // ---------- trench ----------
    const vents = [];
    for (let k = 0; k < t.N; k += 2) {
      if (!this.inZone(k, 'trench') || t.gap[k]) continue;
      if (this.rand() < 0.14 * dens) {
        const p = this.spot(k, 0, 12);
        if (p) B.add('worms', p, this.groundQuat(p, this.rand() * 6.28, 0.3), this.range(0.8, 1.6));
      }
      if (k % 60 === 0) {
        const p = this.spot(k, 2, 16);
        if (p) {
          p.y -= 0.5;
          const s = this.range(0.8, 1.8);
          B.add('ventChimney', p, new THREE.Quaternion().setFromAxisAngle(Y, this.rand() * 6.28), new THREE.Vector3(s, s * this.range(0.9, 1.6), s));
          vents.push({ p: p.clone().add(new THREE.Vector3(0, 6 * s * 1.2, 0)), s });
        }
      }
    }
    this.vents = vents;
    const jellies = [];
    for (let k = 0; k < t.N; k += 3) {
      if (!this.inZone(k, 'trench', 'kelp') || this.rand() > (this.inZone(k, 'trench') ? 0.12 : 0.03)) continue;
      const s = this.rand() < 0.5 ? -1 : 1;
      const p = t.lateralPoint(k, s * this.range(4, 40));
      p.y += this.range(4, 16);
      jellies.push({ x: p.x, y: p.y, z: p.z, s: this.range(0.6, 1.6) });
    }
    this.jellies = new Jellyfish(this.scene, jellies);

    // ---------- sea life ----------
    this.schools = [];
    const schoolSpots = [];
    for (let k = 40; k < t.N; k += 170) schoolSpots.push(k);
    schoolSpots.forEach((k, i) => {
      if (this.inZone(k, 'trench')) return;
      const P = t.P(k);
      const R = t.R(k);
      const c = P.clone().addScaledVector(R, (i % 2 ? 1 : -1) * 30); c.y += 6;
      const rad = 18 + (i % 3) * 8;
      const colors = [0xd8e8f0, 0xffc040, 0x60a0ff, 0xff7050, 0xe8f0d0];
      const path = (tt) => new THREE.Vector3(c.x + Math.cos(tt * 0.05) * rad, c.y + Math.sin(tt * 0.07) * 3, c.z + Math.sin(tt * 0.05) * rad * 1.3);
      this.schools.push(new FishSchool(this.scene, { count: Math.round((30 + (i % 3) * 15) * dens), size: 0.35 + (i % 4) * 0.12, color: colors[i % colors.length], radius: 7, path, speed: 1, metal: i % 2 ? 0.9 : 0.3 }));
    });
    const mantaC = [];
    for (let k = 300; k < t.N; k += 600) { const p = t.P(k); p.y += 14; mantaC.push(p); }
    this.mantas = new Mantas(this.scene, mantaC);
    const cityMid = t.P(cityK[Math.floor(cityK.length * 0.6)] ?? 0);
    this.whale = new Whale(this.scene, cityMid, 130, cityMid.y + 24);

    // ---------- dynamic roadside props ----------
    const addProp = (k, s, model, mass, half, scale = 1, color = null) => {
      const p = t.lateralPoint(k, s * (TRACK.halfWidth + this.range(1.2, TRACK.shoulder - 0.6)));
      p.addScaledVector(t.U(k), half.y);
      const T = t.T(k);
      this.props.push({ model, pos: p, quat: new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(T.x, T.z) + this.rand() * 0.6), scale, mass, half, color });
    };
    for (let k = 30; k < t.N; k += Math.round(55 / dens)) {
      if (t.gap[k] || t.gap[t.wrap(k + 6)]) continue;
      const z = ZONE_IDS[t.zone[k]];
      const s = this.rand() < 0.5 ? -1 : 1;
      if (z === 'wreck') {
        addProp(k, s, 'Barrel_01', 60, new THREE.Vector3(0.3, 0.44, 0.3), 1.0);
        addProp(t.wrap(k + 2), s, 'Barrel_01', 60, new THREE.Vector3(0.3, 0.44, 0.3), 1.0);
        addProp(t.wrap(k + 5), s, 'wooden_crate_01', 45, new THREE.Vector3(0.41 * 1.4, 0.17 * 1.4, 0.2 * 1.4), 1.4);
      } else if (z === 'city') {
        addProp(k, s, 'drum', 400, new THREE.Vector3(0.85, 0.6, 0.85));
      } else if (z !== 'trench') {
        addProp(k, s, 'Barrel_01', 60, new THREE.Vector3(0.3, 0.44, 0.3), 1.0);
      }
    }
    B.build();
    // geometry for the column drums used by dynamic props
    this.drumGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.2, 18);
    this.drumMat = stone;
  }

  update(dt, time, threats) {
    for (const s of this.schools) s.update(dt, threats);
    this.mantas.update(time);
    this.whale.update(time);
  }
}
