// Asset loading with progress reporting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const base = './assets/';
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager);
export const loaded = { textures: {}, models: {}, cars: {}, carMeta: null };
let onProgress = () => {};
manager.onProgress = (url, done, total) => onProgress(done / Math.max(total, 1), url);
export function setProgressHandler(fn) { onProgress = fn; }

export function loadTexture(path, { srgb = false, repeat = true, aniso = 8 } = {}) {
  return new Promise((res, rej) => {
    texLoader.load(base + path, (t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      res(t);
    }, undefined, rej);
  });
}

export function loadGLTF(path) {
  return new Promise((res, rej) => gltfLoader.load(base + path, res, undefined, rej));
}

export async function loadJSON(path) {
  const r = await fetch(base + path);
  return r.json();
}

/** PBR texture set (diffuse sRGB, GL normal, ARM). */
export async function loadPBR(name) {
  const [map, normalMap, arm] = await Promise.all([
    loadTexture(`tex/${name}/diff.jpg`, { srgb: true }),
    loadTexture(`tex/${name}/nor.jpg`),
    loadTexture(`tex/${name}/arm.jpg`),
  ]);
  return { map, normalMap, arm };
}

export async function loadCars(ids) {
  loaded.carMeta = loaded.carMeta || await loadJSON('cars/cars.json');
  await Promise.all(ids.map(async (id) => {
    if (loaded.cars[id]) return;
    const g = await loadGLTF(`cars/${id}.glb`);
    let geo = null;
    g.scene.traverse((o) => { if (o.isMesh && !geo) geo = o.geometry; });
    geo.deleteAttribute('uv');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    loaded.cars[id] = geo;
  }));
}
