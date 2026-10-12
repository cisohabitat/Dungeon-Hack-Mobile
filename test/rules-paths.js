// Rule checks for the paths offered at level 3, their capstones at level 7, and each path's own gift.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function pathsChecks(h) {
  const { OPTS, start, seedDice, markLog, linesSince, spreadPicks, test, beside, pinned, ahead, shift, run, talent, walk, tallyLines } = h;

// ---------- paths ----------
/** Bring the hero from one level to another with a single kill, as play does. */
function levelByKill(ctx, from, to) {
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.level = from; p.xp = XP_TABLE[to - 1]; p.perkHit = 60;
  G.pendingBoons = []; G.pendingLevels = [];
  const m = beside(ctx, 'rat', { uid: 700 + to, hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
}

await test('at level 3 every class is offered its own two paths, in place of the lesson', async () => {
  const out = [];
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    const ctx = await start(cls, 'path-offer-' + cls);
    const { Game, PATHS, PATH_LEVEL } = ctx;
    const p = Game.player(), G = Game.state();
    levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL);
    const offer = Game.pendingBoons();
    const want = PATHS[cls].map(x => x.id);
    if (PATHS[cls].length !== 2) out.push(`${cls} has ${PATHS[cls].length} paths`);
    if (!offer || offer.join() !== want.join() || !Game.isPathOffer(offer)) { out.push(`${cls} at level ${p.level} was offered ${offer && offer.join(', ')}`); continue; }
    if (Game.pendingLevel() !== PATH_LEVEL) out.push(`${cls}'s offer says level ${Game.pendingLevel()}`);
    if (Game.chooseBoon('knight') && cls !== 'fighter') out.push(`${cls} took the knight's path`);
    if (cls === 'fighter') { p.path = undefined; levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL); }
    const mark = markLog(G);
    if (!Game.chooseBoon(want[1])) { out.push(`${cls} could not take ${want[1]}`); continue; }
    if (p.path !== want[1]) out.push(`${cls} chose ${want[1]} and walks ${p.path}`);
    if (Game.pendingBoons()) out.push(`${cls} was offered ${Game.pendingBoons().join(', ')} as well`);
    if (!linesSince(G, mark).some(l => l.includes(PATHS[cls][1].name))) out.push(`${cls}: the log never named the path`);
    if (!Game.pathOf() || Game.pathOf().id !== want[1]) out.push(`${cls}: pathOf says ${Game.pathOf() && Game.pathOf().id}`);
    // and it is not offered again at the next odd level: that is a lesson
    levelByKill(ctx, PATH_LEVEL + 1, PATH_LEVEL + 2);
    if (!Game.pendingBoons() || Game.isPathOffer(Game.pendingBoons())) out.push(`${cls} at level 7 was offered ${Game.pendingBoons() && Game.pendingBoons().join(', ')}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('several levels at once still offer the path, between the talents, and a talent chosen first leaves it whole', async () => {
  const ctx = await start('cleric', 'path-multi');
  const { Game, TALENTS, BOONS } = ctx;
  const p = Game.player();
  levelByKill(ctx, 1, 4);
  const kinds = [];
  const q = Game.state().pendingBoons.map(o => Game.isPathOffer(o) ? 'P' : o.every(id => TALENTS.cleric.some(t => t.id === id)) ? 'T' : o.every(id => BOONS.some(b => b.id === id)) ? 'L' : '?');
  if (q.join('') !== 'TPT') return `queued ${q.join('')} for levels 2 to 4`;
  while (Game.pendingBoons()) {
    const offer = Game.pendingBoons();
    kinds.push(`${Game.pendingLevel()}:${Game.isPathOffer(offer) ? offer.join('/') : 'T'}`);
    if (!Game.chooseBoon(Game.isPathOffer(offer) ? 'healer' : offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return `could not choose from ${offer.join(', ')}`;
  }
  if (kinds.join(' ') !== '2:T 3:templar/healer 4:T') return `offers: ${kinds.join(' ')}`;
  return (p.path === 'healer' && p.talents.length === 2) || `path ${p.path}, talents ${p.talents}`;
});

await test('a path survives a save, and a save from before paths is offered one at its next level', async () => {
  const ctx = await start('fighter', 'path-save');
  const { Game, PATH_LEVEL } = ctx;
  levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL);
  Game.chooseBoon('knight');
  if (!Game.save(true)) return 'save failed';
  const raw = JSON.parse(ctx.store.get('deepdelve.save'));
  Game.newGame({ name: 'Other', cls: 'mage', stats: Game.rollStats(), seed: 'elsewhere', opts: OPTS });
  if (!Game.load()) return 'load failed';
  if (Game.player().path !== 'knight') return `loaded as ${Game.player().path}`;
  // the same hero from before paths, already past the level that offers one
  delete raw.player.path;
  raw.player.level = 7; raw.player.xp = ctx.XP_TABLE[6]; raw.pendingBoons = []; delete raw.pendingLevels;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'the older save would not load';
  const p = Game.player();
  if (p.path) return `an older save came back walking ${p.path}`;
  if (Game.pendingBoons()) return `an older save came back offered ${Game.pendingBoons().join(', ')}`;
  levelByKill(ctx, 7, 8);
  const first = Game.pendingBoons();
  if (!first || !Game.isPathOffer(first)) return `at level 8 it was first offered ${first && first.join(', ')}`;
  Game.chooseBoon('berserker');
  const next = Game.pendingBoons();
  if (!next || !next.every(id => ctx.TALENTS.fighter.some(t => t.id === id))) return `level 8's own offer was ${next && next.join(', ')}`;
  if (p.path !== 'berserker') return `chose berserker, walks ${p.path}`;
  // one already at the top level has no next level: it is offered on loading
  delete raw.player.path;
  raw.player.level = ctx.MAX_LEVEL; raw.player.xp = ctx.XP_TABLE[ctx.MAX_LEVEL - 1]; raw.pendingBoons = []; delete raw.pendingLevels;
  ctx.store.set('deepdelve.save', JSON.stringify(raw));
  if (!Game.load()) return 'the top-level save would not load';
  return Game.isPathOffer(Game.pendingBoons() || []) || `a top-level hero came back offered ${Game.pendingBoons()}`;
});

await test('at level 7 a hero on a path is offered its two capstones, in place of the lesson, and only once', async () => {
  const out = [];
  const ctx = await start('fighter', 'capstone-offer');
  const { Game, PATHS, CAPSTONE_LEVEL, BOONS } = ctx;
  const p = Game.player(), G = Game.state();
  walk(ctx, 'knight');
  levelByKill(ctx, CAPSTONE_LEVEL - 1, CAPSTONE_LEVEL);
  const offer = Game.pendingBoons();
  const want = PATHS.fighter[0].capstones.map(c => c.id);
  if (!offer || offer.join() !== want.join() || !Game.isCapstoneOffer(offer)) return `a knight at level 7 was offered ${offer && offer.join(', ')}`;
  if (Game.isPathOffer(offer)) out.push('the capstones were taken for a path offer');
  if (Game.pendingLevel() !== CAPSTONE_LEVEL) out.push(`the offer says level ${Game.pendingLevel()}`);
  if (Game.chooseBoon('undying')) out.push('a knight took the berserker\'s capstone');
  const mark = markLog(G);
  if (!Game.chooseBoon('rally')) return 'could not take Rallying Bash';
  if (p.capstone !== 'rally' || !Game.capstoneOf() || Game.capstoneOf().id !== 'rally') out.push(`chose rally, holds ${p.capstone}`);
  if (Game.pendingBoons()) out.push(`offered ${Game.pendingBoons().join(', ')} as well`);
  if (!linesSince(G, mark).some(l => l.includes('Rallying Bash'))) out.push('the log never named the capstone');
  levelByKill(ctx, CAPSTONE_LEVEL + 1, CAPSTONE_LEVEL + 2);
  const next = Game.pendingBoons();
  if (!next || !next.every(id => BOONS.some(b => b.id === id))) out.push(`at level 11 it was offered ${next && next.join(', ')}`);
  // one who reaches level 7 with the path still to choose has the capstones after it, and the lesson
  const late = await start('mage', 'capstone-late');
  levelByKill(late, CAPSTONE_LEVEL - 1, CAPSTONE_LEVEL);
  const kinds = [];
  while (late.Game.pendingBoons()) {
    const o = late.Game.pendingBoons();
    kinds.push(late.Game.isPathOffer(o) ? 'P' : late.Game.isCapstoneOffer(o) ? 'C' : 'L');
    if (!late.Game.chooseBoon(late.Game.isPathOffer(o) ? 'pyromancer' : o[0], o[0] === 'spread' ? spreadPicks(late.Game) : undefined)) { out.push(`could not choose from ${o.join(', ')}`); break; }
  }
  if (kinds.join('') !== 'PLC') out.push(`a mage without a path at level 7 was offered ${kinds.join('')}`);
  if (late.Game.player().capstone !== 'inferno') out.push(`the late mage mastered ${late.Game.player().capstone}`);
  // a save from before capstones, already at the top level, is offered them on loading
  late.Game.save(true);
  const raw = JSON.parse(late.store.get('deepdelve.save'));
  delete raw.player.capstone;
  raw.player.level = late.MAX_LEVEL; raw.player.xp = late.XP_TABLE[late.MAX_LEVEL - 1]; raw.pendingBoons = []; delete raw.pendingLevels;
  late.store.set('deepdelve.save', JSON.stringify(raw));
  if (!late.Game.load()) out.push('the top-level save would not load');
  else if (!late.Game.isCapstoneOffer(late.Game.pendingBoons() || [])) out.push(`a top-level hero came back offered ${late.Game.pendingBoons()}`);
  // and no hero without a path is offered one
  const none = await start('thief', 'capstone-none');
  none.Game.player().path = undefined;
  none.Game.state().pendingBoons = [];
  if (none.Game.state().pendingBoons.some(none.Game.isCapstoneOffer)) out.push('a thief with no path was offered capstones');
  return out.length ? out.join('; ') : true;
});

await test('capstones: the shaped ones stand, and the rest change no number of the path (each is one rule, checked in rules-capstones.js)', async () => {
  const out = [];
  const hero = async (cls, path, cap) => { const ctx = await start(cls, 'cap-' + (cap || path)); walk(ctx, path); ctx.Game.player().capstone = cap; return ctx; };
  // a Crusader's Smite and a Healer's Wellspring cost what the path's own do
  for (const [path, cap, sid] of [['templar', 'crusade', 'smite'], ['healer', 'wellspring', 'cure_light']]) {
    const a = await hero('cleric', path, undefined), b = await hero('cleric', path, cap);
    const sp = a.SPELLS.cleric.find(s => s.id === sid);
    if (b.Game.spellCost(sp) !== a.Game.spellCost(sp)) out.push(`${cap}: ${sid} costs ${a.Game.spellCost(sp)} -> ${b.Game.spellCost(sp)}`);
  }
  // Swift Draw quickens no bow of itself
  {
    const a = await hero('ranger', 'sharpshooter', undefined), b = await hero('ranger', 'sharpshooter', 'swift_draw');
    for (const c of [a, b]) { const p = c.Game.player(); p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.eq.offhand = null; }
    if (b.Game.blowRate(b.Game.player().eq.weapon) !== a.Game.blowRate(a.Game.player().eq.weapon)) out.push('swift_draw quickened the bow of itself');
  }
  // Bloodlust: at half life the rage is +4, not +3
  {
    const a = await hero('fighter', 'berserker', undefined), b = await hero('fighter', 'berserker', 'bloodlust');
    for (const c of [a, b]) { const p = c.Game.player(); p.maxHp = 100; p.hp = 50; }
    if (a.Game.berserkerRage() !== 3 || b.Game.berserkerRage() !== 4) out.push(`bloodlust: rage at half life ${a.Game.berserkerRage()} -> ${b.Game.berserkerRage()}`);
    for (const c of [a, b]) c.Game.player().hp = 1;
    if (a.Game.berserkerRage() !== 4 || b.Game.berserkerRage() !== 6) out.push(`bloodlust: rage near death ${a.Game.berserkerRage()} -> ${b.Game.berserkerRage()}`);
  }
  // Death Mark is a number still (the strike's multiple); Shadow's Edge and Wild Bulwark are not
  {
    const a = await hero('thief', 'assassin', undefined), b = await hero('thief', 'assassin', 'shadows_edge'), c = await hero('thief', 'assassin', 'death_mark');
    if (b.Game.critFloor() !== a.Game.critFloor()) out.push(`shadows_edge: crits from ${a.Game.critFloor()} -> ${b.Game.critFloor()}`);
    if (c.Game.sneakMult() !== a.Game.sneakMult() + 1) out.push(`death_mark: strike ${a.Game.sneakMult()} -> ${c.Game.sneakMult()}`);
    const w = await hero('ranger', 'warden', undefined), v = await hero('ranger', 'warden', 'wild_bulwark');
    if (v.Game.playerAC() !== w.Game.playerAC()) out.push(`wild_bulwark: armour class ${w.Game.playerAC()} -> ${v.Game.playerAC()}`);
  }
  // Rallying Bash comes back in half the time and mends; Quick Smoke comes back in the path's 16 seconds
  {
    const left = async (cls, path, cap) => {
      const ctx = await hero(cls, path, cap);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.maxHp = 999; p.hp = 500;
      const m = beside(ctx, 'goblin', { nextAct: G.t });
      for (let i = 0; i < 40 && cls === 'fighter' && !m.windup; i++) Game.update(G.t + 25, 25);
      const hp0 = p.hp;
      if (!Game.useAbility()) return { err: `${cls} could not use the ability` };
      return { left: Game.abilityLeft(), mended: p.hp - hp0 };
    };
    const a = await left('fighter', 'knight', undefined), b = await left('fighter', 'knight', 'rally');
    if (a.err || b.err) out.push(a.err || b.err);
    else {
      if (Math.abs(b.left * 2 - a.left) > 1) out.push(`rally: bash back in ${a.left}s -> ${b.left}s`);
      if (!(b.mended >= 1) || a.mended > 0) out.push(`rally: a bash mended ${a.mended} -> ${b.mended}`);
    }
    const s = await left('thief', 'trickster', undefined), q = await left('thief', 'trickster', 'quick_smoke');
    if (s.err || q.err) out.push(s.err || q.err);
    else if (s.left !== 16 || q.left !== 16) out.push(`quick_smoke: smoke back in ${s.left}s -> ${q.left}s`);
  }
  return out.length ? out.join('; ') : true;
});

await test('Undying and Miracle turn one killing blow on each floor, and only one', async () => {
  const out = [];
  /** Let an ogre beat on the hero until it turns a killing blow, or the hero dies. */
  const standing = ctx => {
    const { Game } = ctx; const G = Game.state();
    for (let i = 0; i < 800 && !Game.level().stoodFast && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  };
  const beaten = (ctx, cap, path) => {
    const { Game } = ctx; const p = Game.player();
    walk(ctx, path); p.capstone = cap; p.maxHp = 40; p.hp = 1;
    p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    beside(ctx, 'ogre');
    standing(ctx);
  };
  for (const [cls, path, cap] of [['fighter', 'berserker', 'undying'], ['cleric', 'healer', 'miracle']]) {
    const ctx = await start(cls, 'stand-' + cap);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    beaten(ctx, cap, path);
    if (G.status !== 'playing' || !Game.level().stoodFast || !(cap === 'undying' ? p.hp === 1 : p.hp >= 15)) { out.push(`${cap}: after the first killing blow, ${G.status} on ${p.hp}`); continue; }
    for (let i = 0; i < 2000 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
    if (G.status === 'playing') out.push(`${cap}: turned a second killing blow on the same floor`);
    // without the capstone the first blow kills
    const plain = await start(cls, 'stand-' + cap);
    beaten(plain, undefined, path);
    if (plain.Game.state().status === 'playing') out.push(`${path} without ${cap} lived through the blow`);
  }
  // a new floor brings it back
  const ctx = await start('fighter', 'stand-floor');
  const { Game } = ctx; const p = Game.player();
  Game.level().stoodFast = true;
  Game.level().monsters.length = 0; Game.descend();
  if (Game.level().stoodFast) out.push('the new floor came already spent');
  beaten(ctx, 'undying', 'berserker');
  if (Game.state().status !== 'playing' || p.hp !== 1) out.push(`on the next floor Undying left ${Game.state().status} on ${p.hp}`);
  return out.length ? out.join('; ') : true;
});

await test('Knight: a shield gives a point more, catches one ordinary blow in eight for half, and a trick lands a quarter lighter', async () => {
  const out = [];
  {
    const ctx = await start('fighter', 'knight-ac');
    const { Game } = ctx; const p = Game.player();
    walk(ctx, undefined); p.eq.shield = { t: 'shield', q: 1, e: 0 };
    const a = Game.playerAC(); walk(ctx, 'knight');
    if (Game.playerAC() !== a + 1) out.push(`a knight's shield: ${a} -> ${Game.playerAC()}`);
    p.eq.shield = null; const b = Game.playerAC(); walk(ctx, undefined);
    if (Game.playerAC() !== b) out.push('a knight without a shield changed armour class');
  }
  // the guard, over many ordinary blows from a goblin
  const guard = async (path, shield) => {
    const ctx = await start('fighter', 'knight-guard');
    seedDice(ctx, 'knight-guard');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3;
    p.eq.shield = shield ? { t: 'shield', q: 1, e: 0 } : null;
    beside(ctx, 'goblin');
    const [hit, caught] = tallyLines(Game, G, 240000, [/Goblin hits you/, /caught on your shield/]);
    return { hit, caught };
  };
  const k = await guard('knight', true), bare = await guard('knight', false), plain = await guard(undefined, true);
  if (!(k.hit > 100)) out.push(`only ${k.hit} blows landed`);
  const share = k.caught / k.hit;
  if (!(share > 0.06 && share < 0.2)) out.push(`the shield caught ${k.caught} of ${k.hit} blows`);
  if (bare.caught || plain.caught) out.push(`caught with no shield ${bare.caught}, with no path ${plain.caught}`);
  // a crush on set feet: the same dice, a quarter less
  const crush = async path => {
    const ctx = await start('fighter', 'knight-crush');
    seedDice(ctx, 'knight-crush');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 9999;
    let total = 0;
    for (let i = 0; i < 8; i++) {
      const m = beside(ctx, 'ogre', { blows: 2 });
      const mark = markLog(G);
      run(Game, G, 1000);
      m.nextAct = 1e12;
      const l = linesSince(G, mark).find(x => /brings its club down on you/.test(x));
      if (l) total += Number(l.match(/for (\d+)/)[1]);
    }
    return total;
  };
  const plainCrush = await crush(undefined), knightCrush = await crush('knight');
  if (!(plainCrush > 40)) out.push(`the crushes did only ${plainCrush}`);
  const r = knightCrush / plainCrush;
  if (!(r > 0.7 && r < 0.82)) out.push(`a knight took ${knightCrush} from crushes that did ${plainCrush}`);
  return out.length ? out.join('; ') : true;
});

await test('Berserker: blows grow with the wounds, the swing quickens below half, and the guard drops', async () => {
  const out = [];
  const total = async (path, hpFrac) => {
    const ctx = await start('fighter', 'rage');
    seedDice(ctx, 'rage');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60; p.maxHp = 100; p.hp = Math.round(100 * hpFrac);
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const plainLow = await total(undefined, 0.1), rageLow = await total('berserker', 0.1);
  const plainFull = await total(undefined, 1), rageFull = await total('berserker', 1);
  const plainHalf = await total(undefined, 0.5), rageHalf = await total('berserker', 0.5);
  // the same dice: nine tenths lost is +4 (the most) on each of forty-odd blows that landed
  if (!(rageLow - plainLow >= 4 * 40)) out.push(`at a tenth of life, +${rageLow - plainLow} over 50 swings`);
  if (rageFull !== plainFull) out.push(`unhurt, a berserker dealt ${rageFull} to ${plainFull}`);
  if (!(rageHalf - plainHalf >= 3 * 40 && rageHalf - plainHalf < 4 * 50)) out.push(`at half life, +${rageHalf - plainHalf}`);
  const ctx = await start('fighter', 'rage-speed');
  const { Game } = ctx; const p = Game.player();
  walk(ctx, undefined); p.maxHp = 100; p.hp = 100;
  const ac = Game.playerAC(), full = Game.weapon().speed;
  walk(ctx, 'berserker');
  if (Game.weapon().speed !== full) out.push('an unhurt berserker swung faster');
  if (Game.playerAC() !== ac - 2) out.push(`a berserker's armour class ${ac} -> ${Game.playerAC()}`);
  p.hp = 40;
  const quick = Game.weapon().speed / full;
  if (!(quick > 0.88 && quick < 0.92)) out.push(`below half the swing is ${quick.toFixed(2)} of what it was`);
  return out.length ? out.join('; ') : true;
});

await test('Templar: blows bite the undead, Bless lasts twice as long, and Holy Smite hits a tenth harder', async () => {
  const out = [];
  const swings = async (path, id) => {
    const ctx = await start('cleric', 'templar-' + id);
    seedDice(ctx, 'templar-' + id);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60;
    const m = beside(ctx, id, { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const undead = (await swings('templar', 'zombie')) - (await swings(undefined, 'zombie'));
  if (!(undead > 60)) out.push(`against a zombie, +${undead} over 50 swings`);
  const living = (await swings('templar', 'orc')) - (await swings(undefined, 'orc'));
  if (living !== 0) out.push(`against an orc, ${living} more`);
  const cast = async (path, spell, times) => {
    const ctx = await start('cleric', 'templar-cast');
    seedDice(ctx, 'templar-cast');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.level = 5; p.sp = p.maxSp = 999;
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === spell);
    const before = Game.toHit();
    for (let i = 0; i < times; i++) { G.t = p.nextAttack; delete p.effects.hit; Game.castSpell(sp); }
    return { dealt: 1e9 - m.hp, bless: p.effects.hit && p.effects.hit.until - G.t, toHit: Game.toHit() - before };
  };
  const plain = await cast(undefined, 'smite', 30), templar = await cast('templar', 'smite', 30);
  const r = templar.dealt / plain.dealt;
  if (!(r > 1.05 && r < 1.15)) out.push(`smite: ${plain.dealt} -> ${templar.dealt}`);
  const b0 = await cast(undefined, 'bless', 1), b1 = await cast('templar', 'bless', 1);
  if (b0.bless !== 60000 || b1.bless !== 120000 || b0.toHit !== 2 || b1.toHit !== 2) out.push(`bless: +${b0.toHit} for ${b0.bless}ms -> +${b1.toHit} for ${b1.bless}ms`);
  return out.length ? out.join('; ') : true;
});

await test('Healer: heals a quarter more, mends under Protection, and has more spell points', async () => {
  const out = [];
  // a quarter more on average, small heals included: rounded, a heal of 4 stayed 4
  const heal = async path => {
    const ctx = await start('cleric', 'healer-cure');
    seedDice(ctx, 'healer-cure');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.maxHp = 99999;
    let total = 0;
    for (let i = 0; i < 300; i++) { p.hp = 1; p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'cure_light')); total += p.hp - 1; }
    return total;
  };
  const a = await heal(undefined), b = await heal('healer');
  if (!(b / a > 1.2 && b / a < 1.3)) out.push(`cure light over 300 casts: ${a} -> ${b}`);
  const mend = async (path, warding) => {
    const ctx = await start('cleric', 'healer-mend');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (warding) talent(ctx, 'warding_light');
    Game.level().monsters.length = 0;
    p.level = 5; p.sp = p.maxSp = 99; p.maxHp = 100; p.hp = 60; p.food = 0;   // no ordinary mending
    G.t = p.nextAttack;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'protection'));
    run(Game, G, 20000);
    return p.hp - 60;
  };
  const none = await mend(undefined), healer = await mend('healer'), ward = await mend(undefined, true), both = await mend('healer', true);
  if (none !== 0) out.push(`with no path, Protection mended ${none}`);
  if (!(healer >= 4 && healer <= 5)) out.push(`a healer mended ${healer} in twenty seconds`);
  if (both !== ward + healer) out.push(`with Warding Light too, ${both} (${ward} + ${healer} apart)`);
  const ctx = await start('cleric', 'healer-sp');
  const { Game, PATH_LEVEL } = ctx; const p = Game.player();
  levelByKill(ctx, PATH_LEVEL - 1, PATH_LEVEL);
  const was = p.maxSp;
  Game.chooseBoon('healer');
  // a point for every three levels: one at level 3
  if (p.maxSp !== was + 1 || p.sp !== p.maxSp) out.push(`at level 3 the well went ${was} -> ${p.maxSp}, holding ${p.sp}`);
  return out.length ? out.join('; ') : true;
});

await test('Pyromancer: fire hits a fifth harder and keeps burning, and the cold costs more', async () => {
  const out = [];
  const hands = async (path, kindling) => {
    const ctx = await start('mage', 'pyro-hands');
    seedDice(ctx, 'pyro-hands');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (kindling) talent(ctx, 'kindling');
    p.level = 5; p.sp = p.maxSp = 999;
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === 'burning_hands');
    const sp0 = p.sp;
    let burn = 0;
    for (let i = 0; i < 30; i++) { G.t = p.nextAttack; Game.castSpell(sp); if (i === 0) burn = m.dot && m.dot.kind === 'burning' ? m.dot.until - G.t : 0; }
    return { dealt: 1e9 - m.hp, burn, cost: (sp0 - p.sp) / 30 };
  };
  const plain = await hands(undefined), pyro = await hands('pyromancer'), both = await hands('pyromancer', true);
  const r = pyro.dealt / plain.dealt;
  if (!(r > 1.15 && r < 1.25)) out.push(`burning hands: ${plain.dealt} -> ${pyro.dealt}`);
  if (plain.burn || pyro.burn !== 3000 || both.burn !== 6000) out.push(`burns lasted ${plain.burn}, ${pyro.burn}, with Kindling ${both.burn}`);
  if (plain.cost !== 3 || pyro.cost !== 4) out.push(`burning hands cost ${plain.cost}, then ${pyro.cost} (a Pyromancer's reaches three squares, for a point more)`);
  const scroll = async path => {
    const ctx = await start('mage', 'pyro-scroll');
    seedDice(ctx, 'pyro-scroll');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); G.known.scroll_fire = 1;
    const m = ahead(ctx, 'goblin', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    for (let i = 0; i < 20; i++) { const it = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(it); G.t = p.nextAttack + 2000; Game.useItem(it); }
    return 1e9 - m.hp;
  };
  const s0 = await scroll(undefined), s1 = await scroll('pyromancer');
  if (!(s1 / s0 > 1.15 && s1 / s0 < 1.25)) out.push(`the fire scroll: ${s0} -> ${s1}`);
  const ctx = await start('mage', 'pyro-cost');
  const { Game } = ctx; walk(ctx, 'pyromancer');
  const cost = id => Game.spellCost(Game.knownSpells().find(s => s.id === id));
  if (cost('lightning') !== 6 || cost('cone_cold') !== 12 || cost('magic_missile') !== 2) out.push(`a pyromancer pays ${cost('lightning')} for lightning, ${cost('cone_cold')} for cold`);
  return out.length ? out.join('; ') : true;
});

await test('Frostweaver: cold and lightning hold their mark back, Shield is stronger and longer, Lightning and Cone of Cold are cheaper', async () => {
  const out = [];
  const bolt = async (path, rime) => {
    const ctx = await start('mage', 'frost-hold');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); if (rime) talent(ctx, 'rime');
    p.level = 5; p.sp = p.maxSp = 99;
    G.t = p.nextAttack;
    const m = ahead(ctx, 'orc', 3, { hp: 1e9, maxHp: 1e9, nextAct: G.t + 1000 });
    const sp0 = p.sp;
    Game.castSpell(Game.knownSpells().find(s => s.id === 'lightning'));
    return { held: m.nextAct - (G.t + 1000), cost: sp0 - p.sp };
  };
  const plain = await bolt(undefined), frost = await bolt('frostweaver'), both = await bolt('frostweaver', true);
  if (plain.held !== 0 || frost.held !== 700 || both.held !== 1400) out.push(`held back ${plain.held}, ${frost.held}, with Rime ${both.held}`);
  if (plain.cost !== 5 || frost.cost !== 4) out.push(`lightning cost ${plain.cost}, then ${frost.cost}`);
  const shield = async path => {
    const ctx = await start('mage', 'frost-shield');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.sp = 99; G.t = p.nextAttack;
    const ac = Game.playerAC();
    Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'));
    return { ac: Game.playerAC() - ac, lasts: p.effects.ac.until - G.t };
  };
  const s0 = await shield(undefined), s1 = await shield('frostweaver');
  if (s0.ac !== 4 || s1.ac !== 5 || s0.lasts !== 60000 || s1.lasts !== 90000) out.push(`shield: +${s0.ac} for ${s0.lasts}ms -> +${s1.ac} for ${s1.lasts}ms`);
  // and the cone comes two points cheaper
  const ctx = await start('mage', 'frost-cost');
  const { Game } = ctx; walk(ctx, 'frostweaver');
  const cone = Game.spellCost(Game.knownSpells().find(s => s.id === 'cone_cold'));
  if (cone !== 8) out.push(`a Frostweaver pays ${cone} for Cone of Cold`);
  return out.length ? out.join('; ') : true;
});

await test('Assassin: the blow from the shadows hits triple, crits come sooner, and sleepers notice later', async () => {
  const out = [];
  const sneak = async path => {
    const ctx = await start('thief', 'assassin-sneak');
    seedDice(ctx, 'assassin-sneak');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.perkHit = 60; p.stats.dex = 16;
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true, awake: false });
    for (let i = 0; i < 40; i++) { m.awake = false; G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const a = await sneak(undefined), b = await sneak('assassin');
  if (!(b / a >= 1.45 && b / a < 1.8)) out.push(`strikes from the shadows: ${a} -> ${b}`);
  {
    const ctx = await start('thief', 'assassin-crit');
    const c = ctx.Game.critFloor(); walk(ctx, 'assassin');
    if (ctx.Game.critFloor() !== c - 1) out.push(`crit floor ${c} -> ${ctx.Game.critFloor()}`);
  }
  const wakes = async path => {
    const ctx = await start('thief', 'assassin-quiet');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.bg = 'oathbroken';
    const m = ahead(ctx, 'goblin', 4, { awake: false });
    await pinned(0.9, () => run(Game, G, 1500));
    return m.awake;
  };
  const w0 = await wakes(undefined), w1 = await wakes('assassin');
  if (!w0 || w1) out.push(`a sleeper four squares off woke for a thief: ${w0}, for an assassin: ${w1}`);
  return out.length ? out.join('; ') : true;
});

await test('Trickster: slips an ordinary blow now and then, a blow on the air leaves an opening, and traps and gold favour them', async () => {
  const out = [];
  const slips = async path => {
    const ctx = await start('thief', 'trick-slip');
    seedDice(ctx, 'trick-slip');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 1e6; p.eq.armor = null; p.stats.dex = 3; p.level = 1;
    beside(ctx, 'goblin');
    const [hit, slip] = tallyLines(Game, G, 240000, [/Goblin hits you/, /slip aside/]);
    return { hit, slip };
  };
  const t = await slips('trickster'), plain = await slips(undefined);
  const share = t.slip / (t.slip + t.hit);
  if (!(t.hit > 100 && share > 0.06 && share < 0.2)) out.push(`slipped ${t.slip} of ${t.slip + t.hit}`);
  if (plain.slip) out.push(`a thief with no path slipped ${plain.slip}`);
  const open = async path => {
    const ctx = await start('thief', 'trick-open');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    walk(ctx, path); p.hp = p.maxHp = 999;
    const m = beside(ctx, 'goblin');
    Game.update(G.t + 25, 25);
    if (!m.windup) return 'no wind-up';
    shift(ctx, 'back');
    for (let i = 0; i < 60 && !p.opening; i++) Game.update(G.t + 25, 25);
    return !!(p.opening && p.opening.uid === m.uid);
  };
  const o1 = await open('trickster'), o0 = await open(undefined);
  if (o1 !== true || o0 !== false) out.push(`a blow on the air left an opening for a trickster: ${o1}, for a thief: ${o0}`);
  // walk onto a dart trap over and over: a trickster sees or dodges more of them
  const traps = async path => {
    const ctx = await start('thief', 'trick-traps', { traps: true });
    seedDice(ctx, 'trick-traps');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    walk(ctx, path); p.stats.wis = 3; p.stats.dex = 8; p.bg = 'oathbroken';
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir], x0 = p.x, y0 = p.y, x = p.x + dx, y = p.y + dy;
    L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
    let safe = 0;
    for (let i = 0; i < 120; i++) {
      p.x = x0; p.y = y0; p.hp = p.maxHp = 999; p.poison = null;
      Game.update(G.t + 600, 600);
      L.traps[`${x},${y}`] = 'dart';
      Game.input('forward');
      if (p.hp === 999) safe++;
    }
    return safe;
  };
  const tr1 = await traps('trickster'), tr0 = await traps(undefined);
  if (!(tr1 >= tr0 + 12)) out.push(`darts escaped: trickster ${tr1}, thief ${tr0} of 120`);
  const purse = async path => {
    const ctx = await start('thief', 'trick-gold');
    const { Game } = ctx; const p = Game.player(), L = Game.level();
    walk(ctx, path);
    const it = { t: 'gold', q: 100 };
    L.items[`${p.x},${p.y}`] = [it];
    const g = p.gold;
    Game.takeItem(it);
    return p.gold - g;
  };
  const g0 = await purse(undefined), g1 = await purse('trickster');
  if (g0 !== 100 || g1 !== 125) out.push(`a pile of 100 gave ${g0}, and a trickster ${g1}`);
  return out.length ? out.join('; ') : true;
});
};
