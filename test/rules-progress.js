// Rule checks for progress kept between runs.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function progressChecks(h) {
  const { OPTS, evenStats, newContext, start, seedDice, markLog, linesSince, test, beside, ahead, run, winHere, downTo } = h;

// ---------- progress kept between runs ----------
const progressOf = ctx => JSON.parse(ctx.store.get('deepdelve.progress') || 'null');

await test('a win earns its class a trophy at its difficulty, told the first time only; a death earns none', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  // trophies are for a win on one life
  const run = (cls, difficulty, permadeath = true) => Game.newGame({ name: 'W', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'trophy-' + cls, opts: { ...OPTS, permadeath, difficulty } });
  run('mage', 'hard');
  if (!winHere(Game)) return 'lifting the Heart did not win';
  const v = progressOf(ctx);
  if (!v || !v.won || !v.won.mage || v.won.mage.hard !== 1) return `after a mage's hard win: ${JSON.stringify(v)}`;
  if (v.won.mage.normal || v.won.fighter) return `a hard win counted elsewhere too: ${JSON.stringify(v.won)}`;
  const e = Game.earned();
  if (!e || !e.first || e.cls !== 'mage' || e.difficulty !== 'hard') return `earned: ${JSON.stringify(e)}`;
  if (!Progress.hasWon('mage', 'hard') || Progress.highest('mage') !== 'hard' || Progress.highest('fighter') !== '') return 'the trophy is not read back';
  run('mage', 'hard'); winHere(Game);
  if (Game.earned().first) return 'a second hard win as a mage was told as the first';
  if (progressOf(ctx).won.mage.hard !== 2) return 'the second win was not counted';
  // a run from before there was a choice is Normal
  Game.newGame({ name: 'W', cls: 'thief', bg: 'oathbroken', stats: { ...evenStats }, seed: 'trophy-old', opts: { ...OPTS, permadeath: true } });
  winHere(Game);
  if (!Game.earned().first || !Progress.hasWon('thief', 'normal')) return `an unmarked run: ${JSON.stringify(progressOf(ctx).won)}`;
  // the Daily Delve counts like any other run
  const daily = ctx.Daily.heroFor('2026-09-24');
  Game.newGame(daily);
  winHere(Game);
  if (!Progress.hasWon(daily.cls, 'normal')) return `a daily ${daily.cls} win did not count`;
  // a win that could have been reloaded earns nothing, and says why
  const kept = JSON.stringify(progressOf(ctx));
  run('cleric', 'hard', false); winHere(Game);
  if (JSON.stringify(progressOf(ctx)) !== kept || !Game.earned() || !Game.earned().reloadable) return `a reloadable win counted: ${JSON.stringify(Game.earned())}`;
  const before = JSON.stringify(progressOf(ctx));
  // a death is no trophy
  run('fighter', 'easy');
  const p = Game.player(), G = Game.state();
  p.hp = 1; p.eq.armor = null; p.eq.shield = null;
  beside(ctx, 'goblin');
  for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead') return 'the goblin never killed the hero';
  if (JSON.stringify(progressOf(ctx)) !== before || Game.earned()) return `a death changed the trophies: ${JSON.stringify(progressOf(ctx).won)}`;
  const n = Progress.trophyCount();
  const { CLASSES, PATHS, VOWS, FEATS } = ctx, total = Object.values(CLASSES).filter(c => !c.hidden).length * 4 + Object.values(PATHS).flat().length + Object.keys(VOWS).length + Object.keys(FEATS).length;
  return (n.total === total && n.won === new Set(['mage-hard', 'thief-normal', daily.cls + '-normal']).size) || `trophy count ${JSON.stringify(n)}`;
});

await test('a win with a path, and a vow kept, are trophies of their own; vows open after a Hard win', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = (cls, difficulty, opts = {}) => Game.newGame({ name: 'V', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'vow-' + cls, opts: { ...OPTS, permadeath: true, difficulty, ...opts } });
  if (Progress.vowsOpen()) return 'vows were open before any Hard win';
  run('fighter', 'hard'); Game.player().path = 'knight';
  winHere(Game);
  const e = Game.earned();
  if (!e.vowsOpened || e.firstPath !== 'knight') return `a first Hard win as a Knight earned ${JSON.stringify(e)}`;
  if (!Progress.vowsOpen()) return 'a Hard win did not open the vows';
  run('cleric', 'normal', { vows: ['iron', 'unaided', 'iron', 'nonsense'] });
  if (JSON.stringify(Game.state().opts.vows) !== '["iron","unaided"]') return `vows kept as ${JSON.stringify(Game.state().opts.vows)}`;
  winHere(Game);
  if (JSON.stringify(Game.earned().firstVows) !== '["iron","unaided"]') return `vows kept to a win earned ${JSON.stringify(Game.earned())}`;
  run('thief', 'easy', { vows: ['pauper'] }); winHere(Game);
  if (progressOf(ctx).vows.pauper) return 'a vow kept on Easy counted';
  const n = Progress.trophyCount();
  return n.won === 3 + 1 + 2 || `trophies ${JSON.stringify(n)} from ${JSON.stringify(progressOf(ctx))}`;
});

await test('a win with three traders\' jobs done is Friend of the Lampfolk; with a veteran companion at your side, Old Campaigners', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = difficulty => Game.newGame({ name: 'F', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'feat-new', opts: { ...OPTS, permadeath: true, difficulty } });
  const out = [];
  const companion = floors => ({ kind: 'hound', name: 'Brindle', x: 0, y: 0, depth: Game.state().depth, hp: 10, maxHp: 10, mode: 'follow', nextAct: 0, kills: 0, joined: 1, floors });
  run('normal'); Game.state().stats.bounties = 2; Game.state().companion = companion(3); winHere(Game);
  if (Game.earned().firstFeats.length) out.push(`two jobs and a blooded hound earned ${Game.earned().firstFeats}`);
  run('normal'); Game.state().stats.bounties = 3; Game.state().companion = companion(4); winHere(Game);
  if (Game.earned().firstFeats.sort().join() !== 'friend,veteran') out.push(`three jobs and a veteran hound earned ${Game.earned().firstFeats}`);
  // a veteran that fell does not count, nor anything on Easy
  const ctx2 = await newContext();
  const run2 = difficulty => ctx2.Game.newGame({ name: 'F', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'feat-new', opts: { ...OPTS, permadeath: true, difficulty } });
  run2('hard'); ctx2.Game.state().companion = { ...companion(5), fallen: 7 }; winHere(ctx2.Game);
  if (ctx2.Game.earned().firstFeats.includes('veteran')) out.push('a fallen veteran counted');
  run2('easy'); ctx2.Game.state().stats.bounties = 5; winHere(ctx2.Game);
  if (progressOf(ctx2).feats.friend) out.push('jobs on Easy counted');
  void Progress;
  return out.length ? out.join('; ') : true;
});

await test('a win on a long delve, on Normal or Hard, is the Long Delve feat; the Hall line says how long it was', async () => {
  const ctx = await newContext();
  const { Game, Progress } = ctx;
  const run = (difficulty, levels) => Game.newGame({ name: 'L', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'long-' + levels, opts: { ...OPTS, permadeath: true, difficulty, levels } });
  run('normal', 8); winHere(Game);
  if (progressOf(ctx).feats.long) return 'an eight-floor win counted as a long delve';
  run('easy', 12); winHere(Game);
  if (progressOf(ctx).feats.long) return 'a long delve on Easy counted';
  run('hard', 12); winHere(Game);
  if (JSON.stringify(Game.earned().firstFeats) !== '["long"]' || progressOf(ctx).feats.long !== 1) return `a long Hard win earned ${JSON.stringify(Game.earned())}`;
  run('normal', 16); winHere(Game);
  if (Game.earned().firstFeats.length || progressOf(ctx).feats.long !== 2) return 'a second long win was told as a first, or not counted';
  const lens = Game.hall().map(h => h.levels).sort((a, b) => a - b).join();
  return lens === '8,12,12,16' || `the Hall kept levels ${lens}`;
});

await test('a quick delve of two floors: its second floor sits low on the ladder, its lich has three tenths of its life and strikes less surely, its hero learns three times as fast, and its win earns no trophy', async () => {
  const out = [];
  // a goblin is worth three times as much as on an ordinary delve (the ordinary one
  // first: each context takes over the stored progress the game reads)
  const gain = c => {
    const h = c.Game.player(), g = c.Game.state(); h.perkHit = 60;
    const m = beside(c, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 }), xp0 = h.xp;
    for (let i = 0; i < 6 && c.Game.level().monsters.includes(m); i++) { g.t = Math.max(g.t, h.nextAttack); c.Game.input('attack'); }   // a natural 1 still misses
    return h.xp - xp0;
  };
  const o = gain(await start('fighter', 'quick-delve', { levels: 8, difficulty: 'normal' }));
  const ctx = await start('fighter', 'quick-delve', { levels: 2, difficulty: 'normal', permadeath: true });
  const { Game, Dungeon, MONSTERS, Progress } = ctx; const p = Game.player();
  if (Dungeon.tierAt(1, 2) !== 1 || Dungeon.tierAt(2, 2) > 2) out.push(`the quick delve sat at tiers ${Dungeon.tierAt(1, 2)} and ${Dungeon.tierAt(2, 2)}`);
  if (Dungeon.tierAt(2, 4) <= Dungeon.tierAt(2, 2)) out.push('a four-floor delve\'s second floor was no deeper than a quick one\'s');
  const q = gain(ctx);
  if (!(o > 0) || q !== 3 * o) out.push(`a goblin paid ${q} on a quick delve and ${o} on an ordinary one`);
  // the second floor is the last, and its keeper the lich, weakened
  p.hp = p.maxHp = 9999;
  downTo(ctx, 2);
  const lich = Game.level().monsters.find(m => MONSTERS[m.id].boss);
  if (!lich || lich.id !== 'lich') return `the quick delve's second floor was kept by ${lich && lich.id}`;
  // on Normal its life is twice its dice, near 170: three tenths of that is about fifty
  if (lich.maxHp >= 90) out.push(`the quick lich had ${lich.maxHp} life`);
  if (!((lich.edge || 0) <= -4)) out.push(`the quick lich's edge was ${lich.edge}`);
  // and a win (the lich gone first): the Hall keeps it, the trophies do not
  Game.level().monsters.length = 0;
  if (!winHere(Game)) return out.concat('lifting the Heart did not win').join('; ');
  if (Progress.hasWon('fighter', 'normal') || (Game.earned() && Game.earned().cls)) out.push(`a quick win earned a trophy: ${JSON.stringify(Game.earned())}`);
  if (!Game.hall().some(h => h.won && h.levels === 2)) out.push('the quick win was not in the Hall');
  return out.length ? out.join('; ') : true;
});

await test('the Long Delve\'s back half is surer and sturdier: a step surer from the seventh floor, four percent sturdier a floor past the sixth', async () => {
  const at = async (levels, depth) => {
    const ctx = await start('fighter', 'long-edge', { levels, difficulty: 'normal' });
    const { Game, MONSTERS } = ctx; Game.player().hp = Game.player().maxHp = 9999;
    downTo(ctx, depth);
    const m = Game.level().monsters.find(x => !x.elite && !MONSTERS[x.id].named && !MONSTERS[x.id].boss);
    return { hit: Game.mstat(m).hit - MONSTERS[m.id].hit, id: m.id };
  };
  const short7 = await at(8, 7), long7 = await at(12, 7), long6 = await at(12, 6);
  if (long7.hit !== short7.hit + 1) return `a ${long7.id} on floor 7 of 12 hits +${long7.hit} over its drawing; on floor 7 of 8, +${short7.hit}`;
  return long6.hit === short7.hit || `on floor 6 of 12 creatures are already ${long6.hit} surer`;
});

await test('mastery: every relic found is the Collector; the Daily keeps to the first four classes', async () => {
  const out = [];
  const ctx = await newContext();
  const { Progress, RELICS, Daily } = ctx;
  // the Collector (Durgrim's Ring, found only in a sixteen-floor delve, is a find beyond the set it asks for,
  // and so are the paths' legends, which no one hero could ever gather)
  const ids = Object.keys(RELICS).filter(id => !RELICS[id].beyond && !RELICS[id].legend);
  if (!RELICS.thane_ring || !RELICS.thane_ring.beyond) out.push('Durgrim\'s Ring is counted toward the Collector');
  for (const id of ids.slice(0, -1)) Progress.noteRelic(id);
  if (progressOf(ctx).feats.collector) out.push('the Collector came before the last relic');
  Progress.noteRelic(ids[ids.length - 1]);
  if (progressOf(ctx).feats.collector !== 1) out.push('every relic found was not the Collector');
  // a codex filled before the feat existed earns it with the next relic picked up, known or not
  const v = progressOf(ctx); delete v.feats.collector; ctx.store.set(Progress.KEY, JSON.stringify(v));
  Progress.noteRelic(ids[0]);
  if (progressOf(ctx).feats.collector !== 1) out.push('a full codex from before the feat never earned it');
  // the Daily never deals a class it has not always dealt
  for (let i = 0; i < 200; i++) { const d = new Date(2026, 0, 1 + i); const key = d.toISOString().slice(0, 10); if (Daily.heroFor(key).cls === 'ranger') { out.push(`the Daily of ${key} dealt a Ranger`); break; } }
  return out.length ? out.join('; ') : true;
});

await test('a class is mastered by a win with each of its paths: once, on the win that completes it, and a trophy', async () => {
  const ctx = await newContext();
  const { Progress, PATHS, CLASSES } = ctx;
  const [a, b] = PATHS.fighter.map(x => x.id);
  const total0 = Progress.trophyCount().total;
  const w1 = Progress.recordWin('fighter', 'easy', { path: a });
  if (w1.mastered || Progress.mastered('fighter') || Progress.pathsWon('fighter') !== 1) return `one path won: mastered ${w1.mastered}, ${Progress.pathsWon('fighter')} won`;
  const before = Progress.trophyCount().won;
  const w2 = Progress.recordWin('fighter', 'easy', { path: b });
  if (!w2.mastered || !Progress.mastered('fighter')) return 'both paths won and the fighter was not mastered';
  // two trophies from that win: the path, and the mastery
  if (Progress.trophyCount().won !== before + 2) return `the second path's win lit ${Progress.trophyCount().won - before} trophies, want 2`;
  if (Progress.recordWin('fighter', 'hard', { path: a }).mastered) return 'mastery was told a second time';
  if (Progress.recordWin('cleric', 'hard', { path: PATHS.cleric[0].id }).mastered || Progress.mastered('cleric')) return 'one cleric path mastered the cleric';
  if (total0 !== Object.values(CLASSES).filter(c => !c.hidden).length * 4 + Progress.PATH_IDS.length + Object.keys(ctx.VOWS).length + Object.keys(ctx.FEATS).length) return `trophies in all: ${total0}`;
  return true;
});

await test('a vow binds: no rest under the Iron Vow, no trader under the Pauper\'s, no draught unaided; the Daily takes none', async () => {
  const out = [];
  const ctx = await start('fighter', 'vows', { vows: ['iron', 'pauper', 'unaided'] });
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0; p.hp = 1;
  const mark = markLog(G);
  if (Game.rest() !== false || p.hp !== 1) out.push('the Iron Vow let the hero rest');
  const draught = { t: 'potion_heal', q: 1 }; p.inv.push(draught); G.known.potion_heal = 1;
  Game.useItem(draught);
  if (p.hp !== 1 || !p.inv.includes(draught)) out.push('an unaided hero drank a draught');
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR;
  Game.input('forward');
  if (Game.currentShop()) out.push('a trader dealt with a pauper');
  const said = linesSince(G, mark).join(' | ');
  for (const w of ['Iron Vow', 'unaided', 'pauper']) if (!said.includes(w)) out.push(`nothing said of the ${w}: ${said}`);
  const daily = ctx.Daily.heroFor('2026-09-24');
  Game.newGame({ ...daily, opts: { ...daily.opts, vows: ['iron'] } });
  if ((Game.state().opts.vows || []).length) out.push('the Daily Delve took a vow');
  return out.length ? out.join('; ') : true;
});

await test('a relic picked up or bought goes in the codex, once, and the codex outlasts the run', async () => {
  const ctx = await start('fighter', 'codex');
  const { Game, Progress } = ctx;
  const p = Game.player(), L = Game.level(), k = `${p.x},${p.y}`;
  if (Progress.load().relics.length) return 'a fresh device already knows relics';
  const tooth = { t: 'dagger', q: 1, e: 2, u: 'grimtooth' };
  (L.items[k] = L.items[k] || []).push(tooth);
  Game.takeItem(tooth);
  if (!p.inv.some(it => it.u === 'grimtooth')) return 'Grimtooth was not picked up';
  if (JSON.stringify(progressOf(ctx).relics) !== '["grimtooth"]') return `after picking up Grimtooth: ${JSON.stringify(progressOf(ctx))}`;
  // bought from a trader
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'shield', q: 1, e: 2, u: 'kests_bulwark' }] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  p.gold = 99999;
  if (!Game.buy(shop.stock[0])) return 'could not buy the Bulwark';
  if (JSON.stringify(progressOf(ctx).relics) !== '["grimtooth","kests_bulwark"]') return `after buying the Bulwark: ${JSON.stringify(progressOf(ctx))}`;
  if (Progress.noteRelic('grimtooth')) return 'Grimtooth went in twice';
  // seen by the next hero, on a new run
  Game.newGame({ name: 'N', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats }, seed: 'codex-next', opts: OPTS });
  const r = Progress.load().relics;
  return (r.length === 2 && r.includes('grimtooth') && r.includes('kests_bulwark')) || `the next hero's codex: ${JSON.stringify(r)}`;
});

await test('progress that is missing or corrupt is shrugged off, and an old Hall still counts its wins', async () => {
  const ctx = await newContext();
  const { Progress } = ctx;
  for (const bad of ['{not json', 'null', '[]', '7', JSON.stringify({ won: 'x', relics: 'y' })]) {
    ctx.store.set('deepdelve.progress', bad);
    const v = Progress.load();
    if (JSON.stringify(v) !== '{"won":{},"relics":[],"combos":[],"paths":{},"vows":{},"feats":{},"rungs":{},"wick":{"met":0,"told":0,"won":0,"last":null},"pages":[]}') return `${bad} read as ${JSON.stringify(v)}`;
    if (Progress.bgOpen('returned')) return `${bad} opened a locked background`;
  }
  ctx.store.set('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 'x', easy: 2 }, nobody: { easy: 3 } }, relics: ['grimtooth', 7, 'nope', 'grimtooth'], combos: ['conduction', 'nope', 3, 'conduction'], paths: { knight: 2, nope: 5, healer: 'x' }, vows: { iron: -1, pauper: 1 }, feats: { long: 1, nope: 2 }, rungs: { mage: 9, nope: 2, cleric: 'x', thief: 2 } }));
  const v = Progress.load();
  if (JSON.stringify(v) !== '{"won":{"fighter":{"easy":2}},"relics":["grimtooth"],"combos":["conduction"],"paths":{"knight":2},"vows":{"pauper":1},"feats":{"long":1},"rungs":{"mage":5,"thief":2},"wick":{"met":0,"told":0,"won":0,"last":null},"pages":[]}') return `a half-good record read as ${JSON.stringify(v)}`;
  if (!Progress.noteRelic('thirst') || Progress.load().relics.length !== 2) return 'the codex could not grow after a bad record';
  // storage that throws is no crash, and no unlock
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {}, clear() {} };
  try {
    if (Progress.load().relics.length || Progress.bgOpen('heartsworn')) return 'blocked storage still read';
    Progress.noteRelic('whisper'); Progress.recordWin('fighter', 'hard');
  } finally { globalThis.localStorage = real; }
  // a player from before progress was kept: the Hall's wins count
  ctx.store.delete('deepdelve.progress');
  ctx.store.set('deepdelve.hall', JSON.stringify([{ name: 'Old', cls: 'cleric', won: true, difficulty: 'hard', score: 3000 }, { name: 'Older', cls: 'thief', won: true, score: 2500 }, { name: 'Lost', cls: 'mage', won: false, difficulty: 'hard', score: 100 },
    { name: 'Reloaded', cls: 'fighter', won: true, difficulty: 'normal', permadeath: false, score: 2000 }]));
  // a win that could have been reloaded is no trophy, from the Hall or anywhere
  if (!Progress.hasWon('cleric', 'hard') || !Progress.hasWon('thief', 'normal') || Progress.hasWon('mage', 'hard') || Progress.hasWon('fighter', 'normal')) return `from the Hall: ${JSON.stringify(Progress.load().won)}`;
  return Progress.bgOpen('heartsworn') || 'a hard win in the Hall did not open the Heartsworn';
});

await test('the earned backgrounds are refused until won, then open with their perks', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  const make = (bg, difficulty = 'normal') => { Game.newGame({ name: 'B', cls: 'fighter', bg, stats: { ...evenStats }, seed: 'bg-lock', opts: { ...OPTS, permadeath: true, difficulty } }); return Game.player(); };
  if (make('returned').bg !== 'oathbroken') return `the Returned was taken while locked: ${Game.player().bg}`;
  if (Game.player().inv.some(it => it.t === 'potion_xheal')) return 'the locked perk came anyway';
  if (make('heartsworn').bg !== 'oathbroken') return 'the Heartsworn was taken while locked';
  // an easy win opens nothing
  make('oathbroken', 'easy'); winHere(Game);
  if (Game.earned().unlocked.length || make('returned').bg !== 'oathbroken') return 'an easy win opened the Returned';
  // a normal win opens the Returned, not the Heartsworn
  make('oathbroken', 'normal'); winHere(Game);
  if (JSON.stringify(Game.earned().unlocked) !== '["returned"]') return `a normal win opened ${JSON.stringify(Game.earned().unlocked)}`;
  const p = make('returned');
  if (p.bg !== 'returned') return 'the Returned is still refused after a normal win';
  const draught = p.inv.find(it => it.t === 'potion_xheal');
  if (!draught || draught.q !== 1 || !Game.isKnown('potion_xheal')) return 'the Returned did not start with a known Potion of Extra Healing';
  // a rest costs the Returned food like anyone (their gift is the trader's lamp for nothing: rules-lessons.js)
  const L = Game.level();
  L.monsters.length = 0; p.hp = 1; p.food = 50;
  if (!Game.rest() || p.food !== 44) return `the first rest cost ${50 - p.food} food`;
  if (make('heartsworn').bg !== 'oathbroken') return 'a normal win opened the Heartsworn';
  // a hard win opens the Heartsworn
  make('oathbroken', 'hard'); winHere(Game);
  if (JSON.stringify(Game.earned().unlocked) !== '["heartsworn"]') return `a hard win opened ${JSON.stringify(Game.earned().unlocked)}`;
  // wounds close on their own to 60% for the Heartsworn, half for anyone else
  const healTo = bg => {
    const h = make(bg), G = Game.state();
    Game.level().monsters.length = 0;
    h.maxHp = 100; h.hp = 10; h.food = 100; h.lastHurt = -1e9;
    for (let i = 0; i < 4000; i++) Game.update(G.t + 50, 50);
    return h.hp;
  };
  const heart = healTo('heartsworn');
  if (Game.player().bg !== 'heartsworn') return 'the Heartsworn is still refused after a hard win';
  const plain = healTo('oathbroken');
  return (heart === 60 && plain === 50) || `healed on their own to ${heart} (Heartsworn) and ${plain} (Oathbroken)`;
});

await test('the Daily Delve deals only the six original backgrounds, whatever has been unlocked', async () => {
  const ctx = await newContext();
  const { Daily, Progress, BACKGROUNDS } = ctx;
  if (Daily.DAILY_BACKGROUNDS.join() !== 'oathbroken,tombwise,ashborn,cloistered,deepborn,debtor') return `the daily list is ${Daily.DAILY_BACKGROUNDS.join()}`;
  if (!Object.keys(BACKGROUNDS).some(id => BACKGROUNDS[id].unlock)) return 'there is no earned background to leave out';
  Progress.recordWin('fighter', 'hard');
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const key = Daily.today(new Date(2026, 0, 1 + i)), hero = Daily.heroFor(key);
    if (BACKGROUNDS[hero.bg].unlock || !Daily.DAILY_BACKGROUNDS.includes(hero.bg)) return `${key} dealt ${hero.bg}`;
    seen.add(hero.bg);
  }
  return seen.size === 6 || `only ${seen.size} backgrounds came up in 400 days`;
});

await test('rings and amulets: two rings and an amulet on any hero, each doing what it was made for', async () => {
  const out = [];
  const ctx = await start('mage', 'jewels-worn');
  const { Game, ITEMS } = ctx; const p = Game.player(), G = Game.state();
  const give = (t, extra = {}) => { const it = { t, q: 1, e: 0, ...extra }; p.inv.push(it); return it; };
  const ac0 = Game.playerAC(), hit0 = Game.toHit(), sp0 = p.maxSp;
  // a mage wears no armour, but a ring anyone may
  const prot = give('ring_protect', { e: 1 }), might = give('ring_might'), wiz = give('amulet_mind');
  for (const it of [prot, might, wiz]) if (!Game.equip(it, true)) out.push(`${it.t} would not go on`);
  if (p.eq.ring !== prot || p.eq.ring2 !== might || p.eq.amulet !== wiz) out.push(`worn: ${JSON.stringify([p.eq.ring, p.eq.ring2, p.eq.amulet].map(i => i && i.t))}`);
  if (Game.playerAC() !== ac0 + 2) out.push(`a +1 Ring of Protection made armour class ${ac0} into ${Game.playerAC()}, not ${ac0 + 2}`);
  if (Game.toHit() !== hit0 + 1) out.push(`a Ring of Might made to-hit ${hit0} into ${Game.toHit()}`);
  if (p.maxSp !== sp0 + 6) out.push(`an Amulet of Wizardry made spell points ${sp0} into ${p.maxSp}`);
  // a third ring takes the place of the first, which goes back in the pack
  const third = give('ring_quiet');
  Game.equip(third, true);
  if (p.eq.ring !== third || !p.inv.includes(prot)) out.push('a third ring did not take the first one\'s place');
  // a cursed ring binds its finger, and the next ring goes on the other
  Game.unequip('ring'); Game.unequip('ring2');
  const bad = give('ring_protect', { e: -2, curse: 1 });
  Game.equip(bad, true);
  if (Game.playerAC() !== ac0 - 1) out.push(`a cursed -2 Ring of Protection left armour class at ${Game.playerAC()}, not ${ac0 - 1}`);
  Game.unequip(p.eq.ring === bad ? 'ring' : 'ring2');
  if (!Object.values(p.eq).includes(bad)) out.push('a cursed ring came off');
  const next = give('ring_might'); Game.equip(next, true);
  if (!Object.values(p.eq).includes(bad) || !Object.values(p.eq).includes(next)) out.push('the next ring displaced the cursed one');
  return out.length ? out.join('; ') : true;
});

await test('a failed study of an unknown ring holds for every ring of that look until the next level', async () => {
  const ctx = await start('fighter', 'ring-study');
  seedDice(ctx, 'ring-study');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.stats.int = 3;
  const first = { t: 'ring_evasion', q: 1, e: 0 };
  p.inv.push(first);
  // a low mind fails soon enough; a lucky pass is forgotten and tried again
  let failed = false;
  for (let i = 0; i < 40 && !failed; i++) {
    delete first.studied; if (G.studied) delete G.studied.ring_evasion; delete G.known.ring_evasion;
    const c = Game.study(first);
    failed = !!c && !c.pass;
  }
  if (!failed) return 'never failed a study with 3 intelligence';
  const second = { t: 'ring_evasion', q: 1, e: 0 };
  p.inv.push(second);
  if (!Game.studyReason(second)) return 'a second ring of the same look could be studied straight after the first failed';
  const other = { t: 'ring_protect', q: 1, e: 0 };
  p.inv.push(other);
  if (Game.studyReason(other)) return `a ring of another look was refused: ${Game.studyReason(other)}`;
  p.level++;
  return Game.studyReason(second) === null || `a level later it is still refused: ${Game.studyReason(second)}`;
});

await test('a ring is known only by its look until it is worn or studied, and sells as a trinket till then', async () => {
  const out = [];
  const ctx = await start('fighter', 'jewels-known');
  const { Game, ITEMS } = ctx; const p = Game.player();
  const it = { t: 'ring_evasion', q: 1, e: 0 }; p.inv.push(it);
  const shown = Game.itemName(it);
  if (!/^[A-Z][a-z]+ Ring$/.test(shown) || shown.includes('Evasion')) out.push(`an unknown ring is called "${shown}"`);
  // nor does a finely made one say so before its kind is known
  const fine = { t: 'ring_protect', q: 1, e: 2 };
  if (/\+2/.test(Game.itemName(fine))) out.push(`an unknown ring gives away its make: "${Game.itemName(fine)}"`);
  if (Game.sellPrice(it) >= ITEMS.ring_evasion.value * 0.45) out.push(`an unknown ring sells for ${Game.sellPrice(it)}, as much as a known one`);
  Game.equip(it, true);
  if (Game.itemName(it) !== 'Ring of Evasion') out.push(`worn, it is called "${Game.itemName(it)}"`);
  // another of the same kind is known on sight after that
  const two = { t: 'ring_evasion', q: 1, e: 0 };
  if (Game.itemName(two) !== 'Ring of Evasion') out.push('a second one of a known kind was not named');
  // an amulet can be puzzled out instead: study until it gives up its name
  const am = { t: 'amulet_ward', q: 1, e: 0 }; p.inv.push(am);
  p.stats.int = 18;
  for (let i = 0; i < 20 && !Game.isKnown(am.t); i++) { p.level = 2 + i; Game.study(am); }
  if (!Game.isKnown(am.t)) out.push('studying an amulet never told what it was');
  // the looks are dealt out afresh each run, but always the same for a seed
  const again = await start('fighter', 'jewels-known');
  if (again.Game.itemName({ t: 'ring_evasion', q: 1 }) !== shown) out.push('the same seed dealt a different look');
  return out.length ? out.join('; ') : true;
});

await test('an Amulet of Life Saving takes the killing blow once, and crumbles', async () => {
  const ctx = await start('fighter', 'jewels-life');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const am = { t: 'amulet_life', q: 1, e: 0 }; p.inv.push(am); Game.equip(am, true);
  p.hp = 3; p.effects.ac = { amount: -60, until: 1e12 };
  const m = beside(ctx, 'ogre', { hp: 999, maxHp: 999 });
  for (let i = 0; i < 40 && p.hp > 0 && p.hp <= 3; i++) { m.nextAct = G.t; run(Game, G, 1200); }
  if (G.status !== 'playing') return `the hero died wearing it (${G.status})`;
  if (p.eq.amulet) return 'the amulet is still worn';
  if (p.hp < Math.ceil(p.maxHp / 2) - 40) return `left at ${p.hp} of ${p.maxHp}`;
  if (!/crumbles to dust/.test(G.log.map(l => l.m).join('\n'))) return 'nothing said it saved you';
  // and only once
  p.hp = 1; m.nextAct = G.t;
  for (let i = 0; i < 40 && G.status === 'playing'; i++) { m.nextAct = G.t; run(Game, G, 1200); }
  return G.status === 'dead' || 'a second killing blow was turned too';
});

await test('a Ring of Evasion softens what lands: a web binds the nimble-fingered for less time', async () => {
  const time = async rings => {
    const ctx = await start('fighter', 'jewels-evade-' + rings);
    seedDice(ctx, 'jewels-evade-' + rings);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.stats.dex = 3; p.hp = p.maxHp = 9999;
    for (let i = 0; i < rings; i++) { const r = { t: 'ring_evasion', q: 1, e: 2 }; p.inv.push(r); Game.equip(r, true); }
    let total = 0;
    for (let i = 0; i < 120; i++) {
      p.webbed = 0; p.held = 0; p.hp = 9999;
      const m = ahead(ctx, 'spider', 2, { hp: 999, maxHp: 999, spoke: true });
      m.windup = { kind: 'move', move: 'web', at: G.t, until: G.t };
      m.nextAct = G.t;
      Game.update(G.t + 25, 25);
      total += Math.max(0, (p.webbed || 0) - G.t);
      Game.update(G.t + 6000, 6000);
    }
    return total;
  };
  // one ring: a second of the same kind adds nothing (see the test below)
  const bare = await time(0), ringed = await time(1);
  return bare > ringed * 1.08 || `webbed ${bare}ms bare, ${ringed}ms with the ring`;
});

await test('rings and amulets turn up from the second floor, from their own stream, and survive a reload', async () => {
  const out = [];
  let found = 0, floors = 0, onFirst = 0;
  for (let i = 0; i < 12; i++) {
    const ctx = await start('thief', 'jewels-place-' + i);
    const { Game, ITEMS } = ctx; const G = Game.state();
    for (let d = 1; d <= 6; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = G.levels[d] || null;
      if (!L || G.depth !== d) continue;
      const n = Object.values(L.items).flat().filter(it => ['ring', 'amulet'].includes(ITEMS[it.t].kind)).length;
      if (d === 1) onFirst += n; else { found += n; floors++; }
    }
  }
  if (onFirst) out.push(`${onFirst} pieces on first floors`);
  if (floors && (found / floors < 0.2 || found / floors > 0.8)) out.push(`${found} pieces over ${floors} floors`);
  if (!floors) out.push('no floors were generated to look at');
  // the slots and the looks come back from a save
  const ctx = await start('cleric', 'jewels-save');
  const { Game } = ctx; const p = Game.player();
  const r = { t: 'ring_protect', q: 1, e: 1 }; p.inv.push(r); Game.equip(r, true);
  Game.save(true);
  if (!Game.load()) out.push('load failed');
  else if (!Game.player().eq.ring || Game.player().eq.ring.t !== 'ring_protect' || Game.itemName(Game.player().eq.ring) !== 'Ring of Protection +1') out.push('the ring did not come back from the save');
  return out.length ? out.join('; ') : true;
});
};
