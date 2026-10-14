// Rule checks for the mastery track: five stages a class, each worked out from the wins kept
// (progress.js, MASTERY in data.js), and what each opens.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function masteryChecks(h) {
  const { newContext, test } = h;

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
};
