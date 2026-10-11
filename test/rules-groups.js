// Rule checks for monsters in groups, with the second playtest and code review's fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function groupsChecks(h) {
  const { OPTS, newContext, start, markLog, linesSince, test, groupAhead } = h;

// ---------- groups ----------

await test('a group falls one at a time: each pays its experience, the next steps up', async () => {
  const ctx = await start('fighter', 'pack-fight');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;                                 // every blow lands
  const m = groupAhead(ctx, 'goblin', 2, 1);
  m.nextAct = 1e9;
  const xp0 = p.xp, kills0 = p.kills;
  const mark = markLog(G);
  for (let i = 0; i < 6 && m.pack; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // a natural 1 still misses
  if (!L.monsters.includes(m)) return 'killing the front goblin emptied the square';
  if (m.pack) return 'the second goblin did not step up';
  if (p.kills !== kills0 + 1 || p.xp <= xp0) return 'the fallen goblin paid nothing';
  if (!linesSince(G, mark).some(l => /last Goblin steps up/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  const xp1 = p.xp;
  for (let i = 0; i < 6 && L.monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  if (L.monsters.includes(m)) return 'the last goblin would not die';
  return (p.kills === kills0 + 2 && p.xp - xp1 === xp1 - xp0) || 'the second goblin paid differently from the first';
});

await test('each member of a group swings: a pair strikes about twice as often as one', async () => {
  const swingsBy = async members => {
    const ctx = await start('fighter', 'pack-swings');
    ctx.Dice.s = new ctx.Rng('pack-swings').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    groupAhead(ctx, 'goblin', members, 999);
    let n = 0;
    for (let i = 0; i < 300; i++) {
      p.hp = p.maxHp = 9999;
      const mark = markLog(G);
      Game.update(G.t + 50, 50);
      n += linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
    }
    return n;
  };
  const one = await swingsBy(1), two = await swingsBy(2);
  return (two >= one * 1.7 && two <= one * 2.3) || `a lone goblin swung ${one} times in 15s, a pair ${two}`;
});

await test('every area spell hits a whole group, and every single-target one only its front', async () => {
  const results = [];
  for (const cls of ['mage', 'cleric']) {
    const ctx = await start(cls, 'pack-spells-' + cls);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.level = 9;
    for (const sp of Game.knownSpells().filter(s => s.kind === 'bolt')) {
      const area = !!(sp.pierce || sp.area);
      // three goblins in one square, weak enough that any hit fells one
      const m = groupAhead(ctx, 'goblin', 3, 1);
      m.nextAct = 1e9;
      p.sp = p.maxSp = 99; p.nextAttack = G.t;
      const kills = p.kills;
      if (!Game.castSpell(sp)) { results.push(`${sp.name} could not be cast`); continue; }
      const left = L.monsters.includes(m) ? 1 + (m.pack ? m.pack.length : 0) : 0;
      if (area && (left !== 0 || p.kills !== kills + 3)) results.push(`${sp.name} left ${left} of three standing (${p.kills - kills} killed)`);
      if (!area && (left !== 2 || p.kills !== kills + 1)) results.push(`${sp.name}, a single-target spell, left ${left} of three`);
      G.t += 5000;
    }
  }
  // the Scroll of Fire is a ball of flame: the whole square burns
  const ctx = await start('thief', 'pack-scroll');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const m = groupAhead(ctx, 'goblin', 3, 1);
  m.nextAct = 1e9;
  G.known.scroll_fire = 1;
  p.inv.push({ t: 'scroll_fire', q: 1, e: 0 });
  Game.useItem(p.inv.find(i => i.t === 'scroll_fire'));
  if (L.monsters.includes(m)) results.push(`the Scroll of Fire left ${1 + (m.pack ? m.pack.length : 0)} of three standing`);
  return results.length ? results.join('; ') : true;
});

await test('an area spell that does not kill wounds every member, and a piercing bolt reaches a second group', async () => {
  const ctx = await start('mage', 'pack-wound');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.level = 9; p.sp = p.maxSp = 99;
  const lightning = Game.knownSpells().find(s => s.id === 'lightning');
  // sturdy enough to survive one bolt: every member must still be hurt
  const m = groupAhead(ctx, 'ogre', 3, 400);
  m.nextAct = 1e9; p.nextAttack = G.t;
  Game.castSpell(lightning);
  if (!(m.hp < 400 && m.pack && m.pack.length === 2 && m.pack.every(b => b.hp < 400))) return `after one bolt: front ${m.hp}, behind ${JSON.stringify(m.pack)}`;
  if (!m.pack.every(b => b.hp === m.hp)) return 'the same bolt hurt members of one group by different amounts';
  // two groups in a line down a straight corridor: the bolt takes both
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  const near = groupAhead(ctx, 'goblin', 2, 1);
  const far = { ...near, uid: 71, x: p.x + dx * 3, y: p.y + dy * 3, pack: [{ hp: 1, maxHp: 1 }] };
  L.monsters.push(far);
  near.nextAct = far.nextAct = 1e9;
  G.t += 5000; p.nextAttack = G.t;
  Game.castSpell(lightning);
  return (!L.monsters.includes(near) && !L.monsters.includes(far)) || 'a lightning bolt stopped at the first group in its path';
});

// ---------- second playtest and code review ----------
await test('a waiting swing does not outlive the moment: a new game or a step cancels it', async () => {
  const ctx = await start('fighter', 'stale-tap');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  G.t = 5000; p.nextAttack = G.t + 200;
  Game.input('attack');                              // queued for 200ms from now
  Game.newGame({ name: 'Again', cls: 'fighter', stats: Game.rollStats(), seed: 'stale-tap-2', opts: OPTS });
  Game.update(0, 16);
  if (Game.player().nextAttack > Game.state().t) return 'the last run\'s queued swing fired in the new one';
  // queue, then turn away: the swing must not fire
  const p2 = Game.player(), G2 = Game.state();
  p2.nextAttack = G2.t + 200;
  Game.input('attack');
  Game.input('left');
  Game.update(0, 300);
  return p2.nextAttack <= G2.t + 200 || 'a queued swing fired after the hero turned away';
});

await test('choosing a spell readies it on the Cast button even when nothing is in reach', async () => {
  const ctx = await start('mage', 'ready-spell');
  const { Game } = ctx;
  const p = Game.player();
  p.level = 5; p.sp = p.maxSp = 50;
  Game.level().monsters.length = 0;
  const hands = Game.knownSpells().find(s => s.id === 'burning_hands');
  if (Game.castSpell(hands)) return 'Burning Hands flew at nothing';
  if (Game.castLabel() !== 'Burning Hands') return `the Cast button says ${Game.castLabel()}`;
  // a fighter's Cast button is Bash, and the bottle drinks a healing draught
  const f = await start('fighter', 'quaff');
  const fp = f.Game.player();
  if (f.Game.castLabel() !== 'Bash') return `a fighter's Cast button says ${f.Game.castLabel()}`;
  fp.hp = 1;
  const before = fp.inv.filter(i => i.t === 'potion_heal').reduce((a, i) => a + i.q, 0);
  f.Game.input('quaff');
  const after = fp.inv.filter(i => i.t === 'potion_heal').reduce((a, i) => a + i.q, 0);
  return (after === before - 1 && fp.hp > 1) || `Quaff left ${after} of ${before} draughts and ${fp.hp} hit points`;
});

await test('an area spell names itself and says it took the whole group', async () => {
  const ctx = await start('mage', 'name-spell');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.level = 9; p.sp = p.maxSp = 99;
  const m = groupAhead(ctx, 'goblin', 3, 50);
  m.nextAct = 1e9; p.nextAttack = G.t;
  const mark = markLog(G);
  Game.castSpell(Game.knownSpells().find(s => s.id === 'lightning'));
  const said = linesSince(G, mark);
  if (!said.some(l => /Lightning Bolt engulfs all 3 of the Goblins/.test(l))) return `said: ${said.join(' | ')}`;
  return said.some(l => /^Your Lightning Bolt hits the Goblin/.test(l)) || 'the damage line did not name the spell';
});

await test('bumping the same wall again counts up instead of filling the log', async () => {
  const ctx = await start('fighter', 'bump-count');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.WALL;
  L.monsters.length = 0;
  // lines still showing: a folded repeat leaves an empty place-holder behind
  const live = () => G.log.filter(e => !e.gone).length;
  const rows = live();
  for (let i = 0; i < 4; i++) { G.t += 1000; Game.update(G.t, 1000); Game.input('forward'); }
  const last = G.log[G.log.length - 1];
  return (live() - rows <= 1 && /\(×[34]\)$/.test(last.m)) || `four bumps left ${live() - rows} new lines, the last "${last.m}"`;
});

await test('relics can be laid in a secret vault, and traders keep unknown gear unknown', async () => {
  const ctx = await newContext();
  const { Game, Dungeon } = ctx;
  let inVault = 0, tried = 0;
  for (let i = 0; i < 30 && !inVault; i++) {
    Game.newGame({ name: 'V', cls: 'fighter', stats: Game.rollStats(), seed: 'vault' + i, opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    const G = Game.state();
    for (const d of Object.keys(G.relics.floor).map(Number)) {
      // generate that floor the way the game would, by walking down to it
      while (G.depth < d) {
        const L = Game.level(), p = Game.player(), s = L.stairsDown;
        const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(s.y - dy) * L.w + s.x - dx] === Dungeon.T.FLOOR; });
        const [dx, dy] = Dungeon.DIRS[k];
        p.x = s.x - dx; p.y = s.y - dy; p.dir = k; delete L.items[p.x + ',' + p.y];
        Game.input('use');
        if (Game.forkPending()) Game.chooseRoute('crypts');
      }
      const L = Game.level();
      tried++;
      for (const k in L.items) if (L.items[k].some(it => it.u)) {
        // a pile the hero cannot walk to without finding a secret door
        const [x, y] = k.split(',').map(Number);
        const seen = new Set([L.start.y * L.w + L.start.x]), q = [...seen];
        while (q.length) { const c = q.pop(); for (const [ddx, ddy] of Dungeon.DIRS) { const n = c + ddy * L.w + ddx, t = L.tiles[n]; if (!seen.has(n) && t !== Dungeon.T.WALL && t !== Dungeon.T.SECRET && t !== Dungeon.T.TORCH && t !== Dungeon.T.FOUNTAIN) { seen.add(n); q.push(n); } } }
        if (!seen.has(y * L.w + x)) inVault++;
      }
    }
  }
  if (!inVault) return `no relic lay in a secret vault on ${tried} relic floors`;
  // a hidden +2 sold to a trader goes back on the shelf still hidden, at a plain price
  const t = await start('fighter', 'hidden-shelf');
  const tp = t.Game.player(), TL = t.Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  TL.npcs.length = 0; TL.npcs.push(shop); TL.monsters.length = 0;
  const [sx, sy] = t.Dungeon.DIRS[tp.dir]; shop.x = tp.x + sx; shop.y = tp.y + sy;
  t.Game.input('forward');
  const blade = { t: 'longsword', q: 1, e: 2, h: 1 };
  tp.inv.push(blade);
  t.Game.sell(blade);
  const shelved = shop.stock.find(s => s.t === 'longsword');
  if (!shelved || !shelved.h) return 'the trader shelved a hidden piece with its quality showing';
  return t.Game.buyPrice(shop, shelved) === t.Game.buyPrice(shop, { t: 'longsword', q: 1, e: 0 }) || 'the shelf price gave the hidden +2 away';
});
};
