import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Asset loading for the view layer. Loaders are imported lazily so the first frame does
 * not wait on them, and every source file is fetched once and cloned after that.
 *
 * The FBX packs reference textures by absolute paths from the artists' machines, so each
 * pack gets a LoadingManager that redirects any texture request to the file of the same
 * name in that pack's public folder.
 */

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const fileCache = new Map<string, Promise<unknown>>();

export function surfaceTexture(name: string, repeatX: number, repeatY: number): THREE.Texture {
  const ext = name.includes('.') ? '' : name === 'floor_old' ? '.jpg' : '.png';
  const url = `/textures/house/${name}${ext}`;
  let base = textureCache.get(url);
  if (!base) {
    base = textureLoader.load(url);
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = THREE.RepeatWrapping;
    base.wrapT = THREE.RepeatWrapping;
    // Crisp PS1-style texels: matches the low-poly monsters and devices.
    base.magFilter = THREE.NearestFilter;
    base.anisotropy = 4;
    textureCache.set(url, base);
  }
  const texture = base.clone();
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function packManager(dir: string): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (!/\.(png|jpe?g|tga)$/i.test(url)) return url;
    const base = url.split(/[\\/]/).pop() ?? url;
    return `${dir}/${base}`;
  });
  return manager;
}

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = fileCache.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load();
    fileCache.set(key, pending);
  }
  return pending;
}

export function loadGLTF(url: string): Promise<GLTF> {
  return once(url, async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    return new GLTFLoader().loadAsync(url);
  });
}

export function loadFBX(url: string): Promise<THREE.Group> {
  return once(url, async () => {
    const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
    const dir = url.slice(0, url.lastIndexOf('/'));
    return new FBXLoader(packManager(dir)).loadAsync(url);
  });
}

export async function cloneSkinned(source: THREE.Object3D): Promise<THREE.Object3D> {
  const { clone } = await import('three/addons/utils/SkeletonUtils.js');
  return clone(source);
}

/** Scale an object so its largest dimension (or its height) matches `size`, feet on y = 0. */
export function fitObject(object: THREE.Object3D, size: number, by: 'max' | 'height' = 'max'): THREE.Object3D {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const dims = box.getSize(new THREE.Vector3());
  const measure = by === 'height' ? dims.y : Math.max(dims.x, dims.y, dims.z);
  if (measure > 0) object.scale.multiplyScalar(size / measure);
  object.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(object);
  const center = fitted.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= fitted.min.y;
  const wrapper = new THREE.Group();
  wrapper.add(object);
  return wrapper;
}

/** Push bright stylised colours toward a dusty, desaturated palette. */
export function weather(object: THREE.Object3D, tint: string | undefined, receive = true): void {
  // Tints are authored as sRGB hex "how much of the original colour to keep".
  const color = tint ? new THREE.Color(tint).convertLinearToSRGB() : null;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = false;
    child.receiveShadow = receive;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const replaced = materials.map((material) => {
      const source = material as THREE.MeshStandardMaterial & THREE.MeshPhongMaterial;
      const next = new THREE.MeshStandardMaterial({
        map: source.map ?? null,
        color: source.color ? source.color.clone() : new THREE.Color('#ffffff'),
        roughness: 0.92,
        metalness: 0.05,
        transparent: source.transparent,
        alphaTest: source.alphaTest || (source.transparent ? 0.3 : 0),
        side: source.side,
      });
      if (next.map) next.map.colorSpace = THREE.SRGBColorSpace;
      if (color) next.color.multiply(color);
      return next;
    });
    child.material = Array.isArray(child.material) ? replaced : replaced[0];
  });
}

/** Halloween pack: one FBX scene containing every prop. Each named mesh is extracted on demand. */
export async function halloweenPiece(name: string): Promise<THREE.Object3D | null> {
  const scene = await loadFBX('/models/halloween/halloween.fbx');
  scene.updateMatrixWorld(true);
  const source = scene.getObjectByName(name);
  if (!(source instanceof THREE.Mesh)) return null;
  const geometry = (source.geometry as THREE.BufferGeometry).clone();
  geometry.applyMatrix4(source.matrixWorld);
  const mesh = new THREE.Mesh(geometry, source.material);
  mesh.name = name;
  return mesh;
}

export async function kaykitPiece(name: string): Promise<THREE.Object3D> {
  const gltf = await loadGLTF(`/models/furniture/${name}.gltf`);
  return gltf.scene.clone(true);
}

const DEVICE_FILES: Record<string, string> = {
  tool_recorder: 'voice_recorder',
  tool_uv: 'uv_flashlight',
  tool_emf: 'emf_detector',
  tool_thermal: 'thermal_camera',
  tool_camera: 'photo_camera',
  flashlight: 'flashlight',
};

export async function devicePiece(toolId: string, size: number): Promise<THREE.Object3D | null> {
  const file = DEVICE_FILES[toolId];
  if (!file) return null;
  const source = await loadFBX(`/models/devices/${file}.fbx`);
  const copy = source.clone(true);
  weather(copy, undefined, false);
  return fitObject(copy, size);
}
