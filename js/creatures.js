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
/** mirror a part across the sprite's centre line (x = 15.5) */
const mirror = p => {
  const m = x => 31 - x;
  if (p.k === 'ball') return { ...p, x: m(p.x) };
  if (p.k === 'limb' || p.k === 'line') return { ...p, x1: m(p.x1), x2: m(p.x2) };
  if (p.k === 'sheet' || p.k === 'dots') return { ...p, pts: p.pts.map(([x, y]) => [m(x), y]) };
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
};

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

// Creatures that hover, and so cast no shadow on the floor.
const FLOATING = new Set(['bat', 'wraith', 'lich', 'wisp']);

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
function toneFor(nx, ny, nz) {
  const n = Math.hypot(nx, ny, nz) || 1;
  const v = 0.3 + 0.7 * Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n);
  return v < 0.3 ? 0 : v < 0.45 ? 1 : v < 0.58 ? 2 : v < 0.76 ? 3 : v < 0.9 ? 4 : 5;
}
function insidePoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** @returns {{aw: number, ah: number, color: (string|null)[]}} */
function paintParts(parts, size = 32) {
  const N = size * size;
  const col = new Array(N).fill(null), tone = new Int8Array(N).fill(-1), owner = new Int16Array(N).fill(-1);
  const base = new Array(N).fill(null);
  const put = (x, y, i, b, t, exact) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const k = y * size + x;
    owner[k] = i; base[k] = exact ? null : b; tone[k] = exact ? -1 : t; col[k] = exact ? b : null;
  };
  parts.forEach((p, i) => {
    if (p.k === 'dots') { for (const [x, y] of p.pts) put(Math.round(x), Math.round(y), i, p.c, 0, true); return; }
    if (p.k === 'line') {
      let x0 = Math.round(p.x1), y0 = Math.round(p.y1);
      const x1 = Math.round(p.x2), y1 = Math.round(p.y2);
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
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (p.k === 'ball') {
        const nx = (px - p.x) / p.rx, ny = (py - p.y) / p.ry, d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        put(x, y, i, p.c, toneFor(nx, ny, Math.sqrt(1 - d2)));
      } else if (p.k === 'limb') {
        const ax = p.x2 - p.x1, ay = p.y2 - p.y1, L2 = ax * ax + ay * ay || 1;
        const t = Math.max(0, Math.min(1, ((px - p.x1) * ax + (py - p.y1) * ay) / L2));
        const cx = p.x1 + ax * t, cy = p.y1 + ay * t, r = p.r1 + (p.r2 - p.r1) * t;
        const ex = px - cx, ey = py - cy, d = Math.hypot(ex, ey);
        if (d > Math.max(r, 0.55)) continue;
        const u = Math.min(1, d / Math.max(r, 0.55));
        put(x, y, i, p.c, toneFor(ex / (d || 1) * u, ey / (d || 1) * u, Math.sqrt(1 - u * u)));
      } else if (p.k === 'sheet') {
        if (!insidePoly(p.pts, px, py)) continue;
        let nx = 0, ny = -0.2, nz = 1;
        if (p.tilt) { nx = p.tilt[0]; ny = p.tilt[1]; }
        if (p.curve) {
          const xs = p.pts.map(q => q[0]), lo = Math.min(...xs), hi = Math.max(...xs);
          nx = ((px - lo) / ((hi - lo) || 1) * 2 - 1) * 0.85 * p.curve;
          nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        }
        put(x, y, i, p.c, toneFor(nx, ny, nz));
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
      if (owner[q] > owner[k] && tone[q] >= 0 && parts[owner[q]].k !== 'dots') {
        shadeK[k] = Math.max(0, tone[k] - (base[q] === base[k] ? 1 : 2));
        break;
      }
    }
  }
  for (let k = 0; k < N; k++) if (tone[k] >= 0) col[k] = ramp(base[k])[shadeK[k]];
  return { aw: size, ah: size, color: col };
}

export { CREATURES, PROPS, FLOATING, paintParts, ball, limb, sheet, line, dots, both };
