// Rule checks for a long delve's regions (REGIONS in dungeon.js): the drowned
// halls and the old smiths' forges, where they lie, how they are built and
// what twist each always is. Run from rules.js with its helpers lent in.
module.exports = async function regionChecks(h) {
  const { test, newContext, evenStats, OPTS } = h;

  await test('a long delve has the drowned halls and the old forges on floors no champion, people or road\'s first floor holds; a shorter one has neither', async () => {
    const out = [];
    const { Dungeon } = await newContext();
    const want = { 12: { drowned: 7, forge: 8 }, 16: { drowned: 9, forge: 13 } };
    for (const levels of [2, 4, 6, 8, 12, 16]) {
      const span = Dungeon.routeSpan(levels);
      for (let d = 1; d <= levels; d++) {
        const r = Dungeon.regionAt(levels, d), w = Object.keys(want[levels] || {}).find(k => want[levels][k] === d) || null;
        if (r !== w) { out.push(`${levels} floors, floor ${d}: ${r}, not ${w}`); continue; }
        if (!r) continue;
        if (Dungeon.peopleAt(levels, d)) out.push(`${levels} floors: the ${r} on a people's floor`);
        if (!span || d <= span.from - 1 || d === span.from || d > span.to) out.push(`${levels} floors: the ${r} on floor ${d}, off the road below its first floor`);
        for (let s = 0; s < 40; s++) if (Dungeon.namedPlan('region-' + s, levels, s % 2 ? 'crypts' : 'warrens')[d]) { out.push(`${levels} floors: a champion on the ${r}'s floor ${d}`); break; }
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('each region is built its own way, has its own walls, and is always its twist; no other floor of the delve is flooded or smoulders', async () => {
    const out = [];
    const { Dungeon, THEMES } = await newContext();
    const opts = { size: 'small', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    for (const levels of [12, 16]) for (let s = 0; s < 12; s++) {
      const seed = `regions-${levels}-${s}`, route = s % 2 ? 'crypts' : 'warrens', span = Dungeon.routeSpan(levels);
      const plan = Dungeon.twistPlan(seed, levels);
      for (const [r, def] of Object.entries(Dungeon.REGIONS)) {
        const d = def.at[levels];
        if (plan[d] !== def.twist) out.push(`${seed}: the ${r} planned ${plan[d]}`);
        const other = Object.keys(plan).filter(k => plan[k] === def.twist && Number(k) !== d);
        if (other.length) out.push(`${seed}: floors ${other} also ${def.twist}`);
        const L = Dungeon.generate(seed, d, { ...opts, levels, route });
        if (L.region !== r || L.twist !== def.twist || THEMES[L.theme].region !== r) out.push(`${seed} floor ${d}: region ${L.region}, twist ${L.twist}, walls ${THEMES[L.theme].name}`);
      }
      // the road's own first floor still shows the road's walls
      const first = Dungeon.generate(seed, span.from, { ...opts, levels, route });
      if (first.region || THEMES[first.theme].road !== route) out.push(`${seed}: the road's first floor is ${THEMES[first.theme].name}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the drowned halls hold the drowned, and the old forges emberlings and glowing cracks', async () => {
    const out = [];
    let drowned = 0, embers = 0, vents = 0;
    for (let s = 0; s < 6; s++) {
      const ctx = await newContext(); const { Game } = ctx;
      Game.newGame({ name: 'R', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'region-kin-' + s, opts: { ...OPTS, levels: 12, size: 'medium', monsters: 'normal' } });
      Game.testFloor(7);
      const a = Game.level();
      if (a.region !== 'drowned' || a.twist !== 'flooded') out.push(`region-kin-${s}: floor 7 is ${a.region}/${a.twist}`);
      drowned += a.monsters.filter(m => m.id === 'drowned').length;
      Game.testFloor(8);
      const b = Game.level();
      if (b.region !== 'forge' || b.twist !== 'smouldering') out.push(`region-kin-${s}: floor 8 is ${b.region}/${b.twist}`);
      embers += b.monsters.filter(m => m.id === 'emberling').length;
      vents += (b.vents || []).length;
    }
    if (!drowned) out.push('no drowned in six drowned halls');
    if (!embers) out.push('no emberlings in six forges');
    if (!vents) out.push('no glowing cracks in six forges');
    return out.length ? out.join('; ') : true;
  });
};
