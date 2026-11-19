import type { Condition, PropDef, RoomDef } from './types';

/**
 * The Hollow House. One floor at a time.
 *
 * The lift's panel has three sockets: a grille for a VOICE, a brass hand for a TOUCH,
 * and an iron cage for a HEART. Each floor gives one of them, and each floor stays
 * dormant until the floor below it has been cleared. The stairs are always open, but
 * the upper floor is just furniture until the lift has its voice.
 *
 *   GROUND FLOOR → VOICE  The Ribbed Hollow stands invisible at the head of the dining table.
 *                         It only speaks when the house is silent, and only heat shows it.
 *   UPPER FLOOR  → TOUCH  The dead husband's fist opens only for his wife's lullaby.
 *                         His handprint is on the bathroom mirror, hidden by steam.
 *   ATTIC        → HEART  The Carver watches you and will not look away, except toward a voice.
 *                         The only voice is the one already inside the lift.
 */

const floor1Cleared: Condition = { flag: 'floor1_cleared' };
const silent: Condition = { notHas: ['dining_clock', 'ev_ticking'] };
const liftCanClimb: Condition[] = [
  { has: ['socket_voice', 'ev_voice'] },
  { has: ['socket_touch', 'ev_print'] },
];
const UPSTAIRS_ASLEEP = 'The upper floor is still, as if it is waiting for something downstairs to speak first.';

const upstairs = (prop: PropDef): PropDef => ({ activeWhen: [floor1Cleared], dormantText: UPSTAIRS_ASLEEP, ...prop });

const props: PropDef[] = [
  // ── Lift (mounted on the car, so it travels with you) ─────────
  {
    id: 'elevator',
    label: 'The Dead Lift',
    description: 'A brass cage elevator. Its panel has three empty sockets: a grille, a hand, a cage.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_elevator',
      text: 'I NEED THE VOICE OF THE DEAD.',
      repeatText: 'Its panel has three sockets: a grille for a VOICE, a brass hand for a TOUCH, an iron cage for a HEART. It will climb once it can speak and feel.',
    },
    travel: {
      toFloor: 2,
      to: [0, 0, 0.6],
      yaw: Math.PI,
      requires: liftCanClimb,
      lockedText: 'The lift will not climb. Its grille and its brass hand are not both full.',
      text: 'The cables groan. The lift climbs past the upper floor without stopping.',
    },
  },
  {
    id: 'socket_voice',
    label: 'Speaker Grille',
    description: 'A brass grille shaped like a mouth.',
    floor: -1,
    accepts: { ev_voice: { status: 'active', note: 'The grille swallows the voice. Far above you, something begins to hum.', setFlag: 'floor1_cleared' } },
    take: { ev_voice: { note: 'You pull the voice back out of the grille. The lift goes dead around you.' } },
  },
  {
    id: 'socket_touch',
    label: 'Brass Hand',
    description: 'A brass palm, fingers spread, waiting to be touched.',
    floor: -1,
    accepts: { ev_print: { status: 'active', note: 'The photograph melts into the brass and the fingers close. The cables tighten. The lift will climb now.', setFlag: 'floor2_cleared' } },
    take: { ev_print: { note: 'You peel the handprint off the brass. The fingers spread again.' } },
  },
  {
    id: 'socket_heart',
    label: 'Iron Cage',
    description: 'A rib-shaped iron cage, just large enough for something that beats.',
    floor: -1,
    accepts: { ev_heart: { status: 'active', note: 'The heartbeat settles into the cage. The whole lift starts to breathe.' } },
    take: { ev_heart: { note: 'You lift the heartbeat out of the cage. The lift stops breathing.' } },
  },

  // ── Ground floor: the VOICE ───────────────────────────────────
  {
    id: 'front_door',
    label: 'Front Door',
    description: 'The way you came in. It is locked from the outside now.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_front_door',
      text: 'Locked from the outside. Something on the porch breathes against the wood, slow and patient. The only way out is up.',
    },
  },
  {
    id: 'stairs_up',
    label: 'Grand Staircase',
    description: 'The stairs climb into the upper floor.',
    floor: 0,
    accepts: {},
    travel: { toFloor: 1, to: [-1.4, 0, 1.4], yaw: 0, text: 'The steps creak under you all the way up.' },
  },
  {
    id: 'study_drawer',
    label: 'Study Cabinet',
    description: 'A cabinet full of reels and wax cylinders, every one labelled with a date and a name.',
    floor: 0,
    accepts: {},
    take: { tool_recorder: { note: 'A voice recorder. Whoever lived here recorded everything.' } },
  },
  {
    id: 'study_desk',
    label: 'Writing Desk',
    description: 'A desk buried in children\u2019s drawings.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_silence',
      text: 'A crayon drawing of a very tall man at the head of a dining table, mouth wide open. Underneath, in a child\u2019s hand: PAPA ONLY TALKS WHEN THE CLOCK STOPS.',
    },
  },
  {
    id: 'kitchen_counter',
    label: 'Kitchen Counter',
    description: 'Rotten bread, a cleaver, and a lamp with a strange violet bulb.',
    floor: 0,
    accepts: {},
    take: { tool_uv: { note: 'A UV lamp. Things that were touched glow under it.' } },
  },
  {
    id: 'kitchen_sink',
    label: 'Sink',
    description: 'The tap drips something dark.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_sink',
      text: 'The tap runs black. Long fingers have smeared the steel, but the marks slide away from your eyes. A violet light would show them.',
    },
  },
  {
    id: 'pantry_door',
    label: 'Frozen Pantry',
    description: 'The pantry door is sealed by a skin of frost that grows from inside.',
    floor: 0,
    accepts: { ev_fire: { status: 'thawed', note: 'The fire crawls over the frost. The ice shrieks, runs, and the pantry door sags open.' } },
    take: { ev_fire: { tool: 'tool_recorder', status: 'cold', note: 'You record the fire back out. Frost races over the pantry again.' } },
    inspection: {
      flag: 'clue_pantry',
      text: 'Frozen shut from the inside. Something with a glass eye glints behind the frost. It would take real heat to open it.',
    },
  },
  {
    id: 'pantry_shelf',
    label: 'Pantry Shelf',
    description: 'A shelf of jars.',
    floor: 0,
    accepts: {},
    take: {
      tool_thermal: {
        requires: [{ has: ['pantry_door', 'ev_fire'] }],
        lockedText: 'The pantry is frozen shut.',
        note: 'A thermal camera. Through it, only warm things are real.',
      },
    },
  },
  {
    id: 'dining_clock',
    label: 'Grandfather Clock',
    description: 'A tall clock. Its ticking fills the whole house.',
    floor: 0,
    accepts: { ev_ticking: { status: 'active', note: 'The pendulum swings again. Ticking floods the house.' } },
    take: {
      ev_ticking: {
        tool: 'tool_recorder',
        lockedText: 'The ticking is everywhere. You have nothing to hold a sound with.',
        note: 'The pendulum stops mid-swing. The ticking is in your recorder now, and it will not stop. Put it somewhere.',
        status: 'silent',
      },
    },
  },
  {
    id: 'hall_coffin',
    label: 'Servants\u2019 Coffin',
    description: 'A coffin, nailed shut. Something inside taps against the lid, slowly, as if counting.',
    floor: 0,
    accepts: { ev_ticking: { status: 'active', note: 'The ticking sinks through the lid. The tapping inside stops. For the first time, the house is completely silent.' } },
    take: { ev_ticking: { tool: 'tool_recorder', note: 'You record the ticking back out of the coffin. Something inside starts tapping again.' } },
  },
  {
    id: 'dining_table',
    label: 'Dining Table',
    description: 'Places set for two. The food is old enough to be grey.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_table',
      text: 'His chair at the head of the table is pushed back, as if he stood up and never sat down again. The air there is warm, and it smells of breath.',
    },
  },
  {
    id: 'hollow',
    label: 'The Ribbed Hollow',
    description: 'Something tall stands at the head of the table. You can only see it in heat.',
    floor: 0,
    accepts: { ev_voice: { status: 'active', note: 'The voice pours back into its maw. The Hollow straightens up again.' } },
    take: {
      ev_voice: {
        tool: 'tool_recorder',
        requires: [{ flag: 'hollow_marked' }, silent],
        lockedText: 'Its maw opens and closes, but the ticking of the house drowns whatever it is trying to say.',
        note: 'In the silence it finally speaks, and the recorder drinks every word. Its legs fold. It does not get up.',
        status: 'dead',
      },
    },
    inspection: {
      flag: 'hollow_marked',
      tool: 'tool_thermal',
      toolText: 'The air at the head of the table is warm, and it feels crowded. Your eyes find nothing.',
      text: 'Through the thermal lens a towering ribbed shape stands at the head of the table, looking down at you. Its vertical mouth is working. You mark the spot.',
    },
    revealTool: 'tool_thermal',
    revealFlag: 'hollow_marked',
  },
  {
    id: 'parlor_fireplace',
    label: 'Fireplace',
    description: 'The only warm thing in the house. The fire crackles without wood.',
    floor: 0,
    accepts: { ev_fire: { status: 'lit', note: 'The fire catches again. The parlor warms.' } },
    take: {
      ev_fire: {
        tool: 'tool_recorder',
        lockedText: 'You cannot hold a fire in your hands. You need something that records.',
        note: 'The crackle drains into the recorder and the flames go out. You are carrying heat now.',
        status: 'dark',
      },
    },
  },
  {
    id: 'parlor_mirror',
    label: 'Parlor Mirror',
    description: 'A tall mirror in a black frame.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_heat',
      text: 'For a moment the mirror shows the room as heat. You burn white. Behind you, through the doorway to the dining room, something tall burns too. When you turn, there is nothing there.',
    },
  },

  // ── Upper floor: the TOUCH (dormant until the voice is given) ─
  {
    id: 'stairs_down',
    label: 'Staircase Down',
    description: 'Back down to the foyer.',
    floor: 1,
    accepts: {},
    travel: { toFloor: 0, to: [-1.2, 0, 6.2], yaw: 0, text: 'You go back down. The foyer is exactly as quiet as you left it.' },
  },
  upstairs({
    id: 'nursery_crib',
    label: 'Crib',
    description: 'An empty crib.',
    floor: 1,
    accepts: {},
    take: { tool_emf: { note: 'An EMF detector, lying where the baby should be. Its needle twitches toward the dead.' } },
  }),
  upstairs({
    id: 'nursery_chair',
    label: 'Rocking Chair',
    description: 'A rocking chair facing the wall.',
    floor: 1,
    accepts: {},
    inspection: {
      flag: 'clue_chair',
      text: 'The seat is still warm. She rocked the baby here and sang. Now she drifts from room to room and never stays long. A needle would find her before your eyes do.',
    },
  }),
  upstairs({
    id: 'specter',
    label: 'Mournveil',
    description: 'A veiled woman, singing without a mouth.',
    floor: 1,
    accepts: { ev_lullaby: { status: 'active', note: 'She takes her lullaby back and drifts away.' } },
    take: {
      ev_lullaby: {
        tool: 'tool_recorder',
        lockedText: 'She is singing. You have nothing to catch a song with.',
        note: 'Her lullaby fills the recorder. She looks at you, and fades.',
        status: 'silent',
      },
    },
    visibleWhen: [floor1Cleared, { has: ['specter', 'ev_lullaby'] }],
  }),
  upstairs({
    id: 'corpse',
    label: 'The Husband',
    description: 'A dead man on the bed.',
    floor: 1,
    accepts: { ev_lullaby: { status: 'active', note: 'Her lullaby settles over him. His face goes slack, and slowly his fist uncurls.' } },
    take: { ev_lullaby: { tool: 'tool_recorder', status: 'idle', note: 'You record the lullaby back out of him. His fist clenches again.' } },
    inspection: {
      flag: 'clue_corpse',
      text: 'He has been dead a long time. His fist is clenched against his ribs around something with a lens. On the nightstand, a card: FOR MY WIFE, WHO SANG ME TO SLEEP.',
    },
  }),
  upstairs({
    id: 'corpse_hand',
    label: 'Clenched Fist',
    description: 'The dead man is holding something against his ribs.',
    floor: 1,
    accepts: {},
    take: {
      tool_camera: {
        requires: [{ has: ['corpse', 'ev_lullaby'] }],
        lockedText: 'His fist will not open. It is clenched around a camera.',
        note: 'A photo camera. Its flash catches things that do not want to be seen.',
      },
    },
  }),
  upstairs({
    id: 'library_portrait',
    label: 'Wedding Portrait',
    description: 'A painted wedding.',
    floor: 1,
    accepts: {},
    inspection: {
      flag: 'clue_portrait',
      text: 'She is singing. He is listening with one hand open on his chest. Scratched into the frame: ONLY HER SONG OPENS HIS HAND.',
    },
  }),
  upstairs({
    id: 'library_books',
    label: 'Bookshelf',
    description: 'Ledgers, hymnals, and one swollen diary.',
    floor: 1,
    accepts: {},
    inspection: {
      flag: 'clue_diary',
      text: 'Her diary: \u201cEvery night he runs the bath hot and writes to me on the mirror. I can only read it when the water stops and the glass goes cold. The violet lamp shows his hands.\u201d',
    },
  }),
  upstairs({
    id: 'bath_tub',
    label: 'Bathtub',
    description: 'The hot tap is running. Steam rolls over the rim.',
    floor: 1,
    accepts: { ev_water: { status: 'active', note: 'The water roars back into the tub. Steam fills the room again.' } },
    take: {
      ev_water: {
        tool: 'tool_recorder',
        note: 'The running water drains into the recorder. The steam thins, and the room starts to cool.',
        status: 'silent',
      },
    },
    inspection: {
      flag: 'clue_trail',
      tool: 'tool_uv',
      toolText: 'Black water and steam. The tiles around the tub are smeared with something you cannot quite see.',
      text: 'Under the violet light, long handprints climb out of the water and cross the tiles toward the mirror.',
    },
  }),
  upstairs({
    id: 'washbasin',
    label: 'Washbasin',
    description: 'A dry washbasin. His shaving water was never poured.',
    floor: 1,
    accepts: { ev_water: { status: 'active', note: 'Water fills the basin. Somewhere in the house, a razor taps against porcelain.' } },
    take: { ev_water: { tool: 'tool_recorder', note: 'You record the water back out of the basin.' } },
  }),
  upstairs({
    id: 'bathroom_mirror',
    label: 'Bathroom Mirror',
    description: 'A small mirror over the tub.',
    floor: 1,
    accepts: { ev_print: { status: 'active', note: 'The handprint sinks back into the glass.' } },
    take: {
      ev_print: {
        tool: 'tool_camera',
        requires: [{ flag: 'print_revealed' }],
        lockedText: 'There is nothing on the glass to photograph.',
        note: 'The flash burns the glowing handprint onto film. The glass is empty again.',
      },
    },
    inspection: {
      flag: 'print_revealed',
      tool: 'tool_uv',
      toolText: 'Steam fogs the glass. Someone has written in it: WARM GLASS FORGETS.',
      requires: [{ notHas: ['bath_tub', 'ev_water'] }],
      lockedText: 'Under the violet light there is only steam. The hot water is still running.',
      text: 'The glass has gone cold. Under the violet light a long-fingered handprint blooms on it, pressed from the other side.',
    },
  }),

  // ── Attic: the HEART (only the lift reaches it) ───────────────
  {
    id: 'elevator_attic',
    label: 'The Lift',
    description: 'The lift that brought you here.',
    floor: 2,
    accepts: {},
    travel: {
      toFloor: 0,
      to: [0, 0, 0.4],
      yaw: Math.PI,
      requires: liftCanClimb,
      lockedText: 'The lift is dead. Its grille is empty.',
      text: 'The lift sinks back down to the foyer.',
    },
  },
  {
    id: 'scarecrow',
    label: 'Scarecrow',
    description: 'A scarecrow with a gramophone horn where its mouth should be.',
    floor: 2,
    accepts: { ev_voice: { status: 'active', note: 'The scarecrow speaks with the dead man\u2019s voice. Slowly, the Carver turns its head toward it.' } },
    take: { ev_voice: { note: 'You take the voice back. Nothing turns toward you now.' } },
    inspection: {
      flag: 'clue_scarecrow',
      text: 'A gramophone horn has been nailed into its face. It is waiting for something to say.',
    },
  },
  {
    id: 'carver',
    label: 'The Carver',
    description: 'A pumpkin-headed thing with its arms spread across the attic window.',
    floor: 2,
    accepts: { ev_heart: { status: 'active', note: 'The heartbeat leaps back into its chest. The candle in its head flares.' } },
    take: {
      ev_heart: {
        tool: 'tool_recorder',
        requires: [{ has: ['scarecrow', 'ev_voice'] }],
        lockedText: 'It is watching you. Nothing that watches you that closely will let you near its heart.',
        note: 'You record the heartbeat out of its chest. The candle in its head gutters out, and it falls away from the window.',
        status: 'dead',
      },
    },
    inspection: {
      flag: 'clue_carver',
      text: 'Arms spread across the only window. The candle inside its head follows you wherever you stand. It only ever looks away toward a voice.',
    },
  },
];

export const house: RoomDef = {
  id: 'house',
  label: 'THE HOLLOW HOUSE',
  subtitle: 'EVERY SOUND EXISTS ONCE',
  description: 'A three-floor house. The lift wants a voice, a touch, and a heart of the dead.',
  items: [
    { id: 'tool_recorder', label: 'Voice Recorder', kind: 'tool', caption: '[VOICE RECORDER]', blurb: 'Records any sound and carries it.' },
    { id: 'tool_uv', label: 'UV Lamp', kind: 'tool', caption: '[UV LAMP]', blurb: 'Shows what has been touched.' },
    { id: 'tool_emf', label: 'EMF Detector', kind: 'tool', caption: '[EMF DETECTOR]', blurb: 'Its needle points toward the dead.' },
    { id: 'tool_thermal', label: 'Thermal Camera', kind: 'tool', caption: '[THERMAL CAMERA]', blurb: 'Only warm things are visible.' },
    { id: 'tool_camera', label: 'Photo Camera', kind: 'tool', caption: '[PHOTO CAMERA]', blurb: 'Captures what is revealed.' },
    { id: 'ev_ticking', label: 'Ticking', kind: 'evidence', caption: '[TICKING]', blurb: 'The grandfather clock\u2019s ticking.' },
    { id: 'ev_fire', label: 'Crackling Fire', kind: 'evidence', caption: '[CRACKLING FIRE]', blurb: 'Heat, held as a sound.' },
    { id: 'ev_voice', label: 'Voice of the Dead', kind: 'evidence', caption: '[VOICE OF THE DEAD]', blurb: 'What the Hollow finally said.' },
    { id: 'ev_lullaby', label: 'Her Lullaby', kind: 'evidence', caption: '[HER LULLABY]', blurb: 'The song she sang him to sleep with.' },
    { id: 'ev_water', label: 'Running Water', kind: 'evidence', caption: '[RUNNING WATER]', blurb: 'The hot bath, held as a sound.' },
    { id: 'ev_print', label: 'Handprint of the Dead', kind: 'evidence', caption: '[HANDPRINT OF THE DEAD]', blurb: 'A photograph of a cold touch.' },
    { id: 'ev_heart', label: 'Heartbeat of the Dead', kind: 'evidence', caption: '[HEARTBEAT OF THE DEAD]', blurb: 'The Carver\u2019s heartbeat.' },
  ],
  props,
  initialItems: {
    study_drawer: 'tool_recorder',
    kitchen_counter: 'tool_uv',
    nursery_crib: 'tool_emf',
    pantry_shelf: 'tool_thermal',
    corpse_hand: 'tool_camera',
    dining_clock: 'ev_ticking',
    parlor_fireplace: 'ev_fire',
    hollow: 'ev_voice',
    specter: 'ev_lullaby',
    bath_tub: 'ev_water',
    bathroom_mirror: 'ev_print',
    carver: 'ev_heart',
  },
  objective: {
    all: [
      { has: ['socket_voice', 'ev_voice'] },
      { has: ['socket_touch', 'ev_print'] },
      { has: ['socket_heart', 'ev_heart'] },
    ],
    successText: 'The lift breathes in all three. It sinks past every floor of the house, and when the doors open the front door is standing wide onto cold night air.',
  },
  goalSockets: [
    { propId: 'socket_voice', itemId: 'ev_voice', label: 'VOICE' },
    { propId: 'socket_touch', itemId: 'ev_print', label: 'TOUCH' },
    { propId: 'socket_heart', itemId: 'ev_heart', label: 'HEART' },
  ],
};

export const rooms: RoomDef[] = [house];
