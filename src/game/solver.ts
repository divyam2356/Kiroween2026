import { apply, canTravel, isPropVisible, lookupForRoom } from './core';
import type { GameAction, GameState, PropDef, RoomDef } from './types';

/**
 * Breadth-first search over puzzle states. It ignores view-only timing (a haunting that
 * fades in and out) but respects every rule in the data: tools, conditions, one hand,
 * and which floors the player can physically reach.
 */
export type SolverStep = GameAction | { type: 'TRAVEL'; propId: string };

interface Node {
  state: GameState;
  zone: number;
  path: SolverStep[];
}

const HOUSE_FLOORS = new Set([0, 1]);

function zoneOf(floor: number): number {
  return HOUSE_FLOORS.has(floor) ? 0 : floor;
}

function reachable(prop: PropDef, zone: number): boolean {
  return prop.floor === -1 || zoneOf(prop.floor) === zone;
}

function keyOf(state: GameState, zone: number): string {
  const items = Object.keys(state.props).sort().map((id) => state.props[id].currentItemId ?? '-').join(',');
  const flags = Object.keys(state.flags).filter((f) => state.flags[f]).sort().join(',');
  return `${zone}|${state.carriedItemId ?? '-'}|${[...state.tools].sort().join(',')}|${items}|${flags}`;
}

function relevantFlags(room: RoomDef): Set<string> {
  const flags = new Set<string>();
  const visit = (conditions?: { flag?: string; notFlag?: string }[]): void => {
    for (const c of conditions ?? []) {
      if (c.flag) flags.add(c.flag);
      if (c.notFlag) flags.add(c.notFlag);
    }
  };
  visit(room.objective.all as never);
  for (const prop of room.props) {
    visit(prop.visibleWhen as never);
    visit(prop.activeWhen as never);
    visit(prop.inspection?.requires as never);
    visit(prop.travel?.requires as never);
    for (const rule of Object.values(prop.take ?? {})) visit(rule.requires as never);
  }
  return flags;
}

export function solve(room: RoomDef, start: GameState, maxNodes = 200_000): SolverStep[] | null {
  const lookup = lookupForRoom(room);
  const usefulFlags = relevantFlags(room);
  const seen = new Set<string>();
  const queue: Node[] = [{ state: start, zone: 0, path: [] }];
  seen.add(keyOf(start, 0));

  for (let head = 0; head < queue.length && head < maxNodes; head += 1) {
    const { state, zone, path } = queue[head];
    if (state.completed) return path;

    const candidates: { step: SolverStep; next: GameState; zone: number }[] = [];
    const tryAction = (action: GameAction): void => {
      try {
        const next = apply(state, action, room, lookup);
        if (next !== state) candidates.push({ step: action, next: { ...next, undoStack: [] }, zone });
      } catch {
        // Illegal moves are simply not edges in the graph.
      }
    };

    for (const prop of room.props) {
      if (!reachable(prop, zone) || !isPropVisible(state, prop)) continue;
      const here = state.props[prop.id];
      if (here.currentItemId) {
        for (const toolId of [null, ...state.tools]) tryAction({ type: 'GRAB', itemId: here.currentItemId, fromPropId: prop.id, toolId });
      }
      if (state.carriedItemId && prop.accepts[state.carriedItemId]) {
        tryAction({ type: 'DROP', itemId: state.carriedItemId, toPropId: prop.id });
      }
      if (prop.inspection && !state.flags[prop.inspection.flag] && usefulFlags.has(prop.inspection.flag)) {
        for (const toolId of [null, ...state.tools]) tryAction({ type: 'INSPECT', propId: prop.id, toolId });
      }
      if (prop.travel && canTravel(state, prop) && zoneOf(prop.travel.toFloor) !== zone) {
        candidates.push({ step: { type: 'TRAVEL', propId: prop.id }, next: state, zone: zoneOf(prop.travel.toFloor) });
      }
    }

    for (const candidate of candidates) {
      const key = keyOf(candidate.next, candidate.zone);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: candidate.next, zone: candidate.zone, path: [...path, candidate.step] });
    }
  }
  return null;
}
