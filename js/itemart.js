// Items drawn from lit parts, in the same hand as the creatures.
//
// Every piece of gear gets its own picture, so a chain shirt no longer looks
// like plate and a flail no longer looks like a mace. Weapons lie on the
// diagonal, grip at the lower left and point at the upper right, which is how
// they read best in a pack slot and uses the whole square. Potions keep one
// bottle shape per colour, so the colour is never the only clue.

import { ball, limb, sheet, line, dots, specks, hair } from './creatures.js';
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
/** Every pixel centre inside a polygon, for textures laid over a shape. */
function inside(pts, test) {
  const out = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inn = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inn = !inn;
    }
    if (inn && (!test || test(x, y))) out.push([x, y]);
  }
  return out;
}

// the shape every body armour is cut from: shoulders, arm holes, waist
const TORSO = [[5, 8], [11, 5], [13, 7.5], [19, 7.5], [21, 5], [27, 8], [27, 13], [24, 15], [23.5, 27], [8.5, 27], [8, 15], [5, 13]];
const NECK = [[13, 7.5], [19, 7.5], [17.5, 11], [14.5, 11]];

// A robe: a gown that flares to the floor, bell sleeves, a hood fallen behind
// the neck, a sash at the waist and a trimmed hem and opening.
const ROBE = [[7, 8], [11, 5], [13, 7.5], [19, 7.5], [21, 5], [25, 8], [29.5, 16.5], [26, 18], [23, 18.5], [28.5, 30], [3.5, 30], [9, 18.5], [6, 18], [2.5, 16.5]];
function robe(cloth, light, trim, extra) {
  return [
    ball(16, 6.5, 5.5, 3, shade(cloth, -0.35)),          // the hood, behind
    sheet(ROBE, cloth, { curve: 1 }),
    sheet(NECK, shade(cloth, -0.55)),
    // the lit fold down the left, a shadowed one down the right
    limb(11, 10, 11, 17, 1, 1, light), limb(11.5, 20, 7.5, 29, 1, 1.8, light), limb(20.5, 20, 24.5, 29, 1, 1.6, shade(cloth, -0.25)),
    // trim down the opening and round the hem and the cuffs
    line(16, 11, 16, 29.5, trim), line(4.5, 29.5, 27.5, 29.5, trim),
    line(3, 16.5, 6.5, 17.8, trim), line(25.5, 17.8, 29, 16.5, trim),
    // the sash
    limb(9.5, 18.5, 22.5, 18.5, 1, 1, shade(cloth, -0.45)),
    ...extra,
  ];
}

// A cloak: a hood fallen behind the neck, a mantle hung from a clasp and
// falling wide to the hem in folds, lit down one side.
const CLOAK = [[11, 6], [21, 6], [24, 10], [27, 29], [5, 29], [8, 10]];
function cloak(cloth, light, clasp, extra) {
  return [
    ball(16, 6, 6, 3, shade(cloth, -0.35)),                 // the hood, behind
    sheet(CLOAK, cloth, { curve: 0.6 }),
    // folds: lit down the left, in shadow down the right
    limb(11, 11, 8.5, 28, 0.9, 1.6, light), limb(16, 12, 16, 28, 0.7, 1.2, shade(cloth, -0.3)), limb(21, 11, 23.5, 28, 0.9, 1.5, shade(cloth, -0.4)),
    ball(16, 8, 1.8, 1.8, clasp),                            // the clasp at the throat
    ...extra,
  ];
}

/** A glass bottle: glass above the liquid line, the draught below, a cork. */
function bottle(bodyParts, liquidParts, neck, glints) {
  return [
    ...bodyParts,
    ...liquidParts,
    ...neck,
    dots(glints, '#f4fbff'),
  ];
}

/**
 * A ring lying at a slant: a band seen as an ellipse, thick and bright at the
 * front, thinner and in shadow at the back, and a stone in a setting on top
 * where it has one. Without a stone the band itself is the thing to see.
 */
function jewelRing(band, dark, stone, hi, plainMark) {
  const out = [], cx = 16, cy = 20, rx = 11.5, ry = 7.2, n = 22;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, mid = (a0 + a1) / 2;
    const front = Math.sin(mid) > 0, w = stone ? (front ? 2 : 1.4) : (front ? 2.6 : 1.8);
    out.push(limb(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, w, w, front ? band : dark));
  }
  // the light along the band's front edge
  for (let i = 3; i < 8; i++) { const a = i / 10 * Math.PI; out.push(dots([[cx + Math.cos(a) * rx, cy + Math.sin(a) * ry + 1.2]], hi || '#ffffff')); }
  if (stone) {
    out.push(ball(cx, cy - ry - 0.5, 5, 3, dark));
    out.push(ball(cx, cy - ry - 3.5, 4.4, 4.1, stone));
    out.push(dots([[cx - 1.6, cy - ry - 5.2], [cx - 0.6, cy - ry - 6]], hi));
  } else if (plainMark) out.push(...plainMark(cx, cy, rx, ry));
  return out;
}
/** An amulet: a chain hung in a curve from the top corners, and a pendant in its frame. */
function jewelAmulet(chain, frame, stone, hi, cord) {
  const out = [];
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, x = 4 + t * 24, y = 2 + Math.sin(t * Math.PI) * 13; pts.push([x, y]); }
  for (let i = 0; i < pts.length - 1; i++) {
    if (cord) out.push(limb(...pts[i], ...pts[i + 1], 0.7, 0.7, chain));
    else out.push(ball((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, 1.1, 0.8, i % 2 ? frame : chain));
  }
  out.push(ball(16, 17.5, 1.6, 1.6, frame));
  out.push(ball(16, 24, 6.6, 7.2, frame));
  out.push(ball(16, 24, 4.9, 5.5, stone));
  out.push(dots([[13.8, 21], [14.5, 20.3]], hi));
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

const ITEM_ART = {
  // ---- rings and amulets: each look its own metal and stone ----
  ring_silver: () => jewelRing('#c8ccd4', '#80868f', '#3a6ad8', '#a8c8ff'),
  ring_gold: () => jewelRing('#e8b830', '#9a7418', '#d02a3a', '#ff9aa4'),
  ring_garnet: () => jewelRing('#b4bcc8', '#6e727c', '#8a1a3a', '#e06080'),
  ring_onyx: () => jewelRing('#c8ccd4', '#80868f', '#1a1a22', '#8a8a9a'),
  ring_copper: () => jewelRing('#c87a40', '#7a4420', '#e8a030', '#ffe0a0'),
  ring_jade: () => jewelRing('#4aa070', '#2a6a48', null, '#9ae0b8', (cx, cy, rx, ry) => [dots([[cx - 4, cy + ry - 0.5], [cx - 3, cy + ry], [cx + 2, cy + ry + 0.2]], '#bff0d0')]),
  ring_bone: () => jewelRing('#e8dcc0', '#a89c80', null, '#ffffff', (cx, cy, rx, ry) => [0.2, 0.35, 0.5, 0.65, 0.8].map(t => { const a = t * Math.PI; return dots([[cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]], '#6a5c44'); })),
  ring_iron: () => jewelRing('#6e727c', '#3a3e46', null, '#b4bcc8', (cx, cy, rx, ry) => [0.25, 0.5, 0.75].map(t => { const a = t * Math.PI; return ball(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.9, 0.9, '#9aa0a8'); })),
  amulet_amber: () => jewelAmulet('#e8b830', '#9a7418', '#e8a030', '#ffe0a0'),
  amulet_silver: () => jewelAmulet('#c8ccd4', '#80868f', '#d8e8f8', '#ffffff'),
  amulet_obsidian: () => jewelAmulet('#6e727c', '#3a3e46', '#1a1622', '#8a7aa8'),
  amulet_bone: () => jewelAmulet('#8a5a32', '#a89c80', '#e8dcc0', '#ffffff', true),
  // ---- blades ----
  dagger: () => [
    axis(5.5, 10, 1.1, 1.1, WRAP), ball(...at(4.8), 1.6, 1.6, BRASS),
    guard(10.5, 6), ...blade(11, 22, 2.6),
  ],
  shortsword: () => [
    // a soldier's blade: plain steel fittings, quillons swept toward the point
    axis(4.5, 10, 1.2, 1.2, '#3e2a1c'), ball(...at(3.6), 1.8, 1.8, DARK_STEEL),
    limb(...at(10.2, -4.5), ...at(11.5, -1), 0.9, 0.9, DARK_STEEL), limb(...at(10.2, 4.5), ...at(11.5, 1), 0.9, 0.9, DARK_STEEL),
    ball(...at(10.8), 1.4, 1.4, DARK_STEEL),
    ...blade(11.5, 26.5, 3.3),
  ],
  longsword: () => [
    axis(3.2, 10.5, 1.15, 1.15, WRAP),
    dots([at(5), at(7), at(9)].map(([x, y]) => [Math.round(x), Math.round(y)]), '#3a2414'),
    ball(...at(2.4), 1.9, 1.9, STEEL),
    guard(11, 11, DARK_STEEL, 1), ball(...at(11, -5.5), 1.1, 1.1, DARK_STEEL), ball(...at(11, 5.5), 1.1, 1.1, DARK_STEEL),
    ...blade(11.5, 31, 3.1),
  ],
  greatsword: () => [
    axis(2, 10.5, 1.3, 1.3, '#4a2e1a'),
    ...[3.5, 5.5, 7.5, 9.5].map(s => guard(s, 2.6, '#7a5230', 0.55)),
    ball(...at(1.2), 2.1, 2.1, BRASS),
    // swept quillons, a leather-wrapped ricasso, then a blade as long as a man's leg
    limb(...at(11, -7), ...at(12.2, -3), 1.1, 1, BRASS), limb(...at(11, 7), ...at(12.2, 3), 1.1, 1, BRASS),
    guard(12, 6.5, BRASS, 1.2),
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
    dots([at(16, 1.5), at(21, -1.5), at(24, 1.8)].map(([x, y]) => [Math.round(x), Math.round(y)]), DARK_WOOD),
    dots([at(18, -2.2), at(25.5, -1)].map(([x, y]) => [Math.round(x), Math.round(y)]), '#b07a48'),
  ],
  staff: () => [
    axis(0.5, 30, 1.15, 1.15, WOOD),
    ball(...at(0.2), 1.2, 1.2, IRON),
    axis(27.5, 29, 1.6, 1.6, BRASS), axis(12, 15, 1.35, 1.35, WRAP),
    ball(...at(31), 2.6, 2.6, '#58b8f0'),
    dots([at(30.3, -1.1)].map(([x, y]) => [Math.round(x), Math.round(y)]), '#e8faff'),
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
      ball(...at(1.6), 1.5, 1.5, IRON),
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
    dots([[17, 19]], '#d8d4cc'),
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
      dots([[5, 15], [6, 15], [5, 17], [6, 17], [4, 14], [4, 18]], '#e04838'),
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
      dots([[3, 15], [4, 15], [5, 15], [3, 17], [4, 17], [5, 17], [2, 14], [2, 18]], '#e4e0d4'),
      ...stave,
      // a leather wrap round the grip, longer than the short bow's cord
      limb(pts[4][0] + 0.2, 12.8, pts[6][0] + 0.2, 19.2, 1.55, 1.55, '#4a2c18'),
      // horn nocks capping both tips
      limb(pts[0][0] + 0.8, pts[0][1] + 2.6, pts[0][0], pts[0][1], 0.95, 0.7, HORN),
      limb(pts[10][0] + 0.8, pts[10][1] - 2.6, pts[10][0], pts[10][1], 0.95, 0.7, HORN),
    ];
  },

  // ---- body armour ----
  leather: () => [
    sheet(TORSO, '#8a5a34', { curve: 1 }),
    sheet(NECK, '#3a2414'),
    ball(8, 9, 3.2, 2.4, '#7a4e2c'), ball(24, 9, 3.2, 2.4, '#7a4e2c'),
    // laced up the front, belted at the waist
    dots([[15, 12], [17, 13], [15, 14], [17, 15], [15, 16], [17, 17], [15, 18], [17, 19]], '#e0c890'),
    limb(8.5, 23, 23.5, 23, 1.2, 1.2, '#4a2e1a'),
    dots([[15, 23], [16, 23], [17, 23], [15, 22], [17, 22], [15, 24], [17, 24]], BRASS),
  ],
  studded: () => [
    sheet(TORSO, '#6e4a2c', { curve: 1 }),
    sheet(NECK, '#2e1c10'),
    ball(8, 9, 3.2, 2.4, '#5e3e24'), ball(24, 9, 3.2, 2.4, '#5e3e24'),
    // rows of rivets, offset row to row
    dots([...[11, 14, 17, 20, 23].flatMap((y, r) => [10, 13, 16, 19, 22].map(x => [x + (r % 2), y]))], '#d8dce4'),
    dots([...[11, 14, 17, 20, 23].flatMap((y, r) => [10, 13, 16, 19, 22].map(x => [x + (r % 2), y + 1]))], '#3a2616'),
    dots([[7, 8], [9, 8], [23, 8], [25, 8]], '#d8dce4'),
  ],
  scale: () => {
    const body = TORSO;
    return [
      sheet(body, '#a08850', { curve: 1 }),
      sheet(NECK, '#3a2c18'),
      // overlapping scales: a dark lower lip and a bright crown on each
      dots(inside(body, (x, y) => y > 9 && y < 26 && (y % 3 === 0) && ((x + (y % 6 ? 0 : 1)) % 2 === 0)), '#5e4c28'),
      dots(inside(body, (x, y) => y > 9 && y < 26 && (y % 3 === 1) && ((x + (y % 6 === 1 ? 1 : 0)) % 2 === 0)), '#dcc890'),
      ball(8, 9, 3.4, 2.5, '#b0985c'), ball(24, 9, 3.4, 2.5, '#b0985c'),
    ];
  },
  chain: () => [
    // short mail sleeves hang below the shoulders
    limb(7, 10, 5.5, 17, 2.6, 2.2, '#8e949e'), limb(25, 10, 26.5, 17, 2.6, 2.2, '#8e949e'),
    sheet(TORSO, '#9aa0aa', { curve: 1 }),
    sheet(NECK, '#2a2e36'),
    // every other link dark, so the mail reads as rings rather than cloth
    dots(inside(TORSO, (x, y) => y > 8 && (x + y) % 2 === 0 && !(y < 11 && x > 12 && x < 19)), '#5c626c'),
    dots([[5, 16], [6, 17], [26, 16], [25, 17]], '#5c626c'),
    limb(8.5, 26, 23.5, 26, 1, 1, '#7a808a'),
  ],
  splint: () => [
    sheet(TORSO, '#4a3a2c', { curve: 1 }),
    sheet(NECK, '#221810'),
    ...[10, 13, 16, 19, 22].map(x => limb(x + 0.5, 12, x + 0.5, 25.5, 1.15, 1.15, STEEL)),
    limb(9, 11, 23, 11, 1, 1, DARK_STEEL),
    ball(7.5, 9.5, 3.6, 2.8, STEEL), ball(24.5, 9.5, 3.6, 2.8, STEEL),
    dots([[10, 12], [13, 12], [16, 12], [19, 12], [22, 12], [10, 25], [13, 25], [16, 25], [19, 25], [22, 25]], BRASS),
  ],
  plate: () => [
    sheet(TORSO, '#aab4c2', { curve: 1 }),
    sheet(NECK, '#2a2e38'),
    // a ridge down the breastplate, gilt edges, and lames over the belly
    line(16, 12, 16, 21, '#eef3fa'),
    limb(9, 22.5, 23, 22.5, 0.9, 0.9, '#8a94a2'), limb(9, 25, 23, 25, 0.9, 0.9, '#8a94a2'),
    line(13, 7, 19, 7, GOLD), line(14, 11, 18, 11, GOLD),
    ball(7.5, 9.5, 4.2, 3.4, '#b8c2d0'), ball(24.5, 9.5, 4.2, 3.4, '#b8c2d0'),
    line(4, 11, 11, 11, GOLD), line(21, 11, 28, 11, GOLD),
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
    dots([[6, 28], [8.5, 27.5], [11, 28], [13.5, 27.5], [18.5, 27.5], [21, 28], [23.5, 27.5], [26, 28]], '#ffd870'),
    ...ring(16, 15, 2, 0.45, '#ffd870', 10),
  ]),
  robe_magi: () => robe('#4a2478', '#6a38a4', GOLD, [
    // stars scattered on the cloth, a bright sigil, gold at the cuffs
    dots([[10, 13], [22, 12], [12, 22], [20, 21], [9, 27], [23, 27], [14, 26]], '#fff0a0'),
    ball(16, 15, 1.6, 1.6, '#c8f0ff'), ball(16, 15, 0.7, 0.7, '#ffffff'),
    line(3, 17, 6.5, 18.2, GOLD), line(25.5, 18.2, 29, 17, GOLD),
  ]),

  // ---- shields ----
  buckler: () => [
    ball(16, 17, 10, 10, DARK_STEEL),
    ball(16, 17, 8.4, 8.4, WOOD),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => dots([[Math.round(16 + Math.cos(i * Math.PI / 4) * 9.2 - 0.5), Math.round(17 + Math.sin(i * Math.PI / 4) * 9.2 - 0.5)]], '#dfe4ec')),
    ball(16, 17, 3.2, 3.2, STEEL),
  ],
  shield: () => {
    const outer = [[5, 4], [27, 4], [27, 15], [24, 22.5], [16, 30], [8, 22.5], [5, 15]];
    const face = [[7, 6], [25, 6], [25, 15], [22.5, 21.5], [16, 27.5], [9.5, 21.5], [7, 15]];
    return [
      sheet(outer, DARK_STEEL, { curve: 1 }),
      sheet(face, '#2e4a7a', { curve: 1 }),
      // a gold bend across the field
      sheet([[7, 9.5], [10, 6], [25, 21], [22.5, 21.5], [21.5, 23.5]], GOLD, { curve: 1 }),
      dots([[7, 5], [16, 5], [25, 5], [6, 14], [26, 14]], '#e6ebf2'),
    ];
  },
  towershield: () => {
    const outer = [[6, 2], [26, 2], [26, 27], [16, 31], [6, 27]];
    return [
      sheet(outer, '#7a5230', { curve: 1 }),
      ...[10, 14, 18, 22].map(x => line(x, 3, x, 28, '#5a3a20')),
      sheet([[14, 3], [18, 3], [18, 29], [16, 30], [14, 29]], '#8a2a2a', { curve: 0.4 }),
      limb(6, 8, 26, 8, 1.1, 1.1, IRON), limb(6, 22, 26, 22, 1.1, 1.1, IRON),
      ball(16, 15, 3.4, 3.4, STEEL),
      dots([[7, 8], [25, 8], [7, 22], [25, 22], [7, 3], [25, 3]], '#d8dce4'),
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
    dots([[10, 15], [22, 15], [10, 26], [22, 26]], '#58c0ff'),
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

  // ---- paper ----
  scroll: () => [
    sheet([[8, 7.5], [24, 7.5], [24, 25.5], [8, 25.5]], '#e8d8b0', { curve: 0.5 }),
    dots([...[12, 15, 18, 21].flatMap(y => [11, 12, 13, 15, 16, 17, 18, 20, 21].filter((x, i) => (x + y) % 7 !== 0).map(x => [x, y]))], '#6a5a48'),
    limb(6.5, 7, 25.5, 7, 2, 2, '#d8c498'), limb(6.5, 26, 25.5, 26, 2, 2, '#d8c498'),
    ball(5.8, 7, 1.5, 1.8, '#7a5230'), ball(26.2, 7, 1.5, 1.8, '#7a5230'),
    ball(5.8, 26, 1.5, 1.8, '#7a5230'), ball(26.2, 26, 1.5, 1.8, '#7a5230'),
    limb(19, 26, 20.5, 30, 0.7, 0.7, '#b82a30'), ball(19, 26.3, 2, 1.8, '#b82a30'),
  ],
  page: () => {
    const torn = [[7, 4], [25, 5], [26, 27], [23, 28.5], [21, 27], [18, 29], [15, 27.5], [12, 29], [9, 27.5], [6, 28]];
    return [
      sheet(torn, '#e2d2a8', { tilt: [-0.15, -0.3] }),
      dots([...[8, 11, 14, 17, 20, 23].flatMap(y => [10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22].filter(x => (x * 3 + y) % 5 !== 0).map(x => [x, y]))], '#4a3c30'),
      dots([[22, 23], [23, 24], [21, 24]], '#8a2020'),
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
    dots([[9, 14], [11, 16], [13, 18], [14, 12], [16, 14], [18, 16]], '#8a3a24'),
    dots([[9, 9], [10, 9], [8, 10]], '#f0c8a8'),
  ],
  bread: () => [
    ball(16, 21, 12, 7, '#c8883e'),
    ball(15, 19, 8, 4, '#d69a4e'),
    ...[10, 15, 20].map(x => limb(x - 1.5, 21, x + 2, 16.5, 0.55, 0.55, '#f0cc90')),
    dots([[6, 24], [26, 24], [8, 26], [24, 26]], '#9a6228'),
  ],

  // ---- treasure ----
  gold: () => {
    const coin = (x, y) => ball(x, y, 3.8, 1.7, GOLD);
    return [
      coin(8.5, 27.5), coin(15.5, 28), coin(22.5, 27.5),
      coin(12, 25), coin(19, 25), coin(15.5, 22.3), coin(10, 22.8),
      ball(23.5, 20.5, 1.5, 3.8, '#d8a828'), ball(8, 18.5, 1.5, 3.6, '#d8a828'),
      coin(16, 19.5),
      dots([[14, 18], [21, 24], [10, 24], [7, 27], [22, 18], [7, 16]], '#fff4b0'),
      dots([[15, 19], [16, 19], [17, 19]], '#b88a18'),
    ];
  },
  gem: () => [
    sheet([[5, 13], [27, 13], [16, 29]], '#2a8ad0', { tilt: [0.3, 0.5] }),
    sheet([[5, 13], [16, 13], [16, 29]], '#3cb8f0', { tilt: [-0.5, 0.2] }),
    sheet([[9, 8], [23, 8], [27, 13], [5, 13]], '#5ccaf6', { tilt: [-0.2, -0.7] }),
    sheet([[12, 8], [20, 8], [19, 13], [13, 13]], '#8ae0ff', { tilt: [-0.3, -0.6] }),
    line(5, 13, 27, 13, '#bff0ff'),
    dots([[12, 10], [13, 9], [11, 11], [9, 16]], '#ffffff'),
  ],
  artifact: () => [
    sheet([[11, 27], [21, 27], [23.5, 31], [8.5, 31]], BRASS, { curve: 1 }),
    ball(11.5, 12, 6.5, 6.5, '#d42a3a'), ball(20.5, 12, 6.5, 6.5, '#c42434'),
    sheet([[5.2, 14], [26.8, 14], [16, 28]], '#d42a3a', { curve: 1 }),
    line(16, 9, 16, 27, '#8a1622'),
    line(9, 15, 16, 26, '#f06070'), line(23, 15, 16, 26, '#a01c2a'),
    dots([[9, 9], [10, 8], [8, 10], [11, 9]], '#ffd0d4'),
    dots([[14, 16], [15, 15], [16, 17], [17, 16], [15, 18]], '#ff9aa4'),
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

  // ---- body armour ----
  leather: () => [
    // the lace criss-crossing between its eyelets
    ...[[15.5, 12.5, 17.5, 13.5], [17.5, 13.5, 15.5, 14.5], [15.5, 14.5, 17.5, 15.5], [17.5, 15.5, 15.5, 16.5],
      [15.5, 16.5, 17.5, 17.5], [17.5, 17.5, 15.5, 18.5], [15.5, 18.5, 17.5, 19.5]].map(([a, b, c, d]) => hair(a, b, c, d, '#b89868')),
    // stitching round the hem and the shoulders, holes in the belt, a tongue in the buckle
    specks([10, 11.5, 13, 14.5, 18, 19.5, 21, 22.5].map(x => [x, 26.2]), '#c89a68'),
    specks([[5.5, 9.5], [6.5, 11], [8, 11.5], [9.5, 11], [22.5, 11], [24, 11.5], [25.5, 11], [26.5, 9.5]], '#c89a68'),
    specks([[19.5, 23], [21, 23], [22.5, 23]], '#1e120a'),
    hair(16, 23, 18.5, 23, '#fff0a0'),
    // scuffs and creases in the hide
    hair(10, 15, 11.5, 17.5, '#a87448'), hair(21, 16.5, 22, 18.5, '#6a4426'), hair(11, 19.5, 12.5, 21, '#6a4426'),
  ],
  studded: () => [
    // every stud domed: a glint above, a shadow below
    ...[11, 14, 17, 20, 23].flatMap((y, r) => [10, 13, 16, 19, 22].map(x => specks([[x + (r % 2), y]], '#ffffff'))),
    specks([11, 14, 17, 20, 23].flatMap((y, r) => [10, 13, 16, 19, 22].map(x => [x + (r % 2) + 0.5, y + 0.5])), '#8a909a'),
    // stitching down the sides and round the hem, a strap at each shoulder
    specks([10, 12, 14, 18, 20, 22].map(x => [x + 0.5, 26.3]), '#a07a52'),
    specks([[9, 16], [9, 19], [9, 22], [23, 16], [23, 19], [23, 22]], '#a07a52'),
    hair(6, 10.5, 9.5, 11.5, '#3a2616'), hair(22.5, 11.5, 26, 10.5, '#3a2616'),
  ],
  scale: () => [
    // a few scales catching the light, one lost, and the leather edging
    specks([[12, 11.5], [14, 14.5], [11, 17.5], [13, 20.5], [19, 11.5], [21, 14.5]], '#fff4c8'),
    specks([[18, 19], [18.5, 19], [18, 19.5], [18.5, 19.5]], '#3a2c18'),
    hair(9, 26.5, 23, 26.5, '#5e4c28'),
    specks([10, 12, 14, 16, 18, 20, 22].map(x => [x, 26.5]), '#c8a868'),
    // rims and rivets on the shoulder guards
    hair(5.5, 10.5, 10, 11.3, '#6e5a30'), hair(22, 11.3, 26.5, 10.5, '#6e5a30'),
    specks([[7, 8], [25, 8]], '#fff4c8'),
  ],
  chain: () => [
    // light through the rings on the lit shoulder and chest
    specks(inside(TORSO, (x, y) => y > 8 && y < 20 && x < 19 && (x + y) % 2 === 1 && y % 2 === 1 && !(y < 11 && x > 12)), '#d4d9e1'),
    // a leather collar and a row of bright links at the hem
    hair(12.5, 7.5, 14.5, 11, '#6a4a30'), hair(19, 7.5, 17, 11, '#6a4a30'),
    specks([9.5, 11.5, 13.5, 15.5, 17.5, 19.5, 21.5].map(x => [x, 26]), '#dfe5ee'),
    // a split link and the sleeves' ends
    specks([[21, 20], [21.5, 20.5]], '#2a2e36'),
    specks([[4.5, 18], [5.5, 18.5], [25.5, 18.5], [26.5, 18]], '#c8ced8'),
  ],
  splint: () => [
    // each strip lit down one side, its rivets glinting
    ...[10, 13, 16, 19, 22].map(x => hair(x, 13.5, x, 24, '#eef3fa')),
    specks([10, 13, 16, 19, 22].flatMap(x => [[x, 12], [x, 25]]), '#fff4b0'),
    specks([10, 13, 16, 19, 22].map(x => [x + 1.5, 18.5]), '#8a7058'),
    // rims and rivets on the pauldrons, a buckle on the collar strap
    hair(4.5, 11, 9.5, 12, '#6a707c'), hair(22, 12, 27, 11, '#6a707c'),
    ...rivet(6, 9), ...rivet(25, 9),
    specks([[15.5, 10.5], [16, 10.5], [16.5, 10.5], [15.5, 11.5], [16.5, 11.5]], BRASS),
  ],
  plate: () => [
    // the ridge's shadow side, the lames' rivets, a dent in the breast
    hair(17, 12.5, 17, 21, '#7a8494'),
    ...rivet(9.5, 22.3), ...rivet(22, 22.3), ...rivet(9.5, 24.8), ...rivet(22, 24.8),
    specks([[12.5, 16.5], [13, 17]], '#6a7484'), specks([[12, 16], [12.5, 16]], '#f4f8ff'),
    // rivets on the pauldrons, gilt pins at the ends of the collar trim
    specks([[13, 11], [19.5, 11]], '#fff0a0'),
    ...rivet(6, 8.5), ...rivet(25.5, 8.5),
    hair(4.5, 9, 7, 6.5, '#f4f8ff'),
  ],

  // ---- shields ----
  buckler: () => [
    // grain curving across the boards, the lit rim, a glint on the boss
    hair(9.5, 12.5, 12.5, 11, '#5e3c1e'), hair(9, 16, 12.5, 15.5, '#5e3c1e'), hair(19.5, 18.5, 23, 18, '#5e3c1e'),
    hair(10, 21, 13, 22.5, '#5e3c1e'), hair(18.5, 22.5, 21.5, 21, '#5e3c1e'), hair(19, 12, 22, 13.5, '#a87448'),
    specks([[14.5, 15], [15, 14.5], [15, 15]], '#ffffff'),
    hair(8, 12, 10.5, 9.5, '#b8bec8'),
    // a cut across the face
    hair(19.5, 21.5, 22, 20, '#3a2414'), hair(19.5, 22, 22, 20.5, '#b88a58'),
  ],
  shield: () => [
    // the bend's edges, and a silver star in each empty quarter
    hair(10.5, 6.5, 24.5, 20.5, '#fff0a0'), hair(7.5, 10, 21.5, 23, '#a07818'),
    specks([[20, 9.5], [20, 10], [20, 11], [20, 11.5], [19, 10.5], [19.5, 10.5], [20.5, 10.5], [21, 10.5], [20, 10.5]], '#e8ecf4'),
    specks([[12, 16.5], [12, 17], [12, 18], [12, 18.5], [11, 17.5], [11.5, 17.5], [12.5, 17.5], [13, 17.5], [12, 17.5]], '#e8ecf4'),
    // the lit rim and a scratch through the paint
    hair(5.5, 5.5, 5.5, 13.5, '#c8ccd6'), hair(8, 4.5, 15, 4.5, '#c8ccd6'),
    hair(21.5, 15, 23.5, 13.5, '#8aa0c8'),
  ],
  towershield: () => [
    // grain and knots in the planks, nails down the painted stripe
    hair(8, 4, 8.5, 7, '#5e3c1e'), hair(8, 10, 7.5, 20, '#5e3c1e'), hair(12, 10, 12, 16, '#5e3c1e'),
    hair(20.5, 9.5, 20, 14, '#5e3c1e'), hair(24, 10, 24.5, 20, '#5e3c1e'), hair(11.5, 23.5, 12, 27, '#5e3c1e'), hair(20, 24, 20, 27.5, '#5e3c1e'),
    specks([[12, 18.5], [12.5, 18], [12.5, 19]], '#4a2e14'), specks([[20.5, 5], [21, 5.5]], '#4a2e14'),
    specks([[15.5, 5], [15.5, 11], [15.5, 19], [15.5, 26.5]], '#e0a0a0'),
    // more rivets along the bands, a glint on the boss
    ...rivet(11.5, 7.7, '#3a3e46'), ...rivet(20, 7.7, '#3a3e46'), ...rivet(11.5, 21.7, '#3a3e46'), ...rivet(20, 21.7, '#3a3e46'),
    specks([[14.5, 13.5], [15, 13], [15, 13.5]], '#ffffff'),
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
  dagger: { at: at(7.8) }, shortsword: { at: at(7.3) }, longsword: { at: at(7) },
  // in its HELD_ART picture: the right fist under the guard, the left at the pommel
  greatsword: { at: at(9.9), second: at(3.4), grid: 100 }, throwknife: { at: at(12.5) },
  club: { at: at(5.6) }, staff: { at: at(13.5), second: at(3.5) }, spear: { at: at(9.5) },
  mace: { at: at(5.2) }, hammer: { at: at(5.2) }, flail: { at: at(4.6) }, battleaxe: { at: at(4.4) },
  sling: { at: [8, 6.5], fixed: true },
};
const ICON_AXIS = -Math.PI / 4;   // the icon's blades point up and to the right

export { ITEM_ART, HELD_ART, GRIPS, ICON_AXIS };
