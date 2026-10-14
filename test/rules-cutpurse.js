// Rule checks for the Goblin Cutpurse: it snatches gold and runs (foes.js, combat.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function cutpurseChecks(h) {
  const { start, markLog, linesSince, test, beside, shift, run, untilTrick } = h;

await test('a cutpurse\'s hand darts for the purse: stood by, it takes a share of the gold and runs; stepped back from, it closes on air and is left open', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'snatch-stay');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.gold = 200;
    const m = beside(ctx, 'cutpurse', { blows: 1 });
    if (!untilTrick(ctx, m, 'snatch')) return 'the cutpurse never reached for the purse';
    const mark = markLog(G);
    run(Game, G, 800);
    const said = linesSince(G, mark).join(' | ');
    if (!(p.gold < 200) || !(m.loot > 0)) out.push(`stood by, nothing was taken: ${said}`);
    else {
      if (p.gold + m.loot !== 200) out.push(`gold went missing: ${p.gold} left, ${m.loot} taken`);
      if (m.loot > 60) out.push(`it took ${m.loot} of 200`);
      if (!m.fleeing) out.push('it did not run with the gold');
    }
  }
  {
    const ctx = await start('fighter', 'snatch-back');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.gold = 200;
    h.clearBehind(ctx);
    const m = beside(ctx, 'cutpurse', { blows: 1 });
    if (!untilTrick(ctx, m, 'snatch')) return 'the cutpurse never reached for the purse';
    shift(ctx, 'back');
    run(Game, G, 800);
    if (p.gold !== 200) out.push(`stepped back, it still took ${200 - p.gold}`);
    if (!p.opening || p.opening.uid !== m.uid) out.push('stepping back left no opening');
  }
  return out.length ? out.join('; ') : true;
});

await test('a cutpurse brought down drops the gold it took; one that gets far enough away is gone with it', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'snatch-kill');
    const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.stats.str = 30; p.gold = 0;
    const m = beside(ctx, 'cutpurse', { hp: 1, maxHp: 1, loot: 40, fleeing: true, nextAct: 1e12 });
    const mark = markLog(G);
    for (let i = 0; i < 20 && L.monsters.includes(m); i++) { p.nextAttack = 0; Game.input('attack'); G.t += 1500; m.nextAct = 1e12; }
    if (L.monsters.includes(m)) return 'the cutpurse never fell';
    const pile = L.items[`${m.x},${m.y}`] || [];
    if (!pile.some(it => it.t === 'gold' && it.q === 40)) out.push(`it dropped ${JSON.stringify(pile)}`);
    if (!linesSince(G, mark).some(l => /drops the 40 gold/.test(l))) out.push('its dropping the gold went unsaid');
  }
  {
    const ctx = await start('fighter', 'snatch-gone');
    const { Game } = ctx; const G = Game.state(), L = Game.level(), p = Game.player();
    // far down the floor, running, with the gold
    let far = null;
    for (let y = 1; y < L.h - 1 && !far; y++) for (let x = 1; x < L.w - 1 && !far; x++) if (L.tiles[y * L.w + x] === ctx.Dungeon.T.FLOOR && Math.abs(x - p.x) + Math.abs(y - p.y) > 20) far = [x, y];
    if (!far) return 'no square far enough off';
    L.monsters.length = 0;
    const m = { uid: 77, id: 'cutpurse', x: far[0], y: far[1], hp: 9, maxHp: 9, awake: true, fleeing: true, loot: 30, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    const mark = markLog(G);
    run(Game, G, 1500);
    if (L.monsters.includes(m)) out.push('far off with the gold, it stayed');
    if (!linesSince(G, mark).some(l => /gone into the dark, and 30 of your gold/.test(l))) out.push(`its going unsaid: ${linesSince(G, mark).join(' | ')}`);
  }
  return out.length ? out.join('; ') : true;
});
};
