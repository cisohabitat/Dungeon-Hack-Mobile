// The hero's hands, and what they hold, as the view shows them.
//
// An item's own picture is drawn for a pack slot: small, lying on the
// diagonal. Turned and blown up at the bottom of the view it came out
// jagged and flat, with a fist floating over the grip. Here the same parts
// are moved into each pose of a swing before they are painted, so every
// frame is drawn upright, lit from the same side as the world, and gripped
// by a gloved hand on a forearm that reaches in from the edge of the view.

import { ITEM_ART, GRIPS, ICON_AXIS } from './itemart.js';
import { ball, limb, hair, specks } from './creatures.js';

/** glove, cuff and sleeve, by class */
const HAND_COLORS = {
  fighter: ['#8a929e', '#5a606a', '#6a4a30'],
  cleric: ['#8a6440', '#c9a24a', '#e8e0d0'],
  mage: ['#d8b090', '#6a4aa0', '#4a3a78'],
  thief: ['#3a3438', '#5a4a3a', '#3e4a3a'],
};

// The poses a hand passes through. a: which way the weapon points, arm:
// which way the forearm runs from the wrist to the elbow, both in screen
// radians (0 is right, -PI/2 straight up). The right hand rests upright and
// slashes down and across; the left rests leaning the other way; a casting
// hand is open, fingers spread.
const deg = d => d * Math.PI / 180;
const POSES = {
  rest:    { a: deg(-106), arm: deg(38) },
  windup:  { a: deg(-52), arm: deg(84) },
  cut:     { a: deg(-158), arm: deg(14) },
  through: { a: deg(-204), arm: deg(-2) },
  fist:    { a: deg(-170), arm: deg(64) },
  punch:   { a: deg(-178), arm: deg(52) },
  left:    { a: deg(-74), arm: deg(142) },
  cast:    { a: deg(-90), arm: deg(108), open: true },
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

/** A gloved hand closed round a grip at (x, y), the grip running along a, the forearm along arm. */
function hand(x, y, a, arm, cls, open = false, withSleeve = true) {
  const [glove, cuff, sleeve] = HAND_COLORS[cls] || HAND_COLORS.fighter;
  const ux = Math.cos(a), uy = Math.sin(a), wx = Math.cos(arm), wy = Math.sin(arm);
  const P = (u, w) => [x + ux * u + wx * w, y + uy * u + wy * w];
  const dark = '#1a1418';
  const out = [];
  if (withSleeve) out.push(limb(...P(0, 5.5), ...P(0, 26), 3.4, 4.6, sleeve), limb(...P(0, 2.6), ...P(0, 6), 3.1, 3.6, cuff));
  if (open) {
    // the palm toward the enemy, fingers spread away from the wrist, the
    // thumb out to the side; v runs across the palm
    const Q = (v, w) => [x - wy * v + wx * w, y + wx * v + wy * w];
    return {
      behind: out,
      front: [
        ball(...Q(0, 0.2), 3.1, 3.1, glove),
        ...[-2.2, -0.75, 0.75, 2.1].map((k, i) => limb(...Q(k * 0.85, -2.2), ...Q(k * 1.35, -6.6 + Math.abs(k) * 0.55 - (i === 1 ? 0.3 : 0)), 0.9, 0.75, glove)),
        limb(...Q(2.6, 0.4), ...Q(4.6, -1.8), 1, 0.8, glove),
        hair(...Q(-1.6, -0.6), ...Q(1.4, -0.8), dark),
      ],
    };
  }
  return {
    behind: out,
    front: [
      ball(...P(0, 1.3), 3.1, 3.1, glove),
      ...[-2.1, -0.7, 0.7, 2.1].map(k => ball(...P(k, -1.5), 1.3, 1.3, glove)),
      limb(...P(1.5, 0.9), ...P(2.7, -1.1), 1.1, 0.95, glove),
      ...[-1.4, 0, 1.4].map(k => hair(...P(k, -0.6), ...P(k, -2.6), dark)),
      specks([-2.1, -0.7, 0.7, 2.1].map(k => P(k - 0.3, -2.2)), glove === '#3a3438' ? '#7a727a' : '#ffffff'),
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
  const behind = [], front = [];
  let weapon = [];
  if (base) {
    const g = GRIPS[base], art = ITEM_ART[base];
    if (!g || !art) return null;
    const d = g.fixed ? g.turn || 0 : P.a - ICON_AXIS, cos = Math.cos(d), sin = Math.sin(d);
    const [gx, gy] = g.at;
    const f = (x, y) => [C + (x - gx) * cos - (y - gy) * sin, C + (x - gx) * sin + (y - gy) * cos];
    weapon = art().map(p => moved(p, f));
    if (two && g.second) {
      const [sx, sy] = f(...g.second);
      const h2 = hand(sx, sy, g.fixed ? -Math.PI / 2 : P.a, P.arm + deg(62), cls);
      behind.push(...h2.behind); front.push(...h2.front);
    }
  }
  const a = base && GRIPS[base].fixed ? -Math.PI / 2 + (GRIPS[base].turn || 0) : P.a;
  const h = hand(C, C, a, P.arm, cls, !!P.open);
  return { grid: GRID, anchor: [C, C], parts: [...behind, ...h.behind, ...weapon, ...front, ...h.front] };
}

export { heldParts, POSES, HAND_COLORS };
