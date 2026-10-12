// Rule checks for curses and hidden quality, with the first playtest's fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function cursesChecks(h) {
  const { OPTS, evenStats, newContext, start, markLog, linesSince, test, beside } = h;

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

await test('every eight-floor delve has a trader on its second and seventh floors (a twelve-floor one on its fifth too), and a vigil lamp on its last', async () => {
  const ctx = await newContext();
  for (let i = 0; i < 8; i++) {
    const last = ctx.Dungeon.generate(`traders-${i}`, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
    if (!(last.npcs || []).some(n => n.kind === 'encounter' && n.id === 'vigil')) return `seed traders-${i} has no vigil lamp on its last floor`;
  }
  for (let i = 0; i < 8; i++) for (const depth of [2, 7]) {
    const L = ctx.Dungeon.generate(`traders-${i}`, depth, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
    if (!(L.npcs || []).some(n => n.kind !== 'encounter' && n.stock)) return `seed traders-${i} has no trader on floor ${depth}`;
  }
  for (let i = 0; i < 4; i++) for (const depth of [2, 5, 11]) {
    const L = ctx.Dungeon.generate(`traders-${i}`, depth, { ...OPTS, levels: 12, size: 'medium', monsters: 'normal' });
    if (!(L.npcs || []).some(n => n.kind !== 'encounter' && n.stock)) return `seed traders-${i} has no trader on floor ${depth} of 12`;
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

await test('a lesser lich, at the foot of a quick delve, calls one skeleton to guard its rite, not a wraith, one at a time', async () => {
  const ctx = await start('fighter', 'rite-quick', { levels: 2 });
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'lich', { hp: 30, maxHp: 120, phase: 2, riteReady: 0, spoke: true, awake: true, nextAct: G.t });
  for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
  if (!(m.windup && m.windup.move === 'rite')) return 'no rite began';
  const guards = () => Game.level().monsters.filter(o => o.riteCalled);
  if (Game.level().monsters.some(o => o.id === 'wraith')) return 'a wraith rose on a quick delve';
  if (guards().length !== 1 || guards()[0].id !== 'skeleton' || guards()[0].pack) return `the rite called ${JSON.stringify(guards().map(g => [g.id, g.pack && g.pack.length]))}`;
  m.windup = null; m.riteReady = 0; m.nextAct = G.t;
  for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
  return guards().length === 1 || `${guards().length} guards after a second rite with the first still standing`;
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
};
