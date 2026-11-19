# Foley of the Dead

A browser-first, caption-first horror puzzle for Kiroween 2026. Every sound exists once.

You are locked inside the Hollow House: twelve rooms across a ground floor, an upper floor, and an attic. The lift is the only way up, and it says **“I NEED THE VOICE OF THE DEAD.”** Its panel wants three things: a **VOICE**, a **TOUCH**, and a **HEART**.

Each floor gives one of them, and each floor stays asleep until the floor below is cleared:

- **Ground floor, VOICE:** an invisible monster speaks only when the house is silent and can only be seen through a thermal camera.
- **Upper floor, TOUCH:** a dead man's fist opens only for his wife's lullaby, and his handprint hides under the bathroom mirror's steam.
- **Attic, HEART:** the Carver looks away only toward a voice, and the only voice is the one already inside the lift.

Five devices are hidden around the house. Nothing chases you; the monsters appear, watch, and fade. The full solution is in `WALKTHROUGH.md`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Click to capture the mouse.

| Key | Action |
| --- | --- |
| W A S D, Shift | Move, run |
| Mouse | Look |
| E | Use, take, record, graft, examine |
| 1–5, Q, mouse wheel | Select device (same key again to put it away) |
| F | Flashlight |
| J or Tab | Journal of clues |
| Z | Undo |
| R twice | Restart |

## Checks

```bash
npm test          # core rules, a full-house solver, property-based invariants
npm run typecheck
npm run build
```

The solver in `src/game/solver.ts` proves the house can be finished, that the shortest solution is at least 20 steps, and (via fast-check) that random play never reaches a dead end.

## Structure

- `src/game/core.ts`, `types.ts`, `rooms.ts`: headless, data-driven puzzle core. No DOM, Three.js, or audio.
- `src/scenes/houseLayout.ts`: floor plan, prop placement, lights, decor, haunt points.
- `src/game/render.ts`, `prims.ts`, `assets.ts`: Three.js view, collision, monsters, device modes.
- `src/game/audio.ts`: optional audio view. Muting never changes game state.

Asset sources and licenses: `assets/ATTRIBUTIONS.md`.
