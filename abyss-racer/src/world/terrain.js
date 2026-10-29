// Seabed heightfield shaped around the track: embankments under the road, dunes and ripples in open
// sand, a canyon under the jump, cliff walls along the trench.
import { TRACK } from './trackdef.js';
import { ZONE_IDS } from './track.js';

// --- small deterministic noise ---
function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * (vnoise(x * f, z * f) * 2 - 1); f *= 2.03; a *= 0.5; }
  return s;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Terrain {
  constructor(track, opts = {}) {
    this.track = track;
    const step = this.step = opts.step ?? 4;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < track.N; k++) {
      minX = Math.min(minX, track.pos[k * 3]); maxX = Math.max(maxX, track.pos[k * 3]);
      minZ = Math.min(minZ, track.pos[k * 3 + 2]); maxZ = Math.max(maxZ, track.pos[k * 3 + 2]);
    }
    const margin = opts.margin ?? 220;
    this.x0 = Math.floor((minX - margin) / step) * step;
    this.z0 = Math.floor((minZ - margin) / step) * step;
    this.nx = Math.ceil((maxX + margin - this.x0) / step) + 1;
    this.nz = Math.ceil((maxZ + margin - this.z0) / step) + 1;
    this.heights = new Float32Array(this.nx * this.nz);
    this.nearK = new Int32Array(this.nx * this.nz).fill(-1);
    this.nearD = new Float32Array(this.nx * this.nz).fill(1e9);
    this.nearLat = new Float32Array(this.nx * this.nz);
    this.compute();
  }

  idx(i, j) { return j * this.nx + i; }

  compute() {
    const t = this.track, step = this.step, nx = this.nx, nz = this.nz;
    // 1) splat each track sample into the grid: nearest sample + signed lateral distance
    const R = 70;
    const r = Math.ceil(R / step);
    for (let k = 0; k < t.N; k++) {
      const px = t.pos[k * 3], pz = t.pos[k * 3 + 2];
      const ci = Math.round((px - this.x0) / step), cj = Math.round((pz - this.z0) / step);
      const rx = t.right[k * 3], rz = t.right[k * 3 + 2];
      const rl = Math.hypot(rx, rz) || 1;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= nz) continue;
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || i >= nx) continue;
          const x = this.x0 + i * step, z = this.z0 + j * step;
          const dx = x - px, dz = z - pz;
          const d = Math.sqrt(dx * dx + dz * dz);
          const id = j * nx + i;
          if (d < this.nearD[id]) {
            this.nearD[id] = d; this.nearK[id] = k;
            this.nearLat[id] = (dx * rx + dz * rz) / rl;
          }
        }
      }
    }
    // 2) coarse far-field baseline: inverse distance weighted track depth
    const cs = 24, cnx = Math.ceil(nx * step / cs) + 2, cnz = Math.ceil(nz * step / cs) + 2;
    const base = new Float32Array(cnx * cnz), baseK = new Int32Array(cnx * cnz);
    for (let j = 0; j < cnz; j++) for (let i = 0; i < cnx; i++) {
      const x = this.x0 + i * cs, z = this.z0 + j * cs;
      let sw = 0, sy = 0, bd = Infinity, bk = 0;
      for (let k = 0; k < t.N; k += 6) {
        const dx = x - t.pos[k * 3], dz = z - t.pos[k * 3 + 2];
        const d2 = dx * dx + dz * dz + 400;
        const w = 1 / (d2 * d2);
        sw += w; sy += w * t.pos[k * 3 + 1];
        if (d2 < bd) { bd = d2; bk = k; }
      }
      base[j * cnx + i] = sy / sw;
      baseK[j * cnx + i] = bk;
    }
    const baseAt = (x, z) => {
      const fx = (x - this.x0) / cs, fz = (z - this.z0) / cs;
      const i = Math.min(cnx - 2, Math.max(0, Math.floor(fx))), j = Math.min(cnz - 2, Math.max(0, Math.floor(fz)));
      const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
      const a = base[j * cnx + i], b = base[j * cnx + i + 1], c = base[(j + 1) * cnx + i], d = base[(j + 1) * cnx + i + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const hw = TRACK.halfWidth, sh = TRACK.shoulder;
    const edge = hw + sh;
    const jumpK = Math.round(t.jumpS / t.ds);
    const gapMid = jumpK + Math.round(t.jumpGap / t.ds / 2);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      const x = this.x0 + i * step, z = this.z0 + j * step;
      let k = this.nearK[id];
      const d = this.nearD[id];
      if (k < 0) {
        const ci = Math.min(cnx - 1, Math.max(0, Math.round((x - this.x0) / cs))), cj = Math.min(cnz - 1, Math.max(0, Math.round((z - this.z0) / cs)));
        k = baseK[cj * cnx + ci];
        this.nearK[id] = -1 - k;   // remember the far sample (negative)
      }
      const zone = ZONE_IDS[t.zone[k]];
      const b = baseAt(x, z);
      // natural seabed
      let far = b - 2.5;
      const dunes = fbm(x * 0.012, z * 0.012, 4) * 6 + fbm(x * 0.05 + 7, z * 0.05, 2) * 1.2;
      const ripple = Math.sin((x * 0.6 + z * 0.8) * 0.35 + fbm(x * 0.02, z * 0.02, 2) * 6) * 0.18;
      far += dunes + ripple;
      // far away the seabed falls off into the deep, framing the circuit
      far -= sm(80, 260, d) * 18 * (0.6 + 0.4 * vnoise(x * 0.01, z * 0.01));
      if (zone === 'trench') {
        const wall = sm(edge + 4, edge + 30, d) * (24 + fbm(x * 0.03, z * 0.03, 3) * 10);
        far += wall + fbm(x * 0.09, z * 0.09, 3) * 3 * sm(edge + 4, edge + 20, d);
      } else if (zone === 'reef') {
        far += fbm(x * 0.08, z * 0.08, 3) * 2.5 + sm(edge + 10, edge + 60, d) * 8;
      } else if (zone === 'city') {
        far = b - 1.2 + fbm(x * 0.02, z * 0.02, 2) * 1.5;
      } else if (zone === 'canyon' || zone === 'kelp') {
        far += sm(edge + 20, edge + 80, d) * 6;
      }
      // canyon across the jump
      const dk = Math.abs(t.wrap(k - gapMid + t.N / 2) - t.N / 2) * t.ds;
      const canyonHalf = t.jumpGap / 2 + 6 + fbm(x * 0.05, z * 0.05, 2) * 6;
      const inCanyon = 1 - sm(canyonHalf - 4, canyonHalf + 14, dk);
      // near-road embankment (just under the road skirt)
      const lat = this.nearLat[id];
      const roadY = t.pos[k * 3 + 1] + t.right[k * 3 + 1] * Math.max(-edge, Math.min(edge, lat));
      const near = roadY - 0.9 - sm(edge, edge + 6, d) * 0.6;
      const w = this.nearK[id] < 0 ? 1 : sm(edge + 1.0, edge + 16, d);
      let h = near + (far - near) * w;
      if (inCanyon > 0) h = h + (Math.min(h, b - 42 + fbm(x * 0.06, z * 0.06, 3) * 6) - h) * inCanyon;
      this.heights[id] = h;
    }
  }

  heightAt(x, z) {
    const fx = (x - this.x0) / this.step, fz = (z - this.z0) / this.step;
    const i = Math.min(this.nx - 2, Math.max(0, Math.floor(fx))), j = Math.min(this.nz - 2, Math.max(0, Math.floor(fz)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const H = this.heights, nx = this.nx;
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    // match the triangulation used by the mesh (diagonal from (i,j) to (i+1,j+1))
    if (u >= v) return a + (b - a) * u + (d - b) * v;
    return a + (d - c) * u + (c - a) * v;
  }

  normalAt(x, z, out) {
    const e = this.step * 0.5;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    out.set(-hx, 2 * e, -hz).normalize();
    return out;
  }

  /** Track sample nearest to a grid point (always >= 0). */
  sampleAt(x, z) {
    const i = Math.min(this.nx - 1, Math.max(0, Math.round((x - this.x0) / this.step)));
    const j = Math.min(this.nz - 1, Math.max(0, Math.round((z - this.z0) / this.step)));
    const k = this.nearK[j * this.nx + i];
    return { k: k < 0 ? -1 - k : k, d: k < 0 ? 999 : this.nearD[j * this.nx + i], lat: this.nearLat[j * this.nx + i] };
  }
}
