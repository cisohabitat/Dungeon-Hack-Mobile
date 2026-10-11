// Rule checks for Wick, the one Lampfolk trader with a name (trader.js): where
// it keeps its shop, what it remembers between runs (Progress.wick) and says
// for it, its tales, and a regular's tenth off. Run from rules.js with its
// helpers lent in.
module.exports = async function wickChecks(h) {
  const { test, newContext, winHere, fallTo, downTo, evenStats } = h;
  const EIGHT = { levels: 8, size: 'small', monsters: 'few', treasure: 'normal', lockedDoors: false, traps: false, permadeath: true };

  const run = (ctx, name, seed, opts = {}) => ctx.Game.newGame({ name, cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...EIGHT, ...opts } });
  /** Down to Wick's floor, and stand facing it with the floor clear. @returns {any} Wick, or null on a delve with none */
  const toWick = ctx => {
    const { Game, Dungeon } = ctx, G = Game.state();
    for (let d = 2; d < (G.opts.levels || 8) && !G.wickAt; d++) downTo(ctx, d);
    if (!G.wickAt) return null;
    downTo(ctx, G.wickAt);
    const L = Game.level(), p = Game.player(), n = L.npcs.find(q => q.wick);
    L.monsters.length = 0;
    const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(n.y - dy) * L.w + n.x - dx] === Dungeon.T.FLOOR; });
    const [dx, dy] = Dungeon.DIRS[k];
    p.x = n.x - dx; p.y = n.y - dy; p.dir = k;
    return n;
  };
  /** Walk into Wick's shop and out again: what was said. */
  const visit = ctx => {
    const { Game } = ctx, from = Game.state().log.length;
    Game.input('forward');
    const said = Game.state().log.slice(from).map(e => e.m).join(' | ');
    Game.closeShop();
    return said;
  };

  await test('Wick keeps the shop of the first Lampfolk trader two fifths of the way down or deeper: never a pedlar, never on a quick delve', async () => {
    const out = [];
    let seen = 0;
    for (let s = 0; s < 16; s++) {
      const ctx = await newContext(); const { Game } = ctx, G = Game.state;
      run(ctx, 'W', 'wick-at-' + s);
      for (let d = 2; d <= 7; d++) downTo(ctx, d);
      const st = G(), floors = Object.keys(st.levels).map(Number).sort((a, b) => a - b);
      const lamp = floors.filter(d => d >= 3 && st.levels[d].npcs.some(n => n.id === 'merchant') && st.levels[d].twist !== 'market');
      const marked = floors.flatMap(d => st.levels[d].npcs.filter(n => n.wick).map(() => d));
      if ((lamp[0] || undefined) !== st.wickAt) out.push(`wick-at-${s}: Wick on floor ${st.wickAt}, the first Lampfolk trader from floor 3 on ${lamp[0]}`);
      if (marked.length !== (st.wickAt ? 1 : 0) || (st.wickAt && marked[0] !== st.wickAt)) out.push(`wick-at-${s}: Wick marked on floors ${marked}`);
      if (st.wickAt) seen++;
      // the shop is named for it, and it is drawn as itself
      if (st.wickAt) { const n = st.levels[st.wickAt].npcs.find(q => q.wick); Game.state().depth = st.wickAt; if (Game.traderName(n) !== 'Wick, of the Lampfolk') out.push(`Wick's shop is called ${Game.traderName(n)}`); }
    }
    if (seen < 12) out.push(`only ${seen} of 16 delves had Wick in them`);
    // the same seed puts Wick in the same place, in another world
    const a = await newContext(), b = await newContext();
    for (const c of [a, b]) { run(c, 'W', 'wick-again'); for (let d = 2; d <= 7; d++) downTo(c, d); }
    if (a.Game.state().wickAt !== b.Game.state().wickAt) out.push('the same seed put Wick on two floors');
    // and a quick delve of two floors has no Wick in it
    const q = await newContext();
    run(q, 'Q', 'wick-quick', { levels: 2 }); downTo(q, 2);
    if (q.Game.state().wickAt || Object.values(q.Game.state().levels).some(L => L.npcs.some(n => n.wick))) out.push('Wick turned up on a quick delve');
    return out.length ? out.join('; ') : true;
  });

  await test('Wick meets a newcomer by name, and later delves hear how the last hero it met fared, with one tale more each time', async () => {
    const out = [];
    const ctx = await newContext(); const { Game, Progress, WICK } = ctx;
    // the first delve: who it is, and the first tale
    run(ctx, 'Ash', 'wick-meet-1');
    if (!toWick(ctx)) return 'no Wick in wick-meet-1';
    let said = visit(ctx);
    if (!/Wick, they call me/.test(said) || !said.includes(WICK.tales[0])) out.push(`first meeting: ${said}`);
    let w = Progress.wick();
    if (w.met !== 1 || w.told !== 1 || !w.last || w.last.name !== 'Ash' || w.last.fate) out.push(`after the first meeting it remembers ${JSON.stringify(w)}`);
    // a second visit in the same delve tells nothing new
    said = visit(ctx);
    if (said.includes(WICK.tales[1]) || Progress.wick().met !== 1) out.push('a second visit in one delve counted again');
    // Ash falls; Wick hears of it
    const depth = Game.state().depth;
    if (!fallTo(ctx)) return 'Ash would not die';
    w = Progress.wick();
    if (!w.last || w.last.fate !== 'fell' || w.last.depth !== depth || !w.last.killer) out.push(`after Ash fell it remembers ${JSON.stringify(w.last)}`);
    // the next delve hears of Ash, and the second tale
    run(ctx, 'Bryn', 'wick-meet-2');
    if (!toWick(ctx)) return 'no Wick in wick-meet-2';
    said = visit(ctx);
    if (!said.includes(`The last of you was Ash the Fighter. Got as far as floor ${depth}`) || !said.includes(WICK.tales[1])) out.push(`second delve: ${said}`);
    if (/regular/.test(said)) out.push('a regular after two delves');
    // Bryn wins; the third delve hears that, is a regular, and gets the third tale
    winHere(Game);
    w = Progress.wick();
    if (!w.last || w.last.fate !== 'won' || w.won !== 1) out.push(`after Bryn won it remembers ${JSON.stringify(w)}`);
    run(ctx, 'Cael', 'wick-meet-3');
    if (!toWick(ctx)) return 'no Wick in wick-meet-3';
    said = visit(ctx);
    if (!said.includes('The last of you was Bryn the Fighter. Went down, and came up again with the Heart') || !/regular/.test(said) || !said.includes(WICK.tales[2])) out.push(`third delve: ${said}`);
    // a delve left unfinished is a hero it never heard of again
    run(ctx, 'Dun', 'wick-meet-4');
    if (!toWick(ctx)) return 'no Wick in wick-meet-4';
    said = visit(ctx);
    if (!said.includes('The last of you was Cael the Fighter. I never heard what became of them.')) out.push(`fourth delve: ${said}`);
    // and once every tale is told, the closing line
    const v = JSON.parse(ctx.store.get('deepdelve.progress')); v.wick.told = WICK.tales.length; ctx.store.set('deepdelve.progress', JSON.stringify(v));
    run(ctx, 'Eli', 'wick-meet-5');
    if (!toWick(ctx)) return 'no Wick in wick-meet-5';
    said = visit(ctx);
    if (!said.includes(WICK.done)) out.push(`with every tale told: ${said}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a regular has a tenth off Wick\'s wares from the third delve it met them in: at its shop only, and never in a Daily', async () => {
    const out = [];
    const ctx = await newContext(); const { Game } = ctx;
    run(ctx, 'R', 'wick-regular');
    const n = toWick(ctx);
    if (!n) return 'no Wick in wick-regular';
    const G = Game.state(), sword = { t: 'longsword', q: 1, e: 0 };
    Game.input('forward');
    const price = met => { G.wick = { met, told: 0, won: 0, last: null }; return Game.buyPrice(n, sword); };
    const a = price(1), b = price(2), c = price(5);
    if (b >= a || Math.abs(b - c) > 0 || b < a * 0.85) out.push(`a long sword at Wick's: ${a} on the second delve, ${b} on the third, ${c} on the sixth`);
    if (!Game.priceNotes().some(x => /regular/.test(x))) out.push('the shop does not say why it is cheaper');
    Game.closeShop();
    // a plain Lampfolk trader on the same floor knows no regulars
    n.wick = false; Game.input('forward');
    if (Game.buyPrice(n, sword) !== a) out.push(`a trader not Wick asked ${Game.buyPrice(n, sword)} of a regular, ${a} of anyone`);
    Game.closeShop(); n.wick = true;
    // nor does Wick in a Daily, which is the same delve for everyone
    G.opts.daily = '2026-10-11'; Game.input('forward');
    if (price(5) !== a) out.push(`in a Daily Wick asked a regular ${price(5)}, not ${a}`);
    Game.closeShop();
    return out.length ? out.join('; ') : true;
  });

  await test('a test run leaves Wick\'s memory as it was; and what it remembers comes back sane from any store', async () => {
    const out = [];
    const ctx = await newContext(); const { Game, Progress, WICK } = ctx;
    run(ctx, 'T', 'wick-tested');
    Game.setTesting({ hp: true });
    if (!toWick(ctx)) return 'no Wick in wick-tested';
    visit(ctx);
    winHere(Game);
    if (Progress.wick().met || Progress.wick().last) out.push(`a test run was remembered: ${JSON.stringify(Progress.wick())}`);
    // whatever was stored comes back as the shape, never a crash
    const bad = [null, 7, 'x', [], { met: -3, told: 999, won: 50, last: { name: '  ', cls: 'fighter' } }, { met: 2.7, told: 1, won: 1, last: { name: 'A'.repeat(60), cls: 'mage', fate: 'eaten', depth: 99, run: 5 } }];
    for (const w of bad) {
      ctx.store.set('deepdelve.progress', JSON.stringify({ wick: w }));
      const r = Progress.wick();
      const ok = r.met >= 0 && Number.isInteger(r.met) && r.told >= 0 && r.told <= WICK.tales.length && r.won <= r.met
        && (r.last === null || (r.last.name.length <= 24 && r.last.name.trim() && ['', 'won', 'fell'].includes(r.last.fate) && r.last.depth <= 16 && typeof r.last.run === 'string'));
      if (!ok) out.push(`${JSON.stringify(w)} came back as ${JSON.stringify(r)}`);
    }
    // and a win recorded after Wick has met you keeps what it remembers
    ctx.store.set('deepdelve.progress', JSON.stringify({ wick: { met: 3, told: 3, won: 1, last: { name: 'Fen', cls: 'cleric', run: 'x', fate: 'won', depth: 8 } } }));
    Progress.recordWin('cleric', 'normal', {});
    if (Progress.wick().met !== 3 || !Progress.wick().last) out.push('a win written to the store forgot Wick');
    return out.length ? out.join('; ') : true;
  });
};
