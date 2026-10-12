// Rule checks for the named champions.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function championsChecks(h) {
  const { OPTS, newContext, start, seedDice, markLog, linesSince, test, beside, pinned, ahead, clearBehind, shift, run, listenTo, downTo } = h;

// ---------- named champions ----------
/** An open square beside a monster with another beyond it, in the same line: [dx, dy] from it, or null. */
function roomBeside(ctx, m) {
  const { Game, Dungeon } = ctx; const L = Game.level(), T = Dungeon.T;
  return Dungeon.DIRS.find(([dx, dy]) => L.tiles[(m.y + dy) * L.w + m.x + dx] === T.FLOOR && L.tiles[(m.y + 2 * dy) * L.w + m.x + 2 * dx] === T.FLOOR) || null;
}

await test('named champions hold a floor a third and two thirds down (a long delve: a quarter, half and three quarters), chosen to suit it, never the first nor the lich\'s', async () => {
  const { Dungeon, MONSTERS } = await newContext();
  const named = Object.keys(MONSTERS).filter(id => MONSTERS[id].named);
  if (named.length < 4 || named.length > 10) return `${named.length} named champions`;
  for (const id of named) if (MONSTERS[id].boss) return `${id} is marked as the Heart's keeper`;
  // (and on a long delve the dark elves' High Priestess, on their own floor; in sixteen, the lizardfolk's Marsh-Mother and the grey dwarves' Thane on theirs)
  const want = { 2: [], 3: [2], 4: [2, 3], 6: [2, 4], 8: [3, 6], 12: [3, 6, 9, 10], 16: [4, 5, 8, 11, 12, 14] };
  for (const levels of [2, 3, 4, 6, 8, 12, 16]) {
    for (let s = 0; s < 12; s++) {
      const seed = `named-floors-${s}`, plan = Dungeon.namedPlan(seed, levels);
      const floors = Object.keys(plan).map(Number);
      if (floors.join() !== want[levels].join()) return `${levels} floors: champions on [${floors}], expected [${want[levels]}]`;
      if (new Set(Object.values(plan)).size !== floors.length) return `${seed}/${levels}: one champion twice`;
      if (JSON.stringify(Dungeon.namedPlan(seed, levels)) !== JSON.stringify(plan)) return 'the plan is not the same twice for one seed';
      for (const d of floors) {
        const b = MONSTERS[plan[d]], t = Dungeon.tierAt(d, levels);
        // each suits its floor, wherever any champion does
        if (!b.named.home && named.some(id => t >= MONSTERS[id].tier[0] && t <= MONSTERS[id].tier[1]) && !(t >= b.tier[0] && t <= b.tier[1])) return `${plan[d]} (tiers ${b.tier}) holds floor ${d} of ${levels}, at tier ${t.toFixed(1)}`;
      }
      if (![3, 8, 12].includes(levels) || s > 3) continue;
      // and on the floors themselves: there, asleep, the only one of its name, and nowhere else
      for (let d = 1; d <= levels; d++) {
        const L = Dungeon.generate(seed, d, { levels, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true });
        const here = L.monsters.filter(m => MONSTERS[m.id].named);
        if (here.length !== (plan[d] ? 1 : 0) || (plan[d] && here[0].id !== plan[d])) return `${seed} floor ${d} of ${levels} holds [${here.map(m => m.id)}], the plan says ${plan[d] || 'none'}`;
        const m = here[0];
        if (!m) continue;
        if (m.awake || m.elite || m.pack) return `${m.id} on ${seed} floor ${d} is ${m.awake ? 'awake' : m.elite ? 'a ' + m.elite + ' champion' : 'in a group'}`;
        const far = Math.abs(m.x - L.start.x) + Math.abs(m.y - L.start.y);
        if (far < 8) return `${m.id} sleeps ${far} squares from the way in`;
        // its kin, where it keeps any, keep it company
        const guard = MONSTERS[m.id].named.guard;
        if (guard && !L.monsters.some(o => o !== m && o.id === guard[0] && Math.abs(o.x - m.x) + Math.abs(o.y - m.y) <= 6)) return `${m.id} on ${seed} floor ${d} has no kin about it`;
      }
    }
  }
  return true;
});

await test('a named champion is never met at random: not in a floor\'s crowd, nor out of an ambush', async () => {
  const { Dungeon, MONSTERS } = await newContext();
  for (let s = 0; s < 10; s++) for (const levels of [4, 8, 16]) {
    const plan = Dungeon.namedPlan('random-' + s, levels);
    for (let d = 1; d <= levels; d++) {
      const L = Dungeon.generate('random-' + s, d, { levels, size: 'small', monsters: 'many', treasure: 'normal', lockedDoors: false, traps: false });
      const stray = L.monsters.find(m => MONSTERS[m.id].named && m.id !== plan[d]);
      if (stray) return `${stray.id} wandered onto floor ${d} of ${levels}`;
    }
  }
  // a rest broken by an ambush draws from the floor's crowd, never a champion
  const ctx = await start('fighter', 'named-ambush', { levels: 8 });
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  seedDice(ctx, 'named-ambush');
  downTo(ctx, 6);
  let ambushes = 0;
  for (let i = 0; i < 80; i++) {
    const L = Game.level();
    L.monsters = L.monsters.filter(m => MONSTERS[m.id].named && m.uid < 900000);
    L.rests = 1; p.hp = 1; p.food = 100; p.lastHurt = -1e9;
    const n = L.monsters.length;
    await pinned(0, async () => { Game.rest(); });
    if (L.monsters.length > n) ambushes++;
    const came = L.monsters.find(m => MONSTERS[m.id].named && m.uid >= 900000);
    if (came) return `an ambush brought ${came.id}`;
  }
  return (G.depth === 6 && ambushes > 0) || `floor ${G.depth}, ${ambushes} ambushes`;
});

await test('arriving on its floor names it; waking, it speaks with the dread sting, and its bar shows its name', async () => {
  const ctx = await start('fighter', 'named-arrive', { levels: 8 });
  const { Game, Dungeon, MONSTERS } = ctx; const G = Game.state();
  const plan = Dungeon.namedPlan('named-arrive', 8), d = Number(Object.keys(plan)[0]), id = plan[d], b = MONSTERS[id];
  downTo(ctx, d - 1);
  let mark = markLog(G);
  downTo(ctx, d);
  const said = linesSince(G, mark);
  if (!said.includes(b.named.arrive) || !b.named.arrive.includes(b.named.called)) return `arriving said: ${said.join(' | ')}`;
  const L = Game.level(), p = Game.player(), m = L.monsters.find(o => o.id === id);
  if (Game.renderState(0).fx.boss) return 'a bar showed for a champion still asleep';
  // bring the hero near: it notices, wakes, and says so
  L.monsters = [m];
  const at = roomBeside(ctx, m);
  if (!at) return 'no room beside the champion for the test';
  p.x = m.x + 2 * at[0]; p.y = m.y + 2 * at[1]; p.hp = p.maxHp = 999;
  mark = markLog(G);
  const heard = await listenTo(ctx, () => { run(Game, G, 1500); });
  const woke = linesSince(G, mark);
  if (!m.awake || !woke.includes(b.named.wake)) return `it ${m.awake ? 'woke' : 'slept'} and said: ${woke.join(' | ')}`;
  if (woke.indexOf(b.named.wake) > woke.findIndex(l => /^Bestiary/.test(l))) return 'the bestiary spoke before the champion did';
  if (!heard.some(h => h.name === 'dread')) return `no dread sting: ${heard.map(h => h.name).join(',')}`;
  const rs = Game.renderState(0), bar = rs.fx.boss;
  if (!bar || !bar.named || bar.name !== `${b.named.called}, the ${b.name}` || bar.hp !== m.hp || bar.maxHp !== m.maxHp) return `the bar: ${JSON.stringify(bar)}`;
  // under the bar at the top it carries none of its own, and it stands bigger than its kind
  const sp = rs.sprites.find(s => s.boss);
  if (!sp || sp.hp !== null || !(sp.scale > MONSTERS[b.named.kin].scale)) return `its sprite: ${JSON.stringify(sp && { hp: sp.hp, scale: sp.scale })}`;
  // far off, the bar goes
  p.x = m.x + 12; p.y = m.y;
  return !Game.renderState(0).fx.boss || 'the bar stayed with the champion far off';
});

await test('the Goblin King\'s horn is warned of; a wound cuts it short and spends it; let sound, his kin come, and twice at most', async () => {
  const ctx = await start('fighter', 'named-horn');
  const { Game } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  seedDice(ctx, 'named-horn');
  const m = beside(ctx, 'grisk', { hp: 100, maxHp: 100, spoke: true });
  // not before half
  run(Game, G, 200);
  if (m.windup && m.windup.move === 'rally') return 'he reached for the horn unhurt';
  m.hp = 40; m.windup = null; m.volley = null; m.nextAct = G.t; m.moveReady = 0;
  let mark = markLog(G);
  const heard = await listenTo(ctx, () => { Game.update(G.t + 25, 25); });
  if (!(m.windup && m.windup.move === 'rally')) return 'hurt past half, he did not reach for the horn';
  if (!linesSince(G, mark).some(l => /war-horn/.test(l) && /Strike him/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  if (!heard.some(h => h.name === 'special')) return 'the horn was not heard coming';
  const sp = Game.renderState(0).sprites.find(s => s.special);
  if (!sp || !(sp.tell > 0)) return 'no violet mark over him';
  // strike: the call is cut short, and no one comes (swinging again past a natural one)
  mark = markLog(G);
  for (let i = 0; i < 5 && m.hp === 40; i++) { G.t = p.nextAttack; Game.input('attack'); }
  if (m.hp === 40) return 'five swings never landed';
  if (m.windup) return 'a wound did not cut the call short';
  if (!linesSince(G, mark).some(l => /cut .* call short/.test(l))) return `the blow said: ${linesSince(G, mark).join(' | ')}`;
  if (L.monsters.length !== 1) return 'goblins came to a call cut short';
  // the second call, let sound: goblins come running
  m.nextAct = G.t; m.moveReady = 0; m.hp = 40;
  Game.update(G.t + 25, 25);
  if (!(m.windup && m.windup.move === 'rally')) return 'he did not try a second call';
  const [dx, dy] = ctx.Dungeon.DIRS[(p.dir + 2) % 4];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = ctx.Dungeon.T.FLOOR;
  mark = markLog(G);
  const blast = await listenTo(ctx, () => { run(Game, G, 1600); });
  const kin = L.monsters.filter(o => o.id === 'goblin');
  if (kin.length !== 1 || !kin[0].pack || kin[0].pack.length !== 1 || !kin[0].awake) return `the horn called ${JSON.stringify(kin.map(k => [k.id, k.pack && k.pack.length, k.awake]))}`;
  if (!blast.some(h => h.name === 'horn')) return 'the horn was not heard';
  if (!linesSince(G, mark).some(l => /horn blares/.test(l))) return `it said: ${linesSince(G, mark).join(' | ')}`;
  // and never a third
  L.monsters = [m]; m.moveReady = 0; m.hp = 40;
  for (let i = 0; i < 200; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'rally') return 'he called a third time'; }
  return m.rallies === 2 || `rallies ${m.rallies}`;
});

await test('the Web-Mother spits from beside you and twice as often; the Ghoul Lord claws every other blow; the Warchief charges twice as often', async () => {
  // the web: from right beside the hero, where a cave spider never spits, and again in half the time
  const ctx = await start('fighter', 'named-web');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.hp = p.maxHp = 9999;
  const spider = beside(ctx, 'spider');
  Game.update(G.t + 25, 25);
  if (spider.windup && spider.windup.move === 'web') return 'a cave spider spat from beside the hero';
  const v = beside(ctx, 'vessra', { spoke: true });
  const mark = markLog(G);
  Game.update(G.t + 25, 25);
  if (!(v.windup && v.windup.move === 'web')) return 'the Web-Mother did not spit from beside the hero';
  if (!linesSince(G, mark).some(l => /^Vessra rears back to spit a web/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  run(Game, G, 700);
  if (v.windup && v.windup.move === 'web') return 'the web never flew';
  if (!(p.webbed > G.t) && !linesSince(G, mark).some(l => /web/i.test(l))) return 'the web caught nothing and said nothing';
  const gap = v.moveReady - G.t;
  if (!(gap > 2500 && gap <= 3500)) return `her next web is ${gap}ms off; a spider's is 7000`;
  // the claw, after one blow rather than two
  const c2 = await start('fighter', 'named-claw');
  const g2 = c2.Game.state();
  c2.Game.player().hp = c2.Game.player().maxHp = 9999;
  const ghoul = beside(c2, 'ghoul', { blows: 1 });
  c2.Game.update(g2.t + 25, 25);
  if (ghoul.windup && ghoul.windup.move === 'paralyse') return 'a ghoul clawed after one blow';
  const lord = beside(c2, 'morrow', { blows: 1, spoke: true });
  c2.Game.update(g2.t + 25, 25);
  if (!(lord.windup && lord.windup.move === 'paralyse')) return 'the Ghoul Lord waited for a second blow';
  // the charge: from four squares, and ready again in half an orc's time
  const c3 = await start('fighter', 'named-charge');
  const g3 = c3.Game.state();
  c3.Game.player().hp = c3.Game.player().maxHp = 9999;
  const orc = ahead(c3, 'orc', 4);
  await pinned(0, async () => { c3.Game.update(g3.t + 25, 25); });
  if (orc.windup && orc.windup.move === 'charge') return 'an orc charged from four squares';
  const u = ahead(c3, 'ushgar', 4, { spoke: true });
  await pinned(0, async () => { c3.Game.update(g3.t + 25, 25); });
  if (!(u.windup && u.windup.move === 'charge')) return 'the Warchief did not charge from four squares';
  run(c3.Game, g3, 800);
  const wait = u.moveReady - g3.t;
  return (wait > 2500 && wait <= 4000) || `his next charge is ${wait}ms off; an orc's is 8000`;
});

await test('the Hollow Abbess reaches to drink: step back and she is open; caught, a weak will loses 3 for good and mends her', async () => {
  const ctx = await start('cleric', 'named-drink');
  const { Game, Dungeon } = ctx; const G = Game.state(), p = Game.player();
  seedDice(ctx, 'named-drink');
  p.hp = p.maxHp = 500;
  const o = beside(ctx, 'orla', { blows: 2, hp: 50, maxHp: 100, spoke: true });
  let mark = markLog(G);
  const heard = await listenTo(ctx, () => { Game.update(G.t + 25, 25); });
  if (!(o.windup && o.windup.move === 'drink')) return 'she did not reach after two blows';
  if (!linesSince(G, mark).some(l => /reaches into your chest/.test(l) && /Step back/.test(l))) return `the warning said: ${linesSince(G, mark).join(' | ')}`;
  if (!heard.some(h => h.name === 'special')) return 'her reach was not heard';
  // stepping back: her hand closes on air
  clearBehind(ctx); shift(ctx, 'back');
  mark = markLog(G);
  run(Game, G, 900);
  if (!linesSince(G, mark).some(l => /closes on the air/.test(l))) return `stepping back: ${linesSince(G, mark).join(' | ')}`;
  if (!(p.opening && p.opening.uid === o.uid)) return 'stepping back left no opening';
  if (p.maxHp !== 500) return 'she drank from a hero who stepped back';
  // standing: a weak will is drunk from, a strong one holds
  let lost = 0, held = 0;
  for (let i = 0; i < 30 && (!lost || !held); i++) {
    const L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    const m = { ...o, x: p.x + dx, y: p.y + dy, hp: 50, maxHp: 100, windup: { kind: 'move', move: 'drink', at: G.t, until: G.t }, nextAct: G.t };
    L.monsters.push(m);
    p.hp = p.maxHp; p.mirrors = 0; G.blowGate = 0;
    const before = p.maxHp;
    mark = markLog(G);
    Game.update(G.t + 25, 25);
    const said = linesSince(G, mark);
    if (said.some(l => /drinks deep/.test(l))) {
      if (p.maxHp !== before - 3) return `drunk from, most health went ${before} -> ${p.maxHp}`;
      if (m.hp !== 59) return `she mended to ${m.hp}, not 59`;
      lost++;
    } else if (said.some(l => /will holds/.test(l))) held++;
  }
  return (lost > 0 && held > 0) || `in thirty reaches: drunk from ${lost}, held ${held}`;
});

await test('the Troll-Father\'s wounds close two a second, where you can see it, until fire sears them', async () => {
  const ctx = await start('fighter', 'named-regen');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  p.hp = p.maxHp = 9999;
  const t = beside(ctx, 'gorrum', { hp: 50, maxHp: 200, nextAct: 1e12, spoke: true });
  G.met = { [t.uid]: 1 };
  const mark = markLog(G);
  let shown = false;
  for (let i = 0; i < 120; i++) { Game.update(G.t + 25, 25); shown = shown || Game.renderState(0).fx.texts.some(x => x.text === '+2'); }
  if (!(t.hp >= 55 && t.hp <= 57)) return `in three seconds it regrew to ${t.hp} from 50`;
  if (!linesSince(G, mark).some(l => /wounds close as you watch. Fire/.test(l))) return 'the log never said what stops it';
  if (!shown) return 'its mending is not shown';
  t.burnUntil = G.t + 6000;
  const was = t.hp;
  run(Game, G, 3000);
  return t.hp === was || `burned, it still regrew to ${t.hp} from ${was}`;
});

await test('a named champion slain: its line and fanfare, its xp, a relic from the traders\' keeping, and the bestiary, run and Hall know', async () => {
  const ctx = await start('fighter', 'named-spoils', { levels: 8 });
  const { Game, MONSTERS, RELICS } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
  p.perkHit = 60;
  const R = G.relics, next = R.shop[R.offered], offered = R.offered;
  if (!next || R.shop.length - R.offered < 2) return 'this seed keeps fewer than two relics for the traders (one waits for the floor before last)';
  seedDice(ctx, 'named-spoils');
  const m = beside(ctx, 'grisk', { hp: 1, maxHp: 60, spoke: true, nextAct: 1e12 });
  const xp = p.xp, mark = markLog(G);
  // a natural one misses whatever the bonus, so swing until he falls
  const heard = await listenTo(ctx, () => { for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); } });
  if (L.monsters.includes(m)) return 'the Goblin King would not die';
  const said = linesSince(G, mark);
  // said once: his own line, with the reward, and no plain kill line besides
  const falls = said.filter(l => l.startsWith(MONSTERS.grisk.named.fall));
  if (falls.length !== 1 || !/\(\+\d+ xp/.test(falls[0])) return `his fall said: ${said.join(' | ')}`;
  if (said.some(l => / is (slain|destroyed)!/.test(l))) return `his death told twice: ${said.join(' | ')}`;
  if (!heard.some(h => h.name === 'namedfall')) return 'no fanfare';
  if (p.xp - xp < MONSTERS.grisk.xp) return `only ${p.xp - xp} xp`;
  const pile = L.items[m.x + ',' + m.y] || [];
  if (!pile.some(it => it.u === next)) return `he left [${pile.map(it => it.u || it.t)}], not ${next}`;
  if (R.offered !== offered + 1) return 'the relic is still kept for a trader';
  if (!said.some(l => l.includes(RELICS[next].name))) return 'the log did not say what he left';
  // and something from his fingers or throat, never cursed
  const jewel = pile.find(it => ['ring', 'amulet'].includes(ctx.ITEMS[it.t].kind));
  if (!jewel || jewel.curse || (jewel.e || 0) < 0) return `he left no ring or amulet, or a cursed one: [${pile.map(it => it.u || it.t)}]`;
  if (!said.some(l => / glints among its things\.$/.test(l))) return 'the log did not say a ring or amulet was there';
  const rec = Game.bestiary().grisk;
  if (!rec || rec.kills !== 1 || !rec.trick || !rec.answer) return `the bestiary: ${JSON.stringify(rec)}`;
  if (Game.runStats().kills.grisk !== 1) return 'the run did not count him';
  // the Hall of Heroes names him on the run's line
  G.status = 'playing'; p.hp = 1; L.monsters = [];
  const ogre = beside(ctx, 'ogre', { edge: 60, nextAct: G.t });
  p.mirrors = 0;
  for (let i = 0; i < 400 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  if (G.status !== 'dead' || !ogre) return 'the hero would not die';
  const row = Game.hall().find(h => h.seed === 'named-spoils');
  return (row && JSON.stringify(row.named) === '["Grisk"]') || `the Hall kept ${JSON.stringify(row)}`;
});

await test('with no relic left for the traders, a champion leaves a +2 piece its slayer can use, and gold', async () => {
  for (const cls of ['mage', 'thief', 'cleric', 'fighter']) {
    const ctx = await start(cls, 'named-fallback-' + cls, { levels: 8 });
    const { Game, ITEMS } = ctx; const G = Game.state(), p = Game.player(), L = Game.level();
    seedDice(ctx, 'named-fallback-' + cls);
    p.perkHit = 60;
    G.relics.offered = G.relics.shop.length;
    const m = beside(ctx, 'vessra', { hp: 1, maxHp: 60, spoke: true, nextAct: 1e12 });
    for (let i = 0; i < 20 && L.monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); }
    if (L.monsters.includes(m)) return `${cls}: the Web-Mother would not die`;
    const pile = L.items[m.x + ',' + m.y] || [];
    // a caster's focus comes plain: its make is in what it does, not a number
    const gear = pile.find(it => ['weapon', 'armor', 'shield'].includes(ITEMS[it.t].kind) && it.e === (ITEMS[it.t].focus ? 0 : 2) && !it.h && !it.curse && !it.u);
    if (!gear) return `${cls}: she left [${pile.map(it => it.t + (it.e ? '+' + it.e : ''))}]`;
    // a shield wants a free hand, which a staff does not leave: that is a matter of what is held, not who
    const why = Game.canEquip(gear);
    if (why && !/free hand/.test(why)) return `${cls} cannot use the ${gear.t} she left: ${why}`;
    if (!pile.some(it => it.t === 'gold' && it.q > 0)) return `${cls}: no gold`;
  }
  return true;
});

await test('a named champion is as much sturdier as the difficulty says, and the press never gives it a prefix', async () => {
  const on = async (difficulty, level) => {
    const ctx = await start('fighter', 'named-hp', { levels: 8, difficulty });
    const { Game, Dungeon, MONSTERS } = ctx;
    const d = Number(Object.keys(Dungeon.namedPlan('named-hp', 8))[0]);
    if (level) Game.player().level = level;
    downTo(ctx, d);
    return Game.level().monsters.find(o => MONSTERS[o.id].named);
  };
  const easy = await on('easy'), normal = await on('normal'), hard = await on('hard');
  // (on eight floors, a delve shorter than the Long Delve: a ninth more on Normal, a twentieth on Hard)
  if (Math.abs(normal.maxHp / easy.maxHp - 1.5 * 1.11) > 0.05 || Math.abs(hard.maxHp / easy.maxHp - 1.9 * 1.05) > 0.05) return `easy ${easy.maxHp}, normal ${normal.maxHp}, hard ${hard.maxHp}`;
  // a hero far ahead of the floor: every creature there is readier, and many become champions, but not this one
  for (let i = 0; i < 6; i++) {
    const pressed = await pinned(i / 6, () => on('normal', 12));
    if (pressed.elite) return `pressed, it became ${pressed.elite}`;
    if (!(pressed.maxHp > normal.maxHp && pressed.edge > 0)) return `pressed: ${pressed.maxHp} hp, edge ${pressed.edge}; unpressed ${normal.maxHp}`;
  }
  return true;
});

await test('a save keeps a named champion, its fight and its floor, and its bar comes back with it', async () => {
  const ctx = await start('fighter', 'named-save', { levels: 8 });
  const { Game, Dungeon, MONSTERS } = ctx;
  const plan = Dungeon.namedPlan('named-save', 8), d = Number(Object.keys(plan)[1]);
  downTo(ctx, d);
  const L = Game.level(), m = L.monsters.find(o => MONSTERS[o.id].named);
  if (!m || m.id !== plan[d]) return `floor ${d} holds no ${plan[d]}`;
  const p = Game.player();
  m.hp = Math.floor(m.maxHp / 2); m.awake = true; m.spoke = true; m.rallies = 1; m.mendSaid = true;
  const at = roomBeside(ctx, m);
  p.x = m.x + at[0]; p.y = m.y + at[1];
  const keep = x => JSON.stringify({ id: x.id, uid: x.uid, hp: x.hp, maxHp: x.maxHp, rallies: x.rallies, spoke: x.spoke, mendSaid: x.mendSaid, x: x.x, y: x.y, edge: x.edge });
  const was = keep(m);
  if (!Game.save(true)) return 'save failed';
  // another run wipes the world; the load brings this one back
  Game.newGame({ name: 'Other', cls: 'mage', stats: Game.rollStats(), seed: 'elsewhere', opts: OPTS });
  if (!Game.load()) return 'load failed';
  const m2 = Game.level().monsters.find(o => MONSTERS[o.id].named);
  if (Game.state().depth !== d || !m2) return `loaded on floor ${Game.state().depth} with ${m2 ? m2.id : 'no champion'}`;
  if (keep(m2) !== was) return `saved ${was}, loaded ${keep(m2)}`;
  const bar = Game.renderState(0).fx.boss;
  if (!bar || !bar.named || bar.name !== `${MONSTERS[m2.id].named.called}, the ${MONSTERS[m2.id].name}`) return `after loading the bar is ${JSON.stringify(bar)}`;
  // and a champion saved on a floor not yet reached is still waiting there
  const later = Game.state().levels[Number(Object.keys(plan)[0])];
  return (later && later.monsters.some(o => o.id === plan[Object.keys(plan)[0]])) || 'the first champion\'s floor lost it';
});

await test('fire, cold and lightning: the weak take half as much again, the resistant half, and the first time says so', async () => {
  const out = [];
  // the same seeded roll against a plain goblin and against each kind, so the
  // only difference is what the kind takes from that element
  const hit = async (spellId, target, key) => {
    const ctx = await start('mage', 'el-' + key);
    const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
    p.level = 9; p.sp = p.maxSp = 999; p.talents = [];
    // Burning Hands reaches only the square ahead; a slime already split splits no further
    const m = ahead(ctx, target, spellId === 'burning_hands' ? 1 : 2, { hp: 5000, maxHp: 5000, nextAct: 1e12, spoke: true, split: true });
    seedDice(ctx, 'el-roll-' + key.split('/')[1]);
    const mark = markLog(G);
    G.t = p.nextAttack;
    Game.castSpell(SPELLS.mage.find(s => s.id === spellId));
    return { lost: 5000 - m.hp, said: linesSince(G, mark), ctx };
  };
  for (const [spell, target, f] of [['lightning', 'rustmaw', 1.5], ['lightning', 'slime', 0.5], ['cone_cold', 'skeleton', 0.5], ['cone_cold', 'basilisk', 1.5], ['burning_hands', 'zombie', 1.5], ['burning_hands', 'basilisk', 0.5], ['burning_hands', 'vessra', 1.5]]) {
    const base = await hit(spell, 'goblin', `${target}-base/${spell}`), got = await hit(spell, target, `${target}/${spell}`);
    const want = Math.max(1, Math.round(base.lost * f));
    if (got.lost !== want) out.push(`${spell} on a ${target}: ${got.lost}, want ${want} (a goblin took ${base.lost})`);
    const word = f > 1 ? /burns well|stiffens in the cold|lightning finds it/ : /shrugs off|barely feels|lightning run off/;
    if (!got.said.some(l => word.test(l))) out.push(`${spell} on a ${target} said nothing of it: ${got.said.join(' | ')}`);
    const kin = got.ctx.MONSTERS[target].named ? got.ctx.MONSTERS[target].named.kin : target;
    const el = { lightning: 'lightning', cone_cold: 'cold', burning_hands: 'fire' }[spell];
    const rec = got.ctx.Game.bestiary()[kin];
    if (!rec || !rec.el || rec.el[el] !== (f > 1 ? 'weak' : 'resist')) out.push(`the bestiary did not note what ${el} does to a ${kin}: ${JSON.stringify(rec)}`);
  }
  // a goblin takes lightning as a blow: nothing said
  const plain = await hit('lightning', 'goblin', 'goblin-plain/lightning');
  if (plain.said.some(l => /lightning finds it|lightning run off/.test(l))) out.push('a goblin was said to be weak or resistant');
  return out.length ? out.join('; ') : true;
});

await test('a scroll of fire burns a zombie well, and a Ring of Warmth halves a wraith\'s cold touch', async () => {
  const out = [];
  const burn = async target => {
    const ctx = await start('fighter', 'el-scroll');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const m = ahead(ctx, target, 2, { hp: 5000, maxHp: 5000, nextAct: 1e12, spoke: true });
    const it = { t: 'scroll_fire', q: 1, e: 0 }; p.inv.push(it); G.known.scroll_fire = 1;
    seedDice(ctx, 'el-scroll-roll');
    Game.useItem(it);
    return 5000 - m.hp;
  };
  const g = await burn('goblin'), z = await burn('zombie');
  if (z !== Math.max(1, Math.round(g * 1.5))) out.push(`a fireball took ${g} from a goblin and ${z} from a zombie`);
  const touch = async warm => {
    const ctx = await start('fighter', 'el-warm');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.effects.ac = { amount: -60, until: 1e12 };
    if (warm) { const r = { t: 'ring_warmth', q: 1, e: 0 }; p.inv.push(r); Game.equip(r, true); }
    seedDice(ctx, 'el-warm-roll');
    const m = beside(ctx, 'wraith', { hp: 999, maxHp: 999, spoke: true });
    let taken = 0;
    for (let i = 0; i < 30; i++) { const hp = p.hp; m.windup = { kind: 'melee', at: G.t, until: G.t }; m.nextAct = G.t; Game.update(G.t + 25, 25); taken += hp - p.hp; Game.update(G.t + 3000, 3000); p.hp = 9999; }
    return taken;
  };
  const cold = await touch(false), warm = await touch(true);
  if (!(warm < cold * 0.65 && warm > cold * 0.35)) out.push(`a wraith's touch took ${cold} bare and ${warm} with the ring`);
  return out.length ? out.join('; ') : true;
});
};
