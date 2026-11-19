# Foley of the Dead mechanics spec

## Requirements

1. Each transferable item has exactly one owner: a prop or the player's hand, except consumed tools recorded in state.
2. Every valid transfer, inspection, or capture can be undone with an immutable snapshot.
3. A prop accepts an item only when its room data declares that item ID.
4. A capture interaction can transform a declared tool into a declared sound item.
5. The state core is independent of the browser, renderer, and audio layer.
6. Captions expose the same puzzle information when audio is muted.
7. The Room 1 haunting never chases or damages the player.
8. Room 1 is complete when the captured heartbeat is attached to the elevator.

## Design

The core uses generic items. Sounds use captions and optional clip URLs; future horror keys such as fingers can use the same item-transfer model. Three.js is a view over the state. Web Audio is optional and cannot mutate state.

## Tasks

- Build the pure state core and invariant tests.
- Build first-person low-poly rooms with raycast interaction.
- Add Room 2 and Room 3 data skeletons.
- Add optional pre-recorded clips after the caption-first prototype is tested.
