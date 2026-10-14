// Rule checks for the mastery track: five stages a class, each worked out from the wins kept
// (progress.js, MASTERY in data.js), and what each opens.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function masteryChecks(h) {
  const { newContext, test, OPTS, evenStats } = h;

  await test('a class climbs its mastery track a stage at a time, each needing the one before: a win, Normal, Hard, both paths, Hard+3', async () => {
    const out = [];
    const ctx = await newContext();
    const { Progress, PATHS, MASTERY } = ctx;
    const put = v => ctx.store.set('deepdelve.progress', JSON.stringify(v));
    const at = () => Progress.stage('fighter');
    const [p1, p2] = PATHS.fighter.map(x => x.id);
    if (at() !== 0) out.push(`a new player's fighter at stage ${at()}`);
    put({ won: { fighter: { easy: 1 } } });
    if (at() !== 1 || Progress.frameOf('fighter') !== 'bronze') out.push(`an Easy win: stage ${at()}, frame ${Progress.frameOf('fighter')}`);
    put({ won: { fighter: { normal: 1 } } });
    if (at() !== 2) out.push(`a Normal win: stage ${at()}`);
    put({ won: { fighter: { hard: 1 } } });
    if (at() !== 3 || Progress.frameOf('fighter') !== 'silver') out.push(`a Hard win: stage ${at()}, frame ${Progress.frameOf('fighter')}`);
    // both paths won without a Hard win stops at the second stage
    put({ won: { fighter: { normal: 1 } }, paths: { [p1]: 1, [p2]: 1 } });
    if (at() !== 2) out.push(`both paths and no Hard win: stage ${at()}`);
    put({ won: { fighter: { hard: 1 } }, paths: { [p1]: 1, [p2]: 1 } });
    if (at() !== 4) out.push(`a Hard win and both paths: stage ${at()}`);
    put({ won: { fighter: { hard: 1 } }, paths: { [p1]: 1, [p2]: 1 }, rungs: { fighter: MASTERY.topRung } });
    if (at() !== 5 || Progress.frameOf('fighter') !== 'gold') out.push(`and Hard+${MASTERY.topRung}: stage ${at()}, frame ${Progress.frameOf('fighter')}`);
    // the rung alone, without the paths, is not the last stage
    put({ won: { fighter: { hard: 1 } }, rungs: { fighter: 5 } });
    if (at() !== 3) out.push(`Hard+5 without both paths: stage ${at()}`);
    // the third stage is the class's title, and every stage has a name and a need
    for (const cls of Object.keys(ctx.CLASSES)) {
      if (Progress.stageName(cls, 3) !== ctx.CLASSES[cls].title) out.push(`${cls}'s third stage is not its title`);
      for (let n = 1; n <= 5; n++) if (!Progress.stageName(cls, n) || !/\.$/.test(Progress.stageNeed(cls, n))) out.push(`${cls} stage ${n} unnamed or unsaid`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a win that raises a class\'s stage says so, and the next stage is a goal for the class just played', async () => {
    const out = [];
    const ctx = await newContext();
    const { Progress } = ctx;
    let r = Progress.recordWin('mage', 'easy', {});
    if (r.stageReached !== 1) out.push(`a mage's first win reached stage ${r.stageReached}`);
    r = Progress.recordWin('mage', 'easy', {});
    if (r.stageReached) out.push('a second Easy win raised the stage again');
    r = Progress.recordWin('mage', 'hard', {});
    if (r.stageReached !== 3) out.push(`a Hard win after an Easy one reached stage ${r.stageReached} (Hard counts as Normal or Hard)`);
    const goals = Progress.nextGoals(Progress.load(), 'mage', 8).map(g => g.what);
    if (!goals.some(g => g.startsWith(Progress.stageName('mage', 4)))) out.push(`the next stage was not a goal: ${goals.join(' | ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the third kit is every class\'s, all of it worn or carried from the start, given only at the fourth stage and never in a Daily or a Weekly', async () => {
    const out = [];
    const ctx = await newContext();
    const { Game, CLASSES, PATHS, Progress } = ctx;
    const put = v => ctx.store.set('deepdelve.progress', JSON.stringify(v));
    const begin = (cls, opts = {}) => { Game.newGame({ name: 'K', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'kit3-' + cls, opts: { ...OPTS, kit: 'third', ...opts } }); return Game.player(); };
    const held = p => [...p.inv, ...Object.values(p.eq).filter(Boolean)].map(it => it.t);
    for (const cls of Object.keys(CLASSES)) {
      const k = CLASSES[cls].thirdKit;
      if (!k || !k.items.length) { out.push(`${cls} has no third kit`); continue; }
      // not yet open: the standard kit
      put({ won: { [cls]: { hard: 1 } } });
      let p = begin(cls);
      if (Game.state().opts.kit) out.push(`${cls}: the third kit was given at stage ${Progress.stage(cls)}`);
      // open: the third kit, each piece of gear worn
      put({ won: { [cls]: { hard: 1 } }, paths: Object.fromEntries(PATHS[cls].map(x => [x.id, 1])) });
      p = begin(cls);
      const have = held(p);
      for (const id of k.items) if (!have.includes(id)) out.push(`${cls}: the third kit's ${id} is missing`);
      for (const it of p.inv) { const kind = ctx.ITEMS[it.t].kind; if (['weapon', 'armor', 'shield'].includes(kind) && !Object.values(p.eq).includes(it) && !Game.canEquip(it)) out.push(`${cls}: the third kit's ${it.t} lies unworn`); }
      for (const id of k.items) { const b = ctx.ITEMS[id]; if (['weapon', 'armor', 'shield'].includes(b.kind) && !Object.values(p.eq).some(e => e && e.t === id)) out.push(`${cls}: ${id} not worn at the start`); }
      // never in a Daily or a Weekly
      begin(cls, { daily: '2027-01-01' });
      if (Game.state().opts.kit) out.push(`${cls}: a Daily took the third kit`);
      begin(cls, { weekly: '2027-W01' });
      if (Game.state().opts.kit) out.push(`${cls}: a Weekly took the third kit`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('at the last stage, a run may begin with a relic once found: worn from the first stair, never found again that run, a quarter off the score; refused before, for a legend, or in a Daily', async () => {
    const out = [];
    const ctx = await newContext();
    const { Game, PATHS, Progress, RELICS, MASTERY, relicUsableBy } = ctx;
    const cls = 'fighter';
    const usable = Object.keys(RELICS).filter(id => !RELICS[id].legend && relicUsableBy(id, cls));
    const legend = Object.keys(RELICS).find(id => RELICS[id].legend && relicUsableBy(id, cls));
    const id = usable.find(x => ['weapon', 'armor'].includes(ctx.ITEMS[RELICS[x].t].kind)) || usable[0];
    const progress = top => ({ won: { [cls]: { hard: 1 } }, paths: Object.fromEntries(PATHS[cls].map(x => [x.id, 1])), rungs: { [cls]: top }, relics: [...usable, legend].filter(Boolean) });
    const begin = (relic, opts = {}) => { Game.newGame({ name: 'R', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'codex-' + relic, opts: { ...OPTS, relic, ...opts } }); return Game.player(); };
    const worn = p => Object.values(p.eq).some(it => it && it.u === id);
    ctx.store.set('deepdelve.progress', JSON.stringify(progress(MASTERY.topRung - 1)));
    let p = begin(id);
    if (worn(p) || Game.state().opts.relic) out.push('a relic was brought before the last stage');
    ctx.store.set('deepdelve.progress', JSON.stringify(progress(MASTERY.topRung)));
    if (!Progress.codexStarts(cls).includes(id) || (legend && Progress.codexStarts(cls).includes(legend))) out.push(`the codex offered ${Progress.codexStarts(cls).join(', ')}`);
    p = begin(id);
    const G = Game.state();
    if (!worn(p)) out.push(`${id} was not worn from the start`);
    if (!G.relics.found.includes(id) || Object.values(G.relics.floor).includes(id) || G.relics.shop.includes(id)) out.push('the brought relic could still be found again this run');
    const s = Game.score(p, 8, true);
    G.opts.relic = undefined;
    const plain = Game.score(p, 8, true);
    if (Math.abs(s / plain - MASTERY.codexScore) > 0.01) out.push(`a run begun with a relic scored ${s} to a plain run's ${plain}`);
    if (legend) { begin(legend); if (Game.state().opts.relic) out.push('a legend was brought'); }
    begin(id, { daily: '2027-01-01' });
    if (Game.state().opts.relic) out.push('a Daily took a relic');
    return out.length ? out.join('; ') : true;
  });
};
