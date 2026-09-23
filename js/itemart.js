// Items drawn from lit parts, in the same hand as the creatures.
//
// Every piece of gear gets its own picture, so a chain shirt no longer looks
// like plate and a flail no longer looks like a mace. Weapons lie on the
// diagonal, grip at the lower left and point at the upper right, which is how
// they read best in a pack slot and uses the whole square. Potions keep one
// bottle shape per colour, so the colour is never the only clue.

import { ball, limb, sheet, line, dots } from './creatures.js';
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

/** A glass bottle: glass above the liquid line, the draught below, a cork. */
function bottle(bodyParts, liquidParts, neck, glints) {
  return [
    ...bodyParts,
    ...liquidParts,
    ...neck,
    dots(glints, '#f4fbff'),
  ];
}

const ITEM_ART = {
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

/** Every item picture, painted: sprite key -> parts. */
export { ITEM_ART };
