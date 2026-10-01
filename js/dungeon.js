import { Rng } from './rng.js';
import { ITEMS, MONSTERS, GEMS, ELITES, JOURNAL, THEMES, ROUTES, WALL_PROPS } from './data.js';
import { encounterPlan } from './encounters.js';
import { GEAR_POWERS, GEAR_PREFIXES } from './relics.js';

/** Creatures that go about in twos and threes. */
const PACK_KINDS = ['goblin', 'rat', 'skeleton', 'bat'];
const TIER_FLOORS = 10;   // the monster tiers are laid out over this many floors
/**
 * Where on the ladder of monster tiers a floor of a delve sits: a delve
 * shorter than the ladder is stretched over it, the stretch coming late.
 * @param {number} depth @param {number} levels
 */
function tierAt(depth, levels) {
  if (levels >= TIER_FLOORS) return depth;
  const f = levels > 1 ? (depth - 1) / (levels - 1) : 0;
  return depth + (TIER_FLOORS - levels) * f * f;
}

/**
 * Which named champion holds which floor of a delve: one about a third of the
 * way down and one about two thirds, never the first floor (where the
 * controls are learned) nor the lich's. Each is chosen by the seed from those
 * whose stretch of the ladder takes in that floor's; where none does, the
 * nearest. The same seed and length always give the same champions.
 * @param {string} seed @param {number} levels
 * @returns {Record<number, string>}
 */
// How often a room's finds are gathered onto one square, and how many at most
const TOGETHER = 0.4, TOGETHER_MOST = 3;

/**
 * Where the stair divides, and which floors follow the road taken: the fork
 * about a third of the way down, and every floor after it but the last two
 * (the one before the lich's, and the lich's own). None in a delve shorter
 * than six floors.
 * @returns {{fork: number, from: number, to: number}|null}
 */
function routeSpan(levels) {
  if (levels < 6) return null;
  const fork = Math.max(2, Math.round(levels * 0.35));
  return { fork, from: fork + 1, to: levels - 2 };
}
/** @param {string} seed @param {number} levels @param {string} [route] */
function namedPlan(seed, levels, route) {
  const rng = new Rng(`${seed}|named`);
  const ids = Object.keys(MONSTERS).filter(id => MONSTERS[id].named);
  /** @type {Record<number, string>} */
  const plan = {};
  // a long delve (twelve floors or more) has three: a quarter, half and three quarters of the way down
  const depths = levels >= 12 ? [Math.ceil(levels / 4), Math.ceil(levels / 2), Math.ceil(levels * 3 / 4)] : [Math.ceil(levels / 3), Math.ceil(levels * 2 / 3)];
  for (const depth of new Set(depths)) {
    if (depth <= 1 || depth >= levels) continue;
    const t = tierAt(depth, levels);
    const free = ids.filter(id => !Object.values(plan).includes(id));
    const off = id => Math.max(0, MONSTERS[id].tier[0] - t, t - MONSTERS[id].tier[1]);
    const fit = free.filter(id => off(id) === 0);
    plan[depth] = fit.length ? rng.pick(fit) : free.sort((a, b) => off(a) - off(b))[0];
  }
  // down one road, a champion on its floors is one of that road's own (its own dice, so the rest is unmoved)
  const span = routeSpan(levels), R = route && ROUTES[route];
  if (span && R) {
    const rrng = new Rng(`${seed}|named|${route}`);
    for (const d of Object.keys(plan).map(Number)) {
      if (d < span.from || d > span.to || R.champions.includes(plan[d])) continue;
      const t = tierAt(d, levels);
      const free = R.champions.filter(id => !Object.values(plan).includes(id));
      if (!free.length) continue;
      const off = id => Math.max(0, MONSTERS[id].tier[0] - t, t - MONSTERS[id].tier[1]);
      const fit = free.filter(id => off(id) === 0);
      plan[d] = fit.length ? rrng.pick(fit) : free.sort((a, b) => off(a) - off(b))[0];
    }
  }
  return plan;
}

/**
 * Now and then a middle floor is not quite as the others: its torches burnt
 * out, black water standing in it, its dead restless, or goblins holding a
 * market there. Decided by the seed for the whole run: never the first floor
 * or the last two, never a champion's floor, never two floors running, and
 * about one eight-floor run in seven has none.
 * @returns {Record<number, string>} plan[depth] = twist id
 */
const TWIST_IDS = ['dark', 'flooded', 'restless', 'market'];
/** @param {string} seed @param {number} levels @param {boolean} [grow] false leaves out the overgrown floors (for the rules' own checks) */
function twistPlan(seed, levels, grow = true) {
  const rng = new Rng(`${seed}|twists`);
  const named = namedPlan(seed, levels);
  const ids = rng.shuffle(TWIST_IDS.slice());
  const most = Math.max(1, Math.floor(levels / 4));
  /** @type {Record<number, string>} */
  const plan = {};
  let n = 0;
  // the floors are tried in a shuffled order, not top down: taken in order the
  // second floor was twisted in half of all runs and nearly every run with two.
  // A goblin market wants a purse to spend, so it is never on the second floor.
  const floors = rng.shuffle(Array.from({ length: Math.max(0, levels - 3) }, (_, i) => i + 2));
  for (const d of floors) {
    if (n >= most) break;
    if (named[d] || plan[d - 1] || plan[d + 1]) continue;
    if (rng.next() >= 0.5) continue;
    const id = ids[n % ids.length];
    if (id === 'market' && d < 3) continue;
    plan[d] = id; n++;
  }
  // a fifth, overgrown, is dealt from dice of its own over the floors already
  // twisted, so which floors those are, and all the rest, fall as they always did
  const moss = new Rng(`${seed}|overgrown`);
  if (grow) for (const d of Object.keys(plan).map(Number).sort((a, b) => a - b)) if (plan[d] !== 'market' && moss.next() < OVERGROWN_SHARE) plan[d] = 'overgrown';
  // and a sixth, tremors, the same way over what is left, from the third floor
  // down: the roof needs some weight of rock over it before it starts to come in
  const rock = new Rng(`${seed}|tremors`);
  if (grow) for (const d of Object.keys(plan).map(Number).sort((a, b) => a - b)) if (d >= 3 && ['dark', 'flooded', 'restless'].includes(plan[d]) && rock.next() < TREMORS_SHARE) plan[d] = 'tremors';
  // and one deep floor in a few runs smoulders: dealt from dice of its own over the last quarter
  // of the delve (never the deepest, nor a champion's floor, nor beside a floor already twisted)
  const heat = new Rng(`${seed}|smoulder`);
  if (grow && heat.next() < SMOULDER_SHARE) {
    const deep = [];
    for (let d = Math.max(3, Math.ceil(levels * 0.75)); d <= levels - 1; d++) if (!plan[d] && !plan[d - 1] && !plan[d + 1] && !named[d]) deep.push(d);
    if (deep.length) plan[deep[Math.floor(heat.next() * deep.length)]] = 'smouldering';
  }
  return plan;
}
const OVERGROWN_SHARE = 0.25, TREMORS_SHARE = 0.25, SMOULDER_SHARE = 0.4;

// Procedural dungeon generator. Deterministic per (seed, depth).

const Dungeon = (() => {
  const T = { FLOOR: 0, WALL: 1, DOOR: 2, DOOR_OPEN: 3, DOOR_LOCKED: 4, STAIRS_DOWN: 5, STAIRS_UP: 6, SECRET: 7, FOUNTAIN: 8, TORCH: 9 };
  const SIZES = { small: 28, medium: 36, large: 44 };
  const KEY_ORDER = ['brass', 'silver', 'gold', 'iron', 'bone'];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  /**
   * Build one floor. The same seed and depth always give the same floor.
   * @param {string} seed
   * @param {number} depth
   * @param {import('./types.js').DungeonOptions} opts
   * @returns {import('./types.js').Level}
   */
  function generate(seed, depth, opts) {
    const rng = new Rng(`${seed}#${depth}`);
    const w = SIZES[opts.size] || 36, h = w;
    const tiles = new Array(w * h).fill(T.WALL);
    const roomId = new Array(w * h).fill(-1);
    const idx = (x, y) => y * w + x;
    const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? T.WALL : tiles[idx(x, y)];
    const isFinal = depth >= opts.levels;
    // a twist is dealt from its own seed, so a floor without one is exactly as it always was
    const twist = twistPlan(seed, opts.levels || 8)[depth] || null;
    // past the fork, the floors follow the road the hero took
    const span = routeSpan(opts.levels || 8);
    const route = span && opts.route && ROUTES[opts.route] && depth >= span.from && depth <= span.to ? opts.route : null;
    const otherRoad = route && Object.keys(ROUTES).find(k => k !== route);
    const lean = id => !route ? 1 : ROUTES[route].kin.includes(id) ? 3 : ROUTES[otherRoad].kin.includes(id) ? 1 / 3 : 1;

    // ---- rooms ----
    const rooms = [];
    const maxRooms = Math.floor(w * h / 70);
    for (let a = 0; a < 500 && rooms.length < maxRooms; a++) {
      const rw = rng.int(3, 7), rh = rng.int(3, 6);
      const rx = rng.int(2, w - rw - 3), ry = rng.int(2, h - rh - 3);
      let ok = true;
      for (const r of rooms) {
        if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    rooms.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
    rooms.forEach((r, id) => {
      r.id = id;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { tiles[idx(x, y)] = T.FLOOR; roomId[idx(x, y)] = id; }
    });

    // ---- corridors ----
    const carve = (x, y) => {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return;
      if (tiles[idx(x, y)] === T.WALL) tiles[idx(x, y)] = T.FLOOR;
    };
    function corridor(a, b) {
      let x = a.cx, y = a.cy;
      const goX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } };
      const goY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
      if (rng.chance(0.5)) { goX(); goY(); } else { goY(); goX(); }
    }
    for (let i = 1; i < rooms.length; i++) corridor(rooms[i - 1], rooms[i]);
    const extra = Math.max(1, Math.floor(rooms.length / 4));
    for (let i = 0; i < extra; i++) corridor(rng.pick(rooms), rng.pick(rooms));

    // ---- doors ----
    const doors = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y);
        if (tiles[i] !== T.FLOOR || roomId[i] !== -1) continue;
        const l = get(x - 1, y), r = get(x + 1, y), u = get(x, y - 1), dn = get(x, y + 1);
        const vertical = l === T.WALL && r === T.WALL && u !== T.WALL && dn !== T.WALL;
        const horizontal = u === T.WALL && dn === T.WALL && l !== T.WALL && r !== T.WALL;
        if (!vertical && !horizontal) continue;
        const n1 = vertical ? roomId[idx(x, y - 1)] : roomId[idx(x - 1, y)];
        const n2 = vertical ? roomId[idx(x, y + 1)] : roomId[idx(x + 1, y)];
        if ((n1 === -1) === (n2 === -1)) continue;
        if ([l, r, u, dn].some(t => t === T.DOOR)) continue;
        if (rng.chance(0.75)) { tiles[i] = T.DOOR; doors.push({ x, y }); }
      }
    }

    // ---- BFS helper ----
    function bfs(sx, sy, lockedSolid) {
      const dist = new Int32Array(w * h).fill(-1);
      const q = [idx(sx, sy)];
      dist[q[0]] = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = idx(nx, ny);
          if (dist[ni] >= 0) continue;
          const t = tiles[ni];
          if (t === T.WALL || t === T.STAIRS_DOWN || t === T.STAIRS_UP) continue;
          if (t === T.DOOR_LOCKED && lockedSolid) continue;
          dist[ni] = dist[i] + 1;
          q.push(ni);
        }
      }
      return dist;
    }

    // ---- stairs slots (a wall tile on a room's edge, facing into the room) ----
    function wallSlot(room, relaxed) {
      // `relaxed` drops the tidiness requirements. The strict pass wants a wall
      // that touches exactly one floor square and no door, which reads best; the
      // relaxed pass takes any wall the room touches, so that a room can always
      // yield somewhere to put a staircase.
      const cands = [];
      const tryS = (sx, sy, fx, fy, dir) => {
        if (get(sx, sy) !== T.WALL) return;
        let floors = 0, doorAdj = false;
        for (const [dx, dy] of DIRS) {
          const t = get(sx + dx, sy + dy);
          if (t !== T.WALL) floors++;
          if (t === T.DOOR) doorAdj = true;
        }
        if (relaxed ? floors >= 1 : (floors === 1 && !doorAdj)) cands.push({ x: sx, y: sy, fx, fy, dir });
      };
      for (let x = room.x; x < room.x + room.w; x++) {
        tryS(x, room.y - 1, x, room.y, 2);
        tryS(x, room.y + room.h, x, room.y + room.h - 1, 0);
      }
      for (let y = room.y; y < room.y + room.h; y++) {
        tryS(room.x - 1, y, room.x, y, 1);
        tryS(room.x + room.w, y, room.x + room.w - 1, y, 3);
      }
      return cands.length ? rng.pick(cands) : null;
    }

    let startRoom = null, upSlot = null;
    for (const r of rooms) { upSlot = wallSlot(r); if (upSlot) { startRoom = r; break; } }
    // No room offered a tidy slot. Rather than fail to build the level at all,
    // take any wall a room touches; every room has at least one.
    if (!upSlot) {
      for (const r of rooms) { upSlot = wallSlot(r, true); if (upSlot) { startRoom = r; break; } }
    }
    if (!upSlot) throw new Error(`cannot place the entrance stair on level ${depth} of "${seed}"`);
    tiles[idx(upSlot.x, upSlot.y)] = T.STAIRS_UP;
    const start = { x: upSlot.fx, y: upSlot.fy, dir: upSlot.dir };

    const dist0 = bfs(start.x, start.y, false);
    const byDist = rooms.filter(r => r !== startRoom).sort((a, b) => dist0[idx(b.cx, b.cy)] - dist0[idx(a.cx, a.cy)]);
    let farRoom = byDist[0] || startRoom;
    let downStart = null, stairsDown = null;
    if (!isFinal) {
      for (const relaxed of [false, true]) {
        if (downStart) break;
        for (const r of byDist) {
          const s = wallSlot(r, relaxed);
          if (s) { farRoom = r; tiles[idx(s.x, s.y)] = T.STAIRS_DOWN; stairsDown = { x: s.x, y: s.y }; downStart = { x: s.fx, y: s.fy, dir: s.dir }; break; }
        }
      }
      if (!downStart) throw new Error(`cannot place the exit stair on level ${depth} of "${seed}"`);
    }

    // ---- items & locked doors ----
    const items = {};
    const addItem = (x, y, it) => { const k = x + ',' + y; (items[k] = items[k] || []).push(it); };
    const locks = {};
    if (opts.lockedDoors && doors.length) {
      const nLock = Math.min(rng.int(1, 3), doors.length, KEY_ORDER.length);
      const shuffled = rng.shuffle(doors.slice());
      let placed = 0;
      for (const dr of shuffled) {
        if (placed >= nLock) break;
        const di = idx(dr.x, dr.y);
        if (tiles[di] !== T.DOOR) continue;
        tiles[di] = T.DOOR_LOCKED;
        const reach = bfs(start.x, start.y, true);
        // the door must border the reachable side, otherwise it is pointless
        const borders = DIRS.some(([dx, dy]) => reach[idx(dr.x + dx, dr.y + dy)] >= 0);
        const cands = [];
        for (let i = 0; i < w * h; i++) {
          if (reach[i] >= 0 && roomId[i] >= 0 && !(i === idx(start.x, start.y))) cands.push(i);
        }
        if (!borders || !cands.length) { tiles[di] = T.DOOR; continue; }
        const color = KEY_ORDER[placed];
        locks[dr.x + ',' + dr.y] = color;
        const ci = rng.pick(cands);
        addItem(ci % w, (ci / w) | 0, { t: 'key', color, q: 1 });
        placed++;
      }
    }

    // ---- traps ----
    const traps = {};
    if (opts.traps) {
      const n = rng.int(1, 2) + Math.floor(depth / 2);
      const cands = [];
      for (let i = 0; i < w * h; i++) {
        if (tiles[i] !== T.FLOOR || roomId[i] !== -1 || dist0[i] < 4) continue;
        const x = i % w, y = (i / w) | 0;
        if (DIRS.some(([dx, dy]) => { const t = get(x + dx, y + dy); return t === T.DOOR || t === T.DOOR_LOCKED; })) continue;
        cands.push(i);
      }
      rng.shuffle(cands);
      for (let i = 0; i < Math.min(n, cands.length); i++) {
        const c = cands[i];
        traps[(c % w) + ',' + ((c / w) | 0)] = rng.weighted([['dart', 40], ['needle', 25], ['pit', 20 + depth * 2], ['alarm', 15]]);
      }
    }

    // ---- monsters ----
    const monsters = [];
    const occupied = new Set([idx(start.x, start.y)]);
    let uid = 1;
    const makeMonster = (id, x, y, dice = rng) => {
      const b = MONSTERS[id];
      const hp = dice.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((depth - 1) / 2);
      occupied.add(idx(x, y));
      return { uid: depth * 1000 + uid++, id, x, y, hp, maxHp: hp, awake: false, nextAct: 0, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 };
    };
    // Promote a monster to a named champion: tougher, and worth more when it falls.
    const makeElite = m => {
      m.elite = rng.pick(ELITES).prefix;
      const e = ELITES.find(x => x.prefix === m.elite);
      m.maxHp = Math.round(m.maxHp * e.hp);
      m.hp = m.maxHp;
      return m;
    };
    // Which creatures a floor holds goes by how far through the delve it is,
    // not its bare number: the tiers are laid out over ten floors, so an
    // eight-floor delve used to end before the minotaur's tier began, and
    // met the troll only on its last floor. A shorter delve stretches over
    // the same ladder, the stretch coming late (its first floors much as
    // they were, its last at the ladder's foot); a longer one keeps its floors.
    const tierDepth = tierAt(depth, opts.levels || 8);
    // (neither the lich nor a named champion is met at random)
    let pool = Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss && !MONSTERS[id].named && tierDepth >= MONSTERS[id].tier[0] && tierDepth <= MONSTERS[id].tier[1]);
    if (!pool.length) pool = Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss && !MONSTERS[id].named && !MONSTERS[id].shade).sort((a, b) => MONSTERS[b].xp - MONSTERS[a].xp).slice(0, 3);
    // The first floor is where the controls are learned, so a crowded setting
    // starts from the second: at full density a third to a half of runs on
    // Many ended before the stairs were found, most at character level one.
    const density = Math.min({ few: 0.6, normal: 1.0, many: 1.6 }[opts.monsters] || 1, depth === 1 ? 1.0 : Infinity);
    // (the lich's floor holds a quarter fewer: the danger there is meant to be the lich)
    const count = Math.round((Math.round(rooms.length * density * 0.85) + Math.floor(depth / 3)) * (isFinal ? 0.75 : 1));
    const mCands = [];
    for (let i = 0; i < w * h; i++) {
      if (tiles[i] !== T.FLOOR || dist0[i] < 5) continue;
      if (roomId[i] === startRoom.id) continue;
      if (roomId[i] >= 0 || rng.chance(0.25)) mCands.push(i);
    }
    rng.shuffle(mCands);
    for (let i = 0; i < count && i < mCands.length; i++) {
      const c = mCands[i];
      if (occupied.has(c)) continue;
      // deeper levels favour the tougher end of the pool
      const weighted = pool.map(id => [id, (1 + Math.max(0, tierDepth - MONSTERS[id].tier[0])) * lean(id) * (tierDepth < (MONSTERS[id].shy || 0) ? 1 / 3 : 1)]);
      const m = makeMonster(rng.weighted(weighted), c % w, (c / w) | 0);
      // champions appear more often the deeper you go
      // no champions on the first floor: a Rabid goblin swinging nearly twice
      // as fast was the commonest way a level-one hero died there
      if (rng.chance(depth === 1 ? 0 : Math.min(0.2, 0.02 + depth * 0.018))) makeElite(m);
      monsters.push(m);
    }

    // ---- groups ----
    // From the second floor down, pack creatures share a square: in twos,
    // and in threes deeper. A stream of its own, so the layout, monsters and
    // loot fall where they did (a trader or encounter may stand a square
    // over, since the squares freed here change their choice of spot). For
    // every extra body a lone monster is taken away, the same kind first and
    // otherwise the weakest, so a floor holds about as many as before,
    // gathered together.
    if (depth >= 2) {
      const grng = new Rng(`${seed}|packs|${depth}`);
      const most = depth >= 5 ? 3 : 2;
      for (const m of monsters.slice()) {
        if (!PACK_KINDS.includes(m.id) || m.elite || m.pack || !monsters.includes(m) || !grng.chance(0.3)) continue;
        const extra = most === 3 && grng.chance(0.4) ? 2 : 1;
        const loners = monsters.filter(o => o !== m && !o.pack && !o.elite)
          .sort((a, b) => Number(b.id === m.id) - Number(a.id === m.id) || MONSTERS[a.id].xp - MONSTERS[b.id].xp);
        if (loners.length < extra) continue;
        m.pack = [];
        for (let k = 0; k < extra; k++) {
          const b = MONSTERS[m.id], hp = grng.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((depth - 1) / 2);
          m.pack.push({ hp, maxHp: hp });
          const gone = loners.shift();
          monsters.splice(monsters.indexOf(gone), 1);
          occupied.delete(idx(gone.x, gone.y));
        }
      }
    }

    // ---- loot ----
    // an easy delve leaves more lying about
    const treasure = ({ scarce: 0.6, normal: 1.0, rich: 1.6 }[opts.treasure] || 1) * (opts.difficulty === 'easy' ? 1.3 : 1);
    const nItems = Math.round(rooms.length * treasure * 0.8) + 2;
    const roomTiles = [];
    for (let i = 0; i < w * h; i++) if (tiles[i] === T.FLOOR && roomId[i] >= 0 && i !== idx(start.x, start.y)) roomTiles.push(i);
    const dropAt = it => { const c = rng.pick(roomTiles); addItem(c % w, (c / w) | 0, it); };
    for (let i = 0; i < nItems; i++) dropAt(rollLoot(rng, depth));
    // a page left by the crews who came first, so the story unfolds as you descend
    if (depth >= 1 && depth <= JOURNAL.length) dropAt({ t: 'page', q: 1, page: depth - 1 });
    dropAt({ t: 'ration', q: 1 });
    dropAt({ t: 'ration', q: 1 });
    dropAt({ t: 'potion_heal', q: 1 });

    // ---- torches: wall brackets that light corridors and rooms ----
    const lights = [];
    {
      const cands = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (tiles[idx(x, y)] !== T.WALL) continue;
        let openSides = 0, dir = -1;
        for (let k = 0; k < 4; k++) {
          const t = get(x + DIRS[k][0], y + DIRS[k][1]);
          if (t === T.FLOOR) { openSides++; dir = k; }
        }
        if (openSides === 1) cands.push({ x, y, dir });
      }
      rng.shuffle(cands);
      // a dark floor keeps a torch in four
      const want = Math.round((Math.round(rooms.length * 0.9) + 4) * (twist === 'dark' ? 0.25 : 1));
      const minGap = 5;
      for (const c of cands) {
        if (lights.length >= want) break;
        if (lights.some(l => Math.abs(l.x - c.x) + Math.abs(l.y - c.y) < minGap)) continue;
        tiles[idx(c.x, c.y)] = T.TORCH;
        // the lit tile is the floor the torch faces
        lights.push({ x: c.x + DIRS[c.dir][0], y: c.y + DIRS[c.dir][1] });
      }
    }

    // ---- features: fountains and secret vaults ----
    const features = {};
    if (rng.chance(0.55)) {
      const cands = rng.shuffle(rooms.filter(r => r !== startRoom));
      for (const r of cands) {
        const s = wallSlot(r);
        if (!s) continue;
        tiles[idx(s.x, s.y)] = T.FOUNTAIN;
        features[s.x + ',' + s.y] = { type: 'fountain', used: false };
        break;
      }
    }
    const nVaults = rng.int(0, 2) + (depth >= 3 ? 1 : 0);
    for (let v = 0, tries = 0; v < nVaults && tries < 40; tries++) {
      const r = rng.pick(rooms);
      const s = wallSlot(r);
      if (!s) continue;
      const od = DIRS[(s.dir + 2) % 4]; // direction away from the room
      const cx = s.x + od[0] * 2, cy = s.y + od[1] * 2;
      let ok = true;
      for (let yy = cy - 2; yy <= cy + 2 && ok; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) {
        if (xx === s.x && yy === s.y) continue;
        if (xx <= 0 || yy <= 0 || xx >= w - 1 || yy >= h - 1 || tiles[idx(xx, yy)] !== T.WALL) { ok = false; break; }
      }
      if (!ok) continue;
      for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) tiles[idx(xx, yy)] = T.FLOOR;
      tiles[idx(s.x, s.y)] = T.SECRET;
      addItem(cx, cy, { t: 'gold', q: rng.int(20, 40) * depth });
      addItem(cx + od[0], cy + od[1], rollLoot(rng, depth + 2));
      addItem(cx - od[1], cy + od[0], rollLoot(rng, depth + 1));
      if (rng.chance(0.4)) monsters.push(makeMonster(rng.pick(pool), cx + od[1], cy - od[0]));
      v++;
    }

    // ---- who may stand where ----
    // Traders and encounter props are solid, so none of them may be the one
    // square holding the level together. Locked doors make that two questions,
    // not one: a square can be harmless once every key is found and still
    // seal off the key itself, so reach is counted both with locked doors shut
    // and with them open. Everything already standing counts as a wall, or two
    // props could together seal what neither would alone.
    const npcs = [];
    const reach = (extra, lockedPassable) => {
      const standing = new Set(npcs.map(n => idx(n.x, n.y)));
      if (extra >= 0) standing.add(extra);
      const seen = new Uint8Array(w * h);
      const q = [idx(start.x, start.y)];
      seen[q[0]] = 1;
      let n = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % w, y = (i / w) | 0;
        n++;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = idx(nx, ny);
          if (seen[ni] || standing.has(ni)) continue;
          const t = tiles[ni];
          if (t === T.WALL || t === T.SECRET || t === T.FOUNTAIN || t === T.TORCH || t === T.STAIRS_UP) continue;
          if (t === T.DOOR_LOCKED && !lockedPassable) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      return n;
    };
    // standing there may remove its own square from reach, and nothing more
    const harmless = i => reach(-1, true) - reach(i, true) === 1 && reach(-1, false) - reach(i, false) <= 1;

    // Where nothing that stands still may stand: beside a door or a secret
    // door, in a room's open mouth, or in front of a stair or a fountain. The
    // floor stays whole without it (harmless() sees to that), but a trader in
    // a doorway still blocked that way through, and one before the stairs
    // could stand between the hero and them.
    const USED = [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN];
    const inTheWay = (x, y) => {
      const here = roomId[idx(x, y)];
      return DIRS.some(([dx, dy]) => {
        const t = get(x + dx, y + dy);
        return USED.includes(t) || (t === T.FLOOR && roomId[idx(x + dx, y + dy)] !== here);
      });
    };

    // ---- a merchant, so the gold you haul up is worth something ----
    // two floors of every delve always have one, so the gold hauled up has somewhere to go:
    // two fifths of the way down, and the floor before the last
    const sureTrader = depth === Math.round((opts.levels || 8) * 0.4) || depth === (opts.levels || 8) - 1;
    if (!isFinal && depth > 1 && (rng.chance(0.45) || sureTrader || twist === 'market')) {
      const cands = rooms.filter(r => r !== startRoom);
      for (const r of rng.shuffle(cands.slice())) {
        const spots = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          if (tiles[idx(x, y)] === T.FLOOR && !occupied.has(idx(x, y)) && !traps[x + ',' + y] && !items[x + ',' + y] && !inTheWay(x, y)) spots.push([x, y]);
        }
        if (!spots.length) continue;
        let chosen = null;
        for (const [sx, sy] of rng.shuffle(spots.slice())) {
          if (harmless(idx(sx, sy))) { chosen = [sx, sy]; break; }
        }
        if (!chosen) continue;   // every spot in this room is a chokepoint
        const [mx, my] = chosen;
        occupied.add(idx(mx, my));
        // monsters must not be standing on top of the shop
        for (let i = monsters.length - 1; i >= 0; i--) {
          if (Math.abs(monsters[i].x - mx) + Math.abs(monsters[i].y - my) <= 1) monsters.splice(i, 1);
        }
        const stock = [];
        const shelf = [
          ['potion_heal', 40], ['potion_xheal', 12 + depth * 2], ['potion_cure', 14], ['potion_might', 10],
          ['potion_mana', 12], ['scroll_heal', 12], ['scroll_fire', 10], ['scroll_map', 12], ['scroll_teleport', 8],
          ['ration', 26], ['meat', 14], ['oil_fire', 6], ['oil_silver', depth >= 3 ? 6 : 2], ['oil_venom', 5],
          ['charm_collar', 2], ['charm_fang', 2], ['charm_rowan', 2],
          // a Crypts trader keeps more for curses, venom and the dead; a Warrens one for blades
          ...(route === 'crypts' ? [['potion_cure', 20], ['scroll_uncurse', 16], ['oil_silver', 10]] : []),
          ...(route === 'warrens' ? [['oil_fire', 8], ['oil_venom', 8]] : []),
        ];
        const n = rng.int(4, 6);
        for (let i = 0; i < n; i++) {
          const t = rng.weighted(shelf);
          const ex = stock.find(s => s.t === t);
          if (ex) ex.q++; else stock.push({ t, q: 1, e: 0 });
        }
        // one piece of gear, sometimes enchanted, priced accordingly (a Warrens trader deals in arms: two)
        const maxTier = 1 + Math.floor(depth / 2);
        for (let g = 0; g < (route === 'warrens' ? 2 : 1); g++) {
          const gearKind = rng.weighted([['weapon', 5], ['armor', 3], ['shield', 2]]);
          const gearIds = Object.keys(ITEMS).filter(id => ITEMS[id].kind === gearKind && ITEMS[id].tier <= maxTier + 1 && ITEMS[id].weight !== 'cloth' && !ITEMS[id].focus);
          if (gearIds.length) {
            const piece = { t: rng.weighted(gearIds.map(id => [id, ITEMS[id].tier])), q: 1, e: rng.chance(0.3) ? 1 : 0 };
            // an enchanted piece past the first floor sometimes has a power as well
            if (piece.e && depth >= 2) { const pool = GEAR_POWERS[gearKind]; const f = (piece.t.length * 0.137 + depth * 0.311 + mx * 0.071 + my * 0.053) % 1; if (f < 0.5) piece.pw = pool[Math.floor(f * 2 * pool.length) % pool.length]; }
            stock.push(piece);
          }
        }
        // a goblin market undersells: there is competition
        const markup = (twist === 'market' ? 1.35 : 1.8) + rng.next() * (twist === 'market' ? 0.3 : 0.6);
        npcs.push({ id: 'merchant', x: mx, y: my, stock, markup, greeted: false });
        break;
      }
    }

    // ---- encounters: the dungeon asks something of you ----
    // Which ones sit on this floor is decided for the whole run by the seed
    // (see encounters.js). Where they stand uses a stream of its own, so
    // adding them does not move anything else on a seed's level.
    const erng = new Rng(`${seed}|encounter-spots|${depth}`);
    // the road's own encounter waits on its first floor
    const encHere = [...(encounterPlan(seed, opts.levels || 8, tierAt)[depth] || []), ...(route && depth === span.from ? [ROUTES[route].encounter] : [])];
    for (const encId of encHere) {
      let placed = false;
      // the last floor's vigil lamp stands at the edge of the lich's hall, in
      // the nearest room to it but never in it, so the gold found on the way
      // there still counts; the room you come in by only if nothing else will do
      let roomsFor;
      if (encId === 'vigil') {
        const toHall = bfs(farRoom.cx, farRoom.cy, false);
        const far = r => { const v = toHall[idx(r.cx, r.cy)]; return v < 0 ? Infinity : v; };
        roomsFor = rooms.filter(rr => rr !== startRoom && rr !== farRoom).sort((a, b) => far(a) - far(b)).concat([startRoom]);
      } else roomsFor = erng.shuffle(rooms.filter(rr => rr !== startRoom));
      for (const r of roomsFor) {
        const spots = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const i = idx(x, y);
          if (tiles[i] !== T.FLOOR || occupied.has(i) || traps[x + ',' + y] || items[x + ',' + y] || (x === start.x && y === start.y)) continue;
          // not in a doorway's mouth, where it would read as a wall across the way in, nor before a stair or fountain
          if (inTheWay(x, y)) continue;
          spots.push([x, y]);
        }
        for (const [sx, sy] of erng.shuffle(spots)) {
          if (!harmless(idx(sx, sy))) continue;
          npcs.push({ id: encId, kind: 'encounter', x: sx, y: sy });
          occupied.add(idx(sx, sy));
          for (let i = monsters.length - 1; i >= 0; i--) {
            if (Math.abs(monsters[i].x - sx) + Math.abs(monsters[i].y - sy) <= 1) monsters.splice(i, 1);
          }
          placed = true;
          break;
        }
        if (placed) break;
      }
    }

    // ---- a named champion's lair ----
    // Asleep in a room well away from the way in, and not the stairs' room,
    // so it is a fight sought or stumbled into rather than a gate. Whatever
    // already stood in the room gives way to it and the kin it keeps. A
    // stream of its own, so nothing else on a seed's floor moves.
    const namedId = namedPlan(seed, opts.levels || 8, opts.route)[depth];
    if (namedId && !isFinal) {
      const nrng = new Rng(`${seed}|named-lair|${depth}`);
      const held = new Set(npcs.map(n => idx(n.x, n.y)));
      const inRoom = (r, i) => { const x = i % w, y = (i / w) | 0; return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; };
      const open = r => {
        const out = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const i = idx(x, y);
          if (tiles[i] === T.FLOOR && dist0[i] >= 0 && !held.has(i) && !traps[x + ',' + y]) out.push(i);
        }
        return out;
      };
      // not in a room someone keeps, nor a few steps from the trader's, whose
      // shop would be a door to duck through mid-fight
      const shop = npcs.find(n => n.id === 'merchant'), M = 5;
      const kept = r => npcs.some(n => inRoom(r, idx(n.x, n.y)));
      const byShop = r => !!shop && shop.x >= r.x - M && shop.x < r.x + r.w + M && shop.y >= r.y - M && shop.y < r.y + r.h + M;
      const fits = r => open(r).length >= 3;
      // the stairs' room only when no other room will hold it at all
      const pickLair = ok => byDist.find(r => r !== farRoom && fits(r) && ok(r));
      const lair = pickLair(r => !kept(r) && !byShop(r)) || pickLair(r => !kept(r)) || pickLair(() => true) || (fits(farRoom) ? farRoom : null);
      if (lair) {
        for (let i = monsters.length - 1; i >= 0; i--) if (inRoom(lair, idx(monsters[i].x, monsters[i].y))) { occupied.delete(idx(monsters[i].x, monsters[i].y)); monsters.splice(i, 1); }
        // the champion in the middle of its room, its kin about it
        const spots = open(lair).sort((a, b) => Math.hypot((a % w) - lair.cx, ((a / w) | 0) - lair.cy) - Math.hypot((b % w) - lair.cx, ((b / w) | 0) - lair.cy));
        const at = spots.shift();
        monsters.push(makeMonster(namedId, at % w, (at / w) | 0, nrng));
        const guard = MONSTERS[namedId].named.guard;
        if (guard && spots.length) {
          const [kind, n] = guard;
          const c = nrng.pick(spots.slice(0, 6));
          const g = makeMonster(kind, c % w, (c / w) | 0, nrng);
          // a pack kind comes as one group sharing a square, anything else alone
          if (n > 1 && PACK_KINDS.includes(kind)) {
            g.pack = [];
            for (let k = 1; k < n; k++) { const b = MONSTERS[kind], hp = nrng.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((depth - 1) / 2); g.pack.push({ hp, maxHp: hp }); }
          }
          monsters.push(g);
        }
      }
    }

    // ---- final level: boss and artifact ----
    if (isFinal) {
      const ax = farRoom.cx, ay = farRoom.cy;
      addItem(ax, ay, { t: 'artifact', q: 1 });
      const spots = [];
      for (const [dx, dy] of DIRS) { const nx = ax + dx, ny = ay + dy; if (get(nx, ny) === T.FLOOR && !occupied.has(idx(nx, ny))) spots.push([nx, ny]); }
      // down the Warrens the Warlord has dragged the Heart into his own hall; every other way, the lich keeps it;
      // at the bottom of a Long Delve, deeper than either came, the Heartforged keeps it where it was made
      const keeper = (opts.levels || 8) >= 12 ? 'heartforged' : opts.route === 'warrens' ? 'warlord' : 'lich';
      if (spots.length) { const s = spots[0]; monsters.push(makeMonster(keeper, s[0], s[1])); }
      // no escort: the level already crawls with the deep tier's own horrors
      // and no trap in the hall or at its mouth: a pit across the only way in
      // dropped every hero into it just as the lich spoke, the view dark for
      // its first blow. (Taken away after the dice, so the floor is otherwise as it was.)
      const near = 3;
      for (const k of Object.keys(traps)) {
        const [x, y] = k.split(',').map(Number);
        if (x >= farRoom.x - near && x < farRoom.x + farRoom.w + near && y >= farRoom.y - near && y < farRoom.y + farRoom.h + near) delete traps[k];
      }
    }

    // ---- finds left together ----
    // Now and then a room's scattered finds lie in one place, as if someone
    // set them down and never came back for them. Only a square that already
    // holds something takes more, and the draw has a stream of its own, so
    // nothing else on the floor moves and the loot is the same loot. Keys,
    // pages and the Heart stay where they were put.
    {
      const crng = new Rng(`${seed}|together|${depth}`);
      const movable = it => it.t !== 'key' && it.t !== 'page' && it.t !== 'artifact';
      const byRoom = new Map();
      for (const k in items) {
        const [x, y] = k.split(',').map(Number), r = roomId[idx(x, y)];
        if (r < 0 || !items[k].every(movable)) continue;
        if (!byRoom.has(r)) byRoom.set(r, []);
        byRoom.get(r).push(k);
      }
      for (const piles of byRoom.values()) {
        if (piles.length < 2 || !crng.chance(TOGETHER)) continue;
        const to = crng.pick(piles);
        for (const k of crng.shuffle(piles.filter(p => p !== to))) {
          if (items[to].length + items[k].length > TOGETHER_MOST) continue;
          items[to].push(...items[k]);
          delete items[k];
        }
      }
    }

    // an overgrown floor grows pale caps in its rooms, from dice of its own
    if (twist === 'overgrown') {
      const crng = new Rng(`${seed}|caps|${depth}`);
      const spots = [];
      for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const k = `${x},${y}`;
        if (tiles[idx(x, y)] !== T.FLOOR || items[k] || traps[k] || npcs.some(n => n.x === x && n.y === y) || (x === start.x && y === start.y)) continue;
        spots.push(k);
      }
      for (const k of crng.shuffle(spots).slice(0, 3)) items[k] = [{ t: 'caps', q: 1 + crng.int(0, 1) }];
    }

    // the ordinary themes take turns down the stair; the last floor and the
    // two roads have their own (the roads' come after the last floor's in THEMES)
    const FINAL = THEMES.findIndex(t => t.final);
    const theme = isFinal ? FINAL : route ? ROUTES[route].theme : (depth - 1) % FINAL;
    const L = {
      depth, w, h, tiles, roomId, explored: new Array(w * h).fill(0),
      items, monsters, npcs, traps, locks, features, lights, start, downStart, stairsUp: { x: upSlot.x, y: upSlot.y }, stairsDown,
      theme, isFinal, twist, route, rooms: rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    };
    L.dressing = dress(L, seed);
    return L;
  }

  /**
   * What lies about a floor's rooms that nobody fights or picks up: a barrel
   * against a wall, bones underfoot, a puddle (see dressing.js for the
   * pictures, and each theme's props in data.js for which kinds it keeps).
   * Dealt from a stream of its own, after everything else, so a seed's floors
   * hold what they always held; and from the finished level alone, so a
   * floor saved before there was dressing can be dressed when it is loaded.
   * @param {import('./types.js').Level} L
   * @param {string} seed
   * @returns {import('./types.js').Dressing[]}
   */
  function dress(L, seed) {
    const kinds = (THEMES[L.theme] && THEMES[L.theme].props) || [];
    if (!kinds.length || !L.roomId) return [];
    const rng = new Rng(`${seed}|dress|${L.depth}`);
    const w = L.w, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= L.h ? T.WALL : L.tiles[y * w + x]);
    const wallsBy = (x, y) => DIRS.filter(([dx, dy]) => { const t = at(x + dx, y + dy); return t === T.WALL || t === T.TORCH; });
    // not where something already stands or lies, nor where the hero arrives
    // by either stair, nor in front of a stair or a fountain, nor in a doorway
    const taken = new Set([...Object.keys(L.items), ...(L.npcs || []).map(n => n.x + ',' + n.y), L.start.x + ',' + L.start.y]);
    if (L.downStart) taken.add(L.downStart.x + ',' + L.downStart.y);
    const KEEP_CLEAR = [T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN, T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET];
    for (let i = 0; i < w * L.h; i++) {
      const x = i % w, y = (i / w) | 0;
      if (L.tiles[i] === T.FLOOR && DIRS.some(([dx, dy]) => KEEP_CLEAR.includes(at(x + dx, y + dy)))) taken.add(x + ',' + y);
    }
    /** @type {Map<number, number[]>} */
    const byRoom = new Map();
    for (let i = 0; i < w * L.h; i++) {
      if (L.roomId[i] < 0 || L.tiles[i] !== T.FLOOR) continue;
      if (!byRoom.has(L.roomId[i])) byRoom.set(L.roomId[i], []);
      byRoom.get(L.roomId[i]).push(i);
    }
    const out = [];
    for (const cells of byRoom.values()) {
      // a small room one or two things, a great hall up to four
      const n = Math.min(4, Math.round(cells.length / 16) + rng.int(0, 1));
      for (let k = 0; k < n; k++) {
        const kind = rng.pick(kinds), byWall = WALL_PROPS.includes(kind);
        const pool = cells.filter(i => !taken.has((i % w) + ',' + ((i / w) | 0)) && (!byWall || wallsBy(i % w, (i / w) | 0).length));
        if (!pool.length) continue;
        const i = rng.pick(pool), x = i % w, y = (i / w) | 0;
        taken.add(x + ',' + y);
        let ox = (rng.next() - 0.5) * 0.4, oy = (rng.next() - 0.5) * 0.4;
        // against the wall it stands by, not out in the middle of its square
        if (byWall) for (const [dx, dy] of wallsBy(x, y)) { ox += dx * 0.3; oy += dy * 0.3; }
        const clamp = v => Math.round(Math.max(-0.34, Math.min(0.34, v)) * 100) / 100;
        out.push(kind === 'puddle' ? { x, y, k: kind, ox: clamp(ox), oy: clamp(oy), r: Math.round((0.18 + rng.next() * 0.16) * 100) / 100 } : { x, y, k: kind, ox: clamp(ox), oy: clamp(oy) });
      }
    }
    return out;
  }

  function rollLoot(rng, depth) {
    // potions are found less than they were, so a hoard of forty never builds:
    // the gold that comes instead is what a trader's shelf of draughts is for
    const kind = rng.weighted([['gold', 30], ['potion', 13], ['food', 18], ['scroll', 10], ['weapon', 10], ['armor', 8], ['shield', 4], ['gem', 7]]);
    const maxTier = 1 + Math.floor(depth / 2);
    const gear = k => {
      // robes are placed for a mage alone (game.js), so every other hero's floors are as they were
      const cands = Object.keys(ITEMS).filter(id => ITEMS[id].kind === k && ITEMS[id].tier <= maxTier && ITEMS[id].weight !== 'cloth' && !ITEMS[id].focus);
      const id = rng.weighted(cands.map(id => [id, ITEMS[id].tier]));
      // Found gear keeps its quality to itself (h) until worn, studied or
      // appraised. Past the first floor a share of what seems enchanted is
      // cursed instead, and will not come off once worn. The second roll is
      // split rather than a third one added, so every other roll in the
      // level falls exactly where it did before curses existed.
      let e = 0, curse = false;
      if (rng.chance(0.12 + depth * 0.03)) {
        const r = rng.next(), cursed = depth >= 2 ? 0.3 : 0;
        if (r >= 1 - cursed) { curse = true; e = r >= 1 - cursed / 3 ? -2 : -1; }
        else {
          e = r < 0.25 + depth * 0.02 ? 2 : 1;
          // From the second floor, some well-made pieces carry a power too. It is
          // read from the roll already made (its digits past the first), so no
          // extra roll moves anything else the level holds.
          const f = (r * 9973) % 1;
          // and from the third, a quality of its make too, read from further digits still
          const g = (r * 7331) % 1, px = depth >= 3 && g < 0.35 ? GEAR_PREFIXES[k][Math.floor(((g * 104729) % 1) * GEAR_PREFIXES[k].length)] : '';
          if (depth >= 2 && f < 0.35 + depth * 0.04) {
            const pool = GEAR_POWERS[k];
            return { t: id, q: 1, e, h: 1, pw: pool[Math.floor(((f * 7919) % 1) * pool.length)], ...(px ? { px } : {}) };
          }
          if (px) return { t: id, q: 1, e, h: 1, px };
        }
      }
      return curse ? { t: id, q: 1, e, h: 1, curse: 1 } : { t: id, q: 1, e, h: 1 };
    };
    switch (kind) {
      case 'gold': return { t: 'gold', q: rng.int(5, 20) * depth + rng.int(0, 10) };
      case 'gem': { const g = rng.pick(GEMS); return { t: 'gem', name: g[0], q: Math.round(g[1] * (1 + depth * 0.15)) }; }
      case 'potion': return { t: rng.weighted([['potion_heal', 70], ['potion_xheal', 14 + depth * 4], ['potion_cure', 12], ['potion_might', 9], ['potion_mana', 10]]), q: 1 };
      case 'food': return { t: rng.weighted([['ration', 50], ['meat', 30], ['bread', 20]]), q: 1 };
      // (the oils ride in with the scrolls: the same draw, so nothing else on the floor moves)
      case 'scroll': return { t: rng.weighted([['scroll_fire', 32], ['scroll_heal', 27], ['scroll_map', 18], ['scroll_teleport', 13], ['scroll_uncurse', 14], ['oil_fire', 7], ['oil_silver', depth >= 3 ? 7 : 2], ['oil_venom', 6]]), q: 1 };
      case 'weapon': return gear('weapon');
      case 'armor': return gear('armor');
      case 'shield': return gear('shield');
    }
    return { t: 'gold', q: 5 };
  }

  return { T, generate, dress, rollLoot, DIRS, SIZES, PACK_KINDS, tierAt, namedPlan, twistPlan, TWIST_IDS, routeSpan };
})();

export { Dungeon };
