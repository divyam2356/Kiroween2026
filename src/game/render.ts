import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { checkAll, isActive, isInteractable, isLocked, isPropVisible } from './core';
import { cloneSkinned, devicePiece, fitObject, halloweenPiece, kaykitPiece, loadFBX, loadGLTF, surfaceTexture, weather } from './assets';
import { buildPrim, evidenceToken, type PrimParts } from './prims';
import type { GameState, PropDef, RoomDef } from './types';
import {
  CEILING, FLOOR_HEIGHT, HOLLOW_GLIMPSE_GRID, SHAFT, START, decor, doorways, lights, placements, roomsLayout, specterNodes,
  type Decor, type LightDef, type ModelRef, type Placement, type RoomZone, type Vec3,
} from '../scenes/houseLayout';

export interface RenderCallbacks {
  onInteract?: () => void;
  onUndo?: () => void;
  onSelectTool?: (slot: number) => void;
  onCycleTool?: (direction: number) => void;
  onFlashlight?: () => void;
  onJournal?: () => void;
  onRestart?: () => void;
  onTargetChange?: (propId: string | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onGlimpse?: () => void;
}

interface Box2 { minX: number; maxX: number; minZ: number; maxZ: number }

interface PropView {
  def: PropDef;
  placement: Placement;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  parts: PrimParts | null;
  anchor: THREE.Group;
  anchorItem: string | null;
  floor: number;
}

interface LightSlot { light: THREE.PointLight; def: LightDef | null; phase: number }

/** Static geometry waiting to be merged: one draw call per (floor, material). */
interface StaticBatch { floor: number; material: THREE.Material; geometries: THREE.BufferGeometry[]; isWall: boolean }

interface Monster { root: THREE.Object3D; actions: Record<string, THREE.AnimationAction>; materials: THREE.Material[]; meshes: THREE.Mesh[] }

const CENTER = new THREE.Vector2(0, 0);
const MAX_PIXEL_RATIO = 1.5;
const MIN_PIXEL_RATIO = 0.75;
const EYE = 1.65;
const RADIUS = 0.3;
const REACH = 3.2;
const HOT_LAYER = 1;
const GLIMPSE_LIFE = 4.5;
/** Monsters glow by their own rules; they are never given the interaction highlight. */
const ANOMALY_IDS = new Set(['hollow', 'specter', 'carver']);
const DENSE_MOTE_PROPS = new Set(['dining_clock', 'hall_coffin']);

/** Box UVs in world units so one tiled texture and one material can be shared by every wall. */
function tileBox(geometry: THREE.BufferGeometry, w: number, h: number, d: number, tile: number): void {
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const scale: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face += 1) {
    for (let i = 0; i < 4; i += 1) {
      const index = face * 4 + i;
      uv.setXY(index, uv.getX(index) * scale[face][0] / tile, uv.getY(index) * scale[face][1] / tile);
    }
  }
}

function tilePlane(geometry: THREE.BufferGeometry, w: number, h: number, tile: number): void {
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
}

export class GameRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
  readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: RenderCallbacks;
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Timer();
  private readonly keys = new Set<string>();
  private readonly floors: THREE.Group[] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  private readonly car = new THREE.Group();
  private readonly colliders: Box2[][] = [[], [], []];
  private readonly targets: THREE.Object3D[][] = [[], [], []];
  private readonly carTargets: THREE.Object3D[] = [];
  private readonly targetsWithCar: THREE.Object3D[][] = [[], [], []];
  private readonly propViews = new Map<string, PropView>();
  private readonly flies = new Map<string, THREE.Sprite[]>();
  private glowTexture: THREE.CanvasTexture | null = null;
  /** Post-processing for the white outline. Loaded lazily; until then nothing is outlined. */
  private composer: { render(delta?: number): void; setSize(w: number, h: number): void; setPixelRatio(r: number): void } | null = null;
  private outlinePass: { selectedObjects: THREE.Object3D[] } | null = null;
  private outlined: string[] = [];
  /** Per-prop cloned materials that breathe a warm emissive glow while the prop is usable. */
  private readonly glowMats = new Map<string, THREE.MeshStandardMaterial[]>();
  private readonly glowColor = new THREE.Color('#ffb070');
  private readonly lightSlots: LightSlot[] = [];
  private readonly revealDecor: { object: THREE.Object3D; tool: string }[] = [];
  private readonly mixers: { mixer: THREE.AnimationMixer; floor: number }[] = [];
  private readonly batches = new Map<string, StaticBatch>();
  private readonly materials = new Map<string, THREE.Material>();
  private readonly pendingLoads: (() => Promise<void>)[][] = [[], [], []];
  private readonly floorLoaded = [false, false, false];
  private readonly hits: THREE.Intersection[] = [];
  private readonly thermalCold = new THREE.MeshLambertMaterial({ color: '#3a5ad0', emissive: '#0e1a58' });
  private readonly thermalHot = new THREE.MeshBasicMaterial({ color: '#ffd060' });
  private readonly flashlight = new THREE.SpotLight('#fff1d8', 0, 20, 0.5, 0.55, 1.4);
  private readonly viewmodel = new THREE.Group();
  private readonly viewmodels = new Map<string, THREE.Object3D>();
  private readonly tmp = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly glimpseGrid: Vec3[] = [];

  private room: RoomDef | null = null;
  private state: GameState | null = null;
  private floor = 0;
  private carFloor = 0;
  private yaw = START.yaw;
  private pitch = 0;
  private bob = 0;
  private controlsActive = false;
  private targetPropId: string | null = null;
  private outlineRefresh = 0;
  private selectedTool: string | null = null;
  private frame = 0;
  private pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  private frameTimeSum = 0;
  private frameCount = 0;

  private hollow: Monster | null = null;
  private echo: Monster | null = null;
  private echoTimer = 5;
  private echoLife = 0;
  private specter: Monster | null = null;
  private specterNode = 0;
  private specterClock = 0;
  private specterOpacity = 0;
  private carver: { root: THREE.Object3D } | null = null;
  private carverFall = 0;
  private hollowDead = false;
  private chalk: THREE.Object3D | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: RenderCallbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.pixelRatio);

    this.scene.background = new THREE.Color('#0d0a0c');
    this.scene.fog = new THREE.Fog('#100c0e', 7, 30);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.scene.add(new THREE.HemisphereLight('#e2d6ca', '#6a605c', 1.9));
    this.flashlight.position.set(0.15, -0.1, 0);
    this.flashlight.target.position.set(0, -0.05, -1);
    this.camera.add(this.flashlight, this.flashlight.target);
    this.viewmodel.position.set(0.32, -0.28, -0.55);
    this.camera.add(this.viewmodel);

    for (const group of this.floors) this.scene.add(group);
    this.scene.add(this.car);

    // A fixed pool of lights, re-aimed when you change floors. Keeping the light count
    // constant means the shaders never recompile mid-game.
    const poolSize = Math.max(...[0, 1, 2].map((f) => lights.filter((l) => l.floor === f).length));
    for (let i = 0; i < poolSize; i += 1) {
      const light = new THREE.PointLight('#ffffff', 0, 10, 1.6);
      this.scene.add(light);
      this.lightSlots.push({ light, def: null, phase: Math.random() * 10 });
    }

    this.bindInput();
    void this.loadOutline().catch((error) => console.warn('Outline unavailable', error));
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  // ── Building the house ──────────────────────────────────────────

  build(room: RoomDef, state: GameState): void {
    this.room = room;
    this.state = state;
    for (const zone of roomsLayout) this.buildRoom(zone);
    this.buildShaft();
    this.flushBatches();
    for (const def of room.props) this.addProp(def);
    for (const item of decor) this.addDecor(item);
    this.pendingLoads[0].push(() => this.loadHollow());
    this.pendingLoads[1].push(() => this.loadSpecter());
    this.pendingLoads[2].push(() => this.loadCarver());
    this.buildGlimpseGrid();
    void this.loadViewmodels();
    this.teleport(0, START.pos, START.yaw);
    this.syncState(state);
    // Ground floor loads now. The other floors stream in quietly once the game is running.
    window.setTimeout(() => this.ensureFloorLoaded(1), 2500);
    window.setTimeout(() => this.ensureFloorLoaded(2), 6000);
  }

  private ensureFloorLoaded(floor: number): void {
    if (this.floorLoaded[floor]) return;
    this.floorLoaded[floor] = true;
    for (const load of this.pendingLoads[floor]) void load();
    this.pendingLoads[floor].length = 0;
  }

  private floorY(floor: number): number {
    return floor * FLOOR_HEIGHT;
  }

  private sharedMaterial(key: string, make: () => THREE.Material): THREE.Material {
    let material = this.materials.get(key);
    if (!material) {
      material = make();
      this.materials.set(key, material);
    }
    return material;
  }

  private surface(tex: string, tint: string, roughness = 0.9): THREE.Material {
    return this.sharedMaterial(`surface|${tex}|${tint}`, () => new THREE.MeshStandardMaterial({ map: surfaceTexture(tex, 1, 1), color: tint, roughness }));
  }

  private plain(color: string): THREE.Material {
    return this.sharedMaterial(`plain|${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  }

  private batch(floor: number, material: THREE.Material, geometry: THREE.BufferGeometry, isWall = false): void {
    const key = `${floor}|${material.uuid}|${isWall}`;
    let entry = this.batches.get(key);
    if (!entry) {
      entry = { floor, material, geometries: [], isWall };
      this.batches.set(key, entry);
    }
    entry.geometries.push(geometry);
  }

  private flushBatches(): void {
    for (const entry of this.batches.values()) {
      const merged = mergeGeometries(entry.geometries, false);
      for (const geometry of entry.geometries) geometry.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, entry.material);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.floors[entry.floor].add(mesh);
      if (entry.isWall) {
        mesh.userData.wall = true;
        this.targets[entry.floor].push(mesh);
      }
    }
    this.batches.clear();
  }

  private placed(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotX = 0): THREE.BufferGeometry {
    if (rotX) geometry.rotateX(rotX);
    geometry.translate(x, y, z);
    return geometry;
  }

  private buildRoom(zone: RoomZone): void {
    const y = this.floorY(zone.floor);
    const height = CEILING[zone.floor];
    const width = zone.x[1] - zone.x[0];
    const depth = zone.z[1] - zone.z[0];
    const cx = (zone.x[0] + zone.x[1]) / 2;
    const cz = (zone.z[0] + zone.z[1]) / 2;

    const floorGeo = new THREE.PlaneGeometry(width, depth);
    tilePlane(floorGeo, width, depth, 1.6);
    this.batch(zone.floor, this.surface(zone.floorTex, '#c8b8a8', 0.95), this.placed(floorGeo, cx, y, cz, -Math.PI / 2));

    const ceilGeo = new THREE.PlaneGeometry(width, depth);
    tilePlane(ceilGeo, width, depth, 2.5);
    this.batch(zone.floor, this.surface('wall_stripe', '#857a72', 1), this.placed(ceilGeo, cx, y + height, cz, Math.PI / 2));

    const inset = 0.08;
    const thick = 0.14;
    const wallMat = this.surface(zone.wall, zone.wallTint ?? '#b0a296');
    const edges: { axis: 'x' | 'z'; at: number; from: number; to: number; inward: number }[] = [
      { axis: 'z', at: zone.z[0], from: zone.x[0], to: zone.x[1], inward: 1 },
      { axis: 'z', at: zone.z[1], from: zone.x[0], to: zone.x[1], inward: -1 },
      { axis: 'x', at: zone.x[0], from: zone.z[0], to: zone.z[1], inward: 1 },
      { axis: 'x', at: zone.x[1], from: zone.z[0], to: zone.z[1], inward: -1 },
    ];
    for (const edge of edges) {
      const gaps = doorways
        .filter((d) => d.floor === zone.floor && d.axis === edge.axis && Math.abs(d.at - edge.at) < 0.01 && d.to > edge.from && d.from < edge.to)
        .sort((a, b) => a.from - b.from);
      let cursor = edge.from;
      const pieces: [number, number][] = [];
      for (const gap of gaps) {
        if (gap.from > cursor) pieces.push([cursor, gap.from]);
        cursor = Math.max(cursor, gap.to);
      }
      if (cursor < edge.to) pieces.push([cursor, edge.to]);
      const line = edge.at + edge.inward * (inset + thick / 2);
      for (const [a, b] of pieces) this.addWall(zone.floor, wallMat, edge.axis, line, a, b, y, height, thick);
      for (const gap of gaps) {
        const a = Math.max(gap.from, edge.from);
        const b = Math.min(gap.to, edge.to);
        this.wallPiece(zone.floor, wallMat, edge.axis, line, a, b, y + 2.4, height - 2.4, thick);
        for (const end of [a, b]) {
          const post = new THREE.BoxGeometry(edge.axis === 'x' ? thick + 0.06 : 0.1, 2.4, edge.axis === 'x' ? 0.1 : thick + 0.06);
          this.batch(zone.floor, this.plain('#2e221e'), this.placed(post, edge.axis === 'x' ? line : end, y + 1.2, edge.axis === 'x' ? end : line), true);
        }
      }
    }
  }

  private wallPiece(floor: number, material: THREE.Material, axis: 'x' | 'z', line: number, a: number, b: number, y0: number, h: number, thick: number): void {
    const length = b - a;
    const geometry = axis === 'x' ? new THREE.BoxGeometry(thick, h, length) : new THREE.BoxGeometry(length, h, thick);
    if (axis === 'x') tileBox(geometry, thick, h, length, 2);
    else tileBox(geometry, length, h, thick, 2);
    const mid = (a + b) / 2;
    this.batch(floor, material, this.placed(geometry, axis === 'x' ? line : mid, y0 + h / 2, axis === 'x' ? mid : line), true);
  }

  private addWall(floor: number, material: THREE.Material, axis: 'x' | 'z', line: number, a: number, b: number, y: number, height: number, thick: number): void {
    if (b - a < 0.02) return;
    this.wallPiece(floor, material, axis, line, a, b, y, height, thick);
    const mid = (a + b) / 2;
    const skirt = axis === 'x' ? new THREE.BoxGeometry(thick + 0.04, 0.16, b - a) : new THREE.BoxGeometry(b - a, 0.16, thick + 0.04);
    this.batch(floor, this.plain('#2a201c'), this.placed(skirt, axis === 'x' ? line : mid, y + 0.08, axis === 'x' ? mid : line));
    const half = thick / 2;
    this.colliders[floor].push(axis === 'x'
      ? { minX: line - half, maxX: line + half, minZ: a, maxZ: b }
      : { minX: a, maxX: b, minZ: line - half, maxZ: line + half });
  }

  private buildShaft(): void {
    const y = this.floorY(1);
    const width = SHAFT.x[1] - SHAFT.x[0];
    const depth = SHAFT.z[1] - SHAFT.z[0];
    const column = new THREE.BoxGeometry(width, CEILING[1], depth);
    tileBox(column, width, CEILING[1], depth, 2);
    const metal = this.sharedMaterial('shaft', () => new THREE.MeshStandardMaterial({ map: surfaceTexture('metal', 1, 1), color: '#857868', metalness: 0.4, roughness: 0.6 }));
    this.batch(1, metal, this.placed(column, 0, y + CEILING[1] / 2, (SHAFT.z[0] + SHAFT.z[1]) / 2), true);
    this.colliders[1].push({ minX: SHAFT.x[0], maxX: SHAFT.x[1], minZ: SHAFT.z[0], maxZ: SHAFT.z[1] });
  }

  private addProp(def: PropDef): void {
    const placement = placements[def.id];
    if (!placement) return;
    const onCar = def.floor === -1;
    const floor = onCar ? 0 : def.floor;
    const group = new THREE.Group();
    group.name = def.id;
    group.userData.propId = def.id;
    group.position.set(placement.pos[0], (onCar ? 0 : this.floorY(floor)) + placement.pos[1], placement.pos[2]);
    group.rotation.y = placement.rotY ?? 0;

    const [w, h, d] = placement.hit;
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    const offset = placement.hitOffset ?? [0, h / 2, 0];
    hitbox.position.set(offset[0], offset[1], offset[2]);
    hitbox.userData.propId = def.id;
    group.add(hitbox);

    const anchor = new THREE.Group();
    const a = placement.anchor ?? [0, h + 0.1, 0];
    anchor.position.set(a[0], a[1], a[2]);
    group.add(anchor);

    let parts: PrimParts | null = null;
    if (placement.model?.kind === 'prim') {
      parts = buildPrim(placement.model.name);
      group.add(parts.root);
      for (const hot of parts.hot ?? []) hot.traverse((child) => child.layers.enable(HOT_LAYER));
    } else if (placement.model) {
      const model = placement.model;
      this.pendingLoads[floor].push(() => this.loadModel(model).then((object) => { if (object) group.add(object); }));
    }

    if (onCar) {
      this.car.add(group);
      this.carTargets.push(hitbox);
    } else {
      this.floors[floor].add(group);
      this.targets[floor].push(hitbox);
    }
    if (placement.solid) {
      const cos = Math.abs(Math.cos(group.rotation.y));
      const sw = cos > 0.5 ? w : d;
      const sd = cos > 0.5 ? d : w;
      this.colliders[floor].push({ minX: group.position.x - sw / 2, maxX: group.position.x + sw / 2, minZ: group.position.z - sd / 2, maxZ: group.position.z + sd / 2 });
    }
    if (!ANOMALY_IDS.has(def.id)) {
      // A small swarm of motes hugging the prop itself, not the room around it.
      const flies: THREE.Sprite[] = [];
      const moteCount = DENSE_MOTE_PROPS.has(def.id) ? 18 : 6;
      for (let i = 0; i < moteCount; i += 1) {
        const fly = this.makeFirefly();
        fly.userData.phase = i * 1.37 + def.id.length * 0.53;
        fly.userData.speed = 0.35 + (i % 3) * 0.12;
        fly.userData.rx = Math.min(w / 2 + 0.1, 0.8);
        fly.userData.rz = Math.min(d / 2 + 0.1, 0.8);
        fly.userData.ry = Math.min(h / 2, 0.7);
        group.add(fly);
        flies.push(fly);
      }
      this.flies.set(def.id, flies);
    }
    this.propViews.set(def.id, { def, placement, group, hitbox, parts, anchor, anchorItem: null, floor: onCar ? -1 : floor });
  }

  private addDecor(item: Decor): void {
    const group = new THREE.Group();
    group.position.set(item.pos[0], this.floorY(item.floor) + item.pos[1], item.pos[2]);
    group.rotation.y = item.rotY ?? 0;
    this.floors[item.floor].add(group);
    if (item.model.kind === 'prim') group.add(buildPrim(item.model.name).root);
    else {
      const model = item.model;
      this.pendingLoads[item.floor].push(() => this.loadModel(model).then((object) => { if (object) group.add(object); }));
    }
    if (item.revealTool) {
      group.visible = false;
      this.revealDecor.push({ object: group, tool: item.revealTool });
    }
    if (item.solid) {
      const [sw, sd] = Math.abs(Math.cos(group.rotation.y)) > 0.5 ? item.solid : [item.solid[1], item.solid[0]];
      this.colliders[item.floor].push({ minX: item.pos[0] - sw / 2, maxX: item.pos[0] + sw / 2, minZ: item.pos[2] - sd / 2, maxZ: item.pos[2] + sd / 2 });
    }
  }

  private moteTexture(): THREE.CanvasTexture {
    if (!this.glowTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255,226,176,0.9)');
        gradient.addColorStop(0.4, 'rgba(255,206,140,0.28)');
        gradient.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
      }
      this.glowTexture = new THREE.CanvasTexture(canvas);
    }
    return this.glowTexture;
  }

  /** A tiny additive speck of light. Each one is its own sprite so it can fade on its own. */
  private makeFirefly(): THREE.Sprite {
    const material = new THREE.SpriteMaterial({ map: this.moteTexture(), color: '#ffe6a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(0.11);
    sprite.renderOrder = 3;
    sprite.visible = false;
    return sprite;
  }

  /** Is this prop on the floor you are standing on, and how far away is it? */
  private propDistance(view: PropView): number {
    const onThisFloor = view.floor === -1 ? this.carFloor === this.floor : view.floor === this.floor;
    if (!onThisFloor) return Infinity;
    view.hitbox.getWorldPosition(this.tmp);
    return Math.hypot(this.tmp.x - this.camera.position.x, this.tmp.z - this.camera.position.z);
  }

  /**
   * Interactables carry a few motes that drift close around them and fade in as you approach.
   * Within arm's length, the prop also gets a thin white outline.
   */
  private updateGlows(time: number): void {
    if (!this.state) return;
    const thermal = this.selectedTool === 'tool_thermal';
    const outline: string[] = [];
    let index = 0;
    for (const [id, flies] of this.flies) {
      index += 1;
      const view = this.propViews.get(id)!;
      const on = !thermal && isInteractable(this.state, view.def, this.carFloor);
      const dist = on ? this.propDistance(view) : Infinity;
      const fade = THREE.MathUtils.clamp((7 - dist) / 4, 0, 1); // full at 3 m, gone by 7 m
      if (on && dist < 3) outline.push(id);
      const mats = this.glowMats.get(id);
      if (mats) {
        // A slow warm breath on the prop itself, so it reads as "touchable" from across the room.
        const glow = THREE.MathUtils.clamp((9 - dist) / 5, 0, 1) * (0.16 + 0.08 * Math.sin(time * 2.2 + index));
        for (const m of mats) m.emissiveIntensity = glow;
      }
      else if (this.targetPropId === id && !thermal && this.propDistance(view) < 8 && isPropVisible(this.state, view.def) && !isLocked(this.state, id)) outline.push(id);
      const base = view.hitbox.position;
      for (const fly of flies) {
        fly.visible = fade > 0;
        if (!fly.visible) continue;
        const t = time * (fly.userData.speed as number) + (fly.userData.phase as number);
        fly.position.set(
          base.x + Math.cos(t) * (fly.userData.rx as number),
          base.y + Math.sin(t * 1.9 + index) * (fly.userData.ry as number),
          base.z + Math.sin(t * 1.3) * (fly.userData.rz as number),
        );
        (fly.material as THREE.SpriteMaterial).opacity = fade * (0.55 + 0.45 * Math.sin(t * 3.1 + index));
      }
    }
    if (time - this.outlineRefresh > 0.5) {
      // Models load lazily, so re-collect meshes now and then.
      this.outlineRefresh = time;
      if (outline.length) this.outlined = [];
      this.collectGlowMaterials();
    }
    this.setOutlined(outline);
  }

  /** Clone each prop's lit materials once so the glow never leaks onto shared furniture materials. */
  private collectGlowMaterials(): void {
    for (const id of this.flies.keys()) {
      const view = this.propViews.get(id);
      if (!view || id.startsWith('elevator') || view.group.userData.glowMeshes === this.countMeshes(view.group)) continue;
      const mats: THREE.MeshStandardMaterial[] = [];
      view.group.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || child === view.hitbox || child.userData.wall) return;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        const next = list.map((m: THREE.Material) => {
          if (!(m instanceof THREE.MeshStandardMaterial)) return m;
          if (m.userData.glowOwner === id) { mats.push(m); return m; }
          if (m.emissive.getHex() !== 0) return m; // already glowing (flames, bulbs): leave alone
          const copy = m.clone();
          copy.userData.glowOwner = id;
          copy.emissive.copy(this.glowColor);
          copy.emissiveIntensity = 0;
          mats.push(copy);
          return copy;
        });
        child.material = Array.isArray(child.material) ? next : next[0];
      });
      view.group.userData.glowMeshes = this.countMeshes(view.group);
      this.glowMats.set(id, mats);
    }
  }

  private countMeshes(object: THREE.Object3D): number {
    let n = 0;
    object.traverse((child) => { if (child instanceof THREE.Mesh) n += 1; });
    return n;
  }

  private setOutlined(ids: string[]): void {
    if (!this.outlinePass) return;
    if (ids.length === this.outlined.length && ids.every((id, i) => id === this.outlined[i])) return;
    this.outlined = ids;
    const meshes: THREE.Object3D[] = [];
    for (const id of ids) {
      const view = this.propViews.get(id);
      view?.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== view.hitbox && !child.userData.wall) meshes.push(child);
      });
    }
    this.outlinePass.selectedObjects = meshes;
  }

  private async loadOutline(): Promise<void> {
    const [{ EffectComposer }, { RenderPass }, { OutlinePass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/OutlinePass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const pass = new OutlinePass(new THREE.Vector2(width, height), this.scene, this.camera);
    pass.visibleEdgeColor.set('#ffffff');
    pass.hiddenEdgeColor.set('#000000');
    pass.edgeStrength = 3.4;
    pass.edgeGlow = 0.8;
    pass.edgeThickness = 1.6;
    pass.pulsePeriod = 0;
    composer.addPass(pass);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.outlinePass = pass;
    this.outlined = [];
  }

  private async loadModel(ref: ModelRef): Promise<THREE.Object3D | null> {
    try {
      if (ref.kind === 'kaykit') {
        const model = await kaykitPiece(ref.name);
        weather(model, ref.tint ?? '#8a7a6e');
        return fitObject(model, ref.fit);
      }
      if (ref.kind === 'halloween') {
        const piece = await halloweenPiece(ref.name);
        if (!piece) return null;
        weather(piece, ref.tint);
        if (ref.lieDown) {
          piece.updateMatrixWorld(true);
          const size = new THREE.Box3().setFromObject(piece).getSize(new THREE.Vector3());
          if (size.y > Math.max(size.x, size.z)) piece.rotation.x = -Math.PI / 2;
        }
        return fitObject(piece, ref.fit);
      }
      if (ref.kind === 'pumpkin') {
        const source = await loadFBX(ref.name === 'jack' ? '/models/monsters/jack_o_lantern.fbx' : '/models/monsters/pumpkin.fbx');
        const copy = source.clone(true);
        weather(copy, '#d0b090');
        return fitObject(copy, ref.fit);
      }
      if (ref.kind === 'witch') {
        const source = await loadFBX('/models/halloween/witch.fbx');
        const copy = await cloneSkinned(source);
        copy.traverse((child) => { if (child instanceof THREE.Mesh) child.frustumCulled = false; });
        return fitObject(copy, ref.fit, 'height');
      }
    } catch (error) {
      console.warn('Model failed to load', ref, error);
    }
    return null;
  }

  private async makeMonster(url: string, height: number, floor: number, setup: (mesh: THREE.Mesh) => THREE.Material | null): Promise<Monster & { gltfAnimations: THREE.AnimationClip[] }> {
    const gltf = await loadGLTF(url);
    const body = await cloneSkinned(gltf.scene);
    const materials: THREE.Material[] = [];
    const meshes: THREE.Mesh[] = [];
    body.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.frustumCulled = false;
      meshes.push(child);
      const material = setup(child);
      if (material) materials.push(material);
    });
    const root = fitObject(body, height, 'height');
    const mixer = new THREE.AnimationMixer(body);
    const actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    this.mixers.push({ mixer, floor });
    return { root, actions, materials, meshes, gltfAnimations: gltf.animations };
  }

  private fadeable(color?: string) {
    return (mesh: THREE.Mesh): THREE.Material => {
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;
      if (color) {
        material.emissive = new THREE.Color(color);
        material.emissiveIntensity = 0.9;
      }
      mesh.material = material;
      return material;
    };
  }

  private async loadHollow(): Promise<void> {
    try {
      const hollow = await this.makeMonster('/models/monsters/ribbed_hollow.glb', 2.75, 0, (mesh) => { mesh.layers.set(HOT_LAYER); return null; });
      hollow.actions.idle?.play();
      this.propViews.get('hollow')?.group.add(hollow.root);
      this.hollow = hollow;

      // A second copy for the glimpses: it never moves, it only appears, watches, and fades.
      const echo = await this.makeMonster('/models/monsters/ribbed_hollow.glb', 2.75, 0, this.fadeable('#3a1c18'));
      (echo.actions.alert ?? echo.actions.idle)?.play();
      echo.root.visible = false;
      this.floors[0].add(echo.root);
      this.echo = echo;

      const chalk = buildPrim('chalkRing').root;
      chalk.visible = false;
      this.propViews.get('hollow')?.group.add(chalk);
      this.chalk = chalk;
      if (this.state) this.syncState(this.state);
    } catch (error) {
      console.warn('Hollow failed to load', error);
    }
  }

  private async loadSpecter(): Promise<void> {
    try {
      const specter = await this.makeMonster('/models/monsters/mournveil.glb', 1.9, 1, this.fadeable('#2a3850'));
      const idle = specter.gltfAnimations.find((clip) => clip.name.startsWith('idle'));
      if (idle) Object.values(specter.actions).find((action) => action.getClip() === idle)?.play();
      this.propViews.get('specter')?.group.add(specter.root);
      this.specter = specter;
    } catch (error) {
      console.warn('Mournveil failed to load', error);
    }
  }

  private async loadCarver(): Promise<void> {
    try {
      const source = await loadFBX('/models/monsters/pumpkin_monster.fbx');
      const body = await cloneSkinned(source);
      body.traverse((child) => {
        if (child instanceof THREE.Mesh) child.frustumCulled = false;
        if (child.name === 'InsideHead') child.layers.enable(HOT_LAYER);
      });
      weather(body, '#e0b890', false);
      const root = fitObject(body, 2.7, 'height');
      this.propViews.get('carver')?.group.add(root);
      this.carver = { root };
    } catch (error) {
      console.warn('Carver failed to load', error);
    }
  }

  private async loadViewmodels(): Promise<void> {
    const sizes: Record<string, number> = { tool_recorder: 0.2, tool_uv: 0.18, tool_emf: 0.2, tool_thermal: 0.3, tool_camera: 0.22 };
    for (const toolId of Object.keys(sizes)) {
      const world = await devicePiece(toolId, sizes[toolId] * 1.2);
      const held = await devicePiece(toolId, sizes[toolId]);
      if (held) {
        held.rotation.set(0.1, Math.PI + 0.25, 0);
        held.visible = false;
        this.viewmodel.add(held);
        this.viewmodels.set(toolId, held);
      }
      if (world) this.viewmodels.set(`world_${toolId}`, world);
    }
    this.setSelectedTool(this.selectedTool);
    if (this.state) this.syncState(this.state);
  }

  /** Every walkable spot on the ground floor, on a coarse grid. Glimpses are picked from these. */
  private buildGlimpseGrid(): void {
    for (const zone of roomsLayout) {
      if (zone.floor !== 0) continue;
      for (let x = zone.x[0] + 1; x <= zone.x[1] - 1; x += HOLLOW_GLIMPSE_GRID) {
        for (let z = zone.z[0] + 1; z <= zone.z[1] - 1; z += HOLLOW_GLIMPSE_GRID) {
          if (!this.blockedOn(0, x, z, 0.7)) this.glimpseGrid.push([x, 0, z]);
        }
      }
    }
  }

  // ── State → view ────────────────────────────────────────────────

  syncState(state: GameState): void {
    this.state = state;
    for (const view of this.propViews.values()) {
      const prop = state.props[view.def.id];
      const itemId = prop?.currentItemId ?? null;
      // Tools are only drawn once they can actually be taken: the camera appears when the fist opens.
      const takeRule = itemId ? view.def.take?.[itemId] : undefined;
      const reachable = isActive(state, view.def) && checkAll(state, takeRule?.requires);
      const shown = itemId && reachable ? itemId : null;
      if (view.anchorItem !== shown) {
        view.anchor.clear();
        view.anchorItem = shown;
        if (shown?.startsWith('tool_')) {
          const world = this.viewmodels.get(`world_${shown}`);
          if (world) view.anchor.add(world.clone(true));
          else view.anchorItem = null;
        } else if (shown && (view.def.floor === -1 || view.def.id === 'scarecrow')) {
          view.anchor.add(evidenceToken(shown));
        }
      }
      const parts = view.parts;
      if (parts?.glow && view.def.floor === -1) {
        (parts.glow.material as THREE.MeshBasicMaterial).color.set(itemId ? '#ffb040' : '#2a1a12');
      }
      if (view.def.id === 'parlor_fireplace' && parts?.flames) parts.flames.visible = itemId === 'ev_fire';
      if (view.def.id === 'pantry_door' && parts?.door) {
        const thawed = itemId === 'ev_fire';
        parts.door.rotation.y = thawed ? -1.9 : 0;
        if (parts.frost) parts.frost.visible = !thawed;
        view.hitbox.position.set(thawed ? -0.85 : 0, 1.15, thawed ? 1.05 : 0.46);
        view.hitbox.rotation.y = thawed ? Math.PI / 2 - 0.3 : 0;
      }
      if (view.def.id === 'bathroom_mirror' && parts?.frost) {
        const steaming = state.props.bath_tub?.currentItemId === 'ev_water';
        ((parts.frost as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = steaming ? 0.55 : 0.12;
      }
      if (view.def.id === 'elevator' && parts?.glow && this.room) {
        const ready = checkAll(state, this.room.props.find((p) => p.id === 'elevator')?.travel?.requires);
        (parts.glow.material as THREE.MeshBasicMaterial).color.set(ready ? '#ffb040' : '#3a2a10');
      }
    }
    this.hollowDead = state.props.hollow?.currentItemId !== 'ev_voice';
    if (this.hollow) {
      const { actions } = this.hollow;
      if (this.hollowDead) {
        const death = actions.death ?? actions['death.001'];
        if (death && !death.isRunning() && death.time === 0) {
          actions.idle?.fadeOut(0.3);
          death.reset().setLoop(THREE.LoopOnce, 1);
          death.clampWhenFinished = true;
          death.fadeIn(0.2).play();
        }
      } else if (!actions.idle?.isRunning()) {
        for (const action of Object.values(actions)) action.stop();
        actions.idle?.reset().play();
      }
      // Alive, it only exists in heat. Dead, it is just a body on the floor.
      for (const mesh of this.hollow.meshes) {
        mesh.layers.set(HOT_LAYER);
        if (this.hollowDead) mesh.layers.enable(0);
      }
    }
    if (this.chalk) this.chalk.visible = Boolean(state.flags.hollow_marked) && !this.hollowDead;
  }

  setSelectedTool(toolId: string | null): void {
    this.selectedTool = toolId;
    for (const [id, model] of this.viewmodels) if (!id.startsWith('world_')) model.visible = id === toolId;
  }

  setFlashlight(on: boolean): void {
    this.flashlight.intensity = on ? 28 : 0;
  }

  setCarFloor(floor: number): void {
    this.carFloor = floor;
    this.car.position.y = this.floorY(floor);
    this.updateFloorVisibility();
  }

  teleport(floor: number, pos: Vec3, yaw: number): void {
    this.floor = floor;
    this.ensureFloorLoaded(floor);
    this.camera.position.set(pos[0], this.floorY(floor) + EYE, pos[2]);
    this.yaw = yaw;
    this.pitch = 0;
    this.camera.rotation.set(0, yaw, 0);
    this.updateFloorVisibility();
    this.assignLights();
    this.targetPropId = null;
    this.echoLife = 0;
    this.echoTimer = 5;
  }

  /** Only the floor you stand on is drawn, lit, raycast, and animated. */
  private updateFloorVisibility(): void {
    this.floors.forEach((group, index) => { group.visible = index === this.floor; });
    this.car.visible = this.carFloor === this.floor;
    for (let f = 0; f < 3; f += 1) {
      this.targetsWithCar[f] = f === this.carFloor ? [...this.targets[f], ...this.carTargets] : this.targets[f];
    }
  }

  private assignLights(): void {
    const defs = lights.filter((light) => light.floor === this.floor);
    this.lightSlots.forEach((slot, index) => {
      const def = defs[index] ?? null;
      slot.def = def;
      if (def) {
        slot.light.position.set(def.pos[0], this.floorY(def.floor) + def.pos[1], def.pos[2]);
        slot.light.color.set(def.color);
        slot.light.distance = def.distance;
      }
      slot.light.intensity = 0;
    });
  }

  // ── Queries for the HUD and audio ───────────────────────────────

  getFloor(): number { return this.floor; }
  getCarFloor(): number { return this.carFloor; }
  getTargetPropId(): string | null { return this.targetPropId; }

  getListener(): { floor: number; x: number; z: number; yaw: number } {
    return { floor: this.floor, x: this.camera.position.x, z: this.camera.position.z, yaw: this.yaw };
  }

  getRoomName(): string {
    const { x, z } = this.camera.position;
    const zone = roomsLayout.find((r) => r.floor === this.floor && x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]);
    return zone?.name ?? 'Doorway';
  }

  /** Where the Hollow is currently being glimpsed, if anywhere. */
  getGlimpse(): { x: number; z: number } | null {
    if (!this.echo || this.echoLife <= 0) return null;
    return { x: this.echo.root.position.x, z: this.echo.root.position.z };
  }

  /** 0..1 strength of the nearest dead thing, for the EMF detector needle. */
  getEmfReading(): number {
    if (!this.state) return 0;
    const { x, z } = this.camera.position;
    let reading = 0;
    const specterDef = this.propViews.get('specter')?.def;
    if (this.floor === 1 && specterDef && isPropVisible(this.state, specterDef)) {
      const node = specterNodes[this.specterNode];
      const dist = Math.hypot(node[0] - x, node[2] - z);
      reading = Math.max(reading, Math.max(0, 1 - dist / 14) * (0.35 + 0.65 * this.specterOpacity));
    }
    if (this.floor === 0 && !this.hollowDead) {
      const pos = placements.hollow.pos;
      reading = Math.max(reading, Math.max(0, 1 - Math.hypot(pos[0] - x, pos[2] - z) / 10) * 0.9);
    }
    return Math.min(1, reading + Math.random() * 0.04);
  }

  /** 0 when she is gone, 1 when fully visible. Drives how loudly her voice is heard. */
  getSpecterPresence(): number {
    return this.floor === 1 ? this.specterOpacity : 0;
  }

  isSpecterManifest(): boolean {
    return this.specterOpacity > 0.55;
  }

  getSpecterPosition(): Vec3 {
    return specterNodes[this.specterNode];
  }

  // ── Input ───────────────────────────────────────────────────────

  private bindInput(): void {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.canvas.addEventListener('click', this.requestPointerLock);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (!this.controlsActive || event.repeat) return;
    if (event.code === 'KeyE') this.callbacks.onInteract?.();
    else if (event.code === 'KeyZ') this.callbacks.onUndo?.();
    else if (event.code === 'KeyF') this.callbacks.onFlashlight?.();
    else if (event.code === 'KeyJ' || event.code === 'Tab') { event.preventDefault(); this.callbacks.onJournal?.(); }
    else if (event.code === 'KeyR') this.callbacks.onRestart?.();
    else if (event.code === 'KeyQ') this.callbacks.onCycleTool?.(-1);
    else if (event.code.startsWith('Digit')) {
      const slot = Number(event.code.slice(5));
      if (slot >= 0 && slot <= 5) this.callbacks.onSelectTool?.(slot);
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.controlsActive && document.pointerLockElement === this.canvas) this.callbacks.onCycleTool?.(Math.sign(event.deltaY));
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.controlsActive || document.pointerLockElement !== this.canvas) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022, -1.45, 1.45);
  };

  private readonly onPointerLockChange = (): void => {
    if (document.pointerLockElement !== this.canvas) this.keys.clear();
    this.callbacks.onPointerLockChange?.(document.pointerLockElement === this.canvas);
  };

  private readonly requestPointerLock = (): void => {
    if (this.controlsActive && document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock();
  };

  setControlsActive(active: boolean): void {
    this.controlsActive = active;
    if (!active) this.keys.clear();
    if (!active && document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  // ── Per-frame update ────────────────────────────────────────────

  private blockedOn(floor: number, x: number, z: number, radius = RADIUS): boolean {
    for (const box of this.colliders[floor]) {
      if (x > box.minX - radius && x < box.maxX + radius && z > box.minZ - radius && z < box.maxZ + radius) return true;
    }
    return false;
  }

  private updateMovement(delta: number): void {
    if (!this.controlsActive || document.pointerLockElement !== this.canvas) return;
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    if (forward === 0 && strafe === 0) return;
    const length = Math.hypot(forward, strafe);
    const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 4.2 : 2.6) * delta / length;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (-sin * forward + cos * strafe) * speed;
    const dz = (-cos * forward - sin * strafe) * speed;
    const pos = this.camera.position;
    if (!this.blockedOn(this.floor, pos.x + dx, pos.z)) pos.x += dx;
    if (!this.blockedOn(this.floor, pos.x, pos.z + dz)) pos.z += dz;
    this.bob += speed * 3.2;
  }

  private updateLights(time: number): void {
    if (!this.state) return;
    for (const slot of this.lightSlots) {
      const def = slot.def;
      if (!def) continue;
      let base = def.intensity;
      if (def.linkedProp) {
        const prop = this.state.props[def.linkedProp];
        const lit = def.linkedProp === 'carver' ? prop?.currentItemId === 'ev_heart' : prop?.currentItemId === 'ev_fire';
        if (!lit) base = def.linkedProp === 'carver' ? 0.6 : 0;
      }
      const flicker = def.flicker ?? 0;
      slot.light.intensity = base * (1 - flicker + flicker * (0.5 + 0.5 * Math.sin(time * 9 + slot.phase) * Math.sin(time * 3.7 + slot.phase * 2)));
    }
  }

  private updatePropAnimation(time: number, delta: number): void {
    if (!this.state) return;
    this.updateGlows(time);
    if (this.floor === 0) {
      const clockView = this.propViews.get('dining_clock');
      if (clockView?.parts?.pendulum) {
        clockView.parts.pendulum.rotation.z = this.state.props.dining_clock.currentItemId === 'ev_ticking' ? Math.sin(time * Math.PI) * 0.22 : 0.05;
      }
      const fire = this.propViews.get('parlor_fireplace')?.parts?.flames;
      if (fire?.visible) fire.children.forEach((flame, index) => { flame.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(time * 7 + index)); });
    }
    for (const view of this.propViews.values()) {
      if (view.anchor.children.length && (view.floor === this.floor || view.floor === -1)) view.anchor.rotation.y += delta * 0.6;
    }
    if (this.floor === 1) {
      const chair = this.propViews.get('nursery_chair');
      if (chair) chair.group.rotation.z = Math.sin(time * 2.2) * 0.08 * (0.2 + (this.specterNode === 0 ? this.specterOpacity : 0));
      const mirror = this.propViews.get('bathroom_mirror');
      if (mirror?.parts?.glow) {
        const revealed = Boolean(this.state.flags.print_revealed) && this.state.props.bathroom_mirror.currentItemId === 'ev_print';
        mirror.parts.glow.visible = revealed && (this.selectedTool === 'tool_uv' || this.selectedTool === 'tool_camera');
      }
    }
    for (const reveal of this.revealDecor) reveal.object.visible = this.selectedTool === reveal.tool;
  }

  /**
   * Is this point somewhere the player can see right now, but not dead centre?
   * Uses the camera projection, then a raycast against the merged walls of the floor.
   */
  private inSight(x: number, z: number, minEdge: number, maxEdge: number): boolean {
    const floorY = this.floorY(this.floor);
    this.tmp.set(x, floorY + 1.5, z).project(this.camera);
    const ax = Math.abs(this.tmp.x);
    if (this.tmp.z > 1 || ax < minEdge || ax > maxEdge || Math.abs(this.tmp.y) > 0.8) return false;
    // The whole body must be clear: test the chest, the head, and either shoulder.
    return this.clearRay(x, floorY + 1.4, z) && this.clearRay(x, floorY + 2.4, z) && this.clearRay(x + 0.45, floorY + 1.6, z) && this.clearRay(x - 0.45, floorY + 1.6, z)
      && this.clearRay(x, floorY + 1.6, z + 0.45) && this.clearRay(x, floorY + 1.6, z - 0.45);
  }

  private clearRay(x: number, y: number, z: number): boolean {
    const origin = this.camera.position;
    this.tmpDir.set(x - origin.x, y - origin.y, z - origin.z);
    const dist = this.tmpDir.length();
    this.raycaster.set(origin, this.tmpDir.normalize());
    this.raycaster.far = dist;
    this.hits.length = 0;
    // Walls, stairs, and furniture hitboxes all block the view.
    this.raycaster.intersectObjects(this.targets[this.floor], false, this.hits);
    return this.hits.length === 0;
  }

  private pickInSight(points: Vec3[], minDist: number, maxDist: number, minEdge: number, maxEdge: number, tries = 14): Vec3 | null {
    const { x, z } = this.camera.position;
    const near: Vec3[] = [];
    for (const p of points) {
      const d = Math.hypot(p[0] - x, p[2] - z);
      if (d >= minDist && d <= maxDist) near.push(p);
    }
    for (let i = 0; i < tries && near.length; i += 1) {
      const index = Math.floor(Math.random() * near.length);
      const p = near[index];
      if (this.inSight(p[0], p[2], minEdge, maxEdge)) return p;
      near.splice(index, 1);
    }
    return null;
  }

  private updateSpecter(delta: number): void {
    const view = this.propViews.get('specter');
    if (!view || !this.state) return;
    if (this.floor !== 1) {
      this.specterOpacity = 0;
      view.group.visible = false;
      return;
    }
    const allowed = isPropVisible(this.state, view.def);
    this.specterClock += delta;
    // Absent 4 s, fade in 1.4 s, present 9 s, fade out 1.4 s, then drift somewhere else.
    const t = this.specterClock;
    let target = 0;
    if (t > 4 && t < 5.4) target = (t - 4) / 1.4;
    else if (t >= 5.4 && t < 14.4) target = 1;
    else if (t >= 14.4 && t < 15.8) target = 1 - (t - 14.4) / 1.4;
    else if (t >= 15.8) {
      this.specterClock = 0;
      const others = specterNodes.filter((_, i) => i !== this.specterNode);
      const next = this.pickInSight(others, 3, 20, 0, 0.85) ?? others[Math.floor(Math.random() * others.length)];
      this.specterNode = specterNodes.indexOf(next);
    }
    this.specterOpacity = allowed ? target : Math.max(0, this.specterOpacity - delta * 2);
    const node = specterNodes[this.specterNode];
    view.group.position.set(node[0], this.floorY(1) + 0.1 + Math.sin(t * 1.3) * 0.06, node[2]);
    view.group.rotation.y = Math.atan2(this.camera.position.x - node[0], this.camera.position.z - node[2]);
    view.group.visible = this.specterOpacity > 0.01;
    if (this.specter) for (const material of this.specter.materials) (material as THREE.MeshStandardMaterial).opacity = this.specterOpacity * 0.85;
  }

  /**
   * The Hollow's glimpses: it appears far away, inside your view but off to one side,
   * with a clear line of sight. It watches, then fades. It never moves toward you.
   */
  private updateHollowGlimpse(delta: number): void {
    const echo = this.echo;
    if (!echo || !this.state) return;
    const active = this.floor === 0 && !this.hollowDead && this.selectedTool !== 'tool_thermal';
    const { x, z } = this.camera.position;
    if (this.echoLife > 0) {
      this.echoLife -= delta;
      const dist = Math.hypot(echo.root.position.x - x, echo.root.position.z - z);
      if (dist < 4.5 || !active) this.echoLife = Math.min(this.echoLife, 0.5);
      const opacity = Math.max(0, Math.min(1, this.echoLife / 0.6, (GLIMPSE_LIFE - this.echoLife) / 0.6));
      for (const material of echo.materials) (material as THREE.MeshStandardMaterial).opacity = opacity * 0.95;
      echo.root.visible = this.echoLife > 0;
      echo.root.rotation.y = Math.atan2(x - echo.root.position.x, z - echo.root.position.z);
      return;
    }
    echo.root.visible = false;
    if (!active) return;
    this.echoTimer -= delta;
    if (this.echoTimer > 0) return;
    const spot = this.pickInSight(this.glimpseGrid, 6.5, 17, 0.18, 0.78);
    if (!spot) {
      this.echoTimer = 0.6; // try again shortly, from wherever the player is looking then
      return;
    }
    echo.root.position.set(spot[0], 0, spot[2]);
    this.echoLife = GLIMPSE_LIFE;
    this.echoTimer = 9 + Math.random() * 6;
    this.callbacks.onGlimpse?.();
  }

  private updateCarver(delta: number): void {
    const view = this.propViews.get('carver');
    if (!view || !this.carver || !this.state || this.floor !== 2) return;
    const dead = this.state.props.carver.currentItemId !== 'ev_heart';
    if (dead) {
      this.carverFall = Math.min(1, this.carverFall + delta * 0.8);
      this.carver.root.rotation.x = -this.carverFall * 1.35;
      return;
    }
    this.carverFall = 0;
    this.carver.root.rotation.x = 0;
    const distracted = this.state.props.scarecrow.currentItemId === 'ev_voice';
    const lookX = distracted ? placements.scarecrow.pos[0] : this.camera.position.x;
    const lookZ = distracted ? placements.scarecrow.pos[2] : this.camera.position.z;
    const desired = Math.atan2(lookX - view.group.position.x, lookZ - view.group.position.z) - view.group.rotation.y;
    this.carver.root.rotation.y += (desired - this.carver.root.rotation.y) * Math.min(1, delta * 2.5);
  }

  private updateTarget(): void {
    this.raycaster.setFromCamera(CENTER, this.camera);
    this.raycaster.far = REACH;
    this.hits.length = 0;
    this.raycaster.intersectObjects(this.targetsWithCar[this.floor], false, this.hits);
    let next: string | null = null;
    for (const hit of this.hits) {
      if (hit.object.userData.wall) break;
      const id = hit.object.userData.propId as string | undefined;
      if (!id || !this.isTargetable(id)) continue;
      next = id;
      break;
    }
    if (next !== this.targetPropId) {
      this.targetPropId = next;
      this.callbacks.onTargetChange?.(next);
    }
  }

  private isTargetable(propId: string): boolean {
    if (!this.state) return false;
    const view = this.propViews.get(propId);
    if (!view || !isPropVisible(this.state, view.def)) return false;
    if (propId === 'specter') return this.isSpecterManifest();
    return true;
  }

  /** Lower the internal resolution on slow machines, raise it again when there is headroom. */
  private adaptResolution(delta: number): void {
    this.frameTimeSum += delta;
    this.frameCount += 1;
    if (this.frameTimeSum < 2) return;
    const average = this.frameTimeSum / this.frameCount;
    this.frameTimeSum = 0;
    this.frameCount = 0;
    const cap = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    let next = this.pixelRatio;
    if (average > 1 / 45) next = Math.max(MIN_PIXEL_RATIO, this.pixelRatio - 0.25);
    else if (average < 1 / 80) next = Math.min(cap, this.pixelRatio + 0.25);
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.composer?.setPixelRatio(next);
      this.resize();
    }
  }

  render(now?: number): void {
    this.clock.update(now);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsed();
    this.updateMovement(delta);
    this.camera.position.y = this.floorY(this.floor) + EYE + Math.sin(this.bob) * 0.025;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.viewmodel.position.y = -0.28 + Math.sin(this.bob * 0.5) * 0.008;
    for (const entry of this.mixers) if (entry.floor === this.floor) entry.mixer.update(delta);
    this.updateLights(time);
    this.updatePropAnimation(time, delta);
    this.updateSpecter(delta);
    this.updateHollowGlimpse(delta);
    this.updateCarver(delta);
    if (this.frame++ % 2 === 0) this.updateTarget();
    this.adaptResolution(delta);

    if (this.selectedTool === 'tool_thermal') {
      // Pass 1: the cold world in flat blue. Pass 2: only warm things, drawn white-hot on top.
      this.scene.overrideMaterial = this.thermalCold;
      this.camera.layers.set(0);
      this.renderer.render(this.scene, this.camera);
      const background = this.scene.background;
      this.scene.background = null;
      this.renderer.autoClear = false;
      this.scene.overrideMaterial = this.thermalHot;
      this.camera.layers.set(HOT_LAYER);
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = true;
      this.scene.background = background;
      this.scene.overrideMaterial = null;
      this.camera.layers.set(0);
    } else if (this.composer && this.outlined.length) {
      // Only pay for the outline passes while something is actually outlined.
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private readonly resize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
  };
}
