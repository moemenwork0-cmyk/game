// Water "sky": the open water around the camera (scatter colour by view direction, Snell's window and
// the rippling surface overhead) + a pre-filtered environment map for reflections on paint and metal.
import * as THREE from 'three';
import { UW, UW_COMMON } from './underwater.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * 900.0, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
${UW_COMMON}
varying vec3 vDir;
uniform float uEnvMode;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 cam = uEnvMode > 0.5 ? vec3(0.0, uSurfaceY - 25.0, 0.0) : cameraPosition;
  vec3 col = uwScatterColor(cam, d);
  float depth = max(uSurfaceY - cam.y, 0.0);
  float dm = uwDepthMix(cam.y);
  // Snell's window: the sky compressed into a 97 degree cone overhead, bright and rippling
  float cosA = d.y;
  float window = smoothstep(0.62, 0.70, cosA);
  if (cosA > 0.0) {
    float t = (uSurfaceY - cam.y) / max(cosA, 0.05);
    vec2 sp = cam.xz + d.xz * t;
    float rip = noise(sp * 0.35 + uTime * 0.3) * 0.6 + noise(sp * 1.3 - uTime * 0.5) * 0.4;
    float win = window * (0.75 + 0.5 * rip);
    float sun = pow(max(dot(d, uSunDir), 0.0), 220.0) * 30.0 + pow(max(dot(d, uSunDir), 0.0), 18.0) * 2.0;
    vec3 surf = vec3(0.75, 0.95, 1.0) * win * 2.2 + vec3(1.0, 0.95, 0.85) * sun * window;
    // total internal reflection band outside the window: faint mirrored darkness
    float tir = (1.0 - window) * smoothstep(0.15, 0.6, cosA) * (0.2 + 0.25 * rip);
    surf += uScatterTop * tir * 0.5;
    float att = exp(-depth * 0.045);
    col += surf * att * (1.0 - dm * 0.8);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createWaterSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uEnvMode: { value: 0 } }, UW),
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'waterSky';
  return mesh;
}

/** Environment map for reflections: the water sky plus a few soft light panels (surface glints). */
export function createEnvMap(renderer) {
  const scene = new THREE.Scene();
  const sky = createWaterSky();
  sky.material = sky.material.clone();
  sky.material.uniforms = Object.assign({}, UW, { uEnvMode: { value: 1 } });
  sky.material.depthTest = false;
  scene.add(sky);
  // bright soft panels overhead / sides give paint and glass shape-defining highlights
  const panelMat = (i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(i), side: THREE.DoubleSide });
  const addPanel = (w, h, pos, look, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), panelMat(i));
    m.position.copy(pos); m.lookAt(look); scene.add(m);
  };
  addPanel(30, 8, new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, 0, 0), 6);
  addPanel(20, 4, new THREE.Vector3(30, 20, 10), new THREE.Vector3(0, 0, 0), 2.2);
  addPanel(20, 4, new THREE.Vector3(-30, 18, -10), new THREE.Vector3(0, 0, 0), 1.6);
  addPanel(60, 2, new THREE.Vector3(0, 6, -40), new THREE.Vector3(0, 0, 0), 1.0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cam = new THREE.CubeCamera(0.1, 2000, new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }));
  scene.add(cam);
  cam.update(renderer, scene);
  const env = pmrem.fromCubemap(cam.renderTarget.texture).texture;
  pmrem.dispose();
  cam.renderTarget.dispose();
  return env;
}
