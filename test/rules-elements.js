// Rule checks for the living dungeon: fire, ice, oil and water acting on the place (elements.js), the testing aids, the mimic, the smouldering floor, the emberling and the forge-spirit.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function elementsChecks(h) {
  const { OPTS, evenStats, start, markLog, countSaid, linesSince, test, beside, run, meetAndChoose, arena } = h;

  // ---------- the living dungeon: the elements act on the place (elements.js) ----------

  await test('lightning striking something in water runs through it to all else standing in it within two squares, the hero too; not on dry stone; a puddle carries it too', async () => {
    const out = [];
    const { G, L, p, put, at, cast } = await arena('mage', 'el-arc');
    // dry stone: the bolt takes only its line
    L.twist = null;
    let a = put('goblin', 3), b = put('goblin', 3, 1);
    cast('lightning');
    if (a.hp === 999) out.push('the bolt missed its target');
    if (b.hp !== 999) out.push('lightning ran across dry stone');
    // a flooded floor: it runs through the water to the one beside, not to a hero three squares off
    L.twist = 'flooded'; L.monsters.length = 0;
    a = put('goblin', 3); b = put('goblin', 3, 1);
    let hp0 = p.hp;
    cast('lightning');
    if (b.hp === 999) out.push('lightning in black water did not reach the one beside');
    if (p.hp !== hp0) out.push('lightning three squares off reached the hero');
    // struck two squares off, it reaches the hero wading there too
    L.monsters.length = 0;
    a = put('goblin', 2);
    hp0 = p.hp;
    cast('lightning');
    if (!(p.hp < hp0)) out.push('lightning two squares off in black water spared the hero');
    // a puddle on a dry floor carries it between the two standing in it
    L.twist = null; L.monsters.length = 0;
    a = put('goblin', 4); b = put('goblin', 4, 1);
    for (const m of [a, b]) L.dressing.push({ x: m.x, y: m.y, k: 'puddle', ox: 0, oy: 0, r: 0.3 });
    cast('lightning');
    if (b.hp === 999) out.push('a puddle did not carry the lightning');
    // and ice carries none
    L.twist = 'flooded'; L.dressing = []; L.monsters.length = 0;
    a = put('goblin', 4); b = put('goblin', 4, 1);
    const [bx, by] = at(4, 1); L.fields[`${bx},${by}`] = { k: 'ice', until: G.t + 1e6 };
    cast('lightning');
    if (b.hp !== 999) out.push('lightning ran into ice');
    return out.length ? out.join('; ') : true;
  });

  await test('cold striking something in water freezes the water round it and holds whatever stands there, the hero if beside it; a drowned one cannot rise through the ice; the ice melts', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-ice');
    L.twist = 'flooded';
    let a = put('goblin', 2, 0, { nextAct: G.t }), b = put('goblin', 2, 1, { nextAct: G.t });
    cast('cone_cold');
    const [ax, ay] = at(2), [bx, by] = at(2, 1);
    if (!Game.fieldAt(ax, ay) || Game.fieldAt(ax, ay).k !== 'ice' || !Game.fieldAt(bx, by) || Game.fieldAt(bx, by).k !== 'ice') out.push('the water did not freeze round what the cold struck');
    if (!(b.nextAct > G.t + 1500)) out.push('the one beside it was not held by the ice');
    if (b.heldBy !== 'ice') out.push(`what held it was marked ${b.heldBy}, not ice, for its picture`);
    if (p.held > G.t) out.push('ice two squares off held the hero');
    // struck beside the hero, the ice takes the hero's feet too; a drowned one beside cannot come up through it
    L.fields = {}; L.monsters.length = 0;
    a = put('goblin', 1);
    const dr = put('drowned', 1, 1, { sunk: true, awake: false, nextAct: G.t });
    cast('cone_cold');
    if (!(p.held > G.t) || p.heldBy !== 'ice') out.push(`cold beside the hero left them free (held ${p.held > G.t}, ${p.heldBy})`);
    run(Game, G, 2000);
    if (!dr.sunk) out.push('a drowned one rose through the ice');
    run(Game, G, 8000);
    const [fx, fy] = at(1);
    if (Game.fieldAt(fx, fy)) out.push('the ice never melted');
    if (dr.sunk) out.push('the drowned one stayed down once the ice had gone');
    // dry stone does not freeze
    L.twist = null; L.fields = {}; L.monsters.length = 0;
    a = put('goblin', 2);
    cast('cone_cold');
    if (Object.keys(L.fields).length) out.push('cold froze dry stone');
    return out.length ? out.join('; ') : true;
  });

  await test('fire sets moss alight: it spreads, burns what stands in it, the hero too, burns out a few squares from where it caught, and leaves ash that does not burn again', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-moss');
    L.twist = 'overgrown';
    const a = put('goblin', 1);
    cast('burning_hands');
    const [ax, ay] = at(1);
    if (!Game.fieldAt(ax, ay) || Game.fieldAt(ax, ay).k !== 'fire') out.push('fire on moss did not catch');
    const hp0 = a.hp;
    run(Game, G, 1500);
    if (!(a.hp < hp0)) out.push('the goblin stood in the fire unhurt');
    run(Game, G, 20000);
    // (a door beside the burning moss burns too, and is no moss: its ash is not counted)
    const ash = Object.keys(L.fields).filter(k => L.fields[k].k === 'ash' && !L.fields[k].door).map(k => k.split(',').map(Number));
    if (ash.length < 3) out.push(`the fire burnt only ${ash.length} squares`);
    const far = ash.filter(([x, y]) => Math.abs(x - ax) + Math.abs(y - ay) > 2);
    if (far.length) out.push(`moss burnt ${far.length} squares beyond two of where it caught`);
    if (Object.values(L.fields).some(f => f.k === 'fire')) out.push('the fire never burnt out');
    // ash does not burn again, and dry stone never catches
    L.monsters.length = 0;
    const b = put('goblin', 1);
    L.fields[`${b.x},${b.y}`] = { k: 'ash', until: 0 };
    cast('burning_hands');
    if (Game.fieldAt(b.x, b.y).k !== 'ash') out.push('ash caught fire again');
    L.twist = null; L.fields = {}; L.monsters.length = 0; put('goblin', 1);
    cast('burning_hands');
    if (Object.keys(L.fields).length) out.push('fire caught on bare stone');
    // standing in fire hurts the hero
    L.fields = {}; L.monsters.length = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'moss', until: G.t + 3000, spread: 1e15, burn: G.t, gen: 9 };
    const hp1 = p.hp;
    run(Game, G, 300);
    if (!(p.hp < hp1)) out.push('the hero stood in the flames unhurt');
    return out.length ? out.join('; ') : true;
  });

  await test('a third of the barrels are oil casks: broken, one spills oil; fire on the blade lights it, it burns through the oil, and bursts a cask it reaches', async () => {
    const out = [];
    // how many barrels hold oil, over many floors
    {
      const ctx = await start('fighter', 'casks');
      const { Game } = ctx;
      let barrels = 0, casks = 0;
      for (let i = 0; i < 12; i++) {
        Game.newGame({ name: 'C', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'cask-' + i, opts: { ...OPTS, levels: 8, size: 'large' } });
        for (let k = 0; k < 3; k++) {
          for (const q of Game.level().dressing || []) { if (q.k === 'barrel') barrels++; if (q.k === 'oilcask') casks++; }
          if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
          Game.descend();
        }
      }
      const share = casks / Math.max(1, barrels + casks);
      if (!(barrels + casks > 20 && share > 0.2 && share < 0.5)) out.push(`${casks} casks among ${barrels + casks} barrels`);
    }
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-oil');
    L.twist = null;
    const [cx, cy] = at(1);
    L.dressing.push({ x: cx, y: cy, k: 'oilcask', ox: 0, oy: 0 });
    Game.input('forward');
    if (L.dressing.some(q => q.k === 'oilcask')) out.push('walking into the cask did not break it');
    const oil = Object.keys(L.fields).filter(k => L.fields[k].k === 'oil');
    if (oil.length < 3) out.push(`a broken cask spilt oil on ${oil.length} squares`);
    if (Game.fieldAt(p.x, p.y)) out.push('a kicked cask spilt oil under the hero\'s own feet');
    // a second cask, whole, beside the oil
    const [kx, ky] = at(2, 1);
    L.dressing.push({ x: kx, y: ky, k: 'oilcask', ox: 0, oy: 0 });
    // a flaming blade lights the oil under a goblin
    p.eq.weapon = { t: 'longsword', q: 1, e: 0, pw: 'flame' }; p.stats.str = 30;
    const g = put('goblin', 1);
    let lit = false;
    for (let i = 0; i < 12 && !lit; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); lit = !!Game.fieldAt(g.x, g.y) && Game.fieldAt(g.x, g.y).k === 'fire'; }
    if (!lit) out.push('a flaming blade did not light the oil under its target');
    // (how fast fire creeps from square to square is down to its dice: it is given a while to finish)
    for (let i = 0; i < 8 && (i < 3 || Object.values(L.fields).some(f => f.k === 'oil')); i++) run(Game, G, 1000);
    if (Object.values(L.fields).some(f => f.k === 'oil')) out.push('the fire did not burn through all the oil');
    if (L.dressing.some(q => q.k === 'oilcask')) out.push('the fire reached a cask and did not burst it');
    // what the fire leaves is kept with the save
    L.fields['3,3'] = { k: 'ash', until: 0 };
    Game.save(true);
    if (!Game.load()) out.push('load failed');
    else if (!Game.fieldAt(3, 3) || Game.fieldAt(3, 3).k !== 'ash') out.push('the ash was not kept with the save');
    return out.length ? out.join('; ') : true;
  });

  await test('the living will not walk into fire, and one caught in it gets out; the dead come on through it', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-shy');
    L.twist = null;
    // a wall of fire across the passage two squares ahead
    const wall = () => { for (const j of [-1, 0, 1]) { const [x, y] = at(2, j); L.fields[`${x},${y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e9, spread: 1e15, burn: 1e15, gen: 0 }; } };
    wall();
    const gob = put('goblin', 4, 0, { nextAct: G.t });
    run(Game, G, 4000);
    const near = Math.abs(gob.x - p.x) + Math.abs(gob.y - p.y);
    if (near <= 2) out.push(`a goblin came through the fire to ${near} squares`);
    if (!gob.balkSaid) out.push('the goblin never shied back from the flames');
    // the dead do not care
    L.monsters.length = 0;
    const bones = put('skeleton', 4, 0, { nextAct: G.t });
    let reached = false;
    for (let t = 0; t < 8000 && !reached; t += 25) { Game.update(G.t + 25, 25); reached = Math.abs(bones.x - p.x) + Math.abs(bones.y - p.y) <= 1; }
    if (!reached) out.push('a skeleton would not come through the fire');
    // one standing in fire gets out of it, even right beside the hero, where it would otherwise stand and swing
    L.monsters.length = 0; L.fields = {};
    const [fx, fy] = at(1);
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e9, spread: 1e15, burn: 1e15, gen: 0 };
    const caught = put('goblin', 1, 0, { nextAct: G.t });
    run(Game, G, 1200);
    if (caught.x === fx && caught.y === fy) out.push('a goblin stood on in the flames');
    return out.length ? out.join('; ') : true;
  });

  await test('a Pyromancer\'s Burning Hands reach three squares down the passage; anyone else\'s one', async () => {
    const out = [];
    for (const pyro of [true, false]) {
      const { p, G, L, put, at, Game, ctx } = await arena('mage', 'el-pyro-' + pyro);
      L.twist = null;
      if (pyro) p.path = 'pyromancer';
      const g = put('goblin', 3);
      G.t = Math.max(G.t, p.nextAttack) + 10;
      const sp = ctx.SPELLS.mage.find(s => s.id === 'burning_hands');
      const cast = Game.castSpell(sp);
      if (pyro && !(g.hp < 999)) out.push('a Pyromancer\'s Burning Hands did not reach three squares');
      if (!pyro && (cast || g.hp < 999)) out.push('Burning Hands reached three squares without the path');
      if (Game.spellCost(sp) !== sp.cost + (pyro ? 1 : 0)) out.push(`Burning Hands cost ${Game.spellCost(sp)} ${pyro ? 'to a Pyromancer' : 'to another mage'}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a Bash is seen: the shield (or pommel) shoves and the foe flashes and reels with no wound; a snare cord and a flask are thrown from the hand and fly (the cord heard as it leaves), the spill drawn when the flask lands; oiling a blade is seen', async () => {
    const out = [];
    { const { Game, G, p, put } = await arena('fighter', 'see-bash');
      p.eq.shield = { t: 'shield', q: 1, e: 0 };
      const m = put('orc', 1);
      const fx = Game.renderState(0).fx;
      fx.bashAt = -1e9; G.t = Math.max(G.t, p.nextAttack, p.abilityReady || 0) + 10;
      if (!Game.useAbility()) out.push('the bash would not go');
      if (!(fx.bashAt > -1e9) || fx.bashKind !== 'shield') out.push(`no shove drawn (${fx.bashKind})`);
      if (!(m.flashUntil > m.flashAt && m.flashAt > 0)) out.push('the orc did not flash at the blow');
      if (m.hp !== 999) out.push('a plain bash wounded the orc');
      if (!fx.texts.some(t => t.text === 'reels')) out.push('no word over the orc'); }
    { const { Game, G, p, put } = await arena('ranger', 'see-snare');
      put('orc', 3);
      const fx = Game.renderState(0).fx;
      fx.throwAt = -1e9; fx.spells.length = 0; G.t = Math.max(G.t, p.nextAttack, p.abilityReady || 0) + 10;
      if (!Game.useAbility()) out.push('the snare would not go');
      if (!(fx.throwAt > -1e9) || fx.throwKind !== 'cord') out.push(`no throw drawn for the snare (${fx.throwKind})`);
      if (!fx.spells.some(s => s.style === 'cord' && s.pts.length === 1)) out.push('no cord in flight to the orc'); }
    // the cord is heard as it leaves the hand, not as the button is pressed
    { const ctx = await start('ranger', 'hear-snare'); const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
      const [dx, dy] = Dungeon.DIRS[p.dir], L = Game.level();
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      beside(ctx, 'orc', { nextAct: 1e12 });
      const heard = [];
      ctx.Sound.listen(name => heard.push(name));
      try {
        G.t = Math.max(G.t, p.nextAttack, p.abilityReady || 0) + 10;
        Game.useAbility();
        if (heard.includes('shoot')) out.push('the snare was heard before it left the hand');
        await new Promise(r => setTimeout(r, 400));
        if (!heard.includes('shoot')) out.push('the snare was never heard');
      } finally { ctx.Sound.listen(null); } }
    // working an oil into the weapon is seen: the flask comes up and is tipped over it
    { const ctx = await start('fighter', 'see-coat'); const { Game } = ctx; const p = Game.player();
      p.eq.weapon = { t: 'shortsword', q: 1, e: 0 };
      p.inv.push({ t: 'oil_fire', q: 1, e: 0 });
      const fx = Game.renderState(0).fx; fx.useAt = -1e9;
      Game.useItem(p.inv.find(i => i.t === 'oil_fire'));
      if (!(fx.useAt > -1e9) || fx.useKind !== 'coat' || !fx.useSprite) out.push(`oiling the blade showed ${fx.useKind} (${fx.useSprite})`); }
    { const { Game, G, p, at } = await arena('thief', 'see-flask');
      p.inv.push({ t: 'lamp_oil', q: 1, e: 0 });
      const fx = Game.renderState(0).fx;
      fx.throwAt = -1e9; fx.spells.length = 0; fx.landings = []; G.t = Math.max(G.t, p.nextAttack) + 10;
      Game.useItem(p.inv.find(i => i.t === 'lamp_oil'));
      const [x3, y3] = at(3);
      if (!(fx.throwAt > -1e9) || fx.throwKind !== 'flask') out.push(`no throw drawn for the flask (${fx.throwKind})`);
      if (!fx.spells.some(s => s.style === 'flask')) out.push('no flask in flight');
      const land = fx.landings[fx.landings.length - 1];
      // (all five squares the spill runs onto, each with what lay there: nothing)
      if (!land || land.x !== x3 || land.y !== y3 || !(land.at > fx.throwAt) || Object.keys(land.was).length !== 5 || Object.values(land.was).some(k => k !== '')) out.push(`the spill is not held for the landing (${JSON.stringify(fx.landings)})`);
      // a second flask while the first is in the air keeps the first one's landing too
      p.inv.push({ t: 'lamp_oil', q: 1, e: 0 }); G.t = Math.max(G.t, p.nextAttack) + 10;
      Game.useItem(p.inv.find(i => i.t === 'lamp_oil'));
      if (fx.landings.length !== 2 || fx.landings[1].was[`${x3},${y3}`] !== 'oil') out.push(`two flasks in the air kept ${JSON.stringify(fx.landings)}`);
      if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('the oil was not spilt at once (the rules must not wait on the picture)'); }
    return out.length ? out.join('; ') : true;
  });

  await test('lamp oil floats on water: thrown on a flooded floor it spreads over the water, burns there, and the water under it still carries lightning until it burns', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('mage', 'el-afloat');
    L.twist = 'flooded';
    p.inv.push({ t: 'lamp_oil', q: 2, e: 0 });
    const a = put('goblin', 3), b = put('goblin', 3, 1);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    const mark = markLog(G);
    Game.useItem(p.inv.find(i => i.t === 'lamp_oil'));
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask thrown on the water left no oil there');
    if (!linesSince(G, mark).some(l => /over the water/.test(l))) out.push(`no word of oil on the water (${linesSince(G, mark).join(' | ')})`);
    // oil on the water still lets the lightning through to the one beside
    cast('lightning');
    if (b.hp === 999) out.push('oil on the water stopped the lightning');
    // and a flame sets it alight on the water
    L.fields[`${x3},${y3}`] = { k: 'oil' };
    a.hp = 999; b.hp = 999;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.state().lastSpell = null;
    const sp = Game.knownSpells().find(s => s.id === 'burning_hands');
    L.monsters.length = 0; L.fields = {};
    const [x1, y1] = at(1); L.fields[`${x1},${y1}`] = { k: 'oil' };
    if (!Game.castSpell(sp)) out.push('a fire spell at oil on the water was refused');
    if (!Game.fieldAt(x1, y1) || Game.fieldAt(x1, y1).k !== 'fire') out.push('oil on the water did not catch');
    return out.length ? out.join('; ') : true;
  });

  await test('now and then a floor lays out a scene for fire (casks among sleepers, an oil-slick way in, casks at a locked door), the same for a seed, named once as the hero comes near', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    const found = {};
    for (let s = 0; s < 30 && Object.keys(found).length < 3; s++) {
      const ctx = await start('fighter', 'scene-' + s, REAL);
      const { Game } = ctx;
      for (let d = 2; d <= 7; d++) {
        Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts');
        const L = Game.level();
        for (const pc of L.pieces || []) if (!found[pc.k]) found[pc.k] = { ctx, seed: 'scene-' + s, depth: Game.state().depth, pc, L };
      }
    }
    for (const k of ['cache', 'slick', 'barricade']) if (!found[k]) out.push(`no ${k} in thirty seeds`);
    const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const casksBy = (L, x, y) => (L.dressing || []).filter(q => q.k === 'oilcask' && DIRS4.some(([dx, dy]) => q.x === x + dx && q.y === y + dy));
    if (found.cache) {
      const { L } = found.cache;
      const beside = L.monsters.filter(m => casksBy(L, m.x, m.y).length).length;
      if (beside < 2) out.push(`a cache had casks beside ${beside} sleepers`);
    }
    if (found.slick) {
      const { L } = found.slick;
      if (Object.values(L.fields || {}).filter(f => f.k === 'oil').length < 3) out.push('an oil-slick way in had under three squares of oil');
    }
    if (found.barricade) {
      const { L, pc } = found.barricade;
      if (L.tiles[pc.y * L.w + pc.x] !== found.barricade.ctx.Dungeon.T.DOOR_LOCKED) out.push('a barricade was not at a locked door');
      if (!casksBy(L, pc.x, pc.y).length) out.push('no casks stood against the barricaded door');
    }
    // named once, as the hero comes near
    if (found.cache) {
      const { ctx, L, pc, depth } = found.cache;
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      // back on the cache's own floor (the search went on down), its sleepers left asleep
      if (G.depth !== depth) Game.testFloor(depth);
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      const mark = markLog(G);
      p.x = pc.x; p.y = pc.y;
      run(Game, G, 200); run(Game, G, 200);
      const said = countSaid(linesSince(G, mark), /Oil casks stand among/);
      if (said !== 1) out.push(`the cache was named ${said} times`);
    }
    // the same seed lays the same scene
    if (found.slick) {
      const again = await start('fighter', found.slick.seed, REAL);
      let pc2 = null;
      for (let d = 2; d <= found.slick.depth; d++) { again.Game.descend(); if (again.Game.forkPending()) again.Game.chooseRoute('crypts'); }
      pc2 = (again.Game.level().pieces || [])[0];
      if (!pc2 || pc2.k !== 'slick' || pc2.x !== found.slick.pc.x || pc2.y !== found.slick.pc.y) out.push(`the same seed laid ${JSON.stringify(pc2)}, not ${JSON.stringify(found.slick.pc)}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('testing aids: endless life, spell points and gold keep the hero topped up and alive; a run that had one on is written nowhere', async () => {
    const out = [];
    const { Game, G, L, p, put, ctx } = await arena('mage', 'el-testing');
    p.maxHp = 20; p.hp = 20; p.maxSp = 30; p.sp = 30; p.gold = 5;
    Game.setTesting({ hp: true, sp: true, gold: true });
    run(Game, G, 50);
    if (!Game.testingOn() || !Game.tested()) out.push('the aids did not mark the run');
    if (p.gold < 99999) out.push(`endless gold left ${p.gold}`);
    // a blow far past the hero's life
    const o = put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 20; i++) { o.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o.nextAct = G.t; o.blows = 3; run(Game, G, 300); }
    if (G.status !== 'playing') out.push(`endless life let the hero ${G.status}`);
    if (p.hp !== p.maxHp) out.push(`endless life left ${p.hp} of ${p.maxHp}`);
    L.monsters.length = 0;
    // a spell cast costs nothing that stays spent
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.castSpell(ctx.SPELLS.mage.find(s => s.id === 'shield'));
    run(Game, G, 50);
    if (p.sp !== p.maxSp) out.push(`endless spell points left ${p.sp} of ${p.maxSp}`);
    // switched off, the run stays marked: its death is not remembered, nor written in the Hall
    Game.setTesting({});
    const hallBefore = localStorage.getItem('deepdelve.hall');
    const fallenBefore = JSON.stringify(ctx.Progress ? ctx.Progress.fallen() : null);
    p.hp = 1; L.monsters.length = 0;
    const o2 = put('ogre', 1, 0, { hp: 999, maxHp: 999, nextAct: G.t });
    for (let i = 0; i < 60 && G.status === 'playing'; i++) { o2.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o2.nextAct = G.t; o2.blows = 3; run(Game, G, 300); }
    if (G.status !== 'dead') out.push('with the aids off, the hero did not die');
    if (localStorage.getItem('deepdelve.hall') !== hallBefore) out.push('a test run was written in the Hall');
    if (ctx.Progress && JSON.stringify(ctx.Progress.fallen()) !== fallenBefore) out.push('a test run\'s death was remembered for the bones');
    return out.length ? out.join('; ') : true;
  });

  await test('testing tools: go to a floor (the road given past the divided stair), reveal it, gain a level, be given an item, a relic or the floor\'s keys; each marks the run, and the eye does too', async () => {
    const out = [];
    const ctx = await start('fighter', 'el-tools', { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true });
    const { Game, Dungeon } = ctx;
    const G = Game.state(), p = Game.player();
    // standing still is no tool used
    if (Game.testFloor(1) || Game.tested()) out.push('going to the floor you are on did something');
    // down past the fork, by the road asked for
    const fork = Dungeon.routeSpan(8).fork;
    if (!Game.testFloor(fork + 2, 'warrens')) out.push('could not go down');
    if (G.depth !== fork + 2) out.push(`carried to floor ${G.depth}, not ${fork + 2}`);
    if (G.route !== 'warrens') out.push(`past the divided stair the road was ${G.route}`);
    if (!Game.tested()) out.push('going to a floor did not mark the run');
    const L = Game.level();
    if (p.x !== L.start.x || p.y !== L.start.y) out.push('carried down, the hero was not at the stair\'s foot');
    if (p.deepest < fork + 2) out.push('the deepest floor was not kept');
    // back up, and down again: the road taken stays taken
    Game.testFloor(2);
    const up = Game.level();
    if (G.depth !== 2) out.push(`carried up to floor ${G.depth}`);
    const back = up.downStart || up.start;
    if (p.x !== back.x || p.y !== back.y) out.push('carried up, the hero was not by the stair down');
    Game.testFloor(8, 'crypts');
    if (G.route !== 'warrens') out.push('a second trip down changed the road taken');
    if (!Game.level().isFinal) out.push('floor 8 of 8 was not the final floor');
    if (Game.testFloor(9) && G.depth > 8) out.push('went below the last floor');
    // the next run starts unmarked; the rest one by one on it
    const ctx2 = await start('fighter', 'el-tools2', { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true });
    const G2 = ctx2.Game.state(), p2 = ctx2.Game.player();
    if (ctx2.Game.tested()) out.push('a new run began marked');
    const one = (what, fn) => { const c = ctx2; c.Game.state().tested = false; const r = fn(); if (r && !c.Game.tested()) out.push(`${what} did not mark the run`); return r; };
    const L2 = ctx2.Game.level();
    if (!one('reveal', () => ctx2.Game.testReveal())) out.push('could not reveal the floor');
    if (!L2.explored.every(v => v)) out.push('the floor was not all laid out');
    const lv = p2.level;
    if (!one('a level', () => ctx2.Game.testLevel())) out.push('could not gain a level');
    if (p2.level !== lv + 1) out.push(`gaining a level went from ${lv} to ${p2.level}`);
    if (!ctx2.Game.pendingBoons()) out.push('a level gained offered no choice');
    // items: known for what they are; the Heart and gold are not handed over
    delete G2.known.potion_heal;
    if (!one('an item', () => ctx2.Game.testGive('potion_heal'))) out.push('could not be given a potion');
    if (!p2.inv.some(i => i.t === 'potion_heal') || !G2.known.potion_heal) out.push('the potion given was not in the pack, known');
    if (ctx2.Game.testGive('artifact') || ctx2.Game.testGive('gold') || ctx2.Game.testGive('nonsense')) out.push('the Heart, gold or nothing at all was given');
    const gifts = ctx2.Game.testGifts();
    if (gifts.some(g => ['artifact', 'gold', 'key'].includes(g.id)) || !gifts.some(g => g.id === 'keys') || !gifts.some(g => g.id.startsWith('relic:'))) out.push('the list of gifts is wrong');
    // a relic: found this run, but not written in the codex
    const rid = gifts.find(g => g.id.startsWith('relic:')).id.slice(6);
    const codex = JSON.stringify(ctx2.Progress.load().relics);
    if (!one('a relic', () => ctx2.Game.testGive('relic:' + rid))) out.push('could not be given a relic');
    if (!p2.inv.some(i => i.u === rid) || !G2.relics.found.includes(rid)) out.push('the relic given was not in the pack, found');
    if (JSON.stringify(ctx2.Progress.load().relics) !== codex) out.push('a relic given for testing was written in the codex');
    // keys: one for each colour of lock left on the floor; none where no door is locked
    let d = 1;
    while (d < 8 && !Object.keys(ctx2.Game.level().locks || {}).length) ctx2.Game.testFloor(++d);
    const colours = [...new Set(Object.values(ctx2.Game.level().locks || {}))];
    if (!colours.length) out.push('no floor had a locked door to test the keys on');
    else {
      p2.inv = p2.inv.filter(i => i.t !== 'key');
      if (!one('keys', () => ctx2.Game.testGive('keys'))) out.push('could not be given the keys');
      const got = p2.inv.filter(i => i.t === 'key').map(i => i.color).sort();
      if (JSON.stringify(got) !== JSON.stringify(colours.slice().sort())) out.push(`keys given ${got}, locks ${colours}`);
      ctx2.Game.level().locks = {};
      if (ctx2.Game.testGive('keys')) out.push('keys were given where no door is locked');
    }
    // a full pack takes nothing, and nothing is marked
    while (ctx2.Game.giveItem({ t: 'dagger', q: 1, e: 0 }));
    G2.tested = false;
    if (ctx2.Game.testGive('longsword') || ctx2.Game.tested()) out.push('a full pack took a gift, or was marked for it');
    // the eye marks the run as the other switches do
    ctx2.Game.setTesting({ eye: true });
    if (!ctx2.Game.testingOn() || !ctx2.Game.tested()) out.push('showing every monster did not mark the run');
    ctx2.Game.setTesting({});
    return out.length ? out.join('; ') : true;
  });

  await test('the run that ends is kept for the title, with what killed it (a test run is not); the pack sorts like with like, keeping the order within a kind', async () => {
    const out = [];
    const { Game, G, L, p, put } = await arena('fighter', 'el-lastrun');
    localStorage.removeItem('deepdelve.lastrun');
    p.hp = 1; p.maxHp = 10;
    const o = put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 60 && G.status === 'playing'; i++) { o.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t }; o.nextAct = G.t; o.blows = 3; run(Game, G, 300); }
    const lr = Game.lastRun();
    if (G.status !== 'dead') out.push('the hero did not die');
    else if (!lr || lr.name !== p.name || lr.cls !== 'fighter' || lr.won || lr.depth !== G.depth || !/ogre/.test(lr.killer)) out.push(`the last run was kept as ${JSON.stringify(lr)}`);
    // a test run leaves the one before it standing
    const t = await arena('mage', 'el-lastrun-2');
    // (each world keeps its own storage: the run before is set down in this one)
    localStorage.setItem('deepdelve.lastrun', JSON.stringify({ name: 'Before', cls: 'fighter', depth: 3, levels: 8, won: false, killer: '', date: 1 }));
    t.Game.setTesting({ gold: true });
    t.p.hp = 1;
    const o2 = t.put('ogre', 1, 0, { hp: 999, maxHp: 999 });
    for (let i = 0; i < 60 && t.G.status === 'playing'; i++) { o2.windup = { kind: 'move', move: 'crush', at: t.G.t, until: t.G.t }; o2.nextAct = t.G.t; o2.blows = 3; run(t.Game, t.G, 300); }
    t.Game.setTesting({});
    if (t.G.status !== 'dead') out.push('the test run did not end');
    else if ((t.Game.lastRun() || {}).name !== 'Before') out.push('a test run was kept as the last run');
    // the pack sorted
    const s = await arena('fighter', 'el-sort');
    s.p.inv = [{ t: 'potion_heal', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 0 }, { t: 'ration', q: 1, e: 0 }, { t: 'leather', q: 1, e: 0 }, { t: 'mace', q: 1, e: 0 }, { t: 'scroll_map', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 1 }];
    s.Game.sortPack();
    const kinds = s.p.inv.map(i => s.ctx.ITEMS[i.t].kind);
    const order = ['weapon', 'armor', 'heal', 'potion', 'scroll', 'food'];
    const idx = kinds.map(k => order.indexOf(k) < 0 ? 99 : order.indexOf(k));
    if (idx.some((v, i) => i && v < idx[i - 1])) out.push(`sorted to ${s.p.inv.map(i => i.t).join(', ')}`);
    const daggers = s.p.inv.filter(i => i.t === 'dagger').map(i => i.e);
    if (daggers.join() !== '0,1') out.push('two of a kind changed places in the sort');
    if (s.p.inv.length !== 7) out.push('the sort lost or made an item');
    return out.length ? out.join('; ') : true;
  });

  await test('a mimic waits among the barrels of a middle floor as one of them, the same for a seed: away from the stairs, shut and asleep', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    let found = 0, floors = 0, bad = 0, first = null;
    for (let s = 0; s < 24; s++) {
      const c = await start('fighter', 'mimic-' + s, REAL);
      for (let d = 2; d <= 8; d++) {
        c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute('crypts');
        const L = c.Game.level(), depth = c.Game.state().depth, mm = L.monsters.filter(m => m.id === 'mimic');
        if (depth >= 3 && depth <= 7) floors++;
        if (!mm.length) continue;
        if (depth < 3 || depth > 7 || mm.length > 1) bad++;
        const m = mm[0];
        if (!m.disguised || m.awake) out.push(`floor ${depth}: a mimic laid ${m.disguised ? 'awake' : 'open'}`);
        const ends = [L.start, L.stairsUp, L.stairsDown].filter(Boolean);
        if (ends.some(e => Math.abs(e.x - m.x) + Math.abs(e.y - m.y) <= 2)) out.push(`floor ${depth}: a mimic by the stairs`);
        if ((L.dressing || []).some(q => q.x === m.x && q.y === m.y)) out.push(`floor ${depth}: a barrel still stood on the mimic's square`);
        found++;
        if (!first) first = { seed: 'mimic-' + s, depth, x: m.x, y: m.y };
      }
    }
    if (bad) out.push(`${bad} floors held a mimic out of the middle floors, or more than one`);
    if (!(found >= floors * 0.15 && found <= floors * 0.6)) out.push(`${found} mimics on ${floors} middle floors`);
    if (first) {
      const again = await start('fighter', first.seed, REAL);
      for (let d = 2; d <= first.depth; d++) { again.Game.descend(); if (again.Game.forkPending()) again.Game.chooseRoute('crypts'); }
      const m2 = again.Game.level().monsters.find(m => m.id === 'mimic');
      if (!m2 || m2.x !== first.x || m2.y !== first.y) out.push('the same seed laid its mimic elsewhere');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a mimic creaks as the hero comes near, springs on one who touches it or stays beside it, and struck first from where the hero stands is caught shut for double', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-mimic');
    L.twist = null;
    const shut = (fwd, side = 0) => put('mimic', fwd, side, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
    // drawn as a barrel, the Use button reads Break
    let m = shut(1);
    // (no life bar, no warning: whatever is drawn there is drawn as a barrel)
    if (Game.renderState(0).sprites.some(sp => Math.abs(sp.x - (m.x + 0.5)) < 0.3 && Math.abs(sp.y - (m.y + 0.5)) < 0.3 && (sp.hp != null || sp.tell))) out.push('a shut mimic was drawn as a creature');
    if (Game.useLabel() !== 'Break') out.push(`a shut mimic ahead was offered "${Game.useLabel()}"`);
    // walked into: it has the hero at once (a warned blow still misses on a 1: try again)
    let mark = markLog(G), opened = false;
    for (let tries = 0; tries < 3 && !p.grabbed; tries++) {
      if (tries) { L.monsters.length = 0; G.blowGate = 0; m = shut(1); }
      mark = markLog(G);
      Game.input('forward');
      opened = opened || linesSince(G, mark).some(l => /splits open/.test(l));
    }
    if (m.disguised || !p.grabbed) out.push(`walked into, the mimic ${m.disguised ? 'stayed shut' : 'did not seize the hero'}`);
    if (!opened) out.push('walked into, the mimic said nothing');
    // stood beside: a creak first, then it lunges after a beat, and a step away is time enough
    L.monsters.length = 0; p.grabbed = null; G.blowGate = 0;
    m = shut(3);
    mark = markLog(G);
    run(Game, G, 300);
    if (countSaid(linesSince(G, mark), /creaks/) !== 1 || !m.creaked) out.push('three squares off, the mimic did not creak, once');
    if (!m.disguised) out.push('the mimic sprang at three squares');
    m.x = at(1)[0]; m.y = at(1)[1]; m.rx = m.x; m.ry = m.y;
    run(Game, G, 300);
    if (!m.disguised) out.push('the mimic sprang before its beat');
    run(Game, G, 500);
    if (m.disguised || !m.windup) out.push(`beside it for a while, the mimic ${m.disguised ? 'stayed shut' : 'did not lunge'}`);
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    run(Game, G, 1500);
    if (p.grabbed) out.push('a step away from a mimic\'s lunge was not time enough');
    p.x -= sx; p.y -= sy;
    // heard, it is aimed at from where the hero stands: caught shut, the blow lands twice
    L.monsters.length = 0; p.grabbed = null;
    m = shut(3);
    m.creaked = true;
    const hp0 = m.hp;
    cast('magic_missile');
    run(Game, G, 600);
    if (m.disguised) out.push('struck by a spell, the mimic stayed shut');
    if (!(hp0 - m.hp >= 4)) out.push(`caught shut, the mimic took only ${hp0 - m.hp}`);
    if (!(Game.bestiary().mimic || {}).answer) out.push('striking a shut mimic first was not counted its answer');
    // not yet heard, a spell finds nothing there
    L.monsters.length = 0;
    m = shut(3);
    const hp1 = m.hp;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    const { ctx } = { ctx: null };
    Game.castSpell(Game.knownSpells().find(sp => sp.id === 'magic_missile'));
    run(Game, G, 600);
    if (m.hp !== hp1 || !m.disguised) out.push('a spell found a mimic that had not yet creaked');
    // woken with the whole floor (a door heaved open), it is still a barrel: no foe near to rest, no warning at the side
    L.monsters.length = 0;
    m = shut(0, 1); m.awake = true; m.creaked = true; m.nextAct = 1e12;
    if (Game.restLabel() === 'Foes near') out.push('a shut mimic, woken, kept the hero from resting');
    if (Game.renderState(0).fx.threats.length) out.push('a shut mimic, woken, was shown as a threat at the side');
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 6: a shut mimic cannot dodge a blow, springs at a bash, stops roots, never counts as awake; rock is not the hero\'s blow and crushes bones', async () => {
    const out = [];
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-swing');
      L.twist = null;
      // the clumsiest swing still lands on a barrel standing still, and it is named only once it has sprung
      p.stats.str = 1; p.perkHit = -40;
      const m = put('mimic', 1, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const mark = markLog(G);
      G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack');
      const said = linesSince(G, mark);
      if (m.disguised || m.hp >= 60) out.push(`a clumsy swing at a shut mimic ${m.disguised ? 'left it shut' : 'did no harm'}`);
      if (said.some(l => /You miss the Mimic/.test(l))) out.push('a swing at a shut mimic missed it by name');
    }
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-bash');
      L.twist = null;
      const m = put('mimic', 1, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const mark = markLog(G);
      Game.useAbility();
      const said = linesSince(G, mark), opened = said.findIndex(l => /barrel/i.test(l)), named = said.findIndex(l => /bash the Mimic/.test(l));
      if (m.disguised) out.push('a bashed mimic stayed shut');
      else if (opened < 0 || (named >= 0 && named < opened)) out.push(`bashing a shut mimic named it first: ${said.join(' | ')}`);
    }
    {
      const { Game, G, L, p, put } = await arena('druid', 'rv6-roots');
      L.twist = null;
      const m = put('mimic', 2, 0, { awake: false, disguised: true, hp: 60, maxHp: 60, nextAct: 0 });
      const behind = put('goblin', 3);
      const mark = markLog(G);
      // (with only a barrel in the way the spell finds nothing to hold, and may not be cast at all)
      G.t = Math.max(G.t, p.nextAttack) + 10;
      Game.castSpell(Game.knownSpells().find(sp => sp.id === 'entangle'));
      if ((m.snaredUntil || 0) > G.t || linesSince(G, mark).some(l => /wrap the Mimic/.test(l))) out.push('roots wrapped a shut mimic');
      if ((behind.snaredUntil || 0) > G.t) out.push('roots passed a shut mimic to the goblin behind it');
      // woken with the whole floor, it is asleep again before anything can count it
      m.awake = true;
      run(Game, G, 50);
      if (m.awake) out.push('a shut mimic stayed awake');
    }
    {
      const { Game, G, L, p, put } = await arena('fighter', 'rv6-rock');
      L.twist = 'tremors';
      // an acolyte's chant goes on under falling rock, and the hero is not thanked for it
      const a = put('acolyte', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
      a.windup = { kind: 'move', move: 'mend', at: G.t, until: G.t + 60000 };
      L.quake = { next: G.t + 1e9, falls: [{ x: a.x, y: a.y, at: G.t, lands: G.t + 50 }] };
      const mark = markLog(G);
      run(Game, G, 100);
      if (!a.windup || a.windup.move !== 'mend') out.push('falling rock broke an acolyte\'s chant');
      if (linesSince(G, mark).some(l => /You break/.test(l))) out.push('falling rock was told as the hero\'s blow');
      // a skeleton under it, the hero holding an edge, stays down
      L.monsters.length = 0;
      const sk = put('skeleton', 2, 0, { hp: 1, maxHp: 20 });
      L.quake.falls = [{ x: sk.x, y: sk.y, at: G.t, lands: G.t + 50 }];
      run(Game, G, 100);
      if (L.monsters.includes(sk)) out.push(`a skeleton under falling rock ${sk.collapsed ? 'fell apart to rise again' : 'was left standing'}`);
    }
    // a floor left with rock in the air drops none of it on a hero coming back
    {
      const ctx = await start('fighter', 'rv6-back', { levels: 8 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.hp = p.maxHp = 999;
      Game.testFloor(3);
      const L3 = Game.level();
      L3.twist = 'tremors';
      L3.quake = { next: G.t + 1e9, falls: [{ x: L3.downStart ? L3.downStart.x : L3.start.x, y: L3.downStart ? L3.downStart.y : L3.start.y, at: G.t, lands: G.t + 1000 }] };
      Game.testFloor(4); Game.level().monsters.length = 0;
      run(Game, G, 3000);
      Game.testFloor(3); Game.level().monsters.length = 0;
      run(Game, G, 50);
      if (p.hp < 999) out.push('rock left in the air fell on a hero coming back');
      if (L3.quake && L3.quake.falls.length) out.push('rock left in the air was still falling on return');
    }
    // a mimic's life comes from its floor's own dice: the same seed, the same mimic
    {
      let seen = 0;
      for (let i = 0; i < 40 && seen < 2; i++) {
        const hp = [];
        for (const k of [0, 1]) {
          const ctx = await start('fighter', 'rv6-hp-' + i, { levels: 8 });
          ctx.Game.testFloor(5);
          const m = ctx.Game.level().monsters.find(x => x.id === 'mimic');
          hp.push(m ? m.hp : null);
        }
        if (hp[0] == null) continue;
        seen++;
        if (hp[0] !== hp[1]) out.push(`one seed's mimic had ${hp[0]} and then ${hp[1]} hit points`);
      }
      if (!seen) out.push('no mimic on the fifth floor of forty seeds');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a smouldering floor: its cracks glow, then flare fire over themselves and the four squares beside; cold seals one a while', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-vent');
    L.twist = 'smouldering';
    const [vx, vy] = at(2), [hx, hy] = at(0), [nx, ny] = at(1);
    L.vents = [{ x: vx, y: vy, next: Math.max(1, G.t), heat: 0, sealedUntil: 0 }];
    run(Game, G, 100);
    let v = Game.vents()[0];
    if (!(v.heat > 0)) out.push('a crack whose time had come did not heat up');
    if (v.area.length !== 5 || !v.area.some(a => a.x === nx && a.y === ny)) out.push(`a heating crack would cover ${JSON.stringify(v.area)}`);
    // standing beside it when it flares: the fire is under the hero, and burns
    p.x = nx; p.y = ny;
    const mark = markLog(G);
    run(Game, G, 1600);
    const f = Game.fieldAt(p.x, p.y);
    if (!f || f.k !== 'fire') out.push('the flare left no fire on the square beside the crack');
    if (!linesSince(G, mark).some(l => /flares/.test(l))) out.push('the flare was not told');
    run(Game, G, 1000);
    if (p.hp >= 9999) out.push('a hero standing in a flare was not burnt');
    v = Game.vents()[0];
    if (v.heat) out.push('the crack was still glowing after its flare');
    if (!(L.vents[0].next >= G.t + 6000 && L.vents[0].next <= G.t + 16000)) out.push(`the crack flares again in ${L.vents[0].next - G.t}ms`);
    // cold cast at it seals it: no glow, no flare, a while
    L.fields = {}; p.x = hx; p.y = hy; p.hp = 9999;
    L.vents[0].next = G.t + 5000;
    const m2 = markLog(G);
    cast('cone_cold');
    if (!Game.vents()[0].sealed) out.push('cold cast at a crack did not seal it');
    if (!linesSince(G, m2).some(l => /crusts the glowing crack/.test(l))) out.push('the seal was not told');
    L.vents[0].next = G.t;
    run(Game, G, 3000);
    if (Game.vents()[0].heat || Object.keys(L.fields).length) out.push('a sealed crack heated or flared');
    // cold striking a creature beside a crack seals it too
    L.vents[0].sealedUntil = 0; L.vents[0].next = G.t + 99999;
    const g = put('goblin', 3);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    cast('cone_cold');
    if (!Game.vents()[0].sealed) out.push('cold striking a goblin beside a crack did not seal it');
    void g; void Dungeon;
    return out.length ? out.join('; ') : true;
  });

  await test('an emberling blazes up close to the hero and flares: beside it, scorched; two squares off, clear (the answer); quenched by cold; walks through fire; bursts into flame as it dies', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast, ctx } = await arena('mage', 'el-ember');
    L.twist = null;
    // fire barely touches it, cold hurts it badly
    const e0 = put('emberling', 3, 0, { hp: 999, maxHp: 999 });
    if (!(ctx.ELEMENTS_TAKEN.emberling.fire < 1 && ctx.ELEMENTS_TAKEN.emberling.cold > 1)) out.push('an emberling does not shrug off fire and fear cold');
    L.monsters.length = 0; void e0;
    // close, after a blow, it blazes up; still beside the hero when it flares, it scorches
    let e = put('emberling', 1, 0, { hp: 999, maxHp: 999, nextAct: G.t, blows: 1 });
    let blazed = false;
    for (let i = 0; i < 40 && !blazed; i++) { run(Game, G, 50); blazed = !!(e.windup && e.windup.move === 'flare'); if (!blazed && !e.windup) e.blows = 1; if (e.windup && !e.windup.move) { e.windup = null; e.nextAct = G.t; e.blows = 1; } }
    if (!blazed) out.push('an emberling beside the hero never blazed up');
    else {
      p.eq.armor = null;
      const hp0 = p.hp, mk = markLog(G);
      run(Game, G, 1500);
      // (the flare also sets the hero's own square alight: the scorch is told apart from the fire)
      if (p.hp >= hp0 || !linesSince(G, mk).some(l => /heat of it scorches you/.test(l))) out.push('an emberling flaring beside the hero did not scorch them');
      const f = Game.fieldAt(at(1)[0], at(1)[1]);
      if (!f || f.k !== 'fire') out.push('the flare did not set its own square alight');
    }
    // two squares off when it flares: clear, and the answer
    L.monsters.length = 0; L.fields = {}; p.hp = 9999;
    e = put('emberling', 1, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    e.windup = { kind: 'move', move: 'flare', at: G.t, until: G.t + 300 }; e.nextAct = G.t + 300;
    const [bx, by] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
    L.tiles[(p.y + by) * L.w + p.x + bx] = ctx.Dungeon.T.FLOOR;
    p.x += bx; p.y += by;
    run(Game, G, 500);
    if (p.hp !== 9999) out.push('a hero two squares off was scorched by the flare');
    if (!(Game.bestiary().emberling || {}).answer) out.push('standing clear of the flare was not counted the answer');
    p.x -= bx; p.y -= by;
    // blazing up, quenched by cold
    L.monsters.length = 0; L.fields = {};
    e = put('emberling', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    e.windup = { kind: 'move', move: 'flare', at: G.t, until: G.t + 5000 }; e.nextAct = G.t + 5000;
    const mark = markLog(G);
    cast('cone_cold');
    if (e.windup) out.push('cold did not quench an emberling blazing up');
    if (!linesSince(G, mark).some(l => /dulls the Emberling's glow/.test(l))) out.push('the quench was not told');
    // it dies in a burst of flame
    L.monsters.length = 0; L.fields = {};
    e = put('emberling', 1, 0, { hp: 1, maxHp: 30, nextAct: 1e12 });
    const [ex, ey] = [e.x, e.y];
    for (let i = 0; i < 8 && L.monsters.includes(e); i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); run(Game, G, 30); }
    const fd = Game.fieldAt(ex, ey);
    if (L.monsters.includes(e)) out.push('could not kill the emberling');
    else if (!fd || fd.k !== 'fire') out.push('a dead emberling left no fire where it fell');
    // a smouldering floor grows them among its creatures, and its cracks in its rooms
    {
      const found = (() => { for (let i = 0; i < 400; i++) { const pl = ctx.Dungeon.twistPlan('sm-' + i, 8); for (const d in pl) if (pl[d] === 'smouldering') return ['sm-' + i, +d]; } return null; })();
      if (!found) out.push('no smouldering floor in 400 seeds');
      else {
        const c2 = await start('fighter', found[0], { levels: 8 });
        c2.Game.player().hp = c2.Game.player().maxHp = 9999;
        c2.Game.testFloor(found[1]);
        const L2 = c2.Game.level();
        if (L2.twist !== 'smouldering') out.push(`floor ${found[1]} of ${found[0]} is ${L2.twist}`);
        if (!L2.vents || L2.vents.length < 5) out.push(`a smouldering floor had ${L2.vents ? L2.vents.length : 0} cracks`);
        else {
          const ends = [L2.start, L2.stairsDown, L2.stairsUp].filter(Boolean);
          if (L2.vents.some(v => ends.some(q => Math.abs(q.x - v.x) + Math.abs(q.y - v.y) <= 3))) out.push('a crack lay within three squares of a stair or the start');
          if (L2.vents.some((v, i) => L2.vents.some((w, j) => i !== j && Math.abs(v.x - w.x) + Math.abs(v.y - w.y) <= 2))) out.push('two cracks lay side by side');
        }
        if (!L2.monsters.some(m => m.id === 'emberling')) out.push(`no emberling among ${L2.monsters.length} creatures on a smouldering floor`);
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the forge-spirit: blade or coat a step better, past the traders\' +3 to +4 and no further; a curse burnt out; the bellows for both', async () => {
    const out = [];
    const ctx = await start('fighter', 'forgespirit', { levels: 8 });
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.gold = 9999;
    while (G.depth < 6) { Game.level().monsters.length = 0; Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
    const w = p.eq.weapon;
    w.e = 3;
    meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (w.e !== 4) out.push(`a +3 blade in its fire came out +${w.e}`);
    meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (w.e !== 4) out.push(`it took a blade past +4, to +${w.e}`);
    // a cursed coat comes back clean, and better
    p.eq.armor = p.eq.armor || { t: 'leather', q: 1, e: 0 };
    const a = p.eq.armor;
    // (and not yet known for what it is: the fire shows it, as it shows the curse)
    a.e = -1; a.curse = 1; a.h = 1;
    const g0 = p.gold;
    const r = meetAndChoose(ctx, 'forgespirit', 1); Game.closeEncounter();
    if (a.curse || a.e !== 0) out.push(`a cursed -1 coat on its anvil came back ${a.curse ? 'cursed' : 'clean'} at ${a.e}`);
    if (a.h) out.push('a coat not yet known came back from the anvil still unknown');
    if (g0 - p.gold !== 12 * G.depth) out.push(`the anvil cost ${g0 - p.gold}, not ${12 * G.depth}`);
    if (!r.lines.some(l => /curse burns away/.test(l))) out.push('the burnt curse was not told');
    // the bellows, worked by a strong arm: both
    w.e = 0; a.e = 0; p.stats.str = 30;
    let rr = null;
    for (let i = 0; i < 6 && !(rr && rr.check.pass); i++) { rr = meetAndChoose(ctx, 'forgespirit', 2); Game.closeEncounter(); }
    if (!rr.check.pass) out.push('a strong arm never worked the bellows');
    else if (w.e !== 1 || a.e !== 1) out.push(`the bellows left the blade +${w.e} and the coat +${a.e}`);
    // nothing to temper
    p.eq.weapon = null;
    const r2 = meetAndChoose(ctx, 'forgespirit', 0); Game.closeEncounter();
    if (!r2.lines.some(l => /no weapon for it/.test(l))) out.push(`with no weapon the fire said ${r2.lines.join(' | ')}`);
    return out.length ? out.join('; ') : true;
  });
};
