// Rule checks for the Goblin Hexer: its hex binds a caster's tongue or slows anyone else, unless
// the chant is broken or the hero is out of its sight (foes.js, powers.js, combat.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function hexerChecks(h) {
  const { start, markLog, linesSince, test, ahead, pinned, run, untilTrick, shift } = h;

  /** A hexer three squares down the hero's line, chanting at them. */
  const chanting = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'hexer', 3);
    let began = false;
    await pinned(0, () => { began = untilTrick(ctx, m, 'hex'); });
    return { ctx, Game, G: Game.state(), p, m, began };
  };

  await test('a hexer\'s hex slows a hero who casts nothing: their blows come half as slow again, and it lifts', async () => {
    const r = await chanting('fighter', 'hex-slow');
    if (!r.began) return 'the hexer never chanted';
    const mark = markLog(r.G);
    run(r.Game, r.G, 2000);
    if (!r.p.hexed || r.p.hexed.kind !== 'slow') return `no slowing hex: ${linesSince(r.G, mark).join(' | ')}`;
    const out = [];
    const swing = () => { r.p.nextAttack = 0; r.Game.input('attack'); return r.p.nextAttack - r.G.t; };
    const slow = swing();
    r.p.hexed.until = r.G.t - 1;
    const plain = swing();
    if (!(slow >= plain * 1.45 && slow <= plain * 1.55)) out.push(`a slowed swing took ${slow}, a plain one ${plain}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a hexer\'s hex on a hero who has cast binds the tongue: no spell can be cast until it lifts', async () => {
    const r = await chanting('mage', 'hex-silence');
    if (!r.began) return 'the hexer never chanted';
    r.G.lastSpell = r.G.lastSpell || 'magic_missile';
    run(r.Game, r.G, 2000);
    if (!r.p.hexed || r.p.hexed.kind !== 'silence') return `no binding hex (${JSON.stringify(r.p.hexed)})`;
    r.p.sp = r.p.maxSp = 99; r.p.nextAttack = 0;
    const mark = markLog(r.G);
    r.Game.input('cast');
    const said = linesSince(r.G, mark).join(' | ');
    if (r.p.sp !== 99) return `a spell was cast under the hex: ${said}`;
    if (!/binds your tongue/.test(said)) return `the refusal went unsaid: ${said}`;
    return true;
  });

  await test('a hexer\'s chant is broken by a blow, and a hex falls on the stones once out of its sight', async () => {
    const out = [];
    {
      const ctx = await start('fighter', 'hex-break');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.stats.str = 30;
      const m = h.beside(ctx, 'hexer', { blows: 1 });
      let began = false;
      await pinned(0, () => { began = untilTrick(ctx, m, 'hex'); });
      if (!began) return 'the hexer never chanted beside the hero';
      const mark = markLog(G);
      for (let i = 0; i < 10 && m.windup; i++) { p.nextAttack = 0; Game.input('attack'); G.t += 50; }
      run(Game, G, 2000);
      const said = linesSince(G, mark).join(' | ');
      if (!/break the Goblin Hexer's chant/.test(said)) out.push(`no chant broken: ${said}`);
      if (p.hexed && p.hexed.until > G.t) out.push('the hex landed all the same');
    }
    {
      const r = await chanting('fighter', 'hex-dodge');
      if (!r.began) return 'the hexer never chanted down the line';
      // a step aside, out of its line
      const mark = markLog(r.G);
      shift(r.ctx, 'aside');
      run(r.Game, r.G, 2000);
      const said = linesSince(r.G, mark).join(' | ');
      if (r.p.hexed && r.p.hexed.until > r.G.t) out.push(`out of its line, the hex still landed: ${said}`);
      if (!/falls on the stones/.test(said)) out.push(`the miss went unsaid: ${said}`);
    }
    return out.length ? out.join('; ') : true;
  });
};
