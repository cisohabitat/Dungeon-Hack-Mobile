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

import { ITEM_ART, GRIPS, ICON_AXIS } from './itemart.js';
import { ball, limb, sheet, hair, specks } from './creatures.js';

/** glove, cuff and sleeve, by class */
const HAND_COLORS = {
  fighter: ['#8a929e', '#5a606a', '#6a4a30'],
  cleric: ['#8a6440', '#c9a24a', '#e8e0d0'],
  mage: ['#d8b090', '#6a4aa0', '#4a3a78'],
  thief: ['#3a3438', '#5a4a3a', '#3e4a3a'],
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
  windup:  { a: deg(-42), arm: deg(88) },
  cut:     { a: deg(-152), arm: deg(20) },
  through: { a: deg(-202), arm: deg(2) },
  fist:    { a: deg(-96), arm: deg(58) },
  punch:   { a: deg(-92), arm: deg(46) },
  left:    { a: deg(-78), arm: deg(130), left: true },
  cast:    { a: deg(-90), arm: deg(108), open: true, left: true },
};
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
 * @param {{open?: boolean, left?: boolean, sleeve?: boolean}} [o]
 */
function hand(x, y, a, arm, cls, o = {}) {
  const [glove, cuff, sleeve] = HAND_COLORS[cls] || HAND_COLORS.fighter;
  // u along the grip, v across it toward the back of the hand (the arm's
  // side: right of the grip in the right hand), w down the forearm
  const s = o.left ? -1 : 1;
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy * s, vy = ux * s, wx = Math.cos(arm), wy = Math.sin(arm);
  const P = (u, v = 0, w = 0) => [x + ux * u + vx * v + wx * w, y + uy * u + vy * v + wy * w];
  const glint = glove === '#3a3438' ? '#7a727a' : '#ffffff';
  const behind = o.sleeve === false ? [] : [limb(...P(0, 1.2, 6), ...P(0, 1.2, 30), 3.4, 5, sleeve), limb(...P(0, 1, 2.4), ...P(0, 1, 6.4), 3, 3.5, cuff)];
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
  const fingers = [2.3, 0.9, -0.5, -1.9];
  return {
    behind,
    front: [
      limb(...P(-2.8, 2.2), ...P(2.4, 2.4), 2.3, 2.5, glove),                  // the back of the hand
      ...fingers.map(k => limb(...P(k, 2.6), ...P(k, -2.4), 1.05, 0.9, glove)),   // fingers round the grip
      ...fingers.map(k => ball(...P(k, 2.5), 1.2, 1.2, glove)),                  // knuckles
      limb(...P(1.3, 1.4), ...P(4.7, -0.1), 1.15, 0.9, glove),                   // the thumb along the grip
      ...[1.6, 0.2, -1.2].map(k => hair(...P(k, 1.6), ...P(k, -2.2), DARK)),      // creases between the fingers
      hair(...P(0.6, 0.6), ...P(2.6, -0.4), DARK),                               // and under the thumb
      specks(fingers.map(k => P(k + 0.3, 2.9)), glint),
    ],
  };
}

/** A bow from behind: the stave upright, the left hand round its grip. The string and arrow are drawn live, between its tips and the drawing hand. */
function bowParts(cls) {
  const a = deg(-94);
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const P = (u, v = 0) => [C + ux * u + vx * v, C + uy * u + vy * v];
  const stave = [];
  for (let i = -4; i < 4; i++) {
    const r0 = 1.35 - Math.abs(i + 0.5) * 0.17, r1 = 1.35 - Math.abs(i + 1.5) * 0.17;
    // the tips flare a little toward the far side, where a recurve bends
    const b0 = Math.abs(i + 0.5) > 3 ? -0.8 : 0, b1 = Math.abs(i + 1.5) > 3 ? -0.8 : 0;
    stave.push(limb(...P(i * 4.8, b0), ...P((i + 1) * 4.8, b1), Math.max(0.6, r0), Math.max(0.6, r1), '#9a6a3a'));
  }
  const h = hand(C, C, a, deg(150), cls, { left: true });
  return {
    grid: GRID, anchor: [C, C], marks: { top: P(-19.2, -0.8), bot: P(19.2, -0.8) },
    parts: [
      ...h.behind,
      ...stave,
      ...[-19.2, 19.2].map(u => ball(...P(u, -0.8), 0.9, 0.9, '#6a4424')),
      limb(...P(-3.4), ...P(3.4), 1.6, 1.6, '#5a3a22'),
      ...[-2.4, -0.8, 0.8, 2.4].map(u => hair(...P(u, -1.6), ...P(u, 1.6), '#3a2414')),
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
  if (base === 'shortbow') return bowParts(cls);
  const behind = [], front = [];
  let weapon = [];
  if (base) {
    const g = GRIPS[base], art = ITEM_ART[base];
    if (!g || !art) return null;
    const d = g.fixed ? 0 : P.a - ICON_AXIS, cos = Math.cos(d), sin = Math.sin(d);
    const [gx, gy] = g.at;
    const f = (x, y) => [C + (x - gx) * cos - (y - gy) * sin, C + (x - gx) * sin + (y - gy) * cos];
    weapon = art().map(p => moved(p, f));
    if (two && g.second) {
      const [sx, sy] = f(...g.second);
      const h2 = hand(sx, sy, P.a, P.arm + deg(62), cls, { left: true });
      behind.push(...h2.behind); front.push(...h2.front);
    }
  }
  const a = base && GRIPS[base].fixed ? -Math.PI / 2 : P.a;
  const h = hand(C, C, a, P.arm, cls, { open: !!P.open, left: !!P.left });
  return { grid: GRID, anchor: [C, C], parts: [...behind, ...h.behind, ...weapon, ...front, ...h.front] };
}

/** The back of a shield, by its sprite. */
function carriedParts(id, cls) {
  const base = id.replace(/^relic_/, '');
  if (!['buckler', 'shield', 'towershield'].includes(base)) return null;
  return shieldParts(base, cls);
}

export { heldParts, carriedParts, POSES, HAND_COLORS };
