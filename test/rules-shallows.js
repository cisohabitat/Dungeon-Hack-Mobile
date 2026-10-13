// Rule checks for the shallows' own creatures: one for each of the first four
// floors, each asking for something other than a step back.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function shallowsChecks(h) {
  const { start, markLog, linesSince, test, beside, ahead, clearBehind, shift, run, untilTrick } = h;

await test('the shallows\' four are dealt on their own floors of an eight-floor delve: the moth from the first, the hog the second, the imp the third, the pikeman the fourth', async () => {
  const { Dungeon, MONSTERS } = await start('fighter', 'shallow-deal');
  const out = [];
  const first = { moth: 1, thornhog: 2, imp: 3, pikeman: 4 };
  for (const id in first) {
    let f = 1;
    while (Dungeon.tierAt(f, 8) < MONSTERS[id].tier[0]) f++;
    if (f !== first[id]) out.push(`${id} first met on floor ${f}`);
  }
  // and they are met there, not only allowed
  const seen = {};
  for (let i = 0; i < 40; i++) for (let depth = 1; depth <= 4; depth++) {
    const L = Dungeon.generate(`shallow-${i}`, depth, { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' });
    for (const m of L.monsters) if (first[m.id]) { seen[m.id] = seen[m.id] || {}; seen[m.id][depth] = (seen[m.id][depth] || 0) + 1; }
  }
  for (const id in first) {
    const s = seen[id] || {};
    if (!s[first[id]]) out.push(`no ${id} on floor ${first[id]} in forty: ${JSON.stringify(s)}`);
    if (Object.keys(s).some(d => +d < first[id])) out.push(`a ${id} above its floor: ${JSON.stringify(s)}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a glimmer moth\'s flare dazzles a hero looking at it, and their blows go wide; one who turns away is spared and finds it open', async () => {
  const out = [];
  for (const away of [false, true]) {
    const ctx = await start('fighter', 'dazzle' + away);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const hit0 = Game.toHit();
    const m = ahead(ctx, 'moth', 2, { hp: 999, maxHp: 999 });
    m.windup = { kind: 'move', move: 'dazzle', at: G.t, until: G.t + 1100 }; m.nextAct = m.windup.until;
    if (away) Game.input('left');
    const mark = markLog(G);
    run(Game, G, 1200);
    const said = linesSince(G, mark).join(' | ');
    if (away) {
      if ((p.dazzled || 0) > G.t) out.push(`turned away and still dazzled: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push('turning away left no opening');
    } else {
      if (!((p.dazzled || 0) > G.t)) { out.push(`looked and was not dazzled: ${said}`); continue; }
      if (Game.toHit() !== hit0 - 4) out.push(`dazzled, the blow is ${Game.toHit()} against ${hit0}`);
      if (p.opening && p.opening.uid === m.uid) out.push('looking still left it open');
      // and it fades
      run(Game, G, 4100);
      if ((p.dazzled || 0) > G.t || Game.toHit() !== hit0) out.push('the dazzle never faded');
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a thornhog\'s raised quills bite a hand that strikes it, lighter than a quillback\'s; one who holds their blow finds it open', async () => {
  const out = [];
  let struck = false, worst = 0;
  for (let tries = 0; tries < 12; tries++) {
    const ctx = await start('fighter', 'hogquills' + tries);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.str = 30;
    const m = beside(ctx, 'thornhog', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the thornhog never raised its quills';
    const hp0 = p.hp, mark = markLog(G);
    p.nextAttack = 0; Game.input('attack');
    const said = linesSince(G, mark).join(' | ');
    if (!/You hit|mighty blow/.test(said)) continue;
    struck = true;
    if (!(p.hp < hp0) || !/quills/.test(said)) out.push(`a blow into the raised quills cost nothing: ${said}`);
    worst = Math.max(worst, hp0 - p.hp);
  }
  if (!struck) out.push('no blow landed in twelve tries');
  if (worst > 4) out.push(`on the first floor the quills bit for ${worst}, more than a d4`);
  {
    const ctx = await start('fighter', 'hogquills-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, 'thornhog', { blows: 1 });
    if (!untilTrick(ctx, m, 'bristle')) return 'the thornhog never raised its quills';
    const hp0 = p.hp;
    run(Game, G, 1500);
    if (p.hp < hp0) out.push('holding the blow still cost hit points');
    if (!p.opening || p.opening.uid !== m.uid) out.push('holding the blow left no opening');
  }
  return out.length ? out.join('; ') : true;
});

await test('a gutter imp steps back into the world at your back: turned to face it, it is caught open; not, it bites, lighter than a hound', async () => {
  const out = [], missed = [];
  let bitten = false;
  for (const turn of [false, false, false, true]) {
    if (!turn && bitten) continue;
    const ctx = await start('fighter', 'imp' + turn + missed.length);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    clearBehind(ctx);
    const m = beside(ctx, 'imp', { blows: 1 });
    if (!untilTrick(ctx, m, 'blink')) return 'the imp never blinked';
    const [bx, by] = Dungeon.DIRS[(p.dir + 2) % 4];
    if (m.x !== p.x + bx || m.y !== p.y + by) { out.push(`it came back at ${m.x},${m.y}, not at the hero's back`); continue; }
    if (turn) { Game.input('left'); Game.update(G.t + 250, 250); Game.input('left'); }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 950);
    const said = linesSince(G, mark).join(' | ');
    if (turn) {
      if (p.hp < hp0) out.push(`faced it and was still bitten: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`facing it left no opening: ${said}`);
    } else if (p.hp < hp0 && /sinks its teeth into you/.test(said)) {
      bitten = true;
      // its own bite (1d4+1) with a warned trick's 3 and a d4 more: never a hound's
      if (hp0 - p.hp > 5 + 3 + 4 + 4) out.push(`its bite took ${hp0 - p.hp}`);
    } else missed.push(said);
  }
  if (!bitten) out.push(`left at its back three times, it never bit: ${missed.join(' || ')}`);
  return out.length ? out.join('; ') : true;
});

await test('a goblin pikeman\'s pike reaches two and three squares down its line: in under the point or out of the line it misses and leaves it open; a step back does not', async () => {
  const out = [];
  for (const how of ['stay', 'back', 'close', 'aside']) {
    const ctx = await start('fighter', 'pike-' + how);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = ahead(ctx, 'pikeman', 2, { hp: 999, maxHp: 999 });
    const [fx, fy] = Dungeon.DIRS[p.dir];
    m.windup = { kind: 'move', move: 'thrust', at: G.t, until: G.t + 900, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    if (how === 'back') shift(ctx, 'back');
    if (how === 'aside') shift(ctx, 'aside');
    if (how === 'close') { p.x += fx; p.y += fy; }
    const hp0 = p.hp, mark = markLog(G);
    run(Game, G, 950);
    const said = linesSince(G, mark).join(' | ');
    const hurt = p.hp < hp0;
    if (how === 'stay' || how === 'back') { if (!hurt || !/pike/.test(said)) out.push(`${how === 'back' ? 'a step back' : 'standing in its line'} escaped the pike: ${said}`); }
    else {
      if (hurt) out.push(`${how === 'close' ? 'in under the point' : 'out of its line'}, still struck: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push(`${how}: no opening`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('the pikeman levels its pike only at a hero two or three squares off down a clear line, never beside it', async () => {
  const out = [];
  for (const dist of [1, 2, 3, 4]) {
    const ctx = await start('fighter', 'pikeat' + dist);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    let levelled = 0;
    for (let i = 0; i < 40; i++) {
      const m = dist === 1 ? beside(ctx, 'pikeman', { blows: 1, nextAct: G.t }) : ahead(ctx, 'pikeman', dist, { hp: 999, maxHp: 999, nextAct: G.t, moveReady: 0 });
      // (held where it stands: a pikeman that walks up is a different question)
      m.moveReady = 0; m.speed = 1;
      Game.update(G.t + 25, 25);
      if (m.windup && m.windup.move === 'thrust') levelled++;
      Game.update(G.t + 3000, 3000); p.hp = p.maxHp;
    }
    if ((dist === 2 || dist === 3) && !levelled) out.push(`at ${dist} squares it never levelled its pike`);
    if ((dist === 1 || dist === 4) && levelled) out.push(`at ${dist} squares it levelled its pike ${levelled} times`);
  }
  return out.length ? out.join('; ') : true;
});
};
