import * as THREE from 'three';
import { Physics, SURF } from '../src/physics/physics.js';
import { Vehicle } from '../src/physics/vehicle.js';
import { CAR_SPECS } from '../src/physics/carspecs.js';
import fs from 'fs';
const meta = JSON.parse(fs.readFileSync('public/assets/cars/cars.json'));
await Physics.init();
const ph = new Physics();
ph.addStaticBox(new THREE.Vector3(0, -1, 0), null, new THREE.Vector3(50, 1, 3000), SURF.ROAD);
const id = process.argv[2] || 'marlin';
const v = new Vehicle(ph, CAR_SPECS[id], meta[id], null, new THREE.Vector3(0, 0.3, -2900), new THREE.Quaternion());
const dt = 1/120; let t = 0;
for (let i = 0; i < 120*40; i++) {
  v.input.throttle = 1; v.input.steer = 0;
  v.step(dt); ph.step(); t += dt;
  if (i % 240 === 0) { v.readState(); const fx = v.wheels.map(w => w.fx.toFixed(0)).join(','); console.log(`t=${t.toFixed(0)} v=${(v.speed*3.6).toFixed(0)} g=${v.gear} rpm=${v.rpm.toFixed(0)} clutch=${v.clutch.toFixed(2)} fx=${fx} sr=${v.wheels.map(w=>w.sr.toFixed(3)).join(',')} load=${v.wheels.map(w=>w.load.toFixed(0)).join(',')} y=${v.pos.y.toFixed(3)} up=${v.up.y.toFixed(3)}`); }
}
