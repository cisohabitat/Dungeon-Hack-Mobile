// Rule checks for the monsters' signature moves.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function movesChecks(h) {
  const { OPTS, evenStats, newContext, start, markLog, linesSince, test, beside, pinned, ahead, shift, run } = h;

// ---------- signature moves ----------

await test('an ogre heaves up a crushing blow every third swing: longer, violet, and twice as hard', async () => {
  const ctx = await start('fighter', 'crush');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return `it drew ${JSON.stringify(m.windup)}`;
  if (m.windup.until - m.windup.at < 800) return `the crush gave only ${m.windup.until - m.windup.at}ms of warning`;
  const mark = markLog(G);
  run(Game, G, 1000);
  return linesSince(G, mark).some(l => /brings its club down on you|misses you/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('stepping out of the ogre\'s crush leaves it staggered and open', async () => {
  const ctx = await start('fighter', 'crush-dodge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const hp0 = p.hp;
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return 'no crush began';
  shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 950);
  if (p.hp < hp0) return `the dodged crush still cost ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /smashes the floor/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  return m.nextAct - G.t >= 1200 || `it recovered in ${m.nextAct - G.t}ms`;
});

await test('an orc charges down a straight corridor and slams into a hero who stays in line', async () => {
  const ctx = await start('fighter', 'charge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = ahead(ctx, 'orc', 3);
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return `it drew ${JSON.stringify(m.windup)}`;
  const mark = markLog(G);
  run(Game, G, 800);
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1) return 'the orc did not reach the hero';
  return linesSince(G, mark).some(l => /slams into you|misses you/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('sidestepping a charge sends the orc thundering past, stumbling', async () => {
  const ctx = await start('fighter', 'charge-dodge');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const hp0 = p.hp;
  const m = ahead(ctx, 'orc', 3);
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return 'no charge began';
  shift(ctx, 'side');
  const mark = markLog(G);
  run(Game, G, 750);
  if (p.hp < hp0) return `the dodged charge still cost ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /thunders past you/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  return m.nextAct - G.t >= 1200 || `it recovered in ${m.nextAct - G.t}ms`;
});

await test('a dodged trick leaves an opening: the next blow at it, if quick, cannot miss and lands telling', async () => {
  const out = [];
  for (const late of [false, true]) {
    const ctx = await start('fighter', 'opening');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    const m = beside(ctx, 'ogre', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'crush') { out.push('no crush began'); continue; }
    shift(ctx, 'back');
    run(Game, G, 950);
    if (!p.opening || p.opening.uid !== m.uid) { out.push('dodging the crush left no opening'); continue; }
    // back in, and swing: a blow that could never land on its own
    p.perkHit = -100;
    { const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; p.x += dx; p.y += dy; }
    if (late) G.t += 3000;
    G.t = Math.max(G.t, p.nextAttack);
    const mark = markLog(G), hp0 = m.hp;
    Game.input('attack');
    const said = linesSince(G, mark);
    const took = said.some(l => /You take the opening!/.test(l));
    if (late ? took : !took || m.hp >= hp0) out.push(`${late ? 'late' : 'quick'}: ${said.join(' | ')}`);
    // not even a natural 1 misses an opening: sixty of them all land
    if (!late) {
      let missed = 0;
      for (let i = 0; i < 60; i++) {
        p.opening = { uid: m.uid, until: G.t + 2500 }; m.hp = 999;
        G.t = Math.max(G.t, p.nextAttack);
        const before = m.hp; Game.input('attack');
        if (m.hp >= before) missed++;
      }
      if (missed) out.push(`${missed} of 60 openings missed`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a charge that lands knocks the hero down for a moment', async () => {
  const ctx = await start('fighter', 'knockdown');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 1;          // no footing to keep: a Strength save it can only fail but on a twenty
  const m = ahead(ctx, 'orc', 3, { edge: 40 });
  await pinned(0.1, () => Game.update(G.t + 25, 25));
  if (!m.windup || m.windup.move !== 'charge') return `it drew ${JSON.stringify(m.windup)}`;
  const mark = markLog(G);
  for (let i = 0; i < 40 && !linesSince(G, mark).some(l => /slams into you|misses you/.test(l)); i++) Game.update(G.t + 20, 20);
  const said = linesSince(G, mark);
  if (said.some(l => /misses you|keep your feet/.test(l))) return true;   // a natural 1, or a twenty on the save: nothing to see this time
  if (!said.some(l => /knocked off your feet/.test(l))) return `said: ${said.join(' | ')}`;
  if (!(p.held > G.t)) return 'the hero was not held';
  const x0 = p.x, y0 = p.y, m2 = markLog(G);
  Game.input('back');
  if (p.x !== x0 || p.y !== y0) return 'the hero walked off while knocked down';
  return linesSince(G, m2).some(l => /getting to your feet/.test(l)) || `blocked with: ${linesSince(G, m2).join(' | ')}`;
});

await test('a cleric\'s faith guides the mace: the stronger of strength and wisdom lands the blow; a fighter swings with strength alone', async () => {
  const hitWith = async (cls, str, wis) => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'W', cls, bg: 'tombwise', stats: { ...evenStats, str, wis }, seed: 'faith', opts: { ...OPTS } });
    return ctx.Game.toHit();
  };
  const faithful = await hitWith('cleric', 8, 18), strong = await hitWith('cleric', 18, 8), plain = await hitWith('cleric', 8, 8);
  if (!(faithful === strong && faithful > plain)) return `cleric to hit: wisdom 18 gives ${faithful}, strength 18 gives ${strong}, neither ${plain}`;
  const fighterWise = await hitWith('fighter', 8, 18), fighterPlain = await hitWith('fighter', 8, 8);
  return fighterWise === fighterPlain || `a fighter's wisdom moved its to-hit from ${fighterPlain} to ${fighterWise}`;
});

await test('a basilisk\'s gaze turns a hero looking at it to stone; one who turns away is spared and finds it open', async () => {
  const out = [];
  for (const away of [false, true]) {
    const ctx = await start('fighter', 'gaze');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'basilisk', 3, { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'gaze', at: G.t, until: G.t + 1100 }; m.nextAct = m.windup.until;
    if (away) Game.input('left');
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 1200);
    const said = linesSince(G, mark);
    if (away) {
      if (p.hp < hp0 || p.held > G.t) { out.push(`turned away and still caught: ${said.join(' | ')}`); continue; }
      if (!p.opening || p.opening.uid !== m.uid) out.push('turning away left no opening');
    } else {
      if (!(p.held > G.t) || p.heldBy !== 'stone' || p.hp >= hp0) { out.push(`looked and was not caught: ${said.join(' | ')}`); continue; }
      const x0 = p.x, y0 = p.y, m2 = markLog(G);
      Game.input('back');
      if (p.x !== x0 || p.y !== y0) out.push('a hero turned to stone walked away');
      if (!linesSince(G, m2).some(l => /limbs are stone/.test(l))) out.push(`blocked with: ${linesSince(G, m2).join(' | ')}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('stepping up to a basilisk does not beat its gaze, and one beside you gazes too; stone, you cannot turn', async () => {
  const out = [];
  {
    // it rears at three squares; the hero steps up beside it, still looking
    const ctx = await start('fighter', 'gaze-close');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'basilisk', 2, { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'gaze', at: G.t, until: G.t + 1100 }; m.nextAct = m.windup.until;
    { const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; p.x += dx; p.y += dy; }
    run(Game, G, 1200);
    if (!(p.held > G.t) || p.heldBy !== 'stone') out.push('stepping up to it and staring was spared');
    else {
      const d0 = p.dir; Game.input('left');
      if (p.dir !== d0) out.push('a hero of stone turned');
    }
  }
  {
    // right beside it, it still starts a gaze
    const ctx = await start('fighter', 'gaze-beside');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'basilisk', { hp: 999, maxHp: 999, blows: 1 });
    let gazed = false;
    for (let i = 0; i < 400 && !gazed; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'gaze') gazed = true; p.hp = 9999; p.held = 0; }
    if (!gazed) out.push('a basilisk beside the hero never gazed');
  }
  return out.length ? out.join('; ') : true;
});
};
