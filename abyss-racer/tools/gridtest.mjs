// Grid start test: 8 cars locked for 3 s, then released under AI control. Prints gears/speeds.
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
road.physBar.forEach((g) => ph.addTrimesh(g, SURF.BARRIER, 0.25));
ph.addHeightfield(terrain);
const ids = ['orca', 'barracuda', 'marlin', 'orca', 'barracuda', 'marlin', 'orca', 'barracuda'];
const cars = ids.map((id, i) => {
  const k = track.wrap(-14 - i * 8);
  const p = track.lateralPoint(k, i % 2 === 0 ? -3.4 : 3.4).addScaledVector(track.U(k), 0.25);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), track.T(k).negate(), track.U(k));
  const v = new Vehicle(ph, CAR_SPECS[id], meta[id], null, p, new THREE.Quaternion().setFromRotationMatrix(m));
  return { id, v, ai: new AIDriver(v, track, { skill: 0.95 }) };
});
const dt = 1 / 120;
for (let s = 0; s < 120 * 9; s++) {
  const t = s * dt, started = t > 3;
  for (const c of cars) { c.v.readState(); if (started) c.ai.update(dt, cars.map((x) => x.v), null); else { c.v.input.throttle = 0; c.v.input.brake = 1; } }
  for (const c of cars) { c.v.locked = !started; c.v.step(dt); }
  ph.step();
  if (s === 300) { const v = cars[6].v; console.log("car6", v.pos.toArray().map(x=>x.toFixed(2)), "up", v.up.toArray().map(x=>x.toFixed(2)), v.wheels.map(w=>[w.contact, w.comp.toFixed(3), w.surf].join("/")).join(" "), "road y", track.P(track.wrap(-14-48)).y.toFixed(2)); }
  if (s % 60 === 0) console.log(t.toFixed(1), cars.map((c) => `${c.v.gear}/${(c.v.speed * 3.6).toFixed(0)}/${c.v.wheels.map(w=>w.w.toFixed(0)).join(':')}`).join('  '));
}
