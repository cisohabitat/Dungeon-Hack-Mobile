// Rule checks for the Weekly Challenge (weekly.js): the week's key, the hero
// and modifiers it deals the same for everyone, what a shared run leaves out,
// what a weekly win earns, and the tries and the best kept on the device. Run
// from rules.js with its helpers lent in.
module.exports = async function weeklyChecks(h) {
  const { test, newContext, winHere, beside } = h;

  await test('the week runs Monday to Sunday by the ISO count, across the turn of the year, and says which week it is', async () => {
    const { Weekly } = await newContext();
    const out = [];
    const at = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    for (const [day, want] of [['2025-12-29', '2026-W01'], ['2026-01-01', '2026-W01'], ['2026-10-11', '2026-W41'], ['2026-10-12', '2026-W42'], ['2026-12-31', '2026-W53'], ['2027-01-03', '2026-W53'], ['2027-01-04', '2027-W01']]) {
      if (Weekly.weekKey(at(day)) !== want) out.push(`${day} is ${Weekly.weekKey(at(day))}, not ${want}`);
    }
    // each key's Monday is in it, and a Monday
    for (const k of ['2026-W01', '2026-W42', '2026-W53', '2027-W01']) {
      const m = Weekly.monday(k);
      if (m.getUTCDay() !== 1 || Weekly.weekKey(new Date(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate())) !== k) out.push(`${k} begins ${m.toISOString().slice(0, 10)}`);
    }
    if (Weekly.longWeek('2026-W42') !== 'the week of 12 October') out.push(`the week reads "${Weekly.longWeek('2026-W42')}"`);
    return out.length ? out.join('; ') : true;
  });

  await test('a week deals the same hero, dungeon and two different vows to everyone, and the run keeps them', async () => {
    const out = [];
    const a = await newContext(), b = await newContext();
    const seen = new Set();
    for (let w = 1; w <= 30; w++) {
      const key = `2026-W${String(w).padStart(2, '0')}`;
      const x = a.Weekly.heroFor(key), y = b.Weekly.heroFor(key);
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${key} dealt two heroes`);
      if (x.opts.vows.length !== 2 || x.opts.vows[0] === x.opts.vows[1] || x.opts.vows.some(v => !a.VOWS[v])) out.push(`${key} swore ${x.opts.vows}`);
      if (x.seed !== 'weekly-' + key || x.opts.weekly !== key || x.opts.daily) out.push(`${key}: seed ${x.seed}, ${JSON.stringify(x.opts)}`);
      seen.add(x.cls + x.opts.vows.join());
    }
    if (seen.size < 10) out.push(`thirty weeks dealt only ${seen.size} different challenges`);
    // the run begun keeps the week's vows, though this device has never opened them
    const { Game, Progress } = a;
    const hero = a.Weekly.heroFor('2026-W42');
    if (Progress.vowsOpen()) out.push('a fresh device has the vows open');
    Game.newGame(hero);
    const G = Game.state();
    if (JSON.stringify(G.opts.vows) !== JSON.stringify(hero.opts.vows) || G.opts.weekly !== '2026-W42') out.push(`the run kept ${JSON.stringify(G.opts)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a weekly run is the same for everyone: no second kit, no hound, no climb past Hard, and no one\'s dead to meet, nor its own left behind', async () => {
    const out = [];
    const ctx = await newContext(); const { Game, Weekly, store } = ctx;
    // every earned start asked for, on a device that has earned them
    store.set('deepdelve.progress', JSON.stringify({ won: { fighter: { normal: 3, hard: 3 }, cleric: { normal: 3, hard: 3 }, mage: { normal: 3, hard: 3 }, thief: { normal: 3, hard: 3 }, ranger: { normal: 3, hard: 3 }, druid: { normal: 3, hard: 3 } } }));
    const hero = Weekly.heroFor('2026-W42');
    Game.newGame({ ...hero, opts: { ...hero.opts, kit: 'alt', companion: 'hound', rung: 2 } });
    if (Game.companion()) out.push('a hound came on a weekly run');
    const G = Game.state();
    if (G.opts.kit === 'alt' && Game.player().altKit) out.push('the second kit was dealt');
    if (Game.state().opts.difficulty === 'hard') out.push('the week climbed to Hard');
    // someone else's dead is not met, and this hero's death is not kept for another to meet
    const FALLEN = 'deepdelve.fallen', other = JSON.stringify({ name: 'Ada', cls: 'thief', level: 3, depth: 2, run: 'x', gear: [] });
    store.set(FALLEN, other);
    if (/will not lie quiet/.test(Game.epilogue(false).join(' '))) out.push('a weekly run promises its dead will be found');
    const p = Game.player();
    p.hp = 1; p.eq.armor = null; p.eq.shield = null;
    beside(ctx, 'goblin');
    for (let i = 0; i < 4000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
    if (G.status !== 'dead') out.push('the weekly hero would not die');
    else if (store.get(FALLEN) !== other) out.push('a weekly death replaced the hero remembered');
    return out.length ? out.join('; ') : true;
  });

  await test('a weekly win counts for its class and goes in the Hall marked for its week, but earns no trophy for vows the hero did not choose', async () => {
    const ctx = await newContext(); const { Game, Weekly, Progress } = ctx;
    const hero = Weekly.heroFor('2026-W42');
    Game.newGame(hero);
    winHere(Game);
    const v = Progress.load(), entry = Game.hall().find(e => e.name === hero.name);
    const out = [];
    if (!Progress.hasWon(hero.cls, 'normal')) out.push(`the ${hero.cls} win did not count`);
    if (Object.keys(v.vows).length) out.push(`vows kept: ${JSON.stringify(v.vows)}`);
    if (!entry || entry.weekly !== '2026-W42' || JSON.stringify(entry.vows) !== JSON.stringify(hero.opts.vows)) out.push(`the Hall kept ${JSON.stringify(entry)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the week may be tried as often as you like: each try counted, the best by score kept, and a spoilt store read sanely', async () => {
    const ctx = await newContext(); const { Weekly, store } = ctx;
    const out = [], key = '2026-W42';
    const done = (score, won = false) => ({ won, depth: 3, kills: 4, cls: 'mage', score });
    for (const s of [100, 50, 200, 120]) { Weekly.start(key); Weekly.finish(key, done(s)); }
    const w = Weekly.status(key);
    if (w.tries !== 4 || w.best.score !== 200 || w.last.score !== 120) out.push(`kept ${JSON.stringify(w)}`);
    if (!/Best: fell on floor 3, score 200 \(4 tries\)/.test(Weekly.summary(key))) out.push(`the title says "${Weekly.summary(key)}"`);
    if (!/^Deepdelve weekly 2026-W42 \(.+\): Mage, fell on floor 3, score 200, best of 4 tries$/.test(Weekly.shareLine(key))) out.push(`the share line is "${Weekly.shareLine(key)}"`);
    // a week not yet tried says what it asks
    if (!/^This week: .*Vow/.test(Weekly.summary('2026-W43'))) out.push(`an untried week says "${Weekly.summary('2026-W43')}"`);
    // only the last eight weeks are kept
    for (let n = 1; n <= 12; n++) { Weekly.start(`2027-W${String(n).padStart(2, '0')}`); }
    if (Object.keys(JSON.parse(store.get('deepdelve.weekly')).weeks).length !== 8) out.push('more than eight weeks were kept');
    // whatever was stored comes back as the shape, never a crash
    for (const bad of ['x', '[]', '{"weeks":7}', '{"weeks":{"nonsense":{"tries":3}, "2026-W40":{"tries":-2,"best":{"score":"x"}},"2026-W41":{"tries":2.7,"best":{"won":1,"depth":99,"kills":-3,"cls":"wizard","score":55.5}}}}']) {
      store.set('deepdelve.weekly', bad);
      try {
        const a = Weekly.status('2026-W40'), b = Weekly.status('2026-W41'), full = bad.includes('2026-W41');
        const sane = a.tries === 0 && a.best === null && (full ? b.tries === 2 && !!b.best && b.best.depth === 16 && b.best.kills === 0 && b.best.cls === 'fighter' && b.best.score === 55 : b.tries === 0 && b.best === null);
        if (!sane) out.push(`${bad.slice(0, 30)} read as ${JSON.stringify([a, b])}`);
      } catch (e) { out.push(`${bad.slice(0, 30)} threw ${e.message}`); }
    }
    return out.length ? out.join('; ') : true;
  });
};
