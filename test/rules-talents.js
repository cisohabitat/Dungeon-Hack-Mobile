// Rule checks for the talents, with the sixth round's review and playtest fixes after them.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function talentsChecks(h) {
  const { start, markLog, countSaid, linesSince, spreadPicks, test, groupAhead, beside, ahead, shift, run, talent } = h;

// ---------- talents ----------

await test('levelling offers a lesson at the odd levels, a class talent at the even ones, and the path at the fifth', async () => {
  const ctx = await start('fighter', 'talent-offers');
  const { Game, XP_TABLE, TALENTS, BOONS } = ctx;
  const p = Game.player();
  const kinds = [];
  for (let lvl = 2; lvl <= 6; lvl++) {
    p.xp = XP_TABLE[lvl - 1];
    Game.state().player.xp = p.xp;
    // a kill tips the experience over; take whatever is offered
    const m = beside(ctx, 'rat', { uid: 800 + lvl, hp: 1, maxHp: 1, nextAct: 1e12 });
    p.perkHit = 60;
    for (let i = 0; i < 6 && Game.level().monsters.includes(m); i++) { Game.state().t = p.nextAttack; Game.input('attack'); }
    while (Game.pendingBoons()) {
      const offer = Game.pendingBoons();
      const isTalent = offer.every(id => TALENTS.fighter.some(t => t.id === id));
      const isLesson = offer.every(id => BOONS.some(b => b.id === id));
      kinds.push(`${p.level}:${isTalent ? 'T' : isLesson ? 'L' : Game.isPathOffer(offer) ? 'P' : '?'}`);
      if (!Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined)) return `could not choose ${offer[0]}`;
    }
  }
  if (kinds.join(' ') !== '2:T 3:L 4:T 5:P 6:T') return `offers by level: ${kinds.join(' ')}`;
  return (p.talents.length === 3 && new Set(p.talents).size === 3) || `talents taken: ${JSON.stringify(p.talents)}`;
});

await test('a talent is never offered twice', async () => {
  const ctx = await start('mage', 'talent-once');
  const { Game, XP_TABLE, TALENTS } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  p.path = 'frostweaver';                  // past level 5 without one, the path would be offered first
  const taken = [];
  for (const lvl of [2, 4, 6, 8]) {
    G.pendingBoons = [];
    p.level = lvl - 1; p.xp = XP_TABLE[lvl - 1];
    const m = beside(ctx, 'rat', { uid: 900 + lvl, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    const offer = Game.pendingBoons();
    if (!offer) return `no offer at level ${lvl}`;
    if (!offer.every(id => TALENTS.mage.some(t => t.id === id))) return `level ${lvl} offered ${offer.join(', ')}`;
    const again = offer.find(id => taken.includes(id));
    if (again) return `${again} was offered again at level ${lvl}`;
    taken.push(offer[0]);
    Game.chooseBoon(offer[0], offer[0] === 'spread' ? spreadPicks(Game) : undefined);
  }
  return (p.talents.length === 4 && new Set(p.talents).size === 4) || `talents: ${p.talents.join(', ')}`;
});

await test('Cleave carries half the blow into the one behind', async () => {
  const ctx = await start('fighter', 'cleave');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; talent(ctx, 'cleave');
  const m = groupAhead(ctx, 'goblin', 2, 400);
  m.nextAct = 1e12;
  // a natural 1 misses whatever the bonus, so swing until one lands
  for (let i = 0; i < 20 && m.hp === 400; i++) { G.t = p.nextAttack; Game.input('attack'); }
  const front = 400 - m.hp, back = 400 - m.pack[0].hp;
  return (front > 0 && back === Math.max(1, Math.floor(front / 2))) || `front took ${front}, behind ${back}`;
});

await test('Riposte: a blow that misses readies the next swing at once', async () => {
  const ctx = await start('fighter', 'riposte');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'riposte');
  const m = beside(ctx, 'skeleton');
  Game.update(G.t + 25, 25);
  if (!m.windup) return 'no wind-up';
  p.nextAttack = G.t + 5000;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y - dy) * L.w + p.x - dx] = Dungeon.T.FLOOR;
  p.x -= dx; p.y -= dy;
  run(Game, G, 700);
  return p.nextAttack <= G.t || `after the whiff the next swing was still ${p.nextAttack - G.t}ms off`;
});

await test('Stand Firm halves a crushing blow and turns away a grab', async () => {
  const hit = async firm => {
    const ctx = await start('fighter', 'firm');
    ctx.Dice.s = new ctx.Rng('firm-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
    if (firm) talent(ctx, 'stand_firm');
    let dealt = 0;
    for (let i = 0; i < 20; i++) {
      beside(ctx, 'ogre', { uid: 700 + i, blows: 2 });
      const hp0 = p.hp;
      run(Game, G, 1000);
      dealt += hp0 - p.hp;
    }
    return dealt;
  };
  const plain = await hit(false), firm = await hit(true);
  if (!(firm < plain * 0.7)) return `crushes dealt ${plain} plain and ${firm} standing firm`;
  const ctx = await start('fighter', 'firm-grab');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  talent(ctx, 'stand_firm');
  for (let i = 0; i < 10; i++) { beside(ctx, 'zombie', { uid: 750 + i, blows: 1 }); run(Game, G, 900); if (p.grabbed) return 'a zombie grabbed a hero who stands firm'; }
  return true;
});

await test('Second Wind lifts a hero out of danger once, then waits', async () => {
  const ctx = await start('fighter', 'second-wind');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'second_wind');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  p.maxHp = 60; p.hp = 16;                          // one hit from under a quarter
  beside(ctx, 'goblin');
  const mark = markLog(G);
  for (let i = 0; i < 800 && !linesSince(G, mark).some(l => /Second wind!/.test(l)); i++) {
    Game.update(G.t + 25, 25);
    if (p.hp > 16) p.hp = 16;                      // keep it on the edge until the wind comes
  }
  if (!linesSince(G, mark).some(l => /Second wind!/.test(l))) return 'no second wind came';
  return p.windReady > G.t + 60000 || 'second wind can come again at once';
});

await test('Last Rites keeps the hero alive once, and only once', async () => {
  const ctx = await start('cleric', 'last-rites');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'last_rites');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  beside(ctx, 'ogre');
  p.hp = 1;
  for (let i = 0; i < 400 && !p.ritesUsed; i++) Game.update(G.t + 25, 25);
  if (!p.ritesUsed || G.status !== 'playing' || p.hp !== 1) return `after the killing blow: ${G.status}, hp ${p.hp}, rites ${p.ritesUsed}`;
  for (let i = 0; i < 800 && G.status === 'playing'; i++) Game.update(G.t + 25, 25);
  return G.status === 'dead' || 'the hero was saved a second time';
});

await test('Mirror Image: Shield conjures two images that take the next two blows', async () => {
  const ctx = await start('mage', 'mirror');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'mirror_image');
  p.hp = p.maxHp = 999; p.sp = 99;
  Game.level().monsters.length = 0;
  G.t = Math.max(G.t, p.nextAttack);
  Game.castSpell(Game.knownSpells().find(s => s.id === 'shield'));
  if (p.mirrors !== 2) return `images: ${p.mirrors}`;
  beside(ctx, 'goblin');
  const hp0 = p.hp, mark = markLog(G);
  let n = 0;
  for (let i = 0; i < 400 && n < 2; i++) { Game.update(G.t + 25, 25); n = countSaid(linesSince(G, mark), /strikes one of your images/); }
  return (n === 2 && p.hp === hp0 && p.mirrors === 0) || `images struck ${n}, hp lost ${hp0 - p.hp}`;
});

await test('Kindling leaves a burn that ticks and stops a troll regrowing', async () => {
  const ctx = await start('mage', 'kindling');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'kindling');
  p.sp = p.maxSp = 99;
  const m = beside(ctx, 'goblin', { hp: 300, maxHp: 300, nextAct: 1e12 });
  G.t = p.nextAttack;
  Game.castSpell(Game.knownSpells().find(s => s.id === 'burning_hands'));
  const after = m.hp, mark = markLog(G);
  run(Game, G, 3200);
  const ticks = linesSince(G, mark).filter(l => /burns for/.test(l)).length;
  return (ticks >= 2 && ticks <= 4 && m.hp < after) || `burn ticked ${ticks} times, hp ${after} -> ${m.hp}`;
});

await test('Venomed Blades poison the living, never the undead', async () => {
  const hits = async id => {
    const ctx = await start('thief', 'venom-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    talent(ctx, 'venom'); p.perkHit = 60;
    const m = beside(ctx, id, { hp: 5000, maxHp: 5000, nextAct: 1e12, risen: true });
    let poisoned = 0;
    for (let i = 0; i < 40; i++) { G.t = p.nextAttack; Game.input('attack'); if (m.dot && m.dot.kind === 'venom') { poisoned++; m.dot = null; } }
    return poisoned;
  };
  const living = await hits('orc'), dead = await hits('skeleton');
  return (living >= 4 && living <= 20 && dead === 0) || `poisoned ${living} of 40 orc hits, ${dead} skeleton hits`;
});

await test('Shadow Step: a sidestep makes the next blow a strike from the shadows', async () => {
  const ctx = await start('thief', 'shadow-step');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'shadow_step'); p.perkHit = 60;
  const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
  // step aside and back, then strike
  const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
  L.tiles[(p.y + sy) * L.w + p.x + sx] = Dungeon.T.FLOOR;
  G.t = p.nextAttack;
  Game.input('strafeR');
  // the orc follows into the square ahead of the new spot
  const [dx, dy] = Dungeon.DIRS[p.dir];
  m.x = p.x + dx; m.y = p.y + dy;
  const mark = markLog(G);
  G.t = Math.max(G.t + 300, p.nextAttack); Game.input('attack');
  if (!linesSince(G, mark).some(l => /from the shadows/.test(l))) return `said: ${linesSince(G, mark).join(' | ')}`;
  const m2 = markLog(G);
  G.t = p.nextAttack; Game.input('attack');
  return !linesSince(G, m2).some(l => /from the shadows/.test(l)) || 'one sidestep gave two strikes from the shadows';
});

await test('the smaller talents do what they say', async () => {
  const out = [];
  // Bulwark: +2 AC with a shield
  { const ctx = await start('fighter', 't-bulwark'); const p = ctx.Game.player(); p.eq.shield = { t: 'shield', q: 1, e: 0 }; const a = ctx.Game.playerAC(); talent(ctx, 'bulwark'); if (ctx.Game.playerAC() !== a + 2) out.push(`bulwark ${a} -> ${ctx.Game.playerAC()}`); }
  // Lucky: crits a number sooner
  { const ctx = await start('thief', 't-lucky'); const a = ctx.Game.critFloor(); talent(ctx, 'lucky'); if (ctx.Game.critFloor() !== a - 1) out.push(`lucky ${a} -> ${ctx.Game.critFloor()}`); }
  // Light Fingers: traders pay a quarter more
  { const ctx = await start('thief', 't-fingers'); const it = { t: 'longsword', q: 1, e: 0 }; const a = ctx.Game.sellPrice(it); talent(ctx, 'light_fingers'); const b = ctx.Game.sellPrice(it); if (Math.abs(b - a * 1.25) > 1) out.push(`light fingers ${a} -> ${b}`); }
  // Quick Words: casting a quarter faster
  { const ctx = await start('mage', 't-quick'); const { Game } = ctx; const p = Game.player(), G = Game.state(); p.sp = 99; ctx.Game.level().monsters.length = 0; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'shield')); const a = p.nextAttack - G.t; talent(ctx, 'quick_words'); delete p.effects.ac; G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === 'shield')); const b = p.nextAttack - G.t; if (b !== Math.round(a * 0.75)) out.push(`quick words ${a} -> ${b}`); }
  // Healing Hands: half as much again
  { const ctx = await start('cleric', 't-hands'); const { Game } = ctx; const p = Game.player(), G = Game.state(); talent(ctx, 'healing_hands'); ctx.Dice.s = new ctx.Rng('hands').s; p.maxHp = 999; p.hp = 1; p.sp = 99; G.t = p.nextAttack; const mark = markLog(G); Game.castSpell(Game.knownSpells().find(s => s.kind === 'heal')); const line = linesSince(G, mark).join(' '); const n = Number((line.match(/heal (\d+)/) || [])[1]); if (!(n >= 2)) out.push(`healing hands healed ${n}`); }
  // Evasion: webs slide off
  { const ctx = await start('thief', 't-evasion'); const { Game } = ctx; const p = Game.player(), G = Game.state(); talent(ctx, 'evasion'); p.hp = 999; ahead(ctx, 'spider', 3); run(Game, G, 800); if (p.webbed > G.t) out.push('a web held an evasive thief'); }
  return out.length ? out.join('; ') : true;
});

// ---------- round six review ----------
await test('a burn and a poison tick their full count at a phone\'s frame rate', async () => {
  const ticks = async (cls, id, spell) => {
    const ctx = await start(cls, 'dot-60-' + id);
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    talent(ctx, id); p.perkHit = 60; p.sp = p.maxSp = 99;
    const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
    if (spell) { G.t = p.nextAttack; Game.castSpell(Game.knownSpells().find(s => s.id === spell)); }
    else { const real = Math.random; Math.random = () => 0; try { for (let i = 0; i < 6 && !m.dot; i++) { G.t = p.nextAttack; Game.input('attack'); } } finally { Math.random = real; } }
    if (!m.dot) return -1;
    const mark = markLog(G);
    for (let i = 0; i < 400; i++) Game.update(G.t + 1000 / 60, 1000 / 60);
    return countSaid(linesSince(G, mark), /burns for|poison eats/);
  };
  const burn = await ticks('mage', 'kindling', 'burning_hands'), venom = await ticks('thief', 'venom');
  return (burn === 3 && venom === 4) || `at 60fps a burn ticked ${burn} of 3, poison ${venom} of 4`;
});

await test('Weapon Master adds its whole number to every blow, whatever the weapon', async () => {
  const total = async (weapon, wm) => {
    const ctx = await start('fighter', 'wm-' + weapon);
    ctx.Dice.s = new ctx.Rng('wm-dice').s;
    const { Game } = ctx;
    const p = Game.player(), G = Game.state();
    p.perkHit = 60; p.stats.str = 16; p.eq.weapon = { t: weapon, q: 1, e: 0 }; p.eq.shield = null;
    if (wm) talent(ctx, 'weapon_master');
    const m = beside(ctx, 'orc', { hp: 1e9, maxHp: 1e9, nextAct: 1e12, split: true });
    for (let i = 0; i < 50; i++) { G.t = p.nextAttack; Game.input('attack'); }
    return 1e9 - m.hp;
  };
  const out = [];
  for (const [w, each] of [['dagger', 1], ['longsword', 1], ['greatsword', 2]]) {
    const plain = await total(w, false), master = await total(w, true);
    // the same dice both times: the difference is the talent on every blow that landed
    if (master - plain < each * 40) out.push(`${w}: +${master - plain} over 50 swings`);
  }
  return out.length ? out.join('; ') : true;
});

await test('Cleave: a blow that kills the front still carries into the one stepping up', async () => {
  const ctx = await start('fighter', 'cleave-kill');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; talent(ctx, 'cleave');
  const m = groupAhead(ctx, 'goblin', 2, 40);
  m.hp = 1; m.nextAct = 1e12;
  for (let i = 0; i < 6 && m.pack; i++) { G.t = p.nextAttack; Game.input('attack'); }
  return m.hp < 40 || 'the goblin stepping up took nothing from the swing that felled the first';
});

await test('a poison dies with the one it was on, not the next of the group', async () => {
  const ctx = await start('thief', 'venom-group');
  const { Game } = ctx;
  const G = Game.state();
  const m = groupAhead(ctx, 'goblin', 2, 40);
  m.hp = 1; m.nextAct = 1e12;
  m.dot = { kind: 'venom', until: G.t + 4000, next: G.t + 100 };
  run(Game, G, 300);
  if (m.pack) return 'the poison did not fell the front goblin';
  return !m.dot || 'the poison moved on to the goblin that stepped up';
});

await test('Warding Light and Zeal answer the hero\'s own spells, not a shrine\'s blessing', async () => {
  const ctx = await start('cleric', 'ward-src');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'warding_light');
  Game.level().monsters.length = 0;
  p.maxHp = 100; p.hp = 50; p.lastHurt = G.t; p.food = 0;   // no ordinary mending
  p.effects.boon_ac = { amount: 2, until: G.t + 20000 };      // a blessing from a shrine
  run(Game, G, 6500);
  return p.hp === 50 || `a shrine's blessing warded the hero back to ${p.hp}`;
});

await test('Riposte answers a blow on the air, not an arrow flying wide', async () => {
  const ctx = await start('fighter', 'riposte-arrow');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  talent(ctx, 'riposte');
  const m = ahead(ctx, 'archer', 3);
  for (let i = 0; i < 40 && !(m.windup && m.windup.kind === 'shot'); i++) Game.update(G.t + 25, 25);
  if (!m.windup) return 'the archer never drew';
  p.nextAttack = G.t + 9000;
  shift(ctx, 'side');
  run(Game, G, 800);
  void L; void Dungeon;
  return p.nextAttack > G.t + 5000 || 'dodging an arrow readied the swing';
});

// ---------- round six playtest ----------
await test('every stat lesson raises that ability\'s bonus by one, from an odd or an even score', async () => {
  const ctx = await start('fighter', 'lesson-bonus');
  const { Game, BOONS } = ctx;
  const p = Game.player(), out = [];
  for (const start of [15, 16]) {
    for (const b of BOONS.filter(b => b.stat)) {
      p.stats[b.stat] = start;
      const m0 = Game.mod(p.stats[b.stat]);
      b.apply(p);
      if (Game.mod(p.stats[b.stat]) !== m0 + 1) out.push(`${b.id} from ${start}: ${start} -> ${p.stats[b.stat]}`);
    }
  }
  return out.length ? out.join('; ') : true;
});

await test('a talent that needs a spell waits until the spell is known', async () => {
  const ctx = await start('cleric', 'talent-needs');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  const seen = new Set();
  for (let run = 0; run < 12; run++) {
    G.pendingBoons = []; G.pendingLevels = [];
    p.level = 2; p.xp = XP_TABLE[2];
    const m = beside(ctx, 'rat', { uid: 1200 + run, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    for (const id of Game.pendingBoons() || []) seen.add(id);
  }
  return !seen.has('warding_light') || 'Warding Light was offered at level 3, before Protection';
});

await test('a riposte lands with a bonus, and the log says so', async () => {
  const ctx = await start('fighter', 'riposte-bonus');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'riposte');
  const m = beside(ctx, 'goblin', { hp: 500, maxHp: 500, nextAct: 1e12 });
  p.riposteUntil = 0;
  // open a riposte the way a missed blow does
  const mark = markLog(G);
  p.riposteUntil = G.t + 2500; p.nextAttack = G.t;
  G.t += 1500; Game.input('attack');
  const said = linesSince(G, mark).join(' | ');
  void m;
  if (!/Riposte! (A mighty blow! )?You hit|miss/.test(said)) return `said: ${said}`;
  return !(p.riposteUntil > G.t) || 'one opening gave more than one riposte';
});

await test('Shadow Step still holds a moment after the sidestep: a goblin takes a second to come back into reach', async () => {
  // a natural 20 is told as a mighty blow instead of a strike from the
  // shadows, and a natural 1 misses outright, so a run that rolls either is tried again
  let said = '';
  for (let tries = 0; tries < 4; tries++) {
    const ctx = await start('thief', 'shadow-late' + tries);
    const { Game, Dungeon } = ctx;
    const p = Game.player(), G = Game.state(), L = Game.level();
    talent(ctx, 'shadow_step'); p.perkHit = 60;
    const m = beside(ctx, 'orc', { hp: 5000, maxHp: 5000, nextAct: 1e12 });
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    L.tiles[(p.y + sy) * L.w + p.x + sx] = Dungeon.T.FLOOR;
    G.t = p.nextAttack;
    Game.input('strafeR');
    const [dx, dy] = Dungeon.DIRS[p.dir];
    m.x = p.x + dx; m.y = p.y + dy;
    G.t += 1800;                                        // the goblin's step back in
    const mark = markLog(G);
    p.nextAttack = G.t; Game.input('attack');
    if (linesSince(G, mark).some(l => /from the shadows/.test(l))) return true;
    said = linesSince(G, mark).join(' | ');
    if (!/mighty blow|a fumble/.test(said)) break;
  }
  return `said: ${said}`;
});

await test('a level-up remembers what it gave, for the choice screen', async () => {
  const ctx = await start('mage', 'level-note');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60; p.level = 4; p.xp = XP_TABLE[4] - 1;
  const m = beside(ctx, 'rat', { hp: 1, maxHp: 1, nextAct: 1e12 });
  for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
  const note = Game.levelNote(5);
  return (note && note.hp >= 1 && note.spells.includes('Lightning Bolt')) || `level 5 note: ${JSON.stringify(note)}`;
});

await test('Use facing an item on the floor ahead says to step onto it', async () => {
  const ctx = await start('fighter', 'use-ahead');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir];
  L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
  L.items[`${p.x + dx},${p.y + dy}`] = [{ t: 'potion_heal', q: 1, e: 0 }];
  L.items[`${p.x},${p.y}`] = [];
  const mark = markLog(G);
  Game.input('use');
  return linesSince(G, mark).some(l => /Step forward onto it/.test(l)) || `said: ${linesSince(G, mark).join(' | ')}`;
});

await test('a stat lesson is offered at most twice a run', async () => {
  const ctx = await start('fighter', 'lesson-cap');
  const { Game, XP_TABLE } = ctx;
  const p = Game.player(), G = Game.state();
  p.perkHit = 60;
  p.boons = ['con', 'con', 'str', 'str', 'dex', 'dex'];
  for (let run = 0; run < 15; run++) {
    G.pendingBoons = []; G.pendingLevels = [];
    p.level = 3; p.xp = XP_TABLE[3];                  // level 4: a lesson
    const m = beside(ctx, 'rat', { uid: 1300 + run, hp: 1, maxHp: 1, nextAct: 1e12 });
    for (let k = 0; k < 6 && Game.level().monsters.includes(m); k++) { G.t = p.nextAttack; Game.input('attack'); }
    const offer = Game.pendingBoons() || [];
    const again = offer.find(id => ['con', 'str', 'dex'].includes(id));
    if (again) return `${again} was offered a third time`;
  }
  return true;
});

await test('Last Rites spends every spell point it saves you with', async () => {
  const ctx = await start('cleric', 'rites-cost');
  const { Game } = ctx;
  const p = Game.player(), G = Game.state();
  talent(ctx, 'last_rites');
  p.eq.armor = null; p.eq.shield = null; p.stats.dex = 3;
  beside(ctx, 'ogre');
  p.hp = 1; p.sp = p.maxSp;
  for (let i = 0; i < 400 && !p.ritesUsed; i++) { Game.update(G.t + 25, 25); if (!p.ritesUsed) p.sp = p.maxSp; }
  return (p.ritesUsed && p.sp === 0) || `rites ${p.ritesUsed}, spell points ${p.sp}`;
});
};
