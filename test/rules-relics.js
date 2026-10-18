// Rule checks for the relics: what each does worn, who may wear it, and how they are dealt.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function relicsChecks(h) {
  const { OPTS, evenStats, newContext, start, markLog, linesSince, test, wearRelic, arena, seedDice } = h;

// ---------- relics ----------
const CLASS_IDS = ['fighter', 'cleric', 'mage', 'thief'];
const foe = (id, x, y, hp = 9999) => ({ uid: 77, id, x, y, hp, maxHp: hp, awake: true, nextAct: 1e9,
  rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
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
    // every class has a few to find: the mage eight (four on robes and foci), the ranger nine
    const usable = Object.keys(RELICS).filter(id => relicUsableBy(id, cls));
    if (usable.length < 4) return `${cls} can use only ${usable.length} relics`;
    const dealt = usable.filter(id => !RELICS[id].route && !RELICS[id].twist && !RELICS[id].champion && !RELICS[id].legend && !RELICS[id].mythic);
    if ((cls === 'mage' && dealt.length < 8) || (cls === 'ranger' && dealt.length < 9)) return `a ${cls} can be dealt only ${dealt.length} relics`;
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
      if (Game.isPathOffer(Game.pendingBoons())) Game.chooseBoon(Game.pendingBoons()[0]);   // (the stair asks the path first of a hero without one)
      if (Game.forkPending()) Game.chooseRoute('crypts');
    }
  }
  if (shelved.some(([d]) => d < 2)) return 'a first floor trader sold a relic';
  const sold = shelved.map(s => s[1]);
  if (JSON.stringify(sold) !== JSON.stringify(G.relics.shop.slice(0, sold.length))) return `traders shelved ${sold}, the plan kept ${G.relics.shop}`;
  return true;
});

await test('the traders keep one relic back for the floor before last, where the gold has nowhere else to go', async () => {
  const ctx = await start('fighter', 'shelf-kept', { levels: 8 });
  const { Game } = ctx; const G = Game.state();
  if (G.relics.shop.length < 1) return 'this seed keeps no relic for the traders';
  // one relic for the traders: the second floor's trader (sure) leaves it, the seventh floor's (sure) sells it
  G.relics.shop = G.relics.shop.slice(0, 1); G.relics.offered = 0;
  const shelf = d => { Game.testFloor(d); const t = (Game.level().npcs || []).find(n => n.kind !== 'encounter' && n.stock); return t ? t.stock.filter(it => it.u).map(it => it.u) : null; };
  const two = shelf(2);
  if (!two) return 'no trader on the second floor';
  if (two.length) return `the second floor's trader sold ${two}, the one kept for the seventh`;
  const seven = shelf(7);
  if (!seven) return 'no trader on the seventh floor';
  if (seven.join() !== G.relics.shop[0]) return `the seventh floor's trader has [${seven}], not ${G.relics.shop[0]}`;
  return true;
});

await test('a mage\'s relics: the Hearthwool Robe worn and warm, Sparkglass gives a third of a killing spell back once a cast, and Galewind quickens a ranger\'s bow', async () => {
  const out = [];
  {
    const ctx = await start('mage', 'mage-relics');
    const { Game } = ctx; const p = Game.player();
    wearRelic(ctx, 'hearthwool');
    if (!p.eq.armor || p.eq.armor.u !== 'hearthwool') out.push('a mage could not wear the Hearthwool Robe');
    if (!Game.hasPower('warmth') || !Game.hasPower('mend')) out.push('the robe\'s warmth and mending were not honoured');
    // (a focus needs a free hand: the staff is put away for a dagger first)
    const dag = { t: 'dagger', q: 1, e: 0 }; p.inv.push(dag); Game.equip(dag, true);
    wearRelic(ctx, 'sparkglass');
    if (!p.eq.shield || p.eq.shield.u !== 'sparkglass') out.push('a mage could not take up Sparkglass');
  }
  {
    const { ctx, Game, p, G, put, cast } = await arena('mage', 'sparkglass');
    seedDice(ctx, 'sparkglass');
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 };
    wearRelic(ctx, 'sparkglass');
    const sp = ctx.SPELLS.mage.find(s => s.id === 'magic_missile'), cost = Game.spellCost(sp);
    // a foe that stands: nothing back
    put('goblin', 1, 0, { hp: 999, maxHp: 999 });
    p.sp = p.maxSp; cast('magic_missile');
    if (p.sp !== p.maxSp - cost) out.push(`a spell that felled nothing left ${p.sp} of ${p.maxSp} (cost ${cost})`);
    // a foe that falls: a third of the cost back, rounded up, over what a kill gives a mage anyway
    const kill = () => { G.t += 5000; Game.level().monsters.length = 0; put('goblin', 1, 0, { hp: 1, maxHp: 1 }); p.sp = p.maxSp; cast('magic_missile'); return p.sp; };
    const orb = p.eq.shield; p.eq.shield = null;
    const plain = kill();
    p.eq.shield = orb;
    const echoed = kill();
    if (echoed - plain !== Math.ceil(cost / 3)) out.push(`a killing spell gave ${echoed - plain} back, not ${Math.ceil(cost / 3)} (cost ${cost})`);
    if (!G.log.some(l => /Sparkglass gives the spell back/.test(l.m))) out.push('the log did not say the spell came back');
  }
  {
    const ctx = await start('ranger', 'galewind');
    const { Game } = ctx; const p = Game.player();
    const plain = { t: 'longbow', q: 1, e: 1 }; p.inv.push(plain); Game.equip(plain, true);
    const slow = Game.blowRate(plain);
    wearRelic(ctx, 'galewind');
    if (!(Game.blowRate(p.eq.weapon) > slow)) out.push(`Galewind looses ${Game.blowRate(p.eq.weapon)} a second against a plain bow's ${slow}`);
  }
  return out.length ? out.join('; ') : true;
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
    // a straight run of floor ahead, four squares, with the sleeper at the end of it
    const [ax, ay] = c.Dungeon.DIRS[pl.dir];
    if (![1, 2, 3, 4].every(n => { const x = pl.x + ax * n, y = pl.y + ay * n; return x > 0 && y > 0 && x < Lv.w - 1 && y < Lv.h - 1; })) return null;
    for (let n = 1; n <= 4; n++) Lv.tiles[(pl.y + ay * n) * Lv.w + pl.x + ax * n] = c.Dungeon.T.FLOOR;
    Lv.monsters.length = 0;
    const m = { ...foe('goblin', pl.x + ax * 4, pl.y + ay * 4), awake: false, nextAct: Gs.t };
    Lv.monsters.push(m);
    c.Game.update(Gs.t + 50, 50);
    return m.awake;
  };
  const plain = await asleepAt(false), muffled = await asleepAt(true);
  if (plain === null) return 'no room ahead of the hero to test stealth in';
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
};
