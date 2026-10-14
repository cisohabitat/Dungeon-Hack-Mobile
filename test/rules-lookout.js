// Rule checks for the Goblin Lookout, which runs for the floor's sleepers (foes.js fetchHelp).
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function lookoutChecks(h) {
  const { start, markLog, linesSince, test, run } = h;

  /** A corridor straight ahead: the lookout two squares off, a sleeper eight further. */
  const lay = async seed => {
    const ctx = await start('fighter', seed);
    const { Game, Dungeon } = ctx; const p = Game.player(), G = Game.state(), L = Game.level();
    p.hp = p.maxHp = 9999;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    for (let i = 1; i <= 11; i++) { const x = p.x + dx * i, y = p.y + dy * i; if (x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1) L.tiles[y * L.w + x] = Dungeon.T.FLOOR; }
    L.monsters.length = 0;
    const mk = (uid, id, i, extra) => ({ uid, id, x: p.x + dx * i, y: p.y + dy * i, hp: 20, maxHp: 20, nextAct: G.t, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra });
    const look = mk(70, 'lookout', 2, { awake: true });
    const sleeper = mk(71, 'orc', 10, { awake: false, nextAct: 1e12 });
    L.monsters.push(look, sleeper);
    return { ctx, Game, G, p, L, look, sleeper };
  };

  await test('a lookout that sees the hero runs for the floor\'s sleepers and whistles them awake; brought down first, it wakes no one', async () => {
    const out = [];
    {
      const r = await lay('lookout-run');
      const mark = markLog(r.G);
      run(r.Game, r.G, 12000);
      const said = linesSince(r.G, mark).join(' | ');
      if (!/runs, shrieking, for the others/.test(said)) out.push(`it never ran: ${said}`);
      if (!r.sleeper.awake) out.push(`the sleeper slept on: ${said}`);
      if (!/shrill whistle/.test(said)) out.push(`no whistle: ${said}`);
      if (!r.look.fetched) out.push('the lookout never finished fetching');
    }
    {
      const r = await lay('lookout-kill');
      r.p.stats.str = 30; r.look.hp = 1;
      // it is beside the hero's line two squares off: step up and strike it before it gets far
      r.Game.input('forward');
      for (let i = 0; i < 20 && r.L.monsters.includes(r.look); i++) { r.p.nextAttack = 0; r.Game.input('attack'); r.G.t += 50; }
      run(r.Game, r.G, 3000);
      if (r.L.monsters.includes(r.look)) out.push('the lookout was never caught');
      else if (r.sleeper.awake) out.push('brought down first, it still woke the sleeper');
    }
    return out.length ? out.join('; ') : true;
  });
};
