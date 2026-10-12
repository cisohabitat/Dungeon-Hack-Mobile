// Rule checks for the run's own dice (js/rng.js, game.js): the same run with the
// same presses rolls the same dice, a run taken up again rolls on from where it
// left off, and the clock has no say in a fight. Run from rules.js with its
// helpers lent in.
module.exports = async function diceChecks(h) {
  const { test, newContext, evenStats, OPTS } = h;
  const crypto = require('crypto');

  /** The run as it stands, hashed: everything but the wall-clock moment it began (its keys sorted, so a save's order says nothing). */
  const sorted = v => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v);
  const print = G => crypto.createHash('md5').update(JSON.stringify(sorted({ ...G, created: 0 }))).update(JSON.stringify(G.log.map(e => e.m))).digest('hex');
  /** Which parts of two runs differ, and where their logs first part, for a failure's message. */
  const parted = (A, B) => {
    const keys = Object.keys({ ...A, ...B }).filter(k => k !== 'created' && JSON.stringify(sorted(A[k])) !== JSON.stringify(sorted(B[k]))).join(', ') || 'the log alone';
    const a = A.log.map(e => e.m), b = B.log.map(e => e.m);
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return `${keys}; the logs part at line ${i}: "${a[i - 1] || ''}" then "${a[i] || '(end)'}" against "${b[i] || '(end)'}"`;
  };
  const cfg = seed => ({ name: 'Dee', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 4, monsters: 'normal' } });
  /** A minute of a run, pressed the same way each time: a step, a swing, a turn, in a fixed round. */
  const press = (ctx, from, to, script) => {
    const { Game } = ctx, G = Game.state();
    for (let t = from; t < to; t += 25) {
      const k = Math.floor(t / 25);
      const act = script[k % script.length];
      if (act) Game.input(act);
      Game.update(G.t + 25, 25);
      if (G.status !== 'playing') break;
    }
  };
  const SCRIPT = ['forward', null, null, 'attack', null, 'forward', null, 'left', null, 'attack', null, null, 'forward', 'right', null, 'attack'];
  /** A world with nothing kept from the tests before it: no bones on a floor, no Hall, no memory of Wick's. */
  const world = async () => {
    for (const k of ['deepdelve.progress', 'deepdelve.fallen', 'deepdelve.bestiary', 'deepdelve.hall', 'deepdelve.save', 'deepdelve.lastrun']) globalThis.localStorage.removeItem(k);
    return newContext();
  };

  await test('the same seed pressed the same way is the same run, twice over, down to the last line of the log', async () => {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const ctx = await world();
      ctx.Game.newGame(cfg('same-dice'));
      // (the seed is the run's own, never the clock's)
      if (ctx.Game.state().diceSeed !== ctx.hashSeed('same-dice|fighter|oathbroken|Dee')) return `the dice were seeded from ${ctx.Game.state().diceSeed}, not the run`;
      press(ctx, 0, 90000, SCRIPT);
      runs.push({ print: print(ctx.Game.state()), G: ctx.Game.state() });
    }
    if (runs[0].print !== runs[1].print) return `two passes of the same run parted in ${parted(runs[0].G, runs[1].G)}`;
    // and a different run is a different run: the print sees the dice at all
    const other = await world();
    other.Game.newGame(cfg('same-dice'));
    press(other, 0, 90000, ['forward', 'attack', 'left', null]);
    return print(other.Game.state()) !== runs[0].print || 'a run pressed another way printed the same';
  });

  await test('a save taken up is the same run each time it is taken up: the dice and the odds come back with it, and the presses after it fall the same', async () => {
    // (a load is not nothing: it gives every creature a moment's grace, so a run put down and taken
    // up is not the run never put down; but taken up twice from the one save, it is twice the same)
    const ctx = await world();
    ctx.Game.newGame(cfg('kept-dice'));
    press(ctx, 0, 45000, SCRIPT);
    if (!ctx.Game.save(true)) return 'the run would not save';
    const dice = ctx.Dice.s, odds = ctx.Odds.s, prints = [];
    for (let i = 0; i < 2; i++) {
      // the dice and the odds disturbed while the save sits, as a title's name draws would, then the save taken up
      ctx.Dice.next(); ctx.Dice.next(); ctx.Odds.next();
      if (!ctx.Game.load()) return 'the save would not load';
      if (ctx.Dice.s !== dice || ctx.Odds.s !== odds) return `the load set the dice to ${ctx.Dice.s} and the odds to ${ctx.Odds.s}, not the saved ${dice} and ${odds}`;
      press(ctx, 45000, 90000, SCRIPT);
      prints.push({ print: print(ctx.Game.state()), G: JSON.parse(JSON.stringify(ctx.Game.state())) });
    }
    return prints[0].print === prints[1].print || `the save taken up twice played two runs, parting in ${parted(prints[0].G, prints[1].G)}`;
  });

  await test('a save from before the run had its own dice is seeded from the run itself, so it loads, and rolls the same each time it is loaded', async () => {
    const ctx = await world();
    ctx.Game.newGame(cfg('old-save'));
    if (!ctx.Game.save(true)) return 'the run would not save';
    // (the save as an older build wrote it: no dice in it)
    const old = JSON.parse(globalThis.localStorage.getItem('deepdelve.save'));
    delete old.dice; delete old.diceSeed; delete old.odds;
    globalThis.localStorage.setItem('deepdelve.save', JSON.stringify(old));
    const seeds = [];
    for (let i = 0; i < 2; i++) { ctx.Dice.next(); if (!ctx.Game.load()) return 'the old save would not load'; seeds.push(ctx.Dice.s); }
    return (seeds[0] === seeds[1] && seeds[0] === ctx.Game.state().diceSeed) || `an old save seeded the dice at ${seeds.join(' and ')}`;
  });
};
