// Items drawn from lit parts, in the same hand as the creatures.
//
// Every piece of gear gets its own picture, so a chain shirt no longer looks
// like plate and a flail no longer looks like a mace. Weapons lie on the
// diagonal, grip at the lower left and point at the upper right, which is how
// they read best in a pack slot and uses the whole square. Potions keep one
// bottle shape per colour, so the colour is never the only clue.

import { ball, limb, sheet, line, specks, hair } from './creatures.js';
import { KEY_COLORS } from './data.js';

const STEEL = '#b4bcc8', DARK_STEEL = '#7a808c', IRON = '#6e727c', BRASS = '#c8a040', GOLD = '#e8b830';
const WOOD = '#8a5a32', DARK_WOOD = '#6a4224', WRAP = '#5a3a22', GLASS = '#aebfd2', CORK = '#9a6a3a';

// The weapon axis: s is the distance from the lower-left corner along the
// diagonal, off the distance across it (negative toward the upper left).
const at = (s, off = 0) => [4 + (s + off) * Math.SQRT1_2, 28 + (off - s) * Math.SQRT1_2];
const axis = (s0, s1, r0, r1, c, o) => limb(...at(s0), ...at(s1), r0, r1, c, o);
/** A straight blade from s0 to its point at s1, w wide, with a bright fuller. */
function blade(s0, s1, w, c = STEEL, tipLen = w * 1.3) {
  const b = s1 - tipLen;
  return [
    sheet([at(s0, -w / 2), at(b, -w / 2), at(s1), at(b, w / 2), at(s0, w / 2)], c, { tilt: [-0.3, -0.35] }),
    line(...at(s0 + 1), ...at(b - 0.5), '#e8eef6'),
  ];
}
/** A crossguard across the axis at s. */
const guard = (s, len, c = BRASS, r = 0.95) => limb(...at(s, -len / 2), ...at(s, len / 2), r, r, c);
/** A ring of short limbs: a hole you can see through, not a painted dot. */
function ring(cx, cy, r, w, c, n = 12) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    out.push(limb(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, w, w, c));
  }
  return out;
}
/** The part of an ellipse above the line y = cut, as a polygon. */
function capAbove(cx, cy, rx, ry, cut) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + i / 24 * Math.PI;           // left, over the top, to the right
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (y <= cut) pts.push([x, y]);
  }
  const dy = (cut - cy) / ry, dx = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
  return [[cx - dx, cut], ...pts, [cx + dx, cut]];
}

// the shape every body armour is cut from: sloping shoulders, arm holes, the
// waist drawn in a little
const TORSO = [[6, 9], [11, 6], [13.5, 7.5], [18.5, 7.5], [21, 6], [26, 9], [26.5, 14], [24.5, 16], [24, 27], [8, 27], [7.5, 16], [5.5, 14]];
const NECK = [[13.5, 7.5], [18.5, 7.5], [17.5, 11], [14.5, 11]];
/** Whether a point lies inside a polygon. */
function inPoly(pts, px, py) {
  let inn = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inn = !inn;
  }
  return inn;
}
/** Points on a staggered lattice inside a polygon, row by row from the top, for rings, scales and rivets. */
function lattice(pts, dx, dy, y0, y1, test) {
  const out = [];
  for (let r = 0, y = y0; y <= y1; r++, y += dy) for (let x = 3 + (r % 2) * dx / 2; x < 29; x += dx) {
    if (inPoly(pts, x, y) && (!test || test(x, y))) out.push([x, y, r]);
  }
  return out;
}
/** One scale of a scale shirt, its point hanging down: a leaf of metal sewn on at the top. */
const scaleAt = (x, y, k) => [[x - k, y - 0.9 * k], [x + k, y - 0.9 * k], [x + k, y + 0.2 * k], [x, y + 1.3 * k], [x - k, y + 0.2 * k]];
/** A shoulder guard of overlapping lames, the lowest drawn first so each above laps over it. */
function pauldron(side, n, c, edge, lit) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const y = 8 + i * 1.7, m = x => (side < 0 ? x : 32 - x);
    out.push(sheet([[m(3.6), y + 1.4], [m(6.4), y - 1.6], [m(11), y - 0.8], [m(12), y + 1.2], [m(5), y + 3]], i % 2 ? shade(c, -0.12) : c, { curve: 1, tilt: [side * 0.5, -0.4] }));
    out.push(hair(m(5), y - 0.6, m(10.5), y - 0.2, lit), hair(m(4.5), y + 2.4, m(11.5), y + 1.4, edge));
  }
  return out;
}

// A robe: a gown that flares to the floor, bell sleeves, a hood fallen behind
// the neck, a sash at the waist and a trimmed hem and opening. The folds are
// panels of light and shade with creases between them, as cloth falls.
const ROBE = [[7, 8], [11, 5], [13, 7.5], [19, 7.5], [21, 5], [25, 8], [29.5, 16.5], [26, 18], [23, 18.5], [28.5, 30], [3.5, 30], [9, 18.5], [6, 18], [2.5, 16.5]];
function robe(cloth, light, trim, extra) {
  const dark = shade(cloth, -0.3), crease = shade(cloth, -0.45);
  return [
    ball(16, 6.5, 5.5, 3, shade(cloth, -0.35)),          // the hood, behind
    sheet(ROBE, cloth, { curve: 1 }),
    sheet([[10, 9], [13.5, 9], [12.5, 30], [5, 30], [9.4, 18.6]], light, { curve: 0.8 }), sheet([[18.5, 9], [22, 9], [22.6, 18.6], [27, 30], [20, 30]], dark, { curve: 0.8 }),
    sheet([[3, 16.4], [7, 9.6], [9, 12], [6.5, 17.8]], light, { curve: 0.8 }), sheet([[29, 16.4], [25, 9.6], [23, 12], [25.5, 17.8]], dark, { curve: 0.8 }),
    ...[[12, 19, 8, 29.5], [14, 19, 12.5, 29.6], [18, 19, 19.5, 29.6], [20.5, 19, 24.5, 29.5], [11, 10.5, 10.5, 17.5], [21, 10.5, 21.5, 17.5]].map(([a, b, c, d]) => hair(a, b, c, d, crease)),
    sheet(NECK, shade(cloth, -0.55)),
    // trim down the opening and round the hem and the cuffs
    line(16, 11, 16, 29.5, trim), line(4.5, 29.5, 27.5, 29.5, trim),
    line(3, 16.5, 6.5, 17.8, trim), line(25.5, 17.8, 29, 16.5, trim),
    // the sash, knotted, its ends hanging
    limb(9.5, 18.5, 22.5, 18.5, 1, 1, shade(cloth, -0.45)), hair(10, 17.75, 22, 17.75, shade(cloth, -0.2)),
    ball(14, 18.6, 1.1, 1, shade(cloth, -0.5)), limb(13.6, 19.4, 12.8, 23, 0.5, 0.4, shade(cloth, -0.45)), limb(14.4, 19.4, 14.6, 22.4, 0.5, 0.4, shade(cloth, -0.45)),
    ...extra,
  ];
}

// A cloak: a hood fallen behind the neck, a mantle hung from a clasp and
// falling wide to the hem in folds, lit down one side.
const CLOAK = [[11, 6], [21, 6], [24, 10], [27, 29], [5, 29], [8, 10]];
function cloak(cloth, light, clasp, extra) {
  const dark = shade(cloth, -0.35), crease = shade(cloth, -0.5);
  return [
    ball(16, 6, 6, 3, shade(cloth, -0.35)),                 // the hood, behind
    sheet(CLOAK, cloth, { curve: 0.6 }),
    sheet([[9, 9], [13, 9], [11.5, 29], [5.2, 29]], light, { curve: 0.8 }), sheet([[19, 9], [23, 9], [26.8, 29], [20.5, 29]], dark, { curve: 0.8 }),
    ...[[10.5, 10, 7.5, 28.6], [13, 10, 12.5, 28.8], [16, 11, 16, 28.8], [19, 10, 19.5, 28.8], [21.5, 10, 24.5, 28.6]].map(([a, b, c, d]) => hair(a, b, c, d, crease)),
    hair(6, 28.6, 26, 28.6, crease),
    ball(16, 8, 1.8, 1.8, clasp, { smooth: 1 }), specks([[15.5, 7.5]], '#ffffff'),       // the clasp at the throat
    ...extra,
  ];
}

/** A glass bottle: glass above the liquid line, the draught below, a cork. */
function bottle(bodyParts, liquidParts, neck, glints) {
  return [
    ...bodyParts,
    ...liquidParts,
    ...neck,
    ...glints.map(([x, y], i) => (i % 2 ? specks([[x + 0.25, y + 0.25]], '#f4fbff') : hair(x + 0.25, y, x + 0.5, y + 1.5, '#f4fbff'))),
  ];
}

/**
 * An oil comes in a squat flask with a rag for a stopper, tied with cord, so
 * it is never taken for a potion; the colour of what is in it says which.
 */
function flask(liquid, light) {
  return [
    ball(16, 23, 11.5, 6.6, liquid),
    sheet(capAbove(16, 23, 11.5, 6.6, 18.8), GLASS, { curve: 1 }),
    limb(16, 12.5, 16, 17.5, 4.6, 5, GLASS),
    ball(16, 11.5, 5.2, 2.6, '#c8b890'),                   // the rag
    limb(13.5, 10, 11, 6.5, 1.3, 0.6, '#c8b890'),           // and its loose end
    limb(11.4, 14.4, 20.6, 14.4, 0.7, 0.7, '#7a5a38'),      // the cord round the neck
    hair(9.5, 20.5, 9, 24, '#f4fbff'), specks([[11.25, 26.25]], '#f4fbff'),
    specks([[18.25, 25.25], [21.25, 23.25], [15.25, 27.25], [19.75, 26.75]], light), hair(13, 26, 20, 27.5, shade(light, -0.3)),
  ];
}

/**
 * A ring lying at a slant: a band seen as an ellipse, thick and bright at the
 * front, thinner and in shadow at the back, and a stone in a setting on top
 * where it has one. Without a stone the band itself is the thing to see.
 */
function jewelRing(band, dark, stone, hi, plainMark) {
  const out = [], cx = 16, cy = 20, rx = 11, ry = 6.8, n = 40;
  // the band as two smooth halves, the far one in shadow behind the near
  const half = (a0, a1, w, c) => {
    const at2 = (a, r) => [cx + Math.cos(a) * (rx + r), cy + Math.sin(a) * (ry + r * 0.7)];
    const pts = [];
    for (let i = 0; i <= n / 2; i++) pts.push(at2(a0 + (a1 - a0) * i / (n / 2), w));
    for (let i = n / 2; i >= 0; i--) pts.push(at2(a0 + (a1 - a0) * i / (n / 2), -w));
    return sheet(pts, c, { curve: 1, smooth: 1 });
  };
  out.push(half(Math.PI - 0.15, Math.PI * 2 + 0.15, stone ? 1.05 : 1.4, shade(band, -0.28)), half(0, Math.PI, stone ? 1.6 : 2.1, band));
  // the light running along the band's front, and its shadowed inner edge
  for (let i = 5; i < 15; i++) {
    const a0 = i / 20 * Math.PI, a1 = (i + 1) / 20 * Math.PI;
    out.push(hair(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry - 0.6, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry - 0.6, hi || '#ffffff'));
  }
  out.push(hair(cx - rx + 1.5, cy - 1, cx - rx + 3.5, cy - 3.6, shade(dark, -0.3)), hair(cx + rx - 1.5, cy - 1, cx + rx - 3.5, cy - 3.6, shade(dark, -0.3)));
  if (stone) {
    const sy = cy - ry - 3.4;
    out.push(ball(cx, cy - ry - 0.6, 4.2, 2.2, dark, { smooth: 1 }),
      ...[-1, 1].flatMap(d => [limb(cx + d * 3, cy - ry - 1.2, cx + d * 2.4, sy - 1.4, 0.55, 0.4, band), limb(cx + d * 1.2, cy - ry - 0.6, cx + d * 1, sy + 2.2, 0.5, 0.35, band)]),
      ball(cx, sy, 3.6, 3.3, stone, { smooth: 1 }),
      sheet([[cx - 1.7, sy - 2], [cx + 1.7, sy - 2], [cx + 2.5, sy - 0.4], [cx - 2.5, sy - 0.4]], shade(stone, 0.3), { smooth: 1 }),
      hair(cx - 2.5, sy - 0.4, cx, sy + 2.8, shade(stone, -0.3)), hair(cx + 2.5, sy - 0.4, cx, sy + 2.8, shade(stone, -0.2)),
      specks([[cx - 1.25, sy - 1.75], [cx - 0.75, sy - 2.25]], hi), specks([[cx + 1.5, sy + 1]], '#ffffff'));
  } else if (plainMark) out.push(...plainMark(cx, cy, rx, ry));
  return out;
}
/** An amulet: a fine chain hung in a curve from the top corners, and a pendant in its bezel. */
function jewelAmulet(chain, frame, stone, hi, cord) {
  const out = [];
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, x = 4 + t * 24, y = 2 + Math.sin(t * Math.PI) * 13; pts.push([x, y]); }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (cord) out.push(limb(x0, y0, x1, y1, 0.6, 0.6, chain), ...(i % 3 ? [] : [hair(mx - 0.3, my - 0.3, mx + 0.3, my + 0.3, shade(chain, -0.35))]));
    else out.push(i % 2 ? limb(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2, x1 - (x1 - x0) * 0.2, y1 - (y1 - y0) * 0.2, 0.35, 0.35, frame) : ball(mx, my, 0.7, 0.55, chain, { smooth: 1 }));
  }
  out.push(ball(16, 17.4, 1.2, 1.4, frame, { smooth: 1 }), ball(16, 24, 6.4, 7, frame, { smooth: 1 }), ball(16, 24, 5.4, 6, shade(frame, -0.25), { smooth: 1 }));
  out.push(ball(16, 24, 4.6, 5.2, stone, { smooth: 1 }), ball(14.8, 22.4, 2, 2.2, shade(stone, 0.25), { smooth: 1 }));
  out.push(hair(13.6, 21.4, 14.6, 20.2, hi), specks([[17.5, 27]], shade(stone, 0.4)));
  out.push(...[[16, 17.4], [11.4, 21], [20.6, 21], [11.4, 27], [20.6, 27], [16, 30.6]].map(([x, y]) => specks([[x, y]], shade(frame, 0.35))));
  return out;
}

// A long bow's stave, top nock to bottom: a tall yew D the full height of the
// square, bowed less deeply than the short bow and with no recurve at the
// tips, so beside it in the pack it reads as the longer, plainer weapon.
const YEW = '#5a3218', YEW_SAP = '#d0a468', HORN = '#e2d4b0';
function longStave() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([7 + Math.sin(t * Math.PI) * 8.5, 1 + t * 30]);
  }
  return pts;
}

/** Marks a pixel of the coarse grid each, painted a quarter as large: a glint, a stud, a stitch. */
const fine = (pts, c) => specks(pts.map(([x, y]) => [Math.floor(x) + 0.25, Math.floor(y) + 0.25]), c);

const ITEM_ART = {
  // ---- rings and amulets: each look its own metal and stone ----
  ring_silver: () => jewelRing('#c8ccd4', '#80868f', '#3a6ad8', '#a8c8ff'),
  ring_gold: () => jewelRing('#e8b830', '#9a7418', '#d02a3a', '#ff9aa4'),
  ring_garnet: () => jewelRing('#b4bcc8', '#6e727c', '#8a1a3a', '#e06080'),
  ring_onyx: () => jewelRing('#c8ccd4', '#80868f', '#1a1a22', '#8a8a9a'),
  ring_copper: () => jewelRing('#c87a40', '#7a4420', '#e8a030', '#ffe0a0'),
  // the Forge-Thane's: dark iron with a vein of copper, and a stone like a coal
  ring_forge: () => [...jewelRing('#585c64', '#2c2e32', '#e0602a', '#ffb070'), ...[0.15, 0.35, 0.55, 0.75].map(t => hair(16 + Math.cos(t * Math.PI) * 6.4, 20 + Math.sin(t * Math.PI) * 4.4, 16 + Math.cos((t + 0.12) * Math.PI) * 6.4, 20 + Math.sin((t + 0.12) * Math.PI) * 4.4, '#c87a3a'))],
  ring_jade: () => jewelRing('#4aa070', '#2a6a48', null, '#9ae0b8', (cx, cy, rx, ry) => [fine([[cx - 4, cy + ry - 0.5], [cx - 3, cy + ry], [cx + 2, cy + ry + 0.2]], '#bff0d0')]),
  ring_bone: () => jewelRing('#e8dcc0', '#a89c80', null, '#ffffff', (cx, cy, rx, ry) => [0.2, 0.35, 0.5, 0.65, 0.8].map(t => { const a = t * Math.PI; return fine([[cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]], '#6a5c44'); })),
  ring_iron: () => jewelRing('#6e727c', '#3a3e46', null, '#b4bcc8', (cx, cy, rx, ry) => [0.25, 0.5, 0.75].map(t => { const a = t * Math.PI; return ball(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.9, 0.9, '#9aa0a8'); })),
  amulet_amber: () => jewelAmulet('#e8b830', '#9a7418', '#e8a030', '#ffe0a0'),
  amulet_silver: () => jewelAmulet('#c8ccd4', '#80868f', '#d8e8f8', '#ffffff'),
  amulet_obsidian: () => jewelAmulet('#6e727c', '#3a3e46', '#1a1622', '#8a7aa8'),
  amulet_bone: () => jewelAmulet('#8a5a32', '#a89c80', '#e8dcc0', '#ffffff', true),
  // the High Priestess's: a black stone in silver, worked as a spider, its eyes garnets
  amulet_spider: () => [
    ...jewelAmulet('#c8ccd4', '#80868f', '#241a2c', '#8a7aa8'),
    ...[-1, 1].flatMap(sd => [[2.4, -3.4, 7.4, -7], [3.2, -0.8, 8.4, -1.6], [3, 1.8, 8, 4.4], [2.2, 4, 6.2, 8.4]].flatMap(([a, b, c, d]) => [
      limb(16 + sd * a, 24 + b, 16 + sd * (a + c) / 2, 24 + Math.min(b, d) - 1.2, 0.45, 0.4, '#c8ccd4'), limb(16 + sd * (a + c) / 2, 24 + Math.min(b, d) - 1.2, 16 + sd * c, 24 + d, 0.4, 0.3, '#c8ccd4')])),
    ball(14.8, 20.4, 0.7, 0.7, '#e8303a', { glows: true }), ball(17.2, 20.4, 0.7, 0.7, '#e8303a', { glows: true }),
  ],
  // ---- blades ----
  // a dark elf's curved blade: a grip bound in silver wire, a slight guard with a violet stone,
  // and a blade that sweeps wider toward the point, the edge bright along the curve
  scimitar: () => {
    const bend = s => 0.014 * (s - 11) * (s - 11), wide = s => 1.3 + (s - 11) * 0.07;
    const back = [], edge = [];
    for (let s = 11; s <= 27; s += 2) { back.push(at(s, -wide(s) + bend(s))); edge.unshift(at(s, wide(s) + bend(s))); }
    return [
      axis(4, 10.2, 1, 1, '#2a1e30'), ...[5, 6.5, 8, 9.5].map(s => hairAt(s, -0.9, s + 0.4, 0.9, '#b8bccc')),
      ball(...at(3.2), 1.4, 1.3, '#b8bccc'), specks([at(2.8, -0.5)], '#eef0f8'),
      limb(...at(10.6, -3.4), ...at(11, 3.4), 0.7, 0.7, '#b8bccc'),
      sheet([...back, at(29.5, bend(29.5) - 0.6), ...edge], '#cdd2de', { tilt: [-0.3, -0.35] }),
      ...[0, 1, 2, 3, 4, 5, 6].map(i => { const s = 11.5 + i * 2.2, t = s + 2.2; return hairAt(s, wide(s) + bend(s) - 0.45, t, wide(t) + bend(t) - 0.45, '#f4f8ff'); }),
      ...[0, 1, 2, 3, 4].map(i => { const s = 12 + i * 3; return hairAt(s, -wide(s) + bend(s) + 0.4, s + 3, -wide(s + 3) + bend(s + 3) + 0.4, '#8a909e'); }),
      ball(...at(10.9), 0.85, 0.85, '#8a3ac0'), specks([at(10.7, -0.3)], '#e0c0ff'),
    ];
  },
  dagger: () => [
    axis(5.5, 10, 1.05, 1.05, WRAP), ball(...at(4.9), 1.25, 1.25, BRASS), specks([at(4.5, -0.4)], '#fff0a0'),
    guard(10.5, 5.2, BRASS, 0.7), ...blade(11, 22, 2.5),
  ],
  shortsword: () => [
    // a soldier's blade: plain steel fittings, quillons swept toward the point
    axis(4.5, 10, 1.15, 1.15, '#3e2a1c'), ball(...at(3.7), 1.45, 1.45, DARK_STEEL), specks([at(3.3, -0.5)], '#e8ecf2'),
    limb(...at(10.2, -4.5), ...at(11.5, -1), 0.9, 0.9, DARK_STEEL), limb(...at(10.2, 4.5), ...at(11.5, 1), 0.9, 0.9, DARK_STEEL),
    ball(...at(10.8), 1.4, 1.4, DARK_STEEL),
    ...blade(11.5, 26.5, 3.3),
  ],
  longsword: () => [
    axis(3.2, 10.5, 1.1, 1.1, WRAP), ...[4.4, 5.6, 6.8, 8, 9.2].map(s => hairAt(s, -1, s + 0.5, 1, '#3a2414')),
    ball(...at(2.5), 1.5, 1.5, STEEL), specks([at(1.6)], '#5a606c'), specks([at(2.1, -0.6)], '#f4f8ff'),
    guard(11, 10.4, DARK_STEEL, 0.75), ball(...at(11, -5.3), 0.8, 0.8, DARK_STEEL), ball(...at(11, 5.3), 0.8, 0.8, DARK_STEEL),
    ...blade(11.5, 31, 3.1),
  ],
  greatsword: () => [
    axis(2, 10.5, 1.3, 1.3, '#4a2e1a'),
    ...[3.5, 5.5, 7.5, 9.5].map(s => guard(s, 2.6, '#7a5230', 0.55)),
    ball(...at(1.4), 1.7, 1.7, BRASS), specks([at(0.9, -0.6)], '#fff0a0'),
    // swept quillons, a leather-wrapped ricasso, then a blade as long as a man's leg
    limb(...at(11, -7), ...at(12.2, -3), 0.85, 0.75, BRASS), limb(...at(11, 7), ...at(12.2, 3), 0.85, 0.75, BRASS),
    guard(12, 6.5, BRASS, 0.9),
    ...blade(12.8, 33.5, 3.8),
    axis(13, 16, 1.5, 1.5, WRAP),
  ],
  throwknife: () => {
    // three balanced knives, fanned: ring pommels, no guards, all blade
    const knife = (off, s) => [
      ...ring(...at(s + 3.5, off), 1.3, 0.55, IRON, 8),
      limb(...at(s + 5, off), ...at(s + 8, off), 0.95, 0.95, WRAP),
      sheet([at(s + 8, off - 1.3), at(s + 15, off - 1.3), at(s + 18.5, off), at(s + 15, off + 1.3), at(s + 8, off + 1.3)], STEEL, { tilt: [-0.3, -0.35] }),
      line(...at(s + 9, off), ...at(s + 15, off), '#e8eef6'),
    ];
    return [...knife(-6.5, 3), ...knife(6.5, 3), ...knife(0, 6)];
  },

  // ---- hafted ----
  club: () => [
    axis(3, 27, 1.2, 3.4, WOOD),
    axis(3, 8, 1.45, 1.6, WRAP),
    ...[[16, 1.5], [21, -1.5], [24, 1.8]].flatMap(([s, o]) => [ball(...at(s, o), 0.7, 0.6, DARK_WOOD), specksAt([[s + 0.4, o + 0.3]], '#3a2414')]),
    specksAt([[18, -2.2], [25.5, -1], [12, 0.8]], '#b07a48'),
  ],
  staff: () => [
    axis(0.5, 30, 1.15, 1.15, WOOD),
    ball(...at(0.2), 1.2, 1.2, IRON),
    axis(27.5, 29, 1.6, 1.6, BRASS), axis(12, 15, 1.35, 1.35, WRAP),
    ball(...at(31), 2.6, 2.6, '#58b8f0', { glows: true }), ball(...at(31.4, 0.5), 1.4, 1.4, '#3a88c8', { glows: true }),
    specks([at(30.3, -1.1), at(30.6, -1.4)], '#e8faff'),
  ],
  spear: () => [
    axis(0.5, 24, 0.95, 0.95, WOOD),
    ball(...at(0.3), 1.1, 1.1, IRON),
    axis(22.5, 25, 1.35, 1.35, WRAP),
    // a leaf-shaped head, widest a third of the way up
    sheet([at(24.5, -0.8), at(27.5, -2.2), at(33, 0), at(27.5, 2.2), at(24.5, 0.8)], STEEL, { tilt: [-0.3, -0.35] }),
    line(...at(25.5), ...at(31), '#e8eef6'),
  ],
  mace: () => {
    const c = at(25.5);
    const flanges = [0, 1, 2, 3, 4, 5].map(i => {
      const a = i / 6 * Math.PI * 2 + 0.3;
      return limb(c[0], c[1], c[0] + Math.cos(a) * 4.6, c[1] + Math.sin(a) * 4.6, 1.3, 0.6, DARK_STEEL);
    });
    return [
      axis(2, 23, 1.1, 1.2, DARK_WOOD), axis(2, 8, 1.35, 1.35, WRAP),
      ball(...at(1.7), 1.2, 1.2, IRON),
      ...flanges,
      ball(c[0], c[1], 3.4, 3.4, IRON),
      ball(...at(29.2), 1.2, 1.2, DARK_STEEL),
    ];
  },
  hammer: () => [
    axis(2, 25, 1.05, 1.05, WOOD), axis(2, 8, 1.3, 1.3, WRAP),
    // a squared head with a beak behind it and a spike on top
    sheet([at(22, 1), at(22, -7), at(26.5, -7), at(26.5, 1)], IRON, { tilt: [-0.35, -0.3] }),
    sheet([at(22.5, -7), at(26, -7), at(24.2, -9.5)], DARK_STEEL, { tilt: [-0.4, -0.2] }),
    sheet([at(22.5, 1), at(26, 1), at(24.3, 7)], DARK_STEEL, { tilt: [-0.2, -0.4] }),
    axis(26.5, 30.5, 1.1, 0.4, DARK_STEEL),
    line(...at(22.5, -6.5), ...at(26, -6.5), '#c8ccd6'),
  ],
  flail: () => {
    const links = [[15.8, 15.9], [17.2, 15.6], [18.6, 15.9], [19.8, 16.8], [20.7, 18]];
    const c = [22.5, 21.5];
    const spikes = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const a = i / 8 * Math.PI * 2;
      return limb(c[0] + Math.cos(a) * 2.5, c[1] + Math.sin(a) * 2.5, c[0] + Math.cos(a) * 5, c[1] + Math.sin(a) * 5, 0.9, 0.3, DARK_STEEL);
    });
    return [
      axis(2, 14, 1.25, 1.35, WOOD), axis(2, 7, 1.45, 1.45, WRAP),
      ball(...at(14.8), 1.5, 1.5, IRON),
      ...links.map(([x, y], i) => ball(x, y, 0.85, 0.85, i % 2 ? IRON : DARK_STEEL)),
      ...spikes,
      ball(c[0], c[1], 3.4, 3.4, IRON),
    ];
  },
  battleaxe: () => [
    axis(0.5, 31, 1.05, 1.05, WOOD), axis(1, 7, 1.3, 1.3, WRAP),
    // a crescent that flares from a narrow neck at the haft, and a back spike
    sheet([at(23.5, -1), at(22, -4), at(18.5, -8), at(18.5, -10.5), at(21.5, -11.8), at(24.5, -12.2), at(27.5, -11.8), at(30.5, -10.5),
      at(30.5, -8), at(27, -4), at(25.5, -1)], '#9aa2ae', { tilt: [0.15, -0.25] }),
    line(...at(18.8, -10.4), ...at(21.5, -11.6), '#eef3fa'), line(...at(21.5, -11.6), ...at(27.5, -11.6), '#eef3fa'),
    line(...at(27.5, -11.6), ...at(30.3, -10.4), '#eef3fa'),
    sheet([at(23.2, 1), at(24.5, 6), at(25.8, 1)], DARK_STEEL, { tilt: [-0.2, -0.4] }),
    axis(22.8, 26.2, 1.45, 1.45, IRON),
    axis(31, 33, 1, 0.3, DARK_STEEL),
  ],

  // ---- missiles ----
  sling: () => [
    ...ring(8, 6.5, 2, 0.55, '#a07848', 10),
    limb(9.5, 8, 13, 15, 0.55, 0.55, '#a07848'), limb(13, 15, 16, 20, 0.55, 0.55, '#a07848'),
    limb(21, 20, 24, 14, 0.55, 0.55, '#a07848'), limb(24, 14, 26, 8, 0.55, 0.55, '#a07848'),
    ball(26.3, 7.3, 1, 1, '#7a5230'),
    ball(18.5, 21.5, 4.2, 2.8, '#7a5230'),
    ball(18.5, 19.8, 2.3, 2.1, '#8e8a84'),
    fine([[17, 19]], '#d8d4cc'),
  ],
  shortbow: () => {
    // a recurved stave bowed toward the right, string taut on the left
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, y = 3 + t * 26, bulge = Math.sin(t * Math.PI);
      pts.push([10 + bulge * 10 - (t < 0.12 || t > 0.88 ? 1.5 : 0), y]);
    }
    const stave = [];
    for (let i = 0; i < 8; i++) {
      const r = 1.2 - Math.abs(i - 3.5) * 0.12;
      stave.push(limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, r, i === 3 || i === 4 ? WRAP : '#9a6a3a'));
    }
    return [
      line(pts[0][0], pts[0][1], pts[8][0], pts[8][1], '#e8e0cc'),
      line(5, 16, 27, 16, '#b08858'),
      sheet([[26, 14], [30, 16], [26, 18]], STEEL, { tilt: [-0.3, -0.4] }),
      sheet([[4, 13.6], [7, 15.4], [7, 16], [4.6, 15.4]], '#e04838'), sheet([[4, 18.4], [7, 16.6], [7, 16], [4.6, 16.6]], '#c03828'), hair(4.5, 14.5, 6.5, 15.5, '#ff8070'),
      ...stave,
      ball(pts[0][0], pts[0][1], 0.9, 0.9, '#6a4424'), ball(pts[8][0], pts[8][1], 0.9, 0.9, '#6a4424'),
    ];
  },
  longbow: () => {
    const pts = longStave(), r = i => 1.25 - Math.abs(i - 5) * 0.1;
    const stave = [];
    for (let i = 0; i < 10; i++) stave.push(limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r(i), r(i + 1), YEW));
    return [
      line(pts[0][0], pts[0][1] + 0.5, pts[10][0], pts[10][1] - 0.5, '#e8e0cc'),
      // a long arrow, nocked across the grip, its head well past the belly
      line(3, 16, 27.5, 16, '#a88050'),
      sheet([[27, 14.2], [31, 16], [27, 17.8]], STEEL, { tilt: [-0.3, -0.4] }),
      sheet([[2, 13.6], [6, 15.4], [6, 16], [2.6, 15.4]], '#e4e0d4'), sheet([[2, 18.4], [6, 16.6], [6, 16], [2.6, 16.6]], '#c8c4b8'), hair(2.5, 14.5, 5.5, 15.5, '#ffffff'),
      ...stave,
      // a leather wrap round the grip, longer than the short bow's cord
      limb(pts[4][0] + 0.2, 12.8, pts[6][0] + 0.2, 19.2, 1.55, 1.55, '#4a2c18'),
      // horn nocks capping both tips
      limb(pts[0][0] + 0.8, pts[0][1] + 2.6, pts[0][0], pts[0][1], 0.95, 0.7, HORN),
      limb(pts[10][0] + 0.8, pts[10][1] - 2.6, pts[10][0], pts[10][1], 0.95, 0.7, HORN),
    ];
  },

  // boiled leather, laced up the front, the shoulders in layered caps, stitched, scuffed, belted
  leather: () => [
    sheet(TORSO, '#8a5a34', { curve: 1 }),
    sheet([[9, 10], [15, 9.5], [14.5, 26.5], [9, 26.5]], '#9a6a40', { curve: 0.8 }), sheet([[17.5, 9.5], [23, 10], [23, 26.5], [17.5, 26.5]], '#76482a', { curve: 0.8 }),
    sheet(NECK, '#3a2414'),
    hair(16, 11, 16, 22, '#3a2414'),
    ...[0, 1, 2, 3, 4, 5].flatMap(i => [hair(15, 11.6 + i * 1.8, 17, 12.8 + i * 1.8, '#e0c890'), hair(17, 11.6 + i * 1.8, 15, 12.8 + i * 1.8, '#e0c890')]),
    specks([0, 1, 2, 3, 4, 5, 6].flatMap(i => [[14.75, 11.5 + i * 1.8], [17.25, 11.5 + i * 1.8]]), '#2a1a0e'),
    ...pauldron(-1, 2, '#7a4e2c', '#4a2e18', '#a8784a'), ...pauldron(1, 2, '#7a4e2c', '#4a2e18', '#a8784a'),
    specks([9, 10.5, 12, 13.5].flatMap(y => [[8.5, y + 6], [23.5, y + 6]]), '#c8a070'),
    limb(8.2, 23, 23.8, 23, 1.2, 1.2, '#4a2e1a'), hair(8.5, 22.25, 23.5, 22.25, '#6a4a2a'),
    sheet([[14.6, 21.8], [17.4, 21.8], [17.4, 24.2], [14.6, 24.2]], BRASS), sheet([[15.3, 22.5], [16.7, 22.5], [16.7, 23.5], [15.3, 23.5]], '#4a2e1a'), hair(16, 22.4, 16, 23.6, '#f0d070'),
    hair(11, 15, 12.5, 17, '#b8885a'), hair(20, 18, 21.5, 19.5, '#b8885a'), hair(10, 25, 22, 25.5, '#5a3a20'),
  ],
  // the same leather under rows of iron rivets, each with its shadow and its glint
  studded: () => [
    sheet(TORSO, '#6e4a2c', { curve: 1 }),
    sheet([[9, 10], [15, 9.5], [14.5, 26.5], [9, 26.5]], '#7a5434', { curve: 0.8 }), sheet([[17.5, 9.5], [23, 10], [23, 26.5], [17.5, 26.5]], '#5a3a22', { curve: 0.8 }),
    sheet(NECK, '#2e1c10'),
    ...lattice(TORSO, 2.6, 2.4, 11.5, 25.5, (x, y) => !(y < 13 && x > 12.5 && x < 19.5)).flatMap(([x, y]) => [specks([[x + 0.25, y + 0.5]], '#2a1a0e'), ball(x, y, 0.5, 0.5, '#b8bcc4', { smooth: 1 }), specks([[x - 0.25, y - 0.25]], '#f4f8ff')]),
    ...pauldron(-1, 2, '#5e3e24', '#3a2616', '#8a6a48'), ...pauldron(1, 2, '#5e3e24', '#3a2616', '#8a6a48'),
    ...[[6, 9], [9.5, 8], [26, 9], [22.5, 8]].map(([x, y]) => ball(x, y, 0.45, 0.45, '#c8ccd4')),
    limb(8.2, 24.5, 23.8, 24.5, 1, 1, '#3a2616'), hair(10, 16, 11, 19, '#8a6a48'),
  ],
  // overlapping scales of bronze sewn onto leather, each hanging over the row below
  scale: () => [
    sheet(TORSO, '#6a5a34', { curve: 1 }), sheet(NECK, '#3a2c18'),
    ...lattice(TORSO, 1.9, 1.5, 10.5, 26).reverse().flatMap(([x, y]) => [
      sheet(scaleAt(x, y, 1), inPoly([[6, 9], [16, 8], [16, 27], [8, 27]], x, y) ? '#b09858' : '#9a8448', { curve: 1 }),
      hair(x - 0.8, y + 0.8, x + 0.8, y + 0.8, '#4e3e20'), specks([[x - 0.25, y - 0.5]], '#e8d8a0'),
    ]),
    ...pauldron(-1, 3, '#a89050', '#5e4c28', '#e0d098'), ...pauldron(1, 3, '#a89050', '#5e4c28', '#e0d098'),
    limb(8.2, 26.4, 23.8, 26.4, 0.8, 0.8, '#5e4c28'),
  ],
  // scales off a cave wyrm, rust-red and still warm-looking, laced onto hide, a pale plate down the chest
  wyrmscale: () => [
    sheet(TORSO, '#5a2416', { curve: 1 }), sheet(NECK, '#2a1410'),
    ...lattice(TORSO, 2.1, 1.7, 10.5, 26, (x) => x < 12.6 || x > 19.4).reverse().flatMap(([x, y]) => [
      sheet(scaleAt(x, y, 1.15), x < 16 ? '#a44a2c' : '#8a3a24', { curve: 1 }), hair(x - 0.9, y + 0.9, x + 0.9, y + 0.9, '#3a120c'), specks([[x - 0.25, y - 0.5]], '#e08a4a'),
    ]),
    sheet([[13, 11.5], [19, 11.5], [18.5, 25], [13.5, 25]], '#c8a878', { curve: 0.8 }),
    ...[13.5, 15.8, 18.1, 20.4, 22.7].map(y => [limb(13.6, y, 18.4, y, 0.4, 0.4, '#8a6a44'), hair(13.8, y + 0.6, 18.2, y + 0.6, '#e8d0a0')]).flat(),
    ...pauldron(-1, 3, '#a44a2c', '#3a120c', '#e08a4a'), ...pauldron(1, 3, '#a44a2c', '#3a120c', '#e08a4a'),
    hair(13, 25.5, 19, 25.5, '#3a120c'),
  ],
  // a shirt of riveted rings over a padded coat: the rings drawn as rings, row on row
  chain: () => [
    limb(7, 10, 5.4, 17.5, 2.7, 2.3, '#868c96'), limb(25, 10, 26.6, 17.5, 2.7, 2.3, '#868c96'),
    sheet(TORSO, '#8e949e', { curve: 1 }),
    sheet([[9, 10], [15, 9.5], [14.5, 26.5], [9, 26.5]], '#9ea4ae', { curve: 0.8 }), sheet([[17.5, 9.5], [23, 10], [23, 26.5], [17.5, 26.5]], '#7a808a', { curve: 0.8 }),
    ...lattice([...TORSO, [5, 18], [4, 17]], 1.15, 0.9, 9.2, 26.4, (x, y) => !(y < 11.2 && x > 13 && x < 19)).flatMap(([x, y, r]) => [
      hair(x - 0.45, y, x, y + 0.45, '#4e545e'), hair(x, y + 0.45, x + 0.45, y, '#4e545e'), ...(r % 3 === 0 && x % 2 < 1.2 ? [specks([[x, y - 0.25]], '#dfe4ec')] : []),
    ]),
    ...lattice([[3, 11], [8.6, 11], [7.6, 18.6], [3, 18.6]], 1.15, 0.9, 11, 18.4).flatMap(([x, y]) => [hair(x - 0.45, y, x, y + 0.45, '#4e545e'), hair(x, y + 0.45, x + 0.45, y, '#4e545e')]),
    ...lattice([[23.4, 11], [29, 11], [29, 18.6], [24.4, 18.6]], 1.15, 0.9, 11, 18.4).flatMap(([x, y]) => [hair(x - 0.45, y, x, y + 0.45, '#4e545e'), hair(x, y + 0.45, x + 0.45, y, '#4e545e')]),
    sheet(NECK, '#2a2e36'), ball(16, 7.6, 3.4, 1.2, '#7a6a50'), hair(13, 7.25, 19, 7.25, '#9a8a6a'),
    limb(8.2, 26.6, 23.8, 26.6, 0.9, 0.9, '#6a707a'), hair(9, 26.1, 23, 26.1, '#b8bec8'),
  ],
  // steel splints riveted down a leather coat, a gorget at the throat and lames at the shoulders
  splint: () => [
    sheet(TORSO, '#4a3a2c', { curve: 1 }), sheet(NECK, '#221810'),
    ...[10, 13, 16, 19, 22].flatMap(x => [
      limb(x, 12.4, x, 25.4, 1.2, 1.2, x < 16 ? STEEL : x > 16 ? '#9aa2ae' : '#aab2be', { smooth: 1 }), hair(x - 0.5, 13, x - 0.5, 25, '#e8eef6'), hair(x + 0.75, 13, x + 0.75, 25, '#6a7280'),
      ball(x, 13, 0.4, 0.4, BRASS), ball(x, 24.8, 0.4, 0.4, BRASS), ball(x, 19, 0.35, 0.35, BRASS),
    ]),
    sheet([[11, 9.4], [21, 9.4], [21.6, 12], [10.4, 12]], DARK_STEEL, { curve: 0.6 }), hair(11.5, 9.75, 20.5, 9.75, '#c8ccd4'),
    ...pauldron(-1, 3, STEEL, '#5a606c', '#eef3fa'), ...pauldron(1, 3, STEEL, '#5a606c', '#eef3fa'),
    limb(8.2, 26.4, 23.8, 26.4, 1, 1, '#2e2218'), hair(10, 25.9, 22, 25.9, '#6a5a44'),
  ],
  // a breastplate with a ridge down it, lit down one side, lames over the belly and the
  // shoulders, the edges gilt and riveted
  plate: () => [
    sheet(TORSO, '#a8b2c0', { curve: 1, smooth: 1 }),
    sheet([[9, 10.5], [15.6, 9.4], [15.6, 21.6], [10, 21]], '#c4ccd8', { curve: 1, tilt: [-0.4, -0.2], smooth: 1 }),
    sheet([[16.4, 9.4], [23, 10.5], [22, 21], [16.4, 21.6]], '#8a94a2', { curve: 1, tilt: [0.4, -0.2], smooth: 1 }),
    limb(16, 9.6, 16, 21.6, 0.4, 0.4, '#eef3fa'), hair(16.5, 10, 16.5, 21.5, '#6a7480'),
    hair(10, 12, 12, 19, '#e8eef6'), hair(20.5, 12, 19.5, 19, '#7a8492'),
    sheet(NECK, '#2a2e38'), sheet([[12.4, 7.2], [19.6, 7.2], [19, 9.6], [13, 9.6]], '#b8c2d0', { curve: 0.6 }), hair(13, 7, 19, 7, GOLD), hair(13.5, 9.75, 18.5, 9.75, GOLD),
    ...[22.4, 24.4, 26.4].flatMap((y, i) => [limb(8.6 + i * 0.2, y, 23.4 - i * 0.2, y, 1, 1, i % 2 ? '#8e98a6' : '#9aa4b2', { smooth: 1 }), hair(9, y - 0.75, 23, y - 0.75, '#dfe6ee'),
      specks([[9.2 + i * 0.2, y], [22.8 - i * 0.2, y]], '#4a4e58')]),
    ...pauldron(-1, 3, '#b8c2d0', '#6a7480', '#f0f4fa'), ...pauldron(1, 3, '#b8c2d0', '#6a7480', '#f0f4fa'),
    hair(4, 13.5, 11, 12.6, GOLD), hair(28, 13.5, 21, 12.6, GOLD),
    specks([[11.5, 11], [20.5, 11], [12, 20.5], [20, 20.5]], '#4a4e58'), hair(19, 14, 20.5, 15.5, '#6a7480'),
  ],
  // ---- robes: a mage's cloth, long to the floor, sleeves wide at the wrist ----
  robe_apprentice: () => robe('#6e6252', '#8a7c68', '#b8a070', [
    // a rope belt knotted at the hip, its ends hanging
    limb(19, 19, 19.5, 23.5, 0.5, 0.4, '#c8b080'), limb(20, 19, 21.5, 23, 0.5, 0.4, '#c8b080'),
    // a darned patch low on the skirt
    sheet([[10, 24], [13, 24], [13, 27], [10, 27]], '#5e5446'),
    specks([[10.5, 24.5], [12.5, 24.5], [10.5, 26.5], [12.5, 26.5]], '#b8a070'),
  ]),
  robe_silk: () => robe('#34448e', '#4c5eb0', '#d8dcec', [
    // the sheen of silk down the lit side, and a silver clasp at the throat
    hair(12, 11, 12, 17, '#7a8ad8'), hair(13.5, 20, 12, 29, '#6a7ac8'),
    ball(16, 11.5, 1.2, 1.1, '#e8ecf6'),
  ]),
  robe_warded: () => robe('#6e2230', '#8e3040', GOLD, [
    // a band of warding runes round the hem, and a sigil on the breast
    ...[6, 8.5, 11, 13.5, 18.5, 21, 23.5, 26].flatMap((x, i) => [hair(x - 0.5, 28, x + 0.5, 27, '#ffd870'), hair(x, 27 + (i % 2) * 0.5, x + (i % 2 ? 0.75 : -0.75), 28.25, '#ffd870')]),
    ...ring(16, 15, 2, 0.45, '#ffd870', 10),
  ]),
  robe_magi: () => robe('#4a2478', '#6a38a4', GOLD, [
    // stars scattered on the cloth, a bright sigil, gold at the cuffs
    ...[[10, 13], [22, 12], [12, 22], [20, 21], [9, 27], [23, 27], [14, 26]].flatMap(([x, y]) => [hair(x - 0.5, y, x + 0.5, y, '#fff0a0'), hair(x, y - 0.5, x, y + 0.5, '#fff0a0')]),
    ball(16, 15, 1.6, 1.6, '#c8f0ff'), ball(16, 15, 0.7, 0.7, '#ffffff'),
    line(3, 17, 6.5, 18.2, GOLD), line(25.5, 18.2, 29, 17, GOLD),
  ]),

  // a small round shield: planks behind a steel rim, a domed boss, rivets round the edge
  buckler: () => [
    ball(16, 17, 10, 10, DARK_STEEL, { smooth: 1 }), ball(16, 17, 8.6, 8.6, WOOD),
    ...[-5.5, -2, 1.6, 5].map(x => hair(16 + x, 17 - Math.sqrt(Math.max(0, 70 - x * x)), 16 + x, 17 + Math.sqrt(Math.max(0, 70 - x * x)), DARK_WOOD)),
    hair(10, 12, 12, 21, '#a8784a'), hair(20, 14, 21, 20, '#5a3a20'),
    ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [ball(16 + Math.cos(a) * 9.3, 17 + Math.sin(a) * 9.3, 0.42, 0.42, '#dfe4ec'), specks([[16 + Math.cos(a) * 9.3 + 0.2, 17 + Math.sin(a) * 9.3 + 0.3]], '#3a3e46')]; }).flat(),
    hair(9, 10, 13, 7.6, '#d8dce4'),
    ball(16, 17, 3.4, 3.4, '#8a909c', { smooth: 1 }), ball(16, 17, 2.6, 2.6, STEEL, { smooth: 1 }), ball(15, 16, 1, 0.9, '#f4f8ff', { smooth: 1 }),
  ],
  // a heater shield: a steel rim, the field painted blue with a gold bend, chipped to the wood
  shield: () => {
    const outer = [[5, 4], [27, 4], [27, 15], [24, 22.5], [16, 30], [8, 22.5], [5, 15]];
    const face = [[6.6, 5.6], [25.4, 5.6], [25.4, 15], [22.8, 21.6], [16, 28], [9.2, 21.6], [6.6, 15]];
    return [
      sheet(outer, DARK_STEEL, { curve: 1, smooth: 1 }),
      sheet(face, '#2e4a7a', { curve: 1 }), sheet([[6.6, 5.6], [16, 5.6], [16, 28], [9.2, 21.6], [6.6, 15]], '#365488', { curve: 1 }),
      sheet([[6.6, 9.5], [9.8, 5.6], [25.4, 20.6], [22.8, 21.6], [21.6, 23.4]], GOLD, { curve: 1 }),
      hair(10.5, 6.5, 24.5, 20.5, '#fff0a0'), hair(7.5, 10, 21.5, 23, '#a07818'),
      // a silver star in each empty quarter, a chip through the paint to the wood
      ...[[20, 10.5], [12, 17.5]].flatMap(([x, y]) => [hair(x, y - 1.25, x, y + 1.25, '#e8ecf4'), hair(x - 1.25, y, x + 1.25, y, '#e8ecf4'), specks([[x, y]], '#ffffff')]),
      sheet([[21, 14], [23, 13.4], [22.4, 15.4]], '#8a5a32'), hair(13, 23, 15, 25.5, '#1e3050'),
      ...[[6, 5], [16, 4.8], [26, 5], [5.8, 14], [26.2, 14], [9, 22.6], [23, 22.6]].map(([x, y]) => ball(x, y, 0.45, 0.45, '#e6ebf2')),
      hair(5.6, 5.6, 5.6, 13.6, '#c8ccd6'), hair(8, 4.6, 15, 4.6, '#c8ccd6'),
    ];
  },
  // a round shield faced with a quillback's quills, points outward, banded dark and pale
  quillshield: () => [
    ball(16, 16, 10.5, 10.5, '#4a3020'), ball(16, 16, 9, 9, '#6a4428'),
    ...Array.from({ length: 30 }, (_, i) => {
      const a = (i + 0.5) / 30 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), r = i % 2 ? 14.8 : 13.2, m = r * 0.82, b = r * 0.5;
      return [limb(16 + c * 3.5, 16 + sn * 3.5, 16 + c * m, 16 + sn * m, 0.75, 0.32, i % 3 ? '#2a2420' : '#3e342a'), limb(16 + c * m, 16 + sn * m, 16 + c * r, 16 + sn * r, 0.32, 0.15, '#eee4cc'),
        hair(16 + c * b, 16 + sn * b, 16 + c * (b + 0.8), 16 + sn * (b + 0.8), '#8a7e6a')];
    }).flat(),
    ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return hair(16 + Math.cos(a) * 4, 16 + Math.sin(a) * 4, 16 + Math.cos(a + 0.4) * 4, 16 + Math.sin(a + 0.4) * 4, '#c8b080'); }),
    ball(16, 16, 3.4, 3.4, IRON, { smooth: 1 }), ball(15.3, 15.3, 1.3, 1.3, '#c8ccd4', { smooth: 1 }),
  ],
  // a tall shield of planks, banded and nailed, a red stripe painted down it, a boss in the middle
  towershield: () => {
    const outer = [[6, 2], [26, 2], [26, 27], [16, 31], [6, 27]];
    return [
      sheet(outer, '#7a5230', { curve: 1 }), sheet([[6, 2], [11, 2], [11, 29], [6, 27]], '#8a6038', { curve: 0.6 }),
      ...[10, 14, 18, 22].map(x => line(x, 3, x, 28.5, '#5a3a20')),
      hair(8, 4, 8.5, 7, '#5e3c1e'), hair(8, 10, 7.5, 20, '#5e3c1e'), hair(12, 10, 12, 16, '#5e3c1e'), hair(20.5, 9.5, 20, 14, '#5e3c1e'), hair(24, 10, 24.5, 20, '#5e3c1e'),
      specks([[12, 18.5], [12.5, 18], [20.5, 5], [21, 5.5]], '#4a2e14'),
      sheet([[14, 3], [18, 3], [18, 29.4], [16, 30.2], [14, 29.4]], '#8a2a2a', { curve: 0.4 }), hair(14.5, 4, 14.5, 28, '#a84040'),
      ...[8, 22].flatMap(y => [limb(6, y, 26, y, 1.1, 1.1, IRON, { smooth: 1 }), hair(6.5, y - 0.75, 25.5, y - 0.75, '#aab0ba'), ...[7, 11.5, 20, 25].map(x => ball(x, y, 0.4, 0.4, '#d8dce4'))]),
      ball(16, 15, 3.6, 3.6, '#8a909c', { smooth: 1 }), ball(16, 15, 2.8, 2.8, STEEL, { smooth: 1 }), ball(15, 14, 1, 0.9, '#ffffff', { smooth: 1 }),
      specks([[7, 3], [25, 3], [15.5, 5], [15.5, 26.5]], '#d8dce4'),
    ];
  },

  // ---- cloaks: a mantle hung from a clasp, falling in folds ----
  cloak_protect: () => cloak('#2c3a6a', '#44568e', '#d8dce4', [
    // a silver ward stitched on the back, silver at the hem
    ...ring(16, 19, 3.2, 0.5, '#c8ced8', 10), line(6, 29, 26, 29, '#a8b0bc'),
  ]),
  cloak_elven: () => cloak('#3e5a3a', '#5e7e52', '#c8d890', [
    // a leaf for a clasp, and the cloth shifting grey-green like leaf-shadow
    sheet([[14, 7.5], [16, 5.5], [18, 7.5], [16, 10]], '#9ac070'),
    hair(9, 16, 11, 26, '#4e6a48'), hair(21, 14, 23, 25, '#6e8e62'),
  ]),
  // a dark elf mage's: near black, a silver spider at the clasp, a violet thread at the hem
  cloak_shadow: () => cloak('#1e1a26', '#2e283a', '#b8bccc', [
    ...[-1, 1].flatMap(sd => [[1, -1.2, 3.4, -2.6], [1.2, 0, 3.6, 0.4], [1, 1.2, 3.2, 2.8]].map(([a, b, c, d]) => limb(16 + sd * a, 8 + b, 16 + sd * c, 8 + d, 0.35, 0.3, '#b8bccc'))),
    line(6, 28.2, 26, 28.2, '#8a4ac8'), hair(10, 14, 9, 25, '#3a3048'), hair(22, 14, 23.5, 25, '#2a2436'),
  ]),
  cloak_warmth: () => cloak('#7a3424', '#9a4a30', '#efe6d0', [
    // a thick fur collar and fur at the hem
    ball(16, 8.5, 7, 2.6, '#e8dcc4'), ...[9, 12, 15, 18, 21, 24].map(x => ball(x, 29, 1.6, 1.1, '#e8dcc4')),
    specks([[12, 8], [15, 9], [19, 8], [21, 9]], '#b8a88c'),
  ]),

  // ---- what a caster holds in the free hand ----
  spellbook: () => [
    // the page block showing below and beside the cover, then the cover over it
    sheet([[8, 7], [26, 6], [27, 26], [9, 28]], '#e8dcc0'),
    ...[9, 12, 15, 18, 21, 24].map(y => hair(26, y, 27, y + 1, '#b8a888')),
    sheet([[5, 5], [24, 4], [25, 25], [6, 27]], '#6a2a2a', { curve: 0.3 }),
    limb(5.5, 5.5, 6.5, 26.5, 1.4, 1.4, '#4a1c1c'),                  // the spine
    // a sigil tooled in gold, brass corners and a clasp
    ...ring(15.5, 15.5, 4.5, 0.55, GOLD, 12),
    limb(15.5, 11, 15.5, 20, 0.5, 0.5, GOLD), limb(11, 15.5, 20, 15.5, 0.5, 0.5, GOLD),
    ball(24, 5, 1.4, 1.4, BRASS), ball(24.5, 24.5, 1.4, 1.4, BRASS),
    limb(23, 14, 27.5, 14, 1, 1, BRASS), ball(27.5, 14, 1.1, 1.1, GOLD),
    hair(7, 6.5, 22, 5.8, '#8a4040'),
  ],
  crystal_orb: () => [
    // a brass claw stand, then the glass with light held inside it
    sheet([[10, 26], [22, 26], [20, 29], [12, 29]], BRASS, { curve: 0.3 }),
    limb(11, 25, 13, 21, 0.8, 0.6, '#a07828'), limb(21, 25, 19, 21, 0.8, 0.6, '#a07828'),
    ball(16, 14, 9.5, 9.5, '#8ec8e0'),
    ball(15, 15, 6, 6, '#b8e4f4'),
    ball(17, 16, 2.6, 2.6, '#e8faff'),
    ball(12, 10, 2, 1.6, '#ffffff'),
    hair(9, 16, 10.5, 20, '#5a90b0'), hair(20, 21.5, 23, 18, '#5a90b0'),
  ],
  orb_storms: () => [
    // a silver stand, a storm-dark glass and lightning caught inside it
    sheet([[10, 26], [22, 26], [20, 29], [12, 29]], STEEL, { curve: 0.3 }),
    limb(11, 25, 13, 21, 0.8, 0.6, DARK_STEEL), limb(21, 25, 19, 21, 0.8, 0.6, DARK_STEEL),
    ball(16, 14, 9.5, 9.5, '#243a6a'),
    ball(15, 13, 6.5, 6.5, '#34508a'),
    ...[[11, 9, 15, 13], [15, 13, 13, 16], [13, 16, 18, 20], [18, 11, 16, 14], [16, 14, 21, 16]].map(([a, b, c, d]) => limb(a, b, c, d, 0.5, 0.4, '#fff4a0')),
    ball(12, 9, 1.6, 1.3, '#d8e8ff'),
  ],
  holy_symbol: () => [
    // a carved wooden sun on a cord
    limb(16, 2, 11, 8, 0.5, 0.5, '#c8b080'), limb(16, 2, 21, 8, 0.5, 0.5, '#c8b080'),
    ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return limb(16 + Math.cos(a) * 6, 17 + Math.sin(a) * 6, 16 + Math.cos(a) * 11, 17 + Math.sin(a) * 11, 1.3, 0.6, '#8a5a32'); }),
    ball(16, 17, 7, 7, '#9a6a3a'),
    ball(16, 17, 4.5, 4.5, '#b8844a'),
    ...ring(16, 17, 5.8, 0.45, '#6a4224', 12),
    hair(13, 14, 14.5, 13, '#d8a868'),
  ],
  silver_symbol: () => [
    // a silver sunburst on a fine chain, the rays alternately long and short
    limb(16, 2, 11, 7, 0.4, 0.4, '#d8dce4'), limb(16, 2, 21, 7, 0.4, 0.4, '#d8dce4'),
    ...Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2, r = i % 2 ? 9 : 12.5; return limb(16 + Math.cos(a) * 5, 17 + Math.sin(a) * 5, 16 + Math.cos(a) * r, 17 + Math.sin(a) * r, 1.1, 0.4, i % 2 ? '#a8b0bc' : '#dfe5ee'); }),
    ball(16, 17, 6, 6, '#c8ced8'),
    ball(16, 17, 3.2, 3.2, '#f4f8ff'),
    ball(14.5, 15.5, 1.2, 1.2, '#ffffff'),
  ],
  reliquary: () => [
    // a little gilt house for a saint's bone: a peaked roof, a window, gems
    sheet([[8, 13], [24, 13], [24, 28], [8, 28]], '#c89a30'),
    sheet([[6, 13], [16, 5], [26, 13]], '#e8b830'),
    ball(16, 4.5, 1.4, 1.4, '#e84848'),
    sheet([[12, 16], [20, 16], [20, 25], [12, 25]], '#3a2a1a'),
    limb(14, 20.5, 18, 20.5, 1.2, 1, '#efe6d0'), ball(13.8, 20.5, 1, 1, '#efe6d0'), ball(18.2, 20.5, 1, 1, '#efe6d0'),
    line(8, 28, 24, 28, '#8a6a20'), line(8, 13, 24, 13, '#fff0a0'),
    fine([[10, 15], [22, 15], [10, 26], [22, 26]], '#58c0ff'),
  ],

  // ---- draughts: one bottle shape per colour ----
  potion_red: () => bottle(
    [ball(16, 21.5, 8, 8, '#d8323c')],
    [sheet(capAbove(16, 21.5, 8, 8, 19), GLASS, { curve: 1 })],
    [limb(16, 9.5, 16, 14.5, 2, 2.2, GLASS), ball(16, 9, 2.8, 1.1, GLASS), ball(16, 7, 1.9, 1.6, CORK)],
    [[11, 18], [12, 17], [11, 19], [13, 23]]),
  potion_pink: () => {
    const body = [[12.5, 12], [19.5, 12], [26.5, 28], [24.5, 30], [7.5, 30], [5.5, 28]];
    const liquid = [[9.1, 20], [22.9, 20], [26.5, 28], [24.5, 30], [7.5, 30], [5.5, 28]];
    return bottle(
      [sheet(body, GLASS, { curve: 1 })],
      [sheet(liquid, '#e864b4', { curve: 1 })],
      [limb(16, 6.5, 16, 12.5, 2, 2, GLASS), ball(16, 6, 2.6, 1, GLASS), ball(16, 4, 1.8, 1.6, CORK)],
      [[11, 16], [10, 18], [9, 24]]);
  },
  potion_green: () => bottle(
    [limb(16, 8, 16, 28, 3.6, 3.6, GLASS)],
    [limb(16, 16.5, 16, 28, 3.4, 3.4, '#3cc05a')],
    [ball(16, 6.8, 3.2, 1.1, GLASS), ball(16, 4.8, 2.3, 1.8, CORK)],
    [[14, 10], [14, 11], [14, 12], [14, 19]]),
  potion_orange: () => bottle(
    [sheet([[11, 10], [21, 10], [23.5, 13], [23.5, 29], [8.5, 29], [8.5, 13]], GLASS, { curve: 1 })],
    [sheet([[8.5, 18], [23.5, 18], [23.5, 29], [8.5, 29]], '#f08a28', { curve: 1 })],
    [limb(16, 6, 16, 10, 1.9, 1.9, GLASS), ball(16, 5.5, 2.6, 1, GLASS), ball(16, 3.6, 1.8, 1.5, CORK)],
    [[10, 14], [10, 15], [10, 16], [10, 21]]),
  potion_blue: () => bottle(
    [ball(16, 23.5, 10, 6.5, '#3a78e8')],
    [sheet(capAbove(16, 23.5, 10, 6.5, 22), GLASS, { curve: 1 })],
    [limb(16, 14, 16, 18.5, 3.6, 3.8, GLASS), ball(16, 13.5, 4.4, 1.3, GLASS), ball(16, 11.5, 3.6, 1.8, '#b8383a')],
    [[9, 20], [8, 22], [10, 25]]),

  // ---- a job's lost satchel ----
  satchel: () => [
    sheet([[7, 13], [25, 13], [26.5, 27], [24, 29], [8, 29], [5.5, 27]], '#8a5a32', { curve: 0.6 }),
    sheet([[7, 13], [25, 13], [23.5, 20.5], [8.5, 20.5]], '#6a4424', { curve: 0.4 }),
    limb(9, 13, 12, 5, 1.3, 1.3, '#4a2e1a'), limb(23, 13, 20, 5, 1.3, 1.3, '#4a2e1a'), limb(12, 5, 20, 5, 1.3, 1.3, '#4a2e1a'),
    ball(16, 20.5, 2, 1.6, '#e8b830'), fine([[15.4, 20]], '#fff0b0'),
    ball(16, 25, 2.6, 2.6, '#f0c060'), ball(16, 25, 1.4, 1.4, '#fff4c8'),
    fine([[9, 23], [10, 26], [22, 24]], '#a8784a'),
  ],

  // ---- charms, for a companion ----
  charm_collar: () => jewelRing('#6a4424', '#3e2614', null, '#a8784a',
    (cx, cy, rx, ry) => [
      ...[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(t => ball(cx + Math.cos(t * Math.PI) * rx, cy + Math.sin(t * Math.PI) * ry, 1.5, 1.5, '#c8ccd4')),
      ball(cx, cy - ry, 2.4, 2, '#9aa0aa'), fine([[cx - 0.6, cy - ry - 0.6]], '#ffffff')]),
  charm_fang: () => [
    ...jewelAmulet('#8a5a32', '#6a4424', '#6a4424', '#6a4424', true).slice(0, 12),
    limb(16, 17, 16, 20, 1.6, 1.6, '#6a4424'),
    limb(16, 19, 18.5, 29, 3.4, 0.6, '#ece0c0'), limb(16.3, 20, 18, 27.5, 1.4, 0.4, '#fff8e8'),
    fine([[15, 19.5], [15.3, 21]], '#b8a888'),
  ],
  charm_rowan: () => [
    limb(10, 10, 22, 26, 1.4, 1.2, '#7a4a28'), limb(22, 10, 10, 26, 1.4, 1.2, '#7a4a28'),
    limb(16, 8, 16, 28, 1.4, 1.2, '#6a3e20'),
    ball(16, 18, 3.2, 3.2, '#b8383a'), limb(12, 18, 20, 18, 1, 1, '#d8c498'),
    ...[[9, 9], [23, 9], [9, 27], [23, 27], [16, 6.5]].map(([x, y]) => ball(x, y, 1.9, 1.9, '#d83a30')),
    fine([[8.4, 8.4], [22.4, 8.4], [15.4, 6]], '#ffb0a0'),
    ball(19.5, 12, 2.4, 1.2, '#4a8a3a'), ball(12.5, 24, 2.4, 1.2, '#4a8a3a'),
  ],
  // a sellsword's: a bar of grey stone worn pale and hollow in the middle by the blade, on a thong
  charm_whetstone: () => [
    limb(10, 12, 7, 4.5, 1.1, 1.1, '#6a4424'), limb(10, 12, 14, 5, 1.1, 1.1, '#6a4424'), limb(7, 4.5, 14, 5, 1.1, 1.1, '#6a4424'),
    limb(10.5, 13, 24, 26.5, 4.6, 4.6, '#4e545e'),
    limb(10.7, 12.4, 23.9, 25.7, 3.7, 3.7, '#747b86'),
    limb(14, 15.6, 21, 22.6, 2, 2, '#9ca4b0'), limb(15.4, 16.4, 19.8, 20.8, 0.8, 0.8, '#d4dae2'),
    ball(10.4, 12.8, 1.7, 1.7, '#3a2618'),
    fine([[13, 18.5], [22.5, 25], [23.6, 23], [12, 15.6], [19, 25.5]], '#3e444e'),
  ],

  // ---- oils ----
  oil_fire: () => flask('#d8601c', '#ffc040'),
  lamp_oil: () => flask('#6a4a1a', '#c9a24a'),
  oil_silver: () => flask('#b8c4d4', '#ffffff'),
  oil_venom: () => flask('#4c9a2a', '#b0f070'),

  // ---- paper ----
  scroll: () => [
    sheet([[8, 7.5], [24, 7.5], [24, 25.5], [8, 25.5]], '#e8d8b0', { curve: 0.5 }),
    ...[12, 15, 18, 21].flatMap(y => [[10.6, 13.4], [14.6, 18.6], [19.6, 21.6]].filter(([a], i) => (a + y + i) % 5 > 0.6).map(([a, b]) => hair(a, y + 0.4, b, y + 0.2 + (a % 2) * 0.3, '#6a5a48'))),
    limb(6.5, 7, 25.5, 7, 2, 2, '#d8c498'), limb(6.5, 26, 25.5, 26, 2, 2, '#d8c498'),
    ball(5.8, 7, 1.5, 1.8, '#7a5230'), ball(26.2, 7, 1.5, 1.8, '#7a5230'),
    ball(5.8, 26, 1.5, 1.8, '#7a5230'), ball(26.2, 26, 1.5, 1.8, '#7a5230'),
    limb(19, 26, 20.5, 30, 0.7, 0.7, '#b82a30'), ball(19, 26.3, 2, 1.8, '#b82a30'),
  ],
  page: () => {
    const torn = [[7, 4], [25, 5], [26, 27], [23, 28.5], [21, 27], [18, 29], [15, 27.5], [12, 29], [9, 27.5], [6, 28]];
    return [
      sheet(torn, '#e2d2a8', { tilt: [-0.15, -0.3] }),
      ...[8, 11, 14, 17, 20, 23].flatMap(y => [[9.6, 12.4], [13.6, 17.6], [18.6, 22.4]].filter(([a], i) => (a * 3 + y + i) % 7 > 1).map(([a, b]) => hair(a, y + 0.4, b, y + 0.3 + (a % 2) * 0.3, '#4a3c30'))),
      fine([[22, 23], [23, 24], [21, 24]], '#8a2020'),
    ];
  },

  // ---- food ----
  ration: () => [
    sheet([[5, 14], [27, 14], [27.5, 27.5], [4.5, 27.5]], '#b89a6a', { curve: 1 }),
    sheet([[8, 9.5], [24, 9.5], [27, 14], [5, 14]], '#d0b284', { tilt: [-0.2, -0.8] }),
    line(16, 9.5, 16, 27.5, '#6a4a2a'), line(5, 20, 27, 20, '#6a4a2a'),
    ball(16, 12.5, 1.6, 1.2, '#7a5a3a'),
    limb(16, 12.5, 13, 9, 0.5, 0.5, '#7a5a3a'), limb(16, 12.5, 19.5, 9.5, 0.5, 0.5, '#7a5a3a'),
  ],
  meat: () => [
    limb(18, 19, 26, 27, 1.5, 1.5, '#ece2cc'),
    ball(26.5, 26, 1.8, 1.8, '#f2eadc'), ball(25, 28, 1.8, 1.8, '#f2eadc'),
    ball(13, 14, 8.5, 7.5, '#b8563a'),
    ball(11, 11.5, 4, 3, '#c8704e'),
    fine([[9, 14], [11, 16], [13, 18], [14, 12], [16, 14], [18, 16]], '#8a3a24'),
    fine([[9, 9], [10, 9], [8, 10]], '#f0c8a8'),
  ],
  // pale caps on a clump of moss, grown only on an overgrown floor
  caps: () => [
    sheet([[5, 27], [27, 27], [26, 30], [6, 30]], '#4a6a34', { curve: 1 }),
    limb(11, 27, 11, 20, 1.3, 1, '#e8e0cc'), ball(11, 19, 5, 2.6, '#d4c8ac'),
    limb(21, 28, 21, 16, 1.5, 1.2, '#ece4d0'), ball(21, 15, 6.5, 3.2, '#e0d4b8'),
    limb(16, 28, 16, 23, 1.1, 0.9, '#e8e0cc'), ball(16, 22.5, 3.6, 1.9, '#ccc0a4'),
    fine([[19, 14], [23, 14], [9, 18], [15, 22]], '#f8f4e8'),
    fine([[8, 29], [24, 29]], '#6a8a48'),
  ],
  bread: () => [
    ball(16, 21, 12, 7, '#c8883e'),
    ball(15, 19, 8, 4, '#d69a4e'),
    ...[10, 15, 20].map(x => limb(x - 1.5, 21, x + 2, 16.5, 0.55, 0.55, '#f0cc90')),
    fine([[6, 24], [26, 24], [8, 26], [24, 26]], '#9a6228'),
  ],

  // ---- treasure ----
  gold: () => {
    const coin = (x, y) => ball(x, y, 3.8, 1.7, GOLD);
    return [
      coin(8.5, 27.5), coin(15.5, 28), coin(22.5, 27.5),
      coin(12, 25), coin(19, 25), coin(15.5, 22.3), coin(10, 22.8),
      ball(23.5, 20.5, 1.5, 3.8, '#d8a828'), ball(8, 18.5, 1.5, 3.6, '#d8a828'),
      coin(16, 19.5),
      fine([[14, 18], [21, 24], [10, 24], [7, 27], [22, 18], [7, 16]], '#fff4b0'),
      fine([[15, 19], [16, 19], [17, 19]], '#b88a18'),
    ];
  },
  gem: () => [
    sheet([[5, 13], [27, 13], [16, 29]], '#2a8ad0', { tilt: [0.3, 0.5] }),
    sheet([[5, 13], [16, 13], [16, 29]], '#3cb8f0', { tilt: [-0.5, 0.2] }),
    sheet([[9, 8], [23, 8], [27, 13], [5, 13]], '#5ccaf6', { tilt: [-0.2, -0.7] }),
    sheet([[12, 8], [20, 8], [19, 13], [13, 13]], '#8ae0ff', { tilt: [-0.3, -0.6] }),
    line(5, 13, 27, 13, '#bff0ff'),
    fine([[12, 10], [13, 9], [11, 11], [9, 16]], '#ffffff'),
  ],
  artifact: () => [
    sheet([[11, 27], [21, 27], [23.5, 31], [8.5, 31]], BRASS, { curve: 1 }),
    ball(11.5, 12, 6.5, 6.5, '#d42a3a'), ball(20.5, 12, 6.5, 6.5, '#c42434'),
    sheet([[5.2, 14], [26.8, 14], [16, 28]], '#d42a3a', { curve: 1 }),
    line(16, 9, 16, 27, '#8a1622'),
    line(9, 15, 16, 26, '#f06070'), line(23, 15, 16, 26, '#a01c2a'),
    fine([[9, 9], [10, 8], [8, 10], [11, 9]], '#ffd0d4'),
    fine([[14, 16], [15, 15], [16, 17], [17, 16], [15, 18]], '#ff9aa4'),
  ],

  // ---- keys: one shape, in the colour of the lock each one opens ----
  ...Object.fromEntries([['key', BRASS], ...Object.entries(KEY_COLORS).map(([c, hex]) => ['key_' + c, hex])].map(([k, c]) => [k, () => [
    ...ring(9.5, 9.5, 4.3, 1.25, c, 12),
    limb(12.8, 12.8, 25, 25, 1.3, 1.3, c),
    limb(20, 20, 17, 23, 1, 1, c), limb(23, 23, 20.5, 25.5, 1, 1, c), limb(21.5, 21.5, 19.5, 23.5, 0.8, 0.8, c),
    ball(25.3, 25.3, 1.5, 1.5, c),
  ]])),
};

// Hand-drawn detail laid over each item on the fine grid, half a unit to the
// pixel, as the monsters have: bevels and nicks on blades, cord round grips,
// grain in hafts, stitching, rivets, glints in glass and the ink on a page.
// The base pictures above stay as they were; painted coarsely (scale 1) these
// fold back onto whole pixels and change little.

/** A colour mixed toward white (f > 0) or black (f < 0). */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), t = f > 0 ? 255 : 0, a = Math.abs(f);
  return '#' + [16, 8, 0].map(sh => Math.round(((n >> sh) & 255) * (1 - a) + t * a).toString(16).padStart(2, '0')).join('');
}
/** a hairline between two points on the weapon axis */
const hairAt = (s0, o0, s1, o1, c) => hair(...at(s0, o0), ...at(s1, o1), c);
/** fine pixels at points on the weapon axis */
const specksAt = (pts, c) => specks(pts.map(([s, o]) => at(s, o)), c);
/** a bright bevel down a blade's lit edge, a dark one down its shaded edge */
function bevels(s0, s1, w, tipLen = w * 1.3, light = '#f6faff', dark = '#6e7682') {
  const b = s1 - tipLen, e = w / 2 - 0.45;
  return [
    hairAt(s0 + 0.4, -e, b, -e, light), hairAt(b, -e, s1 - 0.7, -0.2, light),
    hairAt(s0 + 0.4, e, b, e, dark), hairAt(b, e, s1 - 0.9, 0.3, dark),
  ];
}
/** cord wound round a grip: short strokes slanting across it */
function cord(s0, s1, r, c, step = 1) {
  const out = [];
  for (let s = s0; s < s1 - 0.4; s += step) out.push(hairAt(s, -r * 0.8, s + step * 0.55, r * 0.8, c));
  return out;
}
/** broken grain lines running along a haft */
const grain = (runs, c) => runs.map(([s0, s1, o]) => hairAt(s0, o, s1, o, c));
/** a round rivet: a dark body with a glint on its upper left */
const rivet = (x, y, c = '#4a4e58', glint = '#f4f8ff') => [specks([[x, y], [x + 0.5, y], [x, y + 0.5], [x + 0.5, y + 0.5]], c), specks([[x, y]], glint)];

const ITEM_DETAILS = {
  // ---- blades ----
  dagger: () => [
    ...cord(6, 10, 1.1, '#2e1c10', 0.9),
    ...bevels(11, 22, 2.6),
    // a nick in the edge, a pin through the guard, glints on guard and pommel
    specksAt([[16.5, 1.25], [17, 1.25]], '#3a3e48'),
    ...rivet(...at(10.5, 0).map(v => v - 0.25), '#8a6a20', '#fff2b0'),
    specksAt([[10.5, -2.6], [10.2, -2.3]], '#fff2b0'),
    specks([[at(4.8)[0] - 0.8, at(4.8)[1] - 0.8], [at(4.8)[0] - 0.3, at(4.8)[1] - 1.1]], '#fff2b0'),
  ],
  shortsword: () => [
    // a leather thong wound over the dark grip, a peened pommel
    ...cord(5, 10, 1.2, '#7a5236', 1.1),
    ...bevels(11.5, 26.5, 3.3),
    hairAt(12, 0.6, 20, 0.6, '#8a929e'),
    ...rivet(...at(3.6).map(v => v - 0.25), '#50545e', '#e8eef6'),
    ...rivet(...at(10.8).map(v => v - 0.25), '#50545e', '#e8eef6'),
    // quillon tips worn bright, a notch from a parry
    specksAt([[10.2, -4.3], [10.2, 4.3]], '#dfe5ee'),
    specksAt([[19, -1.4], [19.4, -1.4]], '#3a3e48'),
  ],
  longsword: () => [
    ...cord(3.6, 10.5, 1.15, '#2a1a0e', 1.4),
    ...bevels(11.5, 31, 3.1),
    // a smith's mark, a little cross, struck below the fuller
    specks([[at(13.4, 0.7)[0], at(13.4, 0.7)[1] - 0.5], [at(13.4, 0.7)[0] - 0.5, at(13.4, 0.7)[1]], [at(13.4, 0.7)[0] + 0.5, at(13.4, 0.7)[1]], [at(13.4, 0.7)[0], at(13.4, 0.7)[1] + 0.5]], '#5a6270'),
    // a gilt line along the guard, glints on its knobs and the pommel
    hairAt(11, -4.8, 11, 4.8, '#9aa2ae'),
    specks([[at(11, -5.5)[0] - 0.5, at(11, -5.5)[1] - 0.5], [at(11, 5.5)[0] - 0.5, at(11, 5.5)[1] - 0.5]], '#eef3fa'),
    specks([[at(2.4)[0] - 1, at(2.4)[1] - 0.8], [at(2.4)[0] - 0.5, at(2.4)[1] - 1.2], [at(2.4)[0] - 1, at(2.4)[1] - 0.3]], '#ffffff'),
    specksAt([[24, 1.3], [24.3, 1.3]], '#3a3e48'),
  ],
  greatsword: () => [
    ...bevels(12.8, 33.5, 3.8),
    // cord crossed over the leather ricasso, a ruby in the guard
    ...cord(13.2, 16.2, 1.5, '#2e1c10', 0.8),
    specks([[at(12)[0] - 0.5, at(12)[1] - 0.5], [at(12)[0], at(12)[1] - 0.5], [at(12)[0] - 0.5, at(12)[1]], [at(12)[0], at(12)[1]]], '#c02838'),
    specks([[at(12)[0] - 0.5, at(12)[1] - 0.5]], '#ff9aa0'),
    // engraving on the quillons and the brass pommel's glint
    hairAt(11.2, -6.6, 12, -3.4, '#8a6a20'), hairAt(11.2, 6.6, 12, 3.4, '#8a6a20'),
    specks([[at(1.2)[0] - 1, at(1.2)[1] - 1], [at(1.2)[0] - 0.5, at(1.2)[1] - 1.5], [at(1.2)[0] - 1.5, at(1.2)[1] - 0.5]], '#fff2b0'),
    // two nicks and a runnel of old blood near the point
    specksAt([[22, -1.6], [22.4, -1.6], [27, 1.6]], '#3a3e48'),
  ],
  throwknife: () => [0, 6.5, -6.5].flatMap((off, i) => {
    const s = i ? 3 : 6;
    return [
      hairAt(s + 8.5, off - 0.85, s + 15, off - 0.85, '#f6faff'), hairAt(s + 15, off - 0.85, s + 17.8, off - 0.1, '#f6faff'),
      hairAt(s + 8.5, off + 0.85, s + 15, off + 0.85, '#6e7682'),
      specksAt([[s + 5.8, off - 0.3], [s + 6.8, off - 0.3], [s + 7.8, off - 0.3]], '#2e1c10'),
      specks([[at(s + 3.5, off)[0] - 1, at(s + 3.5, off)[1] - 0.8]], '#dfe5ee'),
    ];
  }),

  // ---- hafted ----
  club: () => [
    ...grain([[9, 14, -0.5], [11, 16.5, 0.5], [17, 22, -1.3], [19, 24.5, 0.8], [23, 26.5, -0.2], [13, 15.5, -0.9]], '#5e3c1e'),
    ...grain([[10, 13, -0.9], [21.5, 24, -2.3]], '#b88a58'),
    ...cord(3.3, 8, 1.45, '#2e1c10', 0.9),
    // a knot with rings round it, and iron nails hammered through the head
    specksAt([[16, 0.9], [15.6, 1.4], [16.4, 1.9], [16.6, 1.2]], '#4a2e14'),
    ...rivet(...at(22.5, 1.9), '#4a4e58', '#e8eef6'), ...rivet(...at(25, -2), '#4a4e58', '#e8eef6'),
    ...rivet(...at(19.5, -1.2), '#4a4e58', '#e8eef6'),
  ],
  staff: () => [
    ...grain([[2, 6, 0.4], [7.5, 11, -0.35], [16, 21, 0.4], [22, 26.5, -0.35]], '#5e3c1e'),
    ...grain([[4, 7, -0.5], [18, 20, -0.5]], '#b88a58'),
    ...cord(12.3, 15, 1.35, '#2e1c10', 0.8),
    // an engraved line round the brass band and prongs gripping the stone
    hairAt(28.25, -1.4, 28.25, 1.4, '#8a6a20'), specksAt([[27.8, -1.3]], '#fff2b0'),
    // light swirling inside the orb, and a dark heart to it
    hair(...at(30.2, -1.6), ...at(31.8, -1.4), '#c8f2ff'), specksAt([[31.8, 1], [32.3, 0.5]], '#2a6ab0'),
    specksAt([[30.6, 1.4], [31.1, 1.6]], '#d8a840'),
    specks([[at(0.2)[0] - 0.6, at(0.2)[1] - 0.6]], '#c8ccd6'),
  ],
  spear: () => [
    ...grain([[3, 8, 0.3], [10, 16, -0.3], [17, 21.5, 0.3]], '#5e3c1e'),
    ...cord(22.7, 25, 1.35, '#2e1c10', 0.75),
    // the head: a bright lit edge, a shadow along the midrib, a rivet through the socket
    hairAt(25, -0.95, 27.5, -1.75, '#f6faff'), hairAt(27.5, -1.75, 32.2, -0.2, '#f6faff'),
    hairAt(25.5, 0.55, 31, 0.3, '#7a828e'),
    ...rivet(...at(24.2).map(v => v - 0.25), '#4a4e58', '#dfe5ee'),
    // a red streamer tied below the head
    hair(...at(22.3, 0.9), at(22.3, 0.9)[0] + 0.5, at(22.3, 0.9)[1] + 3, '#c83838'),
    hair(at(22.3, 0.9)[0] + 0.5, at(22.3, 0.9)[1], at(22.3, 0.9)[0] + 1.5, at(22.3, 0.9)[1] + 2.5, '#e05048'),
  ],
  mace: () => {
    const c = at(25.5);
    return [
      ...grain([[9, 14, 0.35], [15.5, 21, -0.35]], '#3e2614'),
      ...cord(2.3, 8, 1.35, '#2e1c10', 0.9),
      // the lit flanges' edges catching the light, a glint on the head
      ...[3, 4, 5].map(i => {
        const a = i / 6 * Math.PI * 2 + 0.3;
        return hair(c[0] + Math.cos(a) * 3.6, c[1] + Math.sin(a) * 3.6, c[0] + Math.cos(a) * 4.5, c[1] + Math.sin(a) * 4.5, '#dfe5ee');
      }),
      // a collar where the head is set on the haft
      hairAt(22.4, -1.1, 22.4, 1.1, '#3a3e46'), specksAt([[22.9, -0.9]], '#b8c0cc'),
      specks([[c[0] - 1.4, c[1] - 1.2], [c[0] - 0.9, c[1] - 1.6]], '#eef3fa'),
      specks([[at(29.2)[0] - 0.5, at(29.2)[1] - 0.5]], '#dfe5ee'),
    ];
  },
  hammer: () => [
    ...grain([[8.5, 13, 0.3], [14.5, 20, -0.3], [9, 11, -0.4]], '#5e3c1e'),
    ...cord(2.3, 8, 1.3, '#2e1c10', 0.9),
    // bevels round the head, a groove across it, the wedges holding the haft
    hairAt(26.1, -6.3, 26.1, 0.6, '#e2e6ee'), hairAt(22.4, -6.3, 22.4, 0.6, '#4a4e58'),
    hairAt(22.6, -3.2, 25.9, -3.2, '#4a4e58'), hairAt(22.6, -3.7, 25.9, -3.7, '#c8ccd6'),
    ...rivet(...at(23.2, -1).map(v => v - 0.25), '#3a3e46', '#dfe5ee'), ...rivet(...at(25.3, -1).map(v => v - 0.25), '#3a3e46', '#dfe5ee'),
    // the beak's lit edge and the spike's point
    hairAt(25.6, 1.5, 24.5, 6, '#c8ccd6'),
    specksAt([[29.5, -0.3]], '#eef3fa'),
  ],
  flail: () => [
    ...grain([[7.5, 13, 0.35], [9, 11.5, -0.45]], '#5e3c1e'),
    ...cord(2.3, 7, 1.45, '#2e1c10', 0.9),
    // each link a ring: a hole through it, a glint on its rim
    ...[[15.8, 15.9], [17.2, 15.6], [18.6, 15.9], [19.8, 16.8], [20.7, 18]].flatMap(([x, y]) => [
      specks([[x, y]], '#24262c'), specks([[x - 0.5, y - 0.5]], '#e2e6ee')]),
    specks([[at(14.8)[0] - 0.7, at(14.8)[1] - 0.7]], '#dfe5ee'),
    // the lit spikes' points, dents in the ball, a glint on it
    ...[4, 5, 6].map(i => {
      const a = i / 8 * Math.PI * 2;
      return hair(22.5 + Math.cos(a) * 3.6, 21.5 + Math.sin(a) * 3.6, 22.5 + Math.cos(a) * 4.6, 21.5 + Math.sin(a) * 4.6, '#dfe5ee');
    }),
    specks([[23.5, 22], [24, 22.5], [21.5, 23.5]], '#44484f'),
    specks([[21, 20], [21.5, 19.5], [21, 19.5]], '#eef3fa'),
  ],
  battleaxe: () => [
    ...grain([[8, 14, 0.35], [15.5, 21.5, -0.35], [26.5, 30, 0.3]], '#5e3c1e'),
    ...cord(1.3, 7, 1.3, '#2e1c10', 0.9),
    // an etched line following the edge, a nick in it, the collar's rivets
    hairAt(20, -8.5, 22.5, -9.8, '#6e7684'), hairAt(22.5, -9.8, 26.5, -9.8, '#6e7684'), hairAt(26.5, -9.8, 29, -8.5, '#6e7684'),
    specksAt([[25.5, -12], [26, -12]], '#4a4e58'),
    ...rivet(...at(23.6, -0.4).map(v => v - 0.25), '#3a3e46', '#dfe5ee'), ...rivet(...at(25.4, -0.4).map(v => v - 0.25), '#3a3e46', '#dfe5ee'),
    hairAt(23.8, 1.5, 24.4, 5, '#b8bec8'),
  ],

  // ---- missiles ----
  sling: () => [
    // the twist of the cords, a stitched pouch, a speckled stone, a frayed tail
    specks([[10, 9.5], [11, 11.5], [12, 13.5], [13.5, 16], [14.5, 17.5], [21.5, 18.5], [22.5, 16.5], [23.5, 14.5], [24.5, 12], [25, 10]], '#d0a878'),
    specks([[15.5, 22.5], [17, 23.3], [18.5, 23.6], [20, 23.3], [21.5, 22.5]], '#c8a070'),
    specks([[19.5, 20.5], [18, 20.5], [19, 18.5]], '#6a6660'), specks([[17.5, 18.5]], '#ffffff'),
    hair(26.8, 8.3, 27.8, 10.5, '#a07848'), hair(26.3, 8.5, 26.5, 10.8, '#a07848'),
    specks([[6.5, 5], [7, 4.5]], '#d0a878'),
  ],
  shortbow: () => [
    // grain on the limbs, cord wrapped round the grip, horn nocks at the tips
    hair(12, 5, 15, 7.5, '#6a4424'), hair(16.5, 9.5, 18.5, 12, '#6a4424'),
    hair(18.5, 20, 16.5, 23, '#6a4424'), hair(15, 24.5, 12, 27, '#6a4424'),
    hair(12.5, 5.5, 14, 6.5, '#c8905a'), hair(14, 26, 12.5, 27, '#c8905a'),
    ...[13.5, 15, 16.5, 18].map(y => hair(19, y, 20.5, y + 0.9, '#2e1c10')),
    specks([[8, 2.5], [8.5, 2.5], [8, 29], [8.5, 29]], '#e8dcc0'),
    // a serving on the string, a shaded arrow shaft, a bright arrowhead edge
    specks([[9, 13.5], [9.5, 14], [9, 14.5], [9.5, 15], [9, 17.5], [9.5, 18], [9, 18.5], [9.5, 19]], '#9a8a68'),
    hair(10, 16.5, 25.5, 16.5, '#7a5a38'),
    hair(26.5, 14.5, 29.5, 15.8, '#f6faff'), hair(26.5, 17.5, 29, 16.4, '#6e7682'),
    // the fletching's vanes
    hair(4, 14.5, 7, 15.5, '#ff9078'), hair(4, 17.5, 7, 16.5, '#a02820'),
  ],
  longbow: () => [
    // pale sapwood down the back of the stave, darker heartwood grain on the belly
    hair(9.5, 3.5, 13, 8, YEW_SAP), hair(14.5, 10, 15.9, 12.5, YEW_SAP),
    hair(15.9, 19.5, 14.5, 22, YEW_SAP), hair(13, 24, 9.5, 28.5, YEW_SAP),
    hair(10.7, 6.3, 12.8, 9.6, '#3a200e'), hair(12.8, 22.4, 10.7, 25.7, '#3a200e'),
    // the wrap wound on the slant, and its edges
    ...[13.6, 15.1, 16.6, 18.1].map(y => hair(14.4, y, 16.8, y + 0.9, '#2a180c')),
    hair(14.3, 12.6, 16.9, 12.6, '#7a5234'), hair(14.3, 19.4, 16.9, 19.4, '#2a180c'),
    // the horn catching the light, a dark notch where the string sits
    specks([[7.5, 1.5], [8, 2.5], [7.5, 29.5], [8, 28.5]], '#fff8e4'),
    specks([[7, 1], [7, 31]], '#3a2c1c'),
    // a serving on the string, the shaft's shadow, a bright edge on the head
    specks([[7, 13.5], [7.5, 14], [7, 14.5], [7.5, 15], [7, 17.5], [7.5, 18], [7, 18.5], [7.5, 19]], '#9a8a68'),
    hair(8, 16.5, 26.5, 16.5, '#6e4e30'),
    hair(27.5, 14.5, 30.5, 15.8, '#f6faff'), hair(27.5, 17.5, 30, 16.4, '#6e7682'),
    // grey goose fletching, a barred vane each side
    hair(2, 14.5, 5.5, 15.5, '#ffffff'), hair(2, 17.5, 5.5, 16.5, '#9a968c'),
    specks([[3.5, 15], [3.5, 17]], '#6a665e'),
  ],



  // ---- draughts ----
  potion_red: () => [
    // the meniscus, bubbles rising, a curve of light round the glass
    hair(9, 19, 23, 19, '#ff8a88'),
    specks([[18, 23], [20, 21], [19.5, 25.5], [15.5, 26.5]], '#f07078'),
    hair(9.5, 23.5, 10.5, 26.5, '#f4b0b4'),
    // a twine tie round the neck, grain in the cork
    hair(14.5, 11, 17.5, 11, '#c89a58'), specks([[17.5, 11.5], [17.5, 12.5]], '#c89a58'),
    specks([[15.5, 6.5], [16.5, 7.5]], '#6a4424'), specks([[15, 6]], '#c89a68'),
    specks([[21.5, 16.5], [22, 17]], '#f4fbff'),
  ],
  potion_pink: () => [
    // graduations up the flask's side, a meniscus, bubbles, a cork
    ...[16, 18, 22, 24].map(y => hair(19.5 + (y - 12) * 0.45, y, 18.5 + (y - 12) * 0.45, y, '#7a8698')),
    hair(9.5, 20, 22.5, 20, '#ffb0dc'),
    specks([[13, 23], [15.5, 25.5], [18, 22.5], [12, 27]], '#ff9ad0'),
    specks([[15.5, 3.5], [16.5, 4.5]], '#6a4424'), specks([[15, 3]], '#c89a68'),
    hair(13, 13, 11, 17, '#f4fbff'),
  ],
  potion_green: () => [
    // a paper label round the tube with a line of ink, bubbles, a cork
    hair(13, 22, 19, 22, '#e8dcb8'), hair(13, 22.5, 19, 22.5, '#e8dcb8'), hair(13, 23, 19, 23, '#e8dcb8'),
    hair(13, 23.5, 19, 23.5, '#e8dcb8'), hair(14, 22.5, 18, 22.5, '#5a4a38'),
    hair(14.5, 16.5, 17.5, 16.5, '#a8f0b8'),
    specks([[16.5, 19], [15.5, 20.5], [17, 26], [15.5, 27]], '#7ae890'),
    specks([[15.5, 4], [16.5, 5]], '#6a4424'), specks([[15, 3.5]], '#c89a68'),
  ],
  potion_orange: () => [
    // a label on the square bottle with a word in ink, a meniscus, a cork
    ...[20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5].map(y => hair(12, y, 20, y, '#ece0bc')),
    hair(12, 20.5, 20, 20.5, '#a89870'), hair(12, 24.5, 20, 24.5, '#a89870'),
    hair(13, 22, 18.5, 22, '#4a3a2c'), hair(14, 23.5, 17.5, 23.5, '#4a3a2c'),
    hair(9, 18, 23, 18, '#ffc080'),
    specks([[22, 26.5], [11, 27]], '#ffb060'),
    specks([[15.5, 3], [16.5, 4]], '#6a4424'), specks([[15, 2.5]], '#c89a68'),
    hair(22.5, 13.5, 22.5, 16.5, '#f4fbff'),
  ],
  potion_blue: () => [
    // red wax dripping down the neck from the stopper, and its stamp
    hair(13, 12.5, 13, 15, '#b8383a'), hair(18.5, 12.5, 18.5, 14, '#b8383a'), specks([[13, 15.5]], '#d8585a'),
    specks([[15.5, 11], [16, 11.5], [16.5, 11]], '#7a1c20'),
    // meniscus, bubbles, a highlight curving round the belly
    hair(8, 22, 24, 22, '#90b8ff'),
    specks([[18, 25], [20.5, 24], [14, 27], [22, 26.5]], '#70a0f8'),
    hair(22.5, 19.5, 24, 21, '#f4fbff'), hair(11, 27.5, 13, 28.5, '#6a98f0'),
  ],

  // ---- paper ----
  scroll: () => [
    // shade where the paper curls under each rod, a heading with a flourish
    hair(8.5, 9.3, 23.5, 9.3, '#b8a47a'), hair(8.5, 23.8, 23.5, 23.8, '#b8a47a'),
    hair(12, 10.5, 19, 10.5, '#8a2a20'), hair(19, 10.5, 20.5, 9.8, '#8a2a20'), specks([[11.5, 11]], '#8a2a20'),
    // a signature, glints on the rod ends, the seal's stamp
    hair(17, 22.5, 18.5, 21.8, '#4a3c30'), hair(18.5, 21.8, 20.5, 22.5, '#4a3c30'),
    specks([[5.3, 6.3], [25.7, 6.3], [5.3, 25.3], [25.7, 25.3]], '#c89a68'),
    specks([[18.5, 26], [19.5, 26], [19, 25.5], [19, 26.5]], '#7a141c'),
  ],
  page: () => [
    // a fold down the middle, a coffee ring, a torn edge darkened with age
    hair(7.5, 15.8, 25.5, 16.3, '#b8a47a'), hair(7.5, 16.3, 25.5, 16.8, '#f4ead0'),
    specks([[10, 19], [11, 18.5], [12, 19], [12.5, 20], [12, 21], [11, 21.5], [10, 21], [9.5, 20]], '#b8945e'),
    specks([[9.5, 27], [12, 28.5], [15, 27], [18, 28.5], [21, 26.5], [23, 28], [25.5, 26.5], [24.5, 5]], '#a88a5a'),
    // a heading underlined, and a blot where the pen rested
    hair(10, 6.5, 18, 6.5, '#4a3c30'),
    specks([[22.5, 18.5], [23, 18.5], [23, 19], [22.5, 19], [23.5, 19.5]], '#2a2018'),
  ],

  // ---- food ----
  ration: () => [
    // creases in the paper, the twist of the string, a grease spot, a stamp
    hair(6, 16, 9, 18.5, '#8a7048'), hair(26, 16, 23.5, 18, '#8a7048'), hair(9, 11, 12, 13, '#f0dcb0'),
    specks([[16, 16], [16, 18.5], [16, 22], [16, 25], [8, 20], [11, 20], [21, 20], [24.5, 20]], '#a8865a'),
    specks([[21, 23.5], [22, 24], [21.5, 24.5], [22.5, 23]], '#98804c'),
    specks([[9.5, 23], [10.5, 24], [10.5, 23], [9.5, 24], [10, 23.5]], '#8a2a20'),
    hair(13, 9, 12.5, 8, '#7a5a3a'), hair(19.5, 9.5, 20.5, 8.5, '#7a5a3a'),
  ],
  meat: () => [
    // streaks of fat through the roast, char, pepper, a glisten
    hair(8, 16, 11, 18, '#e8b898'), hair(14.5, 19, 17.5, 18.5, '#e8b898'), hair(17, 11, 19.5, 13, '#e8b898'),
    specks([[7, 12], [12, 20.5], [19, 17.5], [20, 11], [16.5, 8]], '#5a2414'),
    specks([[10, 13], [15, 16], [18, 14], [8.5, 17]], '#3a1a10'),
    specks([[9, 10.5], [11.5, 9]], '#ffffff'),
    // the knuckle of the bone
    hair(19.5, 21, 24, 25.5, '#ffffff'), specks([[25.5, 27], [26, 27]], '#b8ae94'),
  ],
  bread: () => [
    // flour dusted on the crown, cracks in the crust, crumbs fallen from it
    specks([[11, 16.5], [13, 16], [15.5, 15.5], [18, 16], [20, 16.5], [12, 18], [17, 17.5], [22.5, 18.5]], '#f8ecd4'),
    hair(6, 21, 8, 22.5, '#8a5220'), hair(24, 20, 26, 21.5, '#8a5220'), hair(13, 24.5, 16, 25, '#8a5220'),
    specks([[7, 27], [9.5, 27.5], [22.5, 27.5], [25, 27]], '#b87a38'),
    specks([[7, 18.5], [8, 17.5]], '#f0c080'),
  ],

  // ---- treasure ----
  gold: () => [
    // a crown stamped on the top coin, rims round the others, glints
    specks([[15, 19], [16, 18.5], [17, 19], [15.5, 19.5], [16.5, 19.5]], '#fff4b0'),
    ...[[8.5, 27.5], [15.5, 28], [22.5, 27.5], [12, 25], [19, 25], [15.5, 22.3], [10, 22.8]].map(([x, y]) => hair(x - 2.5, y + 1.2, x + 2.5, y + 1.2, '#a07818')),
    specks([[23, 18], [23, 19.5], [23, 21], [23, 22.5], [7.5, 16], [7.5, 17.5], [7.5, 19], [7.5, 20.5]], '#a07818'),
    specks([[13, 21.5], [18.5, 24], [7, 27], [21.5, 26.5]], '#ffffff'),
  ],
  gem: () => [
    // facets cut into the crown and pavilion, and a star of light
    hair(12, 8.5, 9.5, 12.5, '#bff0ff'), hair(20, 8.5, 22.5, 12.5, '#3c9ad8'),
    hair(9, 13.5, 16, 28, '#8ae0ff'), hair(23, 13.5, 16, 28, '#1a6aa8'), hair(20, 13.5, 16.5, 27, '#1e78b8'),
    specks([[21.5, 9.5], [21.5, 10.5], [21.5, 11.5], [20.5, 10.5], [22.5, 10.5]], '#ffffff'),
    specks([[16.5, 9], [18, 9]], '#e8faff'),
  ],
  artifact: () => [
    // veins across the stone heart, a glow at its centre, a chased gold stand
    hair(21, 9, 23, 12, '#8a1622'), hair(22, 16, 20, 19, '#8a1622'), hair(12, 18, 13.5, 20, '#8a1622'),
    specks([[15.5, 13.5], [16, 13], [16.5, 13.5], [16, 14]], '#ffd0a0'),
    hair(9.5, 27.5, 22.5, 27.5, '#fff0a0'),
    specks([[11, 29.5], [13, 29.5], [15, 29.5], [17, 29.5], [19, 29.5], [21, 29.5]], '#8a6a20'),
    specks([[8.5, 8], [7.5, 9]], '#ffffff'),
  ],
};

// the keys, each in its own metal: a bevel on the shaft, a glint on the bow,
// a collar where they meet and the cuts between the teeth
for (const k in ITEM_ART) {
  if (k !== 'key' && !k.startsWith('key_')) continue;
  const c = k === 'key' ? BRASS : KEY_COLORS[k.slice(4)];
  ITEM_DETAILS[k] = () => [
    hair(14, 13, 21, 20, shade(c, 0.55)),
    hair(13, 14.5, 19, 20.5, shade(c, -0.3)),
    hair(12.8, 14.6, 14.6, 12.8, shade(c, -0.45)), hair(13.3, 15, 15, 13.3, shade(c, 0.35)),
    specks([[6.5, 7], [7, 6.5], [7.5, 6]], shade(c, 0.7)),
    specks([[12, 11], [11.5, 12]], shade(c, -0.4)),
    specks([[19, 22.5], [21.5, 24.5], [20.5, 23.5]], shade(c, -0.5)),
    specks([[24.5, 24.5]], shade(c, 0.7)),
  ];
}
for (const k in ITEM_DETAILS) {
  const base = ITEM_ART[k];
  ITEM_ART[k] = () => [...base(), ...ITEM_DETAILS[k]()];
}

/** Every item picture, painted: sprite key -> parts. */
// Where the hand closes on each weapon when the hero holds it, in the icon's
// own coordinates: a point on the weapon's axis, a second lower down for the
// other hand of a two-handed grip. A sling hangs from its loop and does not
// turn with the swing as a blade does. A bow is drawn from behind instead
// (see heldart.js), so it has no grip here.
// The two-handed sword is the exception: squeezed into a pack square its
// picture is a long sword's length, and held up like one it passed for one.
// In the hand it is drawn from its own picture (HELD_ART), with a grip long
// enough for both fists and a blade as long as a man's leg, on a bigger grid.
const HELD_ART = {
  greatsword: () => [
    ball(...at(-0.9), 2.3, 2.3, BRASS),                                           // the pommel
    axis(-0.2, 12.4, 1.35, 1.35, '#4a2e1a'),                                      // a grip for two fists
    ...[0.8, 2.8, 4.8, 6.8, 8.8, 10.8].map(s => guard(s, 2.7, '#7a5230', 0.5)),   // its leather wraps
    // long swept quillons with a ruby at the cross
    limb(...at(12.6, -9.5), ...at(13.8, -3.2), 1.25, 1.1, BRASS), limb(...at(12.6, 9.5), ...at(13.8, 3.2), 1.25, 1.1, BRASS),
    guard(13.5, 7.2, BRASS, 1.35),
    ball(...at(13.5), 1.05, 1.05, '#c02838'), specks([at(13.2, -0.4)], '#ff9aa0'),
    // a broad blade with a leather-wrapped ricasso and parrying lugs above it
    ...blade(14.2, 44, 4.8),
    ...bevels(14.2, 44, 4.8),
    axis(14.4, 18.2, 1.8, 1.8, WRAP), ...cord(14.6, 18, 1.8, '#2e1c10', 0.8),
    ball(...at(19.2, -3.2), 1, 1, STEEL), ball(...at(19.2, 3.2), 1, 1, STEEL),
    // a nick or two in the edge, old blood near the point
    specksAt([[27, -2.2], [27.4, -2.2], [34, 2.2]], '#3a3e48'), specksAt([[38.5, 0.6]], '#6a2020'),
  ],
};

const GRIPS = {
  dagger: { at: at(7.8) }, shortsword: { at: at(7.3) }, longsword: { at: at(7) }, scimitar: { at: at(7) },
  // in its HELD_ART picture: the right fist under the guard, the left at the pommel
  greatsword: { at: at(9.9), second: at(3.4), grid: 100 }, throwknife: { at: at(12.5) },
  club: { at: at(5.6) }, staff: { at: at(13.5), second: at(3.5) }, spear: { at: at(9.5) },
  mace: { at: at(5.2) }, hammer: { at: at(5.2) }, dwarfhammer: { at: at(5.2) }, handxbow: { at: at(6) }, flail: { at: at(4.6) }, battleaxe: { at: at(4.4) },
  sling: { at: [8, 6.5], fixed: true },
};
const ICON_AXIS = -Math.PI / 4;   // the icon's blades point up and to the right

// Elven Chain: the chain shirt's own picture, finer and darker, the colour of
// a blade in moonlight, laced in violet (drawn from the chain so the two read as kin)
const MITHRAL = { '#868c96': '#343848', '#8e949e': '#3c4054', '#9ea4ae': '#4c5268', '#7a808a': '#2a2e3c', '#4e545e': '#9aa0c8',
  '#dfe4ec': '#f4f4ff', '#2a2e36': '#120e18', '#7a6a50': '#3a2050', '#9a8a6a': '#a070e0', '#6a707a': '#5a3a88', '#b8bec8': '#c8b0f0' };
/** @type {any} */ (ITEM_ART).elvenchain = () => ITEM_ART.chain().map(p => (MITHRAL[p.c] ? { ...p, c: MITHRAL[p.c] } : p));

// The grey dwarves' make: their plate, hammer and shield drawn from the plain
// ones (so the two read as kin), in the dark iron they dig, the brass on them
// copper. Wood and leather are left as they are.
const DARK_IRON = c => {
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const hex = (...v) => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  if (mx - mn < 30) return hex(r * 0.58 + 8, g * 0.58 + 8, b * 0.58 + 12);
  const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  return r > g && g > b && l > 0.42 ? hex(255 * l * 1.05, 150 * l * 1.05, 74 * l * 1.05) : c;
};
const dwarven = parts => parts.map(p => (/^#[0-9a-f]{6}$/i.test(p.c) ? { ...p, c: DARK_IRON(p.c) } : p));
// (their shield's face is iron through, not painted wood: every colour on it goes to the iron's)
const ironclad = parts => parts.map(p => { if (!/^#[0-9a-f]{6}$/i.test(p.c)) return p; const n = parseInt(p.c.slice(1), 16), l = ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; return { ...p, c: '#' + [l * 140 + 22, l * 146 + 24, l * 156 + 28].map(x => Math.round(Math.min(255, x)).toString(16).padStart(2, '0')).join('') }; });
/** @type {any} */ (ITEM_ART).dwarfplate = () => dwarven(ITEM_ART.plate());
/** @type {any} */ (ITEM_ART).dwarfhammer = () => dwarven(ITEM_ART.hammer());
/** @type {any} */ (ITEM_ART).runeshield = () => [...ironclad(ITEM_ART.towershield()), ...[[13, 12, 16, 16], [16, 16, 19, 12], [16, 16, 16, 22], [13, 22, 19, 22]].map(([a, b, c, d]) => hair(a, b, c, d, '#7ad0e8', { glows: true }))];
/** @type {any} */ (HELD_ART).dwarfhammer = () => dwarven(HELD_ART.hammer());
// The lizardfolk's marsh-hide: the leather coat's own picture, in green-brown scaled hide
/** @type {any} */ (ITEM_ART).marshhide = () => [...ITEM_ART.leather().map(p => (/^#[0-9a-f]{6}$/i.test(p.c) ? { ...p, c: (n => { const r = n >> 16, g = (n >> 8) & 255, b = n & 255, l = (r * 0.3 + g * 0.59 + b * 0.11) / 255; return '#' + [l * 120 + 10, l * 150 + 18, l * 90 + 8].map(v => Math.round(Math.min(255, v)).toString(16).padStart(2, '0')).join(''); })(parseInt(p.c.slice(1), 16)) } : p)),
  ...[[12, 12], [18, 12], [15, 16], [12, 20], [18, 20], [15, 24]].map(([x, y]) => ball(x, y, 1.1, 0.8, '#7e9e52'))];
// Hissra's: a long yellow fang on a thong of hide
/** @type {any} */ (ITEM_ART).amulet_tooth = () => [
  ...[0.12, 0.3, 0.5, 0.7, 0.88].map((t, n, a) => n ? limb(16 + Math.cos(Math.PI * (1 - a[n - 1])) * 9, 6 + Math.sin(Math.PI * a[n - 1]) * 9, 16 + Math.cos(Math.PI * (1 - t)) * 9, 6 + Math.sin(Math.PI * t) * 9, 0.6, 0.6, '#6a4a2a') : null).filter(Boolean),
  limb(16, 15, 16, 17, 1, 1, '#6a4a2a'),
  sheet([[13.5, 17], [18.5, 17], [17.4, 23], [16, 29], [14.6, 23]], '#e8d898', { curve: 0.7 }), sheet([[16.6, 17.5], [18.5, 17], [17.4, 23], [16, 29]], '#b8a868', { curve: 0.5 }),
  hair(14.6, 18, 15.6, 26, '#fff8d8'),
];
// A dark elf's hand crossbow: a short black stock with a violet stone set in it, a small
// steel prod across its head, the string drawn back to the nut, a bolt laid in it
/** @type {any} */ (ITEM_ART).handxbow = () => [
  axis(2.5, 21, 1.5, 1.2, '#2a2230'), axis(3, 20.5, 0.5, 0.4, '#463a52'),
  ball(...at(9), 1.1, 1.1, '#9a60e0', { glows: true }),
  limb(...at(19.5, -8.5), ...at(21.5, 0), 0.75, 0.9, '#b8bccc'), limb(...at(21.5, 0), ...at(19.5, 8.5), 0.9, 0.75, '#b8bccc'),
  hair(...at(19.5, -8.3), ...at(13.5, 0), '#d8d0c0'), hair(...at(13.5, 0), ...at(19.5, 8.3), '#d8d0c0'),
  axis(13.5, 27.5, 0.45, 0.45, '#6a4a2c'), axis(26.5, 29.5, 0.8, 0.2, '#eef0f8'),
  hairAt(3, -1, 20, -1, '#5a4e66'), specksAt([[22, -0.5]], '#ffffff'),
];

export { ITEM_ART, HELD_ART, GRIPS, ICON_AXIS };
