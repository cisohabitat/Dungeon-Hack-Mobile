// Rule checks for the fixes the October 2026 review asked for (docs/REVIEW.md,
// ROADMAP.md Phase 6). Run from rules.js with its helpers lent in.
module.exports = async function reviewChecks(h) {
  const { test, newContext, evenStats, OPTS } = h;

  await test('the Use button says Search only at a dead end, never at every wall, and never by where the hidden door is (P8)', async () => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx, T = Dungeon.T;
    Game.newGame({ name: 'S', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'search-label', opts: OPTS });
    const p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    for (const k in L.items) delete L.items[k];
    const at = k => { const [dx, dy] = Dungeon.DIRS[(p.dir + k) % 4]; return (p.y + dy) * L.w + (p.x + dx); };
    const was = [L.tiles[at(0)], L.tiles[at(1)], L.tiles[at(3)]];
    L.tiles[at(0)] = T.WALL;
    // open to either side: a wall in a room or a corridor's side, not worth a search
    L.tiles[at(1)] = T.FLOOR; L.tiles[at(3)] = T.FLOOR;
    if (Game.useLabel() !== 'Use') return `a wall with floor to either side says "${Game.useLabel()}"`;
    // one side open: still not a dead end
    L.tiles[at(1)] = T.WALL;
    if (Game.useLabel() !== 'Use') return `a wall with one open side says "${Game.useLabel()}"`;
    // walled on both sides: a dead end, and the builders' favourite place for a door
    L.tiles[at(3)] = T.WALL;
    if (Game.useLabel() !== 'Search') return `a dead end says "${Game.useLabel()}"`;
    // and the hidden door itself reads no differently from the wall beside it, found or not
    L.tiles[at(0)] = T.SECRET;
    if (Game.useLabel() !== 'Search') return `a dead end ending in a hidden door says "${Game.useLabel()}"`;
    L.tiles[at(3)] = T.FLOOR;
    if (Game.useLabel() !== 'Use') return `a hidden door with an open side says "${Game.useLabel()}": the button gave it away`;
    [L.tiles[at(0)], L.tiles[at(1)], L.tiles[at(3)]] = was;
    return true;
  });

  await test('the nearest goals come nearest first: a kit a win away, a class one path from mastered, then what is shut, a feat, a rung (P11)', async () => {
    const ctx = await newContext();
    const { Progress, CLASSES, PATHS } = ctx;
    const blank = Progress.load();
    // nothing won and nothing reached: a floor to reach comes first, the stair, then the second champion, then the Heart
    if (Progress.nextGoals(blank, '', 1)[0].how !== 'Reach floor 3') return `a hero dead on floor 1 is told "${Progress.nextGoals(blank, '', 1)[0].how}"`;
    if (Progress.nextGoals(blank, '', 4)[0].how !== 'Reach floor 6') return `a hero dead on floor 4 is told "${Progress.nextGoals(blank, '', 4)[0].how}"`;
    if (Progress.nextGoals(blank, '', 7)[0].how !== 'Reach floor 8') return `a hero dead on floor 7 is told "${Progress.nextGoals(blank, '', 7)[0].how}"`;
    // nothing won but the bottom reached: the first thing shut is a kit, and three are named at most
    const fresh = Progress.nextGoals(blank);
    if (fresh.length !== 3) return `a new player is given ${fresh.length} goals`;
    if (!/^Win as a .* on Normal or Hard$/.test(fresh[0].how)) return `the first goal asks "${fresh[0].how}"`;
    // the class just played comes first, for its own kit
    const played = Progress.nextGoals(blank, 'mage');
    if (!played[0].what.includes(CLASSES.mage.altKit.name)) return `after a mage's run the first goal is "${played[0].what}"`;
    // a fighter who has won on Normal and with one path: mastery is one win away, and its kit is open
    const v = Progress.load();
    v.won.fighter = { normal: 1 };
    v.paths[PATHS.fighter[0].id] = 1;
    const near = Progress.nextGoals(v, 'fighter');
    if (near.some(g => g.what.includes(CLASSES.fighter.altKit.name))) return 'the fighter\'s kit, already open, is still a goal';
    if (near[0].what !== 'Fighter mastered' || !near[0].how.includes(PATHS.fighter[1].name)) return `the fighter's next goal is "${near[0].what}: ${near[0].how}"`;
    // a Hard win opens the ladder: the first rung is a goal once the vows and kits are done
    const v2 = Progress.load();
    for (const c of Object.keys(CLASSES)) { v2.won[c] = { normal: 1, hard: 1 }; for (const x of PATHS[c] || []) v2.paths[x.id] = 1; }
    for (const id of Object.keys(ctx.FEATS)) v2.feats[id] = 1;
    v2.combos = Array.from({ length: 12 }, (_, i) => 'c' + i); v2.relics = [];
    const far = Progress.nextGoals(v2, 'cleric');
    if (!far.some(g => /^Hard\+1 as a/.test(g.what))) return `with everything else won, the goals are ${far.map(g => g.what).join('; ')}`;
    return true;
  });

  await test('a third plain piece of gear the pack holds two of is left where it lies, said once; a better one, or a kind not yet carried, is taken (P13)', async () => {
    const ctx = await newContext();
    const { Game, Dungeon } = ctx;
    Game.newGame({ name: 'B', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'spare-bucklers', opts: OPTS });
    const p = Game.player(), L = Game.level(), G = Game.state();
    L.monsters.length = 0; L.traps = {};
    for (const k in L.items) delete L.items[k];
    p.inv = p.inv.filter(it => it.t !== 'buckler');
    const ahead = () => { const [dx, dy] = Dungeon.DIRS[p.dir]; return [p.x + dx, p.y + dy]; };
    // two bucklers on the floor: both taken; a third left, with a line; a fine one still taken
    const step = items => {
      const [x, y] = ahead();
      L.tiles[y * L.w + x] = Dungeon.T.FLOOR;
      L.items[`${x},${y}`] = items.map(it => ({ ...it }));
      // (a step takes its time: the next is refused until the last has landed)
      Game.update(G.t + 800, 800);
      const seq = G.logSeq;
      Game.input('forward');
      return G.log.slice(-(G.logSeq - seq)).map(e => e.m).join(' | ');
    };
    const bare = { t: 'buckler', q: 1, e: 0 };
    step([bare, bare]);
    if (p.inv.filter(it => it.t === 'buckler').length !== 2) return `two bucklers walked over, the pack holds ${p.inv.filter(it => it.t === 'buckler').length}`;
    const said = step([bare]);
    if (p.inv.filter(it => it.t === 'buckler').length !== 2) return 'a third plain buckler was picked up';
    if (!/You leave .*buckler.* where it lies: you carry two already/i.test(said)) return `the third was left without a word: "${said}"`;
    if (!(L.items[`${p.x},${p.y}`] || []).some(it => it.t === 'buckler' && it.left)) return 'the buckler left is not marked as left';
    // the Take row still offers it, from where the hero stands
    if (Game.useLabel() !== 'Take') return `the spare left behind is not in the Take row: the button says "${Game.useLabel()}"`;
    // a fine one is not a spare
    step([{ t: 'buckler', q: 1, e: 1 }]);
    return p.inv.filter(it => it.t === 'buckler').length === 3 || 'a fine buckler was left as a spare';
  });
};
