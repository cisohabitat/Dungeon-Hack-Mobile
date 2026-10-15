// Recording observes the same public rules calls; it must never change a fight.
module.exports = async h => {
  const { test, loadGame: newContext, evenStats, OPTS } = h;
  const { recordingPrint, replayHeadless, replayStorage, RECORD_LIMIT } = await import('../js/recording.js');
  const cfg = (cls = 'fighter', seed = 'recording', difficulty = 'normal') => ({ name: 'A recorded hero', cls, bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 2, difficulty } });
  const reproduce = async data => {
    const ctx = await newContext();
    const before = globalThis.localStorage;
    globalThis.localStorage = replayStorage(data);
    try { return replayHeadless(ctx.Game, data); } finally { globalThis.localStorage = before; }
  };
  await test('passive recording preserves outcomes for six classes on Normal and Hard over three seed sets, and replays them headlessly', async () => {
    for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid']) for (const diff of ['normal', 'hard']) for (const seed of ['bench', 'alt', 'third']) {
      const prints = [];
      let data;
      for (const enabled of [false, true]) {
        const ctx = await newContext(), G = ctx.Game;
        G.recordRuns(enabled); G.newGame(cfg(cls, seed, diff));
        for (let t = 0; t < 8000 && G.state().status === 'playing'; t += 50) {
          if (t % 800 === 0) G.input(['forward', 'attack', 'left', 'attack'][(t / 800) % 4]);
          G.update(t, 50); G.renderState(t);
        }
        if (G.state().status === 'playing') G.hurtPlayer(99999, 'The recording check');
        const snapshot = JSON.parse(JSON.stringify(G.state())); delete snapshot.created;
        prints.push(recordingPrint(snapshot));
        if (enabled) data = G.recording();
      }
      if (prints[0] !== prints[1]) return `${cls} ${diff} ${seed}: recording changed the outcome`;
      if (!data) return `${cls} ${diff} ${seed}: no finished record`;
      try { await reproduce(data); } catch (e) { return `${cls} ${diff} ${seed}: ${e.message}`; }
    }
    return true;
  });
  await test('a recording survives saving and loading, and gear arguments resolve to live inventory objects', async () => {
    const { Game: G } = await newContext(); G.recordRuns(true); G.newGame(cfg());
    G.giveItem({ t: 'shortsword', q: 1, e: 0 });
    const blade = G.player().inv.find(i => i.t === 'shortsword');
    G.equip(blade); G.sortPack();
    for (let t = 0; t < 2000; t += 50) { G.update(t, 50); G.renderState(t); }
    if (!G.save(true)) return 'the recording could not save';
    G.tick(0); // a page reload starts its wall clock over
    if (!G.load()) return 'the recording could not resume its save';
    G.input('left'); G.update(100, 50); G.hurtPlayer(99999, 'The resumed check');
    const data = G.recording();
    try { await reproduce(data); } catch (e) { return e.message; }
    return true;
  });
  await test('oversized and testing-aid recordings are unavailable, and mismatched builds are rejected', async () => {
    const { Game: G } = await newContext(); G.recordRuns(true); G.newGame(cfg());
    G.hurtPlayer(99999, 'The version check'); const data = G.recording();
    try { G.startReplay({ ...data, build: 'another build' }); return 'a different build was accepted'; } catch { /* expected */ }
    G.recordRuns(true); G.newGame(cfg());
    for (let i = 0; i < 1600 && !G.state().recording.unavailable; i++) G.log('x'.repeat(1000));
    G.hurtPlayer(99999, 'The size check');
    if (G.recording() || G.state().recording.size > RECORD_LIMIT + 20) return 'a partial oversized recording was offered';
    G.newGame(cfg()); G.setTesting({ hp: true }); G.hurtPlayer(99999, 'The testing check');
    return G.recording() === null || 'a testing-aid recording was offered';
  });
};
