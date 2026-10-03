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
/**
 * Parts swung about a pivot, by deg degrees clockwise: an arm about its shoulder
 * and the weapon in its hand, a head about its neck. Balls keep their shape and
 * only their place turns, which holds for the small turns a pose wants.
 */
const turn = (parts, cx, cy, deg) => {
  const t = deg * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
  const r = (x, y) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c];
  return parts.map(p => {
    if (p.k === 'ball') { const [x, y] = r(p.x, p.y); return { ...p, x, y }; }
    if (p.k === 'limb' || p.k === 'line' || p.k === 'hair') { const [x1, y1] = r(p.x1, p.y1), [x2, y2] = r(p.x2, p.y2); return { ...p, x1, y1, x2, y2 }; }
    return { ...p, pts: p.pts.map(([x, y]) => r(x, y)) };
  });
};
/** Parts moved bodily: a head dropped for the charge, a body sunk into a crouch. */
const nudge = (parts, dx, dy) => parts.map(p => {
  if (p.k === 'ball') return { ...p, x: p.x + dx, y: p.y + dy };
  if (p.k === 'limb' || p.k === 'line' || p.k === 'hair') return { ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy };
  return { ...p, pts: p.pts.map(([x, y]) => [x + dx, y + dy]) };
});
/** Parts stretched about (cx, cy): a body swelling, or rearing up taller. */
const grow = (parts, cx, cy, sx, sy) => {
  const r = (x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy];
  return parts.map(p => {
    if (p.k === 'ball') { const [x, y] = r(p.x, p.y); return { ...p, x, y, rx: p.rx * sx, ry: p.ry * sy }; }
    if (p.k === 'limb' || p.k === 'line' || p.k === 'hair') { const [x1, y1] = r(p.x1, p.y1), [x2, y2] = r(p.x2, p.y2); return { ...p, x1, y1, x2, y2 }; }
    return { ...p, pts: p.pts.map(([x, y]) => r(x, y)) };
  });
};
/** Parts painted afresh: each colour found in the map swapped for its new one (a champion's own hide); what glows keeps its light. */
const recolour = (parts, map) => parts.map(p => (map[p.c] && !p.glows ? { ...p, c: map[p.c] } : p));
/** Where a part sits, for sorting a body into what is above the hips and what below. */
const midOf = p => p.k === 'ball' ? [p.x, p.y] : p.pts ? [p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length, p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length] : [(p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2];
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
// Every creature and every prop is drawn lifelike, on the finer grid: a
// human's proportions, cloth falling in folds, armour, hands and faces, scales
// and fur, wood and stone (see m64, up2); the items keep the 32-unit grid they
// were designed on and are set on this one as they are painted (assets.js).
const gridOf = k => (k in CREATURES || k in PROPS || k in CHAMPION_OF ? 64 : 32);

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

// The dark elves' looks, shared by the warrior, the mage and their High
// Priestess: grey-violet skin, white hair, silver and black.
const drowKit = () => ({
  skin: '#6c6284', skinDk: '#463e5a', skinLt: '#9088a8', hair: '#f4f2fa', hairDk: '#d0cadc', eye: '#ff3a34',
  mail: '#2a2a36', mailLt: '#464656', leather: '#1e1a26', boot: '#16121c', cloak: '#26182e', cloakDk: '#160e1c',
  silver: '#b8bccc', silverLt: '#eef0f8', blade: '#cdd2de', grip: '#2a1e30',
});
/** A dark elf's long white hair, falling behind the shoulders (drawn first, behind everything). */
const drowHair = (hx, hy, k) => [
  sheet([[hx - 5, hy - 3], [hx + 5, hy - 3], [hx + 6.5, hy + 8], [hx + 7, hy + 16], [hx + 3, hy + 14], [hx, hy + 16.5], [hx - 3, hy + 14], [hx - 7, hy + 16], [hx - 6.5, hy + 8]], k.hairDk, { curve: 1 }),
  ...[-4.5, -1.5, 1.5, 4.5].map(d => hair(hx + d, hy, hx + d * 1.3, hy + 15, '#9a92ac')),
];
/** A dark elf's face: narrow, the ears long and swept back, the eyes red, the hair parted over the brow. */
const drowHead = (hx, hy, k, { grim = false } = {}) => [
  ...[-1, 1].map(sd => sheet([[hx + sd * 3.2, hy - 0.6], [hx + sd * 10.5, hy - 5.2], [hx + sd * 8.6, hy - 3.2], [hx + sd * 3.4, hy + 1.8]], k.skin, { curve: 0.4, tilt: [sd * 0.4, -0.2] })),
  ...[-1, 1].map(sd => hair(hx + sd * 4, hy - 0.4, hx + sd * 8.5, hy - 3.6, k.skinDk)),
  // a narrow face drawn to a point at the chin, high cheekbones catching the light
  sheet([[hx - 3.3, hy - 3], [hx + 3.3, hy - 3], [hx + 3.4, hy + 0.8], [hx + 2, hy + 3.6], [hx, hy + 5.2], [hx - 2, hy + 3.6], [hx - 3.4, hy + 0.8]], k.skin, { curve: 0.9 }),
  ball(hx - 2.1, hy + 1.6, 0.9, 0.6, k.skinLt), ball(hx + 2.1, hy + 1.6, 0.9, 0.6, k.skinLt),
  // the hair over the brow, parted, and down over the ears
  sheet([[hx - 4, hy - 1], [hx - 3.8, hy - 4.6], [hx, hy - 5.6], [hx + 3.8, hy - 4.6], [hx + 4, hy - 1], [hx + 2.2, hy - 3.2], [hx, hy - 3.8], [hx - 2.2, hy - 3.2]], k.hair, { curve: 0.8 }),
  hair(hx, hy - 5.5, hx, hy - 3.5, k.hairDk), hair(hx - 3.5, hy - 2, hx - 4.2, hy + 3, k.hair), hair(hx + 3.5, hy - 2, hx + 4.2, hy + 3, k.hair),
  // brows drawn down, red eyes with a light in them, a thin mouth
  hair(hx - 2.75, grim ? hy - 1.25 : hy - 1.5, hx - 0.75, hy - 0.75, k.hair), hair(hx + 0.75, hy - 0.75, hx + 2.75, grim ? hy - 1.25 : hy - 1.5, k.hair),
  ball(hx - 1.7, hy + 0.3, 0.8, 0.55, k.eye, { glows: true }), ball(hx + 1.7, hy + 0.3, 0.8, 0.55, k.eye, { glows: true }),
  hair(hx + 0.25, hy + 1, hx + 0.25, hy + 2.5, k.skinDk),
  hair(hx - 1, hy + 3.75, hx + 1, hy + 3.75, grim ? '#241830' : k.skinDk),
];
/** A slender grey hand. */
const drowHand = (x, y, k) => [ball(x, y, 1.6, 1.5, k.skin), specks([[x - 0.5, y - 0.75]], k.skinLt)];
/** A curved blade from a grip at (x, y) along (u, v), bending to side `c`: hilt, guard, blade and its edge. */
const scimitar = (x, y, u, v, len, c, k) => {
  const px = -v * c, py = u * c;
  const a = [x + u * 2, y + v * 2], b = [x + u * len * 0.55 + px * 1.4, y + v * len * 0.55 + py * 1.4], e = [x + u * len + px * 3.6, y + v * len + py * 3.6];
  return [
    limb(x - u * 2.4, y - v * 2.4, x + u * 1, y + v * 1, 0.7, 0.7, k.grip), ball(x - u * 3, y - v * 3, 0.9, 0.9, k.silver),
    limb(x + u * 1.4 - v * 2.6, y + v * 1.4 + u * 2.6, x + u * 1.4 + v * 2.6, y + v * 1.4 - u * 2.6, 0.55, 0.55, k.silver),
    limb(a[0], a[1], b[0], b[1], 1.3, 1.1, k.blade, { smooth: 1 }), limb(b[0], b[1], e[0], e[1], 1.1, 0.25, k.blade, { smooth: 1 }),
    hair(a[0] + px * 0.6, a[1] + py * 0.6, b[0] + px * 0.6, b[1] + py * 0.6, k.silverLt), hair(b[0] + px * 0.5, b[1] + py * 0.5, e[0], e[1], k.silverLt),
  ];
};
// The grey dwarves' looks, shared by the warrior, the arbalest and their
// Thane: skin the grey of the rock, an iron-coloured beard in braids bound
// with copper, eyes like coals, mail and plate as dark as the iron they dig.
const dwarfKit = () => ({
  skin: '#8a8a8c', skinDk: '#5e5e62', skinLt: '#aeaeb0', beard: '#6a6c70', beardDk: '#46484c', beardLt: '#8e9094', eye: '#ff9a3a',
  iron: '#4e5258', ironLt: '#7e848c', ironDk: '#2c2e32', mail: '#3c3e44', leather: '#4a3424', boot: '#22201e', copper: '#c87a3a', haft: '#5a4030',
});
/** A grey dwarf's head: bald and broad, a brow like a ledge, coal eyes, a big nose, and the beard in two braids to the belt. */
const dwarfHead = (hx, hy, k, { grim = false, helm = false } = {}) => [
  // the beard first, under the face: a broad spade of it, two braids out of it bound in copper
  sheet([[hx - 7.5, hy + 2], [hx + 7.5, hy + 2], [hx + 8, hy + 12], [hx + 5, hy + 20], [hx, hy + 24], [hx - 5, hy + 20], [hx - 8, hy + 12]], k.beard, { curve: 1 }),
  ...[-4, -1.5, 1.5, 4].map(d => hair(hx + d, hy + 5, hx + d * 1.15, hy + 21, k.beardDk)),
  ...[-1, 1].flatMap(sd => [limb(hx + sd * 4, hy + 18, hx + sd * 4.6, hy + 30, 1.3, 1, k.beard), ball(hx + sd * 4.6, hy + 25, 1.6, 1, k.copper), ball(hx + sd * 4.7, hy + 28, 1.5, 0.9, k.copper)]),
  // the head, the ears small against it, and the dome bald (or under an iron helm)
  ball(hx, hy, 7.6, 7.2, k.skin), ball(hx - 7.4, hy + 0.5, 1.4, 2, k.skin), ball(hx + 7.4, hy + 0.5, 1.4, 2, k.skin),
  ...(helm ? [sheet([[hx - 8.2, hy - 1], [hx - 7, hy - 6], [hx - 3, hy - 9], [hx + 3, hy - 9], [hx + 7, hy - 6], [hx + 8.2, hy - 1]], k.iron, { curve: 0.9 }),
    line(hx - 8, hy - 1, hx + 8, hy - 1, k.ironLt), limb(hx, hy - 1, hx, hy + 3.5, 0.9, 0.7, k.ironLt), hair(hx - 5, hy - 6.5, hx - 1, hy - 8.4, k.ironLt)]
    : [ball(hx - 2.5, hy - 4.5, 2.6, 1.4, k.skinLt), hair(hx - 6, hy - 3.5, hx + 6, hy - 3.5, k.skinDk)]),
  // the brow drawn down like a ledge, the eyes red as coals under it, the nose
  limb(hx - 5.5, grim ? hy - 0.2 : hy - 0.8, hx - 1, hy - 0.2, 1.3, 1, k.skinDk), limb(hx + 5.5, grim ? hy - 0.2 : hy - 0.8, hx + 1, hy - 0.2, 1.3, 1, k.skinDk),
  ball(hx - 3, hy + 1.2, 0.9, 0.6, k.eye, { glows: true }), ball(hx + 3, hy + 1.2, 0.9, 0.6, k.eye, { glows: true }),
  ball(hx, hy + 3.4, 2, 1.8, k.skinLt), hair(hx - 1.5, hy + 4.6, hx + 1.5, hy + 4.6, k.skinDk),
  // the moustache over the mouth, falling into the beard
  sheet([[hx - 4.5, hy + 5.4], [hx, hy + 4.8], [hx + 4.5, hy + 5.4], [hx + 5.4, hy + 8.6], [hx, hy + 6.6], [hx - 5.4, hy + 8.6]], k.beardLt, { curve: 0.8 }),
  ...(grim ? [sheet([[hx - 2, hy + 7.2], [hx + 2, hy + 7.2], [hx + 1.4, hy + 8.8], [hx - 1.4, hy + 8.8]], '#1a1210')] : []),
];
/** A dwarf's squat body in mail, plate over the chest, a belt with a broad buckle and a skirt of mail. */
const dwarfBody = (k, { plate = true, dy = 0, narrow = false } = {}) => narrow ? dwarfJerkin(k) : [
  // short thick legs, heavy boots
  ...both64(limb(26, 50, 25, 56, 3.8, 3.4, k.mail)), ...both64(limb(25, 56, 24.6, 59.5, 3.6, 3.4, k.boot)), ...both64(ball(23.6, 61.2, 4.8, 1.8, k.boot)),
  // the mail coat to the knee, wide as a door
  sheet([[16, 24 + dy], [48, 24 + dy], [50, 52], [14, 52]], k.mail, { curve: 1 }),
  ...[30, 34, 38, 42, 46, 50].map(y => hair(15.5, y, 48.5, y, '#2a2c30')),
  ...(plate ? [
    sheet([[19, 25 + dy], [45, 25 + dy], [44, 41 + dy], [32, 44 + dy], [20, 41 + dy]], k.iron, { curve: 1 }),
    sheet([[19, 25 + dy], [24, 25 + dy], [24.5, 41 + dy], [20, 41 + dy]], k.ironLt, { curve: 0.5 }),
    line(32, 25.5 + dy, 32, 43 + dy, k.ironDk), hair(20, 26 + dy, 31, 26 + dy, '#b8bec6'),
    ...[[22, 28], [42, 28], [22, 38], [42, 38]].map(([x, y]) => ball(x, y + dy, 0.7, 0.7, k.ironLt)),
  ] : [sheet([[20, 25 + dy], [44, 25 + dy], [43, 44 + dy], [21, 44 + dy]], k.leather, { curve: 1 }), ...[29, 33, 37, 41].map(y => hair(21, y + dy, 43, y + dy, '#3a2818'))]),
  // the belt and its buckle
  sheet([[15, 44 + dy], [49, 44 + dy], [49, 47.5 + dy], [15, 47.5 + dy]], '#1e1610', { curve: 0.8 }),
  sheet([[29, 43.4 + dy], [35, 43.4 + dy], [35, 48 + dy], [29, 48 + dy]], k.copper), sheet([[30.4, 44.6 + dy], [33.6, 44.6 + dy], [33.6, 46.8 + dy], [30.4, 46.8 + dy]], '#1e1610'),
  // pauldrons, and the bull neck
  ...both64(ball(16.5, 26 + dy, 6.6, 4.8, k.iron)), ...both64(hair(11.5, 24 + dy, 21, 22.4 + dy, k.ironLt)),
  limb(32, 18 + dy, 32, 25 + dy, 5, 5.4, k.skinDk),
];
/** An arbalest's: the same short legs, a quilted jerkin and no pauldrons, narrower than a warrior's plate. */
const dwarfJerkin = k => [
  ...both64(limb(27, 48, 26, 56, 3.6, 3.2, k.mail)), ...both64(limb(26, 56, 25.6, 59.5, 3.4, 3.2, k.boot)), ...both64(ball(24.8, 61.2, 4.4, 1.8, k.boot)),
  sheet([[20, 24], [44, 24], [45, 49], [19, 49]], k.leather, { curve: 1 }),
  ...[28, 32, 36, 40, 44].map(y => hair(20, y, 44, y, '#3a2818')), line(32, 24.5, 32, 48.5, '#2a1c10'),
  sheet([[18.5, 44], [45.5, 44], [45.5, 47.5], [18.5, 47.5]], '#1e1610', { curve: 0.8 }),
  sheet([[29.5, 43.4], [34.5, 43.4], [34.5, 48], [29.5, 48]], k.copper),
  ...both64(ball(20, 26, 4, 3.2, k.leather)),
  limb(32, 18, 32, 25, 5, 5.4, k.skinDk),
];
/** A war pick from the grip at (x, y) along (u, v): the haft, and its head across the top, a spike one way and a hammer the other. */
const warPick = (x, y, u, v, len, k) => {
  const ex = x + u * len, ey = y + v * len, px = -v, py = u;
  return [
    limb(x - u * 4, y - v * 4, ex, ey, 1.2, 1.1, k.haft), ...[0.35, 0.55].map(t => hair(x + u * len * t + px * 1.2, y + v * len * t + py * 1.2, x + u * len * t - px * 1.2, y + v * len * t - py * 1.2, k.copper)),
    limb(ex - px * 2, ey - py * 2, ex + px * 9, ey + py * 9, 1.8, 0.3, k.iron), limb(ex - px * 6, ey - py * 6, ex - px * 1, ey - py * 1, 2.6, 2.6, k.iron),
    hair(ex + px * 1, ey + py * 1 - 1, ex + px * 8, ey + py * 8 - 0.5, k.ironLt), ball(ex - px * 6.5, ey - py * 6.5, 2.6, 2.6, k.ironDk),
  ];
};

// The lizardfolk's looks, shared by the warrior, the shaman and their
// Marsh-Mother: green scales over a pale belly, a crest down the skull, yellow
// slit eyes, and a tail as thick as a man's leg.
const lizardKit = () => ({
  scale: '#5a7a3a', scaleDk: '#3a5426', scaleLt: '#7e9e52', belly: '#c8c08a', bellyDk: '#9a9466', crest: '#b0602a', eye: '#f0d040',
  hide: '#6a5232', hideDk: '#4a3820', shell: '#6a6a3a', shellDk: '#4a4a26', shellLt: '#9a9a5a', wood: '#7a5a34', bone: '#e8dcc0', boneDk: '#b8aa88',
});
/** A lizardfolk's head seen from the front: a broad flat skull, a long snout narrowing to the nostrils, slit eyes either side, a crest above. */
const lizardHead = (hx, hy, k, { open: jaw = false } = {}) => [
  ...[-1, 1].map(sd => sheet([[hx + sd * 1, hy - 6], [hx + sd * 3, hy - 9.5], [hx + sd * 2.4, hy - 5]], k.crest, { curve: 0.3 })),
  sheet([[hx - 1.2, hy - 7], [hx, hy - 11], [hx + 1.2, hy - 7]], k.crest),
  ball(hx, hy - 2, 7.4, 5.6, k.scale), ball(hx, hy - 3.6, 5, 2.6, k.scaleLt),
  // the snout coming toward you, and its jaw
  sheet([[hx - 4.4, hy], [hx + 4.4, hy], [hx + 3.2, hy + 6.5], [hx, hy + 7.6], [hx - 3.2, hy + 6.5]], k.scale, { curve: 0.8 }),
  ...(jaw ? [sheet([[hx - 3.2, hy + 4], [hx + 3.2, hy + 4], [hx + 2.4, hy + 8.6], [hx - 2.4, hy + 8.6]], '#5a1a1a'), ...[-2, -0.7, 0.7, 2].map(d => limb(hx + d, hy + 4.4, hx + d, hy + 5.6, 0.35, 0.15, k.bone))]
    : [hair(hx - 3, hy + 5, hx + 3, hy + 5, k.scaleDk)]),
  ball(hx - 1, hy + 6.4, 0.5, 0.4, '#1a1a10'), ball(hx + 1, hy + 6.4, 0.5, 0.4, '#1a1a10'),
  ...[-1, 1].flatMap(sd => [ball(hx + sd * 4.6, hy - 2.4, 1.6, 1.3, k.eye, { glows: true }), limb(hx + sd * 4.6, hy - 3.4, hx + sd * 4.6, hy - 1.4, 0.3, 0.3, '#1a1a10')]),
  specks([[hx - 3, hy - 5], [hx + 2, hy - 4], [hx - 1, hy + 2], [hx + 2.5, hy + 3]], k.scaleDk),
];
/** The body: a scaled torso with a pale belly in bands, a hide kilt, thick legs ending in three-toed feet, and the tail out behind to one side. */
const lizardBody = (k, { tail = 'rest' } = {}) => [
  ...(tail === 'rest' ? [limb(36, 46, 48, 54, 4.4, 3, k.scale), limb(48, 54, 58, 60, 3, 1.4, k.scale), hair(40, 48, 56, 59, k.scaleDk)] : []),
  ...both64(limb(27, 44, 25, 53, 4, 3.4, k.scale)), ...both64(limb(25, 53, 25.5, 59.5, 3, 2.6, k.scaleDk)),
  ...both64(ball(24.5, 61.2, 4.4, 1.6, k.scaleDk)), ...both64(limb(21.5, 61, 20, 62.6, 0.6, 0.4, k.bone)),
  sheet([[20, 20], [44, 20], [43, 44], [21, 44]], k.scale, { curve: 1 }),
  sheet([[26, 22], [38, 22], [37, 43], [27, 43]], k.belly, { curve: 0.8 }),
  ...[26, 30, 34, 38, 42].map(y => hair(27, y, 37, y, k.bellyDk)),
  specks([[22, 26], [42, 28], [23, 34], [41, 36], [24, 40]], k.scaleDk),
  sheet([[20, 41], [44, 41], [45.5, 50], [32, 51.5], [18.5, 50]], k.hide, { curve: 0.6 }), ...[24, 29, 35, 40].map(x => hair(x, 43, x + (x - 32) * 0.05, 50.5, k.hideDk)),
  limb(32, 15, 32, 21, 4.6, 5.4, k.scale),
];

// what the renegade wears in place of the house's black and silver
const RENEGADE = { '#2a2a36': '#4a3a2c', '#464656': '#6a5640', '#1a1a22': '#33281e', '#26182e': '#3e4636', '#160e1c': '#2a3024',
  '#b8bccc': '#8a8078', '#eef0f8': '#c8c0b4', '#3a3046': '#3a3226' };
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
  // keeled scales in rows down a long muscled body, a crest of horn plates
  // down its back, a serpent's tail coiled up behind, and eyes that are what
  // you see first. Winding up a bite it drops its jaw; to look at you it rears
  // its head up high, the crown spreads into a frill and the eyes blaze.
  basilisk: (pose = 'idle') => {
    const hide = '#62703f', hideLt = '#7a8a50', skin = '#77834e', flank = '#4a5436', belly = '#b0aa78', horn = '#a08e5e', hornDk = '#7a6844', jaw = '#8e8c5e', scaleC = '#3e4826', claw = '#e0d8b8';
    const gaze = pose === 'special', bite = pose === 'windup';
    const up = gaze ? 2.4 : bite ? -0.8 : 0;    // how far the body is raised
    // plates standing up off the spine: [x, y at the spine, height, lean]
    const plates = [[52, 28, 5, 1.6], [47, 25, 7, 1.4], [42, 23.6, 8.4, 1.2], [37, 24, 9.2, 1], [32, 25.4, 9, 0.8], [27.4, 28, 8, 0.5], [23.6, 31, 6.4, 0.3]]
      .map(([x, y, h, l]) => gaze ? [x, y - up, h * 1.25, l * 0.6] : [x, y, h, l]);
    /** a leg: hip, elbow or knee, foot, with three clawed toes */
    const legOf = (x1, y1, x2, y2, x3, y3, r, c) => [
      limb(x1, y1, x2, y2, r, r * 0.8, c), ball(x2, y2, r * 0.8, r * 0.75, c), limb(x2, y2, x3, y3, r * 0.8, r * 0.6, c),
      ball(x3, y3 + 1, r * 1.1, r * 0.5, flank),
      ...[-1, 0, 1].map(d => limb(x3 + d * r * 0.8, y3 + 1.4, x3 + d * r * 1.3, y3 + 2.6, 0.7, 0.3, claw)),
    ];
    /** the head, square on to you: a crown of plates, a wedge of a snout, eyes on top */
    const head = (cx, cy) => {
      // the crown stands up off the skull; rearing, it spreads into a frill
      const crown = (gaze ? [-180, -158, -136, -114, -90, -66, -44, -22, 0].map((a, i) => [a, [12, 15, 17, 18, 19, 18, 17, 15, 12][i]]) : [[-160, 4.4], [-134, 5.6], [-112, 6], [-68, 6], [-46, 5.6], [-20, 4.4]])
        .map(([a, r]) => {
          const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), w = gaze ? 3 : 2.6;
          const bx = cx + dx * 8, by = cy - 1 + dy * 4.8;
          return [sheet([[bx - dy * w, by + dx * w], [bx + dx * r, by + dy * r], [bx + dy * w, by - dx * w]], horn, { tilt: [dx * 0.5, dy * 0.5] }),
            hair(bx, by, bx + dx * r * 0.8, by + dy * r * 0.8, hornDk)];
        }).flat();
      if (gaze) crown.unshift(sheet(oval(cx, cy - 2, 17, 13, 20), '#5a6a38', { tilt: [0, -0.4] }));
      /** @type {object[]} */
      const p = [...crown, ball(cx, cy, 11.2, 6.8, skin), ball(cx - 3, cy - 3, 5, 2.4, hideLt)];
      // scales over the skull, a ridge down the snout
      p.push(...[[-4, -5], [0, -6], [4, -5], [-2, -4], [2, -4]].flatMap(([d, y]) => [hair(cx + d - 1, cy + y, cx + d, cy + y + 0.75, scaleC), hair(cx + d, cy + y + 0.75, cx + d + 1, cy + y, scaleC)]),
        hair(cx, cy - 2, cx, cy + 5, '#8e9a62'));
      if (bite) {
        p.push(
          sheet([[cx - 9, cy + 1], [cx + 9, cy + 1], [cx + 6, cy + 14], [cx - 6, cy + 14]], '#5a1c1e', { curve: 0.6 }),
          ball(cx, cy + 14.6, 6.8, 2.6, jaw), limb(cx, cy + 1, cx, cy + 6, 7.2, 5.2, skin), ball(cx, cy + 11.2, 4, 2, '#a04a40'),
          ...[-5, -2, 2, 5].map(d => limb(cx + d, cy + 6.6, cx + d, cy + 8.4, 0.55, 0.2, '#f0e8cc')),
          ...[-4, -1.3, 1.3, 4].map(d => limb(cx + d, cy + 13, cx + d, cy + 11.4, 0.5, 0.2, '#e0d8b8')),
          hair(cx + 4, cy + 15, cx + 4, cy + 18, '#c8d0a0'), specks([[cx - 5, cy + 16]], '#c8d0a0'),
        );
      } else {
        p.push(
          ball(cx, cy + 11.2, 5.2, 2.6, jaw), limb(cx, cy + 2, cx, cy + 8.8, 7.2, 4.8, skin),
          hair(cx - 5, cy + 10, cx + 6, cy + 10, '#2a1a14'), hair(cx - 6, cy + 8, cx - 5, cy + 10, '#2a1a14'), hair(cx + 7, cy + 8, cx + 6, cy + 10, '#2a1a14'),
          ...[-4, -1.3, 1.3, 4].map(d => limb(cx + d, cy + 10.2, cx + d, cy + 11.6, 0.45, 0.2, '#f0e8cc')),
        );
      }
      p.push(ball(cx - 1.6, cy + 6.4, 0.7, 0.6, '#1e2414'), ball(cx + 1.6, cy + 6.4, 0.7, 0.6, '#1e2414'));
      // the eyes sit in dark rims under a heavy brow
      const ey = cy - 1;
      p.push(ball(cx - 5, ey, 3.8, gaze ? 4 : 3, '#262a18'), ball(cx + 5, ey, 3.8, gaze ? 4 : 3, '#262a18'));
      for (const x of [cx - 5, cx + 5]) {
        if (gaze) p.push(ball(x, ey, 2.8, 2.6, '#e8ff70', { glows: true }), ball(x, ey, 1.6, 1.6, '#fcffd0', { glows: true }), limb(x, ey - 1.6, x, ey + 1.6, 0.3, 0.3, '#2a3008'));
        else if (bite) p.push(ball(x, ey + 0.6, 2.6, 0.8, '#d8f040', { glows: true }), limb(x, ey, x, ey + 1.2, 0.35, 0.35, '#1a2008'));
        else p.push(ball(x, ey, 2.6, 1.8, '#d8f040', { glows: true }), limb(x, ey - 1.4, x, ey + 1.4, 0.45, 0.4, '#1a2008'), specks([[x - 1.25, ey - 1]], '#f4ffc0'));
      }
      if (gaze) {
        // light spilling out of them, over the frill and down the snout
        for (const [ex, dir] of [[cx - 5, -1], [cx + 5, 1]]) {
          p.push(hair(ex + dir * 5, ey, ex + dir * 10, ey, '#d8ff60', { glows: true }), hair(ex + dir * 4, ey - 3, ex + dir * 8, ey - 7, '#c0f050', { glows: true }),
            hair(ex + dir * 4, ey + 3, ex + dir * 8, ey + 7, '#c0f050', { glows: true }), hair(ex, ey - 4, ex, ey - 8, '#c0f050', { glows: true }));
          p.push(specks([[ex + dir * 8, ey - 2], [ex - dir * 2, ey + 6]], '#f0ffa0', { glows: true }));
        }
      }
      const b = gaze ? -2.4 : bite ? 0.8 : 0;    // the brow, raised or drawn down
      p.push(limb(cx - 10, ey - 2.6 + b, cx - 3, ey - 0.6 + b, 1.6, 1, horn), limb(cx + 10, ey - 2.6 + b, cx + 3, ey - 0.6 + b, 1.6, 1, horn));
      return p;
    };
    /** @type {object[]} */
    const out = [
      // the tail, up behind it in a serpent's coil, ringed and spiked
      limb(52, 30, 59, 24, 5.2, 4.2, hide), limb(59, 24, 60, 14, 4.2, 3.2, hide),
      limb(60, 14, 55, 7, 3.2, 2.2, hide), limb(55, 7, 50, 9, 2.2, 1.4, hide), limb(50, 9, 50, 13, 1.4, 1, hide),
      limb(58.6, 25, 59.6, 15, 2, 1.6, belly),
      ...[[62, 20, 1], [61, 10, 0.6], [55, 4, 0]].map(([x, y, l]) => sheet([[x - 3 * l - 1.6, y + 2.4 - l * 2], [x + 2.4 * l, y - 2.6 + l * 0.6], [x + 1.2, y + 2.8]], horn, { tilt: [0.4, -0.4] })),
      ...[[56, 27], [59.5, 20], [60, 15], [57.5, 9.5], [53, 7]].map(([x, y]) => hair(x - 2, y - 1, x + 2, y + 1, '#46502e')),
      // the far legs, splayed out behind
      ...legOf(32, 30 - up, 23, 27 - up, 22, 39, 3, flank),
      ...legOf(24, 39 - up, 13, 37 - up, 10, 51, 3.8, flank),
      // the crest
      ...plates.map(([x, y, h, l]) => sheet([[x - 3.6, y + 2], [x + l * 3, y - h], [x + 3.6, y + 2]], horn, { curve: 0.6 })),
      ...plates.map(([x, y, h, l]) => hair(x, y + 1, x + l * 3, y - h + 2, hornDk)),
      // the body, from the haunch forward to the shoulders, the muscle of each
      ball(49, 33 - up * 0.5, 9.6, 7.6, hide), ball(39, 35 - up, 13, 10, hide), ball(29, 39 - up, 13, 10.4, flank),
      ball(38, 31 - up, 8, 4, hideLt), ball(48, 30 - up * 0.5, 5, 3, hideLt),
      ball(39, 42 - up, 11, 3.6, belly),
      // the near legs: hind, middle, front
      ...legOf(49, 37 - up * 0.5, 54, 43, 54, 54, 3.6, hide),
      ...legOf(41, 41 - up, 45, 49 - up * 0.5, 43, 59, 4, hide),
      ...legOf(30, 44 - up, 35, 50 - up * 0.5, 33, 59.6, 4.6, hide),
    ];
    // keeled scales in staggered rows over the back and shoulders, each a small arc
    const onBack = (x, y) => y < 39 - up && (((x - 39) / 12) ** 2 + ((y - 35 + up) / 8.8) ** 2 < 1 || ((x - 49) / 8.6) ** 2 + ((y - 33 + up * 0.5) / 6.6) ** 2 < 1
      || ((x - 29) / 11.6) ** 2 + ((y - 39 + up) / 9.2) ** 2 < 1);
    for (let r = 0; r < 8; r++) for (let x = 18 + (r % 2) * 1.5; x < 58; x += 3) {
      const y = 27 + r * 1.8;
      if (onBack(x - 1, y) && onBack(x + 1, y + 1)) out.push(hair(x - 1.25, y, x, y + 0.75, scaleC), hair(x, y + 0.75, x + 1.25, y, scaleC));
    }
    out.push(
      // a pale scaled belly along the near side, and the folds of skin at each leg
      ...[33, 37, 41, 45].map(x => hair(x, 42.5 - up, x + 1.5, 43 - up, '#8a8660')),
      hair(36, 45 - up, 38, 48 - up, flank), hair(46, 42 - up, 48, 45 - up, flank), hair(52, 38, 55, 41, flank),
    );
    if (gaze) {
      // reared up high on its neck, pale throat toward you
      out.push(limb(30, 41, 25, 27, 8, 6.6, hide), limb(25, 27, 23, 20, 6.6, 6, hide), ball(25, 31, 3.6, 7, belly),
        ...[26, 29, 32, 35, 38].map((y, i) => hair(21 + i, y, 28 + i * 1.2, y - 1, '#8e9a62')), ...head(22, 17));
    } else out.push(...head(22, bite ? 43.6 : 45));
    // the hide is smooth between its scales: the painter's grain on top of the
    // rows of scales only read as dirt
    for (const q of out) Object.assign(q, { smooth: 1 });
    return out;
  },

  // A rustmaw: a beetle the size of a pony, square on. Its wing cases are a
  // dome of rust split down the middle, ridged and pitted in rows and crusted
  // green where the copper has gone over; a plated shield stands behind the
  // head. The head is all mouth: a round wet maw ringed with small teeth,
  // mandibles either side, compound eyes, and two feathered feelers that taste
  // the air for iron. Six jointed legs, spined. Rearing for the bite, the front
  // of it lifts, the spade feet come up and the mandibles spread.
  rustmaw: (pose = 'idle') => {
    const rust = '#a4461a', rustDk = '#7a3010', rustLt = '#c0602c', shield = '#8a3a16', verd = '#5a9a80', verdLt = '#9ad0b8', bronze = '#5e3020', jaw = '#7a3620',
      leg = '#4e2e1c', knee = '#8a5430', gold = '#d8a860';
    const rear = pose === 'windup' || pose === 'special';
    const up = rear ? 7 : 0;      // how far the front of it is raised
    const hy = 49 - up;           // the head
    const sy = up * 0.7;          // and the shell
    /** a jointed leg: hip, knee and foot, with spines down the shin */
    const legOf = (hx, hY, kx, ky, fx, fy, r) => [
      ...both64(limb(hx, hY, kx, ky, r, r * 0.8, leg)), ...both64(ball(kx, ky, r * 0.85, r * 0.8, knee)), ...both64(limb(kx, ky, fx, fy, r * 0.8, r * 0.55, leg)),
      ...[0.3, 0.55, 0.8].flatMap(f => both64(hair(kx + (fx - kx) * f, ky + (fy - ky) * f, kx + (fx - kx) * f - 1.75, ky + (fy - ky) * f - 0.75, gold))),
    ];
    /** @type {object[]} */
    const out = [
      // hind legs, far back: out, up at the knee and down to the floor
      ...legOf(21, 32 - up * 0.4, 10, 19 - up * 0.5, 6, 41, 2.6),
      // the wing cases: a dome split down the middle, a rim to each
      ball(32, 31 - sy, 21.6, 16.8, rust), ball(32, 39 - sy, 20, 8, rustDk),
      ball(24, 24 - sy, 8, 6, rustLt), ball(40, 24 - sy, 8, 6, rustLt),
      limb(32, 15 - sy, 32, 46 - sy, 0.9, 0.9, '#4a1c0c'),
      // the copper gone green in crusts over it
      sheet([[12, 26], [16, 21], [21, 20], [22, 24], [19, 26], [20, 31], [15, 34], [11, 32]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.4, -0.3] }),
      sheet([[40, 17], [45, 16], [48, 20], [45, 21], [42, 20]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.2, -0.6] }),
      sheet([[46, 28], [51, 26], [53.6, 32], [52, 38], [48, 36], [49, 32]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.6, 0] }),
      sheet([[25, 35], [29, 33], [30, 38], [26, 39]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.2, 0] }),
      // middle legs, braced wide, the feet clawed
      ...legOf(16, 42 - up * 0.6, 5, 31 - up * 0.8, 2.4, 55, 3.2),
      ...both64(ball(3, 56, 2.8, 1.6, leg)), ...both64(limb(3, 56.4, 1, 59, 1, 0.6, knee)), ...both64(limb(4, 56.8, 6.8, 59.2, 1, 0.6, knee)),
      // the shield behind the head, with a rolled front edge and a row of rivet-like bosses
      ball(32, 41 - up, 17.2, 8.8, shield), ball(32, 38 - up, 14, 4, '#9a4a22'),
      limb(17, 44.6 - up, 47, 44.6 - up, 1.4, 1.4, '#b8602c'), hair(18, 43.5 - up, 46, 43.5 - up, '#e08850'),
      ...[20, 26, 32, 38, 44].map(x => ball(x, 40.5 - up, 1.1, 1, '#6a2a10')),
    ];
    if (rear) {
      // forelegs raised high, the spade feet up and out
      out.push(...legOf(22, 45 - up, 8, 31 - up, 11, 14, 3.2),
        ...both64(limb(11, 14, 17.6, 10.6, 1.8, 0.9, gold)), ...both64(limb(11, 15, 17.6, 17.6, 1.6, 0.8, gold)), ...both64(limb(10.6, 14, 10.6, 7, 1.4, 0.8, gold)));
    } else {
      out.push(...legOf(22, 48, 14, 42, 9, 56, 3.2),
        ...both64(ball(8.6, 58.6, 4.4, 3.6, leg)),
        ...both64(limb(8, 59, 3.6, 62, 1.2, 0.7, knee)), ...both64(limb(9, 59.6, 9, 62.4, 1.2, 0.7, knee)), ...both64(limb(10, 59, 13.6, 62, 1.2, 0.7, knee)));
    }
    const mr = rear ? [7.6, 6.8] : [6.4, 5.6];    // how wide the maw gapes
    out.push(
      ball(32, hy, 12.4, 8.8, bronze), ball(28, hy - 4, 5, 2.6, '#7a4030'),
      // the maw, round and wet, lipped in raw red. The hole itself is laid
      // flat and turned from the light: painted as a ball, the painter lit
      // its crown, and the dark of the throat came out a grey dome
      ball(32, hy + 2, mr[0] + 1.2, mr[1] + 1, '#8a3424'),
      sheet(oval(32, hy + 2, mr[0], mr[1]), '#3a0a0a', { tilt: [0.55, 0.6] }),
      sheet(oval(32, hy + 2.8, mr[0] * 0.6, mr[1] * 0.6), '#0a0204', { tilt: [0.7, 0.7] }),
      specks([[30, hy + 1], [31, hy + 1]], '#d07a60'),
    );
    if (rear) {
      // mandibles spread wide, ready to close, their inner edges toothed
      out.push(...both64(limb(22, hy - 2, 12, hy - 5, 4, 3.2, jaw)), ...both64(limb(12, hy - 5, 7, hy + 2, 3.2, 2.2, jaw)),
        ...both64(limb(7, hy + 2, 9.6, hy + 8.4, 2.2, 1, gold)), ...both64(specks([[10, hy - 2], [9, hy], [8.5, hy + 2]], '#f0d090')));
    } else {
      out.push(...both64(limb(22, hy + 1, 15, hy + 6, 4, 3.2, jaw)), ...both64(limb(15, hy + 6, 18, hy + 11.6, 3.2, 2.2, jaw)),
        ...both64(limb(18, hy + 11.6, 24.6, hy + 12.6, 2.2, 1, gold)), ...both64(specks([[17.5, hy + 8], [19.5, hy + 10.5], [22, hy + 11.5]], '#f0d090')));
    }
    out.push(
      // compound eyes, dull and faceted, and the feathered feelers
      ball(22.6, hy - 4.4, 2.6, 2.2, '#3a1408'), ball(41.4, hy - 4.4, 2.6, 2.2, '#3a1408'),
      ball(22.6, hy - 4.4, 1.7, 1.4, '#d05a28', { glows: true }), ball(41.4, hy - 4.4, 1.7, 1.4, '#d05a28', { glows: true }),
      specks([[22, hy - 5], [23.5, hy - 4], [22.5, hy - 3.5], [40.75, hy - 5], [42, hy - 4], [41, hy - 3.5]], '#601e0a'),
      ...both64(limb(26, hy - 6, 21, hy - 13, 1, 0.8, leg)), ...both64(limb(21, hy - 13, 17, hy - 15, 0.8, 0.7, leg)),
      ...both64(ball(16.4, hy - 15.4, 2.6, 2, knee)),
      ...[0, 1, 2, 3].flatMap(i => both64(hair(23 - i * 1.5, hy - 10 - i * 1.5, 20.5 - i * 1.5, hy - 11 - i * 1.5, '#a87040'))),
    );
    // the fine detail: a ring of small teeth, the drool, pits in rows down each
    // wing case, flakes of rust coming away
    const teeth = [];
    // along the top and bottom of the rim only: a full ring of pale points
    // read as a gun-sight, not a mouth
    for (let a = 0; a < 24; a++) { if (a % 12 < 2 || a % 12 > 10) continue; const t = a / 24 * Math.PI * 2; teeth.push([32 + Math.cos(t) * (mr[0] - 1), hy + 2 + Math.sin(t) * (mr[1] - 1)]); }
    const pits = [];
    for (const f of [0.22, 0.42, 0.64, 0.84]) for (let y = 18; y <= 34; y += 2) {
      const w = 21.6 * Math.sqrt(Math.max(0, 1 - ((y - 31) / 16.8) ** 2)) * f;
      pits.push([32 - w, y], [32 + w, y]);
    }
    out.push(
      specks(teeth, '#d8c8a4'),
      // ridges down each wing case, following its curve
      ...[0.32, 0.53, 0.74].flatMap(f => [hair(32 - 21.6 * f * 0.55, 17 - sy, 32 - 21.6 * f, 36 - sy, '#6a2810'), hair(32 + 21.6 * f * 0.55, 17 - sy, 32 + 21.6 * f, 36 - sy, '#6a2810')]),
      ...pits.map(([x, y]) => specks([[x, y - sy]], '#5a2008')),
      specks([[17, 22], [44, 17], [50, 27], [27, 34]].map(([x, y]) => [x, y - sy]), verdLt),
      // drool hanging from the lip, not a rope down to the floor
      hair(30, hy + 3 + mr[1], 29, hy + 8 + mr[1], '#c89048'), hair(35, hy + 3 + mr[1], 36, hy + 6 + mr[1], '#c89048'), specks([[29, hy + 10 + mr[1]], [36, hy + 8 + mr[1]]], '#e0b060'),
      specks([[16, 63], [46, 63], [24, 62.5], [40, 62.75]], '#c06a30'),
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

  // A renegade dark elf, hired: the warrior's figure, but cast out of the
  // halls and dressed for it, in worn brown leather where the house wore
  // black mail, a weathered grey-green cloak, dull iron for its silver, and
  // eyes gone amber rather than red, so the hero knows it from its kin across
  // a dark room. Its hood is up, ears through it; it keeps its blades crossed
  // before it, watching the dark, and swings them up together to strike; told
  // to stay, it lets them fall to its sides.
  renegade: (pose = 'idle') => {
    const atk = pose === 'windup', hx = 32, hy = 10 + (atk ? 1 : 0), hood = '#4a5240', hoodDk = '#2a3024';
    const back = [sheet([[hx - 6.5, hy + 3], [hx - 7.5, hy - 4], [hx - 3, hy - 9.5], [hx + 3, hy - 9.5], [hx + 7.5, hy - 4], [hx + 6.5, hy + 3], [hx + 10, hy + 8], [hx - 10, hy + 8]], hoodDk, { curve: 1 })];
    // the hood's rim over the brow, framing the face
    const rim = [sheet([[hx - 5, hy + 1.5], [hx - 5.2, hy - 4], [hx - 2, hy - 7.5], [hx + 2, hy - 7.5], [hx + 5.2, hy - 4], [hx + 5, hy + 1.5], [hx + 3.8, hy - 2.4], [hx, hy - 4.4], [hx - 3.8, hy - 2.4]], hood, { curve: 0.8 }),
      hair(hx - 4.6, hy - 3.6, hx - 1.6, hy - 6.8, '#626a56')];
    const body = recolour(CREATURES.drow_warrior(atk ? 'windup' : pose === 'sit' ? 'idle' : 'special'), RENEGADE).map(p => (p.glows && p.c === '#ff3a34' ? { ...p, c: '#ffb648' } : p));
    return [...back, ...body, ...rim];
  },

  // A grey dwarf: short and very broad, bald, grey as the rock, an iron beard
  // in braids bound with copper, black mail to the knee and plate over it, and
  // a war hammer, a spike behind its head. Striking, it goes up over its head; working its spell of
  // growing, it flings its arms wide and the runes on its plate kindle.
  grey_dwarf: (pose = 'idle') => {
    const atk = pose === 'windup', swell = pose === 'special';
    const k = dwarfKit(), dy = atk ? 1 : 0;
    const fist = (x, y) => [ball(x, y, 3.2, 3, k.skin), hair(x - 1.6, y - 0.6, x + 1.6, y - 0.6, k.skinDk)];
    let arms;
    if (atk) arms = [limb(16, 27, 24, 14, 3.8, 3.2, k.mail), limb(48, 27, 40, 14, 3.8, 3.2, k.mail), ...warPick(32, 10, 0.55, -0.83, 13, k), ...fist(28, 12), ...fist(35, 9.5)];
    else if (swell) arms = [limb(16, 27, 7, 20, 3.8, 3.2, k.mail), ...fist(5.5, 18.5), limb(48, 27, 57, 20, 3.8, 3.2, k.mail), ...fist(58.5, 18.5), ...warPick(58.5, 18.5, 0.1, 1, 30, k)];
    else arms = [limb(16, 27, 13, 38, 3.8, 3.4, k.mail), ...fist(12.5, 41), limb(48, 27, 51, 37, 3.8, 3.4, k.mail), ...fist(51.5, 39.5), ...warPick(51.5, 39.5, 0.04, -1, 26, k)];
    // the runes cut in its plate, kindling as the working takes it
    const runes = swell ? [[24, 30, 27, 34], [27, 34, 24, 37], [40, 30, 37, 34], [37, 34, 40, 37], [32, 29, 32, 36]].map(([a, b, c2, d2]) => hair(a, b, c2, d2, '#ffb050', { glows: true })) : [];
    return [...dwarfBody(k, { dy }), ...runes, ...arms, ...dwarfHead(32, 12 + dy, k, { grim: atk || swell })];
  },
  // A grey dwarf arbalest: the same people under an iron helm, in leather over
  // mail, with a crossbow as long as itself, held across the body; loosing, it
  // comes up to the chest; taking careful aim, it comes up to the eye and its
  // bow points straight at you.
  dwarf_arbalest: (pose = 'idle') => {
    const atk = pose === 'windup', aim = pose === 'special';
    const k = dwarfKit(), wood = '#6a4a2c', woodDk = '#46301c', string = '#d8d0c0';
    const fist = (x, y) => [ball(x, y, 3, 2.8, k.skin), hair(x - 1.4, y - 0.6, x + 1.4, y - 0.6, k.skinDk)];
    let bow;
    if (aim) {
      // end on: the prod a wide arc across the face, the bolt's head at its heart, glinting
      bow = [limb(16, 27, 25, 24, 3.8, 3.2, k.mail), limb(48, 27, 39, 24, 3.8, 3.2, k.mail), ...fist(26, 23.5), ...fist(38, 23.5),
        ball(32, 21, 3.4, 3, woodDk), limb(14, 17, 32, 21, 1.4, 1.1, wood), limb(50, 17, 32, 21, 1.4, 1.1, wood), hair(14.5, 17.5, 49.5, 17.5, string),
        ball(32, 20.4, 1.4, 1.4, k.ironLt), specks([[31.5, 20]], '#ffffff')];
    } else if (atk) {
      // loosing: brought up to the chest, across the body
      bow = [limb(20, 27, 20, 31, 3.6, 3.2, k.mail), ...fist(21, 31), limb(44, 27, 44, 26, 3.6, 3.2, k.mail), ...fist(43, 26),
        limb(18, 34, 48, 23, 1.8, 1.5, wood), hair(19, 33, 47, 22.5, woodDk),
        limb(44, 16, 52, 30, 1.3, 1.3, wood), hair(44.5, 16.5, 51.5, 29.5, string), ball(48.4, 23, 1, 1, k.ironLt)];
    } else {
      // at rest: the crossbow upright on its left shoulder, the prod above its head
      bow = [limb(20, 27, 15, 36, 3.6, 3.2, k.mail), ...fist(14, 38), limb(44, 27, 47, 38, 3.6, 3.2, k.mail), ...fist(47.5, 40),
        limb(14, 40, 12, 6, 1.8, 1.5, wood), hair(13.4, 39, 11.4, 7, woodDk),
        limb(2, 9, 12, 5, 1.3, 1.1, wood), limb(22, 9, 12, 5, 1.3, 1.1, wood), hair(2.5, 9.5, 21.5, 9.5, string)];
    }
    // a quiver of bolts at the right hip
    const quiver = [sheet([[50, 34], [56, 34], [55, 52], [51, 52]], k.leather, { curve: 0.5 }), ...[51.5, 53, 54.5].map(x => limb(x, 34, x, 30, 0.5, 0.4, '#c8c0b0')), hair(50.5, 40, 55.5, 40, k.copper)];
    return [...quiver, ...dwarfBody(k, { narrow: true }), ...bow.slice(0, aim ? 4 : 6), ...dwarfHead(32, 12, k, { grim: atk || aim, helm: true }), ...bow.slice(aim ? 4 : 6)];
  },

  // A lizardfolk warrior: on its hind legs and as tall as a man, green-scaled
  // and crested, a spear in one hand and a turtle-shell shield on the other
  // arm, its tail out behind. Striking, the spear comes up; coiling to sweep,
  // the body turns and the tail swings round low in front, across its feet.
  lizardfolk: (pose = 'idle') => {
    const atk = pose === 'windup', sweep = pose === 'special';
    const k = lizardKit();
    const hand = (x, y) => [ball(x, y, 2.4, 2.2, k.scale), hair(x - 1.2, y + 1, x + 1.2, y + 1, k.scaleDk)];
    const spear = (x0, y0, x1, y1) => [limb(x0, y0, x1, y1, 0.9, 0.9, k.wood), sheet([[x1 - 1.6, y1 + 0.5], [x1, y1 - 5], [x1 + 1.6, y1 + 0.5]], k.boneDk), hair(x1 - 0.4, y1, x1, y1 - 4, k.bone)];
    const shield = (x, y) => [ball(x, y, 7, 8, k.shellDk), ball(x, y - 0.5, 6, 7, k.shell), ...[[0, -3], [-3, 1], [3, 1], [0, 4]].map(([dx, dy]) => ball(x + dx, y + dy, 2, 1.7, k.shellLt)), hair(x - 5, y - 4, x - 2, y - 6.5, '#c8c890')];
    let arms;
    if (atk) arms = [limb(43, 23, 48, 14, 3, 2.6, k.scale), ...hand(48.5, 12.5), ...spear(48.5, 30, 49, 0.5), limb(21, 23, 16, 30, 3, 2.6, k.scale), ...shield(14, 31)];
    else if (sweep) arms = [limb(21, 23, 13, 26, 3, 2.6, k.scale), ...shield(10, 26), limb(43, 23, 51, 28, 3, 2.6, k.scale), ...hand(52, 29), ...spear(52, 44, 56, 14)];
    else arms = [limb(43, 23, 47, 33, 3, 2.6, k.scale), ...hand(47.5, 35), ...spear(47.5, 56, 47.5, 9), limb(21, 23, 17, 32, 3, 2.6, k.scale), ...shield(15, 34)];
    // coiled to sweep: the tail swung round low across the front of its feet, the body leaning into it
    const tail = sweep ? [limb(44, 48, 50, 56, 4.4, 3.6, k.scale), limb(50, 56, 34, 60, 3.6, 2.6, k.scale), limb(34, 60, 14, 57, 2.6, 1.2, k.scale), hair(48, 55, 16, 57, k.scaleDk), specks([[40, 59], [28, 59], [20, 57.5]], k.scaleLt)] : [];
    return [...lizardBody(k, { tail: sweep ? 'none' : 'rest' }), ...arms, ...lizardHead(32, 11, k, { open: atk || sweep }), ...tail];
  },
  // A lizardfolk shaman: slighter, in a cloak of hanging reeds and a headdress
  // of bones, a staff hung with charms. Spitting fire, the staff comes forward;
  // chanting over its kin, both arms go up and green light gathers between them.
  lizard_shaman: (pose = 'idle') => {
    const atk = pose === 'windup', chant = pose === 'special';
    const k = lizardKit(), reed = '#6a7040', reedDk = '#4a5028';
    const hand = (x, y) => [ball(x, y, 2.1, 2, k.scale), hair(x - 1, y + 0.9, x + 1, y + 0.9, k.scaleDk)];
    const staff = (x0, y0, x1, y1) => [limb(x0, y0, x1, y1, 0.9, 0.8, k.wood), ball(x1, y1, 2.6, 2.4, k.bone), ball(x1 - 0.9, y1 - 0.3, 0.6, 0.6, '#1a1a10'), ball(x1 + 0.9, y1 - 0.3, 0.6, 0.6, '#1a1a10'), ...[-2.5, 2.5].map(d => limb(x1 + d, y1 + 2, x1 + d * 1.2, y1 + 6, 0.3, 0.3, k.boneDk))];
    let arms;
    if (atk) arms = [limb(43, 23, 47, 20, 2.8, 2.4, k.scale), ...hand(47.5, 19.5), ...staff(42, 34, 52, 6), limb(21, 23, 18, 32, 2.8, 2.4, k.scale), ...hand(17.5, 33.5)];
    else if (chant) arms = [limb(21, 23, 14, 12, 2.8, 2.4, k.scale), ...hand(13.5, 10.5), limb(43, 23, 50, 12, 2.8, 2.4, k.scale), ...hand(50.5, 10.5), ...staff(51, 30, 51, 4),
      ball(32, 4, 4.5, 3, '#a0e060', { glows: true }), ...[[24, 6], [40, 6], [32, 0.5]].map(([x, y]) => ball(x, y, 1, 1, '#d0ff90', { glows: true }))];
    else arms = [limb(43, 23, 46, 33, 2.8, 2.4, k.scale), ...hand(46.5, 34.5), ...staff(46.5, 58, 46.5, 6), limb(21, 23, 18, 33, 2.8, 2.4, k.scale), ...hand(17.5, 34.5)];
    // the reed cloak over the shoulders and down the back, and the headdress: a beast's skull worn over its own
    const cloak = [sheet([[17, 17], [47, 17], [55, 59], [46, 61], [32, 59], [18, 61], [9, 59]], reedDk, { curve: 0.8 }), ...[12, 16, 20, 24, 28, 36, 40, 44, 48, 52].map(x => hair(x + (x < 32 ? 3 : -3) * 0.5, 18, x + (x - 32) * 0.2, 60, reed))];
    const headdress = [sheet([[25, 3], [39, 3], [41, 8], [32, 10], [23, 8]], k.bone, { curve: 0.6 }), ball(28.5, 6, 1.2, 1, '#1a1a10'), ball(35.5, 6, 1.2, 1, '#1a1a10'),
      ...[-1, 1].map(sd => limb(32 + sd * 6, 4, 32 + sd * 11, -0.5, 0.8, 0.3, k.boneDk))];
    return [...cloak, ...lizardBody(k, { tail: 'rest' }).filter(p => p.c !== k.hide && p.c !== k.hideDk), ...arms, ...lizardHead(32, 12, k, { open: atk }), ...headdress];
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
    const rap = pose === 'windup', sit = pose === 'sit', heal = pose === 'heal';
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
    } else if (heal) {
      // tending: the staff leant in the crook of the left arm, both hands held out
      // and cupped, a warm green light gathering over them as the wound knits
      arms = [
        ...staff(23, 62, 13, 6),
        limb(22, 19, 23.5, 30, 2, 1.8, robe), limb(23.5, 30, 28.6, 33, 1.8, 1.6, robe),
        limb(42, 19, 40.5, 30, 2, 1.8, robe), limb(40.5, 30, 35.4, 33, 1.8, 1.6, robe),
        ...hand(29.2, 32.6), ...hand(34.8, 32.6),
        ball(32, 28.6, 4.4, 4.2, '#b8e890', { glows: true }), ball(32, 28.6, 2.1, 2, '#fffbe0', { glows: true }),
        specks([[27.5, 24], [36.5, 23.4], [30, 20.6], [34.6, 19.2], [26.4, 28], [37.6, 28.4], [32, 17]], '#d8ffb0', { glows: true }),
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
      ...(heal ? [hair(hx - 2.75, hy + 1.25, hx - 1.25, hy + 1.25, '#2a2020'), hair(hx + 1.25, hy + 1.25, hx + 2.75, hy + 1.25, '#2a2020')] : [dots([[Math.floor(hx - 2), Math.floor(hy + 1)], [Math.floor(hx + 1), Math.floor(hy + 1)]], '#2a2020')]),
      limb(hx, hy + 1.2, hx + 0.2, hy + 3, 0.5, 0.7, skinDk),
      hair(hx - 1.5, hy + 4, hx - 0.5, hy + 4.5, rap ? '#5a2a20' : '#8a4a3a'), hair(hx - 0.5, hy + 4.5, hx + 1.5, hy + 4, rap ? '#5a2a20' : '#8a4a3a'),
      specks([[hx - 2.25, hy + 2.75], [hx + 2.25, hy + 2.75]], '#e0a088'),
      hair(hx - 3.5, hy - 6.5, hx - 6.5, hy + 4, '#465640'),
    ];
    return [...body, ...arms, ...head];
  },
  // The freed goblin at your heel: wiry and ribby under a hooded rag of a
  // mantle chewed ragged at the hem, a loincloth and a cord belt with its ring
  // of picks and a key, the manacle it came in with still on one wrist and a
  // stub of chain, and a short knife with a kink in the blade. Standing, the
  // knife held low; lunging, it drives the knife up at you, the chained arm flung
  // back; told to stay, it squats on its heels, the knife pushed through the belt.
  scrag: (pose = 'idle') => {
    const skin = '#72ac4c', skinLt = '#8cc466', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c', ragDk = '#5a4c3c', cloth = '#6a5c4a', cord = '#4a3a28';
    const iron = '#6e727c', ironLt = '#a8acb4', brass = '#c9a24a', steel = '#c0c4cc', grip = '#6a4a2a';
    const stab = pose === 'windup', sit = pose === 'sit';
    const hx = stab ? 33 : 32, hy = stab ? 34 : sit ? 34.4 : 29.6;
    // how far the body has dropped: a long way for the lunge, a little to squat
    const D = stab ? 4.4 : sit ? 4.8 : 0, B = 47.2 + D;
    // the rag: a hooded mantle over the shoulders, short enough to show the ribs, chewed ragged at the hem
    const mantle = [
      sheet([[24, 36 + D], [40, 36 + D], [44.8, 38.4 + D], [46.4, 42.4 + D], [43.6, 41 + D], [41.6, 42.4 + D], [38.8, 40.2 + D], [36, 41.6 + D],
        [32.8, 39.8 + D], [29.6, 41.6 + D], [26.4, 40.2 + D], [23.2, 42.4 + D], [20.4, 41 + D], [17.6, 42.4 + D], [19.2, 38.4 + D]], rag, { curve: 1 }),
      ...[[22, 39], [27, 38.4], [37, 38.4], [42, 39]].map(([x, y]) => hair(x, y + D, x + 0.5, y + 2 + D, ragDk)),
      ...[[23, 42.2], [29.5, 41.4], [36, 41.4], [41.5, 42.2]].map(([x, y]) => hair(x, y + D, x + 0.25, y + 1.75 + D, rag)),
      specks([[26, 39 + D], [27, 40 + D], [28, 39 + D], [29, 40 + D]], '#a89a82'),
    ];
    // the ring of picks and a key, hung at the belt
    const kx = sit ? 31 : 37, ky = B + 3;
    const picks = [
      hair(kx - 1.6, ky + 1.2, kx - 3.2, ky + 6, '#9aa0aa'), hair(kx - 0.4, ky + 1.6, kx - 0.8, ky + 6.8, '#9aa0aa'),
      limb(kx + 2, ky + 2, kx + 2.8, ky + 6, 0.5, 0.5, brass), specks([[kx + 3, ky + 5], [kx + 4, ky + 5], [kx + 4, ky + 6]], brass),
      ball(kx, ky, 2.4, 2.4, brass), ball(kx, ky, 1.2, 1.2, '#2a1e14'),
    ];
    // an iron cuff across the wrist at (x, y), its band running along (u, v),
    // and what is left of its chain: links face on and edge on, the last sprung open
    const cuff = (x, y, u, v, links) => [
      ...links.map(([lx, ly], i) => (i % 2 ? limb(lx, ly - 1.2, lx, ly + 1.2, 0.8, 0.8, '#585c66') : ball(lx, ly, 1.6, 1.7, iron))),
      ...links.map(([lx, ly], i) => (i % 2 ? hair(lx, ly - 1, lx, ly, ironLt) : specks([[lx, ly]], '#1c1a22'))),
      hair(links[links.length - 1][0] - 1, links[links.length - 1][1] + 1, links[links.length - 1][0] - 2, links[links.length - 1][1] + 2, iron),
      limb(x - u, y - v, x + u, y + v, 1.8, 1.8, iron), hair(x - u, y - v - 1, x + u * 0.6, y + v * 0.6 - 1, '#c8ccd4'),
    ];
    // a short knife with a kink in the blade, from the fist at (x, y) along (u, v)
    const knife = (x, y, u, v) => [
      limb(x + u * 1.8, y + v * 1.8, x + u * 6.4, y + v * 6.4, 1.3, 1.1, steel, { smooth: 1 }),
      limb(x + u * 6.4, y + v * 6.4, x + u * 8.8 + v * 1.2, y + v * 8.8 - u * 1.2, 1.1, 0.5, steel, { smooth: 1 }),
      hair(x + u * 2.4 - v * 0.6, y + v * 2.4 + u * 0.6, x + u * 6.4 - v * 0.6, y + v * 6.4 + u * 0.6, '#f4f6fa'),
      limb(x - u * 0.6, y - v * 0.6, x + u * 1.6, y + v * 1.6, 0.9, 0.9, grip),
    ];
    /** a hand: the fist, the knuckles, fingers curled */
    const hand = (x, y, open) => [ball(x, y, 2.6, 2.4, skin), ...(open ? [-1, 0, 1].map(d => limb(x + d * 1.3, y + 1.6, x + d * 1.6, y + 3.8, 0.55, 0.4, skin)) : [hair(x - 1.5, y - 0.5, x + 1.5, y - 0.5, dark)]),
      specks([[x - 1, y - 1.5], [x + 1, y - 1.5]], skinLt)];
    /** a leg from the hip, through a knobbly knee, to a long bare foot with its toes */
    const leg = (hx2, hy2, kx2, ky2, fx, fy, toe) => [
      limb(hx2, hy2, kx2, ky2, 2.2, 1.8, dark), ball(kx2, ky2, 2.2, 2, dark), limb(kx2, ky2, fx, fy, 1.8, 1.5, dark),
      limb(fx, fy + 0.6, fx + toe * 4.6, fy + 1.6, 1.7, 1.2, foot), specks([[fx + toe * 4.6, fy + 2.25], [fx + toe * 3.4, fy + 2.5], [fx + toe * 2.2, fy + 2.5]], '#e8e0c0'),
    ];
    // the wiry body: ribs showing, a pot of a belly, the loincloth and belt
    const body = [
      limb(32, 33 + D, 32, 38 + D, 2.2, 2.6, dark),
      ball(32, 45.2 + D, 6.4, 7.2, skin), ball(32, 48 + D, 4.6, 3.2, skinLt),
      ...[41.5, 43.6, 45.7].flatMap(y => [hair(26.5, y + D, 30.5, y - 0.5 + D, dark), hair(37.5, y + D, 33.5, y - 0.5 + D, dark)]),
      sheet([[25.6, B], [38.4, B], [37.6, B + 6], [35.2, B + 4.4], [32.8, B + 6.8], [30, B + 4.4], [26.8, B + 5.6]], cloth, { curve: 0.8 }),
      hair(28, B + 1, 28.5, B + 4.5, '#4a3e30'), hair(35, B + 1, 34.5, B + 4.5, '#4a3e30'),
      limb(24, B, 40, B, 0.8, 0.8, cord), hair(25, B - 0.75, 39, B - 0.75, '#6a5a44'),
      ...picks,
    ];
    let parts;
    if (stab) {
      parts = [
        ...leg(29.2, 52.8, 21.2, 55.6, 19.6, 60.4, -1), ...leg(35.2, 52.8, 43.2, 55.2, 44.8, 60.4, 1),
        ...body,
        // the chained arm flung back for balance, the knife driven up at you
        limb(24.4, 42.8, 19, 45.6, 1.9, 1.7, skin), ball(19, 45.6, 1.7, 1.6, skin), limb(19, 45.6, 14, 47.6, 1.7, 1.5, skin),
        limb(39.6, 42.8, 45, 41, 1.9, 1.7, skin), ball(45, 41, 1.7, 1.6, skin), limb(45, 41, 50.4, 38.8, 1.7, 1.5, skin),
        ...mantle,
        ...cuff(16, 46.6, 0.9, 2.1, [[13.6, 50.4], [12, 53], [10.4, 55.6]]),
        ...hand(12.6, 48.4, true),
        ...knife(52, 37.6, 0.6, -0.8),
        ...hand(52, 37.6, false),
      ];
    } else if (sit) {
      parts = [
        // on its heels, knees out wide and feet together under it
        ...both64(limb(18, 52.4, 25.2, 60, 2, 1.7, dark)), ...both64(ball(25.6, 60.8, 3.8, 1.8, foot)), ...both64(specks([[23, 61.5], [24.5, 62], [26, 62]], '#e8e0c0')),
        ...body,
        ...both64(limb(28, 55.2, 18.4, 52, 2.4, 2.2, dark)), ...both64(ball(18, 51.6, 2.8, 2.6, dark)),
        // the knife pushed through the belt, only the grip showing
        limb(36.4, B - 3.2, 38, B + 1.2, 1.1, 1.1, grip), ball(36, B - 4, 1, 1, brass),
        ...both64(limb(24, 42.8, 20.6, 46.4, 1.9, 1.7, skin)), ...both64(ball(20.6, 46.4, 1.7, 1.6, skin)), ...both64(limb(20.6, 46.4, 18.4, 49.2, 1.7, 1.5, skin)),
        ...mantle,
        ...cuff(19.6, 47.8, 1.8, 1.4, [[15.2, 49.6], [14.2, 52.4], [13.6, 55.2]]),
        ...hand(18, 49.8, false), ...hand(46, 49.8, false),
      ];
    } else {
      parts = [
        ...leg(28.8, 50, 24.4, 55.2, 25.6, 60.4, -1), ...leg(35.2, 50, 39.6, 55.2, 38.4, 60.4, 1),
        ...body,
        limb(24.4, 39.6, 22.4, 43.6, 1.9, 1.7, skin), ball(22.4, 43.6, 1.7, 1.6, skin), limb(22.4, 43.6, 21.2, 46.8, 1.7, 1.5, skin),
        limb(39.6, 39.6, 41.6, 43.6, 1.9, 1.7, skin), ball(41.6, 43.6, 1.7, 1.6, skin), limb(41.6, 43.6, 43.2, 47, 1.7, 1.5, skin),
        ...mantle,
        ...cuff(21.6, 45.2, 2.1, -0.3, [[17.2, 47.6], [16.8, 50.4], [16.6, 53.2]]),
        ...hand(20.8, 48.4, true),
        // the knife held low, point down and out
        ...knife(43.2, 48.4, 0.45, 0.9),
        ...hand(43.2, 48.4, false),
      ];
    }
    return [
      ...parts,
      ...scragHead(hx, hy, { look: stab ? 0 : sit ? -1 : 1, mouth: stab ? 'teeth' : 'grin' }),
      // grime on the knees and the belly, a scar down the ribs
      specks([[27, 38 + D], [36, 38.5 + D], [30, 50 + D], [34.5, 50.5 + D]], '#a89a82'), hair(35.5, 42 + D, 37, 46.5 + D, '#a8d080'),
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

  // A squat, heavy beast like a boar, under a mantle of long quills banded
  // dark and pale. Coarse bristled hide on a deep chest, small mean eyes sunk
  // under the brow, a snout like a stopper, tusks, legs hardly longer than
  // hooves. Roused, the quills stand straight out all round it in a bristling
  // crown; about to gore, its head goes down and the tusks come up and forward.
  quillback: (pose = 'idle') => {
    const hide = '#5e4a3a', hideLt = '#76604c', dark = '#3a2c24', quill = '#2c2630', quill2 = '#3e3440', mantle = '#2e2830', tip = '#e2d8ba', band = '#8a7e6a',
      snout = '#9a7466', tusk = '#f0e8d0', hoof = '#221a18';
    const bristle = pose === 'special', gore = pose === 'windup';
    const hy = gore ? 48 : 43;    // the head
    const my = gore ? 33 : 36;    // the crown of the mantle
    // the quills, from the mantle outward: [angle, length]. At rest they lie
    // back along it and show short; raised, they stand out their full length
    const n = bristle ? 36 : gore ? 20 : 26, a0 = bristle ? -204 : gore ? -162 : -174, a1 = bristle ? 24 : gore ? -18 : -6;
    const rake = Array.from({ length: n }, (_, i) => {
      const a = a0 + (a1 - a0) * i / (n - 1), mid = 1 - Math.abs(i / (n - 1) - 0.5) * 1.2;
      return [a, (bristle ? 22 : gore ? 12 : 11) * (0.75 + 0.25 * mid) + ((i * 7) % 5 - 2) * (bristle ? 1.2 : 0.6)];
    });
    /** @param {number[]} q  [angle, length] @param {number} i @param {boolean} back */
    const quillAt = (q, i, back) => {
      const [a, len] = q, t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t);
      const bx = 32 + dx * 17, by = my + 2 + dy * 9;
      const l = back ? len : len * 0.72, sway = back ? 0 : (i % 2 ? 0.08 : -0.08);
      const ex = bx + (dx + sway) * l, ey = by + dy * l, f = 0.8, mx = bx + (dx + sway) * l * f, mY = by + dy * l * f;
      const bnd = 0.45, bX = bx + (dx + sway) * l * bnd, bY = by + dy * l * bnd;
      return [limb(bx, by, mx, mY, back ? 1.2 : 1, 0.6, back ? quill : quill2), limb(mx, mY, ex, ey, 0.6, 0.3, tip),
        hair(bX, bY, bX + (dx + sway) * 1.5, bY + dy * 1.5, band)];
    };
    /** @type {object[]} */
    const out = [
      // the long quills behind, the shorter row in front of them
      ...rake.flatMap((q, i) => quillAt(q, i, true)),
      ...rake.filter((_, i) => i % 2).map(([a, l]) => [a + (bristle ? 4 : 5), l]).flatMap((q, i) => quillAt(q, i, false)),
      // the hind legs, stubby and set wide, split hooves
      ...both64(limb(16, 48, 14, 59, 4.2, 3.8, dark)), ...both64(ball(14, 60.6, 4.6, 2, hoof)), ...both64(hair(14, 59, 14, 62.5, '#5a4838')),
      // the body under its mantle: a deep chest, coarse bristled hide
      ball(32, 44, 21, 13.6, hide), ball(32, 50, 14, 6, hideLt),
      ball(32, my + 3, 21.6, 11.2, mantle),
      // quills laid over the mantle in rows, pointing back and up, banded
      ...[0, 1, 2, 3].flatMap(row => Array.from({ length: 15 - row * 2 }, (_, i) => {
        const x = 14 + i * 2.5 + row * 2.5 + ((i * 7 + row * 3) % 5 - 2) * 0.3, y = my + 11 - row * 3.2 + (i % 3) * 0.6, lean = (x - 32) * 0.3;
        const up = (bristle ? 9 : 6.4) + (i + row) % 3 * 1.2;
        return [limb(x, y, x + lean, y - up, 0.8, 0.4, (i + row) % 2 ? '#241e28' : quill2), hair(x + lean * 0.5, y - up * 0.5, x + lean * 0.55, y - up * 0.5 - 1, band)];
      })).flat(),
      // forelegs, short and thick, braced out when it lowers its head
      ...(gore
        ? [...both64(limb(23, 50, 20, 59.6, 4.6, 4, hide)), ...both64(ball(19.6, 60.8, 4.8, 2, hoof)), ...both64(hair(19.6, 59.5, 19.6, 62.75, '#5a4838'))]
        : [...both64(limb(24, 50, 23, 59.6, 4.4, 4, hide)), ...both64(ball(22.6, 60.8, 4.6, 2, hoof)), ...both64(hair(22.6, 59.5, 22.6, 62.75, '#5a4838'))]),
      // coarse bristles over the chest and shoulders
      ...[[16, 46], [19, 49], [22, 51], [42, 51], [45, 49], [48, 46], [27, 53], [37, 53], [32, 55]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.75 : 0.75), y + 3, '#2a201a')),
      // small ears poking out of the quills
      ...both64(sheet([[23, hy - 5], [18, hy - 11], [27, hy - 7.6]], hide, { tilt: [-0.4, -0.2] })), ...both64(sheet([[23.4, hy - 5.6], [20, hy - 9.6], [26, hy - 7.2]], '#8a6a5a')),
      // the head, square on: a broad skull, jowls, a snout like a stopper
      ball(32, hy, 10.8, 8, hide), ...both64(ball(25, hy + 4, 4.4, 4, hide)), ball(32, hy - 4, 9.6, 2.8, '#4a3a2e'),
      ball(32, hy + 6.4, 6, 4.2, snout), ball(32, hy + 6, 4.4, 2.8, '#b08878'),
      ball(30, hy + 6.6, 1, 0.9, '#2a1614'), ball(34, hy + 6.6, 1, 0.9, '#2a1614'), specks([[29.5, hy + 5.25], [33.5, hy + 5.25]], '#d0a898'),
      // small, mean, red, sunk under the brow
      ball(26.6, hy - 1.4, 2.4, 1.6, '#1c1010'), ball(37.4, hy - 1.4, 2.4, 1.6, '#1c1010'),
      ball(27, hy - 1.4, 1.1, 0.9, '#ff3a1c', { glows: true }), ball(37, hy - 1.4, 1.1, 0.9, '#ff3a1c', { glows: true }), specks([[26.5, hy - 2], [36.5, hy - 2]], '#ffb0a0'),
      limb(22.6, hy - 4.6, 29.6, hy - 2.6, 1.2, 0.8, dark), limb(41.4, hy - 4.6, 34.4, hy - 2.6, 1.2, 0.8, dark),
      // the mouth, a scar across the brow, bristles on the snout, spit at the tusks
      hair(25, hy + 9, 39, hy + 9, '#2a1614'), hair(27, hy - 5, 31, hy - 2.5, '#7a6250'),
      specks([[29, hy + 3.5], [35, hy + 3.5], [32, hy + 3], [26, hy + 6], [38, hy + 6]], '#6a5040'),
      specks([[25, hy + 11], [39, hy + 10]], '#c8d0d8'),
    ];
    // tusks up out of the corners of the mouth; brought forward to gore, they
    // curve out wide and long
    const tk = gore ? [25, hy + 9, 17, hy + 3, 15, hy - 5] : [25.6, hy + 8.4, 21.6, hy + 5, 21, hy + 0.4];
    const [x1, y1, x2, y2, x3, y3] = tk;
    out.push(...both64(limb(x1, y1, x2, y2, gore ? 2.2 : 1.8, gore ? 1.6 : 1.4, tusk)), ...both64(limb(x2, y2, x3, y3, gore ? 1.6 : 1.4, 0.6, tusk)),
      ...both64(hair(x1 - 0.5, y1 - 1, x2 - 0.5, y2 - 1, '#c8bca0')));
    return out;
  },

  // A cave wyrm, square on: a long low body heavy with muscle, scaled in rows
  // of dark red with a pale plated belly, legs bowed out at the elbow like a
  // crocodile's, a ridge of spines over the shoulders, and the neck up out of
  // them to a long head, horns swept back and smoke curling from the nostrils.
  // Winding up, the neck coils back to strike and the jaws part; rearing, it
  // lifts its forelegs, claws out, and the throat glows like a furnace.
  wyrm: (pose = 'idle') => {
    const hide = '#8a3622', dark = '#5a2016', deep = '#3e140c', scale = '#a44428', belly = '#c8966a', bellyDk = '#a87a52', horn = '#dccaa0', hornDk = '#a8987a', claw = '#efe4c8';
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 29 : 32, hy = rear ? 12 : coil ? 25 : 21;    // the head
    const cy = rear ? -3 : coil ? -1.5 : 0;                         // how high the shoulders ride
    const arc = (x, y, c = deep) => [hair(x - 1.25, y, x, y + 0.75, c), hair(x, y + 0.75, x + 1.25, y, c)];
    /** @type {object[]} */
    const out = [
      // the tail, round the front of it on the floor, its tip curled up
      limb(44, 51, 54, 57, 5, 4, dark), limb(54, 57, 60, 52, 4, 2.6, dark), limb(60, 52, 59.5, 45, 2.6, 1.2, dark), limb(59.5, 45, 57, 42, 1.2, 0.5, dark),
      ...[[48, 54], [52, 56], [56, 56], [59, 50], [59.5, 46.5]].flatMap(([x, y]) => arc(x, y)),
      ...[[51, 53], [56, 53.5], [58, 48]].map(([x, y]) => sheet([[x - 1, y], [x + 0.5, y - 2.4], [x + 1.2, y]], horn)),
      // the hind feet, planted behind, toes splayed
      ...both64(limb(19, 47, 17, 58, 4.8, 4, dark)), ...both64(ball(16.6, 60, 5.4, 2.2, dark)),
      ...both64(specks([[12.5, 62], [15, 62.5], [18, 62.5], [20.5, 62]], claw)),
      // a ridge of spines down the back, over the shoulders behind the neck
      ...[[-160, 4.4], [-142, 6.4], [-124, 8], [-112, 7], [-68, 7], [-56, 8], [-38, 6.4], [-20, 4.4]].map(([a, h]) => {
        const t = a * Math.PI / 180, dx = Math.cos(t), dy = Math.sin(t), bx = 32 + dx * 18, by = 39 + cy + dy * 9;
        return sheet([[bx - dy * 2, by + dx * 2], [bx + dx * h, by + dy * h], [bx + dy * 2, by - dx * 2]], horn, { tilt: [dx * 0.5, dy * 0.5] });
      }),
      // the long barrel of the body, low to the floor, the flanks heavy with muscle
      ball(32, 44 + cy * 0.5, 22, 12.6, hide), ball(22, 41 + cy * 0.6, 8, 6, scale), ball(42, 41 + cy * 0.6, 8, 6, scale),
      ball(32, 51 + cy * 0.5, 16, 4, dark),
    ];
    // the forelegs, bowed out at the elbow like a crocodile's, or lifted, claws out, as it rears
    if (rear) {
      out.push(
        ...both64(ball(14, 39 + cy, 7.4, 6.6, scale)), ...both64(ball(12, 37 + cy, 3.6, 2.6, '#b85438')),
        ...both64(limb(14, 39 + cy, 5, 31, 5.4, 4.2, scale)), ...both64(ball(5, 31, 3.4, 3.2, hide)), ...both64(limb(5, 31, 8.6, 21.4, 4, 3.2, scale)),
        ...both64(ball(8.6, 20.4, 4.2, 3.4, dark)),
        ...both64(limb(6.4, 18.6, 4.6, 15, 1.2, 0.4, claw)), ...both64(limb(8.6, 17.8, 8.8, 14, 1.2, 0.4, claw)), ...both64(limb(10.8, 18.6, 12.8, 15.4, 1.2, 0.4, claw)),
        ...both64(hair(7, 28, 8, 23, deep)), ...both64(hair(11, 35, 7, 32, deep)),
      );
    } else {
      const w = coil ? 1.6 : 0;    // braced wider for the bite
      out.push(
        ...both64(ball(14 - w * 0.5, 41 + cy, 7.6, 6.8, scale)), ...both64(ball(12 - w * 0.5, 39 + cy, 3.6, 2.6, '#b85438')),
        ...both64(limb(14 - w * 0.5, 41 + cy, 6 - w, 49, 5.6, 4.6, scale)), ...both64(ball(6 - w, 49, 3.6, 3.4, hide)),
        ...both64(limb(6 - w, 49, 9.6 - w, 58, 4.6, 3.8, scale)),
        ...both64(ball(9.6 - w, 59.6, 5.8, 2.8, dark)),
        ...both64(limb(6.6 - w, 60, 3.6 - w, 62.4, 1.2, 0.5, claw)), ...both64(limb(9.6 - w, 60.6, 9.6 - w, 63, 1.2, 0.5, claw)), ...both64(limb(12.6 - w, 60, 15.2 - w, 62.4, 1.2, 0.5, claw)),
        ...both64(hair(8.5 - w, 47, 12 - w, 44, deep)), ...both64(hair(7 - w, 52, 8.5 - w, 56, deep)),
      );
    }
    // the pale plated chest, and the neck up out of it: coiled back on itself to strike
    out.push(ball(32, 49 + cy * 0.5, 11.2, 8, belly), ...[46, 49, 52, 55].map(y => hair(23.5 + (y - 46) * 0.4, y + cy * 0.5, 40.5 - (y - 46) * 0.4, y + cy * 0.5, bellyDk)));
    if (coil) {
      out.push(limb(32, 42, 37.5, 35, 9.2, 8, hide), limb(37.5, 35, hx, hy + 4, 8, 7, hide),
        ...[[36, 39], [37.5, 35.5], [35, 31.5]].map(([x, y]) => hair(x - 4.5, y, x + 4.5, y - 0.5, bellyDk)));
    } else {
      out.push(limb(32, 42 + cy, hx, hy + 4, 9.2, 7.2, hide), ball(hx, hy + 13, 4.4, 9, belly));
      out.push(...[34, 31, 28].map(y => hair(hx - 3.5, y + cy * 0.3 - (rear ? 8 : 0), hx + 3.5, y + cy * 0.3 - (rear ? 8 : 0), bellyDk)));
      if (rear) out.push(limb(32, 41 + cy, hx, hy + 9, 3.2, 2.6, '#f09050', { glows: true }));
    }
    // scales in rows over the shoulders, flanks and neck
    for (let r = 0; r < 3; r++) for (let x = 16 + (r % 2) * 2.5; x <= 48; x += 5) {
      const y = 36 + r * 3 + cy * 0.5;
      if (Math.abs(x - 32) < 12 && y > 38) continue;
      out.push(...arc(x, y, '#6a2618'));
    }
    // the horns, swept back and up, ringed, and a spur at each hinge of the jaw
    out.push(
      ...[1, -1].flatMap(s => [
        limb(hx - s * 7.4, hy - 3.4, hx - s * 14.6, hy - 9.4, 2.6, 1.8, horn), limb(hx - s * 14.6, hy - 9.4, hx - s * 19.6, hy - 11.4, 1.8, 0.7, horn),
        hair(hx - s * 10, hy - 6.5, hx - s * 11, hy - 4.75, hornDk), hair(hx - s * 13.5, hy - 9.5, hx - s * 14.5, hy - 7.75, hornDk),
        limb(hx - s * 3.6, hy - 5, hx - s * 6, hy - 12, 1.6, 0.6, horn),
        limb(hx - s * 8.6, hy + 2.4, hx - s * 15, hy + (rear ? -1 : 2), 1.6, 0.6, horn),
      ]),
      // a long head: a broad skull narrowing to the snout, the cheeks plated
      ball(hx, hy, 9.4, 6.4, hide), ...[-1, 1].map(s => ball(hx + s * 6, hy + 2, 3.6, 3.4, scale)), ball(hx, hy - 3.6, 5.4, 2, '#9a3e26'),
    );
    const ey = hy - 1;
    if (rear) {
      // the jaws wide, the throat a furnace: the fire is not lit by anything, it is the light
      out.push(
        ball(hx, hy + 10, 8, 7.4, '#5a1a10'), sheet(oval(hx, hy + 10, 6.4, 6), '#e8641a', { tilt: [-0.4, -0.6], glows: true }),
        ball(hx, hy + 10.6, 4.6, 4.2, '#ffb030', { glows: true }), ball(hx, hy + 10.6, 2.8, 2.6, '#ffe070', { glows: true }), ball(hx, hy + 10.4, 1.2, 1.4, '#fff8d8', { glows: true }),
        limb(hx, hy + 1, hx, hy + 3.6, 7.4, 6.6, scale), ...[-1, 1].map(s => ball(hx + s * 3.2, hy + 3.6, 2.2, 1.8, scale)),
        ball(hx, hy + 18.4, 6.8, 2.4, scale),
        ...[[-6, 5.6], [6, 5.6], [-4, 5.2], [4, 5.2]].map(([d, y]) => limb(hx + d, hy + y, hx + d * 0.9, hy + y + 2, 0.7, 0.2, '#f4ecd4')),
        ...[[-5.5, 17], [5.5, 17], [-3, 17.4], [3, 17.4]].map(([d, y]) => limb(hx + d, hy + y, hx + d * 0.9, hy + y - 2, 0.7, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.3, '#ffd040', { glows: true }), ball(x, ey, 0.9, 0.8, '#fff8c0', { glows: true })]),
        specks([[hx - 8, hy - 2], [hx + 9, hy - 4], [hx - 4, hy - 8], [hx + 5, hy - 10], [hx - 11, hy + 6], [hx + 12, hy + 5], [hx - 2, hy - 13], [hx + 7, hy - 16]], '#ffd060', { glows: true }),
      );
    } else {
      const o = coil ? 2.8 : 0;    // how far the jaws part
      out.push(
        ball(hx, hy + 10.8 + o, 7, 2.6, dark),
        ...(coil ? [sheet([[hx - 6.4, hy + 8], [hx + 6.4, hy + 8], [hx + 5.2, hy + 12.8], [hx - 5.2, hy + 12.8]], '#3a0e0a'), ball(hx, hy + 11.6, 3, 1.2, '#a03028')] : []),
        limb(hx, hy + 1, hx, hy + 8.8, 7.6, 5.2, scale), ...[-1, 1].map(s => ball(hx + s * 2.6, hy + 8.8, 2, 1.6, scale)),
        ball(hx - 2, hy + 9.4, 0.8, 0.7, '#1a0806'), ball(hx + 2, hy + 9.4, 0.8, 0.7, '#1a0806'),
        ...(coil ? [[-5.5, 9.6, 1], [5.5, 9.6, 1], [-3.5, 13, -1], [3.5, 13, -1]] : [[-5.5, 10.4, 1], [5.5, 10.4, 1], [-3.6, 11.6, 0.6], [3.6, 11.6, 0.6]])
          .map(([d, y, s]) => limb(hx + d, hy + y, hx + d * 0.92, hy + y + s * 2, 0.7, 0.2, '#f4ecd4')),
        ...[hx - 5, hx + 5].flatMap(x => [ball(x, ey, 2.2, 1.2, '#ffb020', { glows: true }), limb(x, ey - 1, x, ey + 1, 0.4, 0.4, '#2a0c04'), specks([[x - 1, ey - 0.75]], '#fff0b0')]),
        // a curl of smoke from each nostril, and an old claw scar across the snout
        specks([[hx - 3, hy + 7.5], [hx - 4, hy + 6], [hx - 3.5, hy + 4.5], [hx + 3, hy + 7.5], [hx + 4, hy + 6], [hx + 4.5, hy + 4.5]], '#8a8078'),
        hair(hx + 1.5, hy + 1, hx + 4.5, hy + 6, '#c86a44'),
      );
    }
    // the brow ridges over the eyes, drawn down in anger, and the scales of the skull
    out.push(limb(hx - 9, ey - 2.6, hx - 2.4, ey - 0.6 + (coil ? 1 : 0), 1.6, 1.1, dark), limb(hx + 9, ey - 2.6, hx + 2.4, ey - 0.6 + (coil ? 1 : 0), 1.6, 1.1, dark),
      ...[[-3, -4.5], [0, -5.25], [3, -4.5], [-1.5, -3], [1.5, -3]].flatMap(([d, y]) => arc(hx + d, hy + y, '#6a2618')),
      specks([[hx - 6, hy + 3], [hx + 6.5, hy + 3.5], [hx - 7, hy + 1], [hx + 7.5, hy + 0.5]], '#c05a36'));
    for (const q of /** @type {any[]} */ (out)) if (q.k !== 'hair' && q.k !== 'specks') Object.assign(q, { smooth: 1 });
    return out;
  },
};

// Other pictures of a creature, painted from the same parts with a pose
// given: 'windup' while a blow is drawn back, 'special' while its own trick
// is readied. Without a 'special' the wind-up serves for both.
const POSES = { drow_warrior: ['windup', 'special'], drow_mage: ['windup', 'special'], grey_dwarf: ['windup', 'special'], dwarf_arbalest: ['windup', 'special'], lizardfolk: ['windup', 'special'], lizard_shaman: ['windup', 'special'], heartforged: ['windup'], emberling: ['windup'], kobold: ['windup'], mimic: ['windup'], basilisk: ['windup', 'special'], rustmaw: ['windup'], hound: ['windup', 'special'], quillback: ['windup', 'special'], wyrm: ['windup', 'special'], dog: ['windup', 'sit'], wolf: ['windup', 'sit'], scrag: ['windup', 'sit'], sellsword: ['windup', 'sit'], renegade: ['windup', 'sit'], mender: ['windup', 'sit', 'heal'], goblin: ['windup'], orc: ['windup'], archer: ['windup', 'special'], skeleton: ['windup'], ogre: ['windup'], minotaur: ['windup'], troll: ['windup'], rat: ['windup'], bat: ['windup'], slime: ['windup'], spider: ['windup'], zombie: ['windup'], ghoul: ['windup'], drowned: ['windup'], eyeless: ['windup'], puffcap: ['windup'], shade: ['windup'], wraith: ['windup', 'special'], warlord: ['windup'], acolyte: ['windup', 'special'], lich: ['windup', 'special'] };

// Props for encounters (see encounters.js): things you walk up to, drawn with
// the same painter so they sit in the same light as the creatures.
const PROPS = {
  // the dark elves' altar: a black block under a canopy of webs, a spider of
  // obsidian squatting on it with garnet eyes, bowls of dark wine before it
  spider_altar: () => {
    const stone = '#24202c', stoneLt = '#34303e', obs = '#141018', obsLt = '#3a3448', web = '#a8a0b8';
    return [
      // the web canopy behind, strung from the corners
      ...[[4, 4, 32, 20], [60, 4, 32, 20], [4, 30, 32, 20], [60, 30, 32, 20], [32, 2, 32, 20]].map(([a, b, c, d]) => hair(a, b, c, d, web)),
      ...[6, 10, 14].flatMap(r => oval(32, 20, r * 1.7, r, 10).map((pt, i, q) => hair(pt[0], pt[1], q[(i + 1) % q.length][0], q[(i + 1) % q.length][1], '#8a8298'))),
      // the altar: a black block with a silver line about its top
      sheet([[10, 44], [54, 44], [56, 62], [8, 62]], stone, { curve: 0.6 }), sheet([[12, 40], [52, 40], [54, 45], [10, 45]], stoneLt, { curve: 0.5 }),
      hair(12, 41, 52, 41, '#b8bccc'), hair(10, 50, 54, 50, '#1a1620'), specks([[11, 61], [53, 61], [14, 46], [50, 47]], '#0e0c12'),
      // the spider: abdomen, body, eight legs folded about it, garnet eyes
      ...[-1, 1].flatMap(sd => [[4, 30, 14, 22, 20, 38], [5, 33, 17, 30, 22, 40], [5, 35, 16, 38, 21, 41], [4, 37, 12, 44, 15, 41]].flatMap(([a, b, c, d, e, f]) => [
        limb(32 + sd * a, b, 32 + sd * c, d, 1.1, 0.9, obs), limb(32 + sd * c, d, 32 + sd * e, f, 0.9, 0.6, obs), hair(32 + sd * a, b - 0.7, 32 + sd * c, d - 0.7, obsLt)])),
      ball(32, 30, 8, 7, obs), ball(30, 27, 3, 2.4, obsLt), ball(32, 37.5, 5, 4, obs), ball(31, 36, 1.8, 1.2, obsLt),
      ball(30, 37.5, 1.2, 1, '#e8303a', { glows: true }), ball(34, 37.5, 1.2, 1, '#e8303a', { glows: true }), specks([[29.5, 37], [33.5, 37]], '#ffb0b0', { glows: true }),
      // the bowls of wine, a candle burning violet
      ...[[18, 46], [46, 46]].flatMap(([x, y]) => [ball(x, y, 4, 1.6, '#80868f'), ball(x, y - 0.4, 3, 0.9, '#4a0e24')]),
      limb(26, 47, 26, 42, 1, 0.9, '#d8d0e0'), sheet([[25.2, 41.6], [26, 37.6], [26.8, 41.6]], '#b070f0', { curve: 0.5, glows: true }),
    ];
  },
  // the Forge-Spirit: an anvil black with age on a stump of rock, and over it a fire
  // with no fuel, two eyes open in it, sparks rising
  forge_spirit: () => [
    // the stump of rock, cracked, soot up its sides
    ball(32, 57, 15, 5.6, '#4a3e38'), sheet([[19, 57.4], [21, 47], [43, 47], [45, 57.4]], '#5a4c44', { curve: 0.6 }),
    ball(26, 49, 5, 2, '#6a5a50'), hair(24, 49, 23, 56, '#3a302a'), hair(39, 48, 41, 56.5, '#3a302a'), hair(31, 50, 33, 55, '#3a302a'),
    specks([[22, 52], [27, 54], [36, 51], [42, 54], [33, 57]], '#2a2420'),
    // the anvil: waist, body, a face worn bright, the horn
    sheet([[27, 47.4], [37, 47.4], [35, 42], [29, 42]], '#2e3036', { curve: 0.3 }),
    sheet([[22, 42.4], [43, 42.4], [43.6, 37.2], [21, 37.2]], '#3a3c44', { curve: 0.5 }),
    limb(21.4, 38.8, 11, 39.6, 2.6, 0.5, '#3a3c44'), limb(43.4, 38.6, 47, 39.6, 1.6, 1, '#3a3c44'),
    limb(21, 37.2, 43.6, 37.2, 0.6, 0.6, '#8a8e98'), hair(23, 36.75, 42, 36.75, '#c8ccd4'),
    hair(25, 40, 30, 41, '#24262c'), specks([[34, 39], [38, 40.5], [27, 40.5]], '#5a5e66'),
    // the fire hanging over it: an outer flame, a hotter heart, eyes and a mouth in it
    sheet([[23, 35], [20.6, 26], [24.6, 20], [26, 12.4], [30, 17], [32.4, 6.8], [35.2, 16.4], [39, 11.6], [40, 20.8], [43.2, 26.4], [40.8, 35]], '#e8641c', { curve: 0.8, glows: true }),
    sheet([[26, 34.4], [25.2, 26.8], [28.4, 22], [32, 15.2], [35.2, 22], [38.4, 26.4], [38, 34.4]], '#ffa030', { curve: 0.8, glows: true }),
    sheet([[28.8, 34], [28.8, 28], [32, 23.2], [35.2, 28], [35.2, 34]], '#ffe080', { curve: 0.6, glows: true }),
    ball(28.4, 26.4, 1.8, 1.3, '#3a1006'), ball(35.6, 26.4, 1.8, 1.3, '#3a1006'), specks([[28, 26], [35.25, 26]], '#fff8d0'),
    sheet([[29.6, 30.4], [34.4, 30.4], [33.4, 32], [30.6, 32]], '#7a2a0a'),
    specks([[24, 9], [41, 7], [30, 3], [45, 14], [19, 16], [36, 1.5], [27, 5]], '#ffd060', { glows: true }),
    specks([[23, 38], [28, 38], [34, 38], [41, 38]], '#c8ccd4'),
  ],
  // a shaft in the floor, ringed with smooth stones, the Heart's red light welling up out of it
  heartwell: () => [
    ball(32, 52, 24, 9.2, '#4a3e38'), ball(32, 51.2, 20, 7.2, '#5e5048'),
    ...[[12, 50], [18, 45.2], [28, 43.6], [38, 43.6], [48, 45.2], [54, 50], [48, 56.8], [32, 59.2], [16, 56.8], [24, 58.4], [40, 58.4]].map(([x, y], i) => ball(x, y, 4.4 - (i % 3) * 0.4, 3.2, i % 2 ? '#6e6058' : '#7a6a60')),
    ...[[12, 50], [28, 43.6], [48, 45.2], [32, 59.2]].map(([x, y]) => hair(x - 2, y - 1.5, x + 1, y - 2.25, '#9a8a80')),
    // the mouth of the shaft, and the light in it, hotter as it goes down
    ball(32, 51.2, 15.2, 5.2, '#1a0806'), ball(32, 50.8, 11.2, 3.6, '#7a1c0c', { glows: true }), ball(32, 50.4, 6.8, 2.2, '#e05020', { glows: true }), ball(32, 50.2, 3.2, 1.2, '#ffc060', { glows: true }),
    // the warm light welling over the lip, and heat rising off it
    ball(32, 45.6, 14, 4.4, '#5a1c0e'), ball(32, 46.8, 8.8, 2.4, '#a83010', { glows: true }),
    hair(28, 42, 27, 34, '#7a2a14'), hair(36, 41, 37.5, 32, '#7a2a14'), hair(32, 40, 31.5, 30, '#6a2412'),
    // sparks drifting up out of it, thinning as they rise
    specks([[28, 40], [36, 38], [32, 34], [26, 30], [38, 28], [30, 24], [35, 20], [25, 21], [40, 17]], '#ffc060', { glows: true }),
    specks([[32, 12], [28, 9], [37, 8], [33, 4]], '#e8641c', { glows: true }),
    specks([[14, 49], [50, 49], [24, 44], [42, 44], [20, 57], [44, 57]], '#8a7a70'),
  ],
  // a wasted delver in the rags of a fine coat, hunched over a fire of bones
  lastdelver: () => {
    const coat = '#2a3a5a', coatDk = '#1e2a42', skin = '#c8a890', braid = '#c8a040';
    return [
      // the fire of bones, ash round it
      ball(43, 58.8, 10, 3.2, '#3a2a20'), ...[[37, 57.2], [43, 56], [49, 57.6], [40, 59], [46, 59.2]].map(([x, y]) => limb(x - 3, y, x + 3, y - 1.2, 1.1, 1, '#d8d0bc')),
      ball(46.4, 56, 1.6, 1.4, '#d8d0bc'), specks([[46, 56], [47, 56]], '#2a2420'),
      sheet([[37, 56.8], [39.2, 46], [42.4, 51], [44.4, 43], [47.2, 51.2], [49.2, 56.8]], '#e8641c', { curve: 0.6, glows: true }),
      sheet([[40.8, 56.4], [42.8, 50.4], [44.4, 47.6], [46, 51.2], [46.8, 56.4]], '#ffd060', { curve: 0.5, glows: true }),
      specks([[40, 41], [46, 39], [43, 36], [48, 34], [41, 32]], '#ffd060', { glows: true }),
      // the delver, hunched, knees up, a ragged coat that was blue once, its braid tarnished
      sheet([[11, 60], [14, 34], [20, 25], [29, 26], [33, 38], [32, 60]], coat, { curve: 1 }),
      sheet([[12, 60], [14, 42], [18, 60]], coatDk), sheet([[24, 44], [32, 40], [33, 60], [27, 60]], coatDk, { curve: 0.6 }),
      limb(18, 36, 28, 38, 0.6, 0.6, braid), limb(17.2, 43, 29.2, 44.8, 0.6, 0.6, braid), ...[[19, 36.5], [22, 37], [25, 37.5]].map(([x, y]) => specks([[x, y]], '#f0d070')),
      ...[[13, 58], [17, 59], [24, 59.5], [30, 59]].map(([x, y]) => hair(x, y, x + 0.5, y + 2.5, coatDk)),
      // knees drawn up under the coat, boots worn through
      ball(27, 47, 5, 4.6, coat), limb(29, 50, 31, 59, 2.6, 2.2, '#2a2420'), ball(32, 60.4, 3.4, 1.6, '#3a2e24'), specks([[33.5, 60]], '#c8a890'),
      // a thin hand held out to the fire, the fingers long
      limb(29, 40, 37.2, 45.2, 2, 1.6, coat), ball(38.4, 45.8, 2, 1.8, skin), ...[0, 1, 2].map(i => limb(39.5, 44.8 + i, 41.6, 44.4 + i * 1.3, 0.5, 0.4, skin)),
      hair(36, 44, 37, 45.5, '#e8d0b8'),
      // the head: matted grey hair, a gaunt face, eyes too bright
      ball(23.2, 21.6, 7.2, 7.6, '#9a9488'), ball(25.2, 23.2, 4.8, 5.6, skin), ball(26.6, 25.6, 2.6, 2, '#b89878'),
      ball(25.4, 21.6, 1.2, 0.9, '#ffe8a0', { glows: true }), ball(29, 21.6, 1, 0.8, '#ffe8a0', { glows: true }),
      hair(24, 20, 27, 20.25, '#5a4a40'), hair(28, 20.25, 30, 20, '#5a4a40'),
      limb(26.4, 27.6, 29, 27.4, 0.4, 0.4, '#5a3a30'), hair(23, 25, 24, 28, '#a88870'), hair(29, 24, 29.5, 27, '#a88870'),
      hair(18, 17, 16, 27, '#7a746a'), hair(21, 15.2, 19.2, 25, '#b8b2a6'), hair(25, 14.5, 27, 18, '#b8b2a6'), hair(19.5, 18, 18.5, 30, '#8a847a'),
      specks([[27, 29], [25, 29.5], [29, 28.75]], '#9a9488'),
    ];
  },
  // a wyrm's egg in a nest of ash and gnawed bones, scaled like a pine cone, warm through the shell
  wyrmegg: () => {
    const scaleOf = (x, y, s) => [sheet([[x - 3.2 * s, y + 2], [x, y - 2.4 * s], [x + 3.2 * s, y + 2]], '#3a5228', { curve: 0.4 }), hair(x - 2.4 * s, y + 1.6, x + 2.4 * s, y + 1.6, '#8aae68')];
    return [
      ball(32, 56, 22, 6.4, '#3e3632'), ball(32, 55.2, 18, 4.8, '#5a504a'),
      ...[[14, 55], [50, 54], [22, 59.6], [44, 59.2], [30, 60.4]].map(([x, y], i) => limb(x - 4, y, x + 4, y - 1.6, 1.1, 1, '#d8d0bc')),
      ...[[18, 55], [46, 54]].map(([x, y]) => ball(x, y - 0.6, 1.8, 1.6, '#e0d8c4')),
      specks([[12, 57], [20, 53], [44, 52], [52, 57], [36, 60]], '#8a8078'),
      ball(32, 37.2, 13.2, 18, '#4e6a3a'), ball(28.8, 32.8, 7.2, 10.8, '#6a8a4e'),
      ...[[26, 24, 0.8], [34, 24, 0.8], [23, 32, 1], [30, 32, 1], [37.2, 32, 1], [24, 40, 1], [32, 40.8, 1], [40, 40, 1], [28, 48, 0.9], [36, 48, 0.9], [32, 18, 0.6]].flatMap(([x, y, s]) => scaleOf(x, y, s)),
      // a crack across the crown, and the warmth inside showing through it
      line(29, 19.6, 34, 23, '#22301a'), line(34, 23, 32, 27, '#22301a'), line(32, 27, 35, 29, '#22301a'),
      hair(30, 20.25, 33.5, 22.75, '#e8a040', { glows: true }), hair(33.5, 23.5, 32.25, 26.5, '#e8a040', { glows: true }),
      specks([[25, 27], [27, 36], [38, 45], [35, 30]], '#8aae68'),
    ];
  },
  // a sellsword waiting to be hired: leaning on the sword, eyes narrowed, the price already in mind
  hireling: () => CREATURES.sellsword('sit'),
  // the grey dwarves' forge: a mouth in the rock full of red coals, an anvil as long as a coffin before it,
  // dark iron ingots stacked beside, and a cask of their ale
  dwarf_forge: () => {
    const rock = '#5a5856', rockDk = '#3a3836', rockLt = '#7a7874', iron = '#2e3034', ironLt = '#6e747c', coal = '#ff6a28', ember = '#ffb050', wood = '#6a4a2c', copper = '#c87a3a';
    return [
      // the forge, a hood of cut stone over its mouth, coals glowing within
      sheet([[10, 44], [10, 18], [16, 8], [48, 8], [54, 18], [54, 44]], rockDk, { curve: 0.4 }),
      ...[16, 24, 32].map(y => hair(11, y, 53, y, rock)), ...[[20, 8, 20, 16], [32, 16, 32, 24], [44, 8, 44, 16], [26, 24, 26, 32], [38, 24, 38, 32]].map(([a, b, c2, d2]) => hair(a, b, c2, d2, rock)),
      sheet([[18, 44], [18, 30], [22, 24], [42, 24], [46, 30], [46, 44]], '#1a0e0a', { curve: 0.6 }),
      ball(32, 40, 12, 4.4, coal, { glows: true }), ...[[24, 38], [29, 36.5], [35, 37], [40, 39], [32, 39]].map(([x, y]) => ball(x, y, 2, 1.4, ember, { glows: true })),
      specks([[27, 33], [36, 31], [31, 29]], ember, { glows: true }),
      // the anvil before it, its horn to one side, on a block of stone
      sheet([[24, 61], [40, 61], [38, 53], [26, 53]], rock, { curve: 0.5 }), hair(25, 54, 39, 54, rockLt),
      sheet([[27, 53], [37, 53], [36, 49], [28, 49]], iron),
      sheet([[16, 49], [48, 49], [50, 45], [22, 44.5], [14, 45.5]], iron, { curve: 0.7 }), hair(18, 45.4, 47, 45.4, ironLt), line(15, 49, 49, 49, '#16181a'),
      // the ingots, stacked crosswise, and the cask with its tap
      ...[[4, 60], [12, 60], [8, 57], [6, 54]].map(([x, y]) => sheet([[x - 3.5, y], [x + 3.5, y], [x + 2.6, y - 2.6], [x - 2.6, y - 2.6]], '#4a4c52')),
      ...[[4, 60], [12, 60], [8, 57], [6, 54]].map(([x, y]) => hair(x - 2.4, y - 2.4, x + 2.4, y - 2.4, ironLt)),
      ball(56, 54, 6, 7, wood), ...[49.5, 54, 58.5].map(y => hair(50.5, y, 61.5, y, copper)), ball(56, 54, 1.6, 1.6, '#2a1a10'), limb(56, 54, 56, 57, 0.6, 0.6, copper),
    ];
  },
  // the lizardfolk's eggs: a mound of black mud half out of the water, a dozen leathery eggs pressed into its top
  egg_clutch: () => {
    const mud = '#3a3424', mudLt = '#5a5038', egg = '#d8d0b0', eggDk = '#a8a080', water = '#1e3036';
    return [
      ball(32, 58, 28, 5, water), ...[[12, 58], [26, 60], [44, 59], [54, 57]].map(([x, y]) => hair(x - 4, y, x + 4, y, '#4a6a70')),
      sheet([[6, 58], [12, 46], [22, 38], [32, 35], [42, 38], [52, 46], [58, 58]], mud, { curve: 1 }),
      sheet([[14, 47], [24, 40], [32, 38], [40, 40], [50, 47], [40, 45], [24, 45]], mudLt, { curve: 1 }),
      ...[[22, 43], [29, 40], [36, 40], [43, 43], [26, 47], [33, 45], [40, 47], [18, 49], [47, 49], [32, 50]].flatMap(([x, y]) => [ball(x, y, 3.2, 3.8, egg), ball(x + 0.8, y + 1, 2, 2.4, eggDk), specks([[x - 1, y - 2]], '#ffffff')]),
      ...[[8, 50, 6, 36], [56, 50, 58, 34], [12, 54, 10, 42], [52, 54, 55, 40]].map(([a, b, c2, d2]) => limb(a, b, c2, d2, 0.6, 0.3, '#6a7040')),
    ];
  },
  // a dark elf cast out of the halls, waiting by a wall with its blades lowered
  exile: () => CREATURES.renegade('sit'),
  // a healer with nobody to mend: kneeling by a dead lamp, the satchel open, a bandage half wound
  stray_healer: () => CREATURES.mender('sit'),
  // a fall of stone, and a hand still moving under it
  rubble: () => {
    const rock = '#7a7268', dark = '#5a544c', lt = '#8a8278', skin = '#d4a47a';
    return [
      ball(18, 54, 11, 8, dark), ball(44, 55, 13, 7.6, dark),
      // the arm and the hand reaching up out of it, the sleeve torn
      limb(38, 45, 50, 37, 2.8, 2.4, skin), ball(51.6, 36, 3.2, 2.8, skin),
      ...[[54, 32], [55, 34], [55.5, 36.4], [53, 31]].map(([x, y]) => limb(51.6, 35.6, x, y, 0.8, 0.6, '#e0b48a')),
      hair(44, 41, 48, 38.5, '#a87a58'), specks([[53, 31], [54, 32], [55, 34], [55.5, 36.4]], '#f0c8a0'),
      sheet([[34, 44], [44, 42], [46, 50], [34, 52]], '#34507a', { curve: 0.6 }), limb(34, 44, 44, 42, 0.6, 0.6, '#c9a24a'),
      hair(36, 47, 43, 46, '#4a6a9a'),
      // the stones, cracked and dusty, piled over it
      ball(30, 50, 12, 10, rock), ball(17, 45, 6.4, 5.6, rock), ball(40, 49, 6, 5.2, lt),
      ball(26, 37, 6.8, 6, lt), ball(35, 40, 4.8, 4.4, rock), ball(10, 57, 4.8, 4, rock),
      ball(52, 58, 5.6, 4, rock), ball(22, 59, 6, 3.6, '#6a645a'), ball(36, 59.5, 4, 2.8, '#6a645a'),
      ball(24, 34, 3, 1.6, '#a8a096'), ball(28, 46, 4, 2, '#9a9288'),
      hair(22, 48, 27, 51, dark), hair(36, 50, 42, 49, dark), hair(24, 36, 28, 41, dark), hair(14, 44, 17, 48, dark),
      specks([[26, 40], [28, 42], [32, 52], [18, 46], [44, 51], [12, 57], [53, 57]], '#9a9288'),
      // dust and grit spilled round it
      specks([[6, 61], [14, 62], [24, 62.5], [38, 62], [48, 62.5], [58, 61.5], [30, 62.75]], '#8a8278'),
    ];
  },
  // a squat idol older than the delve, with fresh offerings at its feet
  shrine: () => {
    const stone = '#6e6a62', stoneLt = '#7e7a70', stoneDk = '#5a564e';
    return [
      // the plinth in two steps, chipped at the corners
      sheet([[10, 52], [54, 52], [56, 62], [8, 62]], stoneDk, { curve: 0.7 }), hair(10, 55, 54, 55, '#4a463e'),
      sheet([[16, 42], [48, 42], [50, 53], [14, 53]], stone, { curve: 0.8 }), hair(18, 45, 46, 45, '#8a867c'),
      specks([[11, 53], [53, 53], [15, 43], [49, 44]], '#3a3630'),
      // the idol: a squat body, arms folded, a round head worn smooth
      ball(32, 29, 12, 13, stoneLt), ball(28, 24, 6, 6, '#8a867c'),
      limb(22, 28, 27, 36, 2.8, 2.4, '#747068'), limb(42, 28, 37, 36, 2.8, 2.4, '#747068'), ball(32, 37, 5, 2.4, '#747068'),
      hair(26, 24, 28, 34, stoneDk), hair(38, 24, 36, 34, stoneDk),
      ball(32, 15, 8, 7.2, '#8a867c'), ball(30, 12, 4, 3, '#9a968c'),
      ball(28.4, 15, 1.8, 1.4, '#1c1a18'), ball(35.6, 15, 1.8, 1.4, '#1c1a18'), hair(27, 13, 30, 13.25, stoneDk), hair(34, 13.25, 37, 13, stoneDk),
      limb(28.6, 20, 35.4, 20, 0.5, 0.5, '#3a3630'), limb(32, 15.5, 32, 18, 0.8, 1.2, '#8a867c'),
      hair(36, 9, 38, 16, '#6a665e'), specks([[30, 9], [34, 9.5], [32, 11]], '#a8a498'),
      // candles either side, burning, wax run down them
      ...both64(limb(14, 48, 14, 40, 1.4, 1.2, '#e8e0c8')), ...both64(hair(13.5, 41, 13, 46, '#fff8e0')),
      ...both64(sheet([[13, 39.6], [14, 34], [15, 39.6]], '#ffc050', { curve: 0.5, glows: true })), ...both64(ball(14, 38.6, 0.8, 1.2, '#fff0a0', { glows: true })),
      // offerings: coins, a cup, a red cloth
      ...[[24, 48], [26, 48.6], [38, 47.6], [40, 46.8], [32, 50], [34, 50]].map(([x, y]) => ball(x, y, 1.2, 0.7, '#e8c040')),
      ball(30, 46.6, 2.6, 1.4, '#b03040'), sheet([[42, 49], [46, 49], [45.4, 45], [42.6, 45]], '#8a6a40', { curve: 0.5 }),
      specks([[29, 48.5], [33, 49.5], [37, 47]], '#fff0a0'),
    ];
  },
  // a slab cut deep with letters that will not keep still
  runestone: () => {
    const slab = '#3e3a48', slabDk = '#2a2632', slabLt = '#4e4a5a';
    /** a rune: three strokes cut at angles, lit from inside */
    const rune = (x, y, k) => [
      limb(x, y, x, y + 5, 0.55, 0.55, '#8a70ff', { glows: true }),
      limb(x, y + (k % 2 ? 1 : 3), x + 2.6, y + (k % 2 ? 3 : 0.6), 0.5, 0.5, '#8a70ff', { glows: true }),
      limb(x, y + 4, x + (k % 3) - 1 + 2, y + 5.6, 0.45, 0.45, '#8a70ff', { glows: true }),
    ];
    return [
      ball(32, 61, 18, 2.6, '#2a2830'),
      sheet([[16, 12], [24, 5], [42, 5], [48, 12], [50, 62], [14, 62]], slab, { curve: 0.8 }),
      sheet([[42, 5], [48, 12], [50, 62], [45, 62]], slabDk, { curve: 0.5 }), sheet([[18, 12], [24, 6], [30, 6], [24, 14]], slabLt, { curve: 0.5 }),
      ...[[21, 15], [29, 15], [37, 15], [24, 25], [33, 25], [21, 35], [29, 35], [38, 35], [25, 45], [35, 45]].flatMap(([x, y], i) => rune(x, y, i)),
      specks([[21.5, 15.5], [29.5, 25.5], [38.5, 35.5], [25.5, 45.5]], '#ffffff', { glows: true }),
      // the stone's cracks, lichen at its foot
      line(18, 52, 24, 58, slabDk), line(40, 8, 44, 14, slabDk), hair(18, 20, 21, 30, slabDk), hair(42, 52, 46, 58, slabDk), hair(26, 54, 28, 59, slabDk),
      specks([[22, 6], [28, 5], [38, 6], [45, 10]], '#5a5468'),
      ball(18, 60, 4, 1.6, '#4a8040'), ball(46, 60.4, 3.4, 1.4, '#4a8040'), specks([[16, 59], [20, 58.5], [44, 59], [48, 59.5]], '#6aa058'),
    ];
  },
  // slumped against the wall, clutching its side, knife held out
  goblin_hurt: () => {
    const skin = '#6aa84a', skinDk = '#3f6e2c', skinLt = '#8ac66a', tunic = '#7a5230', tunicDk = '#5a3a20';
    return [
      // legs stuck out in front, bare feet
      ...both64(limb(26, 54, 16, 58, 3.4, 2.8, skinDk)), ...both64(limb(16, 58, 10, 59.6, 2.8, 2.2, skinDk)), ...both64(ball(9, 60, 3.6, 2, '#4a3a2a')),
      ...both64(specks([[6.5, 61], [8, 61.5], [9.5, 61.5]], '#d8cfb0')),
      // the body slumped back, the tunic dark with blood at one side
      ball(32, 46, 10.6, 10, skin), ...[40, 43].map(y => both64(hair(25, y, 29, y - 0.5, skinDk))).flat(),
      sheet([[21, 44], [43, 44], [44, 56], [40, 54.5], [36, 57], [32, 55], [28, 57], [24, 54.5], [20, 56]], tunic, { curve: 1 }),
      sheet([[21, 44], [25, 44], [23.5, 55.5], [20, 56]], tunicDk, { curve: 0.4 }),
      ball(32, 50.4, 4, 3.6, '#7a1c1c'), specks([[33, 49], [35, 52], [32, 55], [30, 54]], '#801818'),
      // one hand pressed to the wound, blood through the fingers
      limb(22, 40, 28, 49, 2.8, 2.4, skin), ball(30, 50.6, 3.2, 2.8, skin), ...[0, 1, 2].map(i => limb(30.5, 49 + i * 1.2, 33.5, 49.6 + i * 1.2, 0.6, 0.5, skin)),
      specks([[33, 49.5], [34, 51], [33.5, 52.5], [31, 53.5]], '#c02828'),
      // the other holding the knife out, shaking
      limb(42, 40, 50, 37, 2.8, 2.4, skin), ball(51.6, 36.4, 2.8, 2.6, skin),
      limb(52.4, 35.6, 58.4, 29.6, 0.9, 0.5, '#b8bcc4', { smooth: 1 }), hair(53, 34.5, 57.5, 30, '#f0f2f6'), limb(51, 37, 53.6, 34.6, 0.8, 0.8, '#5a3a20'),
      specks([[55, 33], [56, 31]], '#8a5a30'),
      // ears drooping, a narrow head, eyes squeezed half shut in pain
      sheet([[24, 30], [6, 26], [9, 30], [7.5, 32], [24, 35]], skin, { tilt: [-0.5, 0] }), sheet([[40, 30], [58, 26], [55, 30], [56.5, 32], [40, 35]], skin, { tilt: [0.5, 0] }),
      sheet([[23, 31], [12, 28.5], [23, 33.5]], '#b06e56'), sheet([[41, 31], [52, 28.5], [41, 33.5]], '#b06e56'),
      limb(32, 37, 32, 40, 2, 2.3, skinDk),
      ball(32, 32, 9.2, 8.2, skin), ball(32, 36.4, 6, 3, skin), ball(29, 29, 4, 2.6, skinLt),
      limb(25, 29, 30, 30, 1, 0.8, skinDk), limb(39, 29, 34, 30, 1, 0.8, skinDk),
      ball(28, 31.6, 1.8, 0.8, '#ffe040'), ball(36, 31.6, 1.8, 0.8, '#ffe040'), specks([[28, 31.5], [36, 31.5]], '#1a1010'),
      limb(32, 30.5, 32.6, 35, 0.9, 1.4, skin), ball(33, 35.4, 1.4, 1, skinLt),
      sheet([[27, 37.6], [37, 37.6], [35.6, 39.6], [28.4, 39.6]], '#2a1010'), specks([[29, 38], [31, 38.5], [34, 38]], '#e8dcb8'),
      // sweat on its brow, a cut over the eye
      specks([[27, 26.5], [37, 27]], '#9ad0ff'), hair(34, 26, 36, 28.5, '#801818'),
    ];
  },
  // the fourth crew's box: rusted lock, chain that has not rusted
  strongbox: () => {
    const wood = '#6a4424', woodLt = '#7a5030', woodDk = '#4a2e18', iron = '#6a7078', ironLt = '#a8b0b8';
    return [
      ball(32, 61, 22, 2.4, '#2a2420'),
      // the box: planks under iron bands, the lid shut
      sheet([[12, 36], [52, 36], [54, 58], [10, 58]], wood, { curve: 0.8 }),
      sheet([[12, 26], [52, 26], [52, 37], [12, 37]], woodLt, { tilt: [0, -0.6] }),
      limb(12, 36, 52, 36, 0.6, 0.6, '#2a1a10'),
      ...[42, 50].map(y => hair(13, y, 53, y, woodDk)), hair(14, 31, 50, 31, '#8a5a36'),
      ...[[20, 44], [40, 52], [30, 30]].map(([x, y]) => hair(x, y, x + 4, y + 0.5, woodDk)),
      ...[18, 32, 46].flatMap(x => [limb(x, 26, x, 58, 1, 1, iron), hair(x - 0.5, 27, x - 0.5, 57, ironLt), specks([[x, 28], [x, 34], [x, 40], [x, 48], [x, 56]], ironLt)]),
      limb(10, 58, 54, 58, 1, 1, iron),
      // the lock, rusted, a keyhole in it
      sheet([[28, 34], [36, 34], [36, 44], [28, 44]], '#a07830', { curve: 0.5 }), specks([[29, 35], [35, 35], [29, 43], [35, 43]], '#e0c060'),
      ball(32, 38.4, 1, 1, '#1a1008'), limb(32, 39, 32, 41.4, 0.5, 0.4, '#1a1008'),
      specks([[30, 36], [31, 36.5], [34, 42], [35, 42.5]], '#7a4a20'),
      // the chain round it, bright: links face on and edge on, down to the floor
      ...[[8, 44], [7, 48], [8, 52], [7, 56], [8, 60], [56, 44], [57, 48], [56, 52], [57, 56], [56, 60]].map(([x, y], i) => i % 2 ? limb(x, y - 1.2, x, y + 1.2, 0.6, 0.6, '#8a929a') : ball(x, y, 1.5, 1.7, '#9aa2aa')),
      specks([[8, 44], [8, 52], [8, 60], [56, 44], [56, 52], [56, 60]], '#1a1a20'),
      limb(32, 62, 32, 56, 0.6, 0.6, '#8a929a'), specks([[30, 62.5], [34, 62.5]], ironLt),
    ];
  },
  // a squat stone door set in the rock, three iron levers beside it in a row,
  // each worn bright at the grip, and a line of old marks scratched over them
  lever_door: () => {
    const stone = '#6e6a66', dark = '#4a4744', iron = '#5a6068', grip = '#c9b07a';
    return [
      // the frame, blocks of dressed stone, and the door in it
      sheet([[8, 12], [40, 12], [40, 62], [8, 62]], stone, { curve: 0.4 }),
      ...[20, 30, 40, 50].map(y => hair(8, y, 13, y, dark)), ...[22, 34, 46].map(y => hair(35, y, 40, y, dark)),
      sheet([[13, 18], [35, 18], [35, 62], [13, 62]], '#3e3a36', { curve: 0.6 }),
      ...[24, 34, 44, 54].map(y => limb(13, y, 35, y, 0.5, 0.5, dark)), ...[19, 24, 29].map(x => hair(x, 19, x, 61, '#34302c')),
      ball(24, 40, 3.2, 3.2, iron), ball(24, 40, 1.4, 1.4, '#1a1a1e'), hair(22, 38, 25, 37.5, '#9aa0a8'),
      // the frame's keystone, cut with a mark like an eye
      sheet([[19, 10], [29, 10], [28, 16], [20, 16]], '#8a8680'), ball(24, 12.6, 2, 1.2, '#2a2622'), ball(24, 12.6, 0.8, 0.8, '#6a6660'),
      specks([[10, 15], [37, 26], [11, 44], [38, 56]], '#8a8680'),
      // three levers in their slots, set at different angles
      ...[[46, -0.4], [52, 0.6], [58, 0.2]].flatMap(([x, lean]) => [
        sheet([[x - 2.4, 44], [x + 2.4, 44], [x + 2.4, 50], [x - 2.4, 50]], dark), ball(x, 47, 1.2, 2, '#1a1a1e'),
        limb(x, 47, x + lean * 4, 31, 1.2, 1, iron), hair(x - 0.5, 46, x + lean * 4 - 0.5, 32, '#8a9098'),
        ball(x + lean * 4, 30, 2.2, 2, grip), specks([[x + lean * 4 - 1, 29]], '#f0e0b0'),
      ]),
      // scratched marks over the levers: someone else tried, and counted
      ...[[44, 22], [50, 20], [56, 22]].flatMap(([x, y]) => [line(x, y, x + 2, y + 4, '#b8b0a0'), hair(x + 2, y, x + 3, y + 4, '#b8b0a0')]),
      ball(50, 62, 14, 1.4, '#2a2826'),
    ];
  },
  // a mule, still laden, standing with its head low and its packs askew, a
  // frayed rope hanging from its halter where someone let go of it
  mule: () => {
    const coat = '#7a6250', dark = '#4e3e30', light = '#8c7462', muzzle = '#c8b8a0', pack = '#8a6a3a', packDk = '#6a4a24', strap = '#3a2a1a', hoof = '#2a2018';
    return [
      // legs, the far pair darker, knobbed at the knee
      .../** @type {[number, string][]} */ ([[20, dark], [42, dark], [25, coat], [47, coat]]).flatMap(([x, c]) => [limb(x, 44, x - 0.6, 52, 3.4, 2.4, c), ball(x - 0.6, 52, 2.2, 2, c), limb(x - 0.6, 52, x, 60.6, 2.2, 1.8, c)]),
      ...[20, 25, 42, 47].map(x => ball(x, 61.6, 2.6, 1.4, hoof)),
      // the body, ribs showing, the tail switching
      ball(34, 39, 17.6, 11.2, coat), ball(34, 45, 13, 4.8, light), ...[36, 39, 42].map(y => hair(36, y, 44, y + 1, dark)),
      limb(50, 34, 55, 48, 1.6, 1, dark), ball(55.2, 49.6, 1.8, 2.6, hoof), hair(55, 48, 55.5, 52, '#4a3a2a'),
      // the packs, one slipped low on its flank, a pot tied on top, a bedroll
      sheet([[22, 28], [40, 28], [42, 42], [20, 42]], pack, { curve: 1 }),
      limb(31, 28, 31, 42, 0.6, 0.6, strap), limb(21, 35, 41, 35, 0.6, 0.6, strap), ...[[25, 31], [36, 39]].map(([x, y]) => hair(x, y, x + 3, y + 0.5, packDk)),
      ball(36, 25.2, 4.8, 3.6, '#5a5e66'), ball(36, 22.4, 3.2, 1.2, '#3a3e44'), hair(33, 24, 35, 23, '#8a8e96'),
      limb(22, 26, 32, 25, 2.4, 2.4, '#8a4a3a'), hair(23, 25, 31, 24, '#a86050'),
      sheet([[38, 38], [48, 39], [47, 48], [39, 47]], '#7a5a30', { curve: 1 }), limb(38.4, 42, 47.6, 43.2, 0.5, 0.5, strap),
      // the head, held low, long ears, a pale muzzle, a halter with a trailing rope
      limb(20, 32, 13, 40, 5.6, 4.4, coat), hair(18, 31, 13, 37, dark),
      ball(11, 42, 6.4, 5.8, coat), ball(8, 46, 4.4, 3.4, muzzle),
      ball(6.6, 45.6, 0.8, 0.7, hoof), ball(11, 40, 1.2, 1, '#1a1008'), specks([[10.5, 39.5]], '#e8e0d0'),
      sheet([[12, 37], [14, 26], [16, 37]], coat, { tilt: [0.2, -0.6] }), sheet([[8, 37], [9, 27], [11.6, 37]], dark, { tilt: [-0.2, -0.6] }),
      sheet([[13, 35], [14, 29], [15, 35]], '#a88a7a'),
      limb(7, 43, 14, 43, 0.6, 0.6, strap), limb(9, 47, 8, 52, 0.4, 0.4, '#b0a080'), limb(8, 52, 7, 56, 0.4, 0.4, '#b0a080'), limb(7, 56, 10, 62, 0.4, 0.4, '#b0a080'),
      specks([[10, 62.5], [11, 62.75], [9.5, 63]], '#c8b890'),
    ];
  },
  // a voice with nothing behind it: a cold light, trailing
  wisp: () => [
    ball(32, 32, 11, 11, '#4a5a7a', { glows: true }), ball(32, 32, 7.6, 7.6, '#9ab8e8', { glows: true }), ball(30.4, 30.4, 4, 4, '#e8f4ff', { glows: true }),
    limb(32, 40, 26, 54, 3.2, 0.8, '#5a6a8a', { glows: true }), limb(32, 40, 39, 52, 2.4, 0.6, '#5a6a8a', { glows: true }), limb(30, 41, 31, 58, 1.6, 0.4, '#4a5a7a', { glows: true }),
    hair(26, 44, 24, 52, '#8a9aba'), hair(38, 44, 40, 50, '#8a9aba'),
    // a face, almost, in the light
    ball(28, 30, 1.6, 1.4, '#2a3450'), ball(36, 30, 1.6, 1.4, '#2a3450'), sheet([[29.6, 35.4], [34.4, 35.4], [33.4, 37], [30.6, 37]], '#2a3450'),
    specks([[28, 28], [29, 27], [30, 28]], '#ffffff', { glows: true }),
    specks([[18, 24], [46, 20], [16, 40], [48, 38], [24, 16], [42, 46], [20, 22], [44, 24], [19, 36], [46, 34], [22, 46], [43, 42]], '#e8f4ff', { glows: true }),
  ],
  // pale caps growing thick on something that was a person
  fungus: () => {
    const cap = '#e8e0cc', capDk = '#c8bca4', stem = '#c8bca4', gill = '#a8987e';
    const shroom = (x, y, r) => [
      limb(x, 62, x, y, r * 0.32, r * 0.26, stem), hair(x - r * 0.15, 61, x - r * 0.1, y + 2, '#e8dcc8'),
      ball(x, y + r * 0.3, r * 0.95, r * 0.2, gill), ball(x, y, r, r * 0.55, cap), ball(x - r * 0.35, y - r * 0.18, r * 0.4, r * 0.2, '#fffaf0'),
      specks([[x - r * 0.5, y], [x + r * 0.3, y - r * 0.25], [x + r * 0.6, y + r * 0.1]], '#b89078'),
    ];
    return [
      ball(32, 57, 20, 7, '#4a4038'),
      // what is under them: a skull, a hand, a scrap of cloth
      ball(18, 54, 6, 5, '#d8d0bc'), ball(16, 54, 1.6, 1.4, '#2a2420'), ball(20.4, 54, 1.6, 1.4, '#2a2420'), hair(17, 57, 20, 57, '#8a8070'),
      ...[0, 1, 2, 3].map(i => limb(44 + i * 1.6, 58, 45 + i * 2, 61.5, 0.5, 0.5, '#d8d0bc')),
      sheet([[26, 54], [36, 53], [38, 58], [27, 59]], '#5a4a38', { curve: 0.6 }),
      ...shroom(26, 40, 9), ...shroom(40, 34, 11), ...shroom(50, 48, 6.4), ...shroom(12, 46, 5.6), ...shroom(34, 50, 5), ...shroom(20, 52, 3.4),
      hair(20, 40, 32, 40, capDk), hair(32, 34, 48, 34, capDk),
      specks([[6, 60], [56, 61], [44, 62], [22, 62]], '#a0c890', { glows: true }),
    ];
  },
  // a man hanging in goblin chains, a fresh brand on his arm
  prisoner: () => {
    const skin = '#c89a78', skinDk = '#a07858', rag = '#b8ac90', ragDk = '#8a7e66', iron = '#7a7e88', ironLt = '#a8acb4';
    return [
      // the rings in the wall and the chains down to his wrists
      ball(14, 12, 2.8, 2.8, iron), ball(14, 12, 1.2, 1.2, '#2a2a30'), ball(50, 12, 2.8, 2.8, iron), ball(50, 12, 1.2, 1.2, '#2a2a30'),
      ...[[15, 15], [16.5, 17.5], [18, 20]].map(([x, y], i) => i % 2 ? limb(x, y - 1, x + 0.6, y + 1, 0.5, 0.5, iron) : ball(x, y, 1.2, 1.3, iron)),
      ...[[49, 15], [47.5, 17.5], [46, 20]].map(([x, y], i) => i % 2 ? limb(x, y - 1, x - 0.6, y + 1, 0.5, 0.5, iron) : ball(x, y, 1.2, 1.3, iron)),
      // the legs, sagging, bare feet scraping the floor
      limb(27, 48, 22, 58, 3.2, 2.6, '#5a4a3a'), limb(37, 48, 42, 58, 3.2, 2.6, '#5a4a3a'),
      ball(21, 60, 3.6, 1.8, skinDk), ball(43, 60, 3.6, 1.8, skinDk), specks([[18.5, 60.75], [20, 61], [44, 61], [45.5, 60.75]], '#e0c0a0'),
      // the shirt in tatters, the ribs showing through it
      sheet([[22, 27], [42, 27], [44, 50], [40, 48.5], [36, 51], [32, 49], [28, 51], [24, 48.5], [20, 50]], rag, { curve: 1 }),
      sheet([[28, 31], [36, 31], [35, 39], [29, 39]], skin, { curve: 1 }), ...[33, 35, 37].map(y => hair(29.5, y, 34.5, y, skinDk)),
      hair(24, 30, 26, 46, ragDk), hair(40, 30, 38, 46, ragDk), line(28, 42, 31, 48, ragDk), specks([[28, 49], [34, 49.5], [40, 49]], ragDk),
      // the arms up, the wrists in irons, the brand raw on one
      limb(23, 29, 20, 21, 2.4, 2, skin), limb(41, 29, 44, 21, 2.4, 2, skin),
      ball(19.6, 21.6, 3, 2.4, iron), ball(44.4, 21.6, 3, 2.4, iron), hair(17.5, 20, 21.5, 20, ironLt), hair(42.5, 20, 46.5, 20, ironLt),
      ...[0, 1, 2].map(i => limb(18 + i * 1.4, 19.6, 17.6 + i * 1.6, 17, 0.5, 0.4, skin)), ...[0, 1, 2].map(i => limb(46 - i * 1.4, 19.6, 46.4 - i * 1.6, 17, 0.5, 0.4, skin)),
      ball(43, 26, 1.6, 1.2, '#c03020'), specks([[42.5, 25.5], [43.5, 26.5]], '#ff6040'),
      // the head hanging forward: matted hair, a beard, eyes shut
      limb(32, 24, 32, 28, 2.2, 2.4, skinDk),
      ball(32, 19, 6.8, 7.2, skin), ball(32, 23.6, 5.2, 3.2, '#6a4a30'), ...[29, 31, 33, 35].map(x => hair(x, 24, x + 0.25, 27, '#4a3020')),
      sheet([[25, 18], [26, 12], [32, 10.4], [38, 12], [39, 18], [37, 14.6], [32, 13.4], [27, 14.6]], '#4a3020', { curve: 0.8 }),
      hair(26, 14, 25.5, 21, '#3a2418'), hair(38, 14, 38.5, 21, '#3a2418'),
      hair(27.5, 18.25, 30.5, 18.75, '#2a1a14'), hair(33.5, 18.75, 36.5, 18.25, '#2a1a14'), limb(32, 18, 32.4, 21, 0.7, 1, skin),
      hair(29, 21, 30, 22, '#8a6a50'), specks([[34, 15.5], [30, 16]], skinDk),
    ];
  },
  // a ring of worked stone older than the delve, a rope going down, coins on the lip
  well: () => {
    const stone = '#7a746a', stoneDk = '#5a544c', wood = '#6a4424', woodDk = '#4a2e18';
    return [
      // the posts and the little roof over it, shingled
      limb(12, 38, 12, 12, 2, 2, wood), limb(52, 38, 52, 12, 2, 2, wood), hair(11.5, 14, 11.5, 36, woodDk), hair(51.5, 14, 51.5, 36, woodDk),
      sheet([[6, 13], [58, 13], [48, 3], [16, 3]], '#5a3a20', { tilt: [0, -0.7] }), ...[6, 9.5].map(y => hair(10 + (13 - y), y, 54 - (13 - y), y, '#7a5030')),
      ...[18, 24, 30, 36, 42, 48].map(x => hair(x, 4, x - (x - 32) * 0.15, 12.5, woodDk)),
      // the windlass, the rope down, the bucket on it
      limb(12, 18, 52, 18, 1.6, 1.6, wood), hair(13, 17, 51, 17, '#8a6038'), limb(52, 18, 56, 22, 0.8, 0.8, wood),
      ...[0, 1, 2, 3].map(i => limb(30 + i * 1.3, 16.4, 30 + i * 1.3, 19.6, 0.5, 0.5, '#c8b088')),
      limb(32, 19, 32, 28, 0.4, 0.4, '#c8b088'), specks([[32, 21], [32, 23.5], [32, 26]], '#e8d8b0'),
      sheet([[28, 28], [36, 28], [35, 35], [29, 35]], '#7a5030', { curve: 0.6 }), limb(28, 30, 36, 30, 0.4, 0.4, '#3a2a18'), limb(28.6, 33, 35.4, 33, 0.4, 0.4, '#3a2a18'),
      // the ring of stone, blocks in courses, moss in the joints
      sheet([[10, 38], [54, 38], [54, 61.2], [10, 61.2]], stone, { curve: 1 }),
      ...[46, 53].map(y => hair(10, y, 54, y, stoneDk)),
      ...[[18, 38, 46], [30, 38, 46], [42, 38, 46], [24, 46, 53], [36, 46, 53], [48, 46, 53], [14, 53, 61], [28, 53, 61], [40, 53, 61]].map(([x, a, b]) => hair(x, a, x, b, stoneDk)),
      specks([[16, 42], [30, 43], [44, 42], [20, 50], [34, 50], [46, 51], [18, 57], [38, 58]], '#9a948a'),
      specks([[24, 46], [42, 53], [14, 54]], '#5a8040'),
      ball(32, 38, 22, 6, '#8a847a'), ball(32, 38, 17, 4, '#14202c'), ball(32, 38.6, 12, 2.4, '#0e1620'),
      hair(26, 38, 30, 37.5, '#6a8aaa'), specks([[38, 37], [36, 39]], '#aac8e8'),
      ...[[14, 36], [18, 34.4], [48, 34.4], [52, 36]].map(([x, y]) => ball(x, y, 1.2, 0.7, '#e8c040')),
    ];
  },
  // a tall case of books in the dark, one spine among them lit gold
  bookcase: () => {
    const cols = ['#7a2a2a', '#2a4a6a', '#4a6a2a', '#6a5a2a', '#5a2a5a', '#8a6a3a', '#3a5a5a'];
    const books = [];
    [[6, 17.2], [20, 33.2], [36, 49.2]].forEach(([top, bottom], row) => {
      let x = 14;
      for (let i = 0; x < 50; i++) {
        const w = 2.8 + ((i + row) % 3) * 1, h = (bottom - top) - ((i * 7 + row * 3) % 4) * 1.6;
        const gold = row === 1 && i === 3, c = gold ? '#c8a040' : cols[(i * 3 + row) % cols.length];
        if ((i + row * 2) % 7 === 5) { x += w + 0.8; continue; }
        if ((i + row) % 9 === 7) books.push(sheet([[x, bottom], [x + 2.4, bottom - h * 0.95], [x + 2.4 + w, bottom - h * 0.92], [x + w, bottom]], c, { curve: 0.6 }));
        else books.push(sheet([[x, bottom - h], [x + w, bottom - h], [x + w, bottom], [x, bottom]], c, { curve: 0.6 }),
          hair(x + 0.6, bottom - h + 1.5, x + w - 0.6, bottom - h + 1.5, gold ? '#fff0a0' : '#e8d8a8'), hair(x + 0.6, bottom - 2, x + w - 0.6, bottom - 2, '#e8d8a8'),
          ...(gold ? [hair(x + w / 2, bottom - h + 3, x + w / 2, bottom - 4, '#fff0a0', { glows: true })] : []));
        x += w + 0.8;
      }
    });
    return [
      ball(32, 62, 20, 1.6, '#2a2018'),
      sheet([[10, 4], [54, 4], [54, 62], [10, 62]], '#3a2618', { curve: 0.3 }), sheet([[12, 5], [52, 5], [52, 50], [12, 50]], '#22160e'),
      ...books,
      ...[18.4, 34.4, 50.4].map(y => limb(11, y, 53, y, 1.8, 1.8, '#6a4424')), ...[17.5, 33.5, 49.5].map(y => hair(12, y, 52, y, '#8a6038')),
      limb(11, 4, 11, 62, 1.4, 1.4, '#5a3a20'), limb(53, 4, 53, 62, 1.4, 1.4, '#4a2e18'),
      specks([[12, 10], [52, 10], [12, 26], [52, 26], [12, 42], [52, 42]], '#5a3e28'),
      // books fallen on the floor, one open
      sheet([[16, 53], [28, 52], [29, 58], [17, 59]], '#6a3a2a', { tilt: [-0.1, -0.8] }), sheet([[32, 55], [44, 54.4], [44.6, 58.6], [32.4, 59]], '#e8d8b0', { tilt: [0, -0.8] }),
      hair(38, 54.6, 38.2, 58.8, '#a89878'), hair(33.5, 56, 37, 55.75, '#8a7a5a'), hair(39, 55.75, 43, 55.5, '#8a7a5a'),
      specks([[14, 60], [50, 60], [24, 61]], '#4a3020'),
    ];
  },
  // an ogre asleep on a bed of stolen coin, snoring like a rockfall
  ogre_sleep: () => [
    ...CREATURES.ogre(),
    ball(18, 60, 8, 2.8, '#a87a20'), ball(32, 60.8, 9, 2.4, '#b8882a'), ball(46, 60, 8, 2.8, '#a87a20'),
    ...[[13, 59], [18, 58.4], [23, 59.4], [27, 60], [32, 59.2], [37, 60], [41, 59.4], [46, 58.4], [51, 59]].map(([x, y], i) => ball(x, y, 2.2, 0.8, i % 2 ? '#d8a830' : '#c89a28')),
    ...[[15, 58.75], [30, 59], [44, 58.25], [49, 58.75]].map(([x, y]) => hair(x - 1, y, x + 1, y, '#fff0a0')),
    ball(24, 57, 0.8, 2, '#c89a28'), ball(40, 57.4, 0.8, 1.8, '#d8a830'),
    specks([[16, 58.5], [30, 60.5], [44, 58.5], [36, 60.5]], '#fff0a0'),
    // the snore, drawn clear of the club over its other shoulder: a Z, then a smaller one
    ...[[8, 4.5, 16, 11.5, 1, '#dde8ff'], [18, 12.5, 23.5, 17.5, 0.8, '#b8c8f0']].flatMap(([x0, y0, x1, y1, r, c]) => [
      limb(x0, y0, x1, y0, r, r, c), limb(x1, y0, x0, y1, r, r, c), limb(x0, y1, x1, y1, r, r, c)]),
    specks([[24, 59], [38, 60], [52, 59], [13, 60]], '#fff8c0'),
    // eyes shut: lids over both, a dark line where they meet
    ball(28.4, 15, 2, 1.4, '#9a7648'), ball(35.6, 15, 2, 1.4, '#9a7648'),
    hair(26.75, 15.5, 30, 15.75, '#3a2410'), hair(34, 15.75, 37.25, 15.5, '#3a2410'),
  ],
  // a tall mirror in a gilt frame, where no mirror should be, and in it a
  // figure that is not yours
  mirror: () => [
    limb(22, 62, 26, 50, 1.6, 1.4, '#4a3020'), limb(42, 62, 38, 50, 1.6, 1.4, '#4a3020'), limb(32, 52, 32, 62, 1.2, 1.2, '#3a2418'),
    ball(32, 28, 18, 25, '#c8a040'), ball(32, 28, 16.4, 23.4, '#a07828'),
    ...[[32, 3], [16, 16], [48, 16], [14, 40], [50, 40], [32, 53]].map(([x, y]) => ball(x, y, 2.4, 2, '#e0b848')),
    ball(32, 28, 14, 21, '#7a90a8'), ball(27, 20, 6, 10, '#9ab0c8'),
    // the figure in the glass: a hooded shape, eyes lit red
    ball(32, 22, 4.6, 5, '#5a6a80'), sheet([[24, 31], [40, 31], [42, 46], [22, 46]], '#5a6a80', { curve: 0.8 }), ball(32, 28.6, 6, 2, '#4a5a70'),
    ball(30, 22, 0.9, 0.8, '#ff4040', { glows: true }), ball(34, 22, 0.9, 0.8, '#ff4040', { glows: true }),
    line(22, 16, 26, 10, '#e8f4ff'), line(24, 20, 28, 14, '#c8dcf0'), hair(36, 10, 40, 16, '#e8f4ff'), hair(38, 32, 42, 38, '#c8dcf0'),
    specks([[18, 14], [46, 14], [16, 28], [48, 28], [18, 42], [46, 42], [32, 51]], '#fff0a0'),
    ball(32, 3.6, 4, 2.8, '#e0b848'), hair(30, 2, 34, 2, '#fff0a0'),
    hair(22, 60, 25, 52, '#6a4a30'),
  ],
  // a painted chest alone in the open, a wire running from its lid into the wall
  chest: () => {
    const red = '#8a2a2a', redLt = '#a03838', gold = '#c8a040', goldLt = '#e0b848';
    return [
      ball(32, 61, 22, 2, '#2a1c18'),
      sheet([[12, 38], [52, 38], [54, 59], [10, 59]], red, { curve: 0.9 }),
      sheet([[12, 39], [52, 39], [50, 28], [42, 24], [22, 24], [14, 28]], redLt, { tilt: [0, -0.6] }),
      ...[[18, 44], [30, 50], [42, 45], [24, 32], [38, 30]].map(([x, y]) => hair(x, y, x + 5, y + 0.5, '#6a1a1a')),
      limb(10, 58, 54, 58, 0.8, 0.8, gold), limb(12, 38, 52, 38, 0.8, 0.8, gold), hair(13, 37.5, 51, 37.5, '#fff0a0'),
      limb(20, 26, 20, 58, 0.8, 0.8, gold), limb(44, 26, 44, 58, 0.8, 0.8, gold),
      ...[20, 44].map(x => specks([[x, 30], [x, 42], [x, 50], [x, 56]], '#a07820')),
      // the hasp and lock, and painted scrollwork either side
      sheet([[29, 36], [35, 36], [35, 44], [29, 44]], goldLt, { curve: 0.5 }), ball(32, 40, 0.9, 0.9, '#2a1a10'), limb(32, 40.5, 32, 42.4, 0.4, 0.4, '#2a1a10'),
      ...[[25, 47], [39, 47]].map(([x, y]) => [hair(x - 2, y, x + 2, y - 2, goldLt), hair(x + 2, y - 2, x + 3, y + 1, goldLt)]).flat(),
      // the wire from the lid into the wall, catching the light
      line(48, 26, 60, 16, '#d0d4dc'), ball(61, 15, 2.6, 2.6, '#1a1418'), specks([[54, 21], [58, 17.5]], '#ffffff'),
      specks([[60, 14], [62, 16]], '#ff4020'),
    ];
  },
  // a goblin on a crate beside a hand-painted sign, cup out for the toll
  goblin_toll: () => [
    limb(7, 62, 7, 26, 1.4, 1.4, '#6a4424'), hair(6.5, 30, 6.5, 60, '#8a6038'),
    ...CREATURES.goblin(),
    sheet([[1, 17], [19, 17], [19, 29], [1, 29]], '#b08a58', { tilt: [-0.1, -0.2] }), hair(2, 21, 18, 21, '#8a6a40'), hair(2, 25.5, 18, 25.5, '#8a6a40'),
    // the letters, daubed: a T and an O
    limb(4, 20.5, 10, 20.5, 0.75, 0.75, '#3a2410'), limb(7, 20.5, 7, 27.2, 0.75, 0.75, '#3a2410'),
    ...Array.from({ length: 10 }, (_, i) => { const a0 = i / 10 * Math.PI * 2, a1 = (i + 1) / 10 * Math.PI * 2; return limb(14.5 + Math.cos(a0) * 2.4, 23.8 + Math.sin(a0) * 3.4, 14.5 + Math.cos(a1) * 2.4, 23.8 + Math.sin(a1) * 3.4, 0.7, 0.7, '#3a2410'); }),
    // the sign's nails and its grain
    specks([[2, 18], [18, 18], [2, 28], [18, 28]], '#7a5a30'), hair(1, 23, 19, 23, '#9a7648'),
  ],
  // a wall of shields across the passage, and a banner still standing over them
  barricade: () => {
    const heater = (cx, c) => [sheet([[cx - 7.2, 38], [cx + 7.2, 38], [cx + 7.2, 49], [cx, 61], [cx - 7.2, 49]], c, { curve: 1 }),
      hair(cx - 6, 39.5, cx + 6, 39.5, '#c8ccd4'), ball(cx, 46, 2.2, 2.2, '#c8ccd4'), specks([[cx - 5, 41], [cx + 5, 41], [cx - 4, 52], [cx + 4, 52]], '#8a8e96')];
    return [
      limb(32, 62, 32, 5, 1.4, 1.4, '#6a4424'), hair(31.5, 8, 31.5, 60, '#8a6038'), ball(32, 4.4, 1.8, 1.8, '#c8a040'),
      sheet([[33, 6], [55, 6], [53, 22], [49, 19], [43, 24], [33, 22]], '#8a2a2a', { curve: 0.8 }),
      sheet([[40, 10], [46, 10], [46, 16], [40, 16]], '#e0b848', { curve: 0.5 }), hair(43, 11, 43, 15, '#8a2a2a'),
      hair(36, 8, 52, 9, '#a03838'), hair(38, 18, 44, 20, '#5a1a1a'),
      ...heater(12, '#2e4a7a'), ...heater(52, '#4a6a3a'), ...heater(25, '#7a2a2a'), ...heater(39, '#6e7480'),
      limb(25, 41, 25, 55, 0.6, 0.6, '#e0b848'), limb(20, 46, 30, 46, 0.6, 0.6, '#e0b848'),
      // a helm left on top, and a skull in front
      ball(19, 36, 6.4, 5.2, '#7a808c'), ball(19, 38, 6.4, 1.2, '#5a606c'), limb(15, 36, 23, 36, 0.6, 0.6, '#1a1418'), hair(15, 33, 19, 31.5, '#c8ccd4'),
      ball(47, 59.2, 4, 3.2, '#ddd5bd'), ball(45.6, 58.6, 1.1, 1, '#140e14'), ball(48.4, 58.6, 1.1, 1, '#140e14'), specks([[46, 61], [47, 61], [48, 61]], '#f6f0de'),
    ];
  },
  // a swordsman who died mid-duel: a pale coat over a trail of mist, a
  // feathered hat, the free hand raised behind him and a long blade held low
  duelist_ghost: () => {
    const coat = '#8aa6d6', coatDk = '#6a86b6', cloak = '#46587e', mist = '#5e7298', face = '#cfe2f8', hat = '#3c4c70';
    return [
      // the cloak behind, ragged, and the mist where his legs should be
      sheet([[22, 21], [42, 21], [48, 40], [44, 47], [39, 42], [32, 49], [25, 42], [20, 47], [16, 40]], cloak, { curve: 0.8 }),
      limb(32, 42, 32, 59, 8.4, 1.2, '#3a4868', { glows: true }), limb(32, 40, 31, 57, 6.4, 0.8, mist, { glows: true }),
      limb(28, 42, 21, 53, 2.8, 0.6, mist, { glows: true }), limb(36, 42, 43, 52, 2.6, 0.6, mist, { glows: true }),
      // the coat, buttoned, a sash, lace at the throat
      sheet([[25, 21], [39, 21], [41, 33], [39, 42], [25, 42], [23, 33]], coat, { curve: 1 }),
      sheet([[25, 21], [28, 21], [27, 42], [25, 42], [23, 33]], coatDk, { curve: 0.5 }),
      limb(24, 34, 40, 34, 0.8, 0.8, '#4e6490'), ...[25, 29, 33, 38].map(y => ball(32, y, 0.7, 0.7, '#e8f0ff')),
      ball(32, 21.6, 4.4, 2, '#e6eefa'), specks([[30, 23], [32, 23.5], [34, 23]], '#ffffff'),
      // the free hand raised behind, the sword arm low, the long blade
      limb(39, 23, 47, 23, 2.4, 2, coat), limb(47, 23, 49, 15, 2, 1.6, coat), ball(49.2, 14, 2.2, 2, face),
      limb(25, 23, 21, 32, 2.6, 2.2, coat), limb(21, 32, 18, 39, 2.2, 1.8, coat),
      line(18, 42, 4, 60, '#e4eeff', { lit: 1, glows: true }), hair(17, 42, 5, 58, '#ffffff', { glows: true }),
      limb(14, 38, 20, 44, 0.6, 0.6, '#8a9cc0'), ball(17.4, 40.4, 2.6, 2.4, face),
      // the face, thin, a moustache, eyes dark
      ball(32, 15.2, 5.4, 6, face), ball(30, 13, 2.4, 2.6, '#e8f4ff'),
      ball(29.6, 14.4, 1, 0.8, '#1a2440'), ball(34.4, 14.4, 1, 0.8, '#1a2440'), hair(29, 18, 32, 17.5, '#8aa0c0'), hair(32, 17.5, 35, 18, '#8aa0c0'),
      // the hat, broad-brimmed, a long feather off it
      ball(32, 7.8, 5.8, 3.8, hat), ball(32, 10.4, 10, 2.2, hat), hair(23, 10, 41, 10, '#5a6a90'),
      limb(28, 6, 19, 3, 2, 1, '#e8f4ff'), limb(19, 3, 15, 6, 1.2, 0.6, '#e8f4ff'), ...[0, 1, 2, 3].map(i => hair(27 - i * 3, 5.5 - i * 0.6, 26 - i * 3, 3 - i * 0.6, '#c8dcff')),
      specks([[12, 24], [52, 32], [10, 48], [48, 50], [18, 56], [54, 42], [14, 36]], '#c8dcff', { glows: true }),
    ];
  },
  // bundles of grey silk hung from the roof like fruit, one with a sword hilt
  // out of it and one at the back that moves, and what fell out of them below
  silk_larder: () => {
    const silk = '#c8c4bc', silkDk = '#a8a49c', bone = '#ddd5bd', worn = '#a89e84';
    /** each bundle a spindle: tied off at the top, drawn to a point below, wound round with thread */
    const cocoon = (x, y, rx, ry, c) => [limb(x, y - ry - 2, x, y - ry * 0.5, 0.8, rx * 0.5, c), ball(x, y, rx, ry, c), limb(x, y + ry * 0.5, x + 0.6, y + ry + 3.6, rx * 0.6, 0.5, c),
      ...[-0.5, -0.1, 0.3].map(f => hair(x - rx * 0.9, y + ry * f, x + rx * 0.9, y + ry * f + 1.5, silkDk)), ball(x - rx * 0.35, y - ry * 0.3, rx * 0.3, ry * 0.3, '#e0dcd4')];
    return [
      // the threads go up into the dark, not to the top of the picture
      ...[14, 26, 38, 49].map(x => hair(x, 0, x, 5, '#4a4a58')),
      hair(14, 6, 14, 9, '#9a9aa6'), hair(26, 6, 26, 17, '#9a9aa6'), hair(38, 6, 38, 11, '#8a8a96'), hair(49, 6, 49, 21, '#9a9aa6'), hair(14, 29, 12, 34, '#9a9aa6'),
      ...cocoon(38, 20, 4.4, 6.8, '#8e8a84'), ball(41.2, 21.6, 2, 2.6, '#8e8a84'), hair(41, 19, 42.5, 23, '#6e6a64'),
      ...cocoon(14, 19, 5.2, 8.4, silk),
      ...cocoon(12, 41, 3.4, 5.2, '#bcb8b0'),
      ...cocoon(49, 33, 6.4, 10, silk),
      limb(53.2, 25, 57.6, 15.6, 1.1, 1, '#6a4424'), line(50, 24, 56, 28, '#a8acb4', { lit: 1 }), ball(58, 14.4, 2, 2, '#c8a040'),
      ...cocoon(26, 31, 7.6, 11.6, silk),
      // what fell out of them: a skull, long bones, threads trailing on the floor
      ball(19, 58.8, 4.6, 3.8, bone), ball(20, 62, 3, 1.4, worn), ball(17, 58.4, 1.2, 1.1, '#140e14'), ball(21, 58.4, 1.2, 1.1, '#140e14'),
      limb(30, 60.6, 46, 58.6, 1.2, 1.1, bone), ball(29.6, 60.8, 2, 1.6, bone), ball(46.6, 58.4, 2, 1.6, bone),
      limb(50, 62, 56, 60, 1, 0.9, worn), hair(24, 61, 36, 62.5, '#9a9aa6'), hair(8, 60, 14, 62, '#9a9aa6'),
    ];
  },
  // a skeleton with a cup of dice, and a pot of gold in front of it
  bones: () => {
    const bone = '#ddd5bd', worn = '#a89e84', socket = '#140e14';
    return [
      // legs out in front, the feet fallen sideways
      limb(26, 50, 14, 58, 2, 1.8, worn), limb(38, 50, 50, 58, 2, 1.8, worn), ball(26, 50, 1.6, 1.6, bone), ball(38, 50, 1.6, 1.6, bone),
      ball(12, 59.6, 3.6, 2, bone), ball(52, 59.6, 3.6, 2, bone), specks([[9, 60], [10.5, 61], [53.5, 61], [55, 60]], worn),
      // the pelvis, the spine, the ribs
      ball(32, 49, 7.2, 3.6, bone), ball(29, 49, 1.6, 1.2, worn), ball(35, 49, 1.6, 1.2, worn),
      limb(32, 26, 32, 48, 1.2, 1.2, worn), ...[28, 30, 32, 34].map(y => hair(31, y, 33, y, '#8a8070')),
      ...[31, 35, 39].map(y => [limb(25, y, 32, y - 1, 1, 1, bone), limb(39, y, 32, y - 1, 1, 1, bone)]).flat(),
      ...[31, 35, 39].map(y => hair(26, y + 0.75, 31, y, '#8a8070')),
      // the arms: one hanging, one holding the dice cup
      limb(24, 30, 20, 42, 1.6, 1.4, bone), ball(20, 42, 1.4, 1.4, bone), limb(20, 42, 22, 50, 1.4, 1.2, bone),
      limb(40, 30, 42, 42, 1.6, 1.4, bone), ball(42, 42, 1.4, 1.4, bone),
      ball(42, 44, 4, 3.4, '#7a5030'), ball(42, 41.6, 3.4, 1, '#3a2010'), hair(39, 45, 45, 45, '#5a3a20'), ball(40, 40, 1, 1, '#f4ecd8'), ball(44, 40, 1, 1, '#f4ecd8'),
      // the skull, grinning
      ball(31, 20, 8.4, 8, bone), ball(31, 27.2, 5.2, 2.6, worn), ball(28, 16, 3, 2, '#ece4cc'),
      ball(27.6, 20, 2.4, 2.4, socket), ball(34.4, 20, 2.4, 2.4, socket), sheet([[30, 23], [32, 23], [31, 25]], socket),
      ...[27, 29, 31, 33, 35].map(x => limb(x, 26.4, x, 28, 0.6, 0.5, '#f6f0de')), hair(26, 27, 36, 27, '#8a8070'),
      hair(34, 14, 36, 18, '#a89e84'),
      // the pot of gold, and two dice thrown
      ball(20, 58, 6.8, 4, '#a07830'), ball(20, 56, 5.2, 2.8, '#e8c040'), specks([[18, 54], [22, 54], [20, 52], [17, 56], [23, 56]], '#fff0a0'),
      ...[[34, 59], [43, 61]].map(([x, y]) => [sheet([[x, y], [x + 3, y], [x + 3, y + 3], [x, y + 3]], '#f4ecd8', { curve: 0.4 }), specks([[x + 1, y + 1], [x + 2, y + 2]], '#1a1418')]).flat(),
    ];
  },
  // a thin brown hound curled in a corner, a frayed collar, one ear up
  stray: () => {
    const coat = '#7a5030', dark = '#523218', pale = '#b8905e', grain = '#5a3a1e';
    return [
      ball(32, 61, 22, 2, '#2a1c14'),
      // the body curled round, ribs showing, the tail tucked over its feet
      ball(30, 52, 20, 9, coat), ball(30, 49, 16, 4.8, dark), ball(28, 57, 14, 3.4, pale),
      ...[22, 27, 32, 37].map(x => hair(x, 49, x + 1.5, 55, grain)),
      limb(12, 55, 8, 50, 2.4, 1.4, dark), limb(8, 50, 10, 46, 1.4, 0.8, dark), hair(10, 53, 8, 49, '#3a2210'),
      // the forelegs folded under the chin, the paws
      limb(36, 58, 50, 59, 2.4, 2, coat), ball(51, 59.4, 2.8, 1.6, pale), specks([[52.5, 60], [53.5, 59.5]], '#e8dcc8'),
      // the head laid on its paws: one ear up, one flopped, the muzzle long
      ball(45, 50, 8, 6.8, coat), ball(42, 47, 4, 2.6, '#8a6040'),
      sheet([[40, 45], [37, 37], [43, 44]], dark, { curve: 0.6 }), sheet([[41, 45], [39, 39.6], [42.4, 44.4]], '#8a5a4a'),
      sheet([[49, 45], [52, 51], [50, 54]], dark, { curve: 0.6 }),
      limb(44, 54, 55, 55, 3.2, 2.4, '#96683e'), ball(55.6, 54.8, 2.2, 1.6, '#1a1210'), specks([[55, 54]], '#6a5a50'),
      hair(48, 56.5, 55, 56.5, '#3a2010'),
      // eyes half open, watching you
      ball(44, 48.6, 1.4, 0.8, '#2a1808'), ball(48, 48.6, 1.4, 0.8, '#2a1808'), specks([[43.5, 48.25], [47.5, 48.25]], '#f0d8a0'),
      hair(42.5, 47.5, 45.5, 47.75, dark), hair(46.5, 47.75, 49.5, 47.5, dark),
      // the frayed collar with its tag
      limb(39, 55, 48, 57, 1.8, 1.8, '#a02828'), hair(40, 54, 47, 56, '#c04040'), ball(44, 58.4, 1.6, 1.6, '#d8b848'), specks([[43.5, 58]], '#fff4c0'),
      hair(38, 56, 37, 58, '#a02828'),
    ];
  },
  // a squat iron cage, banded top and bottom and its door shut with a heavy
  // padlock, and a goblin crouched inside with its fingers round the bars,
  // peering out between them to see what you will do
  cage: () => {
    const iron = '#555a64', ironLt = '#8a909a', far = '#2e3038', skin = '#72ac4c', dark = '#4c7e34', foot = '#5a8c3c', rag = '#80705c', ragDk = '#5a4c3c';
    // the bars stand either side of the middle, with a wider gap at the door so the face shows whole through it
    const bars = [11, 18, 25, 39, 46, 53];
    return [
      // the cage's floor, dark and strewn with straw, and its far bars
      sheet([[9, 51], [55, 51], [55, 58], [9, 58]], '#3a3630', { tilt: [0, -0.9] }),
      ...[[12, 56, 16, 54], [44, 55, 49, 56.5], [28, 57, 34, 56], [20, 53, 24, 54]].map(([a, b, c, d]) => hair(a, b, c, d, '#a8904a')),
      ...[14.4, 21.6, 28.8, 35.2, 42.4, 49.6].map(x => limb(x, 20, x, 52, 0.9, 0.9, far)),
      // the goblin, squatting on its heels, knees out, reaching for the bars
      ...both64(limb(28.8, 52.8, 21, 50, 2.4, 2.2, dark)), ...both64(ball(21, 49.6, 2.8, 2.6, dark)),
      ...both64(limb(21, 50, 26, 55, 2, 1.7, dark)), ...both64(ball(26, 55.8, 3.6, 1.6, foot)), ...both64(specks([[23.5, 56.5], [25, 57], [26.5, 57]], '#e8e0c0')),
      ball(32, 49, 6.4, 6, skin), hair(29, 47, 30, 50, dark), hair(35, 47, 34, 50, dark),
      sheet([[24, 42.4], [40, 42.4], [44.8, 44.8], [46, 50], [43.2, 48.8], [41.2, 51.6], [38.4, 49.2], [35.2, 52], [32, 49.6], [28.8, 52], [25.6, 49.2],
        [22.8, 51.6], [20.8, 48.8], [18, 50], [19.2, 44.8]], rag, { curve: 1 }),
      ...[[22, 48], [28, 50], [36, 50], [42, 48]].map(([x, y]) => hair(x, y, x + 0.5, y + 2, ragDk)),
      // elbows out over its knees, hands up to the door bars under its chin, the manacle still on
      ...both64(limb(21, 48, 24.4, 43.6, 1.8, 1.7, skin)),
      limb(21.2, 44.8, 24.4, 46.8, 1.7, 1.7, iron), hair(21.5, 44, 24, 45.5, ironLt), ball(21.2, 48.8, 1.5, 1.6, iron),
      ...both64(ball(25, 42.4, 2.5, 2.3, skin)),
      ...scragHead(32, 34.8, { look: 0 }),
      // the near bars, in front of it all, and the fingers curled round them
      ...bars.flatMap(x => [limb(x, 18, x, 57.2, 1.2, 1.2, iron), hair(x - 0.5, 20, x - 0.5, 56, ironLt)]),
      ...both64(limb(23.2, 41.8, 26.8, 41.8, 1.1, 1.1, skin)), ...both64(specks([[24, 43], [26, 43]], '#e8e0c0')),
      // the door's rails and hinges
      limb(25, 24, 39, 24, 1.1, 1.1, iron), limb(25, 48, 39, 48, 1.1, 1.1, iron), hair(25.5, 23.25, 38.5, 23.25, ironLt),
      ball(25, 26, 1.8, 2.2, '#484c56'), ball(25, 46, 1.8, 2.2, '#484c56'),
      // the bands top and bottom, riveted, and a ring on top to hang it by
      limb(28.4, 15.2, 30, 10.8, 1.1, 1.1, iron), limb(35.6, 15.2, 34, 10.8, 1.1, 1.1, iron), limb(30, 10.4, 34, 10.4, 1.1, 1.1, iron),
      sheet([[7.6, 14.8], [56.4, 14.8], [56.4, 20], [7.6, 20]], iron, { curve: 0.8 }), hair(8, 15.25, 56, 15.25, ironLt),
      sheet([[7.6, 56.8], [56.4, 56.8], [56.8, 62], [7.2, 62]], iron, { curve: 0.8 }), hair(8, 57.25, 56, 57.25, ironLt),
      specks([11, 18, 25, 39, 46, 53].flatMap(x => [[x, 17], [x, 59]]), '#9aa0aa'),
      // rust run from the bands
      hair(11, 26, 11, 30, '#7a4a2a'), hair(53, 44, 53, 49, '#7a4a2a'), specks([[18, 51], [46, 24]], '#7a4a2a'),
      // the padlock, big as a fist, through a hasp on the door's edge
      limb(37.8, 49.2, 37.8, 45.2, 1, 1, '#8a8e96'), limb(42.2, 49.2, 42.2, 45.2, 1, 1, '#8a8e96'), limb(37.8, 44.4, 42.2, 44.4, 1, 1, '#8a8e96'),
      sheet([[35.6, 48.4], [44.4, 48.4], [45.2, 55.6], [34.8, 55.6]], '#6e6248', { curve: 0.9 }),
      ball(40, 51, 0.8, 0.8, '#140e10'), limb(40, 51.5, 40, 53.4, 0.4, 0.4, '#140e10'),
      hair(37, 49, 37, 54, '#b8a878'), specks([[41, 44], [42, 45]], '#c8ccd4'),
    ];
  },

  // one of the Lampfolk, hunched in the dark with its lamp gone cold in its
  // lap: the same grey skin and drooping ears as the traders, the eyes dim
  lampfolk_dark: () => {
    const skin = '#7e8694', skinDk = '#5a6270', skinLt = '#98a0ae', robe = '#5a4c3e', robeDk = '#3e3428', pack = '#4e3e2e';
    return [
      // the pack beside it, the blanket roll, the staff laid down
      ball(48, 40, 12, 14, pack), hair(38, 42, 58, 42, '#3a2c1e'), limb(39, 27, 57, 27, 3.6, 3.6, '#6e3e32'), ...[42, 48, 54].map(x => hair(x, 24, x + 0.5, 30, '#5a2e24')),
      line(8, 36, 26, 60, '#5a4630'), hair(9, 37, 25, 59, '#7a6648'),
      // feet out under the robe
      ...both64(ball(23, 60, 6, 2.6, skin)), ...both64(specks([[18, 60.5], [19.5, 61], [21, 61]], '#a8b0bc')),
      // the robe, hunched, patched
      sheet([[16, 40], [42, 40], [46, 60], [12, 60]], robe, { curve: 1 }), sheet([[16, 40], [20, 40], [16, 60], [12, 60]], robeDk, { curve: 0.4 }),
      sheet([[34, 48], [42, 48], [43, 56], [35, 56]], '#6a5a3e', { curve: 0.6 }), ...[[22, 52], [30, 46], [38, 58]].map(([x, y]) => hair(x, y, x + 0.5, y + 3, robeDk)),
      // the lamp in its lap, cold: dark glass, no flame
      ball(29, 51, 6, 4.8, '#4a4a50'), ball(29, 49, 3.2, 2.4, '#2a2a30'), ball(28, 48, 1.2, 1, '#5a5a62'),
      limb(29, 44, 29, 46, 0.6, 0.6, '#3a3a40'), hair(24, 51, 34, 51, '#3a3a40'),
      // hands cupped round it
      ...both64(limb(19, 42, 25, 51, 2.6, 2.2, robe)), ...both64(ball(25.6, 51.6, 2.6, 2.4, skin)),
      // broad ears that droop, a round head bowed, the great eyes dimmed
      sheet([[21, 27], [8, 35], [10, 38], [21, 33]], skin, { tilt: [-0.5, 0.2] }), sheet([[39, 27], [52, 35], [50, 38], [39, 33]], skin, { tilt: [0.5, 0.2] }),
      sheet([[20, 29], [11, 34.5], [20, 32]], '#8a6e76'), sheet([[40, 29], [49, 34.5], [40, 32]], '#8a6e76'),
      ball(30, 31, 10.8, 9.6, skin), ball(27, 27, 5.4, 3.6, skinLt),
      ...both64(ball(25.4, 31, 3.6, 3.2, '#8a8468')), ...both64(ball(25.4, 31.6, 3.6, 1.6, skinDk)),
      ball(25.6, 31.4, 1, 0.9, '#2a2630'), ball(34.4, 31.4, 1, 0.9, '#2a2630'),
      limb(30, 31, 30, 35, 0.9, 1.4, skin), ball(30, 36, 1.4, 1, skinDk),
      sheet([[27, 38], [33, 38], [32.4, 39], [27.6, 39]], '#4a4452'),
      hair(21, 33, 23, 36, skinDk), hair(39, 33, 37, 36, skinDk), specks([[26, 24], [34, 24.5]], skinDk),
    ];
  },
  // a dwarf-built anvil by a cold hearth, a half-made blade across it
  anvil: () => {
    const iron = '#5a5e66', hi = '#7a7e88', dark = '#4a4e56', stone = '#4a3e38';
    return [
      // the hearth: a column of stone, its mouth black, a last ember in the ash
      sheet([[4, 20], [22, 20], [24, 60], [2, 60]], stone, { curve: 0.5 }), ...[28, 38, 48].map(y => hair(3, y, 23, y, '#3a302a')), hair(12, 21, 12, 28, '#3a302a'), hair(8, 48, 8, 59, '#3a302a'),
      sheet([[7, 34], [19, 34], [20, 48], [6, 48]], '#1e1614', { curve: 0.6 }), ball(13, 47, 6, 1.6, '#3a302a'),
      ball(11, 46, 1, 0.8, '#c84a1a', { glows: true }), specks([[10, 44], [14, 45], [16, 46]], '#6a3a24'),
      // the anvil: foot, waist, body, the horn, its face worn bright
      sheet([[32, 50], [52, 50], [56, 61], [28, 61]], iron, { curve: 0.6 }),
      sheet([[36, 40], [48, 40], [47, 51], [37, 51]], dark, { curve: 0.5 }),
      sheet([[24, 32], [56, 32], [60, 36], [56, 41], [28, 41]], hi, { curve: 0.7 }),
      limb(24, 32, 56, 32, 0.6, 0.6, '#9a9ea8', { lit: 1 }), hair(26, 31.5, 54, 31.5, '#c8ccd4'),
      limb(25, 34, 17, 36, 2.4, 0.6, hi), hair(30, 38, 36, 39, '#4a4e56'), specks([[40, 37], [48, 38], [34, 35]], '#5a5e66'),
      // the half-made blade across it, and the tongs and hammer left by
      line(26, 30, 54, 28, '#b8bcc4', { lit: 1 }), hair(27, 29.5, 52, 27.75, '#e8ecf2'), line(26, 29, 53, 27, '#8a8e96'),
      limb(53, 28, 59, 26, 1, 1, '#6a4a2a'), limb(52, 25, 53.6, 31, 0.6, 0.6, '#8a7a4a'),
      limb(8, 60, 18, 54, 1.6, 1.2, '#6a4a2a'), ball(20, 53, 3.2, 2.8, '#6a6e76'), hair(18, 52, 22, 51.5, '#9a9ea8'),
      specks([[30, 62], [44, 62.5], [56, 62]], '#3a3e44'),
    ];
  },
  // black water in a stone basin, perfectly still, something pale on the bottom
  pool: () => [
    ball(32, 52, 26, 10, '#5a564e'), ball(32, 51, 24, 8.6, '#6a665e'),
    ...[[8, 50], [14, 45], [24, 43], [40, 43], [50, 45], [56, 50], [48, 58], [32, 60], [16, 58]].map(([x, y], i) => [ball(x, y, 4, 2.4, i % 2 ? '#7a766c' : '#6e6a62'), hair(x - 2.5, y - 1, x + 1.5, y - 1.75, '#8a867c')]).flat(),
    ball(32, 52, 21, 7.4, '#0e1218'), ball(26, 50, 10, 2.8, '#1c2430'),
    // the pale thing on the bottom: a face, or a hand
    ball(39, 54, 3.6, 1.6, '#3a3a38'), ball(39, 53.6, 2.4, 1, '#6a6858'), specks([[38, 53.5], [40, 53.5]], '#c8c4a8'),
    line(16, 50, 24, 49, '#3a4a5e'), line(36, 48, 46, 49, '#2a3444'), hair(20, 54, 28, 54, '#2a3444'),
    specks([[22, 49], [44, 50]], '#6a8aaa'),
    ball(12, 42, 4, 3.2, '#6a665e'), ball(53, 43, 4.8, 3.6, '#6a665e'), specks([[10, 41], [52, 42]], '#8a867c'), specks([[14, 61], [50, 62]], '#4a6a3a'),
  ],
  // a goblin cook-pot on its tripod over a low fire, bubbling, a ladle in it
  cookpot: () => [
    // the tripod, lashed at the top, the hook and chain
    limb(14, 61, 26, 14, 1.2, 1, '#5a4030'), limb(50, 61, 38, 14, 1.2, 1, '#5a4030'), limb(32, 62, 32, 14, 1, 0.9, '#4a3020'),
    limb(28, 15, 36, 15, 1.4, 1.4, '#8a7050'), hair(28, 14, 36, 16, '#6a5030'),
    ...[18, 21, 24].map(y => ball(32, y, 0.8, 1, '#3a3a40')),
    // the fire under it: logs, embers, low flame
    ...[[22, 60], [32, 62], [42, 60]].map(([x, y]) => [limb(x - 6, y, x + 6, y - 2, 1.6, 1.6, '#4a3020'), hair(x - 5, y - 1, x + 5, y - 2.5, '#6a4a30')]).flat(),
    ball(32, 57, 10, 4.4, '#c84a1a', { glows: true }), ball(32, 56, 6, 2.8, '#ffb040', { glows: true }), specks([[30, 54], [34, 56], [28, 57]], '#fff0a0', { glows: true }),
    // the pot, black iron, soot round its belly, a rim and two lugs
    ball(32, 40, 16, 13, '#3a3a42'), ball(26, 35, 6, 5, '#4a4a54'), ball(32, 49, 12, 3.4, '#2a2a30'),
    ...both64(ball(16.4, 34, 2, 2.6, '#3a3a42')),
    ball(32, 30, 15, 4, '#5a4a2a'), ball(32, 29.4, 13, 2.8, '#6a5a32'),
    // what is in it: lumps, a bone, bubbles
    ball(26, 29.6, 2.8, 1.6, '#7a6a3a'), ball(38, 29, 2.4, 1.4, '#7a6a3a'), limb(30, 30, 35, 28.6, 0.8, 0.8, '#d8d0bc'),
    ...[[24, 28.5], [33, 30.5], [41, 29.5]].map(([x, y]) => ball(x, y, 0.9, 0.6, '#9a8a50')),
    // the ladle, and steam curling up
    line(36, 30, 46, 12, '#8a6a3a'), ball(36, 30, 3.2, 1.6, '#6a5a3a'), hair(37, 28, 45, 13, '#a88a5a'),
    specks([[28, 22], [34, 18], [30, 14], [36, 24], [26, 17], [32, 9]], '#b8b4a8'), hair(30, 26, 28, 20, '#8a8880'), hair(34, 25, 36, 18, '#8a8880'),
    hair(22, 38, 26, 44, '#2a2a30'), specks([[40, 36], [44, 40], [20, 42]], '#5a5a62'),
  ],
  // a stone knight kneeling on its plinth, head bowed, a real sword on its knees
  statue: () => {
    const stone = '#8a867c', stoneLt = '#9a968c', dark = '#6a665e', moss = '#4a6a3a';
    return [
      // the plinth, its edge chipped, moss in the cracks
      sheet([[8, 50], [56, 50], [56, 62], [8, 62]], dark, { curve: 0.5 }), limb(8, 50, 56, 50, 0.6, 0.6, '#9a968c'),
      hair(16, 52, 18, 60, '#5a564e'), hair(44, 54, 47, 61, '#5a564e'), specks([[10, 52], [12, 53], [14, 55], [48, 52], [52, 54], [54, 56]], moss),
      // one knee down, one up, the cloak falling behind
      sheet([[18, 22], [46, 22], [50, 50], [14, 50]], dark, { curve: 0.8 }),
      limb(24, 44, 14, 49, 4, 3.2, stone), ball(13, 49, 4.4, 2, stone),
      limb(40, 40, 48, 49, 4, 3.6, stone), ball(48, 49, 3.6, 3.4, stoneLt),
      // the body in stone mail, a surcoat, the arms resting on the crossguard
      sheet([[20, 22], [44, 22], [46, 44], [18, 44]], stone, { curve: 0.8 }), sheet([[25, 26], [39, 26], [40, 44], [24, 44]], stoneLt, { curve: 0.8 }),
      ...[28, 32, 36].map(y => hair(21, y, 25, y, dark)), ...[28, 32, 36].map(y => hair(39, y, 43, y, dark)), hair(32, 27, 32, 43, dark),
      ...both64(limb(21, 24, 23, 38, 3, 2.6, stone)), ...both64(ball(23.4, 38.6, 3, 2.6, stoneLt)),
      // the head bowed in a great helm
      ball(32, 16, 7.6, 8, stoneLt), limb(26, 17, 38, 17, 0.6, 0.6, '#4a4640'), hair(32, 18, 32, 23, '#5a564e'), ball(30, 12, 3, 2.4, '#aaa69c'),
      // the real sword: steel, its grip bound, laid across the knees; and tears of water down the helm
      line(10, 39, 54, 39, '#c8ccd4', { lit: 1 }), line(10, 40.4, 54, 40.4, '#8e929a', { lit: 1 }), hair(12, 38.75, 52, 38.75, '#f0f4fa'),
      limb(15, 36, 15, 43, 0.8, 0.8, '#9a7a3a'), limb(11, 39.6, 15, 39.6, 1, 1, '#5a3a20'), ball(9.6, 39.6, 1.4, 1.4, '#c8a040'),
      hair(29, 20, 29, 28, '#8ab0d8'), hair(35, 20, 35, 30, '#8ab0d8'),
      specks([[22, 42], [42, 26], [20, 30], [30, 10], [38, 46]], moss), specks([[18, 56], [30, 58], [44, 56]], '#5a564e'),
    ];
  },
  // a grinning idol of green stone, ruby eyes, a scorched ring before it
  idol: () => {
    const jade = '#3e7a5a', jadeLt = '#4a8a68', dark = '#2a5a42', deep = '#1a3a2a';
    return [
      ball(32, 59, 22, 4, '#2a2220'), ball(32, 59, 16, 2.6, '#1a1412'), specks([[20, 56], [44, 58], [28, 61], [38, 56]], '#4a3a30'),
      // crossed legs, a fat belly, arms resting on the knees
      ...both64(limb(26, 52, 14, 55, 4.4, 3.6, dark)), ...both64(ball(13, 55.4, 3.6, 2.6, jade)),
      ball(32, 43, 12, 11, jade), ball(29, 40, 6, 5, jadeLt), ball(32, 48, 2, 1.6, deep),
      ...both64(limb(22, 36, 19, 48, 2.8, 2.4, dark)), ...both64(ball(19, 49.6, 2.8, 2.2, jade)),
      ...[[26, 38], [38, 38], [32, 52]].map(([x, y]) => hair(x - 2, y, x + 2, y, deep)),
      // the head: a peaked crown, a wide grin full of teeth, ruby eyes
      ball(32, 22, 12, 11, jadeLt), ball(28, 18, 5, 4, '#5a9a78'),
      sheet([[20, 16], [32, 5], [44, 16]], dark, { curve: 0.5 }), ...[26, 32, 38].map(x => ball(x, 13, 1.2, 1.2, '#c8a040')),
      ...both64(ball(27, 20, 3, 2.6, deep)), ...both64(ball(27, 20, 2, 1.8, '#d02030', { glows: true })), specks([[26, 19], [36, 19]], '#ff8090'),
      limb(32, 21, 32, 25, 1, 1.6, jade),
      sheet([[23, 27], [41, 27], [38, 32], [26, 32]], deep, { curve: 0.6 }), ...[25.5, 28.5, 31.5, 34.5, 37.5].map(x => limb(x, 27.4, x, 29.4, 0.7, 0.5, '#d8e0c0')),
      hair(22, 25, 24, 28, deep), hair(42, 25, 40, 28, deep),
      specks([[24, 34], [40, 33], [30, 46], [36, 47]], '#6ab08a'),
    ];
  },
  // a surveyor's bones against the wall, a satchel of maps, a finger pointing on
  mapmaker: () => {
    const bone = '#ddd5bd', worn = '#a89e84', coat = '#4a5a3a', coatDk = '#2e3a24', socket = '#140e14';
    return [
      limb(26, 50, 14, 58, 2, 1.8, worn), limb(38, 50, 50, 58, 2, 1.8, worn), ball(12, 59.6, 3.6, 2, bone), ball(52, 59.6, 3.6, 2, bone),
      // the coat still on the bones, buttoned wrong, gone green
      sheet([[20, 26], [44, 26], [46, 50], [18, 50]], coat, { curve: 0.9 }), sheet([[20, 26], [24, 26], [21, 50], [18, 50]], coatDk, { curve: 0.4 }),
      limb(32, 26, 32, 50, 0.6, 0.6, coatDk), ...[30, 36, 42].map(y => ball(33.6, y, 0.7, 0.7, '#c8a040')),
      ...[[24, 40], [40, 32]].map(([x, y]) => hair(x, y, x + 1, y + 4, coatDk)),
      // the skull, tipped to one side
      ball(31, 19, 8.4, 8, bone), ball(31, 26.2, 5.2, 2.6, worn), ball(28, 15, 3, 2, '#ece4cc'),
      ball(27.6, 19, 2.4, 2.4, socket), ball(34.4, 19, 2.4, 2.4, socket), sheet([[30, 22], [32, 22], [31, 24]], socket),
      ...[27, 29, 31, 33, 35].map(x => limb(x, 25.4, x, 27, 0.6, 0.5, '#f6f0de')),
      // the satchel in its lap, rolled maps standing out of it
      sheet([[20, 42], [38, 42], [39, 54], [19, 54]], '#7a5030', { curve: 0.6 }), limb(19, 44, 39, 44, 0.6, 0.6, '#5a3a20'), ball(29, 47, 1.4, 1.2, '#c8a040'),
      ...[[22, 40], [27, 39], [32, 40]].map(([x, y]) => [limb(x, y, x + 2, y - 8, 1.8, 1.8, '#e8dcb8'), ball(x + 2, y - 8, 1.8, 1, '#c8b890'), hair(x - 0.5, y - 1, x + 1.5, y - 7, '#a89878')]).flat(),
      // the arm out, one finger pointing on along the wall
      limb(42, 32, 54, 38, 1.6, 1.4, bone), ball(54, 38, 1.4, 1.4, bone), limb(54, 38, 60, 39, 0.6, 0.5, bone),
      ...[0, 1, 2].map(i => limb(54.6, 38.6 + i * 0.6, 56, 40 + i * 0.6, 0.4, 0.4, worn)),
      specks([[48, 34], [50, 36], [52, 37], [46, 33]], '#a8aeb4'),
    ];
  },
};

// A cut-down skeleton: a low, scattered heap on the floor, not a figure, so it
// never reads as something still standing. The skull sits on top, eyes lit.
PROPS.bone_heap = () => {
  const bone = '#ddd5bd', worn = '#a89e84';
  return [
    limb(10, 58, 30, 53, 1.8, 1.6, worn), ball(9.2, 58.4, 2.6, 2, bone), ball(30.8, 52.8, 2.4, 2, bone),
    limb(34, 52, 54, 59, 1.8, 1.6, worn), ball(33.2, 51.8, 2.4, 2, bone), ball(54.8, 59.2, 2.6, 2, bone),
    limb(16, 51, 46, 60, 1.6, 1.4, bone), ball(15.2, 50.6, 2.2, 1.8, bone), ball(46.8, 60.4, 2.4, 1.8, bone),
    ...[53, 56, 59].map((y, i) => [limb(22 + i * 2, y, 40 - i * 2, y + 1, 1, 1, bone), hair(23 + i * 2, y + 0.75, 39 - i * 2, y + 1.5, '#8a8070')]).flat(),
    ball(32, 60, 8.4, 3.2, worn), ball(29, 60, 1.8, 1.2, '#8a8070'), ball(35, 60, 1.8, 1.2, '#8a8070'),
    // the skull on top, its eyes lit violet
    ball(26, 47.2, 7.2, 6.6, bone), ball(26.8, 52.8, 4.4, 2, worn), ball(23.6, 44, 2.6, 1.8, '#ece4cc'),
    ball(23, 47, 2, 1.8, '#140e14'), ball(29, 47, 2, 1.8, '#140e14'),
    ball(23, 47, 1, 0.9, '#b040ff', { glows: true }), ball(29, 47, 1, 0.9, '#b040ff', { glows: true }),
    ...[24, 26, 28, 30].map(x => limb(x, 52, x, 53.4, 0.5, 0.4, '#f6f0de')),
    hair(30, 43, 32, 46, '#a89e84'), specks([[12, 61], [50, 62], [20, 62.5], [42, 62.5]], '#a89e84'),
  ];
};

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
/** @param {boolean | 'soft'} [grim]  'soft' (the items) keeps more of the colour: gold should still read as gold in the pack */
function ramp(hex, grim = false) {
  const key = grim ? hex + (grim === 'soft' ? '~' : '!') : hex;
  if (rampCache.has(key)) return rampCache.get(key);
  let rgb = hexToRgb(hex);
  if (grim) {
    const lum = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11, mute = grim === 'soft' ? 0.12 : 0.3, dim = grim === 'soft' ? 0.94 : 0.86;
    rgb = rgb.map(v => Math.round((v + (lum - v) * mute) * dim));
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
/** @param {boolean | 'soft'} [grim] */
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
/** @param {boolean | 'soft'} [grim] painted grim (see ramp): the creatures, props and dressing; the items and the weapon in hand softly */
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

// The named champions, each drawn as itself: its kind's picture, recoloured
// where age or office would change it, with what the stories give it laid
// behind and over. Each moves through its kind's poses, flinch and all, and is
// painted into the slot a colour wash used to fill (see creature in assets.js).
const CHAMPION_OF = { vaelith: 'drow_mage', durgrim: 'grey_dwarf', hissra: 'lizardfolk', grisk: 'goblin', vessra: 'spider', ushgar: 'orc', morrow: 'ghoul', orla: 'wraith', gorrum: 'troll', skarrow: 'wyrm' };
/** @param {string} kind @param {(pose: string) => {back?: object[], front?: object[], map?: Record<string, string>}} extra */
const champion = (kind, extra) => {
  const draw = pose => { const e = extra(pose); return [...(e.back || []), ...recolour(CREATURES[kind](pose), e.map || {}), ...(e.front || [])]; };
  return (pose = 'idle') => (pose === 'hurt' ? flinch(draw('idle'), kind) : pose === 'blink' ? eyesShut(draw('idle')) || draw('idle') : STEPS.includes(pose) ? stride(draw('idle'), kind, pose) : draw(pose));
};
const CHAMPIONS = {
  // Vaelith, High Priestess of the dark elves: robed in black and wine-red, a
  // crown of silver spiders, a great fan of a collar behind her head, and a
  // silver spider at her breast; her fire burns a deeper violet
  vaelith: champion('drow_mage', () => ({
    map: { '#2c1a3c': '#1c1018', '#1a0e26': '#0e080c', '#46285e': '#5a1a3e' },
    back: [
      sheet([[18, 20], [17, 6], [22, 9], [25, 1], [29, 6], [32, -1], [35, 6], [39, 1], [42, 9], [47, 6], [46, 20]], '#1e1222', { curve: 0.8 }),
      ...[[18, 19, 17.5, 7], [25, 16, 25, 2], [32, 15, 32, 0], [39, 16, 39, 2], [46, 19, 46.5, 7]].map(([a, b, c, d]) => hair(a, b, c, d, '#b8bccc')),
      hair(17.5, 7, 22, 9, '#b8bccc'), hair(22, 9, 25, 2, '#b8bccc'), hair(25, 2, 29, 6, '#b8bccc'), hair(29, 6, 32, 0, '#b8bccc'),
      hair(32, 0, 35, 6, '#b8bccc'), hair(35, 6, 39, 2, '#b8bccc'), hair(39, 2, 42, 9, '#b8bccc'), hair(42, 9, 46.5, 7, '#b8bccc'),
    ],
    front: [
      // the crown: a band of silver, a spider at its brow, legs arched up from it
      line(27.6, 6.2, 36.4, 6.2, '#b8bccc'), hair(28, 5.75, 36, 5.75, '#eef0f8'),
      ball(32, 5, 1.4, 1.1, '#2a2030'), ball(32, 3.6, 0.9, 0.8, '#2a2030'), specks([[31.5, 3.25], [32.5, 3.25]], '#ff5a50', { glows: true }),
      ...[-1, 1].flatMap(sd => [[1.4, -2.6, 3.4, -4.2], [1.6, -1.4, 4.4, -2.2], [1.5, 0.2, 4.2, 0.8]].map(([a, b, c, d]) => limb(32 + sd * a, 5 + b * 0.6, 32 + sd * c, 5 + d, 0.35, 0.25, '#c8ccd8'))),
      // the spider at her breast, on a silver chain
      hair(28, 17.5, 32, 22, '#b8bccc'), hair(36, 17.5, 32, 22, '#b8bccc'),
      ball(32, 23.6, 1.6, 1.3, '#c8ccd8'), ball(32, 25.6, 2, 1.7, '#9aa0b0'), specks([[31.5, 23], [32.5, 23]], '#ff5a50', { glows: true }),
      ...[-1, 1].flatMap(sd => [[1.4, 24, 4, 22.4], [1.8, 25, 4.6, 25.2], [1.6, 26.4, 4, 28.4]].map(([a, b, c, d]) => limb(32 + sd * a, b, 32 + sd * c, d, 0.3, 0.2, '#c8ccd8'))),
    ],
  })),
  // Durgrim, the grey dwarves' Forge-Thane: his beard gone white and bound in
  // more copper, a crown of dark iron set with copper studs, and a short cloak
  // of forge-scorched red behind his shoulders.
  durgrim: champion('grey_dwarf', () => ({
    map: { '#6a6c70': '#b8b8b4', '#46484c': '#8a8a86', '#8e9094': '#dcdcd6' },
    back: [sheet([[14, 24], [50, 24], [54, 50], [46, 54], [32, 50], [18, 54], [10, 50]], '#6a2a1a', { curve: 1 }), hair(12, 48, 52, 48, '#3a1610')],
    front: [
      sheet([[24.6, 6.6], [24, 1], [27.5, 3.6], [30, -0.4], [32, 3], [34, -0.4], [36.5, 3.6], [40, 1], [39.4, 6.6]], '#3a3c40', { curve: 0.3 }),
      line(24.6, 6.4, 39.4, 6.4, '#c87a3a'), ...[27, 32, 37].map(x => ball(x, 5, 0.9, 0.9, '#e09a50')),
      // a smith's leather apron, scorched, under the beard and over the mail to the knee
      sheet([[23, 40], [41, 40], [43, 55], [21, 55]], '#5a3a22', { curve: 0.6 }), hair(22, 54, 42, 54, '#3a2414'), specks([[26, 47], [37, 50], [31, 52]], '#2a1a10'),
    ],
  })),
  // Hissra, the Marsh-Mother: her scales gone dark with age and her crest white,
  // a collar of teeth about her neck, and a mantle of reeds on her shoulders.
  hissra: champion('lizardfolk', () => ({
    map: { '#5a7a3a': '#3e5a30', '#7e9e52': '#5e7e46', '#b0602a': '#e8e0c8' },
    back: [sheet([[16, 18], [48, 18], [52, 44], [12, 44]], '#4a5028', { curve: 0.8 }), ...[16, 22, 28, 36, 42, 48].map(x => hair(x, 19, x + (x - 32) * 0.15, 44, '#6a7040'))],
    front: [
      ...[-8, -5.5, -3, -0.5, 2, 4.5, 7].map((dx, i) => limb(32 + dx, 19 + Math.abs(dx) * -0.2 + 1, 32 + dx * 1.05, 23 - Math.abs(dx) * 0.15, 0.7, 0.25, i % 2 ? '#e8dcc0' : '#d0c4a0')),
      hair(23, 19.5, 41, 19.5, '#6a5232'),
    ],
  })),
  // Grisk, the Goblin King: a dented bucket for a crown, bent spoons stuck round
  // its rim for points, a red rag of blanket for a royal cloak, junk on his belt
  grisk: champion('goblin', pose => ({
    back: [
      // (it swings out behind him as he lunges)
      pose === 'windup' ? sheet([[22, 26], [42, 26], [53, 47], [48, 47], [45, 51], [39, 49], [33, 52], [27, 49], [21, 52], [15, 47], [9, 47]], '#8a2a22', { curve: 1 })
        : sheet([[22, 26], [42, 26], [47, 51], [43, 49], [40, 53], [36, 50], [32, 53], [28, 50], [24, 53], [21, 49], [17, 51]], '#8a2a22', { curve: 1 }),
      hair(24, 30, 19.5, 48, '#5a1814'), hair(40, 30, 44.5, 48, '#5a1814'), hair(32, 30, 32, 50, '#6a1e18'),
    ],
    front: [
      // a spoon, a key and a bell hung on the cord at his waist
      limb(28.6, 35, 28.2, 38.6, 0.3, 0.3, '#a8acb4'), ball(28.1, 39.2, 0.8, 1, '#c8ccd4'),
      limb(37.4, 35, 37.8, 38, 0.3, 0.3, '#c9a24a'), sheet([[37.2, 38], [38.6, 38], [38.6, 39], [37.2, 39]], '#c9a24a'),
      dots([[25, 35]], '#e0c060'),
      // the bucket, dented tin gone dull, its handle hanging by his ear
      limb(25.2, 13, 22.4, 19.4, 0.35, 0.35, '#5a6068'), limb(22.4, 19.4, 23.8, 21, 0.35, 0.35, '#5a6068'),
      sheet([[24.4, 15.6], [39.6, 15.6], [37.8, 7.6], [26.2, 7.6]], '#8a9098', { curve: 0.3 }),
      sheet([[24.4, 15.6], [28, 15.6], [27.8, 7.6], [26.2, 7.6]], '#b8c0c8'), line(24, 15.8, 40, 15.8, '#c8ced6'),
      ball(35.2, 11, 1.5, 1.2, '#6a7078'), hair(26.5, 8.25, 37.5, 8.25, '#5a6068'),
      specks([[30, 10], [36.5, 13.5], [27, 12.5], [33, 14]], '#8a5a30'),
      // the spoons, bowls up, bent every which way
      ...[[26.6, -1.2], [29.4, 0.8], [32, -0.6], [34.6, 1], [37.4, 1.4]].flatMap(([x, b]) => [
        limb(x, 8, x + b, 3.6, 0.35, 0.3, '#c8ccd4'), ball(x + b * 1.15, 2.8, 0.9, 1.2, '#dfe3ea'), specks([[x + b * 1.15 - 0.25, 2.25]], '#ffffff'),
      ]),
    ],
  })),
  // Vessra, the Web-Mother: dusky and old, an ivory mark where her children
  // wear red, egg sacs bound to her back, her web trailing from her to the floor
  vessra: champion('spider', () => ({
    map: { '#3e3454': '#4a3c2e', '#5e5278': '#6e5a44', '#241e34': '#2a2018', '#4a3e64': '#54442e', '#2e2642': '#30261a', '#c02828': '#e8e0c8', '#ff6060': '#fff8e8', '#7a6a96': '#9a8462', '#6e5c8a': '#8a7656' },
    back: [line(17, 34, 12, 63, '#bfb9aa'), line(47, 34, 52, 63, '#bfb9aa'), line(22, 26, 20, 63, '#a8a294'), line(42, 26, 44, 63, '#a8a294')],
    front: [
      ball(23.4, 27, 3.8, 3.3, '#e4dccb'), ball(27.4, 23.2, 3.1, 2.8, '#f2ecdf'), ball(40.6, 27.6, 3.5, 3.1, '#ddd4c2'),
      hair(20.5, 26, 26, 28.5, '#b8b0a0'), hair(25, 22, 30, 24.5, '#c8c0b0'), hair(38, 26.5, 43, 29, '#b8b0a0'),
      specks([[22, 25.5], [27, 22], [40, 26.5], [24.5, 28.5]], '#ffffff'),
    ],
  })),
  // Ushgar, the Orc Warchief: a horned iron helm, red war paint, a bearskin at
  // his back, and the skulls of those who argued hung from his belt
  ushgar: champion('orc', pose => ({
    back: [
      // (it swings out behind him as he comes on)
      pose === 'windup' ? sheet([[16, 24], [48, 24], [58, 47], [52, 47], [47, 52], [40, 50], [33, 54], [26, 50], [19, 53], [11, 47], [5, 46]], '#4a3a2a', { curve: 1 })
        : sheet([[16, 24], [48, 24], [51, 52], [46, 50], [42, 55], [36, 52], [32, 56], [28, 52], [22, 55], [18, 50], [13, 52]], '#4a3a2a', { curve: 1 }),
      ...[[18, 30, 15.5, 49], [24, 32, 22.5, 53], [40, 32, 41.5, 53], [46, 30, 48.5, 49]].map(([a, b, c, d]) => hair(a, b, c, d, '#2e2418')),
    ],
    front: [
      ...both64(limb(24.6, 7.4, 18.4, 4.4, 1.9, 1.3, '#e8dcc0')), ...both64(limb(18.4, 4.4, 15.6, 0.8, 1.3, 0.4, '#f2ead6')),
      ...both64(hair(21.5, 5, 21.75, 7.25, '#a89a7a')), ...both64(hair(18.75, 3, 19.25, 5.25, '#a89a7a')),
      sheet([[23.4, 12.4], [24.4, 6.4], [28, 3.4], [36, 3.4], [39.6, 6.4], [40.6, 12.4], [32, 10.6]], '#5a606c', { curve: 0.8 }),
      line(23.2, 12, 40.8, 12, '#8a909c'), hair(26, 6, 31, 4.25, '#b8bec8'), specks([[25.5, 11], [29, 11.5], [35, 11.5], [38.5, 11]], '#c8ced8'),
      line(32, 4, 32, 10, '#3e434c'),
      limb(24.6, 17.2, 29.2, 17.8, 0.5, 0.5, '#b02020'), limb(25, 18.8, 28.6, 19.2, 0.4, 0.4, '#b02020'),
      limb(39.4, 17.2, 34.8, 17.8, 0.5, 0.5, '#b02020'), limb(39, 18.8, 35.4, 19.2, 0.4, 0.4, '#b02020'),
      ...[[22.4, 49.4], [41.6, 49.4]].flatMap(([x, y]) => [ball(x, y, 1.9, 1.8, '#e0d8c0'), dots([[Math.floor(x - 1), Math.floor(y)], [Math.floor(x + 1), Math.floor(y)]], '#2a1a10')]),
    ],
  })),
  // Morrow, the Ghoul Lord: the oldest and fattest, gone yellow with age, a
  // crown of finger bones on its skull and somebody's thighbone in its jaws
  morrow: champion('ghoul', () => ({
    map: { '#8f9a84': '#a49a7a', '#5c6656': '#6e6650', '#b0b8a4': '#c4bc9a' },
    front: [
      ball(32, 38.6, 10.4, 8, '#b0a684'), ball(29, 36, 5, 3.6, '#c4bc9a'), ball(32, 41, 1, 0.8, '#6e6650'),
      hair(24, 38, 26.5, 42, '#8a8266'), hair(40, 38, 37.5, 42, '#8a8266'), hair(28, 44, 36, 44, '#8a8266'),
      ...[28, 30, 32, 34, 36].map((x, i) => limb(x, 12, x + (x - 32) * 0.15, 8.4 - (i % 2) * 0.8, 0.5, 0.4, '#f2eee0')),
      hair(27.5, 12, 36.5, 12, '#8a7a5a'),
      limb(21, 25.4, 43, 24.8, 1, 1, '#ece4d0'), ball(21, 25.4, 1.7, 1.5, '#f2eee0'), ball(43, 24.8, 1.7, 1.5, '#f2eee0'),
      hair(36, 24, 38, 26, '#8a2424'), specks([[24, 26.5], [40, 26]], '#8a2424'),
    ],
  })),
  // Orla, the Hollow Abbess: her habit gone grey, a white wimple about the dark
  // where her face was, her beads still in her hands, a cracked halo behind her
  orla: champion('wraith', () => ({
    map: { '#5b4483': '#8a8698', '#3a2a58': '#5a5668', '#22183a': '#2e2c38', '#7a64a4': '#b4b0c0', '#8a7ab4': '#a8a4b8' },
    back: oval(32, 6, 11, 2.6, 18).filter((_, i) => i !== 4 && i !== 5).map(([x, y]) => ball(x, y, 0.8, 0.7, '#f0e0a0', { glows: true })),
    front: [
      sheet([[23.4, 22], [24.4, 10.6], [28.4, 5.6], [29.2, 6.6], [25.8, 11.2], [24.8, 22]], '#e8e4dc'),
      sheet([[40.6, 22], [39.6, 10.6], [35.6, 5.6], [34.8, 6.6], [38.2, 11.2], [39.2, 22]], '#e8e4dc'),
      sheet([[25, 20.6], [39, 20.6], [37.4, 26.6], [32, 28.4], [26.6, 26.6]], '#e8e4dc', { curve: 0.8 }), hair(27, 22, 37, 22, '#b8b4ac'),
      ...[[28, 27.5], [28.6, 30], [29.6, 32.5], [31, 34.6], [33, 34.6], [34.4, 32.5], [35.4, 30], [36, 27.5]].map(([x, y]) => ball(x, y, 0.6, 0.6, '#c8b080')),
      line(32, 35, 32, 40.4, '#c9a24a'), line(30.4, 36.6, 33.6, 36.6, '#c9a24a'), specks([[31.75, 35.5]], '#f0d880'),
    ],
  })),
  // Gorrum, the Troll-Father: grey with years, the moss of his head gone white
  // into a long beard, the skulls of his own get strung round his neck
  gorrum: champion('troll', () => ({
    map: { '#58985c': '#5e7e6a', '#356a3c': '#3c5444', '#78b47a': '#7e9a86', '#2e4a26': '#c8c8bc', '#4a6e36': '#e8e8e0', '#5a4630': '#3e3a36', '#4c8a50': '#5a7262', '#3e7a44': '#4a6454' },
    // the mane, wild and white, spilling over his shoulders and down his back
    back: [
      ...both64(sheet([[20, 8], [24, 4], [22, 14], [17, 22], [14, 31], [12.5, 27], [14, 18]], '#bcbcb0', { curve: 0.8 })),
      ...both64(hair(18, 12, 14, 26, '#e8e8e0')), ...both64(hair(21, 10, 16.5, 24, '#9a9a90')),
    ],
    front: [
      ...[[23, 28.4], [26.6, 30.4], [37.4, 30.4], [41, 28.4]].flatMap(([x, y]) => [ball(x, y, 1.9, 1.7, '#e0d8c0'), dots([[Math.floor(x - 1), Math.floor(y)], [Math.floor(x + 1), Math.floor(y)]], '#2a2418')]),
      hair(21, 27, 43, 27, '#6a5a40'),
      sheet([[27, 23.6], [37, 23.6], [38.4, 30], [35.4, 36], [32, 40.4], [28.6, 36], [25.6, 30]], '#d8d8cc', { curve: 1 }),
      ...[[29, 25, 28.4, 35], [32, 25, 32, 39], [35, 25, 35.6, 35], [27, 26, 26.4, 31], [37, 26, 37.6, 31]].map(([a, b, c, d]) => hair(a, b, c, d, '#a8a89c')),
      specks([[30, 28], [34, 30], [31, 33]], '#f4f4ec'),
    ],
  })),
  // Skarrow, the Elder Wyrm: gone ash-brown with age, a third horn, a scar and
  // a clouded eye, and the fourth crew's steel heaped under her forefeet
  skarrow: champion('wyrm', pose => {
    const rear = pose === 'special', coil = pose === 'windup';
    const hx = coil ? 29 : 32, hy = rear ? 12 : coil ? 25 : 21, ey = hy - 1;
    return {
      map: { '#8a3622': '#5a4a3e', '#5a2016': '#3a2e26', '#3e140c': '#241a14', '#a44428': '#6e5e4e', '#c8966a': '#a89a86', '#a87a52': '#857866', '#dccaa0': '#e8e0d0', '#9a3e26': '#4e4034', '#b85438': '#7a6a58', '#6a2618': '#463a30', '#c05a36': '#8a7a68', '#c86a44': '#9a8a76' },
      front: [
        limb(hx, hy - 5.6, hx, hy - 13, 1.8, 0.5, '#e8e0d0'), hair(hx - 0.5, hy - 9, hx + 0.5, hy - 8.5, '#a8987a'),
        hair(hx - 8, hy - 5, hx - 3.5, hy + 1.5, '#c8b8a0'), ball(hx - 5, ey, 2.2, 1.2, '#d0d4c8'), specks([[hx - 5.5, ey - 0.5]], '#ffffff'),
        // the hoard: coin heaped and spilled, a gold-rimmed shield, a dented helm, a blade across it all
        ball(32, 61.4, 9, 2.2, '#a8842c'), ball(32, 60.8, 6.4, 1.6, '#d8b048'), specks([[27, 60.25], [31, 59.75], [35.5, 60.25], [29, 61.5], [34, 61.75], [38, 61.5], [22, 62.5], [42, 62.75]], '#ffe490'),
        ball(38.6, 59.4, 3.6, 2.4, '#7a5a30'), ball(38.6, 59.4, 2.6, 1.6, '#9a7444'), ball(38.6, 59.4, 0.9, 0.7, '#e8c060'), hair(35.4, 58.5, 41.8, 58.5, '#e8c060'),
        ball(25.4, 59.6, 2.8, 2, '#8a909c'), hair(23, 59, 27.8, 59, '#c8ced8'), sheet([[24, 59.8], [26.8, 59.8], [26.4, 61.4], [24.4, 61.4]], '#3a3e46'),
        limb(19, 62.2, 37, 58.4, 0.7, 0.45, '#c8ced8', { smooth: 1 }), hair(19.5, 61.75, 36, 58.25, '#ffffff'), line(21.4, 60.4, 22.2, 63, '#8a6a30'),
      ],
    };
  }),
};

// A fallen hero's shade rises in the gear of their trade: the dead knight's
// shape, and over it a thief's hood and cloak, a mage's hat, robe and staff, a
// cleric's mitre and tabard, a ranger's hood and bow, a druid's antlers and
// staff, all as cold and pale as the rest of it. (A fighter's is the knight.)
/** What hangs from the shield arm, turned with it as the blade swings (see the shade's windup). */
const shieldSide = (pose, parts) => (pose === 'windup' ? turn(parts, 20.5, 25, 25) : parts);
const SHADE_GEAR = {
  thief: champion('shade', pose => ({ front: [
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 52], [5, 48], [7, 34]], '#3a4a62', { curve: 0.8 }), hair(16, 30, 9, 46, '#5a6a84'), hair(20, 30, 15, 49, '#2e3a50')]),
    sheet([[23.4, 22], [24, 11], [28, 6.4], [36, 6.4], [40, 11], [40.6, 22], [38, 17], [32, 13.6], [26, 17]], '#4a5c78', { curve: 0.9 }),
    hair(24.5, 12, 28.5, 7, '#7a8ca8'), hair(39.5, 12, 35.5, 7, '#2e3a50'),
    sheet([[25.6, 17.4], [38.4, 17.4], [37.6, 21], [32, 22.6], [26.4, 21]], '#3a4a62', { curve: 0.6 }), hair(27, 19.5, 37, 19.5, '#5a6a84'),
  ] })),
  mage: champion('shade', pose => ({ front: [
    sheet([[19, 23], [45, 23], [48, 44], [44, 58], [38, 52], [32, 60], [26, 52], [20, 58], [16, 44]], '#4e5a8a', { curve: 1 }),
    ...[[24, 28, 21, 54], [32, 30, 32, 58], [40, 28, 43, 54]].map(([a, b, c, d]) => hair(a, b, c, d, '#3a4470')), hair(26, 23.5, 38, 23.5, '#9aa8d0'),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [7, 46], [8, 34]], '#4e5a8a', { curve: 0.8 }), limb(9, 58, 11, 9, 0.9, 0.8, '#8a9ab0'),
      ball(11, 7, 2.4, 2.6, '#b4e0ff', { glows: true }), specks([[8, 4], [14, 5], [12, 2]], '#e0f4ff', { glows: true })]),
    ball(32, 12.4, 11, 1.8, '#4e5a8a'), sheet([[23, 12], [41, 12], [36, 6.4], [31, 0.6], [28.6, 6.4]], '#4e5a8a', { curve: 0.6 }), hair(25, 11.75, 39, 11.75, '#9aa8d0'),
  ] })),
  cleric: champion('shade', () => ({ front: [
    sheet([[25, 23], [39, 23], [40, 41], [32, 43], [24, 41]], '#c8d4e8', { curve: 0.8 }), hair(25.5, 24, 25.5, 40, '#e8e0a0'), hair(38.5, 24, 38.5, 40, '#e8e0a0'),
    ball(32, 30, 2.6, 2.6, '#f0e8b0', { glows: true }),
    ...Array.from({ length: 8 }, (_, i) => i / 8 * Math.PI * 2).map(t => limb(32 + Math.cos(t) * 2.8, 30 + Math.sin(t) * 2.8, 32 + Math.cos(t) * 4.4, 30 + Math.sin(t) * 4.4, 0.45, 0.25, '#f4ecc0')),
    sheet([[25.6, 10], [28, 4], [32, 1.4], [36, 4], [38.4, 10], [38.4, 12.4], [25.6, 12.4]], '#c8d4e8', { curve: 0.4 }), hair(26, 11.5, 38, 11.5, '#e8e0a0'), line(32, 2.4, 32, 11, '#e8e0a0'),
  ] })),
  ranger: champion('shade', pose => ({ front: [
    limb(44, 25, 50, 11, 1.8, 1.6, '#5a6e6e'), ...[[48.6, 9.4], [50.6, 8.6], [52.4, 10]].map(([x, y]) => sheet([[x - 0.9, y + 3], [x, y], [x + 0.9, y + 3]], '#d8e8e8')),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [6, 46], [8, 34]], '#4e6a6a', { curve: 0.8 }),
      ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI, b = ((i + 1) / 8) * Math.PI; return hair(8 - Math.sin(a) * 5, 17 + i * 4.4, 8 - Math.sin(b) * 5, 17 + (i + 1) * 4.4, '#9ab0b0'); }),
      line(8, 17, 8, 52, '#d8e8e8')]),
    sheet([[23.4, 22], [24, 11], [28, 6.4], [36, 6.4], [40, 11], [40.6, 22], [38, 17], [32, 13.6], [26, 17]], '#4e6a6a', { curve: 0.9 }), hair(24.5, 12, 28.5, 7, '#7a9898'),
  ] })),
  druid: champion('shade', pose => ({ front: [
    sheet([[14, 24], [50, 24], [47, 31], [40, 29], [32, 33], [24, 29], [17, 31]], '#5a7a6a', { curve: 0.9 }),
    ...[[18, 26], [24, 28], [30, 29], [36, 29], [42, 28], [47, 26]].map(([x, y]) => hair(x, y, x + (x < 32 ? -0.6 : 0.6), y + 3, '#8ab09a')),
    ...shieldSide(pose, [sheet([[17, 24], [23, 24], [20, 44], [14, 50], [7, 46], [8, 34]], '#5a7a6a', { curve: 0.8 }), limb(9, 58, 10, 9, 1, 0.9, '#7a8a80'),
      ...[[7, 10], [13, 8], [9, 6.5]].map(([x, y]) => sheet([[x - 1.6, y], [x, y - 2.2], [x + 1.6, y], [x, y + 1.2]], '#8ac0a0'))]),
    ...both64(limb(27, 9, 22, 2, 0.9, 0.5, '#d0dce0')), ...both64(limb(24.4, 5.4, 20.6, 5, 0.6, 0.3, '#d0dce0')), ...both64(limb(23, 3.4, 24, 0.6, 0.5, 0.3, '#d0dce0')),
    hair(25.5, 9.75, 38.5, 9.75, '#6a8a7a'), ...[[27, 9.4], [32, 8.8], [37, 9.4]].map(([x, y]) => sheet([[x - 1.4, y], [x, y - 2], [x + 1.4, y], [x, y + 1.1]], '#8ac0a0')),
  ] })),
};

// The heroes, one to a class, head and shoulders, for the class picker, the
// hero sheet, the end of a run and its picture card: drawn as the creatures
// are, in the same light. Each is anyone at all who might take up that trade.
/** The face every portrait shares, in its own colours: eyes, brows, nose, mouth, ears. */
const face = (skin, skinDk, skinLt, eye, brow, lip) => [
  ...both64(ball(22.8, 27.4, 1.6, 2.6, skin)), ...both64(hair(22.6, 26, 22.8, 29, skinDk)),
  ball(32, 26, 9, 10.4, skin), ball(32, 32, 6.6, 4.2, skin), ball(30, 22, 4, 2.4, skinLt),
  ...both64(ball(28, 26.2, 2.4, 1.4, '#f2ece4')), ...both64(ball(28.3, 26.3, 1.2, 1.2, eye)), ...both64(ball(28.3, 26.3, 0.5, 0.5, '#140c0a')),
  ...both64(specks([[28.75, 25.75]], '#ffffff')), ...both64(hair(25.6, 24.9, 30.4, 24.9, skinDk)),
  ...both64(limb(25.2, 23, 30.2, 22.6, 0.9, 0.6, brow)),
  limb(32, 25.4, 32.3, 30, 0.9, 1.3, skinLt), ...both64(dots([[31, 31]], skinDk)), hair(30.5, 31.25, 33.5, 31.25, skinDk),
  ball(32, 34.4, 2.6, 0.9, lip), hair(29.6, 34.25, 34.4, 34.25, skinDk),
];
const PORTRAITS = {
  // the fighter: a nasal helm over a mail coif, plate at the shoulders, a red surcoat, a hilt over the shoulder
  fighter: () => {
    const steel = '#a8b0bc', steelDk = '#6a7280', steelLt = '#e0e8f0', mail = '#7e8692', skin = '#d8a888', skinDk = '#a87858', skinLt = '#ecc4a4';
    return [
      limb(47, 62, 52.6, 30, 1.2, 1.2, '#5a3a20'), line(48.6, 33, 56.4, 31.6, '#c9a24a'), ball(53, 28.4, 1.6, 1.6, '#c9a24a'),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], mail, { curve: 1 }),
      ...[48, 52, 56, 60].map(y => hair(8, y, 56, y, '#5e6672')), specks([[12, 50], [20, 47], [44, 47], [52, 50], [10, 58], [54, 58]], '#c8ced8'),
      sheet([[21, 45], [43, 45], [45, 64], [19, 64]], '#8a2020', { curve: 0.6 }), sheet([[29, 50], [35, 50], [35, 56], [32, 59], [29, 56]], '#d8a840', { curve: 0.4 }),
      hair(30, 51, 34, 55, '#8a6018'), hair(21, 45.5, 43, 45.5, '#c84040'),
      ...both64(ball(13, 49, 8.4, 6, steel)), ...both64(hair(7, 46, 17, 44, steelLt)), ...both64(hair(8, 51, 18, 50, steelDk)),
      sheet([[21, 22], [43, 22], [44, 42], [32, 45], [20, 42]], mail, { curve: 1 }), ...[36, 39, 42].map(y => hair(21, y, 43, y, '#5e6672')),
      ...face(skin, skinDk, skinLt, '#5a7a9a', '#5a3a24', '#9a5a4a'),
      sheet([[22, 24], [22.6, 16], [26, 11], [32, 9.4], [38, 11], [41.4, 16], [42, 24], [39, 21.6], [32, 20.8], [25, 21.6]], steel, { curve: 0.8 }),
      hair(25, 14, 31, 11, steelLt), line(22, 21.6, 42, 21.6, steelDk), limb(32, 19, 32, 29, 1, 0.9, steel), hair(31.75, 20, 31.75, 27, steelLt),
      ...both64(sheet([[22, 22], [25, 22], [24.4, 33], [22.4, 31]], steel, { curve: 0.4 })),
      specks([[24, 18], [40, 18], [32, 15]], steelDk),
    ];
  },
  // the cleric: white and gold vestments, a sun on a chain, close-cropped hair, a mace's head at the shoulder
  cleric: () => {
    const white = '#e8e2d2', whiteDk = '#b8b0a0', gold = '#d0a040', goldLt = '#f4d878', skin = '#8a5a3e', skinDk = '#5e3a26', skinLt = '#a8765a';
    return [
      limb(50, 64, 52, 36, 1, 1, '#6a4a2a'), ball(52.4, 33, 3.4, 3.2, '#8a909c'), ...[-1, 1].map(s => limb(52.4 + s * 3, 33, 52.4 + s * 4.6, 33, 0.8, 0.4, '#a8b0bc')),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], white, { curve: 1 }),
      ...[[14, 48, 10, 64], [50, 48, 54, 64], [26, 46, 24, 64], [38, 46, 40, 64]].map(([a, b, c, d]) => hair(a, b, c, d, whiteDk)),
      sheet([[24, 43], [29, 43], [29, 64], [24, 64]], gold, { curve: 0.3 }), sheet([[35, 43], [40, 43], [40, 64], [35, 64]], gold, { curve: 0.3 }),
      ...[48, 54, 60].flatMap(y => [hair(24.5, y, 28.5, y + 1.5, '#8a6018'), hair(35.5, y, 39.5, y + 1.5, '#8a6018')]),
      limb(32, 37, 32, 44, 4.4, 5, skinDk),
      ...face(skin, skinDk, skinLt, '#3a2414', '#1e140e', '#5a2e24'),
      sheet([[23, 22], [24, 15], [28, 11.4], [36, 11.4], [40, 15], [41, 22], [38, 17.4], [32, 16], [26, 17.4]], '#1e1612', { curve: 0.8 }),
      specks([[27, 15], [31, 13], [35, 14], [38, 17]], '#3a2a20'),
      hair(26, 40, 32, 47, gold), hair(38, 40, 32, 47, gold),
      ball(32, 49.6, 2.8, 2.8, gold), ball(32, 49.6, 1.4, 1.4, goldLt, { glows: true }),
      ...Array.from({ length: 8 }, (_, i) => i / 8 * Math.PI * 2).map(t => limb(32 + Math.cos(t) * 3, 49.6 + Math.sin(t) * 3, 32 + Math.cos(t) * 4.6, 49.6 + Math.sin(t) * 4.6, 0.5, 0.3, goldLt)),
    ];
  },
  // the mage: dark hair to the shoulders, a silver circlet with a lit stone, a high-collared robe, a staff crowned in crystal
  mage: () => {
    const robe = '#2a3a7a', robeDk = '#1a2450', robeLt = '#4a5aa0', silver = '#c8d0dc', skin = '#c08a68', skinDk = '#8a5a40', skinLt = '#d8a888', locks = '#2a1a14';
    return [
      limb(10, 64, 10, 18, 1.2, 1.2, '#4a3626'), ...[-1, 1].map(s => limb(10 + s * 1.6, 18, 10 + s * 2.4, 12, 0.5, 0.3, '#4a3626')),
      ball(10, 13, 2.8, 3.4, '#8ad0ff', { glows: true }), ball(9.4, 12, 1.2, 1.4, '#e0f4ff', { glows: true }), specks([[6, 9], [14, 10], [12, 6]], '#c0e8ff', { glows: true }),
      sheet([[20, 18], [44, 18], [47, 44], [17, 44]], locks, { curve: 1 }),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], robe, { curve: 1 }),
      ...[[14, 48, 11, 64], [50, 48, 53, 64], [32, 50, 32, 64]].map(([a, b, c, d]) => hair(a, b, c, d, robeDk)),
      sheet([[22, 40], [42, 40], [40, 48], [32, 51], [24, 48]], robeLt, { curve: 0.8 }), hair(23, 41, 41, 41, silver), hair(25, 47, 32, 50.5, silver), hair(39, 47, 32, 50.5, silver),
      ball(32, 50.4, 2, 2, '#8ad0ff', { glows: true }),
      limb(32, 37, 32, 42, 4.2, 4.8, skinDk),
      ...face(skin, skinDk, skinLt, '#3a6a3a', '#2a1a14', '#8a4a40'),
      sheet([[22.4, 24], [23, 16], [27, 11], [37, 11], [41, 16], [41.6, 24], [38.6, 17], [32, 15.4], [25.4, 17]], locks, { curve: 0.9 }),
      limb(23, 22, 21.6, 40, 1.8, 1.2, locks), limb(41, 22, 42.4, 40, 1.8, 1.2, locks), ...[[24, 20, 23, 34], [40, 20, 41, 34]].map(([a, b, c, d]) => hair(a, b, c, d, '#4a3428')),
      hair(23.5, 19.5, 40.5, 19.5, silver), ball(32, 19.4, 1.3, 1.1, '#8ad0ff', { glows: true }),
    ];
  },
  // the thief: hood up, a cloth over the mouth and nose, sharp eyes, a scar, leather and straps, a knife's hilt
  thief: () => {
    const hood = '#2e2a30', hoodDk = '#1a181c', hoodLt = '#48424a', leather = '#4a3424', skin = '#e0b896', skinDk = '#b08868', skinLt = '#f0d0b0';
    return [
      limb(13, 62, 10, 40, 1, 1, '#3a2a1a'), line(7.4, 41.6, 12.6, 40.4, '#a8b0bc'), ball(9.6, 38, 1.3, 1.3, '#a8b0bc'),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], leather, { curve: 1 }),
      limb(14, 46, 50, 64, 1.2, 1.2, '#2e2014'), ...[[23, 50.5], [38, 58]].map(([x, y]) => sheet([[x - 1.6, y - 1.2], [x + 1.6, y - 1.2], [x + 1.6, y + 1.2], [x - 1.6, y + 1.2]], '#c9a24a')),
      hair(10, 56, 18, 52, '#2e2014'), hair(46, 52, 54, 56, '#2e2014'),
      sheet([[14, 50], [19, 30], [22, 14], [32, 7], [42, 14], [45, 30], [50, 50], [40, 46], [32, 48], [24, 46]], hood, { curve: 1 }),
      ...face(skin, skinDk, skinLt, '#6a5a2a', '#3a2a1a', '#9a6050'),
      sheet([[22.8, 28.6], [41.2, 28.6], [40.4, 37], [32, 40], [23.6, 37]], '#3a3438', { curve: 0.8 }), hair(24, 31, 40, 31, '#4e484e'), hair(26, 35, 38, 35, '#4e484e'),
      hair(37, 22, 39.5, 28.5, '#a8705a'),
      sheet([[22, 30], [23, 17], [28, 12], [36, 12], [41, 17], [42, 30], [40, 21], [32, 17.6], [24, 21]], hoodLt, { curve: 0.9 }),
      sheet([[22, 30], [23, 17], [26, 14], [24.4, 22]], hoodDk, { curve: 0.5 }), sheet([[42, 30], [41, 17], [38, 14], [39.6, 22]], hoodDk, { curve: 0.5 }),
      specks([[30, 10], [36, 12], [18, 40], [46, 40]], hoodDk),
    ];
  },
  // the ranger: a braid, a feather in it, a green cloak's hood thrown back, a quiver of fletched arrows over the shoulder, the bowstring across the chest
  ranger: () => {
    const cloak = '#3e5a2e', cloakDk = '#28401c', cloakLt = '#5a7a44', leather = '#6a4a2e', skin = '#b07a58', skinDk = '#7e5038', skinLt = '#c89a78', locks = '#7a3a1e';
    return [
      limb(42, 64, 52, 26, 2.6, 2.6, '#5a3a22'), ...(/** @type {[number, number, string][]} */ ([[50, 24, '#f0ece0'], [52.6, 23, '#c84040'], [54.6, 25, '#f0ece0']])).map(([x, y, c]) => sheet([[x - 1, y + 4], [x, y], [x + 1, y + 4]], c)),
      ...[[49.5, 28], [52, 27], [54, 29]].map(([x, y]) => line(x, y, x - 1, y + 5, '#c8b890')),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], cloak, { curve: 1 }),
      ...[[12, 50, 9, 64], [52, 50, 55, 64]].map(([a, b, c, d]) => hair(a, b, c, d, cloakDk)),
      sheet([[22, 45], [42, 45], [42, 64], [22, 64]], leather, { curve: 0.6 }), ...[50, 56].map(y => hair(23, y, 41, y, '#4a321e')),
      sheet([[15, 46], [22, 38], [42, 38], [49, 46], [42, 44], [32, 46], [22, 44]], cloakLt, { curve: 0.8 }),
      line(16, 62, 46, 40, '#e8e0c8'),
      limb(32, 37, 32, 43, 4.2, 4.8, skinDk),
      ...face(skin, skinDk, skinLt, '#4a6a2a', '#5a2a14', '#8a4a38'),
      sheet([[22.4, 24], [23, 16], [27, 11], [37, 11], [41, 16], [41.6, 24], [37, 17.4], [32, 15.4], [27, 17.4]], locks, { curve: 0.9 }),
      ...[0, 1, 2, 3, 4].map(i => ball(41.6 + i * 0.6, 26 + i * 3.4, 1.6, 1.8, i % 2 ? '#8a4422' : locks)), ball(44.2, 42.4, 1, 1, '#c9a24a'),
      sheet([[40.4, 16], [44, 6.4], [42.4, 15.4]], '#d8d0b0'), hair(41.5, 15, 43.5, 8, '#8a7a5a'),
      hair(26, 13.5, 31, 12, '#a85a30'),
    ];
  },
  // the druid: wild hair under a circlet of antler and leaf, woad on the cheek, a fur mantle, a staff in leaf
  druid: () => {
    const robe = '#4e5a34', robeDk = '#323a20', fur = '#6a5a44', furLt = '#8a7a60', antler = '#d8c8a8', leaf = '#5a9a3a', skin = '#9a6a4a', skinDk = '#6a4430', skinLt = '#b4866a', locks = '#4a3a28';
    return [
      limb(53, 64, 54, 16, 1.4, 1.4, '#5a4026'), ...[[54, 18, 58, 13], [54, 22, 50, 17]].map(([a, b, c, d]) => limb(a, b, c, d, 0.7, 0.4, '#5a4026')),
      ...[[58.6, 12], [49.4, 16], [55, 14.6], [52, 20]].map(([x, y]) => sheet([[x - 1.6, y], [x, y - 2.4], [x + 1.6, y], [x, y + 1.4]], leaf)),
      sheet([[18, 16], [24, 8], [32, 6], [40, 8], [46, 16], [48, 34], [45, 44], [19, 44], [16, 34]], locks, { curve: 1 }),
      sheet([[4, 64], [7, 52], [16, 45], [26, 42], [38, 42], [48, 45], [57, 52], [60, 64]], robe, { curve: 1 }),
      ...[[14, 52, 10, 64], [50, 52, 54, 64], [32, 52, 32, 64]].map(([a, b, c, d]) => hair(a, b, c, d, robeDk)),
      sheet([[6, 56], [9, 47], [18, 42], [32, 44], [46, 42], [55, 47], [58, 56], [48, 52], [40, 54], [32, 51], [24, 54], [16, 52]], fur, { curve: 1 }),
      ...[[10, 50], [16, 46], [22, 47], [28, 46], [36, 46], [42, 47], [48, 46], [54, 50]].map(([x, y]) => hair(x, y, x + (x < 32 ? -1 : 1), y + 4, furLt)),
      limb(32, 37, 32, 43, 4.2, 4.8, skinDk),
      ...face(skin, skinDk, skinLt, '#7a6a2a', '#3a2a18', '#7a4434'),
      hair(26.5, 28.5, 25, 31.5, '#3e8a6a'), hair(27.5, 29, 26.5, 33, '#3e8a6a'), hair(37.5, 28.5, 39, 31.5, '#3e8a6a'),
      sheet([[22.4, 23], [23, 16], [27, 11.4], [37, 11.4], [41, 16], [41.6, 23], [38, 17.4], [32, 15], [26, 17.4]], locks, { curve: 0.9 }),
      ...[[20, 30, 19, 40], [44, 30, 45, 40], [22, 24, 20, 34], [42, 24, 44, 34]].map(([a, b, c, d]) => hair(a, b, c, d, '#6a5238')),
      hair(23.5, 17.5, 40.5, 17.5, '#6a4a2a'),
      ...both64(limb(25, 15, 20, 6, 1, 0.6, antler)), ...both64(limb(22, 10, 17, 8.6, 0.7, 0.3, antler)), ...both64(limb(20.6, 7.6, 21.6, 2.6, 0.6, 0.3, antler)),
      ...[[27, 16], [32, 15.4], [37, 16], [29.5, 15], [34.5, 15]].map(([x, y], i) => sheet([[x - 1.6, y], [x, y - 2.2], [x + 1.6, y], [x, y + 1.2]], i % 2 ? '#7ab84a' : leaf)),
    ];
  },
};

export { SHADE_GEAR, PORTRAITS, CHAMPIONS, CHAMPION_OF, CREATURES, POSES, PROPS, FLOATING, gridOf, paintParts, up2, ball, limb, sheet, line, dots, specks, hair, both };
