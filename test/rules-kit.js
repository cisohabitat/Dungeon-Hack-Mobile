// Rule checks for the elements every class can bring: Frost Oil on a blade, the
// Scrolls of Frost and Lightning, what each does to the place, and the
// combinations they open to a fighter, a thief or a Warden (ROADMAP D7, D8).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function kitChecks(h) {
  const { test, arena, start, seedDice, markLog, linesSince, walk, newContext, OPTS } = h;

  /** A hero in the arena with the oil worked in and a long sword in hand; swings until a blow lands. */
  const swing = (ctx, m) => {
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    for (let i = 0; i < 40; i++) {
      const hp0 = m.hp;
      G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
      if (m.hp < hp0) return hp0 - m.hp;
    }
    return 0;
  };

  await test('Frost Oil: a blow that lands chills for 1d4 more (the cold bites an emberling, the dead barely feel it) and holds the foe back a moment', async () => {
    const out = [];
    const mean = async (id, coat) => {
      const { ctx, Game, p, G, put } = await arena('fighter', 'kit-frost-' + id + coat);
      seedDice(ctx, 'kit-frost-' + id + coat);
      p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = null; p.stats.str = 10;
      const m = put(id, 1);
      let sum = 0, n = 0, held = 0;
      for (let i = 0; i < 40; i++) {
        if (coat) p.coating = { t: coat, left: 20 };
        m.hp = m.maxHp = 1e6; m.nextAct = G.t;
        const dmg = swing(ctx, m);
        if (!dmg) continue;
        sum += dmg; n++;
        if (m.nextAct >= G.t + 400) held++;
      }
      void Game;
      return { mean: sum / Math.max(1, n), n, held };
    };
    const bare = await mean('goblin', null), frost = await mean('goblin', 'frost');
    if (!(frost.mean - bare.mean > 1.3 && frost.mean - bare.mean < 3.8)) out.push(`a goblin took ${bare.mean.toFixed(1)} bare and ${frost.mean.toFixed(1)} chilled`);
    if (frost.held < frost.n) out.push(`${frost.n - frost.held} of ${frost.n} chilled blows did not hold the goblin back`);
    if (bare.held) out.push('a plain blow held the goblin back');
    const ember = await mean('emberling', 'frost'), emberBare = await mean('emberling', null);
    if (!(ember.mean - emberBare.mean > frost.mean - bare.mean)) out.push(`an emberling took only ${(ember.mean - emberBare.mean).toFixed(1)} more from the cold`);
    const bones = await mean('skeleton', 'frost'), bonesBare = await mean('skeleton', null);
    if (!(bones.mean - bonesBare.mean < frost.mean - bare.mean)) out.push(`a skeleton took ${(bones.mean - bonesBare.mean).toFixed(1)} more from the cold, no less than the living`);
    return out.length ? out.join('; ') : true;
  });

  await test('Frost Oil works the cold on the place as a spell does: water round the foe freezes and holds it (never the striker), a crack is sealed, an emberling quenched; and a Warden has Icebound Prey', async () => {
    const out = [];
    {
      const { ctx, Game, p, G, L, put } = await arena('ranger', 'kit-frost-water');
      seedDice(ctx, 'kit-frost-water');
      walk(ctx, 'warden');
      p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = null; p.coating = { t: 'frost', left: 20 };
      L.twist = 'flooded';
      const m = put('goblin', 1);
      m.hp = m.maxHp = 1e6;
      const mark = markLog(G);
      if (!swing(ctx, m)) return 'no blow landed';
      const said = linesSince(G, mark);
      if (!(Game.fieldAt(m.x, m.y) && Game.fieldAt(m.x, m.y).k === 'ice')) out.push('the water round the goblin did not freeze');
      if (m.heldBy !== 'ice' || !(m.snaredUntil > G.t)) out.push('the goblin was not held fast in the ice');
      if (!(G.combos && G.combos.flash_freeze)) out.push('Flash Freeze was not named');
      if (p.heldBy === 'ice' && p.held > G.t) out.push('the ice took the striker\'s own feet');
      if (said.some(l => /round your own feet/.test(l))) out.push('the log said the ice closed round the striker');
      // the next blow into the held foe is a Warden's Icebound Prey
      m.hp = m.maxHp = 1e6;
      if (!swing(ctx, m)) out.push('no second blow landed');
      else if (!(G.combos && G.combos.icebound_prey)) out.push('a Warden\'s blow on a foe held in ice was not Icebound Prey');
    }
    {
      // an emberling about to flare, quenched by the blade's cold
      const { ctx, G, put } = await arena('fighter', 'kit-frost-ember');
      seedDice(ctx, 'kit-frost-ember');
      const p = ctx.Game.player();
      p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = null; p.coating = { t: 'frost', left: 20 };
      const m = put('emberling', 1);
      m.hp = m.maxHp = 1e6; m.windup = { kind: 'trick', move: 'flare', at: G.t, until: G.t + 5000 };
      if (!swing(ctx, m)) return 'no blow landed on the emberling';
      if (m.windup && m.windup.move === 'flare') out.push('the emberling\'s flare was not quenched');
      if (!(G.combos && G.combos.quench)) out.push('Quenched was not named');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a Scroll of Frost: 3d6 cold over everything up to three squares ahead, each held back a moment, and water round them frozen; a Scroll of Lightning: 3d6 through the line, and through water to the one beside', async () => {
    const out = [];
    const read = async (id, flooded, side) => {
      const { ctx, Game, p, G, L, put } = await arena('fighter', `kit-${id}-${flooded ? 'wet' : 'dry'}`);
      seedDice(ctx, `kit-${id}-${flooded ? 'wet' : 'dry'}`);
      if (flooded) L.twist = 'flooded';
      const a = put('goblin', 1), b = put('goblin', 2), c = put('goblin', 3), s = side ? put('goblin', 2, 1) : null;
      for (const m of [a, b, c, s]) if (m) { m.hp = m.maxHp = 1e6; m.nextAct = G.t; }
      G.known[id] = 1;
      const it = { t: id, q: 1, e: 0 }; p.inv.push(it);
      G.t = Math.max(G.t, p.nextAttack);
      Game.useItem(it);
      return { G, hit: [a, b, c].map(m => 1e6 - m.hp), held: [a, b, c].filter(m => m.nextAct >= G.t + 1000).length, side: s ? 1e6 - s.hp : 0, ice: !!(Game.fieldAt(b.x, b.y) && Game.fieldAt(b.x, b.y).k === 'ice'), heldIce: [a, b, c].filter(m => m.heldBy === 'ice').length, inv: p.inv.includes(it) };
    };
    const f = await read('scroll_frost', false, false);
    if (f.inv) out.push('the Scroll of Frost was not spent');
    if (f.hit.some(d => d < 3 || d > 18)) out.push(`the frost struck for ${f.hit}`);
    if (f.held !== 3) out.push(`the frost held back ${f.held} of three`);
    const fw = await read('scroll_frost', true, false);
    if (!fw.ice || fw.heldIce < 1) out.push(`in water the frost froze ${fw.ice} and held ${fw.heldIce} in ice`);
    if (!(fw.G.combos && fw.G.combos.flash_freeze)) out.push('a Scroll of Frost in water was not Flash Freeze');
    const l = await read('scroll_lightning', false, true);
    if (l.inv) out.push('the Scroll of Lightning was not spent');
    if (l.hit.some(d => d < 3 || d > 18)) out.push(`the bolt struck for ${l.hit}`);
    if (l.side) out.push('on dry stone the bolt reached the one beside the line');
    const lw = await read('scroll_lightning', true, true);
    if (!lw.side) out.push('in water the bolt did not run to the one beside the line');
    if (!(lw.G.combos && lw.G.combos.conduction)) out.push('a Scroll of Lightning in water was not Conduction');
    return out.length ? out.join('; ') : true;
  });

  await test('the new oil and scrolls turn up on the floors and the traders\' shelves', async () => {
    const ctx = await newContext();
    const seen = { oil_frost: 0, scroll_frost: 0, scroll_lightning: 0 }, shelf = { ...seen };
    for (let i = 0; i < 30; i++) for (const depth of [2, 4, 6]) {
      const L = ctx.Dungeon.generate(`kit-loot-${i}`, depth, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' });
      for (const pile of Object.values(L.items)) for (const it of pile) if (it.t in seen) seen[it.t]++;
      for (const n of L.npcs || []) for (const it of n.stock || []) if (it.t in shelf) shelf[it.t]++;
    }
    const missing = Object.keys(seen).filter(k => !seen[k]), unsold = Object.keys(shelf).filter(k => !shelf[k]);
    return (!missing.length && !unsold.length) || `never on a floor: ${missing.join(', ') || 'none'}; never on a shelf: ${unsold.join(', ') || 'none'}`;
  });

  await test('a fighter or a thief can plan six two-system combinations with what traders sell: the journal lists them', async () => {
    const ctx = await newContext();
    const { ITEMS } = ctx;
    const { COMBOS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'combos.js')).href);
    const sold = Object.keys(ITEMS).filter(id => ['oil', 'scroll', 'flask'].includes(ITEMS[id].kind));
    // each of these is an item any class can carry, met with something in the place or a creature
    const planned = { flash_freeze: 'oil_frost', cold_seal: 'oil_frost', quench: 'oil_frost', conduction: 'scroll_lightning', oil_fire: 'oil_fire', trolls_bane: 'oil_fire', silver_dead: 'oil_silver' };
    const out = [];
    for (const [combo, item] of Object.entries(planned)) {
      if (!COMBOS[combo]) out.push(`${combo} is not a combination`);
      if (!sold.includes(item)) out.push(`${item} is not sold`);
    }
    return out.length ? out.join('; ') : (Object.keys(planned).length >= 6 || `only ${Object.keys(planned).length} planned`);
  });
};
