// Rule checks for how the deep answers a strong hero: the floors' scaling.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function strengthChecks(h) {
  const { OPTS, evenStats, newContext, markLog, linesSince, test, goDown } = h;

// ---------- the deep answers strength ----------
await test('a hero ahead of the usual finds the next floor readier for them; one on pace finds it as it was', async () => {
  const floorOf = async (level, seed = 'press') => {
    const ctx = await newContext();
    const { Game } = ctx;
    Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    Game.player().level = level;
    // the deep stirs from the third floor down, not before
    Game.level().monsters.length = 0; goDown(ctx);
    Game.player().level = level;
    const mark = markLog(Game.state());
    Game.level().monsters.length = 0; goDown(ctx);
    const L = Game.level();
    return { press: L.press || 0, hp: L.monsters.reduce((n, m) => n + m.maxHp + (m.pack || []).reduce((a, b) => a + b.maxHp, 0), 0),
      champions: L.monsters.filter(m => m.elite).length, said: linesSince(Game.state(), mark) };
  };
  const onPace = await floorOf(3), ahead = await floorOf(6);
  if (onPace.press) return `a level 3 hero on floor 3 pressed ${onPace.press}`;
  if (!(ahead.press >= 2.5)) return `a level 6 hero on floor 3 pressed only ${ahead.press}`;
  // and never on the second floor, however quick the start
  { const c2 = await newContext(); c2.Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'press', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
    c2.Game.player().level = 6; goDown(c2);
    if (c2.Game.level().press) return `a level 6 hero on floor 2 was pressed ${c2.Game.level().press}`; }
  if (!(ahead.hp > onPace.hp * 1.3)) return `its creatures held ${ahead.hp} life against ${onPace.hp}`;
  // champions are a chance each, so count them over a few floors
  let more = 0, same = 0;
  for (const seed of ['press', 'press-b', 'press-c', 'press-d']) { more += (await floorOf(6, seed)).champions; same += (await floorOf(3, seed)).champions; }
  if (!(more > same)) return `${more} champions against ${same} over four floors`;
  if (!ahead.said.some(l => /The deep has heard of you/.test(l))) return 'the hero was not told';
  return true;
});

await test('difficulty: Hard is sturdier and surer with two rests a floor; Easy leaves more about and never presses; old runs are Normal', async () => {
  const floor = async (difficulty, level = 1, deeper = false) => {
    const ctx = await newContext();
    const { Game } = ctx;
    const opts = { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' };
    if (difficulty) opts.difficulty = difficulty;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts });
    Game.player().level = level;
    if (deeper) { Game.level().monsters.length = 0; goDown(ctx); Game.player().level = level; Game.level().monsters.length = 0; }
    goDown(ctx);
    const L = Game.level();
    const items = Object.values(L.items).reduce((n, list) => n + list.length, 0);
    return { ctx, L, hp: L.monsters.reduce((n, m) => n + m.maxHp, 0), items, hit: L.monsters.length ? Game.mstat(L.monsters[0]).hit : 0,
      base: L.monsters.length ? ctx.MONSTERS[L.monsters[0].id].hit + (L.monsters[0].elite ? (ctx.ELITES.find(e => e.prefix === L.monsters[0].elite).hit || 0) : 0) : 0 };
  };
  const easy = await floor('easy'), normal = await floor('normal'), hard = await floor('hard'), old = await floor(null);
  if (!(easy.hp < normal.hp && normal.hp < hard.hp)) return `life on the floor: easy ${easy.hp}, normal ${normal.hp}, hard ${hard.hp}`;
  if (old.hp !== normal.hp) return `a run with no difficulty held ${old.hp} life, Normal ${normal.hp}`;
  // on the second floor: Easy as drawn, Normal a step surer, and Hard too (its second step waits for the fourth)
  if (easy.hit !== easy.base || normal.hit !== normal.base + 1 || hard.hit !== hard.base + 1) return `to hit: easy ${easy.hit} (base ${easy.base}), normal ${normal.hit} (base ${normal.base}), hard ${hard.hit} (base ${hard.base})`;
  if (!(easy.items > normal.items)) return `items about: easy ${easy.items}, normal ${normal.items}`;
  // two rests on a Hard floor, three on Normal
  for (const [f, want] of [[hard, 2], [normal, 3]]) {
    const { Game } = f.ctx; const p = Game.player(), G = Game.state();
    p.food = 100;
    // anything a rest wakes is cleared away, so only the floor's limit stops the next
    for (let i = 0; i < 5; i++) { f.L.monsters.length = 0; p.hp = 1; G.t = Math.max(G.t + 60000, p.nextAttack); Game.input('rest'); }
    const rested = f.L.rests || 0;
    if (rested !== want) return `${want === 2 ? 'Hard' : 'Normal'} allowed ${rested} rests on a floor`;
  }
  // and on the first floor a step softer: Normal as drawn
  { const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal', difficulty: 'normal' } });
    const m = Game.level().monsters.find(x => !x.elite);
    if (m && Game.mstat(m).hit !== ctx.MONSTERS[m.id].hit) return `a ${m.id} on the first floor hits at +${Game.mstat(m).hit} on Normal`; }
  // and from the fourth floor Hard's creatures are two steps surer
  { const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'D', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'diff', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal', difficulty: 'hard' } });
    for (let i = 0; i < 3; i++) { Game.level().monsters.length = 0; goDown(ctx); }
    const m = Game.level().monsters.find(x => !x.elite);
    if (Game.state().depth !== 4) return `went down to ${Game.state().depth}`;
    if (m && Game.mstat(m).hit !== ctx.MONSTERS[m.id].hit + 2) return `a ${m.id} on Hard's fourth floor hits at +${Game.mstat(m).hit}, drawn at +${ctx.MONSTERS[m.id].hit}`; }
  // a strong hero on Easy is not pressed
  const strongEasy = await floor('easy', 7, true), strongNormal = await floor('normal', 7, true);
  if (strongEasy.L.press) return `Easy pressed a strong hero ${strongEasy.L.press}`;
  if (!strongNormal.L.press) return 'Normal did not press a strong hero';
  return true;
});

await test('on a readier floor its creatures hit surer and harder', async () => {
  const ctx = await newContext();
  const { Game, MONSTERS } = ctx;
  Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'press2', opts: { ...OPTS, levels: 8, size: 'medium', monsters: 'normal' } });
  Game.player().level = 6;
  goDown(ctx);
  const L = Game.level();
  const m = L.monsters.find(m => !m.elite);
  if (!m) return 'no plain monster to look at';
  const s = Game.mstat(m), b = MONSTERS[m.id];
  if (!(s.hit > b.hit && s.dmg[2] > b.dmg[2])) return `a ${m.id} hits at +${s.hit} for +${s.dmg[2]}, as ever`;
  return true;
});
};
