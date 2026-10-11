// Rule checks for fire thrown, lit and breathed: flasks of lamp oil, burning arrows and firepots, doors that catch, the wraith's grave-cold, lightning in the water, scenes, and the drowned one, the eyeless stalker and the puffcap.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function fireChecks(h) {
  const { OPTS, evenStats, newContext, start, markLog, countSaid, linesSince, test, beside, run, winHere, druid, arena } = h;

  await test('a flask of lamp oil is thrown: it smashes three squares ahead or on the first thing in the way and spills there; not at a wall; every trader keeps some', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-flask');
    L.twist = null;
    p.inv.push({ t: 'lamp_oil', q: 3, e: 0 });
    const flask = () => p.inv.find(i => i.t === 'lamp_oil');
    // nothing in the way: three squares out
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask thrown down an empty passage did not spill three squares out');
    if (flask().q !== 2) out.push(`throwing left ${flask().q} flasks`);
    // a goblin in the way takes it
    L.fields = {};
    const g = put('goblin', 2);
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    if (!Game.fieldAt(g.x, g.y) || Game.fieldAt(g.x, g.y).k !== 'oil') out.push('a flask did not smash on the goblin in the way');
    const [x4, y4] = at(4);
    if (Game.fieldAt(x4, y4)) out.push('the flask flew on past the goblin');
    // a wall right ahead: it is not thrown, and not used up
    L.monsters.length = 0; L.fields = {};
    const [wx, wy] = at(1); L.tiles[wy * L.w + wx] = 1;
    const q0 = flask().q;
    G.t = Math.max(G.t, p.nextAttack) + 10;
    Game.useItem(flask());
    if (flask().q !== q0) out.push('a flask was thrown into a wall');
    // every trader keeps a few
    {
      const ctx = await start('fighter', 'flask-traders');
      let traders = 0, stocked = 0;
      for (let i = 0; i < 20; i++) {
        ctx.Game.newGame({ name: 'T', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'fl-' + i, opts: { ...OPTS, levels: 8 } });
        for (let k = 0; k < 3; k++) {
          for (const n of ctx.Game.level().npcs || []) if (Array.isArray(n.stock)) { traders++; if (n.stock.some(s => s.t === 'lamp_oil' && s.q >= 2)) stocked++; }
          if (ctx.Game.forkPending && ctx.Game.forkPending()) ctx.Game.chooseRoute('crypts');
          ctx.Game.descend();
        }
      }
      if (!traders || stocked !== traders) out.push(`${stocked} of ${traders} traders kept lamp oil`);
    }
    return out.length ? out.join('; ') : true;
  });

  await test('fire oil on a bow lights spilt oil where the arrow lands', async () => {
    const out = [];
    const { Game, G, L, p, put } = await arena('ranger', 'el-arrow');
    L.twist = null;
    p.eq.weapon = { t: 'shortbow', q: 1, e: 0 }; p.stats.dex = 30;
    p.coating = { t: 'fire', left: 20 };
    const g = put('goblin', 3);
    L.fields[`${g.x},${g.y}`] = { k: 'oil' };
    let lit = false;
    for (let i = 0; i < 12 && !lit; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); lit = !!Game.fieldAt(g.x, g.y) && Game.fieldAt(g.x, g.y).k === 'fire'; }
    if (!lit) out.push('a fire-oiled arrow did not light the oil it landed in');
    return out.length ? out.join('; ') : true;
  });

  await test('lightning through water shocks the hero once a casting, runs through the water and not through walls, and keeps a skeleton down', async () => {
    const out = [];
    const { Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-arc2');
    L.twist = 'flooded';
    // two struck in a line beside the hero: the water carries it into them once, not once for each
    put('goblin', 1); put('goblin', 2);
    let mark = markLog(G);
    cast('lightning');
    const shocks = linesSince(G, mark).filter(l => /through the water into you/.test(l)).length;
    if (shocks !== 1) out.push(`the hero was shocked ${shocks} times by one bolt`);
    // a wall between the water it struck and the one beyond keeps it out
    L.monsters.length = 0;
    const [wx, wy] = at(4, 1), [bx, by] = at(4, 2);
    L.tiles[wy * L.w + wx] = Dungeon.T.WALL; L.tiles[by * L.w + bx] = Dungeon.T.FLOOR;
    put('goblin', 4); const b = put('goblin', 4, 2);
    cast('lightning');
    if (b.hp !== 999) out.push('lightning ran through a wall');
    // a skeleton the water's lightning brings down stays down, as one the bolt brings down does
    L.monsters.length = 0; L.tiles[wy * L.w + wx] = Dungeon.T.FLOOR;
    p.eq.weapon = { t: 'dagger', q: 1, e: 0 };
    put('goblin', 4); const sk = put('skeleton', 4, 1, { hp: 1, maxHp: 20 });
    cast('lightning');
    if (L.monsters.includes(sk)) out.push(`a skeleton felled by lightning through the water ${sk.collapsed ? 'lies waiting to rise' : 'still stands'}`);
    return out.length ? out.join('; ') : true;
  });

  await test('ice holds a drowned one down under a blow or a tread; oil burnt on moss leaves ash that stays; a fire spell that strikes nothing lights oil where it lands', async () => {
    const out = [];
    const { Game, G, L, p, put, at, cast } = await arena('fighter', 'el-loose');
    L.twist = 'flooded';
    const [fx, fy] = at(1);
    const dr = put('drowned', 1, 0, { sunk: true, awake: false, nextAct: G.t, hp: 400, maxHp: 400 });   // (four good blows must not kill it under the ice)
    L.fields[`${fx},${fy}`] = { k: 'ice', until: G.t + 1e6 };
    for (let i = 0; i < 4; i++) { G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('attack'); }
    if (!dr.sunk) out.push('a blow brought a drowned one up through the ice');
    const x0 = p.x;
    Game.input('forward'); run(Game, G, 300);
    if (!dr.sunk) out.push('a tread brought a drowned one up through the ice');
    if (p.x !== x0 && p.x === fx) out.push('the hero walked onto the drowned one\'s square');
    // oil that burns on moss takes the moss with it
    const m = await arena('mage', 'el-loose2');
    m.L.twist = 'overgrown';
    const [ox, oy] = m.at(2);
    m.L.fields[`${ox},${oy}`] = { k: 'fire', fuel: 'oil', until: m.G.t + 10, spread: 1e15, burn: 1e15, gen: 0 };
    run(m.Game, m.G, 32000);
    const f = m.Game.fieldAt(ox, oy);
    if (!f || f.k !== 'ash') out.push(`oil burnt on moss left ${f ? f.k : 'nothing'} after half a minute, and the moss would burn again`);
    // fire that strikes nothing still lights the oil where it comes down
    m.L.twist = null; m.L.fields = {};
    const [ax, ay] = m.at(1);
    m.L.fields[`${ax},${ay}`] = { k: 'oil' };
    m.cast('burning_hands');
    if (!m.Game.fieldAt(ax, ay) || m.Game.fieldAt(ax, ay).k !== 'fire') out.push('a fire spell that struck nothing did not light the oil it fell on');
    return out.length ? out.join('; ') : true;
  });

  await test('one caught alight at the far edge of spilt oil gets out away from the oil, not across the rest of it that is about to burn', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('fighter', 'el-edge');
    L.twist = null;
    // a line of oil two to four squares ahead; the far end catches under a goblin
    for (const k of [2, 3, 4]) { const [x, y] = at(k); L.fields[`${x},${y}`] = { k: 'oil' }; }
    const g = put('goblin', 4, 0, { nextAct: G.t });
    const [gx, gy] = at(4);
    L.fields[`${gx},${gy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    run(Game, G, 700);
    const d = Math.abs(g.x - p.x) + Math.abs(g.y - p.y);
    if (d < 4) out.push(`it came out ${d} squares from the hero, over the oil that was about to burn`);
    if (g.x === gx && g.y === gy) out.push('it stayed in the flames');
    return out.length ? out.join('; ') : true;
  });

  await test('fire a monster lit burns what stands in it but is not the hero\'s blow: it does not break a chant; the hero\'s own fire does', async () => {
    const out = [];
    for (const wild of [true, false]) {
      const { Game, G, L, put, at } = await arena('fighter', 'el-blaze-' + wild);
      L.twist = null;
      const ac = put('acolyte', 3, 0, { hp: 50, maxHp: 100, nextAct: G.t + 5000 });
      ac.windup = { kind: 'move', move: 'mend', at: G.t, until: G.t + 5000, target: ac.uid };
      const [x, y] = at(3);
      L.fields[`${x},${y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0, ...(wild ? { wild: true } : {}) };
      const mark = markLog(G);
      run(Game, G, 300);
      if (!(ac.hp < 50)) out.push(`${wild ? 'a wyrm\'s' : 'the hero\'s'} fire did not burn the acolyte`);
      const broken = !ac.windup;
      const said = linesSince(G, mark).some(l => /You break/.test(l));
      if (wild && (broken || said)) out.push(`a wyrm's fire broke the acolyte's chant for the hero (${linesSince(G, mark).join(' | ')})`);
      if (!wild && !broken) out.push('the hero\'s own fire did not break the chant');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a shut wooden door beside a fire catches, burns a while and falls in, a locked one too; fire under a webbed hero burns the web away', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, at } = await arena('fighter', 'el-door');
    L.twist = null;
    const [dx, dy] = at(3), [fx, fy] = at(2);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR_LOCKED;
    L.locks = L.locks || {}; L.locks[`${dx},${dy}`] = 'brass';
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: G.t, burn: 1e15, gen: 0 };
    const mark = markLog(G);
    let caught = false, heldWhileBurning = true;
    for (let i = 0; i < 80; i++) {
      run(Game, G, 200);
      const f = Game.fieldAt(dx, dy);
      if (f && f.k === 'fire') { caught = true; if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_LOCKED) heldWhileBurning = false; }
      if (L.tiles[dy * L.w + dx] === Dungeon.T.DOOR_OPEN) break;
    }
    if (!caught) out.push('the door beside the fire never caught');
    if (!heldWhileBurning) out.push('the door stood open while it was still burning');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('the burnt door never fell in');
    if (L.locks[`${dx},${dy}`]) out.push('the lock outlived the door');
    const said = linesSince(G, mark);
    if (!said.some(l => /door catches fire/.test(l)) || !said.some(l => /falls in/.test(l))) out.push(`no word of the door burning (${said.join(' | ')})`);
    // a web holding the hero shrivels in the flames
    p.webbed = G.t + 60000;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    run(Game, G, 300);
    if (p.webbed > G.t) out.push('fire under a webbed hero left the web whole');
    return out.length ? out.join('; ') : true;
  });

  await test('fire loose ends: a fleeing creature does not run into fire; a burning door is too hot to open and a burnt one cannot be shut; a door fire is named as such', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-flee');
    L.twist = null;
    // a one-wide passage, fire behind a goblin running from the hero
    for (let k = 1; k <= 6; k++) for (const j of [-1, 1]) { const [x, y] = at(k, j); L.tiles[y * L.w + x] = Dungeon.T.WALL; }
    const g = put('goblin', 3, 0, { nextAct: G.t, fleeing: true, hp: 30, maxHp: 30 });
    const [fx, fy] = at(4);
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    let entered = 0;
    for (let i = 0; i < 30; i++) { run(Game, G, 100); if (g.x === fx && g.y === fy) entered++; }
    if (entered) out.push(`a fleeing goblin stood in the fire ${entered} times in three seconds`);
    // a burning door will not open, and one burnt through will not shut
    L.fields = {}; L.monsters.length = 0;
    const [dx, dy] = at(1);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    L.fields[`${dx},${dy}`] = { k: 'fire', fuel: 'door', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR) out.push('a burning door was pushed open');
    L.fields[`${dx},${dy}`].until = G.t + 50;
    run(Game, G, 300);
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('the burning door did not fall');
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[dy * L.w + dx] !== Dungeon.T.DOOR_OPEN) out.push('a burnt-through door was pulled shut');
    // standing in a burning doorway, the hurt is from the door, not moss
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'door', until: G.t + 1e6, spread: 1e15, burn: G.t, gen: 0 };
    G.stats = null; p.hp = 9999;
    run(Game, G, 300);
    const worst = G.stats && G.stats.worst;
    if (!worst || worst.cause !== 'a burning door') out.push(`a door fire hurt as ${worst ? worst.cause : 'nothing'}`);
    return out.length ? out.join('; ') : true;
  });

  await test('a flask flies over a drowned one sunk out of sight, stops at a barrel; fire that strikes nothing comes down on the first oil in its flight', async () => {
    const out = [];
    const { Game, G, L, p, put, at } = await arena('cleric', 'el-throw2');
    L.twist = 'flooded';
    p.inv.push({ t: 'lamp_oil', q: 5, e: 0 });
    const flask = () => p.inv.find(i => i.t === 'lamp_oil');
    put('drowned', 1, 0, { sunk: true, awake: false });
    let mark = markLog(G);
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.useItem(flask());
    const [x3, y3] = at(3);
    if (!Game.fieldAt(x3, y3) || Game.fieldAt(x3, y3).k !== 'oil') out.push('a flask stopped on a drowned one sunk out of sight');
    if (linesSince(G, mark).some(l => /Drowned/.test(l))) out.push('the log named a drowned one the hero cannot see');
    // a barrel two squares off takes it
    L.twist = null; L.monsters.length = 0; L.fields = {};
    const [bx, by] = at(2);
    L.dressing.push({ x: bx, y: by, k: 'barrel', ox: 0, oy: 0 });
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.useItem(flask());
    const [x4, y4] = at(4);
    if (!Game.fieldAt(bx, by) || Game.fieldAt(bx, by).k !== 'oil' || Game.fieldAt(x4, y4)) out.push('a flask flew past a barrel in its way');
    // Flame Strike at nothing, with oil two squares off and open stone beyond, lights the oil
    L.dressing = []; L.fields = {};
    const [ox, oy] = at(2); L.fields[`${ox},${oy}`] = { k: 'oil' };
    const sp = Game.knownSpells().find(s => s.id === 'flame_strike');
    G.t = Math.max(G.t, p.nextAttack) + 10;
    if (!sp || !Game.castSpell(sp)) out.push('Flame Strike at oil two squares off was refused');
    else if (!Game.fieldAt(ox, oy) || Game.fieldAt(ox, oy).k !== 'fire') out.push('Flame Strike at nothing flew past the oil it was aimed at');
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin on its own throws a lit pot of oil from the third floor down, never before; it bursts in flames where the hero stood and the square behind; a step aside answers it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-pot');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    // (the same floor, taken as another depth)
    const d0 = G.depth;
    const tries = depth => {
      G.levels[depth] = L; G.depth = depth;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        L.monsters.length = 0; L.fields = {};
        const g = put('goblin', 3, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
        run(Game, G, 30);
        if (g.windup && g.windup.move === 'firepot') n++;
      }
      return n;
    };
    if (tries(2)) out.push('a goblin threw a firepot on the second floor');
    if (!tries(3)) out.push('a goblin on the third floor never threw a firepot in twenty chances');
    G.depth = d0;
    // it lands: stand still and it bursts over you, on your square and the one behind
    const pot = () => { L.monsters.length = 0; L.fields = {}; const g = put('goblin', 3, 0, { hp: 50, maxHp: 50 }); g.windup = { kind: 'move', move: 'firepot', at: G.t, until: G.t + 100, tx: p.x, ty: p.y, dx: -fx, dy: -fy }; g.nextAct = g.windup.until; return g; };
    let g = pot(), hp0 = p.hp, mark = markLog(G);
    run(Game, G, 140);
    const [bx, by] = at(-1);
    if (!(p.hp < hp0)) out.push(`a firepot burst on a hero who stood still and did not hurt them (${linesSince(G, mark).join(' | ')})`);
    for (const [x, y, what] of [[p.x, p.y, 'the hero\'s square'], [bx, by, 'the square behind']]) { const f = Game.fieldAt(x, y); if (!f || f.k !== 'fire' || !f.wild) out.push(`no goblin's fire on ${what}`); }
    // a step aside before it lands: the pot bursts where the hero stood
    const x0 = p.x, y0 = p.y;
    g = pot();
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    hp0 = p.hp; mark = markLog(G);
    run(Game, G, 400);
    if (p.hp < hp0) out.push('a firepot hurt a hero who stepped aside');
    if (!Game.fieldAt(x0, y0) || Game.fieldAt(x0, y0).k !== 'fire') out.push('the pot did not burst where the hero had stood');
    if (!linesSince(G, mark).some(l => /where you stood/.test(l))) out.push('no word of the pot missing');
    p.x = x0; p.y = y0;
    return out.length ? out.join('; ') : true;
  });

  await test('a goblin archer looses a burning arrow at a hero standing on something that will burn, and lights it; stepping aside leaves the arrow to light the empty square', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-farrow');
    const tries = twist => {
      L.twist = twist;
      let n = 0;
      for (let i = 0; i < 20; i++) {
        L.monsters.length = 0; L.fields = {};
        const a = put('archer', 3, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
        run(Game, G, 30);
        if (a.windup && a.windup.move === 'firearrow') n++;
      }
      return n;
    };
    if (tries(null)) out.push('an archer loosed a burning arrow at a hero on bare stone');
    if (!tries('overgrown')) out.push('an archer never loosed a burning arrow at a hero on moss in twenty chances');
    // loosed: stand on the moss and it catches under you; step aside and it catches where you stood
    L.twist = 'overgrown';
    for (const aside of [false, true]) {
      L.monsters.length = 0; L.fields = {};
      const a = put('archer', 3, 0, { hp: 50, maxHp: 50 });
      a.windup = { kind: 'move', move: 'firearrow', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
      const x0 = p.x, y0 = p.y;
      const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (aside) { p.x += sx; p.y += sy; }
      const mark = markLog(G);
      run(Game, G, 400);
      const f = Game.fieldAt(x0, y0);
      if (!f || f.k !== 'fire') out.push(`${aside ? 'stepping aside' : 'standing still'}: the moss where the arrow was aimed did not catch`);
      if (aside && !linesSince(G, mark).some(l => /where you stood/.test(l))) out.push('no word of the arrow missing');
      p.x = x0; p.y = y0;
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a living charger pulls up short of fire in its line and is left open; a living lunger does not follow a step back into fire', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-charge');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const o = put('orc', 4, 0, { hp: 200, maxHp: 200 });
    const [cx, cy] = at(2);
    L.fields[`${cx},${cy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0, wild: true };
    o.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t + 50, dx: -fx, dy: -fy }; o.nextAct = o.windup.until;
    let hp0 = p.hp, mark = markLog(G);
    run(Game, G, 150);
    const [sx, sy] = at(3);
    if (o.x !== sx || o.y !== sy) out.push(`the orc charged to ${o.x},${o.y}, not short of the fire at ${cx},${cy}`);
    if (p.hp < hp0) out.push('the charge came through the fire and hit the hero');
    if (!linesSince(G, mark).some(l => /short of the flames/.test(l))) out.push(`no word of the orc pulling up (${linesSince(G, mark).join(' | ')})`);
    if (!(o.openUntil > G.t) && !(p.opening && p.opening.until > G.t)) out.push('the orc was not left open');
    // a rat draws back beside the hero; the hero steps back, and fire takes the square they left
    L.monsters.length = 0; L.fields = {};
    const r = put('rat', 1, 0, { nextAct: G.t, hp: 50, maxHp: 50 });
    for (let i = 0; i < 60 && !r.windup; i++) run(Game, G, 25);
    if (!r.windup || r.windup.move) return `the rat drew back ${JSON.stringify(r.windup)}`;
    const was = [p.x, p.y];
    p.x -= fx; p.y -= fy;
    L.fields[`${was[0]},${was[1]}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0 };
    hp0 = p.hp; mark = markLog(G);
    const rx = r.x, ry = r.y;
    run(Game, G, 1200);
    if (r.x !== rx || r.y !== ry) out.push(`the rat lunged into the fire (to ${r.x},${r.y})`);
    if (linesSince(G, mark).some(l => /lunges after/.test(l))) out.push('the rat lunged after the hero through the fire');
    p.x = was[0]; p.y = was[1];
    return out.length ? out.join('; ') : true;
  });

  await test('a wraith breathes a grave-cold at the feet of a hero a few squares off: stay and be frozen fast and chilled; step aside and it glazes the empty square', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-chill');
    L.twist = null;
    let n = 0;
    for (let i = 0; i < 20; i++) { L.monsters.length = 0; L.fields = {}; const w = put('wraith', 3, 0, { nextAct: G.t, hp: 80, maxHp: 80 }); run(Game, G, 30); if (w.windup && w.windup.move === 'chill') n++; }
    if (!n) out.push('a wraith three squares off never breathed its grave-cold in twenty chances');
    for (const aside of [false, true]) {
      L.monsters.length = 0; L.fields = {}; p.held = 0;
      const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 });
      w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; w.nextAct = w.windup.until;
      const x0 = p.x, y0 = p.y, [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (aside) { p.x += sx; p.y += sy; }
      const hp0 = p.hp, mark = markLog(G);
      run(Game, G, 400);
      const f = Game.fieldAt(x0, y0);
      if (!f || f.k !== 'ice') out.push(`${aside ? 'aside' : 'standing'}: no frost where it was breathed`);
      if (!aside && (!(p.hp < hp0) || !(p.held > G.t - 1200) || p.heldBy !== 'ice')) out.push(`standing in the grave-cold: hp ${hp0}->${p.hp}, held ${p.held > G.t - 1200} by ${p.heldBy}`);
      if (aside && (p.hp < hp0 || !linesSince(G, mark).some(l => /where you stood/.test(l)))) out.push('stepping aside from the grave-cold did not answer it');
      p.x = x0; p.y = y0; p.held = 0;
    }
    return out.length ? out.join('; ') : true;
  });

  await test('an acolyte calls lightning into the water a hero stands in, never on dry stone: the full of it on the square, half through the water beside it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-storm');
    const tries = twist => {
      L.twist = twist; let n = 0;
      for (let i = 0; i < 25; i++) { L.monsters.length = 0; L.fields = {}; const a = put('acolyte', 4, 0, { nextAct: G.t, hp: 80, maxHp: 80 }); run(Game, G, 30); if (a.windup && a.windup.move === 'storm') n++; }
      return n;
    };
    if (tries(null)) out.push('an acolyte called lightning at a hero on dry stone');
    if (!tries('flooded')) out.push('an acolyte never called lightning at a hero in water in twenty-five chances');
    L.twist = 'flooded';
    const took = {};
    for (const how of ['stay', 'aside']) {
      L.monsters.length = 0; L.fields = {};
      const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
      a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
      const x0 = p.x, y0 = p.y, [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
      if (how === 'aside') { p.x += sx; p.y += sy; }
      const hp0 = p.hp; run(Game, G, 400); took[how] = hp0 - p.hp;
      p.x = x0; p.y = y0; G.blowGate = 0;
    }
    if (!(took.stay > 0)) out.push('lightning called on a hero standing in the water did not hurt');
    if (!(took.aside > 0 && took.aside <= Math.ceil((12 + Math.floor(G.depth / 2)) / 2))) out.push(`a step aside in the water took ${took.aside}, not half`);
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 4: a grave-cold on a burning square still catches the hero; no lightning through ice; Stand Firm halves the new tricks; a test run writes no relic on loading and promises no bones', async () => {
    const out = [];
    const { ctx, Game, Dungeon, G, L, p, put } = await arena('fighter', 'el-review4');
    L.twist = null;
    const chill = () => { const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 }); w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; w.nextAct = w.windup.until; return w; };
    // standing in burning oil: the frost puts the fire out, and the hero, who never moved, is caught
    L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 9000, burn: G.t + 9000, gen: 0 };
    chill();
    let hp0 = p.hp, mark = markLog(G);
    run(Game, G, 150);
    const f = Game.fieldAt(p.x, p.y);
    if (f && f.k === 'fire') out.push('the grave-cold left the fire burning');
    if (!(p.hp < hp0) || !(p.held > G.t) || linesSince(G, mark).some(l => /where you stood/.test(l))) out.push(`a hero who stayed in the fire was let off the grave-cold (hp ${hp0}->${p.hp}, held ${p.held > G.t})`);
    // a flooded floor, but ice under the hero: the storm has no water to come down into
    L.twist = 'flooded'; L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0;
    L.fields[`${p.x},${p.y}`] = { k: 'ice', until: G.t + 9000 };
    const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    hp0 = p.hp; mark = markLog(G);
    run(Game, G, 400);
    if (p.hp < hp0) out.push(`lightning came down through ice for ${hp0 - p.hp}`);
    if (linesSince(G, mark).some(l => /into the water/.test(l))) out.push('the storm on ice spoke of water');
    // Stand Firm halves the grave-cold, as it does every trick that lands
    L.twist = null;
    const total = firm => {
      p.talents = firm ? ['stand_firm'] : [];
      let sum = 0;
      for (let i = 0; i < 40; i++) { L.monsters.length = 0; L.fields = {}; p.held = 0; G.blowGate = 0; p.hp = p.maxHp; chill(); run(Game, G, 150); sum += p.maxHp - p.hp; }
      return sum;
    };
    const bare = total(false), firm = total(true);
    if (!(firm < bare * 0.75)) out.push(`Stand Firm took ${firm} from forty grave-colds against ${bare}`);
    p.talents = []; L.monsters.length = 0; p.held = 0;
    // a relic found in a test run is not written in the codex by a load either
    const rid = Object.keys(ctx.RELICS)[0];
    for (const tested of [false, true]) {
      const c2 = await start('fighter', 'el-codex-' + tested);
      const G2 = c2.Game.state();
      G2.relics.found.push(rid); G2.tested = tested;
      c2.Game.save(true); c2.Game.load();
      const has = c2.Progress.load().relics.includes(rid);
      if (has === tested) out.push(tested ? 'a load wrote a test run\'s relic in the codex' : 'a load no longer writes an old run\'s relics in the codex');
      // and its epilogue promises no bones it will not leave
      const bones = c2.Game.epilogue(false).some(l => /will not lie quiet/.test(l));
      if (bones === tested) out.push(tested ? 'a test run\'s epilogue promised bones' : 'a run\'s epilogue no longer promises bones');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('review fixes 4: a scene lays no stray cask, names a mixed group as creatures, and is named only in sight and while it still stands', async () => {
    const out = [];
    const REAL = { levels: 8, size: 'medium', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let mixed = null, cache = null;
    // (pc-62 and pc-65 once left a cask for a cache that failed, beside a barricade)
    for (const s of [62, 65, ...Array.from({ length: 30 }, (_, i) => i)]) {
      const c = await start(['fighter', 'mage', 'thief', 'ranger'][s % 4], 'pc-' + s, REAL);
      for (let d = 2; d <= 7; d++) {
        c.Game.descend(); if (c.Game.forkPending()) c.Game.chooseRoute(s % 2 ? 'crypts' : 'warrens');
        const L = c.Game.level(), pc = (L.pieces || [])[0];
        // a scene's casks stand square in their squares; any such cask is one of its own
        for (const q of (L.dressing || []).filter(q => q.k === 'oilcask' && q.ox === 0 && q.oy === 0)) {
          if (!pc || !(pc.casks || []).some(([x, y]) => x === q.x && y === q.y)) { out.push(`pc-${s} floor ${d}: a cask at ${q.x},${q.y} belongs to no scene`); break; }
        }
        if (pc && pc.k === 'cache') {
          const ids = new Set(L.monsters.filter(m => pc.uids.includes(m.uid)).map(m => m.id));
          if (ids.size > 1 && pc.who) out.push(`a cache among ${[...ids]} was named for ${pc.who}`);
          if (ids.size === 1 && pc.who !== [...ids][0]) out.push(`a cache among ${[...ids]} was named ${pc.who}`);
          // (kept on its floor: this world goes no deeper)
          if (ids.size > 1 && !mixed) { mixed = { c, L, pc }; break; }
          if (!cache) { cache = { c, L, pc }; break; }
        }
      }
    }
    if (!mixed) out.push('no cache among a mixed group in the seeds tried');
    else {
      const { c, L, pc } = mixed, G = c.Game.state(), p = c.Game.player();
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      const mark = markLog(G);
      p.x = pc.x; p.y = pc.y; pc.said = false;
      run(c.Game, G, 100);
      if (!linesSince(G, mark).some(l => /among the sleeping creatures/.test(l))) out.push('a mixed group\'s cache was not named for creatures');
    }
    if (cache) {
      const { c, L, pc } = cache, G = c.Game.state(), p = c.Game.player(), T = c.Dungeon.T;
      p.hp = p.maxHp = 9999;
      for (const m of L.monsters) m.nextAct = 1e12;
      // a square near by, but walled off from every square of the scene
      const saved = L.tiles.slice();
      const spots = [[pc.x, pc.y], ...pc.casks];
      let hide = null;
      for (let dx = -3; dx <= 3 && !hide; dx++) for (let dy = -3; dy <= 3 && !hide; dy++) {
        const x = pc.x + dx, y = pc.y + dy;
        if (Math.abs(dx) + Math.abs(dy) !== 4 || L.tiles[y * L.w + x] !== T.FLOOR || spots.some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1)) continue;
        hide = [x, y];
      }
      if (!hide) out.push('no square four off the cache to hide on');
      else {
        for (let yy = hide[1] - 1; yy <= hide[1] + 1; yy++) for (let xx = hide[0] - 1; xx <= hide[0] + 1; xx++) if (xx !== hide[0] || yy !== hide[1]) L.tiles[yy * L.w + xx] = T.WALL;
        pc.said = false;
        let mark = markLog(G);
        p.x = hide[0]; p.y = hide[1];
        run(c.Game, G, 100);
        if (linesSince(G, mark).some(l => /Oil casks stand among/.test(l)) || pc.said) out.push('a cache behind stone was named');
        for (let i = 0; i < L.tiles.length; i++) L.tiles[i] = saved[i];
        // its casks gone before the hero comes: nothing to name
        L.dressing = (L.dressing || []).filter(q => !(q.k === 'oilcask' && pc.casks.some(([x, y]) => x === q.x && y === q.y)));
        mark = markLog(G);
        p.x = pc.x; p.y = pc.y;
        run(c.Game, G, 100);
        if (linesSince(G, mark).some(l => /Oil casks stand among/.test(l))) out.push('a cache whose casks were gone was named');
      }
    } else out.push('no cache in the seeds tried');
    return out.length ? out.join('; ') : true;
  });

  await test('playtest fixes: Burning Hands on oil says it sets it alight; a kicked cask says so before its oil spills; flames tell a creature burning once; a flooded floor\'s storm says step aside and a step aside answers it', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at, cast } = await arena('mage', 'el-playtest');
    L.twist = null;
    // Burning Hands at spilt oil, with nothing standing there
    const [ox, oy] = at(1);
    L.fields[`${ox},${oy}`] = { k: 'oil' };
    let mark = markLog(G);
    cast('burning_hands');
    let lines = linesSince(G, mark);
    if (lines.some(l => /strikes nothing/.test(l))) out.push('Burning Hands on oil said it struck nothing');
    if (!lines.some(l => /sets the oil alight/.test(l))) out.push(`Burning Hands on oil: ${lines.join(' / ')}`);
    if ((Game.fieldAt(ox, oy) || {}).k !== 'fire') out.push('the oil did not catch');
    if (countSaid(lines, /goes up in a sheet/) > 0) out.push('the fire\'s own line followed the spell\'s');
    // a cask kicked over: its staves, then its oil, and nothing about nothing inside
    L.fields = {}; L.dressing = [{ x: ox, y: oy, k: 'oilcask', ox: 0, oy: 0 }];
    mark = markLog(G);
    Game.input('forward');
    lines = linesSince(G, mark);
    // (by its staves: a cask that held gold says that "spills out" too)
    const staves = lines.findIndex(l => /cask/i.test(l) && /staves/.test(l)), spilt = lines.findIndex(l => /oil spills out/i.test(l));
    if (staves < 0 || spilt < 0 || staves > spilt) out.push(`a kicked cask told: ${lines.join(' / ')}`);
    // (what a broken cask holds is rolled for its square: casks all round, so one holds nothing)
    const dir0 = p.dir;
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = Dungeon.DIRS[k], x = p.x + dx, y = p.y + dy;
      if (L.tiles[y * L.w + x] !== Dungeon.T.FLOOR) continue;
      L.fields = {}; L.dressing = [{ x, y, k: 'oilcask', ox: 0, oy: 0 }]; p.dir = k;
      Game.input('forward');
      lines = lines.concat(linesSince(G, mark));
    }
    p.dir = dir0;
    if (lines.some(l => /nothing inside/.test(l))) out.push('a cask of oil had "nothing inside"');
    // an orc standing in burning oil for five seconds: the first tick told, the rest not
    L.fields = {}; L.dressing = []; L.monsters.length = 0;
    const [fx, fy] = at(2);
    const orc = put('orc', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    L.fields[`${fx},${fy}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 9000, burn: G.t + 100, gen: 0 };
    mark = markLog(G);
    run(Game, G, 5000);
    const told = countSaid(linesSince(G, mark), /burns for/);
    if (orc.hp > 999 - 8) out.push(`the orc hardly burnt (${orc.hp})`);
    if (told !== 1) out.push(`five seconds in the flames told the orc burning ${told} times`);
    // the storm: on a flooded floor there is no getting out of the water
    const warned = twist => {
      L.twist = twist; L.fields = {};
      for (let i = 0; i < 40; i++) {
        L.monsters.length = 0; G.blowGate = 0;
        const a = put('acolyte', 4, 0, { nextAct: G.t, hp: 80, maxHp: 80 });
        const m0 = markLog(G);
        run(Game, G, 30);
        if (a.windup && a.windup.move === 'storm') return linesSince(G, m0).join(' / ');
      }
      return '';
    };
    const flooded = warned('flooded');
    if (!/Step aside!/.test(flooded) || /Get out of the water/.test(flooded)) out.push(`on a flooded floor the storm warned: ${flooded}`);
    // a step aside takes half, and is the answer there
    L.monsters.length = 0; L.fields = {}; L.twist = 'flooded'; G.blowGate = 0;
    delete Game.bestiary().acolyte;
    const a = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    a.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    const [sx, sy] = Dungeon.DIRS[(p.dir + 1) % 4];
    p.x += sx; p.y += sy;
    const hp0 = p.hp;
    run(Game, G, 400);
    if (!(p.hp < hp0)) out.push('a step aside in a flooded floor took nothing');
    if (!(Game.bestiary().acolyte || {}).answer) out.push('a step aside from the storm on a flooded floor was not counted its answer');
    // on puddles, a step into the next one still takes half, and is not the answer (out of the water is)
    L.monsters.length = 0; L.twist = null; G.blowGate = 0; p.x -= sx; p.y -= sy;
    delete Game.bestiary().acolyte;
    L.dressing = [[0, 0], [sx, sy]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, k: 'puddle', ox: 0, oy: 0 }));
    const b = put('acolyte', 4, 0, { hp: 80, maxHp: 80 });
    b.windup = { kind: 'move', move: 'storm', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; b.nextAct = b.windup.until;
    p.x += sx; p.y += sy;
    const hp1 = p.hp;
    run(Game, G, 400);
    if (!(p.hp < hp1)) out.push('a step into the next puddle took nothing');
    if ((Game.bestiary().acolyte || {}).answer) out.push('a step into the next puddle was counted the storm\'s answer');
    L.dressing = [];
    // a burn it carries (Kindling's) is told every tick, flames under it or not
    L.monsters.length = 0; L.fields = {};
    const lit = put('orc', 2, 0, { hp: 999, maxHp: 999, nextAct: 1e12 });
    lit.dot = { kind: 'burning', until: G.t + 2500, next: G.t + 100, die: 4 };
    L.fields[`${lit.x},${lit.y}`] = { k: 'fire', fuel: 'oil', until: G.t + 9000, spread: G.t + 99999, burn: G.t + 99999, gen: 0 };
    const m2 = markLog(G);
    run(Game, G, 3000);
    const carried = countSaid(linesSince(G, m2), /burns for/);
    if (carried < 3) out.push(`a carried burn in flames was told ${carried} times of 3`);
    return out.length ? out.join('; ') : true;
  });

  await test('a scene is named from seven squares, before a sleeping group hears the hero; asleep only while they all are; a barricade by the casks seen from this side', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-sight');
    L.twist = null;
    const said = (setup) => {
      L.monsters.length = 0; L.dressing = [];
      const pc = setup();
      L.pieces = [pc];
      const mark = markLog(G);
      run(Game, G, 60);
      return linesSince(G, mark).filter(l => /cask/i.test(l)).join(' / ');
    };
    const cache = awake => said(() => {
      const a = put('goblin', 6, 0, { awake: false, nextAct: 1e12 }), b = put('goblin', 6, -1, { awake, nextAct: 1e12 });
      const [cx, cy] = at(5, 1);
      L.dressing.push({ x: cx, y: cy, k: 'oilcask', ox: 0, oy: 0 });
      return { k: 'cache', x: a.x, y: a.y, who: 'goblin', uids: [a.uid, b.uid], casks: [[cx, cy]] };
    });
    // six squares off, with nothing between
    const asleep = cache(false);
    if (!/among the sleeping goblins/.test(asleep)) out.push(`a cache six squares off: ${asleep || 'not named'}`);
    const stirring = cache(true);
    if (!/among the goblins/.test(stirring)) out.push(`a cache with one awake: ${stirring || 'not named'}`);
    // a locked door with a cask on this side and one beyond
    const door = said(() => {
      const [dx, dy] = at(4), [nx, ny] = at(3), [fx, fy] = at(5);
      L.tiles[dy * L.w + dx] = Dungeon.T.DOOR_LOCKED;
      L.dressing.push({ x: nx, y: ny, k: 'oilcask', ox: 0, oy: 0 }, { x: fx, y: fy, k: 'oilcask', ox: 0, oy: 0 });
      return { k: 'barricade', x: dx, y: dy, casks: [[nx, ny], [fx, fy]] };
    });
    if (!/An oil cask stands against the locked door/.test(door)) out.push(`a barricade with one cask this side: ${door || 'not named'}`);
    L.tiles[at(4)[1] * L.w + at(4)[0]] = Dungeon.T.FLOOR;
    // a group gone off after the hero, away from its casks: nothing to name, and no tip after it
    let gone = null;
    const left = said(() => {
      const a = put('goblin', 1, 1, { awake: true, nextAct: 1e12 });
      const [cx, cy] = at(6), [kx, ky] = at(6, 1);
      L.dressing.push({ x: kx, y: ky, k: 'oilcask', ox: 0, oy: 0 });
      return (gone = { k: 'cache', x: cx, y: cy, who: 'goblin', uids: [a.uid], casks: [[kx, ky]] });
    });
    if (left) out.push(`a cache its group had left was named: ${left}`);
    if (gone.named) out.push('a cache left unnamed was marked named');
    // a dark floor: named no further off than the dark lets the view reach
    L.twist = 'dark';
    const dark = cache(false);
    if (dark) out.push(`on a dark floor a cache six squares off was named: ${dark}`);
    L.twist = null;
    return out.length ? out.join('; ') : true;
  });

  await test('the view is told how far a door\'s burning has gone, and where a wraith\'s grave-cold has crept so far', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-looks');
    L.twist = null;
    const [dx, dy] = at(3);
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    L.fields[`${dx},${dy}`] = { k: 'fire', fuel: 'door', until: G.t + 6000, spread: G.t + 99999, burn: G.t + 99999, gen: 0 };
    const early = Game.renderState(0).fx.doorFire[`${dx},${dy}`];
    G.t += 4500;
    L.fields[`${dx},${dy}`].until = G.t + 1500;
    const late = Game.renderState(0).fx.doorFire[`${dx},${dy}`];
    if (!(early >= 0 && early < 0.1 && late > 0.7 && late <= 1)) out.push(`a burning door was told ${early} then ${late}`);
    if (Object.keys(Game.renderState(0).fx.doorFire || {}).length !== 1) out.push('a door not on fire was told burning');
    L.fields = {}; L.tiles[dy * L.w + dx] = Dungeon.T.FLOOR;
    // (no door burning, nothing to look up every column of every frame)
    if (Game.renderState(0).fx.doorFire !== null) out.push('with no door on fire the view was still handed a list of them');
    // a wraith three squares off: the frost starts at its feet and reaches the hero as it finishes
    const w = put('wraith', 3, 0, { hp: 80, maxHp: 80 });
    w.windup = { kind: 'move', move: 'chill', at: G.t, until: G.t + 1500, tx: p.x, ty: p.y };
    const frost = () => Game.renderState(0).fx.frost;
    const start = frost();
    G.t += 1499;
    const end = frost();
    if (!start.length || start.some(f => f.x === p.x && f.y === p.y)) out.push(`at the first breath the frost lay on ${JSON.stringify(start)}`);
    if (!end.some(f => f.x === p.x && f.y === p.y && f.a > 0.5)) out.push(`as the breath ended the frost lay on ${JSON.stringify(end)}`);
    w.windup = { kind: 'move', move: 'chill', at: G.t - 700, until: G.t + 800, tx: p.x + 1, ty: p.y + 1 };
    if (frost().length) out.push('frost was drawn off a straight line');
    w.windup = null;
    if (frost().length) out.push('frost was drawn with no grave-cold being breathed');
    return out.length ? out.join('; ') : true;
  });

  await test('fire tricks respect the way: a nimble hero can save against a firepot; a pot or a burning arrow stops at a door shut in its flight; a charger pulls up at whatever stands before the fire; a burnt doorway stays open under oil', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('thief', 'el-review3');
    L.twist = null;
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const pot = (extra = {}) => { const g = put('goblin', 4, 0, { hp: 50, maxHp: 50 }); g.windup = { kind: 'move', move: 'firepot', at: G.t, until: G.t + 100, tx: p.x, ty: p.y, dx: -fx, dy: -fy, ...extra }; g.nextAct = g.windup.until; return g; };
    // a Dex 30 hero turns from the worst of a pot now and then
    p.stats.dex = 30;
    let saved = 0;
    for (let i = 0; i < 20 && !saved; i++) {
      L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
      pot(); const mark = markLog(G); run(Game, G, 200);
      if (linesSince(G, mark).some(l => /turn from the worst/.test(l))) saved++;
    }
    if (!saved) out.push('a Dex 30 hero never saved against a firepot in twenty');
    // a door shut between the goblin and the hero takes the pot
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    const [dx, dy] = at(2);
    pot();
    L.tiles[dy * L.w + dx] = Dungeon.T.DOOR;
    let hp0 = p.hp; run(Game, G, 250);
    if (p.hp < hp0) out.push('a firepot came through a shut door');
    const mine = Game.fieldAt(p.x, p.y);
    if (mine && mine.k === 'fire') out.push('a firepot through a shut door lit the hero\'s square');
    // and a burning arrow
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    L.twist = 'overgrown';
    const a = put('archer', 4, 0, { hp: 50, maxHp: 50 });
    a.windup = { kind: 'move', move: 'firearrow', at: G.t, until: G.t + 100, tx: p.x, ty: p.y }; a.nextAct = a.windup.until;
    run(Game, G, 250);
    const f2 = Game.fieldAt(p.x, p.y);
    if (f2 && f2.k === 'fire') out.push('a burning arrow through a shut door lit the hero\'s square');
    L.twist = null; L.tiles[dy * L.w + dx] = Dungeon.T.FLOOR;
    // an orc charging with a skeleton before the fire stops behind the skeleton, not on it
    L.monsters.length = 0; L.fields = {}; G.blowGate = 0;
    const o = put('orc', 4, 0, { hp: 200, maxHp: 200 }), sk = put('skeleton', 3, 0, { hp: 200, maxHp: 200 });
    const [cx, cy] = at(2);
    L.fields[`${cx},${cy}`] = { k: 'fire', fuel: 'oil', until: G.t + 1e6, spread: 1e15, burn: 1e15, gen: 0, wild: true };
    o.windup = { kind: 'move', move: 'charge', at: G.t, until: G.t + 50, dx: -fx, dy: -fy }; o.nextAct = o.windup.until;
    run(Game, G, 150);
    if (o.x === sk.x && o.y === sk.y) out.push('the charger pulled up on top of the skeleton');
    // a burnt-through doorway under spilt oil still cannot be shut
    L.monsters.length = 0; L.fields = {};
    const [bx, by] = at(1);
    L.tiles[by * L.w + bx] = Dungeon.T.DOOR;
    L.fields[`${bx},${by}`] = { k: 'fire', fuel: 'door', until: G.t + 50, spread: 1e15, burn: 1e15, gen: 0 };
    run(Game, G, 200);
    L.fields[`${bx},${by}`] = { k: 'oil' };
    G.t = Math.max(G.t, p.nextAttack) + 10; Game.input('use');
    if (L.tiles[by * L.w + bx] !== Dungeon.T.DOOR_OPEN) out.push('a burnt doorway under oil was pulled shut');
    L.tiles[by * L.w + bx] = Dungeon.T.FLOOR;
    return out.length ? out.join('; ') : true;
  });

  await test('a cave wyrm\'s fire passes over the square under its jaws: a hero in close on moss is not set alight, the moss beyond is', async () => {
    const out = [];
    const { Game, Dungeon, G, L, p, put, at } = await arena('fighter', 'el-breath');
    L.twist = 'overgrown';
    const [fx, fy] = Dungeon.DIRS[p.dir];
    const m = put('wyrm', 1);
    // it breathes back down the passage, over the hero's head and on past
    m.windup = { kind: 'move', move: 'breath', at: G.t, until: G.t + 200, dx: -fx, dy: -fy }; m.nextAct = m.windup.until;
    run(Game, G, 300);
    const here = Game.fieldAt(p.x, p.y), [bx, by] = at(-1);
    if (here) out.push(`the square under its jaws took ${here.k}`);
    const beyond = Game.fieldAt(bx, by);
    if (!beyond || beyond.k !== 'fire') out.push('the moss past the hero did not catch');
    else if (!beyond.wild) out.push('the wyrm\'s fire was taken for the hero\'s own');
    return out.length ? out.join('; ') : true;
  });

  await test('a drowned one lies unseen under the water and rises within two squares, or at a blow into its ripple, or when trodden on, and reaches to seize you', async () => {
    const out = [];
    const ctx = await start('fighter', 'drowned-rise');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (const k of [1, 2, 3, 4, 5]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    const sunk = (dist, extra = {}) => { L.monsters.length = 0; const m = { uid: 70 + dist, id: 'drowned', x: p.x + dx * dist, y: p.y + dy * dist, hp: 40, maxHp: 40, awake: false, sunk: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    // three squares off it stays down, unseen
    let m = sunk(3);
    run(Game, G, 2000);
    if (!m.sunk || m.awake) out.push('a drowned one three squares off rose');
    // two squares off it rises, and reaches for you
    m = sunk(2);
    let mark = markLog(G);
    run(Game, G, 800);
    if (m.sunk || !m.awake || !linesSince(G, mark).some(l => /rises out of it/.test(l))) out.push(`two squares off: sunk ${!!m.sunk}, awake ${m.awake} (${linesSince(G, mark).join(' | ')})`);
    // trodden on: it rises, and the hero does not step into it
    m = sunk(1, { nextAct: 1e12 });
    mark = markLog(G);
    const x0 = p.x; Game.input('forward');
    if (m.sunk || p.x !== x0 || !linesSince(G, mark).some(l => /tread on something/.test(l))) out.push(`trodden on: sunk ${!!m.sunk}, hero moved ${p.x !== x0}`);
    if (!(m.windup && m.windup.move === 'grab')) out.push(`risen beside the hero it drew back ${m.windup ? m.windup.move || m.windup.kind : 'nothing'}, not a grab`);
    // struck in its ripple
    m = sunk(1, { nextAct: 1e12 });
    p.stats.str = 30;
    let rose = false;
    for (let i = 0; i < 10 && !rose; i++) { m.sunk = true; m.awake = false; mark = markLog(G); G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack'); rose = linesSince(G, mark).some(l => /Your blow finds something under the water/.test(l)); }
    if (!rose) out.push('no blow into the ripple brought it up');
    return out.length ? out.join('; ') : true;
  });

  await test('an eyeless stalker hunts by sound: a hero standing still is lost to it, and one who moves or strikes is found; asleep, it wakes to a sound, not a sight', async () => {
    const out = [];
    const ctx = await start('fighter', 'eyeless-hunt');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (const k of [1, 2, 3, 4, 5, 6]) L.tiles[(p.y + dy * k) * L.w + p.x + dx * k] = Dungeon.T.FLOOR;
    const place = (dist, extra = {}) => { L.monsters.length = 0; const m = { uid: 60, id: 'eyeless', x: p.x + dx * dist, y: p.y + dy * dist, hp: 400, maxHp: 400, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra }; L.monsters.push(m); return m; };
    // silent: it stops and listens, and never draws a blow
    p.noiseAt = -1e9;
    let m = place(4);
    const mark = markLog(G);
    let blows = 0;
    for (let t = 0; t < 4000; t += 25) { Game.update(G.t + 25, 25); if (m.windup && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 1) blows++; }
    if (!m.groping || !linesSince(G, mark).some(l => /listening for you/.test(l))) out.push(`a silent hero: groping ${!!m.groping}`);
    if (blows) out.push('it drew back a blow at a silent hero it was not beside');
    // noisy: it comes straight for you
    m = place(4);
    let closest = 4;
    for (let t = 0; t < 4000; t += 25) { p.noiseAt = G.t; Game.update(G.t + 25, 25); closest = Math.min(closest, Math.abs(m.x - p.x) + Math.abs(m.y - p.y)); }
    if (closest > 1) out.push(`a noisy hero: it came no nearer than ${closest}`);
    // beside a silent hero, it finds them by touch
    p.noiseAt = -1e9;
    m = place(1);
    let struck = false;
    for (let t = 0; t < 3000 && !struck; t += 25) { Game.update(G.t + 25, 25); struck = !!m.windup; }
    if (!struck) out.push('beside a silent hero it never struck');
    // asleep, it sleeps through a silent hero three squares off, and wakes to a step's noise
    p.noiseAt = -1e9;
    m = place(3, { awake: false });
    run(Game, G, 2000);
    if (m.awake) out.push('a sleeping eyeless woke to a silent hero');
    p.noiseAt = G.t; m.x = p.x + dx * 3; m.y = p.y + dy * 3; m.nextAct = G.t;
    run(Game, G, 400);
    if (!m.awake) out.push('a sleeping eyeless slept through a step');
    return out.length ? out.join('; ') : true;
  });

  await test('a puffcap bursts in spores at a hand\'s blow from beside it: a save or poisoned; not at a spell, nor through fire on the blade; a druid breathes them; fire burns it well, and it never flees', async () => {
    const out = [];
    /** Strike a puffcap beside the hero until a blow lands. @returns {string} what was said, or '' */
    const strike = (ctx, setup) => {
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      for (let i = 0; i < 12; i++) {
        const m = beside(ctx, 'puffcap', { hp: 999, maxHp: 999, nextAct: 1e12 });
        p.poison = null; setup && setup(p, m);
        const mark = markLog(G);
        G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack');
        const said = linesSince(G, mark).join(' | ');
        if (/You hit|mighty blow/.test(said)) return said;
      }
      return '';
    };
    {
      // a weak chest fails the save at least once in a dozen blows (a fighter's grit and a natural 20 still pass, often enough that four tries were not enough)
      const ctx = await start('fighter', 'puff-fighter');
      const p = ctx.Game.player(); p.hp = p.maxHp = 9999; p.stats.str = 30; p.stats.con = 1;
      let poisoned = false, said = '';
      for (let i = 0; i < 12 && !poisoned; i++) { said = strike(ctx); poisoned = !!p.poison; }
      if (!/bursts in a cloud of spores/.test(said) || !poisoned) out.push(`a blow on a puffcap: ${said} (poisoned ${poisoned})`);
      // fire on the blade sears them
      p.eq.weapon = { t: 'longsword', q: 1, e: 0, pw: 'flame' };
      const hot = strike(ctx);
      if (!/sears/.test(hot) || p.poison) out.push(`a flaming blade: ${hot} (poisoned ${!!p.poison})`);
    }
    {
      const ctx = await druid('puff-druid', 3);
      const p = ctx.Game.player(); p.stats.str = 30;
      const said = strike(ctx);
      if (!/breathe them as the moss does/.test(said) || p.poison) out.push(`a druid's blow: ${said} (poisoned ${!!p.poison})`);
    }
    {
      // a spell looses no spores, and fire burns it well
      const ctx = await start('mage', 'puff-mage');
      const { Game, SPELLS } = ctx; const p = Game.player(), G = Game.state();
      p.hp = p.maxHp = 9999; p.sp = p.maxSp = 99; p.stats.con = 1;
      const m = beside(ctx, 'puffcap', { hp: 999, maxHp: 999, nextAct: 1e12 });
      const mark = markLog(G);
      Game.castSpell(SPELLS.mage.find(sp => sp.id === 'magic_missile'));
      const said = linesSince(G, mark).join(' | ');
      if (!/Magic Missile|missile/i.test(said) || /spores/.test(said) || p.poison) out.push(`a spell at a puffcap beside the hero: ${said}`);
      const f = Game.elementFactor ? Game.elementFactor(m, 'fire') : ctx.ELEMENTS_TAKEN.puffcap.fire;
      if (f !== 1.5) out.push(`a puffcap takes ${f} of fire`);
      // cut low, it stands its ground (a blow at a quarter of its life or less puts three in ten others to flight)
      m.hp = 200; m.maxHp = 999;
      for (let i = 0; i < 20; i++) { G.t = Math.max(G.t, p.nextAttack) + 700; Game.input('attack'); if (m.hp <= 0 || m.fleeing) break; }
      if (m.fleeing) out.push('a puffcap turned to flee');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('the earned Daily deals a Ranger or a Druid from its own seed, keeps its own record, and leaves the first Daily as it was', async () => {
    const out = [];
    const ctx = await newContext();
    const { Daily } = ctx;
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const d = new Date(2026, 0, 1 + i), key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const main = Daily.heroFor(key), earned = Daily.heroFor(key, 'earned');
      if (!['ranger', 'druid'].includes(earned.cls)) { out.push(`the earned Daily of ${key} dealt a ${earned.cls}`); break; }
      if (['ranger', 'druid'].includes(main.cls) || main.opts.dailyKind || main.seed !== 'daily-' + key) { out.push(`the first Daily of ${key} changed: ${main.cls} ${main.seed}`); break; }
      if (earned.seed !== 'daily-earned-' + key || earned.opts.dailyKind !== 'earned' || earned.opts.daily !== key) { out.push(`the earned Daily of ${key}: ${earned.seed} ${JSON.stringify(earned.opts)}`); break; }
      seen.add(earned.cls);
    }
    if (seen.size !== 2) out.push(`in 120 days the earned Daily dealt only ${[...seen]}`);
    // a record of its own
    const key = '2026-03-01';
    Daily.start(key, 'earned');
    if (Daily.status(key).state !== 'fresh') out.push('starting the earned Daily used up the first');
    if (Daily.status(key, 'earned').state !== 'started') out.push('the earned Daily did not record its start');
    Daily.finish(key, { won: true, depth: 8, kills: 30, cls: 'druid', score: 1000 }, 'earned');
    if (Daily.status(key, 'earned').state !== 'done' || Daily.status(key).state !== 'fresh') out.push('finishing the earned Daily touched the first');
    if (!/^Deepdelve Ranger & Druid Daily 2026-03-01: Druid, claimed the Heart/.test(Daily.shareLine(key, Daily.status(key, 'earned').done, 'earned'))) out.push(`its line: ${Daily.shareLine(key, Daily.status(key, 'earned').done, 'earned')}`);
    if (Daily.streak(key) !== 0 || Daily.streak(key, 'earned') !== 1) out.push(`streaks: first ${Daily.streak(key)}, earned ${Daily.streak(key, 'earned')}`);
    return out.length ? out.join('; ') : true;
  });

  await test('Old Campaigners wants the veteran at the hero\'s side at the end, not left on another floor', async () => {
    const out = [];
    const ctx = await newContext();
    const { Game } = ctx;
    const win = (depthOff, seed) => {
      Game.newGame({ name: 'K', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, permadeath: true, difficulty: 'normal' } });
      const G = Game.state();
      G.companion = { kind: 'hound', name: 'Ash', x: 0, y: 0, depth: G.depth + depthOff, hp: 5, maxHp: 5, mode: depthOff ? 'stay' : 'follow', joined: 1, floors: 4 };
      winHere(Game); return Game.earned().firstFeats;
    };
    if (win(1, 'vet-stay').includes('veteran')) out.push('a veteran left on another floor earned Old Campaigners');
    if (!win(0, 'vet-here').includes('veteran')) out.push('a veteran at the hero\'s side did not earn Old Campaigners');
    return out.length ? out.join('; ') : true;
  });
};
