import { apply, checkAll, isLiftProp, isPropVisible, lookupForRoom, routesOf } from './core';
import type { GameAction, GameState, PropDef, RoomDef } from './types';

/**
 * Breadth-first search over puzzle states. It tracks where the player stands and where the
 * lift car is, and respects every rule in the data: tools, conditions, one hand, locks, and
 * which floors the player can physically reach.
 */
export type SolverStep = GameAction | { type: 'TRAVEL'; propId: string; toFloor: number };

interface Node {
  state: GameState;
  floor: number;
  car: number;
  path: SolverStep[];
}

/** Lift-car props are only reachable when the car is on your floor. Everything else needs you on its floor. */
function reachable(prop: PropDef, floor: number, car: number): boolean {
  return prop.floor === -1 ? car === floor : prop.floor === floor;
}

function keyOf(state: GameState, floor: number, car: number): string {
  const items = Object.keys(state.props).sort().map((id) => state.props[id].currentItemId ?? '-').join(',');
  const flags = Object.keys(state.flags).filter((f) => state.flags[f]).sort().join(',');
  return `${floor}|${car}|${state.carriedItemId ?? '-'}|${[...state.tools].sort().join(',')}|${items}|${flags}`;
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
    for (const route of routesOf(prop)) visit(route.requires as never);
    for (const rule of Object.values(prop.take ?? {})) visit(rule.requires as never);
  }
  return flags;
}

export function solve(room: RoomDef, start: GameState, maxNodes = 200_000): SolverStep[] | null {
  const lookup = lookupForRoom(room);
  const usefulFlags = relevantFlags(room);
  const seen = new Set<string>();
  // The player starts on the ground floor, with the lift car there too.
  const queue: Node[] = [{ state: start, floor: 0, car: 0, path: [] }];
  seen.add(keyOf(start, 0, 0));

  for (let head = 0; head < queue.length && head < maxNodes; head += 1) {
    const { state, floor, car, path } = queue[head];
    if (state.completed) return path;

    const candidates: { step: SolverStep; next: GameState; floor: number; car: number }[] = [];
    const tryAction = (action: GameAction): void => {
      try {
        const next = apply(state, action, room, lookup);
        if (next !== state) candidates.push({ step: action, next: { ...next, undoStack: [] }, floor, car });
      } catch {
        // Illegal moves are simply not edges in the graph.
      }
    };

    for (const prop of room.props) {
      if (!reachable(prop, floor, car) || !isPropVisible(state, prop)) continue;
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
      for (const route of routesOf(prop)) {
        if (route.from !== undefined && route.from !== car) continue;
        if (route.toFloor === floor) continue;
        if (!checkAll(state, route.requires)) continue;
        candidates.push({
          step: { type: 'TRAVEL', propId: prop.id, toFloor: route.toFloor },
          next: state,
          floor: route.toFloor,
          car: isLiftProp(prop) ? route.toFloor : car,
        });
      }
    }

    for (const candidate of candidates) {
      const key = keyOf(candidate.next, candidate.floor, candidate.car);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ state: candidate.next, floor: candidate.floor, car: candidate.car, path: [...path, candidate.step] });
    }
  }
  return null;
}
