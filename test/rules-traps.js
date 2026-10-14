// Rule checks for traps a creature walks onto (foes.js springs).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function trapChecks(h) {
  const { start, markLog, linesSince, test, ahead } = h;

await test('a creature that walks onto a trap sets it off, and it is spent: a dart hurts it, a pit holds it a moment, a gong wakes the floor; what flies goes over, and a kobold\'s wire is left for the hero', async () => {
  const out = [];
  const walk = async (kind, trap, extra = {}) => {
    const ctx = await start('fighter', 'trapwalk-' + kind + trap);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    // (its own trick held back, so it walks rather than charges)
    const m = ahead(ctx, kind, 3, { hp: 50, maxHp: 50, awake: true, nextAct: G.t, moveReady: 1e12, ...extra });
    const L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    const k = `${p.x + dx * 2},${p.y + dy * 2}`;
    L.traps = L.traps || {}; L.traps[k] = trap;
    if (trap === 'snare') { L.snares = L.snares || {}; L.snares[k] = { by: 1 }; }
    // a sleeper elsewhere on the floor, for the gong
    const far = { uid: 501, id: 'goblin', x: m.x + dx * 2, y: m.y + dy * 2, hp: 10, maxHp: 10, awake: false, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(far);
    const mark = markLog(G);
    for (let i = 0; i < 200 && !(m.x === p.x + dx * 2 && m.y === p.y + dy * 2); i++) Game.update(G.t + 25, 25);
    const there = m.x === p.x + dx * 2 && m.y === p.y + dy * 2;
    return { m, L, k, G, far, there, said: linesSince(G, mark).join(' | ') };
  };
  {
    const r = await walk('orc', 'dart');
    if (!r.there) out.push('the orc never came over the dart trap');
    else {
      if (r.L.traps[r.k]) out.push('the dart trap was not spent');
      if (!(r.m.hp < 50) && r.L.monsters.includes(r.m)) out.push(`the dart did the orc no harm: ${r.said}`);
      if (!/springs a dart trap/.test(r.said)) out.push(`nothing said of it: ${r.said}`);
    }
  }
  {
    const r = await walk('orc', 'pit');
    if (!r.there) out.push('the orc never came over the pit');
    else if (!(r.m.snaredUntil > r.G.t - 1600)) out.push('the pit held nothing');
  }
  {
    const r = await walk('orc', 'alarm');
    if (!r.there) out.push('the orc never came over the gong');
    else if (!r.far.awake) out.push(`the gong woke nothing: ${r.said}`);
  }
  {
    const r = await walk('bat', 'dart');
    if (r.there && !r.L.traps[r.k]) out.push('a bat set off a trap it flew over');
  }
  {
    const r = await walk('orc', 'snare');
    if (!r.there) out.push('the orc never came over the wire');
    else if (!r.L.traps[r.k]) out.push('a kobold\'s wire went off under a creature');
  }
  return out.length ? out.join('; ') : true;
});
};
