// Rule checks for the goblin, the sellsword and the healer: the other companions (companion.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function companionsChecks(h) {
  const { evenStats, start, seedDice, seedAll, markLog, countSaid, rollsOn, linesSince, test, beside, run, talent, lichRoom, meetAndChoose, withHound, clearAround, bareFloor, dig } = h;

  // ---------- the goblin, the other companion ----------
  /** Let the caged goblin out (the bars are wrenched until they give: a check, retried). */
  const withGoblin = async (seed, opts = {}) => {
    const ctx = await start('fighter', seed, { levels: 8, ...opts });
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999; p.stats.str = 18;
    for (let i = 0; i < 30 && !Game.companion(); i++) { meetAndChoose(ctx, 'caged', 0); Game.closeEncounter(); }
    return ctx;
  };

  // a sellsword hired on a middle floor, the hero made sturdy and rich enough to hire
  const withSellsword = async (seed, opts = {}) => {
    const ctx = await start('fighter', seed, { levels: 8, ...opts });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    p.gold = 1000;
    meetAndChoose(ctx, 'hire', 0); Game.closeEncounter();
    return ctx;
  };

  await test('a sellsword for hire: paid, they follow; haggled, half or nothing; with a companion already at your side the hiring is not on offer', async () => {
    const out = [];
    {
      const ctx = await withSellsword('sell-pay');
      const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c || c.kind !== 'sellsword') return `no sellsword followed: ${JSON.stringify(c)}`;
      if (p.gold !== 1000 - 20 * G.depth) out.push(`hiring cost ${1000 - p.gold}, not ${20 * G.depth}`);
      // tougher than a hound
      if (c.maxHp < 14 + 5 * p.level) out.push(`a sellsword has ${c.maxHp} hit points`);
      if (!Game.threadNotes().some(n => n.includes(c.name) && /sellsword/.test(n))) out.push('the hero sheet does not name the sellsword');
      // one at a time: with them at your side, neither hiring is on offer, but the talk is
      p.gold = 1000;
      const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'hire', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      Game.input('use');
      const o = Game.encounterOptions();
      if (!o[0].blocked || !o[1].blocked || o[2].blocked) out.push(`with a companion, the choices were blocked ${o.map(x => !!x.blocked)}`);
      if (Game.chooseEncounter(0) || p.gold !== 1000) out.push('a second sellsword was paid for');
      Game.closeEncounter();
    }
    // haggled by a silver tongue: half
    {
      const ctx = await start('fighter', 'sell-haggle', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 30;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { p.gold = 1000; r = meetAndChoose(ctx, 'hire', 1); Game.closeEncounter(); }
      if (!r.check.pass) out.push('a silver tongue never haggled');
      else {
        if (p.gold !== 1000 - 10 * G.depth) out.push(`haggled, the sellsword cost ${1000 - p.gold}, not ${10 * G.depth}`);
        if (!Game.companion() || Game.companion().kind !== 'sellsword') out.push('haggled down, the sellsword did not follow');
      }
    }
    // haggled badly: the coin comes back, and so does nobody (exactly the coin: a Trickster's purse finds no more in it)
    {
      const ctx = await start('thief', 'sell-haggle-fail', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.path = 'trickster'; p.hp = p.maxHp = 9999;
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 1;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && !r.check.pass); i++) { p.gold = 1000; G.companion = null; r = meetAndChoose(ctx, 'hire', 1); Game.closeEncounter(); }
      if (r.check.pass) out.push('a churl haggled six times running');
      else {
        if (p.gold !== 1000) out.push(`a failed haggle cost ${1000 - p.gold}`);
        if (Game.companion()) out.push('a failed haggle still hired the sellsword');
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a sellsword cuts what stands beside them; blooded, they guard you (one blow in three from a foe beside them both); a veteran, they find a second wind once a floor', async () => {
    const out = [];
    const ctx = await withSellsword('sell-guard');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 7; c.y = 7; c.mode = 'stay';
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    // an orc beside them both, swinging at the hero
    const orc = () => { L.monsters.length = 0; L.monsters.push({ uid: 91, id: 'orc', x: 7, y: 6, hp: 99999, maxHp: 99999, awake: true, nextAct: G.t, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 }); };
    const guarded = ms => { const mark = markLog(G); orc(); c.hp = c.maxHp = 9999; p.hp = 9999; run(Game, G, ms); L.monsters.length = 0; return { took: countSaid(linesSince(G, mark), /steps into the blow meant for you/), hit: countSaid(linesSince(G, mark), /hits you/) }; };
    // it cuts, slowly: about one blow in 1.3 seconds
    {
      // (each swing, landed or not, is a lunge: about ten in thirteen seconds; a run of
      // misses can still leave the orc nearly whole, so it gets three tries)
      let cut = false, dealt = 0;
      for (let tries = 0; tries < 3 && dealt < 10; tries++) {
        const mark = markLog(G); orc(); c.hp = c.maxHp = 9999; L.monsters[0].nextAct = 1e12;
        run(Game, G, 13000);
        cut = cut || !!countSaid(linesSince(G, mark), new RegExp(`${c.name} cuts the`));
        dealt = 99999 - L.monsters[0].hp;
      }
      if (!cut) out.push('the sellsword never cut the orc');
      if (dealt < 10) out.push('the sellsword\'s cuts did almost nothing');
      L.monsters.length = 0;
    }
    // not yet blooded: it takes nothing for you
    c.floors = 0;
    let g = guarded(20000);
    if (g.took) out.push(`not yet blooded, the sellsword took ${g.took} blows for you`);
    // blooded: about one landed blow in three
    c.floors = 2;
    g = guarded(60000);
    const share = g.took / Math.max(1, g.took + g.hit);
    if (g.took + g.hit < 15 || share < 0.15 || share > 0.55) out.push(`blooded, the sellsword took ${g.took} of ${g.took + g.hit} blows`);
    // not beside the orc: it cannot step in
    c.x = 5; c.y = 6;
    g = guarded(20000);
    if (g.took) out.push(`from across the hero, the sellsword took ${g.took} blows`);
    // the hero sheet counts the blows taken
    if (!Game.threadNotes().some(n => /blows? taken for you/.test(n))) out.push('the hero sheet does not count the blows the sellsword took');
    // a veteran: once a floor, the blow that should fell them leaves them at half
    c.floors = 4; c.x = 7; c.y = 7; c.hp = 1; c.maxHp = 40;
    L.twist = 'tremors';
    L.quake = { next: G.t + 1e9, falls: [{ x: c.x, y: c.y, at: G.t, lands: G.t + 100 }] };
    let mark = markLog(G);
    run(Game, G, 200);
    if (c.fallen || c.hp !== 20) out.push(`a veteran under falling rock ${c.fallen ? 'fell' : `stood at ${c.hp}`}, not at half`);
    if (!linesSince(G, mark).some(l => /second wind/.test(l))) out.push('the second wind was not told');
    // and only once a floor
    c.hp = 1;
    L.quake.falls = [{ x: c.x, y: c.y, at: G.t, lands: G.t + 100 }];
    run(Game, G, 200);
    if (!c.fallen) out.push('a second second wind on the same floor');
    return out.length ? out.join('; ') : true;
  });

  /** A trader in front of the hero, the companion moved out of the way, and the shop opened. */
  const shopWith = (ctx, shop) => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), c = Game.companion();
    L.npcs = [shop]; L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR;
    if (c && c.x === shop.x && c.y === shop.y) { c.x = p.x - dx; c.y = p.y - dy; }
    Game.input('forward');
    return !!Game.currentShop();
  };
  /** A companion beside a foe stood in front of the hero, and not beside the hero. */
  const besideFoe = (ctx, c, m) => {
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
    const spot = Dungeon.DIRS.map(([dx, dy]) => [m.x + dx, m.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1);
    L.tiles[spot[1] * L.w + spot[0]] = Dungeon.T.FLOOR;
    c.x = spot[0]; c.y = spot[1]; c.depth = Game.state().depth; c.mode = 'stay';
  };

  await test('a trader brings out a whetstone for a sellsword, once; worn, it adds three to every cut; a hound has no use for it', async () => {
    const out = [];
    const ctx = await withSellsword('sell-whet');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
    let mark = markLog(G);
    if (!shopWith(ctx, shop)) return 'could not open the shop';
    const whets = () => shop.stock.filter(s => s.t === 'charm_whetstone').reduce((a, s) => a + s.q, 0);
    if (whets() !== 1) out.push(`with a sellsword at heel the shelf held ${whets()} whetstones`);
    if (!linesSince(G, mark).some(l => /brings a whetstone out/.test(l))) out.push('the whetstone was brought out unsaid');
    Game.closeShop();
    shopWith(ctx, shop);
    if (whets() !== 1) out.push(`opened again, the shelf held ${whets()} whetstones`);
    Game.closeShop();
    // a hound's trader keeps it under the counter
    {
      const h = await withHound('whet-hound');
      const shop2 = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      shopWith(h, shop2);
      if (shop2.stock.some(s => s.t === 'charm_whetstone')) out.push('a trader brought out a whetstone for a hound');
      // nor will a hound wear one
      const it = { t: 'charm_whetstone', q: 1, e: 0 };
      h.Game.closeShop();
      h.Game.player().inv.push(it);
      const why = h.Game.giveCharm(it);
      if (!why || h.Game.companion().charm || !h.Game.player().inv.includes(it)) out.push(`a hound took the whetstone (${why})`);
    }
    // worn: three more a cut, the same swings
    const cuts = async charm => {
      const b = await withSellsword('whet-cuts-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); seedDice(b, 'whet-cuts');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 96, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let total = 0, n = 0;
      for (let i = 0; i < 24000 && n < 150; i++) { const hp = m.hp; b.Game.update(G2.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      return total / Math.max(1, n);
    };
    const plain = await cuts(undefined), keen = await cuts('charm_whetstone');
    if (!(keen - plain > 2.5 && keen - plain < 3.5)) out.push(`the whetstone: ${plain.toFixed(2)} -> ${keen.toFixed(2)} a cut`);
    return out.length ? out.join('; ') : true;
  });

  await test('below the eighth floor of a Long Delve a sellsword wants a wage at each new floor; unpaid, they will not guard, and take it once there is gold', async () => {
    const out = [];
    const ctx = await withSellsword('sell-wage', { levels: 12 });
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no sellsword';
    const down = () => { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); };
    while (G.depth < 7) down();
    // to the eighth: no wage yet
    p.gold = 1000; let mark = markLog(G);
    down();
    if (G.depth !== 8 || c.depth !== 8) return `went down to ${G.depth}, the sellsword on ${c.depth}`;
    if (p.gold !== 1000 || c.wages) out.push(`on the eighth floor the sellsword took ${1000 - p.gold}`);
    // the ninth: four gold a floor down, paid
    down();
    if (p.gold !== 1000 - 36) out.push(`on the ninth the wage was ${1000 - p.gold}, not 36`);
    if (!linesSince(G, mark).some(l => /holds out a hand/.test(l) && l.includes(c.name))) out.push('the wage was taken unsaid');
    // (and said after the floor is, so the floor's own words do not push it out of sight)
    { const ls = linesSince(G, mark), at = re => ls.findIndex(l => re.test(l));
      if (at(/holds out a hand/) < at(/You descend to floor 9/)) out.push(`the wage was asked before the floor was told: ${ls.join(' | ')}`); }
    // the tenth, with ten gold: owed, and said so
    p.gold = 10; mark = markLog(G);
    down();
    if (p.gold !== 10 || c.unpaid !== 40) out.push(`with ten gold on the tenth: ${p.gold} gold left, ${c.unpaid} owed`);
    if (!linesSince(G, mark).some(l => /will not step into a blow for you until paid/.test(l))) out.push('the unpaid wage was not told');
    if (!Game.threadNotes().some(n => /owed 40 gold/.test(n))) out.push('the hero sheet does not say what is owed');
    // owed, a veteran will not guard
    c.floors = 4;
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 7; c.y = 7; c.mode = 'stay';
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3; p.hp = p.maxHp = 9999;
    const guarded = ms => {
      const m = markLog(G);
      L.monsters.length = 0; L.monsters.push({ uid: 92, id: 'orc', x: 7, y: 6, hp: 99999, maxHp: 99999, awake: true, nextAct: G.t, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
      c.hp = c.maxHp = 9999; p.hp = 9999; run(Game, G, ms); L.monsters.length = 0;
      return countSaid(linesSince(G, m), /steps into the blow meant for you/);
    };
    const owed = guarded(40000);
    if (owed) out.push(`owed a wage, the sellsword took ${owed} blows for you`);
    // gold comes: the wage is taken, and the guarding starts again
    p.gold = 100; mark = markLog(G);
    run(Game, G, 2000);
    if (p.gold !== 60 || c.unpaid) out.push(`with a hundred gold: ${p.gold} left, ${c.unpaid} owed`);
    if (!linesSince(G, mark).some(l => /You pay .* the 40 gold owed/.test(l))) out.push('the paying was not told');
    if (!guarded(40000)) out.push('paid, the sellsword still would not guard');
    return out.length ? out.join('; ') : true;
  });

  await test('once in a boss fight a sellsword\'s cut breaks the Warlord\'s drumbeat or the lich\'s rite; a second time it does not, and a hound\'s bite never does', async () => {
    const out = [];
    /** A sellsword (or the hound) beside a boss gathering itself, the hero idle: what was said while it gathered. */
    const gather = async (seed, kind, boss) => {
      const ctx = kind === 'hound' ? await withHound(seed) : await withSellsword(seed);
      const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c) return { err: `no ${kind}` };
      clearAround(ctx, 5);
      p.hp = p.maxHp = 9999; p.level = 30;   // (a sure hand: the companion's aim grows with the hero)
      const m = boss === 'warlord' ? beside(ctx, 'warlord', { blows: 2, hp: 4000, maxHp: 4000 }) : lichRoom(ctx, { phase: 2, hp: 300, maxHp: 4000, riteReady: 0, nextAct: G.t, awake: true }).m;
      besideFoe(ctx, c, m); c.hp = c.maxHp = 9999; c.nextAct = 1e12;
      const move = boss === 'warlord' ? 'drum' : 'rite';
      const said = [];
      for (let round = 0; round < 2; round++) {
        if (boss === 'warlord') { m.blows = 2; m.moveReady = 0; } else m.riteReady = 0;
        m.nextAct = G.t;
        for (let i = 0; i < 60 && !(m.windup && m.windup.move === move); i++) Game.update(G.t + 25, 25);
        if (!(m.windup && m.windup.move === move)) return { err: `${boss} never began its ${move} (${JSON.stringify(m.windup)})` };
        const mark = markLog(G);
        c.nextAct = G.t;
        for (let i = 0; i < 160 && m.windup && m.windup.move === move; i++) { Game.update(G.t + 25, 25); if (c.nextAct > G.t + 25 && m.windup) c.nextAct = G.t; }
        said.push(linesSince(G, mark).join(' | '));
        c.nextAct = 1e12;
        L0(ctx);
      }
      return { said, name: c.name };
    };
    // (the warband called by a drum that was not broken is sent away between rounds)
    const L0 = ctx => { const L = ctx.Game.level(); for (let i = L.monsters.length - 1; i >= 0; i--) if (!ctx.MONSTERS[L.monsters[i].id].boss) L.monsters.splice(i, 1); };
    for (const boss of ['warlord', 'lich']) {
      const r = await gather('sell-cut-' + boss, 'sellsword', boss);
      if (r.err) { out.push(r.err); continue; }
      const broke = boss === 'warlord' ? new RegExp(`${r.name} cuts the drumstick`) : new RegExp(`${r.name}'s cut catches the .* rite breaks`);
      if (!broke.test(r.said[0])) out.push(`the first ${boss} round: ${r.said[0]}`);
      if (broke.test(r.said[1])) out.push(`a second ${boss} round was broken too`);
      const h = await gather('hound-cut-' + boss, 'hound', boss);
      if (h.err) { out.push(h.err); continue; }
      if (h.said.some(l => /drumstick from|rite breaks|break the .* rite/.test(l))) out.push(`a hound broke the ${boss}'s: ${h.said.join(' / ')}`);
    }
    return out.length ? out.join('; ') : true;
  });

  /** A cleric three floors down, with a healer who came for a share of food. */
  const withHealer = async (seed, opts = {}) => {
    const ctx = await start('cleric', seed, { levels: 8, ...opts });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    p.hp = p.maxHp = 100; p.food = 90;
    // (no meal in the pack, so the share comes off the hunger bar)
    p.inv = p.inv.filter(it => ctx.ITEMS[it.t].kind !== 'food');
    meetAndChoose(ctx, 'stray_healer', 0); Game.closeEncounter();
    return ctx;
  };
  /** The healer's floor made plain: the hero and the healer side by side in a bare room, the healer told to stay. */
  const healerRoom = ctx => {
    const { Game } = ctx; const p = Game.player(), c = Game.companion();
    bareFloor(ctx); dig(ctx, 3, 3, 16, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 6; c.y = 7; c.mode = 'stay'; c.tendAt = 0; c.tending = false;
    return Game.level();
  };

  await test('a healer by a dead lamp: food shared, they follow; talked round, they follow, or bind a cut and stay; with a companion already, they only tend you', async () => {
    const out = [];
    {
      const ctx = await withHealer('healer-food');
      const { Game } = ctx; const p = Game.player(), c = Game.companion();
      if (!c || c.kind !== 'mender') return `no healer followed: ${JSON.stringify(c)}`;
      if (p.food !== 70) out.push(`sharing food left ${p.food} of 90`);
      if (!Game.threadNotes().some(n => n.includes(c.name) && /healer/.test(n))) out.push('the hero sheet does not name the healer');
      // one at a time: with them at your side, neither asking is on offer, but the tending is
      const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'stray_healer', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      Game.input('use');
      const o = Game.encounterOptions();
      if (!o[0].blocked || !o[1].blocked || o[2].blocked) out.push(`with a companion, the choices were blocked ${o.map(x => !!x.blocked)}`);
      p.hp = 50;
      Game.chooseEncounter(2);
      if (p.hp !== 65) out.push(`tended at the lamp, the hero went from 50 to ${p.hp}, not 65`);
      Game.closeEncounter();
    }
    // talked round by a cleric's tongue
    {
      const ctx = await start('cleric', 'healer-talk', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 30;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { r = meetAndChoose(ctx, 'stray_healer', 1); Game.closeEncounter(); }
      if (!r.check.pass) out.push('a silver tongue never talked the healer round');
      else if (!Game.companion() || Game.companion().kind !== 'mender') out.push('talked round, the healer did not follow');
    }
    // talked to badly: a cut bound, and nobody follows
    {
      const ctx = await start('fighter', 'healer-churl', { levels: 8 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      p.stats.cha = 1; p.maxHp = 100;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && !r.check.pass); i++) { p.hp = 50; G.companion = null; r = meetAndChoose(ctx, 'stray_healer', 1); Game.closeEncounter(); }
      if (r.check.pass) out.push('a churl talked the healer round six times running');
      else {
        if (Game.companion()) out.push('a failed asking still brought the healer');
        if (p.hp !== 58) out.push(`a failed asking left the hero at ${p.hp}, not 58`);
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('what is upon a monster goes to the view with it: fire, venom or bleeding, and what holds it fast, until it passes', async () => {
    const out = [];
    const ctx = await start('fighter', 'aff');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.monsters.length = 0;
    L.monsters.push({ uid: 93, id: 'orc', x: 8, y: 6, hp: 77, maxHp: 77, awake: true, nextAct: 1e12, rx: 8, ry: 6, fromX: 8, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m = L.monsters[0];
    const aff = () => { const s = Game.renderState(0).sprites.find(q => q.maxHp === 77); return s && s.aff ? `${s.aff.dot}/${s.aff.held}` : 'none'; };
    if (aff() !== 'none') out.push(`untouched, it carried ${aff()}`);
    for (const kind of ['burning', 'venom', 'bleed']) { m.dot = { kind, until: G.t + 3000, next: 1e12 }; if (aff() !== `${kind}/`) out.push(`${kind}: the view was told ${aff()}`); }
    m.dot = null;
    for (const by of ['ice', 'roots', 'snare']) { m.snaredUntil = G.t + 2000; m.heldBy = by; if (aff() !== `/${by}`) out.push(`held by ${by}: the view was told ${aff()}`); }
    // both at once, and then both passed
    m.dot = { kind: 'burning', until: G.t + 3000, next: 1e12 };
    if (aff() !== 'burning/snare') out.push(`burning and snared, the view was told ${aff()}`);
    G.t += 5000;
    if (aff() !== 'none') out.push(`once both had passed, the view was still told ${aff()}`);
    return out.length ? out.join('; ') : true;
  });

  await test('each kind dies its own way: bones clatter down, a slime bursts flat, a wraith comes apart into mist, a bat drops, a puffcap bursts, an orc topples', async () => {
    const out = [];
    const ctx = await start('fighter', 'deaths');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; p.hp = p.maxHp = 9999;
    // (an emberling's sparks are lost in the gout of flame it bursts in, which shows for them)
    const want = { skeleton: ['clatter', '#e8e0cc'], slime: ['splat', '#4a9a2e'], wraith: ['mist', '#a8d8ff'], bat: ['tumble', null], puffcap: ['burst', '#d8d0a0'], emberling: ['gutter', null], orc: ['fall', null] };
    for (const id in want) {
      L.monsters.length = 0;
      // (a skeleton that has risen once stays down; its first fall into the heap is tried below)
      L.monsters.push({ uid: 94, id, x: 7, y: 6, hp: 1, maxHp: 30, awake: true, nextAct: 1e12, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0, risen: true });
      const fx = Game.renderState(0).fx, had = fx.corpses.length, bits0 = fx.bits.length;
      for (let i = 0; i < 12 && L.monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
      if (L.monsters.length) { out.push(`${id}: never died`); continue; }
      const after = Game.renderState(0).fx, body = after.corpses[after.corpses.length - 1];
      const [how, col] = want[id];
      if (after.corpses.length <= had || !body) { out.push(`${id}: left no body to fall`); continue; }
      if (body.how !== how) out.push(`${id} died by '${body.how}', not '${how}'`);
      if (col && !after.bits.slice(bits0).some(b => b.c === col)) out.push(`${id}'s death threw none of its ${how}`);
    }
    // a skeleton cut down the first time clatters into its heap the same way, and the heap lies there to rise
    L.monsters.length = 0;
    L.monsters.push({ uid: 95, id: 'skeleton', x: 7, y: 6, hp: 1, maxHp: 30, awake: true, nextAct: 1e12, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const n0 = Game.renderState(0).fx.corpses.length;
    for (let i = 0; i < 12 && !L.monsters[0].collapsed; i++) { G.t = p.nextAttack; Game.input('attack'); }
    const cs = Game.renderState(0).fx.corpses;
    if (!L.monsters[0] || !L.monsters[0].collapsed) out.push('the skeleton never fell into its heap');
    else if (cs.length <= n0 || cs[cs.length - 1].how !== 'clatter' || cs[cs.length - 1].sprite !== 'skeleton') out.push('the skeleton fell into its heap without clattering down');
    return out.length ? out.join('; ') : true;
  });

  await test('a walking monster strides, a step to each half of a square and the other foot first on the next; standing or winding up, it does not; a bat beats its wings all the while', async () => {
    const out = [];
    const ctx = await start('fighter', 'stride');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.monsters.length = 0;
    L.monsters.push({ uid: 92, id: 'orc', x: 9, y: 6, hp: 88, maxHp: 88, awake: true, nextAct: 1e12, rx: 9, ry: 6, fromX: 10, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m = L.monsters[0];
    // (in the rules' own world no pictures are painted, so the view is lent the poses to choose among)
    const { Assets } = await import('../js/assets.js');
    // the stride it is drawn in, read off the picture the view is handed
    const step = (/** @type {number} */ now, hp = 88) => {
      const s = Game.renderState(now).sprites.find(q => q.maxHp === hp), art = Assets.sprites[hp === 88 ? 'orc' : 'bat'];
      return !s ? 'gone' : s.img === art.stepA ? 'stepA' : s.img === art.stepB ? 'stepB' : s.img === art ? '' : 'other';
    };

    const pic = { stepA: {}, stepB: {}, hurt: {}, windup: {} };
    const was = { orc: Assets.sprites.orc, bat: Assets.sprites.bat };
    Assets.sprites.orc = pic; Assets.sprites.bat = { ...pic };
    try {
      if (step(1000)) out.push(`standing, it was drawn mid-stride (${step(1000)})`);
      m.moveT0 = 1000; m.moveT1 = 1300;
      const a = step(1050), b = step(1250);
      if (!a || !b || a === b) out.push(`crossing a square it strode ${a} then ${b}`);
      m.fromX = 9; m.x = 8; m.rx = 8; m.moveT0 = 1300; m.moveT1 = 1600;
      if (step(1350) !== b) out.push(`on the next square it led with ${step(1350)}, not the other foot (${b})`);
      m.windup = { kind: 'blow', at: G.t, until: G.t + 1000 };
      if (step(1350)) out.push('winding up a blow, it was drawn mid-stride');
      m.windup = null;
      // a bat, standing still in the air, beats its wings
      L.monsters.push({ uid: 97, id: 'bat', x: 8, y: 7, hp: 66, maxHp: 66, awake: true, nextAct: 1e12, rx: 8, ry: 7, fromX: 8, fromY: 7, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const beats = new Set(); for (let t = 0; t < 400; t += 30) beats.add(step(5000 + t, 66));
      if (!beats.has('stepA') || !beats.has('stepB')) out.push(`a bat aloft did not beat its wings (${[...beats].join(', ')})`);
    } finally { Assets.sprites.orc = was.orc; Assets.sprites.bat = was.bat; }
    return out.length ? out.join('; ') : true;
  });

  await test('a door pushed open or pulled shut slides across its doorway, a door at a time and on its own floor, and is still', async () => {
    const out = [];
    const ctx = await start('fighter', 'door-slide');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.tiles[6 * L.w + 7] = Dungeon.T.DOOR;
    const shut = (/** @type {number} */ now) => { const s = Game.renderState(now).fx.doorShut; return s && s[6 * L.w + 7] ? s[6 * L.w + 7].shut : null; };
    if (shut(0) !== null) out.push('a door at rest was drawn moving');
    Game.input('use');
    if (L.tiles[6 * L.w + 7] !== Dungeon.T.DOOR_OPEN) return 'the door did not open';
    const at = Game.renderState(0).fx.doors['7,6'].at;
    const a = shut(at + 10), b = shut(at + 260), c = shut(at + 2000);
    if (!(a > 0.9 && b > 0.1 && b < 0.9)) out.push(`opening, it was ${a} then ${b} shut, not shut then half way`);
    if (c !== null && c > 0.01) out.push(`long after, it was still ${c} shut`);
    // pulled shut again, it slides back across
    G.t += 5000; Game.input('use');
    if (L.tiles[6 * L.w + 7] !== Dungeon.T.DOOR) return 'the door did not shut';
    const at2 = Game.renderState(0).fx.doors['7,6'].at;
    if (!(shut(at2 + 10) < 0.1 && shut(at2 + 400) > 0.6)) out.push(`shutting, it was ${shut(at2 + 10)} then ${shut(at2 + 400)} shut`);
    // a door broken to splinters does not slide; and a door still moving on the floor left behind is not drawn here
    Game.renderState(0).fx.doors['7,6'].depth = G.depth + 1;
    if (shut(at2 + 100) !== null) out.push('a door moving on another floor was drawn on this one');
    return out.length ? out.join('; ') : true;
  });

  await test('coming onto a new floor and rising a level are each marked for the view, the moment they happen', async () => {
    const out = [];
    const ctx = await start('fighter', 'arrive-rise');
    const { Game } = ctx; const p = Game.player();
    const fx = () => Game.renderState(0).fx;
    const before = fx().arriveAt;
    Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
    if (!(fx().arriveAt >= before) || fx().arriveAt === -1e9) out.push(`down the stair, the arrival was not marked (${before} -> ${fx().arriveAt})`);
    const lv0 = fx().levelAt, lvl = p.level;
    // (experience is weighed when next some is gained: a kill does it)
    p.xp += 100000;
    { const L = Game.level(); L.monsters.length = 0; const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.push({ uid: 99, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 }); for (let i = 0; i < 10 && L.monsters.length; i++) { Game.state().t = p.nextAttack; Game.input('attack'); } }
    if (p.level === lvl) out.push('the hero never rose a level');
    else if (!(fx().levelAt !== lv0 && fx().levelAt > -1e9)) out.push('rising a level was not marked for the view');
    return out.length ? out.join('; ') : true;
  });

  await test('a monster asleep has its eyes shut; awake, it blinks now and then, but never while it winds up a blow', async () => {
    const out = [];
    const ctx = await start('fighter', 'blink');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.monsters.length = 0;
    L.monsters.push({ uid: 98, id: 'orc', x: 9, y: 6, hp: 55, maxHp: 55, awake: false, nextAct: 1e12, rx: 9, ry: 6, fromX: 9, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m = L.monsters[0];
    // (in the rules' own world no pictures are painted, so the view is lent the poses to choose among)
    const { Assets } = await import('../js/assets.js');
    const was = Assets.sprites.orc, pic = { blink: {}, windup: {}, stepA: {}, stepB: {}, hurt: {} };
    Assets.sprites.orc = pic;
    try {
      const shut = (/** @type {number} */ now) => Game.renderState(now).sprites.find(q => q.maxHp === 55).img === pic.blink;
      if (!shut(1000) || !shut(4321)) out.push('asleep, its eyes were open');
      m.awake = true;
      let n = 0; for (let t = 0; t < 20000; t += 20) if (shut(t)) n++;
      if (n === 0) out.push('awake, it never blinked in twenty seconds');
      if (n > 200) out.push(`awake, its eyes were shut ${n * 20}ms in twenty seconds: more stare than blink`);
      m.windup = { kind: 'blow', at: G.t, until: G.t + 1000 };
      let during = 0; for (let t = 0; t < 20000; t += 20) if (shut(t)) during++;
      if (during) out.push('winding up a blow, it blinked');
    } finally { Assets.sprites.orc = was; }
    return out.length ? out.join('; ') : true;
  });

  await test('loot worth stooping for is marked to catch the light, and on a dark floor the hero carries a lantern', async () => {
    const out = [];
    const ctx = await start('fighter', 'glint-lantern');
    const { Game } = ctx; const p = Game.player();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.items = { '8,6': [{ t: 'ring_protect', q: 1, e: 0 }], '9,6': [{ t: 'dagger', q: 1, e: 0 }], '10,6': [{ t: 'dagger', q: 1, e: 2 }] };
    const glint = (/** @type {number} */ x) => { const s = Game.renderState(0).sprites.find(q => q.onFloor && Math.floor(q.x) === x && Math.abs(q.y - 6.5) < 0.6); return s ? s.glint : 'none'; };
    if (glint(8) !== true) out.push(`a ring lying there did not catch the light (${glint(8)})`);
    if (glint(9) !== false) out.push(`a plain dagger caught the light (${glint(9)})`);
    if (glint(10) !== true) out.push(`a dagger +2 did not catch the light (${glint(10)})`);
    L.twist = null;
    if (Game.renderState(0).fx.view.lantern) out.push('on a lit floor the hero carried a lantern');
    L.twist = 'dark';
    if (!Game.renderState(0).fx.view.lantern) out.push('on a dark floor the hero carried no lantern');
    return out.length ? out.join('; ') : true;
  });

  await test('a struck monster reels: its flinching picture through the white of the hit and a moment after, never over a wind-up', async () => {
    const out = [];
    const ctx = await start('fighter', 'reel');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1;
    L.monsters.length = 0;
    L.monsters.push({ uid: 91, id: 'orc', x: 7, y: 6, hp: 99, maxHp: 99, awake: true, nextAct: 1e12, rx: 7, ry: 6, fromX: 7, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m = L.monsters[0];
    const reeling = (/** @type {number} */ now) => { const s = Game.renderState(now).sprites.find(q => q.maxHp === 99); return !!(s && s.reeling); };
    // a real blow lands (swinging again past a natural one)
    for (let i = 0; i < 8 && m.hp === 99; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (m.hp === 99) return 'eight swings never landed';
    const at = m.flashAt || 0;
    if (reeling(at - 20)) out.push('it reeled before the blow landed');
    if (!reeling(at + 50)) out.push('in the white of the hit it did not reel');
    if (!reeling(m.flashUntil + 200)) out.push('a moment after the white it had already stopped reeling');
    if (reeling(m.flashUntil + 400)) out.push('it was still reeling long after the blow');
    // winding up a blow of its own, it shows the wind-up, struck or not
    m.windup = { at: G.t, until: G.t + 1000 };
    if (reeling(at + 50)) out.push('struck while winding up, it reeled and hid its wind-up');
    return out.length ? out.join('; ') : true;
  });

  await test('a healer at work is drawn holding their hands out over you: while tending, and for a moment after a dressing', async () => {
    const out = [];
    const ctx = await withHealer('healer-pose');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no healer';
    healerRoom(ctx);
    const art = { sprites: { mender: { name: 'stand', windup: { name: 'windup' }, sit: { name: 'sit' }, heal: { name: 'heal' } } } };
    const drawn = (/** @type {number} */ now) => { const s = Game.companionSprite(art, now); return s && s.img.name; };
    // wounded, close by, nothing awake: it tends, and is drawn tending
    p.hp = 40;
    run(Game, G, 3000);
    if (!c.tending) out.push('the healer was not tending');
    c.moveT1 = 0; c.lungeAt = 0; c.dressAt = 0;
    if (drawn(1e6) !== 'heal') out.push(`tending, the healer was drawn ${drawn(1e6)}`);
    // a swing still shows the swing
    c.lungeAt = 1e6 - 50;
    if (drawn(1e6) !== 'windup') out.push(`swinging while tending, the healer was drawn ${drawn(1e6)}`);
    c.lungeAt = 0;
    // whole again: told to stay, it sits
    p.hp = p.maxHp;
    run(Game, G, 3000);
    c.moveT1 = 0;
    if (c.tending || drawn(1e6) !== 'sit') out.push(`with nothing to mend, the healer was drawn ${drawn(1e6)}`);
    // a dressing just bound shows for a moment, then passes
    c.dressAt = 1e6;
    if (drawn(1e6 + 500) !== 'heal') out.push(`just after a dressing, the healer was drawn ${drawn(1e6 + 500)}`);
    if (drawn(1e6 + 2000) !== 'sit') out.push(`two seconds after a dressing, the healer was drawn ${drawn(1e6 + 2000)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a healer tends your wounds between fights, close by and with nothing awake near, from herbs that go so far on each new floor', async () => {
    const out = [];
    const ctx = await withHealer('healer-tend');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no healer';
    let L = healerRoom(ctx);
    // (the hero mends a little on their own over time, so what the healer mends is counted on the healer)
    const mended = () => c.mended || 0;
    // an orc awake four squares off: a fight about to start, and no tending
    L.monsters.push({ uid: 91, id: 'orc', x: 10, y: 6, hp: 99, maxHp: 99, awake: true, nextAct: 1e12, rx: 10, ry: 6, fromX: 10, fromY: 6, moveT0: 0, moveT1: 0, flashUntil: 0 });
    p.hp = 40;
    run(Game, G, 10000);
    if (mended()) out.push(`with an orc awake four squares off, the healer mended ${mended()}`);
    // the same orc asleep: nothing to fight, and it tends, about four every two and a half seconds
    L.monsters[0].awake = false;
    run(Game, G, 5100);
    if (mended() < 4 || mended() > 12 || p.hp < 40 + mended()) out.push(`in five seconds the healer mended ${mended()}, not about 8`);
    // far off, it does not reach
    L.monsters.length = 0; c.x = 12; c.y = 6;
    let was = mended();
    run(Game, G, 10000);
    if (mended() !== was) out.push(`from six squares off the healer mended ${mended() - was}`);
    // close again: it mends until the satchel is empty, a third of the hero's life on the floor, and no more
    c.x = 6; c.y = 7; p.hp = 40;
    let mark = markLog(G);
    run(Game, G, 40000);
    if (mended() !== 30) out.push(`the floor's herbs mended ${mended()}, not 30 (a third of 100)`);
    if (!linesSince(G, mark).some(l => /nothing more to spare/.test(l))) out.push('the empty satchel was not told');
    // (told once a spell of it: the line may run on from the last spell's, the log folding the two)
    if (countSaid(linesSince(G, mark), /sees to your wounds/) > 2) out.push(`the tending was told at every touch: ${linesSince(G, mark).join(' / ')}`);
    if (!Game.threadNotes().some(n => /30 hit points of yours mended/.test(n) && /no herbs left/.test(n))) out.push(`the hero sheet does not count the mending: ${Game.threadNotes().find(n => n.includes(c.name))}`);
    // its own scrapes it mends for nothing
    c.hp = 1; c.maxHp = 40;
    run(Game, G, 10000);
    if (c.hp < 4) out.push(`the healer mended itself only to ${c.hp}`);
    // a new floor, a full satchel
    c.mode = 'follow';
    Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
    L = healerRoom(ctx);
    p.hp = 40; was = mended();
    run(Game, G, 6000);
    if (mended() <= was) out.push('on a new floor the healer had nothing to mend with');
    return out.length ? out.join('; ') : true;
  });

  await test('a blooded healer draws out poison as they tend; a veteran binds a wound that leaves you under a quarter, once a floor, from close by', async () => {
    const out = [];
    const ctx = await withHealer('healer-tricks');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    if (!c) return 'no healer';
    healerRoom(ctx);
    // not yet blooded: the poison stays
    c.floors = 0;
    p.poison = { until: G.t + 1e9, next: G.t + 1e9, dmg: 1 };
    run(Game, G, 6000);
    if (!p.poison) out.push('a healer not yet blooded drew out the poison');
    c.floors = 2;
    let mark = markLog(G);
    run(Game, G, 6000);
    if (p.poison) out.push('a blooded healer left the poison in');
    else if (!linesSince(G, mark).some(l => /draws the poison out/.test(l))) out.push('the poultice was not told');
    // blooded only: a blow to under a quarter is not bound
    p.hp = 100;
    Game.hurtPlayer(80, 'The orc hits you for 80.');
    if (p.hp !== 20) out.push(`a blooded healer bound a wound (${p.hp})`);
    // a veteran: bound at once, for a quarter back
    c.floors = 4; p.hp = 100;
    mark = markLog(G);
    Game.hurtPlayer(80, 'The orc hits you for 80.');
    if (p.hp !== 45) out.push(`a veteran's dressing left the hero at ${p.hp}, not 45`);
    if (!linesSince(G, mark).some(l => /binds the wound tight/.test(l))) out.push('the dressing was not told');
    // once a floor
    p.hp = 100;
    Game.hurtPlayer(80, 'The orc hits you for 80.');
    if (p.hp !== 20) out.push(`a second dressing on the same floor (${p.hp})`);
    // a blow that leaves a quarter or more is not bound, nor one from far off
    c.dressedOn = 0; p.hp = 100;
    Game.hurtPlayer(70, 'The orc hits you for 70.');
    if (p.hp !== 30) out.push(`a blow to 30 of 100 was bound (${p.hp})`);
    c.x = 12; c.y = 6; p.hp = 100;
    Game.hurtPlayer(80, 'The orc hits you for 80.');
    if (p.hp !== 20) out.push(`a healer six squares off bound the wound (${p.hp})`);
    return out.length ? out.join('; ') : true;
  });

  await test('the caged goblin, let out, follows; it picks a locked door there is no key for, and makes safe a trap it passes', async () => {
    const out = [];
    const ctx = await withGoblin('goblin-join');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    if (!c || c.kind !== 'goblin' || !c.name) return `no goblin followed: ${JSON.stringify(c)}`;
    if (c.maxHp >= 10 + 4 * p.level) out.push('the goblin is as sturdy as a hound');
    // a locked door ahead, no key: with the goblin near, Use picks it
    const L = bareFloor(ctx); dig(ctx, 3, 3, 12, 9);
    p.x = 6; p.y = 6; p.dir = 1; c.x = 5; c.y = 6;
    const T = ctx.Dungeon.T;
    L.tiles[6 * L.w + 7] = T.DOOR_LOCKED; L.locks = { '7,6': 'iron' };
    if (Game.useLabel() !== 'Pick') out.push(`facing a locked door with the goblin near, Use says ${Game.useLabel()}`);
    const mark = markLog(G);
    Game.input('use');
    if (L.tiles[6 * L.w + 7] !== T.DOOR_OPEN) out.push('the goblin did not pick the lock');
    else if (!linesSince(G, mark).some(l => l.includes(c.name))) out.push('the picking was not told');
    // far off, it cannot help: the hero must force it
    L.tiles[6 * L.w + 7] = T.DOOR_LOCKED; L.locks = { '7,6': 'iron' };
    c.x = 3; c.y = 3; c.mode = 'stay';
    if (Game.useLabel() !== 'Force') out.push(`with the goblin across the room, Use says ${Game.useLabel()}`);
    c.mode = 'follow';
    // a trap two squares from it is made safe, one further off is not
    L.traps = { '5,8': 'dart', '10,3': 'dart', '6,6': 'snare' }; L.snares = { '6,6': 4242 };
    c.x = 5; c.y = 6;
    run(Game, G, 1000);
    if (L.traps['5,8']) out.push('a trap two squares from the goblin was left');
    if (L.traps['6,6'] || L.snares['6,6']) out.push('a kobold\'s snare beside the goblin was left, or half left');
    if (!Game.threadNotes().some(n => n.includes(c.name) && /trap/.test(n))) out.push('the hero sheet does not count its traps');
    // it stabs rather than bites, and it is quiet on its feet
    L.monsters.push({ uid: 90, id: 'goblin', x: 5, y: 5, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    const m2 = markLog(G);
    run(Game, G, 6000);
    if (!linesSince(G, m2).some(l => l.includes(`${c.name} stabs`))) out.push('it never stabbed the foe beside it');
    return out.length ? out.join('; ') : true;
  });

  await test('the goblin is quiet where the hound is heard; the caged goblin waits halfway down the delves with no hound, never alongside one', async () => {
    const out = [];
    {
      const ctx = await withGoblin('goblin-quiet');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion(), L = Game.level();
      p.bg = 'debtor'; L.twist = null;
      clearAround(ctx, 8);
      const dir = ctx.Dungeon.DIRS.find(([dx, dy]) => p.x + 7 * dx > 0 && p.x + 7 * dx < L.w - 1 && p.y + 7 * dy > 0 && p.y + 7 * dy < L.h - 1);
      const m = { uid: 89, id: 'goblin', x: p.x + 7 * dir[0], y: p.y + 7 * dir[1], hp: 999, maxHp: 999, awake: false, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.length = 0; L.monsters.push(m);
      Game.update(G.t + 25, 25);
      if (m.awake) out.push('a sleeper seven squares off woke for a goblin at heel');
      if (!c) out.push('no goblin');
    }
    const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    let caged = 0, both = 0;
    for (let i = 0; i < 300; i++) {
      const plan = encounterPlan('cage' + i, 8), flat = plan.flat();
      if (flat.includes('caged')) { caged++; if (!plan[4].includes('caged')) out.push(`seed cage${i} put the goblin on another floor`); }
      if (flat.includes('caged') && flat.includes('stray')) both++;
    }
    if (caged < 70 || caged > 130) out.push(`the caged goblin waited in ${caged} of 300 delves`);
    if (both) out.push(`${both} delves held both the hound and the goblin`);
    if (encounterPlan('cage-short', 4).flat().includes('caged')) out.push('a four-floor delve met the goblin');
    if (!encounterPlan('cage-long', 12).flat().includes('caged') && !encounterPlan('cage-long', 12).flat().includes('stray')) out.push('a long delve had neither companion');
    return out.length ? out.join('; ') : true;
  });

  await test('a hero coming back up a stair never lands on a monster: it steps aside; and the dead lift nothing, not even the Heart', async () => {
    const out = [];
    {
      const ctx = await start('fighter', 'landing', { levels: 6 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 9999;
      Game.level().monsters.length = 0;
      Game.descend();
      const L1 = G.levels[1], land = L1.downStart || L1.start;
      // something wanders onto the square beside the down stair while the hero is below
      L1.monsters.length = 0;
      L1.monsters.push({ uid: 88, id: 'goblin', x: land.x, y: land.y, hp: 9, maxHp: 9, awake: true, nextAct: G.t, rx: land.x, ry: land.y, fromX: land.x, fromY: land.y, moveT0: 0, moveT1: 0, flashUntil: 0 });
      const d0 = G.depth;
      Game.level().monsters.length = 0;
      // back up (the up stair beside the hero on arrival)
      const up = ctx.Dungeon.DIRS.map(([dx, dy]) => [p.x + dx, p.y + dy]).find(([x, y]) => Game.level().tiles[y * Game.level().w + x] === ctx.Dungeon.T.STAIRS_UP);
      if (!up) return 'no up stair beside the arrival';
      p.dir = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === up[0] - p.x && dy === up[1] - p.y);
      Game.input('use');
      if (G.depth !== d0 - 1) return `the climb did not happen (floor ${G.depth})`;
      const m = L1.monsters[0];
      if (m.x === p.x && m.y === p.y) out.push('the hero landed on the goblin');
      else if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 4) out.push('the goblin was flung far off');
    }
    {
      const ctx = await start('fighter', 'dead-heart', { levels: 4, permadeath: true });
      const { Game } = ctx; const G = Game.state(), p = G.player, L = Game.level(), k = `${p.x},${p.y}`;
      const heart = { t: 'artifact', q: 1, e: 0 };
      (L.items[k] = L.items[k] || []).push(heart);
      L.monsters.length = 0;
      p.hp = 1; p.lastHurt = G.t; p.poison = { until: G.t + 10000, next: G.t };
      for (let i = 0; i < 40 && G.status === 'playing'; i++) Game.update(G.t + 100, 100);
      if (G.status !== 'dead') return `the hero did not die (${G.status})`;
      Game.takeItem(heart);
      if (G.status !== 'dead') out.push(`a dead hero took the Heart and the run became ${G.status}`);
      if (Game.hall().some(h => h.won)) out.push('the Hall recorded a win');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a shade is worth a whole number of experience, and the hardest hit a trap dealt names the trap', async () => {
    const out = [];
    const ctx = await start('fighter', 'whole-xp', { levels: 8 });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.hp = p.maxHp = 9999;
    // a trap underfoot, stepped on until one bites (some can be dodged)
    const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    for (let i = 0; i < 40 && !(Game.runStats().worst); i++) {
      const x0 = p.x, y0 = p.y;
      L.tiles[(y0 + dy) * L.w + x0 + dx] = ctx.Dungeon.T.FLOOR;
      L.traps[`${x0 + dx},${y0 + dy}`] = 'pit';
      Game.input('forward'); run(Game, G, 400);
      p.x = x0; p.y = y0;
    }
    const w = Game.runStats().worst;
    if (!w) out.push('no trap ever hurt the hero');
    else if (w.from || !/^a /.test(w.cause || '')) out.push(`the hardest hit was told as ${JSON.stringify(w)}`);
    // an eight-floor delve's tiers are fractions; a shade's worth, and its aim, are not
    const sh = Game.mstat({ id: 'shade', shade: { name: 'Old', cls: 'fighter', tier: 2.04, depth: 2 } });
    if (!Number.isInteger(sh.xp) || !Number.isInteger(sh.hit)) out.push(`a shade was worth ${sh.xp} experience and hit at +${sh.hit}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the lich is the last fight: surer and harder than its floor on Normal and Hard, on a floor with fewer of the rest', async () => {
    const out = [];
    const hitOf = async difficulty => {
      const ctx = await start('fighter', 'lich-edge', { levels: 4, difficulty });
      const { Game } = ctx;
      const lich = { id: 'lich', uid: 1, x: 0, y: 0, hp: 100, maxHp: 100 };
      const orc = { id: 'orc', uid: 2, x: 0, y: 0, hp: 10, maxHp: 10 };
      return { lich: Game.mstat(lich), orc: Game.mstat(orc) };
    };
    const easy = await hitOf('easy'), normal = await hitOf('normal'), hard = await hitOf('hard');
    // the orc's edge from the difficulty, and the lich's that much and more
    const lift = (a, b, k) => b[k].hit - a[k].hit;
    if (lift(easy, normal, 'lich') !== lift(easy, normal, 'orc') + 4) out.push(`on Normal the lich hit +${lift(easy, normal, 'lich')} over Easy, an orc +${lift(easy, normal, 'orc')}`);
    if (lift(easy, hard, 'lich') !== lift(easy, hard, 'orc') + 3) out.push(`on Hard the lich hit +${lift(easy, hard, 'lich')} over Easy, an orc +${lift(easy, hard, 'orc')}`);
    if (normal.lich.dmg[2] - easy.lich.dmg[2] !== lift(easy, normal, 'lich')) out.push('the lich\'s blows did not grow with its aim');
    // and Hard's lich is never the gentler one
    if (hard.lich.hit < normal.lich.hit) out.push(`Hard's lich hit at +${hard.lich.hit}, Normal's at +${normal.lich.hit}`);
    // its floor holds fewer of the rest than a floor just above it would
    const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
    let last = 0, before = 0;
    for (let i = 0; i < 20; i++) {
      const o = { levels: 8, size: 'normal', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
      last += Dungeon.generate('thin' + i, 8, o).monsters.filter(m => m.id !== 'lich').length;
      before += Dungeon.generate('thin' + i, 7, o).monsters.length;
    }
    if (!(last < before * 0.85)) out.push(`over twenty delves the lich's floor held ${last} others, the floor above ${before}`);
    // out of rests on the lich's floor, there is no stair to send the hero to
    {
      const ctx = await start('fighter', 'last-rest', { levels: 3 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      while (G.depth < 3) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level(); L.monsters.length = 0; L.rests = 9; p.hp = 1;
      const mark = markLog(G);
      Game.rest();
      const said = linesSince(G, mark).join(' | ');
      if (!/Finish what you came for/.test(said) || /Find the stairs/.test(said)) out.push(`out of rests on the last floor: "${said}"`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('Steady Aim is for bows and slings, not throwing knives, and the pack counts it when it weighs a bow', async () => {
    const out = [];
    const ITEMS_SPEED = { longbow: 950, shortbow: 850, throwknife: 520 };
    const ctx = await start('ranger', 'aimed', { levels: 8 });
    const { Game } = ctx; const p = Game.player();
    p.stats.dex = 18; p.level = 7;
    // the pack's figure for a ranger's bow carries Steady Aim; for knives, nothing. Per blow
    // (the rate times the draw), the long bow is 2 over the knives by its dice and the short
    // bow 1, and Steady Aim (as at two squares) adds 1 to each: 3 against 2, where without it
    // it would be 2 against 1
    const blow = t => Game.blowRate({ t, q: 1, e: 0 }) * ITEMS_SPEED[t];
    const ratio = (blow('longbow') - blow('throwknife')) / (blow('shortbow') - blow('throwknife'));
    if (Math.abs(ratio - 1.5) > 0.01) out.push(`the pack weighed the bows over the knives at ${ratio.toFixed(2)} to one, not 1.5`);
    // a shot two squares off: a sling's carries Steady Aim, a throwing knife's does not
    const shot = weapon => {
      const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      p.eq.weapon = { t: weapon, q: 1, e: 0, id: 99 }; delete p.eq.shield;
      for (let k = 1; k <= 2; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = ctx.Dungeon.T.FLOOR;
      let total = 0, n = 0;
      for (let i = 0; i < 400; i++) {
        const m = { id: 'orc', uid: 500 + i, x: p.x + dx * 2, y: p.y + dy * 2, rx: p.x + dx * 2, ry: p.y + dy * 2, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, flashUntil: 0 };
        L.monsters.length = 0; L.monsters.push(m);
        const G = Game.state(); G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
        if (m.hp < 999) { total += 999 - m.hp; n++; }
      }
      return total / Math.max(1, n);
    };
    const sling = shot('sling'), knives = shot('throwknife');
    // both roll 1d4, the sling +1: another point between them is Steady Aim (two squares off: the
    // eight Normal floors' second point is for three squares or more)
    if (!(sling - knives > 1.5 && sling - knives < 2.6)) out.push(`a sling shot averaged ${sling.toFixed(2)}, a throwing knife ${knives.toFixed(2)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('an encounter\'s experience grows with the depth it is met at: twice as much on the fourth floor as the first', async () => {
    const got = {};
    for (const depth of [1, 4]) {
      const ctx = await start('fighter', 'enc-xp-' + depth, { levels: 8 });
      const { Game, Dungeon } = ctx;
      while (Game.state().depth < depth) { Game.level().monsters.length = 0; Game.descend(); }
      const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0; L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.npcs.push({ kind: 'encounter', id: 'mercy', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
      const before = p.xp;
      Game.chooseEncounter(2);   // finish it: no check, fifteen on the first floor
      got[depth] = p.xp - before;
    }
    return (got[1] === 15 && got[4] === 30) || `finishing the wounded goblin paid ${got[1]} on the first floor and ${got[4]} on the fourth`;
  });

  await test('an encounter can tell where a floor\'s traps lie: the hero then steps round them', async () => {
    for (let t = 0; t < 30; t++) {
      const ctx = await start('fighter', 'traps-told' + t, { levels: 8, traps: true });
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
      p.hp = p.maxHp = 999; p.stats.cha = 18;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0; L.npcs.length = 0;
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.traps = { '1,1': 'dart' };
      L.npcs.push({ kind: 'encounter', id: 'mirror', x: p.x + dx, y: p.y + dy });
      Game.input('forward');
      const r = Game.chooseEncounter(1);   // talk to the reflection: a Charisma check
      if (!r || !r.check || !r.check.pass) continue;
      if (!L.trapsKnown) return 'the reflection told of the dangers, and the traps stayed unknown';
      // a dart laid in the hero's path is stepped round, not sprung
      Game.closeEncounter();
      L.traps[`${p.x + dx},${p.y + dy}`] = 'dart';
      const hp = p.hp, mark = markLog(G);
      Game.input('forward'); run(Game, G, 400);
      if (p.hp !== hp) return `a trap the hero knew of still hurt them (${hp} -> ${p.hp})`;
      return linesSince(G, mark).some(l => /step round the dart trap/.test(l)) || `stepping onto it said: ${linesSince(G, mark).join(' | ')}`;
    }
    return 'the reflection never answered in thirty tries';
  });

  await test('Field Craft makes the second rest on a floor as good as the first; a freed goblin close by lends its fingers to a Dexterity check', async () => {
    const out = [];
    for (const craft of [false, true]) {
      const ctx = await start('ranger', 'field-craft' + craft, { levels: 8 });
      const { Game } = ctx; const p = Game.player(), L = Game.level();
      if (craft) talent(ctx, 'field_craft');
      L.monsters.length = 0; p.food = 1000;
      // what each rest will give, as the Rest button says it (an ambush halving one is the dice, not the camp)
      const said = [], healed = [];
      for (let i = 0; i < 4; i++) { p.hp = 1; said.push(Game.restLabel()); Game.rest(); healed.push(p.hp); L.monsters.length = 0; }
      // the second, as good and as quiet as the first: no ambush halves it
      if (craft && healed[1] !== p.maxHp) out.push(`with Field Craft the second rest mended to ${healed[1]} of ${p.maxHp}`);
      const want = craft ? 'Rest,Rest,Rest \u00bd,Rest \u00bc' : 'Rest,Rest \u00bd,Rest \u00bc,No rest';
      if (said.join() !== want) out.push(`${craft ? 'with' : 'without'} Field Craft the rests read ${said.join(', ')}`);
    }
    // the goblin's fingers: +2 on a Dexterity check with it near, nothing on another score or when it is far off
    const ctx = await start('fighter', 'goblin-fingers', { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    G.companion = { kind: 'goblin', name: 'Nib', x: p.x + 1, y: p.y, rx: p.x + 1, ry: p.y, hp: 8, maxHp: 8, depth: G.depth, mode: 'follow', joined: G.depth };
    const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0; L.npcs.length = 0;
    L.npcs.push({ kind: 'encounter', id: 'cookpot', x: p.x + dx, y: p.y + dy });
    Game.input('forward');
    const opts = Game.encounterOptions();
    const dex = opts.find(o => o.stat === 'dex'), con = opts.find(o => o.stat === 'con');
    if (!dex || dex.knack !== 2) out.push(`with the goblin beside the hero a Dexterity check had a knack of ${dex && dex.knack}`);
    // and the choice says whose help it is: the goblin's, not the fighter's own training
    else if (dex.helper !== 'Nib' || dex.trained) out.push(`the help was put down to ${dex.helper || 'nobody'}${dex.trained ? ' and the hero\'s training' : ''}`);
    if (!con || con.knack) out.push(`a Constitution check had a knack of ${con && con.knack}`);
    G.companion.x = G.companion.rx = p.x + 9;
    const far = Game.encounterOptions().find(o => o.stat === 'dex');
    if (far.knack) out.push(`with the goblin nine squares off the knack was ${far.knack}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a companion grows with each new floor it goes down at the hero\'s side: blooded after two, a veteran after four, a trick at each', async () => {
    const out = [];
    const ctx = await withHound('hound-grow');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion();
    const hp0 = c.maxHp;
    const down = () => { const mark = markLog(G); Game.level().monsters.length = 0; Game.descend(); return linesSince(G, mark); };
    down();
    if (c.floors !== 1 || Game.companionRank() !== 0) out.push(`after one floor: floors ${c.floors}, rank ${Game.companionRank()}`);
    c.hp = 1;
    const said = down();
    if (Game.companionRank() !== 1) out.push(`after two floors the rank is ${Game.companionRank()}`);
    if (!said.some(l => l.includes(`${c.name} is blooded now`) && l.includes('Hamstring'))) out.push(`at two floors it said: ${said.join(' / ')}`);
    if (c.hp !== c.maxHp || c.maxHp < hp0 + 4) out.push(`blooded, it has ${c.hp} of ${c.maxHp} (was ${hp0})`);
    // learning its trick, it is drawn a moment in a rising of golden motes, and then not
    const art = { sprites: { dog: {} } }, at = c.flareAt;
    if (at == null) out.push('learning a trick, it was not marked to flare');
    else {
      const s0 = Game.companionSprite(art, at + 300), s1 = Game.companionSprite(art, at + 5000);
      if (!(s0 && s0.aff && s0.aff.flare > 0)) out.push('just after learning its trick it was not drawn flaring');
      if (s1 && s1.aff) out.push('long after learning its trick it was still drawn flaring');
    }
    down();
    const vet = down();
    if (Game.companionRank() !== 2 || !vet.some(l => l.includes('is a veteran now') && l.includes('Pack Hunter'))) out.push(`after four floors: rank ${Game.companionRank()}, said ${vet.join(' / ')}`);
    if (!Game.threadNotes().some(n => n.includes('Hamstring') && n.includes('Pack Hunter'))) out.push('the hero sheet does not list its tricks');
    // one told to stay does not come, and does not grow
    const s = await withHound('hound-grow-stay');
    const c2 = s.Game.companion();
    c2.mode = 'stay';
    s.Game.level().monsters.length = 0; s.Game.descend();
    if (c2.floors) out.push('a hound left behind grew');
    // and before its first trick the hero sheet says how far there is to go
    if (!s.Game.threadNotes().some(n => n.includes('2 more floors down at your side and it learns Hamstring'))) out.push(`the sheet said: ${s.Game.threadNotes().filter(n => n.includes(c2.name)).join(' / ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a pack-hunting hound beside a foe gives the hero +2 to hit it; a backstabbing goblin stabs twice as hard at a foe beside the hero', async () => {
    const out = [];
    /** The bonus shown on the hero's roll at an ogre in front, with the hound beside it (or not) at this rank. */
    const bonus = async (floors, beside) => {
      const ctx = await withHound('hound-pack-' + floors + beside);
      const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      clearAround(ctx);
      rollsOn(Game);
      Object.assign(p.stats, evenStats);
      c.floors = floors; c.mode = 'stay';
      const [dx, dy] = Dungeon.DIRS[p.dir], [lx, ly] = Dungeon.DIRS[(p.dir + 1) % 4];
      const m = { uid: 98, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      Object.assign(c, beside ? { x: m.x + lx, y: m.y + ly } : { x: p.x - dx, y: p.y - dy });
      for (let i = 0; i < 40; i++) {
        const mark = markLog(G);
        G.t = p.nextAttack; Game.input('attack');
        const l = linesSince(G, mark).map(x => x.match(/d20 \d+\+(\d+) vs AC/)).find(Boolean);
        if (l) return Number(l[1]);
      }
      return NaN;
    };
    const plain = await bonus(0, true), vetFar = await bonus(4, false), vetBy = await bonus(4, true), blooded = await bonus(2, true);
    if (!(vetBy === plain + 2)) out.push(`a veteran hound beside the ogre: +${vetBy}, against +${plain} with a new one`);
    if (vetFar !== plain) out.push(`a veteran hound behind the hero changed the roll to +${vetFar}`);
    if (blooded !== plain) out.push(`a blooded hound (no Pack Hunter yet) changed the roll to +${blooded}`);
    // the goblin: the same stab dice, doubled on a foe at the hero's side once blooded
    const stabs = async floors => {
      const ctx = await withGoblin('goblin-stab-' + floors);
      const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
      if (!c) return { err: 'no goblin' };
      clearAround(ctx);
      seedDice(ctx, 'goblin-stab');
      c.floors = floors; c.mode = 'stay';
      const [dx, dy] = Dungeon.DIRS[p.dir], [lx, ly] = Dungeon.DIRS[(p.dir + 1) % 4];
      const m = { uid: 99, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, ac: 1, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      Object.assign(c, { x: m.x + lx, y: m.y + ly });
      let total = 0, n = 0;
      for (let i = 0; i < 16000 && n < 150; i++) { const hp = m.hp; Game.update(G.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      return { mean: total / Math.max(1, n), n };
    };
    const g0 = await stabs(0), g2 = await stabs(2);
    if (g0.err || g2.err) out.push(g0.err || g2.err);
    else if (!(g0.n > 100 && g2.n > 100 && g2.mean > g0.mean * 1.7 && g2.mean < g0.mean * 2.4)) out.push(`a goblin's stabs: ${g0.mean.toFixed(2)} (${g0.n}) new, ${g2.mean.toFixed(2)} (${g2.n}) blooded`);
    return out.length ? out.join('; ') : true;
  });

  await test('a blooded hound\'s bite that lands sometimes holds its foe back; a veteran goblin finds something on each new floor', async () => {
    const out = [];
    const held = async floors => {
      const ctx = await withHound('hound-ham-' + floors);
      const { Game } = ctx; const G = Game.state(), c = Game.companion(), p = Game.player();
      clearAround(ctx);
      c.floors = floors; c.mode = 'stay';
      const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
      const m = { uid: 96, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, ac: 1, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(m);
      let bites = 0, slowed = 0;
      for (let i = 0; i < 16000 && bites < 150; i++) {
        const hp = m.hp; m.nextAct = G.t + 1e9;
        Game.update(G.t + 25, 25);
        if (m.hp < hp) { bites++; if (m.nextAct > G.t + 1e9) slowed++; }
      }
      return { bites, slowed };
    };
    const h0 = await held(0), h2 = await held(2);
    if (h0.slowed) out.push(`a new hound held its foe back ${h0.slowed} times`);
    if (!(h2.bites > 100 && h2.slowed > h2.bites * 0.2 && h2.slowed < h2.bites * 0.5)) out.push(`a blooded hound held back ${h2.slowed} of ${h2.bites} bitten`);
    // the goblin's finds, on floors it has not been to
    const ctx = await withGoblin('goblin-scrounge');
    const { Game } = ctx; const G = Game.state(), c = Game.companion(), p = Game.player();
    if (!c) return 'no goblin';
    c.floors = 3;
    const count = () => p.gold * 1000 + p.inv.reduce((a, i) => a + (i.q || 1), 0);
    const before = count();
    const mark = markLog(G);
    Game.level().monsters.length = 0; Game.descend();
    const said = linesSince(G, mark);
    if (Game.companionRank() !== 2) out.push(`after the fourth floor the goblin's rank is ${Game.companionRank()}`);
    if (count() === before || !said.some(l => l.includes(`${c.name} tips`) || l.includes(`${c.name} slips`))) out.push(`nothing found: ${said.join(' / ')}`);
    // a floor it has been to already brings nothing
    const again = count();
    c.deepest = G.depth + 1;
    Game.level().monsters.length = 0; Game.descend();
    if (count() !== again) out.push('it found something on a floor it had been down to');
    return out.length ? out.join('; ') : true;
  });

  await test('a charm given from the pack is worn by the companion: a collar turns blows, a fang bites harder, a rowan knot mends', async () => {
    const out = [];
    // no companion, nothing to give it to
    {
      const ctx = await start('fighter', 'charm-none');
      const p = ctx.Game.player(), it = { t: 'charm_fang', q: 1, e: 0 };
      p.inv.push(it);
      if (!ctx.Game.giveCharm(it) || !p.inv.includes(it)) out.push('a charm was given with no companion');
    }
    const ctx = await withHound('charm-give');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), c = Game.companion();
    const fang = { t: 'charm_fang', q: 1, e: 0 }, knot = { t: 'charm_rowan', q: 1, e: 0 };
    p.inv.push(fang, knot);
    const mark = markLog(G);
    if (Game.giveCharm(fang) || c.charm !== 'charm_fang' || p.inv.includes(fang)) out.push(`giving the fang: wears ${c.charm}`);
    if (!linesSince(G, mark).some(l => l.includes(`fang charm on ${c.name}`))) out.push(`said: ${linesSince(G, mark).join(' / ')}`);
    Game.giveCharm(knot);
    if (c.charm !== 'charm_rowan' || !p.inv.some(i => i.t === 'charm_fang')) out.push('a second charm did not hand back the first');
    if (!Game.threadNotes().some(n => n.includes('wearing the rowan knot'))) out.push('the hero sheet does not say what it wears');
    // the knot mends it, slowly, with no rest
    clearAround(ctx);
    c.hp = 1; c.mode = 'stay';
    run(Game, G, 20000);
    if (!(c.hp >= 4 && c.hp <= 7)) out.push(`in twenty seconds the knot mended it to ${c.hp}`);
    // the fang: the same bites, two more each
    const bites = async charm => {
      const b = await withHound('charm-fang-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); const back = seedAll(b, 'charm-fang');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 95, id: 'ogre', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let total = 0, n = 0;
      for (let i = 0; i < 16000 && n < 150; i++) { const hp = m.hp; b.Game.update(G2.t + 25, 25); m.nextAct = 1e12; if (m.hp < hp) { total += hp - m.hp; n++; } }
      back();
      return total / Math.max(1, n);
    };
    const plain = await bites(undefined), sharp = await bites('charm_fang');
    if (!(sharp - plain > 1.5 && sharp - plain < 2.5)) out.push(`the fang: ${plain.toFixed(2)} -> ${sharp.toFixed(2)} a bite`);
    // the collar: an orc beside it lands fewer blows
    const landed = async charm => {
      const b = await withHound('charm-collar-' + (charm || 'none'));
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      clearAround(b); const back = seedAll(b, 'charm-collar');
      h.charm = charm; h.mode = 'stay';
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      const m = { uid: 94, id: 'orc', x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: G2.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      let hits = 0;
      for (let i = 0; i < 12000; i++) { const hp = h.hp; b.Game.update(G2.t + 25, 25); if (h.hp < hp) hits++; h.hp = h.maxHp; h.fallen = 0; }
      back();
      return hits;
    };
    // one that falls leaves its charm where it fell, to be taken up again
    {
      const f = await withHound('charm-fall');
      const h = f.Game.companion(), G3 = f.Game.state(), P3 = f.Game.player();
      clearAround(f);
      h.charm = 'charm_fang'; h.mode = 'stay'; h.hp = h.maxHp = 3;
      const spot = f.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => Math.abs(x - P3.x) + Math.abs(y - P3.y) > 1 && !(x === P3.x && y === P3.y));
      f.Game.level().monsters.push({ uid: 92, id: 'ogre', x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: G3.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      for (let i = 0; i < 1200 && !h.fallen; i++) { f.Game.update(G3.t + 25, 25); P3.hp = P3.maxHp; }
      const k = `${h.x},${h.y}`;
      if (!h.fallen) out.push('the hound never fell');
      else if (h.charm || !(f.Game.level().items[k] || []).some(i => i.t === 'charm_fang')) out.push('a fallen hound\'s charm was lost with it');
    }
    const bare = await landed(undefined), collared = await landed('charm_collar');
    if (!(bare > 60 && collared < bare * 0.85)) out.push(`an orc landed ${bare} blows on a bare hound, ${collared} on a collared one`);
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes: the hound is not the hero, for smoke, the best blow or the trader\'s lamp; a cleric unhurt readies a spell that does something', async () => {
    const out = [];
    // the hound's bites are its own: not the hero's best blow, nor the hero's tally
    {
      const ctx = await withHound('own-bite');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      clearAround(ctx, 5);
      const dealt = Game.runStats().dealt, best = Game.runStats().best;
      const [dx, dy] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
      c.x = c.rx = p.x + dx; c.y = c.ry = p.y + dy; c.mode = 'stay';
      const m = beside(ctx, 'goblin', { awake: true }); m.x = m.rx = m.fromX = c.x + dx; m.y = m.ry = m.fromY = c.y + dy; m.hp = m.maxHp = 500; m.nextAct = 1e12;
      for (let i = 0; i < 400 && m.hp === 500; i++) Game.update(G.t + 25, 25);
      if (m.hp === 500) out.push('the hound never bit');
      else if (Game.runStats().dealt !== dealt || Game.runStats().best !== best) out.push(`the hound's bite counted as the hero's: ${JSON.stringify(Game.runStats().best)}`);
    }
    // a blow drawn back at the hound does not stop the hero's smoke hiding them
    {
      const ctx = await start('thief', 'smoke-pet', { levels: 6 });
      const { Game } = ctx; const p = Game.player();
      p.hp = p.maxHp = 9999; p.level = 5;
      Game.level().monsters.length = 0;
      const m = beside(ctx, 'orc', { awake: true });
      m.windup = { at: Game.state().t, until: Game.state().t + 900, kind: 'pet' };
      Game.useAbility();
      if (m.awake) out.push('a foe swinging at the hound stayed on the thief through the smoke');
      // and its blow is lost in the smoke, not left hanging to fall on the hound unwarned later
      if (m.windup) out.push('a blow drawn back at the hound was left hanging through the smoke');
    }
    // sleep by the lamp for a hurt hound's sake, and it wakes whole
    {
      const ctx = await withHound('lamp-hound');
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), c = Game.companion();
      clearAround(ctx, 4);
      const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy; L.npcs.push(shop);
      c.x = c.rx = p.x - dx; c.y = c.ry = p.y - dy;
      Game.input('forward');
      p.gold = 9999; p.hp = p.maxHp; p.sp = p.maxSp; c.hp = 1;
      const lodge = Game.shopServices().find(v => v.id === 'lodge');
      if (!lodge || lodge.why) out.push(`a hurt hound was no reason to sleep by the lamp: ${lodge && lodge.why}`);
      else { Game.buyService('lodge'); if (c.hp !== c.maxHp) out.push(`the hound woke with ${c.hp} of ${c.maxHp}`); }
    }
    // unhurt, a new cleric's Cast button is Bless, not a heal that would be wasted; hurt, the heal again
    {
      const ctx = await start('cleric', 'cleric-ready');
      const { Game } = ctx; const p = Game.player();
      p.hp = p.maxHp;
      const whole = Game.castLabel();
      p.hp = 1;
      const hurt = Game.castLabel();
      if (/Cure/.test(whole) || !/Cure/.test(hurt)) out.push(`the Cast button read ${whole} unhurt and ${hurt} hurt`);
    }
    // the bestiary tells what it learned in words, not labels
    {
      const ctx = await start('fighter', 'beast-words');
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 9999;
      const mark = markLog(G);
      const m = beside(ctx, 'goblin', { awake: true }); m.hp = 1;
      for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); Game.update(G.t + 25, 25); }
      // one line when the notes follow each other; two when a blow's line falls between
      const said = linesSince(G, mark).filter(l => /^Bestiary/.test(l)).join(' | ');
      if (Game.level().monsters.includes(m)) out.push('the goblin never fell');
      else if (said !== 'Bestiary: Goblin added, and you learned how tough it is.' && said !== 'Bestiary: Goblin added. | Bestiary: Goblin, you learned how tough it is.') out.push(`the bestiary said "${said}"`);
    }
    return out.length ? out.join('; ') : true;
  });
};
