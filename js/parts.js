// The parts creatures, props and items are built from (balls, limbs, sheets,
// lines, dots, specks, hairs), the ways of moving and mirroring them, and the
// kits several creatures share: a scrag's head, a canine's body, the dark elves',
// dwarves' and lizardfolk's faces and gear. See creatures.js for how they are drawn.

import { insidePoly } from './painter.js';

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

export { RENEGADE, ball, both, both64, canine, dots, drowHair, drowHand, drowHead, drowKit, dwarfBody, dwarfHead, dwarfKit, grow, hair, limb, line, lizardBody, lizardHead, lizardKit, m64, midOf, nudge, oval, recolour, scimitar, scragHead, sheet, slats, specks, turn, up2, warPick };
