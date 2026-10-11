// Rule checks for the end of a run, with the seventh round's review and playtest fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function endgameChecks(h) {
  const { start, markLog, linesSince, test, beside, run, lichRoom, woundTo } = h;

// ---------- the end ----------
await test('no trap lies in the lich\'s hall or at its mouth', async () => {
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  const o = { levels: 8, size: 'normal', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
  for (let i = 0; i < 30; i++) {
    const L = Dungeon.generate('hall-traps' + i, 8, o), lich = L.monsters.find(m => m.id === 'lich');
    if (!lich) continue;
    for (const k of Object.keys(L.traps)) {
      const [x, y] = k.split(',').map(Number);
      if (Math.abs(x - lich.x) + Math.abs(y - lich.y) <= 4) return `seed hall-traps${i}: a ${L.traps[k]} ${Math.abs(x - lich.x) + Math.abs(y - lich.y)} squares from the lich`;
    }
  }
  return true;
});

await test('stepping onto the Heart while the lich holds it says so once, not at every sidestep of the fight', async () => {
  const ctx = await start('fighter', 'heart-once');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  const k = `${p.x + dx},${p.y + dy}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 });
  // the lich stands off to one side, holding it
  const lich = beside(ctx, 'lich', { hp: 50, maxHp: 50, nextAct: 1e12 });
  lich.x = lich.rx = p.x - dx * 3; lich.y = lich.ry = p.y - dy * 3;
  const mark = markLog(G);
  for (let i = 0; i < 3; i++) { Game.input('forward'); run(Game, G, 300); Game.input('back'); run(Game, G, 300); }
  const n = linesSince(G, mark).filter(l => /will not come loose/.test(l)).length;
  if (n !== 1) return `stepping onto the Heart three times said it ${n} times`;
  // but reaching for it (Take in the pack) always says why it will not come
  Game.input('forward'); run(Game, G, 300);
  const m2 = markLog(G);
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  return linesSince(G, m2).some(l => /will not come loose/.test(l)) || 'reaching for the Heart said nothing';
});

await test('the Heart is held fast while the lich stands, and lifting it once the lich is down wins on the spot', async () => {
  const ctx = await start('fighter', 'heart');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  const lich = beside(ctx, 'lich', { hp: 50, maxHp: 50, nextAct: 1e12 });
  const k = `${p.x},${p.y}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 });
  const mark = markLog(G);
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  if (G.status !== 'playing' || p.inv.some(i => i.t === 'artifact')) return 'the Heart came loose with the lich still standing';
  if (!linesSince(G, mark).some(l => /will not come loose/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  L.monsters.splice(L.monsters.indexOf(lich), 1);
  const depth = G.depth;
  Game.takeItem(L.items[k].find(i => i.t === 'artifact'));
  if (G.status !== 'won') return `status ${G.status} after lifting the Heart`;
  if (G.depth !== depth || G.escaping) return 'the run asked for a climb';
  return Game.finaleLeft() > 0 || 'no light to fill the view before the victory screen';
});

// ---------- round seven: the seams of the endgame ----------
await test('the off hand does not follow the lich into the shadow it steps away through', async () => {
  for (let trial = 0; trial < 12; trial++) {
    const ctx = await start('fighter', 'offhand-blink' + trial);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.eq.shield = null; p.eq.weapon = { t: 'shortsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
    const { m } = lichRoom(ctx, { hp: 81, maxHp: 120 });
    p.perkHit = 60;
    for (let i = 0; i < 20 && !m.phase; i++) {
      const mark = markLog(G);
      G.t = p.nextAttack; Game.input('attack');
      const said = linesSince(G, mark);
      const blink = said.findIndex(l => /comes apart into shadow/.test(l));
      if (blink >= 0 && said.slice(blink).some(l => /Your off hand finds the Dread Lich/.test(l))) return `the off hand struck it ${Math.abs(m.x - p.x) + Math.abs(m.y - p.y)} squares away`;
    }
  }
  return true;
});

await test('the lich snuffs its torches and exactly their light; a blow through both marks puts them out where it stands', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'snuff-pair');
    const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
    const { m, torch } = lichRoom(ctx, { phase: 1 });
    // a torch and light far off, which must be left alone
    L.lights = L.lights.concat([{ x: 1, y: 1 }]);
    woundTo(ctx, m, m.maxHp / 3);
    const gone = m.lights || [];
    if (!gone.some(l => l.x === torch[0] && l.y === torch[1] + 1)) out.push('the snuffed torch\'s light still shines');
    if (gone.some(l => !(m.snuffed || []).some(([x, y]) => Math.abs(x - l.x) + Math.abs(y - l.y) === 1))) out.push('a light went out whose torch still burns');
    if (!L.lights.some(l => l.x === 1 && l.y === 1)) out.push('a far light went out with the hall');
  }
  {
    const ctx = await start('fighter', 'lich-phase1');
    const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
    const { m, torch } = lichRoom(ctx, {});
    const at = [m.x, m.y];
    // a blow heavy enough to go from above the first mark to below the second at once
    Game.player().stats.str = 30;
    woundTo(ctx, m, m.maxHp / 3);        // from full straight past both marks
    if (m.phase !== 2) out.push(`phase ${m.phase}`);
    else {
      if (m.x !== at[0] || m.y !== at[1]) out.push('it stepped away though the torches were going out');
      if (torch && L.tiles[torch[1] * L.w + torch[0]] === T.TORCH) out.push('its hall stayed lit');
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('standing on the Heart while the lich lives leaves Use free, and nothing is picked up after the win', async () => {
  const ctx = await start('fighter', 'heart-use');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  const { m } = lichRoom(ctx, {});
  const k = `${p.x},${p.y}`;
  (L.items[k] = L.items[k] || []).push({ t: 'artifact', q: 1, e: 0 }, { t: 'gold', q: 50, e: 0 });
  Game.input('use');                       // takes the gold, not the Heart
  if (Game.useLabel() === 'Take') return 'Use still offers to take the Heart the lich holds';
  const mark = markLog(G);
  Game.input('use'); Game.input('use');
  if (linesSince(G, mark).some(l => /will not come loose/.test(l))) return 'Use kept trying the Heart';
  // the lich down, the Heart and a last coin on the floor: the Heart ends it, the coin stays
  L.monsters.splice(L.monsters.indexOf(m), 1);
  L.items[k].push({ t: 'gold', q: 7, e: 0 });
  const gold = p.gold;
  Game.input('use');
  if (G.status !== 'won') return `status ${G.status}`;
  return p.gold === gold || `picked up ${p.gold - gold} gold after the run was won`;
});

await test('resting, fountains and wounds closing all count in the run\'s healing', async () => {
  const ctx = await start('fighter', 'healed');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.stats.healed = 0;
  p.hp = Math.max(1, p.maxHp - 5); p.food = 100;
  Game.level().monsters.length = 0;
  if (!Game.rest()) return 'could not rest';
  return G.stats.healed === 5 || `resting 5 counted ${G.stats.healed}`;
});

// ---------- round seven: from the playtest ----------
await test('a talent taken from one waiting offer is not offered again by the next', async () => {
  const ctx = await start('fighter', 'dup-talent');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  // two talent offers waiting at once, both holding the same talent
  p.xp = 0; p.level = 1;
  G.pendingBoons = [['cleave', 'riposte', 'stand_firm'], ['cleave', 'second_wind', 'bulwark']];
  G.pendingLevels = [3, 6];
  if (!Game.chooseBoon('cleave')) return 'could not take Cleave';
  const next = Game.pendingBoons();
  if (!next || next.includes('cleave')) return `the next offer still holds Cleave: ${JSON.stringify(next)}`;
  if (next.length !== 3) return `the next offer shrank to ${next.length}`;
  return true;
});

await test('the levels the lich\'s death brings come without a choice standing between the hero and the Heart', async () => {
  const ctx = await start('fighter', 'lich-xp');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  G.pendingBoons = []; p.perkHit = 60;
  const { m } = lichRoom(ctx, { hp: 1, maxHp: 120 });
  const level = p.level;
  for (let i = 0; i < 20 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.includes(m)) return 'the lich would not die';
  if (p.level <= level) return 'killing the lich brought no level';
  return !Game.pendingBoons() || `a choice waits: ${JSON.stringify(Game.pendingBoons())}`;
});

await test('a trap, poison or hunger is named as the killer, not the last monster that struck', async () => {
  // a fighter with no eye for traps, so it is walked into, not spotted
  const ctx = await start('fighter', 'trap-death');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  G.lastAttacker = { name: 'Rabid Skeleton', dmg: 7, bearing: 'from ahead' };
  p.hp = 1; p.perkHit = 0; p.stats.wis = 3; p.bg = 'ashborn';
  // a pit trap in the square ahead
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  const k = `${p.x + dx},${p.y + dy}`;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.traps[k] = 'pit';
  for (let i = 0; i < 20 && G.status === 'playing' && L.traps[k]; i++) { Game.input('forward'); Game.update(G.t + 400, 400); }
  if (G.status === 'playing') return 'the trap did not kill (spotted, or none)';
  const killer = Game.lastAttacker();
  return (killer && killer.cause && /pit/i.test(killer.name)) || `killer: ${JSON.stringify(killer)}`;
});

await test('a line said again straight after itself is counted on one line, and bestiary notes share one', async () => {
  const ctx = await start('fighter', 'fold');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.poison = { until: G.t + 20000, next: G.t };
  p.hp = p.maxHp = 999;
  Game.level().monsters.length = 0;
  for (let i = 0; i < 300; i++) Game.update(G.t + 25, 25);
  const burns = G.log.filter(e => /poison burns/.test(e.m));
  if (burns.length !== 1 || !/\(\u00d7\d+\)$/.test(burns[0].m)) return `poison said as ${burns.length} lines: ${burns.map(e => e.m).join(' | ')}`;
  return true;
});

await test('every potion in a run has its own bottle, kept once known; in a fight Rest never drinks, the quaff does', async () => {
  const ctx = await start('mage', 'bottles');
  const { Game, ITEMS } = ctx; const p = Game.player(), G = Game.state();
  const potions = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'potion');
  const looks = potions.map(id => Game.spriteFor({ t: id, q: 1 }));
  if (new Set(looks).size !== potions.length) return `bottles shared: ${looks.join(',')}`;
  G.known.potion_heal = 1;
  if (Game.spriteFor({ t: 'potion_heal', q: 1 }) !== looks[potions.indexOf('potion_heal')]) return 'the bottle changed once the draught was known';
  // a fight, a known draught: Rest says it cannot and leaves the draught be;
  // the quaff, a button of its own, drinks it
  p.inv.push({ t: 'potion_heal', q: 1, e: 0 });
  p.maxHp = 40; p.hp = 5;                  // hurt enough that the draught is not wasted
  beside(ctx, 'orc', { hp: 99, maxHp: 99, nextAct: 1e12, awake: true });
  if (Game.restLabel() !== 'Foes near') return `with an orc beside, Rest says ${Game.restLabel()}`;
  const count = () => p.inv.filter(i => i.t === 'potion_heal').reduce((n, i) => n + i.q, 0);
  const before = count();
  Game.input('rest');
  if (count() !== before) return 'Rest in a fight drank a draught';
  if (!/cannot rest/.test(G.log[G.log.length - 1].m)) return `Rest in a fight said: ${G.log[G.log.length - 1].m}`;
  Game.input('quaff');
  if (count() !== before - 1) return 'the quaff did not drink the draught';
  Game.level().monsters.length = 0;
  return Game.restLabel() === 'Rest' || `with the fight over, Rest says ${Game.restLabel()}`;
});

await test('when its fight turns the lich is wrapped in shadow a few seconds, and blows pass through it', async () => {
  const ctx = await start('fighter', 'lich-phase1');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const { m } = lichRoom(ctx, {});
  woundTo(ctx, m, m.maxHp * 2 / 3);
  if (m.phase !== 1) return `phase ${m.phase}`;
  if (!(m.wardUntil > G.t)) return 'no shadow when its fight turned';
  // bring it back beside the hero and strike while the shadow lasts
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy; m.nextAct = 1e12;
  const hp = m.hp;
  for (let i = 0; i < 5 && G.t < m.wardUntil - 1500; i++) { G.t = Math.max(p.nextAttack, G.t); Game.input('attack'); }
  if (m.hp !== hp) return `a blow landed through the shadow (${hp} to ${m.hp})`;
  G.t = m.wardUntil + 1; p.nextAttack = G.t;
  for (let i = 0; i < 10 && m.hp === hp; i++) { G.t = Math.max(p.nextAttack, G.t); Game.input('attack'); }
  return m.hp < hp || 'blows still passed through after the shadow lifted';
});
};
