'use strict';
// Headless checks: loads the browser-free modules in a VM and verifies that every
// generated level is solvable (stairs or artifact reachable once keys are collected).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
vm.createContext(ctx);
for (const f of ['rng', 'data', 'dungeon']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}
vm.runInContext('globalThis.Dungeon = Dungeon; globalThis.SPRITES = SPRITES; globalThis.MONSTERS = MONSTERS; globalThis.ITEMS = ITEMS; globalThis.CLASSES = CLASSES; globalThis.XP_TABLE = XP_TABLE;', ctx);
const { Dungeon, SPRITES, MONSTERS, ITEMS } = ctx;
const T = Dungeon.T;

let failures = 0;
function check(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg); } }

// sprites are rectangular, square and fully described by their palette
for (const k in SPRITES) {
  const s = SPRITES[k];
  const w = s.rows[0].length;
  check(s.rows.length === w, `${k} is ${w}x${s.rows.length}, not square`);
  check(w === 16 || w === 24, `${k} is ${w} wide; expected 16 or 24`);
  s.rows.forEach((row, i) => {
    check(row.length === w, `${k} row ${i} has ${row.length} columns, expected ${w}`);
    for (const ch of row) check(ch === '.' || s.pal[ch], `${k} uses unknown palette key '${ch}'`);
  });
  // unused palette entries are dead weight and usually a typo
  const used = new Set(s.rows.join('').split('').filter(c => c !== '.'));
  for (const key in s.pal) check(used.has(key), `${k} palette key '${key}' is never used`);
}

function solvable(L, blockNpcs) {
  const { w, h } = L;
  const blocked = new Set(blockNpcs ? (L.npcs || []).map(n => n.y * w + n.x) : []);
  const keys = new Set(), opened = new Set();
  let progress = true, reached = false, artifact = false;
  while (progress) {
    progress = false;
    const dist = new Int32Array(w * h).fill(-1);
    const q = [L.start.y * w + L.start.x];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (dist[ni] >= 0) continue;
        const t = L.tiles[ni];
        if (t === T.STAIRS_DOWN) { reached = true; continue; }
        if (t === T.WALL || t === T.STAIRS_UP || t === T.SECRET || t === T.FOUNTAIN || t === T.TORCH) continue;
        if (blocked.has(ni)) continue;   // you cannot walk through the trader
        if (t === T.DOOR_LOCKED && !opened.has(ni)) {
          const c = L.locks[nx + ',' + ny];
          if (keys.has(c)) { opened.add(ni); progress = true; } else continue;
        }
        dist[ni] = dist[i] + 1;
        q.push(ni);
        for (const it of (L.items[nx + ',' + ny] || [])) {
          if (it.t === 'key' && !keys.has(it.color)) { keys.add(it.color); progress = true; }
          if (it.t === 'artifact') artifact = true;
        }
      }
    }
  }
  return L.isFinal ? artifact : reached;
}

let vaults = 0, fountains = 0, torches = 0, elites = 0, traders = 0;
let levels = 0;
for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'kar42', 'morthal7', 'x', 'a longer seed with spaces']) {
  for (const size of ['small', 'medium', 'large']) {
    const opts = { levels: 8, size, monsters: 'many', treasure: 'rich', lockedDoors: true, traps: true };
    for (let depth = 1; depth <= 8; depth++) {
      const L = Dungeon.generate(seed, depth, opts);
      levels++;
      check(solvable(L), `level not solvable: seed=${seed} size=${size} depth=${depth}`);
      // the trader stands on a floor tile, so they must not be the only way past
      check(solvable(L, true), `trader blocks the only route: seed=${seed} size=${size} depth=${depth}`);
      for (const n of (L.npcs || [])) {
        check(L.tiles[n.y * L.w + n.x] === T.FLOOR, `trader is not on a floor tile: seed=${seed} depth=${depth}`);
        check(!L.monsters.some(m => m.x === n.x && m.y === n.y), `a monster shares the trader's tile: seed=${seed} depth=${depth}`);
        check(n.stock.length > 0, `trader has nothing to sell: seed=${seed} depth=${depth}`);
      }
      traders += (L.npcs || []).length;
      vaults += L.tiles.filter(t => t === T.SECRET).length;
      fountains += Object.keys(L.features).length;
      torches += L.lights.length;
      elites += L.monsters.filter(m => m.elite).length;
      // a torch must sit in a wall and light an adjacent floor tile
      for (const l of L.lights) check(L.tiles[l.y * L.w + l.x] === T.FLOOR, `torch lights a non-floor tile: seed=${seed} depth=${depth}`);
      check(L.monsters.every(m => L.tiles[m.y * L.w + m.x] === T.FLOOR), `monster on non-floor: seed=${seed} depth=${depth}`);
      check(new Set(L.monsters.map(m => m.uid)).size === L.monsters.length, `duplicate monster uid: seed=${seed} depth=${depth}`);
      check(L.isFinal ? L.monsters.some(m => m.id === 'lich') : !!L.stairsDown, `missing stairs/boss: seed=${seed} depth=${depth}`);
      // determinism
      const again = Dungeon.generate(seed, depth, opts);
      check(JSON.stringify(again.tiles) === JSON.stringify(L.tiles), `generator not deterministic: seed=${seed} depth=${depth}`);
    }
  }
}
// Balance guards. These encode the arithmetic that made the game unwinnable
// before: a boss that outdamaged the player faster than it could be killed.
const avgHp = m => m.hp[0] * (m.hp[1] + 1) / 2 + m.hp[2];
const dpsOf = m => (m.dmg[0] * (m.dmg[1] + 1) / 2 + m.dmg[2]) / (m.speed / 1000);
{
  // a level 8 fighter in chain with a long sword, the expected state at the bottom
  const lvl = 8;
  const playerHp = 10 + 3 + 1 + (lvl - 1) * (5.5 + 1);
  const skillSpeed = 1 - Math.min(0.42, (lvl - 1) * 0.045);
  const skillDmg = Math.floor((lvl - 1) / 3);
  const w = ITEMS.longsword;
  const playerDps = (w.dmg[0] * (w.dmg[1] + 1) / 2 + w.dmg[2] + 1 + skillDmg) / (w.speed * skillSpeed / 1000);
  const boss = MONSTERS.lich;
  const timeToKill = avgHp(boss) / playerDps;
  const timeToDie = playerHp / dpsOf(boss);
  // a 25% margin at the weakest plausible arrival state, leaving room for
  // potions, spells and the odd wandering monster joining in
  check(timeToKill < timeToDie * 0.75,
    `boss fight is not winnable: ${timeToKill.toFixed(1)}s to kill it, ${timeToDie.toFixed(1)}s to die`);
  // and it should still be a fight, not a formality
  check(timeToKill > 2, `boss dies too fast: ${timeToKill.toFixed(1)}s`);
}
{
  // every class must be able to put out damage its own tier of monsters can absorb
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    const usable = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'weapon' && ITEMS[id].cls.includes(cls));
    check(usable.length >= 2, `${cls} has too few usable weapons`);
    check(usable.some(id => ITEMS[id].range), `${cls} has no way to attack at range`);
  }
}
check(vaults > 0 && fountains > 0, 'no vaults or fountains generated at all');
check(torches > 0 && elites > 0, 'no torches or elite monsters generated at all');
check(traders > 0, 'no traders generated at all');
console.log(`${levels} levels checked (${vaults} vaults, ${fountains} fountains, ${torches} torches, ${elites} champions, ${traders} traders), ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
