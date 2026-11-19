# Asset attributions and licenses

Runtime copies live under `public/`. Source packs live under `assets/props/` and `assets/vendor/`.

## 3D models

- **KayKit Furniture Bits**, Kay Lousberg: https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
  - License: CC0 1.0. Runtime: `public/models/furniture/`.
- **LOWHO Pumpkin Monster (Free Pack)**, Standout 7: https://standout7.itch.io/lowho-pumpkin-monster
  - License: Standout 7 Game Asset License (`assets/props/Pumpkin_Monster_Free/LICENSE.txt`). Use in games is allowed. **Redistributing the original files on their own, or making them downloadable independently, is not.** A public repository containing the FBX files conflicts with this unless Standout 7 gives written permission.
  - Runtime: `public/models/monsters/pumpkin_monster.fbx`, `jack_o_lantern.fbx`, `pumpkin.fbx`, `LOWHO.png`.
- **MOURNVEIL – The Hollow Specter**, imaginais: https://imaginais.itch.io/mournveil-the-hollow-specter
  - License: **not stated on the page or in the download.** Treat as all rights reserved until the creator confirms. Runtime: `public/models/monsters/mournveil.glb`.
- **THE RIBBED HOLLOW – Retro PSX Monster**, imaginais: https://imaginais.itch.io/the-ribbed-hollow-retro-psx-monster
  - License: **not stated on the page or in the download.** Treat as all rights reserved until the creator confirms. Runtime: `public/models/monsters/ribbed_hollow.glb`.
- **Exploration Objects**, Elbolilloduro: https://elbolilloduro.itch.io/exploration-objects
  - License: CC0. Runtime: `public/models/devices/`.
- **Halloween PSX pack** (coffins, candles, spiderwebs, scarecrow, body parts, witch): source URL and license **TODO**. Runtime: `public/models/halloween/`.

## Textures

- **Horror Texture Pack**, Screaming Brain Studios: https://opengameart.org/content/horror-texture-pack
  - License: CC0. Runtime: `public/textures/house/` and `public/textures/horror/`.

## Audio

- Heartbeat sounds, bart: https://opengameart.org/content/heartbeat-sounds (CC0) — `heartbeat_slow_0.wav`
- Old elevator door, sinny: https://opengameart.org/content/old-elevator-door (CC0) — `old_elevator_door.mp3`
- Creaky Door Hinge Spooky, w.forster.1@gmail.com: https://opengameart.org/content/creaky-door-hinge-spooky (CC0) — `creaky_door_hinge.wav`
- Horror breathing, primbal: https://opengameart.org/content/horror-breathing (CC0) — `horror_breathing.wav`
- Abandoned passages horror ambience loop, congusbongus: https://opengameart.org/content/abandoned-passages-horror-ambience-loop (CC0) — `abandoned_passages.ogg`
- The clock ticking, fire crackle, and humming drones are synthesised at runtime in `src/game/audio.ts`.

Captions carry every sound, so the game is fully playable when clips are missing or muted.
