// Rule checks for the price of rest.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function restChecks(h) {
  const { OPTS, evenStats, newContext, start, seedDice, markLog, linesSince, test, beside } = h;

// ---------- the price of rest ----------
await test('the first rest on a floor restores two thirds; the next a third, and the button says so', async () => {
  const ctx = await start('fighter', 'rest-decay');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  p.maxHp = 100; p.hp = 10; p.food = 100;
  if (Game.restLabel() !== 'Rest \u2154') return `before any rest the button says ${Game.restLabel()}`;
  if (!Game.rest()) return 'could not rest';
  if (p.hp !== 77) return `the first rest left ${p.hp} of 100`;
  if (Game.restLabel() !== 'Rest \u2153') return `after one rest the button says ${Game.restLabel()}`;
  L.monsters.length = 0; p.hp = 10;
  Game.rest();
  const second = p.hp - 10;
  // a third, or a sixth if something found the sleeper
  if (second !== 34 && second !== 17) return `the second rest gave ${second}`;
  return true;
});

await test('out of a fight, wounds close on their own only up to half the hero\'s life', async () => {
  const ctx = await start('fighter', 'regen-cap');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  L.monsters.length = 0;
  p.maxHp = 100; p.hp = 10; p.food = 100; p.lastHurt = -1e9;
  for (let i = 0; i < 4000; i++) Game.update(G.t + 50, 50);
  return p.hp === 50 || `walking healed to ${p.hp} of 100`;
});

await test('a floor rested on again and again grows restless: something finds the sleeper', async () => {
  const ctx = await start('fighter', 'rest-ambush');
  const { Game } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
  let found = 0;
  for (let i = 0; i < 20; i++) {
    L.monsters.length = 0; p.hp = 1; p.food = 100;
    L.rests = 1 + (i % 2);                 // a second or third rest on the floor, where the dark stirs
    const mark = markLog(G);
    Game.rest();
    if (linesSince(G, mark).some(l => /something moving in the dark/.test(l))) {
      found++;
      if (!L.monsters.some(m => m.awake)) return 'the sleeper was found by nothing';
    }
  }
  if (!found) return 'twenty rests on one floor and nothing ever came';
  return found < 20 || 'every later rest was found';
});

await test('after three rests on a floor there is no more sleep to be had there, until the next floor', async () => {
  const ctx = await start('fighter', 'rest-cap');
  const { Game } = ctx; const p = Game.player(), L = Game.level();
  for (let i = 0; i < 3; i++) { L.monsters.length = 0; p.hp = 1; p.food = 100; if (!Game.rest()) return `rest ${i + 1} was refused`; }
  L.monsters.length = 0; p.hp = 1;
  if (Game.rest()) return 'a fourth rest was allowed';
  return Game.restLabel() === 'No rest' || `the button says ${Game.restLabel()}`;
});

await test('on the Long Delve on Hard, from the seventh floor, spells, a cleric\'s blows and a fighter\'s strike harder; nowhere else', async () => {
  const out = [];
  // the same darts, the same dice, cast on floor 9 of three kinds of run
  const dart = async (cls, levels, difficulty, depth = 9) => {
    const ctx = await newContext();
    const { Game } = ctx;
    Game.newGame({ name: 'D', cls, bg: 'oathbroken', stats: { ...evenStats, int: 16, wis: 16 }, seed: 'deep-magic', opts: { ...OPTS, levels, difficulty } });
    const p = Game.player(), G = Game.state();
    while (G.depth < Math.min(depth, levels)) { Game.level().monsters.length = 0; Game.descend(); }
    p.level = 9; p.sp = p.maxSp = 99; p.hp = p.maxHp = 999;
    const m = beside(ctx, 'ogre', { hp: 9999, maxHp: 9999 });
    seedDice(ctx, 'deep-magic');
    if (cls === 'mage') { if (!Game.castSpell(Game.knownSpells().find(s => s.id === 'magic_missile'))) return -1; }
    else for (let i = 0; i < 6; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }   // six swings, the same dice each run: a miss or two cannot hide it
    return 9999 - m.hp;
  };
  const deep = await dart('mage', 12, 'hard'), normal = await dart('mage', 12, 'normal'), short = await dart('mage', 8, 'hard'), shallow = await dart('mage', 12, 'hard', 6);
  if (!(normal > 0) || Math.abs(deep - Math.round(normal * 1.18)) > 1) out.push(`darts on floor 9: ${deep} on Hard against ${normal} on Normal (wanted about ${Math.round(normal * 1.18)})`);
  if (short !== normal) out.push(`an eight-floor Hard run's darts did ${short}, not ${normal}`);
  if (shallow !== normal) out.push(`floor 6 of the Long Delve on Hard did ${shallow}, not ${normal}`);
  // a cleric's blow too, and a fighter's (a little less), but not a thief's
  const cHard = await dart('cleric', 12, 'hard'), cNormal = await dart('cleric', 12, 'normal');
  if (!(cNormal > 0) || cHard <= cNormal) out.push(`a cleric's blow on floor 9: ${cHard} on Hard, ${cNormal} on Normal`);
  const fHard = await dart('fighter', 12, 'hard'), fNormal = await dart('fighter', 12, 'normal');
  if (!(fNormal > 0) || fHard <= fNormal) out.push(`a fighter's blow on floor 9: ${fHard} on Hard, ${fNormal} on Normal`);
  const tHard = await dart('thief', 12, 'hard'), tNormal = await dart('thief', 12, 'normal');
  if (tHard !== tNormal) out.push(`a thief's blow changed with the deep: ${tHard} against ${tNormal}`);
  return out.length ? out.join('; ') : true;
});
};
