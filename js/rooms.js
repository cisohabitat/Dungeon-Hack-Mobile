// The shapes a room can take, and the set pieces stamped one to a floor.
// Each is drawn on a little grid of its own (see Grid), which dungeon.js lays
// into the map: what is floor, what must stay stone (a pillar, a fallen
// block, a cell's wall), where a door stands, and for a set piece where the
// way in may be dug, what lies there and what sleeps there.

/**
 * A room drawn on its own grid, w by h. Each square: 0 stone that a corridor
 * may dig through to get in, 1 floor, 2 stone that stays (a pillar, a fallen
 * block, a cell's wall), 3 a door.
 * @typedef {{ w: number, h: number, g: number[], shape: string,
 *   sealed?: boolean, mouths?: number[][], doors?: number[][], loot?: number[][],
 *   sleeper?: number[], fountain?: number[], heart?: number[], props?: {x: number, y: number, k: string}[] }} Grid
 */

const STONE = 0, FLOOR = 1, SOLID = 2, DOOR = 3;

/** How often each shape is dealt for an ordinary room. */
const SHAPES = [['box', 34], ['colonnade', 14], ['cross', 12], ['ell', 10], ['niches', 11], ['cave', 11], ['gallery', 8]];
/**
 * How each road builds its floors. The Crypts were laid out by masons for the
 * dead: burial niches, long galleries, colonnades and crosses, the passages
 * between them cut straight, and a pillared hall at the heart of the floor.
 * The Warrens were dug by many small hands: caverns and crooked rooms, the
 * tunnels wandering and crossing one another, and a cavern for a great hall.
 * `dig` is what a square of stone costs a corridor and `grain` how much that
 * varies, so a cheap dig with a strong grain wanders; `turn` is what turning
 * costs it, `loops` how many links beyond the tree a floor has, by its rooms,
 * and `tries` how many places each room is offered (a big burrow seldom fits
 * the first, and the small rooms would crowd it out).
 */
const BUILDS = {
  plain: { shapes: SHAPES, great: null, dig: 2, grain: 1.4, turn: 1.5, loops: 1 / 5, tries: 1 },
  crypts: { shapes: [['box', 18], ['colonnade', 18], ['cross', 16], ['niches', 26], ['gallery', 22]], great: 'hall', dig: 2, grain: 0.3, turn: 4, loops: 1 / 5, tries: 2 },
  warrens: { shapes: [['box', 10], ['ell', 14], ['burrow', 62], ['cave', 10], ['niches', 4]], great: 'burrow', dig: 0.7, grain: 4, turn: 0.3, loops: 1 / 3, tries: 5 },
};

/** The set pieces, one to a floor: a block of cells, a shrine, a cistern, a hall half fallen in. */
const PIECE_IDS = ['cells', 'shrine', 'cistern', 'rubble'];

/** What is said the first time the hero steps into each. */
const PIECE_SAY = {
  cells: 'Rows of cells line a narrow aisle. Some of the doors still hold.',
  shrine: 'A shrine: a ring of pillars about a worn altar, and water in a basin at its back.',
  cistern: 'An old cistern. Pillars stand in shallow water, which carries lightning and freezes under cold.',
  rubble: 'Half this hall has come down. Something was left at the back of the fallen stone.',
};

/** @param {number} w @param {number} h @param {string} shape @returns {Grid} */
const blank = (w, h, shape, fill = FLOOR) => ({ w, h, g: new Array(w * h).fill(fill), shape });
const set = (R, x, y, v) => { if (x >= 0 && y >= 0 && x < R.w && y < R.h) R.g[y * R.w + x] = v; };
const at = (R, x, y) => (x < 0 || y < 0 || x >= R.w || y >= R.h ? STONE : R.g[y * R.w + x]);

/** The floor squares of a grid that join up with the first one found, as indices. */
function joined(R, from) {
  const seen = new Set([from]), q = [from];
  for (let i = 0; i < q.length; i++) {
    const x = q[i] % R.w, y = (q[i] / R.w) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, v = at(R, nx, ny);
      if (v !== FLOOR && v !== DOOR) continue;
      const j = ny * R.w + nx;
      if (!seen.has(j)) { seen.add(j); q.push(j); }
    }
  }
  return seen;
}
const floorCount = R => R.g.filter(v => v === FLOOR).length;

/**
 * Turned a quarter at a time (and so laid along either axis): the grid and
 * every place on it, those just outside it (a way in, a fountain) included.
 * @param {Grid} R @param {number} k @returns {Grid}
 */
function turned(R, k) {
  let out = R;
  for (let t = 0; t < (k & 3); t++) {
    const src = out, w = src.h, h = src.w;
    const to = (/** @type {number[]} */ a) => [src.h - 1 - a[1], a[0], ...a.slice(2)];
    const n = { ...src, w, h, g: new Array(w * h) };
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const [nx, ny] = to([x, y]); n.g[ny * w + nx] = src.g[y * src.w + x]; }
    for (const key of ['mouths', 'doors', 'loot']) if (src[key]) n[key] = src[key].map(to);
    if (src.sleeper) n.sleeper = to(src.sleeper);
    if (src.fountain) n.fountain = to(src.fountain);
    if (src.heart) n.heart = to(src.heart);
    if (src.props) n.props = src.props.map(p => { const [x, y] = to([p.x, p.y]); return { ...p, x, y }; });
    out = n;
  }
  return out;
}

/**
 * An ordinary room's shape: its size and what in it is floor.
 * @param {import('./rng.js').Rng} rng @param {string} shape @param {boolean} [great] the floor's great hall
 * @returns {Grid}
 */
function roomShape(rng, shape, great = false) {
  if (great) {
    // the great hall: a nave between two rows of pillars, with a walk round the edge, or a cavern
    const w = rng.int(9, 11), h = rng.int(7, 9);
    if (shape === 'cave') return cave(rng, w, h) || roomShape(rng, 'colonnade', true);
    if (shape === 'burrow') return burrow(rng, w + 1, h + 1);
    const R = blank(w, h, 'hall');
    for (let x = 2; x <= w - 3; x += 2) { set(R, x, 2, SOLID); set(R, x, h - 3, SOLID); }
    return R;
  }
  if (shape === 'colonnade') {
    // two rows of pillars, an aisle down the middle and one down each side
    const w = 7 + 2 * rng.int(0, 1), h = rng.int(5, 7), R = blank(w, h, shape);
    for (let x = 1; x <= w - 2; x += 2) { set(R, x, 1, SOLID); set(R, x, h - 2, SOLID); }
    return turned(R, rng.int(0, 1));
  }
  if (shape === 'cross') {
    const w = rng.int(5, 9), h = rng.int(5, 7), R = blank(w, h, shape);
    const cw = Math.max(1, Math.floor(w / 3)), ch = Math.max(1, Math.floor(h / 3));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x < cw || x >= w - cw) && (y < ch || y >= h - ch)) set(R, x, y, STONE);
    return R;
  }
  if (shape === 'ell') {
    const w = rng.int(5, 8), h = rng.int(5, 7), R = blank(w, h, shape);
    const cw = Math.floor(w / 2), ch = Math.floor(h / 2);
    for (let y = 0; y < ch; y++) for (let x = w - cw; x < w; x++) set(R, x, y, STONE);
    return turned(R, rng.int(0, 3));
  }
  if (shape === 'niches') {
    // a room with recesses in its walls, every other square, where things are laid
    const w = rng.int(6, 9), h = rng.int(5, 7), R = blank(w, h, shape, STONE);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) set(R, x, y, FLOOR);
    for (let x = 1; x < w - 1; x += 2) { set(R, x, 0, FLOOR); set(R, x, h - 1, FLOOR); }
    for (let y = 1; y < h - 1; y += 2) { set(R, 0, y, FLOOR); set(R, w - 1, y, FLOOR); }
    return R;
  }
  // (a cavern that would not grow is dug out as a burrow, not squared off into a box)
  if (shape === 'cave') { const w = rng.int(6, 9), h = rng.int(5, 8); return cave(rng, w, h) || burrow(rng, w + 1, h + 1); }
  if (shape === 'burrow') return burrow(rng, rng.int(7, 10), rng.int(6, 9));
  if (shape === 'gallery') {
    // long and narrow; three wide, a pillar every third square down the middle
    const w = rng.int(9, 12), h = rng.int(2, 3), R = blank(w, h, shape);
    if (h === 3) for (let x = 1; x < w - 1; x++) if (x % 3 === 1) set(R, x, 1, SOLID);
    return turned(R, rng.int(0, 1));
  }
  return blank(rng.int(3, 7), rng.int(3, 6), 'box');
}

/**
 * A burrow, the Warrens' own: dug, not grown, so its outline bulges and pinches
 * (an oval pushed out and in by three waves round it), its edges are ragged,
 * and in a big one a rock was left standing where the diggers went round it.
 * Tried a few times before it settles for a cavern.
 * @param {import('./rng.js').Rng} rng @param {number} w @param {number} h @returns {Grid}
 */
function burrow(rng, w, h) {
  for (let tries = 0; tries < 4; tries++) {
    const R = blank(w, h, 'burrow', STONE);
    const waves = [2, 3, 5].map((k, i) => ({ k, a: [0.24, 0.17, 0.1][i] * (0.6 + rng.next() * 0.8), p: rng.next() * Math.PI * 2 }));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2), th = Math.atan2(ny, nx);
      const reach = 0.95 + waves.reduce((n, wv) => n + wv.a * Math.sin(wv.k * th + wv.p), 0);
      if (Math.hypot(nx, ny) <= reach && rng.chance(0.9)) set(R, x, y, FLOOR);
    }
    // one pass to smooth the bites, not so many that it rounds off again
    const next = R.g.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(R, x + dx, y + dy) === FLOOR) n++;
      next[y * w + x] = n >= 5 ? FLOOR : n <= 2 ? STONE : R.g[y * w + x];
    }
    R.g = next;
    let best = new Set();
    const done = new Set();
    for (let i = 0; i < w * h; i++) {
      if (R.g[i] !== FLOOR || done.has(i)) continue;
      const part = joined(R, i);
      part.forEach(j => done.add(j));
      if (part.size > best.size) best = part;
    }
    for (let i = 0; i < w * h; i++) if (R.g[i] === FLOOR && !best.has(i)) R.g[i] = STONE;
    if (best.size < Math.max(12, w * h * 0.35)) continue;
    // a rock left standing, with open floor all round it, in a burrow big enough to spare it
    if (best.size >= 34) {
      const open = [...best].filter(i => { const x = i % w, y = (i / w) | 0; return [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].every(([dx, dy]) => at(R, x + dx, y + dy) === FLOOR); });
      if (open.length) { const i = rng.pick(open); R.g[i] = SOLID; }
    }
    return R;
  }
  return cave(rng, w, h) || blank(w, h, 'box');
}

/**
 * A cavern grown rather than cut: noise inside an oval, smoothed a few
 * times, and only its largest open part kept. Null if too little was left.
 * @param {import('./rng.js').Rng} rng @param {number} w @param {number} h
 */
function cave(rng, w, h) {
  const R = blank(w, h, 'cave', STONE);
  const inside = (x, y) => ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 <= 1.05;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y) && rng.chance(0.68)) set(R, x, y, FLOOR);
  for (let pass = 0; pass < 3; pass++) {
    const next = R.g.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(R, x + dx, y + dy) === FLOOR) n++;
      next[y * w + x] = inside(x, y) && n >= 5 ? FLOOR : STONE;
    }
    R.g = next;
  }
  // the biggest open part, the rest filled
  let best = new Set();
  const done = new Set();
  for (let i = 0; i < w * h; i++) {
    if (R.g[i] !== FLOOR || done.has(i)) continue;
    const part = joined(R, i);
    part.forEach(j => done.add(j));
    if (part.size > best.size) best = part;
  }
  for (let i = 0; i < w * h; i++) if (R.g[i] === FLOOR && !best.has(i)) R.g[i] = STONE;
  return best.size >= Math.max(10, w * h * 0.35) ? R : null;
}

/**
 * The hall the Heart is kept in, on the last floor: long and pillared, a nave
 * down the middle between two rows of columns, entered by one way at the near
 * end, the Heart on its dais at the far end and its keeper before it. Drawn
 * with the way in on its left; the generator lays it toward the far side of
 * the floor from the way down.
 * @param {import('./rng.js').Rng} rng @returns {Grid}
 */
function sanctum(rng) {
  const w = 11 + 2 * rng.int(0, 1), h = 7, R = blank(w, h, 'sanctum');
  R.sealed = true;
  for (let x = 2; x <= w - 3; x += 2) { set(R, x, 1, SOLID); set(R, x, h - 2, SOLID); }
  // the far corners cut away, so the end with the dais narrows toward it
  for (const y of [0, h - 1]) set(R, w - 1, y, STONE);
  R.mouths = [[-1, 3]];
  R.heart = [w - 1, 3];
  return R;
}

/**
 * A set piece, laid along either axis: its grid, how it is entered, and what
 * it holds. A sealed one is entered only by its mouths, so its walls stay
 * whole (a cell is no cell with a corridor through its back).
 * @param {import('./rng.js').Rng} rng @param {string} kind @returns {Grid}
 */
function piece(rng, kind) {
  if (kind === 'cells') {
    // an aisle with three cells either side, each behind its own door
    const w = 8, h = 7, R = blank(w, h, 'cells', SOLID);
    R.sealed = true; R.doors = []; R.loot = []; R.props = [];
    for (let x = 0; x < w; x++) set(R, x, 3, FLOOR);
    const cells = [];
    for (let c = 0; c < 3; c++) for (const top of [true, false]) {
      const xs = [3 * c, 3 * c + 1], rows = top ? [0, 1] : [5, 6];
      for (const y of rows) for (const x of xs) set(R, x, y, FLOOR);
      const dx = xs[rng.int(0, 1)];
      set(R, dx, top ? 2 : 4, DOOR); R.doors.push([dx, top ? 2 : 4]);
      // the back of the cell, away from its door
      cells.push([xs[rng.int(0, 1)], top ? 0 : 6]);
    }
    rng.shuffle(cells);
    R.loot.push(cells[0], cells[1]);
    R.sleeper = cells[2];
    R.props.push({ x: cells[3][0], y: cells[3][1], k: 'bones' }, { x: cells[4][0], y: cells[4][1], k: 'bones' });
    R.mouths = [[-1, 3], [w, 3]];
    return turned(R, rng.int(0, 1));
  }
  if (kind === 'shrine') {
    // round-ish, a ring of pillars about the altar, a basin let into the far wall
    const w = 7, h = 7, R = blank(w, h, 'shrine');
    R.sealed = true;
    for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) for (const [fx, fy] of [[x, y], [w - 1 - x, y], [x, h - 1 - y], [w - 1 - x, h - 1 - y]]) set(R, fx, fy, STONE);
    for (const [x, y] of [[1, 2], [5, 2], [1, 4], [5, 4], [2, 1], [4, 1], [2, 5], [4, 5]]) set(R, x, y, SOLID);
    R.loot = [[3, 3]];
    R.props = [[2, 2], [4, 2], [2, 4], [4, 4]].map(([x, y]) => ({ x, y, k: 'candles' }));
    R.fountain = [3, -1];
    R.mouths = [[-1, 3], [w, 3], [3, h]];
    return turned(R, rng.int(0, 3));
  }
  if (kind === 'cistern') {
    // pillars standing in shallow water
    const w = 9, h = 7, R = blank(w, h, 'cistern');
    for (const x of [2, 4, 6]) for (const y of [2, 4]) set(R, x, y, SOLID);
    R.props = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(R, x, y) === FLOOR && rng.chance(0.6)) R.props.push({ x, y, k: 'puddle' });
    R.loot = [[rng.pick([0, w - 1]), rng.pick([0, h - 1])]];
    return turned(R, rng.int(0, 1));
  }
  // rubble: a hall half fallen in, with a nook at the back of the stone
  const w = 9, h = 6, R = blank(w, h, 'rubble');
  for (let tries = 0, laid = 0; tries < 80 && laid < 15; tries++) {
    const x = rng.int(0, w - 1), y = rng.int(0, h - 1);
    if (at(R, x, y) !== FLOOR) continue;
    set(R, x, y, SOLID);
    const first = R.g.indexOf(FLOOR);
    if (joined(R, first).size !== floorCount(R)) { set(R, x, y, FLOOR); continue; }
    laid++;
  }
  // the nook: the open square with the most stone about it
  let nook = null, most = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(R, x, y) !== FLOOR) continue;
    const n = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => at(R, x + dx, y + dy) !== FLOOR).length;
    if (n > most) { most = n; nook = [x, y]; }
  }
  R.loot = nook ? [nook] : [];
  R.props = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(R, x, y) === FLOOR && !(nook && nook[0] === x && nook[1] === y) && rng.chance(0.18)) R.props.push({ x, y, k: 'rubble' });
  return turned(R, rng.int(0, 1));
}

export { SHAPES, BUILDS, PIECE_IDS, PIECE_SAY, roomShape, piece, sanctum, STONE, FLOOR, SOLID, DOOR };
