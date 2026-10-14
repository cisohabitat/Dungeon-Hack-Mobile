// Rule checks for the vaults' chests and the mimic that may take one's place (scenes.js, foes.js, combat.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function chestChecks(h) {
  const { start, markLog, linesSince, test } = h;
  const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
  /** Walk a seed's run down, floor by floor, handing each floor to look(). */
  const floors = async (seed, to, look) => {
    const c = await start('fighter', seed, REAL);
    for (let d = 2; d <= to; d++) {
      c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute('crypts');
      if (look(c, c.Game.level(), c.Game.state().depth) === false) return c;
    }
    return c;
  };

  await test('from the second floor, about half the secret vaults keep their gold and best find in an old chest, which a blow breaks open', async () => {
    const out = [];
    let vaults = 0, chests = 0, first = null;
    for (let s = 0; s < 10; s++) {
      await floors('chest-' + s, 6, (c, L, depth) => {
        for (const v of L.vaults || []) {
          if (L.monsters.some(m => m.x === v.x && m.y === v.y && m.disguise === 'chest')) { chests++; vaults++; continue; }
          vaults++;
          const q = (L.dressing || []).find(o => o.k === 'chest' && o.x === v.x && o.y === v.y);
          if (!q) continue;
          chests++;
          if (!(q.loot || []).some(it => it.t === 'gold')) out.push(`floor ${depth}: a chest without the vault's gold`);
          if ((L.items[`${v.x},${v.y}`] || []).length) out.push(`floor ${depth}: the vault's gold left lying under its chest`);
          if (!first) first = { seed: 'chest-' + s, depth };
        }
        if ((L.dressing || []).some(o => o.k === 'chest' && !(L.vaults || []).some(v => v.x === o.x && v.y === o.y))) out.push(`floor ${depth}: a chest outside a vault`);
      });
    }
    if (!(chests >= vaults * 0.3 && chests <= vaults * 0.7)) out.push(`${chests} chests in ${vaults} vaults`);
    if (!first) return out.concat('no chest found to open').join('; ');
    // stood at the vault's door side of it, a blow breaks it open, and what it kept lies there
    const c = await floors(first.seed, first.depth, () => true);
    const { Game, Dungeon } = c; const L = Game.level(), p = Game.player(), G = Game.state();
    const q = L.dressing.find(o => o.k === 'chest'), v = L.vaults.find(o => o.x === q.x && o.y === q.y);
    p.x = v.x - v.dx; p.y = v.y - v.dy; p.dir = Dungeon.DIRS.findIndex(([dx, dy]) => dx === v.dx && dy === v.dy);
    L.monsters.length = 0;
    if (Game.useLabel() !== 'Break') out.push(`facing a chest, the button said "${Game.useLabel()}"`);
    const kept = q.loot.length, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const pile = L.items[`${q.x},${q.y}`] || [];
    if (L.dressing.includes(q)) out.push('struck, the chest stood whole');
    if (pile.length !== kept || !pile.some(it => it.t === 'gold')) out.push(`broken open, it let out ${JSON.stringify(pile)} of ${kept} things kept`);
    if (!linesSince(G, mark).some(l => /lid splits/.test(l))) out.push(`its breaking went unsaid: ${linesSince(G, mark).join(' | ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a mimic may take the place of a vault\'s chest: it creaks as a chest, and brought down it lets out what the chest was keeping', async () => {
    const out = [];
    let found = null;
    for (let s = 0; s < 40 && !found; s++) {
      await floors('chest-mimic-' + s, 7, (c, L, depth) => {
        const m = L.monsters.find(o => o.disguise === 'chest');
        if (!m) return true;
        found = { seed: 'chest-mimic-' + s, depth };
        if (!m.disguised || m.awake) out.push('a chest mimic laid open or awake');
        if (!(L.vaults || []).some(v => v.x === m.x && v.y === m.y)) out.push('a chest mimic outside a vault');
        if (!(m.hoard || []).some(it => it.t === 'gold')) out.push(`a chest mimic keeps ${JSON.stringify(m.hoard)}`);
        if ((L.dressing || []).some(q => q.x === m.x && q.y === m.y)) out.push('a chest still stood on the mimic\'s square');
        return false;
      });
    }
    if (!found) return 'no mimic took a chest\'s place in 40 seeds';
    // one laid by hand: it creaks as a chest, shrieks as one when struck shut, and lets out what it kept
    const { Game, G, L, p, put, at } = await h.arena('fighter', 'chest-mimic');
    L.twist = null; p.stats.str = 30; p.hp = p.maxHp = 9999;
    const m = put('mimic', 3, 0, { awake: false, disguised: true, disguise: 'chest', hoard: [{ t: 'gold', q: 77 }, { t: 'potion_heal', q: 1 }], hp: 1, maxHp: 1, nextAct: 0 });
    let mark = markLog(G);
    h.run(Game, G, 300);
    if (!linesSince(G, mark).some(l => /A chest nearby creaks/.test(l))) out.push(`no chest's creak: ${linesSince(G, mark).join(' | ')}`);
    m.x = at(1)[0]; m.y = at(1)[1]; m.rx = m.x; m.ry = m.y;
    mark = markLog(G);
    for (let i = 0; i < 10 && L.monsters.includes(m); i++) { p.nextAttack = 0; p.grabbed = null; Game.input('attack'); G.t += 50; }
    const said = linesSince(G, mark).join(' | ');
    if (!/The chest shrieks/.test(said)) out.push(`struck shut, it did not shriek as a chest: ${said}`);
    if (L.monsters.includes(m)) return out.concat('the mimic never fell').join('; ');
    const pile = L.items[`${m.x},${m.y}`] || [];
    if (!pile.some(it => it.t === 'gold' && it.q === 77) || !pile.some(it => it.t === 'potion_heal')) out.push(`fallen, it let out ${JSON.stringify(pile)}`);
    if (!/What the chest was keeping/.test(said)) out.push('what it let out went unsaid');
    return out.length ? out.join('; ') : true;
  });
};
