// Procedural reef life: staghorn and brain corals, table corals, sea fans, tube sponges, anemones,
// kelp, tube worms and vent chimneys. All geometry is generated here; soft species sway in the current.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);
import { patchMaterial } from '../render/underwater.js';
import { vnoise } from './terrain.js';

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const setSeed = (s) => { seed = s; };
export const rand = rnd;

function colorize(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const col = fn(p.getX(i), p.getY(i), p.getZ(i)); c.set(col, i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** Sway shader: displaces vertices with height (y in local space), phase from instance position. */
function swayMaterial(params, { amp = 0.12, freq = 1.3, key = 'sway', glow = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.75, metalness: 0 }, params));
  patchMaterial(m, {
    key: key,
    onCompile: (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float h = max(position.y, 0.0);
          float ph = uTime * ${freq.toFixed(3)} + ip.x * 0.13 + ip.z * 0.09;
          transformed.x += sin(ph) * h * h * ${amp.toFixed(4)};
          transformed.z += cos(ph * 0.83 + 1.7) * h * h * ${(amp * 0.7).toFixed(4)};
        }`);
      if (glow > 0) {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(3)} * smoothstep(0.6, 1.0, vColor.g);`);
      }
    },
  });
  return m;
}

// ---------- corals ----------

export function staghornGeometry(variant) {
  setSeed(101 + variant * 17);
  const parts = [];
  const branch = (base, dir, len, rad, depth) => {
    const seg = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1, true);
    seg.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    seg.applyQuaternion(q);
    seg.translate(base.x, base.y, base.z);
    parts.push(seg);
    const tip = base.clone().addScaledVector(dir, len);
    if (depth <= 0 || rad < 0.025) {
      const cap = new THREE.SphereGeometry(rad * 0.75, 5, 3);
      cap.translate(tip.x, tip.y, tip.z);
      parts.push(cap);
      return;
    }
    const n = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.4, rnd() - 0.5).multiplyScalar(1.3)).normalize();
      branch(tip, d, len * (0.65 + rnd() * 0.25), rad * 0.72, depth - 1);
    }
  };
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, 1.2, rnd() - 0.5).normalize();
    branch(new THREE.Vector3((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3), d, 0.45, 0.07, 3);
  }
  const g = mergeGeometries(parts.map((p) => ni(p)));
  return colorize(g, (x, y) => { const t = Math.min(1, y / 1.4); return [0.35 + t * 0.65, 0.35 + t * 0.65, 0.35 + t * 0.65]; });
}

export function brainCoralGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const maze = Math.abs(Math.sin((vnoise(n.x * 4 + 10, n.z * 4 + n.y * 3) * 2 + n.y) * 9.0));
    const r = 1 + maze * 0.06;
    v.copy(n).multiplyScalar(r);
    if (v.y < 0) v.y *= 0.25;
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return colorize(g, (x, y) => { const t = 0.6 + Math.max(0, y) * 0.5; return [t, t, t]; });
}

export function tableCoralGeometry() {
  const pts = [];
  pts.push(new THREE.Vector2(0.12, 0));
  pts.push(new THREE.Vector2(0.09, 0.5));
  pts.push(new THREE.Vector2(0.25, 0.75));
  pts.push(new THREE.Vector2(1.1, 0.9));
  pts.push(new THREE.Vector2(1.6, 0.98));
  pts.push(new THREE.Vector2(1.62, 1.03));
  pts.push(new THREE.Vector2(0.2, 1.0));
  pts.push(new THREE.Vector2(0.0, 1.0));
  const g = new THREE.LatheGeometry(pts, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const r = Math.hypot(x, z);
    const w = vnoise(Math.atan2(z, x) * 2 + 5, 1.3) * 0.35 * Math.min(1, r);
    p.setXYZ(i, x * (1 + w * 0.3), y + w * 0.12, z * (1 + w * 0.3));
  }
  g.computeVertexNormals();
  return colorize(g, (x, y) => { const t = 0.5 + Math.min(1, y) * 0.5; return [t, t, t]; });
}

export function tubeSpongeGeometry() {
  const parts = [];
  setSeed(77);
  for (let i = 0; i < 6; i++) {
    const h = 0.5 + rnd() * 1.1, r = 0.08 + rnd() * 0.07;
    const pts = [new THREE.Vector2(r * 0.8, 0), new THREE.Vector2(r, h * 0.5), new THREE.Vector2(r * 1.15, h), new THREE.Vector2(r * 0.85, h - 0.02), new THREE.Vector2(r * 0.7, h * 0.4)];
    const t = new THREE.LatheGeometry(pts, 10);
    t.rotateZ((rnd() - 0.5) * 0.4); t.rotateX((rnd() - 0.5) * 0.4);
    t.translate((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5);
    parts.push(ni(t));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return colorize(g, (x, y) => { const t = 0.55 + Math.min(1, y) * 0.45; return [t, t, t]; });
}

export function anemoneGeometry() {
  const parts = [];
  setSeed(31);
  const base = new THREE.CylinderGeometry(0.22, 0.3, 0.25, 12);
  base.translate(0, 0.12, 0);
  parts.push(ni(base));
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, rr = rnd() * 0.2;
    const len = 0.35 + rnd() * 0.3;
    const t = new THREE.ConeGeometry(0.03, len, 3, 2);
    t.translate(0, len / 2, 0);
    t.rotateZ(Math.cos(a) * (0.3 + rr * 2)); t.rotateX(Math.sin(a) * (0.3 + rr * 2));
    t.translate(Math.cos(a) * rr, 0.22, Math.sin(a) * rr);
    parts.push(ni(t));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  // tips bright (green channel flags the glow)
  return colorize(g, (x, y) => { const t = Math.min(1, Math.max(0, (y - 0.25) / 0.45)); return [0.5 + t * 0.5, 0.3 + t * 0.7, 0.5 + t * 0.5]; });
}

export function seaFanGeometry() {
  // a lacy fan: thin ribbon lattice in a disc, double sided
  const parts = [];
  setSeed(55);
  const stem = new THREE.CylinderGeometry(0.03, 0.05, 0.4, 5);
  stem.translate(0, 0.2, 0);
  parts.push(ni(stem));
  const add = (a, b, w) => {
    const d = b.clone().sub(a), len = d.length();
    const s = new THREE.BoxGeometry(w, len, 0.012);
    s.translate(0, len / 2, 0);
    s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    s.translate(a.x, a.y, a.z);
    parts.push(ni(s));
  };
  const grow = (p, ang, len, w, depth) => {
    const q = new THREE.Vector3(p.x + Math.sin(ang) * len, p.y + Math.cos(ang) * len, 0);
    add(p, q, w);
    if (depth > 0) {
      grow(q, ang - 0.35 - rnd() * 0.2, len * 0.78, w * 0.8, depth - 1);
      grow(q, ang + 0.35 + rnd() * 0.2, len * 0.78, w * 0.8, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, 0.38, 0), 0, 0.4, 0.035, 4);
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return colorize(g, (x, y) => { const t = 0.55 + Math.min(1, y / 1.6) * 0.45; return [t, t, t]; });
}

// ---------- kelp ----------

export function kelpGeometry(height = 1) {
  // unit-height stalk (scaled per instance) with alternating blades; y in 0..1
  const parts = [];
  setSeed(9);
  const stalk = new THREE.CylinderGeometry(0.006, 0.012, 1, 4, 12, true);
  stalk.translate(0, 0.5, 0);
  parts.push(ni(stalk));
  for (let i = 0; i < 18; i++) {
    const y = 0.08 + (i / 18) * 0.9;
    const len = 0.11 + rnd() * 0.05, w = 0.022 + rnd() * 0.01;
    const blade = new THREE.PlaneGeometry(w, len, 1, 3);
    const bp = blade.attributes.position;
    for (let j = 0; j < bp.count; j++) {
      const by = bp.getY(j) / len + 0.5;
      bp.setX(j, bp.getX(j) * Math.sin(by * Math.PI) * 1.4);
      bp.setZ(j, Math.sin(by * 3.0) * 0.012);
    }
    blade.translate(0, len / 2, 0);
    blade.rotateZ((i % 2 ? 1 : -1) * (0.6 + rnd() * 0.3));
    blade.rotateY(rnd() * Math.PI * 2);
    blade.translate(0, y, 0);
    parts.push(ni(blade));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return colorize(g, (x, y) => [0.55 + y * 0.45, 0.6 + y * 0.4, 0.4 + y * 0.3]);
}

export function kelpMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, color: 0x9a8a3a, emissive: 0x1a2a08 });
  patchMaterial(m, {
    key: 'kelp',
    onCompile: (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          float sy = 1.0;
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
            sy = length(instanceMatrix[1].xyz);
          #endif
          float h = position.y;
          float ph = uTime * 0.7 + ip.x * 0.05 + ip.z * 0.04;
          float bend = h * h * (0.10 + 0.04 * sin(ph * 0.5));
          transformed.x += (sin(ph + h * 2.5) * 0.6 + 0.6) * bend;
          transformed.z += cos(ph * 0.8 + h * 2.0) * bend * 0.6;
        }`);
      // translucency: light coming through blades from above
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.25, 0.32, 0.1) * clamp(vUwWorld.y * 0.0 + 1.0, 0.0, 1.0);');
    },
  });
  return m;
}

// ---------- trench ----------

export function tubeWormGeometry() {
  const parts = [];
  setSeed(5);
  for (let i = 0; i < 14; i++) {
    const h = 0.6 + rnd() * 1.4;
    const tube = new THREE.CylinderGeometry(0.035, 0.05, h, 6, 1, true);
    tube.translate(0, h / 2, 0);
    const plume = new THREE.ConeGeometry(0.07, 0.16, 6);
    plume.rotateX(Math.PI);
    plume.translate(0, h + 0.05, 0);
    const a = rnd() * Math.PI * 2, r = rnd() * 0.35;
    for (const g of [tube, plume]) { g.rotateZ((rnd() - 0.5) * 0.25); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); }
    parts.push(colorize(ni(tube), () => [0.85, 0.82, 0.75]));
    parts.push(colorize(ni(plume), () => [0.9, 0.08, 0.06]));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

export function ventGeometry() {
  // stacked, irregular mineral chimney
  const pts = [];
  setSeed(13);
  const H = 6;
  for (let i = 0; i <= 14; i++) {
    const y = (i / 14) * H;
    const r = (1.25 - (i / 14) * 0.85) * (0.85 + rnd() * 0.35);
    pts.push(new THREE.Vector2(r, y));
  }
  pts.push(new THREE.Vector2(0.22, H));
  pts.push(new THREE.Vector2(0.15, H - 0.4));
  const g = new THREE.LatheGeometry(pts, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise(Math.atan2(z, x) * 3 + 3, y * 1.4) - 0.5;
    p.setXYZ(i, x * (1 + n * 0.5), y, z * (1 + n * 0.5));
  }
  g.computeVertexNormals();
  return colorize(g, (x, y) => { const hot = Math.max(0, (y - H * 0.8) / (H * 0.2)); return [0.18 + hot * 0.4, 0.16 + hot * 0.1, 0.15]; });
}

export function ventMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, color: 0xffffff });
  patchMaterial(m, {
    key: 'vent',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float hot = smoothstep(0.25, 0.5, vColor.r - vColor.b);
        float flick = 0.7 + 0.3 * sin(uTime * 3.0 + vUwWorld.x);
        totalEmissiveRadiance += vec3(3.0, 0.9, 0.2) * hot * flick;`);
    },
  });
  return m;
}

export const materials = {
  coral: (opts) => swayMaterial({ roughness: 0.8 }, Object.assign({ amp: 0.0, key: 'coral' }, opts)),
  soft: (opts) => swayMaterial({ roughness: 0.7, side: THREE.DoubleSide }, Object.assign({ amp: 0.05, key: 'softcoral' }, opts)),
  anemone: () => swayMaterial({ roughness: 0.5 }, { amp: 0.4, freq: 1.8, key: 'anemone', glow: 0.8 }),
  worm: () => swayMaterial({ roughness: 0.6 }, { amp: 0.02, freq: 1.0, key: 'worm' }),
};
