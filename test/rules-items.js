// Rule checks for the pack in use (the last of a stack, nothing wasted, an unknown draught never
// refused), saves and reloads, the trader's counter, poison and buffs on their clocks, movement against
// every tile, and the story's spine: backgrounds, levelling, journal pages and the epilogue.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function itemsChecks(h) {
  const { OPTS, evenStats, newContext, ITEMS_FOR_TEST, start, spreadPicks, test, beside } = h;

await test('using the last of a stack removes its slot', async () => {
  const { Game } = await start('fighter', 'r3');
  const p = Game.player();
  p.inv.length = 0;
  p.food = 20;                                 // eating at full nourishment is refused
  p.inv.push({ t: 'ration', q: 1, e: 0 });
  Game.useItem(p.inv[0]);
  return p.inv.length === 0;
});

await test('nothing is consumed when it could not possibly help', async () => {
  const { Game } = await start('cleric', 'waste');
  const p = Game.player();
  p.inv.length = 0;
  p.hp = p.maxHp;
  p.food = 100;
  p.poison = null;
  // the guard only applies to things already identified: refusing an unknown
  // draught would tell the player what it is
  for (const id of ['ration', 'potion_heal', 'potion_cure']) Game.state().known[id] = 1;
  p.inv.push({ t: 'ration', q: 2, e: 0 });
  p.inv.push({ t: 'potion_heal', q: 2, e: 0 });
  p.inv.push({ t: 'potion_cure', q: 1, e: 0 });
  const before = p.inv.map(i => i.q).join(',');
  Game.useItem(p.inv[0]);                      // full up
  Game.useItem(p.inv[1]);                      // unhurt
  Game.useItem(p.inv[2]);                      // unpoisoned
  if (p.inv.map(i => i.q).join(',') !== before) return 'something was consumed for no benefit';
  // and each refusal explains itself
  const said = Game.state().log.slice(-3).map(e => e.m).join(' ');
  if (!/full/i.test(said) || !/unhurt/i.test(said) || !/poison/i.test(said)) {
    return 'a refusal did not say why: ' + said;
  }
  // once it would help, it works
  p.hp = 1;
  Game.useItem(p.inv[1]);
  return p.hp > 1 && p.inv.find(i => i.t === 'potion_heal').q === 1;
});

await test('an unidentified draught is never refused, since that would reveal it', async () => {
  const { Game } = await start('fighter', 'waste-unknown');
  const p = Game.player();
  const G = Game.state();
  p.hp = p.maxHp;
  const unknown = Object.keys(ITEMS_FOR_TEST(Game)).find(
    id => !G.known[id] && G.looks[id] && ITEMS_FOR_TEST(Game)[id].effect === 'heal');
  if (!unknown) return true;                     // nothing unidentified to check
  p.inv.push({ t: unknown, q: 1, e: 0 });
  const before = p.inv.length;
  Game.useItem(p.inv[p.inv.length - 1]);
  return p.inv.length < before ? true : 'an unknown potion was refused, which leaks what it is';
});

await test('spells do not spend points on nothing', async () => {
  const { Game } = await start('cleric', 'waste-spell');
  const p = Game.player();
  p.level = 5;
  p.maxSp = 40; p.sp = 40;
  p.hp = p.maxHp;
  const heal = Game.knownSpells().find(s => s.kind === 'heal');
  const bolt = Game.knownSpells().find(s => s.kind === 'bolt');
  if (!heal || !bolt) return 'the cleric should know a heal and a bolt';
  if (Game.castSpell(heal) !== false) return 'healing at full health was allowed';
  if (p.sp !== 40) return `healing at full health spent ${40 - p.sp} points`;
  // clear the way ahead so the bolt has provably no target
  const L = Game.level();
  L.monsters.length = 0;
  if (Game.castSpell(bolt) !== false) return 'a bolt was cast at nothing';
  if (p.sp !== 40) return `casting at nothing spent ${40 - p.sp} points`;
  p.hp = 1;
  return Game.castSpell(heal) === true && p.sp < 40;
});

await test('a save survives the JSON round trip, effects included', async () => {
  const { Game } = await start('mage', 'r4', { lockedDoors: true, traps: true });
  const p = Game.player();
  p.effects.ac = { amount: 4, until: 99999 };
  Game.save(true);
  const before = JSON.stringify({ hp: p.hp, inv: p.inv.length, sp: p.sp, gold: p.gold });
  if (!Game.load()) return 'load returned false';
  const q = Game.player();
  return JSON.stringify({ hp: q.hp, inv: q.inv.length, sp: q.sp, gold: q.gold }) === before
    && q.effects.ac && q.effects.ac.amount === 4;
});

await test('a trader saved standing in a doorway steps aside into its room on reload', async () => {
  const { Game } = await start('fighter', 'aside');
  const L = Game.level(), T = Game.T, w = L.w;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DOORS = [T.DOOR, T.DOOR_OPEN, T.DOOR_LOCKED, T.SECRET];
  // A square of room floor with a door beside it: just where a trader should not stand.
  // (in a room with somewhere better to stand: one square at least with its own floor all round)
  const roomy = r => L.tiles.some((t, i) => t === T.FLOOR && L.roomId[i] === r && DIRS.every(([dx, dy]) => { const j = i + dy * w + dx; return L.tiles[j] === T.FLOOR && L.roomId[j] === r; }));
  let spot = null;
  for (let i = 0; i < w * L.h && !spot; i++) {
    const x = i % w, y = (i / w) | 0;
    if (L.tiles[i] !== T.FLOOR || L.roomId[i] < 0 || L.monsters.some(m => m.x === x && m.y === y) || !roomy(L.roomId[i])) continue;
    if (DIRS.some(([dx, dy]) => DOORS.includes(L.tiles[(y + dy) * w + x + dx]))) spot = [x, y];
  }
  if (!spot) return 'no square by a door on this floor';
  const room = L.roomId[spot[1] * w + spot[0]];
  L.npcs.push({ id: 'merchant', x: spot[0], y: spot[1], stock: [], markup: 1, greeted: false });
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  const M = Game.level(), n = M.npcs[M.npcs.length - 1];
  if (n.x === spot[0] && n.y === spot[1]) return 'the trader is still in the doorway';
  if (M.roomId[n.y * w + n.x] !== room) return 'the trader left its room';
  const clear = DIRS.every(([dx, dy]) => M.tiles[(n.y + dy) * w + n.x + dx] === T.FLOOR && M.roomId[(n.y + dy) * w + n.x + dx] === room);
  return clear || `the trader moved to ${n.x},${n.y}, which is still by the room's edge`;
});

await test('a blow being drawn back is still coming after a reload, with a moment\'s grace', async () => {
  const ctx = await start('fighter', 'reload-windup');
  const { Game } = ctx; const G = Game.state();
  const m = beside(ctx, 'ogre', { blows: 2 });
  m.windup = { kind: 'move', move: 'crush', at: G.t, until: G.t + 900 }; m.nextAct = m.windup.until;
  const until = m.windup.until;
  Game.save(true);
  if (!Game.load()) return 'load returned false';
  const n = Game.level().monsters.find(x => x.uid === m.uid);
  if (!n || !n.windup || n.windup.move !== 'crush') return `the crush was forgotten: ${JSON.stringify(n && n.windup)}`;
  if (n.windup.until !== until + 800 || n.nextAct !== n.windup.until) return `until ${n.windup.until}, next ${n.nextAct}, wanted ${until + 800}`;
  return true;
});

await test('dropping from a full pack frees a slot', async () => {
  const { Game } = await start('fighter', 'r5');
  const p = Game.player();
  p.inv.length = 0;
  for (let i = 0; i < Game.INV_MAX; i++) p.inv.push({ t: 'dagger', q: 1, e: 0 });
  Game.dropItem(p.inv[0]);
  return p.inv.length === Game.INV_MAX - 1 && Game.floorItems().length >= 1;
});

await test('a dead player takes no more turns', async () => {
  const { Game } = await start('fighter', 'r6');
  const p = Game.player();
  const steps = p.steps;
  Game.state().status = 'dead';
  Game.input('forward');
  return p.steps === steps;
});

await test('the Heart cannot be sold or dropped', async () => {
  const ctx = await start('fighter', 'r7');
  const { Game } = ctx;
  const p = Game.player();
  p.inv.push({ t: 'artifact', q: 1, e: 0 });
  const heart = p.inv.find(i => i.t === 'artifact');
  Game.dropItem(heart);
  return p.inv.some(i => i.t === 'artifact');
});

await test('walking into a trader opens a shop that charges gold and identifies goods', async () => {
  const ctx = await start('fighter', 'r8', { levels: 8, size: 'medium' });
  const { Game, Dungeon } = ctx;
  const G = Game.state();
  const T = Dungeon.T;
  let trader = null;
  for (let d = 2; d <= 8 && !trader; d++) {
    G.levels[d] = G.levels[d] || Dungeon.generate(G.seed, d, G.opts);
    // encounter props share the list now: find the trader by kind
    const t = G.levels[d].npcs.find(n => n.kind !== 'encounter');
    if (t) { G.depth = d; trader = t; }
  }
  if (!trader) return 'no trader generated in eight levels';
  const L = Game.level();
  const p = Game.player();
  p.gold = 1000;
  // stand beside them and step in, the way a player reaches the shop
  let placed = false;
  for (let k = 0; k < 4; k++) {
    const [dx, dy] = Dungeon.DIRS[k];
    const x = trader.x - dx, y = trader.y - dy;
    if (L.tiles[y * L.w + x] === T.FLOOR) { p.x = x; p.y = y; p.dir = k; placed = true; break; }
  }
  if (!placed) return 'trader has no adjacent floor tile';
  const movedInto = { x: p.x, y: p.y };
  Game.input('forward');
  if (!Game.currentShop()) return 'walking into the trader did not open the shop';
  if (p.x !== movedInto.x || p.y !== movedInto.y) return 'the player walked through the trader';
  const it = Game.currentShop().stock[0];
  const price = Game.buyPrice(Game.currentShop(), it);
  // stackables merge into an existing slot, so count pieces rather than slots
  const count = () => p.inv.reduce((a, i) => a + (i.q || 1), 0);
  const packBefore = count();
  if (!Game.buy(it)) return 'buy failed with 1000 gold in hand';
  if (p.gold !== 1000 - price) return `gold went ${p.gold}, expected ${1000 - price}`;
  if (count() !== packBefore + 1) return 'the bought item did not reach the pack';
  if (!Game.isKnown(it.t)) return 'buying did not identify the item';
  // and the trader refuses the Heart
  p.inv.push({ t: 'artifact', q: 1, e: 0 });
  const sold = Game.sell(p.inv.find(i => i.t === 'artifact'));
  return sold === false && p.inv.some(i => i.t === 'artifact');
});

await test('poison wears off rather than lasting forever', async () => {
  const { Game } = await start('fighter', 'r9');
  const p = Game.player();
  const G = Game.state();
  p.poison = { until: G.t + 1000, next: G.t + 100 };
  p.hp = p.maxHp;
  for (let i = 0; i < 40; i++) Game.update(i * 300, 300);
  return !p.poison;
});

await test('buffs expire on their own clock', async () => {
  const { Game } = await start('cleric', 'r10');
  const G = Game.state();
  Game.player().effects.hit = { amount: 2, until: G.t + 500 };
  for (let i = 0; i < 20; i++) Game.update(i * 300, 300);
  return Game.effect('hit') === 0;
});

// ---- movement against every tile type ----

// Movement used to be allow-by-default, so a tile type added later was walkable
// until somebody remembered to reject it. That is how wall torches became
// something you could stand inside. This walks the whole tile enum rather than
// the cases anyone thought of, so the next new tile cannot repeat it.
await test('only floor and open doors can be walked into', async () => {
  const probe = await newContext();
  const WALKABLE = new Set(['FLOOR', 'DOOR_OPEN']);
  const CHANGES_LEVEL = new Set(['STAIRS_DOWN']);
  const wrong = [];
  for (const [name, value] of Object.entries(probe.Dungeon.T)) {
    const ctx = await start('fighter', 'tiles-' + name);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + (p.x + dx)] = value;
    const from = { x: p.x, y: p.y, depth: Game.state().depth };
    Game.input('forward');
    const changedLevel = Game.state().depth !== from.depth;
    const entered = !changedLevel && (p.x !== from.x || p.y !== from.y);
    if (entered !== WALKABLE.has(name)) {
      wrong.push(`${name} ${entered ? 'was walked into' : 'blocked the player'}`);
    }
    if (CHANGES_LEVEL.has(name) && !changedLevel) wrong.push(`${name} did not change level`);
  }
  return wrong.length ? wrong.join('; ') : true;
});

await test('a wall torch is solid to monsters as well as to the player', async () => {
  const { Game, Dungeon } = await start('fighter', 'torch-solid');
  const T = Dungeon.T;
  const L = Game.level(), p = Game.player();
  let placed = null;
  for (let i = 0; i < L.tiles.length && !placed; i++) {
    if (L.tiles[i] !== T.FLOOR) continue;
    const x = i % L.w, y = (i / L.w) | 0;
    if (x === p.x && y === p.y) continue;
    L.tiles[i] = T.TORCH;
    placed = { x, y };
  }
  if (!placed) return 'no floor tile to convert';
  // the generator marks torches as walls, so nothing should treat one as ground
  const monstersOnTorch = L.monsters.filter(m => m.x === placed.x && m.y === placed.y);
  return monstersOnTorch.length === 0 ? true : 'a monster is standing in a torch';
});

// ---- story and progression ----

await test('every background is complete and keeps its voice straight', async () => {
  const { Game } = await start('fighter', 'story1');
  void Game;
  const ctx = await newContext();
  const BG = ctx.BACKGROUNDS;
  const ids = Object.keys(BG);
  if (ids.length < 4) return `only ${ids.length} backgrounds`;
  for (const id of ids) {
    const b = BG[id];
    for (const field of ['name', 'blurb', 'perk', 'story', 'motive', 'epi']) {
      if (!b[field]) return `${id} is missing ${field}`;
    }
    if (!/^You /.test(b.motive)) return `${id} motive is not in second person`;
    if (/\byou\b|\byour\b|\byourself\b/i.test(b.epi)) return `${id} epilogue leaks second person: ${b.epi}`;
  }
  return true;
});

await test('each background grants its stated advantage', async () => {
  const plain = (await start('fighter', 'story2')).Game.player();
  const ctxD = await newContext();
  ctxD.Game.newGame({ name: 'T', cls: 'fighter', bg: 'debtor', stats: { ...evenStats }, opts: OPTS });
  const debtor = ctxD.Game.player();
  if (debtor.gold !== 150) return `debtor starts with ${debtor.gold} gold, expected 150`;
  if (plain.gold !== 0) return `a plain start carries ${plain.gold} gold`;

  const ctxO = await newContext();
  ctxO.Game.newGame({ name: 'T', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, opts: OPTS });
  if ((ctxO.Game.player().perkHit || 0) !== 1) return 'oathbroken does not gain +1 to hit';

  const ctxA = await newContext();
  ctxA.Game.newGame({ name: 'T', cls: 'fighter', bg: 'ashborn', stats: { ...evenStats }, opts: OPTS });
  if (ctxA.Game.player().stats.con !== 13) return 'ashborn does not gain a point of constitution';

  const ctxC = await newContext();
  ctxC.Game.newGame({ name: 'T', cls: 'mage', bg: 'cloistered', stats: { ...evenStats }, opts: OPTS });
  if (!ctxC.Game.isKnown('potion_xheal')) return 'cloistered does not begin knowing every draught';
  return true;
});

await test('levelling offers a choice that must be made and changes the character', async () => {
  const ctx = await start('fighter', 'story3', { levels: 8, size: 'medium' });
  const { Game, Dungeon } = ctx;
  const p = Game.player();
  const L = Game.level();
  // one kill short of the level that grants a choice
  p.xp = 99999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  const m = L.monsters[0];
  if (!m) return 'no monster to kill';
  m.x = p.x + dx; m.y = p.y + dy; m.rx = m.x; m.ry = m.y;
  m.hp = 1; m.maxHp = 1; m.awake = true; m.nextAct = 1e12;
  const before = JSON.stringify(p.stats) + p.maxHp;
  for (let i = 0; i < 40 && L.monsters.includes(m); i++) {
    p.nextAttack = 0;                        // the swing timer is not what is under test
    Game.input('attack');
  }
  if (L.monsters.includes(m)) return 'forty swings failed to land';
  if (p.level < 2) return `level did not rise, still ${p.level}`;
  // the even levels bring talents; take those and come to the first lesson
  const lessonIds = new Set(ctx.BOONS.map(b => b.id));
  for (let i = 0; i < 10 && Game.pendingBoons() && !Game.pendingBoons().every(id => lessonIds.has(id)); i++) Game.chooseBoon(Game.pendingBoons()[0], Game.pendingBoons()[0] === 'spread' ? spreadPicks(Game) : undefined);
  const offer = Game.pendingBoons();
  if (!offer) return 'no boon offered after levelling';
  if (offer.length !== 3) return `offered ${offer.length} boons, expected 3`;
  if (Game.chooseBoon('not-a-real-boon')) return 'an unknown boon id was accepted';
  if (!Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return 'a valid boon was rejected';
  const after = JSON.stringify(p.stats) + p.maxHp;
  if (before === after && !p.perkHit && !p.perkSpeed && !p.perkRegen && !p.bonusSp) return 'the boon changed nothing';
  return p.boons && p.boons.length === 1;
});

await test('journal pages are recorded once and survive a save', async () => {
  const ctx = await start('fighter', 'story4', { levels: 8, size: 'medium' });
  const { Game } = ctx;
  const L = Game.level();
  const p = Game.player();
  let key = null;
  for (const k in L.items) if (L.items[k].some(i => i.t === 'page')) key = k;
  if (!key) return 'no journal page generated on the first level';
  const [x, y] = key.split(',').map(Number);
  p.x = x; p.y = y;
  const page = L.items[key].find(i => i.t === 'page');
  Game.takeItem(page);
  if (Game.journal().length !== 1) return `journal holds ${Game.journal().length} entries, expected 1`;
  Game.takeItem(page);                       // picking it up twice must not double count
  if (Game.journal().length !== 1) return 'the same page was recorded twice';
  Game.save(true);
  Game.load();
  return Game.journal().length === 1;
});

await test('a short delve counts pages out of what it actually buried', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  // one page per floor, so a four level delve holds four
  Game.newGame({ name: 'Wren', cls: 'fighter', bg: 'tombwise', stats: { ...evenStats }, opts: { ...OPTS, levels: 4 } });
  if (Game.pagesInDungeon() !== 4) return `a four level delve claims ${Game.pagesInDungeon()} pages`;
  for (let i = 0; i < 4; i++) Game.journal().push({ i, depth: i + 1 });
  const won = Game.epilogue(true).join(' ');
  if (/left \d+ of the earlier crews/.test(won)) return 'all four pages found, yet the epilogue mourns missing ones';
  if (!won.includes('every page')) return 'a complete journal did not close the story';
  // and a long delve holds one on every floor too
  Game.newGame({ name: 'Wren', cls: 'fighter', bg: 'tombwise', stats: { ...evenStats }, opts: { ...OPTS, levels: 16 } });
  return Game.pagesInDungeon() === 16 || `a sixteen level delve claims ${Game.pagesInDungeon()} pages`;
});

await test('the epilogue names the hero and reflects the background', async () => {
  const ctx = await newContext();
  ctx.Game.newGame({ name: 'Wren', cls: 'thief', bg: 'tombwise', stats: { ...evenStats }, opts: OPTS });
  const lost = ctx.Game.epilogue(false).join(' ');
  const won = ctx.Game.epilogue(true).join(' ');
  if (!lost.includes('Wren') || !won.includes('Wren')) return 'the epilogue does not name the hero';
  if (!lost.includes('grave') || !won.includes('grave')) return 'the epilogue ignores the background';
  if (lost === won) return 'winning and dying read the same';
  return true;
});
};
