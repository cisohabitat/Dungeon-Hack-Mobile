// Rule checks for the ladder past Hard (LADDER in js/data.js): each rung's
// rule, kept by every rung above it; how a class opens each rung; and what a
// rung is worth. Run from rules.js with its helpers lent in.
module.exports = async function ladderChecks(h) {
  const { test, newContext, winHere, OPTS, evenStats } = h;

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
    for (const [rung, want] of [[0, 0.5], [1, 0.5], [2, 0], [5, 0]]) {
      const { Game } = await onRung(rung, 'rung-rest');
      Game.level().rests = 1;
      if (Game.restShare() !== want) out.push(`on rung ${rung} the second rest gave ${Game.restShare()}, want ${want}`);
      Game.level().rests = 0;
      if (Game.restShare() !== 1) out.push(`on rung ${rung} the first rest gave ${Game.restShare()}`);
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

  await test('Hard+5: every creature a step surer, not harder', async () => {
    const a = await onRung(4, 'rung-edge'), b = await onRung(5, 'rung-edge');
    for (const c of [a, b]) c.Game.testFloor(4);
    const m = { id: 'orc', x: 1, y: 1, hp: 9, maxHp: 9 };
    const x = a.Game.mstat(m), y = b.Game.mstat(m);
    return (y.hit === x.hit + 1 && y.dmg[2] === x.dmg[2]) || `an orc: hit ${x.hit} → ${y.hit}, damage +${x.dmg[2]} → +${y.dmg[2]}`;
  });

  await test('Hard+3: the champions and the last foe a quarter sturdier', async () => {
    const out = [];
    const floor = async (rung, d) => { const c = await onRung(rung, 'rung-lord'); c.Game.player().level = 6; c.Dice.s = new c.Rng('rung-lord-dice').s; c.Game.testFloor(d); return c.Game.level().monsters; };
    const a = await floor(2, 4), b = await floor(3, 4);
    const lich = ms => ms.find(m => m.id === 'lich');
    if (!lich(a) || !lich(b)) out.push('no lich on the last floor');
    else if (Math.abs(lich(b).maxHp - lich(a).maxHp * 1.25) > 2) out.push(`the lich: ${lich(a).maxHp} on +2, ${lich(b).maxHp} on +3`);
    // a named champion, wherever this delve keeps one
    let seen = false;
    for (let d = 2; d <= 3 && !seen; d++) {
      const x = await floor(2, d), y = await floor(3, d);
      const ch = ms => ms.find(m => m.named || /^(grisk|vessra|ushgar|morrow|orla|gorrum|skarrow|vaelith|hissra|durgrim)$/.test(m.id));
      if (ch(x) && ch(y)) { seen = true; if (Math.abs(ch(y).maxHp - ch(x).maxHp * 1.25) > 2) out.push(`${ch(x).id}: ${ch(x).maxHp} on +2, ${ch(y).maxHp} on +3`); }
    }
    return out.length ? out.join('; ') : (seen || 'no champion on floors 2 and 3 of this delve: the lich alone was checked') && true;
  });

  await test('Hard+4: a healing draught heals a third less, on the same dice', async () => {
    const healed = async rung => {
      const ctx = await onRung(rung, 'rung-draught');
      const { Game } = ctx; const p = Game.player();
      p.maxHp = 200; p.hp = 1;
      const it = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(it); Game.state().known.potion_heal = 1;
      ctx.Dice.s = new ctx.Rng('rung-draught-dice').s;
      Game.useItem(it);
      return p.hp - 1;
    };
    const a = await healed(3), b = await healed(4);
    return (a > 0 && b === Math.max(1, Math.round(a * 2 / 3))) || `healed ${a} on +3, ${b} on +4`;
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
