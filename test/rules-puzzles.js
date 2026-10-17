// Optional treasure catches: every clue has one answer, every exit stays open,
// and neither a failed guess nor a save can duplicate the coins beneath it.
module.exports = async h => {
  const { test, loadGame, evenStats, OPTS } = h;
  const { makePuzzles } = await import('../js/puzzles.js');
  const { checkSave } = await import('../js/savecheck.js');
  const { recordingPrint, replayHeadless, replayStorage, RECORD_METHODS } = await import('../js/recording.js');
  const cfg = (seed = 'puzzle1', opts = {}) => ({ name: 'Test', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed,
    opts: { ...OPTS, levels: 8, puzzles: true, ...opts } });
  async function ready(seed) {
    const ctx = await loadGame(), G = ctx.Game;
    G.newGame(cfg(seed));
    const q = G.level().puzzle;
    if (!q) throw new Error('The puzzle fixture has no cache');
    G.player().x = q.x; G.player().y = q.y;
    return ctx;
  }
  function answer(G) {
    const q = G.currentPuzzle();
    G.puzzleAction('reset');
    const marks = q.kind === 'runes' ? q.order : q.kind === 'torches' ? [0, 1, 2, 3].filter(i => q.target & (1 << i)) : [q.order[0]];
    for (const i of marks) G.puzzleAction('mark', i);
    return G.puzzleAction('submit');
  }
  await test('puzzle generation preserves every floor, item and roll over three seed sets, all floor sizes and run lengths', async () => {
    const { Dungeon, Dice, Odds } = await loadGame();
    const kinds = new Set(); let count = 0;
    for (const prefix of ['bench', 'alt', 'third']) for (const size of ['small', 'medium', 'large']) for (const levels of [2, 4, 8, 16]) for (let n = 0; n < 4; n++) {
      const seed = prefix + n, opts = { ...OPTS, levels, size, puzzles: true }, G = { seed, opts };
      const puzzles = makePuzzles({ G });
      for (let depth = 1; depth <= levels; depth++) {
        const L = Dungeon.generate(seed, depth, opts), before = JSON.stringify(L), dice = [Dice.s, Odds.s];
        puzzles.place(L, depth);
        const other = JSON.parse(before); puzzles.place(other, depth);
        if (JSON.stringify(L) !== JSON.stringify(other)) return `${seed}/${size}/${levels}/${depth}: not deterministic`;
        if (L.puzzle) {
          const q = L.puzzle; kinds.add(q.kind); count++;
          if (L.isFinal || L.traps[`${q.x},${q.y}`] || new Set(q.order).size !== 4 || q.target < 1 || q.target > 14) return 'an invalid catch was made';
          let coins = 0;
          for (const list of Object.values(L.items)) for (const it of list) if (it.puzzle) {
            if (!['gold', 'gem'].includes(it.t) || it.u) return 'a key, relic or quest object was held';
            coins++; delete it.puzzle;
          }
          if (!coins) return 'an empty cache was placed';
          delete L.puzzle;
        }
        if (JSON.stringify(L) !== before || Dice.s !== dice[0] || Odds.s !== dice[1]) return 'placing a catch changed the floor or the run dice';
      }
    }
    return kinds.size === 3 && count > 500 || `only ${count} caches of ${kinds.size} kinds`;
  });
  await test('puzzles are opt-in and fixed Daily and Weekly runs cannot enable them', async () => {
    const { Game: G } = await loadGame();
    for (const opts of [{ puzzles: false }, { puzzles: undefined }, { daily: '2026-10-17' }, { weekly: '2026-W42' }]) {
      G.newGame(cfg('puzzle1', opts));
      if (G.state().opts.puzzles || Object.values(G.state().levels).some(L => L.puzzle)) return 'a standard run got a puzzle';
    }
    return true;
  });
  for (const [seed, kind] of [['puzzle1', 'runes'], ['puzzle3', 'torches'], ['puzzle0', 'seals']]) {
    await test(`${kind} puzzle: a wrong answer is free, leaving keeps progress, solving releases existing coins once`, async () => {
      const { Game: G, Dice, Odds } = await ready(seed);
      const q = G.level().puzzle, p = G.player(), start = { gold: p.gold, hp: p.hp, food: p.food, xp: p.xp, t: G.state().t, dice: Dice.s, odds: Odds.s };
      if (q.kind !== kind || G.useLabel() !== 'Puzzle') return 'wrong fixture or no Use label';
      const guarded = G.floorItems().find(it => it.puzzle), amount = G.floorItems().filter(it => it.puzzle).reduce((n, it) => n + it.q, 0);
      G.takeItem(guarded);
      if (!G.currentPuzzle() || p.gold !== start.gold) return 'the pack bypassed the catch';
      G.input('forward'); G.update(1000, 1000);
      if (p.x !== q.x || p.y !== q.y || G.state().t !== start.t) return 'the world moved during a puzzle';
      if (G.puzzleAction('mark', -1) || G.puzzleAction('mark', 4) || G.puzzleAction('mark', '0') || G.puzzleAction('unknown')) return 'an invalid control was accepted';
      if (G.puzzleAction('submit') || q.solved || q.feedback !== 'wrong') return 'an empty answer opened the catch';
      if (p.hp !== start.hp || p.food !== start.food || p.xp !== start.xp || Dice.s !== start.dice || Odds.s !== start.odds) return 'a guess cost resources or dice';
      G.puzzleAction('mark', 1); const progress = JSON.stringify([q.input, q.lit]);
      G.closePuzzle(); G.input('use');
      if (JSON.stringify([q.input, q.lit]) !== progress) return 'leaving lost the marks';
      if (!answer(G) || !q.solved) return 'the clue did not open the catch';
      if (G.puzzleAction('submit')) return 'a second submission was accepted';
      G.closePuzzle(); G.input('take');
      if (p.gold !== start.gold + amount) return `expected ${amount} coins, got ${p.gold - start.gold}`;
      G.input('take');
      return p.gold === start.gold + amount || 'coins were duplicated';
    });
  }
  await test('puzzle progress survives local saves and transferred codes; old saves stay standard', async () => {
    const { Game: G } = await ready('puzzle1');
    G.input('use'); G.puzzleAction('mark', 2); G.save();
    const code = await G.saveCode();
    G.puzzleAction('reset');
    if (!G.load() || G.currentPuzzle()) return 'loading kept an old overlay';
    G.input('use');
    if (G.currentPuzzle().input.join() !== '2') return 'the local save lost its progress';
    G.closePuzzle();
    if (!(await G.loadCode(code)).ok) return 'the code did not load';
    G.input('use');
    if (G.currentPuzzle().input.join() !== '2' || !answer(G)) return 'the code lost its progress or solvability';
    G.closePuzzle(); G.save(); G.load();
    if (!G.level().puzzle.solved) return 'the opened catch closed on reload';
    const old = JSON.parse(localStorage.getItem('deepdelve.save'));
    delete old.opts.puzzles; for (const L of Object.values(old.levels)) delete L.puzzle;
    localStorage.setItem('deepdelve.save', JSON.stringify(old));
    return G.load() && !G.level().puzzle && !G.state().opts.puzzles || 'a legacy save was changed';
  });
  await test('imported puzzle controls are bounded and validated before loading', async () => {
    const { Game: G } = await ready('puzzle1');
    for (const mutate of [q => q.order = [0, 0, 1, 2], q => q.order = 'x', q => q.input = Array(10).fill(0), q => q.lit = [1, 0, 0, 0], q => q.kind = '__proto__', q => q.target = 100, q => q.x = -1, q => q.feedback = '<svg>', q => q.solved = 'yes']) {
      const copy = JSON.parse(JSON.stringify(G.state())); mutate(copy.levels[1].puzzle);
      try { checkSave(copy); return 'an invalid imported puzzle was accepted'; } catch { /* expected */ }
    }
    return true;
  });
  await test('puzzle actions are recorded and replay to the same outcome without touching live storage', async () => {
    const { Game: G } = await loadGame(); G.recordRuns(true); G.newGame(cfg('puzzle1'));
    // A record must use public actions only: walk to the cache over the real map.
    const L = G.level(), p = G.player(), q = L.puzzle, dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]], seen = new Map([[`${p.x},${p.y}`, []]]), queue = [[p.x, p.y]];
    for (let i = 0; i < queue.length && !seen.has(`${q.x},${q.y}`); i++) {
      const [x, y] = queue[i];
      for (let d = 0; d < 4; d++) {
        const nx = x + dirs[d][0], ny = y + dirs[d][1], key = `${nx},${ny}`;
        if (seen.has(key) || ![0, 2, 3, 7].includes(L.tiles[ny * L.w + nx]) || L.npcs.some(a => a.x === nx && a.y === ny) || L.monsters.some(a => a.x === nx && a.y === ny)) continue;
        seen.set(key, [...seen.get(`${x},${y}`), d]); queue.push([nx, ny]);
      }
    }
    const path = seen.get(`${q.x},${q.y}`); if (!path) return 'no fixture route';
    let now = 0;
    for (const dir of path) {
      while (p.dir !== dir) { G.input('right'); now += 500; G.tick(now); G.renderState(now); }
      const tx = p.x + dirs[dir][0], ty = p.y + dirs[dir][1];
      if (L.tiles[ty * L.w + tx] === 7) G.input('use');
      for (let n = 0; n < 3 && (p.x !== tx || p.y !== ty); n++) { G.input('forward'); now += 500; G.tick(now); G.renderState(now); }
    }
    if (p.x !== q.x || p.y !== q.y) return 'the recorded route missed its cache';
    G.input('use'); G.puzzleAction('mark', 1); G.closePuzzle(); G.input('use');
    if (!answer(G)) return 'the recorded catch did not open';
    G.closePuzzle(); G.input('take'); G.hurtPlayer(99999, 'The puzzle recording check');
    const data = G.recording(), before = recordingPrint(G.state());
    if (!data || !data.events.some(e => e[0] === RECORD_METHODS.indexOf('puzzleAction'))) return 'the puzzle actions were not captured';
    const ctx = await loadGame(); globalThis.localStorage = replayStorage(data);
    try { replayHeadless(ctx.Game, data); } catch (e) { return e.message; }
    return recordingPrint(ctx.Game.state()) === before || 'the puzzle replay diverged';
  });
};
