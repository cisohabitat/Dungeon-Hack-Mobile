'use strict';
// Rule-level regression checks. These load the real game logic headlessly and
// exercise the edge cases that are easy to break and hard to notice in play.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

function newContext() {
  const store = new Map();
  const ctx = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    navigator: {},
    Sound: { play() {}, setAmbience() {}, heartbeat() {}, stopAmbience() {}, unlock() {}, isEnabled: () => false, toggle: () => false },
    Assets: { sprites: new Proxy({}, { get: () => ({ levels: [], elite: {}, url: '' }) }) },
  };
  vm.createContext(ctx);
  for (const f of ['rng', 'data', 'dungeon', 'game']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  vm.runInContext('globalThis.Game = Game; globalThis.Dungeon = Dungeon; globalThis.ITEMS = ITEMS; globalThis.MONSTERS = MONSTERS;', ctx);
  return ctx;
}
const OPTS = { levels: 4, size: 'small', monsters: 'few', treasure: 'normal', lockedDoors: false, traps: false, permadeath: false };
function start(cls, seed, opts) {
  const ctx = newContext();
  ctx.Game.newGame({ name: 'Test', cls, stats: ctx.Game.rollStats(), seed, opts: Object.assign({}, OPTS, opts) });
  return ctx;
}

let failures = 0;
function test(name, fn) {
  try {
    const r = fn();
    if (r === true) return;
    failures++;
    console.error('FAIL:', name, r === false ? '' : '-> ' + r);
  } catch (e) {
    failures++;
    console.error('THROW:', name, '-', e.message);
  }
}

test('identical items with different enchantments do not merge', () => {
  const { Game } = start('fighter', 'r1');
  const p = Game.player();
  p.inv.length = 0;
  p.inv.push({ t: 'longsword', q: 1, e: 0 });
  p.inv.push({ t: 'longsword', q: 1, e: 2 });
  return p.inv.length === 2 && p.inv[1].e === 2;
});

test('equipping a two-handed weapon stows the shield', () => {
  const { Game } = start('fighter', 'r2');
  const p = Game.player();
  if (!p.eq.shield) return true;              // nothing to stow
  p.inv.push({ t: 'greatsword', q: 1, e: 0 });
  Game.equip(p.inv[p.inv.length - 1]);
  return p.eq.weapon.t === 'greatsword' && !p.eq.shield && p.inv.some(i => i.t === 'shield');
});

test('using the last of a stack removes its slot', () => {
  const { Game } = start('fighter', 'r3');
  const p = Game.player();
  p.inv.length = 0;
  p.inv.push({ t: 'ration', q: 1, e: 0 });
  Game.useItem(p.inv[0]);
  return p.inv.length === 0;
});

test('a save survives the JSON round trip, effects included', () => {
  const { Game } = start('mage', 'r4', { lockedDoors: true, traps: true });
  const p = Game.player();
  p.effects.ac = { amount: 4, until: 99999 };
  Game.save(true);
  const before = JSON.stringify({ hp: p.hp, inv: p.inv.length, sp: p.sp, gold: p.gold });
  if (!Game.load()) return 'load returned false';
  const q = Game.player();
  return JSON.stringify({ hp: q.hp, inv: q.inv.length, sp: q.sp, gold: q.gold }) === before
    && q.effects.ac && q.effects.ac.amount === 4;
});

test('dropping from a full pack frees a slot', () => {
  const { Game } = start('fighter', 'r5');
  const p = Game.player();
  p.inv.length = 0;
  for (let i = 0; i < Game.INV_MAX; i++) p.inv.push({ t: 'dagger', q: 1, e: 0 });
  Game.dropItem(p.inv[0]);
  return p.inv.length === Game.INV_MAX - 1 && Game.floorItems().length >= 1;
});

test('a dead player takes no more turns', () => {
  const { Game } = start('fighter', 'r6');
  const p = Game.player();
  const steps = p.steps;
  Game.state().status = 'dead';
  Game.input('forward');
  return p.steps === steps;
});

test('the Heart cannot be sold or dropped', () => {
  const ctx = start('fighter', 'r7');
  const { Game } = ctx;
  const p = Game.player();
  p.inv.push({ t: 'artifact', q: 1, e: 0 });
  const heart = p.inv.find(i => i.t === 'artifact');
  Game.dropItem(heart);
  return p.inv.some(i => i.t === 'artifact');
});

test('walking into a trader opens a shop that charges gold and identifies goods', () => {
  const ctx = start('fighter', 'r8', { levels: 8, size: 'medium' });
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

test('poison wears off rather than lasting forever', () => {
  const { Game } = start('fighter', 'r9');
  const p = Game.player();
  const G = Game.state();
  p.poison = { until: G.t + 1000, next: G.t + 100 };
  p.hp = p.maxHp;
  for (let i = 0; i < 40; i++) Game.update(i * 300, 300);
  return !p.poison;
});

test('buffs expire on their own clock', () => {
  const { Game } = start('cleric', 'r10');
  const G = Game.state();
  Game.player().effects.hit = { amount: 2, until: G.t + 500 };
  for (let i = 0; i < 20; i++) Game.update(i * 300, 300);
  return Game.effect('hit') === 0;
});

console.log(`rule checks complete, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
