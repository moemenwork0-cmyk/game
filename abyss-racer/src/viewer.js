// Debug car viewer: ?view=car&car=marlin&yaw=0.6&pitch=0.25&dist=7
import * as THREE from 'three';
import { UW } from './render/underwater.js';
import { patchMaterial } from './render/underwater.js';
import { createWaterSky, createEnvMap } from './render/environment.js';
import { PostFX } from './render/post.js';
import { loadCars, loaded, loadTexture, loadPBR } from './core/assets.js';
import { CarVisual } from './car/carmodel.js';

export async function runViewer(canvas, params) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  UW.uCaustics.value = await loadTexture('tex/caustics.png', { aniso: 4 });
  UW.uSurfaceY.value = Number(params.get('surface') ?? 30);
  const scene = new THREE.Scene();
  scene.add(createWaterSky());
  const env = createEnvMap(renderer);
  const ids = ['marlin', 'orca', 'barracuda'];
  await loadCars(ids);
  const sand = await loadPBR('coast_sand_01');
  for (const t of [sand.map, sand.normalMap, sand.arm]) t.repeat.set(30, 30);
  const groundMat = patchMaterial(new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughnessMap: sand.arm, aoMap: sand.arm }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sun = new THREE.DirectionalLight(0xbfe8ff, 2.2);
  sun.position.copy(UW.uSunDir.value).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x5fb7d0, 0x1a2a30, 0.9));
  const which = params.get('car') || 'all';
  const liveries = [
    { paint: 0xd8dde3, accent: 0xff4a1a, accent2: 0x111111, stripe: 1, number: 7, rim: 0x2a2c30, caliper: 0xff5a10 },
    { paint: 0x0a3d91, accent: 0xf2c200, accent2: 0x0a0a0a, stripe: 2, number: 23, rim: 0xc8a050, caliper: 0xf2c200 },
    { paint: 0xc4161c, accent: 0xffffff, accent2: 0x111111, stripe: 1, number: 3, rim: 0xb0b5bb, caliper: 0xe0e0e0 },
  ];
  const cars = [];
  (which === 'all' ? ids : [which]).forEach((id, i, arr) => {
    const v = new CarVisual({ id, meta: loaded.carMeta[id], geo: loaded.cars[id], envMap: env, livery: liveries[ids.indexOf(id)] });
    v.group.position.x = (i - (arr.length - 1) / 2) * 2.8;
    scene.add(v.group);
    cars.push(v);
  });
  if (params.get('dent')) {
    const c = cars[0];
    c.deform(new THREE.Vector3(0.6, 0.5, 2.2), new THREE.Vector3(-0.3, -0.1, -1), 0.25, 0.7);
    c.deform(new THREE.Vector3(-1.0, 0.6, -0.2), new THREE.Vector3(1, 0, 0), 0.15, 0.8);
  }
  const camera = new THREE.PerspectiveCamera(Number(params.get('fov') ?? 40), innerWidth / innerHeight, 0.1, 1000);
  const yaw = Number(params.get('yaw') ?? 0.7), pitch = Number(params.get('pitch') ?? 0.22), dist = Number(params.get('dist') ?? (which === 'all' ? 11 : 7));
  const target = new THREE.Vector3(0, 0.6, 0);
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist + 0.6, Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(target);
  const post = new PostFX(renderer, { msaa: 4 });
  post.setSize(innerWidth, innerHeight);
  let t = 0, frames = 0;
  const still = params.has('still');
  const loop = () => {
    t += 1 / 60;
    UW.uTime.value = t;
    post.render(scene, camera, t);
    if (++frames === 3) window.__ready = true;
    if (!still || frames < 3) requestAnimationFrame(loop);
  };
  loop();
}
