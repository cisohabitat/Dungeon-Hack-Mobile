// Rule checks for the music.
// Run from rules.js's worker with the helpers lent in (rules-lib.js).
module.exports = async function musicChecks(h) {
  const { start, test, beside } = h;

  // ---------- the music ----------
  await test('the music hears how the fight stands: quiet, wary, fight, a champion, the lich', async () => {
    const ctx = await start('fighter', 'mood');
    const { Game, Dungeon } = ctx;
    const out = [], p = Game.player(), L = Game.level(), G = Game.state();
    L.monsters.length = 0;
    if (Game.mood() !== 'quiet') out.push(`with nothing about: ${Game.mood()}`);
    // a straight open run east of the hero, walled either side, so steps and squares agree
    for (let k = 1; k <= 10; k++) { L.tiles[p.y * L.w + p.x + k] = Dungeon.T.FLOOR; L.tiles[(p.y - 1) * L.w + p.x + k] = Dungeon.T.WALL; L.tiles[(p.y + 1) * L.w + p.x + k] = Dungeon.T.WALL; }
    const later = () => { G.t += 300; };     // the walking distances are worked out afresh every quarter second
    const put = (id, d, extra = {}) => {
      L.monsters.length = 0;
      L.monsters.push({ uid: 5, id, x: p.x + d, y: p.y, hp: 50, maxHp: 50, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0, ...extra });
      later();
    };
    put('goblin', 8, { awake: false });
    if (Game.mood() !== 'quiet') out.push(`a goblin asleep: ${Game.mood()}`);
    put('goblin', 8);
    if (Game.mood() !== 'wary') out.push(`a goblin awake eight squares off: ${Game.mood()}`);
    put('goblin', 2);
    if (Game.mood() !== 'fight') out.push(`a goblin awake two squares off: ${Game.mood()}`);
    // it steps back out of reach: the fight holds a moment, then eases
    put('goblin', 8);
    if (Game.mood() !== 'fight') out.push(`a goblin stepping out of reach ended the fight at once: ${Game.mood()}`);
    G.t += 3000;
    if (Game.mood() !== 'wary') out.push(`three seconds later, still ${Game.mood()}`);
    // awake two squares off through a wall, with no way round: no fight
    L.tiles[p.y * L.w + p.x + 1] = Dungeon.T.WALL;
    put('goblin', 2);
    G.t += 3000;
    if (Game.mood() !== 'quiet') out.push(`a goblin behind a wall it cannot pass: ${Game.mood()}`);
    L.tiles[p.y * L.w + p.x + 1] = Dungeon.T.FLOOR;
    put('grisk', 6, { spoke: true });
    if (Game.mood() !== 'champion') out.push(`Grisk awake and spoken: ${Game.mood()}`);
    put('shade', 3, { spoke: true, shade: { name: 'Wren', cls: 'mage', level: 3, run: 'x', depth: 2 } });
    if (Game.mood() !== 'champion') out.push(`a shade awake: ${Game.mood()}`);
    beside(ctx, 'lich', { spoke: true, nextAct: 1e12 });
    if (Game.mood() !== 'boss') out.push(`the lich awake: ${Game.mood()}`);
    L.monsters = L.monsters.filter(m => m.id !== 'lich');
    beside(ctx, 'warlord', { spoke: true, nextAct: 1e12 });
    if (Game.mood() !== 'warlord') out.push(`the Warlord awake: ${Game.mood()}`);
    G.status = 'dead';
    if (Game.mood() !== 'quiet') out.push(`over the fallen: ${Game.mood()}`);
    void Dungeon;
    return out.length ? out.join('; ') : true;
  });

  await test('the music keeps to each floor\'s scale, grows with the fight, and comes home when it ends', async () => {
    const { Music } = await start('fighter', 'music');
    const out = [];
    const inScale = (theme, midi) => { const sc = Music.SCALES[theme]; return sc.steps.includes(((midi - sc.root) % 12 + 12) % 12); };
    const count = (steps, k) => steps.reduce((n, s) => n + s.notes.filter(x => x.k === k).length, 0);
    for (let theme = 0; theme < Music.SCALES.length; theme++) {
      for (const mood of Music.MOODS) {
        const steps = Music.plan(mood, theme, 64);
        const stray = steps.flatMap(s => s.notes).filter(n => n.k !== 'thud' && !inScale(theme, n.midi));
        if (stray.length) out.push(`theme ${theme}, ${mood}: ${stray.length} notes off its scale`);
      }
    }
    // the dark elves' halls chime, high and far off, while all is still; no other floor does
    const chimes = theme => Music.plan('quiet', theme, 64).flatMap(s => s.notes).filter(n => n.k === 'bell' && n.len === 3 && n.midi >= Music.SCALES[theme].root + 24).length;
    if (!(chimes(8) >= 4)) out.push(`the elves' halls chimed ${chimes(8)} times in 64 quiet steps`);
    if (chimes(0) || chimes(7)) out.push('another floor chimed like the elves\' halls');
    // and the grey dwarves' hold rings with far-off hammers on an anvil; no other floor does
    const anvils = theme => Music.plan('quiet', theme, 64).flatMap(s => s.notes).filter(n => n.k === 'bell' && n.len === 0.15).length;
    if (!(anvils(9) >= 8)) out.push(`the grey dwarves' hold rang ${anvils(9)} hammers in 64 quiet steps`);
    if (anvils(0) || anvils(8)) out.push('another floor rang hammers like the dwarves\' hold');
    // and the lizardfolk's marsh croaks with frogs; no other floor does
    const frogs = theme => Music.plan('quiet', theme, 72).flatMap(s => s.notes).filter(n => n.k === 'pulse' && n.len === 0.1).length;
    if (!(frogs(10) >= 6)) out.push(`the marsh croaked ${frogs(10)} times in 72 quiet steps`);
    if (frogs(0) || frogs(9)) out.push('another floor croaked like the marsh');
    const quiet = Music.plan('quiet', 0, 64), wary = Music.plan('wary', 0, 64), fight = Music.plan('fight', 0, 64), champ = Music.plan('champion', 0, 64), boss = Music.plan('boss', 0, 64);
    // quiet is sparse: bells, a long silence between phrases, no beat
    const quietBells = count(quiet, 'bell');
    if (quietBells < 3 || quietBells > 24) out.push(`quiet rang ${quietBells} bells in 64 steps`);
    if (count(quiet, 'pulse') || count(quiet, 'thud')) out.push('quiet has a beat');
    if (!count(wary, 'pulse') || count(wary, 'thud')) out.push('wary should pulse, not beat');
    if (count(fight, 'pulse') < 60 || count(fight, 'thud') < 12) out.push(`a fight pulsed ${count(fight, 'pulse')} and beat ${count(fight, 'thud')}`);
    if (count(fight, 'horn') || !count(champ, 'horn') || !count(boss, 'horn')) out.push('only a champion or the lich brings the horn');
    if (!(boss[0].dur < fight[0].dur && fight[0].dur < quiet[0].dur)) out.push('the music does not quicken with the fight');
    // the Warlord's hall is led by his drum: more of the beat than the lich's, and still the horn
    const warlord = Music.plan('warlord', 0, 64);
    if (!(count(warlord, 'thud') > count(boss, 'thud')) || !count(warlord, 'horn')) out.push(`the Warlord's music beat ${count(warlord, 'thud')} to the lich's ${count(boss, 'thud')}`);
    // two floors sound different
    const tune = t => Music.plan('fight', t, 16).flatMap(s => s.notes.filter(n => n.k === 'bell').map(n => n.midi)).join();
    if (tune(0) === tune(4)) out.push('the Grey Halls and the Crimson Crypts play the same fight');
    // a fight ending: home to the floor's own note, then a hush
    const sc = Music.SCALES[0];
    const c = [];
    Music.listen(n => c.push(n));
    try {
      for (let t = 0; t < 4000; t += 50) Music.update('fight', 0, 10000 + t);
      c.length = 0;
      for (let t = 0; t < 1200; t += 50) Music.update('quiet', 0, 14000 + t);
      const bells = c.filter(n => n.k === 'bell');
      if (!bells.length || (bells[bells.length - 1].midi - sc.root) % 12 !== 0) out.push(`the fight's end did not come home: ${bells.map(n => n.midi).join(',')}`);
      c.length = 0;
      for (let t = 1200; t < 1200 + (Music.HUSH_S - 2) * 1000; t += 50) Music.update('quiet', 0, 14000 + t);
      if (c.some(n => n.k === 'bell')) out.push('the bells came back before the hush was over');
      // and it is silent when turned off
      Music.toggle();
      c.length = 0;
      for (let t = 0; t < 3000; t += 50) Music.update('fight', 0, 40000 + t);
      if (c.length) out.push('the music played while turned off');
    } finally { if (!Music.isEnabled()) Music.toggle(); Music.listen(null); Music.stop(); }
    return out.length ? out.join('; ') : true;
  });

  await test('the music fades a fight out rather than stopping dead, and a fight come back ends the fade', async () => {
    const { Music } = await start('fighter', 'musictail');
    const out = [];
    /** @type {Array<{k: string, mood: string, at: number}>} */
    const c = [];
    let at = 0;
    Music.listen((n, mood) => c.push({ k: n.k, mood, at }));
    const play = (mood, from, ms) => { for (let t = 0; t < ms; t += 50) { at = from + t; Music.update(mood, 0, at); } };
    try {
      Music.stop();
      play('champion', 50000, 4000);
      c.length = 0;
      // the fight ends: its beat and horn carry on for the fade, and then stop
      play('quiet', 54000, 4000);
      const left = c.filter(n => n.mood === 'champion');
      if (!left.some(n => n.k === 'thud') || !left.some(n => n.k === 'horn')) out.push(`the fight's layers did not carry on into the quiet: ${[...new Set(left.map(n => n.k))].join(',')}`);
      if (left.some(n => n.k === 'bell')) out.push('a fading layer rang a bell over the coming home');
      const last = Math.max(...left.map(n => n.at));
      if (last - 54000 > Music.TAIL_S * 1000 + 300) out.push(`the fade went on ${last - 54000} ms`);
      if (Music.state().tail) out.push('the fade was still going after it should have ended');
      // a fight down to wary keeps the pulse going in the new mood, and fades only the beat
      play('fight', 60000, 3000);
      c.length = 0;
      play('wary', 63000, 2400);
      if (c.some(n => n.mood === 'fight' && n.k === 'pulse')) out.push('the old pulse played over the wary pulse');
      if (!c.some(n => n.mood === 'fight' && n.k === 'thud')) out.push('the beat did not fade out under the wary pulse');
      // the fight comes back inside the fade: the fade ends there, and only one beat plays
      play('quiet', 65400, 500);
      if (!Music.state().tail) out.push('no fade began when the danger passed');
      c.length = 0;
      play('fight', 65900, 1500);
      if (Music.state().tail) out.push('the fade went on with the fight back');
      if (c.some(n => n.mood !== 'fight')) out.push('a faded layer played on with the fight back');
      // turned off, nothing fades on
      play('fight', 70000, 2000);
      play('quiet', 72000, 200);
      Music.toggle();
      c.length = 0;
      play('quiet', 72200, 2000);
      if (c.length) out.push('a fade played on with the music off');
    } finally { if (!Music.isEnabled()) Music.toggle(); Music.listen(null); Music.stop(); }
    return out.length ? out.join('; ') : true;
  });
};
