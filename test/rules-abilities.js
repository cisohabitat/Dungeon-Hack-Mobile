// Rule checks for gear dropped and taken, the lunger and the lich's reach, Bash, Smoke and Shield Slam, the trader's forge, Self-Taught, a quality of make and relic pairs.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function abilitiesChecks(h) {
  const { start, markLog, linesSince, test, wearRelic, beside, shift, run, talent } = h;

await test('what you drop stays down when you walk back over it, and the Take row lifts it', async () => {
  const ctx = await start('fighter', 'drop-stays');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  const club = { t: 'club', q: 1, e: 0 }; p.inv.push(club);
  Game.dropItem(club);
  const x0 = p.x, y0 = p.y;
  // step off to any open side and back
  for (let turn = 0; turn < 4 && p.x === x0 && p.y === y0; turn++) { Game.input('forward'); run(Game, G, 400); if (p.x === x0 && p.y === y0) { Game.input('right'); run(Game, G, 300); } }
  if (p.x === x0 && p.y === y0) return 'could not step off the square';
  Game.input('back'); run(Game, G, 400);
  if (p.x !== x0 || p.y !== y0) return 'could not step back onto the square';
  if (p.inv.some(it => it.t === 'club')) return 'walking back over the dropped club picked it up';
  if (!Game.floorItems().includes(club)) return 'the club was not on the floor';
  Game.input('take'); run(Game, G, 100);
  const held = p.inv.find(it => it.t === 'club');
  if (!held || Game.floorItems().length) return 'the Take row did not lift the club';
  return held.left === undefined || 'the club kept its dropped mark in the pack';
});

await test('walking over gear your class cannot use leaves it for the Take row, and the trader buys it all in one go', async () => {
  const ctx = await start('mage', 'junk-walk');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  for (let i = 0; i < 4; i++) { const [dx, dy] = Dungeon.DIRS[p.dir]; if (L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.FLOOR) break; Game.input('right'); run(Game, G, 300); }
  const [dx, dy] = Dungeon.DIRS[p.dir], tx = p.x + dx, ty = p.y + dy;
  L.items[`${tx},${ty}`] = [{ t: 'scale', q: 1, e: 0 }, { t: 'dagger', q: 1, e: 0 }, { t: 'shield', q: 1, e: 0 }];
  const mark = markLog(G);
  Game.input('forward'); run(Game, G, 400);
  if (p.x !== tx || p.y !== ty) return 'could not step onto the pile';
  const out = [];
  if (!p.inv.some(it => it.t === 'dagger')) out.push('the dagger a mage can use was not picked up');
  if (p.inv.some(it => it.t === 'scale' || it.t === 'shield')) out.push('gear a mage cannot use was picked up by walking over it');
  const said = linesSince(G, mark).filter(l => /no use to a mage/.test(l));
  if (said.length !== 1) out.push(`the log said ${said.length} times what was left`);
  Game.input('back'); run(Game, G, 400); Game.input('forward'); run(Game, G, 400);
  if (linesSince(G, mark).filter(l => /no use to a mage/.test(l)).length !== 1) out.push('stepping back on said it again');
  Game.input('take'); run(Game, G, 100);
  if (!p.inv.some(it => it.t === 'scale') || !p.inv.some(it => it.t === 'shield')) out.push('the Take row did not lift what was left');
  if (Game.junkInPack().length !== 2) out.push(`the pack held ${Game.junkInPack().length} pieces of junk, not 2`);
  // now a trader, and one tap for the lot
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }] };
  L.npcs.length = 0; L.npcs.push(shop);
  const [ex, ey] = Dungeon.DIRS[p.dir]; shop.x = p.x + ex; shop.y = p.y + ey;
  if (L.tiles[shop.y * L.w + shop.x] !== Dungeon.T.FLOOR) { L.tiles[shop.y * L.w + shop.x] = Dungeon.T.FLOOR; }
  Game.input('forward');
  if (!Game.currentShop()) return out.concat('could not open the shop').join('; ');
  const want = Game.junkInPack().reduce((n, it) => n + Game.sellPrice(it), 0), g0 = p.gold;
  const got = Game.sellJunk();
  if (got !== want || p.gold !== g0 + want) out.push(`selling the junk paid ${p.gold - g0} (said ${got}), wanted ${want}`);
  if (Game.junkInPack().length || !p.inv.some(it => it.t === 'dagger')) out.push('selling the junk left junk, or sold the dagger');
  return out.length ? out.join('; ') : true;
});

await test('a lunger follows a step straight back, but a step aside leaves it biting air; others swing at the air', async () => {
  const out = [];
  const trial = async (id, how) => {
    const ctx = await start('fighter', `lunge-${id}-${how}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999;
    const m = beside(ctx, id, { nextAct: G.t });
    for (let i = 0; i < 40 && !m.windup; i++) Game.update(G.t + 25, 25);
    if (!m.windup || m.windup.move) return { err: `the ${id} drew back ${JSON.stringify(m.windup)}` };
    const at = [m.x, m.y], was = [p.x, p.y];
    shift(ctx, how);
    const mark = markLog(G);
    // until the blow comes down, whatever the monster's beat
    for (let i = 0; i < 60 && !linesSince(G, mark).some(l => l.includes(ctx.MONSTERS[id].name)); i++) Game.update(G.t + 25, 25);
    const said = linesSince(G, mark).join(' | ');
    return { moved: m.x !== at[0] || m.y !== at[1], into: m.x === was[0] && m.y === was[1], said };
  };
  const back = await trial('ghoul', 'back');
  if (back.err) return back.err;
  if (!back.into) out.push(`a ghoul did not lunge into the square left (${back.said})`);
  if (!/Ghoul lunges after you/.test(back.said)) out.push(`a ghoul's lunge said: ${back.said}`);
  const side = await trial('ghoul', 'side');
  if (side.moved || !/swings at the air/.test(side.said)) out.push(`a ghoul followed a step aside: ${side.said}`);
  const gob = await trial('goblin', 'back');
  if (gob.err) return gob.err;
  if (gob.moved || !/swings at the air/.test(gob.said)) out.push(`a goblin followed a step back: ${gob.said}`);
  return out.length ? out.join('; ') : true;
});

await test('the lich\'s touch reaches two squares down a straight line, not round a step aside', async () => {
  const out = [];
  for (const how of ['back', 'side']) {
    const ctx = await start('fighter', `reach-${how}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 9999; p.stats.dex = 3;
    const m = beside(ctx, 'lich', { nextAct: G.t, blows: 0, spoke: true });
    for (let i = 0; i < 40 && !(m.windup && !m.windup.move); i++) { m.blows = 0; Game.update(G.t + 25, 25); }
    if (!m.windup || m.windup.move) return `the lich drew back ${JSON.stringify(m.windup)}`;
    shift(ctx, how);
    const mark = markLog(G);
    for (let i = 0; i < 60 && !linesSince(G, mark).some(l => /Lich/.test(l)); i++) Game.update(G.t + 25, 25);
    const said = linesSince(G, mark).join(' | ');
    if (how === 'back' && !/Lich reaches across (and touches you|for you and misses)/.test(said)) out.push(`a step back escaped the lich: ${said}`);
    if (how === 'side' && !/swings at the air/.test(said)) out.push(`the lich reached round a step aside: ${said}`);
  }
  return out.length ? out.join('; ') : true;
});

await test('a cunning fighter never draws back the same way twice; a plain one keeps its beat', async () => {
  const lengths = async id => {
    const ctx = await start('fighter', `beat-${id}`);
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 99999;
    const m = beside(ctx, id, { nextAct: G.t });
    const seen = new Set(); let last = null;
    for (let i = 0; i < 2000 && seen.size < 12; i++) {
      Game.update(G.t + 25, 25);
      if (m.windup && !m.windup.move && m.windup !== last) { last = m.windup; seen.add(m.windup.until - m.windup.at); }
      if (!m.windup) last = null;
    }
    return [...seen];
  };
  const gob = await lengths('goblin'), zom = await lengths('zombie');
  if (gob.length < 3) return `a goblin drew back only ${gob.join(', ')}ms`;
  return zom.length <= 2 || `a zombie drew back ${zom.join(', ')}ms`;
});

await test('a fighter\'s Bash breaks the blow being drawn back and staggers the foe; it comes back after a while', async () => {
  const out = [];
  const bashOnce = async path => {
    const ctx = await start('fighter', 'bash-' + (path || 'plain'));
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    p.hp = p.maxHp = 999; if (path) p.path = path;
    const m = beside(ctx, 'goblin', { nextAct: G.t });
    for (let i = 0; i < 40 && !m.windup; i++) Game.update(G.t + 25, 25);
    if (!m.windup) return { err: 'no wind-up to break' };
    const hp0 = m.hp, t0 = G.t;
    const ok = Game.useAbility();
    return { ok, broke: !m.windup, stagger: m.nextAct - t0, open: !!(p.opening && p.opening.uid === m.uid), hurt: hp0 - m.hp, label: Game.castLabel(), again: Game.useAbility(), Game };
  };
  const plain = await bashOnce(null);
  if (plain.err) return plain.err;
  if (!plain.ok || !plain.broke) out.push('Bash did not break the wind-up');
  if (plain.stagger < 750) out.push(`a shield bash staggered only ${plain.stagger}ms`);
  if (plain.hurt) out.push('a plain Bash did damage');
  if (!/^Bash \d+s$/.test(plain.label)) out.push(`after a Bash the button says ${plain.label}`);
  if (plain.again !== false) out.push('Bash could be used again at once');
  const knight = await bashOnce('knight');
  if (knight.stagger < plain.stagger + 600) out.push(`a Knight's bash staggered ${knight.stagger}ms against ${plain.stagger}`);
  const zerk = await bashOnce('berserker');
  if (!(zerk.hurt > 0)) out.push('a Berserker\'s bash did no damage');
  // nothing in front: refused, and not spent
  const ctx = await start('fighter', 'bash-air');
  ctx.Game.level().monsters.length = 0;
  if (ctx.Game.useAbility() !== false || ctx.Game.castLabel() !== 'Bash') out.push('a bash at nothing was spent');
  return out.length ? out.join('; ') : true;
});

await test('a thief\'s Smoke makes everything close lose them, asleep to them until it clears; the lich sees through it', async () => {
  const out = [];
  const ctx = await start('thief', 'smoke');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const m = beside(ctx, 'goblin', { nextAct: G.t + 1e9 });
  // one already drawing back is committed: its blow still comes
  const swinging = { ...m, uid: 92, x: m.x, y: m.y, windup: { kind: 'melee', at: G.t, until: G.t + 500 } };
  const far = { ...m, uid: 91, x: -99, y: -99, awake: true };
  L.monsters.push(far);
  L.monsters.push(swinging);
  if (!Game.useAbility()) return 'Smoke was refused';
  if (!swinging.awake || !swinging.windup) out.push('a blow already drawn back was stopped by the smoke');
  L.monsters.splice(L.monsters.indexOf(swinging), 1);
  if (m.awake || m.windup) out.push('the goblin beside the thief still saw them');
  if (!far.awake) out.push('a monster far off lost the thief too');
  run(Game, G, 2500);
  if (m.awake) out.push('the goblin woke inside the smoke');
  // a blow on it now is a strike from the shadows
  let mark = markLog(G);
  p.perkHit = 60;   // the blow lands: a miss would wake it, as it should (but a 1 always misses: try again;
  // and a 20 is told as a mighty blow, not a strike from the shadows, though it is both: again)
  for (let tries = 0; tries < 4; tries++) {
    if (tries) { m.awake = false; m.windup = null; m.hp = m.maxHp; }
    mark = markLog(G);
    G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
    if (!linesSince(G, mark).some(l => /You miss|A mighty blow/.test(l))) break;
  }
  if (!linesSince(G, mark).some(l => /from the shadows/.test(l))) out.push(`no strike from the shadows: ${linesSince(G, mark).join(' | ')}`);
  if (Game.castLabel() === 'Smoke') out.push('Smoke came back at once');
  // and the lich is not fooled
  const c2 = await start('thief', 'smoke-lich');
  const lich = beside(c2, 'lich', { spoke: true });
  const t0 = c2.Game.state().t;
  c2.Game.useAbility();
  if (!lich.awake) out.push('the lich lost the thief in smoke');
  // though it is stalled most of two seconds, where another boss only loses its aim a moment
  if (!(lich.nextAct - t0 >= 1700)) out.push(`smoke stalled the lich ${lich.nextAct - t0}ms`);
  // and what it was drawing back falls apart in the smoke; its rite does not
  lich.windup = { kind: 'melee', move: 'nova', at: t0, until: t0 + 900 }; c2.Game.player().abilityReady = 0;
  c2.Game.useAbility();
  if (lich.windup) out.push('the lich\'s nova came on through the smoke');
  const t1 = c2.Game.state().t;
  lich.windup = { kind: 'melee', move: 'rite', at: t1, until: t1 + 2400 }; lich.nextAct = t1 + 2400; c2.Game.player().abilityReady = 0;
  c2.Game.useAbility();
  if (!lich.windup || lich.windup.move !== 'rite') out.push('smoke broke off the lich\'s rite');
  if (lich.nextAct !== t1 + 2400) out.push(`smoke held the lich's rite back ${lich.nextAct - t1 - 2400}ms`);
  const c3 = await start('thief', 'smoke-forged');
  const forged = beside(c3, 'heartforged', { nextAct: 0 });
  const t3 = c3.Game.state().t;
  c3.Game.useAbility();
  if (!(forged.nextAct - t3 < 1000)) out.push(`smoke stalled the Heartforged ${forged.nextAct - t3}ms, as long as the lich`);
  // and a thief sets out with two healing draughts, as a ranger does
  if (c3.Game.player().inv.filter(it => it.t === 'potion_heal').reduce((a, it) => a + (it.q || 1), 0) !== 2) out.push('a thief did not set out with two healing draughts');
  return out.length ? out.join('; ') : true;
});

await test('Shield Slam brings Bash back in ten seconds and knocks the foe a square back; Choking Cloud leaves what loses a thief coughing', async () => {
  const out = [];
  const ctx = await start('fighter', 'shield-slam');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999; talent(ctx, 'shield_slam');
  const [dx, dy] = Dungeon.DIRS[p.dir];
  // clear the two squares ahead so there is room to be knocked into
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const m = beside(ctx, 'goblin', { nextAct: G.t });
  const x0 = m.x, y0 = m.y;
  if (!Game.useAbility()) return 'Bash was refused';
  if (m.x !== x0 + dx || m.y !== y0 + dy) out.push(`the goblin stayed at ${m.x},${m.y}, not knocked to ${x0 + dx},${y0 + dy}`);
  if (m.nextAct - G.t < 1700) out.push(`a slammed goblin moves again in ${m.nextAct - G.t}ms`);
  // it starts to slide back when the shield lands, not as the arm begins to move
  if (!(m.moveT0 >= Game.renderState(0).fx.bashAt + 100)) out.push(`the slide began at ${m.moveT0 - Game.renderState(0).fx.bashAt}ms into the bash`);
  const secs = +(Game.castLabel().match(/\d+/) || [0])[0];
  if (!(secs > 0 && secs <= 10)) out.push(`after a Shield Slam the button says ${Game.castLabel()}`);
  // against a wall it still bashes, and stays put
  const c2 = await start('fighter', 'shield-slam-wall');
  const p2 = c2.Game.player(), L2 = c2.Game.level(); talent(c2, 'shield_slam');
  const [ex, ey] = c2.Dungeon.DIRS[p2.dir];
  L2.tiles[(p2.y + ey) * L2.w + p2.x + ex] = c2.Dungeon.T.FLOOR;
  L2.tiles[(p2.y + ey * 2) * L2.w + p2.x + ex * 2] = c2.Dungeon.T.WALL;
  const w = beside(c2, 'goblin', { nextAct: c2.Game.state().t + 1e9 });
  const wx = w.x;
  if (!c2.Game.useAbility() || w.x !== wx) out.push('a slam into a wall moved the goblin or was refused');
  // Choking Cloud: the first move after the smoke clears comes late
  const wakeDelay = async cough => {
    const c = await start('thief', 'cough-' + cough);
    const { Game: g } = c; const q = g.player(), s = g.state();
    q.hp = q.maxHp = 999; if (cough) talent(c, 'choking_cloud');
    const f = beside(c, 'skeleton', { nextAct: s.t + 1e9 });
    g.useAbility();
    for (let i = 0; i < 400 && !f.awake; i++) g.update(s.t + 25, 25);
    return f.awake ? f.nextAct - s.t : null;
  };
  const plain = await wakeDelay(false), coughing = await wakeDelay(true);
  if (plain == null || coughing == null) out.push(`the goblin never woke after the smoke (${plain}, ${coughing})`);
  else if (coughing < plain + 1200) out.push(`a coughing goblin moved ${coughing}ms after waking against ${plain}`);
  return out.length ? out.join('; ') : true;
});

await test('the trader\'s forge adds a quality of make to plain known gear, from the second floor down, for gold', async () => {
  const out = [];
  const ctx = await start('fighter', 'make');
  const { Game, Dungeon } = ctx;
  const p = Game.player(), L = Game.level(), G = Game.state();
  const shop = { id: 'merchant', x: 0, y: 0, markup: 2, stock: [] };
  L.npcs.length = 0; L.npcs.push(shop); L.monsters.length = 0;
  const [dx, dy] = Dungeon.DIRS[p.dir]; shop.x = p.x + dx; shop.y = p.y + dy;
  Game.input('forward');
  if (!Game.currentShop()) return 'could not open the shop';
  const svc = id => Game.shopServices().find(v => v.id === id);
  const w = p.eq.weapon; w.h = 0; delete w.px; delete w.u; delete w.curse;
  // (a plain Charisma: rolled high, the trader's warmth took the price under the floor this checks)
  p.gold = 99999; p.stats.cha = 10;
  if (!svc('make_weapon') || !svc('make_weapon').why) out.push('the forge worked on the first floor');
  Game.closeShop ? Game.closeShop() : null;
  Game.level().monsters.length = 0; Game.descend();
  if (G.depth !== 2) return `descended to depth ${G.depth}`;
  { const L2 = Game.level(); L2.npcs.length = 0; L2.npcs.push(shop); L2.monsters.length = 0;
    const [ex, ey] = Dungeon.DIRS[p.dir]; shop.x = p.x + ex; shop.y = p.y + ey;
    L2.tiles[shop.y * L2.w + shop.x] = Dungeon.T.FLOOR; Game.input('forward');
    if (!Game.currentShop()) return 'could not open the shop on the second floor'; }
  const s = svc('make_weapon');
  if (!s || s.why) return `the make was refused: ${JSON.stringify(s)}`;
  if (s.price < 100) out.push(`a make on the second floor cost only ${s.price}`);
  w.h = 1; if (!svc('make_weapon').why) out.push('the forge worked an unknown blade'); w.h = 0;
  w.curse = 1; if (!svc('make_weapon').why) out.push('the forge worked cursed metal'); delete w.curse;
  w.u = 'x'; if (!svc('make_weapon').why) out.push('the forge worked a relic'); delete w.u;
  const gold = p.gold;
  Game.buyService('make_weapon');
  if (w.px !== s.px) out.push(`the weapon is ${w.px}, not ${s.px}`);
  if (gold - p.gold !== s.price) out.push(`paid ${gold - p.gold}, asked ${s.price}`);
  if (!svc('make_weapon').why) out.push('a second make was offered on the same blade');
  if (p.eq.armor) { p.eq.armor.h = 0; delete p.eq.armor.px; const a = svc('make_armor'); if (!a || a.why) out.push(`armour make refused: ${a && a.why}`); }
  return out.length ? out.join('; ') : true;
});

await test('smoke leaves no stale mark: a sleeper it never woke, and a foe that lost the thief, do not bar rest once it has cleared', async () => {
  const out = [];
  const ctx = await start('thief', 'smoke-stale');
  const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = 3; p.maxHp = 999; p.bg = 'deepborn';
  // a sleeper three squares off, which never knew the thief was there
  const [dx, dy] = Dungeon.DIRS[p.dir];
  for (const k of [1, 2, 3]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
  const m = beside(ctx, 'goblin', { awake: false, nextAct: G.t + 1e9 });
  m.x = p.x + dx * 3; m.y = p.y + dy * 3;
  if (Game.restLabel() === 'Foes near') out.push('the sleeper barred rest before any smoke');
  Game.useAbility();
  if (m.smoked) out.push('a sleeper the smoke never woke was marked as lost in it');
  // an awake foe that loses the thief bars rest now, and not half a minute later
  const c2 = await start('thief', 'smoke-stale2');
  const q = c2.Game.player(), s2 = c2.Game.state(); q.hp = 3; q.maxHp = 999;
  const f = beside(c2, 'goblin', { nextAct: s2.t + 1e9 });
  c2.Game.useAbility();
  if (c2.Game.restLabel() !== 'Foes near') out.push(`beside a foe lost in the smoke the Rest button said ${c2.Game.restLabel()}`);
  // struck awake later, it settles again: half a minute on, asleep beside the thief, it is no more a bar than any sleeper
  f.awake = true; s2.t += 30000; f.awake = false;
  if (c2.Game.restLabel() === 'Foes near') out.push('half a minute after the smoke, a sleeping foe it once hid from still barred rest');
  return out.length ? out.join('; ') : true;
});

await test('Self-Taught gives any one score two points at most over the run', async () => {
  const ctx = await start('fighter', 'spread-cap');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  const str = p.stats.str;
  G.pendingBoons = [['spread', 'vigor', 'keen'], ['spread', 'vigor', 'keen']]; G.pendingLevels = [3, 5];
  if (!Game.chooseBoon('spread', ['str', 'str'])) return 'the first Self-Taught was refused';
  if (Game.chooseBoon('spread', ['str', 'dex']) !== false) return 'a third point went to Strength';
  if (p.stats.str !== str + 2) return `Strength went from ${str} to ${p.stats.str}`;
  return Game.chooseBoon('spread', ['dex', 'con']) === true || 'the second Self-Taught was refused elsewhere';
});

await test('Self-Taught takes only real scores', async () => {
  const ctx = await start('fighter', 'spread-guard');
  const { Game } = ctx; const G = Game.state(), p = Game.player();
  G.pendingBoons = [['spread', 'vigor', 'keen']]; G.pendingLevels = [3];
  if (Game.chooseBoon('spread', ['toString', 'str']) !== false) return 'a point went to toString';
  if (Object.prototype.hasOwnProperty.call(p.stats, 'toString')) return 'the hero has a toString score';
  return Game.chooseBoon('spread', ['str', 'str']) === true || 'two points on Strength were refused';
});

await test('a quality of make goes in front of the name once known, and does what it says', async () => {
  const out = [];
  const ctx = await start('fighter', 'prefix');
  const { Game } = ctx; const p = Game.player();
  const hidden = { t: 'mace', q: 1, e: 1, h: 1, px: 'heavy' };
  if (/Heavy/.test(Game.itemName(hidden))) out.push('a hidden quality showed in the name');
  const known = { ...hidden, h: 0 };
  if (Game.itemName(known) !== 'Heavy Mace +1') out.push(`named ${Game.itemName(known)}`);
  // sturdy armour: one more armour class; true weapon: one more to hit
  Game.unequip('armor');
  const ac0 = Game.playerAC();
  const plain = { t: 'chain', q: 1, e: 0 }; p.inv.push(plain); Game.equip(plain, true);
  const acPlain = Game.playerAC();
  Game.unequip('armor');
  const sturdy = { t: 'chain', q: 1, e: 0, px: 'sturdy' }; p.inv.push(sturdy); Game.equip(sturdy, true);
  if (Game.playerAC() !== acPlain + 1) out.push(`sturdy chain gave ${Game.playerAC() - ac0} armour, plain ${acPlain - ac0}`);
  const hit0 = Game.toHit();
  const w = p.eq.weapon; w.px = 'true';
  if (Game.toHit() !== hit0 + 1) out.push('a True weapon did not add to hit');
  w.px = 'heavy';
  const rateHeavy = Game.blowRate(w); w.px = ''; const ratePlain = Game.blowRate(w);
  if (!(rateHeavy > ratePlain)) out.push('a Heavy weapon did not raise the damage estimate');
  // found ones turn up from the third floor, never shown before they are known
  let found = 0;
  for (let i = 0; i < 6; i++) {
    const c2 = await start('fighter', 'prefix-find' + i);
    for (let d = 1; d <= 7; d++) {
      if (d > 1) { c2.Game.level().monsters.length = 0; c2.Game.descend(); }
      for (const it of Object.values(c2.Game.level().items).flat()) if (it.px) { found++; if (d < 3) out.push(`a ${it.px} piece on floor ${d}`); if (!it.h) out.push('a found quality was not hidden'); }
    }
  }
  if (!found) out.push('no quality of make turned up in six dungeons');
  return out.length ? out.join('; ') : true;
});

await test('a relic pair worn together does more: the Stairwarden\'s Arms add armour, the Nightwalk a strike from the shadows', async () => {
  const out = [];
  const ctx = await start('fighter', 'relic-set');
  const { Game } = ctx;
  Game.unequip('armor'); Game.unequip('shield');
  wearRelic(ctx, 'rustwarden');
  const one = Game.playerAC();
  const bulwark = wearRelic(ctx, 'kests_bulwark');
  const both = Game.playerAC();
  const shieldAc = ctx.ITEMS[bulwark.t].ac + bulwark.e;
  if (both !== one + shieldAc + 2) out.push(`both pieces gave ${both - one}, the shield alone is worth ${shieldAc}`);
  const t = await start('thief', 'relic-set-t');
  const before = t.Game.sneakMult();
  t.Game.unequip('armor');
  wearRelic(t, 'shadowskin');
  if (t.Game.sneakMult() !== before) out.push('half the Nightwalk added to the strike from the shadows');
  wearRelic(t, 'whisper');
  if (t.Game.sneakMult() !== before + 1) out.push(`the Nightwalk made the strike ${t.Game.sneakMult()}, not ${before + 1}`);
  return out.length ? out.join('; ') : true;
});
};
