// Rule checks for the deep floors' encounters and hazards: the Heartwell, the Last Delver, the warm egg, the kobold trapper, tremors, a prayer's time and lamp oil stocked.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function deepmeetsChecks(h) {
  const { start, markLog, linesSince, test, run, meetAndChoose, arena } = h;

  /** A hero on the sixth floor of eight, sturdy and rich, for the deep encounters. */
  const deepHero = async seed => {
    const ctx = await start('fighter', seed, { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 300; p.gold = 9999;
    while (G.depth < 6) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    return ctx;
  };

  await test('the Heartwell: a strong chest breathes its warmth for more life, gold down the shaft steadies the hand, a rest by it heals and costs food', async () => {
    const out = [];
    {
      const ctx = await deepHero('heartwell-breathe');
      const { Game } = ctx; const p = Game.player();
      p.stats.con = 30;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { p.hp = p.maxHp = 300; r = meetAndChoose(ctx, 'heartwell', 0); Game.closeEncounter(); }
      if (!r.check.pass) out.push('a strong chest never breathed its warmth');
      else if (p.maxHp !== 304) out.push(`its warmth left ${p.maxHp} maximum hit points, not 304`);
    }
    {
      const ctx = await deepHero('heartwell-gold');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      const g0 = p.gold;
      meetAndChoose(ctx, 'heartwell', 1); Game.closeEncounter();
      if (g0 - p.gold !== 10 * G.depth) out.push(`gold down the shaft cost ${g0 - p.gold}, not ${10 * G.depth}`);
      if (!p.effects.boon_hit || p.effects.boon_hit.amount !== 2) out.push(`gold down the shaft gave ${JSON.stringify(p.effects.boon_hit)}`);
    }
    {
      const ctx = await deepHero('heartwell-rest');
      const { Game } = ctx; const p = Game.player();
      p.hp = 100; p.food = 80;
      meetAndChoose(ctx, 'heartwell', 2); Game.closeEncounter();
      if (p.hp !== 115 || p.food !== 70) out.push(`a rest by it: ${p.hp} hit points (not 115), ${p.food} food (not 70)`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the Last Delver: a meal shared buys the floor and its traps; asked badly, they wake the floor; robbed well, their pack', async () => {
    const out = [];
    {
      const ctx = await deepHero('delver-meal');
      const { Game } = ctx; const L = Game.level();
      L.explored.fill(0);
      meetAndChoose(ctx, 'lastdelver', 0); Game.closeEncounter();
      if (!L.explored.every(v => v)) out.push('a shared meal did not lay out the floor');
      if (Object.keys(L.traps || {}).length && !L.trapsKnown) out.push('a shared meal did not tell the traps');
    }
    {
      const ctx = await deepHero('delver-ask');
      const { Game } = ctx; const p = Game.player();
      p.stats.wis = 1;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && !r.check.pass); i++) {
        const L = Game.level();
        r = meetAndChoose(ctx, 'lastdelver', 1); Game.closeEncounter();
        // (put a sleeper back on the floor to see whether it wakes: meeting clears the floor's monsters)
        if (r.check && !r.check.pass) break;
        void L;
      }
      if (r.check.pass) out.push('a dull wit asked well six times running');
      else if (!r.lines.some(l => /awake/.test(l))) out.push(`asked badly, they said: ${r.lines.join(' / ')}`);
    }
    {
      const ctx = await deepHero('delver-rob');
      const { Game } = ctx; const p = Game.player();
      p.stats.dex = 30;
      let r = null;
      const held = () => p.inv.reduce((a, it) => a + (it.q || 1), 0);
      let before = 0;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { before = held(); r = meetAndChoose(ctx, 'lastdelver', 2); Game.closeEncounter(); }
      if (!r.check.pass) out.push('quick fingers never robbed them');
      else if (!r.lines.some(l => /^Found: /.test(l))) out.push(`robbed, they gave: ${r.lines.join(' / ')} (${before} -> ${held()})`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a warm egg: smashed, a deal of experience and the floor wakes; a hand warmed at it heals a little', async () => {
    const out = [];
    {
      const ctx = await deepHero('egg-smash');
      const { Game } = ctx; const p = Game.player();
      const xp = p.xp;
      const r = meetAndChoose(ctx, 'wyrmegg', 0); Game.closeEncounter();
      if (p.xp - xp < 60) out.push(`smashed, it gave ${p.xp - xp} experience`);
      if (!r.lines.some(l => /awake/.test(l))) out.push(`smashed, it said: ${r.lines.join(' / ')}`);
    }
    {
      const ctx = await deepHero('egg-warm');
      const { Game } = ctx; const p = Game.player();
      p.hp = 100;
      meetAndChoose(ctx, 'wyrmegg', 2); Game.closeEncounter();
      if (p.hp !== 112) out.push(`a hand warmed at it: ${p.hp} hit points, not 112`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a kobold trapper backs off to throw, sets a snare between you that is seen and can be sprung from before it, and its snares go slack when it dies', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-kobold');
    L.twist = null; L.traps = {};
    // beside the hero it steps back, if it has room
    let k = put('kobold', 1, 0, { hp: 40, maxHp: 40, nextAct: G.t });
    run(Game, G, 200);
    if (Math.abs(k.x - p.x) + Math.abs(k.y - p.y) !== 2) out.push(`beside the hero the kobold stood ${Math.abs(k.x - p.x) + Math.abs(k.y - p.y)} off`);
    // three squares off it sets a snare on the square before the hero
    L.monsters.length = 0;
    let set = false;
    for (let i = 0; i < 30 && !set; i++) {
      L.monsters.length = 0; L.traps = {}; L.snares = {};
      k = put('kobold', 3, 0, { hp: 40, maxHp: 40, nextAct: G.t });
      run(Game, G, 30);
      if (k.windup && k.windup.move === 'snare') { run(Game, G, 1000); set = true; }
    }
    const [sx, sy] = at(1), sk = `${sx},${sy}`;
    if (!set) out.push('three squares off, the kobold never set a snare in thirty chances');
    else if (!L.snares[sk] || L.traps[sk] !== 'snare') out.push(`the snare was set at ${JSON.stringify(L.snares)}`);
    // seen: the Use button springs it from before it, and that is the answer
    if (Game.useLabel() !== 'Disarm') out.push(`before a snare the Use button read "${Game.useLabel()}"`);
    Game.input('use');
    if (L.snares[sk] || L.traps[sk]) out.push('Use did not spring the snare ahead');
    if (!(Game.bestiary().kobold || {}).answer) out.push('springing a snare from before it was not counted the answer');
    // walked into, it holds the hero (unless a quick foot pulls clear: tried a few times)
    let held = false;
    p.stats.dex = 3;
    for (let i = 0; i < 6 && !held; i++) {
      p.held = 0;
      L.traps[sk] = 'snare'; L.snares[sk] = k.uid;
      p.x = sx - Dungeon.DIRS[p.dir][0]; p.y = sy - Dungeon.DIRS[p.dir][1];
      G.t = Math.max(G.t, p.nextMove || 0) + 400;
      Game.input('forward'); run(Game, G, 50);
      if (p.held > G.t && p.heldBy === 'snare') held = true;
    }
    if (!held) out.push('walking into a snare never held the hero');
    // its snares go slack when it dies
    p.held = 0;
    const [tx, ty] = at(2);
    L.traps[`${tx},${ty}`] = 'snare'; L.snares[`${tx},${ty}`] = k.uid;
    const mark = markLog(G);
    k.hp = 1;
    put('kobold', 5, 0, { uid: 77777, hp: 40, maxHp: 40 });
    L.traps['9,9'] = 'snare'; L.snares['9,9'] = 77777;
    k.nextAct = 1e12;
    p.x = k.x - Dungeon.DIRS[p.dir][0]; p.y = k.y - Dungeon.DIRS[p.dir][1];
    for (let i = 0; i < 10 && L.monsters.includes(k); i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); run(Game, G, 30); }
    if (L.monsters.includes(k)) out.push('could not kill the kobold');
    else {
      if (L.snares[`${tx},${ty}`] || L.traps[`${tx},${ty}`]) out.push('a dead kobold\'s snare stayed set');
      if (!L.snares['9,9']) out.push('another kobold\'s snare went slack with the first');
      if (!linesSince(G, mark).some(l => /goes slack/.test(l))) out.push('the slack snare was not told');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('tremors: on a middle floor dealt them, the ground shudders now and then and marks where rock will land, the hero\'s square among them; it lands on whatever stands there', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-quake');
    // dealt over floors already twisted, from the third floor down, the rest of the plan as it was
    let dealt = 0;
    for (let i = 0; i < 300; i++) {
      const seed = 'qk-' + i, a = Dungeon.twistPlan(seed, 8), b = Dungeon.twistPlan(seed, 8, false);
      // (a deep smouldering floor is added on its own dice, not dealt over another: left out here)
      for (const d in a) if (a[d] === 'smouldering') delete a[d];
      if (Object.keys(a).join() !== Object.keys(b).join()) { out.push(`${seed}: twisted floors ${Object.keys(a)} against ${Object.keys(b)}`); break; }
      for (const d in a) if (a[d] === 'tremors') { dealt++; if (+d < 3) out.push(`${seed}: tremors on floor ${d}`); }
    }
    if (dealt < 10) out.push(`tremors dealt on only ${dealt} floors in 300 seeds`);
    // a plain floor never shudders
    L.twist = null; L.quake = { next: G.t, falls: [] };
    run(Game, G, 100);
    if (L.quake.falls.length) out.push('a plain floor shuddered');
    // a floor of tremors: marks round the hero, the hero's own square among them, and told
    L.twist = 'tremors'; L.quake = { next: G.t, falls: [] };
    const g = put('goblin', 1);
    let mark = markLog(G);
    run(Game, G, 50);
    const falls = L.quake.falls;
    if (!falls.some(f => f.x === p.x && f.y === p.y)) out.push(`the hero's square was not marked: ${JSON.stringify(falls)}`);
    if (falls.length < 3) out.push(`only ${falls.length} squares marked`);
    if (falls.some(f => Math.abs(f.x - p.x) + Math.abs(f.y - p.y) > 3)) out.push('rock was marked more than three squares off');
    if (falls.some(f => L.tiles[f.y * L.w + f.x] !== Dungeon.T.FLOOR)) out.push('rock was marked off the floor');
    if (!linesSince(G, mark).some(l => /ground shudders/.test(l))) out.push('the shudder was not told');
    if (!(Game.renderState(0).fx.rocks || []).length) out.push('the marks were not given to the view');
    // standing still under it: the rock lands on the hero, and on a foe that stands under it too
    const [gx, gy] = at(1);
    L.quake.falls = [{ x: p.x, y: p.y, at: G.t, lands: G.t + 300 }, { x: gx, y: gy, at: G.t, lands: G.t + 300 }];
    mark = markLog(G);
    run(Game, G, 400);
    if (p.hp >= 9999) out.push('rock landing on the hero did no harm');
    if (g.hp >= 999) out.push('rock landing on a goblin did it no harm');
    if (!linesSince(G, mark).some(l => /crashes down on you/.test(l))) out.push('the rock on the hero was not told');
    if (L.quake.falls.length) out.push('the fallen rock stayed marked');
    if (!L.dressing.some(o => o.k === 'rubble' && o.x === gx && o.y === gy)) out.push('fallen rock left no rubble');
    // stepping off in time: no harm
    p.hp = 9999;
    L.quake.falls = [{ x: p.x, y: p.y, at: G.t, lands: G.t + 1000 }];
    const [lx, ly] = at(0, 1);
    p.x = lx; p.y = ly;
    run(Game, G, 1100);
    if (p.hp !== 9999) out.push('rock hurt a hero who had stepped off its mark');
    // nothing falls while the hero stands on the stairs
    const t = L.tiles[p.y * L.w + p.x];
    L.tiles[p.y * L.w + p.x] = Dungeon.T.STAIRS_DOWN; L.quake = { next: G.t, falls: [] };
    run(Game, G, 50);
    if (L.quake.falls.length) out.push('rock was marked round a hero on the stairs');
    L.tiles[p.y * L.w + p.x] = t;
    // and it shudders again, in sixteen to twenty-four seconds
    if (!(L.quake.next >= G.t + 15000 && L.quake.next <= G.t + 24000)) out.push(`the next shudder is ${L.quake.next - G.t}ms off`);
    return out.length ? out.join('; ') : true;
  });

  await test('a cleric\'s prayer takes 0.85 seconds: slower than a druid\'s words or a mage\'s, quicker than it was (a second)', async () => {
    const out = [];
    const took = {};
    for (const [cls, id] of [['cleric', 'bless'], ['druid', 'thorn_lash'], ['mage', 'shield']]) {
      const { Game, G, p, put, ctx } = await arena(cls, 'el-pray-' + cls);
      if (id === 'thorn_lash') put('goblin', 2);
      G.t = Math.max(G.t, p.nextAttack) + 10;
      const sp = ctx.SPELLS[cls].find(s => s.id === id);
      if (!Game.castSpell(sp)) { out.push(`${cls} could not cast ${id}`); continue; }
      took[cls] = p.nextAttack - G.t;
    }
    if (took.cleric !== 850) out.push(`a cleric's prayer took ${took.cleric}ms`);
    if (!(took.druid < took.cleric && took.mage < took.druid)) out.push(`prayer ${took.cleric}, druid ${took.druid}, mage ${took.mage}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a trader on a floor saved before there were flasks of lamp oil stocks some as it loads, once: bought out, it stays bought out', async () => {
    const out = [];
    const { Game, L, at } = await arena('fighter', 'el-oldstock');
    const [x, y] = at(4, 1);
    // an old save: a trader with no lamp oil, on a floor not yet stocked
    L.npcs = [{ id: 'merchant', x, y, stock: [{ t: 'potion_heal', q: 2, e: 0 }], markup: 1, greeted: false }];
    delete L.lampOil;
    Game.save(true); Game.load();
    const t = () => Game.level().npcs.find(n => n.id === 'merchant');
    const oil = () => t().stock.find(i => i.t === 'lamp_oil');
    if (!oil() || !(oil().q >= 2)) out.push(`an old save's trader stocked ${oil() ? oil().q : 'no'} flasks`);
    // every flask bought (the stock line gone), and loaded again: none come back
    t().stock = t().stock.filter(i => i.t !== 'lamp_oil');
    Game.save(true); Game.load();
    if (oil()) out.push('a trader bought out of lamp oil was stocked again by a reload');
    return out.length ? out.join('; ') : true;
  });
};
