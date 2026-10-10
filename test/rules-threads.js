// Rule checks for the choices that come back two floors on (js/threads.js),
// run from rules.js with its helpers lent in.
module.exports = async function threadChecks(h) {
  const { test, start, meetAndChoose, markLog, linesSince } = h;

  /** A run with this thread made on the first floor, carried down to the third; what was said there, and the floor. */
  const twoFloorsOn = async (id, seed, opts = {}, made = 1) => {
    const ctx = await start('fighter', seed, { levels: 6, ...opts });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.hp = p.maxHp = 9999;
    (G.threads = G.threads || {})[id] = made;
    const said = [];
    for (let d = 2; d <= made + 2; d++) {
      Game.level().monsters.length = 0;
      const mark = markLog(G);
      Game.descend();
      if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
      said.push(...linesSince(G, mark).map(l => `${G.depth}: ${l}`));
    }
    return { ctx, Game, G, p, L: Game.level(), said: said.join(' | ') };
  };
  const near = (p, items) => Object.entries(items).some(([k, pile]) => { const [x, y] = k.split(',').map(Number); return Math.abs(x - p.x) + Math.abs(y - p.y) <= 3 && pile.length; });

  await test('each of the eight choices that come back is started by its encounter\'s choice', async () => {
    const { ENCOUNTERS } = await import('../js/encounters.js');
    const want = { mercy: 'spared', toll: 'tollpaid', statue: 'oath', shrine: 'offering', lastdelver: 'fed', wyrmegg: 'egg' };
    const out = [];
    const threadsOf = e => JSON.stringify(e).match(/"thread":"(\w+)"/g) || [];
    for (const [enc, id] of Object.entries(want)) if (!threadsOf(ENCOUNTERS[enc]).includes(`"thread":"${id}"`)) out.push(`${enc} starts no ${id}`);
    if (!threadsOf(ENCOUNTERS.toll).includes('"thread":"tollowed"')) out.push('crossing the toll starts nothing');
    if (!threadsOf(ENCOUNTERS.lastdelver).includes('"thread":"delverShade"')) out.push('robbing the last delver starts nothing');
    // and played: paying the toll (no die to roll) starts its thread
    const ctx = await start('fighter', 'thread-toll', { levels: 6 });
    ctx.Game.player().gold = 999;
    meetAndChoose(ctx, 'toll', 0);
    if (ctx.Game.state().threads.tollpaid !== 1) out.push(`paying the toll left ${JSON.stringify(ctx.Game.state().threads)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the spared goblin leaves a bundle by the stair and shows the traps; a toll paid comes back as a purse', async () => {
    const out = [];
    const a = await twoFloorsOn('spared', 'two-spared');
    if (!/goblin's scratch-mark by the stair/.test(a.said)) out.push(`the spared goblin said nothing: ${a.said}`);
    if (!near(a.p, a.L.items)) out.push('no bundle near the stair');
    if (!a.G.threads.sparedPaid || a.G.threads.sparedPaid !== 3) out.push(`paid on ${a.G.threads.sparedPaid}, not floor 3`);
    if (/scratch-mark/.test(a.said.split(' | ').filter(l => l.startsWith('2:')).join(' '))) out.push('it came a floor early');
    const b = await twoFloorsOn('tollpaid', 'two-toll');
    if (!/drops a purse/.test(b.said) || !Object.values(b.L.items).flat().some(it => it.t === 'gold')) out.push('no purse for the toll paid');
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the toll crossed sends its big friend, the robbed delver their shade, the smashed egg its mother: awake at the stair', async () => {
    const out = [];
    for (const [id, kind, made] of [['tollowed', 'ogre', 2], ['delverShade', 'wraith', 1], ['egg', 'wyrm', 1]]) {
      const r = await twoFloorsOn(id, 'two-' + id, {}, made);
      const m = r.L.monsters.find(x => x.id === kind && x.awake);
      if (!m) { out.push(`${id}: no ${kind} waiting (said: ${r.said.slice(0, 160)})`); continue; }
      const d = Math.abs(m.x - r.p.x) + Math.abs(m.y - r.p.y);
      if (d < 2 || d > 9) out.push(`${id}: the ${kind} stood ${d} squares off`);
    }
    // the toll's friend is an orc where an ogre would be too much
    const shallow = (await twoFloorsOn('tollowed', 'two-toll-shallow')).L.monsters.some(x => x.id === 'orc' && x.awake);
    if (!shallow) out.push('on the third floor the toll\'s friend was not an orc');
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the captive\'s door stands unbarred, the knight\'s blade lies on the floor, the old stone heals, the fed delver leaves a meal', async () => {
    const out = [];
    {
      // a floor with a locked door: the nearest one is unbarred (a floor with none waits for one that has)
      let done = false;
      for (let i = 0; i < 12 && !done; i++) {
        const r = await twoFloorsOn('captive', 'two-captive-' + i, { lockedDoors: true });
        if (r.G.threads.captivePaid) {
          done = true;
          if (!/the lock hangs broken/.test(r.said)) out.push('the captive\'s door was opened unsaid');
          if (Object.keys(r.L.locks || {}).length && !r.L.tiles.some(t => t === r.ctx.Dungeon.T.DOOR)) out.push('no door left unbarred');
        }
      }
      if (!done) out.push('in twelve runs no captive\'s door was opened');
    }
    {
      const r = await twoFloorsOn('oath', 'two-oath');
      const blade = Object.values(r.L.items).flat().find(it => it.e === 2 && r.ctx.ITEMS[it.t].kind === 'weapon' && r.ctx.ITEMS[it.t].cls.includes('fighter'));
      if (!blade) out.push('no blade for the oath');
    }
    {
      const ctx = await start('fighter', 'two-offering', { levels: 6 });
      const { Game } = ctx; const G = Game.state(), p = Game.player();
      G.threads = { offering: 1 };
      for (let d = 2; d <= 3; d++) { Game.level().monsters.length = 0; p.hp = 3; Game.descend(); if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts'); }
      if (p.hp !== p.maxHp) out.push(`the old stone left the hero on ${p.hp} of ${p.maxHp}`);
    }
    {
      const r = await twoFloorsOn('fed', 'two-fed');
      if (!Object.values(r.L.items).flat().some(it => it.t === 'ration')) out.push('no meal from the fed delver');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a choice that comes back does so once, and the hero sheet says so', async () => {
    const r = await twoFloorsOn('tollpaid', 'two-once');
    const { Game, G } = r;
    const out = [];
    const notes = Game.threadNotes().join(' ');
    if (!/paid you back/.test(notes)) out.push(`the sheet said: ${notes}`);
    Game.level().monsters.length = 0;
    const mark = markLog(G);
    Game.descend();
    if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
    if (linesSince(G, mark).some(l => /drops a purse/.test(l))) out.push('the purse came again on the next floor');
    return out.length ? out.join('; ') : true;
  });
};
