// Track spline, per-metre frames (banked), zones, nearest-point queries, racing line + speed profile.
import * as THREE from 'three';
import { TRACK_POINTS, ZONES, TRACK } from './trackdef.js';

export const ZONE_IDS = ['city', 'reef', 'kelp', 'canyon', 'wreck', 'trench', 'climb'];

const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Track {
  constructor() {
    const pts = TRACK_POINTS.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    const nCtrl = pts.length;
    const div = nCtrl * 60;
    const lengths = this.curve.getLengths(div);
    this.length = lengths[div];
    const s0 = TRACK.startOffset || 0;
    const ctrlS = (idx) => {
      const f = ((idx % nCtrl) + nCtrl) % nCtrl;
      const i0 = Math.floor(f * 60), fr = f * 60 - i0;
      const s = lengths[i0] + (lengths[Math.min(div, i0 + 1)] - lengths[i0]) * fr - s0;
      return ((s % this.length) + this.length) % this.length;
    };
    this.ctrlS = ctrlS;
    const N = this.N = Math.round(this.length);   // ~1 m spacing
    this.ds = this.length / N;
    const A = (n = 1) => new Float32Array(N * n);
    this.pos = A(3); this.tan = A(3); this.up = A(3); this.right = A(3);
    this.curv = A(); this.bank = A(); this.zone = new Uint8Array(N); this.gap = new Uint8Array(N);
    this.halfWidth = A();
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    const heading = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const u = ((k * this.ds + s0) / this.length) % 1;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      p.toArray(this.pos, k * 3);
      t.toArray(this.tan, k * 3);
      heading[k] = Math.atan2(t.x, t.z);
    }
    // jump: kicker before the lip, gap after
    const sJ = ctrlS(TRACK.jump.at);
    this.jumpS = sJ; this.jumpGap = TRACK.jump.gap;
    for (let k = 0; k < N; k++) {
      const s = k * this.ds;
      let d = s - sJ;
      if (d < -this.length / 2) d += this.length;
      if (d > -55 && d <= 0) this.pos[k * 3 + 1] += 1.8 * Math.pow(smooth01(-55, 0, d), 1.6);
      if (d > 0 && d < TRACK.jump.gap) this.gap[k] = 1;
    }
    // recompute tangents after the kicker edit
    for (let k = 0; k < N; k++) {
      const a = (k - 1 + N) % N, b = (k + 1) % N;
      t.set(this.pos[b * 3] - this.pos[a * 3], this.pos[b * 3 + 1] - this.pos[a * 3 + 1], this.pos[b * 3 + 2] - this.pos[a * 3 + 2]).normalize();
      t.toArray(this.tan, k * 3);
    }
    // signed horizontal curvature (1/m), smoothed
    const raw = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      let dh = heading[(k + 1) % N] - heading[(k - 1 + N) % N];
      if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
      raw[k] = dh / (2 * this.ds);
    }
    const W = 12;
    for (let k = 0; k < N; k++) {
      let s = 0, w = 0;
      for (let j = -W; j <= W; j++) { const ww = 1 - Math.abs(j) / (W + 1); s += raw[(k + j + N) % N] * ww; w += ww; }
      this.curv[k] = s / w;
    }
    // frames with banking into the corners
    const up = new THREE.Vector3(), right = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
    for (let k = 0; k < N; k++) {
      t.fromArray(this.tan, k * 3);
      up.copy(Y).addScaledVector(t, -t.dot(Y)).normalize();
      right.crossVectors(t, up).normalize();
      // positive curvature = heading increasing = turning left (towards +x rotated). Bank so the outside is higher.
      const bank = Math.max(-0.15, Math.min(0.15, this.curv[k] * 9.0));
      this.bank[k] = bank;
      q.setFromAxisAngle(t, -bank);
      up.applyQuaternion(q); right.applyQuaternion(q);
      up.toArray(this.up, k * 3); right.toArray(this.right, k * 3);
      this.halfWidth[k] = TRACK.halfWidth;
    }
    // zones
    for (const z of ZONES) {
      const a = ctrlS(z.from), b = ctrlS(z.to);
      const id = ZONE_IDS.indexOf(z.id);
      for (let k = 0; k < N; k++) {
        const s = k * this.ds;
        const inside = a <= b ? (s >= a && s < b) : (s >= a || s < b);
        if (inside) this.zone[k] = id;
      }
    }
    this.buildGrid();
    this.buildRacingLine();
  }

  P(k, out = new THREE.Vector3()) { k = ((k % this.N) + this.N) % this.N; return out.fromArray(this.pos, k * 3); }
  T(k, out = new THREE.Vector3()) { k = ((k % this.N) + this.N) % this.N; return out.fromArray(this.tan, k * 3); }
  U(k, out = new THREE.Vector3()) { k = ((k % this.N) + this.N) % this.N; return out.fromArray(this.up, k * 3); }
  R(k, out = new THREE.Vector3()) { k = ((k % this.N) + this.N) % this.N; return out.fromArray(this.right, k * 3); }
  wrap(k) { return ((k % this.N) + this.N) % this.N; }
  zoneAt(k) { return ZONE_IDS[this.zone[this.wrap(k)]]; }

  /** Point at sample k offset laterally (m) along the banked right vector. */
  lateralPoint(k, lat, out = new THREE.Vector3()) {
    k = this.wrap(Math.round(k));
    return out.set(
      this.pos[k * 3] + this.right[k * 3] * lat,
      this.pos[k * 3 + 1] + this.right[k * 3 + 1] * lat,
      this.pos[k * 3 + 2] + this.right[k * 3 + 2] * lat);
  }

  buildGrid() {
    this.cell = 24;
    this.grid = new Map();
    for (let k = 0; k < this.N; k++) {
      const key = this.key(this.pos[k * 3], this.pos[k * 3 + 2]);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(k);
    }
  }

  key(x, z) { return Math.floor(x / this.cell) * 100000 + Math.floor(z / this.cell); }

  /** Nearest sample index to (x, y, z). hint = previous index for O(1) tracking; returns -1 if far away. */
  nearest(x, y, z, hint = -1, radius = 2) {
    let best = -1, bd = Infinity;
    if (hint >= 0) {
      for (let j = -45; j <= 45; j++) {
        const k = this.wrap(hint + j);
        const dx = this.pos[k * 3] - x, dy = (this.pos[k * 3 + 1] - y) * 2, dz = this.pos[k * 3 + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = k; }
      }
      if (bd < 30 * 30) return best;
    }
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = -radius; i <= radius; i++) for (let j = -radius; j <= radius; j++) {
      const list = this.grid.get((cx + i) * 100000 + (cz + j));
      if (!list) continue;
      for (const k of list) {
        const dx = this.pos[k * 3] - x, dy = (this.pos[k * 3 + 1] - y) * 2, dz = this.pos[k * 3 + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = k; }
      }
    }
    return best;
  }

  /** Horizontal distance from the centreline at (x, z) and the sample it belongs to (for terrain shaping). */
  nearest2D(x, z, maxR = 3) {
    let best = -1, bd = Infinity;
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let i = -maxR; i <= maxR; i++) for (let j = -maxR; j <= maxR; j++) {
      const list = this.grid.get((cx + i) * 100000 + (cz + j));
      if (!list) continue;
      for (const k of list) {
        const dx = this.pos[k * 3] - x, dz = this.pos[k * 3 + 2] - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = k; }
      }
    }
    return { k: best, d: Math.sqrt(bd) };
  }

  /** Local frame coordinates of a world point relative to sample k: {lat, h, along}. */
  local(k, x, y, z) {
    const i = k * 3;
    const dx = x - this.pos[i], dy = y - this.pos[i + 1], dz = z - this.pos[i + 2];
    return {
      lat: dx * this.right[i] + dy * this.right[i + 1] + dz * this.right[i + 2],
      h: dx * this.up[i] + dy * this.up[i + 1] + dz * this.up[i + 2],
      along: dx * this.tan[i] + dy * this.tan[i + 1] + dz * this.tan[i + 2],
    };
  }

  /** Elastic-band minimum-curvature line + physics-based speed profile for the AI. */
  buildRacingLine() {
    const N = this.N;
    const line = new Float32Array(N);
    const lim = (k) => this.halfWidth[k] - 2.2;
    // horizontal positions of the line, relaxed iteratively
    const px = new Float32Array(N), pz = new Float32Array(N);
    for (let it = 0; it < 600; it++) {
      for (let k = 0; k < N; k++) {
        const i = k * 3;
        px[k] = this.pos[i] + this.right[i] * line[k];
        pz[k] = this.pos[i + 2] + this.right[i + 2] * line[k];
      }
      for (let k = 0; k < N; k++) {
        const a = (k - 6 + N) % N, b = (k + 6) % N;
        const mx = (px[a] + px[b]) * 0.5, mz = (pz[a] + pz[b]) * 0.5;
        const i = k * 3;
        const rl = Math.hypot(this.right[i], this.right[i + 2]) || 1;
        const delta = ((mx - px[k]) * this.right[i] + (mz - pz[k]) * this.right[i + 2]) / rl;
        line[k] = Math.max(-lim(k), Math.min(lim(k), line[k] + delta * 0.5));
      }
    }
    // curvature of the line
    const kap = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const a = (k - 8 + N) % N, b = (k + 8) % N;
      const ax = px[k] - px[a], az = pz[k] - pz[a], bx = px[b] - px[k], bz = pz[b] - pz[k];
      const h1 = Math.atan2(ax, az), h2 = Math.atan2(bx, bz);
      let dh = h2 - h1; if (dh > Math.PI) dh -= Math.PI * 2; if (dh < -Math.PI) dh += Math.PI * 2;
      kap[k] = Math.abs(dh) / (Math.hypot(ax, az) * 0.5 + Math.hypot(bx, bz) * 0.5 + 1e-3);
    }
    const speed = new Float32Array(N);
    const vmax = 86;
    for (let k = 0; k < N; k++) {
      // lateral grip with aero: v^2 * kap = mu * (g + c v^2)  ->  v^2 = mu g / (kap - mu c)
      const mu = 1.45, g = 9.0, c = 0.0085;
      const den = kap[k] - mu * c;
      let v = den <= 0 ? vmax : Math.sqrt(mu * g / den);
      // crests: limit before sharp vertical convexity to avoid unloading mid-corner
      speed[k] = Math.min(vmax, v);
    }
    // jump needs speed
    const jk = Math.round(this.jumpS / this.ds);
    for (let j = -120; j < 0; j++) speed[this.wrap(jk + j)] = Math.max(speed[this.wrap(jk + j)], 44);
    // braking (backwards) and acceleration (forwards) passes
    const brake = 10.5, accel = 7.0;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = N - 1; k >= 0; k--) {
        const nx = speed[(k + 1) % N];
        const decel = Math.max(4, brake + 9.81 * this.tan[k * 3 + 1]);   // downhill eats braking
        speed[k] = Math.min(speed[k], Math.sqrt(nx * nx + 2 * decel * this.ds));
      }
      for (let k = 0; k < N; k++) {
        const pv = speed[(k - 1 + N) % N];
        speed[k] = Math.min(speed[k], Math.sqrt(pv * pv + 2 * accel * this.ds));
      }
    }
    this.line = line;
    this.lineSpeed = speed;
  }
}
