// Rule checks for what the view holds in the hero's hands, monsters that move and fall, and what a fight leaves on the floor and the view.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function handsChecks(h) {
  const { OPTS, evenStats, newContext, start, test, beside, run } = h;

// ---------- the hero's hands and monsters that move ----------
await test('the view holds what is equipped: weapon, shield or second blade, and the class glove', async () => {
  const out = [];
  { const ctx = await start('fighter', 'view-f'); const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.shield = { t: 'shield', q: 1, e: 0 };
    const v = Game.renderState(0).fx.view;
    if (v.weapon !== 'longsword' || v.shield !== 'shield' || v.two || v.drawn) out.push(`sword and board: ${JSON.stringify(v)}`);
    if (v.cls !== 'fighter') out.push(`fighter hands ${v.cls}`);
    p.eq.weapon = { t: 'staff', q: 1, e: 0 }; p.eq.shield = null;
    const s = Game.renderState(0).fx.view;
    if (!s.two || s.drawn || s.shield) out.push(`staff: ${JSON.stringify(s)}`);
    p.eq.weapon = { t: 'shortbow', q: 1, e: 0 };
    if (!Game.renderState(0).fx.view.drawn) out.push('a bow was swung like a blade');
    p.eq.weapon = null;
    if (Game.renderState(0).fx.view.weapon !== null) out.push('bare hands still held a weapon'); }
  { const ctx = await start('thief', 'view-t'); const { Game } = ctx; const p = Game.player();
    p.eq.weapon = { t: 'shortsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
    const v = Game.renderState(0).fx.view;
    if (v.offhand !== 'dagger' || v.cls !== 'thief') out.push(`dual: ${JSON.stringify(v)}`); }
  return out.length ? out.join('; ') : true;
});

await test('on a delve shorter than the Long Delve its creatures are a touch sturdier: a ninth on Normal, a twentieth on Hard; not on Easy, nor on the Long Delve', async () => {
  const out = [];
  for (const [difficulty, levels, want] of [['normal', 8, 1.5 * 1.11], ['normal', 12, 1.5], ['hard', 8, 1.9 * 1.05], ['hard', 16, 1.9], ['easy', 8, 1]]) {
    const ctx = await start('fighter', 'sturdy', { difficulty, levels });
    const got = ctx.Game.sturdiness();
    if (Math.abs(got - want) > 1e-9) out.push(`${difficulty}, ${levels} floors: ${got.toFixed(3)}, not ${want.toFixed(3)}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a ranger and a druid set out with three more hit points, a cleric three, a thief two (a mage seven, for want of armour; a fighter three and a ranger four more, off Hard); a druid\'s spell points run to the full measure', async () => {
  const out = [];
  // (these start on Normal: the fighter's and the ranger's few off Hard are counted, and their Hard starts in the test of their own)
  for (const [cls, extra] of [['thief', 2], ['ranger', 7], ['druid', 3], ['mage', 7], ['fighter', 3], ['cleric', 3]]) {
    const ctx = await start(cls, 'start-hp-' + cls);
    const p = ctx.Game.player(), c = ctx.CLASSES[cls];
    const want = Math.max(10, c.hitDie + 6 + extra + ctx.Game.mod(p.stats.con));
    if (p.maxHp !== want) out.push(`a ${cls} set out with ${p.maxHp} hit points, not ${want}`);
  }
  if (((await start('druid', 'druid-sp')).CLASSES.druid.spMul || 1) !== 1) out.push('a druid\'s spell points are not the full measure');
  return out.length ? out.join('; ') : true;
});

await test('on a quick delve of two floors a thief starts seven hit points sturdier, and no one else; and the lesser lich raises one of the dead at a time', async () => {
  const out = [];
  for (const cls of ['thief', 'fighter', 'mage']) {
    const hp = {};
    for (const levels of [2, 4]) { const ctx = await newContext(); ctx.Game.newGame({ name: 'Q', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'quick-hp', opts: { ...OPTS, levels } }); hp[levels] = ctx.Game.player().maxHp; }
    const want = cls === 'thief' ? 7 : 0;
    if (hp[2] - hp[4] !== want) out.push(`a ${cls} starts on ${hp[2]} on two floors, ${hp[4]} on four`);
  }
  // the lich's guards: two sharing a square on a delve of four floors, one on a quick delve
  for (const [levels, want] of [[2, 1], [4, 2]]) {
    const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'Q', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'quick-guard', opts: { ...OPTS, levels } });
    Game.testFloor(levels);
    const L = Game.level(), lich = L.monsters.find(m => m.id === 'lich');
    if (!lich) { out.push(`no lich on the last of ${levels} floors`); continue; }
    L.monsters = [lich];
    const p = Game.player(); p.hp = p.maxHp = 9999;
    lich.awake = true;
    Game.hurtMonster(lich, Math.ceil(lich.maxHp * 0.4));
    for (let i = 0; i < 100 && !L.monsters.some(m => m.risen); i++) Game.update(Game.state().t + 100, 100);
    const g = L.monsters.find(m => m.risen);
    if (!g) out.push(`the lich of ${levels} floors raised no one`);
    else if (1 + ((g.pack || []).length) !== want) out.push(`on ${levels} floors the lich raised ${1 + (g.pack || []).length}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('past the sixth floor of sixteen, on Normal or Hard, a sneak blow is one less (a plain thief\'s no better than any blow); not above it, nor on a shorter delve', async () => {
  const out = [];
  // an Assassin's (three), so the trim shows; a thief with nothing to add never falls below the double blow
  const at = async (opts, depth, path = 'assassin') => { const ctx = await start('thief', 'deep-sneak', opts); ctx.Game.state().depth = depth; ctx.Game.player().path = path; return ctx.Game.sneakMult(); };
  if (await at({ levels: 16, difficulty: 'normal' }, 9, null) !== 1) out.push('a thief with nothing to add kept the double blow past the sixth of sixteen');
  const base = await at({ levels: 16, difficulty: 'normal' }, 6);
  if (await at({ levels: 16, difficulty: 'normal' }, 7) !== base - 1) out.push('a sneak blow on the seventh of sixteen was not one less');
  if (await at({ levels: 16, difficulty: 'hard' }, 7) !== base - 1) out.push('the trim missed Hard');
  if (await at({ levels: 12, difficulty: 'normal' }, 12) !== base) out.push('the trim reached a twelve-floor delve');
  return out.length ? out.join('; ') : true;
});

await test('past the top level experience earns renown: a rank every 1500, each a choice of three small gains for good, the sharper twice at most; none offered with the boss down', async () => {
  const out = [];
  const ctx = await start('fighter', 'renown');
  const { Game, MAX_LEVEL, XP_TABLE, RENOWN_XP, RENOWN } = ctx; const p = Game.player(), G = Game.state();
  if (Game.renownAt(1) !== XP_TABLE[MAX_LEVEL - 1] + RENOWN_XP || RENOWN_XP !== 1500) out.push(`the first rank comes at ${Game.renownAt(1)}`);
  // a hero at level 11 who earns enough at once for the top and two ranks past it
  p.level = MAX_LEVEL - 1; p.xp = Game.renownAt(2); G.pendingBoons = []; G.pendingLevels = [];
  Game.testLevel();
  if (p.level !== MAX_LEVEL || p.renown !== 2) out.push(`level ${p.level}, renown ${p.renown}`);
  // (the level's own choices first, the path and the talent, then a card for each rank, last)
  const offers = G.pendingBoons.slice(), n = offers.length, rank = offers.slice(n - 2);
  if (offers.slice(0, n - 2).some(o => Game.isRenownOffer(o)) || !rank.every(o => Game.isRenownOffer(o))) out.push(`the offers came ${JSON.stringify(offers)}`);
  if (!rank.every(o => o.length === 3 && new Set(o).size === 3 && o.every(id => RENOWN.some(r => r.id === id)))) out.push(`a rank offered ${JSON.stringify(rank)}`);
  if (G.pendingLevels[n - 2] !== MAX_LEVEL + 1 || G.pendingLevels[n - 1] !== MAX_LEVEL + 2) out.push(`ranks queued as ${G.pendingLevels}`);
  G.pendingBoons = [rank[0]]; G.pendingLevels = [MAX_LEVEL + 1];
  // a gain is for good, and said on the hero
  const hp = p.maxHp;
  G.pendingBoons[0] = ['r_vigor', 'r_keen', 'r_steady'];
  if (!Game.chooseBoon('r_vigor') || p.maxHp !== hp + 6 || !(p.renownTaken || []).includes('r_vigor') || Game.pendingBoons()) out.push('Hardened did not take');
  // a level is not gained past the top, and the sharper gains come twice at most
  p.renownTaken = ['r_keen', 'r_keen'];
  for (let i = 0; i < 12; i++) {
    G.pendingBoons = []; G.pendingLevels = [];
    Game.testLevel();
    const o = Game.pendingBoons();
    if (!o) { out.push('a rank came with no offer'); break; }
    if (o.includes('r_keen')) { out.push('Veteran\'s Eye offered a third time'); break; }
    if (o.includes('r_well')) { out.push('a fighter was offered spell points'); break; }
  }
  if (p.level !== MAX_LEVEL) out.push(`rose to level ${p.level}`);
  // Unshaken counts toward every save of the hero's; Well Practised brings the class move back sooner
  const saves = Game.heroSaves();
  G.pendingBoons = [['r_steady', 'r_quick', 'r_vigor']]; G.pendingLevels = [MAX_LEVEL + 9];
  Game.chooseBoon('r_steady');
  if (Game.heroSaves() !== saves + 1) out.push(`saves ${saves} then ${Game.heroSaves()}`);
  G.pendingBoons = [['r_steady', 'r_quick', 'r_vigor']]; G.pendingLevels = [MAX_LEVEL + 9];
  Game.chooseBoon('r_quick');
  const L = Game.level(), [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  L.monsters.length = 0;
  L.monsters.push({ uid: 77, id: 'orc', x: p.x + dx, y: p.y + dy, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  p.abilityReady = 0; G.t = Math.max(G.t, p.nextAttack) + 10;
  Game.useAbility();
  if (p.abilityReady - G.t !== 13500) out.push(`Bash came back in ${p.abilityReady - G.t}ms`);
  // with the boss down the rank is still earned, but no card stands between the hero and the Heart
  G.bossDown = true; G.pendingBoons = []; G.pendingLevels = [];
  const was = p.renown;
  Game.testLevel();
  if (p.renown !== was + 1 || Game.pendingBoons()) out.push('a rank with the boss down offered a choice, or was not earned');
  return out.length ? out.join('; ') : true;
});

await test('Attack swings the held weapon, a spell lifts the casting hand, and a monster lunges when it strikes', async () => {
  const out = [];
  const ctx = await start('mage', 'motion');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99;
  const m = beside(ctx, 'orc', { hp: 9999, maxHp: 9999, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  fx.swingAt = fx.castAt = -1e9;
  G.t = p.nextAttack; Game.input('attack');
  if (!(fx.swingAt > -1e9)) out.push('attacking did not swing');
  if (!(fx.swingMs >= 200 && fx.swingMs <= 380)) out.push(`swing lasted ${fx.swingMs}ms`);
  G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'magic_missile'));
  if (!(fx.castAt > -1e9)) out.push('casting did not raise the hand');
  m.nextAct = G.t; m.lungeAt = undefined;
  run(Game, G, 3000);
  if (!(m.lungeAt > 0)) out.push('the orc struck without lunging');
  return out.length ? out.join('; ') : true;
});

await test('a creature at rest breathes, slower and deeper the bigger it is; the dead and the bloodless do not', async () => {
  const ctx = await start('fighter', 'breathing');
  const { Game } = ctx;
  const out = [];
  /** the rise and fall of its height at rest over four seconds, and how often it turns */
  const breath = id => {
    const L = Game.level(); L.monsters.length = 0;
    beside(ctx, id, { nextAct: 1e12, awake: false });
    const h = []; for (let t = 0; t < 4000; t += 20) h.push(Game.renderState(10000 + t).sprites.find(s => s.maxHp).sqy);
    let turns = 0; for (let i = 2; i < h.length; i++) if ((h[i] - h[i - 1]) * (h[i - 1] - h[i - 2]) < 0) turns++;
    return { range: Math.max(...h) - Math.min(...h), turns };
  };
  const rat = breath('rat'), orc = breath('orc'), ogre = breath('ogre'), skel = breath('skeleton'), slime = breath('slime');
  if (!(orc.range > 0.05)) out.push(`an orc breathes too faintly to see (${orc.range.toFixed(3)})`);
  if (!(orc.range < 0.12)) out.push(`an orc heaves like a bellows (${orc.range.toFixed(3)})`);
  if (!(ogre.range > orc.range)) out.push(`the ogre breathes no deeper than the orc (${ogre.range.toFixed(3)} against ${orc.range.toFixed(3)})`);
  if (!(ogre.turns < orc.turns && orc.turns < rat.turns)) out.push(`breaths a rat ${rat.turns}, an orc ${orc.turns}, an ogre ${ogre.turns}: the bigger should breathe slower`);
  if (!(skel.range < 0.01)) out.push(`a skeleton breathes (${skel.range.toFixed(3)})`);
  if (!(slime.range < 0.01)) out.push(`a slime breathes (${slime.range.toFixed(3)})`);
  return out.length ? out.join('; ') : true;
});

await test('a slain monster falls where it stood, and is gone once it has fallen', async () => {
  const ctx = await start('fighter', 'corpse');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  for (let i = 0; i < 50 && Game.level().monsters.length; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (Game.level().monsters.length) return 'the goblin never died';
  const c = fx.corpses[fx.corpses.length - 1];
  if (!c || c.sprite !== 'goblin') return `no goblin corpse: ${JSON.stringify(fx.corpses)}`;
  const [dx, dy] = ctx.Dungeon.DIRS[p.dir];
  if (Math.floor(c.x) !== p.x + dx || Math.floor(c.y) !== p.y + dy) return `it fell at ${c.x},${c.y}`;
  if (!(c.dx * dx + c.dy * dy > 0.9)) return `it was knocked toward ${c.dx},${c.dy}`;
  Game.update(c.born + 2000, 25);
  if (fx.corpses.includes(c)) return 'the corpse never cleared';
  return true;
});

// ---------- what a fight leaves ----------
await test('a blow throws a spray in the colour the monster bleeds, and a kill stains the floor', async () => {
  const out = [];
  for (const [id, colour] of [['orc', '#b8161c'], ['slime', '#7ed052'], ['skeleton', '#e8e0cc']]) {
    const ctx = await start('fighter', 'spray-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.perkHit = 60;
    const m = beside(ctx, id, { hp: 3, maxHp: 30, nextAct: 1e12 });
    const fx = Game.renderState(0).fx;
    // a natural 1 strikes only sparks, so swing until a blow lands
    for (let i = 0; i < 20 && !fx.bits.some(b => !b.glow); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (!fx.bits.some(b => b.c === colour)) out.push(`${id} sprayed ${[...new Set(fx.bits.map(b => b.c))].join(',')}`);
    for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
    const stains = fx.stains[G.depth] || [];
    if (id === 'skeleton' ? stains.length : !stains.length) out.push(`${id} left ${stains.length} stains`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a missed blow strikes sparks; stains are capped per floor and gone in a new run', async () => {
  const ctx = await start('fighter', 'sparks');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = -99;
  beside(ctx, 'orc', { hp: 999, maxHp: 999, nextAct: 1e12 });
  const fx = Game.renderState(0).fx;
  // a natural 20 lands whatever the odds: swing until one misses
  for (let i = 0; i < 10; i++) {
    fx.bits.length = 0;
    G.t = p.nextAttack; Game.input('attack');
    if (fx.bits.length && fx.bits.every(b => b.glow)) break;
  }
  if (!fx.bits.length || !fx.bits.every(b => b.glow)) return `a miss threw ${fx.bits.length} bits`;
  p.perkHit = 60;
  for (let k = 0; k < 90; k++) {
    const m = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let i = 0; i < 20 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
  }
  const n = (fx.stains[G.depth] || []).length;
  if (n > 60 || n < 30) return `${n} stains after 90 kills`;
  Game.newGame({ name: 'Again', cls: 'fighter', stats: Game.rollStats(), seed: 'sparks2', opts: Game.state().opts });
  if (Object.keys(fx.stains).length || fx.bits.length) return 'the last run\'s stains carried over';
  return true;
});

await test('a hard blow jolts the view harder than a light one, and bloodies its edges', async () => {
  const ctx = await start('fighter', 'jolt');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const fx = Game.renderState(0).fx;
  // the same ogre's blow against a long life and a short one
  const blowAgainst = life => {
    p.hp = p.maxHp = life; fx.drops.length = 0;
    beside(ctx, 'ogre', { nextAct: G.t, awake: true });
    for (let i = 0; i < 400 && p.hp === life; i++) Game.update(G.t + 25, 25);
    return { dealt: life - p.hp, amp: fx.shakeAmp, drops: fx.drops.length };
  };
  // with ten hit points any blow at all is a tenth of them
  const long = blowAgainst(1000), short = blowAgainst(10);
  if (!long.dealt || !short.dealt) return 'the ogre never landed a blow';
  if (!(short.amp > long.amp)) return `shake ${long.amp} against a long life, ${short.amp} against a short one`;
  if (long.drops) return `a light blow (${long.dealt} of 1000) bloodied the view`;
  if (!short.drops) return `a blow for ${short.dealt} of 10 left no blood on the view`;
  return true;
});

await test('what ails the hero is passed to the view to tint it', async () => {
  const ctx = await start('cleric', 'tint');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  let st = Game.renderState(0).fx.status;
  if (st.poison || st.held || st.hit) return `a fresh hero is ${JSON.stringify(st)}`;
  p.poison = { until: G.t + 5000, next: G.t + 1000 }; p.held = G.t + 2000; p.effects.hit = { amount: 1, until: G.t + 9000 };
  st = Game.renderState(0).fx.status;
  return (st.poison && st.held && st.hit && !st.webbed) || JSON.stringify(st);
});
};
