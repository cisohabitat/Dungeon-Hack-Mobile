// Rule checks for the hero's hands and the blows about them: what the pack merges, the two-handed
// grip and the off hand, the rolls shown in the log, the stairs pointed at, the Use button's names,
// a locked door forced face-on, a growl before a blow, blows landing one at a time and the warning
// marker. (The three fighter builds' check is in rules-builds.js, alone: it takes two minutes.)
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function combatChecks(h) {
  const { OPTS, evenStats, newContext, start, markLog, rollsOn, linesSince, test, ahead } = h;

await test('identical items with different enchantments do not merge', async () => {
  const { Game } = await start('fighter', 'r1');
  const p = Game.player();
  p.inv.length = 0;
  p.inv.push({ t: 'longsword', q: 1, e: 0 });
  p.inv.push({ t: 'longsword', q: 1, e: 2 });
  return p.inv.length === 2 && p.inv[1].e === 2;
});

await test('equipping a two-handed weapon stows the shield', async () => {
  const { Game } = await start('fighter', 'r2');
  const p = Game.player();
  if (!p.eq.shield) return true;              // nothing to stow
  p.inv.push({ t: 'greatsword', q: 1, e: 0 });
  Game.equip(p.inv[p.inv.length - 1]);
  return p.eq.weapon.t === 'greatsword' && !p.eq.shield && p.inv.some(i => i.t === 'shield');
});

await test('the off hand takes a light blade, and only from a class trained for it', async () => {
  const { Game } = await start('fighter', 'dual1');
  const p = Game.player();
  const give = t => { const it = { t, q: 1, e: 0 }; p.inv.push(it); return it; };

  if (Game.offhandReason(give('greatsword'))) { /* expected */ } else return 'a two-handed sword went into the off hand';
  if (!Game.offhandReason(give('battleaxe'))) return 'a battle axe is too heavy for the off hand';
  if (!Game.offhandReason(give('shortbow'))) return 'a bow cannot be fenced with';
  const blade = give('shortsword');
  if (Game.offhandReason(blade)) return `a short sword was refused: ${Game.offhandReason(blade)}`;
  // nor beside a weapon that needs both hands: the pack offered it, and the swap refused
  const main = p.eq.weapon; p.eq.weapon = give('longbow');
  if (!Game.offhandReason(blade)) return 'a short sword was offered for the off hand beside a long bow';
  p.eq.weapon = main;

  // taking up a second blade must free the shield hand
  if (!Game.equip(blade, true, 'offhand')) return 'the off hand refused a legal blade';
  if (p.eq.offhand !== blade) return 'the blade did not reach the off hand';
  if (p.eq.shield) return 'a shield and a second blade shared one hand';

  // and a shield cannot come back while it is full
  const sh = give('shield');
  if (!Game.canEquip(sh)) return 'a shield was allowed over a full off hand';

  // a two-handed weapon clears both
  Game.equip(give('greatsword'), true);
  if (p.eq.offhand) return 'a two-handed grip left a blade in the off hand';

  // and no other class is trained for it
  const other = await start('cleric', 'dual2');
  const c = other.Game.player();
  c.inv.push({ t: 'club', q: 1, e: 0 });
  return other.Game.offhandReason(c.inv[c.inv.length - 1]) ? true : 'a cleric dual wielded';
});

await test('a second blade buys damage with rhythm, not for free', async () => {
  const { Game } = await start('fighter', 'dual3');
  const p = Game.player();
  p.inv.push({ t: 'shortsword', q: 1, e: 0 });
  const blade = p.inv[p.inv.length - 1];

  const alone = Game.weapon().speed;
  Game.equip(blade, true, 'offhand');
  const dual = Game.weapon().speed;
  if (dual <= alone) return `dual wielding did not slow the main swing (${alone} -> ${dual})`;
  // the cost is real but not crippling: about a fifth of the swing
  const ratio = dual / alone;
  if (ratio < 1.15 || ratio > 1.25) return `the swing penalty is ${ratio.toFixed(2)}, expected about 1.2`;

  const o = Game.offhandWeapon();
  if (!o || o.name !== 'Short Sword') return 'the off hand reports no weapon';

  // the shield is the armour choice: a second blade parries for one point, no
  // more than a buckler. (It once added one against a benchmark that rounded
  // every swing up to 300ms, and was taken out; timed exactly, two blades then
  // won about 59% on Normal to the shield's 68%, and the point brings them level.)
  p.eq.offhand = null; p.eq.shield = null;
  const bare = Game.playerAC();
  p.eq.offhand = blade;
  const twoBlades = Game.playerAC();
  p.eq.offhand = null; p.eq.shield = { t: 'towershield', q: 1, e: 0 };
  const shielded = Game.playerAC();
  if (twoBlades !== bare + 1) return `a second blade changed armour class from ${bare} to ${twoBlades}, expected one point`;
  if (!(shielded > twoBlades)) return 'a second blade parried as well as a tower shield';
  if (!(shielded > bare)) return 'a tower shield added no armour';
  return true;
});

await test('the off hand swings after the main hand, hit or miss, but not after a killing blow', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'O', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'offhand-miss', opts: OPTS });
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.eq.shield = null; p.eq.weapon = { t: 'shortsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const put = hp => { L.monsters.length = 0; L.monsters.push({ uid: 1, id: 'goblin', x: p.x + dx, y: p.y + dy, hp, maxHp: hp,
    awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 }); };
  const swing = () => { G.t = p.nextAttack; const at = markLog(G); Game.input('attack'); return linesSince(G, at); };
  const second = ls => ls.some(l => /^Your off hand finds|^Your dagger goes wide/.test(l));
  // every blow misses: the off hand still has its go each time
  p.perkHit = -60; put(500);
  let missed = 0;
  for (let i = 0; i < 20; i++) {
    const ls = swing();
    if (!ls.some(l => /^You miss/.test(l))) continue;      // a natural twenty still lands
    missed++;
    if (!second(ls)) return `a miss left the off hand still: ${ls.join(' | ')}`;
  }
  if (missed < 12) return `only ${missed} of twenty sure misses missed`;
  // a killing blow leaves nothing for the second blade to strike
  p.perkHit = 60; put(1);
  const ls = swing();
  if (!ls.some(l => /destroyed|slain/.test(l))) return `the goblin lived: ${ls.join(' | ')}`;
  if (second(ls)) return `the off hand struck a dead goblin: ${ls.join(' | ')}`;
  return true;
});

await test('the combat log shows the roll that decided the swing, and it is true', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'V', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rolls', opts: OPTS });
  rollsOn(Game);
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const lines = [];
  for (let i = 0; i < 300; i++) {
    L.monsters.length = 0;
    L.monsters.push({ uid: 1, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 500, maxHp: 500,
      awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    G.t = p.nextAttack;
    const before = markLog(G);
    Game.input('attack');
    lines.push(...linesSince(G, before));
  }
  const hits = lines.filter(l => /^You hit /.test(l));
  const misses = lines.filter(l => /^You miss /.test(l));
  if (!hits.length || !misses.length) return 'three hundred swings produced no hit or no miss to check';
  if (!lines.every(l => !/^You (hit|miss) /.test(l) || / \(d20 /.test(l))) return 'a swing was logged without its roll';

  // the arithmetic printed has to be the arithmetic that was used
  const ac = Game.mstat(L.monsters[0]).ac;
  for (const l of lines) {
    const m = l.match(/\(d20 (\d+)\+(\d+) vs AC (\d+)\)/);
    if (!m) continue;
    const [roll, bonus, shownAc] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (shownAc !== ac) return `the log claimed AC ${shownAc}, the goblin has ${ac}`;
    const landed = /^You hit |^Your off hand|destroyed|slain/.test(l);
    if (landed && roll + bonus < shownAc) return `a hit was logged as ${roll}+${bonus} against AC ${shownAc}`;
    if (!landed && roll + bonus >= shownAc) return `a miss was logged as ${roll}+${bonus} against AC ${shownAc}`;
  }
  // a natural one and a natural twenty say so instead of printing a sum
  if (!lines.some(l => /d20 1, a fumble/.test(l))) return 'no fumble was ever spelled out';
  if (!lines.some(l => /a telling blow/.test(l))) return 'no telling blow was ever spelled out';
  return true;
});

await test('blows that land on you show their roll too, and it is true', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'V', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'incoming', opts: OPTS });
  rollsOn(Game);
  // The live dice are seeded from the clock. This test needs a natural one and
  // a natural twenty to turn up, which forty-odd unseeded rolls missed about one
  // run in five: seed them, and roll enough that neither can plausibly hide.
  ctx.Dice.s = new ctx.Rng('incoming-rolls').s;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  // a straight run of floor, so an archer three squares off has a clear shot
  outer: for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) for (let dir = 0; dir < 4; dir++) {
    const [ddx, ddy] = Dungeon.DIRS[dir];
    let ok = true;
    for (let k = 0; k <= 4; k++) if (L.tiles[(y + ddy * k) * L.w + (x + ddx * k)] !== T.FLOOR) { ok = false; break; }
    if (ok) { p.x = x; p.y = y; p.dir = dir; break outer; }
  }
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const lines = [];
  for (const [id, dist] of [['orc', 1], ['archer', 3]]) {
    L.monsters.length = 0;
    const m = { uid: 7, id, x: p.x + dx * dist, y: p.y + dy * dist, hp: 50, maxHp: 50, awake: true,
      nextAct: 0, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    for (let i = 0; i < 1500; i++) {
      p.hp = p.maxHp = 9999;               // the point is the log, not the funeral
      m.x = p.x + dx * dist; m.y = p.y + dy * dist;
      const before = markLog(G);
      Game.update(G.t + 100, 100);
      lines.push(...linesSince(G, before));
    }
  }
  const incoming = lines.filter(l => /^The .* (hits you|misses you|at you)/.test(l));
  if (!incoming.some(l => /Orc/.test(l))) return 'the orc never swung';
  if (!incoming.some(l => /Archer/.test(l))) return 'the archer never shot';
  if (!incoming.every(l => / \(d20 /.test(l))) return `an attack on you was logged without its roll: ${incoming.find(l => !/d20/.test(l))}`;

  const ac = Game.playerAC();
  for (const l of incoming) {
    const m = l.match(/\(d20 (\d+)\+(\d+) vs AC (\d+)\)/);
    if (!m) continue;
    const [roll, bonus, shownAc] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (shownAc !== ac) return `the log claimed your AC was ${shownAc}, it is ${ac}`;
    const landed = !/misses/.test(l);
    if (landed && roll + bonus < shownAc) return `a blow on you was logged as ${roll}+${bonus} against AC ${shownAc}`;
    if (!landed && roll + bonus >= shownAc) return `a miss on you was logged as ${roll}+${bonus} against AC ${shownAc}`;
  }
  if (!incoming.some(l => /a fumble/.test(l))) return 'a monster fumble was never spelled out';
  if (!incoming.some(l => /a telling blow/.test(l))) return 'a monster critical was never spelled out';
  return true;
});

await test('the rolls start hidden, and turning them off again silences them and survives a reload', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'V', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rolls2', opts: OPTS });
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  // off for a first run, with nothing stored
  if (Game.rollsShown()) return 'the rolls should be off to begin with';
  if (Game.toggleRolls() !== true) return 'toggling did not turn them on';
  if (ctx.store.get('deepdelve.rolls') !== 'on') return 'turning them on was not remembered';
  if (Game.toggleRolls() !== false) return 'toggling did not turn them off';

  const before = markLog(G);
  for (let i = 0; i < 60; i++) {
    L.monsters.length = 0;
    L.monsters.push({ uid: 1, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 500, maxHp: 500,
      awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    G.t = p.nextAttack;
    Game.input('attack');
  }
  // and let something swing back, so both directions are checked for silence
  L.monsters.length = 0;
  L.monsters.push({ uid: 2, id: 'orc', x: p.x + dx, y: p.y + dy, hp: 500, maxHp: 500,
    awake: true, nextAct: 0, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  for (let i = 0; i < 40; i++) { p.hp = p.maxHp = 9999; Game.update(G.t + 100, 100); }
  const quiet = linesSince(G, before);
  if (!quiet.length) return 'no swings were logged at all';
  if (!quiet.some(l => /^The Orc (hits|misses) you/.test(l))) return 'the orc never swung back';
  if (quiet.some(l => /d20/.test(l))) return 'a roll was printed with the rolls turned off';
  if (!quiet.some(l => /^You (hit|miss) /.test(l))) return 'the swings themselves stopped being reported';

  // the preference is remembered, and is not part of the run
  if (ctx.store.get('deepdelve.rolls') !== 'off') return 'the preference was not remembered';
  Game.save(true);
  const saved = [...ctx.store.entries()].filter(([k]) => k !== 'deepdelve.rolls').map(([, v]) => v).join('');
  if (/showRolls|"rolls"/.test(saved)) return 'the preference leaked into the save file';
  Game.toggleRolls();
  return Game.rollsShown() === true || 'toggling did not turn them back on';
});

await test('standing beside the stairs facing stone, the game points at them', async () => {
  // The second playtest reached the stairs, faced the wall beside them, bumped
  // it and searched it, and was told nothing useful either time.
  const ctx = await newContext();
  const { Game, Dungeon } = ctx, T = Dungeon.T;
  // a seed whose stair has open floor beside its approach, along the wall
  let side = null, ds = null, toward = 0;
  for (let n = 0; n < 12 && !side; n++) {
    Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: n ? `stair-hint-${n}` : 'stair-hint',
      opts: { ...OPTS, lockedDoors: true, traps: true } });
    const L = Game.level();
    ds = L.downStart; toward = (ds.dir + 2) % 4;     // arrival faces away from the stair
    for (const turn of [1, 3]) {
      const k = (toward + turn) % 4, sx = ds.x - Dungeon.DIRS[k][0], sy = ds.y - Dungeon.DIRS[k][1];
      // (and a plain wall beside the approach, to bump and search)
      const plainWall = [0, 1, 2, 3].some(j => j !== toward && L.tiles[(ds.y + Dungeon.DIRS[j][1]) * L.w + ds.x + Dungeon.DIRS[j][0]] === T.WALL);
      if (L.tiles[sy * L.w + sx] === T.FLOOR && plainWall) { side = { x: sx, y: sy, dir: k, turn }; break; }
    }
  }
  if (!side) return 'no seed had floor and a plain wall beside the stair approach';
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  for (const k in L.items) delete L.items[k];
  let now = 0;
  const settle = () => { for (let i = 0; i < 20; i++) { now += 50; Game.update(now, 50); } };
  const say = fn => { const m = markLog(G); fn(); settle(); return linesSince(G, m).join(' | '); };
  p.x = side.x; p.y = side.y; p.dir = side.dir; settle();
  const stepped = say(() => Game.input('forward'));
  const where = side.turn === 1 ? 'on your left' : 'on your right';
  if (!stepped.includes(`Stairs lead down, ${where}`)) return `stepping alongside said: "${stepped}"`;
  // stepping again beside the same stair must not repeat it
  // now face the wall that is not the stair, bump it and search it
  let wall = -1;
  for (let k = 0; k < 4; k++) if (k !== toward && L.tiles[(p.y + Dungeon.DIRS[k][1]) * L.w + (p.x + Dungeon.DIRS[k][0])] === T.WALL) wall = k;
  if (wall < 0) return 'no plain wall beside the approach';
  p.dir = wall;
  // (a plain wall beside the way says Use, not Search: only a dead end is worth searching; the button still searches)
  if (!['Use', 'Search'].includes(Game.useLabel())) return `facing a wall, Use says "${Game.useLabel()}"`;
  const bump = say(() => Game.input('forward'));
  if (!/A wall blocks your path\. The stairs down are (on your left|on your right|behind you)\./.test(bump)) return `the bump said: "${bump}"`;
  const search = say(() => Game.input('use'));
  if (!/You search the wall but find nothing\. The stairs down are /.test(search)) return `the search said: "${search}"`;
  // face them: the button says what it will do, and doing it works
  p.dir = toward;
  if (Game.useLabel() !== 'Descend') return `facing the stair, Use says "${Game.useLabel()}"`;
  say(() => Game.input('use'));
  return G.depth === 2 || `Use on the stair left you on level ${G.depth}`;
});

await test('the Use button names each thing it can do', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx, T = Dungeon.T;
  Game.newGame({ name: 'U', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'use-label', opts: OPTS });
  const p = Game.player(), L = Game.level();
  L.monsters.length = 0;
  for (const k in L.items) delete L.items[k];
  L.dressing = [];
  const ahead = () => { const [dx, dy] = Dungeon.DIRS[p.dir]; return (p.y + dy) * L.w + (p.x + dx); };
  const was = L.tiles[ahead()];
  // (a wall says Search only at a dead end, with walls to either side: see rules-review.js)
  const side = k => { const [dx, dy] = Dungeon.DIRS[(p.dir + k) % 4]; return (p.y + dy) * L.w + (p.x + dx); };
  const sides = [L.tiles[side(1)], L.tiles[side(3)]];
  L.tiles[side(1)] = T.WALL; L.tiles[side(3)] = T.WALL;
  const expect = [[T.DOOR, 'Open'], [T.DOOR_LOCKED, 'Force'], [T.STAIRS_DOWN, 'Descend'], [T.FOUNTAIN, 'Drink'],
    [T.DOOR_OPEN, 'Close'], [T.WALL, 'Search'], [T.TORCH, 'Search'], [T.SECRET, 'Search'], [T.FLOOR, 'Use']];
  for (const [t, want] of expect) {
    L.tiles[ahead()] = t;
    if (Game.useLabel() !== want) return `facing tile ${t}, Use says "${Game.useLabel()}", wanted "${want}"`;
  }
  [L.tiles[side(1)], L.tiles[side(3)]] = sides;
  // a crate on the floor ahead is broken with it
  L.dressing.push({ x: ahead() % L.w, y: (ahead() / L.w) | 0, k: 'crate', ox: 0, oy: 0 });
  if (Game.useLabel() !== 'Break') return `facing a crate, Use says "${Game.useLabel()}"`;
  L.dressing = [];
  // with the key for that lock in hand, it says Unlock instead of Force
  L.tiles[ahead()] = T.DOOR_LOCKED;
  const [lx, ly] = [ahead() % L.w, (ahead() / L.w) | 0];
  L.locks[lx + ',' + ly] = 'silver';
  p.inv.push({ t: 'key', q: 1, color: 'silver' });
  if (Game.useLabel() !== 'Unlock') return `holding the silver key, Use says "${Game.useLabel()}"`;
  p.inv.pop(); delete L.locks[lx + ',' + ly];
  L.tiles[ahead()] = T.FLOOR;
  // a hidden door must not label differently from the wall it hides in
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.push({ uid: 5, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 3, maxHp: 3, awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  if (Game.useLabel() !== 'Use') return `facing a rat, Use says "${Game.useLabel()}" (the Attack button already says Attack)`;
  L.monsters.length = 0;
  (L.items[p.x + ',' + p.y] = []).push({ t: 'ration', q: 1 });
  if (Game.useLabel() !== 'Take') return `standing on a ration, Use says "${Game.useLabel()}"`;
  delete L.items[p.x + ',' + p.y];
  L.tiles[ahead()] = was;
  return true;
});

await test('a locked door is forced only face-on: a step aside or back into one is a bump, though a key still opens it', async () => {
  const out = [];
  const ctx = await newContext();
  const { Game, Dungeon } = ctx, T = Dungeon.T, D = Dungeon.DIRS;
  Game.newGame({ name: 'L', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, str: 18 }, seed: 'lock-side', opts: OPTS });
  const G = Game.state(), p = Game.player(), L = Game.level();
  L.monsters.length = 0;
  // the hero faces east (1); the doors are set round the hero fresh for each step
  p.dir = 1;
  const at = rel => { const [dx, dy] = D[(p.dir + rel) % 4]; return [p.x + dx, p.y + dy]; };
  const lockAt = (rel, colour) => { const [x, y] = at(rel); L.tiles[y * L.w + x] = T.DOOR_LOCKED; L.locks[x + ',' + y] = colour; return [x, y]; };
  const real = Math.random;
  Math.random = () => 0;          // a shoulder thrown at it would always burst it
  try {
    for (const [rel, act] of [[1, 'strafeR'], [3, 'strafeL'], [2, 'back']]) {
      const [x, y] = lockAt(rel, 'iron');
      const t0 = p.nextAttack, mark = markLog(G);
      Game.input(act);
      if (L.tiles[y * L.w + x] !== T.DOOR_LOCKED) out.push(`a ${act} into a locked door forced it`);
      if (p.nextAttack !== t0) out.push(`a ${act} into a locked door cost the hero a moment`);
      if (!linesSince(G, mark).some(l => /locked/.test(l) && /face it/.test(l))) out.push(`a ${act} into a locked door said nothing of facing it: ${linesSince(G, mark).join(' | ')}`);
      L.tiles[y * L.w + x] = T.WALL; delete L.locks[x + ',' + y];
      G.t += 1000;
    }
    // face-on, it is forced as before
    { const [x, y] = lockAt(0, 'iron');
      Game.input('forward');
      if (L.tiles[y * L.w + x] !== T.DOOR_OPEN) out.push('walking into a locked door ahead did not force it');
      L.tiles[y * L.w + x] = T.WALL; G.t += 2000; }
    // and with its key, a door at the side opens all the same
    { const [x, y] = lockAt(1, 'silver');
      p.inv.push({ t: 'key', q: 1, color: 'silver' });
      Game.input('strafeR');
      if (L.tiles[y * L.w + x] !== T.DOOR_OPEN) out.push('a step aside into a locked door, key in hand, did not unlock it'); }
  } finally { Math.random = real; }
  return out.length ? out.join('; ') : true;
});

await test('a monster that wakes beside you growls before it strikes', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'W', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'wake', opts: OPTS });
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  // beside you but not in front: you start with the stairs at your back, so
  // take whichever flank is open floor
  const k = [1, 3, 2].map(r => (p.dir + r) % 4).find(k => L.tiles[(p.y + Dungeon.DIRS[k][1]) * L.w + (p.x + Dungeon.DIRS[k][0])] === T.FLOOR);
  if (k === undefined) return 'the start square has no open flank on this seed';
  const [dx, dy] = Dungeon.DIRS[k];
  L.monsters.length = 0;
  const m = { uid: 9, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 20, maxHp: 20, awake: false, nextAct: 0,
    rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(m);
  const hp0 = p.hp;
  const mark = markLog(G);
  Game.update(G.t + 16, 16);                                 // one frame
  if (!m.awake) return 'a goblin at your back did not notice you';
  if (linesSince(G, mark).some(l => /Goblin (hits|misses) you/.test(l)) || p.hp < hp0) return 'it struck in the same frame it woke';
  // well inside the beat: still nothing
  for (let t = 0; t < 400; t += 50) Game.update(G.t + 50, 50);
  if (linesSince(G, mark).some(l => /Goblin (hits|misses) you/.test(l))) return 'it struck inside the warning beat';
  // after it: it gets its swing
  for (let t = 0; t < 1500; t += 50) { p.hp = p.maxHp; Game.update(G.t + 50, 50); }
  return linesSince(G, mark).some(l => /Goblin (hits|misses) you/.test(l)) || 'it never swung at all';
});

await test('blows from several attackers land one at a time', async () => {
  const ctx = await newContext();
  const { Game, Dungeon, Rng } = ctx;
  Game.newGame({ name: 'B', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'crowd', opts: OPTS });
  ctx.Dice.s = new Rng('crowd').s;
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  // surround the hero, all set to swing on the same instant
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = Dungeon.DIRS[k];
    L.monsters.push({ uid: 20 + k, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 99, maxHp: 99, awake: true, nextAct: G.t,
      rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  }
  const times = [];
  for (let i = 0; i < 400; i++) {
    p.hp = p.maxHp = 9999;
    const mark = markLog(G);
    Game.update(G.t + 10, 10);
    for (const l of linesSince(G, mark)) if (/Rat (hits|misses) you/.test(l)) times.push(G.t);
  }
  if (times.length < 6) return `only ${times.length} blows in four seconds from four rats`;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] < 250) return `two blows landed ${times[i] - times[i - 1]}ms apart`;
  }
  return true;
});

await test('a warning marker points at anything closing in from out of sight', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'M', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'threat', opts: OPTS });
  const p = Game.player(), L = Game.level();
  const side = ['ahead', 'right', 'behind', 'left'];
  // [forward, right, what the marker should say]
  const cases = [[1, 0, null], [2, 0, null], [0, 1, 'right near'], [-1, 0, 'behind near'], [0, -1, 'left near'],
    [0, 2, 'right far'], [-2, 0, 'behind far'], [1, 1, 'right far'], [-1, -1, 'left far'], [3, 0, null], [0, 3, null]];
  for (let dir = 0; dir < 4; dir++) {
    p.dir = dir;
    const F = Dungeon.DIRS[dir], R = Dungeon.DIRS[(dir + 1) % 4];
    for (const [f, r, want] of cases) {
      L.monsters.length = 0;
      L.monsters.push({ uid: 1, id: 'goblin', x: p.x + F[0] * f + R[0] * r, y: p.y + F[1] * f + R[1] * r, hp: 5, maxHp: 5,
        awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const t = Game.renderState(0).fx.threats;
      const got = t.length ? `${side[t[0].rel]} ${t[0].near ? 'near' : 'far'}` : null;
      if (got !== want) return `facing ${dir}, a goblin ${f} ahead and ${r} right showed ${got}, wanted ${want}`;
    }
  }
  // a sleeping or fleeing one is no threat
  L.monsters[0].x = p.x - Dungeon.DIRS[p.dir][0]; L.monsters[0].y = p.y - Dungeon.DIRS[p.dir][1];
  L.monsters[0].awake = false;
  if (Game.renderState(0).fx.threats.length) return 'a sleeping monster raised the alarm';
  L.monsters[0].awake = true; L.monsters[0].fleeing = true;
  return Game.renderState(0).fx.threats.length === 0 || 'a fleeing monster raised the alarm';
});
};
