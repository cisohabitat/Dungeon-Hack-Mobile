// Rule checks for the lizardfolk's marsh.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function marshChecks(h) {
  const { newContext, start, markLog, linesSince, test, beside, clearBehind, untilTrick, arena } = h;

  // ---------- the lizardfolk's marsh ----------
  await test('the fifth floor of a sixteen-floor delve is the lizardfolk\'s marsh: their people, their Marsh-Mother, their eggs, water in every room; a rest there is broken by them', async () => {
    const out = [];
    const { Dungeon } = await newContext();
    for (let i = 0; i < 200; i++) {
      if (Dungeon.twistPlan('lz' + i, 16)[5]) { out.push('the marsh was twisted'); break; }
      if (Dungeon.namedPlan('lz' + i, 16)[5] !== 'hissra') { out.push('the marsh was not the Marsh-Mother\'s'); break; }
    }
    for (let s = 0; s < 4; s++) {
      const L = Dungeon.generate('lz' + s, 5, { levels: 16, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
      if (!(L.npcs || []).some(n => n.kind === 'encounter' && n.id === 'egg_clutch')) out.push(`lz${s}: no eggs in the marsh`);
    }
    // nobody lives there but them, mimics in the barrels included, whatever the seed
    for (let s = 0; s < 8; s++) {
      const c = await start('fighter', 'marshonly' + s, { levels: 16, size: 'medium', monsters: 'normal' });
      c.Game.testFloor(5);
      const odd = c.Game.level().monsters.map(m => m.id).filter(id => !/^(lizardfolk|lizard_shaman|hissra)$/.test(id));
      if (odd.length) { out.push(`marshonly${s}: ${odd.join()} in the marsh`); break; }
    }
    const ctx = await start('fighter', 'marshrest', { levels: 16, size: 'medium', monsters: 'normal' });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    Game.testFloor(5);
    const L = Game.level(), kinds = new Set();
    // the hero stands in water somewhere in its rooms
    if (!L.dressing.some(d => d.k === 'puddle' && Game.wet(d.x, d.y))) out.push('no standing water in the marsh is wet');
    for (let i = 0; i < 30; i++) {
      L.monsters.length = 0; L.rests = 1; p.hp = 1; p.food = 100;
      G.t += 60000;
      Game.input('rest');
      for (const mm of L.monsters) kinds.add(mm.id);
    }
    if (!kinds.size) out.push('thirty rests in the marsh and nothing came');
    if ([...kinds].some(id => !/^(lizardfolk|lizard_shaman)$/.test(id))) out.push(`a rest in the marsh was broken by ${[...kinds].join(', ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a lizardfolk warrior coils its tail to sweep the legs: one who stays is struck and maybe knocked flat; one who steps back leaves it lashing air, wide open', async () => {
    const out = [];
    let downed = false, struck = false;
    for (let t = 0; t < 8; t++) {
      const ctx = await start('fighter', 'sweep-stay' + t);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.stats.dex = 3;
      const m = beside(ctx, 'lizardfolk', { blows: 1 });
      if (!untilTrick(ctx, m, 'sweep')) return 'the warrior never coiled its tail';
      const hp0 = p.hp, mark = markLog(G);
      for (let i = 0; i < 60 && m.windup && m.windup.move === 'sweep'; i++) Game.update(G.t + 25, 25);
      const said = linesSince(G, mark).join(' | ');
      if (p.hp < hp0 && /sweeps its tail into/.test(said)) struck = true;
      // a blow and a half is still a whole number of hurt
      if (!Number.isInteger(p.hp)) out.push(`the sweep left the hero on ${p.hp} hit points`);
      if (p.heldBy === 'down' && p.held > G.t) downed = true;
    }
    if (!struck) out.push('standing, the sweep never struck');
    if (!downed) out.push('standing, the sweep never knocked the hero flat in eight tries');
    {
      const ctx = await start('fighter', 'sweep-back');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999;
      clearBehind(ctx);
      const m = beside(ctx, 'lizardfolk', { blows: 1 });
      if (!untilTrick(ctx, m, 'sweep')) return 'the warrior never coiled its tail';
      Game.input('back');
      const hp0 = p.hp, mark = markLog(G);
      for (let i = 0; i < 60 && m.windup && m.windup.move === 'sweep'; i++) Game.update(G.t + 25, 25);
      if (p.hp < hp0 || !linesSince(G, mark).some(l => /lashes the empty air/.test(l)) || !(p.opening && p.opening.uid === m.uid)) out.push(`stepped back: ${linesSince(G, mark).join(' | ')}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a lizardfolk shaman calls lightning down into the water a hero stands in; a warrior leaves marsh-hide now and then, a shaman a fang charm, and Hissra her tooth once, beyond the Collector\'s count', async () => {
    const out = [];
    {
      const { Game, G, L, p, put, at } = await arena('fighter', 'marsh-storm');
      p.hp = p.maxHp = 9999;
      L.dressing = [{ x: p.x, y: p.y, k: 'puddle', ox: 0, oy: 0, r: 0.34 }];
      const m = put('lizard_shaman', 3, 0, { nextAct: G.t, blows: 0 });
      if (!untilTrick({ Game }, m, 'storm')) out.push('a shaman never called lightning into the water the hero stood in');
    }
    const ctx = await start('fighter', 'marsh-loot', { levels: 16 });
    const { Game, ITEMS, RELICS, Progress } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const kills = (id, n) => {
      const got = {};
      for (let i = 0; i < n; i++) {
        const m = beside(ctx, id, { hp: 1, maxHp: 1, nextAct: 1e12 });
        for (let t = 0; t < 40 && Game.level().monsters.includes(m); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
        const k = `${m.x},${m.y}`;
        for (const it of Game.level().items[k] || []) got[it.u || it.t] = (got[it.u || it.t] || 0) + 1;
        delete Game.level().items[k];
      }
      return got;
    };
    const w = kills('lizardfolk', 80), sh = kills('lizard_shaman', 60);
    if (!((w.marshhide || 0) >= 1 && (w.marshhide || 0) < 24)) out.push(`80 warriors left ${w.marshhide || 0} marsh-hide`);
    if (!((sh.charm_fang || 0) >= 1 && (sh.charm_fang || 0) < 28)) out.push(`60 shamans left ${sh.charm_fang || 0} fang charms`);
    if (kills('hissra', 1).hissra_tooth !== 1) out.push('Hissra did not drop her tooth');
    G.relics.found.push('hissra_tooth');
    if (kills('hissra', 1).hissra_tooth) out.push('a second tooth fell, the first already found');
    if (!RELICS.hissra_tooth.beyond || ITEMS.amulet_tooth.tier < 50 || ITEMS.marshhide.tier < 50) out.push('the marsh\'s loot is ordinary, or the tooth counts toward the Collector');
    return out.length ? out.join('; ') : true;
  });
};
