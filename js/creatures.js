// Creatures built from lit parts instead of hand-typed pixel grids.
//
// Each creature is a list of shapes drawn back to front on a 32x32 grid: balls
// (heads, bellies, joints) shaded as spheres, limbs as tapered cylinders,
// sheets (cloaks, wings, ears) as gently curved planes, and single pixels for
// the details that make a face. The painter in assets.js lights every shape
// from the upper left, picks its tone from a ramp that cools into shadow and
// warms into light, and draws a contact line wherever a part passes in front
// of another, so a limb reads as in front of the body rather than merged with
// it. The floor is row 31.

/** @typedef {[number, number]} Pt */

// Part constructors. Colours are base tones; the painter derives the ramp.
const ball = (x, y, rx, ry, c, o = {}) => ({ k: 'ball', x, y, rx, ry: ry == null ? rx : ry, c, ...o });
const limb = (x1, y1, x2, y2, r1, r2, c, o = {}) => ({ k: 'limb', x1, y1, x2, y2, r1, r2: r2 == null ? r1 : r2, c, ...o });
const sheet = (pts, c, o = {}) => ({ k: 'sheet', pts, c, ...o });
const line = (x1, y1, x2, y2, c, o = {}) => ({ k: 'line', x1, y1, x2, y2, c, ...o });
/** exact pixels, unlit: eyes, teeth, glints */
const dots = (pts, c, o = {}) => ({ k: 'dots', pts, c, ...o });
/** exact pixels on the fine grid (half units of the 32-grid): claws, stitches, rivets, glints */
const specks = (pts, c, o = {}) => ({ k: 'specks', pts, c, ...o });
/** a hairline on the fine grid: seams, cracks, veins, fur strokes */
const hair = (x1, y1, x2, y2, c, o = {}) => ({ k: 'hair', x1, y1, x2, y2, c, ...o });
/** mirror a part across the sprite's centre line (x = 15.5) */
const mirror = p => {
  const m = x => 31 - x;
  if (p.k === 'ball') return { ...p, x: m(p.x) };
  if (p.k === 'limb' || p.k === 'line') return { ...p, x1: m(p.x1), x2: m(p.x2) };
  if (p.k === 'sheet' || p.k === 'dots') return { ...p, pts: p.pts.map(([x, y]) => [m(x), y]) };
  // the fine grid mirrors about the same centre, a half unit over
  if (p.k === 'specks') return { ...p, pts: p.pts.map(([x, y]) => [31.5 - x, y]) };
  if (p.k === 'hair') return { ...p, x1: 31.5 - p.x1, x2: 31.5 - p.x2 };
  return p;
};
const both = p => [p, mirror(p)];
// The lifelike figures are designed on a grid twice as fine, 64 units across
// (see gridOf): there, a mirror is across x = 31.5
const m64 = p => {
  const m = x => 63 - x;
  if (p.k === 'ball') return { ...p, x: m(p.x) };
  if (p.k === 'limb' || p.k === 'line') return { ...p, x1: m(p.x1), x2: m(p.x2) };
  if (p.k === 'sheet' || p.k === 'dots') return { ...p, pts: p.pts.map(([x, y]) => [m(x), y]) };
  if (p.k === 'specks') return { ...p, pts: p.pts.map(([x, y]) => [63.5 - x, y]) };
  if (p.k === 'hair') return { ...p, x1: 63.5 - p.x1, x2: 63.5 - p.x2 };
  return p;
};
const both64 = p => [p, m64(p)];
/** A part drawn on the 32-unit grid, set on the 64-unit one beside a lifelike figure. */
const up2 = p => {
  const d = v => v * 2;
  if (p.k === 'ball') return { ...p, x: d(p.x), y: d(p.y), rx: d(p.rx), ry: d(p.ry) };
  if (p.k === 'limb') return { ...p, x1: d(p.x1), y1: d(p.y1), x2: d(p.x2), y2: d(p.y2), r1: d(p.r1), r2: d(p.r2) };
  if (p.k === 'line' || p.k === 'hair') return { ...p, x1: d(p.x1), y1: d(p.y1), x2: d(p.x2), y2: d(p.y2) };
  return { ...p, pts: p.pts.map(([x, y]) => [d(x), d(y)]) };
};
// Which creatures are drawn lifelike, on the finer grid: a human's proportions,
// layered cloth falling in folds, armour, hands and faces, where the rest are
// still the stockier figures of the 32-unit grid
const FINE_GRID = new Set(['lich', 'acolyte', 'skeleton', 'warlord', 'heartforged', 'sellsword', 'mender',
  'goblin', 'orc', 'zombie', 'ghoul', 'wraith',
  // (and the encounter props that are one of them, waiting)
  'hireling', 'stray_healer', 'goblin_toll']);
/** The grid a creature or prop is designed on: 64 units for the lifelike ones, else 32. */
const gridOf = k => (FINE_GRID.has(k) ? 64 : 32);

/** The points of an oval, for a flat sheet in that shape. */
const oval = (cx, cy, rx, ry, n = 14) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * rx, cy + Math.sin(i / n * Math.PI * 2) * ry]);

/**
 * A part cut into the rows of the grid, only the rows `keep` allows left
 * standing: what remains of a thing half gone out of the world. Each run of
 * a kept row becomes a thin rod of the part's colour, so the gaps fall true
 * to the pixel at either painting.
 * @param {any} p  a ball, limb or sheet
 * @param {(row: number) => boolean} keep
 * @param {number | ((row: number) => number)} [shift]  how far each kept row slides:
 *   alternate rows either way by this much, or by row as a function says
 */
const slats = (p, keep, shift = 0) => {
  const inside = (x, y) => {
    if (p.k === 'ball') return ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1;
    if (p.k === 'sheet') return insidePoly(p.pts, x, y);
    const ax = p.x2 - p.x1, ay = p.y2 - p.y1, L2 = ax * ax + ay * ay || 1;
    const t = Math.max(0, Math.min(1, ((x - p.x1) * ax + (y - p.y1) * ay) / L2));
    return Math.hypot(x - p.x1 - ax * t, y - p.y1 - ay * t) <= Math.max(p.r1 + (p.r2 - p.r1) * t, 0.55);
  };
  const out = [];
  for (let r = 0; r < 32; r++) {
    if (!keep(r)) continue;
    const y = r + 0.5, dx = typeof shift === 'function' ? shift(r) : r % 2 ? shift : -shift;
    let a = -1;
    for (let c = 0; c <= 32; c++) {
      const on = c < 32 && inside(c + 0.5, y);
      if (on && a < 0) a = c;
      if (!on && a >= 0) { out.push(limb(a + 0.5 + dx, y, c - 0.5 + dx, y, 0.55, 0.55, p.c, { smooth: 1 })); a = -1; }
    }
  }
  return out;
};

// The freed goblin's head, the same in the cage and at your heel: a ragged
// hood with its peak flopped over, knife ears poking out from under it, big
// bright eyes that never stop looking about, and a grin up one side.
// `look` sends the eyes left (-1), right (1) or straight at you (0);
// `mouth` is 'grin', or 'teeth' when it means business.
const scragHead = (x, y, { look = 1, mouth = 'grin' } = {}) => {
  const skin = '#72ac4c', dark = '#46742f', rag = '#80705c', ex = Math.round(x), ey = Math.round(y);
  const eye = '#ffd84a', pupil = '#1a1010';
  const pupils = look > 0 ? [[ex - 2, ey], [ex + 2, ey]] : look < 0 ? [[ex - 3, ey], [ex + 1, ey]] : [[ex - 2, ey], [ex + 1, ey]];
  return [
    // the hood behind the head, close about it, its peak gone limp and
    // fallen over to one side
    sheet([[x - 5.4, y + 3.2], [x - 5.8, y - 1], [x - 5.2, y - 4], [x - 5.6, y - 6.6], [x - 7.6, y - 8.6], [x - 8.4, y - 7.2], [x - 6.4, y - 8.8],
      [x - 3.4, y - 7.6], [x - 1, y - 6.2], [x + 2, y - 6], [x + 4.4, y - 5], [x + 5.8, y - 2.6], [x + 5.4, y + 3.2]], rag, { curve: 1 }),
    // the dark inside of the hood, round the face
    ball(x, y - 0.4, 5.3, 4.9, '#3a302a'),
    // long ears out through the rag, pink inside, the left one nicked
    sheet([[x - 4, y - 1.4], [x - 11.2, y - 3.8], [x - 9.6, y - 1.6], [x - 10.4, y - 1.2], [x - 9, y - 0.4], [x - 4, y + 1.8]], skin, { tilt: [-0.5, -0.2] }),
    sheet([[x + 4, y - 1.4], [x + 11.2, y - 3.8], [x + 9.4, y - 1.2], [x + 4, y + 1.8]], skin, { tilt: [0.5, -0.2] }),
    sheet([[x - 4.6, y - 0.6], [x - 9, y - 2.6], [x - 4.6, y + 1]], '#c07860'),
    sheet([[x + 4.6, y - 0.6], [x + 9, y - 2.6], [x + 4.6, y + 1]], '#c07860'),
    ball(x, y, 4.6, 4.1, skin),
    // the hood's brim pulled low over the brow
    sheet([[x - 5.3, y - 0.6], [x - 4.2, y - 4], [x - 1, y - 5.1], [x + 2, y - 5], [x + 4.5, y - 3.8], [x + 5.3, y - 0.6],
      [x + 3.6, y - 2.4], [x, y - 3], [x - 3.6, y - 2.4]], rag, { curve: 1 }),
    // brows up, one higher than the other: curious, and up to something
    hair(x - 3.5, y - 1.5, x - 1.5, y - 2, dark), hair(x + 1, y - 1.5, x + 3, y - 1.5, dark),
    // a small sharp nose, and the cheek the grin pushes up
    ball(x + 2.6, y + 1.5, 1.3, 0.9, skin),
    limb(x, y - 0.4, x + 0.3, y + 1.2, 0.5, 0.8, skin),
    // big eyes, lit, the pupils off to one side
    dots([[ex - 3, ey - 1], [ex - 2, ey - 1], [ex - 3, ey], [ex - 2, ey], [ex + 1, ey - 1], [ex + 2, ey - 1], [ex + 1, ey], [ex + 2, ey]], eye),
    dots(pupils, pupil),
    mouth === 'teeth'
      ? sheet([[x - 2.8, y + 1.8], [x, y + 2.3], [x + 3, y + 1.4], [x + 2.4, y + 3.4], [x, y + 3.9], [x - 2.3, y + 3.3]], '#2a1010')
      : sheet([[x - 2.2, y + 2.3], [x, y + 2.6], [x + 2.4, y + 1.8], [x + 3.3, y + 1], [x + 2.9, y + 2.6], [x + 0.4, y + 3.4], [x - 1.8, y + 3]], '#2a1010'),
    mouth === 'teeth'
      ? dots([[ex - 2, ey + 2], [ex, ey + 2], [ex + 2, ey + 2], [ex - 1, ey + 3], [ex + 1, ey + 3]], '#f0e6c8')
      : dots([[ex + 1, ey + 2]], '#f0e6c8'),
  ];
};

const CREATURES = {
  // A goblin: small, wiry and stooped, all knees and elbows, its great ears
  // swept back, a long hooked nose over a grin of crooked teeth, a ragged tunic
  // belted with cord, and a notched knife held low.
  goblin: () => {
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
      limb(24.5, 28, 20, 37, 1.9, 1.6, skin), limb(20, 37, 19, 45, 1.6, 1.4, skin),
      ball(19, 46.4, 1.9, 1.7, skin), ...[17.6, 19, 20.4].map(x => limb(x, 47.5, x - 0.3, 50, 0.4, 0.3, skin)),
      limb(39.5, 28, 45, 35, 1.9, 1.6, skin), limb(45, 35, 47, 41, 1.6, 1.4, skin),
      limb(48, 41, 54, 30, 0.9, 0.5, steel, { smooth: 1 }), hair(48.5, 40, 53.5, 31, '#f0f2f6'), specks([[51.5, 34.5], [52.5, 33]], '#5a5e66'),
      limb(46.4, 43, 48.4, 40, 0.7, 0.7, '#5a3a20'), ball(47, 41.6, 1.9, 1.7, skin),
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
      sheet([[26.5, 23.4], [32, 25], [37.5, 23.4], [36, 26.4], [32, 27.4], [28, 26.4]], '#2a1010'),
      dots([[28, 24], [30, 24], [33, 25], [35, 24]], '#e8dcb8'), ball(32, 26.4, 1.6, 0.6, '#6a2424'),
      // warts, a nick in the scalp, the knuckles
      specks([[27.5, 13], [36, 13.5], [30.5, 11.5], [37.5, 21]], skinDk), hair(33, 11.5, 34.5, 13.5, '#2f5220'),
    ];
  },

  // The Goblin Warlord: a goblin grown huge on the Warrens' plunder, thick in
  // the neck and arms, great notched ears, a crown of hammered gold with a red
  // stone, a coat of gilded scales, spiked gold pauldrons, a red cloak, the
  // war-drum at his hip and a cleaver raised in his fist.
  warlord: () => {
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
      limb(46, 25, 51, 31, 3.6, 3.2, skin), limb(51, 31, 54, 21, 3, 2.6, skin),
      limb(54.5, 22, 55.5, 2, 1.1, 1.1, '#5a3a20'),
      sheet([[53.5, 0.6], [63, 1.2], [62.4, 13], [54.2, 11.4]], steel, { tilt: [0.5, -0.1] }),
      line(62.6, 1.8, 62.2, 12.4, steelLt), sheet([[54.5, 7], [56, 7], [56, 11.6], [54.5, 11.4]], '#6a1818'),
      ball(54, 21, 2.9, 2.8, skin), hair(52.5, 20, 55.5, 20, skinDk),
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
      sheet([[25, 18], [32, 19.6], [39, 18], [37, 21.6], [32, 22.6], [27, 21.6]], '#2a1010'),
      dots([[28, 19], [30, 19], [34, 19], [36, 19]], '#f0e6c8'),
      sheet([[26.4, 21], [27.8, 21.4], [26.6, 17.6]], '#f0e6c8'), sheet([[37.6, 21], [36.2, 21.4], [37.4, 17.6]], '#f0e6c8'),
      // a scar across the brow, warts, the light along the nose
      hair(26, 8, 30, 12.5, '#2f5220'), specks([[38.5, 15.5], [25.5, 16], [34.5, 8.5]], skinDk),
      hair(31.5, 12, 31.5, 15, skinLt),
    ];
  },

  // A skeleton: a man's bones held together by nothing, a ribcage over an empty
  // belly, a rag of a loincloth rotting on it, and a rusted sword raised.
  skeleton: () => {
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
      limb(24.4, 18.5, 23, 27, 0.9, 0.8, bone), ball(23, 27.4, 1.1, 1, boneDk),
      limb(23, 27.8, 22.6, 35, 0.75, 0.6, bone), limb(23.6, 28, 23.4, 34.6, 0.4, 0.35, boneDk),
      ...[[21.6, 36.2, 21.2, 38.6], [22.6, 36.6, 22.6, 39.2], [23.6, 36.2, 23.9, 38.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.35, 0.3, bone)),
      ball(22.7, 35.6, 1, 0.9, bone),
      // the right arm raised, the rusted sword held up in it
      limb(39.6, 18.5, 42.5, 26, 0.9, 0.8, bone), ball(42.6, 26.4, 1.1, 1, boneDk),
      limb(42.6, 26.4, 44.6, 21.8, 0.75, 0.6, bone),
      limb(44.8, 2.5, 44.8, 19.6, 0.8, 0.6, steel, { smooth: 1 }), hair(44.5, 3.5, 44.5, 19, steelLt),
      sheet([[44.8, 0.6], [45.6, 2.8], [44, 2.8]], steel),
      specks([[45, 7], [44.5, 11.5], [45.25, 14], [44.75, 17]], rust),
      limb(41.4, 20.2, 48.2, 20.2, 0.7, 0.7, rust), limb(44.8, 21, 44.8, 25, 0.6, 0.6, grip), ball(44.8, 25.8, 0.9, 0.9, rust),
      ball(44.6, 22.4, 1.3, 1.2, bone), ...[21.6, 22.6, 23.6].map(y => hair(43.5, y, 45.75, y, boneSh)),
      // the skull: deep sockets, a pinprick of red in each, the nose a hole, the teeth bared
      limb(32, 13, 32, 16, 0.8, 0.8, boneDk),
      ball(32, 8, 3.7, 4.3, bone), ball(32, 12.3, 2.6, 1.4, boneDk),
      ball(30.4, 8.2, 1.15, 1.1, '#120c10'), ball(33.6, 8.2, 1.15, 1.1, '#120c10'),
      dots([[30, 8], [33, 8]], '#e03020'),
      sheet([[31.4, 10.6], [32.6, 10.6], [32, 9.4]], '#2a2220'),
      ...[30.5, 31.5, 32.5, 33.5].map(x => hair(x, 11.75, x, 13, boneSh)), hair(30, 12.25, 34, 12.25, boneSh),
      hair(29, 5, 30, 6.5, boneDk), hair(34.5, 4.5, 35, 6, boneDk),
    ];
  },

  // Low and wide, all legs: a bloated abdomen with a warning mark behind a
  // small head bristling with eyes.
  spider: () => {
    const shell = '#4a3e60', leg = '#5a4a72';
    const legs = [];
    const roots = [[12, 22], [11.5, 23.5], [12, 25], [12.5, 26.5]];
    const knees = [[6, 14.5], [3.5, 18.5], [3.5, 23], [6, 26]];
    const feet = [[2, 22], [0.8, 26.5], [1.2, 30.5], [5, 31]];
    for (let i = 0; i < 4; i++) {
      legs.push(...both(limb(roots[i][0], roots[i][1], knees[i][0], knees[i][1], 0.85, 0.7, leg)));
      legs.push(...both(limb(knees[i][0], knees[i][1], feet[i][0], feet[i][1], 0.7, 0.5, leg)));
      legs.push(...both(ball(knees[i][0], knees[i][1], 0.95, 0.95, '#6e5c8a')));
    }
    const out = [
      ...legs.slice(0, 6 * 2),
      ball(16, 19.5, 7.8, 6.6, shell),
      // the warning mark, an hourglass: two lit triangles rather than red
      // pixels, which the painter took for eyes and glinted every one of
      sheet([[13.6, 15.5], [18.4, 15.5], [16, 18.4]], '#c02828', { tilt: [-0.2, -0.3] }),
      sheet([[16, 17.6], [18.4, 20.7], [13.6, 20.7]], '#c02828', { tilt: [-0.2, 0.1] }),
      ...legs.slice(6 * 2),
      ball(16, 25.5, 4.4, 3.4, '#4e4264'),
      // a big pair of eyes in front, smaller ones stepping out round them
      dots([[15, 24], [17, 24]], '#ff3030'),
      dots([[14, 23], [18, 23], [13, 25], [19, 25]], '#b01818'),
      dots([[15, 28], [17, 28], [15, 29], [17, 29]], '#e8e0d0'),
    ];
    // a hard, glossy shell: the painter's grain on it read as dust, not chitin
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // Side on, so it reads as a rat and not a box with ears: long body, pointed
  // snout, naked tail curling up behind.
  rat: () => {
    const fur = '#8a6a48', pink = '#d89a96';
    return [
      limb(24, 26.5, 29.5, 22.5, 0.7, 0.5, pink), limb(29.5, 22.5, 28.5, 18, 0.5, 0.4, pink),
      limb(20, 27, 21, 30.5, 1, 0.8, '#6a4e34'), limb(12, 27, 11.5, 30.5, 1, 0.8, '#6a4e34'),
      ball(18, 25, 7.8, 4.6, fur),
      ball(22, 23.5, 3.5, 2.5, '#9a7a56'),
      limb(15, 27.5, 14.5, 30.5, 1, 0.8, fur), limb(23, 27.5, 24, 30.5, 1.1, 0.9, fur),
      ball(14.5, 30.6, 1.4, 0.7, pink), ball(24, 30.6, 1.4, 0.7, pink),
      ball(10, 20.5, 1.7, 2, fur), ball(12.5, 20.3, 1.6, 1.9, fur),
      ball(10, 20.7, 0.9, 1.2, pink), ball(12.5, 20.5, 0.8, 1.1, pink),
      ball(9, 24, 4.2, 3.3, fur),
      ball(4.8, 25.2, 2.3, 1.7, '#9a7a58'),
      dots([[2, 25], [3, 25]], '#e87080'),
      dots([[7, 23], [8, 23]], '#ff3030'), dots([[8, 23]], '#1a0c0c'), dots([[7, 22]], '#ffd0c0'),
      dots([[4, 27], [5, 27]], '#f4ecd8'),
      line(3, 24, 0, 23, '#cfc4b0'), line(3, 26, 0, 27, '#cfc4b0'),
    ];
  },

  // Spread wide on ribbed wings, which is how a bat is seen when it comes at you.
  bat: () => {
    const body = '#4e4262', wing = '#3a3050', rib = '#6e5f8a';
    const w = sheet([[14, 12], [7, 7], [1, 6], [3, 9.5], [1, 12.5], [4.5, 13], [2.5, 17], [7, 15.5], [10, 18], [14, 17]], wing, { tilt: [-0.35, -0.1] });
    return [
      ...both(w),
      ...both(line(14, 13, 1, 6, rib)), ...both(line(13, 14, 1, 12, rib)), ...both(line(13, 15, 3, 17, rib)),
      ball(16, 14.5, 3.3, 4.3, body),
      ...both(sheet([[13.2, 8.5], [12.5, 4], [15, 7.5]], body, { tilt: [-0.3, -0.3] })),
      ball(16, 9.8, 3.1, 2.7, '#5a4c70'),
      dots([[14, 9], [18, 9]], '#ff3a3a'), dots([[14, 8], [18, 8]], '#ffc0b0'),
      dots([[15, 11], [17, 11]], '#f4ecd8'),
      ...both(limb(14.5, 18.5, 14, 20.5, 0.5, 0.4, rib)),
    ];
  },

  // A wobbling drop with a brighter core, bubbles caught inside and a face
  // pressed against the skin.
  slime: () => {
    const gel = '#3fb45a';
    return [
      ball(16, 24.5, 11, 7.3, gel),
      ball(14.5, 23.5, 6.5, 4.2, '#62d67a'),
      ball(26.5, 29, 2, 2.4, gel),
      ball(10, 25, 1.2, 1.2, '#9af0ac'), ball(20, 27.5, 0.9, 0.9, '#9af0ac'), ball(18.5, 21, 0.7, 0.7, '#b8ffc8'),
      dots([[9, 19], [10, 18], [11, 18], [12, 18], [8, 20]], '#e8ffee'),
      dots([[12, 23], [12, 24], [13, 23], [13, 24], [19, 23], [19, 24], [20, 23], [20, 24]], '#0e3016'),
      dots([[12, 23], [19, 23]], '#d8ffe0'),
      dots([[14, 27], [15, 28], [16, 28], [17, 28], [18, 27]], '#12401e'),
    ];
  },

  // A drowned one, risen out of the black water: bloated and grey-blue, lank
  // hair plastered over its face, weed hanging off it, both arms reaching for
  // you and water still running off it.
  drowned: () => {
    const skin = '#8a9ea4', dark = '#5e7078', rag = '#3e4a44', locks = '#1a2024', weed = '#3e5a2e';
    return [
      // legs sunk to the shin in the water, and the water about them
      limb(13, 23, 12.5, 29.5, 2.2, 1.9, dark), limb(19, 23, 19.5, 29.5, 2.2, 1.9, dark),
      ball(16, 30.2, 8.5, 1.5, '#1e2a34'), ball(16, 30.2, 6, 0.9, '#4e6878'),
      // a swollen body in what is left of a shirt
      ball(16, 18, 7, 6.8, skin),
      sheet([[9.5, 14], [22.5, 14], [23, 23], [20, 21.5], [17.5, 24], [15, 22], [12, 24], [9, 22.5]], rag, { curve: 1 }),
      // both arms out, reaching
      limb(10, 14.5, 5.5, 10.5, 2, 1.6, skin), ball(4.8, 9.8, 1.9, 1.7, skin),
      limb(22, 14.5, 26.5, 10.5, 2, 1.6, skin), ball(27.2, 9.8, 1.9, 1.7, skin),
      // the head, bloated and pale, hair plastered down it in wet strands
      ball(16, 9, 5, 5, skin), ball(15, 10.5, 3, 2.2, '#a2b4b8'),
      sheet([[11, 7.5], [12, 4], [16, 3], [20, 4], [21, 7.5], [19.5, 5.8], [16, 4.8], [12.5, 5.8]], locks, { curve: 0.8 }),
      limb(11.2, 6, 10.6, 13.5, 1, 0.5, locks), limb(20.8, 6, 21.4, 13.5, 1, 0.5, locks), limb(17.5, 5, 18.2, 11.5, 0.8, 0.4, locks),
      // dark drowned hollows for eyes, a pale gleam in one, and the mouth hanging open
      ball(14, 8.8, 1.3, 1.1, '#1e2428'), ball(18.3, 8.8, 1.1, 1, '#1e2428'), dots([[14, 9]], '#e8f0e8'),
      ball(16, 12.3, 1.5, 1.2, '#1a1418'),
      // weed draped over a shoulder and hanging from an arm
      limb(10.5, 13.5, 11, 19.5, 0.8, 0.5, weed), limb(22, 13, 23.5, 18, 0.7, 0.5, weed), limb(6, 11, 5.5, 15, 0.6, 0.4, weed),
      // fine work: water running off it, fingers, the grain of the drowned skin, hair strands
      specks([[4, 12], [4.5, 14.5], [27.5, 12.5], [28, 15], [12, 25.5], [20.5, 26], [16, 25]], '#b8d0dc'),
      specks([[3.5, 8.5], [5, 8], [6.5, 8.5], [25.5, 8.5], [27, 8], [28.5, 8.5]], '#a8bcc0'),
      hair(13, 17, 15, 19.5, '#6e8288'), hair(19, 16, 20, 19, '#6e8288'),
      hair(12, 5, 11.5, 11, '#2e363a'), hair(20, 5, 20.5, 11, '#2e363a'),
    ];
  },

  // A kobold trapper: small, scaled a rusty red, with a long snout full of
  // little teeth, stubby horns, a tail for balance, a dart up in one claw and
  // a coil of snare wire slung over its shoulder.
  kobold: (pose = 'idle') => {
    const scale = '#a8502e', dark = '#6e3018', belly = '#d89a62', horn = '#e8dcc0', leather = '#5a3a24', wire = '#b8c0c8';
    const throwing = pose === 'windup';
    return [
      // the tail, curling out behind and to one side (lashed up as it throws)
      limb(19, 26, 25, throwing ? 24 : 28, 1.6, 0.9, dark), limb(25, throwing ? 24 : 28, 28.5, throwing ? 19 : 25.5, 0.9, 0.4, dark),
      // legs bent like a lizard's, clawed feet
      limb(13.5, 23, 12, 27.5, 1.7, 1.4, scale), limb(12, 27.5, 13, 30.5, 1.4, 1.1, scale),
      limb(18.5, 23, 20, 27.5, 1.7, 1.4, scale), limb(20, 27.5, 19, 30.5, 1.4, 1.1, scale),
      ball(12.6, 30.7, 2, 0.9, dark), ball(19.4, 30.7, 2, 0.9, dark),
      // the body, a paler belly down the front, a scrap of leather at the hips
      ball(16, 19.5, 5, 5.2, scale),
      ball(16, 20.5, 3, 4, belly),
      sheet([[11.5, 22.5], [20.5, 22.5], [19.5, 25.5], [12.5, 25.5]], leather, { curve: 1 }),
      // the coil of wire over one shoulder and across the chest
      ball(11.5, 15.5, 2.6, 2.6, wire), ball(11.5, 15.5, 1.7, 1.7, '#3a3a40'),
      line(12.5, 17, 19.5, 22, wire),
      // arms: one at its side, one up with a dart (higher as it throws)
      // (swung out for balance as it throws)
      limb(11, 16.5, throwing ? 5.5 : 9, throwing ? 15 : 21.5, 1.3, 1.1, scale), ball(throwing ? 5 : 8.8, throwing ? 14.6 : 22, 1.2, 1.1, dark),
      limb(21, 16.5, 23.5, throwing ? 10 : 13, 1.3, 1.1, scale), ball(23.8, throwing ? 9.4 : 12.4, 1.2, 1.1, dark),
      limb(23.8, throwing ? 9.4 : 12.4, 25.5, throwing ? 5.5 : 8.5, 0.35, 0.25, '#c8ced8'),
      dots([[26, throwing ? 5 : 8]], '#e04a30'),
      // the head: a long snout, stubby horns swept back, a frill of spines
      limb(13.5, 9, 11, 6.5, 0.9, 0.4, horn), limb(18.5, 9, 21, 6.5, 0.9, 0.4, horn),
      ball(16, 11, 4.2, 3.8, scale),
      limb(16, 12.5, 16, 15.5, 2.2, 1.3, scale),
      ball(16, 15.8, 1.6, 1, dark),
      dots([[15, 16], [17, 16]], '#1a0808'),
      // a row of little teeth along the snout, eyes bright and slitted
      dots([[14.5, 14], [17.5, 14], [15, 15], [17, 15]], '#f2ead2'),
      ball(13.8, 10.5, 1.3, 1.1, '#f0d040'), ball(18.2, 10.5, 1.3, 1.1, '#f0d040'),
      dots([[14, 10], [18, 10], [14, 11], [18, 11]], '#1a0808'),
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
  // The emberling: a knot of cooling rock the size of a dog, crusted black and
  // split with cracks that glow like a forge, on four stubby legs, with two
  // ember eyes and little flames licking up off its back. Blazing up (its
  // windup), it hunches, the cracks go white-hot and the flames stand tall.
  emberling: (pose = 'idle') => {
    const hot = pose === 'windup';
    const crust = '#2e2624', crust2 = '#3e3430', glow = hot ? '#fff0b0' : '#f08a30', glow2 = hot ? '#ffd060' : '#c8501c', flame = hot ? '#ffe070' : '#ff9a30', flame2 = hot ? '#fff4c0' : '#ffd060';
    const dy = hot ? 1.2 : 0, sx = hot ? 1.06 : 1;
    const cx = 16, cy = 21 + dy;
    return [
      // stubby legs of rock, the far pair behind
      limb(10.5, 24 + dy, 9.6, 29.6, 1.6, 1.4, crust), limb(21.5, 24 + dy, 22.4, 29.6, 1.6, 1.4, crust),
      ball(9.4, 30, 2, 1, crust2), ball(22.6, 30, 2, 1, crust2),
      // the body: a lumpy boulder, wider than tall
      ball(cx, cy, 8 * sx, 6.2, crust), ball(cx - 4, cy - 3.6, 3.6, 3, crust2), ball(cx + 4.2, cy - 3.2, 3.4, 2.8, crust2),
      ball(cx, cy + 1.6, 4.4, 3.2, crust2),
      // the near pair of legs
      limb(13, 25 + dy, 12.4, 29.8, 1.5, 1.3, crust2), limb(19, 25 + dy, 19.6, 29.8, 1.5, 1.3, crust2),
      ball(12.2, 30.2, 1.9, 0.9, crust), ball(19.8, 30.2, 1.9, 0.9, crust),
      // the cracks, glowing: lines across the crust
      line(cx - 6, cy - 1, cx - 2, cy + 2, glow), line(cx - 2, cy + 2, cx + 1, cy - 1, glow), line(cx + 1, cy - 1, cx + 6, cy + 1.5, glow),
      line(cx - 3, cy - 4.5, cx - 1, cy - 2, glow2), line(cx + 3, cy - 4, cx + 4.5, cy - 1.5, glow2), line(cx - 1, cy + 3.5, cx + 2, cy + 5, glow2),
      // two ember eyes low on the front
      ball(cx - 2.6, cy + 3.4, 1.4, 1.1, '#141010'), ball(cx + 2.6, cy + 3.4, 1.4, 1.1, '#141010'),
      dots([[cx - 3, Math.floor(cy + 3.2)], [cx - 2, Math.floor(cy + 3.2)], [cx + 2, Math.floor(cy + 3.2)], [cx + 3, Math.floor(cy + 3.2)]], hot ? '#ffffff' : '#ffd060'),
      // flames licking up off its back, taller when it blazes
      sheet([[cx - 5, cy - 5], [cx - 4.2, cy - (hot ? 13 : 9)], [cx - 3, cy - 5.6]], flame, { curve: 0.4 }),
      sheet([[cx - 1.4, cy - 5.6], [cx + 0.2, cy - (hot ? 15 : 11)], [cx + 1.6, cy - 5.8]], flame, { curve: 0.4 }),
      sheet([[cx + 3, cy - 5.2], [cx + 4.4, cy - (hot ? 12.5 : 8.5)], [cx + 5.4, cy - 4.8]], flame, { curve: 0.4 }),
      sheet([[cx - 0.6, cy - 5.8], [cx + 0.2, cy - (hot ? 11 : 8.4)], [cx + 0.9, cy - 5.9]], flame2, { curve: 0.3 }),
    ];
  },
  mimic: (pose = 'idle') => {
    const wood = '#7a5230', dark = '#4e3320', light = '#9a6c40', iron = '#3e4048', gum = '#8a2a3a', tooth = '#f2ead2';
    const open = pose === 'windup' ? 7 : 4;       // how far the lid stands off the body
    const lidY = 15 - open;
    return [
      // the body, staves and hoops as the barrel it pretends to be
      sheet([[8.5, 16], [23.5, 16], [24.5, 23], [23, 31], [9, 31], [7.5, 23]], wood, { curve: 1 }),
      ...[12, 16, 20].map(x => line(x, 17, x, 30, dark)),
      line(8, 21, 24, 21, iron), line(8.5, 27.5, 23.5, 27.5, iron),
      // the mouth: a dark throat and gums between body and lid
      sheet([[9, 15.5], [23, 15.5], [22, lidY + 2], [10, lidY + 2]], '#2a0e14'),
      ball(16, 16, 7, 1.4, gum),
      ball(16, lidY + 2, 6.5, 1.3, gum),
      // teeth down from the lid and up from the rim, uneven as broken staves
      ...[10.5, 13, 15.5, 18, 20.5].map((x, i) => limb(x, lidY + 2.2, x + (i % 2 ? 0.3 : -0.2), lidY + 4.2 + (i % 2), 0.7, 0.2, tooth)),
      ...[11.5, 14, 16.5, 19, 21.5].map((x, i) => limb(x, 15.3, x + (i % 2 ? -0.2 : 0.3), 13.2 - (i % 2), 0.7, 0.2, tooth)),
      // the tongue, lolling out over the rim and down the front
      limb(15, 15.5, 13.5, 20, 1.6, 1.3, '#c04a5a'), limb(13.5, 20, 14.2, 23.5, 1.3, 1, '#c04a5a'),
      line(14.6, 16.5, 13.9, 22, '#8a2a3a'),
      // the lid, tipped back on its hinge, hoop and all
      sheet([[8.5, lidY + 1.5], [23.5, lidY + 1.5], [22.5, lidY - 2], [9.5, lidY - 2]], wood, { curve: 1, tilt: [0, -0.6] }),
      line(9, lidY, 23, lidY, iron),
      ball(16, lidY - 2, 6.5, 1.5, light),
      // eyes on stalks, where two knots in the wood were
      limb(11, lidY - 1, 9.5, lidY - 5, 0.6, 0.5, dark), limb(21, lidY - 1, 22.5, lidY - 5, 0.6, 0.5, dark),
      ball(9.5, lidY - 5.8, 2, 1.9, '#e8e0b0'), ball(22.5, lidY - 5.8, 2, 1.9, '#e8e0b0'),
      ball(10, lidY - 5.6, 1.1, 1.1, '#c8281c'), ball(22, lidY - 5.6, 1.1, 1.1, '#c8281c'),
      dots([[10, lidY - 6], [22, lidY - 6]], '#1a0808'),
      dots([[9, lidY - 7], [22, lidY - 7]], '#fff8d8'),
    ];
  },

  // An eyeless stalker: gaunt and pale, crouched on long thin limbs, its
  // smooth head craned forward with no eyes at all, only a wide mouth of
  // needle teeth and slits where it breathes, and ears like a bat's.
  eyeless: () => {
    const skin = '#b4aab8', dark = '#7a7080', pale = '#d8d0dc', mouth = '#2a141c';
    return [
      // hind legs folded under it, long front arms planted wide
      ...both(limb(10, 20, 7, 25.5, 2, 1.4, dark)), ...both(limb(7, 25.5, 9, 30.5, 1.4, 1, dark)), ...both(ball(9.5, 30.8, 1.8, 0.8, dark)),
      limb(11, 15, 5, 22, 1.6, 1.2, skin), limb(5, 22, 4, 30, 1.2, 0.9, skin), ball(4.2, 30.6, 1.9, 0.8, skin),
      limb(21, 15, 27, 22, 1.6, 1.2, skin), limb(27, 22, 28, 30, 1.2, 0.9, skin), ball(27.8, 30.6, 1.9, 0.8, skin),
      // a lean ribbed body
      ball(16, 18, 5.5, 5.2, skin), ball(16, 20, 3.4, 3, pale),
      // the long neck and the smooth blind head, ears spread
      limb(16, 14, 16, 9, 2.4, 2, skin),
      ball(16, 7.2, 5.4, 4.2, skin), ball(16, 5, 3.6, 1, '#c4bac8'),
      sheet([[11.5, 5.5], [5, 1.5], [9.5, 8.5]], dark, { tilt: [-0.5, -0.3] }), sheet([[20.5, 5.5], [27, 1.5], [22.5, 8.5]], dark, { tilt: [0.5, -0.3] }),
      // the mouth, wide and full of needles
      sheet([[11.5, 9], [20.5, 9], [19, 11.4], [13, 11.4]], mouth),
      ...[12.2, 13.6, 15, 16.4, 17.8, 19.2].map(x => hair(x, 9.1, x + 0.3, 10.6, '#f0ece0')),
      ...[12.9, 14.3, 15.7, 17.1, 18.5].map(x => hair(x, 11.3, x + 0.2, 10.1, '#e0dccc')),
      // fine work: breathing slits where eyes would be, ribs, claws, the skin's veins
      hair(12.5, 5.5, 14, 5, '#5a5060'), hair(18, 5, 19.5, 5.5, '#5a5060'),
      hair(13.5, 17, 18.5, 17, dark), hair(13.8, 19, 18.2, 19, dark),
      specks([[3, 31], [4.5, 31.3], [26.5, 31.3], [28, 31], [29, 31]], '#e8e4d8'),
      hair(7, 20, 6, 24, '#9a90a0'), hair(25, 20, 26, 24, '#9a90a0'),
      specks([[16, 3.5], [14, 4.2], [18, 4.2]], '#ece6ee'),
    ];
  },

  // A puffcap: a squat fungus on stubby roots, its cap swollen with spores,
  // pale speckles on the dome, dark gills beneath, two small black eyes low on
  // the stalk, and a haze of spores leaking from the rim.
  puffcap: () => {
    const cap = '#9a6a3a', capHi = '#b8844a', gill = '#5a3a2a', stalk = '#d8ccb0', shade = '#aa9c80', root = '#6a5a40';
    return [
      // roots splayed on the stone, the stalk thick and a little bowed
      ...both(limb(12.5, 28, 8.5, 30.5, 1.6, 0.9, root)), limb(16, 29, 16.5, 31, 1.4, 0.8, root),
      ball(16, 24, 5.6, 6.2, stalk), ball(14.3, 23, 2.6, 4.2, '#e8dec6'), ball(19, 25.5, 1.8, 3.2, shade),
      // the gills, and the cap over them, wide and domed
      ball(16, 15.8, 11.5, 2.6, gill),
      ball(16, 12.2, 12.2, 6.4, cap), ball(13.5, 10, 7, 3.4, capHi),
      // pale speckles on the dome
      ball(10, 11, 1.5, 1.1, '#efe4c4'), ball(17, 8.2, 1.7, 1.2, '#efe4c4'), ball(22.5, 11.5, 1.3, 1, '#efe4c4'), ball(14, 13.6, 1, 0.8, '#efe4c4'),
      // eyes, low on the stalk, and a slit of a mouth
      dots([[13, 22], [14, 22], [13, 23], [14, 23], [18, 22], [19, 22], [18, 23], [19, 23]], '#140e0a'), dots([[13, 22], [18, 22]], '#fff4d8'),
      dots([[15, 26], [16, 26.4], [17, 26]], '#6a5a40'),
      // fine work: the rim's edge, gill lines, grain on the stalk, and the spores leaking out
      hair(5, 15, 27, 15, '#3e2618'), hair(9, 16.2, 12, 17, '#3e2618'), hair(20, 17, 23, 16.2, '#3e2618'),
      hair(13, 25, 13.5, 29, '#bcae90'), hair(18.5, 21, 18, 28, '#bcae90'),
      specks([[4, 13.5], [3, 11], [28, 13], [29.5, 10.5], [6, 8.5], [26.5, 7.5], [16, 3.5], [11, 4.5], [21, 4]], '#e0dcb0'),
      specks([[9.5, 10.5], [16.5, 7.8], [22, 11]], '#fffae8'),
      specks([[12, 30.5], [20, 30.5], [16, 31.2]], '#4a3e2a'),
    ];
  },

  // The goblin again, hooded, with a bow drawn and an arrow on the string.
  archer: () => {
    const skin = '#6aa84a', dark = '#3f6e2c', hood = '#5a4a30', wood = '#8a6030';
    return [
      sheet([[20, 14], [25, 13], [26, 22], [21, 23]], '#6a4a28', { tilt: [0.5, 0] }),
      dots([[24, 12], [25, 11], [26, 12], [24, 11]], '#d8d0c0'),
      ...both(limb(13.5, 23, 12.5, 29.5, 1.9, 1.5, dark)),
      ...both(ball(11.5, 30.3, 2.4, 1.2, '#4a3a2a')),
      ball(16, 20, 5.2, 5, skin),
      sheet([[10.5, 17], [21.5, 17], [22.5, 25], [16, 24], [9.5, 25]], '#4a5a30', { curve: 1 }),
      line(10.5, 21.5, 21.5, 21.5, '#3a2a1a'),
      limb(21.5, 16.5, 23.5, 21.5, 1.6, 1.3, skin), ball(23.5, 22, 1.5, 1.4, skin),
      ball(16, 10.5, 6.2, 5.4, skin),
      sheet([[9, 11], [10, 5], [16, 3.5], [22, 5], [23, 11], [21, 8], [16, 6.5], [11, 8]], hood, { curve: 0.8 }),
      sheet([[9.5, 10.5], [3, 7], [9.5, 13]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[22.5, 10.5], [29, 7], [22.5, 13]], skin, { tilt: [0.5, -0.2] }),
      ball(16, 12.2, 1.4, 2, '#5f9a40'),
      dots([[12, 10], [13, 10], [19, 10], [20, 10]], '#ffe040'), dots([[13, 10], [19, 10]], '#1a1010'),
      dots([[13, 14], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [19, 14]], '#2a1010'),
      // the bow, held out to one side, string drawn back to the cheek
      line(4, 7, 3, 11, wood), line(3, 11, 3, 17, wood), line(3, 17, 4, 21, wood),
      line(4, 7, 11, 14, '#d8d0b8'), line(11, 14, 4, 21, '#d8d0b8'),
      line(11, 14, 1, 14, '#b89a60'), dots([[0, 13], [0, 14], [0, 15], [1, 14]], '#c8ccd4'),
      limb(10.5, 16.5, 5, 14.5, 1.6, 1.3, skin), ball(4.5, 14, 1.5, 1.5, skin),
    ];
  },

  // A zombie: a dead man still walking, shambling with one arm out before
  // him. Grey-green skin gone loose on the bones, a torn shirt with the ribs
  // showing through the rent, ragged breeches and one shoe; the jaw hanging
  // slack and askew, one eye gone and the other filmed over.
  zombie: () => {
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
      limb(22.5, 26, 19, 37, 2.4, 2, skin), limb(19, 37, 18, 46, 2, 1.8, skinDk), ball(17.8, 47.6, 2.2, 2, rot),
      ...[16.4, 17.8, 19.2].map(x => limb(x, 48.6, x, 51, 0.45, 0.4, skinDk)),
      limb(41.5, 26, 50, 25, 2.4, 2.1, skin), limb(50, 25, 57, 24, 2.1, 1.8, skin), ball(58.5, 23.8, 2.2, 2, skin),
      ...[22.4, 23.8, 25.2].map(y => limb(60, y, 62.6, y + 0.3, 0.45, 0.4, skin)), specks([[62.75, 22.5], [62.75, 24], [62.75, 25.5]], bone),
      sheet([[43, 24], [48, 23.5], [48, 27], [43, 27.5]], shirtDk, { curve: 0.5 }),
      // the neck, and the head lolling to one side
      limb(31, 19, 31.5, 25, 2.6, 2.8, skinDk),
      ball(29, 15, 7, 7, skin),
      // the jaw dropped slack below the line of the skull, the mouth a black hole
      ball(28.2, 22.2, 4.4, 2.2, skin),
      sheet([[24.4, 18.6], [31.6, 19.4], [31, 23], [27.6, 24], [24.2, 22]], '#2a1418'),
      dots([[27, 19], [29, 19], [25, 22], [28, 23]], bone),
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
      ...[[49, 24], [51, 24.25], [53, 24]].map(([x, y]) => hair(x, y - 1, x + 0.5, y + 1, '#1a1418')),
      specks([[26, 31], [24.5, 37], [38, 41], [22, 33]], rot),
    ];
  },

  // An orc: broad as a door and heavy with muscle, a scalp lock greased flat,
  // a jaw thrust out with tusks up from it, iron on the chest and shoulders
  // over leather, a belt with a brass buckle, and an axe that could fell a tree.
  orc: () => {
    const skin = '#607f3a', skinDk = '#3e5a22', skinLt = '#7e9e52', iron = '#7a8290', ironLt = '#c8ced8', ironDk = '#4a505c', leather = '#5a3a24', trouser = '#3a3040', boot = '#2e2218';
    return [
      // the axe, planted beside it, its haft wrapped in cord
      limb(53, 60, 53, 14, 1.3, 1.3, '#6a4a2a'), ...[24, 27, 30].map(y => hair(51.75, y, 54.25, y - 0.75, '#8a6a40')),
      sheet([[53, 10], [62, 6], [63, 25], [53, 21]], '#9aa2ae', { tilt: [0.6, -0.1] }),
      line(62.4, 7, 62.4, 24, '#e0e6ee'), hair(55, 12, 55, 19, '#6a707c'),
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
      limb(17, 27, 13, 38, 4, 3.6, skin), limb(13, 38, 12, 45, 3.4, 3, skin), ball(12, 47, 3.4, 3.2, skin),
      hair(14.5, 31, 12.5, 37, skinDk), hair(10.5, 46, 13.5, 46, skinDk),
      limb(47, 27, 50, 37, 4, 3.6, skin), limb(50, 37, 52, 41, 3.4, 3, skin), ball(52.6, 41.5, 3.4, 3.2, skin),
      hair(51, 40.5, 54.5, 40.5, skinDk),
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
      sheet([[26.5, 19.6], [37.5, 19.6], [36, 21.6], [28, 21.6]], '#2a1410'),
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
  ghoul: () => {
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
      limb(23.5, 27, 14, 38, 2, 1.7, skin), ball(14, 38, 1.9, 1.8, skinDk), limb(14, 38, 11, 54, 1.7, 1.4, skin),
      ball(10.6, 55.6, 2.4, 2.2, skin), ...[[8, 57, 6, 61.5], [10, 57.6, 9.4, 62.5], [12, 57.4, 13, 62]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, bone)),
      limb(40.5, 27, 50, 38, 2, 1.7, skin), ball(50, 38, 1.9, 1.8, skinDk), limb(50, 38, 53, 54, 1.7, 1.4, skin),
      ball(53.4, 55.6, 2.4, 2.2, skin), ...[[56, 57, 58, 61.5], [54, 57.6, 54.6, 62.5], [52, 57.4, 51, 62]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, bone)),
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
      ball(32, 24.4, 4.6, 3.2, '#2a1414'),
      ...[28.5, 30, 31.5, 33, 34.5].map(x => sheet([[x - 0.5, 22], [x + 0.5, 22], [x, 23.8]], bone)),
      ...[29.5, 31, 32.5, 34].map(x => sheet([[x - 0.5, 27], [x + 0.5, 27], [x, 25.4]], bone)),
      ball(32, 25.6, 1.6, 0.8, '#8a2424'),
      // sinew and veins, a few lank hairs, grave-dirt
      hair(18, 32, 15.5, 36, skinDk), hair(46, 32, 48.5, 36, skinDk), hair(30, 11.5, 28.5, 15, '#3a4034'), hair(34, 11.5, 35, 15, '#3a4034'),
      specks([[26, 36], [38, 30], [35, 39], [20, 50], [44, 50]], '#4a5444'),
    ];
  },

  // The Dark Acolyte: tall and hooded in crimson, a mantle trimmed in gold over
  // its shoulders, a gaunt face in the hood's shadow lit from below by the
  // violet orb it holds in two bony hands before its chest.
  acolyte: () => {
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
      ...both64(limb(23.5, 18, 26, 27, 3, 3.6, robe)), ...both64(sheet([[22.5, 25], [29.5, 25.5], [28.5, 30], [22, 30.5]], robeDk, { curve: 0.6 })),
      ...both64(hair(22.5, 30.25, 28.75, 29.75, robeLt)),
      // the orb, its light, and sparks of it in the air
      ball(32, 26, 4, 3.9, orb, { glows: true }), ball(31.2, 25, 2, 1.9, orbLt, { glows: true }), dots([[31, 25]], '#ffffff'),
      specks([[27.5, 21], [36.5, 20.5], [26, 25.5], [38, 26.5], [29, 31], [35.5, 31.5]], '#c890ff'),
      ...both64(ball(27.8, 28, 1.5, 1.6, skin)),
      ...both64(limb(28, 26.8, 29.4, 24, 0.4, 0.3, skin)), ...both64(limb(27.8, 29, 29.6, 30.2, 0.4, 0.3, skin)),
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
  wraith: () => {
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
      limb(21, 23, 11, 32, 3, 3.8, cloak), limb(43, 23, 53, 32, 3, 3.8, cloak),
      sheet([[7, 30], [14, 30], [13, 35.5], [11, 34], [9, 36], [7.5, 34]], deep, { curve: 0.5 }),
      sheet([[50, 30], [57, 30], [56.5, 34], [55, 36], [53, 34], [51, 35.5]], deep, { curve: 0.5 }),
      // the hands: long bones of fingers, clawing at the air
      ball(10, 36.6, 1.8, 1.6, bone), ...[[8, 37.5, 4.5, 41.5], [9.5, 38, 7.5, 43], [11, 38, 10.6, 43.4], [12, 37.4, 13.6, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone)),
      ball(54, 36.6, 1.8, 1.6, bone), ...[[56, 37.5, 59.5, 41.5], [54.5, 38, 56.5, 43], [53, 38, 53.4, 43.4], [52, 37.4, 50.4, 41.6]].map(([a, b, c, d]) => limb(a, b, c, d, 0.45, 0.3, bone)),
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

  // What is left of a hero who fell down here before: helm, mail and sword
  // still keeping their shape, and nothing below the belt but mist. Pale
  // where the wraith is dark, and it stands straight: it remembers being a person.
  shade: () => {
    const mail = '#7e98b0', deep = '#4a5e78', steel = '#a8bccc', glow = '#e0fcff';
    return [
      // the mist it trails away into
      sheet([[10, 19], [22, 19], [23.5, 24], [21, 28], [19, 25], [17, 30], [15, 25.5], [12.5, 29], [11, 24.5], [8.5, 26]], deep, { curve: 1 }),
      // mail from the shoulders to the belt
      sheet([[10, 12.5], [22, 12.5], [22.5, 21], [16, 22.5], [9.5, 21]], mail, { curve: 1 }),
      line(10, 20, 22, 20, '#3a4a60'), ball(16, 20.2, 1.3, 1, steel),
      // the shield arm hangs, the sword arm lifts the blade it died with
      limb(10.5, 13.5, 7.5, 20, 1.6, 1.3, mail), ball(7.3, 20.6, 1.4, 1.3, steel),
      limb(21.5, 13.5, 24.5, 17.5, 1.6, 1.3, mail), ball(24.8, 18.2, 1.4, 1.3, steel),
      line(25.5, 17.5, 28, 4, '#d8f0ff'), line(26, 17.8, 28.5, 4.4, '#8aa4bc'),
      line(23, 17.6, 27.6, 19, steel),
      ...both(ball(10.5, 13, 2.6, 2.2, steel)),
      // the helm, and nothing in it but two cold lights
      ball(16, 8.2, 4, 4.3, steel),
      limb(12, 8.5, 20, 8.5, 0.9, 0.9, '#0a0e16'),
      line(16, 4.5, 16, 10.5, '#8aa4bc'),
      dots([[14, 8], [18, 8]], glow), dots([[13, 8], [19, 8]], '#6ab0d0'),
    ];
  },

  // Mostly belly, a little head on top, and a club the size of a man.
  ogre: () => {
    const skin = '#b08a5a', dark = '#7a5a36';
    return [
      limb(26, 22, 28, 3, 1.4, 2.6, '#6a4a2a'),
      dots([[27, 2], [29, 3], [27, 6], [30, 6]], '#cfc6b0'),
      ...both(limb(12, 24, 11.5, 30, 2.8, 2.5, dark)),
      ...both(ball(11, 30.4, 3.2, 1.3, '#5a3e24')),
      ball(16, 20, 9, 7.8, skin),
      ball(16.5, 22, 5.5, 4.5, '#c49e6c'),
      dots([[17, 22]], '#6a4a2a'),
      sheet([[8, 24], [24, 24], [23, 29], [18, 27], [16, 29.5], [13, 27], [9, 29]], '#5a4a30', { curve: 1 }),
      limb(8, 14, 5, 23, 2.8, 2.4, skin), ball(5, 24, 2.5, 2.4, skin),
      limb(24, 14, 26, 21, 2.8, 2.4, skin), ball(26.3, 21.8, 2.6, 2.4, skin),
      // shoulders hunched up round a head sunk between them
      ball(11, 13.5, 4.2, 3, skin), ball(21, 13.5, 4.2, 3, skin),
      ball(10.8, 10, 1.3, 1.8, dark), ball(21.2, 10, 1.3, 1.8, dark),
      ball(16, 10, 5, 4.6, skin),
      // a heavy brow over small eyes, a flat nose, an underbite with tusks
      ball(16, 7.8, 4.4, 1.5, '#9a7648'),
      dots([[14, 9], [18, 9]], '#ff9040'), dots([[13, 9], [19, 9]], '#3a2410'),
      ball(16, 10.8, 1.5, 1.2, '#9c7648'),
      ball(16, 13, 3.4, 1.6, dark),
      dots([[14, 13], [15, 13], [16, 13], [17, 13], [18, 13]], '#2a1410'),
      dots([[14, 12], [18, 12]], '#f0ead6'), dots([[14, 11], [18, 11]], '#f8f2e0'),
    ];
  },

  // Tall and bent, arms long enough to drag its knuckles, a great hooked nose
  // and moss for hair.
  troll: () => {
    const skin = '#58985c', dark = '#356a3c', hair = '#2e4a26';
    return [
      limb(13.5, 21, 13, 30, 1.5, 1.3, dark), limb(18.5, 21, 19, 30, 1.5, 1.3, dark),
      ball(12, 30.4, 2.8, 1.1, dark), ball(20, 30.4, 2.8, 1.1, dark),
      ball(16, 16, 6.2, 6.5, skin),
      sheet([[11, 19], [21, 19], [21.5, 24], [16, 22.5], [10.5, 24]], '#5a4630', { curve: 1 }),
      limb(10, 12, 6, 21, 1.8, 1.5, skin), limb(6, 21, 5, 29, 1.5, 1.4, skin),
      limb(22, 12, 26, 21, 1.8, 1.5, skin), limb(26, 21, 27, 29, 1.5, 1.4, skin),
      ball(5, 29.6, 2, 1.5, dark), ball(27, 29.6, 2, 1.5, dark),
      dots([[3, 30], [4, 31], [6, 31], [26, 31], [28, 31], [29, 30]], '#e8e0c8'),
      sheet([[10, 5], [16, 1.5], [22, 5], [23.5, 12], [21, 9], [16, 7], [11, 9], [8.5, 12]], hair, { curve: 0.8 }),
      ball(16, 8.5, 4.6, 4, skin),
      ball(17, 10.5, 2, 2.6, '#4c8a50'),
      dots([[18, 12], [19, 12]], '#4c8a50'),
      dots([[13, 8], [14, 8], [19, 8], [20, 8]], '#ffe040'), dots([[14, 8], [19, 8]], '#1a1a08'),
      dots([[13, 12], [14, 13], [15, 13], [20, 13]], '#1e2a14'), dots([[14, 12], [20, 12]], '#f0ead6'),
      dots([[12, 15], [20, 17], [14, 18], [21, 14]], '#3e7a44'),
    ];
  },

  // Bull above the shoulders, man below, and a double axe held across.
  minotaur: () => {
    const hide = '#7a5436', dark = '#4e3320', horn = '#efe6cc';
    return [
      limb(4, 26, 28, 10, 0.8, 0.8, '#5a3a20'),
      sheet([[23, 6.5], [30, 5], [31, 13], [26, 14]], '#9aa2ae', { tilt: [0.5, -0.2] }),
      sheet([[26, 14], [31, 13], [30, 19], [24, 17]], '#8a929e', { tilt: [0.5, 0.2] }),
      ...both(limb(12.5, 22, 12, 28.5, 2.4, 1.9, dark)),
      ...both(sheet([[9.5, 28.5], [14.5, 28.5], [14.5, 31], [9.5, 31]], '#2a1e16')),
      ball(16, 17.5, 7.2, 6.6, hide),
      ...both(ball(12.8, 16, 3, 2.6, '#8a6242')),
      sheet([[9.5, 21], [22.5, 21], [21.5, 26], [16, 24.5], [10.5, 26]], '#6a2a20', { curve: 1 }),
      line(9.5, 21, 22.5, 21, '#c9a24a'),
      limb(9, 13, 7, 21, 2.3, 2, hide), ball(6.8, 22, 2.2, 2, hide),
      limb(23, 13, 24.5, 19, 2.3, 2, hide), ball(25, 19.8, 2.2, 2, hide),
      ...both(limb(11.5, 6, 6, 4, 1.4, 0.9, horn)), ...both(limb(6, 4, 4.5, 0.5, 0.9, 0.5, horn)),
      ball(16, 7.5, 5.2, 4.4, hide),
      sheet([[14.5, 3], [16, 2.3], [17.5, 3], [17, 5], [16, 4.4], [15, 5]], dark, { curve: 0.8 }),
      ball(16, 11.2, 4, 2.6, '#9a7050'),
      ball(16, 10.3, 3, 1.2, '#b08868'),
      dots([[14, 12], [18, 12]], '#1a0c08'),
      dots([[15, 13], [16, 13.5], [17, 13]], '#d8b040'),
      dots([[13, 6], [19, 6]], '#ff4030'), dots([[12, 5], [13, 5], [19, 5], [20, 5]], '#2a1a10'),
      ...both(sheet([[11.5, 7.5], [9, 6.5], [11.5, 9.5]], hide, { tilt: [-0.4, 0] })),
    ];
  },

  // The Dread Lich: a skull under a horned helm, ornate shoulder plates trimmed
  // in gold, a skull worn on the chest, crimson robes falling in folds to the
  // floor, and its staff, an iron claw round a cold blue stone.
  lich: () => {
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
      limb(17.5, 20, 16.5, 31, 2.8, 2.5, crimson), line(14.5, 31.5, 18.5, 31.5, gold), ball(16.5, 33.5, 2.4, 2.2, steel), hair(15.5, 32.5, 17.5, 32.5, steelLt),
      ...[15.1, 16.5, 17.9].map(x => limb(x, 34.5, x - 0.2, 36.7, 0.5, 0.45, steel)),
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
    ];
  },

  // One of the Lampfolk, who have traded in the deep for as long as there has
  // been a deep: small, grey and patient, eyes wide and pale as lanterns from
  // a life without the sun, a pack taller than itself and a lamp on a staff.
  // Nothing about it says fight: no blade, no teeth, and the light held out.
  merchant: () => {
    const skin = '#98a0ae', dark = '#6c7482', robe = '#6a5a48', patch = '#7c6a3e', pack = '#5e4a36';
    return [
      // the pack, the rolled blanket on top of it and a pan swinging off one side
      ball(16, 11, 9, 9.5, pack),
      limb(9.5, 3, 22.5, 3, 2.3, 2.3, '#8a4a3a'),
      ball(25.5, 13, 2.4, 2.2, '#6a6e76'), line(24.5, 10, 25.5, 11, '#4a4a50'),
      // short legs under a long robe, and bare grey feet
      ...both(limb(14, 25, 13.5, 29.5, 1.7, 1.5, dark)),
      ...both(ball(12.8, 30.4, 2.4, 1.1, skin)),
      sheet([[10.5, 17], [21.5, 17], [23.5, 29.5], [8.5, 29.5]], robe, { curve: 1 }),
      sheet([[16.5, 21], [21, 21], [22, 27], [17, 27]], patch, { curve: 0.6 }),
      line(10.5, 18, 21.5, 18, '#4a3e30'),
      // the staff and its lamp, held out on the left
      line(5.5, 5, 5.5, 30, '#6a5238'),
      line(5.5, 5, 8.5, 5, '#6a5238'), line(8.5, 5, 8.5, 6.5, '#4a4040'),
      ball(8.5, 9, 2.2, 2.6, '#ffd060'), ball(8.4, 8.5, 1, 1, '#fff6d0'),
      limb(10.5, 18, 7, 21.5, 1.4, 1.1, robe), ball(6.4, 22, 1.4, 1.3, skin),
      // the other hand held up, a coin between long fingers
      limb(21.5, 18, 24, 21.5, 1.4, 1.1, robe), ball(24.4, 22, 1.4, 1.3, skin),
      dots([[25, 20]], '#e8c050'),
      // broad ears that droop, a round head, and the eyes
      sheet([[11.5, 12], [4.5, 14.5], [5.5, 16.5], [11.5, 15]], skin, { tilt: [-0.5, 0.2] }),
      sheet([[20.5, 12], [27.5, 14.5], [26.5, 16.5], [20.5, 15]], skin, { tilt: [0.5, 0.2] }),
      ball(16, 13.5, 5.6, 5, skin),
      ...both(ball(13.6, 13, 2, 2.1, '#f4e6a8')),
      dots([[14, 13], [18, 13]], '#1a1620'), dots([[13, 12], [17, 12]], '#ffffff'),
      ball(16, 15.8, 0.8, 0.6, dark),
      dots([[15, 17], [16, 17], [17, 17]], '#5a5462'),
    ];
  },

  // A goblin who would rather sell you a blade than stick you with one: no
  // weapon in its hands, a floppy cap, and a heap of other people's things on
  // its back, pots and a sword hilt and a string of trinkets.
  pedlar: () => {
    const skin = '#6aa84a', dark = '#3f6e2c', tunic = '#8a6a3a', heap = '#6e5236';
    return [
      // the heap on its back: a sack, a pot, a pan, a hilt standing out of it
      ball(16, 13, 9.5, 7.5, heap),
      ball(8, 9, 2.8, 2.4, '#7a7e86'), ball(24.5, 8.5, 2.6, 2.2, '#9a6a3a'),
      line(21, 3, 23, 8, '#b8bcc4', { lit: 1 }), line(19.5, 4.5, 22.5, 3.5, '#c9a24a'),
      ...both(limb(13.5, 23, 12.5, 29.5, 1.9, 1.5, dark)),
      ...both(ball(11.5, 30.3, 2.4, 1.2, '#4a3a2a')),
      ball(16, 21, 5.2, 4.8, skin),
      sheet([[10.5, 18], [21.5, 18], [22.5, 25], [9.5, 25]], tunic, { curve: 1 }),
      line(10.5, 18.5, 21.5, 18.5, '#5a3a20'),
      // one hand holds a string of charms out to you, the other beckons
      limb(10.5, 18, 6.5, 22, 1.7, 1.3, skin), ball(6.3, 22.8, 1.6, 1.5, skin),
      line(6, 24, 6, 28, '#8a7050'), dots([[6, 25], [6, 27]], '#e8c050'), dots([[6, 26]], '#60c0e0'),
      limb(21.5, 18, 24.5, 15.5, 1.7, 1.3, skin), ball(25, 14.8, 1.6, 1.5, skin),
      // ears, a head, a floppy cap
      sheet([[10.5, 11], [3, 8], [4.5, 10.5], [10.5, 14]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[21.5, 11], [29, 8], [27.5, 10.5], [21.5, 14]], skin, { tilt: [0.5, -0.2] }),
      ball(16, 12, 5.8, 5, skin),
      sheet([[10, 9.5], [12, 5], [16, 4], [20.5, 5], [22, 9.5], [16, 8.5]], '#a03a30', { curve: 0.8 }),
      ball(21.5, 5.5, 1.2, 1.2, '#e8d8b0'),
      // an open, hopeful look and a grin that wants your coin
      ...both(ball(13.3, 11.8, 1.5, 1.3, '#f0e8c0')),
      dots([[13, 12], [19, 12]], '#1a1010'),
      limb(16, 11, 16, 14, 0.6, 1, skin),
      sheet([[12.5, 14.8], [16, 15.8], [19.5, 14.8], [18, 16.6], [14, 16.6]], '#2a1010'),
      dots([[14, 15], [17, 15]], '#f0e6c8'),
    ];
  },

  // Low and heavy on six splayed legs, turned a little so its length shows:
  // a crest of horn plates down its back, a serpent's tail coiled up behind,
  // and eyes that are what you see first. Winding up a bite it drops its jaw;
  // to look at you it rears its head up high, and the eyes blaze.
  basilisk: (pose = 'idle') => {
    const hide = '#62703f', skin = '#77834e', flank = '#4a5436', belly = '#b0aa78', horn = '#a08e5e', jaw = '#8e8c5e';
    const gaze = pose === 'special', bite = pose === 'windup';
    const up = gaze ? 1.2 : bite ? -0.4 : 0;    // how far the body is raised
    // plates standing up off the spine: [x, y at the spine, height, lean]
    const plates = [[25, 13, 3, 0.8], [21.5, 12, 4, 0.6], [18, 12.5, 4.6, 0.4], [14.5, 14.5, 4.2, 0.2]]
      .map(([x, y, h, l]) => gaze ? [x, y - up, h * 1.25, l * 0.6] : [x, y, h, l]);
    /** the head, square on to you: a crown of plates, a wedge of a snout, eyes on top */
    const head = (cx, cy) => {
      // the crown stands up off the skull; rearing, it spreads into a frill
      const crown = (gaze ? [[-178, 6.5], [-148, 8], [-120, 8.5], [-90, 9], [-60, 8.5], [-32, 8], [-2, 6.5]] : [[-150, 2.2], [-115, 2.8], [-65, 2.8], [-30, 2.2]])
        .map(([a, r]) => {
          const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), w = gaze ? 1.7 : 1.5;
          const bx = cx + dx * 4, by = cy - 0.5 + dy * 2.4;
          return [sheet([[bx - dy * w, by + dx * w], [bx + dx * r, by + dy * r], [bx + dy * w, by - dx * w]], horn, { tilt: [dx * 0.5, dy * 0.5] }),
            hair(bx, by, bx + dx * r * 0.8, by + dy * r * 0.8, '#7a6844')];
        }).flat();
      /** @type {object[]} */
      const p = [...crown, ball(cx, cy, 5.6, 3.4, skin)];
      // scales over the skull, a ridge down the snout, the nostrils
      p.push(specks([[cx - 2, cy - 2.5], [cx, cy - 3], [cx + 2, cy - 2.5], [cx - 1, cy - 2], [cx + 1, cy - 2]], '#9aa46a'),
        hair(cx, cy - 1, cx, cy + 2.5, '#8e9a62'));
      if (bite) {
        p.push(
          sheet([[cx - 4.5, cy + 0.5], [cx + 4.5, cy + 0.5], [cx + 3, cy + 7], [cx - 3, cy + 7]], '#5a1c1e', { curve: 0.6 }),
          ball(cx, cy + 7.3, 3.4, 1.3, jaw),
          limb(cx, cy + 0.5, cx, cy + 3, 3.6, 2.6, skin),
          ball(cx, cy + 5.6, 2, 1, '#a04a40'),
          specks([[cx - 2.5, cy + 3.5], [cx - 1, cy + 4], [cx + 1, cy + 4], [cx + 2.5, cy + 3.5]], '#f0e8cc'),
          specks([[cx - 2, cy + 6.5], [cx - 0.5, cy + 6.5], [cx + 1, cy + 6.5], [cx + 2.5, cy + 6.5]], '#e0d8b8'),
        );
      } else {
        p.push(
          ball(cx, cy + 5.6, 2.6, 1.3, jaw),
          limb(cx, cy + 1, cx, cy + 4.4, 3.6, 2.4, skin),
          hair(cx - 2.5, cy + 5, cx + 3, cy + 5, '#2a1a14'), hair(cx - 3, cy + 4, cx - 2.5, cy + 5, '#2a1a14'), hair(cx + 3.5, cy + 4, cx + 3, cy + 5, '#2a1a14'),
          specks([[cx - 2, cy + 5.5], [cx - 2, cy + 6], [cx + 2.5, cy + 5.5], [cx + 2.5, cy + 6], [cx, cy + 5.5]], '#f0e8cc'),
        );
      }
      // the eyes sit in dark rims under a heavy brow
      const ey = Math.floor(cy) - 1;
      p.push(ball(cx - 3, ey + 1, 1.9, gaze ? 2.1 : 1.5, '#262a18'), ball(cx + 3, ey + 1, 1.9, gaze ? 2.1 : 1.5, '#262a18'));
      const L = [cx - 4, cx - 3, cx - 2], R = [cx + 1, cx + 2, cx + 3];
      const eye = rows => rows.flatMap(y => [...L, ...R].map(x => [x, y]));
      if (gaze) {
        // wide and burning, the pupils shrunk to a line
        p.push(dots(eye([ey - 1, ey, ey + 1]), '#e8ff70'), dots([ey - 1, ey, ey + 1].flatMap(y => [[cx - 3, y], [cx + 2, y]]), '#fcffd0'));
      } else if (bite) {
        // narrowed to slits under the brow
        p.push(dots(eye([ey + 1]), '#d8f040'), dots([[cx - 3, ey + 1], [cx + 2, ey + 1]], '#1a2008'));
      } else {
        p.push(dots(eye([ey, ey + 1]), '#d8f040'), dots([[cx - 3, ey], [cx - 3, ey + 1], [cx + 2, ey], [cx + 2, ey + 1]], '#1a2008'));
      }
      p.push(specks([[cx - 1, cy + 3.5], [cx + 1, cy + 3.5]], '#1e2414'));
      if (gaze) {
        // light spilling out of them, over the frill and down the snout
        for (const [ex, dir] of [[cx - 3, -1], [cx + 3, 1]]) {
          p.push(hair(ex + dir * 2.5, ey + 0.5, ex + dir * 5, ey + 0.5, '#d8ff60'), hair(ex + dir * 2, ey - 1.5, ex + dir * 4, ey - 3.5, '#c0f050'),
            hair(ex + dir * 2, ey + 2.5, ex + dir * 4, ey + 4.5, '#c0f050'), hair(ex, ey - 2, ex, ey - 4, '#c0f050'));
          p.push(specks([[ex + dir * 4, ey - 1], [ex - dir, ey + 3]], '#f0ffa0'));
        }
      }
      if (bite) p.push(hair(cx + 2, cy + 7.5, cx + 2, cy + 9, '#c8d0a0'), specks([[cx - 2.5, cy + 8]], '#c8d0a0'));
      const b = gaze ? -1.2 : bite ? 0.4 : 0;    // the brow, raised or drawn down
      p.push(limb(cx - 5, ey - 1 + b, cx - 1.5, ey + 0.2 + b, 0.8, 0.5, horn), limb(cx + 5, ey - 1 + b, cx + 1.5, ey + 0.2 + b, 0.8, 0.5, horn));
      return p;
    };
    /** @type {object[]} */
    const out = [
      // the tail, up behind it in a serpent's coil
      limb(26, 15, 29.5, 12, 2.6, 2.1, hide), limb(29.5, 12, 30, 7, 2.1, 1.6, hide),
      limb(30, 7, 27.5, 3.5, 1.6, 1.1, hide), limb(27.5, 3.5, 25, 4.5, 1.1, 0.7, hide),
      limb(25, 4.5, 25, 6.5, 0.7, 0.5, hide),
      limb(29.3, 12.5, 29.8, 7.5, 1, 0.8, belly),
      ...[[31, 10, 1], [30.5, 5, 0.6], [27.5, 2, 0]].map(([x, y, l]) => sheet([[x - 1.5 * l - 0.8, y + 1.2 - l], [x + 1.2 * l, y - 1.3 + l * 0.3], [x + 0.6, y + 1.4]], horn, { tilt: [0.4, -0.4] })),
      // the far legs, splayed out behind
      limb(16, 15 - up, 11.5, 13.5 - up, 1.5, 1.2, flank), limb(11.5, 13.5 - up, 11, 19.5, 1.2, 1, flank), ball(10.8, 20.2, 1.6, 0.8, flank),
      limb(12, 19.5 - up, 6.5, 18.5 - up, 1.9, 1.5, flank), limb(6.5, 18.5 - up, 5, 25.5, 1.5, 1.2, flank), ball(4.8, 26.2, 2, 1, flank),
      ball(11.5, 13.5 - up, 1.4, 1.3, flank), ball(6.5, 18.5 - up, 1.7, 1.6, flank),
      // the crest
      ...plates.map(([x, y, h, l]) => sheet([[x - 1.8, y + 1], [x + l * 1.5, y - h], [x + 1.8, y + 1]], horn, { curve: 0.6 })),
      // the body, from the haunch forward to the shoulders
      ball(24.5, 16.5 - up * 0.5, 4.8, 3.8, hide),
      ball(19.5, 17.5 - up, 6.5, 5, hide),
      ball(14.5, 19.5 - up, 6.5, 5.2, flank),
      ball(19.5, 21 - up, 5.5, 1.8, belly),
      // the near legs: hind, middle, front
      limb(24.5, 18.5 - up * 0.5, 27, 21.5, 1.8, 1.4, hide), limb(27, 21.5, 27, 27, 1.4, 1.1, hide), ball(27, 27.6, 1.9, 0.9, flank),
      ball(27, 21.5, 1.3, 1.2, hide),
      limb(20.5, 20.5 - up, 22.5, 24.5 - up * 0.5, 2, 1.7, hide), limb(22.5, 24.5 - up * 0.5, 21.5, 29.5, 1.7, 1.3, hide), ball(21.3, 30.2, 2.2, 1.1, flank),
      ball(22.5, 24.5 - up * 0.5, 1.6, 1.5, hide),
      limb(15, 22 - up, 17.5, 25 - up * 0.5, 2.3, 1.9, hide), limb(17.5, 25 - up * 0.5, 16.5, 29.8, 1.9, 1.5, hide), ball(16.3, 30.4, 2.4, 1.1, flank),
      ball(17.5, 25 - up * 0.5, 1.8, 1.7, hide),
    ];
    // the fine detail: ridges on the plates, scales in staggered rows over
    // the back and shoulders, rings round the tail and claws on the feet
    const onBack = (x, y) => y < 19.5 - up && (((x - 19.5) / 6) ** 2 + ((y - 17.5 + up) / 4.4) ** 2 < 1 || ((x - 24.5) / 4.3) ** 2 + ((y - 16.5 + up * 0.5) / 3.3) ** 2 < 1
      || ((x - 14.5) / 5.8) ** 2 + ((y - 19.5 + up) / 4.6) ** 2 < 1);
    const scales = [];
    for (let r = 0; r < 5; r++) for (let x = 9 + (r % 2); x < 29; x += 2) { const y = 13.5 + r * 1.5; if (onBack(x - 0.5, y) && onBack(x + 0.5, y + 0.5)) scales.push([x, y]); }
    out.push(
      ...plates.map(([x, y, h, l]) => hair(x, y + 0.5, x + l * 1.5, y - h + 1, '#7a6844')),
      // each scale's lower edge as a little arc, so they lie in rows like tiles
      ...scales.flatMap(([x, y]) => [hair(x - 0.75, y, x, y + 0.5, '#48532e'), hair(x, y + 0.5, x + 0.75, y, '#48532e')]),
      hair(27, 14.5, 29.5, 13.5, '#46502e'), hair(28.5, 10.5, 31, 11, '#46502e'), hair(28.5, 7, 31, 6.5, '#46502e'), hair(27.5, 4.5, 28.5, 2.5, '#46502e'),
      ...[[16.3, 30.4], [21.3, 30.2], [27, 27.6], [4.8, 26.2], [10.8, 20.2]].map(([x, y]) => specks([[x - 1.5, y + 0.5], [x - 0.5, y + 1], [x + 0.5, y + 1], [x + 1.5, y + 0.5]], '#e0d8b8')),
      // a pale scaled belly along the near side
      specks([[19, 21.5 - up], [20.5, 21.5 - up], [22, 21 - up], [23.5, 21 - up]], '#8a8660'),
    );
    if (gaze) {
      // reared up high on its neck, pale throat toward you
      out.push(limb(15, 20.5, 12.5, 13.5, 4, 3.3, hide), limb(12.5, 13.5, 11.5, 10, 3.3, 3, hide),
        ...[13, 14.5, 16, 17.5, 19].map((y, i) => hair(10.5 + i * 0.5, y, 14 + i * 0.6, y - 0.5, '#8e9a62')), ...head(11, 8.5));
    } else out.push(...head(11, bite ? 21.8 : 22.5));
    // the hide is smooth between its scales: the painter's grain on top of the
    // rows of scales only read as dirt
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // A beetle the size of a boar, come up through the floor: a domed shell of
  // rust and green-crusted copper, legs made for digging, heavy mandibles
  // either side of a round, drooling mouth ringed with little teeth. Rust
  // flakes off it as it moves. Winding up to bite it rears back, forelegs
  // up and mandibles spread wide.
  rustmaw: (pose = 'idle') => {
    const rust = '#a4461a', shield = '#8a3a16', verd = '#5a9a80', bronze = '#5e3020', jaw = '#7a3620', leg = '#4e2e1c', knee = '#8a5430', gold = '#d8a860';
    const rear = pose === 'windup' || pose === 'special';
    const up = rear ? 3.5 : 0;    // how far the front of it is raised
    const hy = 24.5 - up;         // the head
    const sy = up * 0.7;          // and the shell
    /** @type {object[]} */
    const out = [
      // hind legs, far back: out, up at the knee and down to the floor
      ...both(limb(10.5, 16 - up * 0.4, 5, 9.5 - up * 0.5, 1.4, 1.1, leg)), ...both(limb(5, 9.5 - up * 0.5, 3, 20.5, 1.05, 0.8, leg)),
      ...both(ball(5, 9.5 - up * 0.5, 1.1, 1.1, knee)),
      // the shell, crusted green where the copper has gone over
      ball(16, 15.5 - sy, 10.8, 8.4, rust),
      sheet([[6, 13], [8, 10.5], [10.5, 10], [11, 12], [9.5, 13], [10, 15.5], [7.5, 17], [5.5, 16]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.4, -0.3] }),
      sheet([[20, 8.5], [22.5, 8], [24, 10], [22.5, 10.5], [21, 10]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.2, -0.6] }),
      sheet([[23, 14], [25.5, 13], [26.8, 16], [26, 19], [24, 18], [24.5, 16]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.6, 0] }),
      sheet([[12.5, 17.5], [14.5, 16.5], [15, 19], [13, 19.5]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.2, 0] }),
      // middle legs, braced wide
      ...both(limb(8, 21 - up * 0.6, 2.5, 15.5 - up * 0.8, 1.6, 1.3, leg)), ...both(limb(2.5, 15.5 - up * 0.8, 1.2, 27.5, 1.25, 0.9, leg)),
      ...both(ball(2.5, 15.5 - up * 0.8, 1.3, 1.2, knee)),
      ...both(ball(1.8, 28, 1.4, 0.8, leg)), ...both(limb(1.8, 28.2, 0.5, 29.5, 0.5, 0.3, knee)), ...both(limb(2.2, 28.4, 3.4, 29.6, 0.5, 0.3, knee)),
      // the shield behind the head, with a rolled front edge
      ball(16, 20.5 - up, 8.6, 4.4, shield),
      limb(8.5, 22.3 - up, 23.5, 22.3 - up, 0.7, 0.7, '#b8602c'),
    ];
    if (rear) {
      // forelegs raised high, the spade feet up and out
      out.push(
        ...both(limb(11, 22.5 - up, 4, 15.5 - up, 1.6, 1.3, leg)), ...both(limb(4, 15.5 - up, 5.5, 7, 1.3, 1, leg)),
        ...both(limb(5.5, 7, 8.8, 5.3, 0.9, 0.45, gold)), ...both(limb(5.5, 7.5, 8.8, 8.8, 0.8, 0.4, gold)), ...both(limb(5.3, 7, 5.3, 3.5, 0.7, 0.4, gold)),
        ...both(ball(4, 15.5 - up, 1.4, 1.4, knee)),
      );
    } else {
      out.push(
        ...both(limb(11, 24, 7, 21, 1.6, 1.3, leg)), ...both(limb(7, 21, 4.5, 28, 1.3, 1, leg)),
        ...both(ball(4.3, 29.3, 2.2, 1.8, leg)),
        ...both(limb(4, 29.5, 1.8, 31, 0.6, 0.35, knee)), ...both(limb(4.5, 29.8, 4.5, 31.2, 0.6, 0.35, knee)), ...both(limb(5, 29.5, 6.8, 31, 0.6, 0.35, knee)),
        ...both(ball(7, 21, 1.4, 1.4, knee)),
      );
    }
    const mr = rear ? [3.8, 3.4] : [3.2, 2.8];    // how wide the maw gapes
    out.push(
      ball(16, hy, 6.2, 4.4, bronze),
      // the maw, round and wet, lipped in raw red. The hole itself is laid
      // flat and turned from the light: painted as a ball, the painter lit
      // its crown, and the dark of the throat came out a grey dome
      ball(16, hy + 1, mr[0] + 0.6, mr[1] + 0.5, '#8a3424'),
      sheet(oval(16, hy + 1, mr[0], mr[1]), '#3a0a0a', { tilt: [0.55, 0.6] }),
      sheet(oval(16, hy + 1.4, mr[0] * 0.6, mr[1] * 0.6), '#0a0204', { tilt: [0.7, 0.7] }),
      // one wet glint deep in it
      specks([[15, hy + 0.5], [15.5, hy + 0.5]], '#d07a60'),
    );
    if (rear) {
      // mandibles spread wide, ready to close
      out.push(
        ...both(limb(11, hy - 1, 6, hy - 2.5, 2, 1.6, jaw)), ...both(limb(6, hy - 2.5, 3.5, hy + 1, 1.6, 1.1, jaw)),
        ...both(limb(3.5, hy + 1, 4.8, hy + 4.2, 1.1, 0.5, gold)),
      );
    } else {
      out.push(
        ...both(limb(11, hy + 0.5, 7.5, hy + 3, 2, 1.6, jaw)), ...both(limb(7.5, hy + 3, 9, hy + 5.8, 1.6, 1.1, jaw)),
        ...both(limb(9, hy + 5.8, 12.3, hy + 6.3, 1.1, 0.5, gold)),
      );
    }
    out.push(
      // small dull eyes, and clubbed feelers
      dots([[11, hy - 2], [20, hy - 2]], '#d05a28'),
      ...both(limb(13, hy - 3, 10.5, hy - 6, 0.5, 0.5, leg)), ...both(ball(10, hy - 6.5, 1.2, 1, knee)),
    );
    // the fine detail: a ring of small teeth, the drool, the seam of the shell,
    // pits and flakes of rust, spines on the legs
    const teeth = [];
    // along the top and bottom of the rim only: a full ring of pale points
    // read as a gun-sight, not a mouth
    for (let a = 0; a < 16; a++) { if (a % 8 === 0 || a % 8 === 1 || a % 8 === 7) continue; const t = a / 16 * Math.PI * 2; teeth.push([16 + Math.cos(t) * (mr[0] - 0.6), hy + 1 + Math.sin(t) * (mr[1] - 0.5)]); }
    const pits = [];
    for (const f of [0.3, 0.62]) for (let y = 9; y <= 16.5; y += 1) {
      const w = 10.8 * Math.sqrt(1 - ((y - 15.5) / 8.4) ** 2) * f;
      pits.push([16 - w, y], [16 + w, y]);
    }
    out.push(
      specks(teeth, '#d8c8a4'),
      // drool hanging from the lip, not a rope down to the floor
      hair(15, hy + 1.5 + mr[1], 14.5, hy + 4 + mr[1], '#c89048'), hair(17.5, hy + 1.5 + mr[1], 18, hy + 3 + mr[1], '#c89048'), specks([[14.5, hy + 5 + mr[1]], [18, hy + 4 + mr[1]]], '#e0b060'),
      hair(16, 7.5 - sy, 16, 17.5 - sy, '#4a1c0c'),
      // pits in rows down each wing case, following its curve, as a beetle's
      // are, rather than scattered like dirt
      ...pits.map(([x, y]) => specks([[x, y - sy]], '#6a2a10')),
      // a bright edge on each crust of copper
      specks([[8.5, 11], [22, 8.5], [25, 13.5]].map(([x, y]) => [x, y - sy]), '#9ad0b8'),
      // flakes of rust coming away, on the floor beneath it
      specks([[8, 31.5], [23, 31.5]], '#c06a30'),
      ...both(specks([[1.5, 24], [1, 26], [2, 19]], '#8a5a30')),
      ...both(specks(rear ? [[4, 13], [3, 11], [5, 14.5]] : [[5.5, 24.5], [5, 26], [6.5, 23]], gold)),
    );
    // the shell is worn smooth: the painter's grain on it read as a second,
    // noisier coat of rust over the pits
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // The hero's hound: brown and scruffy, ears that flop, a frayed red collar
  // with a tag, and a tail that will not keep still. Nothing like the grey
  // things of the deep: shorter in the leg, warmer, and on your side.
  dog: (pose = 'idle') => {
    const coat = '#8a5a32', dark = '#5e3a1e', pale = '#c8a070', muzzle = '#a8784a', nose = '#1a1210';
    const bite = pose === 'windup', sit = pose === 'sit';
    const hy = bite ? 15.5 : sit ? 11.5 : 13;
    // told to stay, it sits: haunches down on the stone, forelegs straight, the
    // tail laid round its feet, and the head up, watching the way you went
    const hind = sit
      ? [...both(ball(10.6, 27.2, 3.2, 2.7, dark)), ...both(ball(9.6, 30.4, 1.9, 0.9, dark)),
        limb(20.5, 29.5, 24.5, 30.2, 1.1, 0.8, dark), limb(24.5, 30.2, 26.5, 28.8, 0.8, 0.5, coat)]
      : [limb(19, 18, 23, 13, 1.2, 0.8, dark), limb(23, 13, 24.5, 9.5, 0.8, 0.5, coat),
        ...both(limb(11, 21, 9.5, 26, 2, 1.3, dark)), ...both(limb(9.5, 26, 10, 30, 1.2, 1, dark)),
        ...both(ball(10, 30.4, 1.7, 0.9, dark))];
    const by = sit ? 22 : 20.5;
    return [
      // the tail up and waving behind, and the hind legs, short and sturdy
      ...hind,
      // a deep body with a saddle of darker coat (upright when it sits)
      sit ? ball(15.5, by, 5.6, 5.8, coat) : ball(15.5, by, 6.8, 4.6, coat),
      sit ? sheet([[11.5, 18.5], [19.5, 18.5], [19, 21], [12, 21]], dark, { curve: 1 }) : sheet([[10.5, 17.5], [20.5, 17.5], [19.5, 20], [11.5, 20]], dark, { curve: 1 }),
      // forelegs, braced for the spring if it means to bite, straight when it sits
      ...both(limb(12.5, by + 1, bite ? 10.5 : sit ? 12.8 : 12, 26.5, 1.7, 1.1, coat)), ...both(limb(bite ? 10.5 : sit ? 12.8 : 12, 26.5, bite ? 11 : sit ? 12.9 : 12.3, 30, 1.1, 1, coat)),
      ...both(ball(bite ? 11 : sit ? 12.9 : 12.3, 30.4, 1.7, 0.9, coat)),
      // a pale chest, and the collar with its tag
      ball(15.5, by + 2, 3, sit ? 3.6 : 3.2, pale),
      sheet([[12.6, hy + 3.4], [18.4, hy + 3.4], [18, hy + 4.6], [13, hy + 4.6]], '#a02828', { curve: 0.6 }),
      ball(15.5, hy + 5.6, 0.9, 1, '#d8b848'),
      // floppy ears hanging down beside a broad head
      ...both(sheet([[12.6, hy - 2.5], [9.5, hy - 1], [10.2, hy + 4], [12.4, hy + 2]], dark, { curve: 0.8, tilt: [-0.3, 0.2] })),
      ball(15.5, hy, 3.9, 3.4, coat),
      ...both(ball(13.9, hy - 0.8, 1.3, 0.9, '#3a2412')),
      // the muzzle, and the eyes, warm and brown with a catch of light
      bite ? sheet([[13.3, hy + 1.5], [17.7, hy + 1.5], [17.2, hy + 5.5], [13.8, hy + 5.5]], '#4a1818', { curve: 0.5 }) : limb(15.5, hy + 1, 15.5, hy + 3.6, 2.2, 1.7, muzzle),
      bite ? ball(15.5, hy + 5.4, 2, 1, muzzle) : ball(15.5, hy + 3.5, 1.4, 0.9, nose),
      dots([[14, Math.round(hy) - 1], [17, Math.round(hy) - 1]], '#2a1808'), dots([[14, Math.round(hy) - 2], [17, Math.round(hy) - 2]], '#f0d8a0'),
      ...(bite ? [dots([[14, Math.round(hy) + 2], [17, Math.round(hy) + 2], [14, Math.round(hy) + 4], [17, Math.round(hy) + 4]], '#f4ecdc')] : []),
      // fine work: a tuft on the head, whiskers, the tag's glint, claws, the coat's grain
      hair(15, hy - 3.2, 16, hy - 4, pale), specks([[13.5, hy + 2], [17.5, hy + 2]], '#e8d0a8'),
      specks([[15.5, hy + 5.5]], '#fff4c0'),
      ...both(specks([[9, 31], [10, 31], [11, 31]], '#e8dcc8')),
      hair(13, by - 1.5, 14.5, by + 0.5, '#6e4424'), hair(17.5, by - 1.5, 16.5, by + 1, '#6e4424'), hair(11.5, by + 1.5, 12, by + 3.5, '#a87848'),
    ];
  },

  // The druid's wolf: grey and lean where the hound is brown and scruffy, its
  // ears pricked, its eyes amber, no collar on it, and its tail carried low. It
  // comes to a druid in the delves that have no hound.
  wolf: (pose = 'idle') => {
    const coat = '#7c7e86', dark = '#4c4e58', pale = '#d4d2c8', muzzle = '#a2a2a6', nose = '#141216';
    const bite = pose === 'windup', sit = pose === 'sit';
    const hy = bite ? 15.5 : sit ? 11.5 : 13;
    // told to stay, it sits: haunches down on the stone, forelegs straight, the
    // tail laid round its feet, and the head up, watching the way you went
    const hind = sit
      ? [...both(ball(10.6, 27.2, 3.2, 2.7, dark)), ...both(ball(9.6, 30.4, 1.9, 0.9, dark)),
        limb(20.5, 29.5, 24.5, 30.2, 1.1, 0.8, dark), limb(24.5, 30.2, 26.5, 28.8, 0.8, 0.5, coat)]
      : [limb(20, 19, 24, 23, 1.7, 1.3, dark), limb(24, 23, 25, 26.5, 1.3, 0.6, pale),
        ...both(limb(11, 21, 9.5, 26, 2, 1.3, dark)), ...both(limb(9.5, 26, 10, 30, 1.2, 1, dark)),
        ...both(ball(10, 30.4, 1.7, 0.9, dark))];
    const by = sit ? 22 : 20.5;
    return [
      // the tail carried low behind, and the hind legs, long and lean
      ...hind,
      // a deep body with a saddle of darker coat (upright when it sits)
      sit ? ball(15.5, by, 5.6, 5.8, coat) : ball(15.5, by, 6.8, 4.6, coat),
      sit ? sheet([[11.5, 18.5], [19.5, 18.5], [19, 21], [12, 21]], dark, { curve: 1 }) : sheet([[10.5, 17.5], [20.5, 17.5], [19.5, 20], [11.5, 20]], dark, { curve: 1 }),
      // forelegs, braced for the spring if it means to bite, straight when it sits
      ...both(limb(12.5, by + 1, bite ? 10.5 : sit ? 12.8 : 12, 26.5, 1.7, 1.1, coat)), ...both(limb(bite ? 10.5 : sit ? 12.8 : 12, 26.5, bite ? 11 : sit ? 12.9 : 12.3, 30, 1.1, 1, coat)),
      ...both(ball(bite ? 11 : sit ? 12.9 : 12.3, 30.4, 1.7, 0.9, coat)),
      // a pale chest and a ruff of thicker fur at the throat, and no collar
      ball(15.5, by + 2, 3, sit ? 3.6 : 3.2, pale),
      sheet([[12, hy + 3], [19, hy + 3], [18, hy + 5.4], [15.5, hy + 6.4], [13, hy + 5.4]], pale, { curve: 0.8 }),
      // ears pricked up, pointed, over a narrower head
      ...both(sheet([[12.2, hy - 1.8], [11.4, hy - 6.4], [14.2, hy - 2.8]], dark, { curve: 0.3 })),
      ...both(sheet([[12.6, hy - 2.2], [12, hy - 5], [13.6, hy - 2.8]], '#8e7a6e', { curve: 0.3 })),
      ball(15.5, hy, 3.9, 3.4, coat),
      ...both(ball(13.9, hy - 0.8, 1.3, 0.9, '#3a2412')),
      // the muzzle, and the eyes, amber with a catch of light
      bite ? sheet([[13.3, hy + 1.5], [17.7, hy + 1.5], [17.2, hy + 5.5], [13.8, hy + 5.5]], '#4a1818', { curve: 0.5 }) : limb(15.5, hy + 1, 15.5, hy + 4.4, 2, 1.4, muzzle),
      bite ? ball(15.5, hy + 5.4, 2, 1, muzzle) : ball(15.5, hy + 4.3, 1.3, 0.9, nose),
      dots([[14, Math.round(hy) - 1], [17, Math.round(hy) - 1]], '#c07818'), dots([[14, Math.round(hy) - 2], [17, Math.round(hy) - 2]], '#f0b030'),
      ...(bite ? [dots([[14, Math.round(hy) + 2], [17, Math.round(hy) + 2], [14, Math.round(hy) + 4], [17, Math.round(hy) + 4]], '#f4ecdc')] : []),
      // fine work: a tuft on the head, whiskers, claws, the coat's grain
      hair(15, hy - 3.2, 16, hy - 4, pale), specks([[13.5, hy + 2], [17.5, hy + 2]], '#e8d0a8'),
      ...both(specks([[9, 31], [10, 31], [11, 31]], '#e8dcc8')),
      hair(13, by - 1.5, 14.5, by + 0.5, '#34363e'), hair(17.5, by - 1.5, 16.5, by + 1, '#34363e'), hair(11.5, by + 1.5, 12, by + 3.5, '#b4b4b0'),
    ];
  },

  // The sellsword: a hired blade, as tall as the hero. A kettle hat with a wide
  // iron brim, a brigandine of blue-grey cloth studded with brass over a mail
  // shirt, a red sash from shoulder to hip, a steel pauldron, a scar down the
  // cheek, and a greatsword: carried on the shoulder, swung up over the head
  // for the cut, and planted point-down to lean on while it waits for its pay.
  sellsword: (pose = 'idle') => {
    const skin = '#e6b694', shade = '#a87458', coat = '#4a566c', coatDk = '#323c4e', mail = '#7c8290', sash = '#a8322a', leather = '#6a4a30', boot = '#3a2c22',
      trouser = '#5a4a3a', steel = '#aeb4be', steelLt = '#e4e8ee', iron = '#6e747e', brass = '#c9a24a', grip = '#5a3a22', blade = '#d4d8e0';
    const cut = pose === 'windup', sit = pose === 'sit';
    // the body leans into the cut, or settles onto the sword
    const lean = cut ? 1.5 : sit ? -1 : 0, drop = cut ? 2 : sit ? 1 : 0;
    const hx = 32 + lean, hy = 9.5 + drop;
    // a greatsword from the grip at (x, y) along (u, v): pommel, grip, guard, blade, fuller
    const sword = (x, y, u, v, len) => [
      limb(x - u * 3.2, y - v * 3.2, x + u * 1.2, y + v * 1.2, 0.9, 0.9, grip),
      ball(x - u * 4, y - v * 4, 1.3, 1.3, brass),
      limb(x + u * 2 - v * 4.4, y + v * 2 + u * 4.4, x + u * 2 + v * 4.4, y + v * 2 - u * 4.4, 0.8, 0.8, iron),
      limb(x + u * 2.8, y + v * 2.8, x + u * len, y + v * len, 1.8, 0.7, blade, { smooth: 1 }),
      hair(x + u * 4, y + v * 4, x + u * (len - 3), y + v * (len - 3), '#8a909c'),
      hair(x + u * 4 - v, y + v * 4 + u, x + u * (len - 4) - v * 0.8, y + v * (len - 4) + u * 0.8, '#f6f8fc'),
    ];
    const hand = (x, y) => [ball(x, y, 2, 1.8, leather), specks([[x - 0.75, y - 0.75]], '#8a6a48')];
    const ty = drop, tl = lean * 0.6;
    const body = [
      // the mail below the brigandine, the coat, its brass rivets, the sash, the belt and its purse
      sheet([[22 + tl, 39 + ty], [42 + tl, 39 + ty], [43.5, 47.5 + ty], [20.5, 47.5 + ty]], mail, { curve: 0.6 }),
      ...[41.5, 43.5, 45.5].map(y => hair(21.5, y + ty, 42.5, y + ty, '#5a6068')),
      sheet([[21 + lean, 16 + ty], [43 + lean, 16 + ty], [43.5 + tl, 40 + ty], [20.5 + tl, 40 + ty]], coat, { curve: 1 }),
      sheet([[21 + lean, 16 + ty], [26 + lean, 16 + ty], [24.5 + tl, 40 + ty], [20.5 + tl, 40 + ty]], coatDk, { curve: 0.4 }),
      ...[20, 24, 28, 32, 36].flatMap(y => [23, 27.5, 36.5, 41].map(x => specks([[x + lean * (1 - y / 40), y + ty]], brass))),
      limb(41 + lean, 17 + ty, 23 + tl, 38 + ty, 1.4, 1.4, sash), hair(40 + lean, 16.5 + ty, 22.5 + tl, 37 + ty, '#d0584a'),
      line(20.5 + tl, 39.5 + ty, 43.5 + tl, 39.5 + ty, leather), ball(32 + tl, 39.5 + ty, 1.3, 1.1, brass),
      ball(39 + tl, 42.5 + ty, 2.2, 2.6, leather), dots([[39, Math.floor(41 + ty)]], brass),
      // the steel pauldron on the left shoulder
      ball(21.5 + lean, 17.5 + ty, 5, 3.6, steel), hair(17.5 + lean, 16.5 + ty, 25 + lean, 15.5 + ty, steelLt),
      ...[19.5, 23.5].map(x => ball(x + lean, 19.5 + ty, 0.6, 0.6, iron)),
      limb(32 + lean, 13 + ty, 32 + lean, 16.5 + ty, 2, 2.2, skin),
    ];
    let legs, arms;
    if (cut) {
      // a wide stance, the front foot forward, the sword swung up over the head and back
      legs = [
        limb(28, 46 + ty, 22, 54, 2.6, 2.3, trouser), limb(22, 54, 20.5, 60, 2.3, 2.1, boot), ball(19.5, 61.4, 3.6, 1.6, boot),
        limb(36, 46 + ty, 42, 53, 2.6, 2.3, trouser), limb(42, 53, 44, 60, 2.3, 2.1, boot), ball(45, 61.4, 3.6, 1.6, boot),
      ];
      arms = [
        limb(22 + lean, 18 + ty, 30, 6.5, 2.4, 2, coat), limb(42 + lean, 18 + ty, 38.5, 6, 2.4, 2, coat),
        ...sword(35, 4.6, -0.98, 0.2, 27),
        ...hand(32, 5.4), ...hand(37.5, 4.6),
      ];
    } else if (sit) {
      // the weight on one hip, the sword planted before it, both hands on the pommel
      legs = [
        limb(28, 47 + ty, 25.5, 55, 2.6, 2.3, trouser), limb(25.5, 55, 26, 60, 2.3, 2.1, boot), ball(25.5, 61.4, 3.4, 1.6, boot),
        limb(35, 47 + ty, 38.5, 54.5, 2.6, 2.3, trouser), limb(38.5, 54.5, 35.5, 60, 2.3, 2.1, boot), ball(35, 61.4, 3.4, 1.6, boot),
      ];
      arms = [
        ...sword(42, 33.5, 0, 1, 28),
        limb(21 + lean, 19 + ty, 24.5, 28.5, 2.4, 2, coat), limb(24.5, 28.5, 39, 31.5, 2, 1.8, coat),
        limb(42 + lean, 19 + ty, 44, 30, 2.4, 2, coat),
        ...hand(40, 31.4), ...hand(43.5, 31.8),
      ];
    } else {
      // standing easy, the sword carried back over the right shoulder
      legs = [
        ...both64(limb(28, 46, 27, 55, 2.6, 2.3, trouser)), ...both64(limb(27, 55, 26.8, 60, 2.3, 2.1, boot)), ...both64(ball(26.2, 61.4, 3.4, 1.6, boot)),
      ];
      arms = [
        limb(21, 19, 19.5, 30, 2.4, 2, coat), limb(19.5, 30, 20, 37, 2, 1.8, leather), ...hand(20, 38.4),
        ...sword(41, 31, 0.5, -0.86, 29),
        limb(43, 19, 46, 29, 2.4, 2, coat), limb(46, 29, 41.5, 31.5, 2, 1.8, coat), ...hand(41, 31.2),
      ];
    }
    // the head: a hard, weathered face under the kettle hat's brim; eyes narrowed when it leans and waits
    const head = [
      ball(hx, hy, 3.6, 4.3, skin), ball(hx, hy + 3.6, 2.8, 1.5, skin),
      ball(hx, hy - 3.6, 4.4, 3, steel), hair(hx - 3, hy - 5, hx, hy - 6.2, steelLt),
      sheet(oval(hx, hy - 1.6, 8, 1.6), iron, { curve: 0.4 }), hair(hx - 7, hy - 2, hx + 2, hy - 2.75, '#9aa0aa'),
      ball(hx - 3.8, hy + 1, 0.6, 1.1, shade), ball(hx + 3.8, hy + 1, 0.6, 1.1, shade),
      hair(hx - 2.5, hy - 0.25, hx - 0.75, hy, '#3a2a20'), hair(hx + 0.75, hy, hx + 2.5, hy - 0.25, '#3a2a20'),
      dots(sit ? [[Math.floor(hx - 2), Math.floor(hy + 1)], [Math.floor(hx + 1), Math.floor(hy + 1)]] : [[Math.floor(hx - 2), Math.floor(hy + 0.5)], [Math.floor(hx + 1), Math.floor(hy + 0.5)]], '#1e1a1a'),
      limb(hx, hy + 0.6, hx + 0.2, hy + 2.6, 0.5, 0.75, shade),
      hair(hx - 1.25, hy + 3.75, hx + 1.25, hy + 3.75, cut ? '#3a1a14' : '#7a4434'),
      // the scar, the stubble
      hair(hx + 2, hy - 0.5, hx + 2.75, hy + 3, '#e8c0a8'),
      specks([[hx - 2, hy + 4], [hx - 1, hy + 4.75], [hx, hy + 5], [hx + 1, hy + 4.75], [hx + 2, hy + 4]], '#7a5a44'),
    ];
    return [...legs, ...body, ...arms, ...head];
  },
  // The healer: a hooded robe of grey-green wool belted with a cord, a satchel
  // on a strap across the chest with sprigs of herb sticking out of it, a leaf
  // stitched in pale thread over the heart, and a staff of ash with a bundle of
  // dried herbs and a little bell tied below its head. A kind, tired face in the
  // hood's shadow. Rapping, it swings the staff up in both hands to bring it
  // down; told to wait, it kneels with the staff laid by and its hands in the
  // open satchel, a roll of bandage between them.
  mender: (pose = 'idle') => {
    const robe = '#6a7a62', robeDk = '#4e5c48', robeLt = '#8a9a80', hood = '#56664e', cord = '#c8b48a', strap = '#6a4a30',
      bag = '#8a6440', leaf = '#5e9a48', ash = '#a8865a', herb = '#b8a058', bell = '#c9a24a', linen = '#e8e2d2', skin = '#ecc0a0', skinDk = '#b0806a', hairc = '#6a4630';
    const rap = pose === 'windup', sit = pose === 'sit';
    // kneeling, the whole of it sits lower and the robe pools on the floor
    const dy = sit ? 9 : 0, lean = rap ? 1.5 : 0;
    const hx = 32 + lean, hy = 9.5 + dy + (rap ? 1 : 0);
    // the staff from (x1, y1) to its head at (x2, y2): the wood, the herbs and the bell tied below the head
    const staff = (x1, y1, x2, y2) => {
      const l = Math.hypot(x2 - x1, y2 - y1), u = (x2 - x1) / l, v = (y2 - y1) / l, bx = x2 - u * 5, by = y2 - v * 5;
      return [
        limb(x1, y1, x2, y2, 0.9, 1.1, ash), hair(x1 - v * 0.5, y1 + u * 0.5, x2 - v * 0.5, y2 + u * 0.5, '#7a5e3a'),
        ball(x2, y2, 1.6, 1.6, ash),
        limb(bx - v * 0.4, by + u * 0.4, bx - v * 3.4 + u * 2.4, by + u * 3.4 + v * 2.4, 1.3, 0.6, herb),
        hair(bx, by, bx - v * 2.8 + u * 3, by + u * 2.8 + v * 3, '#7a8a3a'),
        line(bx - v * 0.4, by + u * 0.4, bx + v * 1.6, by - u * 1.6, cord),
        ball(bx + v * 2.4, by - u * 2.4 + 1.2, 1, 1.2, bell), specks([[bx + v * 2.4, by - u * 2.4 + 2.5]], '#5a4420'),
      ];
    };
    const hand = (x, y) => [ball(x, y, 1.8, 1.7, skin), specks([[x - 0.75, y - 0.75]], '#e8c0a0')];
    // the robe: wide at the hem, pooled on the floor when it kneels
    const body = sit ? [
      sheet([[22, 16 + dy], [42, 16 + dy], [47, 50], [52, 61], [12, 61], [17, 50]], robe, { curve: 1 }),
      sheet([[12, 58], [52, 58], [54, 63], [10, 63]], robeDk, { curve: 0.6 }),
    ] : [
      sheet([[22, 16], [42, 16], [45, 38], [47, 62], [42, 63], [37, 61.6], [32, 63], [27, 61.6], [22, 63], [17, 62], [19, 38]], robe, { curve: 1 }),
      ...[[25, 40, 21.5, 62], [31.2, 40, 31, 63], [37.5, 40, 41.5, 62]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1.3, y0], [x1 + 1.1, y1], [x1 - 0.9, y1]], robeDk, { curve: 0.3 })),
      ...[[28, 40, 26, 62], [34.5, 40, 36.5, 62]].map(([x0, y0, x1, y1]) => sheet([[x0, y0], [x0 + 1, y0], [x1 + 1, y1], [x1 - 0.6, y1]], robeLt, { curve: 0.3 })),
      ...both64(ball(27, 62.2, 2.4, 1, '#4a3a2a')),
    ];
    body.push(
      // the cord at the waist, its knotted ends hanging
      line(19.5 + lean * 0.5, 37 + dy, 44.5 + lean * 0.5, 37 + dy, cord),
      limb(27 + lean * 0.5, 37.5 + dy, 26 + lean * 0.5, 45 + dy, 0.5, 0.4, cord), ball(26 + lean * 0.5, 45.6 + dy, 0.8, 0.9, cord),
      // the strap from the left shoulder to the right hip, and the satchel on it
      limb(23.5 + lean, 17 + dy, 39.5 + lean * 0.5, 38 + dy, 0.8, 0.8, strap),
      sheet([[36, 36 + dy], [45, 36 + dy], [45.6, 44.5 + dy], [35.4, 44.5 + dy]], bag, { curve: 0.5 }),
      sheet([[35.6, 35.6 + dy], [45.4, 35.6 + dy], [45, 39 + dy], [36, 39 + dy]], '#76522e', { curve: 0.3 }),
      dots([[40, Math.floor(39.8 + dy)]], bell),
      ...[[37, 33.5], [39, 32.6], [41.5, 33], [43.5, 34]].map(([x, y]) => line(x, 35.6 + dy, x + (x - 40) * 0.25, y + dy, leaf)),
      specks([[36.5, 33.5 + dy], [39, 32.5 + dy], [42, 33 + dy], [44, 34 + dy]], '#8ac864'),
      // the leaf stitched over the heart
      sheet([[25.2 + lean, 26 + dy], [27.2 + lean, 23 + dy], [29.2 + lean, 26 + dy], [27.2 + lean, 28 + dy]], '#c8d8b0', { curve: 0.3 }),
      hair(27.2 + lean, 23.25 + dy, 27.2 + lean, 27.75 + dy, '#8aa070'),
    );
    let arms;
    if (rap) {
      // the staff swung up over the head in both hands, to come down on the foe
      arms = [
        ...staff(46, 7.6, 11, 2.6),
        limb(22 + lean, 18, 25.5, 6.5, 2, 1.6, robe), limb(42 + lean, 18, 39.5, 7, 2, 1.6, robe),
        ...hand(26, 5.6), ...hand(39.5, 6.4),
      ];
    } else if (sit) {
      // the staff laid on the floor beside it, both hands in the satchel with a roll of bandage
      arms = [
        ...staff(50, 61.6, 13, 60.6),
        limb(22, 19 + dy, 27, 32 + dy, 2, 1.8, robe), limb(27, 32 + dy, 36, 37 + dy, 1.8, 1.6, robe),
        limb(42, 19 + dy, 44.5, 31 + dy, 2, 1.8, robe),
        ball(39, 37.6 + dy, 2.4, 1.9, linen), hair(37, 37 + dy, 41, 38.5 + dy, '#b8b0a0'),
        ...hand(36.6, 37.8 + dy), ...hand(42.4, 36.6 + dy),
      ];
    } else {
      // the staff planted upright in the right hand, the left hand on the satchel
      arms = [
        ...staff(16, 62, 16, 6),
        limb(22, 19, 18.5, 34, 2, 1.8, robe), ...hand(17.5, 35),
        limb(42, 19, 44, 33.5, 2, 1.8, robe), ...hand(43.5, 35.5),
      ];
    }
    // the head in its hood: a round, kind face, a lock of hair, a small tired smile
    const head = [
      sheet([[hx - 8, hy + 7.5], [hx - 7.6, hy - 2.5], [hx - 4.4, hy - 8.4], [hx + 4.4, hy - 8.4], [hx + 7.6, hy - 2.5], [hx + 8, hy + 7.5], [hx, hy + 9.4]], hood, { curve: 1 }),
      sheet([[hx - 5.5, hy + 6], [hx - 5.4, hy - 3], [hx - 3, hy - 6.4], [hx + 3, hy - 6.4], [hx + 5.4, hy - 3], [hx + 5.5, hy + 6]], '#2e3628', { curve: 0.6 }),
      ball(hx, hy + 0.6, 3.6, 4.2, skin), ball(hx, hy + 3.8, 2.6, 1.4, skin),
      limb(hx - 3.6, hy - 3, hx + 1.2, hy - 4, 1.4, 0.9, hairc),
      ball(hx - 3.6, hy + 1.5, 0.5, 1, skinDk), ball(hx + 3.6, hy + 1.5, 0.5, 1, skinDk),
      hair(hx - 2.5, hy - 0.25, hx - 1, hy, '#5a3a28'), hair(hx + 1, hy, hx + 2.5, hy - 0.25, '#5a3a28'),
      dots([[Math.floor(hx - 2), Math.floor(hy + 1)], [Math.floor(hx + 1), Math.floor(hy + 1)]], '#2a2020'),
      limb(hx, hy + 1.2, hx + 0.2, hy + 3, 0.5, 0.7, skinDk),
      hair(hx - 1.5, hy + 4, hx - 0.5, hy + 4.5, rap ? '#5a2a20' : '#8a4a3a'), hair(hx - 0.5, hy + 4.5, hx + 1.5, hy + 4, rap ? '#5a2a20' : '#8a4a3a'),
      specks([[hx - 2.25, hy + 2.75], [hx + 2.25, hy + 2.75]], '#e0a088'),
      hair(hx - 3.5, hy - 6.5, hx - 6.5, hy + 4, '#465640'),
    ];
    return [...body, ...arms, ...head];
  },
  scrag: (pose = 'idle') => {
    const skin = '#72ac4c', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c', cloth = '#6a5c4a', cord = '#4a3a28';
    const iron = '#6e727c', brass = '#c9a24a', steel = '#c0c4cc', grip = '#6a4a2a';
    const stab = pose === 'windup', sit = pose === 'sit';
    const hx = stab ? 16.5 : 16, hy = stab ? 17 : sit ? 17.2 : 14.8;
    // how far the body has dropped: a long way for the lunge, a little to squat
    const dy = stab ? 2.2 : sit ? 2.4 : 0, belt = 23.6 + dy;
    // the rag: a hooded mantle over the shoulders, chewed ragged at the hem
    const mantle = sheet([[12, 18 + dy], [20, 18 + dy], [22.4, 19.2 + dy], [23.2, 21.8 + dy], [21.8, 21.2 + dy], [20.8, 22.6 + dy], [19.4, 21.4 + dy], [18, 22.8 + dy],
      [16.4, 21.6 + dy], [14.8, 22.8 + dy], [13.2, 21.4 + dy], [11.6, 22.6 + dy], [10.2, 21.2 + dy], [8.8, 21.8 + dy], [9.6, 19.2 + dy]], rag, { curve: 1 });
    // the ring of picks and a key, hung at the belt
    const kx = sit ? 15.5 : 18.5, ky = Math.round(belt) + 1.5;
    const picks = [
      hair(kx - 0.8, ky + 0.6, kx - 1.6, ky + 3, '#9aa0aa'), hair(kx - 0.2, ky + 0.8, kx - 0.4, ky + 3.4, '#9aa0aa'),
      line(kx + 1, ky + 1, kx + 1.4, ky + 3, brass), specks([[kx + 1.5, ky + 2.5], [kx + 2, ky + 2.5], [kx + 2, ky + 3]], brass),
      ball(kx, ky, 1.2, 1.2, brass), dots([[Math.floor(kx), Math.floor(ky)]], '#2a1e14'),
    ];
    // an iron cuff across the wrist (u, v: half the band, the way it runs),
    // and what is left of its chain: links alternately face on and edge on,
    // the last one sprung open where it broke
    const cuff = (x, y, u, v, links) => [
      ...links.map(([lx, ly], i) => i % 2 ? limb(lx, ly - 0.6, lx, ly + 0.6, 0.4, 0.4, '#585c66') : ball(lx, ly, 0.8, 0.85, iron)),
      ...links.map(([lx, ly], i) => i % 2 ? hair(lx, ly - 0.5, lx, ly, '#a8acb4') : specks([[lx, ly]], '#1c1a22')),
      hair(links[links.length - 1][0] - 0.5, links[links.length - 1][1] + 0.5, links[links.length - 1][0] - 1, links[links.length - 1][1] + 1, iron),
      limb(x - u, y - v, x + u, y + v, 0.9, 0.9, iron),
      hair(x - u, y - v - 0.5, x + u * 0.6, y + v * 0.6 - 0.5, '#c8ccd4'),
    ];
    // a short knife with a kink in the blade, from the fist at (x, y) along (u, v)
    const knife = (x, y, u, v) => [
      limb(x + u * 0.9, y + v * 0.9, x + u * 3.2, y + v * 3.2, 0.65, 0.55, steel, { smooth: 1 }),
      limb(x + u * 3.2, y + v * 3.2, x + u * 4.4 + v * 0.6, y + v * 4.4 - u * 0.6, 0.55, 0.3, steel, { smooth: 1 }),
      hair(x + u * 1.2 - v * 0.3, y + v * 1.2 + u * 0.3, x + u * 3.2 - v * 0.3, y + v * 3.2 + u * 0.3, '#f4f6fa'),
    ];
    const body = [
      ball(16, 22.6 + dy, 3.2, 3.6, skin),
      sheet([[12.8, belt], [19.2, belt], [18.8, belt + 3], [17.6, belt + 2.2], [16.4, belt + 3.4], [15, belt + 2.2], [13.4, belt + 2.8]], cloth, { curve: 0.8 }),
      line(12, belt, 20, belt, cord),
      ...picks,
    ];
    let parts;
    if (stab) {
      parts = [
        limb(14.6, 26.4, 10.6, 27.8, 1.1, 0.9, dark), limb(10.6, 27.8, 9.8, 30.2, 0.9, 0.75, dark), ball(9.6, 30.4, 1.9, 0.8, foot),
        limb(17.6, 26.4, 21.6, 27.6, 1.1, 0.9, dark), limb(21.6, 27.6, 22.4, 30.2, 0.9, 0.75, dark), ball(22.6, 30.4, 1.9, 0.8, foot),
        ball(10.6, 27.8, 1.1, 1, dark), ball(21.6, 27.6, 1.1, 1, dark),
        ...body,
        // the chained arm flung back for balance, the knife driven up at you
        limb(12.2, 21.4, 7, 23.8, 0.95, 0.85, skin), limb(19.8, 21.4, 25.2, 19.4, 0.95, 0.85, skin),
        mantle,
        ...cuff(8, 23.3, 0.45, 1.05, [[6.8, 25.2], [6, 26.5], [5.2, 27.8]]),
        ball(6.3, 24.2, 1.3, 1.2, skin),
        ...knife(26, 18.8, 0.6, -0.8),
        ball(26, 18.8, 1.3, 1.2, skin),
      ];
    } else if (sit) {
      parts = [
        // on its heels, knees out wide and feet together under it
        ...both(limb(9, 26.2, 12.6, 30, 1, 0.85, dark)), ...both(ball(12.8, 30.4, 1.9, 0.9, foot)),
        ...body,
        ...both(limb(14, 27.6, 9.2, 26, 1.2, 1.1, dark)), ...both(ball(9, 25.8, 1.4, 1.3, dark)),
        // the knife pushed through the belt, only the grip showing
        limb(18.2, belt - 1.6, 19, belt + 0.6, 0.55, 0.55, grip), dots([[18, belt - 2]], brass),
        ...both(limb(12, 21.4, 9.2, 24.6, 0.95, 0.85, skin)),
        mantle,
        ...cuff(9.8, 23.9, 0.9, 0.7, [[7.6, 24.8], [7.1, 26.2], [6.8, 27.6]]),
        ...both(ball(9, 24.9, 1.4, 1.1, skin)),
      ];
    } else {
      parts = [
        ...both(limb(14.4, 25, 12.2, 27.6, 1.1, 0.9, dark)), ...both(limb(12.2, 27.6, 12.8, 30.2, 0.9, 0.75, dark)),
        ...both(ball(12.2, 27.6, 1.1, 1, dark)), ...both(ball(12.4, 30.4, 1.9, 0.8, foot)),
        ...body,
        ...both(limb(12.2, 19.8, 10.6, 23.4, 0.95, 0.85, skin)),
        mantle,
        ...cuff(10.8, 22.6, 1.05, -0.15, [[8.6, 23.8], [8.4, 25.2], [8.3, 26.6]]),
        ball(10.4, 24.2, 1.3, 1.2, skin),
        // the knife held low, point down and out
        ...knife(21.6, 24.2, 0.45, 0.9),
        ball(21.6, 24.2, 1.3, 1.2, skin),
      ];
    }
    return [
      ...parts,
      ...scragHead(hx, hy, { look: stab ? 0 : sit ? -1 : 1, mouth: stab ? 'teeth' : 'grin' }),
      // fine work: ribs, frayed threads at the hem, a darn in the rag, toes
      hair(14.5, 21.6 + dy, 14, 22.6 + dy, '#4c7e34'), hair(17.5, 21.6 + dy, 18, 22.6 + dy, '#4c7e34'),
      hair(11.8, 22.4 + dy, 11.6, 23.4 + dy, rag), hair(18, 22.6 + dy, 18.2, 23.6 + dy, rag),
      specks([[13, 19.5 + dy], [13.5, 20 + dy], [14, 19.5 + dy], [14.5, 20 + dy]], '#a89a82'),
      ...(stab ? [] : both(specks([[sit ? 12 : 11, 30.5], [sit ? 13 : 12, 30.5]], '#e8e0c0'))),
    ];
  },

  // A long grey hound of the deep, all rib and sinew on legs too long for it,
  // with pale eyes that stay lit in the dark. It steps out of the world and
  // back in somewhere else, and its edges never quite settle. Going, it thins
  // to slats of itself and only the eyes stay whole; about to bite, its
  // hackles stand and its head drops, jaws open.
  hound: (pose = 'idle') => {
    const coat = '#767a86', dark = '#4c505c', pale = '#94989f', muzzle = '#8c909a', nose = '#16161e';
    const fade = pose === 'special', bite = pose === 'windup';
    const hy = bite ? 15 : 11.5;    // the head
    const sh = bite ? 1 : 0;        // the shoulders, hunched for the spring
    /** @type {any[]} its own parts are read back below, to cut into slats */
    const out = [
      // the tail, a thin whip up behind it
      limb(20, 15, 24, 11, 0.9, 0.6, dark), limb(24, 11, 25.5, 6, 0.6, 0.45, dark),
      // the hind legs, well back behind the ribs: a high hock, a thin shank
      ...both(limb(10.5, 17.5, 8.3, 24, 1.8, 0.9, dark)), ...both(limb(8.3, 24, 9, 30, 0.9, 0.7, dark)),
      ...both(ball(8.8, 30.4, 1.4, 0.7, dark)),
      // the barrel of the ribs, and the shoulder blades standing up out of it
      ball(15.5, 16.5 + sh, 6.4, 4.2, coat),
      ball(15.5, 20 + sh, 4.5, 1.6, dark),
      ...both(ball(11.2, 14 + sh, 2.3, 2, '#686c78')),
    ];
    if (bite) {
      // hackles up along the neck and shoulders, a ragged ruff behind the head
      for (const a of [-170, -150, -130, -110, -90, -70, -50, -30, -10]) {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), h = 2.6 + (a % 20 ? 1 : 0);
        const bx = 15.5 + dx * 6, by = 14.5 + dy * 3.2;
        out.push(sheet([[bx - dy * 1.1, by + dx * 1.1], [bx + dx * h, by + dy * h], [bx + dy * 1.1, by - dx * 1.1]], dark, { tilt: [dx * 0.5, dy * 0.5] }));
      }
      // forelegs braced wide and bent, for the spring
      out.push(...both(limb(12, 18.5, 10, 24.5, 1.6, 0.9, coat)), ...both(limb(10, 24.5, 10.8, 30, 0.9, 0.8, coat)),
        ...both(ball(10.6, 30.4, 1.6, 0.8, coat)));
    } else {
      out.push(...both(limb(12.2, 17.5, 11.9, 25, 1.5, 0.8, coat)), ...both(limb(11.9, 25, 12.3, 30, 0.8, 0.7, coat)),
        ...both(ball(12.2, 30.4, 1.5, 0.8, coat)));
    }
    out.push(
      // a narrow keel of a chest under the head
      ball(15.5, 19.2, 2.4, 3.2, pale),
      // tall ears, pricked, or laid back flat for the bite
      ...both(sheet(bite ? [[13, hy - 1.5], [8.5, hy - 4.5], [14.2, hy - 3]] : [[13, hy - 1.5], [11.3, hy - 8.5], [14.8, hy - 3]], coat, { tilt: [-0.4, -0.3] })),
      ...both(sheet(bite ? [[13, hy - 2], [10, hy - 4], [13.8, hy - 3]] : [[13.2, hy - 2.2], [12, hy - 7], [14.3, hy - 3.2]], '#3a2e3e', { tilt: [-0.2, -0.2] })),
      // a wedge of a head: broad at the skull, down to a long muzzle
      ball(15.5, hy, 3.8, 3, coat),
      ...both(ball(13.4, hy + 1.8, 1.7, 1.5, coat)),
      // a heavy brow over deep sockets
      ...both(ball(13.9, hy - 0.4, 1.5, 1.1, '#24262e')),
    );
    const ey = Math.round(hy) - 1;
    if (bite) {
      // the jaws open: a dark mouth, teeth top and bottom, the lower jaw dropped
      out.push(
        sheet([[12.8, hy + 1.5], [18.2, hy + 1.5], [17.5, hy + 7], [13.5, hy + 7]], '#3a1418', { curve: 0.5 }),
        ball(15.5, hy + 7, 2.3, 1.1, muzzle),
        limb(15.5, hy + 0.5, 15.5, hy + 2.6, 2.3, 1.9, muzzle),
        ...both(specks([[13.5, hy + 2.5], [13.5, hy + 3], [13.5, hy + 3.5], [14, hy + 6.5], [14, hy + 6], [14, hy + 5.5]], '#f0ead8')),
        dots([[15, Math.round(hy) + 5], [16, Math.round(hy) + 5]], '#b04a50'),
        dots([[15, Math.round(hy) + 2], [16, Math.round(hy) + 2]], nose),
        dots([[13, ey + 1], [14, ey + 1], [17, ey + 1], [18, ey + 1]], '#c8ecff'), dots([[14, ey + 1], [17, ey + 1]], '#f8feff'),
      );
    } else {
      out.push(
        limb(15.5, hy + 1, 15.5, hy + 4.4, 2.1, 1.5, muzzle),
        ball(15.5, hy + 4.3, 1.4, 0.9, nose),
        dots([[15, Math.round(hy) + 3]], '#9a9ca8'),
        dots(fade ? [[12, ey], [13, ey], [14, ey], [17, ey], [18, ey], [19, ey], [13, ey + 1], [14, ey + 1], [17, ey + 1], [18, ey + 1]]
          : [[13, ey], [14, ey], [17, ey], [18, ey]], '#c8ecff'),
        dots([[14, ey], [17, ey]], '#f8feff'),
      );
    }
    // the flanks tear where it slips half out of the world: stray pixels of it
    // left a step off its outline
    out.push(dots(bite ? [[5, 17], [26, 19], [6, 25]] : [[7, 15], [24, 19], [6, 23]], '#6a6e7a'));
    if (!fade) return out;
    // going: all of it but the eyes cut into slats, each row slid a little
    // off the next, and a violet light where the world closes over it
    const gaps = [2, 5, 8, 11, 13, 16, 19, 21, 24, 27];
    const keep = r => !gaps.includes(r);
    const tear = r => [0, 0.5, -0.5, 1, 0, -1, 0.5, 0, -0.5][r % 9];
    /** @type {object[]} */
    const gone = [];
    for (const p of out) {
      if (p.k === 'dots') continue;
      const c = p.c === dark ? '#5a5a78' : p.c === pale ? '#b8b0d4' : p.c === '#24262e' ? '#24262e' : '#8a88a4';
      // some rows catch the light of the tear more than others
      gone.push(...slats({ ...p, c }, keep, tear).map(q => (q.y1 % 7 === 3.5 && c !== '#24262e' ? { ...q, c: '#c4b8f0' } : q)));
    }
    gone.push(...out.filter(p => p.k === 'dots' && p.c !== '#6a6e7a'),
      dots([[11, ey], [20, ey]], '#a890ff'), dots([[15, ey - 1], [16, ey - 1]], '#d8ccff'));
    return gone;
  },

  // A squat, heavy beast like a boar, under a mantle of long dark quills with
  // pale points. Small mean eyes, tusks, legs hardly longer than hooves.
  // Roused, the quills stand straight out all round it in a bristling crown;
  // about to gore, its head goes down and the tusks come up and forward.
  quillback: (pose = 'idle') => {
    const hide = '#5e4a3a', dark = '#3a2c24', quill = '#2c2630', mantle = '#2e2830', tip = '#e2d8ba', snout = '#9a7466', tusk = '#f0e8d0';
    const bristle = pose === 'special', gore = pose === 'windup';
    const hy = gore ? 24 : 21.5;    // the head
    const my = gore ? 16.5 : 18;    // the crown of the mantle
    // the quills, from the mantle outward: [angle, length]. At rest they lie
    // back along it and show short; raised, they stand out their full length
    const rake = bristle
      ? [[-200, 10], [-188, 13], [-176, 11], [-164, 14], [-152, 12], [-140, 15], [-128, 13], [-116, 15], [-104, 14], [-92, 16], [-80, 14], [-68, 15], [-56, 13], [-44, 15], [-32, 12], [-20, 14], [-8, 11], [4, 13], [16, 10]]
      : gore ? [[-160, 5], [-145, 6.5], [-130, 7], [-115, 7.5], [-100, 8], [-85, 8], [-70, 7.5], [-55, 7], [-40, 6.5], [-25, 5]]
        : [[-172, 5], [-158, 6.5], [-144, 6], [-130, 7], [-116, 6.5], [-102, 7.5], [-88, 7], [-74, 7.5], [-60, 6.5], [-46, 7], [-32, 6], [-18, 6.5], [-6, 5]];
    /** @param {number[]} q  [angle, length] @param {number} i @param {boolean} back */
    const quillAt = (q, i, back) => {
      const [a, len] = q, t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      const bx = 16 + dx * 8.5, by = my + 1 + dy * 4.5;
      const l = back ? len : len * 0.72, sway = back ? 0 : (i % 2 ? 0.1 : -0.1);
      const ex = bx + (dx + sway) * l, ey = by + dy * l, f = bristle ? 0.8 : 0.84, mx = bx + (dx + sway) * l * f, mY = by + dy * l * f;
      return [limb(bx, by, mx, mY, back ? 1 : 0.9, 0.5, back ? quill : '#3e3440'), limb(mx, mY, ex, ey, 0.5, 0.3, tip)];
    };
    /** @type {object[]} */
    const out = [
      // the long quills behind, the shorter row in front of them
      ...rake.flatMap((q, i) => quillAt(q, i, true)),
      ...rake.filter((_, i) => i % 2).map(([a, l]) => [a + (bristle ? 6 : 7), l]).flatMap((q, i) => quillAt(q, i, false)),
      // the hind legs, stubby and set wide
      ...both(limb(8, 24, 7, 29.5, 2.1, 1.9, dark)), ...both(ball(7, 30.3, 2.3, 1, '#221a18')),
      // the body under its mantle
      ball(16, 22, 10.5, 6.8, hide),
      ball(16, my + 1.5, 10.8, 5.6, mantle),
      // quills laid over the mantle in rows, pointing back and up
      ...[0, 1, 2].flatMap(row => Array.from({ length: 9 - row }, (_, i) => {
        const x = 7.5 + i * 2 + row + ((i * 7 + row * 3) % 5 - 2) * 0.25, y = my + 5.5 - row * 2 + (i % 3) * 0.4, lean = (x - 16) * 0.3;
        const up = (bristle ? 4.5 : 3.2) + (i + row) % 3 * 0.6;
        return limb(x, y, x + lean, y - up, 0.7, 0.35, (i + row) % 2 ? '#241e28' : '#3e3642');
      })),
      // forelegs, short and thick, braced out when it lowers its head
      ...(gore
        ? [...both(limb(11.5, 25, 10, 29.8, 2.3, 2, hide)), ...both(ball(9.8, 30.4, 2.4, 1, '#221a18'))]
        : [...both(limb(12, 25, 11.5, 29.8, 2.2, 2, hide)), ...both(ball(11.3, 30.4, 2.3, 1, '#221a18'))]),
      // small ears poking out of the quills
      ...both(sheet([[11.5, hy - 2.5], [9, hy - 5.5], [13.5, hy - 3.8]], hide, { tilt: [-0.4, -0.2] })),
      // the head, square on: a broad skull, a snout like a stopper
      ball(16, hy, 5.4, 4, hide),
      ball(16, hy - 2, 4.8, 1.4, '#4a3a2e'),
      ball(16, hy + 3.2, 3, 2.1, snout),
      ball(16, hy + 3, 2.2, 1.4, '#b08878'),
      dots([[15, Math.round(hy) + 3], [17, Math.round(hy) + 3]], '#2a1614'),
      // small, mean, red, sunk under the brow
      dots([[13, Math.round(hy) - 1], [19, Math.round(hy) - 1]], '#ff3a1c'),
      dots([[12, Math.round(hy) - 1], [20, Math.round(hy) - 1]], '#1c1010'),
      // the mouth
      hair(12.5, hy + 4.5, 19.5, hy + 4.5, '#2a1614'),
    ];
    // tusks up out of the corners of the mouth; brought forward to gore, they
    // curve out wide and long
    const tk = gore ? [[12.5, hy + 4.5, 8.5, hy + 1.5, 7.5, hy - 2.5]] : [[12.8, hy + 4.2, 10.8, hy + 2.5, 10.5, hy + 0.2]];
    for (const [x1, y1, x2, y2, x3, y3] of tk) {
      out.push(...both(limb(x1, y1, x2, y2, gore ? 1.1 : 0.9, gore ? 0.8 : 0.7, tusk)), ...both(limb(x2, y2, x3, y3, gore ? 0.8 : 0.7, 0.4, tusk)));
    }
    return out;
  },

  // A young drake of the deep, wingless and heavy, low on splayed forelegs:
  // rust-red scales, a paler belly, a horned head on a thick neck. Rearing
  // up to breathe, its jaws gape and fire gathers in the throat; drawing
  // back to bite, the neck coils and the jaws part.
  wyrm: (pose = 'idle') => {
    const hide = '#8a3622', dark = '#5a2016', scale = '#a44428', belly = '#c8966a', horn = '#dccaa0', claw = '#efe4c8';
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 15 : 16, hy = rear ? 6.5 : coil ? 13.5 : 11.5;    // the head
    const cy = rear ? -1.5 : coil ? -1 : 0;                                // how high the shoulders ride
    /** @type {object[]} */
    const out = [
      // the tail, round the front of it on the floor
      limb(22, 25, 27.5, 28, 3, 2.3, dark), limb(27.5, 28, 30, 25, 2.3, 1.3, dark), limb(30, 25, 29.5, 22, 1.3, 0.6, dark),
      // the hind feet, planted behind
      ...both(limb(9.5, 24, 9, 29.5, 2.4, 2, dark)), ...both(ball(9, 30.2, 2.6, 1.1, dark)),
      // a ridge of spines down the back, over the shoulders behind the neck
      ...[[-155, 2.8], [-135, 3.6], [-115, 4.2], [-65, 4.2], [-45, 3.6], [-25, 2.8]].map(([a, h]) => {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), bx = 16 + dx * 8.5, by = 20 + cy + dy * 4.5;
        return sheet([[bx - dy * 1.3, by + dx * 1.3], [bx + dx * h, by + dy * h], [bx + dy * 1.3, by - dx * 1.3]], horn, { tilt: [dx * 0.5, dy * 0.5] });
      }),
      // the great barrel of the body, low to the floor
      ball(16, 22 + cy * 0.5, 11, 6.3, hide),
    ];
    // the forelegs, splayed wide like a lizard's, or lifted, claws out, as it rears
    if (rear) {
      out.push(
        ...both(ball(7, 19.5 + cy, 3.6, 3.3, scale)),
        ...both(limb(7, 19.5 + cy, 3, 15.5, 3, 2.3, scale)), ...both(limb(3, 15.5, 4.5, 11, 2.3, 1.8, scale)),
        ...both(ball(4.5, 10.5, 2.2, 1.8, dark)),
        ...both(limb(3.6, 9.6, 2.6, 8, 0.7, 0.3, claw)), ...both(limb(4.8, 9.2, 4.9, 7.6, 0.7, 0.3, claw)), ...both(limb(5.9, 9.6, 6.9, 8.3, 0.7, 0.3, claw)),
      );
    } else {
      const w = coil ? 0.8 : 0;    // braced wider for the bite
      out.push(
        ...both(ball(7 - w * 0.5, 20.5 + cy, 3.8, 3.4, scale)),
        ...both(limb(7 - w * 0.5, 20.5 + cy, 3 - w, 24.5, 3, 2.4, scale)), ...both(limb(3 - w, 24.5, 4.8 - w, 29, 2.4, 2, scale)),
        ...both(ball(4.8 - w, 29.8, 2.9, 1.4, dark)),
        ...both(limb(3.3 - w, 30, 1.8 - w, 31.2, 0.6, 0.35, claw)), ...both(limb(4.8 - w, 30.3, 4.8 - w, 31.5, 0.6, 0.35, claw)), ...both(limb(6.3 - w, 30, 7.6 - w, 31.2, 0.6, 0.35, claw)),
      );
    }
    // the pale chest, and the neck up out of it: coiled back on itself to strike
    out.push(ball(16, 24.5 + cy * 0.5, 5.6, 4, belly));
    if (coil) {
      out.push(limb(16, 21, 18.5, 17.5, 4.6, 4, hide), limb(18.5, 17.5, hx, hy + 2, 4, 3.6, hide));
    } else {
      out.push(limb(16, 21 + cy, hx, hy + 2, 4.6, 3.8, hide));
      if (rear) out.push(limb(16, 22 + cy, hx, hy + 5, 1.9, 1.5, '#e8904a'));
    }
    // the horns, swept back and up, and a spur at each hinge of the jaw
    out.push(
      ...[1, -1].flatMap(s => [
        limb(hx - s * 3.8, hy - 1.8, hx - s * 7.5, hy - 4.8, 1.3, 0.9, horn), limb(hx - s * 7.5, hy - 4.8, hx - s * 10, hy - 5.8, 0.9, 0.4, horn),
        limb(hx - s * 1.8, hy - 2.6, hx - s * 3.2, hy - 6.2, 0.9, 0.4, horn),
        limb(hx - s * 4.5, hy + 1, hx - s * 8, hy + (rear ? -0.5 : 0.8), 0.9, 0.4, horn),
      ]),
      ball(hx, hy, 5.2, 3.4, hide),
    );
    const ex = Math.round(hx), ey = Math.round(hy) - 1;
    if (rear) {
      // the jaws wide, the throat a furnace
      out.push(
        ball(hx, hy + 5, 4.2, 3.8, '#5a1a10'),
        sheet(oval(hx, hy + 5, 3.3, 3), '#e8641a', { tilt: [-0.4, -0.6] }),
        // the fire itself is not lit by anything: it is the light
        dots([[ex - 2, ey + 5], [ex - 1, ey + 5], [ex, ey + 5], [ex + 1, ey + 5], [ex + 2, ey + 5], [ex - 2, ey + 6], [ex - 1, ey + 6], [ex, ey + 6], [ex + 1, ey + 6], [ex + 2, ey + 6],
          [ex - 1, ey + 4], [ex, ey + 4], [ex + 1, ey + 4], [ex - 1, ey + 7], [ex, ey + 7], [ex + 1, ey + 7]], '#ffb030'),
        dots([[ex - 1, ey + 5], [ex, ey + 5], [ex + 1, ey + 5], [ex - 1, ey + 6], [ex, ey + 6], [ex + 1, ey + 6]], '#ffe070'),
        dots([[ex, ey + 5], [ex, ey + 6]], '#fff8d8'),
        limb(hx, hy + 0.5, hx, hy + 1.8, 3.8, 3.4, scale),
        ...[-1, 1].map(s => ball(hx + s * 1.6, hy + 1.8, 1.1, 0.9, scale)),
        ball(hx, hy + 9.2, 3.4, 1.2, scale),
        dots([[ex - 3, ey + 5], [ex + 3, ey + 5], [ex - 3, ey + 7], [ex + 3, ey + 7], [ex - 2, ey + 9], [ex + 2, ey + 9]], '#f4ecd4'),
        dots([[ex - 3, ey], [ex - 2, ey], [ex + 2, ey], [ex + 3, ey]], '#ffd040'), dots([[ex - 2, ey], [ex + 2, ey]], '#fff8c0'),
      );
    } else {
      const o = coil ? 1.4 : 0;    // how far the jaws part
      out.push(
        ball(hx, hy + 5.4 + o, 3.8, 1.3, dark),
        ...(coil ? [sheet([[hx - 3.2, hy + 4], [hx + 3.2, hy + 4], [hx + 2.6, hy + 6.4], [hx - 2.6, hy + 6.4]], '#3a0e0a')] : []),
        limb(hx, hy + 0.5, hx, hy + 4.4, 3.8, 2.6, scale),
        ...[-1, 1].map(s => ball(hx + s * 1.3, hy + 4.4, 1, 0.8, scale)),
        dots([[ex - 1, ey + 5], [ex + 1, ey + 5]], '#1a0806'),
        dots(coil ? [[ex - 3, ey + 6], [ex + 3, ey + 6], [ex - 2, ey + 8], [ex + 2, ey + 8]] : [[ex - 3, ey + 5], [ex + 3, ey + 5], [ex - 2, ey + 6], [ex + 2, ey + 6]], '#f4ecd4'),
        dots([[ex - 3, ey], [ex - 2, ey], [ex + 2, ey], [ex + 3, ey]], '#ffb020'), dots([[ex - 2, ey], [ex + 2, ey]], '#2a0c04'),
      );
    }
    // the brow ridges over the eyes, drawn down in anger
    out.push(limb(hx - 5.2, ey - 1.5, hx - 1.2, ey - 0.2 + (coil ? 0.6 : 0), 0.9, 0.6, dark), limb(hx + 5.2, ey - 1.5, hx + 1.2, ey - 0.2 + (coil ? 0.6 : 0), 0.9, 0.6, dark));
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },
};

// Hand-drawn detail laid over each monster on the fine grid, half a unit to
// the pixel: the claws, seams, cracks, rivets and fur that a 32-grid could
// only suggest. Painted coarsely (the art checks, scale 1) they fold back
// onto whole pixels and change little.
const DETAILS = {
  emberling: (pose = 'idle') => {
    const hot = pose === 'windup', dy = hot ? 1.2 : 0, cx = 16, cy = 21 + dy;
    return [
      specks([[cx - 6.5, cy + 2.5], [cx - 4, cy + 4], [cx + 5, cy + 3.5], [cx + 6.5, cy - 1], [cx - 2, cy - 5], [cx + 2.5, cy - 5]], '#1a1412'),
      specks([[cx - 5.5, cy - 2], [cx + 5.5, cy - 2.5], [cx - 1.5, cy + 5.5], [cx + 3.5, cy + 5]], '#5a4a44'),
      specks(hot ? [[cx - 3, cy - 15], [cx + 2, cy - 17], [cx + 5, cy - 14], [cx - 5, cy - 12]] : [[cx - 3, cy - 11], [cx + 1.5, cy - 13], [cx + 4.5, cy - 10]], '#ffd060'),
      specks([[cx - 6, cy - 1], [cx + 6, cy + 1.5], [cx - 3, cy - 4.5], [cx + 4.5, cy - 1.5]], hot ? '#ffffff' : '#ffc060'),
      hair(cx + 1.5, cy + 5.5, cx + 1.5, cy + 7.5, hot ? '#ffe080' : '#e06a20'),
      hair(cx - 4.5, cy - 4.5, cx - 6, cy - 3, '#5a4a44'), hair(cx + 4.5, cy - 4, cx + 6, cy - 2.5, '#5a4a44'),
    ];
  },
  // scales picked out down the back and arms, claws, a slitted eye, wire glints and the dart's fletching
  kobold: (pose = 'idle') => {
    const throwing = pose === 'windup';
    return [
      specks([[13, 17], [14.5, 16.5], [17.5, 16.5], [19, 17], [13.5, 21], [18.5, 21], [14, 23.5], [18, 23.5]], '#c86a3e'),
      specks([[12, 18.5], [20, 18.5], [12.5, 20.5], [19.5, 20.5]], '#6e3018'),
      hair(15, 18, 15, 23, '#e8b480'), hair(17, 18, 17, 23, '#e8b480'),
      specks([[11.5, 31], [12.5, 31.2], [13.5, 31], [18.5, 31], [19.5, 31.2], [20.5, 31]], '#f2ead2'),
      specks(throwing ? [[4.5, 14], [5, 15.5], [4, 15]] : [[8, 23], [9, 23.2], [9.5, 22.5]], '#f2ead2'),
      specks([[11, 14.5], [12, 15], [10.5, 16]], '#ffffff'),
      hair(14, 10.5, 14, 11, '#1a0808'), hair(18, 10.5, 18, 11, '#1a0808'),
      specks(throwing ? [[25.5, 4.5], [26, 4], [25, 4]] : [[25.5, 7.5], [26, 7], [25, 7]], '#e04a30'),
      hair(15, 13, 15.5, 14.5, '#6e3018'), hair(17, 13, 16.5, 14.5, '#6e3018'),
      specks([[12.5, 8], [19.5, 8]], '#fff4dc'),
    ];
  },
  // grain down the staves, nail heads on the hoops, splinters on the teeth,
  // veins on the tongue and a string of drool off the rim
  mimic: (pose = 'idle') => {
    const lidY = 15 - (pose === 'windup' ? 7 : 4);
    return [
      hair(10, 18, 10.5, 29, '#5e3e24'), hair(14, 18, 14, 30, '#5e3e24'), hair(18, 18, 18.5, 30, '#5e3e24'), hair(22, 18, 21.5, 29, '#5e3e24'),
      specks([[9, 21], [12, 21], [16, 21], [20, 21], [23, 21], [9.5, 27.5], [13, 27.5], [16.5, 27.5], [20, 27.5], [22.5, 27.5]], '#8a8e96'),
      specks([[11, lidY + 4], [14.5, lidY + 4.5], [19.5, lidY + 4.5], [12.5, 13], [17, 13], [21, 13.5]], '#c8bca0'),
      hair(14.5, 17, 13.8, 21, '#e06a7a'), hair(13.6, 18.5, 14.6, 19.5, '#a03848'),
      specks([[18.5, 16.5], [18.5, 17.5], [18.6, 18.5], [18.4, 19.5]], '#d8e0e8'),
      hair(9, lidY - 1.5, 23, lidY - 1.5, '#7a5230'),
      specks([[10, lidY], [16, lidY], [22, lidY]], '#8a8e96'),
    ];
  },

  spider: () => [
    // bristles standing up off the abdomen, and its segments
    hair(10, 16, 9.5, 14.5, '#7a6a94'), hair(12, 14, 11.5, 12.5, '#7a6a94'), hair(16, 13, 16, 11.5, '#7a6a94'),
    hair(20, 14, 20.5, 12.5, '#7a6a94'), hair(22, 16, 22.5, 14.5, '#7a6a94'),
    hair(10.5, 19, 13, 17.5, '#3a3050'), hair(19, 17.5, 21.5, 19, '#3a3050'),
    // hair on the legs
    ...both(specks([[6.5, 15.5], [4, 19.5], [4, 24], [6.5, 27]], '#8a7aa6')),
    // fangs wet with venom
    specks([[15, 30], [17, 30]], '#ffffff'), specks([[15, 30.5], [17, 31]], '#9af060'),
  ],

  rat: () => [
    // fur laid back along the body
    hair(12, 21.5, 13.5, 22, '#6a4e34'), hair(15, 20.5, 16.5, 21, '#6a4e34'), hair(18, 20.5, 19.5, 21, '#6a4e34'),
    hair(21, 21, 22.5, 21.5, '#6a4e34'), hair(24, 22, 25.5, 23, '#6a4e34'), hair(14, 24, 15.5, 24.5, '#a4845e'),
    hair(18, 23.5, 19.5, 24, '#a4845e'), hair(10, 22, 11, 22.5, '#6a4e34'),
    // rings on the tail
    specks([[25.5, 25.5], [27, 24.5], [28.5, 23.5], [29.5, 21.5], [29, 19.5]], '#b07a78'),
    // a vein in the ear, whiskers, claws, a nick of a tooth
    hair(10, 19.5, 10, 21.5, '#c07878'),
    hair(3.5, 25, 0.5, 25, '#e8e0d0'),
    specks([[13.5, 31], [14.5, 31], [15, 31], [23, 31], [24, 31], [24.5, 31]], '#f4ecd8'),
    specks([[2.5, 24.5]], '#ffffff'),
  ],

  bat: () => [
    // the finer veins between the ribs of each wing, and a claw at its peak
    ...both(hair(11, 12, 5, 8.5, '#4e4268')), ...both(hair(10, 14.5, 4, 14.5, '#4e4268')), ...both(hair(9, 16.5, 5.5, 16, '#4e4268')),
    ...both(specks([[7, 7], [6.5, 6.5]], '#e8e0d0')),
    // fur on the chest, the inside of the ears, a snarl
    specks([[15, 13], [17, 13], [16, 14.5], [15.5, 16], [16.5, 16], [16, 17.5]], '#6e608a'),
    ...both(hair(13.5, 7.5, 13, 5.5, '#8a5a78')),
    specks([[16, 11.5], [15.5, 11], [16.5, 11]], '#2a1a24'),
  ],

  slime: () => [
    // something it swallowed: a bone, a coin, a key
    hair(19.5, 25, 22, 26.5, '#e8e0c8'), specks([[19.5, 24.5], [22, 27]], '#e8e0c8'),
    specks([[9.5, 27.5], [10, 27.5], [10.5, 27.5], [10, 28]], '#ffd060'),
    specks([[22.5, 22], [23, 22], [23.5, 22.5], [23, 23]], '#b0a060'),
    // highlights along its skin, a drip and a sag at the base
    hair(8, 21, 10, 19.5, '#e8ffee'), specks([[21.5, 19], [22.5, 19.5]], '#e8ffee'),
    specks([[7, 31], [7, 31.5], [25, 31], [16, 31.5]], '#2e8a44'),
    specks([[26, 27.5], [27, 28]], '#b8ffc8'),
  ],

  archer: () => [
    // red fletching on the nocked arrow, and a bracer on the bow arm
    specks([[1, 13.5], [1.5, 13.5], [1, 14.5], [1.5, 14.5]], '#c04040'),
    specks([[6, 13.5], [7, 13.5], [6, 15], [7, 15]], '#5a3a1a'),
    // the quiver strap across the chest, and its buckle
    hair(11, 17.5, 21, 23, '#3a2a1a'), specks([[16, 20], [16.5, 20.5]], '#c9a24a'),
    // stitching round the hood, nostrils, a squint
    specks([[11, 8.5], [13, 7.5], [16, 7], [19, 7.5], [21, 8.5]], '#7a6a48'),
    specks([[15.5, 12.5], [16.5, 12.5]], '#2e5020'),
    hair(11.5, 9, 14, 9.5, '#3f6e2c'), hair(18, 9.5, 20.5, 9, '#3f6e2c'),
    // grain on the bow, claws on the drawing hand
    specks([[3.5, 9], [3, 13], [3, 16], [3.5, 19]], '#b08040'),
    specks([[3.5, 15], [4.5, 15.5]], '#e8e0c0'),
  ],





  shade: () => [
    // rivets on the pauldrons, rings of mail catching the light
    specks([[9.5, 12], [10.5, 11.5], [11.5, 12], [20.5, 12], [21.5, 11.5], [22.5, 12]], '#e8f4ff'),
    hair(11, 15, 21, 15, '#9ab4cc'), hair(11, 17, 21, 17, '#9ab4cc'), hair(11, 19, 21, 19, '#6a84a0'),
    // a notch in the blade, a dent in the helm
    specks([[27, 9], [27.5, 9.5]], '#4a5e78'), specks([[14, 5.5], [14.5, 6]], '#6a84a0'),
    // the mist coming off it
    hair(12.5, 29, 12, 31, '#8aa4c0'), hair(17, 30, 17.5, 31.5, '#8aa4c0'), hair(21, 28, 22, 30, '#8aa4c0'), hair(8.5, 26, 7.5, 27.5, '#8aa4c0'),
    // breath of frost from the visor
    specks([[15.5, 10], [16.5, 10.5], [16, 11.5]], '#c0e8f8'),
  ],

  ogre: () => [
    // grain and nails in the club
    hair(26.5, 20, 27.5, 6, '#5a3e22'), specks([[26.5, 10], [28, 8], [27, 14]], '#3a2a18'),
    // stretch marks on the belly, a mole, the rope that holds the loincloth
    hair(11, 19, 12, 21.5, '#9a7650'), hair(21, 19, 20, 21.5, '#9a7650'), specks([[13, 17]], '#6a4a2a'),
    hair(8.5, 24, 23.5, 24, '#3a2a18'), specks([[16, 24.5], [16.5, 25], [16, 25.5]], '#3a2a18'),
    // stubble, a split lip, a tooth missing
    specks([[14, 12.5], [15.5, 13], [17, 13], [18.5, 12.5]], '#8a6a44'),
    specks([[16.5, 12]], '#8a2a20'),
    // knuckles and toenails
    specks([[4, 25.5], [5, 26], [6, 25.5], [25.5, 23], [26.5, 23.5], [27.5, 23]], '#8a6a44'),
    ...both(specks([[9, 31], [10.5, 31], [12, 31]], '#d8c8a0')),
  ],

  troll: () => [
    // moss and a sprig growing out of the hair
    specks([[11, 5], [13, 3.5], [19, 3.5], [21.5, 6], [10, 9], [22, 9.5]], '#7aaa48'),
    hair(20, 3, 21.5, 1, '#4a7a30'), specks([[21.5, 0.5]], '#c8e060'),
    // warts on the nose, a scar across the chest, knuckle hair
    specks([[17.5, 9], [18.5, 11]], '#3e7a44'),
    hair(12, 13, 17, 17, '#3e6a40'),
    specks([[4, 28], [5, 27.5], [27, 27.5], [28, 28]], '#2e4a26'),
    // ribs showing on its gaunt side
    hair(10.5, 15.5, 12, 16, '#46804a'), hair(10.5, 17, 12, 17.5, '#46804a'), hair(21.5, 15.5, 20, 16, '#46804a'),
    // a fringe of rags on the loincloth
    specks([[11.5, 24.5], [13.5, 24], [18.5, 24], [20.5, 24.5]], '#3e3020'),
  ],

  minotaur: () => [
    // rings worn into the horns
    ...both(specks([[9.5, 5], [7.5, 4.5], [5.5, 3]], '#c8bfa0')),
    // shaggy fur on the chest and brow, a scar over the muzzle
    hair(13, 14, 14, 16, '#5a3a22'), hair(16, 14.5, 16, 16.5, '#5a3a22'), hair(19, 14, 18, 16, '#5a3a22'),
    hair(12.5, 4, 14, 5, '#4e3320'), hair(19.5, 4, 18, 5, '#4e3320'),
    hair(16.5, 9.5, 18, 12, '#8a6a52'),
    // steam from the nostrils, the nose ring's shine
    specks([[13, 13.5], [12.5, 14], [19, 13.5], [19.5, 14]], '#e8e0d8'),
    specks([[16, 13.5]], '#fff0a0'),
    // an engraved axe head and a studded belt
    hair(27, 8, 29.5, 7.5, '#6a727e'), hair(27, 16, 29.5, 16.5, '#6a727e'),
    specks([[11, 21], [13.5, 21], [18.5, 21], [21, 21]], '#fff0a0'),
    // split hooves
    ...both(specks([[12, 30], [12, 30.5], [12, 31]], '#5a4838')),
  ],

  merchant: () => [
    // straps across the pack and the knot of the blanket roll
    hair(9, 7, 23, 7, '#3e3024'), hair(12.5, 4.5, 12.5, 1.5, '#5a2e24'), hair(19.5, 4.5, 19.5, 1.5, '#5a2e24'),
    specks([[11, 7], [21, 7]], '#c9a24a'),
    // stitching round the patch, a knotted cord belt, the lamp's cage
    specks([[16.5, 21.5], [18, 21.5], [19.5, 21.5], [21, 21.5], [16.5, 26.5], [18.5, 26.5], [21, 26.5]], '#a88a58'),
    specks([[15.5, 18.5], [16, 19], [16.5, 19.5]], '#8a7050'),
    hair(7.5, 7, 7.5, 10.5, '#4a4040'), hair(9.5, 7, 9.5, 10.5, '#4a4040'),
    // folds in the grey skin, the droop of the ears, long fingers
    hair(12, 10.5, 14.5, 10.5, '#6c7482'), hair(17.5, 10.5, 20, 10.5, '#6c7482'),
    hair(6, 15, 10, 14.5, '#7a8290'), hair(26, 15, 22, 14.5, '#7a8290'),
    specks([[5.5, 23.5], [6.5, 23.5], [24, 20.5], [25, 20.5]], '#b0b8c4'),
  ],

  pedlar: () => [
    // stitches on the sack, a patch on the cap, a buckle and toes
    specks([[10, 15], [11.5, 16], [21, 16], [22.5, 15]], '#a88258'),
    specks([[14, 6], [15, 6], [14, 7], [15, 7]], '#c86a50'),
    specks([[15.5, 18.5], [16.5, 18.5], [15.5, 19], [16.5, 19]], '#c9a24a'),
    hair(14.5, 9.5, 15.5, 10, '#4a8034'), hair(17.5, 9.5, 16.5, 10, '#4a8034'),
    ...both(specks([[10, 30.5], [11, 30.5], [12, 30.5]], '#2a2018')),
  ],

  hound: (pose = 'idle') => {
    const hy = pose === 'windup' ? 15 : 11.5, px = pose === 'windup' ? 10.6 : 12.2;
    // going, it is only light at the edges where the world closes over it
    if (pose === 'special') {
      return [
        hair(4.5, 12, 4.5, 16, '#e8e0ff'), hair(26.5, 18, 26.5, 23, '#e8e0ff'), hair(6, 26, 6, 29, '#c8b8ff'), hair(25, 8, 25, 11, '#c8b8ff'),
        specks([[3.5, 18], [5, 21.5], [27.5, 15], [26, 26], [15, 2.5], [9.5, 4.5], [22, 5]], '#f4f0ff'),
        specks([[14.5, hy - 1.5], [17, hy - 1.5]], '#ffffff'),
      ];
    }
    return [
      // ribs showing down each side of the barrel
      ...both(hair(9.5, 16.5, 11, 17, '#4a4e5a')), ...both(hair(9.5, 18, 11, 18.5, '#4a4e5a')), ...both(hair(10, 19.5, 11, 20, '#4a4e5a')),
      ...both(hair(9.5, 17, 10.5, 17.5, '#9a9eaa')), ...both(hair(9.5, 18.5, 10.5, 19, '#9a9eaa')),
      // rough fur down the chest, and the breastbone
      hair(15.5, 17, 15.5, 21, '#7c808a'), hair(14.5, 18, 14, 20, '#a4a8b2'), hair(16.5, 18, 17, 20, '#a4a8b2'),
      // claws
      ...both(specks([[px - 1, 31], [px, 31], [px + 1, 31]], '#d8d4c8')),
      // the tear at its flanks: a flicker of violet-white where it slips
      hair(8, 14, 8, 16.5, '#e4dcff'), hair(23.5, 18, 23.5, 20, '#e4dcff'), hair(6.5, 22, 6.5, 23.5, '#b8a0ff'),
      specks([[5.5, 15], [26, 17.5], [25.5, 12]], '#a88cff'),
      // a torn ear, whiskers, and a wet glint on the nose
      specks([[12, hy - 6], [12.5, hy - 5.5]], '#1c1c24'),
      specks([[14, hy + 3.5], [17.5, hy + 3.5]], '#b8bcc4'),
      specks([[15.5, hy + 4]], '#8a8e9a'),
    ];
  },

  quillback: (pose = 'idle') => {
    const hy = pose === 'windup' ? 24 : 21.5, my = pose === 'windup' ? 16.5 : 18;
    return [
      // the laid quills of the mantle, and the bands on them
      hair(9, my + 2, 11, my - 1.5, '#4e4450'), hair(13, my + 1, 14, my - 2.5, '#4e4450'), hair(18, my + 1, 17, my - 2.5, '#4e4450'),
      hair(22.5, my + 2, 20.5, my - 1.5, '#4e4450'), hair(6.5, my + 4, 8, my + 1, '#4e4450'), hair(25, my + 4, 23.5, my + 1, '#4e4450'),
      specks([[11, my - 1], [15, my - 2.5], [16.5, my - 2], [20.5, my - 1.5], [8, my + 1.5], [23.5, my + 1.5]], '#8a7e6a'),
      // bristles on the snout, a scar across the brow, split hooves
      specks([[14.5, hy + 2], [17.5, hy + 2], [16, hy + 1.5]], '#6a5040'),
      hair(13.5, hy - 2.5, 15.5, hy - 1, '#7a6250'),
      ...both(specks([[7, 30.5], [7, 31]], '#5a4838')),
      ...both(specks([[11.5, 30.5], [11.5, 31]], '#5a4838')),
      // spit at the tusks
      specks([[12.5, hy + 5.5], [19.5, hy + 5]], '#c8d0d8'),
    ];
  },

  wyrm: (pose = 'idle') => {
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 15 : 16, hy = rear ? 6.5 : coil ? 13.5 : 11.5, cy = rear ? -1.5 : coil ? -1 : 0;
    /** @type {object[]} */
    const out = [
      // scales over the shoulders in rows, each a small arc
      ...[[6, 18.5], [8, 18.5], [7, 20], [5, 20], [9, 21.5], [11.5, 18], [25, 18.5], [23, 18.5], [24, 20], [26, 20], [22, 21.5], [20.5, 18]]
        .flatMap(([x, y]) => [hair(x - 0.75, y + cy, x, y + 0.5 + cy, '#5a2016'), hair(x, y + 0.5 + cy, x + 0.75, y + cy, '#5a2016')]),
      // plates across the chest
      hair(12.5, 23 + cy * 0.5, 19.5, 23 + cy * 0.5, '#a8784c'), hair(11.5, 25 + cy * 0.5, 20.5, 25 + cy * 0.5, '#a8784c'), hair(12.5, 27 + cy * 0.5, 19.5, 27 + cy * 0.5, '#a8784c'),
      // rings on the horns, scales on the brow
      specks([[hx - 5.5, hy - 3.5], [hx - 8.5, hy - 5.5], [hx + 6, hy - 3.5], [hx + 9, hy - 5.5]], '#a8987a'),
      specks([[hx - 1.5, hy - 2.5], [hx, hy - 3], [hx + 1.5, hy - 2.5]], '#c05a36'),
      // rings down the tail
      hair(25, 25.5, 24, 28.5, '#3a140c'), hair(28, 26, 26.5, 29, '#3a140c'),
    ];
    if (rear) {
      // embers rising off the jaws, the throat glowing through its plates
      out.push(specks([[hx - 4, hy - 1], [hx + 4.5, hy - 2], [hx - 2, hy - 4], [hx + 2.5, hy - 5], [hx - 5.5, hy + 3], [hx + 6, hy + 2.5]], '#ffd060'),
        specks([[hx - 1, hy - 6.5], [hx + 3.5, hy - 8]], '#ff8a20'),
        hair(14.5, 13, 17.5, 13, '#ffd070'), hair(14.5, 15, 17.5, 15, '#ffb040'), hair(14.5, 17, 17.5, 17, '#ff9030'));
    } else {
      // scales in rows down the front of the neck
      const nk = coil ? [[17.5, 18.5], [17.5, 20]] : [[16, 17], [16, 18.5], [16, 20]];
      out.push(...nk.flatMap(([x, y]) => [hair(x - 2.5, y, x, y + 0.5, '#5a2016'), hair(x, y + 0.5, x + 2.5, y, '#5a2016')]),
        // a curl of smoke from each nostril, and an old claw scar across the snout
        specks([[hx - 3, hy + 4.5], [hx - 3.5, hy + 4], [hx + 3.5, hy + 4.5], [hx + 4, hy + 4]], '#8a8078'),
        hair(hx + 1, hy + 0.5, hx + 2.5, hy + 3, '#c86a44'));
    }
    return out;
  },
};
for (const k in DETAILS) {
  const base = CREATURES[k];
  // a pose (see POSES) passes through to both
  CREATURES[k] = pose => [...base(pose), ...DETAILS[k](pose)];
}

// Detail for a creature right in front of you, painted only into its finest
// picture (four pixels to the unit, see NEAR_SCALE in assets.js): hairlines
// on a quarter-unit grid that further off would only be noise. Close in, the
// lich's robe shows its stitched runes and the Heartforged its scars.
const NEAR = {
  wyrm: (pose = 'idle') => {
    const rear = pose === 'special', coil = pose === 'windup', cy = rear ? -1.5 : coil ? -1 : 0;
    // the scales of its flanks in rows, each a small dark arc
    const arcs = [];
    for (const [row, y] of [[0, 18.5], [1, 20.75], [2, 23]]) for (let x = 7 + (row % 2) * 1.25; x <= 25; x += 2.5) {
      if (Math.abs(x - 16) < 5.5 && y > 21) continue;    // not over the pale chest
      arcs.push(hair(x - 1, y + cy * 0.5, x, y + cy * 0.5 + 0.75, '#6a2618'), hair(x, y + cy * 0.5 + 0.75, x + 1, y + cy * 0.5, '#6a2618'));
    }
    return [
      ...arcs,
      // the chest's plates, the claws' pale edges
      ...[23, 24.5, 26].map(y => hair(12.5, y + cy * 0.5, 19.5, y + cy * 0.5, '#a87a52')),
      ...(rear ? [] : [specks([[1.75, 31], [4.75, 31.25], [7.5, 31], [24.5, 31], [27.25, 31.25], [30.25, 31]], '#fffaf0')]),
    ];
  },
  troll: () => [
    // warts and moss on the hide, lank strands from the hair, the loincloth's fringe, claws
    specks([[12.5, 13.5], [19.5, 15], [14, 19.25], [18.5, 18.5], [21, 12], [10.75, 16.25]], '#3e7244'),
    specks([[13.25, 12.5], [19, 13.75], [11.5, 18]], '#8ab46a'),
    hair(10.25, 6, 9.25, 11, '#24402c'), hair(21.75, 6, 22.75, 11, '#24402c'), hair(16, 2.5, 15.5, 6.5, '#24402c'),
    ...[12, 14, 18, 20].map(x => hair(x, 23.25, x, 24.5, '#3a2e20')),
    specks([[4.25, 30.75], [5.75, 30.75], [26.25, 30.75], [27.75, 30.75], [11, 31], [21, 31]], '#d8d0b0'),
  ],
  ogre: () => [
    // a furrowed brow, the navel and the stretched skin round it, the club's grain and a nail driven through it
    hair(12.5, 7.25, 15, 7.75, '#9a7648'), hair(17, 7.75, 19.5, 7.25, '#9a7648'),
    hair(16.25, 22, 16.75, 22.75, '#8a6a40'), hair(13, 19.5, 14.5, 21, '#c8a676'), hair(20, 19.5, 18.5, 21, '#c8a676'),
    specks([[12.5, 17], [20, 16.5], [9.5, 21], [23, 22.5], [11.5, 24], [21.5, 15]], '#b08a5a'),
    hair(26.5, 20, 27.75, 6, '#4a3018'), hair(27.25, 18, 28.25, 8, '#5a3c22'),
    specks([[28.75, 6.5], [29, 6.25], [27, 10.75]], '#b8bcc4'),
    ...[11, 15, 19].map(x => hair(x, 24.5, x + 0.5, 25.5, '#3e3220')),
  ],
  rat: () => [
    // fur laid back along the body in short strokes, fine whiskers, rings down the tail, claws
    ...[[13, 22.5], [16, 21.75], [19, 21.75], [22, 22.5], [14.5, 24.5], [17.5, 24], [20.5, 24.5], [23.5, 25.25], [16, 26.5], [19, 26.5]].map(([x, y]) => hair(x, y, x + 1, y + 0.5, '#7a5c3c')),
    hair(3, 24.75, 0.5, 23.5, '#e0d4c0'), hair(3, 25.5, 0.25, 25.75, '#e0d4c0'), hair(3, 26, 0.75, 27.25, '#e0d4c0'),
    ...[[25.5, 25.25], [27, 24.25], [28.5, 23.25], [29.5, 21.25], [29.25, 19.5]].map(([x, y]) => hair(x - 0.25, y - 0.25, x + 0.25, y + 0.25, '#c87a7a')),
    specks([[13.75, 30.75], [15.25, 30.75], [23.25, 30.75], [24.75, 30.75]], '#f0e8dc'),
  ],
  spider: () => [
    // bristles round the abdomen, the hourglass's bright edge, a glint in each eye, the fangs' tips
    ...[[9, 16], [8.5, 19.5], [9, 23], [23, 16], [23.5, 19.5], [23, 23], [12, 13.5], [20, 13.5], [16, 13]].map(([x, y]) => hair(x, y, x + (x < 16 ? -0.75 : x > 16 ? 0.75 : 0), y - 0.75, '#7a6a96')),
    hair(14, 15.75, 18, 15.75, '#ff6060'), hair(14, 20.5, 18, 20.5, '#8a1818'),
    specks([[14.5, 24.75], [16.5, 24.5], [18, 25]], '#ffd0d0'),
    specks([[15.25, 29.25], [16.75, 29.25]], '#f0f0e0'),
  ],
  dog: (pose = 'idle') => {
    const bite = pose === 'windup', sit = pose === 'sit', hy = bite ? 15.5 : sit ? 11.5 : 13, by = sit ? 22 : 20.5;
    return [
      // fur strokes on the flanks, the collar's stitching, a glint in the tag, claws
      ...[[11, by - 2], [13, by - 3], [18, by - 3], [20, by - 2], [10.5, by + 1], [20.5, by + 1]].map(([x, y]) => hair(x, y, x + (x < 15.5 ? -0.75 : 0.75), y + 0.75, '#6e4626')),
      specks([[13.25, hy + 4], [14.75, hy + 4], [16.25, hy + 4], [17.75, hy + 4]], '#e8c0a0'),
      specks([[15.25, hy + 5.25]], '#fff6c0'),
      specks([[11.5, 30.75], [12.75, 30.75], [18.25, 30.75], [19.5, 30.75]], '#e8dcc0'),
    ];
  },
  wolf: (pose = 'idle') => {
    const sit = pose === 'sit', by = sit ? 22 : 20.5;
    return [
      // a rough grey coat in strokes, the ruff of paler fur at the throat, claws
      ...[[11, by - 2], [13, by - 3], [18, by - 3], [20, by - 2], [10.5, by + 1], [20.5, by + 1], [12, by + 2.5], [19, by + 2.5]].map(([x, y]) => hair(x, y, x + (x < 15.5 ? -0.75 : 0.75), y + 0.75, '#5c5e68')),
      ...[13.5, 15.5, 17.5].map(x => hair(x, by + 0.5, x + (x - 15.5) * 0.25, by + 2, '#f0eee6')),
      specks([[11.5, 30.75], [12.75, 30.75], [18.25, 30.75], [19.5, 30.75]], '#e8e4d8'),
    ];
  },
};
for (const k in NEAR) {
  const base = CREATURES[k];
  CREATURES[k] = pose => [...base(pose), ...NEAR[k](pose).map(q => ({ ...q, near: true }))];
}

// Other pictures of a creature, painted from the same parts with a pose
// given: 'windup' while a blow is drawn back, 'special' while its own trick
// is readied. Without a 'special' the wind-up serves for both.
const POSES = { heartforged: ['windup'], emberling: ['windup'], kobold: ['windup'], mimic: ['windup'], basilisk: ['windup', 'special'], rustmaw: ['windup'], hound: ['windup', 'special'], quillback: ['windup', 'special'], wyrm: ['windup', 'special'], dog: ['windup', 'sit'], wolf: ['windup', 'sit'], scrag: ['windup', 'sit'], sellsword: ['windup', 'sit'], mender: ['windup', 'sit'] };

// Props for encounters (see encounters.js): things you walk up to, drawn with
// the same painter so they sit in the same light as the creatures.
const PROPS = {
  // the Forge-Spirit: an anvil black with age on a stump of rock, and over it a fire
  // with no fuel, two eyes open in it, sparks rising
  forge_spirit: () => [
    // the stump of rock
    ball(16, 28.4, 7.4, 2.8, '#4a3e38'), sheet([[9.6, 28.6], [10.6, 23.4], [21.4, 23.4], [22.4, 28.6]], '#5a4c44', { curve: 0.6 }),
    hair(12, 24.5, 11.5, 28, '#3a302a'), hair(19.5, 24, 20.5, 28.2, '#3a302a'),
    // the anvil: waist, body, face and horn
    sheet([[13.4, 23.6], [18.6, 23.6], [17.6, 21], [14.4, 21]], '#2e3036', { curve: 0.3 }),
    sheet([[11, 21.2], [21.4, 21.2], [21.8, 18.6], [10.4, 18.6]], '#3a3c44', { curve: 0.5 }),
    limb(10.6, 19.4, 5.6, 19.8, 1.3, 0.3, '#3a3c44'),
    line(10.4, 18.6, 21.8, 18.6, '#8a8e98'),
    // the fire hanging over it: an outer flame, a hotter heart, two eyes and a mouth
    sheet([[11.6, 17.6], [10.4, 13], [12.4, 10], [13, 6.2], [15, 8.6], [16.2, 3.4], [17.6, 8.2], [19.6, 5.8], [20, 10.4], [21.6, 13.2], [20.4, 17.6]], '#e8641c', { curve: 0.8 }),
    sheet([[13, 17.2], [12.6, 13.4], [14.2, 11], [16, 7.6], [17.6, 11], [19.2, 13.2], [19, 17.2]], '#ffa030', { curve: 0.8 }),
    sheet([[14.4, 17], [14.4, 14], [16, 11.6], [17.6, 14], [17.6, 17]], '#ffe080', { curve: 0.6 }),
    dots([[14, 13], [15, 13], [17, 13], [18, 13]], '#3a1006'),
    line(15, 15.4, 17, 15.4, '#7a2a0a'),
    specks([[12, 4.5], [20.5, 3.5], [15, 1.5], [22.5, 7], [9.5, 8]], '#ffd060'),
    specks([[11.5, 19], [14, 19], [17, 19], [20.5, 19]], '#c8ccd4'),
  ],
  // a shaft in the floor, ringed with smooth stones, the Heart's red light welling up out of it
  heartwell: () => [
    ball(16, 26, 12, 4.6, '#4a3e38'), ball(16, 25.6, 10, 3.6, '#5e5048'),
    ...[[6, 25], [9, 22.6], [14, 21.8], [19, 21.8], [24, 22.6], [27, 25], [24, 28.4], [16, 29.6], [8, 28.4]].map(([x, y]) => ball(x, y, 2.2, 1.6, '#6e6058')),
    ball(16, 25.6, 7.6, 2.6, '#1a0806'), ball(16, 25.4, 5.6, 1.8, '#7a1c0c'), ball(16, 25.2, 3.4, 1.1, '#e05020'), ball(16, 25.1, 1.6, 0.6, '#ffc060'),
    // the warm light welling over the lip, and thin wisps of heat rising off it
    ball(16, 22.8, 7, 2.2, '#5a1c0e'), ball(16, 23.4, 4.4, 1.2, '#a83010'),
    // sparks drifting up out of it, thinning as they rise
    dots([[14, 20], [18, 19], [16, 17], [13, 15], [19, 14]], '#ffc060'),
    dots([[15, 12], [17.5, 10], [12.5, 10.5], [20, 8.5]], '#e8641c'),
    dots([[16, 6], [14, 4.5], [18.5, 4]], '#a83010'),
    specks([[7, 24.5], [25, 24.5], [12, 22], [21, 22]], '#8a7a70'),
  ],
  // a wasted delver in the rags of a fine coat, hunched over a fire of bones
  lastdelver: () => [
    // the fire of bones
    ball(21.5, 29.4, 5, 1.6, '#3a2a20'), ...[[18.5, 28.6], [21.5, 28], [24.5, 28.8]].map(([x, y]) => limb(x - 1.5, y, x + 1.5, y - 0.6, 0.6, 0.6, '#d8d0bc')),
    sheet([[18.5, 28.4], [19.6, 23], [21.2, 25.5], [22.2, 21.5], [23.6, 25.6], [24.6, 28.4]], '#e8641c', { curve: 0.6 }),
    sheet([[20.4, 28.2], [21.4, 25.2], [22.2, 23.8], [23, 25.6], [23.4, 28.2]], '#ffd060', { curve: 0.5 }),
    // the delver, hunched, knees up, a ragged coat that was blue once
    sheet([[5.5, 30], [7, 17], [10, 12.5], [14.5, 13], [16.5, 19], [16, 30]], '#2a3a5a', { curve: 1 }),
    sheet([[6, 30], [7, 21], [9, 30]], '#1e2a42'), line(9, 18, 14, 19, '#c8a040'), line(8.6, 21.5, 14.6, 22.4, '#c8a040'),
    // a thin hand held out to the fire
    limb(14.5, 20, 18.6, 22.6, 1, 0.8, '#2a3a5a'), ball(19.2, 22.9, 1, 0.9, '#c8a890'),
    // the head: matted grey hair, a gaunt face, eyes too bright
    ball(11.6, 10.8, 3.6, 3.8, '#9a9488'), ball(12.6, 11.6, 2.4, 2.8, '#c8a890'),
    dots([[13, 11], [14, 11]], '#ffe8a0'), line(12.6, 13.6, 14, 13.6, '#5a3a30'),
    hair(9, 8.5, 8, 13, '#7a746a'), hair(10.5, 7.6, 9.6, 12, '#b8b2a6'),
    specks([[20, 20.5], [23, 19.5], [21.5, 18]], '#ffd060'),
  ],
  // a wyrm's egg in a nest of ash and gnawed bones, scaled like a pine cone
  wyrmegg: () => [
    ball(16, 28, 11, 3.2, '#3e3632'), ball(16, 27.6, 9, 2.4, '#5a504a'),
    ...[[7, 27.5], [25, 27], [11, 29.8], [22, 29.6]].map(([x, y]) => limb(x - 2, y, x + 2, y - 0.8, 0.6, 0.6, '#d8d0bc')),
    ball(16, 18.6, 6.6, 9, '#4e6a3a'), ball(14.4, 16.4, 3.6, 5.4, '#6a8a4e'),
    ...[[13, 12], [17, 12], [11.5, 16], [15, 16], [18.6, 16], [12, 20], [16, 20.4], [20, 20], [14, 24], [18, 24]].map(([x, y]) => sheet([[x - 1.6, y + 1], [x, y - 1.2], [x + 1.6, y + 1]], '#3a5228', { curve: 0.4 })),
    line(14.5, 9.8, 17, 11.5, '#22301a'), line(17, 11.5, 16, 13.5, '#22301a'),
    specks([[12.5, 13.5], [13.5, 18], [19, 22.5], [17.5, 15]], '#8aae68'),
  ],
  // a sellsword waiting to be hired: leaning on the sword, eyes narrowed, the price already in mind
  hireling: () => CREATURES.sellsword('sit'),
  // a healer with nobody to mend: kneeling by a dead lamp, the satchel open, a bandage half wound
  stray_healer: () => CREATURES.mender('sit'),
  // a fall of stone, and a hand still moving under it
  rubble: () => {
    const rock = '#7a7268', dark = '#5a544c';
    return [
      ball(9, 27, 5.5, 4, dark), ball(22, 27.5, 6.5, 3.8, dark),
      limb(19, 22.5, 25, 18.5, 1.4, 1.2, '#d4a47a'), ball(25.8, 18, 1.6, 1.4, '#d4a47a'),
      dots([[27, 16], [27, 17], [28, 18], [26, 16]], '#e0b48a'),
      sheet([[17, 22], [22, 21], [23, 25], [17, 26]], '#34507a', { curve: 0.6 }),
      line(17, 22, 22, 21, '#c9a24a'),
      ball(15, 25, 6, 5, rock), ball(8.5, 22.5, 3.2, 2.8, rock), ball(20, 24.5, 3, 2.6, '#8a8278'),
      ball(13, 18.5, 3.4, 3, '#8a8278'), ball(17.5, 20, 2.4, 2.2, rock), ball(5, 28.5, 2.4, 2, rock),
      ball(26, 29, 2.8, 2, rock), ball(11, 29.5, 3, 1.8, '#6a645a'),
      dots([[12, 17], [14, 23], [7, 21], [19, 23]], '#a8a096'),
    ];
  },
  // a squat idol older than the delve, with fresh offerings at its feet
  shrine: () => {
    const stone = '#6e6a62';
    return [
      sheet([[5, 26], [27, 26], [28, 31], [4, 31]], '#5a564e', { curve: 0.7 }),
      sheet([[8, 21], [24, 21], [25, 26.5], [7, 26.5]], stone, { curve: 0.8 }),
      ball(16, 14.5, 6, 6.5, '#7e7a70'),
      ball(16, 7.5, 4, 3.6, '#8a867c'),
      dots([[14, 7], [18, 7]], '#1c1a18'), dots([[14, 8], [18, 8]], '#3a3630'),
      line(14, 10, 18, 10, '#3a3630'),
      limb(11, 14, 13.5, 18, 1.4, 1.2, '#747068'), limb(21, 14, 18.5, 18, 1.4, 1.2, '#747068'),
      ...both(line(7, 24, 7, 20, '#e8e0c8')), ...both(dots([[7, 19], [7, 18]], '#ffc050')), ...both(dots([[7, 17]], '#fff0a0')),
      dots([[12, 24], [13, 24], [19, 24], [20, 23], [16, 25], [17, 25]], '#e8c040'),
      dots([[15, 23], [16, 23]], '#b03040'),
    ];
  },
  // a slab cut deep with letters that will not keep still
  runestone: () => {
    const slab = '#3e3a48';
    return [
      sheet([[8, 6], [12, 2.5], [21, 2.5], [24, 6], [25, 31], [7, 31]], slab, { curve: 0.8 }),
      line(24, 8, 24, 30, '#2a2632'),
      ...[[11, 8], [15, 8], [19, 8], [12, 13], [17, 13], [11, 18], [15, 18], [20, 18], [13, 23], [18, 23]].flatMap(([x, y]) => [
        dots([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 2], [x + 2, y + 1]], '#8a70ff'),
      ]),
      dots([[12, 8], [16, 13], [12, 18], [16, 18], [14, 23]], '#d8ccff'),
      line(9, 26, 12, 29, '#2a2632'), line(20, 4, 22, 7, '#2a2632'),
    ];
  },
  // slumped against the wall, clutching its side, knife held out
  goblin_hurt: () => {
    const skin = '#6aa84a', dark = '#3f6e2c';
    return [
      ...both(limb(13, 27, 7, 29.5, 1.8, 1.5, dark)),
      ...both(ball(5.5, 29.8, 2, 1.2, '#4a3a2a')),
      ball(16, 23, 5.4, 5, skin),
      sheet([[11, 22], [21, 22], [21.5, 28], [10.5, 28]], '#7a5230', { curve: 1 }),
      limb(11.5, 20, 14.5, 25, 1.5, 1.2, skin), ball(15, 25.5, 1.6, 1.4, skin),
      dots([[16, 25], [17, 26], [16, 27], [15, 27], [17, 24]], '#c02828'),
      limb(20.5, 20, 25, 18.5, 1.5, 1.2, skin), ball(25.8, 18.3, 1.5, 1.4, skin),
      line(26, 18, 29, 15, '#b8bcc4'), line(27, 18, 30, 15, '#8a8e96'),
      sheet([[10.5, 15], [3.5, 12.5], [10.5, 17.5]], skin, { tilt: [-0.5, 0] }),
      sheet([[21.5, 15], [28.5, 12.5], [21.5, 17.5]], skin, { tilt: [0.5, 0] }),
      ball(16, 16, 5.4, 4.6, skin),
      dots([[13, 16], [19, 16]], '#ffe040'), dots([[13, 15], [14, 15], [18, 15], [19, 15]], '#2e5020'),
      dots([[14, 19], [15, 19], [16, 19], [17, 19], [18, 19]], '#2a1010'),
    ];
  },
  // the fourth crew's box: rusted lock, chain that has not rusted
  strongbox: () => {
    const wood = '#6a4424', iron = '#6a7078';
    return [
      line(16, 31, 16, 28, '#8a929a'), dots([[15, 31], [17, 31], [16, 30]], '#a8b0b8'),
      sheet([[6, 18], [26, 18], [27, 29], [5, 29]], wood, { curve: 0.8 }),
      sheet([[6, 13], [26, 13], [26, 18.5], [6, 18.5]], '#7a5030', { tilt: [0, -0.6] }),
      line(6, 18, 26, 18, '#2a1a10'),
      ...[9, 16, 23].map(x => line(x, 13, x, 29, iron)),
      line(5, 29, 27, 29, iron),
      sheet([[14, 17], [18, 17], [18, 22], [14, 22]], '#a07830', { curve: 0.5 }),
      dots([[16, 19], [16, 20]], '#1a1008'),
      dots([[4, 22], [3, 24], [4, 26], [3, 28], [4, 30], [28, 22], [29, 24], [28, 26], [29, 28], [28, 30]], '#9aa2aa'),
    ];
  },
  // a squat stone door set in the rock, three iron levers beside it in a row,
  // each worn bright at the grip, and a line of old marks scratched over them
  lever_door: () => {
    const stone = '#6e6a66', dark = '#4a4744', iron = '#5a6068', grip = '#c9b07a';
    return [
      sheet([[4, 6], [20, 6], [20, 31], [4, 31]], stone, { curve: 0.4 }),
      sheet([[6.5, 9], [17.5, 9], [17.5, 31], [6.5, 31]], '#3e3a36', { curve: 0.6 }),
      ...[12, 17, 22, 27].map(y => line(6.5, y, 17.5, y, dark)),
      ball(12, 20, 1.6, 1.6, iron), dots([[12, 20]], '#1a1a1e'),
      // the frame's keystone, cut with a mark like an eye
      sheet([[9.5, 5], [14.5, 5], [14, 8], [10, 8]], '#8a8680'), dots([[12, 6]], '#2a2622'),
      // three levers in their slots, set at different angles
      ...[[23, 0.8], [26, -0.6], [29, 0.3]].flatMap(([x, lean]) => [
        sheet([[x - 1.2, 22], [x + 1.2, 22], [x + 1.2, 25], [x - 1.2, 25]], dark),
        limb(x, 23.5, x + lean * 4, 15.5, 0.6, 0.5, iron),
        ball(x + lean * 4, 15, 1.1, 1, grip),
      ]),
      // scratched marks over the levers: someone else tried, and counted
      ...[[22, 11], [25, 10], [28, 11]].map(([x, y]) => line(x, y, x + 1, y + 2, '#b8b0a0')),
    ];
  },
  // a mule, still laden, standing with its head low and its packs askew, a
  // frayed rope hanging from its halter where someone let go of it
  mule: () => {
    const coat = '#7a6250', dark = '#4e3e30', muzzle = '#c8b8a0', pack = '#8a6a3a', strap = '#3a2a1a';
    return [
      // legs, the far pair darker
      ...[[10, dark], [21, dark], [12.5, coat], [23.5, coat]].map(([x, c]) => limb(x, 22, x, 30.3, 1.7, 1.3, c)),
      ...[10, 12.5, 21, 23.5].map(x => ball(x, 30.8, 1.6, 0.8, '#2a2018')),
      // the body and a tail
      ball(17, 19.5, 8.8, 5.6, coat), ball(17, 22.5, 6.5, 2.4, '#8c7462'),
      limb(25, 17, 27.5, 24, 0.8, 0.5, dark), ball(27.6, 24.6, 0.9, 1.2, '#2a2018'),
      // the packs, one slipped low on its flank, a pot tied on top
      sheet([[11, 14], [20, 14], [21, 21], [10, 21]], pack, { curve: 1 }),
      line(15.5, 14, 15.5, 21, strap), line(10.5, 17.5, 20.5, 17.5, strap),
      ball(18, 12.6, 2.4, 1.8, '#5a5e66'), ball(18, 11.2, 1.6, 0.6, '#3a3e44'),
      sheet([[19, 19], [24, 19.5], [23.5, 24], [19.5, 23.5]], '#7a5a30', { curve: 1 }),
      // the head, held low, long ears, a pale muzzle, a halter with a trailing rope
      limb(10, 16, 6.5, 20, 2.8, 2.2, coat),
      ball(5.5, 21, 3.2, 2.9, coat), ball(4, 23, 2.2, 1.7, muzzle),
      dots([[3.5, 22.5]], '#2a2018'), dots([[5.5, 20]], '#1a1008'),
      sheet([[6, 18.5], [7, 13], [8, 18.5]], coat, { tilt: [0.2, -0.6] }), sheet([[4, 18.5], [4.5, 13.5], [5.8, 18.5]], dark, { tilt: [-0.2, -0.6] }),
      line(3.5, 21.5, 7, 21.5, strap), line(4.5, 23.5, 3.5, 28, '#b0a080'), line(3.5, 28, 5, 31, '#b0a080'),
    ];
  },
  // a voice with nothing behind it: a cold light, trailing
  wisp: () => [
    ball(16, 16, 5.5, 5.5, '#4a5a7a'),
    ball(16, 16, 3.8, 3.8, '#9ab8e8'),
    ball(15.2, 15.2, 2, 2, '#e8f4ff'),
    limb(16, 20, 13, 27, 1.6, 0.4, '#5a6a8a'), limb(16, 20, 19.5, 26, 1.2, 0.3, '#5a6a8a'),
    dots([[9, 12], [23, 10], [8, 20], [24, 19], [12, 8], [21, 23]], '#c8dcff'),
    dots([[14, 15], [18, 15]], '#2a3450'), dots([[15, 18], [16, 18], [17, 18]], '#2a3450'),
  ],
  // pale caps growing thick on something that was a person
  fungus: () => {
    const cap = '#e8e0cc', stem = '#c8bca4';
    const shroom = (x, y, r, h) => [limb(x, 31, x, y, r * 0.35, r * 0.3, stem), ball(x, y, r, r * 0.55, cap), dots([[Math.round(x - r / 2), Math.round(y - 1)]], '#fffaf0')];
    return [
      ball(16, 28.5, 10, 3.5, '#4a4038'),
      ball(9, 27, 3, 2.5, '#d8d0bc'), dots([[8, 27], [10, 27]], '#2a2420'),
      ...shroom(13, 20, 4.5), ...shroom(20, 17, 5.5), ...shroom(25, 24, 3.2), ...shroom(6, 23, 2.8), ...shroom(17, 25, 2.5),
      dots([[20, 16], [22, 17], [12, 20], [14, 19]], '#c8a890'),
    ];
  },
  // a man hanging in goblin chains, a fresh brand on his arm
  prisoner: () => {
    const skin = '#c89a78', rag = '#b8ac90', iron = '#7a7e88';
    return [
      ball(7, 6, 1.4, 1.4, iron), ball(25, 6, 1.4, 1.4, iron),
      line(7, 7, 10, 11, '#8a8e96'), line(25, 7, 22, 11, '#8a8e96'),
      limb(13, 24, 9, 29.5, 1.6, 1.4, '#5a4a3a'), limb(19, 24, 23, 29.5, 1.6, 1.4, '#5a4a3a'),
      ball(8.5, 30.2, 1.8, 0.9, '#3a2e24'), ball(23.5, 30.2, 1.8, 0.9, '#3a2e24'),
      sheet([[11, 13.5], [21, 13.5], [22, 25], [10, 25]], rag, { curve: 1 }),
      line(14, 17, 18, 22, '#8a7e66'), line(12, 21, 15, 24, '#8a7e66'),
      limb(11.5, 14.5, 9.8, 10.5, 1.2, 1, skin), limb(20.5, 14.5, 22.2, 10.5, 1.2, 1, skin),
      ball(9.8, 10.8, 1.5, 1.2, iron), ball(22.2, 10.8, 1.5, 1.2, iron),
      dots([[21, 13], [22, 13]], '#c03020'),
      ball(16, 9.5, 3.4, 3.6, skin),
      ball(16, 11.8, 2.6, 1.6, '#6a4a30'),
      dots([[14, 6], [15, 6], [16, 6], [17, 6], [18, 6], [14, 7], [18, 7]], '#4a3020'),
      dots([[14, 9], [18, 9]], '#2a1a14'),
    ];
  },
  // a ring of worked stone older than the delve, a rope going down, coins on the lip
  well: () => {
    const stone = '#7a746a', wood = '#6a4424';
    return [
      limb(6, 19, 6, 6, 1, 1, wood), limb(26, 19, 26, 6, 1, 1, wood),
      sheet([[3, 6.5], [29, 6.5], [24, 1.5], [8, 1.5]], '#5a3a20', { tilt: [0, -0.7] }),
      limb(6, 9, 26, 9, 0.8, 0.8, wood),
      line(16, 9, 16, 14, '#c8b088'),
      sheet([[14, 14], [18, 14], [17.5, 17.5], [14.5, 17.5]], '#7a5030', { curve: 0.6 }),
      sheet([[5, 19], [27, 19], [27, 30.6], [5, 30.6]], stone, { curve: 1 }),
      line(5, 23, 27, 23, '#5a544c'), line(5, 26.5, 27, 26.5, '#5a544c'),
      dots([[10, 20], [18, 20], [24, 21], [7, 24], [14, 24], [21, 24], [11, 27], [19, 27], [25, 28]], '#5a544c'),
      ball(16, 19, 11, 3, '#8a847a'),
      ball(16, 19, 8.5, 2, '#14202c'),
      dots([[13, 19], [19, 18]], '#6a8aaa'),
      dots([[7, 18], [9, 17], [24, 17], [26, 18]], '#e8c040'),
    ];
  },
  // the archivist's shelves, bowed under books, one spine lettered in gold
  bookcase: () => {
    const cols = ['#7a2a2a', '#2a4a6a', '#4a6a2a', '#6a5a2a', '#5a2a5a', '#8a6a3a', '#3a5a5a'];
    const books = [];
    [[3, 8.6], [10, 16.6], [18, 24.6]].forEach(([top, bottom], row) => {
      let x = 7;
      for (let i = 0; x < 25; i++) {
        const w = 1.6 + ((i + row) % 3) * 0.5, h = (bottom - top) - ((i * 7 + row * 3) % 4) * 0.8;
        if ((i + row * 2) % 7 !== 5) books.push(sheet([[x, bottom - h], [x + w, bottom - h], [x + w, bottom], [x, bottom]], row === 1 && i === 3 ? '#c8a040' : cols[(i * 3 + row) % cols.length], { curve: 0.6 }));
        x += w + 0.4;
      }
    });
    return [
      sheet([[5, 2], [27, 2], [27, 31], [5, 31]], '#3a2618', { curve: 0.3 }),
      ...books,
      ...[9.2, 17.2, 25.2].map(y => limb(5.5, y, 26.5, y, 0.9, 0.9, '#6a4424')),
      sheet([[8, 26.5], [14, 26], [14.5, 29], [8.5, 29.5]], '#6a3a2a', { tilt: [-0.1, -0.8] }),
      dots([[16, 12], [16, 13], [16, 14]], '#fff0a0'),
    ];
  },
  // an ogre asleep on a bed of stolen coin, snoring like a rockfall
  ogre_sleep: () => [
    ...CREATURES.ogre(),
    ball(9, 30, 4, 1.4, '#c89a28'), ball(16, 30.4, 4.5, 1.2, '#d8a830'), ball(23, 30, 4, 1.4, '#c89a28'),
    dots([[8, 29], [15, 30], [22, 29], [18, 30]], '#fff0a0'),
    // the snore, drawn clear of the club over its other shoulder
    dots([[4, 2], [5, 2], [6, 2], [7, 2], [6, 3], [5, 4], [4, 5], [5, 5], [6, 5], [7, 5]], '#dde8ff'),
    dots([[9, 6], [10, 6], [11, 6], [10, 7], [9, 8], [10, 8], [11, 8]], '#b8c8f0'),
  ],
  // a tall mirror in a gilt frame, where no mirror should be
  mirror: () => [
    limb(11, 31, 13, 25, 0.8, 0.7, '#4a3020'), limb(21, 31, 19, 25, 0.8, 0.7, '#4a3020'),
    ball(16, 14, 9, 12.5, '#c8a040'),
    ball(16, 14, 7, 10.5, '#7a90a8'),
    ball(16, 11, 2.3, 2.5, '#5a6a80'),
    sheet([[12, 15.5], [20, 15.5], [21, 23], [11, 23]], '#5a6a80', { curve: 0.8 }),
    dots([[15, 11], [17, 11]], '#e8f0ff'),
    line(11, 8, 13, 5, '#e8f4ff'), line(12, 10, 14, 7, '#c8dcf0'),
    ball(16, 1.8, 2, 1.4, '#e0b848'),
  ],
  // a painted chest alone in the open, a wire running from its lid into the wall
  chest: () => [
    sheet([[6, 19], [26, 19], [27, 29.5], [5, 29.5]], '#8a2a2a', { curve: 0.9 }),
    sheet([[6, 19.5], [26, 19.5], [25, 14], [21, 12], [11, 12], [7, 14]], '#a03838', { tilt: [0, -0.6] }),
    line(5, 29, 27, 29, '#c8a040'), line(6, 19, 26, 19, '#c8a040'),
    line(10, 13, 10, 29, '#c8a040'), line(22, 13, 22, 29, '#c8a040'),
    sheet([[14.5, 18], [17.5, 18], [17.5, 22], [14.5, 22]], '#e0b848', { curve: 0.5 }),
    dots([[16, 20]], '#2a1a10'),
    line(24, 13, 30, 8, '#d0d4dc'),
    ball(30.5, 7.5, 1.3, 1.3, '#1a1418'),
    dots([[27, 10], [29, 9]], '#ffffff'),
  ],
  // a goblin on a crate beside a hand-painted sign, cup out for the toll
  goblin_toll: () => [
    up2(limb(3.5, 31, 3.5, 13, 0.7, 0.7, '#6a4424')),
    ...CREATURES.goblin(),
    up2(sheet([[0.5, 8.5], [9.5, 8.5], [9.5, 14.5], [0.5, 14.5]], '#b08a58', { tilt: [-0.1, -0.2] })),
    // (the letters, a pixel of the coarse grid each: four of the fine)
    ...[[2, 10], [3, 10], [4, 10], [3, 11], [3, 12], [3, 13], [6, 10], [6, 11], [6, 12], [6, 13], [7, 10], [7, 13], [8, 10], [8, 11], [8, 12], [8, 13]].map(([x, y]) => dots([[x * 2, y * 2], [x * 2 + 1, y * 2], [x * 2, y * 2 + 1], [x * 2 + 1, y * 2 + 1]], '#3a2410')),
  ],
  // a wall of shields across the passage, and a banner still standing over them
  barricade: () => {
    const heater = (cx, c) => sheet([[cx - 3.6, 19], [cx + 3.6, 19], [cx + 3.6, 24.5], [cx, 30.5], [cx - 3.6, 24.5]], c, { curve: 1 });
    return [
      limb(16, 31, 16, 2.5, 0.7, 0.7, '#6a4424'),
      sheet([[16.5, 3], [27.5, 3], [26.5, 11], [24.5, 9.5], [21.5, 12], [16.5, 11]], '#8a2a2a', { curve: 0.8 }),
      dots([[21, 6], [22, 6], [21, 7], [22, 7], [20, 5], [23, 8]], '#e0b848'),
      heater(6, '#2e4a7a'), heater(26, '#4a6a3a'), heater(12.5, '#7a2a2a'), heater(19.5, '#6e7480'),
      ...[6, 12.5, 19.5, 26].map(x => ball(x, 23, 1.1, 1.1, '#c8ccd4')),
      ball(9.5, 18, 3.2, 2.6, '#7a808c'), dots([[8, 18], [9, 18], [10, 18], [11, 18]], '#1a1418'),
      ball(23.5, 29.6, 2, 1.6, '#ddd5bd'), dots([[23, 29], [24, 29]], '#140e14'),
    ];
  },
  // a swordsman who died mid-duel: a pale coat over a trail of mist, a
  // feathered hat, the free hand raised behind him and a long blade held low
  duelist_ghost: () => {
    const coat = '#8aa6d6', cloak = '#46587e', mist = '#5e7298', face = '#cfe2f8', hat = '#3c4c70';
    return [
      sheet([[11, 10.5], [21, 10.5], [24, 20], [22, 23.5], [19.5, 21], [16, 24.5], [12.5, 21], [10, 23.5], [8, 20]], cloak, { curve: 0.8 }),
      limb(16, 21, 16, 29.5, 4.2, 0.6, '#3a4868'),
      limb(16, 20, 15.5, 28.5, 3.2, 0.4, mist), limb(14, 21, 10.5, 26.5, 1.4, 0.3, mist), limb(18, 21, 21.5, 26, 1.3, 0.3, mist),
      sheet([[12.5, 10.5], [19.5, 10.5], [20.5, 16.5], [19.5, 21], [12.5, 21], [11.5, 16.5]], coat, { curve: 1 }),
      line(12, 17, 20, 17, '#4e6490'),
      limb(19.5, 11.5, 23.5, 11.5, 1.2, 1, coat), limb(23.5, 11.5, 24.5, 7.5, 1, 0.8, coat), ball(24.6, 7, 1.1, 1, face),
      limb(12.5, 11.5, 10.5, 16, 1.3, 1.1, coat), limb(10.5, 16, 9, 19.5, 1.1, 0.9, coat),
      line(9, 21, 2, 30, '#e4eeff', { lit: 1 }),
      line(7, 19, 10, 22, '#8a9cc0', { lit: 1 }),
      ball(8.7, 20.2, 1.3, 1.2, face),
      ball(16, 10.6, 3.2, 1.2, '#e6eefa'),
      ball(16, 7.6, 2.7, 3, face),
      ball(16, 3.9, 2.9, 1.9, hat),
      limb(14, 3, 9.5, 1.5, 1, 0.5, '#e8f4ff'), limb(9.5, 1.5, 7.5, 3, 0.6, 0.3, '#e8f4ff'),
      ball(16, 5.2, 5, 1.1, hat),
      dots([[15, 7], [17, 7]], '#1a2440'),
      dots([[6, 12], [26, 16], [5, 24], [24, 25], [9, 28], [27, 21]], '#c8dcff'),
    ];
  },
  // bundles of grey silk hung from the roof like fruit, one with a sword hilt
  // out of it and one at the back that moves, and what fell out of them below
  silk_larder: () => {
    const silk = '#c8c4bc', bone = '#ddd5bd', worn = '#a89e84';
    const cocoon = (x, y, rx, ry, c) => [limb(x, y - ry - 1, x, y - ry * 0.5, 0.4, rx * 0.5, c), ball(x, y, rx, ry, c), limb(x, y + ry * 0.5, x + 0.3, y + ry + 1.8, rx * 0.6, 0.3, c)];
    return [
      // the threads go up into the dark, not to the top of the picture
      ...[7, 13, 19, 24.5].map(x => hair(x, 0, x, 2.5, '#4a4a58')),
      hair(7, 3, 7, 4.5, '#9a9aa6'), hair(13, 3, 13, 8.5, '#9a9aa6'), hair(19, 3, 19, 5.5, '#8a8a96'), hair(24.5, 3, 24.5, 10.5, '#9a9aa6'),
      hair(7, 14.5, 6, 17, '#9a9aa6'),
      // each bundle a spindle: tied off at the top, drawn to a point below
      ...cocoon(19, 10, 2.2, 3.4, '#8e8a84'), ball(20.6, 10.8, 1, 1.3, '#8e8a84'),
      ...cocoon(7, 9.5, 2.6, 4.2, silk),
      ...cocoon(6, 20.5, 1.7, 2.6, '#bcb8b0'),
      ...cocoon(24.5, 16.5, 3.2, 5, silk),
      limb(26.6, 12.5, 28.8, 7.8, 0.55, 0.5, '#6a4424'),
      line(25, 12, 28, 14, '#a8acb4', { lit: 1 }),
      ball(29, 7.2, 1, 1, '#c8a040'),
      ...cocoon(13, 15.5, 3.8, 5.8, silk),
      ball(9.5, 29.4, 2.3, 1.9, bone), ball(10, 31, 1.5, 0.7, worn),
      dots([[8, 29], [10, 29]], '#140e14'),
      limb(15, 30.3, 23, 29.3, 0.6, 0.55, bone), ball(14.8, 30.4, 1, 0.8, bone), ball(23.3, 29.2, 1, 0.8, bone),
      limb(25, 31, 28, 30, 0.5, 0.45, worn),
    ];
  },
  // a skeleton with a cup of dice, and a pot of gold in front of it
  bones: () => {
    const bone = '#ddd5bd', worn = '#a89e84';
    return [
      limb(13, 25, 7, 29, 1, 0.9, worn), limb(19, 25, 25, 29, 1, 0.9, worn),
      ball(6, 29.8, 1.8, 1, bone), ball(26, 29.8, 1.8, 1, bone),
      ball(16, 24.5, 3.6, 1.8, bone),
      limb(16, 13, 16, 24, 0.6, 0.6, worn),
      ...[15.5, 17.5, 19.5].map(y => limb(12.5, y, 19.5, y, 0.55, 0.55, bone)),
      limb(12, 15, 10, 21, 0.8, 0.7, bone), limb(20, 15, 21, 21, 0.8, 0.7, bone),
      ball(21, 22, 2, 1.7, '#7a5030'), dots([[20, 20], [22, 20]], '#f4ecd8'),
      ball(15.5, 10, 4.2, 4, bone), ball(15.5, 13.6, 2.6, 1.3, worn),
      dots([[13, 9], [14, 9], [13, 10], [17, 9], [18, 9], [17, 10]], '#140e14'),
      dots([[14, 13], [15, 13], [16, 13], [17, 13]], '#f6f0de'),
      ball(10, 29, 3.4, 2, '#a07830'), ball(10, 28, 2.6, 1.4, '#e8c040'), dots([[9, 27], [11, 27], [10, 26]], '#fff0a0'),
      dots([[17, 29], [18, 29], [17, 30], [18, 30], [21, 30], [22, 30], [21, 31], [22, 31]], '#f4ecd8'),
      dots([[17, 29], [22, 31], [18, 30]], '#1a1418'),
    ];
  },
  // a thin brown hound curled in a corner, a frayed collar, one ear up
  stray: () => {
    const coat = '#7a5030', dark = '#523218', pale = '#b8905e';
    return [
      ball(16, 26.5, 10, 4.5, coat),
      ball(16, 25, 8, 2.4, dark),
      limb(7, 27.5, 4, 25, 1.2, 0.7, dark),
      ...[12, 15, 18].map(x => line(x, 25, x + 1, 28, '#5a3a1e')),
      ball(22.5, 25, 4, 3.4, coat),
      sheet([[20, 22.5], [18.5, 18.5], [21.5, 22]], dark, { curve: 0.6 }),
      sheet([[24.5, 22.5], [26, 25.5], [25, 27]], dark, { curve: 0.6 }),
      limb(22, 27, 27.5, 27.5, 1.6, 1.2, '#96683e'), ball(27.8, 27.4, 1.1, 0.8, '#1a1210'),
      limb(19.5, 27.5, 24, 28.5, 0.9, 0.9, '#a02828'), ball(22, 29.2, 0.8, 0.8, '#d8b848'),
      dots([[22, 24], [24, 24]], '#2a1808'), dots([[22, 23], [24, 23]], '#f0d8a0'),
      ...[10, 14, 18].map(x => ball(x, 29.5, 1.6, 0.8, pale)),
    ];
  },
  // a squat iron cage, banded top and bottom and its door shut with a heavy
  // padlock, and a goblin crouched inside with its fingers round the bars,
  // peering out between them to see what you will do
  cage: () => {
    const iron = '#555a64', far = '#2e3038', skin = '#72ac4c', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c';
    // the bars stand either side of the middle (x = 16), with a wider gap at
    // the door so the face shows whole through it
    const bars = [5.5, 9, 12.5, 19.5, 23, 26.5];
    return [
      // the cage's floor, dark and strewn with straw, and its far bars
      sheet([[4.5, 25.5], [27.5, 25.5], [27.5, 29], [4.5, 29]], '#3a3630', { tilt: [0, -0.9] }),
      ...[7.2, 10.8, 14.4, 17.6, 21.2, 24.8].map(x => limb(x, 10, x, 26, 0.45, 0.45, far)),
      // the goblin, squatting on its heels, knees out, reaching for the bars
      limb(10.6, 25, 13.2, 27.6, 1, 0.85, dark), limb(21.4, 25, 18.8, 27.6, 1, 0.85, dark),
      ball(13.2, 27.8, 1.8, 0.8, foot), ball(18.8, 27.8, 1.8, 0.8, foot),
      ball(16, 24.6, 3.2, 3, skin),
      limb(12.6, 22.4, 10.6, 24, 0.95, 0.9, skin), limb(19.4, 22.4, 21.4, 24, 0.95, 0.9, skin),
      sheet([[12, 21.2], [20, 21.2], [22.4, 22.4], [23, 25], [21.6, 24.4], [20.6, 25.8], [19.2, 24.6], [17.6, 26], [16, 24.8],
        [14.4, 26], [12.8, 24.6], [11.4, 25.8], [10.4, 24.4], [9, 25], [9.6, 22.4]], rag, { curve: 1 }),
      limb(14.4, 26.4, 10.6, 25, 1.2, 1.1, dark), limb(17.6, 26.4, 21.4, 25, 1.2, 1.1, dark),
      ball(10.4, 24.8, 1.4, 1.3, dark), ball(21.6, 24.8, 1.4, 1.3, dark),
      // elbows out over its knees, hands up to the door bars under its chin
      limb(10.6, 24, 12.2, 21.8, 0.9, 0.85, skin), limb(21.4, 24, 19.8, 21.8, 0.9, 0.85, skin),
      // the manacle it came in with, still on, a link of chain hanging
      ball(10.6, 24.4, 0.75, 0.8, iron), specks([[10.6, 24.4]], '#1c1a22'),
      limb(10.6, 22.4, 12.2, 23.4, 0.85, 0.85, iron),
      ball(12.5, 21.2, 1.25, 1.15, skin), ball(19.5, 21.2, 1.25, 1.15, skin),
      ...scragHead(16, 17.4, { look: 0 }),
      // the near bars, in front of it all
      ...bars.map(x => limb(x, 9, x, 28.6, 0.6, 0.6, iron)),
      // fingers curled round them
      limb(11.6, 20.9, 13.4, 20.9, 0.55, 0.55, skin), limb(18.6, 20.9, 20.4, 20.9, 0.55, 0.55, skin),
      specks([[12, 21.5], [13, 21.5], [19, 21.5], [20, 21.5]], '#e8e0c0'),
      // the door's rails and hinges
      limb(12.5, 12, 19.5, 12, 0.55, 0.55, iron), limb(12.5, 24, 19.5, 24, 0.55, 0.55, iron),
      ball(12.5, 13, 0.9, 1.1, '#484c56'), ball(12.5, 23, 0.9, 1.1, '#484c56'),
      // the bands top and bottom, and a ring on top to hang it by
      limb(14.2, 7.6, 15, 5.4, 0.55, 0.55, iron), limb(17.8, 7.6, 17, 5.4, 0.55, 0.55, iron), limb(15, 5.2, 17, 5.2, 0.55, 0.55, iron),
      sheet([[3.8, 7.4], [28.2, 7.4], [28.2, 10], [3.8, 10]], iron, { curve: 0.8 }),
      sheet([[3.8, 28.4], [28.2, 28.4], [28.4, 31], [3.6, 31]], iron, { curve: 0.8 }),
      // the padlock, big as a fist, through a hasp on the door's edge
      limb(18.9, 24.6, 18.9, 22.6, 0.5, 0.5, '#8a8e96'), limb(21.1, 24.6, 21.1, 22.6, 0.5, 0.5, '#8a8e96'), limb(18.9, 22.2, 21.1, 22.2, 0.5, 0.5, '#8a8e96'),
      sheet([[17.8, 24.2], [22.2, 24.2], [22.6, 27.8], [17.4, 27.8]], '#6e6248', { curve: 0.9 }),
      dots([[20, 25], [20, 26]], '#140e10'),
      // fine work: rivets along the bands, rust, straw, the lock's shine
      specks([[5.5, 8.5], [9, 8.5], [12.5, 8.5], [19.5, 8.5], [23, 8.5], [26.5, 8.5], [5.5, 29.5], [9, 29.5], [12.5, 29.5], [19.5, 29.5], [23, 29.5], [26.5, 29.5]], '#9aa0aa'),
      hair(5.5, 13, 5.5, 15, '#7a4a2a'), hair(26.5, 22, 26.5, 24.5, '#7a4a2a'), specks([[9, 25.5], [23, 12]], '#7a4a2a'),
      hair(6, 27.5, 8, 27, '#a8904a'), hair(24, 27.5, 26.5, 28, '#a8904a'), hair(15, 28, 17, 27.5, '#a8904a'),
      hair(18.5, 24.5, 18.5, 27, '#b8a878'), specks([[20.5, 22], [21, 22.5]], '#c8ccd4'),
    ];
  },

  // one of the Lampfolk, hunched in the dark with its lamp gone cold in its
  // lap: the same grey skin and drooping ears as the traders, the eyes dim
  lampfolk_dark: () => {
    const skin = '#7e8694', dark = '#5a6270', robe = '#5a4c3e', pack = '#4e3e2e';
    return [
      ball(24, 20, 6, 7, pack), limb(19.5, 13.5, 28.5, 13.5, 1.8, 1.8, '#6e3e32'),
      ...both(ball(11.5, 30, 3, 1.3, skin)),
      sheet([[8, 20], [21, 20], [23, 30], [6, 30]], robe, { curve: 1 }),
      line(4, 18, 13, 30, '#5a4630'),
      ball(14.5, 25.5, 3, 2.4, '#4a4a50'), ball(14.5, 24.5, 1.6, 1.2, '#2a2a30'),
      line(14.5, 22, 14.5, 23, '#3a3a40'),
      ...both(limb(9.5, 21, 12.5, 25.5, 1.3, 1.1, robe)),
      ...both(ball(12.8, 25.8, 1.3, 1.2, skin)),
      sheet([[10.5, 13.5], [4, 17.5], [5, 19], [10.5, 16.5]], skin, { tilt: [-0.5, 0.2] }),
      sheet([[19.5, 13.5], [26, 17.5], [25, 19], [19.5, 16.5]], skin, { tilt: [0.5, 0.2] }),
      ball(15, 15.5, 5.4, 4.8, skin),
      ...both(ball(12.7, 15.5, 1.8, 1.6, '#8a8468')),
      dots([[13, 16], [17, 16]], '#2a2630'),
      ball(15, 18, 0.7, 0.5, dark),
      dots([[14, 19], [15, 19.5], [16, 19]], '#4a4452'),
    ];
  },
  // a dwarf-built anvil by a cold hearth, a half-made blade across it
  anvil: () => {
    const iron = '#5a5e66', hi = '#7a7e88';
    return [
      sheet([[3, 10], [11, 10], [12, 30], [2, 30]], '#4a3e38', { curve: 0.5 }),
      sheet([[4, 18], [10, 18], [10.5, 24], [3.5, 24]], '#1e1614', { curve: 0.6 }),
      dots([[5, 22], [7, 23], [8, 22], [6, 23]], '#6a3a24'),
      sheet([[16, 25], [26, 25], [28, 30.5], [14, 30.5]], iron, { curve: 0.6 }),
      sheet([[18, 20], [24, 20], [23.5, 25.5], [18.5, 25.5]], '#4a4e56', { curve: 0.5 }),
      sheet([[12, 16], [28, 16], [30, 18], [28, 20.5], [14, 20.5]], hi, { curve: 0.7 }),
      line(12, 16, 28, 16, '#9a9ea8', { lit: 1 }),
      line(13, 15, 27, 14, '#b8bcc4', { lit: 1 }), line(13, 14.5, 26.5, 13.5, '#8a8e96'),
      line(26.5, 14, 29.5, 13, '#6a4a2a'), line(26, 12.5, 26.8, 15.5, '#8a7a4a'),
      limb(4, 30, 9, 27, 0.8, 0.6, '#6a4a2a'), ball(10, 26.5, 1.6, 1.4, '#6a6e76'),
    ];
  },
  // black water in a stone basin, perfectly still, something pale on the bottom
  pool: () => [
    ball(16, 26, 13, 5, '#5a564e'),
    ball(16, 26, 11, 3.8, '#0e1218'),
    ball(13, 25, 5, 1.4, '#1c2430'),
    dots([[19, 27], [20, 27]], '#c8c4a8'), dots([[21, 26]], '#8a8670'),
    line(8, 25, 12, 24.5, '#3a4a5e'), line(18, 24, 23, 24.5, '#2a3444'),
    dots([[5, 24], [27, 24], [4, 27], [28, 27]], '#7a766c'),
    ball(6, 21, 2, 1.6, '#6a665e'), ball(26.5, 21.5, 2.4, 1.8, '#6a665e'),
  ],
  // a goblin cook-pot on its tripod over a low fire, bubbling, a ladle in it
  cookpot: () => [
    limb(7, 30, 13, 8, 0.6, 0.5, '#5a4030'), limb(25, 30, 19, 8, 0.6, 0.5, '#5a4030'),
    ...[[11, 30], [16, 31], [21, 30]].map(([x, y]) => limb(x - 3, y, x + 3, y - 1, 0.8, 0.8, '#4a3020')),
    ball(16, 28.5, 5, 2.2, '#c84a1a'), ball(16, 28, 3, 1.4, '#ffb040'), dots([[15, 27], [17, 28]], '#fff0a0'),
    line(16, 8, 16, 14, '#3a3a40'),
    ball(16, 20, 8, 6.5, '#3a3a42'),
    ball(16, 15, 7.5, 2, '#5a4a2a'),
    ball(13, 15, 1.4, 1, '#7a6a3a'), ball(19, 14.6, 1.2, 0.9, '#7a6a3a'),
    line(18, 15, 23, 6, '#8a6a3a'), ball(18, 15, 1.6, 0.8, '#6a5a3a'),
    dots([[12, 14], [11, 15], [12, 16], [13, 16]], '#2a1a10'),
    specks([[14, 11], [17, 9], [15, 7], [18, 12]], '#b8b4a8'),
  ],
  // a stone knight kneeling on its plinth, head bowed, a real sword on its knees
  statue: () => {
    const stone = '#8a867c', dark = '#6a665e', moss = '#4a6a3a';
    return [
      sheet([[4, 25], [28, 25], [28, 31], [4, 31]], dark, { curve: 0.5 }),
      line(4, 25, 28, 25, '#9a968c'),
      limb(12, 22, 7, 24.5, 2, 1.6, stone), ball(6.5, 24.5, 2.2, 1, stone),
      limb(20, 20, 24, 24.5, 2, 1.8, stone),
      sheet([[10, 11], [22, 11], [23, 22], [9, 22]], stone, { curve: 0.8 }),
      ball(16, 8, 3.8, 4, '#9a968c'), line(13, 8.5, 19, 8.5, '#4a4640'),
      ...both(limb(10.5, 12, 11.5, 19, 1.5, 1.3, stone)),
      line(5, 19.5, 27, 19.5, '#c8ccd4', { lit: 1 }), line(5, 20.2, 27, 20.2, '#8e929a', { lit: 1 }),
      line(7.5, 18, 7.5, 21.5, '#9a7a3a'),
      line(14.5, 10, 14.5, 14, '#8ab0d8'), line(17.5, 10, 17.5, 15, '#8ab0d8'),
      dots([[5, 26], [6, 26], [7, 27], [24, 26], [26, 27], [11, 21], [21, 13]], moss),
      specks([[9, 28], [15, 29], [22, 28]], '#5a564e'),
    ];
  },
  // a grinning idol of green stone, ruby eyes, a scorched ring before it
  idol: () => {
    const jade = '#3e7a5a', dark = '#2a5a42';
    return [
      ball(16, 29.5, 11, 2, '#2a2220'), ball(16, 29.5, 8, 1.3, '#1a1412'),
      ...both(limb(13, 26, 8, 27.5, 2.2, 1.8, dark)),
      ball(16, 21.5, 6, 5.5, jade),
      ...both(limb(11, 18, 9.5, 24, 1.4, 1.2, dark)),
      ball(16, 11, 6, 5.5, '#4a8a68'),
      sheet([[10, 8], [16, 3], [22, 8]], dark, { curve: 0.5 }),
      ...both(ball(13.5, 10, 1.5, 1.3, '#d02030')), ...both(dots([[13, 9]], '#ff8090')),
      line(12, 14, 20, 14, '#1a3a2a'), dots([[13, 13], [19, 13]], '#1a3a2a'),
      dots([[14, 14], [16, 14], [18, 14]], '#d8e0c0'),
      specks([[10, 28], [22, 29], [14, 30], [19, 28]], '#4a3a30'),
    ];
  },
  // a surveyor's bones against the wall, a satchel of maps, a finger pointing on
  mapmaker: () => {
    const bone = '#ddd5bd', worn = '#a89e84';
    return [
      limb(13, 25, 7, 29, 1, 0.9, worn), limb(19, 25, 25, 29, 1, 0.9, worn),
      ball(6, 29.8, 1.8, 1, bone), ball(26, 29.8, 1.8, 1, bone),
      sheet([[10, 13], [22, 13], [23, 25], [9, 25]], '#4a5a3a', { curve: 0.9 }),
      line(16, 13, 16, 25, '#2e3a24'),
      ball(15.5, 10, 4.2, 4, bone), ball(15.5, 13.6, 2.6, 1.3, worn),
      dots([[13, 9], [14, 9], [13, 10], [17, 9], [18, 9], [17, 10]], '#140e14'),
      sheet([[10, 21], [19, 21], [19.5, 27], [9.5, 27]], '#7a5030', { curve: 0.6 }),
      ...[[11, 20], [13.5, 19.5], [16, 20]].map(([x, y]) => limb(x, y, x + 1, y - 4, 0.9, 0.9, '#e8dcb8')),
      limb(21, 16, 27, 19, 0.8, 0.7, bone), line(27, 19, 30, 19.5, bone),
      dots([[24, 17], [25, 18], [26, 18.5], [23, 16.5]], '#a8aeb4'),
    ];
  },
};

// A cut-down skeleton: a low, scattered heap on the floor, not a figure, so it
// never reads as something still standing. The skull sits on top, eyes lit.
PROPS.bone_heap = () => {
  const bone = '#ddd5bd', worn = '#a89e84';
  return [
    limb(5, 29, 15, 26.5, 0.9, 0.8, worn), ball(4.6, 29.2, 1.3, 1, bone), ball(15.4, 26.4, 1.2, 1, bone),
    limb(17, 26, 27, 29.5, 0.9, 0.8, worn), ball(16.6, 25.9, 1.2, 1, bone), ball(27.4, 29.6, 1.3, 1, bone),
    limb(8, 25.5, 23, 30, 0.8, 0.7, bone), ball(7.6, 25.3, 1.1, 0.9, bone), ball(23.4, 30.2, 1.2, 0.9, bone),
    ...[26.5, 28, 29.5].map((y, i) => limb(11 + i, y, 20 - i, y + 0.5, 0.5, 0.5, bone)),
    ball(16, 30, 4.2, 1.6, worn),
    ball(13, 23.6, 3.6, 3.3, bone), ball(13.4, 26.4, 2.2, 1, worn),
    dots([[11, 23], [12, 23], [14, 23], [15, 23]], '#140e14'),
    dots([[11, 23], [14, 23]], '#b040ff'),
    dots([[12, 26], [13, 26], [14, 26]], '#f6f0de'),
  ];
};

// The props get the same fine hand as the monsters.
const PROP_DETAILS = {
  rubble: () => [
    specks([[13, 20], [14, 21], [16, 26], [9, 23], [22, 25.5], [6, 28.5], [26.5, 28.5]], '#9a9288'),
    hair(11, 24, 13.5, 25.5, '#5a544c'), hair(18, 25, 21, 24.5, '#5a544c'),
    specks([[26.5, 16], [27.5, 16.5], [28, 17.5]], '#f0c8a0'),
    specks([[18, 23.5], [19.5, 23], [21, 23.5]], '#4a6a9a'),
    specks([[4, 30.5], [12, 31], [24, 31], [29, 30.5]], '#8a8278'),
  ],
  shrine: () => [
    hair(10, 22.5, 22, 22.5, '#8a867c'), hair(9, 27.5, 23, 27.5, '#4a463e'),
    hair(13, 12, 14, 17, '#5a564e'), hair(19, 12, 18, 17, '#5a564e'),
    specks([[15, 5], [17, 5], [16, 6]], '#a8a498'),
    specks([[14.5, 24.5], [15, 24.5], [18, 24.5], [18.5, 24.5]], '#fff0a0'),
    ...both(specks([[7, 16.5], [7, 16], [7.5, 15.5]], '#a0a0b0')),
    specks([[20.5, 23.5], [21, 23.5]], '#c02838'),
  ],
  runestone: () => [
    hair(9, 10, 10.5, 15, '#2a2632'), hair(21, 26, 23, 29, '#2a2632'), hair(13, 27, 14, 29.5, '#2a2632'),
    specks([[11, 3], [14, 2.5], [19, 3], [22.5, 5]], '#5a5468'),
    specks([[10.5, 7.5], [14.5, 12.5], [19.5, 17.5], [12.5, 22.5]], '#ffffff'),
    specks([[9, 29], [10, 29.5], [22, 30], [23, 29.5]], '#4a8040'),
  ],
  goblin_hurt: () => [
    specks([[16.5, 24.5], [17.5, 27], [16, 28.5]], '#801818'),
    hair(12.5, 14.5, 14, 15.5, '#3f6e2c'), hair(19.5, 14.5, 18, 15.5, '#3f6e2c'),
    specks([[15.5, 17.5], [16.5, 17.5]], '#2e5020'),
    specks([[13, 16.5], [13, 17]], '#9ad0ff'),
    specks([[12, 23], [14, 23], [18, 23], [20, 23]], '#a88258'),
    specks([[27.5, 17], [28, 16]], '#8a5a30'),
  ],
  strongbox: () => [
    hair(7, 21, 26, 21, '#5a3a1e'), hair(7, 25, 26, 25, '#5a3a1e'), hair(7, 15.5, 25, 15.5, '#8a5a36'),
    ...[9, 16, 23].map(x => specks([[x, 14], [x, 17], [x, 20], [x, 24], [x, 28]], '#a8b0b8')).flat(),
    specks([[15, 18], [15.5, 18], [17, 21], [17.5, 21.5]], '#7a4a20'),
    specks([[14.5, 17.5], [17.5, 17.5]], '#e0c060'),
  ],
  wisp: () => [
    specks([[14, 14], [14.5, 13.5], [15, 14]], '#ffffff'),
    hair(13, 22, 12, 26, '#8a9aba'), hair(19, 22, 20, 25, '#8a9aba'),
    specks([[10, 11], [22, 12], [9.5, 18], [23, 17], [11, 23], [21.5, 21]], '#e8f4ff'),
  ],
  fungus: () => [
    hair(10, 20, 16, 20, '#c8bca4'), hair(16, 17, 24, 17, '#c8bca4'),
    specks([[11, 18.5], [14, 18], [18, 15], [21, 14.5], [23, 15.5], [24, 23], [5.5, 22], [16, 24]], '#b89078'),
    specks([[8.5, 26.5], [9.5, 26.5]], '#5a5048'), hair(8, 28.5, 10, 28.5, '#8a8070'),
    specks([[3, 30], [28, 30.5], [22, 31], [11, 31]], '#a0c890'),
  ],
  prisoner: () => [
    hair(12, 15, 13, 23, '#8a7e66'), hair(20, 15, 19, 23, '#8a7e66'), specks([[14, 24.5], [17, 24.5], [20, 24.5]], '#8a7e66'),
    specks([[8, 8], [9, 9.5], [24, 8], [23, 9.5]], '#a8acb4'),
    specks([[21.5, 12.5], [22, 13.5]], '#ff6040'),
    hair(14.5, 10.5, 15.5, 11, '#8a6a50'), specks([[17.5, 12.5], [14, 13]], '#4a3020'),
    specks([[15, 8.5], [17, 8.5]], '#c8e0ff'),
  ],
  well: () => [
    hair(6, 3, 26, 3, '#7a5030'), hair(7, 5, 25, 5, '#4a2e18'),
    hair(6, 11, 6, 18, '#4a2e18'), hair(26, 11, 26, 18, '#4a2e18'),
    specks([[16, 10], [16, 11], [16, 12], [16, 13]], '#e8d8b0'),
    specks([[14.5, 15], [17, 15], [14.5, 16.5], [17, 16.5]], '#3a2a18'),
    specks([[8, 21], [15, 21.5], [22, 21], [10, 25], [17, 25], [23, 25.5], [9, 28.5], [20, 29]], '#9a948a'),
    specks([[14, 19.5], [18, 19]], '#aac8e8'),
  ],
  bookcase: () => [
    ...[3, 10, 18].map(y => specks([[9, y + 2], [13, y + 3], [17, y + 2], [21, y + 3]], '#e8d8a8')).flat(),
    hair(15.5, 11, 15.5, 16, '#fff0a0'),
    specks([[6, 5], [26, 5], [6, 13], [26, 13], [6, 21], [26, 21]], '#5a3e28'),
    specks([[7, 30], [25, 30], [12, 30.5]], '#4a3020'),
    hair(9, 27, 13, 27, '#e8d0a0'), hair(9, 28, 13, 28, '#e8d0a0'),
  ],
  ogre_sleep: () => [
    specks([[12, 29.5], [19, 30], [26, 29.5], [6.5, 30]], '#fff8c0'),
    // eyes shut: lids over both, a dark line where they meet
    specks([[14, 9], [14.5, 9], [18, 9], [18.5, 9]], '#9a7648'),
    specks([[14, 9.5], [14.5, 9.5], [18, 9.5], [18.5, 9.5]], '#3a2410'),
  ],
  mirror: () => [
    specks([[9, 7], [23, 7], [8, 14], [24, 14], [9, 21], [23, 21], [16, 25.5]], '#fff0a0'),
    hair(18, 5, 20, 8, '#e8f4ff'), hair(19, 16, 21, 19, '#c8dcf0'),
    specks([[15, 11.5], [17, 11.5]], '#ff4040'),
    specks([[15.5, 2], [16.5, 1.5]], '#ffffff'),
    hair(11, 30, 12.5, 26, '#6a4a30'),
  ],
  chest: () => [
    specks([[12, 23], [13, 25], [19, 23], [20, 25], [16, 26.5]], '#e8c060'),
    hair(7, 21, 9.5, 27, '#6a1a1a'), hair(23, 21, 25, 27, '#6a1a1a'),
    specks([[15, 18.5], [17, 18.5], [15, 21.5], [17, 21.5]], '#a07820'),
    specks([[25, 12.5], [26.5, 11], [28, 10]], '#f0f4fa'),
    specks([[30, 7], [31, 8]], '#ff4020'),
  ],
  goblin_toll: () => [
    specks([[1, 9], [9, 9], [1, 14], [9, 14]], '#7a5a30'),
    hair(0.5, 11.5, 9.5, 11.5, '#9a7648'),
  ].map(up2),
  barricade: () => [
    specks([[5, 20.5], [7, 20.5], [11.5, 20.5], [13.5, 20.5], [18.5, 20.5], [20.5, 20.5], [25, 20.5], [27, 20.5]], '#c8ccd4'),
    hair(12.5, 20, 12.5, 29, '#e0b848'), hair(10, 23, 15, 23, '#e0b848'),
    hair(4, 21, 8, 27, '#1e3a6a'), hair(24, 21, 28, 26, '#3a5a2a'),
    specks([[19, 21], [20, 22.5], [19.5, 26]], '#8a909a'),
    hair(17, 5, 17, 10, '#6a1a1a'), specks([[25.5, 6], [26, 8]], '#6a1a1a'),
    specks([[8.5, 17.5], [10.5, 17.5]], '#a0a8b4'),
  ],
  bones: () => [
    hair(14, 8, 15, 10, '#8a826c'),
    specks([[20.5, 21], [21.5, 20.5], [22, 22]], '#f8f0d8'),
    specks([[9, 27.5], [10.5, 26.5], [11, 28]], '#fff0a0'),
    hair(13, 16, 19, 16, '#b8ae94'), hair(13, 18, 19, 18, '#b8ae94'),
    specks([[18, 30], [18.5, 29.5], [21.5, 30.5]], '#8a826c'),
  ],
  duelist_ghost: () => [
    hair(13.5, 12, 13, 20, '#6a84b4'), hair(18.5, 12, 19, 20, '#6a84b4'),
    specks([[16, 12.5], [16, 14], [16, 15.5]], '#e8f4ff'),
    specks([[8, 22.5], [6.5, 24.5], [5, 26.5]], '#ffffff'),
    hair(15, 18, 14.5, 25, '#8aa0c4'), hair(17, 18, 18, 24, '#8aa0c4'),
    specks([[15, 9], [15.5, 9], [16.5, 9], [17, 9], [14.5, 9.5], [17.5, 9.5]], '#7088b4'),
    specks([[7, 13], [25, 17.5], [4, 20], [23, 27], [12, 29.5], [28, 12]], '#e8f4ff'),
  ],
  silk_larder: () => [
    // the wrapping: a few turns of thread across each bundle
    hair(10, 11.5, 16, 13.5, '#9a968e'), hair(9.5, 15, 16.5, 17.5, '#9a968e'), hair(10.5, 18.5, 15.5, 20.5, '#9a968e'),
    hair(5, 7.5, 9, 9, '#9a968e'), hair(5, 10.5, 9, 12, '#9a968e'),
    hair(22, 15, 27, 16.5, '#9a968e'), hair(22, 18.5, 27, 20, '#9a968e'),
    hair(17.5, 9, 21, 10.5, '#6a6660'),
    // web strung between them
    hair(9, 7, 13, 11, '#a8a8b4'), hair(16.5, 13, 22, 14, '#a8a8b4'), hair(20, 7, 24, 12, '#a8a8b4'),
    // the one at the back is moving
    hair(15.5, 8, 15, 10, '#c8c4bc'), hair(22.5, 9, 23, 11, '#c8c4bc'),
    specks([[26.5, 11.5], [27.5, 9.5]], '#8a5a30'), specks([[28.5, 6.5]], '#fff0a0'),
    specks([[11.5, 12], [23.5, 13], [6, 7]], '#f0ece4'),
    specks([[16.5, 30], [20, 29.5]], '#f6f0de'), specks([[11, 30.5], [12.5, 31]], '#8a826c'),
  ],
  bone_heap: () => [
    hair(12, 22, 13, 23.5, '#8a826c'),
    specks([[12.5, 26], [13.5, 26], [14.5, 26]], '#6a6252'),
    specks([[6, 28.5], [26, 29], [22, 30], [9, 26]], '#f6f0de'),
  ],
};
for (const k in PROP_DETAILS) {
  const base = PROPS[k];
  PROPS[k] = () => [...base(), ...PROP_DETAILS[k]()];
}

// The hero's own hand, seen from behind at the bottom of the view: a fist
// on a sleeve, gloved as each class goes armed. It holds the weapon drawn
// over it, and rises into view to cast.
// Creatures that hover, and so cast no shadow on the floor.
const FLOATING = new Set(['bat', 'wraith', 'lich', 'wisp', 'duelist_ghost', 'shade']);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---- the painter ----
// Turns a list of parts (see creatures.js) into lit pixels. Light comes from
// the upper left and a little in front; each part's tone is picked from a
// six-step ramp that cools and deepens into shadow and warms into light,
// the way a painter mixes rather than just adding black.
const LIGHT = (() => { const v = [-0.5, -0.75, 0.55], n = Math.hypot(...v); return v.map(c => c / n); })();
// Shadows are mixed toward a deep indigo and light toward a warm cream, as a
// painter mixes rather than adding black. (Rotating the hue instead sent
// warm colours the short way round the wheel, through red: bone came out
// with salmon-pink shadows.)
const SHADOW_INK = [28, 24, 48], LIGHT_CREAM = [255, 242, 208];
const mixTo = (rgb, to, a) => '#' + rgb.map((v, i) => Math.round(v + (to[i] - v) * a).toString(16).padStart(2, '0')).join('');
const rampCache = new Map();
// The creatures of the deep are painted grim rather than bright: each colour
// muted toward grey and darkened, its shadows sunk nearly to black and its lit
// side hot, so a figure reads as worn, lifelike and lit by a torch, not as a
// cartoon. Items keep the bright, clean ramp, so a potion or a ring is easy to
// tell from the next.
function ramp(hex, grim = false) {
  const key = grim ? hex + '!' : hex;
  if (rampCache.has(key)) return rampCache.get(key);
  let rgb = hexToRgb(hex);
  if (grim) {
    const lum = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
    rgb = rgb.map(v => Math.round((v + (lum - v) * 0.3) * 0.86));
  }
  const out = grim
    ? [mixTo(rgb, [10, 8, 14], 0.86), mixTo(rgb, [14, 10, 20], 0.64), mixTo(rgb, [20, 16, 28], 0.36), mixTo(rgb, rgb, 0), mixTo(rgb, LIGHT_CREAM, 0.28), mixTo(rgb, LIGHT_CREAM, 0.6)]
    : [mixTo(rgb, SHADOW_INK, 0.72), mixTo(rgb, SHADOW_INK, 0.5), mixTo(rgb, SHADOW_INK, 0.26),
      hex, mixTo(rgb, LIGHT_CREAM, 0.22), mixTo(rgb, LIGHT_CREAM, 0.45)];
  rampCache.set(key, out);
  return out;
}
// (painted grim, more of a figure lies in shadow)
const BANDS = [0.3, 0.45, 0.58, 0.76, 0.9], GRIM_BANDS = [0.38, 0.54, 0.66, 0.82, 0.94];
// a 4x4 ordered-dither matrix: where two tones meet, the upper edge of the
// darker band is stippled with the lighter one, so a curve grades smoothly
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
/** The ramp step for a surface normal; with a pixel given, blended across band edges. */
function toneFor(nx, ny, nz, px, py, grim = false) {
  const n = Math.hypot(nx, ny, nz) || 1;
  const dot = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n;
  // the side turned from the light is not one flat dark: light thrown back
  // off the floor lifts its far edge a step, so a limb reads round
  const v = 0.3 + 0.7 * Math.max(0, dot) + (dot < -0.3 ? 0.2 * Math.min(1, (-dot - 0.3) / 0.45) : 0);
  const bands = grim ? GRIM_BANDS : BANDS;
  let i = 0;
  while (i < bands.length && v >= bands[i]) i++;
  if (px == null || i >= bands.length) return i;
  const lo = i ? bands[i - 1] : 0.3, hi = bands[i], f = (v - lo) / ((hi - lo) || 1);
  const soft = 0.4;
  return f > 1 - soft && BAYER[(py & 3) * 4 + (px & 3)] < (f - (1 - soft)) / soft ? i + 1 : i;
}
/** Strong, bright colours in a creature's dots are its eyes (teeth and bone are pale, not saturated). */
function isEyeColour(hex) { const [r, g, b] = hexToRgb(hex); return Math.max(r, g, b) - Math.min(r, g, b) > 110 && Math.max(r, g, b) > 170; }
/** A steady value in [0, 1) for a pixel of a part: grain that never flickers. */
const grain = (x, y, i) => { const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453; return s - Math.floor(s); };
function insidePoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/**
 * @param {number} [scale]  how many pixels to paint for each unit of the 32-grid
 *   the parts are drawn on: 2 paints a monster at 64x64, with smoother curves,
 *   blended shading and a fine grain on skin and cloth, from the same parts.
 * @returns {{aw: number, ah: number, color: (string|null)[]}}
 */
/** @param {boolean} [grim] painted grim (see ramp): the creatures, props and dressing, not items */
function paintParts(parts, grid = 32, scale = 1, grim = false) {
  const size = grid * scale;
  const N = size * size;
  const col = new Array(N).fill(null), tone = new Int8Array(N).fill(-1), owner = new Int16Array(N).fill(-1);
  const base = new Array(N).fill(null);
  const put = (x, y, i, b, t, exact) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const k = y * size + x;
    owner[k] = i; base[k] = exact ? null : b; tone[k] = exact ? -1 : t; col[k] = exact ? b : null;
  };
  parts.forEach((p, i) => {
    // detail meant for a creature right in front of you (see NEAR) is left out
    // of the pictures painted for further off, where it would only be noise
    if (p.near && scale < 4) return;
    // eyes, teeth and glints stay whole pixels of the grid, crisp at any scale
    if (p.k === 'dots') {
      // painted finely, a coloured eye catches a glint in its upper corner
      const glint = scale > 1 && isEyeColour(p.c) ? mixTo(hexToRgb(p.c), LIGHT_CREAM, 0.75) : null;
      for (const [x, y] of p.pts) {
        const gx = Math.round(x) * scale, gy = Math.round(y) * scale;
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) put(gx + a, gy + b, i, glint && a === 0 && b === 0 ? glint : p.c, 0, true);
      }
      return;
    }
    if (p.k === 'specks') { for (const [x, y] of p.pts) put(Math.floor(x * scale), Math.floor(y * scale), i, p.c, 0, true); return; }
    if (p.k === 'hair') {
      let x0 = Math.floor(p.x1 * scale), y0 = Math.floor(p.y1 * scale);
      const x1 = Math.floor(p.x2 * scale), y1 = Math.floor(p.y2 * scale);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        put(x0, y0, i, p.c, 0, true);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return;
    }
    if (p.k === 'line') {
      // a line keeps its width in the grid, so a blade reads as far off as before
      let x0 = Math.round(p.x1) * scale, y0 = Math.round(p.y1) * scale;
      const x1 = Math.round(p.x2) * scale, y1 = Math.round(p.y2) * scale;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) put(x0 + a, y0 + b, i, p.c, 0, true);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return;
    }
    // only the pixels the shape could cover: scanning the whole grid for every
    // part made painting most of the time the game spent starting up
    let x0, y0, x1, y1;
    if (p.k === 'ball') { x0 = p.x - p.rx; x1 = p.x + p.rx; y0 = p.y - p.ry; y1 = p.y + p.ry; }
    else if (p.k === 'limb') {
      const r = Math.max(p.r1, p.r2, 0.55);
      x0 = Math.min(p.x1, p.x2) - r; x1 = Math.max(p.x1, p.x2) + r; y0 = Math.min(p.y1, p.y2) - r; y1 = Math.max(p.y1, p.y2) + r;
    } else {
      const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
      x0 = Math.min(...xs); x1 = Math.max(...xs); y0 = Math.min(...ys); y1 = Math.max(...ys);
    }
    const bx0 = Math.max(0, Math.floor(x0 * scale) - 1), bx1 = Math.min(size - 1, Math.ceil(x1 * scale) + 1);
    const by0 = Math.max(0, Math.floor(y0 * scale) - 1), by1 = Math.min(size - 1, Math.ceil(y1 * scale) + 1);
    // at scale 1 the tones stay as they always were; finer painting blends them
    const fine = scale > 1, rough = fine && !p.smooth;
    const tn = (nx, ny, nz, x, y) => {
      // cloth is flat enough that blending its bands only reads as mesh
      let t = fine && p.k !== 'sheet' ? toneFor(nx, ny, nz, x, y, grim) : toneFor(nx, ny, nz, undefined, undefined, grim);
      if (rough && t > 0) {
        // painted grim, the grain is heavier, worn into skin, hide and cloth
        // (lighter where it is finest, up close, or it came out as speckle)
        const g = grim ? (scale >= 4 ? 0.13 : 0.2) : 0.09;
        if (p.k === 'sheet') {
          // cloth hangs in folds: a few broad darker runs down it, not speckle
          const fx = x / scale, fy = y / scale;
          if (Math.sin(fx * 1.25 + Math.sin(fy * 0.35 + i) * 1.1) > (grim ? 0.75 : 0.9)) t--;
          else if (grim && grain(x, y, i) < g * 0.6) t--;
        } else if (grain(x, y, i) < g) t--;   // a fine grain on skin and fur
        else if (grim && t < 5 && grain(x + 7, y + 3, i) > (scale >= 4 ? 0.965 : 0.93)) t++;
      }
      return t;
    };
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = (x + 0.5) / scale, py = (y + 0.5) / scale;
      if (p.k === 'ball') {
        const nx = (px - p.x) / p.rx, ny = (py - p.y) / p.ry, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        put(x, y, i, p.c, tn(nx, ny, Math.sqrt(1 - d2), x, y));
      } else if (p.k === 'limb') {
        const ax = p.x2 - p.x1, ay = p.y2 - p.y1, L2 = ax * ax + ay * ay || 1;
        const t = Math.max(0, Math.min(1, ((px - p.x1) * ax + (py - p.y1) * ay) / L2));
        const cx = p.x1 + ax * t, cy = p.y1 + ay * t, r = p.r1 + (p.r2 - p.r1) * t;
        const ex = px - cx, ey = py - cy, d = Math.hypot(ex, ey);
        if (d > Math.max(r, 0.55)) continue;
        const u = Math.min(1, d / Math.max(r, 0.55));
        put(x, y, i, p.c, tn(ex / (d || 1) * u, ey / (d || 1) * u, Math.sqrt(1 - u * u), x, y));
      } else if (p.k === 'sheet') {
        if (!insidePoly(p.pts, px, py)) continue;
        let nx = 0, ny = -0.2, nz = 1;
        if (p.tilt) { nx = p.tilt[0]; ny = p.tilt[1]; }
        if (p.curve) {
          const xs = p.pts.map(q => q[0]), lo = Math.min(...xs), hi = Math.max(...xs);
          nx = ((px - lo) / ((hi - lo) || 1) * 2 - 1) * 0.85 * p.curve;
          nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        }
        put(x, y, i, p.c, tn(nx, ny, nz, x, y));
      }
    }
  });
  // Where a part passes in front of another, the one behind darkens along
  // the edge: a limb over the body then reads as in front of it.
  const shadeK = tone.slice();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = y * size + x;
    if (tone[k] < 0) continue;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const q = ny * size + nx;
      if (owner[q] > owner[k] && tone[q] >= 0 && parts[owner[q]].k !== 'dots' && parts[owner[q]].k !== 'specks' && parts[owner[q]].k !== 'hair') {
        shadeK[k] = Math.max(0, tone[k] - (base[q] === base[k] ? 1 : 2));
        break;
      }
    }
  }
  // Painted finely, an edge that faces the light and has nothing beyond it
  // catches a thin rim of light, so the silhouette reads against a dark wall.
  if (scale > 1) {
    for (let y = 1; y < size; y++) for (let x = 1; x < size; x++) {
      const k = y * size + x;
      if (tone[k] < 0 || shadeK[k] >= 5) continue;
      const up = owner[k - size] < 0 && col[k - size] == null, left = owner[k - 1] < 0 && col[k - 1] == null;
      if (up || left) shadeK[k] = Math.min(5, shadeK[k] + 1);
    }
  }
  // (what gives its own light, an orb or a burning stone, is not muted with the rest)
  for (let k = 0; k < N; k++) if (tone[k] >= 0) col[k] = ramp(base[k], grim && !parts[owner[k]].glows)[shadeK[k]];
  return { aw: size, ah: size, color: col };
}

export { CREATURES, POSES, PROPS, FLOATING, gridOf, paintParts, ball, limb, sheet, line, dots, specks, hair, both };
