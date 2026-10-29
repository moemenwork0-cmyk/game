// Camera rig: spring-damped chase cam (speed FOV, lag, boost kick, impact shake, terrain avoidance),
// bumper cam, far chase, slow-motion crash orbit, and a cinematic orbit for menus.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class CameraRig {
  constructor(camera, terrain) {
    this.cam = camera; this.terrain = terrain;
    this.mode = 0;   // 0 chase, 1 far chase, 2 bumper
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, 1);
    this.shake = 0; this.shakeT = 0;
    this.fov = 62; this.crash = null; this.inited = false;
    this.roll = 0;
  }

  addShake(a) { this.shake = Math.min(1.6, this.shake + a); }

  startCrash(car, duration = 2.4) {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.crash = { car, t: 0, dur: duration, side, ang0: Math.atan2(car.fwd.x, car.fwd.z) + side * 1.2 };
  }

  update(dt, car, boostOn, menu = false) {
    const cam = this.cam;
    if (menu) {
      // slow orbit around the car for the title screen
      this.menuT = (this.menuT || 0) + dt;
      const a = this.menuT * 0.12 + 0.8;
      _a.copy(car.pos).add(_b.set(Math.sin(a) * 6.8, 1.6 + Math.sin(this.menuT * 0.2) * 0.4, Math.cos(a) * 6.8));
      cam.position.copy(_a);
      cam.lookAt(_b.copy(car.pos).add(_c.set(0, 0.55, 0)));
      cam.fov = 42; cam.updateProjectionMatrix();
      this.inited = false;
      return;
    }
    if (this.crash) {
      const c = this.crash;
      c.t += dt;
      const p = c.car.pos;
      const a = c.ang0 + c.side * c.t * 0.55;
      const r = 7.5 - c.t * 0.6;
      _a.set(p.x + Math.sin(a) * r, p.y + 1.6 + c.t * 0.4, p.z + Math.cos(a) * r);
      const gh = this.terrain.heightAt(_a.x, _a.z) + 0.8;
      if (_a.y < gh) _a.y = gh;
      cam.position.copy(_a);
      cam.lookAt(_b.copy(p).add(_c.set(0, 0.5, 0)));
      cam.fov = 50; cam.updateProjectionMatrix();
      if (c.t > c.dur) { this.crash = null; this.inited = false; }
      return;
    }
    const spd = car.speed;
    // heading follows velocity at speed (shows drift angle), body forward when slow
    _a.copy(car.fwd); _a.y = 0; _a.normalize();
    _b.copy(car.linvel); _b.y = 0;
    if (_b.length() > 6 && car.vLocal.z > 0) { _b.normalize(); _a.lerp(_b, 0.35).normalize(); }
    if (!this.inited) this.heading.copy(_a);
    this.heading.lerp(_a, 1 - Math.exp(-dt * 5)).normalize();
    let target;
    if (this.mode === 2) {
      target = _c.set(0, 1.08, 0.35).applyQuaternion(car.quat).add(car.pos);
      cam.position.copy(target);
      this.look.copy(car.fwd).multiplyScalar(20).add(target).addScaledVector(car.up, -0.4);
      cam.up.copy(car.up);
    } else {
      const far = this.mode === 1;
      const dist = (far ? 8.6 : 6.0) + Math.min(spd, 90) * 0.012;
      const height = (far ? 2.9 : 1.95) + Math.min(spd, 90) * 0.004;
      target = _c.copy(car.pos).addScaledVector(this.heading, -dist).add(_b.set(0, height, 0));
      // keep above ground / road
      const gh = this.terrain.heightAt(target.x, target.z) + 0.9;
      target.y = Math.max(target.y, gh, car.pos.y + 0.7);
      if (!this.inited) { this.pos.copy(target); this.vel.set(0, 0, 0); this.inited = true; }
      // critically damped spring
      const k = 90, d = 2 * Math.sqrt(k);
      _a.copy(target).sub(this.pos).multiplyScalar(k).addScaledVector(this.vel, -d);
      this.vel.addScaledVector(_a, dt);
      this.pos.addScaledVector(this.vel, dt);
      // never let it lag too far behind at 300 km/h
      const off = _a.copy(this.pos).sub(target);
      if (off.length() > 3) this.pos.copy(target).addScaledVector(off.normalize(), 3);
      cam.position.copy(this.pos);
      this.look.copy(car.pos).addScaledVector(this.heading, 4.5).add(_b.set(0, 0.95, 0));
      cam.up.set(0, 1, 0);
    }
    // shake (impacts + speed buzz)
    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const buzz = Math.min(1, spd / 85) * 0.02 + this.shake * 0.25;
    const n = (f, o) => Math.sin(this.shakeT * f + o) * 0.5 + Math.sin(this.shakeT * f * 2.37 + o * 1.7) * 0.5;
    cam.position.x += n(31, 1) * buzz; cam.position.y += n(37, 2) * buzz; cam.position.z += n(29, 3) * buzz;
    cam.lookAt(this.look);
    // slight roll into corners
    const yawRate = car.angvel.y;
    this.roll += (Math.max(-0.05, Math.min(0.05, -yawRate * 0.02)) - this.roll) * Math.min(1, dt * 3);
    if (this.mode !== 2) cam.rotateZ(this.roll);
    const fovT = 62 + Math.min(spd, 95) * 0.15 + (boostOn ? 7 : 0);
    this.fov += (fovT - this.fov) * Math.min(1, dt * 3);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
  }
}
