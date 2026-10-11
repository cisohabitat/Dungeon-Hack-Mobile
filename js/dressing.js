// Floor dressing: what lies about a room that nobody will fight or pick up.
// Barrels and crates against the walls, bones and rubble underfoot, candles
// left burning by someone who is not coming back. None of it blocks the way
// or does anything; it is there so a room reads as a place. Each theme names
// the kinds it keeps (THEMES[i].props in data.js), and the remains a fallen
// creature leaves behind are drawn here too.
//
// The pictures are parts on the same finer 64-unit grid as the creatures,
// standing on its bottom edge; SIZE is how tall each stands against a whole square.

import { ball, limb, sheet, line, specks, hair } from './creatures.js';

const WOOD = '#7a5230', WOOD_DARK = '#4e3320', WOOD_LIGHT = '#9a6c40', IRON = '#3e4048', IRON_LIGHT = '#6a6e78';
// loose chain on the floor catches the torchlight more than iron bands on wood
const CHAIN = '#5c606a', CHAIN_LIGHT = '#9a9ea8';
const BONE = '#d8ceb0', BONE_DARK = '#a89c7c', STONE = '#6e6a66', STONE_DARK = '#4a4744';

/** a cask's body: staves bellied out, hoops round it, the head on top */
const cask = (c, dark, light, hoops) => [
  sheet([[19, 20], [45, 20], [48, 40], [45, 62], [19, 62], [16, 40]], c, { curve: 1 }),
  sheet([[19, 20], [24, 20], [22, 62], [19, 62], [16, 40]], dark, { curve: 0.6 }), sheet([[34, 20], [40, 20], [41, 62], [36, 62]], light, { curve: 0.6 }),
  ...[25, 32, 39].map(x => line(x, 22, x + (x - 32) * 0.06, 60, dark)),
  ...hoops.flatMap(y => [limb(17 + Math.abs(y - 40) * 0.1, y, 47 - Math.abs(y - 40) * 0.1, y, 0.9, 0.9, IRON), hair(18 + Math.abs(y - 40) * 0.1, y - 0.75, 46 - Math.abs(y - 40) * 0.1, y - 0.75, IRON_LIGHT)]),
];

const DRESSING = {
  // a cask with iron hoops, its staves showing
  barrel: () => [
    ...cask(WOOD, WOOD_DARK, WOOD_LIGHT, [28, 40, 54]),
    ball(32, 20, 13, 3.6, WOOD_LIGHT), ball(32, 20, 9, 2, WOOD_DARK), hair(24, 20, 40, 20, '#3a2414'), ball(28, 20, 1, 0.6, '#2a1a10'),
    ...[[22, 32], [36, 46], [28, 58], [42, 34]].map(([x, y]) => hair(x, y, x + 0.5, y + 4, '#5e3e24')),
    specks([[18, 62.5], [46, 62.5]], '#2a1c10'),
  ],
  // a cask of lamp oil: darker, oil-soaked staves, a black drip down its side,
  // a stopper in the top, and a flame burnt into it so it reads as oil (see elements.js)
  oilcask: () => [
    // painted a warning red, so it reads as oil from across a room
    ...cask('#7a2a18', '#4a1a10', '#9a3a22', [26, 56]),
    ball(32, 20, 13, 3.6, '#9a4a2a'), ball(32, 20, 9, 2, '#3a140c'), ball(32, 19.2, 2.8, 2.2, '#c9a24a'), hair(31, 18, 33, 18, '#f0d070'),
    // a big flame painted on its belly
    sheet([[25, 53], [39, 53], [38, 44], [35, 47], [32, 33], [29, 47], [26, 44]], '#f0a020', { curve: 0.5 }),
    sheet([[28.4, 52], [35.6, 52], [32, 41]], '#ffe070', { curve: 0.5 }),
    // oil run down it and pooled at its foot
    line(41, 22, 42, 36, '#140e08'), ball(42, 38, 1, 1.4, '#140e08'), ball(38, 62, 8, 1.6, '#1a120a'), hair(34, 61.5, 40, 61.5, '#4a3a2a'),
  ],
  // flames standing on a burning square (drawn over the flat glow of the fire; see elements.js)
  flames: () => [
    sheet([[16, 62], [20, 44], [24, 48], [26, 36], [30, 42], [32, 22], [35, 40], [38, 32], [41, 46], [44, 40], [48, 62]], '#d84a10', { curve: 0.6, glows: true }),
    sheet([[21, 62], [25, 48], [29, 44], [32, 32], [35, 44], [39, 48], [43, 62]], '#f08a20', { curve: 0.6, glows: true }),
    sheet([[26, 62], [29, 52], [32, 44], [35, 52], [38, 62]], '#ffd060', { curve: 0.6, glows: true }),
    sheet([[29.6, 62], [32, 54], [34.4, 62]], '#fff4c0', { curve: 0.5, glows: true }),
    specks([[24, 34], [40, 28], [32, 16], [28, 24], [44, 34], [20, 40]], '#ffb040', { glows: true }),
  ],
  // a slatted crate, braced corner to corner, seen a little from above
  crate: () => [
    sheet([[16, 34], [48, 34], [48, 62], [16, 62]], '#8a6a40', { tilt: [0, 0.1] }),
    sheet([[16, 34], [48, 34], [42, 26], [22, 26]], '#a8844e', { tilt: [0, -0.8] }), ...[30, 34].map(y => hair(20 + (34 - y) * 0.6, y - 2, 44 - (34 - y) * 0.6, y - 2, '#8a6a40')),
    limb(16, 34, 48, 34, 0.7, 0.7, WOOD_DARK), ...[41, 48, 55].map(y => hair(17, y, 47, y, '#6a4c2c')),
    limb(18, 36, 46, 60, 1, 1, '#6a4c2c'), limb(18, 60, 46, 36, 1, 1, '#6a4c2c'),
    limb(16, 34, 16, 62, 1, 1, WOOD_DARK), limb(48, 34, 48, 62, 1, 1, WOOD_DARK), limb(16, 62, 48, 62, 0.8, 0.8, WOOD_DARK),
    specks([[17.5, 36], [46.5, 36], [17.5, 60], [46.5, 60], [32, 48]], '#c8b090'),
    // stencilled marks and a nail
    hair(21, 44, 24, 44, '#3a2a18'), hair(22.5, 44, 22.5, 47, '#3a2a18'), specks([[40, 52]], IRON_LIGHT),
  ],
  // a chain run from a ring in the floor to a pair of open manacles, rusted where it lies
  shackles: () => [
    ball(16, 60, 4.4, 1.8, CHAIN), ball(16, 59.4, 2.8, 1, '#22242a'), hair(13, 59, 19, 59, CHAIN_LIGHT),
    ...[20, 24.5, 29, 33.5, 38].map((x, i) => ball(x, 60 - (i % 2) * 0.8, 2.4, 1.3, i % 2 ? CHAIN_LIGHT : CHAIN)),
    ...[20, 29, 38].map(x => ball(x, 60, 1.1, 0.5, '#22242a')),
    ball(45, 58.4, 5.4, 3.2, CHAIN), ball(45, 58.4, 3.6, 1.8, '#1e2024'), hair(41, 56.6, 49, 56.6, CHAIN_LIGHT),
    ball(52, 61, 4.4, 2.6, CHAIN), ball(52, 61, 2.8, 1.4, '#1e2024'),
    specks([[24, 61.5], [33, 62], [47, 61.8], [12, 62]], '#7a3a20'), specks([[43, 59.5], [54, 62]], '#9a4a26'),
  ],
  // long bones and a skull, left where someone fell a long time ago
  bones: () => [
    limb(12, 59, 32, 55, 1.6, 1.6, BONE), ball(12, 59, 2.4, 2, BONE), ball(32, 55, 2.4, 2, BONE), hair(14, 58, 30, 54.5, '#f0e8d0'),
    limb(28, 61, 50, 62, 1.6, 1.6, BONE_DARK), ball(50, 62, 2.4, 1.8, BONE_DARK),
    ...[56, 58.5, 61].map((y, i) => limb(36 - i, y, 44 + i, y - 1, 0.8, 0.8, BONE)),
    ball(42, 55, 6.4, 5.6, '#e2d8bc'), ball(42, 59.2, 4, 2.2, BONE_DARK), ball(40, 52, 2.4, 1.6, '#f0e8d0'),
    ball(39.6, 55, 1.6, 1.4, '#1a120c'), ball(44.4, 55, 1.6, 1.4, '#1a120c'), sheet([[41.4, 57], [42.6, 57], [42, 58.2]], '#3a2e20'),
    limb(18, 62, 24, 57, 1.2, 1.2, BONE_DARK), specks([[8, 62], [26, 62.5], [56, 62]], BONE_DARK),
  ],
  // fallen stone from the ceiling, in a spill
  rubble: () => [
    ball(22, 58, 9, 5.2, STONE_DARK), ball(38, 57, 10, 6, STONE), ball(49, 60, 6, 3.6, STONE_DARK),
    ball(30, 53, 6, 4.4, '#7c7874'), ball(14, 61, 4.4, 2.6, STONE), ball(42, 51, 3.6, 2.8, '#86827c'), ball(28, 51, 2.4, 1.2, '#9a968e'),
    hair(34, 56, 40, 58, STONE_DARK), hair(20, 56, 24, 59, '#3a3734'), hair(46, 59, 50, 61, '#3a3734'),
    specks([[26, 62], [54, 62.5], [8, 62.5], [34, 62.75], [44, 62.5], [31, 52], [40, 50]], '#5a5652'),
  ],
  // three candles in a pool of their own wax, still burning
  candles: () => [
    ball(32, 61, 16, 2.8, '#d8cca8'), ball(28, 60.4, 8, 1.4, '#e8dcbc'),
    limb(24, 60, 24, 46, 2.2, 2.2, '#efe6cc'), limb(33, 60, 33, 38, 2.4, 2.4, '#f4ecd6'), limb(41, 60, 41, 50, 2.2, 2.2, '#e8dec0'),
    ...[[24, 46], [33, 38], [41, 50]].map(([x, y]) => hair(x - 1.2, y + 1, x - 1.5, y + 8, '#fffaf0')),
    ...[[24, 46], [33, 38], [41, 50]].flatMap(([x, y]) => [
      limb(x, y, x, y - 1.6, 0.3, 0.3, '#1a1410'),
      sheet([[x - 1.4, y - 1.6], [x, y - 7], [x + 1.4, y - 1.6]], '#ffb040', { curve: 0.6, glows: true }), ball(x, y - 3, 0.7, 1.2, '#fff0a0', { glows: true }),
    ]),
    hair(22.5, 50, 22, 56, '#d8cca8'), hair(35, 44, 35.5, 52, '#d8cca8'),
  ],
  // pale toadstools grown in the damp, faintly aglow
  mushrooms: () => [
    ...[[22, 50, 7.2], [37, 43, 8.8], [46, 54, 5.2], [14, 57, 3.6]].flatMap(([x, y, r]) => [
      limb(x, 62, x + r * 0.08, y, r * 0.24, r * 0.2, '#e0dcc8'), hair(x - r * 0.1, 61, x, y + 2, '#f0ecdc'),
      ball(x, y + r * 0.25, r * 0.95, r * 0.2, '#6a9a8a'), ball(x, y, r, r * 0.5, '#8ad0c0', { glows: true }), ball(x - r * 0.35, y - r * 0.15, r * 0.35, r * 0.18, '#e0fff4', { glows: true }),
      specks([[x - r * 0.5, y], [x + r * 0.4, y - r * 0.2]], '#e0fff4', { glows: true }),
    ]),
    specks([[18, 62.5], [30, 62.75], [52, 62.5]], '#4a6a5a'),
  ],
  // a clay urn, sealed, its glaze worn off at the shoulder
  urn: () => [
    ball(32, 49, 13, 13.6, '#9a5a3a'), ball(27, 44, 6, 6, '#b06a46'), ball(32, 58, 10, 4, '#7a4428'),
    limb(32, 36, 32, 28, 5.2, 4.4, '#8a4e32'), ball(32, 27, 7.2, 2.4, '#a8664a'), ball(32, 26.4, 5, 1.4, '#6a3a24'), ball(32, 25.6, 3, 1, '#c8b080'),
    ball(32, 61.2, 9, 2, '#6a3a24'),
    limb(19.4, 46, 44.6, 46, 0.6, 0.6, '#c9a24a'), limb(19.6, 52, 44.4, 52, 0.6, 0.6, '#5a3020'),
    ...[22, 27, 32, 37, 42].map(x => hair(x, 47, x + 1.5, 51, '#c9a24a')),
    hair(38, 40, 41, 44, '#6a3a24'), specks([[25, 40], [29, 38], [36, 39]], '#c88a66'),
  ],
  // what a fallen creature leaves once its body has sunk away: bones, if it
  // was bones or had them to spare, else a dark husk and its rags
  // rings spreading on black water over something lying under it (a drowned one, sunk)
  ripple: () => [
    ball(32, 57, 31, 6, '#0c1218'),
    ball(32, 57, 28, 5, '#6a8aa0'), ball(32, 57, 24.4, 4, '#0c1218'),
    ball(32, 57, 18, 3.4, '#8aa8bc'), ball(32, 57, 14.8, 2.4, '#0c1218'),
    ball(32, 57, 7.2, 1.8, '#aac4d4'), ball(32, 57, 4, 1, '#0c1218'),
    ball(36, 58, 3, 0.8, '#3a4a50'), specks([[20, 55], [46, 56], [30, 59]], '#c8dce8'),
  ],
  remains_bones: () => [
    limb(18, 60, 30, 57, 1.4, 1.4, BONE), limb(34, 62, 46, 59, 1.4, 1.4, BONE_DARK), ball(30, 57, 1.8, 1.6, BONE), ball(46, 59, 1.8, 1.6, BONE_DARK),
    ball(26, 60.4, 4.8, 3.2, '#e2d8bc'), ball(24.4, 60, 1.2, 1, '#1a120c'), ball(27.6, 60, 1.2, 1, '#1a120c'),
    ...[[38, 56], [42, 62], [14, 62]].map(([x, y]) => limb(x - 1.5, y, x + 1.5, y - 0.6, 0.7, 0.7, BONE)),
    specks([[20, 62.5], [50, 62]], BONE_DARK),
  ],
  // a kobold's wire snare, laid flat in a loop between two pegs, with a glint
  // on the wire so it can be seen and gone round (see game.js)
  snare: () => [
    limb(14, 59, 14, 53, 1.2, 0.9, '#5a3e22'), limb(50, 59, 50, 53, 1.2, 0.9, '#5a3e22'), ball(14, 59.4, 2, 0.8, '#3a2a18'), ball(50, 59.4, 2, 0.8, '#3a2a18'),
    ball(32, 59, 15, 4.4, '#b8c0c8'), ball(32, 59, 13.6, 3.4, '#1e1a16'),
    line(15, 54, 19, 58.4, '#b8c0c8'), line(49, 54, 45, 58.4, '#b8c0c8'), hair(16, 54.5, 18, 57, '#e8f0ff'),
    specks([[24, 56], [42, 62], [33, 55]], '#ffffff'), ball(24, 56, 1, 1, '#e8f0ff', { glows: true }),
    specks([[30, 62.5], [36, 62.5]], '#6a5a40'),
  ],
  // what is left of a barrel or crate once broken, and of an urn
  remains_staves: () => [
    limb(14, 61, 30, 58, 1.4, 1.4, WOOD), limb(26, 62, 44, 61, 1.4, 1.4, WOOD_DARK), limb(36, 59, 52, 62, 1.4, 1.4, WOOD_LIGHT),
    ...[[20, 59.5], [34, 61.5], [44, 60.5]].map(([x, y]) => hair(x, y, x + 4, y - 0.5, WOOD_DARK)),
    limb(18, 62, 28, 62, 0.8, 0.8, IRON), hair(19, 61.5, 27, 61.5, IRON_LIGHT), ball(42, 60.8, 6, 1.6, '#5a3e22'),
    specks([[12, 62.5], [48, 62.75], [32, 62.75]], '#5a3e22'),
  ],
  remains_shards: () => [
    sheet([[16, 62], [24, 57], [28, 62]], '#9a5a3a', { tilt: [-0.3, -0.6] }), sheet([[32, 62], [38, 55], [44, 62]], '#8a4e32', { tilt: [0.3, -0.6] }),
    sheet([[46, 62], [50, 59], [54, 62]], '#a8664a', { tilt: [0, -0.7] }), sheet([[10, 62], [12, 60], [14, 62]], '#9a5a3a'),
    hair(18, 61, 25, 58.5, '#c9a24a'), hair(34, 60, 39, 56.5, '#c9a24a'), specks([[22, 62.5], [30, 62.5], [42, 62.75]], '#6a3a24'),
  ],
  remains_husk: () => [
    ball(32, 59, 15, 4.8, '#3a2a26'), ball(26, 57, 7, 3.6, '#4a3630'), ball(22, 56, 3, 1.6, '#5a4640'),
    sheet([[36, 55], [48, 57], [44, 62], [34, 61]], '#5a4a3a', { tilt: [0.3, -0.5] }), hair(38, 57, 45, 58.5, '#3a2a1e'),
    specks([[20, 62], [44, 60], [30, 56], [26, 61]], '#6a1a1a'), hair(28, 58, 34, 59, '#2a1a16'),
  ],
};

/** How tall each stands, as a share of a whole square. */
const SIZE = { snare: 0.42, oilcask: 0.66, flames: 0.55, ripple: 0.9, barrel: 0.66, crate: 0.62, bones: 0.5, shackles: 0.5, rubble: 0.55, candles: 0.46, mushrooms: 0.5, urn: 0.58, remains_bones: 0.46, remains_husk: 0.5, remains_staves: 0.42, remains_shards: 0.4 };
/** Kinds that stand against a wall rather than out in the room. */
const BY_WALL = new Set(['barrel', 'crate', 'urn']);

export { DRESSING, SIZE, BY_WALL };
