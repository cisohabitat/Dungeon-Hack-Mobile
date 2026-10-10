// Rule checks for the vows sworn as pacts (each adding its share to the
// score) and what wins open for the start of a run: each class's second kit,
// the backgrounds earned by finds, and a hound from the first stair. Run from
// rules.js with its helpers lent in.
module.exports = async function pactChecks(h) {
  const { test, newContext, start, walk, meetAndChoose, winHere, OPTS, evenStats } = h;

  /** A hero on a path facing open floor, a foe put in front of it, and a swing. */
  const arena = async (cls, seed, path) => {
    const ctx = await start(cls, seed);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    walk(ctx, path);
    p.hp = p.maxHp = 9999; p.level = 9; p.perkHit = 60;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.monsters.length = 0; L.npcs = []; L.items = {};
    const put = (id, fwd, side, extra = {}) => { const x = p.x + dx * fwd, y = p.y + dy * fwd; const m = { uid: 900, id, x, y, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    const swing = () => { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); };
    return { ctx, Game, p, G, L, put, swing };
  };

  /** A run begun in a fresh world, with this progress already kept. */
  const begun = async (cls, seed, opts = {}, progress = null, bg = 'oathbroken') => {
    const ctx = await newContext();
    if (progress) ctx.store.set('deepdelve.progress', JSON.stringify({ won: {}, relics: [], ...progress }));
    ctx.Game.newGame({ name: 'P', cls, bg, stats: { ...evenStats }, seed, opts: { ...OPTS, permadeath: true, ...opts } });
    return ctx;
  };
  const hardWon = { won: { fighter: { hard: 1 } } };

  await test('each vow adds its share to the score: two sworn, both shares, on a death as on a win', async () => {
    const out = [];
    const plain = await begun('fighter', 'pact-score', {}, hardWon);
    const sworn = await begun('fighter', 'pact-score', { vows: ['iron', 'glass'] }, hardWon);
    const VOWS = sworn.VOWS;
    for (const won of [false, true]) {
      const p = plain.Game.player(), q = sworn.Game.player();
      p.xp = q.xp = 900; p.deepest = q.deepest = 4;
      const a = plain.Game.score(p, 4, won), b = sworn.Game.score(q, 4, won);
      const want = Math.round(a * (1 + VOWS.iron.score + VOWS.glass.score));
      if (Math.abs(b - want) > 1) out.push(`${won ? 'a win' : 'a death'} scored ${b} sworn against ${a} plain, want ${want}`);
    }
    // and every vow has a share, and says what it is
    for (const [id, v] of Object.entries(VOWS)) if (!(v.score > 0 && v.score <= 0.5) || !v.desc) out.push(`${id} has share ${v.score}`);
    if (Object.keys(VOWS).length < 6) out.push(`only ${Object.keys(VOWS).length} vows`);
    return out.length ? out.join('; ') : true;
  });

  await test('the Glass Vow takes a quarter of the life, at the start and from each level gained', async () => {
    const plain = await begun('fighter', 'pact-glass', {}, hardWon);
    const glass = await begun('fighter', 'pact-glass', { vows: ['glass'] }, hardWon);
    const a = plain.Game.player(), b = glass.Game.player();
    if (b.maxHp !== Math.max(6, Math.round(a.maxHp * 0.75)) || b.hp !== b.maxHp) return `the glass hero began on ${b.hp}/${b.maxHp} against ${a.maxHp}`;
    // the same dice on the same seed: the gain is the plain one's, three quarters of it
    const before = [a.maxHp, b.maxHp];
    for (const w of [plain, glass]) { w.Dice.s = new w.Rng('pact-glass-level').s; w.Game.testLevel(); }
    const ga = a.maxHp - before[0], gb = b.maxHp - before[1];
    if (!(ga > 0 && gb > 0 && gb < ga)) return `levels gained ${ga} plain and ${gb} glass`;
    return true;
  });

  await test('the Hunted Vow makes everything a tenth quicker', async () => {
    const plain = await begun('fighter', 'pact-hunted', {}, hardWon);
    const hunted = await begun('fighter', 'pact-hunted', { vows: ['hunted'] }, hardWon);
    const m = { id: 'goblin', x: 1, y: 1, hp: 5, maxHp: 5 };
    const a = plain.Game.mstat(m).speed, b = hunted.Game.mstat(m).speed;
    return b === Math.round(a * 0.9) || `a goblin's speed ${a} plain, ${b} hunted`;
  });

  await test('the Lone Vow: no companion joins, the stray will not follow, and a druid has no wolf', async () => {
    const out = [];
    const ctx = await begun('fighter', 'pact-alone', { vows: ['alone'] }, hardWon);
    // the choices that would bring one are not on offer, and say why (nothing is paid for a refusal)
    try { meetAndChoose(ctx, 'stray', 0); } catch (e) { /* a blocked choice may leave it open */ }
    const offered = ctx.Game.encounterOptions();
    const brings = offered.filter(o => !/Leave it/.test(o.label)), leave = offered.find(o => /Leave it/.test(o.label));
    if (!brings.length || brings.some(o => !o.blocked || !/swore to go alone/.test(o.blocked)) || !leave || leave.blocked) out.push(`the stray's choices: ${JSON.stringify(offered.map(o => [o.label, o.blocked]))}`);
    if (ctx.Game.companion()) out.push(`the stray followed: ${ctx.Game.companion().name}`);
    // a druid's wolf comes to a delve with no hound in it: find one, and swear the vow there
    for (let i = 0; i < 20; i++) {
      const plain = await begun('druid', 'pact-wolf-' + i, {}, hardWon);
      if (!plain.Game.companion()) continue;
      const alone = await begun('druid', 'pact-wolf-' + i, { vows: ['alone'] }, hardWon);
      if (alone.Game.companion()) out.push('the wolf came to one sworn to go alone');
      return out.length ? out.join('; ') : true;
    }
    out.push('no seed sent a druid a wolf');
    return out.join('; ');
  });

  await test('the second kit: shut until the class wins on Normal or Hard, never in a Daily; the Cutpurse holds the dagger', async () => {
    const out = [];
    const shut = await begun('thief', 'pact-kit', { kit: 'alt' });
    if (shut.Game.state().opts.kit || (shut.Game.player().eq.weapon || {}).t !== 'shortsword') out.push('a shut kit was given');
    const won = { won: { thief: { normal: 1 } } };
    const open = await begun('thief', 'pact-kit', { kit: 'alt' }, won);
    const p = open.Game.player(), kit = open.CLASSES.thief.altKit;
    if (open.Game.state().opts.kit !== 'alt') out.push('an open kit was not kept in the options');
    const had = t => [...p.inv, ...Object.values(p.eq)].filter(it => it && it.t === t).reduce((n, it) => n + (it.q || 1), 0);
    for (const t of new Set(kit.items)) if (had(t) < kit.items.filter(x => x === t).length) out.push(`the ${kit.name} lacks its ${t}`);
    if (!p.eq.weapon || p.eq.weapon.t !== 'dagger' || !p.eq.armor) out.push(`the Cutpurse holds ${p.eq.weapon && p.eq.weapon.t}, wearing ${p.eq.armor && p.eq.armor.t}`);
    if (!kit.items.every(t => open.Game.isKnown(t))) out.push('the second kit is not known to its owner');
    // every class has one, of things that exist, each with a name and a line
    for (const [cls, c] of Object.entries(open.CLASSES)) {
      if (!c.altKit) { out.push(`${cls} has no second kit`); continue; }
      const bad = c.altKit.items.filter(t => !open.ITEMS[t]);
      if (bad.length || !c.altKit.name || !c.altKit.desc) out.push(`${cls}'s second kit: ${bad.join(', ') || 'no name or line'}`);
    }
    const daily = await begun('thief', 'pact-kit', { kit: 'alt', daily: 'thief' }, won);
    if (daily.Game.state().opts.kit) out.push('a Daily took the second kit');
    return out.length ? out.join('; ') : true;
  });

  await test('a hound from the first stair: once a veteran companion has seen a win, not before, nor to one sworn alone', async () => {
    const out = [];
    const shut = await begun('cleric', 'pact-hound', { companion: 'hound' });
    if (shut.Game.companion()) out.push('a hound came before it was earned');
    const vet = { won: { cleric: { normal: 1 } }, feats: { veteran: 1 } };
    const open = await begun('cleric', 'pact-hound', { companion: 'hound' }, vet);
    const c = open.Game.companion();
    if (!c || c.kind !== 'hound' || c.joined !== 1) out.push(`the earned hound: ${JSON.stringify(c && { kind: c.kind, joined: c.joined })}`);
    const alone = await begun('cleric', 'pact-hound', { companion: 'hound', vows: ['alone'] }, { ...vet, ...hardWon, won: { ...vet.won, ...hardWon.won } });
    if (alone.Game.companion()) out.push('a hound came to one sworn alone');
    return out.length ? out.join('; ') : true;
  });

  await test('the Lorekeeper opens at twelve combinations found, the Legend-Seeker at three legends; the Lorekeeper knows every scroll', async () => {
    const out = [];
    const ctx = await newContext();
    const { Progress, RELICS } = ctx;
    const combos = Object.keys((await import('../js/combos.js')).COMBOS);
    const legends = Object.keys(RELICS).filter(id => RELICS[id].legend);
    const set = v => ctx.store.set('deepdelve.progress', JSON.stringify({ won: {}, relics: [], ...v }));
    set({ combos: combos.slice(0, 11), relics: legends.slice(0, 2) });
    if (Progress.bgOpen('lorekeeper') || Progress.bgOpen('seeker')) out.push('open a find too soon');
    set({ combos: combos.slice(0, 12), relics: legends.slice(0, 3) });
    if (!Progress.bgOpen('lorekeeper') || !Progress.bgOpen('seeker')) out.push('shut at twelve combinations and three legends');
    // and a relic that is not a legend does not count as one
    set({ relics: Object.keys(RELICS).filter(id => !RELICS[id].legend).slice(0, 5) });
    if (Progress.bgOpen('seeker')) out.push('plain relics opened the Legend-Seeker');
    const lore = await begun('mage', 'pact-lore', {}, { combos: combos.slice(0, 12) }, 'lorekeeper');
    const { Game, ITEMS } = lore;
    for (const t of ['scroll_map', 'scroll_heal']) if (!Game.player().inv.some(it => it.t === t)) out.push(`the Lorekeeper has no ${t}`);
    const unknown = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'scroll' && !Game.isKnown(id));
    if (unknown.length) out.push(`scrolls unknown to the Lorekeeper: ${unknown.join(', ')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a marked one carries the legend twice as often for the Legend-Seeker', async () => {
    const drops = {};
    for (const bg of ['oathbroken', 'seeker']) {
      const { ctx, Game, p, G, L, put, swing } = await arena('fighter', 'pact-seeker', 'knight');
      p.bg = bg;
      const m = put('orc', 1, 0, { hp: 1, maxHp: 1, elite: true });
      // a chance between the plain one (a quarter) and the doubled one (a half)
      const rand = Math.random; Math.random = () => 0.4;
      try { for (let i = 0; i < 8 && L.monsters.includes(m); i++) swing(); } finally { Math.random = rand; }
      if (L.monsters.includes(m)) return 'the marked orc would not fall';
      drops[bg] = Object.values(L.items).flat().filter(it => it.u === 'bastion').length;
      void ctx; void Game; void G;
    }
    return (drops.oathbroken === 0 && drops.seeker === 1) || `legends dropped: ${JSON.stringify(drops)}`;
  });

  await test('the unlocks: ten to twelve new ways to begin, each saying how it is earned, opened by the wins that earn them', async () => {
    const out = [];
    const ctx = await newContext();
    const { Progress } = ctx;
    const u = Progress.unlocks();
    if (u.length < 10 || u.length > 12) out.push(`${u.length} unlocks`);
    if (u.some(x => x.open)) out.push(`open at the start: ${u.filter(x => x.open).map(x => x.id).join(', ')}`);
    if (u.some(x => !x.how || !x.name)) out.push('an unlock with no way to earn it');
    // a Hard win as a fighter opens the vows, the Ashborn's past and the fighter's kit, and a win opens the earned past
    ctx.Game.newGame({ name: 'U', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'pact-unlock', opts: { ...OPTS, permadeath: true, difficulty: 'hard' } });
    winHere(ctx.Game);
    const now = Progress.unlocks().filter(x => x.open).map(x => x.id).sort();
    for (const want of ['kit:fighter', 'vows']) if (!now.includes(want)) out.push(`a Hard fighter's win left ${want} shut`);
    if (now.includes('kit:mage') || now.includes('hound')) out.push(`a fighter's win opened ${now.join(', ')}`);
    return out.length ? out.join('; ') : true;
  });
};
