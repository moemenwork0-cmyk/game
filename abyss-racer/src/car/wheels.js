// All wheels of all cars in one instanced draw call (plus one for the brake calipers).
// The unit wheel (radius 1, width 1) carries a per-vertex part id: 0 tyre, 1 rim, 2 brake disc, 3 hub.
// Rim colour comes from the instance colour; each instance is scaled to the car's wheel size.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchMaterial } from '../render/underwater.js';

function tag(geo, part) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv2');
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  return g;
}

/** Unit wheel along the x axis; `side` = +1 outer face at +x. */
export function unitWheelGeometry(side) {
  const R = 1, W = 1, Rr = 0.66;
  const hw = W / 2;
  const prof = [
    [Rr - 0.03, -hw + 0.06], [Rr + 0.06, -hw], [R - 0.14, -hw - 0.02], [R - 0.06, -hw + 0.015], [R - 0.012, -hw + 0.08], [R, -hw + 0.16],
    [R, hw - 0.16], [R - 0.012, hw - 0.08], [R - 0.06, hw - 0.015], [R - 0.14, hw + 0.02], [Rr + 0.06, hw], [Rr - 0.03, hw - 0.06],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(prof, 28);
  tire.rotateZ(Math.PI / 2);
  // rim face with 10 spoke windows
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
  const rim = new THREE.ExtrudeGeometry(face, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1, curveSegments: 4 });
  rim.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
  rim.translate(side * (hw - 0.16), 0, 0);
  const barrel = new THREE.CylinderGeometry(Rr, Rr, W - 0.12, 20, 1, true);
  barrel.rotateZ(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(Rr * 0.16, Rr * 0.18, 0.14, 6);
  cap.rotateZ(Math.PI / 2);
  cap.translate(side * (hw - 0.06), 0, 0);
  const disc = new THREE.CylinderGeometry(Rr * 0.86, Rr * 0.86, 0.09, 20);
  disc.rotateZ(Math.PI / 2);
  // keep the "aPart" attribute set uniform across pieces
  const parts = [tag(tire, 0), tag(rim, 1), tag(barrel, 1), tag(disc, 2), tag(cap, 3)];
  for (const p of parts) { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv', 'aPart'].includes(k)) p.deleteAttribute(k); }
  const g = mergeGeometries(parts);
  g.computeBoundingSphere();
  return g;
}

export function wheelMaterial(env) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.1, envMap: env, envMapIntensity: 1.3 });
  patchMaterial(m, {
    key: 'wheelinst',
    vertDecl: 'attribute float aPart; varying float vPart; varying vec2 vWuv;\n', vertBody: 'vPart = aPart; vWuv = uv;\n',
    fragDecl: 'varying float vPart; varying vec2 vWuv;\n',
    onCompile: (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float wCC = 0.0;
          if (vPart < 0.5) {
            float tread = smoothstep(0.38, 0.42, vWuv.y) * (1.0 - smoothstep(0.58, 0.62, vWuv.y));
            float g1 = step(0.45, abs(fract(vWuv.x * 120.0) - 0.5) * 2.0);
            float letters = (smoothstep(0.1, 0.12, vWuv.y) * (1.0 - smoothstep(0.17, 0.19, vWuv.y)) + smoothstep(0.81, 0.83, vWuv.y) * (1.0 - smoothstep(0.88, 0.9, vWuv.y))) * step(0.8, fract(vWuv.x * 6.0));
            diffuseColor.rgb = vec3(0.035) * (1.0 - tread * g1 * 0.6) + letters * 0.18;
            roughnessFactor = mix(0.85, 0.6, tread); metalnessFactor = 0.0;
          } else if (vPart < 1.5) {
            #ifdef USE_COLOR
              diffuseColor.rgb = vColor;
            #endif
            roughnessFactor = 0.22; metalnessFactor = 1.0; wCC = 0.6;
          } else if (vPart < 2.5) {
            diffuseColor.rgb = vec3(0.33, 0.34, 0.35); roughnessFactor = 0.42; metalnessFactor = 1.0;
          } else {
            diffuseColor.rgb = vec3(0.04); roughnessFactor = 0.3; metalnessFactor = 1.0;
          }`)
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat = wCC;')
        .replace('#include <color_fragment>', '');
    },
  });
  return m;
}

export class WheelBank {
  constructor(scene, env, max = 40) {
    this.max = max;
    this.matL = wheelMaterial(env);
    const gl = unitWheelGeometry(1), gr = unitWheelGeometry(-1);
    // left-side and right-side wheels mirror the rim face: two instanced meshes
    this.meshes = [gl, gr].map((g) => {
      const m = new THREE.InstancedMesh(g, this.matL, max);
      m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m);
      return m;
    });
    this.geoL = gl; this.geoR = gr;
    const calGeo = new THREE.BoxGeometry(1, 1, 1);
    this.calMat = patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1, envMap: env }), { key: 'caliper' });
    this.cal = new THREE.InstancedMesh(calGeo, this.calMat, max * 2);
    this.cal.count = 0; this.cal.frustumCulled = false;
    this.cal.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cal.setColorAt(0, new THREE.Color(1, 0, 0));
    scene.add(this.cal);
    this.slots = [[], []];
    this.calSlots = 0;
    this.free = [[], []];
  }

  /** Reserve an instance; side 0 = outer face +x, 1 = -x. Returns a handle. */
  alloc(side, rimColor, caliperColor) {
    const m = this.meshes[side];
    const i = this.free[side].length ? this.free[side].pop() : m.count++;
    m.setColorAt(i, new THREE.Color(rimColor));
    m.instanceColor.needsUpdate = true;
    const c = this.calSlots++;
    this.cal.count = this.calSlots;
    this.cal.setColorAt(c, new THREE.Color(caliperColor));
    this.cal.instanceColor.needsUpdate = true;
    return { side, i, c };
  }

  release(h) {
    this.set(h, null);
    this.free[h.side].push(h.i);
  }

  /** Write instance matrices (null = hide). */
  set(h, wheelMatrix, caliperMatrix) {
    const m = this.meshes[h.side];
    m.setMatrixAt(h.i, wheelMatrix || ZERO);
    m.instanceMatrix.needsUpdate = true;
    this.cal.setMatrixAt(h.c, caliperMatrix || ZERO);
    this.cal.instanceMatrix.needsUpdate = true;
  }

  /** A standalone mesh of one wheel (for torn-off wheels). */
  standalone(side, rimColor, R, W) {
    const mat = this.matL.clone();
    mat.onBeforeCompile = this.matL.onBeforeCompile;
    mat.customProgramCacheKey = this.matL.customProgramCacheKey;
    const m = new THREE.InstancedMesh(side === 0 ? this.geoL : this.geoR, mat, 1);
    m.setMatrixAt(0, new THREE.Matrix4().makeScale(W, R, R));
    m.setColorAt(0, new THREE.Color(rimColor));
    m.frustumCulled = false;
    m.castShadow = true;
    return m;
  }
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
