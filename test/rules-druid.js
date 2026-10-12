// Rule checks for the druid: Wild Shape, Entangle and the rest of its spells (wild.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function druidChecks(h) {
  const { OPTS, evenStats, newContext, start, seedDice, markLog, linesSince, test, beside, run, talent, winHere, meetAndChoose, druid } = h;

  // ---------- the druid ----------
  const druidSpell = (ctx, id) => ctx.SPELLS.druid.find(s => s.id === id);
  const ready = ctx => { const G = ctx.Game.state(), p = ctx.Game.player(); G.t = Math.max(G.t, p.nextAttack); };

  await test('a druid: Wisdom lands the spear, and the kit is light armour, a spear and six spells, the bear among them', async () => {
    const out = [];
    const ctx = await druid('druid-kit');
    const { Game, CLASSES } = ctx; const p = Game.player();
    if (!p.eq.weapon || p.eq.weapon.t !== 'spear' || !p.eq.armor || p.eq.armor.t !== 'leather') out.push(`a druid starts with ${p.eq.weapon && p.eq.weapon.t} and ${p.eq.armor && p.eq.armor.t}`);
    p.stats.str = 8; p.stats.wis = 18;
    const high = Game.toHit(); p.stats.wis = 10; const low = Game.toHit();
    if (high - low !== 4) out.push(`Wisdom 18 against 10 moved a druid's to-hit by ${high - low}`);
    const ids = Game.knownSpells().map(s => s.id).join();
    if (ids !== 'thorn_lash,wild_shape,mending_moss,entangle,call_lightning,insect_plague') out.push(`a druid knows ${ids}`);
    if (!Game.spellAvailable(druidSpell(ctx, 'wild_shape'))) out.push('the bear is not there from the first level');
    if (CLASSES.druid.title !== 'Archdruid') out.push(`the druid's title is ${CLASSES.druid.title}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Wild Shape: claws for blows, better armour, a hide that takes the blows first; it ends with time, a torn hide or another spell', async () => {
    const out = [];
    const ctx = await druid('druid-shape', 4);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const ac0 = Game.playerAC(), shape = druidSpell(ctx, 'wild_shape');
    if (Game.castSpell(shape) !== true || !Game.shaped()) return 'the bear did not come';
    const w = Game.weapon();
    if (w.name !== 'claws' || w.range || w.dmg[1] !== 8) out.push(`a bear strikes with ${JSON.stringify(w)}`);
    if (Game.playerAC() !== ac0 + 2) out.push(`a bear's armour class is ${Game.playerAC()}, the druid's ${ac0}`);
    if (Game.renderState().fx.view.cls !== 'bear' || Game.renderState().fx.view.weapon) out.push('the view does not show a bear\'s paws');
    if (!/^Bear: 40s, hide 7$/.test(Game.shapeChip())) out.push(`the status line says "${Game.shapeChip()}"`);
    if (Game.spellWasteReason(shape) !== 'You are a bear already.') out.push('the bear could be cast over itself');
    // a blow on the hide: all of it taken, then the rest through, and the shape broken
    const hp0 = p.hp;
    Game.hurtPlayer(5, 'The orc hits you for 5.');
    if (p.hp !== hp0 || p.shape.hide !== 2) out.push(`five on a hide of 7 left hp ${hp0}->${p.hp}, hide ${p.shape && p.shape.hide}`);
    const mark = markLog(G);
    Game.hurtPlayer(7, 'The orc hits you for 7.');
    if (p.hp !== hp0 - 5 || Game.shaped()) out.push(`seven on a hide of 2 left hp ${hp0}->${p.hp}, shaped ${Game.shaped()}`);
    const said = linesSince(G, mark).join(' / ');
    // the blow first, then what it did to the bear
    if (!said.includes('(Your hide takes 2.)') || !(said.indexOf('tears through the bear') > said.indexOf('hits you for 7'))) out.push(`said: ${said}`);
    // time runs out
    ready(ctx); Game.castSpell(shape);
    run(Game, G, 40100);
    if (Game.shaped() || p.shape) out.push('the bear outlasted its forty seconds');
    // another spell lets it go, and is cast
    ready(ctx); Game.castSpell(shape);
    const heal = druidSpell(ctx, 'mending_moss'); p.hp = 10; ready(ctx);
    if (Game.castSpell(heal) !== true || Game.shaped() || p.hp <= 10) out.push(`Mending Moss in bear shape: cast, shaped ${Game.shaped()}, hp ${p.hp}`);
    // each bear taken is counted, for Wildheart
    if (G.stats.shapes !== 3) out.push(`three bears were counted as ${G.stats.shapes}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a bear holds nothing: a flaming spear\'s fire and an oil stay behind with it', async () => {
    const out = [];
    const ctx = await druid('druid-nothing', 4);
    const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'spear', q: 1, e: 0, pw: 'flame' };
    p.coating = { t: 'fire', left: 20 };
    if (!Game.hasPower('flame', 'weapon')) out.push('the flaming spear did not flame in the hand');
    Game.castSpell(druidSpell(ctx, 'wild_shape'));
    if (Game.hasPower('flame', 'weapon') || Game.hasPower('flame')) out.push('a bear\'s claws carried the spear\'s fire');
    const m = beside(ctx, 'goblin', { hp: 500, maxHp: 500, nextAct: 1e12 });
    p.perkHit = 60;
    for (let i = 0; i < 5; i++) { ready(ctx); Game.input('attack'); }
    if (p.coating.left !== 20) out.push(`a bear's claws spent the oil: ${p.coating.left} left`);
    if (!(m.hp < 500)) out.push('the claws never landed');
    return out.length ? out.join('; ') : true;
  });

  await test('Entangle holds the first foe ahead and breaks its blow; Old Growth holds every one in reach; a boss tears free in half the time', async () => {
    const out = [];
    const lineUp = (ctx, ids, extra = {}) => {
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
      const [dx, dy] = Dungeon.DIRS[p.dir];
      for (let k = 1; k <= 4; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
      L.monsters.length = 0;
      // (foes that fail their saves: one that makes it is held half as long, which the saving throws test)
      for (const id of ids) ctx.MONSTERS[id] = { ...ctx.MONSTERS[id], hit: -60 };
      return ids.map((id, i) => { const m = { uid: 70 + i, id, x: p.x + dx * (i + 2), y: p.y + dy * (i + 2), hp: 99, maxHp: 99, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, windup: { kind: 'melee', at: G.t, until: G.t + 500 }, ...extra }; L.monsters.push(m); return m; });
    };
    const ctx = await druid('druid-entangle', 5);
    const { Game } = ctx; const G = Game.state(), sp = druidSpell(ctx, 'entangle');
    Game.level().monsters.length = 0;
    if (!/Nothing within reach/.test(Game.spellWasteReason(sp) || '')) out.push('Entangle at nothing was not called a waste');
    const [a, b] = lineUp(ctx, ['orc', 'orc']);
    const t0 = G.t;
    if (Game.castSpell(sp) !== true) return 'Entangle was refused with an orc ahead';
    if (a.windup || a.nextAct - t0 < 3000) out.push(`the first orc: windup ${!!a.windup}, moves in ${a.nextAct - t0}ms`);
    if (!b.windup) out.push('the second orc was held too, without Old Growth');
    // Old Growth, and a Grovewarden's longer hold
    const c2 = await druid('druid-growth', 9);
    c2.Game.player().path = 'grovewarden'; c2.Game.player().capstone = 'old_growth';
    const [x, y] = lineUp(c2, ['orc', 'orc']); const t1 = c2.Game.state().t;
    c2.Game.castSpell(druidSpell(c2, 'entangle'));
    if (x.windup || y.windup || y.nextAct - t1 < 4500) out.push(`Old Growth: windups ${!!x.windup}/${!!y.windup}, the second moves in ${y.nextAct - t1}ms`);
    // a boss, half
    const c3 = await druid('druid-boss', 5);
    const [boss] = lineUp(c3, ['warlord'], { windup: null }); const t2 = c3.Game.state().t;
    c3.Game.castSpell(druidSpell(c3, 'entangle'));
    if (boss.nextAct - t2 !== 1750) out.push(`the Warlord was held ${boss.nextAct - t2}ms`);
    return out.length ? out.join('; ') : true;
  });

  await test('a druid\'s bond: a companion half again as tough, a floor further on, mended with them and by Beast Bond, and a Grovewarden\'s twice as tough', async () => {
    const out = [];
    const hound = async (cls, seed) => {
      const ctx = await start(cls, seed, { levels: 6 });
      const p = ctx.Game.player(); p.hp = p.maxHp = 9999; p.food = 100;
      meetAndChoose(ctx, 'stray', 0); ctx.Game.closeEncounter();
      return ctx;
    };
    const f = await hound('fighter', 'kin-f'), dr = await hound('druid', 'kin-d');
    const hf = f.Game.companion(), hd = dr.Game.companion();
    if (!hf || !hd) return `no hound: fighter ${!!hf}, druid ${!!hd}`;
    f.Game.player().level = dr.Game.player().level;
    if (hd.maxHp !== Math.round(hf.maxHp * 1.5)) out.push(`a druid's hound has ${hd.maxHp} hit points, a fighter's ${hf.maxHp}`);
    if ((hd.floors || 0) !== 1 || (hf.floors || 0) !== 0) out.push(`it came a floor on: druid's ${hd.floors}, fighter's ${hf.floors}`);
    // mended with the druid
    const p = dr.Game.player(); p.level = 3; p.sp = 99; p.hp = 5; p.maxHp = 100; hd.hp = 1;
    dr.Game.state().t = Math.max(dr.Game.state().t, p.nextAttack);
    dr.Game.castSpell(druidSpell(dr, 'mending_moss'));
    if (!(hd.hp > 1)) out.push('Mending Moss did not mend the hound');
    // a druid unhurt with a hurt hound: not a waste
    p.hp = p.maxHp; hd.hp = 1;
    if (dr.Game.spellWasteReason(druidSpell(dr, 'mending_moss'))) out.push('healing was wasted on an unhurt druid with a hurt hound');
    hd.hp = hd.maxHp;
    if (!dr.Game.spellWasteReason(druidSpell(dr, 'mending_moss'))) out.push('healing an unhurt druid and hound was not a waste');
    // Beast Bond: a hit point every three seconds at their side, beyond what it mends on its own
    const mended = bond => {
      if (bond) talent(dr, 'beast_bond');
      hd.hp = 1; hd.mode = 'stay'; hd.x = p.x + 1; hd.y = p.y; p.nextKin = 0;
      dr.Game.level().monsters.length = 0;
      run(dr.Game, dr.Game.state(), 9100);
      return hd.hp - 1;
    };
    run(dr.Game, dr.Game.state(), 1000);   // (it grows to the druid's new level first)
    const own = mended(false), bonded = mended(true);
    if (bonded - own < 3 || bonded - own > 4) out.push(`in nine seconds it mended ${own} on its own, ${bonded} with Beast Bond`);
    // a Grovewarden's grows to twice a fighter's
    f.Game.player().level = p.level; run(f.Game, f.Game.state(), 1000);
    p.path = 'grovewarden'; run(dr.Game, dr.Game.state(), 1000);
    if (hd.maxHp !== hf.maxHp * 2) out.push(`a Grovewarden's hound has ${hd.maxHp} hit points, a fighter's ${hf.maxHp}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s paths and capstones: the bear\'s cost, time, hide and claws; Mending Moss\'s cost; a Grovewarden\'s bark', async () => {
    const out = [];
    const hero = async (path, cap) => { const ctx = await druid('druid-path-' + (cap || path || 'none'), 9); ctx.Game.player().path = path; ctx.Game.player().capstone = cap; return ctx; };
    const none = await hero(undefined), ss = await hero('shapeshifter'), gw = await hero('grovewarden');
    const cost = (c, id) => c.Game.spellCost(druidSpell(c, id));
    if (cost(ss, 'wild_shape') !== cost(none, 'wild_shape') - 1 || cost(ss, 'thorn_lash') !== cost(none, 'thorn_lash') + 1) out.push(`Shapeshifter: the bear costs ${cost(ss, 'wild_shape')}, the lash ${cost(ss, 'thorn_lash')}`);
    const shaped = c => { c.Game.castSpell(druidSpell(c, 'wild_shape')); const p = c.Game.player(); return { secs: Math.round((p.shape.until - c.Game.state().t) / 1000), hide: p.shape.hide, claws: c.Game.weapon().dmg[2] }; };
    const n = shaped(none), s = shaped(ss), g = shaped(gw);
    if (n.secs !== 40 || s.secs !== 45 || g.secs !== 40) out.push(`the bear lasts ${n.secs}s, a Shapeshifter's ${s.secs}s, a Grovewarden's ${g.secs}s`);
    if (s.hide !== n.hide || s.claws !== n.claws + 2) out.push(`a Shapeshifter's hide ${n.hide}->${s.hide}, claws +${s.claws}`);
    const dire = shaped(await hero('shapeshifter', 'dire_bear')), old = shaped(await hero('shapeshifter', 'old_hide'));
    // (Dire Bear and Old Hide are rules now, checked in rules-capstones.js: the numbers are the path's)
    if (dire.claws !== n.claws + 2) out.push(`Dire Bear: claws +${dire.claws}`);
    if (old.hide !== n.hide) out.push(`Old Hide: hide ${n.hide}->${old.hide}`);
    // a Grovewarden is harder to hit, bear or not
    if (gw.Game.playerAC() !== none.Game.playerAC() + 2) out.push(`a Grovewarden's armour class is ${gw.Game.playerAC()}, a druid's with no path ${none.Game.playerAC()}`);
    const hw = await hero('grovewarden', 'heartwood');
    if (cost(hw, 'mending_moss') !== cost(gw, 'mending_moss')) out.push(`Heartwood: Mending Moss ${cost(gw, 'mending_moss')}->${cost(hw, 'mending_moss')} (it cures now, it is not cheaper)`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s talents: a thicker hide, bark, longer thorns, rending claws that bleed', async () => {
    const out = [];
    const ctx = await druid('druid-talents', 6);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    const shape = druidSpell(ctx, 'wild_shape');
    Game.castSpell(shape); const hide0 = p.shape.hide; delete p.shape;
    talent(ctx, 'thick_hide'); ready(ctx); Game.castSpell(shape);
    if (p.shape.hide !== Math.round(hide0 * 1.5)) out.push(`Thick Hide took the hide from ${hide0} to ${p.shape.hide}`);
    const ac0 = Game.playerAC(); talent(ctx, 'barkskin');
    if (Game.playerAC() !== ac0 + 1) out.push(`Barkskin took armour class ${ac0}->${Game.playerAC()}`);
    // Rending Claws: every third blow that lands opens a wound that bleeds
    talent(ctx, 'rending_claws');
    const m = beside(ctx, 'ogre', { hp: 9999, maxHp: 9999, nextAct: 1e12 });
    p.perkHit = 60;
    // (a natural 1 misses whatever the bonus: swing until three have landed)
    let landed = 0;
    for (let i = 0; i < 20 && landed < 3; i++) { const was = m.hp; ready(ctx); Game.input('attack'); if (m.hp < was) landed++; }
    if (!m.dot || m.dot.kind !== 'bleed') out.push(`${landed} claw blows landed and opened no wound`);
    const hp = m.hp; run(Game, G, 3100);
    if (!(m.hp < hp)) out.push('the wound did not bleed');
    // Long Thorns: two squares further
    delete p.shape;
    const lash = druidSpell(ctx, 'thorn_lash');
    const [dx, dy] = Dungeon.DIRS[p.dir], L = Game.level();
    for (let k = 1; k <= 6; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    m.x = p.x + dx * 6; m.y = p.y + dy * 6; m.dot = null;
    if (!Game.spellWasteReason(lash)) out.push('Thorn Lash reached six squares without Long Thorns');
    talent(ctx, 'long_thorns');
    if (Game.spellWasteReason(lash)) out.push(`with Long Thorns: ${Game.spellWasteReason(lash)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s green gifts: Green Hands and a Grovewarden heal more, Stormborn and a Grovewarden\'s thorns hold back what they strike', async () => {
    const out = [];
    // the same die, so the only difference is the gift
    const healed = async (key, set) => {
      const ctx = await druid('druid-heal-' + key, 5); set(ctx);
      const p = ctx.Game.player(); p.hp = 1; seedDice(ctx, 'moss');
      ctx.Game.castSpell(druidSpell(ctx, 'mending_moss'));
      return p.hp - 1;
    };
    const plain = await healed('plain', () => {}), green = await healed('green', c => talent(c, 'green_hands')), grove = await healed('grove', c => { c.Game.player().path = 'grovewarden'; });
    if (Math.abs(green - plain * 4 / 3) > 1) out.push(`Green Hands healed ${green}, plainly ${plain}`);
    if (Math.abs(grove - plain * 1.25) > 1) out.push(`a Grovewarden healed ${grove}, plainly ${plain}`);
    // a bolt's hold: how much later the orc it strikes may act
    const held = async (key, id, set) => {
      const ctx = await druid('druid-hold-' + key, 5); set(ctx);
      const m = beside(ctx, 'orc', { hp: 999, maxHp: 999, nextAct: ctx.Game.state().t });
      const t0 = ctx.Game.state().t; seedDice(ctx, 'hold');
      ctx.Game.castSpell(druidSpell(ctx, id));
      return { hold: m.nextAct - t0, dealt: 999 - m.hp };
    };
    const bolt = await held('bolt', 'call_lightning', () => {}), storm = await held('storm', 'call_lightning', c => talent(c, 'stormborn'));
    if (storm.hold - bolt.hold !== 700) out.push(`Stormborn held the orc ${storm.hold}ms, without it ${bolt.hold}ms`);
    if (Math.abs(storm.dealt - bolt.dealt * 1.25) > 1) out.push(`Stormborn's lightning dealt ${storm.dealt}, without it ${bolt.dealt}`);
    const lash = await held('lash', 'thorn_lash', () => {}), grovel = await held('grovel', 'thorn_lash', c => { c.Game.player().path = 'grovewarden'; });
    if (grovel.hold - lash.hold !== 700) out.push(`a Grovewarden's thorns held the orc ${grovel.hold}ms, plain ones ${lash.hold}ms`);
    return out.length ? out.join('; ') : true;
  });

  await test('the druid\'s relics are a druid\'s alone: Oakheart\'s bear lasts longer and is thicker-hided; other classes\' relics are dealt as before', async () => {
    const out = [];
    const ctx = await druid('druid-oak', 4);
    const { Game, relicUsableBy, relicPlan, RELICS } = ctx; const p = Game.player();
    for (const id of ['oakheart', 'mossmantle']) {
      if (!relicUsableBy(id, 'druid')) out.push(`${id} is not a druid's`);
      for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger']) if (relicUsableBy(id, cls)) out.push(`${id} is usable by a ${cls}`);
    }
    // another class's deal leaves the druid's relics out, so it is the deal it always was
    const plan = relicPlan('oak-seed', 'mage', 8);
    if ([...Object.values(plan.floor), ...plan.shop].some(id => RELICS[id].cls)) out.push('a mage was dealt a druid\'s relic');
    const shape = druidSpell(ctx, 'wild_shape');
    Game.castSpell(shape);
    const plain = { secs: Math.round((p.shape.until - Game.state().t) / 1000), hide: p.shape.hide };
    delete p.shape;
    p.eq.weapon = { t: 'staff', q: 1, e: 1, u: 'oakheart' };
    if (!Game.hasPower('wild')) out.push('Oakheart in hand has no Wild power');
    ready(ctx); Game.castSpell(shape);
    const oak = { secs: Math.round((p.shape.until - Game.state().t) / 1000), hide: p.shape.hide };
    if (oak.secs !== plain.secs + 10 || oak.hide !== plain.hide + 4) out.push(`with Oakheart the bear lasts ${oak.secs}s (plainly ${plain.secs}s), hide ${oak.hide} (plainly ${plain.hide})`);
    return out.length ? out.join('; ') : true;
  });

  await test('a druid is at home with the old stone, the pale caps and the mapmaker\'s finger; and Wildheart is a druid\'s win of thirty bears', async () => {
    const out = [];
    for (const [id, i, want] of [['shrine', 2, 2], ['fungus', 1, 4], ['mapmaker', 1, 2]]) {
      const bonus = async cls => {
        const c = await start(cls, 'knack-' + id, { levels: 6 });
        const { Game, Dungeon } = c; const p = Game.player(), L = Game.level();
        const [dx, dy] = Dungeon.DIRS[p.dir];
        L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; L.monsters.length = 0;
        L.npcs = [{ id, kind: 'encounter', x: p.x + dx, y: p.y + dy }];
        Game.input('use');
        return Game.encounterOptions()[i].knack;
      };
      const d = await bonus('druid'), f = await bonus('fighter');
      if (d - f !== want) out.push(`${id}: a druid's knack ${d}, a fighter's ${f}`);
    }
    // the feat
    const ctx = await newContext();
    const { Game } = ctx;
    const win = (cls, shapes, difficulty = 'normal') => {
      Game.newGame({ name: 'W', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'wild-' + cls + shapes + difficulty, opts: { ...OPTS, permadeath: true, difficulty } });
      Game.state().stats.shapes = shapes; winHere(Game); return Game.earned().firstFeats;
    };
    if (win('druid', 29).includes('wildheart')) out.push('twenty-nine bears earned Wildheart');
    if (win('druid', 30, 'easy').includes('wildheart')) out.push('Wildheart was earned on Easy');
    if (win('fighter', 40).includes('wildheart')) out.push('a fighter earned Wildheart');
    if (!win('druid', 30).includes('wildheart')) out.push('thirty bears on Normal did not earn Wildheart');
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes, the Druid: a staff\'s points stay, the Cast button moves on, a hide used up exactly, roots past bones, moss says what it healed', async () => {
    const out = [];
    const ctx = await druid('druid-review', 5);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    const shape = druidSpell(ctx, 'wild_shape');
    // the Staff of the Ninth Circle's well of power is not left behind by the bear
    p.eq.weapon = { t: 'staff', q: 1, e: 1, u: 'ninth_circle' };
    const sp0 = Game.spMax(p);
    Game.castSpell(shape);
    if (Game.spMax(p) !== sp0) out.push(`the bear took the staff's points: ${sp0} -> ${Game.spMax(p)}`);
    // the Cast button offers a spell that would cast
    if (Game.castLabel() === 'Wild Shape') out.push('in bear shape the Cast button still offers Wild Shape');
    // a blow the hide takes exactly: nothing reached the druid, so it is worn through, not torn
    p.shape.hide = 6; const hp0 = p.hp, taken0 = G.stats.taken || 0, mark = markLog(G);
    Game.hurtPlayer(6, 'The orc hits you for 6.');
    const said = linesSince(G, mark).join(' / ');
    if (p.hp !== hp0 || Game.shaped()) out.push(`six on a hide of six: hp ${hp0}->${p.hp}, shaped ${Game.shaped()}`);
    if (/tears through|and hurt/.test(said) || !/worn through/.test(said)) out.push(`said: ${said}`);
    if ((G.stats.taken || 0) !== taken0) out.push(`damage the hide took was counted as taken: ${taken0} -> ${G.stats.taken}`);
    // roots reach past fallen bones to the foe behind
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let k = 1; k <= 3; k++) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    const bones = { uid: 60, id: 'skeleton', x: p.x + dx, y: p.y + dy, hp: 5, maxHp: 5, awake: true, collapsed: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    const orc = { uid: 61, id: 'orc', x: p.x + dx * 2, y: p.y + dy * 2, hp: 50, maxHp: 50, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(bones, orc);
    ready(ctx);
    if (Game.castSpell(druidSpell(ctx, 'entangle')) !== true || !(orc.snaredUntil > G.t)) out.push('Entangle did not reach past the bones to the orc');
    else if (orc.heldBy !== 'roots') out.push(`what held the orc was marked ${orc.heldBy}, not roots, for its picture`);
    // Mending Moss on a full druid for a hurt companion says it healed the druid nothing
    L.monsters.length = 0; p.hp = p.maxHp;
    G.companion = { kind: 'hound', name: 'Ash', x: p.x - dx, y: p.y - dy, depth: G.depth, hp: 1, maxHp: 30, mode: 'follow', joined: G.depth };
    const m2 = markLog(G); ready(ctx);
    Game.castSpell(druidSpell(ctx, 'mending_moss'));
    const said2 = linesSince(G, m2).join(' / ');
    if (!/and heal 0\./.test(said2) || !/Ash is mended/.test(said2)) out.push(`Mending Moss said: ${said2}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a wolf comes to a druid in a delve with no hound, and only then; it hunts quietly, learns to go for the weak, and has its own fate', async () => {
    const out = [];
    const OPT8 = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false };
    const ctx = await newContext();
    const { Game } = ctx;
    const has = (cls, seed) => { Game.newGame({ name: 'W', cls, stats: { ...evenStats, wis: 16 }, seed, opts: OPT8 }); return Game.companion(); };
    // seeds with and without the starving hound: the wolf comes only where there is none
    let wolfSeed = '', houndSeed = '';
    for (let i = 0; i < 40 && !(wolfSeed && houndSeed); i++) { const c = has('druid', 'wolfseed-' + i); if (c && !wolfSeed) wolfSeed = 'wolfseed-' + i; if (!c && !houndSeed) houndSeed = 'wolfseed-' + i; }
    if (!wolfSeed || !houndSeed) return `seeds: wolf ${wolfSeed}, hound ${houndSeed}`;
    const w = has('druid', wolfSeed);
    if (w.kind !== 'wolf' || w.depth !== 1 || (w.floors || 0) !== 1) out.push(`the wolf: ${JSON.stringify({ kind: w.kind, depth: w.depth, floors: w.floors })}`);
    if (!Game.state().log.some(e => /grey wolf pads out of the dark/.test(e.m))) out.push('the wolf\'s coming was not told');
    if (has('fighter', wolfSeed)) out.push('a fighter was given a companion at the first stair');
    if (has('druid', houndSeed)) out.push('a druid in a delve with a hound was given a wolf as well');
    // it hunts quietly, where a hound pants at heel
    has('druid', wolfSeed);
    const c = Game.companion(), p = Game.player();
    c.x = p.x; c.y = p.y + 1; c.mode = 'follow';
    if (Game.companionNoisy()) out.push('the wolf is as noisy as a hound');
    c.kind = 'hound'; if (!Game.companionNoisy()) out.push('a hound at heel was quiet'); c.kind = 'wolf';
    // Savage: the same bites, 2 more each against a foe below half its life
    const bites = async low => {
      const b = await start('druid', wolfSeed, OPT8);
      const h = b.Game.companion(), P2 = b.Game.player(), G2 = b.Game.state();
      h.floors = 4; h.mode = 'stay';
      b.Game.level().monsters.length = 0;
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => b.Game.level().tiles[y * b.Game.level().w + x] === b.Dungeon.T.FLOOR && Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1 && !(x === P2.x && y === P2.y));
      if (!spot) return null;
      const m = { uid: 95, id: 'ogre', x: spot[0], y: spot[1], hp: low ? 4e5 : 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      b.Game.level().monsters.push(m);
      seedDice(b, 'savage');
      const hp0 = m.hp;
      run(b.Game, G2, 20000);
      return hp0 - m.hp;
    };
    const full = await bites(false), weak = await bites(true);
    if (full === null || weak === null) out.push('no room beside the wolf for the ogre');
    else if (!(weak > full) || (weak - full) % 2) out.push(`Savage: ${full} dealt to a whole ogre, ${weak} to a half-dead one`);
    // its own fate in the valley's tale
    const f = await start('druid', wolfSeed, OPT8);
    f.Game.companion().fallen = 1;
    const tale = JSON.stringify(f.Game.epilogue(false));
    if (!/grey wolf called/.test(tale) || /brown hound/.test(tale)) out.push(`the tale: ${tale.slice(0, 200)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin freed from its cage while a companion already follows slips away, and says so', async () => {
    const out = [];
    let said = '', tries = 0;
    while (!said && tries++ < 6) {
      const ctx = await start('fighter', 'cage-kin-' + tries, { levels: 6 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.stats.dex = 40;
      G.companion = { kind: 'hound', name: 'Ash', x: p.x, y: p.y, depth: 9, hp: 5, maxHp: 5, mode: 'stay', joined: 1 };
      const res = meetAndChoose(ctx, 'caged', 1);
      if (G.companion.kind !== 'hound') { out.push(`the goblin took the hound's place: ${G.companion.kind}`); break; }
      said = JSON.stringify(res || '') + G.log.slice(-4).map(e => e.m).join(' / ');
      if (!/slips off into the dark|thinks better of following/.test(said)) said = '';
    }
    if (!said && !out.length) out.push('no line said the goblin would not follow');
    return out.length ? out.join('; ') : true;
  });

  await test('a bear carries no shield, gives the rust no blade, and its hide keeps out blows, not hunger or poison', async () => {
    const out = [];
    const ctx = await druid('druid-bear-rules', 4);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.eq.shield = { t: 'buckler', q: 1, e: 0 };
    const withShield = Game.playerAC(); p.eq.shield = null; const bare = Game.playerAC(); p.eq.shield = { t: 'buckler', q: 1, e: 0 };
    Game.castSpell(druidSpell(ctx, 'wild_shape'));
    if (Game.playerAC() !== bare + 2) out.push(`a bear with a buckler: armour class ${Game.playerAC()}, want the bare druid's ${bare} + 2 (with the buckler, ${withShield})`);
    // and what the buckler was made with stays behind with it, though armour's powers go into the bear
    p.eq.shield = { t: 'buckler', q: 1, e: 0, pw: 'pure' }; p.eq.armor = { t: 'leather', q: 1, e: 0, pw: 'mend' };
    if (Game.hasPower('pure') || !Game.hasPower('mend')) out.push(`a bear: the buckler's Pure ${Game.hasPower('pure')}, the armour's Mend ${Game.hasPower('mend')}`);
    const shapeWas = p.shape; delete p.shape;
    if (!Game.hasPower('pure')) out.push('the buckler\'s Pure was lost with the bear gone');
    p.shape = shapeWas; p.eq.shield = { t: 'buckler', q: 1, e: 0 }; p.eq.armor = { t: 'leather', q: 1, e: 0 };
    // the rust: armour of leather has no metal, and the bear holds neither the buckler nor the spear
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
    const hide1 = p.shape.hide, until1 = p.shape.until;
    p.hp = p.maxHp = 9999; p.shape.hide = 1e6; p.shape.until = 1e12;
    const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999, edge: 40 });
    const mark = markLog(G);
    for (let i = 0; i < 4; i++) { m.moveReady = 0; run(Game, G, 1200); }
    if (p.eq.weapon.e !== 0 || p.eq.shield.e !== 0) out.push(`the rust reached what a bear does not hold: sword ${p.eq.weapon.e}, buckler ${p.eq.shield.e} (${linesSince(G, mark).filter(l => /[Rr]ust|metal/.test(l)).join(' | ')})`);
    if (!linesSince(G, mark).some(l => /no metal on you/.test(l))) out.push('the rustmaw never bit, or found metal');
    ctx.Game.level().monsters.length = 0; p.shape.hide = hide1; p.shape.until = G.t + 30000; void until1;
    // hunger and poison reach the druid inside the bear; a blow goes to the hide
    const hide0 = p.shape.hide, hp0 = p.hp;
    Game.hurtPlayer(1, 'The poison burns in your veins.', null, 'poison');
    if (p.shape.hide !== hide0 || p.hp !== hp0 - 1) out.push(`poison: hide ${hide0}->${p.shape.hide}, hp ${hp0}->${p.hp}`);
    Game.hurtPlayer(1, 'You are starving!', null, 'hunger');
    if (p.shape.hide !== hide0 || p.hp !== hp0 - 2) out.push(`hunger: hide ${hide0}->${p.shape.hide}, hp ${hp0 - 1}->${p.hp}`);
    Game.hurtPlayer(1, 'A dart strikes you.', null, 'trap');
    if (p.shape.hide !== hide0 - 1 || p.hp !== hp0 - 2) out.push(`a dart: hide ${hide0}->${p.shape.hide}, hp ${p.hp}`);
    void G;
    return out.length ? out.join('; ') : true;
  });

  await test('an overgrown floor: dealt over floors already twisted, caps to eat, traps hidden in the moss, a druid at home', async () => {
    const out = [];
    const ctx = await druid('overgrown', 5, { levels: 8 });
    const { Game, Dungeon, SPELLS } = ctx;
    // it takes some floors already twisted and changes nothing else in the plan
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const seed = 'og-' + i, a = Dungeon.twistPlan(seed, 8), b = Dungeon.twistPlan(seed, 8, false);
      // (a deep smouldering floor is added on its own dice, not dealt over another: left out here)
      for (const d in a) if (a[d] === 'smouldering') delete a[d];
      if (Object.keys(a).join() !== Object.keys(b).join()) { out.push(`${seed}: twisted floors ${Object.keys(a)} against ${Object.keys(b)}`); break; }
      for (const d in a) { if (a[d] === 'overgrown') { seen++; if (b[d] === 'market') out.push(`${seed}: a goblin market overgrown`); } else if (a[d] !== b[d] && !(a[d] === 'tremors' && b[d] !== 'market')) out.push(`${seed}: floor ${d} ${b[d]} became ${a[d]}`); }
    }
    if (seen < 20) out.push(`only ${seen} overgrown floors in 200 runs`);
    // caps grow on its floor
    const og = (() => { for (let i = 0; i < 200; i++) { const p = Dungeon.twistPlan('og-' + i, 8); for (const d in p) if (p[d] === 'overgrown') return ['og-' + i, +d]; } return null; })();
    const L = Dungeon.generate(og[0], og[1], { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
    const caps = Object.values(L.items).flat().filter(i => i.t === 'caps');
    if (L.twist !== 'overgrown' || caps.length !== 3) out.push(`an overgrown floor grew ${caps.length} caps (twist ${L.twist})`);
    // traps hide under the moss from all but a druid; a druid's spells cost a point less
    const lv = Game.level(), p = Game.player();
    const eyeDruid = Game.trapEye(), lash = SPELLS.druid.find(s => s.id === 'thorn_lash'), shape = SPELLS.druid.find(s => s.id === 'wild_shape');
    const c0 = [Game.spellCost(lash), Game.spellCost(shape)];
    lv.twist = 'overgrown';
    if (Game.trapEye() !== eyeDruid) out.push(`the moss hid a trap from a druid: ${eyeDruid} -> ${Game.trapEye()}`);
    if (Game.spellCost(lash) !== Math.max(1, c0[0] - 1) || Game.spellCost(shape) !== c0[1] - 1) out.push(`on an overgrown floor a druid's spells cost ${Game.spellCost(lash)}/${Game.spellCost(shape)}, elsewhere ${c0}`);
    p.cls = 'thief';
    const eyeThief = Game.trapEye(); lv.twist = null;
    if (Game.trapEye() - eyeThief !== 4) out.push(`the moss took ${Game.trapEye() - eyeThief} from a thief's eye, want 4`);
    return out.length ? out.join('; ') : true;
  });

  await test('an overgrown floor grows puffcaps over some of its creatures, each worth what it grew over; nowhere else', async () => {
    const out = [];
    const ctx = await start('fighter', 'puff-place');
    const { Game, Dungeon, MONSTERS } = ctx;
    const og = (() => { for (let i = 0; i < 300; i++) { const p = Dungeon.twistPlan('pf-' + i, 8); for (const d in p) if (p[d] === 'overgrown' && +d === 2) return ['pf-' + i, +d]; } return null; })();
    if (!og) return 'no early overgrown floor in 300 seeds';
    Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: og[0], opts: { ...OPTS, levels: 8 } });
    for (let i = 0; i < 5 && Game.state().depth < og[1]; i++) Game.descend();
    const L = Game.level();
    if (L.twist !== 'overgrown') return `floor ${og[1]} of ${og[0]} is ${L.twist}`;
    const raw = Dungeon.generate(og[0], og[1], { ...OPTS, levels: 8 });
    const caps = L.monsters.filter(m => m.id === 'puffcap');
    if (!caps.length) out.push(`no puffcaps among ${L.monsters.length} creatures`);
    for (const m of caps) {
      const was = raw.monsters.find(r => r.x === m.x && r.y === m.y);
      if (!was) { out.push(`a puffcap at ${m.x},${m.y} grew over nothing`); continue; }
      const b = MONSTERS[was.id];
      if (b.boss || b.named || was.elite || was.pack) out.push(`a puffcap grew over a ${was.elite || ''} ${was.id}`);
      if (m.worth !== b.xp) out.push(`a puffcap over a ${was.id} is worth ${m.worth}, want ${b.xp}`);
    }
    // none on an ordinary floor, and the depth never deals one
    for (let d = 1; d <= 8; d++) for (const s of ['pf-plain-a', 'pf-plain-b']) {
      const G2 = Dungeon.generate(s, d, { ...OPTS, levels: 8 });
      if (G2.monsters.some(m => m.id === 'puffcap')) out.push(`${s} floor ${d} dealt a puffcap by depth`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a flooded floor hides the drowned under its water, a dark one holds the eyeless; each worth what it replaced, and the restless never raise the drowned', async () => {
    const out = [];
    const ctx = await start('fighter', 'kin-place');
    const { Game, Dungeon, MONSTERS } = ctx;
    for (const [twist, id] of [['flooded', 'drowned'], ['dark', 'eyeless']]) {
      const at = (() => { for (let i = 0; i < 400; i++) { const p = Dungeon.twistPlan('kin-' + i, 8); for (const d in p) if (p[d] === twist && +d === 2) return ['kin-' + i, +d]; } return null; })();
      if (!at) { out.push(`no ${twist} second floor in 400 seeds`); continue; }
      Game.newGame({ name: 'K', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: at[0], opts: { ...OPTS, levels: 8 } });
      Game.descend();
      const L = Game.level();
      if (L.twist !== twist) { out.push(`floor 2 of ${at[0]} is ${L.twist}`); continue; }
      const raw = Dungeon.generate(at[0], 2, { ...OPTS, levels: 8 });
      const kin = L.monsters.filter(m => m.id === id);
      if (!kin.length) out.push(`no ${id} on a ${twist} floor of ${L.monsters.length} creatures`);
      for (const m of kin) {
        const was = raw.monsters.find(r => r.x === m.x && r.y === m.y);
        if (!was || m.worth !== MONSTERS[was.id].xp) out.push(`a ${id} over a ${was && was.id} is worth ${m.worth}`);
        if (id === 'drowned' && (!m.sunk || m.awake)) out.push(`a drowned one began ${m.sunk ? '' : 'un'}sunk and ${m.awake ? 'awake' : 'asleep'}`);
      }
    }
    // a restless floor raises its dead from those dealt by depth, never the drowned
    for (let i = 0; i < 300; i++) {
      const p = Dungeon.twistPlan('rst-' + i, 8), d = Object.keys(p).find(k => p[k] === 'restless');
      if (!d) continue;
      Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rst-' + i, opts: { ...OPTS, levels: 8, monsters: 'many' } });
      for (let k = 0; k < 8 && Game.state().depth < +d; k++) { if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts'); Game.descend(); }
      if (Game.level().monsters.some(m => m.id === 'drowned')) { out.push(`the restless dead of rst-${i} raised a drowned one`); break; }
      if (i > 40) break;
    }
    return out.length ? out.join('; ') : true;
  });
};
