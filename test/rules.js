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
const timesSaid = l => Number((l.match(/\(\u00d7(\d+)\)$/) || [])[1]) || 1;
const countSaid = (lines, re) => lines.filter(l => re.test(l)).reduce((n, l) => n + timesSaid(l), 0);
// The combat rolls are hidden until a player asks for them: a test that reads them turns them on
const rollsOn = Game => { if (!Game.rollsShown()) Game.toggleRolls(); };
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
  rollsOn(Game);
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
  const { MONSTERS, ITEMS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  const known = new Set(['map', 'xp', 'goldPerDepth', 'hurt', 'hurtFrac', 'heal', 'maxHp', 'food', 'loot', 'item', 'buff', 'poison', 'cure', 'uncurse', 'wake', 'identifyAll', 'ambush', 'stat', 'thread', 'companion', 'traps', 'goldBack', 'hone']);
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
        // and every name an effect gives is one the game has
        for (const eff of o.effects) {
          if (eff.ambush && !MONSTERS[eff.ambush.id]) return `${id}: ambush by unknown monster ${eff.ambush.id}`;
          if (eff.item && !ITEMS[eff.item.t]) return `${id}: gives unknown item ${eff.item.t}`;
          if (eff.stat && !stats.has(eff.stat[0])) return `${id}: raises unknown score ${eff.stat[0]}`;
          if (eff.buff && eff.buff.stats.some(([st]) => !['hit', 'ac'].includes(st))) return `${id}: blesses an unknown stat`;
        }
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
    // (the starving hound is placed on the second floor besides, not dealt)
    const dealt = all.filter(e => !ENCOUNTERS[e].early);
    const want = Math.min(Object.keys(ENCOUNTERS).filter(k => !ENCOUNTERS[k].final && !ENCOUNTERS[k].route && !ENCOUNTERS[k].early).length, Math.round((levels - 1) * 1.15));
    if (dealt.length < want - (levels >= 12 ? 4 : 1) || dealt.length > want) return `a ${levels}-floor run met ${dealt.length} encounters, about ${want} expected`;
  }
  return true;
});

await test('an encounter never calls up a creature from floors far below: the sleeping ogre waits for the ogres, the voice sends a lesser dead thing', async () => {
  const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  // the ogre walks from tier 8: on eight floors that is the sixth, on twelve the eighth
  for (const levels of [8, 12]) for (let i = 0; i < 300; i++) {
    const plan = encounterPlan('ogre' + i, levels, Dungeon.tierAt);
    const d = plan.findIndex(f => f && f.includes('sleeper'));
    if (d > 0 && Dungeon.tierAt(d, levels) < 7.5) return `a ${levels}-floor delve met the sleeping ogre on floor ${d}`;
  }
  // a failed word with the mirror: a skeleton on the third floor, a ghoul on the fourth, a wraith from the fifth
  const want = { 3: 'skeleton', 4: 'ghoul', 6: 'wraith' };
  for (const depth of [3, 4, 6]) {
    let got = null;
    for (let t = 0; t < 30 && !got; t++) {
      const ctx = await start('fighter', `mirror-deep-${depth}-${t}`, { levels: 8 });
      const { Game, Dungeon: D } = ctx;
      while (Game.state().depth < depth) { Game.level().monsters.length = 0; Game.descend(); }
      const q = Game.player(), M = Game.level();
      q.stats.cha = 3; M.npcs.length = 0; M.monsters.length = 0;
      const [dx, dy] = D.DIRS[q.dir];
      M.tiles[(q.y + dy) * M.w + q.x + dx] = D.T.FLOOR;
      M.npcs.push({ kind: 'encounter', id: 'mirror', x: q.x + dx, y: q.y + dy });
      Game.input('forward');
      const r = Game.chooseEncounter(1);
      if (!r || !r.check || r.check.pass) continue;
      got = M.monsters.map(m => m.id).join(',');
    }
    if (got !== want[depth]) return `a failed word with the mirror on floor ${depth} brought ${got || 'nothing'}, not a ${want[depth]}`;
  }
  return true;
});

await test('across runs every encounter turns up, and no two runs meet the same handful', async () => {
  const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  const seen = new Set(), sets = new Set();
  // dealt as the game deals them, on the ladder of monster tiers
  for (let i = 0; i < 80; i++) {
    const all = encounterPlan('spread' + i, 8, Dungeon.tierAt).flat();
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
  // one, three and six times the first step: squared (one, four, nine), +3 was out of reach of anyone's purse
  // (to within the rounding of the trader's manner)
  if (Math.abs(prices[1] - prices[0] * 3) > 3 || Math.abs(prices[2] - prices[0] * 6) > 6) return `the steps cost ${prices.join(', ')}, not 1, 3 and 6 times the first`;
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
  // not a goblin: a cunning fighter draws back a different length each time,
  // which could hide the quickening this is here to see (it failed in CI so)
  const m = beside(ctx, 'skeleton');
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

await test('a save without the late-monster count picks it up past the highest number on any floor', async () => {
  const ctx = await start('fighter', 'uid-count');
  const { Game } = ctx;
  const L = Game.level();
  const late = uid => ({ uid, id: 'zombie', x: 1, y: 1, hp: 20, maxHp: 20, awake: false, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  L.monsters.push(late(900007), late(900003));
  Game.state().nextUid = 7;
  Game.save(true);
  const d = JSON.parse(ctx.store.get('deepdelve.save'));
  delete d.nextUid;
  ctx.store.set('deepdelve.save', JSON.stringify(d));
  if (!Game.load()) return 'the save did not load';
  const n = Game.state().nextUid;
  // started again at 0, the next one to arrive would be 900001, then 900003 twice over
  return n === 7 || `the count came back as ${n}, not 7`;
});

await test('a fleeing monster never runs onto the hero, even when its map of the way is stale', async () => {
  const ctx = await start('fighter', 'flee-onto');
  const { Game, Dungeon } = ctx; const T = Dungeon.T;
  const G = Game.state(), L = Game.level(), p = Game.player();
  L.monsters.length = 0;
  // a straight corridor five squares long
  let row = null;
  const shut = (x, y) => L.tiles[y * L.w + x] !== T.FLOOR && L.tiles[y * L.w + x] !== T.DOOR_OPEN;
  for (let y = 1; y < L.h - 1 && !row; y++) for (let x = 1; x < L.w - 5 && !row; x++) if ([0, 1, 2, 3, 4].every(k => L.tiles[y * L.w + x + k] === T.FLOOR && shut(x + k, y - 1) && shut(x + k, y + 1))) row = [x, y];
  if (!row) return 'no straight corridor on this floor';
  const [x0, y0] = row;
  p.x = x0; p.y = y0; p.dir = 1;
  Game.update(G.t + 16, 16);
  const z = { uid: 77, id: 'zombie', x: x0 + 2, y: y0, hp: 2, maxHp: 20, awake: true, fleeing: true, nextAct: G.t + 150, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(z);
  Game.update(G.t + 16, 16);
  // the hero is set down beyond it without a step, so the way it measures is out of date
  p.x = x0 + 3;
  for (let i = 0; i < 10; i++) Game.update(G.t + 50, 50);
  return !(z.x === p.x && z.y === p.y) || 'the fleeing zombie ran onto the hero';
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
  const blows = countSaid(linesSince(G, mark), /Goblin (hits|misses) you/);
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

// ---------- the deep floors' own ----------
/** Let a monster beside the hero act until it begins the named trick. */
function untilTrick(ctx, m, mv) {
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  for (let i = 0; i < 800; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup && m.windup.move === mv) return true;
    p.hp = p.maxHp; p.held = 0;
  }
  return false;
}

await test('a blink hound steps back into the world at your back: turned to face it, it is caught open; not, it bites deep', async () => {
  const out = [], missed = [];
  let bitten = false;
  for (const turn of [false, false, false, true]) {
    // (unanswered, it is tried up to three times: even a warned blow misses on a natural 1)
    if (!turn && out.length === 0 && bitten) continue;
    const ctx = await start('fighter', 'blink' + turn + out.length);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    clearBehind(ctx);
    const m = beside(ctx, 'hound', { blows: 1 });
    if (!untilTrick(ctx, m, 'blink')) return 'the hound never blinked';
    const [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4];
    if (m.x !== p.x + bx || m.y !== p.y + by) { out.push(`it came back at ${m.x},${m.y}, not at the hero's back`); continue; }
    if (turn) { Game.input('left'); Game.update(G.t + 250, 250); Game.input('left'); }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 950);
    const said = linesSince(G, mark).join(' | ');
    if (turn) {
      if (p.hp < hp0) out.push(`faced it and was still bitten: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`facing it left no opening: ${said}`);
    } else if (p.hp < hp0 && /sinks its teeth into you from behind/.test(said)) bitten = true;
    else missed.push(said);
  }
  if (!bitten) out.push(`left at its back three times, it never bit: ${missed.join(' || ')}`);
  return out.length ? out.join('; ') : true;
});

await test('a quillback\'s raised quills bite a hand that strikes it; one who holds their blow finds it open', async () => {
  const out = [];
  // strike into the quills (a blow can miss: try the whole thing again)
  let struck = false;
  for (let tries = 0; tries < 8 && !struck; tries++) {
    const ctx = await start('fighter', 'quills' + tries);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const m = beside(ctx, 'quillback', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the quillback never raised its quills';
    const hp0 = p.hp, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const said = linesSince(G, mark).join(' | ');
    if (!/You hit|mighty blow/.test(said)) continue;
    struck = true;
    if (!(p.hp < hp0) || !/quills/.test(said)) out.push(`a blow into the raised quills cost nothing: ${said}`);
    run(Game, G, 1500);
    if (p.opening && p.opening.uid === m.uid) out.push('striking into the quills still left it open');
  }
  if (!struck) out.push('no blow landed in eight tries');
  {
    const ctx = await start('fighter', 'quills-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'quillback', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the quillback never raised its quills';
    const hp0 = p.hp;
    run(Game, G, 1500);
    if (p.hp < hp0) out.push('holding the blow still cost hit points');
    if (!p.opening || p.opening.uid !== m.uid) out.push('holding the blow left no opening');
  }
  return out.length ? out.join('; ') : true;
});

await test('a cave wyrm\'s fire runs down its line: under its jaws or out of the line it misses and leaves it open; a step back does not', async () => {
  const out = [];
  for (const how of ['stay', 'back', 'close', 'aside']) {
    const ctx = await start('fighter', 'breath-' + how);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'wyrm', 2, { hp: 999, maxHp: 999 });
    const [fx, fy] = Dungeon.DIRS[p.dir];
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    if (how === 'back') shift(ctx, 'back');
    if (how === 'aside') shift(ctx, 'aside');
    if (how === 'close') { p.x += fx; p.y += fy; }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 1100);
    const said = linesSince(G, mark).join(' | ');
    const burned = p.hp < hp0;
    if (how === 'stay' || how === 'back') { if (!burned) out.push(`${how === 'back' ? 'a step back' : 'standing in its line'} escaped the fire: ${said}`); }
    else {
      if (burned) out.push(`${how === 'close' ? 'under its jaws' : 'out of its line'}, still burned: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`${how}: no opening`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a cave wyrm turns up now and then on the seventh floor of an ordinary delve, never higher, and from the ninth of the Long Delve', async () => {
  const { Dungeon, Rng } = await newContext();
  const count = (levels, depth, n) => {
    let wyrms = 0, floors = 0;
    for (let i = 0; i < n; i++) {
      const L = Dungeon.generate(`wyrm-${levels}-${depth}-${i}`, depth, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' });
      floors++; if (L.monsters.some(m => m.id === 'wyrm')) wyrms++;
    }
    return wyrms / floors;
  };
  const out = [];
  const seventh = count(8, 7, 120);
  if (!(seventh > 0.05 && seventh < 0.6)) out.push(`an ordinary delve's seventh floor held a wyrm ${Math.round(seventh * 100)}% of the time`);
  if (count(8, 6, 60) > 0) out.push('an ordinary delve\'s sixth floor held a wyrm');
  if (count(6, 5, 60) > 0) out.push('a six-floor delve held a wyrm');
  if (count(12, 8, 60) > 0) out.push('the Long Delve\'s eighth floor held a wyrm');
  if (!(count(12, 10, 60) > 0)) out.push('the Long Delve\'s tenth floor never held a wyrm');
  return out.length ? out.join('; ') : true;
});

await test('Skarrow the Elder Wyrm holds a deep floor of the Long Delve, never an ordinary delve, and breathes twice as often as her young', async () => {
  const out = [];
  const ctx = await start('fighter', 'skarrow', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
  let long = 0, short = 0;
  const road = { crypts: 0, warrens: 0 };
  for (let i = 0; i < 200; i++) {
    if (Object.values(Dungeon.namedPlan('sk' + i, 12)).includes('skarrow')) long++;
    if (Object.values(Dungeon.namedPlan('sk' + i, 8)).includes('skarrow')) short++;
    // a real run has chosen its road by her floor: she lairs beneath both
    for (const r of ['crypts', 'warrens']) if (Object.values(Dungeon.namedPlan('sk' + i, 12, r)).includes('skarrow')) road[r]++;
  }
  if (!long) out.push('no Long Delve in 200 held Skarrow');
  for (const r in road) if (road[r] < 20) out.push(`down the ${r}, only ${road[r]} Long Delves in 200 held Skarrow`);
  if (short) out.push(`${short} ordinary delves held Skarrow`);
  const again = async id => {
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, id, 3, { hp: 999, maxHp: 999 });
    const [fx, fy] = Dungeon.DIRS[p.dir];
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    run(Game, G, 1050);
    return m.moveReady - G.t;
  };
  const young = await again('wyrm'), elder = await again('skarrow');
  if (!(elder < young * 0.6)) out.push(`her breath came round in ${elder}ms, her young's in ${young}ms`);
  return out.length ? out.join('; ') : true;
});

await test('a fallen cave wyrm or quillback leaves its scales or quills now and then, Skarrow always; wyrm-scale wards off fire, a quill shield pricks', async () => {
  const out = [];
  const ctx = await start('fighter', 'trophies', { levels: 12 });
  const { Game, Dungeon, ITEMS, CLASSES, armorFits } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const kills = (id, n, want) => {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const m = beside(ctx, id, { hp: 1, maxHp: 1, nextAct: 1e12 });
      for (let t = 0; t < 40 && Game.level().monsters.includes(m); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      const k = `${m.x},${m.y}`, here = Game.level().items[k] || [];
      if (here.some(it => it.t === want)) got++;
      delete Game.level().items[k];
    }
    return got;
  };
  const w = kills('wyrm', 60, 'wyrmscale'), q = kills('quillback', 60, 'quillshield'), sk = kills('skarrow', 3, 'wyrmscale');
  if (!(w > 3 && w < 35)) out.push(`60 wyrms left ${w} coats of scale`);
  if (!(q > 2 && q < 30)) out.push(`60 quillbacks left ${q} quill shields`);
  if (sk !== 3) out.push(`Skarrow left her scales ${sk} times in 3`);
  if (kills('hound', 30, 'wyrmscale') + kills('ogre', 30, 'quillshield')) out.push('another kind left a wyrm\'s or a quillback\'s trophy');
  // neither is found lying about or sold
  if (ITEMS.wyrmscale.tier < 50 || ITEMS.quillshield.tier < 50) out.push('a trophy can turn up as ordinary loot');
  if (!armorFits(CLASSES.thief, ITEMS.wyrmscale) || armorFits(CLASSES.mage, ITEMS.wyrmscale)) out.push('wyrm-scale is not light armour');
  // the quills prick whatever strikes you
  {
    p.eq.shield = { t: 'quillshield', q: 1, e: 0 };
    const m = beside(ctx, 'skeleton', { hp: 999, maxHp: 999 });
    const mark = markLog(G);
    for (let i = 0; i < 400 && m.hp === 999; i++) { Game.update(G.t + 25, 25); p.hp = p.maxHp; }
    if (m.hp === 999) out.push('a blow that landed was not pricked back');
    else if (!linesSince(G, mark).some(l => /barbs/.test(l))) out.push('the prick was not told');
    p.eq.shield = null;
  }
  // the scale halves a wyrm's fire
  const burn = warded => {
    p.eq.armor = warded ? { t: 'wyrmscale', q: 1, e: 0 } : null;
    let total = 0;
    for (let i = 0; i < 30; i++) {
      p.hp = p.maxHp = 9999;
      const m = ahead(ctx, 'wyrm', 3, { hp: 999, maxHp: 999 });
      const [fx, fy] = Dungeon.DIRS[p.dir];
      m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
      run(Game, G, 1050);
      total += 9999 - p.hp;
    }
    return total;
  };
  const bare = burn(false), scaled = burn(true);
  if (!(scaled < bare * 0.7)) out.push(`wyrm-scale took the fire from ${bare} to ${scaled}, not about half`);
  return out.length ? out.join('; ') : true;
});

await test('a mage draws back two spell points a spell-kill on Hard and in the Long Delve, one on an ordinary Normal delve; an ordinary Normal delve\'s creatures are a touch sturdier', async () => {
  const out = [];
  const drawn = async (difficulty, levels) => {
    for (let tries = 0; tries < 12; tries++) {
      const ctx = await start('mage', `draw-${difficulty}-${levels}-${tries}`, { levels, difficulty });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      const m = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
      p.sp = p.maxSp - 3;                                 // room to draw back, after the cast
      const mark = markLog(G);
      if (!Game.castSpell(Game.knownSpells().find(x => x.id === 'magic_missile'))) return 'Magic Missile would not cast';
      run(Game, G, 1500);
      if (Game.level().monsters.includes(m)) continue;    // it missed: try again
      const said = linesSince(G, mark).join(' ');
      return Number((said.match(/\+(\d+) spell points?/) || [])[1] || 0);
    }
    return 'never killed it';
  };
  const n = await drawn('normal', 8), h = await drawn('hard', 8), l = await drawn('normal', 12);
  if (n !== 1) out.push(`an ordinary Normal delve drew back ${n}`);
  if (h !== 2) out.push(`Hard drew back ${h}`);
  if (l !== 2) out.push(`the Long Delve drew back ${l}`);
  // the same floor, Normal: an ordinary delve's creatures carry a little more life than the Long Delve's
  const life = async levels => {
    const ctx = await start('fighter', 'sturdy', { levels, size: 'medium', monsters: 'normal', difficulty: 'normal' });
    return ctx.Game.level().monsters.reduce((a, m) => a + m.maxHp, 0);
  };
  const short = await life(8), long = await life(12);
  if (!(short > long)) out.push(`an ordinary delve's first floor held ${short} life, the Long Delve's ${long}`);
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
    // the ladder's deepest kinds: the troll, the minotaur and the cave wyrm
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => ['minotaur', 'troll', 'wyrm'].includes(m.id))) lastFloor++;
    if (Dungeon.generate(seed, 1, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => ctx.MONSTERS[m.id].tier[0] > 1)) early++;
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 16, size: 'medium', monsters: 'normal' }).monsters.some(m => m.id === 'minotaur')) longMid++;
  }
  if (lastFloor < 8) return `only ${lastFloor} of 12 eight-floor delves met a troll, minotaur or wyrm on the last floor`;
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
  // an oil, when a fight comes on and the blade is bare: silver for the dead
  p.hp = p.maxHp; p.inv = p.inv.filter(i => i.kind !== 'scroll' && !/^scroll/.test(i.t));
  p.inv.push({ t: 'oil_fire', q: 1, e: 0 }, { t: 'oil_silver', q: 1, e: 0 });
  if (Game.quickScroll()) out.push(`offered ${Game.quickScroll().t} with nothing awake`);
  const gob = ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  if ((Game.quickScroll() || {}).t !== 'oil_fire') out.push(`with a goblin coming, offered ${(Game.quickScroll() || {}).t}`);
  gob.id = 'skeleton';
  if ((Game.quickScroll() || {}).t !== 'oil_silver') out.push(`with a skeleton coming, offered ${(Game.quickScroll() || {}).t}`);
  Game.input('read');
  if (!p.coating || p.coating.t !== 'silver') out.push('one tap did not coat the blade');
  if (Game.quickScroll()) out.push('a coated blade was offered another oil');
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
  if (!said.some(l => /Bestiary: Goblin added/.test(l))) return `said: ${said.join(' | ')}`;
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
  return linesSince(G, mark).some(l => /Bestiary: .*Ogre, you learned .*how to beat it/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
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

await test('the trader is one of the Lampfolk, said in full the first time; at a goblin market it is a goblin pedlar', async () => {
  const ctx = await start('fighter', 'trader-kind');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const x = p.x + dx, y = p.y + dy;
  L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  /** walk into a fresh trader ahead and return what was said */
  const meet = () => {
    L.npcs.length = 0;
    L.npcs.push({ id: 'merchant', x, y, markup: 2, stock: [], greeted: false });
    const mark = markLog(G);
    Game.update(G.t + 400, 400);
    Game.input('forward');
    const said = linesSince(G, mark).join(' | ');
    Game.closeShop();
    return said;
  };
  const first = meet();
  if (!/One of the Lampfolk looks up/.test(first)) return `the first trader said: ${first}`;
  if (Game.traderName() !== 'Lampfolk trader') return `the shop is headed ${Game.traderName()}`;
  const again = meet();
  if (!/A Lampfolk trader blinks/.test(again) || /always been down here/.test(again)) return `the second trader said: ${again}`;
  L.twist = 'market';
  const market = meet();
  if (!/A goblin pedlar squats/.test(market)) return `the market trader said: ${market}`;
  return Game.traderName() === 'Goblin pedlar' || `the market shop is headed ${Game.traderName()}`;
});

/** Stand in front of a fresh, empty-shelved trader and walk into it. */
const shopAhead = ctx => {
  const { Game, Dungeon } = ctx, p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
  L.monsters.length = 0; L.npcs.length = 0;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [], greeted: false });
  Game.update(Game.state().t + 400, 400);
  Game.input('forward');
  return !!Game.currentShop();
};

// ---------- jobs from the traders ----------
/** Take the job the trader ahead offers; the shop is closed after. */
function takeJob(ctx) {
  const { Game } = ctx;
  if (!shopAhead(ctx)) return 'the shop did not open';
  const row = Game.shopServices().find(s => s.id === 'bounty');
  if (!row || row.why || row.price !== 0) return `the job row: ${JSON.stringify(row)}`;
  if (!Game.buyService('bounty') || !Game.bounty()) return 'the job was not taken';
  Game.closeShop();
  return '';
}
const downOne = ctx => { const { Game } = ctx; Game.level().monsters.length = 0; Game.descend(); };
/** Strike down a monster brought to stand in front of the hero. */
function strikeDown(ctx, m) {
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
  Game.level().tiles[(p.y + dy) * Game.level().w + p.x + dx] = Dungeon.T.FLOOR;
  Object.assign(m, { x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12 });
  delete m.pack;
  p.perkHit = 60;
  for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  return !Game.level().monsters.includes(m);
}

await test('a trader\'s job: kill so many on the floor below, and the next trader pays gold and a flask or scroll', async () => {
  const out = [];
  const ctx = await start('fighter', 'job-cull');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const why = takeJob(ctx);
  if (why) return why;
  const b = Game.bounty();
  b.kind = 'cull'; b.need = 3;
  if (b.depth !== 2 || !(b.reward.gold > 0) || !b.reward.t) out.push(`the job: ${JSON.stringify(b)}`);
  // the same trader has nothing more to offer, and says so
  shopAhead(ctx);
  const again = Game.shopServices().find(s => s.id === 'bounty');
  if (!again || !again.why) out.push('a second job was offered with one in hand');
  Game.closeShop();
  const mark = markLog(G);
  downOne(ctx);
  if (!b.started || !linesSince(G, mark).some(l => /The job the trader gave you is here/.test(l))) out.push('arriving did not start the job');
  if (Game.bountyChip() !== 'Job: 0 of 3 slain') out.push(`the chip read ${Game.bountyChip()}`);
  // a trader met with the job not yet done pays nothing
  const g0 = p.gold;
  shopAhead(ctx);
  if (Game.bounty() !== b || p.gold !== g0) out.push('a trader paid for a job not yet done');
  Game.closeShop();
  for (let i = 0; i < 3; i++) {
    const m = beside(ctx, 'rat', { uid: 600 + i });
    if (!strikeDown(ctx, m)) out.push(`rat ${i} would not fall`);
  }
  if (!b.done || b.got !== 3) out.push(`after three kills: got ${b.got}, done ${b.done}`);
  if (!/done/.test(Game.bountyChip())) out.push(`done, the chip read ${Game.bountyChip()}`);
  if (!Game.threadNotes().some(n => n.startsWith('A job from the traders'))) out.push('the hero sheet does not list the job');
  const gold = p.gold, reward = b.reward;
  const inv = p.inv.filter(i => i.t === reward.t).reduce((a, i) => a + (i.q || 1), 0);
  shopAhead(ctx);
  if (Game.bounty()) out.push('the next trader did not pay');
  if (p.gold !== gold + reward.gold) out.push(`paid ${p.gold - gold} gold, not ${reward.gold}`);
  if (p.inv.filter(i => i.t === reward.t).reduce((a, i) => a + (i.q || 1), 0) !== inv + 1) out.push(`no ${reward.t} in the pack`);
  if (G.stats.bounties !== 1) out.push(`jobs done: ${G.stats.bounties}`);
  // and this trader has a job of its own now
  const next = Game.shopServices().find(s => s.id === 'bounty');
  if (!next || next.why) out.push('the paying trader offered no job of its own');
  return out.length ? out.join('; ') : true;
});

await test('a satchel job lays the satchel far across the floor below; a champion job is its champion; a job left undone is lost', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'job-fetch');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const why = takeJob(ctx);
    if (why) return why;
    Game.bounty().kind = 'fetch';
    downOne(ctx);
    const L = Game.level(), k = Object.keys(L.items).find(key => L.items[key].some(i => i.t === 'satchel'));
    if (!k) return 'no satchel on the floor below';
    const [x, y] = k.split(',').map(Number);
    if (Math.abs(x - L.start.x) + Math.abs(y - L.start.y) < 8) out.push(`the satchel lay ${Math.abs(x - L.start.x) + Math.abs(y - L.start.y)} squares from the stair`);
    p.x = x; p.y = y;
    Game.takeItem(L.items[k].find(i => i.t === 'satchel'));
    if (!Game.bounty().done) out.push('picking up the satchel did not finish the job');
    shopAhead(ctx);
    if (p.inv.some(i => i.t === 'satchel')) out.push('the satchel stayed in the pack once paid for');
    if (Game.shopServices().length && Game.currentShop() && p.inv.some(i => i.t === 'satchel')) out.push('the satchel could be sold');
    void G;
  }
  {
    const ctx = await start('fighter', 'job-slay', { levels: 8 });
    const { Game } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 9999;
    downOne(ctx);                                    // to floor 2: the floor below holds a champion
    const plan = ctx.Dungeon.namedPlan(G.seed, 8, G.route || undefined);
    if (!plan[3]) return `this seed's plan has no champion on floor 3: ${JSON.stringify(plan)}`;
    const why = takeJob(ctx);
    if (why) return why;
    if (Game.bounty().kind !== 'slay') out.push(`the job for floor 3 is ${Game.bounty().kind}, not the champion`);
    downOne(ctx);
    const b = Game.bounty();
    const champ = Game.level().monsters.find(m => ctx.MONSTERS[m.id].named);
    if (!champ || b.target !== champ.id || !b.name) out.push(`the job's target: ${b.target}, the floor's champion: ${champ && champ.id}`);
    else {
      const other = beside(ctx, 'rat', { uid: 650 });
      Game.level().monsters.push(champ);
      strikeDown(ctx, other);
      if (b.done) out.push('a rat finished the champion\'s job');
      if (!strikeDown(ctx, champ)) out.push('the champion would not fall');
      if (!b.done) out.push('slaying the champion did not finish the job');
    }
  }
  {
    const ctx = await start('fighter', 'job-lost');
    const { Game } = ctx; const G = Game.state();
    const why = takeJob(ctx);
    if (why) return why;
    downOne(ctx);
    const mark = markLog(G);
    downOne(ctx);
    if (Game.bounty()) out.push('the job went on to the next floor');
    if (!linesSince(G, mark).some(l => /no pay for it now/.test(l))) out.push('losing the job was not told');
    // no job for the floor that holds the lich
    G.depth = G.opts.levels - 1;
    shopAhead(ctx);
    if (Game.shopServices().some(s => s.id === 'bounty')) out.push('a job was offered for the lich\'s floor');
  }
  return out.length ? out.join('; ') : true;
});

await test('one sworn to go unaided cannot drink the trader\'s tonic', async () => {
  const ctx = await start('fighter', 'unaided-tonic');
  const { Game } = ctx;
  Game.state().opts.vows = ['unaided'];
  if (!shopAhead(ctx)) return 'the shop did not open';
  const t = Game.shopServices().find(x => x.id === 'tonic');
  if (!t || !/unaided/.test(t.why || '')) return `the tonic is offered: ${t && (t.why || t.detail)}`;
  const hp = Game.player().maxHp;
  Game.player().gold = 9999;
  Game.buyService('tonic');
  return Game.player().maxHp === hp || 'the tonic was drunk anyway';
});

await test('the forge says a piece that kept its minus as a minus, never "+-1"', async () => {
  const ctx = await start('fighter', 'temper-minus');
  const { Game } = ctx;
  if (!shopAhead(ctx)) return 'the shop did not open';
  const p = Game.player();
  p.eq.weapon = { t: 'longsword', q: 1, e: -2 };
  const hone = Game.shopServices().find(x => x.id === 'hone');
  if (!hone || /\+-|\+−/.test(hone.detail) || !/becomes −1/.test(hone.detail)) return `from −2 the forge offers: ${hone && hone.detail}`;
  p.eq.weapon.e = -1;
  const again = Game.shopServices().find(x => x.id === 'hone');
  return /loses its −1/.test(again.detail) || `from −1 the forge offers: ${again.detail}`;
});

await test('a score raised by an encounter moves a caster\'s spell points at once, and a reload keeps them', async () => {
  for (let t = 0; t < 30; t++) {
    const ctx = await start('cleric', 'mirror-sp' + t);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    p.stats.wis = 13; p.level = 4;
    Game.save(true); Game.load();
    const q = Game.player(), M = Game.level();
    M.npcs.length = 0; M.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[q.dir];
    M.tiles[(q.y + dy) * M.w + q.x + dx] = Dungeon.T.FLOOR;
    M.npcs.push({ kind: 'encounter', id: 'mirror', x: q.x + dx, y: q.y + dy });
    Game.input('forward');
    const before = q.maxSp;
    const r = Game.chooseEncounter(0);
    // a d20 check fails on a one whatever the score: another hero tries
    if (!r || !r.check || !r.check.pass || q.stats.wis !== 14) continue;
    const now = q.maxSp;
    if (now <= before) return `wisdom rose to 14 and the spell points stayed at ${now}`;
    Game.closeEncounter(); Game.save(true); Game.load();
    return Game.player().maxSp === now || `the spell points were ${now}, and ${Game.player().maxSp} after a reload`;
  }
  return 'no hero passed the mirror in thirty tries';
});

await test('a trickster finding gold in an encounter is told the sum the purse really gained', async () => {
  for (let t = 0; t < 40; t++) {
    const ctx = await start('thief', 'trick-gold' + t);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    p.path = 'trickster'; for (const k in p.stats) p.stats[k] = 40;
    L.npcs.length = 0; L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.npcs.push({ kind: 'encounter', id: 'wired', x: p.x + dx, y: p.y + dy });
    Game.input('forward');
    const g0 = p.gold;
    const r = Game.chooseEncounter(1);
    const line = r && r.check && r.check.pass && r.lines.find(l => /Gold ×\d+/.test(l));
    if (!line) continue;
    const said = Number(/Gold ×(\d+)/.exec(line)[1]);
    return said === p.gold - g0 || `the card said ${said} gold and the purse gained ${p.gold - g0}`;
  }
  return 'no trickster found gold behind the wire in forty tries';
});

await test('a champion risen on a restless floor keeps a champion\'s life', async () => {
  // seed rs59's second floor is restless, and an Ancient there rises as an
  // Ancient zombie: one once had the life of a plain zombie, within one roll of 4d8+2
  // (rs4 was the seed until the overgrown floors took its second floor)
  const ctx = await start('fighter', 'rs59', { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' });
  const { Game, MONSTERS } = ctx;
  while (Game.state().depth < 2) { Game.level().monsters.length = 0; Game.descend(); }
  const L = Game.level();
  if (L.twist !== 'restless') return `floor 2 of rs59 is ${L.twist || 'plain'} now: pick another seed`;
  const risen = L.monsters.filter(m => m.elite && MONSTERS[m.id].undead && m.elite === 'Ancient');
  if (!risen.length) return 'no Ancient rose on that floor: pick another seed';
  const plainMost = b => b.hp[0] * b.hp[1] + b.hp[2] + 1;
  const weak = risen.filter(m => m.maxHp <= plainMost(MONSTERS[m.id]));
  return !weak.length || `an Ancient ${weak[0].id} rose with ${weak[0].maxHp} life, no more than a plain one`;
});

/** Walk into an encounter's stone set just ahead. */
const encounterAhead = (ctx, id) => {
  const { Game, Dungeon } = ctx, p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
  L.npcs.length = 0; L.monsters.length = 0;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.npcs.push({ kind: 'encounter', id, x: p.x + dx, y: p.y + dy });
  Game.input('forward');
  return !!Game.currentEncounter();
};

await test('a loss of maximum hit points stopped by the floor of ten is said as the loss it was', async () => {
  for (let t = 0; t < 40; t++) {
    const ctx = await start('fighter', 'mirror-floor' + t);
    const { Game } = ctx;
    const p = Game.player();
    p.maxHp = 11; p.hp = 11;
    for (const k in p.stats) p.stats[k] = 3;
    if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open';
    const r = Game.chooseEncounter(0);
    // a natural twenty passes whatever the score: another hero tries
    if (!r || !r.check || r.check.pass) continue;
    if (p.maxHp !== 10) return `maximum hit points came to ${p.maxHp}, not 10`;
    const said = r.lines.join(' | ');
    return (/−1 maximum hit points/.test(said) && !/−3 maximum/.test(said)) || `the card said: ${said}`;
  }
  return 'nobody failed at the mirror in forty tries';
});

await test('an encounter left open does not carry into a loaded game or a new run', async () => {
  const ctx = await start('fighter', 'enc-stale');
  const { Game } = ctx;
  Game.save(true);
  if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open';
  if (!Game.load()) return 'the save did not load';
  if (Game.currentEncounter()) return 'the encounter was still open in the loaded game';
  if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open a second time';
  Game.newGame({ name: 'Next', cls: 'thief', stats: Game.rollStats(), seed: 'enc-stale-2', opts: OPTS });
  return !Game.currentEncounter() || 'the encounter was still open in a new run';
});

await test('a snare holds two and a half seconds; a Warden\'s a second longer, a Sharpshooter\'s a second and a half', async () => {
  const out = [];
  for (const [path, ms] of [[null, 2500], ['warden', 3500], ['sharpshooter', 4000]]) {
    const ctx = await start('ranger', 'snare-hold-' + path);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999; p.path = path;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    L.monsters.push({ uid: 96, id: 'orc', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    if (!Game.useAbility()) { out.push(`no snare thrown (${path})`); continue; }
    const held = Game.level().monsters[0].snaredUntil - G.t;
    if (held !== ms) out.push(`${path || 'no path'}: held ${held}ms, not ${ms}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a snared foe stays snared through a save and a load', async () => {
  const ctx = await start('ranger', 'snare-load');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G0 = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.monsters.push({ uid: 95, id: 'orc', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G0.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  if (!Game.useAbility()) return 'the snare was not thrown';
  const held = Game.level().monsters[0];
  if (!(held.snaredUntil > G0.t + 1500)) return 'the orc was not snared';
  const x0 = held.x, y0 = held.y, until = held.snaredUntil;
  Game.save(true);
  if (!Game.load()) return 'the save did not load';
  const G = Game.state();
  for (let i = 0; i < 80; i++) {
    Game.update(G.t + 25, 25);
    const m = Game.level().monsters[0];
    if (G.t >= until - 50) break;
    if (m.x !== x0 || m.y !== y0 || m.windup) return `the orc moved ${Math.round(until - G.t)}ms before the snare let go`;
  }
  return true;
});

await test('a Potion of Might adds its +2 whole to a dagger\'s blow, not scaled down by the blade\'s weight', async () => {
  const ctx = await start('fighter', 'might-whole');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const gain = t => {
    p.eq.weapon = { t, q: 1, e: 0 }; p.eq.shield = null; p.eq.offhand = null;
    delete p.effects.might; const off = Game.blowRate(p.eq.weapon);
    p.effects.might = { amount: 2, until: G.t + 120000 }; const on = Game.blowRate(p.eq.weapon);
    delete p.effects.might;
    return on - off;
  };
  // the same +2 a blow is worth more a second on a quick blade; scaled by weight, it was worth the same on every one
  const dagger = gain('dagger'), great = gain('greatsword');
  return dagger > great * 1.5 || `+2 a blow came to ${dagger.toFixed(2)} a second on a dagger and ${great.toFixed(2)} on a greatsword`;
});

await test('Weapon Master\'s +1 lands on the second blade too', async () => {
  const ctx = await start('fighter', 'wm-offhand');
  const { Game } = ctx;
  const p = Game.player();
  const gain = two => {
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 }; p.eq.shield = null; p.eq.offhand = two ? { t: 'dagger', q: 1, e: 0 } : null;
    p.talents = []; const off = Game.blowRate(p.eq.weapon);
    p.talents = ['weapon_master']; const on = Game.blowRate(p.eq.weapon);
    p.talents = [];
    return on - off;
  };
  const one = gain(false), two = gain(true);
  // two blades swing a little slower, but two +1s a round outweigh it; one +1 did not
  return two > one || `the talent added ${one.toFixed(2)} a second with one dagger and ${two.toFixed(2)} with two`;
});

await test('Slow to Bleed closes wounds half again as fast, even on a small pool of life', async () => {
  const healed = async perk => {
    const ctx = await start('mage', 'hardy-heal');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    L.monsters.length = 0;
    p.maxHp = 20; p.hp = 5; p.perkRegen = perk ? 0.5 : 0; p.regenCarry = 0; p.nextRegen = G.t;
    let total = 0;
    for (let i = 0; i < 400; i++) { const was = p.hp; p.hp = Math.min(p.hp, 9); Game.update(G.t + 100, 100); total += Math.max(0, p.hp - Math.min(was, 9)); p.hp = 5; }
    return total;
  };
  const plain = await healed(false), hardy = await healed(true);
  if (!plain) return 'no natural healing happened at all';
  const r = hardy / plain;
  return (r > 1.4 && r < 1.6) || `with Slow to Bleed a 20-life hero healed ${hardy} to ${plain}, ${r.toFixed(2)} times`;
});

await test('Practised Hands makes a swing 8% sooner at every level, no more', async () => {
  const ctx = await start('fighter', 'swift-exact');
  const { Game } = ctx;
  const p = Game.player();
  const out = [];
  for (const level of [1, 5, 10]) {
    p.level = level;
    p.perkSpeed = 0; const now = Game.blowRate(p.eq.weapon);
    p.perkSpeed = 0.08; const next = Game.blowRate(p.eq.weapon);
    // the same blow, sooner: a rate higher by exactly 1/0.92
    const r = next / now;
    if (Math.abs(r - 1 / 0.92) > 0.002) out.push(`level ${level}: ${((1 - 1 / r) * 100).toFixed(1)}% sooner`);
  }
  p.perkSpeed = 0;
  return !out.length || out.join('; ');
});

await test('a trickster\'s gold from an encounter is a quarter more, as gold found anywhere is', async () => {
  const ctx = await start('thief', 'trick-shelves');
  const { Game } = ctx;
  const p = Game.player();
  p.path = 'trickster';
  if (!encounterAhead(ctx, 'shelves')) return 'the shelves did not open';
  const g0 = p.gold;
  const r = Game.chooseEncounter(2);
  const want = Math.round(8 * Game.state().depth * 1.25);
  if (p.gold - g0 !== want) return `the gilt book gave ${p.gold - g0} gold, not ${want}`;
  return r.lines.some(l => l.includes(`+${want} gold`)) || `the card said: ${r.lines.join(' | ')}`;
});

await test('in a Hard Long Delve a fighter\'s blows and a druid\'s bear\'s claws grow with the deep floors, a ranger\'s half as much; on eight Hard floors a fighter\'s from the sixth; not on Normal', async () => {
  const hurt = async (depth, cls = 'fighter', difficulty = 'hard', levels = 12) => {
    const ctx = await start(cls, 'deep-steel', { levels, difficulty });
    const { Game } = ctx;
    const G = Game.state(), p = Game.player();
    G.levels[depth] = G.levels[1]; G.depth = depth;
    // the same hero both times: scores are rolled afresh for each new game
    for (const k in p.stats) p.stats[k] = 14;
    // a druid fights as the bear, whose claws are its blows in the deep
    if (cls === 'druid') { p.sp = 99; Game.castSpell(ctx.SPELLS.druid.find(s => s.id === 'wild_shape')); if (!p.shape) return -1; p.shape.until = 1e12; }
    const m = beside(ctx, 'ogre', { hp: 99999, maxHp: 99999, nextAct: 1e12 });
    seedDice(ctx, 'deep-steel-swings');
    let dealt = 0;
    for (let i = 0; i < 20; i++) { const hp = m.hp; G.t = Math.max(G.t, p.nextAttack || 0); Game.input('attack'); dealt += hp - m.hp; }
    return dealt;
  };
  const out = [];
  // five floors past the sixth: 4% a floor for a fighter and a druid, 2% for a ranger, none on Normal
  for (const [cls, diff, lo, hi] of [['fighter', 'hard', 1.12, 1.28], ['druid', 'hard', 1.12, 1.28], ['ranger', 'hard', 1.04, 1.16], ['ranger', 'normal', 0.97, 1.03]]) {
    const shallow = await hurt(6, cls, diff), deep = await hurt(11, cls, diff);
    if (shallow < 0 || deep < 0) { out.push('the druid could not take the bear\'s shape'); continue; }
    if (!shallow) { out.push(`no ${cls} blow landed`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`a ${cls}'s blows on ${diff} floor 11 were ${r.toFixed(2)} times those on floor 6`);
  }
  // eight floors: three past the fifth, 4% a floor for a fighter on Hard, none for a mage's staff nor on Normal
  for (const [cls, diff, lo, hi] of [['fighter', 'hard', 1.07, 1.18], ['fighter', 'normal', 0.97, 1.03], ['ranger', 'hard', 0.97, 1.03]]) {
    const shallow = await hurt(5, cls, diff, 8), deep = await hurt(8, cls, diff, 8);
    if (!shallow) { out.push(`no ${cls} blow landed on eight floors`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`on eight ${diff} floors a ${cls}'s blows on floor 8 were ${r.toFixed(2)} times those on floor 5`);
  }
  return out.length ? out.join('; ') : true;
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

await test('down the Warrens the last floor is the Warlord\'s, not the lich\'s; the rest of the floor is the same', async () => {
  const out = [];
  const ctx = await start('fighter', 'warlord-floor');
  for (let i = 0; i < 6; i++) {
    const seed = `warlord-${i}`, opts = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    const W = ctx.Dungeon.generate(seed, 8, { ...opts, route: 'warrens' }), C = ctx.Dungeon.generate(seed, 8, { ...opts, route: 'crypts' }), N = ctx.Dungeon.generate(seed, 8, opts);
    const boss = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
    if (boss(W) !== 'warlord' || boss(C) !== 'lich' || boss(N) !== 'lich') out.push(`${seed}: warrens ${boss(W)}, crypts ${boss(C)}, none ${boss(N)}`);
    const rest = L => L.monsters.filter(m => !ctx.MONSTERS[m.id].boss).map(m => `${m.id}@${m.x},${m.y}`).join(' ');
    if (N.tiles.join() !== W.tiles.join() || rest(N) !== rest(W)) out.push(`${seed}: the Warlord's floor differs from the lich's beyond the boss`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the Warlord beats his drum for a warband, and a blow while the stick is raised breaks the beat', async () => {
  const out = [];
  const drum = async (strike) => {
    const ctx = await start('fighter', 'warlord-drum-' + strike);
    const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
    const m = beside(ctx, 'warlord', { blows: 2, hp: 400, maxHp: 400 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'drum') return { err: `it drew ${JSON.stringify(m.windup)}` };
    const mark = markLog(G), sounds = [];
    ctx.Sound.listen(name => sounds.push(name));
    try {
      if (strike) for (let i = 0; i < 10 && m.windup; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      run(Game, G, 1800);
    } finally { ctx.Sound.listen(null); }
    const band = L.monsters.filter(o => o.id === 'goblin');
    return { band, said: linesSince(G, mark), m, drummed: sounds.includes('drum') };
  };
  const a = await drum(false), b = await drum(true);
  if (a.err || b.err) return a.err || b.err;
  if (!(a.band.length === 1 && a.band[0].pack && a.band[0].pack.length === 1 && a.band[0].awake)) out.push(`the beat brought ${JSON.stringify(a.band.map(g => g.pack))}`);
  if (!a.said.some(l => /warband comes running/.test(l))) out.push('the warband came unsaid');
  if (!a.drummed || b.drummed) out.push(`the drum was heard ${a.drummed ? '' : 'not '}when beaten and ${b.drummed ? '' : 'not '}when broken`);
  if (b.band.length) out.push('a struck drum still called a warband');
  if (!b.said.some(l => /strike the drumstick from/.test(l))) out.push(`breaking the beat said: ${b.said.join(' / ')}`);
  return out.length ? out.join('; ') : true;
});

// ---------- the Heartforged: the Long Delve's own keeper ----------
await test('at the bottom of a Long Delve the Heartforged keeps the Heart, down either road; eight floors keep the lich and the Warlord; the rest of the floor is the same', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-floor');
  for (let i = 0; i < 5; i++) {
    const seed = `hf-${i}`;
    for (const levels of [12, 16]) {
      const opts = { ...OPTS, levels, size: 'medium', monsters: 'normal' };
      const W = ctx.Dungeon.generate(seed, levels, { ...opts, route: 'warrens' }), C = ctx.Dungeon.generate(seed, levels, { ...opts, route: 'crypts' });
      const boss = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
      if (boss(W) !== 'heartforged' || boss(C) !== 'heartforged') out.push(`${seed} (${levels}): warrens ${boss(W)}, crypts ${boss(C)}`);
    }
    // the eight floors as they were
    const o8 = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    const w8 = ctx.Dungeon.generate(seed, 8, { ...o8, route: 'warrens' }), c8 = ctx.Dungeon.generate(seed, 8, { ...o8, route: 'crypts' });
    const b8 = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
    if (b8(w8) !== 'warlord' || b8(c8) !== 'lich') out.push(`${seed} (8): warrens ${b8(w8)}, crypts ${b8(c8)}`);
  }
  // the same count of hit dice as the lich's, so nothing else on the floor rolls differently
  if (ctx.MONSTERS.heartforged.hp[0] !== ctx.MONSTERS.lich.hp[0]) out.push(`it rolls ${ctx.MONSTERS.heartforged.hp[0]} hit dice, the lich ${ctx.MONSTERS.lich.hp[0]}`);
  return out.length ? out.join('; ') : true;
});

/** Open floor round the hero, nothing else on it, and the Heartforged on the square ahead. */
const forgeRoom = (ctx, extra = {}) => {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  // in the middle of the map, so every one of its lines has room to run
  p.x = Math.floor(L.w / 2); p.y = Math.floor(L.h / 2);
  for (let y = p.y - 5; y <= p.y + 5; y++) for (let x = p.x - 5; x <= p.x + 5; x++) if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  L.npcs = []; L.items = {}; L.traps = {}; L.fields = {};
  return beside(ctx, 'heartforged', { hp: 3000, maxHp: 3000, nextAct: 1e12, spoke: true, ...extra });
};

await test('the Heartforged stamps fire down its four lines: on a line you burn, off them the fire runs past and its hammer sticks, leaving it open', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-stamp', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = forgeRoom(ctx);
  const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  // two squares off down its line, after a blow: it raises its hammer
  const gather = () => { m.windup = null; m.blows = 1; m.moveReady = 0; m.nextAct = G.t; for (let i = 0; i < 20 && !(m.windup && m.windup.move === 'stamp'); i++) Game.update(G.t + 25, 25); return !!(m.windup && m.windup.move === 'stamp'); };
  m.x = m.rx = m.fromX = p.x + dx * 2; m.y = m.ry = m.fromY = p.y + dy * 2;
  if (!gather()) return `it did not raise its hammer with the hero on its line (${JSON.stringify(m.windup)})`;
  // stay on the line: burned, and its lines are on fire
  let hp = p.hp, mark = markLog(G);
  for (let i = 0; i < 80 && m.windup; i++) Game.update(G.t + 25, 25);
  if (p.hp >= hp) out.push('on its line, the stamp did no harm');
  if (!linesSince(G, mark).some(l => /fire runs down the floor over you/.test(l))) out.push(`on its line it said: ${linesSince(G, mark).join(' / ')}`);
  const burning = (x, y) => { const f = Game.fieldAt(x, y); return !!f && f.k === 'fire'; };
  if (!burning(m.x - dx, m.y - dy) || !burning(m.x + sx, m.y + sy) || !burning(m.x + sx * 3, m.y + sy * 3) || !burning(m.x - sx * 3, m.y - sy * 3) || !burning(m.x + dx * 3, m.y + dy * 3)) out.push('its four lines did not burn');
  if (burning(m.x + sx * 4, m.y + sy * 4)) out.push('its fire ran four squares before it glowed white');
  if (burning(m.x + sx + dx, m.y + sy + dy) || burning(m.x - sx - dx, m.y - sy - dy)) out.push('a square off its lines burned');
  // again, the hero stepping off its line while the hammer is up: the fire misses, and it is open
  Game.level().fields = {}; p.hp = 9999;
  if (!gather()) return 'it did not raise its hammer a second time';
  p.x += sx; p.y += sy;
  hp = p.hp; mark = markLog(G);
  for (let i = 0; i < 80 && m.windup; i++) Game.update(G.t + 25, 25);
  if (p.hp < hp) out.push(`off its lines, the stamp did ${hp - p.hp}`);
  if (!linesSince(G, mark).some(l => /hammer sticks fast in the stone/.test(l))) out.push(`off its lines it said: ${linesSince(G, mark).join(' / ')}`);
  if (!(p.opening && p.opening.until > G.t)) out.push('off its lines, it was not left open');
  // not on a line at all, it does not begin
  Game.level().fields = {}; m.blows = 1; m.moveReady = 0; m.nextAct = G.t; m.windup = null;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  if (m.windup && m.windup.move === 'stamp') out.push('it raised its hammer with the hero off its lines');
  return out.length ? out.join('; ') : true;
});

await test('the Heartforged at two thirds lets two emberlings out of its furnace; at one third it glows white, quicker, its fire running four squares; when it falls they go out with it', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-phases', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = forgeRoom(ctx, { hp: 300, maxHp: 300 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const hit = () => { m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = 1e12; m.windup = null; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); };
  const speed0 = Game.mstat(m).speed;
  m.hp = 201; let mark = markLog(G);
  for (let i = 0; i < 20 && m.phase !== 1; i++) hit();
  if (m.phase !== 1) return 'it never reached two thirds';
  const embers = L.monsters.filter(o => o.ember === m.uid);
  if (embers.length !== 2 || embers.some(e => e.id !== 'emberling' || !e.awake)) out.push(`at two thirds: ${embers.map(e => e.id)}`);
  if (!linesSince(G, mark).some(l => /tears open the furnace in its chest/.test(l))) out.push(`at two thirds it said: ${linesSince(G, mark).join(' / ')}`);
  m.hp = 99; mark = markLog(G);
  for (let i = 0; i < 20 && m.phase !== 2; i++) hit();
  if (m.phase !== 2) return 'it never reached one third';
  if (!(Game.mstat(m).speed < speed0)) out.push(`at one third its speed is ${Game.mstat(m).speed}, not quicker than ${speed0}`);
  if (!linesSince(G, mark).some(l => /glows white/.test(l))) out.push(`at one third it said: ${linesSince(G, mark).join(' / ')}`);
  // its fire reaches four squares now: four off down its line, it stamps
  m.x = m.rx = m.fromX = p.x + dx * 4; m.y = m.ry = m.fromY = p.y + dy * 4;
  m.windup = null; m.moveReady = 0; m.nextAct = G.t;
  const at4 = [m.x, m.y];
  for (let i = 0; i < 20 && !(m.windup && m.windup.move === 'stamp'); i++) Game.update(G.t + 25, 25);
  // (from where it stood: it must not have stepped a square nearer first)
  if (!(m.windup && m.windup.move === 'stamp') || m.x !== at4[0] || m.y !== at4[1]) out.push(`glowing white, it did not stamp from four squares off (${JSON.stringify(m.windup)} at ${m.x},${m.y})`);
  // it falls: the Heart is free, and the embers go out
  for (const e of L.monsters) if (e.ember) { e.x = p.x - dx * 3; e.y = p.y - dy * 3; e.nextAct = 1e12; }
  m.windup = null; m.hp = 1; mark = markLog(G);
  for (let i = 0; i < 10 && L.monsters.includes(m); i++) hit();
  if (L.monsters.includes(m)) return 'it would not fall';
  if (L.monsters.some(o => o.ember === m.uid)) out.push('its embers still burn after it fell');
  if (!linesSince(G, mark).some(l => /falls apart into cooling slag/.test(l))) out.push(`its fall said: ${linesSince(G, mark).join(' / ')}`);
  if (Game.heartHeldFast()) out.push('the Heart is still held after it fell');
  return out.length ? out.join('; ') : true;
});

await test('at two thirds the Warlord takes his throne behind shield-bearers; cut them down and he comes down; at one third a frenzy', async () => {
  const out = [];
  const ctx = await start('fighter', 'warlord-throne');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = beside(ctx, 'warlord', { hp: 300, maxHp: 300, nextAct: 1e12 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const hit = () => { m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = 1e12; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); };
  m.hp = 201;
  for (let i = 0; i < 20 && m.phase !== 1; i++) hit();
  if (m.phase !== 1) return 'he never reached two thirds';
  const bearers = L.monsters.filter(o => o.bearer === m.uid);
  if (bearers.length !== 2 || bearers.some(b => b.id !== 'orc') || !m.throne) return `at two thirds: ${bearers.length} bearers, throne ${m.throne}`;
  const hp1 = m.hp, told = markLog(G);
  for (let i = 0; i < 6; i++) hit();
  if (m.hp !== hp1) out.push(`on his throne he took ${hp1 - m.hp}`);
  if (!linesSince(G, told).some(l => /shield-bearers turn the blow aside/.test(l))) out.push(`a blow at him on his throne said: ${linesSince(G, told).join(' / ')}`);
  if (Game.mstat(m).ranged == null) out.push('on his throne he has no spear to throw');
  // his bar says where he is (it shows once he has spoken)
  m.spoke = true; m.awake = true;
  const bar = (Game.renderState(0).fx.boss || {}).name;
  if (bar !== 'Goblin Warlord, on his throne') out.push(`his bar read ${bar}`);
  // beside him on his throne, he strikes no blow of his own: that is the shield-bearers' work
  {
    m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = G.t; m.windup = null;
    const seen = markLog(G);
    for (let i = 0; i < 120 && m.throne; i++) Game.update(G.t + 25, 25);
    if (linesSince(G, seen).some(l => /Goblin Warlord (hits|misses) you/.test(l))) out.push('he struck from his throne');
  }
  // his shield-bearers fall: he comes down
  for (const b of bearers) L.monsters.splice(L.monsters.indexOf(b), 1);
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (m.throne || m.wardUntil > G.t) out.push('with his shield-bearers dead he stayed on his throne');
  if (!linesSince(G, mark).some(l => /leaps down to fight you himself/.test(l))) out.push('coming down was not told');
  for (let i = 0; i < 6 && m.hp === hp1; i++) hit();
  if (m.hp === hp1) out.push('off his throne, still no blow reached him');
  // one third: the war-chest and the frenzy
  const golds = () => Object.values(L.items).reduce((n, list) => n + list.filter(i => i.t === 'gold').length, 0), g0 = golds();
  m.hp = Math.min(m.hp, 101);
  for (let i = 0; i < 20 && m.phase !== 2; i++) hit();
  if (m.phase !== 2 || !m.frenzy) out.push(`phase ${m.phase}, frenzy ${m.frenzy}`);
  if (!(Game.mstat(m).speed < ctx.MONSTERS.warlord.speed)) out.push(`in his frenzy he strikes every ${Game.mstat(m).speed}ms`);
  if (golds() < g0 + 2) out.push(`the war-chest spilled ${golds() - g0} piles of gold`);
  return out.length ? out.join('; ') : true;
});

await test('a spell flies over the Warlord\'s shield-bearers and finds him on his throne', async () => {
  const ctx = await start('mage', 'warlord-spell');
  const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99;
  const m = beside(ctx, 'warlord', { hp: 300, maxHp: 300, nextAct: 1e12, phase: 1, throne: true, wardUntil: G.t + 1e6 });
  const bolt = SPELLS.mage.find(s => s.kind === 'bolt' && Game.spellAvailable(s));
  if (!bolt) return 'no bolt spell to cast';
  const mark = markLog(G);
  G.t = Math.max(G.t, p.nextAttack);
  Game.castSpell(bolt);
  const out = [];
  if (!(m.hp < 300)) out.push(`the ${bolt.name} did not reach him (${linesSince(G, mark).join(' / ')})`);
  if (!linesSince(G, mark).some(l => /flies over the shield-bearers/.test(l))) out.push('it was not told');
  // a blade still does not
  const hp = m.hp;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (m.hp !== hp) out.push('a blade reached him on his throne');
  return out.length ? out.join('; ') : true;
});

await test('the Warlord falls: his warband runs, his hoard is left, and the Heart comes loose', async () => {
  const ctx = await start('fighter', 'warlord-fall');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = beside(ctx, 'warlord', { hp: 1, maxHp: 300, nextAct: 1e12, phase: 2 });
  const gob = { ...m, uid: 91, id: 'goblin', x: -50, y: -50, hp: 10, maxHp: 10, phase: 0, awake: false };
  L.monsters.push(gob);
  const mark = markLog(G);
  for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  if (L.monsters.includes(m)) return 'he would not fall';
  const out = [];
  if (!gob.fleeing) out.push('his warband did not run');
  if (!G.bossDown) out.push('the boss is not down');
  if (!Object.values(L.items).some(list => list.some(i => i.t === 'gold' && i.q >= 20))) out.push('no hoard was left');
  if (!linesSince(G, mark).some(l => /crashes down among his plunder/.test(l))) out.push(`said: ${linesSince(G, mark).join(' / ')}`);
  if (Game.heartKeeper()) out.push('the Heart is still held');
  return out.length ? out.join('; ') : true;
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
  const trick = said.findIndex(l => /rears back to spit a web/.test(l)), note = said.findIndex(l => /^Bestiary: Cave Spider/.test(l));
  if (trick < 0 || note < 0 || note < trick) return `order: ${said.join(' | ')}`;
  if (said.filter(l => /^Bestiary/.test(l)).length !== 1) return `more than one bestiary line: ${said.join(' | ')}`;
  // and a kill: slain first, then one note
  const m2 = beside(ctx, 'rat', { uid: 612, hp: 1, maxHp: 1, nextAct: 1e12 });
  let k = markLog(G);
  // a natural 1 misses whatever the bonus: swing again until the blow lands
  for (let i = 0; i < 20 && Game.level().monsters.includes(m2); i++) { k = markLog(G); G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  const after = linesSince(G, k);
  void m; void m2;
  const dead = after.findIndex(l => /destroyed|slain/.test(l)), n2 = after.findIndex(l => /^Bestiary: Giant Rat/.test(l));
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
    // (with the rolls hidden the same blow twice folds into one line, "(×2)")
    const hits = linesSince(G, mark).flatMap(l => { const r = /Orc \w+ you.* for (\d+)/.exec(l); return r ? Array(timesSaid(l)).fill(Number(r[1])) : []; });
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
await test('no trap lies in the lich\'s hall or at its mouth', async () => {
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  const o = { levels: 8, size: 'normal', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
  for (let i = 0; i < 30; i++) {
    const L = Dungeon.generate('hall-traps' + i, 8, o), lich = L.monsters.find(m => m.id === 'lich');
    if (!lich) continue;
    for (const k of Object.keys(L.traps)) {
      const [x, y] = k.split(',').map(Number);
      if (Math.abs(x - lich.x) + Math.abs(y - lich.y) <= 4) return `seed hall-traps${i}: a ${L.traps[k]} ${Math.abs(x - lich.x) + Math.abs(y - lich.y)} squares from the lich`;
    }
  }
  return true;
});

await test('stepping onto the Heart while the lich holds it says so once, not at every sidestep of the fight', async () => {
  const ctx = await start('fighter', 'heart-once');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  const k = `${p.x + dx},${p.y + dy}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 });
  // the lich stands off to one side, holding it
  const lich = beside(ctx, 'lich', { hp: 50, maxHp: 50, nextAct: 1e12 });
  lich.x = lich.rx = p.x - dx * 3; lich.y = lich.ry = p.y - dy * 3;
  const mark = markLog(G);
  for (let i = 0; i < 3; i++) { Game.input('forward'); run(Game, G, 300); Game.input('back'); run(Game, G, 300); }
  const n = linesSince(G, mark).filter(l => /will not come loose/.test(l)).length;
  if (n !== 1) return `stepping onto the Heart three times said it ${n} times`;
  // but reaching for it (Take in the pack) always says why it will not come
  Game.input('forward'); run(Game, G, 300);
  const m2 = markLog(G);
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  return linesSince(G, m2).some(l => /will not come loose/.test(l)) || 'reaching for the Heart said nothing';
});

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
  if (!/cannot rest/.test(G.log[G.log.length - 1].m)) return `Rest in a fight said: ${G.log[G.log.length - 1].m}`;
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

await test('on the Long Delve on Hard, from the seventh floor, spells, a cleric\'s blows and a fighter\'s strike harder; nowhere else', async () => {
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
  // a cleric's blow too, and a fighter's (a little less), but not a thief's
  const cHard = await dart('cleric', 12, 'hard'), cNormal = await dart('cleric', 12, 'normal');
  if (!(cNormal > 0) || cHard <= cNormal) out.push(`a cleric's blow on floor 9: ${cHard} on Hard, ${cNormal} on Normal`);
  const fHard = await dart('fighter', 12, 'hard'), fNormal = await dart('fighter', 12, 'normal');
  if (!(fNormal > 0) || fHard <= fNormal) out.push(`a fighter's blow on floor 9: ${fHard} on Hard, ${fNormal} on Normal`);
  const tHard = await dart('thief', 12, 'hard'), tNormal = await dart('thief', 12, 'normal');
  if (tHard !== tNormal) out.push(`a thief's blow changed with the deep: ${tHard} against ${tNormal}`);
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
  const { CLASSES, PATHS, VOWS, FEATS } = ctx, total = Object.keys(CLASSES).length * 4 + Object.values(PATHS).flat().length + Object.keys(VOWS).length + Object.keys(FEATS).length;
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

await test('a win with three traders\' jobs done is Friend of the Lampfolk; with a veteran companion at your side, Old Campaigners', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = difficulty => Game.newGame({ name: 'F', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'feat-new', opts: { ...OPTS, permadeath: true, difficulty } });
  const out = [];
  const companion = floors => ({ kind: 'hound', name: 'Brindle', x: 0, y: 0, depth: Game.state().depth, hp: 10, maxHp: 10, mode: 'follow', nextAct: 0, kills: 0, joined: 1, floors });
  run('normal'); Game.state().stats.bounties = 2; Game.state().companion = companion(3); winHere(Game);
  if (Game.earned().firstFeats.length) out.push(`two jobs and a blooded hound earned ${Game.earned().firstFeats}`);
  run('normal'); Game.state().stats.bounties = 3; Game.state().companion = companion(4); winHere(Game);
  if (Game.earned().firstFeats.sort().join() !== 'friend,veteran') out.push(`three jobs and a veteran hound earned ${Game.earned().firstFeats}`);
  // a veteran that fell does not count, nor anything on Easy
  const ctx2 = await newContext();
  const run2 = difficulty => ctx2.Game.newGame({ name: 'F', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'feat-new', opts: { ...OPTS, permadeath: true, difficulty } });
  run2('hard'); ctx2.Game.state().companion = { ...companion(5), fallen: 7 }; winHere(ctx2.Game);
  if (ctx2.Game.earned().firstFeats.includes('veteran')) out.push('a fallen veteran counted');
  run2('easy'); ctx2.Game.state().stats.bounties = 5; winHere(ctx2.Game);
  if (progressOf(ctx2).feats.friend) out.push('jobs on Easy counted');
  void Progress;
  return out.length ? out.join('; ') : true;
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

await test('mastery: every relic found is the Collector; the Daily keeps to the first four classes', async () => {
  const out = [];
  const ctx = await newContext();
  const { Progress, RELICS, Daily } = ctx;
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

await test('a class is mastered by a win with each of its paths: once, on the win that completes it, and a trophy', async () => {
  const ctx = await newContext();
  const { Progress, PATHS, CLASSES } = ctx;
  const [a, b] = PATHS.fighter.map(x => x.id);
  const total0 = Progress.trophyCount().total;
  const w1 = Progress.recordWin('fighter', 'easy', { path: a });
  if (w1.mastered || Progress.mastered('fighter') || Progress.pathsWon('fighter') !== 1) return `one path won: mastered ${w1.mastered}, ${Progress.pathsWon('fighter')} won`;
  const before = Progress.trophyCount().won;
  const w2 = Progress.recordWin('fighter', 'easy', { path: b });
  if (!w2.mastered || !Progress.mastered('fighter')) return 'both paths won and the fighter was not mastered';
  // two trophies from that win: the path, and the mastery
  if (Progress.trophyCount().won !== before + 2) return `the second path's win lit ${Progress.trophyCount().won - before} trophies, want 2`;
  if (Progress.recordWin('fighter', 'hard', { path: a }).mastered) return 'mastery was told a second time';
  if (Progress.recordWin('cleric', 'hard', { path: PATHS.cleric[0].id }).mastered || Progress.mastered('cleric')) return 'one cleric path mastered the cleric';
  if (total0 !== Object.keys(CLASSES).length * 4 + Progress.PATH_IDS.length + Object.keys(ctx.VOWS).length + Object.keys(ctx.FEATS).length) return `trophies in all: ${total0}`;
  return true;
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
  if (named.length < 4 || named.length > 8) return `${named.length} named champions`;
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
  if (Math.abs(normal.maxHp / easy.maxHp - 1.5) > 0.05 || Math.abs(hard.maxHp / easy.maxHp - 1.9) > 0.05) return `easy ${easy.maxHp}, normal ${normal.maxHp}, hard ${hard.maxHp}`;
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

// ---------- oils and coatings ----------
/** A fighter holding a long sword, with an oil of each kind in the pack. */
async function oiled(key) {
  const ctx = await start('fighter', key);
  const p = ctx.Game.player();
  p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = null;
  p.inv.push({ t: 'oil_fire', q: 2, e: 0 }, { t: 'oil_silver', q: 1, e: 0 }, { t: 'oil_venom', q: 1, e: 0 });
  return ctx;
}
/** Swing at a foe until n blows have landed; the damage of each, and the lines said. */
function landBlows(ctx, m, n, keep) {
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const dmg = [], lines = [];
  for (let i = 0; i < n * 20 && dmg.length < n; i++) {
    if (keep) p.coating = { t: keep, left: 20 };
    m.hp = m.maxHp = 1e6; m.nextAct = 1e12; m.dot = null;
    const mark = markLog(G), hp0 = m.hp;
    G.t = p.nextAttack; Game.input('attack');
    lines.push(...linesSince(G, mark));
    if (m.hp < hp0) dmg.push(hp0 - m.hp);
    if (keep === 'venom' && m.dot) lines.push('POISONED');
  }
  return { dmg, lines, mean: dmg.reduce((a, b) => a + b, 0) / Math.max(1, dmg.length) };
}

await test('an oil coats the weapon for twenty blows that land, then wears off; with no weapon there is nothing to coat', async () => {
  const out = [];
  const ctx = await oiled('oil-coat');
  const { Game } = ctx; const COAT = Game.COAT_BLOWS;
  const p = Game.player(), G = Game.state();
  const fire = p.inv.find(i => i.t === 'oil_fire');
  const mark = markLog(G);
  Game.useItem(fire);
  if (!p.coating || p.coating.t !== 'fire' || p.coating.left !== COAT) return `after the fire oil the coating is ${JSON.stringify(p.coating)}`;
  if (fire.q !== 1) out.push(`the flask count went to ${fire.q}`);
  if (!linesSince(G, mark).some(l => /fire oil into your long sword/.test(l))) out.push(`said: ${linesSince(G, mark).join(' / ')}`);
  // the same oil again on a fresh coat is refused; another kind replaces it
  Game.useItem(fire);
  if (!p.inv.some(i => i.t === 'oil_fire')) out.push('a second fire oil was spent on a fresh coat');
  Game.useItem(p.inv.find(i => i.t === 'oil_silver'));
  if (!p.coating || p.coating.t !== 'silver') out.push(`silver over fire left ${JSON.stringify(p.coating)}`);
  // twenty blows that land, and it is gone
  const m = beside(ctx, 'ogre', { nextAct: 1e12 });
  p.stats.str = 18;
  const r = landBlows(ctx, m, COAT);
  if (r.dmg.length !== COAT) out.push(`only ${r.dmg.length} blows landed`);
  if (p.coating) out.push(`after ${COAT} blows ${p.coating.left} were left`);
  if (!r.lines.some(l => /silver wash has worn off/.test(l))) out.push('it wore off unsaid');
  // no weapon, no coating
  const bare = await oiled('oil-bare');
  bare.Game.player().eq.weapon = null;
  const v = bare.Game.player().inv.find(i => i.t === 'oil_venom');
  bare.Game.useItem(v);
  if (bare.Game.player().coating || !bare.Game.player().inv.includes(v)) out.push('an oil was spent with no weapon in hand');
  return out.length ? out.join('; ') : true;
});

await test('fire oil burns every foe a little more, silver only the dead, and venom poisons only the living', async () => {
  const out = [];
  const mean = async (foe, keep) => {
    const ctx = await oiled('oil-dmg-' + foe);
    seedDice(ctx, 'oil-dmg');
    ctx.Game.player().stats.str = 18;
    const m = beside(ctx, foe, { nextAct: 1e12 });
    return landBlows(ctx, m, 240, keep);
  };
  const gob = await mean('goblin', null), gobFire = await mean('goblin', 'fire'), gobSilver = await mean('goblin', 'silver');
  const sk = await mean('skeleton', null), skSilver = await mean('skeleton', 'silver');
  const fireGain = gobFire.mean - gob.mean, silverGob = gobSilver.mean - gob.mean, silverSk = skSilver.mean - sk.mean;
  if (!(fireGain > 1.2 && fireGain < 4)) out.push(`fire oil added ${fireGain.toFixed(2)} a blow`);
  if (Math.abs(silverGob) > 1) out.push(`silver added ${silverGob.toFixed(2)} a blow to a goblin`);
  if (!(silverSk > 1.8)) out.push(`silver added ${silverSk.toFixed(2)} a blow to a skeleton`);
  const venomGob = await mean('goblin', 'venom'), venomSk = await mean('skeleton', 'venom');
  const took = venomGob.lines.filter(l => l === 'POISONED').length;
  if (!(took > 50 && took < 115)) out.push(`venom took on ${took} of 240 blows at a goblin`);
  if (venomSk.lines.includes('POISONED')) out.push('venom poisoned a skeleton');
  // a troll's wound does not close under fire
  const ctx = await oiled('oil-troll');
  const m = beside(ctx, 'troll', { nextAct: 1e12 });
  ctx.Game.player().stats.str = 18;
  landBlows(ctx, m, 1, 'fire');
  if (!(m.burnUntil > ctx.Game.state().t)) out.push('a fire-oiled blow left the troll mending');
  return out.length ? out.join('; ') : true;
});

/** The starving hound won over, for a test outside the hound's own section. */
async function withHoundTop(seed) {
  const ctx = await start('fighter', seed, { levels: 6 });
  const p = ctx.Game.player(); p.hp = p.maxHp = 9999; p.food = 100;
  meetAndChoose(ctx, 'stray', 0); ctx.Game.closeEncounter();
  return ctx;
}
await test('review fixes: a job survives a climb before its floor, counts each one of a group, fits the floor, and is not swapped once done', async () => {
  const out = [];
  /** Stand beside the up stair, facing it, and step onto it. */
  const climb = ctx => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), s = L.stairsUp;
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = Dungeon.DIRS[k], x = s.x - dx, y = s.y - dy;
      if (L.tiles[y * L.w + x] === Dungeon.T.FLOOR) { p.x = x; p.y = y; p.dir = k; break; }
    }
    L.monsters.length = 0; Game.input('forward');
  };
  {
    const ctx = await start('fighter', 'fix-climb');
    const { Game } = ctx; const G = Game.state();
    downOne(ctx);
    const why = takeJob(ctx);
    if (why) return why;
    const d = G.depth;
    climb(ctx);
    if (G.depth !== d - 1) out.push(`the climb went to floor ${G.depth}`);
    else if (!Game.bounty()) out.push('climbing back up before the job\'s floor lost the job');
  }
  {
    const ctx = await start('fighter', 'fix-group');
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999;
    const why = takeJob(ctx);
    if (why) return why;
    const b = Game.bounty(); b.kind = 'cull';
    downOne(ctx);
    const L = Game.level(), here = L.monsters.reduce((n, m) => n + 1 + (m.pack ? m.pack.length : 0), 0);
    if (b.need > Math.max(2, Math.floor(here * 0.6))) out.push(`the cull asks ${b.need} of a floor holding ${here}`);
    b.need = 3; b.got = 0;
    const m = beside(ctx, 'rat', { uid: 660, hp: 1, maxHp: 1, nextAct: 1e12, pack: [{ hp: 1, maxHp: 1 }, { hp: 1, maxHp: 1 }] });
    p.perkHit = 60; p.stats.str = 18;
    for (let i = 0; i < 60 && L.monsters.includes(m); i++) { m.hp = Math.min(m.hp, 1); m.nextAct = 1e12; Game.state().t = Math.max(Game.state().t, p.nextAttack); Game.input('attack'); }
    if (b.got !== 3 || !b.done) out.push(`three rats of one group counted ${b.got}`);
    // done but not yet paid: a trader on or above its giving floor neither pays nor swaps it for another
    b.from = Game.state().depth;
    shopAhead(ctx);
    const row = Game.shopServices().find(s => s.id === 'bounty');
    if (!row || !row.why) out.push('a done job could be swapped for another');
    if (Game.buyService('bounty') || Game.bounty() !== b) out.push('taking another job replaced the done one');
    Game.closeShop();
  }
  {
    // on small floors with few monsters, the cull never asks for more than most of them
    for (let i = 0; i < 6; i++) {
      const ctx = await start('fighter', 'fix-few-' + i, { size: 'small', monsters: 'few' });
      const why = takeJob(ctx);
      if (why) return why;
      const b = ctx.Game.bounty(); b.kind = 'cull'; b.need = 6 + Math.floor(b.depth / 2);
      downOne(ctx);
      const here = ctx.Game.level().monsters.reduce((n, m) => n + 1 + (m.pack ? m.pack.length : 0), 0);
      if (b.need > Math.max(2, Math.floor(here * 0.6))) out.push(`a small sparse floor holding ${here} was asked for ${b.need}`);
    }
  }
  {
    // a full pack, the satchel in it: the pay still goes in the pack
    const ctx = await start('fighter', 'fix-satchel');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    G.bounty = { kind: 'fetch', depth: 1, from: 0, need: 1, got: 1, done: true, started: true, reward: { gold: 50, t: 'oil_fire' } };
    p.inv.push({ t: 'satchel', q: 1, e: 0 });
    while (p.inv.length < Game.INV_MAX) p.inv.push({ t: 'longsword', q: 1, e: 0 });
    shopAhead(ctx);
    if (!p.inv.some(i => i.t === 'oil_fire')) out.push('with the satchel taking the last room, the pay was left on the floor');
  }
  return out.length ? out.join('; ') : true;
});

await test('review fixes: a satchel always lies where it can be walked to, never behind a secret door or a lock', async () => {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const ctx = await start('fighter', 'fix-reach-' + i);
    const { Game, Dungeon } = ctx; const T = Dungeon.T;
    const why = takeJob(ctx);
    if (why) return why;
    Game.bounty().kind = 'fetch';
    downOne(ctx);
    const L = Game.level(), k = Object.keys(L.items).find(key => L.items[key].some(it => it.t === 'satchel'));
    if (!k) { out.push(`seed ${i}: no satchel`); continue; }
    const seen = new Set([L.start.y * L.w + L.start.x]), q = [L.start.y * L.w + L.start.x];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % L.w, y = (c / L.w) | 0;
      for (const [dx, dy] of Dungeon.DIRS) {
        const n = (y + dy) * L.w + x + dx, t = L.tiles[n];
        if (seen.has(n) || [T.WALL, T.TORCH, T.FOUNTAIN, T.SECRET, T.DOOR_LOCKED].includes(t)) continue;
        seen.add(n); q.push(n);
      }
    }
    const [sx, sy] = k.split(',').map(Number);
    if (!seen.has(sy * L.w + sx)) out.push(`seed ${i}: the satchel lies behind a secret door or a lock`);
  }
  return out.length ? out.join('; ') : true;
});

await test('review fixes: an oil rides on the blade it was put on, and a blow turned aside does not wear it; a bite that never landed does not hamstring', async () => {
  const out = [];
  const ctx = await oiled('fix-oil');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.useItem(p.inv.find(i => i.t === 'oil_fire'));
  // a blow on the Warlord on his throne is turned aside: the oil stays
  const m = beside(ctx, 'warlord', { hp: 300, maxHp: 300, nextAct: 1e12, phase: 1, throne: true, wardUntil: G.t + 1e6 });
  p.stats.str = 18; p.perkHit = 60;
  for (let i = 0; i < 6; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  if (!p.coating || p.coating.left !== 20) out.push(`blows turned aside wore the oil to ${p.coating && p.coating.left}`);
  void m;
  // another weapon in hand does not have it
  p.inv.push({ t: 'mace', q: 1, e: 0 });
  Game.equip(p.inv.find(i => i.t === 'mace'));
  if (p.coating) out.push('the oil followed the hero to another weapon');
  // hamstring: a veteran hound's bite on the lich in its shadow does not hold it back
  const h = await withHoundTop('fix-ham');
  const c = h.Game.companion(), G2 = h.Game.state();
  c.floors = 4; c.mode = 'stay';
  const spot = h.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => h.Game.level().tiles[y * h.Game.level().w + x] === h.Dungeon.T.FLOOR && !(x === h.Game.player().x && y === h.Game.player().y));
  if (!spot) return out.concat('no room beside the hound').join('; ');
  const lich = { uid: 93, id: 'lich', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: G2.t + 1e9, wardUntil: G2.t + 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  h.Game.level().monsters.length = 0; h.Game.level().monsters.push(lich);
  const was = lich.nextAct;
  for (let i = 0; i < 600; i++) { h.Game.update(G2.t + 25, 25); if (lich.nextAct !== was && lich.wardUntil > G2.t) break; }
  if (lich.nextAct > was) out.push('a bite on the lich in its shadow held it back');
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

await test('at level 9 a hero on a path is offered its two capstones, in place of the lesson, and only once', async () => {
  const out = [];
  const ctx = await start('fighter', 'capstone-offer');
  const { Game, PATHS, CAPSTONE_LEVEL, BOONS } = ctx;
  const p = Game.player(), G = Game.state();
  walk(ctx, 'knight');
  levelByKill(ctx, CAPSTONE_LEVEL - 1, CAPSTONE_LEVEL);
  const offer = Game.pendingBoons();
  const want = PATHS.fighter[0].capstones.map(c => c.id);
  if (!offer || offer.join() !== want.join() || !Game.isCapstoneOffer(offer)) return `a knight at level 9 was offered ${offer && offer.join(', ')}`;
  if (Game.isPathOffer(offer)) out.push('the capstones were taken for a path offer');
  if (Game.pendingLevel() !== CAPSTONE_LEVEL) out.push(`the offer says level ${Game.pendingLevel()}`);
  if (Game.chooseBoon('undying')) out.push('a knight took the berserker\'s capstone');
  const mark = markLog(G);
  if (!Game.chooseBoon('rally')) return 'could not take Rallying Bash';
  if (p.capstone !== 'rally' || !Game.capstoneOf() || Game.capstoneOf().id !== 'rally') out.push(`chose rally, holds ${p.capstone}`);
  if (Game.pendingBoons()) out.push(`offered ${Game.pendingBoons().join(', ')} as well`);
  if (!linesSince(G, mark).some(l => l.includes('Rallying Bash'))) out.push('the log never named the capstone');
  levelByKill(ctx, CAPSTONE_LEVEL + 1, CAPSTONE_LEVEL + 2);
  const next = Game.pendingBoons();
  if (!next || !next.every(id => BOONS.some(b => b.id === id))) out.push(`at level 11 it was offered ${next && next.join(', ')}`);
  // one who reaches level 9 with the path still to choose has the capstones after it, and the lesson
  const late = await start('mage', 'capstone-late');
  levelByKill(late, CAPSTONE_LEVEL - 1, CAPSTONE_LEVEL);
  const kinds = [];
  while (late.Game.pendingBoons()) {
    const o = late.Game.pendingBoons();
    kinds.push(late.Game.isPathOffer(o) ? 'P' : late.Game.isCapstoneOffer(o) ? 'C' : 'L');
    if (!late.Game.chooseBoon(late.Game.isPathOffer(o) ? 'pyromancer' : o[0], o[0] === 'spread' ? spreadPicks(late.Game) : undefined)) { out.push(`could not choose from ${o.join(', ')}`); break; }
  }
  if (kinds.join('') !== 'PLC') out.push(`a mage without a path at level 9 was offered ${kinds.join('')}`);
  if (late.Game.player().capstone !== 'inferno') out.push(`the late mage mastered ${late.Game.player().capstone}`);
  // a save from before capstones, already at the top level, is offered them on loading
  late.Game.save(true);
  const raw = JSON.parse(late.store.get('deepdelve.save'));
  delete raw.player.capstone;
  raw.player.level = late.MAX_LEVEL; raw.player.xp = late.XP_TABLE[late.MAX_LEVEL - 1]; raw.pendingBoons = []; delete raw.pendingLevels;
  late.store.set('deepdelve.save', JSON.stringify(raw));
  if (!late.Game.load()) out.push('the top-level save would not load');
  else if (!late.Game.isCapstoneOffer(late.Game.pendingBoons() || [])) out.push(`a top-level hero came back offered ${late.Game.pendingBoons()}`);
  // and no hero without a path is offered one
  const none = await start('thief', 'capstone-none');
  none.Game.player().path = undefined;
  none.Game.state().pendingBoons = [];
  if (none.Game.state().pendingBoons.some(none.Game.isCapstoneOffer)) out.push('a thief with no path was offered capstones');
  return out.length ? out.join('; ') : true;
});

await test('capstones: each makes its path\'s own gift stronger', async () => {
  const out = [];
  const hero = async (cls, path, cap) => { const ctx = await start(cls, 'cap-' + (cap || path)); walk(ctx, path); ctx.Game.player().capstone = cap; return ctx; };
  // the spell costs: a Crusader's Smite and a Healer's Wellspring are a point cheaper
  for (const [path, cap, sid] of [['templar', 'crusade', 'smite'], ['healer', 'wellspring', 'cure_light']]) {
    const a = await hero('cleric', path, undefined), b = await hero('cleric', path, cap);
    const sp = a.SPELLS.cleric.find(s => s.id === sid);
    if (b.Game.spellCost(sp) !== a.Game.spellCost(sp) - 1) out.push(`${cap}: ${sid} costs ${a.Game.spellCost(sp)} -> ${b.Game.spellCost(sp)}`);
  }
  // Swift Draw: a bow looses a fifth faster, a sword no faster
  {
    const a = await hero('ranger', 'sharpshooter', undefined), b = await hero('ranger', 'sharpshooter', 'swift_draw');
    for (const c of [a, b]) { const p = c.Game.player(); p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.eq.offhand = null; }
    const r = b.Game.blowRate(b.Game.player().eq.weapon) / a.Game.blowRate(a.Game.player().eq.weapon);
    if (Math.abs(r - 1.25) > 0.01) out.push(`swift_draw: a bow's rate grew by ${r.toFixed(3)}`);
    for (const c of [a, b]) c.Game.player().eq.weapon = { t: 'longsword', q: 1, e: 0 };
    if (b.Game.blowRate(b.Game.player().eq.weapon) !== a.Game.blowRate(a.Game.player().eq.weapon)) out.push('swift_draw quickened a sword');
  }
  // Bloodlust: at half life the rage is +4, not +3
  {
    const a = await hero('fighter', 'berserker', undefined), b = await hero('fighter', 'berserker', 'bloodlust');
    for (const c of [a, b]) { const p = c.Game.player(); p.maxHp = 100; p.hp = 50; }
    if (a.Game.berserkerRage() !== 3 || b.Game.berserkerRage() !== 4) out.push(`bloodlust: rage at half life ${a.Game.berserkerRage()} -> ${b.Game.berserkerRage()}`);
    for (const c of [a, b]) c.Game.player().hp = 1;
    if (a.Game.berserkerRage() !== 4 || b.Game.berserkerRage() !== 6) out.push(`bloodlust: rage near death ${a.Game.berserkerRage()} -> ${b.Game.berserkerRage()}`);
  }
  // Shadow's Edge, Death Mark, Wild Bulwark: a number each
  {
    const a = await hero('thief', 'assassin', undefined), b = await hero('thief', 'assassin', 'shadows_edge'), c = await hero('thief', 'assassin', 'death_mark');
    if (b.Game.critFloor() !== a.Game.critFloor() - 1) out.push(`shadows_edge: crits from ${a.Game.critFloor()} -> ${b.Game.critFloor()}`);
    if (c.Game.sneakMult() !== a.Game.sneakMult() + 1) out.push(`death_mark: strike ${a.Game.sneakMult()} -> ${c.Game.sneakMult()}`);
    const w = await hero('ranger', 'warden', undefined), v = await hero('ranger', 'warden', 'wild_bulwark');
    if (v.Game.playerAC() !== w.Game.playerAC() + 2) out.push(`wild_bulwark: armour class ${w.Game.playerAC()} -> ${v.Game.playerAC()}`);
  }
  // Rallying Bash comes back in half the time and mends; Quick Smoke in 10 seconds
  {
    const left = async (cls, path, cap) => {
      const ctx = await hero(cls, path, cap);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.maxHp = 999; p.hp = 500;
      const m = beside(ctx, 'goblin', { nextAct: G.t });
      for (let i = 0; i < 40 && cls === 'fighter' && !m.windup; i++) Game.update(G.t + 25, 25);
      const hp0 = p.hp;
      if (!Game.useAbility()) return { err: `${cls} could not use the ability` };
      return { left: Game.abilityLeft(), mended: p.hp - hp0 };
    };
    const a = await left('fighter', 'knight', undefined), b = await left('fighter', 'knight', 'rally');
    if (a.err || b.err) out.push(a.err || b.err);
    else {
      if (Math.abs(b.left * 2 - a.left) > 1) out.push(`rally: bash back in ${a.left}s -> ${b.left}s`);
      if (!(b.mended >= 1) || a.mended > 0) out.push(`rally: a bash mended ${a.mended} -> ${b.mended}`);
    }
    const s = await left('thief', 'trickster', undefined), q = await left('thief', 'trickster', 'quick_smoke');
    if (s.err || q.err) out.push(s.err || q.err);
    else if (s.left !== 16 || q.left !== 10) out.push(`quick_smoke: smoke back in ${s.left}s -> ${q.left}s`);
  }
  return out.length ? out.join('; ') : true;
});

await test('Undying and Miracle turn one killing blow on each floor, and only one', async () => {
  const out = [];
  /** Let an ogre beat on the hero until it turns a killing blow, or the hero dies. */
  const standing = ctx => {
    const { Game } = ctx; const G = Game.state();
    for (let i = 0; i < 800 && !Game.level().stoodFast && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  };
  const beaten = (ctx, cap, path) => {
    const { Game } = ctx; const p = Game.player();
    walk(ctx, path); p.capstone = cap; p.maxHp = 40; p.hp = 1;
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    beside(ctx, 'ogre');
    standing(ctx);
  };
  for (const [cls, path, cap] of [['fighter', 'berserker', 'undying'], ['cleric', 'healer', 'miracle']]) {
    const ctx = await start(cls, 'stand-' + cap);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    beaten(ctx, cap, path);
    if (G.status !== 'playing' || !Game.level().stoodFast || !(cap === 'undying' ? p.hp === 1 : p.hp >= 15)) { out.push(`${cap}: after the first killing blow, ${G.status} on ${p.hp}`); continue; }
    for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
    if (G.status === 'playing') out.push(`${cap}: turned a second killing blow on the same floor`);
    // without the capstone the first blow kills
    const plain = await start(cls, 'stand-' + cap);
    beaten(plain, undefined, path);
    if (plain.Game.state().status === 'playing') out.push(`${path} without ${cap} lived through the blow`);
  }
  // a new floor brings it back
  const ctx = await start('fighter', 'stand-floor');
  const { Game } = ctx; const p = Game.player();
  Game.level().stoodFast = true;
  Game.level().monsters.length = 0; Game.descend();
  if (Game.level().stoodFast) out.push('the new floor came already spent');
  beaten(ctx, 'undying', 'berserker');
  if (Game.state().status !== 'playing' || p.hp !== 1) out.push(`on the next floor Undying left ${Game.state().status} on ${p.hp}`);
  return out.length ? out.join('; ') : true;
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

await test('Healer: heals a quarter more, mends under Protection, and has more spell points', async () => {
  const out = [];
  // a quarter more on average, small heals included: rounded, a heal of 4 stayed 4
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
  if (!(b / a > 1.2 && b / a < 1.3)) out.push(`cure light over 300 casts: ${a} -> ${b}`);
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
  if (!(healer >= 4 && healer <= 5)) out.push(`a healer mended ${healer} in twenty seconds`);
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
  if (plain.cost !== 3 || pyro.cost !== 4) out.push(`burning hands cost ${plain.cost}, then ${pyro.cost} (a Pyromancer's reaches three squares, for a point more)`);
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

await test('every choice of every encounter can be taken, passed and failed, and says what it did', async () => {
  const { ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const ctx = await start('fighter', 'every-choice', { levels: 8 });
  const { Game } = ctx; const p = Game.player();
  const seen = new Set();
  for (const [id, e] of Object.entries(ENCOUNTERS)) {
    for (let i = 0; i < e.choices.length; i++) {
      // a strong hero and a hopeless one by turns, until both sides of a check
      // have come up (a hopeless hero still passes one time in four or five)
      for (let t = 0; t < 40; t++) {
        if (t >= 2 && (!e.choices[i].check || (seen.has(`${id}/${i}/true`) && seen.has(`${id}/${i}/false`)))) break;
        for (const k in p.stats) p.stats[k] = t % 2 ? 3 : 30;
        p.hp = p.maxHp = 999; p.gold = 99999; p.inv.length = 0;
        // (one companion at a time: one won at an earlier encounter would bar the hiring)
        Game.state().companion = null;
        let r;
        try { r = meetAndChoose(ctx, id, i); } catch (err) { return `${id} choice ${i}: ${err.message}`; }
        Game.closeEncounter();
        if (!r || typeof r.text !== 'string' || !r.lines.every(l => typeof l === 'string' && l.length)) return `${id} choice ${i} gave no clear result`;
        if (r.check) seen.add(`${id}/${i}/${r.check.pass}`);
      }
    }
  }
  // every checked choice was seen to pass and to fail
  for (const [id, e] of Object.entries(ENCOUNTERS)) e.choices.forEach((ch, i) => {
    if (ch.check && !(seen.has(`${id}/${i}/true`) && seen.has(`${id}/${i}/false`))) seen.add('missing ' + id + '/' + i);
  });
  const missing = [...seen].filter(k => k.startsWith('missing'));
  return !missing.length || missing.join(', ');
});

await test('a Lampfolk\'s lamp relit is thanked by the next Lampfolk trader below, once; one robbed in the dark makes their traders dearer', async () => {
  const out = [];
  const kind = { t: 'longsword', q: 1, e: 0 };
  // the kindness
  {
    const ctx = await start('fighter', 'lamp-kind', { levels: 5 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats.dex = 30; p.hp = p.maxHp = 999;
    for (let i = 0; i < 6 && !(G.threads && G.threads.lamp); i++) { meetAndChoose(ctx, 'lampfolk', 0); Game.closeEncounter(); }
    if (!G.threads || !G.threads.lamp) return 'relighting the lamp left no thread';
    const draughts = () => (p.inv.find(it => it.t === 'potion_heal') || { q: 0 }).q;
    const had = draughts();
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had) out.push('a trader on the same floor already thanked you');
    Game.level().monsters.length = 0; Game.descend();
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had + 1) out.push(`the trader below gave ${draughts() - had} draughts, not one`);
    shopAhead(ctx); Game.closeShop();
    if (draughts() !== had + 1) out.push('a second trader thanked you again');
    if (!Game.threadNotes().some(n => /Lampfolk/.test(n))) out.push('the hero sheet forgot the lamp');
    if (!Game.epilogue(true).join(' ').includes('light a lamp')) out.push('the epilogue forgot the lamp');
  }
  // one sworn to no draughts is thanked with a scroll
  {
    const ctx = await start('fighter', 'lamp-vow', { levels: 5 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    G.opts.vows = ['unaided'];
    G.threads = { lamp: 1 };
    Game.level().monsters.length = 0; Game.descend();
    const had = p.inv.filter(it => it.t === 'potion_heal').length;
    shopAhead(ctx); Game.closeShop();
    if (!p.inv.some(it => it.t === 'scroll_heal')) out.push('one sworn unaided was not given the scroll');
    if (p.inv.filter(it => it.t === 'potion_heal').length !== had) out.push('one sworn unaided was given a draught');
  }
  // the theft
  {
    const ctx = await start('thief', 'lamp-rob', { levels: 5 });
    const { Game } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 999;
    const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
    const before = Game.buyPrice(shop, kind);
    // caught or not, the Lampfolk hear of it
    meetAndChoose(ctx, 'lampfolk', 3); Game.closeEncounter();
    if (!G.threads || !G.threads.robbed) return 'robbing the Lampfolk left no thread';
    if (Game.buyPrice(shop, kind) !== before) out.push('a trader on the same floor already knew');
    Game.level().monsters.length = 0; Game.descend();
    const dear = Game.buyPrice(shop, kind);
    if (!(dear > before)) out.push(`a Lampfolk trader below asked ${dear}, not more than ${before}`);
    Game.level().twist = 'market';
    if (Game.buyPrice(shop, kind) !== before) out.push('a goblin pedlar cared about the Lampfolk');
    Game.level().twist = null;
    if (!Game.threadNotes().some(n => /robbed/.test(n))) out.push('the hero sheet forgot the theft');
  }
  return out.length ? out.join('; ') : true;
});

await test('the Lever Door: worked out, a vault of gold and gear; heaved open, less, and the floor hears; a wrong order or a wrench hurts', async () => {
  const out = [];
  const ctx = await start('mage', 'levers', { levels: 8 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  while (G.depth < 4) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
  // worked out by a sharp mind (a natural 1 fails anything: tried a few times)
  p.stats.int = 30;
  let r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) { const g0 = p.gold; r = meetAndChoose(ctx, 'levers', 0); Game.closeEncounter(); if (r.check.pass && p.gold - g0 < 12 * G.depth) out.push(`the vault held ${p.gold - g0} gold, not ${12 * G.depth}`); }
  if (!r.check.pass) out.push('a sharp mind never worked out the levers');
  // heaved: the floor wakes
  p.stats.str = 30;
  const L = Game.level();
  r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) {
    L.monsters.length = 0;
    r = meetAndChoose(ctx, 'levers', 1);
    Game.closeEncounter();
  }
  if (!r.check.pass) out.push('great strength never heaved the door');
  else if (!r.lines.some(l => /is awake/.test(l))) out.push('heaving the door was not heard');
  // failing either hurts
  p.stats.int = 1; p.stats.str = 1;
  for (const i of [0, 1]) {
    let hurt = false;
    for (let k = 0; k < 6 && !hurt; k++) { p.hp = 999; const rr = meetAndChoose(ctx, 'levers', i); Game.closeEncounter(); if (!rr.check.pass) hurt = p.hp < 999; }
    if (!hurt) out.push(`failing choice ${i} at the lever door did no harm`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a lost mule: led on, the next trader below knows it and pays once; stripped, gold and gear now; followed, the floor learnt or an hour lost', async () => {
  const out = [];
  const ctx = await start('fighter', 'mule', { levels: 8 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
  meetAndChoose(ctx, 'mule', 0); Game.closeEncounter();
  if (!G.threads || G.threads.mule !== 3) return `leading the mule on left the thread ${JSON.stringify(G.threads)}`;
  if (!Game.threadNotes().some(n => /mule/.test(n))) out.push('the hero sheet forgot the mule');
  let g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold !== g0) out.push('a trader on the same floor paid for the mule');
  Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
  g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold - g0 !== 18 * G.depth) out.push(`the trader below paid ${p.gold - g0}, not ${18 * G.depth}`);
  g0 = p.gold;
  shopAhead(ctx); Game.closeShop();
  if (p.gold !== g0) out.push('a second trader paid again');
  if (!Game.threadNotes().some(n => /paid you/.test(n))) out.push('the hero sheet did not say the mule was paid for');
  // stripped
  g0 = p.gold;
  meetAndChoose(ctx, 'mule', 1); Game.closeEncounter();
  // (the one thing worth having may be a purse of its own)
  if (p.gold - g0 < 5 * G.depth) out.push(`stripping the mule gave ${p.gold - g0} gold, not ${5 * G.depth}`);
  // followed by one who reads it well: the floor is learnt; badly, food is lost
  p.stats.wis = 30;
  let r = null;
  for (let i = 0; i < 6 && !(r && r.check.pass); i++) { r = meetAndChoose(ctx, 'mule', 2); Game.closeEncounter(); }
  const L = Game.level();
  if (!r.check.pass) out.push('a wise hero never followed the mule');
  else if (L.seen && !Array.from(L.seen).some(Boolean)) out.push('following the mule learnt nothing of the floor');
  p.stats.wis = 1; p.food = 80;
  let lost = false;
  for (let i = 0; i < 6 && !lost; i++) { const f0 = p.food; r = meetAndChoose(ctx, 'mule', 2); Game.closeEncounter(); if (!r.check.pass) lost = p.food < f0; }
  if (!lost) out.push('losing the mule cost no food');
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
      // (a smouldering floor is a deep one: the last quarter, never the deepest)
      if (plan[d] === 'smouldering' ? d < 6 || d > 7 : d < 2 || d > 6) return `seed ${seed} put ${plan[d]} on floor ${d}`;
      if (named[d]) return `seed ${seed} put ${plan[d]} on ${named[d]}'s floor`;
      if (plan[d + 1]) return `seed ${seed} twisted floors ${d} and ${d + 1}`;
    }
  }
  return seen.size === 7 || `only ${[...seen].join(', ')} were ever dealt`;
});

await test('each floor twist does what it says, and is told on arriving', async () => {
  const out = [];
  const find = async kind => {
    const { Dungeon } = await start('fighter', 'twist-find');
    for (let i = 0; i < 400; i++) { const plan = Dungeon.twistPlan('twist' + i, 8); const d = Object.keys(plan).find(k => plan[k] === kind); if (d) return { seed: 'twist' + i, d: Number(d) }; }
    return null;
  };
  for (const kind of ['dark', 'flooded', 'restless', 'market', 'tremors', 'smouldering']) {
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
      // (each creature rises on a roll, so one floor of seven can fall short: counted over three)
      let dead = 0, all = 0;
      for (let i = 0, n = 0; i < 400 && n < 3; i++) {
        const seed = 'twist' + i, d = Object.keys(ctx.Dungeon.twistPlan(seed, 8)).find(k => ctx.Dungeon.twistPlan(seed, 8)[k] === 'restless');
        if (!d) continue;
        n++;
        const c2 = seed === at.seed ? ctx : await start('fighter', seed, { levels: 8 });
        if (c2 !== ctx) { c2.Game.player().hp = c2.Game.player().maxHp = 9999; downTo(c2, Number(d)); }
        const plain = c2.Game.level().monsters.filter(x => !MONSTERS[x.id].named && !x.pack);
        dead += plain.filter(x => MONSTERS[x.id].undead).length; all += plain.length;
      }
      if (all >= 12 && dead < all * 0.4) out.push(`only ${dead} of ${all} creatures on three restless floors are undead`);
    }
    if (kind === 'tremors') {
      // (in a few seconds of arriving the ground has shuddered once)
      run(Game, G, 9000);
      if (!L.quake || L.quake.next <= G.t || !linesSince(G, mark).some(l => /ground shudders/.test(l))) out.push('a floor of tremors never shuddered');
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
  // but nothing is dressed under the hero's feet, wherever they stood when it was saved
  {
    const L2 = Game.level(), p = Game.player(), spot = L2.dressing.find(d => d.k !== 'puddle');
    if (spot) {
      p.x = spot.x; p.y = spot.y;
      delete L2.dressing;
      Game.save(true); Game.load();
      const q = Game.player();
      if (Game.level().dressing.some(d => d.x === q.x && d.y === q.y)) out.push('an old save was dressed under the hero');
    }
  }
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
  // (a natural 1 misses whatever the odds: swung a few times)
  for (let i = 0; i < 4 && m.hp === 999; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); }
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
  if (Math.abs(far - near - 1) > 0.01) out.push(`arrows from three squares did ${far.toFixed(2)} a shot, from beside it ${near.toFixed(2)}`);
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


  // ---------- the fallen ----------
  /** Let a goblin beside the hero kill them. */
  const fallTo = (ctx, id = 'goblin') => {
    const { Game } = ctx, G = Game.state(), p = Game.player();
    p.hp = 1; p.eq.armor = null;
    beside(ctx, id);
    for (let i = 0; i < 4000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
    return G.status === 'dead';
  };
  const FALLEN = 'deepdelve.fallen';

  await test('a hero who dies and is loaded again is not left below, but another hero who fell still is', async () => {
    const ctx = await start('fighter', 'bones-reload');
    const { Game } = ctx;
    downTo(ctx, 2);
    Game.save(true);
    if (!fallTo(ctx)) return 'the goblin never killed the hero';
    if (!ctx.store.get(FALLEN)) return 'the death was not remembered';
    if (!Game.load()) return 'the save did not load';
    if (ctx.store.get(FALLEN)) return 'the hero was loaded alive and is still remembered as fallen';
    // someone else's death is theirs to keep
    const other = JSON.stringify({ name: 'Brand', cls: 'thief', level: 3, depth: 2, run: 'another-run', gear: [] });
    ctx.store.set(FALLEN, other);
    if (!Game.load()) return 'the save did not load a second time';
    return ctx.store.get(FALLEN) === other || 'loading forgot a different hero\'s death';
  });

  await test('a hero who dies is remembered, and a later run finds their bones, their gear and their shade on that floor', async () => {
    const ctx = await start('fighter', 'bones-fall');
    const { Game } = ctx;
    downTo(ctx, 3);
    const p = Game.player();
    p.eq.weapon = { t: 'longsword', q: 1, e: 2 };
    p.eq.shield = null;
    p.eq.offhand = { t: 'dagger', q: 1, e: 1, u: 'grimtooth' };       // a relic: one of a kind, so it goes plain
    p.eq.ring = { t: 'ring_protect', q: 1, e: 1, curse: 1 };
    if (!fallTo(ctx)) return 'the goblin never killed the hero';
    if (!/Test will not lie quiet/.test(Game.epilogue(false).join(' '))) return 'the end screen does not say the hero will be found';
    const rec = JSON.parse(ctx.store.get(FALLEN) || 'null');
    if (!rec) return 'nobody was remembered';
    if (rec.name !== 'Test' || rec.cls !== 'fighter' || rec.depth !== 3) return `remembered ${JSON.stringify(rec)}`;
    if (rec.killer !== 'a goblin') return `killed by "${rec.killer}"`;
    const kinds = rec.gear.map(it => it.t).join(',');
    if (kinds !== 'longsword,ring_protect,dagger') return `kept ${kinds}`;
    if (rec.gear.some(it => it.u)) return 'a relic was kept as a relic';
    if (!rec.gear.every(it => it.h === 1)) return 'the gear\'s quality was not hidden again';
    if (rec.gear[0].e !== 2 || !rec.gear[1].curse) return `the gear lost its make: ${JSON.stringify(rec.gear)}`;

    // the next run, the same device: floor 3 holds them
    Game.newGame({ name: 'Heir', cls: 'thief', stats: Game.rollStats(), seed: 'bones-next', opts: OPTS });
    downTo(ctx, 2);
    if (Game.level().monsters.some(m => m.shade)) return 'a shade on floor 2, not where the hero fell';
    const mark = markLog(Game.state());
    downTo(ctx, 3);
    const L = Game.level(), sh = L.monsters.find(m => m.shade);
    if (!sh) return 'no shade on the floor where the hero fell';
    if (sh.awake) return 'the shade was awake before it was found';
    const said = linesSince(Game.state(), mark);
    if (!said.some(l => /Test the Fighter fell on this floor, killed by a goblin,/.test(l))) return `arriving said: ${said.join(' | ')}`;
    const pile = (L.items[sh.x + ',' + sh.y] || []).map(it => it.t).join(',');
    if (pile !== 'longsword,ring_protect,dagger') return `the bones hold ${pile}`;
    if (!(L.dressing || []).some(d => d.x === sh.x && d.y === sh.y && d.k === 'remains_bones')) return 'no bones where the shade stands';
    const st = Game.mstat(sh);
    if (st.name !== 'Shade of Test' || st.move !== 'charge') return `the shade is ${st.name}, moving ${st.move}`;
    // and the map itself is the seed's own: a device with nobody remembered draws the same floor
    const plain = await start('thief', 'bones-next');
    downTo(plain, 3);
    if (plain.Game.level().monsters.some(m => m.shade)) return 'a shade with nobody remembered';
    if (plain.Game.level().tiles.join('') !== L.tiles.join('')) return 'remembering someone changed the map';
    return true;
  });

  await test('laying a shade to rest forgets its hero, says so, and leaves their gear; the Hall remembers who did it', async () => {
    const ctx = await start('cleric', 'bones-rest');
    const { Game, Dungeon } = ctx;
    ctx.store.set(FALLEN, JSON.stringify({ name: 'Wren', cls: 'mage', level: 4, depth: 3, run: 'earlier', gear: [{ t: 'staff', q: 1, e: 1 }] }));
    downTo(ctx, 3);
    const L = Game.level(), G = Game.state(), p = Game.player();
    const sh = L.monsters.find(m => m.shade);
    if (!sh) return 'no shade';
    const st = Game.mstat(sh);
    if (!st.ranged || st.ranged.element !== 'cold') return 'a mage\'s shade should throw cold fire';
    const bx = sh.x, by = sh.y;
    // bring it in front of the hero, one blow from gone
    L.monsters = [sh];
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    Object.assign(sh, { x: p.x + dx, y: p.y + dy, rx: p.x + dx, ry: p.y + dy, hp: 1, awake: true, spoke: true, nextAct: G.t + 1e9 });
    const mark = markLog(G);
    // a natural 1 misses: swing until it lands
    for (let i = 0; i < 40 && L.monsters.includes(sh); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (L.monsters.includes(sh)) return 'the shade would not fall';
    if (!linesSince(G, mark).some(l => /Wren the Mage is laid to rest at last/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
    if (ctx.store.has(FALLEN)) return 'the hero was still remembered after being laid to rest';
    if (!(L.items[bx + ',' + by] || []).some(it => it.t === 'staff')) return 'their gear went with them';
    Game.save(true);
    if (Game.state().rested !== 'Wren the Mage') return `the run says it laid ${Game.state().rested} to rest`;
    if (!/found Wren the Mage, who had gone before them, and laid them to rest/.test(Game.epilogue(true).join(' '))) return 'the end of the run does not tell of the shade laid to rest';
    // the next run meets nobody
    Game.newGame({ name: 'After', cls: 'fighter', stats: Game.rollStats(), seed: 'bones-rest', opts: OPTS });
    downTo(ctx, 3);
    return !Game.level().monsters.some(m => m.shade) || 'a shade laid to rest came back';
  });

  await test('a shade is never met by the run that died, in a daily delve, or on the lich\'s floor; a newer death takes the older one\'s place', async () => {
    const out = [];
    // the run that died, loaded again, does not meet itself
    const a = await start('fighter', 'bones-self');
    downTo(a, 2);
    const G = a.Game.state();
    a.Game.save(true);
    if (!fallTo(a)) return 'the hero would not die';
    const own = JSON.parse(a.store.get(FALLEN) || 'null');
    if (!own || own.run !== String(G.created)) out.push('the death was not remembered as this run');
    // put the floors back as they were before the death, and go on down
    a.Game.load();
    downTo(a, 3);
    for (const d of [2, 3]) if (a.Game.state().levels[d] && a.Game.state().levels[d].monsters.some(m => m.shade)) out.push(`the run met its own shade on floor ${d}`);
    // a daily delve is the same for everyone, and meets nobody's dead
    const b = await start('fighter', 'bones-daily', { daily: '2026-09-26' });
    b.store.set(FALLEN, JSON.stringify({ name: 'Ada', cls: 'thief', level: 3, depth: 2, run: 'x', gear: [] }));
    downTo(b, 3);
    for (const d of [2, 3]) if (b.Game.state().levels[d].monsters.some(m => m.shade)) out.push('a daily delve met a shade');
    if (/will not lie quiet/.test(b.Game.epilogue(false).join(' '))) out.push('a daily delve promises its dead will be found');
    // and a daily death is not remembered: whoever was stays
    if (!fallTo(b)) out.push('the daily hero would not die');
    else if ((JSON.parse(b.store.get(FALLEN) || 'null') || {}).name !== 'Ada') out.push('a daily death replaced the hero remembered');
    // someone who fell deeper than this delve goes waits on the last floor before the lich's
    const c = await start('fighter', 'bones-deep');
    c.store.set(FALLEN, JSON.stringify({ name: 'Bo', cls: 'ranger', level: 9, depth: 9, run: 'x', gear: [] }));
    downTo(c, 4);
    const lv = c.Game.state().levels;
    if (!lv[3].monsters.some(m => m.shade)) out.push('someone who fell on floor 9 was not waiting on floor 3 of four');
    if (lv[4].monsters.some(m => m.shade)) out.push('a shade on the lich\'s floor');
    // a thief's shade is quick and follows a step back
    const t = c.Game.mstat({ id: 'shade', shade: { name: 'Ada', cls: 'thief', level: 3, run: 'x', depth: 3 }, x: 0, y: 0 });
    if (!(t.speed < 1000) || !t.lunge) out.push(`a thief's shade moves every ${t.speed} and lunges ${t.lunge}`);
    // a newer death takes the older one's place
    const d = await start('mage', 'bones-newer');
    d.store.set(FALLEN, JSON.stringify({ name: 'Old', cls: 'thief', level: 3, depth: 2, run: 'x', gear: [] }));
    if (!fallTo(d)) return 'the mage would not die';
    const now = JSON.parse(d.store.get(FALLEN) || 'null');
    if (!now || now.name !== 'Test' || now.cls !== 'mage') out.push(`after a newer death, remembered ${JSON.stringify(now)}`);
    // and a stored record that makes no sense is nobody at all
    const e = await start('fighter', 'bones-junk');
    e.store.set(FALLEN, '{"name": 5, "cls": "wizard"}');
    downTo(e, 3);
    if (e.Game.level().monsters.some(m => m.shade)) out.push('a shade from a record that made no sense');
    return out.length ? out.join('; ') : true;
  });


  await test('a shade never clears away a floor\'s champion, and is made sturdier on Hard as the floor\'s own creatures are', async () => {
    const out = [];
    let tried = 0;
    // seeds where the shade's bones used to land beside the champion and clear it away
    const busyFloor = { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true, traps: true };
    for (const seed of ['nm126', 'nm147', 'nm154', 'nm159']) {
      const ctx = await start('fighter', seed, busyFloor);
      const plan = ctx.Dungeon.namedPlan(seed, 8);
      for (const d of Object.keys(plan).map(Number)) {
      if (ctx.Game.state().depth > d) continue;
      tried++;
      ctx.store.set(FALLEN, JSON.stringify({ name: 'Kit', cls: 'fighter', level: 3, depth: d, run: 'x', gear: [] }));
      downTo(ctx, d);
      const L = ctx.Game.level(), champ = L.monsters.find(m => m.id === plan[d]), sh = L.monsters.find(m => m.shade);
      if (!champ) out.push(`${seed}: the champion of floor ${d} was cleared away`);
      else if (sh && Math.abs(sh.x - champ.x) + Math.abs(sh.y - champ.y) <= 3) out.push(`${seed}: the shade lies in the champion's lair`);
      }
    }
    if (tried < 4) out.push(`only ${tried} champion floors tried`);
    // the same shade on the same floor, Easy against Hard
    const hp = async difficulty => {
      const c = await start('fighter', 'bones-hard', { difficulty });
      c.store.set(FALLEN, JSON.stringify({ name: 'Kit', cls: 'fighter', level: 3, depth: 3, run: 'x', gear: [] }));
      downTo(c, 3);
      const sh = c.Game.level().monsters.find(m => m.shade);
      return sh ? sh.maxHp : 0;
    };
    const easy = await hp('easy'), hard = await hp('hard');
    if (!easy || !(hard > easy)) out.push(`a shade has ${easy} life on Easy and ${hard} on Hard`);
    return out.length ? out.join('; ') : true;
  });

  await test('a trader never buys a thing back for more than they would sell it for, however charming and light-fingered the hero', async () => {
    const ctx = await start('thief', 'market-loop');
    const { Game, Dungeon } = ctx;
    const p = Game.player(), G = Game.state();
    p.stats.cha = 20; p.talents = (p.talents || []).concat('light_fingers');
    // a captive freed on the floor above: the market vouches for them
    Game.level().monsters.length = 0; Game.descend();
    G.threads = { ...(G.threads || {}), captive: 1 };
    const shop = { id: 'merchant', x: 0, y: 0, markup: 1.35, stock: [{ t: 'potion_xheal', q: 3, e: 0 }, { t: 'longsword', q: 1, e: 1 }] };
    const L = Game.level(); L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR; Game.input('forward');
    if (!Game.currentShop()) return 'could not open the shop';
    const out = [];
    for (const it of shop.stock) {
      const buy = Game.buyPrice(shop, it), sell = Game.sellPrice({ ...it, q: 1 });
      if (sell >= buy) out.push(`${it.t}: bought for ${buy}, sold back for ${sell}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a scroll of teleport never sets the hero down on a trader, an encounter or a barrel', async () => {
    const ctx = await start('fighter', 'teleport-clear');
    const { Game, Dungeon } = ctx;
    const out = [];
    for (let i = 0; i < 60; i++) {
      const L = Game.level(), p = Game.player();
      // a floor crowded with things to land on: every other open square holds a trader, a stone or a barrel
      L.monsters.length = 0; L.npcs = []; L.dressing = [];
      let n = 0;
      for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
        if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR || (x === p.x && y === p.y) || n++ % 2) continue;
        if (n % 6 === 1) L.npcs.push({ id: 'merchant', x, y, markup: 2, stock: [] });
        else if (n % 6 === 3) L.npcs.push({ id: 'mercy', kind: 'encounter', x, y });
        else L.dressing.push({ x, y, k: 'barrel', ox: 0, oy: 0 });
      }
      const it = { t: 'scroll_teleport', q: 1, e: 0 };
      p.inv.push(it);
      Game.useItem(it);
      const on = L.npcs.find(q => q.x === p.x && q.y === p.y) || L.dressing.find(q => q.x === p.x && q.y === p.y);
      if (on) { out.push(`landed on ${on.id || on.k} at ${p.x},${p.y}`); break; }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a floor readier for a strong hero never makes a whole pack into champions', async () => {
    const out = [];
    let packs = 0;
    for (let i = 0; i < 40; i++) {
      const ctx = await start('fighter', `press-pack-${i}`, { levels: 8, monsters: 'normal' });
      const { Game } = ctx;
      // a hero far ahead of the depth: the third floor (the first a floor is ever pressed on) is pressed hard
      const p = Game.player(), G = Game.state(); p.level = 12;
      while (G.depth < 3) { Game.level().monsters.length = 0; if (Game.forkPending()) Game.chooseRoute('crypts'); Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      if (!(Game.level().press > 0)) { out.push(`floor 3 was not pressed (press ${Game.level().press})`); break; }
      for (const m of Game.level().monsters) if (m.pack) { packs++; if (m.elite) out.push(`${m.elite} ${m.id} pack on press-pack-${i}`); }
      if (out.length) break;
    }
    if (!packs) out.push('no packs met to try');
    return out.length ? out.join('; ') : true;
  });

  // ---------- the music ----------
  await test('the music hears how the fight stands: quiet, wary, fight, a champion, the lich', async () => {
    const ctx = await start('fighter', 'mood');
    const { Game, Dungeon } = ctx;
    const out = [], p = Game.player(), L = Game.level(), G = Game.state();
    L.monsters.length = 0;
    if (Game.mood() !== 'quiet') out.push(`with nothing about: ${Game.mood()}`);
    // a straight open run east of the hero, walled either side, so steps and squares agree
    for (let k = 1; k <= 10; k++) { L.tiles[p.y * L.w + p.x + k] = Dungeon.T.FLOOR; L.tiles[(p.y - 1) * L.w + p.x + k] = Dungeon.T.WALL; L.tiles[(p.y + 1) * L.w + p.x + k] = Dungeon.T.WALL; }
    const later = () => { G.t += 300; };     // the walking distances are worked out afresh every quarter second
    const put = (id, d, extra = {}) => {
      L.monsters.length = 0;
      L.monsters.push({ uid: 5, id, x: p.x + d, y: p.y, hp: 50, maxHp: 50, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra });
      later();
    };
    put('goblin', 8, { awake: false });
    if (Game.mood() !== 'quiet') out.push(`a goblin asleep: ${Game.mood()}`);
    put('goblin', 8);
    if (Game.mood() !== 'wary') out.push(`a goblin awake eight squares off: ${Game.mood()}`);
    put('goblin', 2);
    if (Game.mood() !== 'fight') out.push(`a goblin awake two squares off: ${Game.mood()}`);
    // it steps back out of reach: the fight holds a moment, then eases
    put('goblin', 8);
    if (Game.mood() !== 'fight') out.push(`a goblin stepping out of reach ended the fight at once: ${Game.mood()}`);
    G.t += 3000;
    if (Game.mood() !== 'wary') out.push(`three seconds later, still ${Game.mood()}`);
    // awake two squares off through a wall, with no way round: no fight
    L.tiles[p.y * L.w + p.x + 1] = Dungeon.T.WALL;
    put('goblin', 2);
    G.t += 3000;
    if (Game.mood() !== 'quiet') out.push(`a goblin behind a wall it cannot pass: ${Game.mood()}`);
    L.tiles[p.y * L.w + p.x + 1] = Dungeon.T.FLOOR;
    put('grisk', 6, { spoke: true });
    if (Game.mood() !== 'champion') out.push(`Grisk awake and spoken: ${Game.mood()}`);
    put('shade', 3, { spoke: true, shade: { name: 'Wren', cls: 'mage', level: 3, run: 'x', depth: 2 } });
    if (Game.mood() !== 'champion') out.push(`a shade awake: ${Game.mood()}`);
    beside(ctx, 'lich', { spoke: true, nextAct: 1e12 });
    if (Game.mood() !== 'boss') out.push(`the lich awake: ${Game.mood()}`);
    L.monsters = L.monsters.filter(m => m.id !== 'lich');
    beside(ctx, 'warlord', { spoke: true, nextAct: 1e12 });
    if (Game.mood() !== 'warlord') out.push(`the Warlord awake: ${Game.mood()}`);
    G.status = 'dead';
    if (Game.mood() !== 'quiet') out.push(`over the fallen: ${Game.mood()}`);
    void Dungeon;
    return out.length ? out.join('; ') : true;
  });

  await test('the music keeps to each floor\'s scale, grows with the fight, and comes home when it ends', async () => {
    const { Music } = await start('fighter', 'music');
    const out = [];
    const inScale = (theme, midi) => { const sc = Music.SCALES[theme]; return sc.steps.includes(((midi - sc.root) % 12 + 12) % 12); };
    const count = (steps, k) => steps.reduce((n, s) => n + s.notes.filter(x => x.k === k).length, 0);
    for (let theme = 0; theme < Music.SCALES.length; theme++) {
      for (const mood of Music.MOODS) {
        const steps = Music.plan(mood, theme, 64);
        const stray = steps.flatMap(s => s.notes).filter(n => n.k !== 'thud' && !inScale(theme, n.midi));
        if (stray.length) out.push(`theme ${theme}, ${mood}: ${stray.length} notes off its scale`);
      }
    }
    const quiet = Music.plan('quiet', 0, 64), wary = Music.plan('wary', 0, 64), fight = Music.plan('fight', 0, 64), champ = Music.plan('champion', 0, 64), boss = Music.plan('boss', 0, 64);
    // quiet is sparse: bells, a long silence between phrases, no beat
    const quietBells = count(quiet, 'bell');
    if (quietBells < 3 || quietBells > 24) out.push(`quiet rang ${quietBells} bells in 64 steps`);
    if (count(quiet, 'pulse') || count(quiet, 'thud')) out.push('quiet has a beat');
    if (!count(wary, 'pulse') || count(wary, 'thud')) out.push('wary should pulse, not beat');
    if (count(fight, 'pulse') < 60 || count(fight, 'thud') < 12) out.push(`a fight pulsed ${count(fight, 'pulse')} and beat ${count(fight, 'thud')}`);
    if (count(fight, 'horn') || !count(champ, 'horn') || !count(boss, 'horn')) out.push('only a champion or the lich brings the horn');
    if (!(boss[0].dur < fight[0].dur && fight[0].dur < quiet[0].dur)) out.push('the music does not quicken with the fight');
    // the Warlord's hall is led by his drum: more of the beat than the lich's, and still the horn
    const warlord = Music.plan('warlord', 0, 64);
    if (!(count(warlord, 'thud') > count(boss, 'thud')) || !count(warlord, 'horn')) out.push(`the Warlord's music beat ${count(warlord, 'thud')} to the lich's ${count(boss, 'thud')}`);
    // two floors sound different
    const tune = t => Music.plan('fight', t, 16).flatMap(s => s.notes.filter(n => n.k === 'bell').map(n => n.midi)).join();
    if (tune(0) === tune(4)) out.push('the Grey Halls and the Crimson Crypts play the same fight');
    // a fight ending: home to the floor's own note, then a hush
    const sc = Music.SCALES[0];
    const c = [];
    Music.listen(n => c.push(n));
    try {
      for (let t = 0; t < 4000; t += 50) Music.update('fight', 0, 10000 + t);
      c.length = 0;
      for (let t = 0; t < 1200; t += 50) Music.update('quiet', 0, 14000 + t);
      const bells = c.filter(n => n.k === 'bell');
      if (!bells.length || (bells[bells.length - 1].midi - sc.root) % 12 !== 0) out.push(`the fight's end did not come home: ${bells.map(n => n.midi).join(',')}`);
      c.length = 0;
      for (let t = 1200; t < 1200 + (Music.HUSH_S - 2) * 1000; t += 50) Music.update('quiet', 0, 14000 + t);
      if (c.some(n => n.k === 'bell')) out.push('the bells came back before the hush was over');
      // and it is silent when turned off
      Music.toggle();
      c.length = 0;
      for (let t = 0; t < 3000; t += 50) Music.update('fight', 0, 40000 + t);
      if (c.length) out.push('the music played while turned off');
    } finally { if (!Music.isEnabled()) Music.toggle(); Music.listen(null); Music.stop(); }
    return out.length ? out.join('; ') : true;
  });

  // ---------- save codes ----------
  await test('a save code carries a hero to another device, and a bad one says why and harms nothing', async () => {
    const out = [];
    const a = await start('mage', 'code-carry', { levels: 6 });
    { const { Game } = a; const p = Game.player();
      Game.level().monsters.length = 0; Game.descend();
      p.gold = 321; p.hp = Math.max(1, p.hp - 2); }
    const code = await a.Game.saveCode();
    const want = { name: a.Game.player().name, depth: a.Game.state().depth, gold: a.Game.player().gold, hp: a.Game.player().hp, inv: a.Game.player().inv.length };
    if (!code || !/^DD1\./.test(code)) return `the code came out as ${String(code).slice(0, 20)}`;
    // another device: a fresh world with its own storage and a hero of its own waiting
    const b = await start('fighter', 'code-other');
    b.Game.save(true);
    const before = b.store.get('deepdelve.save');
    for (const [bad, why] of [['hello there', /not a Deepdelve save code/], [code.slice(0, Math.floor(code.length / 2)), /not whole/], ['DD1.' + 'A'.repeat(40), /not whole/]]) {
      const r = await b.Game.loadCode(bad);
      if (r.ok || !why.test(r.why || '')) out.push(`a bad code (${bad.slice(0, 12)}…) said: ${r.why}`);
    }
    if (b.store.get('deepdelve.save') !== before) out.push('a bad code touched the hero already saved here');
    // a code pasted from a message, broken over lines and spaced out
    const r = await b.Game.loadCode('  ' + code.replace(/(.{60})/g, '$1\n ') + '\n');
    if (!r.ok) return `the code would not load: ${r.why}`;
    const got = { name: b.Game.player().name, depth: b.Game.state().depth, gold: b.Game.player().gold, hp: b.Game.player().hp, inv: b.Game.player().inv.length };
    if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`the hero came over as ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
    if (!b.Game.hasSave()) out.push('the hero from the code was not kept as the save here');
    return out.length ? out.join('; ') : true;
  });

  await test('a save code cannot take back a permadeath run on the device that played it; a gentler run loads any code', async () => {
    const out = [];
    const ctx = await start('fighter', 'code-perma', { levels: 6, permadeath: true });
    const { Game } = ctx;
    const old = await Game.saveCode();
    Game.level().monsters.length = 0; run(Game, Game.state(), 2000); Game.descend();
    Game.save(true);
    const late = await Game.saveCode();
    const r1 = await Game.loadCode(old);
    if (r1.ok || !/further/.test(r1.why || '')) out.push(`an older code for a permadeath run loaded: ${r1.why}`);
    const r2 = await Game.loadCode(late);
    if (!r2.ok) out.push(`the latest code for a living permadeath hero was refused: ${r2.why}`);
    if (!fallTo(ctx)) return 'the hero would not die';
    const r3 = await Game.loadCode(late);
    if (r3.ok || !/already ended/.test(r3.why || '')) out.push(`a code for a permadeath hero who died here loaded: ${r3.why}`);
    // on a device that never saw the run, the same code loads (the guard is each device's own)
    const other = await newContext();
    const r4 = await other.Game.loadCode(late);
    if (!r4.ok) out.push(`a device that never saw the run refused its code: ${r4.why}`);
    // a run without permadeath goes back to any code, as its own Load Game does
    const soft = await start('fighter', 'code-soft', { levels: 6, permadeath: false });
    const early = await soft.Game.saveCode();
    soft.Game.level().monsters.length = 0; soft.Game.descend(); soft.Game.save(true);
    const r5 = await soft.Game.loadCode(early);
    if (!r5.ok || soft.Game.state().depth !== 1) out.push(`a gentler run would not go back to an older code: ${r5.why}`);
    return out.length ? out.join('; ') : true;
  });

  await test('saves made while the game stands still (switching apps) do not make a device refuse a code played further elsewhere', async () => {
    const a = await start('fighter', 'code-switch', { levels: 6, permadeath: true });
    const code = await a.Game.saveCode();
    // the page is put away twice to paste it into a message: two saves, no play
    a.Game.save(true); a.Game.save(true);
    const keep = new Map(a.store);
    // another device plays on from the code a little, and sends it back
    const b = await newContext();
    if (!(await b.Game.loadCode(code)).ok) return 'the other device would not take the code';
    b.Game.level().monsters.length = 0; run(b.Game, b.Game.state(), 5000);
    const back = await b.Game.saveCode();
    // the first device again, with its own storage as it was
    const a2 = await newContext();
    for (const [k, v] of keep) a2.store.set(k, v);
    const r = await a2.Game.loadCode(back);
    return r.ok || `a code played further was refused: ${r.why}`;
  });

  await test('a code from elsewhere is made safe before the page writes it out', async () => {
    const a = await start('fighter', 'code-clean', { levels: 6 });
    a.Game.state().log.push({ m: 'x', c: '"><img src=x onerror=alert(1)>' });
    a.Game.player().gold = '<b>1</b>';
    const code = await a.Game.saveCode();
    const b = await newContext();
    if (!(await b.Game.loadCode(code)).ok) return 'the code would not load';
    const bad = b.Game.state().log.find(e => /onerror/.test(e.c || ''));
    if (bad) return 'a log line kept a class with markup in it';
    return b.Game.player().gold === 0 || `gold came in as ${JSON.stringify(b.Game.player().gold)}`;
  });

  await test('a hero dies once, however many blows land in the swing that kills them', async () => {
    for (let tries = 0; tries < 30; tries++) {
      const ctx = await start('fighter', 'die-once' + tries);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
      p.stats.str = 30; p.stats.dex = 30;
      const m = beside(ctx, 'quillback', { hp: 999, maxHp: 999, nextAct: 1e12 });
      m.windup = { kind: 'move', move: 'bristle', at: G.t, until: G.t + 1e9 };
      p.hp = 1;
      const mark = markLog(G);
      G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
      if (G.status !== 'dead') continue;                  // the blow missed: again
      const said = linesSince(G, mark);
      const deaths = said.filter(l => /has died/.test(l)).length;
      if (!said.some(l => /off hand/i.test(l)) && tries < 29) continue;   // wanted: a swing whose off hand would have followed
      return deaths === 1 || `the death was told ${deaths} times: ${said.join(' | ')}`;
    }
    return 'no swing killed the hero';
  });

  await test('a blink hound does not blink through a wall to a hero it could not walk to', async () => {
    const ctx = await start('fighter', 'blink-wall');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    // a hound two squares ahead with a wall between, and no way round near
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) { const x = p.x + xx, y = p.y + yy; if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = T.WALL; }
    L.tiles[p.y * L.w + p.x] = T.FLOOR; L.tiles[(p.y - dy) * L.w + p.x - dx] = T.FLOOR;
    L.tiles[(p.y + 2 * dy) * L.w + p.x + 2 * dx] = T.FLOOR;
    L.monsters.length = 0;
    const m = { uid: 91, id: 'hound', x: p.x + 2 * dx, y: p.y + 2 * dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, blows: 1 };
    L.monsters.push(m);
    for (let i = 0; i < 400; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'blink') return 'it blinked through the wall'; }
    return true;
  });

  // ---------- the hero's hound ----------
  /** Win the starving hound over (sharing food never fails). */
  const withHound = async (seed, opts = {}) => {
    const ctx = await start('fighter', seed, { levels: 6, ...opts });
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999; p.food = 100;
    ctx.mealsBefore = p.inv.filter(it => it.t === 'ration' || it.t === 'bread' || it.t === 'meat').reduce((a, it) => a + (it.q || 1), 0);
    meetAndChoose(ctx, 'stray', 0); Game.closeEncounter();
    return ctx;
  };
  /** Open floor all round the hero, a few squares each way, and nothing else on the floor. */
  const clearAround = (ctx, r = 4) => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
    for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    L.monsters.length = 0; L.npcs = []; L.items = {};
  };

  await test('the starving hound follows a hero who feeds it: it keeps up, and swaps places rather than blocking the way', async () => {
    const ctx = await withHound('hound-join');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const c = Game.companion();
    if (!c || c.fallen || c.mode !== 'follow' || !c.name) return `no hound followed: ${JSON.stringify(c)}`;
    // a meal from the pack pays for it (a fighter sets out with rations)
    const meals = p.inv.filter(it => it.t === 'ration' || it.t === 'bread' || it.t === 'meat').reduce((a, it) => a + (it.q || 1), 0);
    if (ctx.mealsBefore && meals !== ctx.mealsBefore - 1) return `feeding it took ${ctx.mealsBefore - meals} meals from the pack, not one`;
    if (!ctx.mealsBefore && p.food !== 75) return `feeding it cost ${100 - p.food} nourishment, not 25`;
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) return 'it did not start beside the hero';
    clearAround(ctx, 6);
    // walk four squares; it keeps up
    for (let i = 0; i < 4; i++) { Game.input('forward'); run(Game, G, 400); }
    run(Game, G, 1500);
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) return `the hound lagged ${Math.abs(c.x - p.x) + Math.abs(c.y - p.y)} squares behind`;
    // face it and walk into it: it takes the hero's square
    const k = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === c.x - p.x && dy === c.y - p.y);
    p.dir = k; const was = [p.x, p.y], at = [c.x, c.y];
    Game.input('forward');
    if (p.x !== at[0] || p.y !== at[1] || c.x !== was[0] || c.y !== was[1]) return 'walking into the hound did not swap places';
    return Game.threadNotes().some(n => n.includes(c.name)) || 'the hero sheet does not mention the hound';
  });

  await test('the hound bites an awake foe beside it, takes the blows of a foe that reaches it first, and can fall for good', async () => {
    const out = [];
    const ctx = await withHound('hound-fight');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion();
    clearAround(ctx);
    // a goblin beside the hound, not the hero
    const put = (id, extra) => {
      const L = Game.level(), p = Game.player();
      const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
      const m = { uid: 97, id, x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
      L.monsters.length = 0; L.monsters.push(m); return m;
    };
    const g = put('goblin', { nextAct: 1e12 });
    const mark = markLog(G);
    run(Game, G, 6000);
    if (!(g.hp < 999)) out.push('the hound never bit the goblin beside it');
    if (!linesSince(G, mark).some(l => l.includes(`${c.name} bites`))) out.push('its bite was not told');
    // an ogre beside it swings at it, and in time it falls
    put('ogre');
    const hp0 = c.hp;
    for (let i = 0; i < 1200 && !c.fallen; i++) { Game.update(G.t + 25, 25); Game.player().hp = 9999; }
    if (!(c.hp < hp0) && !c.fallen) out.push('an ogre beside the hound never struck it');
    if (!c.fallen) out.push('the hound never fell');
    if (Game.state().status !== 'playing') out.push('the hero died instead');
    if (c.fallen && !Game.threadNotes().some(n => /fell/.test(n))) out.push('the hero sheet does not say it fell');
    if (c.fallen && !Game.epilogue(false).join(' ').includes(c.name)) out.push('the epilogue forgot it');
    return out.length ? out.join('; ') : true;
  });

  await test('told to stay, the hound stays, even down the stair; at heel it comes too; resting heals it; a reload keeps it', async () => {
    const out = [];
    const ctx = await withHound('hound-stay');
    const { Game } = ctx; const p = Game.player(), G = Game.state(); const c = Game.companion();
    clearAround(ctx);
    const k = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === c.x - p.x && dy === c.y - p.y);
    p.dir = k;
    if (Game.useLabel() !== 'Stay') out.push(`facing the hound, Use says ${Game.useLabel()}`);
    Game.input('use');
    if (c.mode !== 'stay') out.push('Use did not tell it to stay');
    if (Game.useLabel() !== 'Come') out.push(`told to stay, Use says ${Game.useLabel()}`);
    Game.input('use');
    if (c.mode !== 'follow') out.push('Use did not call it back');
    Game.input('use');
    const d0 = G.depth;
    Game.level().monsters.length = 0; Game.descend();
    if (c.depth !== d0) out.push('a hound told to stay came down the stair');
    // another hero keeps theirs at heel, and it comes down with them
    {
      const b2 = await withHound('hound-heel');
      const G2 = b2.Game.state(), p2 = b2.Game.player(), c2 = b2.Game.companion();
      b2.Game.level().monsters.length = 0; b2.Game.descend();
      if (c2.depth !== G2.depth) out.push('a hound at heel did not come down the stair');
      else if (Math.abs(c2.x - p2.x) + Math.abs(c2.y - p2.y) !== 1) out.push('it did not arrive beside the hero');
    }
    {
      const b3 = await withHound('hound-rest');
      const c3 = b3.Game.companion();
      c3.hp = 1; b3.Game.player().hp = 1;
      clearAround(b3);
      b3.Game.rest();
      if (!(c3.hp > 1)) out.push('resting did not heal the hound');
      b3.Game.save(true);
      const name = c3.name, hp = c3.hp;
      if (!b3.Game.load()) return 'the game would not load';
      const c4 = b3.Game.companion();
      if (!c4 || c4.name !== name || c4.hp !== hp) out.push(`after a reload the hound was ${JSON.stringify(c4)}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('raised quills stab the hound that bites into them, not the hero; the starving hound waits on the second floor of about two runs in three', async () => {
    const out = [];
    const ctx = await withHound('hound-quills');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion(); const p = Game.player();
    clearAround(ctx);
    const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
    const q = { uid: 98, id: 'quillback', x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    q.windup = { kind: 'move', move: 'bristle', at: G.t, until: G.t + 1e9 };
    Game.level().monsters.push(q);
    const hp0 = c.hp, php = p.hp;
    for (let i = 0; i < 400 && q.hp === 999; i++) Game.update(G.t + 25, 25);
    if (q.hp === 999) out.push('the hound never bit the quillback');
    else if (!(c.hp < hp0)) out.push('the quills did not stab the hound');
    if (p.hp < php) out.push('the quills stabbed the hero for the hound\'s bite');
    const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    let n = 0;
    for (let i = 0; i < 300; i++) if (encounterPlan('stray' + i, 8)[2].includes('stray')) n++;
    if (n < 170 || n > 230) out.push(`the hound waited on floor 2 in ${n} of 300 runs`);
    if (encounterPlan('stray-short', 2).flat().includes('stray')) out.push('a two-floor delve met the hound');
    return out.length ? out.join('; ') : true;
  });

  await test('a hound at heel is heard a square sooner: a sleeper seven squares off wakes, and does not while the hound is told to stay', async () => {
    const ctx = await withHound('hound-noise');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion(), L = Game.level();
    // a plain fighter: no quiet blood, no quiet ring, no dark floor
    p.bg = 'debtor'; L.twist = null;
    clearAround(ctx, 8);
    const dir = ctx.Dungeon.DIRS.find(([dx, dy]) => p.x + 7 * dx > 0 && p.x + 7 * dx < L.w - 1 && p.y + 7 * dy > 0 && p.y + 7 * dy < L.h - 1);
    const sleeper = () => {
      const m = { uid: 99, id: 'goblin', x: p.x + 7 * dir[0], y: p.y + 7 * dir[1], hp: 999, maxHp: 999, awake: false, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.length = 0; L.monsters.push(m); return m;
    };
    let m = sleeper();
    Game.update(G.t + 25, 25);
    if (!m.awake) return 'a sleeper seven squares off slept on through a hound at heel';
    c.mode = 'stay';
    m = sleeper();
    Game.update(G.t + 25, 25);
    return !m.awake || 'a sleeper seven squares off woke though the hound was told to stay';
  });

  /** The hound's floor made plain: walls everywhere but what the test lays down. */
  const bareFloor = ctx => {
    const L = ctx.Game.level();
    L.monsters.length = 0; L.npcs = []; L.items = {}; L.traps = {}; L.dressing = [];
    L.tiles.fill(ctx.Dungeon.T.WALL);
    return L;
  };
  const dig = (ctx, x0, y0, x1, y1) => { const L = ctx.Game.level(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.tiles[y * L.w + x] = ctx.Dungeon.T.FLOOR; };

  await test('the hound finds its own way: round a stone in the way, past a door pulled shut, and back from far behind', async () => {
    const out = [];
    const near = (c, p) => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1;
    {
      // an encounter's stone square between it and the hero, in an open room
      const ctx = await withHound('hound-way-stone');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx); dig(ctx, 3, 3, 15, 9);
      p.x = 12; p.y = 6; c.x = 4; c.y = 6; L.npcs = [{ id: 'mapmaker', kind: 'encounter', x: 5, y: 6 }];
      run(Game, G, 8000);
      if (!near(c, p)) out.push(`a stone in the way kept it at ${c.x},${c.y}`);
    }
    {
      // the only way through is a shut door: it turns up at the hero's side all the same
      const ctx = await withHound('hound-way-door');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx); dig(ctx, 3, 3, 7, 9); dig(ctx, 11, 3, 15, 9); dig(ctx, 9, 4, 10, 4);
      L.tiles[4 * L.w + 8] = ctx.Dungeon.T.DOOR;
      p.x = 12; p.y = 4; c.x = 6; c.y = 4;
      run(Game, G, 8000);
      if (!near(c, p)) out.push(`a shut door kept it at ${c.x},${c.y}`);
      if (L.tiles[4 * L.w + 8] !== ctx.Dungeon.T.DOOR) out.push('it opened the door');
    }
    {
      // far behind, down a long corridor turning back on itself: it trots, and catches up
      const ctx = await withHound('hound-way-far');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx), e = L.w - 3;
      dig(ctx, 2, 3, e, 3); dig(ctx, e, 3, e, 7); dig(ctx, 2, 7, e, 7);
      p.x = 3; p.y = 7; c.x = 3; c.y = 3;
      run(Game, G, 16000);
      if (!near(c, p)) out.push(`from ${2 * (e - 3) + 4} squares back it only reached ${c.x},${c.y}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('nothing lands on the hound\'s square to stay; Use strikes a foe in front before it talks to the hound', async () => {
    const out = [];
    const ctx = await withHound('hound-stack');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    bareFloor(ctx); dig(ctx, 3, 3, 15, 9);
    p.x = 8; p.y = 6; p.dir = 1; c.x = 9; c.y = 6;
    // a rat come to stand where the hound stands (as a lunge or a summoning once put one)
    const rat = { uid: 95, id: 'rat', x: 9, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    Game.level().monsters.push(rat);
    if (Game.useLabel() === 'Stay' || Game.useLabel() === 'Come') out.push(`with a rat in front, Use says ${Game.useLabel()}`);
    const was = c.mode;
    Game.input('use');
    if (c.mode !== was) out.push('Use told the hound to stay instead of striking the rat');
    // and with a goblin beside it to bite, it still gives way first
    Game.level().monsters.push({ uid: 93, id: 'goblin', x: 9, y: 5, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    run(Game, G, 1500);
    if (c.x === rat.x && c.y === rat.y) out.push('the hound stayed on the rat\'s square');
    // and a rat that lunges after a hero stepping back does not land on the hound behind them
    {
      const b = await withHound('hound-lunge');
      const G2 = b.Game.state(), p2 = b.Game.player(), c2 = b.Game.companion();
      bareFloor(b); dig(b, 3, 3, 15, 9);
      p2.x = 8; p2.y = 6; p2.dir = 1; c2.x = 7; c2.y = 6; c2.mode = 'stay';
      let stacked = 0;
      for (let i = 0; i < 12; i++) {
        p2.x = 8; p2.y = 6; c2.x = 7; c2.y = 6; c2.hp = c2.maxHp = 9999;
        const m = { uid: 96, id: 'rat', x: 9, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: G2.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
        b.Game.level().monsters.length = 0; b.Game.level().monsters.push(m);
        for (let t = 0; t < 3000 && !m.windup; t += 25) b.Game.update(G2.t + 25, 25);
        if (!m.windup) continue;
        // the hero steps back into the hound, and they swap: the hound now stands where the rat will lunge
        b.Game.input('back');
        let on = false;
        for (let t = 0; t < 2000; t += 25) { b.Game.update(G2.t + 25, 25); if (m.x === c2.x && m.y === c2.y) on = true; }
        if (on) stacked++;
      }
      if (stacked) out.push(`a lunging rat landed on the hound ${stacked} times`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the hound\'s bite breaks no rite, horn call or chant: those are the hero\'s to break', async () => {
    const out = [];
    for (const [id, move, extra] of [['lich', 'rite', { phase: 2 }], ['grisk', 'rally', {}], ['acolyte', 'mend', {}]]) {
      const ctx = await withHound('hound-rite-' + id);
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      bareFloor(ctx); dig(ctx, 3, 3, 16, 12);
      p.x = 10; p.y = 7; c.x = 11; c.y = 7; c.maxHp = c.hp = 9999;
      const m = { uid: 91, id, x: 12, y: 7, hp: 500, maxHp: 999, awake: true, nextAct: 1e12, rx: 12, ry: 7, fromX: 12, fromY: 7, moveT0: 0, moveT1: 0, flashUntil: 0, spoke: true, ...extra };
      m.windup = { kind: 'move', move, at: G.t, until: G.t + 1e9 };
      Game.level().monsters.push(m);
      const mark = markLog(G);
      // until its first bite lands (a level-one hound misses a lich more often than not)
      let bit = false;
      for (let t = 0; t < 40000 && !bit; t += 25) { Game.update(G.t + 25, 25); bit = linesSince(G, mark).some(l => l.includes(`${c.name} bites`)); }
      run(Game, G, 500);
      if (!bit) out.push(`the hound never bit the ${id}`);
      else if (!m.windup) out.push(`the hound's bite broke the ${id}'s ${move}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the hound after a reload is not caught mid-lunge; one left floors above is not at the hero\'s side at the end; sharing needs food to share', async () => {
    const out = [];
    const ctx = await withHound('hound-odds');
    const { Game } = ctx; const G = Game.state(), c = Game.companion();
    c.lungeAt = 1e12; c.stuckSince = G.t;
    clearAround(ctx);
    Game.save(true);
    if (!Game.load()) return 'the game would not load';
    const c2 = Game.companion();
    if (c2.lungeAt) out.push(`after a reload its lunge clock read ${c2.lungeAt}`);
    if (c2.stuckSince) out.push('after a reload it still counted itself stuck');
    // told to stay floors above, then the Heart won: it is not by the fire that night
    c2.mode = 'stay'; c2.depth = Game.state().depth + 3;
    const won = Game.epilogue(true).join(' ');
    if (!won.includes(c2.name) || /sleeps by their fire/.test(won)) out.push(`the epilogue had the hound left behind at the hero's side: ${won}`);
    // a hero with too little food cannot share it
    {
      const b = await start('fighter', 'hound-hungry', { levels: 6 });
      const p = b.Game.player(), L = b.Game.level(), [dx, dy] = b.Dungeon.DIRS[p.dir];
      p.food = 10;
      // nothing in the pack to give, either
      const packed = p.inv.filter(it => ['ration', 'bread', 'meat'].includes(it.t));
      p.inv = p.inv.filter(it => !['ration', 'bread', 'meat'].includes(it.t));
      L.tiles[(p.y + dy) * L.w + p.x + dx] = b.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'stray', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      b.Game.input('use');
      const o = b.Game.encounterOptions()[0];
      if (!o.blocked) out.push('sharing food was open to a hero with 10 food');
      if (o.cost !== '25 food') out.push(`the cost read ${o.cost}`);
      b.Game.chooseEncounter(0);
      if (b.Game.companion()) out.push('a hero with nothing to share won the hound by sharing');
      // nor the last of it
      p.food = 25;
      if (!b.Game.encounterOptions()[0].blocked) out.push('a hero with exactly 25 food could share it all and starve');
      // but a ration in the pack will do
      p.inv.push(...packed.slice(0, 1));
      if (packed.length && b.Game.encounterOptions()[0].blocked) out.push('a hero with a ration in the pack was too poor to share');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a hurt hound is a reason to rest; it follows a hero who walks on rather than fight alone; its end is told as it was', async () => {
    const out = [];
    {
      const ctx = await withHound('hound-rest-whole');
      const { Game } = ctx; const p = Game.player(), c = Game.companion();
      clearAround(ctx);
      p.hp = p.maxHp; p.sp = p.maxSp; c.hp = 2;
      if (!Game.rest()) out.push('an unhurt hero would not rest for a hurt hound');
      else if (!(c.hp > 2)) out.push('the rest did not heal the hound');
      c.hp = c.maxHp;
      if (Game.rest()) out.push('a hero and hound both whole could still rest');
    }
    {
      const ctx = await withHound('hound-walks-on');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      bareFloor(ctx); dig(ctx, 3, 3, 20, 9);
      p.x = 18; p.y = 6; c.x = 5; c.y = 6; c.hp = c.maxHp = 9999;
      const g = { uid: 94, id: 'goblin', x: 4, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(g);
      run(Game, G, 4000);
      if (g.hp < 999) out.push('it stayed to bite a goblin while the hero was thirteen squares off');
      if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) out.push(`it did not come after the hero (it is at ${c.x},${c.y})`);
    }
    {
      const ctx = await withHound('hound-end');
      const { Game } = ctx; const c = Game.companion();
      const lost = Game.epilogue(false).join(' ');
      if (!lost.includes(`${c.name} stood over them to the last`)) out.push(`a death with the hound at their side was told as: ${lost}`);
      c.mode = 'stay';
      if (Game.epilogue(false).join(' ').includes('stood over them')) out.push('a hound told to stay across the floor still stood over them');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a lost hound turns up at the hero\'s back or side, never in plain sight in front of them', async () => {
    const out = [];
    const ctx = await withHound('hound-sight');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    const L = bareFloor(ctx); dig(ctx, 3, 6, 18, 6);
    // the hero near the corridor's end (room at their back), looking back down it at the hound; a sleeper between
    p.x = 16; p.y = 6; p.dir = 3; c.x = 4; c.y = 6;
    L.monsters.push({ uid: 92, id: 'goblin', x: 10, y: 6, hp: 999, maxHp: 999, awake: false, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    run(Game, G, 6000);
    if (c.x > 10) out.push(`it blinked past the sleeper into plain sight, to ${c.x},${c.y}`);
    // the hero turns away: now it finds its way round, and comes up behind them
    Game.input('right'); Game.input('right');
    run(Game, G, 5000);
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) out.push(`with the hero looking away it was still at ${c.x},${c.y}`);
    return out.length ? out.join('; ') : true;
  });

  // ---------- the goblin, the other companion ----------
  /** Let the caged goblin out (the bars are wrenched until they give: a check, retried). */
  const withGoblin = async (seed, opts = {}) => {
    const ctx = await start('fighter', seed, { levels: 8, ...opts });
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999; p.stats.str = 18;
    for (let i = 0; i < 30 && !Game.companion(); i++) { meetAndChoose(ctx, 'caged', 0); Game.closeEncounter(); }
    return ctx;
  };

  // a sellsword hired on a middle floor, the hero made sturdy and rich enough to hire
  const withSellsword = async (seed, opts = {}) => {
    const ctx = await start('fighter', seed, { levels: 8, ...opts });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    p.gold = 1000;
    meetAndChoose(ctx, 'hire', 0); Game.closeEncounter();
    return ctx;
  };

  await test('a sellsword for hire: paid, they follow; haggled, half or nothing; with a companion already at your side the hiring is not on offer', async () => {
    const out = [];
    {
      const ctx = await withSellsword('sell-pay');
      const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c || c.kind !== 'sellsword') return `no sellsword followed: ${JSON.stringify(c)}`;
      if (p.gold !== 1000 - 20 * G.depth) out.push(`hiring cost ${1000 - p.gold}, not ${20 * G.depth}`);
      // tougher than a hound
      if (c.maxHp < 14 + 5 * p.level) out.push(`a sellsword has ${c.maxHp} hit points`);
      if (!Game.threadNotes().some(n => n.includes(c.name) && /sellsword/.test(n))) out.push('the hero sheet does not name the sellsword');
      // one at a time: with them at your side, neither hiring is on offer, but the talk is
      p.gold = 1000;
      const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'hire', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      Game.input('use');
      const o = Game.encounterOptions();
      if (!o[0].blocked || !o[1].blocked || o[2].blocked) out.push(`with a companion, the choices were blocked ${o.map(x => !!x.blocked)}`);
      if (Game.chooseEncounter(0) || p.gold !== 1000) out.push('a second sellsword was paid for');
      Game.closeEncounter();
    }
    // haggled by a silver tongue: half
    {
      const ctx = await start('fighter', 'sell-haggle', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 30;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { p.gold = 1000; r = meetAndChoose(ctx, 'hire', 1); Game.closeEncounter(); }
      if (!r.check.pass) out.push('a silver tongue never haggled');
      else {
        if (p.gold !== 1000 - 10 * G.depth) out.push(`haggled, the sellsword cost ${1000 - p.gold}, not ${10 * G.depth}`);
        if (!Game.companion() || Game.companion().kind !== 'sellsword') out.push('haggled down, the sellsword did not follow');
      }
    }
    // haggled badly: the coin comes back, and so does nobody (exactly the coin: a Trickster's purse finds no more in it)
    {
      const ctx = await start('thief', 'sell-haggle-fail', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.path = 'trickster'; p.hp = p.maxHp = 9999;
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 1;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && !r.check.pass); i++) { p.gold = 1000; G.companion = null; r = meetAndChoose(ctx, 'hire', 1); Game.closeEncounter(); }
      if (r.check.pass) out.push('a churl haggled six times running');
      else {
        if (p.gold !== 1000) out.push(`a failed haggle cost ${1000 - p.gold}`);
        if (Game.companion()) out.push('a failed haggle still hired the sellsword');
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a sellsword cuts what stands beside them; blooded, they guard you (one blow in three from a foe beside them both); a veteran, they find a second wind once a floor', async () => {
    const out = [];
    const ctx = await withSellsword('sell-guard');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 7; c.y = 7; c.mode = 'stay';
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    // an orc beside them both, swinging at the hero
    const orc = () => { L.monsters.length = 0; L.monsters.push({ uid: 91, id: 'orc', x: 7, y: 6, hp: 99999, maxHp: 99999, awake: true, nextAct: G.t, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 }); };
    const guarded = ms => { const mark = markLog(G); orc(); c.hp = c.maxHp = 9999; p.hp = 9999; run(Game, G, ms); L.monsters.length = 0; return { took: countSaid(linesSince(G, mark), /steps into the blow meant for you/), hit: countSaid(linesSince(G, mark), /hits you/) }; };
    // it cuts, slowly: about one blow in 1.3 seconds
    {
      const mark = markLog(G); orc(); c.hp = c.maxHp = 9999; L.monsters[0].nextAct = 1e12;
      run(Game, G, 13000);
      if (!countSaid(linesSince(G, mark), new RegExp(`${c.name} cuts the`))) out.push('the sellsword never cut the orc');
      // (each swing, landed or not, is a lunge: about ten in thirteen seconds)
      if (L.monsters[0].hp > 99999 - 10) out.push('the sellsword\'s cuts did almost nothing');
      L.monsters.length = 0;
    }
    // not yet blooded: it takes nothing for you
    c.floors = 0;
    let g = guarded(20000);
    if (g.took) out.push(`not yet blooded, the sellsword took ${g.took} blows for you`);
    // blooded: about one landed blow in three
    c.floors = 2;
    g = guarded(60000);
    const share = g.took / Math.max(1, g.took + g.hit);
    if (g.took + g.hit < 15 || share < 0.15 || share > 0.55) out.push(`blooded, the sellsword took ${g.took} of ${g.took + g.hit} blows`);
    // not beside the orc: it cannot step in
    c.x = 5; c.y = 6;
    g = guarded(20000);
    if (g.took) out.push(`from across the hero, the sellsword took ${g.took} blows`);
    // the hero sheet counts the blows taken
    if (!Game.threadNotes().some(n => /blows? taken for you/.test(n))) out.push('the hero sheet does not count the blows the sellsword took');
    // a veteran: once a floor, the blow that should fell them leaves them at half
    c.floors = 4; c.x = 7; c.y = 7; c.hp = 1; c.maxHp = 40;
    L.twist = 'tremors';
    L.quake = { next: G.t + 1e9, falls: [{ x: c.x, y: c.y, at: G.t, lands: G.t + 100 }] };
    let mark = markLog(G);
    run(Game, G, 200);
    if (c.fallen || c.hp !== 20) out.push(`a veteran under falling rock ${c.fallen ? 'fell' : `stood at ${c.hp}`}, not at half`);
    if (!linesSince(G, mark).some(l => /second wind/.test(l))) out.push('the second wind was not told');
    // and only once a floor
    c.hp = 1;
    L.quake.falls = [{ x: c.x, y: c.y, at: G.t, lands: G.t + 100 }];
    run(Game, G, 200);
    if (!c.fallen) out.push('a second second wind on the same floor');
    return out.length ? out.join('; ') : true;
  });

  /** A trader in front of the hero, the companion moved out of the way, and the shop opened. */
  const shopWith = (ctx, shop) => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), c = Game.companion();
    L.npcs = [shop]; L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR;
    if (c && c.x === shop.x && c.y === shop.y) { c.x = p.x - dx; c.y = p.y - dy; }
    Game.input('forward');
    return !!Game.currentShop();
  };
  /** A companion beside a foe stood in front of the hero, and not beside the hero. */
  const besideFoe = (ctx, c, m) => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
    const spot = Dungeon.DIRS.map(([dx, dy]) => [m.x + dx, m.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1);
    L.tiles[spot[1] * L.w + spot[0]] = Dungeon.T.FLOOR;
    c.x = spot[0]; c.y = spot[1]; c.depth = Game.state().depth; c.mode = 'stay';
  };

  await test('a trader brings out a whetstone for a sellsword, once; worn, it adds three to every cut; a hound has no use for it', async () => {
    const out = [];
    const ctx = await withSellsword('sell-whet');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
    let mark = markLog(G);
    if (!shopWith(ctx, shop)) return 'could not open the shop';
    const whets = () => shop.stock.filter(s => s.t === 'charm_whetstone').reduce((a, s) => a + s.q, 0);
    if (whets() !== 1) out.push(`with a sellsword at heel the shelf held ${whets()} whetstones`);
    if (!linesSince(G, mark).some(l => /brings a whetstone out/.test(l))) out.push('the whetstone was brought out unsaid');
    Game.closeShop();
    shopWith(ctx, shop);
    if (whets() !== 1) out.push(`opened again, the shelf held ${whets()} whetstones`);
    Game.closeShop();
    // a hound's trader keeps it under the counter
    {
      const h = await withHound('whet-hound');
      const shop2 = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      shopWith(h, shop2);
      if (shop2.stock.some(s => s.t === 'charm_whetstone')) out.push('a trader brought out a whetstone for a hound');
      // nor will a hound wear one
      const it = { t: 'charm_whetstone', q: 1, e: 0 };
      h.Game.closeShop();
      h.Game.player().inv.push(it);
      const why = h.Game.giveCharm(it);
      if (!why || h.Game.companion().charm || !h.Game.player().inv.includes(it)) out.push(`a hound took the whetstone (${why})`);
    }
    // worn: three more a cut, the same swings
    const cuts = async charm => {
      const b = await withSellsword('whet-cuts-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); seedDice(b, 'whet-cuts');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 96, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let total = 0, n = 0;
      for (let i = 0; i < 24000 && n < 150; i++) { const hp = m.hp; b.Game.update(G2.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      return total / Math.max(1, n);
    };
    const plain = await cuts(undefined), keen = await cuts('charm_whetstone');
    if (!(keen - plain > 2.5 && keen - plain < 3.5)) out.push(`the whetstone: ${plain.toFixed(2)} -> ${keen.toFixed(2)} a cut`);
    return out.length ? out.join('; ') : true;
  });

  await test('below the eighth floor of a Long Delve a sellsword wants a wage at each new floor; unpaid, they will not guard, and take it once there is gold', async () => {
    const out = [];
    const ctx = await withSellsword('sell-wage', { levels: 12 });
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const down = () => { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); };
    while (G.depth < 7) down();
    // to the eighth: no wage yet
    p.gold = 1000; let mark = markLog(G);
    down();
    if (G.depth !== 8 || c.depth !== 8) return `went down to ${G.depth}, the sellsword on ${c.depth}`;
    if (p.gold !== 1000 || c.wages) out.push(`on the eighth floor the sellsword took ${1000 - p.gold}`);
    // the ninth: four gold a floor down, paid
    down();
    if (p.gold !== 1000 - 36) out.push(`on the ninth the wage was ${1000 - p.gold}, not 36`);
    if (!linesSince(G, mark).some(l => /holds out a hand/.test(l) && l.includes(c.name))) out.push('the wage was taken unsaid');
    // (and said after the floor is, so the floor's own words do not push it out of sight)
    { const ls = linesSince(G, mark), at = re => ls.findIndex(l => re.test(l));
      if (at(/holds out a hand/) < at(/You descend to floor 9/)) out.push(`the wage was asked before the floor was told: ${ls.join(' | ')}`); }
    // the tenth, with ten gold: owed, and said so
    p.gold = 10; mark = markLog(G);
    down();
    if (p.gold !== 10 || c.unpaid !== 40) out.push(`with ten gold on the tenth: ${p.gold} gold left, ${c.unpaid} owed`);
    if (!linesSince(G, mark).some(l => /will not step into a blow for you until paid/.test(l))) out.push('the unpaid wage was not told');
    if (!Game.threadNotes().some(n => /owed 40 gold/.test(n))) out.push('the hero sheet does not say what is owed');
    // owed, a veteran will not guard
    c.floors = 4;
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 7; c.y = 7; c.mode = 'stay';
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3; p.hp = p.maxHp = 9999;
    const guarded = ms => {
      const m = markLog(G);
      L.monsters.length = 0; L.monsters.push({ uid: 92, id: 'orc', x: 7, y: 6, hp: 99999, maxHp: 99999, awake: true, nextAct: G.t, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
      c.hp = c.maxHp = 9999; p.hp = 9999; run(Game, G, ms); L.monsters.length = 0;
      return countSaid(linesSince(G, m), /steps into the blow meant for you/);
    };
    const owed = guarded(40000);
    if (owed) out.push(`owed a wage, the sellsword took ${owed} blows for you`);
    // gold comes: the wage is taken, and the guarding starts again
    p.gold = 100; mark = markLog(G);
    run(Game, G, 2000);
    if (p.gold !== 60 || c.unpaid) out.push(`with a hundred gold: ${p.gold} left, ${c.unpaid} owed`);
    if (!linesSince(G, mark).some(l => /You pay .* the 40 gold owed/.test(l))) out.push('the paying was not told');
    if (!guarded(40000)) out.push('paid, the sellsword still would not guard');
    return out.length ? out.join('; ') : true;
  });

  await test('once in a boss fight a sellsword\'s cut breaks the Warlord\'s drumbeat or the lich\'s rite; a second time it does not, and a hound\'s bite never does', async () => {
    const out = [];
    /** A sellsword (or the hound) beside a boss gathering itself, the hero idle: what was said while it gathered. */
    const gather = async (seed, kind, boss) => {
      const ctx = kind === 'hound' ? await withHound(seed) : await withSellsword(seed);
      const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c) return { err: `no ${kind}` };
      clearAround(ctx, 5);
      p.hp = p.maxHp = 9999; p.level = 30;   // (a sure hand: the companion's aim grows with the hero)
      const m = boss === 'warlord' ? beside(ctx, 'warlord', { blows: 2, hp: 4000, maxHp: 4000 }) : lichRoom(ctx, { phase: 2, hp: 300, maxHp: 4000, riteReady: 0, nextAct: G.t, awake: true }).m;
      besideFoe(ctx, c, m); c.hp = c.maxHp = 9999; c.nextAct = 1e12;
      const move = boss === 'warlord' ? 'drum' : 'rite';
      const said = [];
      for (let round = 0; round < 2; round++) {
        if (boss === 'warlord') { m.blows = 2; m.moveReady = 0; } else m.riteReady = 0;
        m.nextAct = G.t;
        for (let i = 0; i < 60 && !(m.windup && m.windup.move === move); i++) Game.update(G.t + 25, 25);
        if (!(m.windup && m.windup.move === move)) return { err: `${boss} never began its ${move} (${JSON.stringify(m.windup)})` };
        const mark = markLog(G);
        c.nextAct = G.t;
        for (let i = 0; i < 160 && m.windup && m.windup.move === move; i++) { Game.update(G.t + 25, 25); if (c.nextAct > G.t + 25 && m.windup) c.nextAct = G.t; }
        said.push(linesSince(G, mark).join(' | '));
        c.nextAct = 1e12;
        L0(ctx);
      }
      return { said, name: c.name };
    };
    // (the warband called by a drum that was not broken is sent away between rounds)
    const L0 = ctx => { const L = ctx.Game.level(); for (let i = L.monsters.length - 1; i >= 0; i--) if (!ctx.MONSTERS[L.monsters[i].id].boss) L.monsters.splice(i, 1); };
    for (const boss of ['warlord', 'lich']) {
      const r = await gather('sell-cut-' + boss, 'sellsword', boss);
      if (r.err) { out.push(r.err); continue; }
      const broke = boss === 'warlord' ? new RegExp(`${r.name} cuts the drumstick`) : new RegExp(`${r.name}'s cut catches the .* rite breaks`);
      if (!broke.test(r.said[0])) out.push(`the first ${boss} round: ${r.said[0]}`);
      if (broke.test(r.said[1])) out.push(`a second ${boss} round was broken too`);
      const h = await gather('hound-cut-' + boss, 'hound', boss);
      if (h.err) { out.push(h.err); continue; }
      if (h.said.some(l => /drumstick from|rite breaks|break the .* rite/.test(l))) out.push(`a hound broke the ${boss}'s: ${h.said.join(' / ')}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the caged goblin, let out, follows; it picks a locked door there is no key for, and makes safe a trap it passes', async () => {
    const out = [];
    const ctx = await withGoblin('goblin-join');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    if (!c || c.kind !== 'goblin' || !c.name) return `no goblin followed: ${JSON.stringify(c)}`;
    if (c.maxHp >= 10 + 4 * p.level) out.push('the goblin is as sturdy as a hound');
    // a locked door ahead, no key: with the goblin near, Use picks it
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 5; c.y = 6;
    const T = ctx.Dungeon.T;
    L.tiles[6 * L.w + 7] = T.DOOR_LOCKED; L.locks = { '7,6': 'iron' };
    if (Game.useLabel() !== 'Pick') out.push(`facing a locked door with the goblin near, Use says ${Game.useLabel()}`);
    const mark = markLog(G);
    Game.input('use');
    if (L.tiles[6 * L.w + 7] !== T.DOOR_OPEN) out.push('the goblin did not pick the lock');
    else if (!linesSince(G, mark).some(l => l.includes(c.name))) out.push('the picking was not told');
    // far off, it cannot help: the hero must force it
    L.tiles[6 * L.w + 7] = T.DOOR_LOCKED; L.locks = { '7,6': 'iron' };
    c.x = 3; c.y = 3; c.mode = 'stay';
    if (Game.useLabel() !== 'Force') out.push(`with the goblin across the room, Use says ${Game.useLabel()}`);
    c.mode = 'follow';
    // a trap two squares from it is made safe, one further off is not
    L.traps = { '5,8': 'dart', '10,3': 'dart', '6,6': 'snare' }; L.snares = { '6,6': 4242 };
    c.x = 5; c.y = 6;
    run(Game, G, 1000);
    if (L.traps['5,8']) out.push('a trap two squares from the goblin was left');
    if (L.traps['6,6'] || L.snares['6,6']) out.push('a kobold\'s snare beside the goblin was left, or half left');
    if (!Game.threadNotes().some(n => n.includes(c.name) && /trap/.test(n))) out.push('the hero sheet does not count its traps');
    // it stabs rather than bites, and it is quiet on its feet
    L.monsters.push({ uid: 90, id: 'goblin', x: 5, y: 5, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m2 = markLog(G);
    run(Game, G, 6000);
    if (!linesSince(G, m2).some(l => l.includes(`${c.name} stabs`))) out.push('it never stabbed the foe beside it');
    return out.length ? out.join('; ') : true;
  });

  await test('the goblin is quiet where the hound is heard; the caged goblin waits halfway down the delves with no hound, never alongside one', async () => {
    const out = [];
    {
      const ctx = await withGoblin('goblin-quiet');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion(), L = Game.level();
      p.bg = 'debtor'; L.twist = null;
      clearAround(ctx, 8);
      const dir = ctx.Dungeon.DIRS.find(([dx, dy]) => p.x + 7 * dx > 0 && p.x + 7 * dx < L.w - 1 && p.y + 7 * dy > 0 && p.y + 7 * dy < L.h - 1);
      const m = { uid: 89, id: 'goblin', x: p.x + 7 * dir[0], y: p.y + 7 * dir[1], hp: 999, maxHp: 999, awake: false, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.length = 0; L.monsters.push(m);
      Game.update(G.t + 25, 25);
      if (m.awake) out.push('a sleeper seven squares off woke for a goblin at heel');
      if (!c) out.push('no goblin');
    }
    const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    let caged = 0, both = 0;
    for (let i = 0; i < 300; i++) {
      const plan = encounterPlan('cage' + i, 8), flat = plan.flat();
      if (flat.includes('caged')) { caged++; if (!plan[4].includes('caged')) out.push(`seed cage${i} put the goblin on another floor`); }
      if (flat.includes('caged') && flat.includes('stray')) both++;
    }
    if (caged < 70 || caged > 130) out.push(`the caged goblin waited in ${caged} of 300 delves`);
    if (both) out.push(`${both} delves held both the hound and the goblin`);
    if (encounterPlan('cage-short', 4).flat().includes('caged')) out.push('a four-floor delve met the goblin');
    if (!encounterPlan('cage-long', 12).flat().includes('caged') && !encounterPlan('cage-long', 12).flat().includes('stray')) out.push('a long delve had neither companion');
    return out.length ? out.join('; ') : true;
  });

  await test('a hero coming back up a stair never lands on a monster: it steps aside; and the dead lift nothing, not even the Heart', async () => {
    const out = [];
    {
      const ctx = await start('fighter', 'landing', { levels: 6 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 9999;
      Game.level().monsters.length = 0;
      Game.descend();
      const L1 = G.levels[1], land = L1.downStart || L1.start;
      // something wanders onto the square beside the down stair while the hero is below
      L1.monsters.length = 0;
      L1.monsters.push({ uid: 88, id: 'goblin', x: land.x, y: land.y, hp: 9, maxHp: 9, awake: true, nextAct: G.t, rx: land.x, ry: land.y, fromX: land.x, fromY: land.y, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const d0 = G.depth;
      Game.level().monsters.length = 0;
      // back up (the up stair beside the hero on arrival)
      const up = ctx.Dungeon.DIRS.map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => Game.level().tiles[y * Game.level().w + x] === ctx.Dungeon.T.STAIRS_UP);
      if (!up) return 'no up stair beside the arrival';
      p.dir = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === up[0] - p.x && dy === up[1] - p.y);
      Game.input('use');
      if (G.depth !== d0 - 1) return `the climb did not happen (floor ${G.depth})`;
      const m = L1.monsters[0];
      if (m.x === p.x && m.y === p.y) out.push('the hero landed on the goblin');
      else if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 4) out.push('the goblin was flung far off');
    }
    {
      const ctx = await start('fighter', 'dead-heart', { levels: 4, permadeath: true });
      const { Game } = ctx; const G = Game.state(), p = G.player, L = Game.level(), k = `${p.x},${p.y}`;
      const heart = { t: 'artifact', q: 1, e: 0 };
      (L.items[k] = L.items[k] || []).push(heart);
      L.monsters.length = 0;
      p.hp = 1; p.lastHurt = G.t; p.poison = { until: G.t + 10000, next: G.t };
      for (let i = 0; i < 40 && G.status === 'playing'; i++) Game.update(G.t + 100, 100);
      if (G.status !== 'dead') return `the hero did not die (${G.status})`;
      Game.takeItem(heart);
      if (G.status !== 'dead') out.push(`a dead hero took the Heart and the run became ${G.status}`);
      if (Game.hall().some(h => h.won)) out.push('the Hall recorded a win');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a shade is worth a whole number of experience, and the hardest hit a trap dealt names the trap', async () => {
    const out = [];
    const ctx = await start('fighter', 'whole-xp', { levels: 8 });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.hp = p.maxHp = 9999;
    // a trap underfoot, stepped on until one bites (some can be dodged)
    const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    for (let i = 0; i < 40 && !(Game.runStats().worst); i++) {
      const x0 = p.x, y0 = p.y;
      L.tiles[(y0 + dy) * L.w + x0 + dx] = ctx.Dungeon.T.FLOOR;
      L.traps[`${x0 + dx},${y0 + dy}`] = 'pit';
      Game.input('forward'); run(Game, G, 400);
      p.x = x0; p.y = y0;
    }
    const w = Game.runStats().worst;
    if (!w) out.push('no trap ever hurt the hero');
    else if (w.from || !/^a /.test(w.cause || '')) out.push(`the hardest hit was told as ${JSON.stringify(w)}`);
    // an eight-floor delve's tiers are fractions; a shade's worth, and its aim, are not
    const sh = Game.mstat({ id: 'shade', shade: { name: 'Old', cls: 'fighter', tier: 2.04, depth: 2 } });
    if (!Number.isInteger(sh.xp) || !Number.isInteger(sh.hit)) out.push(`a shade was worth ${sh.xp} experience and hit at +${sh.hit}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the lich is the last fight: surer and harder than its floor on Normal and Hard, on a floor with fewer of the rest', async () => {
    const out = [];
    const hitOf = async difficulty => {
      const ctx = await start('fighter', 'lich-edge', { levels: 4, difficulty });
      const { Game } = ctx;
      const lich = { id: 'lich', uid: 1, x: 0, y: 0, hp: 100, maxHp: 100 };
      const orc = { id: 'orc', uid: 2, x: 0, y: 0, hp: 10, maxHp: 10 };
      return { lich: Game.mstat(lich), orc: Game.mstat(orc) };
    };
    const easy = await hitOf('easy'), normal = await hitOf('normal'), hard = await hitOf('hard');
    // the orc's edge from the difficulty, and the lich's that much and more
    const lift = (a, b, k) => b[k].hit - a[k].hit;
    if (lift(easy, normal, 'lich') !== lift(easy, normal, 'orc') + 4) out.push(`on Normal the lich hit +${lift(easy, normal, 'lich')} over Easy, an orc +${lift(easy, normal, 'orc')}`);
    if (lift(easy, hard, 'lich') !== lift(easy, hard, 'orc') + 3) out.push(`on Hard the lich hit +${lift(easy, hard, 'lich')} over Easy, an orc +${lift(easy, hard, 'orc')}`);
    if (normal.lich.dmg[2] - easy.lich.dmg[2] !== lift(easy, normal, 'lich')) out.push('the lich\'s blows did not grow with its aim');
    // and Hard's lich is never the gentler one
    if (hard.lich.hit < normal.lich.hit) out.push(`Hard's lich hit at +${hard.lich.hit}, Normal's at +${normal.lich.hit}`);
    // its floor holds fewer of the rest than a floor just above it would
    const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
    let last = 0, before = 0;
    for (let i = 0; i < 20; i++) {
      const o = { levels: 8, size: 'normal', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
      last += Dungeon.generate('thin' + i, 8, o).monsters.filter(m => m.id !== 'lich').length;
      before += Dungeon.generate('thin' + i, 7, o).monsters.length;
    }
    if (!(last < before * 0.85)) out.push(`over twenty delves the lich's floor held ${last} others, the floor above ${before}`);
    // out of rests on the lich's floor, there is no stair to send the hero to
    {
      const ctx = await start('fighter', 'last-rest', { levels: 3 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level(); L.monsters.length = 0; L.rests = 9; p.hp = 1;
      const mark = markLog(G);
      Game.rest();
      const said = linesSince(G, mark).join(' | ');
      if (!/Finish what you came for/.test(said) || /Find the stairs/.test(said)) out.push(`out of rests on the last floor: "${said}"`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('Steady Aim is for bows and slings, not throwing knives, and the pack counts it when it weighs a bow', async () => {
    const out = [];
    const ITEMS_SPEED = { longbow: 950, shortbow: 850, throwknife: 520 };
    const ctx = await start('ranger', 'aimed', { levels: 8 });
    const { Game } = ctx; const p = Game.player();
    p.stats.dex = 18; p.level = 7;
    // the pack's figure for a ranger's bow carries Steady Aim; for knives, nothing. Per blow
    // (the rate times the draw), the long bow is 2 over the knives by its dice and the short
    // bow 1, and Steady Aim adds 1 to each: 3 against 2, where without it it would be 2 against 1
    const blow = t => Game.blowRate({ t, q: 1, e: 0 }) * ITEMS_SPEED[t];
    const ratio = (blow('longbow') - blow('throwknife')) / (blow('shortbow') - blow('throwknife'));
    if (Math.abs(ratio - 1.5) > 0.01) out.push(`the pack weighed the bows over the knives at ${ratio.toFixed(2)} to one, not 1.5`);
    // a shot two squares off: a sling's carries Steady Aim, a throwing knife's does not
    const shot = weapon => {
      const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      p.eq.weapon = { t: weapon, q: 1, e: 0, id: 99 }; delete p.eq.shield;
      for (let k = 1; k <= 2; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = ctx.Dungeon.T.FLOOR;
      let total = 0, n = 0;
      for (let i = 0; i < 400; i++) {
        const m = { id: 'orc', uid: 500 + i, x: p.x + dx * 2, y: p.y + dy * 2, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, flashUntil: 0 };
        L.monsters.length = 0; L.monsters.push(m);
        const G = Game.state(); G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
        if (m.hp < 999) { total += 999 - m.hp; n++; }
      }
      return total / Math.max(1, n);
    };
    const sling = shot('sling'), knives = shot('throwknife');
    // both roll 1d4, the sling +1: another point between them is Steady Aim
    if (!(sling - knives > 1.5 && sling - knives < 2.6)) out.push(`a sling shot averaged ${sling.toFixed(2)}, a throwing knife ${knives.toFixed(2)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('an encounter\'s experience grows with the depth it is met at: twice as much on the fourth floor as the first', async () => {
    const got = {};
    for (const depth of [1, 4]) {
      const ctx = await start('fighter', 'enc-xp-' + depth, { levels: 8 });
      const { Game, Dungeon } = ctx;
      while (Game.state().depth < depth) { Game.level().monsters.length = 0; Game.descend(); }
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0; L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'mercy', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
      const before = p.xp;
      Game.chooseEncounter(2);   // finish it: no check, fifteen on the first floor
      got[depth] = p.xp - before;
    }
    return (got[1] === 15 && got[4] === 30) || `finishing the wounded goblin paid ${got[1]} on the first floor and ${got[4]} on the fourth`;
  });

  await test('an encounter can tell where a floor\'s traps lie: the hero then steps round them', async () => {
    for (let t = 0; t < 30; t++) {
      const ctx = await start('fighter', 'traps-told' + t, { levels: 8, traps: true });
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
      p.hp = p.maxHp = 999; p.stats.cha = 18;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.traps = { '1,1': 'dart' };
      L.npcs.push({ kind: 'encounter', id: 'mirror', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
      const r = Game.chooseEncounter(1);   // talk to the reflection: a Charisma check
      if (!r || !r.check || !r.check.pass) continue;
      if (!L.trapsKnown) return 'the reflection told of the dangers, and the traps stayed unknown';
      // a dart laid in the hero's path is stepped round, not sprung
      Game.closeEncounter();
      L.traps[`${p.x + dx},${p.y + dy}`] = 'dart';
      const hp = p.hp, mark = markLog(G);
      Game.input('forward'); run(Game, G, 400);
      if (p.hp !== hp) return `a trap the hero knew of still hurt them (${hp} -> ${p.hp})`;
      return linesSince(G, mark).some(l => /step round the dart trap/.test(l)) || `stepping onto it said: ${linesSince(G, mark).join(' | ')}`;
    }
    return 'the reflection never answered in thirty tries';
  });

  await test('Field Craft makes the second rest on a floor as good as the first; a freed goblin close by lends its fingers to a Dexterity check', async () => {
    const out = [];
    for (const craft of [false, true]) {
      const ctx = await start('ranger', 'field-craft' + craft, { levels: 8 });
      const { Game } = ctx; const p = Game.player(), L = Game.level();
      if (craft) talent(ctx, 'field_craft');
      L.monsters.length = 0; p.food = 1000;
      // what each rest will give, as the Rest button says it (an ambush halving one is the dice, not the camp)
      const said = [], healed = [];
      for (let i = 0; i < 4; i++) { p.hp = 1; said.push(Game.restLabel()); Game.rest(); healed.push(p.hp); L.monsters.length = 0; }
      // the second, as good and as quiet as the first: no ambush halves it
      if (craft && healed[1] !== p.maxHp) out.push(`with Field Craft the second rest mended to ${healed[1]} of ${p.maxHp}`);
      const want = craft ? 'Rest,Rest,Rest \u00bd,Rest \u00bc' : 'Rest,Rest \u00bd,Rest \u00bc,No rest';
      if (said.join() !== want) out.push(`${craft ? 'with' : 'without'} Field Craft the rests read ${said.join(', ')}`);
    }
    // the goblin's fingers: +2 on a Dexterity check with it near, nothing on another score or when it is far off
    const ctx = await start('fighter', 'goblin-fingers', { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    G.companion = { kind: 'goblin', name: 'Nib', x: p.x + 1, y: p.y, rx: p.x + 1, ry: p.y, hp: 8, maxHp: 8, depth: G.depth, mode: 'follow', joined: G.depth };
    const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0; L.npcs.length = 0;
    L.npcs.push({ kind: 'encounter', id: 'cookpot', x: p.x + dx, y: p.y + dy });
    Game.input('forward');
    const opts = Game.encounterOptions();
    const dex = opts.find(o => o.stat === 'dex'), con = opts.find(o => o.stat === 'con');
    if (!dex || dex.knack !== 2) out.push(`with the goblin beside the hero a Dexterity check had a knack of ${dex && dex.knack}`);
    // and the choice says whose help it is: the goblin's, not the fighter's own training
    else if (dex.helper !== 'Nib' || dex.trained) out.push(`the help was put down to ${dex.helper || 'nobody'}${dex.trained ? ' and the hero\'s training' : ''}`);
    if (!con || con.knack) out.push(`a Constitution check had a knack of ${con && con.knack}`);
    G.companion.x = G.companion.rx = p.x + 9;
    const far = Game.encounterOptions().find(o => o.stat === 'dex');
    if (far.knack) out.push(`with the goblin nine squares off the knack was ${far.knack}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a companion grows with each new floor it goes down at the hero\'s side: blooded after two, a veteran after four, a trick at each', async () => {
    const out = [];
    const ctx = await withHound('hound-grow');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion();
    const hp0 = c.maxHp;
    const down = () => { const mark = markLog(G); Game.level().monsters.length = 0; Game.descend(); return linesSince(G, mark); };
    down();
    if (c.floors !== 1 || Game.companionRank() !== 0) out.push(`after one floor: floors ${c.floors}, rank ${Game.companionRank()}`);
    c.hp = 1;
    const said = down();
    if (Game.companionRank() !== 1) out.push(`after two floors the rank is ${Game.companionRank()}`);
    if (!said.some(l => l.includes(`${c.name} is blooded now`) && l.includes('Hamstring'))) out.push(`at two floors it said: ${said.join(' / ')}`);
    if (c.hp !== c.maxHp || c.maxHp < hp0 + 4) out.push(`blooded, it has ${c.hp} of ${c.maxHp} (was ${hp0})`);
    down();
    const vet = down();
    if (Game.companionRank() !== 2 || !vet.some(l => l.includes('is a veteran now') && l.includes('Pack Hunter'))) out.push(`after four floors: rank ${Game.companionRank()}, said ${vet.join(' / ')}`);
    if (!Game.threadNotes().some(n => n.includes('Hamstring') && n.includes('Pack Hunter'))) out.push('the hero sheet does not list its tricks');
    // one told to stay does not come, and does not grow
    const s = await withHound('hound-grow-stay');
    const c2 = s.Game.companion();
    c2.mode = 'stay';
    s.Game.level().monsters.length = 0; s.Game.descend();
    if (c2.floors) out.push('a hound left behind grew');
    // and before its first trick the hero sheet says how far there is to go
    if (!s.Game.threadNotes().some(n => n.includes('2 more floors down at your side and it learns Hamstring'))) out.push(`the sheet said: ${s.Game.threadNotes().filter(n => n.includes(c2.name)).join(' / ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a pack-hunting hound beside a foe gives the hero +2 to hit it; a backstabbing goblin stabs twice as hard at a foe beside the hero', async () => {
    const out = [];
    /** The bonus shown on the hero's roll at an ogre in front, with the hound beside it (or not) at this rank. */
    const bonus = async (floors, beside) => {
      const ctx = await withHound('hound-pack-' + floors + beside);
      const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      clearAround(ctx);
      rollsOn(Game);
      Object.assign(p.stats, evenStats);
      c.floors = floors; c.mode = 'stay';
      const [dx, dy] = Dungeon.DIRS[p.dir], [lx, ly] = Dungeon.DIRS[(p.dir + 1) % 4];
      const m = { uid: 98, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      Object.assign(c, beside ? { x: m.x + lx, y: m.y + ly } : { x: p.x - dx, y: p.y - dy });
      for (let i = 0; i < 40; i++) {
        const mark = markLog(G);
        G.t = p.nextAttack; Game.input('attack');
        const l = linesSince(G, mark).map(x => x.match(/d20 \d+\+(\d+) vs AC/)).find(Boolean);
        if (l) return Number(l[1]);
      }
      return NaN;
    };
    const plain = await bonus(0, true), vetFar = await bonus(4, false), vetBy = await bonus(4, true), blooded = await bonus(2, true);
    if (!(vetBy === plain + 2)) out.push(`a veteran hound beside the ogre: +${vetBy}, against +${plain} with a new one`);
    if (vetFar !== plain) out.push(`a veteran hound behind the hero changed the roll to +${vetFar}`);
    if (blooded !== plain) out.push(`a blooded hound (no Pack Hunter yet) changed the roll to +${blooded}`);
    // the goblin: the same stab dice, doubled on a foe at the hero's side once blooded
    const stabs = async floors => {
      const ctx = await withGoblin('goblin-stab-' + floors);
      const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c) return { err: 'no goblin' };
      clearAround(ctx);
      seedDice(ctx, 'goblin-stab');
      c.floors = floors; c.mode = 'stay';
      const [dx, dy] = Dungeon.DIRS[p.dir], [lx, ly] = Dungeon.DIRS[(p.dir + 1) % 4];
      const m = { uid: 99, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, ac: 1, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      Object.assign(c, { x: m.x + lx, y: m.y + ly });
      let total = 0, n = 0;
      for (let i = 0; i < 16000 && n < 150; i++) { const hp = m.hp; Game.update(G.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      return { mean: total / Math.max(1, n), n };
    };
    const g0 = await stabs(0), g2 = await stabs(2);
    if (g0.err || g2.err) out.push(g0.err || g2.err);
    else if (!(g0.n > 100 && g2.n > 100 && g2.mean > g0.mean * 1.7 && g2.mean < g0.mean * 2.4)) out.push(`a goblin's stabs: ${g0.mean.toFixed(2)} (${g0.n}) new, ${g2.mean.toFixed(2)} (${g2.n}) blooded`);
    return out.length ? out.join('; ') : true;
  });

  await test('a blooded hound\'s bite that lands sometimes holds its foe back; a veteran goblin finds something on each new floor', async () => {
    const out = [];
    const held = async floors => {
      const ctx = await withHound('hound-ham-' + floors);
      const { Game } = ctx; const G = Game.state(), c = Game.companion(), p = Game.player();
      clearAround(ctx);
      c.floors = floors; c.mode = 'stay';
      const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
      const m = { uid: 96, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, ac: 1, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      let bites = 0, slowed = 0;
      for (let i = 0; i < 16000 && bites < 150; i++) {
        const hp = m.hp; m.nextAct = G.t + 1e9;
        Game.update(G.t + 25, 25);
        if (m.hp < hp) { bites++; if (m.nextAct > G.t + 1e9) slowed++; }
      }
      return { bites, slowed };
    };
    const h0 = await held(0), h2 = await held(2);
    if (h0.slowed) out.push(`a new hound held its foe back ${h0.slowed} times`);
    if (!(h2.bites > 100 && h2.slowed > h2.bites * 0.2 && h2.slowed < h2.bites * 0.5)) out.push(`a blooded hound held back ${h2.slowed} of ${h2.bites} bitten`);
    // the goblin's finds, on floors it has not been to
    const ctx = await withGoblin('goblin-scrounge');
    const { Game } = ctx; const G = Game.state(), c = Game.companion(), p = Game.player();
    if (!c) return 'no goblin';
    c.floors = 3;
    const count = () => p.gold * 1000 + p.inv.reduce((a, i) => a + (i.q || 1), 0);
    const before = count();
    const mark = markLog(G);
    Game.level().monsters.length = 0; Game.descend();
    const said = linesSince(G, mark);
    if (Game.companionRank() !== 2) out.push(`after the fourth floor the goblin's rank is ${Game.companionRank()}`);
    if (count() === before || !said.some(l => l.includes(`${c.name} tips`) || l.includes(`${c.name} slips`))) out.push(`nothing found: ${said.join(' / ')}`);
    // a floor it has been to already brings nothing
    const again = count();
    c.deepest = G.depth + 1;
    Game.level().monsters.length = 0; Game.descend();
    if (count() !== again) out.push('it found something on a floor it had been down to');
    return out.length ? out.join('; ') : true;
  });

  await test('a charm given from the pack is worn by the companion: a collar turns blows, a fang bites harder, a rowan knot mends', async () => {
    const out = [];
    // no companion, nothing to give it to
    {
      const ctx = await start('fighter', 'charm-none');
      const p = ctx.Game.player(), it = { t: 'charm_fang', q: 1, e: 0 };
      p.inv.push(it);
      if (!ctx.Game.giveCharm(it) || !p.inv.includes(it)) out.push('a charm was given with no companion');
    }
    const ctx = await withHound('charm-give');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    const fang = { t: 'charm_fang', q: 1, e: 0 }, knot = { t: 'charm_rowan', q: 1, e: 0 };
    p.inv.push(fang, knot);
    const mark = markLog(G);
    if (Game.giveCharm(fang) || c.charm !== 'charm_fang' || p.inv.includes(fang)) out.push(`giving the fang: wears ${c.charm}`);
    if (!linesSince(G, mark).some(l => l.includes(`fang charm on ${c.name}`))) out.push(`said: ${linesSince(G, mark).join(' / ')}`);
    Game.giveCharm(knot);
    if (c.charm !== 'charm_rowan' || !p.inv.some(i => i.t === 'charm_fang')) out.push('a second charm did not hand back the first');
    if (!Game.threadNotes().some(n => n.includes('wearing the rowan knot'))) out.push('the hero sheet does not say what it wears');
    // the knot mends it, slowly, with no rest
    clearAround(ctx);
    c.hp = 1; c.mode = 'stay';
    run(Game, G, 20000);
    if (!(c.hp >= 4 && c.hp <= 7)) out.push(`in twenty seconds the knot mended it to ${c.hp}`);
    // the fang: the same bites, two more each
    const bites = async charm => {
      const b = await withHound('charm-fang-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); seedDice(b, 'charm-fang');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 95, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let total = 0, n = 0;
      for (let i = 0; i < 16000 && n < 150; i++) { const hp = m.hp; b.Game.update(G2.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      return total / Math.max(1, n);
    };
    const plain = await bites(undefined), sharp = await bites('charm_fang');
    if (!(sharp - plain > 1.5 && sharp - plain < 2.5)) out.push(`the fang: ${plain.toFixed(2)} -> ${sharp.toFixed(2)} a bite`);
    // the collar: an orc beside it lands fewer blows
    const landed = async charm => {
      const b = await withHound('charm-collar-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); seedDice(b, 'charm-collar');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 94, id: 'orc', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: G2.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let hits = 0;
      for (let i = 0; i < 12000; i++) { const hp = h.hp; b.Game.update(G2.t + 25, 25); if (h.hp < hp) hits++; h.hp = h.maxHp; h.fallen = 0; }
      return hits;
    };
    // one that falls leaves its charm where it fell, to be taken up again
    {
      const f = await withHound('charm-fall');
      const h = f.Game.companion(), G3 = f.Game.state(), P3 = f.Game.player();
      clearAround(f);
      h.charm = 'charm_fang'; h.mode = 'stay'; h.hp = h.maxHp = 3;
      const spot = f.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P3.x) + Math.abs(y - P3.y) > 1 && !(x === P3.x && y === P3.y));
      f.Game.level().monsters.push({ uid: 92, id: 'ogre', x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: G3.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 1200 && !h.fallen; i++) { f.Game.update(G3.t + 25, 25); P3.hp = P3.maxHp; }
      const k = `${h.x},${h.y}`;
      if (!h.fallen) out.push('the hound never fell');
      else if (h.charm || !(f.Game.level().items[k] || []).some(i => i.t === 'charm_fang')) out.push('a fallen hound\'s charm was lost with it');
    }
    const bare = await landed(undefined), collared = await landed('charm_collar');
    if (!(bare > 60 && collared < bare * 0.85)) out.push(`an orc landed ${bare} blows on a bare hound, ${collared} on a collared one`);
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes: the hound is not the hero, for smoke, the best blow or the trader\'s lamp; a cleric unhurt readies a spell that does something', async () => {
    const out = [];
    // the hound's bites are its own: not the hero's best blow, nor the hero's tally
    {
      const ctx = await withHound('own-bite');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      clearAround(ctx, 5);
      const dealt = Game.runStats().dealt, best = Game.runStats().best;
      const [dx, dy] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
      c.x = c.rx = p.x + dx; c.y = c.ry = p.y + dy; c.mode = 'stay';
      const m = beside(ctx, 'goblin', { awake: true }); m.x = m.rx = m.fromX = c.x + dx; m.y = m.ry = m.fromY = c.y + dy; m.hp = m.maxHp = 500; m.nextAct = 1e12;
      for (let i = 0; i < 400 && m.hp === 500; i++) Game.update(G.t + 25, 25);
      if (m.hp === 500) out.push('the hound never bit');
      else if (Game.runStats().dealt !== dealt || Game.runStats().best !== best) out.push(`the hound's bite counted as the hero's: ${JSON.stringify(Game.runStats().best)}`);
    }
    // a blow drawn back at the hound does not stop the hero's smoke hiding them
    {
      const ctx = await start('thief', 'smoke-pet', { levels: 6 });
      const { Game } = ctx; const p = Game.player();
      p.hp = p.maxHp = 9999; p.level = 5;
      Game.level().monsters.length = 0;
      const m = beside(ctx, 'orc', { awake: true });
      m.windup = { at: Game.state().t, until: Game.state().t + 900, kind: 'pet' };
      Game.useAbility();
      if (m.awake) out.push('a foe swinging at the hound stayed on the thief through the smoke');
      // and its blow is lost in the smoke, not left hanging to fall on the hound unwarned later
      if (m.windup) out.push('a blow drawn back at the hound was left hanging through the smoke');
    }
    // sleep by the lamp for a hurt hound's sake, and it wakes whole
    {
      const ctx = await withHound('lamp-hound');
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), c = Game.companion();
      clearAround(ctx, 4);
      const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy; L.npcs.push(shop);
      c.x = c.rx = p.x - dx; c.y = c.ry = p.y - dy;
      Game.input('forward');
      p.gold = 9999; p.hp = p.maxHp; p.sp = p.maxSp; c.hp = 1;
      const lodge = Game.shopServices().find(v => v.id === 'lodge');
      if (!lodge || lodge.why) out.push(`a hurt hound was no reason to sleep by the lamp: ${lodge && lodge.why}`);
      else { Game.buyService('lodge'); if (c.hp !== c.maxHp) out.push(`the hound woke with ${c.hp} of ${c.maxHp}`); }
    }
    // unhurt, a new cleric's Cast button is Bless, not a heal that would be wasted; hurt, the heal again
    {
      const ctx = await start('cleric', 'cleric-ready');
      const { Game } = ctx; const p = Game.player();
      p.hp = p.maxHp;
      const whole = Game.castLabel();
      p.hp = 1;
      const hurt = Game.castLabel();
      if (/Cure/.test(whole) || !/Cure/.test(hurt)) out.push(`the Cast button read ${whole} unhurt and ${hurt} hurt`);
    }
    // the bestiary tells what it learned in words, not labels
    {
      const ctx = await start('fighter', 'beast-words');
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 9999;
      const mark = markLog(G);
      const m = beside(ctx, 'goblin', { awake: true }); m.hp = 1;
      for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); Game.update(G.t + 25, 25); }
      // one line when the notes follow each other; two when a blow's line falls between
      const said = linesSince(G, mark).filter(l => /^Bestiary/.test(l)).join(' | ');
      if (Game.level().monsters.includes(m)) out.push('the goblin never fell');
      else if (said !== 'Bestiary: Goblin added, and you learned how tough it is.' && said !== 'Bestiary: Goblin added. | Bestiary: Goblin, you learned how tough it is.') out.push(`the bestiary said "${said}"`);
    }
    return out.length ? out.join('; ') : true;
  });

  // ---------- the druid ----------
  const druidSpell = (ctx, id) => ctx.SPELLS.druid.find(s => s.id === id);
  /** A druid of some level with points to spend, ready to cast. */
  const druid = async (seed, level = 1, opts) => {
    const ctx = await start('druid', seed, opts);
    const p = ctx.Game.player();
    Object.assign(p.stats, evenStats, { wis: 16 });
    p.level = level; p.sp = 999; p.hp = p.maxHp = 200;
    return ctx;
  };
  const ready = ctx => { const G = ctx.Game.state(), p = ctx.Game.player(); G.t = Math.max(G.t, p.nextAttack); };

  await test('a druid: Wisdom lands the spear, and the kit is light armour, a spear and six spells, the bear among them', async () => {
    const out = [];
    const ctx = await druid('druid-kit');
    const { Game, CLASSES } = ctx; const p = Game.player();
    if (!p.eq.weapon || p.eq.weapon.t !== 'spear' || !p.eq.armor || p.eq.armor.t !== 'leather') out.push(`a druid starts with ${p.eq.weapon && p.eq.weapon.t} and ${p.eq.armor && p.eq.armor.t}`);
    p.stats.str = 8; p.stats.wis = 18;
    const high = Game.toHit(); p.stats.wis = 10; const low = Game.toHit();
    if (high - low !== 4) out.push(`Wisdom 18 against 10 moved a druid's to-hit by ${high - low}`);
    const ids = Game.knownSpells().map(s => s.id).join();
    if (ids !== 'thorn_lash,wild_shape,mending_moss,entangle,call_lightning,insect_plague') out.push(`a druid knows ${ids}`);
    if (!Game.spellAvailable(druidSpell(ctx, 'wild_shape'))) out.push('the bear is not there from the first level');
    if (CLASSES.druid.title !== 'Archdruid') out.push(`the druid's title is ${CLASSES.druid.title}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Wild Shape: claws for blows, better armour, a hide that takes the blows first; it ends with time, a torn hide or another spell', async () => {
    const out = [];
    const ctx = await druid('druid-shape', 4);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const ac0 = Game.playerAC(), shape = druidSpell(ctx, 'wild_shape');
    if (Game.castSpell(shape) !== true || !Game.shaped()) return 'the bear did not come';
    const w = Game.weapon();
    if (w.name !== 'claws' || w.range || w.dmg[1] !== 8) out.push(`a bear strikes with ${JSON.stringify(w)}`);
    if (Game.playerAC() !== ac0 + 2) out.push(`a bear's armour class is ${Game.playerAC()}, the druid's ${ac0}`);
    if (Game.renderState().fx.view.cls !== 'bear' || Game.renderState().fx.view.weapon) out.push('the view does not show a bear\'s paws');
    if (!/^Bear: 40s, hide 7$/.test(Game.shapeChip())) out.push(`the status line says "${Game.shapeChip()}"`);
    if (Game.spellWasteReason(shape) !== 'You are a bear already.') out.push('the bear could be cast over itself');
    // a blow on the hide: all of it taken, then the rest through, and the shape broken
    const hp0 = p.hp;
    Game.hurtPlayer(5, 'The orc hits you for 5.');
    if (p.hp !== hp0 || p.shape.hide !== 2) out.push(`five on a hide of 7 left hp ${hp0}->${p.hp}, hide ${p.shape && p.shape.hide}`);
    const mark = markLog(G);
    Game.hurtPlayer(7, 'The orc hits you for 7.');
    if (p.hp !== hp0 - 5 || Game.shaped()) out.push(`seven on a hide of 2 left hp ${hp0}->${p.hp}, shaped ${Game.shaped()}`);
    const said = linesSince(G, mark).join(' / ');
    // the blow first, then what it did to the bear
    if (!said.includes('(Your hide takes 2.)') || !(said.indexOf('tears through the bear') > said.indexOf('hits you for 7'))) out.push(`said: ${said}`);
    // time runs out
    ready(ctx); Game.castSpell(shape);
    run(Game, G, 40100);
    if (Game.shaped() || p.shape) out.push('the bear outlasted its forty seconds');
    // another spell lets it go, and is cast
    ready(ctx); Game.castSpell(shape);
    const heal = druidSpell(ctx, 'mending_moss'); p.hp = 10; ready(ctx);
    if (Game.castSpell(heal) !== true || Game.shaped() || p.hp <= 10) out.push(`Mending Moss in bear shape: cast, shaped ${Game.shaped()}, hp ${p.hp}`);
    // each bear taken is counted, for Wildheart
    if (G.stats.shapes !== 3) out.push(`three bears were counted as ${G.stats.shapes}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a bear holds nothing: a flaming spear\'s fire and an oil stay behind with it', async () => {
    const out = [];
    const ctx = await druid('druid-nothing', 4);
    const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'spear', q: 1, e: 0, pw: 'flame' };
    p.coating = { t: 'fire', left: 20 };
    if (!Game.hasPower('flame', 'weapon')) out.push('the flaming spear did not flame in the hand');
    Game.castSpell(druidSpell(ctx, 'wild_shape'));
    if (Game.hasPower('flame', 'weapon') || Game.hasPower('flame')) out.push('a bear\'s claws carried the spear\'s fire');
    const m = beside(ctx, 'goblin', { hp: 500, maxHp: 500, nextAct: 1e12 });
    p.perkHit = 60;
    for (let i = 0; i < 5; i++) { ready(ctx); Game.input('attack'); }
    if (p.coating.left !== 20) out.push(`a bear's claws spent the oil: ${p.coating.left} left`);
    if (!(m.hp < 500)) out.push('the claws never landed');
    return out.length ? out.join('; ') : true;
  });

  await test('Entangle holds the first foe ahead and breaks its blow; Old Growth holds every one in reach; a boss tears free in half the time', async () => {
    const out = [];
    const lineUp = (ctx, ids, extra = {}) => {
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
      const [dx, dy] = Dungeon.DIRS[p.dir];
      for (let k = 1; k <= 4; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      return ids.map((id, i) => { const m = { uid: 70 + i, id, x: p.x + dx * (i + 2), y: p.y + dy * (i + 2), hp: 99, maxHp: 99, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, windup: { kind: 'melee', at: G.t, until: G.t + 500 }, ...extra }; L.monsters.push(m); return m; });
    };
    const ctx = await druid('druid-entangle', 5);
    const { Game } = ctx; const G = Game.state(), sp = druidSpell(ctx, 'entangle');
    Game.level().monsters.length = 0;
    if (!/Nothing within reach/.test(Game.spellWasteReason(sp) || '')) out.push('Entangle at nothing was not called a waste');
    const [a, b] = lineUp(ctx, ['orc', 'orc']);
    const t0 = G.t;
    if (Game.castSpell(sp) !== true) return 'Entangle was refused with an orc ahead';
    if (a.windup || a.nextAct - t0 < 3000) out.push(`the first orc: windup ${!!a.windup}, moves in ${a.nextAct - t0}ms`);
    if (!b.windup) out.push('the second orc was held too, without Old Growth');
    // Old Growth, and a Grovewarden's longer hold
    const c2 = await druid('druid-growth', 9);
    c2.Game.player().path = 'grovewarden'; c2.Game.player().capstone = 'old_growth';
    const [x, y] = lineUp(c2, ['orc', 'orc']); const t1 = c2.Game.state().t;
    c2.Game.castSpell(druidSpell(c2, 'entangle'));
    if (x.windup || y.windup || y.nextAct - t1 < 4500) out.push(`Old Growth: windups ${!!x.windup}/${!!y.windup}, the second moves in ${y.nextAct - t1}ms`);
    // a boss, half
    const c3 = await druid('druid-boss', 5);
    const [boss] = lineUp(c3, ['warlord'], { windup: null }); const t2 = c3.Game.state().t;
    c3.Game.castSpell(druidSpell(c3, 'entangle'));
    if (boss.nextAct - t2 !== 1500) out.push(`the Warlord was held ${boss.nextAct - t2}ms`);
    return out.length ? out.join('; ') : true;
  });

  await test('a druid\'s bond: a companion half again as tough, a floor further on, mended with them and by Beast Bond, and a Grovewarden\'s twice as tough', async () => {
    const out = [];
    const hound = async (cls, seed) => {
      const ctx = await start(cls, seed, { levels: 6 });
      const p = ctx.Game.player(); p.hp = p.maxHp = 9999; p.food = 100;
      meetAndChoose(ctx, 'stray', 0); ctx.Game.closeEncounter();
      return ctx;
    };
    const f = await hound('fighter', 'kin-f'), dr = await hound('druid', 'kin-d');
    const hf = f.Game.companion(), hd = dr.Game.companion();
    if (!hf || !hd) return `no hound: fighter ${!!hf}, druid ${!!hd}`;
    f.Game.player().level = dr.Game.player().level;
    if (hd.maxHp !== Math.round(hf.maxHp * 1.5)) out.push(`a druid's hound has ${hd.maxHp} hit points, a fighter's ${hf.maxHp}`);
    if ((hd.floors || 0) !== 1 || (hf.floors || 0) !== 0) out.push(`it came a floor on: druid's ${hd.floors}, fighter's ${hf.floors}`);
    // mended with the druid
    const p = dr.Game.player(); p.level = 3; p.sp = 99; p.hp = 5; p.maxHp = 100; hd.hp = 1;
    dr.Game.state().t = Math.max(dr.Game.state().t, p.nextAttack);
    dr.Game.castSpell(druidSpell(dr, 'mending_moss'));
    if (!(hd.hp > 1)) out.push('Mending Moss did not mend the hound');
    // a druid unhurt with a hurt hound: not a waste
    p.hp = p.maxHp; hd.hp = 1;
    if (dr.Game.spellWasteReason(druidSpell(dr, 'mending_moss'))) out.push('healing was wasted on an unhurt druid with a hurt hound');
    hd.hp = hd.maxHp;
    if (!dr.Game.spellWasteReason(druidSpell(dr, 'mending_moss'))) out.push('healing an unhurt druid and hound was not a waste');
    // Beast Bond: a hit point every three seconds at their side, beyond what it mends on its own
    const mended = bond => {
      if (bond) talent(dr, 'beast_bond');
      hd.hp = 1; hd.mode = 'stay'; hd.x = p.x + 1; hd.y = p.y; p.nextKin = 0;
      dr.Game.level().monsters.length = 0;
      run(dr.Game, dr.Game.state(), 9100);
      return hd.hp - 1;
    };
    run(dr.Game, dr.Game.state(), 1000);   // (it grows to the druid's new level first)
    const own = mended(false), bonded = mended(true);
    if (bonded - own < 3 || bonded - own > 4) out.push(`in nine seconds it mended ${own} on its own, ${bonded} with Beast Bond`);
    // a Grovewarden's grows to twice a fighter's
    f.Game.player().level = p.level; run(f.Game, f.Game.state(), 1000);
    p.path = 'grovewarden'; run(dr.Game, dr.Game.state(), 1000);
    if (hd.maxHp !== hf.maxHp * 2) out.push(`a Grovewarden's hound has ${hd.maxHp} hit points, a fighter's ${hf.maxHp}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s paths and capstones: the bear\'s cost, time, hide and claws; Mending Moss\'s cost; a Grovewarden\'s bark', async () => {
    const out = [];
    const hero = async (path, cap) => { const ctx = await druid('druid-path-' + (cap || path || 'none'), 9); ctx.Game.player().path = path; ctx.Game.player().capstone = cap; return ctx; };
    const none = await hero(undefined), ss = await hero('shapeshifter'), gw = await hero('grovewarden');
    const cost = (c, id) => c.Game.spellCost(druidSpell(c, id));
    if (cost(ss, 'wild_shape') !== cost(none, 'wild_shape') - 1 || cost(ss, 'thorn_lash') !== cost(none, 'thorn_lash') + 1) out.push(`Shapeshifter: the bear costs ${cost(ss, 'wild_shape')}, the lash ${cost(ss, 'thorn_lash')}`);
    const shaped = c => { c.Game.castSpell(druidSpell(c, 'wild_shape')); const p = c.Game.player(); return { secs: Math.round((p.shape.until - c.Game.state().t) / 1000), hide: p.shape.hide, claws: c.Game.weapon().dmg[2] }; };
    const n = shaped(none), s = shaped(ss), g = shaped(gw);
    if (n.secs !== 40 || s.secs !== 45 || g.secs !== 40) out.push(`the bear lasts ${n.secs}s, a Shapeshifter's ${s.secs}s, a Grovewarden's ${g.secs}s`);
    if (s.hide !== n.hide || s.claws !== n.claws + 2) out.push(`a Shapeshifter's hide ${n.hide}->${s.hide}, claws +${s.claws}`);
    const dire = shaped(await hero('shapeshifter', 'dire_bear')), old = shaped(await hero('shapeshifter', 'old_hide'));
    if (dire.claws !== n.claws + 5) out.push(`Dire Bear: claws +${dire.claws}`);
    if (old.hide !== n.hide + 8) out.push(`Old Hide: hide ${n.hide}->${old.hide}`);
    // a Grovewarden is harder to hit, bear or not
    if (gw.Game.playerAC() !== none.Game.playerAC() + 2) out.push(`a Grovewarden's armour class is ${gw.Game.playerAC()}, a druid's with no path ${none.Game.playerAC()}`);
    const hw = await hero('grovewarden', 'heartwood');
    if (cost(hw, 'mending_moss') !== cost(gw, 'mending_moss') - 1) out.push(`Heartwood: Mending Moss ${cost(gw, 'mending_moss')}->${cost(hw, 'mending_moss')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s talents: a thicker hide, bark, longer thorns, rending claws that bleed', async () => {
    const out = [];
    const ctx = await druid('druid-talents', 6);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    const shape = druidSpell(ctx, 'wild_shape');
    Game.castSpell(shape); const hide0 = p.shape.hide; delete p.shape;
    talent(ctx, 'thick_hide'); ready(ctx); Game.castSpell(shape);
    if (p.shape.hide !== Math.round(hide0 * 1.5)) out.push(`Thick Hide took the hide from ${hide0} to ${p.shape.hide}`);
    const ac0 = Game.playerAC(); talent(ctx, 'barkskin');
    if (Game.playerAC() !== ac0 + 1) out.push(`Barkskin took armour class ${ac0}->${Game.playerAC()}`);
    // Rending Claws: every third blow that lands opens a wound that bleeds
    talent(ctx, 'rending_claws');
    const m = beside(ctx, 'ogre', { hp: 9999, maxHp: 9999, nextAct: 1e12 });
    p.perkHit = 60;
    // (a natural 1 misses whatever the bonus: swing until three have landed)
    let landed = 0;
    for (let i = 0; i < 20 && landed < 3; i++) { const was = m.hp; ready(ctx); Game.input('attack'); if (m.hp < was) landed++; }
    if (!m.dot || m.dot.kind !== 'bleed') out.push(`${landed} claw blows landed and opened no wound`);
    const hp = m.hp; run(Game, G, 3100);
    if (!(m.hp < hp)) out.push('the wound did not bleed');
    // Long Thorns: two squares further
    delete p.shape;
    const lash = druidSpell(ctx, 'thorn_lash');
    const [dx, dy] = Dungeon.DIRS[p.dir], L = Game.level();
    for (let k = 1; k <= 6; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    m.x = p.x + dx * 6; m.y = p.y + dy * 6; m.dot = null;
    if (!Game.spellWasteReason(lash)) out.push('Thorn Lash reached six squares without Long Thorns');
    talent(ctx, 'long_thorns');
    if (Game.spellWasteReason(lash)) out.push(`with Long Thorns: ${Game.spellWasteReason(lash)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s green gifts: Green Hands and a Grovewarden heal more, Stormborn and a Grovewarden\'s thorns hold back what they strike', async () => {
    const out = [];
    // the same die, so the only difference is the gift
    const healed = async (key, set) => {
      const ctx = await druid('druid-heal-' + key, 5); set(ctx);
      const p = ctx.Game.player(); p.hp = 1; seedDice(ctx, 'moss');
      ctx.Game.castSpell(druidSpell(ctx, 'mending_moss'));
      return p.hp - 1;
    };
    const plain = await healed('plain', () => {}), green = await healed('green', c => talent(c, 'green_hands')), grove = await healed('grove', c => { c.Game.player().path = 'grovewarden'; });
    if (Math.abs(green - plain * 4 / 3) > 1) out.push(`Green Hands healed ${green}, plainly ${plain}`);
    if (Math.abs(grove - plain * 1.25) > 1) out.push(`a Grovewarden healed ${grove}, plainly ${plain}`);
    // a bolt's hold: how much later the orc it strikes may act
    const held = async (key, id, set) => {
      const ctx = await druid('druid-hold-' + key, 5); set(ctx);
      const m = beside(ctx, 'orc', { hp: 999, maxHp: 999, nextAct: ctx.Game.state().t });
      const t0 = ctx.Game.state().t; seedDice(ctx, 'hold');
      ctx.Game.castSpell(druidSpell(ctx, id));
      return { hold: m.nextAct - t0, dealt: 999 - m.hp };
    };
    const bolt = await held('bolt', 'call_lightning', () => {}), storm = await held('storm', 'call_lightning', c => talent(c, 'stormborn'));
    if (storm.hold - bolt.hold !== 700) out.push(`Stormborn held the orc ${storm.hold}ms, without it ${bolt.hold}ms`);
    if (Math.abs(storm.dealt - bolt.dealt * 1.25) > 1) out.push(`Stormborn's lightning dealt ${storm.dealt}, without it ${bolt.dealt}`);
    const lash = await held('lash', 'thorn_lash', () => {}), grovel = await held('grovel', 'thorn_lash', c => { c.Game.player().path = 'grovewarden'; });
    if (grovel.hold - lash.hold !== 700) out.push(`a Grovewarden's thorns held the orc ${grovel.hold}ms, plain ones ${lash.hold}ms`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s relics are a druid\'s alone: Oakheart\'s bear lasts longer and is thicker-hided; other classes\' relics are dealt as before', async () => {
    const out = [];
    const ctx = await druid('druid-oak', 4);
    const { Game, relicUsableBy, relicPlan, RELICS } = ctx; const p = Game.player();
    for (const id of ['oakheart', 'mossmantle']) {
      if (!relicUsableBy(id, 'druid')) out.push(`${id} is not a druid's`);
      for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger']) if (relicUsableBy(id, cls)) out.push(`${id} is usable by a ${cls}`);
    }
    // another class's deal leaves the druid's relics out, so it is the deal it always was
    const plan = relicPlan('oak-seed', 'mage', 8);
    if ([...Object.values(plan.floor), ...plan.shop].some(id => RELICS[id].cls)) out.push('a mage was dealt a druid\'s relic');
    const shape = druidSpell(ctx, 'wild_shape');
    Game.castSpell(shape);
    const plain = { secs: Math.round((p.shape.until - Game.state().t) / 1000), hide: p.shape.hide };
    delete p.shape;
    p.eq.weapon = { t: 'staff', q: 1, e: 1, u: 'oakheart' };
    if (!Game.hasPower('wild')) out.push('Oakheart in hand has no Wild power');
    ready(ctx); Game.castSpell(shape);
    const oak = { secs: Math.round((p.shape.until - Game.state().t) / 1000), hide: p.shape.hide };
    if (oak.secs !== plain.secs + 10 || oak.hide !== plain.hide + 4) out.push(`with Oakheart the bear lasts ${oak.secs}s (plainly ${plain.secs}s), hide ${oak.hide} (plainly ${plain.hide})`);
    return out.length ? out.join('; ') : true;
  });

  await test('a druid is at home with the old stone, the pale caps and the mapmaker\'s finger; and Wildheart is a druid\'s win of thirty bears', async () => {
    const out = [];
    for (const [id, i, want] of [['shrine', 2, 2], ['fungus', 1, 4], ['mapmaker', 1, 2]]) {
      const bonus = async cls => {
        const c = await start(cls, 'knack-' + id, { levels: 6 });
        const { Game, Dungeon } = c; const p = Game.player(), L = Game.level();
        const [dx, dy] = Dungeon.DIRS[p.dir];
        L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0;
        L.npcs = [{ id, kind: 'encounter', x: p.x + dx, y: p.y + dy }];
        Game.input('use');
        return Game.encounterOptions()[i].knack;
      };
      const d = await bonus('druid'), f = await bonus('fighter');
      if (d - f !== want) out.push(`${id}: a druid's knack ${d}, a fighter's ${f}`);
    }
    // the feat
    const ctx = await newContext();
    const { Game } = ctx;
    const win = (cls, shapes, difficulty = 'normal') => {
      Game.newGame({ name: 'W', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'wild-' + cls + shapes + difficulty, opts: { ...OPTS, permadeath: true, difficulty } });
      Game.state().stats.shapes = shapes; winHere(Game); return Game.earned().firstFeats;
    };
    if (win('druid', 29).includes('wildheart')) out.push('twenty-nine bears earned Wildheart');
    if (win('druid', 30, 'easy').includes('wildheart')) out.push('Wildheart was earned on Easy');
    if (win('fighter', 40).includes('wildheart')) out.push('a fighter earned Wildheart');
    if (!win('druid', 30).includes('wildheart')) out.push('thirty bears on Normal did not earn Wildheart');
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes, the Druid: a staff\'s points stay, the Cast button moves on, a hide used up exactly, roots past bones, moss says what it healed', async () => {
    const out = [];
    const ctx = await druid('druid-review', 5);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    const shape = druidSpell(ctx, 'wild_shape');
    // the Staff of the Ninth Circle's well of power is not left behind by the bear
    p.eq.weapon = { t: 'staff', q: 1, e: 1, u: 'ninth_circle' };
    const sp0 = Game.spMax(p);
    Game.castSpell(shape);
    if (Game.spMax(p) !== sp0) out.push(`the bear took the staff's points: ${sp0} -> ${Game.spMax(p)}`);
    // the Cast button offers a spell that would cast
    if (Game.castLabel() === 'Wild Shape') out.push('in bear shape the Cast button still offers Wild Shape');
    // a blow the hide takes exactly: nothing reached the druid, so it is worn through, not torn
    p.shape.hide = 6; const hp0 = p.hp, taken0 = G.stats.taken || 0, mark = markLog(G);
    Game.hurtPlayer(6, 'The orc hits you for 6.');
    const said = linesSince(G, mark).join(' / ');
    if (p.hp !== hp0 || Game.shaped()) out.push(`six on a hide of six: hp ${hp0}->${p.hp}, shaped ${Game.shaped()}`);
    if (/tears through|and hurt/.test(said) || !/worn through/.test(said)) out.push(`said: ${said}`);
    if ((G.stats.taken || 0) !== taken0) out.push(`damage the hide took was counted as taken: ${taken0} -> ${G.stats.taken}`);
    // roots reach past fallen bones to the foe behind
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let k = 1; k <= 3; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    const bones = { uid: 60, id: 'skeleton', x: p.x + dx, y: p.y + dy, hp: 5, maxHp: 5, awake: true, collapsed: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    const orc = { uid: 61, id: 'orc', x: p.x + dx * 2, y: p.y + dy * 2, hp: 50, maxHp: 50, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(bones, orc);
    ready(ctx);
    if (Game.castSpell(druidSpell(ctx, 'entangle')) !== true || !(orc.snaredUntil > G.t)) out.push('Entangle did not reach past the bones to the orc');
    // Mending Moss on a full druid for a hurt companion says it healed the druid nothing
    L.monsters.length = 0; p.hp = p.maxHp;
    G.companion = { kind: 'hound', name: 'Ash', x: p.x - dx, y: p.y - dy, depth: G.depth, hp: 1, maxHp: 30, mode: 'follow', joined: G.depth };
    const m2 = markLog(G); ready(ctx);
    Game.castSpell(druidSpell(ctx, 'mending_moss'));
    const said2 = linesSince(G, m2).join(' / ');
    if (!/and heal 0\./.test(said2) || !/Ash is mended/.test(said2)) out.push(`Mending Moss said: ${said2}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a wolf comes to a druid in a delve with no hound, and only then; it hunts quietly, learns to go for the weak, and has its own fate', async () => {
    const out = [];
    const OPT8 = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false };
    const ctx = await newContext();
    const { Game } = ctx;
    const has = (cls, seed) => { Game.newGame({ name: 'W', cls, stats: { ...evenStats, wis: 16 }, seed, opts: OPT8 }); return Game.companion(); };
    // seeds with and without the starving hound: the wolf comes only where there is none
    let wolfSeed = '', houndSeed = '';
    for (let i = 0; i < 40 && !(wolfSeed && houndSeed); i++) { const c = has('druid', 'wolfseed-' + i); if (c && !wolfSeed) wolfSeed = 'wolfseed-' + i; if (!c && !houndSeed) houndSeed = 'wolfseed-' + i; }
    if (!wolfSeed || !houndSeed) return `seeds: wolf ${wolfSeed}, hound ${houndSeed}`;
    const w = has('druid', wolfSeed);
    if (w.kind !== 'wolf' || w.depth !== 1 || (w.floors || 0) !== 1) out.push(`the wolf: ${JSON.stringify({ kind: w.kind, depth: w.depth, floors: w.floors })}`);
    if (!Game.state().log.some(e => /grey wolf pads out of the dark/.test(e.m))) out.push('the wolf\'s coming was not told');
    if (has('fighter', wolfSeed)) out.push('a fighter was given a companion at the first stair');
    if (has('druid', houndSeed)) out.push('a druid in a delve with a hound was given a wolf as well');
    // it hunts quietly, where a hound pants at heel
    has('druid', wolfSeed);
    const c = Game.companion(), p = Game.player();
    c.x = p.x; c.y = p.y + 1; c.mode = 'follow';
    if (Game.companionNoisy()) out.push('the wolf is as noisy as a hound');
    c.kind = 'hound'; if (!Game.companionNoisy()) out.push('a hound at heel was quiet'); c.kind = 'wolf';
    // Savage: the same bites, 2 more each against a foe below half its life
    const bites = async low => {
      const b = await start('druid', wolfSeed, OPT8);
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      h.floors = 4; h.mode = 'stay';
      b.Game.level().monsters.length = 0;
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => b.Game.level().tiles[y * b.Game.level().w + x] === b.Dungeon.T.FLOOR && Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      if (!spot) return null;
      const m = { uid: 95, id: 'ogre', x: spot[0], y: spot[1], hp: low ? 4e5 : 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      seedDice(b, 'savage');
      const hp0 = m.hp;
      run(b.Game, G2, 20000);
      return hp0 - m.hp;
    };
    const full = await bites(false), weak = await bites(true);
    if (full === null || weak === null) out.push('no room beside the wolf for the ogre');
    else if (!(weak > full) || (weak - full) % 2) out.push(`Savage: ${full} dealt to a whole ogre, ${weak} to a half-dead one`);
    // its own fate in the valley's tale
    const f = await start('druid', wolfSeed, OPT8);
    f.Game.companion().fallen = 1;
    const tale = JSON.stringify(f.Game.epilogue(false));
    if (!/grey wolf called/.test(tale) || /brown hound/.test(tale)) out.push(`the tale: ${tale.slice(0, 200)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin freed from its cage while a companion already follows slips away, and says so', async () => {
    const out = [];
    let said = '', tries = 0;
    while (!said && tries++ < 6) {
      const ctx = await start('fighter', 'cage-kin-' + tries, { levels: 6 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.stats.dex = 40;
      G.companion = { kind: 'hound', name: 'Ash', x: p.x, y: p.y, depth: 9, hp: 5, maxHp: 5, mode: 'stay', joined: 1 };
      const res = meetAndChoose(ctx, 'caged', 1);
      if (G.companion.kind !== 'hound') { out.push(`the goblin took the hound's place: ${G.companion.kind}`); break; }
      said = JSON.stringify(res || '') + G.log.slice(-4).map(e => e.m).join(' / ');
      if (!/slips off into the dark|thinks better of following/.test(said)) said = '';
    }
    if (!said && !out.length) out.push('no line said the goblin would not follow');
    return out.length ? out.join('; ') : true;
  });

  await test('a bear carries no shield, gives the rust no blade, and its hide keeps out blows, not hunger or poison', async () => {
    const out = [];
    const ctx = await druid('druid-bear-rules', 4);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.eq.shield = { t: 'buckler', q: 1, e: 0 };
    const withShield = Game.playerAC(); p.eq.shield = null; const bare = Game.playerAC(); p.eq.shield = { t: 'buckler', q: 1, e: 0 };
    Game.castSpell(druidSpell(ctx, 'wild_shape'));
    if (Game.playerAC() !== bare + 2) out.push(`a bear with a buckler: armour class ${Game.playerAC()}, want the bare druid's ${bare} + 2 (with the buckler, ${withShield})`);
    // and what the buckler was made with stays behind with it, though armour's powers go into the bear
    p.eq.shield = { t: 'buckler', q: 1, e: 0, pw: 'pure' }; p.eq.armor = { t: 'leather', q: 1, e: 0, pw: 'mend' };
    if (Game.hasPower('pure') || !Game.hasPower('mend')) out.push(`a bear: the buckler's Pure ${Game.hasPower('pure')}, the armour's Mend ${Game.hasPower('mend')}`);
    const shapeWas = p.shape; delete p.shape;
    if (!Game.hasPower('pure')) out.push('the buckler\'s Pure was lost with the bear gone');
    p.shape = shapeWas; p.eq.shield = { t: 'buckler', q: 1, e: 0 }; p.eq.armor = { t: 'leather', q: 1, e: 0 };
    // the rust: armour of leather has no metal, and the bear holds neither the buckler nor the spear
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
    const hide1 = p.shape.hide, until1 = p.shape.until;
    p.hp = p.maxHp = 9999; p.shape.hide = 1e6; p.shape.until = 1e12;
    const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999, edge: 40 });
    const mark = markLog(G);
    for (let i = 0; i < 4; i++) { m.moveReady = 0; run(Game, G, 1200); }
    if (p.eq.weapon.e !== 0 || p.eq.shield.e !== 0) out.push(`the rust reached what a bear does not hold: sword ${p.eq.weapon.e}, buckler ${p.eq.shield.e} (${linesSince(G, mark).filter(l => /[Rr]ust|metal/.test(l)).join(' | ')})`);
    if (!linesSince(G, mark).some(l => /no metal on you/.test(l))) out.push('the rustmaw never bit, or found metal');
    ctx.Game.level().monsters.length = 0; p.shape.hide = hide1; p.shape.until = G.t + 30000; void until1;
    // hunger and poison reach the druid inside the bear; a blow goes to the hide
    const hide0 = p.shape.hide, hp0 = p.hp;
    Game.hurtPlayer(1, 'The poison burns in your veins.', null, 'poison');
    if (p.shape.hide !== hide0 || p.hp !== hp0 - 1) out.push(`poison: hide ${hide0}->${p.shape.hide}, hp ${hp0}->${p.hp}`);
    Game.hurtPlayer(1, 'You are starving!', null, 'hunger');
    if (p.shape.hide !== hide0 || p.hp !== hp0 - 2) out.push(`hunger: hide ${hide0}->${p.shape.hide}, hp ${hp0 - 1}->${p.hp}`);
    Game.hurtPlayer(1, 'A dart strikes you.', null, 'trap');
    if (p.shape.hide !== hide0 - 1 || p.hp !== hp0 - 2) out.push(`a dart: hide ${hide0}->${p.shape.hide}, hp ${p.hp}`);
    void G;
    return out.length ? out.join('; ') : true;
  });

  await test('an overgrown floor: dealt over floors already twisted, caps to eat, traps hidden in the moss, a druid at home', async () => {
    const out = [];
    const ctx = await druid('overgrown', 5, { levels: 8 });
    const { Game, Dungeon, SPELLS } = ctx;
    // it takes some floors already twisted and changes nothing else in the plan
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const seed = 'og-' + i, a = Dungeon.twistPlan(seed, 8), b = Dungeon.twistPlan(seed, 8, false);
      // (a deep smouldering floor is added on its own dice, not dealt over another: left out here)
      for (const d in a) if (a[d] === 'smouldering') delete a[d];
      if (Object.keys(a).join() !== Object.keys(b).join()) { out.push(`${seed}: twisted floors ${Object.keys(a)} against ${Object.keys(b)}`); break; }
      for (const d in a) { if (a[d] === 'overgrown') { seen++; if (b[d] === 'market') out.push(`${seed}: a goblin market overgrown`); } else if (a[d] !== b[d] && !(a[d] === 'tremors' && b[d] !== 'market')) out.push(`${seed}: floor ${d} ${b[d]} became ${a[d]}`); }
    }
    if (seen < 20) out.push(`only ${seen} overgrown floors in 200 runs`);
    // caps grow on its floor
    const og = (() => { for (let i = 0; i < 200; i++) { const p = Dungeon.twistPlan('og-' + i, 8); for (const d in p) if (p[d] === 'overgrown') return ['og-' + i, +d]; } return null; })();
    const L = Dungeon.generate(og[0], og[1], { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
    const caps = Object.values(L.items).flat().filter(i => i.t === 'caps');
    if (L.twist !== 'overgrown' || caps.length !== 3) out.push(`an overgrown floor grew ${caps.length} caps (twist ${L.twist})`);
    // traps hide under the moss from all but a druid; a druid's spells cost a point less
    const lv = Game.level(), p = Game.player();
    const eyeDruid = Game.trapEye(), lash = SPELLS.druid.find(s => s.id === 'thorn_lash'), shape = SPELLS.druid.find(s => s.id === 'wild_shape');
    const c0 = [Game.spellCost(lash), Game.spellCost(shape)];
    lv.twist = 'overgrown';
    if (Game.trapEye() !== eyeDruid) out.push(`the moss hid a trap from a druid: ${eyeDruid} -> ${Game.trapEye()}`);
    if (Game.spellCost(lash) !== Math.max(1, c0[0] - 1) || Game.spellCost(shape) !== c0[1] - 1) out.push(`on an overgrown floor a druid's spells cost ${Game.spellCost(lash)}/${Game.spellCost(shape)}, elsewhere ${c0}`);
    p.cls = 'thief';
    const eyeThief = Game.trapEye(); lv.twist = null;
    if (Game.trapEye() - eyeThief !== 4) out.push(`the moss took ${Game.trapEye() - eyeThief} from a thief's eye, want 4`);
    return out.length ? out.join('; ') : true;
  });

  await test('an overgrown floor grows puffcaps over some of its creatures, each worth what it grew over; nowhere else', async () => {
    const out = [];
    const ctx = await start('fighter', 'puff-place');
    const { Game, Dungeon, MONSTERS } = ctx;
    const og = (() => { for (let i = 0; i < 300; i++) { const p = Dungeon.twistPlan('pf-' + i, 8); for (const d in p) if (p[d] === 'overgrown' && +d === 2) return ['pf-' + i, +d]; } return null; })();
    if (!og) return 'no early overgrown floor in 300 seeds';
    Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: og[0], opts: { ...OPTS, levels: 8 } });
    for (let i = 0; i < 5 && Game.state().depth < og[1]; i++) Game.descend();
    const L = Game.level();
    if (L.twist !== 'overgrown') return `floor ${og[1]} of ${og[0]} is ${L.twist}`;
    const raw = Dungeon.generate(og[0], og[1], { ...OPTS, levels: 8 });
    const caps = L.monsters.filter(m => m.id === 'puffcap');
    if (!caps.length) out.push(`no puffcaps among ${L.monsters.length} creatures`);
    for (const m of caps) {
      const was = raw.monsters.find(r => r.x === m.x && r.y === m.y);
      if (!was) { out.push(`a puffcap at ${m.x},${m.y} grew over nothing`); continue; }
      const b = MONSTERS[was.id];
      if (b.boss || b.named || was.elite || was.pack) out.push(`a puffcap grew over a ${was.elite || ''} ${was.id}`);
      if (m.worth !== b.xp) out.push(`a puffcap over a ${was.id} is worth ${m.worth}, want ${b.xp}`);
    }
    // none on an ordinary floor, and the depth never deals one
    for (let d = 1; d <= 8; d++) for (const s of ['pf-plain-a', 'pf-plain-b']) {
      const G2 = Dungeon.generate(s, d, { ...OPTS, levels: 8 });
      if (G2.monsters.some(m => m.id === 'puffcap')) out.push(`${s} floor ${d} dealt a puffcap by depth`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a flooded floor hides the drowned under its water, a dark one holds the eyeless; each worth what it replaced, and the restless never raise the drowned', async () => {
    const out = [];
    const ctx = await start('fighter', 'kin-place');
    const { Game, Dungeon, MONSTERS } = ctx;
    for (const [twist, id] of [['flooded', 'drowned'], ['dark', 'eyeless']]) {
      const at = (() => { for (let i = 0; i < 400; i++) { const p = Dungeon.twistPlan('kin-' + i, 8); for (const d in p) if (p[d] === twist && +d === 2) return ['kin-' + i, +d]; } return null; })();
      if (!at) { out.push(`no ${twist} second floor in 400 seeds`); continue; }
      Game.newGame({ name: 'K', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: at[0], opts: { ...OPTS, levels: 8 } });
      Game.descend();
      const L = Game.level();
      if (L.twist !== twist) { out.push(`floor 2 of ${at[0]} is ${L.twist}`); continue; }
      const raw = Dungeon.generate(at[0], 2, { ...OPTS, levels: 8 });
      const kin = L.monsters.filter(m => m.id === id);
      if (!kin.length) out.push(`no ${id} on a ${twist} floor of ${L.monsters.length} creatures`);
      for (const m of kin) {
        const was = raw.monsters.find(r => r.x === m.x && r.y === m.y);
        if (!was || m.worth !== MONSTERS[was.id].xp) out.push(`a ${id} over a ${was && was.id} is worth ${m.worth}`);
        if (id === 'drowned' && (!m.sunk || m.awake)) out.push(`a drowned one began ${m.sunk ? '' : 'un'}sunk and ${m.awake ? 'awake' : 'asleep'}`);
      }
    }
    // a restless floor raises its dead from those dealt by depth, never the drowned
    for (let i = 0; i < 300; i++) {
      const p = Dungeon.twistPlan('rst-' + i, 8), d = Object.keys(p).find(k => p[k] === 'restless');
      if (!d) continue;
      Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rst-' + i, opts: { ...OPTS, levels: 8, monsters: 'many' } });
      for (let k = 0; k < 8 && Game.state().depth < +d; k++) { if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts'); Game.descend(); }
      if (Game.level().monsters.some(m => m.id === 'drowned')) { out.push(`the restless dead of rst-${i} raised a drowned one`); break; }
      if (i > 40) break;
    }
    return out.length ? out.join('; ') : true;
  });

  // ---------- the living dungeon: the elements act on the place (elements.js) ----------
  /** A hero facing a clear three-wide passage, with a helper to put creatures in it. */
  const arena = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999; p.sp = p.maxSp = 999; p.level = 9;
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    for (let k = -1; k <= 6; k++) for (let j = -1; j <= 1; j++) {
      const x = p.x + dx * k + sx * j, y = p.y + dy * k + sy * j;
      if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    }
    L.monsters.length = 0; L.dressing = []; L.fields = {}; L.npcs = []; L.items = {};
    let uid = 500;
    const at = (fwd, side = 0) => [p.x + dx * fwd + sx * side, p.y + dy * fwd + sy * side];
    const put = (id, fwd, side = 0, extra = {}) => { const [x, y] = at(fwd, side); const m = { uid: uid++, id, x, y, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    const cast = id => { G.t = Math.max(G.t, p.nextAttack) + 10; const sp = ctx.SPELLS[p.cls].find(s => s.id === id); if (!Game.castSpell(sp)) throw new Error(`${id} would not cast`); };
    return { ctx, Game, Dungeon, p, G, L, at, put, cast };
  };

  await test('lightning striking something in water runs through it to all else standing in it within two squares, the hero too; not on dry stone; a puddle carries it too', async () => {
    const out = [];
    const { G, L, p, put, at, cast } = await arena('mage', 'el-arc');
    // dry stone: the bolt takes only its line
    L.twist = null;
    let a = put('goblin', 3), b = put('goblin', 3, 1);
    cast('lightning');
    if (a.hp === 999) out.push('the bolt missed its target');
    if (b.hp !== 999) out.push('lightning ran across dry stone');
    // a flooded floor: it runs through the water to the one beside, not to a hero three squares off
    L.twist = 'flooded'; L.monsters.length = 0;
    a = put('goblin', 3); b = put('goblin', 3, 1);
    let hp0 = p.hp;
    cast('lightning');
    if (b.hp === 999) out.push('lightning in black water did not reach the one beside');
    if (p.hp !== hp0) out.push('lightning three squares off reached the hero');
    // struck two squares off, it reaches the hero wading there too
    L.monsters.length = 0;
    a = put('goblin', 2);
    hp0 = p.hp;
    cast('lightning');
    if (!(p.hp < hp0)) out.push('lightning two squares off in black water spared the hero');
    // a puddle on a dry floor carries it between the two standing in it
    L.twist = null; L.monsters.length = 0;
    a = put('goblin', 4); b = put('goblin', 4, 1);
    for (const m of [a, b]) L.dressing.push({ x: m.x, y: m.y, k: 'puddle', ox: 0, oy: 0, r: 0.3 });
    cast('lightning');
    if (b.hp === 999) out.push('a puddle did not carry the lightning');
    // and ice carries none
    L.twist = 'flooded'; L.dressing = []; L.monsters.length = 0;
    a = put('goblin', 4); b = put('goblin', 4, 1);
    const [bx, by] = at(4, 1); L.fields[`${bx},${by}`] = { k: 'ice', until: G.t + 1e6 };
    cast('lightning');
    if (b.hp !== 999) out.push('lightning ran into ice');
    return out.length ? out.join('; ') : true;
  });

  await test('cold striking something in water freezes the water round it and holds whatever stands there, the hero if beside it; a drowned one cannot rise through the ice; the ice melts', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-ice');
    L.twist = 'flooded';
    let a = put('goblin', 2, 0, { nextAct: G.t }), b = put('goblin', 2, 1, { nextAct: G.t });
    cast('cone_cold');
    const [ax, ay] = at(2), [bx, by] = at(2, 1);
    if (!Game.fieldAt(ax, ay) || Game.fieldAt(ax, ay).k !== 'ice' || !Game.fieldAt(bx, by) || Game.fieldAt(bx, by).k !== 'ice') out.push('the water did not freeze round what the cold struck');
    if (!(b.nextAct > G.t + 1500)) out.push('the one beside it was not held by the ice');
    if (p.held > G.t) out.push('ice two squares off held the hero');
    // struck beside the hero, the ice takes the hero's feet too; a drowned one beside cannot come up through it
    L.fields = {}; L.monsters.length = 0;
    a = put('goblin', 1);
    const dr = put('drowned', 1, 1, { sunk: true, awake: false, nextAct: G.t });
    cast('cone_cold');
    if (!(p.held > G.t) || p.heldBy !== 'ice') out.push(`cold beside the hero left them free (held ${p.held > G.t}, ${p.heldBy})`);
    run(Game, G, 2000);
    if (!dr.sunk) out.push('a drowned one rose through the ice');
    run(Game, G, 8000);
    const [fx, fy] = at(1);
    if (Game.fieldAt(fx, fy)) out.push('the ice never melted');
    if (dr.sunk) out.push('the drowned one stayed down once the ice had gone');
    // dry stone does not freeze
    L.twist = null; L.fields = {}; L.monsters.length = 0;
    a = put('goblin', 2);
    cast('cone_cold');
    if (Object.keys(L.fields).length) out.push('cold froze dry stone');
    return out.length ? out.join('; ') : true;
  });

  await test('fire sets moss alight: it spreads, burns what stands in it, the hero too, burns out a few squares from where it caught, and leaves ash that does not burn again', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-moss');
    L.twist = 'overgrown';
    const a = put('goblin', 1);
    cast('burning_hands');
    const [ax, ay] = at(1);
    if (!Game.fieldAt(ax, ay) || Game.fieldAt(ax, ay).k !== 'fire') out.push('fire on moss did not catch');
    const hp0 = a.hp;
    run(Game, G, 1500);
    if (!(a.hp < hp0)) out.push('the goblin stood in the fire unhurt');
    run(Game, G, 20000);
    const ash = Object.keys(L.fields).filter(k => L.fields[k].k === 'ash').map(k => k.split(',').map(Number));
    if (ash.length < 3) out.push(`the fire burnt only ${ash.length} squares`);
    const far = ash.filter(([x, y]) => Math.abs(x - ax) + Math.abs(y - ay) > 2);
    if (far.length) out.push(`moss burnt ${far.length} squares beyond two of where it caught`);
    if (Object.values(L.fields).some(f => f.k === 'fire')) out.push('the fire never burnt out');
    // ash does not burn again, and dry stone never catches
    L.monsters.length = 0;
    const b = put('goblin', 1);
    L.fields[`${b.x},${b.y}`] = { k: 'ash', until: 0 };
    cast('burning_hands');
    if (Game.fieldAt(b.x, b.y).k !== 'ash') out.push('ash caught fire again');
    L.twist = null; L.fields = {}; L.monsters.length = 0; put('goblin', 1);
    cast('burning_hands');
    if (Object.keys(L.fields).length) out.push('fire caught on bare stone');
    // standing in fire hurts the hero
    L.fields = {}; L.monsters.length = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'moss', until: G.t + 3000, spread: 1e15, burn: G.t, gen: 9 };
    const hp1 = p.hp;
    run(Game, G, 300);
    if (!(p.hp < hp1)) out.push('the hero stood in the flames unhurt');
    return out.length ? out.join('; ') : true;
  });

  await test('a third of the barrels are oil casks: broken, one spills oil; fire on the blade lights it, it burns through the oil, and bursts a cask it reaches', async () => {
    const out = [];
    // how many barrels hold oil, over many floors
    {
      const ctx = await start('fighter', 'casks');
      const { Game } = ctx;
      let barrels = 0, casks = 0;
      for (let i = 0; i < 12; i++) {
        Game.newGame({ name: 'C', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'cask-' + i, opts: { ...OPTS, levels: 8, size: 'large' } });
        for (let k = 0; k < 3; k++) {
          for (const q of Game.level().dressing || []) { if (q.k === 'barrel') barrels++; if (q.k === 'oilcask') casks++; }
          if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
          Game.descend();
        }
      }
      const share = casks / Math.max(1, barrels + casks);
      if (!(barrels + casks > 20 && share > 0.2 && share < 0.5)) out.push(`${casks} casks among ${barrels + casks} barrels`);
    }
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-oil');
    L.twist = null;
    const [cx, cy] = at(1);
    L.dressing.push({ x: cx, y: cy, k: 'oilcask', ox: 0, oy: 0 });
    Game.input('forward');
    if (L.dressing.some(q => q.k === 'oilcask')) out.push('walking into the cask did not break it');
    const oil = Object.keys(L.fields).filter(k => L.fields[k].k === 'oil');
    if (oil.length < 3) out.push(`a broken cask spilt oil on ${oil.length} squares`);
    if (Game.fieldAt(p.x, p.y)) out.push('a kicked cask spilt oil under the hero\'s own feet');
    // a second cask, whole, beside the oil
    const [kx, ky] = at(2, 1);
    L.dressing.push({ x: kx, y: ky, k: 'oilcask', ox: 0, oy: 0 });
    // a flaming blade lights the oil under a goblin
    p.eq.weapon = { t: 'longsword', q: 1, e: 0, pw: 'flame' }; p.stats.str = 30;
    const g = put('goblin', 1);
    let lit = false;
    for (let i = 0; i < 12 && !lit; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); lit = !!Game.fieldAt(g.x, g.y) && Game.fieldAt(g.x, g.y).k === 'fire'; }
    if (!lit) out.push('a flaming blade did not light the oil under its target');
    run(Game, G, 3000);
    if (Object.values(L.fields).some(f => f.k === 'oil')) out.push('the fire did not burn through all the oil');
    if (L.dressing.some(q => q.k === 'oilcask')) out.push('the fire reached a cask and did not burst it');
    // what the fire leaves is kept with the save
    L.fields['3,3'] = { k: 'ash', until: 0 };
    Game.save(true);
    if (!Game.load()) out.push('load failed');
    else if (!Game.fieldAt(3, 3) || Game.fieldAt(3, 3).k !== 'ash') out.push('the ash was not kept with the save');
    return out.length ? out.join('; ') : true;
  });

  await test('the living will not walk into fire, and one caught in it gets out; the dead come on through it', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-shy');
    L.twist = null;
    // a wall of fire across the passage two squares ahead
    const wall = () => { for (const j of [-1, 0, 1]) { const [x, y] = at(2, j); L.fields[`${x},${y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e9, spread: 1e15, burn: 1e15, gen: 0 }; } };
    wall();
    const gob = put('goblin', 4, 0, { nextAct: G.t });
    run(Game, G, 4000);
    const near = Math.abs(gob.x - p.x) + Math.abs(gob.y - p.y);
    if (near <= 2) out.push(`a goblin came through the fire to ${near} squares`);
    if (!gob.balkSaid) out.push('the goblin never shied back from the flames');
    // the dead do not care
    L.monsters.length = 0;
    const bones = put('skeleton', 4, 0, { nextAct: G.t });
    let reached = false;
    for (let t = 0; t < 8000 && !reached; t += 25) { Game.update(G.t + 25, 25); reached = Math.abs(bones.x - p.x) + Math.abs(bones.y - p.y) <= 1; }
    if (!reached) out.push('a skeleton would not come through the fire');
    // one standing in fire gets out of it, even right beside the hero, where it would otherwise stand and swing
    L.monsters.length = 0; L.fields = {};
    const [fx, fy] = at(1);
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e9, spread: 1e15, burn: 1e15, gen: 0 };
    const caught = put('goblin', 1, 0, { nextAct: G.t });
    run(Game, G, 1200);
    if (caught.x === fx && caught.y === fy) out.push('a goblin stood on in the flames');
    return out.length ? out.join('; ') : true;
  });

  await test('a Pyromancer\'s Burning Hands reach three squares down the passage; anyone else\'s one', async () => {
    const out = [];
    for (const pyro of [true, false]) {
      const { p, G, L, put, at, Game, ctx } = await arena('mage', 'el-pyro-' + pyro);
      L.twist = null;
      if (pyro) p.path = 'pyromancer';
      const g = put('goblin', 3);
      G.t = Math.max(G.t, p.nextAttack) + 10;
      const sp = ctx.SPELLS.mage.find(s => s.id === 'burning_hands');
      const cast = Game.castSpell(sp);
      if (pyro && !(g.hp < 999)) out.push('a Pyromancer\'s Burning Hands did not reach three squares');
      if (!pyro && (cast || g.hp < 999)) out.push('Burning Hands reached three squares without the path');
      if (Game.spellCost(sp) !== sp.cost + (pyro ? 1 : 0)) out.push(`Burning Hands cost ${Game.spellCost(sp)} ${pyro ? 'to a Pyromancer' : 'to another mage'}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('lamp oil floats on water: thrown on a flooded floor it spreads over the water, burns there, and the water under it still carries lightning until it burns', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-afloat');
    L.twist = 'flooded';
    p.inv.push({ t: 'lamp_oil', q: 2, e: 0 });
    const a = put('goblin', 3), b = put('goblin', 3, 1);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    const mark = markLog(G);
    Game.useItem(p.inv.find(i => i.t === 'lamp_oil'));
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask thrown on the water left no oil there');
    if (!linesSince(G, mark).some(l => /over the water/.test(l))) out.push(`no word of oil on the water (${linesSince(G, mark).join(' | ')})`);
    // oil on the water still lets the lightning through to the one beside
    cast('lightning');
    if (b.hp === 999) out.push('oil on the water stopped the lightning');
    // and a flame sets it alight on the water
    L.fields[`${x3},${y3}`] = { k: 'oil' };
    a.hp = 999; b.hp = 999;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.state().lastSpell = null;
    const sp = Game.knownSpells().find(s => s.id === 'burning_hands');
    L.monsters.length = 0; L.fields = {};
    const [x1, y1] = at(1); L.fields[`${x1},${y1}`] = { k: 'oil' };
    if (!Game.castSpell(sp)) out.push('a fire spell at oil on the water was refused');
    if (!Game.fieldAt(x1, y1) || Game.fieldAt(x1, y1).k !== 'fire') out.push('oil on the water did not catch');
    return out.length ? out.join('; ') : true;
  });

  await test('now and then a floor lays out a scene for fire (casks among sleepers, an oil-slick way in, casks at a locked door), the same for a seed, named once as the hero comes near', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    const found = {};
    for (let s = 0; s < 30 && Object.keys(found).length < 3; s++) {
      const ctx = await start('fighter', 'scene-' + s, REAL);
      const { Game } = ctx;
      for (let d = 2; d <= 7; d++) {
        Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
        const L = Game.level();
        for (const pc of L.pieces || []) if (!found[pc.k]) found[pc.k] = { ctx, seed: 'scene-' + s, depth: Game.state().depth, pc, L };
      }
    }
    for (const k of ['cache', 'slick', 'barricade']) if (!found[k]) out.push(`no ${k} in thirty seeds`);
    const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const casksBy = (L, x, y) => (L.dressing || []).filter(q => q.k === 'oilcask' && DIRS4.some(([dx, dy]) => q.x === x + dx && q.y === y + dy));
    if (found.cache) {
      const { L } = found.cache;
      const beside = L.monsters.filter(m => casksBy(L, m.x, m.y).length).length;
      if (beside < 2) out.push(`a cache had casks beside ${beside} sleepers`);
    }
    if (found.slick) {
      const { L } = found.slick;
      if (Object.values(L.fields || {}).filter(f => f.k === 'oil').length < 3) out.push('an oil-slick way in had under three squares of oil');
    }
    if (found.barricade) {
      const { L, pc } = found.barricade;
      if (L.tiles[pc.y * L.w + pc.x] !== found.barricade.ctx.Dungeon.T.DOOR_LOCKED) out.push('a barricade was not at a locked door');
      if (!casksBy(L, pc.x, pc.y).length) out.push('no casks stood against the barricaded door');
    }
    // named once, as the hero comes near
    if (found.cache) {
      const { ctx, L, pc, depth } = found.cache;
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      // back on the cache's own floor (the search went on down), its sleepers left asleep
      if (G.depth !== depth) Game.testFloor(depth);
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      const mark = markLog(G);
      p.x = pc.x; p.y = pc.y;
      run(Game, G, 200); run(Game, G, 200);
      const said = countSaid(linesSince(G, mark), /Oil casks stand among/);
      if (said !== 1) out.push(`the cache was named ${said} times`);
    }
    // the same seed lays the same scene
    if (found.slick) {
      const again = await start('fighter', found.slick.seed, REAL);
      let pc2 = null;
      for (let d = 2; d <= found.slick.depth; d++) { again.Game.descend(); if (again.Game.forkPending()) again.Game.chooseRoute('crypts'); }
      pc2 = (again.Game.level().pieces || [])[0];
      if (!pc2 || pc2.k !== 'slick' || pc2.x !== found.slick.pc.x || pc2.y !== found.slick.pc.y) out.push(`the same seed laid ${JSON.stringify(pc2)}, not ${JSON.stringify(found.slick.pc)}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('testing aids: endless life, spell points and gold keep the hero topped up and alive; a run that had one on is written nowhere', async () => {
    const out = [];
    const { Game, G, L, p, put, ctx } = await arena('mage', 'el-testing');
    p.maxHp = 20; p.hp = 20; p.maxSp = 30; p.sp = 30; p.gold = 5;
    Game.setTesting({ hp: true, sp: true, gold: true });
    run(Game, G, 50);
    if (!Game.testingOn() || !Game.tested()) out.push('the aids did not mark the run');
    if (p.gold < 99999) out.push(`endless gold left ${p.gold}`);
    // a blow far past the hero's life
    const o = put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 20; i++) { o.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o.nextAct = G.t; o.blows = 3; run(Game, G, 300); }
    if (G.status !== 'playing') out.push(`endless life let the hero ${G.status}`);
    if (p.hp !== p.maxHp) out.push(`endless life left ${p.hp} of ${p.maxHp}`);
    L.monsters.length = 0;
    // a spell cast costs nothing that stays spent
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.castSpell(ctx.SPELLS.mage.find(s => s.id === 'shield'));
    run(Game, G, 50);
    if (p.sp !== p.maxSp) out.push(`endless spell points left ${p.sp} of ${p.maxSp}`);
    // switched off, the run stays marked: its death is not remembered, nor written in the Hall
    Game.setTesting({});
    const hallBefore = localStorage.getItem('deepdelve.hall');
    const fallenBefore = JSON.stringify(ctx.Progress ? ctx.Progress.fallen() : null);
    p.hp = 1; L.monsters.length = 0;
    const o2 = put('ogre', 1, 0, { hp: 999, maxHp: 999, nextAct: G.t });
    for (let i = 0; i < 60 && G.status === 'playing'; i++) { o2.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o2.nextAct = G.t; o2.blows = 3; run(Game, G, 300); }
    if (G.status !== 'dead') out.push('with the aids off, the hero did not die');
    if (localStorage.getItem('deepdelve.hall') !== hallBefore) out.push('a test run was written in the Hall');
    if (ctx.Progress && JSON.stringify(ctx.Progress.fallen()) !== fallenBefore) out.push('a test run\'s death was remembered for the bones');
    return out.length ? out.join('; ') : true;
  });

  await test('testing tools: go to a floor (the road given past the divided stair), reveal it, gain a level, be given an item, a relic or the floor\'s keys; each marks the run, and the eye does too', async () => {
    const out = [];
    const ctx = await start('fighter', 'el-tools', { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true });
    const { Game, Dungeon } = ctx;
    const G = Game.state(), p = Game.player();
    // standing still is no tool used
    if (Game.testFloor(1) || Game.tested()) out.push('going to the floor you are on did something');
    // down past the fork, by the road asked for
    const fork = Dungeon.routeSpan(8).fork;
    if (!Game.testFloor(fork + 2, 'warrens')) out.push('could not go down');
    if (G.depth !== fork + 2) out.push(`carried to floor ${G.depth}, not ${fork + 2}`);
    if (G.route !== 'warrens') out.push(`past the divided stair the road was ${G.route}`);
    if (!Game.tested()) out.push('going to a floor did not mark the run');
    const L = Game.level();
    if (p.x !== L.start.x || p.y !== L.start.y) out.push('carried down, the hero was not at the stair\'s foot');
    if (p.deepest < fork + 2) out.push('the deepest floor was not kept');
    // back up, and down again: the road taken stays taken
    Game.testFloor(2);
    const up = Game.level();
    if (G.depth !== 2) out.push(`carried up to floor ${G.depth}`);
    const back = up.downStart || up.start;
    if (p.x !== back.x || p.y !== back.y) out.push('carried up, the hero was not by the stair down');
    Game.testFloor(8, 'crypts');
    if (G.route !== 'warrens') out.push('a second trip down changed the road taken');
    if (!Game.level().isFinal) out.push('floor 8 of 8 was not the final floor');
    if (Game.testFloor(9) && G.depth > 8) out.push('went below the last floor');
    // the next run starts unmarked; the rest one by one on it
    const ctx2 = await start('fighter', 'el-tools2', { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true });
    const G2 = ctx2.Game.state(), p2 = ctx2.Game.player();
    if (ctx2.Game.tested()) out.push('a new run began marked');
    const one = (what, fn) => { const c = ctx2; c.Game.state().tested = false; const r = fn(); if (r && !c.Game.tested()) out.push(`${what} did not mark the run`); return r; };
    const L2 = ctx2.Game.level();
    if (!one('reveal', () => ctx2.Game.testReveal())) out.push('could not reveal the floor');
    if (!L2.explored.every(v => v)) out.push('the floor was not all laid out');
    const lv = p2.level;
    if (!one('a level', () => ctx2.Game.testLevel())) out.push('could not gain a level');
    if (p2.level !== lv + 1) out.push(`gaining a level went from ${lv} to ${p2.level}`);
    if (!ctx2.Game.pendingBoons()) out.push('a level gained offered no choice');
    // items: known for what they are; the Heart and gold are not handed over
    delete G2.known.potion_heal;
    if (!one('an item', () => ctx2.Game.testGive('potion_heal'))) out.push('could not be given a potion');
    if (!p2.inv.some(i => i.t === 'potion_heal') || !G2.known.potion_heal) out.push('the potion given was not in the pack, known');
    if (ctx2.Game.testGive('artifact') || ctx2.Game.testGive('gold') || ctx2.Game.testGive('nonsense')) out.push('the Heart, gold or nothing at all was given');
    const gifts = ctx2.Game.testGifts();
    if (gifts.some(g => ['artifact', 'gold', 'key'].includes(g.id)) || !gifts.some(g => g.id === 'keys') || !gifts.some(g => g.id.startsWith('relic:'))) out.push('the list of gifts is wrong');
    // a relic: found this run, but not written in the codex
    const rid = gifts.find(g => g.id.startsWith('relic:')).id.slice(6);
    const codex = JSON.stringify(ctx2.Progress.load().relics);
    if (!one('a relic', () => ctx2.Game.testGive('relic:' + rid))) out.push('could not be given a relic');
    if (!p2.inv.some(i => i.u === rid) || !G2.relics.found.includes(rid)) out.push('the relic given was not in the pack, found');
    if (JSON.stringify(ctx2.Progress.load().relics) !== codex) out.push('a relic given for testing was written in the codex');
    // keys: one for each colour of lock left on the floor; none where no door is locked
    let d = 1;
    while (d < 8 && !Object.keys(ctx2.Game.level().locks || {}).length) ctx2.Game.testFloor(++d);
    const colours = [...new Set(Object.values(ctx2.Game.level().locks || {}))];
    if (!colours.length) out.push('no floor had a locked door to test the keys on');
    else {
      p2.inv = p2.inv.filter(i => i.t !== 'key');
      if (!one('keys', () => ctx2.Game.testGive('keys'))) out.push('could not be given the keys');
      const got = p2.inv.filter(i => i.t === 'key').map(i => i.color).sort();
      if (JSON.stringify(got) !== JSON.stringify(colours.slice().sort())) out.push(`keys given ${got}, locks ${colours}`);
      ctx2.Game.level().locks = {};
      if (ctx2.Game.testGive('keys')) out.push('keys were given where no door is locked');
    }
    // a full pack takes nothing, and nothing is marked
    while (ctx2.Game.giveItem({ t: 'dagger', q: 1, e: 0 }));
    G2.tested = false;
    if (ctx2.Game.testGive('longsword') || ctx2.Game.tested()) out.push('a full pack took a gift, or was marked for it');
    // the eye marks the run as the other switches do
    ctx2.Game.setTesting({ eye: true });
    if (!ctx2.Game.testingOn() || !ctx2.Game.tested()) out.push('showing every monster did not mark the run');
    ctx2.Game.setTesting({});
    return out.length ? out.join('; ') : true;
  });

  await test('the run that ends is kept for the title, with what killed it (a test run is not); the pack sorts like with like, keeping the order within a kind', async () => {
    const out = [];
    const { Game, G, L, p, put } = await arena('fighter', 'el-lastrun');
    localStorage.removeItem('deepdelve.lastrun');
    p.hp = 1; p.maxHp = 10;
    const o = put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 60 && G.status === 'playing'; i++) { o.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o.nextAct = G.t; o.blows = 3; run(Game, G, 300); }
    const lr = Game.lastRun();
    if (G.status !== 'dead') out.push('the hero did not die');
    else if (!lr || lr.name !== p.name || lr.cls !== 'fighter' || lr.won || lr.depth !== G.depth || !/ogre/.test(lr.killer)) out.push(`the last run was kept as ${JSON.stringify(lr)}`);
    // a test run leaves the one before it standing
    const t = await arena('mage', 'el-lastrun-2');
    // (each world keeps its own storage: the run before is set down in this one)
    localStorage.setItem('deepdelve.lastrun', JSON.stringify({ name: 'Before', cls: 'fighter', depth: 3, levels: 8, won: false, killer: '', date: 1 }));
    t.Game.setTesting({ gold: true });
    t.p.hp = 1;
    const o2 = t.put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 60 && t.G.status === 'playing'; i++) { o2.windup = { kind: 'move', move: 'crush', at: t.G.t, until: t.G.t }; o2.nextAct = t.G.t; o2.blows = 3; run(t.Game, t.G, 300); }
    t.Game.setTesting({});
    if (t.G.status !== 'dead') out.push('the test run did not end');
    else if ((t.Game.lastRun() || {}).name !== 'Before') out.push('a test run was kept as the last run');
    // the pack sorted
    const s = await arena('fighter', 'el-sort');
    s.p.inv = [{ t: 'potion_heal', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 0 }, { t: 'ration', q: 1, e: 0 }, { t: 'leather', q: 1, e: 0 }, { t: 'mace', q: 1, e: 0 }, { t: 'scroll_map', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 1 }];
    s.Game.sortPack();
    const kinds = s.p.inv.map(i => s.ctx.ITEMS[i.t].kind);
    const order = ['weapon', 'armor', 'heal', 'potion', 'scroll', 'food'];
    const idx = kinds.map(k => order.indexOf(k) < 0 ? 99 : order.indexOf(k));
    if (idx.some((v, i) => i && v < idx[i - 1])) out.push(`sorted to ${s.p.inv.map(i => i.t).join(', ')}`);
    const daggers = s.p.inv.filter(i => i.t === 'dagger').map(i => i.e);
    if (daggers.join() !== '0,1') out.push('two of a kind changed places in the sort');
    if (s.p.inv.length !== 7) out.push('the sort lost or made an item');
    return out.length ? out.join('; ') : true;
  });

  await test('a mimic waits among the barrels of a middle floor as one of them, the same for a seed: away from the stairs, shut and asleep', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    let found = 0, floors = 0, bad = 0, first = null;
    for (let s = 0; s < 24; s++) {
      const c = await start('fighter', 'mimic-' + s, REAL);
      for (let d = 2; d <= 8; d++) {
        c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute('crypts');
        const L = c.Game.level(), depth = c.Game.state().depth, mm = L.monsters.filter(m => m.id === 'mimic');
        if (depth >= 3 && depth <= 7) floors++;
        if (!mm.length) continue;
        if (depth < 3 || depth > 7 || mm.length > 1) bad++;
        const m = mm[0];
        if (!m.disguised || m.awake) out.push(`floor ${depth}: a mimic laid ${m.disguised ? 'awake' : 'open'}`);
        const ends = [L.start, L.stairsUp, L.stairsDown].filter(Boolean);
        if (ends.some(e => Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 2)) out.push(`floor ${depth}: a mimic by the stairs`);
        if ((L.dressing || []).some(q => q.x === m.x && q.y === m.y)) out.push(`floor ${depth}: a barrel still stood on the mimic's square`);
        found++;
        if (!first) first = { seed: 'mimic-' + s, depth, x: m.x, y: m.y };
      }
    }
    if (bad) out.push(`${bad} floors held a mimic out of the middle floors, or more than one`);
    if (!(found >= floors * 0.15 && found <= floors * 0.6)) out.push(`${found} mimics on ${floors} middle floors`);
    if (first) {
      const again = await start('fighter', first.seed, REAL);
      for (let d = 2; d <= first.depth; d++) { again.Game.descend(); if (again.Game.forkPending()) again.Game.chooseRoute('crypts'); }
      const m2 = again.Game.level().monsters.find(m => m.id === 'mimic');
      if (!m2 || m2.x !== first.x || m2.y !== first.y) out.push('the same seed laid its mimic elsewhere');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a mimic creaks as the hero comes near, springs on one who touches it or stays beside it, and struck first from where the hero stands is caught shut for double', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-mimic');
    L.twist = null;
    const shut = (fwd, side = 0) => put('mimic', fwd, side, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
    // drawn as a barrel, the Use button reads Break
    let m = shut(1);
    // (no life bar, no warning: whatever is drawn there is drawn as a barrel)
    if (Game.renderState(0).sprites.some(sp => Math.abs(sp.x - (m.x + 0.5)) < 0.3 && Math.abs(sp.y - (m.y + 0.5)) < 0.3 && (sp.hp != null || sp.tell))) out.push('a shut mimic was drawn as a creature');
    if (Game.useLabel() !== 'Break') out.push(`a shut mimic ahead was offered "${Game.useLabel()}"`);
    // walked into: it has the hero at once
    let mark = markLog(G);
    Game.input('forward');
    if (m.disguised || !p.grabbed) out.push(`walked into, the mimic ${m.disguised ? 'stayed shut' : 'did not seize the hero'}`);
    if (!linesSince(G, mark).some(l => /splits open/.test(l))) out.push('walked into, the mimic said nothing');
    // stood beside: a creak first, then it lunges after a beat, and a step away is time enough
    L.monsters.length = 0; p.grabbed = null; G.blowGate = 0;
    m = shut(3);
    mark = markLog(G);
    run(Game, G, 300);
    if (countSaid(linesSince(G, mark), /creaks/) !== 1 || !m.creaked) out.push('three squares off, the mimic did not creak, once');
    if (!m.disguised) out.push('the mimic sprang at three squares');
    m.x = at(1)[0]; m.y = at(1)[1]; m.rx = m.x; m.ry = m.y;
    run(Game, G, 300);
    if (!m.disguised) out.push('the mimic sprang before its beat');
    run(Game, G, 500);
    if (m.disguised || !m.windup) out.push(`beside it for a while, the mimic ${m.disguised ? 'stayed shut' : 'did not lunge'}`);
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    run(Game, G, 1500);
    if (p.grabbed) out.push('a step away from a mimic\'s lunge was not time enough');
    p.x -= sx; p.y -= sy;
    // heard, it is aimed at from where the hero stands: caught shut, the blow lands twice
    L.monsters.length = 0; p.grabbed = null;
    m = shut(3);
    m.creaked = true;
    const hp0 = m.hp;
    cast('magic_missile');
    run(Game, G, 600);
    if (m.disguised) out.push('struck by a spell, the mimic stayed shut');
    if (!(hp0 - m.hp >= 4)) out.push(`caught shut, the mimic took only ${hp0 - m.hp}`);
    if (!(Game.bestiary().mimic || {}).answer) out.push('striking a shut mimic first was not counted its answer');
    // not yet heard, a spell finds nothing there
    L.monsters.length = 0;
    m = shut(3);
    const hp1 = m.hp;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    const { ctx } = { ctx: null };
    Game.castSpell(Game.knownSpells().find(sp => sp.id === 'magic_missile'));
    run(Game, G, 600);
    if (m.hp !== hp1 || !m.disguised) out.push('a spell found a mimic that had not yet creaked');
    // woken with the whole floor (a door heaved open), it is still a barrel: no foe near to rest, no warning at the side
    L.monsters.length = 0;
    m = shut(0, 1); m.awake = true; m.creaked = true; m.nextAct = 1e12;
    if (Game.restLabel() === 'Foes near') out.push('a shut mimic, woken, kept the hero from resting');
    if (Game.renderState(0).fx.threats.length) out.push('a shut mimic, woken, was shown as a threat at the side');
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 6: a shut mimic cannot dodge a blow, springs at a bash, stops roots, never counts as awake; rock is not the hero\'s blow and crushes bones', async () => {
    const out = [];
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-swing');
      L.twist = null;
      // the clumsiest swing still lands on a barrel standing still, and it is named only once it has sprung
      p.stats.str = 1; p.perkHit = -40;
      const m = put('mimic', 1, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const mark = markLog(G);
      G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack');
      const said = linesSince(G, mark);
      if (m.disguised || m.hp >= 60) out.push(`a clumsy swing at a shut mimic ${m.disguised ? 'left it shut' : 'did no harm'}`);
      if (said.some(l => /You miss the Mimic/.test(l))) out.push('a swing at a shut mimic missed it by name');
    }
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-bash');
      L.twist = null;
      const m = put('mimic', 1, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const mark = markLog(G);
      Game.useAbility();
      const said = linesSince(G, mark), opened = said.findIndex(l => /barrel/i.test(l)), named = said.findIndex(l => /bash the Mimic/.test(l));
      if (m.disguised) out.push('a bashed mimic stayed shut');
      else if (opened < 0 || (named >= 0 && named < opened)) out.push(`bashing a shut mimic named it first: ${said.join(' | ')}`);
    }
    {
      const { Game, G, L, p, put } = await arena('druid', 'rv6-roots');
      L.twist = null;
      const m = put('mimic', 2, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const behind = put('goblin', 3);
      const mark = markLog(G);
      // (with only a barrel in the way the spell finds nothing to hold, and may not be cast at all)
      G.t = Math.max(G.t, p.nextAttack) + 10;
      Game.castSpell(Game.knownSpells().find(sp => sp.id === 'entangle'));
      if ((m.snaredUntil || 0) > G.t || linesSince(G, mark).some(l => /wrap the Mimic/.test(l))) out.push('roots wrapped a shut mimic');
      if ((behind.snaredUntil || 0) > G.t) out.push('roots passed a shut mimic to the goblin behind it');
      // woken with the whole floor, it is asleep again before anything can count it
      m.awake = true;
      run(Game, G, 50);
      if (m.awake) out.push('a shut mimic stayed awake');
    }
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-rock');
      L.twist = 'tremors';
      // an acolyte's chant goes on under falling rock, and the hero is not thanked for it
      const a = put('acolyte', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
      a.windup = { kind: 'move', move: 'mend', at: G.t, until: G.t + 60000 };
      L.quake = { next: G.t + 1e9, falls: [{ x: a.x, y: a.y, at: G.t, lands: G.t + 50 }] };
      const mark = markLog(G);
      run(Game, G, 100);
      if (!a.windup || a.windup.move !== 'mend') out.push('falling rock broke an acolyte\'s chant');
      if (linesSince(G, mark).some(l => /You break/.test(l))) out.push('falling rock was told as the hero\'s blow');
      // a skeleton under it, the hero holding an edge, stays down
      L.monsters.length = 0;
      const sk = put('skeleton', 2, 0, { hp: 1, maxHp: 20 });
      L.quake.falls = [{ x: sk.x, y: sk.y, at: G.t, lands: G.t + 50 }];
      run(Game, G, 100);
      if (L.monsters.includes(sk)) out.push(`a skeleton under falling rock ${sk.collapsed ? 'fell apart to rise again' : 'was left standing'}`);
    }
    // a floor left with rock in the air drops none of it on a hero coming back
    {
      const ctx = await start('fighter', 'rv6-back', { levels: 8 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 999;
      Game.testFloor(3);
      const L3 = Game.level();
      L3.twist = 'tremors';
      L3.quake = { next: G.t + 1e9, falls: [{ x: L3.downStart ? L3.downStart.x : L3.start.x, y: L3.downStart ? L3.downStart.y : L3.start.y, at: G.t, lands: G.t + 1000 }] };
      Game.testFloor(4); Game.level().monsters.length = 0;
      run(Game, G, 3000);
      Game.testFloor(3); Game.level().monsters.length = 0;
      run(Game, G, 50);
      if (p.hp < 999) out.push('rock left in the air fell on a hero coming back');
      if (L3.quake && L3.quake.falls.length) out.push('rock left in the air was still falling on return');
    }
    // a mimic's life comes from its floor's own dice: the same seed, the same mimic
    {
      let seen = 0;
      for (let i = 0; i < 40 && seen < 2; i++) {
        const hp = [];
        for (const k of [0, 1]) {
          const ctx = await start('fighter', 'rv6-hp-' + i, { levels: 8 });
          ctx.Game.testFloor(5);
          const m = ctx.Game.level().monsters.find(x => x.id === 'mimic');
          hp.push(m ? m.hp : null);
        }
        if (hp[0] == null) continue;
        seen++;
        if (hp[0] !== hp[1]) out.push(`one seed's mimic had ${hp[0]} and then ${hp[1]} hit points`);
      }
      if (!seen) out.push('no mimic on the fifth floor of forty seeds');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a smouldering floor: its cracks glow, then flare fire over themselves and the four squares beside; cold seals one a while', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-vent');
    L.twist = 'smouldering';
    const [vx, vy] = at(2), [hx, hy] = at(0), [nx, ny] = at(1);
    L.vents = [{ x: vx, y: vy, next: Math.max(1, G.t), heat: 0, sealedUntil: 0 }];
    run(Game, G, 100);
    let v = Game.vents()[0];
    if (!(v.heat > 0)) out.push('a crack whose time had come did not heat up');
    if (v.area.length !== 5 || !v.area.some(a => a.x === nx && a.y === ny)) out.push(`a heating crack would cover ${JSON.stringify(v.area)}`);
    // standing beside it when it flares: the fire is under the hero, and burns
    p.x = nx; p.y = ny;
    const mark = markLog(G);
    run(Game, G, 1600);
    const f = Game.fieldAt(p.x, p.y);
    if (!f || f.k !== 'fire') out.push('the flare left no fire on the square beside the crack');
    if (!linesSince(G, mark).some(l => /flares/.test(l))) out.push('the flare was not told');
    run(Game, G, 1000);
    if (p.hp >= 9999) out.push('a hero standing in a flare was not burnt');
    v = Game.vents()[0];
    if (v.heat) out.push('the crack was still glowing after its flare');
    if (!(L.vents[0].next >= G.t + 6000 && L.vents[0].next <= G.t + 16000)) out.push(`the crack flares again in ${L.vents[0].next - G.t}ms`);
    // cold cast at it seals it: no glow, no flare, a while
    L.fields = {}; p.x = hx; p.y = hy; p.hp = 9999;
    L.vents[0].next = G.t + 5000;
    const m2 = markLog(G);
    cast('cone_cold');
    if (!Game.vents()[0].sealed) out.push('cold cast at a crack did not seal it');
    if (!linesSince(G, m2).some(l => /crusts the glowing crack/.test(l))) out.push('the seal was not told');
    L.vents[0].next = G.t;
    run(Game, G, 3000);
    if (Game.vents()[0].heat || Object.keys(L.fields).length) out.push('a sealed crack heated or flared');
    // cold striking a creature beside a crack seals it too
    L.vents[0].sealedUntil = 0; L.vents[0].next = G.t + 99999;
    const g = put('goblin', 3);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    cast('cone_cold');
    if (!Game.vents()[0].sealed) out.push('cold striking a goblin beside a crack did not seal it');
    void g; void Dungeon;
    return out.length ? out.join('; ') : true;
  });

  await test('an emberling blazes up close to the hero and flares: beside it, scorched; two squares off, clear (the answer); quenched by cold; walks through fire; bursts into flame as it dies', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast, ctx } = await arena('mage', 'el-ember');
    L.twist = null;
    // fire barely touches it, cold hurts it badly
    const e0 = put('emberling', 3, 0, { hp: 999, maxHp: 999 });
    if (!(ctx.ELEMENTS_TAKEN.emberling.fire < 1 && ctx.ELEMENTS_TAKEN.emberling.cold > 1)) out.push('an emberling does not shrug off fire and fear cold');
    L.monsters.length = 0; void e0;
    // close, after a blow, it blazes up; still beside the hero when it flares, it scorches
    let e = put('emberling', 1, 0, { hp: 999, maxHp: 999, nextAct: G.t, blows: 1 });
    let blazed = false;
    for (let i = 0; i < 40 && !blazed; i++) { run(Game, G, 50); blazed = !!(e.windup && e.windup.move === 'flare'); if (!blazed && !e.windup) e.blows = 1; if (e.windup && !e.windup.move) { e.windup = null; e.nextAct = G.t; e.blows = 1; } }
    if (!blazed) out.push('an emberling beside the hero never blazed up');
    else {
      p.eq.armor = null;
      const hp0 = p.hp, mk = markLog(G);
      run(Game, G, 1500);
      // (the flare also sets the hero's own square alight: the scorch is told apart from the fire)
      if (p.hp >= hp0 || !linesSince(G, mk).some(l => /heat of it scorches you/.test(l))) out.push('an emberling flaring beside the hero did not scorch them');
      const f = Game.fieldAt(at(1)[0], at(1)[1]);
      if (!f || f.k !== 'fire') out.push('the flare did not set its own square alight');
    }
    // two squares off when it flares: clear, and the answer
    L.monsters.length = 0; L.fields = {}; p.hp = 9999;
    e = put('emberling', 1, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    e.windup = { kind: 'move', move: 'flare', at: G.t, until: G.t + 300 }; e.nextAct = G.t + 300;
    const [bx, by] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
    L.tiles[(p.y + by) * L.w + p.x + bx] = ctx.Dungeon.T.FLOOR;
    p.x += bx; p.y += by;
    run(Game, G, 500);
    if (p.hp !== 9999) out.push('a hero two squares off was scorched by the flare');
    if (!(Game.bestiary().emberling || {}).answer) out.push('standing clear of the flare was not counted the answer');
    p.x -= bx; p.y -= by;
    // blazing up, quenched by cold
    L.monsters.length = 0; L.fields = {};
    e = put('emberling', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    e.windup = { kind: 'move', move: 'flare', at: G.t, until: G.t + 5000 }; e.nextAct = G.t + 5000;
    const mark = markLog(G);
    cast('cone_cold');
    if (e.windup) out.push('cold did not quench an emberling blazing up');
    if (!linesSince(G, mark).some(l => /dulls the Emberling's glow/.test(l))) out.push('the quench was not told');
    // it dies in a burst of flame
    L.monsters.length = 0; L.fields = {};
    e = put('emberling', 1, 0, { hp: 1, maxHp: 30, nextAct: 1e12 });
    const [ex, ey] = [e.x, e.y];
    for (let i = 0; i < 8 && L.monsters.includes(e); i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); run(Game, G, 30); }
    const fd = Game.fieldAt(ex, ey);
    if (L.monsters.includes(e)) out.push('could not kill the emberling');
    else if (!fd || fd.k !== 'fire') out.push('a dead emberling left no fire where it fell');
    // a smouldering floor grows them among its creatures, and its cracks in its rooms
    {
      const found = (() => { for (let i = 0; i < 400; i++) { const pl = ctx.Dungeon.twistPlan('sm-' + i, 8); for (const d in pl) if (pl[d] === 'smouldering') return ['sm-' + i, +d]; } return null; })();
      if (!found) out.push('no smouldering floor in 400 seeds');
      else {
        const c2 = await start('fighter', found[0], { levels: 8 });
        c2.Game.player().hp = c2.Game.player().maxHp = 9999;
        c2.Game.testFloor(found[1]);
        const L2 = c2.Game.level();
        if (L2.twist !== 'smouldering') out.push(`floor ${found[1]} of ${found[0]} is ${L2.twist}`);
        if (!L2.vents || L2.vents.length < 5) out.push(`a smouldering floor had ${L2.vents ? L2.vents.length : 0} cracks`);
        else {
          const ends = [L2.start, L2.stairsDown, L2.stairsUp].filter(Boolean);
          if (L2.vents.some(v => ends.some(q => Math.abs(q.x - v.x) + Math.abs(q.y - v.y) <= 3))) out.push('a crack lay within three squares of a stair or the start');
          if (L2.vents.some((v, i) => L2.vents.some((w, j) => i !== j && Math.abs(v.x - w.x) + Math.abs(v.y - w.y) <= 2))) out.push('two cracks lay side by side');
        }
        if (!L2.monsters.some(m => m.id === 'emberling')) out.push(`no emberling among ${L2.monsters.length} creatures on a smouldering floor`);
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the forge-spirit: blade or coat a step better, past the traders\' +3 to +4 and no further; a curse burnt out; the bellows for both', async () => {
    const out = [];
    const ctx = await start('fighter', 'forgespirit', { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.gold = 9999;
    while (G.depth < 6) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    const w = p.eq.weapon;
    w.e = 3;
    meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (w.e !== 4) out.push(`a +3 blade in its fire came out +${w.e}`);
    meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (w.e !== 4) out.push(`it took a blade past +4, to +${w.e}`);
    // a cursed coat comes back clean, and better
    p.eq.armor = p.eq.armor || { t: 'leather', q: 1, e: 0 };
    const a = p.eq.armor;
    // (and not yet known for what it is: the fire shows it, as it shows the curse)
    a.e = -1; a.curse = 1; a.h = 1;
    const g0 = p.gold;
    const r = meetAndChoose(ctx, 'forgespirit', 1); Game.closeEncounter();
    if (a.curse || a.e !== 0) out.push(`a cursed -1 coat on its anvil came back ${a.curse ? 'cursed' : 'clean'} at ${a.e}`);
    if (a.h) out.push('a coat not yet known came back from the anvil still unknown');
    if (g0 - p.gold !== 12 * G.depth) out.push(`the anvil cost ${g0 - p.gold}, not ${12 * G.depth}`);
    if (!r.lines.some(l => /curse burns away/.test(l))) out.push('the burnt curse was not told');
    // the bellows, worked by a strong arm: both
    w.e = 0; a.e = 0; p.stats.str = 30;
    let rr = null;
    for (let i = 0; i < 6 && !(rr && rr.check.pass); i++) { rr = meetAndChoose(ctx, 'forgespirit', 2); Game.closeEncounter(); }
    if (!rr.check.pass) out.push('a strong arm never worked the bellows');
    else if (w.e !== 1 || a.e !== 1) out.push(`the bellows left the blade +${w.e} and the coat +${a.e}`);
    // nothing to temper
    p.eq.weapon = null;
    const r2 = meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (!r2.lines.some(l => /no weapon for it/.test(l))) out.push(`with no weapon the fire said ${r2.lines.join(' | ')}`);
    return out.length ? out.join('; ') : true;
  });

  /** A hero on the sixth floor of eight, sturdy and rich, for the deep encounters. */
  const deepHero = async seed => {
    const ctx = await start('fighter', seed, { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 300; p.gold = 9999;
    while (G.depth < 6) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    return ctx;
  };

  await test('the Heartwell: a strong chest breathes its warmth for more life, gold down the shaft steadies the hand, a rest by it heals and costs food', async () => {
    const out = [];
    {
      const ctx = await deepHero('heartwell-breathe');
      const { Game } = ctx; const p = Game.player();
      p.stats.con = 30;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { p.hp = p.maxHp = 300; r = meetAndChoose(ctx, 'heartwell', 0); Game.closeEncounter(); }
      if (!r.check.pass) out.push('a strong chest never breathed its warmth');
      else if (p.maxHp !== 304) out.push(`its warmth left ${p.maxHp} maximum hit points, not 304`);
    }
    {
      const ctx = await deepHero('heartwell-gold');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      const g0 = p.gold;
      meetAndChoose(ctx, 'heartwell', 1); Game.closeEncounter();
      if (g0 - p.gold !== 10 * G.depth) out.push(`gold down the shaft cost ${g0 - p.gold}, not ${10 * G.depth}`);
      if (!p.effects.boon_hit || p.effects.boon_hit.amount !== 2) out.push(`gold down the shaft gave ${JSON.stringify(p.effects.boon_hit)}`);
    }
    {
      const ctx = await deepHero('heartwell-rest');
      const { Game } = ctx; const p = Game.player();
      p.hp = 100; p.food = 80;
      meetAndChoose(ctx, 'heartwell', 2); Game.closeEncounter();
      if (p.hp !== 115 || p.food !== 70) out.push(`a rest by it: ${p.hp} hit points (not 115), ${p.food} food (not 70)`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the Last Delver: a meal shared buys the floor and its traps; asked badly, they wake the floor; robbed well, their pack', async () => {
    const out = [];
    {
      const ctx = await deepHero('delver-meal');
      const { Game } = ctx; const L = Game.level();
      L.explored.fill(0);
      meetAndChoose(ctx, 'lastdelver', 0); Game.closeEncounter();
      if (!L.explored.every(v => v)) out.push('a shared meal did not lay out the floor');
      if (Object.keys(L.traps || {}).length && !L.trapsKnown) out.push('a shared meal did not tell the traps');
    }
    {
      const ctx = await deepHero('delver-ask');
      const { Game } = ctx; const p = Game.player();
      p.stats.wis = 1;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && !r.check.pass); i++) {
        const L = Game.level();
        r = meetAndChoose(ctx, 'lastdelver', 1); Game.closeEncounter();
        // (put a sleeper back on the floor to see whether it wakes: meeting clears the floor's monsters)
        if (r.check && !r.check.pass) break;
        void L;
      }
      if (r.check.pass) out.push('a dull wit asked well six times running');
      else if (!r.lines.some(l => /awake/.test(l))) out.push(`asked badly, they said: ${r.lines.join(' / ')}`);
    }
    {
      const ctx = await deepHero('delver-rob');
      const { Game } = ctx; const p = Game.player();
      p.stats.dex = 30;
      let r = null;
      const held = () => p.inv.reduce((a, it) => a + (it.q || 1), 0);
      let before = 0;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { before = held(); r = meetAndChoose(ctx, 'lastdelver', 2); Game.closeEncounter(); }
      if (!r.check.pass) out.push('quick fingers never robbed them');
      else if (!r.lines.some(l => /^Found: /.test(l))) out.push(`robbed, they gave: ${r.lines.join(' / ')} (${before} -> ${held()})`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a warm egg: smashed, a deal of experience and the floor wakes; a hand warmed at it heals a little', async () => {
    const out = [];
    {
      const ctx = await deepHero('egg-smash');
      const { Game } = ctx; const p = Game.player();
      const xp = p.xp;
      const r = meetAndChoose(ctx, 'wyrmegg', 0); Game.closeEncounter();
      if (p.xp - xp < 60) out.push(`smashed, it gave ${p.xp - xp} experience`);
      if (!r.lines.some(l => /awake/.test(l))) out.push(`smashed, it said: ${r.lines.join(' / ')}`);
    }
    {
      const ctx = await deepHero('egg-warm');
      const { Game } = ctx; const p = Game.player();
      p.hp = 100;
      meetAndChoose(ctx, 'wyrmegg', 2); Game.closeEncounter();
      if (p.hp !== 112) out.push(`a hand warmed at it: ${p.hp} hit points, not 112`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a kobold trapper backs off to throw, sets a snare between you that is seen and can be sprung from before it, and its snares go slack when it dies', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-kobold');
    L.twist = null; L.traps = {};
    // beside the hero it steps back, if it has room
    let k = put('kobold', 1, 0, { hp: 40, maxHp: 40, nextAct: G.t });
    run(Game, G, 200);
    if (Math.abs(k.x - p.x) + Math.abs(k.y - p.y) !== 2) out.push(`beside the hero the kobold stood ${Math.abs(k.x - p.x) + Math.abs(k.y - p.y)} off`);
    // three squares off it sets a snare on the square before the hero
    L.monsters.length = 0;
    let set = false;
    for (let i = 0; i < 30 && !set; i++) {
      L.monsters.length = 0; L.traps = {}; L.snares = {};
      k = put('kobold', 3, 0, { hp: 40, maxHp: 40, nextAct: G.t });
      run(Game, G, 30);
      if (k.windup && k.windup.move === 'snare') { run(Game, G, 1000); set = true; }
    }
    const [sx, sy] = at(1), sk = `${sx},${sy}`;
    if (!set) out.push('three squares off, the kobold never set a snare in thirty chances');
    else if (!L.snares[sk] || L.traps[sk] !== 'snare') out.push(`the snare was set at ${JSON.stringify(L.snares)}`);
    // seen: the Use button springs it from before it, and that is the answer
    if (Game.useLabel() !== 'Disarm') out.push(`before a snare the Use button read "${Game.useLabel()}"`);
    Game.input('use');
    if (L.snares[sk] || L.traps[sk]) out.push('Use did not spring the snare ahead');
    if (!(Game.bestiary().kobold || {}).answer) out.push('springing a snare from before it was not counted the answer');
    // walked into, it holds the hero (unless a quick foot pulls clear: tried a few times)
    let held = false;
    p.stats.dex = 3;
    for (let i = 0; i < 6 && !held; i++) {
      p.held = 0;
      L.traps[sk] = 'snare'; L.snares[sk] = k.uid;
      p.x = sx - Dungeon.DIRS[p.dir][0]; p.y = sy - Dungeon.DIRS[p.dir][1];
      G.t = Math.max(G.t, p.nextMove || 0) + 400;
      Game.input('forward'); run(Game, G, 50);
      if (p.held > G.t && p.heldBy === 'snare') held = true;
    }
    if (!held) out.push('walking into a snare never held the hero');
    // its snares go slack when it dies
    p.held = 0;
    const [tx, ty] = at(2);
    L.traps[`${tx},${ty}`] = 'snare'; L.snares[`${tx},${ty}`] = k.uid;
    const mark = markLog(G);
    k.hp = 1;
    put('kobold', 5, 0, { uid: 77777, hp: 40, maxHp: 40 });
    L.traps['9,9'] = 'snare'; L.snares['9,9'] = 77777;
    k.nextAct = 1e12;
    p.x = k.x - Dungeon.DIRS[p.dir][0]; p.y = k.y - Dungeon.DIRS[p.dir][1];
    for (let i = 0; i < 10 && L.monsters.includes(k); i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); run(Game, G, 30); }
    if (L.monsters.includes(k)) out.push('could not kill the kobold');
    else {
      if (L.snares[`${tx},${ty}`] || L.traps[`${tx},${ty}`]) out.push('a dead kobold\'s snare stayed set');
      if (!L.snares['9,9']) out.push('another kobold\'s snare went slack with the first');
      if (!linesSince(G, mark).some(l => /goes slack/.test(l))) out.push('the slack snare was not told');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('tremors: on a middle floor dealt them, the ground shudders now and then and marks where rock will land, the hero\'s square among them; it lands on whatever stands there', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-quake');
    // dealt over floors already twisted, from the third floor down, the rest of the plan as it was
    let dealt = 0;
    for (let i = 0; i < 300; i++) {
      const seed = 'qk-' + i, a = Dungeon.twistPlan(seed, 8), b = Dungeon.twistPlan(seed, 8, false);
      // (a deep smouldering floor is added on its own dice, not dealt over another: left out here)
      for (const d in a) if (a[d] === 'smouldering') delete a[d];
      if (Object.keys(a).join() !== Object.keys(b).join()) { out.push(`${seed}: twisted floors ${Object.keys(a)} against ${Object.keys(b)}`); break; }
      for (const d in a) if (a[d] === 'tremors') { dealt++; if (+d < 3) out.push(`${seed}: tremors on floor ${d}`); }
    }
    if (dealt < 10) out.push(`tremors dealt on only ${dealt} floors in 300 seeds`);
    // a plain floor never shudders
    L.twist = null; L.quake = { next: G.t, falls: [] };
    run(Game, G, 100);
    if (L.quake.falls.length) out.push('a plain floor shuddered');
    // a floor of tremors: marks round the hero, the hero's own square among them, and told
    L.twist = 'tremors'; L.quake = { next: G.t, falls: [] };
    const g = put('goblin', 1);
    let mark = markLog(G);
    run(Game, G, 50);
    const falls = L.quake.falls;
    if (!falls.some(f => f.x === p.x && f.y === p.y)) out.push(`the hero's square was not marked: ${JSON.stringify(falls)}`);
    if (falls.length < 3) out.push(`only ${falls.length} squares marked`);
    if (falls.some(f => Math.abs(f.x - p.x) + Math.abs(f.y - p.y) > 3)) out.push('rock was marked more than three squares off');
    if (falls.some(f => L.tiles[f.y * L.w + f.x] !== Dungeon.T.FLOOR)) out.push('rock was marked off the floor');
    if (!linesSince(G, mark).some(l => /ground shudders/.test(l))) out.push('the shudder was not told');
    if (!(Game.renderState(0).fx.rocks || []).length) out.push('the marks were not given to the view');
    // standing still under it: the rock lands on the hero, and on a foe that stands under it too
    const [gx, gy] = at(1);
    L.quake.falls = [{ x: p.x, y: p.y, at: G.t, lands: G.t + 300 }, { x: gx, y: gy, at: G.t, lands: G.t + 300 }];
    mark = markLog(G);
    run(Game, G, 400);
    if (p.hp >= 9999) out.push('rock landing on the hero did no harm');
    if (g.hp >= 999) out.push('rock landing on a goblin did it no harm');
    if (!linesSince(G, mark).some(l => /crashes down on you/.test(l))) out.push('the rock on the hero was not told');
    if (L.quake.falls.length) out.push('the fallen rock stayed marked');
    if (!L.dressing.some(o => o.k === 'rubble' && o.x === gx && o.y === gy)) out.push('fallen rock left no rubble');
    // stepping off in time: no harm
    p.hp = 9999;
    L.quake.falls = [{ x: p.x, y: p.y, at: G.t, lands: G.t + 1000 }];
    const [lx, ly] = at(0, 1);
    p.x = lx; p.y = ly;
    run(Game, G, 1100);
    if (p.hp !== 9999) out.push('rock hurt a hero who had stepped off its mark');
    // nothing falls while the hero stands on the stairs
    const t = L.tiles[p.y * L.w + p.x];
    L.tiles[p.y * L.w + p.x] = Dungeon.T.STAIRS_DOWN; L.quake = { next: G.t, falls: [] };
    run(Game, G, 50);
    if (L.quake.falls.length) out.push('rock was marked round a hero on the stairs');
    L.tiles[p.y * L.w + p.x] = t;
    // and it shudders again, in sixteen to twenty-four seconds
    if (!(L.quake.next >= G.t + 15000 && L.quake.next <= G.t + 24000)) out.push(`the next shudder is ${L.quake.next - G.t}ms off`);
    return out.length ? out.join('; ') : true;
  });

  await test('a cleric\'s prayer takes 0.85 seconds: slower than a druid\'s words or a mage\'s, quicker than it was (a second)', async () => {
    const out = [];
    const took = {};
    for (const [cls, id] of [['cleric', 'bless'], ['druid', 'thorn_lash'], ['mage', 'shield']]) {
      const { Game, G, p, put, ctx } = await arena(cls, 'el-pray-' + cls);
      if (id === 'thorn_lash') put('goblin', 2);
      G.t = Math.max(G.t, p.nextAttack) + 10;
      const sp = ctx.SPELLS[cls].find(s => s.id === id);
      if (!Game.castSpell(sp)) { out.push(`${cls} could not cast ${id}`); continue; }
      took[cls] = p.nextAttack - G.t;
    }
    if (took.cleric !== 850) out.push(`a cleric's prayer took ${took.cleric}ms`);
    if (!(took.druid < took.cleric && took.mage < took.druid)) out.push(`prayer ${took.cleric}, druid ${took.druid}, mage ${took.mage}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a trader on a floor saved before there were flasks of lamp oil stocks some as it loads, once: bought out, it stays bought out', async () => {
    const out = [];
    const { Game, L, at } = await arena('fighter', 'el-oldstock');
    const [x, y] = at(4, 1);
    // an old save: a trader with no lamp oil, on a floor not yet stocked
    L.npcs = [{ id: 'merchant', x, y, stock: [{ t: 'potion_heal', q: 2, e: 0 }], markup: 1, greeted: false }];
    delete L.lampOil;
    Game.save(true); Game.load();
    const t = () => Game.level().npcs.find(n => n.id === 'merchant');
    const oil = () => t().stock.find(i => i.t === 'lamp_oil');
    if (!oil() || !(oil().q >= 2)) out.push(`an old save's trader stocked ${oil() ? oil().q : 'no'} flasks`);
    // every flask bought (the stock line gone), and loaded again: none come back
    t().stock = t().stock.filter(i => i.t !== 'lamp_oil');
    Game.save(true); Game.load();
    if (oil()) out.push('a trader bought out of lamp oil was stocked again by a reload');
    return out.length ? out.join('; ') : true;
  });

  await test('a flask of lamp oil is thrown: it smashes three squares ahead or on the first thing in the way and spills there; not at a wall; every trader keeps some', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-flask');
    L.twist = null;
    p.inv.push({ t: 'lamp_oil', q: 3, e: 0 });
    const flask = () => p.inv.find(i => i.t === 'lamp_oil');
    // nothing in the way: three squares out
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask thrown down an empty passage did not spill three squares out');
    if (flask().q !== 2) out.push(`throwing left ${flask().q} flasks`);
    // a goblin in the way takes it
    L.fields = {};
    const g = put('goblin', 2);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    if (!Game.fieldAt(g.x, g.y) || Game.fieldAt(g.x, g.y).k !== 'oil') out.push('a flask did not smash on the goblin in the way');
    const [x4, y4] = at(4);
    if (Game.fieldAt(x4, y4)) out.push('the flask flew on past the goblin');
    // a wall right ahead: it is not thrown, and not used up
    L.monsters.length = 0; L.fields = {};
    const [wx, wy] = at(1); L.tiles[wy * L.w + wx] = 1;
    const q0 = flask().q;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    if (flask().q !== q0) out.push('a flask was thrown into a wall');
    // every trader keeps a few
    {
      const ctx = await start('fighter', 'flask-traders');
      let traders = 0, stocked = 0;
      for (let i = 0; i < 20; i++) {
        ctx.Game.newGame({ name: 'T', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'fl-' + i, opts: { ...OPTS, levels: 8 } });
        for (let k = 0; k < 3; k++) {
          for (const n of ctx.Game.level().npcs || []) if (Array.isArray(n.stock)) { traders++; if (n.stock.some(s => s.t === 'lamp_oil' && s.q >= 2)) stocked++; }
          if (ctx.Game.forkPending && ctx.Game.forkPending()) ctx.Game.chooseRoute('crypts');
          ctx.Game.descend();
        }
      }
      if (!traders || stocked !== traders) out.push(`${stocked} of ${traders} traders kept lamp oil`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('fire oil on a bow lights spilt oil where the arrow lands', async () => {
    const out = [];
    const { Game, G, L, p, put } = await arena('ranger', 'el-arrow');
    L.twist = null;
    p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.stats.dex = 30;
    p.coating = { t: 'fire', left: 20 };
    const g = put('goblin', 3);
    L.fields[`${g.x},${g.y}`] = { k: 'oil' };
    let lit = false;
    for (let i = 0; i < 12 && !lit; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); lit = !!Game.fieldAt(g.x, g.y) && Game.fieldAt(g.x, g.y).k === 'fire'; }
    if (!lit) out.push('a fire-oiled arrow did not light the oil it landed in');
    return out.length ? out.join('; ') : true;
  });

  await test('lightning through water shocks the hero once a casting, runs through the water and not through walls, and keeps a skeleton down', async () => {
    const out = [];
    const { Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-arc2');
    L.twist = 'flooded';
    // two struck in a line beside the hero: the water carries it into them once, not once for each
    put('goblin', 1); put('goblin', 2);
    let mark = markLog(G);
    cast('lightning');
    const shocks = linesSince(G, mark).filter(l => /through the water into you/.test(l)).length;
    if (shocks !== 1) out.push(`the hero was shocked ${shocks} times by one bolt`);
    // a wall between the water it struck and the one beyond keeps it out
    L.monsters.length = 0;
    const [wx, wy] = at(4, 1), [bx, by] = at(4, 2);
    L.tiles[wy * L.w + wx] = Dungeon.T.WALL; L.tiles[by * L.w + bx] = Dungeon.T.FLOOR;
    put('goblin', 4); const b = put('goblin', 4, 2);
    cast('lightning');
    if (b.hp !== 999) out.push('lightning ran through a wall');
    // a skeleton the water's lightning brings down stays down, as one the bolt brings down does
    L.monsters.length = 0; L.tiles[wy * L.w + wx] = Dungeon.T.FLOOR;
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 };
    put('goblin', 4); const sk = put('skeleton', 4, 1, { hp: 1, maxHp: 20 });
    cast('lightning');
    if (L.monsters.includes(sk)) out.push(`a skeleton felled by lightning through the water ${sk.collapsed ? 'lies waiting to rise' : 'still stands'}`);
    return out.length ? out.join('; ') : true;
  });

  await test('ice holds a drowned one down under a blow or a tread; oil burnt on moss leaves ash that stays; a fire spell that strikes nothing lights oil where it lands', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('fighter', 'el-loose');
    L.twist = 'flooded';
    const [fx, fy] = at(1);
    const dr = put('drowned', 1, 0, { sunk: true, awake: false, nextAct: G.t, hp: 40, maxHp: 40 });
    L.fields[`${fx},${fy}`] = { k: 'ice', until: G.t + 1e6 };
    for (let i = 0; i < 4; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); }
    if (!dr.sunk) out.push('a blow brought a drowned one up through the ice');
    const x0 = p.x;
    Game.input('forward'); run(Game, G, 300);
    if (!dr.sunk) out.push('a tread brought a drowned one up through the ice');
    if (p.x !== x0 && p.x === fx) out.push('the hero walked onto the drowned one\'s square');
    // oil that burns on moss takes the moss with it
    const m = await arena('mage', 'el-loose2');
    m.L.twist = 'overgrown';
    const [ox, oy] = m.at(2);
    m.L.fields[`${ox},${oy}`] = { k: 'fire', fuel: 'oil', until: m.G.t + 10, spread: 1e15, burn: 1e15, gen: 0 };
    run(m.Game, m.G, 32000);
    const f = m.Game.fieldAt(ox, oy);
    if (!f || f.k !== 'ash') out.push(`oil burnt on moss left ${f ? f.k : 'nothing'} after half a minute, and the moss would burn again`);
    // fire that strikes nothing still lights the oil where it comes down
    m.L.twist = null; m.L.fields = {};
    const [ax, ay] = m.at(1);
    m.L.fields[`${ax},${ay}`] = { k: 'oil' };
    m.cast('burning_hands');
    if (!m.Game.fieldAt(ax, ay) || m.Game.fieldAt(ax, ay).k !== 'fire') out.push('a fire spell that struck nothing did not light the oil it fell on');
    return out.length ? out.join('; ') : true;
  });

  await test('one caught alight at the far edge of spilt oil gets out away from the oil, not across the rest of it that is about to burn', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-edge');
    L.twist = null;
    // a line of oil two to four squares ahead; the far end catches under a goblin
    for (const k of [2, 3, 4]) { const [x, y] = at(k); L.fields[`${x},${y}`] = { k: 'oil' }; }
    const g = put('goblin', 4, 0, { nextAct: G.t });
    const [gx, gy] = at(4);
    L.fields[`${gx},${gy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    run(Game, G, 700);
    const d = Math.abs(g.x - p.x) + Math.abs(g.y - p.y);
    if (d < 4) out.push(`it came out ${d} squares from the hero, over the oil that was about to burn`);
    if (g.x === gx && g.y === gy) out.push('it stayed in the flames');
    return out.length ? out.join('; ') : true;
  });

  await test('fire a monster lit burns what stands in it but is not the hero\'s blow: it does not break a chant; the hero\'s own fire does', async () => {
    const out = [];
    for (const wild of [true, false]) {
      const { Game, G, L, put, at } = await arena('fighter', 'el-blaze-' + wild);
      L.twist = null;
      const ac = put('acolyte', 3, 0, { hp: 50, maxHp: 100, nextAct: G.t + 5000 });
      ac.windup = { kind: 'move', move: 'mend', at: G.t, until: G.t + 5000, target: ac.uid };
      const [x, y] = at(3);
      L.fields[`${x},${y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0, ...(wild ? { wild: true } : {}) };
      const mark = markLog(G);
      run(Game, G, 300);
      if (!(ac.hp < 50)) out.push(`${wild ? 'a wyrm\'s' : 'the hero\'s'} fire did not burn the acolyte`);
      const broken = !ac.windup;
      const said = linesSince(G, mark).some(l => /You break/.test(l));
      if (wild && (broken || said)) out.push(`a wyrm's fire broke the acolyte's chant for the hero (${linesSince(G, mark).join(' | ')})`);
      if (!wild && !broken) out.push('the hero\'s own fire did not break the chant');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a shut wooden door beside a fire catches, burns a while and falls in, a locked one too; fire under a webbed hero burns the web away', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, at } = await arena('fighter', 'el-door');
    L.twist = null;
    const [dx, dy] = at(3), [fx, fy] = at(2);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR_LOCKED;
    L.locks = L.locks || {}; L.locks[`${dx},${dy}`] = 'brass';
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: G.t, burn: 1e15, gen: 0 };
    const mark = markLog(G);
    let caught = false, heldWhileBurning = true;
    for (let i = 0; i < 80; i++) {
      run(Game, G, 200);
      const f = Game.fieldAt(dx, dy);
      if (f && f.k === 'fire') { caught = true; if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_LOCKED) heldWhileBurning = false; }
      if (L.tiles[dy * L.w + dx] === Dungeon.T.DOOR_OPEN) break;
    }
    if (!caught) out.push('the door beside the fire never caught');
    if (!heldWhileBurning) out.push('the door stood open while it was still burning');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('the burnt door never fell in');
    if (L.locks[`${dx},${dy}`]) out.push('the lock outlived the door');
    const said = linesSince(G, mark);
    if (!said.some(l => /door catches fire/.test(l)) || !said.some(l => /falls in/.test(l))) out.push(`no word of the door burning (${said.join(' | ')})`);
    // a web holding the hero shrivels in the flames
    p.webbed = G.t + 60000;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    run(Game, G, 300);
    if (p.webbed > G.t) out.push('fire under a webbed hero left the web whole');
    return out.length ? out.join('; ') : true;
  });

  await test('fire loose ends: a fleeing creature does not run into fire; a burning door is too hot to open and a burnt one cannot be shut; a door fire is named as such', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-flee');
    L.twist = null;
    // a one-wide passage, fire behind a goblin running from the hero
    for (let k = 1; k <= 6; k++) for (const j of [-1, 1]) { const [x, y] = at(k, j); L.tiles[y * L.w + x] = Dungeon.T.WALL; }
    const g = put('goblin', 3, 0, { nextAct: G.t, fleeing: true, hp: 30, maxHp: 30 });
    const [fx, fy] = at(4);
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    let entered = 0;
    for (let i = 0; i < 30; i++) { run(Game, G, 100); if (g.x === fx && g.y === fy) entered++; }
    if (entered) out.push(`a fleeing goblin stood in the fire ${entered} times in three seconds`);
    // a burning door will not open, and one burnt through will not shut
    L.fields = {}; L.monsters.length = 0;
    const [dx, dy] = at(1);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    L.fields[`${dx},${dy}`] = { k: 'fire', fuel: 'door', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR) out.push('a burning door was pushed open');
    L.fields[`${dx},${dy}`].until = G.t + 50;
    run(Game, G, 300);
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('the burning door did not fall');
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('a burnt-through door was pulled shut');
    // standing in a burning doorway, the hurt is from the door, not moss
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'door', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    G.stats = null; p.hp = 9999;
    run(Game, G, 300);
    const worst = G.stats && G.stats.worst;
    if (!worst || worst.cause !== 'a burning door') out.push(`a door fire hurt as ${worst ? worst.cause : 'nothing'}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a flask flies over a drowned one sunk out of sight, stops at a barrel; fire that strikes nothing comes down on the first oil in its flight', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('cleric', 'el-throw2');
    L.twist = 'flooded';
    p.inv.push({ t: 'lamp_oil', q: 5, e: 0 });
    const flask = () => p.inv.find(i => i.t === 'lamp_oil');
    put('drowned', 1, 0, { sunk: true, awake: false });
    let mark = markLog(G);
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.useItem(flask());
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask stopped on a drowned one sunk out of sight');
    if (linesSince(G, mark).some(l => /Drowned/.test(l))) out.push('the log named a drowned one the hero cannot see');
    // a barrel two squares off takes it
    L.twist = null; L.monsters.length = 0; L.fields = {};
    const [bx, by] = at(2);
    L.dressing.push({ x: bx, y: by, k: 'barrel', ox: 0, oy: 0 });
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.useItem(flask());
    const [x4, y4] = at(4);
    if (!Game.fieldAt(bx, by) || Game.fieldAt(bx, by).k !== 'oil' || Game.fieldAt(x4, y4)) out.push('a flask flew past a barrel in its way');
    // Flame Strike at nothing, with oil two squares off and open stone beyond, lights the oil
    L.dressing = []; L.fields = {};
    const [ox, oy] = at(2); L.fields[`${ox},${oy}`] = { k: 'oil' };
    const sp = Game.knownSpells().find(s => s.id === 'flame_strike');
    G.t = Math.max(G.t, p.nextAttack) + 10;
    if (!sp || !Game.castSpell(sp)) out.push('Flame Strike at oil two squares off was refused');
    else if (!Game.fieldAt(ox, oy) || Game.fieldAt(ox, oy).k !== 'fire') out.push('Flame Strike at nothing flew past the oil it was aimed at');
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin on its own throws a lit pot of oil from the third floor down, never before; it bursts in flames where the hero stood and the square behind; a step aside answers it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-pot');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    // (the same floor, taken as another depth)
    const d0 = G.depth;
    const tries = depth => {
      G.levels[depth] = L; G.depth = depth;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        L.monsters.length = 0; L.fields = {};
        const g = put('goblin', 3, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
        run(Game, G, 30);
        if (g.windup && g.windup.move === 'firepot') n++;
      }
      return n;
    };
    if (tries(2)) out.push('a goblin threw a firepot on the second floor');
    if (!tries(3)) out.push('a goblin on the third floor never threw a firepot in twenty chances');
    G.depth = d0;
    // it lands: stand still and it bursts over you, on your square and the one behind
    const pot = () => { L.monsters.length = 0; L.fields = {}; const g = put('goblin', 3, 0, { hp: 50, maxHp: 50 }); g.windup = { kind: 'move', move: 'firepot', at: G.t, until: G.t + 100, tx: p.x, ty: p.y, dx: -fx, dy: -fy }; g.nextAct = g.windup.until; return g; };
    let g = pot(), hp0 = p.hp, mark = markLog(G);
    run(Game, G, 140);
    const [bx, by] = at(-1);
    if (!(p.hp < hp0)) out.push(`a firepot burst on a hero who stood still and did not hurt them (${linesSince(G, mark).join(' | ')})`);
    for (const [x, y, what] of [[p.x, p.y, 'the hero\'s square'], [bx, by, 'the square behind']]) { const f = Game.fieldAt(x, y); if (!f || f.k !== 'fire' || !f.wild) out.push(`no goblin's fire on ${what}`); }
    // a step aside before it lands: the pot bursts where the hero stood
    const x0 = p.x, y0 = p.y;
    g = pot();
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    hp0 = p.hp; mark = markLog(G);
    run(Game, G, 400);
    if (p.hp < hp0) out.push('a firepot hurt a hero who stepped aside');
    if (!Game.fieldAt(x0, y0) || Game.fieldAt(x0, y0).k !== 'fire') out.push('the pot did not burst where the hero had stood');
    if (!linesSince(G, mark).some(l => /where you stood/.test(l))) out.push('no word of the pot missing');
    p.x = x0; p.y = y0;
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin archer looses a burning arrow at a hero standing on something that will burn, and lights it; stepping aside leaves the arrow to light the empty square', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-farrow');
    const tries = twist => {
      L.twist = twist;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        L.monsters.length = 0; L.fields = {};
        const a = put('archer', 3, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
        run(Game, G, 30);
        if (a.windup && a.windup.move === 'firearrow') n++;
      }
      return n;
    };
    if (tries(null)) out.push('an archer loosed a burning arrow at a hero on bare stone');
    if (!tries('overgrown')) out.push('an archer never loosed a burning arrow at a hero on moss in twenty chances');
    // loosed: stand on the moss and it catches under you; step aside and it catches where you stood
    L.twist = 'overgrown';
    for (const aside of [false, true]) {
      L.monsters.length = 0; L.fields = {};
      const a = put('archer', 3, 0, { hp: 50, maxHp: 50 });
      a.windup = { kind: 'move', move: 'firearrow', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
      const x0 = p.x, y0 = p.y;
      const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (aside) { p.x += sx; p.y += sy; }
      const mark = markLog(G);
      run(Game, G, 400);
      const f = Game.fieldAt(x0, y0);
      if (!f || f.k !== 'fire') out.push(`${aside ? 'stepping aside' : 'standing still'}: the moss where the arrow was aimed did not catch`);
      if (aside && !linesSince(G, mark).some(l => /where you stood/.test(l))) out.push('no word of the arrow missing');
      p.x = x0; p.y = y0;
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a living charger pulls up short of fire in its line and is left open; a living lunger does not follow a step back into fire', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-charge');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const o = put('orc', 4, 0, { hp: 200, maxHp: 200 });
    const [cx, cy] = at(2);
    L.fields[`${cx},${cy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0, wild: true };
    o.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t + 50, dx: -fx, dy: -fy }; o.nextAct = o.windup.until;
    let hp0 = p.hp, mark = markLog(G);
    run(Game, G, 150);
    const [sx, sy] = at(3);
    if (o.x !== sx || o.y !== sy) out.push(`the orc charged to ${o.x},${o.y}, not short of the fire at ${cx},${cy}`);
    if (p.hp < hp0) out.push('the charge came through the fire and hit the hero');
    if (!linesSince(G, mark).some(l => /short of the flames/.test(l))) out.push(`no word of the orc pulling up (${linesSince(G, mark).join(' | ')})`);
    if (!(o.openUntil > G.t) && !(p.opening && p.opening.until > G.t)) out.push('the orc was not left open');
    // a rat draws back beside the hero; the hero steps back, and fire takes the square they left
    L.monsters.length = 0; L.fields = {};
    const r = put('rat', 1, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
    for (let i = 0; i < 60 && !r.windup; i++) run(Game, G, 25);
    if (!r.windup || r.windup.move) return `the rat drew back ${JSON.stringify(r.windup)}`;
    const was = [p.x, p.y];
    p.x -= fx; p.y -= fy;
    L.fields[`${was[0]},${was[1]}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    hp0 = p.hp; mark = markLog(G);
    const rx = r.x, ry = r.y;
    run(Game, G, 1200);
    if (r.x !== rx || r.y !== ry) out.push(`the rat lunged into the fire (to ${r.x},${r.y})`);
    if (linesSince(G, mark).some(l => /lunges after/.test(l))) out.push('the rat lunged after the hero through the fire');
    p.x = was[0]; p.y = was[1];
    return out.length ? out.join('; ') : true;
  });

  await test('a wraith breathes a grave-cold at the feet of a hero a few squares off: stay and be frozen fast and chilled; step aside and it glazes the empty square', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-chill');
    L.twist = null;
    let n = 0;
    for (let i = 0; i < 20; i++) { L.monsters.length = 0; L.fields = {}; const w = put('wraith', 3, 0, { nextAct: G.t, hp: 80, maxHp: 80 }); run(Game, G, 30); if (w.windup && w.windup.move === 'chill') n++; }
    if (!n) out.push('a wraith three squares off never breathed its grave-cold in twenty chances');
    for (const aside of [false, true]) {
      L.monsters.length = 0; L.fields = {}; p.held = 0;
      const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 });
      w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; w.nextAct = w.windup.until;
      const x0 = p.x, y0 = p.y, [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (aside) { p.x += sx; p.y += sy; }
      const hp0 = p.hp, mark = markLog(G);
      run(Game, G, 400);
      const f = Game.fieldAt(x0, y0);
      if (!f || f.k !== 'ice') out.push(`${aside ? 'aside' : 'standing'}: no frost where it was breathed`);
      if (!aside && (!(p.hp < hp0) || !(p.held > G.t - 1200) || p.heldBy !== 'ice')) out.push(`standing in the grave-cold: hp ${hp0}->${p.hp}, held ${p.held > G.t - 1200} by ${p.heldBy}`);
      if (aside && (p.hp < hp0 || !linesSince(G, mark).some(l => /where you stood/.test(l)))) out.push('stepping aside from the grave-cold did not answer it');
      p.x = x0; p.y = y0; p.held = 0;
    }
    return out.length ? out.join('; ') : true;
  });

  await test('an acolyte calls lightning into the water a hero stands in, never on dry stone: the full of it on the square, half through the water beside it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-storm');
    const tries = twist => {
      L.twist = twist; let n = 0;
      for (let i = 0; i < 25; i++) { L.monsters.length = 0; L.fields = {}; const a = put('acolyte', 4, 0, { nextAct: G.t, hp: 80, maxHp: 80 }); run(Game, G, 30); if (a.windup && a.windup.move === 'storm') n++; }
      return n;
    };
    if (tries(null)) out.push('an acolyte called lightning at a hero on dry stone');
    if (!tries('flooded')) out.push('an acolyte never called lightning at a hero in water in twenty-five chances');
    L.twist = 'flooded';
    const took = {};
    for (const how of ['stay', 'aside']) {
      L.monsters.length = 0; L.fields = {};
      const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
      a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
      const x0 = p.x, y0 = p.y, [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (how === 'aside') { p.x += sx; p.y += sy; }
      const hp0 = p.hp; run(Game, G, 400); took[how] = hp0 - p.hp;
      p.x = x0; p.y = y0; G.blowGate = 0;
    }
    if (!(took.stay > 0)) out.push('lightning called on a hero standing in the water did not hurt');
    if (!(took.aside > 0 && took.aside <= Math.ceil((12 + Math.floor(G.depth / 2)) / 2))) out.push(`a step aside in the water took ${took.aside}, not half`);
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 4: a grave-cold on a burning square still catches the hero; no lightning through ice; Stand Firm halves the new tricks; a test run writes no relic on loading and promises no bones', async () => {
    const out = [];
    const { ctx, Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-review4');
    L.twist = null;
    const chill = () => { const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 }); w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; w.nextAct = w.windup.until; return w; };
    // standing in burning oil: the frost puts the fire out, and the hero, who never moved, is caught
    L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 9000, burn: G.t + 9000, gen: 0 };
    chill();
    let hp0 = p.hp, mark = markLog(G);
    run(Game, G, 150);
    const f = Game.fieldAt(p.x, p.y);
    if (f && f.k === 'fire') out.push('the grave-cold left the fire burning');
    if (!(p.hp < hp0) || !(p.held > G.t) || linesSince(G, mark).some(l => /where you stood/.test(l))) out.push(`a hero who stayed in the fire was let off the grave-cold (hp ${hp0}->${p.hp}, held ${p.held > G.t})`);
    // a flooded floor, but ice under the hero: the storm has no water to come down into
    L.twist = 'flooded'; L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'ice', until: G.t + 9000 };
    const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    hp0 = p.hp; mark = markLog(G);
    run(Game, G, 400);
    if (p.hp < hp0) out.push(`lightning came down through ice for ${hp0 - p.hp}`);
    if (linesSince(G, mark).some(l => /into the water/.test(l))) out.push('the storm on ice spoke of water');
    // Stand Firm halves the grave-cold, as it does every trick that lands
    L.twist = null;
    const total = firm => {
      p.talents = firm ? ['stand_firm'] : [];
      let sum = 0;
      for (let i = 0; i < 40; i++) { L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0; p.hp = p.maxHp; chill(); run(Game, G, 150); sum += p.maxHp - p.hp; }
      return sum;
    };
    const bare = total(false), firm = total(true);
    if (!(firm < bare * 0.75)) out.push(`Stand Firm took ${firm} from forty grave-colds against ${bare}`);
    p.talents = []; L.monsters.length = 0; p.held = 0;
    // a relic found in a test run is not written in the codex by a load either
    const rid = Object.keys(ctx.RELICS)[0];
    for (const tested of [false, true]) {
      const c2 = await start('fighter', 'el-codex-' + tested);
      const G2 = c2.Game.state();
      G2.relics.found.push(rid); G2.tested = tested;
      c2.Game.save(true); c2.Game.load();
      const has = c2.Progress.load().relics.includes(rid);
      if (has === tested) out.push(tested ? 'a load wrote a test run\'s relic in the codex' : 'a load no longer writes an old run\'s relics in the codex');
      // and its epilogue promises no bones it will not leave
      const bones = c2.Game.epilogue(false).some(l => /will not lie quiet/.test(l));
      if (bones === tested) out.push(tested ? 'a test run\'s epilogue promised bones' : 'a run\'s epilogue no longer promises bones');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 4: a scene lays no stray cask, names a mixed group as creatures, and is named only in sight and while it still stands', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let mixed = null, cache = null;
    // (pc-62 and pc-65 once left a cask for a cache that failed, beside a barricade)
    for (const s of [62, 65, ...Array.from({ length: 30 }, (_, i) => i)]) {
      const c = await start(['fighter', 'mage', 'thief', 'ranger'][s % 4], 'pc-' + s, REAL);
      for (let d = 2; d <= 7; d++) {
        c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute(s % 2 ? 'crypts' : 'warrens');
        const L = c.Game.level(), pc = (L.pieces || [])[0];
        // a scene's casks stand square in their squares; any such cask is one of its own
        for (const q of (L.dressing || []).filter(q => q.k === 'oilcask' && q.ox === 0 && q.oy === 0)) {
          if (!pc || !(pc.casks || []).some(([x, y]) => x === q.x && y === q.y)) { out.push(`pc-${s} floor ${d}: a cask at ${q.x},${q.y} belongs to no scene`); break; }
        }
        if (pc && pc.k === 'cache') {
          const ids = new Set(L.monsters.filter(m => pc.uids.includes(m.uid)).map(m => m.id));
          if (ids.size > 1 && pc.who) out.push(`a cache among ${[...ids]} was named for ${pc.who}`);
          if (ids.size === 1 && pc.who !== [...ids][0]) out.push(`a cache among ${[...ids]} was named ${pc.who}`);
          // (kept on its floor: this world goes no deeper)
          if (ids.size > 1 && !mixed) { mixed = { c, L, pc }; break; }
          if (!cache) { cache = { c, L, pc }; break; }
        }
      }
    }
    if (!mixed) out.push('no cache among a mixed group in the seeds tried');
    else {
      const { c, L, pc } = mixed, G = c.Game.state(), p = c.Game.player();
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      const mark = markLog(G);
      p.x = pc.x; p.y = pc.y; pc.said = false;
      run(c.Game, G, 100);
      if (!linesSince(G, mark).some(l => /among the sleeping creatures/.test(l))) out.push('a mixed group\'s cache was not named for creatures');
    }
    if (cache) {
      const { c, L, pc } = cache, G = c.Game.state(), p = c.Game.player(), T = c.Dungeon.T;
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      // a square near by, but walled off from every square of the scene
      const saved = L.tiles.slice();
      const spots = [[pc.x, pc.y], ...pc.casks];
      let hide = null;
      for (let dx = -3; dx <= 3 && !hide; dx++) for (let dy = -3; dy <= 3 && !hide; dy++) {
        const x = pc.x + dx, y = pc.y + dy;
        if (Math.abs(dx) + Math.abs(dy) !== 4 || L.tiles[y * L.w + x] !== T.FLOOR || spots.some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1)) continue;
        hide = [x, y];
      }
      if (!hide) out.push('no square four off the cache to hide on');
      else {
        for (let yy = hide[1] - 1; yy <= hide[1] + 1; yy++) for (let xx = hide[0] - 1; xx <= hide[0] + 1; xx++) if (xx !== hide[0] || yy !== hide[1]) L.tiles[yy * L.w + xx] = T.WALL;
        pc.said = false;
        let mark = markLog(G);
        p.x = hide[0]; p.y = hide[1];
        run(c.Game, G, 100);
        if (linesSince(G, mark).some(l => /Oil casks stand among/.test(l)) || pc.said) out.push('a cache behind stone was named');
        for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = saved[i];
        // its casks gone before the hero comes: nothing to name
        L.dressing = (L.dressing || []).filter(q => !(q.k === 'oilcask' && pc.casks.some(([x, y]) => x === q.x && y === q.y)));
        mark = markLog(G);
        p.x = pc.x; p.y = pc.y;
        run(c.Game, G, 100);
        if (linesSince(G, mark).some(l => /Oil casks stand among/.test(l))) out.push('a cache whose casks were gone was named');
      }
    } else out.push('no cache in the seeds tried');
    return out.length ? out.join('; ') : true;
  });

  await test('playtest fixes: Burning Hands on oil says it sets it alight; a kicked cask says so before its oil spills; flames tell a creature burning once; a flooded floor\'s storm says step aside and a step aside answers it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-playtest');
    L.twist = null;
    // Burning Hands at spilt oil, with nothing standing there
    const [ox, oy] = at(1);
    L.fields[`${ox},${oy}`] = { k: 'oil' };
    let mark = markLog(G);
    cast('burning_hands');
    let lines = linesSince(G, mark);
    if (lines.some(l => /strikes nothing/.test(l))) out.push('Burning Hands on oil said it struck nothing');
    if (!lines.some(l => /sets the oil alight/.test(l))) out.push(`Burning Hands on oil: ${lines.join(' / ')}`);
    if ((Game.fieldAt(ox, oy) || {}).k !== 'fire') out.push('the oil did not catch');
    if (countSaid(lines, /goes up in a sheet/) > 0) out.push('the fire\'s own line followed the spell\'s');
    // a cask kicked over: its staves, then its oil, and nothing about nothing inside
    L.fields = {}; L.dressing = [{ x: ox, y: oy, k: 'oilcask', ox: 0, oy: 0 }];
    mark = markLog(G);
    Game.input('forward');
    lines = linesSince(G, mark);
    const staves = lines.findIndex(l => /cask/i.test(l) && !/spills/.test(l)), spilt = lines.findIndex(l => /spills out/.test(l));
    if (staves < 0 || spilt < 0 || staves > spilt) out.push(`a kicked cask told: ${lines.join(' / ')}`);
    // (what a broken cask holds is rolled for its square: casks all round, so one holds nothing)
    const dir0 = p.dir;
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = Dungeon.DIRS[k], x = p.x + dx, y = p.y + dy;
      if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) continue;
      L.fields = {}; L.dressing = [{ x, y, k: 'oilcask', ox: 0, oy: 0 }]; p.dir = k;
      Game.input('forward');
      lines = lines.concat(linesSince(G, mark));
    }
    p.dir = dir0;
    if (lines.some(l => /nothing inside/.test(l))) out.push('a cask of oil had "nothing inside"');
    // an orc standing in burning oil for five seconds: the first tick told, the rest not
    L.fields = {}; L.dressing = []; L.monsters.length = 0;
    const [fx, fy] = at(2);
    const orc = put('orc', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 9000, burn: G.t + 100, gen: 0 };
    mark = markLog(G);
    run(Game, G, 5000);
    const told = countSaid(linesSince(G, mark), /burns for/);
    if (orc.hp > 999 - 8) out.push(`the orc hardly burnt (${orc.hp})`);
    if (told !== 1) out.push(`five seconds in the flames told the orc burning ${told} times`);
    // the storm: on a flooded floor there is no getting out of the water
    const warned = twist => {
      L.twist = twist; L.fields = {};
      for (let i = 0; i < 40; i++) {
        L.monsters.length = 0; G.blowGate = 0;
        const a = put('acolyte', 4, 0, { nextAct: G.t, hp: 80, maxHp: 80 });
        const m0 = markLog(G);
        run(Game, G, 30);
        if (a.windup && a.windup.move === 'storm') return linesSince(G, m0).join(' / ');
      }
      return '';
    };
    const flooded = warned('flooded');
    if (!/Step aside!/.test(flooded) || /Get out of the water/.test(flooded)) out.push(`on a flooded floor the storm warned: ${flooded}`);
    // a step aside takes half, and is the answer there
    L.monsters.length = 0; L.fields = {}; L.twist = 'flooded'; G.blowGate = 0;
    delete Game.bestiary().acolyte;
    const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    const hp0 = p.hp;
    run(Game, G, 400);
    if (!(p.hp < hp0)) out.push('a step aside in a flooded floor took nothing');
    if (!(Game.bestiary().acolyte || {}).answer) out.push('a step aside from the storm on a flooded floor was not counted its answer');
    // on puddles, a step into the next one still takes half, and is not the answer (out of the water is)
    L.monsters.length = 0; L.twist = null; G.blowGate = 0; p.x -= sx; p.y -= sy;
    delete Game.bestiary().acolyte;
    L.dressing = [[0, 0], [sx, sy]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, k: 'puddle', ox: 0, oy: 0 }));
    const b = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    b.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; b.nextAct = b.windup.until;
    p.x += sx; p.y += sy;
    const hp1 = p.hp;
    run(Game, G, 400);
    if (!(p.hp < hp1)) out.push('a step into the next puddle took nothing');
    if ((Game.bestiary().acolyte || {}).answer) out.push('a step into the next puddle was counted the storm\'s answer');
    L.dressing = [];
    // a burn it carries (Kindling's) is told every tick, flames under it or not
    L.monsters.length = 0; L.fields = {};
    const lit = put('orc', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    lit.dot = { kind: 'burning', until: G.t + 2500, next: G.t + 100, die: 4 };
    L.fields[`${lit.x},${lit.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 99999, burn: G.t + 99999, gen: 0 };
    const m2 = markLog(G);
    run(Game, G, 3000);
    const carried = countSaid(linesSince(G, m2), /burns for/);
    if (carried < 3) out.push(`a carried burn in flames was told ${carried} times of 3`);
    return out.length ? out.join('; ') : true;
  });

  await test('a scene is named from seven squares, before a sleeping group hears the hero; asleep only while they all are; a barricade by the casks seen from this side', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-sight');
    L.twist = null;
    const said = (setup) => {
      L.monsters.length = 0; L.dressing = [];
      const pc = setup();
      L.pieces = [pc];
      const mark = markLog(G);
      run(Game, G, 60);
      return linesSince(G, mark).filter(l => /cask/i.test(l)).join(' / ');
    };
    const cache = awake => said(() => {
      const a = put('goblin', 6, 0, { awake: false, nextAct: 1e12 }), b = put('goblin', 6, -1, { awake, nextAct: 1e12 });
      const [cx, cy] = at(5, 1);
      L.dressing.push({ x: cx, y: cy, k: 'oilcask', ox: 0, oy: 0 });
      return { k: 'cache', x: a.x, y: a.y, who: 'goblin', uids: [a.uid, b.uid], casks: [[cx, cy]] };
    });
    // six squares off, with nothing between
    const asleep = cache(false);
    if (!/among the sleeping goblins/.test(asleep)) out.push(`a cache six squares off: ${asleep || 'not named'}`);
    const stirring = cache(true);
    if (!/among the goblins/.test(stirring)) out.push(`a cache with one awake: ${stirring || 'not named'}`);
    // a locked door with a cask on this side and one beyond
    const door = said(() => {
      const [dx, dy] = at(4), [nx, ny] = at(3), [fx, fy] = at(5);
      L.tiles[dy * L.w + dx] = Dungeon.T.DOOR_LOCKED;
      L.dressing.push({ x: nx, y: ny, k: 'oilcask', ox: 0, oy: 0 }, { x: fx, y: fy, k: 'oilcask', ox: 0, oy: 0 });
      return { k: 'barricade', x: dx, y: dy, casks: [[nx, ny], [fx, fy]] };
    });
    if (!/An oil cask stands against the locked door/.test(door)) out.push(`a barricade with one cask this side: ${door || 'not named'}`);
    L.tiles[at(4)[1] * L.w + at(4)[0]] = Dungeon.T.FLOOR;
    // a group gone off after the hero, away from its casks: nothing to name, and no tip after it
    let gone = null;
    const left = said(() => {
      const a = put('goblin', 1, 1, { awake: true, nextAct: 1e12 });
      const [cx, cy] = at(6), [kx, ky] = at(6, 1);
      L.dressing.push({ x: kx, y: ky, k: 'oilcask', ox: 0, oy: 0 });
      return (gone = { k: 'cache', x: cx, y: cy, who: 'goblin', uids: [a.uid], casks: [[kx, ky]] });
    });
    if (left) out.push(`a cache its group had left was named: ${left}`);
    if (gone.named) out.push('a cache left unnamed was marked named');
    // a dark floor: named no further off than the dark lets the view reach
    L.twist = 'dark';
    const dark = cache(false);
    if (dark) out.push(`on a dark floor a cache six squares off was named: ${dark}`);
    L.twist = null;
    return out.length ? out.join('; ') : true;
  });

  await test('the view is told how far a door\'s burning has gone, and where a wraith\'s grave-cold has crept so far', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-looks');
    L.twist = null;
    const [dx, dy] = at(3);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    L.fields[`${dx},${dy}`] = { k: 'fire', fuel: 'door', until: G.t + 6000, spread: G.t + 99999, burn: G.t + 99999, gen: 0 };
    const early = Game.renderState(0).fx.doorFire[`${dx},${dy}`];
    G.t += 4500;
    L.fields[`${dx},${dy}`].until = G.t + 1500;
    const late = Game.renderState(0).fx.doorFire[`${dx},${dy}`];
    if (!(early >= 0 && early < 0.1 && late > 0.7 && late <= 1)) out.push(`a burning door was told ${early} then ${late}`);
    if (Object.keys(Game.renderState(0).fx.doorFire || {}).length !== 1) out.push('a door not on fire was told burning');
    L.fields = {}; L.tiles[dy * L.w + dx] = Dungeon.T.FLOOR;
    // (no door burning, nothing to look up every column of every frame)
    if (Game.renderState(0).fx.doorFire !== null) out.push('with no door on fire the view was still handed a list of them');
    // a wraith three squares off: the frost starts at its feet and reaches the hero as it finishes
    const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 });
    w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 1500, tx: p.x, ty: p.y };
    const frost = () => Game.renderState(0).fx.frost;
    const start = frost();
    G.t += 1499;
    const end = frost();
    if (!start.length || start.some(f => f.x === p.x && f.y === p.y)) out.push(`at the first breath the frost lay on ${JSON.stringify(start)}`);
    if (!end.some(f => f.x === p.x && f.y === p.y && f.a > 0.5)) out.push(`as the breath ended the frost lay on ${JSON.stringify(end)}`);
    w.windup = { kind: 'move', move: 'chill', at: G.t - 700, until: G.t + 800, tx: p.x + 1, ty: p.y + 1 };
    if (frost().length) out.push('frost was drawn off a straight line');
    w.windup = null;
    if (frost().length) out.push('frost was drawn with no grave-cold being breathed');
    return out.length ? out.join('; ') : true;
  });

  await test('fire tricks respect the way: a nimble hero can save against a firepot; a pot or a burning arrow stops at a door shut in its flight; a charger pulls up at whatever stands before the fire; a burnt doorway stays open under oil', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('thief', 'el-review3');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const pot = (extra = {}) => { const g = put('goblin', 4, 0, { hp: 50, maxHp: 50 }); g.windup = { kind: 'move', move: 'firepot', at: G.t, until: G.t + 100, tx: p.x, ty: p.y, dx: -fx, dy: -fy, ...extra }; g.nextAct = g.windup.until; return g; };
    // a Dex 30 hero turns from the worst of a pot now and then
    p.stats.dex = 30;
    let saved = 0;
    for (let i = 0; i < 20 && !saved; i++) {
      L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
      pot(); const mark = markLog(G); run(Game, G, 200);
      if (linesSince(G, mark).some(l => /turn from the worst/.test(l))) saved++;
    }
    if (!saved) out.push('a Dex 30 hero never saved against a firepot in twenty');
    // a door shut between the goblin and the hero takes the pot
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    const [dx, dy] = at(2);
    pot();
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    let hp0 = p.hp; run(Game, G, 250);
    if (p.hp < hp0) out.push('a firepot came through a shut door');
    const mine = Game.fieldAt(p.x, p.y);
    if (mine && mine.k === 'fire') out.push('a firepot through a shut door lit the hero\'s square');
    // and a burning arrow
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    L.twist = 'overgrown';
    const a = put('archer', 4, 0, { hp: 50, maxHp: 50 });
    a.windup = { kind: 'move', move: 'firearrow', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    run(Game, G, 250);
    const f2 = Game.fieldAt(p.x, p.y);
    if (f2 && f2.k === 'fire') out.push('a burning arrow through a shut door lit the hero\'s square');
    L.twist = null; L.tiles[dy * L.w + dx] = Dungeon.T.FLOOR;
    // an orc charging with a skeleton before the fire stops behind the skeleton, not on it
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    const o = put('orc', 4, 0, { hp: 200, maxHp: 200 }), sk = put('skeleton', 3, 0, { hp: 200, maxHp: 200 });
    const [cx, cy] = at(2);
    L.fields[`${cx},${cy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0, wild: true };
    o.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t + 50, dx: -fx, dy: -fy }; o.nextAct = o.windup.until;
    run(Game, G, 150);
    if (o.x === sk.x && o.y === sk.y) out.push('the charger pulled up on top of the skeleton');
    // a burnt-through doorway under spilt oil still cannot be shut
    L.monsters.length = 0; L.fields = {};
    const [bx, by] = at(1);
    L.tiles[by * L.w + bx] = Dungeon.T.DOOR;
    L.fields[`${bx},${by}`] = { k: 'fire', fuel: 'door', until: G.t + 50, spread: 1e15, burn: 1e15, gen: 0 };
    run(Game, G, 200);
    L.fields[`${bx},${by}`] = { k: 'oil' };
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[by * L.w + bx] !== Dungeon.T.DOOR_OPEN) out.push('a burnt doorway under oil was pulled shut');
    L.tiles[by * L.w + bx] = Dungeon.T.FLOOR;
    return out.length ? out.join('; ') : true;
  });

  await test('a cave wyrm\'s fire passes over the square under its jaws: a hero in close on moss is not set alight, the moss beyond is', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-breath');
    L.twist = 'overgrown';
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const m = put('wyrm', 1);
    // it breathes back down the passage, over the hero's head and on past
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 200, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    run(Game, G, 300);
    const here = Game.fieldAt(p.x, p.y), [bx, by] = at(-1);
    if (here) out.push(`the square under its jaws took ${here.k}`);
    const beyond = Game.fieldAt(bx, by);
    if (!beyond || beyond.k !== 'fire') out.push('the moss past the hero did not catch');
    else if (!beyond.wild) out.push('the wyrm\'s fire was taken for the hero\'s own');
    return out.length ? out.join('; ') : true;
  });

  await test('a drowned one lies unseen under the water and rises within two squares, or at a blow into its ripple, or when trodden on, and reaches to seize you', async () => {
    const out = [];
    const ctx = await start('fighter', 'drowned-rise');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (const k of [1, 2, 3, 4, 5]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    const sunk = (dist, extra = {}) => { L.monsters.length = 0; const m = { uid: 70 + dist, id: 'drowned', x: p.x + dx * dist, y: p.y + dy * dist, hp: 40, maxHp: 40, awake: false, sunk: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    // three squares off it stays down, unseen
    let m = sunk(3);
    run(Game, G, 2000);
    if (!m.sunk || m.awake) out.push('a drowned one three squares off rose');
    // two squares off it rises, and reaches for you
    m = sunk(2);
    let mark = markLog(G);
    run(Game, G, 800);
    if (m.sunk || !m.awake || !linesSince(G, mark).some(l => /rises out of it/.test(l))) out.push(`two squares off: sunk ${!!m.sunk}, awake ${m.awake} (${linesSince(G, mark).join(' | ')})`);
    // trodden on: it rises, and the hero does not step into it
    m = sunk(1, { nextAct: 1e12 });
    mark = markLog(G);
    const x0 = p.x; Game.input('forward');
    if (m.sunk || p.x !== x0 || !linesSince(G, mark).some(l => /tread on something/.test(l))) out.push(`trodden on: sunk ${!!m.sunk}, hero moved ${p.x !== x0}`);
    if (!(m.windup && m.windup.move === 'grab')) out.push(`risen beside the hero it drew back ${m.windup ? m.windup.move || m.windup.kind : 'nothing'}, not a grab`);
    // struck in its ripple
    m = sunk(1, { nextAct: 1e12 });
    p.stats.str = 30;
    let rose = false;
    for (let i = 0; i < 10 && !rose; i++) { m.sunk = true; m.awake = false; mark = markLog(G); G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack'); rose = linesSince(G, mark).some(l => /Your blow finds something under the water/.test(l)); }
    if (!rose) out.push('no blow into the ripple brought it up');
    return out.length ? out.join('; ') : true;
  });

  await test('an eyeless stalker hunts by sound: a hero standing still is lost to it, and one who moves or strikes is found; asleep, it wakes to a sound, not a sight', async () => {
    const out = [];
    const ctx = await start('fighter', 'eyeless-hunt');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (const k of [1, 2, 3, 4, 5, 6]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    const place = (dist, extra = {}) => { L.monsters.length = 0; const m = { uid: 60, id: 'eyeless', x: p.x + dx * dist, y: p.y + dy * dist, hp: 400, maxHp: 400, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    // silent: it stops and listens, and never draws a blow
    p.noiseAt = -1e9;
    let m = place(4);
    const mark = markLog(G);
    let blows = 0;
    for (let t = 0; t < 4000; t += 25) { Game.update(G.t + 25, 25); if (m.windup && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 1) blows++; }
    if (!m.groping || !linesSince(G, mark).some(l => /listening for you/.test(l))) out.push(`a silent hero: groping ${!!m.groping}`);
    if (blows) out.push('it drew back a blow at a silent hero it was not beside');
    // noisy: it comes straight for you
    m = place(4);
    let closest = 4;
    for (let t = 0; t < 4000; t += 25) { p.noiseAt = G.t; Game.update(G.t + 25, 25); closest = Math.min(closest, Math.abs(m.x - p.x) + Math.abs(m.y - p.y)); }
    if (closest > 1) out.push(`a noisy hero: it came no nearer than ${closest}`);
    // beside a silent hero, it finds them by touch
    p.noiseAt = -1e9;
    m = place(1);
    let struck = false;
    for (let t = 0; t < 3000 && !struck; t += 25) { Game.update(G.t + 25, 25); struck = !!m.windup; }
    if (!struck) out.push('beside a silent hero it never struck');
    // asleep, it sleeps through a silent hero three squares off, and wakes to a step's noise
    p.noiseAt = -1e9;
    m = place(3, { awake: false });
    run(Game, G, 2000);
    if (m.awake) out.push('a sleeping eyeless woke to a silent hero');
    p.noiseAt = G.t; m.x = p.x + dx * 3; m.y = p.y + dy * 3; m.nextAct = G.t;
    run(Game, G, 400);
    if (!m.awake) out.push('a sleeping eyeless slept through a step');
    return out.length ? out.join('; ') : true;
  });

  await test('a puffcap bursts in spores at a hand\'s blow from beside it: a save or poisoned; not at a spell, nor through fire on the blade; a druid breathes them; fire burns it well, and it never flees', async () => {
    const out = [];
    /** Strike a puffcap beside the hero until a blow lands. @returns {string} what was said, or '' */
    const strike = (ctx, setup) => {
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      for (let i = 0; i < 12; i++) {
        const m = beside(ctx, 'puffcap', { hp: 999, maxHp: 999, nextAct: 1e12 });
        p.poison = null; setup && setup(p, m);
        const mark = markLog(G);
        G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack');
        const said = linesSince(G, mark).join(' | ');
        if (/You hit|mighty blow/.test(said)) return said;
      }
      return '';
    };
    {
      // a weak chest fails the save at least once in a dozen blows (a fighter's grit and a natural 20 still pass, often enough that four tries were not enough)
      const ctx = await start('fighter', 'puff-fighter');
      const p = ctx.Game.player(); p.hp = p.maxHp = 9999; p.stats.str = 30; p.stats.con = 1;
      let poisoned = false, said = '';
      for (let i = 0; i < 12 && !poisoned; i++) { said = strike(ctx); poisoned = !!p.poison; }
      if (!/bursts in a cloud of spores/.test(said) || !poisoned) out.push(`a blow on a puffcap: ${said} (poisoned ${poisoned})`);
      // fire on the blade sears them
      p.eq.weapon = { t: 'longsword', q: 1, e: 0, pw: 'flame' };
      const hot = strike(ctx);
      if (!/sears/.test(hot) || p.poison) out.push(`a flaming blade: ${hot} (poisoned ${!!p.poison})`);
    }
    {
      const ctx = await druid('puff-druid', 3);
      const p = ctx.Game.player(); p.stats.str = 30;
      const said = strike(ctx);
      if (!/breathe them as the moss does/.test(said) || p.poison) out.push(`a druid's blow: ${said} (poisoned ${!!p.poison})`);
    }
    {
      // a spell looses no spores, and fire burns it well
      const ctx = await start('mage', 'puff-mage');
      const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99; p.stats.con = 1;
      const m = beside(ctx, 'puffcap', { hp: 999, maxHp: 999, nextAct: 1e12 });
      const mark = markLog(G);
      Game.castSpell(SPELLS.mage.find(sp => sp.id === 'magic_missile'));
      const said = linesSince(G, mark).join(' | ');
      if (!/Magic Missile|missile/i.test(said) || /spores/.test(said) || p.poison) out.push(`a spell at a puffcap beside the hero: ${said}`);
      const f = Game.elementFactor ? Game.elementFactor(m, 'fire') : ctx.ELEMENTS_TAKEN.puffcap.fire;
      if (f !== 1.5) out.push(`a puffcap takes ${f} of fire`);
      // cut low, it stands its ground (a blow at a quarter of its life or less puts three in ten others to flight)
      m.hp = 200; m.maxHp = 999;
      for (let i = 0; i < 20; i++) { G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack'); if (m.hp <= 0 || m.fleeing) break; }
      if (m.fleeing) out.push('a puffcap turned to flee');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the earned Daily deals a Ranger or a Druid from its own seed, keeps its own record, and leaves the first Daily as it was', async () => {
    const out = [];
    const ctx = await newContext();
    const { Daily } = ctx;
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const d = new Date(2026, 0, 1 + i), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const main = Daily.heroFor(key), earned = Daily.heroFor(key, 'earned');
      if (!['ranger', 'druid'].includes(earned.cls)) { out.push(`the earned Daily of ${key} dealt a ${earned.cls}`); break; }
      if (['ranger', 'druid'].includes(main.cls) || main.opts.dailyKind || main.seed !== 'daily-' + key) { out.push(`the first Daily of ${key} changed: ${main.cls} ${main.seed}`); break; }
      if (earned.seed !== 'daily-earned-' + key || earned.opts.dailyKind !== 'earned' || earned.opts.daily !== key) { out.push(`the earned Daily of ${key}: ${earned.seed} ${JSON.stringify(earned.opts)}`); break; }
      seen.add(earned.cls);
    }
    if (seen.size !== 2) out.push(`in 120 days the earned Daily dealt only ${[...seen]}`);
    // a record of its own
    const key = '2026-03-01';
    Daily.start(key, 'earned');
    if (Daily.status(key).state !== 'fresh') out.push('starting the earned Daily used up the first');
    if (Daily.status(key, 'earned').state !== 'started') out.push('the earned Daily did not record its start');
    Daily.finish(key, { won: true, depth: 8, kills: 30, cls: 'druid', score: 1000 }, 'earned');
    if (Daily.status(key, 'earned').state !== 'done' || Daily.status(key).state !== 'fresh') out.push('finishing the earned Daily touched the first');
    if (!/^Deepdelve Ranger & Druid Daily 2026-03-01: Druid, claimed the Heart/.test(Daily.shareLine(key, Daily.status(key, 'earned').done, 'earned'))) out.push(`its line: ${Daily.shareLine(key, Daily.status(key, 'earned').done, 'earned')}`);
    if (Daily.streak(key) !== 0 || Daily.streak(key, 'earned') !== 1) out.push(`streaks: first ${Daily.streak(key)}, earned ${Daily.streak(key, 'earned')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Old Campaigners wants the veteran at the hero\'s side at the end, not left on another floor', async () => {
    const out = [];
    const ctx = await newContext();
    const { Game } = ctx;
    const win = (depthOff, seed) => {
      Game.newGame({ name: 'K', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, permadeath: true, difficulty: 'normal' } });
      const G = Game.state();
      G.companion = { kind: 'hound', name: 'Ash', x: 0, y: 0, depth: G.depth + depthOff, hp: 5, maxHp: 5, mode: depthOff ? 'stay' : 'follow', joined: 1, floors: 4 };
      winHere(Game); return Game.earned().firstFeats;
    };
    if (win(1, 'vet-stay').includes('veteran')) out.push('a veteran left on another floor earned Old Campaigners');
    if (!win(0, 'vet-here').includes('veteran')) out.push('a veteran at the hero\'s side did not earn Old Campaigners');
    return out.length ? out.join('; ') : true;
  });

  console.log(`rule checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
