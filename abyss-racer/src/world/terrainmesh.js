// Chunked seabed mesh with a world-space material: rippled sand at two scales, triplanar rock on slopes,
// zone tints (pale reef sand, dark volcanic trench), all lit by caustics and the underwater fog.
import * as THREE from 'three';
import { patchMaterial } from '../render/underwater.js';
import { ZONE_IDS } from './track.js';
import { fbm } from './terrain.js';

const ZONE_TINT = {
  city: [0.92, 0.88, 0.80], reef: [1.08, 1.0, 0.9], kelp: [0.82, 0.86, 0.74], canyon: [0.78, 0.74, 0.7],
  wreck: [0.86, 0.84, 0.78], trench: [0.34, 0.33, 0.36], climb: [0.7, 0.72, 0.72],
};

export function terrainMaterial(tex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true });
  const uniforms = {
    tSand: { value: tex.sand.map }, tSandN: { value: tex.sand.normalMap },
    tRipple: { value: tex.ripple.map }, tRock: { value: tex.rock.map }, tRockN: { value: tex.rock.normalMap },
    tCoral: { value: tex.coral.map },
  };
  patchMaterial(mat, {
    key: 'terrain', uniforms,
    fragDecl: 'uniform sampler2D tSand, tSandN, tRipple, tRock, tRockN, tCoral;\n',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec3 wp = vUwWorld;
          vec3 wN0 = normalize(inverseTransformDirection(vNormal, viewMatrix));
          vec3 sandD = texture2D(tSand, wp.xz / 3.6).rgb;
          vec3 sandF = texture2D(tSand, wp.xz / 17.0 + 0.3).rgb;
          vec3 rip = texture2D(tRipple, wp.xz / 26.0).rgb;
          float ripL = dot(rip, vec3(0.333));
          vec3 sand = mix(sandD, sandF, 0.4) * (0.55 + ripL * 0.9);
          float coralMask = smoothstep(0.55, 0.75, texture2D(tRipple, wp.xz / 90.0 + 0.5).g) * step(1.0, vColor.r);
          vec3 coral = texture2D(tCoral, wp.xz / 5.0).rgb;
          sand = mix(sand, coral * vec3(1.05, 0.85, 0.8), coralMask * 0.75);
          vec3 bw = pow(abs(wN0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
          vec3 rock = texture2D(tRock, wp.zy / 7.0).rgb * bw.x + texture2D(tRock, wp.xz / 7.0).rgb * bw.y + texture2D(tRock, wp.xy / 7.0).rgb * bw.z;
          float rockW = smoothstep(0.86, 0.62, wN0.y);
          vec3 alb = mix(sand, rock * 0.9, rockW);
          diffuseColor.rgb *= alb * vColor;`)
        .replace('#include <normal_fragment_maps>', `
          {
            vec3 nS = texture2D(tSandN, wp.xz / 3.6).xyz * 2.0 - 1.0;
            vec3 nR = texture2D(tRockN, wp.zy / 7.0).xyz * 2.0 - 1.0;
            vec3 nR2 = texture2D(tRockN, wp.xy / 7.0).xyz * 2.0 - 1.0;
            vec3 wN = wN0;
            vec3 pertS = vec3(nS.x, 0.0, -nS.y) * 0.9;
            vec3 pertR = vec3(0.0, nR.y, nR.x) * bw.x + vec3(nR2.x, nR2.y, 0.0) * bw.z;
            wN = normalize(wN + mix(pertS, pertR * 1.4, rockW));
            normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
          }`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.95, 0.8, rockW);');
    },
  });
  return mat;
}

export function buildTerrainMeshes(terrain, track, material, chunkCells = 48) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const { nx, nz, step, x0, z0, heights } = terrain;
  // per-vertex zone tint (smoothed by sampling a few neighbours' zones)
  const tint = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const id = j * nx + i;
    let k = terrain.nearK[id]; if (k < 0) k = -1 - k;
    const z = ZONE_IDS[track.zone[k]];
    const t = ZONE_TINT[z];
    const x = x0 + i * step, zz = z0 + j * step;
    const v = 0.88 + fbm(x * 0.01, zz * 0.01, 2) * 0.25;
    tint[id * 3] = t[0] * v; tint[id * 3 + 1] = t[1] * v; tint[id * 3 + 2] = t[2] * v;
  }
  // blur tints so zone borders fade over ~40 m
  for (let pass = 0; pass < 6; pass++) {
    const src = tint.slice();
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) for (let c = 0; c < 3; c++) {
      const id = (j * nx + i) * 3 + c;
      tint[id] = (src[id] * 4 + src[id - 3] + src[id + 3] + src[id - nx * 3] + src[id + nx * 3]) / 8;
    }
  }
  // normals from the height grid
  const nrm = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const hl = heights[j * nx + Math.max(0, i - 1)], hr = heights[j * nx + Math.min(nx - 1, i + 1)];
    const hd = heights[Math.max(0, j - 1) * nx + i], hu = heights[Math.min(nz - 1, j + 1) * nx + i];
    const n = new THREE.Vector3(hl - hr, 2 * step, hd - hu).normalize();
    nrm.set([n.x, n.y, n.z], (j * nx + i) * 3);
  }
  for (let cj = 0; cj < nz - 1; cj += chunkCells) for (let ci = 0; ci < nx - 1; ci += chunkCells) {
    const w = Math.min(chunkCells, nx - 1 - ci), h = Math.min(chunkCells, nz - 1 - cj);
    const pos = new Float32Array((w + 1) * (h + 1) * 3), nr = new Float32Array((w + 1) * (h + 1) * 3), col = new Float32Array((w + 1) * (h + 1) * 3);
    let p = 0;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const gi = ci + i, gj = cj + j, id = gj * nx + gi;
      pos[p] = x0 + gi * step; pos[p + 1] = heights[id]; pos[p + 2] = z0 + gj * step;
      nr[p] = nrm[id * 3]; nr[p + 1] = nrm[id * 3 + 1]; nr[p + 2] = nrm[id * 3 + 2];
      col[p] = tint[id * 3]; col[p + 1] = tint[id * 3 + 1]; col[p + 2] = tint[id * 3 + 2];
      p += 3;
    }
    const idx = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = j * (w + 1) + i, b = a + 1, c = a + (w + 1), d = c + 1;
      idx.push(a, c, d, a, d, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
