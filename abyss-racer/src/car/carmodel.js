// Visual car: sculpted SDF body (deformable), shader-driven paint / glass / lights / livery / damage,
// procedurally modelled wheels (tyre, multi-spoke rim, brake disc, caliper) and detachable aero parts.
import * as THREE from 'three';
import { patchMaterial } from '../render/underwater.js';

const lerpTable = (zs, vs, z) => {
  if (z <= zs[0]) return vs[0];
  for (let i = 1; i < zs.length; i++) {
    if (z <= zs[i]) { const t = (z - zs[i - 1]) / (zs[i] - zs[i - 1]); return vs[i - 1] + (vs[i] - vs[i - 1]) * t; }
  }
  return vs[vs.length - 1];
};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Per-vertex material regions computed from the rest shape (so they stay put when the body crumples). */
function computeRegions(geo) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  geo.setAttribute('aRest', new THREE.BufferAttribute(new Float32Array(pos.array), 3));
  geo.setAttribute('aRestN', new THREE.BufferAttribute(new Float32Array(nrm.array), 3));
  geo.setAttribute('aDmg', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
}

const padTable = (arr, n) => { const a = arr.slice(0, n); while (a.length < n) a.push(arr[arr.length - 1] + 0.001 * (a.length - arr.length + 1)); return a; };

function numberTexture(num, ink = '#111', paper = '#f2f2f0') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = ink; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = paper; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink; g.font = 'bold 150px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(num), 128, 140);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const BODY_VERT_DECL = /* glsl */ `
attribute vec3 aRest; attribute vec3 aRestN; attribute float aDmg;
varying vec3 vRest; varying vec3 vRestN; varying float vDmg;
`;
const BODY_VERT_BODY = /* glsl */ `
vRest = aRest; vRestN = aRestN; vDmg = aDmg;
`;
const BODY_FRAG_DECL = /* glsl */ `
varying vec3 vRest; varying vec3 vRestN; varying float vDmg;
uniform float uTubZ[12]; uniform float uTubT[12]; uniform float uCabZ[8]; uniform float uCabT[8]; uniform float uCabW[8];
uniform vec3 uPaint; uniform vec3 uAccent; uniform vec3 uAccent2; uniform float uStripe; uniform sampler2D uNumTex;
uniform float uHead; uniform float uBrake; uniform float uRev; uniform vec4 uDoor; uniform float uHalfLen;
float cHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1, 0, 0)), f.x), mix(cHash(i + vec3(0, 1, 0)), cHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0, 0, 1)), cHash(i + vec3(1, 0, 1)), f.x), mix(cHash(i + vec3(0, 1, 1)), cHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float tbl12(float z, float zs[12], float vs[12]) {
  float r = vs[0];
  for (int i = 1; i < 12; i++) { if (z > zs[i - 1]) r = mix(vs[i - 1], vs[i], clamp((z - zs[i - 1]) / max(zs[i] - zs[i - 1], 1e-4), 0.0, 1.0)); }
  return r;
}
float tbl8(float z, float zs[8], float vs[8]) {
  float r = vs[0];
  for (int i = 1; i < 8; i++) { if (z > zs[i - 1]) r = mix(vs[i - 1], vs[i], clamp((z - zs[i - 1]) / max(zs[i] - zs[i - 1], 1e-4), 0.0, 1.0)); }
  return r;
}
float aaStep(float edge, float x) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(edge - w, edge + w, x); }
float lineMask(float d, float halfW) { float w = max(fwidth(d), 1e-4); return 1.0 - smoothstep(halfW - w, halfW + w, abs(d)); }
`;

// Runs after emissivemap_fragment: decides the material at this pixel.
const BODY_FRAG_MAT = /* glsl */ `
vec3 P = vRest; vec3 PN = normalize(vRestN);
float ax = abs(P.x);
float tubTop = tbl12(P.z, uTubZ, uTubT);
float roofY = tbl8(P.z, uCabZ, uCabT);
float cabW = tbl8(P.z, uCabZ, uCabW);
float inCab = aaStep(uCabZ[0] + 0.15, P.z) * (1.0 - aaStep(uCabZ[7] + 0.02, P.z)) * (1.0 - aaStep(cabW + 0.03, ax));
float above = aaStep(tubTop + 0.05, P.y);
float roofM = aaStep(0.62, PN.y) * aaStep(roofY - 0.11, P.y) * inCab * (1.0 - aaStep(cabW * 0.62, ax));
float wsM = aaStep(0.24, PN.z);
float sideM = aaStep(0.56, abs(PN.x)) * (1.0 - aaStep(roofY - 0.10, P.y));
float rearM = 1.0 - aaStep(-0.30, PN.z);
float zB = uCabZ[1] + (uCabZ[7] - uCabZ[1]) * 0.30;
float bPillar = 1.0 - aaStep(0.05, abs(P.z - zB)) * aaStep(0.5, abs(PN.x));
float glassM = inCab * above * max(max(wsM, sideM * bPillar), rearM) * (1.0 - roofM);
float carbonM = max(1.0 - aaStep(0.215, P.y), aaStep(0.5, -PN.y)) * (1.0 - glassM);
float front = aaStep(uHalfLen - 0.85, P.z) * aaStep(0.15, PN.z);
float headM = front * aaStep(0.40, ax) * (1.0 - aaStep(0.84, ax)) * aaStep(tubTop - 0.10 + (ax - 0.4) * 0.08, P.y) * (1.0 - aaStep(tubTop - 0.035, P.y));
float drl = front * aaStep(0.36, ax) * (1.0 - aaStep(0.86, ax)) * (1.0 - aaStep(0.006, abs(P.y - (tubTop - 0.115 + (ax - 0.4) * 0.08)))) ;
float rearZ = 1.0 - aaStep(-uHalfLen + 0.6, P.z);
float tailM = rearZ * (1.0 - aaStep(-0.2, PN.z)) * (1.0 - aaStep(0.88, ax)) * aaStep(tubTop - 0.15, P.y) * (1.0 - aaStep(tubTop - 0.105, P.y));
float grilleM = front * aaStep(0.35, PN.z) * (1.0 - aaStep(0.62, ax)) * aaStep(0.17, P.y) * (1.0 - aaStep(0.37, P.y));
grilleM = max(grilleM, rearZ * (1.0 - aaStep(-0.3, PN.z)) * (1.0 - aaStep(0.78, ax)) * aaStep(0.19, P.y) * (1.0 - aaStep(0.40, P.y)));
headM = max(headM, drl);
// livery
vec3 paint = uPaint;
float stripes = 0.0;
if (uStripe > 0.5) {
  float sx = abs(P.x);
  stripes = aaStep(0.07, sx) * (1.0 - aaStep(0.20, sx)) * smoothstep(0.15, 0.4, PN.y) * (1.0 - aaStep(0.24, sx) * 0.0);
  stripes *= 1.0 - aaStep(0.125, sx) * (1.0 - aaStep(0.145, sx));
}
float sideBand = smoothstep(0.35, 0.6, abs(PN.x)) * (1.0 - aaStep(0.33 + P.z * 0.045, P.y)) * aaStep(0.22, P.y);
paint = mix(paint, uAccent, max(stripes, sideBand * step(1.5, uStripe)));
paint = mix(paint, uAccent2, roofM * step(0.5, uStripe));
// door number roundel
vec2 nuv = vec2((P.z - uDoor.x) * sign(P.x), P.y - uDoor.y) / (uDoor.z * 2.0) + 0.5;
float side = smoothstep(0.55, 0.7, abs(PN.x));
if (side > 0.0 && nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) {
  vec4 nt = texture2D(uNumTex, nuv);
  float inCircle = 1.0 - aaStep(0.49, length(nuv - 0.5));
  paint = mix(paint, nt.rgb, inCircle * side * nt.a);
}
// panel seams: door cuts, door bottom, hood outline
float seam = 0.0;
seam += lineMask(P.z - uDoor.w, 0.004) * smoothstep(0.5, 0.7, abs(PN.x)) * step(0.25, P.y);
seam += lineMask(P.z - (uDoor.w - 1.15), 0.004) * smoothstep(0.5, 0.7, abs(PN.x)) * step(0.25, P.y);
float hoodZ = uHalfLen - 0.95;
seam += lineMask(P.z - hoodZ, 0.004) * smoothstep(0.6, 0.8, PN.y) * (1.0 - step(0.55, abs(P.x)));
seam += lineMask(abs(P.x) - 0.55, 0.004) * smoothstep(0.6, 0.8, PN.y) * step(hoodZ, P.z);
seam = clamp(seam, 0.0, 1.0) * (1.0 - glassM);

vec3 base = paint;
float rough = 0.32; float metal = 0.55; float cc = 1.0;
// metallic flake: tiny normal-free sparkle in the albedo, fades with distance via fwidth
float flake = cHash(floor(P * 900.0));
float flakeFade = 1.0 - smoothstep(0.0005, 0.003, fwidth(P.x));
base *= 1.0 + (flake - 0.5) * 0.35 * flakeFade;
// carbon fibre weave
vec2 cw = vec2(P.z + P.y, P.x + P.y) * 160.0;
float weave = (step(0.5, fract(cw.x)) == step(0.5, fract(cw.y))) ? 0.9 : 1.1;
vec3 carbon = vec3(0.028) * weave;
base = mix(base, carbon, carbonM); rough = mix(rough, 0.35, carbonM); metal = mix(metal, 0.2, carbonM); cc = mix(cc, 0.7, carbonM);
// grille / vents: dark honeycomb
vec2 hc = vec2(P.x, P.y) * 70.0;
float hex = smoothstep(0.35, 0.45, abs(fract(hc.x + step(1.0, mod(hc.y, 2.0)) * 0.5) - 0.5)) * smoothstep(0.2, 0.3, abs(fract(hc.y) - 0.5));
base = mix(base, vec3(0.01) + hex * 0.03, grilleM); rough = mix(rough, 0.6, grilleM); cc = mix(cc, 0.0, grilleM); metal = mix(metal, 0.5, grilleM);
// glass: deep tinted, mirror-smooth
base = mix(base, vec3(0.004, 0.006, 0.008), glassM); rough = mix(rough, 0.03, glassM); metal = mix(metal, 0.0, glassM); cc = mix(cc, 1.0, glassM);
// lights: clear lens over emitter
base = mix(base, vec3(0.6), headM); rough = mix(rough, 0.05, headM); metal = mix(metal, 0.9, headM);
base = mix(base, vec3(0.25, 0.01, 0.01), tailM); rough = mix(rough, 0.05, tailM);
// seams
base *= 1.0 - seam * 0.85;
// damage: scraped clearcoat -> primer -> bare metal, plus scorch
float dn = cNoise(P * 38.0) * 0.6 + cNoise(P * 110.0) * 0.4;
float scr = smoothstep(0.15, 0.6, vDmg + (dn - 0.5) * 0.5) * (1.0 - glassM);
float bare = smoothstep(0.45, 0.9, vDmg + (dn - 0.5) * 0.6) * (1.0 - glassM);
base = mix(base, vec3(0.45, 0.46, 0.47) * (0.8 + dn * 0.3), scr * (1.0 - carbonM));
base = mix(base, vec3(0.62, 0.62, 0.63) * (0.7 + dn * 0.4), bare * (1.0 - carbonM));
base *= 1.0 - smoothstep(0.7, 1.2, vDmg) * 0.75;
rough = mix(rough, 0.55, scr); cc *= 1.0 - scr; metal = mix(metal, 0.85, bare);
// cracked glass
if (glassM > 0.01 && vDmg > 0.25) {
  vec3 q = P * 14.0;
  float c1 = abs(cNoise(q) - 0.5) + abs(cNoise(q * 2.3) - 0.5) * 0.5;
  float crack = (1.0 - smoothstep(0.0, 0.03, c1)) * smoothstep(0.25, 0.6, vDmg);
  base = mix(base, vec3(0.7, 0.75, 0.8), crack * glassM); rough = mix(rough, 0.4, crack * glassM);
}
diffuseColor.rgb = base;
roughnessFactor = rough;
metalnessFactor = metal;
float headBroken = smoothstep(0.4, 0.7, vDmg);
totalEmissiveRadiance += vec3(3.2, 3.4, 3.8) * headM * uHead * (1.0 - headBroken);
totalEmissiveRadiance += vec3(3.0, 0.08, 0.04) * tailM * (0.35 + uBrake * 2.6) * (1.0 - headBroken);
totalEmissiveRadiance += vec3(2.5, 2.5, 2.5) * tailM * uRev * step(0.6, abs(P.x)) * (1.0 - step(0.75, abs(P.x)));
float uwCC = cc;
`;

export class CarVisual {
  /**
   * @param {object} spec  { id, meta (cars.json entry), geo (body BufferGeometry), envMap, livery:{paint, accent, accent2, stripe, number, rim, caliper} }
   */
  constructor(spec) {
    this.spec = spec;
    this.meta = spec.meta;
    this.group = new THREE.Group();
    this.group.name = 'car-' + spec.id;
    const L = spec.livery;
    const geo = spec.geo.clone();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    computeRegions(geo);
    this.bodyGeo = geo;
    this.uniforms = {
      uPaint: { value: new THREE.Color(L.paint) }, uAccent: { value: new THREE.Color(L.accent) },
      uAccent2: { value: new THREE.Color(L.accent2 ?? 0x080808) }, uStripe: { value: L.stripe ?? 1 },
      uNumTex: { value: numberTexture(L.number ?? 7) }, uHead: { value: 1 }, uBrake: { value: 0 }, uRev: { value: 0 },
      uDoor: { value: new THREE.Vector4(-0.05 + (this.meta.zoff || 0), 0.50, 0.22, 0.55 + (this.meta.zoff || 0)) },
      uHalfLen: { value: this.meta.length / 2 },
      uTubZ: { value: padTable(this.meta.tub.zs, 12) }, uTubT: { value: padTable(this.meta.tub.yt, 12) },
      uCabZ: { value: padTable(this.meta.cabin.zs, 8) }, uCabT: { value: padTable(this.meta.cabin.yt, 8) },
      uCabW: { value: padTable(this.meta.cabin.w, 8) },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.3, metalness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.04,
      envMap: spec.envMap, envMapIntensity: 1.25,
    });
    patchMaterial(mat, {
      vertDecl: BODY_VERT_DECL, vertBody: BODY_VERT_BODY, fragDecl: BODY_FRAG_DECL, key: 'carbody', caustics: true, causticMul: 0.45,
      uniforms: this.uniforms,
      onCompile: (sh) => {
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + BODY_FRAG_MAT)
          .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= uwCC;');
      },
    });
    this.bodyMat = mat;
    this.body = new THREE.Mesh(geo, mat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // shared detail materials
    this.carbonMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.3, clearcoat: 0.8, envMap: spec.envMap }), { key: 'carbon' });
    this.paintMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: L.paint, roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.04, envMap: spec.envMap, envMapIntensity: 1.25 }), { key: 'paint' });
    this.accentMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: L.accent, roughness: 0.3, metalness: 0.5, clearcoat: 1, envMap: spec.envMap }), { key: 'paint' });
    this.parts = {};
    this.buildAero();
    this.buildWheels();
    this.buildLights();
    this.setLights(1, 0);
  }

  buildAero() {
    const m = this.meta;
    const zr = -m.length / 2, zf = m.length / 2;
    const rearTop = lerpTable(m.tub.zs, m.tub.yt, zr + 0.35);
    // rear wing: cambered airfoil extruded across the car
    const foil = new THREE.Shape();
    const chord = 0.34, thick = 0.045;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, x = (1 - Math.cos(t * Math.PI)) / 2;
      const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      const camber = 0.06 * x * (1 - x) * 4 * 0.5;
      pts.push([x, camber + yt]);
    }
    foil.moveTo(0, 0);
    pts.forEach(([x, y]) => foil.lineTo(-x * chord, -y * chord * 1.2));
    for (let i = pts.length - 1; i >= 0; i--) { const [x, y] = pts[i]; const yt2 = 0.06 * x * (1 - x) * 2 - (y - 0.06 * x * (1 - x) * 2); foil.lineTo(-x * chord, -yt2 * chord * 0.5); }
    const span = m.width * 0.86;
    const wingGeo = new THREE.ExtrudeGeometry(foil, { depth: span, bevelEnabled: false, steps: 1 });
    wingGeo.translate(0, 0, -span / 2);
    wingGeo.rotateY(Math.PI / 2);
    wingGeo.rotateX(-0.12);
    const wing = new THREE.Group();
    const blade = new THREE.Mesh(wingGeo, this.carbonMat);
    blade.castShadow = true;
    wing.add(blade);
    const plateGeo = new THREE.BoxGeometry(0.014, 0.17, 0.36);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(plateGeo, this.carbonMat);
      p.position.set(s * span / 2, -0.03, -0.14);
      wing.add(p);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.30, 0.14), this.carbonMat);
      strut.position.set(s * span * 0.28, -0.17, -0.08);
      strut.rotation.x = 0.25;
      wing.add(strut);
    }
    wing.position.set(0, rearTop + 0.27, zr + 0.40);
    this.addPart('wing', wing, 18);
    // front splitter
    const sp = new THREE.Shape();
    const sw = m.width * 0.46, sd = 0.30;
    sp.moveTo(-sw, 0); sp.lineTo(sw, 0); sp.quadraticCurveTo(sw + 0.02, sd * 0.8, sw * 0.7, sd); sp.lineTo(-sw * 0.7, sd); sp.quadraticCurveTo(-sw - 0.02, sd * 0.8, -sw, 0);
    const splGeo = new THREE.ExtrudeGeometry(sp, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.006, bevelSegments: 1 });
    splGeo.rotateX(Math.PI / 2);
    const spl = new THREE.Mesh(splGeo, this.carbonMat);
    spl.position.set(0, 0.125, zf - 0.38);
    this.addPart('splitter', spl, 12);
    // rear diffuser with strakes
    const dif = new THREE.Group();
    const dbase = new THREE.Mesh(new THREE.BoxGeometry(m.width * 0.78, 0.02, 0.5), this.carbonMat);
    dbase.rotation.x = -0.2;
    dif.add(dbase);
    for (let i = -3; i <= 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.48), this.carbonMat);
      f.position.set(i * 0.2, 0.06, 0.0);
      f.rotation.x = -0.2;
      dif.add(f);
    }
    dif.position.set(0, 0.16, zr + 0.28);
    this.addPart('diffuser', dif, 10);
    // mirrors at the base of the A-pillars
    const cz = m.cabin.zs[m.cabin.zs.length - 2] - 0.15;
    const cw = lerpTable(m.cabin.zs, m.cabin.w, cz);
    const belt = lerpTable(m.tub.zs, m.tub.yt, cz) + 0.08;
    for (const s of [-1, 1]) {
      const mir = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), this.paintMat);
      head.scale.set(0.55, 0.5, 1.0);
      head.position.set(s * 0.1, 0.04, 0);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 1, roughness: 0.05, envMap: this.spec.envMap }));
      glass.position.set(s * 0.1, 0.04, -0.101);
      glass.rotation.y = Math.PI;
      glass.scale.set(1.15, 0.95, 1);
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.05), this.carbonMat);
      stalk.position.set(s * 0.04, 0.0, 0.02);
      mir.add(head, glass, stalk);
      mir.position.set(s * (cw + 0.07), belt, cz);
      this.addPart(s < 0 ? 'mirrorL' : 'mirrorR', mir, 2);
    }
    // exhaust tips
    const exMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x8a7a6a, metalness: 1, roughness: 0.3, envMap: this.spec.envMap }), { key: 'ex' });
    this.exhausts = [];
    for (const s of [-1, 1]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.16, 18, 1, true), exMat);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(s * 0.14, 0.33, zr + 0.02);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), new THREE.MeshBasicMaterial({ color: 0x050505 }));
      inner.position.set(s * 0.14, 0.33, zr + 0.05);
      inner.rotation.y = Math.PI;
      this.group.add(ex, inner);
      this.exhausts.push(new THREE.Vector3(s * 0.14, 0.33, zr - 0.05));
    }
  }

  addPart(name, obj, mass) {
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    obj.userData.mass = mass;
    obj.userData.attached = true;
    this.parts[name] = obj;
    this.group.add(obj);
  }

  buildWheels() {
    this.wheels = [];
    const env = this.spec.envMap;
    const L = this.spec.livery;
    const tireMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.82, metalness: 0.0 }), {
      key: 'tire',
      onCompile: (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float tread = smoothstep(0.38, 0.42, vUv2t.y) * (1.0 - smoothstep(0.58, 0.62, vUv2t.y));
          float g1 = step(0.45, abs(fract(vUv2t.x * 120.0) - 0.5) * 2.0);
          float sideLetter = (smoothstep(0.1, 0.12, vUv2t.y) * (1.0 - smoothstep(0.17, 0.19, vUv2t.y)) + smoothstep(0.81, 0.83, vUv2t.y) * (1.0 - smoothstep(0.88, 0.9, vUv2t.y))) * step(0.8, fract(vUv2t.x * 6.0));
          diffuseColor.rgb *= 1.0 - tread * g1 * 0.6;
          diffuseColor.rgb += sideLetter * 0.25;
          roughnessFactor = mix(roughnessFactor, 0.6, tread);`);
      },
      vertDecl: 'varying vec2 vUv2t;\n', vertBody: 'vUv2t = uv;\n', fragDecl: 'varying vec2 vUv2t;\n',
    });
    const rimMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: L.rim ?? 0x9aa0a8, metalness: 1, roughness: 0.22, clearcoat: 0.6, envMap: env, envMapIntensity: 1.4 }), { key: 'rim' });
    const discMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 1, roughness: 0.4, envMap: env, emissive: 0xff3300, emissiveIntensity: 0 }), { key: 'disc' });
    const caliperMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: L.caliper ?? 0xd01010, roughness: 0.3, clearcoat: 1, envMap: env }), { key: 'cal' });
    this.discMat = discMat;
    for (const w of this.meta.wheels) {
      const R = w.r, W = w.w, Rr = R * 0.66;
      // tyre profile (radius, axial) swept around x
      const prof = [];
      const hw = W / 2;
      prof.push(new THREE.Vector2(Rr - 0.01, -hw + 0.02));
      prof.push(new THREE.Vector2(Rr + 0.02, -hw));
      prof.push(new THREE.Vector2(R - 0.05, -hw - 0.006));
      prof.push(new THREE.Vector2(R - 0.02, -hw + 0.004));
      prof.push(new THREE.Vector2(R - 0.004, -hw + 0.025));
      prof.push(new THREE.Vector2(R, -hw + 0.05));
      prof.push(new THREE.Vector2(R, hw - 0.05));
      prof.push(new THREE.Vector2(R - 0.004, hw - 0.025));
      prof.push(new THREE.Vector2(R - 0.02, hw - 0.004));
      prof.push(new THREE.Vector2(R - 0.05, hw + 0.006));
      prof.push(new THREE.Vector2(Rr + 0.02, hw));
      prof.push(new THREE.Vector2(Rr - 0.01, hw - 0.02));
      const lathe = new THREE.LatheGeometry(prof, 48);
      // lathe sweeps around y: (r, y) -> rotate so axis becomes x
      lathe.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(lathe, tireMat);
      // rim face: disc with spoke holes
      const side = w.x < 0 ? -1 : 1;
      const face = new THREE.Shape();
      face.absarc(0, 0, Rr, 0, Math.PI * 2, false);
      const spokes = 10;
      for (let i = 0; i < spokes; i++) {
        const a0 = (i / spokes) * Math.PI * 2 + 0.11, a1 = ((i + 1) / spokes) * Math.PI * 2 - 0.11;
        const hole = new THREE.Path();
        const r0 = Rr * 0.34, r1 = Rr * 0.9;
        hole.moveTo(Math.cos(a0 + 0.08) * r0, Math.sin(a0 + 0.08) * r0);
        hole.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
        hole.absarc(0, 0, r1, a0, a1, false);
        hole.lineTo(Math.cos(a1 - 0.08) * r0, Math.sin(a1 - 0.08) * r0);
        hole.absarc(0, 0, r0, a1 - 0.08, a0 + 0.08, true);
        face.holes.push(hole);
      }
      const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 32 });
      faceGeo.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const rimFace = new THREE.Mesh(faceGeo, rimMat);
      rimFace.position.x = side * (W / 2 - 0.05);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(Rr, Rr, W - 0.04, 32, 1, true), rimMat);
      barrel.rotation.z = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(Rr * 0.16, Rr * 0.18, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.3 }));
      cap.rotation.z = Math.PI / 2;
      cap.position.x = side * (W / 2 - 0.02);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(Rr * 0.86, Rr * 0.86, 0.032, 36), discMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = side * 0.0;
      const spin = new THREE.Group();
      spin.add(tire, rimFace, barrel, cap, disc);
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.07, Rr * 0.5, Rr * 0.32), caliperMat);
      caliper.position.set(side * 0.03, Rr * 0.52, -Rr * 0.38);
      caliper.rotation.x = -0.6;
      const steer = new THREE.Group();
      steer.add(spin, caliper);
      steer.position.set(w.x, R, w.z);
      steer.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      steer.userData.mass = 22;
      steer.userData.attached = true;
      this.group.add(steer);
      this.wheels.push({ steer, spin, radius: R, rest: steer.position.clone(), meta: w });
    }
  }

  buildLights() {
    // volumetric headlight beams (additive cones)
    const coneGeo = new THREE.ConeGeometry(2.6, 14, 24, 1, true);
    coneGeo.translate(0, -7, 0);
    coneGeo.rotateX(-Math.PI / 2 - 0.04);
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { uInt: { value: 1 } },
      vertexShader: `varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){ vL = -position.z / 14.0; vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uInt; varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        float a = (1.0 - vL) * (1.0 - vL) * edge * 0.10 * uInt * smoothstep(0.0, 0.08, vL);
        gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.coneMat = coneMat;
    const zf = this.meta.length / 2;
    const y = lerpTable(this.meta.tub.zs, this.meta.tub.yt, zf - 0.3) - 0.08;
    this.beams = [];
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(coneGeo, coneMat);
      c.position.set(s * 0.62, y, zf - 0.25);
      c.renderOrder = 5;
      c.frustumCulled = false;
      this.group.add(c);
      this.beams.push(c);
    }
    this.headlightLocal = new THREE.Vector3(0, y, zf - 0.2);
  }

  setLights(head, brake, reverse = 0) {
    this.uniforms.uHead.value = head;
    this.uniforms.uBrake.value = brake;
    this.uniforms.uRev.value = reverse;
    this.coneMat.uniforms.uInt.value = head;
  }

  setBrakeGlow(v) { this.discMat.emissiveIntensity = v; }

  /** Update wheel visuals: per wheel {steer (rad), spin (rad), compression offset (m)}. */
  updateWheels(states) {
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i], s = states[i];
      if (!w.steer.userData.attached) continue;
      w.steer.position.y = w.rest.y + s.offset;
      w.steer.rotation.y = s.steer;
      w.spin.rotation.x = s.spin;
    }
  }

  /**
   * Crumple the body around a local-space point. dir = local push direction (into the car).
   * Returns how much the geometry actually moved (for audio/FX scaling).
   */
  deform(point, dir, amount, radius) {
    const pos = this.bodyGeo.attributes.position, rest = this.bodyGeo.attributes.aRest, dmg = this.bodyGeo.attributes.aDmg;
    const n = pos.count;
    const r2 = radius * radius;
    let moved = 0;
    const d = dir.clone().normalize();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const dx = x - point.x, dy = y - point.y, dz = z - point.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 > r2) continue;
      const f = 1 - Math.sqrt(dist2) / radius;
      const fall = f * f * (3 - 2 * f);
      // crumple noise: neighbouring vertices fold by different amounts
      const rx = rest.getX(i), ry = rest.getY(i), rz = rest.getZ(i);
      const nz = Math.sin(rx * 41.3 + ry * 17.1) * Math.cos(rz * 29.7 - ry * 11.9);
      let push = amount * fall * (0.75 + 0.45 * nz);
      // limit total intrusion from the rest shape (the chassis is rigid underneath)
      const ox = x + d.x * push - rx, oy = y + d.y * push - ry, oz = z + d.z * push - rz;
      const off = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const maxOff = 0.32;
      let k = 1;
      if (off > maxOff) k = Math.max(0, maxOff / off);
      const nx = rx + ox * k, ny = ry + oy * k, nzv = rz + oz * k;
      moved += Math.abs(nx - x) + Math.abs(ny - y) + Math.abs(nzv - z);
      pos.setXYZ(i, nx, Math.max(0.09, ny), nzv);
      dmg.setX(i, Math.min(1.3, dmg.getX(i) + fall * Math.min(1, amount * 9)));
    }
    if (moved > 0) {
      pos.needsUpdate = true; dmg.needsUpdate = true;
      this.bodyGeo.computeVertexNormals();
      this.bodyGeo.attributes.normal.needsUpdate = true;
    }
    return moved;
  }

  /** Paint scrape without denting (sliding along walls). */
  scrape(point, radius, amount) {
    const pos = this.bodyGeo.attributes.position, dmg = this.bodyGeo.attributes.aDmg;
    const r2 = radius * radius;
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      const dx = pos.getX(i) - point.x, dy = pos.getY(i) - point.y, dz = pos.getZ(i) - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      dmg.setX(i, Math.min(1.0, dmg.getX(i) + amount * (1 - Math.sqrt(d2) / radius)));
      any = true;
    }
    if (any) dmg.needsUpdate = true;
  }

  resetDamage() {
    const pos = this.bodyGeo.attributes.position, rest = this.bodyGeo.attributes.aRest, dmg = this.bodyGeo.attributes.aDmg;
    pos.array.set(rest.array);
    dmg.array.fill(0);
    pos.needsUpdate = true; dmg.needsUpdate = true;
    this.bodyGeo.computeVertexNormals();
  }
}
