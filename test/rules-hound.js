// Rule checks for the hero's hound (companion.js).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function houndChecks(h) {
  const { start, markLog, linesSince, test, run, withHound, clearAround, bareFloor, dig } = h;

  // ---------- the hero's hound ----------

  await test('the starving hound follows a hero who feeds it: it keeps up, and swaps places rather than blocking the way', async () => {
    const ctx = await withHound('hound-join');
    const { Game } = ctx; const p = Game.player(), G = Game.state();
    const c = Game.companion();
    if (!c || c.fallen || c.mode !== 'follow' || !c.name) return `no hound followed: ${JSON.stringify(c)}`;
    // a meal from the pack pays for it (a fighter sets out with rations)
    const meals = p.inv.filter(it => it.t === 'ration' || it.t === 'bread' || it.t === 'meat').reduce((a, it) => a + (it.q || 1), 0);
    if (ctx.mealsBefore && meals !== ctx.mealsBefore - 1) return `feeding it took ${ctx.mealsBefore - meals} meals from the pack, not one`;
    if (!ctx.mealsBefore && p.food !== 75) return `feeding it cost ${100 - p.food} nourishment, not 25`;
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) return 'it did not start beside the hero';
    clearAround(ctx, 6);
    // walk four squares; it keeps up
    for (let i = 0; i < 4; i++) { Game.input('forward'); run(Game, G, 400); }
    run(Game, G, 1500);
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) return `the hound lagged ${Math.abs(c.x - p.x) + Math.abs(c.y - p.y)} squares behind`;
    // face it and walk into it: it takes the hero's square
    const k = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === c.x - p.x && dy === c.y - p.y);
    p.dir = k; const was = [p.x, p.y], at = [c.x, c.y];
    Game.input('forward');
    if (p.x !== at[0] || p.y !== at[1] || c.x !== was[0] || c.y !== was[1]) return 'walking into the hound did not swap places';
    return Game.threadNotes().some(n => n.includes(c.name)) || 'the hero sheet does not mention the hound';
  });

  await test('the hound bites an awake foe beside it, takes the blows of a foe that reaches it first, and can fall for good', async () => {
    const out = [];
    const ctx = await withHound('hound-fight');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion();
    clearAround(ctx);
    // a goblin beside the hound, not the hero
    const put = (id, extra) => {
      const L = Game.level(), p = Game.player();
      const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
      const m = { uid: 97, id, x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra };
      L.monsters.length = 0; L.monsters.push(m); return m;
    };
    const g = put('goblin', { nextAct: 1e12 });
    const mark = markLog(G);
    run(Game, G, 6000);
    if (!(g.hp < 999)) out.push('the hound never bit the goblin beside it');
    if (!linesSince(G, mark).some(l => l.includes(`${c.name} bites`))) out.push('its bite was not told');
    // an ogre beside it swings at it, and in time it falls
    put('ogre');
    const hp0 = c.hp;
    for (let i = 0; i < 1200 && !c.fallen; i++) { Game.update(G.t + 25, 25); Game.player().hp = 9999; }
    if (!(c.hp < hp0) && !c.fallen) out.push('an ogre beside the hound never struck it');
    if (!c.fallen) out.push('the hound never fell');
    if (Game.state().status !== 'playing') out.push('the hero died instead');
    if (c.fallen && !Game.threadNotes().some(n => /fell/.test(n))) out.push('the hero sheet does not say it fell');
    if (c.fallen && !Game.epilogue(false).join(' ').includes(c.name)) out.push('the epilogue forgot it');
    return out.length ? out.join('; ') : true;
  });

  await test('told to stay, the hound stays, even down the stair; at heel it comes too; resting heals it; a reload keeps it', async () => {
    const out = [];
    const ctx = await withHound('hound-stay');
    const { Game } = ctx; const p = Game.player(), G = Game.state(); const c = Game.companion();
    clearAround(ctx);
    const k = ctx.Dungeon.DIRS.findIndex(([dx, dy]) => dx === c.x - p.x && dy === c.y - p.y);
    p.dir = k;
    if (Game.useLabel() !== 'Stay') out.push(`facing the hound, Use says ${Game.useLabel()}`);
    Game.input('use');
    if (c.mode !== 'stay') out.push('Use did not tell it to stay');
    if (Game.useLabel() !== 'Come') out.push(`told to stay, Use says ${Game.useLabel()}`);
    Game.input('use');
    if (c.mode !== 'follow') out.push('Use did not call it back');
    Game.input('use');
    const d0 = G.depth;
    Game.level().monsters.length = 0; Game.descend();
    if (c.depth !== d0) out.push('a hound told to stay came down the stair');
    // another hero keeps theirs at heel, and it comes down with them
    {
      const b2 = await withHound('hound-heel');
      const G2 = b2.Game.state(), p2 = b2.Game.player(), c2 = b2.Game.companion();
      b2.Game.level().monsters.length = 0; b2.Game.descend();
      if (c2.depth !== G2.depth) out.push('a hound at heel did not come down the stair');
      else if (Math.abs(c2.x - p2.x) + Math.abs(c2.y - p2.y) !== 1) out.push('it did not arrive beside the hero');
    }
    {
      const b3 = await withHound('hound-rest');
      const c3 = b3.Game.companion();
      c3.hp = 1; b3.Game.player().hp = 1;
      clearAround(b3);
      b3.Game.rest();
      if (!(c3.hp > 1)) out.push('resting did not heal the hound');
      b3.Game.save(true);
      const name = c3.name, hp = c3.hp;
      if (!b3.Game.load()) return 'the game would not load';
      const c4 = b3.Game.companion();
      if (!c4 || c4.name !== name || c4.hp !== hp) out.push(`after a reload the hound was ${JSON.stringify(c4)}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('raised quills stab the hound that bites into them, not the hero; the starving hound waits on the second floor of about two runs in three', async () => {
    const out = [];
    const ctx = await withHound('hound-quills');
    const { Game } = ctx; const G = Game.state(); const c = Game.companion(); const p = Game.player();
    clearAround(ctx);
    const spot = ctx.Dungeon.DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) > 1 && !(x === p.x && y === p.y));
    const q = { uid: 98, id: 'quillback', x: spot[0], y: spot[1], hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    q.windup = { kind: 'move', move: 'bristle', at: G.t, until: G.t + 1e9 };
    Game.level().monsters.push(q);
    const hp0 = c.hp, php = p.hp;
    for (let i = 0; i < 400 && q.hp === 999; i++) Game.update(G.t + 25, 25);
    if (q.hp === 999) out.push('the hound never bit the quillback');
    else if (!(c.hp < hp0)) out.push('the quills did not stab the hound');
    if (p.hp < php) out.push('the quills stabbed the hero for the hound\'s bite');
    const { encounterPlan } = await import(require('url').pathToFileURL(require('path').join(__dirname, '..', 'js', 'encounters.js')).href);
    let n = 0;
    for (let i = 0; i < 300; i++) if (encounterPlan('stray' + i, 8)[2].includes('stray')) n++;
    if (n < 170 || n > 230) out.push(`the hound waited on floor 2 in ${n} of 300 runs`);
    if (encounterPlan('stray-short', 2).flat().includes('stray')) out.push('a two-floor delve met the hound');
    return out.length ? out.join('; ') : true;
  });

  await test('a hound at heel is heard a square sooner: a sleeper seven squares off wakes, and does not while the hound is told to stay', async () => {
    const ctx = await withHound('hound-noise');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion(), L = Game.level();
    // a plain fighter: no quiet blood, no quiet ring, no dark floor
    p.bg = 'debtor'; L.twist = null;
    clearAround(ctx, 8);
    const dir = ctx.Dungeon.DIRS.find(([dx, dy]) => p.x + 7 * dx > 0 && p.x + 7 * dx < L.w - 1 && p.y + 7 * dy > 0 && p.y + 7 * dy < L.h - 1);
    const sleeper = () => {
      const m = { uid: 99, id: 'goblin', x: p.x + 7 * dir[0], y: p.y + 7 * dir[1], hp: 999, maxHp: 999, awake: false, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      L.monsters.length = 0; L.monsters.push(m); return m;
    };
    let m = sleeper();
    Game.update(G.t + 25, 25);
    if (!m.awake) return 'a sleeper seven squares off slept on through a hound at heel';
    c.mode = 'stay';
    m = sleeper();
    Game.update(G.t + 25, 25);
    return !m.awake || 'a sleeper seven squares off woke though the hound was told to stay';
  });

  await test('the hound finds its own way: round a stone in the way, past a door pulled shut, and back from far behind', async () => {
    const out = [];
    const near = (c, p) => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1;
    {
      // an encounter's stone square between it and the hero, in an open room
      const ctx = await withHound('hound-way-stone');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx); dig(ctx, 3, 3, 15, 9);
      p.x = 12; p.y = 6; c.x = 4; c.y = 6; L.npcs = [{ id: 'mapmaker', kind: 'encounter', x: 5, y: 6 }];
      run(Game, G, 8000);
      if (!near(c, p)) out.push(`a stone in the way kept it at ${c.x},${c.y}`);
    }
    {
      // the only way through is a shut door: it turns up at the hero's side all the same
      const ctx = await withHound('hound-way-door');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx); dig(ctx, 3, 3, 7, 9); dig(ctx, 11, 3, 15, 9); dig(ctx, 9, 4, 10, 4);
      L.tiles[4 * L.w + 8] = ctx.Dungeon.T.DOOR;
      p.x = 12; p.y = 4; c.x = 6; c.y = 4;
      run(Game, G, 8000);
      if (!near(c, p)) out.push(`a shut door kept it at ${c.x},${c.y}`);
      if (L.tiles[4 * L.w + 8] !== ctx.Dungeon.T.DOOR) out.push('it opened the door');
    }
    {
      // far behind, down a long corridor turning back on itself: it trots, and catches up
      const ctx = await withHound('hound-way-far');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      const L = bareFloor(ctx), e = L.w - 3;
      dig(ctx, 2, 3, e, 3); dig(ctx, e, 3, e, 7); dig(ctx, 2, 7, e, 7);
      p.x = 3; p.y = 7; c.x = 3; c.y = 3;
      run(Game, G, 16000);
      if (!near(c, p)) out.push(`from ${2 * (e - 3) + 4} squares back it only reached ${c.x},${c.y}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('nothing lands on the hound\'s square to stay; Use strikes a foe in front before it talks to the hound', async () => {
    const out = [];
    const ctx = await withHound('hound-stack');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    bareFloor(ctx); dig(ctx, 3, 3, 15, 9);
    p.x = 8; p.y = 6; p.dir = 1; c.x = 9; c.y = 6;
    // a rat come to stand where the hound stands (as a lunge or a summoning once put one)
    const rat = { uid: 95, id: 'rat', x: 9, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
    Game.level().monsters.push(rat);
    if (Game.useLabel() === 'Stay' || Game.useLabel() === 'Come') out.push(`with a rat in front, Use says ${Game.useLabel()}`);
    const was = c.mode;
    Game.input('use');
    if (c.mode !== was) out.push('Use told the hound to stay instead of striking the rat');
    // and with a goblin beside it to bite, it still gives way first
    Game.level().monsters.push({ uid: 93, id: 'goblin', x: 9, y: 5, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    run(Game, G, 1500);
    if (c.x === rat.x && c.y === rat.y) out.push('the hound stayed on the rat\'s square');
    // and a rat that lunges after a hero stepping back does not land on the hound behind them
    {
      const b = await withHound('hound-lunge');
      const G2 = b.Game.state(), p2 = b.Game.player(), c2 = b.Game.companion();
      bareFloor(b); dig(b, 3, 3, 15, 9);
      p2.x = 8; p2.y = 6; p2.dir = 1; c2.x = 7; c2.y = 6; c2.mode = 'stay';
      let stacked = 0;
      for (let i = 0; i < 12; i++) {
        p2.x = 8; p2.y = 6; c2.x = 7; c2.y = 6; c2.hp = c2.maxHp = 9999;
        const m = { uid: 96, id: 'rat', x: 9, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: G2.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
        b.Game.level().monsters.length = 0; b.Game.level().monsters.push(m);
        for (let t = 0; t < 3000 && !m.windup; t += 25) b.Game.update(G2.t + 25, 25);
        if (!m.windup) continue;
        // the hero steps back into the hound, and they swap: the hound now stands where the rat will lunge
        b.Game.input('back');
        let on = false;
        for (let t = 0; t < 2000; t += 25) { b.Game.update(G2.t + 25, 25); if (m.x === c2.x && m.y === c2.y) on = true; }
        if (on) stacked++;
      }
      if (stacked) out.push(`a lunging rat landed on the hound ${stacked} times`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the hound\'s bite breaks no rite, horn call or chant: those are the hero\'s to break', async () => {
    const out = [];
    for (const [id, move, extra] of [['lich', 'rite', { phase: 2 }], ['grisk', 'rally', {}], ['acolyte', 'mend', {}]]) {
      const ctx = await withHound('hound-rite-' + id);
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      bareFloor(ctx); dig(ctx, 3, 3, 16, 12);
      p.x = 10; p.y = 7; c.x = 11; c.y = 7; c.maxHp = c.hp = 9999;
      const m = { uid: 91, id, x: 12, y: 7, hp: 500, maxHp: 999, awake: true, nextAct: 1e12, rx: 12, ry: 7, fromX: 12, fromY: 7, moveT0: 0, moveT1: 0, flashUntil: 0, spoke: true, ...extra };
      m.windup = { kind: 'move', move, at: G.t, until: G.t + 1e9 };
      Game.level().monsters.push(m);
      const mark = markLog(G);
      // until its first bite lands (a level-one hound misses a lich more often than not)
      let bit = false;
      for (let t = 0; t < 40000 && !bit; t += 25) { Game.update(G.t + 25, 25); bit = linesSince(G, mark).some(l => l.includes(`${c.name} bites`)); }
      run(Game, G, 500);
      if (!bit) out.push(`the hound never bit the ${id}`);
      else if (!m.windup) out.push(`the hound's bite broke the ${id}'s ${move}`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the hound after a reload is not caught mid-lunge; one left floors above is not at the hero\'s side at the end; sharing needs food to share', async () => {
    const out = [];
    const ctx = await withHound('hound-odds');
    const { Game } = ctx; const G = Game.state(), c = Game.companion();
    c.lungeAt = 1e12; c.stuckSince = G.t;
    clearAround(ctx);
    Game.save(true);
    if (!Game.load()) return 'the game would not load';
    const c2 = Game.companion();
    if (c2.lungeAt) out.push(`after a reload its lunge clock read ${c2.lungeAt}`);
    if (c2.stuckSince) out.push('after a reload it still counted itself stuck');
    // told to stay floors above, then the Heart won: it is not by the fire that night
    c2.mode = 'stay'; c2.depth = Game.state().depth + 3;
    const won = Game.epilogue(true).join(' ');
    if (!won.includes(c2.name) || /sleeps by their fire/.test(won)) out.push(`the epilogue had the hound left behind at the hero's side: ${won}`);
    // a hero with too little food cannot share it
    {
      const b = await start('fighter', 'hound-hungry', { levels: 6 });
      const p = b.Game.player(), L = b.Game.level(), [dx, dy] = b.Dungeon.DIRS[p.dir];
      p.food = 10;
      // nothing in the pack to give, either
      const packed = p.inv.filter(it => ['ration', 'bread', 'meat'].includes(it.t));
      p.inv = p.inv.filter(it => !['ration', 'bread', 'meat'].includes(it.t));
      L.tiles[(p.y + dy) * L.w + p.x + dx] = b.Dungeon.T.FLOOR; L.monsters.length = 0;
      L.npcs = [{ id: 'stray', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
      b.Game.input('use');
      const o = b.Game.encounterOptions()[0];
      if (!o.blocked) out.push('sharing food was open to a hero with 10 food');
      if (o.cost !== '25 food') out.push(`the cost read ${o.cost}`);
      b.Game.chooseEncounter(0);
      if (b.Game.companion()) out.push('a hero with nothing to share won the hound by sharing');
      // nor the last of it
      p.food = 25;
      if (!b.Game.encounterOptions()[0].blocked) out.push('a hero with exactly 25 food could share it all and starve');
      // but a ration in the pack will do
      p.inv.push(...packed.slice(0, 1));
      if (packed.length && b.Game.encounterOptions()[0].blocked) out.push('a hero with a ration in the pack was too poor to share');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a hurt hound is a reason to rest; it follows a hero who walks on rather than fight alone; its end is told as it was', async () => {
    const out = [];
    {
      const ctx = await withHound('hound-rest-whole');
      const { Game } = ctx; const p = Game.player(), c = Game.companion();
      clearAround(ctx);
      p.hp = p.maxHp; p.sp = p.maxSp; c.hp = 2;
      if (!Game.rest()) out.push('an unhurt hero would not rest for a hurt hound');
      else if (!(c.hp > 2)) out.push('the rest did not heal the hound');
      c.hp = c.maxHp;
      if (Game.rest()) out.push('a hero and hound both whole could still rest');
    }
    {
      const ctx = await withHound('hound-walks-on');
      const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
      bareFloor(ctx); dig(ctx, 3, 3, 20, 9);
      p.x = 18; p.y = 6; c.x = 5; c.y = 6; c.hp = c.maxHp = 9999;
      const g = { uid: 94, id: 'goblin', x: 4, y: 6, hp: 999, maxHp: 999, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 };
      Game.level().monsters.push(g);
      run(Game, G, 4000);
      if (g.hp < 999) out.push('it stayed to bite a goblin while the hero was thirteen squares off');
      if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > 1) out.push(`it did not come after the hero (it is at ${c.x},${c.y})`);
    }
    {
      const ctx = await withHound('hound-end');
      const { Game } = ctx; const c = Game.companion();
      const lost = Game.epilogue(false).join(' ');
      if (!lost.includes(`${c.name} stood over them to the last`)) out.push(`a death with the hound at their side was told as: ${lost}`);
      c.mode = 'stay';
      if (Game.epilogue(false).join(' ').includes('stood over them')) out.push('a hound told to stay across the floor still stood over them');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a lost hound turns up at the hero\'s back or side, never in plain sight in front of them', async () => {
    const out = [];
    const ctx = await withHound('hound-sight');
    const { Game } = ctx; const G = Game.state(), p = Game.player(), c = Game.companion();
    const L = bareFloor(ctx); dig(ctx, 3, 6, 18, 6);
    // the hero near the corridor's end (room at their back), looking back down it at the hound; a sleeper between
    p.x = 16; p.y = 6; p.dir = 3; c.x = 4; c.y = 6;
    L.monsters.push({ uid: 92, id: 'goblin', x: 10, y: 6, hp: 999, maxHp: 999, awake: false, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
    run(Game, G, 6000);
    if (c.x > 10) out.push(`it blinked past the sleeper into plain sight, to ${c.x},${c.y}`);
    // the hero turns away: now it finds its way round, and comes up behind them
    Game.input('right'); Game.input('right');
    run(Game, G, 5000);
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) out.push(`with the hero looking away it was still at ${c.x},${c.y}`);
    return out.length ? out.join('; ') : true;
  });
};
