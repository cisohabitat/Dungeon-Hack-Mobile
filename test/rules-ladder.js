// Rule checks for the ladder past Hard (LADDER in js/data.js): each rung's
// rule, kept by every rung above it; how a class opens each rung; and what a
// rung is worth. Run from rules.js with its helpers lent in.
module.exports = async function ladderChecks(h) {
  const { test, newContext, winHere, OPTS, evenStats, beside, markLog, linesSince } = h;

  /** A run on Hard at this rung (0 for Hard itself), in a fresh world. */
  const onRung = async (rung, seed, cls = 'fighter', opts = {}) => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'R', cls, bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, permadeath: true, difficulty: 'hard', ...(rung ? { rung } : {}), ...opts } });
    return ctx;
  };

  await test('a rung is kept on Hard only, from one to five, and never in a Daily', async () => {
    const out = [];
    const keep = async (opts, want, what) => { const ctx = await newContext(); ctx.Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rung-keep', opts: { ...OPTS, ...opts } }); if ((ctx.Game.state().opts.rung || 0) !== want || ctx.Game.rung() !== want) out.push(`${what}: rung ${ctx.Game.state().opts.rung}, said ${ctx.Game.rung()}`); };
    await keep({ difficulty: 'hard', rung: 3 }, 3, 'Hard+3');
    await keep({ difficulty: 'normal', rung: 3 }, 0, 'a rung on Normal');
    await keep({ difficulty: 'hard', rung: 9 }, 0, 'a rung past the top');
    await keep({ difficulty: 'hard', rung: -2 }, 0, 'a rung below Hard');
    await keep({ difficulty: 'hard', rung: 2, daily: '2026-10-10' }, 0, 'a rung in a Daily');
    const { LADDER } = await newContext();
    if (LADDER.length !== 6 || LADDER.slice(1).some(x => !x || !x.rule)) out.push(`the ladder has ${LADDER.length - 1} rungs, each a rule?`);
    return out.length ? out.join('; ') : true;
  });

  await test('Hard+2: one rest a floor, not two; every rung above keeps it', async () => {
    const out = [];
    for (const [rung, want] of [[0, 1 / 3], [1, 1 / 3], [2, 0], [5, 0]]) {
      const { Game } = await onRung(rung, 'rung-rest');
      Game.level().rests = 1;
      if (Game.restShare() !== want) out.push(`on rung ${rung} the second rest gave ${Game.restShare()}, want ${want}`);
      Game.level().rests = 0;
      if (Game.restShare() !== 2 / 3) out.push(`on rung ${rung} the first rest gave ${Game.restShare()}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('Hard+1: traders ask half again for wares and work, but a job is not priced', async () => {
    const out = [];
    const prices = async rung => {
      const { Game, Dungeon } = await onRung(rung, 'rung-trade');
      const p = Game.player(), L = Game.level();
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0; L.npcs.length = 0;
      L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [{ t: 'potion_heal', q: 3, e: 0 }] });
      Game.input('forward');
      if (!Game.currentShop()) return null;
      p.inv.push({ t: 'shield', q: 1, e: 1, h: 1 });
      const svc = Game.shopServices().find(s => s.id === 'appraise');
      return { ware: Game.buyPrice(Game.currentShop(), { t: 'longsword', q: 1, e: 0 }), work: svc && svc.price, job: (Game.shopServices().find(s => s.id === 'bounty') || { price: 0 }).price };
    };
    const a = await prices(0), b = await prices(1);
    if (!a || !b) return 'the shop would not open';
    if (Math.abs(b.ware - a.ware * 1.5) > 1) out.push(`a long sword: ${a.ware} on Hard, ${b.ware} on +1`);
    if (Math.abs(b.work - a.work * 1.5) > 1) out.push(`appraising: ${a.work} on Hard, ${b.work} on +1`);
    if (b.job !== 0) out.push(`a job was priced at ${b.job}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Hard+3: a rest wakes the floor, and what it wakes hunts from any distance', async () => {
    const out = [];
    const rested = async rung => {
      const ctx = await newContext();
      ctx.Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'rung-rouse', opts: { ...OPTS, permadeath: true, difficulty: 'hard', rung } });
      const { Game } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
      // a goblin asleep in the farthest corner of the floor, well past the twelve steps it hunts within
      const T = ctx.Dungeon.T, dist = new Int32Array(L.w * L.h).fill(-1), q = [p.y * L.w + p.x];
      dist[q[0]] = 0;
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % L.w, y = (i / L.w) | 0;
        for (const [dx, dy] of ctx.Dungeon.DIRS) {
          const ni = (y + dy) * L.w + x + dx, t = L.tiles[ni];
          if (x + dx < 0 || y + dy < 0 || x + dx >= L.w || y + dy >= L.h || dist[ni] >= 0 || (t !== T.FLOOR && t !== T.DOOR_OPEN && t !== T.DOOR)) continue;
          dist[ni] = dist[i] + 1; q.push(ni);
        }
      }
      let far = null, fd = -1;
      for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === T.FLOOR && dist[i] > fd) { fd = dist[i]; far = i; }
      if (fd <= 12) return { skip: `the first floor of rung-rouse is only ${fd} steps across` };
      L.monsters.length = 0;
      const m = { uid: 91, id: 'goblin', x: far % L.w, y: (far / L.w) | 0, hp: 9, maxHp: 9, awake: false, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.push(m);
      p.hp = 1; p.food = 50; G.graceUntil = 0;   // (the first floor's grace would hold the goblin until the hero stepped)
      const mark = markLog(G);
      if (!Game.rest()) return { skip: 'the hero would not rest' };
      const said = linesSince(G, mark).some(l => l.includes('comes looking'));
      // then a while on the clock: a hunter closes, a sleeper lies where it was
      const was = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
      for (let i = 0; i < 200 && L.monsters.includes(m) && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 1; i++) Game.update(G.t + 50, 50);
      return { awake: m.awake, hunting: !!m.hunting, said, closed: was - (Math.abs(m.x - p.x) + Math.abs(m.y - p.y)), fd };
    };
    const a = await rested(2), b = await rested(3);
    if (a.skip || b.skip) return (a.skip || b.skip) + ': nothing to check';
    if (a.awake || a.said) out.push(`on +2 the rest woke the far goblin (awake ${a.awake}, said ${a.said})`);
    if (!b.awake || !b.said) out.push(`on +3 the rest left the far goblin asleep (awake ${b.awake}, said ${b.said})`);
    if (b.closed < 8) out.push(`on +3 the roused goblin, ${b.fd} steps off, closed only ${b.closed} steps in ten seconds`);
    return out.length ? out.join('; ') : true;
  });

  await test('Hard+4: a draught drunk beside a foe is its moment, and heals as the dice say', async () => {
    const out = [];
    const drank = async rung => {
      const ctx = await onRung(rung, 'rung-draught');
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      p.maxHp = 200; p.hp = 1;
      const m = beside(ctx, 'goblin', { hp: 9, maxHp: 9, nextAct: G.t + 1e9 });
      const it = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(it); G.known.potion_heal = 1;
      ctx.Dice.s = new ctx.Rng('rung-draught-dice').s;
      const mark = markLog(G);
      Game.useItem(it);
      return { healed: p.hp - 1, soon: m.nextAct <= G.t, said: linesSince(G, mark).some(l => /sees its moment as you drink/.test(l)) };
    };
    const a = await drank(3), b = await drank(4);
    if (a.healed <= 0 || a.healed !== b.healed) out.push(`healed ${a.healed} on +3, ${b.healed} on +4`);
    if (a.soon || a.said) out.push('on +3 the goblin took its moment');
    if (!b.soon || !b.said) out.push(`on +4 the goblin did not (acts now ${b.soon}, said ${b.said})`);
    // out of reach, the draught costs nothing on any rung
    const ctx = await onRung(4, 'rung-draught-far');
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    const m = beside(ctx, 'goblin', { hp: 9, maxHp: 9, nextAct: G.t + 1e9 });
    m.x += 3;
    const it = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(it); G.known.potion_heal = 1; p.hp = 1;
    Game.useItem(it);
    if (m.nextAct <= G.t) out.push('on +4 a goblin three steps off took a moment');
    return out.length ? out.join('; ') : true;
  });

  await test('Hard+5: no lamp makes you whole: the traders keep theirs (the Returned excepted), and the vigil lamp is out', async () => {
    const out = [];
    const lamp = async (rung, bg) => {
      const ctx = await onRung(rung, 'rung-lamp', 'fighter');
      const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level();
      p.bg = bg;
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
      L.monsters.length = 0; L.npcs.length = 0;
      L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [{ t: 'potion_heal', q: 3, e: 0 }] });
      p.hp = 1;
      Game.input('forward');
      if (!Game.currentShop()) return null;
      return Game.shopServices().find(s => s.id === 'lodge');
    };
    const a = await lamp(4, 'oathbroken'), b = await lamp(5, 'oathbroken'), c = await lamp(5, 'returned');
    if (!a || !b || !c) return 'the shop would not open';
    if (a.why) out.push(`on +4 the lamp was refused: ${a.why}`);
    if (!b.why || !/keep their lamps/.test(b.why)) out.push(`on +5 the lamp was sold: ${b.why || 'no reason given'}`);
    if (c.why || c.price !== 0) out.push(`on +5 the Returned were refused theirs: ${c.why || `price ${c.price}`}`);
    // the vigil lamp by the last halls
    const vigil = async rung => {
      const ctx = await onRung(rung, 'rung-vigil');
      const { Game } = ctx;
      Game.testFloor(8);
      const p = Game.player(); p.hp = 1;
      const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; const L = Game.level();
      L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'vigil', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      Game.input('use');
      const e = Game.currentEncounter();
      return e ? { title: e.def.title, choices: e.def.choices.length } : null;
    };
    const d = await vigil(4), e = await vigil(5);
    if (!d || !e) return 'the vigil lamp would not open';
    if (d.title !== 'A Vigil Lamp' || d.choices < 4) out.push(`on +4 the lamp was ${d.title} with ${d.choices} choices`);
    if (e.title !== 'A Vigil Lamp, Out' || e.choices !== 1) out.push(`on +5 the lamp was ${e.title} with ${e.choices} choices`);
    return out.length ? out.join('; ') : true;
  });

  await test('a rung adds a tenth to the score; a class opens Hard+1 with a Hard win, and each rung with a win on the one below', async () => {
    const out = [];
    {
      const a = await onRung(0, 'rung-score'), b = await onRung(3, 'rung-score');
      const p = a.Game.player(), q = b.Game.player(); p.xp = q.xp = 800; p.deepest = q.deepest = 4;
      const sa = a.Game.score(p, 4, true), sb = b.Game.score(q, 4, true);
      if (Math.abs(sb - Math.round(sa * 1.3)) > 1) out.push(`Hard+3 scored ${sb} against Hard's ${sa}`);
    }
    const ctx = await newContext();
    const { Game, Progress } = ctx;
    const run = (cls, difficulty, rung) => Game.newGame({ name: 'U', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'rung-open-' + cls + rung, opts: { ...OPTS, permadeath: true, difficulty, ...(rung ? { rung } : {}) } });
    if (Progress.rungOpen('mage')) out.push('a rung open before any win');
    run('mage', 'normal'); winHere(Game);
    if (Progress.rungOpen('mage') || Game.earned().rungOpened) out.push('a Normal win opened a rung');
    run('mage', 'hard'); winHere(Game);
    if (Progress.rungOpen('mage') !== 1 || Game.earned().rungOpened !== 1) out.push(`a Hard win opened ${Progress.rungOpen('mage')}, told ${Game.earned().rungOpened}`);
    if (Progress.rungOpen('fighter')) out.push('the mage\'s win opened a rung for the fighter');
    run('mage', 'hard', 1); winHere(Game);
    if (Progress.rungOpen('mage') !== 2 || Game.earned().rungOpened !== 2) out.push(`a Hard+1 win left ${Progress.rungOpen('mage')} open`);
    // a win below the highest opens nothing new; and the top is the top
    run('mage', 'hard'); winHere(Game);
    if (Game.earned().rungOpened) out.push('a plain Hard win, with +2 open, opened something');
    for (const r of [2, 3, 4]) { run('mage', 'hard', r); winHere(Game); }
    if (Progress.rungOpen('mage') !== 5) out.push(`climbing to +4 left ${Progress.rungOpen('mage')} open`);
    run('mage', 'hard', 5); winHere(Game);
    if (Progress.rungOpen('mage') !== 5 || Game.earned().rungOpened) out.push(`a Hard+5 win: open ${Progress.rungOpen('mage')}, told ${Game.earned().rungOpened}`);
    // and the Hall says which rung a win was on
    const hall = Game.hall();
    if (!hall.some(e => e.rung === 5 && e.difficulty === 'hard')) out.push('the Hall kept no rung');
    return out.length ? out.join('; ') : true;
  });
};
