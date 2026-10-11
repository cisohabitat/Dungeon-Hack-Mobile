// Rule checks for saving throws, both ways: the foes' against spells and the hero's against tricks.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function savesChecks(h) {
  const { seedDice, markLog, linesSince, test, run, arena } = h;

  // ---------- saving throws, both ways ----------
  // The same dice twice over, one foe that cannot fail a save (but on a 1) and one that cannot
  // make it (but on a 20): every cast lands for the same roll, so the saved hits are three quarters of the rest.
  const castSeries = async (cls, spellId, sure, n = 30) => {
    const { ctx, Game, G, p, put, cast } = await arena(cls, 'saves-' + spellId);
    const { MONSTERS } = ctx;
    p.stats[ctx.CLASSES[cls].primary] = 16;
    MONSTERS.ogre = { ...MONSTERS.ogre, hit: sure ? 60 : -60 };
    seedDice(ctx, 'saves-' + spellId);
    const dmg = [], saved = [];
    for (let i = 0; i < n; i++) {
      Game.level().monsters.length = 0;
      const m = put('ogre', 1, 0, { hp: 5000, maxHp: 5000 });
      const mark = markLog(G);
      p.sp = 999; cast(spellId);
      dmg.push(5000 - m.hp);
      saved.push(linesSince(G, mark).some(l => /the worst of your/.test(l)));
    }
    return { dmg, saved, G };
  };

  await test('a foe can ride out a spell that fills its square or its corridor and take three quarters of it, by the right score; a dart, a smite, a lash or a lightning stroke at one foe is never saved against', async () => {
    const out = [];
    for (const [cls, id, word] of [['mage', 'burning_hands', 'twists from'], ['mage', 'lightning', 'twists from'], ['mage', 'cone_cold', 'braces against'], ['cleric', 'flame_strike', 'twists from'], ['druid', 'insect_plague', 'braces against']]) {
      const yes = await castSeries(cls, id, true), no = await castSeries(cls, id, false);
      let cut = 0;
      for (let i = 0; i < yes.dmg.length; i++) {
        const whole = no.dmg[i], part = Math.max(1, Math.round(whole * 0.75));
        if (yes.dmg[i] === part && part !== whole) cut++;
        else if (yes.dmg[i] !== whole) { out.push(`${id}: cast ${i} did ${yes.dmg[i]} to a foe that saves, ${whole} to one that does not`); break; }
      }
      if (cut < yes.dmg.length * 0.7) out.push(`${id}: only ${cut} of ${yes.dmg.length} casts were cut by a save`);
      if (no.saved.filter(Boolean).length > 4) out.push(`${id}: a foe that cannot save was told as saving ${no.saved.filter(Boolean).length} times`);
      if (!yes.G.log.some(e => e.m.includes(word))) out.push(`${id}: the save was not told as one that ${word} it`);
    }
    for (const [cls, id] of [['mage', 'magic_missile'], ['cleric', 'smite'], ['druid', 'thorn_lash'], ['druid', 'call_lightning']]) {
      const yes = await castSeries(cls, id, true), no = await castSeries(cls, id, false);
      if (yes.dmg.join() !== no.dmg.join() || yes.saved.some(Boolean)) out.push(`${id} was saved against`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a boss wrapped in shadow, or a heap of bones, does not ride out a blast it cannot feel; a group that does is told as one', async () => {
    const out = [];
    const { ctx, Game, G, p, put, cast } = await arena('mage', 'save-skip');
    const { MONSTERS } = ctx;
    for (const id of ['lich', 'skeleton', 'goblin']) MONSTERS[id] = { ...MONSTERS[id], hit: 60 };
    const said = (id, extra) => {
      Game.level().monsters.length = 0;
      put(id, 1, 0, { hp: 5000, maxHp: 5000, ...extra });
      const mark = markLog(G); p.sp = 999; cast('lightning');
      return linesSince(G, mark).join(' | ');
    };
    for (let i = 0; i < 4; i++) {
      if (/the worst of your/.test(said('lich', { wardUntil: G.t + 1e9 }))) { out.push('a lich in shadow rode out a blast'); break; }
    }
    for (let i = 0; i < 4; i++) {
      if (/the worst of your/.test(said('skeleton', { collapsed: true }))) { out.push('a heap of bones rode out a blast'); break; }
    }
    let group = '';
    for (let i = 0; i < 6 && !/Goblins twist/.test(group); i++) group = said('goblin', { pack: [{ hp: 5000, maxHp: 5000 }, { hp: 5000, maxHp: 5000 }] });
    if (!/The Goblins twist from the worst/.test(group)) out.push(`a group's save: "${group}"`);
    return out.length ? out.join('; ') : true;
  });

  await test('a spell can slide off a dark elf as if it were not there: a warrior one time in five, a mage one in four, the High Priestess one in three; it does nothing to one it slides off, never slides off a goblin, nor do Entangle\'s roots, and the bestiary learns it', async () => {
    const out = [];
    const shrugs = async (cls, id, spell, n = 300) => {
      const { ctx, Game, G, p, put, cast } = await arena(cls, 'spellres-' + id + spell);
      seedDice(ctx, 'spellres-' + id + spell);
      let k = 0;
      for (let i = 0; i < n; i++) {
        Game.level().monsters.length = 0;
        const m = put(id, 1, 0, { hp: 5000, maxHp: 5000, nextAct: G.t + 1e6 });
        const mark = markLog(G); p.sp = 999; cast(spell);
        if (linesSince(G, mark).some(l => /slides off /.test(l))) {
          k++;
          if (m.hp !== 5000) out.push(`${spell} hurt a ${id} it slid off`);
          if (m.snaredUntil > G.t) out.push(`${spell} held a ${id} it slid off`);
        } else if (m.hp === 5000 && !(m.snaredUntil > G.t)) out.push(`${spell} did nothing to a ${id}, and did not say it slid off`);
      }
      return { rate: k / n, Game };
    };
    for (const [id, want] of [['drow_warrior', 0.2], ['drow_mage', 0.25], ['vaelith', 1 / 3]]) {
      const { rate } = await shrugs('mage', id, 'magic_missile');
      if (Math.abs(rate - want) > 0.08) out.push(`Magic Missile slid off a ${id} ${Math.round(rate * 100)}% of the time, not about ${Math.round(want * 100)}%`);
    }
    // (Entangle's roots are the stone's own, not a spell upon the elf: they hold it as they hold anyone)
    if ((await shrugs('druid', 'drow_warrior', 'entangle', 100)).rate) out.push('Entangle slid off a warrior');
    const blast = await shrugs('mage', 'drow_mage', 'lightning', 200);
    if (Math.abs(blast.rate - 0.25) > 0.1) out.push(`Lightning slid off a mage ${Math.round(blast.rate * 100)}% of the time`);
    const book = blast.Game.bestiary();
    if (!(book.drow_mage && book.drow_mage.sr)) out.push('the bestiary did not learn that a mage shrugs off spells');
    if ((await shrugs('mage', 'goblin', 'magic_missile', 100)).rate) out.push('a spell slid off a goblin');
    return out.length ? out.join('; ') : true;
  });

  await test('a foe\'s save against a spell is harder the sharper the caster and the higher their level, easier the surer its blows; a champion saves better still', async () => {
    const out = [];
    const { ctx, Game, G, p, put, cast } = await arena('mage', 'save-dc');
    const { MONSTERS } = ctx;
    if (!Game.rollsShown()) Game.toggleRolls();
    // every save holds (but on a 1), and with the rolls shown says what it needed
    const seen = (int, level, id = 'ogre', hit = 20) => {
      MONSTERS[id] = { ...MONSTERS[id], hit };
      p.stats.int = int; p.level = level;
      for (let i = 0; i < 40; i++) {
        Game.level().monsters.length = 0;
        put(id, 1, 0, { hp: 5000, maxHp: 5000 });
        const mark = markLog(G);
        p.sp = 999; cast('burning_hands');
        const line = linesSince(G, mark).find(l => /d20 \d+\+\d+ vs \d+/.test(l));
        if (line) { const [, b, dc] = line.match(/d20 \d+\+(\d+) vs (\d+)/); return { b: +b, dc: +dc }; }
      }
      return null;
    };
    const a = seen(10, 1), b = seen(18, 1), c = seen(18, 9), d = seen(18, 9, 'ogre', 7), e = seen(18, 9, 'vaelith', 20);
    if (!a || a.dc !== 10) out.push(`a level-1 caster with Intelligence 10: to beat ${a && a.dc}, not 10`);
    if (!b || b.dc !== 14) out.push(`Intelligence 18: ${b && b.dc}, not 14`);
    if (!c || c.dc !== 18) out.push(`at level 9: ${c && c.dc}, not 18`);
    if (!c || c.b !== 10) out.push(`a foe that hits at +20 saves at +${c && c.b}, not +10`);
    if (!d || d.b !== 3) out.push(`a foe that hits at +7 saves at +${d && d.b}, not +3`);
    if (!e || e.b !== 12) out.push(`a champion that hits at +20 saves at +${e && e.b}, not +12`);
    // and on a natural 1 no foe saves, on a 20 every one does
    return out.length ? out.join('; ') : true;
  });

  await test('Entangle holds a foe that saves by its strength two thirds as long, and still breaks off its blow; a boss half as long, whatever it rolls', async () => {
    const out = [];
    for (const sure of [true, false]) {
      const { ctx, Game, G, put, cast } = await arena('druid', 'entangle-save-' + sure);
      const { MONSTERS } = ctx;
      MONSTERS.ogre = { ...MONSTERS.ogre, hit: sure ? 60 : -60 };
      const holds = [];
      for (let i = 0; i < 12; i++) {
        Game.level().monsters.length = 0;
        const m = put('ogre', 2, 0, { hp: 5000, maxHp: 5000 });
        m.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t + 900 };
        cast('entangle');
        if (m.windup) out.push(`${sure ? 'a saving' : 'a held'} foe kept its blow`);
        holds.push(m.snaredUntil - G.t);
      }
      const long = holds.filter(h => h >= 3400).length, short = holds.filter(h => h >= 2250 && h <= 2420).length;
      if (sure && short < 10) out.push(`a foe that saves was held ${holds.join(', ')}`);
      if (!sure && long < 10) out.push(`a foe that cannot save was held ${holds.join(', ')}`);
    }
    // a boss tears free in half the time whatever it rolls: never a quarter
    {
      const { ctx, Game, G, put, cast } = await arena('druid', 'entangle-save-boss');
      ctx.MONSTERS.warlord = { ...ctx.MONSTERS.warlord, hit: 60 };
      for (let i = 0; i < 6; i++) {
        Game.level().monsters.length = 0;
        const m = put('warlord', 2, 0, { hp: 5000, maxHp: 5000 });
        cast('entangle');
        if (m.snaredUntil - G.t !== 1750) { out.push(`a boss sure of its save was held ${m.snaredUntil - G.t}ms`); break; }
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the hero saves against a wraith\'s grave-cold (constitution: frozen half as long), an emberling\'s flare and lightning through the water (dexterity: half the hurt)', async () => {
    const out = [];
    const series = async (stat, score, setup) => {
      const { ctx, Game, G, L, p, put } = await arena('fighter', `hero-save-${stat}-${setup.name}`);
      p.stats[stat] = score;
      seedDice(ctx, 'hero-save-' + setup.name);
      const got = [];
      for (let i = 0; i < 16; i++) {
        L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0;
        const hp0 = p.hp, t0 = G.t;
        setup(G, L, p, put);
        run(Game, G, 400);
        got.push({ hurt: hp0 - p.hp, held: Math.max(0, (p.held || 0) - t0) });
      }
      return got;
    };
    const chill = function chill(G, L, p, put) { L.twist = null; const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 }); w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; w.nextAct = w.windup.until; };
    const flare = function flare(G, L, p, put) { L.twist = null; const e = put('emberling', 1, 0, { hp: 80, maxHp: 80 }); e.windup = { kind: 'move', move: 'flare', at: G.t, until: G.t + 100 }; e.nextAct = e.windup.until; };
    const storm = function storm(G, L, p, put) { L.twist = 'flooded'; const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 }); a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until; };
    // frozen: a hardy hero is held half as long (the hold counted from before the breath lands); a frail one
    // mostly the whole of it (at level 9 even a score of 1 saves now and then)
    const hardy = await series('con', 40, chill), frail = await series('con', 1, chill);
    const heldH = hardy.map(g => g.held), heldF = frail.map(g => g.held);
    if (heldH.filter(h => h > 0 && h <= 1000).length < 14) out.push(`a hardy hero in the grave-cold was held ${heldH.join(', ')}`);
    if (heldF.filter(h => h > 1200).length < 8) out.push(`a frail hero in the grave-cold was held ${heldF.join(', ')}`);
    for (const [name, setup] of [['flare', flare], ['storm', storm]]) {
      const quick = await series('dex', 40, setup), slow = await series('dex', 1, setup);
      const q = quick.reduce((n, g) => n + g.hurt, 0), s = slow.reduce((n, g) => n + g.hurt, 0);
      if (!(s > 0) || !(q < s * 0.85)) out.push(`${name}: a quick hero took ${q} over sixteen, a slow one ${s}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a spell\'s card says how foes save against it, and the number they must beat', async () => {
    const out = [];
    const card = async (cls, id, int = 16, level = 5) => {
      const { ctx, Game, p } = await arena(cls, 'save-card-' + id);
      p.level = level; p.stats[ctx.CLASSES[cls].primary] = int;
      return Game.spellDesc(ctx.SPELLS[cls].find(s => s.id === id));
    };
    const bolt = await card('mage', 'lightning'), cone = await card('mage', 'cone_cold', 18, 9), dart = await card('mage', 'magic_missile');
    const roots = await card('druid', 'entangle'), heal = await card('cleric', 'cure_light'), call = await card('druid', 'call_lightning');
    if (!/saves by its Dexterity \(against your 15\) takes three quarters/.test(bolt)) out.push(`Lightning Bolt: "${bolt}"`);
    if (!/saves by its Constitution \(against your 18\)/.test(cone)) out.push(`Cone of Cold at level 9, Intelligence 18: "${cone}"`);
    if (!/Never saved against\.$/.test(dart) || !/Never saved against\.$/.test(call)) out.push(`a dart or a lightning stroke: "${dart}" / "${call}"`);
    if (!/held two thirds as long; a boss always half/.test(roots)) out.push(`Entangle: "${roots}"`);
    if (/save/i.test(heal)) out.push(`a healing spell spoke of saves: "${heal}"`);
    return out.length ? out.join('; ') : true;
  });

  await test('every saving throw the hero makes against a monster has its number to beat', async () => {
    const fs = require('fs'), path = require('path');
    const src = ['foes.js', 'game.js', 'meet.js', 'elements.js', 'wild.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
    const kinds = [...new Set([...src.matchAll(/trickSave\('\w+', '(\w+)'/g)].map(m => m[1]))];
    const table = src.match(/const SAVE_DC = \{([^}]*)\}/)[1];
    const missing = kinds.filter(k => !new RegExp(`\\b${k}:`).test(table));
    return (kinds.length > 10 && !missing.length) || `saves with no number to beat: ${missing.join(', ') || '(none found)'}`;
  });
};
