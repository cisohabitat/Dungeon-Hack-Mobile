// Rule checks for the Gallows Ring, a cursed thing worth wearing (data.js, curses.js, game.js, pacing.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function gallowsChecks(h) {
  const { start, markLog, linesSince, test, run } = h;
  const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };

  await test('a Gallows Ring is always found cursed, its quality hidden, and is never on a shelf', async () => {
    const out = [];
    let found = 0;
    for (let s = 0; s < 24; s++) {
      const c = await start('fighter', 'gallows-' + s, REAL);
      for (let d = 2; d <= 8; d++) {
        c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute('crypts');
        const L = c.Game.level();
        for (const it of Object.values(L.items).flat()) if (it.t === 'ring_gallows') { found++; if (!it.curse || !it.h) out.push(`floor ${d}: one found ${it.curse ? '' : 'uncursed'} ${it.h ? '' : 'known'}`); }
        if ((L.npcs || []).some(n => (n.stock || []).some(it => it.t === 'ring_gallows'))) out.push(`floor ${d}: one on a trader's shelf`);
      }
    }
    if (!found) out.push('none found in 24 runs');
    return out.length ? out.join('; ') : true;
  });

  await test('worn, a Gallows Ring gives three to hit and to damage and will not come off; its wounds do not close by themselves or with rest, until the curse is broken and it is off', async () => {
    const out = [];
    const { Game } = await start('fighter', 'gallows-wear');
    const p = Game.player(), G = Game.state(), L = Game.level();
    L.monsters.length = 0;
    const before = Game.toHit();
    const ring = { t: 'ring_gallows', q: 1, e: 0, h: 1, curse: 1 };
    p.inv.push(ring);
    let mark = markLog(G);
    Game.equip(ring);
    if (!linesSince(G, mark).some(l => /cursed/.test(l))) out.push(`putting it on said: ${linesSince(G, mark).join(' | ')}`);
    if (Game.toHit() !== before + 3) out.push(`to hit went from ${before} to ${Game.toHit()}`);
    Game.unequip(p.eq.ring === ring ? 'ring' : 'ring2');
    if (p.eq.ring !== ring && p.eq.ring2 !== ring) out.push('the ring came off');
    // no natural healing: well fed, unhunted, a long while
    p.hp = Math.max(1, Math.floor(p.maxHp / 5)); p.lastHurt = -1e9; p.food = 999;
    const low = p.hp;
    run(Game, G, 20000);
    if (p.hp !== low) out.push(`its wearer healed from ${low} to ${p.hp} by themselves`);
    // nor with rest: with spell points to restore, a rest restores only them; with none, it is refused
    mark = markLog(G);
    const food = p.food;
    if (Game.rest() !== false) out.push('a rest that could give nothing was taken');
    if (p.food !== food) out.push('a refused rest still ate');
    if (!linesSince(G, mark).some(l => /Resting would do nothing/.test(l))) out.push(`the refusal did not say why: ${linesSince(G, mark).join(' | ')}`);
    p.maxSp = Math.max(p.maxSp, 10); p.sp = 0;
    mark = markLog(G);
    Game.rest();
    if (p.hp !== low) out.push(`a rest healed its wearer from ${low} to ${p.hp}`);
    if (!(p.sp > 0)) out.push('the rest gave no spell points either');
    if (!linesSince(G, mark).some(l => /wounds stay open/.test(l))) out.push(`the rest did not say why: ${linesSince(G, mark).join(' | ')}`);
    // broken and taken off, the wounds close again
    G.known.scroll_uncurse = 1;
    p.inv.push({ t: 'scroll_uncurse', q: 1, e: 0 });
    Game.useItem(p.inv.find(i => i.t === 'scroll_uncurse'));
    Game.unequip(p.eq.ring === ring ? 'ring' : 'ring2');
    if (p.eq.ring === ring || p.eq.ring2 === ring) out.push('freed, the ring still would not come off');
    p.lastHurt = -1e9;
    run(Game, G, 20000);
    if (!(p.hp > low)) out.push('without it, the wounds still did not close');
    return out.length ? out.join('; ') : true;
  });
};
