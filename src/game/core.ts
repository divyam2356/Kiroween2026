import type {
  Condition,
  GameAction,
  GameLookup,
  GameSnapshot,
  GameState,
  ItemDef,
  PropDef,
  PropState,
  RoomDef,
} from './types';

export const MAX_UNDO_DEPTH = 80;

type ConditionView = Pick<GameSnapshot, 'props' | 'flags' | 'tools'>;

function cloneProps(props: Record<string, PropState>): Record<string, PropState> {
  const next: Record<string, PropState> = {};
  for (const id in props) next[id] = { ...props[id] };
  return next;
}

function snapshotOf(state: GameSnapshot): GameSnapshot {
  return {
    version: state.version,
    roomId: state.roomId,
    carriedItemId: state.carriedItemId,
    tools: [...state.tools],
    props: cloneProps(state.props),
    flags: { ...state.flags },
    completed: state.completed,
  };
}

export function checkCondition(view: ConditionView, condition: Condition): boolean {
  if ('flag' in condition) return view.flags[condition.flag] === true;
  if ('notFlag' in condition) return view.flags[condition.notFlag] !== true;
  if ('has' in condition) return view.props[condition.has[0]]?.currentItemId === condition.has[1];
  if ('notHas' in condition) return view.props[condition.notHas[0]]?.currentItemId !== condition.notHas[1];
  return view.tools.includes(condition.tool);
}

export function checkAll(view: ConditionView, conditions: Condition[] | undefined): boolean {
  if (!conditions) return true;
  for (const condition of conditions) if (!checkCondition(view, condition)) return false;
  return true;
}

export function lookupForRoom(room: RoomDef): GameLookup {
  return {
    items: Object.fromEntries(room.items.map((item) => [item.id, item])),
    props: Object.fromEntries(room.props.map((prop) => [prop.id, prop])),
  };
}

export function createInitialState(room: RoomDef): GameState {
  const lookup = lookupForRoom(room);
  const owned = new Set<string>();
  const props: Record<string, PropState> = {};

  for (const prop of room.props) {
    const currentItemId = room.initialItems[prop.id] ?? null;
    if (currentItemId !== null) {
      if (!lookup.items[currentItemId]) throw new Error(`Unknown initial item: ${currentItemId}`);
      if (owned.has(currentItemId)) throw new Error(`Item has multiple initial owners: ${currentItemId}`);
      owned.add(currentItemId);
    }
    props[prop.id] = { id: prop.id, currentItemId, status: currentItemId ? 'active' : 'idle' };
  }
  for (const propId of Object.keys(room.initialItems)) {
    if (!lookup.props[propId]) throw new Error(`Initial item placed on unknown prop: ${propId}`);
  }
  for (const item of room.items) {
    if (!owned.has(item.id)) throw new Error(`Item has no initial owner: ${item.id}`);
  }

  const state: GameState = {
    version: 0,
    roomId: room.id,
    carriedItemId: null,
    tools: [],
    props,
    flags: {},
    completed: false,
    undoStack: [],
  };
  state.completed = checkAll(state, room.objective.all);
  return state;
}

function requireItem(lookup: GameLookup, itemId: string): ItemDef {
  const item = lookup.items[itemId];
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  return item;
}

function requireProp(lookup: GameLookup, propId: string): PropDef {
  const prop = lookup.props[propId];
  if (!prop) throw new Error(`Unknown prop: ${propId}`);
  return prop;
}

function commit(previous: GameState, next: GameSnapshot, room: RoomDef): GameState {
  next.version = previous.version + 1;
  next.completed = checkAll(next, room.objective.all);
  const undoStack = [...previous.undoStack, snapshotOf(previous)];
  if (undoStack.length > MAX_UNDO_DEPTH) undoStack.shift();
  return { ...next, undoStack };
}

/** Why an action would fail, or null when it is allowed. Used by the HUD to explain locks. */
export function isActive(view: ConditionView, prop: PropDef): boolean {
  return checkAll(view, prop.activeWhen);
}

function dormant(view: ConditionView, prop: PropDef | undefined): string | null {
  if (!prop || isActive(view, prop)) return null;
  return prop.dormantText ?? 'Nothing happens.';
}

export function explainGrab(state: GameSnapshot, propId: string, toolId: string | null, lookup: GameLookup): string | null {
  const prop = lookup.props[propId];
  const propState = state.props[propId];
  const asleep = dormant(state, prop);
  if (asleep) return asleep;
  if (!prop || !propState?.currentItemId) return 'There is nothing to take.';
  const itemId = propState.currentItemId;
  const item = lookup.items[itemId];
  const rule = prop.take?.[itemId];
  if (item?.kind === 'evidence' && state.carriedItemId !== null) return 'Your hands are full. Graft what you carry first.';
  if (rule?.tool && toolId !== rule.tool) {
    const tool = lookup.items[rule.tool];
    if (!state.tools.includes(rule.tool)) return rule.lockedText ?? 'You have nothing that can hold this.';
    return `Select the ${tool?.label ?? 'right tool'} first.`;
  }
  if (!checkAll(state, rule?.requires)) return rule?.lockedText ?? 'It will not come loose.';
  return null;
}

export function explainInspect(state: GameSnapshot, propId: string, toolId: string | null, lookup: GameLookup): string | null {
  const asleep = dormant(state, lookup.props[propId]);
  if (asleep) return asleep;
  const inspection = lookup.props[propId]?.inspection;
  if (!inspection) return 'Nothing more to learn here.';
  if (inspection.tool && toolId !== inspection.tool) return inspection.toolText ?? 'You cannot see anything unusual.';
  if (!checkAll(state, inspection.requires)) return inspection.lockedText ?? 'Nothing happens yet.';
  return null;
}

export function explainDrop(state: GameSnapshot, propId: string, lookup: GameLookup): string | null {
  const prop = lookup.props[propId];
  if (!state.carriedItemId) return 'You are not carrying anything.';
  if (!prop) return 'There is nothing here.';
  const asleep = dormant(state, prop);
  if (asleep) return asleep;
  if (state.props[propId]?.currentItemId) return `${prop.label} already holds something.`;
  if (!prop.accepts[state.carriedItemId]) return `${prop.label} does not want ${lookup.items[state.carriedItemId]?.caption ?? 'that'}.`;
  return null;
}

export function canTravel(state: ConditionView, prop: PropDef): boolean {
  return Boolean(prop.travel) && checkAll(state, prop.travel?.requires);
}

export function isPropVisible(state: ConditionView, prop: PropDef): boolean {
  return checkAll(state, prop.visibleWhen);
}

export function apply(state: GameState, action: GameAction, room: RoomDef, lookup = lookupForRoom(room)): GameState {
  if (state.roomId !== room.id) throw new Error(`State belongs to ${state.roomId}, not ${room.id}`);

  if (action.type === 'UNDO') {
    const previous = state.undoStack.at(-1);
    if (!previous) throw new Error('Nothing to undo.');
    return { ...snapshotOf(previous), undoStack: state.undoStack.slice(0, -1) };
  }

  const next = snapshotOf(state);

  if (action.type === 'INSPECT') {
    const prop = requireProp(lookup, action.propId);
    const reason = explainInspect(state, action.propId, action.toolId ?? null, lookup);
    if (reason) throw new Error(reason);
    const inspection = prop.inspection!;
    if (next.flags[inspection.flag]) return state;
    next.flags[inspection.flag] = true;
    return commit(state, next, room);
  }

  if (action.type === 'GRAB') {
    const item = requireItem(lookup, action.itemId);
    const prop = requireProp(lookup, action.fromPropId);
    if (state.props[action.fromPropId]?.currentItemId !== action.itemId) throw new Error('That is not here.');
    const reason = explainGrab(state, action.fromPropId, action.toolId ?? null, lookup);
    if (reason) throw new Error(reason);
    const rule = prop.take?.[action.itemId];
    next.props[action.fromPropId] = { ...next.props[action.fromPropId], currentItemId: null, status: rule?.status ?? 'idle' };
    if (item.kind === 'tool') next.tools.push(item.id);
    else next.carriedItemId = item.id;
    return commit(state, next, room);
  }

  requireItem(lookup, action.itemId);
  const prop = requireProp(lookup, action.toPropId);
  if (state.carriedItemId !== action.itemId) throw new Error('You are not carrying that.');
  const reason = explainDrop(state, action.toPropId, lookup);
  if (reason) throw new Error(reason);
  const response = prop.accepts[action.itemId];
  if (response.setFlag) next.flags[response.setFlag] = true;
  next.props[action.toPropId] = { ...next.props[action.toPropId], currentItemId: action.itemId, status: response.status };
  next.carriedItemId = null;
  return commit(state, next, room);
}

/** Every item that currently exists somewhere: on a prop, in the hand, or on the tool belt. */
export function getOwners(state: GameSnapshot): string[] {
  const owners: string[] = [];
  for (const id in state.props) {
    const itemId = state.props[id].currentItemId;
    if (itemId) owners.push(itemId);
  }
  if (state.carriedItemId) owners.push(state.carriedItemId);
  owners.push(...state.tools);
  return owners;
}

export function getItemCaption(itemId: string | null, lookup: GameLookup): string | null {
  return itemId ? lookup.items[itemId]?.caption ?? null : null;
}
