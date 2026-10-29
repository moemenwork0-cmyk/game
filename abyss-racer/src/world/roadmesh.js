// Road surface, kerbs, run-off, barriers (+ their physics trimeshes) generated from the track frames.
import * as THREE from 'three';
import { TRACK } from './trackdef.js';
import { patchMaterial } from '../render/underwater.js';

const CHUNK = 120; // samples per render chunk (frustum culling granularity)

/**
 * Generic swept strip along the track: profile = [[lat, h, v], ...] (v = texture coord across).
 * Returns {geo, positions, indices} with segments split per chunk.
 */
function sweep(track, profile, { from = 0, to = track.N, skipGap = true, side = 0, vScale = 1 / 8, step = 1, latFn = null } = {}) {
  const pos = [], nrm = [], uv = [], idx = [], aux = [];
  const P = new THREE.Vector3(), U = new THREE.Vector3(), R = new THREE.Vector3(), T = new THREE.Vector3();
  const rows = [];
  for (let k = from; k <= to; k += step) {
    const kk = track.wrap(k);
    if (skipGap && track.gap[kk]) { rows.push(null); continue; }
    track.P(kk, P); track.U(kk, U); track.R(kk, R); track.T(kk, T);
    const base = pos.length / 3;
    for (const [lat0, h, v] of profile) {
      const lat = latFn ? latFn(kk, lat0) : lat0;
      pos.push(P.x + R.x * lat + U.x * h, P.y + R.y * lat + U.y * h, P.z + R.z * lat + U.z * h);
      uv.push(v, k * track.ds * vScale);
      aux.push(track.curv[kk], lat);
    }
    rows.push(base);
  }
  const np = profile.length;
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r], b = rows[r + 1];
    if (a === null || b === null) continue;
    for (let c = 0; c < np - 1; c++) {
      const i0 = a + c, i1 = a + c + 1, j0 = b + c, j1 = b + c + 1;
      idx.push(i0, i1, j0, i1, j1, j0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aux', new THREE.Float32BufferAttribute(aux, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function chunked(track, profile, opts, material, group, name) {
  const meshes = [];
  for (let c = 0; c < track.N; c += CHUNK) {
    const geo = sweep(track, profile, { ...opts, from: c, to: Math.min(track.N, c + CHUNK) });
    if (!geo.index || geo.index.count === 0) continue;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    m.receiveShadow = true;
    group.add(m);
    meshes.push(m);
  }
  return meshes;
}

export function buildRoad(track, tex) {
  const group = new THREE.Group();
  group.name = 'road';
  const hw = TRACK.halfWidth, sh = TRACK.shoulder;

  // --- asphalt with painted/glowing markings, rubbered racing line, start grid ---
  const roadMat = new THREE.MeshStandardMaterial({
    map: tex.asphalt.map, normalMap: tex.asphalt.normalMap, roughnessMap: tex.asphalt.arm, metalness: 0.0, roughness: 1,
    normalScale: new THREE.Vector2(1.2, 1.2),
  });
  const lineTex = new THREE.DataTexture(track.line.slice(), track.N, 1, THREE.RedFormat, THREE.FloatType);
  lineTex.needsUpdate = true;
  const roadUniforms = { uLine: { value: lineTex }, uTrackLen: { value: track.length }, uHalfW: { value: hw } };
  patchMaterial(roadMat, {
    key: 'road', uniforms: roadUniforms,
    vertDecl: 'attribute vec2 aux; varying vec2 vAux; varying vec2 vUvR;\n', vertBody: 'vAux = aux; vUvR = uv;\n',
    fragDecl: 'varying vec2 vAux; varying vec2 vUvR; uniform sampler2D uLine; uniform float uTrackLen; uniform float uHalfW;\n',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec2 ruv = vec2(vAux.y / 4.5, vUvR.y * 8.0 / 4.5);
          vec4 tcol = texture2D(map, ruv);
          float big = texture2D(map, ruv * 0.11 + 0.37).r;
          diffuseColor.rgb *= tcol.rgb * (0.8 + big * 0.6) * vec3(4.6, 4.8, 5.0);
          float s = vUvR.y * 8.0;
          float lat = vAux.y;
          // rubber laid down on the racing line
          float line = texture2D(uLine, vec2(fract(s / uTrackLen), 0.5)).r;
          float rub = exp(-pow((lat - line) / 1.6, 2.0)) * 0.45;
          diffuseColor.rgb *= 1.0 - rub;
          // edge lines (glowing), dashed centre line
          float w = fwidth(lat) * 1.2;
          float edgeL = smoothstep(0.16 + w, 0.16 - w, abs(abs(lat) - (uHalfW - 0.45)));
          float dash = step(0.5, fract(s / 12.0));
          float centre = smoothstep(0.09 + w, 0.09 - w, abs(lat)) * dash;
          // start/finish chequer and grid boxes
          float sw = mod(s + uTrackLen, uTrackLen);
          float sf = step(abs(sw - 3.0), 1.6) * step(abs(lat), uHalfW - 0.6);
          float chq = mod(floor(lat / 0.8) + floor(sw / 0.8), 2.0);
          float paint = max(edgeL, centre);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), paint * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(chq * 0.9 + 0.02), sf);
          vec3 roadGlow = vec3(0.1, 0.85, 1.0) * edgeL * 1.4 + vec3(0.9) * centre * 0.15;`)
        .replace('#include <roughnessmap_fragment>', `
          float roughnessFactor = roughness * texture2D(roughnessMap, ruv).g;
          roughnessFactor = mix(roughnessFactor, 0.35, paint);`)
        .replace('#include <normal_fragment_maps>', `
          vec3 mapN = texture2D(normalMap, ruv).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += roadGlow;');
    },
  });
  const road = [];
  const roadProfile = [];
  for (let i = 0; i <= 12; i++) { const lat = -hw + (2 * hw * i) / 12; roadProfile.push([lat, 0, i / 12]); }
  road.push(...chunked(track, roadProfile, { vScale: 1 / 8 }, roadMat, group, 'asphalt'));

  // --- kerbs: red/white on the inside of corners, dark stone elsewhere ---
  const kerbMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), {
    key: 'kerb',
    vertDecl: 'attribute vec2 aux; varying vec2 vAux; varying vec2 vUvK;\n', vertBody: 'vAux = aux; vUvK = uv;\n',
    fragDecl: 'varying vec2 vAux; varying vec2 vUvK;\n',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        float s = vUvK.y * 8.0;
        float inside = step(0.004, abs(vAux.x)) * step(0.0, -vAux.x * vAux.y);
        float stripe = step(0.5, fract(s / 3.0));
        vec3 kc = mix(vec3(0.75, 0.05, 0.04), vec3(0.9), stripe);
        diffuseColor.rgb = mix(vec3(0.16, 0.17, 0.18), kc, inside);`);
    },
  });
  const kerbProfile = (s) => [[s * hw, 0.0, 0], [s * (hw + 0.45), 0.07, 0.5], [s * (hw + 0.9), 0.0, 1]];
  chunked(track, kerbProfile(1), {}, kerbMat, group, 'kerb');
  chunked(track, kerbProfile(-1).reverse(), {}, kerbMat, group, 'kerb');

  // --- run-off: coral gravel sloping into the seabed ---
  const runMat = new THREE.MeshStandardMaterial({ map: tex.gravel.map, normalMap: tex.gravel.normalMap, roughness: 1 });
  patchMaterial(runMat, { key: 'runoff' });
  for (const t of [tex.gravel.map, tex.gravel.normalMap]) t.repeat.set(1, 1);
  const runProfile = (s) => [[s * (hw + 0.9), 0.0, 0], [s * (hw + sh), -0.12, 0.6], [s * (hw + sh + 1.4), -1.7, 1]];
  const runOpts = { vScale: 1 / 4 };
  chunked(track, runProfile(1), runOpts, runMat, group, 'runoff');
  chunked(track, runProfile(-1).reverse(), runOpts, runMat, group, 'runoff');

  // --- barriers: Jersey profile in old stone, with a glowing guide strip ---
  const barMat = new THREE.MeshStandardMaterial({ map: tex.barrier.map, normalMap: tex.barrier.normalMap, roughnessMap: tex.barrier.arm, roughness: 1 });
  patchMaterial(barMat, { key: 'barrier' });
  const jersey = (s) => {
    const o = hw + sh;
    const pts = [[o - 0.05, -0.35], [o, 0.0], [o + 0.12, 0.12], [o + 0.3, 0.55], [o + 0.34, 1.05], [o + 0.62, 1.05], [o + 0.66, -0.4]];
    const out = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      out.push([s * pts[i][0], pts[i][1], acc / 2.4]);
    }
    return s > 0 ? out : out.reverse();
  };
  for (const s of [1, -1]) {
    for (const m of chunked(track, jersey(s), { vScale: 1 / 2.4 }, barMat, group, 'barrier')) {
      // swap uv: along-track in u for a horizontal block pattern
      const uv = m.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, b, a); }
    }
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.2) });
  patchMaterial(glowMat, { key: 'glow', caustics: false });
  for (const s of [1, -1]) {
    const o = hw + sh;
    const prof = s > 0 ? [[o + 0.28, 0.82, 0], [o + 0.33, 0.95, 1]] : [[-(o + 0.33), 0.95, 0], [-(o + 0.28), 0.82, 1]];
    chunked(track, prof, {}, glowMat, group, 'glowstrip');
  }

  // --- physics: road + run-off as one trimesh; barriers (raised invisibly) as another ---
  const physRoad = sweep(track, [
    [-(hw + sh + 1.4), -1.7, 0], [-(hw + sh), -0.12, 0], [-hw, 0, 0], [0, 0, 0], [hw, 0, 0], [hw + sh, -0.12, 0], [hw + sh + 1.4, -1.7, 0],
  ], { step: 2 });
  const physBar = [];
  for (const s of [1, -1]) {
    const o = hw + sh;
    const prof = s > 0 ? [[o - 0.05, -0.5, 0], [o + 0.25, 2.6, 0], [o + 0.7, 2.6, 0], [o + 0.7, -0.5, 0]]
      : [[-(o + 0.7), -0.5, 0], [-(o + 0.7), 2.6, 0], [-(o + 0.25), 2.6, 0], [-(o - 0.05), -0.5, 0]];
    physBar.push(sweep(track, prof, { step: 2 }));
  }
  return { group, physRoad, physBar, roadMat };
}
