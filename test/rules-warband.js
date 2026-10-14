// Rule checks for a warband: a marked champion with others of its kind about it,
// who wake with it and scatter when it falls (dungeon.js, foes.js, combat.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function warbandChecks(h) {
  const { start, markLog, linesSince, test, beside } = h;
  const OPTS8 = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true, difficulty: 'normal' };

await test('now and then a floor from the second down holds a warband: a marked champion with two or three of its kind close about it, never on the first floor', async () => {
  const { Dungeon } = await start('fighter', 'warband-deal');
  const out = [];
  let floors = 0, bands = 0;
  for (let i = 0; i < 40; i++) for (let depth = 1; depth <= 6; depth++) {
    const L = Dungeon.generate(`band-${i}`, depth, OPTS8);
    floors++;
    const leaders = L.monsters.filter(m => m.leader);
    if (depth === 1 && leaders.length) out.push('a warband on the first floor');
    for (const m of leaders) {
      bands++;
      if (!m.elite) out.push(`a leader with no mark on ${depth}`);
      const band = L.monsters.filter(o => o.follows === m.uid);
      if (band.length < 2 || band.length > 3) out.push(`a warband of ${band.length}`);
      if (band.some(o => o.id !== m.id)) out.push('a warband of mixed kinds');
      if (band.some(o => Math.max(Math.abs(o.x - m.x), Math.abs(o.y - m.y)) > 2)) out.push('one of a warband stood away from its leader');
    }
  }
  const share = bands / floors;
  if (share < 0.08 || share > 0.4) out.push(`warbands on ${(share * 100).toFixed(0)}% of floors`);
  // a sixteen-floor delve always has one on its second or third floor
  let missing = 0;
  for (let i = 0; i < 20; i++) {
    const a = Dungeon.generate(`long-band-${i}`, 2, { ...OPTS8, levels: 16 }), b = Dungeon.generate(`long-band-${i}`, 3, { ...OPTS8, levels: 16 });
    if (!a.monsters.some(m => m.leader) && !b.monsters.some(m => m.leader)) missing++;
  }
  if (missing) out.push(`${missing} of twenty sixteen-floor delves had no warband on their second or third floor`);
  return out.length ? out.join('; ') : true;
});

await test('a warband wakes with its leader, and when the leader falls the rest break and scatter', async () => {
  const out = [];
  const ctx = await start('fighter', 'warband-fall');
  const { Game } = ctx; const p = Game.player(), G = Game.state();
  p.hp = p.maxHp = 9999; p.stats.str = 30;
  const lead = beside(ctx, 'goblin', { elite: 'Rabid', leader: true, hp: 1, maxHp: 30, awake: false, nextAct: 1e12 });
  const L = Game.level();
  // two of its kind a little way off down the room, asleep
  const spots = [];
  for (let y = 1; y < L.h - 1 && spots.length < 2; y++) for (let x = 1; x < L.w - 1 && spots.length < 2; x++) {
    if (L.tiles[y * L.w + x] === ctx.Dungeon.T.FLOOR && Math.abs(x - p.x) + Math.abs(y - p.y) > 3 && !L.monsters.some(m => m.x === x && m.y === y)) spots.push([x, y]);
  }
  const band = spots.map(([x, y], k) => { const o = { uid: 300 + k, id: 'goblin', x, y, hp: 999, maxHp: 999, awake: false, follows: lead.uid, nextAct: G.t, rx: x, ry: y, fromX: x, fromY: y, moveT0: 0, moveT1: 0, flashUntil: 0 }; L.monsters.push(o); return o; });
  for (let i = 0; i < 20; i++) Game.update(G.t + 25, 25);
  if (band.some(o => o.awake)) out.push('the warband woke before its leader');
  lead.awake = true;
  // (each wakes at its own next turn, a beat or two on)
  for (let i = 0; i < 120; i++) { lead.awake = true; Game.update(G.t + 25, 25); }
  if (!band.every(o => o.awake)) out.push('the warband slept on with its leader awake');
  // the leader struck down
  const mark = markLog(G);
  for (let i = 0; i < 20 && L.monsters.includes(lead); i++) { p.nextAttack = 0; lead.nextAct = 1e12; Game.input('attack'); G.t += 1500; }
  if (L.monsters.includes(lead)) return 'the leader never fell';
  const said = linesSince(G, mark).join(' | ');
  if (!band.every(o => o.fleeing)) out.push(`its warband stood: ${said}`);
  if (!/breaks and scatters/.test(said)) out.push(`nothing said of the scattering: ${said}`);
  return out.length ? out.join('; ') : true;
});
};
