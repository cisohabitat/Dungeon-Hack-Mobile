// Rule checks for the grey dwarves' hold.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function dwarvesChecks(h) {
  const { newContext, start, seedDice, markLog, linesSince, test, beside, ahead, run, untilTrick, meetAndChoose, arena } = h;

  // ---------- the grey dwarves' hold ----------
  await test('the eleventh floor of a sixteen-floor delve is the grey dwarves\' hold: their halls, their people, their Thane and their anvil; no such floor in twelve; no twist there; a rest broken there is broken by them', async () => {
    const out = [];
    const { THEMES } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
    const { Dungeon } = await newContext();
    if (Dungeon.peopleDepth('dwarves', 16) !== 11 || Dungeon.peopleDepth('dwarves', 12) !== null || Dungeon.peopleDepth('elves', 16) !== 14) out.push('the peoples\' floors are not the eleventh and fourteenth of sixteen, nor only the elves\' in twelve');
    const OPT = levels => ({ levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route: 'crypts' });
    const DWARF = /^(grey_dwarf|dwarf_arbalest|durgrim)$/;
    for (let s = 0; s < 5; s++) {
      for (const depth of [10, 11, 12]) {
        const L = Dungeon.generate('gh' + s, depth, OPT(16));
        const ids = L.monsters.map(m => m.id), forge = (L.npcs || []).some(n => n.kind === 'encounter' && n.id === 'dwarf_forge');
        if (depth === 11) {
          if (THEMES[L.theme].people !== 'dwarves') out.push(`gh${s}: the eleventh floor is ${THEMES[L.theme].name}`);
          if (ids.some(id => !DWARF.test(id))) out.push(`gh${s}: others in the hold: ${ids.filter(id => !DWARF.test(id)).join()}`);
          if (!ids.includes('durgrim')) out.push(`gh${s}: no Thane in the hold`);
          if (!forge) out.push(`gh${s}: no anvil in the hold`);
        } else if (ids.some(id => DWARF.test(id)) || forge) out.push(`gh${s}: a dwarf or their anvil on floor ${depth}`);
      }
      for (const depth of [8, 9, 10, 11]) if (Dungeon.generate('gh' + s, depth, OPT(12)).monsters.some(m => DWARF.test(m.id))) out.push(`gh${s}: a dwarf on floor ${depth} of twelve`);
    }
    for (let i = 0; i < 200; i++) {
      if (Dungeon.twistPlan('ght' + i, 16)[11]) { out.push('the hold was twisted'); break; }
      if (Dungeon.namedPlan('ght' + i, 16)[11] !== 'durgrim') { out.push('the hold was not the Thane\'s'); break; }
    }
    // a rest broken in the hold is broken by its people
    const ctx = await start('fighter', 'dwarfhold', { levels: 16, size: 'medium', monsters: 'normal' });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    Game.testFloor(11);
    const L = Game.level(), kinds = new Set();
    for (let i = 0; i < 30; i++) {
      L.monsters.length = 0; L.rests = 1; p.hp = 1; p.food = 100;
      G.t += 60000;
      Game.input('rest');
      for (const mm of L.monsters) kinds.add(mm.id);
    }
    if (!kinds.size) out.push('thirty rests in the hold and nothing came');
    if ([...kinds].some(id => !DWARF.test(id))) out.push(`a rest in the hold was broken by ${[...kinds].join(', ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a grey dwarf swells to twice its height and hits half as hard again until it shrinks; a wound as it swells breaks the working', async () => {
    const out = [];
    // the same blows on the same dice, grown and not
    const blows = async grown => {
      const ctx = await start('fighter', 'enlarge-hits');
      const { Game, MONSTERS } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 99999;
      const was = MONSTERS.grey_dwarf;
      MONSTERS.grey_dwarf = { ...was, hit: 60, move: undefined };
      try {
        beside(ctx, 'grey_dwarf', grown ? { bigUntil: 1e15 } : {});
        seedDice(ctx, 'enlarge-hits');
        const hp0 = p.hp; run(Game, G, 15000);
        return hp0 - p.hp;
      } finally { MONSTERS.grey_dwarf = was; }
    };
    const plain = await blows(false), big = await blows(true);
    if (!(plain > 0) || big / plain < 1.35 || big / plain > 1.65) out.push(`grown it dealt ${big}, its own size ${plain}`);
    // left to swell, it grows, and shrinks again
    {
      const ctx = await start('fighter', 'enlarge-left');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999;
      const m = beside(ctx, 'grey_dwarf', { blows: 1 });
      if (!untilTrick(ctx, m, 'enlarge')) return 'the grey dwarf never swelled';
      const mark = markLog(G);
      run(Game, G, 1500);
      if (!(m.bigUntil > G.t)) out.push('left alone, it did not grow');
      if (!linesSince(G, mark).some(l => /grown to twice its height/.test(l))) out.push('its growing was not told');
      const mark2 = markLog(G);
      for (let i = 0; i < 480 && m.bigUntil; i++) { Game.update(G.t + 25, 25); p.hp = p.maxHp; }
      if (m.bigUntil) out.push('it never shrank');
      if (!linesSince(G, mark2).some(l => /shrinks back to its own size/.test(l))) out.push('its shrinking was not told');
    }
    // struck as it swells, the working breaks (a blow can miss: try again)
    let struck = false;
    for (let tries = 0; tries < 8 && !struck; tries++) {
      const ctx = await start('fighter', 'enlarge-break' + tries);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.stats.str = 30;
      const m = beside(ctx, 'grey_dwarf', { blows: 1 });
      if (!untilTrick(ctx, m, 'enlarge')) return 'the grey dwarf never swelled';
      const hp0 = m.hp, mark = markLog(G);
      p.nextAttack = 0; Game.input('attack');
      if (m.hp >= hp0) continue;
      struck = true;
      run(Game, G, 1500);
      if (m.bigUntil > G.t) out.push('a wound as it swelled did not break the working');
      if (!linesSince(G, mark).some(l => /breaks the Grey Dwarf's working/.test(l))) out.push('the broken working was not told');
    }
    if (!struck) out.push('no blow landed in eight tries');
    return out.length ? out.join('; ') : true;
  });

  await test('a grey dwarf arbalest takes careful aim down its line: the bolt takes one still in it twice as hard, and cracks off the stone, leaving it open, past one who steps aside', async () => {
    const out = [];
    for (const aside of [false, true]) {
      const { Game, G, p, put } = await arena('fighter', 'aim-' + aside);
      p.hp = p.maxHp = 9999;
      const m = put('dwarf_arbalest', 3, 0, { nextAct: G.t, blows: 0 });
      if (!untilTrick({ Game }, m, 'aim')) return 'the arbalest never took aim';
      if (aside) Game.input('strafeR');
      const hp0 = p.hp, mark = markLog(G);
      for (let i = 0; i < 60 && m.windup && m.windup.move === 'aim'; i++) Game.update(G.t + 25, 25);
      const said = linesSince(G, mark).join(' | ');
      if (!aside && (!(p.hp < hp0) || !/takes you square/.test(said))) out.push(`standing in its line, the bolt: ${said}`);
      if (aside && (p.hp < hp0 || !/cracks off the stone/.test(said) || !(p.opening && p.opening.uid === m.uid))) out.push(`stepped aside, the bolt: ${said}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a grey dwarf leaves its hammer or its plate now and then, an arbalest its rune-cut shield; Durgrim drops his ring once; none is found lying about or dealt', async () => {
    const out = [];
    const ctx = await start('fighter', 'dwarf-loot', { levels: 16 });
    const { Game, ITEMS, RELICS } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    // (what each kill that left plate said of it, read straight after, before the log can scroll it away)
    const plateSaid = [];
    const kills = (id, n) => {
      const got = {};
      for (let i = 0; i < n; i++) {
        const m = beside(ctx, id, { hp: 1, maxHp: 1, nextAct: 1e12 });
        const mark = markLog(G);
        for (let t = 0; t < 40 && Game.level().monsters.includes(m); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
        const k = `${m.x},${m.y}`;
        for (const it of Game.level().items[k] || []) got[it.u || it.t] = (got[it.u || it.t] || 0) + 1;
        if ((Game.level().items[k] || []).some(it => it.t === 'dwarfplate')) plateSaid.push(linesSince(G, mark).join(' | '));
        delete Game.level().items[k];
      }
      return got;
    };
    // (about one dwarf in nineteen leaves plate: 120 of them leave none about one time in seven hundred)
    const w = kills('grey_dwarf', 120), a = kills('dwarf_arbalest', 60);
    if (!((w.dwarfhammer || 0) > 3 && (w.dwarfhammer || 0) < 32)) out.push(`120 dwarves left ${w.dwarfhammer || 0} hammers`);
    if (!((w.dwarfplate || 0) > 0 && (w.dwarfplate || 0) < 20)) out.push(`120 dwarves left ${w.dwarfplate || 0} suits of plate`);
    if (!((a.runeshield || 0) > 2 && (a.runeshield || 0) < 25)) out.push(`60 arbalests left ${a.runeshield || 0} shields`);
    if (w.runeshield || a.dwarfhammer || a.dwarfplate) out.push('a warrior left a shield, or an arbalest a hammer or plate');
    if (plateSaid.some(l => !/worth taking: Dwarven Plate\./.test(l))) out.push(`plate was told as: ${plateSaid.find(l => !/worth taking: Dwarven Plate\./.test(l))}`);
    if (kills('durgrim', 1).thane_ring !== 1) out.push('Durgrim did not drop his ring');
    G.relics.found.push('thane_ring');
    if (kills('durgrim', 1).thane_ring) out.push('a second ring fell, the first already found');
    if (['dwarfplate', 'dwarfhammer', 'runeshield', 'ring_forge'].some(t => ITEMS[t].tier < 50)) out.push('dwarven loot can turn up as ordinary loot');
    if (!(ITEMS.dwarfplate.ac > ITEMS.plate.ac) || ITEMS.dwarfplate.weight !== 'heavy') out.push('dwarven plate is not heavy armour better than plate');
    const { relicPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'relics.js')).href);
    for (let i = 0; i < 60; i++) for (const cls of ['fighter', 'mage', 'druid']) {
      const plan = relicPlan('ring' + i, cls, 16);
      if (Object.values(plan.floor).includes('thane_ring') || plan.shop.includes('thane_ring')) { out.push('the Thane\'s ring was dealt to a floor or a shop'); break; }
    }
    if (RELICS.thane_ring.champion !== 'durgrim') out.push('the ring is not Durgrim\'s');
    return out.length ? out.join('; ') : true;
  });

  await test('grey dwarves are stout: venom on a blade never takes on them (told once), and they ride out a blast more often than their skill alone would say', async () => {
    const out = [];
    const poisoned = async id => {
      const ctx = await start('fighter', 'stout-' + id);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.stats.str = 30;
      const m = beside(ctx, id, { hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
      const mark = markLog(G);
      let n = 0;
      for (let i = 0; i < 60; i++) { p.coating = { t: 'venom', left: 20 }; m.dot = null; G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); if (m.dot && m.dot.kind === 'venom') n++; }
      return { n, said: linesSince(G, mark).filter(l => /grey dwarves are stout/.test(l)).length };
    };
    const dw = await poisoned('grey_dwarf'), elf = await poisoned('drow_warrior');
    if (dw.n) out.push(`venom took on a grey dwarf ${dw.n} times`);
    if (dw.said !== 1) out.push(`the dwarf's stoutness was told ${dw.said} times`);
    if (!(elf.n > 3)) out.push(`venom took on a dark elf only ${elf.n} times in 60 blows`);
    // the same blasts at a foe as sure as a grey dwarf with its arms, stout and not
    const saves = async stout => {
      const { ctx, Game, G, p, put, cast } = await arena('mage', 'stout-saves');
      const { MONSTERS } = ctx;
      // the same mage both times: scores are rolled afresh for each new game, and a
      // mage two points sharper set a save two harder, hiding the dwarf's two (a flake)
      for (const k in p.stats) p.stats[k] = 14;
      const was = MONSTERS.ogre;
      MONSTERS.ogre = { ...was, hit: 4, stout };
      try {
        seedDice(ctx, 'stout-saves');
        let k = 0;
        for (let i = 0; i < 200; i++) {
          Game.level().monsters.length = 0;
          put('ogre', 1, 0, { hp: 5000, maxHp: 5000 });
          const mark = markLog(G); p.sp = 999; cast('lightning');
          if (linesSince(G, mark).some(l => /the worst of your/.test(l))) k++;
        }
        return k;
      } finally { MONSTERS.ogre = was; }
    };
    const plain = await saves(false), stoutK = await saves(true);
    if (!(stoutK > plain + 10)) out.push(`a stout foe saved ${stoutK} times in 200, one not stout ${plain}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a dark elf mage leaves its hand crossbow now and then; its bolts drowse a living foe one hit in four, never the dead, a stout dwarf nor a champion', async () => {
    const out = [];
    const ctx = await start('ranger', 'xbow');
    const { Game, ITEMS } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.dex = 30;
    p.eq.weapon = { t: 'handxbow', q: 1, e: 0 };
    const shots = id => {
      const m = ahead(ctx, id, 3, { hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
      seedDice(ctx, 'xbow-' + id);
      for (let i = 0; i < 80; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); }
      return { hit: 1e6 - m.hp, drowsed: Math.round((m.nextAct - 1e12) / 1000) };
    };
    const ogre = shots('ogre'), bones = shots('skeleton'), queen = shots('vaelith'), dwarf = shots('grey_dwarf');
    if (!(ogre.hit > 0)) out.push('the crossbow never hit');
    else if (!(ogre.drowsed >= 4)) out.push(`80 bolts drowsed a living ogre ${ogre.drowsed} times`);
    if (bones.drowsed || queen.drowsed || dwarf.drowsed) out.push(`bolts drowsed a skeleton ${bones.drowsed} times, Vaelith ${queen.drowsed}, a stout grey dwarf ${dwarf.drowsed}`);
    if (ITEMS.handxbow.tier < 50 || ITEMS.handxbow.twoHanded) out.push('the hand crossbow is ordinary loot, or wants two hands');
    // and it falls from a mage now and then
    let got = 0;
    for (let i = 0; i < 80; i++) {
      const m = beside(ctx, 'drow_mage', { hp: 1, maxHp: 1, nextAct: 1e12 });
      p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
      for (let t = 0; t < 40 && Game.level().monsters.includes(m); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      const k = `${m.x},${m.y}`;
      if ((Game.level().items[k] || []).some(it => it.t === 'handxbow')) got++;
      delete Game.level().items[k];
    }
    if (!(got >= 1 && got < 24)) out.push(`80 mages left ${got} hand crossbows`);
    return out.length ? out.join('; ') : true;
  });

  await test('a renegade at the hero\'s side when Vaelith falls has what they came for: they say so, are mended whole, and the valley tells it', async () => {
    const out = [];
    for (const where of ['beside', 'below', 'far']) {
      const here = where === 'beside';
      const ctx = await start('fighter', 'avenge-' + where, { levels: 12 });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.stats.str = 30; p.gold = 1000;
      meetAndChoose(ctx, 'exile', 0); Game.closeEncounter();
      const c = Game.companion();
      c.hp = 1;
      if (where === 'below') c.depth = G.depth + 1;
      const v = beside(ctx, 'vaelith', { hp: 1, maxHp: 1, nextAct: 1e12 });
      // told to stay at the far end of the floor: out of sight of it
      if (where === 'far') { c.mode = 'stay'; c.x = v.x + 12; c.y = v.y; }
      const mark = markLog(G);
      for (let t = 0; t < 40 && Game.level().monsters.includes(v); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      const said = linesSince(G, mark).some(l => /That was all I wanted/.test(l));
      if (here && (!said || !c.avenged || c.hp !== c.maxHp)) out.push(`at the hero's side: said ${said}, avenged ${c.avenged}, ${c.hp}/${c.maxHp}`);
      if (!here && (said || c.avenged)) out.push(`a renegade ${where === 'far' ? 'at the far end of the floor' : 'on another floor'} was told as avenged`);
      if (here) {
        c.depth = G.depth; if (!/saw the High Priestess of their people fall/.test(JSON.stringify(Game.epilogue(true)))) out.push('the tale does not tell it');
        // and still tells it when the hero dies, or wins with them left on another floor
        if (!/saw the High Priestess of their people fall/.test(JSON.stringify(Game.epilogue(false)))) out.push('the tale of a fallen hero forgets it');
        c.depth = G.depth + 1; if (!/saw the High Priestess of their people fall/.test(JSON.stringify(Game.epilogue(true)))) out.push('the tale forgets it when they are not at the end');
      }
    }
    return out.length ? out.join('; ') : true;
  });
};
