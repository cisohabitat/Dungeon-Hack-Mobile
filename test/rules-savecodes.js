// Rule checks for save codes.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function savecodesChecks(h) {
  const { newContext, start, markLog, linesSince, test, beside, run, fallTo } = h;

  // ---------- save codes ----------
  await test('a save code carries a hero to another device, and a bad one says why and harms nothing', async () => {
    const out = [];
    const a = await start('mage', 'code-carry', { levels: 6 });
    { const { Game } = a; const p = Game.player();
      Game.level().monsters.length = 0; Game.descend();
      p.gold = 321; p.hp = Math.max(1, p.hp - 2); }
    const code = await a.Game.saveCode();
    const want = { name: a.Game.player().name, depth: a.Game.state().depth, gold: a.Game.player().gold, hp: a.Game.player().hp, inv: a.Game.player().inv.length };
    if (!code || !/^DD1\./.test(code)) return `the code came out as ${String(code).slice(0, 20)}`;
    // another device: a fresh world with its own storage and a hero of its own waiting
    const b = await start('fighter', 'code-other');
    b.Game.save(true);
    const before = b.store.get('deepdelve.save');
    for (const [bad, why] of [['hello there', /not a Deepdelve save code/], [code.slice(0, Math.floor(code.length / 2)), /not whole/], ['DD1.' + 'A'.repeat(40), /not whole/]]) {
      const r = await b.Game.loadCode(bad);
      if (r.ok || !why.test(r.why || '')) out.push(`a bad code (${bad.slice(0, 12)}…) said: ${r.why}`);
    }
    if (b.store.get('deepdelve.save') !== before) out.push('a bad code touched the hero already saved here');
    // a code pasted from a message, broken over lines and spaced out
    const r = await b.Game.loadCode('  ' + code.replace(/(.{60})/g, '$1\n ') + '\n');
    if (!r.ok) return `the code would not load: ${r.why}`;
    const got = { name: b.Game.player().name, depth: b.Game.state().depth, gold: b.Game.player().gold, hp: b.Game.player().hp, inv: b.Game.player().inv.length };
    if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`the hero came over as ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
    if (!b.Game.hasSave()) out.push('the hero from the code was not kept as the save here');
    return out.length ? out.join('; ') : true;
  });

  await test('a save code cannot take back a permadeath run on the device that played it; a gentler run loads any code', async () => {
    const out = [];
    const ctx = await start('fighter', 'code-perma', { levels: 6, permadeath: true });
    const { Game } = ctx;
    const old = await Game.saveCode();
    Game.level().monsters.length = 0; run(Game, Game.state(), 2000); Game.descend();
    Game.save(true);
    const late = await Game.saveCode();
    const r1 = await Game.loadCode(old);
    if (r1.ok || !/further/.test(r1.why || '')) out.push(`an older code for a permadeath run loaded: ${r1.why}`);
    const r2 = await Game.loadCode(late);
    if (!r2.ok) out.push(`the latest code for a living permadeath hero was refused: ${r2.why}`);
    if (!fallTo(ctx)) return 'the hero would not die';
    const r3 = await Game.loadCode(late);
    if (r3.ok || !/already ended/.test(r3.why || '')) out.push(`a code for a permadeath hero who died here loaded: ${r3.why}`);
    // on a device that never saw the run, the same code loads (the guard is each device's own)
    const other = await newContext();
    const r4 = await other.Game.loadCode(late);
    if (!r4.ok) out.push(`a device that never saw the run refused its code: ${r4.why}`);
    // a run without permadeath goes back to any code, as its own Load Game does
    const soft = await start('fighter', 'code-soft', { levels: 6, permadeath: false });
    const early = await soft.Game.saveCode();
    soft.Game.level().monsters.length = 0; soft.Game.descend(); soft.Game.save(true);
    const r5 = await soft.Game.loadCode(early);
    if (!r5.ok || soft.Game.state().depth !== 1) out.push(`a gentler run would not go back to an older code: ${r5.why}`);
    return out.length ? out.join('; ') : true;
  });

  await test('saves made while the game stands still (switching apps) do not make a device refuse a code played further elsewhere', async () => {
    const a = await start('fighter', 'code-switch', { levels: 6, permadeath: true });
    const code = await a.Game.saveCode();
    // the page is put away twice to paste it into a message: two saves, no play
    a.Game.save(true); a.Game.save(true);
    const keep = new Map(a.store);
    // another device plays on from the code a little, and sends it back
    const b = await newContext();
    if (!(await b.Game.loadCode(code)).ok) return 'the other device would not take the code';
    b.Game.level().monsters.length = 0; run(b.Game, b.Game.state(), 5000);
    const back = await b.Game.saveCode();
    // the first device again, with its own storage as it was
    const a2 = await newContext();
    for (const [k, v] of keep) a2.store.set(k, v);
    const r = await a2.Game.loadCode(back);
    return r.ok || `a code played further was refused: ${r.why}`;
  });

  await test('a code from elsewhere is made safe before the page writes it out', async () => {
    const a = await start('fighter', 'code-clean', { levels: 6 });
    a.Game.state().log.push({ m: 'x', c: '"><img src=x onerror=alert(1)>' });
    a.Game.player().gold = '<b>1</b>';
    const code = await a.Game.saveCode();
    const b = await newContext();
    if (!(await b.Game.loadCode(code)).ok) return 'the code would not load';
    const bad = b.Game.state().log.find(e => /onerror/.test(e.c || ''));
    if (bad) return 'a log line kept a class with markup in it';
    return b.Game.player().gold === 0 || `gold came in as ${JSON.stringify(b.Game.player().gold)}`;
  });

  await test('a hero dies once, however many blows land in the swing that kills them', async () => {
    for (let tries = 0; tries < 30; tries++) {
      const ctx = await start('fighter', 'die-once' + tries);
      const { Game } = ctx; const p = Game.player(), G = Game.state();
      p.eq.offhand = { t: 'dagger', q: 1, e: 0 };
      p.stats.str = 30; p.stats.dex = 30;
      // every blow lands: the last try ending on a miss once failed this as 'no swing killed the hero'
      p.perkHit = 60;
      const m = beside(ctx, 'quillback', { hp: 999, maxHp: 999, nextAct: 1e12 });
      m.windup = { kind: 'move', move: 'bristle', at: G.t, until: G.t + 1e9 };
      p.hp = 1;
      const mark = markLog(G);
      G.t = Math.max(G.t, p.nextAttack); Game.input('attack');
      if (G.status !== 'dead') continue;                  // the blow missed: again
      const said = linesSince(G, mark);
      const deaths = said.filter(l => /has died/.test(l)).length;
      if (!said.some(l => /off hand/i.test(l)) && tries < 29) continue;   // wanted: a swing whose off hand would have followed
      return deaths === 1 || `the death was told ${deaths} times: ${said.join(' | ')}`;
    }
    return 'no swing killed the hero';
  });

  await test('a blink hound does not blink through a wall to a hero it could not walk to', async () => {
    const ctx = await start('fighter', 'blink-wall');
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level(), T = Dungeon.T;
    p.hp = p.maxHp = 9999;
    // a hound two squares ahead with a wall between, and no way round near
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) { const x = p.x + xx, y = p.y + yy; if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = T.WALL; }
    L.tiles[p.y * L.w + p.x] = T.FLOOR; L.tiles[(p.y - dy) * L.w + p.x - dx] = T.FLOOR;
    L.tiles[(p.y + 2 * dy) * L.w + p.x + 2 * dx] = T.FLOOR;
    L.monsters.length = 0;
    const m = { uid: 91, id: 'hound', x: p.x + 2 * dx, y: p.y + 2 * dy, hp: 999, maxHp: 999, awake: true, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, blows: 1 };
    L.monsters.push(m);
    for (let i = 0; i < 400; i++) { Game.update(G.t + 25, 25); if (m.windup && m.windup.move === 'blink') return 'it blinked through the wall'; }
    return true;
  });
};
