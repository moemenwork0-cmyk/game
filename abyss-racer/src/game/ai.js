// AI driver: follows the racing line with pure-pursuit steering, plans braking from the speed profile,
// overtakes / avoids traffic, recovers when stuck, and may pick a fight with the player (aggression).
import * as THREE from 'three';

const _l = new THREE.Vector3(), _q = new THREE.Quaternion(), _t = new THREE.Vector3();

export class AIDriver {
  constructor(vehicle, track, { skill = 0.95, aggression = 0.3, laneBias = 0 } = {}) {
    this.v = vehicle; this.track = track;
    this.skill = skill; this.aggression = aggression; this.laneBias = laneBias;
    this.k = -1; this.offset = 0; this.offsetTarget = 0;
    this.stuckT = 0; this.reverseT = 0; this.mistakeT = 0;
    this.rubber = 1;
    this.gripScale = Math.sqrt(vehicle.spec.mu / 1.45) * (vehicle.spec.drive === 'AWD' ? 1.0 : 0.97);
  }

  update(dt, cars, player) {
    const v = this.v, t = this.track, inp = v.input;
    if (v.wrecked) { inp.throttle = 0; inp.brake = 1; inp.steer = 0; return; }
    const p = v.pos;
    this.k = t.nearest(p.x, p.y, p.z, this.k);
    if (this.k < 0) return;
    const speed = Math.max(0, v.vLocal.z);
    // ---------- traffic: choose a lateral offset ----------
    let want = this.laneBias;
    let followSpeed = 1e9;
    const hw = t.halfWidth[this.k] - 2.0;
    const me = t.local(this.k, p.x, p.y, p.z);
    for (const c of cars) {
      if (c === v || c.wrecked) continue;
      const o = t.local(this.k, c.pos.x, c.pos.y, c.pos.z);
      const ahead = o.along;
      if (ahead > 2 && ahead < 14 + speed * 0.6) {
        const dl = o.lat - (me.lat);
        const closing = speed - Math.max(0, c.vLocal.z);
        if (Math.abs(dl) < 2.3 && ahead < 6 + speed * 0.35) followSpeed = Math.min(followSpeed, Math.max(0, c.vLocal.z) - 1 + (ahead - 5) * 0.5);
        if (Math.abs(dl) < 2.6 && closing > -1) {
          // pass on the side with more room
          const roomL = hw + o.lat, roomR = hw - o.lat;
          want = o.lat + (roomR > roomL ? 3.2 : -3.2);
        }
      }
      // aggression: lean on the player when alongside
      if (c === player && this.aggression > 0.4 && Math.abs(ahead) < 4 && Math.abs(o.lat - me.lat) < 4) {
        want = o.lat * 0.7 + me.lat * 0.3;
      }
    }
    this.offsetTarget = Math.max(-hw, Math.min(hw, want));
    this.offset += (this.offsetTarget - this.offset) * Math.min(1, dt * 1.5);
    // ---------- steering: pure pursuit on the racing line ----------
    const look = 7 + speed * 0.5;
    const kl = t.wrap(this.k + Math.round(look / t.ds));
    const lat = t.line[kl] * (1 - Math.min(1, Math.abs(this.offset) / 4)) + this.offset;
    t.lateralPoint(kl, lat, _t);
    _l.copy(_t).sub(p).applyQuaternion(_q.copy(v.quat).invert());
    const ang = Math.atan2(_l.x, Math.max(0.1, _l.z));   // + = target to the left
    const lock = v.spec.steerMax / (1 + speed / 19) + 0.02;
    // pure pursuit with yaw-rate damping (internal + = left)
    const yawRate = v.angvel.dot(v.up);
    const yawDes = 2 * Math.max(speed, 3) * Math.sin(ang) / look;
    let delta = ang * 1.1 - 0.10 * (yawRate - yawDes);
    if (!v.grounded) delta = 0;               // wheels in the air do nothing; land straight
    let steer = -delta / lock;
    // ---------- speed: look ahead for the slowest required speed within braking distance ----------
    let vt = 1e9;
    const brakeD = speed * speed / (2 * 9.0) + 15;
    const grade = t.tan[this.k * 3 + 1];
    const decel = Math.max(4, 8.5 + 9.81 * grade);
    for (let d = 0; d < brakeD; d += 4) {
      const kk = t.wrap(this.k + Math.round(d / t.ds));
      const vReq = t.lineSpeed[kk] * this.skill * this.rubber * this.gripScale;
      const allowed = Math.sqrt(vReq * vReq + 2 * decel * d);
      vt = Math.min(vt, allowed);
    }
    vt = Math.min(vt, Math.max(followSpeed, 4));
    // off the racing line costs grip
    vt *= 1 - Math.min(0.15, Math.abs(this.offset) * 0.012);
    let thr = 0, brk = 0;
    const err = vt - speed;
    if (err > 0) thr = Math.min(1, 0.35 + err * 0.25);
    else if (err < -1.5) brk = Math.min(1, -err * 0.12);
    else thr = 0.25;
    // occasional small mistakes for lower skill
    this.mistakeT -= dt;
    if (this.mistakeT < 0) this.mistakeT = 4 + Math.random() * 10;
    if (this.mistakeT < 0.4 && this.skill < 0.97) steer += (Math.random() - 0.5) * 0.4 * (1 - this.skill) * 10;
    // ---------- stuck recovery: judged on displacement, not speed ----------
    this.histT = (this.histT || 0) + dt;
    if (!this.hist) this.hist = [];
    if (this.histT > 0.25) { this.histT = 0; this.hist.push(p.clone()); if (this.hist.length > 7) this.hist.shift(); }
    const moved = this.hist.length >= 7 ? this.hist[0].distanceTo(p) : 99;
    if (this.reverseT <= 0 && thr > 0.3 && moved < 1.2) { this.reverseT = Math.abs(ang) > 0.9 ? 2.0 : 1.2; this.revStart = 0; this.hist.length = 0; }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      this.revStart += dt;
      // blocked while reversing too: give up and drive out forwards
      if (this.revStart > 0.8 && Math.abs(v.vLocal.z) < 0.4) { this.reverseT = 0; this.hist.length = 0; }
      inp.throttle = 0; inp.brake = 1; inp.steer = Math.max(-1, Math.min(1, -steer)); inp.handbrake = 0;
      return;
    }
    inp.steer = Math.max(-1, Math.min(1, steer));
    inp.throttle = thr; inp.brake = brk; inp.handbrake = 0;
    inp.boost = 0;
  }
}
