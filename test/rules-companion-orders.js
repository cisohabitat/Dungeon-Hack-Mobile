// The portrait's controls are another entrance to the existing Use action.
module.exports = async h => {
  const { test, loadGame, evenStats, OPTS } = h;
  const place = ctx => {
    const { Game: G, Dungeon } = ctx, p = G.player(), L = G.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters = []; L.npcs = []; L.items = {}; L.snares = {};
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    G.state().companion = { kind: 'hound', name: 'Brindle', hp: 12, maxHp: 12, mode: 'follow', depth: G.state().depth, joined: 1, floors: 0, kills: 0, x: p.x + dx, y: p.y + dy, nextAct: 1e9 };
  };
  const create = async (cls = 'fighter', difficulty = 'normal', seed = 'bench') => {
    const ctx = await loadGame(); ctx.Game.recordRuns(false);
    ctx.Game.newGame({ name: 'Order check', cls, stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 4, difficulty } }); place(ctx); return ctx;
  };
  await test('companion orders match Use outcomes and dice across six classes, difficulties and three seed sets', async () => {
    for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid']) for (const diff of ['normal', 'hard']) for (const seed of ['bench', 'alt', 'third']) {
      const states = [];
      for (const command of [false, true]) {
        const { Game: G, Dice, Odds } = await create(cls, diff, seed);
        if (command) { if (!G.commandCompanion('stay') || !G.commandCompanion('follow')) return `${cls}: legal order refused`; }
        else { G.input('use'); G.input('use'); }
        const state = JSON.parse(JSON.stringify(G.state())); delete state.created;
        states.push(JSON.stringify({ state, dice: Dice.s, odds: Odds.s }));
      }
      if (states[0] !== states[1]) return `${cls} ${diff} ${seed}: changed outcome`;
    }
    return true;
  });
  await test('companion orders reject held, distant, fallen, wrong-floor and invalid requests without changing state', async () => {
    for (const condition of ['held', 'distant', 'fallen', 'floor', 'choice', 'ended', 'invalid']) {
      const { Game: G } = await create();
      if (condition === 'held') G.player().held = G.state().t + 10000;
      if (condition === 'distant') G.companion().x += 3;
      if (condition === 'fallen') G.companion().fallen = 1;
      if (condition === 'floor') G.companion().depth++;
      if (condition === 'choice') G.state().forkPending = true;
      if (condition === 'ended') G.state().status = 'dead';
      const before = JSON.stringify(G.state());
      if (G.commandCompanion(condition === 'invalid' ? 'teleport' : 'stay')) return condition + ' allowed';
      if (before !== JSON.stringify(G.state())) return condition + ' changed the run';
    }
    return true;
  });
  await test('companion orders survive saving and loading', async () => {
    const { Game: G } = await create();
    if (!G.commandCompanion('stay')) return 'stay failed';
    if (!G.save(true) || !G.load()) return 'save/load failed';
    return G.companion().mode === 'stay' && G.commandCompanion('follow') && G.companion().mode === 'follow';
  });
  await test('recorded companion orders replay through the ordinary Use rules', async () => {
    const ctx = await loadGame(), G = ctx.Game;
    localStorage.setItem('deepdelve.progress', JSON.stringify({ feats: { veteran: 1 } }));
    G.recordRuns(true); G.newGame({ name: 'Recorded orders', cls: 'fighter', stats: { ...evenStats }, seed: 'recorded-orders', opts: { ...OPTS, levels: 4, companion: 'hound' } });
    if (!G.companion()) return 'no starting hound';
    for (let n = 0; n < 4 && G.companionCommandReason(); n++) { G.input('right'); G.update((n + 1) * 300, 300); }
    if (!G.commandCompanion('stay') || !G.commandCompanion('follow')) return G.companionCommandReason() || 'order refused';
    G.hurtPlayer(99999, 'The order recording ends'); const data = G.recording();
    if (!data) return 'no recording';
    const { replayStorage, replayHeadless } = await import('../js/recording.js');
    const replay = await loadGame(); globalThis.localStorage = replayStorage(data);
    try { await replayHeadless(replay.Game, data); } catch (e) { return e.message; }
    return true;
  });
};
