// Rule checks for the choices that come back two floors on (js/threads.js),
// run from rules.js with its helpers lent in.
module.exports = async function threadChecks(h) {
  const { test, start, meetAndChoose, markLog, linesSince } = h;

  /** A run with this thread made on the first floor, carried down to the third; what was said there, and the floor. */
  const twoFloorsOn = async (id, seed, opts = {}, made = 1) => {
    const ctx = await start('fighter', seed, { levels: 6, ...opts });
    const { Game } = ctx; const G = Game.state(), p = Game.player();
    p.hp = p.maxHp = 9999;
    (G.threads = G.threads || {})[id] = made;
    const said = [];
    for (let d = 2; d <= made + 2; d++) {
      Game.level().monsters.length = 0;
      const mark = markLog(G);
      Game.descend();
      if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
      said.push(...linesSince(G, mark).map(l => `${G.depth}: ${l}`));
    }
    return { ctx, Game, G, p, L: Game.level(), said: said.join(' | ') };
  };
  const near = (p, items) => Object.entries(items).some(([k, pile]) => { const [x, y] = k.split(',').map(Number); return Math.abs(x - p.x) + Math.abs(y - p.y) <= 3 && pile.length; });

  await test('each of the eight choices that come back is started by its encounter\'s choice', async () => {
    const { ENCOUNTERS } = await import('../js/encounters.js');
    const want = { mercy: 'spared', toll: 'tollpaid', statue: 'oath', shrine: 'offering', lastdelver: 'fed', wyrmegg: 'egg' };
    const out = [];
    const threadsOf = e => JSON.stringify(e).match(/"thread":"(\w+)"/g) || [];
    for (const [enc, id] of Object.entries(want)) if (!threadsOf(ENCOUNTERS[enc]).includes(`"thread":"${id}"`)) out.push(`${enc} starts no ${id}`);
    if (!threadsOf(ENCOUNTERS.toll).includes('"thread":"tollowed"')) out.push('crossing the toll starts nothing');
    if (!threadsOf(ENCOUNTERS.lastdelver).includes('"thread":"delverShade"')) out.push('robbing the last delver starts nothing');
    // and played: paying the toll (no die to roll) starts its thread
    const ctx = await start('fighter', 'thread-toll', { levels: 6 });
    ctx.Game.player().gold = 999;
    meetAndChoose(ctx, 'toll', 0);
    if (ctx.Game.state().threads.tollpaid !== 1) out.push(`paying the toll left ${JSON.stringify(ctx.Game.state().threads)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the spared goblin shows the traps and watches your back: the first foe to draw back a blow at you takes its knife, once, and is left open', async () => {
    const out = [];
    const a = await twoFloorsOn('spared', 'two-spared');
    if (!/goblin's scratch-mark by the stair/.test(a.said)) out.push(`the spared goblin said nothing: ${a.said}`);
    if (!a.G.threads.sparedPaid || a.G.threads.sparedPaid !== 3) out.push(`paid on ${a.G.threads.sparedPaid}, not floor 3`);
    if (/scratch-mark/.test(a.said.split(' | ').filter(l => l.startsWith('2:')).join(' '))) out.push('it came a floor early');
    // a foe beside the hero draws back a blow: the goblin drops on it instead
    const { Game, G, p } = a;
    const [dx, dy] = a.ctx.Dungeon.DIRS[p.dir];
    a.L.tiles[(p.y + dy) * a.L.w + p.x + dx] = a.ctx.Dungeon.T.FLOOR;
    const m = { uid: 77, id: 'orc', x: p.x + dx, y: p.y + dy, hp: 200, maxHp: 200, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, moveReady: 1e12 };
    a.L.monsters.push(m);
    const mark = markLog(G);
    for (let i = 0; i < 40 && !G.threads.sparedStruck; i++) Game.update(G.t + 25, 25);
    const said = linesSince(G, mark).join(' | ');
    if (!G.threads.sparedStruck) out.push(`it never came: ${said}`);
    else {
      if (!(m.hp < 200) || !/the goblin you spared/.test(said)) out.push(`its knife did nothing: ${said}`);
      if (!p.opening || p.opening.uid !== m.uid) out.push('the foe was not left open');
      if (m.windup) out.push('the foe\'s blow still came');
    }
    // and only once
    const hp1 = m.hp; m.windup = null; m.nextAct = G.t;
    for (let i = 0; i < 80; i++) Game.update(G.t + 25, 25);
    if (linesSince(G, mark).filter(l => /the goblin you spared/.test(l)).length > 1) out.push('it came twice');
    void hp1;
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, a toll paid brings a truce: the floor\'s goblins let the hero by, change places rather than block the way, and fight once one is struck; the stair down is shown', async () => {
    const out = [];
    let r = null;
    for (let i = 0; i < 12 && !r; i++) {
      const t = await twoFloorsOn('tollpaid', 'two-toll-' + i);
      if (t.L.monsters.some(m => ['goblin', 'archer', 'pikeman'].includes(m.id))) r = t;
    }
    if (!r) return 'no third floor of twelve held a goblin';
    const { Game, G, p, L } = r;
    if (!/chalks the way down/.test(r.said)) out.push(`the toll-goblin said nothing: ${r.said}`);
    const s = L.stairsDown;
    if (s && !L.explored[s.y * L.w + s.x]) out.push('the stair down was not shown');
    const kin = L.monsters.filter(m => ['goblin', 'archer', 'pikeman'].includes(m.id));
    if (!kin.every(m => m.truce)) out.push('a goblin of the floor kept no truce');
    // one brought beside the hero: it does nothing, and changes places when walked into
    const g = kin[0];
    const [dx, dy] = r.ctx.Dungeon.DIRS[p.dir];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = r.ctx.Dungeon.T.FLOOR;
    g.x = p.x + dx; g.y = p.y + dy; g.nextAct = G.t;
    const hp0 = p.hp;
    for (let i = 0; i < 120; i++) Game.update(G.t + 25, 25);
    if (p.hp < hp0 || g.windup) out.push('a goblin at truce went for the hero');
    const x0 = p.x, y0 = p.y;
    Game.input('forward');
    if (p.x === x0 && p.y === y0) out.push('a goblin at truce blocked the way');
    else if (g.x !== x0 || g.y !== y0) out.push(`it did not take the hero's square (${g.x},${g.y})`);
    // struck, the truce breaks
    p.dir = (p.dir + 2) % 4; p.stats.str = 30;
    for (let i = 0; i < 20 && g.truce; i++) { p.nextAttack = 0; Game.input('attack'); G.t += 1500; }
    if (g.truce) out.push('struck, it kept the truce');
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the toll crossed sends its big friend, the robbed delver their shade, the smashed egg its mother: awake at the stair', async () => {
    const out = [];
    for (const [id, kind, made] of [['tollowed', 'ogre', 2], ['delverShade', 'wraith', 1], ['egg', 'wyrm', 1]]) {
      const r = await twoFloorsOn(id, 'two-' + id, {}, made);
      const m = r.L.monsters.find(x => x.id === kind && x.awake);
      if (!m) { out.push(`${id}: no ${kind} waiting (said: ${r.said.slice(0, 160)})`); continue; }
      const d = Math.abs(m.x - r.p.x) + Math.abs(m.y - r.p.y);
      if (d < 2 || d > 9) out.push(`${id}: the ${kind} stood ${d} squares off`);
    }
    // the toll's friend is an orc where an ogre would be too much
    const shallow = (await twoFloorsOn('tollowed', 'two-toll-shallow')).L.monsters.some(x => x.id === 'orc' && x.awake);
    if (!shallow) out.push('on the third floor the toll\'s friend was not an orc');
    return out.length ? out.join('; ') : true;
  });

  await test('two floors on, the captive\'s door stands unbarred, the knight\'s blade lies on the floor, the old stone opens a spring, the fed delver leaves a page that maps the floor', async () => {
    const out = [];
    {
      // a floor with a locked door: the nearest one is unbarred (a floor with none waits for one that has)
      let done = false;
      for (let i = 0; i < 12 && !done; i++) {
        const r = await twoFloorsOn('captive', 'two-captive-' + i, { lockedDoors: true });
        if (r.G.threads.captivePaid) {
          done = true;
          if (!/the lock hangs broken/.test(r.said)) out.push('the captive\'s door was opened unsaid');
          if (Object.keys(r.L.locks || {}).length && !r.L.tiles.some(t => t === r.ctx.Dungeon.T.DOOR)) out.push('no door left unbarred');
        }
      }
      if (!done) out.push('in twelve runs no captive\'s door was opened');
    }
    {
      const r = await twoFloorsOn('oath', 'two-oath');
      const blade = Object.values(r.L.items).flat().find(it => it.e === 2 && r.ctx.ITEMS[it.t].kind === 'weapon' && r.ctx.ITEMS[it.t].cls.includes('fighter'));
      if (!blade) out.push('no blade for the oath');
    }
    {
      // the old stone's keeper opens a spring by the stair; drunk, it heals and watches over the hero
      const r = await twoFloorsOn('offering', 'two-offering');
      const { Game, G, p, L } = r;
      const k = Object.keys(L.features || {}).find(k => L.features[k].blessed);
      if (!k) out.push(`no spring opened: ${r.said}`);
      else {
        const [x, y] = k.split(',').map(Number);
        if (L.tiles[y * L.w + x] !== r.ctx.Dungeon.T.FOUNTAIN) out.push('the spring is no fountain');
        if (Math.abs(x - p.x) + Math.abs(y - p.y) > 6) out.push('the spring is not by the stair');
        p.hp = 3;
        // face it from a square beside it and step in
        const dirs = r.ctx.Dungeon.DIRS;
        const from = dirs.map(([dx, dy], i) => ({ x: x - dx, y: y - dy, i })).find(q => L.tiles[q.y * L.w + q.x] === r.ctx.Dungeon.T.FLOOR);
        if (!from) out.push('no square beside the spring');
        else {
          p.x = from.x; p.y = from.y; p.dir = from.i;
          Game.input('forward');
          if (p.hp !== p.maxHp) out.push(`the spring left the hero on ${p.hp}`);
          if (!(p.effects.boon_hit && p.effects.boon_hit.until > G.t)) out.push('the spring watched over no one');
        }
      }
    }
    {
      // the last delver leaves a page of their own; read, it shows the floor's hidden doors and traps
      let done = false;
      for (let i = 0; i < 12 && !done; i++) {
        const r = await twoFloorsOn('fed', 'two-fed-' + i, { traps: true });
        const T = r.ctx.Dungeon.T, L = r.L;
        const { JOURNAL } = await import('../js/data.js');
        const own = JOURNAL.findIndex(e => e.thread === 'fed');
        const k = Object.keys(L.items).find(k => L.items[k].some(it => it.t === 'page' && it.page === own));
        if (!k) { out.push(`no page from the fed delver: ${r.said}`); break; }
        if (!L.tiles.includes(T.SECRET)) continue;
        done = true;
        const [x, y] = k.split(',').map(Number);
        r.p.x = x; r.p.y = y;
        const m0 = markLog(r.G);
        r.Game.input('take');
        const told = linesSince(r.G, m0).join(' | ');
        if (!r.G.journal.some(j => j.i === own)) out.push(`the delver's page was not read: ${told}`);
        if (L.tiles.includes(T.SECRET)) out.push(`a hidden door was still hidden after the page was read: ${told}`);
        if (Object.keys(L.traps || {}).length && !L.trapsKnown) out.push('the traps were not shown');
      }
      if (!done) out.push('no floor of twelve held both the page and a hidden door');
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a choice that comes back does so once, and the hero sheet says so', async () => {
    const r = await twoFloorsOn('tollpaid', 'two-once');
    const { Game, G } = r;
    const out = [];
    const notes = Game.threadNotes().join(' ');
    if (!/sent word ahead/.test(notes)) out.push(`the sheet said: ${notes}`);
    Game.level().monsters.length = 0;
    const mark = markLog(G);
    Game.descend();
    if (Game.forkPending && Game.forkPending()) Game.chooseRoute('crypts');
    if (linesSince(G, mark).some(l => /chalks the way down/.test(l))) out.push('the toll-goblin came again on the next floor');
    return out.length ? out.join('; ') : true;
  });
};
