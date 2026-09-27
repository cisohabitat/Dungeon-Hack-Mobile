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
  // A hunched little thing: head too big for it, ears like knives, a grin
  // full of bad teeth and a rusty blade in one fist.
  goblin: () => {
    const skin = '#6aa84a', dark = '#3f6e2c', tunic = '#7a5230';
    return [
      ...both(limb(13.5, 23, 12.5, 29.5, 1.9, 1.5, dark)),
      ...both(ball(11.5, 30.3, 2.4, 1.2, '#4a3a2a')),
      ball(16, 20, 5.2, 5, skin),
      sheet([[10.5, 17], [21.5, 17], [22.5, 24], [20, 23], [18, 25.5], [16, 23.5], [13.5, 25.5], [11.5, 23], [9.5, 24]], tunic, { curve: 1 }),
      line(10.5, 17.5, 21.5, 17.5, '#5a3a20'),
      limb(10.5, 16.5, 7.5, 22, 1.7, 1.3, skin),
      ball(7.3, 22.8, 1.6, 1.5, skin),
      limb(21.5, 16.5, 24.5, 20.5, 1.7, 1.3, skin),
      line(25, 21, 28, 14, '#b8bcc4', { lit: 1 }),
      line(26, 21, 29, 14, '#8a8e96', { lit: 1 }),
      dots([[24, 21], [25, 22], [26, 22]], '#6a4a2a'),
      ball(24.8, 21.3, 1.7, 1.5, skin),
      sheet([[10.5, 9.5], [2.5, 5], [4, 7.5], [10.5, 13]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[21.5, 9.5], [29.5, 5], [28, 7.5], [21.5, 13]], skin, { tilt: [0.5, -0.2] }),
      sheet([[9.5, 10], [5, 7], [9.5, 12]], '#c07860'),
      sheet([[22.5, 10], [27, 7], [22.5, 12]], '#c07860'),
      ball(16, 10.5, 6.2, 5.4, skin),
      // eyes sunk in shadow under a brow that dips to a scowl over the nose
      ball(12.8, 9.4, 1.9, 1.2, '#4a7c34'), ball(19.2, 9.4, 1.9, 1.2, '#4a7c34'),
      limb(11.8, 7.6, 14.6, 8.4, 0.8, 0.7, skin), limb(20.2, 7.6, 17.4, 8.4, 0.8, 0.7, skin),
      dots([[12, 9], [13, 9], [19, 9], [20, 9]], '#ffe040'),
      dots([[13, 9], [19, 9]], '#1a1010'),
      // cheeks bunched up by the grin, and a long hooked nose hanging over it
      ball(12.2, 12.4, 1.7, 1.2, skin), ball(19.8, 12.4, 1.7, 1.2, skin),
      limb(16, 9, 16, 12, 0.6, 1, skin), ball(16, 12.5, 1.4, 1.1, skin),
      // a wide grin, lifted at the corners, with a fang at either side
      sheet([[12, 13.2], [16, 14.2], [20, 13.2], [18.7, 15.4], [16, 16], [13.3, 15.4]], '#2a1010'),
      ball(16, 15.4, 1.4, 0.6, '#6a2424'),
      dots([[14, 14], [18, 14]], '#f0e6c8'),
    ];
  },

  // Bone and gaps: the corridor shows between the ribs, which is most of what
  // makes a skeleton read as one at a distance.
  skeleton: () => {
    const bone = '#ddd5bd', worn = '#a89e84';
    return [
      limb(14, 22, 13, 26.5, 1.1, 0.9, worn), limb(13, 26.5, 13, 30, 0.9, 0.8, worn),
      limb(18, 22, 19, 26.5, 1.1, 0.9, worn), limb(19, 26.5, 19, 30, 0.9, 0.8, worn),
      ball(13, 26.5, 1.3, 1.2, bone), ball(19, 26.5, 1.3, 1.2, bone),
      ball(12, 30.4, 2, 1, bone), ball(20, 30.4, 2, 1, bone),
      ball(16, 21.3, 3.8, 1.9, bone),
      dots([[15, 21], [17, 21]], '#1a1418'),
      limb(16.5, 11, 16.5, 21, 0.6, 0.6, worn),
      // one-pixel ribs on pixel centres, a row apart, so the dark shows between
      limb(11.5, 12.5, 21.5, 12.5, 0.55, 0.55, bone),
      limb(12.5, 14.5, 20.5, 14.5, 0.55, 0.55, bone),
      limb(12.5, 16.5, 20.5, 16.5, 0.55, 0.55, bone),
      limb(13.5, 18.5, 19.5, 18.5, 0.55, 0.55, bone),
      ball(11, 12.6, 1.6, 1.5, bone), ball(21, 12.6, 1.6, 1.5, bone),
      limb(10.6, 13.5, 8.8, 18, 0.85, 0.75, bone), limb(8.8, 18, 9.8, 22.5, 0.75, 0.7, bone),
      ball(8.8, 18, 1, 1, bone), ball(10, 23.2, 1.2, 1.1, worn),
      limb(21.4, 13.5, 24, 16.8, 0.85, 0.75, bone), limb(24, 16.8, 25.2, 12.8, 0.75, 0.7, bone),
      ball(24, 16.8, 1, 1, bone),
      line(25.5, 13.5, 28.5, 1.5, '#c8ccd4', { lit: 1 }), line(26.5, 13.5, 29.5, 1.5, '#8e929a', { lit: 1 }),
      line(23.5, 12.5, 28, 14.5, '#9a7a3a', { lit: 1 }),
      ball(25.3, 12.8, 1.3, 1.2, bone),
      ball(16, 5.8, 4.6, 4.3, bone),
      ball(16, 10, 2.9, 1.5, worn),
      dots([[13, 5], [14, 5], [13, 6], [14, 6], [18, 5], [19, 5], [18, 6], [19, 6]], '#140e14'),
      dots([[14, 5], [18, 5]], '#e04030'),
      dots([[16, 7], [16, 8]], '#241c20'),
      dots([[14, 10], [15, 10], [17, 10], [18, 10]], '#f6f0de'),
      dots([[16, 10]], '#2a2226'),
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

  // Lopsided: head lolling, one arm reaching for you, clothes in rags and a
  // rib or two showing through.
  zombie: () => {
    const skin = '#8fa27a', rot = '#5f6e4e', shirt = '#4e5a78';
    return [
      limb(13.5, 22, 12, 30, 2, 1.7, '#3e3a44'), limb(18.5, 22, 20.5, 26, 2, 1.8, '#3e3a44'), limb(20.5, 26, 19.5, 30, 1.8, 1.6, '#3e3a44'),
      ball(11.5, 30.4, 2.3, 1.1, rot), ball(19.5, 30.4, 2.3, 1.1, rot),
      limb(10.5, 15.5, 8.5, 24, 1.8, 1.5, skin), ball(8.3, 24.8, 1.7, 1.6, rot),
      ball(16, 18.5, 6, 5.5, skin),
      sheet([[10, 14.5], [22, 14.5], [22.5, 24], [20, 22], [19, 25], [16.5, 22.5], [14, 25], [12.5, 22], [9.5, 23.5]], shirt, { curve: 1 }),
      // a tear in the shirt with two ribs showing (drawn as a grid of dots it
      // read as a letter E)
      sheet([[16, 17.5], [18, 16.5], [20, 17.5], [19.5, 20], [20.5, 21.5], [17.5, 21], [16.5, 19.5]], '#2a2430'),
      dots([[17, 18], [18, 18], [19, 17], [17, 20], [18, 19]], '#cfc6aa'),
      limb(21.5, 15, 27.5, 13.5, 1.8, 1.5, skin), ball(28.5, 13.3, 1.8, 1.7, skin),
      dots([[30, 12], [30, 13], [30, 14]], '#e8e0c8'),
      ball(14, 9.5, 5, 4.8, skin),
      // the jaw hangs slack and askew, dropped below the line of the skull
      ball(13.4, 13.9, 2.9, 1.3, skin),
      sheet([[11.6, 11.6], [15.2, 12], [14.8, 14], [12.8, 14.6], [11.4, 13.4]], '#2a1418'),
      dots([[14, 12], [12, 14]], '#cfc6aa'),
      // the cheek torn through, the back teeth showing in the hole
      sheet([[9.6, 10.8], [11.9, 11.6], [11.6, 13], [9.9, 12.8]], '#3a1c1c'),
      dots([[10, 12]], '#b8ae90'),
      // a brow gone slack over each eye
      limb(9.9, 7, 12.9, 7.2, 0.7, 0.6, skin), limb(15.2, 6.9, 17.8, 6.6, 0.7, 0.6, skin),
      // one socket empty: the hollow is shadowed on its upper side, lit below
      ball(11.5, 8.8, 1.6, 1.2, rot), ball(11.3, 8.5, 1.1, 0.8, '#1e161c'),
      // the other eye filmed over, milky and blind
      dots([[16, 8], [17, 8]], '#d4d8c4'), dots([[17, 8]], '#8a8e80'),
      // what is left of the nose
      ball(14.2, 10.4, 1, 0.9, rot),
      dots([[15, 5], [16, 6], [12, 5]], '#4a5a3a'),
    ];
  },

  // Broad as a door: iron on the shoulders, tusks up from the jaw, an axe that
  // could fell a tree.
  orc: () => {
    const skin = '#607f3a', iron = '#7a8290', leather = '#5a3a24';
    return [
      limb(27, 30, 27, 8, 0.9, 0.9, '#6a4a2a'),
      sheet([[27, 6], [31, 4], [31.5, 13], [27, 11]], '#9aa2ae', { tilt: [0.6, -0.1] }),
      line(31, 5, 31, 12, '#e0e6ee'),
      ...both(limb(12.5, 22, 11.5, 30, 2.4, 2, '#3a3040')),
      ...both(ball(11, 30.4, 2.8, 1.2, leather)),
      ball(16, 18, 7.5, 6.5, skin),
      sheet([[9.5, 13.5], [22.5, 13.5], [22, 23], [10, 23]], leather, { curve: 1 }),
      sheet([[11, 14], [21, 14], [20.5, 20], [11.5, 20]], iron, { curve: 1 }),
      dots([[12, 15], [20, 15], [12, 19], [20, 19], [16, 17]], '#c8ced8'),
      line(10, 22.5, 22, 22.5, '#2a1a10'), dots([[16, 22], [16, 23], [15, 22], [17, 23]], '#c9a24a'),
      limb(8.5, 14, 6.5, 22, 2.3, 2, skin), ball(6.3, 23, 2.1, 2, skin),
      limb(23.5, 14, 26, 20, 2.3, 2, skin), ball(26.8, 20.5, 2.2, 2, skin),
      ...both(ball(8.5, 13.5, 3.2, 2.6, iron)),
      // a scalp lock, greased flat
      sheet([[12.3, 4.6], [13.5, 3], [17.5, 3], [18.7, 4.6], [15.5, 5.2]], '#1e1a14', { tilt: [0.3, 0.8] }),
      ball(16, 8.5, 5.4, 5, skin),
      // a jaw thrust forward, broader than the skull above it
      ball(16, 11.8, 3.9, 2.1, '#56752f'),
      // eyes deep under a brow like a shelf
      ball(13.6, 8.4, 1.8, 1.1, '#3a5020'), ball(18.4, 8.4, 1.8, 1.1, '#3a5020'),
      limb(11.9, 6.7, 15, 7.5, 0.9, 0.8, skin), limb(20.1, 6.7, 17, 7.5, 0.9, 0.8, skin),
      dots([[13, 8], [14, 8], [18, 8], [19, 8]], '#ff4a30'), dots([[14, 8], [18, 8]], '#1a0808'),
      // a broad, flattened nose, broken more than once
      ball(16, 9.9, 1.8, 1.2, skin),
      // a grim mouth, the lower lip pushed up by the tusks, one snapped short
      sheet([[13.2, 11.2], [18.8, 11.2], [18, 12.3], [14, 12.3]], '#2a1410'),
      ball(16, 12.8, 2.7, 0.8, '#56752f'),
      limb(13.6, 12.6, 13.1, 10.2, 0.6, 0.35, '#f4ecd6'), limb(18.4, 12.6, 18.8, 10.6, 0.6, 0.45, '#f4ecd6'),
    ];
  },

  // Crouched and leaning in, all ribs and claws, grinning with too many teeth.
  ghoul: () => {
    const skin = '#8f9a84', dark = '#5c6656';
    return [
      limb(13, 22, 10, 26, 2, 1.7, dark), limb(10, 26, 12, 30, 1.7, 1.4, dark),
      limb(19, 22, 22, 26, 2, 1.7, dark), limb(22, 26, 20, 30, 1.7, 1.4, dark),
      ball(11.5, 30.4, 2.4, 1, dark), ball(20.5, 30.4, 2.4, 1, dark),
      ball(16, 18.5, 5.8, 5.4, skin),
      // ribs curving round the wasted chest from the breastbone
      ...[15, 17, 19].flatMap(y => [line(11, y + 1, 15, y, dark), line(21, y + 1, 17, y, dark)]),
      limb(16, 13.5, 16, 22, 0.5, 0.5, '#b0aa94'),
      limb(10.5, 15, 6, 21, 1.4, 1.1, skin), limb(6, 21, 5, 27, 1.1, 1, skin),
      limb(21.5, 15, 26, 21, 1.4, 1.1, skin), limb(26, 21, 27, 27, 1.1, 1, skin),
      ball(5, 27.3, 1.5, 1.3, skin), ball(27, 27.3, 1.5, 1.3, skin),
      dots([[3, 28], [3, 29], [4, 29], [5, 30], [6, 29]], '#f2eee0'), dots([[29, 28], [29, 29], [28, 29], [27, 30], [26, 29]], '#f2eee0'),
      // long pointed ears, a narrow skull, eyes deep in their sockets
      sheet([[11.5, 10], [7.5, 6.5], [11.5, 12.5]], skin, { tilt: [-0.5, -0.2] }),
      sheet([[20.5, 10], [24.5, 6.5], [20.5, 12.5]], skin, { tilt: [0.5, -0.2] }),
      ball(16, 11.2, 4.4, 4.6, skin),
      ball(13.8, 10.6, 1.5, 1.2, '#2e3228'), ball(18.2, 10.6, 1.5, 1.2, '#2e3228'),
      dots([[14, 11], [18, 11]], '#ffe040'), dots([[14, 10], [18, 10]], '#fff8c0'),
      ball(16, 12.6, 0.9, 0.8, '#3a4034'),
      // the jaw hangs open, a mouthful of needles
      ball(16, 15, 3.2, 2.1, '#2a1414'),
      dots([[14, 14], [16, 14], [18, 14], [15, 16], [17, 16]], '#f2eee0'),
      dots([[16, 15]], '#8a2424'),
    ];
  },

  // A robed cultist whose hood holds only darkness and two points of light,
  // hands cupped around something that should not glow.
  acolyte: () => {
    const robe = '#6a1f34', trim = '#c9a24a', skin = '#d8b8a0';
    return [
      // a lesser figure than the lich: narrow, stooped, hood drawn to a point
      sheet([[11.5, 13], [20.5, 13], [23, 31], [9, 31]], robe, { curve: 1 }),
      line(16, 22, 16, 31, '#4a1224'),
      line(9, 31, 23, 31, trim),
      sheet([[10.5, 14], [12, 6], [16, 1], [20, 6], [21.5, 14], [19, 16], [13, 16]], robe, { curve: 0.9 }),
      ball(16, 10.5, 3.4, 3.8, '#0c080e'),
      dots([[14, 10], [18, 10]], '#ff5070'), dots([[14, 11], [18, 11]], '#a02040'),
      // both hands lift the orb high, out in front of the chest
      limb(11.5, 15, 13.5, 18, 1.5, 1.3, robe), limb(20.5, 15, 18.5, 18, 1.5, 1.3, robe),
      ball(16, 17.5, 2.9, 2.9, '#b060ff'),
      ball(15.2, 16.7, 1.2, 1.2, '#e8c8ff'),
      dots([[12, 14], [20, 14], [11, 18], [21, 18], [16, 13.5]], '#d8a0ff'),
      ball(13.6, 18.6, 1.3, 1.2, skin), ball(18.4, 18.6, 1.3, 1.2, skin),
      line(12, 21.5, 20, 21.5, trim), dots([[15, 22], [15, 23], [16, 24]], trim),
    ];
  },

  // No legs and no body: a cloak that has forgotten who wore it, trailing to
  // nothing, reaching.
  wraith: () => {
    const cloak = '#5b4483', deep = '#3a2a58';
    return [
      sheet([[9, 11], [23, 11], [26, 22], [24, 29], [21, 24], [19, 31], [16, 25], [13, 31], [11, 24], [8, 29], [6, 22]], deep, { curve: 1 }),
      sheet([[10, 11], [22, 11], [24, 21], [20, 23], [16, 21], [12, 23], [8, 21]], cloak, { curve: 1 }),
      limb(10, 12.5, 4, 17, 1.4, 1, cloak), limb(22, 12.5, 28, 17, 1.4, 1, cloak),
      dots([[2, 17], [3, 18], [2, 19], [3, 16]], '#c8d8e8'), dots([[29, 17], [28, 18], [29, 19], [28, 16]], '#c8d8e8'),
      sheet([[9, 12], [11, 3.5], [16, 1.5], [21, 3.5], [23, 12], [16, 14]], cloak, { curve: 0.9 }),
      ball(16, 8.5, 3.6, 4, '#0a0610'),
      dots([[14, 8], [18, 8]], '#b4f0ff'), dots([[14, 9], [18, 9]], '#4aa0c0'),
      dots([[13, 7], [19, 7], [15, 8], [17, 8]], '#e0fcff'),
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

  // A crowned skull in rotting robes, bony fingers on a staff whose stone
  // burns cold.
  lich: () => {
    const robe = '#3a2c52', deep = '#221836', bone = '#e6dec6', gold = '#d8a840';
    return [
      limb(26, 30, 26, 5, 0.7, 0.7, '#5a4630'),
      ball(26, 4, 2.2, 2.2, '#40e8ff'), ball(25.3, 3.3, 0.9, 0.9, '#e0ffff'),
      dots([[23, 2], [29, 5], [24, 6], [28, 1]], '#9af4ff'),
      sheet([[9, 12], [23, 12], [26, 31], [6, 31]], deep, { curve: 1 }),
      sheet([[10, 12], [22, 12], [23.5, 25], [16, 23], [8.5, 25]], robe, { curve: 1 }),
      line(16, 13, 16, 31, gold), line(6, 31, 26, 31, gold),
      ...both(sheet([[8, 11], [13, 11], [12, 15], [7.5, 15]], robe, { curve: 0.6 })),
      limb(9.5, 13.5, 11, 20, 1.5, 1.3, robe), ball(11.5, 21, 1.4, 1.3, bone),
      dots([[11, 22], [12, 22.5], [13, 22]], bone),
      limb(22.5, 13.5, 25, 18, 1.5, 1.3, robe), ball(25.5, 18.5, 1.4, 1.3, bone),
      ball(16, 7.5, 4.3, 4.1, bone),
      ball(16, 11.3, 2.6, 1.3, '#b8ae94'),
      dots([[13, 7], [14, 7], [13, 8], [14, 8], [18, 7], [19, 7], [18, 8], [19, 8]], '#0c0814'),
      dots([[14, 7], [18, 7]], '#4ff0ff'),
      dots([[16, 9], [16, 10]], '#1c1424'),
      dots([[14, 11], [15, 11], [17, 11], [18, 11]], '#f6f0de'),
      sheet([[11.5, 5], [12, 1], [13.5, 3.5], [16, 0.5], [18.5, 3.5], [20, 1], [20.5, 5]], gold, { curve: 0.7 }),
      dots([[16, 3], [12, 4], [20, 4]], '#ff4060'),
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

  // The goblin you let out of its cage: smaller than the ones that hunt the
  // halls, all knees and elbows under a grey hooded rag, a broken manacle
  // still on one wrist and a ring of picks at its belt. It holds its bent
  // little knife low and grins as if it knows where the good stuff is.
  // Lunging, it drops low and drives the knife up at you; told to wait, it
  // squats on its heels with its hands on its knees and the knife put away.
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
  goblin: () => [
    // a furrowed forehead and a nicked ear
    hair(14.5, 6.5, 15.5, 7.5, '#4a8034'), hair(17.5, 6.5, 16.5, 7.5, '#4a8034'), hair(14.5, 6, 17.5, 6, '#57913d'),
    specks([[4.5, 6.5], [5, 6.5]], '#1c1a22'),
    // bags under the eyes, the light along the nose, flared nostrils
    hair(11.5, 10.5, 13.5, 10.5, '#4a8034'), hair(18.5, 10.5, 20.5, 10.5, '#4a8034'),
    hair(15.5, 9.5, 15.5, 11.5, '#8ac06a'),
    specks([[15, 13], [17, 13]], '#1e3a14'),
    // creases from the nose to the corners of the grin, a scar down one cheek
    hair(14, 12.5, 12.5, 13.5, '#3f6e2c'), hair(18, 12.5, 19.5, 13.5, '#3f6e2c'),
    hair(20.5, 10, 21, 12, '#3f6e2c'), specks([[20.5, 10.5], [21, 11.5]], '#8ac06a'),
    // a lower lip hanging slack under the grin, and the wet of the tongue
    hair(14, 16, 18, 16, '#4f8a36'), hair(15.5, 15, 16.5, 15, '#9a4040'),
    // a crude buckle, stitching round the tunic and a patch
    specks([[15.5, 17], [16, 17], [16.5, 17], [15.5, 17.5], [16.5, 17.5], [15.5, 18], [16, 18], [16.5, 18]], '#c9a24a'),
    specks([[12, 19.5], [13.5, 19.5], [15, 19.5], [17, 19.5], [18.5, 19.5], [20, 19.5]], '#a88258'),
    specks([[18, 21], [19, 21], [18, 22], [19, 22], [18.5, 21.5]], '#5a3a20'),
    // claws on the empty hand, rust and a notch on the blade
    specks([[6, 24], [7, 24.5], [8, 24.5], [8.5, 24]], '#e8e0c0'),
    specks([[26.5, 18], [27, 16.5], [27.5, 15]], '#8a5a30'), specks([[28.5, 16]], '#3a2a2a'),
    // knees and toes
    ...both(specks([[12.5, 26.5], [13, 26.5]], '#4f8a36')),
    ...both(specks([[10, 30.5], [11, 30.5], [12, 30.5]], '#2a2018')),
  ],

  skeleton: () => [
    // a crack across the skull, the brow over the sockets, cheekbones
    hair(17.5, 2, 18.5, 3.5, '#8a826c'), hair(18.5, 3.5, 18, 5, '#8a826c'),
    hair(12.5, 4.5, 14.5, 4.5, '#b8ae94'), hair(17.5, 4.5, 19.5, 4.5, '#b8ae94'),
    specks([[12.5, 8.5], [19.5, 8.5]], '#a89e84'),
    // gaps between the teeth
    specks([[14.5, 10], [15.5, 10], [17.5, 10]], '#6a6252'),
    // the breastbone, and the ends of each rib where it meets it
    specks([[16, 12], [16, 13.5], [16, 15.5], [16, 17.5]], '#f6f0de'),
    specks([[11.5, 12], [21, 12], [12.5, 14], [20, 14], [12.5, 16], [20, 16], [13.5, 18], [19, 18]], '#8a826c'),
    // knuckles, finger bones and a pitted blade
    specks([[9.5, 24.5], [10.5, 24.5], [11, 24], [9, 24]], '#ddd5bd'),
    specks([[27, 6.5], [28, 4], [27.5, 9]], '#8a6a4a'), hair(27, 12, 29, 2, '#eef2f6'),
    // kneecaps and the grain of the long bones
    ...both(specks([[12.5, 26], [13, 26]], '#f6f0de')),
    hair(13, 27.5, 13, 29.5, '#b8ae94'), hair(19, 27.5, 19, 29.5, '#b8ae94'),
  ],

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

  zombie: () => [
    // stitches across the scalp and a flap of skin
    hair(12.5, 6, 16.5, 5.5, '#3a2a2a'), specks([[13, 5.5], [13.5, 6.5], [14.5, 5], [15, 6], [16, 5], [16.5, 6]], '#3a2a2a'),
    // rot and bruising on the face and reaching arm
    specks([[16.5, 10.5], [17, 11], [23.5, 13], [25.5, 14.5], [26, 13]], '#6a7a52'),
    specks([[24.5, 14], [25, 14]], '#e8e0c8'),
    // the ragged rims of the hollow socket and the torn cheek, bare nostrils
    hair(10, 9.5, 12.5, 9.5, '#b0c098'), hair(9.5, 13, 11.5, 13.5, '#5f6e4e'),
    specks([[13.5, 11], [14.5, 11]], '#2a1418'),
    // a pale film over the blind eye, and the sag beneath it
    specks([[16, 8], [16.5, 8]], '#f0f2e8'), hair(15.5, 9.5, 17.5, 9.5, '#6f805c'),
    // something dark drooling from the slack lip
    specks([[14.5, 15], [14.5, 15.5], [15, 16.5]], '#4a1818'),
    // holes and a dangling thread in the shirt
    specks([[11.5, 17], [12, 17.5], [20.5, 23], [13, 21]], '#2a2430'),
    hair(19, 25, 19.5, 27, '#4e5a78'),
    // bone showing at the knee through torn trousers
    specks([[20, 26], [20.5, 26], [20, 26.5]], '#cfc6aa'),
    // yellowed nails on the reaching hand
    specks([[30, 12.5], [30, 13.5], [29.5, 14.5]], '#c8c080'),
  ],

  orc: () => [
    // mail rings over the breastplate's edges, and rivets on the pauldrons
    ...[15, 16.5, 18].map(y => specks([[11.5, y], [12.5, y + 0.5], [19.5, y], [20.5, y + 0.5]], '#5a6270')).flat(),
    ...both(specks([[7, 12.5], [8.5, 12], [10, 12.5]], '#d8dee8')),
    // a scar through one brow, a ring in the ear, broken tusk tip
    hair(12.5, 5.5, 14.5, 9.5, '#3f5a24'), specks([[13, 6.5], [14, 8.5]], '#8aa860'),
    specks([[10.5, 9.5], [10.5, 10]], '#c9a24a'),
    // grease shining on the scalp lock
    hair(14, 3.5, 17, 3.5, '#4a4232'),
    // flared nostrils, and deep creases from them down past the tusks
    specks([[15, 10.5], [17, 10.5]], '#1e2a10'),
    hair(14, 10, 12.5, 12, '#3f5a24'), hair(18, 10, 19.5, 12, '#3f5a24'),
    // the snapped end of the tusk, and the light down the other
    specks([[18.5, 10.5], [19, 10.5]], '#b8ae94'), hair(13, 10.5, 13.5, 12, '#fffaf0'),
    // stitching on the leather skirt and the belt's tongue
    specks([[11, 21.5], [13, 21.5], [19, 21.5], [21, 21.5]], '#8a6040'),
    specks([[17.5, 23], [17.5, 23.5]], '#2a1a10'),
    // the axe: wear along the edge, grain in the haft, a wrapped grip
    specks([[30.5, 6], [30.5, 9], [30.5, 11]], '#5a6270'), hair(27, 14, 27, 20, '#8a6a42'),
    specks([[26.5, 22], [27.5, 22.5], [26.5, 23], [27.5, 23.5]], '#3a2818'),
    // knuckles
    specks([[5.5, 24], [6.5, 24.5], [7.5, 24]], '#4f6e2e'), specks([[26, 21.5], [27, 22], [28, 21.5]], '#4f6e2e'),
  ],

  ghoul: () => [
    // veins on the arms and wasted chest, a knobbled spine
    hair(9, 16.5, 7, 19.5, '#7a6a8a'), hair(23, 16.5, 25, 19.5, '#7a6a8a'), hair(12, 20, 14, 21.5, '#7a6a8a'),
    specks([[16, 14.5], [16, 16.5], [16, 18.5], [16, 20.5]], '#c8c2ac'),
    // warts, and drool hanging from the jaw
    specks([[12.5, 12], [19.5, 12.5], [14, 20], [19, 21]], '#7a7462'),
    specks([[15, 17.5], [15, 18.5], [17.5, 17.5], [17.5, 18]], '#c8e0c0'),
    // a split lip, and grave dirt under the claws
    specks([[16.5, 13.5]], '#8a2020'),
    specks([[4, 28.5], [5.5, 29], [27.5, 28.5], [26, 29]], '#4a4030'),
    // hollow cheeks
    hair(12.5, 12.5, 13.5, 14, '#7a7462'), hair(19.5, 12.5, 18.5, 14, '#7a7462'),
  ],

  acolyte: () => [
    // an embroidered sigil down the front of the robe, and gold at the cuffs
    specks([[16, 24.5], [16, 26], [15.5, 26.5], [16.5, 26.5], [16, 27.5], [15, 28.5], [17, 28.5], [16, 29.5]], '#c9a24a'),
    specks([[12, 17.5], [13, 18], [20, 17.5], [19, 18]], '#c9a24a'),
    // stitches round the hood's edge and a fold at its peak
    specks([[11, 13], [11.5, 10], [12.5, 7], [19.5, 7], [20.5, 10], [21, 13]], '#8a2a44'),
    hair(16, 1.5, 15.5, 4.5, '#4a1224'),
    // a swirl of light inside the orb, and fingers round it
    hair(15, 18, 16.5, 17, '#f0d8ff'), specks([[17, 18.5], [16, 19]], '#f0d8ff'),
    specks([[13, 19.5], [14, 19.5], [18, 19.5], [19, 19.5]], '#b89878'),
    // the frayed hem
    specks([[10, 30.5], [12.5, 30.5], [19, 30.5], [21.5, 30.5]], '#4a1224'),
  ],

  wraith: () => [
    // holes worn through the cloak, frost at the fingertips
    specks([[11, 19], [11.5, 19], [20.5, 16], [21, 16.5], [14, 26], [18.5, 27]], '#1a1028'),
    specks([[1.5, 16], [1, 18.5], [3.5, 20], [30, 16], [30.5, 18.5], [28, 20]], '#e0f8ff'),
    // wisps trailing off the ragged ends
    hair(8, 29, 7, 31, '#8a7ab0'), hair(13, 31, 12.5, 31.5, '#8a7ab0'), hair(19, 31, 19.5, 31.5, '#8a7ab0'), hair(24, 29, 25, 31, '#8a7ab0'),
    // folds catching what light there is
    hair(12, 13, 11, 20, '#7a64a8'), hair(20, 13, 21, 20, '#7a64a8'), hair(16, 15, 16, 20, '#7a64a8'),
    // a cold breath from the dark of the hood
    specks([[15.5, 11], [16.5, 11.5], [16, 12]], '#a0c8e0'),
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

  lich: () => [
    // runes stitched down the robe in faded silver
    specks([[12.5, 17], [13, 17.5], [12.5, 18], [19.5, 17], [19, 17.5], [19.5, 18]], '#8a7ab0'),
    specks([[11, 26], [11.5, 27], [12, 26], [20, 26], [20.5, 27], [21, 26]], '#8a7ab0'),
    // cracks in the skull and gems in the crown
    hair(14, 4, 15, 6, '#9a927c'), hair(18.5, 3.5, 18, 5.5, '#9a927c'),
    specks([[13.5, 2.5], [18.5, 2.5]], '#40e8ff'),
    // the staff: bands of rune light, a claw holding the stone
    specks([[26, 9], [26, 13], [26, 17], [26, 21], [26, 25]], '#40e8ff'),
    specks([[24.5, 5], [27.5, 5]], '#d8a840'),
    // frost gathering at the hem, and knucklebones on the hand
    specks([[7, 30.5], [9, 30], [23, 30], [25, 30.5]], '#c8f0ff'),
    specks([[24.5, 19], [25.5, 19.5], [26.5, 19]], '#b8ae94'),
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

// Other pictures of a creature, painted from the same parts with a pose
// given: 'windup' while a blow is drawn back, 'special' while its own trick
// is readied. Without a 'special' the wind-up serves for both.
const POSES = { basilisk: ['windup', 'special'], rustmaw: ['windup'], hound: ['windup', 'special'], quillback: ['windup', 'special'], wyrm: ['windup', 'special'], dog: ['windup', 'sit'], scrag: ['windup', 'sit'] };

// Props for encounters (see encounters.js): things you walk up to, drawn with
// the same painter so they sit in the same light as the creatures.
const PROPS = {
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
    limb(3.5, 31, 3.5, 13, 0.7, 0.7, '#6a4424'),
    ...CREATURES.goblin(),
    sheet([[0.5, 8.5], [9.5, 8.5], [9.5, 14.5], [0.5, 14.5]], '#b08a58', { tilt: [-0.1, -0.2] }),
    dots([[2, 10], [3, 10], [4, 10], [3, 11], [3, 12], [3, 13], [6, 10], [6, 11], [6, 12], [6, 13], [7, 10], [7, 13], [8, 10], [8, 11], [8, 12], [8, 13]], '#3a2410'),
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
  ],
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
function ramp(hex) {
  if (rampCache.has(hex)) return rampCache.get(hex);
  const rgb = hexToRgb(hex);
  const out = [mixTo(rgb, SHADOW_INK, 0.72), mixTo(rgb, SHADOW_INK, 0.5), mixTo(rgb, SHADOW_INK, 0.26),
    hex, mixTo(rgb, LIGHT_CREAM, 0.22), mixTo(rgb, LIGHT_CREAM, 0.45)];
  rampCache.set(hex, out);
  return out;
}
const BANDS = [0.3, 0.45, 0.58, 0.76, 0.9];
// a 4x4 ordered-dither matrix: where two tones meet, the upper edge of the
// darker band is stippled with the lighter one, so a curve grades smoothly
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
/** The ramp step for a surface normal; with a pixel given, blended across band edges. */
function toneFor(nx, ny, nz, px, py) {
  const n = Math.hypot(nx, ny, nz) || 1;
  const dot = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n;
  // the side turned from the light is not one flat dark: light thrown back
  // off the floor lifts its far edge a step, so a limb reads round
  const v = 0.3 + 0.7 * Math.max(0, dot) + (dot < -0.3 ? 0.2 * Math.min(1, (-dot - 0.3) / 0.45) : 0);
  let i = 0;
  while (i < BANDS.length && v >= BANDS[i]) i++;
  if (px == null || i >= BANDS.length) return i;
  const lo = i ? BANDS[i - 1] : 0.3, hi = BANDS[i], f = (v - lo) / ((hi - lo) || 1);
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
function paintParts(parts, grid = 32, scale = 1) {
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
      let t = fine && p.k !== 'sheet' ? toneFor(nx, ny, nz, x, y) : toneFor(nx, ny, nz);
      if (rough && t > 0) {
        if (p.k === 'sheet') {
          // cloth hangs in folds: a few broad darker runs down it, not speckle
          const fx = x / scale, fy = y / scale;
          if (Math.sin(fx * 1.25 + Math.sin(fy * 0.35 + i) * 1.1) > 0.9) t--;
        } else if (grain(x, y, i) < 0.09) t--;   // a fine grain on skin and fur
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
  for (let k = 0; k < N; k++) if (tone[k] >= 0) col[k] = ramp(base[k])[shadeK[k]];
  return { aw: size, ah: size, color: col };
}

export { CREATURES, POSES, PROPS, FLOATING, paintParts, ball, limb, sheet, line, dots, specks, hair, both };
