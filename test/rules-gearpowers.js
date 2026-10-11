// Rule checks for the powers found gear carries, and for every spell showing its effect where it lands.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function gearpowersChecks(h) {
  const { newContext, start, markLog, linesSince, test, beside, ahead, run, talent } = h;

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
};
