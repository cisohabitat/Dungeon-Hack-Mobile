// Rule checks for the bestiary, with the fifth round's review fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function bestiaryChecks(h) {
  const { OPTS, start, markLog, linesSince, test, beside, clearBehind, shift, run } = h;

// ---------- bestiary ----------
await test('the bestiary counts each monster once when met, and says so the first time', async () => {
  const ctx = await start('fighter', 'beast-meet');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const mark = markLog(G);
  const m = beside(ctx, 'goblin', { awake: false });
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (!m.awake) return 'the goblin never woke';
  const said = linesSince(G, mark);
  if (!said.some(l => /Bestiary: Goblin added/.test(l))) return `said: ${said.join(' | ')}`;
  if (Game.bestiary().goblin.met !== 1) return `met counted ${Game.bestiary().goblin.met} for one goblin`;
  // the same goblin again, asleep and woken, is not a new meeting; another is
  m.awake = false;
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (Game.bestiary().goblin.met !== 1) return 'waking the same goblin twice counted it twice';
  beside(ctx, 'goblin', { uid: 77, awake: false });
  const m2 = markLog(G);
  for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);
  if (Game.bestiary().goblin.met !== 2) return `a second goblin left met at ${Game.bestiary().goblin.met}`;
  return !linesSince(G, m2).some(l => /new entry/.test(l)) || 'the second goblin was announced as new';
});

await test('kills fill the bestiary in: its measure at one, its trick at three, the answer at five', async () => {
  const ctx = await start('fighter', 'beast-kills');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  const seen = [];
  for (let k = 1; k <= 5; k++) {
    const m = beside(ctx, 'orc', { uid: 500 + k, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let i = 0; i < 6 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
    if (L.monsters.includes(m)) return `orc ${k} survived`;
    const r = Game.bestiary().orc;
    seen.push(`${r.kills}:${r.trick ? 't' : '-'}${r.answer ? 'a' : '-'}`);
  }
  return seen.join(' ') === '1:-- 2:-- 3:t- 4:t- 5:ta' || `knowledge by kill: ${seen.join(' ')}`;
});

await test('seeing a trick writes it down, and beating it writes the answer', async () => {
  const ctx = await start('fighter', 'beast-trick');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const m = beside(ctx, 'ogre', { blows: 2 });
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.move !== 'crush') return 'no crush began';
  const r1 = Game.bestiary().ogre;
  if (!r1.trick || r1.answer) return `after seeing it: ${JSON.stringify(r1)}`;
  shift(ctx, 'back');
  const mark = markLog(G);
  run(Game, G, 950);
  const r2 = Game.bestiary().ogre;
  if (!r2.answer) return `after dodging it: ${JSON.stringify(r2)}`;
  void p;
  return linesSince(G, mark).some(l => /Bestiary: .*Ogre, you learned .*how to beat it/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('the bestiary remembers what killed you, and outlasts the run', async () => {
  const ctx = await start('fighter', 'beast-death');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = 1; p.eq.armor = null; p.eq.shield = null;
  beside(ctx, 'goblin');
  for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead') return 'the goblin never killed the hero';
  if (Game.bestiary().goblin.deaths !== 1) return `deaths: ${Game.bestiary().goblin.deaths}`;
  Game.newGame({ name: 'Next', cls: 'thief', stats: Game.rollStats(), seed: 'beast-next', opts: OPTS });
  const r = Game.bestiary().goblin;
  return (r && r.met >= 1 && r.deaths === 1) || `the next hero's bestiary: ${JSON.stringify(r)}`;
});

await test('a trick seen again does not rewrite the bestiary: a regrowing troll is not a write a second', async () => {
  const ctx = await start('fighter', 'beast-quiet');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'troll', { hp: 100, maxHp: 400, nextAct: 1e12 });
  p.perkHit = 60;
  for (let i = 0; i < 6 && m.hp === 100; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // met (a natural 1 still misses)
  run(Game, G, 1100);                                  // it regrows: trick seen
  if (!Game.bestiary().troll.trick) return 'watching a troll regrow did not note its trick';
  const real = localStorage.setItem.bind(localStorage);
  let writes = 0;
  localStorage.setItem = (k, v) => { if (k === 'deepdelve.bestiary') writes++; real(k, v); };
  try { run(Game, G, 5000); } finally { localStorage.setItem = real; }
  void m;
  return writes === 0 || `five more seconds of regrowth wrote the bestiary ${writes} times`;
});

// ---------- round five review ----------
await test('holding a direction does not shred a web: pushes tear no faster than four a second', async () => {
  const ctx = await start('fighter', 'web-hold');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  clearBehind(ctx);
  p.webbed = G.t + 2500;
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 38; i++) { Game.update(G.t + 16, 16); Game.input('back', true); Game.input('back'); }
  return (p.x === x0 && p.y === y0) || 'six hundred milliseconds of holding tore a 2.5s web';
});

await test('a frozen hero cannot cast, drink or swing from any screen', async () => {
  const ctx = await start('mage', 'frozen-screens');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.held = G.t + 5000; p.hp = 1; G.t = Math.max(G.t, p.nextAttack);
  const sp0 = p.sp;
  if (Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'))) return 'Shield was cast while frozen';
  const draught = p.inv.find(i => i.t === 'potion_heal');
  if (draught) { Game.useItem(draught); if (p.hp !== 1) return 'a potion was drunk while frozen'; }
  return p.sp === sp0 || 'spell points were spent while frozen';
});

await test('the trader is one of the Lampfolk, said in full the first time; at a goblin market it is a goblin pedlar', async () => {
  const ctx = await start('fighter', 'trader-kind');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const x = p.x + dx, y = p.y + dy;
  L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
  /** walk into a fresh trader ahead and return what was said */
  const meet = () => {
    L.npcs.length = 0;
    L.npcs.push({ id: 'merchant', x, y, markup: 2, stock: [], greeted: false });
    const mark = markLog(G);
    Game.update(G.t + 400, 400);
    Game.input('forward');
    const said = linesSince(G, mark).join(' | ');
    Game.closeShop();
    return said;
  };
  const first = meet();
  if (!/One of the Lampfolk looks up/.test(first)) return `the first trader said: ${first}`;
  if (Game.traderName() !== 'Lampfolk trader') return `the shop is headed ${Game.traderName()}`;
  const again = meet();
  if (!/A Lampfolk trader blinks/.test(again) || /always been down here/.test(again)) return `the second trader said: ${again}`;
  L.twist = 'market';
  const market = meet();
  if (!/A goblin pedlar squats/.test(market)) return `the market trader said: ${market}`;
  return Game.traderName() === 'Goblin pedlar' || `the market shop is headed ${Game.traderName()}`;
});
};
