import { Rng } from './rng.js';
import { ITEMS, MONSTERS, GEMS, ELITES, JOURNAL, THEMES } from './data.js';

// Procedural dungeon generator. Deterministic per (seed, depth).

const Dungeon = (() => {
  const T = { FLOOR: 0, WALL: 1, DOOR: 2, DOOR_OPEN: 3, DOOR_LOCKED: 4, STAIRS_DOWN: 5, STAIRS_UP: 6, SECRET: 7, FOUNTAIN: 8, TORCH: 9 };
  const SIZES = { small: 28, medium: 36, large: 44 };
  const KEY_ORDER = ['brass', 'silver', 'gold', 'iron', 'bone'];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function generate(seed, depth, opts) {
    const rng = new Rng(`${seed}#${depth}`);
    const w = SIZES[opts.size] || 36, h = w;
    const tiles = new Array(w * h).fill(T.WALL);
    const roomId = new Array(w * h).fill(-1);
    const idx = (x, y) => y * w + x;
    const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? T.WALL : tiles[idx(x, y)];
    const isFinal = depth >= opts.levels;

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
    function wallSlot(room) {
      const cands = [];
      const tryS = (sx, sy, fx, fy, dir) => {
        if (get(sx, sy) !== T.WALL) return;
        let floors = 0, doorAdj = false;
        for (const [dx, dy] of DIRS) {
          const t = get(sx + dx, sy + dy);
          if (t !== T.WALL) floors++;
          if (t === T.DOOR) doorAdj = true;
        }
        if (floors === 1 && !doorAdj) cands.push({ x: sx, y: sy, fx, fy, dir });
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
    tiles[idx(upSlot.x, upSlot.y)] = T.STAIRS_UP;
    const start = { x: upSlot.fx, y: upSlot.fy, dir: upSlot.dir };

    const dist0 = bfs(start.x, start.y, false);
    const byDist = rooms.filter(r => r !== startRoom).sort((a, b) => dist0[idx(b.cx, b.cy)] - dist0[idx(a.cx, a.cy)]);
    let farRoom = byDist[0] || startRoom;
    let downStart = null, stairsDown = null;
    if (!isFinal) {
      for (const r of byDist) {
        const s = wallSlot(r);
        if (s) { farRoom = r; tiles[idx(s.x, s.y)] = T.STAIRS_DOWN; stairsDown = { x: s.x, y: s.y }; downStart = { x: s.fx, y: s.fy, dir: s.dir }; break; }
      }
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
    const makeMonster = (id, x, y) => {
      const b = MONSTERS[id];
      const hp = rng.dice(b.hp[0], b.hp[1], b.hp[2]) + Math.floor((depth - 1) / 2);
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
    let pool = Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss && depth >= MONSTERS[id].tier[0] && depth <= MONSTERS[id].tier[1]);
    if (!pool.length) pool = Object.keys(MONSTERS).filter(id => !MONSTERS[id].boss).sort((a, b) => MONSTERS[b].xp - MONSTERS[a].xp).slice(0, 3);
    const density = { few: 0.6, normal: 1.0, many: 1.6 }[opts.monsters] || 1;
    const count = Math.round(rooms.length * density * 0.85) + Math.floor(depth / 3);
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
      const weighted = pool.map(id => [id, 1 + Math.max(0, depth - MONSTERS[id].tier[0])]);
      const m = makeMonster(rng.weighted(weighted), c % w, (c / w) | 0);
      // champions appear more often the deeper you go
      if (rng.chance(Math.min(0.2, 0.02 + depth * 0.018))) makeElite(m);
      monsters.push(m);
    }

    // ---- loot ----
    const treasure = { scarce: 0.6, normal: 1.0, rich: 1.6 }[opts.treasure] || 1;
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
      const want = Math.round(rooms.length * 0.9) + 4;
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

    // ---- a merchant, so the gold you haul up is worth something ----
    const npcs = [];
    if (!isFinal && depth > 1 && rng.chance(0.45)) {
      const cands = rooms.filter(r => r !== startRoom);
      for (const r of rng.shuffle(cands.slice())) {
        const spots = [];
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          if (tiles[idx(x, y)] === T.FLOOR && !occupied.has(idx(x, y)) && !traps[x + ',' + y] && !items[x + ',' + y]) spots.push([x, y]);
        }
        if (!spots.length) continue;
        // The trader is solid, so they must not be the one tile holding the level
        // together. Count what is reachable with and without them standing there.
        // The trader is solid, so they must never be the tile holding the level
        // together. Locked doors make this two questions, not one: a spot can be
        // harmless once every key is found and still seal off the key itself, so
        // the count has to hold both with locked doors shut and with them open.
        const reach = (blocker, lockedPassable) => {
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
              if (seen[ni] || ni === blocker) continue;
              const t = tiles[ni];
              if (t === T.WALL || t === T.SECRET || t === T.FOUNTAIN || t === T.TORCH || t === T.STAIRS_UP) continue;
              if (t === T.DOOR_LOCKED && !lockedPassable) continue;
              seen[ni] = 1;
              q.push(ni);
            }
          }
          return n;
        };
        const openAll = reach(-1, true), openShut = reach(-1, false);
        let chosen = null;
        for (const [sx, sy] of rng.shuffle(spots.slice())) {
          const i = idx(sx, sy);
          const costAll = openAll - reach(i, true);
          const costShut = openShut - reach(i, false);
          // standing there may remove their own tile from reach, nothing more
          if (costAll === 1 && costShut <= 1) { chosen = [sx, sy]; break; }
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
          ['ration', 26], ['meat', 14],
        ];
        const n = rng.int(4, 6);
        for (let i = 0; i < n; i++) {
          const t = rng.weighted(shelf);
          const ex = stock.find(s => s.t === t);
          if (ex) ex.q++; else stock.push({ t, q: 1, e: 0 });
        }
        // one piece of gear, sometimes enchanted, priced accordingly
        const maxTier = 1 + Math.floor(depth / 2);
        const gearKind = rng.weighted([['weapon', 5], ['armor', 3], ['shield', 2]]);
        const gearIds = Object.keys(ITEMS).filter(id => ITEMS[id].kind === gearKind && ITEMS[id].tier <= maxTier + 1);
        if (gearIds.length) stock.push({ t: rng.weighted(gearIds.map(id => [id, ITEMS[id].tier])), q: 1, e: rng.chance(0.3) ? 1 : 0 });
        npcs.push({ id: 'merchant', x: mx, y: my, stock, markup: 1.8 + rng.next() * 0.6, greeted: false });
        break;
      }
    }

    // ---- final level: boss and artifact ----
    if (isFinal) {
      const ax = farRoom.cx, ay = farRoom.cy;
      addItem(ax, ay, { t: 'artifact', q: 1 });
      const spots = [];
      for (const [dx, dy] of DIRS) { const nx = ax + dx, ny = ay + dy; if (get(nx, ny) === T.FLOOR && !occupied.has(idx(nx, ny))) spots.push([nx, ny]); }
      if (spots.length) { const s = spots[0]; monsters.push(makeMonster('lich', s[0], s[1])); }
      // no escort: the level already crawls with the deep tier's own horrors
    }

    const theme = isFinal ? THEMES.length - 1 : (depth - 1) % (THEMES.length - 1);
    return {
      depth, w, h, tiles, roomId, explored: new Array(w * h).fill(0),
      items, monsters, npcs, traps, locks, features, lights, start, downStart, stairsUp: { x: upSlot.x, y: upSlot.y }, stairsDown,
      theme, isFinal, rooms: rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    };
  }

  function rollLoot(rng, depth) {
    const kind = rng.weighted([['gold', 24], ['potion', 23], ['food', 18], ['scroll', 8], ['weapon', 10], ['armor', 8], ['shield', 4], ['gem', 5]]);
    const maxTier = 1 + Math.floor(depth / 2);
    const gear = k => {
      const cands = Object.keys(ITEMS).filter(id => ITEMS[id].kind === k && ITEMS[id].tier <= maxTier);
      const id = rng.weighted(cands.map(id => [id, ITEMS[id].tier]));
      let e = 0;
      if (rng.chance(0.12 + depth * 0.03)) e = rng.chance(0.25 + depth * 0.02) ? 2 : 1;
      return { t: id, q: 1, e };
    };
    switch (kind) {
      case 'gold': return { t: 'gold', q: rng.int(5, 20) * depth + rng.int(0, 10) };
      case 'gem': { const g = rng.pick(GEMS); return { t: 'gem', name: g[0], q: Math.round(g[1] * (1 + depth * 0.15)) }; }
      case 'potion': return { t: rng.weighted([['potion_heal', 70], ['potion_xheal', 14 + depth * 4], ['potion_cure', 12], ['potion_might', 9], ['potion_mana', 10]]), q: 1 };
      case 'food': return { t: rng.weighted([['ration', 50], ['meat', 30], ['bread', 20]]), q: 1 };
      case 'scroll': return { t: rng.weighted([['scroll_fire', 35], ['scroll_heal', 30], ['scroll_map', 20], ['scroll_teleport', 15]]), q: 1 };
      case 'weapon': return gear('weapon');
      case 'armor': return gear('armor');
      case 'shield': return gear('shield');
    }
    return { t: 'gold', q: 5 };
  }

  return { T, generate, rollLoot, DIRS, SIZES };
})();

export { Dungeon };
