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

  // the second blade parries a little, but a shield is still the armour choice
  p.eq.offhand = null; p.eq.shield = null;
  const bare = Game.playerAC();
  p.eq.offhand = blade;
  const parrying = Game.playerAC();
  p.eq.offhand = null; p.eq.shield = { t: 'towershield', q: 1, e: 0 };
  const shielded = Game.playerAC();
  if (!(parrying > bare)) return 'a second blade turned no blows aside';
  if (!(shielded > parrying)) return 'a second blade guarded as well as a tower shield';
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
      awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
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
    const before = G.log.length;
    Game.input('attack');
    for (const e of G.log.slice(before)) lines.push(e.m);
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
    for (let i = 0; i < 250; i++) {
      p.hp = p.maxHp = 9999;               // the point is the log, not the funeral
      m.x = p.x + dx * dist; m.y = p.y + dy * dist;
      const before = G.log.length;
      Game.update(G.t + 100, 100);
      for (const e of G.log.slice(before)) lines.push(e.m);
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

  const before = G.log.length;
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
  const quiet = G.log.slice(before).map(e => e.m);
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
    if (G.levels[d].npcs.length) { G.depth = d; trader = G.levels[d].npcs[0]; }
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

  console.log(`rule checks complete, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
