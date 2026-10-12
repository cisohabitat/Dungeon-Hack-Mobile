// Rule checks for the classes and their scores (hit points by class and difficulty, casting time and
// pools, the thief noticed late, the d20 check, charisma at the counter, intelligence over a draught)
// and for the encounters' engine: a safe way out of each, resolved once, dealt once a run.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function classesChecks(h) {
  const { OPTS, evenStats, newContext, start, rollsOn, test } = h;

await test('every class starts with at least ten hit points', async () => {
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    for (let i = 0; i < 60; i++) {
      const ctx = await newContext();
      ctx.Game.newGame({ name: 'H', cls, bg: 'oathbroken', stats: ctx.Game.rollStats(), seed: 'hp' + i, opts: OPTS });
      const hp = ctx.Game.player().maxHp;
      if (hp < 10) return `a ${cls} started on ${hp} hit points`;
    }
  }
  return true;
});

await test('off Hard a fighter starts three hit points sturdier and a ranger four; on Hard a fighter two, a cleric two and a ranger four; no other class moves', async () => {
  const out = [];
  for (const cls of ['fighter', 'cleric', 'mage', 'thief', 'ranger', 'druid']) {
    const hp = {};
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const ctx = await newContext();
      ctx.Game.newGame({ name: 'H', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'mild-hp', opts: { ...OPTS, difficulty } });
      hp[difficulty] = ctx.Game.player().maxHp;
    }
    // the difference off Hard, with what a class has of its own on Hard counted against it
    // (the fighter two, the cleric two, the ranger four: the ranger's four each side cancel)
    const want = { fighter: 3 - 2, cleric: -2, ranger: 4 - 4 }[cls] || 0;
    if (hp.normal - hp.hard !== want || hp.easy - hp.hard !== want) out.push(`a ${cls} starts on ${hp.easy} / ${hp.normal} / ${hp.hard} (Easy, Normal, Hard)`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a crowded dungeon starts crowding from the second floor', async () => {
  for (let i = 0; i < 12; i++) {
    const seed = 'dense' + i;
    const at = (monsters, depth) => {
      const L = (/** @type {any} */ (globalThis).__D).generate(seed, depth, { ...OPTS, levels: 8, size: 'medium', monsters });
      return L.monsters.length;
    };
    const ctx = await newContext();
    /** @type {any} */ (globalThis).__D = ctx.Dungeon;
    if (at('many', 1) !== at('normal', 1)) return `${seed}: floor one on Many held ${at('many', 1)}, on Normal ${at('normal', 1)}`;
    if (!(at('many', 2) > at('normal', 2))) return `${seed}: floor two on Many was no busier than Normal`;
  }
  return true;
});

await test('class names are pluralised as words, not by adding an s', async () => {
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'P', cls: 'thief', bg: 'oathbroken', stats: { ...evenStats }, seed: 'plural', opts: OPTS });
  const p = Game.player();
  p.inv.push({ t: 'plate', q: 1, e: 0 });
  const why = Game.canEquip(p.inv[p.inv.length - 1]) || '';
  if (/Thiefs/.test(why)) return `the refusal read "${why}"`;
  return /Thieves/.test(why) || `expected "Thieves" in "${why}"`;
});

await test('casting takes time, and a mage casts faster than a cleric', async () => {
  // Casting used to cost nothing: a cleric could bless, ward, heal and strike
  // in one instant, and a mage could empty their points as fast as Cast could
  // be tapped.
  const timeToRecover = async (cls, spellId) => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx;
    Game.newGame({ name: 'C', cls, bg: 'oathbroken', stats: { ...evenStats, int: 16, wis: 16 }, seed: 'cast-' + cls, opts: OPTS });
    const p = Game.player(), G = Game.state(), L = Game.level();
    L.monsters.length = 0;
    p.level = 3;                          // Shield is a second-circle spell
    p.sp = p.maxSp = 99;
    const sp = Game.knownSpells().find(s => s.id === spellId);
    if (!sp) return `a ${cls} does not know ${spellId}`;
    if (!Game.castSpell(sp)) return `${spellId} would not cast at all`;
    // lift the buff each time, so the waste guard (which rightly refuses to
    // recast a ward already up) cannot be what is stopping the second cast
    const lift = () => { p.effects = {}; };
    lift();
    const before = p.sp;
    if (Game.castSpell(sp)) return `${spellId} cast twice in the same instant`;
    if (p.sp !== before) return 'a refused cast still spent points';
    let waited = 0;
    for (;;) { lift(); if (Game.castSpell(sp)) break; G.t += 25; waited += 25; if (waited > 3000) return `never recovered from ${spellId}`; }
    return waited;
  };
  const mage = await timeToRecover('mage', 'shield');
  const cleric = await timeToRecover('cleric', 'bless');
  if (typeof mage === 'string') return mage;
  if (typeof cleric === 'string') return cleric;
  if (mage < 300) return `a mage recovered in ${mage}ms, which is no cost at all`;
  if (!(cleric > mage)) return `a cleric (${cleric}ms) recovered no slower than a mage (${mage}ms)`;
  // and a cast holds up the next swing too
  const ctx = await newContext();
  const { Game } = ctx;
  Game.newGame({ name: 'C', cls: 'cleric', bg: 'oathbroken', stats: { ...evenStats }, seed: 'cast-swing', opts: OPTS });
  const p = Game.player(), G = Game.state();
  p.sp = p.maxSp = 99;
  Game.castSpell(Game.knownSpells().find(s => s.id === 'bless'));
  return p.nextAttack > G.t || 'casting left the sword arm free to swing at once';
});

await test('the unarmoured mage carries a deeper pool than the armoured cleric', async () => {
  // same level, same score in the casting stat: only the class differs
  const pool = async (cls, stat) => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'P', cls, bg: 'oathbroken', stats: { ...evenStats, [stat]: 14 }, seed: 'pool', opts: OPTS });
    return ctx.Game.player().maxSp;
  };
  const mage = await pool('mage', 'int'), cleric = await pool('cleric', 'wis');
  return mage > cleric || `a level-one mage holds ${mage} points against a cleric's ${cleric}`;
});

await test('a thief is noticed later than a fighter', async () => {
  // At the old six-square notice nothing stayed asleep long enough for a
  // thief to reach it, so the class's double blow on a sleeper rarely landed.
  const wakes = async cls => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx, T = Dungeon.T;
    Game.newGame({ name: 'N', cls, bg: 'oathbroken', stats: { ...evenStats }, seed: 'notice', opts: OPTS });
    const p = Game.player(), G = Game.state(), L = Game.level();
    // a straight run of floor so the distance is walked, not guessed
    outer: for (let y = 1; y < L.h - 1; y++) for (let x = 1; x < L.w - 1; x++) for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = Dungeon.DIRS[dir]; let ok = true;
      for (let k = 0; k <= 6; k++) if (L.tiles[(y + dy * k) * L.w + (x + dx * k)] !== T.FLOOR) { ok = false; break; }
      if (ok) { p.x = x; p.y = y; p.dir = dir; break outer; }
    }
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    const m = { uid: 3, id: 'goblin', x: p.x + dx * 5, y: p.y + dy * 5, hp: 9, maxHp: 9, awake: false, nextAct: 0,
      rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    L.monsters.push(m);
    for (let i = 0; i < 40; i++) { m.x = p.x + dx * 5; m.y = p.y + dy * 5; Game.update(G.t + 100, 100); if (m.awake) return true; }
    return false;
  };
  if (!(await wakes('fighter'))) return 'a goblin five squares off never noticed a fighter';
  return !(await wakes('thief')) || 'a goblin five squares off noticed a thief just as quickly';
});

await test('a stat check is a d20 plus the modifier, and it reports itself truthfully', async () => {
  const ctx = await newContext();
  const { Game, Rng } = ctx;
  Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, str: 16 }, seed: 'checks', opts: OPTS });
  rollsOn(Game);
  ctx.Dice.s = new Rng('checks').s;
  let passes = 0, nat1 = 0, nat20 = 0;
  for (let i = 0; i < 2000; i++) {
    const c = Game.statCheck('str', 14);
    if (c.mod !== 3) return `strength 16 should add 3, added ${c.mod}`;
    const expect = c.roll === 20 || (c.roll !== 1 && c.roll + 3 >= 14);
    if (c.pass !== expect) return `rolled ${c.roll}+3 against 14 and was told ${c.pass ? 'pass' : 'fail'}`;
    if (c.roll === 1) { nat1++; if (!/a fumble/.test(c.note)) return 'a natural one was not called a fumble'; }
    else if (c.roll === 20) { nat20++; if (!/a triumph/.test(c.note)) return 'a natural twenty was not called a triumph'; }
    else if (!c.note.includes(`Strength d20 ${c.roll}+3 vs 14`)) return `the note read "${c.note}"`;
    if (c.pass) passes++;
  }
  // the odds shown before committing must match what actually happens
  const shown = Game.checkChance('str', 14), seen = passes / 2000;
  if (Math.abs(shown - seen) > 0.04) return `the odds shown were ${shown}, the rate seen was ${seen.toFixed(3)}`;
  return nat1 > 0 && nat20 > 0 || 'two thousand rolls without a natural one or twenty';
});

await test('charisma sets the trader\'s prices, and charisma was used for nothing before', async () => {
  const price = async cha => {
    const ctx = await newContext();
    ctx.Game.newGame({ name: 'C', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, cha }, seed: 'charm', opts: OPTS });
    const shop = { markup: 2 }, it = { t: 'potion_heal', q: 1, e: 0 };
    return { buy: ctx.Game.buyPrice(shop, it), sell: ctx.Game.sellPrice(it) };
  };
  const plain = await price(10), charming = await price(16), boor = await price(6);
  if (!(charming.buy < plain.buy)) return `charisma 16 paid ${charming.buy}, charisma 10 paid ${plain.buy}`;
  if (!(boor.buy > plain.buy)) return `charisma 6 paid ${boor.buy}, charisma 10 paid ${plain.buy}`;
  if (!(charming.sell > plain.sell)) return `charisma 16 was paid ${charming.sell} for a sale, charisma 10 ${plain.sell}`;
  return true;
});

await test('intelligence can identify an unknown potion without drinking it', async () => {
  const ctx = await newContext();
  const { Game, Rng, ITEMS } = ctx;
  Game.newGame({ name: 'I', cls: 'mage', bg: 'oathbroken', stats: { ...evenStats, int: 18 }, seed: 'study', opts: OPTS });
  ctx.Dice.s = new Rng('study').s;
  const p = Game.player();
  const unknown = Object.keys(ITEMS).find(id => ITEMS[id].kind === 'potion' && !Game.isKnown(id));
  if (!unknown) return 'every potion was already known';
  const it = { t: unknown, q: 1, e: 0 };
  p.inv.push(it);
  const before = p.inv.length;
  let c = null;
  for (let tries = 0; tries < 30 && !Game.isKnown(unknown); tries++) {
    c = Game.study(it);
    if (c && !c.pass) {
      // a failure bars the same kind until the hero learns something more
      if (Game.studyReason(it) === null) return 'a failed study could be retried at once';
      p.level++;
    }
  }
  if (!Game.isKnown(unknown)) return 'thirty studies at intelligence 18 never identified it';
  if (p.inv.length !== before || !p.inv.includes(it)) return 'studying used the potion up';
  return Game.studyReason(it) !== null || 'a known potion could still be studied';
});

await test('every encounter offers a free, safe way out, and every effect is one the engine knows', async () => {
  // The encounter screen cannot be dismissed unanswered, which is only fair
  // if there is always a choice that costs and risks nothing.
  const { ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const { MONSTERS, ITEMS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'data.js')).href);
  const known = new Set(['map', 'xp', 'goldPerDepth', 'hurt', 'hurtFrac', 'heal', 'maxHp', 'food', 'loot', 'item', 'buff', 'poison', 'cure', 'uncurse', 'wake', 'identifyAll', 'ambush', 'stat', 'thread', 'companion', 'traps', 'goldBack', 'hone', 'ending']);
  const stats = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
  for (const [id, e] of Object.entries(ENCOUNTERS)) {
    const last = e.choices[e.choices.length - 1];
    // (the Heart's choice ends the run whichever is taken: walking away from it is its way out)
    if (!e.heart && (last.check || last.cost || !last.outcome || last.outcome.effects.length)) return `${id}: the last choice is not a free way out`;
    for (const ch of e.choices) {
      if (ch.check && !stats.has(ch.check.stat)) return `${id}: "${ch.label}" checks unknown stat ${ch.check.stat}`;
      if (!ch.check && !ch.outcome) return `${id}: "${ch.label}" has neither a check nor an outcome`;
      if (ch.check && !(ch.pass && ch.fail)) return `${id}: "${ch.label}" is missing a pass or a fail`;
      for (const o of [ch.outcome, ch.pass, ch.fail].filter(Boolean)) {
        if (!o.text) return `${id}: "${ch.label}" has an outcome with no words`;
        for (const eff of o.effects) for (const k of Object.keys(eff)) if (!known.has(k)) return `${id}: unknown effect "${k}"`;
        // and every name an effect gives is one the game has
        for (const eff of o.effects) {
          if (eff.ambush && !MONSTERS[eff.ambush.id]) return `${id}: ambush by unknown monster ${eff.ambush.id}`;
          if (eff.item && !ITEMS[eff.item.t]) return `${id}: gives unknown item ${eff.item.t}`;
          if (eff.stat && !stats.has(eff.stat[0])) return `${id}: raises unknown score ${eff.stat[0]}`;
          if (eff.buff && eff.buff.stats.some(([st]) => !['hit', 'ac'].includes(st))) return `${id}: blesses an unknown stat`;
        }
      }
    }
  }
  return true;
});

await test('an encounter resolves once: the check, the effects, the prop gone, never again', async () => {
  const ctx = await newContext();
  const { Game, Dungeon, Rng } = ctx;
  Game.newGame({ name: 'E', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats, str: 18 }, seed: 'tour', opts: { ...OPTS, levels: 8 } });
  ctx.Dice.s = new Rng('enc').s;
  const p = Game.player(), L = Game.level();
  p.gold = 5000;   // a choice that asks a stake can be paid
  const prop = L.npcs.find(n => n.kind === 'encounter');
  if (!prop) return 'floor one of this seed has no encounter';
  // stand beside it and walk in
  const T = Dungeon.T;
  const k = [0, 1, 2, 3].find(k => { const [dx, dy] = Dungeon.DIRS[k]; return L.tiles[(prop.y - dy) * L.w + (prop.x - dx)] === T.FLOOR; });
  const [dx, dy] = Dungeon.DIRS[k];
  p.x = prop.x - dx; p.y = prop.y - dy; p.dir = k;
  L.monsters.length = 0;
  delete L.items[p.x + ',' + p.y];          // (whatever lies underfoot would be taken first)
  if (Game.useLabel() !== 'Examine') return `facing the prop, Use says "${Game.useLabel()}"`;
  Game.input('forward');
  const e = Game.currentEncounter();
  if (!e || e.npc !== prop) return 'walking into the prop did not open its encounter';
  const opts = Game.encounterOptions();
  const checked = opts.find(o => o.stat);
  if (!checked || !(checked.chance > 0 && checked.chance <= 1)) return 'a checked choice showed no odds';
  const xp0 = p.xp;
  const r = Game.chooseEncounter(checked.i);
  if (!r || !r.check) return 'choosing a checked option returned no roll';
  if (!r.lines.length && r.check.pass) return 'a success changed nothing and said so';
  if (Game.chooseEncounter(checked.i)) return 'the same encounter resolved twice';
  if (L.npcs.includes(prop)) return 'the prop is still standing after being answered';
  if (!(Game.state().metEncounters || []).includes(prop.id)) return 'the encounter was not recorded as met';
  void xp0;
  Game.closeEncounter();
  return Game.currentEncounter() === null || 'the encounter would not close';
});

await test('the whole run meets each encounter at most once, deepest floor excepted', async () => {
  const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  for (const levels of [4, 8, 16]) for (let i = 0; i < 40; i++) {
    const plan = encounterPlan('plan' + i, levels);
    // the deepest floor holds only its vigil lamp, which is not dealt from the deck
    if (plan[levels].join() !== 'vigil') return `the deepest floor of a ${levels}-floor run holds ${plan[levels].join(', ') || 'nothing'}`;
    const all = plan.slice(0, levels).flat();
    if (new Set(all).size !== all.length) return `seed plan${i} over ${levels} floors repeats an encounter`;
    // about one a floor; a very long run can pass by the four that belong
    // only on the upper floors, once it is below them
    // (the starving hound is placed on the second floor besides, not dealt)
    // (nor the kept smith, placed on the floor before the last, not dealt)
    const dealt = all.filter(e => !ENCOUNTERS[e].early && !ENCOUNTERS[e].fixed);
    const want = Math.min(Object.keys(ENCOUNTERS).filter(k => !ENCOUNTERS[k].final && !ENCOUNTERS[k].route && !ENCOUNTERS[k].early).length, Math.round((levels - 1) * 1.15));
    if (dealt.length < want - (levels >= 12 ? 4 : 1) || dealt.length > want) return `a ${levels}-floor run met ${dealt.length} encounters, about ${want} expected`;
  }
  return true;
});

await test('an encounter never calls up a creature from floors far below: the sleeping ogre waits for the ogres, the voice sends a lesser dead thing', async () => {
  const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  // the ogre walks from tier 8: on eight floors that is the sixth, on twelve the eighth
  for (const levels of [8, 12]) for (let i = 0; i < 300; i++) {
    const plan = encounterPlan('ogre' + i, levels, Dungeon.tierAt);
    const d = plan.findIndex(f => f && f.includes('sleeper'));
    if (d > 0 && Dungeon.tierAt(d, levels) < 7.5) return `a ${levels}-floor delve met the sleeping ogre on floor ${d}`;
  }
  // a failed word with the mirror: a skeleton on the third floor, a ghoul on the fourth, a wraith from the fifth
  const want = { 3: 'skeleton', 4: 'ghoul', 6: 'wraith' };
  for (const depth of [3, 4, 6]) {
    let got = null;
    for (let t = 0; t < 30 && !got; t++) {
      const ctx = await start('fighter', `mirror-deep-${depth}-${t}`, { levels: 8 });
      const { Game, Dungeon: D } = ctx;
      while (Game.state().depth < depth) { Game.level().monsters.length = 0; Game.descend(); }
      const q = Game.player(), M = Game.level();
      q.stats.cha = 3; M.npcs.length = 0; M.monsters.length = 0;
      const [dx, dy] = D.DIRS[q.dir];
      M.tiles[(q.y + dy) * M.w + q.x + dx] = D.T.FLOOR;
      M.npcs.push({ kind: 'encounter', id: 'mirror', x: q.x + dx, y: q.y + dy });
      Game.input('forward');
      const r = Game.chooseEncounter(1);
      if (!r || !r.check || r.check.pass) continue;
      got = M.monsters.map(m => m.id).join(',');
    }
    if (got !== want[depth]) return `a failed word with the mirror on floor ${depth} brought ${got || 'nothing'}, not a ${want[depth]}`;
  }
  return true;
});

await test('across runs every encounter turns up, and no two runs meet the same handful', async () => {
  const { encounterPlan, ENCOUNTERS } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
  const { Dungeon } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'dungeon.js')).href);
  const seen = new Set(), sets = new Set();
  // dealt as the game deals them, on the ladder of monster tiers
  for (let i = 0; i < 80; i++) {
    const all = encounterPlan('spread' + i, 8, Dungeon.tierAt).flat();
    all.forEach(e => seen.add(e));
    sets.add(all.slice().sort().join(','));
  }
  // (a road's own encounter is placed by the road, and a people's by their floor, not dealt)
  // (one met on a rung of the ladder stands in another's place: it is never planned)
  const missing = Object.keys(ENCOUNTERS).filter(e => !seen.has(e) && !ENCOUNTERS[e].route && !ENCOUNTERS[e].home && !ENCOUNTERS[e].heart && !ENCOUNTERS[e].rung);
  if (missing.length) return `never met in 80 runs: ${missing.join(', ')}`;
  return sets.size >= 70 || `80 runs met only ${sets.size} different handfuls`;
});
};
