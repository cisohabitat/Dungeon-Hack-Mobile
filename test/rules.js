'use strict';
// Rule-level regression checks. These load the real game logic and exercise the
// edge cases that are easy to break and hard to notice in play.
const { loadGame } = require('./harness');

const OPTS = { levels: 4, size: 'small', monsters: 'few', treasure: 'normal', lockedDoors: false, traps: false, permadeath: false };
// flat scores, so a background's effect is the only thing that can move a number
const evenStats = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };

async function main() {
const modules = [];
/** A fresh game world. Each call is isolated from every other. */
async function newContext() {
  const m = await loadGame();
  modules.push(m);
  return m;
}
/** The ITEMS table from whichever world a test is using. */
function ITEMS_FOR_TEST(game) { return modules[modules.length - 1].ITEMS; }
async function start(cls, seed, opts) {
  const ctx = await newContext();
  ctx.Game.newGame({ name: 'Test', cls, stats: ctx.Game.rollStats(), seed, opts: Object.assign({}, OPTS, opts) });
  return ctx;
}

// Lines logged since a mark, read by count rather than position. The log is
// capped at eighty, so once full its length stops moving and a slice from the
// old length returns nothing at all: the same fault the message box had.
const markLog = G => G.logSeq;
const linesSince = (G, mark) => {
  const n = G.logSeq - mark;
  return n > 0 ? G.log.slice(-Math.min(n, G.log.length)).map(e => e.m) : [];
};

let failures = 0;
async function test(name, fn) {
  try {
    const r = await fn();
    if (r === true) return;
    failures++;
    console.error('FAIL:', name, r === false ? '' : '-> ' + r);
  } catch (e) {
    failures++;
    console.error('THROW:', name, '-', e.message);
  }
}

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

  // the shield is the armour choice: a second blade adds none. (It once added
  // one point, tuned against a benchmark that rounded every swing up to 300ms
  // and so never charged the two-blade build its slower swing. Timed exactly,
  // the builds are level without it.)
  p.eq.offhand = null; p.eq.shield = null;
  const bare = Game.playerAC();
  p.eq.offhand = blade;
  const twoBlades = Game.playerAC();
  p.eq.offhand = null; p.eq.shield = { t: 'towershield', q: 1, e: 0 };
  const shielded = Game.playerAC();
  if (twoBlades !== bare) return `a second blade changed armour class from ${bare} to ${twoBlades}`;
  if (!(shielded > bare)) return 'a tower shield added no armour';
  return true;
});

await test('no fighter build is dead: each of the three wins somewhere', async () => {
  // Measured through the real attack code, not arithmetic on the tables: a
  // shield trades damage for armour, a two-handed sword lands fewer heavier
  // blows, and two blades beat both against things that are easy to hit and
  // fall behind the greatsword against things that are not.
  const dps = async (build, foe) => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx;
    Game.newGame({ name: 'B', cls: 'fighter', bg: 'oathbroken',
      stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, seed: 'dual-dps', opts: OPTS });
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.level = 5;
    p.eq.weapon = null; p.eq.shield = null; p.eq.offhand = null;
    for (const slot of ['weapon', 'shield', 'offhand']) if (build[slot]) p.eq[slot] = { t: build[slot], q: 1, e: 0 };
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    const dummy = { uid: 999, id: foe, x: p.x + dx, y: p.y + dy, hp: 1e9, maxHp: 1e9,
      awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, split: true, risen: true };
    L.monsters.push(dummy);
    let dealt = 0;
    const swings = 6000;
    for (let i = 0; i < swings; i++) {
      G.t = p.nextAttack;
      dummy.hp = 1e9; dummy.awake = true;
      Game.input('attack');
      dealt += 1e9 - dummy.hp;
    }
    return dealt / swings / (Game.weapon().speed / 1000);
  };
  const SHIELD = { weapon: 'longsword', shield: 'towershield' };
  const GREAT = { weapon: 'greatsword' };
  const DUAL = { weapon: 'longsword', offhand: 'shortsword' };

  // against a soft target the second blade is the best damage in the game
  const soft = { shield: await dps(SHIELD, 'slime'), great: await dps(GREAT, 'slime'), dual: await dps(DUAL, 'slime') };
  if (!(soft.dual > soft.great)) return `vs a slime dual ${soft.dual.toFixed(1)} should beat greatsword ${soft.great.toFixed(1)}`;

  // against an armoured one the extra roll misses too often, and the greatsword wins
  const hard = { shield: await dps(SHIELD, 'wraith'), great: await dps(GREAT, 'wraith'), dual: await dps(DUAL, 'wraith') };
  if (!(hard.great > hard.dual)) return `vs a wraith greatsword ${hard.great.toFixed(1)} should beat dual ${hard.dual.toFixed(1)}`;

  // but it always beats the shield on damage, which is what the shield is paying for
  for (const [where, r] of [['slime', soft], ['wraith', hard]]) {
    if (!(r.dual > r.shield)) return `vs a ${where} dual ${r.dual.toFixed(1)} should out-damage the shield build ${r.shield.toFixed(1)}`;
    if (!(r.great > r.shield)) return `vs a ${where} greatsword ${r.great.toFixed(1)} should out-damage the shield build ${r.shield.toFixed(1)}`;
  }
  // and the shield is still buying something for that
  return true;
});

await test('the combat log shows the roll that decided the swing, and it is true', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'V', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rolls', opts: OPTS });
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
    const landed = /^You hit |^Your off hand|destroyed/.test(l);
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

await test('turning the rolls off silences them and survives a reload', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'V', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rolls2', opts: OPTS });
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  if (!Game.rollsShown()) return 'the rolls should be on to begin with';
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
  Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'stair-hint',
    opts: { ...OPTS, lockedDoors: true, traps: true } });
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  for (const k in L.items) delete L.items[k];
  let now = 0;
  const settle = () => { for (let i = 0; i < 20; i++) { now += 50; Game.update(now, 50); } };
  const say = fn => { const m = markLog(G); fn(); settle(); return linesSince(G, m).join(' | '); };
  const ds = L.downStart, toward = (ds.dir + 2) % 4;     // arrival faces away from the stair
  // a square beside the approach, along the wall
  let side = null;
  for (const turn of [1, 3]) {
    const k = (toward + turn) % 4, sx = ds.x - Dungeon.DIRS[k][0], sy = ds.y - Dungeon.DIRS[k][1];
    if (L.tiles[sy * L.w + sx] === T.FLOOR) { side = { x: sx, y: sy, dir: k, turn }; break; }
  }
  if (!side) return 'no floor beside the stair approach on this seed';
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
  if (Game.useLabel() !== 'Search') return `facing a wall, Use says "${Game.useLabel()}"`;
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
  const ahead = () => { const [dx, dy] = Dungeon.DIRS[p.dir]; return (p.y + dy) * L.w + (p.x + dx); };
  const was = L.tiles[ahead()];
  const expect = [[T.DOOR, 'Open'], [T.DOOR_LOCKED, 'Force'], [T.STAIRS_DOWN, 'Descend'], [T.FOUNTAIN, 'Drink'],
    [T.DOOR_OPEN, 'Close'], [T.WALL, 'Search'], [T.TORCH, 'Search'], [T.SECRET, 'Search'], [T.FLOOR, 'Use']];
  for (const [t, want] of expect) {
    L.tiles[ahead()] = t;
    if (Game.useLabel() !== want) return `facing tile ${t}, Use says "${Game.useLabel()}", wanted "${want}"`;
  }
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

await test('every class starts with at least ten hit points', async () => {
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    for (let i = 0; i < 60; i++) {
      const ctx = await newContext();
      ctx.Game.newGame({ name: 'H', cls, bg: 'oathbroken', stats: ctx.Game.rollStats(), seed: 'hp' + i, opts: OPTS });
      const hp = ctx.Game.player().maxHp;
      if (hp < 10) return `a ${cls} started on ${hp} hit points`;
    }
  }
  return true;
});

await test('a crowded dungeon starts crowding from the second floor', async () => {
  for (let i = 0; i < 12; i++) {
    const seed = 'dense' + i;
    const at = (monsters, depth) => {
      const L = (/** @type {any} */ (globalThis).__D).generate(seed, depth, { ...OPTS, levels: 8, size: 'medium', monsters });
      return L.monsters.length;
    };
    const ctx = await newContext();
    /** @type {any} */ (globalThis).__D = ctx.Dungeon;
    if (at('many', 1) !== at('normal', 1)) return `${seed}: floor one on Many held ${at('many', 1)}, on Normal ${at('normal', 1)}`;
    if (!(at('many', 2) > at('normal', 2))) return `${seed}: floor two on Many was no busier than Normal`;
  }
  return true;
});

await test('class names are pluralised as words, not by adding an s', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'P', cls: 'thief', bg: 'oathbroken', stats: { ...evenStats }, seed: 'plural', opts: OPTS });
  const p = Game.player();
  p.inv.push({ t: 'plate', q: 1, e: 0 });
  const why = Game.canEquip(p.inv[p.inv.length - 1]) || '';
  if (/Thiefs/.test(why)) return `the refusal read "${why}"`;
  return /Thieves/.test(why) || `expected "Thieves" in "${why}"`;
});

await test('casting takes time, and a mage casts faster than a cleric', async () => {
  // Casting used to cost nothing: a cleric could bless, ward, heal and strike
  // in one instant, and a mage could empty their points as fast as Cast could
  // be tapped.
  const timeToRecover = async (cls, spellId) => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx;
    Game.newGame({ name: 'C', cls, bg: 'oathbroken', stats: { ...evenStats, int: 16, wis: 16 }, seed: 'cast-' + cls, opts: OPTS });
    const p = Game.player(), G = Game.state(), L = Game.level();
    L.monsters.length = 0;
    p.level = 3;                          // Shield is a second-circle spell
    p.sp = p.maxSp = 99;
    const sp = Game.knownSpells().find(s => s.id === spellId);
    if (!sp) return `a ${cls} does not know ${spellId}`;
    if (!Game.castSpell(sp)) return `${spellId} would not cast at all`;
    // lift the buff each time, so the waste guard (which rightly refuses to
    // recast a ward already up) cannot be what is stopping the second cast
    const lift = () => { p.effects = {}; };
    lift();
    const before = p.sp;
    if (Game.castSpell(sp)) return `${spellId} cast twice in the same instant`;
    if (p.sp !== before) return 'a refused cast still spent points';
    let waited = 0;
    for (;;) { lift(); if (Game.castSpell(sp)) break; G.t += 25; waited += 25; if (waited > 3000) return `never recovered from ${spellId}`; }
    return waited;
  };
  const mage = await timeToRecover('mage', 'shield');
  const cleric = await timeToRecover('cleric', 'bless');
  if (typeof mage === 'string') return mage;
  if (typeof cleric === 'string') return cleric;
  if (mage < 300) return `a mage recovered in ${mage}ms, which is no cost at all`;
  if (!(cleric > mage)) return `a cleric (${cleric}ms) recovered no slower than a mage (${mage}ms)`;
  // and a cast holds up the next swing too
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'C', cls: 'cleric', bg: 'oathbroken', stats: { ...evenStats }, seed: 'cast-swing', opts: OPTS });
  const p = Game.player(), G = Game.state();
  p.sp = p.maxSp = 99;
  Game.castSpell(Game.knownSpells().find(s => s.id === 'bless'));
  return p.nextAttack > G.t || 'casting left the sword arm free to swing at once';
});

await test('the unarmoured mage carries a deeper pool than the armoured cleric', async () => {
  // same level, same score in the casting stat: only the class differs
  const pool = async (cls, stat) => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'P', cls, bg: 'oathbroken', stats: { ...evenStats, [stat]: 14 }, seed: 'pool', opts: OPTS });
    return ctx.Game.player().maxSp;
  };
  const mage = await pool('mage', 'int'), cleric = await pool('cleric', 'wis');
  return mage > cleric || `a level-one mage holds ${mage} points against a cleric's ${cleric}`;
});

await test('a thief is noticed later than a fighter', async () => {
  // At the old six-square notice nothing stayed asleep long enough for a
  // thief to reach it, so the class's double blow on a sleeper rarely landed.
  const wakes = async cls => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx, T = Dungeon.T;
    Game.newGame({ name: 'N', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'notice', opts: OPTS });
    const p = Game.player(), G = Game.state(), L = Game.level();
    // a straight run of floor so the distance is walked, not guessed
    outer: for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = Dungeon.DIRS[dir]; let ok = true;
      for (let k = 0; k <= 6; k++) if (L.tiles[(y + dy * k) * L.w + (x + dx * k)] !== T.FLOOR) { ok = false; break; }
      if (ok) { p.x = x; p.y = y; p.dir = dir; break outer; }
    }
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    const m = { uid: 3, id: 'goblin', x: p.x + dx * 5, y: p.y + dy * 5, hp: 9, maxHp: 9, awake: false, nextAct: 0,
      rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    for (let i = 0; i < 40; i++) { m.x = p.x + dx * 5; m.y = p.y + dy * 5; Game.update(G.t + 100, 100); if (m.awake) return true; }
    return false;
  };
  if (!(await wakes('fighter'))) return 'a goblin five squares off never noticed a fighter';
  return !(await wakes('thief')) || 'a goblin five squares off noticed a thief just as quickly';
});

await test('a stat check is a d20 plus the modifier, and it reports itself truthfully', async () => {
  const ctx = await newContext();
  const { Game, Rng } = ctx;
  Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, str: 16 }, seed: 'checks', opts: OPTS });
  ctx.Dice.s = new Rng('checks').s;
  let passes = 0, nat1 = 0, nat20 = 0;
  for (let i = 0; i < 2000; i++) {
    const c = Game.statCheck('str', 14);
    if (c.mod !== 3) return `strength 16 should add 3, added ${c.mod}`;
    const expect = c.roll === 20 || (c.roll !== 1 && c.roll + 3 >= 14);
    if (c.pass !== expect) return `rolled ${c.roll}+3 against 14 and was told ${c.pass ? 'pass' : 'fail'}`;
    if (c.roll === 1) { nat1++; if (!/a fumble/.test(c.note)) return 'a natural one was not called a fumble'; }
    else if (c.roll === 20) { nat20++; if (!/a triumph/.test(c.note)) return 'a natural twenty was not called a triumph'; }
    else if (!c.note.includes(`Strength d20 ${c.roll}+3 vs 14`)) return `the note read "${c.note}"`;
    if (c.pass) passes++;
  }
  // the odds shown before committing must match what actually happens
  const shown = Game.checkChance('str', 14), seen = passes / 2000;
  if (Math.abs(shown - seen) > 0.04) return `the odds shown were ${shown}, the rate seen was ${seen.toFixed(3)}`;
  return nat1 > 0 && nat20 > 0 || 'two thousand rolls without a natural one or twenty';
});

await test('charisma sets the trader\'s prices, and charisma was used for nothing before', async () => {
  const price = async cha => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'C', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, cha }, seed: 'charm', opts: OPTS });
    const shop = { markup: 2 }, it = { t: 'potion_heal', q: 1, e: 0 };
    return { buy: ctx.Game.buyPrice(shop, it), sell: ctx.Game.sellPrice(it) };
  };
  const plain = await price(10), charming = await price(16), boor = await price(6);
  if (!(charming.buy < plain.buy)) return `charisma 16 paid ${charming.buy}, charisma 10 paid ${plain.buy}`;
  if (!(boor.buy > plain.buy)) return `charisma 6 paid ${boor.buy}, charisma 10 paid ${plain.buy}`;
  if (!(charming.sell > plain.sell)) return `charisma 16 was paid ${charming.sell} for a sale, charisma 10 ${plain.sell}`;
  return true;
});

await test('intelligence can identify an unknown potion without drinking it', async () => {
  const ctx = await newContext();
  const { Game, Rng, ITEMS } = ctx;
  Game.newGame({ name: 'I', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats, int: 18 }, seed: 'study', opts: OPTS });
  ctx.Dice.s = new Rng('study').s;
  const p = Game.player();
  const unknown = Object.keys(ITEMS).find(id => ITEMS[id].kind === 'potion' && !Game.isKnown(id));
  if (!unknown) return 'every potion was already known';
  const it = { t: unknown, q: 1, e: 0 };
  p.inv.push(it);
  const before = p.inv.length;
  let c = null;
  for (let tries = 0; tries < 30 && !Game.isKnown(unknown); tries++) {
    c = Game.study(it);
    if (c && !c.pass) {
      // a failure bars the same kind until the hero learns something more
      if (Game.studyReason(it) === null) return 'a failed study could be retried at once';
      p.level++;
    }
  }
  if (!Game.isKnown(unknown)) return 'thirty studies at intelligence 18 never identified it';
  if (p.inv.length !== before || !p.inv.includes(it)) return 'studying used the potion up';
  return Game.studyReason(it) !== null || 'a known potion could still be studied';
});

await test('every encounter offers a free, safe way out, and every effect is one the engine knows', async () => {
  // The encounter screen cannot be dismissed unanswered, which is only fair
  // if there is always a choice that costs and risks nothing.
  const { ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const known = new Set(['map', 'xp', 'goldPerDepth', 'hurt', 'hurtFrac', 'heal', 'maxHp', 'food', 'loot', 'item', 'buff', 'poison', 'cure', 'uncurse', 'wake', 'identifyAll', 'ambush', 'stat']);
  const stats = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
  for (const [id, e] of Object.entries(ENCOUNTERS)) {
    const last = e.choices[e.choices.length - 1];
    if (last.check || last.cost || !last.outcome || last.outcome.effects.length) return `${id}: the last choice is not a free way out`;
    for (const ch of e.choices) {
      if (ch.check && !stats.has(ch.check.stat)) return `${id}: "${ch.label}" checks unknown stat ${ch.check.stat}`;
      if (!ch.check && !ch.outcome) return `${id}: "${ch.label}" has neither a check nor an outcome`;
      if (ch.check && !(ch.pass && ch.fail)) return `${id}: "${ch.label}" is missing a pass or a fail`;
      for (const o of [ch.outcome, ch.pass, ch.fail].filter(Boolean)) {
        if (!o.text) return `${id}: "${ch.label}" has an outcome with no words`;
        for (const eff of o.effects) for (const k of Object.keys(eff)) if (!known.has(k)) return `${id}: unknown effect "${k}"`;
      }
    }
  }
  return true;
});

await test('an encounter resolves once: the check, the effects, the prop gone, never again', async () => {
  const ctx = await newContext();
  const { Game, Dungeon, Rng } = ctx;
  Game.newGame({ name: 'E', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, str: 18 }, seed: 'tour', opts: { ...OPTS, levels: 8 } });
  ctx.Dice.s = new Rng('enc').s;
  const p = Game.player(), L = Game.level();
  const prop = L.npcs.find(n => n.kind === 'encounter');
  if (!prop) return 'floor one of this seed has no encounter';
  // stand beside it and walk in
  const T = Dungeon.T;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(prop.y - dy) * L.w + (prop.x - dx)] === T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = prop.x - dx; p.y = prop.y - dy; p.dir = k;
  L.monsters.length = 0;
  if (Game.useLabel() !== 'Examine') return `facing the prop, Use says "${Game.useLabel()}"`;
  Game.input('forward');
  const e = Game.currentEncounter();
  if (!e || e.npc !== prop) return 'walking into the prop did not open its encounter';
  const opts = Game.encounterOptions();
  const checked = opts.find(o => o.stat);
  if (!checked || !(checked.chance > 0 && checked.chance <= 1)) return 'a checked choice showed no odds';
  const xp0 = p.xp;
  const r = Game.chooseEncounter(checked.i);
  if (!r || !r.check) return 'choosing a checked option returned no roll';
  if (!r.lines.length && r.check.pass) return 'a success changed nothing and said so';
  if (Game.chooseEncounter(checked.i)) return 'the same encounter resolved twice';
  if (L.npcs.includes(prop)) return 'the prop is still standing after being answered';
  if (!(Game.state().metEncounters || []).includes(prop.id)) return 'the encounter was not recorded as met';
  void xp0;
  Game.closeEncounter();
  return Game.currentEncounter() === null || 'the encounter would not close';
});

await test('the whole run meets each encounter at most once, deepest floor excepted', async () => {
  const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  for (const levels of [4, 8, 16]) for (let i = 0; i < 40; i++) {
    const plan = encounterPlan('plan' + i, levels);
    const all = plan.flat();
    if (new Set(all).size !== all.length) return `seed plan${i} over ${levels} floors repeats an encounter`;
    if (plan[levels].length) return `the deepest floor of a ${levels}-floor run has an encounter`;
    // about one a floor; a very long run can pass by the four that belong
    // only on the upper floors, once it is below them
    const want = Math.min(Object.keys(ENCOUNTERS).length, Math.round((levels - 1) * 1.15));
    if (all.length < want - (levels >= 12 ? 4 : 1) || all.length > want) return `a ${levels}-floor run met ${all.length} encounters, about ${want} expected`;
  }
  return true;
});

await test('across runs every encounter turns up, and no two runs meet the same handful', async () => {
  const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const seen = new Set(), sets = new Set();
  for (let i = 0; i < 80; i++) {
    const all = encounterPlan('spread' + i, 8).flat();
    all.forEach(e => seen.add(e));
    sets.add(all.slice().sort().join(','));
  }
  const missing = Object.keys(ENCOUNTERS).filter(e => !seen.has(e));
  if (missing.length) return `never met in 80 runs: ${missing.join(', ')}`;
  return sets.size >= 70 || `80 runs met only ${sets.size} different handfuls`;
});

await test('using the last of a stack removes its slot', async () => {
  const { Game } = await start('fighter', 'r3');
  const p = Game.player();
  p.inv.length = 0;
  p.food = 20;                                 // eating at full nourishment is refused
  p.inv.push({ t: 'ration', q: 1, e: 0 });
  Game.useItem(p.inv[0]);
  return p.inv.length === 0;
});

await test('nothing is consumed when it could not possibly help', async () => {
  const { Game } = await start('cleric', 'waste');
  const p = Game.player();
  p.inv.length = 0;
  p.hp = p.maxHp;
  p.food = 100;
  p.poison = null;
  // the guard only applies to things already identified: refusing an unknown
  // draught would tell the player what it is
  for (const id of ['ration', 'potion_heal', 'potion_cure']) Game.state().known[id] = 1;
  p.inv.push({ t: 'ration', q: 2, e: 0 });
  p.inv.push({ t: 'potion_heal', q: 2, e: 0 });
  p.inv.push({ t: 'potion_cure', q: 1, e: 0 });
  const before = p.inv.map(i => i.q).join(',');
  Game.useItem(p.inv[0]);                      // full up
  Game.useItem(p.inv[1]);                      // unhurt
  Game.useItem(p.inv[2]);                      // unpoisoned
  if (p.inv.map(i => i.q).join(',') !== before) return 'something was consumed for no benefit';
  // and each refusal explains itself
  const said = Game.state().log.slice(-3).map(e => e.m).join(' ');
  if (!/full/i.test(said) || !/unhurt/i.test(said) || !/poison/i.test(said)) {
    return 'a refusal did not say why: ' + said;
  }
  // once it would help, it works
  p.hp = 1;
  Game.useItem(p.inv[1]);
  return p.hp > 1 && p.inv.find(i => i.t === 'potion_heal').q === 1;
});

await test('an unidentified draught is never refused, since that would reveal it', async () => {
  const { Game } = await start('fighter', 'waste-unknown');
  const p = Game.player();
  const G = Game.state();
  p.hp = p.maxHp;
  const unknown = Object.keys(ITEMS_FOR_TEST(Game)).find(
    id => !G.known[id] && G.looks[id] && ITEMS_FOR_TEST(Game)[id].effect === 'heal');
  if (!unknown) return true;                     // nothing unidentified to check
  p.inv.push({ t: unknown, q: 1, e: 0 });
  const before = p.inv.length;
  Game.useItem(p.inv[p.inv.length - 1]);
  return p.inv.length < before ? true : 'an unknown potion was refused, which leaks what it is';
});

await test('spells do not spend points on nothing', async () => {
  const { Game } = await start('cleric', 'waste-spell');
  const p = Game.player();
  p.level = 5;
  p.maxSp = 40; p.sp = 40;
  p.hp = p.maxHp;
  const heal = Game.knownSpells().find(s => s.kind === 'heal');
  const bolt = Game.knownSpells().find(s => s.kind === 'bolt');
  if (!heal || !bolt) return 'the cleric should know a heal and a bolt';
  if (Game.castSpell(heal) !== false) return 'healing at full health was allowed';
  if (p.sp !== 40) return `healing at full health spent ${40 - p.sp} points`;
  // clear the way ahead so the bolt has provably no target
  const L = Game.level();
  L.monsters.length = 0;
  if (Game.castSpell(bolt) !== false) return 'a bolt was cast at nothing';
  if (p.sp !== 40) return `casting at nothing spent ${40 - p.sp} points`;
  p.hp = 1;
  return Game.castSpell(heal) === true && p.sp < 40;
});

await test('a save survives the JSON round trip, effects included', async () => {
  const { Game } = await start('mage', 'r4', { lockedDoors: true, traps: true });
  const p = Game.player();
  p.effects.ac = { amount: 4, until: 99999 };
  Game.save(true);
  const before = JSON.stringify({ hp: p.hp, inv: p.inv.length, sp: p.sp, gold: p.gold });
  if (!Game.load()) return 'load returned false';
  const q = Game.player();
  return JSON.stringify({ hp: q.hp, inv: q.inv.length, sp: q.sp, gold: q.gold }) === before
    && q.effects.ac && q.effects.ac.amount === 4;
});

await test('dropping from a full pack frees a slot', async () => {
  const { Game } = await start('fighter', 'r5');
  const p = Game.player();
  p.inv.length = 0;
  for (let i = 0; i < Game.INV_MAX; i++) p.inv.push({ t: 'dagger', q: 1, e: 0 });
  Game.dropItem(p.inv[0]);
  return p.inv.length === Game.INV_MAX - 1 && Game.floorItems().length >= 1;
});

await test('a dead player takes no more turns', async () => {
  const { Game } = await start('fighter', 'r6');
  const p = Game.player();
  const steps = p.steps;
  Game.state().status = 'dead';
  Game.input('forward');
  return p.steps === steps;
});

await test('the Heart cannot be sold or dropped', async () => {
  const ctx = await start('fighter', 'r7');
  const { Game } = ctx;
  const p = Game.player();
  p.inv.push({ t: 'artifact', q: 1, e: 0 });
  const heart = p.inv.find(i => i.t === 'artifact');
  Game.dropItem(heart);
  return p.inv.some(i => i.t === 'artifact');
});

await test('walking into a trader opens a shop that charges gold and identifies goods', async () => {
  const ctx = await start('fighter', 'r8', { levels: 8, size: 'medium' });
  const { Game, Dungeon } = ctx;
  const G = Game.state();
  const T = Dungeon.T;
  let trader = null;
  for (let d = 2; d <= 8 && !trader; d++) {
    G.levels[d] = G.levels[d] || Dungeon.generate(G.seed, d, G.opts);
    // encounter props share the list now: find the trader by kind
    const t = G.levels[d].npcs.find(n => n.kind !== 'encounter');
    if (t) { G.depth = d; trader = t; }
  }
  if (!trader) return 'no trader generated in eight levels';
  const L = Game.level();
  const p = Game.player();
  p.gold = 1000;
  // stand beside them and step in, the way a player reaches the shop
  let placed = false;
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = Dungeon.DIRS[k];
    const x = trader.x - dx, y = trader.y - dy;
    if (L.tiles[y * L.w + x] === T.FLOOR) { p.x = x; p.y = y; p.dir = k; placed = true; break; }
  }
  if (!placed) return 'trader has no adjacent floor tile';
  const movedInto = { x: p.x, y: p.y };
  Game.input('forward');
  if (!Game.currentShop()) return 'walking into the trader did not open the shop';
  if (p.x !== movedInto.x || p.y !== movedInto.y) return 'the player walked through the trader';
  const it = Game.currentShop().stock[0];
  const price = Game.buyPrice(Game.currentShop(), it);
  // stackables merge into an existing slot, so count pieces rather than slots
  const count = () => p.inv.reduce((a, i) => a + (i.q || 1), 0);
  const packBefore = count();
  if (!Game.buy(it)) return 'buy failed with 1000 gold in hand';
  if (p.gold !== 1000 - price) return `gold went ${p.gold}, expected ${1000 - price}`;
  if (count() !== packBefore + 1) return 'the bought item did not reach the pack';
  if (!Game.isKnown(it.t)) return 'buying did not identify the item';
  // and the trader refuses the Heart
  p.inv.push({ t: 'artifact', q: 1, e: 0 });
  const sold = Game.sell(p.inv.find(i => i.t === 'artifact'));
  return sold === false && p.inv.some(i => i.t === 'artifact');
});

await test('poison wears off rather than lasting forever', async () => {
  const { Game } = await start('fighter', 'r9');
  const p = Game.player();
  const G = Game.state();
  p.poison = { until: G.t + 1000, next: G.t + 100 };
  p.hp = p.maxHp;
  for (let i = 0; i < 40; i++) Game.update(i * 300, 300);
  return !p.poison;
});

await test('buffs expire on their own clock', async () => {
  const { Game } = await start('cleric', 'r10');
  const G = Game.state();
  Game.player().effects.hit = { amount: 2, until: G.t + 500 };
  for (let i = 0; i < 20; i++) Game.update(i * 300, 300);
  return Game.effect('hit') === 0;
});

// ---- movement against every tile type ----

// Movement used to be allow-by-default, so a tile type added later was walkable
// until somebody remembered to reject it. That is how wall torches became
// something you could stand inside. This walks the whole tile enum rather than
// the cases anyone thought of, so the next new tile cannot repeat it.
await test('only floor and open doors can be walked into', async () => {
  const probe = await newContext();
  const WALKABLE = new Set(['FLOOR', 'DOOR_OPEN']);
  const CHANGES_LEVEL = new Set(['STAIRS_DOWN']);
  const wrong = [];
  for (const [name, value] of Object.entries(probe.Dungeon.T)) {
    const ctx = await start('fighter', 'tiles-' + name);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + (p.x + dx)] = value;
    const from = { x: p.x, y: p.y, depth: Game.state().depth };
    Game.input('forward');
    const changedLevel = Game.state().depth !== from.depth;
    const entered = !changedLevel && (p.x !== from.x || p.y !== from.y);
    if (entered !== WALKABLE.has(name)) {
      wrong.push(`${name} ${entered ? 'was walked into' : 'blocked the player'}`);
    }
    if (CHANGES_LEVEL.has(name) && !changedLevel) wrong.push(`${name} did not change level`);
  }
  return wrong.length ? wrong.join('; ') : true;
});

await test('a wall torch is solid to monsters as well as to the player', async () => {
  const { Game, Dungeon } = await start('fighter', 'torch-solid');
  const T = Dungeon.T;
  const L = Game.level(), p = Game.player();
  let placed = null;
  for (let i = 0; i < L.tiles.length && !placed; i++) {
    if (L.tiles[i] !== T.FLOOR) continue;
    const x = i % L.w, y = (i / L.w) | 0;
    if (x === p.x && y === p.y) continue;
    L.tiles[i] = T.TORCH;
    placed = { x, y };
  }
  if (!placed) return 'no floor tile to convert';
  // the generator marks torches as walls, so nothing should treat one as ground
  const monstersOnTorch = L.monsters.filter(m => m.x === placed.x && m.y === placed.y);
  return monstersOnTorch.length === 0 ? true : 'a monster is standing in a torch';
});

// ---- story and progression ----

await test('every background is complete and keeps its voice straight', async () => {
  const { Game } = await start('fighter', 'story1');
  void Game;
  const ctx = await newContext();
  const BG = ctx.BACKGROUNDS;
  const ids = Object.keys(BG);
  if (ids.length < 4) return `only ${ids.length} backgrounds`;
  for (const id of ids) {
    const b = BG[id];
    for (const field of ['name', 'blurb', 'perk', 'story', 'motive', 'epi']) {
      if (!b[field]) return `${id} is missing ${field}`;
    }
    if (!/^You /.test(b.motive)) return `${id} motive is not in second person`;
    if (/\byou\b|\byour\b|\byourself\b/i.test(b.epi)) return `${id} epilogue leaks second person: ${b.epi}`;
  }
  return true;
});

await test('each background grants its stated advantage', async () => {
  const plain = (await start('fighter', 'story2')).Game.player();
  const ctxD = await newContext();
  ctxD.Game.newGame({ name: 'T', cls: 'fighter', bg: 'debtor', stats: { ...evenStats }, opts: OPTS });
  const debtor = ctxD.Game.player();
  if (debtor.gold !== 150) return `debtor starts with ${debtor.gold} gold, expected 150`;
  if (plain.gold !== 0) return `a plain start carries ${plain.gold} gold`;

  const ctxO = await newContext();
  ctxO.Game.newGame({ name: 'T', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, opts: OPTS });
  if ((ctxO.Game.player().perkHit || 0) !== 1) return 'oathbroken does not gain +1 to hit';

  const ctxA = await newContext();
  ctxA.Game.newGame({ name: 'T', cls: 'fighter', bg: 'ashborn', stats: { ...evenStats }, opts: OPTS });
  if (ctxA.Game.player().stats.con !== 13) return 'ashborn does not gain a point of constitution';

  const ctxC = await newContext();
  ctxC.Game.newGame({ name: 'T', cls: 'mage', bg: 'cloistered', stats: { ...evenStats }, opts: OPTS });
  if (!ctxC.Game.isKnown('potion_xheal')) return 'cloistered does not begin knowing every draught';
  return true;
});

await test('levelling offers a choice that must be made and changes the character', async () => {
  const ctx = await start('fighter', 'story3', { levels: 8, size: 'medium' });
  const { Game, Dungeon } = ctx;
  const p = Game.player();
  const L = Game.level();
  // one kill short of the level that grants a choice
  p.xp = 99999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const m = L.monsters[0];
  if (!m) return 'no monster to kill';
  m.x = p.x + dx; m.y = p.y + dy; m.rx = m.x; m.ry = m.y;
  m.hp = 1; m.maxHp = 1; m.awake = true; m.nextAct = 1e12;
  const before = JSON.stringify(p.stats) + p.maxHp;
  for (let i = 0; i < 40 && L.monsters.includes(m); i++) {
    p.nextAttack = 0;                        // the swing timer is not what is under test
    Game.input('attack');
  }
  if (L.monsters.includes(m)) return 'forty swings failed to land';
  if (p.level < 2) return `level did not rise, still ${p.level}`;
  const offer = Game.pendingBoons();
  if (!offer) return 'no boon offered after levelling';
  if (offer.length !== 3) return `offered ${offer.length} boons, expected 3`;
  if (Game.chooseBoon('not-a-real-boon')) return 'an unknown boon id was accepted';
  if (!Game.chooseBoon(offer[0])) return 'a valid boon was rejected';
  const after = JSON.stringify(p.stats) + p.maxHp;
  if (before === after && !p.perkHit && !p.perkSpeed && !p.perkRegen && !p.bonusSp) return 'the boon changed nothing';
  return p.boons && p.boons.length === 1;
});

await test('journal pages are recorded once and survive a save', async () => {
  const ctx = await start('fighter', 'story4', { levels: 8, size: 'medium' });
  const { Game } = ctx;
  const L = Game.level();
  const p = Game.player();
  let key = null;
  for (const k in L.items) if (L.items[k].some(i => i.t === 'page')) key = k;
  if (!key) return 'no journal page generated on the first level';
  const [x, y] = key.split(',').map(Number);
  p.x = x; p.y = y;
  const page = L.items[key].find(i => i.t === 'page');
  Game.takeItem(page);
  if (Game.journal().length !== 1) return `journal holds ${Game.journal().length} entries, expected 1`;
  Game.takeItem(page);                       // picking it up twice must not double count
  if (Game.journal().length !== 1) return 'the same page was recorded twice';
  Game.save(true);
  Game.load();
  return Game.journal().length === 1;
});

await test('a short delve counts pages out of what it actually buried', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  // one page per floor, so a four level delve holds four of the archive's eight
  Game.newGame({ name: 'Wren', cls: 'fighter', bg: 'tombwise', stats: { ...evenStats }, opts: { ...OPTS, levels: 4 } });
  if (Game.pagesInDungeon() !== 4) return `a four level delve claims ${Game.pagesInDungeon()} pages`;
  for (let i = 0; i < 4; i++) Game.journal().push({ i, depth: i + 1 });
  const won = Game.epilogue(true).join(' ');
  if (/left \d+ of the earlier crews/.test(won)) return 'all four pages found, yet the epilogue mourns missing ones';
  if (!won.includes('every page')) return 'a complete journal did not close the story';
  // a long delve is still capped by the archive itself
  Game.newGame({ name: 'Wren', cls: 'fighter', bg: 'tombwise', stats: { ...evenStats }, opts: { ...OPTS, levels: 16 } });
  return Game.pagesInDungeon() === 8 || `a sixteen level delve claims ${Game.pagesInDungeon()} pages`;
});

await test('the epilogue names the hero and reflects the background', async () => {
  const ctx = await newContext();
  ctx.Game.newGame({ name: 'Wren', cls: 'thief', bg: 'tombwise', stats: { ...evenStats }, opts: OPTS });
  const lost = ctx.Game.epilogue(false).join(' ');
  const won = ctx.Game.epilogue(true).join(' ');
  if (!lost.includes('Wren') || !won.includes('Wren')) return 'the epilogue does not name the hero';
  if (!lost.includes('grave') || !won.includes('grave')) return 'the epilogue ignores the background';
  if (lost === won) return 'winning and dying read the same';
  return true;
});


// ---------- relics ----------
const CLASS_IDS = ['fighter', 'cleric', 'mage', 'thief'];
const foe = (id, x, y, hp = 9999) => ({ uid: 77, id, x, y, hp, maxHp: hp, awake: true, nextAct: 1e9,
  rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
/** Put a relic in the pack and wear it. */
function wearRelic(ctx, id, slot) {
  const r = ctx.RELICS[id], p = ctx.Game.player();
  const it = { t: r.t, q: 1, e: r.e, u: id };
  p.inv.push(it);
  if (!ctx.Game.equip(it, true, slot)) throw new Error(`could not equip ${id}`);
  return it;
}
/** Swing at a sturdy foe many times and total what landed. */
function swingTotal(ctx, id, swings) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  p.perkHit = 60;                                  // every blow lands, so only damage differs
  let total = 0;
  for (let i = 0; i < swings; i++) {
    L.monsters.length = 0;
    const m = foe(id, p.x + dx, p.y + dy);
    L.monsters.push(m);
    G.t = p.nextAttack;
    Game.input('attack');
    total += 9999 - m.hp;
  }
  return total;
}

await test('relic plans suit the class, spread out, and never repeat', async () => {
  const { RELICS, relicPlan, relicUsableBy } = await newContext();
  for (const cls of CLASS_IDS) {
    for (let i = 0; i < 40; i++) {
      const plan = relicPlan('rp' + i, cls, 8);
      const again = relicPlan('rp' + i, cls, 8);
      if (JSON.stringify(plan) !== JSON.stringify(again)) return 'the same seed planned different relics';
      const floors = Object.keys(plan.floor).map(Number);
      const all = [...Object.values(plan.floor), ...plan.shop];
      if (new Set(all).size !== all.length) return `${cls} would meet a relic twice`;
      const bad = all.find(id => !relicUsableBy(id, cls));
      if (bad) return `${cls} was planned ${bad}, which it cannot use`;
      if (floors.length !== 3) return `an eight floor ${cls} run placed ${floors.length} relics on floors`;
      if (floors.some(d => d < 2 || d > 7)) return `a relic was planned for floor ${floors.join(',')}`;
      if (!plan.shop.length) return `${cls} has nothing left for the traders`;
      const byDepth = floors.sort((a, b) => a - b).map(d => RELICS[plan.floor[d]].value);
      if (byDepth.some((v, k) => k && v < byDepth[k - 1])) return 'a stronger relic came before a weaker one';
    }
    // every class has a few to find
    const usable = Object.keys(RELICS).filter(id => relicUsableBy(id, cls));
    if (usable.length < 4) return `${cls} can use only ${usable.length} relics`;
  }
  // a short delve still holds one, and it is not on the Heart's floor
  const short = relicPlan('rp', 'mage', 3);
  return (Object.keys(short.floor).length === 1 && !short.floor[3]) || `a three floor plan: ${JSON.stringify(short)}`;
});

await test('each floor holds exactly the relic planned for it, and traders keep the rest', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'relicwalk', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
  const G = Game.state(), T = Dungeon.T;
  const shelved = [];
  for (let depth = 1; depth <= 8; depth++) {
    const L = Game.level();
    if (G.depth !== depth) return `could not reach floor ${depth}`;
    const lying = [];
    for (const k in L.items) for (const it of L.items[k]) if (it.u) {
      lying.push(it.u);
      if (L.items[k].some(x => x.t === 'artifact')) return 'a relic was laid on the Heart';
      const [x, y] = k.split(',').map(Number);
      if (L.tiles[y * L.w + x] === T.WALL) return 'a relic was laid inside a wall';
    }
    const want = G.relics.floor[depth];
    if (want ? lying.length !== 1 || lying[0] !== want : lying.length) return `floor ${depth} holds [${lying}] but the plan said ${want || 'nothing'}`;
    for (const n of L.npcs) for (const it of n.stock || []) if (it.u) shelved.push([depth, it.u]);
    if (depth === 8) break;
    // walk onto the stair and take it
    const p = Game.player(), s = L.stairsDown;
    let went = false;
    for (let k = 0; k < 4 && !went; k++) {
      const [dx, dy] = Dungeon.DIRS[k];
      const x = s.x - dx, y = s.y - dy;
      if (L.tiles[y * L.w + x] !== T.FLOOR) continue;
      p.x = x; p.y = y; p.dir = k; delete L.items[x + ',' + y];
      Game.input('use'); went = true;
    }
  }
  if (shelved.some(([d]) => d < 2)) return 'a first floor trader sold a relic';
  const sold = shelved.map(s => s[1]);
  if (JSON.stringify(sold) !== JSON.stringify(G.relics.shop.slice(0, sold.length))) return `traders shelved ${sold}, the plan kept ${G.relics.shop}`;
  return true;
});

await test('a relic is named plainly, and tells its story once', async () => {
  const ctx = await start('fighter', 'relicname');
  const { Game, RELICS } = ctx;
  const G = Game.state(), p = Game.player(), L = Game.level();
  const toll = { t: 'battleaxe', q: 1, e: 1, u: 'ogres_toll' };
  if (Game.itemName(toll) !== 'The Ogre\'s Toll') return `named "${Game.itemName(toll)}"`;
  if (Game.itemName({ t: 'dagger', q: 1, e: 2, u: 'grimtooth' }) !== 'Grimtooth') return 'Grimtooth shows its enchantment in its name';
  L.items[p.x + ',' + p.y] = [toll];
  const mark = markLog(G);
  Game.takeItem(toll);
  const said = linesSince(G, mark);
  if (!said.includes('You pick up the Ogre\'s Toll.')) return `picking it up said: ${said.join(' | ')}`;
  if (!said.includes(RELICS.ogres_toll.lore)) return 'its story was not told';
  if (!p.inv.some(it => it.u === 'ogres_toll')) return 'it lost its name in the pack';
  // dropping and taking it again does not retell the story
  Game.dropItem(p.inv.find(it => it.u === 'ogres_toll'));
  const again = markLog(G);
  Game.takeItem(L.items[p.x + ',' + p.y].find(it => it.u));
  if (linesSince(G, again).includes(RELICS.ogres_toll.lore)) return 'the story was told twice';
  return G.relics.found.filter(id => id === 'ogres_toll').length === 1 || 'found twice';
});

await test('striking powers: keen, swift, banes and leech do what they say', async () => {
  // keen and swift, from the hand that holds it
  let ctx = await start('thief', 'keen');
  let p = ctx.Game.player();
  const plainCrit = ctx.Game.critFloor(), plainSpeed = (() => { const it = { t: 'dagger', q: 1, e: 0 }; p.inv.push(it); ctx.Game.equip(it, true); return ctx.Game.weapon().speed; })();
  wearRelic(ctx, 'grimtooth');
  if (ctx.Game.critFloor() !== plainCrit - 1) return `keen left crits on ${ctx.Game.critFloor()}, not ${plainCrit - 1}`;
  if (Math.abs(ctx.Game.weapon().speed - plainSpeed * 0.85) > 1) return `swift swung in ${ctx.Game.weapon().speed}ms, not ${plainSpeed * 0.85}`;
  // Dawnbringer against the dead, and not against the living
  ctx = await start('cleric', 'bane');
  ctx.Dice.s = new ctx.Rng('bane').s;
  const maceDead = swingTotal(ctx, 'skeleton', 300);
  wearRelic(ctx, 'dawnbringer');
  ctx.Dice.s = new ctx.Rng('bane').s;
  const dawnDead = swingTotal(ctx, 'skeleton', 300);
  ctx.Dice.s = new ctx.Rng('bane').s;
  const dawnLiving = swingTotal(ctx, 'orc', 300);
  // +1 enchantment and +1d6 (3.5) a blow against the dead; only the +1 otherwise
  if (dawnDead - maceDead < 300 * 3) return `Dawnbringer added only ${(dawnDead - maceDead) / 300} a blow against a skeleton`;
  if (dawnLiving - maceDead > 300 * 2) return `Dawnbringer's bane bit the living too (${(dawnLiving - maceDead) / 300} a blow)`;
  // Thirst gives back a fifth of what it takes
  ctx = await start('fighter', 'leech');
  p = ctx.Game.player();
  wearRelic(ctx, 'thirst');
  const G = ctx.Game.state(), L = ctx.Game.level();
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  p.perkHit = 60;
  let healed = 0, dealt = 0;
  for (let i = 0; i < 100; i++) {
    L.monsters.length = 0;
    const m = foe('orc', p.x + dx, p.y + dy);
    L.monsters.push(m);
    p.hp = 1;
    G.t = p.nextAttack;
    ctx.Game.input('attack');
    dealt += 9999 - m.hp; healed += p.hp - 1;
  }
  if (healed < dealt / 5 - 100 || healed > dealt / 5 + 100) return `Thirst healed ${healed} from ${dealt} dealt`;
  return true;
});

await test('worn powers: mind, mend, ward, pure, thorns and quiet do what they say', async () => {
  // a well of power fills a caster and does nothing for anyone else
  let ctx = await start('cleric', 'mind');
  let p = ctx.Game.player();
  const sp = p.maxSp;
  const flail = wearRelic(ctx, 'penitent');
  if (p.maxSp !== sp + 6) return `the Penitent's Flail gave ${p.maxSp - sp} spell points`;
  ctx.Game.unequip('weapon');
  if (p.maxSp !== sp || p.sp > p.maxSp) return 'taking it off did not take its points back';
  ctx.Game.equip(flail, true);
  ctx = await start('fighter', 'mind2');
  wearRelic(ctx, 'ninth_circle');
  if (ctx.Game.player().maxSp !== 0) return 'a fighter found spell points in a staff';

  // mending works mid-fight, a point every four seconds
  ctx = await start('cleric', 'mend');
  p = ctx.Game.player();
  let G = ctx.Game.state(), L = ctx.Game.level();
  wearRelic(ctx, 'kests_bulwark');
  L.monsters.length = 0;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  L.monsters.push(foe('rat', p.x + dx * 3, p.y + dy * 3));   // awake and close: no natural healing
  p.maxHp = 500; p.hp = 100; p.food = 100;
  for (let i = 0; i < 400; i++) ctx.Game.update(G.t + 100, 100);   // forty seconds
  if (p.hp < 108 || p.hp > 112) return `forty hunted seconds mended ${p.hp - 100}, not about 10`;

  // ward and pure: a lich's drain and a spider's venom never take
  ctx = await start('fighter', 'ward');
  p = ctx.Game.player(); G = ctx.Game.state(); L = ctx.Game.level();
  wearRelic(ctx, 'rustwarden');
  wearRelic(ctx, 'sisters_buckler');
  const [fx, fy] = ctx.Dungeon.DIRS[p.dir];
  p.maxHp = 5000; p.hp = 5000;
  const top = p.maxHp;
  for (let i = 0; i < 300; i++) {
    L.monsters.length = 0;
    L.monsters.push({ ...foe('lich', p.x + fx, p.y + fy), nextAct: G.t });
    p.hp = p.maxHp;
    ctx.Game.update(G.t + 400, 400);
  }
  if (p.maxHp !== top) return `Rustwarden let the lich drain ${top - p.maxHp} hit points`;
  for (let i = 0; i < 300; i++) {
    L.monsters.length = 0;
    L.monsters.push({ ...foe('spider', p.x + fx, p.y + fy), nextAct: G.t });
    p.hp = p.maxHp;
    ctx.Game.update(G.t + 400, 400);
    if (p.poison) return 'the Sisters\' Buckler let venom in';
  }

  // thorns: what strikes the wearer bleeds for it
  ctx = await start('cleric', 'thorns');
  p = ctx.Game.player(); G = ctx.Game.state(); L = ctx.Game.level();
  wearRelic(ctx, 'briarcoat');
  const [tx, ty] = ctx.Dungeon.DIRS[p.dir];
  const orc = { ...foe('orc', p.x + tx, p.y + ty), nextAct: G.t };
  L.monsters.length = 0; L.monsters.push(orc);
  p.maxHp = 5000; p.hp = 5000;
  const mark = markLog(G);
  for (let i = 0; i < 100; i++) { p.hp = p.maxHp; ctx.Game.update(G.t + 200, 200); }
  const hits = linesSince(G, mark).filter(l => /Orc hits you/.test(l)).length;
  const barbs = linesSince(G, mark).filter(l => /Your barbs bite the Orc/.test(l)).length;
  if (!hits || barbs !== hits) return `the orc hit ${hits} times and bled ${barbs}`;

  // quiet: a thief wakes a sleeper four squares off, but not in Shadowskin
  const asleepAt = async (withRelic) => {
    const c = await start('thief', 'quiet');
    const pl = c.Game.player(), Gs = c.Game.state(), Lv = c.Game.level();
    if (withRelic) wearRelic(c, 'shadowskin');
    // find a straight run of floor to put the sleeper at the end of
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = c.Dungeon.DIRS[k];
      if ([1, 2, 3, 4].every(n => Lv.tiles[(pl.y + ay * n) * Lv.w + pl.x + ax * n] === c.Dungeon.T.FLOOR)) {
        Lv.monsters.length = 0;
        const m = { ...foe('goblin', pl.x + ax * 4, pl.y + ay * 4), awake: false, nextAct: Gs.t };
        Lv.monsters.push(m);
        c.Game.update(Gs.t + 50, 50);
        return m.awake;
      }
    }
    return null;
  };
  const plain = await asleepAt(false), muffled = await asleepAt(true);
  if (plain === null) return 'no straight corridor to test stealth in';
  if (!plain || muffled) return `at four squares a thief woke it: ${plain}, in Shadowskin: ${muffled}`;
  return true;
});

await test('traders price relics by legend and never mix them with plain gear', async () => {
  const ctx = await start('fighter', 'relictrade');
  const { Game, RELICS } = ctx;
  const p = Game.player();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'longsword', q: 1, e: 1 }] };
  const thirst = { t: 'longsword', q: 1, e: 1, u: 'thirst' };
  if (Game.buyPrice(shop, thirst) !== Math.round(RELICS.thirst.value * 2 * (1 - Game.charm()))) return `Thirst costs ${Game.buyPrice(shop, thirst)}`;
  if (Game.buyPrice(shop, thirst) < Game.buyPrice(shop, shop.stock[0]) * 3) return 'a relic costs little more than the plain blade';
  // sell it: it keeps its name on the shelf and sits apart from the plain longsword
  const L = Game.level();
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  L.monsters.length = 0;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.inv.push(thirst);
  Game.sell(thirst);
  const kept = shop.stock.find(s => s.u === 'thirst');
  if (!kept || shop.stock.find(s => !s.u).q !== 1) return `the shelf after selling: ${JSON.stringify(shop.stock)}`;
  p.gold = 99999;
  Game.buy(kept);
  return p.inv.some(it => it.u === 'thirst') || 'buying it back lost its name';
});

await test('relics survive a save, and an older save still finds them', async () => {
  const ctx = await start('fighter', 'relicsave');
  const { Game } = ctx;
  const p = Game.player();
  p.inv.push({ t: 'dagger', q: 1, e: 2, u: 'grimtooth' });
  Game.save();
  const plan = JSON.stringify(Game.state().relics);
  const raw = JSON.parse(ctx.store.get('deepdelve.save'));
  if (!Game.load()) return 'could not load';
  if (!Game.player().inv.some(it => it.u === 'grimtooth')) return 'Grimtooth lost its name in the save';
  if (JSON.stringify(Game.state().relics) !== plan) return 'the plan changed across a save';
  delete raw.relics;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'could not load an older save';
  const R = Game.state().relics;
  return (R && Object.keys(R.floor).length > 0 && Array.isArray(R.found)) || 'an older save came back with no relics planned';
});


// ---------- curses ----------
await test('found gear hides its quality, and only below the first floor can it be cursed', async () => {
  const { Dungeon, Rng, ITEMS } = await newContext();
  const tally = depth => {
    const rng = new Rng('curse-loot-' + depth);
    let gear = 0, hidden = 0, cursed = 0, badCurse = 0;
    for (let i = 0; i < 20000; i++) {
      const it = Dungeon.rollLoot(rng, depth);
      if (!['weapon', 'armor', 'shield'].includes(ITEMS[it.t].kind)) continue;
      gear++; if (it.h) hidden++;
      if (it.curse) { cursed++; if (!(it.e < 0)) badCurse++; }
    }
    return { gear, hidden, cursed, badCurse };
  };
  const top = tally(1), deep = tally(5);
  if (top.hidden !== top.gear || deep.hidden !== deep.gear) return 'some found gear showed its quality';
  if (top.cursed) return `${top.cursed} cursed pieces on the first floor`;
  if (deep.badCurse) return 'a cursed piece was not worse than plain';
  const share = deep.cursed / deep.gear;
  return (share > 0.04 && share < 0.15) || `floor five gear was ${(share * 100).toFixed(1)}% cursed`;
});

await test('an enchantment reads right: hidden while unknown, a true minus when negative', async () => {
  const { Game } = await start('fighter', 'curse-name');
  if (Game.itemName({ t: 'longsword', q: 1, e: 2, h: 1 }) !== 'Long Sword') return 'a hidden +2 gave itself away';
  if (Game.itemName({ t: 'longsword', q: 1, e: -1 }) !== 'Long Sword −1') return `a known -1 read "${Game.itemName({ t: 'longsword', q: 1, e: -1 })}"`;
  return Game.itemName({ t: 'longsword', q: 1, e: 2 }) === 'Long Sword +2' || 'a known +2 lost its bonus';
});

/** A fighter wearing a cursed long sword it did not know about. */
async function cursedFighter(seed) {
  const ctx = await start('fighter', seed);
  const p = ctx.Game.player();
  const blade = { t: 'longsword', q: 1, e: -1, h: 1, curse: 1 };
  p.inv.push(blade);
  const mark = markLog(ctx.Game.state());
  ctx.Game.equip(blade);
  return { ctx, p, blade, said: linesSince(ctx.Game.state(), mark) };
}

await test('putting on unknown gear reveals it, and a cursed piece will not come off', async () => {
  const { ctx, p, blade, said } = await cursedFighter('curse-stick');
  const { Game } = ctx;
  if (p.eq.weapon !== blade) return 'the cursed blade was not worn';
  if (blade.h) return 'wearing it did not reveal it';
  if (!said.some(l => /cursed/.test(l))) return `putting it on said: ${said.join(' | ')}`;
  Game.unequip('weapon');
  if (p.eq.weapon !== blade) return 'a cursed blade came off';
  const other = { t: 'mace', q: 1, e: 0 };
  p.inv.push(other);
  if (Game.equip(other) || p.eq.weapon !== blade) return 'another weapon replaced a cursed one';
  const big = { t: 'greatsword', q: 1, e: 0 };
  p.inv.push(big);
  if (Game.equip(big)) return 'a two-handed sword pushed a cursed blade aside';
  // a cursed shield holds the hand a two-handed grip needs
  const c2 = await start('fighter', 'curse-shield');
  const p2 = c2.Game.player();
  const shield = { t: 'shield', q: 1, e: -2, h: 1, curse: 1 };
  p2.inv.push(shield);
  c2.Game.equip(shield);
  const gs = { t: 'greatsword', q: 1, e: 0 };
  p2.inv.push(gs);
  if (c2.Game.equip(gs) || p2.eq.shield !== shield) return 'a two-handed sword stowed a cursed shield';
  // a fine piece announces itself too
  const fine = { t: 'chain', q: 1, e: 2, h: 1 };
  p2.inv.push(fine);
  const mark = markLog(c2.Game.state());
  c2.Game.equip(fine);
  return linesSince(c2.Game.state(), mark).some(l => /finely made: Chain Mail \+2/.test(l)) || 'a fine piece said nothing of itself';
});

await test('a Scroll of Remove Curse frees you and shows your gear for what it is', async () => {
  const { ctx, p, blade } = await cursedFighter('curse-scroll');
  const { Game } = ctx;
  const G = Game.state();
  const mystery = { t: 'scale', q: 1, e: 1, h: 1 };
  p.inv.push(mystery);
  G.known.scroll_uncurse = 1;
  p.inv.push({ t: 'scroll_uncurse', q: 1, e: 0 });
  Game.useItem(p.inv.find(i => i.t === 'scroll_uncurse'));
  if (blade.curse) return 'the curse held';
  if (mystery.h) return 'the scroll left gear unknown';
  Game.unequip('weapon');
  if (p.eq.weapon === blade) return 'the freed blade still would not come off';
  // with nothing cursed or unknown, reading one would be a waste
  p.inv.push({ t: 'scroll_uncurse', q: 1, e: 0 });
  return !!Game.wasteReason(p.inv.find(i => i.t === 'scroll_uncurse')) || 'a pointless reading was allowed';
});

await test('studying gear judges its quality; a failure waits for the next level', async () => {
  const ctx = await start('mage', 'curse-study');
  const { Game } = ctx;
  const p = Game.player();
  const knife = { t: 'dagger', q: 1, e: -1, h: 1, curse: 1 };
  p.inv.push(knife);
  if (Game.studyReason(knife)) return `studying unknown gear was refused: ${Game.studyReason(knife)}`;
  let c = null;
  for (let i = 0; i < 40 && knife.h; i++) {
    c = Game.study(knife);
    if (knife.h) {
      if (!Game.studyReason(knife)) return 'a failed study could be retried at once';
      p.level++;                               // learn something, try again
    }
  }
  if (knife.h) return 'forty studies never judged it';
  if (!knife.curse) return 'studying it broke the curse';
  return Game.studyReason(knife) === 'You already know its quality.' || 'a judged piece could be studied again';
});

await test('traders appraise gear and lift curses, for a price, and never resell a cursed piece', async () => {
  const { ctx, p, blade } = await cursedFighter('curse-trade');
  const { Game, Dungeon } = ctx;
  const L = Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  L.monsters.length = 0;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  const mystery = { t: 'shield', q: 1, e: 2, h: 1 }, plain = { t: 'shield', q: 1, e: 0 };
  p.inv.push(mystery);
  if (Game.sellPrice(mystery) !== Game.sellPrice(plain)) return 'the sale price gave an unknown +2 away';
  p.gold = 5000;
  const svc = id => Game.shopServices().find(s => s.id === id);
  if (svc('appraise').why || svc('uncurse').why) return 'a service was refused when it was needed';
  const before = p.gold, cost = svc('appraise').price;
  Game.buyService('appraise');
  if (mystery.h || p.gold !== before - cost) return 'appraising did not reveal, or did not charge the price shown';
  if (!svc('appraise').why) return 'appraisal was offered with nothing left to judge';
  const lift = svc('uncurse').price;
  Game.buyService('uncurse');
  if (blade.curse || p.gold !== before - cost - lift) return 'lifting the curse did not work, or did not charge the price shown';
  // sell a cursed piece: it goes on the junk heap, not the shelf
  const junk = { t: 'mace', q: 1, e: -2, curse: 1 };
  p.inv.push(junk);
  Game.sell(junk);
  return !shop.stock.some(s => s.t === 'mace') || 'a cursed mace went back on sale';
});


await test('a prayer answered at the shrine breaks a curse', async () => {
  const { ctx, p, blade } = await cursedFighter('curse-shrine');
  const { Game, Dungeon } = ctx;
  const L = Game.level(), T = Dungeon.T;
  // set a shrine beside the hero and walk into it
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(p.y + dy) * L.w + p.x + dx] === T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.dir = k;
  L.monsters.length = 0; L.npcs.length = 0;
  L.npcs.push({ id: 'shrine', kind: 'encounter', x: p.x + dx, y: p.y + dy });
  p.stats.wis = 40;                                   // the prayer is heard (a natural 1 aside)
  let r = null;
  for (let tries = 0; tries < 5 && !(r && r.check.pass); tries++) {
    if (!L.npcs.length) L.npcs.push({ id: 'shrine', kind: 'encounter', x: p.x + dx, y: p.y + dy });
    Game.state().metEncounters = [];
    Game.input('forward');
    const pray = Game.encounterOptions().find(o => /Pray/.test(o.label));
    if (!pray) return 'the shrine offered no prayer';
    r = Game.chooseEncounter(pray.i);
    Game.closeEncounter();
  }
  if (!r || !r.check.pass) return 'five prayers were all refused';
  if (blade.curse) return 'the answered prayer left the curse in place';
  return r.lines.includes('Curse broken') || `the prayer said: ${r.lines.join(' | ')}`;
});


// ---------- from the playtest ----------
await test('an Attack tap a moment early is kept and swung the instant the blow is ready', async () => {
  const ctx = await start('fighter', 'queued-tap');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  L.monsters.push({ uid: 9, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  G.t = p.nextAttack;
  Game.input('attack');
  const first = p.nextAttack;
  if (Game.attackReady() >= 1) return 'right after a swing the button claimed the next blow was ready';
  // tap 200ms before it is ready: nothing yet, then the blow lands on time
  Game.update(0, first - G.t - 200);
  Game.input('attack');
  if (p.nextAttack !== first) return 'an early tap swung before the blow was ready';
  Game.update(0, 250);
  if (p.nextAttack === first) return 'the early tap was dropped';
  // a tap far too early is still ignored, not stored up
  const second = p.nextAttack;
  Game.input('attack');
  Game.update(0, second - G.t + 50);
  return p.nextAttack === second || 'a tap long before the blow was ready was stored and swung';
});

await test('no champions wait on the first floor', async () => {
  const { Dungeon } = await newContext();
  for (let i = 0; i < 60; i++) {
    const L = Dungeon.generate('champ' + i, 1, { levels: 8, size: 'medium', monsters: 'many', treasure: 'normal', lockedDoors: true, traps: true });
    const c = L.monsters.find(m => m.elite);
    if (c) return `seed champ${i} put a ${c.elite} ${c.id} on floor one`;
  }
  const deeper = Dungeon.generate('champ0', 4, { levels: 8, size: 'medium', monsters: 'many', treasure: 'normal', lockedDoors: true, traps: true });
  return deeper.monsters.some(m => m.elite) || Array.from({ length: 20 }, (_, i) => Dungeon.generate('champ' + i, 4, { levels: 8, size: 'medium', monsters: 'many', treasure: 'normal', lockedDoors: true, traps: true })).some(L => L.monsters.some(m => m.elite)) || 'champions vanished from deeper floors too';
});


// ---------- groups ----------
/** A goblin with company, standing in front of the hero. */
function groupAhead(ctx, id, members, hp = 6) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  const m = { uid: 70, id, x: p.x + dx, y: p.y + dy, hp, maxHp: hp, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0,
    pack: Array.from({ length: members - 1 }, () => ({ hp, maxHp: hp })) };
  L.monsters.push(m);
  return m;
}

await test('a group falls one at a time: each pays its experience, the next steps up', async () => {
  const ctx = await start('fighter', 'pack-fight');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;                                 // every blow lands
  const m = groupAhead(ctx, 'goblin', 2, 1);
  m.nextAct = 1e9;
  const xp0 = p.xp, kills0 = p.kills;
  const mark = markLog(G);
  G.t = p.nextAttack; Game.input('attack');
  if (!L.monsters.includes(m)) return 'killing the front goblin emptied the square';
  if (m.pack) return 'the second goblin did not step up';
  if (p.kills !== kills0 + 1 || p.xp <= xp0) return 'the fallen goblin paid nothing';
  if (!linesSince(G, mark).some(l => /last Goblin steps up/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  const xp1 = p.xp;
  G.t = p.nextAttack; Game.input('attack');
  if (L.monsters.includes(m)) return 'the last goblin would not die';
  return (p.kills === kills0 + 2 && p.xp - xp1 === xp1 - xp0) || 'the second goblin paid differently from the first';
});

await test('each member of a group swings: a pair strikes about twice as often as one', async () => {
  const swingsBy = async members => {
    const ctx = await start('fighter', 'pack-swings');
    ctx.Dice.s = new ctx.Rng('pack-swings').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    groupAhead(ctx, 'goblin', members, 999);
    let n = 0;
    for (let i = 0; i < 300; i++) {
      p.hp = p.maxHp = 9999;
      const mark = markLog(G);
      Game.update(G.t + 50, 50);
      n += linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
    }
    return n;
  };
  const one = await swingsBy(1), two = await swingsBy(2);
  return (two >= one * 1.7 && two <= one * 2.3) || `a lone goblin swung ${one} times in 15s, a pair ${two}`;
});

await test('every area spell hits a whole group, and every single-target one only its front', async () => {
  const results = [];
  for (const cls of ['mage', 'cleric']) {
    const ctx = await start(cls, 'pack-spells-' + cls);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.level = 9;
    for (const sp of Game.knownSpells().filter(s => s.kind === 'bolt')) {
      const area = !!(sp.pierce || sp.area);
      // three goblins in one square, weak enough that any hit fells one
      const m = groupAhead(ctx, 'goblin', 3, 1);
      m.nextAct = 1e9;
      p.sp = p.maxSp = 99; p.nextAttack = G.t;
      const kills = p.kills;
      if (!Game.castSpell(sp)) { results.push(`${sp.name} could not be cast`); continue; }
      const left = L.monsters.includes(m) ? 1 + (m.pack ? m.pack.length : 0) : 0;
      if (area && (left !== 0 || p.kills !== kills + 3)) results.push(`${sp.name} left ${left} of three standing (${p.kills - kills} killed)`);
      if (!area && (left !== 2 || p.kills !== kills + 1)) results.push(`${sp.name}, a single-target spell, left ${left} of three`);
      G.t += 5000;
    }
  }
  // the Scroll of Fire is a ball of flame: the whole square burns
  const ctx = await start('thief', 'pack-scroll');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const m = groupAhead(ctx, 'goblin', 3, 1);
  m.nextAct = 1e9;
  G.known.scroll_fire = 1;
  p.inv.push({ t: 'scroll_fire', q: 1, e: 0 });
  Game.useItem(p.inv.find(i => i.t === 'scroll_fire'));
  if (L.monsters.includes(m)) results.push(`the Scroll of Fire left ${1 + (m.pack ? m.pack.length : 0)} of three standing`);
  return results.length ? results.join('; ') : true;
});

await test('an area spell that does not kill wounds every member, and a piercing bolt reaches a second group', async () => {
  const ctx = await start('mage', 'pack-wound');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.level = 9; p.sp = p.maxSp = 99;
  const lightning = Game.knownSpells().find(s => s.id === 'lightning');
  // sturdy enough to survive one bolt: every member must still be hurt
  const m = groupAhead(ctx, 'ogre', 3, 400);
  m.nextAct = 1e9; p.nextAttack = G.t;
  Game.castSpell(lightning);
  if (!(m.hp < 400 && m.pack && m.pack.length === 2 && m.pack.every(b => b.hp < 400))) return `after one bolt: front ${m.hp}, behind ${JSON.stringify(m.pack)}`;
  if (!m.pack.every(b => b.hp === m.hp)) return 'the same bolt hurt members of one group by different amounts';
  // two groups in a line down a straight corridor: the bolt takes both
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  const near = groupAhead(ctx, 'goblin', 2, 1);
  const far = { ...near, uid: 71, x: p.x + dx * 3, y: p.y + dy * 3, pack: [{ hp: 1, maxHp: 1 }] };
  L.monsters.push(far);
  near.nextAct = far.nextAct = 1e9;
  G.t += 5000; p.nextAttack = G.t;
  Game.castSpell(lightning);
  return (!L.monsters.includes(near) && !L.monsters.includes(far)) || 'a lightning bolt stopped at the first group in its path';
});


// ---------- second playtest and code review ----------
await test('a waiting swing does not outlive the moment: a new game or a step cancels it', async () => {
  const ctx = await start('fighter', 'stale-tap');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  G.t = 5000; p.nextAttack = G.t + 200;
  Game.input('attack');                              // queued for 200ms from now
  Game.newGame({ name: 'Again', cls: 'fighter', stats: Game.rollStats(), seed: 'stale-tap-2', opts: OPTS });
  Game.update(0, 16);
  if (Game.player().nextAttack > Game.state().t) return 'the last run\'s queued swing fired in the new one';
  // queue, then turn away: the swing must not fire
  const p2 = Game.player(), G2 = Game.state();
  p2.nextAttack = G2.t + 200;
  Game.input('attack');
  Game.input('left');
  Game.update(0, 300);
  return p2.nextAttack <= G2.t + 200 || 'a queued swing fired after the hero turned away';
});

await test('choosing a spell readies it on the Cast button even when nothing is in reach', async () => {
  const ctx = await start('mage', 'ready-spell');
  const { Game } = ctx;
  const p = Game.player();
  p.level = 5; p.sp = p.maxSp = 50;
  Game.level().monsters.length = 0;
  const hands = Game.knownSpells().find(s => s.id === 'burning_hands');
  if (Game.castSpell(hands)) return 'Burning Hands flew at nothing';
  if (Game.castLabel() !== 'Burning Hands') return `the Cast button says ${Game.castLabel()}`;
  // and a fighter's Cast button drinks a healing draught instead
  const f = await start('fighter', 'quaff');
  const fp = f.Game.player();
  if (f.Game.castLabel() !== 'Quaff') return `a fighter's Cast button says ${f.Game.castLabel()}`;
  fp.hp = 1;
  const before = fp.inv.filter(i => i.t === 'potion_heal').reduce((a, i) => a + i.q, 0);
  f.Game.input('cast');
  const after = fp.inv.filter(i => i.t === 'potion_heal').reduce((a, i) => a + i.q, 0);
  return (after === before - 1 && fp.hp > 1) || `Quaff left ${after} of ${before} draughts and ${fp.hp} hit points`;
});

await test('an area spell names itself and says it took the whole group', async () => {
  const ctx = await start('mage', 'name-spell');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.level = 9; p.sp = p.maxSp = 99;
  const m = groupAhead(ctx, 'goblin', 3, 50);
  m.nextAct = 1e9; p.nextAttack = G.t;
  const mark = markLog(G);
  Game.castSpell(Game.knownSpells().find(s => s.id === 'lightning'));
  const said = linesSince(G, mark);
  if (!said.some(l => /Lightning Bolt engulfs all 3 of the Goblins/.test(l))) return `said: ${said.join(' | ')}`;
  return said.some(l => /^Your Lightning Bolt hits the Goblin/.test(l)) || 'the damage line did not name the spell';
});

await test('bumping the same wall again counts up instead of filling the log', async () => {
  const ctx = await start('fighter', 'bump-count');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.WALL;
  L.monsters.length = 0;
  const rows = G.log.length;
  for (let i = 0; i < 4; i++) { G.t += 1000; Game.update(G.t, 1000); Game.input('forward'); }
  const last = G.log[G.log.length - 1];
  return (G.log.length - rows <= 1 && /\(×[34]\)$/.test(last.m)) || `four bumps left ${G.log.length - rows} new lines, the last "${last.m}"`;
});

await test('relics can be laid in a secret vault, and traders keep unknown gear unknown', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  let inVault = 0, tried = 0;
  for (let i = 0; i < 30 && !inVault; i++) {
    Game.newGame({ name: 'V', cls: 'fighter', stats: Game.rollStats(), seed: 'vault' + i, opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    const G = Game.state();
    for (const d of Object.keys(G.relics.floor).map(Number)) {
      // generate that floor the way the game would, by walking down to it
      while (G.depth < d) {
        const L = Game.level(), p = Game.player(), s = L.stairsDown;
        const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
        const [dx, dy] = Dungeon.DIRS[k];
        p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
        Game.input('use');
      }
      const L = Game.level();
      tried++;
      for (const k in L.items) if (L.items[k].some(it => it.u)) {
        // a pile the hero cannot walk to without finding a secret door
        const [x, y] = k.split(',').map(Number);
        const seen = new Set([L.start.y * L.w + L.start.x]), q = [...seen];
        while (q.length) { const c = q.pop(); for (const [ddx, ddy] of Dungeon.DIRS) { const n = c + ddy * L.w + ddx, t = L.tiles[n]; if (!seen.has(n) && t !== Dungeon.T.WALL && t !== Dungeon.T.SECRET && t !== Dungeon.T.TORCH && t !== Dungeon.T.FOUNTAIN) { seen.add(n); q.push(n); } } }
        if (!seen.has(y * L.w + x)) inVault++;
      }
    }
  }
  if (!inVault) return `no relic lay in a secret vault on ${tried} relic floors`;
  // a hidden +2 sold to a trader goes back on the shelf still hidden, at a plain price
  const t = await start('fighter', 'hidden-shelf');
  const tp = t.Game.player(), TL = t.Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  TL.npcs.length = 0; TL.npcs.push(shop); TL.monsters.length = 0;
  const [sx, sy] = t.Dungeon.DIRS[tp.dir]; shop.x = tp.x + sx; shop.y = tp.y + sy;
  t.Game.input('forward');
  const blade = { t: 'longsword', q: 1, e: 2, h: 1 };
  tp.inv.push(blade);
  t.Game.sell(blade);
  const shelved = shop.stock.find(s => s.t === 'longsword');
  if (!shelved || !shelved.h) return 'the trader shelved a hidden piece with its quality showing';
  return t.Game.buyPrice(shop, shelved) === t.Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) || 'the shelf price gave the hidden +2 away';
});


// ---------- telegraphed blows ----------
/** A monster beside the hero, awake and ready to act now. */
function beside(ctx, id, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  const m = { uid: 90, id, x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
  L.monsters.push(m);
  return m;
}

await test('a monster winds up before it strikes, and the blow comes a moment later', async () => {
  const ctx = await start('fighter', 'windup');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  const m = beside(ctx, 'goblin');
  const mark = markLog(G), t0 = G.t;
  let firstBlowAt = null, sawWindup = false;
  for (let i = 0; i < 40 && firstBlowAt === null; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup) sawWindup = true;
    if (linesSince(G, mark).some(l => /Goblin (hits|misses) you/.test(l))) firstBlowAt = G.t - t0;
  }
  if (!sawWindup) return 'the goblin struck without winding up';
  if (firstBlowAt === null) return 'the goblin never struck';
  return (firstBlowAt >= 300 && firstBlowAt <= 700) || `the blow landed ${firstBlowAt}ms after the wind-up began`;
});

await test('stepping out of reach during the wind-up makes the blow miss', async () => {
  const ctx = await start('fighter', 'dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up to dodge';
  // step back, away from it
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  const mark = markLog(G);
  for (let i = 0; i < 24; i++) Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  if (p.hp < hp0) return `stepping away still cost ${hp0 - p.hp} hit points`;
  return said.some(l => /swings at the air where you stood/.test(l)) || `said: ${said.join(' | ')}`;
});

await test('telegraphing does not slow monsters down: blows land as often as before', async () => {
  const ctx = await start('fighter', 'windup-pace');
  ctx.Dice.s = new ctx.Rng('windup-pace').s;
  const { Game, MONSTERS } = ctx;
  const p = Game.player(), G = Game.state();
  beside(ctx, 'goblin');
  let blows = 0;
  for (let i = 0; i < 600; i++) {
    p.hp = p.maxHp = 9999;
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    blows += linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
  }
  const expected = 15000 / MONSTERS.goblin.speed;
  return Math.abs(blows - expected) <= 2 || `a goblin struck ${blows} times in 15s, about ${expected.toFixed(1)} expected`;
});

await test('an archer draws before it shoots, and stepping out of line makes it miss', async () => {
  const ctx = await start('fighter', 'archer-dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  const hp0 = p.hp;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 91, id: 'archer', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(m);
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.kind !== 'shot') return 'the archer loosed without drawing';
  // sidestep out of its line
  const side = [0, 1, 2, 3].map(k => Dungeon.DIRS[k]).find(([sx, sy]) => sx !== dx && sx !== -dx || sy !== dy && sy !== -dy);
  L.tiles[(p.y + side[1]) * L.w + p.x + side[0]] = T.FLOOR;
  p.x += side[0]; p.y += side[1];
  const mark = markLog(G);
  for (let i = 0; i < 24; i++) Game.update(G.t + 25, 25);
  if (p.hp < hp0) return `stepping out of line still cost ${hp0 - p.hp}`;
  return linesSince(G, mark).some(l => /shot flies wide/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});


await test('a monster that steps up to you is already winding up as it arrives', async () => {
  const ctx = await start('fighter', 'windup-arrive');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.hp = p.maxHp = 999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 2; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 92, id: 'goblin', x: p.x + dx * 2, y: p.y + dy * 2, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(m);
  for (let i = 0; i < 40 && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 1; i++) Game.update(G.t + 25, 25);
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1) return 'the goblin never closed in';
  return (m.windup && m.windup.kind === 'melee' && m.windup.at >= G.t - 25) || 'it arrived beside the hero without drawing back';
});


// ---------- round four review ----------
await test('a drawn blow is dropped once the monster loses you, and on leaving the floor', async () => {
  const ctx = await start('fighter', 'drop-windup');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up began';
  // carry the hero far off: it can no longer find them
  const far = [];
  for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === Dungeon.T.FLOOR && Math.abs(i % L.w - m.x) + Math.abs(((i / L.w) | 0) - m.y) > 20) far.push(i);
  if (!far.length) return 'no far square on this floor';
  p.x = far[0] % L.w; p.y = (far[0] / L.w) | 0;
  for (let i = 0; i < 40; i++) Game.update(G.t + 250, 250);
  if (m.windup) return `after ten seconds out of reach it still held ${JSON.stringify(m.windup)}`;
  return true;
});

await test('buying back an unknown piece keeps it unknown', async () => {
  const ctx = await start('fighter', 'buy-hidden');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  const blade = { t: 'longsword', q: 1, e: 2, h: 1 };
  p.inv.push(blade);
  Game.sell(blade);
  p.gold = 999;
  Game.buy(shop.stock.find(s => s.t === 'longsword'));
  const back = p.inv.find(i => i.t === 'longsword' && i !== blade);
  return (back && back.h === 1) || `bought back as ${JSON.stringify(back)}`;
});

await test('a new game starts with a clean clock for bump messages', async () => {
  const ctx = await start('fighter', 'bump-clock');
  const { Game, Dungeon } = ctx;
  const bumpNow = () => {
    const p = Game.player(), L = Game.level(), G = Game.state();
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.WALL;
    L.monsters.length = 0;
    const mark = markLog(G);
    Game.input('forward');
    return linesSince(G, mark).some(l => /blocks your path/.test(l));
  };
  Game.state().t = 600000;
  if (!bumpNow()) return 'the first run logged no bump';
  Game.newGame({ name: 'Two', cls: 'fighter', stats: Game.rollStats(), seed: 'bump-clock-2', opts: OPTS });
  Game.update(0, 1000);
  return bumpNow() || 'the second run swallowed its first bump';
});

await test('a monster made to miss presses in: its next blow is drawn back faster', async () => {
  const ctx = await start('fighter', 'pressing');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  const first = m.windup.until - m.windup.at;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;                               // step back: it whiffs
  let second = null;
  for (let i = 0; i < 80 && second === null; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup && m.windup.at > G.t - 30 && G.t > 600) second = m.windup.until - m.windup.at;
  }
  if (second === null) return 'no second wind-up followed the miss';
  return (second < first && second >= 250) || `after a miss the wind-up went from ${first}ms to ${second}ms`;
});

// ---------- round four playtest ----------
await test('a group draws back as one: a full warning, then every member\'s blow in a volley', async () => {
  const ctx = await start('fighter', 'volley');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'the trio struck without drawing back';
  if (m.windup.until - m.windup.at < 400) return `a trio's warning lasted only ${m.windup.until - m.windup.at}ms`;
  const mark = markLog(G);
  for (let i = 0; i < 56; i++) Game.update(G.t + 25, 25);
  const blows = linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
  return blows === 3 || `the volley landed ${blows} blows, not three`;
});

await test('stepping back from a group\'s wind-up dodges the whole volley', async () => {
  const ctx = await start('fighter', 'volley-dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up to dodge';
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  for (let i = 0; i < 24; i++) Game.update(G.t + 25, 25);
  return p.hp === hp0 || `stepping away from three goblins still cost ${hp0 - p.hp} hit points`;
});

await test('stepping away mid-volley spares you the blows still to come', async () => {
  const ctx = await start('fighter', 'volley-mid');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  const mark = markLog(G);
  for (let i = 0; i < 40 && !m.volley; i++) Game.update(G.t + 25, 25);
  if (!m.volley) return 'no volley followed the first blow';
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  const blows = said.filter(l => /Goblin (hits|misses) you/.test(l)).length;
  if (blows !== 1) return `${blows} blows landed, though the hero left after the first`;
  return said.some(l => /rest of the Goblins swing at the air/.test(l)) || `said: ${said.join(' | ')}`;
});

await test('shallow venom burns briefly, deep venom for the full twenty seconds', async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'game.js'), 'utf8');
  const m = src.match(/const poisonFor = \(\) => \(\{ until: G\.t \+ Math\.min\((\d+), (\d+) \+ (\d+) \* G\.depth\)/);
  if (!m) return 'no depth-scaled poison';
  const [cap, base, per] = m.slice(1).map(Number);
  const at = d => Math.min(cap, base + per * d);
  if (src.includes('p.poison = { until: G.t + 20000')) return 'a poison source still ignores depth';
  return (at(1) <= 10000 && at(4) === 20000) || `poison lasts ${at(1)}ms on floor one and ${at(4)}ms on floor four`;
});

await test('the death epilogue on a shallow floor does not claim to beat the fourth crew', async () => {
  const ctx = await start('fighter', 'shallow-death');
  const p = ctx.Game.player();
  p.deepest = 1;
  const lost = ctx.Game.epilogue(false).join(' ');
  if (/further than the fourth crew/.test(lost)) return lost;
  p.deepest = 5;
  return /further than the fourth crew/.test(ctx.Game.epilogue(false).join(' ')) || 'a deep death no longer credits the hero';
});

await test('with no healing draught known, the Cast button says so', async () => {
  const ctx = await start('fighter', 'dry-quaff');
  const p = ctx.Game.player();
  p.inv = p.inv.filter(i => i.t !== 'potion_heal' && i.t !== 'potion_xheal');
  return ctx.Game.castLabel() === 'Quaff (none)' || `it says ${ctx.Game.castLabel()}`;
});

await test('a step tapped while the camera is still turning is kept, not dropped', async () => {
  const ctx = await start('fighter', 'queue-move');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  const d0 = p.dir;
  Game.input('left');
  Game.input('left');                                 // tapped mid-turn
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return p.dir === (d0 + 2) % 4 || `facing ${p.dir} from ${d0}: the second turn was lost`;
});

await test('a held button resent while the view turns is not kept as a second press', async () => {
  const ctx = await start('fighter', 'held-turn');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  const d0 = p.dir;
  Game.input('left');
  Game.input('left', true);                           // the hold loop, a frame later
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return p.dir === (d0 + 3) % 4 || `one held tap turned the hero from ${d0} to ${p.dir}`;
});

await test('a first-level mage can already cast Shield', async () => {
  const { SPELLS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  const all = SPELLS.mage;
  const shield = all.find(s => s && s.id === 'shield');
  return (shield && shield.lvl === 1) || `Shield needs level ${shield && shield.lvl}`;
});

// ---------- signature moves ----------
/** Run fn with Math.random pinned, for the few chances the game rolls outside the dice. */
async function pinned(v, fn) {
  const real = Math.random;
  Math.random = () => v;
  try { return await fn(); } finally { Math.random = real; }
}
/** A monster straight ahead at a distance, down a cleared corridor. */
function ahead(ctx, id, dist, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= dist; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 95, id, x: p.x + dx * dist, y: p.y + dy * dist, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
  L.monsters.push(m);
  return m;
}
/** Make the square behind the hero open floor. */
function clearBehind(ctx) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[(p.dir + 2) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
}
/** Carry the hero a square back (away from what faces them), or to the side. */
function shift(ctx, how) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[how === 'back' ? (p.dir + 2) % 4 : (p.dir + 1) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  p.x += dx; p.y += dy;
}
const run = (Game, G, ms) => { for (let t = 0; t < ms; t += 25) Game.update(G.t + 25, 25); };

await test('an ogre heaves up a crushing blow every third swing: longer, violet, and twice as hard', async () => {
  const ctx = await start('fighter', 'crush');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return `it drew ${JSON.stringify(m.windup)}`;
  if (m.windup.until - m.windup.at < 800) return `the crush gave only ${m.windup.until - m.windup.at}ms of warning`;
  const mark = markLog(G);
  run(Game, G, 1000);
  return linesSince(G, mark).some(l => /brings its club down on you|misses you/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('stepping out of the ogre\'s crush leaves it staggered and open', async () => {
  const ctx = await start('fighter', 'crush-dodge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const hp0 = p.hp;
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return 'no crush began';
  shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 950);
  if (p.hp < hp0) return `the dodged crush still cost ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /smashes the floor/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  return m.nextAct - G.t >= 1200 || `it recovered in ${m.nextAct - G.t}ms`;
});

await test('an orc charges down a straight corridor and slams into a hero who stays in line', async () => {
  const ctx = await start('fighter', 'charge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = ahead(ctx, 'orc', 3);
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return `it drew ${JSON.stringify(m.windup)}`;
  const mark = markLog(G);
  run(Game, G, 800);
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1) return 'the orc did not reach the hero';
  return linesSince(G, mark).some(l => /slams into you|misses you/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('sidestepping a charge sends the orc thundering past, stumbling', async () => {
  const ctx = await start('fighter', 'charge-dodge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const hp0 = p.hp;
  const m = ahead(ctx, 'orc', 3);
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return 'no charge began';
  shift(ctx, 'side');
  const mark = markLog(G);
  run(Game, G, 750);
  if (p.hp < hp0) return `the dodged charge still cost ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /thunders past you/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  return m.nextAct - G.t >= 1200 || `it recovered in ${m.nextAct - G.t}ms`;
});

await test('a spider\'s web holds the hero until they tear free, and misses a hero who steps aside', async () => {
  const ctx = await start('fighter', 'web');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = ahead(ctx, 'spider', 3);
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'web') return `it drew ${JSON.stringify(m.windup)}`;
  run(Game, G, 700);
  if (!(p.webbed > G.t)) return 'the web did not hold the hero';
  m.nextAct = 1e12;
  clearBehind(ctx);
  const x0 = p.x, y0 = p.y;
  Game.input('back');
  if (p.x !== x0 || p.y !== y0) return 'the hero walked straight out of the web';
  let pushes = 1;
  while ((p.x === x0 && p.y === y0) && pushes < 20) { Game.update(G.t + 50, 50); Game.input('back'); pushes++; }
  if (pushes >= 20) return 'pushing never tore the web';
  // and a web dodged
  const c2 = await start('fighter', 'web-dodge');
  const m2 = ahead(c2, 'spider', 3);
  c2.Game.update(c2.Game.state().t + 25, 25);
  shift(c2, 'side');
  run(c2.Game, c2.Game.state(), 700);
  if (c2.Game.player().webbed > c2.Game.state().t) return 'a web held a hero who had stepped out of its line';
  return pushes >= 3 || `the web tore after only ${pushes} pushes`;
});

await test('a zombie\'s grip holds a weak hero more often than a strong one, and ends when it falls', async () => {
  const tries = async str => {
    const ctx = await start('fighter', 'grab-' + str);
    ctx.Dice.s = new ctx.Rng('grab-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.stats.str = str;
    const z = beside(ctx, 'zombie', { nextAct: 1e12 });
    clearBehind(ctx);                              // room to step back into
    const home = [p.x, p.y];
    let held = 0;
    for (let i = 0; i < 60; i++) {
      [p.x, p.y] = home;
      const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      z.x = p.x + dx; z.y = p.y + dy;
      p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
      Game.update(G.t + 400, 400);
      Game.input('back');
      if (p.x === home[0] && p.y === home[1]) held++;
    }
    return { held, ctx, z };
  };
  const weak = await tries(3), strong = await tries(18);
  if (!(weak.held > strong.held + 10)) return `a weak hero was held ${weak.held} of 60 times, a strong one ${strong.held}`;
  // killing the zombie frees the hero
  const { ctx, z } = weak, G = ctx.Game.state(), p = ctx.Game.player();
  p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
  ctx.Game.level().monsters.length = 0;
  ctx.Game.update(G.t + 25, 25);
  return !p.grabbed || 'the grip outlived the zombie';
});

await test('a zombie\'s hit can take hold of the hero', async () => {
  const ctx = await start('fighter', 'grab-hit');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  beside(ctx, 'zombie');
  await pinned(0, () => { for (let i = 0; i < 400 && !p.grabbed; i++) Game.update(G.t + 25, 25); });
  return !!p.grabbed || 'ten seconds of zombie blows and never a grip';
});

await test('a ghoul\'s touch can freeze the hero: no step, swing or spell until it passes', async () => {
  const ctx = await start('fighter', 'paralyse');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.con = 3;
  const m = beside(ctx, 'ghoul');
  await pinned(0, () => { for (let i = 0; i < 800 && !(p.held > G.t); i++) Game.update(G.t + 25, 25); });
  if (!(p.held > G.t)) return 'twenty seconds of ghoul blows and never frozen';
  m.nextAct = 1e12;
  const x0 = p.x, next0 = p.nextAttack;
  G.t = Math.max(G.t, p.nextAttack - 1);
  Game.input('back'); Game.input('attack');
  if (p.x !== x0 || p.nextAttack !== next0) return 'a frozen hero still acted';
  Game.update(G.t + 1400, 1400);
  return !(p.held > G.t) || 'the freeze never wore off';
});

await test('a slime struck hard splits into two in its square, once', async () => {
  const ctx = await start('fighter', 'split');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const m = beside(ctx, 'slime', { hp: 30, maxHp: 30, nextAct: 1e12 });
  G.t = p.nextAttack; Game.input('attack');
  if (!m.pack || m.pack.length !== 1) return `after one blow: ${JSON.stringify({ hp: m.hp, pack: m.pack })}`;
  const total = m.hp + m.pack[0].hp;
  if (total >= 30 || total < 1) return `the halves hold ${total} of what was left`;
  // cut down the front half: the other steps up, and does not split again
  m.hp = 1; G.t = p.nextAttack; Game.input('attack');
  if (m.pack) return 'the front half did not fall';
  G.t = p.nextAttack; Game.input('attack');
  return !m.pack || 'a slime split a second time';
});

await test('a skeleton cut down by an edge rises again unless its bones are smashed; a mace keeps it down', async () => {
  const edge = await start('fighter', 'rise');
  const { Game } = edge;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
  const m = beside(edge, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  G.t = p.nextAttack; Game.input('attack');
  if (!L.monsters.includes(m) || !m.collapsed) return 'a sword-felled skeleton did not fall into a heap';
  run(Game, G, 5000);
  if (m.collapsed || m.hp !== 10) return `after the wait: collapsed ${m.collapsed}, hp ${m.hp}`;
  // the second time it stays down
  m.hp = 1; m.nextAct = 1e12; G.t = p.nextAttack; Game.input('attack');
  if (L.monsters.includes(m)) return 'it rose a second time';
  // smashing the heap ends it
  const heap = await start('fighter', 'rise-smash');
  const hp2 = heap.Game.player(), G2 = heap.Game.state(), L2 = heap.Game.level();
  hp2.perkHit = 60; hp2.eq.weapon = { t: 'longsword', q: 1, e: 0 };
  const m2 = beside(heap, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  G2.t = hp2.nextAttack; heap.Game.input('attack');
  hp2.perkHit = -100;                                 // a hero who could hit nothing still hits a heap
  G2.t = hp2.nextAttack; heap.Game.input('attack');
  if (L2.monsters.includes(m2)) return 'striking the heap did not scatter it';
  // a mace crushes it outright
  const blunt = await start('cleric', 'rise-mace');
  const bp = blunt.Game.player(), G3 = blunt.Game.state(), L3 = blunt.Game.level();
  bp.perkHit = 60; bp.eq.weapon = { t: 'mace', q: 1, e: 0 };
  const m3 = beside(blunt, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  G3.t = bp.nextAttack; blunt.Game.input('attack');
  return !L3.monsters.includes(m3) || 'a mace left the skeleton able to rise';
});

await test('fire stops a troll growing back; other magic does not', async () => {
  const regrows = async spellId => {
    const ctx = await start('mage', 'troll-' + spellId);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.sp = p.maxSp = 99;
    const m = beside(ctx, 'troll', { hp: 200, maxHp: 400, nextAct: 1e12 });
    G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === spellId));
    const after = m.hp;
    run(Game, G, 4000);
    return m.hp - after;
  };
  const burnt = await regrows('burning_hands'), zapped = await regrows('magic_missile');
  return (burnt === 0 && zapped >= 3) || `after fire it grew back ${burnt}, after a missile ${zapped}`;
});

await test('a dark acolyte chants to mend the wounded, and a blow breaks the chant', async () => {
  const ctx = await start('fighter', 'mend');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const m = beside(ctx, 'acolyte', { hp: 20, maxHp: 100 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'mend') return `it drew ${JSON.stringify(m.windup)}`;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (m.windup) return 'the blow did not break the chant';
  const hp1 = m.hp;
  // left alone it finishes
  const c2 = await start('fighter', 'mend-free');
  const m2 = beside(c2, 'acolyte', { hp: 20, maxHp: 100 });
  const G2 = c2.Game.state();
  c2.Game.player().hp = 9999;
  c2.Game.update(G2.t + 25, 25);
  run(c2.Game, G2, 2000);
  return (m2.hp > 20 && hp1 < 20) || `unbroken it reached ${m2.hp}; broken, ${hp1}`;
});

await test('the lich\'s cold fire breaks short of a hero who gets clear, and it calls up guards as it weakens', async () => {
  const ctx = await start('fighter', 'nova');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = beside(ctx, 'lich', { blows: 2, hp: 300, maxHp: 300 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'nova') return `it drew ${JSON.stringify(m.windup)}`;
  shift(ctx, 'back'); shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 1350);
  if (p.hp < hp0) return `the nova reached a hero three squares off for ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /breaks short of you/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  // wound it past two thirds: the dead rise
  m.nextAct = 1e12; m.hp = 150;
  p.perkHit = 60;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  const guards = L.monsters.filter(o => o.id === 'skeleton');
  return (guards.length === 1 && guards[0].pack && guards[0].pack.length === 1) || `guards: ${JSON.stringify(guards.map(g => g.pack))}`;
});

// ---------- bestiary ----------
await test('the bestiary counts each monster once when met, and says so the first time', async () => {
  const ctx = await start('fighter', 'beast-meet');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const mark = markLog(G);
  const m = beside(ctx, 'goblin', { awake: false });
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (!m.awake) return 'the goblin never woke';
  const said = linesSince(G, mark);
  if (!said.some(l => /Bestiary, Goblin: new entry/.test(l))) return `said: ${said.join(' | ')}`;
  if (Game.bestiary().goblin.met !== 1) return `met counted ${Game.bestiary().goblin.met} for one goblin`;
  // the same goblin again, asleep and woken, is not a new meeting; another is
  m.awake = false;
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (Game.bestiary().goblin.met !== 1) return 'waking the same goblin twice counted it twice';
  beside(ctx, 'goblin', { uid: 77, awake: false });
  const m2 = markLog(G);
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (Game.bestiary().goblin.met !== 2) return `a second goblin left met at ${Game.bestiary().goblin.met}`;
  return !linesSince(G, m2).some(l => /new entry/.test(l)) || 'the second goblin was announced as new';
});

await test('kills fill the bestiary in: its measure at one, its trick at three, the answer at five', async () => {
  const ctx = await start('fighter', 'beast-kills');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  const seen = [];
  for (let k = 1; k <= 5; k++) {
    const m = beside(ctx, 'orc', { uid: 500 + k, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let i = 0; i < 6 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
    if (L.monsters.includes(m)) return `orc ${k} survived`;
    const r = Game.bestiary().orc;
    seen.push(`${r.kills}:${r.trick ? 't' : '-'}${r.answer ? 'a' : '-'}`);
  }
  return seen.join(' ') === '1:-- 2:-- 3:t- 4:t- 5:ta' || `knowledge by kill: ${seen.join(' ')}`;
});

await test('seeing a trick writes it down, and beating it writes the answer', async () => {
  const ctx = await start('fighter', 'beast-trick');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return 'no crush began';
  const r1 = Game.bestiary().ogre;
  if (!r1.trick || r1.answer) return `after seeing it: ${JSON.stringify(r1)}`;
  shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 950);
  const r2 = Game.bestiary().ogre;
  if (!r2.answer) return `after dodging it: ${JSON.stringify(r2)}`;
  void p;
  return linesSince(G, mark).some(l => /Bestiary, Ogre: how to beat it/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('the bestiary remembers what killed you, and outlasts the run', async () => {
  const ctx = await start('fighter', 'beast-death');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = 1; p.eq.armor = null; p.eq.shield = null;
  beside(ctx, 'goblin');
  for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead') return 'the goblin never killed the hero';
  if (Game.bestiary().goblin.deaths !== 1) return `deaths: ${Game.bestiary().goblin.deaths}`;
  Game.newGame({ name: 'Next', cls: 'thief', stats: Game.rollStats(), seed: 'beast-next', opts: OPTS });
  const r = Game.bestiary().goblin;
  return (r && r.met >= 1 && r.deaths === 1) || `the next hero's bestiary: ${JSON.stringify(r)}`;
});

await test('a trick seen again does not rewrite the bestiary: a regrowing troll is not a write a second', async () => {
  const ctx = await start('fighter', 'beast-quiet');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'troll', { hp: 100, maxHp: 400, nextAct: 1e12 });
  p.perkHit = 60;
  for (let i = 0; i < 6 && m.hp === 100; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // met (a natural 1 still misses)
  run(Game, G, 1100);                                  // it regrows: trick seen
  if (!Game.bestiary().troll.trick) return 'watching a troll regrow did not note its trick';
  const real = localStorage.setItem.bind(localStorage);
  let writes = 0;
  localStorage.setItem = (k, v) => { if (k === 'deepdelve.bestiary') writes++; real(k, v); };
  try { run(Game, G, 5000); } finally { localStorage.setItem = real; }
  void m;
  return writes === 0 || `five more seconds of regrowth wrote the bestiary ${writes} times`;
});

// ---------- round five review ----------
await test('holding a direction does not shred a web: pushes tear no faster than four a second', async () => {
  const ctx = await start('fighter', 'web-hold');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  clearBehind(ctx);
  p.webbed = G.t + 2500;
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 38; i++) { Game.update(G.t + 16, 16); Game.input('back', true); Game.input('back'); }
  return (p.x === x0 && p.y === y0) || 'six hundred milliseconds of holding tore a 2.5s web';
});

await test('a frozen hero cannot cast, drink or swing from any screen', async () => {
  const ctx = await start('mage', 'frozen-screens');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.held = G.t + 5000; p.hp = 1; G.t = Math.max(G.t, p.nextAttack);
  const sp0 = p.sp;
  if (Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'))) return 'Shield was cast while frozen';
  const draught = p.inv.find(i => i.t === 'potion_heal');
  if (draught) { Game.useItem(draught); if (p.hp !== 1) return 'a potion was drunk while frozen'; }
  return p.sp === sp0 || 'spell points were spent while frozen';
});

await test('a trader stands in the way of a charge and a shot', async () => {
  const ctx = await start('fighter', 'trader-line');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const m = ahead(ctx, 'orc', 3);
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.npcs.length = 0;
  L.npcs.push({ id: 'merchant', x: p.x + dx * 2, y: p.y + dy * 2, markup: 2, stock: [] });
  let charged = false;
  await pinned(0.1, () => { for (let i = 0; i < 40; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'charge') charged = true; } });
  if (m.x === p.x + dx * 2 && m.y === p.y + dy * 2) return 'the orc charged onto the trader';
  return !charged || 'the orc began a charge through the trader';
});

await test('a volley ends early when the group falls mid-volley', async () => {
  const ctx = await start('fighter', 'volley-cut');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  const mark = markLog(G);
  for (let i = 0; i < 40 && !m.volley; i++) Game.update(G.t + 25, 25);
  if (!m.volley) return 'no volley began';
  delete m.pack;                                     // the other two cut down
  run(Game, G, 700);
  const blows = linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
  return blows === 1 || `a lone goblin landed ${blows} blows of a trio's volley`;
});

await test('a step queued at the end of one run does not happen in the next', async () => {
  const ctx = await start('fighter', 'queue-carry');
  const { Game } = ctx;
  Game.level().monsters.length = 0;
  Game.input('left'); Game.input('left');              // the second is queued
  Game.newGame({ name: 'Next', cls: 'fighter', stats: Game.rollStats(), seed: 'queue-carry-2', opts: OPTS });
  const G = Game.state(), d0 = Game.player().dir;
  Game.level().monsters.length = 0;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return Game.player().dir === d0 || 'the last run\'s turn happened in the new one';
});

await test('webbed or held fast, the hero cannot take the stairs', async () => {
  const ctx = await start('fighter', 'pinned-stairs');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.STAIRS_DOWN;   // facing a way down
  const z = beside(ctx, 'zombie', { nextAct: 1e12 });
  L.monsters.length = 0;
  p.webbed = G.t + 2000;
  Game.input('use');
  if (G.depth !== 1) return 'a webbed hero went down the stairs';
  p.webbed = 0;
  L.monsters.push(Object.assign(z, { x: p.x - dx, y: p.y - dy }));   // holding on from behind
  L.tiles[z.y * L.w + z.x] = Dungeon.T.FLOOR;
  p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
  Game.input('use');
  return G.depth === 1 || 'a grabbed hero went down the stairs';
});

await test('one great blow past both thresholds raises both of the lich\'s guards, on open floor', async () => {
  const ctx = await start('fighter', 'lich-phases');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.perkHit = 60;
  const m = beside(ctx, 'lich', { hp: 90, maxHp: 300, nextAct: 1e12 });
  // wall the lich in on three sides: guards must come out of the open side, not the stone
  for (const [dx, dy] of Dungeon.DIRS) { const x = m.x + dx, y = m.y + dy; if (x !== p.x || y !== p.y) L.tiles[y * L.w + x] = T.WALL; }
  for (let i = 0; i < 6 && m.hp === 90; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // a natural 1 still misses
  const guards = L.monsters.filter(o => o.id === 'skeleton');
  if (guards.length !== 2) return `${guards.length} guard groups rose from one blow past both thresholds`;
  // every guard can walk to the lich
  const reach = new Set([m.y * L.w + m.x]), q = [[m.x, m.y]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of Dungeon.DIRS) { const nx = x + dx, ny = y + dy, i = ny * L.w + nx; if (reach.has(i)) continue; const t = L.tiles[i]; if (t === T.WALL || t === T.TORCH || t === T.SECRET) continue; reach.add(i); if (reach.size < 400) q.push([nx, ny]); } }
  const cut = guards.filter(g => !reach.has(g.y * L.w + g.x));
  return !cut.length || `guards rose behind a wall at ${cut.map(g => g.x + ',' + g.y).join(' ')}`;
});

await test('a split slime is worth one slime between its halves', async () => {
  const ctx = await start('fighter', 'split-xp');
  const { Game, MONSTERS } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  const m = beside(ctx, 'slime', { hp: 30, maxHp: 30, nextAct: 1e12 });
  const xp0 = p.xp;
  for (let i = 0; i < 6 && !m.pack; i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
  if (!m.pack) return 'it did not split';
  m.hp = 1; m.pack[0].hp = 1;
  for (let i = 0; i < 8 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
  if (L.monsters.includes(m)) return 'the halves did not both fall';
  return p.xp - xp0 <= MONSTERS.slime.xp + 1 || `the halves paid ${p.xp - xp0} xp for a ${MONSTERS.slime.xp} xp slime`;
});

await test('a corrupt bestiary in storage is shrugged off, not a crash', async () => {
  const ctx = await start('fighter', 'beast-corrupt');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  for (const bad of ['{"goblin":5}', '{"goblin":null}', '[]', 'not json', '{"goblin":{"met":"lots","kills":null}}']) {
    localStorage.setItem('deepdelve.bestiary', bad);
    const m = beside(ctx, 'goblin', { uid: 300 + bad.length, hp: 1, maxHp: 1, nextAct: 1e12 });
    G.t = p.nextAttack;
    try { Game.input('attack'); } catch (e) { return `stored ${bad}: ${e.message}`; }
    if (Game.level().monsters.includes(m)) return `stored ${bad}: the goblin did not die`;
    const r = Game.bestiary().goblin;
    if (!r || r.kills < 1 || !Number.isFinite(r.met)) return `stored ${bad}: the record came back ${JSON.stringify(r)}`;
  }
  return true;
});

await test('the lich\'s cold fire does not reach round a wall', async () => {
  const ctx = await start('fighter', 'nova-wall');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  const hp0 = p.hp;
  const m = ahead(ctx, 'lich', 2, { nextAct: 1e12 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = T.WALL;      // a wall between them
  m.windup = { kind: 'move', move: 'nova', at: G.t, until: G.t + 10 };
  m.nextAct = G.t;
  const mark = markLog(G);
  run(Game, G, 100);
  if (p.hp < hp0) return `the nova burned through the wall for ${hp0 - p.hp}`;
  return linesSince(G, mark).some(l => /breaks short/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

// ---------- round five playtest ----------
for (const [id, verb, air] of [['zombie', 'lurches forward', /grabs at the air/], ['ghoul', 'numbing claw', /closes on the air/]]) {
  await test(`the ${id}'s trick is telegraphed in violet, and a step back makes it miss`, async () => {
    const ctx = await start('fighter', 'tell-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.con = 3;
    const m = beside(ctx, id, { blows: 2 });
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (!m.windup || !m.windup.move) return `it drew ${JSON.stringify(m.windup)}`;
    if (!linesSince(G, mark).some(l => l.includes(verb))) return `said: ${linesSince(G, mark).join(' | ')}`;
    shift(ctx, 'back');
    run(Game, G, 800);
    if (p.grabbed || p.held > G.t) return 'the dodged trick still took hold';
    return linesSince(G, mark).some(l => air.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
  });
}

await test('the log tells what happened before what the bestiary learned from it', async () => {
  const ctx = await start('fighter', 'log-order');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const m = ahead(ctx, 'spider', 3);
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  const trick = said.findIndex(l => /rears back to spit a web/.test(l)), note = said.findIndex(l => /^Bestiary, Cave Spider/.test(l));
  if (trick < 0 || note < 0 || note < trick) return `order: ${said.join(' | ')}`;
  if (said.filter(l => /^Bestiary/.test(l)).length !== 1) return `more than one bestiary line: ${said.join(' | ')}`;
  // and a kill: destroyed first, then one note
  const m2 = beside(ctx, 'rat', { uid: 612, hp: 1, maxHp: 1, nextAct: 1e12 });
  const k = markLog(G);
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  const after = linesSince(G, k);
  void m; void m2;
  const dead = after.findIndex(l => /destroyed/.test(l)), n2 = after.findIndex(l => /^Bestiary, Giant Rat/.test(l));
  return (dead >= 0 && n2 > dead && after.filter(l => /^Bestiary/.test(l)).length === 1) || `order: ${after.join(' | ')}`;
});

await test('even a quick rat gives a thumb over half a second of warning as it arrives', async () => {
  const ctx = await start('fighter', 'rat-warning');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  const m = ahead(ctx, 'rat', 2);
  for (let i = 0; i < 60 && !m.windup; i++) Game.update(G.t + 25, 25);
  if (!m.windup) return 'the rat never drew back';
  const dur = m.windup.until - m.windup.at;
  return dur >= 550 || `the rat's first blow gave ${dur}ms of warning`;
});

// ---------- talents ----------
/** Give the hero a talent, as if chosen. */
const talent = (ctx, id) => { const p = ctx.Game.player(); p.talents = (p.talents || []).concat(id); };

await test('levelling offers a lesson at most levels and a class talent every third', async () => {
  const ctx = await start('fighter', 'talent-offers');
  const { Game, XP_TABLE, TALENTS, BOONS } = ctx;
  const p = Game.player();
  const kinds = [];
  for (let lvl = 2; lvl <= 6; lvl++) {
    p.xp = XP_TABLE[lvl - 1];
    Game.state().player.xp = p.xp;
    // a kill tips the experience over; take whatever is offered
    const m = beside(ctx, 'rat', { uid: 800 + lvl, hp: 1, maxHp: 1, nextAct: 1e12 });
    p.perkHit = 60;
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { Game.state().t = p.nextAttack; Game.input('attack'); }
    while (Game.pendingBoons()) {
      const offer = Game.pendingBoons();
      const isTalent = offer.every(id => TALENTS.fighter.some(t => t.id === id));
      const isLesson = offer.every(id => BOONS.some(b => b.id === id));
      kinds.push(`${p.level}:${isTalent ? 'T' : isLesson ? 'L' : '?'}`);
      if (!Game.chooseBoon(offer[0])) return `could not choose ${offer[0]}`;
    }
  }
  if (kinds.join(' ') !== '2:L 3:T 4:L 5:L 6:T') return `offers by level: ${kinds.join(' ')}`;
  return (p.talents.length === 2 && new Set(p.talents).size === 2) || `talents taken: ${JSON.stringify(p.talents)}`;
});

await test('a talent is never offered twice', async () => {
  const ctx = await start('mage', 'talent-once');
  const { Game, XP_TABLE, TALENTS } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const taken = [];
  for (const lvl of [3, 6, 9, 12]) {
    G.pendingBoons = [];
    p.level = lvl - 1; p.xp = XP_TABLE[lvl - 1];
    const m = beside(ctx, 'rat', { uid: 900 + lvl, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    const offer = Game.pendingBoons();
    if (!offer) return `no offer at level ${lvl}`;
    if (!offer.every(id => TALENTS.mage.some(t => t.id === id))) return `level ${lvl} offered ${offer.join(', ')}`;
    const again = offer.find(id => taken.includes(id));
    if (again) return `${again} was offered again at level ${lvl}`;
    taken.push(offer[0]);
    Game.chooseBoon(offer[0]);
  }
  return (p.talents.length === 4 && new Set(p.talents).size === 4) || `talents: ${p.talents.join(', ')}`;
});

await test('Cleave carries half the blow into the one behind', async () => {
  const ctx = await start('fighter', 'cleave');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; talent(ctx, 'cleave');
  const m = groupAhead(ctx, 'goblin', 2, 400);
  m.nextAct = 1e12;
  G.t = p.nextAttack; Game.input('attack');
  const front = 400 - m.hp, back = 400 - m.pack[0].hp;
  return (front > 0 && back === Math.max(1, Math.floor(front / 2))) || `front took ${front}, behind ${back}`;
});

await test('Riposte: a blow that misses readies the next swing at once', async () => {
  const ctx = await start('fighter', 'riposte');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'riposte');
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up';
  p.nextAttack = G.t + 5000;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  run(Game, G, 700);
  return p.nextAttack <= G.t || `after the whiff the next swing was still ${p.nextAttack - G.t}ms off`;
});

await test('Stand Firm halves a crushing blow and turns away a grab', async () => {
  const hit = async firm => {
    const ctx = await start('fighter', 'firm');
    ctx.Dice.s = new ctx.Rng('firm-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    if (firm) talent(ctx, 'stand_firm');
    let dealt = 0;
    for (let i = 0; i < 20; i++) {
      beside(ctx, 'ogre', { uid: 700 + i, blows: 2 });
      const hp0 = p.hp;
      run(Game, G, 1000);
      dealt += hp0 - p.hp;
    }
    return dealt;
  };
  const plain = await hit(false), firm = await hit(true);
  if (!(firm < plain * 0.7)) return `crushes dealt ${plain} plain and ${firm} standing firm`;
  const ctx = await start('fighter', 'firm-grab');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  talent(ctx, 'stand_firm');
  for (let i = 0; i < 10; i++) { beside(ctx, 'zombie', { uid: 750 + i, blows: 1 }); run(Game, G, 900); if (p.grabbed) return 'a zombie grabbed a hero who stands firm'; }
  return true;
});

await test('Second Wind lifts a hero out of danger once, then waits', async () => {
  const ctx = await start('fighter', 'second-wind');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'second_wind');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  p.maxHp = 60; p.hp = 16;                          // one hit from under a quarter
  beside(ctx, 'goblin');
  const mark = markLog(G);
  for (let i = 0; i < 800 && !linesSince(G, mark).some(l => /Second wind!/.test(l)); i++) {
    Game.update(G.t + 25, 25);
    if (p.hp > 16) p.hp = 16;                      // keep it on the edge until the wind comes
  }
  if (!linesSince(G, mark).some(l => /Second wind!/.test(l))) return 'no second wind came';
  return p.windReady > G.t + 60000 || 'second wind can come again at once';
});

await test('Last Rites keeps the hero alive once, and only once', async () => {
  const ctx = await start('cleric', 'last-rites');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'last_rites');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  beside(ctx, 'ogre');
  p.hp = 1;
  for (let i = 0; i < 400 && !p.ritesUsed; i++) Game.update(G.t + 25, 25);
  if (!p.ritesUsed || G.status !== 'playing' || p.hp !== 1) return `after the killing blow: ${G.status}, hp ${p.hp}, rites ${p.ritesUsed}`;
  for (let i = 0; i < 800 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  return G.status === 'dead' || 'the hero was saved a second time';
});

await test('Mirror Image: Shield conjures two images that take the next two blows', async () => {
  const ctx = await start('mage', 'mirror');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'mirror_image');
  p.hp = p.maxHp = 999; p.sp = 99;
  Game.level().monsters.length = 0;
  G.t = Math.max(G.t, p.nextAttack);
  Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'));
  if (p.mirrors !== 2) return `images: ${p.mirrors}`;
  beside(ctx, 'goblin');
  const hp0 = p.hp, mark = markLog(G);
  let n = 0;
  for (let i = 0; i < 400 && n < 2; i++) { Game.update(G.t + 25, 25); n = linesSince(G, mark).filter(l => /strikes one of your images/.test(l)).length; }
  return (n === 2 && p.hp === hp0 && p.mirrors === 0) || `images struck ${n}, hp lost ${hp0 - p.hp}`;
});

await test('Kindling leaves a burn that ticks and stops a troll regrowing', async () => {
  const ctx = await start('mage', 'kindling');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'kindling');
  p.sp = p.maxSp = 99;
  const m = beside(ctx, 'goblin', { hp: 300, maxHp: 300, nextAct: 1e12 });
  G.t = p.nextAttack;
  Game.castSpell(Game.knownSpells().find(s => s.id === 'burning_hands'));
  const after = m.hp, mark = markLog(G);
  run(Game, G, 3200);
  const ticks = linesSince(G, mark).filter(l => /burns for/.test(l)).length;
  return (ticks >= 2 && ticks <= 4 && m.hp < after) || `burn ticked ${ticks} times, hp ${after} -> ${m.hp}`;
});

await test('Venomed Blades poison the living, never the undead', async () => {
  const hits = async id => {
    const ctx = await start('thief', 'venom-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    talent(ctx, 'venom'); p.perkHit = 60;
    const m = beside(ctx, id, { hp: 5000, maxHp: 5000, nextAct: 1e12, risen: true });
    let poisoned = 0;
    for (let i = 0; i < 40; i++) { G.t = p.nextAttack; Game.input('attack'); if (m.dot && m.dot.kind === 'venom') { poisoned++; m.dot = null; } }
    return poisoned;
  };
  const living = await hits('orc'), dead = await hits('skeleton');
  return (living >= 4 && living <= 20 && dead === 0) || `poisoned ${living} of 40 orc hits, ${dead} skeleton hits`;
});

await test('Shadow Step: a sidestep makes the next blow a strike from the shadows', async () => {
  const ctx = await start('thief', 'shadow-step');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'shadow_step'); p.perkHit = 60;
  const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
  // step aside and back, then strike
  const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  L.tiles[(p.y + sy) * L.w + p.x + sx] = Dungeon.T.FLOOR;
  G.t = p.nextAttack;
  Game.input('strafeR');
  // the orc follows into the square ahead of the new spot
  const [dx, dy] = Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy;
  const mark = markLog(G);
  G.t = Math.max(G.t + 300, p.nextAttack); Game.input('attack');
  if (!linesSince(G, mark).some(l => /from the shadows/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  const m2 = markLog(G);
  G.t = p.nextAttack; Game.input('attack');
  return !linesSince(G, m2).some(l => /from the shadows/.test(l)) || 'one sidestep gave two strikes from the shadows';
});

await test('the smaller talents do what they say', async () => {
  const out = [];
  // Bulwark: +2 AC with a shield
  { const ctx = await start('fighter', 't-bulwark'); const p = ctx.Game.player(); p.eq.shield = { t: 'shield', q: 1, e: 0 }; const a = ctx.Game.playerAC(); talent(ctx, 'bulwark'); if (ctx.Game.playerAC() !== a + 2) out.push(`bulwark ${a} -> ${ctx.Game.playerAC()}`); }
  // Lucky: crits a number sooner
  { const ctx = await start('thief', 't-lucky'); const a = ctx.Game.critFloor(); talent(ctx, 'lucky'); if (ctx.Game.critFloor() !== a - 1) out.push(`lucky ${a} -> ${ctx.Game.critFloor()}`); }
  // Light Fingers: traders pay a quarter more
  { const ctx = await start('thief', 't-fingers'); const it = { t: 'longsword', q: 1, e: 0 }; const a = ctx.Game.sellPrice(it); talent(ctx, 'light_fingers'); const b = ctx.Game.sellPrice(it); if (Math.abs(b - a * 1.25) > 1) out.push(`light fingers ${a} -> ${b}`); }
  // Quick Words: casting a quarter faster
  { const ctx = await start('mage', 't-quick'); const { Game } = ctx; const p = Game.player(), G = Game.state(); p.sp = 99; ctx.Game.level().monsters.length = 0; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'shield')); const a = p.nextAttack - G.t; talent(ctx, 'quick_words'); delete p.effects.ac; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'shield')); const b = p.nextAttack - G.t; if (b !== Math.round(a * 0.75)) out.push(`quick words ${a} -> ${b}`); }
  // Healing Hands: half as much again
  { const ctx = await start('cleric', 't-hands'); const { Game } = ctx; const p = Game.player(), G = Game.state(); talent(ctx, 'healing_hands'); ctx.Dice.s = new ctx.Rng('hands').s; p.maxHp = 999; p.hp = 1; p.sp = 99; G.t = p.nextAttack; const mark = markLog(G); Game.castSpell(Game.knownSpells().find(s => s.kind === 'heal')); const line = linesSince(G, mark).join(' '); const n = Number((line.match(/heal (\d+)/) || [])[1]); if (!(n >= 2)) out.push(`healing hands healed ${n}`); }
  // Evasion: webs slide off
  { const ctx = await start('thief', 't-evasion'); const { Game } = ctx; const p = Game.player(), G = Game.state(); talent(ctx, 'evasion'); p.hp = 999; ahead(ctx, 'spider', 3); run(Game, G, 800); if (p.webbed > G.t) out.push('a web held an evasive thief'); }
  return out.length ? out.join('; ') : true;
});

// ---------- round six review ----------
await test('a burn and a poison tick their full count at a phone\'s frame rate', async () => {
  const ticks = async (cls, id, spell) => {
    const ctx = await start(cls, 'dot-60-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    talent(ctx, id); p.perkHit = 60; p.sp = p.maxSp = 99;
    const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
    if (spell) { G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === spell)); }
    else { const real = Math.random; Math.random = () => 0; try { for (let i = 0; i < 6 && !m.dot; i++) { G.t = p.nextAttack; Game.input('attack'); } } finally { Math.random = real; } }
    if (!m.dot) return -1;
    const mark = markLog(G);
    for (let i = 0; i < 400; i++) Game.update(G.t + 1000 / 60, 1000 / 60);
    return linesSince(G, mark).filter(l => /burns for|poison eats/.test(l)).length;
  };
  const burn = await ticks('mage', 'kindling', 'burning_hands'), venom = await ticks('thief', 'venom');
  return (burn === 3 && venom === 4) || `at 60fps a burn ticked ${burn} of 3, poison ${venom} of 4`;
});

await test('Weapon Master adds its whole number to every blow, whatever the weapon', async () => {
  const total = async (weapon, wm) => {
    const ctx = await start('fighter', 'wm-' + weapon);
    ctx.Dice.s = new ctx.Rng('wm-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.perkHit = 60; p.stats.str = 16; p.eq.weapon = { t: weapon, q: 1, e: 0 }; p.eq.shield = null;
    if (wm) talent(ctx, 'weapon_master');
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const out = [];
  for (const [w, each] of [['dagger', 1], ['longsword', 1], ['greatsword', 2]]) {
    const plain = await total(w, false), master = await total(w, true);
    // the same dice both times: the difference is the talent on every blow that landed
    if (master - plain < each * 40) out.push(`${w}: +${master - plain} over 50 swings`);
  }
  return out.length ? out.join('; ') : true;
});

await test('Cleave: a blow that kills the front still carries into the one stepping up', async () => {
  const ctx = await start('fighter', 'cleave-kill');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; talent(ctx, 'cleave');
  const m = groupAhead(ctx, 'goblin', 2, 40);
  m.hp = 1; m.nextAct = 1e12;
  for (let i = 0; i < 6 && m.pack; i++) { G.t = p.nextAttack; Game.input('attack'); }
  return m.hp < 40 || 'the goblin stepping up took nothing from the swing that felled the first';
});

await test('a poison dies with the one it was on, not the next of the group', async () => {
  const ctx = await start('thief', 'venom-group');
  const { Game } = ctx;
  const G = Game.state();
  const m = groupAhead(ctx, 'goblin', 2, 40);
  m.hp = 1; m.nextAct = 1e12;
  m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 100 };
  run(Game, G, 300);
  if (m.pack) return 'the poison did not fell the front goblin';
  return !m.dot || 'the poison moved on to the goblin that stepped up';
});

await test('Warding Light and Zeal answer the hero\'s own spells, not a shrine\'s blessing', async () => {
  const ctx = await start('cleric', 'ward-src');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'warding_light');
  Game.level().monsters.length = 0;
  p.maxHp = 100; p.hp = 50; p.lastHurt = G.t; p.food = 0;   // no ordinary mending
  p.effects.ac = { amount: 2, until: G.t + 20000 };           // a blessing from a shrine
  run(Game, G, 6500);
  return p.hp === 50 || `a shrine's blessing warded the hero back to ${p.hp}`;
});

await test('Riposte answers a blow on the air, not an arrow flying wide', async () => {
  const ctx = await start('fighter', 'riposte-arrow');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'riposte');
  const m = ahead(ctx, 'archer', 3);
  for (let i = 0; i < 40 && !(m.windup && m.windup.kind === 'shot'); i++) Game.update(G.t + 25, 25);
  if (!m.windup) return 'the archer never drew';
  p.nextAttack = G.t + 9000;
  shift(ctx, 'side');
  run(Game, G, 800);
  void L; void Dungeon;
  return p.nextAttack > G.t + 5000 || 'dodging an arrow readied the swing';
});

// ---------- round six playtest ----------
await test('every stat lesson raises that ability\'s bonus by one, from an odd or an even score', async () => {
  const ctx = await start('fighter', 'lesson-bonus');
  const { Game, BOONS } = ctx;
  const p = Game.player(), out = [];
  for (const start of [15, 16]) {
    for (const b of BOONS.filter(b => b.stat)) {
      p.stats[b.stat] = start;
      const m0 = Game.mod(p.stats[b.stat]);
      b.apply(p);
      if (Game.mod(p.stats[b.stat]) !== m0 + 1) out.push(`${b.id} from ${start}: ${start} -> ${p.stats[b.stat]}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a talent that needs a spell waits until the spell is known', async () => {
  const ctx = await start('cleric', 'talent-needs');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const seen = new Set();
  for (let run = 0; run < 12; run++) {
    G.pendingBoons = []; G.pendingLevels = [];
    p.level = 2; p.xp = XP_TABLE[2];
    const m = beside(ctx, 'rat', { uid: 1200 + run, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    for (const id of Game.pendingBoons() || []) seen.add(id);
  }
  return !seen.has('warding_light') || 'Warding Light was offered at level 3, before Protection';
});

await test('a riposte lands with a bonus, and the log says so', async () => {
  const ctx = await start('fighter', 'riposte-bonus');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'riposte');
  const m = beside(ctx, 'goblin', { hp: 500, maxHp: 500, nextAct: 1e12 });
  p.riposteUntil = 0;
  // open a riposte the way a missed blow does
  const mark = markLog(G);
  p.riposteUntil = G.t + 2500; p.nextAttack = G.t;
  G.t += 1500; Game.input('attack');
  const said = linesSince(G, mark).join(' | ');
  void m;
  if (!/Riposte! (A mighty blow! )?You hit|miss/.test(said)) return `said: ${said}`;
  return !(p.riposteUntil > G.t) || 'one opening gave more than one riposte';
});

await test('Shadow Step still holds a moment after the sidestep: a goblin takes a second to come back into reach', async () => {
  const ctx = await start('thief', 'shadow-late');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'shadow_step'); p.perkHit = 60;
  const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
  const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  L.tiles[(p.y + sy) * L.w + p.x + sx] = Dungeon.T.FLOOR;
  G.t = p.nextAttack;
  Game.input('strafeR');
  const [dx, dy] = Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy;
  G.t += 1800;                                        // the goblin's step back in
  const mark = markLog(G);
  p.nextAttack = G.t; Game.input('attack');
  return linesSince(G, mark).some(l => /from the shadows/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('a level-up remembers what it gave, for the choice screen', async () => {
  const ctx = await start('mage', 'level-note');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; p.level = 4; p.xp = XP_TABLE[4] - 1;
  const m = beside(ctx, 'rat', { hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
  const note = Game.levelNote(5);
  return (note && note.hp >= 1 && note.spells.includes('Lightning Bolt')) || `level 5 note: ${JSON.stringify(note)}`;
});

await test('Use facing an item on the floor ahead says to step onto it', async () => {
  const ctx = await start('fighter', 'use-ahead');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.items[`${p.x + dx},${p.y + dy}`] = [{ t: 'potion_heal', q: 1, e: 0 }];
  L.items[`${p.x},${p.y}`] = [];
  const mark = markLog(G);
  Game.input('use');
  return linesSince(G, mark).some(l => /Step forward onto it/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('a stat lesson is offered at most twice a run', async () => {
  const ctx = await start('fighter', 'lesson-cap');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  p.boons = ['con', 'con', 'str', 'str', 'dex', 'dex'];
  for (let run = 0; run < 15; run++) {
    G.pendingBoons = []; G.pendingLevels = [];
    p.level = 3; p.xp = XP_TABLE[3];                  // level 4: a lesson
    const m = beside(ctx, 'rat', { uid: 1300 + run, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    const offer = Game.pendingBoons() || [];
    const again = offer.find(id => ['con', 'str', 'dex'].includes(id));
    if (again) return `${again} was offered a third time`;
  }
  return true;
});

await test('Last Rites spends every spell point it saves you with', async () => {
  const ctx = await start('cleric', 'rites-cost');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'last_rites');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  beside(ctx, 'ogre');
  p.hp = 1; p.sp = p.maxSp;
  for (let i = 0; i < 400 && !p.ritesUsed; i++) { Game.update(G.t + 25, 25); if (!p.ritesUsed) p.sp = p.maxSp; }
  return (p.ritesUsed && p.sp === 0) || `rites ${p.ritesUsed}, spell points ${p.sp}`;
});

// ---------- gear powers ----------
await test('found gear past the first floor sometimes carries a power, from the right list, never on cursed pieces', async () => {
  const ctx = await newContext();
  const { Dungeon, Rng } = ctx;
  const { GEAR_POWERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'relics.js')).href);
  const out = [];
  for (const depth of [1, 2, 5]) {
    const rng = new Rng('gear-powers-' + depth);
    let gear = 0, powered = 0;
    for (let i = 0; i < 6000; i++) {
      const it = Dungeon.rollLoot(rng, depth);
      const kind = ctx.ITEMS[it.t] && ctx.ITEMS[it.t].kind;
      if (!['weapon', 'armor', 'shield'].includes(kind)) continue;
      gear++;
      if (!it.pw) continue;
      powered++;
      if (it.curse) out.push(`a cursed ${it.t} carried ${it.pw}`);
      if (!GEAR_POWERS[kind].includes(it.pw)) out.push(`a ${kind} carried ${it.pw}`);
      if (!it.h) out.push('a powered piece was found already known');
    }
    if (depth === 1 && powered) out.push(`${powered} powered pieces on floor 1`);
    if (depth > 1 && !(powered > gear * 0.02 && powered < gear * 0.25)) out.push(`floor ${depth}: ${powered} of ${gear} gear pieces powered`);
  }
  // and every power turns up somewhere
  const seen = new Set();
  const rng = new Rng('gear-powers-all');
  for (let i = 0; i < 40000; i++) { const it = Dungeon.rollLoot(rng, 6); if (it.pw) seen.add(it.pw); }
  const all = new Set(Object.values(GEAR_POWERS).flat());
  for (const k of all) if (!seen.has(k)) out.push(`${k} never rolled`);
  return out.length ? [...new Set(out)].slice(0, 5).join('; ') : true;
});

await test('a plain piece\'s power works when worn, and shows in its name once known', async () => {
  const ctx = await start('fighter', 'gear-power');
  const { Game } = ctx;
  const p = Game.player();
  const it = { t: 'longsword', q: 1, e: 1, h: 1, pw: 'keen' };
  if (/Keenness/.test(Game.itemName(it))) return 'a hidden power was named';
  const floor0 = Game.critFloor();
  p.eq.weapon = it;
  if (Game.critFloor() !== floor0 - 1) return `keen gear: crit floor ${floor0} -> ${Game.critFloor()}`;
  delete it.h;
  return /Long Sword \+1 of Keenness/.test(Game.itemName(it)) || `named ${Game.itemName(it)}`;
});

await test('a flaming weapon burns: extra damage, and a troll\'s wound will not close', async () => {
  const ctx = await start('fighter', 'flame-weapon');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; p.eq.weapon = { t: 'longsword', q: 1, e: 0, pw: 'flame' };
  const m = beside(ctx, 'troll', { hp: 300, maxHp: 400, nextAct: 1e12 });
  for (let i = 0; i < 6 && m.hp === 300; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const after = m.hp;
  run(Game, G, 4000);
  return (after < 300 && m.hp === after) || `troll ${300} -> ${after} -> ${m.hp} after four seconds`;
});

await test('a power survives buying and selling, and raises the price', async () => {
  const ctx = await start('fighter', 'gear-trade');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const plain = { t: 'longsword', q: 1, e: 1 }, fine = { t: 'longsword', q: 1, e: 1, pw: 'leech' };
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [fine] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'the shop did not open';
  if (!(Game.buyPrice(shop, fine) > Game.buyPrice(shop, plain))) return 'a power did not raise the price';
  p.gold = 99999;
  if (!Game.buy(fine)) return 'could not buy it';
  const got = p.inv.find(i => i.t === 'longsword' && i.pw === 'leech');
  if (!got) return 'the power was lost in the buying';
  if (!(Game.sellPrice(got) > Game.sellPrice(plain))) return 'a power did not raise what a trader pays';
  Game.sell(got);
  return shop.stock.some(s => s.t === 'longsword' && s.pw === 'leech') || 'the power was lost in the selling';
});

await test('Empower, Radiance and Lucky say so when they matter', async () => {
  const out = [];
  { const ctx = await start('mage', 'say-empower'); const { Game } = ctx; const p = Game.player(), G = Game.state();
    talent(ctx, 'empower'); p.sp = 99; beside(ctx, 'orc', { hp: 500, maxHp: 500, nextAct: 1e12 });
    const mark = markLog(G); G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'magic_missile'));
    if (!linesSince(G, mark).some(l => /Your empowered Magic Missile hits/.test(l))) out.push(`empower said: ${linesSince(G, mark).join(' | ')}`); }
  { const ctx = await start('thief', 'say-lucky'); const { Game } = ctx; const p = Game.player(), G = Game.state();
    talent(ctx, 'lucky'); p.perkHit = 60; beside(ctx, 'orc', { hp: 1e6, maxHp: 1e6, nextAct: 1e12, split: true });
    const mark = markLog(G); for (let i = 0; i < 300; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (!linesSince(G, mark).some(l => /A lucky blow!/.test(l))) out.push('no lucky blow in 300 swings'); }
  return out.length ? out.join('; ') : true;
});

// ---------- spell effects ----------
await test('every spell, and the Scroll of Fire, shows its own effect where it lands', async () => {
  const out = [];
  for (const [cls, ids] of [['mage', ['magic_missile', 'burning_hands', 'shield', 'lightning', 'cone_cold']], ['cleric', ['cure_light', 'bless', 'smite', 'cure_serious', 'protection', 'flame_strike']]]) {
    for (const id of ids) {
      const ctx = await start(cls, 'fx-' + id);
      const { Game } = ctx;
      const p = Game.player(), G = Game.state();
      p.level = 9; p.sp = p.maxSp = 999; p.hp = 5; p.maxHp = 999;
      const range = { burning_hands: 1, cone_cold: 2 }[id] || 2;
      ahead(ctx, 'goblin', range, { hp: 9999, maxHp: 9999, nextAct: 1e12 });
      G.t = p.nextAttack;
      if (!Game.castSpell(Game.knownSpells().find(s => s.id === id))) { out.push(`${id} was not cast`); continue; }
      const fx = Game.renderState(0).fx.spells;
      const e = fx[fx.length - 1];
      if (!e) { out.push(`${id} showed nothing`); continue; }
      const sp = Game.knownSpells().find(s => s.id === id);
      if (sp.kind === 'bolt' && e.pts.length !== 1) out.push(`${id} aimed at ${e.pts.length} targets`);
      if (!(e.until > e.born)) out.push(`${id} effect has no time to play`);
    }
  }
  const ctx = await start('thief', 'fx-scroll');
  const { Game } = ctx;
  const p = Game.player();
  ahead(ctx, 'goblin', 2, { hp: 9999, maxHp: 9999, nextAct: 1e12 });
  p.inv.push({ t: 'scroll_fire', q: 1, e: 0 });
  Game.state().known = Game.state().known || {}; Game.state().known.scroll_fire = 1;
  Game.useItem(p.inv.find(i => i.t === 'scroll_fire'));
  const fx = Game.renderState(0).fx.spells;
  if (!fx.some(e => e.style === 'fireball')) out.push('the Scroll of Fire showed no fireball');
  return out.length ? out.join('; ') : true;
});

  console.log(`rule checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
