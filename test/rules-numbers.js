// Rule checks for the run in numbers: what the end screen counts along the way.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function numbersChecks(h) {
  const { start, seedDice, markLog, timesSaid, linesSince, test, groupAhead, beside, ahead, run } = h;

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
};
