import * as THREE from 'three';
import { surfaceTexture } from './assets';

/**
 * Hand-built props for things no asset pack covers (the lift, the clock, the fireplace...).
 * Each builder returns its root plus named parts the renderer animates from game state.
 */
export interface PrimParts {
  root: THREE.Group;
  pendulum?: THREE.Object3D;
  flames?: THREE.Object3D;
  door?: THREE.Object3D;
  frost?: THREE.Object3D;
  glow?: THREE.Mesh;
  hot?: THREE.Object3D[];
}

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function wood(color = '#9a7a64', repeat = 1) {
  return mat(color, { map: surfaceTexture('floor_old.jpg', repeat, repeat) });
}

function frontDoor(): PrimParts {
  const root = new THREE.Group();
  const frame = wood('#3a2a24');
  root.add(box(1.9, 0.18, 0.2, frame, 0, 2.62, 0));
  root.add(box(0.16, 2.7, 0.2, frame, -0.9, 1.35, 0));
  root.add(box(0.16, 2.7, 0.2, frame, 0.9, 1.35, 0));
  const door = wood('#4a3128', 1.2);
  root.add(box(1.64, 2.55, 0.08, door, 0, 1.28, 0.02));
  for (const y of [0.6, 1.4, 2.1]) root.add(box(1.3, 0.05, 0.1, frame, 0, y, -0.03));
  root.add(box(0.08, 0.08, 0.1, mat('#b08a4a', { metalness: 0.8, roughness: 0.4 }), 0.62, 1.2, -0.06));
  return { root };
}

function elevator(): PrimParts {
  const root = new THREE.Group();
  const metal = mat('#8a7a6a', { map: surfaceTexture('metal', 1, 1.5), metalness: 0.6, roughness: 0.55 });
  const brass = mat('#a07840', { metalness: 0.75, roughness: 0.4 });
  root.add(box(2.6, 0.3, 0.3, brass, 0, 2.75, 0));
  root.add(box(0.25, 2.9, 0.3, brass, -1.18, 1.45, 0));
  root.add(box(0.25, 2.9, 0.3, brass, 1.18, 1.45, 0));
  const door = new THREE.Group();
  door.add(box(1.0, 2.55, 0.06, metal, -0.52, 1.28, 0.02));
  door.add(box(1.0, 2.55, 0.06, metal, 0.52, 1.28, 0.02));
  for (let i = -4; i <= 4; i += 1) door.add(box(0.025, 2.5, 0.08, brass, i * 0.24, 1.27, 0.06));
  root.add(door);
  // Floor dial above the door; the glow brightens when the lift is ready.
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20, 0, Math.PI), brass);
  dial.position.set(0, 3.0, 0.16);
  root.add(dial);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.08), new THREE.MeshBasicMaterial({ color: '#3a2a10' }));
  glow.position.set(0, 2.62, 0.17);
  root.add(glow);
  return { root, door, glow };
}

function socket(kind: 'voice' | 'touch' | 'heart'): PrimParts {
  const root = new THREE.Group();
  const brass = mat('#a07840', { metalness: 0.8, roughness: 0.35 });
  const iron = mat('#3c3632', { metalness: 0.6, roughness: 0.6 });
  root.add(box(0.48, kind === 'voice' ? 0.4 : 0.46, 0.06, iron, 0, 0, 0));
  if (kind === 'voice') {
    for (let i = -2; i <= 2; i += 1) root.add(box(0.32 - Math.abs(i) * 0.05, 0.03, 0.04, brass, 0, i * 0.06, 0.04));
  } else if (kind === 'touch') {
    root.add(box(0.16, 0.16, 0.04, brass, 0, -0.06, 0.04));
    for (let i = 0; i < 4; i += 1) root.add(box(0.03, 0.15, 0.03, brass, -0.06 + i * 0.04, 0.08, 0.04));
    const thumb = box(0.03, 0.11, 0.03, brass, -0.1, -0.02, 0.04);
    thumb.rotation.z = 0.6;
    root.add(thumb);
  } else {
    for (let i = 0; i < 5; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 12, Math.PI), iron);
      rib.rotation.set(0, 0, Math.PI / 2);
      rib.position.set(-0.12 + i * 0.06, 0, 0.05);
      rib.rotation.y = Math.PI / 2;
      root.add(rib);
    }
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: '#2a1a12' }));
  glow.position.set(0.18, 0.15, 0.04);
  root.add(glow);
  return { root, glow };
}

function stairs(down: boolean): PrimParts {
  const root = new THREE.Group();
  const step = wood('#4e3a30', 0.6);
  const rail = wood('#2e2220');
  if (!down) {
    for (let i = 0; i < 12; i += 1) root.add(box(1.8, 0.28 * (i + 1), 0.25, step, 0, 0.14 * (i + 1), 1.4 - i * 0.25));
    root.add(box(0.08, 1.0, 3.2, rail, 0.95, 2.2, 0));
    const banister = box(0.1, 0.1, 3.4, rail, 0.95, 2.4, -0.1);
    banister.rotation.x = -0.75;
    root.add(banister);
  } else {
    // A dark stairwell with a railing around it.
    root.add(box(1.8, 0.02, 3, mat('#0b0908'), 0, 0.01, 0));
    for (let i = 0; i < 4; i += 1) root.add(box(1.8, 0.2, 0.25, step, 0, -0.1 - i * 0.28, 1.3 - i * 0.25));
    root.add(box(0.08, 1.0, 3.0, rail, 0.95, 0.5, 0));
    root.add(box(1.9, 1.0, 0.08, rail, 0, 0.5, -1.5));
  }
  return { root };
}

function counter(withSink: boolean): PrimParts {
  const root = new THREE.Group();
  const body = wood('#8a6e5c');
  const top = mat('#b0aaa0', { map: surfaceTexture('floor_tiles', 1, 2) });
  const length = withSink ? 1.6 : 2.6;
  root.add(box(0.9, 0.9, length, body, 0, 0.45, 0));
  root.add(box(1.0, 0.08, length + 0.06, top, 0, 0.94, 0));
  if (withSink) {
    root.add(box(0.6, 0.06, 0.8, mat('#1a1614'), 0, 0.99, 0));
    const tap = box(0.05, 0.4, 0.05, mat('#888', { metalness: 0.9, roughness: 0.3 }), -0.35, 1.18, 0);
    root.add(tap);
  } else {
    root.add(box(0.25, 0.03, 0.5, mat('#9a9aa0', { metalness: 0.9, roughness: 0.3 }), 0, 1.0, -0.8));
    root.add(box(0.3, 0.12, 0.2, mat('#5a4a30'), 0.1, 1.04, 0.9));
  }
  return { root };
}

function pantryDoor(): PrimParts {
  const root = new THREE.Group();
  const frame = wood('#3a2a24');
  root.add(box(1.5, 0.15, 0.5, frame, 0, 2.3, 0.2));
  root.add(box(0.12, 2.3, 0.5, frame, -0.7, 1.15, 0.2));
  root.add(box(0.12, 2.3, 0.5, frame, 0.7, 1.15, 0.2));
  const hinge = new THREE.Group();
  hinge.position.set(-0.64, 0, 0.44);
  const panel = box(1.28, 2.2, 0.06, wood('#56402f', 1), 0.64, 1.1, 0);
  hinge.add(panel);
  const frost = box(1.3, 2.22, 0.02, new THREE.MeshStandardMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.55, roughness: 0.2, emissive: '#2a4060', emissiveIntensity: 0.4 }), 0.64, 1.1, 0.045);
  hinge.add(frost);
  root.add(hinge);
  return { root, door: hinge, frost };
}

function pantryShelf(): PrimParts {
  const root = new THREE.Group();
  const shelf = wood('#3e2e26');
  root.add(box(1.28, 2.2, 0.04, mat('#140f0d'), 0, 1.1, 0.04));
  root.add(box(1.2, 0.04, 0.34, shelf, 0, 1.08, 0.24));
  root.add(box(1.2, 0.04, 0.34, shelf, 0, 1.6, 0.24));
  for (let i = 0; i < 4; i += 1) root.add(box(0.12, 0.2, 0.12, mat('#6a7a5a', { transparent: true, opacity: 0.7 }), -0.45 + i * 0.3, 1.72, 0.24));
  return { root };
}

function clock(): PrimParts {
  const root = new THREE.Group();
  const body = wood('#3a2620', 0.5);
  root.add(box(0.7, 2.3, 0.45, body, 0, 1.15, 0));
  root.add(box(0.8, 0.2, 0.5, body, 0, 2.38, 0));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), mat('#d8cfb8'));
  face.position.set(0, 1.95, 0.231);
  root.add(face);
  root.add(box(0.02, 0.18, 0.01, mat('#111'), 0, 2.0, 0.24));
  root.add(box(0.14, 0.02, 0.01, mat('#111'), 0.05, 1.95, 0.24));
  root.add(box(0.46, 1.05, 0.02, new THREE.MeshStandardMaterial({ color: '#1a1410', transparent: true, opacity: 0.6 }), 0, 1.05, 0.231));
  const pendulum = new THREE.Group();
  pendulum.position.set(0, 1.5, 0.15);
  const brass = mat('#b08a40', { metalness: 0.8, roughness: 0.35 });
  pendulum.add(box(0.02, 0.7, 0.02, brass, 0, -0.35, 0));
  const bob = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), brass);
  bob.position.set(0, -0.75, 0.01);
  pendulum.add(bob);
  root.add(pendulum);
  return { root, pendulum };
}

function fireplace(): PrimParts {
  const root = new THREE.Group();
  const stone = mat('#8a7e74', { map: surfaceTexture('stone', 1.5, 1) });
  root.add(box(2.4, 0.25, 0.9, stone, 0, 1.6, 0.05));
  root.add(box(0.4, 1.5, 0.8, stone, -1.0, 0.75, 0));
  root.add(box(0.4, 1.5, 0.8, stone, 1.0, 0.75, 0));
  root.add(box(1.6, 0.3, 0.8, stone, 0, 1.35, 0));
  root.add(box(1.6, 1.2, 0.1, mat('#0e0a08'), 0, 0.6, -0.35));
  root.add(box(1.6, 0.06, 0.8, mat('#1a1410'), 0, 0.03, 0));
  const flames = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0.9 });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffe080' });
  for (let i = 0; i < 5; i += 1) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1 + (i % 2) * 0.05, 0.5 + (i % 3) * 0.15, 6), i % 2 ? coreMat : flameMat);
    flame.position.set(-0.45 + i * 0.22, 0.3, -0.05 + (i % 2) * 0.1);
    flames.add(flame);
  }
  for (let i = 0; i < 3; i += 1) flames.add(box(0.6, 0.1, 0.1, mat('#2a1a10'), -0.2 + i * 0.2, 0.08, (i - 1) * 0.12));
  root.add(flames);
  return { root, flames, hot: [flames] };
}

function mirror(tall: boolean): PrimParts {
  const root = new THREE.Group();
  const w = tall ? 1.1 : 0.9;
  const h = tall ? 1.8 : 1.0;
  const y = tall ? 1.6 : 1.65;
  const frame = mat('#1e1614', { roughness: 0.5 });
  root.add(box(w + 0.16, h + 0.16, 0.06, frame, 0, y, 0));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#8a9aa8', metalness: 0.9, roughness: 0.08, envMapIntensity: 1 }));
  glass.position.set(0, y, 0.035);
  root.add(glass);
  const frost = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#dfe8f0', transparent: true, opacity: 0 }));
  frost.position.set(0, y, 0.04);
  root.add(frost);
  // The handprint itself; only shown under UV once revealed.
  const glow = new THREE.Mesh(handprintGeometry(0.42), new THREE.MeshBasicMaterial({ color: '#c070ff', transparent: true, opacity: 0.95 }));
  glow.position.set(0.1, y + 0.1, 0.045);
  glow.visible = false;
  root.add(glow);
  return { root, frost, glow };
}

let cachedPrint: THREE.BufferGeometry | null = null;
export function handprintGeometry(size = 0.3): THREE.BufferGeometry {
  if (!cachedPrint) {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, 0.32, 0.38, 0, Math.PI * 2, false, 0);
    const parts: THREE.BufferGeometry[] = [new THREE.ShapeGeometry(shape, 10)];
    const fingers: [number, number, number, number][] = [[-0.26, 0.5, 0.07, 0.26], [-0.09, 0.62, 0.07, 0.3], [0.09, 0.6, 0.07, 0.29], [0.25, 0.48, 0.065, 0.24], [0.42, 0.02, 0.07, 0.2]];
    for (const [x, y, rx, ry] of fingers) {
      const finger = new THREE.Shape();
      finger.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
      const geometry = new THREE.ShapeGeometry(finger, 8);
      geometry.translate(x, y, 0);
      parts.push(geometry);
    }
    const merged = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (const part of parts) {
      const nonIndexed = part.toNonIndexed();
      positions.push(...(nonIndexed.attributes.position.array as Float32Array));
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cachedPrint = merged;
  }
  const geometry = cachedPrint.clone();
  geometry.scale(size, size, size);
  return geometry;
}

function floorHandprint(): PrimParts {
  const root = new THREE.Group();
  const print = new THREE.Mesh(handprintGeometry(0.28), new THREE.MeshBasicMaterial({ color: '#b060ff', transparent: true, opacity: 0.85 }));
  print.rotation.x = -Math.PI / 2;
  root.add(print);
  return { root };
}

function watch(): PrimParts {
  const root = new THREE.Group();
  const brass = mat('#c09a50', { metalness: 0.85, roughness: 0.3 });
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 18), brass);
  root.add(caseMesh);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), mat('#e6dcc6'));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.017;
  root.add(face);
  const hand = box(0.008, 0.002, 0.06, mat('#111'), 0, 0.02, 0.02);
  root.add(hand);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 4, 16, Math.PI), brass);
  chain.rotation.x = Math.PI / 2;
  chain.position.set(-0.1, 0, 0.05);
  root.add(chain);
  return { root, pendulum: hand };
}

function weddingPortrait(): PrimParts {
  const root = new THREE.Group();
  root.add(box(1.5, 1.5, 0.08, mat('#3a2818', { metalness: 0.4, roughness: 0.5 }), 0, 0, 0));
  root.add(box(1.3, 1.3, 0.02, mat('#2a2a30'), 0, 0, 0.045));
  const groom = box(0.22, 1.05, 0.01, mat('#141012'), -0.2, -0.05, 0.06);
  root.add(groom);
  root.add(box(0.18, 0.22, 0.01, mat('#b8b0a0'), -0.2, 0.52, 0.065));
  root.add(box(0.36, 0.6, 0.01, mat('#d8d2c8'), 0.22, -0.28, 0.06));
  const veil = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), mat('#e8e4dc'));
  veil.position.set(0.22, 0.12, 0.066);
  root.add(veil);
  return { root };
}

function crib(): PrimParts {
  const root = new THREE.Group();
  const white = mat('#bdb2a6', { map: surfaceTexture('wall_paper', 0.5, 0.5) });
  root.add(box(1.3, 0.08, 0.75, white, 0, 0.4, 0));
  root.add(box(1.2, 0.06, 0.66, mat('#7a8aa0'), 0, 0.46, 0));
  for (let i = 0; i <= 10; i += 1) {
    root.add(box(0.03, 0.55, 0.03, white, -0.62 + i * 0.124, 0.68, 0.35));
    root.add(box(0.03, 0.55, 0.03, white, -0.62 + i * 0.124, 0.68, -0.35));
  }
  root.add(box(1.3, 0.04, 0.04, white, 0, 0.96, 0.35));
  root.add(box(1.3, 0.04, 0.04, white, 0, 0.96, -0.35));
  for (const x of [-0.64, 0.64]) for (const z of [-0.36, 0.36]) root.add(box(0.06, 1.0, 0.06, white, x, 0.5, z));
  return { root };
}

function bathtub(): PrimParts {
  const root = new THREE.Group();
  const enamel = mat('#c8c2b8', { roughness: 0.4 });
  root.add(box(0.9, 0.6, 2.0, enamel, 0, 0.42, 0));
  root.add(box(0.74, 0.02, 1.84, new THREE.MeshStandardMaterial({ color: '#050404', roughness: 0.05, metalness: 0.3 }), 0, 0.7, 0));
  for (const x of [-0.35, 0.35]) for (const z of [-0.85, 0.85]) root.add(box(0.08, 0.12, 0.08, mat('#a08850', { metalness: 0.8 }), x, 0.06, z));
  return { root };
}

function windowPrim(round: boolean): PrimParts {
  const root = new THREE.Group();
  const frame = wood('#2a201c');
  const dark = new THREE.MeshBasicMaterial({ color: '#05070c' });
  const moon = new THREE.MeshBasicMaterial({ color: '#1c2638', transparent: true, opacity: 0.85 });
  if (round) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 24), frame);
    ring.position.y = 1.5;
    root.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), moon);
    glass.position.set(0, 1.5, -0.02);
    root.add(glass);
    root.add(box(0.05, 1.8, 0.05, frame, 0, 1.5, 0));
    root.add(box(1.8, 0.05, 0.05, frame, 0, 1.5, 0));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: '#c8d4e8' }));
    disc.position.set(0.35, 1.85, -0.03);
    root.add(disc);
    return { root, glow: glass };
  }
  root.add(box(1.3, 1.7, 0.02, dark, 0, 1.6, -0.03));
  root.add(box(1.2, 1.6, 0.01, moon, 0, 1.6, -0.02));
  for (const x of [-0.65, 0, 0.65]) root.add(box(0.07, 1.8, 0.1, frame, x, 1.6, 0));
  for (const y of [0.72, 1.6, 2.48]) root.add(box(1.4, 0.07, 0.1, frame, 0, y, 0));
  root.add(box(1.5, 0.08, 0.25, frame, 0, 0.7, 0.08));
  return { root };
}

function rug(): PrimParts {
  const root = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), mat('#5a2a2e', { map: surfaceTexture('wall_paper', 2, 1.3) }));
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.y = 0.012;
  root.add(cloth);
  const border = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 4, 1, Math.PI / 4), mat('#2a1416'));
  border.rotation.x = -Math.PI / 2;
  border.scale.set(1.84, 1.2, 1);
  border.position.y = 0.014;
  root.add(border);
  return { root };
}

function chalkRing(): PrimParts {
  const root = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.76, 32), new THREE.MeshBasicMaterial({ color: '#d8d0c0', transparent: true, opacity: 0.7 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  root.add(ring);
  return { root };
}

export function buildPrim(name: string): PrimParts {
  switch (name) {
    case 'frontDoor': return frontDoor();
    case 'elevator': return elevator();
    case 'socketVoice': return socket('voice');
    case 'socketTouch': return socket('touch');
    case 'socketHeart': return socket('heart');
    case 'stairsUp': return stairs(false);
    case 'stairsDown': return stairs(true);
    case 'counter': return counter(false);
    case 'sink': return counter(true);
    case 'pantryDoor': return pantryDoor();
    case 'pantryShelf': return pantryShelf();
    case 'clock': return clock();
    case 'fireplace': return fireplace();
    case 'mirror': return mirror(true);
    case 'smallMirror': return mirror(false);
    case 'watch': return watch();
    case 'weddingPortrait': return weddingPortrait();
    case 'crib': return crib();
    case 'bathtub': return bathtub();
    case 'handprint': return floorHandprint();
    case 'window': return windowPrim(false);
    case 'roundWindow': return windowPrim(true);
    case 'chalkRing': return chalkRing();
    case 'rug': return rug();
    default: return { root: new THREE.Group() };
  }
}

/** Small glowing token for evidence sitting in a socket or on a prop. */
export function evidenceToken(itemId: string): THREE.Mesh {
  const colors: Record<string, string> = {
    ev_voice: '#a0c8ff',
    ev_heart: '#ff4060',
    ev_print: '#c070ff',
    ev_ticking: '#ffd080',
    ev_fire: '#ff8a30',
    ev_breath: '#ffa040',
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: colors[itemId] ?? '#ffffff' }));
  mesh.name = `token_${itemId}`;
  return mesh;
}
