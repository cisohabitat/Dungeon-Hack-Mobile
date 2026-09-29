// The hero's hands, and what they hold, as the view shows them.
//
// An item's own picture is drawn for a pack slot: small, lying on the
// diagonal. Turned and blown up at the bottom of the view it came out
// jagged and flat, with a fist floating over the grip. Here the same parts
// are moved into each pose of a swing before they are painted, so every
// frame is drawn upright, lit from the same side as the world, and gripped
// by a gloved hand on a forearm that reaches in from the edge of the view.
// A shield and a bow are painted from behind, as the hero sees them, since
// their pack pictures show the side the enemy sees.

import { ITEM_ART, HELD_ART, GRIPS, ICON_AXIS } from './itemart.js';
import { ball, limb, sheet, hair, specks } from './creatures.js';

/** glove, cuff and sleeve, by class */
const HAND_COLORS = {
  fighter: ['#8a929e', '#5a606a', '#6a4a30'],
  cleric: ['#8a6440', '#c9a24a', '#e8e0d0'],
  mage: ['#d8b090', '#6a4aa0', '#4a3a78'],
  thief: ['#3a3438', '#5a4a3a', '#3e4a3a'],
  druid: ['#8a6a44', '#4e6a34', '#5a4a2e'],
  // a druid in Wild Shape: fur to the elbow, and claws (see hand())
  bear: ['#5a3a22', '#4a2e1a', '#3e2614'],
};
const DARK = '#1a1418', LEATHER = '#3a2618', WOOD = '#7a5230', RIM = '#7a808c';

// The poses a hand passes through. a: which way the weapon points, arm:
// which way the forearm runs from the wrist to the elbow, both in screen
// radians (0 is right, -PI/2 straight up). The right hand rests upright and
// slashes down and across; the left rests leaning the other way; a casting
// hand is open, fingers spread.
const deg = d => d * Math.PI / 180;
const POSES = {
  rest:    { a: deg(-100), arm: deg(52) },
  windup:  { a: deg(-58), arm: deg(86) },
  cut:     { a: deg(-152), arm: deg(20) },
  through: { a: deg(-200), arm: deg(26) },
  fist:    { a: deg(-96), arm: deg(58), bare: true },
  punch:   { a: deg(-92), arm: deg(46), bare: true },
  left:    { a: deg(-78), arm: deg(130), left: true },
  // the off hand driving its blade in toward the middle, a stab into the screen
  thrust:  { a: deg(-42), arm: deg(150), left: true },
  cast:    { a: deg(-90), arm: deg(108), open: true, left: true },
  // a sling hanging as at rest, its stone just let go
  loosed:  { a: deg(-100), arm: deg(52), empty: true },
};
// the stone's own colours in the sling's picture, left out once it is thrown
const SLING_STONE = ['#8e8a84', '#d8d4cc', '#6a6660', '#ffffff'];
// room around the hand; big enough for a greataxe pointing any way
const GRID = 72, C = GRID / 2;

function moved(p, f) {
  const q = { ...p };
  if (p.k === 'ball') [q.x, q.y] = f(p.x, p.y);
  else if (p.k === 'sheet' || p.k === 'dots' || p.k === 'specks') q.pts = p.pts.map(([x, y]) => f(x, y));
  else { [q.x1, q.y1] = f(p.x1, p.y1); [q.x2, q.y2] = f(p.x2, p.y2); }
  return q;
}

/**
 * A gloved hand at (x, y): closed round a grip that runs along a, or open.
 * The forearm runs along arm. Seen from behind, the fingers wrap the grip
 * from the back of the hand across to their tips on the far side, the
 * thumb lying along the grip over the first finger.
 * @param {{open?: boolean, bare?: boolean, left?: boolean, sleeve?: boolean}} [o]
 */
function hand(x, y, a, arm, cls, o = {}) {
  const [glove, cuff, sleeve] = HAND_COLORS[cls] || HAND_COLORS.fighter;
  // u along the grip, v across it toward the back of the hand (the arm's
  // side: right of the grip in the right hand), w down the forearm
  const s = o.left ? -1 : 1;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy * s, vy = ux * s, wx = Math.cos(arm), wy = Math.sin(arm);
  const P = (u, v = 0, w = 0) => [x + ux * u + vx * v + wx * w, y + uy * u + vy * v + wy * w];
  const glint = glove === '#3a3438' ? '#7a727a' : '#ffffff';
  const behind = o.sleeve === false ? [] : [limb(...P(0, 0.6, 6), ...P(0, 0.6, 30), 3.3, 5, sleeve), limb(...P(0, 0.5, 2.6), ...P(0, 0.5, 6.4), 3, 3.4, cuff)];
  if (o.open) {
    // the palm toward the enemy, fingers spread away from the wrist, the
    // thumb out to the side; q runs across the palm
    const Q = (q, w) => [x - wy * q * s + wx * w, y + wx * q * s + wy * w];
    return {
      behind,
      front: [
        ball(...Q(0, 0.2), 3.1, 3.1, glove),
        ...[-2.2, -0.75, 0.75, 2.1].map((k, i) => limb(...Q(k * 0.85, -2.2), ...Q(k * 1.35, -6.6 + Math.abs(k) * 0.55 - (i === 1 ? 0.3 : 0)), 0.9, 0.75, glove)),
        limb(...Q(2.6, 0.4), ...Q(4.6, -1.8), 1, 0.8, glove),
        hair(...Q(-1.6, -0.6), ...Q(1.4, -0.8), DARK),
      ],
    };
  }
  if (o.bare) {
    // an empty fist, knuckles toward the enemy: the back of the hand, the
    // knuckle ridge along its far edge, the fingers curled away out of sight
    // and the thumb folded over them on the near side
    const row = [-2.2, -0.75, 0.75, 2.2];
    return {
      behind,
      front: [
        ball(...P(0, 0.2), 3.3, 3.3, glove),
        limb(...P(1.6, -2.6), ...P(1.6, 2.6), 1.5, 1.5, glove),
        ...row.map(k => ball(...P(2.6, k), 1.15, 1.15, glove)),                   // knuckles
        ...[-1.45, 0, 1.45].map(k => hair(...P(2.9, k), ...P(1.2, k), DARK)),     // creases between them
        limb(...P(0.2, -3.2), ...P(-1.9, -1.2), 1.05, 0.95, glove),               // the thumb, tucked
        hair(...P(-0.4, -2.2), ...P(-1.8, -0.4), DARK),
        specks(row.map(k => P(2.9, k - 0.3)), glint),
        // a bear's paw: pale hooked claws out past the knuckles, and a ruff of fur at the wrist
        ...(cls === 'bear' ? [
          ...row.map(k => limb(...P(3.1, k), ...P(4.9, k * 1.1 - 0.5), 0.55, 0.2, '#d8ccb0')),
          ...[-2.6, -1, 0.6, 2.2].map(k => hair(...P(-1.6, k), ...P(-3.4, k * 1.2), '#7a5434')),
        ] : []),
      ],
    };
  }
  // closed round a grip: the fingers wrap it from the back of the hand and
  // curl out of sight behind it; the thumb lies over the first finger
  const fingers = [2.2, 0.85, -0.5, -1.85];
  return {
    behind,
    front: [
      limb(...P(-2.4, 1.8), ...P(2, 1.9), 2.2, 2.3, glove),                       // the back of the hand
      ...fingers.map(k => limb(...P(k, 2.4), ...P(k, -1.5), 1.05, 0.85, glove)),  // fingers round the grip
      ...fingers.map(k => ball(...P(k, 2.3), 1.15, 1.15, glove)),                 // knuckles
      limb(...P(0.9, 1), ...P(2.9, -0.3), 1.1, 0.95, glove),                      // the thumb over the first finger
      ...[1.5, 0.2, -1.2].map(k => hair(...P(k, 1.4), ...P(k, -1.6), DARK)),      // creases between the fingers
      hair(...P(0.4, 0.2), ...P(2.2, -0.9), DARK),                               // and under the thumb
      specks(fingers.map(k => P(k + 0.3, 2.7)), glint),
    ],
  };
}

/**
 * A bow from behind: the stave upright, the left hand round its grip. The
 * string and arrow are drawn live, between its tips and the drawing hand.
 * The long bow is a head taller, a darker yew with no recurve at the tips,
 * a longer leather wrap and pale horn nocks.
 */
const BOWS = {
  shortbow: { seg: 4.8, r: 1.35, taper: 0.17, flare: -0.8, wood: '#9a6a3a', nock: '#6a4424', wrap: 3.4, nockLen: 0 },
  longbow: { seg: 6.3, r: 1.3, taper: 0.13, flare: 0, wood: '#5a3218', nock: '#e2d4b0', wrap: 4.4, nockLen: 2.6, sap: '#b88a54' },
};
function bowParts(cls, base) {
  const B = BOWS[base];
  const a = deg(-94);
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const P = (u, v = 0) => [C + ux * u + vx * v, C + uy * u + vy * v];
  const stave = [];
  for (let i = -4; i < 4; i++) {
    const r0 = B.r - Math.abs(i + 0.5) * B.taper, r1 = B.r - Math.abs(i + 1.5) * B.taper;
    // the tips flare a little toward the far side, where a recurve bends
    const b0 = Math.abs(i + 0.5) > 3 ? B.flare : 0, b1 = Math.abs(i + 1.5) > 3 ? B.flare : 0;
    stave.push(limb(...P(i * B.seg, b0), ...P((i + 1) * B.seg, b1), Math.max(0.6, r0), Math.max(0.6, r1), B.wood));
  }
  const tip = B.seg * 4, end = B.flare;
  const nocks = B.nockLen
    ? [-1, 1].flatMap(s => [
      limb(...P(s * (tip - B.nockLen), end), ...P(s * tip, end), 0.95, 0.7, B.nock),
      hair(...P(s * (tip - B.nockLen + 0.4), end - 0.5), ...P(s * (tip - 0.4), end - 0.5), '#fff8e4'),
    ])
    : [-1, 1].map(s => ball(...P(s * tip, end), 0.9, 0.9, B.nock));
  // the long bow's pale sapwood, down the side of the stave toward the light
  const sap = B.sap ? [[-22, -7], [7, 22]].map(([u0, u1]) => hair(...P(u0, -0.7), ...P(u1, -0.7), B.sap)) : [];
  const bands = B.wrap > 4 ? [-3.3, -1.65, 0, 1.65, 3.3] : [-2.4, -0.8, 0.8, 2.4];
  const h = hand(C, C, a, deg(150), cls, { left: true });
  return {
    grid: GRID, anchor: [C, C], marks: { top: P(-tip, end), bot: P(tip, end) },
    parts: [
      ...h.behind,
      ...stave,
      ...sap,
      ...nocks,
      limb(...P(-B.wrap), ...P(B.wrap), 1.6, 1.6, '#5a3a22'),
      ...bands.map(u => hair(...P(u, -1.6), ...P(u, 1.6), '#3a2414')),
      ...h.front,
    ],
  };
}

/**
 * The back of a shield, the side the hero sees: bare wood in a steel rim,
 * the straps, and the left forearm through them with the hand on the grip.
 * @param {string} base  buckler, shield or towershield
 */
function shieldParts(base, cls) {
  const arm = deg(146), wx = Math.cos(arm), wy = Math.sin(arm);
  const rim = base === 'buckler' ? [ball(C, C, 10.6, 10.6, RIM)]
    : base === 'towershield' ? [sheet([[C - 11, C - 9], [C - 8, C - 13.5], [C + 8, C - 13.5], [C + 11, C - 9], [C + 11, C + 17], [C - 11, C + 17]], RIM)]
    : [sheet([[C - 11.5, C - 12], [C + 11.5, C - 12], [C + 11.5, C - 3], [C + 8, C + 6], [C, C + 12.5], [C - 8, C + 6], [C - 11.5, C - 3]], RIM)];
  const face = base === 'buckler' ? [ball(C, C, 9.3, 9.3, WOOD)]
    : base === 'towershield' ? [sheet([[C - 9.6, C - 8.5], [C - 7.4, C - 12], [C + 7.4, C - 12], [C + 9.6, C - 8.5], [C + 9.6, C + 15.6], [C - 9.6, C + 15.6]], WOOD)]
    : [sheet([[C - 10, C - 10.5], [C + 10, C - 10.5], [C + 10, C - 3.2], [C + 7.2, C + 5.2], [C, C + 10.8], [C - 7.2, C + 5.2], [C - 10, C - 3.2]], WOOD)];
  // planks, and rivets where the rim is nailed on
  const grain = [-6.4, -3.2, 0, 3.2, 6.4].map(dx => hair(C + dx, C - 9, C + dx, C + 10, '#4e3018'));
  const rivets = specks(base === 'buckler'
    ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => [C + Math.cos(i / 8 * Math.PI * 2) * 9.9, C + Math.sin(i / 8 * Math.PI * 2) * 9.9])
    : [[C - 10.8, C - 11], [C + 10.8, C - 11], [C - 10.8, C], [C + 10.8, C], [C - 5, C - 11.4], [C + 5, C - 11.4]], '#c8ccd6');
  const h = hand(C, C, deg(-90), arm, cls, { left: true });
  const strap = (w, r) => limb(C + wx * w - wy * r, C + wy * w + wx * r, C + wx * w + wy * r, C + wy * w - wx * r, 1, 1, LEATHER);
  return {
    grid: GRID, anchor: [C, C],
    parts: [
      ...rim, ...face, ...grain, rivets,
      ...(base === 'buckler' ? [ball(C, C - 0.5, 3.2, 3.2, '#5a5e68')] : []),   // the boss, from inside
      limb(C, C - 4.6, C, C + 4.6, 1.1, 1.1, LEATHER),                          // the grip the hand closes on
      ...h.behind,
      strap(9.5, 4.4),                                                          // the strap the forearm runs through
      ...h.front,
    ],
  };
}

/**
 * Parts for one pose: the weapon's picture moved so the grip sits at the
 * centre of the grid and it points along the pose, with the hand on it.
 * Returns null for a sprite that has no picture to hold.
 * @param {string|null} id  the weapon's sprite, or null for a bare fist
 * @param {string} pose  a key of POSES
 * @param {string} cls
 * @param {boolean} two  a second hand lower on the grip
 */
function heldParts(id, pose, cls, two = false) {
  const P = POSES[pose];
  const base = id && id.replace(/^relic_/, '');
  if (base && BOWS[base]) return bowParts(cls, base);
  const behind = [], front = [];
  let weapon = [];
  // a weapon too long for the usual room gets more of it
  const grid = (base && GRIPS[base] && GRIPS[base].grid) || GRID, c = grid / 2;
  if (base) {
    const g = GRIPS[base], art = HELD_ART[base] || ITEM_ART[base];
    if (!g || !art) return null;
    const d = g.fixed ? 0 : P.a - ICON_AXIS, cos = Math.cos(d), sin = Math.sin(d);
    const [gx, gy] = g.at;
    const f = (x, y) => [c + (x - gx) * cos - (y - gy) * sin, c + (x - gx) * sin + (y - gy) * cos];
    weapon = art().filter(p => !(P.empty && base === 'sling' && SLING_STONE.includes(p.c))).map(p => moved(p, f));
    if (two && g.second) {
      const [sx, sy] = f(...g.second);
      const h2 = hand(sx, sy, P.a, P.arm + deg(62), cls, { left: true });
      behind.push(...h2.behind); front.push(...h2.front);
    }
  }
  const a = base && GRIPS[base].fixed ? -Math.PI / 2 : P.a;
  const h = hand(c, c, a, P.arm, cls, { open: !!P.open, bare: !!P.bare, left: !!P.left });
  return { grid, anchor: [c, c], parts: [...behind, ...h.behind, ...weapon, ...front, ...h.front] };
}

/** The back of a shield, by its sprite. */
function carriedParts(id, cls) {
  const base = id.replace(/^relic_/, '');
  // the quill shield is held up as its own picture is drawn, round and bristling
  if (FOCI.includes(base) || base === 'quillshield') return focusParts(base, cls);
  if (!['buckler', 'shield', 'towershield'].includes(base)) return null;
  return shieldParts(base, cls);
}

/** A caster's focus, held up in the left hand: the item's own picture, resting on the palm. */
const FOCI = ['spellbook', 'crystal_orb', 'orb_storms', 'holy_symbol', 'silver_symbol', 'reliquary'];
function focusParts(base, cls) {
  const art = ITEM_ART[base];
  if (!art) return null;
  const size = 0.62, lift = 5;
  const item = art().map(p => moved(p, (x, y) => [C + (x - 16) * size, C + (y - 16) * size - lift]));
  const h = hand(C, C + 4, deg(-90), deg(128), cls, { left: true, open: true });
  return { grid: GRID, anchor: [C, C], parts: [...h.behind, ...item, ...h.front] };
}

export { heldParts, carriedParts, POSES, HAND_COLORS };
