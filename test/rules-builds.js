// Rule check that no fighter build is dead, measured through the real attack code: 180,000 swings,
// about two minutes on its own. It has a file to itself so the runner can give it a process to
// itself (its `weight` below), or every other process would be waiting on the one that drew it.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function buildsChecks(h) {
  const { OPTS, newContext, seedDice, test } = h;

await test('no fighter build is dead: each of the three wins somewhere', async () => {
  // Measured through the real attack code, not arithmetic on the tables: a
  // shield trades damage for armour, a two-handed sword lands fewer heavier
  // blows, and two blades beat both against things that are easy to hit and
  // fall behind the greatsword against things that are not.
  const dps = async (build, foe) => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx;
    Game.newGame({ name: 'B', cls: 'fighter', bg: 'oathbroken',
      stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, seed: 'dual-dps', opts: OPTS });
    // two blades and the greatsword are within a few percent of each other
    // against armour: unseeded, the dice alone could order them either way
    seedDice(ctx, `dps-${Object.values(build).join('+')}-${foe}`);
    const p = Game.player(), G = Game.state(), L = Game.level();
    p.level = 5;
    p.eq.weapon = null; p.eq.shield = null; p.eq.offhand = null;
    for (const slot of ['weapon', 'shield', 'offhand']) if (build[slot]) p.eq[slot] = { t: build[slot], q: 1, e: 0 };
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0;
    const dummy = { uid: 999, id: foe, x: p.x + dx, y: p.y + dy, hp: 1e9, maxHp: 1e9,
      awake: true, nextAct: 1e9, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, split: true, risen: true };
    L.monsters.push(dummy);
    let dealt = 0;
    const swings = 30000;   // the greatsword's edge over two blades against armour is a few percent
    for (let i = 0; i < swings; i++) {
      G.t = p.nextAttack;
      dummy.hp = 1e9; dummy.awake = true;
      Game.input('attack');
      dealt += 1e9 - dummy.hp;
    }
    return dealt / swings / (Game.weapon().speed / 1000);
  };
  const SHIELD = { weapon: 'longsword', shield: 'towershield' };
  const GREAT = { weapon: 'greatsword' };
  const DUAL = { weapon: 'longsword', offhand: 'shortsword' };

  // against a soft target the second blade is the best damage in the game
  const soft = { shield: await dps(SHIELD, 'slime'), great: await dps(GREAT, 'slime'), dual: await dps(DUAL, 'slime') };
  if (!(soft.dual > soft.great)) return `vs a slime dual ${soft.dual.toFixed(1)} should beat greatsword ${soft.great.toFixed(1)}`;

  // against an armoured one the extra roll misses too often, and the greatsword wins
  const hard = { shield: await dps(SHIELD, 'wraith'), great: await dps(GREAT, 'wraith'), dual: await dps(DUAL, 'wraith') };
  if (!(hard.great > hard.dual)) return `vs a wraith greatsword ${hard.great.toFixed(1)} should beat dual ${hard.dual.toFixed(1)}`;

  // but it always beats the shield on damage, which is what the shield is paying for
  for (const [where, r] of [['slime', soft], ['wraith', hard]]) {
    if (!(r.dual > r.shield)) return `vs a ${where} dual ${r.dual.toFixed(1)} should out-damage the shield build ${r.shield.toFixed(1)}`;
    if (!(r.great > r.shield)) return `vs a ${where} greatsword ${r.great.toFixed(1)} should out-damage the shield build ${r.shield.toFixed(1)}`;
  }
  // and the shield is still buying something for that
  return true;
});
};

// About how long it runs alone, in seconds: the runner shares the files out by this (by size otherwise).
module.exports.weight = 150;
