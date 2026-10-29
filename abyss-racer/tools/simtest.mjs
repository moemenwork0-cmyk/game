// Headless physics test: one or more AI cars lap the circuit; reports lap times, speeds, incidents.
import * as THREE from 'three';
import { Track } from '../src/world/track.js';
import { Terrain } from '../src/world/terrain.js';
import { buildRoad } from '../src/world/roadmesh.js';
import { Physics, SURF } from '../src/physics/physics.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { CAR_SPECS } from '../src/physics/carspecs.js';
import { AIDriver } from '../src/game/ai.js';
import fs from 'fs';

const meta = JSON.parse(fs.readFileSync(new URL('../public/assets/cars/cars.json', import.meta.url)));
await Physics.init();
const track = new Track();
const terrain = new Terrain(track, { step: 4 });
const T = () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture(), arm: new THREE.Texture() });
const road = buildRoad(track, { asphalt: T(), gravel: T(), barrier: T() });
const ph = new Physics();
ph.addTrimesh(road.physRoad, SURF.ROAD, 1.0);
road.physBar.forEach((g) => ph.addTrimesh(g, SURF.BARRIER, 0.2));
ph.addHeightfield(terrain);
const ids = (process.argv[2] || 'marlin').split(',');
const simTime = Number(process.argv[3] || 120);
const cars = [];
ids.forEach((id, i) => {
  const k = track.wrap(-12 - i * 9);
  const p = track.lateralPoint(k, (i % 2 ? 3 : -3)).addScaledVector(track.U(k), 0.3);
  const tdir = track.T(k);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tdir);
  const v = new Vehicle(ph, CAR_SPECS[id], meta[id], null, p, q);
  const ai = new AIDriver(v, track, { skill: 1.0 });
  cars.push({ id, v, ai, lastK: k, laps: 0, lapStart: 0, laps_t: [], maxV: 0, flips: 0, minY: 1e9, offTrack: 0, respawns: 0 });
});
const dt = 1 / 120;
let t = 0;
let accelLog = null;
for (let step = 0; step < simTime / dt; step++) {
  for (const c of cars) { c.v.readState(); }
  for (const c of cars) c.ai.update(dt, cars.map((x) => x.v), null);
  for (const c of cars) c.v.step(dt);
  ph.step();
  t += dt;
  for (const c of cars) {
    const v = c.v;
    v.readState();
    c.maxV = Math.max(c.maxV, v.speed);
    if (!accelLog && v.speed > 27.78 && c === cars[0]) accelLog = t;
    const k = track.nearest(v.pos.x, v.pos.y, v.pos.z, c.lastK);
    if (k >= 0) {
      if (c.lastK > track.N - 200 && k < 200) { c.laps++; c.laps_t.push((t - c.lapStart).toFixed(1)); c.lapStart = t; }
      const loc = track.local(k, v.pos.x, v.pos.y, v.pos.z);
      if (Math.abs(loc.lat) > 13) c.offTrack += dt;
      if (v.up.y < 0.2 || loc.h < -6 || Math.abs(loc.lat) > 30) {
        c.respawns++;
        console.log(`[${t.toFixed(1)}s] ${c.id} reset at k=${k} lat=${loc.lat.toFixed(1)} h=${loc.h.toFixed(1)} up=${v.up.y.toFixed(2)} v=${(v.speed*3.6).toFixed(0)}`);
        let kk = track.wrap(k - 20);
        const jk = Math.round(track.jumpS / track.ds), gapEnd = jk + Math.round(track.jumpGap / track.ds);
        if (track.wrap(kk - (jk - 160)) < 160 + (gapEnd - jk) + 6) kk = track.wrap(gapEnd + 12 + cars.indexOf(c) * 9);
        const p = track.lateralPoint(kk, track.line[kk]).addScaledVector(track.U(kk), 0.4);
        v.teleport(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), track.T(kk)));
        v.setSpeed(Math.min(26, track.lineSpeed[kk] * 0.7));
        c.lastK = kk; continue;
      }
      c.lastK = k;
    }
  }
  if (process.env.DBG2 && t > +process.env.DBG2 && step % 30 === 0) { const v = cars[0].v; const c0 = cars[0]; const lc = track.local(c0.lastK, v.pos.x, v.pos.y, v.pos.z); console.log("dbg2", t.toFixed(2), "k", c0.lastK, "lat", lc.lat.toFixed(1), "h", lc.h.toFixed(2), "v", (v.speed*3.6).toFixed(0), "line", (track.lineSpeed[c0.lastK]*3.6).toFixed(0), "air", v.airborne.toFixed(2), "yaw", v.angvel.y.toFixed(2), "st", v.input.steer.toFixed(2), "thr", v.input.throttle.toFixed(1), "brk", v.input.brake.toFixed(1), "fwdT", v.fwd.dot(track.T(c0.lastK)).toFixed(2), "ground", v.grounded); }
  if (process.env.DBG && t > +process.env.DBG && step % 30 === 0) { const v = cars[0].v; console.log("dbg", t.toFixed(2), "rev", v.reverse, "thr", v.throttle.toFixed(1), "brk", v.brake.toFixed(1), "rpm", v.rpm.toFixed(0), "clutch", v.clutch.toFixed(2), "vF", v.vLocal.z.toFixed(2), v.wheels.map(w => `[w=${w.w.toFixed(1)} fx=${w.fx.toFixed(0)} fy=${w.fy.toFixed(0)} load=${w.load.toFixed(0)} sr=${w.sr.toFixed(2)}]`).join(" ")); }
  if (step % 1200 === 0) {
    const c = cars[0], v = c.v;
    const lc = track.local(c.lastK, v.pos.x, v.pos.y, v.pos.z);
    console.log(`t=${t.toFixed(0)} lat=${lc.lat.toFixed(1)} h=${lc.h.toFixed(2)} up=${v.up.y.toFixed(2)} fwdT=${v.fwd.dot(track.T(c.lastK)).toFixed(2)} wheels=${v.wheels.map(w=>w.contact?w.surf:"-").join("")} thr=${v.input.throttle.toFixed(1)} brk=${v.input.brake.toFixed(1)} st=${v.input.steer.toFixed(2)} rev=${v.reverse} k=${c.lastK} v=${(v.speed * 3.6).toFixed(0)}km/h gear=${v.gear} rpm=${v.rpm.toFixed(0)} grounded=${v.grounded} comp=${v.wheels.map(w=>w.comp.toFixed(3)).join(',')} y=${v.pos.y.toFixed(2)}`);
  }
}
console.log('0-100 km/h:', accelLog?.toFixed(2), 's');
for (const c of cars) console.log(c.id, 'laps', c.laps_t.join(' '), 'max', (c.maxV * 3.6).toFixed(0), 'km/h', 'respawns', c.respawns, 'offTrack s', c.offTrack.toFixed(1));
