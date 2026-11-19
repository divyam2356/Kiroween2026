import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { apply, canTravel, createInitialState, explainGrab, getOwners, isActive, isPropVisible, lookupForRoom } from './core';
import { house } from './rooms';
import { solve } from './solver';
import type { GameAction, GameState } from './types';

const lookup = lookupForRoom(house);
const allItems = house.items.map((item) => item.id).sort();

const grab = (itemId: string, fromPropId: string, toolId: string | null = null): GameAction => ({ type: 'GRAB', itemId, fromPropId, toolId });
const drop = (itemId: string, toPropId: string): GameAction => ({ type: 'DROP', itemId, toPropId });
const inspect = (propId: string, toolId: string | null = null): GameAction => ({ type: 'INSPECT', propId, toolId });
const REC = 'tool_recorder';

function run(actions: GameAction[], from = createInitialState(house)): GameState {
  return actions.reduce((state, action) => apply(state, action, house, lookup), from);
}

/** The ground floor, solved: this is also the walkthrough in WALKTHROUGH.md. */
const groundFloor: GameAction[] = [
  inspect('elevator'),
  grab('tool_recorder', 'study_drawer'),
  grab('ev_fire', 'parlor_fireplace', REC),
  drop('ev_fire', 'pantry_door'),
  grab('tool_thermal', 'pantry_shelf'),
  inspect('hollow', 'tool_thermal'),
  grab('ev_ticking', 'dining_clock', REC),
  drop('ev_ticking', 'hall_coffin'),
  grab('ev_voice', 'hollow', REC),
  drop('ev_voice', 'socket_voice'),
];

const upperFloor: GameAction[] = [
  grab('tool_uv', 'kitchen_counter'),
  grab('ev_lullaby', 'specter', REC),
  drop('ev_lullaby', 'corpse'),
  grab('tool_camera', 'corpse_hand'),
  grab('ev_water', 'bath_tub', REC),
  drop('ev_water', 'washbasin'),
  inspect('bathroom_mirror', 'tool_uv'),
  grab('ev_print', 'bathroom_mirror', 'tool_camera'),
  drop('ev_print', 'socket_touch'),
];

const attic: GameAction[] = [
  grab('ev_voice', 'socket_voice'),
  drop('ev_voice', 'scarecrow'),
  grab('ev_heart', 'carver', REC),
  drop('ev_heart', 'socket_heart'),
  grab('ev_voice', 'scarecrow'),
  drop('ev_voice', 'socket_voice'),
];

function randomLegalAction(state: GameState, seed: number): GameAction | null {
  const options: GameAction[] = [];
  for (const prop of house.props) {
    if (prop.floor === 2 || !isPropVisible(state, prop)) continue;
    const here = state.props[prop.id];
    for (const toolId of [null, ...state.tools]) {
      if (here.currentItemId) options.push(grab(here.currentItemId, prop.id, toolId));
      if (prop.inspection) options.push(inspect(prop.id, toolId));
    }
    if (state.carriedItemId && prop.accepts[state.carriedItemId]) options.push(drop(state.carriedItemId, prop.id));
  }
  if (state.undoStack.length) options.push({ type: 'UNDO' });
  const legal = options.filter((action) => {
    try { apply(state, action, house, lookup); return true; } catch { return false; }
  });
  return legal.length ? legal[Math.abs(seed) % legal.length] : null;
}

describe('the Hollow House, one floor at a time', () => {
  it('starts with every item owned exactly once', () => {
    expect(getOwners(createInitialState(house)).sort()).toEqual(allItems);
  });

  it('can be finished by following the walkthrough', () => {
    const end = run([...groundFloor, ...upperFloor, ...attic]);
    expect(end.completed).toBe(true);
  });

  it('is solvable from the start, and the shortest solution is a real puzzle', () => {
    const path = solve(house, createInitialState(house));
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThanOrEqual(20);
  }, 30_000);

  it('needs the recorder, thermal camera, UV lamp, and photo camera; the EMF detector is a finding aid', () => {
    const path = solve(house, createInitialState(house))!;
    const tools = new Set(path.filter((s) => s.type === 'GRAB' && s.itemId.startsWith('tool_')).map((s) => (s as { itemId: string }).itemId));
    expect([...tools].sort()).toEqual(['tool_camera', 'tool_recorder', 'tool_thermal', 'tool_uv']);
  }, 30_000);

  it('keeps the upper floor dormant until the ground floor is cleared', () => {
    const before = run(groundFloor.slice(0, -1));
    expect(isActive(before, lookup.props.nursery_crib)).toBe(false);
    expect(isPropVisible(before, lookup.props.specter)).toBe(false);
    expect(explainGrab(before, 'nursery_crib', null, lookup)).toMatch(/waiting for something downstairs/);
    expect(() => run([drop('ev_voice', 'washbasin')], before)).toThrow();
    const after = run(groundFloor);
    expect(isActive(after, lookup.props.nursery_crib)).toBe(true);
    expect(isPropVisible(after, lookup.props.specter)).toBe(true);
  });

  it('opens two threads at once on the ground floor (not linear)', () => {
    const start = run([grab('tool_recorder', 'study_drawer')]);
    expect(() => run([grab('ev_ticking', 'dining_clock', REC)], start)).not.toThrow();
    expect(() => run([grab('ev_fire', 'parlor_fireplace', REC)], start)).not.toThrow();
  });

  it('only lets the Hollow speak once it is seen and the house is silent', () => {
    const marked = run(groundFloor.slice(0, 6));
    expect(() => run([grab('ev_voice', 'hollow', REC)], marked)).toThrow(/ticking/);
    const silent = run([grab('ev_ticking', 'dining_clock', REC), drop('ev_ticking', 'hall_coffin')], marked);
    expect(run([grab('ev_voice', 'hollow', REC)], silent).carriedItemId).toBe('ev_voice');
  });

  it('hides the handprint until the hot water is turned off', () => {
    const upstairs = run([...groundFloor, ...upperFloor.slice(0, 4)]);
    expect(() => run([inspect('bathroom_mirror', 'tool_uv')], upstairs)).toThrow(/steam/);
    const drained = run([grab('ev_water', 'bath_tub', REC), drop('ev_water', 'washbasin')], upstairs);
    expect(run([inspect('bathroom_mirror', 'tool_uv')], drained).flags.print_revealed).toBe(true);
  });

  it('strands you in the attic while the voice is out of the lift', () => {
    const atAttic = run([...groundFloor, ...upperFloor]);
    expect(canTravel(atAttic, lookup.props.elevator_attic)).toBe(true);
    const stranded = run(attic.slice(0, 2), atAttic);
    expect(canTravel(stranded, lookup.props.elevator_attic)).toBe(false);
  });

  it('allows only one piece of evidence in hand at a time', () => {
    const holding = run([grab('tool_recorder', 'study_drawer'), grab('ev_ticking', 'dining_clock', REC)]);
    expect(() => run([grab('ev_fire', 'parlor_fireplace', REC)], holding)).toThrow('hands are full');
  });

  it('restores the exact previous state on undo', () => {
    const before = run([grab('tool_recorder', 'study_drawer')]);
    const after = run([grab('ev_ticking', 'dining_clock', REC)], before);
    expect(run([{ type: 'UNDO' }], after)).toEqual(before);
  });

  it('keeps every item unique across random legal play', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 120 }), (seeds) => {
        let state = createInitialState(house);
        for (const seed of seeds) {
          const action = randomLegalAction(state, seed);
          if (!action) break;
          state = apply(state, action, house, lookup);
          const owners = getOwners(state);
          expect(new Set(owners).size).toBe(owners.length);
          expect(owners.sort()).toEqual(allItems);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('stays solvable from any reachable state (no dead ends)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 40 }), (seeds) => {
        let state = createInitialState(house);
        for (const seed of seeds) {
          const action = randomLegalAction(state, seed);
          if (!action || action.type === 'UNDO') continue;
          state = apply(state, action, house, lookup);
        }
        expect(solve(house, { ...state, undoStack: [] })).not.toBeNull();
      }),
      { numRuns: 12 },
    );
  }, 90_000);

  it('does not let audio settings change the state machine', () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { minLength: 1, maxLength: 60 }), (seeds) => {
        let withAudio = createInitialState(house);
        let muted = createInitialState(house);
        for (const seed of seeds) {
          const action = randomLegalAction(withAudio, seed);
          if (!action) break;
          withAudio = apply(withAudio, action, house, lookup);
          muted = apply(muted, action, house, lookup);
        }
        expect(withAudio).toEqual(muted);
      }),
      { numRuns: 30 },
    );
  });
});
