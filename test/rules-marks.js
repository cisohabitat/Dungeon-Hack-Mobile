// Rule checks for the champions' marks: what each makes a creature do besides its numbers.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function marksChecks(h) {
  const { start, markLog, linesSince, test, beside, ahead, pinned, run, untilTrick } = h;

await test('an Armoured champion\'s plates turn the first blow that finds it, and only the first', async () => {
  const out = [];
  const ctx = await start('fighter', 'plates');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const m = beside(ctx, 'goblin', { elite: 'Armoured', hp: 999, maxHp: 999, nextAct: 1e12 });
  const landed = [];
  for (let i = 0; i < 40 && landed.length < 2; i++) {
    const hp0 = m.hp, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const said = linesSince(G, mark).join(' | ');
    if (/plates/.test(said) || /You hit|mighty blow/.test(said)) landed.push({ hurt: hp0 - m.hp, said });
    G.t += 1500; m.nextAct = 1e12;
  }
  if (landed.length < 2) return `only ${landed.length} blows found it in forty swings`;
  if (landed[0].hurt !== 0 || !/plates/.test(landed[0].said)) out.push(`the first blow was not turned: ${landed[0].said}`);
  if (!m.plated) out.push('the plates were never marked spent');
  if (!(landed[1].hurt > 0)) out.push(`the second blow was turned too: ${landed[1].said}`);
  // a plain goblin's first blow is not turned
  const c2 = await start('fighter', 'plates-plain');
  const p2 = c2.Game.player(), G2 = c2.Game.state();
  p2.stats.str = 30;
  const g = beside(c2, 'goblin', { hp: 999, maxHp: 999, nextAct: 1e12 });
  for (let i = 0; i < 40 && g.hp === 999; i++) { p2.nextAttack = 0; c2.Game.input('attack'); G2.t += 1500; g.nextAct = 1e12; }
  if (g.hp === 999) out.push('a plain goblin\'s blows never landed');
  return out.length ? out.join('; ') : true;
});

await test('a thief\'s blow from the shadows finds the gaps in an Armoured champion\'s plates', async () => {
  const ctx = await start('thief', 'plates-sneak');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.dex = p.stats.str = 30;
  // asleep, so the blow comes from the shadows
  const m = beside(ctx, 'goblin', { elite: 'Armoured', hp: 999, maxHp: 999, nextAct: 1e12, awake: false });
  for (let i = 0; i < 40 && m.hp === 999; i++) {
    m.awake = false; const mark = markLog(G);
    p.nextAttack = 0; Game.input('attack'); G.t += 1500; m.nextAct = 1e12;
    const said = linesSince(G, mark).join(' | ');
    if (/rings off/.test(said)) return `the plates turned a blow from the shadows: ${said}`;
    if (m.hp < 999 && !/shadows/.test(said)) return `it was hurt by a blow not from the shadows: ${said}`;
  }
  if (m.hp === 999) return 'no blow from the shadows landed in forty tries';
  return m.plated || 'the plates were not spent';
});

await test('a wounded creature may break and run, but a Rabid champion never does', async () => {
  const out = [];
  const flees = async elite => pinned(0, async () => {
    const ctx = await start('fighter', 'rabid' + elite);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const m = beside(ctx, 'orc', { elite, hp: 400, maxHp: 400, nextAct: 1e12 });
    // worn down below a quarter, then struck again and again
    for (let i = 0; i < 60 && m.hp > 0 && !m.fleeing; i++) {
      if (m.hp > 100) m.hp = 101;
      p.nextAttack = 0; Game.input('attack'); G.t += 1500; m.nextAct = 1e12;
    }
    return !!m.fleeing;
  });
  if (!(await flees(undefined))) out.push('a plain orc never fled');
  if (await flees('Rabid')) out.push('a Rabid orc fled');
  return out.length ? out.join('; ') : true;
});

await test('a Feral champion lowers its head and charges down a line, whatever its kind; a plain one of its kind does not', async () => {
  const out = [];
  const charges = async elite => pinned(0, async () => {
    const ctx = await start('fighter', 'feral' + elite);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'rat', 3, { elite, hp: 999, maxHp: 999, nextAct: G.t });
    for (let i = 0; i < 40; i++) {
      Game.update(G.t + 25, 25);
      if (m.windup && m.windup.move === 'charge') return true;
      if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) < 2) return false;
    }
    return false;
  });
  if (!(await charges('Feral'))) out.push('a Feral rat never charged');
  if (await charges(undefined)) out.push('a plain rat charged');
  // and it is answered as an orc's is: step aside and it thunders past, open
  const ctx = await start('fighter', 'feral-aside');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = ahead(ctx, 'rat', 3, { elite: 'Feral', hp: 999, maxHp: 999 });
  const [fx, fy] = ctx.Dungeon.DIRS[p.dir];
  m.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t + 700, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
  h.shift(ctx, 'aside');
  const hp0 = p.hp, mark = markLog(G);
  run(Game, G, 800);
  if (p.hp < hp0) out.push(`stepped aside and was still struck: ${linesSince(G, mark).join(' | ')}`);
  if (!p.opening || p.opening.uid !== m.uid) out.push('stepping aside left no opening');
  return out.length ? out.join('; ') : true;
});

await test('an Ancient champion is ready to use its trick again in half the time, and comes to it in half the blows', async () => {
  const out = [];
  const after = async elite => {
    const ctx = await start('fighter', 'ancient' + elite);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'quillback', { elite, blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return null;
    run(Game, G, 1500);
    return (m.moveReady || 0) - G.t;
  };
  const plain = await after(undefined), old = await after('Ancient');
  if (plain == null || old == null) return 'the quillback never raised its quills';
  if (!(old < plain * 0.6)) out.push(`ready again in ${old} against a plain one's ${plain}`);
  // each blow it swings counts twice towards the trick that waits on blows
  const ctx = await start('fighter', 'ancient-blows');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'ogre', { elite: 'Ancient', moveReady: 1e12 });
  for (let i = 0; i < 400 && !(m.blows >= 2); i++) Game.update(G.t + 25, 25);
  if (m.blows !== 2) out.push(`after its first blow it counted ${m.blows}`);
  return out.length ? out.join('; ') : true;
});
};
