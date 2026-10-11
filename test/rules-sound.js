// Rule checks for the sounds, and where they are played from.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function soundChecks(h) {
  const { start, test, beside, ahead, lichRoom, listenTo } = h;

// ---------- sound ----------
// Headless there is no audio, but Sound still tells a listener what it would
// have played and from where, so the placing of a sound can be checked here.

await test('a draught sounds its cork and swallows at once and its heal once it is down; a scroll is heard being read', async () => {
  const ctx = await start('fighter', 'use-sounds');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  Game.level().monsters.length = 0;
  p.hp = 1;
  const potion = { t: 'potion_heal', q: 1, e: 0 }; p.inv.push(potion); G.known.potion_heal = 1;
  const out = [];
  const now = await listenTo(ctx, () => Game.useItem(potion));
  if (!now.some(s => s.name === 'drink')) out.push('no cork and swallow');
  if (now.some(s => s.name === 'heal')) out.push('the heal was heard before the draught was down');
  const later = await listenTo(ctx, () => new Promise(r => setTimeout(r, 500)));
  if (!later.some(s => s.name === 'heal')) out.push('the heal was never heard');
  const scroll = { t: 'scroll_map', q: 1, e: 0 }; p.inv.push(scroll); G.known.scroll_map = 1;
  const read = await listenTo(ctx, () => Game.useItem(scroll));
  if (!read.some(s => s.name === 'read' && s.kind === 'map')) out.push(`the scroll was not heard read: ${read.map(s => s.name).join(',')}`);
  return out.length ? out.join('; ') : true;
});

await test('a blow drawn back on the hero\'s left is heard on the left, a far one quieter, and one out of hearing not at all', async () => {
  const ctx = await start('fighter', 'sound-left');
  const { Game, Dungeon, Sound } = ctx;
  const p = Game.player(), G = Game.state(), L = Game.level();
  p.hp = p.maxHp = 999;
  const [lx, ly] = Dungeon.DIRS[(p.dir + 3) % 4];
  L.tiles[(p.y + ly) * L.w + p.x + lx] = Dungeon.T.FLOOR;
  L.monsters.length = 0;
  L.monsters.push({ uid: 91, id: 'goblin', x: p.x + lx, y: p.y + ly, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  const near = await listenTo(ctx, () => Game.update(G.t + 25, 25));
  const w = near.find(s => s.name === 'windup');
  if (!w) return `no wind-up was heard: ${near.map(s => s.name).join(', ')}`;
  if (!(w.pan < 0)) return `a wind-up on the left played at pan ${w.pan}`;
  // an archer drawing on the hero from four squares ahead: dead centre, and quieter
  const a = ahead(ctx, 'archer', 4);
  // (stone about it but on the hero's side, so it draws where it stands rather than stepping back first)
  for (const [ex, ey] of Dungeon.DIRS) if (a.x + ex !== p.x + Dungeon.DIRS[p.dir][0] * 3 || a.y + ey !== p.y + Dungeon.DIRS[p.dir][1] * 3) L.tiles[(a.y + ey) * L.w + a.x + ex] = Dungeon.T.WALL;
  // (it may take a moment over spotting the hero before it draws)
  const far = await listenTo(ctx, () => { for (let i = 0; i < 80 && !a.windup; i++) Game.update(G.t + 25, 25); });
  const fw = far.find(s => s.name === 'windup');
  if (!fw) return `the archer's draw was not heard: ${far.map(s => s.name).join(', ')}`;
  if (!(fw.gain < w.gain)) return `four squares off played at ${fw.gain}, beside at ${w.gain}`;
  if (Math.abs(fw.pan) > 0.01 || fw.behind) return `a shot from dead ahead played at pan ${fw.pan}${fw.behind ? ', behind' : ''}`;
  // out of hearing: not played at all
  const gone = await listenTo(ctx, () => Sound.play('voice', { dist: 40, pan: 0, who: 'orc' }));
  return gone.length === 0 || 'a voice forty squares off was played';
});

await test('a crushed skeleton dies with a rattle of bone, a goblin with blood, and each blow sounds like its weapon', async () => {
  const ctx = await start('cleric', 'sound-bones');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.perkHit = 60;                                 // every blow lands
  p.eq.weapon = { t: 'mace', q: 1, e: 0 };        // crushed bones stay down
  const swingUntilGone = m => { for (let i = 0; i < 40 && Game.level().monsters.includes(m); i++) { G.t = p.nextAttack; Game.input('attack'); } };
  const sk = beside(ctx, 'skeleton', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const bones = await listenTo(ctx, () => swingUntilGone(sk));
  const death = bones.find(s => s.name === 'death'), hit = bones.find(s => s.name === 'hit');
  if (!death || death.gore !== 'bone') return `the skeleton died as ${JSON.stringify(death)}`;
  if (!hit || hit.w !== 'mace' || hit.gore !== 'bone') return `the blow on it was heard as ${JSON.stringify(hit)}`;
  p.eq.weapon = null;
  const gob = beside(ctx, 'goblin', { hp: 1, maxHp: 1, nextAct: 1e12 });
  const blood = await listenTo(ctx, () => swingUntilGone(gob));
  const gd = blood.find(s => s.name === 'death'), gh = blood.find(s => s.name === 'hit');
  if (!gd || gd.gore !== 'blood') return `the goblin died as ${JSON.stringify(gd)}`;
  return (gh && gh.w === 'fists') || `a bare fist was heard as ${JSON.stringify(gh)}`;
});

await test('the lich\'s rite is a held tone that breaks with a crack; spells each have their own sound', async () => {
  const ctx = await start('fighter', 'sound-rite');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.perkHit = 60;
  const { m } = lichRoom(ctx, { phase: 2, hp: 60, riteReady: 0, nextAct: G.t, awake: true });
  const begun = await listenTo(ctx, () => { for (let i = 0; i < 40 && !(m.windup && m.windup.move === 'rite'); i++) Game.update(G.t + 25, 25); });
  const rite = begun.find(s => s.name === 'rite');
  if (!rite || !(rite.ms > 1000)) return `the rite began as ${JSON.stringify(rite)}`;
  const broken = await listenTo(ctx, () => { for (let i = 0; i < 20 && m.windup && m.windup.move === 'rite'; i++) { G.t = p.nextAttack; Game.input('attack'); } });
  if (!broken.some(s => s.name === 'riteBroken')) return `breaking it sounded: ${broken.map(s => s.name).join(', ')}`;
  // a mage's Shield and a cleric's Bless are told apart by ear
  const cast = [];
  for (const [cls, id] of [['mage', 'shield'], ['cleric', 'bless']]) {
    const w = await start(cls, 'sound-spells');
    const wp = w.Game.player();
    wp.sp = wp.maxSp = 99;
    const sp = w.Game.knownSpells().find(s => s.id === id);
    cast.push(...(await listenTo(w, () => w.Game.castSpell(sp))).filter(s => s.name === 'cast').map(s => s.spell));
  }
  return cast.join() === 'shield,bless' || `cast sounded as ${cast.join()}`;
});

await test('a sound never moves the dice or calls Math.random', async () => {
  const ctx = await start('fighter', 'sound-dice');
  const { Sound, Dice } = ctx;
  const s0 = Dice.s, rand = Math.random;
  let called = 0;
  Math.random = () => { called++; return rand(); };
  try {
    for (const n of ['hit', 'voice', 'death', 'windup', 'cast', 'rite', 'riteBroken', 'ward', 'dread', 'lichfall']) Sound.play(n, { dist: 2, pan: 0.5, who: 'orc', gore: 'blood', spell: 'lightning', ms: 500 });
    Sound.setAmbience(1, 3); Sound.heartbeat(0.1, 1e9); Sound.stopAmbience();
  } finally { Math.random = rand; }
  return (Dice.s === s0 && !called) || `dice ${s0} -> ${Dice.s}, Math.random called ${called} times`;
});
};
