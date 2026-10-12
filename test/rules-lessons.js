// Rule checks for a floor's wear that carries (the rests' shares, the lamp, the Returned's gift)
// and the lessons that change a rule (Opening Blow, Nose for Draughts, Trap Sense, Iron Grip,
// Wayfinder), and the talent card held over from one offer to the next (ROADMAP Phase 8).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function lessonChecks(h) {
  const { OPTS, evenStats, newContext, start, beside, pinned, shopAhead, test, markLog, linesSince, downTo, goDown } = h;

  /** A hero at `from`, tipped over to `to` by a rat's death, with whatever that level offers waiting. */
  const levelUp = (ctx, from, to) => {
    const { Game, XP_TABLE } = ctx; const p = Game.player(), G = Game.state();
    p.level = from; p.xp = XP_TABLE[to - 1]; p.perkHit = 60; G.pendingBoons = []; G.pendingLevels = [];
    const m = beside(ctx, 'rat', { uid: 7000 + to, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  };
  /** One rest, with no one near and food enough: what it gave back of a wounded hero's life. */
  const restGives = ctx => {
    const { Game } = ctx; const p = Game.player();
    Game.level().monsters.length = 0; p.food = 99; p.maxHp = 60; p.hp = 1; p.sp = p.maxSp;
    Game.input('rest');
    return p.hp - 1;
  };

  await test('a floor\'s wear carries: on Normal and Hard the first rest gives two thirds, the next a third, and on Easy the whole', async () => {
    const out = [];
    for (const [difficulty, want] of [['normal', [40, 20, 10, 0]], ['hard', [40, 20, 0]], ['easy', [59, 30, 15, 0]]]) {
      const ctx = await start('fighter', 'rest-' + difficulty, { difficulty });
      // (the odds pinned high: a third rest can be found by something, which halves it)
      const got = await pinned(1, async () => want.map(() => restGives(ctx)));
      if (got.join() !== want.join()) out.push(`${difficulty}: rests gave ${got.join(', ')}, not ${want.join(', ')}`);
    }
    // the ladder's one rest a floor (Hard+2) gives what a first rest gives, not the whole
    const ctx = await start('fighter', 'rest-rung', { difficulty: 'hard', rung: 2 });
    const got = await pinned(1, async () => [restGives(ctx), restGives(ctx)]);
    if (got.join() !== '40,0') out.push(`Hard+2: rests gave ${got.join(', ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the Returned sleep by any trader\'s lamp for nothing, and their rests cost food like anyone\'s', async () => {
    const out = [];
    const ctx = await start('fighter', 'returned-lamp');
    const { Game } = ctx; const p = Game.player();
    p.bg = 'returned';
    p.food = 20; p.maxHp = 60; p.hp = 1; Game.level().monsters.length = 0;
    Game.input('rest');
    if (p.food !== 14) out.push(`the Returned's first rest cost ${20 - p.food} food, not 6`);
    p.hp = 1;
    if (!shopAhead(ctx)) return 'the shop did not open';
    const lodge = Game.shopServices().find(v => v.id === 'lodge');
    if (!lodge || lodge.price !== 0) out.push(`the lamp costs the Returned ${lodge && lodge.price}`);
    const gold = p.gold;
    if (!Game.buyService('lodge') || p.hp !== p.maxHp || p.gold !== gold) out.push(`the free night left ${p.hp} of ${p.maxHp}, gold ${gold} to ${p.gold}`);
    // and anyone else pays
    const other = await start('fighter', 'other-lamp');
    if (!shopAhead(other)) return 'the second shop did not open';
    const paid = other.Game.shopServices().find(v => v.id === 'lodge');
    if (!paid || paid.price <= 0) out.push(`the lamp costs another ${paid && paid.price}`);
    return out.length ? out.join('; ') : true;
  });

  await test('the five stat lessons are gone: Self-Taught is the one, and the rest change a rule', async () => {
    const { BOONS } = await newContext();
    const ids = BOONS.map(b => b.id);
    for (const old of ['str', 'dex', 'con', 'int', 'wis']) if (ids.includes(old)) return `${old} is still a lesson`;
    for (const want of ['spread', 'opener', 'nose', 'trapsense', 'unheld', 'wayfinder']) if (!ids.includes(want)) return `${want} is not a lesson`;
    return true;
  });

  await test('Opening Blow: the first blow at a foe that has not yet struck cannot miss, and only the first', async () => {
    const ctx = await start('fighter', 'opener');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.boons = ['opener']; p.perkHit = -60;   // (nothing of this hero's lands on its own)
    const m = beside(ctx, 'orc', { hp: 500, maxHp: 500, nextAct: 1e12 });
    G.t = p.nextAttack; Game.input('attack');
    if (m.hp === 500) return 'the opening blow missed';
    if (!m.opened) return 'the blow was not marked as the opening one';
    // (later blows land only on a twenty: of eight, at least one misses)
    const mark = markLog(G);
    for (let i = 0; i < 8; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (!linesSince(G, mark).some(l => /^You miss the/.test(l))) return 'every later blow landed with no way to';
    // a foe that has struck first gives no opening, and anything that hurt the hero has struck
    const other = beside(ctx, 'orc', { uid: 9100, hp: 500, maxHp: 500, nextAct: 1e12 });
    Game.hurtPlayer(1, 'A test pot bursts over you.', other, 'a test');
    if (!other.struck) return 'a foe whose pot hurt the hero was not counted as having struck';
    G.t = p.nextAttack; Game.input('attack');
    return other.hp === 500 || 'a foe that had struck first was still opened on';
  });

  await test('Nose for Draughts: every potion is known by its smell, scrolls are not', async () => {
    const ctx = await start('mage', 'nose');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    delete G.known.potion_heal; delete G.known.scroll_fire;
    if (Game.isKnown('potion_heal')) return 'a draught was known before the lesson';
    p.boons = ['nose'];
    if (!Game.isKnown('potion_heal') || !Game.isKnown('potion_xheal')) return 'a draught was still unknown with the lesson';
    return !Game.isKnown('scroll_fire') || 'a scroll was known by its smell';
  });

  await test('Trap Sense: the first trap on each floor is stepped over, whatever the dice; the second is a trap', async () => {
    const out = [];
    const ctx = await start('fighter', 'trapsense');
    const { Game, Dungeon, TRAP_TYPES } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
    p.boons = ['trapsense']; p.maxHp = p.hp = 200; p.stats.wis = 3; p.perkHit = 0;
    L.monsters.length = 0; L.trapsKnown = false;
    const ahead = () => { const [dx, dy] = Dungeon.DIRS[p.dir]; const x = p.x + dx, y = p.y + dy; L.tiles[y * L.w + x] = Dungeon.T.FLOOR; return `${x},${y}`; };
    L.traps = L.traps || {};
    let k = ahead(); L.traps[k] = 'pit';
    const mark = markLog(G);
    Game.input('forward');
    if (p.hp !== 200) out.push(`the first trap hurt the hero for ${200 - p.hp}`);
    if (!linesSince(G, mark).some(l => /step over it/.test(l))) out.push('the first trap was not stepped over');
    if (!L.trapSpared) out.push('the floor does not remember its spared trap');
    if (L.traps[k]) out.push('the spared trap is still there');
    // the second is met as a trap: seen by the dice or sprung
    k = ahead(); L.traps[k] = 'pit';
    const mark2 = markLog(G);
    Game.input('forward');
    if (linesSince(G, mark2).some(l => /step over it/.test(l))) out.push('the second trap was stepped over too');
    return out.length ? out.join('; ') : true;
  });

  await test('Iron Grip: a grip on the hero breaks the moment it closes', async () => {
    const ctx = await start('fighter', 'unheld');
    const { Game, MONSTERS } = ctx; const p = Game.player(), G = Game.state();
    const id = Object.keys(MONSTERS).find(k => MONSTERS[k].move === 'grab');
    if (!id) return 'no creature grabs';
    p.boons = ['unheld']; p.maxHp = p.hp = 900; p.perkHit = -60;
    const m = beside(ctx, id, { hp: 900, maxHp: 900, nextAct: G.t, awake: true, moveReady: 0 });
    const mark = markLog(G);
    let held = false;
    await pinned(0, async () => { for (let i = 0; i < 300 && !held; i++) { Game.update(G.t + 100, 100); if (p.grabbed) held = true; } });
    if (held) return 'the grip held';
    if (!Game.level().monsters.includes(m)) return 'the grabber fell';
    return linesSince(G, mark).some(l => /grip closes on you and breaks/.test(l)) || 'no grip ever closed to break';
  });

  await test('Wayfinder: the stairs down are on the map on arrival, and not without it', async () => {
    const ctx = await start('fighter', 'wayfinder');
    const { Game } = ctx; const p = Game.player();
    p.hp = p.maxHp = 9999;
    const idx = L => L.stairsDown.y * L.w + L.stairsDown.x;
    goDown(ctx);
    const plain = Game.level();
    if (plain.explored[idx(plain)]) return 'the stairs were on the map without the lesson';
    p.boons = ['wayfinder'];
    goDown(ctx);
    const L = Game.level();
    return !!L.explored[idx(L)] || 'the stairs were not on the map with it';
  });

  await test('a talent passed over is held for the next talent offer, first among its three, and let go once taken or gone', async () => {
    const out = [];
    const ctx = await start('fighter', 'held-card');
    const { Game, TALENTS } = ctx; const p = Game.player(), G = Game.state();
    p.path = 'knight';
    levelUp(ctx, 1, 2);
    const first = Game.pendingBoons();
    if (!first || first.length !== 3) return `level 2 offered ${JSON.stringify(first)}`;
    Game.chooseBoon(first[0]);
    if (p.talentHeld !== first[1]) out.push(`held ${p.talentHeld}, not ${first[1]}`);
    levelUp(ctx, 3, 4);
    const second = Game.pendingBoons();
    if (!second || second[0] !== first[1]) out.push(`level 4 offered ${JSON.stringify(second)}, the held card was ${first[1]}`);
    if (new Set(second).size !== 3 || second.includes(first[0])) out.push(`level 4's offer ${JSON.stringify(second)}`);
    // taken, it is held no more; the first passed over this time is
    Game.chooseBoon(second[0]);
    if (p.talentHeld !== second[1]) out.push(`after taking the held card, held ${p.talentHeld}`);
    // a held card the hero has since learned otherwise is let go
    p.talents = p.talents.concat(p.talentHeld);
    levelUp(ctx, 5, 6);
    const third = Game.pendingBoons();
    if (third.includes(second[1]) || p.talentHeld) out.push(`a learned talent was held over: ${JSON.stringify(third)}, held ${p.talentHeld}`);
    return out.length ? out.join('; ') : true;
  });
};
