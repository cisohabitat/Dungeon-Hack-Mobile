// Floor dressing: what lies about a room that nobody will fight or pick up.
// Barrels and crates against the walls, bones and rubble underfoot, candles
// left burning by someone who is not coming back. None of it blocks the way
// or does anything; it is there so a room reads as a place. Each theme names
// the kinds it keeps (THEMES[i].props in data.js), and the remains a fallen
// creature leaves behind are drawn here too.
//
// The pictures are parts on the same 32-grid as the creatures, standing on
// its bottom edge; SIZE is how tall each stands against a whole square.

import { ball, limb, sheet, line, dots } from './creatures.js';

const WOOD = '#7a5230', WOOD_DARK = '#4e3320', WOOD_LIGHT = '#9a6c40', IRON = '#3e4048';
const BONE = '#d8ceb0', BONE_DARK = '#a89c7c', STONE = '#6e6a66', STONE_DARK = '#4a4744';

const DRESSING = {
  // a cask with iron hoops, its staves showing
  barrel: () => [
    sheet([[9.5, 10], [22.5, 10], [24, 20], [22.5, 31], [9.5, 31], [8, 20]], WOOD, { curve: 1 }),
    ...[12.5, 16, 19.5].map(x => line(x, 11, x, 30, WOOD_DARK)),
    line(8.5, 14, 23.5, 14, IRON), line(8, 20, 24, 20, IRON), line(8.5, 27, 23.5, 27, IRON),
    ball(16, 10, 6.5, 1.8, WOOD_LIGHT),
    ball(16, 10, 4.5, 1, WOOD_DARK),
  ],
  // a slatted crate, braced corner to corner, seen a little from above
  crate: () => [
    sheet([[8, 17], [24, 17], [24, 31], [8, 31]], '#8a6a40', { tilt: [0, 0.1] }),
    sheet([[8, 17], [24, 17], [21, 13], [11, 13]], '#a8844e', { tilt: [0, -0.8] }),
    line(8, 17, 24, 17, WOOD_DARK), line(8, 24, 24, 24, '#5a4028'),
    line(9, 18, 23, 30, '#6a4c2c'), line(9, 30, 23, 18, '#6a4c2c'),
    line(8, 17, 8, 31, WOOD_DARK), line(24, 17, 24, 31, WOOD_DARK),
  ],
  // long bones and a skull, left where someone fell a long time ago
  bones: () => [
    limb(6, 29.5, 16, 27.5, 0.8, 0.8, BONE), ball(6, 29.5, 1.2, 1, BONE), ball(16, 27.5, 1.2, 1, BONE),
    limb(14, 30.5, 25, 31, 0.8, 0.8, BONE_DARK), ball(25, 31, 1.2, 0.9, BONE_DARK),
    ball(21, 27.5, 3.2, 2.8, '#e2d8bc'), ball(21, 29.6, 2, 1.1, BONE_DARK),
    dots([[20, 27], [22, 27]], '#1a120c'), dots([[21, 29]], '#3a2e20'),
    limb(9, 31, 12, 28.5, 0.6, 0.6, BONE_DARK),
  ],
  // fallen stone from the ceiling, in a spill
  rubble: () => [
    ball(11, 29, 4.5, 2.6, STONE_DARK), ball(19, 28.5, 5, 3, STONE), ball(24.5, 30, 3, 1.8, STONE_DARK),
    ball(15, 26.5, 3, 2.2, '#7c7874'), ball(7, 30.5, 2.2, 1.3, STONE), ball(21, 25.5, 1.8, 1.4, '#86827c'),
    dots([[13, 31], [27, 31], [4, 31], [17, 31]], '#5a5652'),
  ],
  // three candles in a pool of their own wax, still burning
  candles: () => [
    ball(16, 30.5, 8, 1.4, '#d8cca8'),
    limb(12, 30, 12, 23, 1.1, 1.1, '#efe6cc'), limb(16.5, 30, 16.5, 19, 1.2, 1.2, '#f4ecd6'), limb(20.5, 30, 20.5, 25, 1.1, 1.1, '#e8dec0'),
    dots([[12, 22], [16, 18], [20, 24]], '#1a1410'),
    dots([[12, 21], [16, 17], [20, 23]], '#ffb040'), dots([[12, 20], [16, 16], [20, 22]], '#fff0a0'),
  ],
  // pale toadstools grown in the damp, faintly aglow
  mushrooms: () => [
    limb(11, 31, 11, 25, 0.9, 0.8, '#d8d4c0'), ball(11, 24.5, 3.6, 1.8, '#9ac8b8'),
    limb(18, 31, 18.5, 22, 1, 0.9, '#e0dcc8'), ball(18.5, 21.5, 4.4, 2.2, '#8ad0c0'),
    limb(23, 31, 23, 27.5, 0.7, 0.6, '#d0ccb8'), ball(23, 27, 2.6, 1.3, '#a0d8c8'),
    dots([[17, 21], [20, 21], [10, 24]], '#e0fff4'),
  ],
  // a clay urn, sealed, its glaze worn off at the shoulder
  urn: () => [
    ball(16, 24.5, 6.5, 6.8, '#9a5a3a'),
    limb(16, 18, 16, 14, 2.6, 2.2, '#8a4e32'), ball(16, 13.5, 3.6, 1.2, '#a8664a'),
    ball(16, 30.6, 4.5, 1, '#6a3a24'),
    line(10, 23, 22, 23, '#c9a24a'), line(10.5, 26, 21.5, 26, '#5a3020'),
  ],
  // what a fallen creature leaves once its body has sunk away: bones, if it
  // was bones or had them to spare, else a dark husk and its rags
  // rings spreading on black water over something lying under it (a drowned one, sunk)
  ripple: () => [
    ball(16, 28.5, 15.5, 3, '#0c1218'),
    ball(16, 28.5, 14, 2.5, '#6a8aa0'), ball(16, 28.5, 12.2, 2, '#0c1218'),
    ball(16, 28.5, 9, 1.7, '#8aa8bc'), ball(16, 28.5, 7.4, 1.2, '#0c1218'),
    ball(16, 28.5, 3.6, 0.9, '#aac4d4'), ball(16, 28.5, 2, 0.5, '#0c1218'),
  ],
  remains_bones: () => [
    limb(9, 30, 15, 28.5, 0.7, 0.7, BONE), limb(17, 31, 23, 29.5, 0.7, 0.7, BONE_DARK),
    ball(13, 30.2, 2.4, 1.6, '#e2d8bc'), dots([[12, 30], [14, 30]], '#1a120c'),
    dots([[19, 28], [21, 31], [7, 31]], BONE),
  ],
  // what is left of a barrel or crate once broken, and of an urn
  remains_staves: () => [
    limb(7, 30.5, 15, 29, 0.7, 0.7, WOOD), limb(13, 31, 22, 30.5, 0.7, 0.7, WOOD_DARK), limb(18, 29.5, 26, 31, 0.7, 0.7, WOOD_LIGHT),
    line(9, 31, 14, 31, IRON), ball(21, 30.4, 3, 0.8, '#5a3e22'),
  ],
  remains_shards: () => [
    sheet([[8, 31], [12, 28.5], [14, 31]], '#9a5a3a', { tilt: [-0.3, -0.6] }), sheet([[16, 31], [19, 27.5], [22, 31]], '#8a4e32', { tilt: [0.3, -0.6] }),
    sheet([[23, 31], [25, 29.5], [27, 31]], '#a8664a', { tilt: [0, -0.7] }), dots([[11, 30], [20, 29]], '#c9a24a'),
  ],
  remains_husk: () => [
    ball(16, 29.5, 7.5, 2.4, '#3a2a26'), ball(13, 28.5, 3.5, 1.8, '#4a3630'),
    sheet([[18, 27.5], [24, 28.5], [22, 31], [17, 30.5]], '#5a4a3a', { tilt: [0.3, -0.5] }),
    dots([[10, 31], [22, 30], [15, 28]], '#6a1a1a'),
  ],
};

/** How tall each stands, as a share of a whole square. */
const SIZE = { ripple: 0.9, barrel: 0.66, crate: 0.62, bones: 0.5, rubble: 0.55, candles: 0.46, mushrooms: 0.5, urn: 0.58, remains_bones: 0.46, remains_husk: 0.5, remains_staves: 0.42, remains_shards: 0.4 };
/** Kinds that stand against a wall rather than out in the room. */
const BY_WALL = new Set(['barrel', 'crate', 'urn']);

export { DRESSING, SIZE, BY_WALL };
