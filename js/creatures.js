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
      ball(16, 12.2, 1.4, 2, '#5f9a40'),
      dots([[12, 9], [13, 9], [19, 9], [20, 9]], '#ffe040'),
      dots([[13, 9], [19, 9]], '#1a1010'),
      dots([[12, 8], [13, 8], [14, 8], [18, 8], [19, 8], [20, 8]], '#2e5020'),
      dots([[13, 14], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [19, 14]], '#2a1010'),
      dots([[14, 14], [16, 14], [18, 14]], '#f0e6c8'),
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
    return [
      ...legs.slice(0, 6 * 2),
      ball(16, 19.5, 7.8, 6.6, shell),
      dots([[16, 16], [15, 17], [16, 17], [17, 17], [16, 18], [15, 20], [16, 20], [17, 20], [14, 21], [15, 21], [16, 21], [17, 21], [18, 21]], '#c02828'),
      dots([[16, 17], [16, 21]], '#ff5a4a'),
      ...legs.slice(6 * 2),
      ball(16, 25.5, 4.4, 3.4, '#4e4264'),
      dots([[14, 24], [18, 24], [15, 23], [17, 23]], '#ff3030'),
      dots([[13, 25], [19, 25], [16, 23]], '#b01818'),
      dots([[14, 24], [18, 24]], '#ffd0c0'),
      dots([[15, 28], [17, 28], [15, 29], [17, 29]], '#e8e0d0'),
    ];
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
      ball(12.5, 12.5, 2.5, 1.6, rot),
      dots([[11, 8], [12, 8], [11, 9], [12, 9]], '#141014'), dots([[16, 8], [17, 8]], '#e8e4a0'), dots([[17, 8]], '#1a1010'),
      dots([[11, 12], [12, 13], [13, 13], [14, 12]], '#2a1418'),
      dots([[12, 12], [13, 12]], '#6a2020'),
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
      ball(16, 8.5, 5.4, 5, skin),
      ball(16, 11.5, 3.4, 2, '#4f6e2e'),
      line(11.5, 7, 20.5, 7, '#3a5020'),
      dots([[13, 8], [14, 8], [18, 8], [19, 8]], '#ff4a30'), dots([[14, 8], [18, 8]], '#1a0808'),
      dots([[13, 11], [13, 10], [19, 11], [19, 10]], '#f4ecd6'),
      dots([[14, 12], [15, 12], [16, 12], [17, 12], [18, 12]], '#2a1410'),
      dots([[12, 4], [13, 3], [14, 3], [15, 3], [16, 3], [17, 4]], '#1e1a14'),
    ];
  },

  // Crouched and leaning in, all ribs and claws, grinning with too many teeth.
  ghoul: () => {
    const skin = '#9c9682', dark = '#6a6454';
    return [
      limb(13, 22, 10, 26, 2, 1.7, dark), limb(10, 26, 12, 30, 1.7, 1.4, dark),
      limb(19, 22, 22, 26, 2, 1.7, dark), limb(22, 26, 20, 30, 1.7, 1.4, dark),
      ball(11.5, 30.4, 2.4, 1, dark), ball(20.5, 30.4, 2.4, 1, dark),
      ball(16, 18.5, 5.8, 5.4, skin),
      ...[15, 17, 19].map(y => line(12, y, 20, y, '#7a7462')),
      limb(16, 13.5, 16, 22, 0.5, 0.5, '#b0aa94'),
      limb(10.5, 15, 6, 21, 1.4, 1.1, skin), limb(6, 21, 5, 27, 1.1, 1, skin),
      limb(21.5, 15, 26, 21, 1.4, 1.1, skin), limb(26, 21, 27, 27, 1.1, 1, skin),
      ball(5, 27.3, 1.5, 1.3, skin), ball(27, 27.3, 1.5, 1.3, skin),
      dots([[3, 28], [3, 29], [4, 29], [5, 30], [6, 29]], '#f2eee0'), dots([[29, 28], [29, 29], [28, 29], [27, 30], [26, 29]], '#f2eee0'),
      ball(16, 12, 5, 4.4, skin),
      ball(16, 14.5, 3.4, 1.8, dark),
      dots([[13, 11], [14, 11], [18, 11], [19, 11]], '#ffe040'), dots([[14, 11], [18, 11]], '#fff8c0'),
      dots([[12, 10], [13, 10], [19, 10], [20, 10]], '#4a4638'),
      dots([[13, 14], [19, 14]], '#2a1818'),
      dots([[14, 14], [15, 15], [16, 14], [17, 15], [18, 14]], '#f2eee0'),
      dots([[14, 15], [16, 15], [18, 15]], '#5a1c1c'),
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
      ball(16, 9, 4.2, 3.8, skin),
      ball(16, 11.5, 3, 1.6, dark),
      dots([[14, 8], [18, 8]], '#ff9040'), dots([[13, 7], [14, 7], [18, 7], [19, 7]], '#5a3e20'),
      dots([[14, 11], [18, 11]], '#f0ead6'), dots([[15, 12], [16, 12], [17, 12]], '#2a1410'),
      dots([[16, 9], [16, 10]], '#8a6a44'),
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
      ball(16, 11, 3.8, 2.8, '#c8a088'),
      dots([[14, 11], [18, 11], [14, 12], [18, 12]], '#2a1410'),
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

  // A trader who came down willingly: a pack as big as they are, a lantern,
  // and a face that is pleased to see a customer.
  merchant: () => {
    const cloak = '#6b4a2e', tunic = '#6b4a8a', skin = '#d4a47a';
    return [
      ball(16, 14, 8.5, 7, '#7a5a3a'),
      limb(8.5, 8.5, 23.5, 8.5, 1.8, 1.8, '#a07850'),
      ...both(limb(13.5, 22, 13, 30, 2, 1.8, '#3a2e36')),
      ...both(ball(12.5, 30.4, 2.4, 1.1, '#2a2020')),
      sheet([[10.5, 13], [21.5, 13], [22.5, 24], [9.5, 24]], tunic, { curve: 1 }),
      line(10, 19, 22, 19, '#3a2418'), ball(19.5, 20.5, 1.6, 1.5, '#c9a24a'),
      sheet([[9, 13], [11, 25], [8, 26]], cloak, { tilt: [-0.4, 0] }), sheet([[23, 13], [21, 25], [24, 26]], cloak, { tilt: [0.4, 0] }),
      limb(10, 14, 7, 20, 1.6, 1.4, cloak), ball(6.8, 20.8, 1.5, 1.4, skin),
      line(6, 21, 6, 23, '#4a4040'), ball(6, 25, 1.8, 2, '#ffd060'), ball(5.6, 24.5, 0.8, 0.8, '#fff6d0'),
      limb(22, 14, 24, 19.5, 1.6, 1.4, cloak), ball(24, 20.3, 1.5, 1.4, skin),
      ball(16, 8.5, 4.3, 4.2, skin),
      sheet([[12.5, 10], [19.5, 10], [18.5, 13.5], [16, 14.5], [13.5, 13.5]], '#e8e0d0', { curve: 0.8 }),
      sheet([[10.5, 9], [12, 2.5], [16, 1], [20, 2.5], [21.5, 9], [19.5, 5.5], [12.5, 5.5]], cloak, { curve: 0.8 }),
      dots([[14, 8], [18, 8]], '#1a1010'), dots([[13, 7], [14, 7], [18, 7], [19, 7]], '#7a5a40'),
      dots([[15, 11], [16, 11], [17, 11]], '#8a4a3a'),
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
      const crown = (gaze ? [[-178, 6.5], [-148, 8], [-120, 8.5], [-90, 9], [-60, 8.5], [-32, 8], [-2, 6.5]] : [[-160, 3.5], [-128, 4.5], [-90, 4], [-52, 4.5], [-20, 3.5]])
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
          dots([[cx - 3, cy + 3.5], [cx + 3, cy + 3.5], [cx - 2, cy + 4.5], [cx + 2, cy + 4.5], [cx - 3, cy + 5.5], [cx + 3, cy + 5.5], [cx - 2, cy + 6.5], [cx, cy + 6.5], [cx + 2, cy + 6.5]], '#f0e8cc'),
          dots([[cx - 1, cy + 5.5], [cx, cy + 5.5], [cx + 1, cy + 5.5]], '#a04a40'),
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
      p.push(ball(cx - 3.5, ey + 1, 2.1, gaze ? 2.1 : 1.6, '#262a18'), ball(cx + 3.5, ey + 1, 2.1, gaze ? 2.1 : 1.6, '#262a18'));
      const L = [cx - 5, cx - 4, cx - 3], R = [cx + 2, cx + 3, cx + 4];
      const eye = rows => rows.flatMap(y => [...L, ...R].map(x => [x, y]));
      if (gaze) {
        // wide and burning, the pupils shrunk to a line
        p.push(dots(eye([ey - 1, ey, ey + 1]), '#e8ff70'), dots([ey - 1, ey, ey + 1].flatMap(y => [[cx - 4, y], [cx + 3, y]]), '#fcffd0'));
      } else if (bite) {
        // narrowed to slits under the brow
        p.push(dots(eye([ey + 1]), '#d8f040'), dots([[cx - 4, ey + 1], [cx + 3, ey + 1]], '#1a2008'));
      } else {
        p.push(dots(eye([ey, ey + 1]), '#d8f040'), dots([[cx - 4, ey], [cx - 4, ey + 1], [cx + 3, ey], [cx + 3, ey + 1]], '#1a2008'));
      }
      p.push(specks([[cx - 1, cy + 3.5], [cx + 1, cy + 3.5]], '#1e2414'));
      if (gaze) {
        // light spilling out of them, over the frill and down the snout
        for (const [ex, dir] of [[cx - 3.5, -1], [cx + 3.5, 1]]) {
          p.push(hair(ex + dir * 2.5, ey + 0.5, ex + dir * 5, ey + 0.5, '#d8ff60'), hair(ex + dir * 2, ey - 1.5, ex + dir * 4, ey - 3.5, '#c0f050'),
            hair(ex + dir * 2, ey + 2.5, ex + dir * 4, ey + 4.5, '#c0f050'), hair(ex, ey - 2, ex, ey - 4, '#c0f050'));
          p.push(specks([[ex + dir * 4, ey - 1], [ex - dir, ey + 3]], '#f0ffa0'));
        }
      }
      if (bite) p.push(hair(cx + 2, cy + 7.5, cx + 2, cy + 9, '#c8d0a0'), specks([[cx - 2.5, cy + 8]], '#c8d0a0'));
      const b = gaze ? -1.2 : bite ? 0.4 : 0;    // the brow, raised or drawn down
      p.push(limb(cx - 6, ey - 1.2 + b, cx - 1.5, ey + 0.2 + b, 0.9, 0.6, horn), limb(cx + 6, ey - 1.2 + b, cx + 1.5, ey + 0.2 + b, 0.9, 0.6, horn));
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
    // the back, rings round the tail and claws on the feet
    const onBack = (x, y) => y < 19.5 - up && (((x - 19.5) / 6) ** 2 + ((y - 17.5 + up) / 4.4) ** 2 < 1 || ((x - 24.5) / 4.3) ** 2 + ((y - 16.5 + up * 0.5) / 3.3) ** 2 < 1);
    const scales = [];
    for (let r = 0; r < 5; r++) for (let x = 17 + (r % 2); x < 29; x += 2) { const y = 13.5 + r * 1.5; if (onBack(x - 0.5, y) && onBack(x + 0.5, y + 0.5)) scales.push([x, y]); }
    out.push(
      ...plates.map(([x, y, h, l]) => hair(x, y + 0.5, x + l * 1.5, y - h + 1, '#7a6844')),
      specks(scales.flatMap(([x, y]) => [[x - 0.5, y], [x, y + 0.5], [x + 0.5, y]]), '#46502e'),
      specks(scales.map(([x, y]) => [x, y - 0.5]), '#8a9860'),
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
      ...both(limb(10.5, 16 - up * 0.4, 5, 9.5 - up * 0.5, 1.1, 0.8, leg)), ...both(limb(5, 9.5 - up * 0.5, 2.5, 20.5, 0.75, 0.5, leg)),
      ...both(ball(5, 9.5 - up * 0.5, 1.1, 1.1, knee)),
      // the shell, crusted green where the copper has gone over
      ball(16, 15.5 - sy, 10.8, 8.4, rust),
      sheet([[6, 13], [8, 10.5], [10.5, 10], [11, 12], [9.5, 13], [10, 15.5], [7.5, 17], [5.5, 16]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.4, -0.3] }),
      sheet([[20, 8.5], [22.5, 8], [24, 10], [22.5, 10.5], [21, 10]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.2, -0.6] }),
      sheet([[23, 14], [25.5, 13], [26.8, 16], [26, 19], [24, 18], [24.5, 16]].map(([x, y]) => [x, y - sy]), verd, { tilt: [0.6, 0] }),
      sheet([[12.5, 17.5], [14.5, 16.5], [15, 19], [13, 19.5]].map(([x, y]) => [x, y - sy]), verd, { tilt: [-0.2, 0] }),
      // middle legs, braced wide
      ...both(limb(8, 21 - up * 0.6, 2.5, 15.5 - up * 0.8, 1.3, 1, leg)), ...both(limb(2.5, 15.5 - up * 0.8, 0.8, 27.5, 0.9, 0.55, leg)),
      ...both(ball(2.5, 15.5 - up * 0.8, 1.3, 1.2, knee)),
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
      // the maw, round and wet, lipped in raw red
      ball(16, hy + 1, mr[0] + 0.6, mr[1] + 0.5, '#8a3424'),
      ball(16, hy + 1, mr[0], mr[1], '#4a0e0c'),
      ball(16, hy + 1.3, mr[0] * 0.55, mr[1] * 0.55, '#140404'),
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
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; teeth.push([16 + Math.cos(t) * (mr[0] - 0.3), hy + 1 + Math.sin(t) * (mr[1] - 0.3)]); }
    out.push(
      specks(teeth, '#f0e6cc'),
      hair(15, hy + 1 + mr[1], 14.5, rear ? 31 : 31, '#c89048'), hair(17.5, hy + 1 + mr[1], 18, hy + 3 + mr[1], '#c89048'), specks([[14.5, 31.5], [18, hy + 4 + mr[1]]], '#e0b060'),
      hair(16, 7.5 - sy, 16, 17.5 - sy, '#4a1c0c'),
      specks([[9, 9], [12.5, 13], [19, 12], [21.5, 15.5], [13, 16.5], [18.5, 16], [11, 8], [24.5, 11.5], [7, 14.5], [20, 18.5]].map(([x, y]) => [x, y - sy]), '#4a1e0c'),
      specks([[8.5, 11.5], [9, 14.5], [22, 9], [25, 15], [13.5, 17.5]].map(([x, y]) => [x, y - sy]), '#9ad0b8'),
      // flakes of rust coming away
      specks([[4.5, 24.5], [27, 25.5], [26, 28], [8, 29.5], [22.5, 30.5], [23, 31], [9, 31], [3.5, 30]], '#c06a30'),
      specks([[5.5, 26], [27.5, 27], [24.5, 30.5]], '#7a3a18'),
      ...both(specks([[1.5, 24], [1, 26], [2, 19]], '#8a5a30')),
      ...both(specks(rear ? [[4, 13], [3, 11], [5, 14.5]] : [[5.5, 24.5], [5, 26], [6.5, 23]], gold)),
    );
    return out;
  },
};

// Hand-drawn detail laid over each monster on the fine grid, half a unit to
// the pixel: the claws, seams, cracks, rivets and fur that a 32-grid could
// only suggest. Painted coarsely (the art checks, scale 1) they fold back
// onto whole pixels and change little.
const DETAILS = {
  goblin: () => [
    // brow creases and a nicked ear
    hair(12.5, 6.5, 14.5, 7, '#4a8034'), hair(17.5, 7, 19.5, 6.5, '#4a8034'), hair(14.5, 5.5, 17.5, 5.5, '#57913d'),
    specks([[4.5, 6.5], [5, 6.5]], '#1c1a22'),
    // nostrils, a scar down one cheek, and a snaggle tooth
    specks([[15.5, 12.5], [16.5, 12.5]], '#2e5020'),
    hair(19, 10.5, 20.5, 12.5, '#3f6e2c'), specks([[19.5, 11], [20, 12]], '#8ac06a'),
    specks([[17.5, 14.5], [17.5, 15]], '#f0e6c8'),
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
    // the smaller eyes round the big ones
    specks([[13.5, 23.5], [18.5, 23.5], [14.5, 22.5], [17.5, 22.5]], '#ff7050'),
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
    specks([[15.5, 11], [16, 11.5], [10, 10.5], [23.5, 13], [25.5, 14.5], [26, 13]], '#6a7a52'),
    specks([[24.5, 14], [25, 14]], '#e8e0c8'),
    // a drool of something dark from the mouth
    specks([[12, 14], [12, 14.5], [12.5, 15.5]], '#4a1818'),
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
    specks([[19, 9.5]], '#1a1810'),
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
    specks([[15, 15.5], [15, 16.5], [17.5, 16], [17.5, 17]], '#c8e0c0'),
    // a split lip, and grave dirt under the claws
    specks([[16.5, 14.5]], '#8a2020'),
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
    // buckles and straps on the pack, and a pot and a ladle hanging off it
    specks([[11, 12], [21, 12], [11, 12.5], [21, 12.5]], '#c9a24a'),
    hair(10, 9.5, 10, 14, '#5a3e24'), hair(22, 9.5, 22, 14, '#5a3e24'),
    hair(9.5, 8, 23, 8, '#c8a878'),
    // stitching on the tunic, a coin purse's drawstring, the lantern's cage
    specks([[12, 15], [12, 17], [20, 15], [20, 17], [12, 22], [20, 22]], '#8a6aa8'),
    specks([[19, 19.5], [20, 19.5], [19.5, 19]], '#8a6a2a'),
    hair(5, 23.5, 5, 26.5, '#4a4040'), hair(7, 23.5, 7, 26.5, '#4a4040'),
    // laugh lines, a braided beard, a twinkle
    hair(13, 9.5, 13.5, 10.5, '#b07a58'), hair(19, 9.5, 18.5, 10.5, '#b07a58'),
    specks([[15, 12.5], [16, 13], [17, 12.5], [16, 14]], '#c8c0b0'),
    specks([[18.5, 7.5]], '#ffffff'),
  ],
};
for (const k in DETAILS) {
  const base = CREATURES[k];
  // a pose (see POSES) passes through to both
  CREATURES[k] = pose => [...base(pose), ...DETAILS[k](pose)];
}

// Other pictures of a creature, painted from the same parts with a pose
// given: 'windup' while a blow is drawn back, 'special' while its own trick
// is readied. Without a 'special' the wind-up serves for both.
const POSES = { basilisk: ['windup', 'special'], rustmaw: ['windup'] };

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
    specks([[14, 7.5], [18, 7.5]], '#5a3e20'),
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
const FLOATING = new Set(['bat', 'wraith', 'lich', 'wisp', 'duelist_ghost']);

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
  const v = 0.3 + 0.7 * Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n);
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
