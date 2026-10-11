// Rule checks for the fallen hero's bones and shade (fallen.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function fallenChecks(h) {
  const { OPTS, start, markLog, linesSince, test, downTo, fallTo } = h;

  // ---------- the fallen ----------
  const FALLEN = 'deepdelve.fallen';

  await test('a hero who dies and is loaded again is not left below, but another hero who fell still is', async () => {
    const ctx = await start('fighter', 'bones-reload');
    const { Game } = ctx;
    downTo(ctx, 2);
    Game.save(true);
    if (!fallTo(ctx)) return 'the goblin never killed the hero';
    if (!ctx.store.get(FALLEN)) return 'the death was not remembered';
    if (!Game.load()) return 'the save did not load';
    if (ctx.store.get(FALLEN)) return 'the hero was loaded alive and is still remembered as fallen';
    // someone else's death is theirs to keep
    const other = JSON.stringify({ name: 'Brand', cls: 'thief', level: 3, depth: 2, run: 'another-run', gear: [] });
    ctx.store.set(FALLEN, other);
    if (!Game.load()) return 'the save did not load a second time';
    return ctx.store.get(FALLEN) === other || 'loading forgot a different hero\'s death';
  });

  await test('a hero who dies is remembered, and a later run finds their bones, their gear and their shade on that floor', async () => {
    const ctx = await start('fighter', 'bones-fall');
    const { Game } = ctx;
    downTo(ctx, 3);
    const p = Game.player();
    p.eq.weapon = { t: 'longsword', q: 1, e: 2 };
    p.eq.shield = null;
    p.eq.offhand = { t: 'dagger', q: 1, e: 1, u: 'grimtooth' };       // a relic: one of a kind, so it goes plain
    p.eq.ring = { t: 'ring_protect', q: 1, e: 1, curse: 1 };
    if (!fallTo(ctx)) return 'the goblin never killed the hero';
    if (!/Test will not lie quiet/.test(Game.epilogue(false).join(' '))) return 'the end screen does not say the hero will be found';
    const rec = JSON.parse(ctx.store.get(FALLEN) || 'null');
    if (!rec) return 'nobody was remembered';
    if (rec.name !== 'Test' || rec.cls !== 'fighter' || rec.depth !== 3) return `remembered ${JSON.stringify(rec)}`;
    if (rec.killer !== 'a goblin') return `killed by "${rec.killer}"`;
    const kinds = rec.gear.map(it => it.t).join(',');
    if (kinds !== 'longsword,ring_protect,dagger') return `kept ${kinds}`;
    if (rec.gear.some(it => it.u)) return 'a relic was kept as a relic';
    if (!rec.gear.every(it => it.h === 1)) return 'the gear\'s quality was not hidden again';
    if (rec.gear[0].e !== 2 || !rec.gear[1].curse) return `the gear lost its make: ${JSON.stringify(rec.gear)}`;

    // the next run, the same device: floor 3 holds them
    Game.newGame({ name: 'Heir', cls: 'thief', stats: Game.rollStats(), seed: 'bones-next', opts: OPTS });
    downTo(ctx, 2);
    if (Game.level().monsters.some(m => m.shade)) return 'a shade on floor 2, not where the hero fell';
    const mark = markLog(Game.state());
    downTo(ctx, 3);
    const L = Game.level(), sh = L.monsters.find(m => m.shade);
    if (!sh) return 'no shade on the floor where the hero fell';
    if (sh.awake) return 'the shade was awake before it was found';
    const said = linesSince(Game.state(), mark);
    if (!said.some(l => /Test the Fighter fell on this floor, killed by a goblin,/.test(l))) return `arriving said: ${said.join(' | ')}`;
    const pile = (L.items[sh.x + ',' + sh.y] || []).map(it => it.t).join(',');
    if (pile !== 'longsword,ring_protect,dagger') return `the bones hold ${pile}`;
    if (!(L.dressing || []).some(d => d.x === sh.x && d.y === sh.y && d.k === 'remains_bones')) return 'no bones where the shade stands';
    const st = Game.mstat(sh);
    if (st.name !== 'Shade of Test' || st.move !== 'charge') return `the shade is ${st.name}, moving ${st.move}`;
    // and the map itself is the seed's own: a device with nobody remembered draws the same floor
    const plain = await start('thief', 'bones-next');
    downTo(plain, 3);
    if (plain.Game.level().monsters.some(m => m.shade)) return 'a shade with nobody remembered';
    if (plain.Game.level().tiles.join('') !== L.tiles.join('')) return 'remembering someone changed the map';
    return true;
  });

  await test('laying a shade to rest forgets its hero, says so, and leaves their gear; the Hall remembers who did it', async () => {
    const ctx = await start('cleric', 'bones-rest');
    const { Game, Dungeon } = ctx;
    ctx.store.set(FALLEN, JSON.stringify({ name: 'Wren', cls: 'mage', level: 4, depth: 3, run: 'earlier', gear: [{ t: 'staff', q: 1, e: 1 }] }));
    downTo(ctx, 3);
    const L = Game.level(), G = Game.state(), p = Game.player();
    const sh = L.monsters.find(m => m.shade);
    if (!sh) return 'no shade';
    const st = Game.mstat(sh);
    if (!st.ranged || st.ranged.element !== 'cold') return 'a mage\'s shade should throw cold fire';
    const bx = sh.x, by = sh.y;
    // bring it in front of the hero, one blow from gone
    L.monsters = [sh];
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    Object.assign(sh, { x: p.x + dx, y: p.y + dy, rx: p.x + dx, ry: p.y + dy, hp: 1, awake: true, spoke: true, nextAct: G.t + 1e9 });
    const mark = markLog(G);
    // a natural 1 misses: swing until it lands
    for (let i = 0; i < 40 && L.monsters.includes(sh); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (L.monsters.includes(sh)) return 'the shade would not fall';
    if (!linesSince(G, mark).some(l => /Wren the Mage is laid to rest at last/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
    if (ctx.store.has(FALLEN)) return 'the hero was still remembered after being laid to rest';
    if (!(L.items[bx + ',' + by] || []).some(it => it.t === 'staff')) return 'their gear went with them';
    Game.save(true);
    if (Game.state().rested !== 'Wren the Mage') return `the run says it laid ${Game.state().rested} to rest`;
    if (!/found Wren the Mage, who had gone before them, and laid them to rest/.test(Game.epilogue(true).join(' '))) return 'the end of the run does not tell of the shade laid to rest';
    // the next run meets nobody
    Game.newGame({ name: 'After', cls: 'fighter', stats: Game.rollStats(), seed: 'bones-rest', opts: OPTS });
    downTo(ctx, 3);
    return !Game.level().monsters.some(m => m.shade) || 'a shade laid to rest came back';
  });

  await test('a shade is never met by the run that died, in a daily delve, or on the lich\'s floor; a newer death takes the older one\'s place', async () => {
    const out = [];
    // the run that died, loaded again, does not meet itself
    const a = await start('fighter', 'bones-self');
    downTo(a, 2);
    const G = a.Game.state();
    a.Game.save(true);
    if (!fallTo(a)) return 'the hero would not die';
    const own = JSON.parse(a.store.get(FALLEN) || 'null');
    if (!own || own.run !== String(G.created)) out.push('the death was not remembered as this run');
    // put the floors back as they were before the death, and go on down
    a.Game.load();
    downTo(a, 3);
    for (const d of [2, 3]) if (a.Game.state().levels[d] && a.Game.state().levels[d].monsters.some(m => m.shade)) out.push(`the run met its own shade on floor ${d}`);
    // a daily delve is the same for everyone, and meets nobody's dead
    const b = await start('fighter', 'bones-daily', { daily: '2026-09-26' });
    b.store.set(FALLEN, JSON.stringify({ name: 'Ada', cls: 'thief', level: 3, depth: 2, run: 'x', gear: [] }));
    downTo(b, 3);
    for (const d of [2, 3]) if (b.Game.state().levels[d].monsters.some(m => m.shade)) out.push('a daily delve met a shade');
    if (/will not lie quiet/.test(b.Game.epilogue(false).join(' '))) out.push('a daily delve promises its dead will be found');
    // and a daily death is not remembered: whoever was stays
    if (!fallTo(b)) out.push('the daily hero would not die');
    else if ((JSON.parse(b.store.get(FALLEN) || 'null') || {}).name !== 'Ada') out.push('a daily death replaced the hero remembered');
    // someone who fell deeper than this delve goes waits on the last floor before the lich's
    const c = await start('fighter', 'bones-deep');
    c.store.set(FALLEN, JSON.stringify({ name: 'Bo', cls: 'ranger', level: 9, depth: 9, run: 'x', gear: [] }));
    downTo(c, 4);
    const lv = c.Game.state().levels;
    if (!lv[3].monsters.some(m => m.shade)) out.push('someone who fell on floor 9 was not waiting on floor 3 of four');
    if (lv[4].monsters.some(m => m.shade)) out.push('a shade on the lich\'s floor');
    // a thief's shade is quick and follows a step back
    const t = c.Game.mstat({ id: 'shade', shade: { name: 'Ada', cls: 'thief', level: 3, run: 'x', depth: 3 }, x: 0, y: 0 });
    if (!(t.speed < 1000) || !t.lunge) out.push(`a thief's shade moves every ${t.speed} and lunges ${t.lunge}`);
    // a newer death takes the older one's place
    const d = await start('mage', 'bones-newer');
    d.store.set(FALLEN, JSON.stringify({ name: 'Old', cls: 'thief', level: 3, depth: 2, run: 'x', gear: [] }));
    if (!fallTo(d)) return 'the mage would not die';
    const now = JSON.parse(d.store.get(FALLEN) || 'null');
    if (!now || now.name !== 'Test' || now.cls !== 'mage') out.push(`after a newer death, remembered ${JSON.stringify(now)}`);
    // and a stored record that makes no sense is nobody at all
    const e = await start('fighter', 'bones-junk');
    e.store.set(FALLEN, '{"name": 5, "cls": "wizard"}');
    downTo(e, 3);
    if (e.Game.level().monsters.some(m => m.shade)) out.push('a shade from a record that made no sense');
    return out.length ? out.join('; ') : true;
  });

  await test('a shade never clears away a floor\'s champion, and is made sturdier on Hard as the floor\'s own creatures are', async () => {
    const out = [];
    let tried = 0;
    // seeds where the shade's bones used to land beside the champion and clear it away
    const busyFloor = { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true, traps: true };
    for (const seed of ['nm126', 'nm147', 'nm154', 'nm159']) {
      const ctx = await start('fighter', seed, busyFloor);
      const plan = ctx.Dungeon.namedPlan(seed, 8);
      for (const d of Object.keys(plan).map(Number)) {
      if (ctx.Game.state().depth > d) continue;
      tried++;
      ctx.store.set(FALLEN, JSON.stringify({ name: 'Kit', cls: 'fighter', level: 3, depth: d, run: 'x', gear: [] }));
      downTo(ctx, d);
      const L = ctx.Game.level(), champ = L.monsters.find(m => m.id === plan[d]), sh = L.monsters.find(m => m.shade);
      if (!champ) out.push(`${seed}: the champion of floor ${d} was cleared away`);
      else if (sh && Math.abs(sh.x - champ.x) + Math.abs(sh.y - champ.y) <= 3) out.push(`${seed}: the shade lies in the champion's lair`);
      }
    }
    if (tried < 4) out.push(`only ${tried} champion floors tried`);
    // the same shade on the same floor, Easy against Hard
    const hp = async difficulty => {
      const c = await start('fighter', 'bones-hard', { difficulty });
      c.store.set(FALLEN, JSON.stringify({ name: 'Kit', cls: 'fighter', level: 3, depth: 3, run: 'x', gear: [] }));
      downTo(c, 3);
      const sh = c.Game.level().monsters.find(m => m.shade);
      return sh ? sh.maxHp : 0;
    };
    const easy = await hp('easy'), hard = await hp('hard');
    if (!easy || !(hard > easy)) out.push(`a shade has ${easy} life on Easy and ${hard} on Hard`);
    return out.length ? out.join('; ') : true;
  });

  await test('a trader never buys a thing back for more than they would sell it for, however charming and light-fingered the hero', async () => {
    const ctx = await start('thief', 'market-loop');
    const { Game, Dungeon } = ctx;
    const p = Game.player(), G = Game.state();
    p.stats.cha = 20; p.talents = (p.talents || []).concat('light_fingers');
    // a captive freed on the floor above: the market vouches for them
    Game.level().monsters.length = 0; Game.descend();
    G.threads = { ...(G.threads || {}), captive: 1 };
    const shop = { id: 'merchant', x: 0, y: 0, markup: 1.35, stock: [{ t: 'potion_xheal', q: 3, e: 0 }, { t: 'longsword', q: 1, e: 1 }] };
    const L = Game.level(); L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
    L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR; Game.input('forward');
    if (!Game.currentShop()) return 'could not open the shop';
    const out = [];
    for (const it of shop.stock) {
      const buy = Game.buyPrice(shop, it), sell = Game.sellPrice({ ...it, q: 1 });
      if (sell >= buy) out.push(`${it.t}: bought for ${buy}, sold back for ${sell}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a scroll of teleport never sets the hero down on a trader, an encounter or a barrel', async () => {
    const ctx = await start('fighter', 'teleport-clear');
    const { Game, Dungeon } = ctx;
    const out = [];
    for (let i = 0; i < 60; i++) {
      const L = Game.level(), p = Game.player();
      // a floor crowded with things to land on: every other open square holds a trader, a stone or a barrel
      L.monsters.length = 0; L.npcs = []; L.dressing = [];
      let n = 0;
      for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) {
        if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR || (x === p.x && y === p.y) || n++ % 2) continue;
        if (n % 6 === 1) L.npcs.push({ id: 'merchant', x, y, markup: 2, stock: [] });
        else if (n % 6 === 3) L.npcs.push({ id: 'mercy', kind: 'encounter', x, y });
        else L.dressing.push({ x, y, k: 'barrel', ox: 0, oy: 0 });
      }
      const it = { t: 'scroll_teleport', q: 1, e: 0 };
      p.inv.push(it);
      Game.useItem(it);
      const on = L.npcs.find(q => q.x === p.x && q.y === p.y) || L.dressing.find(q => q.x === p.x && q.y === p.y);
      if (on) { out.push(`landed on ${on.id || on.k} at ${p.x},${p.y}`); break; }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a floor readier for a strong hero never makes a whole pack into champions', async () => {
    const out = [];
    let packs = 0;
    for (let i = 0; i < 40; i++) {
      const ctx = await start('fighter', `press-pack-${i}`, { levels: 8, monsters: 'normal' });
      const { Game } = ctx;
      // a hero far ahead of the depth: the third floor (the first a floor is ever pressed on) is pressed hard
      const p = Game.player(), G = Game.state(); p.level = 12;
      while (G.depth < 3) { Game.level().monsters.length = 0; if (Game.forkPending()) Game.chooseRoute('crypts'); Game.descend(); if (Game.forkPending()) Game.chooseRoute('crypts'); }
      if (!(Game.level().press > 0)) { out.push(`floor 3 was not pressed (press ${Game.level().press})`); break; }
      for (const m of Game.level().monsters) if (m.pack) { packs++; if (m.elite) out.push(`${m.elite} ${m.id} pack on press-pack-${i}`); }
      if (out.length) break;
    }
    if (!packs) out.push('no packs met to try');
    return out.length ? out.join('; ') : true;
  });
};
