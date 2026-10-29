// Spatially bucketed instancing: instances are grouped in 80 m cells so frustum culling and fog
// distance culling skip whole cells; each source mesh part becomes one InstancedMesh per cell.
import * as THREE from 'three';

const CELL = 140;

export class InstanceBank {
  constructor(scene) {
    this.scene = scene;
    this.types = new Map();   // name -> { parts: [{geometry, material}], items: [] }
    this.meshes = [];
  }

  /** parts: array of {geometry, material} (already in the prototype's local space). */
  define(name, parts, { castShadow = false, receiveShadow = true, cullDist = 230 } = {}) {
    this.types.set(name, { parts, items: [], castShadow, receiveShadow, cullDist });
  }

  /** Define from a loaded glTF scene: bakes node transforms into per-part geometries. */
  defineFromGLTF(name, root, opts = {}, matHook = (m) => m) {
    const parts = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push({ geometry: g, material: matHook(o.material, o) });
    });
    this.define(name, parts, opts);
    return parts;
  }

  add(name, position, quaternion, scale, color = null) {
    const t = this.types.get(name);
    if (!t) throw new Error('unknown instance type ' + name);
    const m = new THREE.Matrix4().compose(position, quaternion, typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : scale);
    t.items.push({ m, color, x: position.x, z: position.z });
  }

  build() {
    for (const [name, t] of this.types) {
      const cells = new Map();
      for (const it of t.items) {
        const key = Math.floor(it.x / CELL) + ':' + Math.floor(it.z / CELL);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(it);
      }
      const anyColor = t.items.some((it) => it.color);
      const white = new THREE.Color(1, 1, 1);
      for (const [, items] of cells) {
        for (const part of t.parts) {
          const im = new THREE.InstancedMesh(part.geometry, part.material, items.length);
          items.forEach((it, i) => {
            im.setMatrixAt(i, it.m);
            if (anyColor) im.setColorAt(i, it.color || white);
          });
          im.instanceMatrix.needsUpdate = true;
          if (im.instanceColor) im.instanceColor.needsUpdate = true;
          im.castShadow = t.castShadow;
          im.receiveShadow = t.receiveShadow;
          im.computeBoundingSphere();
          im.name = name;
          im.userData.cullDist = t.cullDist;
          this.scene.add(im);
          this.meshes.push(im);
        }
      }
    }
  }

  /** Hide cells beyond fog range (cheap CPU distance culling on top of frustum culling). */
  cull(cam) {
    for (const m of this.meshes) {
      const bs = m.boundingSphere;
      if (!bs) continue;
      const d = cam.distanceTo(bs.center) - bs.radius;
      m.visible = d < m.userData.cullDist;
    }
  }
}
