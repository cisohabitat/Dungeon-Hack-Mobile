// Rule checks for the masteries that are each one rule (ROADMAP Phase 8, the design review's D4):
// the seventeen that were a bigger number. Run from rules.js's worker with the helpers lent in.
module.exports = async function capstoneChecks(h) {
  const { start, beside, ahead, seedDice, walk, test, markLog, linesSince, pinned } = h;

  /** A hero on a path with a mastery, knowing its spells (level 7, as a mastered hero is) and full of points. */
  const hero = async (cls, path, cap, seed = cap) => {
    const ctx = await start(cls, 'capstone-' + seed);
    const p = ctx.Game.player();
    walk(ctx, path); p.capstone = cap; p.level = 7; p.perkHit = 60; p.sp = p.maxSp = 40;
    return ctx;
  };
  const spell = (ctx, id) => ctx.Game.knownSpells().find(s => s.id === id);
  const cast = (ctx, id) => { const G = ctx.Game.state(), p = ctx.Game.player(); G.t = p.nextAttack; return ctx.Game.castSpell(spell(ctx, id)); };
  /** Swings at a foe beside the hero; whether any of `n` landed. */
  const swings = (ctx, m, n = 1) => { const G = ctx.Game.state(), p = ctx.Game.player(); const was = m.hp; for (let i = 0; i < n; i++) { G.t = p.nextAttack; ctx.Game.input('attack'); } return m.hp < was; };
  /** The dice pinned to the top of every die: every roll a twenty, every blow its most. */
  const topDice = async (ctx, fn) => { const real = ctx.Dice.next; ctx.Dice.next = () => 0.999999; try { return await fn(); } finally { ctx.Dice.next = real; } };

  await test('Shield Wall: a blow caught on the shield staggers its maker, which swings fewer times in the same minutes', async () => {
    const blows = async cap => {
      const ctx = await hero('fighter', 'knight', cap, 'shield-wall-' + cap);
      seedDice(ctx, 'shield-wall');
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 1e6; p.eq.shield = { t: 'towershield', q: 1, e: 1 }; p.eq.armor = null; p.stats.dex = 3; p.abilityReady = G.t + 1e9;
      const m = beside(ctx, 'goblin', { hp: 1e6, maxHp: 1e6 });
      for (let t = 0; t < 120000; t += 25) Game.update(G.t + 25, 25);
      return m.blows || 0;
    };
    const plain = await blows(undefined), walled = await blows('unbreakable');
    return (walled < plain) || `the goblin swung ${plain} times at a Knight, ${walled} at one with Shield Wall`;
  });

  await test('Dawnbringer: a Templar\'s blows at the undead cannot miss, at the living they can', async () => {
    const ctx = await hero('cleric', 'templar', 'dawnbringer');
    const p = ctx.Game.player(); p.perkHit = -60;
    const dead = beside(ctx, 'skeleton', { hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
    if (!swings(ctx, dead)) return 'a blow at a skeleton missed';
    const live = beside(ctx, 'orc', { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
    const G = ctx.Game.state(), mark = markLog(G);
    swings(ctx, live, 6);
    return linesSince(G, mark).some(l => /^You miss the Orc/.test(l)) || 'six blows at an orc all landed with no way to';
  });

  await test('Crusader\'s Smite: a Smite that fells its foe costs nothing; one that does not is spent', async () => {
    const ctx = await hero('cleric', 'templar', 'crusade');
    const { Game } = ctx; const p = Game.player();
    const sp = spell(ctx, 'smite'); if (!sp) return 'no Smite known';
    ahead(ctx, 'rat', 2, { hp: 1, maxHp: 1, nextAct: 1e12 });
    const before = p.sp;
    if (!cast(ctx, 'smite')) return 'the Smite was not cast';
    if (p.sp !== before) return `a felling Smite left ${p.sp} of ${before} spell points`;
    ahead(ctx, 'orc', 2, { uid: 97, hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
    cast(ctx, 'smite');
    return p.sp === before - Game.spellCost(sp) || `a Smite that did not fell left ${p.sp} of ${before}`;
  });

  await test('Wellspring: healing past full is kept as a ward, up to half of life, and the next blow spends it first', async () => {
    const ctx = await hero('cleric', 'healer', 'wellspring');
    const { Game } = ctx; const p = Game.player();
    p.maxHp = 40; p.hp = 39; ctx.Game.level().monsters.length = 0;
    if (!cast(ctx, 'cure_light')) return 'the cure was not cast';
    if (!(p.ward > 0) || p.ward > 20) return `the ward is ${p.ward}`;
    const ward = p.ward;
    Game.hurtPlayer(3, 'A test blow.', null, 'a test');
    if (p.hp !== 40 || p.ward !== ward - 3) return `after a blow of 3 with a ward of ${ward}: ${p.hp} life, ward ${p.ward}`;
    Game.hurtPlayer(p.ward + 2, 'A test blow.', null, 'a test');
    return (p.hp === 38 && p.ward === 0) || `a blow past the ward left ${p.hp} life, ward ${p.ward}`;
  });

  await test('Inferno: a Pyromancer\'s fire deals double to a foe already burning', async () => {
    const burnt = async burning => {
      const ctx = await hero('mage', 'pyromancer', 'inferno', 'inferno-' + burning);
      seedDice(ctx, 'inferno');
      const m = ahead(ctx, 'orc', 1, { hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
      if (burning) m.dot = { kind: 'burning', until: ctx.Game.state().t + 1e9, next: 1e12, die: 4 };
      cast(ctx, 'burning_hands');
      return 1e6 - m.hp;
    };
    const cold = await burnt(false), hot = await burnt(true);
    const r = hot / cold;
    return (cold > 0 && r > 1.55 && r < 1.8) || `the fire did ${cold} to a cold orc and ${hot} to a burning one`;
  });

  await test('Deep Winter: a blow at a foe held fast by cold cannot miss; by a cord it can', async () => {
    const ctx = await hero('mage', 'frostweaver', 'deep_winter');
    const p = ctx.Game.player(), G = ctx.Game.state(); p.perkHit = -60;
    const iced = beside(ctx, 'orc', { hp: 1e6, maxHp: 1e6, nextAct: 1e12, snaredUntil: G.t + 1e9, heldBy: 'ice' });
    if (!swings(ctx, iced)) return 'a blow at an orc held by cold missed';
    const corded = beside(ctx, 'orc', { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: 1e12, snaredUntil: G.t + 1e9, heldBy: 'snare' });
    const mark = markLog(G);
    swings(ctx, corded, 6);
    return linesSince(G, mark).some(l => /^You miss the Orc/.test(l)) || 'six blows at a snared orc all landed with no way to';
  });

  await test('Ice Armour: a blow that lands while Shield is up chills its maker', async () => {
    const ctx = await hero('mage', 'frostweaver', 'ice_armour');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.maxHp = p.hp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    const m = beside(ctx, 'goblin', { hp: 1e6, maxHp: 1e6, nextAct: G.t });
    if (!cast(ctx, 'shield')) return 'Shield was not cast';
    const mark = markLog(G);
    for (let i = 0; i < 2400 && !linesSince(G, mark).some(l => /rime of your Shield holds it back/.test(l)); i++) Game.update(G.t + 25, 25);
    if (!linesSince(G, mark).some(l => /rime of your Shield holds it back/.test(l))) return 'no landed blow was chilled in a minute';
    return m.nextAct >= G.t + 700 || `the chilled goblin acts again in ${m.nextAct - G.t} ms`;
  });

  await test('Shadow\'s Edge: a critical hit on a foe at a third of its life kills it outright, but not the Heart\'s keeper', async () => {
    const ctx = await hero('thief', 'assassin', 'shadows_edge');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const m = beside(ctx, 'ogre', { hp: 30, maxHp: 100, nextAct: 1e12, awake: true });
    await topDice(ctx, async () => { G.t = p.nextAttack; Game.input('attack'); });
    if (Game.level().monsters.includes(m) && m.hp > 0) return `the ogre stood on ${m.hp} after a critical hit at a third of its life`;
    const boss = beside(ctx, 'lich', { uid: 96, hp: 900, maxHp: 3000, nextAct: 1e12, awake: true });
    await topDice(ctx, async () => { G.t = p.nextAttack; Game.input('attack'); });
    if (!(boss.hp > 0)) return 'the lich was cut down outright';
    const whole = beside(ctx, 'ogre', { uid: 97, hp: 90, maxHp: 100, nextAct: 1e12, awake: true });
    await topDice(ctx, async () => { G.t = p.nextAttack; Game.input('attack'); });
    return whole.hp > 0 || 'an ogre at nine tenths was cut down outright';
  });

  await test('Vanish: the first blow at the hero from each foe swings at the air; its second can land', async () => {
    const ctx = await hero('thief', 'trickster', 'vanish');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.maxHp = p.hp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    const m = beside(ctx, 'ogre', { hp: 1e6, maxHp: 1e6, nextAct: G.t });
    const mark = markLog(G);
    for (let i = 0; i < 2400 && !m.vanishedOn; i++) Game.update(G.t + 25, 25);
    if (!m.vanishedOn || p.hp !== 1e6) return `the first blow: vanished ${!!m.vanishedOn}, life ${p.hp}`;
    if (!linesSince(G, mark).some(l => /strikes at where you were/.test(l))) return 'the air was not struck';
    for (let i = 0; i < 4800 && p.hp === 1e6; i++) Game.update(G.t + 25, 25);
    return p.hp < 1e6 || 'no later blow landed in two minutes';
  });

  await test('Quick Smoke: a foe that falls while the Smoke hangs gives it back; one that falls after does not', async () => {
    const ctx = await hero('thief', 'trickster', 'quick_smoke');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    beside(ctx, 'goblin', { hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
    if (!Game.useAbility()) return 'Smoke could not be thrown';
    if (!(p.abilityReady > G.t) || !(p.smokeUntil > G.t)) return 'the Smoke did not hang';
    const rat = beside(ctx, 'rat', { uid: 96, hp: 1, maxHp: 1, nextAct: 1e12 });
    swings(ctx, rat, 6);
    if (p.abilityReady > G.t) return 'a foe fell in the smoke and the Smoke did not come back';
    p.abilityReady = G.t + 1e9; p.smokeUntil = 0;
    const rat2 = beside(ctx, 'rat', { uid: 97, hp: 1, maxHp: 1, nextAct: 1e12 });
    swings(ctx, rat2, 6);
    return p.abilityReady > G.t || 'a foe fell after the smoke cleared and the Smoke came back';
  });

  await test('Deadeye: an arrow at a foe three squares off cannot miss; at two it can', async () => {
    const ctx = await hero('ranger', 'sharpshooter', 'deadeye');
    const p = ctx.Game.player(), G = ctx.Game.state(); p.perkHit = -60; p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.eq.offhand = null;
    const far = ahead(ctx, 'orc', 3, { hp: 1e6, maxHp: 1e6, nextAct: 1e12, awake: true });
    if (!swings(ctx, far)) return 'an arrow at three squares missed';
    const near = ahead(ctx, 'orc', 2, { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: 1e12, awake: true });
    const mark = markLog(G);
    swings(ctx, near, 6);
    return linesSince(G, mark).some(l => /^You miss the Orc/.test(l)) || 'six arrows at two squares all landed with no way to';
  });

  await test('Swift Draw: an arrow that fells its foe nocks the next at once', async () => {
    const ctx = await hero('ranger', 'sharpshooter', 'swift_draw');
    const p = ctx.Game.player(), G = ctx.Game.state(); p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.eq.offhand = null;
    const rat = ahead(ctx, 'rat', 3, { hp: 1, maxHp: 1, nextAct: 1e12, awake: true });
    swings(ctx, rat, 1);
    if (ctx.Game.level().monsters.includes(rat)) return 'the rat stood';
    if (p.nextAttack > G.t) return `after a felling arrow the next waits ${p.nextAttack - G.t} ms`;
    const orc = ahead(ctx, 'orc', 3, { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: 1e12, awake: true });
    swings(ctx, orc, 1);
    return p.nextAttack > G.t || 'an arrow that did not fell left the next ready at once';
  });

  await test('Iron Snare: no blow of the Warden\'s at a snared foe misses; at a free one it can', async () => {
    const ctx = await hero('ranger', 'warden', 'iron_snare');
    const p = ctx.Game.player(), G = ctx.Game.state(); p.perkHit = -60;
    const snared = beside(ctx, 'orc', { hp: 1e6, maxHp: 1e6, nextAct: 1e12, snaredUntil: G.t + 1e9, heldBy: 'snare' });
    if (!swings(ctx, snared)) return 'a blow at a snared orc missed';
    const free = beside(ctx, 'orc', { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: 1e12 });
    const mark = markLog(G);
    swings(ctx, free, 6);
    return linesSince(G, mark).some(l => /^You miss the Orc/.test(l)) || 'six blows at a free orc all landed with no way to';
  });

  await test('Wild Bulwark: a snared foe\'s blows at the Warden swing at the air; freed, they land', async () => {
    const ctx = await hero('ranger', 'warden', 'wild_bulwark');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.maxHp = p.hp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    const m = beside(ctx, 'goblin', { hp: 1e6, maxHp: 1e6, nextAct: G.t, snaredUntil: G.t + 60000, heldBy: 'snare' });
    const mark = markLog(G);
    for (let i = 0; i < 2000; i++) Game.update(G.t + 25, 25);
    if (p.hp !== 1e6) return `a snared goblin landed a blow: life ${p.hp}`;
    if (!linesSince(G, mark).some(l => /tears at the cord/.test(l))) return 'the snared goblin never swung';
    m.snaredUntil = 0;
    for (let i = 0; i < 4800 && p.hp === 1e6; i++) Game.update(G.t + 25, 25);
    return p.hp < 1e6 || 'the freed goblin landed nothing in two minutes';
  });

  await test('Dire Bear: a bear\'s blow that fells a foe throws the one behind it down', async () => {
    const ctx = await hero('druid', 'shapeshifter', 'dire_bear');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    if (!cast(ctx, 'wild_shape') || !Game.shaped()) return 'the bear was not taken';
    const rat = ahead(ctx, 'rat', 1, { hp: 1, maxHp: 1, nextAct: 1e12 });
    const orc = ahead(ctx, 'orc', 2, { uid: 96, hp: 1e6, maxHp: 1e6, nextAct: G.t + 1000 });
    Game.level().monsters.push(rat);   // (ahead clears the floor each time: both stand)
    const mark = markLog(G);
    for (let i = 0; i < 6 && Game.level().monsters.includes(rat); i++) swings(ctx, rat, 1);
    if (Game.level().monsters.includes(rat)) return 'the rat stood';
    if (!(orc.nextAct >= G.t + 1500 - 25)) return `the orc behind acts again in ${orc.nextAct - G.t} ms`;
    return linesSince(G, mark).some(l => /thrown down by the fall/.test(l)) || 'the fall was not told';
  });

  await test('Old Hide: in the bear\'s shape poison and the grave-cold do not touch the druid; out of it they do', async () => {
    const ctx = await hero('druid', 'shapeshifter', 'old_hide');
    const { Game } = ctx; const p = Game.player();
    p.maxHp = p.hp = 100;
    if (!cast(ctx, 'wild_shape') || !Game.shaped()) return 'the bear was not taken';
    Game.hurtPlayer(5, 'The poison burns in your veins.', null, 'poison');
    if (p.hp !== 100) return `poison took ${100 - p.hp} from the bear`;
    p.shape = null;
    Game.hurtPlayer(5, 'The poison burns in your veins.', null, 'poison');
    return p.hp === 95 || `poison took ${100 - p.hp} from the druid`;
  });

  await test('Heartwood: Mending Moss draws out poison as it mends; a Grovewarden without it stays poisoned', async () => {
    const ctx = await hero('druid', 'grovewarden', 'heartwood');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.maxHp = 100; p.hp = 50; p.poison = { until: G.t + 1e9, next: G.t + 1e9 };
    Game.level().monsters.length = 0;
    if (!cast(ctx, 'mending_moss')) return 'the moss was not cast';
    if (p.poison) return 'the poison stayed';
    const plain = await hero('druid', 'grovewarden', undefined, 'heartwood-plain');
    const q = plain.Game.player(); q.maxHp = 100; q.hp = 50; q.poison = { until: plain.Game.state().t + 1e9, next: plain.Game.state().t + 1e9 };
    plain.Game.level().monsters.length = 0;
    cast(plain, 'mending_moss');
    return !!q.poison || 'a Grovewarden without Heartwood was cured by the moss';
  });
};
