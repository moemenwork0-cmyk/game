// Marine life: fish schools (shader-animated, scatter from passing cars), manta rays, bioluminescent
// jellyfish and a humpback whale gliding over the sunken city.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);
import { patchMaterial, UW } from '../render/underwater.js';

function fishGeometry() {
  // body of revolution squashed sideways, length 1 along +z, plus tail and dorsal fins
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.16 * (1 - t * 0.3);
    pts.push(new THREE.Vector2(Math.max(r, 0.004), t - 0.5));
  }
  const body = new THREE.LatheGeometry(pts, 8);
  body.rotateX(Math.PI / 2);   // axis y -> z
  body.scale(0.55, 1, 1);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.45, 0, 0.17, -0.68, 0, -0.17, -0.68], 3));
  tail.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
  tail.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0], 2));
  const dorsal = new THREE.BufferGeometry();
  dorsal.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.12, 0.05, 0, 0.24, -0.1, 0, 0.1, -0.2], 3));
  dorsal.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
  dorsal.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0], 2));
  const g = mergeGeometries([ni(body), tail, dorsal]);
  g.computeVertexNormals();
  return g;
}

const FISH_VERT_DECL = /* glsl */ `
attribute vec4 aFish;   // offset xyz in school, phase
uniform vec3 uCenter; uniform vec3 uHeading; uniform float uScatter; uniform float uSpeed;
varying float vBelly;
`;
const FISH_VERT = /* glsl */ `
{
  float ph = aFish.w;
  // body wave: tail swings more than the head
  float sw = sin(uTime * (9.0 + uSpeed * 4.0) + ph * 6.2831 - position.z * 5.0) * (0.5 - position.z) * 0.09;
  transformed.x += sw;
  vBelly = smoothstep(0.02, -0.08, position.y);
  // place in school: wander around the formation offset
  vec3 off = aFish.xyz * (1.0 + uScatter * 2.5);
  off += vec3(sin(uTime * 0.7 + ph * 12.0), sin(uTime * 0.5 + ph * 7.0) * 0.6, cos(uTime * 0.6 + ph * 9.0)) * (1.2 + uScatter * 3.0);
  vec3 fwd = normalize(uHeading + vec3(sin(uTime * 0.9 + ph * 20.0) * 0.25, 0.0, cos(uTime * 0.8 + ph * 15.0) * 0.25));
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, rgt);
  transformed = uCenter + off + rgt * transformed.x + up * transformed.y + fwd * transformed.z;
}
`;

export class FishSchool {
  constructor(scene, { count = 40, size = 0.5, color = 0xbfd8e0, radius = 8, path, speed = 3, metal = 0.9 }) {
    const geo = fishGeometry();
    geo.scale(size, size, size);
    const ig = new THREE.InstancedBufferGeometry().copy(geo);
    ig.instanceCount = count;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.cbrt(Math.random()) * radius;
      data.set([Math.cos(a) * r, (Math.random() - 0.5) * radius * 0.5, Math.sin(a) * r * 1.6, Math.random()], i * 4);
    }
    ig.setAttribute('aFish', new THREE.InstancedBufferAttribute(data, 4));
    this.uniforms = { uCenter: { value: new THREE.Vector3() }, uHeading: { value: new THREE.Vector3(0, 0, 1) }, uScatter: { value: 0 }, uSpeed: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.35, side: THREE.DoubleSide, envMapIntensity: 1.5 });
    patchMaterial(mat, {
      key: 'fish', uniforms: this.uniforms, caustics: true,
      vertDecl: FISH_VERT_DECL,
      onCompile: (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FISH_VERT)
          .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n');
        sh.fragmentShader = 'varying float vBelly;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * 0.55, vec3(0.9), vBelly * 0.7);');
      },
    });
    this.mesh = new THREE.Mesh(ig, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.path = path;      // function(t) -> Vector3
    this.t = Math.random() * 100;
    this.speed = speed;
    this.scatter = 0;
    this.prev = path(this.t).clone();
  }

  update(dt, threats) {
    this.t += dt * this.speed * (1 + this.scatter * 1.5);
    const p = this.path(this.t);
    let near = 0;
    for (const c of threats) {
      const d = c.distanceTo(p);
      if (d < 22) near = Math.max(near, 1 - d / 22);
    }
    this.scatter += ((near > 0 ? 1 : 0) - this.scatter) * Math.min(1, dt * (near > 0 ? 4 : 0.4));
    const h = p.clone().sub(this.prev);
    if (h.lengthSq() > 1e-6) this.uniforms.uHeading.value.lerp(h.normalize(), Math.min(1, dt * 2)).normalize();
    this.prev.copy(p);
    this.uniforms.uCenter.value.copy(p);
    this.mesh.visible = !this.cam || this.cam.distanceTo(p) < 150;
    this.uniforms.uScatter.value = this.scatter;
    this.uniforms.uSpeed.value = this.scatter;
  }
}

function mantaGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 1.2);
  s.quadraticCurveTo(0.9, 0.7, 2.6, -0.2);
  s.quadraticCurveTo(1.2, -0.3, 0.35, -0.9);
  s.lineTo(0.08, -1.1); s.lineTo(-0.08, -1.1); s.lineTo(-0.35, -0.9);
  s.quadraticCurveTo(-1.2, -0.3, -2.6, -0.2);
  s.quadraticCurveTo(-0.9, 0.7, 0, 1.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.09);
  g.rotateX(-Math.PI / 2);
  const tail = new THREE.CylinderGeometry(0.01, 0.04, 2.4, 4);
  tail.rotateX(Math.PI / 2); tail.translate(0, 0, 2.2);
  const m = mergeGeometries([ni(g), ni(tail)]);
  m.computeVertexNormals();
  return m;
}

export class Mantas {
  constructor(scene, centers) {
    const geo = mantaGeometry();
    this.uniforms = {};
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.6 });
    patchMaterial(mat, {
      key: 'manta',
      onCompile: (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3].x * 0.1;
          #endif
          float wing = abs(position.x);
          transformed.y += sin(uTime * 1.3 + ph - wing * 0.6) * wing * wing * 0.14;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.8);');
      },
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, centers.length);
    this.mesh.frustumCulled = false;
    this.items = centers.map((c, i) => ({ c, r: 25 + i * 7, ph: i * 2.1, y: c.y, s: 1.3 + (i % 3) * 0.35 }));
    scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion();
  }

  update(t) {
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    this.items.forEach((it, i) => {
      const a = t * 0.08 + it.ph;
      p.set(it.c.x + Math.cos(a) * it.r, it.y + Math.sin(t * 0.3 + it.ph) * 2, it.c.z + Math.sin(a) * it.r);
      // heading tangent to the circle (manta's nose is +z)
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI);
      const bank = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.25);
      this.q.multiply(bank);
      s.setScalar(it.s);
      this.m.compose(p, this.q, s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Jellyfish {
  constructor(scene, positions, color = new THREE.Color(0.4, 0.8, 1.6)) {
    const bell = new THREE.SphereGeometry(0.6, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const parts = [ni(bell)];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const t = new THREE.CylinderGeometry(0.014, 0.004, 2.6, 3, 5, true);
      t.translate(Math.cos(a) * 0.4, -1.3, Math.sin(a) * 0.4);
      parts.push(ni(t));
    }
    const geo = mergeGeometries(parts);
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uColor: { value: color } }, UW),
      vertexShader: `
        uniform float uTime; varying float vY; varying vec3 vW; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 p = position;
          float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;
          float pulse = sin(uTime * 2.2 + ph);
          if (p.y > -0.05) { p.xz *= 1.0 + pulse * 0.12; p.y *= 1.0 - pulse * 0.1; }
          else { p.x += sin(uTime * 1.5 + p.y * 2.0 + ph) * (-p.y) * 0.08; p.z += cos(uTime * 1.2 + p.y * 2.0 + ph) * (-p.y) * 0.08; }
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
          w.y += sin(uTime * 0.4 + ph) * 1.5;
          vW = w.xyz; vY = p.y;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uTime; varying float vY; varying vec3 vW; varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = 1.0 - abs(dot(normalize(vN), vV));
          float a = vY > -0.05 ? (0.25 + rim * 0.9) : 0.55 * (1.0 + vY / 2.6);
          float d = length(vW - cameraPosition);
          float fade = exp(-d * 0.012);
          gl_FragColor = vec4(uColor * a * fade * (0.8 + 0.2 * sin(uTime * 3.0 + vW.x)), 1.0);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    // bucket into 120 m cells so whole groups are culled by the frustum and by distance
    const cells = new Map();
    for (const p of positions) {
      const key = Math.floor(p.x / 120) + ':' + Math.floor(p.z / 120);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(p);
    }
    this.meshes = [];
    const m = new THREE.Matrix4();
    for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { m.makeScale(p.s, p.s, p.s).setPosition(p.x, p.y, p.z); im.setMatrixAt(i, m); });
      im.computeBoundingSphere();
      im.boundingSphere.radius += 4;
      im.renderOrder = 4;
      scene.add(im);
      this.meshes.push(im);
    }
  }
}

function whaleGeometry() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * 2.1 * (1 - t * 0.55);
    pts.push(new THREE.Vector2(Math.max(r, 0.05), t * 15 - 7.5));
  }
  const body = new THREE.LatheGeometry(pts, 18);
  body.rotateX(-Math.PI / 2);
  body.scale(1, 0.82, 1);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.85);
  const fin = (side) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(2.5, -0.6, 4.6, -2.2); s.quadraticCurveTo(2.0, 0.2, 0, 0.9);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    if (side < 0) g.scale(-1, 1, 1);
    g.translate(side * 1.6, -0.9, 3.0);
    return ni(g);
  };
  const fluke = new THREE.Shape();
  fluke.moveTo(0, 0.4); fluke.quadraticCurveTo(1.8, 0.2, 2.6, 1.3); fluke.quadraticCurveTo(1.4, -0.5, 0, -0.6);
  fluke.quadraticCurveTo(-1.4, -0.5, -2.6, 1.3); fluke.quadraticCurveTo(-1.8, 0.2, 0, 0.4);
  const fl = new THREE.ExtrudeGeometry(fluke, { depth: 0.1, bevelEnabled: false });
  fl.rotateX(-Math.PI / 2); fl.translate(0, 0, -7.6);
  const g = mergeGeometries([ni(body), fin(1), fin(-1), ni(fl)]);
  g.computeVertexNormals();
  return g;
}

export class Whale {
  constructor(scene, center, radius, y) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x39444c, roughness: 0.55 });
    patchMaterial(mat, {
      key: 'whale',
      onCompile: (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float tz = clamp((-position.z - 1.0) / 7.0, 0.0, 1.0);
          transformed.y += sin(uTime * 0.9 - position.z * 0.25) * tz * tz * 1.4;
          vec3 wpos0 = position;`);
        sh.vertexShader = 'varying float vWBelly;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWBelly = smoothstep(-0.3, -1.4, position.y);');
        sh.fragmentShader = 'varying float vWBelly;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.74, 0.72), vWBelly);');
      },
    });
    this.mesh = new THREE.Mesh(whaleGeometry(), mat);
    this.mesh.scale.setScalar(1.25);
    scene.add(this.mesh);
    this.c = center; this.r = radius; this.y = y;
  }

  update(t) {
    const a = t * 0.025;
    this.mesh.position.set(this.c.x + Math.cos(a) * this.r, this.y + Math.sin(t * 0.1) * 3, this.c.z + Math.sin(a) * this.r);
    this.mesh.rotation.set(0, -a, Math.sin(t * 0.2) * 0.05);
  }
}
