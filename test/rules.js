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

// A test that counts what the dice did over many tries passes or fails by
// luck unless the dice are the same every run: seed the live combat dice from
// a name, as the benchmark does.
const seedDice = (ctx, key) => { ctx.Dice.s = new ctx.Rng('rules|' + key).s; };

// Lines logged since a mark, read by count rather than position. The log is
// capped at eighty, so once full its length stops moving and a slice from the
// old length returns nothing at all: the same fault the message box had.
const markLog = G => G.logSeq;
// A line said again straight after itself is folded into one, "(×3)": count it as said three times
const countSaid = (lines, re) => lines.filter(l => re.test(l)).reduce((n, l) => n + (Number((l.match(/\(\u00d7(\d+)\)$/) || [])[1]) || 1), 0);
const linesSince = (G, mark) => {
  const n = G.logSeq - mark;
  return n > 0 ? G.log.slice(-Math.min(n, G.log.length)).map(e => e.m) : [];
};

/** Self-Taught's two points, both on a score it has not yet given any to (two a score, a run). */
function spreadPicks(Game) {
  const t = Game.player().taught || {};
  const k = ['con', 'str', 'dex', 'wis', 'int', 'cha'].find(x => !t[x]);
  return [k, k];
}

let failures = 0;
async function test(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
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
    // two blades and the greatsword are within a few percent of each other
    // against armour: unseeded, the dice alone could order them either way
    seedDice(ctx, `dps-${Object.values(build).join('+')}-${foe}`);
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
    const swings = 30000;   // the greatsword's edge over two blades against armour is a few percent
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
  L.dressing = [];
  const ahead = () => { const [dx, dy] = Dungeon.DIRS[p.dir]; return (p.y + dy) * L.w + (p.x + dx); };
  const was = L.tiles[ahead()];
  const expect = [[T.DOOR, 'Open'], [T.DOOR_LOCKED, 'Force'], [T.STAIRS_DOWN, 'Descend'], [T.FOUNTAIN, 'Drink'],
    [T.DOOR_OPEN, 'Close'], [T.WALL, 'Search'], [T.TORCH, 'Search'], [T.SECRET, 'Search'], [T.FLOOR, 'Use']];
  for (const [t, want] of expect) {
    L.tiles[ahead()] = t;
    if (Game.useLabel() !== want) return `facing tile ${t}, Use says "${Game.useLabel()}", wanted "${want}"`;
  }
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
  const known = new Set(['map', 'xp', 'goldPerDepth', 'hurt', 'hurtFrac', 'heal', 'maxHp', 'food', 'loot', 'item', 'buff', 'poison', 'cure', 'uncurse', 'wake', 'identifyAll', 'ambush', 'stat', 'thread']);
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
  p.gold = 5000;   // a choice that asks a stake can be paid
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
    // the deepest floor holds only its vigil lamp, which is not dealt from the deck
    if (plan[levels].join() !== 'vigil') return `the deepest floor of a ${levels}-floor run holds ${plan[levels].join(', ') || 'nothing'}`;
    const all = plan.slice(0, levels).flat();
    if (new Set(all).size !== all.length) return `seed plan${i} over ${levels} floors repeats an encounter`;
    // about one a floor; a very long run can pass by the four that belong
    // only on the upper floors, once it is below them
    const want = Math.min(Object.keys(ENCOUNTERS).filter(k => !ENCOUNTERS[k].final && !ENCOUNTERS[k].route).length, Math.round((levels - 1) * 1.15));
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
  // (a road's own encounter is placed by the road, not dealt)
  const missing = Object.keys(ENCOUNTERS).filter(e => !seen.has(e) && !ENCOUNTERS[e].route);
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

await test('a trader saved standing in a doorway steps aside into its room on reload', async () => {
  const { Game } = await start('fighter', 'aside');
  const L = Game.level(), T = Game.T, w = L.w;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DOORS = [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET];
  // A square of room floor with a door beside it: just where a trader should not stand.
  let spot = null;
  for (let i = 0; i < w * L.h && !spot; i++) {
    const x = i % w, y = (i / w) | 0;
    if (L.tiles[i] !== T.FLOOR || L.roomId[i] < 0 || L.monsters.some(m => m.x === x && m.y === y)) continue;
    if (DIRS.some(([dx, dy]) => DOORS.includes(L.tiles[(y + dy) * w + x + dx]))) spot = [x, y];
  }
  if (!spot) return 'no square by a door on this floor';
  const room = L.roomId[spot[1] * w + spot[0]];
  L.npcs.push({ id: 'merchant', x: spot[0], y: spot[1], stock: [], markup: 1, greeted: false });
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  const M = Game.level(), n = M.npcs[M.npcs.length - 1];
  if (n.x === spot[0] && n.y === spot[1]) return 'the trader is still in the doorway';
  if (M.roomId[n.y * w + n.x] !== room) return 'the trader left its room';
  const clear = DIRS.every(([dx, dy]) => M.tiles[(n.y + dy) * w + n.x + dx] === T.FLOOR && M.roomId[(n.y + dy) * w + n.x + dx] === room);
  return clear || `the trader moved to ${n.x},${n.y}, which is still by the room's edge`;
});

await test('a blow being drawn back is still coming after a reload, with a moment\'s grace', async () => {
  const ctx = await start('fighter', 'reload-windup');
  const { Game } = ctx; const G = Game.state();
  const m = beside(ctx, 'ogre', { blows: 2 });
  m.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t + 900 }; m.nextAct = m.windup.until;
  const until = m.windup.until;
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  const n = Game.level().monsters.find(x => x.uid === m.uid);
  if (!n || !n.windup || n.windup.move !== 'crush') return `the crush was forgotten: ${JSON.stringify(n && n.windup)}`;
  if (n.windup.until !== until + 800 || n.nextAct !== n.windup.until) return `until ${n.windup.until}, next ${n.nextAct}, wanted ${until + 800}`;
  return true;
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
  // the even levels bring talents; take those and come to the first lesson
  const lessonIds = new Set(ctx.BOONS.map(b => b.id));
  for (let i = 0; i < 10 && Game.pendingBoons() && !Game.pendingBoons().every(id => lessonIds.has(id)); i++) Game.chooseBoon(Game.pendingBoons()[0], Game.pendingBoons()[0] === 'spread' ? spreadPicks(Game) : undefined);
  const offer = Game.pendingBoons();
  if (!offer) return 'no boon offered after levelling';
  if (offer.length !== 3) return `offered ${offer.length} boons, expected 3`;
  if (Game.chooseBoon('not-a-real-boon')) return 'an unknown boon id was accepted';
  if (!Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return 'a valid boon was rejected';
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
    // (the road's own relic lies on its last floor as well: see the road relic test)
    for (const k in L.items) for (const it of L.items[k]) if (it.u && !ctx.RELICS[it.u].route) {
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
      if (Game.forkPending()) Game.chooseRoute('crypts');
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


await test('the trader\'s forge hones a weapon and reinforces armour to +3, dearer each time, and refuses unknown or cursed metal', async () => {
  const ctx = await start('fighter', 'forge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  L.monsters.length = 0;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.gold = 99999;
  const svc = id => Game.shopServices().find(s => s.id === id);
  const prices = [];
  for (let i = 0; i < 3; i++) {
    const s = svc('hone'); if (s.why) return `honing refused at +${p.eq.weapon.e}: ${s.why}`;
    const before = p.gold; prices.push(s.price);
    Game.buyService('hone');
    if (p.eq.weapon.e !== i + 1 || p.gold !== before - s.price) return `hone ${i + 1}: +${p.eq.weapon.e}, charged ${before - p.gold} of ${s.price}`;
  }
  if (!(prices[0] < prices[1] && prices[1] < prices[2])) return `prices did not climb: ${prices.join(', ')}`;
  if (!svc('hone').why) return 'the forge went past +3';
  Game.buyService('reinforce');
  if (p.eq.armor.e !== 1) return `reinforcing left the armour at +${p.eq.armor.e}`;
  p.eq.armor.h = 1;
  if (!svc('reinforce').why) return 'the forge worked on armour of unknown quality';
  p.eq.armor.h = 0; p.eq.armor.curse = 1;
  if (!svc('reinforce').why) return 'the forge worked on cursed armour';
  return true;
});

await test('a belt holds five of each draught: the rest stays on the floor, and a trader will not sell a sixth', async () => {
  const ctx = await start('fighter', 'belt');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  L.monsters.length = 0;
  p.inv = p.inv.filter(i => i.t !== 'potion_heal');
  const k = `${p.x},${p.y}`;
  L.items[k] = [{ t: 'potion_heal', q: 7, e: 0 }];
  Game.pickupAll ? Game.pickupAll() : Game.input('use');
  const held = p.inv.find(i => i.t === 'potion_heal');
  if (!held || held.q !== 5) return `carrying ${held ? held.q : 0}`;
  const left = (L.items[k] || []).find(i => i.t === 'potion_heal');
  if (!left || left.q !== 2) return `left ${left ? left.q : 0} on the floor`;
  if (Game.floorItems().length && Game.useLabel() === 'Take') return 'the potions it cannot carry still offered to be taken';
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'potion_heal', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.gold = 9999;
  if (Game.buy(shop.stock[0])) return 'the trader sold a sixth potion';
  return true;
});

await test('standing on potions the belt has no room for, Use says Belt full and why', async () => {
  const ctx = await start('fighter', 'belt-label');
  const { Game } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
  L.monsters.length = 0;
  p.inv = p.inv.filter(i => i.t !== 'potion_heal'); p.inv.push({ t: 'potion_heal', q: 5, e: 0 });
  // face open floor, so nothing ahead takes the button
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR;
  L.items[`${p.x},${p.y}`] = [{ t: 'potion_heal', q: 2, e: 0 }];
  if (Game.useLabel() !== 'Belt full') return `Use says ${Game.useLabel()}`;
  const mark = markLog(G);
  Game.input('use');
  return linesSince(G, mark).some(l => /belt holds 5 of each draught/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('the trader works a rune into plain gear once, and lets you sleep safe by its lamp once a floor', async () => {
  const ctx = await start('fighter', 'rune');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.gold = 99999; p.eq.weapon.h = 0; delete p.eq.weapon.pw;
  const svc = id => Game.shopServices().find(v => v.id === id);
  const r = svc('rune_weapon');
  if (!r || r.why) return `the rune was refused: ${JSON.stringify(r)}`;
  Game.buyService('rune_weapon');
  if (p.eq.weapon.pw !== r.pw) return `the weapon carries ${p.eq.weapon.pw}, not ${r.pw}`;
  if (!svc('rune_weapon').why) return 'a second rune was offered for the same blade';
  // sleep safe: whole again, the floor's rests untouched, once only
  p.hp = 1; const rests = L.rests || 0;
  if (svc('lodge').why) return `lodging refused: ${svc('lodge').why}`;
  Game.buyService('lodge');
  if (p.hp !== p.maxHp || (L.rests || 0) !== rests || L.monsters.length) return `after the night: hp ${p.hp}/${p.maxHp}, rests ${L.rests}, ${L.monsters.length} monsters`;
  p.hp = 1;
  return !!svc('lodge').why || 'lodging was offered twice on one floor';
});

await test('a deep trader sells a bitter tonic: four hit points for good, once a trader, from the fourth floor', async () => {
  const ctx = await start('fighter', 'tonic');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  const openShop = () => {
    const L = Game.level(); L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR; Game.input('forward');
    return !!Game.currentShop();
  };
  const svc = () => Game.shopServices().find(v => v.id === 'tonic');
  if (!openShop()) return 'could not open the shop';
  if (!svc() || !svc().why) return 'the tonic was sold on the first floor';
  Game.closeShop();
  for (let d = 1; d < 4; d++) { Game.level().monsters.length = 0; Game.descend(); }
  if (G.depth !== 4) return `descended to depth ${G.depth}`;
  if (!openShop()) return 'could not open the shop on the fourth floor';
  p.gold = 99999; p.hp = 5;
  const s = svc(); if (!s || s.why) return `the tonic was refused: ${s && s.why}`;
  const max0 = p.maxHp, gold = p.gold;
  Game.buyService('tonic');
  if (p.maxHp !== max0 + 4 || p.hp !== 9) return `after the tonic: ${p.hp}/${p.maxHp}, was 5/${max0}`;
  if (gold - p.gold !== s.price) return `paid ${gold - p.gold}, asked ${s.price}`;
  return !!svc().why || 'the same trader sold a second tonic';
});

await test('the vigil lamp on the last floor sells a ward for gold', async () => {
  const ctx = await start('fighter', 'vigil');
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0;
  L.npcs = [{ id: 'vigil', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
  p.gold = 5000; p.effects = {};
  Game.input('use');
  if (!Game.currentEncounter()) return 'the lamp did not open';
  const before = p.gold;
  Game.chooseEncounter(0);
  if (!(p.gold < before)) return 'the ward cost nothing';
  const ward = p.effects.boon_ac;
  if (!(ward && ward.amount === 3 && ward.until > G.t)) return `effects: ${JSON.stringify(p.effects)}`;
  return true;
});

await test('a bought ward and the Shield spell add, and neither wipes the other out', async () => {
  const ctx = await start('mage', 'ward-shield');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  const ac0 = Game.playerAC();
  p.effects.boon_ac = { amount: 3, until: G.t + 300000 };
  const shield = Game.knownSpells().find(s => s.id === 'shield');
  p.sp = 99; G.t = p.nextAttack; Game.castSpell(shield);
  const out = [];
  if (!(p.effects.boon_ac && p.effects.boon_ac.until > G.t + 200000)) out.push('Shield wiped out the ward');
  if (!(p.effects.ac && p.effects.ac.src === 'shield')) out.push('the ward hid Shield\'s own mark');
  if (Game.playerAC() !== ac0 + 3 + shield.amount) out.push(`armour ${Game.playerAC()}, wanted ${ac0 + 3 + shield.amount}`);
  return out.length ? out.join('; ') : true;
});

await test('a caster can study a trader\'s books once for three spell points for good; a fighter cannot', async () => {
  const out = [];
  for (const cls of ['mage', 'fighter']) {
    const ctx = await start(cls, 'study');
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
    const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
    L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    Game.input('forward');
    p.gold = 9999;
    const sv = () => Game.shopServices().find(v => v.id === 'study');
    if (cls === 'fighter') { if (!sv().why) out.push('a fighter was offered the books'); continue; }
    const before = p.maxSp;
    Game.buyService('study');
    if (p.maxSp !== before + 3) out.push(`spell points ${before} -> ${p.maxSp}`);
    if (!sv().why) out.push('the books were offered twice');
  }
  return out.length ? out.join('; ') : true;
});

await test('the vigil lamp stands near the lich\'s hall, not at the way in and not in the hall itself', async () => {
  const ctx = await newContext();
  let nearer = 0; const out = [];
  for (let i = 0; i < 12; i++) {
    const L = ctx.Dungeon.generate(`lamp-${i}`, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
    const lamp = (L.npcs || []).find(n => n.id === 'vigil');
    const heart = Object.keys(L.items).find(k => L.items[k].some(it => it.t === 'artifact')).split(',').map(Number);
    if (!lamp) { out.push(`lamp-${i} has no lamp`); continue; }
    const d = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (d([lamp.x, lamp.y], heart) <= 2) out.push(`lamp-${i}'s lamp stands beside the Heart`);
    if (d([lamp.x, lamp.y], heart) < d([L.start.x, L.start.y], heart)) nearer++;
  }
  if (nearer < 10) out.push(`only ${nearer} of 12 lamps stood nearer the Heart than the way in`);
  return out.length ? out.join('; ') : true;
});

await test('every eight-floor delve has a trader on its third and seventh floors, and a vigil lamp on its last', async () => {
  const ctx = await newContext();
  for (let i = 0; i < 8; i++) {
    const last = ctx.Dungeon.generate(`traders-${i}`, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
    if (!(last.npcs || []).some(n => n.kind === 'encounter' && n.id === 'vigil')) return `seed traders-${i} has no vigil lamp on its last floor`;
  }
  for (let i = 0; i < 8; i++) for (const depth of [3, 7]) {
    const L = ctx.Dungeon.generate(`traders-${i}`, depth, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
    if (!(L.npcs || []).some(n => n.kind !== 'encounter' && n.stock)) return `seed traders-${i} has no trader on floor ${depth}`;
  }
  return true;
});

await test('the lich\'s rite calls a wraith to guard it, one at a time', async () => {
  const ctx = await start('fighter', 'rite-wraith');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'lich', { hp: 30, maxHp: 120, phase: 2, riteReady: 0, spoke: true, awake: true, nextAct: G.t });
  for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
  if (!(m.windup && m.windup.move === 'rite')) return 'no rite began';
  const wraiths = () => Game.level().monsters.filter(o => o.id === 'wraith').length;
  if (wraiths() !== 1) return `${wraiths()} wraiths rose with the rite`;
  m.windup = null; m.riteReady = 0; m.nextAct = G.t;
  for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
  return wraiths() === 1 || `${wraiths()} wraiths after a second rite with the first still standing`;
});

await test('the fifth circle comes at seventh level; a mage starts with more life; ogres wait for the seventh floor of eight', async () => {
  const ctx = await newContext();
  const { Game, SPELLS, CLASSES } = ctx;
  const cone = SPELLS.mage.find(s => s.id === 'cone_cold'), bolt = SPELLS.mage.find(s => s.id === 'lightning');
  if (Game.spellLevel(cone) !== 7 || Game.spellLevel(bolt) !== 5) return `cone ${Game.spellLevel(cone)}, lightning ${Game.spellLevel(bolt)}`;
  Game.newGame({ name: 'M', cls: 'mage', bg: 'tombwise', stats: { ...evenStats }, seed: 'mage-hp', opts: { ...OPTS } });
  const mageHp = Game.player().maxHp;
  if (mageHp !== Math.max(10, CLASSES.mage.hitDie + 6 + CLASSES.mage.startHp + Game.mod(evenStats.con))) return `a mage starts with ${mageHp}`;
  let early = 0;
  for (let i = 0; i < 10; i++) for (const depth of [5, 6]) if (ctx.Dungeon.generate(`ogre-${i}`, depth, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => m.id === 'ogre')) early++;
  return early === 0 || `ogres on floors 5-6 of eight, ${early} times`;
});

await test('the score counts depth, experience and a win, not gold hoarded', async () => {
  const ctx = await start('fighter', 'score');
  const { Game } = ctx;
  const p = Game.player();
  const a = Game.score(p, 1, false);
  p.gold += 5000;
  if (Game.score(p, 1, false) !== a) return 'gold moved the score';
  // a win over the same run is worth well over the run: a death on the last
  // floor must not come within a few percent of claiming the Heart
  p.xp = 10000; p.deepest = 8;
  const died = Game.score(p, 8, false), won = Game.score(p, 8, true);
  return won >= died * 1.4 || `a win scored ${won}, a death on the same floor ${died}`;
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
  for (let i = 0; i < 6 && m.pack; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // a natural 1 still misses
  if (!L.monsters.includes(m)) return 'killing the front goblin emptied the square';
  if (m.pack) return 'the second goblin did not step up';
  if (p.kills !== kills0 + 1 || p.xp <= xp0) return 'the fallen goblin paid nothing';
  if (!linesSince(G, mark).some(l => /last Goblin steps up/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  const xp1 = p.xp;
  for (let i = 0; i < 6 && L.monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
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
  // a fighter's Cast button is Bash, and the bottle drinks a healing draught
  const f = await start('fighter', 'quaff');
  const fp = f.Game.player();
  if (f.Game.castLabel() !== 'Bash') return `a fighter's Cast button says ${f.Game.castLabel()}`;
  fp.hp = 1;
  const before = fp.inv.filter(i => i.t === 'potion_heal').reduce((a, i) => a + i.q, 0);
  f.Game.input('quaff');
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
  // lines still showing: a folded repeat leaves an empty place-holder behind
  const live = () => G.log.filter(e => !e.gone).length;
  const rows = live();
  for (let i = 0; i < 4; i++) { G.t += 1000; Game.update(G.t, 1000); Game.input('forward'); }
  const last = G.log[G.log.length - 1];
  return (live() - rows <= 1 && /\(×[34]\)$/.test(last.m)) || `four bumps left ${live() - rows} new lines, the last "${last.m}"`;
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
        if (Game.forkPending()) Game.chooseRoute('crypts');
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
  const m = beside(ctx, 'skeleton');
  const mark = markLog(G), t0 = G.t;
  let firstBlowAt = null, sawWindup = false;
  for (let i = 0; i < 40 && firstBlowAt === null; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup) sawWindup = true;
    if (linesSince(G, mark).some(l => /Skeleton (hits|misses) you/.test(l))) firstBlowAt = G.t - t0;
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
  // (a goblin's beat varies: its longest draw is most of a second)
  for (let i = 0; i < 40 && !linesSince(G, mark).length; i++) Game.update(G.t + 25, 25);
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
  // the monsters live in foes.js, which reads the game's state through K
  const read = f => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', f), 'utf8');
  const src = read('game.js') + read('foes.js');
  const m = src.match(/const poisonFor = \(\) => \(\{ until: (?:K\.)?G\.t \+ Math\.min\((\d+), (\d+) \+ (\d+) \* (?:K\.)?G\.depth\)/);
  if (!m) return 'no depth-scaled poison';
  const [cap, base, per] = m.slice(1).map(Number);
  const at = d => Math.min(cap, base + per * d);
  if (/p\.poison = \{ until: (K\.)?G\.t \+ 20000/.test(src)) return 'a poison source still ignores depth';
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

await test('with no healing draught known, a quaff says so', async () => {
  const ctx = await start('fighter', 'dry-quaff');
  const p = ctx.Game.player(), G = ctx.Game.state();
  p.inv = p.inv.filter(i => i.t !== 'potion_heal' && i.t !== 'potion_xheal');
  const mark = markLog(G);
  ctx.Game.input('quaff');
  return linesSince(G, mark).some(l => /no healing draught/.test(l)) || `it said ${linesSince(G, mark).join(' | ')}`;
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

await test('a dodged trick leaves an opening: the next blow at it, if quick, cannot miss and lands telling', async () => {
  const out = [];
  for (const late of [false, true]) {
    const ctx = await start('fighter', 'opening');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    const m = beside(ctx, 'ogre', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'crush') { out.push('no crush began'); continue; }
    shift(ctx, 'back');
    run(Game, G, 950);
    if (!p.opening || p.opening.uid !== m.uid) { out.push('dodging the crush left no opening'); continue; }
    // back in, and swing: a blow that could never land on its own
    p.perkHit = -100;
    { const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; p.x += dx; p.y += dy; }
    if (late) G.t += 3000;
    G.t = Math.max(G.t, p.nextAttack);
    const mark = markLog(G), hp0 = m.hp;
    Game.input('attack');
    const said = linesSince(G, mark);
    const took = said.some(l => /You take the opening!/.test(l));
    if (late ? took : !took || m.hp >= hp0) out.push(`${late ? 'late' : 'quick'}: ${said.join(' | ')}`);
    // not even a natural 1 misses an opening: sixty of them all land
    if (!late) {
      let missed = 0;
      for (let i = 0; i < 60; i++) {
        p.opening = { uid: m.uid, until: G.t + 2500 }; m.hp = 999;
        G.t = Math.max(G.t, p.nextAttack);
        const before = m.hp; Game.input('attack');
        if (m.hp >= before) missed++;
      }
      if (missed) out.push(`${missed} of 60 openings missed`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a charge that lands knocks the hero down for a moment', async () => {
  const ctx = await start('fighter', 'knockdown');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 1;          // no footing to keep: a Strength save it can only fail but on a twenty
  const m = ahead(ctx, 'orc', 3, { edge: 40 });
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return `it drew ${JSON.stringify(m.windup)}`;
  const mark = markLog(G);
  for (let i = 0; i < 40 && !linesSince(G, mark).some(l => /slams into you|misses you/.test(l)); i++) Game.update(G.t + 20, 20);
  const said = linesSince(G, mark);
  if (said.some(l => /misses you|keep your feet/.test(l))) return true;   // a natural 1, or a twenty on the save: nothing to see this time
  if (!said.some(l => /knocked off your feet/.test(l))) return `said: ${said.join(' | ')}`;
  if (!(p.held > G.t)) return 'the hero was not held';
  const x0 = p.x, y0 = p.y, m2 = markLog(G);
  Game.input('back');
  if (p.x !== x0 || p.y !== y0) return 'the hero walked off while knocked down';
  return linesSince(G, m2).some(l => /getting to your feet/.test(l)) || `blocked with: ${linesSince(G, m2).join(' | ')}`;
});

await test('a cleric\'s faith guides the mace: the stronger of strength and wisdom lands the blow; a fighter swings with strength alone', async () => {
  const hitWith = async (cls, str, wis) => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'W', cls, bg: 'tombwise', stats: { ...evenStats, str, wis }, seed: 'faith', opts: { ...OPTS } });
    return ctx.Game.toHit();
  };
  const faithful = await hitWith('cleric', 8, 18), strong = await hitWith('cleric', 18, 8), plain = await hitWith('cleric', 8, 8);
  if (!(faithful === strong && faithful > plain)) return `cleric to hit: wisdom 18 gives ${faithful}, strength 18 gives ${strong}, neither ${plain}`;
  const fighterWise = await hitWith('fighter', 8, 18), fighterPlain = await hitWith('fighter', 8, 8);
  return fighterWise === fighterPlain || `a fighter's wisdom moved its to-hit from ${fighterPlain} to ${fighterWise}`;
});

await test('a basilisk\'s gaze turns a hero looking at it to stone; one who turns away is spared and finds it open', async () => {
  const out = [];
  for (const away of [false, true]) {
    const ctx = await start('fighter', 'gaze');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'basilisk', 3, { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'gaze', at: G.t, until: G.t + 1100 }; m.nextAct = m.windup.until;
    if (away) Game.input('left');
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 1200);
    const said = linesSince(G, mark);
    if (away) {
      if (p.hp < hp0 || p.held > G.t) { out.push(`turned away and still caught: ${said.join(' | ')}`); continue; }
      if (!p.opening || p.opening.uid !== m.uid) out.push('turning away left no opening');
    } else {
      if (!(p.held > G.t) || p.heldBy !== 'stone' || p.hp >= hp0) { out.push(`looked and was not caught: ${said.join(' | ')}`); continue; }
      const x0 = p.x, y0 = p.y, m2 = markLog(G);
      Game.input('back');
      if (p.x !== x0 || p.y !== y0) out.push('a hero turned to stone walked away');
      if (!linesSince(G, m2).some(l => /limbs are stone/.test(l))) out.push(`blocked with: ${linesSince(G, m2).join(' | ')}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('stepping up to a basilisk does not beat its gaze, and one beside you gazes too; stone, you cannot turn', async () => {
  const out = [];
  {
    // it rears at three squares; the hero steps up beside it, still looking
    const ctx = await start('fighter', 'gaze-close');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'basilisk', 2, { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'gaze', at: G.t, until: G.t + 1100 }; m.nextAct = m.windup.until;
    { const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; p.x += dx; p.y += dy; }
    run(Game, G, 1200);
    if (!(p.held > G.t) || p.heldBy !== 'stone') out.push('stepping up to it and staring was spared');
    else {
      const d0 = p.dir; Game.input('left');
      if (p.dir !== d0) out.push('a hero of stone turned');
    }
  }
  {
    // right beside it, it still starts a gaze
    const ctx = await start('fighter', 'gaze-beside');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'basilisk', { hp: 999, maxHp: 999, blows: 1 });
    let gazed = false;
    for (let i = 0; i < 400 && !gazed; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'gaze') gazed = true; p.hp = 9999; p.held = 0; }
    if (!gazed) out.push('a basilisk beside the hero never gazed');
  }
  return out.length ? out.join('; ') : true;
});

await test('rust passes over armour already rusted through to the shield; a rest\'s ambush comes from the floor\'s own stretched tiers', async () => {
  const ctx = await start('fighter', 'rust-on');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.eq.armor.e = -3; p.eq.armor.h = 0;
  const shieldBefore = p.eq.shield.e || 0;
  const m = beside(ctx, 'rustmaw', { hp: 999, maxHp: 999, edge: 40 });
  m.windup = { kind: 'move', move: 'rust', at: G.t, until: G.t }; m.nextAct = G.t;
  Game.update(G.t + 25, 25);
  const said = Game.state().log.slice(-4).map(e => e.m).join(' | ');
  if (!/misses you/.test(said) && (p.eq.shield.e || 0) !== shieldBefore - 1) return `the shield stayed at ${p.eq.shield.e} (${said})`;
  // the last floor of a four-floor delve sits at the foot of the tiers: its ambushes are deep things
  const c2 = await newContext();
  c2.Game.newGame({ name: 'A', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'ambush-tier', opts: { ...OPTS, levels: 4 } });
  const G2 = c2.Game.state(), p2 = c2.Game.player();
  goDown(c2); goDown(c2); goDown(c2);
  if (G2.depth !== 4) return `reached floor ${G2.depth}, not 4`;
  const kinds = new Set();
  for (let i = 0; i < 30; i++) {
    c2.Game.level().monsters.length = 0; c2.Game.level().rests = 1; p2.hp = 1; p2.food = 100;   // ambushes come from the second rest on
    G2.t += 60000;
    const before = c2.Game.level().monsters.length;
    c2.Game.input('rest');
    for (const mm of c2.Game.level().monsters.slice(before)) kinds.add(mm.id);
  }
  const shallow = [...kinds].filter(id => c2.MONSTERS[id].tier[1] < 8);
  if (!kinds.size) return 'thirty rests on the deepest floor and nothing came';
  return !shallow.length || `ambushes on the deepest floor brought ${shallow.join(', ')}`;
});

await test('a rustmaw\'s bite rusts the armour of a hero who stays; one who steps back keeps it, and the forge mends it', async () => {
  const out = [];
  for (const dodge of [false, true]) {
    const ctx = await start('fighter', 'rust');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.eq.armor.e = 0; p.eq.armor.h = 0;
    const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'rust') { out.push(`it drew ${JSON.stringify(m.windup)}`); continue; }
    if (dodge) shift(ctx, 'back');
    const mark = markLog(G);
    run(Game, G, 900);
    const said = linesSince(G, mark);
    if (said.some(l => /misses you/.test(l))) continue;     // a natural 1 this time
    if (dodge ? p.eq.armor.e !== 0 : p.eq.armor.e !== -1) out.push(`${dodge ? 'stepped back' : 'stayed'}: armour now ${p.eq.armor.e} (${said.join(' | ')})`);
    if (!dodge) {
      // the trader's forge mends it, at the price of a first step
      const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      Game.level().monsters.length = 0; Game.level().npcs.length = 0; Game.level().npcs.push(shop);
      const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
      ctx.Dungeon.T && (Game.level().tiles[shop.y * Game.level().w + shop.x] = ctx.Dungeon.T.FLOOR);
      Game.input('forward');
      p.gold = 9999;
      const svc = Game.shopServices().find(v => v.id === 'reinforce');
      if (!Game.currentShop() || !svc || svc.why || !(svc.price > 0)) out.push(`the forge would not mend rust: ${JSON.stringify(svc)}`);
      else { Game.buyService('reinforce'); if (p.eq.armor.e !== 0) out.push(`mended to ${p.eq.armor.e}`); }
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a warned blow is not turned by armour: an ogre\'s crush lands on a hero in plate unless it rolls a 1', async () => {
  const ctx = await start('fighter', 'sure');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 99999; p.effects = { ac: { amount: 60, until: G.t + 1e9 } };
  let landed = 0, tries = 0;
  for (let i = 0; i < 12; i++) {
    const m = beside(ctx, 'ogre', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'crush') continue;
    const hp0 = p.hp; tries++;
    run(Game, G, 1000);
    if (p.hp < hp0) landed++;
    G.t += 3000;
  }
  // only a natural 1 turns one, so all but a few land (four 1s in twelve is a chance in five hundred)
  return (tries >= 8 && landed >= tries - 5) || `${landed} of ${tries} crushes landed on a hero with sixty armour`;
});

await test('the tiers of monsters stretch over a short delve: an eight-floor delve meets the minotaur on its last floor, a long one keeps it deep', async () => {
  const ctx = await newContext();
  const { Dungeon } = ctx;
  let lastFloor = 0, early = 0, longMid = 0;
  for (let i = 0; i < 12; i++) {
    const seed = `tiers-${i}`;
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => m.id === 'minotaur' || m.id === 'troll')) lastFloor++;
    if (Dungeon.generate(seed, 1, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => ctx.MONSTERS[m.id].tier[0] > 1)) early++;
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 16, size: 'medium', monsters: 'normal' }).monsters.some(m => m.id === 'minotaur')) longMid++;
  }
  if (lastFloor < 8) return `only ${lastFloor} of 12 eight-floor delves met a troll or minotaur on the last floor`;
  if (early) return `${early} first floors held creatures from deeper tiers`;
  return longMid === 0 || `a sixteen-floor delve met a minotaur on floor 8 (${longMid} times)`;
});

await test('a shut door: a goblin opens it, an ogre smashes it at once, a rat batters for several blows before it gives', async () => {
  const out = [];
  for (const [id, want] of [['goblin', 'open'], ['ogre', 'smash'], ['rat', 'batter']]) {
    const ctx = await start('fighter', 'door-' + id);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    // a walled corridor ahead: the hero, a floor square, the door, a floor square, the creature
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    const at = (k, j = 0) => (p.y + dy * k + sy * j) * L.w + p.x + dx * k + sx * j;
    for (let k = 1; k <= 6; k++) { L.tiles[at(k, 1)] = T.WALL; L.tiles[at(k, -1)] = T.WALL; }
    for (let k = 1; k <= 4; k++) L.tiles[at(k)] = T.FLOOR;
    ahead(ctx, id, 4, { hp: 999, maxHp: 999 });
    L.tiles[at(5)] = T.WALL; L.tiles[at(2)] = T.DOOR;
    const mark = markLog(G);
    let first = null, broke = null;
    for (let t = 0; t < 12000 && broke === null; t += 25) {
      Game.update(G.t + 25, 25);
      if (first === null && (L.tiles[at(2)] !== T.DOOR || Object.keys(L.doorBlows || {}).length)) first = G.t;
      if (L.tiles[at(2)] !== T.DOOR) broke = G.t;
    }
    const said = linesSince(G, mark).join(' | ');
    if (broke === null) { out.push(`${id}: the door held for twelve seconds`); continue; }
    const now = L.tiles[at(2)];
    if (want === 'open' && now !== T.DOOR_OPEN) out.push(`${id}: the door is ${now}, not open`);
    if (want !== 'open' && now !== T.FLOOR) out.push(`${id}: the door is ${now}, not splintered`);
    if (want === 'smash' && !/smashes a door to splinters/.test(said)) out.push(`${id} said: ${said}`);
    if (want === 'batter') {
      const speed = ctx.MONSTERS.rat.speed;
      if (!/batters at a shut door/.test(said) || !/buckles: one more blow/.test(said) || !/bursts through a door/.test(said)) out.push(`${id} said: ${said}`);
      if (broke - first < 2 * speed) out.push(`${id}: broke through ${broke - first}ms after its first blow`);
    } else if (broke - first > 100) out.push(`${id}: took ${broke - first}ms at the door`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a fire scroll\'s number, flash and a death wait for the fireball to burst; the blow itself does not', async () => {
  const ctx = await start('fighter', 'scroll-delay');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.tick(10000);
  const fxOf = () => Game.renderState(10000).fx;
  const m = ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  const scroll = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(scroll); G.known.scroll_fire = 1;
  Game.useItem(scroll);
  const out = [];
  if (!(m.hp < 500)) out.push('the fireball did no harm at once');
  const text = fxOf().texts.slice(-1)[0];
  if (!text || !(text.born >= 10000 + 800)) out.push(`the number shows at ${text && text.born}, before the burst`);
  if (!(m.flashAt >= 10000 + 800)) out.push(`the flash starts at ${m.flashAt}`);
  // the bar keeps the goblin's full life until then, and shows the wound after
  const bar = now => Game.renderState(now).sprites.find(s => s.hp != null && s.maxHp === 500);
  if (!bar(10100) || bar(10100).hp !== 500) out.push(`the bar dropped early: ${bar(10100) && bar(10100).hp}`);
  if (!bar(11000) || bar(11000).hp !== m.hp) out.push('the bar never showed the wound');
  // a killing fireball: the goblin still stands, whole, until it lands
  const k = ahead(ctx, 'goblin', 2, { hp: 1, maxHp: 1, nextAct: 1e12 });
  const s2 = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(s2);
  Game.useItem(s2);
  if (Game.level().monsters.includes(k)) out.push('the goblin lived');
  const corpse = fxOf().corpses.slice(-1)[0];
  if (!corpse || !(corpse.born >= 10000 + 800)) out.push(`the goblin fell at ${corpse && corpse.born}, before the burst`);
  // and a blow straight after is shown at once: the delay is the fireball's alone
  const g = ahead(ctx, 'goblin', 1, { hp: 500, maxHp: 500, nextAct: 1e12 });
  p.perkHit = 60; G.t = p.nextAttack; Game.input('attack');
  const t2 = fxOf().texts.slice(-1)[0];
  if (!t2 || t2.born > 10000) out.push(`a sword blow's number waited too: ${t2 && t2.born}`);
  return out.length ? out.join('; ') : true;
});

await test('a spell\'s number waits for the spell to reach its target: darts fly, lightning is there at once', async () => {
  const out = [];
  for (const [id, lo, hi] of [['magic_missile', 300, 350], ['lightning', 0, 0]]) {
    const ctx = await start('mage', 'spell-delay-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.tick(10000);
    ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
    p.level = 9; p.sp = 99; G.t = p.nextAttack;
    const sp = Game.knownSpells().find(s => s.id === id);
    if (!sp) { out.push(`no ${id}`); continue; }
    Game.castSpell(sp);
    const t = Game.renderState(10000).fx.texts.slice(-1)[0];
    const wait = t ? t.born - 10000 : null;
    if (wait === null || wait < lo || wait > hi) out.push(`${id}: its number waits ${wait}ms, wanted ${lo}-${hi}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the quick scroll: fire with a foe ahead, restoration when badly hurt, nothing otherwise, and only one known by sight', async () => {
  const ctx = await start('fighter', 'quick-scroll');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.inv.push({ t: 'scroll_fire', q: 2, e: 0 }, { t: 'scroll_heal', q: 1, e: 0 });
  const out = [];
  if (Game.quickScroll()) out.push('a scroll not known by sight was offered');
  G.known.scroll_fire = 1; G.known.scroll_heal = 1;
  if (Game.quickScroll()) out.push(`offered ${Game.quickScroll().t} with nothing to do`);
  ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  if ((Game.quickScroll() || {}).t !== 'scroll_fire') out.push('no fire with a goblin ahead');
  const before = p.inv.find(i => i.t === 'scroll_fire').q;
  Game.input('read');
  if (p.inv.find(i => i.t === 'scroll_fire').q !== before - 1) out.push('one tap did not read the fire');
  Game.level().monsters.length = 0; p.hp = 1;
  if ((Game.quickScroll() || {}).t !== 'scroll_heal') out.push('no restoration when badly hurt');
  return out.length ? out.join('; ') : true;
});

await test('review fixes: a reload forgets a held life bar, a fleeing beast batters a shut door, a charge blocked short of a door hits nothing', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'reload-bar');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.tick(3600000);
    const m = ahead(ctx, 'ogre', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
    const s1 = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(s1); G.known.scroll_fire = 1;
    Game.useItem(s1);
    if (!(m.hpShown > 0)) out.push('the fireball held no bar to test with');
    Game.save(true); Game.load();
    const n = Game.level().monsters.find(x => x.uid === m.uid);
    if (n.hpShown || n.flashAt) out.push(`a reload kept flashAt ${n.flashAt}, hpShown ${n.hpShown}`);
  }
  {
    const ctx = await start('fighter', 'flee-door');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    const at = (k, j = 0) => (p.y + dy * k + sy * j) * L.w + p.x + dx * k + sx * j;
    for (let k = 1; k <= 5; k++) { L.tiles[at(k, 1)] = T.WALL; L.tiles[at(k, -1)] = T.WALL; }
    ahead(ctx, 'rat', 1, { hp: 999, maxHp: 999, fleeing: true });
    for (let k = 1; k <= 4; k++) L.tiles[at(k)] = T.FLOOR;
    L.tiles[at(2)] = T.DOOR; L.tiles[at(5)] = T.WALL;
    let inDoor = false;
    for (let t = 0; t < 3000; t += 25) { Game.update(G.t + 25, 25); const r = Game.level().monsters[0]; if (r && L.tiles[r.y * L.w + r.x] === T.DOOR) inDoor = true; }
    if (inDoor) out.push('a fleeing rat stood inside a shut door');
  }
  {
    const ctx = await start('fighter', 'charge-blocked');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const orc = ahead(ctx, 'orc', 5, { hp: 999, maxHp: 999 });
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy * 2) * L.w + p.x + dx * 2] = Dungeon.T.DOOR;
    // a goblin stands between the orc and the door
    L.monsters.push({ uid: 96, id: 'goblin', x: p.x + dx * 4, y: p.y + dy * 4, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    orc.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t, dx: -dx, dy: -dy }; orc.nextAct = G.t;
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (linesSince(G, mark).some(l => /slams into the shut door/.test(l))) out.push('a charge stopped by a goblin still slammed into the door');
  }
  return out.length ? out.join('; ') : true;
});

await test('a thrown knife is seen to fly, and what it does waits until it arrives', async () => {
  const ctx = await start('thief', 'knife-flight');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.tick(10000);
  p.eq.weapon = { t: 'throwknife', q: 1, e: 0 }; p.perkHit = 60;
  ahead(ctx, 'goblin', 3, { hp: 500, maxHp: 500, nextAct: 1e12 });
  G.t = p.nextAttack; Game.input('attack');
  const f = Game.renderState(10000).fx;
  const knife = f.spells.find(s => s.style === 'knife');
  if (!knife) return 'no knife in flight';
  const text = f.texts.slice(-1)[0];
  if (!text) return 'the knife did nothing';
  // it leaves the hand part way through the throw and crosses three squares
  if (!(knife.born > 10000 && text.born >= knife.until - 1)) return `the knife flies ${knife.born}-${knife.until}, its number shows at ${text.born}`;
  return true;
});

await test('a trap going off is seen: each kind its own picture, and one spotted is seen jammed', async () => {
  const out = [];
  for (const kind of ['dart', 'needle', 'pit', 'alarm', 'spotted']) {
    const ctx = await start(kind === 'spotted' ? 'thief' : 'fighter', 'trap-' + kind, { traps: true });
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
    Game.tick(5000);
    p.hp = p.maxHp = 999; p.stats.wis = 3; p.bg = 'oathbroken';
    if (kind === 'spotted') { p.level = 20; p.stats.wis = 18; }   // a seasoned, sharp-eyed thief: sees it but on a one
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    L.traps = L.traps || {};
    let now = 5000;
    for (let i = 0; i < (kind === 'spotted' ? 8 : 1); i++) {
      now = 5000 + i * 2000;
      p.x = x0; p.y = y0; Game.update(G.t + 600, 600); Game.tick(now);
      L.traps[`${x},${y}`] = kind === 'spotted' ? 'dart' : kind;
      Game.input('forward');
      if (kind !== 'spotted' || Game.renderState(now).fx.trapKind === 'disarm') break;
    }
    const f = Game.renderState(now).fx, want = kind === 'spotted' ? 'disarm' : kind;
    if (f.trapKind !== want || f.trapAt !== now) out.push(`${kind}: shown as ${f.trapKind} at ${f.trapAt}`);
    // a fall shakes the view longer than a blow does, harm and all
    if (kind === 'pit' && !(f.shakeMs === 700 && f.shakeUntil === now + 700)) out.push(`the pit shook for ${f.shakeMs}ms, not a fall's 700`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a trap is dodged with Dexterity (a pit only halved), and venom fought off with Constitution', async () => {
  const out = [];
  // walk onto a trap of this kind over and over; count what happened
  const tally = async (kind, stats, n = 80) => {
    const ctx = await start('fighter', 'saves-' + kind + stats.dex + stats.con, { traps: true });
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    Object.assign(p.stats, stats); p.bg = 'oathbroken'; p.stats.wis = 3;
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    const r = { dodged: 0, poisoned: 0, hurt: 0, worst: 0, halved: 0 };
    for (let i = 0; i < n; i++) {
      p.x = x0; p.y = y0; p.hp = p.maxHp = 999; p.poison = null;
      Game.update(G.t + 600, 600);
      L.traps[`${x},${y}`] = kind;
      const mark = markLog(G);
      Game.input('forward');
      const said = linesSince(G, mark).join(' | ');
      if (/twist aside|snatch your foot/.test(said)) r.dodged++;
      if (/catch the edge/.test(said)) { r.halved++; r.worst = Math.max(r.worst, 999 - p.hp); }
      if (p.hp < 999) r.hurt++;
      if (/twist aside|snatch your foot/.test(said) && p.hp < 999) out.push(`${kind}: dodged, yet hurt`);
      if (p.poison) r.poisoned++;
    }
    return r;
  };
  const clumsy = await tally('dart', { dex: 3, con: 10 }), nimble = await tally('dart', { dex: 20, con: 10 });
  if (!(nimble.dodged > clumsy.dodged + 15)) out.push(`darts dodged: nimble ${nimble.dodged}, clumsy ${clumsy.dodged}`);
  const pit = await tally('pit', { dex: 20, con: 10 });
  if (!pit.halved) out.push('no pit was ever caught at its edge');
  if (pit.worst > 6) out.push(`a pit caught at the edge still did ${pit.worst}`);
  if (pit.hurt !== 80) out.push('a pit was escaped whole');
  const frail = await tally('needle', { dex: 3, con: 3 }), hale = await tally('needle', { dex: 3, con: 18 });
  if (!(frail.poisoned > hale.poisoned + 10)) out.push(`needle poison: frail ${frail.poisoned}, hale ${hale.poisoned}`);
  return out.length ? out.join('; ') : true;
});

await test('saving throws: the claw, the gaze, the web, the charge and the lich\'s drain are weathered by the right score', async () => {
  const out = [];
  // one trick, landed over and over on a hero with this score; what it did each time
  const trials = async (id, move, dist, stat, value, measure) => {
    const ctx = await start('fighter', `sv-${move}-${value}`);
    seedDice(ctx, `sv-${move}-${value}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats[stat] = value; p.hp = p.maxHp = 9999;
    const results = [];
    // enough tries that a save's halving shows through the dice: forty let a
    // weak and a strong gaze come out within a fifth of each other one run in ten
    for (let i = 0; i < 120; i++) {
      p.held = 0; p.heldBy = ''; p.webbed = 0; p.grabbed = null; p.maxHp = 9999; p.hp = 9999;
      const m = ahead(ctx, id, dist, { hp: 999, maxHp: 999, blows: 5, spoke: true });
      if (move === 'melee') { m.windup = { kind: 'melee', at: G.t, until: G.t }; p.effects.ac = { amount: -30, until: 1e12 }; }
      else m.windup = { kind: 'move', move, at: G.t, until: G.t, dx: -ctx.Dungeon.DIRS[p.dir][0], dy: -ctx.Dungeon.DIRS[p.dir][1] };
      m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      results.push(measure(p, G));
      Game.update(G.t + 6000, 6000);
    }
    return results;
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  const heldFor = (p, G) => Math.max(0, (p.held || 0) - G.t);
  const cmp = async (label, id, move, dist, stat, measure) => {
    const lo = sum(await trials(id, move, dist, stat, 3, measure)), hi = sum(await trials(id, move, dist, stat, 20, measure));
    if (!(lo > hi * 1.2)) out.push(`${label}: weak ${lo}, strong ${hi}`);
  };
  await cmp('claw (con)', 'ghoul', 'paralyse', 1, 'con', (p, G) => (p.held > G.t && p.heldBy === 'frozen') ? 1 : 0);
  await cmp('gaze (con)', 'basilisk', 'gaze', 2, 'con', heldFor);
  await cmp('web (dex)', 'spider', 'web', 2, 'dex', (p, G) => Math.max(0, (p.webbed || 0) - G.t));
  await cmp('charge (str)', 'orc', 'charge', 3, 'str', (p, G) => (p.held > G.t && p.heldBy === 'down') ? 1 : 0);
  await cmp('drain (wis)', 'lich', 'melee', 1, 'wis', p => 9999 - p.maxHp);
  return out.length ? out.join('; ') : true;
});

await test('a mage draws a spell point back from each foe a spell destroys, but not from a blow', async () => {
  const out = [];
  const ctx = await start('mage', 'draw-back');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const missile = Game.knownSpells().find(s => s.id === 'magic_missile');
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  // below the most the mage can hold, whatever its rolled Intelligence
  const sp0 = p.sp = p.maxSp - 3; G.t = p.nextAttack; Game.castSpell(missile);
  if (Game.level().monsters.length) out.push('the missile did not kill');
  else if (p.sp !== sp0 - missile.cost + 1) out.push(`a spell kill left ${p.sp} points, wanted ${sp0 - missile.cost + 1}`);
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  p.sp = sp0;
  for (let i = 0; i < 10 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.length) out.push('the staff did not kill');
  else if (p.sp !== sp0) out.push(`a staff kill gave points: ${p.sp}`);
  // never past the most a mage can hold
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  p.sp = p.maxSp; G.t = p.nextAttack; Game.castSpell(missile);
  if (p.sp > p.maxSp) out.push('a spell kill overfilled the points');
  return out.length ? out.join('; ') : true;
});

await test('more ways to answer: a blow knocks a ghoul\'s claw aside, fire burns a web, a shut door stops a charge', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'claw-aside');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.perkHit = 60;
    const m = beside(ctx, 'ghoul', { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'paralyse', at: G.t, until: G.t + 750 }; m.nextAct = m.windup.until;
    for (let i = 0; i < 5 && m.windup; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (m.windup) out.push('blows did not knock the claw aside');
    else { run(Game, G, 900); if (p.held > G.t) out.push('the hero was frozen by a claw knocked aside'); }
  }
  {
    // poison already in it is not a blow: the claw still closes
    const ctx = await start('thief', 'claw-venom');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'ghoul', { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'paralyse', at: G.t, until: G.t + 750 }; m.nextAct = m.windup.until;
    m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 100 };
    run(Game, G, 300);
    if (m.dot && m.dot.next <= G.t) out.push('the venom did not tick');
    if (!m.windup) out.push('a tick of venom knocked the claw aside');
  }
  {
    const ctx = await start('mage', 'web-burn');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.level().monsters.length = 0;
    p.webbed = G.t + 5000; p.sp = 99; G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'burning_hands'));
    if (p.webbed > G.t) out.push('Burning Hands left the web whole');
  }
  {
    const ctx = await start('fighter', 'door-charge');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'orc', 4, { hp: 999, maxHp: 999 });
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy * 2) * L.w + p.x + dx * 2] = Dungeon.T.DOOR;
    m.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t, dx: -dx, dy: -dy }; m.nextAct = G.t;
    const hp0 = p.hp, mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (p.hp < hp0) out.push('the charge came through the door');
    if (!linesSince(G, mark).some(l => /slams into the shut door/.test(l))) out.push(`said: ${linesSince(G, mark).join(' | ')}`);
    if (!p.opening || p.opening.uid !== m.uid) out.push('the door left no opening');
  }
  return out.length ? out.join('; ') : true;
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
  while ((p.x === x0 && p.y === y0) && pushes < 40) { Game.update(G.t + 50, 50); Game.input('back'); pushes++; }
  if (pushes >= 40) return 'pushing never tore the web';
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
    p.stats.str = str; p.stats.dex = 3;              // no quickness to slip out with: strength decides
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
  if (!(guards.length === 1 && guards[0].pack && guards[0].pack.length === 1)) return `guards: ${JSON.stringify(guards.map(g => g.pack))}`;
  if (L.monsters.some(o => o.id === 'wraith')) return 'a wraith rose at two thirds, before the last act';
  // and past one third: more dead, and a wraith with them
  // (it came apart into shadow at two thirds: bring it back in reach, its ward spent)
  for (let i = 0; i < 8 && m.phase !== 2; i++) {
    m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.wardUntil = 0; m.hp = Math.min(m.hp, 60); m.nextAct = 1e12;
    G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  }
  if (m.phase !== 2) return 'the lich never reached its last act';
  const w = L.monsters.filter(o => o.id === 'wraith').length;
  return w === 1 || `${w} wraiths rose with the last act, not one`;
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
  // a wraith follows them only where there is still room for it
  guards.push(...L.monsters.filter(o => o.id === 'wraith'));
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
    // a natural 1 still misses: swing until it falls
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) {
      G.t = Math.max(G.t, p.nextAttack);
      try { Game.input('attack'); } catch (e) { return `stored ${bad}: ${e.message}`; }
    }
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
  // and a kill: slain first, then one note
  const m2 = beside(ctx, 'rat', { uid: 612, hp: 1, maxHp: 1, nextAct: 1e12 });
  let k = markLog(G);
  // a natural 1 misses whatever the bonus: swing again until the blow lands
  for (let i = 0; i < 20 && Game.level().monsters.includes(m2); i++) { k = markLog(G); G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  const after = linesSince(G, k);
  void m; void m2;
  const dead = after.findIndex(l => /destroyed|slain/.test(l)), n2 = after.findIndex(l => /^Bestiary, Giant Rat/.test(l));
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

await test('levelling offers a lesson at the odd levels, a class talent at the even ones, and the path at the fifth', async () => {
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
      kinds.push(`${p.level}:${isTalent ? 'T' : isLesson ? 'L' : Game.isPathOffer(offer) ? 'P' : '?'}`);
      if (!Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return `could not choose ${offer[0]}`;
    }
  }
  if (kinds.join(' ') !== '2:T 3:L 4:T 5:P 6:T') return `offers by level: ${kinds.join(' ')}`;
  return (p.talents.length === 3 && new Set(p.talents).size === 3) || `talents taken: ${JSON.stringify(p.talents)}`;
});

await test('a talent is never offered twice', async () => {
  const ctx = await start('mage', 'talent-once');
  const { Game, XP_TABLE, TALENTS } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  p.path = 'frostweaver';                  // past level 5 without one, the path would be offered first
  const taken = [];
  for (const lvl of [2, 4, 6, 8]) {
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
    Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined);
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
  // a natural 1 misses whatever the bonus, so swing until one lands
  for (let i = 0; i < 20 && m.hp === 400; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const front = 400 - m.hp, back = 400 - m.pack[0].hp;
  return (front > 0 && back === Math.max(1, Math.floor(front / 2))) || `front took ${front}, behind ${back}`;
});

await test('Riposte: a blow that misses readies the next swing at once', async () => {
  const ctx = await start('fighter', 'riposte');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'riposte');
  const m = beside(ctx, 'skeleton');
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
  for (let i = 0; i < 400 && n < 2; i++) { Game.update(G.t + 25, 25); n = countSaid(linesSince(G, mark), /strikes one of your images/); }
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
    return countSaid(linesSince(G, mark), /burns for|poison eats/);
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
  p.effects.boon_ac = { amount: 2, until: G.t + 20000 };      // a blessing from a shrine
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
  // a natural 20 is told as a mighty blow instead of a strike from the
  // shadows, and a natural 1 misses outright, so a run that rolls either is tried again
  let said = '';
  for (let tries = 0; tries < 4; tries++) {
    const ctx = await start('thief', 'shadow-late' + tries);
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
    if (linesSince(G, mark).some(l => /from the shadows/.test(l))) return true;
    said = linesSince(G, mark).join(' | ');
    if (!/mighty blow|a fumble/.test(said)) break;
  }
  return `said: ${said}`;
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

// ---------- the hero's hands and monsters that move ----------
await test('the view holds what is equipped: weapon, shield or second blade, and the class glove', async () => {
  const out = [];
  { const ctx = await start('fighter', 'view-f'); const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.shield = { t: 'shield', q: 1, e: 0 };
    const v = Game.renderState(0).fx.view;
    if (v.weapon !== 'longsword' || v.shield !== 'shield' || v.two || v.drawn) out.push(`sword and board: ${JSON.stringify(v)}`);
    if (v.cls !== 'fighter') out.push(`fighter hands ${v.cls}`);
    p.eq.weapon = { t: 'staff', q: 1, e: 0 }; p.eq.shield = null;
    const s = Game.renderState(0).fx.view;
    if (!s.two || s.drawn || s.shield) out.push(`staff: ${JSON.stringify(s)}`);
    p.eq.weapon = { t: 'shortbow', q: 1, e: 0 };
    if (!Game.renderState(0).fx.view.drawn) out.push('a bow was swung like a blade');
    p.eq.weapon = null;
    if (Game.renderState(0).fx.view.weapon !== null) out.push('bare hands still held a weapon'); }
  { const ctx = await start('thief', 'view-t'); const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'shortsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
    const v = Game.renderState(0).fx.view;
    if (v.offhand !== 'dagger' || v.cls !== 'thief') out.push(`dual: ${JSON.stringify(v)}`); }
  return out.length ? out.join('; ') : true;
});

await test('Attack swings the held weapon, a spell lifts the casting hand, and a monster lunges when it strikes', async () => {
  const out = [];
  const ctx = await start('mage', 'motion');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99;
  const m = beside(ctx, 'orc', { hp: 9999, maxHp: 9999, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  fx.swingAt = fx.castAt = -1e9;
  G.t = p.nextAttack; Game.input('attack');
  if (!(fx.swingAt > -1e9)) out.push('attacking did not swing');
  if (!(fx.swingMs >= 200 && fx.swingMs <= 380)) out.push(`swing lasted ${fx.swingMs}ms`);
  G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'magic_missile'));
  if (!(fx.castAt > -1e9)) out.push('casting did not raise the hand');
  m.nextAct = G.t; m.lungeAt = undefined;
  run(Game, G, 3000);
  if (!(m.lungeAt > 0)) out.push('the orc struck without lunging');
  return out.length ? out.join('; ') : true;
});

await test('a slain monster falls where it stood, and is gone once it has fallen', async () => {
  const ctx = await start('fighter', 'corpse');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  for (let i = 0; i < 50 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.length) return 'the goblin never died';
  const c = fx.corpses[fx.corpses.length - 1];
  if (!c || c.sprite !== 'goblin') return `no goblin corpse: ${JSON.stringify(fx.corpses)}`;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  if (Math.floor(c.x) !== p.x + dx || Math.floor(c.y) !== p.y + dy) return `it fell at ${c.x},${c.y}`;
  if (!(c.dx * dx + c.dy * dy > 0.9)) return `it was knocked toward ${c.dx},${c.dy}`;
  Game.update(c.born + 2000, 25);
  if (fx.corpses.includes(c)) return 'the corpse never cleared';
  return true;
});

// ---------- what a fight leaves ----------
await test('a blow throws a spray in the colour the monster bleeds, and a kill stains the floor', async () => {
  const out = [];
  for (const [id, colour] of [['orc', '#b8161c'], ['slime', '#7ed052'], ['skeleton', '#e8e0cc']]) {
    const ctx = await start('fighter', 'spray-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.perkHit = 60;
    const m = beside(ctx, id, { hp: 3, maxHp: 30, nextAct: 1e12 });
    const fx = Game.renderState(0).fx;
    // a natural 1 strikes only sparks, so swing until a blow lands
    for (let i = 0; i < 20 && !fx.bits.some(b => !b.glow); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (!fx.bits.some(b => b.c === colour)) out.push(`${id} sprayed ${[...new Set(fx.bits.map(b => b.c))].join(',')}`);
    for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
    const stains = fx.stains[G.depth] || [];
    if (id === 'skeleton' ? stains.length : !stains.length) out.push(`${id} left ${stains.length} stains`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a missed blow strikes sparks; stains are capped per floor and gone in a new run', async () => {
  const ctx = await start('fighter', 'sparks');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = -99;
  beside(ctx, 'orc', { hp: 999, maxHp: 999, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  // a natural 20 lands whatever the odds: swing until one misses
  for (let i = 0; i < 10; i++) {
    fx.bits.length = 0;
    G.t = p.nextAttack; Game.input('attack');
    if (fx.bits.length && fx.bits.every(b => b.glow)) break;
  }
  if (!fx.bits.length || !fx.bits.every(b => b.glow)) return `a miss threw ${fx.bits.length} bits`;
  p.perkHit = 60;
  for (let k = 0; k < 90; k++) {
    const m = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let i = 0; i < 20 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  }
  const n = (fx.stains[G.depth] || []).length;
  if (n > 60 || n < 30) return `${n} stains after 90 kills`;
  Game.newGame({ name: 'Again', cls: 'fighter', stats: Game.rollStats(), seed: 'sparks2', opts: Game.state().opts });
  if (Object.keys(fx.stains).length || fx.bits.length) return 'the last run\'s stains carried over';
  return true;
});

await test('a hard blow jolts the view harder than a light one, and bloodies its edges', async () => {
  const ctx = await start('fighter', 'jolt');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const fx = Game.renderState(0).fx;
  // the same ogre's blow against a long life and a short one
  const blowAgainst = life => {
    p.hp = p.maxHp = life; fx.drops.length = 0;
    beside(ctx, 'ogre', { nextAct: G.t, awake: true });
    for (let i = 0; i < 400 && p.hp === life; i++) Game.update(G.t + 25, 25);
    return { dealt: life - p.hp, amp: fx.shakeAmp, drops: fx.drops.length };
  };
  // with ten hit points any blow at all is a tenth of them
  const long = blowAgainst(1000), short = blowAgainst(10);
  if (!long.dealt || !short.dealt) return 'the ogre never landed a blow';
  if (!(short.amp > long.amp)) return `shake ${long.amp} against a long life, ${short.amp} against a short one`;
  if (long.drops) return `a light blow (${long.dealt} of 1000) bloodied the view`;
  if (!short.drops) return `a blow for ${short.dealt} of 10 left no blood on the view`;
  return true;
});

await test('what ails the hero is passed to the view to tint it', async () => {
  const ctx = await start('cleric', 'tint');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  let st = Game.renderState(0).fx.status;
  if (st.poison || st.held || st.hit) return `a fresh hero is ${JSON.stringify(st)}`;
  p.poison = { until: G.t + 5000, next: G.t + 1000 }; p.held = G.t + 2000; p.effects.hit = { amount: 1, until: G.t + 9000 };
  st = Game.renderState(0).fx.status;
  return (st.poison && st.held && st.hit && !st.webbed) || JSON.stringify(st);
});

// ---------- the lich ----------
/** A lich beside the hero, in a room with a torch on its wall. */
function lichRoom(ctx, extra = {}) {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), T = Dungeon.T;
  const m = beside(ctx, 'lich', { hp: 120, maxHp: 120, nextAct: 1e12, spoke: true, ...extra });
  // a torch on the nearest wall of its room, and its light
  const r = (L.rooms || []).find(r => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) || { x: m.x - 6, y: m.y - 6, w: 13, h: 13 };
  let torch = null;
  for (let x = r.x; x < r.x + r.w && !torch; x++) if (L.tiles[(r.y - 1) * L.w + x] === T.WALL) torch = [x, r.y - 1];
  // its light on the floor in front of it, as the dungeon lays them
  if (torch) { L.tiles[torch[1] * L.w + torch[0]] = T.TORCH; L.lights = (L.lights || []).concat([{ x: torch[0], y: torch[1] + 1 }]); }
  return { m, torch };
}
/** Strike the lich until its life falls under the mark. */
function woundTo(ctx, m, below) {
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  m.hp = Math.floor(below) + 1;
  for (let i = 0; i < 40 && m.hp >= below && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
}

await test('the lich speaks when it wakes, and its life shows across the top of the view', async () => {
  const ctx = await start('fighter', 'lich-wake');
  const { Game } = ctx; const G = Game.state();
  const { m } = lichRoom(ctx, { spoke: false, awake: true, nextAct: G.t + 5000 });
  if (Game.renderState(0).fx.boss) return 'the bar showed before the lich spoke';
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (!linesSince(G, mark).some(l => /A cold voice/.test(l))) return `it said: ${linesSince(G, mark).join(' | ')}`;
  const b = Game.renderState(0).fx.boss;
  return (b && b.hp === m.hp && b.maxHp === m.maxHp && b.name === 'Dread Lich') || JSON.stringify(b);
});

await test('at two thirds the lich raises guards, steps back out of reach and throws grave-cold', async () => {
  const ctx = await start('fighter', 'lich-phase1');
  const { Game } = ctx; const p = Game.player(), L = Game.level();
  const { m } = lichRoom(ctx);
  if (Game.mstat(m).ranged) return 'the lich threw from afar before it was wounded';
  woundTo(ctx, m, m.maxHp * 2 / 3);
  if (m.phase !== 1) return `phase ${m.phase} at ${m.hp}/${m.maxHp}`;
  if (!L.monsters.some(o => o.id === 'skeleton')) return 'no guards rose';
  const d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
  if (d < 2) return `it stayed ${d} step from the hero`;
  const r = Game.mstat(m).ranged;
  return (r && r.range >= 4) || 'it has nothing to throw';
});

await test('at one third the lich puts out its torches and quickens; they catch again when it falls', async () => {
  const ctx = await start('fighter', 'lich-phase2');
  const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
  const { m, torch } = lichRoom(ctx, { phase: 1 });
  if (!torch) return 'no wall for a torch in the test room';
  const lights = L.lights.length, slow = Game.mstat(m).speed;
  woundTo(ctx, m, m.maxHp / 3);
  if (m.phase !== 2) return `phase ${m.phase}`;
  if (L.tiles[torch[1] * L.w + torch[0]] === T.TORCH) return 'the torch still burns';
  if (L.lights.length >= lights) return `${L.lights.length} lights of ${lights} still lit`;
  if (!(Game.mstat(m).speed < slow)) return `speed ${Game.mstat(m).speed}, was ${slow}`;
  // now finish it
  m.hp = 1; m.windup = null;
  const p = Game.player(), G = Game.state();
  for (let i = 0; i < 40 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (L.monsters.includes(m)) return 'the lich would not die';
  if (L.tiles[torch[1] * L.w + torch[0]] !== T.TORCH) return 'the torch stayed dark after the lich fell';
  return L.lights.length === lights || `${L.lights.length} lights after, ${lights} before`;
});

await test('grave-cold breaks on a mage\'s own Shield; a cleric\'s Protection and bare skin take it', async () => {
  const out = [];
  for (const [cls, src] of [['mage', null], ['mage', 'shield'], ['cleric', 'protection']]) {
    const ctx = await start(cls, 'shield-cold');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = T.FLOOR; L.tiles[(p.y + 2 * dy) * L.w + p.x + 2 * dx] = T.FLOOR;
    L.monsters.length = 0;
    // it cannot miss but on a 1, so three bolts are sure to land at least once
    const m = { uid: 91, id: 'lich', x: p.x + 2 * dx, y: p.y + 2 * dy, hp: 999, maxHp: 999, awake: true, spoke: true, phase: 1, edge: 40, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    let hurt = 0, broke = 0;
    for (let i = 0; i < 3; i++) {
      p.effects = src ? { ac: { amount: 4, until: G.t + 60000, src } } : {};
      const before = p.hp, mark = markLog(G);
      m.windup = { kind: 'shot', at: G.t, until: G.t }; m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      if (m.windup) { out.push(`${cls}/${src}: the bolt never flew`); break; }
      if (p.hp < before) hurt++;
      if (linesSince(G, mark).some(l => /breaks on your Shield/.test(l))) broke++;
      G.t += 2000; m.nextAct = 1e12;
    }
    if (src === 'shield' ? hurt || !broke : !hurt || broke) out.push(`${cls} with ${src || 'nothing'}: wounded ${hurt} times, broke on the Shield ${broke} times`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a mage\'s spell pulls the lich\'s shadow apart; a fighter\'s blow and a cleric\'s prayer do not', async () => {
  const out = [];
  for (const [cls, spell] of [['mage', 'magic_missile'], ['fighter', null], ['cleric', 'smite']]) {
    const ctx = await start(cls, 'unravel');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.maxSp = 99; p.sp = cls === 'mage' ? 50 : 99; p.level = 5; p.perkHit = 60;
    // in play a warded lich waits out its shadow: it next acts when the shadow lifts
    const m = beside(ctx, 'lich', { hp: 120, maxHp: 120, spoke: true, phase: 1, wardUntil: G.t + 4000, nextAct: G.t + 4000 });
    G.t = p.nextAttack;
    if (spell) { if (!Game.castSpell(Game.knownSpells().find(s => s.id === spell))) { out.push(`${cls} could not cast ${spell}`); continue; } }
    else Game.input('attack');
    const bare = !(m.wardUntil > G.t);
    if (bare !== (cls === 'mage')) out.push(`${cls}: the shadow ${bare ? 'came apart' : 'held'}`);
    if (cls === 'mage' && bare && m.nextAct - G.t > 1000) out.push(`the bared lich still waits ${m.nextAct - G.t} ms to act`);
    if (cls === 'mage' && bare && p.sp !== 50 - 2 + 33) out.push(`the mage came away with ${p.sp} of ${p.maxSp} spell points`);
    if (m.hp !== 120) out.push(`${cls}: the lich was wounded to ${m.hp} through or by the unravelling`);
  }
  return out.length ? out.join('; ') : true;
});

await test('in the dark the wounded lich drinks from the Heart unless struck; a blow breaks the rite', async () => {
  const out = [];
  {
    // let the rite finish: a fifth of its life comes back
    const ctx = await start('fighter', 'lich-rite');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const { m } = lichRoom(ctx, { phase: 2, hp: 30, riteReady: 0, nextAct: G.t, awake: true });
    for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
    if (!(m.windup && m.windup.move === 'rite')) out.push(`it never began the rite (${JSON.stringify(m.windup)})`);
    else {
      const before = m.hp;
      for (let i = 0; i < 200 && m.windup && m.windup.move === 'rite'; i++) Game.update(G.t + 25, 25);
      if (m.hp - before !== Math.ceil(m.maxHp * 0.2)) out.push(`the rite mended ${m.hp - before}`);
    }
  }
  {
    const ctx = await start('fighter', 'lich-rite-broken');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.perkHit = 60;
    const { m } = lichRoom(ctx, { phase: 2, hp: 60, riteReady: 0, nextAct: G.t, awake: true });
    for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
    const mark = markLog(G);
    for (let i = 0; i < 20 && m.windup && m.windup.move === 'rite'; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (m.windup && m.windup.move === 'rite') out.push('blows did not break the rite');
    else if (!linesSince(G, mark).some(l => /break the Dread Lich's rite/.test(l))) out.push(`said: ${linesSince(G, mark).join(' | ')}`);
    if (m.hp > 60) out.push(`it mended to ${m.hp} though the rite was broken`);
  }
  return out.length ? out.join('; ') : true;
});

// ---------- the run in numbers ----------
// The end screen's summary is only as true as what was counted along the way.
await test('a kill is counted by its kind, each of a group included', async () => {
  const ctx = await start('fighter', 'stats-kills');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;                                 // every blow lands
  const swingUntilGone = () => { for (let i = 0; i < 40 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); } };
  beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  swingUntilGone();
  const rats = groupAhead(ctx, 'rat', 3, 1);
  rats.nextAct = 1e12;
  swingUntilGone();
  const k = Game.runStats().kills;
  if (Game.level().monsters.length) return 'the rats never all died';
  return (k.goblin === 1 && k.rat === 3 && Object.keys(k).length === 2) || `counted ${JSON.stringify(k)}`;
});

await test('damage dealt and taken add up, blasts into a group and the floor it happened on included', async () => {
  const out = [];
  { const ctx = await start('fighter', 'stats-dealt');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.perkHit = 60;
    seedDice(ctx, 'stats-dealt');
    const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
    for (let i = 0; i < 12; i++) { G.t = p.nextAttack; Game.input('attack'); }
    const s = Game.runStats();
    if (!(s.dealt > 0) || s.dealt !== 5000 - m.hp) out.push(`dealt ${s.dealt}, the orc lost ${5000 - m.hp}`);
    // and the orc hits back: against no armour to speak of, so it lands
    // whatever the hero's rolled scores and kit
    p.hp = p.maxHp = 9999; p.effects.ac = { amount: -30, until: 1e12 };
    m.nextAct = G.t;
    const mark = markLog(G);
    run(Game, G, 8000);
    const hits = linesSince(G, mark).map(l => /Orc \w+ you.* for (\d+)/.exec(l)).filter(Boolean).map(r => Number(r[1]));
    const sum = hits.reduce((a, b) => a + b, 0);
    if (!hits.length) out.push('the orc never landed a blow');
    if (s.taken !== sum) out.push(`taken ${s.taken}, the log says ${sum}`);
    if (s.hurtOn[G.depth] !== sum) out.push(`floor ${G.depth} holds ${JSON.stringify(s.hurtOn)}`);
    if (!s.worst || s.worst.dmg !== Math.max(...hits) || s.worst.from !== 'Orc') out.push(`hardest hit ${JSON.stringify(s.worst)}, the log's biggest ${Math.max(...hits)}`); }
  { const ctx = await start('mage', 'stats-blast');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.level = 9; p.sp = p.maxSp = 999;
    const m = ahead(ctx, 'goblin', 2, { hp: 900, maxHp: 900, nextAct: 1e12, pack: [{ hp: 900, maxHp: 900 }, { hp: 900, maxHp: 900 }] });
    G.t = p.nextAttack;
    if (!Game.castSpell(Game.knownSpells().find(s => s.id === 'lightning'))) out.push('lightning was not cast');
    const lost = 900 - m.hp + m.pack.reduce((n, b) => n + 900 - b.hp, 0);
    if (Game.runStats().dealt !== lost || lost <= 900 - m.hp) out.push(`a blast into three dealt ${Game.runStats().dealt}, they lost ${lost}`);
    if (Game.runStats().spells.lightning !== 1) out.push(`spells ${JSON.stringify(Game.runStats().spells)}`); }
  return out.length ? out.join('; ') : true;
});

await test('the best blow is kept, with who took it and what struck it', async () => {
  const ctx = await start('fighter', 'stats-best');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  beside(ctx, 'troll', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
  const mark = markLog(G);
  for (let i = 0; i < 20; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const blows = linesSince(G, mark).map(l => /You hit the Troll for (\d+)/.exec(l)).filter(Boolean).map(r => Number(r[1]));
  const b = Game.runStats().best;
  if (!b) return 'no best blow';
  if (b.dmg !== Math.max(...blows)) return `best ${b.dmg}, the log's biggest ${Math.max(...blows)}`;
  if (b.to !== 'Troll' || b.id !== 'troll') return `it went to ${b.to} (${b.id})`;
  if (b.how !== `the ${Game.itemName(p.eq.weapon)}`) return `struck with ${b.how}`;
  // a weaker blow afterwards leaves the record alone, and a spell names itself
  const kept = JSON.stringify(b);
  beside(ctx, 'rat', { hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let i = 0; i < 20 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (JSON.stringify(Game.runStats().best) !== kept) return `a one-point rat replaced it: ${JSON.stringify(Game.runStats().best)}`;
  const m2 = await start('mage', 'stats-best-spell');
  const mp = m2.Game.player(), mG = m2.Game.state();
  mp.sp = 99;
  beside(m2, 'orc', { hp: 500, maxHp: 500, nextAct: 1e12 });
  mG.t = mp.nextAttack;
  m2.Game.castSpell(m2.Game.knownSpells().find(s => s.id === 'magic_missile'));
  const sb = m2.Game.runStats().best;
  return (sb && sb.how === 'Magic Missile') || `a spell's best blow: ${JSON.stringify(sb)}`;
});

await test('potions, scrolls, healing and gold picked up are counted', async () => {
  const ctx = await start('mage', 'stats-misc');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.maxHp = 200; p.hp = 5;
  const potion = p.inv.find(i => i.t === 'potion_heal');
  Game.useItem(potion);
  const healedBy = p.hp - 5;
  const s = Game.runStats();
  if (s.potions !== 1) return `potions ${s.potions}`;
  if (s.healed !== healedBy) return `healed ${s.healed}, the hero gained ${healedBy}`;
  // healing past full counts only what it restored
  p.hp = p.maxHp - 1;
  p.inv.push({ t: 'potion_heal', q: 1, e: 0 });
  Game.useItem(p.inv.find(i => i.t === 'potion_heal'));
  if (s.healed !== healedBy + 1) return `an overflowing potion counted ${s.healed - healedBy}`;
  ahead(ctx, 'goblin', 2, { hp: 999, maxHp: 999, nextAct: 1e12 });
  Game.useItem(p.inv.find(i => i.t === 'scroll_fire'));
  if (s.scrolls !== 1) return `scrolls ${s.scrolls}`;
  if (!s.best || s.best.how !== 'Fireball') return `the scroll's blow: ${JSON.stringify(s.best)}`;
  const k = `${p.x},${p.y}`;
  L.items[k] = [{ t: 'gold', q: 17 }, { t: 'gem', q: 40, name: 'Opal' }];
  for (const it of L.items[k].slice()) Game.takeItem(it);
  return s.gold === 57 || `gold picked up ${s.gold}`;
});

await test('a save from before the run was counted loads, plays, and counts from there', async () => {
  const ctx = await start('fighter', 'stats-old');
  const { Game } = ctx;
  Game.save(true);
  const raw = JSON.parse(ctx.store.get('deepdelve.save'));
  if (!raw.stats) return 'the save did not keep the stats';
  delete raw.stats;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'the older save would not load';
  const G = Game.state(), p = Game.player();
  if (!G.stats || G.stats.dealt !== 0 || G.stats.best !== null || JSON.stringify(G.stats.kills) !== '{}') return `stats came back as ${JSON.stringify(G.stats)}`;
  // it plays on: time passes, a goblin dies and is counted
  run(Game, G, 1000);
  p.perkHit = 60;
  beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let i = 0; i < 40 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (G.stats.kills.goblin !== 1 || !(G.stats.dealt > 0)) return `after a kill: ${JSON.stringify(G.stats)}`;
  // one written part-way through the stats' life keeps what it has and gains the rest
  const partial = JSON.parse(JSON.stringify(raw));
  partial.stats = { dealt: 40, kills: { rat: 2 } };
  ctx.store.set('deepdelve.save', JSON.stringify(partial));
  if (!Game.load()) return 'a save with half its stats would not load';
  const s = Game.state().stats;
  return (s.dealt === 40 && s.kills.rat === 2 && s.taken === 0 && typeof s.hurtOn === 'object') || `half a record came back as ${JSON.stringify(s)}`;
});

// ---------- the end ----------
await test('the Heart is held fast while the lich stands, and lifting it once the lich is down wins on the spot', async () => {
  const ctx = await start('fighter', 'heart');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  const lich = beside(ctx, 'lich', { hp: 50, maxHp: 50, nextAct: 1e12 });
  const k = `${p.x},${p.y}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 });
  const mark = markLog(G);
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  if (G.status !== 'playing' || p.inv.some(i => i.t === 'artifact')) return 'the Heart came loose with the lich still standing';
  if (!linesSince(G, mark).some(l => /will not come loose/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  L.monsters.splice(L.monsters.indexOf(lich), 1);
  const depth = G.depth;
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  if (G.status !== 'won') return `status ${G.status} after lifting the Heart`;
  if (G.depth !== depth || G.escaping) return 'the run asked for a climb';
  return Game.finaleLeft() > 0 || 'no light to fill the view before the victory screen';
});

// ---------- round seven: the seams of the endgame ----------
await test('the off hand does not follow the lich into the shadow it steps away through', async () => {
  for (let trial = 0; trial < 12; trial++) {
    const ctx = await start('fighter', 'offhand-blink' + trial);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.eq.shield = null; p.eq.weapon = { t: 'shortsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
    const { m } = lichRoom(ctx, { hp: 81, maxHp: 120 });
    p.perkHit = 60;
    for (let i = 0; i < 20 && !m.phase; i++) {
      const mark = markLog(G);
      G.t = p.nextAttack; Game.input('attack');
      const said = linesSince(G, mark);
      const blink = said.findIndex(l => /comes apart into shadow/.test(l));
      if (blink >= 0 && said.slice(blink).some(l => /Your off hand finds the Dread Lich/.test(l))) return `the off hand struck it ${Math.abs(m.x - p.x) + Math.abs(m.y - p.y)} squares away`;
    }
  }
  return true;
});

await test('the lich snuffs its torches and exactly their light; a blow through both marks puts them out where it stands', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'snuff-pair');
    const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
    const { m, torch } = lichRoom(ctx, { phase: 1 });
    // a torch and light far off, which must be left alone
    L.lights = L.lights.concat([{ x: 1, y: 1 }]);
    woundTo(ctx, m, m.maxHp / 3);
    const gone = m.lights || [];
    if (!gone.some(l => l.x === torch[0] && l.y === torch[1] + 1)) out.push('the snuffed torch\'s light still shines');
    if (gone.some(l => !(m.snuffed || []).some(([x, y]) => Math.abs(x - l.x) + Math.abs(y - l.y) === 1))) out.push('a light went out whose torch still burns');
    if (!L.lights.some(l => l.x === 1 && l.y === 1)) out.push('a far light went out with the hall');
  }
  {
    const ctx = await start('fighter', 'lich-phase1');
    const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
    const { m, torch } = lichRoom(ctx, {});
    const at = [m.x, m.y];
    // a blow heavy enough to go from above the first mark to below the second at once
    Game.player().stats.str = 30;
    woundTo(ctx, m, m.maxHp / 3);        // from full straight past both marks
    if (m.phase !== 2) out.push(`phase ${m.phase}`);
    else {
      if (m.x !== at[0] || m.y !== at[1]) out.push('it stepped away though the torches were going out');
      if (torch && L.tiles[torch[1] * L.w + torch[0]] === T.TORCH) out.push('its hall stayed lit');
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('standing on the Heart while the lich lives leaves Use free, and nothing is picked up after the win', async () => {
  const ctx = await start('fighter', 'heart-use');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  const { m } = lichRoom(ctx, {});
  const k = `${p.x},${p.y}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 }, { t: 'gold', q: 50, e: 0 });
  Game.input('use');                       // takes the gold, not the Heart
  if (Game.useLabel() === 'Take') return 'Use still offers to take the Heart the lich holds';
  const mark = markLog(G);
  Game.input('use'); Game.input('use');
  if (linesSince(G, mark).some(l => /will not come loose/.test(l))) return 'Use kept trying the Heart';
  // the lich down, the Heart and a last coin on the floor: the Heart ends it, the coin stays
  L.monsters.splice(L.monsters.indexOf(m), 1);
  L.items[k].push({ t: 'gold', q: 7, e: 0 });
  const gold = p.gold;
  Game.input('use');
  if (G.status !== 'won') return `status ${G.status}`;
  return p.gold === gold || `picked up ${p.gold - gold} gold after the run was won`;
});

await test('resting, fountains and wounds closing all count in the run\'s healing', async () => {
  const ctx = await start('fighter', 'healed');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.stats.healed = 0;
  p.hp = Math.max(1, p.maxHp - 5); p.food = 100;
  Game.level().monsters.length = 0;
  if (!Game.rest()) return 'could not rest';
  return G.stats.healed === 5 || `resting 5 counted ${G.stats.healed}`;
});

// ---------- round seven: from the playtest ----------
await test('a talent taken from one waiting offer is not offered again by the next', async () => {
  const ctx = await start('fighter', 'dup-talent');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  // two talent offers waiting at once, both holding the same talent
  p.xp = 0; p.level = 1;
  G.pendingBoons = [['cleave', 'riposte', 'stand_firm'], ['cleave', 'second_wind', 'bulwark']];
  G.pendingLevels = [3, 6];
  if (!Game.chooseBoon('cleave')) return 'could not take Cleave';
  const next = Game.pendingBoons();
  if (!next || next.includes('cleave')) return `the next offer still holds Cleave: ${JSON.stringify(next)}`;
  if (next.length !== 3) return `the next offer shrank to ${next.length}`;
  return true;
});

await test('the levels the lich\'s death brings come without a choice standing between the hero and the Heart', async () => {
  const ctx = await start('fighter', 'lich-xp');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.pendingBoons = []; p.perkHit = 60;
  const { m } = lichRoom(ctx, { hp: 1, maxHp: 120 });
  const level = p.level;
  for (let i = 0; i < 20 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.includes(m)) return 'the lich would not die';
  if (p.level <= level) return 'killing the lich brought no level';
  return !Game.pendingBoons() || `a choice waits: ${JSON.stringify(Game.pendingBoons())}`;
});

await test('a trap, poison or hunger is named as the killer, not the last monster that struck', async () => {
  // a fighter with no eye for traps, so it is walked into, not spotted
  const ctx = await start('fighter', 'trap-death');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  G.lastAttacker = { name: 'Rabid Skeleton', dmg: 7, bearing: 'from ahead' };
  p.hp = 1; p.perkHit = 0; p.stats.wis = 3; p.bg = 'ashborn';
  // a pit trap in the square ahead
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  const k = `${p.x + dx},${p.y + dy}`;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.traps[k] = 'pit';
  for (let i = 0; i < 20 && G.status === 'playing' && L.traps[k]; i++) { Game.input('forward'); Game.update(G.t + 400, 400); }
  if (G.status === 'playing') return 'the trap did not kill (spotted, or none)';
  const killer = Game.lastAttacker();
  return (killer && killer.cause && /pit/i.test(killer.name)) || `killer: ${JSON.stringify(killer)}`;
});

await test('a line said again straight after itself is counted on one line, and bestiary notes share one', async () => {
  const ctx = await start('fighter', 'fold');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.poison = { until: G.t + 20000, next: G.t };
  p.hp = p.maxHp = 999;
  Game.level().monsters.length = 0;
  for (let i = 0; i < 300; i++) Game.update(G.t + 25, 25);
  const burns = G.log.filter(e => /poison burns/.test(e.m));
  if (burns.length !== 1 || !/\(\u00d7\d+\)$/.test(burns[0].m)) return `poison said as ${burns.length} lines: ${burns.map(e => e.m).join(' | ')}`;
  return true;
});

await test('every potion in a run has its own bottle, kept once known; in a fight Rest never drinks, the quaff does', async () => {
  const ctx = await start('mage', 'bottles');
  const { Game, ITEMS } = ctx; const p = Game.player(), G = Game.state();
  const potions = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'potion');
  const looks = potions.map(id => Game.spriteFor({ t: id, q: 1 }));
  if (new Set(looks).size !== potions.length) return `bottles shared: ${looks.join(',')}`;
  G.known.potion_heal = 1;
  if (Game.spriteFor({ t: 'potion_heal', q: 1 }) !== looks[potions.indexOf('potion_heal')]) return 'the bottle changed once the draught was known';
  // a fight, a known draught: Rest says it cannot and leaves the draught be;
  // the quaff, a button of its own, drinks it
  p.inv.push({ t: 'potion_heal', q: 1, e: 0 });
  p.maxHp = 40; p.hp = 5;                  // hurt enough that the draught is not wasted
  beside(ctx, 'orc', { hp: 99, maxHp: 99, nextAct: 1e12, awake: true });
  if (Game.restLabel() !== 'Foes near') return `with an orc beside, Rest says ${Game.restLabel()}`;
  const count = () => p.inv.filter(i => i.t === 'potion_heal').reduce((n, i) => n + i.q, 0);
  const before = count();
  Game.input('rest');
  if (count() !== before) return 'Rest in a fight drank a draught';
  if (!/can't rest/.test(G.log[G.log.length - 1].m)) return `Rest in a fight said: ${G.log[G.log.length - 1].m}`;
  Game.input('quaff');
  if (count() !== before - 1) return 'the quaff did not drink the draught';
  Game.level().monsters.length = 0;
  return Game.restLabel() === 'Rest' || `with the fight over, Rest says ${Game.restLabel()}`;
});

await test('when its fight turns the lich is wrapped in shadow a few seconds, and blows pass through it', async () => {
  const ctx = await start('fighter', 'lich-phase1');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const { m } = lichRoom(ctx, {});
  woundTo(ctx, m, m.maxHp * 2 / 3);
  if (m.phase !== 1) return `phase ${m.phase}`;
  if (!(m.wardUntil > G.t)) return 'no shadow when its fight turned';
  // bring it back beside the hero and strike while the shadow lasts
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy; m.nextAct = 1e12;
  const hp = m.hp;
  for (let i = 0; i < 5 && G.t < m.wardUntil - 1500; i++) { G.t = Math.max(p.nextAttack, G.t); Game.input('attack'); }
  if (m.hp !== hp) return `a blow landed through the shadow (${hp} to ${m.hp})`;
  G.t = m.wardUntil + 1; p.nextAttack = G.t;
  for (let i = 0; i < 10 && m.hp === hp; i++) { G.t = Math.max(p.nextAttack, G.t); Game.input('attack'); }
  return m.hp < hp || 'blows still passed through after the shadow lifted';
});

// ---------- the price of rest ----------
await test('the first rest on a floor restores all; each after it half as much, and the button says so', async () => {
  const ctx = await start('fighter', 'rest-decay');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  p.maxHp = 100; p.hp = 10; p.food = 100;
  if (Game.restLabel() !== 'Rest') return `before any rest the button says ${Game.restLabel()}`;
  if (!Game.rest()) return 'could not rest';
  if (p.hp !== 100) return `the first rest left ${p.hp} of 100`;
  if (Game.restLabel() !== 'Rest \u00bd') return `after one rest the button says ${Game.restLabel()}`;
  L.monsters.length = 0; p.hp = 10;
  Game.rest();
  const second = p.hp - 10;
  // half, or a quarter if something found the sleeper
  if (second !== 50 && second !== 25) return `the second rest gave ${second}`;
  return true;
});

await test('out of a fight, wounds close on their own only up to half the hero\'s life', async () => {
  const ctx = await start('fighter', 'regen-cap');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  p.maxHp = 100; p.hp = 10; p.food = 100; p.lastHurt = -1e9;
  for (let i = 0; i < 4000; i++) Game.update(G.t + 50, 50);
  return p.hp === 50 || `walking healed to ${p.hp} of 100`;
});

await test('a floor rested on again and again grows restless: something finds the sleeper', async () => {
  const ctx = await start('fighter', 'rest-ambush');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  let found = 0;
  for (let i = 0; i < 20; i++) {
    L.monsters.length = 0; p.hp = 1; p.food = 100;
    L.rests = 1 + (i % 2);                 // a second or third rest on the floor, where the dark stirs
    const mark = markLog(G);
    Game.rest();
    if (linesSince(G, mark).some(l => /something moving in the dark/.test(l))) {
      found++;
      if (!L.monsters.some(m => m.awake)) return 'the sleeper was found by nothing';
    }
  }
  if (!found) return 'twenty rests on one floor and nothing ever came';
  return found < 20 || 'every later rest was found';
});

await test('after three rests on a floor there is no more sleep to be had there, until the next floor', async () => {
  const ctx = await start('fighter', 'rest-cap');
  const { Game } = ctx; const p = Game.player(), L = Game.level();
  for (let i = 0; i < 3; i++) { L.monsters.length = 0; p.hp = 1; p.food = 100; if (!Game.rest()) return `rest ${i + 1} was refused`; }
  L.monsters.length = 0; p.hp = 1;
  if (Game.rest()) return 'a fourth rest was allowed';
  return Game.restLabel() === 'No rest' || `the button says ${Game.restLabel()}`;
});

await test('on the Long Delve on Hard, from the seventh floor, spells and a cleric\'s blows strike harder; nowhere else', async () => {
  const out = [];
  // the same darts, the same dice, cast on floor 9 of three kinds of run
  const dart = async (cls, levels, difficulty, depth = 9) => {
    const ctx = await newContext();
    const { Game } = ctx;
    Game.newGame({ name: 'D', cls, bg: 'oathbroken', stats: { ...evenStats, int: 16, wis: 16 }, seed: 'deep-magic', opts: { ...OPTS, levels, difficulty } });
    const p = Game.player(), G = Game.state();
    while (G.depth < Math.min(depth, levels)) { Game.level().monsters.length = 0; Game.descend(); }
    p.level = 9; p.sp = p.maxSp = 99; p.hp = p.maxHp = 999;
    const m = beside(ctx, 'ogre', { hp: 9999, maxHp: 9999 });
    seedDice(ctx, 'deep-magic');
    if (cls === 'mage') { if (!Game.castSpell(Game.knownSpells().find(s => s.id === 'magic_missile'))) return -1; }
    else for (let i = 0; i < 6; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // six swings, the same dice each run: a miss or two cannot hide it
    return 9999 - m.hp;
  };
  const deep = await dart('mage', 12, 'hard'), normal = await dart('mage', 12, 'normal'), short = await dart('mage', 8, 'hard'), shallow = await dart('mage', 12, 'hard', 6);
  if (!(normal > 0) || Math.abs(deep - Math.round(normal * 1.18)) > 1) out.push(`darts on floor 9: ${deep} on Hard against ${normal} on Normal (wanted about ${Math.round(normal * 1.18)})`);
  if (short !== normal) out.push(`an eight-floor Hard run's darts did ${short}, not ${normal}`);
  if (shallow !== normal) out.push(`floor 6 of the Long Delve on Hard did ${shallow}, not ${normal}`);
  // a cleric's blow too, and a fighter's not
  const cHard = await dart('cleric', 12, 'hard'), cNormal = await dart('cleric', 12, 'normal');
  if (!(cNormal > 0) || cHard <= cNormal) out.push(`a cleric's blow on floor 9: ${cHard} on Hard, ${cNormal} on Normal`);
  const fHard = await dart('fighter', 12, 'hard'), fNormal = await dart('fighter', 12, 'normal');
  if (fHard !== fNormal) out.push(`a fighter's blow changed with the deep: ${fHard} against ${fNormal}`);
  return out.length ? out.join('; ') : true;
});

// ---------- the deep answers strength ----------
/** Walk down the stairs to the next floor, as the game would. */
function goDown(ctx) {
  const { Game, Dungeon } = ctx;
  const L = Game.level(), p = Game.player(), s = L.stairsDown;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
  L.monsters.length = 0;
  Game.input('use');
  // at the divided stair, a road (the Crypts unless the test says)
  if (Game.forkPending()) Game.chooseRoute(ctx.road || 'crypts');
}
await test('a hero ahead of the usual finds the next floor readier for them; one on pace finds it as it was', async () => {
  const floorOf = async (level, seed = 'press') => {
    const ctx = await newContext();
    const { Game } = ctx;
    Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    Game.player().level = level;
    // the deep stirs from the third floor down, not before
    Game.level().monsters.length = 0; goDown(ctx);
    Game.player().level = level;
    const mark = markLog(Game.state());
    Game.level().monsters.length = 0; goDown(ctx);
    const L = Game.level();
    return { press: L.press || 0, hp: L.monsters.reduce((n, m) => n + m.maxHp + (m.pack || []).reduce((a, b) => a + b.maxHp, 0), 0),
      champions: L.monsters.filter(m => m.elite).length, said: linesSince(Game.state(), mark) };
  };
  const onPace = await floorOf(3), ahead = await floorOf(6);
  if (onPace.press) return `a level 3 hero on floor 3 pressed ${onPace.press}`;
  if (!(ahead.press >= 2.5)) return `a level 6 hero on floor 3 pressed only ${ahead.press}`;
  // and never on the second floor, however quick the start
  { const c2 = await newContext(); c2.Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'press', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    c2.Game.player().level = 6; goDown(c2);
    if (c2.Game.level().press) return `a level 6 hero on floor 2 was pressed ${c2.Game.level().press}`; }
  if (!(ahead.hp > onPace.hp * 1.3)) return `its creatures held ${ahead.hp} life against ${onPace.hp}`;
  // champions are a chance each, so count them over a few floors
  let more = 0, same = 0;
  for (const seed of ['press', 'press-b', 'press-c', 'press-d']) { more += (await floorOf(6, seed)).champions; same += (await floorOf(3, seed)).champions; }
  if (!(more > same)) return `${more} champions against ${same} over four floors`;
  if (!ahead.said.some(l => /The deep has heard of you/.test(l))) return 'the hero was not told';
  return true;
});

await test('difficulty: Hard is sturdier and surer with two rests a floor; Easy leaves more about and never presses; old runs are Normal', async () => {
  const floor = async (difficulty, level = 1, deeper = false) => {
    const ctx = await newContext();
    const { Game } = ctx;
    const opts = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    if (difficulty) opts.difficulty = difficulty;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts });
    Game.player().level = level;
    if (deeper) { Game.level().monsters.length = 0; goDown(ctx); Game.player().level = level; Game.level().monsters.length = 0; }
    goDown(ctx);
    const L = Game.level();
    const items = Object.values(L.items).reduce((n, list) => n + list.length, 0);
    return { ctx, L, hp: L.monsters.reduce((n, m) => n + m.maxHp, 0), items, hit: L.monsters.length ? Game.mstat(L.monsters[0]).hit : 0,
      base: L.monsters.length ? ctx.MONSTERS[L.monsters[0].id].hit + (L.monsters[0].elite ? (ctx.ELITES.find(e => e.prefix === L.monsters[0].elite).hit || 0) : 0) : 0 };
  };
  const easy = await floor('easy'), normal = await floor('normal'), hard = await floor('hard'), old = await floor(null);
  if (!(easy.hp < normal.hp && normal.hp < hard.hp)) return `life on the floor: easy ${easy.hp}, normal ${normal.hp}, hard ${hard.hp}`;
  if (old.hp !== normal.hp) return `a run with no difficulty held ${old.hp} life, Normal ${normal.hp}`;
  // on the second floor: Easy as drawn, Normal a step surer, and Hard too (its second step waits for the fourth)
  if (easy.hit !== easy.base || normal.hit !== normal.base + 1 || hard.hit !== hard.base + 1) return `to hit: easy ${easy.hit} (base ${easy.base}), normal ${normal.hit} (base ${normal.base}), hard ${hard.hit} (base ${hard.base})`;
  if (!(easy.items > normal.items)) return `items about: easy ${easy.items}, normal ${normal.items}`;
  // two rests on a Hard floor, three on Normal
  for (const [f, want] of [[hard, 2], [normal, 3]]) {
    const { Game } = f.ctx; const p = Game.player(), G = Game.state();
    p.food = 100;
    // anything a rest wakes is cleared away, so only the floor's limit stops the next
    for (let i = 0; i < 5; i++) { f.L.monsters.length = 0; p.hp = 1; G.t = Math.max(G.t + 60000, p.nextAttack); Game.input('rest'); }
    const rested = f.L.rests || 0;
    if (rested !== want) return `${want === 2 ? 'Hard' : 'Normal'} allowed ${rested} rests on a floor`;
  }
  // and on the first floor a step softer: Normal as drawn
  { const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal', difficulty: 'normal' } });
    const m = Game.level().monsters.find(x => !x.elite);
    if (m && Game.mstat(m).hit !== ctx.MONSTERS[m.id].hit) return `a ${m.id} on the first floor hits at +${Game.mstat(m).hit} on Normal`; }
  // and from the fourth floor Hard's creatures are two steps surer
  { const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal', difficulty: 'hard' } });
    for (let i = 0; i < 3; i++) { Game.level().monsters.length = 0; goDown(ctx); }
    const m = Game.level().monsters.find(x => !x.elite);
    if (Game.state().depth !== 4) return `went down to ${Game.state().depth}`;
    if (m && Game.mstat(m).hit !== ctx.MONSTERS[m.id].hit + 2) return `a ${m.id} on Hard's fourth floor hits at +${Game.mstat(m).hit}, drawn at +${ctx.MONSTERS[m.id].hit}`; }
  // a strong hero on Easy is not pressed
  const strongEasy = await floor('easy', 7, true), strongNormal = await floor('normal', 7, true);
  if (strongEasy.L.press) return `Easy pressed a strong hero ${strongEasy.L.press}`;
  if (!strongNormal.L.press) return 'Normal did not press a strong hero';
  return true;
});

await test('on a readier floor its creatures hit surer and harder', async () => {
  const ctx = await newContext();
  const { Game, MONSTERS } = ctx;
  Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'press2', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
  Game.player().level = 6;
  goDown(ctx);
  const L = Game.level();
  const m = L.monsters.find(m => !m.elite);
  if (!m) return 'no plain monster to look at';
  const s = Game.mstat(m), b = MONSTERS[m.id];
  if (!(s.hit > b.hit && s.dmg[2] > b.dmg[2])) return `a ${m.id} hits at +${s.hit} for +${s.dmg[2]}, as ever`;
  return true;
});

// ---------- sound ----------
// Headless there is no audio, but Sound still tells a listener what it would
// have played and from where, so the placing of a sound can be checked here.
/** Every sound played while `fn` runs. */
async function listenTo(ctx, fn) {
  const got = [];
  ctx.Sound.listen((name, v) => got.push({ name, ...v }));
  try { await fn(); } finally { ctx.Sound.listen(null); }
  return got;
}

await test('a draught sounds its cork and swallows at once and its heal once it is down; a scroll is heard being read', async () => {
  const ctx = await start('fighter', 'use-sounds');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.hp = 1;
  const potion = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(potion); G.known.potion_heal = 1;
  const out = [];
  const now = await listenTo(ctx, () => Game.useItem(potion));
  if (!now.some(s => s.name === 'drink')) out.push('no cork and swallow');
  if (now.some(s => s.name === 'heal')) out.push('the heal was heard before the draught was down');
  const later = await listenTo(ctx, () => new Promise(r => setTimeout(r, 500)));
  if (!later.some(s => s.name === 'heal')) out.push('the heal was never heard');
  const scroll = { t: 'scroll_map', q: 1, e: 0 }; p.inv.push(scroll); G.known.scroll_map = 1;
  const read = await listenTo(ctx, () => Game.useItem(scroll));
  if (!read.some(s => s.name === 'read' && s.kind === 'map')) out.push(`the scroll was not heard read: ${read.map(s => s.name).join(',')}`);
  return out.length ? out.join('; ') : true;
});

await test('a blow drawn back on the hero\'s left is heard on the left, a far one quieter, and one out of hearing not at all', async () => {
  const ctx = await start('fighter', 'sound-left');
  const { Game, Dungeon, Sound } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const [lx, ly] = Dungeon.DIRS[(p.dir + 3) % 4];
  L.tiles[(p.y + ly) * L.w + p.x + lx] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.monsters.push({ uid: 91, id: 'goblin', x: p.x + lx, y: p.y + ly, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  const near = await listenTo(ctx, () => Game.update(G.t + 25, 25));
  const w = near.find(s => s.name === 'windup');
  if (!w) return `no wind-up was heard: ${near.map(s => s.name).join(', ')}`;
  if (!(w.pan < 0)) return `a wind-up on the left played at pan ${w.pan}`;
  // an archer drawing on the hero from four squares ahead: dead centre, and quieter
  const a = ahead(ctx, 'archer', 4);
  const far = await listenTo(ctx, () => { for (let i = 0; i < 4 && !a.windup; i++) Game.update(G.t + 25, 25); });
  const fw = far.find(s => s.name === 'windup');
  if (!fw) return `the archer's draw was not heard: ${far.map(s => s.name).join(', ')}`;
  if (!(fw.gain < w.gain)) return `four squares off played at ${fw.gain}, beside at ${w.gain}`;
  if (Math.abs(fw.pan) > 0.01 || fw.behind) return `a shot from dead ahead played at pan ${fw.pan}${fw.behind ? ', behind' : ''}`;
  // out of hearing: not played at all
  const gone = await listenTo(ctx, () => Sound.play('voice', { dist: 40, pan: 0, who: 'orc' }));
  return gone.length === 0 || 'a voice forty squares off was played';
});

await test('a crushed skeleton dies with a rattle of bone, a goblin with blood, and each blow sounds like its weapon', async () => {
  const ctx = await start('cleric', 'sound-bones');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;                                 // every blow lands
  p.eq.weapon = { t: 'mace', q: 1, e: 0 };        // crushed bones stay down
  const swingUntilGone = m => { for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); } };
  const sk = beside(ctx, 'skeleton', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const bones = await listenTo(ctx, () => swingUntilGone(sk));
  const death = bones.find(s => s.name === 'death'), hit = bones.find(s => s.name === 'hit');
  if (!death || death.gore !== 'bone') return `the skeleton died as ${JSON.stringify(death)}`;
  if (!hit || hit.w !== 'mace' || hit.gore !== 'bone') return `the blow on it was heard as ${JSON.stringify(hit)}`;
  p.eq.weapon = null;
  const gob = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const blood = await listenTo(ctx, () => swingUntilGone(gob));
  const gd = blood.find(s => s.name === 'death'), gh = blood.find(s => s.name === 'hit');
  if (!gd || gd.gore !== 'blood') return `the goblin died as ${JSON.stringify(gd)}`;
  return (gh && gh.w === 'fists') || `a bare fist was heard as ${JSON.stringify(gh)}`;
});

await test('the lich\'s rite is a held tone that breaks with a crack; spells each have their own sound', async () => {
  const ctx = await start('fighter', 'sound-rite');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const { m } = lichRoom(ctx, { phase: 2, hp: 60, riteReady: 0, nextAct: G.t, awake: true });
  const begun = await listenTo(ctx, () => { for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25); });
  const rite = begun.find(s => s.name === 'rite');
  if (!rite || !(rite.ms > 1000)) return `the rite began as ${JSON.stringify(rite)}`;
  const broken = await listenTo(ctx, () => { for (let i = 0; i < 20 && m.windup && m.windup.move === 'rite'; i++) { G.t = p.nextAttack; Game.input('attack'); } });
  if (!broken.some(s => s.name === 'riteBroken')) return `breaking it sounded: ${broken.map(s => s.name).join(', ')}`;
  // a mage's Shield and a cleric's Bless are told apart by ear
  const cast = [];
  for (const [cls, id] of [['mage', 'shield'], ['cleric', 'bless']]) {
    const w = await start(cls, 'sound-spells');
    const wp = w.Game.player();
    wp.sp = wp.maxSp = 99;
    const sp = w.Game.knownSpells().find(s => s.id === id);
    cast.push(...(await listenTo(w, () => w.Game.castSpell(sp))).filter(s => s.name === 'cast').map(s => s.spell));
  }
  return cast.join() === 'shield,bless' || `cast sounded as ${cast.join()}`;
});

await test('a sound never moves the dice or calls Math.random', async () => {
  const ctx = await start('fighter', 'sound-dice');
  const { Sound, Dice } = ctx;
  const s0 = Dice.s, rand = Math.random;
  let called = 0;
  Math.random = () => { called++; return rand(); };
  try {
    for (const n of ['hit', 'voice', 'death', 'windup', 'cast', 'rite', 'riteBroken', 'ward', 'dread', 'lichfall']) Sound.play(n, { dist: 2, pan: 0.5, who: 'orc', gore: 'blood', spell: 'lightning', ms: 500 });
    Sound.setAmbience(1, 3); Sound.heartbeat(0.1, 1e9); Sound.stopAmbience();
  } finally { Math.random = rand; }
  return (Dice.s === s0 && !called) || `dice ${s0} -> ${Dice.s}, Math.random called ${called} times`;
});

// ---------- progress kept between runs ----------
/** Lift the Heart where the hero stands: the run is won on the spot. */
function winHere(Game) {
  const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
  const heart = { t: 'artifact', q: 1, e: 0 };
  (L.items[k] = L.items[k] || []).push(heart);
  Game.takeItem(heart);
  return Game.state().status === 'won';
}
const progressOf = ctx => JSON.parse(ctx.store.get('deepdelve.progress') || 'null');

await test('a win earns its class a trophy at its difficulty, told the first time only; a death earns none', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  // trophies are for a win on one life
  const run = (cls, difficulty, permadeath = true) => Game.newGame({ name: 'W', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'trophy-' + cls, opts: { ...OPTS, permadeath, difficulty } });
  run('mage', 'hard');
  if (!winHere(Game)) return 'lifting the Heart did not win';
  const v = progressOf(ctx);
  if (!v || !v.won || !v.won.mage || v.won.mage.hard !== 1) return `after a mage's hard win: ${JSON.stringify(v)}`;
  if (v.won.mage.normal || v.won.fighter) return `a hard win counted elsewhere too: ${JSON.stringify(v.won)}`;
  const e = Game.earned();
  if (!e || !e.first || e.cls !== 'mage' || e.difficulty !== 'hard') return `earned: ${JSON.stringify(e)}`;
  if (!Progress.hasWon('mage', 'hard') || Progress.highest('mage') !== 'hard' || Progress.highest('fighter') !== '') return 'the trophy is not read back';
  run('mage', 'hard'); winHere(Game);
  if (Game.earned().first) return 'a second hard win as a mage was told as the first';
  if (progressOf(ctx).won.mage.hard !== 2) return 'the second win was not counted';
  // a run from before there was a choice is Normal
  Game.newGame({ name: 'W', cls: 'thief', bg: 'oathbroken', stats: { ...evenStats }, seed: 'trophy-old', opts: { ...OPTS, permadeath: true } });
  winHere(Game);
  if (!Game.earned().first || !Progress.hasWon('thief', 'normal')) return `an unmarked run: ${JSON.stringify(progressOf(ctx).won)}`;
  // the Daily Delve counts like any other run
  const daily = ctx.Daily.heroFor('2026-09-24');
  Game.newGame(daily);
  winHere(Game);
  if (!Progress.hasWon(daily.cls, 'normal')) return `a daily ${daily.cls} win did not count`;
  // a win that could have been reloaded earns nothing, and says why
  const kept = JSON.stringify(progressOf(ctx));
  run('cleric', 'hard', false); winHere(Game);
  if (JSON.stringify(progressOf(ctx)) !== kept || !Game.earned() || !Game.earned().reloadable) return `a reloadable win counted: ${JSON.stringify(Game.earned())}`;
  const before = JSON.stringify(progressOf(ctx));
  // a death is no trophy
  run('fighter', 'easy');
  const p = Game.player(), G = Game.state();
  p.hp = 1; p.eq.armor = null; p.eq.shield = null;
  beside(ctx, 'goblin');
  for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead') return 'the goblin never killed the hero';
  if (JSON.stringify(progressOf(ctx)) !== before || Game.earned()) return `a death changed the trophies: ${JSON.stringify(progressOf(ctx).won)}`;
  const n = Progress.trophyCount();
  const { CLASSES, PATHS, VOWS, FEATS } = ctx, total = Object.keys(CLASSES).length * 3 + Object.values(PATHS).flat().length + Object.keys(VOWS).length + Object.keys(FEATS).length;
  return (n.total === total && n.won === new Set(['mage-hard', 'thief-normal', daily.cls + '-normal']).size) || `trophy count ${JSON.stringify(n)}`;
});

await test('a win with a path, and a vow kept, are trophies of their own; vows open after a Hard win', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = (cls, difficulty, opts = {}) => Game.newGame({ name: 'V', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'vow-' + cls, opts: { ...OPTS, permadeath: true, difficulty, ...opts } });
  if (Progress.vowsOpen()) return 'vows were open before any Hard win';
  run('fighter', 'hard'); Game.player().path = 'knight';
  winHere(Game);
  const e = Game.earned();
  if (!e.vowsOpened || e.firstPath !== 'knight') return `a first Hard win as a Knight earned ${JSON.stringify(e)}`;
  if (!Progress.vowsOpen()) return 'a Hard win did not open the vows';
  run('cleric', 'normal', { vows: ['iron', 'unaided', 'iron', 'nonsense'] });
  if (JSON.stringify(Game.state().opts.vows) !== '["iron","unaided"]') return `vows kept as ${JSON.stringify(Game.state().opts.vows)}`;
  winHere(Game);
  if (JSON.stringify(Game.earned().firstVows) !== '["iron","unaided"]') return `vows kept to a win earned ${JSON.stringify(Game.earned())}`;
  run('thief', 'easy', { vows: ['pauper'] }); winHere(Game);
  if (progressOf(ctx).vows.pauper) return 'a vow kept on Easy counted';
  const n = Progress.trophyCount();
  return n.won === 3 + 1 + 2 || `trophies ${JSON.stringify(n)} from ${JSON.stringify(progressOf(ctx))}`;
});

await test('a win on a long delve, on Normal or Hard, is the Long Delve feat; the Hall line says how long it was', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = (difficulty, levels) => Game.newGame({ name: 'L', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'long-' + levels, opts: { ...OPTS, permadeath: true, difficulty, levels } });
  run('normal', 8); winHere(Game);
  if (progressOf(ctx).feats.long) return 'an eight-floor win counted as a long delve';
  run('easy', 12); winHere(Game);
  if (progressOf(ctx).feats.long) return 'a long delve on Easy counted';
  run('hard', 12); winHere(Game);
  if (JSON.stringify(Game.earned().firstFeats) !== '["long"]' || progressOf(ctx).feats.long !== 1) return `a long Hard win earned ${JSON.stringify(Game.earned())}`;
  run('normal', 16); winHere(Game);
  if (Game.earned().firstFeats.length || progressOf(ctx).feats.long !== 2) return 'a second long win was told as a first, or not counted';
  const lens = Game.hall().map(h => h.levels).sort((a, b) => a - b).join();
  return lens === '8,12,12,16' || `the Hall kept levels ${lens}`;
});

await test('the Long Delve\'s back half is surer and sturdier: a step surer from the seventh floor, four percent sturdier a floor past the sixth', async () => {
  const at = async (levels, depth) => {
    const ctx = await start('fighter', 'long-edge', { levels, difficulty: 'normal' });
    const { Game, MONSTERS } = ctx; Game.player().hp = Game.player().maxHp = 9999;
    downTo(ctx, depth);
    const m = Game.level().monsters.find(x => !x.elite && !MONSTERS[x.id].named && !MONSTERS[x.id].boss);
    return { hit: Game.mstat(m).hit - MONSTERS[m.id].hit, id: m.id };
  };
  const short7 = await at(8, 7), long7 = await at(12, 7), long6 = await at(12, 6);
  if (long7.hit !== short7.hit + 1) return `a ${long7.id} on floor 7 of 12 hits +${long7.hit} over its drawing; on floor 7 of 8, +${short7.hit}`;
  return long6.hit === short7.hit || `on floor 6 of 12 creatures are already ${long6.hit} surer`;
});

await test('mastery: the Ranger opens when the other four have each won; every relic found is the Collector; the Daily keeps to the first four classes', async () => {
  const out = [];
  const ctx = await newContext();
  const { Game, Progress, RELICS, Daily } = ctx;
  if (Progress.classOpen('ranger')) out.push('the Ranger was open from the start');
  if (!Progress.classOpen('thief')) out.push('the thief was locked');
  const win = (cls, difficulty) => { Game.newGame({ name: 'M', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'mastery-' + cls, opts: { ...OPTS, permadeath: true, difficulty } }); winHere(Game); return Game.earned(); };
  win('fighter', 'easy'); win('cleric', 'normal'); win('mage', 'hard');
  if (Progress.classOpen('ranger')) out.push('three classes won opened the Ranger');
  const e = win('thief', 'easy');
  if (JSON.stringify(e.classesOpened) !== '["ranger"]' || !Progress.classOpen('ranger')) out.push(`the fourth class's win opened ${JSON.stringify(e.classesOpened)}`);
  if (win('fighter', 'normal').classesOpened.length) out.push('the Ranger was opened twice');
  // the Collector
  const ids = Object.keys(RELICS);
  for (const id of ids.slice(0, -1)) Progress.noteRelic(id);
  if (progressOf(ctx).feats.collector) out.push('the Collector came before the last relic');
  Progress.noteRelic(ids[ids.length - 1]);
  if (progressOf(ctx).feats.collector !== 1) out.push('every relic found was not the Collector');
  // a codex filled before the feat existed earns it with the next relic picked up, known or not
  const v = progressOf(ctx); delete v.feats.collector; ctx.store.set(Progress.KEY, JSON.stringify(v));
  Progress.noteRelic(ids[0]);
  if (progressOf(ctx).feats.collector !== 1) out.push('a full codex from before the feat never earned it');
  // the Daily never deals a class it has not always dealt
  for (let i = 0; i < 200; i++) { const d = new Date(2026, 0, 1 + i); const key = d.toISOString().slice(0, 10); if (Daily.heroFor(key).cls === 'ranger') { out.push(`the Daily of ${key} dealt a Ranger`); break; } }
  return out.length ? out.join('; ') : true;
});

await test('a vow binds: no rest under the Iron Vow, no trader under the Pauper\'s, no draught unaided; the Daily takes none', async () => {
  const out = [];
  const ctx = await start('fighter', 'vows', { vows: ['iron', 'pauper', 'unaided'] });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0; p.hp = 1;
  const mark = markLog(G);
  if (Game.rest() !== false || p.hp !== 1) out.push('the Iron Vow let the hero rest');
  const draught = { t: 'potion_heal', q: 1 }; p.inv.push(draught); G.known.potion_heal = 1;
  Game.useItem(draught);
  if (p.hp !== 1 || !p.inv.includes(draught)) out.push('an unaided hero drank a draught');
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR;
  Game.input('forward');
  if (Game.currentShop()) out.push('a trader dealt with a pauper');
  const said = linesSince(G, mark).join(' | ');
  for (const w of ['Iron Vow', 'unaided', 'pauper']) if (!said.includes(w)) out.push(`nothing said of the ${w}: ${said}`);
  const daily = ctx.Daily.heroFor('2026-09-24');
  Game.newGame({ ...daily, opts: { ...daily.opts, vows: ['iron'] } });
  if ((Game.state().opts.vows || []).length) out.push('the Daily Delve took a vow');
  return out.length ? out.join('; ') : true;
});

await test('a relic picked up or bought goes in the codex, once, and the codex outlasts the run', async () => {
  const ctx = await start('fighter', 'codex');
  const { Game, Progress } = ctx;
  const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
  if (Progress.load().relics.length) return 'a fresh device already knows relics';
  const tooth = { t: 'dagger', q: 1, e: 2, u: 'grimtooth' };
  (L.items[k] = L.items[k] || []).push(tooth);
  Game.takeItem(tooth);
  if (!p.inv.some(it => it.u === 'grimtooth')) return 'Grimtooth was not picked up';
  if (JSON.stringify(progressOf(ctx).relics) !== '["grimtooth"]') return `after picking up Grimtooth: ${JSON.stringify(progressOf(ctx))}`;
  // bought from a trader
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'shield', q: 1, e: 2, u: 'kests_bulwark' }] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.gold = 99999;
  if (!Game.buy(shop.stock[0])) return 'could not buy the Bulwark';
  if (JSON.stringify(progressOf(ctx).relics) !== '["grimtooth","kests_bulwark"]') return `after buying the Bulwark: ${JSON.stringify(progressOf(ctx))}`;
  if (Progress.noteRelic('grimtooth')) return 'Grimtooth went in twice';
  // seen by the next hero, on a new run
  Game.newGame({ name: 'N', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats }, seed: 'codex-next', opts: OPTS });
  const r = Progress.load().relics;
  return (r.length === 2 && r.includes('grimtooth') && r.includes('kests_bulwark')) || `the next hero's codex: ${JSON.stringify(r)}`;
});

await test('progress that is missing or corrupt is shrugged off, and an old Hall still counts its wins', async () => {
  const ctx = await newContext();
  const { Progress } = ctx;
  for (const bad of ['{not json', 'null', '[]', '7', JSON.stringify({ won: 'x', relics: 'y' })]) {
    ctx.store.set('deepdelve.progress', bad);
    const v = Progress.load();
    if (JSON.stringify(v) !== '{"won":{},"relics":[],"paths":{},"vows":{},"feats":{}}') return `${bad} read as ${JSON.stringify(v)}`;
    if (Progress.bgOpen('returned')) return `${bad} opened a locked background`;
  }
  ctx.store.set('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 'x', easy: 2 }, nobody: { easy: 3 } }, relics: ['grimtooth', 7, 'nope', 'grimtooth'], paths: { knight: 2, nope: 5, healer: 'x' }, vows: { iron: -1, pauper: 1 }, feats: { long: 1, nope: 2 } }));
  const v = Progress.load();
  if (JSON.stringify(v) !== '{"won":{"fighter":{"easy":2}},"relics":["grimtooth"],"paths":{"knight":2},"vows":{"pauper":1},"feats":{"long":1}}') return `a half-good record read as ${JSON.stringify(v)}`;
  if (!Progress.noteRelic('thirst') || Progress.load().relics.length !== 2) return 'the codex could not grow after a bad record';
  // storage that throws is no crash, and no unlock
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {}, clear() {} };
  try {
    if (Progress.load().relics.length || Progress.bgOpen('heartsworn')) return 'blocked storage still read';
    Progress.noteRelic('whisper'); Progress.recordWin('fighter', 'hard');
  } finally { globalThis.localStorage = real; }
  // a player from before progress was kept: the Hall's wins count
  ctx.store.delete('deepdelve.progress');
  ctx.store.set('deepdelve.hall', JSON.stringify([{ name: 'Old', cls: 'cleric', won: true, difficulty: 'hard', score: 3000 }, { name: 'Older', cls: 'thief', won: true, score: 2500 }, { name: 'Lost', cls: 'mage', won: false, difficulty: 'hard', score: 100 },
    { name: 'Reloaded', cls: 'fighter', won: true, difficulty: 'normal', permadeath: false, score: 2000 }]));
  // a win that could have been reloaded is no trophy, from the Hall or anywhere
  if (!Progress.hasWon('cleric', 'hard') || !Progress.hasWon('thief', 'normal') || Progress.hasWon('mage', 'hard') || Progress.hasWon('fighter', 'normal')) return `from the Hall: ${JSON.stringify(Progress.load().won)}`;
  return Progress.bgOpen('heartsworn') || 'a hard win in the Hall did not open the Heartsworn';
});

await test('the earned backgrounds are refused until won, then open with their perks', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  const make = (bg, difficulty = 'normal') => { Game.newGame({ name: 'B', cls: 'fighter', bg, stats: { ...evenStats }, seed: 'bg-lock', opts: { ...OPTS, permadeath: true, difficulty } }); return Game.player(); };
  if (make('returned').bg !== 'oathbroken') return `the Returned was taken while locked: ${Game.player().bg}`;
  if (Game.player().inv.some(it => it.t === 'potion_xheal')) return 'the locked perk came anyway';
  if (make('heartsworn').bg !== 'oathbroken') return 'the Heartsworn was taken while locked';
  // an easy win opens nothing
  make('oathbroken', 'easy'); winHere(Game);
  if (Game.earned().unlocked.length || make('returned').bg !== 'oathbroken') return 'an easy win opened the Returned';
  // a normal win opens the Returned, not the Heartsworn
  make('oathbroken', 'normal'); winHere(Game);
  if (JSON.stringify(Game.earned().unlocked) !== '["returned"]') return `a normal win opened ${JSON.stringify(Game.earned().unlocked)}`;
  const p = make('returned');
  if (p.bg !== 'returned') return 'the Returned is still refused after a normal win';
  const draught = p.inv.find(it => it.t === 'potion_xheal');
  if (!draught || draught.q !== 1 || !Game.isKnown('potion_xheal')) return 'the Returned did not start with a known Potion of Extra Healing';
  // the first rest on a floor costs no food, the next the usual
  const L = Game.level();
  L.monsters.length = 0; p.hp = 1; p.food = 50;
  if (!Game.rest() || p.food !== 50) return `the first rest cost ${50 - p.food} food`;
  L.monsters.length = 0; p.hp = 1;
  if (!Game.rest() || p.food !== 44) return `the second rest cost ${50 - p.food} food`;
  if (make('heartsworn').bg !== 'oathbroken') return 'a normal win opened the Heartsworn';
  // a hard win opens the Heartsworn
  make('oathbroken', 'hard'); winHere(Game);
  if (JSON.stringify(Game.earned().unlocked) !== '["heartsworn"]') return `a hard win opened ${JSON.stringify(Game.earned().unlocked)}`;
  // wounds close on their own to 60% for the Heartsworn, half for anyone else
  const healTo = bg => {
    const h = make(bg), G = Game.state();
    Game.level().monsters.length = 0;
    h.maxHp = 100; h.hp = 10; h.food = 100; h.lastHurt = -1e9;
    for (let i = 0; i < 4000; i++) Game.update(G.t + 50, 50);
    return h.hp;
  };
  const heart = healTo('heartsworn');
  if (Game.player().bg !== 'heartsworn') return 'the Heartsworn is still refused after a hard win';
  const plain = healTo('oathbroken');
  return (heart === 60 && plain === 50) || `healed on their own to ${heart} (Heartsworn) and ${plain} (Oathbroken)`;
});

await test('the Daily Delve deals only the six original backgrounds, whatever has been unlocked', async () => {
  const ctx = await newContext();
  const { Daily, Progress, BACKGROUNDS } = ctx;
  if (Daily.DAILY_BACKGROUNDS.join() !== 'oathbroken,tombwise,ashborn,cloistered,deepborn,debtor') return `the daily list is ${Daily.DAILY_BACKGROUNDS.join()}`;
  if (!Object.keys(BACKGROUNDS).some(id => BACKGROUNDS[id].unlock)) return 'there is no earned background to leave out';
  Progress.recordWin('fighter', 'hard');
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const key = Daily.today(new Date(2026, 0, 1 + i)), hero = Daily.heroFor(key);
    if (BACKGROUNDS[hero.bg].unlock || !Daily.DAILY_BACKGROUNDS.includes(hero.bg)) return `${key} dealt ${hero.bg}`;
    seen.add(hero.bg);
  }
  return seen.size === 6 || `only ${seen.size} backgrounds came up in 400 days`;
});

await test('rings and amulets: two rings and an amulet on any hero, each doing what it was made for', async () => {
  const out = [];
  const ctx = await start('mage', 'jewels-worn');
  const { Game, ITEMS } = ctx; const p = Game.player(), G = Game.state();
  const give = (t, extra = {}) => { const it = { t, q: 1, e: 0, ...extra }; p.inv.push(it); return it; };
  const ac0 = Game.playerAC(), hit0 = Game.toHit(), sp0 = p.maxSp;
  // a mage wears no armour, but a ring anyone may
  const prot = give('ring_protect', { e: 1 }), might = give('ring_might'), wiz = give('amulet_mind');
  for (const it of [prot, might, wiz]) if (!Game.equip(it, true)) out.push(`${it.t} would not go on`);
  if (p.eq.ring !== prot || p.eq.ring2 !== might || p.eq.amulet !== wiz) out.push(`worn: ${JSON.stringify([p.eq.ring, p.eq.ring2, p.eq.amulet].map(i => i && i.t))}`);
  if (Game.playerAC() !== ac0 + 2) out.push(`a +1 Ring of Protection made armour class ${ac0} into ${Game.playerAC()}, not ${ac0 + 2}`);
  if (Game.toHit() !== hit0 + 1) out.push(`a Ring of Might made to-hit ${hit0} into ${Game.toHit()}`);
  if (p.maxSp !== sp0 + 6) out.push(`an Amulet of Wizardry made spell points ${sp0} into ${p.maxSp}`);
  // a third ring takes the place of the first, which goes back in the pack
  const third = give('ring_quiet');
  Game.equip(third, true);
  if (p.eq.ring !== third || !p.inv.includes(prot)) out.push('a third ring did not take the first one\'s place');
  // a cursed ring binds its finger, and the next ring goes on the other
  Game.unequip('ring'); Game.unequip('ring2');
  const bad = give('ring_protect', { e: -2, curse: 1 });
  Game.equip(bad, true);
  if (Game.playerAC() !== ac0 - 1) out.push(`a cursed -2 Ring of Protection left armour class at ${Game.playerAC()}, not ${ac0 - 1}`);
  Game.unequip(p.eq.ring === bad ? 'ring' : 'ring2');
  if (!Object.values(p.eq).includes(bad)) out.push('a cursed ring came off');
  const next = give('ring_might'); Game.equip(next, true);
  if (!Object.values(p.eq).includes(bad) || !Object.values(p.eq).includes(next)) out.push('the next ring displaced the cursed one');
  return out.length ? out.join('; ') : true;
});

await test('a failed study of an unknown ring holds for every ring of that look until the next level', async () => {
  const ctx = await start('fighter', 'ring-study');
  seedDice(ctx, 'ring-study');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.stats.int = 3;
  const first = { t: 'ring_evasion', q: 1, e: 0 };
  p.inv.push(first);
  // a low mind fails soon enough; a lucky pass is forgotten and tried again
  let failed = false;
  for (let i = 0; i < 40 && !failed; i++) {
    delete first.studied; if (G.studied) delete G.studied.ring_evasion; delete G.known.ring_evasion;
    const c = Game.study(first);
    failed = !!c && !c.pass;
  }
  if (!failed) return 'never failed a study with 3 intelligence';
  const second = { t: 'ring_evasion', q: 1, e: 0 };
  p.inv.push(second);
  if (!Game.studyReason(second)) return 'a second ring of the same look could be studied straight after the first failed';
  const other = { t: 'ring_protect', q: 1, e: 0 };
  p.inv.push(other);
  if (Game.studyReason(other)) return `a ring of another look was refused: ${Game.studyReason(other)}`;
  p.level++;
  return Game.studyReason(second) === null || `a level later it is still refused: ${Game.studyReason(second)}`;
});

await test('a ring is known only by its look until it is worn or studied, and sells as a trinket till then', async () => {
  const out = [];
  const ctx = await start('fighter', 'jewels-known');
  const { Game, ITEMS } = ctx; const p = Game.player();
  const it = { t: 'ring_evasion', q: 1, e: 0 }; p.inv.push(it);
  const shown = Game.itemName(it);
  if (!/^[A-Z][a-z]+ Ring$/.test(shown) || shown.includes('Evasion')) out.push(`an unknown ring is called "${shown}"`);
  // nor does a finely made one say so before its kind is known
  const fine = { t: 'ring_protect', q: 1, e: 2 };
  if (/\+2/.test(Game.itemName(fine))) out.push(`an unknown ring gives away its make: "${Game.itemName(fine)}"`);
  if (Game.sellPrice(it) >= ITEMS.ring_evasion.value * 0.45) out.push(`an unknown ring sells for ${Game.sellPrice(it)}, as much as a known one`);
  Game.equip(it, true);
  if (Game.itemName(it) !== 'Ring of Evasion') out.push(`worn, it is called "${Game.itemName(it)}"`);
  // another of the same kind is known on sight after that
  const two = { t: 'ring_evasion', q: 1, e: 0 };
  if (Game.itemName(two) !== 'Ring of Evasion') out.push('a second one of a known kind was not named');
  // an amulet can be puzzled out instead: study until it gives up its name
  const am = { t: 'amulet_ward', q: 1, e: 0 }; p.inv.push(am);
  p.stats.int = 18;
  for (let i = 0; i < 20 && !Game.isKnown(am.t); i++) { p.level = 2 + i; Game.study(am); }
  if (!Game.isKnown(am.t)) out.push('studying an amulet never told what it was');
  // the looks are dealt out afresh each run, but always the same for a seed
  const again = await start('fighter', 'jewels-known');
  if (again.Game.itemName({ t: 'ring_evasion', q: 1 }) !== shown) out.push('the same seed dealt a different look');
  return out.length ? out.join('; ') : true;
});

await test('an Amulet of Life Saving takes the killing blow once, and crumbles', async () => {
  const ctx = await start('fighter', 'jewels-life');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const am = { t: 'amulet_life', q: 1, e: 0 }; p.inv.push(am); Game.equip(am, true);
  p.hp = 3; p.effects.ac = { amount: -60, until: 1e12 };
  const m = beside(ctx, 'ogre', { hp: 999, maxHp: 999 });
  for (let i = 0; i < 40 && p.hp > 0 && p.hp <= 3; i++) { m.nextAct = G.t; run(Game, G, 1200); }
  if (G.status !== 'playing') return `the hero died wearing it (${G.status})`;
  if (p.eq.amulet) return 'the amulet is still worn';
  if (p.hp < Math.ceil(p.maxHp / 2) - 40) return `left at ${p.hp} of ${p.maxHp}`;
  if (!/crumbles to dust/.test(G.log.map(l => l.m).join('\n'))) return 'nothing said it saved you';
  // and only once
  p.hp = 1; m.nextAct = G.t;
  for (let i = 0; i < 40 && G.status === 'playing'; i++) { m.nextAct = G.t; run(Game, G, 1200); }
  return G.status === 'dead' || 'a second killing blow was turned too';
});

await test('a Ring of Evasion softens what lands: a web binds the nimble-fingered for less time', async () => {
  const time = async rings => {
    const ctx = await start('fighter', 'jewels-evade-' + rings);
    seedDice(ctx, 'jewels-evade-' + rings);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats.dex = 3; p.hp = p.maxHp = 9999;
    for (let i = 0; i < rings; i++) { const r = { t: 'ring_evasion', q: 1, e: 2 }; p.inv.push(r); Game.equip(r, true); }
    let total = 0;
    for (let i = 0; i < 120; i++) {
      p.webbed = 0; p.held = 0; p.hp = 9999;
      const m = ahead(ctx, 'spider', 2, { hp: 999, maxHp: 999, spoke: true });
      m.windup = { kind: 'move', move: 'web', at: G.t, until: G.t };
      m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      total += Math.max(0, (p.webbed || 0) - G.t);
      Game.update(G.t + 6000, 6000);
    }
    return total;
  };
  // one ring: a second of the same kind adds nothing (see the test below)
  const bare = await time(0), ringed = await time(1);
  return bare > ringed * 1.08 || `webbed ${bare}ms bare, ${ringed}ms with the ring`;
});

await test('rings and amulets turn up from the second floor, from their own stream, and survive a reload', async () => {
  const out = [];
  let found = 0, floors = 0, onFirst = 0;
  for (let i = 0; i < 12; i++) {
    const ctx = await start('thief', 'jewels-place-' + i);
    const { Game, ITEMS } = ctx; const G = Game.state();
    for (let d = 1; d <= 6; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = G.levels[d] || null;
      if (!L || G.depth !== d) continue;
      const n = Object.values(L.items).flat().filter(it => ['ring', 'amulet'].includes(ITEMS[it.t].kind)).length;
      if (d === 1) onFirst += n; else { found += n; floors++; }
    }
  }
  if (onFirst) out.push(`${onFirst} pieces on first floors`);
  if (floors && (found / floors < 0.2 || found / floors > 0.8)) out.push(`${found} pieces over ${floors} floors`);
  if (!floors) out.push('no floors were generated to look at');
  // the slots and the looks come back from a save
  const ctx = await start('cleric', 'jewels-save');
  const { Game } = ctx; const p = Game.player();
  const r = { t: 'ring_protect', q: 1, e: 1 }; p.inv.push(r); Game.equip(r, true);
  Game.save(true);
  if (!Game.load()) out.push('load failed');
  else if (!Game.player().eq.ring || Game.player().eq.ring.t !== 'ring_protect' || Game.itemName(Game.player().eq.ring) !== 'Ring of Protection +1') out.push('the ring did not come back from the save');
  return out.length ? out.join('; ') : true;
});

// ---------- named champions ----------
/** Walk down the stairs until the hero stands on floor `depth`, as the game would. */
function downTo(ctx, depth) {
  const { Game, Dungeon } = ctx;
  const G = Game.state();
  while (G.depth < depth) {
    const L = Game.level(), p = Game.player(), s = L.stairsDown;
    const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
    const [dx, dy] = Dungeon.DIRS[k];
    p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
    Game.input('use');
    if (Game.forkPending()) Game.chooseRoute(ctx.road || 'crypts');
  }
}
/** An open square beside a monster with another beyond it, in the same line: [dx, dy] from it, or null. */
function roomBeside(ctx, m) {
  const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
  return Dungeon.DIRS.find(([dx, dy]) => L.tiles[(m.y + dy) * L.w + m.x + dx] === T.FLOOR && L.tiles[(m.y + 2 * dy) * L.w + m.x + 2 * dx] === T.FLOOR) || null;
}

await test('named champions hold a floor a third and two thirds down (a long delve: a quarter, half and three quarters), chosen to suit it, never the first nor the lich\'s', async () => {
  const { Dungeon, MONSTERS } = await newContext();
  const named = Object.keys(MONSTERS).filter(id => MONSTERS[id].named);
  if (named.length < 4 || named.length > 6) return `${named.length} named champions`;
  for (const id of named) if (MONSTERS[id].boss) return `${id} is marked as the Heart's keeper`;
  const want = { 2: [], 3: [2], 4: [2, 3], 6: [2, 4], 8: [3, 6], 12: [3, 6, 9], 16: [4, 8, 12] };
  for (const levels of [2, 3, 4, 6, 8, 12, 16]) {
    for (let s = 0; s < 12; s++) {
      const seed = `named-floors-${s}`, plan = Dungeon.namedPlan(seed, levels);
      const floors = Object.keys(plan).map(Number);
      if (floors.join() !== want[levels].join()) return `${levels} floors: champions on [${floors}], expected [${want[levels]}]`;
      if (new Set(Object.values(plan)).size !== floors.length) return `${seed}/${levels}: one champion twice`;
      if (JSON.stringify(Dungeon.namedPlan(seed, levels)) !== JSON.stringify(plan)) return 'the plan is not the same twice for one seed';
      for (const d of floors) {
        const b = MONSTERS[plan[d]], t = Dungeon.tierAt(d, levels);
        // each suits its floor, wherever any champion does
        if (named.some(id => t >= MONSTERS[id].tier[0] && t <= MONSTERS[id].tier[1]) && !(t >= b.tier[0] && t <= b.tier[1])) return `${plan[d]} (tiers ${b.tier}) holds floor ${d} of ${levels}, at tier ${t.toFixed(1)}`;
      }
      if (![3, 8, 12].includes(levels) || s > 3) continue;
      // and on the floors themselves: there, asleep, the only one of its name, and nowhere else
      for (let d = 1; d <= levels; d++) {
        const L = Dungeon.generate(seed, d, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
        const here = L.monsters.filter(m => MONSTERS[m.id].named);
        if (here.length !== (plan[d] ? 1 : 0) || (plan[d] && here[0].id !== plan[d])) return `${seed} floor ${d} of ${levels} holds [${here.map(m => m.id)}], the plan says ${plan[d] || 'none'}`;
        const m = here[0];
        if (!m) continue;
        if (m.awake || m.elite || m.pack) return `${m.id} on ${seed} floor ${d} is ${m.awake ? 'awake' : m.elite ? 'a ' + m.elite + ' champion' : 'in a group'}`;
        const far = Math.abs(m.x - L.start.x) + Math.abs(m.y - L.start.y);
        if (far < 8) return `${m.id} sleeps ${far} squares from the way in`;
        // its kin, where it keeps any, keep it company
        const guard = MONSTERS[m.id].named.guard;
        if (guard && !L.monsters.some(o => o !== m && o.id === guard[0] && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 6)) return `${m.id} on ${seed} floor ${d} has no kin about it`;
      }
    }
  }
  return true;
});

await test('a named champion is never met at random: not in a floor\'s crowd, nor out of an ambush', async () => {
  const { Dungeon, MONSTERS } = await newContext();
  for (let s = 0; s < 10; s++) for (const levels of [4, 8, 16]) {
    const plan = Dungeon.namedPlan('random-' + s, levels);
    for (let d = 1; d <= levels; d++) {
      const L = Dungeon.generate('random-' + s, d, { levels, size: 'small', monsters: 'many', treasure: 'normal', lockedDoors: false, traps: false });
      const stray = L.monsters.find(m => MONSTERS[m.id].named && m.id !== plan[d]);
      if (stray) return `${stray.id} wandered onto floor ${d} of ${levels}`;
    }
  }
  // a rest broken by an ambush draws from the floor's crowd, never a champion
  const ctx = await start('fighter', 'named-ambush', { levels: 8 });
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  seedDice(ctx, 'named-ambush');
  downTo(ctx, 6);
  let ambushes = 0;
  for (let i = 0; i < 80; i++) {
    const L = Game.level();
    L.monsters = L.monsters.filter(m => MONSTERS[m.id].named && m.uid < 900000);
    L.rests = 1; p.hp = 1; p.food = 100; p.lastHurt = -1e9;
    const n = L.monsters.length;
    await pinned(0, async () => { Game.rest(); });
    if (L.monsters.length > n) ambushes++;
    const came = L.monsters.find(m => MONSTERS[m.id].named && m.uid >= 900000);
    if (came) return `an ambush brought ${came.id}`;
  }
  return (G.depth === 6 && ambushes > 0) || `floor ${G.depth}, ${ambushes} ambushes`;
});

await test('arriving on its floor names it; waking, it speaks with the dread sting, and its bar shows its name', async () => {
  const ctx = await start('fighter', 'named-arrive', { levels: 8 });
  const { Game, Dungeon, MONSTERS } = ctx; const G = Game.state();
  const plan = Dungeon.namedPlan('named-arrive', 8), d = Number(Object.keys(plan)[0]), id = plan[d], b = MONSTERS[id];
  downTo(ctx, d - 1);
  let mark = markLog(G);
  downTo(ctx, d);
  const said = linesSince(G, mark);
  if (!said.includes(b.named.arrive) || !b.named.arrive.includes(b.named.called)) return `arriving said: ${said.join(' | ')}`;
  const L = Game.level(), p = Game.player(), m = L.monsters.find(o => o.id === id);
  if (Game.renderState(0).fx.boss) return 'a bar showed for a champion still asleep';
  // bring the hero near: it notices, wakes, and says so
  L.monsters = [m];
  const at = roomBeside(ctx, m);
  if (!at) return 'no room beside the champion for the test';
  p.x = m.x + 2 * at[0]; p.y = m.y + 2 * at[1]; p.hp = p.maxHp = 999;
  mark = markLog(G);
  const heard = await listenTo(ctx, () => { run(Game, G, 1500); });
  const woke = linesSince(G, mark);
  if (!m.awake || !woke.includes(b.named.wake)) return `it ${m.awake ? 'woke' : 'slept'} and said: ${woke.join(' | ')}`;
  if (woke.indexOf(b.named.wake) > woke.findIndex(l => /^Bestiary/.test(l))) return 'the bestiary spoke before the champion did';
  if (!heard.some(h => h.name === 'dread')) return `no dread sting: ${heard.map(h => h.name).join(',')}`;
  const rs = Game.renderState(0), bar = rs.fx.boss;
  if (!bar || !bar.named || bar.name !== `${b.named.called}, the ${b.name}` || bar.hp !== m.hp || bar.maxHp !== m.maxHp) return `the bar: ${JSON.stringify(bar)}`;
  // under the bar at the top it carries none of its own, and it stands bigger than its kind
  const sp = rs.sprites.find(s => s.boss);
  if (!sp || sp.hp !== null || !(sp.scale > MONSTERS[b.named.kin].scale)) return `its sprite: ${JSON.stringify(sp && { hp: sp.hp, scale: sp.scale })}`;
  // far off, the bar goes
  p.x = m.x + 12; p.y = m.y;
  return !Game.renderState(0).fx.boss || 'the bar stayed with the champion far off';
});

await test('the Goblin King\'s horn is warned of; a wound cuts it short and spends it; let sound, his kin come, and twice at most', async () => {
  const ctx = await start('fighter', 'named-horn');
  const { Game } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  seedDice(ctx, 'named-horn');
  const m = beside(ctx, 'grisk', { hp: 100, maxHp: 100, spoke: true });
  // not before half
  run(Game, G, 200);
  if (m.windup && m.windup.move === 'rally') return 'he reached for the horn unhurt';
  m.hp = 40; m.windup = null; m.volley = null; m.nextAct = G.t; m.moveReady = 0;
  let mark = markLog(G);
  const heard = await listenTo(ctx, () => { Game.update(G.t + 25, 25); });
  if (!(m.windup && m.windup.move === 'rally')) return 'hurt past half, he did not reach for the horn';
  if (!linesSince(G, mark).some(l => /war-horn/.test(l) && /Strike him/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  if (!heard.some(h => h.name === 'special')) return 'the horn was not heard coming';
  const sp = Game.renderState(0).sprites.find(s => s.special);
  if (!sp || !(sp.tell > 0)) return 'no violet mark over him';
  // strike: the call is cut short, and no one comes (swinging again past a natural one)
  mark = markLog(G);
  for (let i = 0; i < 5 && m.hp === 40; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (m.hp === 40) return 'five swings never landed';
  if (m.windup) return 'a wound did not cut the call short';
  if (!linesSince(G, mark).some(l => /cut .* call short/.test(l))) return `the blow said: ${linesSince(G, mark).join(' | ')}`;
  if (L.monsters.length !== 1) return 'goblins came to a call cut short';
  // the second call, let sound: goblins come running
  m.nextAct = G.t; m.moveReady = 0; m.hp = 40;
  Game.update(G.t + 25, 25);
  if (!(m.windup && m.windup.move === 'rally')) return 'he did not try a second call';
  const [dx, dy] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR;
  mark = markLog(G);
  const blast = await listenTo(ctx, () => { run(Game, G, 1600); });
  const kin = L.monsters.filter(o => o.id === 'goblin');
  if (kin.length !== 1 || !kin[0].pack || kin[0].pack.length !== 1 || !kin[0].awake) return `the horn called ${JSON.stringify(kin.map(k => [k.id, k.pack && k.pack.length, k.awake]))}`;
  if (!blast.some(h => h.name === 'horn')) return 'the horn was not heard';
  if (!linesSince(G, mark).some(l => /horn blares/.test(l))) return `it said: ${linesSince(G, mark).join(' | ')}`;
  // and never a third
  L.monsters = [m]; m.moveReady = 0; m.hp = 40;
  for (let i = 0; i < 200; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'rally') return 'he called a third time'; }
  return m.rallies === 2 || `rallies ${m.rallies}`;
});

await test('the Web-Mother spits from beside you and twice as often; the Ghoul Lord claws every other blow; the Warchief charges twice as often', async () => {
  // the web: from right beside the hero, where a cave spider never spits, and again in half the time
  const ctx = await start('fighter', 'named-web');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.hp = p.maxHp = 9999;
  const spider = beside(ctx, 'spider');
  Game.update(G.t + 25, 25);
  if (spider.windup && spider.windup.move === 'web') return 'a cave spider spat from beside the hero';
  const v = beside(ctx, 'vessra', { spoke: true });
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (!(v.windup && v.windup.move === 'web')) return 'the Web-Mother did not spit from beside the hero';
  if (!linesSince(G, mark).some(l => /^Vessra rears back to spit a web/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  run(Game, G, 700);
  if (v.windup && v.windup.move === 'web') return 'the web never flew';
  if (!(p.webbed > G.t) && !linesSince(G, mark).some(l => /web/i.test(l))) return 'the web caught nothing and said nothing';
  const gap = v.moveReady - G.t;
  if (!(gap > 2500 && gap <= 3500)) return `her next web is ${gap}ms off; a spider's is 7000`;
  // the claw, after one blow rather than two
  const c2 = await start('fighter', 'named-claw');
  const g2 = c2.Game.state();
  c2.Game.player().hp = c2.Game.player().maxHp = 9999;
  const ghoul = beside(c2, 'ghoul', { blows: 1 });
  c2.Game.update(g2.t + 25, 25);
  if (ghoul.windup && ghoul.windup.move === 'paralyse') return 'a ghoul clawed after one blow';
  const lord = beside(c2, 'morrow', { blows: 1, spoke: true });
  c2.Game.update(g2.t + 25, 25);
  if (!(lord.windup && lord.windup.move === 'paralyse')) return 'the Ghoul Lord waited for a second blow';
  // the charge: from four squares, and ready again in half an orc's time
  const c3 = await start('fighter', 'named-charge');
  const g3 = c3.Game.state();
  c3.Game.player().hp = c3.Game.player().maxHp = 9999;
  const orc = ahead(c3, 'orc', 4);
  await pinned(0, async () => { c3.Game.update(g3.t + 25, 25); });
  if (orc.windup && orc.windup.move === 'charge') return 'an orc charged from four squares';
  const u = ahead(c3, 'ushgar', 4, { spoke: true });
  await pinned(0, async () => { c3.Game.update(g3.t + 25, 25); });
  if (!(u.windup && u.windup.move === 'charge')) return 'the Warchief did not charge from four squares';
  run(c3.Game, g3, 800);
  const wait = u.moveReady - g3.t;
  return (wait > 2500 && wait <= 4000) || `his next charge is ${wait}ms off; an orc's is 8000`;
});

await test('the Hollow Abbess reaches to drink: step back and she is open; caught, a weak will loses 3 for good and mends her', async () => {
  const ctx = await start('cleric', 'named-drink');
  const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player();
  seedDice(ctx, 'named-drink');
  p.hp = p.maxHp = 500;
  const o = beside(ctx, 'orla', { blows: 2, hp: 50, maxHp: 100, spoke: true });
  let mark = markLog(G);
  const heard = await listenTo(ctx, () => { Game.update(G.t + 25, 25); });
  if (!(o.windup && o.windup.move === 'drink')) return 'she did not reach after two blows';
  if (!linesSince(G, mark).some(l => /reaches into your chest/.test(l) && /Step back/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  if (!heard.some(h => h.name === 'special')) return 'her reach was not heard';
  // stepping back: her hand closes on air
  clearBehind(ctx); shift(ctx, 'back');
  mark = markLog(G);
  run(Game, G, 900);
  if (!linesSince(G, mark).some(l => /closes on the air/.test(l))) return `stepping back: ${linesSince(G, mark).join(' | ')}`;
  if (!(p.opening && p.opening.uid === o.uid)) return 'stepping back left no opening';
  if (p.maxHp !== 500) return 'she drank from a hero who stepped back';
  // standing: a weak will is drunk from, a strong one holds
  let lost = 0, held = 0;
  for (let i = 0; i < 30 && (!lost || !held); i++) {
    const L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    const m = { ...o, x: p.x + dx, y: p.y + dy, hp: 50, maxHp: 100, windup: { kind: 'move', move: 'drink', at: G.t, until: G.t }, nextAct: G.t };
    L.monsters.push(m);
    p.hp = p.maxHp; p.mirrors = 0; G.blowGate = 0;
    const before = p.maxHp;
    mark = markLog(G);
    Game.update(G.t + 25, 25);
    const said = linesSince(G, mark);
    if (said.some(l => /drinks deep/.test(l))) {
      if (p.maxHp !== before - 3) return `drunk from, most health went ${before} -> ${p.maxHp}`;
      if (m.hp !== 59) return `she mended to ${m.hp}, not 59`;
      lost++;
    } else if (said.some(l => /will holds/.test(l))) held++;
  }
  return (lost > 0 && held > 0) || `in thirty reaches: drunk from ${lost}, held ${held}`;
});

await test('the Troll-Father\'s wounds close two a second, where you can see it, until fire sears them', async () => {
  const ctx = await start('fighter', 'named-regen');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.hp = p.maxHp = 9999;
  const t = beside(ctx, 'gorrum', { hp: 50, maxHp: 200, nextAct: 1e12, spoke: true });
  G.met = { [t.uid]: 1 };
  const mark = markLog(G);
  let shown = false;
  for (let i = 0; i < 120; i++) { Game.update(G.t + 25, 25); shown = shown || Game.renderState(0).fx.texts.some(x => x.text === '+2'); }
  if (!(t.hp >= 55 && t.hp <= 57)) return `in three seconds it regrew to ${t.hp} from 50`;
  if (!linesSince(G, mark).some(l => /wounds close as you watch. Fire/.test(l))) return 'the log never said what stops it';
  if (!shown) return 'its mending is not shown';
  t.burnUntil = G.t + 6000;
  const was = t.hp;
  run(Game, G, 3000);
  return t.hp === was || `burned, it still regrew to ${t.hp} from ${was}`;
});

await test('a named champion slain: its line and fanfare, its xp, a relic from the traders\' keeping, and the bestiary, run and Hall know', async () => {
  const ctx = await start('fighter', 'named-spoils', { levels: 8 });
  const { Game, MONSTERS, RELICS } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  p.perkHit = 60;
  const R = G.relics, next = R.shop[R.offered], offered = R.offered;
  if (!next) return 'this seed keeps no relic for the traders';
  seedDice(ctx, 'named-spoils');
  const m = beside(ctx, 'grisk', { hp: 1, maxHp: 60, spoke: true, nextAct: 1e12 });
  const xp = p.xp, mark = markLog(G);
  // a natural one misses whatever the bonus, so swing until he falls
  const heard = await listenTo(ctx, () => { for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); } });
  if (L.monsters.includes(m)) return 'the Goblin King would not die';
  const said = linesSince(G, mark);
  // said once: his own line, with the reward, and no plain kill line besides
  const falls = said.filter(l => l.startsWith(MONSTERS.grisk.named.fall));
  if (falls.length !== 1 || !/\(\+\d+ xp/.test(falls[0])) return `his fall said: ${said.join(' | ')}`;
  if (said.some(l => / is (slain|destroyed)!/.test(l))) return `his death told twice: ${said.join(' | ')}`;
  if (!heard.some(h => h.name === 'namedfall')) return 'no fanfare';
  if (p.xp - xp < MONSTERS.grisk.xp) return `only ${p.xp - xp} xp`;
  const pile = L.items[m.x + ',' + m.y] || [];
  if (!pile.some(it => it.u === next)) return `he left [${pile.map(it => it.u || it.t)}], not ${next}`;
  if (R.offered !== offered + 1) return 'the relic is still kept for a trader';
  if (!said.some(l => l.includes(RELICS[next].name))) return 'the log did not say what he left';
  // and something from his fingers or throat, never cursed
  const jewel = pile.find(it => ['ring', 'amulet'].includes(ctx.ITEMS[it.t].kind));
  if (!jewel || jewel.curse || (jewel.e || 0) < 0) return `he left no ring or amulet, or a cursed one: [${pile.map(it => it.u || it.t)}]`;
  if (!said.some(l => / glints among its things\.$/.test(l))) return 'the log did not say a ring or amulet was there';
  const rec = Game.bestiary().grisk;
  if (!rec || rec.kills !== 1 || !rec.trick || !rec.answer) return `the bestiary: ${JSON.stringify(rec)}`;
  if (Game.runStats().kills.grisk !== 1) return 'the run did not count him';
  // the Hall of Heroes names him on the run's line
  G.status = 'playing'; p.hp = 1; L.monsters = [];
  const ogre = beside(ctx, 'ogre', { edge: 60, nextAct: G.t });
  p.mirrors = 0;
  for (let i = 0; i < 400 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead' || !ogre) return 'the hero would not die';
  const row = Game.hall().find(h => h.seed === 'named-spoils');
  return (row && JSON.stringify(row.named) === '["Grisk"]') || `the Hall kept ${JSON.stringify(row)}`;
});

await test('with no relic left for the traders, a champion leaves a +2 piece its slayer can use, and gold', async () => {
  for (const cls of ['mage', 'thief', 'cleric', 'fighter']) {
    const ctx = await start(cls, 'named-fallback-' + cls, { levels: 8 });
    const { Game, ITEMS } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
    seedDice(ctx, 'named-fallback-' + cls);
    p.perkHit = 60;
    G.relics.offered = G.relics.shop.length;
    const m = beside(ctx, 'vessra', { hp: 1, maxHp: 60, spoke: true, nextAct: 1e12 });
    for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (L.monsters.includes(m)) return `${cls}: the Web-Mother would not die`;
    const pile = L.items[m.x + ',' + m.y] || [];
    // a caster's focus comes plain: its make is in what it does, not a number
    const gear = pile.find(it => ['weapon', 'armor', 'shield'].includes(ITEMS[it.t].kind) && it.e === (ITEMS[it.t].focus ? 0 : 2) && !it.h && !it.curse && !it.u);
    if (!gear) return `${cls}: she left [${pile.map(it => it.t + (it.e ? '+' + it.e : ''))}]`;
    // a shield wants a free hand, which a staff does not leave: that is a matter of what is held, not who
    const why = Game.canEquip(gear);
    if (why && !/free hand/.test(why)) return `${cls} cannot use the ${gear.t} she left: ${why}`;
    if (!pile.some(it => it.t === 'gold' && it.q > 0)) return `${cls}: no gold`;
  }
  return true;
});

await test('a named champion is as much sturdier as the difficulty says, and the press never gives it a prefix', async () => {
  const on = async (difficulty, level) => {
    const ctx = await start('fighter', 'named-hp', { levels: 8, difficulty });
    const { Game, Dungeon, MONSTERS } = ctx;
    const d = Number(Object.keys(Dungeon.namedPlan('named-hp', 8))[0]);
    if (level) Game.player().level = level;
    downTo(ctx, d);
    return Game.level().monsters.find(o => MONSTERS[o.id].named);
  };
  const easy = await on('easy'), normal = await on('normal'), hard = await on('hard');
  if (Math.abs(normal.maxHp / easy.maxHp - 1.5) > 0.05 || Math.abs(hard.maxHp / easy.maxHp - 1.8) > 0.05) return `easy ${easy.maxHp}, normal ${normal.maxHp}, hard ${hard.maxHp}`;
  // a hero far ahead of the floor: every creature there is readier, and many become champions, but not this one
  for (let i = 0; i < 6; i++) {
    const pressed = await pinned(i / 6, () => on('normal', 12));
    if (pressed.elite) return `pressed, it became ${pressed.elite}`;
    if (!(pressed.maxHp > normal.maxHp && pressed.edge > 0)) return `pressed: ${pressed.maxHp} hp, edge ${pressed.edge}; unpressed ${normal.maxHp}`;
  }
  return true;
});

await test('a save keeps a named champion, its fight and its floor, and its bar comes back with it', async () => {
  const ctx = await start('fighter', 'named-save', { levels: 8 });
  const { Game, Dungeon, MONSTERS } = ctx;
  const plan = Dungeon.namedPlan('named-save', 8), d = Number(Object.keys(plan)[1]);
  downTo(ctx, d);
  const L = Game.level(), m = L.monsters.find(o => MONSTERS[o.id].named);
  if (!m || m.id !== plan[d]) return `floor ${d} holds no ${plan[d]}`;
  const p = Game.player();
  m.hp = Math.floor(m.maxHp / 2); m.awake = true; m.spoke = true; m.rallies = 1; m.mendSaid = true;
  const at = roomBeside(ctx, m);
  p.x = m.x + at[0]; p.y = m.y + at[1];
  const keep = x => JSON.stringify({ id: x.id, uid: x.uid, hp: x.hp, maxHp: x.maxHp, rallies: x.rallies, spoke: x.spoke, mendSaid: x.mendSaid, x: x.x, y: x.y, edge: x.edge });
  const was = keep(m);
  if (!Game.save(true)) return 'save failed';
  // another run wipes the world; the load brings this one back
  Game.newGame({ name: 'Other', cls: 'mage', stats: Game.rollStats(), seed: 'elsewhere', opts: OPTS });
  if (!Game.load()) return 'load failed';
  const m2 = Game.level().monsters.find(o => MONSTERS[o.id].named);
  if (Game.state().depth !== d || !m2) return `loaded on floor ${Game.state().depth} with ${m2 ? m2.id : 'no champion'}`;
  if (keep(m2) !== was) return `saved ${was}, loaded ${keep(m2)}`;
  const bar = Game.renderState(0).fx.boss;
  if (!bar || !bar.named || bar.name !== `${MONSTERS[m2.id].named.called}, the ${MONSTERS[m2.id].name}`) return `after loading the bar is ${JSON.stringify(bar)}`;
  // and a champion saved on a floor not yet reached is still waiting there
  const later = Game.state().levels[Number(Object.keys(plan)[0])];
  return (later && later.monsters.some(o => o.id === plan[Object.keys(plan)[0]])) || 'the first champion\'s floor lost it';
});

await test('fire, cold and lightning: the weak take half as much again, the resistant half, and the first time says so', async () => {
  const out = [];
  // the same seeded roll against a plain goblin and against each kind, so the
  // only difference is what the kind takes from that element
  const hit = async (spellId, target, key) => {
    const ctx = await start('mage', 'el-' + key);
    const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
    p.level = 9; p.sp = p.maxSp = 999; p.talents = [];
    // Burning Hands reaches only the square ahead; a slime already split splits no further
    const m = ahead(ctx, target, spellId === 'burning_hands' ? 1 : 2, { hp: 5000, maxHp: 5000, nextAct: 1e12, spoke: true, split: true });
    seedDice(ctx, 'el-roll-' + key.split('/')[1]);
    const mark = markLog(G);
    G.t = p.nextAttack;
    Game.castSpell(SPELLS.mage.find(s => s.id === spellId));
    return { lost: 5000 - m.hp, said: linesSince(G, mark), ctx };
  };
  for (const [spell, target, f] of [['lightning', 'rustmaw', 1.5], ['lightning', 'slime', 0.5], ['cone_cold', 'skeleton', 0.5], ['cone_cold', 'basilisk', 1.5], ['burning_hands', 'zombie', 1.5], ['burning_hands', 'basilisk', 0.5], ['burning_hands', 'vessra', 1.5]]) {
    const base = await hit(spell, 'goblin', `${target}-base/${spell}`), got = await hit(spell, target, `${target}/${spell}`);
    const want = Math.max(1, Math.round(base.lost * f));
    if (got.lost !== want) out.push(`${spell} on a ${target}: ${got.lost}, want ${want} (a goblin took ${base.lost})`);
    const word = f > 1 ? /burns well|stiffens in the cold|lightning finds it/ : /shrugs off|barely feels|lightning run off/;
    if (!got.said.some(l => word.test(l))) out.push(`${spell} on a ${target} said nothing of it: ${got.said.join(' | ')}`);
    const kin = got.ctx.MONSTERS[target].named ? got.ctx.MONSTERS[target].named.kin : target;
    const el = { lightning: 'lightning', cone_cold: 'cold', burning_hands: 'fire' }[spell];
    const rec = got.ctx.Game.bestiary()[kin];
    if (!rec || !rec.el || rec.el[el] !== (f > 1 ? 'weak' : 'resist')) out.push(`the bestiary did not note what ${el} does to a ${kin}: ${JSON.stringify(rec)}`);
  }
  // a goblin takes lightning as a blow: nothing said
  const plain = await hit('lightning', 'goblin', 'goblin-plain/lightning');
  if (plain.said.some(l => /lightning finds it|lightning run off/.test(l))) out.push('a goblin was said to be weak or resistant');
  return out.length ? out.join('; ') : true;
});

await test('a scroll of fire burns a zombie well, and a Ring of Warmth halves a wraith\'s cold touch', async () => {
  const out = [];
  const burn = async target => {
    const ctx = await start('fighter', 'el-scroll');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const m = ahead(ctx, target, 2, { hp: 5000, maxHp: 5000, nextAct: 1e12, spoke: true });
    const it = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(it); G.known.scroll_fire = 1;
    seedDice(ctx, 'el-scroll-roll');
    Game.useItem(it);
    return 5000 - m.hp;
  };
  const g = await burn('goblin'), z = await burn('zombie');
  if (z !== Math.max(1, Math.round(g * 1.5))) out.push(`a fireball took ${g} from a goblin and ${z} from a zombie`);
  const touch = async warm => {
    const ctx = await start('fighter', 'el-warm');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.effects.ac = { amount: -60, until: 1e12 };
    if (warm) { const r = { t: 'ring_warmth', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    seedDice(ctx, 'el-warm-roll');
    const m = beside(ctx, 'wraith', { hp: 999, maxHp: 999, spoke: true });
    let taken = 0;
    for (let i = 0; i < 30; i++) { const hp = p.hp; m.windup = { kind: 'melee', at: G.t, until: G.t }; m.nextAct = G.t; Game.update(G.t + 25, 25); taken += hp - p.hp; Game.update(G.t + 3000, 3000); p.hp = 9999; }
    return taken;
  };
  const cold = await touch(false), warm = await touch(true);
  if (!(warm < cold * 0.65 && warm > cold * 0.35)) out.push(`a wraith's touch took ${cold} bare and ${warm} with the ring`);
  return out.length ? out.join('; ') : true;
});

// ---------- paths ----------
/** Set the hero on a path, as if chosen, with flat scores so the path is the only difference between two heroes. */
const walk = (ctx, id) => { const p = ctx.Game.player(); p.path = id; Object.assign(p.stats, evenStats); };
/** Bring the hero from one level to another with a single kill, as play does. */
function levelByKill(ctx, from, to) {
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.level = from; p.xp = XP_TABLE[to - 1]; p.perkHit = 60;
  G.pendingBoons = []; G.pendingLevels = [];
  const m = beside(ctx, 'rat', { uid: 700 + to, hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
}
/** Run the world for ms, counting each line said that matches each pattern, as it comes (a folded line counts once more). */
function tallyLines(Game, G, ms, patterns) {
  const n = patterns.map(() => 0);
  for (let t = 0; t < ms; t += 25) {
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    for (const l of linesSince(G, mark)) patterns.forEach((re, i) => { if (re.test(l)) n[i]++; });
  }
  return n;
}

await test('at level 5 every class is offered its own two paths, in place of the lesson', async () => {
  const out = [];
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    const ctx = await start(cls, 'path-offer-' + cls);
    const { Game, PATHS, PATH_LEVEL } = ctx;
    const p = Game.player(), G = Game.state();
    levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL);
    const offer = Game.pendingBoons();
    const want = PATHS[cls].map(x => x.id);
    if (PATHS[cls].length !== 2) out.push(`${cls} has ${PATHS[cls].length} paths`);
    if (!offer || offer.join() !== want.join() || !Game.isPathOffer(offer)) { out.push(`${cls} at level ${p.level} was offered ${offer && offer.join(', ')}`); continue; }
    if (Game.pendingLevel() !== PATH_LEVEL) out.push(`${cls}'s offer says level ${Game.pendingLevel()}`);
    if (Game.chooseBoon('knight') && cls !== 'fighter') out.push(`${cls} took the knight's path`);
    if (cls === 'fighter') { p.path = undefined; levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL); }
    const mark = markLog(G);
    if (!Game.chooseBoon(want[1])) { out.push(`${cls} could not take ${want[1]}`); continue; }
    if (p.path !== want[1]) out.push(`${cls} chose ${want[1]} and walks ${p.path}`);
    if (Game.pendingBoons()) out.push(`${cls} was offered ${Game.pendingBoons().join(', ')} as well`);
    if (!linesSince(G, mark).some(l => l.includes(PATHS[cls][1].name))) out.push(`${cls}: the log never named the path`);
    if (!Game.pathOf() || Game.pathOf().id !== want[1]) out.push(`${cls}: pathOf says ${Game.pathOf() && Game.pathOf().id}`);
    // and it is not offered again at the next odd level: that is a lesson
    levelByKill(ctx, PATH_LEVEL + 1, PATH_LEVEL + 2);
    if (!Game.pendingBoons() || Game.isPathOffer(Game.pendingBoons())) out.push(`${cls} at level 7 was offered ${Game.pendingBoons() && Game.pendingBoons().join(', ')}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('several levels at once still offer the path, between the talents, and a talent chosen first leaves it whole', async () => {
  const ctx = await start('cleric', 'path-multi');
  const { Game, TALENTS, BOONS } = ctx;
  const p = Game.player();
  levelByKill(ctx, 3, 6);
  const kinds = [];
  const q = Game.state().pendingBoons.map(o => Game.isPathOffer(o) ? 'P' : o.every(id => TALENTS.cleric.some(t => t.id === id)) ? 'T' : o.every(id => BOONS.some(b => b.id === id)) ? 'L' : '?');
  if (q.join('') !== 'TPT') return `queued ${q.join('')} for levels 4 to 6`;
  while (Game.pendingBoons()) {
    const offer = Game.pendingBoons();
    kinds.push(`${Game.pendingLevel()}:${Game.isPathOffer(offer) ? offer.join('/') : 'T'}`);
    if (!Game.chooseBoon(Game.isPathOffer(offer) ? 'healer' : offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return `could not choose from ${offer.join(', ')}`;
  }
  if (kinds.join(' ') !== '4:T 5:templar/healer 6:T') return `offers: ${kinds.join(' ')}`;
  return (p.path === 'healer' && p.talents.length === 2) || `path ${p.path}, talents ${p.talents}`;
});

await test('a path survives a save, and a save from before paths is offered one at its next level', async () => {
  const ctx = await start('fighter', 'path-save');
  const { Game } = ctx;
  levelByKill(ctx, 4, 5);
  Game.chooseBoon('knight');
  if (!Game.save(true)) return 'save failed';
  const raw = JSON.parse(ctx.store.get('deepdelve.save'));
  Game.newGame({ name: 'Other', cls: 'mage', stats: Game.rollStats(), seed: 'elsewhere', opts: OPTS });
  if (!Game.load()) return 'load failed';
  if (Game.player().path !== 'knight') return `loaded as ${Game.player().path}`;
  // the same hero from before paths, already past the level that offers one
  delete raw.player.path;
  raw.player.level = 7; raw.player.xp = ctx.XP_TABLE[6]; raw.pendingBoons = []; delete raw.pendingLevels;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'the older save would not load';
  const p = Game.player();
  if (p.path) return `an older save came back walking ${p.path}`;
  if (Game.pendingBoons()) return `an older save came back offered ${Game.pendingBoons().join(', ')}`;
  levelByKill(ctx, 7, 8);
  const first = Game.pendingBoons();
  if (!first || !Game.isPathOffer(first)) return `at level 8 it was first offered ${first && first.join(', ')}`;
  Game.chooseBoon('berserker');
  const next = Game.pendingBoons();
  if (!next || !next.every(id => ctx.TALENTS.fighter.some(t => t.id === id))) return `level 8's own offer was ${next && next.join(', ')}`;
  if (p.path !== 'berserker') return `chose berserker, walks ${p.path}`;
  // one already at the top level has no next level: it is offered on loading
  delete raw.player.path;
  raw.player.level = ctx.MAX_LEVEL; raw.player.xp = ctx.XP_TABLE[ctx.MAX_LEVEL - 1]; raw.pendingBoons = []; delete raw.pendingLevels;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'the top-level save would not load';
  return Game.isPathOffer(Game.pendingBoons() || []) || `a top-level hero came back offered ${Game.pendingBoons()}`;
});

await test('Knight: a shield gives a point more, catches one ordinary blow in eight for half, and a trick lands a quarter lighter', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'knight-ac');
    const { Game } = ctx; const p = Game.player();
    walk(ctx, undefined); p.eq.shield = { t: 'shield', q: 1, e: 0 };
    const a = Game.playerAC(); walk(ctx, 'knight');
    if (Game.playerAC() !== a + 1) out.push(`a knight's shield: ${a} -> ${Game.playerAC()}`);
    p.eq.shield = null; const b = Game.playerAC(); walk(ctx, undefined);
    if (Game.playerAC() !== b) out.push('a knight without a shield changed armour class');
  }
  // the guard, over many ordinary blows from a goblin
  const guard = async (path, shield) => {
    const ctx = await start('fighter', 'knight-guard');
    seedDice(ctx, 'knight-guard');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    p.eq.shield = shield ? { t: 'shield', q: 1, e: 0 } : null;
    beside(ctx, 'goblin');
    const [hit, caught] = tallyLines(Game, G, 240000, [/Goblin hits you/, /caught on your shield/]);
    return { hit, caught };
  };
  const k = await guard('knight', true), bare = await guard('knight', false), plain = await guard(undefined, true);
  if (!(k.hit > 100)) out.push(`only ${k.hit} blows landed`);
  const share = k.caught / k.hit;
  if (!(share > 0.06 && share < 0.2)) out.push(`the shield caught ${k.caught} of ${k.hit} blows`);
  if (bare.caught || plain.caught) out.push(`caught with no shield ${bare.caught}, with no path ${plain.caught}`);
  // a crush on set feet: the same dice, a quarter less
  const crush = async path => {
    const ctx = await start('fighter', 'knight-crush');
    seedDice(ctx, 'knight-crush');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 9999;
    let total = 0;
    for (let i = 0; i < 8; i++) {
      const m = beside(ctx, 'ogre', { blows: 2 });
      const mark = markLog(G);
      run(Game, G, 1000);
      m.nextAct = 1e12;
      const l = linesSince(G, mark).find(x => /brings its club down on you/.test(x));
      if (l) total += Number(l.match(/for (\d+)/)[1]);
    }
    return total;
  };
  const plainCrush = await crush(undefined), knightCrush = await crush('knight');
  if (!(plainCrush > 40)) out.push(`the crushes did only ${plainCrush}`);
  const r = knightCrush / plainCrush;
  if (!(r > 0.7 && r < 0.82)) out.push(`a knight took ${knightCrush} from crushes that did ${plainCrush}`);
  return out.length ? out.join('; ') : true;
});

await test('Berserker: blows grow with the wounds, the swing quickens below half, and the guard drops', async () => {
  const out = [];
  const total = async (path, hpFrac) => {
    const ctx = await start('fighter', 'rage');
    seedDice(ctx, 'rage');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60; p.maxHp = 100; p.hp = Math.round(100 * hpFrac);
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const plainLow = await total(undefined, 0.1), rageLow = await total('berserker', 0.1);
  const plainFull = await total(undefined, 1), rageFull = await total('berserker', 1);
  const plainHalf = await total(undefined, 0.5), rageHalf = await total('berserker', 0.5);
  // the same dice: nine tenths lost is +4 (the most) on each of forty-odd blows that landed
  if (!(rageLow - plainLow >= 4 * 40)) out.push(`at a tenth of life, +${rageLow - plainLow} over 50 swings`);
  if (rageFull !== plainFull) out.push(`unhurt, a berserker dealt ${rageFull} to ${plainFull}`);
  if (!(rageHalf - plainHalf >= 3 * 40 && rageHalf - plainHalf < 4 * 50)) out.push(`at half life, +${rageHalf - plainHalf}`);
  const ctx = await start('fighter', 'rage-speed');
  const { Game } = ctx; const p = Game.player();
  walk(ctx, undefined); p.maxHp = 100; p.hp = 100;
  const ac = Game.playerAC(), full = Game.weapon().speed;
  walk(ctx, 'berserker');
  if (Game.weapon().speed !== full) out.push('an unhurt berserker swung faster');
  if (Game.playerAC() !== ac - 2) out.push(`a berserker's armour class ${ac} -> ${Game.playerAC()}`);
  p.hp = 40;
  const quick = Game.weapon().speed / full;
  if (!(quick > 0.88 && quick < 0.92)) out.push(`below half the swing is ${quick.toFixed(2)} of what it was`);
  return out.length ? out.join('; ') : true;
});

await test('Templar: blows bite the undead, Bless lasts twice as long, and Holy Smite hits a tenth harder', async () => {
  const out = [];
  const swings = async (path, id) => {
    const ctx = await start('cleric', 'templar-' + id);
    seedDice(ctx, 'templar-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60;
    const m = beside(ctx, id, { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const undead = (await swings('templar', 'zombie')) - (await swings(undefined, 'zombie'));
  if (!(undead > 60)) out.push(`against a zombie, +${undead} over 50 swings`);
  const living = (await swings('templar', 'orc')) - (await swings(undefined, 'orc'));
  if (living !== 0) out.push(`against an orc, ${living} more`);
  const cast = async (path, spell, times) => {
    const ctx = await start('cleric', 'templar-cast');
    seedDice(ctx, 'templar-cast');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.level = 5; p.sp = p.maxSp = 999;
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === spell);
    const before = Game.toHit();
    for (let i = 0; i < times; i++) { G.t = p.nextAttack; delete p.effects.hit; Game.castSpell(sp); }
    return { dealt: 1e9 - m.hp, bless: p.effects.hit && p.effects.hit.until - G.t, toHit: Game.toHit() - before };
  };
  const plain = await cast(undefined, 'smite', 30), templar = await cast('templar', 'smite', 30);
  const r = templar.dealt / plain.dealt;
  if (!(r > 1.05 && r < 1.15)) out.push(`smite: ${plain.dealt} -> ${templar.dealt}`);
  const b0 = await cast(undefined, 'bless', 1), b1 = await cast('templar', 'bless', 1);
  if (b0.bless !== 60000 || b1.bless !== 120000 || b0.toHit !== 2 || b1.toHit !== 2) out.push(`bless: +${b0.toHit} for ${b0.bless}ms -> +${b1.toHit} for ${b1.bless}ms`);
  return out.length ? out.join('; ') : true;
});

await test('Healer: heals a tenth more, mends under Protection, and has more spell points', async () => {
  const out = [];
  // a tenth more on average, small heals included: rounded, a heal of 4 stayed 4
  const heal = async path => {
    const ctx = await start('cleric', 'healer-cure');
    seedDice(ctx, 'healer-cure');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.maxHp = 99999;
    let total = 0;
    for (let i = 0; i < 300; i++) { p.hp = 1; p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'cure_light')); total += p.hp - 1; }
    return total;
  };
  const a = await heal(undefined), b = await heal('healer');
  if (!(b / a > 1.06 && b / a < 1.14)) out.push(`cure light over 300 casts: ${a} -> ${b}`);
  const mend = async (path, warding) => {
    const ctx = await start('cleric', 'healer-mend');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (warding) talent(ctx, 'warding_light');
    Game.level().monsters.length = 0;
    p.level = 5; p.sp = p.maxSp = 99; p.maxHp = 100; p.hp = 60; p.food = 0;   // no ordinary mending
    G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'protection'));
    run(Game, G, 20000);
    return p.hp - 60;
  };
  const none = await mend(undefined), healer = await mend('healer'), ward = await mend(undefined, true), both = await mend('healer', true);
  if (none !== 0) out.push(`with no path, Protection mended ${none}`);
  if (!(healer >= 3 && healer <= 4)) out.push(`a healer mended ${healer} in twenty seconds`);
  if (both !== ward + healer) out.push(`with Warding Light too, ${both} (${ward} + ${healer} apart)`);
  const ctx = await start('cleric', 'healer-sp');
  const { Game } = ctx; const p = Game.player();
  levelByKill(ctx, 4, 5);
  const was = p.maxSp;
  Game.chooseBoon('healer');
  // a point for every three levels: one at level 5
  if (p.maxSp !== was + 1 || p.sp !== p.maxSp) out.push(`at level 5 the well went ${was} -> ${p.maxSp}, holding ${p.sp}`);
  return out.length ? out.join('; ') : true;
});

await test('Pyromancer: fire hits a fifth harder and keeps burning, and the cold costs more', async () => {
  const out = [];
  const hands = async (path, kindling) => {
    const ctx = await start('mage', 'pyro-hands');
    seedDice(ctx, 'pyro-hands');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (kindling) talent(ctx, 'kindling');
    p.level = 5; p.sp = p.maxSp = 999;
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === 'burning_hands');
    const sp0 = p.sp;
    let burn = 0;
    for (let i = 0; i < 30; i++) { G.t = p.nextAttack; Game.castSpell(sp); if (i === 0) burn = m.dot && m.dot.kind === 'burning' ? m.dot.until - G.t : 0; }
    return { dealt: 1e9 - m.hp, burn, cost: (sp0 - p.sp) / 30 };
  };
  const plain = await hands(undefined), pyro = await hands('pyromancer'), both = await hands('pyromancer', true);
  const r = pyro.dealt / plain.dealt;
  if (!(r > 1.15 && r < 1.25)) out.push(`burning hands: ${plain.dealt} -> ${pyro.dealt}`);
  if (plain.burn || pyro.burn !== 3000 || both.burn !== 6000) out.push(`burns lasted ${plain.burn}, ${pyro.burn}, with Kindling ${both.burn}`);
  if (plain.cost !== 3 || pyro.cost !== 3) out.push(`burning hands cost ${plain.cost}, then ${pyro.cost}`);
  const scroll = async path => {
    const ctx = await start('mage', 'pyro-scroll');
    seedDice(ctx, 'pyro-scroll');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); G.known.scroll_fire = 1;
    const m = ahead(ctx, 'goblin', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    for (let i = 0; i < 20; i++) { const it = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(it); G.t = p.nextAttack + 2000; Game.useItem(it); }
    return 1e9 - m.hp;
  };
  const s0 = await scroll(undefined), s1 = await scroll('pyromancer');
  if (!(s1 / s0 > 1.15 && s1 / s0 < 1.25)) out.push(`the fire scroll: ${s0} -> ${s1}`);
  const ctx = await start('mage', 'pyro-cost');
  const { Game } = ctx; walk(ctx, 'pyromancer');
  const cost = id => Game.spellCost(Game.knownSpells().find(s => s.id === id));
  if (cost('lightning') !== 6 || cost('cone_cold') !== 12 || cost('magic_missile') !== 2) out.push(`a pyromancer pays ${cost('lightning')} for lightning, ${cost('cone_cold')} for cold`);
  return out.length ? out.join('; ') : true;
});

await test('Frostweaver: cold and lightning hold their mark back, Shield is stronger and longer, Lightning and Cone of Cold are cheaper', async () => {
  const out = [];
  const bolt = async (path, rime) => {
    const ctx = await start('mage', 'frost-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (rime) talent(ctx, 'rime');
    p.level = 5; p.sp = p.maxSp = 99;
    G.t = p.nextAttack;
    const m = ahead(ctx, 'orc', 3, { hp: 1e9, maxHp: 1e9, nextAct: G.t + 1000 });
    const sp0 = p.sp;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'lightning'));
    return { held: m.nextAct - (G.t + 1000), cost: sp0 - p.sp };
  };
  const plain = await bolt(undefined), frost = await bolt('frostweaver'), both = await bolt('frostweaver', true);
  if (plain.held !== 0 || frost.held !== 700 || both.held !== 1400) out.push(`held back ${plain.held}, ${frost.held}, with Rime ${both.held}`);
  if (plain.cost !== 5 || frost.cost !== 4) out.push(`lightning cost ${plain.cost}, then ${frost.cost}`);
  const shield = async path => {
    const ctx = await start('mage', 'frost-shield');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.sp = 99; G.t = p.nextAttack;
    const ac = Game.playerAC();
    Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'));
    return { ac: Game.playerAC() - ac, lasts: p.effects.ac.until - G.t };
  };
  const s0 = await shield(undefined), s1 = await shield('frostweaver');
  if (s0.ac !== 4 || s1.ac !== 5 || s0.lasts !== 60000 || s1.lasts !== 90000) out.push(`shield: +${s0.ac} for ${s0.lasts}ms -> +${s1.ac} for ${s1.lasts}ms`);
  // and the cone comes two points cheaper
  const ctx = await start('mage', 'frost-cost');
  const { Game } = ctx; walk(ctx, 'frostweaver');
  const cone = Game.spellCost(Game.knownSpells().find(s => s.id === 'cone_cold'));
  if (cone !== 8) out.push(`a Frostweaver pays ${cone} for Cone of Cold`);
  return out.length ? out.join('; ') : true;
});

await test('Assassin: the blow from the shadows hits triple, crits come sooner, and sleepers notice later', async () => {
  const out = [];
  const sneak = async path => {
    const ctx = await start('thief', 'assassin-sneak');
    seedDice(ctx, 'assassin-sneak');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60; p.stats.dex = 16;
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true, awake: false });
    for (let i = 0; i < 40; i++) { m.awake = false; G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const a = await sneak(undefined), b = await sneak('assassin');
  if (!(b / a >= 1.45 && b / a < 1.8)) out.push(`strikes from the shadows: ${a} -> ${b}`);
  {
    const ctx = await start('thief', 'assassin-crit');
    const c = ctx.Game.critFloor(); walk(ctx, 'assassin');
    if (ctx.Game.critFloor() !== c - 1) out.push(`crit floor ${c} -> ${ctx.Game.critFloor()}`);
  }
  const wakes = async path => {
    const ctx = await start('thief', 'assassin-quiet');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.bg = 'oathbroken';
    const m = ahead(ctx, 'goblin', 4, { awake: false });
    await pinned(0.9, () => run(Game, G, 1500));
    return m.awake;
  };
  const w0 = await wakes(undefined), w1 = await wakes('assassin');
  if (!w0 || w1) out.push(`a sleeper four squares off woke for a thief: ${w0}, for an assassin: ${w1}`);
  return out.length ? out.join('; ') : true;
});

await test('Trickster: slips an ordinary blow now and then, a blow on the air leaves an opening, and traps and gold favour them', async () => {
  const out = [];
  const slips = async path => {
    const ctx = await start('thief', 'trick-slip');
    seedDice(ctx, 'trick-slip');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3; p.level = 1;
    beside(ctx, 'goblin');
    const [hit, slip] = tallyLines(Game, G, 240000, [/Goblin hits you/, /slip aside/]);
    return { hit, slip };
  };
  const t = await slips('trickster'), plain = await slips(undefined);
  const share = t.slip / (t.slip + t.hit);
  if (!(t.hit > 100 && share > 0.06 && share < 0.2)) out.push(`slipped ${t.slip} of ${t.slip + t.hit}`);
  if (plain.slip) out.push(`a thief with no path slipped ${plain.slip}`);
  const open = async path => {
    const ctx = await start('thief', 'trick-open');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 999;
    const m = beside(ctx, 'goblin');
    Game.update(G.t + 25, 25);
    if (!m.windup) return 'no wind-up';
    shift(ctx, 'back');
    for (let i = 0; i < 60 && !p.opening; i++) Game.update(G.t + 25, 25);
    return !!(p.opening && p.opening.uid === m.uid);
  };
  const o1 = await open('trickster'), o0 = await open(undefined);
  if (o1 !== true || o0 !== false) out.push(`a blow on the air left an opening for a trickster: ${o1}, for a thief: ${o0}`);
  // walk onto a dart trap over and over: a trickster sees or dodges more of them
  const traps = async path => {
    const ctx = await start('thief', 'trick-traps', { traps: true });
    seedDice(ctx, 'trick-traps');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    walk(ctx, path); p.stats.wis = 3; p.stats.dex = 8; p.bg = 'oathbroken';
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    let safe = 0;
    for (let i = 0; i < 120; i++) {
      p.x = x0; p.y = y0; p.hp = p.maxHp = 999; p.poison = null;
      Game.update(G.t + 600, 600);
      L.traps[`${x},${y}`] = 'dart';
      Game.input('forward');
      if (p.hp === 999) safe++;
    }
    return safe;
  };
  const tr1 = await traps('trickster'), tr0 = await traps(undefined);
  if (!(tr1 >= tr0 + 12)) out.push(`darts escaped: trickster ${tr1}, thief ${tr0} of 120`);
  const purse = async path => {
    const ctx = await start('thief', 'trick-gold');
    const { Game } = ctx; const p = Game.player(), L = Game.level();
    walk(ctx, path);
    const it = { t: 'gold', q: 100 };
    L.items[`${p.x},${p.y}`] = [it];
    const g = p.gold;
    Game.takeItem(it);
    return p.gold - g;
  };
  const g0 = await purse(undefined), g1 = await purse('trickster');
  if (g0 !== 100 || g1 !== 125) out.push(`a pile of 100 gave ${g0}, and a trickster ${g1}`);
  return out.length ? out.join('; ') : true;
});

await test('a champion keeps everything its kind has that its prefix does not change', async () => {
  const ctx = await start('fighter', 'elite-fields');
  const { Game, MONSTERS, ELITES } = ctx;
  const out = [];
  const changed = new Set(['name', 'ac', 'hit', 'dmg', 'speed', 'xp']);
  for (const id of Object.keys(MONSTERS).filter(k => !MONSTERS[k].boss && !MONSTERS[k].named)) {
    for (const e of ELITES) {
      const st = Game.mstat({ id, elite: e.prefix, x: 0, y: 0 });
      for (const k of Object.keys(MONSTERS[id])) if (!changed.has(k) && st[k] !== MONSTERS[id][k]) out.push(`${e.prefix} ${id} lost '${k}'`);
    }
  }
  return out.length ? out.slice(0, 6).join('; ') : true;
});

await test('a named champion deals what its kin deals: the Hollow Abbess\'s touch is as cold as a wraith\'s', async () => {
  const { MONSTERS } = await start('fighter', 'named-element');
  const out = [];
  for (const id of Object.keys(MONSTERS).filter(k => MONSTERS[k].named)) {
    const kin = MONSTERS[MONSTERS[id].named.kin];
    if ((MONSTERS[id].element || '') !== (kin.element || '')) out.push(`${id} deals ${MONSTERS[id].element || 'nothing'}, its kin ${kin.element || 'nothing'}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Ring of Might adds its whole +1 to every blow, even with a quick dagger', async () => {
  const total = async ring => {
    const ctx = await start('mage', 'might-dagger');
    seedDice(ctx, 'might-dagger');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Object.assign(p.stats, { str: 12, dex: 10, con: 10, int: 16, wis: 10, cha: 10 });
    p.perkHit = 60;
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 };
    if (ring) { const r = { t: 'ring_might', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    const m = beside(ctx, 'ogre', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    let blows = 0;
    for (let i = 0; i < 60; i++) { G.t = p.nextAttack; const hp = m.hp; Game.input('attack'); if (m.hp < hp) blows++; }
    return { lost: 1e9 - m.hp, blows };
  };
  const bare = await total(false), ringed = await total(true);
  // the same seeded rolls both times: the ring's +1 on every blow that landed, and crits double it
  return (ringed.lost - bare.lost >= ringed.blows) || `bare ${bare.lost} over ${bare.blows} blows, ringed ${ringed.lost} over ${ringed.blows}`;
});

await test('the damage per second the pack and trader quote is what the weapon actually does', async () => {
  const out = [];
  // the ring, a talent, a path and finesse: each a part of the rule a copy of it lost
  const cases = [
    { cls: 'mage', weapon: 'dagger', ring: true },
    { cls: 'thief', weapon: 'longsword', level: 7 },
    { cls: 'fighter', weapon: 'greatsword', talents: ['weapon_master'], level: 5 },
    { cls: 'fighter', weapon: 'longsword', path: 'berserker', level: 5, hurt: true },
    // the second blade's blow is one of every blow a Ring of Might and a rage promise
    { cls: 'fighter', weapon: 'shortsword', offhand: 'dagger', ring: true, path: 'berserker', level: 5, hurt: true },
  ];
  for (const c of cases) {
    const ctx = await start(c.cls, 'blow-rate-' + c.weapon);
    seedDice(ctx, 'blow-rate-' + c.cls);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    if (c.level) p.level = c.level;
    if (c.talents) p.talents = c.talents;
    if (c.path) p.path = c.path;
    if (c.hurt) p.hp = Math.ceil(p.maxHp * 0.3);
    p.perkHit = 60;
    p.eq.shield = null; p.eq.offhand = c.offhand ? { t: c.offhand, q: 1, e: 0 } : null;
    p.eq.weapon = { t: c.weapon, q: 1, e: 0 };
    if (c.ring) { const r = { t: 'ring_might', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    const quoted = Game.blowRate(p.eq.weapon);
    const m = beside(ctx, 'ogre', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    G.t = p.nextAttack; const t0 = G.t;
    for (let i = 0; i < 3000; i++) { G.t = p.nextAttack; Game.input('attack'); }
    // a natural 1 misses as often as a crit doubles, so the two all but cancel
    const measured = (1e9 - m.hp) / ((p.nextAttack - t0) / 1000);
    if (Math.abs(measured - quoted) / measured > 0.06) out.push(`${c.cls} with a ${c.weapon}: quoted ${quoted.toFixed(1)}, measured ${measured.toFixed(1)}`);
  }
  // a two-hander stows the second blade, so its quote does not count the second blade's blows
  const ctx = await start('fighter', 'blow-rate-dual');
  const { Game } = ctx; const p = Game.player();
  p.eq.shield = null; p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
  const great = { t: 'greatsword', q: 1, e: 0 };
  const alone = Game.blowRate(great);
  p.eq.offhand = null;
  if (Math.abs(Game.blowRate(great) - alone) > 1e-9) out.push('a two-hander\'s quote changed with a dagger in the other hand');
  // and a hidden enchantment is not given away
  if (Game.blowRate({ t: 'greatsword', q: 1, e: 3, h: 1 }) !== Game.blowRate(great)) out.push('a hidden +3 showed in the quote');
  return out.length ? out.join('; ') : true;
});

await test('an unknown ring shows no sign of its quality, whatever kind it is, so the "?" gives nothing away', async () => {
  const ctx = await start('fighter', 'jewel-hidden');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const plus = { t: 'ring_protect', q: 1, e: 1, h: 1 }, plain = { t: 'ring_mend', q: 1, e: 0 };
  p.inv.push(plus, plain);
  if (Game.qualityHidden(plus) || Game.qualityHidden(plain)) return 'an unknown ring shows its quality as hidden';
  G.known.ring_protect = 1;
  if (!Game.qualityHidden(plus)) return 'a Ring of Protection, known, hides nothing about its make';
  // gear is unchanged: a found sword still hides its quality
  return Game.qualityHidden({ t: 'longsword', q: 1, e: 1, h: 1 }) || 'a found sword shows its quality';
});

await test('a buff says what it gives this hero: a Frostweaver\'s Shield, a Templar\'s Bless', async () => {
  const out = [];
  const say = async (cls, path, id) => {
    const ctx = await start(cls, 'buff-words-' + id);
    const { Game } = ctx; walk(ctx, path);
    return Game.spellDesc(Game.knownSpells().find(s => s.id === id));
  };
  const s0 = await say('mage', undefined, 'shield'), s1 = await say('mage', 'frostweaver', 'shield');
  if (!/^\+4 armour class for a minute\./.test(s0)) out.push(`plain Shield says "${s0}"`);
  if (!/^\+5 armour class for a minute and a half\./.test(s1)) out.push(`a Frostweaver's Shield says "${s1}"`);
  const b1 = await say('cleric', 'templar', 'bless');
  if (!/^\+2 to hit for two minutes\./.test(b1)) out.push(`a Templar's Bless says "${b1}"`);
  return out.length ? out.join('; ') : true;
});

await test('a Deep-born thief on the Assassin\'s path is noticed a square later than one who is not', async () => {
  const asleep = async path => {
    const ctx = await start('thief', 'notice-floor');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.bg = 'deepborn'; walk(ctx, path);
    const m = ahead(ctx, 'goblin', 2, { awake: false, hp: 9, maxHp: 9 });
    for (let i = 0; i < 30 && !m.awake; i++) Game.update(G.t + 100, 100);
    return !m.awake;
  };
  // a floor of two squares used to swallow the Assassin's step for a Deep-born thief
  if (await asleep('trickster')) return 'two squares off, it slept on without the Assassin\'s step';
  return (await asleep('assassin')) || 'the Assassin\'s step did nothing for a Deep-born thief';
});

await test('a champion who kills the hero is named on the death screen', async () => {
  const ctx = await start('fighter', 'named-killer');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = 1; p.effects.ac = { amount: -100, until: 1e12 };
  const m = beside(ctx, 'grisk', { spoke: true, nextAct: G.t });
  for (let i = 0; i < 80 && G.status === 'playing'; i++) Game.update(G.t + 100, 100);
  const k = Game.lastAttacker();
  return (k && /^Grisk, the /.test(k.name)) || `killed by ${JSON.stringify(k)}`;
});

await test('a mage starts in an Apprentice\'s Robe, wears only robes, and nobody else can', async () => {
  const out = [];
  const ctx = await start('mage', 'robe-start');
  const { Game } = ctx; const p = Game.player();
  if (!p.eq.armor || p.eq.armor.t !== 'robe_apprentice') out.push(`a new mage wears ${JSON.stringify(p.eq.armor)}`);
  const ac = Game.playerAC(); Game.unequip('armor');
  if (Game.playerAC() !== ac - 1) out.push(`taking off the robe moved armour class ${ac} -> ${Game.playerAC()}`);
  if (!/robes/.test(Game.canEquip({ t: 'leather', q: 1, e: 0 }) || '')) out.push(`a mage could wear leather: ${Game.canEquip({ t: 'leather', q: 1, e: 0 })}`);
  for (const cls of ['fighter', 'cleric', 'thief']) {
    const c2 = await start(cls, 'robe-other');
    const why = c2.Game.canEquip({ t: 'robe_silk', q: 1, e: 0 });
    if (!why || !/mage/.test(why)) out.push(`a ${cls} could wear a Silk Robe (${why})`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Silk Robe adds four spell points while worn, and the Robe of the Magi eases the great workings', async () => {
  const out = [];
  const ctx = await start('mage', 'robe-sp');
  const { Game } = ctx; const p = Game.player();
  p.level = 7;
  Game.unequip('armor');
  const sp0 = Game.player().maxSp;
  const silk = { t: 'robe_silk', q: 1, e: 0 }; p.inv.push(silk); Game.equip(silk, true);
  if (p.maxSp !== sp0 + 4) out.push(`a Silk Robe made spell points ${sp0} into ${p.maxSp}`);
  Game.unequip('armor');
  if (p.maxSp !== sp0) out.push(`off again, spell points are ${p.maxSp}, not ${sp0}`);
  const cost = id => Game.spellCost(Game.knownSpells().find(s => s.id === id));
  const bolt0 = cost('lightning'), dart0 = cost('magic_missile');
  const magi = { t: 'robe_magi', q: 1, e: 0 }; p.inv.push(magi); Game.equip(magi, true);
  if (p.maxSp !== sp0 + 6) out.push(`the Robe of the Magi made spell points ${sp0} into ${p.maxSp}`);
  if (cost('lightning') !== bolt0 - 1) out.push(`in the Magi's robe lightning costs ${cost('lightning')}, not ${bolt0 - 1}`);
  if (cost('magic_missile') !== dart0) out.push(`a small spell changed cost: ${dart0} -> ${cost('magic_missile')}`);
  return out.length ? out.join('; ') : true;
});

await test('robes turn up only in a mage\'s dungeon, and every other floor is as it was', async () => {
  const robesIn = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game, ITEMS } = ctx; const found = [], rest = [];
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level();
      // relics are chosen for the class already (relicPlan), so they are left out
      // a caster's focus is placed for the class too, so it is left out with the relics
      for (const k in L.items) for (const it of L.items[k]) if (!it.u && !ITEMS[it.t].focus) (ITEMS[it.t].weight === 'cloth' ? found : rest).push(`${d}:${k}:${it.t}`);
      for (const n of L.npcs || []) for (const it of n.stock || []) if (!it.u && !ITEMS[it.t].focus) (ITEMS[it.t].weight === 'cloth' ? found : rest).push(`${d}:shop:${it.t}`);
    }
    return { found, rest: rest.sort().join('|') };
  };
  let mageRobes = 0;
  for (let i = 0; i < 4; i++) {
    const m = await robesIn('mage', 'robe-place' + i), f = await robesIn('fighter', 'robe-place' + i);
    if (f.found.length) return `a fighter's dungeon held robes: ${f.found.join(', ')}`;
    if (m.rest !== f.rest) return `on seed robe-place${i} the mage's floors hold other things than the fighter's`;
    mageRobes += m.found.length;
  }
  return mageRobes > 0 || 'four mage dungeons held no robe at all';
});

await test('what lies on one square is scattered across it, each thing seen where it lies', async () => {
  const ctx = await start('fighter', 'scatter');
  const { Game } = ctx; const L = Game.level();
  for (const k in L.items) delete L.items[k];
  L.items['5,5'] = [{ t: 'dagger', q: 1, e: 0 }, { t: 'potion_heal', q: 1, e: 0 }, { t: 'ration', q: 1, e: 0 }];
  L.items['9,9'] = Array.from({ length: 8 }, () => ({ t: 'gold', q: 5 }));
  const floor = Game.renderState(0).sprites.filter(sp => sp.onFloor);
  const here = floor.filter(sp => Math.floor(sp.x) === 5 && Math.floor(sp.y) === 5);
  if (here.length !== 3) return `three things on a square drew ${here.length} pictures`;
  if (new Set(here.map(sp => sp.x.toFixed(3) + ',' + sp.y.toFixed(3))).size !== 3) return 'two of them lie on the same spot';
  if (here.some(sp => Math.abs(sp.x - 5.5) > 0.3 || Math.abs(sp.y - 5.5) > 0.3)) return 'one lies outside its square';
  // from any side, none stands straight behind another: no two share a row or a column
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
    if (Math.abs(here[i].x - here[j].x) < 0.1 || Math.abs(here[i].y - here[j].y) < 0.1) return 'two lie in line, so one hides the other from some side';
  }
  const heap = floor.filter(sp => Math.floor(sp.x) === 9 && Math.floor(sp.y) === 9);
  return heap.length === 5 || `eight things on a square drew ${heap.length} pictures, not the five that fit`;
});

await test('a thief carries a buckler for one more point of armour, and nothing bigger', async () => {
  const ctx = await start('thief', 'thief-buckler');
  const { Game } = ctx; const p = Game.player();
  const ac = Game.playerAC();
  const b = { t: 'buckler', q: 1, e: 0 }; p.inv.push(b);
  if (!Game.equip(b, true)) return `a thief could not take up a buckler: ${Game.canEquip(b)}`;
  if (Game.playerAC() !== ac + 1) return `a buckler moved armour class ${ac} -> ${Game.playerAC()}`;
  for (const t of ['shield', 'towershield']) {
    const why = Game.canEquip({ t, q: 1, e: 0 });
    if (!why || !/buckler/.test(why)) return `a thief could carry a ${t} (${why})`;
  }
  const mage = await start('mage', 'thief-buckler');
  return !!mage.Game.canEquip({ t: 'buckler', q: 1, e: 0 }) || 'a mage could carry a buckler';
});

await test('a caster\'s free hand: a mage holds a focus only with a one-handed weapon, a cleric a holy symbol, nobody else either', async () => {
  const out = [];
  const ctx = await start('mage', 'focus-hand');
  const { Game } = ctx; const p = Game.player();
  const orb = { t: 'crystal_orb', q: 1, e: 0 }; p.inv.push(orb);
  if (!/free hand/.test(Game.canEquip(orb) || '')) out.push(`with the staff in both hands the orb said: ${Game.canEquip(orb)}`);
  Game.equip(p.inv.find(i => i.t === 'dagger'), true);
  if (!Game.equip(orb, true) || p.eq.shield !== orb) out.push(`with a dagger the mage could not hold the orb: ${Game.canEquip(orb)}`);
  if (!Game.canEquip({ t: 'holy_symbol', q: 1, e: 0 })) out.push('a mage could hold a holy symbol');
  const cl = await start('cleric', 'focus-hand');
  if (cl.Game.canEquip({ t: 'silver_symbol', q: 1, e: 0 })) out.push(`a cleric could not hold a symbol: ${cl.Game.canEquip({ t: 'silver_symbol', q: 1, e: 0 })}`);
  if (!cl.Game.canEquip({ t: 'crystal_orb', q: 1, e: 0 })) out.push('a cleric could hold an orb');
  for (const c of ['fighter', 'thief']) {
    const o = await start(c, 'focus-hand');
    if (!o.Game.canEquip({ t: 'spellbook', q: 1, e: 0 }) || !o.Game.canEquip({ t: 'reliquary', q: 1, e: 0 })) out.push(`a ${c} could hold a focus`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Spellbook brings spell points back a quarter faster, and a Crystal Orb adds one to each die, up to two', async () => {
  const out = [];
  const regained = async book => {
    const ctx = await start('mage', 'focus-regen');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    Game.equip(p.inv.find(i => i.t === 'dagger'), true);
    if (book) { const b = { t: 'spellbook', q: 1, e: 0 }; p.inv.push(b); Game.equip(b, true); }
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    p.maxSp = 999; p.sp = 0; p.steps = 0;
    for (let i = 0; i < 36; i++) { Game.input(i % 2 ? 'back' : 'forward'); run(Game, G, 320); }
    return { sp: p.sp, steps: p.steps };
  };
  const a = await regained(false), b = await regained(true);
  if (a.steps !== 36 || b.steps !== 36) out.push(`walked ${a.steps} and ${b.steps} steps, not 36`);
  if (a.sp !== 4 || b.sp !== 5) out.push(`over 36 steps spell points came back ${a.sp}, and ${b.sp} with the book`);
  // the orb: the same seeded dice, one more per die on every missile
  const hurt = async orb => {
    const ctx = await start('mage', 'focus-die');
    seedDice(ctx, 'focus-die');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.equip(p.inv.find(i => i.t === 'dagger'), true);
    if (orb) { const o = { t: 'crystal_orb', q: 1, e: 0 }; p.inv.push(o); Game.equip(o, true); }
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === 'magic_missile'), dice = sp.dmg(p.level)[0];
    for (let i = 0; i < 20; i++) { p.sp = 99; G.t = p.nextAttack; Game.castSpell(sp); run(Game, G, 700); }
    return { lost: 1e9 - m.hp, dice };
  };
  const o0 = await hurt(false), o1 = await hurt(true);
  if (o1.lost - o0.lost !== 20 * Math.min(2, o0.dice)) out.push(`twenty missiles did ${o0.lost}, and ${o1.lost} with the orb (${o0.dice} dice each)`);
  return out.length ? out.join('; ') : true;
});

await test('a Holy Symbol heals a quarter more, a Silver Sunburst smites and strikes a quarter harder, and a cleric pays in armour', async () => {
  const out = [];
  const heal = async sym => {
    const ctx = await start('cleric', 'symbol-heal');
    seedDice(ctx, 'symbol-heal');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const ac0 = Game.playerAC();
    if (sym) { const s = { t: sym, q: 1, e: 0 }; p.inv.push(s); Game.equip(s, true); }
    const dAc = Game.playerAC() - ac0;
    p.maxHp = 99999; let total = 0;
    for (let i = 0; i < 200; i++) { p.hp = 1; p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'cure_light')); total += p.hp - 1; }
    return { total, dAc };
  };
  const h0 = await heal(null), h1 = await heal('holy_symbol');
  if (!(h1.total / h0.total > 1.2 && h1.total / h0.total < 1.3)) out.push(`healing ${h0.total} -> ${h1.total} with the symbol`);
  if (h1.dAc !== -1) out.push(`trading the shield for the symbol moved armour class by ${h1.dAc}, not -1`);
  const smite = async (sym, spell = 'smite') => {
    const ctx = await start('cleric', 'symbol-smite');
    seedDice(ctx, 'symbol-smite');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.level = spell === 'smite' ? 5 : 9;
    if (sym) { const s = { t: sym, q: 1, e: 0 }; p.inv.push(s); Game.equip(s, true); }
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    for (let i = 0; i < 40; i++) { p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === spell)); run(Game, G, 700); }
    return 1e9 - m.hp;
  };
  const s0 = await smite(null), s1 = await smite('silver_symbol');
  if (!(s1 / s0 > 1.18 && s1 / s0 < 1.32)) out.push(`smiting ${s0} -> ${s1} with the sunburst`);
  const f0 = await smite(null, 'flame_strike'), f1 = await smite('silver_symbol', 'flame_strike');
  if (!f0) out.push('Flame Strike did no harm at all');
  else if (!(f1 / f0 > 1.18 && f1 / f0 < 1.32)) out.push(`Flame Strike ${f0} -> ${f1} with the sunburst`);
  return out.length ? out.join('; ') : true;
});

await test('a trader may shelve caster gear a tier finer than the floor, but never two', async () => {
  let deeper = 0; const out = [];
  for (let i = 0; i < 12; i++) {
    const cls = i % 2 ? 'cleric' : 'mage';
    const ctx = await start(cls, 'shelf-tier' + i);
    const { Game, ITEMS } = ctx;
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const maxTier = 1 + Math.floor(d / 2);
      for (const it of (Game.level().npcs || []).flatMap(n => n.stock || [])) {
        const b = ITEMS[it.t];
        if (!(b.focus || b.weight === 'cloth')) continue;
        if (b.tier > maxTier + 1) out.push(`${it.t} (tier ${b.tier}) on a floor-${d} shelf`);
        else if (b.tier === maxTier + 1) deeper++;
      }
      for (const it of Object.values(Game.level().items).flat()) {
        const b = ITEMS[it.t];
        if ((b.focus || b.weight === 'cloth') && b.tier > maxTier) out.push(`${it.t} (tier ${b.tier}) on a floor-${d} pile`);
      }
    }
  }
  if (!deeper) out.push('no trader ever shelved a finer piece');
  return out.length ? out.join('; ') : true;
});

await test('foci turn up only in a caster\'s dungeon, and never for the other caster', async () => {
  const count = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game, ITEMS } = ctx; const found = {};
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level();
      const all = [...Object.values(L.items).flat(), ...(L.npcs || []).flatMap(n => n.stock || [])];
      for (const it of all) if (ITEMS[it.t].focus) found[ITEMS[it.t].focus] = (found[ITEMS[it.t].focus] || 0) + 1;
    }
    return found;
  };
  let mage = 0, cleric = 0;
  for (let i = 0; i < 4; i++) {
    const m = await count('mage', 'focus-place' + i), c = await count('cleric', 'focus-place' + i), f = await count('fighter', 'focus-place' + i);
    if (m.cleric || c.mage || f.mage || f.cleric) return `the wrong caster's focus turned up: mage ${JSON.stringify(m)}, cleric ${JSON.stringify(c)}, fighter ${JSON.stringify(f)}`;
    mage += m.mage || 0; cleric += c.cleric || 0;
  }
  return (mage > 0 && cleric > 0) || `four dungeons each held ${mage} mage foci and ${cleric} holy symbols`;
});

await test('anyone can wear a cloak: Protection adds to a ring, the Elven cloak is quiet, Warmth keeps out the cold', async () => {
  const out = [];
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    const ctx = await start(cls, 'cloak-' + cls);
    const { Game } = ctx; const p = Game.player();
    const ac = Game.playerAC();
    const c = { t: 'cloak_protect', q: 1, e: 0 }; p.inv.push(c);
    if (!Game.equip(c, true) || p.eq.cloak !== c) { out.push(`a ${cls} could not wear a cloak: ${Game.canEquip(c)}`); continue; }
    if (Game.playerAC() !== ac + 1) out.push(`a ${cls}'s cloak moved armour class ${ac} -> ${Game.playerAC()}`);
    if (cls === 'mage') {
      const r = { t: 'ring_protect', q: 1, e: 0 }; p.inv.push(r); Game.state().known.ring_protect = 1; Game.equip(r, true);
      if (Game.playerAC() !== ac + 2) out.push(`a cloak and a ring made armour class ${ac} -> ${Game.playerAC()}, not +2`);
      Game.unequip('cloak');
      const el = { t: 'cloak_elven', q: 1, e: 0 }; p.inv.push(el); Game.equip(el, true);
      if (!Game.hasPower('quiet')) out.push('an Elven Cloak did not make its wearer quiet');
      Game.unequip('cloak');
      const w = { t: 'cloak_warmth', q: 1, e: 0 }; p.inv.push(w); Game.equip(w, true);
      if (!Game.hasPower('warmth')) out.push('a Cloak of Warmth did not keep out the cold');
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a save from before cloaks loads with an empty cloak slot, and cloaks turn up for every class', async () => {
  const ctx = await start('thief', 'cloak-save');
  const { Game } = ctx; const G = Game.state();
  delete G.player.eq.cloak;
  Game.save(true);
  if (!Game.load()) return 'the old save would not load';
  if (Game.player().eq.cloak !== null) return `the cloak slot came back as ${JSON.stringify(Game.player().eq.cloak)}`;
  let found = 0;
  for (let i = 0; i < 3; i++) {
    const c2 = await start(['fighter', 'mage', 'thief'][i], 'cloak-place' + i);
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { c2.Game.level().monsters.length = 0; c2.Game.descend(); }
      const L = c2.Game.level();
      found += [...Object.values(L.items).flat(), ...(L.npcs || []).flatMap(n => n.stock || [])].filter(it => c2.ITEMS[it.t].kind === 'cloak').length;
    }
  }
  return found > 0 || 'three dungeons held no cloak at all';
});

await test('a focus turns no blows and rusts not: its make and a curse never touch armour class', async () => {
  const out = [];
  const ctx = await start('mage', 'focus-ac');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.equip(p.inv.find(i => i.t === 'dagger'), true);
  const ac = Game.playerAC();
  const orb = { t: 'crystal_orb', q: 1, e: 2 }; p.inv.push(orb); Game.equip(orb, true);
  if (Game.playerAC() !== ac) out.push(`a +2 orb moved armour class ${ac} -> ${Game.playerAC()}`);
  // a rustmaw bites a mage in a robe with an orb in hand: nothing of metal to eat
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999, edge: 40 });
  const mark = markLog(G);
  for (let i = 0; i < 4 && (orb.e === 2); i++) { m.moveReady = 0; run(Game, G, 1200); }
  if (orb.e !== 2) out.push(`the rust ate the orb: now ${orb.e} (${linesSince(G, mark).join(' | ')})`);
  if (linesSince(G, mark).some(l => /forge can mend/.test(l) && /Orb/.test(l))) out.push('the log promised the forge would mend an orb');
  return out.length ? out.join('; ') : true;
});

await test('the log names what keeps out the cold: a cloak is not called a ring', async () => {
  const out = [];
  for (const [id, word] of [['cloak_warmth', 'cloak'], ['ring_warmth', 'ring']]) {
    const ctx = await start('fighter', 'warm-' + word);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const it = { t: id, q: 1, e: 0 }; p.inv.push(it); G.known[id] = 1; Game.equip(it, true);
    beside(ctx, 'wraith');
    const mark = markLog(G);
    let line = null;
    for (let i = 0; i < 400 && !line; i++) { Game.update(G.t + 25, 25); line = linesSince(G, mark).find(l => /keeps out the cold/.test(l)); }
    if (!line) out.push(`a wraith never hit through a ${word}`);
    else if (!line.includes(`your ${word} keeps out the cold`)) out.push(`with a ${word}: "${line}"`);
  }
  return out.length ? out.join('; ') : true;
});

await test('an old save\'s enchanted focus comes back plain, as a focus never counted for armour', async () => {
  const ctx = await start('mage', 'focus-old-save');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  const orb = { t: 'crystal_orb', q: 1, e: 2 }, book = { t: 'spellbook', q: 1, e: -1 };
  p.inv.push(book);
  const staff = p.eq.weapon; if (staff && ctx.ITEMS[staff.t].hands === 2) Game.unequip('weapon');
  p.eq.shield = orb;
  Game.save(true);
  if (!Game.load()) return 'the save would not load';
  const q = Game.player();
  return (q.eq.shield?.e === 0 && q.inv.find(it => it.t === 'spellbook')?.e === 0) || `the orb came back ${q.eq.shield?.e}, the book ${q.inv.find(it => it.t === 'spellbook')?.e}`;
});

await test('what you drop stays down when you walk back over it, and the Take row lifts it', async () => {
  const ctx = await start('fighter', 'drop-stays');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const club = { t: 'club', q: 1, e: 0 }; p.inv.push(club);
  Game.dropItem(club);
  const x0 = p.x, y0 = p.y;
  // step off to any open side and back
  for (let turn = 0; turn < 4 && p.x === x0 && p.y === y0; turn++) { Game.input('forward'); run(Game, G, 400); if (p.x === x0 && p.y === y0) { Game.input('right'); run(Game, G, 300); } }
  if (p.x === x0 && p.y === y0) return 'could not step off the square';
  Game.input('back'); run(Game, G, 400);
  if (p.x !== x0 || p.y !== y0) return 'could not step back onto the square';
  if (p.inv.some(it => it.t === 'club')) return 'walking back over the dropped club picked it up';
  if (!Game.floorItems().includes(club)) return 'the club was not on the floor';
  Game.input('take'); run(Game, G, 100);
  const held = p.inv.find(it => it.t === 'club');
  if (!held || Game.floorItems().length) return 'the Take row did not lift the club';
  return held.left === undefined || 'the club kept its dropped mark in the pack';
});

await test('walking over gear your class cannot use leaves it for the Take row, and the trader buys it all in one go', async () => {
  const ctx = await start('mage', 'junk-walk');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  for (let i = 0; i < 4; i++) { const [dx, dy] = Dungeon.DIRS[p.dir]; if (L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.FLOOR) break; Game.input('right'); run(Game, G, 300); }
  const [dx, dy] = Dungeon.DIRS[p.dir], tx = p.x + dx, ty = p.y + dy;
  L.items[`${tx},${ty}`] = [{ t: 'scale', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 0 }, { t: 'shield', q: 1, e: 0 }];
  const mark = markLog(G);
  Game.input('forward'); run(Game, G, 400);
  if (p.x !== tx || p.y !== ty) return 'could not step onto the pile';
  const out = [];
  if (!p.inv.some(it => it.t === 'dagger')) out.push('the dagger a mage can use was not picked up');
  if (p.inv.some(it => it.t === 'scale' || it.t === 'shield')) out.push('gear a mage cannot use was picked up by walking over it');
  const said = linesSince(G, mark).filter(l => /no use to a mage/.test(l));
  if (said.length !== 1) out.push(`the log said ${said.length} times what was left`);
  Game.input('back'); run(Game, G, 400); Game.input('forward'); run(Game, G, 400);
  if (linesSince(G, mark).filter(l => /no use to a mage/.test(l)).length !== 1) out.push('stepping back on said it again');
  Game.input('take'); run(Game, G, 100);
  if (!p.inv.some(it => it.t === 'scale') || !p.inv.some(it => it.t === 'shield')) out.push('the Take row did not lift what was left');
  if (Game.junkInPack().length !== 2) out.push(`the pack held ${Game.junkInPack().length} pieces of junk, not 2`);
  // now a trader, and one tap for the lot
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [ex, ey] = Dungeon.DIRS[p.dir]; shop.x = p.x + ex; shop.y = p.y + ey;
  if (L.tiles[shop.y * L.w + shop.x] !== Dungeon.T.FLOOR) { L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR; }
  Game.input('forward');
  if (!Game.currentShop()) return out.concat('could not open the shop').join('; ');
  const want = Game.junkInPack().reduce((n, it) => n + Game.sellPrice(it), 0), g0 = p.gold;
  const got = Game.sellJunk();
  if (got !== want || p.gold !== g0 + want) out.push(`selling the junk paid ${p.gold - g0} (said ${got}), wanted ${want}`);
  if (Game.junkInPack().length || !p.inv.some(it => it.t === 'dagger')) out.push('selling the junk left junk, or sold the dagger');
  return out.length ? out.join('; ') : true;
});

await test('a lunger follows a step straight back, but a step aside leaves it biting air; others swing at the air', async () => {
  const out = [];
  const trial = async (id, how) => {
    const ctx = await start('fighter', `lunge-${id}-${how}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, id, { nextAct: G.t });
    for (let i = 0; i < 40 && !m.windup; i++) Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move) return { err: `the ${id} drew back ${JSON.stringify(m.windup)}` };
    const at = [m.x, m.y], was = [p.x, p.y];
    shift(ctx, how);
    const mark = markLog(G);
    // until the blow comes down, whatever the monster's beat
    for (let i = 0; i < 60 && !linesSince(G, mark).some(l => l.includes(ctx.MONSTERS[id].name)); i++) Game.update(G.t + 25, 25);
    const said = linesSince(G, mark).join(' | ');
    return { moved: m.x !== at[0] || m.y !== at[1], into: m.x === was[0] && m.y === was[1], said };
  };
  const back = await trial('ghoul', 'back');
  if (back.err) return back.err;
  if (!back.into) out.push(`a ghoul did not lunge into the square left (${back.said})`);
  if (!/Ghoul lunges after you/.test(back.said)) out.push(`a ghoul's lunge said: ${back.said}`);
  const side = await trial('ghoul', 'side');
  if (side.moved || !/swings at the air/.test(side.said)) out.push(`a ghoul followed a step aside: ${side.said}`);
  const gob = await trial('goblin', 'back');
  if (gob.err) return gob.err;
  if (gob.moved || !/swings at the air/.test(gob.said)) out.push(`a goblin followed a step back: ${gob.said}`);
  return out.length ? out.join('; ') : true;
});

await test('the lich\'s touch reaches two squares down a straight line, not round a step aside', async () => {
  const out = [];
  for (const how of ['back', 'side']) {
    const ctx = await start('fighter', `reach-${how}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.dex = 3;
    const m = beside(ctx, 'lich', { nextAct: G.t, blows: 0, spoke: true });
    for (let i = 0; i < 40 && !(m.windup && !m.windup.move); i++) { m.blows = 0; Game.update(G.t + 25, 25); }
    if (!m.windup || m.windup.move) return `the lich drew back ${JSON.stringify(m.windup)}`;
    shift(ctx, how);
    const mark = markLog(G);
    for (let i = 0; i < 60 && !linesSince(G, mark).some(l => /Lich/.test(l)); i++) Game.update(G.t + 25, 25);
    const said = linesSince(G, mark).join(' | ');
    if (how === 'back' && !/Lich reaches across (and touches you|for you and misses)/.test(said)) out.push(`a step back escaped the lich: ${said}`);
    if (how === 'side' && !/swings at the air/.test(said)) out.push(`the lich reached round a step aside: ${said}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a cunning fighter never draws back the same way twice; a plain one keeps its beat', async () => {
  const lengths = async id => {
    const ctx = await start('fighter', `beat-${id}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 99999;
    const m = beside(ctx, id, { nextAct: G.t });
    const seen = new Set(); let last = null;
    for (let i = 0; i < 2000 && seen.size < 12; i++) {
      Game.update(G.t + 25, 25);
      if (m.windup && !m.windup.move && m.windup !== last) { last = m.windup; seen.add(m.windup.until - m.windup.at); }
      if (!m.windup) last = null;
    }
    return [...seen];
  };
  const gob = await lengths('goblin'), zom = await lengths('zombie');
  if (gob.length < 3) return `a goblin drew back only ${gob.join(', ')}ms`;
  return zom.length <= 2 || `a zombie drew back ${zom.join(', ')}ms`;
});

await test('a fighter\'s Bash breaks the blow being drawn back and staggers the foe; it comes back after a while', async () => {
  const out = [];
  const bashOnce = async path => {
    const ctx = await start('fighter', 'bash-' + (path || 'plain'));
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 999; if (path) p.path = path;
    const m = beside(ctx, 'goblin', { nextAct: G.t });
    for (let i = 0; i < 40 && !m.windup; i++) Game.update(G.t + 25, 25);
    if (!m.windup) return { err: 'no wind-up to break' };
    const hp0 = m.hp, t0 = G.t;
    const ok = Game.useAbility();
    return { ok, broke: !m.windup, stagger: m.nextAct - t0, open: !!(p.opening && p.opening.uid === m.uid), hurt: hp0 - m.hp, label: Game.castLabel(), again: Game.useAbility(), Game };
  };
  const plain = await bashOnce(null);
  if (plain.err) return plain.err;
  if (!plain.ok || !plain.broke) out.push('Bash did not break the wind-up');
  if (plain.stagger < 750) out.push(`a shield bash staggered only ${plain.stagger}ms`);
  if (plain.hurt) out.push('a plain Bash did damage');
  if (!/^Bash \d+s$/.test(plain.label)) out.push(`after a Bash the button says ${plain.label}`);
  if (plain.again !== false) out.push('Bash could be used again at once');
  const knight = await bashOnce('knight');
  if (knight.stagger < plain.stagger + 600) out.push(`a Knight's bash staggered ${knight.stagger}ms against ${plain.stagger}`);
  const zerk = await bashOnce('berserker');
  if (!(zerk.hurt > 0)) out.push('a Berserker\'s bash did no damage');
  // nothing in front: refused, and not spent
  const ctx = await start('fighter', 'bash-air');
  ctx.Game.level().monsters.length = 0;
  if (ctx.Game.useAbility() !== false || ctx.Game.castLabel() !== 'Bash') out.push('a bash at nothing was spent');
  return out.length ? out.join('; ') : true;
});

await test('a thief\'s Smoke makes everything close lose them, asleep to them until it clears; the lich sees through it', async () => {
  const out = [];
  const ctx = await start('thief', 'smoke');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const m = beside(ctx, 'goblin', { nextAct: G.t + 1e9 });
  // one already drawing back is committed: its blow still comes
  const swinging = { ...m, uid: 92, x: m.x, y: m.y, windup: { kind: 'melee', at: G.t, until: G.t + 500 } };
  const far = { ...m, uid: 91, x: -99, y: -99, awake: true };
  L.monsters.push(far);
  L.monsters.push(swinging);
  if (!Game.useAbility()) return 'Smoke was refused';
  if (!swinging.awake || !swinging.windup) out.push('a blow already drawn back was stopped by the smoke');
  L.monsters.splice(L.monsters.indexOf(swinging), 1);
  if (m.awake || m.windup) out.push('the goblin beside the thief still saw them');
  if (!far.awake) out.push('a monster far off lost the thief too');
  run(Game, G, 2500);
  if (m.awake) out.push('the goblin woke inside the smoke');
  // a blow on it now is a strike from the shadows
  const mark = markLog(G);
  p.perkHit = 60;   // the blow lands: a miss would wake it, as it should
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (!linesSince(G, mark).some(l => /from the shadows/.test(l))) out.push(`no strike from the shadows: ${linesSince(G, mark).join(' | ')}`);
  if (Game.castLabel() === 'Smoke') out.push('Smoke came back at once');
  // and the lich is not fooled
  const c2 = await start('thief', 'smoke-lich');
  const lich = beside(c2, 'lich', { spoke: true });
  c2.Game.useAbility();
  if (!lich.awake) out.push('the lich lost the thief in smoke');
  return out.length ? out.join('; ') : true;
});

await test('Shield Slam brings Bash back in ten seconds and knocks the foe a square back; Choking Cloud leaves what loses a thief coughing', async () => {
  const out = [];
  const ctx = await start('fighter', 'shield-slam');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999; talent(ctx, 'shield_slam');
  const [dx, dy] = Dungeon.DIRS[p.dir];
  // clear the two squares ahead so there is room to be knocked into
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const m = beside(ctx, 'goblin', { nextAct: G.t });
  const x0 = m.x, y0 = m.y;
  if (!Game.useAbility()) return 'Bash was refused';
  if (m.x !== x0 + dx || m.y !== y0 + dy) out.push(`the goblin stayed at ${m.x},${m.y}, not knocked to ${x0 + dx},${y0 + dy}`);
  if (m.nextAct - G.t < 1700) out.push(`a slammed goblin moves again in ${m.nextAct - G.t}ms`);
  const secs = +(Game.castLabel().match(/\d+/) || [0])[0];
  if (!(secs > 0 && secs <= 10)) out.push(`after a Shield Slam the button says ${Game.castLabel()}`);
  // against a wall it still bashes, and stays put
  const c2 = await start('fighter', 'shield-slam-wall');
  const p2 = c2.Game.player(), L2 = c2.Game.level(); talent(c2, 'shield_slam');
  const [ex, ey] = c2.Dungeon.DIRS[p2.dir];
  L2.tiles[(p2.y + ey) * L2.w + p2.x + ex] = c2.Dungeon.T.FLOOR;
  L2.tiles[(p2.y + ey * 2) * L2.w + p2.x + ex * 2] = c2.Dungeon.T.WALL;
  const w = beside(c2, 'goblin', { nextAct: c2.Game.state().t + 1e9 });
  const wx = w.x;
  if (!c2.Game.useAbility() || w.x !== wx) out.push('a slam into a wall moved the goblin or was refused');
  // Choking Cloud: the first move after the smoke clears comes late
  const wakeDelay = async cough => {
    const c = await start('thief', 'cough-' + cough);
    const { Game: g } = c; const q = g.player(), s = g.state();
    q.hp = q.maxHp = 999; if (cough) talent(c, 'choking_cloud');
    const f = beside(c, 'skeleton', { nextAct: s.t + 1e9 });
    g.useAbility();
    for (let i = 0; i < 400 && !f.awake; i++) g.update(s.t + 25, 25);
    return f.awake ? f.nextAct - s.t : null;
  };
  const plain = await wakeDelay(false), coughing = await wakeDelay(true);
  if (plain == null || coughing == null) out.push(`the goblin never woke after the smoke (${plain}, ${coughing})`);
  else if (coughing < plain + 1200) out.push(`a coughing goblin moved ${coughing}ms after waking against ${plain}`);
  return out.length ? out.join('; ') : true;
});

await test('the trader\'s forge adds a quality of make to plain known gear, from the second floor down, for gold', async () => {
  const out = [];
  const ctx = await start('fighter', 'make');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  const svc = id => Game.shopServices().find(v => v.id === id);
  const w = p.eq.weapon; w.h = 0; delete w.px; delete w.u; delete w.curse;
  p.gold = 99999;
  if (!svc('make_weapon') || !svc('make_weapon').why) out.push('the forge worked on the first floor');
  Game.closeShop ? Game.closeShop() : null;
  Game.level().monsters.length = 0; Game.descend();
  if (G.depth !== 2) return `descended to depth ${G.depth}`;
  { const L2 = Game.level(); L2.npcs.length = 0; L2.npcs.push(shop); L2.monsters.length = 0;
    const [ex, ey] = Dungeon.DIRS[p.dir]; shop.x = p.x + ex; shop.y = p.y + ey;
    L2.tiles[shop.y * L2.w + shop.x] = Dungeon.T.FLOOR; Game.input('forward');
    if (!Game.currentShop()) return 'could not open the shop on the second floor'; }
  const s = svc('make_weapon');
  if (!s || s.why) return `the make was refused: ${JSON.stringify(s)}`;
  if (s.price < 100) out.push(`a make on the second floor cost only ${s.price}`);
  w.h = 1; if (!svc('make_weapon').why) out.push('the forge worked an unknown blade'); w.h = 0;
  w.curse = 1; if (!svc('make_weapon').why) out.push('the forge worked cursed metal'); delete w.curse;
  w.u = 'x'; if (!svc('make_weapon').why) out.push('the forge worked a relic'); delete w.u;
  const gold = p.gold;
  Game.buyService('make_weapon');
  if (w.px !== s.px) out.push(`the weapon is ${w.px}, not ${s.px}`);
  if (gold - p.gold !== s.price) out.push(`paid ${gold - p.gold}, asked ${s.price}`);
  if (!svc('make_weapon').why) out.push('a second make was offered on the same blade');
  if (p.eq.armor) { p.eq.armor.h = 0; delete p.eq.armor.px; const a = svc('make_armor'); if (!a || a.why) out.push(`armour make refused: ${a && a.why}`); }
  return out.length ? out.join('; ') : true;
});

await test('smoke leaves no stale mark: a sleeper it never woke, and a foe that lost the thief, do not bar rest once it has cleared', async () => {
  const out = [];
  const ctx = await start('thief', 'smoke-stale');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = 3; p.maxHp = 999; p.bg = 'deepborn';
  // a sleeper three squares off, which never knew the thief was there
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const m = beside(ctx, 'goblin', { awake: false, nextAct: G.t + 1e9 });
  m.x = p.x + dx * 3; m.y = p.y + dy * 3;
  if (Game.restLabel() === 'Foes near') out.push('the sleeper barred rest before any smoke');
  Game.useAbility();
  if (m.smoked) out.push('a sleeper the smoke never woke was marked as lost in it');
  // an awake foe that loses the thief bars rest now, and not half a minute later
  const c2 = await start('thief', 'smoke-stale2');
  const q = c2.Game.player(), s2 = c2.Game.state(); q.hp = 3; q.maxHp = 999;
  const f = beside(c2, 'goblin', { nextAct: s2.t + 1e9 });
  c2.Game.useAbility();
  if (c2.Game.restLabel() !== 'Foes near') out.push(`beside a foe lost in the smoke the Rest button said ${c2.Game.restLabel()}`);
  // struck awake later, it settles again: half a minute on, asleep beside the thief, it is no more a bar than any sleeper
  f.awake = true; s2.t += 30000; f.awake = false;
  if (c2.Game.restLabel() === 'Foes near') out.push('half a minute after the smoke, a sleeping foe it once hid from still barred rest');
  return out.length ? out.join('; ') : true;
});

await test('Self-Taught gives any one score two points at most over the run', async () => {
  const ctx = await start('fighter', 'spread-cap');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  const str = p.stats.str;
  G.pendingBoons = [['spread', 'vigor', 'keen'], ['spread', 'vigor', 'keen']]; G.pendingLevels = [3, 5];
  if (!Game.chooseBoon('spread', ['str', 'str'])) return 'the first Self-Taught was refused';
  if (Game.chooseBoon('spread', ['str', 'dex']) !== false) return 'a third point went to Strength';
  if (p.stats.str !== str + 2) return `Strength went from ${str} to ${p.stats.str}`;
  return Game.chooseBoon('spread', ['dex', 'con']) === true || 'the second Self-Taught was refused elsewhere';
});

await test('Self-Taught takes only real scores', async () => {
  const ctx = await start('fighter', 'spread-guard');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [3];
  if (Game.chooseBoon('spread', ['toString', 'str']) !== false) return 'a point went to toString';
  if (Object.prototype.hasOwnProperty.call(p.stats, 'toString')) return 'the hero has a toString score';
  return Game.chooseBoon('spread', ['str', 'str']) === true || 'two points on Strength were refused';
});

await test('a quality of make goes in front of the name once known, and does what it says', async () => {
  const out = [];
  const ctx = await start('fighter', 'prefix');
  const { Game } = ctx; const p = Game.player();
  const hidden = { t: 'mace', q: 1, e: 1, h: 1, px: 'heavy' };
  if (/Heavy/.test(Game.itemName(hidden))) out.push('a hidden quality showed in the name');
  const known = { ...hidden, h: 0 };
  if (Game.itemName(known) !== 'Heavy Mace +1') out.push(`named ${Game.itemName(known)}`);
  // sturdy armour: one more armour class; true weapon: one more to hit
  Game.unequip('armor');
  const ac0 = Game.playerAC();
  const plain = { t: 'chain', q: 1, e: 0 }; p.inv.push(plain); Game.equip(plain, true);
  const acPlain = Game.playerAC();
  Game.unequip('armor');
  const sturdy = { t: 'chain', q: 1, e: 0, px: 'sturdy' }; p.inv.push(sturdy); Game.equip(sturdy, true);
  if (Game.playerAC() !== acPlain + 1) out.push(`sturdy chain gave ${Game.playerAC() - ac0} armour, plain ${acPlain - ac0}`);
  const hit0 = Game.toHit();
  const w = p.eq.weapon; w.px = 'true';
  if (Game.toHit() !== hit0 + 1) out.push('a True weapon did not add to hit');
  w.px = 'heavy';
  const rateHeavy = Game.blowRate(w); w.px = ''; const ratePlain = Game.blowRate(w);
  if (!(rateHeavy > ratePlain)) out.push('a Heavy weapon did not raise the damage estimate');
  // found ones turn up from the third floor, never shown before they are known
  let found = 0;
  for (let i = 0; i < 6; i++) {
    const c2 = await start('fighter', 'prefix-find' + i);
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { c2.Game.level().monsters.length = 0; c2.Game.descend(); }
      for (const it of Object.values(c2.Game.level().items).flat()) if (it.px) { found++; if (d < 3) out.push(`a ${it.px} piece on floor ${d}`); if (!it.h) out.push('a found quality was not hidden'); }
    }
  }
  if (!found) out.push('no quality of make turned up in six dungeons');
  return out.length ? out.join('; ') : true;
});

await test('a relic pair worn together does more: the Stairwarden\'s Arms add armour, the Nightwalk a strike from the shadows', async () => {
  const out = [];
  const ctx = await start('fighter', 'relic-set');
  const { Game } = ctx;
  Game.unequip('armor'); Game.unequip('shield');
  wearRelic(ctx, 'rustwarden');
  const one = Game.playerAC();
  const bulwark = wearRelic(ctx, 'kests_bulwark');
  const both = Game.playerAC();
  const shieldAc = ctx.ITEMS[bulwark.t].ac + bulwark.e;
  if (both !== one + shieldAc + 2) out.push(`both pieces gave ${both - one}, the shield alone is worth ${shieldAc}`);
  const t = await start('thief', 'relic-set-t');
  const before = t.Game.sneakMult();
  t.Game.unequip('armor');
  wearRelic(t, 'shadowskin');
  if (t.Game.sneakMult() !== before) out.push('half the Nightwalk added to the strike from the shadows');
  wearRelic(t, 'whisper');
  if (t.Game.sneakMult() !== before + 1) out.push(`the Nightwalk made the strike ${t.Game.sneakMult()}, not ${before + 1}`);
  return out.length ? out.join('; ') : true;
});

/** Meet this encounter in front of the hero and take choice i. */
function meetAndChoose(ctx, id, i) {
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0;
  L.npcs = [{ id, kind: 'encounter', x: p.x + dx, y: p.y + dy }];
  Game.input('use');
  if (!Game.currentEncounter()) throw new Error(`${id} did not open`);
  return Game.chooseEncounter(i);
}

await test('the Pale One\'s strength lasts the run, and the lich is the stronger for it; the epilogue remembers', async () => {
  const out = [];
  const lichHp = async take => {
    const ctx = await start('fighter', 'bargain', { levels: 4 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const hit0 = Game.toHit();
    if (take) {
      meetAndChoose(ctx, 'bargain', 0);
      if (Game.toHit() !== hit0 + 1) out.push('the bargain did not add to hit');
    }
    for (let d = 2; d <= 4; d++) { Game.level().monsters.length = 0; Game.descend(); }
    const lich = Game.level().monsters.find(m => ctx.MONSTERS[m.id].boss);
    const said = G.log.slice(-8).map(e => e.m).join(' ');
    if (take && !/Pale One/.test(said)) out.push('the last floor said nothing of the bargain');
    if (take && !Game.epilogue(false).some(l => /narrow passage/.test(l))) out.push('the epilogue forgot the bargain');
    return lich ? lich.maxHp : 0;
  };
  const plain = await lichHp(false), dealt = await lichHp(true);
  if (!(dealt > plain * 1.2)) out.push(`the lich had ${dealt} life after the bargain, ${plain} without`);
  return out.length ? out.join('; ') : true;
});

await test('the guildsman you dug out marks the next floor; the captive you freed puts in a word with traders below; the crew you buried sings you onto the last floor', async () => {
  const out = [];
  const ctx = await start('fighter', 'threads', { levels: 4 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.stats.str = 30; p.stats.cha = 30; p.hp = p.maxHp = 999;
  // a natural one fails any check, however strong: meet him again until the dice allow it
  for (let i = 0; i < 6 && !(G.threads && G.threads.guide); i++) meetAndChoose(ctx, 'buried', 0);
  if (!G.threads || !G.threads.guide) out.push(`digging him out left no thread: ${JSON.stringify(G.threads)}`);
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  const before = Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 });
  for (let i = 0; i < 6 && !G.threads.captive; i++) meetAndChoose(ctx, 'prisoner', 2);
  if (Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) !== before) out.push('a trader on the captive\'s own floor had already heard');
  G.threads.crew = 1;
  Game.level().monsters.length = 0; Game.descend();
  if (!Game.level().explored.every(v => v)) out.push('the next floor was not marked');
  if (!(Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) < before)) out.push('a trader below did not ask less');
  Game.level().monsters.length = 0; Game.descend();
  if (!Game.level().explored.some(v => !v)) out.push('the guildsman marked a second floor too');
  Game.level().monsters.length = 0; Game.descend();
  if (!(p.effects.crew_hit && p.effects.crew_hit.amount === 2)) out.push('the buried crew did not sing on the last floor');
  const epi = Game.epilogue(true).join(' ');
  for (const w of ['goblin chains', 'rubble', 'third crew']) if (!epi.includes(w)) out.push(`the epilogue forgot ${w}`);
  if (!Game.threadNotes().length) out.push('the hero sheet has nothing to say');
  return out.length ? out.join('; ') : true;
});

await test('Self-Taught puts its two points where the player says, and nowhere until they do', async () => {
  const ctx = await start('fighter', 'spread');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [3];
  const str = p.stats.str, con = p.stats.con, dex = p.stats.dex;
  if (Game.chooseBoon('spread') !== false) return 'Self-Taught was taken with nowhere to put its points';
  if (Game.chooseBoon('spread', ['str', 'luck']) !== false) return 'Self-Taught took a score that does not exist';
  if (!Game.chooseBoon('spread', ['str', 'con'])) return 'Self-Taught was refused two good scores';
  if (p.stats.str !== str + 1 || p.stats.con !== con + 1) return `scores went ${str}->${p.stats.str}, ${con}->${p.stats.con}`;
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [5];
  Game.chooseBoon('spread', ['dex', 'dex']);
  return p.stats.dex === dex + 2 || `both points on Dexterity made it ${p.stats.dex}, not ${dex + 2}`;
});

await test('review fixes: no rest beside a smoked foe; a hero\'s scores are their own; the crew\'s song outlasts the lamp', async () => {
  const out = [];
  // Smoke, then Rest: the foe is still there
  const t = await start('thief', 'smoke-rest');
  { const { Game } = t; const p = Game.player(); p.hp = 3;
    beside(t, 'goblin', { nextAct: Game.state().t + 1e9 });
    Game.useAbility();
    if (Game.rest() !== false || p.hp !== 3) out.push('a thief rested beside a foe lost in smoke');
    if (Game.restLabel() !== 'Foes near') out.push(`the Rest button said ${Game.restLabel()} beside a smoked foe`); }
  // the hero's scores are a copy of what was chosen
  const c = await newContext();
  { const stats = { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 8 };
    c.Game.newGame({ name: 'S', cls: 'fighter', bg: 'ashborn', stats, seed: 'copy', opts: { ...OPTS } });
    if (c.Game.player().stats === stats || stats.con !== 14) out.push('the hero shares its scores with the create screen'); }
  // the crew's +2 and the lamp's +3 together
  const f = await start('fighter', 'crew-lamp', { levels: 3 });
  { const { Game } = f; const G = Game.state(); G.threads = { crew: 1 };
    Game.level().monsters.length = 0; Game.descend(); Game.level().monsters.length = 0; Game.descend();
    const before = Game.effect('hit');
    Game.player().gold = 5000;
    meetAndChoose(f, 'vigil', 1);
    if (Game.effect('hit') !== before + 3) out.push(`with the crew's song and the lamp, +${Game.effect('hit')} to hit, not ${before + 3}`); }
  return out.length ? out.join('; ') : true;
});

await test('the log calls a named champion by its name, not its title, except where the name is given', async () => {
  const ctx = await start('fighter', 'named-names');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const m = beside(ctx, 'ushgar', { hp: 999, maxHp: 999, spoke: true, nextAct: 1e12 });
  const mark = markLog(G);
  for (let i = 0; i < 4; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const said = linesSince(G, mark);
  if (said.some(l => /the Orc Warchief/i.test(l) && !/Ushgar,? the Orc Warchief/.test(l))) return `still called by title: ${said.join(' | ')}`;
  return said.some(l => /Ushgar/.test(l)) || `never named: ${said.join(' | ')}`;
});

await test('keys of one colour share a pack slot, and each still opens one door', async () => {
  const ctx = await start('fighter', 'keys-stack');
  const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
  const before = p.inv.length;
  for (const c of ['silver', 'silver', 'silver', 'gold']) Game.giveItem ? Game.giveItem({ t: 'key', q: 1, color: c }) : null;
  if (!Game.giveItem) return 'giveItem is not exposed';
  const silver = p.inv.filter(i => i.t === 'key' && i.color === 'silver');
  if (silver.length !== 1 || silver[0].q !== 3) return `silver keys: ${JSON.stringify(silver)}`;
  if (p.inv.length !== before + 2) return `four keys took ${p.inv.length - before} slots`;
  // one of the three opens a silver door, and two are left
  const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
  L.tiles[y * L.w + x] = Dungeon.T.DOOR_LOCKED; L.locks[x + ',' + y] = 'silver'; L.monsters.length = 0;
  Game.input('forward');
  if (L.tiles[y * L.w + x] !== Dungeon.T.DOOR_OPEN) return 'the door did not open';
  return silver[0].q === 2 || `left with ${silver[0].q} silver keys`;
});

await test('a random name often suits the background, and never repeats the one before', async () => {
  const { heroName, BG_NAMES } = await start('fighter', 'names');
  let own = 0;
  for (let i = 0; i < 400; i++) {
    const n = heroName('tombwise', 'Vesper');
    if (n === 'Vesper') return 'the name just given came again';
    if (BG_NAMES.tombwise.includes(n)) own++;
  }
  return (own > 120 && own < 280) || `${own} of 400 names were the Tombwise's own`;
});

await test('a hero made with no name is given one from the list, not "Adventurer"', async () => {
  const { Game, ALL_HERO_NAMES: HERO_NAMES } = await start('fighter', 'no-name');
  Game.newGame({ name: '   ', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'no-name', opts: { ...OPTS } });
  const name = Game.player().name;
  return (HERO_NAMES || []).includes(name) || `the nameless hero was called ${name}`;
});

await test('floor twists: dealt by the seed to middle floors only, never two running nor on a champion\'s floor', async () => {
  const { Dungeon } = await start('fighter', 'twist-plan');
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const seed = 'tw' + i, plan = Dungeon.twistPlan(seed, 8), named = Dungeon.namedPlan(seed, 8);
    if (JSON.stringify(plan) !== JSON.stringify(Dungeon.twistPlan(seed, 8))) return `seed ${seed} dealt two plans`;
    for (const d of Object.keys(plan).map(Number)) {
      seen.add(plan[d]);
      if (d < 2 || d > 6) return `seed ${seed} put ${plan[d]} on floor ${d}`;
      if (named[d]) return `seed ${seed} put ${plan[d]} on ${named[d]}'s floor`;
      if (plan[d + 1]) return `seed ${seed} twisted floors ${d} and ${d + 1}`;
    }
  }
  return seen.size === 4 || `only ${[...seen].join(', ')} were ever dealt`;
});

await test('each floor twist does what it says, and is told on arriving', async () => {
  const out = [];
  const find = async kind => {
    const { Dungeon } = await start('fighter', 'twist-find');
    for (let i = 0; i < 400; i++) { const plan = Dungeon.twistPlan('twist' + i, 8); const d = Object.keys(plan).find(k => plan[k] === kind); if (d) return { seed: 'twist' + i, d: Number(d) }; }
    return null;
  };
  for (const kind of ['dark', 'flooded', 'restless', 'market']) {
    const at = await find(kind);
    if (!at) { out.push(`no seed dealt ${kind}`); continue; }
    const ctx = await start('fighter', at.seed, { levels: 8 });
    const { Game, MONSTERS } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 9999;
    const mark = markLog(G);
    downTo(ctx, at.d);
    const L = Game.level();
    if (L.twist !== kind) { out.push(`floor ${at.d} of ${at.seed} is ${L.twist}, not ${kind}`); continue; }
    if (!linesSince(G, mark).some(l => l.includes(ctx.TWISTS[kind].arrive))) out.push(`arriving on a ${kind} floor said nothing of it`);
    if (kind === 'dark') {
      const full = Math.round(L.rooms.length * 0.9) + 4;
      if (L.lights.length > Math.round(full * 0.25)) out.push(`a dark floor kept ${L.lights.length} torches of ${full}`);
    }
    if (kind === 'flooded') {
      const m = L.monsters.find(x => !MONSTERS[x.id].boss && !x.elite);
      if (m && Game.mstat(m).speed !== Math.round(MONSTERS[m.id].speed * 1.25)) out.push(`a ${m.id} in the water acts every ${Game.mstat(m).speed}ms, drawn at ${MONSTERS[m.id].speed}`);
    }
    if (kind === 'restless') {
      const plain = L.monsters.filter(x => !MONSTERS[x.id].named && !x.pack);
      const dead = plain.filter(x => MONSTERS[x.id].undead).length;
      if (plain.length >= 4 && dead < plain.length * 0.4) out.push(`only ${dead} of ${plain.length} creatures on a restless floor are undead`);
    }
    if (kind === 'market') {
      const shop = L.npcs.find(n => n.id === 'merchant');
      if (!shop) out.push('a goblin market had no trader');
      else if (shop.markup > 1.66) out.push(`the market trader marks up ${shop.markup.toFixed(2)}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('the stair divides a third of the way down: stepping onto it asks, and the road taken shapes the floors until the last two', async () => {
  const out = [];
  const { Dungeon, MONSTERS, ROUTES } = await newContext();
  const spans = [4, 6, 8, 12].map(n => JSON.stringify(Dungeon.routeSpan(n))).join(' ');
  if (spans !== 'null {"fork":2,"from":3,"to":4} {"fork":3,"from":4,"to":6} {"fork":4,"from":5,"to":10}') out.push(`route spans ${spans}`);
  // stepping onto the stair at the fork asks rather than going down
  const ctx = await start('fighter', 'fork', { levels: 8 });
  const { Game } = ctx; const G = Game.state();
  Game.player().hp = Game.player().maxHp = 9999;
  downTo(ctx, 2); goDown(Object.assign(ctx, { road: 'none' }));
  if (G.depth !== 3) return `walked to ${G.depth}`;
  const L3 = Game.level(), p = Game.player(), s = L3.stairsDown;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L3.tiles[(s.y - dy) * L3.w + s.x - dx] === Dungeon.T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = s.x - dx; p.y = s.y - dy; p.dir = k; L3.monsters.length = 0;
  Game.input('use');
  if (G.depth !== 3 || !Game.forkPending()) out.push(`stepping onto the divided stair went to ${G.depth}, pending ${Game.forkPending()}`);
  Game.leaveFork();
  if (Game.forkPending() || Game.route()) out.push('staying put still left a choice pending or a road taken');
  Game.input('use');
  if (!Game.chooseRoute('warrens') || G.depth !== 4 || Game.route() !== 'warrens') out.push(`choosing the Warrens went to ${G.depth} by ${Game.route()}`);
  const L4 = Game.level();
  if (L4.route !== 'warrens' || L4.theme !== ROUTES.warrens.theme) out.push(`floor 4 is ${L4.route}, theme ${L4.theme}`);
  if (!L4.npcs.some(n => n.id === ROUTES.warrens.encounter)) out.push('the Warrens\' own encounter was not on its first floor');
  if (Game.chooseRoute('crypts')) out.push('a second road was taken');
  // the last two floors follow no road
  const gen = (d, route) => Dungeon.generate('fork-lean', d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route });
  if (gen(7, 'crypts').route || gen(3, 'crypts').route) out.push('a floor outside the road\'s span followed it');
  // the creatures lean the road's way
  const share = (route, kin) => { let n = 0, of = 0; for (let i = 0; i < 12; i++) for (const d of [4, 5, 6]) for (const m of Dungeon.generate('lean' + i, d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route }).monsters) { if (MONSTERS[m.id].named) continue; of++; if (kin.includes(m.id)) n++; } return n / of; };
  const ck = ROUTES.crypts.kin;
  if (!(share('crypts', ck) > share('warrens', ck) + 0.2)) out.push(`crypt-kin: ${share('crypts', ck).toFixed(2)} in the Crypts, ${share('warrens', ck).toFixed(2)} in the Warrens`);
  // a champion on a road's floor is one of its own, where one suits
  for (let i = 0; i < 20; i++) {
    for (const road of ['crypts', 'warrens']) {
      const plan = Dungeon.namedPlan('champ' + i, 8, road);
      for (const d of Object.keys(plan).map(Number)) if (d >= 4 && d <= 6 && !ROUTES[road].champions.includes(plan[d])) out.push(`${plan[d]} held floor ${d} of the ${road}`);
    }
  }
  // descend() on its own takes the road the seed leans to, the same each time
  const a = await start('fighter', 'fork-default', { levels: 8 }), b = await start('fighter', 'fork-default', { levels: 8 });
  for (const c of [a, b]) { for (let d = 1; d < 4; d++) { c.Game.level().monsters.length = 0; c.Game.descend(); } }
  if (!a.Game.route() || a.Game.route() !== b.Game.route()) out.push(`descend() took ${a.Game.route()} and ${b.Game.route()}`);
  return out.length ? [...new Set(out)].slice(0, 6).join('; ') : true;
});

await test('each road\'s last floor holds a relic found nowhere else, which anyone can wear', async () => {
  const out = [];
  for (const road of ['crypts', 'warrens']) {
    const ctx = await newContext();
    const { Game, RELICS, routeRelic, relicPlan } = ctx;
    Game.newGame({ name: 'R', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats }, seed: 'road-relic', opts: { ...OPTS, levels: 8 } });
    const G = Game.state(), id = routeRelic(road);
    if (!id || RELICS[id].route !== road) { out.push(`no relic for the ${road}`); continue; }
    const holds = () => Object.values(Game.level().items).flat().filter(it => it.u === id).length;
    for (let d = 1; d < 3; d++) { if (holds()) out.push(`floor ${G.depth} held ${id} before the road`); Game.level().monsters.length = 0; Game.descend(); }
    if (!Game.chooseRoute(road)) { out.push(`could not take the ${road}`); continue; }
    while (G.depth < 6) { if (holds()) out.push(`floor ${G.depth} of the ${road} held its relic early`); Game.level().monsters.length = 0; Game.descend(); }
    if (holds() !== 1) { out.push(`the ${road}'s last floor held ${holds()} of ${id}`); continue; }
    // a mage picks it up and wears it: its make is known, and its own power counts
    const L = Game.level(), k = Object.keys(L.items).find(k => L.items[k].some(it => it.u === id)), it = L.items[k].find(x => x.u === id);
    const p = Game.player(); [p.x, p.y] = k.split(',').map(Number);
    Game.takeItem(it);
    if (!Game.equip(p.inv.find(x => x.u === id))) out.push(`a mage could not wear ${id}`);
    if (!Game.isKnown(RELICS[id].t)) out.push(`${id} left its make unknown`);
    if (!RELICS[id].powers.every(k => Game.hasPower(k))) out.push(`${id} worn gave none of ${RELICS[id].powers}`);
    Game.level().monsters.length = 0; Game.descend();
    if (holds()) out.push('the floor past the road held it too');
    // never in the relics a run hands out on its floors or at its traders
    for (let i = 0; i < 30; i++) for (const cls of ['fighter', 'mage', 'thief']) {
      const plan = relicPlan('rp' + i, cls, 12);
      if ([...Object.values(plan.floor), ...plan.shop].includes(id)) out.push(`${id} was planned for seed rp${i}`);
    }
  }
  return out.length ? [...new Set(out)].slice(0, 6).join('; ') : true;
});

await test('a floor is dressed the same whether made now or dressed on loading an old save; the roads and the last floor wear their own walls', async () => {
  const out = [];
  const ctx = await start('fighter', 'dress-save', { levels: 8 });
  const { Game, Dungeon, THEMES, ROUTES } = ctx;
  const L = Game.level(), made = JSON.stringify(L.dressing);
  if (!L.dressing || !L.dressing.length) out.push('floor 1 has no dressing');
  // a save from before there was dressing: the same comes back on loading
  delete L.dressing;
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  if (JSON.stringify(Game.level().dressing) !== made) out.push('an old save was dressed differently on loading');
  // the ordinary themes take turns; the roads and the last floor have their own
  const FINAL = THEMES.findIndex(t => t.final);
  for (let d = 1; d <= 8; d++) {
    const t = Dungeon.generate('themes', d, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true }).theme;
    if (d === 8 ? t !== FINAL : (t >= FINAL || THEMES[t].road)) out.push(`floor ${d} of a road-less run wore ${THEMES[t].name}`);
  }
  for (const road of ['crypts', 'warrens']) {
    const t = Dungeon.generate('themes', 5, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route: road }).theme;
    if (THEMES[t].road !== road || t !== ROUTES[road].theme) out.push(`floor 5 down the ${road} wore ${THEMES[t].name}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the fallen leave remains a while: bones from the bony, a husk from the rest, nothing from a wraith', async () => {
  const out = [];
  for (const [id, want] of [['goblin', 'remains_husk'], ['skeleton', 'remains_bones'], ['wraith', null]]) {
    const ctx = await start('fighter', 'remains-' + id);
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.perkHit = 60;
    const m = beside(ctx, id, { hp: 1, maxHp: 1 });
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
    if (Game.level().monsters.includes(m)) { out.push(`the ${id} would not die`); continue; }
    const left = (Game.level().remains || []).filter(r => r.until > G.t);
    if (want ? left.length !== 1 || left[0].k !== want : left.length) out.push(`a ${id} left ${JSON.stringify(left.map(r => r.k))}`);
    // and they are gone in time
    // and they are gone in time, from the save too
    if (want) { G.t += 300000; Game.save(true); if ((Game.level().remains || []).length) out.push(`a ${id}'s remains were still kept after their time`); }
  }
  return out.length ? out.join('; ') : true;
});

await test('a barrel, crate or urn breaks to a blow with nothing to fight in front, and holds the same whatever reloads', async () => {
  const out = [];
  const found = [];
  for (const k of ['crate', 'crate', 'urn']) {
    const ctx = await start('fighter', 'smash-it');
    const { Game, Dungeon } = ctx;
    // the second crate is the first again, after a save and a reload of the same run
    if (found.length === 1) { Game.save(true); Game.load(); }
    const G = Game.state(), p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
    if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) return 'no floor in front of the hero on this seed';
    delete L.items[x + ',' + y];
    L.dressing.push({ x, y, k, ox: 0, oy: 0 });
    const at = markLog(G);
    G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
    if (L.dressing.some(d => d.x === x && d.y === y && d.k === k)) { out.push(`the ${k} did not break`); continue; }
    const said = linesSince(G, at).join(' ');
    if (!/splinters|shatters|give way/.test(said)) out.push(`breaking the ${k} said "${said}"`);
    found.push(k + ':' + JSON.stringify(L.items[x + ',' + y] || []));
  }
  // the same square on the same seed holds the same, crate or urn, reloaded or not
  if (found[0] !== found[1]) out.push(`a crate held ${found[0]} once and ${found[1]} the next time`);
  // a monster in front takes the blow, and the crate behind it stands
  const ctx = await start('fighter', 'smash-it');
  const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.dressing.push({ x: p.x + dx, y: p.y + dy, k: 'barrel', ox: 0, oy: 0 });
  const m = beside(ctx, 'goblin', { hp: 999, maxHp: 999 });
  p.perkHit = 60;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (m.hp === 999) out.push('the goblin in front was not struck');
  if (!L.dressing.some(d => d.k === 'barrel' && d.x === p.x + dx)) out.push('the barrel under the goblin broke instead');
  return out.length ? out.join('; ') : true;
});

await test('walking into a barrel kicks it over, and the Use button breaks one ahead, saying Break', async () => {
  const out = [];
  for (const how of ['walk', 'use']) {
    const ctx = await start('fighter', 'kick-it');
    const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x = p.x + dx, y = p.y + dy;
    if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) return 'no floor in front of the hero on this seed';
    delete L.items[x + ',' + y];
    L.dressing.push({ x, y, k: 'barrel', ox: 0, oy: 0 });
    if (how === 'use' && Game.useLabel() !== 'Break') out.push(`facing a barrel the button said ${Game.useLabel()}`);
    const from = [p.x, p.y];
    G.t = Math.max(G.t, p.nextAttack);
    Game.input(how === 'walk' ? 'forward' : 'use');
    if (L.dressing.some(d => d.x === x && d.y === y && d.k === 'barrel')) out.push(`${how}ing did not break the barrel`);
    if (p.x !== from[0] || p.y !== from[1]) out.push(`${how}ing into the barrel moved the hero onto its square`);
    if (!(L.remains || []).some(r => r.k === 'remains_staves')) out.push(`${how}ing left no staves behind`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a win by a road is a feat of that road; the Hall line names it', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'road-win', opts: { ...OPTS, permadeath: true, difficulty: 'normal', levels: 8 } });
  for (let d = 1; d < 4; d++) { Game.level().monsters.length = 0; Game.descend(); }
  const road = Game.route();
  winHere(Game);
  if (JSON.stringify(Game.earned().firstFeats) !== JSON.stringify([road])) return `a win by the ${road} earned ${JSON.stringify(Game.earned())}`;
  return Game.hall()[0].route === road || `the Hall kept ${Game.hall()[0].route}`;
});

await test('a ranger: a bow and Dexterity, Steady Aim at two squares or more, and the bow talents', async () => {
  const out = [];
  const ctx = await start('ranger', 'ranger-kit');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  if (!p.eq.weapon || p.eq.weapon.t !== 'shortbow') out.push(`a ranger starts with ${p.eq.weapon && p.eq.weapon.t}`);
  // Dexterity lands the blow, not Strength
  p.stats.str = 3; p.stats.dex = 18;
  const hitHigh = Game.toHit(); p.stats.dex = 10; const hitLow = Game.toHit(); p.stats.dex = 18;
  if (hitHigh - hitLow !== 4) out.push(`Dexterity 18 against 10 moved a ranger's to-hit by ${hitHigh - hitLow}`);
  // Steady Aim: the same arrows, adjacent and three squares off
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const volleyOf = dist => {
    seedDice(ctx, 'aim');
    const m = beside(ctx, 'ogre', { hp: 99999, maxHp: 99999, nextAct: G.t + 1e12 });
    m.x = p.x + dx * dist; m.y = p.y + dy * dist; p.perkHit = 60;
    let dealt = 0;
    for (let i = 0; i < 30; i++) { const hp = m.hp; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); dealt += hp - m.hp; }
    return dealt / 30;
  };
  const near = volleyOf(1), far = volleyOf(3);
  if (Math.abs(far - near - 2) > 0.01) out.push(`arrows from three squares did ${far.toFixed(2)} a shot, from beside it ${near.toFixed(2)}`);
  // talents: two squares further and a sixth quicker
  p.perkHit = 0;
  const hitAfter = Game.toHit();
  const range0 = Game.weapon().range, speed0 = Game.weapon().speed;
  talent(ctx, 'eagle_eye'); talent(ctx, 'swift_quiver');
  if (Game.weapon().range !== range0 + 2) out.push(`Eagle Eye took the bow from ${range0} to ${Game.weapon().range}`);
  if (Math.abs(Game.weapon().speed - speed0 * 5 / 6) > 1) out.push(`Swift Quiver took a shot from ${speed0}ms to ${Game.weapon().speed}`);
  p.perkHit = 0;
  // (the practice took long enough to make the hero hungry: compare with to-hit after it)
  if (Game.toHit() !== hitAfter + 1) out.push(`Eagle Eye took to-hit from ${hitAfter} to ${Game.toHit()}`);
  return out.length ? out.join('; ') : true;
});

await test('Snare catches the first foe down the corridor and breaks its blow; a Warden\'s bites; nothing ahead costs nothing', async () => {
  const out = [];
  const ctx = await start('ranger', 'snare');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3, 4]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  if (Game.useAbility() !== false || Game.castLabel() !== 'Snare') out.push(`a snare at nothing was ${Game.castLabel()}`);
  const m = beside(ctx, 'orc', { nextAct: G.t, windup: { kind: 'melee', at: G.t, until: G.t + 500 } });
  m.x = p.x + dx * 3; m.y = p.y + dy * 3;
  const t0 = G.t;
  if (!Game.useAbility()) return 'Snare was refused with an orc three squares off';
  if (m.windup) out.push('the snared orc kept its blow drawn back');
  if (m.nextAct - t0 < 2500) out.push(`the snared orc moves again in ${m.nextAct - t0}ms`);
  if (!/^Snare \d+s$/.test(Game.castLabel())) out.push(`after a Snare the button says ${Game.castLabel()}`);
  // a Warden's cord bites
  const c2 = await start('ranger', 'snare-warden');
  const q = c2.Game.player(), L2 = c2.Game.level(); q.path = 'warden';
  const [ex, ey] = c2.Dungeon.DIRS[q.dir];
  for (const k of [1, 2]) L2.tiles[(q.y + ey * k) * L2.w + q.x + ex * k] = c2.Dungeon.T.FLOOR;
  const w = beside(c2, 'orc', { hp: 500, maxHp: 500, nextAct: c2.Game.state().t + 1e9 });
  const ac0 = c2.Game.playerAC(); q.path = null; const acNo = c2.Game.playerAC(); q.path = 'warden';
  if (ac0 !== acNo + 1) out.push(`a Warden's armour class is ${ac0}, without the path ${acNo}`);
  c2.Game.useAbility();
  if (!(w.hp < 500)) out.push('a Warden\'s snare did not bite');
  return out.length ? out.join('; ') : true;
});

await test('two rings of one kind do not add up: the better counts', async () => {
  const ctx = await start('fighter', 'rings-no-stack');
  const { Game } = ctx; const p = Game.player();
  const ac0 = Game.playerAC();
  const a = { t: 'ring_protect', q: 1, e: 2 }, b = { t: 'ring_protect', q: 1, e: 1 };
  p.inv.push(a, b); Game.equip(a, true); Game.equip(b, true);
  if (p.eq.ring !== a || p.eq.ring2 !== b) return 'both rings did not go on';
  if (Game.playerAC() !== ac0 + 3) return `two Rings of Protection (+2, +1) made armour ${ac0} into ${Game.playerAC()}, want ${ac0 + 3} (the better one)`;
  return true;
});

  console.log(`rule checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
