'use strict';
// Generator, sprite and balance checks. These run without a browser: the game's
// modules are imported directly and exercised as libraries.
const { loadGame } = require('./harness');

async function main() {
const { Dungeon, SPRITES, MONSTERS, ITEMS, CREATURES, POSES, PROPS, FLOATING, paintParts, ENCOUNTERS, RELICS, RELIC_POWERS, CLASSES, ITEM_ART, KEY_COLORS, POTION_LOOKS } = await loadGame();
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

// Every module the game loads must be in the offline cache, or an installed
// copy fails to start without a connection. New files are easy to forget.
{
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/(js\/[a-z]+\.js)'/g)].map(m => m[1]));
  for (const f of fs.readdirSync(path.join(root, 'js'))) {
    if (!f.endsWith('.js') || f === 'types.js') continue;   // types.js is read by the checker only
    check(listed.has('js/' + f), `js/${f} is not in the offline cache in sw.js`);
    // Safari before 16.4 cannot read a lookbehind: a regex with one throws the
    // moment it is made, and the log made one on the first line of every run
    const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    check(!/\(\?<[!=]/.test(src), `js/${f} uses a lookbehind, which older Safari cannot read`);
  }
}

// every creature the game can put in front of you has a picture
for (const id in MONSTERS) {
  const sp = MONSTERS[id].sprite;
  check(CREATURES[sp] || SPRITES[sp], `monster ${id} wants sprite '${sp}', which does not exist`);
}
check(CREATURES.merchant, 'the trader has no sprite');

// Creatures built from parts: each paints something sensible, grounded ones
// stand on the floor, and no two share a silhouette. The old grids had seven
// humanoids that were one body in different colours; this is the guard.
const masks = {};
const filledCount = k => paintParts(CREATURES[k]()).color.filter(Boolean).length;
for (const k in CREATURES) {
  const { aw, ah, color } = paintParts(CREATURES[k]());
  // every monster carries hand-drawn detail on the fine grid, and it shows
  if (MONSTERS[k]) {
    const fine = CREATURES[k]().filter(p => p.k === 'specks' || p.k === 'hair');
    check(fine.length >= 6, `${k} has only ${fine.length} fine details`);
    const hi = paintParts(CREATURES[k](), 32, 2);
    check(hi.aw === 64 && hi.color.filter(Boolean).length > filledCount(k) * 3.2, `${k} painted finely covers too little`);
  }
  const filled = color.filter(Boolean);
  check(aw === 32 && ah === 32, `${k} painted at ${aw}x${ah}, not 32x32`);
  check(filled.length > 120, `${k} painted only ${filled.length} pixels`);
  check(filled.every(c => /^#[0-9a-f]{6}$/.test(c)), `${k} painted a colour that is not #rrggbb`);
  let lowest = -1;
  color.forEach((c, i) => { if (c) lowest = Math.max(lowest, Math.floor(i / aw)); });
  if (!FLOATING.has(k)) check(lowest >= 29, `${k} floats: its lowest pixel is row ${lowest}, the floor is 31`);
  masks[k] = color.map(Boolean);
}
// A creature's other poses (a blow drawn back, a trick readied) paint from
// the same parts, stand on the same floor, and are a different picture
for (const k in POSES) {
  check(CREATURES[k], `poses are given for '${k}', which is not a creature`);
  if (!CREATURES[k]) continue;
  const rest = paintParts(CREATURES[k]()).color;
  for (const pose of POSES[k]) {
    check(['windup', 'special'].includes(pose), `${k} has a pose '${pose}' the view never shows`);
    const { color } = paintParts(CREATURES[k](pose));
    const filled = color.filter(Boolean);
    check(filled.length > 120 && filled.every(c => /^#[0-9a-f]{6}$/.test(c)), `${k} painted badly in its ${pose} pose`);
    let lowest = -1, moved = 0;
    color.forEach((c, i) => { if (c) lowest = Math.max(lowest, Math.floor(i / 32)); if (c !== rest[i]) moved++; });
    if (!FLOATING.has(k)) check(lowest >= 29, `${k} floats in its ${pose} pose`);
    check(moved > 60, `${k}'s ${pose} pose is hardly different from its rest (${moved} pixels)`);
  }
}
// every encounter has a prop to stand in the corridor, and every prop paints
for (const id in ENCOUNTERS) check(PROPS[ENCOUNTERS[id].sprite], `encounter ${id} wants prop '${ENCOUNTERS[id].sprite}', which does not exist`);

// Relics ride on real gear, use only powers the rules honour, and every
// power is carried by something.
{
  const used = new Set(), names = new Set();
  for (const id in RELICS) {
    const r = RELICS[id], b = ITEMS[r.t];
    // a road's own relic is a ring or an amulet, for whoever takes the road
    check(b && (['weapon', 'armor', 'shield'].includes(b.kind) || (r.route && ['ring', 'amulet'].includes(b.kind))), `relic ${id} rides on '${r.t}', which is not gear`);
    check(r.powers.length && r.powers.every(k => RELIC_POWERS[k]), `relic ${id} has a power the rules do not know`);
    check(r.e >= 1 && r.e <= 2, `relic ${id} is +${r.e}`);
    check(r.name && r.lore && r.value > 0, `relic ${id} is missing its name, story or value`);
    check(!names.has(r.name.toLowerCase()), `two relics are called ${r.name}`);
    check(/^(the |[A-Z])/.test(r.name), `relic ${id}'s name "${r.name}" will not read right mid-sentence`);
    names.add(r.name.toLowerCase());
    r.powers.forEach(k => used.add(k));
  }
  // a ring or an amulet carries a power too, and must carry one the rules know
  for (const id in ITEMS) {
    const b = ITEMS[id];
    // a piece made with a power of its own (a wyrm's scales) carries it too, and it must be one the rules know
    if (b.power && b.kind !== 'ring' && b.kind !== 'amulet') { [].concat(b.power).forEach(k => { check(RELIC_POWERS[k], `${id} carries '${k}', a power the rules do not know`); used.add(k); }); continue; }
    if (b.kind !== 'ring' && b.kind !== 'amulet') continue;
    const ps = [].concat(b.power || []);
    check(ps.length && ps.every(k => RELIC_POWERS[k]), `${id} has no power, or one the rules do not know`);
    check(b.desc && b.value > 0 && b.tier >= 1, `${id} is missing its description, value or tier`);
    ps.forEach(k => used.add(k));
  }
  for (const k in RELIC_POWERS) check(used.has(k), `no relic, ring or amulet carries the '${k}' power`);
  check(Object.keys(CLASSES).length === 5, 'the class list changed; check every class still has relics (the ranger has seven)');
}
for (const k in PROPS) {
  const { color } = paintParts(PROPS[k]());
  const filled = color.filter(Boolean);
  check(filled.length > 80, `prop ${k} painted only ${filled.length} pixels`);
  check(filled.every(c => /^#[0-9a-f]{6}$/.test(c)), `prop ${k} painted a colour that is not #rrggbb`);
  let lowest = -1;
  color.forEach((c, i) => { if (c) lowest = Math.max(lowest, Math.floor(i / 32)); });
  if (!FLOATING.has(k)) check(lowest >= 29, `prop ${k} floats: its lowest pixel is row ${lowest}`);
}
// Every item has a picture, painted from parts, and no two pieces of gear
// share one: a chain shirt must not look like plate. The armours share an
// outline on purpose, so pictures are compared pixel for pixel, colour and all.
{
  const want = new Set([...Object.values(ITEMS).map(b => b.sprite), ...POTION_LOOKS.map(l => l[1]), ...Object.keys(KEY_COLORS).map(c => 'key_' + c)]);
  for (const k of want) check(ITEM_ART[k] || SPRITES[k], `sprite '${k}' is wanted by an item but painted nowhere`);
  const gearMask = {};
  for (const k in ITEM_ART) {
    const { color } = paintParts(ITEM_ART[k]());
    const filled = color.filter(Boolean);
    check(filled.length > 40, `item ${k} painted only ${filled.length} pixels`);
    check(filled.every(c => /^#[0-9a-f]{6}$/.test(c)), `item ${k} painted a colour that is not #rrggbb`);
    if (Object.values(ITEMS).some(b => b.sprite === k && ['weapon', 'armor', 'shield'].includes(b.kind))) gearMask[k] = color;
  }
  const gear = Object.keys(gearMask);
  let alike = { iou: 0, pair: '' };
  for (let i = 0; i < gear.length; i++) for (let j = i + 1; j < gear.length; j++) {
    const a = gearMask[gear[i]], b = gearMask[gear[j]];
    let same = 0, uni = 0;
    for (let n = 0; n < a.length; n++) { if (a[n] && a[n] === b[n]) same++; if (a[n] || b[n]) uni++; }
    if (same / uni > alike.iou) alike = { iou: same / uni, pair: `${gear[i]} and ${gear[j]}` };
  }
  check(alike.iou < 0.5, `${alike.pair} are ${Math.round(alike.iou * 100)}% the same picture`);
  check(new Set(Object.values(ITEMS).filter(b => ['weapon', 'armor', 'shield'].includes(b.kind)).map(b => b.sprite)).size === Object.values(ITEMS).filter(b => ['weapon', 'armor', 'shield'].includes(b.kind)).length, 'two pieces of gear share a sprite');
  console.log(`${Object.keys(ITEM_ART).length} items painted; the most alike gear, ${alike.pair}, are ${Math.round(alike.iou * 100)}% the same picture`);
}
let closest = { iou: 0, pair: '' };
const keys = Object.keys(masks);
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
  const a = masks[keys[i]], b = masks[keys[j]];
  let inter = 0, uni = 0;
  for (let n = 0; n < a.length; n++) { if (a[n] && b[n]) inter++; if (a[n] || b[n]) uni++; }
  const iou = inter / uni;
  if (iou > closest.iou) closest = { iou, pair: `${keys[i]} and ${keys[j]}` };
}
check(closest.iou < 0.8, `${closest.pair} share ${Math.round(closest.iou * 100)}% of their silhouette`);
console.log(`${keys.length} creatures painted; the most alike pair, ${closest.pair}, share ${Math.round(closest.iou * 100)}% of their outline`);

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

let vaults = 0, fountains = 0, torches = 0, elites = 0, traders = 0, encounters = 0, groups = 0;
let levels = 0;
for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'kar42', 'morthal7', 'x', 'a longer seed with spaces']) {
  for (const size of ['small', 'medium', 'large']) {
    const opts = { levels: 8, size, monsters: 'many', treasure: 'rich', lockedDoors: true, traps: true };
    for (let depth = 1; depth <= 8; depth++) {
      const L = Dungeon.generate(seed, depth, opts);
      levels++;
      check(solvable(L), `level not solvable: seed=${seed} size=${size} depth=${depth}`);
      // traders and encounter props stand on floor tiles, so together they
      // must never be the only way past
      check(solvable(L, true), `a trader or encounter blocks the only route: seed=${seed} size=${size} depth=${depth}`);
      for (const n of (L.npcs || [])) {
        const who = n.kind === 'encounter' ? `encounter ${n.id}` : 'trader';
        check(L.tiles[n.y * L.w + n.x] === T.FLOOR, `${who} is not on a floor tile: seed=${seed} depth=${depth}`);
        check(!L.monsters.some(m => m.x === n.x && m.y === n.y), `a monster shares the ${who}'s tile: seed=${seed} depth=${depth}`);
        if (n.kind === 'encounter') { encounters++; continue; }
        check(n.stock.length > 0, `trader has nothing to sell: seed=${seed} depth=${depth}`);
        traders++;
      }
      vaults += L.tiles.filter(t => t === T.SECRET).length;
      fountains += Object.keys(L.features).length;
      torches += L.lights.length;
      elites += L.monsters.filter(m => m.elite).length;
      // groups: pack kinds only, never champions, none on the first floor,
      // in twos until the fifth floor and at most threes after
      for (const m of L.monsters.filter(m => m.pack)) {
        groups++;
        check(depth >= 2, `a group of ${m.id}s waits on floor ${depth}`);
        check(Dungeon.PACK_KINDS.includes(m.id), `${m.id}s came in a group`);
        check(!m.elite, `a champion ${m.id} came with company`);
        check(m.pack.length >= 1 && m.pack.length <= (depth >= 5 ? 2 : 1), `a group of ${1 + m.pack.length} ${m.id}s on floor ${depth}`);
        check(m.pack.every(b => b.hp > 0 && b.hp === b.maxHp), `a ${m.id} in a group started hurt or dead`);
      }
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
check(groups > 0, 'no monster groups generated at all');
check(traders > 0, 'no traders generated at all');

// A wide sweep aimed squarely at the trader, who is a solid tile and so can seal
// a level off. The suite above uses a handful of fixed seeds, which is not enough
// to catch a fault that shows up in well under one percent of levels.
{
  let sweptTraders = 0, sweptEncounters = 0, sealed = 0, onLoot = 0, onKey = 0, lairByShop = 0, together = 0, heaped = 0, inTheWay = 0, onUsed = 0;
  for (let s = 0; s < 150; s++) {
    for (const size of ['small', 'medium', 'large']) {
      for (let depth = 1; depth <= 8; depth++) {
        const L = Dungeon.generate('sweep' + s, depth, { levels: 8, size, monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
        for (const n of (L.npcs || [])) {
          if (n.kind === 'encounter') sweptEncounters++; else sweptTraders++;
          const under = L.items[n.x + ',' + n.y] || [];
          if (under.length) onLoot++;
          if (under.some(i => i.t === 'key')) onKey++;
          // never in a way through or in front of something used: a door, a room's open mouth, a stair, a fountain
          const T = Dungeon.T, here = L.roomId[n.y * L.w + n.x];
          if (Dungeon.DIRS.some(([dx, dy]) => {
            const i = (n.y + dy) * L.w + n.x + dx, t = L.tiles[i];
            return [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN].includes(t) || (t === T.FLOOR && L.roomId[i] !== here);
          })) inTheWay++;
        }
        // nor does anything else start on a door, a stair or a fountain, or a trap lie beside a trader
        {
          const T = Dungeon.T, USED = [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN];
          const used = k => { const [x, y] = k.split(',').map(Number); return USED.includes(L.tiles[y * L.w + x]); };
          onUsed += L.monsters.filter(m => used(m.x + ',' + m.y)).length;
          onUsed += Object.keys(L.items).filter(k => L.items[k].length && used(k)).length;
          onUsed += Object.keys(L.traps || {}).filter(k => used(k) || (L.npcs || []).some(n => {
            const [x, y] = k.split(',').map(Number); return Math.abs(n.x - x) + Math.abs(n.y - y) <= 1;
          })).length;
        }
        if ((L.npcs || []).length && !solvable(L, true)) sealed++;
        // finds left together: two or three on a square, never a heap
        for (const k in L.items) { const n = L.items[k].length; if (n >= 2) together++; if (n > 3) heaped++; }
        // a named champion's lair is not a few steps from the trader's shop
        const champ = L.monsters.find(m => MONSTERS[m.id].named), shop = (L.npcs || []).find(n => n.id === 'merchant');
        if (champ && shop && Math.abs(champ.x - shop.x) + Math.abs(champ.y - shop.y) <= 4) lairByShop++;
      }
    }
  }
  check(sweptTraders > 200, `sweep produced only ${sweptTraders} traders`);
  check(sweptEncounters > 1000, `sweep produced only ${sweptEncounters} encounters`);
  check(sealed === 0, `${sealed} levels sealed off by a trader or encounter`);
  check(onLoot === 0, `${onLoot} traders or encounters stand on loot that can never be picked up`);
  check(onKey === 0, `${onKey} traders or encounters stand on a key`);
  check(lairByShop === 0, `${lairByShop} champions' lairs sit beside a trader`);
  check(inTheWay === 0, `${inTheWay} traders or encounters stand in a doorway, a room's mouth, or in front of a stair or fountain`);
  check(onUsed === 0, `${onUsed} monsters, finds or traps start on a door, a stair or a fountain, or a trap beside a trader`);
  // dressing: the same every time for a seed, off anything that lies or stands there, and a wall-side kind by a wall
  {
    const T = Dungeon.T;
    let dressed = 0, badDress = 0, driftDress = 0;
    for (let s = 0; s < 40; s++) for (let depth = 1; depth <= 8; depth++) {
      const opts = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
      const L = Dungeon.generate('dress' + s, depth, opts), again = Dungeon.generate('dress' + s, depth, opts);
      if (JSON.stringify(L.dressing) !== JSON.stringify(again.dressing) || JSON.stringify(Dungeon.dress(L, 'dress' + s)) !== JSON.stringify(L.dressing)) driftDress++;
      const npcAt = new Set((L.npcs || []).map(n => n.x + ',' + n.y));
      for (const d of L.dressing) {
        dressed++;
        const k = d.x + ',' + d.y, i = d.y * L.w + d.x;
        const byWall = ['barrel', 'crate', 'urn'].includes(d.k) && !Dungeon.DIRS.some(([dx, dy]) => [T.WALL, T.TORCH].includes(L.tiles[(d.y + dy) * L.w + d.x + dx]));
        const byUsed = Dungeon.DIRS.some(([dx, dy]) => [T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN, T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET].includes(L.tiles[(d.y + dy) * L.w + d.x + dx]));
        const onArrival = L.downStart && d.x === L.downStart.x && d.y === L.downStart.y;
        if (L.tiles[i] !== T.FLOOR || L.roomId[i] < 0 || (L.items[k] || []).length || npcAt.has(k) || (d.x === L.start.x && d.y === L.start.y) || byWall || byUsed || onArrival) badDress++;
      }
    }
    check(dressed > 300, `only ${dressed} pieces of dressing over 320 floors`);
    check(badDress === 0, `${badDress} pieces of dressing on a find, a trader, the way in, outside a room, in front of a stair, fountain or door, or a wall-side kind out in the open`);
    check(driftDress === 0, `${driftDress} floors dressed differently from one making to the next`);
  }
  check(together > 1000, `only ${together} squares over 3600 levels hold finds left together`);
  check(heaped === 0, `${heaped} squares were made with more than three things on them`);
  // the Long Delve's floors past the eighth, down either road, keep the same rule
  let longWay = 0, longNpcs = 0;
  for (let s = 0; s < 40; s++) {
    for (const route of ['crypts', 'warrens']) {
      for (let depth = 5; depth <= 12; depth++) {
        const L = Dungeon.generate('longsweep' + s, depth, { levels: 12, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route });
        const T = Dungeon.T;
        for (const n of (L.npcs || [])) {
          longNpcs++;
          const here = L.roomId[n.y * L.w + n.x];
          if (Dungeon.DIRS.some(([dx, dy]) => {
            const i = (n.y + dy) * L.w + n.x + dx, t = L.tiles[i];
            return [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET, T.STAIRS_DOWN, T.STAIRS_UP, T.FOUNTAIN].includes(t) || (t === T.FLOOR && L.roomId[i] !== here);
          })) longWay++;
        }
      }
    }
  }
  check(longNpcs > 200, `the long sweep found only ${longNpcs} traders and encounters`);
  check(longWay === 0, `${longWay} traders or encounters on a Long Delve's floors stand in the way`);
  console.log(`standing sweep: ${sweptTraders} traders and ${sweptEncounters} encounters over 3600 levels, ${sealed} sealed, ${onLoot} on loot, ${together} squares with finds together`);
}
  console.log(`${levels} levels checked (${vaults} vaults, ${fountains} fountains, ${torches} torches, ${elites} champions, ${groups} groups, ${traders} traders, ${encounters} encounters), ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
