// Creatures built from lit parts instead of hand-typed pixel grids.
//
// Each creature is a list of shapes drawn back to front on a 32x32 grid: balls
// (heads, bellies, joints) shaded as spheres, limbs as tapered cylinders,
// sheets (cloaks, wings, ears) as gently curved planes, and single pixels for
// the details that make a face. The painter (painter.js) lights every shape
// from the upper left, picks its tone from a ramp that cools into shadow and
// warms into light, and draws a contact line wherever a part passes in front
// of another, so a limb reads as in front of the body rather than merged with
// it. The floor is row 31.
//
// The parts and the kits several creatures share are in parts.js, the painter
// in painter.js, the later creatures (traders, companions, the peoples below,
// the deep beasts) in folk.js, the encounters' props in props.js, and the named
// champions, a shade's gear and the heroes' portraits in champions.js; this
// file keeps the first creatures, their poses, and the one list of them all.

import { CHAMPIONS, CHAMPION_OF, PORTRAITS, SHADE_GEAR } from './champions.js';
import { FOLK } from './folk.js';
import { paintParts } from './painter.js';
import { ball, both, both64, dots, drowHair, drowHand, drowHead, drowKit, grow, hair, limb, line, m64, midOf, nudge, oval, scimitar, sheet, specks, turn, up2 } from './parts.js';
import { PROPS } from './props.js';

// Every creature and every prop is drawn lifelike, on the finer grid: a
// human's proportions, cloth falling in folds, armour, hands and faces, scales
// and fur, wood and stone (see m64, up2); the items keep the 32-unit grid they
// were designed on and are set on this one as they are painted (assets.js).
const gridOf = k => (k in CREATURES || k in PROPS || k in CHAMPION_OF ? 64 : 32);

const CREATURES = {
  // A goblin: small, wiry and stooped, all knees and elbows, its great ears
  // swept back, a long hooked nose over a grin of crooked teeth, a ragged tunic
  // belted with cord, and a notched knife held low.
  goblin: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', tunic = '#6a4628', tunicDk = '#4a3018', cord = '#8a6a40', steel = '#b8bcc4';
    return [
      // bandy legs, knobbed at the knee, long bare feet
      ...both64(limb(28, 44, 25.5, 52, 2, 1.7, skin)), ...both64(ball(25.5, 52, 1.9, 1.7, skinDk)),
      ...both64(limb(25.5, 52, 26.5, 60, 1.7, 1.5, skin)), ...both64(limb(26.5, 61, 22, 62, 1.6, 1.2, skinDk)),
      ...both64(specks([[20.5, 62.5], [21.5, 62.75]], '#d8cfb0')),
      // the wiry body, ribs showing above the tunic, a pot-belly under it
      ball(32, 36, 7.4, 8.5, skin), ...[29, 31].map(y => hair(27, y, 31, y - 0.5, skinDk)), ...[29, 31].map(y => hair(37, y, 33, y - 0.5, skinDk)),
      sheet([[23.5, 33], [40.5, 33], [42, 46], [39.5, 44.5], [37, 48], [34, 45], [31, 48.5], [28, 45], [25, 48], [22, 46]], tunic, { curve: 1 }),
      sheet([[23.5, 33], [27, 33], [25.5, 47], [22, 46]], tunicDk, { curve: 0.3 }),
      line(23.5, 34.5, 40.5, 34.5, cord), limb(34, 35, 35, 39, 0.4, 0.3, cord),
      ...[[26, 41], [29, 43], [36, 42]].map(([x, y]) => specks([[x, y], [x + 0.5, y + 0.5]], '#c8a878')),
      // the left arm dangling, long-fingered; the right holding the knife low and forward
      ...(atk ? [limb(24.5, 28, 17, 31, 1.9, 1.6, skin), limb(17, 31, 11.5, 35, 1.6, 1.4, skin)] : [limb(24.5, 28, 20, 37, 1.9, 1.6, skin), limb(20, 37, 19, 45, 1.6, 1.4, skin)]),
      ...(atk ? [ball(10.6, 35.8, 1.9, 1.7, skin), ...[34.4, 35.8, 37.2].map(y => limb(9.4, y, 7, y + 0.4, 0.4, 0.3, skin))] : [ball(19, 46.4, 1.9, 1.7, skin), ...[17.6, 19, 20.4].map(x => limb(x, 47.5, x - 0.3, 50, 0.4, 0.3, skin))]),
      ...(atk ? [limb(39.5, 28, 46, 21, 1.9, 1.6, skin), limb(46, 21, 44.4, 13, 1.6, 1.4, skin)] : [limb(39.5, 28, 45, 35, 1.9, 1.6, skin), limb(45, 35, 47, 41, 1.6, 1.4, skin)]),
      ...(atk ? [limb(45.4, 10.4, 52, 2, 0.9, 0.5, steel, { smooth: 1 }), hair(45.6, 9.4, 51.4, 2, '#f0f2f6'), specks([[48.5, 6], [49.5, 4.75]], '#5a5e66')] : [limb(48, 41, 54, 30, 0.9, 0.5, steel, { smooth: 1 }), hair(48.5, 40, 53.5, 31, '#f0f2f6'), specks([[51.5, 34.5], [52.5, 33]], '#5a5e66')]),
      ...(atk ? [limb(43.2, 14, 45.6, 10.6, 0.7, 0.7, '#5a3a20'), ball(44.2, 12.4, 1.9, 1.7, skin)] : [limb(46.4, 43, 48.4, 40, 0.7, 0.7, '#5a3a20'), ball(47, 41.6, 1.9, 1.7, skin)]),
      // a scrawny neck, the great ears swept back and up, notched, veined
      limb(32, 24, 32, 28.5, 2, 2.3, skinDk),
      sheet([[25.5, 17], [6, 10], [9, 14.5], [7.5, 16], [11, 18.5], [25.5, 22]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[38.5, 17], [58, 10], [55, 14.5], [56.5, 16], [53, 18.5], [38.5, 22]], skin, { tilt: [0.5, -0.2] }),
      sheet([[24, 17.5], [12, 13], [24, 20.5]], '#b06e56'), sheet([[40, 17.5], [52, 13], [40, 20.5]], '#b06e56'),
      hair(22, 18, 14, 14.5, '#8a4e3e'), hair(42, 18, 50, 14.5, '#8a4e3e'),
      // the head: a narrow skull, the brow dipping to a scowl, a long hooked nose over the grin
      ball(32, 18, 7, 6.6, skin), ball(32, 22.4, 5, 2.6, skin),
      limb(26, 15, 30.5, 16.6, 1.2, 1, skinDk), limb(38, 15, 33.5, 16.6, 1.2, 1, skinDk),
      ball(28.6, 17.6, 1.8, 1.2, '#2a4a1c'), ball(35.4, 17.6, 1.8, 1.2, '#2a4a1c'),
      dots([[28, 17], [29, 17], [35, 17], [36, 17]], '#ffe040'), dots([[29, 17], [35, 17]], '#1a1010'),
      limb(32, 17, 32.6, 22, 0.9, 1.5, skin), ball(33, 22.4, 1.6, 1.2, skinLt), hair(31.5, 18, 31.5, 21.5, skinLt),
      ...(atk ? [sheet([[26, 23], [32, 24.4], [38, 23], [36.6, 28.4], [32, 29.8], [27.4, 28.4]], '#2a1010'), ball(32, 28, 2.4, 1, '#8a2a2a')] : [sheet([[26.5, 23.4], [32, 25], [37.5, 23.4], [36, 26.4], [32, 27.4], [28, 26.4]], '#2a1010')]),
      dots([[28, 24], [30, 24], [33, 25], [35, 24]], '#e8dcb8'), ball(32, 26.4, 1.6, 0.6, '#6a2424'),
      // warts, a nick in the scalp, the knuckles
      specks([[27.5, 13], [36, 13.5], [30.5, 11.5], [37.5, 21]], skinDk), hair(33, 11.5, 34.5, 13.5, '#2f5220'),
    ];
  },

  // The Goblin Warlord: a goblin grown huge on the Warrens' plunder, thick in
  // the neck and arms, great notched ears, a crown of hammered gold with a red
  // stone, a coat of gilded scales, spiked gold pauldrons, a red cloak, the
  // war-drum at his hip and a cleaver raised in his fist.
  warlord: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#5f9a42', skinDk = '#3a6428', skinLt = '#7cb85a', gold = '#d8a830', goldLt = '#f4d470', deep = '#8a6418';
    const cloak = '#8a1c1c', cloakDk = '#5a1010', leather = '#4a3020', boot = '#2e2218', steel = '#a8b0bc', steelLt = '#e8eef6';
    return [
      // the cloak, falling wide behind him to the floor
      sheet([[16, 20], [48, 20], [56, 62], [50, 63], [44, 61.5], [38, 63], [32, 61.5], [26, 63], [20, 61.5], [14, 63], [8, 62]], cloak, { curve: 1 }),
      ...[[18, 24, 11, 61], [45, 24, 52, 61]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 2, y0], [x1 + 1.5, y1], [x1 - 1.5, y1]], cloakDk, { curve: 0.3 })),
      // legs like tree-roots, in boots cuffed with fur
      ...both64(limb(27, 42, 26, 52, 3.6, 3.2, skinDk)), ...both64(limb(26, 52, 25.5, 59, 3.2, 3, boot)),
      ...both64(sheet([[21.5, 51], [30.5, 51], [30, 54], [22, 54]], '#6a5a44', { curve: 0.6 })),
      ...both64(ball(24.5, 61.2, 4.4, 1.8, boot)),
      // the belly under the coat, the coat of gilded scales, row on row
      ball(32, 33, 11, 10, skin),
      sheet([[20, 23], [44, 23], [45.5, 43], [18.5, 43]], deep, { curve: 1 }),
      ...[25, 28.5, 32, 35.5, 39].flatMap((y, r) => [21.5, 25.5, 29.5, 33.5, 37.5, 41.5].map(x => ball(x + (r % 2 ? 2 : 0), y, 1.9, 1.5, gold))),
      // a broad belt, its buckle a skull
      sheet([[18.5, 41], [45.5, 41], [45.5, 45], [18.5, 45]], leather, { curve: 0.8 }),
      ball(32, 43, 2.4, 2.2, '#e8e0c8'), dots([[31, 43], [33, 43]], '#1a1010'),
      // tassets of leather and gold below it
      ...[21, 26, 31.5, 37, 42].map(x => sheet([[x - 2, 45], [x + 2, 45], [x + 1.6, 51], [x - 1.6, 51]], leather, { curve: 0.5 })),
      ...[21, 26, 31.5, 37, 42].map(x => line(x - 1.6, 50.5, x + 1.6, 50.5, gold)),
      // the war-drum at his hip, its skin pale, lashed with cord
      ball(47, 46, 5.4, 4.2, '#6a3a1c'), ball(47, 43.6, 5.2, 1.8, '#e0cc98'),
      ...[43, 47, 51].map(x => limb(x, 44.5, x + (x < 47 ? 1.5 : x > 47 ? -1.5 : 0), 49.5, 0.45, 0.45, '#c8a878')),
      // the left arm, hanging, the fist like a mallet, a gold band on the wrist
      limb(18, 25, 14, 35, 3.6, 3.2, skin), limb(14, 35, 13, 43, 3, 2.6, skin),
      line(10.5, 41, 15.5, 41, gold), ball(13, 45.5, 3, 2.8, skin), hair(11.5, 44.5, 14.5, 44.5, skinDk),
      // the right arm raised, the cleaver up in it
      ...(atk ? [] : [limb(46, 25, 51, 31, 3.6, 3.2, skin), limb(51, 31, 54, 21, 3, 2.6, skin),
      limb(54.5, 22, 55.5, 2, 1.1, 1.1, '#5a3a20'),
      sheet([[53.5, 0.6], [63, 1.2], [62.4, 13], [54.2, 11.4]], steel, { tilt: [0.5, -0.1] }),
      line(62.6, 1.8, 62.2, 12.4, steelLt), sheet([[54.5, 7], [56, 7], [56, 11.6], [54.5, 11.4]], '#6a1818'),
      ball(54, 21, 2.9, 2.8, skin), hair(52.5, 20, 55.5, 20, skinDk)]),
      // the pauldrons, gold and spiked
      ...both64(ball(18.5, 23.5, 6, 4.4, gold)), ...both64(hair(14, 21.5, 22, 20.5, goldLt)),
      ...both64(sheet([[14, 21], [12, 15], [17, 20]], deep)), ...both64(sheet([[19, 20], [18.5, 14], [22, 19.6]], deep)),
      // a bull neck, the great ears, notched with age and fighting, rings in them
      limb(32, 17, 32, 22, 5, 5.6, skinDk),
      sheet([[23, 12], [5, 4], [8, 9], [6.5, 10.5], [10, 13], [23, 17.5]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[41, 12], [59, 4], [56, 9], [57.5, 10.5], [54, 13], [41, 17.5]], skin, { tilt: [0.5, -0.2] }),
      sheet([[21.5, 12.5], [10, 6.5], [21.5, 15.5]], '#a86a52'), sheet([[42.5, 12.5], [54, 6.5], [42.5, 15.5]], '#a86a52'),
      ball(9, 9.5, 0.8, 0.8, gold), ball(55, 9.5, 0.8, 0.8, gold),
      // the head: a heavy skull, jaw thrust out
      ball(32, 12, 8.5, 8, skin), ball(32, 17, 7, 3.6, skin),
      // the crown: a band of hammered gold, five points, a red stone
      sheet([[23.5, 7], [40.5, 7], [40.5, 3.4], [23.5, 3.4]], gold, { curve: 0.5 }),
      ...[24.4, 28.2, 32, 35.8, 39.6].map(x => sheet([[x - 1.6, 3.6], [x, -0.4], [x + 1.6, 3.6]], gold)),
      hair(24, 4, 40, 4, goldLt), ball(32, 5.2, 1.5, 1.3, '#c02030', { glows: true }), dots([[31, 4]], '#ff9aa0'),
      // a heavy brow, small cruel eyes, a hooked nose and a gap-toothed grin with tusks
      limb(25, 9.5, 30.5, 11, 1.5, 1.2, skinDk), limb(39, 9.5, 33.5, 11, 1.5, 1.2, skinDk),
      ball(28, 12, 2, 1.3, '#2a3a18'), ball(36, 12, 2, 1.3, '#2a3a18'),
      dots([[27, 12], [28, 12], [36, 12], [37, 12]], '#ff8a20'), dots([[28, 12], [36, 12]], '#1a0808'),
      limb(32, 11.5, 32.2, 15.6, 0.9, 1.6, skin), ball(32.2, 15.8, 2, 1.4, skinLt), hair(31, 16.75, 33.5, 16.75, skinDk),
      ...(atk ? [sheet([[25, 18], [32, 19.2], [39, 18], [37.4, 23.8], [32, 25.2], [26.6, 23.8]], '#2a1010'),
      dots([[28, 19], [30, 19], [34, 19], [36, 19], [30, 24], [34, 24]], '#f0e6c8'),
      sheet([[26.4, 21], [27.8, 21.4], [26.6, 17.6]], '#f0e6c8'), sheet([[37.6, 21], [36.2, 21.4], [37.4, 17.6]], '#f0e6c8')] : [sheet([[25, 18], [32, 19.6], [39, 18], [37, 21.6], [32, 22.6], [27, 21.6]], '#2a1010'),
      dots([[28, 19], [30, 19], [34, 19], [36, 19]], '#f0e6c8'),
      sheet([[26.4, 21], [27.8, 21.4], [26.6, 17.6]], '#f0e6c8'), sheet([[37.6, 21], [36.2, 21.4], [37.4, 17.6]], '#f0e6c8')]),
      // a scar across the brow, warts, the light along the nose
      hair(26, 8, 30, 12.5, '#2f5220'), specks([[38.5, 15.5], [25.5, 16], [34.5, 8.5]], skinDk),
      hair(31.5, 12, 31.5, 15, skinLt),
      // in the windup the sword arm comes round in front, the cleaver up over the ear
      ...(atk ? [...turn([limb(46, 25, 51, 31, 3.6, 3.2, skin), limb(51, 31, 54, 21, 3, 2.6, skin),
      limb(54.5, 22, 55.5, 2, 1.1, 1.1, '#5a3a20'),
      sheet([[53.5, 0.6], [63, 1.2], [62.4, 13], [54.2, 11.4]], steel, { tilt: [0.5, -0.1] }),
      line(62.6, 1.8, 62.2, 12.4, steelLt), sheet([[54.5, 7], [56, 7], [56, 11.6], [54.5, 11.4]], '#6a1818'),
      ball(54, 21, 2.9, 2.8, skin), hair(52.5, 20, 55.5, 20, skinDk)], 46, 25, -20)] : []),
    ];
  },

  // A skeleton: a man's bones held together by nothing, a ribcage over an empty
  // belly, a rag of a loincloth rotting on it, and a rusted sword raised.
  skeleton: (pose = 'idle') => {
    const atk = pose === 'windup';
    const bone = '#d8d0b8', boneDk = '#a49a82', boneSh = '#6e6656', rag = '#4a3c2c', rust = '#8a5a3a', steel = '#9aa0aa', steelLt = '#d8dce4', grip = '#4a3420';
    const ribs = [];
    for (let i = 0; i < 6; i++) {
      const y = 18.5 + i * 2.3, w = 6.2 - Math.abs(i - 2) * 0.5 - (i > 3 ? 0.8 : 0);
      ribs.push(...both64(limb(31.4, y, 32 - w, y + 1.3, 0.55, 0.5, bone)), ...both64(limb(32 - w, y + 1.3, 32 - w + 1.2, y + 2.6, 0.5, 0.4, bone)));
    }
    return [
      // the legs: thigh, knee, shin, the long bones of the feet
      ...both64(limb(29, 39, 28, 48, 1.1, 0.9, bone)), ...both64(ball(28, 48.4, 1.4, 1.3, boneDk)),
      ...both64(limb(28, 49, 28.4, 58.5, 0.9, 0.75, bone)), ...both64(limb(27.6, 49.5, 27.8, 58, 0.45, 0.4, boneDk)),
      ...both64(ball(28.4, 59.4, 1, 0.9, boneDk)), ...both64(limb(28.2, 60.2, 24.6, 61.6, 0.7, 0.5, bone)),
      // the pelvis, and a rag of a loincloth hanging from it
      sheet([[25.5, 33.5], [38.5, 33.5], [37, 38.5], [32, 40], [27, 38.5]], bone, { curve: 0.8 }),
      ...both64(ball(28.8, 36, 1.3, 1.1, boneSh)),
      sheet([[26.5, 36], [37.5, 36], [38, 44], [36, 42.5], [34.5, 45.5], [32, 43], [29.5, 46], [28, 42.5], [26, 44]], rag, { curve: 0.8 }),
      // the spine, and the ribs curving round from it
      ...[17, 19.3, 21.6, 23.9, 26.2, 28.5, 30.8].map(y => ball(32, y, 0.9, 0.7, boneDk)), limb(32, 16, 32, 33.5, 0.55, 0.55, boneDk),
      ...ribs,
      ball(32, 20.5, 1.1, 2.4, boneDk),
      // the collarbones and shoulders
      ...both64(limb(25, 17, 31, 16.2, 0.6, 0.5, bone)), ...both64(ball(24.6, 17.6, 1.5, 1.4, bone)),
      // the left arm hanging, the hand's bones loose
      ...(atk ? [limb(24.4, 18.5, 19, 24, 0.9, 0.8, bone), ball(18.8, 24.4, 1.1, 1, boneDk)] : [limb(24.4, 18.5, 23, 27, 0.9, 0.8, bone), ball(23, 27.4, 1.1, 1, boneDk)]),
      ...(atk ? [limb(18.6, 24.6, 13.4, 27.4, 0.75, 0.6, bone), limb(18.8, 25.4, 13.8, 28.2, 0.4, 0.35, boneDk)] : [limb(23, 27.8, 22.6, 35, 0.75, 0.6, bone), limb(23.6, 28, 23.4, 34.6, 0.4, 0.35, boneDk)]),
      ...(atk ? [...[[11.6, 26.6, 9.4, 25.6], [11.4, 27.8, 9, 27.8], [11.8, 29, 9.6, 30]].map(([a, b, c, d]) => limb(a, b, c, d, 0.35, 0.3, bone))] : [...[[21.6, 36.2, 21.2, 38.6], [22.6, 36.6, 22.6, 39.2], [23.6, 36.2, 23.9, 38.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.35, 0.3, bone))]),
      ...(atk ? [ball(12.4, 27.8, 1, 0.9, bone)] : [ball(22.7, 35.6, 1, 0.9, bone)]),
      // the right arm raised, the rusted sword held up in it
      ...(atk ? [limb(39.6, 18.5, 44.6, 14.6, 0.9, 0.8, bone), ball(44.6, 14.6, 1.1, 1, boneDk), limb(44.6, 14.6, 47, 11, 0.75, 0.6, bone),
        // the sword cocked high over the shoulder for the chop down
        ...nudge(turn([limb(44.8, 2.5, 44.8, 19.6, 0.8, 0.6, steel, { smooth: 1 }), hair(44.5, 3.5, 44.5, 19, steelLt),
      sheet([[44.8, 0.6], [45.6, 2.8], [44, 2.8]], steel),
      specks([[45, 7], [44.5, 11.5], [45.25, 14], [44.75, 17]], rust),
      limb(41.4, 20.2, 48.2, 20.2, 0.7, 0.7, rust), limb(44.8, 21, 44.8, 25, 0.6, 0.6, grip), ball(44.8, 25.8, 0.9, 0.9, rust),
      ball(44.6, 22.4, 1.3, 1.2, bone), ...[21.6, 22.6, 23.6].map(y => hair(43.5, y, 45.75, y, boneSh))], 44.6, 22.4, 50), 2.4, -11.4)] : [limb(39.6, 18.5, 42.5, 26, 0.9, 0.8, bone), ball(42.6, 26.4, 1.1, 1, boneDk),
      limb(42.6, 26.4, 44.6, 21.8, 0.75, 0.6, bone),
      limb(44.8, 2.5, 44.8, 19.6, 0.8, 0.6, steel, { smooth: 1 }), hair(44.5, 3.5, 44.5, 19, steelLt),
      sheet([[44.8, 0.6], [45.6, 2.8], [44, 2.8]], steel),
      specks([[45, 7], [44.5, 11.5], [45.25, 14], [44.75, 17]], rust),
      limb(41.4, 20.2, 48.2, 20.2, 0.7, 0.7, rust), limb(44.8, 21, 44.8, 25, 0.6, 0.6, grip), ball(44.8, 25.8, 0.9, 0.9, rust),
      ball(44.6, 22.4, 1.3, 1.2, bone), ...[21.6, 22.6, 23.6].map(y => hair(43.5, y, 45.75, y, boneSh))]),
      // the skull: deep sockets, a pinprick of red in each, the nose a hole, the teeth bared
      limb(32, 13, 32, 16, 0.8, 0.8, boneDk),
      ball(32, 8, 3.7, 4.3, bone), ball(32, 12.3, 2.6, 1.4, boneDk),
      ball(30.4, 8.2, 1.15, 1.1, '#120c10'), ball(33.6, 8.2, 1.15, 1.1, '#120c10'),
      dots([[30, 8], [33, 8]], '#e03020'),
      sheet([[31.4, 10.6], [32.6, 10.6], [32, 9.4]], '#2a2220'),
      ...(atk ? [ball(32, 13.6, 2.2, 1.2, boneDk), ...[30.5, 31.5, 32.5, 33.5].map(x => hair(x, 11.75, x, 12.5, boneSh)), ...[30.75, 32, 33.25].map(x => hair(x, 14.75, x, 14, boneSh))] : [...[30.5, 31.5, 32.5, 33.5].map(x => hair(x, 11.75, x, 13, boneSh)), hair(30, 12.25, 34, 12.25, boneSh)]),
      hair(29, 5, 30, 6.5, boneDk), hair(34.5, 4.5, 35, 6, boneDk),
    ];
  },

  // A cave spider the size of a hound: a bloated, glossy abdomen with the red
  // hourglass on it, a bristled body slung low between eight jointed legs,
  // a cluster of eyes catching the light and fangs that drip.
  spider: (pose = 'idle') => {
    const atk = pose === 'windup';
    const shell = '#3e3454', shellLt = '#5e5278', shellDk = '#241e34', leg = '#4a3e64', legDk = '#2e2642', red = '#c02828', fang = '#e8e0d0';
    const legs = [];
    // each leg from its root on the body, up to the knee, down to the foot
    for (const [rx, ry, kx, ky, fx, fy] of [atk ? [26, 37, 15, 17, 8, 5] : [26, 38, 12, 24, 4, 50], atk ? [25.5, 40, 8, 27, 1, 39] : [25.5, 40.5, 9, 32, 3, 58], [26, 43, 12, 42, 9, 62], [27, 45, 19, 50, 18, 63]]) {
      legs.push(...both64(limb(rx, ry, kx, ky, 1.6, 1.3, leg)), ...both64(ball(kx, ky, 1.7, 1.7, legDk)), ...both64(limb(kx, ky, fx, fy, 1.3, 0.7, leg)));
      legs.push(...both64(hair(kx + (rx - kx) * 0.3, ky + (ry - ky) * 0.3 - 1, kx + (rx - kx) * 0.3 - 0.75, ky + (ry - ky) * 0.3 - 2.5, '#6e5c8a')));
    }
    return [
      ...legs,
      // the abdomen behind, glossy, the hourglass on it, bristles round its edge
      ball(32, 33, 14, 12, shell), ball(28, 28, 6, 4.4, shellLt),
      sheet([[28, 25], [36, 25], [32, 31]], red, { tilt: [-0.2, -0.3] }), sheet([[32, 30], [36, 37], [28, 37]], red, { tilt: [-0.2, 0.1] }),
      hair(28.5, 25.5, 35.5, 25.5, '#ff6060'),
      ...[[19, 26], [18, 33], [20, 40], [45, 26], [46, 33], [44, 40], [25, 21], [39, 21], [32, 20.5]].map(([x, y]) => hair(x, y, x + (x < 32 ? -1.5 : x > 32 ? 1.5 : 0), y - 1.5, '#7a6a96')),
      // the head-and-body in front, slung low, a ring of eyes on it
      ball(32, 47, 8, 6.4, shellDk), ball(30, 45, 3, 2, shell),
      ...[[28.5, 44.5], [31, 43.6], [33, 43.6], [35.5, 44.5], [30, 46.4], [34, 46.4]].map(([x, y], i) => ball(x, y, i < 4 ? 1.1 : 0.8, i < 4 ? 1 : 0.7, '#c02828', { glows: true })),
      specks([[28, 44], [30.5, 43], [32.5, 43], [35, 44]], '#ffd0d0'),
      // the fangs, hooked and dripping
      ...(atk ? [limb(29.5, 51, 25.6, 55, 1.1, 0.4, fang), limb(34.5, 51, 38.4, 55, 1.1, 0.4, fang), sheet([[30.4, 51.6], [33.6, 51.6], [32, 54.4]], '#1a1020')] : [limb(29.5, 51, 28.5, 56, 1.1, 0.4, fang), limb(34.5, 51, 35.5, 56, 1.1, 0.4, fang)]),
      ball(29.6, 50.8, 1.8, 1.4, shellDk), ball(34.4, 50.8, 1.8, 1.4, shellDk),
      ...(atk ? [specks([[25.6, 56], [38.4, 56.4], [25.8, 57.6]], '#a8d048')] : [specks([[28.5, 57], [35.5, 57.5], [28.75, 58.5]], '#a8d048')]),
    ];
  },

  // A giant rat, side on: a long hunched body in coarse brown fur, a pointed
  // whiskered snout, round ears, beady red eyes, pink paws and a long naked
  // tail curling up behind.
  rat: (pose = 'idle') => {
    const atk = pose === 'windup';
    const fur = '#8a6a48', furDk = '#5a4430', furLt = '#a8886a', pink = '#d89a90', pinkDk = '#a86a64';
    return [
      // the tail curling up behind
      limb(46, 52, 56, 50, 1.4, 1, pink), limb(56, 50, 60, 42, 1, 0.8, pink), limb(60, 42, 57, 35, 0.8, 0.5, pink),
      ...[[49, 51.5], [53, 51], [57, 48.5], [59.5, 44.5], [59, 39.5]].map(([x, y]) => hair(x - 0.5, y - 0.75, x + 0.5, y + 0.75, pinkDk)),
      ...(atk ? [...turn([limb(40, 54, 42, 61, 1.8, 1.4, furDk), limb(24, 54, 23, 61, 1.8, 1.4, furDk),
      ball(36, 50, 15, 9, fur), ball(42, 47, 7, 6, furLt), ball(34, 55, 10, 4, furDk),
      ...[[26, 45], [31, 43.5], [37, 43], [43, 43.5], [48, 45.5], [29, 48], [35, 47.5], [41, 48], [46, 50]].map(([x, y]) => hair(x, y, x + 2, y + 1, furDk)),
      limb(30, 56, 23, 59, 2, 1.6, fur), limb(46, 55, 47.5, 61.5, 2.2, 1.8, fur),
      ball(22, 59.4, 2.4, 1.3, pink), ball(48, 62, 2.6, 1.2, pink), specks([[20, 60.2], [21.5, 60.6], [46, 62.75], [47.5, 62.75]], '#f0e8dc'),
      ball(20, 41, 3.4, 4, fur), ball(25, 40.6, 3.2, 3.8, fur), ball(20, 41.4, 1.8, 2.4, pink), ball(25, 41, 1.6, 2.2, pink),
      ball(18, 48, 8.4, 6.6, fur), limb(14, 48, 5, 51, 4, 2, fur), ball(4.6, 51.2, 2, 1.6, furLt), ball(3.4, 51, 1.1, 1, pinkDk),
      dots([[15, 46]], '#e02020'), specks([[15, 45.5]], '#ffb0b0'),
      hair(6, 50, 0.5, 47.5, '#e0d4c0'), hair(6, 51.25, 0.25, 51.5, '#e0d4c0'), hair(6, 52, 0.75, 54.5, '#e0d4c0'),
      sheet([[2.6, 52.4], [10.6, 52.8], [9.4, 58.6], [4, 57.4]], '#2a1814'), ball(6.6, 56.6, 2, 1, '#c06a64'), sheet([[3.8, 52.6], [5.2, 52.7], [4.4, 55.4]], '#f2ead2'), sheet([[5.6, 52.8], [7, 52.9], [6.2, 55.6]], '#f2ead2')], 47, 61, 14)] : [// the far legs, behind
      limb(40, 54, 42, 61, 1.8, 1.4, furDk), limb(24, 54, 23, 61, 1.8, 1.4, furDk),
      // the long hunched body
      ball(36, 50, 15, 9, fur), ball(42, 47, 7, 6, furLt), ball(34, 55, 10, 4, furDk),
      ...[[26, 45], [31, 43.5], [37, 43], [43, 43.5], [48, 45.5], [29, 48], [35, 47.5], [41, 48], [46, 50]].map(([x, y]) => hair(x, y, x + 2, y + 1, furDk)),
      // the near legs and pink paws
      limb(30, 56, 29, 61.5, 2, 1.6, fur), limb(46, 55, 47.5, 61.5, 2.2, 1.8, fur),
      ball(28.6, 62, 2.6, 1.2, pink), ball(48, 62, 2.6, 1.2, pink), specks([[26.5, 62.5], [28, 62.75], [46, 62.75], [47.5, 62.75]], '#f0e8dc'),
      // the head: ears up, the snout long, the eye beady
      ball(20, 41, 3.4, 4, fur), ball(25, 40.6, 3.2, 3.8, fur), ball(20, 41.4, 1.8, 2.4, pink), ball(25, 41, 1.6, 2.2, pink),
      ball(18, 48, 8.4, 6.6, fur), limb(14, 48, 5, 51, 4, 2, fur), ball(4.6, 51.2, 2, 1.6, furLt), ball(3.4, 51, 1.1, 1, pinkDk),
      dots([[15, 46]], '#e02020'), specks([[15, 45.5]], '#ffb0b0'),
      hair(6, 50, 0.5, 47.5, '#e0d4c0'), hair(6, 51.25, 0.25, 51.5, '#e0d4c0'), hair(6, 52, 0.75, 54.5, '#e0d4c0'),
      sheet([[4, 53], [9, 53], [8, 54.6], [5, 54.6]], '#2a1814'), dots([[6, 54]], '#f2ead2')]),
    ];
  },

  // A cave bat as it comes at you, wings spread wide: thin leathery membrane
  // stretched over long finger bones, a furred body, ears like knife-points,
  // a pug face, and a mouthful of needle teeth.
  bat: (pose = 'idle') => {
    const atk = pose === 'windup';
    const wing = '#4a3c5c', wingLt = '#6a5a7e', bone = '#2e2440', body = '#5a4c70', bodyDk = '#3a2e4a', fang = '#f2eee0';
    const half = turn([
      // the wing: membrane scalloped between the finger bones
      sheet([[28, 24], [14, 14], [2, 12], [6, 19], [2, 25], [9, 26], [5, 34], [13, 32], [19, 37], [28, 32]], wing, { tilt: [-0.35, -0.1] }),
      sheet([[28, 25], [16, 17], [10, 22], [18, 28], [28, 30]], wingLt, { tilt: [-0.3, -0.1] }),
      limb(28, 24, 14, 14, 0.8, 0.6, bone), limb(14, 14, 2, 12, 0.6, 0.3, bone), limb(14, 14, 2, 25, 0.5, 0.3, bone),
      limb(14, 14, 5, 34, 0.5, 0.3, bone), limb(14, 14, 19, 37, 0.5, 0.3, bone),
      ball(14, 14, 1, 1, bone), specks([[13, 12.5], [12.5, 13]], '#c8c0d4'),
    ], 28, 24, atk ? 30 : pose === 'stepA' ? -24 : pose === 'stepB' ? 16 : 0);
    return [
      ...half, ...half.map(m64),
      // the body, furred, and the little hind claws
      ball(32, 28, 5.4, 7.6, body), ...[[30, 24], [33, 26], [31, 30], [34, 31]].map(([x, y]) => hair(x, y, x + 0.75, y + 1.5, bodyDk)),
      ...(atk ? [...both64(limb(30, 34, 26.6, 39.4, 0.6, 0.4, bone)), ...both64(specks([[25.6, 40.2], [26.8, 40.6]], '#c8c0d4'))] : [...both64(limb(30, 34, 29, 38, 0.6, 0.4, bone))]),
      // the head: tall ears, a pug snout, needle teeth, eyes bright in the dark
      ...both64(sheet([[28.5, 18], [26.5, 8], [31, 16]], body, { tilt: [-0.3, -0.3] })), ...both64(sheet([[28.8, 16.5], [27.6, 10.5], [30.2, 15.4]], '#8a6a8a')),
      ball(32, 19.6, 5, 4.4, '#5a4c70'), ball(32, 21.6, 2.4, 1.6, '#7a6a88'),
      dots([[30, 21], [34, 21]], '#1a1018'),
      ball(29.4, 18.6, 1.1, 1, '#ff5040', { glows: true }), ball(34.6, 18.6, 1.1, 1, '#ff5040', { glows: true }),
      ...(atk ? [sheet([[29, 22.6], [35, 22.6], [34.2, 27.6], [29.8, 27.6]], '#2a1018'), ball(32, 26.6, 1.6, 0.8, '#b04a5a'), sheet([[29.8, 22.8], [30.9, 22.8], [30.3, 25.6]], fang), sheet([[33.1, 22.8], [34.2, 22.8], [33.7, 25.6]], fang), sheet([[30.6, 27.6], [31.4, 27.6], [31, 25.8]], fang), sheet([[32.6, 27.6], [33.4, 27.6], [33, 25.8]], fang)] : [sheet([[29.6, 23], [34.4, 23], [33.6, 25], [30.4, 25]], '#2a1018'),
      sheet([[30.2, 23], [31, 23], [30.6, 24.8]], fang), sheet([[33, 23], [33.8, 23], [33.4, 24.8]], fang)]),
    ];
  },

  // A green slime: a wobbling mound of ooze, glossy and half-clear, a brighter
  // core inside it, bones and a coin caught in it, bubbles rising, a face of
  // sorts pressed against its skin, and a trail where it has crept.
  slime: (pose = 'idle') => {
    const atk = pose === 'windup';
    const ooze = '#5aa048', oozeDk = '#3a7030', oozeLt = '#8ad070', core = '#b8f08a', bone = '#d8d0b8';
    return [
      // the trail behind it, and the mound
      ball(32, 61.6, 22, 2, oozeDk),
      ...(atk ? [...grow([sheet([[10, 62], [12, 52], [17, 42], [24, 35], [32, 32], [40, 35], [47, 42], [52, 52], [54, 62]], ooze, { curve: 1 }),
      ball(32, 50, 15, 11, oozeDk), ball(32, 47, 12, 9, ooze),
      ball(33, 49, 7, 5.6, core, { glows: true }),
      ball(22, 54, 3, 2.6, bone), dots([[21, 54], [23, 54]], '#3a4a2a'), limb(38, 56, 46, 52, 0.8, 0.8, bone), ball(41, 45, 1.4, 0.8, '#c9a24a'),
      ...[[26, 44, 1.2], [30, 40, 0.8], [38, 42, 1], [44, 50, 0.9], [20, 48, 0.7], [35, 55, 0.8]].map(([x, y, r]) => ball(x, y, r, r, oozeLt)),
      ball(25, 38, 4, 2, '#c8f0a8'), hair(22, 38, 27, 36, '#f0fff0'),
      specks([[20, 41], [44, 39], [47, 47], [16, 52], [27, 35.5], [38, 34.5]], '#d8ffc8'), hair(42, 37, 46, 41, '#c8f0a8'),
      specks([[24, 58], [30, 59], [40, 58.5], [45, 57], [19, 56]], '#2a4a20'), specks([[26, 50], [43, 54]], '#8a3a2a'),
      ball(28, 46, 1.6, 2, '#1e3a18'), ball(36, 46, 1.6, 2, '#1e3a18'), dots([[28, 45], [36, 45]], '#e8f8c0'),
      ball(32, 52.4, 5.6, 4.4, '#1e3a18'), ball(32, 55.2, 3.2, 1.2, '#4a1a14'),
      hair(25.5, 42, 29.5, 44.4, '#2e5a24'), hair(38.5, 42, 34.5, 44.4, '#2e5a24'),
...[[13, 55], [51, 54], [17, 47]].map(([x, y]) => limb(x, y, x + (x < 32 ? -0.5 : 0.5), y + 4, 1, 0.6, ooze))], 32, 62, 0.8, 1.42)] : [sheet([[10, 62], [12, 52], [17, 42], [24, 35], [32, 32], [40, 35], [47, 42], [52, 52], [54, 62]], ooze, { curve: 1 }),
      ball(32, 50, 15, 11, oozeDk), ball(32, 47, 12, 9, ooze),
      ball(33, 49, 7, 5.6, core, { glows: true }),
      // what it has swallowed: a skull, a bone, a coin
      ball(22, 54, 3, 2.6, bone), dots([[21, 54], [23, 54]], '#3a4a2a'), limb(38, 56, 46, 52, 0.8, 0.8, bone), ball(41, 45, 1.4, 0.8, '#c9a24a'),
      // bubbles rising inside, and the glint on its skin
      ...[[26, 44, 1.2], [30, 40, 0.8], [38, 42, 1], [44, 50, 0.9], [20, 48, 0.7], [35, 55, 0.8]].map(([x, y, r]) => ball(x, y, r, r, oozeLt)),
      ball(25, 38, 4, 2, '#c8f0a8'), hair(22, 38, 27, 36, '#f0fff0'),
      specks([[20, 41], [44, 39], [47, 47], [16, 52], [27, 35.5], [38, 34.5]], '#d8ffc8'), hair(42, 37, 46, 41, '#c8f0a8'),
      // grit and old blood clouding its lower part
      specks([[24, 58], [30, 59], [40, 58.5], [45, 57], [19, 56]], '#2a4a20'), specks([[26, 50], [43, 54]], '#8a3a2a'),
      // a face pressed against the skin: dark eyes, a gaping mouth
      ball(28, 46, 1.6, 2, '#1e3a18'), ball(36, 46, 1.6, 2, '#1e3a18'), dots([[28, 45], [36, 45]], '#e8f8c0'),
      ball(32, 52, 3.2, 2, '#1e3a18'),
      hair(25.5, 43, 29.5, 43.5, '#2e5a24'), hair(38.5, 43, 34.5, 43.5, '#2e5a24'),
      // drips off its sides
      ...[[13, 55], [51, 54], [17, 47]].map(([x, y]) => limb(x, y, x + (x < 32 ? -0.5 : 0.5), y + 4, 1, 0.6, ooze))]),
    ];
  },

  // One of the drowned, risen from the black water: sunk to the shins in it,
  // swollen and grey-blue, what is left of a shirt clinging to it, both arms
  // out and reaching, hair plastered down a bloated face, the eyes gone to
  // dark hollows and the jaw hanging slack, weed hanging off it everywhere.
  drowned: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#8a9ea4', skinDk = '#5e7078', skinLt = '#a8bcc0', rag = '#3e4a44', ragDk = '#28322e', locks = '#1a2024', weed = '#3e5a2e', weedLt = '#5a7a3e';
    return [
      // legs sunk in the water, ripples round them
      limb(26, 44, 22.5, 59, 3.2, 2.8, skinDk), limb(38, 44, 41.5, 59, 3.2, 2.8, skinDk), hair(24, 50, 23.5, 56, '#4a5a60'), hair(40, 50, 40.5, 56, '#4a5a60'),
      ball(32, 60.6, 18, 3, '#1e2a34'), ball(32, 60.4, 13, 1.8, '#4e6878'),
      hair(16, 60.5, 22, 60, '#8aa8b8'), hair(42, 60, 48, 60.5, '#8aa8b8'), hair(28, 61.5, 36, 61.5, '#6a8898'),
      // the swollen body in a torn shirt, the belly showing through a rent
      ball(32, 36, 13, 12.6, skin), ball(29, 32, 6, 5, skinLt),
      sheet([[19, 27], [45, 27], [46, 46], [41, 43], [38, 48], [34, 44], [30, 47.5], [25, 44], [22, 47], [18, 44]], rag, { curve: 1 }),
      sheet([[19, 27], [24, 27], [23, 45], [18, 44]], ragDk, { curve: 0.4 }),
      sheet([[30, 33], [36, 31], [37, 40], [31, 41]], skin, { curve: 1 }), hair(31, 36, 36, 35.5, skinDk),
      ...[[22, 31], [26, 38], [40, 33], [42, 40], [35, 44]].map(([x, y]) => hair(x, y, x + 0.75, y + 2.5, ragDk)),
      // both arms out and up, reaching, long swollen fingers
      ...(atk ? [...turn([limb(20, 29, 13, 23, 3.2, 2.8, skin), limb(13, 23, 8, 18, 2.8, 2.4, skin), ball(7, 17, 3, 2.6, skin),
      ...[[4, 13.5], [6, 12.5], [8.5, 13], [10.5, 14.5]].map(([x, y]) => limb(x + 1.5, y + 3, x, y, 0.7, 0.6, skinLt))], 20, 29, 30)] : [limb(20, 29, 13, 23, 3.2, 2.8, skin), limb(13, 23, 8, 18, 2.8, 2.4, skin), ball(7, 17, 3, 2.6, skin),
      ...[[4, 13.5], [6, 12.5], [8.5, 13], [10.5, 14.5]].map(([x, y]) => limb(x + 1.5, y + 3, x, y, 0.7, 0.6, skinLt))]),
      ...(atk ? [...turn([limb(44, 29, 51, 23, 3.2, 2.8, skin), limb(51, 23, 56, 18, 2.8, 2.4, skin), ball(57, 17, 3, 2.6, skin),
      ...[[60, 13.5], [58, 12.5], [55.5, 13], [53.5, 14.5]].map(([x, y]) => limb(x - 1.5, y + 3, x, y, 0.7, 0.6, skinLt))], 44, 29, -30)] : [limb(44, 29, 51, 23, 3.2, 2.8, skin), limb(51, 23, 56, 18, 2.8, 2.4, skin), ball(57, 17, 3, 2.6, skin),
      ...[[60, 13.5], [58, 12.5], [55.5, 13], [53.5, 14.5]].map(([x, y]) => limb(x - 1.5, y + 3, x, y, 0.7, 0.6, skinLt))]),
      hair(14, 24.5, 18, 28, skinDk), hair(50, 24.5, 46, 28, skinDk),
      // the neck, and the bloated head, pale and blotched
      limb(32, 22, 32, 27, 4, 4.4, skinDk),
      ball(32, 16, 9, 9.4, skin), ball(30, 19, 5.4, 4, skinLt), ball(36.5, 14, 2, 1.6, '#7a8e94'), ball(27, 21, 1.6, 1.2, '#7a8e94'),
      // hair plastered down it in wet strands, down past the jaw
      sheet([[22.5, 14], [24, 7], [32, 5], [40, 7], [41.5, 14], [38.5, 10.5], [32, 9], [25.5, 10.5]], locks, { curve: 0.8 }),
      limb(23.4, 11, 22, 27, 1.6, 0.8, locks), limb(40.6, 11, 42.5, 27, 1.6, 0.8, locks), limb(35, 9, 36.5, 20, 1.2, 0.5, locks), limb(27.5, 9.5, 26.5, 15, 1, 0.5, locks),
      ...[[24, 12], [40, 12], [30, 7], [36, 7.5]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.5 : 0.5), y + 6, '#2e363a')),
      // dark drowned hollows for eyes, a pale gleam in one, the jaw hanging open
      ball(28, 15.6, 2.4, 2, '#1e2428'), ball(36.4, 15.6, 2.1, 1.9, '#1e2428'), dots([[28, 16]], '#e8f0e8'), specks([[27.5, 15.25]], '#a8c0c0'),
      hair(26, 13, 30, 13.25, skinDk), hair(34.5, 13.25, 38.5, 13, skinDk),
      limb(32, 15.5, 32.4, 20, 0.9, 1.3, skin), ball(32.4, 20.2, 1.2, 0.8, skinDk),
      ...(atk ? [ball(32, 24.8, 3.8, 3.6, '#1a1418'), dots([[30.5, 22], [33.5, 22], [31, 27], [33, 27]], '#c8c4a8')] : [ball(32, 24, 3, 2.6, '#1a1418'), dots([[31, 22], [33, 22]], '#c8c4a8')]),
      // weed draped over the shoulders and trailing from the arms
      limb(20, 27, 21, 40, 1.4, 0.8, weed), limb(21, 40, 19.5, 45, 0.8, 0.5, weed), limb(44, 26, 47, 36, 1.2, 0.7, weed),
      ...(atk ? [...turn([limb(10, 20, 9, 28, 1, 0.5, weed)], 20, 29, 30), ...turn([limb(54, 20, 55.5, 26, 0.9, 0.5, weed)], 44, 29, -30)] : [limb(10, 20, 9, 28, 1, 0.5, weed), limb(54, 20, 55.5, 26, 0.9, 0.5, weed)]), limb(33, 8, 31, 4, 0.8, 0.5, weedLt),
      ...(atk ? [[20.5, 31], [21, 36], [45, 30], [24, 40]] : [[20.5, 31], [21, 36], [45, 30], [9.5, 24]]).map(([x, y]) => hair(x, y, x + 1.5, y + 1, weedLt)),
      // water running off it, the grain of the drowned skin
      ...(atk ? [...turn([specks([[7, 21], [8, 24], [6, 15]], '#b8d0dc')], 20, 29, 30), ...turn([specks([[57, 21], [56, 24.5]], '#b8d0dc')], 44, 29, -30), specks([[24, 48], [40, 49], [32, 50]], '#b8d0dc')] : [specks([[7, 21], [8, 24], [57, 21], [56, 24.5], [24, 48], [40, 49], [32, 50], [6, 15]], '#b8d0dc')]),
      specks([[27, 30], [37, 34], [33, 18], [30, 12.5]], '#6e8288'),
    ];
  },

  // A kobold trapper: a small upright lizard in rust-red scales, a paler
  // belly, stubby horns swept back and a frill of spines, a coil of trap-wire
  // over its shoulder and a scrap of leather at its hips; a dart held up,
  // thrown hard (its windup) with the tail lashed up for balance.
  kobold: (pose = 'idle') => {
    const scale = '#a8502e', scaleDk = '#6e3018', scaleLt = '#c8704a', belly = '#d89a62', horn = '#e8dcc0', leather = '#5a3a24', wire = '#b8c0c8';
    const t = pose === 'windup';
    return [
      // the tail, curling out behind (lashed up as it throws)
      limb(37, 44, 48, t ? 40 : 52, 3, 1.8, scaleDk), limb(48, t ? 40 : 52, 56, t ? 30 : 46, 1.8, 0.8, scaleDk),
      ...[[44, t ? 42.5 : 48], [50, t ? 37 : 50]].map(([x, y]) => hair(x - 1, y - 1.5, x + 1, y - 1.5, scale)),
      // legs bent like a lizard's, the knees forward, clawed feet
      ...both64(limb(27.5, 44, 23, 52, 3, 2.6, scale)), ...both64(ball(23, 52, 2.6, 2.4, scaleDk)),
      ...both64(limb(23, 52, 26, 60, 2.4, 2, scale)), ...both64(ball(25.2, 61.4, 3.6, 1.6, scaleDk)),
      ...both64(specks([[21.5, 62.5], [23, 62.75], [24.5, 62.75]], horn)),
      // the body, the paler belly scaled in bands, the scrap of leather at the hips
      ball(32, 37, 9, 10, scale), ball(32, 39, 5.4, 7.6, belly),
      ...[34, 37, 40, 43].map(y => hair(28, y, 36, y, '#b87a4a')),
      sheet([[23, 44], [41, 44], [40, 50], [32, 48.5], [24, 50]], leather, { curve: 1 }),
      // the coil of wire over its shoulder and across the chest
      ball(23, 29, 4.6, 4.6, wire), ball(23, 29, 3, 3, '#3a3a40'), limb(25, 32, 39, 42, 0.5, 0.5, wire),
      // the arms: one swung out for balance, one up with the dart (higher as it throws)
      ...(t ? [
        limb(23, 31, 13, 29, 2.4, 2, scale), ball(12, 28.6, 2.2, 2, scaleDk),
        limb(41, 31, 46, 21, 2.4, 2, scale), limb(46, 21, 47, 12, 2, 1.8, scale), ball(47.4, 10.6, 2.2, 2, scaleDk),
        limb(47.6, 10, 51, 2, 0.6, 0.45, '#c8ced8'), sheet([[50.4, 1.2], [52.6, 0.6], [51.6, 3]], '#e04a30'),
      ] : [
        limb(23, 31, 18, 42, 2.4, 2, scale), ball(17.6, 43.6, 2.2, 2, scaleDk),
        limb(41, 31, 46, 25, 2.4, 2, scale), ball(47.4, 24, 2.2, 2, scaleDk),
        limb(47.6, 23.4, 51, 15.6, 0.6, 0.45, '#c8ced8'), sheet([[50.4, 14.8], [52.6, 14.2], [51.6, 16.6]], '#e04a30'),
      ]),
      // the head: a long snout, stubby horns swept back, a frill of spines behind
      ...[[-50, 6], [-70, 7.5], [-90, 8], [-110, 7.5], [-130, 6]].map(([a, h]) => {
        const r = a * Math.PI / 180, bx = 32 + Math.cos(r) * 7, by = 20 + Math.sin(r) * 6.4;
        return sheet([[bx - 1.6, by + 1], [bx + Math.cos(r) * h * 0.5, by + Math.sin(r) * h * 0.5], [bx + 1.6, by + 1]], '#8a3a20');
      }),
      ...both64(limb(27, 15, 21, 9.5, 1.6, 0.7, horn)), ...both64(hair(26, 14, 22, 10, '#b8a888')),
      ball(32, 20, 7.4, 6.6, scale),
      limb(32, 22.5, 32, 29.5, 4, 2.4, scale), ball(32, 29.6, 2.8, 1.8, scaleDk), dots([[31, 30], [33, 30]], '#1a0808'),
      ...[[29.2, 26], [34.8, 26], [29.8, 28], [34.2, 28]].map(([x, y]) => sheet([[x - 0.5, y], [x + 0.5, y], [x, y + 1.2]], '#f2ead2')),
      hair(28.5, 24, 35.5, 24, scaleDk),
      // eyes bright and slitted
      ball(28, 19, 1.6, 1.2, '#d8b830'), ball(36, 19, 1.6, 1.2, '#d8b830'),
      limb(28, 18.2, 28, 19.8, 0.35, 0.35, '#1a0808'), limb(36, 18.2, 36, 19.8, 0.35, 0.35, '#1a0808'),
      limb(25.6, 17.4, 30, 17.8, 0.8, 0.6, scaleDk), limb(38.4, 17.4, 34, 17.8, 0.8, 0.6, scaleDk),
      // scales picked out down the back and arms
      specks([[26, 33], [38, 33], [24, 38], [40, 38], [29, 16], [35, 16]], scaleDk), specks([[27, 21.5], [37, 21.5]], scaleLt),
    ];
  },

  // The Heartforged: an iron giant the old smiths built to keep the Heart.
  // Plate over plate, rivets in rows, seams that glow with the fire inside, a
  // furnace burning behind a grille in its chest, a helm with a slit of fire
  // for eyes, a broken chain still shackled to its left fist, and its hammer:
  // at its side, or swung up and back over its head to come down.
  heartforged: (pose = 'idle') => {
    const up = pose === 'windup';
    const iron = '#3a3c46', iron2 = '#545a68', ironLt = '#7a8290', dark = '#1e1f26', rivet = '#9aa0ac', wood = '#5a3a22';
    const seam = up ? '#ffb040' : '#d8601c', fire = up ? '#fff4c0' : '#ffa030', fire2 = up ? '#ffd060' : '#e0501c', glow = up ? '#ffffff' : '#ffd060';
    const G = { glows: true };
    const hammer = up ? [
      limb(52, 9, 18, 4, 1.3, 1.3, wood), ...[22, 30, 38].map(x => hair(x, 4.75 + (x - 18) * 0.15, x + 1.5, 4.9 + (x - 18) * 0.15, '#3a2414')),
      sheet([[2, 0], [18, 0], [18, 11], [2, 11]], dark), sheet([[3, 0.6], [17, 0.6], [17, 3.6], [3, 3.6]], iron2),
      line(3, 10.4, 17, 10.4, fire2, G), hair(4, 1.5, 16, 1.5, ironLt), ...[6, 10, 14].map(x => ball(x, 6.5, 0.8, 0.8, rivet)),
    ] : [
      limb(54.5, 45, 54.5, 56, 1.3, 1.3, wood),
      sheet([[45, 48], [63, 48], [63, 61], [45, 61]], dark), sheet([[46, 48.6], [62, 48.6], [62, 51.6], [46, 51.6]], iron2),
      line(46, 60.4, 62, 60.4, seam, G), hair(47, 49.5, 61, 49.5, ironLt), ...[49, 54, 59].map(x => ball(x, 55, 0.8, 0.8, rivet)),
    ];
    return [
      // legs like pillars, plated at the knee, and great square feet
      ...both64(limb(24, 44, 22.5, 58, 5.6, 5.2, iron)), ...both64(ball(23, 50, 5, 3.4, iron2)),
      ...both64(line(19, 50.5, 27, 50.5, seam, G)), ...both64(hair(19.5, 48.5, 26, 48, ironLt)),
      ...both64(sheet([[15, 57], [29.5, 57], [30, 63], [14.5, 63]], dark)), ...both64(hair(15.5, 57.5, 29, 57.5, iron2)),
      // the body: a barrel of plate, darker at the flanks
      sheet([[13, 21], [51, 21], [53, 46], [11, 46]], iron, { curve: 0.6 }),
      sheet([[15, 23], [25, 23], [23.5, 44], [13.5, 44]], iron2, { curve: 0.4 }),
      ...[[13.5, 30.5, 50.5, 30.5], [12.5, 39, 51.5, 39]].map(([a, b, c, d]) => line(a, b, c, d, dark)),
      line(12, 45.4, 52, 45.4, seam, G), line(14, 21.6, 50, 21.6, seam, G),
      ...[16, 20, 44, 48].flatMap(x => [ball(x, 24, 0.8, 0.8, rivet), ball(x, 33, 0.8, 0.8, rivet), ball(x, 42, 0.8, 0.8, rivet)]),
      // the furnace in its chest: a dark mouth, fire banked inside, the grille's bars over it
      sheet([[23, 27], [41, 27], [40, 41], [24, 41]], '#140806'),
      ball(32, 34.5, 7.6, 6, fire2, G), ball(32, 35, 5, 3.8, fire, G), ball(31, 34, 2, 1.6, glow, G),
      ...[26, 30, 34, 38].map(x => limb(x, 27, x, 41, 0.75, 0.75, dark)), limb(23, 34.2, 41, 34.2, 0.75, 0.75, dark),
      sheet([[22, 26], [42, 26], [42, 27.5], [22, 27.5]], iron2), sheet([[23, 40.5], [41, 40.5], [41, 42], [23, 42]], iron2),
      // shoulders like anvils
      ...both64(ball(12.5, 24, 7.6, 5.6, iron2)), ...both64(hair(7, 21, 17, 19.5, ironLt)), ...both64(ball(12.5, 24, 0.9, 0.9, rivet)),
      // the left arm hangs, the fist huge, a broken chain shackled to it
      limb(10.5, 28, 8.5, 44, 4.4, 4, iron), ball(8.5, 36, 4, 2.6, iron2),
      ball(8.5, 47, 5.2, 4.8, iron2), hair(5, 45, 12, 45, ironLt), line(4, 43, 13, 43, dark),
      ...[[7.6, 52.4], [6.6, 55.4], [6, 58.4], [6.4, 61.4]].map(([x, y], i) => ball(x, y, i % 2 ? 1 : 1.4, i % 2 ? 1.4 : 1, '#5a5e68')),
      // the right arm and the hammer: down at its side, or swung up and back over its head
      ...(up ? [
        limb(52, 26, 53, 12, 4.4, 4, iron), ball(53, 9.4, 4.8, 4.4, iron2), hair(50, 7.5, 56, 7.5, ironLt),
      ] : [
        limb(52, 28, 55, 44, 4.4, 4, iron), ball(54.5, 36, 4, 2.6, iron2),
        ball(55, 46.5, 5.2, 4.8, iron2), hair(51.5, 44.5, 58.5, 44.5, ironLt),
      ]),
      ...hammer,
      // smoke curling up off the helm
      ball(36, 5.4, 2.6, 2, '#4a464c'), ball(38.6, 2.8, 2, 1.6, '#58545a'), ball(36.4, 0.8, 1.4, 1, '#64606a'),
      // the helm: squat, crested, a slit of fire for eyes, a grate for a mouth
      sheet([[22.5, 9], [41.5, 9], [42.5, 21.6], [21.5, 21.6]], iron, { curve: 0.5 }),
      sheet([[23.5, 9.5], [29.5, 9.5], [28.8, 21], [22.8, 21]], iron2, { curve: 0.3 }),
      sheet([[30.5, 6.5], [33.5, 6.5], [33.5, 10], [30.5, 10]], iron2),
      sheet([[24.8, 13.4], [39.2, 13.4], [39.2, 16.2], [24.8, 16.2]], '#140806'),
      line(25.6, 14.8, 38.4, 14.8, glow, G),
      ...[28, 31, 34, 37].map(x => line(x, 18, x, 20.6, dark)),
      ...[[23.5, 10.5], [40.5, 10.5], [23.5, 20.5], [40.5, 20.5]].map(([x, y]) => ball(x, y, 0.7, 0.7, rivet)),
      // scars across the plates, soot down from the seams
      hair(16, 27, 22, 32, '#5e6470'), hair(44, 25.5, 49, 28.5, '#5e6470'), hair(45, 36, 49, 34, '#5e6470'),
      hair(19.5, 46, 19, 51, '#121318'), hair(44.5, 46, 45.5, 51.5, '#121318'),
    ];
  },
  // An emberling: a crawling lump of cooling rock the size of a hound, crusted
  // and craggy, the fire inside it showing through every crack, flames
  // licking up off its back. Winding up it squats and blazes white-hot.
  emberling: (pose = 'idle') => {
    const hot = pose === 'windup';
    const crust = '#2e2624', crust2 = '#3e3430', crust3 = '#4e423c', glow = hot ? '#fff0b0' : '#f08a30', glow2 = hot ? '#ffd060' : '#c8501c', flame = hot ? '#ffe070' : '#ff9a30', flame2 = hot ? '#fff4c0' : '#ffd060';
    const dy = hot ? 2.4 : 0, sx = hot ? 1.06 : 1;
    const cx = 32, cy = 46 + dy;
    const g = { glows: true };
    // a tongue of flame: a wavering spike that leans as it climbs
    const tongue = (x, y, h, w, lean, c) => sheet([[x - w, y], [x - w * 0.6 + lean * 0.3, y - h * 0.4], [x - w * 0.2 + lean * 0.8, y - h * 0.7], [x + lean, y - h], [x + w * 0.3 + lean * 0.5, y - h * 0.62], [x + w * 0.7 + lean * 0.1, y - h * 0.32], [x + w, y]], c, { curve: 0.6, glows: true });
    return [
      // stubby legs of rock, the far pair behind
      limb(20, 53, 18.5, 60, 3.4, 3, crust), limb(44, 53, 45.5, 60, 3.4, 3, crust),
      ball(18.6, 60.5, 4, 2, crust2), ball(45.4, 60.5, 4, 2, crust2),
      // the body: a lumpy boulder, wider than tall, crags on its back
      ball(cx, cy, 16 * sx, 12.4, crust), ball(cx - 8, cy - 7.2, 7.2, 6, crust2), ball(cx + 8.4, cy - 6.4, 6.8, 5.6, crust2),
      ball(cx, cy + 3.2, 8.8, 6.4, crust2), ball(cx - 10, cy - 9, 3, 2, crust3), ball(cx + 7, cy - 10, 3.4, 2, crust3), ball(cx + 13, cy - 2, 2.4, 3, crust3),
      // the near pair of legs, clawed with stone
      limb(25, 55, 24.4, 60.4, 3.2, 2.8, crust2), limb(39, 55, 39.6, 60.4, 3.2, 2.8, crust2),
      ball(24.4, 61, 3.8, 1.8, crust), ball(39.6, 61, 3.8, 1.8, crust),
      specks([[21, 62], [23, 62.5], [25.5, 62.5], [38.5, 62.5], [41, 62.5], [43, 62]], '#5a4e46'),
      // the grain of the crust: pits, ash and ridges
      ...[[cx - 13, cy + 7], [cx + 12, cy + 8], [cx - 6, cy - 12], [cx + 4, cy - 12.5], [cx + 15, cy + 2], [cx - 15, cy + 1]].map(([x, y]) => hair(x, y, x + 2, y + 0.5, '#1a1412')),
      specks([[cx - 9, cy - 4], [cx + 10, cy - 5], [cx - 3, cy + 10], [cx + 8, cy + 9], [cx - 11, cy + 9]], '#6a5a50'),
      // the cracks, glowing: a web across the crust, the fire bright inside
      line(cx - 12, cy - 2, cx - 4, cy + 4, glow, g), line(cx - 4, cy + 4, cx + 2, cy - 2, glow, g), line(cx + 2, cy - 2, cx + 12, cy + 3, glow, g),
      line(cx - 6, cy - 9, cx - 2, cy - 4, glow2, g), line(cx + 6, cy - 8, cx + 9, cy - 3, glow2, g), line(cx - 2, cy + 7, cx + 4, cy + 10, glow2, g),
      line(cx - 12, cy - 2, cx - 14, cy + 4, glow2, g), line(cx + 12, cy + 3, cx + 14, cy - 3, glow2, g), line(cx - 2, cy - 4, cx + 2, cy - 2, glow2, g),
      line(cx - 8, cy + 1, cx - 9, cy + 7, glow2, g), line(cx + 7, cy + 1, cx + 8, cy + 6, glow2, g),
      ...[[cx - 4, cy + 4], [cx + 2, cy - 2], [cx - 12, cy - 2], [cx + 12, cy + 3]].map(([x, y]) => ball(x, y, 1.2, 1, flame2, g)),
      // two ember eyes low on the front, under a jut of brow
      ball(cx - 5, cy + 6.4, 2.8, 2.2, '#141010'), ball(cx + 5, cy + 6.4, 2.8, 2.2, '#141010'),
      ball(cx - 5, cy + 6.6, 1.6, 1.2, hot ? '#ffffff' : '#ffd060', g), ball(cx + 5, cy + 6.6, 1.6, 1.2, hot ? '#ffffff' : '#ffd060', g),
      limb(cx - 8.5, cy + 4, cx - 2, cy + 4.6, 1.4, 1, crust3), limb(cx + 8.5, cy + 4, cx + 2, cy + 4.6, 1.4, 1, crust3),
      // flames licking up off its back, taller when it blazes
      tongue(cx - 9, cy - 9, hot ? 18 : 11, 3.4, -2, flame), tongue(cx + 0.5, cy - 11, hot ? 21 : 14, 4, 1.5, flame), tongue(cx + 9, cy - 9.6, hot ? 16 : 10, 3, 2.5, flame),
      tongue(cx - 4.5, cy - 10.4, hot ? 12 : 7, 2, -1, flame), tongue(cx + 5, cy - 10.6, hot ? 13 : 8, 2, 1, flame),
      tongue(cx + 0.5, cy - 11, hot ? 13 : 8, 2, 1, flame2), tongue(cx - 9, cy - 9, hot ? 10 : 6, 1.6, -1, flame2), tongue(cx + 9, cy - 9.6, hot ? 9 : 5.5, 1.4, 1.5, flame2),
      specks(hot ? [[cx - 6, cy - 27], [cx + 5, cy - 30], [cx - 13, cy - 23], [cx + 13, cy - 24], [cx + 1, cy - 35]] : [[cx - 6, cy - 20], [cx + 5, cy - 23], [cx - 13, cy - 17], [cx + 13, cy - 17], [cx + 2, cy - 28]], flame2, g),
    ];
  },
  // A mimic, given away at last: the barrel it pretended to be, staves and
  // iron hoops, the lid hinged back to show a wet throat, gums and uneven teeth
  // like broken staves, a long tongue lolling over the rim and down the front,
  // and two eyes on stalks where knots in the wood were. Winding up, it gapes.
  mimic: (pose = 'idle') => {
    const wood = '#7a5230', dark = '#4e3320', light = '#9a6c40', iron = '#3e4048', ironLt = '#6a6e78', gum = '#8a2a3a', tooth = '#f2ead2', tongue = '#c04a5a';
    const open = pose === 'windup' ? 14 : 8;       // how far the lid stands off the body
    const lidY = 30 - open;
    return [
      // the body, staves and hoops as the barrel it pretends to be
      sheet([[17, 32], [47, 32], [49, 46], [46, 62], [18, 62], [15, 46]], wood, { curve: 1 }),
      sheet([[17, 32], [22, 32], [21, 62], [18, 62], [15, 46]], dark, { curve: 0.6 }), sheet([[36, 32], [42, 32], [43, 62], [38, 62]], light, { curve: 0.6 }),
      ...[23, 29, 35, 41].map(x => line(x, 34, x + (x - 32) * 0.05, 61, dark)),
      limb(15.5, 42, 48.5, 42, 1.2, 1.2, iron), limb(16, 55, 48, 55, 1.2, 1.2, iron), hair(17, 41, 47, 41, ironLt), hair(17.5, 54, 46.5, 54, ironLt),
      ...[[18, 42], [46, 42], [18.5, 55], [45.5, 55]].map(([x, y]) => specks([[x, y]], '#a8acb4')),
      ...[[26, 37], [33, 48], [39, 59], [25, 50]].map(([x, y]) => hair(x, y, x + 0.5, y + 3, '#5e3e24')),
      ball(32, 62.6, 16, 1, '#2a1c10'),
      // the mouth: a dark throat and gums between body and lid
      sheet([[18, 31], [46, 31], [44, lidY + 4], [20, lidY + 4]], '#2a0e14'), ball(32, (31 + lidY + 4) / 2, 8, (31 - lidY - 4) / 3, '#4a1420'),
      ball(32, 32, 14, 2.8, gum), ball(32, lidY + 4, 13, 2.6, gum),
      // teeth down from the lid and up from the rim, uneven as broken staves
      ...[21, 25.5, 30, 34.5, 39, 43].map((x, i) => limb(x, lidY + 4.4, x + (i % 2 ? 0.6 : -0.4), lidY + 8.4 + (i % 2) * 2, 1.4, 0.4, tooth)),
      ...[23, 27.5, 32, 36.5, 41].map((x, i) => limb(x, 30.6, x + (i % 2 ? -0.4 : 0.6), 26.4 - (i % 2) * 2, 1.4, 0.4, tooth)),
      // the tongue, lolling out over the rim and down the front
      limb(30, 31, 27, 40, 3.2, 2.6, tongue), limb(27, 40, 28.4, 47, 2.6, 2, tongue), ball(28.4, 47.4, 2.2, 1.6, tongue),
      hair(29.2, 33, 27.8, 44, '#8a2a3a'), specks([[26, 36], [27, 43], [29, 49]], '#e0a0a8'),
      // the lid, tipped back on its hinge, hoop and all
      sheet([[17, lidY + 3], [47, lidY + 3], [45, lidY - 4], [19, lidY - 4]], wood, { curve: 1, tilt: [0, -0.6] }),
      limb(18, lidY, 46, lidY, 1, 1, iron), hair(19, lidY - 1, 45, lidY - 1, ironLt),
      ball(32, lidY - 4, 13, 3, light), ...[25, 32, 39].map(x => hair(x, lidY - 6, x, lidY - 2, dark)),
      // eyes on stalks, where two knots in the wood were
      limb(22, lidY - 2, 19, lidY - 10, 1.2, 1, dark), limb(42, lidY - 2, 45, lidY - 10, 1.2, 1, dark),
      ball(19, lidY - 11.6, 4, 3.8, '#e8e0b0'), ball(45, lidY - 11.6, 4, 3.8, '#e8e0b0'),
      ball(20, lidY - 11.2, 2.2, 2.2, '#c8281c'), ball(44, lidY - 11.2, 2.2, 2.2, '#c8281c'),
      dots([[20, lidY - 11], [44, lidY - 11]], '#1a0808'), specks([[18.5, lidY - 13], [43.5, lidY - 13]], '#fff8d8'),
      hair(16, lidY - 13, 18, lidY - 15, '#8a3a2a'), hair(42, lidY - 15, 44, lidY - 13, '#8a3a2a'),
      // drool strung between the teeth
      specks([[24, lidY + 10], [37, lidY + 11], [33, 28]], '#e8c8d0'),
    ];
  },

  // An eyeless stalker: gaunt and pale, crouched on long thin limbs, its
  // smooth head craned forward with no eyes at all, only a wide mouth of
  // needle teeth and slits where it breathes, and ears like a bat's. The
  // skin is stretched so tight the ribs and every knuckle show.
  eyeless: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#b4aab8', skinDk = '#7a7080', pale = '#d8d0dc', mouth = '#2a141c', vein = '#9a8aa8';
    return [
      // hind legs folded under it like a hare's, long-toed feet
      ...both64(limb(22, 40, 14, 50, 3.4, 2.6, skinDk)), ...both64(ball(14, 50, 2.6, 2.4, skinDk)), ...both64(limb(14, 50, 18, 60, 2.4, 1.8, skinDk)),
      ...both64(limb(18, 61, 23, 62.5, 1.6, 0.8, skinDk)), ...both64(specks([[24, 62.75], [22.5, 62.75]], '#e8e4d8')),
      // the long front arms planted wide, elbows high, clawed hands splayed
      limb(23, 29, 11, 38, 2.6, 2, skin), ball(11, 38, 2.2, 2, skinDk), limb(11, 38, 8, 59, 2, 1.5, skin),
      ...[[3.5, 62.5], [6, 63], [9, 63], [12, 62.5]].map(([x, y]) => limb(8, 59.5, x, y, 0.8, 0.4, skin)),
      limb(41, 29, 53, 38, 2.6, 2, skin), ball(53, 38, 2.2, 2, skinDk), limb(53, 38, 56, 59, 2, 1.5, skin),
      ...[[60.5, 62.5], [58, 63], [55, 63], [52, 62.5]].map(([x, y]) => limb(56, 59.5, x, y, 0.8, 0.4, skin)),
      specks([[3, 63], [5.5, 63], [61, 63], [58.5, 63]], '#f0ece0'),
      hair(14, 33, 11, 37, vein), hair(50, 33, 53, 37, vein), hair(9.5, 42, 8.5, 54, vein), hair(54.5, 42, 55.5, 54, vein),
      // a lean ribbed body, the spine ridged
      ball(32, 35, 10.5, 10, skin), ball(32, 39, 6.4, 5.6, pale),
      ...[30, 33, 36, 39].map(y => hair(25, y, 30, y + 0.75, skinDk)), ...[30, 33, 36, 39].map(y => hair(39, y, 34, y + 0.75, skinDk)),
      hair(32, 28, 32, 44, '#c4bac8'),
      // the long neck craned forward, and the smooth blind head, ears spread
      limb(32, 27, 32, 18, 4.4, 3.6, skin), hair(30, 26, 30.5, 19, skinDk), hair(34, 26, 33.5, 19, skinDk),
      ...(atk ? [...grow([sheet([[23, 11], [6, 1], [13, 9], [10, 12], [19, 17]], skinDk, { tilt: [-0.5, -0.3] }), sheet([[41, 11], [58, 1], [51, 9], [54, 12], [45, 17]], skinDk, { tilt: [0.5, -0.3] }),
      sheet([[22, 11.5], [11, 4.5], [19, 15]], '#a07888'), sheet([[42, 11.5], [53, 4.5], [45, 15]], '#a07888'),
      hair(20, 12, 13, 7, '#806070'), hair(44, 12, 51, 7, '#806070'),
      ball(32, 13.6, 10.4, 8, skin), ball(32, 9, 7, 2.4, '#c4bac8'), ball(29, 8.5, 3, 1.2, pale),
      sheet([[22, 16.4], [42, 16.4], [39, 27], [25, 27]], mouth, { curve: 0.6 }),
      ...[24.5, 26.6, 28.7, 30.8, 32.9, 35, 37.1, 39.2].map((x, i) => limb(x, 17.2, x + 0.3, 19.6 + (i % 2) * 0.6, 0.45, 0.15, '#f0ece0')),
      ...[25.8, 27.9, 30, 32.1, 34.2, 36.3, 38.2].map(x => limb(x, 26.8, x + 0.2, 24, 0.4, 0.15, '#e0dccc')),
      ball(32, 25.6, 3.6, 1, '#5a2a3a'),
      hair(25, 11, 28, 10, '#5a5060'), hair(25.5, 12.25, 28.5, 11.25, '#5a5060'), hair(36, 10, 39, 11, '#5a5060'), hair(35.5, 11.25, 38.5, 12.25, '#5a5060'),
      hair(32, 5.5, 31, 9, vein), hair(29, 14, 27, 16, vein), hair(35, 14, 37, 16, vein),
      specks([[32, 6], [28, 7], [36, 7], [30, 15], [34, 15]], '#ece6ee')], 32, 18, 1.08, 1.08)] : [sheet([[23, 11], [6, 1], [13, 9], [10, 12], [19, 17]], skinDk, { tilt: [-0.5, -0.3] }), sheet([[41, 11], [58, 1], [51, 9], [54, 12], [45, 17]], skinDk, { tilt: [0.5, -0.3] }),
      sheet([[22, 11.5], [11, 4.5], [19, 15]], '#a07888'), sheet([[42, 11.5], [53, 4.5], [45, 15]], '#a07888'),
      hair(20, 12, 13, 7, '#806070'), hair(44, 12, 51, 7, '#806070'),
      ball(32, 13.6, 10.4, 8, skin), ball(32, 9, 7, 2.4, '#c4bac8'), ball(29, 8.5, 3, 1.2, pale),
      // the mouth, wide and full of needles
      sheet([[23, 17], [41, 17], [38.5, 22.4], [25.5, 22.4]], mouth, { curve: 0.6 }),
      ...[24.5, 26.6, 28.7, 30.8, 32.9, 35, 37.1, 39.2].map((x, i) => limb(x, 17.2, x + 0.3, 19.6 + (i % 2) * 0.6, 0.45, 0.15, '#f0ece0')),
      ...[25.8, 27.9, 30, 32.1, 34.2, 36.3, 38.2].map(x => limb(x, 22.2, x + 0.2, 20, 0.4, 0.15, '#e0dccc')),
      ball(32, 21.6, 3, 0.8, '#5a2a3a'),
      // breathing slits where eyes would be, flared; the skin's veins
      hair(25, 11, 28, 10, '#5a5060'), hair(25.5, 12.25, 28.5, 11.25, '#5a5060'), hair(36, 10, 39, 11, '#5a5060'), hair(35.5, 11.25, 38.5, 12.25, '#5a5060'),
      hair(32, 5.5, 31, 9, vein), hair(29, 14, 27, 16, vein), hair(35, 14, 37, 16, vein),
      specks([[32, 6], [28, 7], [36, 7], [30, 15], [34, 15]], '#ece6ee')]),
    ];
  },

  // A puffcap: a squat fungus on rooted feet, its cap swollen fit to burst
  // with spores, pale scabs on the dome, the gills beneath dark and frilled,
  // two small black eyes low on the bowed stalk, and spores leaking off the rim.
  puffcap: (pose = 'idle') => {
    const atk = pose === 'windup';
    const cap = '#9a6a3a', capHi = '#b8844a', capDk = '#6e4626', gill = '#5a3a2a', stalk = '#d8ccb0', shade = '#aa9c80', root = '#6a5a40';
    return [
      // roots splayed on the stone, gripping it
      ...both64(limb(25, 55, 15, 61, 2.6, 1.4, root)), ...both64(limb(15, 61, 9, 62.5, 1.4, 0.6, root)), ...both64(limb(28, 58, 24, 63, 1.8, 1, root)),
      limb(32, 57, 33, 63, 2.2, 1.2, root), ...both64(hair(18, 59.5, 12, 61.5, '#4a3e2a')),
      // the stalk, thick and a little bowed, a ragged ring of skin round it
      ball(32, 47, 11, 12, stalk), ball(28.6, 45, 5, 8, '#e8dec6'), ball(38, 50, 3.6, 6.4, shade),
      sheet([[21.5, 39], [42.5, 39], [41, 42.5], [37, 41], [33, 43], [29, 41], [25, 43], [22.5, 41.5]], '#c8bca0', { curve: 0.6 }),
      hair(26, 46, 27, 56, '#bcae90'), hair(37, 43, 36, 55, '#bcae90'), hair(31, 49, 31.5, 57, '#bcae90'),
      // the gills under the cap, frilled
      ...(atk ? [...grow([ball(32, 31, 23, 5, gill), ...[10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54].map(x => hair(x, 29.5, x + (x - 32) * 0.08, 33.5 - Math.abs(x - 32) * 0.08, '#3e2618')),
      ball(32, 24, 24.5, 13, cap), ball(27, 19, 14, 7, capHi), ball(32, 32, 22, 2.4, capDk),
      ...[[20, 21, 3, 2.2], [34, 15.5, 3.4, 2.4], [45, 22, 2.6, 2], [28, 27, 2, 1.6], [39, 28, 1.8, 1.3], [14, 27, 1.6, 1.2], [26, 13, 1.8, 1.3]].map(([x, y, rx, ry]) => ball(x, y, rx, ry, '#efe4c4')),
      specks([[19, 20], [33, 14.5], [44, 21]], '#fffae8')], 32, 31, 1.12, 1.2)] : [ball(32, 31, 23, 5, gill), ...[10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54].map(x => hair(x, 29.5, x + (x - 32) * 0.08, 33.5 - Math.abs(x - 32) * 0.08, '#3e2618')),
      // the cap, wide and swollen, its rim curling under
      ball(32, 24, 24.5, 13, cap), ball(27, 19, 14, 7, capHi), ball(32, 32, 22, 2.4, capDk),
      // pale scabs on the dome, some flaking
      ...[[20, 21, 3, 2.2], [34, 15.5, 3.4, 2.4], [45, 22, 2.6, 2], [28, 27, 2, 1.6], [39, 28, 1.8, 1.3], [14, 27, 1.6, 1.2], [26, 13, 1.8, 1.3]].map(([x, y, rx, ry]) => ball(x, y, rx, ry, '#efe4c4')),
      specks([[19, 20], [33, 14.5], [44, 21]], '#fffae8')]),
      // the eyes low on the stalk, and a slit of a mouth
      ball(27, 44, 1.8, 2, '#140e0a'), ball(37, 44, 1.8, 2, '#140e0a'), dots([[26, 43], [36, 43]], '#fff4d8'),
      ...(atk ? [ball(32, 51.8, 3, 2.2, '#2a1e12'), ball(32, 52.8, 1.8, 0.8, '#5a3a24')] : [sheet([[29, 51], [35, 51], [34, 52.4], [30, 52.4]], '#5a4a30')]),
      // the spores leaking out of the rim
      specks([[8, 27], [6, 22], [56, 26], [59, 21], [12, 17], [53, 15], [32, 7], [22, 9], [42, 8], [4, 31], [60, 30], [16, 11], [48, 10]], '#e0dcb0'),
      ...(atk ? [specks([[10, 33], [55, 34], [7, 36], [3, 26], [61, 25], [9, 12], [55, 10], [28, 4], [37, 3], [5, 40], [59, 39]], '#c8c49a')] : [specks([[10, 33], [55, 34], [7, 36]], '#c8c49a')]),
    ];
  },

  // A goblin archer: a goblin in a hooded leather jerkin, a quiver of crude
  // arrows over one shoulder, the bow held out to one side with the string
  // drawn back to its cheek, squinting down the shaft.
  archer: (pose = 'idle') => {
    const atk = pose === 'windup', cast = pose === 'special';
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', hood = '#5a4a30', hoodDk = '#3a2e1c', jerkin = '#4a5a30', jerkinDk = '#323e20', wood = '#8a6030', string = '#d8d0b8';
    return [
      // the quiver over its back, arrows sticking up out of it
      sheet([[40, 26], [48, 22], [52, 42], [44, 46]], '#6a4a28', { tilt: [0.5, 0] }), hair(41, 28, 45, 44, '#4a3018'),
      ...[[46, 21], [48.5, 20.5], [51, 21.5]].map(([x, y]) => limb(x, y + 3, x + 0.5, y - 2, 0.4, 0.4, '#a08050')),
      ...[[46.5, 18.5], [49, 18], [51.5, 19]].map(([x, y]) => sheet([[x - 1, y + 1.5], [x, y - 1], [x + 1, y + 1.5]], '#d8d0c0')),
      // bandy legs and bare feet
      ...both64(limb(28, 46, 26, 53, 2, 1.7, skin)), ...both64(ball(26, 53, 1.9, 1.7, skinDk)),
      ...both64(limb(26, 53, 27, 60, 1.7, 1.5, skin)), ...both64(limb(27, 61, 22.5, 62, 1.6, 1.2, skinDk)),
      // the body in its jerkin, belted, a knife at the belt
      ball(32, 38, 7.4, 8.5, skin),
      sheet([[23, 32], [41, 32], [42.5, 48], [32, 47], [21.5, 48]], jerkin, { curve: 1 }),
      sheet([[23, 32], [27, 32], [26, 48], [21.5, 48]], jerkinDk, { curve: 0.3 }),
      line(22.5, 42, 41.5, 42, '#3a2a1a'), ball(32, 42, 1, 0.9, '#8a7a5a'),
      limb(37, 42.5, 39, 48, 0.6, 0.5, '#5a3a20'), limb(39, 48, 40.5, 52, 0.5, 0.3, '#b8bcc4'),
      ...[[27, 36], [36, 38], [30, 45]].map(([x, y]) => specks([[x, y]], '#2a3418')),
      // the bow out to the left, the string drawn back to the cheek, an arrow nocked
      ...(!atk && !cast ? [limb(13, 24, 9.4, 33, 0.9, 0.8, wood), limb(9.4, 33, 9.4, 44, 0.8, 0.8, wood), limb(9.4, 44, 13, 53, 0.8, 0.9, wood)] : [limb(9, 12, 6, 22, 0.9, 0.8, wood), limb(6, 22, 6, 34, 0.8, 0.8, wood), limb(6, 34, 9, 44, 0.8, 0.9, wood)]),
      ...(!atk && !cast ? [ball(9.4, 38.5, 1.3, 1.6, '#5a3a20')] : [ball(6, 28, 1.3, 1.6, '#5a3a20')]),
      ...(!atk && !cast ? [hair(13, 24, 13.4, 53, string)] : [hair(9, 12, 26, 26, string), hair(26, 26, 9, 44, string)]),
      ...(!atk && !cast ? [limb(42.6, 38, 41.4, 56, 0.45, 0.45, '#b89a60'), sheet([[41.2, 58.6], [40.2, 55.6], [42.6, 55.8]], '#c8ccd4')] : [limb(26, 26, 2.5, 26, 0.45, 0.45, '#b89a60'), sheet([[0.5, 26], [3.5, 24.6], [3.5, 27.4]], '#c8ccd4')]),
      ...(!atk && !cast ? [sheet([[41.6, 36.4], [44, 36.6], [43.6, 40], [41.6, 39.6]], '#a84030')] : [sheet([[23.5, 24.6], [27.5, 24], [27.5, 28], [23.5, 27.4]], '#a84030')]),
      // the arms: the bow arm straight out, the drawing hand back at the cheek
      ...(!atk && !cast ? [limb(24, 30, 17, 36, 2, 1.7, skin), limb(17, 36, 10.4, 38.4, 1.7, 1.5, skin), ball(10, 38.5, 1.9, 1.8, skin)] : [limb(24, 30, 15, 28.4, 2, 1.7, skin), limb(15, 28.4, 7.5, 28, 1.7, 1.5, skin), ball(7, 28, 1.9, 1.8, skin)]),
      ...(!atk && !cast ? [limb(40, 30, 42.6, 38, 2, 1.7, skin), limb(42.6, 38, 42.4, 44, 1.7, 1.5, skin), ball(42.4, 45, 1.9, 1.8, skin)] : [limb(40, 30, 33, 30, 2, 1.7, skin), limb(33, 30, 27.5, 26.4, 1.7, 1.5, skin), ball(26.6, 26, 1.9, 1.8, skin)]),
      // the head in its hood, the ears out through slits in it
      limb(32, 24, 32, 28.5, 2, 2.3, skinDk),
      sheet([[25.5, 17], [8, 11], [11, 15], [25.5, 21.5]], skin, { tilt: [-0.5, -0.2] }), sheet([[38.5, 17], [56, 11], [53, 15], [38.5, 21.5]], skin, { tilt: [0.5, -0.2] }),
      sheet([[24, 17.5], [13, 13.5], [24, 20]], '#b06e56'), sheet([[40, 17.5], [51, 13.5], [40, 20]], '#b06e56'),
      ball(32, 18, 7, 6.6, skin), ball(32, 22.4, 5, 2.6, skin),
      sheet([[23.5, 19], [24.5, 10], [32, 7], [39.5, 10], [40.5, 19], [37.5, 14.5], [32, 13], [26.5, 14.5]], hood, { curve: 0.8 }),
      hair(25, 12, 31, 8, '#7a6444'), sheet([[23.5, 19], [26.5, 14.5], [26, 21], [24, 22]], hoodDk, { curve: 0.4 }),
      // one eye screwed shut, the other narrowed down the shaft
      ...(!atk && !cast ? [ball(28.6, 17.6, 1.6, 1.1, '#2a4a1c'), dots([[28, 17], [29, 17]], '#ffe040'), dots([[29, 17]], '#1a1010')] : [hair(27.5, 17.5, 30, 17.25, '#1a1010')]), ball(35.4, 17.6, 1.6, 1.1, '#2a4a1c'), dots([[35, 17], [36, 17]], '#ffe040'), dots([[35, 17]], '#1a1010'),
      limb(32, 17, 32.6, 22, 0.9, 1.4, skin), ball(33, 22.2, 1.5, 1.1, skinLt),
      sheet([[28, 23.6], [32, 24.6], [36, 23.6], [35, 25.6], [29, 25.6]], '#2a1010'), dots([[30, 24], [34, 24]], '#e8dcb8'),
      // a fire arrow: rag wound behind the head, alight
      ...(cast ? [ball(4, 26, 1.8, 1.4, '#5a3a20'), sheet([[2, 26], [3.4, 20], [4.6, 23], [5.6, 19.4], [6.6, 26]], '#ff8a20', { curve: 0.6, glows: true }),
        sheet([[3, 26], [4.2, 22.6], [5.4, 26]], '#ffe070', { curve: 0.5, glows: true }), specks([[3, 18], [6, 16.5], [4.5, 15]], '#ffd060', { glows: true })] : []),
    ];
  },

  // A zombie: a dead man still walking, shambling with one arm out before
  // him. Grey-green skin gone loose on the bones, a torn shirt with the ribs
  // showing through the rent, ragged breeches and one shoe; the jaw hanging
  // slack and askew, one eye gone and the other filmed over.
  zombie: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#8fa27a', skinDk = '#5f6e4e', rot = '#4e5a3e', shirt = '#4e5a78', shirtDk = '#323c54', trouser = '#3e3a44', bone = '#cfc6aa';
    return [
      // the legs, one dragging, the breeches torn off at the shin, one shoe gone
      limb(28, 44, 25, 53, 2.8, 2.4, trouser), limb(25, 53, 24, 60, 2.2, 1.9, skin), ball(23.4, 61.6, 3, 1.4, rot),
      limb(36, 44, 40, 52, 2.8, 2.4, trouser), limb(40, 52, 39, 60, 2.4, 2.1, trouser), ball(39.6, 61.6, 3.4, 1.6, '#2a2018'),
      sheet([[22.5, 51.5], [27.5, 52.5], [26.5, 55], [24.5, 54], [22.5, 55]], trouser, { curve: 0.5 }),
      // the body, stooped forward, the torn shirt hanging off it
      ball(32, 34, 9, 10, skin),
      sheet([[22, 24], [42, 24], [43, 44], [40, 42], [38.5, 46.5], [35, 42.5], [31, 47], [28, 42.5], [24.5, 46], [21, 43]], shirt, { curve: 1 }),
      sheet([[22, 24], [26, 24], [25, 45], [21, 43]], shirtDk, { curve: 0.3 }),
      // the rent in the shirt, ribs showing through
      sheet([[31, 29], [36, 27.5], [40, 29.5], [39, 35], [40.5, 38], [35, 37.6], [32.5, 35]], '#2a2430'),
      ...[30, 32.2, 34.4].map(y => limb(33.5, y, 38.5, y - 0.5, 0.5, 0.45, bone)),
      // the left arm hanging limp, the right held out before it, reaching
      ...(atk ? [limb(22.5, 26, 14, 22.6, 2.4, 2, skin), limb(14, 22.6, 7.4, 19.6, 2, 1.8, skinDk), ball(5.8, 19, 2.2, 2, rot), ...[17.6, 19, 20.4].map(y => limb(4.2, y, 1.6, y - 1, 0.45, 0.4, skinDk))] : [limb(22.5, 26, 19, 37, 2.4, 2, skin), limb(19, 37, 18, 46, 2, 1.8, skinDk), ball(17.8, 47.6, 2.2, 2, rot),
      ...[16.4, 17.8, 19.2].map(x => limb(x, 48.6, x, 51, 0.45, 0.4, skinDk))]),
      ...(atk ? [...turn([limb(41.5, 26, 50, 25, 2.4, 2.1, skin), limb(50, 25, 57, 24, 2.1, 1.8, skin), ball(58.5, 23.8, 2.2, 2, skin),
      ...[22.4, 23.8, 25.2].map(y => limb(60, y, 62.6, y + 0.3, 0.45, 0.4, skin)), specks([[62.75, 22.5], [62.75, 24], [62.75, 25.5]], bone),
      sheet([[43, 24], [48, 23.5], [48, 27], [43, 27.5]], shirtDk, { curve: 0.5 })], 41.5, 26, -14)] : [limb(41.5, 26, 50, 25, 2.4, 2.1, skin), limb(50, 25, 57, 24, 2.1, 1.8, skin), ball(58.5, 23.8, 2.2, 2, skin),
      ...[22.4, 23.8, 25.2].map(y => limb(60, y, 62.6, y + 0.3, 0.45, 0.4, skin)), specks([[62.75, 22.5], [62.75, 24], [62.75, 25.5]], bone),
      sheet([[43, 24], [48, 23.5], [48, 27], [43, 27.5]], shirtDk, { curve: 0.5 })]),
      // the neck, and the head lolling to one side
      limb(31, 19, 31.5, 25, 2.6, 2.8, skinDk),
      ball(29, 15, 7, 7, skin),
      // the jaw dropped slack below the line of the skull, the mouth a black hole
      ...(atk ? [ball(28.2, 25, 4.4, 2.2, skin),
      sheet([[24, 18.4], [32, 19.2], [31.4, 25.4], [27.6, 26.8], [23.8, 24.4]], '#2a1418'),
      dots([[27, 19], [29, 19], [25, 24.4], [28, 26]], bone)] : [ball(28.2, 22.2, 4.4, 2.2, skin),
      sheet([[24.4, 18.6], [31.6, 19.4], [31, 23], [27.6, 24], [24.2, 22]], '#2a1418'),
      dots([[27, 19], [29, 19], [25, 22], [28, 23]], bone)]),
      // the cheek torn through, the back teeth showing
      sheet([[19.6, 17], [23.8, 18.4], [23.4, 21], [20, 20.6]], '#3a1c1c'), dots([[21, 19], [22, 19]], '#b8ae90'),
      // a brow gone slack; one socket empty, the other eye filmed over and blind
      limb(21.5, 11.5, 26.5, 12, 1, 0.8, skinDk), limb(30, 11.5, 35, 11, 1, 0.8, skinDk),
      ball(24, 14, 2.2, 1.7, rot), ball(23.8, 13.6, 1.6, 1.2, '#1e161c'),
      ball(32.5, 13.6, 1.7, 1.3, '#d4d8c4'), dots([[33, 13]], '#8a8e80'),
      ball(28.6, 16.8, 1.4, 1.2, rot), dots([[28, 16], [29, 16]], '#1e161c'),
      // lank strands of hair on a scalp peeling away, flies about it
      hair(24, 8.5, 22.5, 14, '#3a3a2a'), hair(27, 8, 26, 13, '#3a3a2a'), hair(32, 8.5, 34, 12, '#3a3a2a'),
      sheet([[30, 9], [34, 9.5], [33, 11.5], [30.5, 11]], '#6e5a4a'),
      specks([[17, 6.5], [19, 4.5], [36, 7], [38, 5]], '#141014'),
      // stitches across a wound on the forearm, the bruising of the grave
      ...(atk ? [...turn([...[[49, 24], [51, 24.25], [53, 24]].map(([x, y]) => hair(x, y - 1, x + 0.5, y + 1, '#1a1418'))], 41.5, 26, -14)] : [...[[49, 24], [51, 24.25], [53, 24]].map(([x, y]) => hair(x, y - 1, x + 0.5, y + 1, '#1a1418'))]),
      specks([[26, 31], [24.5, 37], [38, 41], [22, 33]], rot),
    ];
  },

  // An orc: broad as a door and heavy with muscle, a scalp lock greased flat,
  // a jaw thrust out with tusks up from it, iron on the chest and shoulders
  // over leather, a belt with a brass buckle, and an axe that could fell a tree.
  orc: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#607f3a', skinDk = '#3e5a22', skinLt = '#7e9e52', iron = '#7a8290', ironLt = '#c8ced8', ironDk = '#4a505c', leather = '#5a3a24', trouser = '#3a3040', boot = '#2e2218';
    return [
      // the axe, planted beside it, its haft wrapped in cord
      ...(atk ? [limb(40, 38, 55, 3, 1.3, 1.3, '#6a4a2a'), ...[20, 23, 26].map(y => hair(48.5 - (y - 20) * 0.43, y, 51 - (y - 20) * 0.43, y - 0.75, '#8a6a40'))] : [limb(53, 60, 53, 14, 1.3, 1.3, '#6a4a2a'), ...[24, 27, 30].map(y => hair(51.75, y, 54.25, y - 0.75, '#8a6a40'))]),
      ...(atk ? [sheet([[53.6, 5], [61.6, 1], [63.4, 18], [50, 15]], '#9aa2ae', { tilt: [0.6, -0.3] })] : [sheet([[53, 10], [62, 6], [63, 25], [53, 21]], '#9aa2ae', { tilt: [0.6, -0.1] })]),
      ...(atk ? [line(62, 2, 63, 17, '#e0e6ee'), hair(54, 8, 52.4, 13.4, '#6a707c')] : [line(62.4, 7, 62.4, 24, '#e0e6ee'), hair(55, 12, 55, 19, '#6a707c')]),
      // thick legs in dark breeches, heavy boots
      ...both64(limb(26, 44, 24, 53, 3.6, 3.2, trouser)), ...both64(limb(24, 53, 23.5, 59, 3.2, 3, boot)),
      ...both64(ball(22.5, 61.2, 4.4, 1.8, boot)), ...both64(hair(20.5, 53.5, 27.5, 53.5, '#4a3a2a')),
      // the barrel of the body, leather over it, the iron breastplate riveted on
      ball(32, 34, 13, 11, skin),
      sheet([[19, 25], [45, 25], [44, 45], [20, 45]], leather, { curve: 1 }),
      sheet([[22, 26], [42, 26], [41, 39], [32, 41], [23, 39]], iron, { curve: 1 }),
      sheet([[22, 26], [27, 26], [27, 40], [23, 39]], ironLt, { curve: 0.5 }),
      line(32, 26.5, 32, 40.5, ironDk), hair(23, 27, 31, 27, '#eef2f8'),
      ...[[24, 28], [40, 28], [24, 37], [40, 37], [32, 33]].map(([x, y]) => ball(x, y, 0.7, 0.7, ironLt)),
      hair(25, 30, 28, 34, '#eef2f8'), hair(36, 35, 39, 32, ironDk),
      // the belt, its buckle, a skirt of leather strips
      sheet([[19.5, 43], [44.5, 43], [44.5, 46.5], [19.5, 46.5]], '#2a1a10', { curve: 0.8 }),
      sheet([[30, 42.6], [34, 42.6], [34, 47], [30, 47]], '#c9a24a'), sheet([[31, 43.6], [33, 43.6], [33, 46], [31, 46]], '#2a1a10'),
      ...[22, 27, 37, 42].map(x => sheet([[x - 2.2, 46.5], [x + 2.2, 46.5], [x + 1.8, 52], [x - 1.8, 52]], leather, { curve: 0.5 })),
      // arms thick as a man's leg, the left fist hanging, the right resting on the axe haft
      ...(atk ? [limb(17, 27, 25, 32, 4, 3.6, skin), limb(25, 32, 40, 32.6, 3.4, 3, skin), ball(42, 32, 3.4, 3.2, skin)] : [limb(17, 27, 13, 38, 4, 3.6, skin), limb(13, 38, 12, 45, 3.4, 3, skin), ball(12, 47, 3.4, 3.2, skin)]),
      ...(atk ? [hair(20, 29, 24, 31.5, skinDk), hair(41, 30.5, 43, 33.5, skinDk)] : [hair(14.5, 31, 12.5, 37, skinDk), hair(10.5, 46, 13.5, 46, skinDk)]),
      ...(atk ? [limb(47, 27, 53, 21, 4, 3.6, skin), limb(53, 21, 48.4, 22, 3.4, 3, skin), ball(47, 23.4, 3.4, 3.2, skin)] : [limb(47, 27, 50, 37, 4, 3.6, skin), limb(50, 37, 52, 41, 3.4, 3, skin), ball(52.6, 41.5, 3.4, 3.2, skin)]),
      ...(atk ? [hair(46, 22, 48.4, 24.6, skinDk)] : [hair(51, 40.5, 54.5, 40.5, skinDk)]),
      // pauldrons of iron, dented
      ...both64(ball(17, 26.5, 6.4, 5, iron)), ...both64(hair(12, 24, 21, 22.5, ironLt)), ...both64(hair(14.5, 27.5, 17, 29, ironDk)),
      // a bull neck and the head: a scalp lock, a brow like a shelf, a broken nose, tusks
      limb(32, 19, 32, 25, 4.4, 5, skinDk),
      sheet([[25, 7], [27.5, 4], [36.5, 4], [39, 7], [32, 8.5]], '#1e1a14', { tilt: [0.3, 0.8] }),
      ball(32, 14, 8.6, 8.4, skin), ball(32, 20, 6.8, 3.6, skinDk),
      limb(24.5, 12, 30.5, 13.6, 1.6, 1.3, skinDk), limb(39.5, 12, 33.5, 13.6, 1.6, 1.3, skinDk),
      ball(28, 14.8, 2, 1.3, '#2a3a14'), ball(36, 14.8, 2, 1.3, '#2a3a14'),
      dots([[27, 14], [28, 14], [36, 14], [37, 14]], '#ff4a30'), dots([[28, 14], [36, 14]], '#1a0808'),
      ball(32, 17.2, 2.8, 1.8, skinLt), hair(30.5, 15, 31.25, 17, skinDk),
      ...(atk ? [sheet([[26, 19.2], [38, 19.2], [36.4, 24], [27.6, 24]], '#2a1410'), ball(32, 23, 3, 1, '#7a2420')] : [sheet([[26.5, 19.6], [37.5, 19.6], [36, 21.6], [28, 21.6]], '#2a1410')]),
      ball(32, 22.6, 5, 1.4, skinDk),
      limb(27.4, 22, 26.6, 17.4, 1, 0.55, '#f4ecd6'), limb(36.6, 22, 37.2, 18.6, 1, 0.75, '#f4ecd6'),
      // scars, warts, the ear
      hair(34, 9.5, 37, 14.5, '#2a3a14'), specks([[26, 18], [38, 11], [29.5, 9]], skinDk),
      ball(23.4, 15.5, 1.3, 2.2, skin), ball(40.6, 15.5, 1.3, 2.2, skin),
    ];
  },

  // A ghoul: crouched low and leaning in, a starved thing all ribs and sinew,
  // long arms ending in hooked claws that rest on the floor, pointed ears, eyes
  // deep in their sockets, and a jaw hanging open on a mouthful of needles.
  ghoul: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#8f9a84', skinDk = '#5c6656', skinLt = '#b0b8a4', bone = '#f2eee0', rag = '#3a3430';
    return [
      // the legs folded under it, knees high, long splayed feet
      ...both64(limb(27, 44, 20, 48, 3, 2.6, skinDk)), ...both64(ball(20, 48, 2.8, 2.6, skinDk)),
      ...both64(limb(20, 48, 23, 59, 2.6, 2.2, skinDk)), ...both64(limb(23, 60, 17.5, 62, 2, 1.4, skinDk)),
      ...both64(specks([[16, 62.5], [17, 62.75], [18, 62.5]], bone)),
      // a rag about the hips
      sheet([[25, 42], [39, 42], [41, 49], [37, 47], [34, 50], [30, 47], [27, 50], [23, 48]], rag, { curve: 0.8 }),
      // the wasted chest, hunched forward, ribs curving round from the breastbone
      ball(32, 34, 9, 9.4, skin),
      ...[28, 31, 34, 37].flatMap(y => [limb(31, y, 25, y + 1.6, 0.55, 0.45, skinDk), limb(33, y, 39, y + 1.6, 0.55, 0.45, skinDk)]),
      limb(32, 26, 32, 40, 0.7, 0.7, skinLt), ball(32, 41, 3, 2, skinDk),
      // long arms down to the floor, the elbows knobbed, the claws hooked on the stone
      ...(atk ? [limb(23.5, 27, 12, 24, 2, 1.7, skin), ball(12, 24, 1.9, 1.8, skinDk), limb(12, 24, 13, 10, 1.7, 1.4, skin), ball(13.2, 8.4, 2.4, 2.2, skin), limb(10.6, 7, 7.6, 2.4, 0.6, 0.3, bone), limb(12.8, 6.2, 12.2, 1.2, 0.6, 0.3, bone), limb(15, 6.6, 17.4, 2.6, 0.6, 0.3, bone),
        limb(40.5, 27, 52, 24, 2, 1.7, skin), ball(52, 24, 1.9, 1.8, skinDk), limb(52, 24, 51, 10, 1.7, 1.4, skin), ball(50.8, 8.4, 2.4, 2.2, skin), limb(53.4, 7, 56.4, 2.4, 0.6, 0.3, bone), limb(51.2, 6.2, 51.8, 1.2, 0.6, 0.3, bone), limb(49, 6.6, 46.6, 2.6, 0.6, 0.3, bone)] : [limb(23.5, 27, 14, 38, 2, 1.7, skin), ball(14, 38, 1.9, 1.8, skinDk), limb(14, 38, 11, 54, 1.7, 1.4, skin),
      ball(10.6, 55.6, 2.4, 2.2, skin), ...[[8, 57, 6, 61.5], [10, 57.6, 9.4, 62.5], [12, 57.4, 13, 62]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, bone)),
      limb(40.5, 27, 50, 38, 2, 1.7, skin), ball(50, 38, 1.9, 1.8, skinDk), limb(50, 38, 53, 54, 1.7, 1.4, skin),
      ball(53.4, 55.6, 2.4, 2.2, skin), ...[[56, 57, 58, 61.5], [54, 57.6, 54.6, 62.5], [52, 57.4, 51, 62]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, bone))]),
      // the shoulders bony and high, the neck thrust forward
      ...both64(ball(23, 27, 3.6, 2.8, skin)),
      limb(32, 23, 32, 28, 2.2, 2.6, skinDk),
      // long pointed ears, a narrow skull, the cheeks sunk
      sheet([[25, 16], [15, 9], [24.5, 20]], skin, { tilt: [-0.5, -0.2] }), sheet([[39, 16], [49, 9], [39.5, 20]], skin, { tilt: [0.5, -0.2] }),
      hair(23.5, 16.5, 17.5, 11.5, skinDk), hair(40.5, 16.5, 46.5, 11.5, skinDk),
      ball(32, 18, 6.6, 7, skin), ball(27.6, 21, 1.6, 2, skinDk), ball(36.4, 21, 1.6, 2, skinDk),
      // eyes deep in shadowed sockets, a cold yellow light in them
      ball(28.8, 16.6, 2.2, 1.8, '#1e2218'), ball(35.2, 16.6, 2.2, 1.8, '#1e2218'),
      dots([[29, 17], [35, 17]], '#ffe040'), dots([[29, 16], [35, 16]], '#fff8c0'),
      sheet([[31, 19], [33, 19], [32, 21]], '#2a3024'),
      // the jaw hanging open, needles of teeth, a dark tongue
      ...(atk ? [ball(32, 25.6, 5, 4.6, '#2a1414'),
      ...[28.5, 30, 31.5, 33, 34.5].map(x => sheet([[x - 0.5, 22], [x + 0.5, 22], [x, 23.8]], bone)),
      ...[29.5, 31, 32.5, 34].map(x => sheet([[x - 0.5, 29.6], [x + 0.5, 29.6], [x, 27.8]], bone)),
      ball(32, 28, 1.8, 0.9, '#8a2424')] : [ball(32, 24.4, 4.6, 3.2, '#2a1414'),
      ...[28.5, 30, 31.5, 33, 34.5].map(x => sheet([[x - 0.5, 22], [x + 0.5, 22], [x, 23.8]], bone)),
      ...[29.5, 31, 32.5, 34].map(x => sheet([[x - 0.5, 27], [x + 0.5, 27], [x, 25.4]], bone)),
      ball(32, 25.6, 1.6, 0.8, '#8a2424')]),
      // sinew and veins, a few lank hairs, grave-dirt
      ...(atk ? [hair(17, 25, 14, 25, skinDk), hair(47, 25, 50, 25, skinDk)] : [hair(18, 32, 15.5, 36, skinDk), hair(46, 32, 48.5, 36, skinDk)]), hair(30, 11.5, 28.5, 15, '#3a4034'), hair(34, 11.5, 35, 15, '#3a4034'),
      specks(atk ? [[26, 36], [38, 30], [35, 39], [12, 16], [52, 16]] : [[26, 36], [38, 30], [35, 39], [20, 50], [44, 50]], '#4a5444'),
    ];
  },

  // The Dark Acolyte: tall and hooded in crimson, a mantle trimmed in gold over
  // its shoulders, a gaunt face in the hood's shadow lit from below by the
  // violet orb it holds in two bony hands before its chest.
  // A dark elf warrior: slight and tall, grey-violet skin, white hair falling
  // to the shoulder blades, long ears swept back, eyes red as coals; black
  // mail edged in silver, a dark cloak, a curved blade in each hand. Striking,
  // both blades go up and back; in its guard, they cross before its chest.
  drow_warrior: (pose = 'idle') => {
    const atk = pose === 'windup', guard = pose === 'special';
    const k = drowKit();
    const { skin, mail, mailLt, leather, boot, cloak, cloakDk, silver, silverLt } = k;
    const dy = atk ? 1 : 0;
    const legs = guard
      ? [limb(28, 45, 24, 53, 2.2, 2, leather), limb(24, 53, 22.5, 60, 2, 1.8, boot), ball(21.6, 61.4, 3, 1.4, boot),
        limb(36, 45, 40, 53, 2.2, 2, leather), limb(40, 53, 41.5, 60, 2, 1.8, boot), ball(42.4, 61.4, 3, 1.4, boot)]
      : [...both64(limb(28, 45, 27.5, 54, 2.2, 2, leather)), ...both64(limb(27.5, 54, 27, 60, 2, 1.8, boot)), ...both64(ball(26.4, 61.4, 3, 1.4, boot))];
    const body = [
      // the cloak behind, falling to the knee in points
      sheet([[20, 17 + dy], [44, 17 + dy], [47, 50], [43, 52.5], [38, 50], [32, 53.5], [26, 50], [21, 52.5], [17, 50]], cloakDk, { curve: 1 }),
      sheet([[21, 17 + dy], [43, 17 + dy], [45, 47], [32, 49], [19, 47]], cloak, { curve: 1 }),
      // a skirt of leather strips at the hips, the mail shirt over it, silver at its edges and down its front
      sheet([[23, 38 + dy], [41, 38 + dy], [42.5, 46.5], [32, 47.5], [21.5, 46.5]], leather, { curve: 0.6 }),
      ...[26, 30, 34, 38].map(x => hair(x, 39.5 + dy, x + (x - 32) * 0.08, 46.5, '#3a3046')),
      sheet([[22.5, 17 + dy], [41.5, 17 + dy], [40.5, 39 + dy], [23.5, 39 + dy]], mail, { curve: 1 }),
      ...[21, 25, 29, 33, 37].map(y => hair(23.5, y + dy, 40.5, y + dy, '#1a1a22')),
      sheet([[27, 17.5 + dy], [37, 17.5 + dy], [36, 31 + dy], [32, 33 + dy], [28, 31 + dy]], mailLt, { curve: 0.6 }),
      hair(32, 18 + dy, 32, 32.5 + dy, silver), hair(27.5, 18 + dy, 28.5, 30.5 + dy, silver), hair(36.5, 18 + dy, 35.5, 30.5 + dy, silver),
      line(23.5, 38.6 + dy, 40.5, 38.6 + dy, '#14101a'), ball(32, 38.8 + dy, 1.4, 1.1, silver), specks([[31.5, 38.25 + dy]], silverLt),
      // pauldrons edged in silver, and the neck
      ...both64(ball(22, 18.5 + dy, 3.8, 2.8, mailLt)), ...both64(hair(18.5, 17.5 + dy, 25, 16.5 + dy, silver)),
      limb(32, 13.5 + dy, 32, 17 + dy, 1.6, 1.9, skin),
    ];
    let arms;
    if (atk) {
      // both blades swung up and back, to come down together
      arms = [limb(22, 19 + dy, 16.5, 11, 2, 1.8, mail), limb(16.5, 11, 15.5, 6.5, 1.8, 1.6, leather), ...drowHand(15.4, 5.6, k), ...scimitar(15.4, 5.6, -0.55, -0.83, 17, 1, k),
        limb(42, 19 + dy, 47.5, 11, 2, 1.8, mail), limb(47.5, 11, 48.5, 6.5, 1.8, 1.6, leather), ...drowHand(48.6, 5.6, k), ...scimitar(48.6, 5.6, 0.55, -0.83, 17, -1, k)];
    } else if (guard) {
      // the guard: the two blades crossed before the chest, edges out
      arms = [limb(22, 19, 21.5, 27, 2, 1.8, mail), limb(21.5, 27, 27, 29.5, 1.8, 1.6, leather), ...drowHand(27.6, 29.4, k),
        limb(42, 19, 42.5, 27, 2, 1.8, mail), limb(42.5, 27, 37, 29.5, 1.8, 1.6, leather), ...drowHand(36.4, 29.4, k),
        ...scimitar(27.6, 29.4, 0.6, -0.8, 21, -1, k), ...scimitar(36.4, 29.4, -0.6, -0.8, 21, 1, k),
        specks([[32, 22.5], [31, 21.5], [33, 23.5]], silverLt)];
    } else {
      // standing ready, the blades held low and out to either side
      arms = [limb(22, 19, 19.5, 29, 2, 1.8, mail), limb(19.5, 29, 18.5, 36, 1.8, 1.6, leather), ...drowHand(18.4, 37.2, k), ...scimitar(18.4, 37.2, -0.42, 0.9, 18, 1, k),
        limb(42, 19, 44.5, 29, 2, 1.8, mail), limb(44.5, 29, 45.5, 36, 1.8, 1.6, leather), ...drowHand(45.6, 37.2, k), ...scimitar(45.6, 37.2, 0.42, 0.9, 18, -1, k)];
    }
    return [...drowHair(32, 10 + dy, k), ...legs, ...body, ...arms, ...drowHead(32, 10 + dy, k, { grim: atk || guard })];
  },
  // A dark elf mage: the same people in a robe the colour of a bruise, worked
  // in silver, with violet fire in one hand. Throwing it, both hands come
  // forward round the swelling flame; weaving a web, the arms spread wide and
  // threads of shadow run between the fingers.
  drow_mage: (pose = 'idle') => {
    const bolt = pose === 'windup', weave = pose === 'special';
    const k = drowKit();
    const { skin, silver, silverLt } = k;
    const robe = '#2c1a3c', robeDk = '#1a0e26', robeLt = '#46285e', fire = '#b060ff', fireLt = '#f0d8ff';
    const body = [
      // a narrow gown to the floor, its folds, a silver panel down its front
      ...both64(ball(29, 62, 2, 0.9, '#140e18')),
      sheet([[24.5, 16], [39.5, 16], [41.5, 61], [37.5, 62.4], [32, 61.8], [26.5, 62.4], [22.5, 61]], robe, { curve: 1 }),
      ...[[26, 36, 24.5, 61.5], [37, 36, 38.5, 61.5]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.2, y0], [x1 + 1, y1], [x1 - 0.8, y1]], robeDk, { curve: 0.3 })),
      sheet([[29.8, 18], [34.2, 18], [35.4, 61], [28.6, 61]], robeLt, { curve: 0.4 }),
      ...[40, 52].map(y => hair(30.4, y, 34.6, y, silver)), hair(29.8, 18, 28.6, 61, silver), hair(34.2, 18, 35.4, 61, silver),
      hair(23, 60.5, 41, 60.5, silver),
      // a mantle over the shoulders, cut into long points at the elbows and edged in silver
      sheet([[22, 15], [42, 15], [46, 24], [49, 35], [43.5, 31.5], [39, 36.5], [32, 33.5], [25, 36.5], [20.5, 31.5], [15, 35], [18, 24]], robeDk, { curve: 0.9 }),
      hair(49, 35, 43.5, 31.5, silver), hair(43.5, 31.5, 39, 36.5, silver), hair(39, 36.5, 32, 33.5, silver),
      hair(32, 33.5, 25, 36.5, silver), hair(25, 36.5, 20.5, 31.5, silver), hair(20.5, 31.5, 15, 35, silver),
      ball(32, 30.6, 1.5, 1.2, silver), specks([[31.5, 30]], silverLt),
      // a high collar standing up behind the head, and the neck
      sheet([[24, 18], [25, 11], [28, 14], [36, 14], [39, 11], [40, 18]], robeDk, { curve: 0.6 }), hair(25, 11.5, 27.5, 14, silver), hair(39, 11.5, 36.5, 14, silver),
      limb(32, 13.5, 32, 17, 1.5, 1.8, skin),
      ...both64(ball(23.5, 18.5, 3.4, 2.6, robe)),
    ];
    const flame = (x, y, r) => [ball(x, y, r * 1.6, r * 1.6, '#4a1a7a', { glows: true }), ball(x, y, r, r, fire, { glows: true }), ball(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.5, fireLt, { glows: true }),
      specks([[x - r * 2, y - r], [x + r * 1.8, y - r * 1.4], [x, y - r * 2.4]], '#d0a0ff', { glows: true })];
    let arms;
    if (bolt) {
      // both hands forward round the flame, swelling to be thrown
      arms = [limb(23.5, 19, 25, 27, 2.4, 2.6, robe), sheet([[22, 25], [28.5, 25.5], [28, 30], [22, 30.5]], robeDk, { curve: 0.6 }),
        limb(40.5, 19, 39, 27, 2.4, 2.6, robe), sheet([[42, 25], [35.5, 25.5], [36, 30], [42, 30.5]], robeDk, { curve: 0.6 }),
        ...drowHand(28.6, 28.6, k), ...drowHand(35.4, 28.6, k), ...flame(32, 26.5, 3.2)];
    } else if (weave) {
      // the arms spread wide, the web of shadow strung between the hands
      arms = [limb(23.5, 19, 14, 22, 2.4, 2.2, robe), sheet([[9.5, 19.5], [15.5, 20], [15, 25], [9, 24.5]], robeDk, { curve: 0.6 }), ...drowHand(9.8, 22.6, k),
        limb(40.5, 19, 50, 22, 2.4, 2.2, robe), sheet([[54.5, 19.5], [48.5, 20], [49, 25], [55, 24.5]], robeDk, { curve: 0.6 }), ...drowHand(54.2, 22.6, k),
        ...[[10, 22, 54, 22], [10, 22, 32, 34], [54, 22, 32, 34], [10, 22, 32, 12], [54, 22, 32, 12], [32, 12, 32, 34], [20, 17, 44, 27], [44, 17, 20, 27]].map(([a, b, c, d]) => hair(a, b, c, d, '#9a8ab4', { glows: true })),
        ...[4, 7, 10].flatMap(r => oval(32, 22.5, r * 2, r, 10).map((pt, i, a) => { const n = a[(i + 1) % a.length]; return hair(pt[0], pt[1], n[0], n[1], '#b4a4d0', { glows: true }); })),
        specks([[32, 22.5], [24, 18], [40, 27]], '#e8dcff', { glows: true })];
    } else {
      // one hand at the side, the other holding up its violet fire
      arms = [limb(23.5, 19, 21.5, 29, 2.4, 2.6, robe), sheet([[18.5, 28], [24.5, 28.5], [24, 33], [18, 33.5]], robeDk, { curve: 0.6 }), ...drowHand(21.4, 34.6, k),
        limb(40.5, 19, 44, 25, 2.4, 2.4, robe), sheet([[41, 23], [47, 23.5], [46.5, 27.5], [41, 28]], robeDk, { curve: 0.6 }), ...drowHand(45.6, 23.6, k), ...flame(45.8, 19.4, 2.4)];
    }
    return [...drowHair(32, 10, k), ...body, ...arms, ...drowHead(32, 10, k, { grim: bolt || weave })];
  },

  acolyte: (pose = 'idle') => {
    const atk = pose === 'windup', cast = pose === 'special';
    const robe = '#5a1416', robeDk = '#2e0a0c', robeLt = '#842a26', mantle = '#3e0c10', gold = '#b88a34', goldLt = '#e8c060';
    const skin = '#c4ac9c', skinDk = '#7a6458', orb = '#a850f0', orbLt = '#f0d8ff';
    return [
      // the robe to the floor, folds running down it, pointed shoes at the hem
      ...both64(ball(28, 62, 2.2, 0.9, '#1a1012')),
      sheet([[22, 16], [42, 16], [47, 61], [43, 62.4], [38, 61.2], [32, 62.8], [26, 61.2], [21, 62.4], [17, 61]], robe, { curve: 1 }),
      ...[[23.5, 22, 19.5, 61], [28, 34, 26, 62], [33.5, 34, 34.5, 62.6], [38.5, 22, 42, 61.6]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.5, y0], [x1 + 1.2, y1], [x1 - 1, y1]], robeDk, { curve: 0.3 })),
      ...[[26, 34, 23, 61.5], [36, 34, 38, 61.5]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1, y0], [x1 + 1, y1], [x1 - 0.6, y1]], robeLt, { curve: 0.3 })),
      // a gold cord at the waist, a sigil hanging from it, tassels
      hair(23, 33.5, 41, 33.5, gold), line(23, 33, 41, 33, gold),
      limb(32, 33.5, 32, 38, 0.3, 0.3, gold), sheet([[30.4, 38], [33.6, 38], [32, 42.5]], gold), hair(32, 38.5, 32, 41.5, goldLt),
      ...both64(limb(27, 33.5, 26.5, 39, 0.35, 0.25, gold)),
      // embroidery down the front
      ...[44, 48, 52, 56].flatMap(y => [hair(30.5, y, 32, y + 1.5, gold), hair(33.5, y, 32, y + 1.5, gold)]),
      // the sleeves, coming forward to the orb; the bony hands round it
      ...(atk ? [...grow([...both64(limb(23.5, 18, 26, 27, 3, 3.6, robe)), ...both64(sheet([[22.5, 25], [29.5, 25.5], [28.5, 30], [22, 30.5]], robeDk, { curve: 0.6 })),
...both64(hair(22.5, 30.25, 28.75, 29.75, robeLt)),
ball(32, 26, 4, 3.9, orb, { glows: true }), ball(31.2, 25, 2, 1.9, orbLt, { glows: true }), dots([[31, 25]], '#ffffff'),
specks([[27.5, 21], [36.5, 20.5], [26, 25.5], [38, 26.5], [29, 31], [35.5, 31.5]], '#c890ff'),
...both64(ball(27.8, 28, 1.5, 1.6, skin)),
...both64(limb(28, 26.8, 29.4, 24, 0.4, 0.3, skin)), ...both64(limb(27.8, 29, 29.6, 30.2, 0.4, 0.3, skin))], 32, 27, 1.3, 1.3),
        // the bolt it is about to loose, dark sparks running off the orb
        specks([[22, 18], [42, 17.5], [20, 30], [44, 31], [26, 36], [38, 36.5]], '#a850f0', { glows: true })] : cast ? [// the mend: the arms raised wide, the orb hanging alone between them, haloed
        ...both64(limb(23.5, 18, 15, 10, 3, 3.6, robe)), ...both64(sheet([[10.6, 5.6], [17, 7], [16.4, 11.4], [10.2, 10.2]], robeDk, { curve: 0.6 })), ...both64(hair(10.6, 10.4, 16.6, 11.6, robeLt)),
        ...both64(ball(13.6, 5.4, 1.5, 1.6, skin)), ...both64(limb(12.8, 4.6, 12, 1.6, 0.4, 0.3, skin)), ...both64(limb(14.4, 4.6, 15.2, 1.8, 0.4, 0.3, skin)),
        ball(32, 26, 6.6, 6.4, '#5a1a8a', { glows: true }), ball(32, 26, 4.4, 4.3, orb, { glows: true }), ball(31.2, 25, 2.2, 2.1, orbLt, { glows: true }), dots([[31, 25]], '#ffffff'),
        specks([[24, 20], [40, 19.5], [23, 27], [41, 28], [26, 33], [38, 33.5], [12, 1], [52, 1], [32, 17]], '#e0b0ff', { glows: true })] : [...both64(limb(23.5, 18, 26, 27, 3, 3.6, robe)), ...both64(sheet([[22.5, 25], [29.5, 25.5], [28.5, 30], [22, 30.5]], robeDk, { curve: 0.6 })),
      ...both64(hair(22.5, 30.25, 28.75, 29.75, robeLt)),
      // the orb, its light, and sparks of it in the air
      ball(32, 26, 4, 3.9, orb, { glows: true }), ball(31.2, 25, 2, 1.9, orbLt, { glows: true }), dots([[31, 25]], '#ffffff'),
      specks([[27.5, 21], [36.5, 20.5], [26, 25.5], [38, 26.5], [29, 31], [35.5, 31.5]], '#c890ff'),
      ...both64(ball(27.8, 28, 1.5, 1.6, skin)),
      ...both64(limb(28, 26.8, 29.4, 24, 0.4, 0.3, skin)), ...both64(limb(27.8, 29, 29.6, 30.2, 0.4, 0.3, skin))]),
      // the mantle over the shoulders, trimmed in gold
      sheet([[21, 16.5], [27, 13.5], [37, 13.5], [43, 16.5], [44, 21], [32, 23.5], [20, 21]], mantle, { curve: 0.9 }),
      hair(20.5, 21, 32, 23.25, goldLt), hair(32, 23.25, 43.5, 21, goldLt),
      // the hood, pointed and deep; the face within it gaunt, lit from below
      sheet([[24, 16.5], [24.5, 9], [28, 3.5], [32, 1.2], [36, 3.5], [39.5, 9], [40, 16.5], [36, 15], [28, 15]], robe, { curve: 0.9 }),
      sheet([[26, 15], [26.6, 8.6], [29, 5.4], [35, 5.4], [37.4, 8.6], [38, 15]], robeDk, { curve: 0.5 }),
      sheet(oval(32, 10.4, 3.9, 4.8), '#0e0a0c'),
      ball(32, 11.2, 2.7, 3.4, skin), ball(32, 13.6, 2, 1.3, skinDk),
      sheet([[29.2, 8.4], [34.8, 8.4], [34.6, 10.2], [29.4, 10.2]], '#120a0c'),
      dots([[30, 9], [33, 9]], '#ff3a2a'), specks([[30.5, 9.5], [33.5, 9.5]], '#ffb0a0'),
      hair(30, 11.5, 30.5, 13, skinDk), hair(34, 11.5, 33.5, 13, skinDk), hair(31, 13.75, 33, 13.75, '#5a3a34'),
      specks([[31.5, 12.5], [32.5, 12.5]], '#e8c8ff'),
    ];
  },

  // A wraith: no legs and no body, a cloak that has forgotten who wore it,
  // tattered to wisps below, the hood deep and empty but for two cold lights,
  // and long skeletal hands reaching out of the sleeves.
  wraith: (pose = 'idle') => {
    const atk = pose === 'windup', cast = pose === 'special';
    const cloak = '#5b4483', deep = '#3a2a58', dark = '#22183a', edge = '#7a64a4', bone = '#c8d0dc', glow = '#b4f0ff';
    return [
      // the cloak behind, falling to tatters and wisps that trail to nothing
      sheet([[18, 22], [46, 22], [52, 44], [49, 58], [45, 49], [41, 61], [37, 50], [32, 62], [27, 50], [23, 61], [19, 49], [15, 58], [12, 44]], dark, { curve: 1 }),
      sheet([[20, 22], [44, 22], [48, 42], [44, 50], [40, 44], [36, 53], [32, 45], [28, 53], [24, 44], [20, 50], [16, 42]], deep, { curve: 1 }),
      sheet([[21, 20], [43, 20], [45, 38], [39, 41], [32, 38], [25, 41], [19, 38]], cloak, { curve: 1 }),
      ...[[24, 24, 21, 40], [32, 26, 32, 38], [40, 24, 43, 40]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.2, y0], [x1 + 1, y1], [x1 - 1, y1]], deep, { curve: 0.3 })),
      ...[[26, 23, 24, 38], [37, 23, 40, 38]].map(([x0, y0, x1, y1]) => hair(x0, y0, x1, y1, edge)),
      specks([[16, 60], [22, 63], [31, 63], [42, 63], [48, 60], [33, 58]], '#8a7ab4'),
      // the sleeves, wide and ragged, reaching out
      ...(atk ? [...turn([limb(21, 23, 11, 32, 3, 3.8, cloak), sheet([[7, 30], [14, 30], [13, 35.5], [11, 34], [9, 36], [7.5, 34]], deep, { curve: 0.5 }), ball(10, 36.6, 1.8, 1.6, bone), ...[[8, 37.5, 4.5, 41.5], [9.5, 38, 7.5, 43], [11, 38, 10.6, 43.4], [12, 37.4, 13.6, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone))], 21, 23, 70), ...turn([limb(43, 23, 53, 32, 3, 3.8, cloak), sheet([[50, 30], [57, 30], [56.5, 34], [55, 36], [53, 34], [51, 35.5]], deep, { curve: 0.5 }), ball(54, 36.6, 1.8, 1.6, bone), ...[[56, 37.5, 59.5, 41.5], [54.5, 38, 56.5, 43], [53, 38, 53.4, 43.4], [52, 37.4, 50.4, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone))], 43, 23, -70)] : cast ? [...turn([limb(21, 23, 11, 32, 3, 3.8, cloak), sheet([[7, 30], [14, 30], [13, 35.5], [11, 34], [9, 36], [7.5, 34]], deep, { curve: 0.5 }), ball(10, 36.6, 1.8, 1.6, bone), ...[[8, 37.5, 4.5, 41.5], [9.5, 38, 7.5, 43], [11, 38, 10.6, 43.4], [12, 37.4, 13.6, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone))], 21, 23, -50), ...turn([limb(43, 23, 53, 32, 3, 3.8, cloak), sheet([[50, 30], [57, 30], [56.5, 34], [55, 36], [53, 34], [51, 35.5]], deep, { curve: 0.5 }), ball(54, 36.6, 1.8, 1.6, bone), ...[[56, 37.5, 59.5, 41.5], [54.5, 38, 56.5, 43], [53, 38, 53.4, 43.4], [52, 37.4, 50.4, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone))], 43, 23, 50),
        // the grave-cold gathered between its hands
        ball(32, 41, 3.8, 3.6, '#b4f0ff', { glows: true }), ball(32, 41, 1.8, 1.7, '#ffffff', { glows: true }), specks([[27.5, 37], [36.5, 36.5], [29.5, 45.5], [35, 46], [32, 35]], '#e0fcff', { glows: true })] : [limb(21, 23, 11, 32, 3, 3.8, cloak), limb(43, 23, 53, 32, 3, 3.8, cloak),
      sheet([[7, 30], [14, 30], [13, 35.5], [11, 34], [9, 36], [7.5, 34]], deep, { curve: 0.5 }),
      sheet([[50, 30], [57, 30], [56.5, 34], [55, 36], [53, 34], [51, 35.5]], deep, { curve: 0.5 }),
      // the hands: long bones of fingers, clawing at the air
      ball(10, 36.6, 1.8, 1.6, bone), ...[[8, 37.5, 4.5, 41.5], [9.5, 38, 7.5, 43], [11, 38, 10.6, 43.4], [12, 37.4, 13.6, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone)),
      ball(54, 36.6, 1.8, 1.6, bone), ...[[56, 37.5, 59.5, 41.5], [54.5, 38, 56.5, 43], [53, 38, 53.4, 43.4], [52, 37.4, 50.4, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone))]),
      // the hood, tall and pointed, deep and empty: two cold lights in the dark
      sheet([[20, 24], [22, 10], [27, 4], [32, 1.5], [37, 4], [42, 10], [44, 24], [37, 21], [27, 21]], cloak, { curve: 0.9 }),
      hair(22.5, 11, 27.5, 4.5, edge), hair(41.5, 11, 36.5, 4.5, edge),
      sheet([[24.5, 22], [25.5, 11], [29, 6.5], [35, 6.5], [38.5, 11], [39.5, 22], [32, 20]], '#0a0610', { curve: 0.4 }),
      ball(28.5, 14, 1.5, 1.2, glow, { glows: true }), ball(35.5, 14, 1.5, 1.2, glow, { glows: true }),
      dots([[28, 14], [35, 14]], '#ffffff'), specks([[27.5, 16], [35.25, 16.5]], '#4aa0c0'),
      // a breath of grave-cold drifting off it
      specks([[17, 15], [15, 19], [47, 14], [49.5, 18], [44, 6], [20, 7]], '#c8d8e8'),
    ];
  },

  // A shade: what is left of a hero who fell down here before. Helm, mail and
  // sword still keep their shape, a torn surcoat over the mail, and nothing
  // below the belt but mist trailing away; pale where the wraith is dark, and
  // it stands straight, because it remembers being a person.
  shade: (pose = 'idle') => {
    const atk = pose === 'windup';
    const mail = '#7e98b0', mailDk = '#5a7088', deep = '#4a5e78', mist = '#6a82a0', steel = '#a8bccc', steelLt = '#e0f0ff', surcoat = '#5a6a8a', glow = '#e0fcff';
    return [
      // the mist it trails away into
      sheet([[20, 40], [44, 40], [47, 48], [43, 58], [39, 50], [35, 61], [31, 51], [27, 60], [23, 50], [18, 56], [16, 47]], deep, { curve: 1 }),
      sheet([[22, 40], [42, 40], [43, 46], [38, 50], [32, 47], [26, 50], [21, 46]], mist, { curve: 1 }),
      specks([[17, 58], [25, 62], [34, 63], [42, 61], [46, 55], [30, 56]], '#9ab4d0'),
      // mail from the shoulders to the belt, the torn surcoat over it
      sheet([[20, 23], [44, 23], [45, 41], [32, 43], [19, 41]], mail, { curve: 1 }),
      ...[27, 30, 33, 36, 39].map(y => hair(20, y, 44, y, mailDk)),
      sheet([[24, 23], [40, 23], [41, 40], [37, 38], [34, 42], [30, 38.5], [27, 41.5], [23, 40]], surcoat, { curve: 0.9 }),
      sheet([[29, 27], [35, 27], [35, 33], [32, 35], [29, 33]], '#8a9ab8', { curve: 0.4 }), hair(32, 27.5, 32, 34, '#c8d4e8'), hair(29.5, 30, 34.5, 30, '#c8d4e8'),
      line(19, 40, 45, 40, '#3a4a60'), ball(32, 40.2, 2, 1.6, steel),
      // the shield arm hangs, the shield still on it; the sword arm lifts the blade it died with
      ...(atk ? [...turn([limb(20.5, 25, 16, 36, 2.6, 2.2, mail), ball(15.6, 37.4, 2.2, 2, steel),
      sheet([[6, 30], [17, 30], [17, 40], [11.5, 47], [6, 40]], '#3a4a64', { curve: 0.9 }), hair(7, 31, 16, 31, '#8aa4bc'),
      sheet([[10.5, 33], [12.5, 33], [12.5, 44], [10.5, 44]], '#8a9ab8')], 20.5, 25, 25)] : [limb(20.5, 25, 16, 36, 2.6, 2.2, mail), ball(15.6, 37.4, 2.2, 2, steel),
      sheet([[6, 30], [17, 30], [17, 40], [11.5, 47], [6, 40]], '#3a4a64', { curve: 0.9 }), hair(7, 31, 16, 31, '#8aa4bc'),
      sheet([[10.5, 33], [12.5, 33], [12.5, 44], [10.5, 44]], '#8a9ab8')]),
      ...(atk ? [...turn([limb(43.5, 25, 48.5, 33, 2.6, 2.2, mail), ball(49.2, 34.4, 2.2, 2, steel),
      limb(50.5, 33, 56, 6, 1.1, 0.6, '#d8f0ff', { smooth: 1 }), hair(51, 32, 56, 7, steelLt),
      limb(46, 34.4, 53, 32.4, 0.8, 0.8, steel)], 43.5, 25, -70)] : [limb(43.5, 25, 48.5, 33, 2.6, 2.2, mail), ball(49.2, 34.4, 2.2, 2, steel),
      limb(50.5, 33, 56, 6, 1.1, 0.6, '#d8f0ff', { smooth: 1 }), hair(51, 32, 56, 7, steelLt),
      limb(46, 34.4, 53, 32.4, 0.8, 0.8, steel)]),
      ...both64(ball(20.5, 24.4, 4.6, 3.6, steel)), ...both64(hair(17, 22.5, 24, 21.5, steelLt)),
      // the helm, and nothing in it but two cold lights
      ball(32, 15, 6.6, 7.4, steel), hair(27, 10, 31, 8.5, steelLt),
      sheet([[25.5, 14.2], [38.5, 14.2], [38.5, 17], [25.5, 17]], '#0a0e16'), line(32, 8, 32, 20.5, '#8aa4bc'),
      ball(28.6, 15.6, 1.2, 0.9, glow, { glows: true }), ball(35.4, 15.6, 1.2, 0.9, glow, { glows: true }),
      ...[[27, 18.5], [29, 19], [35, 19], [37, 18.5]].map(([x, y]) => ball(x, y, 0.4, 0.4, '#3a4a5a')),
      specks([[22, 12], [42, 11], [24, 6], [40, 5]], '#c8e0f0'),
    ];
  },

  // An ogre: a hill of a man, mostly belly, the shoulders hunched up round a
  // small head with a heavy brow and an underbite of tusks; a loincloth under
  // the paunch, rope-bound shins, and a club the size of a man on its shoulder.
  ogre: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#b08a5a', skinDk = '#7a5a36', skinLt = '#caa676', cloth = '#5a4a30', clothDk = '#3e3220', club = '#6a4a2a', rope = '#a88a5a';
    return [
      // the club over its right shoulder, knotted and studded with nails
      ...(atk ? [limb(50, 42, 63, 13, 2.4, 4.6, club), hair(51, 38, 62.4, 15, '#4a3018')] : [limb(48, 44, 56, 6, 2.4, 4.6, club), hair(49.5, 40, 56.5, 8, '#4a3018')]),
      ...(atk ? [specks([[62.5, 14], [60, 19], [63, 22], [58, 26]], '#cfc6b0')] : [specks([[57.5, 7], [54, 12.5], [58, 15], [53, 20]], '#cfc6b0')]),
      // legs like stumps, rope bound about the shins, broad bare feet
      ...both64(limb(24, 46, 23, 59, 5.4, 5, skinDk)), ...both64(ball(22, 61.2, 5.8, 2.2, '#5a3e24')),
      ...both64(hair(18.5, 52, 28, 53.5, rope)), ...both64(hair(18.5, 55, 28, 56.5, rope)),
      // the belly, the stretched skin and navel, the loincloth beneath it
      ball(32, 38, 17, 15, skin), ball(33, 42, 11, 9, skinLt),
      hair(32.5, 42.5, 33.5, 44, '#7a5a36'), hair(26, 38, 29, 41, '#c8a676'), hair(40, 38, 37, 41, '#c8a676'),
      sheet([[16, 46], [48, 46], [46, 56], [38, 53], [32, 58], [26, 53], [18, 56]], cloth, { curve: 1 }),
      sheet([[16, 46], [22, 46], [21, 55], [18, 56]], clothDk, { curve: 0.3 }), line(16, 46.5, 48, 46.5, '#2a2014'),
      // arms like logs, the left fist hanging, the right up on the club
      ...(atk ? [limb(16, 26, 9, 17, 5.4, 4.8, skin), limb(9, 17, 11, 9, 4.6, 4.2, skin), ball(11.4, 7, 4.6, 4.2, skin)] : [limb(16, 26, 10, 40, 5.4, 4.8, skin), limb(10, 40, 9, 47, 4.6, 4.2, skin), ball(9, 49, 4.6, 4.2, skin)]),
      ...(atk ? [hair(8.5, 8, 14.5, 7.5, skinDk), hair(12, 23, 9.5, 18, skinDk)] : [hair(6, 48, 12, 48, skinDk), hair(13, 30, 10, 37, skinDk)]),
      limb(48, 26, 51, 37, 5.4, 4.8, skin), limb(51, 37, 51, 42, 4.6, 4.2, skin), ball(50.6, 43, 4.6, 4.2, skin),
      // the shoulders hunched up round a head sunk between them
      ...both64(ball(21, 26, 8.4, 6, skin)), ...both64(hair(15, 22.5, 26, 21, skinLt)),
      ball(32, 21, 9, 5, skinDk),
      // the head: small for the body, a heavy brow, little eyes, a flat nose, the tusks
      ball(32, 16, 8, 7.6, skin), ball(32, 21.4, 6.6, 3.4, skinDk),
      ball(32, 11.6, 7.4, 2.6, '#9a7648'), hair(25.5, 12.5, 38.5, 12.5, '#6a4a2a'),
      ball(28.4, 15, 1.6, 1.1, '#3a2410'), ball(35.6, 15, 1.6, 1.1, '#3a2410'),
      dots([[28, 15], [36, 15]], '#ff9040'),
      ball(32, 17.6, 2.6, 1.8, '#9c7648'), dots([[31, 18], [33, 18]], '#3a2410'),
      ...(atk ? [sheet([[25.6, 20.6], [38.4, 20.6], [36.6, 25], [27.4, 25]], '#2a1410'), ball(32, 24, 3, 1, '#7a2420')] : [sheet([[26, 21], [38, 21], [37, 23], [27, 23]], '#2a1410')]),
      sheet([[27, 22.6], [28.6, 22.6], [27.8, 18.4]], '#f0ead6'), sheet([[37, 22.6], [35.4, 22.6], [36.2, 18.4]], '#f0ead6'),
      ball(23.6, 16, 1.6, 2.4, skin), ball(40.4, 16, 1.6, 2.4, skin),
      // warts, scars, a few bristles on the scalp
      specks([[24, 34], [40, 30], [19, 42], [45, 44], [36, 25]], '#9a7648'), hair(27, 8.5, 26, 6.5, '#3a2a1a'), hair(37, 8.5, 38, 6.5, '#3a2a1a'),
    ];
  },

  // A troll: tall, gaunt and bent, the skin a mottled green like wet stone,
  // arms long enough to drag its knuckles, a great hooked nose and moss for
  // hair; a ragged hide about its hips and yellow eyes under a jutting brow.
  troll: (pose = 'idle') => {
    const atk = pose === 'windup';
    const skin = '#58985c', skinDk = '#356a3c', skinLt = '#78b47a', moss = '#2e4a26', mossLt = '#4a6e36', hide = '#5a4630', claw = '#e8e0c8';
    return [
      // long legs, knees bent, the feet broad and clawed
      ...both64(limb(27, 42, 24, 51, 3, 2.6, skinDk)), ...both64(ball(24, 51, 2.8, 2.6, skinDk)),
      ...both64(limb(24, 51, 25, 59.5, 2.6, 2.2, skinDk)), ...both64(ball(23.6, 61.2, 4, 1.6, skinDk)),
      ...both64(specks([[20, 62.5], [21.5, 62.75], [23, 62.75]], claw)),
      // the gaunt, hunched body, ribs and a pot of a belly, the ragged hide about the hips
      ball(32, 30, 10, 12, skin),
      ...[24, 27, 30].flatMap(y => [hair(24, y, 29, y + 1, skinDk), hair(40, y, 35, y + 1, skinDk)]),
      sheet([[22, 38], [42, 38], [43.5, 46], [40, 44], [37, 48], [33, 45], [29, 48.5], [25.5, 45], [21, 47]], hide, { curve: 1 }),
      hair(23, 40, 41, 40, '#3a2e20'),
      // long arms hanging down to the floor, the claws nearly dragging
      ...(atk ? [limb(23, 21, 13, 16, 2.6, 2.2, skin), ball(13, 16, 2.4, 2.2, skinDk), limb(13, 16, 8, 9, 2.2, 2, skin)] : [limb(23, 21, 14, 34, 2.6, 2.2, skin), ball(14, 34, 2.4, 2.2, skinDk), limb(14, 34, 10, 52, 2.2, 2, skin)]),
      ...(atk ? [ball(7.6, 7.6, 3.2, 3, skinDk), ...[[5, 6, 3.4, 1.6], [7.6, 5, 7.4, 0.8], [10, 5.4, 11.2, 1.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw))] : [ball(9.6, 54.6, 3.2, 3, skinDk), ...[[7, 56.5, 5.5, 60.6], [9.5, 57.4, 9, 61.6], [12, 57, 12.8, 61]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw))]),
      ...(atk ? [limb(41, 21, 51, 16, 2.6, 2.2, skin), ball(51, 16, 2.4, 2.2, skinDk), limb(51, 16, 56, 9, 2.2, 2, skin)] : [limb(41, 21, 50, 34, 2.6, 2.2, skin), ball(50, 34, 2.4, 2.2, skinDk), limb(50, 34, 54, 52, 2.2, 2, skin)]),
      ...(atk ? [ball(56.4, 7.6, 3.2, 3, skinDk), ...[[59, 6, 60.6, 1.6], [56.4, 5, 56.6, 0.8], [54, 5.4, 52.8, 1.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw))] : [ball(54.4, 54.6, 3.2, 3, skinDk), ...[[57, 56.5, 58.5, 60.6], [54.5, 57.4, 55, 61.6], [52, 57, 51.2, 61]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw))]),
      ...both64(ball(23, 21, 4.4, 3.2, skin)),
      // the head thrust forward on the neck, moss for hair hanging down over the brow
      limb(32, 15, 32, 20, 2.8, 3.2, skinDk),
      sheet([[22, 10], [32, 2], [42, 10], [45, 24], [40, 17], [32, 13], [24, 17], [19, 24]], moss, { curve: 0.8 }),
      ...[[23, 13, 20.5, 22], [41, 13, 43.5, 22], [28, 6, 26, 12]].map(([a, b, c, d]) => hair(a, b, c, d, mossLt)),
      ball(32, 15, 6.8, 6, skin),
      limb(26.5, 12, 30.5, 13.4, 1.4, 1.1, skinDk), limb(37.5, 12, 33.5, 13.4, 1.4, 1.1, skinDk),
      ball(28.8, 14.4, 1.7, 1.2, '#1e2a14'), ball(35.2, 14.4, 1.7, 1.2, '#1e2a14'),
      dots([[28, 14], [29, 14], [35, 14], [36, 14]], '#ffe040'), dots([[29, 14], [35, 14]], '#1a1a08'),
      // the great hooked nose, hanging over a wide mouth with crooked teeth
      limb(32, 14, 33.6, 20, 1.6, 2.4, skinLt), ball(33.8, 20.6, 2.4, 1.8, '#4c8a50'),
      ...(atk ? [sheet([[26, 20], [31, 21.4], [38, 20], [36.4, 25.4], [27.6, 25.4]], '#1e2a14'), ball(32, 24.4, 2.6, 1, '#6a2a2a')] : [sheet([[26.5, 20.4], [31, 21.8], [37.5, 20.4], [36, 22.8], [28, 22.8]], '#1e2a14')]),
      dots([[28, 21], [36, 21], [30, 22]], '#f0ead6'),
      // warts and moss on the hide
      specks([[25, 27], [39, 24], [30, 35], [36, 33], [18, 40], [46, 40]], '#3e7a44'), specks([[26, 26], [38, 31]], '#8ab46a'),
    ];
  },

  // A minotaur: a bull above the shoulders and a man below, broad and
  // shaggy-chested, great horns swept out and up, a ring through the nose,
  // a kilt of red cloth belted in bronze, hooves for feet, and a double axe
  // held across its body.
  minotaur: (pose = 'idle') => {
    const atk = pose === 'windup';
    const hide = '#7a5436', hideDk = '#4e3320', hideLt = '#9a7050', horn = '#efe6cc', hornDk = '#b8a888', kilt = '#6a2a20', kiltDk = '#481a14', bronze = '#c9a24a', steel = '#9aa2ae', steelLt = '#e0e6ee';
    return [
      // the double axe across the body, haft from low left to high right
      ...(atk ? [...turn([limb(10, 54, 57, 6, 1.2, 1.2, '#5a3a20'),
      sheet([[51, 2], [61, 0], [63, 12], [56, 13]], steel, { tilt: [0.5, -0.2] }), sheet([[56, 13], [63, 12], [62, 22], [54, 19]], '#8a929e', { tilt: [0.5, 0.2] }),
      line(62, 1, 63, 11.5, steelLt), line(62.6, 13, 61.6, 21.5, steelLt), ball(57, 6, 1.6, 1.6, '#5a5e68')], 32, 40, -15)] : [limb(10, 54, 57, 6, 1.2, 1.2, '#5a3a20'),
      sheet([[51, 2], [61, 0], [63, 12], [56, 13]], steel, { tilt: [0.5, -0.2] }), sheet([[56, 13], [63, 12], [62, 22], [54, 19]], '#8a929e', { tilt: [0.5, 0.2] }),
      line(62, 1, 63, 11.5, steelLt), line(62.6, 13, 61.6, 21.5, steelLt), ball(57, 6, 1.6, 1.6, '#5a5e68')]),
      // the legs: a man's thighs, a beast's shanks and cloven hooves
      ...both64(limb(26, 44, 24, 52, 4, 3.4, hideDk)), ...both64(limb(24, 52, 25, 58, 2.6, 2, hideDk)),
      ...both64(sheet([[20.5, 58], [29.5, 58], [30, 63], [25.5, 63], [25, 60.5], [24.5, 63], [20, 63]], '#2a1e16')),
      // the great chest, shaggy, a paler hide over the breast
      ball(32, 32, 13.4, 12, hide),
      ...both64(ball(26, 29, 5.4, 4.6, hideLt)),
      ...[[26, 34], [30, 36], [34, 36], [38, 34], [28, 39], [36, 39]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.75 : 0.75), y + 1.5, hideDk)),
      // the kilt, belted in bronze
      sheet([[19, 41], [45, 41], [44, 52], [38, 49], [32, 53], [26, 49], [20, 52]], kilt, { curve: 1 }),
      sheet([[19, 41], [24, 41], [23, 50], [20, 52]], kiltDk, { curve: 0.3 }),
      sheet([[19, 40], [45, 40], [45, 43], [19, 43]], '#3a2410', { curve: 0.6 }), ...[24, 32, 40].map(x => ball(x, 41.5, 1.2, 1.1, bronze)),
      // arms thick with muscle, both on the haft
      ...(atk ? [...turn([limb(19, 24, 15, 36, 4.4, 3.8, hide), limb(15, 36, 18, 45, 3.6, 3.2, hide), ball(18.6, 46, 3.4, 3, hide),
      limb(45, 24, 47, 30, 4.4, 3.8, hide), limb(47, 30, 44, 21, 3.6, 3.2, hide), ball(44, 20, 3.4, 3, hide),
      line(15, 41, 21, 41, bronze), line(42, 24, 48, 24, bronze)], 32, 40, -15)] : [limb(19, 24, 15, 36, 4.4, 3.8, hide), limb(15, 36, 18, 45, 3.6, 3.2, hide), ball(18.6, 46, 3.4, 3, hide),
      limb(45, 24, 47, 30, 4.4, 3.8, hide), limb(47, 30, 44, 21, 3.6, 3.2, hide), ball(44, 20, 3.4, 3, hide),
      line(15, 41, 21, 41, bronze), line(42, 24, 48, 24, bronze)]),
      // the bull's neck, a hump of muscle, and the head
      ...(atk ? [...nudge([ball(32, 20, 11, 6, hide), ...both64(ball(21, 23, 6, 4.4, hide)),
      // horns swept out and up, ringed at the base
      ...both64(limb(25, 9, 15, 6, 2.6, 1.8, horn)), ...both64(limb(15, 6, 10.5, 0.6, 1.8, 0.8, horn)),
      ...both64(hair(23, 8, 23.5, 10.5, hornDk)), ...both64(hair(18, 6.5, 18.5, 9, hornDk)),
      ball(32, 13, 8.4, 7.4, hide),
      sheet([[29, 5], [32, 4], [35, 5], [34.5, 8.5], [32, 7.4], [29.5, 8.5]], hideDk, { curve: 0.8 }),
      ...both64(sheet([[24.5, 13], [19, 11], [24, 16]], hide, { tilt: [-0.4, 0] })),
      // the muzzle, broad and pale, the nostrils flared, the bronze ring through them
      ball(32, 19.4, 6, 4, hideLt), ball(32, 18, 4.4, 1.8, '#b08868'),
      ball(29.6, 20, 1.2, 0.9, '#1a0c08'), ball(34.4, 20, 1.2, 0.9, '#1a0c08'),
      sheet(oval(32, 22.6, 1.8, 1.4, 10), bronze), sheet(oval(32, 22.6, 1, 0.7, 8), hideLt),
      // small furious eyes under the brow
      limb(25.5, 11, 29.5, 12.6, 1.2, 1, hideDk), limb(38.5, 11, 34.5, 12.6, 1.2, 1, hideDk),
      dots([[27, 13], [37, 13]], '#ff4030'), specks([[27.5, 13.5], [37.5, 13.5]], '#ffb0a0')], 0, 5)] : [ball(32, 20, 11, 6, hide), ...both64(ball(21, 23, 6, 4.4, hide)),
      // horns swept out and up, ringed at the base
      ...both64(limb(25, 9, 15, 6, 2.6, 1.8, horn)), ...both64(limb(15, 6, 10.5, 0.6, 1.8, 0.8, horn)),
      ...both64(hair(23, 8, 23.5, 10.5, hornDk)), ...both64(hair(18, 6.5, 18.5, 9, hornDk)),
      ball(32, 13, 8.4, 7.4, hide),
      sheet([[29, 5], [32, 4], [35, 5], [34.5, 8.5], [32, 7.4], [29.5, 8.5]], hideDk, { curve: 0.8 }),
      ...both64(sheet([[24.5, 13], [19, 11], [24, 16]], hide, { tilt: [-0.4, 0] })),
      // the muzzle, broad and pale, the nostrils flared, the bronze ring through them
      ball(32, 19.4, 6, 4, hideLt), ball(32, 18, 4.4, 1.8, '#b08868'),
      ball(29.6, 20, 1.2, 0.9, '#1a0c08'), ball(34.4, 20, 1.2, 0.9, '#1a0c08'),
      sheet(oval(32, 22.6, 1.8, 1.4, 10), bronze), sheet(oval(32, 22.6, 1, 0.7, 8), hideLt),
      // small furious eyes under the brow
      limb(25.5, 11, 29.5, 12.6, 1.2, 1, hideDk), limb(38.5, 11, 34.5, 12.6, 1.2, 1, hideDk),
      dots([[27, 13], [37, 13]], '#ff4030'), specks([[27.5, 13.5], [37.5, 13.5]], '#ffb0a0')]),
      // scars across the chest, a notch in one horn
      hair(35, 26, 40, 31, '#3a2414'), specks([[12, 3], [12.5, 2.5]], '#23202c'),
    ];
  },

  // The Dread Lich: a skull under a horned helm, ornate shoulder plates trimmed
  // in gold, a skull worn on the chest, crimson robes falling in folds to the
  // floor, and its staff, an iron claw round a cold blue stone.
  lich: (pose = 'idle') => {
    const atk = pose === 'windup', cast = pose === 'special';
    const crimson = '#6a1218', crimsonDk = '#3a080c', crimsonLt = '#9a2a2a', black = '#18121a', bone = '#e4dccc', boneDk = '#a89e88';
    const gold = '#c89a3a', goldLt = '#f0d070', steel = '#9ea4b2', steelLt = '#e8ecf4', wood = '#4a3626', ice = '#40e8ff';
    return [
      // the staff, behind the right hand: dark wood bound in iron, the claw, the stone, its cold light
      limb(46, 6, 46, 61.5, 0.8, 0.9, wood), ...[20, 38, 52].map(y => line(45, y, 47, y, '#5a5e6a')),
      limb(44.4, 6.4, 43.6, 1.6, 0.45, 0.3, '#4a4458'), limb(47.6, 6.4, 48.4, 1.6, 0.45, 0.3, '#4a4458'), limb(46, 6.6, 46, 1, 0.4, 0.3, '#4a4458'),
      ball(46, 3.6, 2.3, 2.3, ice, { glows: true }), ball(45.3, 2.9, 1, 1, '#e0ffff', { glows: true }), dots([[45, 3]], '#ffffff'),
      specks([[42.5, 1.5], [49.5, 4], [43, 6.5], [49, 0.5], [41.5, 4]], '#9af4ff'),
      // the robes, black beneath, crimson over, to the floor in deep folds
      sheet([[18, 30], [46, 30], [53, 62], [11, 62]], black, { curve: 1 }),
      sheet([[20, 34], [44, 34], [50, 61], [46, 62.6], [40, 61.2], [34, 62.8], [28, 61.2], [22, 62.6], [14, 61]], crimson, { curve: 1 }),
      ...[[22, 38, 17, 61], [27, 38, 24, 62], [32.5, 38, 33, 62.5], [38, 38, 40, 62], [42, 38, 47, 61]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.4, y0], [x1 + 1.2, y1], [x1 - 1, y1]], crimsonDk, { curve: 0.3 })),
      ...[[24.5, 38, 20.5, 61], [35, 38, 36.5, 61.5]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1, y0], [x1 + 1, y1], [x1 - 0.6, y1]], crimsonLt, { curve: 0.3 })),
      specks([[12.5, 61.5], [16, 61], [47, 61], [51, 61.5], [9.5, 58], [54, 57]], '#c8f0ff'),
      // the belt and the tassets hanging from it, studded and trimmed
      sheet([[21, 32], [43, 32], [43, 35], [21, 35]], black, { curve: 0.8 }), line(21, 33.5, 43, 33.5, gold),
      ...[23, 27, 31, 35, 39].map(x => sheet([[x, 35], [x + 3.4, 35], [x + 3, 43], [x + 0.4, 43]], crimsonDk, { curve: 0.5 })),
      ...[23, 27, 31, 35, 39].flatMap(x => [hair(x + 0.6, 36, x + 0.6, 42.5, gold), specks([[x + 1.7, 37], [x + 1.7, 39.5], [x + 1.7, 42]], goldLt)]),
      // the breastplate, dark and trimmed in gold, a skull worn at its heart
      sheet([[20, 15], [44, 15], [44, 32], [20, 32]], black, { curve: 1 }),
      sheet([[23, 16], [41, 16], [40, 26], [32, 29.5], [24, 26]], crimson, { curve: 1 }),
      hair(23.5, 16.5, 32, 29, gold), hair(40.5, 16.5, 32, 29, gold), hair(23, 26.5, 41, 26.5, gold),
      ball(32, 21, 3, 3.1, bone), ball(32, 23.6, 2, 1.2, boneDk),
      dots([[31, 21], [33, 21]], '#100a10'), specks([[31.5, 23.5], [32.5, 23.5], [32, 22.5]], '#3a2a2a'),
      // the shoulders: great plates, crimson and gold, flared and spiked
      ...both64(ball(20, 16.5, 6.5, 4.6, crimson)),
      ...both64(sheet([[13.5, 17], [19, 11.5], [26.5, 13.5], [24, 20], [15.5, 21]], crimsonLt, { curve: 0.7 })),
      ...both64(hair(14, 18.5, 25, 12.75, goldLt)), ...both64(hair(15, 20.5, 24, 19.5, gold)),
      ...both64(sheet([[14.5, 13.5], [12, 8.5], [17, 12]], gold)), ...both64(sheet([[18.5, 12], [17.5, 8], [21, 11.5]], gold)),
      // the left arm down, the gauntlet resting on the robe
      ...(atk ? [// a bolt gathering: the left hand flung up, cold light breaking from it
        limb(17.5, 20, 11.5, 16, 2.8, 2.5, crimson), line(8.8, 14, 12.4, 17.4, gold), ball(10, 13.4, 2.4, 2.2, steel), hair(9, 12.4, 11, 12.4, steelLt), ...[8.6, 10, 11.4].map(x => limb(x, 12.4, x - 0.4, 10.2, 0.5, 0.45, steel)),
        ball(10, 9, 3.4, 3.4, ice, { glows: true }), ball(10, 9, 1.6, 1.6, '#e0ffff', { glows: true }), specks([[5.6, 7.6], [14, 6.4], [7.6, 4], [12, 3], [5, 11.4], [14.6, 10.6], [10, 1.6]], '#9af4ff', { glows: true })] : cast ? [// the nova: the hand thrown high, the staff blazing, a ring of frost bursting out round it
        limb(17.5, 20, 13, 11, 2.8, 2.5, crimson), line(11, 11.6, 15, 12.2, gold), ball(12.6, 8.6, 2.4, 2.2, steel), ...[11.2, 12.6, 14].map(x => limb(x, 7.4, x + (x - 12.6) * 0.6, 4.4, 0.5, 0.45, steel)),
        ball(46, 3.6, 4, 4, ice, { glows: true }), ball(46, 3.6, 2, 2, '#e0ffff', { glows: true }), ball(12.6, 4.4, 1.8, 1.8, ice, { glows: true }),
        ...Array.from({ length: 18 }, (_, i) => i / 18 * Math.PI * 2).map(t => ball(32 + Math.cos(t) * 28, 48 + Math.sin(t) * 8, 1.3, 1, ice, { glows: true }))] : [limb(17.5, 20, 16.5, 31, 2.8, 2.5, crimson), line(14.5, 31.5, 18.5, 31.5, gold), ball(16.5, 33.5, 2.4, 2.2, steel), hair(15.5, 32.5, 17.5, 32.5, steelLt),
      ...[15.1, 16.5, 17.9].map(x => limb(x, 34.5, x - 0.2, 36.7, 0.5, 0.45, steel))]),
      // the right arm, the gauntlet closed on the staff
      limb(46.5, 20, 46, 30, 2.8, 2.5, crimson), line(44, 31, 48, 31, gold),
      ball(46, 33.5, 2.4, 2.2, steel), hair(44.5, 32.5, 47.5, 32.5, steelLt), ...[33, 34.2, 35.4].map(y => hair(44, y, 48, y, '#5a606c')),
      // the skull: deep sockets with a cold light in them, a broken nose, a full grin
      ball(32, 9, 4.4, 4.8, bone),
      ball(32, 12.8, 3.2, 1.8, boneDk),
      ball(30, 9, 1.5, 1.4, '#140c14'), ball(34, 9, 1.5, 1.4, '#140c14'),
      dots([[30, 9], [34, 9]], ice), specks([[30.5, 9.5], [34.5, 9.5]], '#e0ffff'),
      sheet([[31.3, 11.4], [32.7, 11.4], [32, 10]], '#2a1e20'),
      ...[30, 31, 32, 33, 34].map(x => hair(x, 12.5, x, 14, '#5a5246')), hair(29.75, 13.25, 34.25, 13.25, '#5a5246'),
      hair(28.5, 6.5, 29.5, 8, boneDk), hair(35.5, 6.5, 34.5, 8, boneDk),
      // the horned helm over it, a crest of gold
      sheet([[27.2, 8], [27.8, 4.4], [30, 2.6], [34, 2.6], [36.2, 4.4], [36.8, 8], [34.5, 6.4], [29.5, 6.4]], steel, { curve: 0.8 }),
      hair(28.5, 4, 32, 2.75, steelLt), line(32, 2.6, 32, 6.4, gold), sheet([[30.5, 4.5], [33.5, 4.5], [32, 6.2]], gold),
      ...both64(limb(27.8, 5.5, 24.5, 3.5, 0.9, 0.7, '#d8ccb0')), ...both64(limb(24.5, 3.5, 23.6, 0.8, 0.7, 0.3, '#e8e0cc')),
      // the cold kindling in its sockets as it strikes or casts
      ...(atk || cast ? [ball(30, 9, 1.2, 1.1, ice, { glows: true }), ball(34, 9, 1.2, 1.1, ice, { glows: true })] : []),
    ];
  },
  ...FOLK,
};


// Other pictures of a creature, painted from the same parts with a pose
// given: 'windup' while a blow is drawn back, 'special' while its own trick
// is readied. Without a 'special' the wind-up serves for both.
const POSES = { drow_warrior: ['windup', 'special'], drow_mage: ['windup', 'special'], grey_dwarf: ['windup', 'special'], dwarf_arbalest: ['windup', 'special'], lizardfolk: ['windup', 'special'], lizard_shaman: ['windup', 'special'], heartforged: ['windup'], emberling: ['windup'], kobold: ['windup'], mimic: ['windup'], basilisk: ['windup', 'special'], rustmaw: ['windup'], hound: ['windup', 'special'], quillback: ['windup', 'special'], wyrm: ['windup', 'special'], dog: ['windup', 'sit'], wolf: ['windup', 'sit'], scrag: ['windup', 'sit'], sellsword: ['windup', 'sit'], renegade: ['windup', 'sit'], mender: ['windup', 'sit', 'heal'], goblin: ['windup'], orc: ['windup'], archer: ['windup', 'special'], skeleton: ['windup'], ogre: ['windup'], minotaur: ['windup'], troll: ['windup'], rat: ['windup'], bat: ['windup'], slime: ['windup'], spider: ['windup'], zombie: ['windup'], ghoul: ['windup'], drowned: ['windup'], eyeless: ['windup'], puffcap: ['windup'], shade: ['windup'], wraith: ['windup', 'special'], warlord: ['windup'], acolyte: ['windup', 'special'], lich: ['windup', 'special'] };

// The hero's own hand, seen from behind at the bottom of the view: a fist
// on a sleeve, gloved as each class goes armed. It holds the weapon drawn
// over it, and rises into view to cast.
// Creatures that hover, and so cast no shadow on the floor.
const FLOATING = new Set(['bat', 'wraith', 'lich', 'wisp', 'duelist_ghost', 'shade']);

// Struck, a creature flinches: everything above its hips jolts back from the
// blow and its head snaps back further, while its feet stay planted; one that
// flies is knocked bodily askew in the air. Drawn for a moment after the white
// of the hit (see renderState in game.js), for every creature with poses, its
// champions too. The side it reels to is its own, so a pack does not reel as one.
// Eyes shut: what is small and bright (or glows) on a head, and the pupils and
// glints inside it, are covered by the colour of what they were drawn on: a
// blink, and the screwed-shut eyes of a creature struck.
const lumOf = c => { const n = parseInt(c.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
const darker = c => { const n = parseInt(c.slice(1), 16), f = v => Math.round(v * 0.62).toString(16).padStart(2, '0'); return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`; };
const eyesShut = parts => {
  // (a head is a ball, or a sheet, drawn before the eye and under its point)
  const under = (i, x, y) => {
    for (let j = i - 1; j >= 0; j--) {
      const q = parts[j];
      if (q.k === 'ball' && q.rx >= 2.6 && ((x - q.x) / q.rx) ** 2 + ((y - q.y) / q.ry) ** 2 <= 1) return q;
      if (q.k === 'sheet' && q.pts.length > 2) {
        const xs = q.pts.map(v => v[0]), ys = q.pts.map(v => v[1]);
        if (x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys) && Math.max(...xs) - Math.min(...xs) > 5) return q;
      }
    }
    return null;
  };
  const small = q => (q.k === 'ball' && q.rx <= 2.6 && q.ry <= 2.2) || q.k === 'dots' || (q.k === 'specks' && q.pts.length <= 4);
  const bright = q => q.glows || lumOf(q.c) > 0.55;
  const eyes = [];
  parts.forEach((q, i) => {
    if (!small(q) || !bright(q)) return;
    const pts = q.k === 'ball' ? [[q.x, q.y]] : q.pts;
    for (const [x, y] of pts) { const head = under(i, x, y); if (head && !head.glows && lumOf(head.c) < lumOf(q.c)) eyes.push({ x, y, r: q.k === 'ball' ? Math.max(q.rx, 1.2) + 0.6 : 1.6, c: head.c }); }
  });
  if (!eyes.length) return null;
  const near = (x, y) => eyes.find(e => Math.abs(x - e.x) <= e.r && Math.abs(y - e.y) <= e.r);
  const out = [];
  for (const q of parts) {
    if (!small(q)) { out.push(q); continue; }
    if (q.k === 'ball') { const e = near(q.x, q.y); if (e) { out.push({ ...q, c: e.c, glows: false, rx: q.rx * 1.15, ry: Math.max(0.5, q.ry * 0.5) }); continue; } out.push(q); continue; }
    const keep = q.pts.filter(([x, y]) => !near(x, y)), shut = q.pts.filter(([x, y]) => near(x, y));
    if (keep.length) out.push({ ...q, pts: keep });
    for (const [x, y] of shut) out.push({ k: 'dots', pts: [[x, y]], c: near(x, y).c });
  }
  // and the line of each shut lid
  for (const e of eyes) out.push(hair(e.x - e.r * 0.8, e.y + 0.25, e.x + e.r * 0.8, e.y + 0.25, darker(e.c)));
  return out;
};
const REEL_LEFT = new Set(['rat', 'basilisk', 'rustmaw', 'quillback', 'mimic', 'slime', 'puffcap', 'zombie', 'ghoul', 'orc', 'spider', 'dog', 'wolf']);
const flinch = (parts0, k) => {
  const parts = eyesShut(parts0) || parts0;
  const ys = parts.map(p => midOf(p)[1]), top = Math.min(...ys), bot = Math.max(...ys), span = bot - top;
  const deg = REEL_LEFT.has(k) ? -1 : 1;
  if (FLOATING.has(k)) { const mid = top + span * 0.5; return turn(grow(parts, 32, mid, 1.05, 0.93), 32, mid, 10 * deg); }
  const hip = top + span * 0.62, neck = top + span * 0.24;
  const [nx, ny] = turn([ball(32, neck, 1, 1, '#000')], 32, hip, 9 * deg).map(q => [q.x, q.y])[0];
  return parts.map(p => {
    const y = midOf(p)[1];
    if (y >= hip) return p;
    const q = turn([p], 32, hip, 9 * deg)[0];
    return y < neck ? turn([q], nx, ny, 8 * deg)[0] : q;
  });
};
// Walking, a creature strides: one side's legs lifted, more at the foot than at
// the hip, the other side's planted, the body leaning a touch over them; drawn
// in turn as it crosses a square (see renderState in game.js). Side on, as the
// rat is, its near side is its front legs, so the pairs alternate as a gait. A
// bat beats its wings instead (drawn all the while it is aloft), a slime
// heaves itself along, and a wraith, a shade or the lich only drifts.
const STEPS = ['stepA', 'stepB'];
const OWN_STEPS = new Set(['bat']);
const stride = (parts, k, pose) => {
  if (k === 'slime') return pose === 'stepA' ? grow(parts, 32, 62, 1.08, 0.91) : grow(parts, 32, 62, 0.94, 1.07);
  const ys = parts.map(p => midOf(p)[1]), top = Math.min(...ys), bot = Math.max(...ys), span = bot - top, hip = top + span * 0.62;
  const left = pose === 'stepA', lift = span * 0.12;
  return parts.map(p => {
    const [x, y] = midOf(p);
    if (y < hip) return turn([p], 32, hip, left ? 2 : -2)[0];
    if ((x < 32) !== left) return p;
    const u = Math.min(1, (y - hip) / Math.max(1, bot - hip));
    return nudge([p], (left ? -1 : 1) * lift * 0.2 * u, -lift * u)[0];
  });
};
// a creature with eyes to shut blinks now and then (see renderState in game.js)
for (const k in POSES) {
  const f = CREATURES[k], walks = !FLOATING.has(k) || OWN_STEPS.has(k), blinks = !!eyesShut(f());
  CREATURES[k] = (pose = 'idle') => (pose === 'hurt' ? flinch(f(), k) : pose === 'blink' ? eyesShut(f()) || f() : STEPS.includes(pose) && !OWN_STEPS.has(k) ? stride(f(), k, pose) : f(pose));
  POSES[k].push('hurt', ...(walks ? STEPS : []), ...(blinks ? ['blink'] : []));
}

export { STEPS, eyesShut, flinch, stride, SHADE_GEAR, PORTRAITS, CHAMPIONS, CHAMPION_OF, CREATURES, POSES, PROPS, FLOATING, gridOf, paintParts, up2, ball, limb, sheet, line, dots, specks, hair, both };
