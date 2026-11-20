// Spatial data for the Hollow House. Plain data only: the renderer turns this into geometry,
// collision, lights, and hitboxes. Coordinates are metres. Each floor has its own origin height.

export type Vec3 = [number, number, number];

export interface RoomZone {
  id: string;
  name: string;
  floor: number;
  x: [number, number];
  z: [number, number];
  wall: string;
  floorTex: string;
  wallTint?: string;
}

/** A doorway cut into the wall at x = at (axis 'x') or z = at (axis 'z'), spanning [from, to]. */
export interface Doorway {
  floor: number;
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
}

export type ModelRef =
  | { kind: 'kaykit'; name: string; fit: number; tint?: string }
  | { kind: 'halloween'; name: string; fit: number; lieDown?: boolean; tint?: string }
  | { kind: 'pumpkin'; name: 'jack' | 'pumpkin'; fit: number }
  | { kind: 'witch'; fit: number }
  | { kind: 'prim'; name: string };

export interface Placement {
  pos: Vec3;
  rotY?: number;
  /** Interaction hitbox size. Also used as the collision footprint when solid. */
  hit: Vec3;
  hitOffset?: Vec3;
  model?: ModelRef;
  /** Where a tool or item held by this prop is drawn, relative to the prop. */
  anchor?: Vec3;
  solid?: boolean;
}

export interface Decor {
  floor: number;
  pos: Vec3;
  rotY?: number;
  model: ModelRef;
  solid?: [number, number];
  /** Only drawn while this tool is selected. Used for UV handprint trails. */
  revealTool?: string;
}

export interface LightDef {
  floor: number;
  pos: Vec3;
  color: string;
  intensity: number;
  distance: number;
  /** Optional link to a prop: the light dims when the prop loses its item (fire, candles). */
  linkedProp?: string;
  flicker?: number;
}

export const FLOOR_HEIGHT = 4.2;
export const CEILING = [3.4, 3.4, 3.1];
export const FLOOR_NAMES = ['GROUND FLOOR', 'UPPER FLOOR', 'ATTIC'];
export const START: { pos: Vec3; yaw: number } = { pos: [0, 0, 8.4], yaw: 0 };
/** Elevator shaft footprint (solid on every floor). The car door faces +z at z = -2. */
export const SHAFT = { x: [-1.6, 1.6] as [number, number], z: [-4, -2] as [number, number] };

export const roomsLayout: RoomZone[] = [
  { id: 'foyer', name: 'Foyer', floor: 0, x: [-4, 4], z: [-2, 10], wall: 'wall_stripe', floorTex: 'floor_old' },
  { id: 'study', name: 'Study', floor: 0, x: [-12, -4], z: [3, 10], wall: 'wall_paper', floorTex: 'floor_old', wallTint: '#b7a58c' },
  { id: 'kitchen', name: 'Kitchen', floor: 0, x: [-12, -4], z: [-10, 3], wall: 'wall_dirty', floorTex: 'floor_tiles', wallTint: '#9a958a' },
  { id: 'backhall', name: 'Servants\u2019 Hall', floor: 0, x: [-4, 4], z: [-10, -4], wall: 'wall_peeling', floorTex: 'floor_old' },
  { id: 'dining', name: 'Dining Room', floor: 0, x: [4, 12], z: [-10, 3], wall: 'wall_stripe', floorTex: 'floor_old', wallTint: '#a8b09c' },
  { id: 'parlor', name: 'Parlor', floor: 0, x: [4, 12], z: [3, 10], wall: 'wall_paper', floorTex: 'floor_old', wallTint: '#a99b8c' },

  { id: 'landing', name: 'Upper Landing', floor: 1, x: [-4, 4], z: [-10, 10], wall: 'wall_stripe', floorTex: 'floor_old' },
  { id: 'nursery', name: 'Nursery', floor: 1, x: [-12, -4], z: [2, 10], wall: 'wall_paper', floorTex: 'floor_old', wallTint: '#a6b0b8' },
  { id: 'bathroom', name: 'Bathroom', floor: 1, x: [-12, -4], z: [-10, 2], wall: 'wall_dirty', floorTex: 'floor_tiles', wallTint: '#9fb0a6' },
  { id: 'master', name: 'Master Bedroom', floor: 1, x: [4, 12], z: [-1, 10], wall: 'wall_paper', floorTex: 'floor_old', wallTint: '#c4b0a6' },
  { id: 'library', name: 'Library', floor: 1, x: [4, 12], z: [-10, -1], wall: 'wall_paper', floorTex: 'floor_old', wallTint: '#a89a8a' },

  { id: 'attic', name: 'Attic', floor: 2, x: [-8, 8], z: [-2, 10], wall: 'wall_dirty', floorTex: 'floor_old', wallTint: '#b8a898' },
];

export const doorways: Doorway[] = [
  { floor: 0, axis: 'x', at: -4, from: 6.2, to: 7.8 },
  { floor: 0, axis: 'x', at: -4, from: 0.2, to: 1.8 },
  { floor: 0, axis: 'z', at: 3, from: -9, to: -7.4 },
  { floor: 0, axis: 'x', at: -4, from: -7.8, to: -6.2 },
  { floor: 0, axis: 'x', at: 4, from: -7.8, to: -6.2 },
  { floor: 0, axis: 'x', at: 4, from: 0.2, to: 1.8 },
  { floor: 0, axis: 'x', at: 4, from: 6.2, to: 7.8 },
  { floor: 0, axis: 'z', at: 3, from: 7.4, to: 9 },

  { floor: 1, axis: 'x', at: -4, from: 6.2, to: 7.8 },
  { floor: 1, axis: 'x', at: -4, from: -5.8, to: -4.2 },
  { floor: 1, axis: 'z', at: 2, from: -9, to: -7.4 },
  { floor: 1, axis: 'x', at: 4, from: 6.2, to: 7.8 },
  { floor: 1, axis: 'x', at: 4, from: -6.8, to: -5.2 },
  { floor: 1, axis: 'z', at: -1, from: 9, to: 10.6 },
];

const PI = Math.PI;

/** Where each puzzle prop sits. Floor -1 props are mounted on the lift car. */
export const placements: Record<string, Placement> = {
  front_door: { pos: [0, 0, 9.77], hit: [1.6, 2.6, 0.3], hitOffset: [0, 1.3, 0], model: { kind: 'prim', name: 'frontDoor' } },
  elevator: { pos: [0, 0, -1.76], hit: [2, 2.6, 0.4], hitOffset: [0, 1.3, 0], model: { kind: 'prim', name: 'elevator' } },
  socket_voice: { pos: [2.05, 1.9, -1.72], hit: [0.5, 0.42, 0.2], model: { kind: 'prim', name: 'socketVoice' }, anchor: [0, 0, 0.12] },
  socket_touch: { pos: [2.05, 1.35, -1.72], hit: [0.5, 0.48, 0.2], model: { kind: 'prim', name: 'socketTouch' }, anchor: [0, 0, 0.12] },
  socket_heart: { pos: [2.05, 0.75, -1.72], hit: [0.5, 0.5, 0.2], model: { kind: 'prim', name: 'socketHeart' }, anchor: [0, 0, 0.1] },
  stairs_up: { pos: [-2.7, 0, 3.6], hit: [2, 2.4, 3], hitOffset: [0, 1.2, 0], model: { kind: 'prim', name: 'stairsUp' }, solid: true },

  study_drawer: { pos: [-11.4, 0, 8.4], rotY: PI / 2, hit: [1.1, 1.3, 0.8], hitOffset: [0, 0.65, 0], model: { kind: 'kaykit', name: 'cabinet_medium_decorated', fit: 1.5, tint: '#8a7466' }, anchor: [0.35, 1.32, 0], solid: true },
  study_desk: { pos: [-8, 0, 9.3], rotY: PI, hit: [2, 1.2, 1], hitOffset: [0, 0.6, 0], model: { kind: 'kaykit', name: 'table_medium', fit: 1.9, tint: '#7a6050' }, solid: true },
  kitchen_counter: { pos: [-11.5, 0, -2.5], hit: [1, 1.1, 2.6], hitOffset: [0, 0.55, 0], model: { kind: 'prim', name: 'counter' }, anchor: [0, 1.0, 0.3], solid: true },
  kitchen_sink: { pos: [-11.5, 0, 0.6], hit: [1, 1.1, 1.6], hitOffset: [0, 0.55, 0], model: { kind: 'prim', name: 'sink' }, solid: true },
  pantry_door: { pos: [-8.9, 0, -9.77], hit: [1.4, 2.3, 0.14], hitOffset: [0, 1.15, 0.46], model: { kind: 'prim', name: 'pantryDoor' } },
  pantry_shelf: { pos: [-8.9, 0, -9.77], hit: [1.1, 1.0, 0.3], hitOffset: [0, 1.25, 0.24], model: { kind: 'prim', name: 'pantryShelf' }, anchor: [0, 1.12, 0.26] },
  dining_clock: { pos: [11.5, 0, -9.3], rotY: -PI / 4, hit: [0.9, 2.5, 0.7], hitOffset: [0, 1.25, 0], model: { kind: 'prim', name: 'clock' }, solid: true },
  dining_table: { pos: [7.6, 0, -3.5], rotY: PI / 2, hit: [1.6, 1, 3.6], hitOffset: [0, 0.5, 0], model: { kind: 'kaykit', name: 'table_medium_long', fit: 3.6, tint: '#6e5444' }, solid: true },
  hollow: { pos: [10.4, 0, -3.5], rotY: -PI / 2, hit: [1.4, 2.8, 1.4], hitOffset: [0, 1.4, 0] },
  parlor_fireplace: { pos: [11.75, 0, 6.5], rotY: -PI / 2, hit: [2.4, 1.8, 0.9], hitOffset: [0, 0.9, 0], model: { kind: 'prim', name: 'fireplace' }, solid: true },
  parlor_mirror: { pos: [7.4, 0, 9.76], rotY: PI, hit: [1.3, 2, 0.3], hitOffset: [0, 1.6, 0], model: { kind: 'prim', name: 'mirror' } },

  stairs_down: { pos: [-2.7, 0, 3.6], hit: [2, 1.6, 3], hitOffset: [0, 0.4, 0], model: { kind: 'prim', name: 'stairsDown' } },
  corpse: { pos: [9.6, 0.7, 6.0], hit: [1.1, 0.55, 0.9] },
  corpse_hand: { pos: [8.55, 0.72, 5.4], hit: [0.45, 0.4, 0.45], anchor: [0, 0.12, 0] },
  library_portrait: { pos: [8, 1.85, -9.76], hit: [1.6, 1.6, 0.25], model: { kind: 'prim', name: 'weddingPortrait' } },
  library_books: { pos: [11.55, 0, -5], rotY: -PI / 2, hit: [0.7, 2.2, 2.2], hitOffset: [0, 1.1, 0], model: { kind: 'kaykit', name: 'shelf_B_large_decorated', fit: 2.3, tint: '#7a6656' }, solid: true },
  master_nightstand: { pos: [11.4, 0, 3.8], rotY: -PI / 2, hit: [0.7, 0.9, 0.6], hitOffset: [0, 0.45, 0], model: { kind: 'prim', name: 'nightstand' }, anchor: [0.12, 0.7, 0], solid: true },
  nursery_crib: { pos: [-8.2, 0, 9.1], hit: [1.4, 1, 0.9], hitOffset: [0, 0.5, 0], model: { kind: 'prim', name: 'crib' }, anchor: [0, 0.55, 0], solid: true },
  nursery_chair: { pos: [-11, 0, 4.2], rotY: PI / 2, hit: [0.9, 1.2, 0.9], hitOffset: [0, 0.6, 0], model: { kind: 'kaykit', name: 'chair_A_wood', fit: 1.15, tint: '#7a6656' } },
  specter: { pos: [-8, 0, 6], hit: [1, 2, 1], hitOffset: [0, 1, 0] },
  bath_tub: { pos: [-10.9, 0, -7.4], hit: [1.1, 0.9, 2.2], hitOffset: [0, 0.45, 0], model: { kind: 'prim', name: 'bathtub' }, solid: true },
  bathroom_mirror: { pos: [-11.76, 0, -2.6], rotY: PI / 2, hit: [1.1, 1.2, 0.3], hitOffset: [0, 1.65, 0], model: { kind: 'prim', name: 'smallMirror' } },

  scarecrow: { pos: [6, 0, 5.5], rotY: -PI / 3, hit: [1.1, 2.1, 1.1], hitOffset: [0, 1.05, 0], model: { kind: 'halloween', name: 'Scarecrow', fit: 2.1 }, anchor: [0, 1.85, 0.25], solid: true },
  hall_coffin: { pos: [-3, 0, -9.0], hit: [0.95, 1.0, 2.1], hitOffset: [0, 0.5, 0], model: { kind: 'halloween', name: 'Coffin', fit: 2.1 }, solid: true },
  washbasin: { pos: [7, 0, -0.35], rotY: PI / 2, hit: [1, 1.1, 1.6], hitOffset: [0, 0.55, 0], model: { kind: 'prim', name: 'sink' }, solid: true },
  carver: { pos: [0, 0, 8.7], rotY: PI, hit: [2.4, 2.9, 1.2], hitOffset: [0, 1.45, 0] },
};

/** Specter haunt points on the upper floor. She fades between them; she never follows you. */
export const specterNodes: Vec3[] = [
  [-8.5, 0, 6],
  [-8, 0, -4.5],
  [8, 0, -6.5],
  [0, 0, -7.5],
  [8.5, 0, 2.5],
];

/** Where the Hollow's glimpses may appear: generated across the ground floor, then filtered by line of sight. */
export const HOLLOW_GLIMPSE_GRID = 1.6;

const H = (name: string, fit: number, extra: Partial<Extract<ModelRef, { kind: 'halloween' }>> = {}): ModelRef => ({ kind: 'halloween', name, fit, ...extra });
const K = (name: string, fit: number, tint = '#7c6a5e'): ModelRef => ({ kind: 'kaykit', name, fit, tint });

export const decor: Decor[] = [
  // Foyer
  { floor: 0, pos: [0, 0, 4.5], model: { kind: 'prim', name: 'rug' } },
  { floor: 0, pos: [3.3, 0, -1.2], rotY: -PI / 2, model: K('lamp_standing', 1.9) },
  { floor: 0, pos: [3.5, 0, 9.3], rotY: PI, model: K('cabinet_medium', 1.4), solid: [0.6, 1.3] },
  { floor: 0, pos: [3.76, 1.9, 4.5], rotY: -PI / 2, model: K('pictureframe_large_B', 1.2, '#5a4a40') },
  { floor: 0, pos: [-3.6, 0, 9.4], model: H('Spiderweb', 1.4) },
  // Study
  { floor: 0, pos: [-8, 0, 8.2], model: K('chair_B_wood', 1.0) },
  { floor: 0, pos: [-11.5, 0, 5.2], rotY: PI / 2, model: K('shelf_B_large_decorated', 2.2), solid: [0.6, 1.9] },
  { floor: 0, pos: [-5.2, 0, 9.3], model: K('lamp_standing', 1.8) },
  { floor: 0, pos: [-8, 0, 5.5], model: { kind: 'prim', name: 'rug' } },
  // Kitchen
  { floor: 0, pos: [-8, 0, -4], model: K('table_medium', 1.8, '#6a5446'), solid: [1.7, 1.0] },
  { floor: 0, pos: [-8.9, 0, -4], rotY: PI / 2, model: K('chair_A_wood', 1.0) },
  { floor: 0, pos: [-7.2, 0, -4.6], rotY: -PI / 2, model: K('chair_A_wood', 1.0) },
  { floor: 0, pos: [-5.0, 0, -9.3], model: H('Candy_Bowl', 0.5) },
  { floor: 0, pos: [-11.6, 2.6, -9.6], model: H('Spiderweb_01', 1.6) },
  // Servants' hall
  { floor: 0, pos: [3.2, 0, -9.3], model: H('Candle_02', 0.5) },
  // Dining
  { floor: 0, pos: [6.5, 0, -2.3], rotY: PI / 2, model: K('chair_B_wood', 1.05) },
  { floor: 0, pos: [6.5, 0, -4.7], rotY: PI / 2, model: K('chair_B_wood', 1.05) },
  { floor: 0, pos: [8.7, 0, -2.3], rotY: -PI / 2, model: K('chair_B_wood', 1.05) },
  { floor: 0, pos: [9.7, 0, -3.0], rotY: -PI / 2 + 0.6, model: K('chair_B_wood', 1.05) },
  { floor: 0, pos: [7.6, 0.85, -3.5], model: H('Candle_01', 0.4) },
  { floor: 0, pos: [11.5, 0, 2.2], model: K('cabinet_medium_decorated', 1.4), solid: [0.7, 1.4] },
  // Parlor
  { floor: 0, pos: [8, 0, 5.6], rotY: 0, model: K('couch', 2.2, '#5a3a40'), solid: [2.0, 0.9] },
  { floor: 0, pos: [10, 0, 8.3], rotY: PI + 0.5, model: K('armchair', 1.1, '#5a3a40') },
  { floor: 0, pos: [8, 0, 7.2], model: { kind: 'prim', name: 'rug' } },
  { floor: 0, pos: [5, 0, 9.3], model: K('lamp_standing', 1.8) },

  // Upper landing
  { floor: 1, pos: [0, 0, 6], model: { kind: 'prim', name: 'rug' } },
  { floor: 1, pos: [3.4, 0, 9.3], rotY: PI, model: K('cabinet_medium', 1.3), solid: [0.6, 1.2] },
  { floor: 1, pos: [-3.76, 1.9, 0.5], rotY: PI / 2, model: K('pictureframe_large_A', 1.2, '#5a4a40') },
  { floor: 1, pos: [3.2, 0, -9.3], model: K('lamp_standing', 1.8) },
  // Nursery
  { floor: 1, pos: [-5.2, 0, 9.3], model: H('Candy_Container', 0.6) },
  { floor: 1, pos: [-8.5, 0, 5.5], model: { kind: 'prim', name: 'rug' } },
  { floor: 1, pos: [-11.6, 0, 8.6], rotY: PI / 2, model: K('cabinet_medium_decorated', 1.3), solid: [0.6, 1.2] },
  { floor: 1, pos: [-6, 2.7, 9.6], model: H('Spiderweb_02', 1.4) },
  // Bathroom
  { floor: 1, pos: [-11.5, 0, 0.4], rotY: PI / 2, model: K('cabinet_medium', 1.2), solid: [0.6, 1.1] },
  // Master bedroom
  { floor: 1, pos: [9.2, 0, 6], rotY: -PI / 2, model: K('bed_double_A', 2.6, '#7a5a5a'), solid: [2.3, 2.0] },
  { floor: 1, pos: [9.3, 0.62, 6.1], rotY: -PI / 2, model: H('Body001', 1.8, { lieDown: true }) },
  { floor: 1, pos: [11.4, 0.66, 3.55], model: H('Candle', 0.3) },
  { floor: 1, pos: [5.5, 0, 9.2], model: K('armchair', 1.1, '#5a3a40') },
  // Library
  { floor: 1, pos: [11.55, 0, -8], rotY: -PI / 2, model: K('shelf_B_large_decorated', 2.3), solid: [0.6, 2.0] },
  { floor: 1, pos: [4.5, 0, -9.2], rotY: 0, model: K('shelf_B_large_decorated', 2.3), solid: [2.0, 0.6] },
  { floor: 1, pos: [7.5, 0, -5], model: K('table_medium', 1.7, '#5e4a3e'), solid: [1.6, 1.0] },
  { floor: 1, pos: [7.5, 0.82, -5], model: K('book_set', 0.5) },
  { floor: 1, pos: [6.5, 0, -5], rotY: PI / 2, model: K('armchair', 1.1, '#4a3a3a') },
  // UV trail upstairs: out of the bathtub, across the tiles, to the mirror
  ...[[-10.1, -5.9], [-10.7, -4.8], [-11.2, -3.7]].map(([x, z], i): Decor => ({ floor: 1, pos: [x, 0.02, z], rotY: 2.6 + i * 0.3, model: { kind: 'prim', name: 'handprint' }, revealTool: 'tool_uv' })),

  // Attic
  { floor: 2, pos: [-6, 0, 2], rotY: 0.3, model: H('Coffin', 2.0), solid: [0.8, 2.0] },
  { floor: 2, pos: [-6.2, 0, 6.5], rotY: -0.2, model: H('Coffin002', 2.0), solid: [0.8, 2.0] },
  { floor: 2, pos: [-4.5, 0, 8.8], model: { kind: 'pumpkin', name: 'jack', fit: 0.5 } },
  { floor: 2, pos: [-3.6, 0, 9.2], model: { kind: 'pumpkin', name: 'pumpkin', fit: 0.4 } },
  { floor: 2, pos: [3.6, 0, 9.1], model: { kind: 'pumpkin', name: 'jack', fit: 0.55 } },
  { floor: 2, pos: [4.6, 0, 8.6], model: { kind: 'pumpkin', name: 'pumpkin', fit: 0.45 } },
  { floor: 2, pos: [2.8, 0, 2.5], model: { kind: 'pumpkin', name: 'jack', fit: 0.45 } },
  { floor: 2, pos: [-2.5, 0, 1.5], model: H('Candle_03', 0.5) },
  { floor: 2, pos: [6.8, 0, 0.6], model: H('Candle_02', 0.5) },
  { floor: 2, pos: [7, 0, 9], rotY: -2.4, model: { kind: 'witch', fit: 1.8 }, solid: [0.7, 0.7] },
  { floor: 2, pos: [-7.4, 2.4, 9.5], model: H('Spiderweb', 1.8) },
  { floor: 2, pos: [7.4, 2.4, -1.4], model: H('Spiderweb_01', 1.6) },
  { floor: 2, pos: [-2, 0, 5], model: H('Body_part_05', 0.6) },
  // Windows onto the quiet dark outside
  { floor: 0, pos: [-11.77, 0, 6.2], rotY: PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 0, pos: [-11.77, 0, -6.5], rotY: PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 0, pos: [11.77, 0, -6.2], rotY: -PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 0, pos: [-2.2, 0, 9.77], rotY: PI, model: { kind: 'prim', name: 'window' } },
  { floor: 1, pos: [-11.77, 0, 6.6], rotY: PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 1, pos: [11.77, 0, 8.2], rotY: -PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 1, pos: [11.77, 0, -2.8], rotY: -PI / 2, model: { kind: 'prim', name: 'window' } },
  { floor: 1, pos: [0, 0, 9.77], rotY: PI, model: { kind: 'prim', name: 'window' } },
  { floor: 2, pos: [0, 0.4, 9.77], rotY: PI, model: { kind: 'prim', name: 'roundWindow' } },
];

export const lights: LightDef[] = [
  { floor: 0, pos: [0, 2.5, 4], color: '#ffd29a', intensity: 10, distance: 16 },
  { floor: 0, pos: [-8, 2.3, 7.8], color: '#ffb070', intensity: 9, distance: 11, flicker: 0.05 },
  { floor: 0, pos: [-8, 2.8, -4], color: '#9fb4dc', intensity: 8, distance: 12 },
  { floor: 0, pos: [8, 2.3, -3.5], color: '#ffb880', intensity: 13, distance: 13, flicker: 0.12 },
  { floor: 0, pos: [10.8, 1.1, 6.5], color: '#ff6a2a', intensity: 16, distance: 11, linkedProp: 'parlor_fireplace', flicker: 0.3 },
  { floor: 0, pos: [0, 2.6, -7], color: '#c05060', intensity: 6, distance: 9, flicker: 0.08 },

  { floor: 1, pos: [0, 3, 3], color: '#e0c8a6', intensity: 11, distance: 15 },
  { floor: 1, pos: [0, 3, -7], color: '#b08878', intensity: 7, distance: 10 },
  { floor: 1, pos: [-8, 2.7, 6], color: '#8fa0d0', intensity: 8, distance: 11 },
  { floor: 1, pos: [-8, 2.7, -4], color: '#8fc0b0', intensity: 8, distance: 11, flicker: 0.1 },
  { floor: 1, pos: [10.9, 1.3, 3.55], color: '#ffb070', intensity: 5, distance: 10, flicker: 0.12 },
  { floor: 1, pos: [7.5, 2.4, -5], color: '#ffa860', intensity: 9, distance: 11 },

  { floor: 2, pos: [-2.5, 1.0, 1.5], color: '#ff9a40', intensity: 7, distance: 8, flicker: 0.25, linkedProp: 'carver' },
  { floor: 2, pos: [6.8, 1.0, 0.6], color: '#ff9a40', intensity: 7, distance: 8, flicker: 0.25, linkedProp: 'carver' },
  { floor: 2, pos: [-4.2, 0.8, 8.8], color: '#ff8030', intensity: 6, distance: 7, flicker: 0.3, linkedProp: 'carver' },
  { floor: 2, pos: [4.2, 0.8, 8.8], color: '#ff8030', intensity: 6, distance: 7, flicker: 0.3, linkedProp: 'carver' },
  { floor: 2, pos: [0, 2.6, 8.4], color: '#ff7020', intensity: 10, distance: 9, flicker: 0.2, linkedProp: 'carver' },
  { floor: 2, pos: [0, 2.6, 3], color: '#a8b8d8', intensity: 14, distance: 16 },
];

/** Positions of sounds that matter to the puzzle, used for captions and spatial volume. */
export const soundSources: { id: string; floor: number; pos: Vec3 }[] = [
  { id: 'ticking', floor: 0, pos: [11.5, 1.6, -9.3] },
  { id: 'fire', floor: 0, pos: [11.5, 0.8, 6.5] },
  { id: 'heartbeat', floor: 0, pos: [10.4, 1.6, -3.5] },
  { id: 'water', floor: 1, pos: [-10.9, 0.7, -7.4] },
  { id: 'lullaby', floor: 2, pos: [6, 1.8, 5.5] },
  { id: 'breath', floor: 2, pos: [0, 2, 8.7] },
];
