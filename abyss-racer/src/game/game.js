// Game orchestrator: renderer + quality, world, physics, cars, race loop, camera, effects, audio, HUD.
import * as THREE from 'three';
import { World } from '../world/world.js';
import { PostFX } from '../render/post.js';
import { UW } from '../render/underwater.js';
import { SkidMarks } from '../render/skidmarks.js';
import { Physics, SURF } from '../physics/physics.js';
import { Vehicle } from '../physics/vehicle.js';
import { CAR_SPECS } from '../physics/carspecs.js';
import { CarVisual } from '../car/carmodel.js';
import { loadCars, loaded } from '../core/assets.js';
import { AIDriver } from './ai.js';
import { Race } from './race.js';
import { CameraRig } from './camera.js';
import { DamageSystem } from './damage.js';
import { Input } from './input.js';

export const QUALITY = {
  low: { name: 'Low', scale: 0.6, msaa: 0, shadows: false, shadowSize: 512, density: 0.45, bloomLevels: 4, snow: 500, godRays: 12, particles: 0.5, terrainStep: 4, maxPixelRatio: 1 },
  medium: { name: 'Medium', scale: 0.8, msaa: 2, shadows: false, shadowSize: 1024, density: 0.7, bloomLevels: 5, snow: 900, godRays: 18, particles: 0.75, terrainStep: 4, maxPixelRatio: 1.5 },
  high: { name: 'High', scale: 1.0, msaa: 4, shadows: true, shadowSize: 1024, density: 1.0, bloomLevels: 5, snow: 1400, godRays: 24, particles: 1, terrainStep: 4, maxPixelRatio: 2 },
  ultra: { name: 'Ultra', scale: 1.0, msaa: 4, shadows: true, shadowSize: 2048, density: 1.25, bloomLevels: 6, snow: 2000, godRays: 30, particles: 1.3, terrainStep: 4, maxPixelRatio: 3 },
};

export const LIVERIES = [
  { paint: 0xd8dde3, accent: 0xff4a1a, accent2: 0x111111, stripe: 1, rim: 0x2a2c30, caliper: 0xff5a10 },
  { paint: 0x0a3d91, accent: 0xf2c200, accent2: 0x0a0a0a, stripe: 2, rim: 0xc8a050, caliper: 0xf2c200 },
  { paint: 0xc4161c, accent: 0xffffff, accent2: 0x111111, stripe: 1, rim: 0xb0b5bb, caliper: 0xe0e0e0 },
  { paint: 0x111316, accent: 0x18e0ff, accent2: 0x18e0ff, stripe: 2, rim: 0x18181a, caliper: 0x18e0ff },
  { paint: 0xf28a00, accent: 0x101010, accent2: 0x101010, stripe: 1, rim: 0x202020, caliper: 0x111111 },
  { paint: 0x1f7a3a, accent: 0xf0f0e0, accent2: 0xf0f0e0, stripe: 2, rim: 0xd0d0d0, caliper: 0xf0c000 },
  { paint: 0x6a1fb0, accent: 0xff70d0, accent2: 0x111111, stripe: 1, rim: 0x8a8f95, caliper: 0xff70d0 },
  { paint: 0xe8e2c8, accent: 0x0b4a8f, accent2: 0x0b4a8f, stripe: 2, rim: 0x303236, caliper: 0x0b4a8f },
];

const RIVALS = ['K. Okafor', 'L. Moreau', 'S. Varga', 'T. Hayashi', 'R. Alvarez', 'N. Petrov', 'A. Haddad', 'J. Lindqvist'];

export class Game {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.time = 0; this.timeScale = 1; this.slowT = 0;
    this.input = new Input();
    this.state = 'loading';
    this.flashV = 0;
  }

  async init(progress) {
    const q = this.q = QUALITY[this.settings.quality] || QUALITY.high;
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    progress(0.05, 'Starting physics engine');
    await Physics.init();
    this.world = new World();
    await this.world.load(renderer, q, progress);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.12, 520);
    this.post = new PostFX(renderer, { msaa: q.msaa, bloomLevels: q.bloomLevels });
    this.resize();
    addEventListener('resize', () => this.resize());
    progress(0.82, 'Building the cars');
    await loadCars(Object.keys(CAR_SPECS));
    // physics world
    const ph = this.physics = new Physics();
    ph.addTrimesh(this.world.road.physRoad, SURF.ROAD, 1.0);
    this.world.road.physBar.forEach((g) => ph.addTrimesh(g, SURF.BARRIER, 0.25));
    ph.addHeightfield(this.world.terrain);
    for (const c of this.world.scenery.colliders) {
      if (c.type === 'box') ph.addStaticBox(c.pos, c.quat, c.half);
      else ph.addStaticCylinder(c.pos, c.radius, c.height);
    }
    this.spawnProps();
    this.skids = new SkidMarks(this.world.scene);
    this.cameraRig = new CameraRig(this.camera, this.world.terrain);
    this.damage = new DamageSystem(this);
    // headlight for the player (one shadowless spot keeps the shader count constant)
    this.headlight = new THREE.SpotLight(0xdff4ff, 0, 70, 0.55, 0.6, 1.2);
    this.world.scene.add(this.headlight, this.headlight.target);
    this.keyLight = new THREE.PointLight(0x9fe8ff, 0, 9, 1.5);
    this.world.scene.add(this.keyLight);
    progress(0.95, 'Warming up shaders');
    this.state = 'menu';
  }

  spawnProps() {
    const sc = this.world.scenery;
    const models = sc.models;
    for (const p of sc.props) {
      let obj;
      if (p.model === 'drum') {
        obj = new THREE.Mesh(sc.drumGeo, sc.drumMat);
      } else {
        obj = models[p.model].clone();
        obj.scale.setScalar(p.scale);
        // re-centre on the collider
        const box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        const wrap = new THREE.Group();
        obj.position.sub(c);
        wrap.add(obj);
        obj = wrap;
      }
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      obj.position.copy(p.pos); obj.quaternion.copy(p.quat);
      this.world.scene.add(obj);
      this.physics.addProp(obj, { shape: p.model === 'drum' || p.model === 'Barrel_01' ? 'cyl' : 'box', half: p.half, mass: p.mass, pos: p.pos, quat: p.quat });
    }
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.q.maxPixelRatio);
    const w = innerWidth, h = innerHeight;
    this.renderScale = this.renderScale || this.q.scale;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.rw = Math.round(w * dpr * this.renderScale); this.rh = Math.round(h * dpr * this.renderScale);
    this.post.setSize(this.rw, this.rh);
    this.renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.world.pxScale = this.rh / 720;
  }

  /** Build the field: player car + 7 rivals. */
  setupRace(playerCar, playerLivery, opponents = 7) {
    this.clearRace();
    const ids = Object.keys(CAR_SPECS);
    const entrants = [];
    const n = opponents + 1;
    const playerSlot = Math.min(n - 1, this.settings.gridSlot ?? 5);
    let li = 0;
    for (let i = 0; i < n; i++) {
      const isPlayer = i === playerSlot;
      const id = isPlayer ? playerCar : ids[(i + 1) % ids.length];
      let livery = isPlayer ? playerLivery : LIVERIES[(li++ + 3) % LIVERIES.length];
      if (!isPlayer && livery === playerLivery) livery = LIVERIES[(li++ + 3) % LIVERIES.length];
      livery = { ...livery, number: isPlayer ? 7 : [11, 23, 3, 44, 16, 88, 5, 31][i] };
      const visual = new CarVisual({ id, meta: loaded.carMeta[id], geo: loaded.cars[id], envMap: this.world.env, livery });
      this.world.scene.add(visual.group);
      entrants.push({ id, visual, isPlayer, name: isPlayer ? 'YOU' : RIVALS[i % RIVALS.length] });
    }
    this.race = new Race(this, entrants);
    entrants.forEach((e, i) => {
      const slot = this.race.gridSlot(i);
      const v = new Vehicle(this.physics, CAR_SPECS[e.id], loaded.carMeta[e.id], e.visual, slot.p, slot.q);
      e.v = v;
      v.assist = e.isPlayer ? { tcs: this.settings.tcs, abs: this.settings.abs, steer: this.settings.steerAssist } : { tcs: true, abs: true, steer: 0.5 };
      if (!e.isPlayer) {
        const skill = 0.9 + ((i * 37) % 10) / 100 * (this.settings.difficulty ?? 1);
        e.ai = new AIDriver(v, this.world.track, { skill: Math.min(1.02, skill), aggression: (i % 3) * 0.3, laneBias: (i % 2 ? 1 : -1) * 0.8 });
      }
      v.readState();
      v.syncVisual();
    });
    this.player = entrants.find((e) => e.isPlayer);
    this.cars = entrants.map((e) => e.v);
    this.cameraRig.inited = false;
    this.cameraRig.crash = null;
    this.state = 'race';
  }

  clearRace() {
    if (!this.race) return;
    for (const e of this.race.entrants) {
      this.world.scene.remove(e.visual.group);
      for (const c of e.v.colliders) { this.physics.owner.delete(c.handle); }
      this.physics.world.removeRigidBody(e.v.body);
    }
    for (const d of [...this.physics.debris]) this.physics.removeDebris(d);
    for (const p of this.physics.props) {
      p.body.setTranslation(p.home.pos, false); p.body.setRotation(p.home.quat, false);
      p.body.setLinvel({ x: 0, y: 0, z: 0 }, false); p.body.setAngvel({ x: 0, y: 0, z: 0 }, false); p.body.sleep();
      p.obj.position.copy(p.home.pos); p.obj.quaternion.copy(p.home.quat);
    }
    this.race = null;
  }

  // ------------------------------------------------------------------ events
  haptic(ms, amp) {
    if (!this.settings.haptics) return;
    try {
      if (window.AbyssNative) window.AbyssNative.vibrate(Math.round(ms), Math.round(amp));
      else if (navigator.vibrate) navigator.vibrate(Math.round(ms));
    } catch (_) { /* ignore */ }
  }
  flash(a, color = 0xffffff) { this.flashV = Math.max(this.flashV, a); this.post.uniforms.uFlashColor.value.set(color); }
  slowMo(dv) {
    this.slowT = 1.2; this.timeScale = 0.28;
    this.cameraRig.startCrash(this.player.v, 2.0);
    this.audio?.slowMo(true);
  }

  detachPart(car, part, dv, point) {
    part.userData.attached = false;
    part.updateWorldMatrix(true, true);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    part.matrixWorld.decompose(pos, quat, scl);
    const box = new THREE.Box3().setFromObject(part);
    const size = box.getSize(new THREE.Vector3());
    car.visual.group.remove(part);
    // re-parent around its own centre
    const center = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.position.copy(center);
    this.world.scene.add(holder);
    holder.attach(part);
    const vel = car.linvel.clone().multiplyScalar(0.85).add(new THREE.Vector3((Math.random() - 0.5) * dv * 0.4, 1 + Math.random() * dv * 0.25, (Math.random() - 0.5) * dv * 0.4));
    const local = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2).multiplyScalar(0.8);
    this.physics.addDebris(holder, local, part.userData.mass || 5, center, new THREE.Quaternion(), vel, { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 12 });
    this.world.particles.sparks(center, new THREE.Vector3(0, 1, 0), 18, 10);
    this.world.particles.bubbles(center, 20, 0.8, 2.5, 0.08);
    this.audio?.impact(0.6, center, 'part', car === this.player?.v);
    // aero loss
    if (part === car.visual.parts.wing) car.spec = { ...car.spec, downforce: [car.spec.downforce[0], car.spec.downforce[1] * 0.45] };
    if (part === car.visual.parts.splitter) car.spec = { ...car.spec, downforce: [car.spec.downforce[0] * 0.6, car.spec.downforce[1]] };
  }

  loseWheel(car, i, dv, point) {
    const w = car.wheels[i];
    w.lost = true;
    this.detachPart(car, car.visual.wheels[i].steer, dv, point);
    car.health = Math.max(0, car.health - 0.25);
  }

  wreck(car, by) {
    if (car.wrecked) return;
    car.wrecked = true; car.health = 0; car.engineOn = false;
    for (const name of ['wing', 'splitter', 'diffuser', 'mirrorL', 'mirrorR']) {
      const part = car.visual.parts[name];
      if (part && part.userData.attached && Math.random() < 0.7) this.detachPart(car, part, 12, car.pos);
    }
    this.world.particles.bubbles(car.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 60, 2.2, 3, 0.12);
    this.world.particles.silt(car.pos, car.linvel, 14, [0.35, 0.34, 0.3], 2.2, 5);
    this.audio?.impact(1, car.pos, 'wreck', car === this.player?.v || by === this.player?.v);
    const victim = this.race?.entrants.find((e) => e.v === car);
    const attacker = by || (car.lastHitBy && this.time - car.lastHitT < 2.5 ? car.lastHitBy : null);
    if (attacker && attacker === this.player?.v && car !== attacker) {
      this.player.takedowns++;
      this.player.nitro = Math.min(1, this.player.nitro + 0.35);
      this.hud?.message('TAKEDOWN!', `${victim?.name ?? ''} wrecked`, '#ff4d2e');
      this.haptic(220, 255);
    }
    if (car === this.player?.v) {
      this.hud?.message('WRECKED', 'Respawning…', '#ff3b30');
      this.slowT = 1.4; this.timeScale = 0.25;
      this.cameraRig.startCrash(car, 3.2);
    }
  }

  onRespawn(e) {
    // fresh-ish car: repair cosmetics partially? keep dents but restore aero/wheels
    const v = e.v;
    v.wheels.forEach((w, i) => {
      if (w.lost) {
        w.lost = false;
        const vw = v.visual.wheels[i];
        if (vw.steer.parent !== v.visual.group) {
          const d = this.physics.debris.find((x) => x.obj.children.includes(vw.steer));
          vw.steer.removeFromParent();
          if (d) this.physics.removeDebris(d);
          v.visual.group.add(vw.steer);
          vw.steer.position.copy(vw.rest); vw.steer.quaternion.identity();
          vw.steer.userData.attached = true;
        }
      }
    });
    if (e.isPlayer) this.cameraRig.inited = false;
  }

  onCountdown(n) { this.hud?.countdown(n); this.audio?.beep(n === 0 ? 2 : 1); if (n === 0) this.input.calibrateTilt(); }
  onLap(e) { if (e.isPlayer) { this.hud?.message(`LAP ${e.lap + 1}/${this.race.laps}`, e.lastLap === e.best ? `Best lap ${fmt(e.lastLap)}` : `Lap ${fmt(e.lastLap)}`, '#18e0ff'); this.audio?.beep(3); } }
  onFinish(e) { if (e.isPlayer) { this.hud?.message('FINISH', `P${e.pos} · ${fmt(e.finishT)}`, '#ffd23f'); this.audio?.beep(4); this.finishedAt = this.time; } }
  onNearMiss(e) { this.hud?.toast('NEAR MISS +NITRO'); }

  // ------------------------------------------------------------------ loop
  frame(dtReal) {
    dtReal = Math.min(dtReal, 0.05);
    if (this.slowT > 0) { this.slowT -= dtReal; if (this.slowT <= 0) { this.timeScale = 1; this.audio?.slowMo(false); } }
    const dt = dtReal * (this.state === 'race' && !this.paused ? this.timeScale : 0);
    this.input.update(dtReal);
    if (this.state === 'race' && this.race) this.raceFrame(dt, dtReal);
    else if (this.state === 'menu') this.menuFrame(dtReal);
    this.input.endFrame();
  }

  menuFrame(dt) {
    this.time += dt;
    UW.uTime.value = this.time;
    const showcase = this.showcase;
    if (showcase) {
      this.cameraRig.update(dt, showcase.state, false, true);
      this.world.updateLighting(this.camera.position, showcase.state.pos);
      this.keyLight.intensity = 0;
    }
    this.world.update(dt, this.time, this.camera.position, []);
    this.render();
  }

  raceFrame(dt, dtReal) {
    const race = this.race;
    const p = this.player;
    // player controls -> vehicle input
    const pv = p.v;
    const inp = this.input;
    const started = race.state === 'racing' || race.state === 'finished';
    if (p.finished) {
      // autopilot after the flag
      if (!p.ai) p.ai = new AIDriver(pv, this.world.track, { skill: 0.8 });
    }
    if (this.autopilot && !p.ai) p.ai = new AIDriver(pv, this.world.track, { skill: 1.0 });
    if (!p.finished && !this.autopilot) {
      pv.input.steer = inp.steer;
      pv.input.throttle = started ? inp.throttle : 0;
      pv.input.brake = started ? inp.brake : (inp.throttle > 0 ? 0 : 1);
      pv.input.handbrake = inp.handbrake;
      if (!started) pv.input.brake = 1;
      // revving on the grid
      if (!started) this.gridRev = inp.throttle;
      if (inp.boost && p.nitro > 0.05 && started) p.nitroOn = true;
      if (!inp.boost) p.nitroOn = false;
    }
    if (inp.took('KeyC')) this.cameraRig.mode = (this.cameraRig.mode + 1) % 3;
    if (inp.took('KeyR') && started) race.respawn(p, 5);
    // fixed-step physics at 120 Hz
    this.acc = (this.acc || 0) + dt;
    const h = this.physics.world.timestep;
    let steps = 0;
    while (this.acc >= h && steps < 8) {
      for (const e of race.entrants) {
        e.v.readState();
        if (e.ai && started) e.ai.update(h, this.cars, pv);
        if (e.ai && !started) { e.v.input.throttle = 0; e.v.input.brake = 1; e.v.input.steer = 0; }
        if (e.ai && started && !e.isPlayer && e.nitro > 0.6 && Math.random() < 0.002) e.nitroOn = true;
      }
      for (const v of this.cars) { v.locked = !started; v.step(h); }
      this.physics.step();
      this.damage.collect();
      this.acc -= h; steps++;
    }
    if (steps === 8) this.acc = 0;
    this.time += dt;
    UW.uTime.value = this.time;
    race.update(dt);
    // rubber band: AI behind the player push a little, far ahead ease off
    for (const e of race.entrants) {
      if (!e.ai || e.isPlayer) continue;
      const gap = (e.progress - p.progress) * this.world.track.ds;
      e.ai.rubber = 1 + Math.max(-0.06, Math.min(0.05, -gap / 2500));
    }
    this.damage.apply();
    this.physics.syncVisuals(dt);
    for (const v of this.cars) v.syncVisual();
    this.carEffects(dt);
    this.skids.update();
    // camera + lighting
    this.cameraRig.update(dtReal * (this.timeScale < 1 ? 0.6 : 1), pv, pv.boost > 0);
    this.world.updateLighting(this.camera.position, pv.pos);
    this.updateHeadlight(pv);
    this.world.update(dt, this.time, this.camera.position, this.cars.map((v) => v.pos));
    // post fx driven by speed / boost / damage
    const u = this.post.uniforms;
    const spd = pv.speed;
    u.uSpeedBlur.value = Math.max(0, (spd - 30) / 60) * 0.9 + (pv.boost ? 0.6 : 0);
    u.uChroma.value = 0.012 + (pv.boost ? 0.02 : 0) + this.flashV * 0.05;
    u.uFlash.value = this.flashV;
    this.flashV = Math.max(0, this.flashV - dtReal * 2.5);
    u.uDesat.value = Math.max(0, 0.35 - pv.health) * 0.8 + (this.timeScale < 1 ? 0.25 : 0);
    this.audio?.update(dtReal, this);
    this.hud?.update(dtReal, this);
    if (!this.noRender) this.render();
  }

  /** Advance the race by `sec` seconds of game time at 60 fps without rendering (automation/tests). */
  simulate(sec, onFrame) {
    this.noRender = true;
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) { this.frame(1 / 60); onFrame?.(i); }
    this.noRender = false;
  }

  updateHeadlight(v) {
    const depth = UW.uSurfaceY.value - v.pos.y;
    const dark = Math.min(1, Math.max(0, (depth - 30) / 50));
    this.headlight.intensity = v.wrecked ? 0 : 30 + dark * 160;
    this.headlight.position.copy(v.visual.group.localToWorld(v.visual.headlightLocal.clone()));
    this.headlight.target.position.copy(v.visual.group.localToWorld(new THREE.Vector3(0, -1.5, 30)));
    // key light hugging the player's car so paint always reads in the gloom
    this.keyLight.intensity = 2 + dark * 4;
    this.keyLight.position.copy(v.pos).add(new THREE.Vector3(0, 3.2, 0)).addScaledVector(v.fwd, -1.5);
    for (const c of this.cars) c.visual.coneMat.uniforms.uInt.value = (c.wrecked ? 0 : 0.35 + dark * 1.4);
  }

  carEffects(dt) {
    const P = this.world.particles;
    const tmp = new THREE.Vector3();
    for (const v of this.cars) {
      const vis = v.visual;
      const near = v.pos.distanceToSquared(this.camera.position) < 120 * 120;
      if (!near) continue;
      // exhaust bubbles
      const rate = (0.3 + v.throttle * 1.5 + (v.boost ? 6 : 0)) * dt * 30;
      for (const ex of vis.exhausts) {
        if (Math.random() < rate) {
          const wp = vis.group.localToWorld(tmp.copy(ex));
          P.bubbles(wp, v.boost ? 3 : 1, 0.1, 0.8, v.boost ? 0.09 : 0.045);
        }
        if (v.boost) { const wp = vis.group.localToWorld(tmp.copy(ex)); P.glow(wp, [0.3, 1.6, 2.2], 0.6, 0.08); }
      }
      // tyres: silt on sand / run-off, cavitation + rubber dust on tarmac when sliding, skid marks
      v.wheels.forEach((w, i) => {
        const key = v.body.handle * 8 + i;
        if (!w.contact || w.lost) { this.skids.lift(key); return; }
        const slip = w.slipVel;
        const loose = w.surf === SURF.SAND || w.surf === SURF.RUNOFF;
        if (loose && v.speed > 3 && Math.random() < Math.min(1, v.speed / 25) * dt * 22) {
          P.silt(w.point, v.linvel, 1, w.surf === SURF.SAND ? [0.45, 0.42, 0.34] : [0.5, 0.45, 0.42], 0.8 + v.speed * 0.015, 3);
        }
        if (!loose && slip > 4.5) {
          if (Math.random() < dt * 25 * Math.min(1, slip / 15)) {
            P.silt(w.point, v.linvel.clone().multiplyScalar(0.3), 1, [0.32, 0.33, 0.34], 0.5 + slip * 0.03, 2.2);
            P.bubbles(w.point, 1, 0.3, 1.0, 0.04);
          }
          const side = tmp.set(1, 0, 0).applyQuaternion(v.quat);
          this.skids.add(key, w.point, side, 0.26, Math.min(1, (slip - 4.5) / 8));
        } else this.skids.lift(key);
      });
      // landing thump
      if (v.grounded && v.lastAir > 0.45) {
        P.silt(v.pos, v.linvel, 8, [0.4, 0.38, 0.32], 1.6, 3);
        this.audio?.impact(Math.min(1, v.lastAir / 1.5), v.pos, 'land', v === this.player.v);
        if (v === this.player.v) { this.cameraRig.addShake(0.4); this.haptic(60, 160); }
      }
      v.lastAir = v.airborne > 0 ? v.airborne : (v.grounded ? 0 : v.lastAir);
      // smoke-like bubbles from a badly damaged engine
      if (v.health < 0.4 && Math.random() < dt * (1 - v.health) * 12) {
        P.bubbles(vis.group.localToWorld(tmp.set(0, 0.8, v.meta.length * 0.32)), 2, 0.4, 1.4, 0.07);
      }
      v.scrapeLevel = Math.max(0, (v.scrapeLevel || 0) - dt * 4);
    }
  }

  render() {
    this.post.render(this.world.scene, this.camera, this.time);
  }
}

export function fmt(t) {
  if (!isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}
