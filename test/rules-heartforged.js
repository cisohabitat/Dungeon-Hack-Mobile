// Rule checks for the Heartforged, the Long Delve's own keeper, with the fifth playtest's fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function heartforgedChecks(h) {
  const { OPTS, start, markLog, linesSince, test, beside, ahead, shift, run } = h;

// ---------- the Heartforged: the Long Delve's own keeper ----------
await test('at the bottom of a Long Delve the Heartforged keeps the Heart, down either road; eight floors keep the lich and the Warlord; the rest of the floor is the same', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-floor');
  for (let i = 0; i < 5; i++) {
    const seed = `hf-${i}`;
    for (const levels of [12, 16]) {
      const opts = { ...OPTS, levels, size: 'medium', monsters: 'normal' };
      const W = ctx.Dungeon.generate(seed, levels, { ...opts, route: 'warrens' }), C = ctx.Dungeon.generate(seed, levels, { ...opts, route: 'crypts' });
      const boss = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
      if (boss(W) !== 'heartforged' || boss(C) !== 'heartforged') out.push(`${seed} (${levels}): warrens ${boss(W)}, crypts ${boss(C)}`);
    }
    // the eight floors as they were
    const o8 = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    const w8 = ctx.Dungeon.generate(seed, 8, { ...o8, route: 'warrens' }), c8 = ctx.Dungeon.generate(seed, 8, { ...o8, route: 'crypts' });
    const b8 = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
    if (b8(w8) !== 'warlord' || b8(c8) !== 'lich') out.push(`${seed} (8): warrens ${b8(w8)}, crypts ${b8(c8)}`);
  }
  // the same count of hit dice as the lich's, so nothing else on the floor rolls differently
  if (ctx.MONSTERS.heartforged.hp[0] !== ctx.MONSTERS.lich.hp[0]) out.push(`it rolls ${ctx.MONSTERS.heartforged.hp[0]} hit dice, the lich ${ctx.MONSTERS.lich.hp[0]}`);
  return out.length ? out.join('; ') : true;
});

/** Open floor round the hero, nothing else on it, and the Heartforged on the square ahead. */
const forgeRoom = (ctx, extra = {}) => {
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  // in the middle of the map, so every one of its lines has room to run
  p.x = Math.floor(L.w / 2); p.y = Math.floor(L.h / 2);
  for (let y = p.y - 5; y <= p.y + 5; y++) for (let x = p.x - 5; x <= p.x + 5; x++) if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  L.npcs = []; L.items = {}; L.traps = {}; L.fields = {};
  return beside(ctx, 'heartforged', { hp: 3000, maxHp: 3000, nextAct: 1e12, spoke: true, ...extra });
};

await test('the Heartforged stamps fire down its four lines: on a line you burn, off them the fire runs past and its hammer sticks, leaving it open', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-stamp', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = forgeRoom(ctx);
  const [dx, dy] = Dungeon.DIRS[p.dir], [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  // two squares off down its line, after a blow: it raises its hammer
  const gather = () => { m.windup = null; m.blows = 1; m.moveReady = 0; m.nextAct = G.t; for (let i = 0; i < 20 && !(m.windup && m.windup.move === 'stamp'); i++) Game.update(G.t + 25, 25); return !!(m.windup && m.windup.move === 'stamp'); };
  m.x = m.rx = m.fromX = p.x + dx * 2; m.y = m.ry = m.fromY = p.y + dy * 2;
  if (!gather()) return `it did not raise its hammer with the hero on its line (${JSON.stringify(m.windup)})`;
  // stay on the line: burned, and its lines are on fire
  let hp = p.hp, mark = markLog(G);
  for (let i = 0; i < 80 && m.windup; i++) Game.update(G.t + 25, 25);
  if (p.hp >= hp) out.push('on its line, the stamp did no harm');
  if (!linesSince(G, mark).some(l => /fire runs down the floor over you/.test(l))) out.push(`on its line it said: ${linesSince(G, mark).join(' / ')}`);
  const burning = (x, y) => { const f = Game.fieldAt(x, y); return !!f && f.k === 'fire'; };
  if (!burning(m.x - dx, m.y - dy) || !burning(m.x + sx, m.y + sy) || !burning(m.x + sx * 3, m.y + sy * 3) || !burning(m.x - sx * 3, m.y - sy * 3) || !burning(m.x + dx * 3, m.y + dy * 3)) out.push('its four lines did not burn');
  if (burning(m.x + sx * 4, m.y + sy * 4)) out.push('its fire ran four squares before it glowed white');
  if (burning(m.x + sx + dx, m.y + sy + dy) || burning(m.x - sx - dx, m.y - sy - dy)) out.push('a square off its lines burned');
  // again, the hero stepping off its line while the hammer is up: the fire misses, and it is open
  Game.level().fields = {}; p.hp = 9999;
  if (!gather()) return 'it did not raise its hammer a second time';
  p.x += sx; p.y += sy;
  hp = p.hp; mark = markLog(G);
  for (let i = 0; i < 80 && m.windup; i++) Game.update(G.t + 25, 25);
  if (p.hp < hp) out.push(`off its lines, the stamp did ${hp - p.hp}`);
  if (!linesSince(G, mark).some(l => /hammer sticks fast in the stone/.test(l))) out.push(`off its lines it said: ${linesSince(G, mark).join(' / ')}`);
  if (!(p.opening && p.opening.until > G.t)) out.push('off its lines, it was not left open');
  // and its fire is gone from beside it while the hammer is still stuck, so the opening can be taken
  for (let i = 0; i < 28; i++) Game.update(G.t + 25, 25);
  if (burning(m.x - dx, m.y - dy) || burning(m.x + sx, m.y + sy)) out.push('the fire beside it still burned 0.7 seconds after the stamp');
  if (!(m.nextAct > G.t)) out.push('the hammer came free before its fire went out');
  // not on a line at all, it does not begin
  Game.level().fields = {}; m.blows = 1; m.moveReady = 0; m.nextAct = G.t; m.windup = null;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  if (m.windup && m.windup.move === 'stamp') out.push('it raised its hammer with the hero off its lines');
  return out.length ? out.join('; ') : true;
});

await test('the Heartforged at two thirds lets two emberlings out of its furnace; at one third it glows white, quicker, its fire running four squares; when it falls they go out with it', async () => {
  const out = [];
  const ctx = await start('fighter', 'hf-phases', { levels: 12 });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = forgeRoom(ctx, { hp: 300, maxHp: 300 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const hit = () => { m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = 1e12; m.windup = null; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); };
  const speed0 = Game.mstat(m).speed;
  m.hp = 201; let mark = markLog(G);
  for (let i = 0; i < 20 && m.phase !== 1; i++) hit();
  if (m.phase !== 1) return 'it never reached two thirds';
  const embers = L.monsters.filter(o => o.ember === m.uid);
  if (embers.length !== 2 || embers.some(e => e.id !== 'emberling' || !e.awake)) out.push(`at two thirds: ${embers.map(e => e.id)}`);
  if (!linesSince(G, mark).some(l => /tears open the furnace in its chest/.test(l))) out.push(`at two thirds it said: ${linesSince(G, mark).join(' / ')}`);
  m.hp = 99; mark = markLog(G);
  for (let i = 0; i < 20 && m.phase !== 2; i++) hit();
  if (m.phase !== 2) return 'it never reached one third';
  if (!(Game.mstat(m).speed < speed0)) out.push(`at one third its speed is ${Game.mstat(m).speed}, not quicker than ${speed0}`);
  if (!linesSince(G, mark).some(l => /glows white/.test(l))) out.push(`at one third it said: ${linesSince(G, mark).join(' / ')}`);
  // its fire reaches four squares now: four off down its line, it stamps
  m.x = m.rx = m.fromX = p.x + dx * 4; m.y = m.ry = m.fromY = p.y + dy * 4;
  m.windup = null; m.moveReady = 0; m.nextAct = G.t;
  const at4 = [m.x, m.y];
  for (let i = 0; i < 20 && !(m.windup && m.windup.move === 'stamp'); i++) Game.update(G.t + 25, 25);
  // (from where it stood: it must not have stepped a square nearer first)
  if (!(m.windup && m.windup.move === 'stamp') || m.x !== at4[0] || m.y !== at4[1]) out.push(`glowing white, it did not stamp from four squares off (${JSON.stringify(m.windup)} at ${m.x},${m.y})`);
  // it falls: the Heart is free, and the embers go out
  for (const e of L.monsters) if (e.ember) { e.x = p.x - dx * 3; e.y = p.y - dy * 3; e.nextAct = 1e12; }
  m.windup = null; m.hp = 1; mark = markLog(G);
  for (let i = 0; i < 10 && L.monsters.includes(m); i++) hit();
  if (L.monsters.includes(m)) return 'it would not fall';
  if (L.monsters.some(o => o.ember === m.uid)) out.push('its embers still burn after it fell');
  if (!linesSince(G, mark).some(l => /falls apart into cooling slag/.test(l))) out.push(`its fall said: ${linesSince(G, mark).join(' / ')}`);
  if (Game.heartHeldFast()) out.push('the Heart is still held after it fell');
  return out.length ? out.join('; ') : true;
});

await test('at two thirds the Warlord takes his throne behind shield-bearers; cut them down and he comes down; at one third a frenzy', async () => {
  const out = [];
  const ctx = await start('fighter', 'warlord-throne');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = beside(ctx, 'warlord', { hp: 300, maxHp: 300, nextAct: 1e12 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const hit = () => { m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = 1e12; G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); };
  m.hp = 201;
  for (let i = 0; i < 20 && m.phase !== 1; i++) hit();
  if (m.phase !== 1) return 'he never reached two thirds';
  const bearers = L.monsters.filter(o => o.bearer === m.uid);
  if (bearers.length !== 2 || bearers.some(b => b.id !== 'orc') || !m.throne) return `at two thirds: ${bearers.length} bearers, throne ${m.throne}`;
  const hp1 = m.hp, told = markLog(G);
  for (let i = 0; i < 6; i++) hit();
  if (m.hp !== hp1) out.push(`on his throne he took ${hp1 - m.hp}`);
  if (!linesSince(G, told).some(l => /shield-bearers turn the blow aside/.test(l))) out.push(`a blow at him on his throne said: ${linesSince(G, told).join(' / ')}`);
  if (Game.mstat(m).ranged == null) out.push('on his throne he has no spear to throw');
  // his bar says where he is (it shows once he has spoken)
  m.spoke = true; m.awake = true;
  const bar = (Game.renderState(0).fx.boss || {}).name;
  if (bar !== 'Goblin Warlord, on his throne') out.push(`his bar read ${bar}`);
  // beside him on his throne, he strikes no blow of his own: that is the shield-bearers' work
  {
    m.x = m.rx = m.fromX = p.x + dx; m.y = m.ry = m.fromY = p.y + dy; m.nextAct = G.t; m.windup = null;
    const seen = markLog(G);
    for (let i = 0; i < 120 && m.throne; i++) Game.update(G.t + 25, 25);
    if (linesSince(G, seen).some(l => /Goblin Warlord (hits|misses) you/.test(l))) out.push('he struck from his throne');
  }
  // his shield-bearers fall: he comes down
  for (const b of bearers) L.monsters.splice(L.monsters.indexOf(b), 1);
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (m.throne || m.wardUntil > G.t) out.push('with his shield-bearers dead he stayed on his throne');
  if (!linesSince(G, mark).some(l => /leaps down to fight you himself/.test(l))) out.push('coming down was not told');
  for (let i = 0; i < 6 && m.hp === hp1; i++) hit();
  if (m.hp === hp1) out.push('off his throne, still no blow reached him');
  // one third: the war-chest and the frenzy
  const golds = () => Object.values(L.items).reduce((n, list) => n + list.filter(i => i.t === 'gold').length, 0), g0 = golds();
  m.hp = Math.min(m.hp, 101);
  for (let i = 0; i < 20 && m.phase !== 2; i++) hit();
  if (m.phase !== 2 || !m.frenzy) out.push(`phase ${m.phase}, frenzy ${m.frenzy}`);
  if (!(Game.mstat(m).speed < ctx.MONSTERS.warlord.speed)) out.push(`in his frenzy he strikes every ${Game.mstat(m).speed}ms`);
  if (golds() < g0 + 2) out.push(`the war-chest spilled ${golds() - g0} piles of gold`);
  return out.length ? out.join('; ') : true;
});

await test('a spell flies over the Warlord\'s shield-bearers and finds him on his throne', async () => {
  const ctx = await start('mage', 'warlord-spell');
  const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99;
  const m = beside(ctx, 'warlord', { hp: 300, maxHp: 300, nextAct: 1e12, phase: 1, throne: true, wardUntil: G.t + 1e6 });
  const bolt = SPELLS.mage.find(s => s.kind === 'bolt' && Game.spellAvailable(s));
  if (!bolt) return 'no bolt spell to cast';
  const mark = markLog(G);
  G.t = Math.max(G.t, p.nextAttack);
  Game.castSpell(bolt);
  const out = [];
  if (!(m.hp < 300)) out.push(`the ${bolt.name} did not reach him (${linesSince(G, mark).join(' / ')})`);
  if (!linesSince(G, mark).some(l => /flies over the shield-bearers/.test(l))) out.push('it was not told');
  // a blade still does not
  const hp = m.hp;
  G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
  if (m.hp !== hp) out.push('a blade reached him on his throne');
  return out.length ? out.join('; ') : true;
});

await test('the Warlord falls: his warband runs, his hoard is left, and the Heart comes loose', async () => {
  const ctx = await start('fighter', 'warlord-fall');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
  const m = beside(ctx, 'warlord', { hp: 1, maxHp: 300, nextAct: 1e12, phase: 2 });
  const gob = { ...m, uid: 91, id: 'goblin', x: -50, y: -50, hp: 10, maxHp: 10, phase: 0, awake: false };
  L.monsters.push(gob);
  const mark = markLog(G);
  for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  if (L.monsters.includes(m)) return 'he would not fall';
  const out = [];
  if (!gob.fleeing) out.push('his warband did not run');
  if (!G.bossDown) out.push('the boss is not down');
  if (!Object.values(L.items).some(list => list.some(i => i.t === 'gold' && i.q >= 20))) out.push('no hoard was left');
  if (!linesSince(G, mark).some(l => /crashes down among his plunder/.test(l))) out.push(`said: ${linesSince(G, mark).join(' / ')}`);
  if (Game.heartKeeper()) out.push('the Heart is still held');
  return out.length ? out.join('; ') : true;
});

await test('the lich\'s cold fire does not reach round a wall', async () => {
  const ctx = await start('fighter', 'nova-wall');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  const hp0 = p.hp;
  const m = ahead(ctx, 'lich', 2, { nextAct: 1e12 });
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = T.WALL;      // a wall between them
  m.windup = { kind: 'move', move: 'nova', at: G.t, until: G.t + 10 };
  m.nextAct = G.t;
  const mark = markLog(G);
  run(Game, G, 100);
  if (p.hp < hp0) return `the nova burned through the wall for ${hp0 - p.hp}`;
  return linesSince(G, mark).some(l => /breaks short/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

// ---------- round five playtest ----------
for (const [id, verb, air] of [['zombie', 'lurches forward', /grabs at the air/], ['ghoul', 'numbing claw', /closes on the air/]]) {
  await test(`the ${id}'s trick is telegraphed in violet, and a step back makes it miss`, async () => {
    const ctx = await start('fighter', 'tell-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.con = 3;
    const m = beside(ctx, id, { blows: 2 });
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    if (!m.windup || !m.windup.move) return `it drew ${JSON.stringify(m.windup)}`;
    if (!linesSince(G, mark).some(l => l.includes(verb))) return `said: ${linesSince(G, mark).join(' | ')}`;
    shift(ctx, 'back');
    run(Game, G, 800);
    if (p.grabbed || p.held > G.t) return 'the dodged trick still took hold';
    return linesSince(G, mark).some(l => air.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
  });
}

await test('the log tells what happened before what the bestiary learned from it', async () => {
  const ctx = await start('fighter', 'log-order');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const m = ahead(ctx, 'spider', 3);
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  const trick = said.findIndex(l => /rears back to spit a web/.test(l)), note = said.findIndex(l => /^Bestiary: Cave Spider/.test(l));
  if (trick < 0 || note < 0 || note < trick) return `order: ${said.join(' | ')}`;
  if (said.filter(l => /^Bestiary/.test(l)).length !== 1) return `more than one bestiary line: ${said.join(' | ')}`;
  // and a kill: slain first, then one note
  const m2 = beside(ctx, 'rat', { uid: 612, hp: 1, maxHp: 1, nextAct: 1e12 });
  let k = markLog(G);
  // a natural 1 misses whatever the bonus: swing again until the blow lands
  for (let i = 0; i < 20 && Game.level().monsters.includes(m2); i++) { k = markLog(G); G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
  const after = linesSince(G, k);
  void m; void m2;
  const dead = after.findIndex(l => /destroyed|slain/.test(l)), n2 = after.findIndex(l => /^Bestiary: Giant Rat/.test(l));
  return (dead >= 0 && n2 > dead && after.filter(l => /^Bestiary/.test(l)).length === 1) || `order: ${after.join(' | ')}`;
});

await test('even a quick rat gives a thumb over half a second of warning as it arrives', async () => {
  const ctx = await start('fighter', 'rat-warning');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  const m = ahead(ctx, 'rat', 2);
  for (let i = 0; i < 60 && !m.windup; i++) Game.update(G.t + 25, 25);
  if (!m.windup) return 'the rat never drew back';
  const dur = m.windup.until - m.windup.at;
  return dur >= 550 || `the rat's first blow gave ${dur}ms of warning`;
});
};
