// Tyre marks: a ring buffer of quads laid on the road where tyres slide or spin.
import * as THREE from 'three';
import { patchMaterial } from './underwater.js';

export class SkidMarks {
  constructor(scene, max = 2400) {
    this.max = max;
    this.pos = new Float32Array(max * 4 * 3);
    this.alpha = new Float32Array(max * 4);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const m = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    patchMaterial(m, {
      key: 'skid', caustics: false,
      vertDecl: 'attribute float aA; varying float vA;\n', vertBody: 'vA = aA;\n',
      onCompile: (sh) => { sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.a = vA * 0.75;'); },
    });
    // the fog chunk was already replaced by patchMaterial; append alpha after it instead
    m.onBeforeCompile = ((prev) => (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, 'gl_FragColor.a = vA * 0.7;\n}'); })(m.onBeforeCompile);
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.head = 0;
    this.last = new Map();   // key -> {l, r}
    this.dirty = false;
  }

  /** Add a segment for tyre `key` at contact point p with lateral axis `side`, width w, intensity a. */
  add(key, p, side, w, a) {
    const prev = this.last.get(key);
    const l = p.clone().addScaledVector(side, w / 2), r = p.clone().addScaledVector(side, -w / 2);
    l.y += 0.02; r.y += 0.02;
    if (prev && prev.l.distanceToSquared(l) < 4 && prev.l.distanceToSquared(l) > 0.04) {
      const i = this.head;
      this.pos.set([prev.l.x, prev.l.y, prev.l.z, prev.r.x, prev.r.y, prev.r.z, l.x, l.y, l.z, r.x, r.y, r.z], i * 12);
      this.alpha.set([prev.a, prev.a, a, a], i * 4);
      this.head = (this.head + 1) % this.max;
      this.dirty = true;
      this.last.set(key, { l, r, a });
    } else if (!prev || prev.l.distanceToSquared(l) >= 4) {
      this.last.set(key, { l, r, a });
    }
  }

  lift(key) { this.last.delete(key); }

  update() {
    if (!this.dirty) return;
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aA.needsUpdate = true;
    this.dirty = false;
  }
}
