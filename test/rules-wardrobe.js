// Rule checks for what a champion keeps of its kind, rings, the damage quoted, robes, the buckler, the casters' foci and cloaks.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function wardrobeChecks(h) {
  const { start, seedDice, markLog, linesSince, test, beside, ahead, run, walk } = h;

await test('a champion keeps everything its kind has that its prefix does not change', async () => {
  const ctx = await start('fighter', 'elite-fields');
  const { Game, MONSTERS, ELITES } = ctx;
  const out = [];
  const changed = new Set(['name', 'ac', 'hit', 'dmg', 'speed', 'xp']);
  for (const id of Object.keys(MONSTERS).filter(k => !MONSTERS[k].boss && !MONSTERS[k].named)) {
    for (const e of ELITES) {
      const st = Game.mstat({ id, elite: e.prefix, x: 0, y: 0 });
      for (const k of Object.keys(MONSTERS[id])) if (!changed.has(k) && st[k] !== MONSTERS[id][k]) out.push(`${e.prefix} ${id} lost '${k}'`);
    }
  }
  return out.length ? out.slice(0, 6).join('; ') : true;
});

await test('a named champion deals what its kin deals: the Hollow Abbess\'s touch is as cold as a wraith\'s', async () => {
  const { MONSTERS } = await start('fighter', 'named-element');
  const out = [];
  for (const id of Object.keys(MONSTERS).filter(k => MONSTERS[k].named)) {
    const kin = MONSTERS[MONSTERS[id].named.kin];
    if ((MONSTERS[id].element || '') !== (kin.element || '')) out.push(`${id} deals ${MONSTERS[id].element || 'nothing'}, its kin ${kin.element || 'nothing'}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Ring of Might adds its whole +1 to every blow, even with a quick dagger', async () => {
  const total = async ring => {
    const ctx = await start('mage', 'might-dagger');
    seedDice(ctx, 'might-dagger');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Object.assign(p.stats, { str: 12, dex: 10, con: 10, int: 16, wis: 10, cha: 10 });
    p.perkHit = 60;
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 };
    if (ring) { const r = { t: 'ring_might', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    const m = beside(ctx, 'ogre', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    let blows = 0;
    for (let i = 0; i < 60; i++) { G.t = p.nextAttack; const hp = m.hp; Game.input('attack'); if (m.hp < hp) blows++; }
    return { lost: 1e9 - m.hp, blows };
  };
  const bare = await total(false), ringed = await total(true);
  // the same seeded rolls both times: the ring's +1 on every blow that landed, and crits double it
  return (ringed.lost - bare.lost >= ringed.blows) || `bare ${bare.lost} over ${bare.blows} blows, ringed ${ringed.lost} over ${ringed.blows}`;
});

await test('the damage per second the pack and trader quote is what the weapon actually does', async () => {
  const out = [];
  // the ring, a talent, a path and finesse: each a part of the rule a copy of it lost
  const cases = [
    { cls: 'mage', weapon: 'dagger', ring: true },
    { cls: 'thief', weapon: 'longsword', level: 7 },
    { cls: 'fighter', weapon: 'greatsword', talents: ['weapon_master'], level: 5 },
    { cls: 'fighter', weapon: 'longsword', path: 'berserker', level: 5, hurt: true },
    // the second blade's blow is one of every blow a Ring of Might and a rage promise
    { cls: 'fighter', weapon: 'shortsword', offhand: 'dagger', ring: true, path: 'berserker', level: 5, hurt: true },
  ];
  for (const c of cases) {
    const ctx = await start(c.cls, 'blow-rate-' + c.weapon);
    seedDice(ctx, 'blow-rate-' + c.cls);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    if (c.level) p.level = c.level;
    if (c.talents) p.talents = c.talents;
    if (c.path) p.path = c.path;
    if (c.hurt) p.hp = Math.ceil(p.maxHp * 0.3);
    p.perkHit = 60;
    p.eq.shield = null; p.eq.offhand = c.offhand ? { t: c.offhand, q: 1, e: 0 } : null;
    p.eq.weapon = { t: c.weapon, q: 1, e: 0 };
    if (c.ring) { const r = { t: 'ring_might', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    const quoted = Game.blowRate(p.eq.weapon);
    const m = beside(ctx, 'ogre', { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    G.t = p.nextAttack; const t0 = G.t;
    for (let i = 0; i < 3000; i++) { G.t = p.nextAttack; Game.input('attack'); }
    // a natural 1 misses as often as a crit doubles, so the two all but cancel
    const measured = (1e9 - m.hp) / ((p.nextAttack - t0) / 1000);
    if (Math.abs(measured - quoted) / measured > 0.06) out.push(`${c.cls} with a ${c.weapon}: quoted ${quoted.toFixed(1)}, measured ${measured.toFixed(1)}`);
  }
  // a two-hander stows the second blade, so its quote does not count the second blade's blows
  const ctx = await start('fighter', 'blow-rate-dual');
  const { Game } = ctx; const p = Game.player();
  p.eq.shield = null; p.eq.weapon = { t: 'longsword', q: 1, e: 0 }; p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
  const great = { t: 'greatsword', q: 1, e: 0 };
  const alone = Game.blowRate(great);
  p.eq.offhand = null;
  if (Math.abs(Game.blowRate(great) - alone) > 1e-9) out.push('a two-hander\'s quote changed with a dagger in the other hand');
  // and a hidden enchantment is not given away
  if (Game.blowRate({ t: 'greatsword', q: 1, e: 3, h: 1 }) !== Game.blowRate(great)) out.push('a hidden +3 showed in the quote');
  return out.length ? out.join('; ') : true;
});

await test('an unknown ring shows no sign of its quality, whatever kind it is, so the "?" gives nothing away', async () => {
  const ctx = await start('fighter', 'jewel-hidden');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  const plus = { t: 'ring_protect', q: 1, e: 1, h: 1 }, plain = { t: 'ring_mend', q: 1, e: 0 };
  p.inv.push(plus, plain);
  if (Game.qualityHidden(plus) || Game.qualityHidden(plain)) return 'an unknown ring shows its quality as hidden';
  G.known.ring_protect = 1;
  if (!Game.qualityHidden(plus)) return 'a Ring of Protection, known, hides nothing about its make';
  // gear is unchanged: a found sword still hides its quality
  return Game.qualityHidden({ t: 'longsword', q: 1, e: 1, h: 1 }) || 'a found sword shows its quality';
});

await test('a buff says what it gives this hero: a Frostweaver\'s Shield, a Templar\'s Bless', async () => {
  const out = [];
  const say = async (cls, path, id) => {
    const ctx = await start(cls, 'buff-words-' + id);
    const { Game } = ctx; walk(ctx, path);
    return Game.spellDesc(Game.knownSpells().find(s => s.id === id));
  };
  const s0 = await say('mage', undefined, 'shield'), s1 = await say('mage', 'frostweaver', 'shield');
  if (!/^\+4 armour class for a minute\./.test(s0)) out.push(`plain Shield says "${s0}"`);
  if (!/^\+5 armour class for a minute and a half\./.test(s1)) out.push(`a Frostweaver's Shield says "${s1}"`);
  const b1 = await say('cleric', 'templar', 'bless');
  if (!/^\+2 to hit for two minutes\./.test(b1)) out.push(`a Templar's Bless says "${b1}"`);
  return out.length ? out.join('; ') : true;
});

await test('a Deep-born thief on the Assassin\'s path is noticed a square later than one who is not', async () => {
  const asleep = async path => {
    const ctx = await start('thief', 'notice-floor');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.bg = 'deepborn'; walk(ctx, path);
    const m = ahead(ctx, 'goblin', 2, { awake: false, hp: 9, maxHp: 9 });
    for (let i = 0; i < 30 && !m.awake; i++) Game.update(G.t + 100, 100);
    return !m.awake;
  };
  // a floor of two squares used to swallow the Assassin's step for a Deep-born thief
  if (await asleep('trickster')) return 'two squares off, it slept on without the Assassin\'s step';
  // (the dungeon's own dice are in it too, so the Assassin is given three tries to slip by)
  for (let k = 0; k < 3; k++) if (await asleep('assassin')) return true;
  return 'the Assassin\'s step did nothing for a Deep-born thief';
});

await test('a champion who kills the hero is named on the death screen', async () => {
  const ctx = await start('fighter', 'named-killer');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = 1; p.effects.ac = { amount: -100, until: 1e12 };
  const m = beside(ctx, 'grisk', { spoke: true, nextAct: G.t });
  for (let i = 0; i < 80 && G.status === 'playing'; i++) Game.update(G.t + 100, 100);
  const k = Game.lastAttacker();
  return (k && /^Grisk, the /.test(k.name)) || `killed by ${JSON.stringify(k)}`;
});

await test('a mage starts in an Apprentice\'s Robe, wears only robes, and nobody else can', async () => {
  const out = [];
  const ctx = await start('mage', 'robe-start');
  const { Game } = ctx; const p = Game.player();
  if (!p.eq.armor || p.eq.armor.t !== 'robe_apprentice') out.push(`a new mage wears ${JSON.stringify(p.eq.armor)}`);
  const ac = Game.playerAC(); Game.unequip('armor');
  if (Game.playerAC() !== ac - 1) out.push(`taking off the robe moved armour class ${ac} -> ${Game.playerAC()}`);
  if (!/robes/.test(Game.canEquip({ t: 'leather', q: 1, e: 0 }) || '')) out.push(`a mage could wear leather: ${Game.canEquip({ t: 'leather', q: 1, e: 0 })}`);
  for (const cls of ['fighter', 'cleric', 'thief']) {
    const c2 = await start(cls, 'robe-other');
    const why = c2.Game.canEquip({ t: 'robe_silk', q: 1, e: 0 });
    if (!why || !/mage/.test(why)) out.push(`a ${cls} could wear a Silk Robe (${why})`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Silk Robe adds four spell points while worn, and the Robe of the Magi eases the great workings', async () => {
  const out = [];
  const ctx = await start('mage', 'robe-sp');
  const { Game } = ctx; const p = Game.player();
  p.level = 7;
  Game.unequip('armor');
  const sp0 = Game.player().maxSp;
  const silk = { t: 'robe_silk', q: 1, e: 0 }; p.inv.push(silk); Game.equip(silk, true);
  if (p.maxSp !== sp0 + 4) out.push(`a Silk Robe made spell points ${sp0} into ${p.maxSp}`);
  Game.unequip('armor');
  if (p.maxSp !== sp0) out.push(`off again, spell points are ${p.maxSp}, not ${sp0}`);
  const cost = id => Game.spellCost(Game.knownSpells().find(s => s.id === id));
  const bolt0 = cost('lightning'), dart0 = cost('magic_missile');
  const magi = { t: 'robe_magi', q: 1, e: 0 }; p.inv.push(magi); Game.equip(magi, true);
  if (p.maxSp !== sp0 + 6) out.push(`the Robe of the Magi made spell points ${sp0} into ${p.maxSp}`);
  if (cost('lightning') !== bolt0 - 1) out.push(`in the Magi's robe lightning costs ${cost('lightning')}, not ${bolt0 - 1}`);
  if (cost('magic_missile') !== dart0) out.push(`a small spell changed cost: ${dart0} -> ${cost('magic_missile')}`);
  return out.length ? out.join('; ') : true;
});

await test('robes turn up only in a mage\'s dungeon, and every other floor is as it was', async () => {
  const robesIn = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game, ITEMS } = ctx; const found = [], rest = [];
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level();
      // relics are chosen for the class already (relicPlan), so they are left out
      // a caster's focus is placed for the class too, so it is left out with the relics
      for (const k in L.items) for (const it of L.items[k]) if (!it.u && !ITEMS[it.t].focus) (ITEMS[it.t].weight === 'cloth' ? found : rest).push(`${d}:${k}:${it.t}`);
      for (const n of L.npcs || []) for (const it of n.stock || []) if (!it.u && !ITEMS[it.t].focus) (ITEMS[it.t].weight === 'cloth' ? found : rest).push(`${d}:shop:${it.t}`);
    }
    return { found, rest: rest.sort().join('|') };
  };
  let mageRobes = 0;
  for (let i = 0; i < 4; i++) {
    const m = await robesIn('mage', 'robe-place' + i), f = await robesIn('fighter', 'robe-place' + i);
    if (f.found.length) return `a fighter's dungeon held robes: ${f.found.join(', ')}`;
    if (m.rest !== f.rest) return `on seed robe-place${i} the mage's floors hold other things than the fighter's`;
    mageRobes += m.found.length;
  }
  return mageRobes > 0 || 'four mage dungeons held no robe at all';
});

await test('what lies on one square is scattered across it, each thing seen where it lies', async () => {
  const ctx = await start('fighter', 'scatter');
  const { Game } = ctx; const L = Game.level();
  for (const k in L.items) delete L.items[k];
  L.items['5,5'] = [{ t: 'dagger', q: 1, e: 0 }, { t: 'potion_heal', q: 1, e: 0 }, { t: 'ration', q: 1, e: 0 }];
  L.items['9,9'] = Array.from({ length: 8 }, () => ({ t: 'gold', q: 5 }));
  const floor = Game.renderState(0).sprites.filter(sp => sp.onFloor);
  const here = floor.filter(sp => Math.floor(sp.x) === 5 && Math.floor(sp.y) === 5);
  if (here.length !== 3) return `three things on a square drew ${here.length} pictures`;
  if (new Set(here.map(sp => sp.x.toFixed(3) + ',' + sp.y.toFixed(3))).size !== 3) return 'two of them lie on the same spot';
  if (here.some(sp => Math.abs(sp.x - 5.5) > 0.3 || Math.abs(sp.y - 5.5) > 0.3)) return 'one lies outside its square';
  // from any side, none stands straight behind another: no two share a row or a column
  for (let i = 0; i < here.length; i++) for (let j = i + 1; j < here.length; j++) {
    if (Math.abs(here[i].x - here[j].x) < 0.1 || Math.abs(here[i].y - here[j].y) < 0.1) return 'two lie in line, so one hides the other from some side';
  }
  const heap = floor.filter(sp => Math.floor(sp.x) === 9 && Math.floor(sp.y) === 9);
  return heap.length === 5 || `eight things on a square drew ${heap.length} pictures, not the five that fit`;
});

await test('a thief carries a buckler for one more point of armour, and nothing bigger', async () => {
  const ctx = await start('thief', 'thief-buckler');
  const { Game } = ctx; const p = Game.player();
  const ac = Game.playerAC();
  const b = { t: 'buckler', q: 1, e: 0 }; p.inv.push(b);
  if (!Game.equip(b, true)) return `a thief could not take up a buckler: ${Game.canEquip(b)}`;
  if (Game.playerAC() !== ac + 1) return `a buckler moved armour class ${ac} -> ${Game.playerAC()}`;
  for (const t of ['shield', 'towershield']) {
    const why = Game.canEquip({ t, q: 1, e: 0 });
    if (!why || !/buckler/.test(why)) return `a thief could carry a ${t} (${why})`;
  }
  const mage = await start('mage', 'thief-buckler');
  return !!mage.Game.canEquip({ t: 'buckler', q: 1, e: 0 }) || 'a mage could carry a buckler';
});

await test('a caster\'s free hand: a mage holds a focus only with a one-handed weapon, a cleric a holy symbol, nobody else either', async () => {
  const out = [];
  const ctx = await start('mage', 'focus-hand');
  const { Game } = ctx; const p = Game.player();
  const orb = { t: 'crystal_orb', q: 1, e: 0 }; p.inv.push(orb);
  if (!/free hand/.test(Game.canEquip(orb) || '')) out.push(`with the staff in both hands the orb said: ${Game.canEquip(orb)}`);
  Game.equip(p.inv.find(i => i.t === 'dagger'), true);
  if (!Game.equip(orb, true) || p.eq.shield !== orb) out.push(`with a dagger the mage could not hold the orb: ${Game.canEquip(orb)}`);
  if (!Game.canEquip({ t: 'holy_symbol', q: 1, e: 0 })) out.push('a mage could hold a holy symbol');
  const cl = await start('cleric', 'focus-hand');
  if (cl.Game.canEquip({ t: 'silver_symbol', q: 1, e: 0 })) out.push(`a cleric could not hold a symbol: ${cl.Game.canEquip({ t: 'silver_symbol', q: 1, e: 0 })}`);
  if (!cl.Game.canEquip({ t: 'crystal_orb', q: 1, e: 0 })) out.push('a cleric could hold an orb');
  for (const c of ['fighter', 'thief']) {
    const o = await start(c, 'focus-hand');
    if (!o.Game.canEquip({ t: 'spellbook', q: 1, e: 0 }) || !o.Game.canEquip({ t: 'reliquary', q: 1, e: 0 })) out.push(`a ${c} could hold a focus`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a Spellbook brings spell points back a quarter faster, and a Crystal Orb adds one to each die, up to two', async () => {
  const out = [];
  const regained = async book => {
    const ctx = await start('mage', 'focus-regen');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    Game.equip(p.inv.find(i => i.t === 'dagger'), true);
    if (book) { const b = { t: 'spellbook', q: 1, e: 0 }; p.inv.push(b); Game.equip(b, true); }
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    p.maxSp = 999; p.sp = 0; p.steps = 0;
    for (let i = 0; i < 36; i++) { Game.input(i % 2 ? 'back' : 'forward'); run(Game, G, 320); }
    return { sp: p.sp, steps: p.steps };
  };
  const a = await regained(false), b = await regained(true);
  if (a.steps !== 36 || b.steps !== 36) out.push(`walked ${a.steps} and ${b.steps} steps, not 36`);
  if (a.sp !== 4 || b.sp !== 5) out.push(`over 36 steps spell points came back ${a.sp}, and ${b.sp} with the book`);
  // the orb: the same seeded dice, one more per die on every missile
  const hurt = async orb => {
    const ctx = await start('mage', 'focus-die');
    seedDice(ctx, 'focus-die');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    Game.equip(p.inv.find(i => i.t === 'dagger'), true);
    if (orb) { const o = { t: 'crystal_orb', q: 1, e: 0 }; p.inv.push(o); Game.equip(o, true); }
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    const sp = Game.knownSpells().find(s => s.id === 'magic_missile'), dice = sp.dmg(p.level)[0];
    for (let i = 0; i < 20; i++) { p.sp = 99; G.t = p.nextAttack; Game.castSpell(sp); run(Game, G, 700); }
    return { lost: 1e9 - m.hp, dice };
  };
  const o0 = await hurt(false), o1 = await hurt(true);
  if (o1.lost - o0.lost !== 20 * Math.min(2, o0.dice)) out.push(`twenty missiles did ${o0.lost}, and ${o1.lost} with the orb (${o0.dice} dice each)`);
  return out.length ? out.join('; ') : true;
});

await test('a Holy Symbol heals a quarter more, a Silver Sunburst smites and strikes a quarter harder, and a cleric pays in armour', async () => {
  const out = [];
  const heal = async sym => {
    const ctx = await start('cleric', 'symbol-heal');
    seedDice(ctx, 'symbol-heal');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const ac0 = Game.playerAC();
    if (sym) { const s = { t: sym, q: 1, e: 0 }; p.inv.push(s); Game.equip(s, true); }
    const dAc = Game.playerAC() - ac0;
    p.maxHp = 99999; let total = 0;
    for (let i = 0; i < 200; i++) { p.hp = 1; p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'cure_light')); total += p.hp - 1; }
    return { total, dAc };
  };
  const h0 = await heal(null), h1 = await heal('holy_symbol');
  if (!(h1.total / h0.total > 1.2 && h1.total / h0.total < 1.3)) out.push(`healing ${h0.total} -> ${h1.total} with the symbol`);
  if (h1.dAc !== -1) out.push(`trading the shield for the symbol moved armour class by ${h1.dAc}, not -1`);
  const smite = async (sym, spell = 'smite') => {
    const ctx = await start('cleric', 'symbol-smite');
    seedDice(ctx, 'symbol-smite');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.level = spell === 'smite' ? 5 : 9;
    if (sym) { const s = { t: sym, q: 1, e: 0 }; p.inv.push(s); Game.equip(s, true); }
    const m = ahead(ctx, 'orc', 2, { hp: 1e9, maxHp: 1e9, nextAct: 1e12 });
    for (let i = 0; i < 40; i++) { p.sp = 99; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === spell)); run(Game, G, 700); }
    return 1e9 - m.hp;
  };
  const s0 = await smite(null), s1 = await smite('silver_symbol');
  if (!(s1 / s0 > 1.18 && s1 / s0 < 1.32)) out.push(`smiting ${s0} -> ${s1} with the sunburst`);
  const f0 = await smite(null, 'flame_strike'), f1 = await smite('silver_symbol', 'flame_strike');
  if (!f0) out.push('Flame Strike did no harm at all');
  else if (!(f1 / f0 > 1.18 && f1 / f0 < 1.32)) out.push(`Flame Strike ${f0} -> ${f1} with the sunburst`);
  return out.length ? out.join('; ') : true;
});

await test('a trader may shelve caster gear a tier finer than the floor, but never two', async () => {
  let deeper = 0; const out = [];
  for (let i = 0; i < 12; i++) {
    const cls = i % 2 ? 'cleric' : 'mage';
    const ctx = await start(cls, 'shelf-tier' + i);
    const { Game, ITEMS } = ctx;
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const maxTier = 1 + Math.floor(d / 2);
      for (const it of (Game.level().npcs || []).flatMap(n => n.stock || [])) {
        const b = ITEMS[it.t];
        if (!(b.focus || b.weight === 'cloth')) continue;
        if (b.tier > maxTier + 1) out.push(`${it.t} (tier ${b.tier}) on a floor-${d} shelf`);
        else if (b.tier === maxTier + 1) deeper++;
      }
      // (a relic lying on a pile is the relic plan's doing, weakest first, whatever its base piece's tier)
      for (const it of Object.values(Game.level().items).flat()) {
        const b = ITEMS[it.t];
        if (!it.u && (b.focus || b.weight === 'cloth') && b.tier > maxTier) out.push(`${it.t} (tier ${b.tier}) on a floor-${d} pile`);
      }
    }
  }
  if (!deeper) out.push('no trader ever shelved a finer piece');
  return out.length ? out.join('; ') : true;
});

await test('foci turn up only in a caster\'s dungeon, and never for the other caster', async () => {
  const count = async (cls, seed) => {
    const ctx = await start(cls, seed);
    const { Game, ITEMS } = ctx; const found = {};
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { Game.level().monsters.length = 0; Game.descend(); }
      const L = Game.level();
      const all = [...Object.values(L.items).flat(), ...(L.npcs || []).flatMap(n => n.stock || [])];
      for (const it of all) if (ITEMS[it.t].focus) found[ITEMS[it.t].focus] = (found[ITEMS[it.t].focus] || 0) + 1;
    }
    return found;
  };
  let mage = 0, cleric = 0;
  for (let i = 0; i < 4; i++) {
    const m = await count('mage', 'focus-place' + i), c = await count('cleric', 'focus-place' + i), f = await count('fighter', 'focus-place' + i);
    if (m.cleric || c.mage || f.mage || f.cleric) return `the wrong caster's focus turned up: mage ${JSON.stringify(m)}, cleric ${JSON.stringify(c)}, fighter ${JSON.stringify(f)}`;
    mage += m.mage || 0; cleric += c.cleric || 0;
  }
  return (mage > 0 && cleric > 0) || `four dungeons each held ${mage} mage foci and ${cleric} holy symbols`;
});

await test('anyone can wear a cloak: Protection adds to a ring, the Elven cloak is quiet, Warmth keeps out the cold', async () => {
  const out = [];
  for (const cls of ['fighter', 'cleric', 'mage', 'thief']) {
    const ctx = await start(cls, 'cloak-' + cls);
    const { Game } = ctx; const p = Game.player();
    const ac = Game.playerAC();
    const c = { t: 'cloak_protect', q: 1, e: 0 }; p.inv.push(c);
    if (!Game.equip(c, true) || p.eq.cloak !== c) { out.push(`a ${cls} could not wear a cloak: ${Game.canEquip(c)}`); continue; }
    if (Game.playerAC() !== ac + 1) out.push(`a ${cls}'s cloak moved armour class ${ac} -> ${Game.playerAC()}`);
    if (cls === 'mage') {
      const r = { t: 'ring_protect', q: 1, e: 0 }; p.inv.push(r); Game.state().known.ring_protect = 1; Game.equip(r, true);
      if (Game.playerAC() !== ac + 2) out.push(`a cloak and a ring made armour class ${ac} -> ${Game.playerAC()}, not +2`);
      Game.unequip('cloak');
      const el = { t: 'cloak_elven', q: 1, e: 0 }; p.inv.push(el); Game.equip(el, true);
      if (!Game.hasPower('quiet')) out.push('an Elven Cloak did not make its wearer quiet');
      Game.unequip('cloak');
      const w = { t: 'cloak_warmth', q: 1, e: 0 }; p.inv.push(w); Game.equip(w, true);
      if (!Game.hasPower('warmth')) out.push('a Cloak of Warmth did not keep out the cold');
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a save from before cloaks loads with an empty cloak slot, and cloaks turn up for every class', async () => {
  const ctx = await start('thief', 'cloak-save');
  const { Game } = ctx; const G = Game.state();
  delete G.player.eq.cloak;
  Game.save(true);
  if (!Game.load()) return 'the old save would not load';
  if (Game.player().eq.cloak !== null) return `the cloak slot came back as ${JSON.stringify(Game.player().eq.cloak)}`;
  let found = 0;
  for (let i = 0; i < 3; i++) {
    const c2 = await start(['fighter', 'mage', 'thief'][i], 'cloak-place' + i);
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { c2.Game.level().monsters.length = 0; c2.Game.descend(); }
      const L = c2.Game.level();
      found += [...Object.values(L.items).flat(), ...(L.npcs || []).flatMap(n => n.stock || [])].filter(it => c2.ITEMS[it.t].kind === 'cloak').length;
    }
  }
  return found > 0 || 'three dungeons held no cloak at all';
});

await test('a focus turns no blows and rusts not: its make and a curse never touch armour class', async () => {
  const out = [];
  const ctx = await start('mage', 'focus-ac');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.equip(p.inv.find(i => i.t === 'dagger'), true);
  const ac = Game.playerAC();
  const orb = { t: 'crystal_orb', q: 1, e: 2 }; p.inv.push(orb); Game.equip(orb, true);
  if (Game.playerAC() !== ac) out.push(`a +2 orb moved armour class ${ac} -> ${Game.playerAC()}`);
  // a rustmaw bites a mage in a robe with an orb in hand: nothing of metal to eat
  p.hp = p.maxHp = 9999;
  const m = beside(ctx, 'rustmaw', { blows: 2, hp: 999, maxHp: 999, edge: 40 });
  const mark = markLog(G);
  for (let i = 0; i < 4 && (orb.e === 2); i++) { m.moveReady = 0; run(Game, G, 1200); }
  if (orb.e !== 2) out.push(`the rust ate the orb: now ${orb.e} (${linesSince(G, mark).join(' | ')})`);
  if (linesSince(G, mark).some(l => /forge can mend/.test(l) && /Orb/.test(l))) out.push('the log promised the forge would mend an orb');
  return out.length ? out.join('; ') : true;
});

await test('the log names what keeps out the cold: a cloak is not called a ring', async () => {
  const out = [];
  for (const [id, word] of [['cloak_warmth', 'cloak'], ['ring_warmth', 'ring']]) {
    const ctx = await start('fighter', 'warm-' + word);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const it = { t: id, q: 1, e: 0 }; p.inv.push(it); G.known[id] = 1; Game.equip(it, true);
    beside(ctx, 'wraith');
    const mark = markLog(G);
    let line = null;
    for (let i = 0; i < 400 && !line; i++) { Game.update(G.t + 25, 25); line = linesSince(G, mark).find(l => /keeps out the cold/.test(l)); }
    if (!line) out.push(`a wraith never hit through a ${word}`);
    else if (!line.includes(`your ${word} keeps out the cold`)) out.push(`with a ${word}: "${line}"`);
  }
  return out.length ? out.join('; ') : true;
});

await test('an old save\'s enchanted focus comes back plain, as a focus never counted for armour', async () => {
  const ctx = await start('mage', 'focus-old-save');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  const orb = { t: 'crystal_orb', q: 1, e: 2 }, book = { t: 'spellbook', q: 1, e: -1 };
  p.inv.push(book);
  const staff = p.eq.weapon; if (staff && ctx.ITEMS[staff.t].hands === 2) Game.unequip('weapon');
  p.eq.shield = orb;
  Game.save(true);
  if (!Game.load()) return 'the save would not load';
  const q = Game.player();
  return (q.eq.shield?.e === 0 && q.inv.find(it => it.t === 'spellbook')?.e === 0) || `the orb came back ${q.eq.shield?.e}, the book ${q.inv.find(it => it.t === 'spellbook')?.e}`;
});
};
