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
/** A part drawn on the 32-unit grid, set on the 64-unit one at twice the size. */
const up2 = p => {
  const d = v => v * 2;
  if (p.k === 'ball') return { ...p, x: d(p.x), y: d(p.y), rx: d(p.rx), ry: d(p.ry) };
  if (p.k === 'limb') return { ...p, x1: d(p.x1), y1: d(p.y1), x2: d(p.x2), y2: d(p.y2), r1: d(p.r1), r2: d(p.r2) };
  if (p.k === 'line' || p.k === 'hair') return { ...p, x1: d(p.x1), y1: d(p.y1), x2: d(p.x2), y2: d(p.y2) };
  // a pixel of the coarse grid is a square of four on the finer one
  if (p.k === 'dots') return { ...p, pts: p.pts.flatMap(([x, y]) => [[d(x), d(y)], [d(x) + 1, d(y)], [d(x), d(y) + 1], [d(x) + 1, d(y) + 1]]) };
  return { ...p, pts: p.pts.map(([x, y]) => [d(x), d(y)]) };
};
// Every creature is drawn lifelike, on the finer grid: a human's proportions,
// cloth falling in folds, armour, hands and faces, scales and fur. So are the
// encounter props that are one of them; the other props keep the 32-unit grid.
const FINE_PROPS = new Set(['hireling', 'stray_healer', 'goblin_toll', 'ogre_sleep', 'cage']);
const gridOf = k => (k in CREATURES || FINE_PROPS.has(k) ? 64 : 32);

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
 * @param {number} [n]  the grid it is cut on
 */
const slats = (p, keep, shift = 0, n = 32) => {
  const inside = (x, y) => {
    if (p.k === 'ball') return ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1;
    if (p.k === 'sheet') return insidePoly(p.pts, x, y);
    const ax = p.x2 - p.x1, ay = p.y2 - p.y1, L2 = ax * ax + ay * ay || 1;
    const t = Math.max(0, Math.min(1, ((x - p.x1) * ax + (y - p.y1) * ay) / L2));
    return Math.hypot(x - p.x1 - ax * t, y - p.y1 - ay * t) <= Math.max(p.r1 + (p.r2 - p.r1) * t, 0.55);
  };
  const out = [];
  for (let r = 0; r < n; r++) {
    if (!keep(r)) continue;
    const y = r + 0.5, dx = typeof shift === 'function' ? shift(r) : r % 2 ? shift : -shift;
    let a = -1;
    for (let c = 0; c <= n; c++) {
      const on = c < n && inside(c + 0.5, y);
      if (on && a < 0) a = c;
      if (!on && a >= 0) { out.push(limb(a + 0.5 + dx, y, c - 0.5 + dx, y, 0.55, 0.55, p.c, { smooth: 1 })); a = -1; }
    }
  }
  return out;
};

// The freed goblin's head, the same in the cage and at your heel, on the
// finer grid: a ragged hood with its peak flopped over, knife ears poking out
// from under it, bright eyes that never stop looking about, and a grin up one
// side. `look` sends the eyes left (-1), right (1) or straight at you (0);
// `mouth` is 'grin', or 'teeth' when it means business.
const scragHead = (x, y, { look = 1, mouth = 'grin' } = {}) => {
  const skin = '#72ac4c', dark = '#46742f', light = '#8cc466', rag = '#80705c', ragDk = '#5a4c3c';
  const px = look * 0.8;
  return [
    // the hood behind the head, close about it, its peak gone limp and
    // fallen over to one side
    sheet([[x - 10.8, y + 6.4], [x - 11.6, y - 2], [x - 10.4, y - 8], [x - 11.2, y - 13.2], [x - 15.2, y - 17.2], [x - 16.8, y - 14.4], [x - 12.8, y - 17.6],
      [x - 6.8, y - 15.2], [x - 2, y - 12.4], [x + 4, y - 12], [x + 8.8, y - 10], [x + 11.6, y - 5.2], [x + 10.8, y + 6.4]], rag, { curve: 1 }),
    hair(x - 13, y - 15, x - 9, y - 11, ragDk), hair(x + 9, y - 8, x + 10.5, y - 2, ragDk), specks([[x - 15.5, y - 15], [x - 7, y - 14]], '#a89a82'),
    // the dark inside of the hood, round the face
    ball(x, y - 0.8, 10.6, 9.8, '#3a302a'),
    // long ears out through the rag, pink inside, the left one nicked, veined
    sheet([[x - 8, y - 2.8], [x - 22.4, y - 7.6], [x - 19.2, y - 3.2], [x - 20.8, y - 2.4], [x - 18, y - 0.8], [x - 8, y + 3.6]], skin, { tilt: [-0.5, -0.2] }),
    sheet([[x + 8, y - 2.8], [x + 22.4, y - 7.6], [x + 18.8, y - 2.4], [x + 8, y + 3.6]], skin, { tilt: [0.5, -0.2] }),
    sheet([[x - 9.2, y - 1.2], [x - 18, y - 5.2], [x - 9.2, y + 2]], '#c07860'), sheet([[x + 9.2, y - 1.2], [x + 18, y - 5.2], [x + 9.2, y + 2]], '#c07860'),
    hair(x - 10, y - 0.5, x - 16, y - 4, '#9a5a48'), hair(x + 10, y - 0.5, x + 16, y - 4, '#9a5a48'),
    // a narrow face, the cheekbones high, a pointed chin
    ball(x, y, 9.2, 8.2, skin), ball(x, y + 5.4, 5.6, 3.6, skin), ball(x - 3, y - 2, 4, 2.6, light),
    // the hood's brim pulled low over the brow
    sheet([[x - 10.6, y - 1.2], [x - 8.4, y - 8], [x - 2, y - 10.2], [x + 4, y - 10], [x + 9, y - 7.6], [x + 10.6, y - 1.2],
      [x + 7.2, y - 4.8], [x, y - 6], [x - 7.2, y - 4.8]], rag, { curve: 1 }),
    hair(x - 7, y - 5.5, x + 7, y - 5.5, ragDk),
    // brows up, one higher than the other: curious, and up to something
    limb(x - 7, y - 3, x - 3, y - 3.8, 0.8, 0.6, dark), limb(x + 2, y - 3.6, x + 6, y - 3.4, 0.8, 0.6, dark),
    // the eyes, yellow and lit, the pupils off to one side, lids heavy over them
    ball(x - 4.6, y - 0.6, 2.4, 1.6, '#ffd84a'), ball(x + 3.8, y - 0.6, 2.4, 1.6, '#ffd84a'),
    ball(x - 4.6 + px, y - 0.4, 1.1, 1.3, '#1a1010'), ball(x + 3.8 + px, y - 0.4, 1.1, 1.3, '#1a1010'),
    specks([[x - 5.5 + px, y - 1.5], [x + 3 + px, y - 1.5]], '#fffbe0'),
    hair(x - 7, y - 2, x - 2.5, y - 2, dark), hair(x + 1.5, y - 2, x + 6, y - 2, dark),
    // a small sharp nose, and the cheek the grin pushes up
    limb(x, y - 0.8, x + 0.6, y + 2.6, 1, 1.6, skin), ball(x + 1, y + 2.8, 1.2, 0.9, light), specks([[x - 0.5, y + 3]], dark),
    ball(x + 5.2, y + 3, 2.6, 1.8, skin), hair(x + 6.5, y + 2, x + 7.5, y + 4.5, dark),
    mouth === 'teeth'
      ? sheet([[x - 5.6, y + 3.6], [x, y + 4.6], [x + 6, y + 2.8], [x + 4.8, y + 6.8], [x, y + 7.8], [x - 4.6, y + 6.6]], '#2a1010')
      : sheet([[x - 4.4, y + 4.6], [x, y + 5.2], [x + 4.8, y + 3.6], [x + 6.6, y + 2], [x + 5.8, y + 5.2], [x + 0.8, y + 6.8], [x - 3.6, y + 6]], '#2a1010'),
    ...(mouth === 'teeth'
      ? [-4, -1.5, 1, 3.5].map(d => limb(x + d, y + 4.4, x + d, y + 5.8, 0.5, 0.2, '#f0e6c8')).concat([-2.5, 0, 2.5].map(d => limb(x + d, y + 7.2, x + d, y + 6, 0.45, 0.2, '#f0e6c8')))
      : [limb(x + 2.2, y + 4.4, x + 2.2, y + 5.6, 0.5, 0.25, '#f0e6c8'), limb(x + 4.2, y + 3.8, x + 4.2, y + 5, 0.45, 0.2, '#f0e6c8')]),
    // warts and a scar, and the chin's stubble
    specks([[x - 6.5, y + 3], [x + 7, y - 0.5], [x - 2, y + 8.5], [x + 1, y + 9]], dark), hair(x - 7, y + 1, x - 5.5, y + 4, '#a8d080'),
  ];
};

// The hound and the wolf that walk with a hero: one body, square on to you,
// told apart by the coat, the ears, the tail and how long in the leg. Standing,
// winding up to bite (head down, forelegs braced, jaws open) or sitting.
const canine = (pose, o) => {
  const { coat, dark, pale, muzzle, nose, eye, eyeLt, grain } = o;
  const bite = pose === 'windup', sit = pose === 'sit';
  const leg = o.leggy ? 1.6 : 0;                 // the wolf stands taller
  const hy = bite ? 31 : sit ? 22 : 26 - leg;    // the head
  const by = sit ? 44 : 41 - leg;                // the body
  /** @type {object[]} */
  const out = [];
  // the tail: up and waving, carried low, or laid round its feet when it sits
  if (sit) out.push(limb(41, 59, 49, 60.5, 2.2, 1.6, dark), limb(49, 60.5, 53, 57.5, 1.6, 1, o.tailTip || coat));
  else if (o.tail === 'low') out.push(limb(40, 38 - leg, 46, 45, 3.2, 3.6, dark), limb(46, 45, 48, 53, 3.6, 2, coat), ball(48.2, 54, 2, 2.2, o.tailTip),
    ...[[42.5, 41], [45, 44.5], [46.5, 48.5], [47.5, 51.5]].map(([x, y]) => hair(x, y, x + 1, y + 2, grain)));
  else out.push(limb(38, 36, 46, 26, 2.4, 1.6, dark), limb(46, 26, 49, 19, 1.6, 1, coat), ...[[41, 33], [44, 29.5], [46.5, 25], [48, 21.5]].map(([x, y]) => hair(x, y, x + 1, y - 2, o.tailTip || pale)));
  // the hind legs, set wide behind, or the haunches when it sits
  if (sit) out.push(...both64(ball(21, 54, 6.4, 5.4, dark)), ...both64(ball(19.2, 60.8, 3.8, 1.8, dark)), ...both64(hair(17, 50, 19, 56, grain)));
  else out.push(...both64(limb(22, 42 - leg, 19, 52, 4, 2.6, dark)), ...both64(ball(19, 52, 2.4, 2.2, dark)), ...both64(limb(19, 52, 20, 60, 2.4, 2, dark)),
    ...both64(ball(20, 61, 3.4, 1.8, dark)));
  // a deep body with a saddle of darker coat over it (upright when it sits)
  out.push(sit ? ball(31.5, by, 11.2, 11.6, coat) : ball(31.5, by, 13.6, 9.2, coat),
    sit ? sheet([[23, 37], [39, 37], [38, 42], [24, 42]], dark, { curve: 1 }) : sheet([[21, 35 - leg], [41, 35 - leg], [39, 40 - leg], [23, 40 - leg]], dark, { curve: 1 }),
    ...[[24, 39], [28, 38], [34, 38], [38, 39], [22, 45], [40, 45]].map(([x, y]) => hair(x, y - leg, x + (x < 31.5 ? -1 : 1), y + 2.5 - leg, grain)));
  // forelegs: braced wide for the spring, straight, or straight up when it sits
  const fx = bite ? 21 : sit ? 25.6 : 24, kx = bite ? 21.6 : sit ? 25.8 : 24.6;
  out.push(...both64(limb(25, by + 2, fx, 53, 3.4, 2.2, coat)), ...both64(limb(fx, 53, kx, 60, 2.2, 2, coat)),
    ...both64(ball(kx, 61, 3.4, 1.8, coat)), ...both64(hair(fx + 1, 54, kx + 1, 59, grain)),
    ...both64(specks([[kx - 2, 62.5], [kx, 62.75], [kx + 2, 62.5]], '#e8dcc8')));
  // a pale chest, and a ruff of thicker fur at the throat for the wolf
  out.push(sheet([[27, by - 7], [36, by - 7], [38, by], [35.5, by + (sit ? 10 : 8)], [31.5, by + (sit ? 11 : 9)], [27.5, by + (sit ? 10 : 8)], [25, by]], pale, { curve: 1 }),
    ...[[28, by - 2], [35, by - 2], [30, by + 3], [33, by + 3], [31.5, by + 7]].map(([x, y]) => hair(x, y, x + (x < 31.5 ? -0.5 : 0.5), y + 2.5, grain)));
  if (o.ruff) out.push(sheet([[23, hy + 6], [39, hy + 6], [37, hy + 11], [34, hy + 10], [31.5, hy + 13], [28, hy + 10], [25, hy + 11]], pale, { curve: 0.8 }),
    ...[25, 28, 31, 34, 37].map(x => hair(x, hy + 7, x + (x - 31.5) * 0.1, hy + 11, '#b0aca2')));
  // the collar with its tag
  if (o.collar) out.push(sheet([[25, hy + 7], [37, hy + 7], [36, hy + 9.4], [26, hy + 9.4]], '#a02828', { curve: 0.6 }), hair(26, hy + 7.5, 36, hy + 7.5, '#d04848'),
    ball(31.5, hy + 11.4, 1.8, 2, '#d8b848'), specks([[30.5, hy + 10.5]], '#fff4c0'));
  // the ears: floppy and hanging, or pricked up and pointed
  if (o.ears === 'flop') out.push(...both64(sheet([[25, hy - 5], [19, hy - 2], [19.5, hy + 8], [24.8, hy + 4]], dark, { curve: 0.8, tilt: [-0.3, 0.2] })), ...both64(hair(21, hy - 1, 20.5, hy + 6, '#3a2412')));
  else out.push(...both64(sheet([[24.4, hy - 3.6], [22.4, hy - 13.6], [28.6, hy - 5.6]], dark, { curve: 0.3 })), ...both64(sheet([[25.2, hy - 4.4], [24, hy - 10.6], [27.2, hy - 5.6]], '#8e7a6e', { curve: 0.3 })),
    ...both64(hair(24, hy - 6, 25, hy - 9, '#c8c0b8')));
  // a broad head, the brow over the eyes, the muzzle long and grey or brown
  out.push(ball(31.5, hy, 7.8, 6.8, coat), ball(29, hy - 3, 4, 2.4, o.brow || coat), ...both64(ball(27.6, hy - 1.4, 2.6, 1.8, '#2a1a10')),
    hair(29, hy - 5, 30, hy - 7.5, pale), hair(33, hy - 5, 32, hy - 7.5, pale));
  if (bite) {
    // the jaws open: a dark mouth, white teeth top and bottom, tongue in it
    out.push(sheet([[26.6, hy + 3], [35.4, hy + 3], [34.4, hy + 11], [27.6, hy + 11]], '#4a1818', { curve: 0.5 }), ball(31.5, hy + 9, 2.6, 1.6, '#b04a50'),
      ball(31.5, hy + 11, 4, 2, muzzle), limb(31.5, hy + 2, 31.5, hy + 4, 4, 3.4, muzzle), ball(31.5, hy + 3.4, 1.8, 1.1, nose),
      ...[27.5, 29.5, 32.5, 34.5].map((x, i) => limb(x, hy + 4.6, x, hy + (i % 3 ? 5.8 : 6.6), 0.5, 0.2, '#f4ecdc')),
      ...[28, 30, 32, 34].map((x, i) => limb(x, hy + 10, x, hy + (i % 3 ? 9 : 8.4), 0.5, 0.2, '#f4ecdc')),
      hair(27, hy - 2.5, 30, hy - 1.75, '#1a1008'), hair(35, hy - 2.5, 32, hy - 1.75, '#1a1008'));
  } else {
    out.push(limb(31.5, hy + 2, 31.5, hy + 7.2, 4.4, 3.2, muzzle), ball(31.5, hy + 7.4, 2.6, 1.7, nose), specks([[30, hy + 6.75]], '#8a8890'),
      hair(31.5, hy + 8.5, 31.5, hy + 9.5, '#2a1a14'), hair(29, hy + 10, 33, hy + 10, '#2a1a14'),
      specks([[27, hy + 5], [26.5, hy + 6], [35, hy + 5], [35.5, hy + 6]], '#e8d0a8'));
  }
  // the eyes, with a catch of light in each
  out.push(...both64(ball(27.6, hy - 1, 1.4, 1.2, eye)), dots([[27, Math.round(hy) - 1], [36, Math.round(hy) - 1]], '#140c08'), dots([[27, Math.round(hy) - 2], [35, Math.round(hy) - 2]], eyeLt));
  return out;
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

  // A cave spider the size of a hound: a bloated, glossy abdomen with the red
  // hourglass on it, a bristled body slung low between eight jointed legs,
  // a cluster of eyes catching the light and fangs that drip.
  spider: () => {
    const shell = '#3e3454', shellLt = '#5e5278', shellDk = '#241e34', leg = '#4a3e64', legDk = '#2e2642', red = '#c02828', fang = '#e8e0d0';
    const legs = [];
    // each leg from its root on the body, up to the knee, down to the foot
    for (const [rx, ry, kx, ky, fx, fy] of [[26, 38, 12, 24, 4, 50], [25.5, 40.5, 9, 32, 3, 58], [26, 43, 12, 42, 9, 62], [27, 45, 19, 50, 18, 63]]) {
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
      limb(29.5, 51, 28.5, 56, 1.1, 0.4, fang), limb(34.5, 51, 35.5, 56, 1.1, 0.4, fang),
      ball(29.6, 50.8, 1.8, 1.4, shellDk), ball(34.4, 50.8, 1.8, 1.4, shellDk),
      specks([[28.5, 57], [35.5, 57.5], [28.75, 58.5]], '#a8d048'),
    ];
  },

  // A giant rat, side on: a long hunched body in coarse brown fur, a pointed
  // whiskered snout, round ears, beady red eyes, pink paws and a long naked
  // tail curling up behind.
  rat: () => {
    const fur = '#8a6a48', furDk = '#5a4430', furLt = '#a8886a', pink = '#d89a90', pinkDk = '#a86a64';
    return [
      // the tail curling up behind
      limb(46, 52, 56, 50, 1.4, 1, pink), limb(56, 50, 60, 42, 1, 0.8, pink), limb(60, 42, 57, 35, 0.8, 0.5, pink),
      ...[[49, 51.5], [53, 51], [57, 48.5], [59.5, 44.5], [59, 39.5]].map(([x, y]) => hair(x - 0.5, y - 0.75, x + 0.5, y + 0.75, pinkDk)),
      // the far legs, behind
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
      sheet([[4, 53], [9, 53], [8, 54.6], [5, 54.6]], '#2a1814'), dots([[6, 54]], '#f2ead2'),
    ];
  },

  // A cave bat as it comes at you, wings spread wide: thin leathery membrane
  // stretched over long finger bones, a furred body, ears like knife-points,
  // a pug face, and a mouthful of needle teeth.
  bat: () => {
    const wing = '#4a3c5c', wingLt = '#6a5a7e', bone = '#2e2440', body = '#5a4c70', bodyDk = '#3a2e4a', fang = '#f2eee0';
    const half = [
      // the wing: membrane scalloped between the finger bones
      sheet([[28, 24], [14, 14], [2, 12], [6, 19], [2, 25], [9, 26], [5, 34], [13, 32], [19, 37], [28, 32]], wing, { tilt: [-0.35, -0.1] }),
      sheet([[28, 25], [16, 17], [10, 22], [18, 28], [28, 30]], wingLt, { tilt: [-0.3, -0.1] }),
      limb(28, 24, 14, 14, 0.8, 0.6, bone), limb(14, 14, 2, 12, 0.6, 0.3, bone), limb(14, 14, 2, 25, 0.5, 0.3, bone),
      limb(14, 14, 5, 34, 0.5, 0.3, bone), limb(14, 14, 19, 37, 0.5, 0.3, bone),
      ball(14, 14, 1, 1, bone), specks([[13, 12.5], [12.5, 13]], '#c8c0d4'),
    ];
    return [
      ...half, ...half.map(m64),
      // the body, furred, and the little hind claws
      ball(32, 28, 5.4, 7.6, body), ...[[30, 24], [33, 26], [31, 30], [34, 31]].map(([x, y]) => hair(x, y, x + 0.75, y + 1.5, bodyDk)),
      ...both64(limb(30, 34, 29, 38, 0.6, 0.4, bone)),
      // the head: tall ears, a pug snout, needle teeth, eyes bright in the dark
      ...both64(sheet([[28.5, 18], [26.5, 8], [31, 16]], body, { tilt: [-0.3, -0.3] })), ...both64(sheet([[28.8, 16.5], [27.6, 10.5], [30.2, 15.4]], '#8a6a8a')),
      ball(32, 19.6, 5, 4.4, '#5a4c70'), ball(32, 21.6, 2.4, 1.6, '#7a6a88'),
      dots([[30, 21], [34, 21]], '#1a1018'),
      ball(29.4, 18.6, 1.1, 1, '#ff5040', { glows: true }), ball(34.6, 18.6, 1.1, 1, '#ff5040', { glows: true }),
      sheet([[29.6, 23], [34.4, 23], [33.6, 25], [30.4, 25]], '#2a1018'),
      sheet([[30.2, 23], [31, 23], [30.6, 24.8]], fang), sheet([[33, 23], [33.8, 23], [33.4, 24.8]], fang),
    ];
  },

  // A green slime: a wobbling mound of ooze, glossy and half-clear, a brighter
  // core inside it, bones and a coin caught in it, bubbles rising, a face of
  // sorts pressed against its skin, and a trail where it has crept.
  slime: () => {
    const ooze = '#5aa048', oozeDk = '#3a7030', oozeLt = '#8ad070', core = '#b8f08a', bone = '#d8d0b8';
    return [
      // the trail behind it, and the mound
      ball(32, 61.6, 22, 2, oozeDk),
      sheet([[10, 62], [12, 52], [17, 42], [24, 35], [32, 32], [40, 35], [47, 42], [52, 52], [54, 62]], ooze, { curve: 1 }),
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
      ...[[13, 55], [51, 54], [17, 47]].map(([x, y]) => limb(x, y, x + (x < 32 ? -0.5 : 0.5), y + 4, 1, 0.6, ooze)),
    ];
  },

  // One of the drowned, risen from the black water: sunk to the shins in it,
  // swollen and grey-blue, what is left of a shirt clinging to it, both arms
  // out and reaching, hair plastered down a bloated face, the eyes gone to
  // dark hollows and the jaw hanging slack, weed hanging off it everywhere.
  drowned: () => {
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
      limb(20, 29, 13, 23, 3.2, 2.8, skin), limb(13, 23, 8, 18, 2.8, 2.4, skin), ball(7, 17, 3, 2.6, skin),
      ...[[4, 13.5], [6, 12.5], [8.5, 13], [10.5, 14.5]].map(([x, y]) => limb(x + 1.5, y + 3, x, y, 0.7, 0.6, skinLt)),
      limb(44, 29, 51, 23, 3.2, 2.8, skin), limb(51, 23, 56, 18, 2.8, 2.4, skin), ball(57, 17, 3, 2.6, skin),
      ...[[60, 13.5], [58, 12.5], [55.5, 13], [53.5, 14.5]].map(([x, y]) => limb(x - 1.5, y + 3, x, y, 0.7, 0.6, skinLt)),
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
      ball(32, 24, 3, 2.6, '#1a1418'), dots([[31, 22], [33, 22]], '#c8c4a8'),
      // weed draped over the shoulders and trailing from the arms
      limb(20, 27, 21, 40, 1.4, 0.8, weed), limb(21, 40, 19.5, 45, 0.8, 0.5, weed), limb(44, 26, 47, 36, 1.2, 0.7, weed),
      limb(10, 20, 9, 28, 1, 0.5, weed), limb(54, 20, 55.5, 26, 0.9, 0.5, weed), limb(33, 8, 31, 4, 0.8, 0.5, weedLt),
      ...[[20.5, 31], [21, 36], [45, 30], [9.5, 24]].map(([x, y]) => hair(x, y, x + 1.5, y + 1, weedLt)),
      // water running off it, the grain of the drowned skin
      specks([[7, 21], [8, 24], [57, 21], [56, 24.5], [24, 48], [40, 49], [32, 50], [6, 15]], '#b8d0dc'),
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
  eyeless: () => {
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
      sheet([[23, 11], [6, 1], [13, 9], [10, 12], [19, 17]], skinDk, { tilt: [-0.5, -0.3] }), sheet([[41, 11], [58, 1], [51, 9], [54, 12], [45, 17]], skinDk, { tilt: [0.5, -0.3] }),
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
      specks([[32, 6], [28, 7], [36, 7], [30, 15], [34, 15]], '#ece6ee'),
    ];
  },

  // A puffcap: a squat fungus on rooted feet, its cap swollen fit to burst
  // with spores, pale scabs on the dome, the gills beneath dark and frilled,
  // two small black eyes low on the bowed stalk, and spores leaking off the rim.
  puffcap: () => {
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
      ball(32, 31, 23, 5, gill), ...[10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54].map(x => hair(x, 29.5, x + (x - 32) * 0.08, 33.5 - Math.abs(x - 32) * 0.08, '#3e2618')),
      // the cap, wide and swollen, its rim curling under
      ball(32, 24, 24.5, 13, cap), ball(27, 19, 14, 7, capHi), ball(32, 32, 22, 2.4, capDk),
      // pale scabs on the dome, some flaking
      ...[[20, 21, 3, 2.2], [34, 15.5, 3.4, 2.4], [45, 22, 2.6, 2], [28, 27, 2, 1.6], [39, 28, 1.8, 1.3], [14, 27, 1.6, 1.2], [26, 13, 1.8, 1.3]].map(([x, y, rx, ry]) => ball(x, y, rx, ry, '#efe4c4')),
      specks([[19, 20], [33, 14.5], [44, 21]], '#fffae8'),
      // the eyes low on the stalk, and a slit of a mouth
      ball(27, 44, 1.8, 2, '#140e0a'), ball(37, 44, 1.8, 2, '#140e0a'), dots([[26, 43], [36, 43]], '#fff4d8'),
      sheet([[29, 51], [35, 51], [34, 52.4], [30, 52.4]], '#5a4a30'),
      // the spores leaking out of the rim
      specks([[8, 27], [6, 22], [56, 26], [59, 21], [12, 17], [53, 15], [32, 7], [22, 9], [42, 8], [4, 31], [60, 30], [16, 11], [48, 10]], '#e0dcb0'),
      specks([[10, 33], [55, 34], [7, 36]], '#c8c49a'),
    ];
  },

  // A goblin archer: a goblin in a hooded leather jerkin, a quiver of crude
  // arrows over one shoulder, the bow held out to one side with the string
  // drawn back to its cheek, squinting down the shaft.
  archer: () => {
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
      limb(9, 12, 6, 22, 0.9, 0.8, wood), limb(6, 22, 6, 34, 0.8, 0.8, wood), limb(6, 34, 9, 44, 0.8, 0.9, wood),
      ball(6, 28, 1.3, 1.6, '#5a3a20'),
      hair(9, 12, 26, 26, string), hair(26, 26, 9, 44, string),
      limb(26, 26, 2.5, 26, 0.45, 0.45, '#b89a60'), sheet([[0.5, 26], [3.5, 24.6], [3.5, 27.4]], '#c8ccd4'),
      sheet([[23.5, 24.6], [27.5, 24], [27.5, 28], [23.5, 27.4]], '#a84030'),
      // the arms: the bow arm straight out, the drawing hand back at the cheek
      limb(24, 30, 15, 28.4, 2, 1.7, skin), limb(15, 28.4, 7.5, 28, 1.7, 1.5, skin), ball(7, 28, 1.9, 1.8, skin),
      limb(40, 30, 33, 30, 2, 1.7, skin), limb(33, 30, 27.5, 26.4, 1.7, 1.5, skin), ball(26.6, 26, 1.9, 1.8, skin),
      // the head in its hood, the ears out through slits in it
      limb(32, 24, 32, 28.5, 2, 2.3, skinDk),
      sheet([[25.5, 17], [8, 11], [11, 15], [25.5, 21.5]], skin, { tilt: [-0.5, -0.2] }), sheet([[38.5, 17], [56, 11], [53, 15], [38.5, 21.5]], skin, { tilt: [0.5, -0.2] }),
      sheet([[24, 17.5], [13, 13.5], [24, 20]], '#b06e56'), sheet([[40, 17.5], [51, 13.5], [40, 20]], '#b06e56'),
      ball(32, 18, 7, 6.6, skin), ball(32, 22.4, 5, 2.6, skin),
      sheet([[23.5, 19], [24.5, 10], [32, 7], [39.5, 10], [40.5, 19], [37.5, 14.5], [32, 13], [26.5, 14.5]], hood, { curve: 0.8 }),
      hair(25, 12, 31, 8, '#7a6444'), sheet([[23.5, 19], [26.5, 14.5], [26, 21], [24, 22]], hoodDk, { curve: 0.4 }),
      // one eye screwed shut, the other narrowed down the shaft
      hair(27.5, 17.5, 30, 17.25, '#1a1010'), ball(35.4, 17.6, 1.6, 1.1, '#2a4a1c'), dots([[35, 17], [36, 17]], '#ffe040'), dots([[35, 17]], '#1a1010'),
      limb(32, 17, 32.6, 22, 0.9, 1.4, skin), ball(33, 22.2, 1.5, 1.1, skinLt),
      sheet([[28, 23.6], [32, 24.6], [36, 23.6], [35, 25.6], [29, 25.6]], '#2a1010'), dots([[30, 24], [34, 24]], '#e8dcb8'),
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

  // A shade: what is left of a hero who fell down here before. Helm, mail and
  // sword still keep their shape, a torn surcoat over the mail, and nothing
  // below the belt but mist trailing away; pale where the wraith is dark, and
  // it stands straight, because it remembers being a person.
  shade: () => {
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
      limb(20.5, 25, 16, 36, 2.6, 2.2, mail), ball(15.6, 37.4, 2.2, 2, steel),
      sheet([[6, 30], [17, 30], [17, 40], [11.5, 47], [6, 40]], '#3a4a64', { curve: 0.9 }), hair(7, 31, 16, 31, '#8aa4bc'),
      sheet([[10.5, 33], [12.5, 33], [12.5, 44], [10.5, 44]], '#8a9ab8'),
      limb(43.5, 25, 48.5, 33, 2.6, 2.2, mail), ball(49.2, 34.4, 2.2, 2, steel),
      limb(50.5, 33, 56, 6, 1.1, 0.6, '#d8f0ff', { smooth: 1 }), hair(51, 32, 56, 7, steelLt),
      limb(46, 34.4, 53, 32.4, 0.8, 0.8, steel),
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
  ogre: () => {
    const skin = '#b08a5a', skinDk = '#7a5a36', skinLt = '#caa676', cloth = '#5a4a30', clothDk = '#3e3220', club = '#6a4a2a', rope = '#a88a5a';
    return [
      // the club over its right shoulder, knotted and studded with nails
      limb(48, 44, 56, 6, 2.4, 4.6, club), hair(49.5, 40, 56.5, 8, '#4a3018'),
      specks([[57.5, 7], [54, 12.5], [58, 15], [53, 20]], '#cfc6b0'),
      // legs like stumps, rope bound about the shins, broad bare feet
      ...both64(limb(24, 46, 23, 59, 5.4, 5, skinDk)), ...both64(ball(22, 61.2, 5.8, 2.2, '#5a3e24')),
      ...both64(hair(18.5, 52, 28, 53.5, rope)), ...both64(hair(18.5, 55, 28, 56.5, rope)),
      // the belly, the stretched skin and navel, the loincloth beneath it
      ball(32, 38, 17, 15, skin), ball(33, 42, 11, 9, skinLt),
      hair(32.5, 42.5, 33.5, 44, '#7a5a36'), hair(26, 38, 29, 41, '#c8a676'), hair(40, 38, 37, 41, '#c8a676'),
      sheet([[16, 46], [48, 46], [46, 56], [38, 53], [32, 58], [26, 53], [18, 56]], cloth, { curve: 1 }),
      sheet([[16, 46], [22, 46], [21, 55], [18, 56]], clothDk, { curve: 0.3 }), line(16, 46.5, 48, 46.5, '#2a2014'),
      // arms like logs, the left fist hanging, the right up on the club
      limb(16, 26, 10, 40, 5.4, 4.8, skin), limb(10, 40, 9, 47, 4.6, 4.2, skin), ball(9, 49, 4.6, 4.2, skin),
      hair(6, 48, 12, 48, skinDk), hair(13, 30, 10, 37, skinDk),
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
      sheet([[26, 21], [38, 21], [37, 23], [27, 23]], '#2a1410'),
      sheet([[27, 22.6], [28.6, 22.6], [27.8, 18.4]], '#f0ead6'), sheet([[37, 22.6], [35.4, 22.6], [36.2, 18.4]], '#f0ead6'),
      ball(23.6, 16, 1.6, 2.4, skin), ball(40.4, 16, 1.6, 2.4, skin),
      // warts, scars, a few bristles on the scalp
      specks([[24, 34], [40, 30], [19, 42], [45, 44], [36, 25]], '#9a7648'), hair(27, 8.5, 26, 6.5, '#3a2a1a'), hair(37, 8.5, 38, 6.5, '#3a2a1a'),
    ];
  },

  // A troll: tall, gaunt and bent, the skin a mottled green like wet stone,
  // arms long enough to drag its knuckles, a great hooked nose and moss for
  // hair; a ragged hide about its hips and yellow eyes under a jutting brow.
  troll: () => {
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
      limb(23, 21, 14, 34, 2.6, 2.2, skin), ball(14, 34, 2.4, 2.2, skinDk), limb(14, 34, 10, 52, 2.2, 2, skin),
      ball(9.6, 54.6, 3.2, 3, skinDk), ...[[7, 56.5, 5.5, 60.6], [9.5, 57.4, 9, 61.6], [12, 57, 12.8, 61]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw)),
      limb(41, 21, 50, 34, 2.6, 2.2, skin), ball(50, 34, 2.4, 2.2, skinDk), limb(50, 34, 54, 52, 2.2, 2, skin),
      ball(54.4, 54.6, 3.2, 3, skinDk), ...[[57, 56.5, 58.5, 60.6], [54.5, 57.4, 55, 61.6], [52, 57, 51.2, 61]].map(([a, b, c, d]) => limb(a, b, c, d, 0.6, 0.3, claw)),
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
      sheet([[26.5, 20.4], [31, 21.8], [37.5, 20.4], [36, 22.8], [28, 22.8]], '#1e2a14'),
      dots([[28, 21], [36, 21], [30, 22]], '#f0ead6'),
      // warts and moss on the hide
      specks([[25, 27], [39, 24], [30, 35], [36, 33], [18, 40], [46, 40]], '#3e7a44'), specks([[26, 26], [38, 31]], '#8ab46a'),
    ];
  },

  // A minotaur: a bull above the shoulders and a man below, broad and
  // shaggy-chested, great horns swept out and up, a ring through the nose,
  // a kilt of red cloth belted in bronze, hooves for feet, and a double axe
  // held across its body.
  minotaur: () => {
    const hide = '#7a5436', hideDk = '#4e3320', hideLt = '#9a7050', horn = '#efe6cc', hornDk = '#b8a888', kilt = '#6a2a20', kiltDk = '#481a14', bronze = '#c9a24a', steel = '#9aa2ae', steelLt = '#e0e6ee';
    return [
      // the double axe across the body, haft from low left to high right
      limb(10, 54, 57, 6, 1.2, 1.2, '#5a3a20'),
      sheet([[51, 2], [61, 0], [63, 12], [56, 13]], steel, { tilt: [0.5, -0.2] }), sheet([[56, 13], [63, 12], [62, 22], [54, 19]], '#8a929e', { tilt: [0.5, 0.2] }),
      line(62, 1, 63, 11.5, steelLt), line(62.6, 13, 61.6, 21.5, steelLt), ball(57, 6, 1.6, 1.6, '#5a5e68'),
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
      limb(19, 24, 15, 36, 4.4, 3.8, hide), limb(15, 36, 18, 45, 3.6, 3.2, hide), ball(18.6, 46, 3.4, 3, hide),
      limb(45, 24, 47, 30, 4.4, 3.8, hide), limb(47, 30, 44, 21, 3.6, 3.2, hide), ball(44, 20, 3.4, 3, hide),
      line(15, 41, 21, 41, bronze), line(42, 24, 48, 24, bronze),
      // the bull's neck, a hump of muscle, and the head
      ball(32, 20, 11, 6, hide), ...both64(ball(21, 23, 6, 4.4, hide)),
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
      dots([[27, 13], [37, 13]], '#ff4030'), specks([[27.5, 13.5], [37.5, 13.5]], '#ffb0a0'),
      // scars across the chest, a notch in one horn
      hair(35, 26, 40, 31, '#3a2414'), specks([[12, 3], [12.5, 2.5]], '#23202c'),
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

  // One of the Lampfolk, who trade in the dark: short and grey, broad ears
  // that droop, great pale eyes for seeing by a little light; a long patched
  // robe, a pack piled high with a blanket roll and a pan swinging off it,
  // the lamp on its staff held out, and a coin held up between long fingers.
  merchant: () => {
    const skin = '#98a0ae', skinDk = '#6c7482', skinLt = '#b4bcc8', robe = '#6a5a48', robeDk = '#4a3e30', patch = '#7c6a3e', pack = '#5e4a36', packDk = '#40321e', wood = '#6a5238';
    return [
      // the pack behind: a rolled blanket on top, a pan and a cup hung off it
      ball(32, 22, 18, 19, pack), ball(26, 16, 8, 8, '#6e583e'), hair(18, 26, 46, 26, packDk), hair(17, 14, 47, 14, packDk),
      limb(18, 5, 46, 5, 4.6, 4.6, '#8a4a3a'), ...[22, 28, 34, 40].map(x => hair(x, 1.5, x + 0.5, 8.5, '#6a3428')),
      limb(47, 20, 51, 22, 0.5, 0.5, '#4a4a50'), ball(52, 27, 4.4, 4, '#6a6e76'), ball(51, 26, 2, 1.6, '#8a8e96'),
      ball(12, 24, 2.4, 2.4, '#7a7e86'), line(13, 19, 12.5, 21.5, '#4a4a50'),
      // short legs under the robe, and bare grey feet
      ...both64(limb(28, 50, 27, 59, 2.8, 2.4, skinDk)), ...both64(ball(25.6, 61, 4.4, 2, skin)),
      ...both64(specks([[22, 61.5], [23.5, 62], [25, 62]], '#d4d8e0')),
      // the long robe, patched and frayed at the hem
      sheet([[21, 34], [43, 34], [47, 59], [41, 57.5], [36, 59.5], [32, 58], [28, 59.5], [23, 57.5], [17, 59]], robe, { curve: 1 }),
      sheet([[21, 34], [25, 34], [22, 58.5], [17, 59]], robeDk, { curve: 0.4 }),
      sheet([[33, 42], [42, 42], [43.5, 53], [34, 53]], patch, { curve: 0.6 }), ...[[33.5, 42.5], [42.5, 43], [43.5, 52.5], [34, 52.5]].map(([x, y]) => specks([[x, y]], '#c8b890')),
      line(21, 36, 43, 36, '#4a3e30'), limb(30, 37, 29, 42, 0.5, 0.4, '#8a7050'), ball(29, 43, 1.2, 1.2, '#c9a24a'),
      ...[[27, 46], [38, 39], [30, 54], [40, 56]].map(([x, y]) => hair(x, y, x + 0.5, y + 3, robeDk)),
      // the staff and its lamp, held out on the left, the light warm on the glass
      line(11, 10, 11, 62, wood), limb(11, 10, 17, 10, 0.7, 0.7, wood), line(17, 10, 17, 13, '#4a4040'),
      ball(17, 18, 4, 4.8, '#3a3634'), ball(17, 18, 3, 3.8, '#ffd060', { glows: true }), ball(16.6, 17, 1.6, 1.8, '#fff6d0', { glows: true }),
      line(14, 14, 20, 14, '#2a2624'), line(14, 22.5, 20, 22.5, '#2a2624'),
      limb(21, 36, 14, 42, 2.6, 2.2, robe), ball(12.6, 43, 2.6, 2.4, skin), ...[[10, 41.5], [10, 43.5]].map(([x, y]) => limb(11.5, y, x, y + 0.5, 0.6, 0.5, skin)),
      // the other hand held up, the coin between long fingers
      limb(43, 36, 48, 42, 2.6, 2.2, robe), ball(49, 42, 2.4, 2.2, skin),
      limb(49, 40.5, 50.5, 37, 0.6, 0.5, skin), limb(50, 41, 52, 38, 0.6, 0.5, skin),
      ball(51.4, 36, 1.8, 1.8, '#e8c050', { glows: true }), specks([[51, 35.5]], '#fff4c0'),
      // broad ears that droop, a round head, and the great pale eyes
      sheet([[23, 24], [8, 28], [6, 32], [10, 33.5], [23, 30]], skin, { tilt: [-0.5, 0.2] }), sheet([[41, 24], [56, 28], [58, 32], [54, 33.5], [41, 30]], skin, { tilt: [0.5, 0.2] }),
      sheet([[22, 26], [11, 29.5], [22, 29]], '#a87e86'), sheet([[42, 26], [53, 29.5], [42, 29]], '#a87e86'),
      ball(32, 27, 11, 10, skin), ball(29, 23, 6, 4, skinLt),
      hair(25, 22, 29.5, 22.5, skinDk), hair(39, 22, 34.5, 22.5, skinDk),
      ...both64(ball(27.4, 26.4, 3.8, 3.8, '#f4e6a8')), ...both64(ball(27.8, 26.6, 2, 2.2, '#3a3020')),
      dots([[28, 27], [36, 27]], '#0e0c10'), dots([[27, 25], [35, 25]], '#ffffff'),
      limb(32, 27, 32, 31, 0.9, 1.4, skin), ball(32, 31.4, 1.4, 1, skinDk),
      sheet([[28.5, 33.5], [35.5, 33.5], [34.5, 34.8], [29.5, 34.8]], '#4a4250'),
      // the grey skin's creases, a scrap of beard, wrinkles at the eyes
      hair(23, 29, 25, 31, skinDk), hair(41, 29, 39, 31, skinDk), hair(22.5, 27, 23.5, 28.5, skinDk), hair(41.5, 27, 40.5, 28.5, skinDk),
      ...[30, 32, 34].map(x => hair(x, 35.5, x + 0.25, 37.5, '#c8ccd4')),
      specks([[26, 20], [37, 19.5], [31, 18.5]], skinDk),
    ];
  },

  // A goblin who would rather sell you a blade than stick you with one: no
  // weapon in its hands, a floppy cap, and a heap of other people's things on
  // its back, pots and a pan and a sword hilt and a string of trinkets; one
  // hand holds charms out to you and the other beckons, grinning.
  pedlar: () => {
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', tunic = '#8a6a3a', tunicDk = '#5a4224', heap = '#6e5236', heapDk = '#4a3620', cap = '#a03a30', capDk = '#702620';
    return [
      // the heap on its back: a sack, a pot, a pan, a hilt standing out of it, a lantern
      ball(32, 26, 19, 15, heap), ball(26, 21, 9, 6, '#7e6244'), hair(16, 30, 48, 30, heapDk), hair(22, 16, 30, 26, heapDk),
      ball(16, 18, 5.6, 4.8, '#7a7e86'), ball(15, 16.6, 3, 1.6, '#9a9ea6'), ball(16, 14, 4, 1, '#5a5e66'),
      ball(49, 17, 5.2, 4.4, '#9a6a3a'), ball(49, 15, 3.6, 1.2, '#4a2e18'), limb(53, 19, 58, 23, 0.6, 0.6, '#7a4a20'),
      line(42, 4, 46, 16, '#b8bcc4', { lit: 1 }), hair(42.5, 5, 45.5, 15, '#f0f2f6'), limb(39, 9, 45.5, 7, 0.8, 0.8, '#c9a24a'), ball(41.6, 3.4, 1.2, 1.2, '#c9a24a'),
      limb(20, 10, 26, 12, 0.8, 0.8, '#5a3a20'), ball(19, 9.5, 1.6, 2, '#8a8070'), specks([[19, 9]], '#ffe0a0'),
      ...[[22, 34], [26, 35.5], [30, 36], [34, 36], [38, 35.5], [42, 34]].map(([x, y], i) => ball(x, y, 0.9, 0.9, ['#e8c050', '#60c0e0', '#e05040'][i % 3])),
      // bandy legs, long bare feet
      ...both64(limb(28, 46, 26, 53, 2.2, 1.9, skin)), ...both64(ball(26, 53, 2, 1.8, skinDk)), ...both64(limb(26, 53, 26.5, 60, 1.9, 1.6, skin)),
      ...both64(limb(26.5, 61, 21.5, 62, 1.7, 1.3, skinDk)), ...both64(specks([[20, 62.5], [21.5, 62.75]], '#d8cfb0')),
      // the pot-belly in a stained tunic, a belt with a fat purse on it
      ball(32, 40, 8.4, 8.6, skin),
      sheet([[23, 35], [41, 35], [43, 48], [40, 46.5], [36, 49], [32, 47], [28, 49], [24, 46.5], [21, 48]], tunic, { curve: 1 }),
      sheet([[23, 35], [27, 35], [25, 47.5], [21, 48]], tunicDk, { curve: 0.4 }),
      line(22.5, 42, 41.5, 42, '#4a2e18'), ball(36, 44.4, 2.6, 2.2, '#8a5a30'), specks([[35.5, 43.5]], '#e8c050'),
      ...[[28, 38], [37, 39], [30, 46]].map(([x, y]) => specks([[x, y], [x + 0.5, y + 0.5]], '#c8a878')),
      // one hand holds out a string of charms, the other beckons
      limb(23, 36, 16, 42, 2, 1.7, skin), limb(16, 42, 13, 45, 1.7, 1.5, skin), ball(12.6, 46, 2.2, 2, skin),
      line(12, 48, 12, 57, '#8a7050'), ball(12, 50, 1, 1, '#e8c050'), ball(12, 53, 1.1, 1.1, '#60c0e0', { glows: true }), ball(12, 56, 1, 1, '#c8c8d0'), ball(12, 58, 1.4, 1.6, '#e05040'),
      limb(41, 36, 47, 33, 2, 1.7, skin), limb(47, 33, 50, 27, 1.7, 1.5, skin), ball(50.4, 26, 2.2, 2, skin),
      limb(50, 24, 48.5, 22.5, 0.6, 0.5, skin), limb(51.5, 24.5, 50.5, 22, 0.6, 0.5, skin),
      // the great ears swept out, a narrow head, the floppy cap
      sheet([[25, 22], [5, 15], [8, 20], [6, 22], [11, 24], [25, 27]], skin, { tilt: [-0.5, -0.2] }), sheet([[39, 22], [59, 15], [56, 20], [58, 22], [53, 24], [39, 27]], skin, { tilt: [0.5, -0.2] }),
      sheet([[23.5, 22.5], [11, 18], [23.5, 25.5]], '#b06e56'), sheet([[40.5, 22.5], [53, 18], [40.5, 25.5]], '#b06e56'),
      limb(32, 30, 32, 34, 2, 2.3, skinDk),
      ball(32, 23, 7.4, 7, skin), ball(32, 27.6, 5.4, 2.8, skin),
      sheet([[23.5, 20], [26, 12], [32, 9.5], [39, 11], [44, 14], [46, 20], [42, 17], [39.5, 19.5]], cap, { curve: 0.8 }),
      sheet([[39, 11], [44, 14], [46, 20], [42, 17]], capDk, { curve: 0.6 }), ball(46, 21, 1.8, 1.8, '#e8d8b0'),
      line(24, 19.5, 40, 19.5, capDk),
      // an open, hopeful look, raised brows, a nose, and a grin that wants your coin
      limb(26, 19.8, 30, 20.8, 1, 0.8, skinDk), limb(38, 19.8, 34, 20.8, 1, 0.8, skinDk),
      ...both64(ball(28.4, 23, 2.2, 1.8, '#f0e8c0')), dots([[28, 23], [36, 23]], '#1a1010'), specks([[28.5, 22.5], [36.5, 22.5]], '#ffffff'),
      limb(32, 22, 32.6, 27, 1, 1.6, skin), ball(33, 27.4, 1.6, 1.2, skinLt),
      sheet([[25.5, 28.4], [32, 30.6], [38.5, 28.4], [36.5, 31.8], [32, 32.8], [27.5, 31.8]], '#2a1010'),
      dots([[28, 29], [30, 30], [34, 30], [36, 29]], '#f0e6c8'), ball(32, 32, 1.8, 0.6, '#6a2424'),
      specks([[27, 17], [37, 17.5], [30.5, 25.5]], skinDk),
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
  dog: (pose = 'idle') => canine(pose, {
    coat: '#8a5a32', dark: '#5e3a1e', pale: '#c8a070', muzzle: '#a8784a', nose: '#1a1210', eye: '#3a2410', eyeLt: '#f0d8a0', grain: '#6e4424',
    brow: '#9a6a3e', ears: 'flop', collar: true,
  }),

  // The druid's wolf: grey and lean where the hound is brown and scruffy, its
  // ears pricked, its eyes amber, a ruff at its throat and no collar on it, and
  // its tail carried low. It comes to a druid in the delves that have no hound.
  wolf: (pose = 'idle') => canine(pose, {
    coat: '#7c7e86', dark: '#4c4e58', pale: '#d4d2c8', muzzle: '#a2a2a6', nose: '#141216', eye: '#c07818', eyeLt: '#f0b030', grain: '#34363e',
    brow: '#8a8c94', ears: 'prick', ruff: true, tail: 'low', tailTip: '#d4d2c8', leggy: true,
  }),

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
  // (drawn first on the coarse grid and set on the finer one, its head drawn again there)
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
      ...parts.map(up2),
      ...scragHead(hx * 2, hy * 2, { look: stab ? 0 : sit ? -1 : 1, mouth: stab ? 'teeth' : 'grin' }),
      // fine work: ribs, frayed threads at the hem, a darn in the rag, toes
      ...[
      hair(14.5, 21.6 + dy, 14, 22.6 + dy, '#4c7e34'), hair(17.5, 21.6 + dy, 18, 22.6 + dy, '#4c7e34'),
      hair(11.8, 22.4 + dy, 11.6, 23.4 + dy, rag), hair(18, 22.6 + dy, 18.2, 23.6 + dy, rag),
      specks([[13, 19.5 + dy], [13.5, 20 + dy], [14, 19.5 + dy], [14.5, 20 + dy]], '#a89a82'),
      ...(stab ? [] : both(specks([[sit ? 12 : 11, 30.5], [sit ? 13 : 12, 30.5]], '#e8e0c0'))),
      ].map(up2),
      // knuckles and the grime in them, more frays, the wear on the chain
      hair(25, 41 + 2 * dy, 24, 45 + 2 * dy, '#5a4c3c'), hair(38, 41 + 2 * dy, 39.5, 45 + 2 * dy, '#5a4c3c'), hair(31, 40 + 2 * dy, 31.5, 44 + 2 * dy, '#5a4c3c'),
      specks([[27, 38 + 2 * dy], [36, 38.5 + 2 * dy], [21, 43 + 2 * dy], [43, 43 + 2 * dy]], '#a89a82'),
      hair(29, 47.5 + 2 * dy, 35, 47.5 + 2 * dy, '#3a2a1a'),
    ];
  },

  // A long grey hound of the deep, all rib and sinew on legs too long for it,
  // with pale eyes that stay lit in the dark. It steps out of the world and
  // back in somewhere else, and its edges never quite settle. Going, it thins
  // to slats of itself and only the eyes stay whole; about to bite, its
  // hackles stand and its head drops, jaws open.
  hound: (pose = 'idle') => {
    const coat = '#767a86', dark = '#4c505c', pale = '#94989f', muzzle = '#8c909a', nose = '#16161e', sinew = '#5e626e', socket = '#24262e', eyeC = '#c8ecff';
    const fade = pose === 'special', bite = pose === 'windup';
    const hy = bite ? 30 : 23;    // the head
    const sh = bite ? 2 : 0;      // the shoulders, hunched for the spring
    /** @type {any[]} its own parts are read back below, to cut into slats */
    const out = [
      // the tail, a thin whip up behind it
      limb(40, 30, 48, 22, 1.8, 1.2, dark), limb(48, 22, 51, 12, 1.2, 0.8, dark), hair(44, 27, 49, 19, sinew),
      // the hind legs, well back behind the ribs: a high hock, a thin shank, long toes
      ...both64(limb(21, 35, 16.6, 48, 3.6, 1.8, dark)), ...both64(ball(16.6, 48, 1.8, 1.7, dark)), ...both64(limb(16.6, 48, 18, 60, 1.8, 1.3, dark)),
      ...both64(ball(17.6, 61, 2.8, 1.4, dark)), ...both64(hair(19.5, 38, 17.5, 46, sinew)),
      // the barrel of the ribs, and the shoulder blades standing up out of it
      ball(31.5, 33 + sh, 12.8, 8.4, coat), ball(31.5, 40 + sh, 9, 3.2, dark),
      ...both64(ball(22.4, 28 + sh, 4.6, 4, '#686c78')),
      ...[29.5, 32.5, 35.5].flatMap(y => both64(hair(21, y + sh, 26.5, y + 1.25 + sh, dark))),
      hair(31.5, 25 + sh, 31.5, 29 + sh, sinew),
    ];
    if (bite) {
      // hackles up along the neck and shoulders, a ragged ruff behind the head
      for (const a of [-170, -150, -130, -110, -90, -70, -50, -30, -10]) {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), h = 5.2 + (a % 20 ? 2 : 0);
        const bx = 31.5 + dx * 12, by = 29 + dy * 6.4;
        out.push(sheet([[bx - dy * 2.2, by + dx * 2.2], [bx + dx * h, by + dy * h], [bx + dy * 2.2, by - dx * 2.2]], dark, { tilt: [dx * 0.5, dy * 0.5] }),
          hair(bx, by, bx + dx * h * 0.7, by + dy * h * 0.7, '#3a3e48'));
      }
      // forelegs braced wide and bent, for the spring
      out.push(...both64(limb(24, 37, 20, 49, 3.2, 1.8, coat)), ...both64(ball(20, 49, 1.8, 1.7, coat)), ...both64(limb(20, 49, 21.6, 60, 1.8, 1.5, coat)),
        ...both64(ball(21.2, 61, 3.2, 1.5, coat)));
    } else {
      out.push(...both64(limb(24.4, 35, 23.8, 50, 3, 1.6, coat)), ...both64(ball(23.8, 50, 1.7, 1.6, coat)), ...both64(limb(23.8, 50, 24.6, 60, 1.6, 1.4, coat)),
        ...both64(ball(24.4, 61, 3, 1.5, coat)));
    }
    out.push(
      // the sinews down the forelegs, and the long claws
      ...both64(hair(bite ? 22 : 24.5, 40, bite ? 20.5 : 24, 48, sinew)),
      ...both64(specks(bite ? [[18.5, 62.5], [20.5, 62.75], [22.5, 62.75], [24, 62.5]] : [[22, 62.5], [24, 62.75], [26, 62.5]], '#d8d4c8')),
      // a narrow keel of a chest under the head
      ball(31.5, 38.4, 4.8, 6.4, pale), hair(31.5, 34, 31.5, 43, '#a8acb4'),
      // tall ears, pricked, or laid back flat for the bite
      ...both64(sheet(bite ? [[26, hy - 3], [17, hy - 9], [28.4, hy - 6]] : [[26, hy - 3], [22.6, hy - 17], [29.6, hy - 6]], coat, { tilt: [-0.4, -0.3] })),
      ...both64(sheet(bite ? [[26, hy - 4], [20, hy - 8], [27.6, hy - 6]] : [[26.4, hy - 4.4], [24, hy - 14], [28.6, hy - 6.4]], '#3a2e3e', { tilt: [-0.2, -0.2] })),
      ...both64(hair(bite ? 22 : 24.5, bite ? hy - 6.5 : hy - 11, bite ? 25 : 26, bite ? hy - 5 : hy - 6, '#9a8a9e')),
      // a wedge of a head: broad at the skull, down to a long muzzle
      ball(31.5, hy, 7.6, 6, coat), ...both64(ball(26.8, hy + 3.6, 3.4, 3, coat)), ball(31.5, hy - 3.6, 4.4, 1.8, '#848894'),
      // a heavy brow over deep sockets
      ...both64(ball(27.8, hy - 0.8, 3, 2.2, socket)), ...both64(limb(24, hy - 3.4, 29.6, hy - 2, 1.2, 0.8, dark)),
    );
    // the eyes stay whole when the rest of it goes, so they are kept apart
    const eyes = fade
      ? [...both64(ball(27.4, hy - 0.8, 3, 1.6, eyeC, { glows: true })), ...both64(ball(27.8, hy - 0.8, 1.2, 0.9, '#f8feff', { glows: true }))]
      : [...both64(ball(27.8, hy - 0.8, 1.8, 1.1, eyeC, { glows: true })), specks([[27.5, hy - 1.25], [35.5, hy - 1.25]], '#f8feff')];
    if (bite) {
      // the jaws open: a dark mouth, fangs top and bottom, the lower jaw dropped
      out.push(
        sheet([[25.6, hy + 3], [37.4, hy + 3], [36, hy + 14], [27, hy + 14]], '#3a1418', { curve: 0.5 }), ball(31.5, hy + 10.6, 3, 1.8, '#b04a50'),
        ball(31.5, hy + 14, 4.6, 2.2, muzzle), limb(31.5, hy + 1, 31.5, hy + 5.2, 4.6, 3.8, muzzle), ball(31.5, hy + 4.4, 2, 1.2, nose),
        ...both64(limb(27.4, hy + 5.4, 27.6, hy + 8.4, 0.6, 0.2, '#f0ead8')), ...both64(limb(29.4, hy + 5.8, 29.5, hy + 7.2, 0.45, 0.2, '#f0ead8')),
        ...both64(limb(28, hy + 12.6, 28.2, hy + 10, 0.55, 0.2, '#f0ead8')), ...both64(limb(30, hy + 12.8, 30.1, hy + 11.4, 0.4, 0.2, '#f0ead8')),
        hair(29, hy + 14, 28.5, hy + 17, '#c8c4d0'),
      );
    } else {
      out.push(
        limb(31.5, hy + 2, 31.5, hy + 8.8, 4.2, 3, muzzle), ball(31.5, hy + 8.6, 2.8, 1.8, nose), specks([[30.5, hy + 8], [32.5, hy + 8]], '#3a3a44'),
        hair(31.5, hy + 3, 31.5, hy + 7, '#9a9ca8'), hair(28, hy + 10, 35, hy + 10, '#2a2a34'),
        ...both64(limb(28.5, hy + 9.6, 28.6, hy + 11.2, 0.45, 0.2, '#e0dccc')),
      );
    }
    // the flanks tear where it slips half out of the world: stray flecks of it
    // left a step off its outline
    out.push(dots(bite ? [[10, 34], [11, 34], [52, 38], [53, 38], [12, 50], [12, 51]] : [[14, 30], [15, 30], [48, 38], [49, 38], [12, 46], [12, 47]], '#6a6e7a'));
    if (!fade) return [...out, ...eyes];
    // going: all of it but the eyes cut into slats, each pair of rows slid a
    // little off the next, and a violet light where the world closes over it
    const gaps = [2, 5, 8, 11, 13, 16, 19, 21, 24, 27];
    const keep = r => !gaps.includes(r >> 1);
    const tear = r => [0, 1, -1, 2, 0, -2, 1, 0, -1][(r >> 1) % 9];
    /** @type {object[]} */
    const gone = [];
    for (const p of out) {
      if (p.k === 'dots' || p.k === 'hair' || p.k === 'specks') continue;
      const c = p.c === dark ? '#5a5a78' : p.c === pale ? '#b8b0d4' : p.c === socket ? socket : '#8a88a4';
      // some rows catch the light of the tear more than others
      gone.push(...slats({ ...p, c }, keep, tear, 64).map(q => ((q.y1 >> 1) % 7 === 3 && c !== socket ? { ...q, c: '#c4b8f0' } : q)));
    }
    gone.push(...eyes, ...both64(ball(21.5, hy - 0.8, 1.2, 0.9, '#a890ff', { glows: true })), ball(31.5, hy - 3.5, 1.6, 0.9, '#d8ccff', { glows: true }));
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

// Hand-drawn detail laid over the quillback and the wyrm as they were first
// drawn, on the 32-unit grid at half a unit to the line: seams, bands and
// scales. It goes up to the finer grid with the rest of them (see FINER).
const DETAILS = {
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

// The great beasts keep the shapes and the poses they were first drawn with on
// the coarser grid, set on the finer one at twice the size; their eyes, teeth
// and nostrils were single pixels of that grid, and are drawn again here
// finely, with the scales, bristles and pits laid over them that the coarse
// grid had no room for
const FINER = {
  basilisk: (pose = 'idle') => {
    const gaze = pose === 'special', bite = pose === 'windup';
    const cx = 22, cy = gaze ? 17 : bite ? 43.6 : 45, ey = 2 * (Math.floor(cy / 2) - 1) + 2;
    const up = gaze ? 2.4 : bite ? -0.8 : 0;
    // scales down the flank in staggered rows, each a small arc
    const arcs = [];
    for (let r = 0; r < 4; r++) for (let x = 18 + (r % 2) * 1.5; x < 54; x += 3) {
      const y = 30 + r * 2.4 - up + (x < 30 ? 3 : 0);
      if (Math.hypot((x - 39) / 14, (y - 35 + up) / 9) < 1) arcs.push(hair(x - 1.25, y, x, y + 0.75, '#3e4826'), hair(x, y + 0.75, x + 1.25, y, '#3e4826'));
    }
    const eye = gaze
      ? [...[cx - 5, cx + 5].flatMap(x => [ball(x, ey, 2.8, 2.6, '#e8ff70', { glows: true }), ball(x, ey, 1.6, 1.6, '#fcffd0', { glows: true }), limb(x, ey - 1.6, x, ey + 1.6, 0.3, 0.3, '#2a3008')])]
      : bite ? [cx - 5, cx + 5].flatMap(x => [ball(x, ey, 2.6, 0.8, '#d8f040', { glows: true }), limb(x, ey - 0.6, x, ey + 0.6, 0.35, 0.35, '#1a2008')])
        : [cx - 5, cx + 5].flatMap(x => [ball(x, ey, 2.6, 1.6, '#d8f040', { glows: true }), limb(x, ey - 1.2, x, ey + 1.2, 0.45, 0.4, '#1a2008'), specks([[x - 1.25, ey - 1]], '#f4ffc0')]);
    return [
      ...arcs, ...eye,
      // warts along the jaw and over the brow
      specks([[cx - 5, cy + 9], [cx + 5.5, cy + 8.5], [cx - 3, cy - 4], [cx + 3, cy - 4.5]], '#4a5430'),
    ];
  },
  rustmaw: (pose = 'idle') => {
    const rear = pose === 'windup' || pose === 'special', up = rear ? 3.5 : 0, H = 2 * (24.5 - up), S = 1.4 * up;
    return [
      // small dull eyes over the maw
      ball(23, H - 3, 1.4, 1.1, '#d05a28', { glows: true }), ball(41, H - 3, 1.4, 1.1, '#d05a28', { glows: true }), specks([[22.5, H - 3.5], [40.5, H - 3.5]], '#ffb080'),
      // the plates of the wing cases, their worn bright edges, streaks of rust
      hair(14, 26 - S, 21, 18 - S, '#c86a3a'), hair(43, 18 - S, 50, 26 - S, '#c86a3a'), hair(24, 15 - S, 30, 14 - S, '#c86a3a'),
      ...[[18, 30], [22, 36], [26, 26], [38, 26], [42, 36], [46, 30], [28, 40], [36, 40]].map(([x, y]) => hair(x, y - S, x + 0.5, y + 3 - S, '#6a2208')),
      // a second ring of teeth further in, and the barbs on the mandibles
      ...[-3, -1, 1, 3].map(d => limb(32 + d * 1.2, H + 0.5, 32 + d * 1.1, H + 1.6, 0.4, 0.2, '#c8b894')),
      specks(rear ? [[12, H - 4], [10, H - 3], [8, H - 1], [52, H - 4], [54, H - 3], [56, H - 1]] : [[15, H + 3], [17, H + 6], [21, H + 10], [49, H + 3], [47, H + 6], [43, H + 10]], '#e0b070'),
      // bristles on the legs
      ...[[5, 26], [4, 34], [3, 44], [9, 18], [12, 50]].flatMap(([x, y]) => both64(hair(x, y - S, x - 1.5, y - 1 - S, '#8a5a30'))),
    ];
  },
  quillback: (pose = 'idle') => {
    const gore = pose === 'windup', H = gore ? 48 : 43;
    return [
      // small, mean, red, sunk under the brow
      ball(27, H - 1, 2.2, 1.6, '#1c1010'), ball(37, H - 1, 2.2, 1.6, '#1c1010'),
      ball(27.4, H - 1, 1.1, 0.9, '#ff3a1c', { glows: true }), ball(36.6, H - 1, 1.1, 0.9, '#ff3a1c', { glows: true }), specks([[27, H - 1.5], [36.25, H - 1.5]], '#ffb0a0'),
      // the brow drawn down over them, the nostrils in the snout
      limb(23.5, H - 4, 29.5, H - 2.6, 1, 0.7, '#4a3a2e'), limb(40.5, H - 4, 34.5, H - 2.6, 1, 0.7, '#4a3a2e'),
      ball(30, H + 7, 0.9, 0.8, '#2a1614'), ball(34, H + 7, 0.9, 0.8, '#2a1614'),
      // coarse bristles on the flanks and jowls, below the mantle
      ...[[13, 46], [16, 49], [19, 50], [45, 50], [48, 49], [51, 46], [23, H + 4], [41, H + 4]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.75 : 0.75), y + 2.5, '#2a201a')),
      specks([[22, 52], [42, 52], [32, 54]], '#7a6050'),
    ];
  },
  wyrm: (pose = 'idle') => {
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 30 : 32, hy = rear ? 13 : coil ? 27 : 23, cy = rear ? -3 : coil ? -2 : 0;
    const ey = 2 * (Math.round(hy / 2) - 1) + 1;
    // the scales of its flanks in rows, each a small dark arc
    const arcs = [];
    for (const [row, y] of [[0, 37], [1, 39.5], [2, 42], [3, 44.5]]) for (let x = 14 + (row % 2) * 1.5; x <= 50; x += 3) {
      if (Math.abs(x - 32) < 11 && y > 41) continue;    // not over the pale chest
      arcs.push(hair(x - 1.25, y + cy * 0.5, x, y + cy * 0.5 + 0.75, '#6a2618'), hair(x, y + cy * 0.5 + 0.75, x + 1.25, y + cy * 0.5, '#6a2618'));
    }
    /** @type {object[]} */
    const out = [...arcs];
    if (rear) {
      // the jaws wide and the throat a furnace: the fire is not lit by anything, it is the light
      out.push(ball(hx, hy + 10.6, 5.6, 5, '#ffb030', { glows: true }), ball(hx, hy + 10.6, 3.4, 3, '#ffe070', { glows: true }), ball(hx, hy + 10.6, 1.4, 1.6, '#fff8d8', { glows: true }),
        ...[[-6, 9], [6, 9], [-5.5, 13], [5.5, 13], [-3.5, 17], [3.5, 17]].map(([d, y]) => limb(hx + d, hy + y, hx + d * 0.8, hy + y + (y > 15 ? -1.6 : 1.6), 0.7, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.3, '#ffd040', { glows: true }), ball(x, ey, 0.9, 0.8, '#fff8c0', { glows: true })]));
    } else {
      out.push(
        ball(hx - 2, hy + 11, 0.8, 0.7, '#1a0806'), ball(hx + 2, hy + 11, 0.8, 0.7, '#1a0806'),
        ...(coil ? [[-6, 13], [6, 13], [-4, 17], [4, 17]] : [[-6, 11.4], [6, 11.4], [-4, 13], [4, 13]]).map(([d, y], i) => limb(hx + d, y + hy - (i > 1 && coil ? 1.6 : 0), hx + d * 0.9, hy + y + (i > 1 && coil ? -1.6 : 1.8), 0.6, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.2, '#ffb020', { glows: true }), limb(x, ey - 1, x, ey + 1, 0.4, 0.4, '#2a0c04')]),
      );
    }
    out.push(
      // the chest's plates, and the claws' pale edges
      ...[46, 49, 52].map(y => hair(25, y + cy * 0.5, 39, y + cy * 0.5, '#a87a52')),
      ...(rear ? [] : [specks([[3.5, 62], [9.5, 62.5], [15, 62], [49, 62], [54.5, 62.5], [60.5, 62]], '#fffaf0')]),
    );
    return out;
  },
};
for (const k in FINER) {
  const base = CREATURES[k];
  CREATURES[k] = pose => [...base(pose).filter(p => p.k !== 'dots').map(up2), ...FINER[k](pose)];
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
    ...[ball(9, 30, 4, 1.4, '#c89a28'), ball(16, 30.4, 4.5, 1.2, '#d8a830'), ball(23, 30, 4, 1.4, '#c89a28')].map(up2),
    specks([[16, 58.5], [30, 60.5], [44, 58.5], [36, 60.5]], '#fff0a0'),
    // the snore, drawn clear of the club over its other shoulder (a Z, then a smaller one; four fine pixels to each of the old)
    ...[[[4, 2], [5, 2], [6, 2], [7, 2], [6, 3], [5, 4], [4, 5], [5, 5], [6, 5], [7, 5]], [[9, 6], [10, 6], [11, 6], [10, 7], [9, 8], [10, 8], [11, 8]]].map((z, n) =>
      dots(z.flatMap(([x, y]) => [[x * 2, y * 2], [x * 2 + 1, y * 2], [x * 2, y * 2 + 1], [x * 2 + 1, y * 2 + 1]]), n ? '#b8c8f0' : '#dde8ff')),
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
    return [...[
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
    ].map(up2), ...scragHead(32, 34.8, { look: 0 }), ...[
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
    ].map(up2)];
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
    specks([[24, 59], [38, 60], [52, 59], [13, 60]], '#fff8c0'),
    // eyes shut: lids over both, a dark line where they meet
    ball(28.4, 15, 2, 1.4, '#9a7648'), ball(35.6, 15, 2, 1.4, '#9a7648'),
    hair(26.75, 15.5, 30, 15.75, '#3a2410'), hair(34, 15.75, 37.25, 15.5, '#3a2410'),
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
