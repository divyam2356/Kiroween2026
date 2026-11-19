// Pure data types for the headless game core. No DOM, Three.js, or Web Audio here.

export type ItemKind = 'evidence' | 'tool';

export interface ItemDef {
  id: string;
  label: string;
  kind: ItemKind;
  /** Caption shown on screen. Captions are the objects, so this must always be meaningful. */
  caption: string;
  /** Short hint shown in the tool belt or when carried. */
  blurb: string;
}

/**
 * Conditions are evaluated against item placement and flags. They let room data
 * express "the clock is silent" or "the Hollow still has its heart" without one-off code.
 */
export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { has: [propId: string, itemId: string] }
  | { notHas: [propId: string, itemId: string] }
  | { tool: string };

export type PropStatus = 'idle' | 'active' | 'open' | 'dead' | 'asleep' | 'silent' | 'cold' | 'thawed' | 'lit' | 'dark';

export interface PropResponse {
  status: PropStatus;
  note: string;
  setFlag?: string;
}

export interface PropInspection {
  flag: string;
  text: string;
  repeatText?: string;
  /** Tool the player must have selected for this inspection to reveal anything. */
  tool?: string;
  /** Shown when the right tool is not selected. */
  toolText?: string;
  requires?: Condition[];
  lockedText?: string;
}

export interface PropTake {
  /** Tool required to lift this item, for example the voice recorder for a sound. */
  tool?: string;
  requires?: Condition[];
  lockedText?: string;
  note: string;
  status?: PropStatus;
}

export interface PropTravel {
  /** Floor and landing point are view data, but whether travel is allowed is a puzzle rule. */
  toFloor: number;
  to: [number, number, number];
  yaw: number;
  requires?: Condition[];
  lockedText?: string;
  text: string;
}

export interface PropDef {
  id: string;
  label: string;
  description: string;
  floor: number;
  /** Item ID -> how this prop reacts when that exact item is grafted onto it. */
  accepts: Record<string, PropResponse>;
  /** Item ID -> rules for lifting it off this prop. */
  take?: Record<string, PropTake>;
  inspection?: PropInspection;
  travel?: PropTravel;
  /** View rule: the prop can only be seen and targeted when these hold. */
  visibleWhen?: Condition[];
  /** Puzzle rule: until these hold the prop is dormant. Nothing can be taken, examined, or grafted. */
  activeWhen?: Condition[];
  dormantText?: string;
  /** View rule: only visible while this tool is selected, unless revealFlag is already set. */
  revealTool?: string;
  revealFlag?: string;
}

export interface PropState {
  id: string;
  currentItemId: string | null;
  status: PropStatus;
}

export type Objective = { all: Condition[]; successText: string };

export interface RoomDef {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  items: ItemDef[];
  props: PropDef[];
  initialItems: Record<string, string>;
  objective: Objective;
  /** The elevator goal shown in the HUD. Each socket is a prop that must hold its item. */
  goalSockets: { propId: string; itemId: string; label: string }[];
}

export interface GameSnapshot {
  version: number;
  roomId: string;
  carriedItemId: string | null;
  tools: string[];
  props: Record<string, PropState>;
  flags: Record<string, boolean>;
  completed: boolean;
}

export interface GameState extends GameSnapshot {
  undoStack: GameSnapshot[];
}

export type GameAction =
  | { type: 'GRAB'; itemId: string; fromPropId: string; toolId?: string | null }
  | { type: 'DROP'; itemId: string; toPropId: string }
  | { type: 'INSPECT'; propId: string; toolId?: string | null }
  | { type: 'UNDO' };

export interface GameLookup {
  items: Record<string, ItemDef>;
  props: Record<string, PropDef>;
}
