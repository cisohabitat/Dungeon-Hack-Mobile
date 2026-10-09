// What a fight leaves on the floor (blood, bones, broken barrels and what was in
// them) and the scenes a floor lays out for fire: casks among sleepers, oil at a
// lair's mouth. What it borrows from the game comes through K, read live.
import { MONSTERS, THEMES } from './data.js';
import { Dungeon } from './dungeon.js';
import { Rng } from './rng.js';
import { Sound } from './sound.js';

/** @param {any} K */
export function makeScenes(K) {
  const DIRS = K.DIRS;
  const REMAINS_MAX = K.REMAINS_MAX;
  const REMAINS_MS = K.REMAINS_MS;
  const T = K.T;
  const elements = K.elements;
  const floatText = K.floatText;
  const fx = K.fx;
  const heard = K.heard;
  const P = (/** @type {any[]} */ ...a) => K.P(...a);
  const key = (/** @type {any[]} */ ...a) => K.key(...a);
  const log = (/** @type {any[]} */ ...a) => K.log(...a);
  const lvl = (/** @type {any[]} */ ...a) => K.lvl(...a);
  const tile = (/** @type {any[]} */ ...a) => K.tile(...a);

  // ---------- what a blow leaves behind ----------
  // Each kind of monster bleeds its own colour: red, the green of a troll or
  // a slime, the dust of old bones, the cold light a wraith is made of. A
  // blow throws a spray away from the hero, a heavy blow or a kill leaves a
  // stain on the floor, and a blow turned aside strikes sparks.
  const GORE = {
    blood: { c: ['#8a0e12', '#b8161c', '#5a0608'], g: 6, stain: true },
    goo: { c: ['#4a9a2e', '#7ed052', '#2a5a1a'], g: 5, stain: true },
    ichor: { c: ['#8aa01a', '#c0d040', '#4e5e0e'], g: 6, stain: true },
    rot: { c: ['#4a2a1a', '#6e3e24', '#2a1a10'], g: 6, stain: true },
    troll: { c: ['#2e5a22', '#4e7e34', '#1a3610'], g: 6, stain: true },
    bone: { c: ['#e8e0cc', '#b8ae98', '#8a8070'], g: 7, stain: false },
    ecto: { c: ['#a8d8ff', '#e0f4ff', '#6aa0d8'], g: -0.5, stain: false, glow: true },
    spark: { c: ['#fff4c0', '#ffd060', '#ff9030'], g: 2.5, stain: false, glow: true },
    bile: { c: ['#3e4832', '#5c6848', '#262c1e'], g: 6, stain: true },
    rust: { c: ['#8a4a1e', '#b86a2e', '#5a2c12'], g: 6, stain: true },
    // a puffcap's spores hang in the air a moment before they settle
    spore: { c: ['#d8d0a0', '#b8b070', '#e8e4c8'], g: 0.6, stain: false },
  };
  const GORE_OF = { slime: 'goo', spider: 'ichor', skeleton: 'bone', zombie: 'rot', ghoul: 'rot', wraith: 'ecto', troll: 'troll', lich: 'bone',
    basilisk: 'bile', rustmaw: 'rust', shade: 'ecto', puffcap: 'spore', drowned: 'rot', heartforged: 'spark', emberling: 'spark' };
  // a named champion bleeds as its kind does
  for (const id in MONSTERS) if (MONSTERS[id].named && GORE_OF[MONSTERS[id].named.kin]) GORE_OF[id] = GORE_OF[MONSTERS[id].named.kin];
  const STAINS_PER_FLOOR = 60, BITS_MAX = 160;
  // What is only for the eye draws on its own numbers, never the dice's:
  // a spray of blood must not change what the next blow rolls.
  let lookSeed = 0x2f6b1d3;
  const look = () => {
    lookSeed = (lookSeed + 0x6D2B79F5) | 0;
    let t = Math.imul(lookSeed ^ (lookSeed >>> 15), 1 | lookSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /**
   * Throw a spray from a monster, away from the hero.
   * @param {import('./types.js').Monster} m
   * @param {string} kind  a GORE key, or null for what this monster bleeds
   * @param {number} amount  0 to 1: how hard the blow was, against its whole life
   * @param {boolean} [pool]  leave a stain on the floor too
   */
  function spray(m, kind, amount, pool) {
    const g = GORE[kind || GORE_OF[m.id] || 'blood'];
    const p = P(), mb = MONSTERS[m.id];
    const cx = (m.rx == null ? m.x : m.rx) + 0.5, cy = (m.ry == null ? m.y : m.ry) + 0.5;
    const ax = cx - (p.x + 0.5), ay = cy - (p.y + 0.5), len = Math.hypot(ax, ay) || 1, ux = ax / len, uy = ay / len;
    const z0 = (mb.fly || 0) + mb.scale * 0.55;
    const n = Math.round(5 + Math.min(1, amount) * 16);
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + look() * 1.6, side = (look() * 2 - 1) * 1.1;
      fx.bits.push({
        x: cx - ux * 0.3, y: cy - uy * 0.3, z: z0 + (look() - 0.5) * 0.2,
        vx: ux * sp - uy * side, vy: uy * sp + ux * side, vz: 0.6 + look() * 1.8,
        g: g.g, c: g.c[i % g.c.length], born: K.realNow + K.fxDelay, life: 380 + look() * 360,
        size: look() < 0.3 ? 0.024 : 0.015, glow: g.glow,
      });
    }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
    if (pool && g.stain) {
      const list = fx.stains[K.G.depth] || (fx.stains[K.G.depth] = []);
      // it lands a little beyond the monster, on the side away from the blow
      list.push({ x: cx + ux * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3, y: cy + uy * (0.1 + look() * 0.25) + (look() - 0.5) * 0.3,
        r: 0.06 + Math.min(1, amount) * 0.1, c: g.c[2], seed: look() * 1000, at: K.realNow + K.fxDelay });
      if (list.length > STAINS_PER_FLOOR) list.shift();
    }
  }
  // Barrels, crates and urns (see dressing.js) break to a blow. What each
  // holds is its own, dealt from the seed and where it stands, so breaking
  // it after a reload finds the same: a little gold, a meal now and then, a
  // draught very rarely, most often nothing at all.
  const SMASHABLE = ['barrel', 'crate', 'urn', 'oilcask'];
  const SMASH_WORDS = { barrel: 'The barrel\'s staves give way', crate: 'The crate splinters apart', urn: 'The urn shatters', oilcask: 'The cask\'s staves give way' };
  const KICK_WORDS = { barrel: 'You kick the barrel over and its staves give way', crate: 'You kick the crate over and it splinters', urn: 'You knock the urn over and it shatters', oilcask: 'You kick the cask over and its staves give way' };
  // A third of the barrels about the dungeon hold lamp oil (see elements.js),
  // chosen from dice of their own when a floor is first made, so every other
  // barrel, and the floor, fall as they always did.
  const OIL_CASKS = 0.35;
  /** @param {import('./types.js').Level} L */
  function caskLevel(L, depth) {
    const rng = new Rng(`${K.G.seed}|casks|${depth}`);
    for (const q of L.dressing || []) if (q.k === 'barrel' && rng.next() < OIL_CASKS) q.k = 'oilcask';
    stockLampOil(L, depth);
  }
  // Now and then, on the middle floors, one barrel in a room away from the
  // stairs is a mimic (foes.js), chosen from dice of its own when the floor is
  // made, so the floor's other dice fall as they did. It takes the barrel's place.
  const MIMIC_CHANCE = 0.35;
  /** @param {import('./types.js').Level} L */
  function mimicLevel(L, depth) {
    const tier = Dungeon.tierAt(depth, K.G.opts.levels || 8);
    // (and never on a people's floor: nobody lives there but them)
    if (tier < 3 || tier > 7 || L.isFinal || (THEMES[L.theme] && THEMES[L.theme].people)) return;
    const rng = new Rng(`${K.G.seed}|mimic|${depth}`);
    if (rng.next() >= MIMIC_CHANCE) return;
    const ends = [L.start, L.stairsUp, L.stairsDown].filter(Boolean);
    const roomOf = (x, y) => (L.roomId ? L.roomId[y * L.w + x] : -1);
    const startRooms = new Set(ends.map(e => roomOf(e.x, e.y)).filter(r => r >= 0));
    const barrels = (L.dressing || []).filter(q => q.k === 'barrel' && roomOf(q.x, q.y) >= 0 && !startRooms.has(roomOf(q.x, q.y))
      && !L.monsters.some(m => m.x === q.x && m.y === q.y) && !ends.some(e => Math.abs(e.x - q.x) + Math.abs(e.y - q.y) <= 2));
    // with no barrel to take the place of, it stands as one against a wall of a room
    const at = (x, y) => L.tiles[y * L.w + x];
    const byWall = [];
    if (!barrels.length) for (let i = 0; i < L.w * L.h; i++) {
      const x = i % L.w, y = (i / L.w) | 0, r = roomOf(x, y);
      if (r < 0 || startRooms.has(r) || at(x, y) !== T.FLOOR || !DIRS.some(([dx, dy]) => at(x + dx, y + dy) === T.WALL)) continue;
      // (not beside a door, a stair or a fountain, where it would stand in the way)
      if (DIRS.some(([dx, dy]) => [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN].includes(at(x + dx, y + dy)))) continue;
      if (ends.some(e => Math.abs(e.x - x) + Math.abs(e.y - y) <= 2) || L.monsters.some(m => m.x === x && m.y === y) || (L.npcs || []).some(n => n.x === x && n.y === y)
        || (L.items[key(x, y)] || []).length || (L.dressing || []).some(q => q.x === x && q.y === y) || (L.traps || {})[key(x, y)]) continue;
      byWall.push({ x, y, ox: 0, oy: 0 });
    }
    const pool = barrels.length ? barrels : byWall;
    if (!pool.length) return;
    const b = pool[rng.int(0, pool.length - 1)], mb = MONSTERS.mimic;
    if (barrels.length) L.dressing.splice(L.dressing.indexOf(b), 1);
    const hp = rng.dice(mb.hp[0], mb.hp[1], mb.hp[2]) + Math.floor((depth - 1) / 2);
    L.monsters.push({ uid: depth * 1000 + 990, id: 'mimic', x: b.x, y: b.y, hp, maxHp: hp, awake: false, disguised: true, dox: b.ox, doy: b.oy,
      nextAct: 0, rx: b.x, ry: b.y, fromX: b.x, fromY: b.y, moveT0: 0, moveT1: 0, flashUntil: 0 });
  }
  /**
   * Every trader keeps a few flasks of lamp oil, to throw: once a floor (a
   * floor saved before there were flasks gets them as it loads, and a trader
   * bought out stays bought out).
   */
  function stockLampOil(L, depth) {
    if (L.lampOil) return;
    L.lampOil = true;
    const frng = new Rng(`${K.G.seed}|lampoil|${depth}`);
    for (const n of L.npcs || []) if (Array.isArray(n.stock) && !n.stock.some(s => s.t === 'lamp_oil')) n.stock.push({ t: 'lamp_oil', q: 2 + frng.int(0, 2), e: 0 });
  }
  // ---------- scenes laid out for fire ----------
  // Now and then a floor sets a scene that shows what fire is for, and says no
  // more than what is there: oil casks standing among a sleeping group, the
  // way into a lair slick with spilt lamp oil, casks stacked against a locked
  // door. A line in the log names it as the hero comes near. Its own dice, so
  // the map's are not shifted; never on the first floor or the last.
  const PIECE_CHANCE = 0.4;
  function pieceLevel(L, depth) {
    if (depth < 2 || L.isFinal) return;
    const rng = new Rng(`${K.G.seed}|piece|${depth}`);
    if (rng.next() >= PIECE_CHANCE) return;
    const at = (x, y) => L.tiles[y * L.w + x];
    const ends = [L.start, L.stairsUp, L.stairsDown].filter(Boolean);
    const roomOf = (x, y) => L.roomId ? L.roomId[y * L.w + x] : -1;
    const startRooms = new Set(ends.map(e => roomOf(e.x, e.y)).filter(r => r >= 0));
    const free = (x, y) => at(x, y) === T.FLOOR && !L.monsters.some(m => m.x === x && m.y === y) && !(L.npcs || []).some(n => n.x === x && n.y === y)
      && !(L.items[key(x, y)] || []).length && !(L.dressing || []).some(q => q.x === x && q.y === y) && !(L.traps || {})[key(x, y)]
      && !ends.some(e => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
    const plain = m => !MONSTERS[m.id].boss && !MONSTERS[m.id].named && !m.sunk && !m.disguised;
    const cask = (x, y) => (L.dressing || (L.dressing = [])).push({ x, y, k: 'oilcask', ox: 0, oy: 0 });
    const pieces = {
      // casks among a sleeping group: a spark in the room, and the room goes up
      cache: () => {
        const byRoom = new Map();
        for (const m of L.monsters) { const r = roomOf(m.x, m.y); if (r < 0 || startRooms.has(r) || !plain(m) || m.awake) continue; byRoom.set(r, [...(byRoom.get(r) || []), m]); }
        const cands = [...byRoom.entries()].filter(([, ms]) => ms.length >= 2);
        if (!cands.length) return null;
        const [, ms] = cands[rng.int(0, cands.length - 1)];
        // the spots found first, and the casks set down only if there are two: one alone is no scene
        const spots = [];
        for (const m of ms) for (const [dx, dy] of DIRS) {
          if (spots.length >= 3) break;
          const x = m.x + dx, y = m.y + dy;
          if (free(x, y) && roomOf(x, y) === roomOf(m.x, m.y) && !spots.some(([sx, sy]) => sx === x && sy === y)) { spots.push([x, y]); break; }
        }
        if (spots.length < 2) return null;
        for (const [x, y] of spots) cask(x, y);
        // named for what sleeps there only when they are all of a kind
        const who = ms.every(m => m.id === ms[0].id) ? ms[0].id : '';
        return { k: 'cache', x: ms[0].x, y: ms[0].y, who, uids: ms.map(m => m.uid), casks: spots };
      },
      // the way into a lair slick with oil: light it as they come through
      slick: () => {
        const lairs = [...new Set(L.monsters.filter(plain).map(m => roomOf(m.x, m.y)))].filter(r => r >= 0 && !startRooms.has(r));
        for (const r of rng.shuffle(lairs)) {
          // a square just outside the room, the start of a corridor into it
          for (let i = 0; i < L.w * L.h; i++) {
            const x = i % L.w, y = (i / L.w) | 0;
            if (roomOf(x, y) !== -1 || at(x, y) !== T.FLOOR) continue;
            if (!DIRS.some(([dx, dy]) => roomOf(x + dx, y + dy) === r || (at(x + dx, y + dy) === T.DOOR && DIRS.some(([ex, ey]) => roomOf(x + dx + ex, y + dy + ey) === r)))) continue;
            // walk out along the corridor, laying oil on three squares of it
            const line = [[x, y]];
            let px = x, py = y, cx = x, cy = y;
            for (let k = 0; k < 2; k++) {
              const next = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).find(([nx, ny]) => at(nx, ny) === T.FLOOR && roomOf(nx, ny) === -1 && !(nx === px && ny === py) && !line.some(([lx, ly]) => lx === nx && ly === ny));
              if (!next) break;
              px = cx; py = cy; [cx, cy] = next; line.push(next);
            }
            if (line.length < 3 || !line.every(([lx, ly]) => free(lx, ly))) continue;
            L.fields = L.fields || {};
            for (const [lx, ly] of line) L.fields[key(lx, ly)] = { k: 'oil' };
            return { k: 'slick', x, y, line };
          }
        }
        return null;
      },
      // casks stacked against a locked door: break one, and a flame does what a key would
      barricade: () => {
        const doors = rng.shuffle(Object.keys(L.locks || {}).map(k => k.split(',').map(Number)).filter(([x, y]) => at(x, y) === T.DOOR_LOCKED));
        for (const [x, y] of doors) {
          const sides = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([sx, sy]) => free(sx, sy));
          if (!sides.length) continue;
          for (const [sx, sy] of sides) cask(sx, sy);
          return { k: 'barricade', x, y, casks: sides };
        }
        return null;
      },
    };
    for (const kind of rng.shuffle(Object.keys(pieces))) {
      const piece = pieces[kind]();
      if (piece) { L.pieces = [piece]; return; }
    }
  }
  /** Nothing solid between the hero and a square: stone and a shut door hide what is past them. */
  function inSight(x, y) {
    const p = P(), n = Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) * 4;
    for (let i = 1; i < n; i++) {
      const sx = Math.floor(p.x + 0.5 + (x - p.x) * i / n), sy = Math.floor(p.y + 0.5 + (y - p.y) * i / n);
      if ((sx === p.x && sy === p.y) || (sx === x && sy === y)) continue;
      const t = tile(sx, sy);
      if (t !== T.FLOOR && t !== T.DOOR_OPEN && t !== T.FOUNTAIN) return false;
    }
    return true;
  }
  /**
   * Whether a scene still stands as it was laid: casks unburst, oil unburnt,
   * the door still locked, and some of the group still among the casks (awake
   * or not: a group that has gone off after the hero is no scene). A fire that
   * got there first (a goblin's pot, a wyrm's breath) leaves nothing to say.
   */
  function pieceStands(L, pc) {
    const caskAt = ([x, y]) => (L.dressing || []).some(q => q.k === 'oilcask' && q.x === x && q.y === y);
    if (pc.k === 'slick') return (pc.line || [[pc.x, pc.y]]).some(([x, y]) => { const f = (L.fields || {})[key(x, y)]; return f && f.k === 'oil'; });
    if (pc.casks && !pc.casks.some(caskAt)) return false;
    if (pc.k === 'barricade') return tile(pc.x, pc.y) === T.DOOR_LOCKED;
    return !pc.uids || L.monsters.some(m => pc.uids.includes(m.uid) && Math.abs(m.x - pc.x) + Math.abs(m.y - pc.y) <= 2);
  }
  // a scene is named as soon as it can be seen: from further than a sleeping group
  // hears a hero come (six squares), or a cache was named only once it had woken
  // (on a dark floor, no further than the dark lets the view reach)
  const PIECE_SIGHT = 7, PIECE_SIGHT_DARK = 4;
  /** A scene laid out for fire is named as the hero comes within sight of it. */
  function notePieces() {
    const L = lvl(), p = P();
    for (const pc of L.pieces || []) {
      if (pc.said || Math.abs(pc.x - p.x) + Math.abs(pc.y - p.y) > (L.twist === 'dark' ? PIECE_SIGHT_DARK : PIECE_SIGHT)) continue;
      // seen from the scene's own squares: a locked door is seen from a cask beside it
      const from = pc.k === 'barricade' && pc.casks ? pc.casks : [[pc.x, pc.y], ...(pc.casks || []), ...(pc.line || [])];
      if (!from.some(([x, y]) => inSight(x, y))) continue;
      pc.said = true;
      if (!pieceStands(L, pc)) continue;
      pc.named = true;   // (said aloud, not only passed: the cask tip follows only a scene named)
      // (asleep only while they all are; a barricade by the casks seen from this side of the door)
      const group = pc.k === 'cache' ? L.monsters.filter(m => (pc.uids || []).includes(m.uid)) : [];
      const asleep = group.every(m => !m.awake) ? 'sleeping ' : '';
      const seen = (pc.casks || []).filter(([x, y]) => inSight(x, y) && (L.dressing || []).some(q => q.k === 'oilcask' && q.x === x && q.y === y)).length;
      log(pc.k === 'cache' ? `Oil casks stand among the ${asleep}${MONSTERS[pc.who] ? MONSTERS[pc.who].name.toLowerCase() + 's' : 'creatures'}. It would take only a spark.`
        : pc.k === 'slick' ? 'The passage here is slick with spilt lamp oil, where anything coming through must cross it.'
          : `${seen === 1 ? 'An oil cask stands' : 'Oil casks are stacked'} against the locked door. A door burns as well as it opens.`, 'info');
    }
  }
  /** A barrel, crate or urn on this square, if one stands there. */
  const propAt = (x, y) => (tile(x, y) === T.FLOOR && (lvl().dressing || []).find(q => q.x === x && q.y === y && SMASHABLE.includes(q.k))) || null;
  /** @param {import('./types.js').Level} L @param {import('./types.js').Dressing} d @param {boolean} [kicked] @param {boolean} [burst] burst by a fire: what spills, and what it held, are told by elements.js */
  function smash(L, d, kicked, burst) {
    L.dressing.splice(L.dressing.indexOf(d), 1);
    const cx = d.x + 0.5 + d.ox, cy = d.y + 0.5 + d.oy;
    const cols = d.k === 'urn' ? ['#9a5a3a', '#6a3a24', '#c9a24a'] : d.k === 'oilcask' ? ['#4a3620', '#2e2214', '#8a6a3a'] : ['#7a5230', '#4e3320', '#a8844e'];
    // a burst of staves or shards, big enough to see past the swing
    for (let i = 0; i < 28; i++) {
      fx.bits.push({ x: cx, y: cy, z: 0.1 + look() * 0.35, vx: (look() - 0.5) * 2.6, vy: (look() - 0.5) * 2.6, vz: 0.9 + look() * 1.8,
        g: 7, c: cols[i % cols.length], born: K.realNow + K.fxDelay, life: 480 + look() * 380, size: look() < 0.5 ? 0.045 : 0.025 });
    }
    // and what is left of it lies there a good while
    L.remains = (L.remains || []).filter(r => r.until > K.G.t).slice(-(REMAINS_MAX - 1));
    L.remains.push({ x: Math.round(cx * 100) / 100, y: Math.round(cy * 100) / 100, k: d.k === 'urn' ? 'remains_shards' : 'remains_staves', at: K.G.t - 1000, until: K.G.t + REMAINS_MS * 2 });
    if (K.realNow >= fx.shakeUntil) { fx.shakeAmp = 2; fx.shakeMs = 120; fx.shakeUntil = K.realNow + K.fxDelay + 120; }
    if (fx.bits.length > BITS_MAX) fx.bits.splice(0, fx.bits.length - BITS_MAX);
    Sound.play('smash', heard(d));
    const rng = new Rng(`${K.G.seed}|smash|${K.G.depth}|${d.x},${d.y}`), r = rng.next();
    /** @type {import('./types.js').Item|null} */
    let found = null;
    if (r < 0.26) found = { t: 'gold', q: rng.int(3, 8) * K.G.depth + rng.int(0, 5) };
    else if (r < 0.36) found = { t: rng.chance(0.5) ? 'bread' : 'ration', q: 1 };
    else if (r < 0.4) found = { t: 'potion_heal', q: 1 };
    else if (r < 0.46) found = { t: 'lamp_oil', q: 1 };
    if (found) (L.items[key(d.x, d.y)] = L.items[key(d.x, d.y)] || []).push(found);
    if (found && found.t === 'gold') floatText({ rx: cx - 0.5, ry: cy - 0.5 }, `+${found.q}`, '#ffd24a');
    if (burst) return;
    // a cask's oil was what was inside: said after the staves give, not before, and no "nothing inside"
    const cask = d.k === 'oilcask';
    log(`${(kicked ? KICK_WORDS : SMASH_WORDS)[d.k]}${!found ? (cask ? '.' : ': nothing inside.') : found.t === 'gold' ? `, and ${found.q} gold spills out.` : ', and something rolls out.'}`, found ? 'good' : '');
    if (cask) elements.spill(d.x, d.y);
  }
  /** Sparks where a blow was turned aside. */
  function sparks(m) { spray(m, 'spark', 0.05, false); }


  return { BITS_MAX, GORE, GORE_OF, caskLevel, look, mimicLevel, notePieces, pieceLevel, propAt, smash, sparks, spray, stockLampOil };
}
