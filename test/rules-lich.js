// Rule checks for the lich.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function lichChecks(h) {
  const { start, markLog, linesSince, test, beside, lichRoom, woundTo } = h;

// ---------- the lich ----------

await test('the lich speaks when it wakes, and its life shows across the top of the view', async () => {
  const ctx = await start('fighter', 'lich-wake');
  const { Game } = ctx; const G = Game.state();
  const { m } = lichRoom(ctx, { spoke: false, awake: true, nextAct: G.t + 5000 });
  if (Game.renderState(0).fx.boss) return 'the bar showed before the lich spoke';
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (!linesSince(G, mark).some(l => /A cold voice/.test(l))) return `it said: ${linesSince(G, mark).join(' | ')}`;
  const b = Game.renderState(0).fx.boss;
  return (b && b.hp === m.hp && b.maxHp === m.maxHp && b.name === 'Dread Lich') || JSON.stringify(b);
});

await test('at two thirds the lich raises guards, steps back out of reach and throws grave-cold', async () => {
  const ctx = await start('fighter', 'lich-phase1');
  const { Game } = ctx; const p = Game.player(), L = Game.level();
  const { m } = lichRoom(ctx);
  if (Game.mstat(m).ranged) return 'the lich threw from afar before it was wounded';
  woundTo(ctx, m, m.maxHp * 2 / 3);
  if (m.phase !== 1) return `phase ${m.phase} at ${m.hp}/${m.maxHp}`;
  if (!L.monsters.some(o => o.id === 'skeleton')) return 'no guards rose';
  const d = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
  if (d < 2) return `it stayed ${d} step from the hero`;
  const r = Game.mstat(m).ranged;
  return (r && r.range >= 4) || 'it has nothing to throw';
});

await test('at one third the lich puts out its torches and quickens; they catch again when it falls', async () => {
  const ctx = await start('fighter', 'lich-phase2');
  const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
  const { m, torch } = lichRoom(ctx, { phase: 1 });
  if (!torch) return 'no wall for a torch in the test room';
  const lights = L.lights.length, slow = Game.mstat(m).speed;
  woundTo(ctx, m, m.maxHp / 3);
  if (m.phase !== 2) return `phase ${m.phase}`;
  if (L.tiles[torch[1] * L.w + torch[0]] === T.TORCH) return 'the torch still burns';
  if (L.lights.length >= lights) return `${L.lights.length} lights of ${lights} still lit`;
  if (!(Game.mstat(m).speed < slow)) return `speed ${Game.mstat(m).speed}, was ${slow}`;
  // now finish it
  m.hp = 1; m.windup = null;
  const p = Game.player(), G = Game.state();
  for (let i = 0; i < 40 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (L.monsters.includes(m)) return 'the lich would not die';
  if (L.tiles[torch[1] * L.w + torch[0]] !== T.TORCH) return 'the torch stayed dark after the lich fell';
  return L.lights.length === lights || `${L.lights.length} lights after, ${lights} before`;
});

await test('grave-cold breaks on a mage\'s own Shield; a cleric\'s Protection and bare skin take it', async () => {
  const out = [];
  for (const [cls, src] of [['mage', null], ['mage', 'shield'], ['cleric', 'protection']]) {
    const ctx = await start(cls, 'shield-cold');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = T.FLOOR; L.tiles[(p.y + 2 * dy) * L.w + p.x + 2 * dx] = T.FLOOR;
    L.monsters.length = 0;
    // it cannot miss but on a 1, so three bolts are sure to land at least once
    const m = { uid: 91, id: 'lich', x: p.x + 2 * dx, y: p.y + 2 * dy, hp: 999, maxHp: 999, awake: true, spoke: true, phase: 1, edge: 40, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    let hurt = 0, broke = 0;
    for (let i = 0; i < 3; i++) {
      p.effects = src ? { ac: { amount: 4, until: G.t + 60000, src } } : {};
      const before = p.hp, mark = markLog(G);
      m.windup = { kind: 'shot', at: G.t, until: G.t }; m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      if (m.windup) { out.push(`${cls}/${src}: the bolt never flew`); break; }
      if (p.hp < before) hurt++;
      if (linesSince(G, mark).some(l => /breaks on your Shield/.test(l))) broke++;
      G.t += 2000; m.nextAct = 1e12;
    }
    if (src === 'shield' ? hurt || !broke : !hurt || broke) out.push(`${cls} with ${src || 'nothing'}: wounded ${hurt} times, broke on the Shield ${broke} times`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a mage\'s spell pulls the lich\'s shadow apart; a fighter\'s blow and a cleric\'s prayer do not', async () => {
  const out = [];
  for (const [cls, spell] of [['mage', 'magic_missile'], ['fighter', null], ['cleric', 'smite']]) {
    const ctx = await start(cls, 'unravel');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.maxSp = 99; p.sp = cls === 'mage' ? 50 : 99; p.level = 5; p.perkHit = 60;
    // in play a warded lich waits out its shadow: it next acts when the shadow lifts
    const m = beside(ctx, 'lich', { hp: 120, maxHp: 120, spoke: true, phase: 1, wardUntil: G.t + 4000, nextAct: G.t + 4000 });
    G.t = p.nextAttack;
    if (spell) { if (!Game.castSpell(Game.knownSpells().find(s => s.id === spell))) { out.push(`${cls} could not cast ${spell}`); continue; } }
    else Game.input('attack');
    const bare = !(m.wardUntil > G.t);
    if (bare !== (cls === 'mage')) out.push(`${cls}: the shadow ${bare ? 'came apart' : 'held'}`);
    if (cls === 'mage' && bare && m.nextAct - G.t > 1000) out.push(`the bared lich still waits ${m.nextAct - G.t} ms to act`);
    if (cls === 'mage' && bare && p.sp !== 50 - 2 + 33) out.push(`the mage came away with ${p.sp} of ${p.maxSp} spell points`);
    if (m.hp !== 120) out.push(`${cls}: the lich was wounded to ${m.hp} through or by the unravelling`);
  }
  return out.length ? out.join('; ') : true;
});

await test('in the dark the wounded lich drinks from the Heart unless struck; a blow breaks the rite', async () => {
  const out = [];
  {
    // let the rite finish: a fifth of its life comes back
    const ctx = await start('fighter', 'lich-rite');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const { m } = lichRoom(ctx, { phase: 2, hp: 30, riteReady: 0, nextAct: G.t, awake: true });
    for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
    if (!(m.windup && m.windup.move === 'rite')) out.push(`it never began the rite (${JSON.stringify(m.windup)})`);
    else {
      const before = m.hp;
      for (let i = 0; i < 200 && m.windup && m.windup.move === 'rite'; i++) Game.update(G.t + 25, 25);
      if (m.hp - before !== Math.ceil(m.maxHp * 0.2)) out.push(`the rite mended ${m.hp - before}`);
    }
  }
  {
    const ctx = await start('fighter', 'lich-rite-broken');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.perkHit = 60;
    const { m } = lichRoom(ctx, { phase: 2, hp: 60, riteReady: 0, nextAct: G.t, awake: true });
    for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25);
    const mark = markLog(G);
    for (let i = 0; i < 20 && m.windup && m.windup.move === 'rite'; i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (m.windup && m.windup.move === 'rite') out.push('blows did not break the rite');
    else if (!linesSince(G, mark).some(l => /break the Dread Lich's rite/.test(l))) out.push(`said: ${linesSince(G, mark).join(' | ')}`);
    if (m.hp > 60) out.push(`it mended to ${m.hp} though the rite was broken`);
  }
  return out.length ? out.join('; ') : true;
});
};
