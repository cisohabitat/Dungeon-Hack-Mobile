// Rule checks for oils and coatings on a blade.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function oilsChecks(h) {
  const { start, seedDice, markLog, linesSince, test, beside, shopAhead, takeJob, downOne, meetAndChoose } = h;

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
};
