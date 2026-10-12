// Rule checks for the deep floors' own creatures and their tricks.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function deepChecks(h) {
  const { OPTS, evenStats, newContext, start, seedDice, markLog, linesSince, test, beside, pinned, ahead, clearBehind, shift, run, untilTrick, goDown } = h;

// ---------- the deep floors' own ----------

await test('a blink hound steps back into the world at your back: turned to face it, it is caught open; not, it bites deep', async () => {
  const out = [], missed = [];
  let bitten = false;
  for (const turn of [false, false, false, true]) {
    // (unanswered, it is tried up to three times: even a warned blow misses on a natural 1)
    if (!turn && out.length === 0 && bitten) continue;
    const ctx = await start('fighter', 'blink' + turn + out.length);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    clearBehind(ctx);
    const m = beside(ctx, 'hound', { blows: 1 });
    if (!untilTrick(ctx, m, 'blink')) return 'the hound never blinked';
    const [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4];
    if (m.x !== p.x + bx || m.y !== p.y + by) { out.push(`it came back at ${m.x},${m.y}, not at the hero's back`); continue; }
    if (turn) { Game.input('left'); Game.update(G.t + 250, 250); Game.input('left'); }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 950);
    const said = linesSince(G, mark).join(' | ');
    if (turn) {
      if (p.hp < hp0) out.push(`faced it and was still bitten: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`facing it left no opening: ${said}`);
    } else if (p.hp < hp0 && /sinks its teeth into you from behind/.test(said)) bitten = true;
    else missed.push(said);
  }
  if (!bitten) out.push(`left at its back three times, it never bit: ${missed.join(' || ')}`);
  return out.length ? out.join('; ') : true;
});

await test('a quillback\'s raised quills bite a hand that strikes it; one who holds their blow finds it open', async () => {
  const out = [];
  // strike into the quills (a blow can miss: try the whole thing again)
  let struck = false;
  for (let tries = 0; tries < 8 && !struck; tries++) {
    const ctx = await start('fighter', 'quills' + tries);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const m = beside(ctx, 'quillback', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the quillback never raised its quills';
    const hp0 = p.hp, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const said = linesSince(G, mark).join(' | ');
    if (!/You hit|mighty blow/.test(said)) continue;
    struck = true;
    if (!(p.hp < hp0) || !/quills/.test(said)) out.push(`a blow into the raised quills cost nothing: ${said}`);
    run(Game, G, 1500);
    if (p.opening && p.opening.uid === m.uid) out.push('striking into the quills still left it open');
  }
  if (!struck) out.push('no blow landed in eight tries');
  {
    const ctx = await start('fighter', 'quills-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'quillback', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the quillback never raised its quills';
    const hp0 = p.hp;
    run(Game, G, 1500);
    if (p.hp < hp0) out.push('holding the blow still cost hit points');
    if (!p.opening || p.opening.uid !== m.uid) out.push('holding the blow left no opening');
  }
  return out.length ? out.join('; ') : true;
});

await test('a dark elf warrior\'s crossed blades answer a blow struck into them with a cut; one who holds their blow finds it open', async () => {
  const out = [];
  // strike into the guard (a blow can miss: try again)
  let struck = false;
  for (let tries = 0; tries < 8 && !struck; tries++) {
    const ctx = await start('fighter', 'parry' + tries);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const m = beside(ctx, 'drow_warrior', { blows: 1 });
    if (!untilTrick(ctx, m, 'parry')) return 'the warrior never crossed its blades';
    const hp0 = p.hp, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const said = linesSince(G, mark).join(' | ');
    if (!/You hit|mighty blow/.test(said)) continue;
    struck = true;
    if (!(p.hp < hp0) || !/crossed blades/.test(said)) out.push(`a blow into the guard cost nothing: ${said}`);
    const mark2 = markLog(G);
    run(Game, G, 1500);
    if (p.opening && p.opening.uid === m.uid) out.push('striking into the guard still left it open');
    if (!linesSince(G, mark2).some(l => /your blood on one of them/.test(l))) out.push('the guard did not lower, told as a cut that landed');
  }
  if (!struck) out.push('no blow landed in eight tries');
  {
    const ctx = await start('fighter', 'parry-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'drow_warrior', { blows: 1 });
    if (!untilTrick(ctx, m, 'parry')) return 'the warrior never crossed its blades';
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 1500);
    if (p.hp < hp0) out.push('holding the blow still cost hit points');
    if (!p.opening || p.opening.uid !== m.uid) out.push('holding the blow left no opening');
    if (!linesSince(G, mark).some(l => /is left open/.test(l))) out.push('the open guard was not told');
  }
  // a bite into the guard is turned too, and cuts the hound
  {
    const ctx = await start('fighter', 'parry-hound');
    const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'drow_warrior', { blows: 1 });
    // the hound beside the warrior, to one side of the hero
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4], hx = m.x + sx, hy = m.y + sy;
    L.tiles[hy * L.w + hx] = Dungeon.T.FLOOR;
    G.companion = { kind: 'hound', name: 'Ash', x: hx, y: hy, rx: hx, ry: hy, depth: G.depth, hp: 30, maxHp: 30, mode: 'follow', joined: G.depth };
    m.windup = { kind: 'move', move: 'parry', at: G.t, until: G.t + 1e9 }; m.nextAct = 1e12;
    // (a bite can miss: give the hound time to land one)
    seedDice(ctx, 'parry-hound');
    for (let i = 0; i < 800 && m.hp === 999; i++) { Game.update(G.t + 25, 25); G.companion.hp = Math.max(G.companion.hp, 1); }
    if (m.hp === 999) out.push('the hound never bit');
    else if (!(G.companion.hp < 30)) out.push('a bite into the guard cost the hound nothing');
  }
  return out.length ? out.join('; ') : true;
});

await test('a dark elf mage throws its web of shadow from afar; the High Priestess speaks as herself', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'shadow-web');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'drow_mage', 3);
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'web') return `it drew ${JSON.stringify(m.windup)}`;
    if (!linesSince(G, mark).some(l => /weaves its hands, and a web of shadow/.test(l))) out.push(`the web was not told as shadow: ${linesSince(G, mark).join(' | ')}`);
    run(Game, G, 700);
    if (!(p.webbed > G.t)) out.push('the web of shadow did not hold the hero');
  }
  {
    const ctx = await start('fighter', 'vaelith-chant');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    p.stats.str = 30;
    let broke = false;
    for (let tries = 0; tries < 8 && !broke; tries++) {
      const v = beside(ctx, 'vaelith', { hp: 50, maxHp: 200, blows: 0 });
      const mark = markLog(G);
      if (!untilTrick(ctx, v, 'mend')) return 'the High Priestess never chanted over her wounds';
      if (!linesSince(G, mark).some(l => /a dark chant over her own wounds/.test(l))) out.push(`her chant was not told as hers: ${linesSince(G, mark).join(' | ')}`);
      p.nextAttack = 0; Game.input('attack');
      if (v.hp >= 50) continue;
      broke = true;
      const hp1 = v.hp;
      if (v.windup && v.windup.move === 'mend') out.push('a wound did not break her chant');
      run(Game, G, 1500);
      if (v.hp > hp1) out.push('her chant, broken, still knit her wounds');
    }
    if (!broke) out.push('no blow landed on her in eight tries');
  }
  return out.length ? out.join('; ') : true;
});

await test('the Long Delve\'s tenth floor of twelve is the dark elves\' country: their halls, their people, their High Priestess; a rest broken there is broken by them', async () => {
  const out = [];
  const ctx = await start('fighter', 'elfland', { levels: 12, size: 'medium', monsters: 'normal' });
  const { Game, MONSTERS } = ctx; const G = Game.state(), p = Game.player();
  const { THEMES } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  Game.testFloor(9);
  if (THEMES[Game.level().theme].people) out.push('the ninth floor is the elves\'');
  if (Game.level().monsters.some(m => /^drow_|vaelith/.test(m.id))) out.push('a dark elf on the ninth floor');
  Game.testFloor(10);
  const L = Game.level();
  if (THEMES[L.theme].people !== 'elves') out.push(`the tenth floor is ${THEMES[L.theme].name}`);
  const ids = L.monsters.map(m => m.id);
  if (ids.some(id => !/^drow_|vaelith/.test(id))) out.push(`others among the elves: ${ids.filter(id => !/^drow_|vaelith/.test(id)).join()}`);
  if (!ids.includes('vaelith')) out.push('no High Priestess on their floor');
  const kinds = new Set();
  for (let i = 0; i < 30; i++) {
    L.monsters.length = 0; L.rests = 1; p.hp = 1; p.food = 100;
    G.t += 60000;
    Game.input('rest');
    for (const mm of L.monsters) kinds.add(mm.id);
  }
  if (!kinds.size) out.push('thirty rests in the elves\' country and nothing came');
  if ([...kinds].some(id => !/^drow_/.test(id))) out.push(`a rest there was broken by ${[...kinds].join(', ')}`);
  // a failed word with the mirror brings their warriors, not a wraith
  let got = null;
  for (let t = 0; t < 30 && !got; t++) {
    const c = await start('fighter', `elf-mirror-${t}`, { levels: 12 });
    c.Game.testFloor(10);
    const q = c.Game.player(), M = c.Game.level();
    q.stats.cha = 3; M.npcs.length = 0; M.monsters.length = 0;
    const [dx, dy] = c.Dungeon.DIRS[q.dir];
    M.tiles[(q.y + dy) * M.w + q.x + dx] = c.Dungeon.T.FLOOR;
    M.npcs.push({ kind: 'encounter', id: 'mirror', x: q.x + dx, y: q.y + dy });
    c.Game.input('forward');
    const r = c.Game.chooseEncounter(1);
    if (!r || !r.check || r.check.pass) continue;
    got = M.monsters.map(m => m.id).join(',');
  }
  if (got !== 'drow_warrior') out.push(`a failed word with the mirror in the elves' country brought ${got || 'nothing'}`);
  return out.length ? out.join('; ') : (MONSTERS.vaelith.named.home === 'elves' || 'Vaelith has no home');
});

await test('a cave wyrm\'s fire runs down its line: under its jaws or out of the line it misses and leaves it open; a step back does not', async () => {
  const out = [];
  for (const how of ['stay', 'back', 'close', 'aside']) {
    const ctx = await start('fighter', 'breath-' + how);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'wyrm', 2, { hp: 999, maxHp: 999 });
    const [fx, fy] = Dungeon.DIRS[p.dir];
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    if (how === 'back') shift(ctx, 'back');
    if (how === 'aside') shift(ctx, 'aside');
    if (how === 'close') { p.x += fx; p.y += fy; }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 1100);
    const said = linesSince(G, mark).join(' | ');
    const burned = p.hp < hp0;
    if (how === 'stay' || how === 'back') { if (!burned) out.push(`${how === 'back' ? 'a step back' : 'standing in its line'} escaped the fire: ${said}`); }
    else {
      if (burned) out.push(`${how === 'close' ? 'under its jaws' : 'out of its line'}, still burned: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`${how}: no opening`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a cave wyrm turns up now and then on the seventh floor of an ordinary delve, never higher, and from the ninth of the Long Delve', async () => {
  const { Dungeon, Rng } = await newContext();
  const count = (levels, depth, n) => {
    let wyrms = 0, floors = 0;
    for (let i = 0; i < n; i++) {
      const L = Dungeon.generate(`wyrm-${levels}-${depth}-${i}`, depth, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' });
      floors++; if (L.monsters.some(m => m.id === 'wyrm')) wyrms++;
    }
    return wyrms / floors;
  };
  const out = [];
  const seventh = count(8, 7, 120);
  if (!(seventh > 0.05 && seventh < 0.6)) out.push(`an ordinary delve's seventh floor held a wyrm ${Math.round(seventh * 100)}% of the time`);
  if (count(8, 6, 60) > 0) out.push('an ordinary delve\'s sixth floor held a wyrm');
  if (count(6, 5, 60) > 0) out.push('a six-floor delve held a wyrm');
  if (count(12, 8, 60) > 0) out.push('the Long Delve\'s eighth floor held a wyrm');
  // (the tenth is the dark elves', and holds only them)
  if (!(count(12, 11, 60) > 0)) out.push('the Long Delve\'s eleventh floor never held a wyrm');
  return out.length ? out.join('; ') : true;
});

await test('Skarrow the Elder Wyrm holds a deep floor of the Long Delve, never an ordinary delve, and breathes twice as often as her young', async () => {
  const out = [];
  const ctx = await start('fighter', 'skarrow', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
  let long = 0, short = 0;
  const road = { crypts: 0, warrens: 0 };
  for (let i = 0; i < 200; i++) {
    if (Object.values(Dungeon.namedPlan('sk' + i, 12)).includes('skarrow')) long++;
    if (Object.values(Dungeon.namedPlan('sk' + i, 8)).includes('skarrow')) short++;
    // a real run has chosen its road by her floor: she lairs beneath both
    for (const r of ['crypts', 'warrens']) if (Object.values(Dungeon.namedPlan('sk' + i, 12, r)).includes('skarrow')) road[r]++;
  }
  if (!long) out.push('no Long Delve in 200 held Skarrow');
  for (const r in road) if (road[r] < 20) out.push(`down the ${r}, only ${road[r]} Long Delves in 200 held Skarrow`);
  if (short) out.push(`${short} ordinary delves held Skarrow`);
  const again = async id => {
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, id, 3, { hp: 999, maxHp: 999 });
    const [fx, fy] = Dungeon.DIRS[p.dir];
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    run(Game, G, 1050);
    return m.moveReady - G.t;
  };
  const young = await again('wyrm'), elder = await again('skarrow');
  if (!(elder < young * 0.6)) out.push(`her breath came round in ${elder}ms, her young's in ${young}ms`);
  return out.length ? out.join('; ') : true;
});

await test('a fallen cave wyrm or quillback leaves its scales or quills now and then, Skarrow always; wyrm-scale wards off fire, a quill shield pricks', async () => {
  const out = [];
  const ctx = await start('fighter', 'trophies', { levels: 12 });
  const { Game, Dungeon, ITEMS, CLASSES, armorFits } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const kills = (id, n, want) => {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const m = beside(ctx, id, { hp: 1, maxHp: 1, nextAct: 1e12 });
      for (let t = 0; t < 40 && Game.level().monsters.includes(m); t++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      const k = `${m.x},${m.y}`, here = Game.level().items[k] || [];
      if (here.some(it => it.t === want)) got++;
      delete Game.level().items[k];
    }
    return got;
  };
  const w = kills('wyrm', 60, 'wyrmscale'), q = kills('quillback', 60, 'quillshield'), sk = kills('skarrow', 3, 'wyrmscale');
  if (!(w > 3 && w < 35)) out.push(`60 wyrms left ${w} coats of scale`);
  if (!(q > 2 && q < 30)) out.push(`60 quillbacks left ${q} quill shields`);
  if (sk !== 3) out.push(`Skarrow left her scales ${sk} times in 3`);
  if (kills('hound', 30, 'wyrmscale') + kills('ogre', 30, 'quillshield')) out.push('another kind left a wyrm\'s or a quillback\'s trophy');
  // neither is found lying about or sold
  if (ITEMS.wyrmscale.tier < 50 || ITEMS.quillshield.tier < 50) out.push('a trophy can turn up as ordinary loot');
  if (!armorFits(CLASSES.thief, ITEMS.wyrmscale) || armorFits(CLASSES.mage, ITEMS.wyrmscale)) out.push('wyrm-scale is not light armour');
  // the quills prick whatever strikes you
  {
    p.eq.shield = { t: 'quillshield', q: 1, e: 0 };
    // armour off and half a minute to wait: ten seconds against a whole coat of
    // mail went by without one blow landing about one time in twenty
    const coat = p.eq.armor; p.eq.armor = null;
    const m = beside(ctx, 'skeleton', { hp: 999, maxHp: 999 });
    const mark = markLog(G);
    for (let i = 0; i < 1200 && m.hp === 999; i++) { Game.update(G.t + 25, 25); p.hp = p.maxHp; }
    p.eq.armor = coat;
    if (m.hp === 999) out.push('a blow that landed was not pricked back');
    else if (!linesSince(G, mark).some(l => /barbs/.test(l))) out.push('the prick was not told');
    p.eq.shield = null;
  }
  // the scale halves a wyrm's fire
  const burn = warded => {
    p.eq.armor = warded ? { t: 'wyrmscale', q: 1, e: 0 } : null;
    let total = 0;
    for (let i = 0; i < 30; i++) {
      p.hp = p.maxHp = 9999;
      const m = ahead(ctx, 'wyrm', 3, { hp: 999, maxHp: 999 });
      const [fx, fy] = Dungeon.DIRS[p.dir];
      m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 1000, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
      run(Game, G, 1050);
      total += 9999 - p.hp;
    }
    return total;
  };
  const bare = burn(false), scaled = burn(true);
  if (!(scaled < bare * 0.7)) out.push(`wyrm-scale took the fire from ${bare} to ${scaled}, not about half`);
  return out.length ? out.join('; ') : true;
});

await test('a mage draws back one spell point a spell-kill, on Normal, on Hard and in the Long Delve alike; an ordinary Normal delve\'s creatures are a touch sturdier', async () => {
  const out = [];
  const drawn = async (difficulty, levels) => {
    for (let tries = 0; tries < 12; tries++) {
      const ctx = await start('mage', `draw-${difficulty}-${levels}-${tries}`, { levels, difficulty });
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      const m = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
      p.sp = p.maxSp - 3;                                 // room to draw back, after the cast
      const mark = markLog(G);
      if (!Game.castSpell(Game.knownSpells().find(x => x.id === 'magic_missile'))) return 'Magic Missile would not cast';
      run(Game, G, 1500);
      if (Game.level().monsters.includes(m)) continue;    // it missed: try again
      const said = linesSince(G, mark).join(' ');
      return Number((said.match(/\+(\d+) spell points?/) || [])[1] || 0);
    }
    return 'never killed it';
  };
  const n = await drawn('normal', 8), h = await drawn('hard', 8), l = await drawn('normal', 12);
  if (n !== 1) out.push(`an ordinary Normal delve drew back ${n}`);
  if (h !== 1) out.push(`Hard drew back ${h}`);
  if (l !== 1) out.push(`the Long Delve drew back ${l}`);
  // the same floor, Normal: an ordinary delve's creatures carry a little more life than the Long Delve's
  const life = async levels => {
    const ctx = await start('fighter', 'sturdy', { levels, size: 'medium', monsters: 'normal', difficulty: 'normal' });
    return ctx.Game.level().monsters.reduce((a, m) => a + m.maxHp, 0);
  };
  const short = await life(8), long = await life(12);
  if (!(short > long)) out.push(`an ordinary delve's first floor held ${short} life, the Long Delve's ${long}`);
  return out.length ? out.join('; ') : true;
});

await test('rust passes over armour already rusted through to the shield; a rest\'s ambush comes from the floor\'s own stretched tiers', async () => {
  const ctx = await start('fighter', 'rust-on');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.eq.armor.e = -3; p.eq.armor.h = 0;
  const shieldBefore = p.eq.shield.e || 0;
  const m = beside(ctx, 'rustmaw', { hp: 999, maxHp: 999, edge: 40 });
  m.windup = { kind: 'move', move: 'rust', at: G.t, until: G.t }; m.nextAct = G.t;
  Game.update(G.t + 25, 25);
  const said = Game.state().log.slice(-4).map(e => e.m).join(' | ');
  if (!/misses you/.test(said) && (p.eq.shield.e || 0) !== shieldBefore - 1) return `the shield stayed at ${p.eq.shield.e} (${said})`;
  // the last floor of a four-floor delve sits at the foot of the tiers: its ambushes are deep things
  const c2 = await newContext();
  c2.Game.newGame({ name: 'A', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'ambush-tier', opts: { ...OPTS, levels: 4 } });
  const G2 = c2.Game.state(), p2 = c2.Game.player();
  goDown(c2); goDown(c2); goDown(c2);
  if (G2.depth !== 4) return `reached floor ${G2.depth}, not 4`;
  const kinds = new Set();
  for (let i = 0; i < 30; i++) {
    c2.Game.level().monsters.length = 0; c2.Game.level().rests = 1; p2.hp = 1; p2.food = 100;   // ambushes come from the second rest on
    G2.t += 60000;
    const before = c2.Game.level().monsters.length;
    c2.Game.input('rest');
    for (const mm of c2.Game.level().monsters.slice(before)) kinds.add(mm.id);
  }
  const shallow = [...kinds].filter(id => c2.MONSTERS[id].tier[1] < 8);
  if (!kinds.size) return 'thirty rests on the deepest floor and nothing came';
  return !shallow.length || `ambushes on the deepest floor brought ${shallow.join(', ')}`;
});

await test('a rustmaw\'s bite rusts the armour of a hero who stays; one who steps back keeps it, and the forge mends it', async () => {
  const out = [];
  for (const dodge of [false, true]) {
    const ctx = await start('fighter', 'rust');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.eq.armor.e = 0; p.eq.armor.h = 0;
    const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'rust') { out.push(`it drew ${JSON.stringify(m.windup)}`); continue; }
    if (dodge) shift(ctx, 'back');
    const mark = markLog(G);
    run(Game, G, 900);
    const said = linesSince(G, mark);
    if (said.some(l => /misses you/.test(l))) continue;     // a natural 1 this time
    if (dodge ? p.eq.armor.e !== 0 : p.eq.armor.e !== -1) out.push(`${dodge ? 'stepped back' : 'stayed'}: armour now ${p.eq.armor.e} (${said.join(' | ')})`);
    if (!dodge) {
      // the trader's forge mends it, at the price of a first step
      const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
      Game.level().monsters.length = 0; Game.level().npcs.length = 0; Game.level().npcs.push(shop);
      const [dx, dy] = ctx.Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
      ctx.Dungeon.T && (Game.level().tiles[shop.y * Game.level().w + shop.x] = ctx.Dungeon.T.FLOOR);
      Game.input('forward');
      p.gold = 9999;
      const svc = Game.shopServices().find(v => v.id === 'reinforce');
      if (!Game.currentShop() || !svc || svc.why || !(svc.price > 0)) out.push(`the forge would not mend rust: ${JSON.stringify(svc)}`);
      else { Game.buyService('reinforce'); if (p.eq.armor.e !== 0) out.push(`mended to ${p.eq.armor.e}`); }
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a warned blow is not turned by armour: an ogre\'s crush lands on a hero in plate unless it rolls a 1', async () => {
  const ctx = await start('fighter', 'sure');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 99999; p.effects = { ac: { amount: 60, until: G.t + 1e9 } };
  let landed = 0, tries = 0;
  for (let i = 0; i < 12; i++) {
    const m = beside(ctx, 'ogre', { blows: 2, hp: 999, maxHp: 999 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'crush') continue;
    const hp0 = p.hp; tries++;
    run(Game, G, 1000);
    if (p.hp < hp0) landed++;
    G.t += 3000;
  }
  // only a natural 1 turns one, so all but a few land (four 1s in twelve is a chance in five hundred)
  return (tries >= 8 && landed >= tries - 5) || `${landed} of ${tries} crushes landed on a hero with sixty armour`;
});

await test('the tiers of monsters stretch over a short delve: an eight-floor delve meets the minotaur on its last floor, a long one keeps it deep', async () => {
  const ctx = await newContext();
  const { Dungeon } = ctx;
  let lastFloor = 0, early = 0, longMid = 0;
  for (let i = 0; i < 12; i++) {
    const seed = `tiers-${i}`;
    // the ladder's deepest kinds: the troll, the minotaur and the cave wyrm
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => ['minotaur', 'troll', 'wyrm'].includes(m.id))) lastFloor++;
    if (Dungeon.generate(seed, 1, { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' }).monsters.some(m => ctx.MONSTERS[m.id].tier[0] > 1)) early++;
    if (Dungeon.generate(seed, 8, { ...OPTS, levels: 16, size: 'medium', monsters: 'normal' }).monsters.some(m => m.id === 'minotaur')) longMid++;
  }
  if (lastFloor < 8) return `only ${lastFloor} of 12 eight-floor delves met a troll, minotaur or wyrm on the last floor`;
  if (early) return `${early} first floors held creatures from deeper tiers`;
  return longMid === 0 || `a sixteen-floor delve met a minotaur on floor 8 (${longMid} times)`;
});

await test('a shut door: a goblin opens it, an ogre smashes it at once, a rat batters for several blows before it gives', async () => {
  const out = [];
  for (const [id, want] of [['goblin', 'open'], ['ogre', 'smash'], ['rat', 'batter']]) {
    const ctx = await start('fighter', 'door-' + id);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    // a walled corridor ahead: the hero, a floor square, the door, a floor square, the creature
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    const at = (k, j = 0) => (p.y + dy * k + sy * j) * L.w + p.x + dx * k + sx * j;
    for (let k = 1; k <= 6; k++) { L.tiles[at(k, 1)] = T.WALL; L.tiles[at(k, -1)] = T.WALL; }
    for (let k = 1; k <= 4; k++) L.tiles[at(k)] = T.FLOOR;
    ahead(ctx, id, 4, { hp: 999, maxHp: 999 });
    L.tiles[at(5)] = T.WALL; L.tiles[at(2)] = T.DOOR;
    const mark = markLog(G);
    let first = null, broke = null;
    for (let t = 0; t < 12000 && broke === null; t += 25) {
      Game.update(G.t + 25, 25);
      if (first === null && (L.tiles[at(2)] !== T.DOOR || Object.keys(L.doorBlows || {}).length)) first = G.t;
      if (L.tiles[at(2)] !== T.DOOR) broke = G.t;
    }
    const said = linesSince(G, mark).join(' | ');
    if (broke === null) { out.push(`${id}: the door held for twelve seconds`); continue; }
    const now = L.tiles[at(2)];
    if (want === 'open' && now !== T.DOOR_OPEN) out.push(`${id}: the door is ${now}, not open`);
    if (want !== 'open' && now !== T.FLOOR) out.push(`${id}: the door is ${now}, not splintered`);
    if (want === 'smash' && !/smashes a door to splinters/.test(said)) out.push(`${id} said: ${said}`);
    if (want === 'batter') {
      const speed = ctx.MONSTERS.rat.speed;
      if (!/batters at a shut door/.test(said) || !/buckles: one more blow/.test(said) || !/bursts through a door/.test(said)) out.push(`${id} said: ${said}`);
      if (broke - first < 2 * speed) out.push(`${id}: broke through ${broke - first}ms after its first blow`);
    } else if (broke - first > 100) out.push(`${id}: took ${broke - first}ms at the door`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a fire scroll\'s number, flash and a death wait for the fireball to burst; the blow itself does not', async () => {
  const ctx = await start('fighter', 'scroll-delay');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.tick(10000);
  const fxOf = () => Game.renderState(10000).fx;
  const m = ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  const scroll = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(scroll); G.known.scroll_fire = 1;
  Game.useItem(scroll);
  const out = [];
  if (!(m.hp < 500)) out.push('the fireball did no harm at once');
  const text = fxOf().texts.slice(-1)[0];
  if (!text || !(text.born >= 10000 + 800)) out.push(`the number shows at ${text && text.born}, before the burst`);
  if (!(m.flashAt >= 10000 + 800)) out.push(`the flash starts at ${m.flashAt}`);
  // the bar keeps the goblin's full life until then, and shows the wound after
  const bar = now => Game.renderState(now).sprites.find(s => s.hp != null && s.maxHp === 500);
  if (!bar(10100) || bar(10100).hp !== 500) out.push(`the bar dropped early: ${bar(10100) && bar(10100).hp}`);
  if (!bar(11000) || bar(11000).hp !== m.hp) out.push('the bar never showed the wound');
  // a killing fireball: the goblin still stands, whole, until it lands
  const k = ahead(ctx, 'goblin', 2, { hp: 1, maxHp: 1, nextAct: 1e12 });
  const s2 = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(s2);
  Game.useItem(s2);
  if (Game.level().monsters.includes(k)) out.push('the goblin lived');
  const corpse = fxOf().corpses.slice(-1)[0];
  if (!corpse || !(corpse.born >= 10000 + 800)) out.push(`the goblin fell at ${corpse && corpse.born}, before the burst`);
  // and a blow straight after is shown at once: the delay is the fireball's alone
  const g = ahead(ctx, 'goblin', 1, { hp: 500, maxHp: 500, nextAct: 1e12 });
  p.perkHit = 60; G.t = p.nextAttack; Game.input('attack');
  const t2 = fxOf().texts.slice(-1)[0];
  if (!t2 || t2.born > 10000) out.push(`a sword blow's number waited too: ${t2 && t2.born}`);
  return out.length ? out.join('; ') : true;
});

await test('a spell\'s number waits for the spell to reach its target: darts fly, lightning is there at once', async () => {
  const out = [];
  for (const [id, lo, hi] of [['magic_missile', 300, 350], ['lightning', 0, 0]]) {
    const ctx = await start('mage', 'spell-delay-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.tick(10000);
    ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
    p.level = 9; p.sp = 99; G.t = p.nextAttack;
    const sp = Game.knownSpells().find(s => s.id === id);
    if (!sp) { out.push(`no ${id}`); continue; }
    Game.castSpell(sp);
    const t = Game.renderState(10000).fx.texts.slice(-1)[0];
    const wait = t ? t.born - 10000 : null;
    if (wait === null || wait < lo || wait > hi) out.push(`${id}: its number waits ${wait}ms, wanted ${lo}-${hi}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the quick scroll: fire with a foe ahead, a bolt for a line, frost for what the cold bites, restoration when badly hurt, nothing otherwise, and only one known by sight', async () => {
  const ctx = await start('fighter', 'quick-scroll');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.inv.push({ t: 'scroll_fire', q: 2, e: 0 }, { t: 'scroll_heal', q: 1, e: 0 });
  const out = [];
  if (Game.quickScroll()) out.push('a scroll not known by sight was offered');
  G.known.scroll_fire = 1; G.known.scroll_heal = 1;
  if (Game.quickScroll()) out.push(`offered ${Game.quickScroll().t} with nothing to do`);
  ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  if ((Game.quickScroll() || {}).t !== 'scroll_fire') out.push('no fire with a goblin ahead');
  const before = p.inv.find(i => i.t === 'scroll_fire').q;
  Game.input('read');
  if (p.inv.find(i => i.t === 'scroll_fire').q !== before - 1) out.push('one tap did not read the fire');
  Game.level().monsters.length = 0; p.hp = 1;
  if ((Game.quickScroll() || {}).t !== 'scroll_heal') out.push('no restoration when badly hurt');
  // a bolt for two in a line, never one; frost for what the cold bites, or any foe ahead when hurt
  p.hp = p.maxHp; p.inv = p.inv.filter(i => !/^scroll/.test(i.t));
  p.inv.push({ t: 'scroll_lightning', q: 1, e: 0 }, { t: 'scroll_frost', q: 1, e: 0 }); G.known.scroll_lightning = 1; G.known.scroll_frost = 1;
  const one = ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  if (Game.quickScroll()) out.push(`offered ${Game.quickScroll().t} at one goblin, unhurt`);
  p.hp = Math.floor(p.maxHp / 3);
  if ((Game.quickScroll() || {}).t !== 'scroll_frost') out.push(`hurt, with a goblin ahead, offered ${(Game.quickScroll() || {}).t}`);
  p.hp = p.maxHp; one.id = 'emberling';
  if ((Game.quickScroll() || {}).t !== 'scroll_frost') out.push(`with an emberling ahead, offered ${(Game.quickScroll() || {}).t}`);
  one.id = 'goblin';
  const L = Game.level(), [ddx, ddy] = ctx.Dungeon.DIRS[p.dir];
  L.tiles[(p.y + ddy * 3) * L.w + p.x + ddx * 3] = ctx.Dungeon.T.FLOOR;
  L.monsters.push({ ...one, uid: 777, x: p.x + ddx * 3, y: p.y + ddy * 3 });
  if ((Game.quickScroll() || {}).t !== 'scroll_lightning') out.push(`with two in a line, offered ${(Game.quickScroll() || {}).t}`);
  Game.input('read');
  if (p.inv.some(i => i.t === 'scroll_lightning')) out.push('one tap did not read the bolt');
  if (L.monsters.some(m => m.hp === 500)) out.push('the bolt did not go through both');
  Game.level().monsters.length = 0;
  // an oil, when a fight comes on and the blade is bare: silver for the dead
  p.hp = p.maxHp; p.inv = p.inv.filter(i => i.kind !== 'scroll' && !/^scroll/.test(i.t));
  p.inv.push({ t: 'oil_fire', q: 1, e: 0 }, { t: 'oil_silver', q: 1, e: 0 }, { t: 'oil_frost', q: 1, e: 0 });
  if (Game.quickScroll()) out.push(`offered ${Game.quickScroll().t} with nothing awake`);
  const gob = ahead(ctx, 'goblin', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
  if ((Game.quickScroll() || {}).t !== 'oil_fire') out.push(`with a goblin coming, offered ${(Game.quickScroll() || {}).t}`);
  gob.id = 'emberling';
  if ((Game.quickScroll() || {}).t !== 'oil_frost') out.push(`with an emberling coming, offered ${(Game.quickScroll() || {}).t}`);
  gob.id = 'skeleton';
  if ((Game.quickScroll() || {}).t !== 'oil_silver') out.push(`with a skeleton coming, offered ${(Game.quickScroll() || {}).t}`);
  Game.input('read');
  if (!p.coating || p.coating.t !== 'silver') out.push('one tap did not coat the blade');
  if (Game.quickScroll()) out.push('a coated blade was offered another oil');
  return out.length ? out.join('; ') : true;
});

await test('review fixes: a reload forgets a held life bar, a fleeing beast batters a shut door, a charge blocked short of a door hits nothing', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'reload-bar');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.tick(3600000);
    const m = ahead(ctx, 'ogre', 2, { hp: 500, maxHp: 500, nextAct: 1e12 });
    const s1 = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(s1); G.known.scroll_fire = 1;
    Game.useItem(s1);
    if (!(m.hpShown > 0)) out.push('the fireball held no bar to test with');
    Game.save(true); Game.load();
    const n = Game.level().monsters.find(x => x.uid === m.uid);
    if (n.hpShown || n.flashAt) out.push(`a reload kept flashAt ${n.flashAt}, hpShown ${n.hpShown}`);
  }
  {
    const ctx = await start('fighter', 'flee-door');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    const at = (k, j = 0) => (p.y + dy * k + sy * j) * L.w + p.x + dx * k + sx * j;
    for (let k = 1; k <= 5; k++) { L.tiles[at(k, 1)] = T.WALL; L.tiles[at(k, -1)] = T.WALL; }
    ahead(ctx, 'rat', 1, { hp: 999, maxHp: 999, fleeing: true });
    for (let k = 1; k <= 4; k++) L.tiles[at(k)] = T.FLOOR;
    L.tiles[at(2)] = T.DOOR; L.tiles[at(5)] = T.WALL;
    let inDoor = false;
    for (let t = 0; t < 3000; t += 25) { Game.update(G.t + 25, 25); const r = Game.level().monsters[0]; if (r && L.tiles[r.y * L.w + r.x] === T.DOOR) inDoor = true; }
    if (inDoor) out.push('a fleeing rat stood inside a shut door');
  }
  {
    const ctx = await start('fighter', 'charge-blocked');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const orc = ahead(ctx, 'orc', 5, { hp: 999, maxHp: 999 });
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy * 2) * L.w + p.x + dx * 2] = Dungeon.T.DOOR;
    // a goblin stands between the orc and the door
    L.monsters.push({ uid: 96, id: 'goblin', x: p.x + dx * 4, y: p.y + dy * 4, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    orc.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t, dx: -dx, dy: -dy }; orc.nextAct = G.t;
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (linesSince(G, mark).some(l => /slams into the shut door/.test(l))) out.push('a charge stopped by a goblin still slammed into the door');
  }
  return out.length ? out.join('; ') : true;
});

await test('a thrown knife is seen to fly, and what it does waits until it arrives', async () => {
  const ctx = await start('thief', 'knife-flight');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.tick(10000);
  p.eq.weapon = { t: 'throwknife', q: 1, e: 0 }; p.perkHit = 60;
  ahead(ctx, 'goblin', 3, { hp: 500, maxHp: 500, nextAct: 1e12 });
  G.t = p.nextAttack; Game.input('attack');
  const f = Game.renderState(10000).fx;
  const knife = f.spells.find(s => s.style === 'knife');
  if (!knife) return 'no knife in flight';
  const text = f.texts.slice(-1)[0];
  if (!text) return 'the knife did nothing';
  // it leaves the hand part way through the throw and crosses three squares
  if (!(knife.born > 10000 && text.born >= knife.until - 1)) return `the knife flies ${knife.born}-${knife.until}, its number shows at ${text.born}`;
  return true;
});

await test('a trap going off is seen: each kind its own picture, and one spotted is seen jammed', async () => {
  const out = [];
  for (const kind of ['dart', 'needle', 'pit', 'alarm', 'spotted']) {
    const ctx = await start(kind === 'spotted' ? 'thief' : 'fighter', 'trap-' + kind, { traps: true });
    const { Game, Dungeon } = ctx; const p = Game.player(), L = Game.level(), G = Game.state();
    Game.tick(5000);
    p.hp = p.maxHp = 999; p.stats.wis = 3; p.bg = 'oathbroken';
    if (kind === 'spotted') { p.level = 20; p.stats.wis = 18; }   // a seasoned, sharp-eyed thief: sees it but on a one
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    L.traps = L.traps || {};
    let now = 5000;
    for (let i = 0; i < (kind === 'spotted' ? 8 : 1); i++) {
      now = 5000 + i * 2000;
      p.x = x0; p.y = y0; Game.update(G.t + 600, 600); Game.tick(now);
      L.traps[`${x},${y}`] = kind === 'spotted' ? 'dart' : kind;
      Game.input('forward');
      if (kind !== 'spotted' || Game.renderState(now).fx.trapKind === 'disarm') break;
    }
    const f = Game.renderState(now).fx, want = kind === 'spotted' ? 'disarm' : kind;
    if (f.trapKind !== want || f.trapAt !== now) out.push(`${kind}: shown as ${f.trapKind} at ${f.trapAt}`);
    // a fall shakes the view longer than a blow does, harm and all
    if (kind === 'pit' && !(f.shakeMs === 700 && f.shakeUntil === now + 700)) out.push(`the pit shook for ${f.shakeMs}ms, not a fall's 700`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a trap is dodged with Dexterity (a pit only halved), and venom fought off with Constitution', async () => {
  const out = [];
  // walk onto a trap of this kind over and over; count what happened
  const tally = async (kind, stats, n = 80) => {
    const ctx = await start('fighter', 'saves-' + kind + stats.dex + stats.con, { traps: true });
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    Object.assign(p.stats, stats); p.bg = 'oathbroken'; p.stats.wis = 3;
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    const r = { dodged: 0, poisoned: 0, hurt: 0, worst: 0, halved: 0 };
    for (let i = 0; i < n; i++) {
      p.x = x0; p.y = y0; p.hp = p.maxHp = 999; p.poison = null;
      Game.update(G.t + 600, 600);
      L.traps[`${x},${y}`] = kind;
      const mark = markLog(G);
      Game.input('forward');
      const said = linesSince(G, mark).join(' | ');
      if (/twist aside|snatch your foot/.test(said)) r.dodged++;
      if (/catch the edge/.test(said)) { r.halved++; r.worst = Math.max(r.worst, 999 - p.hp); }
      if (p.hp < 999) r.hurt++;
      if (/twist aside|snatch your foot/.test(said) && p.hp < 999) out.push(`${kind}: dodged, yet hurt`);
      if (p.poison) r.poisoned++;
    }
    return r;
  };
  const clumsy = await tally('dart', { dex: 3, con: 10 }), nimble = await tally('dart', { dex: 20, con: 10 });
  if (!(nimble.dodged > clumsy.dodged + 15)) out.push(`darts dodged: nimble ${nimble.dodged}, clumsy ${clumsy.dodged}`);
  const pit = await tally('pit', { dex: 20, con: 10 });
  if (!pit.halved) out.push('no pit was ever caught at its edge');
  if (pit.worst > 6) out.push(`a pit caught at the edge still did ${pit.worst}`);
  if (pit.hurt !== 80) out.push('a pit was escaped whole');
  const frail = await tally('needle', { dex: 3, con: 3 }), hale = await tally('needle', { dex: 3, con: 18 });
  if (!(frail.poisoned > hale.poisoned + 10)) out.push(`needle poison: frail ${frail.poisoned}, hale ${hale.poisoned}`);
  return out.length ? out.join('; ') : true;
});

await test('saving throws: the claw, the gaze, the web, the charge and the lich\'s drain are weathered by the right score', async () => {
  const out = [];
  // one trick, landed over and over on a hero with this score; what it did each time
  const trials = async (id, move, dist, stat, value, measure) => {
    const ctx = await start('fighter', `sv-${move}-${value}`);
    seedDice(ctx, `sv-${move}-${value}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats[stat] = value; p.hp = p.maxHp = 9999;
    const results = [];
    // enough tries that a save's halving shows through the dice: forty let a
    // weak and a strong gaze come out within a fifth of each other one run in ten
    for (let i = 0; i < 120; i++) {
      p.held = 0; p.heldBy = ''; p.webbed = 0; p.grabbed = null; p.maxHp = 9999; p.hp = 9999;
      const m = ahead(ctx, id, dist, { hp: 999, maxHp: 999, blows: 5, spoke: true });
      if (move === 'melee') { m.windup = { kind: 'melee', at: G.t, until: G.t }; p.effects.ac = { amount: -30, until: 1e12 }; }
      else m.windup = { kind: 'move', move, at: G.t, until: G.t, dx: -ctx.Dungeon.DIRS[p.dir][0], dy: -ctx.Dungeon.DIRS[p.dir][1] };
      m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      results.push(measure(p, G));
      Game.update(G.t + 6000, 6000);
    }
    return results;
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  const heldFor = (p, G) => Math.max(0, (p.held || 0) - G.t);
  const cmp = async (label, id, move, dist, stat, measure) => {
    const lo = sum(await trials(id, move, dist, stat, 3, measure)), hi = sum(await trials(id, move, dist, stat, 20, measure));
    if (!(lo > hi * 1.2)) out.push(`${label}: weak ${lo}, strong ${hi}`);
  };
  await cmp('claw (con)', 'ghoul', 'paralyse', 1, 'con', (p, G) => (p.held > G.t && p.heldBy === 'frozen') ? 1 : 0);
  await cmp('gaze (con)', 'basilisk', 'gaze', 2, 'con', heldFor);
  await cmp('web (dex)', 'spider', 'web', 2, 'dex', (p, G) => Math.max(0, (p.webbed || 0) - G.t));
  await cmp('charge (str)', 'orc', 'charge', 3, 'str', (p, G) => (p.held > G.t && p.heldBy === 'down') ? 1 : 0);
  await cmp('drain (wis)', 'lich', 'melee', 1, 'wis', p => 9999 - p.maxHp);
  return out.length ? out.join('; ') : true;
});

await test('a mage draws a spell point back from each foe a spell destroys, but not from a blow', async () => {
  const out = [];
  const ctx = await start('mage', 'draw-back');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const missile = Game.knownSpells().find(s => s.id === 'magic_missile');
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  // below the most the mage can hold, whatever its rolled Intelligence
  const sp0 = p.sp = p.maxSp - 3; G.t = p.nextAttack; Game.castSpell(missile);
  if (Game.level().monsters.length) out.push('the missile did not kill');
  else if (p.sp !== sp0 - missile.cost + 1) out.push(`a spell kill left ${p.sp} points, wanted ${sp0 - missile.cost + 1}`);
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  p.sp = sp0;
  for (let i = 0; i < 10 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.length) out.push('the staff did not kill');
  else if (p.sp !== sp0) out.push(`a staff kill gave points: ${p.sp}`);
  // never past the most a mage can hold
  beside(ctx, 'goblin', { hp: 1, maxHp: 1 });
  p.sp = p.maxSp; G.t = p.nextAttack; Game.castSpell(missile);
  if (p.sp > p.maxSp) out.push('a spell kill overfilled the points');
  return out.length ? out.join('; ') : true;
});

await test('more ways to answer: a blow knocks a ghoul\'s claw aside, fire burns a web, a shut door stops a charge', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'claw-aside');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.perkHit = 60;
    const m = beside(ctx, 'ghoul', { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'paralyse', at: G.t, until: G.t + 750 }; m.nextAct = m.windup.until;
    for (let i = 0; i < 5 && m.windup; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (m.windup) out.push('blows did not knock the claw aside');
    else { run(Game, G, 900); if (p.held > G.t) out.push('the hero was frozen by a claw knocked aside'); }
  }
  {
    // poison already in it is not a blow: the claw still closes
    const ctx = await start('thief', 'claw-venom');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'ghoul', { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'paralyse', at: G.t, until: G.t + 750 }; m.nextAct = m.windup.until;
    m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 100 };
    run(Game, G, 300);
    if (m.dot && m.dot.next <= G.t) out.push('the venom did not tick');
    if (!m.windup) out.push('a tick of venom knocked the claw aside');
  }
  {
    const ctx = await start('mage', 'web-burn');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.level().monsters.length = 0;
    p.webbed = G.t + 5000; p.sp = 99; G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'burning_hands'));
    if (p.webbed > G.t) out.push('Burning Hands left the web whole');
  }
  {
    const ctx = await start('fighter', 'door-charge');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'orc', 4, { hp: 999, maxHp: 999 });
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy * 2) * L.w + p.x + dx * 2] = Dungeon.T.DOOR;
    m.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t, dx: -dx, dy: -dy }; m.nextAct = G.t;
    const hp0 = p.hp, mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (p.hp < hp0) out.push('the charge came through the door');
    if (!linesSince(G, mark).some(l => /slams into the shut door/.test(l))) out.push(`said: ${linesSince(G, mark).join(' | ')}`);
    if (!p.opening || p.opening.uid !== m.uid) out.push('the door left no opening');
  }
  return out.length ? out.join('; ') : true;
});

await test('a spider\'s web holds the hero until they tear free, and misses a hero who steps aside', async () => {
  const ctx = await start('fighter', 'web');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = ahead(ctx, 'spider', 3);
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'web') return `it drew ${JSON.stringify(m.windup)}`;
  run(Game, G, 700);
  if (!(p.webbed > G.t)) return 'the web did not hold the hero';
  m.nextAct = 1e12;
  clearBehind(ctx);
  const x0 = p.x, y0 = p.y;
  Game.input('back');
  if (p.x !== x0 || p.y !== y0) return 'the hero walked straight out of the web';
  let pushes = 1;
  while ((p.x === x0 && p.y === y0) && pushes < 40) { Game.update(G.t + 50, 50); Game.input('back'); pushes++; }
  if (pushes >= 40) return 'pushing never tore the web';
  // and a web dodged
  const c2 = await start('fighter', 'web-dodge');
  const m2 = ahead(c2, 'spider', 3);
  c2.Game.update(c2.Game.state().t + 25, 25);
  shift(c2, 'side');
  run(c2.Game, c2.Game.state(), 700);
  if (c2.Game.player().webbed > c2.Game.state().t) return 'a web held a hero who had stepped out of its line';
  return pushes >= 3 || `the web tore after only ${pushes} pushes`;
});

await test('a zombie\'s grip holds a weak hero more often than a strong one, and ends when it falls', async () => {
  const tries = async str => {
    const ctx = await start('fighter', 'grab-' + str);
    ctx.Dice.s = new ctx.Rng('grab-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.stats.str = str; p.stats.dex = 3;              // no quickness to slip out with: strength decides
    const z = beside(ctx, 'zombie', { nextAct: 1e12 });
    clearBehind(ctx);                              // room to step back into
    const home = [p.x, p.y];
    let held = 0;
    for (let i = 0; i < 60; i++) {
      [p.x, p.y] = home;
      const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
      z.x = p.x + dx; z.y = p.y + dy;
      p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
      Game.update(G.t + 400, 400);
      Game.input('back');
      if (p.x === home[0] && p.y === home[1]) held++;
    }
    return { held, ctx, z };
  };
  const weak = await tries(3), strong = await tries(18);
  if (!(weak.held > strong.held + 10)) return `a weak hero was held ${weak.held} of 60 times, a strong one ${strong.held}`;
  // killing the zombie frees the hero
  const { ctx, z } = weak, G = ctx.Game.state(), p = ctx.Game.player();
  p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
  ctx.Game.level().monsters.length = 0;
  ctx.Game.update(G.t + 25, 25);
  return !p.grabbed || 'the grip outlived the zombie';
});

await test('a zombie\'s hit can take hold of the hero', async () => {
  const ctx = await start('fighter', 'grab-hit');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  beside(ctx, 'zombie');
  await pinned(0, () => { for (let i = 0; i < 400 && !p.grabbed; i++) Game.update(G.t + 25, 25); });
  return !!p.grabbed || 'ten seconds of zombie blows and never a grip';
});

await test('a ghoul\'s touch can freeze the hero: no step, swing or spell until it passes', async () => {
  const ctx = await start('fighter', 'paralyse');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.con = 3;
  const m = beside(ctx, 'ghoul');
  await pinned(0, () => { for (let i = 0; i < 800 && !(p.held > G.t); i++) Game.update(G.t + 25, 25); });
  if (!(p.held > G.t)) return 'twenty seconds of ghoul blows and never frozen';
  m.nextAct = 1e12;
  const x0 = p.x, next0 = p.nextAttack;
  G.t = Math.max(G.t, p.nextAttack - 1);
  Game.input('back'); Game.input('attack');
  if (p.x !== x0 || p.nextAttack !== next0) return 'a frozen hero still acted';
  Game.update(G.t + 1400, 1400);
  return !(p.held > G.t) || 'the freeze never wore off';
});

await test('a slime struck hard splits into two in its square, once', async () => {
  const ctx = await start('fighter', 'split');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const m = beside(ctx, 'slime', { hp: 30, maxHp: 30, nextAct: 1e12 });
  G.t = p.nextAttack; Game.input('attack');
  if (!m.pack || m.pack.length !== 1) return `after one blow: ${JSON.stringify({ hp: m.hp, pack: m.pack })}`;
  const total = m.hp + m.pack[0].hp;
  if (total >= 30 || total < 1) return `the halves hold ${total} of what was left`;
  // cut down the front half: the other steps up, and does not split again
  m.hp = 1; G.t = p.nextAttack; Game.input('attack');
  if (m.pack) return 'the front half did not fall';
  G.t = p.nextAttack; Game.input('attack');
  return !m.pack || 'a slime split a second time';
});

await test('a skeleton cut down by an edge rises again unless its bones are smashed; a mace keeps it down', async () => {
  const edge = await start('fighter', 'rise');
  const { Game } = edge;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  p.eq.weapon = { t: 'longsword', q: 1, e: 0 };
  const m = beside(edge, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  // (a natural 1 misses whatever the bonus: swing until the blow lands)
  const swing = (g, gs, hero, until) => { for (let k = 0; k < 8 && !until(); k++) { gs.t = hero.nextAttack; g.input('attack'); } };
  swing(Game, G, p, () => m.collapsed || !L.monsters.includes(m));
  if (!L.monsters.includes(m) || !m.collapsed) return 'a sword-felled skeleton did not fall into a heap';
  run(Game, G, 5000);
  if (m.collapsed || m.hp !== 10) return `after the wait: collapsed ${m.collapsed}, hp ${m.hp}`;
  // the second time it stays down
  m.hp = 1; m.nextAct = 1e12;
  swing(Game, G, p, () => !L.monsters.includes(m) || m.collapsed);
  if (L.monsters.includes(m)) return 'it rose a second time';
  // smashing the heap ends it
  const heap = await start('fighter', 'rise-smash');
  const hp2 = heap.Game.player(), G2 = heap.Game.state(), L2 = heap.Game.level();
  hp2.perkHit = 60; hp2.eq.weapon = { t: 'longsword', q: 1, e: 0 };
  const m2 = beside(heap, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  swing(heap.Game, G2, hp2, () => m2.collapsed || !L2.monsters.includes(m2));
  hp2.perkHit = -100;                                 // a hero who could hit nothing still hits a heap
  G2.t = hp2.nextAttack; heap.Game.input('attack');
  if (L2.monsters.includes(m2)) return 'striking the heap did not scatter it';
  // a mace crushes it outright
  const blunt = await start('cleric', 'rise-mace');
  const bp = blunt.Game.player(), G3 = blunt.Game.state(), L3 = blunt.Game.level();
  bp.perkHit = 60; bp.eq.weapon = { t: 'mace', q: 1, e: 0 };
  const m3 = beside(blunt, 'skeleton', { hp: 1, maxHp: 20, nextAct: 1e12 });
  swing(blunt.Game, G3, bp, () => m3.collapsed || !L3.monsters.includes(m3));
  return !L3.monsters.includes(m3) || 'a mace left the skeleton able to rise';
});

await test('fire stops a troll growing back; other magic does not', async () => {
  const regrows = async spellId => {
    const ctx = await start('mage', 'troll-' + spellId);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.sp = p.maxSp = 99;
    const m = beside(ctx, 'troll', { hp: 200, maxHp: 400, nextAct: 1e12 });
    G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === spellId));
    const after = m.hp;
    run(Game, G, 4000);
    return m.hp - after;
  };
  const burnt = await regrows('burning_hands'), zapped = await regrows('magic_missile');
  return (burnt === 0 && zapped >= 3) || `after fire it grew back ${burnt}, after a missile ${zapped}`;
});

await test('a dark acolyte chants to mend the wounded, and a blow breaks the chant', async () => {
  const ctx = await start('fighter', 'mend');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const m = beside(ctx, 'acolyte', { hp: 20, maxHp: 100 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'mend') return `it drew ${JSON.stringify(m.windup)}`;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (m.windup) return 'the blow did not break the chant';
  const hp1 = m.hp;
  // left alone it finishes
  const c2 = await start('fighter', 'mend-free');
  const m2 = beside(c2, 'acolyte', { hp: 20, maxHp: 100 });
  const G2 = c2.Game.state();
  c2.Game.player().hp = 9999;
  c2.Game.update(G2.t + 25, 25);
  run(c2.Game, G2, 2000);
  return (m2.hp > 20 && hp1 < 20) || `unbroken it reached ${m2.hp}; broken, ${hp1}`;
});

await test('the lich\'s cold fire breaks short of a hero who gets clear, and it calls up guards as it weakens', async () => {
  const ctx = await start('fighter', 'nova');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = beside(ctx, 'lich', { blows: 2, hp: 300, maxHp: 300 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'nova') return `it drew ${JSON.stringify(m.windup)}`;
  shift(ctx, 'back'); shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 1350);
  if (p.hp < hp0) return `the nova reached a hero three squares off for ${hp0 - p.hp}`;
  if (!linesSince(G, mark).some(l => /breaks short of you/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  // wound it past two thirds: the dead rise
  m.nextAct = 1e12; m.hp = 150;
  p.perkHit = 60;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  const guards = L.monsters.filter(o => o.id === 'skeleton');
  if (!(guards.length === 1 && guards[0].pack && guards[0].pack.length === 1)) return `guards: ${JSON.stringify(guards.map(g => g.pack))}`;
  if (L.monsters.some(o => o.id === 'wraith')) return 'a wraith rose at two thirds, before the last act';
  // and past one third: more dead, and a wraith with them
  // (it came apart into shadow at two thirds: bring it back in reach, its ward spent)
  for (let i = 0; i < 8 && m.phase !== 2; i++) {
    m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.wardUntil = 0; m.hp = Math.min(m.hp, 60); m.nextAct = 1e12;
    G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  }
  if (m.phase !== 2) return 'the lich never reached its last act';
  const w = L.monsters.filter(o => o.id === 'wraith').length;
  return w === 1 || `${w} wraiths rose with the last act, not one`;
});
};
