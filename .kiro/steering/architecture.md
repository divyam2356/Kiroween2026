# Browser prototype steering

- Keep the game core free of DOM, Three.js, and Web Audio imports.
- Use named prop IDs from room data as Three.js group names and `userData.propId` values.
- Prefer primitive geometry, fog, simple materials, and a capped renderer pixel ratio.
- Use one requestAnimationFrame loop and avoid per-frame allocations in input and raycast paths.
- Pointer lock is opt-in after a user gesture. Keyboard input must never be required for captions.
- Audio is an optional view. Muting must not change the game state.
- Caption text is always visible for a carried or targeted item.
- Do not add reference repository assets to this project.
- Keep wall and floor surfaces visibly textured under neutral fill light; red lighting is an accent, not the base material.
- A haunting may relocate or fade between authored haunt nodes, but it must never pursue or damage the player.
- Ambient audio is a view layer and must loop without changing puzzle state.

