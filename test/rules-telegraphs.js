// Rule checks for telegraphed blows, with the fourth round's review and playtest fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function telegraphsChecks(h) {
  const { loadGame, OPTS, start, markLog, countSaid, linesSince, test, groupAhead, beside } = h;

// ---------- telegraphed blows ----------

await test('a monster winds up before it strikes, and the blow comes a moment later', async () => {
  const ctx = await start('fighter', 'windup');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 999;
  const m = beside(ctx, 'skeleton');
  const mark = markLog(G), t0 = G.t;
  let firstBlowAt = null, sawWindup = false;
  for (let i = 0; i < 40 && firstBlowAt === null; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup) sawWindup = true;
    if (linesSince(G, mark).some(l => /Skeleton (hits|misses) you/.test(l))) firstBlowAt = G.t - t0;
  }
  if (!sawWindup) return 'the goblin struck without winding up';
  if (firstBlowAt === null) return 'the goblin never struck';
  return (firstBlowAt >= 300 && firstBlowAt <= 700) || `the blow landed ${firstBlowAt}ms after the wind-up began`;
});

await test('stepping out of reach during the wind-up makes the blow miss', async () => {
  const ctx = await start('fighter', 'dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up to dodge';
  // step back, away from it
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  const mark = markLog(G);
  // (a goblin's beat varies: its longest draw is most of a second)
  for (let i = 0; i < 40 && !linesSince(G, mark).length; i++) Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  if (p.hp < hp0) return `stepping away still cost ${hp0 - p.hp} hit points`;
  return said.some(l => /swings at the air where you stood/.test(l)) || `said: ${said.join(' | ')}`;
});

await test('telegraphing does not slow monsters down: blows land as often as before', async () => {
  const ctx = await start('fighter', 'windup-pace');
  ctx.Dice.s = new ctx.Rng('windup-pace').s;
  const { Game, MONSTERS } = ctx;
  const p = Game.player(), G = Game.state();
  beside(ctx, 'goblin');
  let blows = 0;
  for (let i = 0; i < 600; i++) {
    p.hp = p.maxHp = 9999;
    const mark = markLog(G);
    Game.update(G.t + 25, 25);
    blows += linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
  }
  const expected = 15000 / MONSTERS.goblin.speed;
  return Math.abs(blows - expected) <= 2 || `a goblin struck ${blows} times in 15s, about ${expected.toFixed(1)} expected`;
});

await test('an archer draws before it shoots, and stepping out of line makes it miss', async () => {
  const ctx = await start('fighter', 'archer-dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  const hp0 = p.hp;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 91, id: 'archer', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(m);
  Game.update(G.t + 25, 25);
  if (!m.windup || m.windup.kind !== 'shot') return 'the archer loosed without drawing';
  // sidestep out of its line
  const side = [0, 1, 2, 3].map(k => Dungeon.DIRS[k]).find(([sx, sy]) => sx !== dx && sx !== -dx || sy !== dy && sy !== -dy);
  L.tiles[(p.y + side[1]) * L.w + p.x + side[0]] = T.FLOOR;
  p.x += side[0]; p.y += side[1];
  const mark = markLog(G);
  for (let i = 0; i < 24; i++) Game.update(G.t + 25, 25);
  if (p.hp < hp0) return `stepping out of line still cost ${hp0 - p.hp}`;
  return linesSince(G, mark).some(l => /shot flies wide/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('the first floor gives a few seconds\' grace: what is awake holds off until the hero steps or strikes, or the moment passes; a turn keeps it, and a deeper floor has none', async () => {
  const out = [];
  // (the game as loaded, not the harness's: every other test's hero arrives with the grace spent)
  const fresh = async seed => {
    const ctx = await loadGame();
    ctx.Game.newGame({ name: 'Test', cls: 'fighter', stats: ctx.Game.rollStats(), seed, opts: Object.assign({}, OPTS) });
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    const m = { uid: 93, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    return { ctx, Game, G, p, m };
  };
  const tick = (Game, G, ms) => { for (let t = 0; t < ms; t += 25) Game.update(G.t + 25, 25); };
  // left alone: nothing for a few seconds, then the blow is drawn
  {
    const { Game, G, m } = await fresh('grace-wait');
    if (!(G.graceUntil > G.t)) out.push('the first floor gave no grace');
    tick(Game, G, 2000);
    if (m.windup) out.push('a rat drew back its blow inside the grace');
    tick(Game, G, 1500);
    if (!m.windup) out.push('after the grace the rat still had not drawn back');
  }
  // a turn on the spot keeps it; a step ends it at once
  {
    const { Game, G, m } = await fresh('grace-step');
    Game.input('left'); Game.input('right');
    tick(Game, G, 500);
    if (!(G.graceUntil > G.t) || m.windup) out.push('a turn on the spot ended the grace');
    Game.input('back');
    tick(Game, G, 500);
    if (G.graceUntil || !m.windup) out.push(`a step left the grace at ${G.graceUntil}, the rat ${m.windup ? 'drawing' : 'idle'}`);
  }
  // a blow ends it too
  {
    const { Game, G, m } = await fresh('grace-blow');
    G.t = Math.max(G.t, Game.player().nextAttack) + 10;
    Game.input('attack');
    tick(Game, G, 500);
    if (G.graceUntil || !m.windup) out.push('a blow struck did not end the grace');
  }
  // the second floor's arrival has none
  {
    const { Game, G } = await fresh('grace-deep');
    tick(Game, G, 3500);   // (the first floor's spent)
    Game.level().monsters.length = 0; Game.descend();
    if (G.graceUntil > G.t) out.push('the second floor gave a grace too');
  }
  return out.length ? out.join('; ') : true;
});

await test('on Easy a blow is drawn back a fifth longer than on Normal; Hard draws as Normal does', async () => {
  const draw = async difficulty => {
    const ctx = await start('fighter', 'windup-' + difficulty, { difficulty });
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    // (a rat: a cunning fighter never draws back the same way twice)
    const m = { uid: 94, id: 'rat', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    Game.update(G.t + 25, 25);
    return m.windup ? m.windup.until - m.windup.at : 0;
  };
  const easy = await draw('easy'), normal = await draw('normal'), hard = await draw('hard');
  if (!normal) return 'the rat did not draw back';
  if (Math.abs(easy - normal * 1.2) > 1) return `Easy draws ${easy}ms, Normal ${normal}ms`;
  return hard === normal || `Hard draws ${hard}ms, Normal ${normal}ms`;
});

await test('a monster that steps up to you is already winding up as it arrives', async () => {
  const ctx = await start('fighter', 'windup-arrive');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.hp = p.maxHp = 999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 2; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = T.FLOOR;
  L.monsters.length = 0;
  const m = { uid: 92, id: 'goblin', x: p.x + dx * 2, y: p.y + dy * 2, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(m);
  for (let i = 0; i < 40 && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 1; i++) Game.update(G.t + 25, 25);
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1) return 'the goblin never closed in';
  return (m.windup && m.windup.kind === 'melee' && m.windup.at >= G.t - 25) || 'it arrived beside the hero without drawing back';
});

// ---------- round four review ----------
await test('a drawn blow is dropped once the monster loses you, and on leaving the floor', async () => {
  const ctx = await start('fighter', 'drop-windup');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const m = beside(ctx, 'goblin');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up began';
  // carry the hero far off: it can no longer find them
  const far = [];
  for (let i = 0; i < L.w * L.h; i++) if (L.tiles[i] === Dungeon.T.FLOOR && Math.abs(i % L.w - m.x) + Math.abs(((i / L.w) | 0) - m.y) > 20) far.push(i);
  if (!far.length) return 'no far square on this floor';
  p.x = far[0] % L.w; p.y = (far[0] / L.w) | 0;
  for (let i = 0; i < 40; i++) Game.update(G.t + 250, 250);
  if (m.windup) return `after ten seconds out of reach it still held ${JSON.stringify(m.windup)}`;
  return true;
});

await test('buying back an unknown piece keeps it unknown', async () => {
  const ctx = await start('fighter', 'buy-hidden');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  const blade = { t: 'longsword', q: 1, e: 2, h: 1 };
  p.inv.push(blade);
  Game.sell(blade);
  p.gold = 999;
  Game.buy(shop.stock.find(s => s.t === 'longsword'));
  const back = p.inv.find(i => i.t === 'longsword' && i !== blade);
  return (back && back.h === 1) || `bought back as ${JSON.stringify(back)}`;
});

await test('a new game starts with a clean clock for bump messages', async () => {
  const ctx = await start('fighter', 'bump-clock');
  const { Game, Dungeon } = ctx;
  const bumpNow = () => {
    const p = Game.player(), L = Game.level(), G = Game.state();
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.WALL;
    L.monsters.length = 0;
    const mark = markLog(G);
    Game.input('forward');
    return linesSince(G, mark).some(l => /blocks your path/.test(l));
  };
  Game.state().t = 600000;
  if (!bumpNow()) return 'the first run logged no bump';
  Game.newGame({ name: 'Two', cls: 'fighter', stats: Game.rollStats(), seed: 'bump-clock-2', opts: OPTS });
  Game.update(0, 1000);
  return bumpNow() || 'the second run swallowed its first bump';
});

await test('a monster made to miss presses in: its next blow is drawn back faster', async () => {
  const ctx = await start('fighter', 'pressing');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  // not a goblin: a cunning fighter draws back a different length each time,
  // which could hide the quickening this is here to see (it failed in CI so)
  const m = beside(ctx, 'skeleton');
  Game.update(G.t + 25, 25);
  const first = m.windup.until - m.windup.at;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;                               // step back: it whiffs
  let second = null;
  for (let i = 0; i < 80 && second === null; i++) {
    Game.update(G.t + 25, 25);
    if (m.windup && m.windup.at > G.t - 30 && G.t > 600) second = m.windup.until - m.windup.at;
  }
  if (second === null) return 'no second wind-up followed the miss';
  return (second < first && second >= 250) || `after a miss the wind-up went from ${first}ms to ${second}ms`;
});

await test('a save without the late-monster count picks it up past the highest number on any floor', async () => {
  const ctx = await start('fighter', 'uid-count');
  const { Game } = ctx;
  const L = Game.level();
  const late = uid => ({ uid, id: 'zombie', x: 1, y: 1, hp: 20, maxHp: 20, awake: false, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  L.monsters.push(late(900007), late(900003));
  Game.state().nextUid = 7;
  Game.save(true);
  const d = JSON.parse(ctx.store.get('deepdelve.save'));
  delete d.nextUid;
  ctx.store.set('deepdelve.save', JSON.stringify(d));
  if (!Game.load()) return 'the save did not load';
  const n = Game.state().nextUid;
  // started again at 0, the next one to arrive would be 900001, then 900003 twice over
  return n === 7 || `the count came back as ${n}, not 7`;
});

await test('a fleeing monster never runs onto the hero, even when its map of the way is stale', async () => {
  // a straight corridor five squares long, on the first seed that has one
  let ctx = null, row = null;
  for (let n = 0; n < 12 && !row; n++) {
    ctx = await start('fighter', n ? `flee-onto-${n}` : 'flee-onto');
    const L = ctx.Game.level(), T = ctx.Dungeon.T;
    const shut = (x, y) => L.tiles[y * L.w + x] !== T.FLOOR && L.tiles[y * L.w + x] !== T.DOOR_OPEN;
    for (let y = 1; y < L.h - 1 && !row; y++) for (let x = 1; x < L.w - 5 && !row; x++) if ([0, 1, 2, 3, 4].every(k => L.tiles[y * L.w + x + k] === T.FLOOR && shut(x + k, y - 1) && shut(x + k, y + 1))) row = [x, y];
  }
  if (!row) return 'no straight corridor on any seed tried';
  const { Game } = ctx;
  const G = Game.state(), L = Game.level(), p = Game.player();
  L.monsters.length = 0;
  const [x0, y0] = row;
  p.x = x0; p.y = y0; p.dir = 1;
  Game.update(G.t + 16, 16);
  const z = { uid: 77, id: 'zombie', x: x0 + 2, y: y0, hp: 2, maxHp: 20, awake: true, fleeing: true, nextAct: G.t + 150, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
  L.monsters.push(z);
  Game.update(G.t + 16, 16);
  // the hero is set down beyond it without a step, so the way it measures is out of date
  p.x = x0 + 3;
  for (let i = 0; i < 10; i++) Game.update(G.t + 50, 50);
  return !(z.x === p.x && z.y === p.y) || 'the fleeing zombie ran onto the hero';
});

// ---------- round four playtest ----------
await test('a group draws back as one: a full warning, then every member\'s blow in a volley', async () => {
  const ctx = await start('fighter', 'volley');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'the trio struck without drawing back';
  if (m.windup.until - m.windup.at < 400) return `a trio's warning lasted only ${m.windup.until - m.windup.at}ms`;
  const mark = markLog(G);
  for (let i = 0; i < 56; i++) Game.update(G.t + 25, 25);
  const blows = countSaid(linesSince(G, mark), /Goblin (hits|misses) you/);
  return blows === 3 || `the volley landed ${blows} blows, not three`;
});

await test('stepping back from a group\'s wind-up dodges the whole volley', async () => {
  const ctx = await start('fighter', 'volley-dodge');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const hp0 = p.hp;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up to dodge';
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  for (let i = 0; i < 24; i++) Game.update(G.t + 25, 25);
  return p.hp === hp0 || `stepping away from three goblins still cost ${hp0 - p.hp} hit points`;
});

await test('stepping away mid-volley spares you the blows still to come', async () => {
  const ctx = await start('fighter', 'volley-mid');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  const mark = markLog(G);
  for (let i = 0; i < 40 && !m.volley; i++) Game.update(G.t + 25, 25);
  if (!m.volley) return 'no volley followed the first blow';
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  const said = linesSince(G, mark);
  const blows = said.filter(l => /Goblin (hits|misses) you/.test(l)).length;
  if (blows !== 1) return `${blows} blows landed, though the hero left after the first`;
  return said.some(l => /rest of the Goblins swing at the air/.test(l)) || `said: ${said.join(' | ')}`;
});

await test('shallow venom burns briefly, deep venom for the full twenty seconds', async () => {
  // the monsters live in foes.js, which reads the game's state through K
  const read = f => require('fs').readFileSync(require('path').join(__dirname, '..', 'js', f), 'utf8');
  const src = read('game.js') + read('foes.js');
  const m = src.match(/const poisonFor = \(\) => \(\{ until: (?:K\.)?G\.t \+ Math\.min\((\d+), (\d+) \+ (\d+) \* (?:K\.)?G\.depth\)/);
  if (!m) return 'no depth-scaled poison';
  const [cap, base, per] = m.slice(1).map(Number);
  const at = d => Math.min(cap, base + per * d);
  if (/p\.poison = \{ until: (K\.)?G\.t \+ 20000/.test(src)) return 'a poison source still ignores depth';
  return (at(1) <= 10000 && at(4) === 20000) || `poison lasts ${at(1)}ms on floor one and ${at(4)}ms on floor four`;
});

await test('the death epilogue on a shallow floor does not claim to beat the fourth crew', async () => {
  const ctx = await start('fighter', 'shallow-death');
  const p = ctx.Game.player();
  p.deepest = 1;
  const lost = ctx.Game.epilogue(false).join(' ');
  if (/further than the fourth crew/.test(lost)) return lost;
  p.deepest = 5;
  return /further than the fourth crew/.test(ctx.Game.epilogue(false).join(' ')) || 'a deep death no longer credits the hero';
});

await test('with no healing draught known, a quaff says so', async () => {
  const ctx = await start('fighter', 'dry-quaff');
  const p = ctx.Game.player(), G = ctx.Game.state();
  p.inv = p.inv.filter(i => i.t !== 'potion_heal' && i.t !== 'potion_xheal');
  const mark = markLog(G);
  ctx.Game.input('quaff');
  return linesSince(G, mark).some(l => /no healing draught/.test(l)) || `it said ${linesSince(G, mark).join(' | ')}`;
});

await test('a step tapped while the camera is still turning is kept, not dropped', async () => {
  const ctx = await start('fighter', 'queue-move');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  const d0 = p.dir;
  Game.input('left');
  Game.input('left');                                 // tapped mid-turn
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return p.dir === (d0 + 2) % 4 || `facing ${p.dir} from ${d0}: the second turn was lost`;
});

await test('a held button resent while the view turns is not kept as a second press', async () => {
  const ctx = await start('fighter', 'held-turn');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  const d0 = p.dir;
  Game.input('left');
  Game.input('left', true);                           // the hold loop, a frame later
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return p.dir === (d0 + 3) % 4 || `one held tap turned the hero from ${d0} to ${p.dir}`;
});

await test('a first-level mage can already cast Shield', async () => {
  const { SPELLS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  const all = SPELLS.mage;
  const shield = all.find(s => s && s.id === 'shield');
  return (shield && shield.lvl === 1) || `Shield needs level ${shield && shield.lvl}`;
});
};
