// Rule checks for the clock in the score (ROADMAP Phase 7): a win inside the hour
// earns more the quicker it came, a loss none, and equal scores stand by their time.
module.exports = async function clockChecks(h) {
  const { test, newContext, evenStats, OPTS } = h;
  const cfg = seed => ({ name: 'Tam', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: OPTS });

  await test('a win inside the hour earns up to 600 more, ten fewer a minute, and none after it; a loss has no clock in it', async () => {
    const ctx = await newContext();
    const { Game } = ctx;
    Game.newGame(cfg('clock'));
    const p = Game.player();
    p.xp = 1000; p.deepest = 4;
    const at = (won, minutes) => Game.score(p, 4, won, minutes * 60000);
    const out = [];
    if (at(true, 0) - at(true, 60) !== 600) out.push(`a win at once scores ${at(true, 0) - at(true, 60)} over one at the hour`);
    if (at(true, 30) - at(true, 31) !== 10) out.push(`a minute is worth ${at(true, 30) - at(true, 31)}`);
    if (at(true, 60) !== at(true, 90)) out.push('a win past the hour is still paying for its minutes');
    if (at(false, 0) !== at(false, 90)) out.push('a loss has a clock in it');
    if (at(true, 90) <= at(false, 90)) out.push('a slow win scores under a loss');
    return out.length ? out.join('; ') : true;
  });

  await test('the Hall sets the quicker of two equal scores first, and the one who brought a friend home before one who did not', async () => {
    const ctx = await newContext();
    const { Game } = ctx;
    globalThis.localStorage.removeItem('deepdelve.hall');
    const end = (seed, t, together) => {
      Game.newGame(cfg(seed));
      const G = Game.state(), p = Game.player();
      p.xp = 500; p.deepest = 3; G.t = t * 1000; G.depth = 3;
      if (together) G.companion = { id: 'hound', name: 'Hound', depth: 3, hp: 5, maxHp: 5, mode: 'follow' };
      Game.hurtPlayer(9999, 'The dark takes them.', null, 'the dark');   // (a death writes the Hall)
    };
    end('slow', 900, false); end('quick', 300, false); end('quick-friend', 300, true);
    const hall = Game.hall();
    const order = hall.map(e => e.seed).slice(0, 3).join(' > ');
    if (hall.slice(0, 3).some(e => e.score !== hall[0].score)) return `the three scored ${hall.map(e => e.score).join(', ')}, not alike`;
    return order === 'quick-friend > quick > slow' || `the Hall runs ${order}`;
  });

  await test('the week keeps the quicker of two tries that scored the same, and says how long the best took', async () => {
    const ctx = await newContext();
    const { Weekly } = ctx;
    globalThis.localStorage.removeItem('deepdelve.weekly');
    const key = '2026-W41';
    Weekly.start(key); Weekly.finish(key, { won: false, depth: 3, kills: 4, cls: 'mage', score: 700, time: 900 });
    Weekly.start(key); Weekly.finish(key, { won: false, depth: 3, kills: 4, cls: 'mage', score: 700, time: 300 });
    Weekly.start(key); Weekly.finish(key, { won: false, depth: 3, kills: 4, cls: 'mage', score: 700, time: 600 });
    const b = Weekly.status(key).best;
    if (!b || b.time !== 300) return `the best kept is the one of ${b && b.time} seconds`;
    return /in 5m 00s, score 700, best of 3 tries/.test(Weekly.shareLine(key)) || `the line reads "${Weekly.shareLine(key)}"`;
  });
};
