# Foley of the Dead — Implementation Plan
**Kiroween 2026 | Frankenstein Track | Deadline: Dec 4, 2026, 2:00 PM PT**

## 1. One-Sentence Pitch
In a haunted house, every sound is a visible object you can steal and graft onto another thing. Pull [HEARTBEAT] out of a charging monster and it drops dead; give it to a dead lift and it breathes open. Each sound exists only once, so solving one puzzle breaks another. Fully playable with sound off (captions are the objects).

---

## 2. Why This Is Frankenstein Track
- **Web Audio API** + **Three.js 3D engine** + **headless TypeScript game core** stitched into one app.
- Sounds are treated as transferable data objects, not background music.
- Property-based testing inside a game (unusual + verifiable).
- Accessibility as core mechanic (captions-as-items means deaf players play identically).
- No other hackathon entry is stitching audio-engineering + 3D game runtime + formal verification + accessibility this way.

---

## 3. Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Runtime | Browser (Chrome/Edge/Firefox/Safari) | Zero install for judges |
| Build tool | Vite 5 | Fast dev, easy deploy to GitHub Pages |
| Language | TypeScript 5 | Strict types catch game-logic bugs early |
| 3D engine | Three.js r184 | Reference: messenger-copy uses Three.js r184 + SvelteKit |
| Audio | Web Audio API | Native, no latency, works headless for testing |
| Testing | Vitest + fast-check | Property-based testing on pure game core |
| Package manager | npm (matching your setup) | Simple, no extra tools |
| Deploy | GitHub Pages | Free, public URL for judges |
| IDE | Kiro IDE / CLI / Web | Specs, hooks, steering, MCP, custom agents |

---

## 4. Repository Structure
```
foley-of-the-dead/
├── index.html                      # Entry page: canvas + caption overlay + mute toggle
├── package.json                    # Vite, Three.js, Vitest, fast-check
├── vite.config.ts                  # Dev server + test config
├── tsconfig.json                   # Strict TS
├── .gitignore                      # node_modules, dist, .env IGNORED. /.kiro NOT ignored.
├── LICENSE                         # MIT (required: detectable in GitHub About)
├── README.md                       # Features + how Kiro was used
├── IMPLEMENTATION_PLAN.md          # This file
├── public/
│   └── sounds/                     # Royalty-free WAV/MP3 clips (heartbeat, footsteps, scream, snore)
│   └── models/                     # Free glTF/GLB placeholders (box/sphere meshes for MVP)
│   └── textures/                   # Simple horror palette (dark wood, fog gradients)
├── src/
│   ├── main.ts                     # App bootstrap: init Three.js + game core + input
│   ├── game/
│   │   ├── types.ts                # SoundDef, PropDef, BehaviorId, GameState, GameAction
│   │   ├── core.ts                 # HEADLESS engine: grab(), transfer(), undo(), apply() — pure TS
│   │   ├── undo.ts                 # Command stack with snapshot restore
│   │   ├── audio.ts                # Web Audio API wrapper: playSound(), stopAll(), gain control
│   │   ├── render.ts               # Three.js adapter: scene, camera, renderer, prop meshes
│   │   └── invariants.test.ts      # fast-check PBT suite
│   ├── scenes/
│   │   ├── intro.ts                # Main menu + instructions
│   │   ├── room1.ts                # Tutorial: monster heartbeat → lift
│   │   ├── room2.ts                # Twist: player's own footsteps grabbable
│   │   └── room3.ts                # Payoff: sound chaining (scream → guard drops key)
│   └── ui/
│       ├── caption.ts              # [HEARTBEAT] overlay text
│       ├── mute-toggle.ts          # Audio on/off button
│       └── crosshair.ts            # Center reticle
├── assets/
│   ├── sounds/
│   │   └── manifest.json           # caption → behavior → clipUrl registry
│   └── props/
│       └── manifest.json           # prop id → Three.js geometry/material → response map
└── .kiro/                          # REQUIRED at root. NEVER add to .gitignore.
    ├── specs/
    │   └── game-mechanics.md       # Requirements → Design → Tasks (Kiro spec-driven)
    ├── hooks/
    │   └── sound-validation.js     # Pre-commit: reject audio files without captions in manifest
    └── steering/
        └── architecture.md         # Three.js naming, state-machine inputs, audio loudness rules
```

---

## 5. Core Game Engine (Headless, Pure TypeScript)
This is 70% of the game. It has **zero** dependency on Three.js, DOM, or Web Audio. It runs in Node for testing.

### 5.1 Types (`src/game/types.ts`)
```ts
export type BehaviorId = 'heartbeat' | 'footsteps' | 'scream' | 'snore';

export interface SoundDef {
  id: string;
  caption: string;        // "[HEARTBEAT]" — always visible on screen
  behavior: BehaviorId;   // what the sound does
  clipUrl: string;        // path to audio file
}

export interface PropResponse {
  riveInputOrThreeAnimation: string; // e.g. "isAlive", "isDead", "isWalking"
  effect: 'die' | 'wake' | 'walk' | 'sleep' | 'shake' | 'none';
}

export interface PropDef {
  id: string;
  label: string;          // "Charging Monster", "Dead Lift", "Coffin"
  responseMap: Partial<Record<BehaviorId, PropResponse>>; // how THIS prop reacts to each verb
}

export interface PropState {
  id: string;
  currentSound: string | null; // sound id attached, or null
}

export interface GameState {
  version: number;
  roomId: string;
  playerHand: string | null;   // sound id being carried, or null
  props: Record<string, PropState>;
  history: GameAction[];
}

export type GameAction =
  | { type: 'GRAB'; soundId: string; fromPropId: string }
  | { type: 'DROP'; soundId: string; toPropId: string }
  | { type: 'UNDO' };
```

### 5.2 Engine (`src/game/core.ts`)
Pure functions only. No `document`, no `window`, no `AudioContext`.

- `createInitialState(roomId, sounds, props): GameState` — every sound starts owned by exactly one prop.
- `apply(state, action, lookup): GameState` — returns new state or throws on invalid move.
  - GRAB: requires target prop owns the sound; player hand must be empty.
  - DROP: requires player holds the sound; target prop can accept it.
  - UNDO: restores previous snapshot from history.
- `getOwners(state): string[]` — returns all sound IDs currently owned (props + player hand). Used by PBT.

### 5.3 Undo Stack (`src/game/undo.ts`)
- `push(state)`: snapshot before mutation.
- `undo(state): GameState | null` — pops last snapshot.
- Max history depth: 50 (prevents memory growth).

### 5.4 Audio (`src/game/audio.ts`)
- `AudioManager` class wrapping `AudioContext`.
- `playSound(clipUrl: string, volume: number)` — creates `AudioBufferSourceNode`, connects to gain.
- `stopAll()` — stops all active sources.
- `setMuted(muted: boolean)` — mutes master gain. **Does not stop game logic.**
- Preload all clips on init; decode to buffers.

### 5.5 Three.js Renderer (`src/game/render.ts`)
- `initScene(canvas: HTMLCanvasElement)` — scene, perspective camera, WebGLRenderer, fog (horror mood).
- `addProp(propDef, position)` — creates `THREE.Mesh` (box/sphere placeholder for MVP; swap to glTF later), adds to scene.
- `updateProp(propId, state)` — plays animation or swaps material color when prop gains/loses sound:
  - No sound → dark grey / idle
  - Has sound → red pulse / active
  - Died → falls over / disappears
- `raycastClick(x, y)` — returns clicked prop ID (or null).
- `renderLoop(state)` — syncs Three.js objects to current `GameState`.

---

## 6. Audio Manifest (`assets/sounds/manifest.json`)
```json
{
  "sounds": [
    {
      "id": "s_heartbeat",
      "caption": "[HEARTBEAT]",
      "behavior": "heartbeat",
      "clipUrl": "public/sounds/heartbeat.wav",
      "ownerProp": "prop_monster"
    },
    {
      "id": "s_footsteps",
      "caption": "[FOOTSTEPS]",
      "behavior": "footsteps",
      "clipUrl": "public/sounds/footsteps.wav",
      "ownerProp": "prop_player_feet"
    },
    {
      "id": "s_scream",
      "caption": "[SCREAM]",
      "behavior": "scream",
      "clipUrl": "public/sounds/scream.wav",
      "ownerProp": "prop_guard"
    },
    {
      "id": "s_snore",
      "caption": "[SNORE]",
      "behavior": "snore",
      "clipUrl": "public/sounds/snore.wav",
      "ownerProp": "prop_coffin"
    }
  ]
}
```

---

## 7. Prop Manifest (`assets/props/manifest.json`)
```json
{
  "props": [
    {
      "id": "prop_monster",
      "label": "Charging Monster",
      "geometry": "box",
      "color": 0x8b0000,
      "position": [4, 0, -5],
      "responseMap": {
        "heartbeat": { "effect": "none", "note": "keeps monster alive" },
        "scream": { "effect": "shake", "note": "monster flinches" }
      },
      "diesWhenSoundRemoved": "s_heartbeat"
    },
    {
      "id": "prop_lift",
      "label": "Dead Lift",
      "geometry": "box",
      "color": 0x333333,
      "position": [-4, 0, -5],
      "responseMap": {
        "heartbeat": { "effect": "wake", "note": "lift breathes and opens" }
      }
    },
    {
      "id": "prop_coffin",
      "label": "Coffin",
      "geometry": "box",
      "color": 0x2a2a2a,
      "position": [0, 0, 3],
      "responseMap": {
        "footsteps": { "effect": "walk", "note": "coffin walks you across room" }
      }
    }
  ]
}
```

---

## 8. Rooms & Content
### Room 1 — Tutorial (The Hook)
- Charging monster blocks corridor. It owns `[HEARTBEAT]`.
- Player grabs heartbeat → monster drops dead (animation + caption "[HEARTBEAT]" leaves).
- Player drops heartbeat on dead lift → lift wakes, doors open.
- **This is the 10-second video moment.**

### Room 2 — Twist
- Player's own `[FOOTSTEPS]` is grabbable from the player prop.
- Give footsteps to coffin → coffin walks you across spike pit.
- Now you walk silently (guard doesn't hear you), but coffin makes noise.
- Manage *absence* as a resource.

### Room 3 — Payoff
- `[SCREAM]` startles guard → guard drops key.
- Key unlocks sound vault → contains `[SNORE]`.
- Give snore to guard → guard sleeps → exit door opens.
- Replayable: players experiment with different sound combinations.

---

## 9. Kiro Integration (Disqualification Axis — Plan Before Code)
### `.kiro/specs/game-mechanics.md`
Structure: Requirements → Design → Tasks.
- Req 1: Sound exists on exactly one prop at all times.
- Req 2: Every move can be undone.
- Req 3: Every room is solvable from any reachable state.
- Req 4: Game state identical with audio on vs off.
- Design: headless core + Three.js view + Web Audio.
- Tasks: week-by-week breakdown below.

### `.kiro/hooks/sound-validation.js`
Pre-commit hook. Scans `public/sounds/` for audio files. Rejects any `.wav`/`.mp3` not referenced in `assets/sounds/manifest.json` with a caption. This is your visible "Kiro hook" story.

### `.kiro/steering/architecture.md`
- Three.js: use BoxGeometry/SphereGeometry for MVP (no rigged models).
- Naming: prop IDs match manifest exactly.
- Audio: all clips normalized to −14 LUFS; caption required for every clip.
- No genAI audio synthesis in MVP (pre-recorded clips only).

### Kiro Write-Up Template (in README.md)
- **Kiro IDE/CLI/Web/Crew:** which you used and how they differed.
- **Custom agents:** any agent you created (e.g., "sound-balancer agent") and impact.
- **Agent hooks:** specific workflows automated (sound validation, spec scaffolding).
- **Spec-driven development:** how the spec structured the build vs vibe coding.
- **Steering docs:** strategy that made the biggest difference.
- **MCP:** how extending Kiro helped (e.g., Context7 for Three.js docs, or filesystem MCP for asset checks).
- **PBT:** what issues PBT caught that unit tests missed.
- **Kiro powers:** which powers you used.

---

## 10. Property-Based Tests (`src/game/invariants.test.ts`)
Using `fast-check`:
1. **Sound uniqueness:** After any sequence of valid GRAB/DROP/UNDO, every sound ID appears at most once across all props + player hand.
2. **Undo identity:** Applying UNDO after GRAB returns exactly the prior state (deep equality).
3. **Mute invariance:** Running 1,000 random action sequences with audio on vs off produces identical final `GameState` (audio is pure view).
4. **Solvability spot-check:** BFS over state graph from room start state finds a path to room-complete state (limited depth for performance).
5. **No dangling references:** Every `currentSound` on a prop exists in the sound registry.

Run: `npm test` → must be green before every commit.

---

## 11. Week-by-Week Build Schedule

### Week 1: Prototype + Kill Test (Nov 18–24)
| Day | Task | Owner |
|---|---|---|
| Mon | Repo scaffold, Vite + Three.js scene, headless core types + `apply()` | Both |
| Tue | Audio manager + preload, grab/drop/undo wired to Three.js clicks | Both |
| Wed | Room 1 built: monster + lift + heartbeat transfer animation | Both |
| Thu | Room 1 kill test: 8 newcomers, no instructions. Criteria below. | Both |
| Fri | Fix kill-test blockers; add Room 2 skeleton | Both |
| Sat | PBT suite written and green | Both |
| Sun | Hard go/no-go on Foley. If kill test fails, pivot to STATIC. | Both |

**Kill Test Criteria (must ALL pass):**
- 6 of 8 finish Room 1 in 2–3 minutes.
- 5 of 8 predict a sound transfer before trying it.
- 5 of 8 choose to play Room 2.
- 3 of 4 sound-off players solve Room 2.
- 4 of 5 people who see only the 10-second hook can retell it.

**Kill if any happen:**
- People solve by dragging every sound onto everything.
- Rooms need one-off rules (not data-driven).
- People remember "stealing sounds" but can't say what it changed.

### Week 2: Content + Kiro Layer (Nov 25–Dec 1)
| Day | Task |
|---|---|
| Mon | Room 2 + Room 3 built with Three.js props |
| Tue | Real sound design: pre-recorded royalty-free clips, loudness normalized |
| Wed | Rive/animation swap: if using placeholders, polish Three.js materials + fog |
| Thu | `.kiro/` specs, hooks, steering docs finished; PBT expanded |
| Fri | Accessibility pass: mute mode verified identical, captions readable |
| Sat | Internal playtest + video storyboard locked |
| Sun | Request 4,000 Kiro credits (due Dec 1, 48h processing) |

### Week 3: Video + Submission (Dec 2–4)
| Day | Task |
|---|---|
| Mon | Record ≤3 min YouTube video. First 10 seconds: monster charges → grab [HEARTBEAT] → monster drops → drop on lift → lift breathes open. |
| Tue | Video edit + captions. Test on mute. |
| Wed | Save Devpost draft submission. Verify `/.kiro/` in repo, not in `.gitignore`. Verify LICENSE visible in GitHub About. |
| Thu | Deploy to GitHub Pages. Verify working URL loads in incognito. |
| Fri | Submit before 2:00 PM PT. |

---

## 12. Submission Checklist
- [ ] Public GitHub repo with all source, assets, instructions
- [ ] Detectable open-source license (MIT) visible in GitHub About section
- [ ] `/.kiro/` directory at root, NOT in `.gitignore`
- [ ] Working app URL (GitHub Pages) — testable for free
- [ ] Demo video ≤ 3 minutes, public YouTube, no copyrighted music
- [ ] Text description of features
- [ ] Kiro write-up in English (hooks, specs, steering, MCP, PBT, powers)
- [ ] Credentials (if any) in private Devpost form only
- [ ] Submitted before Dec 4, 2:00 PM PT

---

## 13. Risk Mitigation
| Risk | Mitigation |
|---|---|
| Neither knows Three.js | Use BoxGeometry/SphereGeometry placeholders for MVP; no rigged models. Reference messenger-copy patterns. |
| Audio latency on judge machines | Web Audio API is low-latency; fallback: captions work without sound. |
| Browser audio policy (autoplay blocked) | Require first user click to init AudioContext (standard). |
| Kill test fails | Pivot to STATIC (already designed, shares audio + Rive/Three.js work). |
| Not enough content | 3 rooms is enough for a 3-min video; replayability comes from sound combinations, not level count. |

---

## 14. Immediate Next Step
Run this in the folder:

```powershell
cd "C:\Users\divya\OneDrive\Desktop\sruff\hackathons\foley-of-the-dead"
npm install
npm run dev
```

Open `http://localhost:5173` — you should see the prototype shell with canvas and caption overlay.

The next file to build is `src/game/types.ts` followed by `src/game/core.ts`. Everything else (Three.js, audio, rooms) plugs into that pure core.
