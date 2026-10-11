// Rule checks for what the dark elves leave.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function darkelvesChecks(h) {
  const { newContext, start, seedDice, markLog, linesSince, test, beside, run, meetAndChoose, arena } = h;

  // ---------- what the dark elves leave ----------
  await test('a dark elf warrior leaves its scimitar or its elven chain now and then, a mage its shadow cloak; Vaelith drops the Spider Pendant once; none is found lying about', async () => {
    const out = [];
    const ctx = await start('fighter', 'elf-loot', { levels: 12 });
    const { Game, ITEMS, CLASSES, armorFits, RELICS } = ctx; const p = Game.player(), G = Game.state();
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
    // (enough of each that a run of bad luck outside the bounds is about one in ten thousand:
    // with 60 mages, two cloaks or fewer came up one run in 250, and did)
    const w = kills('drow_warrior', 200), m = kills('drow_mage', 150);
    if (!((w.scimitar || 0) > 8 && (w.scimitar || 0) < 50)) out.push(`200 warriors left ${w.scimitar || 0} scimitars`);
    if (!((w.elvenchain || 0) > 3 && (w.elvenchain || 0) < 35)) out.push(`200 warriors left ${w.elvenchain || 0} coats of elven chain`);
    if (!((m.cloak_shadow || 0) > 7 && (m.cloak_shadow || 0) < 50)) out.push(`150 mages left ${m.cloak_shadow || 0} shadow cloaks`);
    if (w.cloak_shadow || m.scimitar || m.elvenchain) out.push('a warrior left a cloak, or a mage a blade or mail');
    const v1 = kills('vaelith', 1);
    if (v1.spider_pendant !== 1) out.push(`Vaelith left ${JSON.stringify(v1)}`);
    G.relics.found.push('spider_pendant');
    if (kills('vaelith', 1).spider_pendant) out.push('a second Spider Pendant fell, the first already found');
    if (ITEMS.elvenchain.tier < 50 || ITEMS.scimitar.tier < 50 || ITEMS.cloak_shadow.tier < 50 || ITEMS.amulet_spider.tier < 50) out.push('elven loot can turn up as ordinary loot');
    if (!armorFits(CLASSES.thief, ITEMS.elvenchain) || armorFits(CLASSES.mage, ITEMS.elvenchain) || ITEMS.elvenchain.ac !== ITEMS.chain.ac) out.push('elven chain is not light armour as good as chain');
    // nor on a pile or a trader's shelf as a cloak, nor dealt as a relic of the floors or the shops
    const { relicPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'relics.js')).href);
    for (let i = 0; i < 60; i++) for (const cls of ['fighter', 'mage', 'druid']) {
      const plan = relicPlan('pend' + i, cls, 12);
      if (Object.values(plan.floor).includes('spider_pendant') || plan.shop.includes('spider_pendant')) { out.push('the Spider Pendant was dealt to a floor or a shop'); break; }
    }
    if (RELICS.spider_pendant.champion !== 'vaelith') out.push('the pendant is not Vaelith\'s');
    for (let d = 2; d <= 12; d++) {
      Game.testFloor(d);
      for (const pile of Object.values(Game.level().items)) if (pile.some(it => it.t === 'cloak_shadow')) out.push(`a shadow cloak lay about on floor ${d}`);
      for (const n of Game.level().npcs || []) if ((n.stock || []).some(it => it.t === 'cloak_shadow')) out.push(`a trader sold a shadow cloak on floor ${d}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the Spider Pendant keeps every web off its wearer and steadies every save; a web still holds the hero without it', async () => {
    const out = [];
    for (const worn of [false, true]) {
      const { Game, G, p, put } = await arena('fighter', 'pendant-' + worn);
      if (worn) p.eq.amulet = { t: 'amulet_spider', q: 1, e: 1, u: 'spider_pendant' };
      const m = put('drow_mage', 3, 0, { hp: 80, maxHp: 80 });
      m.windup = { kind: 'move', move: 'web', at: G.t, until: G.t + 100 }; m.nextAct = m.windup.until;
      p.webbed = 0;
      const mark = markLog(G);
      run(Game, G, 300);
      const held = p.webbed > G.t;
      if (worn && held) out.push('a web held the hero wearing the Spider Pendant');
      if (worn && !linesSince(G, mark).some(l => /parts around you/.test(l))) out.push('the web parting was not told');
      if (!worn && !held) out.push('a web did not hold the hero without the pendant');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the dark elves\' floor holds their Spider Altar, and no other floor does; robbing it badly brings their warriors', async () => {
    const out = [];
    const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    const { Dungeon } = await newContext();
    for (let i = 0; i < 40; i++) for (const levels of [8, 12, 16]) {
      if (encounterPlan('alt' + i, levels, Dungeon.tierAt).flat().includes('spider_altar')) { out.push('the altar was dealt from the deck'); break; }
    }
    for (let s = 0; s < 6; s++) for (const levels of [12, 16]) {
      const at = Dungeon.elfDepth(levels);
      for (const depth of [at - 1, at, at + 1]) {
        const L = Dungeon.generate('alt' + s, depth, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route: 'crypts' });
        const has = (L.npcs || []).some(n => n.kind === 'encounter' && n.id === 'spider_altar');
        if (has !== (depth === at)) out.push(`alt${s}/${levels}/${depth}: altar ${has ? 'there' : 'missing'}`);
      }
    }
    const pry = ENCOUNTERS.spider_altar.choices.find(c => /garnets/.test(c.label));
    if (!pry.fail.effects.some(e => e.ambush && e.ambush.id === 'drow_warrior')) out.push('a botched theft brought no warriors');
    return out.length ? out.join('; ') : true;
  });

  await test('a dark elf outcast waits two floors above their halls on a Long Delve, and nowhere else; paid, or promised the High Priestess, they follow; Sleep Poison slows the living, never the dead, a boss or a champion; Kinslayer cuts 4 deeper at their kin; and they have their own fate', async () => {
    const out = [];
    const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    const { Dungeon } = await newContext();
    for (let i = 0; i < 40; i++) for (const levels of [8, 12, 16]) {
      if (encounterPlan('ex' + i, levels, Dungeon.tierAt).flat().includes('exile')) { out.push('the outcast was dealt from the deck'); break; }
    }
    for (let s = 0; s < 4; s++) for (const levels of [12, 16]) {
      const at = Dungeon.elfDepth(levels) - 2;
      for (const depth of [at - 1, at, at + 1]) {
        const L = Dungeon.generate('ex' + s, depth, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, route: 'crypts' });
        const has = (L.npcs || []).some(n => n.kind === 'encounter' && n.id === 'exile');
        if (has !== (depth === at)) out.push(`ex${s}/${levels}/${depth}: outcast ${has ? 'there' : 'missing'}`);
      }
    }
    const OPT12 = { levels: 12 };
    {
      const ctx = await start('fighter', 'exile-pay', OPT12);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.gold = 1000;
      meetAndChoose(ctx, 'exile', 0); Game.closeEncounter();
      const c = Game.companion();
      if (!c || c.kind !== 'renegade') return `no renegade followed: ${JSON.stringify(c)}`;
      if (p.gold !== 1000 - 25 * G.depth) out.push(`hiring cost ${1000 - p.gold}, not ${25 * G.depth}`);
      // blooded already, two floors from a veteran: Kinslayer by the time the hero reaches the halls
      if (c.floors !== 2 || !Game.threadNotes().some(n => n.includes(c.name) && /Sleep Poison/.test(n) && /learns Kinslayer/.test(n))) out.push(`the renegade came in at ${c.floors} floors: ${Game.threadNotes().find(n => n.includes(c.name))}`);
    }
    {
      const ctx = await start('thief', 'exile-promise', OPT12);
      const { Game } = ctx; const p = Game.player();
      p.stats.cha = 30; p.gold = 0;
      let r = null;
      for (let i = 0; i < 6 && !(r && r.check && r.check.pass); i++) { r = meetAndChoose(ctx, 'exile', 1); Game.closeEncounter(); }
      if (!r.check.pass || !Game.companion() || Game.companion().kind !== 'renegade') out.push('promised Vaelith, the outcast did not follow');
    }
    // its cuts at one foe beside it (not beside the hero), on the same dice: how deep, and how often they drowse it
    const cuts = async (id, floors, key) => {
      const b = await start('fighter', 'exile-cuts', OPT12);
      const P2 = b.Game.player(), G2 = b.Game.state();
      P2.hp = P2.maxHp = 9999; P2.gold = 1000;
      meetAndChoose(b, 'exile', 0); b.Game.closeEncounter();
      const h = b.Game.companion();
      h.floors = floors; h.mode = 'stay';
      const L = b.Game.level();
      L.monsters.length = 0;
      const spot = b.Dungeon.DIRS.map(([dx, dy]) => [h.x + dx, h.y + dy]).find(([x, y]) => L.tiles[y * L.w + x] === b.Dungeon.T.FLOOR && Math.abs(x - P2.x) + Math.abs(y - P2.y) > 1);
      if (!spot) return null;
      const m = { uid: 95, id, x: spot[0], y: spot[1], hp: 1e6, maxHp: 1e6, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.push(m);
      seedDice(b, key);
      run(b.Game, G2, 20000);
      return { dealt: 1e6 - m.hp, drowsed: Math.round((m.nextAct - 1e12) / 1000) };
    };
    const kin = await cuts('drow_warrior', 4, 'kin'), plain = await cuts('drow_warrior', 2, 'kin');
    if (!kin || !plain) return 'no room beside the renegade';
    if (!(kin.dealt > plain.dealt) || (kin.dealt - plain.dealt) % 4) out.push(`Kinslayer: ${plain.dealt} dealt to a warrior blooded, ${kin.dealt} a veteran`);
    const ogre = await cuts('ogre', 2, 'drowse'), green = await cuts('ogre', 0, 'drowse');
    if (!(ogre.drowsed >= 2)) out.push(`a blooded renegade drowsed a living ogre ${ogre.drowsed} times in twenty seconds`);
    if (green.drowsed) out.push('a renegade new to the hero drowsed its foe');
    for (const id of ['skeleton', 'warlord', 'vaelith']) {
      const r = await cuts(id, 2, 'drowse-' + id);
      if (r.drowsed) out.push(`the poison drowsed a ${id} ${r.drowsed} times`);
    }
    const f = await start('fighter', 'exile-pay', OPT12);
    f.Game.player().gold = 1000;
    meetAndChoose(f, 'exile', 0); f.Game.closeEncounter();
    f.Game.companion().fallen = 3;
    const tale = JSON.stringify(f.Game.epilogue(false));
    if (!/a dark elf called/i.test(tale)) out.push(`the tale: ${tale.slice(-400)}`);
    return out.length ? out.join('; ') : true;
  });
};
