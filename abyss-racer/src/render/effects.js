// Volumetric-looking light shafts, marine snow, and a pooled billboard particle system used for sparks,
// bubbles, silt clouds and debris chips.
import * as THREE from 'three';
import { UW, UW_COMMON } from './underwater.js';

// ---------------- god rays ----------------
export class GodRays {
  constructor(scene, count = 26) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 8);
    geo.translate(0, -0.5, 0);
    const ig = new THREE.InstancedBufferGeometry().copy(geo);
    ig.instanceCount = count;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) data.set([Math.random() * 2 - 1, Math.random() * 2 - 1, 3 + Math.random() * 9, Math.random()], i * 4);
    ig.setAttribute('aRay', new THREE.InstancedBufferAttribute(data, 4));
    this.uniforms = Object.assign({ uCam: { value: new THREE.Vector3() }, uRange: { value: 70 }, uStrength: { value: 1 } }, UW);
    this.mesh = new THREE.Mesh(ig, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec4 aRay; uniform vec3 uCam; uniform float uRange; uniform float uTime; uniform vec3 uSunDir; uniform float uSurfaceY;
        varying float vV; varying float vU; varying float vFade; varying float vSeed;
        void main() {
          // world-anchored lattice of shafts that wraps around the camera
          vec2 cell = vec2(uRange * 2.0);
          vec2 base = aRay.xy * uRange;
          vec2 wpos = base + floor((uCam.xz - base) / cell + 0.5) * cell;
          float len = 90.0;
          vec3 top = vec3(wpos.x, uSurfaceY, wpos.y);
          vec3 dir = -uSunDir;
          vec3 toCam = normalize(uCam - top);
          vec3 side = normalize(cross(dir, toCam));
          float w = aRay.z * (0.8 + 0.3 * sin(uTime * 0.3 + aRay.w * 30.0));
          vec3 p = top + side * position.x * w + dir * (-position.y) * len;
          vV = -position.y; vU = position.x + 0.5; vSeed = aRay.w;
          float d = length(p.xz - uCam.xz);
          vFade = smoothstep(uRange, uRange * 0.55, d) * smoothstep(4.0, 14.0, length(p - uCam));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uStrength; uniform float uSurfaceY; uniform vec3 uCam;
        varying float vV; varying float vU; varying float vFade; varying float vSeed;
        void main() {
          float edge = sin(vU * 3.14159);
          edge *= edge;
          float flick = 0.6 + 0.4 * sin(uTime * (0.6 + vSeed) + vSeed * 40.0 + vU * 3.0);
          float along = smoothstep(0.0, 0.15, vV) * (1.0 - smoothstep(0.35, 1.0, vV));
          float depthK = exp(-max(uSurfaceY - uCam.y - 15.0, 0.0) * 0.04);
          float a = edge * flick * along * vFade * 0.11 * uStrength * depthK;
          gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * a, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  update(cam) { this.uniforms.uCam.value.copy(cam); }
}

// ---------------- marine snow / plankton ----------------
export class MarineSnow {
  constructor(scene, count = 1600, box = 40) {
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) { pos.set([Math.random() * box, Math.random() * box, Math.random() * box], i * 3); seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = Object.assign({ uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uPx: { value: 1 }, uVel: { value: new THREE.Vector3() }, uGlow: { value: 0 } }, UW);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute float aSeed; uniform vec3 uCam; uniform float uBox; uniform float uTime; uniform float uPx;
        varying float vA; varying float vSeed;
        void main() {
          vec3 p = position + vec3(sin(uTime * 0.2 + aSeed * 40.0) * 0.6, -uTime * (0.15 + aSeed * 0.2), cos(uTime * 0.17 + aSeed * 30.0) * 0.6);
          p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(uBox * 0.5, uBox * 0.3, length(p - uCam)) * smoothstep(0.3, 1.5, d);
          vSeed = aSeed;
          gl_PointSize = uPx * (0.6 + aSeed * 1.6) * 30.0 / max(d, 0.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uGlow; uniform float uTime; varying float vA; varying float vSeed;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = 1.0 - smoothstep(0.15, 0.5, length(c));
          vec3 col = mix(vec3(0.55, 0.7, 0.72) * 0.35, vec3(0.2, 0.9, 1.4) * (0.6 + 0.4 * sin(uTime * 2.0 + vSeed * 50.0)), uGlow * step(0.6, vSeed));
          gl_FragColor = vec4(col * r * vA, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }
  update(cam, pxScale, glow) {
    this.uniforms.uCam.value.copy(cam);
    this.uniforms.uPx.value = pxScale;
    this.uniforms.uGlow.value = glow;
  }
}

// ---------------- particles ----------------
// kinds: 0 spark (additive streak), 1 bubble (ring), 2 silt (soft cloud, normal blend), 3 chip (dark flake), 4 glow (additive soft)
const PVERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aCol; attribute vec4 aMisc; // size, life01, kind, rot
varying vec4 vCol; varying vec2 vUv; varying float vKind; varying float vLife; varying vec3 vW;
void main() {
  vec3 p = aPos;
  float size = aMisc.x; float kind = aMisc.z;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 off;
  if (kind < 0.5) {
    // velocity-aligned streak
    vec3 vdir = aVel;
    float sp = length(vdir);
    vec3 toCam = normalize(cameraPosition - p);
    vec3 ax = sp > 0.01 ? vdir / sp : camU;
    vec3 sd = normalize(cross(ax, toCam));
    off = sd * position.x * size + ax * position.y * max(size, sp * 0.035);
  } else {
    float r = aMisc.w;
    vec2 q = vec2(position.x * cos(r) - position.y * sin(r), position.x * sin(r) + position.y * cos(r));
    off = (camR * q.x + camU * q.y) * size;
  }
  vec3 w = p + off;
  vW = w;
  vCol = aCol; vUv = position.xy + 0.5; vKind = kind; vLife = aMisc.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const PFRAG = /* glsl */ `
${UW_COMMON}
varying vec4 vCol; varying vec2 vUv; varying float vKind; varying float vLife; varying vec3 vW;
uniform float uAdd;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  vec3 col = vCol.rgb; float a = vCol.a;
  if (vKind < 0.5) {            // spark
    a *= (1.0 - smoothstep(0.0, 1.0, abs(c.x) * 2.0)) * (1.0 - smoothstep(0.6, 1.0, abs(c.y) * 2.0));
  } else if (vKind < 1.5) {     // bubble: bright rim + highlight
    float rim = smoothstep(0.65, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
    float hl = 1.0 - smoothstep(0.0, 0.25, length(c - vec2(-0.18, 0.18)) * 2.0);
    a *= rim * 0.8 + hl * 0.9 + (1.0 - smoothstep(0.0, 1.0, r)) * 0.06;
  } else if (vKind < 2.5) {     // silt cloud
    a *= (1.0 - smoothstep(0.2, 1.0, r)) * 0.9;
  } else if (vKind < 3.5) {     // chip
    a *= 1.0 - smoothstep(0.7, 1.0, max(abs(c.x), abs(c.y)) * 2.0);
  } else {                      // glow
    a *= pow(1.0 - smoothstep(0.0, 1.0, r), 2.0);
  }
  float camD = length(vW - cameraPosition);
  a *= smoothstep(0.8, 3.5, camD);
  if (uAdd > 0.5) {
    float d = camD;
    gl_FragColor = vec4(col * a * exp(-d * 0.01), 1.0);
  } else {
    vec3 fc = uwApplyFog(col, vW, cameraPosition);
    gl_FragColor = vec4(fc, a);
  }
}`;

class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max;
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.misc = new Float32Array(max * 4);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.drag = new Float32Array(max);
    this.grav = new Float32Array(max); this.grow = new Float32Array(max); this.alpha0 = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aMisc = new THREE.InstancedBufferAttribute(this.misc, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos); g.setAttribute('aVel', this.aVel); g.setAttribute('aCol', this.aCol); g.setAttribute('aMisc', this.aMisc);
    g.instanceCount = 0;
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uAdd: { value: additive ? 1 : 0 } }, UW),
      vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
    scene.add(this.mesh);
    this.count = 0;
  }

  spawn(p, v, { kind = 0, size = 0.1, life = 1, color = [1, 1, 1], alpha = 1, drag = 0.5, grav = 0, grow = 0, spin = 0 }) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color[0], color[1], color[2], alpha], i * 4);
    this.misc.set([size, 0, kind, Math.random() * 6.28], i * 4);
    this.life[i] = 0; this.maxLife[i] = life; this.drag[i] = drag; this.grav[i] = grav; this.grow[i] = grow;
    this.alpha0[i] = alpha; this.spin[i] = spin;
  }

  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        // swap-remove
        n--;
        if (i !== n) {
          this.pos.copyWithin(i * 3, n * 3, n * 3 + 3); this.vel.copyWithin(i * 3, n * 3, n * 3 + 3);
          this.col.copyWithin(i * 4, n * 4, n * 4 + 4); this.misc.copyWithin(i * 4, n * 4, n * 4 + 4);
          this.life[i] = this.life[n]; this.maxLife[i] = this.maxLife[n]; this.drag[i] = this.drag[n];
          this.grav[i] = this.grav[n]; this.grow[i] = this.grow[n]; this.alpha0[i] = this.alpha0[n]; this.spin[i] = this.spin[n];
          i--;
        }
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] *= k; this.vel[j + 1] = this.vel[j + 1] * k + this.grav[i] * dt; this.vel[j + 2] *= k;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.misc[i * 4] += this.grow[i] * dt;
      this.misc[i * 4 + 1] = t;
      this.misc[i * 4 + 3] += this.spin[i] * dt;
      const fadeIn = Math.min(1, t * 8);
      this.col[i * 4 + 3] = this.alpha0[i] * fadeIn * (1 - t * t);
    }
    this.count = n;
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = true; this.aVel.needsUpdate = true; this.aCol.needsUpdate = true; this.aMisc.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, scale = 1) {
    this.add = new ParticlePool(scene, Math.round(1400 * scale), true);
    this.alpha = new ParticlePool(scene, Math.round(1600 * scale), false);
    this._v = new THREE.Vector3();
  }
  update(dt) { this.add.update(dt); this.alpha.update(dt); }

  sparks(p, dir, n, speed = 14) {
    for (let i = 0; i < n; i++) {
      const v = this._v.set(dir.x + (Math.random() - 0.5) * 1.4, dir.y + Math.random() * 0.8, dir.z + (Math.random() - 0.5) * 1.4).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      const hot = Math.random();
      this.add.spawn(p, v, { kind: 0, size: 0.025 + Math.random() * 0.02, life: 0.25 + Math.random() * 0.45, color: [6, 2.4 + hot * 2, 0.6 + hot], drag: 3.5, grav: -4 });
    }
  }
  bubbles(p, n, spread = 0.4, up = 1.5, size = 0.06) {
    for (let i = 0; i < n; i++) {
      const q = this._v.set(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.8, up * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.8);
      this.alpha.spawn(q, v, { kind: 1, size: size * (0.5 + Math.random()), life: 1.5 + Math.random() * 2, color: [0.85, 0.95, 1.0], alpha: 0.85, drag: 1.2, grav: 2.2, grow: 0.02 });
    }
  }
  silt(p, vel, n, color = [0.42, 0.40, 0.33], size = 1.2, life = 3.5) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(vel.x * 0.3 + (Math.random() - 0.5) * 2.5, Math.random() * 1.6 + 0.3, vel.z * 0.3 + (Math.random() - 0.5) * 2.5);
      this.alpha.spawn(p, v, { kind: 2, size: size * (0.6 + Math.random() * 0.6), life: life * (0.6 + Math.random() * 0.7), color, alpha: 0.35, drag: 1.6, grav: -0.15, grow: 1.1, spin: (Math.random() - 0.5) * 0.4 });
    }
  }
  chips(p, dir, n, color = [0.1, 0.1, 0.11]) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(dir.x + (Math.random() - 0.5) * 2, dir.y + Math.random() * 1.5, dir.z + (Math.random() - 0.5) * 2).multiplyScalar(6 * (0.3 + Math.random()));
      this.alpha.spawn(p, v, { kind: 3, size: 0.03 + Math.random() * 0.06, life: 1.5 + Math.random() * 1.5, color, alpha: 1, drag: 1.4, grav: -5, spin: (Math.random() - 0.5) * 20 });
    }
  }
  glow(p, color, size, life) {
    this.add.spawn(p, new THREE.Vector3(), { kind: 4, size, life, color, drag: 0 });
  }
}
