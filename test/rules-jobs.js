// Rule checks for the jobs the traders give (bounty.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function jobsChecks(h) {
  const { OPTS, newContext, start, seedDice, markLog, countSaid, linesSince, test, groupAhead, beside, pinned, ahead, run, shopAhead, takeJob, downOne, downTo, druid } = h;

// ---------- jobs from the traders ----------
/** Strike down a monster brought to stand in front of the hero. */
function strikeDown(ctx, m) {
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), [dx, dy] = Dungeon.DIRS[p.dir];
  Game.level().tiles[(p.y + dy) * Game.level().w + p.x + dx] = Dungeon.T.FLOOR;
  Object.assign(m, { x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12 });
  delete m.pack;
  p.perkHit = 60;
  for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  return !Game.level().monsters.includes(m);
}

await test('a trader\'s job: kill so many on the floor below, and the next trader pays gold and a flask or scroll', async () => {
  const out = [];
  const ctx = await start('fighter', 'job-cull');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const why = takeJob(ctx);
  if (why) return why;
  const b = Game.bounty();
  b.kind = 'cull'; b.need = 3;
  if (b.depth !== 2 || !(b.reward.gold > 0) || !b.reward.t) out.push(`the job: ${JSON.stringify(b)}`);
  // the same trader has nothing more to offer, and says so
  shopAhead(ctx);
  const again = Game.shopServices().find(s => s.id === 'bounty');
  if (!again || !again.why) out.push('a second job was offered with one in hand');
  Game.closeShop();
  const mark = markLog(G);
  downOne(ctx);
  if (!b.started || !linesSince(G, mark).some(l => /The job the trader gave you is here/.test(l))) out.push('arriving did not start the job');
  if (Game.bountyChip() !== 'Job: 0 of 3 slain') out.push(`the chip read ${Game.bountyChip()}`);
  // a trader met with the job not yet done pays nothing
  const g0 = p.gold;
  shopAhead(ctx);
  if (Game.bounty() !== b || p.gold !== g0) out.push('a trader paid for a job not yet done');
  Game.closeShop();
  for (let i = 0; i < 3; i++) {
    const m = beside(ctx, 'rat', { uid: 600 + i });
    if (!strikeDown(ctx, m)) out.push(`rat ${i} would not fall`);
  }
  if (!b.done || b.got !== 3) out.push(`after three kills: got ${b.got}, done ${b.done}`);
  if (!/done/.test(Game.bountyChip())) out.push(`done, the chip read ${Game.bountyChip()}`);
  if (!Game.threadNotes().some(n => n.startsWith('A job from the traders'))) out.push('the hero sheet does not list the job');
  const gold = p.gold, reward = b.reward;
  const inv = p.inv.filter(i => i.t === reward.t).reduce((a, i) => a + (i.q || 1), 0);
  shopAhead(ctx);
  if (Game.bounty()) out.push('the next trader did not pay');
  if (p.gold !== gold + reward.gold) out.push(`paid ${p.gold - gold} gold, not ${reward.gold}`);
  if (p.inv.filter(i => i.t === reward.t).reduce((a, i) => a + (i.q || 1), 0) !== inv + 1) out.push(`no ${reward.t} in the pack`);
  if (G.stats.bounties !== 1) out.push(`jobs done: ${G.stats.bounties}`);
  // and this trader has a job of its own now
  const next = Game.shopServices().find(s => s.id === 'bounty');
  if (!next || next.why) out.push('the paying trader offered no job of its own');
  return out.length ? out.join('; ') : true;
});

await test('a satchel job lays the satchel far across the floor below; a champion job is its champion; a job left undone is lost', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'job-fetch');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const why = takeJob(ctx);
    if (why) return why;
    Game.bounty().kind = 'fetch';
    downOne(ctx);
    const L = Game.level(), k = Object.keys(L.items).find(key => L.items[key].some(i => i.t === 'satchel'));
    if (!k) return 'no satchel on the floor below';
    const [x, y] = k.split(',').map(Number);
    if (Math.abs(x - L.start.x) + Math.abs(y - L.start.y) < 8) out.push(`the satchel lay ${Math.abs(x - L.start.x) + Math.abs(y - L.start.y)} squares from the stair`);
    p.x = x; p.y = y;
    Game.takeItem(L.items[k].find(i => i.t === 'satchel'));
    if (!Game.bounty().done) out.push('picking up the satchel did not finish the job');
    shopAhead(ctx);
    if (p.inv.some(i => i.t === 'satchel')) out.push('the satchel stayed in the pack once paid for');
    if (Game.shopServices().length && Game.currentShop() && p.inv.some(i => i.t === 'satchel')) out.push('the satchel could be sold');
    void G;
  }
  {
    const ctx = await start('fighter', 'job-slay', { levels: 8 });
    const { Game } = ctx; const G = Game.state();
    Game.player().hp = Game.player().maxHp = 9999;
    downOne(ctx);                                    // to floor 2: the floor below holds a champion
    const plan = ctx.Dungeon.namedPlan(G.seed, 8, G.route || undefined);
    if (!plan[3]) return `this seed's plan has no champion on floor 3: ${JSON.stringify(plan)}`;
    const why = takeJob(ctx);
    if (why) return why;
    if (Game.bounty().kind !== 'slay') out.push(`the job for floor 3 is ${Game.bounty().kind}, not the champion`);
    downOne(ctx);
    const b = Game.bounty();
    const champ = Game.level().monsters.find(m => ctx.MONSTERS[m.id].named);
    if (!champ || b.target !== champ.id || !b.name) out.push(`the job's target: ${b.target}, the floor's champion: ${champ && champ.id}`);
    else {
      const other = beside(ctx, 'rat', { uid: 650 });
      Game.level().monsters.push(champ);
      strikeDown(ctx, other);
      if (b.done) out.push('a rat finished the champion\'s job');
      if (!strikeDown(ctx, champ)) out.push('the champion would not fall');
      if (!b.done) out.push('slaying the champion did not finish the job');
    }
  }
  {
    const ctx = await start('fighter', 'job-lost');
    const { Game } = ctx; const G = Game.state();
    const why = takeJob(ctx);
    if (why) return why;
    downOne(ctx);
    const mark = markLog(G);
    downOne(ctx);
    if (Game.bounty()) out.push('the job went on to the next floor');
    if (!linesSince(G, mark).some(l => /no pay for it now/.test(l))) out.push('losing the job was not told');
    // no job for the floor that holds the lich
    G.depth = G.opts.levels - 1;
    shopAhead(ctx);
    if (Game.shopServices().some(s => s.id === 'bounty')) out.push('a job was offered for the lich\'s floor');
  }
  return out.length ? out.join('; ') : true;
});

await test('one sworn to go unaided cannot drink the trader\'s tonic', async () => {
  const ctx = await start('fighter', 'unaided-tonic');
  const { Game } = ctx;
  Game.state().opts.vows = ['unaided'];
  if (!shopAhead(ctx)) return 'the shop did not open';
  const t = Game.shopServices().find(x => x.id === 'tonic');
  if (!t || !/unaided/.test(t.why || '')) return `the tonic is offered: ${t && (t.why || t.detail)}`;
  const hp = Game.player().maxHp;
  Game.player().gold = 9999;
  Game.buyService('tonic');
  return Game.player().maxHp === hp || 'the tonic was drunk anyway';
});

await test('the forge says a piece that kept its minus as a minus, never "+-1"', async () => {
  const ctx = await start('fighter', 'temper-minus');
  const { Game } = ctx;
  if (!shopAhead(ctx)) return 'the shop did not open';
  const p = Game.player();
  p.eq.weapon = { t: 'longsword', q: 1, e: -2 };
  const hone = Game.shopServices().find(x => x.id === 'hone');
  if (!hone || /\+-|\+−/.test(hone.detail) || !/becomes −1/.test(hone.detail)) return `from −2 the forge offers: ${hone && hone.detail}`;
  p.eq.weapon.e = -1;
  const again = Game.shopServices().find(x => x.id === 'hone');
  return /loses its −1/.test(again.detail) || `from −1 the forge offers: ${again.detail}`;
});

await test('a score raised by an encounter moves a caster\'s spell points at once, and a reload keeps them', async () => {
  for (let t = 0; t < 30; t++) {
    const ctx = await start('cleric', 'mirror-sp' + t);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    p.stats.wis = 13; p.level = 4;
    Game.save(true); Game.load();
    const q = Game.player(), M = Game.level();
    M.npcs.length = 0; M.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[q.dir];
    M.tiles[(q.y + dy) * M.w + q.x + dx] = Dungeon.T.FLOOR;
    M.npcs.push({ kind: 'encounter', id: 'mirror', x: q.x + dx, y: q.y + dy });
    Game.input('forward');
    const before = q.maxSp;
    const r = Game.chooseEncounter(0);
    // a d20 check fails on a one whatever the score: another hero tries
    if (!r || !r.check || !r.check.pass || q.stats.wis !== 14) continue;
    const now = q.maxSp;
    if (now <= before) return `wisdom rose to 14 and the spell points stayed at ${now}`;
    Game.closeEncounter(); Game.save(true); Game.load();
    return Game.player().maxSp === now || `the spell points were ${now}, and ${Game.player().maxSp} after a reload`;
  }
  return 'no hero passed the mirror in thirty tries';
});

await test('a trickster finding gold in an encounter is told the sum the purse really gained', async () => {
  for (let t = 0; t < 40; t++) {
    const ctx = await start('thief', 'trick-gold' + t);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), L = Game.level();
    p.path = 'trickster'; for (const k in p.stats) p.stats[k] = 40;
    L.npcs.length = 0; L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.npcs.push({ kind: 'encounter', id: 'wired', x: p.x + dx, y: p.y + dy });
    Game.input('forward');
    const g0 = p.gold;
    const r = Game.chooseEncounter(1);
    const line = r && r.check && r.check.pass && r.lines.find(l => /Gold ×\d+/.test(l));
    if (!line) continue;
    const said = Number(/Gold ×(\d+)/.exec(line)[1]);
    return said === p.gold - g0 || `the card said ${said} gold and the purse gained ${p.gold - g0}`;
  }
  return 'no trickster found gold behind the wire in forty tries';
});

await test('the Heart waits on a dais at the far end of a long hall, and its keeper wakes the moment a hero sets foot in it', async () => {
  const ctx = await start('thief', 'keeper-hall', { levels: 4, size: 'medium' });
  const { Game } = ctx; const G = Game.state();
  Game.player().hp = Game.player().maxHp = 9999;
  downTo(ctx, 4);
  const L = Game.level(), p = Game.player();
  const hi = L.rooms.findIndex(r => r.shape === 'sanctum'), r = L.rooms[hi];
  if (hi < 0) return 'the last floor has no hall';
  const lich = L.monsters.find(m => m.id === 'lich');
  if (!lich || L.roomId[lich.y * L.w + lich.x] !== hi) return 'the lich is not in its hall';
  L.monsters = L.monsters.filter(m => m === lich);
  lich.awake = false; lich.nextAct = G.t;
  // a thief just inside the way in, ten squares and more from it: quiet, and still found
  p.x = r.x; p.y = r.y + 3; p.dir = 1;
  if (Math.abs(lich.x - p.x) + Math.abs(lich.y - p.y) < 9) return `the lich stands only ${Math.abs(lich.x - p.x) + Math.abs(lich.y - p.y)} squares from the way in`;
  for (let i = 0; i < 20 && !lich.awake; i++) Game.update(G.t + 25, 25);
  if (!lich.awake) return 'the lich slept on with a hero in its hall';
  // and outside its hall, the same distance off, it sleeps
  lich.awake = false; lich.spoke = false; p.x = r.x - 2; p.y = r.y + 3;
  if (L.roomId[p.y * L.w + p.x] === hi) return 'two squares outside the way in is still the hall';
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return !lich.awake || 'the lich woke with the hero outside its hall';
});

await test('each set piece comes in versions, dealt by the seed, each with its own line and what lies in it', async () => {
  const ctx = await newContext();
  const { Dungeon, PIECE_VARIANTS } = ctx;
  const opts = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
  const out = [], seen = {};
  const count = (L, k) => L.piece.props.filter(q => q.k === k).length;
  for (let s = 0; s < 60; s++) for (let d = 1; d <= 4; d++) {
    const L = Dungeon.generate('versions-' + s, d, opts), pc = L.piece;
    if (!pc) continue;
    const key = pc.kind + '/' + pc.variant;
    if (!PIECE_VARIANTS[pc.kind] || !PIECE_VARIANTS[pc.kind][pc.variant]) { out.push(`a ${pc.kind} of no known version: ${pc.variant}`); continue; }
    // nothing it holds that stands in the way cuts the room in two
    const parts = stood => {
      const sq = new Set(), at = new Set(stood.map(q => q.x + ',' + q.y));
      L.roomId.forEach((id, i) => { const c = (i % L.w) + ',' + Math.floor(i / L.w); if (id === pc.room && L.tiles[i] === Dungeon.T.FLOOR && !at.has(c)) sq.add(c); });
      let n = 0;
      for (const c of sq) { n++; const todo = [c]; sq.delete(c); while (todo.length) { const [x, y] = todo.pop().split(',').map(Number); for (const [dx, dy] of Dungeon.DIRS) { const o = (x + dx) + ',' + (y + dy); if (sq.delete(o)) todo.push(o); } } }
      return n;
    };
    if (parts(pc.props.filter(q => ['barrel', 'crate', 'urn'].includes(q.k))) !== parts([])) out.push(`versions-${s} floor ${d}: ${key} has its room cut in two by what stands in it`);
    // a storeroom is crates and casks, never bones; a cask gives up its square to a creature
    // standing there, so the whole stock is looked for in one storeroom or another
    if (key === 'cells/stores') {
      if (count(L, 'bones')) out.push(`a storeroom holds bones: ${JSON.stringify(pc.props.map(q => q.k))}`);
      if (count(L, 'crate') >= 3 && count(L, 'barrel') >= 2) seen.storesWhole = true;
    }
    if (seen[key]) continue;
    seen[key] = true;
    // the same seed deals the same version
    if (Dungeon.generate('versions-' + s, d, opts).piece.variant !== pc.variant) out.push(`${key} not dealt again by its seed`);
    const open = L.roomId.reduce((n, id, i) => n + (id === pc.room && L.tiles[i] === Dungeon.T.FLOOR ? 1 : 0), 0);
    if (key === 'cells/kennels' && count(L, 'shackles') < 2) out.push('the kennels have no chains');
    if (key === 'shrine/defiled' && (count(L, 'candles') || count(L, 'bones') < 3)) out.push('the defiled shrine still has its candles, or no bones');
    if (key === 'shrine/kept' && (count(L, 'candles') < 4 || count(L, 'urn') < 3)) out.push('the kept shrine has no offerings');
    // (all but what stands in the water, and the squares kept clear by its ways in)
    if (key === 'cistern/brimming' && count(L, 'puddle') < open * 0.8) out.push(`a brimming cistern wet ${count(L, 'puddle')} of ${open} squares`);
    if (key === 'cistern/silted' && (count(L, 'puddle') > open * 0.5 || count(L, 'mushrooms') < 3)) out.push(`a silted cistern wet ${count(L, 'puddle')} of ${open} squares`);
    if (key === 'rubble/buried' && count(L, 'bones') < 3) out.push('no bones in the buried hall');
    // and what lies in it is laid where the floor's dressing puts it
    for (const q of pc.props) if (q.k !== 'puddle' && !(L.dressing || []).some(r => r.x === q.x && r.y === q.y && r.k === q.k)) { out.push(`${key}: its ${q.k} was not laid`); break; }
  }
  const all = Object.entries(PIECE_VARIANTS).flatMap(([k, vs]) => Object.keys(vs).map(v => k + '/' + v));
  const missing = all.filter(k => !seen[k]);
  if (missing.length) out.push(`never dealt: ${missing.join(', ')}`);
  if (all.length < 12) out.push(`only ${all.length} versions`);
  for (const k of all) { const [kind, v] = k.split('/'); if (!ctx.PIECE_SAY[kind][v]) out.push(`${k} says nothing`); }
  if (seen['cells/stores'] && !seen.storesWhole) out.push('no storeroom held its three crates and two casks');
  return out.length ? out.join('; ') : true;
});

await test('every floor holds a set piece, and the first step into it says what it is, once', async () => {
  const ctx = await start('fighter', 'piece-step', { levels: 8, size: 'medium' });
  const { Game, Dungeon } = ctx; const G = Game.state(), T = Dungeon.T;
  Game.player().hp = Game.player().maxHp = 9999;
  const said = {};
  for (let depth = 1; depth <= 4; depth++) {
    if (depth > 1) downTo(ctx, depth);
    const L = Game.level(), p = Game.player(), pc = L.piece;
    if (!pc) return `floor ${depth} has no set piece`;
    L.monsters.length = 0; L.npcs.length = 0;
    // a square just outside it, beside one of its open squares, to step in from
    let from = null;
    for (let i = 0; i < L.w * L.h && !from; i++) {
      if (L.roomId[i] !== pc.room || L.tiles[i] !== T.FLOOR) continue;
      const x = i % L.w, y = (i / L.w) | 0;
      for (let k = 0; k < 4 && !from; k++) {
        const [dx, dy] = Dungeon.DIRS[k], ox = x - dx, oy = y - dy, o = oy * L.w + ox;
        // (a way in may be a doorway: open it and step in from there)
        if ([T.FLOOR, T.DOOR].includes(L.tiles[o]) && L.roomId[o] !== pc.room) { L.tiles[o] = L.tiles[o] === T.DOOR ? T.DOOR_OPEN : T.FLOOR; from = { x: ox, y: oy, dir: k }; }
      }
    }
    if (!from) return `no way into the ${pc.kind} on floor ${depth}`;
    const step = () => {
      delete L.items[`${from.x + Dungeon.DIRS[from.dir][0]},${from.y + Dungeon.DIRS[from.dir][1]}`]; L.traps = {};
      for (let i = 0; i < 40; i++) Game.update(G.t + 25, 25);     // the last step done with
      p.x = from.x; p.y = from.y; p.dir = from.dir;
      const m = markLog(G); Game.input('forward');
      return { lines: linesSince(G, m), inside: L.roomId[p.y * L.w + p.x] === pc.room };
    };
    const first = step();
    const line = ctx.PIECE_SAY[pc.kind][pc.variant];
    if (!line) return `the ${pc.kind} has a version with nothing to say: ${pc.variant}`;
    if (!first.inside || !first.lines.includes(line)) return `stepping into the ${pc.kind} (${first.inside ? 'in' : 'not in'}) said: ${first.lines.join(' | ')}`;
    const again = step();
    if (!again.inside) return `the second step did not go into the ${pc.kind}`;
    // (counted over the whole log: a line said again straight after itself is folded into one)
    const told = countSaid(G.log.map(e => e.m), new RegExp('^' + line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (told !== 1) return `the ${pc.kind} was told of ${told} times`;
    said[pc.kind] = true;
  }
  return Object.keys(said).length === 4 || `four floors met only ${Object.keys(said).join(', ')}`;
});

await test('a champion risen on a restless floor keeps a champion\'s life', async () => {
  // a seed whose second floor is restless, where an Ancient rises as an Ancient
  // undead: one once had the life of a plain zombie, within one roll of 4d8+2
  // (searched for, not named: a named seed lasted only until the maps next changed)
  let ctx = null, risen = [];
  for (let i = 0; i < 400 && !risen.length; i++) {
    const probe = await newContext();
    if ((probe.Dungeon.twistPlan('rs' + i, 8) || {})[2] !== 'restless') continue;
    ctx = await start('fighter', 'rs' + i, { levels: 8, size: 'medium', monsters: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' });
    while (ctx.Game.state().depth < 2) { ctx.Game.level().monsters.length = 0; ctx.Game.descend(); }
    const Lv = ctx.Game.level();
    if (Lv.twist === 'restless') risen = Lv.monsters.filter(m => m.elite && ctx.MONSTERS[m.id].undead && m.elite === 'Ancient');
  }
  if (!risen.length) return 'no seed of four hundred had an Ancient risen on a restless second floor';
  const { MONSTERS } = ctx;
  const plainMost = b => b.hp[0] * b.hp[1] + b.hp[2] + 1;
  const weak = risen.filter(m => m.maxHp <= plainMost(MONSTERS[m.id]));
  return !weak.length || `an Ancient ${weak[0].id} rose with ${weak[0].maxHp} life, no more than a plain one`;
});

/** Walk into an encounter's stone set just ahead. */
const encounterAhead = (ctx, id) => {
  const { Game, Dungeon } = ctx, p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
  L.npcs.length = 0; L.monsters.length = 0;
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.npcs.push({ kind: 'encounter', id, x: p.x + dx, y: p.y + dy });
  Game.input('forward');
  return !!Game.currentEncounter();
};

await test('a loss of maximum hit points stopped by the floor of ten is said as the loss it was', async () => {
  for (let t = 0; t < 40; t++) {
    const ctx = await start('fighter', 'mirror-floor' + t);
    const { Game } = ctx;
    const p = Game.player();
    p.maxHp = 11; p.hp = 11;
    for (const k in p.stats) p.stats[k] = 3;
    if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open';
    const r = Game.chooseEncounter(0);
    // a natural twenty passes whatever the score: another hero tries
    if (!r || !r.check || r.check.pass) continue;
    if (p.maxHp !== 10) return `maximum hit points came to ${p.maxHp}, not 10`;
    const said = r.lines.join(' | ');
    return (/−1 maximum hit points/.test(said) && !/−3 maximum/.test(said)) || `the card said: ${said}`;
  }
  return 'nobody failed at the mirror in forty tries';
});

await test('an encounter left open does not carry into a loaded game or a new run', async () => {
  const ctx = await start('fighter', 'enc-stale');
  const { Game } = ctx;
  Game.save(true);
  if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open';
  if (!Game.load()) return 'the save did not load';
  if (Game.currentEncounter()) return 'the encounter was still open in the loaded game';
  if (!encounterAhead(ctx, 'mirror')) return 'the mirror did not open a second time';
  Game.newGame({ name: 'Next', cls: 'thief', stats: Game.rollStats(), seed: 'enc-stale-2', opts: OPTS });
  return !Game.currentEncounter() || 'the encounter was still open in a new run';
});

await test('a snare holds two and a half seconds; a Warden\'s a second longer, a Sharpshooter\'s a second and a half', async () => {
  const out = [];
  for (const [path, ms] of [[null, 2500], ['warden', 3500], ['sharpshooter', 4000]]) {
    const ctx = await start('ranger', 'snare-hold-' + path);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999; p.path = path;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
    L.monsters.length = 0;
    L.monsters.push({ uid: 96, id: 'orc', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    if (!Game.useAbility()) { out.push(`no snare thrown (${path})`); continue; }
    const held = Game.level().monsters[0].snaredUntil - G.t;
    if (held !== ms) out.push(`${path || 'no path'}: held ${held}ms, not ${ms}`);
    if (Game.level().monsters[0].heldBy !== 'snare') out.push(`what held it was marked ${Game.level().monsters[0].heldBy}, not a snare, for its picture`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a snared foe stays snared through a save and a load', async () => {
  const ctx = await start('ranger', 'snare-load');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G0 = Game.state(), L = Game.level();
  p.hp = p.maxHp = 9999;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (let i = 1; i <= 3; i++) L.tiles[(p.y + dy * i) * L.w + p.x + dx * i] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.monsters.push({ uid: 95, id: 'orc', x: p.x + dx * 3, y: p.y + dy * 3, hp: 999, maxHp: 999, awake: true, nextAct: G0.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  if (!Game.useAbility()) return 'the snare was not thrown';
  const held = Game.level().monsters[0];
  if (!(held.snaredUntil > G0.t + 1500)) return 'the orc was not snared';
  const x0 = held.x, y0 = held.y, until = held.snaredUntil;
  Game.save(true);
  if (!Game.load()) return 'the save did not load';
  const G = Game.state();
  for (let i = 0; i < 80; i++) {
    Game.update(G.t + 25, 25);
    const m = Game.level().monsters[0];
    if (G.t >= until - 50) break;
    if (m.x !== x0 || m.y !== y0 || m.windup) return `the orc moved ${Math.round(until - G.t)}ms before the snare let go`;
  }
  return true;
});

await test('a Potion of Might adds its +2 whole to a dagger\'s blow, not scaled down by the blade\'s weight', async () => {
  const ctx = await start('fighter', 'might-whole');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  const gain = t => {
    p.eq.weapon = { t, q: 1, e: 0 }; p.eq.shield = null; p.eq.offhand = null;
    delete p.effects.might; const off = Game.blowRate(p.eq.weapon);
    p.effects.might = { amount: 2, until: G.t + 120000 }; const on = Game.blowRate(p.eq.weapon);
    delete p.effects.might;
    return on - off;
  };
  // the same +2 a blow is worth more a second on a quick blade; scaled by weight, it was worth the same on every one
  const dagger = gain('dagger'), great = gain('greatsword');
  return dagger > great * 1.5 || `+2 a blow came to ${dagger.toFixed(2)} a second on a dagger and ${great.toFixed(2)} on a greatsword`;
});

await test('Weapon Master\'s +1 lands on the second blade too', async () => {
  const ctx = await start('fighter', 'wm-offhand');
  const { Game } = ctx;
  const p = Game.player();
  const gain = two => {
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 }; p.eq.shield = null; p.eq.offhand = two ? { t: 'dagger', q: 1, e: 0 } : null;
    p.talents = []; const off = Game.blowRate(p.eq.weapon);
    p.talents = ['weapon_master']; const on = Game.blowRate(p.eq.weapon);
    p.talents = [];
    return on - off;
  };
  const one = gain(false), two = gain(true);
  // two blades swing a little slower, but two +1s a round outweigh it; one +1 did not
  return two > one || `the talent added ${one.toFixed(2)} a second with one dagger and ${two.toFixed(2)} with two`;
});

await test('Slow to Bleed closes wounds half again as fast, even on a small pool of life', async () => {
  const healed = async perk => {
    const ctx = await start('mage', 'hardy-heal');
    const { Game } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    L.monsters.length = 0;
    p.maxHp = 20; p.hp = 5; p.perkRegen = perk ? 0.5 : 0; p.regenCarry = 0; p.nextRegen = G.t;
    let total = 0;
    for (let i = 0; i < 400; i++) { const was = p.hp; p.hp = Math.min(p.hp, 9); Game.update(G.t + 100, 100); total += Math.max(0, p.hp - Math.min(was, 9)); p.hp = 5; }
    return total;
  };
  const plain = await healed(false), hardy = await healed(true);
  if (!plain) return 'no natural healing happened at all';
  const r = hardy / plain;
  return (r > 1.4 && r < 1.6) || `with Slow to Bleed a 20-life hero healed ${hardy} to ${plain}, ${r.toFixed(2)} times`;
});

await test('Practised Hands makes a swing 8% sooner at every level, no more', async () => {
  const ctx = await start('fighter', 'swift-exact');
  const { Game } = ctx;
  const p = Game.player();
  const out = [];
  for (const level of [1, 5, 10]) {
    p.level = level;
    p.perkSpeed = 0; const now = Game.blowRate(p.eq.weapon);
    p.perkSpeed = 0.08; const next = Game.blowRate(p.eq.weapon);
    // the same blow, sooner: a rate higher by exactly 1/0.92
    const r = next / now;
    if (Math.abs(r - 1 / 0.92) > 0.002) out.push(`level ${level}: ${((1 - 1 / r) * 100).toFixed(1)}% sooner`);
  }
  p.perkSpeed = 0;
  return !out.length || out.join('; ');
});

await test('a trickster\'s gold from an encounter is a quarter more, as gold found anywhere is', async () => {
  const ctx = await start('thief', 'trick-shelves');
  const { Game } = ctx;
  const p = Game.player();
  p.path = 'trickster';
  if (!encounterAhead(ctx, 'shelves')) return 'the shelves did not open';
  const g0 = p.gold;
  const r = Game.chooseEncounter(2);
  const want = Math.round(8 * Game.state().depth * 1.25);
  if (p.gold - g0 !== want) return `the gilt book gave ${p.gold - g0} gold, not ${want}`;
  return r.lines.some(l => l.includes(`+${want} gold`)) || `the card said: ${r.lines.join(' | ')}`;
});

await test('in a Hard Long Delve a fighter\'s blows, a druid\'s bear\'s claws and a ranger\'s shots grow with the deep floors; on eight Hard floors a fighter\'s from the sixth; on Normal only deep in sixteen', async () => {
  const hurt = async (depth, cls = 'fighter', difficulty = 'hard', levels = 12) => {
    const ctx = await start(cls, 'deep-steel', { levels, difficulty });
    const { Game } = ctx;
    const G = Game.state(), p = Game.player();
    G.levels[depth] = G.levels[1]; G.depth = depth;
    // the same hero both times: scores are rolled afresh for each new game
    for (const k in p.stats) p.stats[k] = 14;
    // a druid fights as the bear, whose claws are its blows in the deep
    if (cls === 'druid') { p.sp = 99; Game.castSpell(ctx.SPELLS.druid.find(s => s.id === 'wild_shape')); if (!p.shape) return -1; p.shape.until = 1e12; }
    const m = beside(ctx, 'ogre', { hp: 99999, maxHp: 99999, nextAct: 1e12 });
    seedDice(ctx, 'deep-steel-swings');
    let dealt = 0;
    for (let i = 0; i < 20; i++) { const hp = m.hp; G.t = Math.max(G.t, p.nextAttack || 0); Game.input('attack'); dealt += hp - m.hp; }
    return dealt;
  };
  const out = [];
  // five floors past the sixth: 6% a floor for a fighter, 4% for a druid (5% on sixteen), 3.5% for a ranger, none on Normal
  for (const [cls, diff, lo, hi] of [['fighter', 'hard', 1.20, 1.40], ['druid', 'hard', 1.12, 1.28], ['ranger', 'hard', 1.10, 1.26], ['ranger', 'normal', 0.97, 1.03]]) {
    const shallow = await hurt(6, cls, diff), deep = await hurt(11, cls, diff);
    if (shallow < 0 || deep < 0) { out.push('the druid could not take the bear\'s shape'); continue; }
    if (!shallow) { out.push(`no ${cls} blow landed`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`a ${cls}'s blows on ${diff} floor 11 were ${r.toFixed(2)} times those on floor 6`);
  }
  // sixteen floors on Normal: six past the tenth, 6% a floor for a fighter and 4% for a druid; four past the twelfth, 3.5% for a ranger
  for (const [cls, lo, hi] of [['fighter', 1.28, 1.44], ['druid', 1.19, 1.31], ['ranger', 1.08, 1.21]]) {
    const shallow = await hurt(10, cls, 'normal', 16), deep = await hurt(16, cls, 'normal', 16);
    if (shallow < 0 || deep < 0) { out.push('the druid could not take the bear\'s shape on sixteen floors'); continue; }
    if (!shallow) { out.push(`no ${cls} blow landed on sixteen floors`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`on sixteen Normal floors a ${cls}'s blows on floor 16 were ${r.toFixed(2)} times those on floor 10`);
  }
  // eight floors: three past the fifth, 4% a floor for a fighter on Hard, none for a mage's staff nor on Normal
  for (const [cls, diff, lo, hi] of [['fighter', 'hard', 1.07, 1.18], ['fighter', 'normal', 0.97, 1.03], ['ranger', 'hard', 0.97, 1.03]]) {
    const shallow = await hurt(5, cls, diff, 8), deep = await hurt(8, cls, diff, 8);
    if (!shallow) { out.push(`no ${cls} blow landed on eight floors`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`on eight ${diff} floors a ${cls}'s blows on floor 8 were ${r.toFixed(2)} times those on floor 5`);
  }
  return out.length ? out.join('; ') : true;
});

await test('spells strike harder in the deep: 6% a floor past the sixth on a Hard Long Delve (a mage\'s 4% on twelve floors, a cleric\'s 4%), and on any difficulty past the twelfth of sixteen (a mage\'s past the tenth), a cleric\'s blows with them; below Hard a cleric\'s a tenth weaker past the sixth of a Long Delve', async () => {
  const dealt = async (cls, depth, difficulty, levels) => {
    const ctx = await start(cls, 'deep-magic', { levels, difficulty });
    const { Game } = ctx;
    const G = Game.state(), p = Game.player();
    G.levels[depth] = G.levels[1]; G.depth = depth;
    for (const k in p.stats) p.stats[k] = 14;
    p.level = 6; p.hp = p.maxHp = 999;
    const m = cls === 'cleric' ? beside(ctx, 'ogre', { hp: 99999, maxHp: 99999, nextAct: 1e12 }) : ahead(ctx, 'ogre', 2, { hp: 99999, maxHp: 99999, nextAct: 1e12 });
    const missile = ctx.SPELLS.mage.find(sp => sp.id === 'magic_missile');
    seedDice(ctx, 'deep-magic-' + cls);
    for (let i = 0; i < 20; i++) {
      G.t = Math.max(G.t, p.nextAttack || 0) + 10;
      if (cls === 'cleric') Game.input('attack'); else { p.sp = 99; Game.castSpell(missile); }
    }
    return 99999 - m.hp;
  };
  const out = [];
  for (const [what, cls, diff, levels, a, b, lo, hi] of [
    ['a mage on twelve Hard floors', 'mage', 'hard', 12, 6, 11, 1.12, 1.28],
    ['a mage on sixteen Hard floors', 'mage', 'hard', 16, 6, 11, 1.21, 1.40],
    ['a mage on sixteen Normal floors', 'mage', 'normal', 16, 10, 16, 1.26, 1.46],
    ['a mage on twelve Normal floors', 'mage', 'normal', 12, 6, 11, 0.97, 1.03],
    ['a cleric\'s blows on sixteen Normal floors', 'cleric', 'normal', 16, 12, 16, 1.15, 1.33],
    ['a cleric\'s blows between the tenth and twelfth of sixteen', 'cleric', 'normal', 16, 10, 12, 0.97, 1.03],
    // a cleric's: 4% a floor on a Hard Long Delve; and below Hard a tenth weaker past the sixth floor
    ['a cleric\'s blows on twelve Hard floors', 'cleric', 'hard', 12, 6, 11, 1.12, 1.28],
    ['a cleric\'s blows past the sixth of twelve Normal floors', 'cleric', 'normal', 12, 6, 11, 0.85, 0.95],
    ['a cleric\'s blows on eight Normal floors', 'cleric', 'normal', 8, 5, 8, 0.97, 1.03],
  ]) {
    const shallow = await dealt(cls, a, diff, levels), deep = await dealt(cls, b, diff, levels);
    if (!shallow) { out.push(`${what}: nothing landed`); continue; }
    const r = deep / shallow;
    if (!(r > lo && r < hi)) out.push(`${what}: floor ${b} struck ${r.toFixed(2)} times floor ${a}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the way in: the dungeon holds still while it plays, any control skips it, it ends by itself, it is told once, and the first floor\'s stair up lies under fallen rock', async () => {
  const out = [];
  const ctx = await start('fighter', 'way-in');
  const { Game } = ctx;
  const G = Game.state(), L = Game.level();
  // the stair up on the first floor is caved in, and says so
  if (!L.caved || !L.caved.includes(L.stairsUp.y * L.w + L.stairsUp.x)) out.push('the first floor\'s stair up is not under fallen rock');
  const said = markLog(G);
  Game.player().x = L.start.x; Game.player().y = L.start.y; Game.player().dir = (L.start.dir + 2) % 4;
  Game.input('use');
  if (!linesSince(G, said).some(l => /lies under fallen rock/.test(l))) out.push('the stair up did not say it is buried');
  // while it plays: the time of the dungeon stands, a step is not taken, and the view is the passage
  Game.update(1000, 0);
  Game.beginPrelude(1000);
  if (!Game.preludeOn()) return 'the way in did not begin';
  const t0 = G.t, at = { ...Game.player() };
  for (let i = 0; i < 20; i++) Game.update(1000 + i * 100, 100);
  if (G.t !== t0) out.push(`the dungeon's time ran on ${G.t - t0}ms through it`);
  const mid = Game.renderState(3000);
  if (mid.level === L || mid.level.w !== 7) out.push('the view in the middle of it was not the passage');
  const mark = markLog(G);
  Game.input('forward');
  if (Game.preludeOn()) out.push('a control did not skip it');
  if (Game.player().x !== at.x || Game.player().y !== at.y) out.push('the control that skipped it also moved the hero');
  if (linesSince(G, mark).filter(l => /roof of the passage comes down/.test(l)).length !== 1) out.push('skipped, the roof coming down was not told once');
  if (Game.renderState(3100).level !== L) out.push('after it the view was not the first floor');
  // left alone it ends by itself, past the dust, and tells it only once
  Game.update(9000, 0);
  Game.beginPrelude(9000);
  const mark2 = markLog(G);
  for (let t = 9000; t < 9000 + 12000 && Game.preludeOn(); t += 100) Game.renderState(t);
  if (Game.preludeOn()) out.push('left alone it never ended');
  if (linesSince(G, mark2).filter(l => /roof of the passage comes down/.test(l)).length !== 1) out.push('played out, the roof coming down was not told once');
  // a run left at the title with the way in still playing does not carry it into the next run, nor tell it there
  Game.beginPrelude(20000);
  Game.newGame({ name: 'Next', cls: 'thief', stats: Game.rollStats(), seed: 'way-in-next', opts: { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, permadeath: false, difficulty: 'normal' } });
  if (Game.preludeOn()) out.push('a new run took up the last run\'s way in');
  for (let t = 20000; t < 30000; t += 500) Game.renderState(t);
  if (Game.state().log.some(l => /roof of the passage comes down/.test(l.m))) out.push('the last run\'s way in was told in the new one');
  // a first floor saved before the way in came down has its stair up under rock when taken up
  const F = Game.level(); delete F.caved; Game.save(true);
  if (!Game.load()) out.push('could not take the save up');
  else if (!(Game.level().caved || []).includes(F.stairsUp.y * F.w + F.stairsUp.x)) out.push('an old first floor kept its stair up open');
  return out.length ? out.join('; ') : true;
});

await test('a trader stands in the way of a charge and a shot', async () => {
  const ctx = await start('fighter', 'trader-line');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const m = ahead(ctx, 'orc', 3);
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.npcs.length = 0;
  L.npcs.push({ id: 'merchant', x: p.x + dx * 2, y: p.y + dy * 2, markup: 2, stock: [] });
  let charged = false;
  await pinned(0.1, () => { for (let i = 0; i < 40; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'charge') charged = true; } });
  if (m.x === p.x + dx * 2 && m.y === p.y + dy * 2) return 'the orc charged onto the trader';
  return !charged || 'the orc began a charge through the trader';
});

await test('a volley ends early when the group falls mid-volley', async () => {
  const ctx = await start('fighter', 'volley-cut');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999;
  const m = groupAhead(ctx, 'goblin', 3, 999);
  const mark = markLog(G);
  for (let i = 0; i < 40 && !m.volley; i++) Game.update(G.t + 25, 25);
  if (!m.volley) return 'no volley began';
  delete m.pack;                                     // the other two cut down
  run(Game, G, 700);
  const blows = linesSince(G, mark).filter(l => /Goblin (hits|misses) you/.test(l)).length;
  return blows === 1 || `a lone goblin landed ${blows} blows of a trio's volley`;
});

await test('a step queued at the end of one run does not happen in the next', async () => {
  const ctx = await start('fighter', 'queue-carry');
  const { Game } = ctx;
  Game.level().monsters.length = 0;
  Game.input('left'); Game.input('left');              // the second is queued
  Game.newGame({ name: 'Next', cls: 'fighter', stats: Game.rollStats(), seed: 'queue-carry-2', opts: OPTS });
  const G = Game.state(), d0 = Game.player().dir;
  Game.level().monsters.length = 0;
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  return Game.player().dir === d0 || 'the last run\'s turn happened in the new one';
});

await test('webbed or held fast, the hero cannot take the stairs', async () => {
  const ctx = await start('fighter', 'pinned-stairs');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.STAIRS_DOWN;   // facing a way down
  const z = beside(ctx, 'zombie', { nextAct: 1e12 });
  L.monsters.length = 0;
  p.webbed = G.t + 2000;
  Game.input('use');
  if (G.depth !== 1) return 'a webbed hero went down the stairs';
  p.webbed = 0;
  L.monsters.push(Object.assign(z, { x: p.x - dx, y: p.y - dy }));   // holding on from behind
  L.tiles[z.y * L.w + z.x] = Dungeon.T.FLOOR;
  p.grabbed = { uid: z.uid, until: G.t + 4000, nextTry: 0 };
  Game.input('use');
  return G.depth === 1 || 'a grabbed hero went down the stairs';
});

await test('one great blow past both thresholds raises both of the lich\'s guards, on open floor', async () => {
  const ctx = await start('fighter', 'lich-phases');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
  p.perkHit = 60;
  const m = beside(ctx, 'lich', { hp: 90, maxHp: 300, nextAct: 1e12 });
  // wall the lich in on three sides: guards must come out of the open side, not the stone
  for (const [dx, dy] of Dungeon.DIRS) { const x = m.x + dx, y = m.y + dy; if (x !== p.x || y !== p.y) L.tiles[y * L.w + x] = T.WALL; }
  for (let i = 0; i < 6 && m.hp === 90; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // a natural 1 still misses
  const guards = L.monsters.filter(o => o.id === 'skeleton');
  if (guards.length !== 2) return `${guards.length} guard groups rose from one blow past both thresholds`;
  // a wraith follows them only where there is still room for it
  guards.push(...L.monsters.filter(o => o.id === 'wraith'));
  // every guard can walk to the lich
  const reach = new Set([m.y * L.w + m.x]), q = [[m.x, m.y]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of Dungeon.DIRS) { const nx = x + dx, ny = y + dy, i = ny * L.w + nx; if (reach.has(i)) continue; const t = L.tiles[i]; if (t === T.WALL || t === T.TORCH || t === T.SECRET) continue; reach.add(i); if (reach.size < 400) q.push([nx, ny]); } }
  const cut = guards.filter(g => !reach.has(g.y * L.w + g.x));
  return !cut.length || `guards rose behind a wall at ${cut.map(g => g.x + ',' + g.y).join(' ')}`;
});

await test('a split slime is worth one slime between its halves', async () => {
  const ctx = await start('fighter', 'split-xp');
  const { Game, MONSTERS } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.perkHit = 60;
  const m = beside(ctx, 'slime', { hp: 30, maxHp: 30, nextAct: 1e12 });
  const xp0 = p.xp;
  for (let i = 0; i < 6 && !m.pack; i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
  if (!m.pack) return 'it did not split';
  m.hp = 1; m.pack[0].hp = 1;
  for (let i = 0; i < 8 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }   // a natural 1 still misses
  if (L.monsters.includes(m)) return 'the halves did not both fall';
  return p.xp - xp0 <= MONSTERS.slime.xp + 1 || `the halves paid ${p.xp - xp0} xp for a ${MONSTERS.slime.xp} xp slime`;
});

await test('a corrupt bestiary in storage is shrugged off, not a crash', async () => {
  const ctx = await start('fighter', 'beast-corrupt');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  for (const bad of ['{"goblin":5}', '{"goblin":null}', '[]', 'not json', '{"goblin":{"met":"lots","kills":null}}']) {
    localStorage.setItem('deepdelve.bestiary', bad);
    const m = beside(ctx, 'goblin', { uid: 300 + bad.length, hp: 1, maxHp: 1, nextAct: 1e12 });
    // a natural 1 still misses: swing until it falls
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) {
      G.t = Math.max(G.t, p.nextAttack);
      try { Game.input('attack'); } catch (e) { return `stored ${bad}: ${e.message}`; }
    }
    if (Game.level().monsters.includes(m)) return `stored ${bad}: the goblin did not die`;
    const r = Game.bestiary().goblin;
    if (!r || r.kills < 1 || !Number.isFinite(r.met)) return `stored ${bad}: the record came back ${JSON.stringify(r)}`;
  }
  return true;
});

await test('down the Warrens the last floor is the Warlord\'s, not the lich\'s; the rest of the floor is the same', async () => {
  const out = [];
  const ctx = await start('fighter', 'warlord-floor');
  for (let i = 0; i < 6; i++) {
    const seed = `warlord-${i}`, opts = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    const W = ctx.Dungeon.generate(seed, 8, { ...opts, route: 'warrens' }), C = ctx.Dungeon.generate(seed, 8, { ...opts, route: 'crypts' }), N = ctx.Dungeon.generate(seed, 8, opts);
    const boss = L => L.monsters.filter(m => ctx.MONSTERS[m.id].boss).map(m => m.id).join();
    if (boss(W) !== 'warlord' || boss(C) !== 'lich' || boss(N) !== 'lich') out.push(`${seed}: warrens ${boss(W)}, crypts ${boss(C)}, none ${boss(N)}`);
    const rest = L => L.monsters.filter(m => !ctx.MONSTERS[m.id].boss).map(m => `${m.id}@${m.x},${m.y}`).join(' ');
    if (N.tiles.join() !== W.tiles.join() || rest(N) !== rest(W)) out.push(`${seed}: the Warlord's floor differs from the lich's beyond the boss`);
  }
  return out.length ? out.join('; ') : true;
});

await test('the Warlord beats his drum for a warband, and a blow while the stick is raised breaks the beat', async () => {
  const out = [];
  const drum = async (strike) => {
    const ctx = await start('fighter', 'warlord-drum-' + strike);
    const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999; p.perkHit = 60; p.stats.str = 18;
    const m = beside(ctx, 'warlord', { blows: 2, hp: 400, maxHp: 400 });
    Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move !== 'drum') return { err: `it drew ${JSON.stringify(m.windup)}` };
    const mark = markLog(G), sounds = [];
    ctx.Sound.listen(name => sounds.push(name));
    try {
      if (strike) for (let i = 0; i < 10 && m.windup; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
      run(Game, G, 1800);
    } finally { ctx.Sound.listen(null); }
    const band = L.monsters.filter(o => o.id === 'goblin');
    return { band, said: linesSince(G, mark), m, drummed: sounds.includes('drum') };
  };
  const a = await drum(false), b = await drum(true);
  if (a.err || b.err) return a.err || b.err;
  if (!(a.band.length === 1 && a.band[0].pack && a.band[0].pack.length === 1 && a.band[0].awake)) out.push(`the beat brought ${JSON.stringify(a.band.map(g => g.pack))}`);
  if (!a.said.some(l => /warband comes running/.test(l))) out.push('the warband came unsaid');
  if (!a.drummed || b.drummed) out.push(`the drum was heard ${a.drummed ? '' : 'not '}when beaten and ${b.drummed ? '' : 'not '}when broken`);
  if (b.band.length) out.push('a struck drum still called a warband');
  if (!b.said.some(l => /strike the drumstick from/.test(l))) out.push(`breaking the beat said: ${b.said.join(' / ')}`);
  return out.length ? out.join('; ') : true;
});
};
