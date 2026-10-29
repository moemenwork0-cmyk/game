// Sunken city architecture: fluted columns (whole, broken, fallen), monumental arches spanning the
// track, stepped temples, ruined walls and glowing glyph lanterns.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);
import { patchMaterial } from '../render/underwater.js';
import { vnoise } from './terrain.js';

export function stoneMaterial(tex, tint = 0xffffff, scale = 2.5) {
  const m = new THREE.MeshStandardMaterial({ color: tint, roughness: 1, metalness: 0 });
  patchMaterial(m, {
    key: 'stone' + scale, uniforms: { tStone: { value: tex.map }, tStoneN: { value: tex.normalMap } },
    fragDecl: 'uniform sampler2D tStone, tStoneN;\n',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec3 swp = vUwWorld / ${scale.toFixed(2)};
          vec3 sN = normalize(inverseTransformDirection(vNormal, viewMatrix));
          vec3 sb = pow(abs(sN), vec3(4.0)); sb /= sb.x + sb.y + sb.z;
          vec3 st = texture2D(tStone, swp.zy).rgb * sb.x + texture2D(tStone, swp.xz).rgb * sb.y + texture2D(tStone, swp.xy).rgb * sb.z;
          // algae and silt settle on upward faces
          float up = smoothstep(0.35, 0.9, sN.y);
          vec3 algae = vec3(0.32, 0.42, 0.26);
          st = mix(st, st * algae * 1.6, up * 0.65);
          diffuseColor.rgb *= st;`)
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 n1 = texture2D(tStoneN, swp.zy).xyz * 2.0 - 1.0;
            vec3 n2 = texture2D(tStoneN, swp.xz).xyz * 2.0 - 1.0;
            vec3 n3 = texture2D(tStoneN, swp.xy).xyz * 2.0 - 1.0;
            vec3 pert = vec3(0.0, n1.y, n1.x) * sb.x + vec3(n2.x, 0.0, n2.y) * sb.y + vec3(n3.x, n3.y, 0.0) * sb.z;
            normal = normalize((viewMatrix * vec4(normalize(sN + pert * 0.9), 0.0)).xyz);
          }`);
    },
  });
  return m;
}

function jag(geo, amt, freq = 1.3, onlyAbove = -1e9) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < onlyAbove) continue;
    const n = vnoise(x * freq + 3.1, z * freq + y * 0.7) - 0.5;
    p.setXYZ(i, x + n * amt, y + (vnoise(z * freq, x * freq + 9) - 0.5) * amt, z + n * amt * 0.7);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Fluted column with base and capital; height h, radius r; broken = jagged top cut. */
export function columnGeometry(h = 10, r = 0.85, broken = false) {
  const parts = [];
  const base = new THREE.CylinderGeometry(r * 1.35, r * 1.45, 0.7, 16);
  base.translate(0, 0.35, 0);
  parts.push(ni(base));
  const shaftH = broken ? h * 0.55 : h;
  const shaft = new THREE.CylinderGeometry(r * 0.9, r, shaftH, 24, 8, false);
  const sp = shaft.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), z = sp.getZ(i), a = Math.atan2(z, x);
    const fl = 1 - 0.06 * Math.pow(Math.abs(Math.cos(a * 10)), 0.5);
    sp.setXYZ(i, x * fl, sp.getY(i), z * fl);
  }
  shaft.translate(0, 0.7 + shaftH / 2, 0);
  if (broken) jag(shaft, 0.5, 1.6, 0.7 + shaftH * 0.8);
  shaft.computeVertexNormals();
  parts.push(ni(shaft));
  if (!broken) {
    const cap = new THREE.CylinderGeometry(r * 1.4, r * 0.95, 0.8, 16);
    cap.translate(0, 0.7 + shaftH + 0.4, 0);
    const abacus = new THREE.BoxGeometry(r * 3, 0.45, r * 3);
    abacus.translate(0, 0.7 + shaftH + 1.0, 0);
    parts.push(ni(cap), ni(abacus));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Monumental arch spanning `span` metres (piers outside the barriers), height h. */
export function archGeometry(span = 34, h = 15, depth = 3.2) {
  const parts = [];
  const pierW = 3.4;
  for (const s of [-1, 1]) {
    const pier = new THREE.BoxGeometry(pierW, h, depth, 2, 8, 2);
    pier.translate(s * (span / 2 + pierW / 2), h / 2, 0);
    parts.push(ni(jag(pier, 0.25, 0.9)));
  }
  // semicircular vault from extruded shape
  const R = span / 2 + pierW, r = span / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-R, 0); shape.absarc(0, 0, R, Math.PI, 0, true); shape.lineTo(r, 0); shape.absarc(0, 0, r, 0, Math.PI, false); shape.lineTo(-R, 0);
  const vault = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 });
  vault.scale(1, 0.42, 1);
  vault.translate(0, h, -depth / 2);
  parts.push(ni(jag(vault, 0.25, 0.8)));
  // keystone block
  const ks = new THREE.BoxGeometry(2.4, 3.2, depth + 0.6);
  ks.translate(0, h + r * 0.42 + 0.6, 0);
  parts.push(ni(ks));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Stepped temple / ziggurat silhouette. */
export function templeGeometry(w = 40, levels = 5) {
  const parts = [];
  let y = 0, cw = w;
  for (let i = 0; i < levels; i++) {
    const hh = 4 + (i === levels - 1 ? 3 : 0);
    const b = new THREE.BoxGeometry(cw, hh, cw * 0.8, 3, 2, 3);
    b.translate(0, y + hh / 2, 0);
    parts.push(ni(jag(b, 0.6, 0.35)));
    y += hh; cw *= 0.75;
  }
  // stairway
  const st = new THREE.BoxGeometry(w * 0.16, y * 0.9, w * 0.5);
  st.rotateX(0.75);
  st.translate(0, y * 0.35, w * 0.45);
  parts.push(ni(st));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

export function wallGeometry(len = 16, h = 6) {
  const g = new THREE.BoxGeometry(len, h, 1.4, 12, 6, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const top = h / 2 - (vnoise(x * 0.35 + 2, 1) * h * 0.7);
    if (y > top) p.setY(i, top);
  }
  g.translate(0, h / 2, 0);
  return jag(g, 0.18, 1.2);
}

/** Lantern: stone post + glowing crystal orb (emissive, blooms). */
export function lanternGeometries() {
  const post = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8);
  post.translate(0, 1.6, 0);
  const cage = new THREE.CylinderGeometry(0.45, 0.35, 0.25, 8);
  cage.translate(0, 3.3, 0);
  const orb = new THREE.IcosahedronGeometry(0.42, 2);
  orb.translate(0, 3.85, 0);
  return { stone: mergeGeometries([ni(post), ni(cage)]), orb };
}

export function glowMaterial(color, intensity = 4) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  patchMaterial(m, { key: 'glowbasic', caustics: false });
  return m;
}
