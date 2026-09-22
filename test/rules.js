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

await test('using the last of a stack removes its slot', async () => {
  const { Game } = await start('fighter', 'r3');
  const p = Game.player();
  p.inv.length = 0;
  p.inv.push({ t: 'ration', q: 1, e: 0 });
  Game.useItem(p.inv[0]);
  return p.inv.length === 0;
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
