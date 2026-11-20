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
const voiceInLift: Condition = { has: ['socket_voice', 'ev_voice'] };
const liftCanClimb: Condition[] = [
  { has: ['socket_voice', 'ev_voice'] },
  { has: ['socket_touch', 'ev_print'] },
];
const UPSTAIRS_ASLEEP = 'Nothing up here reacts to you yet. The whole floor feels like it is waiting for something downstairs to happen first.';

const upstairs = (prop: PropDef): PropDef => ({ activeWhen: [floor1Cleared], dormantText: UPSTAIRS_ASLEEP, ...prop });

const props: PropDef[] = [
  // ── Lift (mounted on the car, so it travels with you) ─────────
  {
    id: 'elevator',
    label: 'The Dead Lift',
    description: 'A brass cage elevator. Its panel has three empty sockets: a grille, a hand, a cage.',
    floor: -1,
    accepts: {},
    inspection: {
      flag: 'clue_elevator',
      text: 'I NEED THE VOICE OF THE DEAD.',
      repeatText: 'The panel has three slots: a grille for a voice, a brass hand for a touch, and an iron cage for a heart. Fill the grille first. Each slot you fill lets the lift go higher.',
    },
    travel: {
      toFloor: 1,
      from: 0,
      to: [0, 0, -0.9],
      yaw: 0,
      requires: [floor1Cleared],
      label: 'RIDE TO THE UPPER FLOOR',
      lockedText: 'Nothing happens. The grille is still empty. Something on this floor has a voice. Find it.',
      text: 'The cables groan. The lift rises into the upper floor.',
    },
    routes: [
      {
        toFloor: 2,
        from: 0,
        to: [0, 0, 0.6],
        yaw: Math.PI,
        requires: liftCanClimb,
        label: 'RIDE TO THE ATTIC',
        lockedText: 'It will not go to the attic yet. The grille and the brass hand both need to be filled.',
        text: 'The cables groan. The lift climbs past the upper floor without stopping.',
      },
      {
        toFloor: 0,
        from: 1,
        to: [0, 0, -0.6],
        yaw: 0,
        label: 'RIDE TO THE GROUND FLOOR',
        text: 'The lift sinks back to the foyer.',
      },
      {
        toFloor: 2,
        from: 1,
        to: [0, 0, 0.6],
        yaw: Math.PI,
        requires: liftCanClimb,
        label: 'RIDE TO THE ATTIC',
        lockedText: 'It will not go to the attic yet. The grille and the brass hand both need to be filled.',
        text: 'The cables groan. The lift climbs past the upper floor without stopping.',
      },
      {
        toFloor: 0,
        from: 2,
        to: [0, 0, -0.6],
        yaw: 0,
        requires: [voiceInLift],
        label: 'RIDE TO THE GROUND FLOOR',
        lockedText: 'The lift is dead. Its grille is empty. It needs the voice back before it will move.',
        text: 'The lift sinks back down to the foyer.',
      },
      {
        toFloor: 1,
        from: 2,
        to: [0, 0, -0.9],
        yaw: 0,
        requires: [voiceInLift],
        label: 'RIDE TO THE UPPER FLOOR',
        lockedText: 'The lift is dead. Its grille is empty. It needs the voice back before it will move.',
        text: 'The lift sinks to the upper floor.',
      },
    ],
  },
  {
    id: 'socket_voice',
    label: 'Speaker Grille',
    description: 'A brass grille shaped like a mouth.',
    floor: -1,
    accepts: { ev_voice: { status: 'active', note: 'The grille swallows the voice. Upstairs, something starts to hum. The upper floor is awake now.', setFlag: 'floor1_cleared' } },
    take: { ev_voice: { note: 'You pull the voice back out of the grille. The lift goes dead. You will need to put it back before it moves again.' } },
  },
  {
    id: 'socket_touch',
    label: 'Brass Hand',
    description: 'A brass palm, fingers spread, waiting to be touched.',
    floor: -1,
    accepts: { ev_print: { status: 'active', note: 'The brass fingers close around the photo. The cables tighten. The lift can reach the attic now.', setFlag: 'floor2_cleared' } },
    take: { ev_print: { note: 'You peel the handprint off the brass. The fingers spread again.' } },
  },
  {
    id: 'socket_heart',
    label: 'Iron Cage',
    description: 'A rib-shaped iron cage, just large enough for something that beats.',
    floor: -1,
    accepts: { ev_heart: { status: 'active', note: 'The heartbeat settles into the cage. The whole lift starts to breathe, and the doors shudder.' } },
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
      text: 'Locked from the outside. Something on the porch is breathing against the wood. You are not leaving this way. The lift in the foyer is the only way out.',
    },
  },
  {
    id: 'stairs_up',
    label: 'Grand Staircase',
    description: 'The stairs climb into the upper floor.',
    floor: 0,
    accepts: {},
    travel: { toFloor: 1, to: [-1.4, 0, 1.4], yaw: 0, label: 'TAKE THE STAIRS UP', text: 'The steps creak under you all the way up.' },
  },
  {
    id: 'study_drawer',
    label: 'Study Cabinet',
    description: 'A cabinet full of reels and wax cylinders, every one labelled with a date and a name.',
    floor: 0,
    accepts: {},
    take: { tool_recorder: { note: 'A voice recorder. It can take a sound away from whatever makes it, and you can put that sound somewhere else.' } },
  },
  {
    id: 'study_desk',
    label: 'Writing Desk',
    description: 'A desk buried in children\u2019s drawings.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_silence',
      text: 'A child\u2019s crayon drawing: a very tall man at the head of the dining table, mouth wide open. Underneath it says PAPA ONLY TALKS WHEN THE CLOCK STOPS. If you want him to talk, the house has to be quiet first.',
    },
  },
  {
    id: 'kitchen_counter',
    label: 'Kitchen Counter',
    description: 'Rotten bread and a cleaver. Nothing here you can use.',
    floor: 0,
    accepts: {},
  },
  {
    id: 'kitchen_sink',
    label: 'Sink',
    description: 'The tap drips something dark.',
    floor: 0,
    accepts: {},
    inspection: {
      flag: 'clue_sink',
      text: 'The tap drips black water, slow and steady. Somewhere down the drain, something knocks once in reply. Then nothing.',
    },
  },
  {
    id: 'pantry_door',
    label: 'Frozen Pantry',
    description: 'The pantry door is sealed by a skin of frost that grows from inside.',
    floor: 0,
    accepts: { ev_fire: { status: 'thawed', locks: true, note: 'The fire crawls over the frost. The ice shrieks, runs, and the pantry door sags open.' } },
    take: { ev_fire: { tool: 'tool_recorder', status: 'cold', note: 'You record the fire back out. Frost races over the pantry again.' } },
    inspection: {
      flag: 'clue_pantry',
      text: 'Frozen shut from the inside. Through the frost you can see a camera lens on a shelf. Ice like this needs real heat, and the fireplace in the parlor is the only warm thing in the house.',
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
        lockedText: 'The pantry is frozen shut. Thaw the door first.',
        note: 'A thermal camera. It shows heat, even heat with no body you can see. Try it wherever the air feels warm.',
      },
    },
  },
  {
    id: 'dining_clock',
    label: 'Grandfather Clock',
    description: 'A tall clock. Its ticking fills the whole house. Nothing in here could be quiet while it runs.',
    floor: 0,
    accepts: { ev_ticking: { status: 'active', note: 'The pendulum swings again. Ticking floods the house.' } },
    take: {
      ev_ticking: {
        tool: 'tool_recorder',
        lockedText: 'The ticking fills the house. You need something to record it with.',
        note: 'The pendulum stops. The ticking is in your recorder now and it will not stop. Find somewhere to put it where it will stay shut away.',
        status: 'silent',
      },
    },
  },
  {
    id: 'hall_coffin',
    label: 'Servants\u2019 Coffin',
    description: 'A coffin, nailed shut. Something inside taps on the lid, slow and steady, like a clock that has lost its ticking.',
    floor: 0,
    accepts: { ev_ticking: { status: 'active', locks: true, note: 'The ticking sinks into the coffin and the tapping stops. For the first time, the house is completely silent. Now something might talk.' } },
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
      text: 'His chair at the head of the table is pushed back, like he stood up and never left. The air above it is warm and smells like breath. Something is standing here that you cannot see.',
    },
  },
  {
    id: 'hollow',
    label: 'The Ribbed Hollow',
    description: 'Something tall stands at the head of the table. You can only see it in heat.',
    floor: 0,
    accepts: {},
    take: {
      ev_voice: {
        tool: 'tool_recorder',
        requires: [{ flag: 'hollow_marked' }, silent],
        lockedText: 'Its mouth is moving, but the ticking is too loud to hear it. The house needs to be silent first.',
        note: 'In the silence it finally speaks, and the recorder takes every word. It folds to the floor and does not get up. Take its voice to the lift.',
        status: 'dead',
      },
    },
    inspection: {
      flag: 'hollow_marked',
      tool: 'tool_thermal',
      toolText: 'The air here is warm and feels crowded, but you see nothing. Your eyes are not enough. Something that sees heat would show it.',
      text: 'Through the thermal camera you see it: a tall ribbed shape at the head of the table, looking down at you. Its mouth is moving. Now you know where it stands. Once the house is quiet, you can record what it says.',
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
        lockedText: 'You cannot carry a fire in your hands. A recorder could hold its sound.',
        note: 'The crackle drains into the recorder and the flames die. You are carrying heat now. Something frozen would want it.',
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
      text: 'For a second the mirror shows the room as heat. You glow white. Behind you, through the doorway to the dining room, something very tall glows too. When you turn around, nothing is there.',
    },
  },

  // ── Upper floor: the TOUCH (dormant until the voice is given) ─
  {
    id: 'stairs_down',
    label: 'Staircase Down',
    description: 'Back down to the foyer.',
    floor: 1,
    accepts: {},
    travel: { toFloor: 0, to: [-1.2, 0, 6.2], yaw: 0, label: 'TAKE THE STAIRS DOWN', text: 'You go back down. The foyer is exactly as quiet as you left it.' },
  },
  upstairs({
    id: 'master_nightstand',
    label: 'Nightstand',
    description: 'A bedside table. A violet glow leaks from the drawer.',
    floor: 1,
    accepts: {},
    take: { tool_uv: { note: 'A UV lamp. Under its light you can see where hands have been.' } },
  }),
  upstairs({
    id: 'nursery_crib',
    label: 'Crib',
    description: 'An empty crib.',
    floor: 1,
    accepts: {},
    take: { tool_emf: { note: 'An EMF detector, left where the baby should be. Its bars rise the closer you get to a ghost.' } },
  }),
  upstairs({
    id: 'nursery_chair',
    label: 'Rocking Chair',
    description: 'A rocking chair facing the wall.',
    floor: 1,
    accepts: {},
    inspection: {
      flag: 'clue_chair',
      text: 'The seat is still warm. She used to rock the baby here and sing. Now she wanders the upper floor and never stays in one room for long. The EMF detector from the crib will tell you when she is close.',
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
        lockedText: 'She is singing. You need something to record her song with.',
        note: 'Her lullaby fills the recorder. She looks at you, then fades. Who did she use to sing to?',
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
    accepts: { ev_lullaby: { status: 'active', note: 'Her lullaby settles over him. His face relaxes, and slowly his fist opens.' } },
    take: { ev_lullaby: { tool: 'tool_recorder', status: 'idle', note: 'You record the lullaby back out of him. His fist clenches again.' } },
    inspection: {
      flag: 'clue_corpse',
      text: 'He has been dead a long time. His fist is clamped to his chest around something with a lens. A card by the bed says FOR MY WIFE, WHO SANG ME TO SLEEP. Maybe her song would let him rest.',
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
        lockedText: 'His fist will not open. There is a camera inside it. Something has to put him at peace first.',
        note: 'A photo camera. Its flash can keep things that only show up under special light.',
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
      text: 'A wedding portrait. She is singing, and he listens with one hand open on his chest. Someone scratched into the frame: ONLY HER SONG OPENS HIS HAND.',
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
      text: 'Her diary: \u201cEvery night he runs a hot bath and writes to me on the bathroom mirror. I can only read it once the water is off and the glass goes cold. The violet lamp shows his hands.\u201d',
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
        note: 'The running water drains into the recorder. The steam thins and the room starts to cool. The water needs somewhere else to go.',
        status: 'silent',
      },
    },
    inspection: {
      flag: 'clue_trail',
      tool: 'tool_uv',
      toolText: 'Steam and black water. Something is smeared on the tiles, but you cannot quite make it out.',
      text: 'Under the UV light, long handprints climb out of the water and cross the tiles to the mirror.',
    },
  }),
  upstairs({
    id: 'washbasin',
    label: 'Washbasin',
    description: 'A dry washbasin by the bed. His shaving water was never poured.',
    floor: 1,
    accepts: { ev_water: { status: 'active', note: 'Water fills the basin. In the bathroom, the mirror starts to cool.' } },
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
        lockedText: 'There is nothing on the glass to photograph yet.',
        note: 'The flash burns the handprint onto film. Put the photo in the lift\u2019s brass hand.',
      },
    },
    inspection: {
      flag: 'print_revealed',
      tool: 'tool_uv',
      toolText: 'The glass is fogged with steam. Someone has written in it: WARM GLASS FORGETS.',
      requires: [{ notHas: ['bath_tub', 'ev_water'] }],
      lockedText: 'Under the UV light there is only steam. The hot water in the tub is still running.',
      text: 'The glass is cold now. Under the UV light a long-fingered handprint appears, pressed from the other side. A photo would keep it.',
    },
  }),

  // ── Attic: the HEART (only the lift reaches it) ───────────────
  {
    id: 'scarecrow',
    label: 'Scarecrow',
    description: 'A scarecrow with a gramophone horn where its mouth should be.',
    floor: 2,
    accepts: { ev_voice: { status: 'active', note: 'The scarecrow speaks with the dead man\u2019s voice. Slowly, the Carver turns its head toward it, away from you.' } },
    take: { ev_voice: { note: 'You take the voice back. Nothing turns toward you now.' } },
    inspection: {
      flag: 'clue_scarecrow',
      text: 'Someone nailed a gramophone horn into its face. It could speak with any voice you give it.',
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
        lockedText: 'It is watching you, and you cannot get close while it stares. Give it something else to look at.',
        note: 'You record the heartbeat out of its chest. The candle in its head goes out and it slumps away from the window. Put the heart in the lift.',
        status: 'dead',
      },
    },
    inspection: {
      flag: 'clue_carver',
      text: 'Its arms are spread across the only window. The candle in its head follows you wherever you go. It only looks away when it hears a voice.',
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
    master_nightstand: 'tool_uv',
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
