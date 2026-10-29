// Vehicle dynamics on a Rapier rigid body:
//  - per-wheel raycast suspension (progressive spring, split bump/rebound damping, bump stops, anti-roll bars)
//  - combined-slip tyre model (normalised slip vector, load sensitivity, surface grip, relaxation-free
//    stable at low speed via per-step force limiting)
//  - engine torque curve, rev limiter, engine braking, auto clutch launch, 7-speed sequential auto box with
//    shift time and torque cut, open/AWD drivetrain, brakes with bias + ABS, handbrake, TCS
//  - aero drag + front/rear downforce, steering with speed-sensitive lock, Ackermann and countersteer assist
import * as THREE from 'three';
import { GROUP_CAR, GROUP_CAR_GHOST, QUERY_WHEELS, SURF } from './physics.js';
import { torqueAt } from './carspecs.js';

const GRAV = 9.81;
const SURF_GRIP = { [SURF.ROAD]: 1.0, [SURF.RUNOFF]: 0.72, [SURF.SAND]: 0.62, [SURF.BARRIER]: 0.5, [SURF.PROP]: 0.6, [SURF.CAR]: 0.45, [SURF.ROCK]: 0.7 };
const SURF_ROLL = { [SURF.ROAD]: 0.012, [SURF.RUNOFF]: 0.05, [SURF.SAND]: 0.09, [SURF.BARRIER]: 0.02, [SURF.PROP]: 0.03, [SURF.CAR]: 0.02, [SURF.ROCK]: 0.03 };

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

function tireCurve(s) {
  // normalised slip -> fraction of peak friction: steep rise, peak at 1, falls to ~0.78 when sliding
  if (s <= 1) return s * (2 - s);
  return 1 - 0.22 * Math.min(1, (s - 1) / 3) ** 0.8;
}

export class Vehicle {
  constructor(physics, spec, meta, visual, pos, quat) {
    this.ph = physics;
    this.isVehicle = true;
    this.spec = spec;
    this.meta = meta;
    this.visual = visual;
    const R = physics.R;
    const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(quat)
      .setLinearDamping(0.02).setAngularDamping(0.25).setCcdEnabled(true).setCanSleep(false);
    const m = spec.mass, L = meta.length, W = meta.width;
    const cgZ = (meta.zoff || 0) - 0.05;
    const Ix = m * (0.9 * 0.9 + 0.5 * 0.5) / 5 * 1.1, Iy = m * (L * L / 4 + W * W / 4) / 5 * 1.05, Iz = m * (W * W / 4 + 0.5 * 0.5) / 5 * 1.2;
    bd.setAdditionalMassProperties(m, { x: 0, y: spec.cg, z: cgZ }, { x: Ix, y: Iy, z: Iz }, { x: 0, y: 0, z: 0, w: 1 });
    this.body = physics.world.createRigidBody(bd);
    const mk = (hx, hy, hz, x, y, z, r) => R.ColliderDesc.roundCuboid(hx, hy, hz, r).setTranslation(x, y, z).setDensity(0)
      .setFriction(0.35).setRestitution(0.12).setCollisionGroups(GROUP_CAR)
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(6000);
    const tubTop = Math.max(...meta.tub.yt);
    this.colliders = [
      physics.world.createCollider(mk(W / 2 - 0.12, 0.22, L / 2 - 0.12, 0, 0.46, meta.zoff || 0, 0.1), this.body),
      physics.world.createCollider(mk(0.52, 0.16, 0.95, 0, tubTop + 0.08, -0.2, 0.1), this.body),
    ];
    for (const c of this.colliders) { physics.surface.set(c.handle, SURF.CAR); physics.owner.set(c.handle, this); }
    this.mass = m;
    this.cgLocal = new THREE.Vector3(0, spec.cg, cgZ);
    // wheels
    this.wheels = meta.wheels.map((w, i) => ({
      i, x: w.x, z: w.z, r: w.r, front: w.front, left: w.x > 0,
      // hardpoint height in body space, chosen so the static sag puts the wheel centre at its design height
      top: w.r + spec.rest - this.sagFor(spec, meta, w.front),
      sag: this.sagFor(spec, meta, w.front),
      comp: 0, prevComp: 0, contact: false, load: 0, w: 0, angle: 0, steer: 0,
      sr: 0, sa: 0, surf: SURF.ROAD, normal: new THREE.Vector3(0, 1, 0), point: new THREE.Vector3(),
      vLong: 0, vLat: 0, fx: 0, fy: 0, slipVel: 0, collider: null, inertia: 1.3 + w.r * 1.5,
      driveShare: 0, brakeShare: 0, offset: 0,
    }));
    const front = this.wheels.filter((w) => w.front), rear = this.wheels.filter((w) => !w.front);
    const fs = spec.drive === 'AWD' ? spec.frontSplit : 0;
    front.forEach((w) => { w.driveShare = fs / 2; w.brakeShare = spec.brakeBias / 2; });
    rear.forEach((w) => { w.driveShare = (1 - fs) / 2; w.brakeShare = (1 - spec.brakeBias) / 2; });
    // drivetrain state
    this.gear = 1; this.rpm = spec.idle; this.shiftT = 0; this.clutch = 1; this.throttle = 0; this.brake = 0;
    this.steerIn = 0; this.steerAngle = 0; this.handbrake = 0; this.boost = 0; this.revCut = false; this.reverse = false;
    this.speed = 0; this.vLocal = new THREE.Vector3(); this.airborne = 0; this.grounded = 0;
    this.health = 1; this.wrecked = false; this.engineOn = true; this.ghost = 0;
    this.assist = { tcs: true, abs: true, steer: 0.6 };
    this.shiftEvents = []; this.lastShiftUp = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, boost: 0 };
    this.mat = new THREE.Matrix4(); this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.fwd = new THREE.Vector3(); this.up = new THREE.Vector3(); this.right = new THREE.Vector3();
    this.linvel = new THREE.Vector3(); this.angvel = new THREE.Vector3();
    this.slipAudio = 0; this.skidStrength = [0, 0, 0, 0];
    this.steerBias = 0;   // permanent misalignment from crash damage
    this.powerLoss = 0;
  }

  sagFor(spec, meta, front) {
    const zf = meta.wheelbase / 2, cgZ = -0.05;
    const frontShare = (cgZ + zf) / (2 * zf);
    const load = spec.mass * GRAV * (front ? frontShare : 1 - frontShare) / 2;
    const k = spec.spring[front ? 0 : 1];
    // solve k*x*(1+2.5x) = load
    const a = 2.5 * k, b = k, c = -load;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }

  setGhost(on) {
    this.ghost = on ? 1 : 0;
    for (const c of this.colliders) c.setCollisionGroups(on ? GROUP_CAR_GHOST : GROUP_CAR);
  }

  readState() {
    const t = this.body.translation(), r = this.body.rotation(), lv = this.body.linvel(), av = this.body.angvel();
    this.pos.set(t.x, t.y, t.z); this.quat.set(r.x, r.y, r.z, r.w);
    this.linvel.set(lv.x, lv.y, lv.z); this.angvel.set(av.x, av.y, av.z);
    this.fwd.set(0, 0, 1).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.right.set(-1, 0, 0).applyQuaternion(this.quat);   // driver's right (car faces +z)
    this.vLocal.copy(this.linvel).applyQuaternion(_q.copy(this.quat).invert());
    this.speed = this.linvel.length();
  }

  toWorld(lx, ly, lz, out) { return out.set(lx, ly, lz).applyQuaternion(this.quat).add(this.pos); }

  pointVel(p, out) {
    // v + w x (p - com)
    const com = this.body.worldCom();
    _w.set(p.x - com.x, p.y - com.y, p.z - com.z);
    return out.copy(this.angvel).cross(_w).add(this.linvel);
  }

  step(dt) {
    const s = this.spec, inp = this.input;
    this.readState();
    const vF = this.vLocal.z;   // forward speed (m/s)
    // ---------------- driver inputs ----------------
    let thr = this.wrecked || !this.engineOn ? 0 : inp.throttle;
    let brk = inp.brake;
    // reverse logic: hold brake while (almost) stopped -> reverse gear
    if (!this.reverse && brk > 0.5 && thr < 0.1 && vF < 0.8) { this.revHold = (this.revHold || 0) + dt; if (this.revHold > 0.35) { this.reverse = true; } }
    else if (!(brk > 0.5)) this.revHold = 0;
    if (this.reverse) {
      if (thr > 0.1 && vF > -1.5) { this.reverse = false; }
      else { const t2 = brk; brk = thr; thr = t2; }
    }
    if (this.locked) { thr = 0; brk = 1; this.reverse = false; this.revHold = 0; }
    this.throttle = thr; this.brake = brk;
    // steering: speed-sensitive lock + countersteer assist
    const sp = Math.max(0, Math.abs(vF));
    const lock = s.steerMax / (1 + sp / 19) + 0.02;
    let target = -(inp.steer + this.steerBias) * lock;   // input +1 = right; internal + = left
    const slipAngle = sp > 4 ? Math.atan2(this.vLocal.x, Math.abs(vF)) : 0;   // + = sliding to the left
    target += slipAngle * this.assist.steer * 0.9 * (this.reverse ? 0 : 1);
    target = Math.max(-s.steerMax, Math.min(s.steerMax, target));
    const rate = 2.6 + 4 * (1 - Math.min(1, sp / 40));
    this.steerAngle += Math.max(-rate * dt, Math.min(rate * dt, target - this.steerAngle));
    this.handbrake = inp.handbrake;

    // ---------------- gearbox ----------------
    this.shiftT = Math.max(0, this.shiftT - dt);
    const ratio = (g) => (g < 0 ? -3.0 : s.gears[g - 1]) * s.final;
    const drivenW = this.wheels.reduce((a, w) => a + w.w * (w.driveShare > 0 ? 1 : 0), 0) / this.wheels.filter((w) => w.driveShare > 0).length;
    const gearNow = this.reverse ? -1 : this.gear;
    let wheelRpm = Math.abs(drivenW * ratio(gearNow)) * 60 / (2 * Math.PI);
    if (!this.reverse && this.shiftT <= 0 && !this.wrecked) {
      if (wheelRpm > s.redline - 150 && this.gear < s.gears.length && this.grounded > 0) {
        this.gear++; this.shiftT = 0.16; this.shiftEvents.push('up');
      } else if (this.gear > 1) {
        const downRpm = Math.abs(drivenW * ratio(this.gear - 1)) * 60 / (2 * Math.PI);
        const lim = s.redline * (brk > 0.3 ? 0.78 : 0.62);
        if (downRpm < lim) { this.gear--; this.shiftT = 0.12; this.shiftEvents.push('down'); }
      }
    }
    // ---------------- engine & clutch ----------------
    const launchRpm = s.idle + 2600 * thr + 600;
    let engineRpm;
    if (wheelRpm < launchRpm && thr > 0.05) {
      // clutch slipping: engine held near launch revs, full torque transmitted
      this.clutch = Math.min(1, wheelRpm / launchRpm);
      engineRpm = launchRpm * (1 - this.clutch) + wheelRpm * this.clutch;
    } else {
      this.clutch = 1;
      engineRpm = Math.max(s.idle, wheelRpm);
    }
    if (this.shiftT > 0) engineRpm = this.rpm + (engineRpm - this.rpm) * Math.min(1, dt * 18);
    if (!this.engineOn || this.wrecked) engineRpm = Math.max(0, this.rpm - 3000 * dt);
    this.rpm += (engineRpm - this.rpm) * Math.min(1, dt * 30);
    this.revCut = this.rpm > s.limiter;
    const boost = this.boost > 0 ? 1.45 : 1;
    let tq = torqueAt(s, this.rpm) * thr * boost * (1 - this.powerLoss);
    if (this.revCut || this.shiftT > 0.04) tq = 0;
    if (thr < 0.05 && this.clutch >= 1) tq = -(25 + this.rpm * 0.008);   // engine braking
    let wheelTorque = tq * ratio(gearNow) * 0.92;
    if (!this.engineOn || this.wrecked) wheelTorque = 0;

    // ---------------- suspension raycasts ----------------
    const R = this.ph.R;
    const down = _v.set(0, -1, 0).applyQuaternion(this.quat).clone();
    let grounded = 0;
    const tmp = new THREE.Vector3();
    for (const w of this.wheels) {
      if (w.lost) { w.contact = false; w.comp = 0; w.load = 0; continue; }
      const hp = this.toWorld(w.x, w.top, w.z, new THREE.Vector3());
      const len = s.rest + w.r;
      const ray = new R.Ray(hp, down);
      const hit = this.ph.world.castRayAndGetNormal(ray, len + 0.05, true, undefined, QUERY_WHEELS, undefined, this.body);
      w.prevComp = w.comp;
      if (hit && hit.timeOfImpact <= len) {
        w.contact = true;
        w.comp = len - hit.timeOfImpact;
        w.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
        w.point.copy(hp).addScaledVector(down, hit.timeOfImpact);
        w.surf = this.ph.surface.get(hit.collider.handle) ?? SURF.ROAD;
        w.hitCollider = hit.collider;
        grounded++;
      } else {
        w.contact = false; w.comp = 0; w.load = 0; w.hitCollider = null;
      }
    }
    this.grounded = grounded;
    // anti-roll bars
    const arb = (a, b, k) => { const d = (a.comp - b.comp) * k; return [-d, d]; };
    const fr = this.wheels.filter((w) => w.front), rr = this.wheels.filter((w) => !w.front);
    const [af0, af1] = arb(fr[0], fr[1], s.arb[0]);
    const [ar0, ar1] = arb(rr[0], rr[1], s.arb[1]);
    fr[0].arb = af0; fr[1].arb = af1; rr[0].arb = ar0; rr[1].arb = ar1;

    // ---------------- per-wheel tyre forces ----------------
    const impulse = new THREE.Vector3();
    const slipTotal = [];
    for (const w of this.wheels) {
      const ax = w.front ? 0 : 1;
      const k = s.spring[ax], [cb, cr] = s.damp[ax];
      // steering (Ackermann: inside wheel turns more)
      if (w.front) {
        const a = this.steerAngle;
        const inside = (a > 0 && w.left) || (a < 0 && !w.left);
        w.steer = a * (inside ? 1.12 : 0.9);
      } else w.steer = 0;
      // brake torque request
      let bt = brk * s.brake * 4 * w.brakeShare;
      if (!w.front && this.handbrake > 0) bt += this.handbrake * s.handbrake;
      const dTorque = wheelTorque * w.driveShare;
      if (w.lost) { w.fx = w.fy = 0; w.slipVel = 0; slipTotal.push(0); continue; }
      if (!w.contact) {
        // free wheel: drive and brake act on the wheel only
        w.w += (dTorque / w.inertia) * dt;
        const bw = (bt / w.inertia) * dt;
        w.w = Math.abs(w.w) <= bw ? 0 : w.w - Math.sign(w.w) * bw;
        w.w *= 0.995;
        w.angle += w.w * dt;
        w.fx = w.fy = 0; w.sr = w.sa = 0; w.slipVel = 0;
        slipTotal.push(0);
        continue;
      }
      // suspension force (progressive spring + bump stop)
      const compRate = (w.comp - w.prevComp) / dt;
      const over = Math.max(0, w.comp - s.travel);
      let Fs = k * w.comp * (1 + w.comp * 2.5) + (compRate > 0 ? cb : cr) * compRate + over * k * 8 + w.arb;
      Fs = Math.max(0, Fs);
      w.load = Fs;
      // wheel frame on the contact plane
      const n = w.normal;
      const cs = Math.cos(w.steer), sn = Math.sin(w.steer);
      const fwdW = tmp;
      // local forward rotated by steer around local up: +steer turns towards driver's left (+x local)
      fwdW.set(sn, 0, cs).applyQuaternion(this.quat);
      fwdW.addScaledVector(n, -fwdW.dot(n)).normalize();
      const sideW = new THREE.Vector3().crossVectors(n, fwdW).normalize();   // points to the wheel's left
      const pv = this.pointVel(w.point, new THREE.Vector3());
      const vLong = pv.dot(fwdW), vLat = pv.dot(sideW);
      w.vLong = vLong; w.vLat = vLat;
      const grip = s.mu * (SURF_GRIP[w.surf] ?? 0.8) * (w.front ? 1.0 : 1.07);   // slight stable (understeer) balance
      const Fz0 = this.mass * GRAV / 4;
      const loadMu = grip * (1 - 0.1 * (Fs / Fz0 - 1));
      const Fmax = Math.max(0, loadMu * Fs);
      const vRef = Math.max(Math.abs(vLong), 3.5);
      // ABS / TCS shaping of torque before computing slip
      let slipR = (w.w * w.r - vLong) / vRef;
      if (this.assist.abs && brk > 0.1 && slipR < -0.14 && Math.abs(vLong) > 3) bt *= 0.35;
      let drive = dTorque;
      if (this.assist.tcs && !this.reverse && drive > 0 && slipR > 0.1) drive *= Math.max(0.15, 1 - (slipR - 0.1) / 0.12);
      const kP = 0.11, aP = 0.13;
      const sx = slipR / kP;
      const alpha = Math.atan2(vLat, vRef);
      const sy = alpha / aP;
      const sMag = Math.hypot(sx, sy);
      let Fx = 0, Fy = 0;
      if (sMag > 1e-5) {
        const f = tireCurve(sMag) * Fmax;
        Fx = f * sx / sMag;
        Fy = -f * sy / sMag;
      }
      // rolling resistance
      Fx -= Math.sign(vLong) * (SURF_ROLL[w.surf] ?? 0.02) * Fs * Math.min(1, Math.abs(vLong));
      // stability limits (no overshoot within a step)
      const mWheel = Math.max(Fs / GRAV, 60);
      const latMax = Math.abs(vLat) * mWheel / dt;
      Fy = Math.max(-latMax, Math.min(latMax, Fy));
      // semi-implicit limit: the force may not push the contact slip velocity past zero within this step,
      // taking the drive and brake torques acting on the wheel during the step into account
      const slipV = w.w * w.r - vLong;
      const K = w.r * w.r / w.inertia + 1 / mWheel;
      const tb = Math.abs(w.w) > 1e-3 ? -Math.sign(w.w) * Math.min(bt, Math.abs(w.w) * w.inertia / dt) : 0;
      const slipFree = slipV + dt * (drive + tb) * w.r / w.inertia;
      const lim = slipFree / (dt * K);
      if (Math.sign(Fx) === Math.sign(lim)) { if (Math.abs(Fx) > Math.abs(lim)) Fx = lim; } else Fx = lim * 0.5;
      // integrate wheel spin
      w.w += ((drive - Fx * w.r) / w.inertia) * dt;
      const bw = (bt / w.inertia) * dt;
      if (Math.abs(w.w) <= bw) w.w = 0; else w.w -= Math.sign(w.w) * bw;
      // standing still with brakes: hold the car (static friction)
      if (bt > 200 && Math.abs(vLong) < 0.6 && Math.abs(drive) < bt) {
        Fx = -vLong * mWheel / dt * 0.5;
        Fx = Math.max(-Fmax, Math.min(Fmax, Fx));
      }
      w.angle += w.w * dt;
      w.sr = slipR; w.sa = alpha; w.fx = Fx; w.fy = Fy;
      w.slipVel = Math.hypot(w.w * w.r - vLong, vLat);
      slipTotal.push(w.slipVel);
      // apply suspension along the body up axis and tyre forces in the ground plane
      impulse.copy(this.up).multiplyScalar(Fs * dt);
      impulse.addScaledVector(fwdW, Fx * dt).addScaledVector(sideW, Fy * dt);
      // apply at the contact point lifted slightly towards the roll centre
      const ap = w.point.clone().addScaledVector(this.up, 0.12);
      this.body.applyImpulseAtPoint(impulse, ap, true);
      // reaction on whatever we stand on (other cars, props)
      if (w.hitCollider && w.surf !== SURF.ROAD && w.surf !== SURF.SAND && w.surf !== SURF.RUNOFF) {
        const other = w.hitCollider.parent();
        if (other && other.isDynamic()) other.applyImpulseAtPoint(impulse.clone().negate(), w.point, true);
      }
    }
    // ---------------- limited-slip differentials: couple driven wheels on each axle ----------------
    for (const axle of [fr, rr]) {
      const [a, b] = axle;
      if (a.driveShare <= 0 || a.lost || b.lost) continue;
      const avg = (a.w + b.w) / 2;
      const lock = this.throttle > 0.1 ? 0.6 : 0.25;
      a.w += (avg - a.w) * lock; b.w += (avg - b.w) * lock;
    }
    // ---------------- aero ----------------
    const v2 = this.speed * this.speed;
    if (this.speed > 0.5) {
      const dragF = this.linvel.clone().multiplyScalar(-s.drag * this.speed * (this.wrecked ? 2.5 : 1));
      this.body.applyImpulse(dragF.multiplyScalar(dt), true);
    }
    const vF2 = Math.max(0, vF) * Math.max(0, vF);
    const dfF = s.downforce[0] * vF2 * (this.grounded ? 1 : 0.3), dfR = s.downforce[1] * vF2 * (this.grounded ? 1 : 0.3);
    const L = this.meta.wheelbase / 2;
    this.body.applyImpulseAtPoint(this.up.clone().multiplyScalar(-dfF * dt), this.toWorld(0, 0.3, (this.meta.zoff || 0) + L, new THREE.Vector3()), true);
    this.body.applyImpulseAtPoint(this.up.clone().multiplyScalar(-dfR * dt), this.toWorld(0, 0.3, (this.meta.zoff || 0) - L, new THREE.Vector3()), true);
    // boost thrust ("hydro-jet")
    if (this.boost > 0 && !this.wrecked) this.body.applyImpulse(this.fwd.clone().multiplyScalar(5200 * dt), true);
    // airborne: mild self-levelling from the underwater flow over the body (keeps jumps readable)
    if (grounded === 0) {
      this.airborne += dt;
      const corr = new THREE.Vector3().crossVectors(this.up, new THREE.Vector3(0, 1, 0)).multiplyScalar(this.mass * 1.2 * dt);
      this.body.applyTorqueImpulse(corr, true);
    } else this.airborne = 0;
    this.slipAudio = Math.max(...slipTotal);
  }

  /** Visual sync (call once per render frame). */
  syncVisual(alpha = 1) {
    const v = this.visual;
    const t = this.body.translation(), r = this.body.rotation();
    v.group.position.set(t.x, t.y, t.z);
    v.group.quaternion.set(r.x, r.y, r.z, r.w);
    const s = this.spec;
    v.updateWheels(this.wheels.map((w) => ({
      steer: w.steer,
      spin: w.angle,
      offset: (w.contact ? w.comp : 0) - w.sag,
    })));
    v.setLights(this.wrecked ? 0 : 1, this.brake > 0.1 ? 1 : 0, this.reverse ? 1 : 0);
  }

  teleport(pos, quat) {
    this.body.setTranslation(pos, true);
    this.body.setRotation(quat, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (const w of this.wheels) { w.w = 0; w.comp = w.prevComp = 0; }
    this.gear = 1; this.rpm = this.spec.idle; this.reverse = false;
  }

  setSpeed(fwdSpeed) {
    this.readState();
    const v = this.fwd.clone().multiplyScalar(fwdSpeed);
    this.body.setLinvel(v, true);
    for (const w of this.wheels) w.w = fwdSpeed / w.r;
  }
}
