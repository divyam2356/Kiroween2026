import './style.css';
import { apply, canTravel, createInitialState, explainDrop, explainGrab, explainInspect, getItemCaption, isActive, lookupForRoom } from './game/core';
import { AudioManager } from './game/audio';
import { GameRenderer } from './game/render';
import { house } from './game/rooms';
import { FLOOR_NAMES, START, soundSources } from './scenes/houseLayout';
import type { GameAction, GameState, PropDef } from './game/types';

function el<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const app = el('#app');
const canvas = el<HTMLCanvasElement>('#game-canvas');
const ui = {
  location: el('#location'),
  goal: el('#goal'),
  caption: el('#caption'),
  crosshair: el('#crosshair'),
  prompt: el('#target-prompt'),
  toast: el('#toast'),
  heard: el('#heard'),
  emf: el('#emf'),
  emfBars: el('.emf-bars'),
  belt: el('#belt'),
  resume: el('#resume'),
  journal: el('#journal'),
  journalList: el('#journal-list'),
  start: el('#start-card'),
  end: el('#end-card'),
  endCopy: el('#end-copy'),
  fade: el('#fade'),
  overlay: el('#tool-overlay'),
  mute: el<HTMLButtonElement>('#mute-toggle'),
  startButton: el<HTMLButtonElement>('#start-button'),
  againButton: el<HTMLButtonElement>('#again-button'),
};

const room = house;
const lookup = lookupForRoom(room);
const TOOL_SLOTS = ['tool_recorder', 'tool_uv', 'tool_emf', 'tool_thermal', 'tool_camera'];
const TOOL_VERBS: Record<string, string> = { tool_recorder: 'RECORD', tool_camera: 'PHOTOGRAPH' };

const audio = new AudioManager();
let state: GameState = createInitialState(room);
let selectedTool: string | null = null;
let flashlightOn = false;
let playing = false;
let traveling = false;
let restartArmedUntil = 0;
let toastTimer = 0;
let captionTimer = 0;
let glimpseUntil = 0;

for (let i = 0; i < 8; i += 1) ui.emfBars.appendChild(document.createElement('i'));

const renderer = new GameRenderer(canvas, {
  onInteract: () => interact(),
  onUndo: () => undo(),
  onSelectTool: (slot) => selectSlot(slot),
  onCycleTool: (direction) => cycleTool(direction),
  onFlashlight: () => toggleFlashlight(),
  onJournal: () => toggleJournal(),
  onRestart: () => requestRestart(),
  onTargetChange: () => updatePrompt(),
  onPointerLockChange: (locked) => { ui.resume.hidden = locked || !playing || traveling; },
  onGlimpse: () => {
    glimpseUntil = performance.now() + 4500;
    void audio.playOnce('/sounds/creaky_door_hinge.wav', 0.25);
  },
});
renderer.build(room, state);

// ── Small HUD helpers ─────────────────────────────────────────────

function showToast(message: string, ms = 3800): void {
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), ms);
}

/** Big centred caption. The lift's demand is spoken, so it gets the trembling "voice" style. */
function announce(message: string, voice = false, ms = 4200): void {
  ui.caption.textContent = message;
  ui.caption.classList.toggle('voice', voice);
  window.clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => { ui.caption.classList.remove('voice'); updateCarried(); }, ms);
}

function updateCarried(): void {
  const carried = getItemCaption(state.carriedItemId, lookup);
  if (!ui.caption.classList.contains('voice')) ui.caption.textContent = carried ? `CARRYING  ${carried}` : '';
}

function flash(): void {
  ui.overlay.classList.remove('flash');
  void ui.overlay.offsetWidth;
  ui.overlay.classList.add('flash');
}

function labelFor(prop: PropDef): string {
  if (prop.revealTool && !(prop.revealFlag && state.flags[prop.revealFlag]) && selectedTool !== prop.revealTool) return 'Something feels wrong here';
  return prop.label;
}

// ── Devices ──────────────────────────────────────────────────────

function renderBelt(): void {
  ui.belt.replaceChildren(...TOOL_SLOTS.map((toolId, index) => {
    const slot = document.createElement('div');
    const owned = state.tools.includes(toolId);
    slot.className = `slot${owned ? ' owned' : ''}${selectedTool === toolId ? ' selected' : ''}`;
    const item = lookup.items[toolId];
    slot.innerHTML = owned ? `<b>${index + 1} · ${item.label.toUpperCase()}</b>${item.blurb}` : `<b>${index + 1} · ???</b>not found`;
    return slot;
  }));
  const carry = document.createElement('div');
  carry.className = `slot${state.carriedItemId ? ' carry owned' : ''}`;
  carry.innerHTML = `<b>HAND</b>${getItemCaption(state.carriedItemId, lookup) ?? 'empty'}`;
  ui.belt.appendChild(carry);
}

function setTool(toolId: string | null): void {
  selectedTool = toolId && state.tools.includes(toolId) ? toolId : null;
  renderer.setSelectedTool(selectedTool);
  app.classList.remove('mode-uv', 'mode-thermal', 'mode-camera', 'mode-recorder', 'mode-emf');
  const modes: Record<string, string> = { tool_uv: 'mode-uv', tool_thermal: 'mode-thermal', tool_camera: 'mode-camera', tool_recorder: 'mode-recorder', tool_emf: 'mode-emf' };
  if (selectedTool) app.classList.add(modes[selectedTool]);
  ui.emf.hidden = selectedTool !== 'tool_emf';
  renderBelt();
  updatePrompt();
}

function selectSlot(slot: number): void {
  const toolId = slot === 0 ? null : TOOL_SLOTS[slot - 1];
  if (toolId && !state.tools.includes(toolId)) { showToast('You have not found that device yet.', 1800); return; }
  setTool(selectedTool === toolId ? null : toolId);
}

function cycleTool(direction: number): void {
  const options = [null, ...TOOL_SLOTS.filter((id) => state.tools.includes(id))];
  const index = options.indexOf(selectedTool);
  setTool(options[(index + direction + options.length) % options.length]);
}

function toggleFlashlight(): void {
  flashlightOn = !flashlightOn;
  renderer.setFlashlight(flashlightOn);
}

// ── Prompt shown for whatever is under the crosshair ─────────────

function updatePrompt(): void {
  const propId = renderer.getTargetPropId();
  ui.crosshair.classList.toggle('active', Boolean(propId));
  if (!propId) { ui.prompt.classList.remove('visible'); return; }
  const prop = lookup.props[propId];
  const here = state.props[propId];
  const itemId = here?.currentItemId ?? null;
  const item = itemId ? lookup.items[itemId] : null;
  const label = labelFor(prop).toUpperCase();
  let line = '';
  let hint = '';
  if (!isActive(state, prop) && !prop.travel) {
    ui.prompt.innerHTML = `<small></small>`;
    ui.prompt.classList.add('visible');
    return;
  }

  if (state.carriedItemId && !explainDrop(state, propId, lookup)) {
    line = `<b>E</b>  GRAFT ${getItemCaption(state.carriedItemId, lookup)} INTO ${label}`;
  } else if (item?.kind === 'tool') {
    line = explainGrab(state, propId, null, lookup) ? label : `<b>E</b>  TAKE ${item.caption}`;
    hint = explainGrab(state, propId, null, lookup) ?? item.blurb;
  } else if (item && !explainGrab(state, propId, selectedTool, lookup)) {
    const verb = TOOL_VERBS[prop.take?.[item.id]?.tool ?? ''] ?? 'TAKE';
    line = `<b>E</b>  ${verb} ${item.caption}`;
  } else if (prop.inspection && !state.flags[prop.inspection.flag]) {
    line = `<b>E</b>  EXAMINE ${label}`;
  } else if (prop.travel && !(prop.inspection && !state.flags[prop.inspection.flag])) {
    line = `<b>E</b>  ${prop.id.startsWith('stairs') ? 'TAKE THE STAIRS' : 'RIDE THE LIFT'}`;
    if (!canTravel(state, prop)) hint = prop.travel.lockedText ?? '';
  } else {
    line = label;
  }
  if (!hint && !line.startsWith('<b>E</b>  EXAMINE')) hint = labelFor(prop) === prop.label ? prop.description : '';
  ui.prompt.innerHTML = `${line}${hint ? `<small>${hint}</small>` : ''}`;
  ui.prompt.classList.add('visible');
}

// ── Interacting ──────────────────────────────────────────────────

function commit(action: GameAction): void {
  state = apply(state, action, room, lookup);
  renderer.syncState(state);
  if (selectedTool && !state.tools.includes(selectedTool)) setTool(null);
  refreshHud();
  if (state.completed) finish();
}

function interact(): void {
  if (traveling || !playing) return;
  const propId = renderer.getTargetPropId();
  if (!propId) { showToast('Nothing within reach.', 1500); return; }
  const prop = lookup.props[propId];
  const here = state.props[propId];
  const itemId = here.currentItemId;
  const inspectionPending = Boolean(prop.inspection && !state.flags[prop.inspection.flag]);
  if (!isActive(state, prop) && !prop.travel) { showToast(prop.dormantText ?? prop.description); return; }

  try {
    // 1. Graft what you carry.
    if (state.carriedItemId && !explainDrop(state, propId, lookup)) {
      const carried = state.carriedItemId;
      const before = { ...state.flags };
      commit({ type: 'DROP', itemId: carried, toPropId: propId });
      showToast(prop.accepts[carried].note, 5200);
      flash();
      if (state.flags.floor1_cleared && !before.floor1_cleared) {
        announce('GROUND FLOOR CLEARED. SOMETHING UPSTAIRS HAS STARTED TO HUM.', true, 6000);
        void audio.playOnce('/sounds/horror_breathing.wav', 0.6);
      } else if (state.flags.floor2_cleared && !before.floor2_cleared) {
        announce('UPPER FLOOR CLEARED. THE LIFT WILL CLIMB TO THE ATTIC.', true, 6000);
        void audio.playOnce('/sounds/old_elevator_door.mp3', 0.6);
      }
      return;
    }
    // 2. Examine with the device the examination needs (UV on glass, thermal on the warm air).
    if (inspectionPending && prop.inspection?.tool && selectedTool === prop.inspection.tool && !explainInspect(state, propId, selectedTool, lookup)) {
      commit({ type: 'INSPECT', propId, toolId: selectedTool });
      announce(prop.inspection.text, false, 7000);
      return;
    }
    // 3. Take or record what is here.
    if (itemId) {
      const reason = explainGrab(state, propId, lookup.items[itemId].kind === 'tool' ? null : selectedTool, lookup);
      if (!reason) {
        const item = lookup.items[itemId];
        commit({ type: 'GRAB', itemId, fromPropId: propId, toolId: item.kind === 'tool' ? null : selectedTool });
        const note = prop.take?.[itemId]?.note ?? `${item.caption} taken.`;
        if (item.kind === 'tool') {
          const slot = TOOL_SLOTS.indexOf(itemId) + 1;
          showToast(`${note}  Press ${slot} to use it.`, 5200);
          setTool(itemId);
        } else {
          showToast(note, 5200);
          if (selectedTool === 'tool_camera') flash();
        }
        return;
      }
      if (!inspectionPending) { showToast(reason); return; }
    }
    // 4. Examine.
    if (prop.inspection && inspectionPending) {
      const reason = explainInspect(state, propId, selectedTool, lookup);
      if (reason) { showToast(reason, 5200); return; }
      commit({ type: 'INSPECT', propId, toolId: selectedTool });
      const isLift = propId === 'elevator';
      announce(prop.inspection.text, isLift, isLift ? 5200 : 7000);
      if (isLift) void audio.playOnce('/sounds/horror_breathing.wav', 0.9);
      return;
    }
    // 5. Travel.
    if (prop.travel) {
      if (!canTravel(state, prop)) { showToast(prop.travel.lockedText ?? 'It will not move.'); return; }
      travel(prop);
      return;
    }
    // 6. Re-read what you already know.
    if (prop.inspection) { showToast(prop.inspection.repeatText ?? prop.inspection.text, 6000); return; }
    if (state.carriedItemId) { showToast(explainDrop(state, propId, lookup) ?? prop.description); return; }
    showToast(prop.description);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Nothing happens.');
  }
}

function travel(prop: PropDef): void {
  const travelDef = prop.travel!;
  traveling = true;
  ui.fade.classList.add('on');
  showToast(travelDef.text, 3200);
  const isLift = prop.id.startsWith('elevator');
  void audio.playOnce(isLift ? '/sounds/old_elevator_door.mp3' : '/sounds/creaky_door_hinge.wav', 0.7);
  window.setTimeout(() => {
    renderer.teleport(travelDef.toFloor, travelDef.to, travelDef.yaw);
    if (isLift) renderer.setCarFloor(travelDef.toFloor);
    renderer.syncState(state);
    refreshHud();
    ui.fade.classList.remove('on');
    traveling = false;
  }, isLift ? 1400 : 650);
}

function undo(): void {
  if (traveling || !playing) return;
  try {
    commit({ type: 'UNDO' });
    showToast('You put things back the way they were.', 1800);
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Nothing to undo.', 1500);
  }
}

function requestRestart(): void {
  if (performance.now() < restartArmedUntil) { restart(); return; }
  restartArmedUntil = performance.now() + 3000;
  showToast('Press R again to restart the house from the beginning.', 3000);
}

function restart(): void {
  state = createInitialState(room);
  renderer.setCarFloor(0);
  renderer.teleport(0, START.pos, START.yaw);
  renderer.syncState(state);
  setTool(null);
  refreshHud();
  ui.end.hidden = true;
  playing = true;
  renderer.setControlsActive(true);
  showToast('The house resets itself. Downstairs, the clock is ticking again.');
}

function finish(): void {
  window.setTimeout(() => {
    playing = false;
    renderer.setControlsActive(false);
    ui.endCopy.textContent = room.objective.successText;
    ui.end.hidden = false;
  }, 3200);
}

// ── Journal, goal, and what you can hear ─────────────────────────

function toggleJournal(): void {
  const open = ui.journal.hidden;
  ui.journal.hidden = !open;
  if (!open) return;
  const entries = room.props.filter((p) => p.inspection && state.flags[p.inspection.flag]);
  ui.journalList.replaceChildren(...entries.map((p) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${p.label}.</b> ${p.inspection!.text}`;
    return li;
  }));
  if (!entries.length) ui.journalList.innerHTML = '<li>Nothing yet. Examine what feels wrong.</li>';
}

function refreshHud(): void {
  renderBelt();
  updateCarried();
  updatePrompt();
  ui.goal.hidden = !state.flags.clue_elevator;
  ui.goal.innerHTML = `THE LIFT WANTS ${room.goalSockets.map((s) => `<span class="socket${state.props[s.propId].currentItemId === s.itemId ? ' full' : ''}">${s.label}</span>`).join('')}`;
}

interface Heard { id: string; label: string; volume: number; pan: number; where: string }

function audible(): Heard[] {
  const listener = renderer.getListener();
  const heard: Heard[] = [];
  const add = (id: string, label: string, floor: number, x: number, z: number, range: number, crossFloor = 0): void => {
    const sameFloor = floor === listener.floor;
    if (!sameFloor && !crossFloor) return;
    const dist = Math.hypot(x - listener.x, z - listener.z);
    const volume = sameFloor ? Math.max(0, 1 - dist / range) : crossFloor;
    if (volume <= 0.02) return;
    const angle = Math.atan2(x - listener.x, z - listener.z) - (listener.yaw + Math.PI);
    const pan = sameFloor ? -Math.sin(angle) : 0;
    const facing = Math.cos(angle);
    const where = !sameFloor ? (floor < listener.floor ? 'from below' : 'from above') : dist < 2.5 ? 'right here' : facing > 0.6 ? 'ahead' : facing < -0.6 ? 'behind you' : pan < 0 ? 'to your left' : 'to your right';
    heard.push({ id, label, volume, pan, where });
  };
  const at = (id: string) => soundSources.find((s) => s.id === id)!;
  const p = state.props;
  const upstairsAwake = Boolean(state.flags.floor1_cleared);
  if (p.dining_clock.currentItemId === 'ev_ticking') { const s = at('ticking'); add('ticking', '[TICKING]', s.floor, s.pos[0], s.pos[2], 26, 0.22); }
  const glimpse = performance.now() < glimpseUntil ? renderer.getGlimpse() : null;
  if (glimpse) add('glimpse', '[FLOORBOARDS CREAK UNDER SOMETHING HEAVY]', 0, glimpse.x, glimpse.z, 30);
  if (p.parlor_fireplace.currentItemId === 'ev_fire') { const s = at('fire'); add('fire', '[FIRE CRACKLING]', s.floor, s.pos[0], s.pos[2], 11); }
  if (p.hollow.currentItemId === 'ev_voice') { const s = at('heartbeat'); add('heartbeat', '[SOMETHING BREATHING THAT YOU CANNOT SEE]', s.floor, s.pos[0], s.pos[2], 8); }
  if (upstairsAwake && p.bath_tub.currentItemId === 'ev_water') { const s = at('water'); add('water', '[HOT WATER RUNNING]', s.floor, s.pos[0], s.pos[2], 12); }
  if (p.scarecrow.currentItemId === 'ev_voice') { const s = at('lullaby'); add('lullaby', '[THE DEAD VOICE, FROM THE SCARECROW]', s.floor, s.pos[0], s.pos[2], 16); }
  if (p.carver.currentItemId === 'ev_heart') { const s = at('breath'); add('breath', '[SLOW, WET BREATHING]', s.floor, s.pos[0], s.pos[2], 12); }
  if (listener.floor === 1 && upstairsAwake && p.specter.currentItemId === 'ev_lullaby') {
    const node = renderer.getSpecterPosition();
    const manifest = renderer.isSpecterManifest();
    add('hum', manifest ? '[A WOMAN HUMMING, CLOSE]' : '[HUMMING, SOMEWHERE ON THIS FLOOR]', 1, node[0], node[2], manifest ? 18 : 30);
  }
  return heard.sort((a, b) => b.volume - a.volume);
}

const LOOP_SOURCES = {
  ticking: { synth: 'ticking' as const },
  water: { synth: 'water' as const },
  fire: { synth: 'fire' as const },
  heartbeat: { url: '/sounds/heartbeat_slow_0.wav' },
  hum: { synth: 'drone' as const },
  lullaby: { synth: 'drone' as const },
  breath: { url: '/sounds/horror_breathing.wav' },
};
const LOOP_VOLUME: Record<string, number> = { ticking: 0.5, water: 0.35, fire: 0.5, heartbeat: 0.9, hum: 0.35, lullaby: 0.4, breath: 0.7 };

function updateSenses(): void {
  const heard = audible();
  ui.heard.replaceChildren(...heard.slice(0, 4).map((h) => {
    const li = document.createElement('li');
    li.style.opacity = String(0.45 + h.volume * 0.55);
    li.innerHTML = `${h.label}<small>${h.where}</small>`;
    return li;
  }));
  for (const id of Object.keys(LOOP_SOURCES) as (keyof typeof LOOP_SOURCES)[]) {
    const entry = heard.find((h) => h.id === id);
    audio.setLevel(id, entry ? entry.volume * LOOP_VOLUME[id] : 0, entry?.pan ?? 0);
  }
  const listener = renderer.getListener();
  ui.location.textContent = `${FLOOR_NAMES[listener.floor]} · ${renderer.getRoomName().toUpperCase()}`;
  if (selectedTool === 'tool_emf') {
    const reading = renderer.getEmfReading();
    const lit = Math.round(reading * 8);
    ui.emfBars.querySelectorAll('i').forEach((bar, index) => bar.classList.toggle('on', index < lit));
  }
  if (renderer.getTargetPropId() === 'specter' || renderer.getTargetPropId() === null) updatePrompt();
}

// ── Start, mute, loop ────────────────────────────────────────────

ui.startButton.addEventListener('click', async () => {
  ui.start.hidden = true;
  playing = true;
  renderer.setControlsActive(true);
  void canvas.requestPointerLock();
  await audio.init();
  void audio.ensureLoop('ambience', { url: '/sounds/abandoned_passages.ogg' }).then(() => audio.setLevel('ambience', 0.22));
  for (const [id, source] of Object.entries(LOOP_SOURCES)) void audio.ensureLoop(id, source);
  showToast('The front door slams behind you. Somewhere in the house, a clock is ticking.', 5000);
});

ui.againButton.addEventListener('click', () => { restart(); void canvas.requestPointerLock(); });

ui.mute.addEventListener('click', async () => {
  await audio.init();
  audio.setMuted(!audio.isMuted());
  const muted = audio.isMuted();
  ui.mute.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
  ui.mute.setAttribute('aria-pressed', String(!muted));
});

refreshHud();

// Development-only hook for automated screenshots and playtest scripts.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__fotd = {
    renderer,
    get state() { return state; },
    act: (action: GameAction) => commit(action),
    tool: (toolId: string | null) => setTool(toolId),
    look: (pitch: number) => { (renderer as unknown as { pitch: number }).pitch = pitch; },
    flashlight: () => toggleFlashlight(),
  };
}

let senseClock = 0;
function frame(now: number): void {
  renderer.render();
  if (now - senseClock > 250) { senseClock = now; updateSenses(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
