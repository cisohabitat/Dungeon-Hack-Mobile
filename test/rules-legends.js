// Rule checks for the grades of what is found, the legendary pieces
// (js/legends.js) and the combinations (js/combos.js), run from rules.js
// with its helpers lent in.
module.exports = async function legendChecks(h) {
  const { test, start, beside, walk, wearRelic, tallyLines, seedDice, markLog, linesSince } = h;

  /** A hero facing a clear passage five squares long, foes put down it by squares ahead. */
  const arena = async (cls, seed, path) => {
    const ctx = await start(cls, seed);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    walk(ctx, path);
    p.hp = p.maxHp = 9999; p.sp = p.maxSp = 999; p.level = 9; p.perkHit = 60;
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    for (let k = -1; k <= 7; k++) for (let j = -1; j <= 1; j++) {
      const x = p.x + dx * k + sx * j, y = p.y + dy * k + sy * j;
      if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    }
    L.monsters.length = 0; L.dressing = []; L.fields = {}; L.npcs = []; L.items = {};
    let uid = 800;
    const at = (fwd, side = 0) => [p.x + dx * fwd + sx * side, p.y + dy * fwd + sy * side];
    const put = (id, fwd, side = 0, extra = {}) => { const [x, y] = at(fwd, side); const m = { uid: uid++, id, x, y, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    const swing = () => { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); };
    return { ctx, Game, p, G, L, at, put, swing };
  };

  await test('what is found has a grade: plain, fine, rare, relic and legend, and gear not yet known is plain', async () => {
    const { Game } = await start('fighter', 'grades');
    const out = [];
    const want = [
      [{ t: 'longsword', q: 1, e: 0 }, 'plain'], [{ t: 'longsword', q: 1, e: 1 }, 'fine'], [{ t: 'longsword', q: 1, e: 1, pw: 'keen' }, 'rare'],
      [{ t: 'chain', q: 1, e: 0, px: 'sturdy' }, 'rare'], [{ t: 'longsword', q: 1, e: 2, h: 1 }, 'plain'], [{ t: 'longsword', q: 1, e: -1, curse: 1 }, 'plain'],
      [{ t: 'dagger', q: 1, e: 2, u: 'grimtooth' }, 'relic'], [{ t: 'towershield', q: 1, e: 1, u: 'bastion' }, 'legend'], [{ t: 'potion_heal', q: 1, e: 0 }, 'plain'],
    ];
    for (const [it, g] of want) if (Game.grade(it) !== g) out.push(`${JSON.stringify(it)} graded ${Game.grade(it)}, not ${g}`);
    return out.length ? out.join('; ') : true;
  });

  await test('every path has one legend, never laid on a floor nor kept on a shelf, nor counted by the Collector', async () => {
    const ctx = await start('fighter', 'legend-list');
    const { RELICS, PATHS, Dungeon } = ctx;
    const out = [];
    const legends = Object.keys(RELICS).filter(id => RELICS[id].legend);
    for (const path of Object.values(PATHS).flat()) if (legends.filter(id => RELICS[id].legend === path.id).length !== 1) out.push(`${path.id} has ${legends.filter(id => RELICS[id].legend === path.id).length} legends`);
    const { relicPlan, toCollect } = await import('../js/relics.js');
    for (const cls of Object.keys(PATHS)) for (let i = 0; i < 6; i++) {
      const plan = relicPlan('lp' + i, cls, 8);
      const held = [...Object.values(plan.floor), ...plan.shop].filter(id => RELICS[id].legend);
      if (held.length) out.push(`${cls} lp${i} dealt ${held.join(', ')} to a floor or a shelf`);
    }
    if (toCollect().some(id => RELICS[id].legend)) out.push('the Collector asks for a legend');
    void Dungeon;
    return out.length ? out.join('; ') : true;
  });

  await test('a champion falling before a hero on a path drops that path\'s legend, once a run; before a path, nothing', async () => {
    const out = [];
    const kill = async (path, twice) => {
      const { Game, G, L, put, swing } = await arena('fighter', 'legend-drop', path);
      const drops = [];
      for (let n = 0; n < (twice ? 2 : 1); n++) {
        L.items = {};
        const m = put('grisk', 1, 0, { hp: 1, maxHp: 1 });
        for (let i = 0; i < 8 && L.monsters.includes(m); i++) swing();
        if (L.monsters.includes(m)) out.push('the champion would not fall');
        drops.push(Object.values(L.items).flat().filter(it => it.u && it.u === 'bastion').length);
        // taken up, as a player would
        for (const it of Object.values(L.items).flat()) if (it.u === 'bastion') { Game.giveItem(it); G.relics.found.includes('bastion') || G.relics.found.push('bastion'); }
      }
      return drops;
    };
    const k = await kill('knight', true);
    if (k[0] !== 1) out.push(`a Knight's first champion dropped ${k[0]} Bastions`);
    if (k[1] !== 0) out.push('a second champion dropped the Bastion again');
    const none = await kill(undefined, false);
    if (none[0] !== 0) out.push('a hero on no path was given a legend');
    return out.length ? out.join('; ') : true;
  });

  await test('the Bastion catches a blow on the shield whole and readies the Bash; without it a caught blow is halved', async () => {
    const out = [];
    const guard = async withIt => {
      const ctx = await start('fighter', 'bastion');
      seedDice(ctx, 'bastion');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      walk(ctx, 'knight'); p.capstone = 'unbreakable'; p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3;
      if (withIt) { p.eq.shield = null; wearRelic(ctx, 'bastion'); } else p.eq.shield = { t: 'towershield', q: 1, e: 1 };
      p.abilityReady = G.t + 1e9;
      beside(ctx, 'goblin');
      const [whole, half] = tallyLines(Game, G, 120000, [/takes the Goblin's blow whole/, /caught on your shield: half/]);
      return { whole, half, ready: p.abilityReady <= G.t };
    };
    const b = await guard(true), plain = await guard(false);
    if (!(b.whole > 5)) out.push(`the Bastion took only ${b.whole} blows whole`);
    if (b.half) out.push(`with the Bastion ${b.half} blows were still only halved`);
    if (!b.ready) out.push('a blow caught whole did not ready the Bash');
    if (plain.whole || !(plain.half > 5)) out.push(`a plain shield: ${plain.whole} whole, ${plain.half} halved`);
    return out.length ? out.join('; ') : true;
  });

  await test('Red Harvest heals a Berserker below half their life for every foe felled, and not above it', async () => {
    const out = [];
    const { ctx, p, put, swing, L } = await arena('fighter', 'harvest', 'berserker');
    p.eq.weapon = null; wearRelic(ctx, 'red_harvest');
    p.hp = 4000;
    let m = put('rat', 1, 0, { hp: 1, maxHp: 1 });
    for (let i = 0; i < 8 && L.monsters.includes(m); i++) swing();
    if (!(p.hp > 4000)) out.push(`below half, a kill left ${p.hp}`);
    p.hp = 8000;
    m = put('rat', 1, 0, { hp: 1, maxHp: 1 });
    for (let i = 0; i < 8 && L.monsters.includes(m); i++) swing();
    if (p.hp !== 8000) out.push(`above half, a kill healed to ${p.hp}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the Sunhammer sets the undead it strikes burning, and not the living', async () => {
    const out = [];
    const { ctx, p, put, swing } = await arena('cleric', 'sunhammer', 'templar');
    p.eq.weapon = null; wearRelic(ctx, 'sunhammer');
    const dead = put('skeleton', 1);
    swing();
    if (!(dead.dot && dead.dot.kind === 'burning')) out.push('a skeleton struck did not burn');
    dead.x = -9;
    const live = put('goblin', 1);
    swing();
    if (live.dot) out.push(`a goblin struck took ${live.dot.kind}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the Lantern of Mercy keeps healing past full life as a ward, up to a quarter of it, and the ward takes blows first', async () => {
    const out = [];
    const ctx = await start('cleric', 'lantern');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, 'healer'); p.eq.shield = null; wearRelic(ctx, 'lantern_mercy');
    p.maxHp = 40; p.hp = 38;
    const it = { t: 'potion_xheal', q: 1, e: 0 }; p.inv.push(it); Game.useItem(it);
    for (let i = 0; i < 20; i++) Game.update(G.t + 100, 100);
    if (!p.aegis || !(p.aegis.hp > 0) || p.aegis.hp > 10) out.push(`the ward was ${JSON.stringify(p.aegis)}`);
    const ward = p.aegis ? p.aegis.hp : 0, hp = p.hp;
    Game.hurtPlayer(1, 'A test blow.');
    if (p.hp !== hp || !p.aegis || p.aegis.hp !== ward - 1) out.push(`a blow of 1 left ${p.hp} of ${hp}, the ward ${JSON.stringify(p.aegis)}`);
    Game.hurtPlayer(ward + 4, 'A test blow.');
    if (p.hp !== hp - 5 || p.aegis) out.push(`a blow past the ward left ${p.hp} of ${hp}, the ward ${JSON.stringify(p.aegis)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Cinderheart bursts a foe that dies burning, scorching the one beside it; without it, nothing', async () => {
    const out = [];
    const run = async withIt => {
      const { ctx, p, G, put, swing, L } = await arena('mage', 'cinder-' + withIt, 'pyromancer');
      if (withIt) { p.eq.shield = null; p.eq.weapon = { t: 'dagger', q: 1, e: 0 }; wearRelic(ctx, 'cinderheart'); }
      const a = put('goblin', 1, 0, { hp: 1, maxHp: 1, dot: { kind: 'burning', until: G.t + 9000, next: G.t + 9000, die: 4 } });
      const b = put('goblin', 1, 1);
      for (let i = 0; i < 8 && L.monsters.includes(a); i++) swing();
      return b.hp;
    };
    if (!((await run(true)) < 999)) out.push('the one beside was not scorched');
    if ((await run(false)) !== 999) out.push('a burning death without Cinderheart scorched its neighbour');
    return out.length ? out.join('; ') : true;
  });

  await test('the Rimebound Grimoire: cold leaves a foe brittle, a brittle foe takes a third more, and one dying brittle shatters, holding back those beside it', async () => {
    const out = [];
    const { ctx, Game, p, G, put, swing, L } = await arena('mage', 'rime', 'frostweaver');
    p.eq.shield = null; p.eq.weapon = { t: 'dagger', q: 1, e: 0 }; wearRelic(ctx, 'rimebound');
    const a = put('goblin', 3);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.castSpell(ctx.SPELLS.mage.find(s => s.id === 'lightning'));
    if (!(a.brittleUntil > G.t)) out.push('the lightning left no brittleness');
    L.monsters.length = 0;
    const b = put('goblin', 1, 0, { hp: 1, maxHp: 1, brittleUntil: G.t + 9000 }), c = put('goblin', 1, 1, { nextAct: G.t });
    const mark = markLog(G);
    for (let i = 0; i < 8 && L.monsters.includes(b); i++) swing();
    if (!linesSince(G, mark).some(l => /shatters like ice/.test(l))) out.push('a brittle death did not shatter');
    if (!(c.nextAct > G.t + 1000)) out.push('the one beside was not held back');
    // a third more: the same blow, the same dice, on a brittle foe and on one that is not
    const blow = async brittle => {
      const t = await arena('mage', 'rime-blow', 'frostweaver');
      t.p.eq.shield = null; t.p.eq.weapon = { t: 'dagger', q: 1, e: 0 }; wearRelic(t.ctx, 'rimebound'); seedDice(t.ctx, 'rime-blow');
      const m = t.put('goblin', 1, 0, brittle ? { brittleUntil: t.G.t + 9000 } : {});
      t.swing();
      return 999 - m.hp;
    };
    const plain = await blow(false), more = await blow(true);
    if (!(plain > 0) || more !== Math.round(plain * 4 / 3)) out.push(`a brittle foe took ${more} to ${plain}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the Last Word: a foe slain from the shadows lets the next blow strike from them too, once', async () => {
    const out = [];
    const { ctx, p, G, put, swing, L } = await arena('thief', 'last-word', 'assassin');
    p.eq.weapon = null; wearRelic(ctx, 'last_word');
    const a = put('rat', 1, 0, { hp: 1, maxHp: 1, awake: false });
    for (let i = 0; i < 8 && L.monsters.includes(a); i++) swing();
    if (!(p.unseenUntil > G.t)) out.push('a kill from the shadows left no moment in them');
    const b = put('goblin', 1);
    swing();
    if (p.unseenUntil) out.push('the moment was not spent on the next blow');
    void b;
    return out.length ? out.join('; ') : true;
  });

  await test('Motley: a blow a Trickster slips aside from leaves its maker open', async () => {
    const ctx = await start('thief', 'motley');
    seedDice(ctx, 'motley');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, 'trickster'); p.capstone = 'vanish'; p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    wearRelic(ctx, 'motley');
    const m = beside(ctx, 'goblin');
    for (let t = 0; t < 120000; t += 25) {
      const mark = markLog(G);
      Game.update(G.t + 25, 25);
      if (linesSince(G, mark).some(l => /You slip aside/.test(l))) return (p.opening && p.opening.uid === m.uid) || 'a slipped blow left no opening';
    }
    return 'no blow was slipped';
  });

  await test('Farstrider: an arrow that fells its mark flies on into the next foe down the passage', async () => {
    const out = [];
    const run = async withIt => {
      const { ctx, p, put, swing, L } = await arena('ranger', 'farstrider-' + withIt, 'sharpshooter');
      p.eq.shield = null; p.eq.offhand = null;
      if (withIt) { p.eq.weapon = null; wearRelic(ctx, 'farstrider'); } else p.eq.weapon = { t: 'longbow', q: 1, e: 1 };
      const a = put('goblin', 2, 0, { hp: 1, maxHp: 1 }), b = put('goblin', 4);
      for (let i = 0; i < 8 && L.monsters.includes(a); i++) swing();
      return b.hp;
    };
    if (!((await run(true)) < 999)) out.push('the arrow stopped in its mark');
    if ((await run(false)) !== 999) out.push('a plain longbow\'s arrow flew on');
    return out.length ? out.join('; ') : true;
  });

  await test('Thornbinder: a blow on a snared foe holds it a second longer', async () => {
    const { ctx, p, G, put, swing } = await arena('ranger', 'thornbinder', 'warden');
    p.eq.weapon = null; p.eq.offhand = null; wearRelic(ctx, 'thornbinder');
    const m = put('goblin', 1, 0, { snaredUntil: G.t + 2000, heldBy: 'snare' });
    const was = m.snaredUntil;
    swing();
    return m.snaredUntil >= was + 1000 || `the snare ran to ${m.snaredUntil - was} more`;
  });

  await test('the Moonbound Torc: in Wild Shape every foe felled keeps the shape five seconds longer and heals', async () => {
    const { ctx, Game, p, G, put, swing, L } = await arena('druid', 'moonbound', 'shapeshifter');
    wearRelic(ctx, 'moonbound');
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.castSpell(ctx.SPELLS.druid.find(s => s.id === 'wild_shape'));
    if (!Game.shaped()) return 'the druid did not take the shape';
    const until = p.shape.until;
    p.hp = 100;
    const m = put('rat', 1, 0, { hp: 1, maxHp: 1 });
    for (let i = 0; i < 8 && L.monsters.includes(m); i++) swing();
    if (p.shape.until !== until + 5000) return `the shape ran ${p.shape.until - until} longer`;
    return p.hp > 100 || 'the kill did not heal';
  });

  await test('Heartroot: a foe held by roots takes 2 more from every blow', async () => {
    const blow = async rooted => {
      const t = await arena('druid', 'heartroot', 'grovewarden');
      t.p.eq.weapon = null; wearRelic(t.ctx, 'heartroot'); seedDice(t.ctx, 'heartroot');
      const m = t.put('goblin', 1, 0, rooted ? { snaredUntil: t.G.t + 9000, heldBy: 'roots' } : {});
      t.swing();
      return 999 - m.hp;
    };
    const plain = await blow(false), held = await blow(true);
    return (plain > 0 && held === plain + 2) || `a rooted foe took ${held} to ${plain}`;
  });

  await test('this run\'s finds keep rare gear once known, relics and legends; not gear still hidden', async () => {
    const { Game } = await start('fighter', 'finds');
    const out = [];
    Game.giveItem({ t: 'longsword', q: 1, e: 1, pw: 'keen' });
    Game.giveItem({ t: 'chain', q: 1, e: 1, px: 'sturdy', h: 1 });
    Game.giveItem({ t: 'towershield', q: 1, e: 1, u: 'bastion' });
    const f = Game.runFinds();
    if (!f.some(x => /Long Sword/.test(x.name) && x.grade === 'rare')) out.push('the keen long sword is missing');
    if (f.some(x => /Chain/.test(x.name))) out.push('hidden chain mail was counted');
    if (!f.length || f[0].grade !== 'legend') out.push('the legend does not lead the list');
    // once its make is known, the chain counts too, and stays counted when sold
    const chain = Game.player().inv.find(x => x.t === 'chain');
    delete chain.h;
    if (!Game.runFinds().some(x => /Sturdy Chain/.test(x.name))) out.push('the chain, once known, was not counted');
    Game.player().inv.splice(Game.player().inv.indexOf(chain), 1);
    if (!Game.runFinds().some(x => /Sturdy Chain/.test(x.name))) out.push('the chain was forgotten once gone');
    return out.length ? out.join('; ') : true;
  });
  await test('a combination is named the first time in a run and counted after, and the journal keeps it from run to run', async () => {
    const out = [];
    const ctx = await start('fighter', 'combo-note');
    const { Game, Progress } = ctx; const G = Game.state();
    const mark = markLog(G);
    Game.noteCombo('oil_fire'); Game.noteCombo('oil_fire'); Game.noteCombo('oil_fire');
    const said = linesSince(G, mark).filter(l => /Sheet of Flame!/.test(l)).length;
    if (said !== 1) out.push(`named ${said} times`);
    if (G.combos.oil_fire !== 3) out.push(`counted ${G.combos.oil_fire}`);
    if (!Progress.load().combos.includes('oil_fire')) out.push('the journal did not keep it');
    // a new run starts the count afresh, and the journal still has it
    Game.newGame({ name: 'Again', cls: 'fighter', stats: Game.rollStats(), seed: 'combo-note-2', opts: Game.state().opts });
    if (Game.state().combos && Game.state().combos.oil_fire) out.push('the count carried into a new run');
    if (!Progress.load().combos.includes('oil_fire')) out.push('the journal forgot it');
    Game.noteCombo('not_a_combination');
    if (Game.state().combos && Game.state().combos.not_a_combination) out.push('an unknown one was counted');
    return out.length ? out.join('; ') : true;
  });

  await test('the combinations come about where their rules act: lightning through water, cold freezing it, a Bash breaking off a blow, Cleave into a group', async () => {
    const out = [];
    {
      const { ctx, Game, G, L, put } = await arena('mage', 'combo-water');
      L.twist = 'flooded';
      put('goblin', 3); put('goblin', 3, 1);
      G.t = Math.max(G.t, Game.player().nextAttack) + 10;
      Game.castSpell(ctx.SPELLS.mage.find(s => s.id === 'lightning'));
      if (!(G.combos && G.combos.conduction)) out.push('lightning through water was not Conduction');
      L.monsters.length = 0; L.fields = {};
      put('goblin', 2); put('goblin', 2, 1);
      G.t = Math.max(G.t, Game.player().nextAttack) + 10;
      Game.castSpell(ctx.SPELLS.mage.find(s => s.id === 'cone_cold'));
      if (!(G.combos && G.combos.flash_freeze)) out.push('cold freezing water was not Flash Freeze');
    }
    {
      const { Game, G, p, put } = await arena('fighter', 'combo-bash');
      const m = put('goblin', 1);
      m.windup = { kind: 'blow', at: G.t, until: G.t + 9000 };
      p.abilityReady = 0;
      if (!Game.useAbility()) out.push('the Bash would not swing');
      if (!(G.combos && G.combos.broken_off)) out.push('a Bash breaking off a blow was not Broken Off');
    }
    {
      const { Game, G, p, put, swing } = await arena('fighter', 'combo-cleave');
      p.talents = [...(p.talents || []), 'cleave'];
      put('goblin', 1, 0, { pack: [{ hp: 999, maxHp: 999 }] });
      swing();
      if (!(G.combos && G.combos.through_the_pack)) out.push('Cleave into a group was not Through the Pack');
      void Game;
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the end names the build: the path, a legend carried, and the combinations leaned on most', async () => {
    const ctx = await start('fighter', 'combo-build');
    const { Game } = ctx; const p = Game.player();
    walk(ctx, 'knight');
    p.eq.shield = null; wearRelic(ctx, 'bastion');
    Game.noteCombo('broken_off'); Game.noteCombo('broken_off'); Game.noteCombo('shield_wall'); Game.noteCombo('broken_off'); Game.noteCombo('oil_fire');
    const line = Game.buildLine();
    return line === 'Knight bearing the Bastion, fighting by Broken Off and The Wall Holds' || `the line read "${line}"`;
  });
};
