// Rule checks for the story's spine: the crews' pages (JOURNAL) laid one on
// every floor in three acts by pagePlan (dungeon.js), the roads telling their
// halves, the peoples' own pages, what the Hall keeps of them, and the win
// saying plainly what the Heart is. Run from rules.js with its helpers lent in.
module.exports = async function pageChecks(h) {
  const { test, newContext, winHere, evenStats, OPTS } = h;
  const LENGTHS = [2, 4, 6, 8, 12, 16];

  await test('one of the crews\' pages lies on every floor, in three acts, each road telling its own half and each people its own page', async () => {
    const out = [];
    const { Dungeon, JOURNAL } = await newContext();
    // the first eight keep their places: a save knows a page by its number
    const FIRST = ['A guild roster, water-stained', 'A surveyor’s note', 'A letter, never sent', 'A page torn from a ledger', 'A prayer, scratched into the wall', 'A child’s drawing', 'The last crew’s log', 'A single line, cut deep'];
    FIRST.forEach((t, i) => { if (!JOURNAL[i] || JOURNAL[i].title !== t) out.push(`page ${i} is now ${JOURNAL[i] && JOURNAL[i].title}`); });
    for (const levels of LENGTHS) for (const route of ['crypts', 'warrens']) {
      const plan = Dungeon.pagePlan(levels, route), span = Dungeon.routeSpan(levels), road = span ? route : 'crypts', key = `${levels} floors by ${road}`;
      if (plan.length !== levels) { out.push(`${key}: ${plan.length} floors planned`); continue; }
      if (plan.some(f => f.page === null || !JOURNAL[f.page])) out.push(`${key}: a floor with no page`);
      if (new Set(plan.map(f => f.page)).size !== levels) out.push(`${key}: a page twice`);
      let act = 0;
      plan.forEach((f, k) => {
        const e = JOURNAL[f.page] || {}, d = k + 1;
        if (f.act < act) out.push(`${key}: floor ${d} goes back to act ${f.act}`);
        act = f.act;
        const people = Dungeon.peopleAt(levels, d);
        if (people) { if (e.people !== people) out.push(`${key}: the ${people}' floor ${d} holds "${e.title}"`); return; }
        if (e.people || e.act !== f.act) out.push(`${key}: floor ${d} of act ${f.act} holds "${e.title}"`);
        if (f.act === 2 && e.road !== road) out.push(`${key}: floor ${d} holds the ${e.road}' page "${e.title}"`);
        if (f.act === 1 && span && d > span.fork) out.push(`${key}: act I below the divided stair`);
      });
      // each act told in order, and the last two floors the Heart: what it is, then the line cut deep
      for (const a of [1, 2, 3]) { const steps = plan.filter(f => f.act === a && !f.people).map(f => JOURNAL[f.page].step); if (steps.some((s, i) => i && s < steps[i - 1])) out.push(`${key}: act ${a} told out of order`); }
      const heart = JOURNAL.findIndex(e => e.act === 3 && e.rank === 1);
      if (levels >= 4 ? plan[levels - 2].page !== heart || plan[levels - 1].page !== 7 : plan[levels - 1].page !== heart) out.push(`${key}: the Heart's pages not on the last floors`);
    }
    // every page is on some delve or other, and the roads' halves differ
    const all = new Set(LENGTHS.flatMap(l => ['crypts', 'warrens'].flatMap(r => Dungeon.pagePlan(l, r).map(f => f.page))));
    if (all.size !== JOURNAL.length) out.push(`only ${all.size} of ${JOURNAL.length} pages lie on any delve`);
    // before the stair divides, the road's floors wait on the road: the count does not
    const before = Dungeon.pagePlan(8, undefined);
    if (before.length !== 8 || before.filter(f => f.page === null).length !== 3 || before.some(f => f.page === null && f.act !== 2)) out.push(`before the stair divides: ${JSON.stringify(before)}`);
    return out.length ? out.join('; ') : true;
  });

  await test('each floor is made with its own page on it, and the keeper the story names is the one at the bottom', async () => {
    const out = [];
    const { Dungeon, MONSTERS } = await newContext();
    const opts = { size: 'small', monsters: 'normal', treasure: 'normal', lockedDoors: true, traps: true };
    for (const levels of LENGTHS) for (const route of ['crypts', 'warrens']) {
      const span = Dungeon.routeSpan(levels), plan = Dungeon.pagePlan(levels, route);
      for (let d = 1; d <= levels; d++) {
        const L = Dungeon.generate(`pages-${levels}-${route}`, d, { ...opts, levels, ...(span && d > span.fork ? { route } : {}) });
        const pages = Object.values(L.items).flat().filter(it => it.t === 'page');
        if (pages.length !== 1 || pages[0].page !== plan[d - 1].page) out.push(`${levels} floors by ${route}, floor ${d}: pages ${JSON.stringify(pages.map(p => p.page))}, planned ${plan[d - 1].page}`);
        if (d === levels) {
          const keeper = L.monsters.find(m => MONSTERS[m.id].boss);
          if (!keeper || keeper.id !== Dungeon.keeperOf(levels, span ? route : undefined)) out.push(`${levels} floors by ${route}: kept by ${keeper && keeper.id}, the story says ${Dungeon.keeperOf(levels, route)}`);
        }
      }
    }
    return out.length ? out.join('; ') : true;
  });

  await test('a page read goes in the Hall for good (not from a test run), and a delve counts every floor\'s page', async () => {
    const out = [];
    const ctx = await newContext(); const { Game, Progress } = ctx;
    const read = (seed, tested) => {
      Game.newGame({ name: 'P', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed, opts: { ...OPTS, levels: 4 } });
      if (tested) Game.setTesting({ hp: true });
      const L = Game.level(), p = Game.player(), k = Object.keys(L.items).find(k => L.items[k].some(i => i.t === 'page'));
      const it = L.items[k].find(i => i.t === 'page');
      [p.x, p.y] = k.split(',').map(Number);
      Game.takeItem(it);
      return it.page;
    };
    const first = read('pages-hall', false);
    if (!Game.journal().some(j => j.i === first) || !Progress.load().pages.includes(first)) out.push(`page ${first} read: journal ${JSON.stringify(Game.journal())}, Hall ${JSON.stringify(Progress.load().pages)}`);
    if (Game.pagesInDungeon() !== 4) out.push(`a four-floor delve holds ${Game.pagesInDungeon()}`);
    ctx.store.set('deepdelve.progress', JSON.stringify({ pages: [] }));
    read('pages-tested', true);
    if (Progress.load().pages.length) out.push('a test run wrote a page in the Hall');
    // whatever was stored comes back as page numbers that exist, once each
    ctx.store.set('deepdelve.progress', JSON.stringify({ pages: [3, 3, -1, 999, 'x', 2.5, 7] }));
    if (JSON.stringify(Progress.load().pages) !== '[3,7]') out.push(`a bad archive read as ${JSON.stringify(Progress.load().pages)}`);
    if (Progress.notePage(3) || !Progress.notePage(4) || Progress.notePage(999)) out.push('noting a page: once each, and only pages that exist');
    return out.length ? out.join('; ') : true;
  });

  await test('lifting the Heart says plainly what it is, and so does the story told after', async () => {
    const ctx = await newContext(); const { Game } = ctx;
    Game.newGame({ name: 'H', cls: 'fighter', bg: 'oathbroken', stats: { ...evenStats }, seed: 'pages-win', opts: { ...OPTS, levels: 4 } });
    const from = Game.state().log.length;
    winHere(Game);
    const said = Game.state().log.slice(from).map(e => e.m).join(' '), epi = Game.epilogue(true).join(' ');
    return (/first fire of the old smiths/.test(said) && /The Heart is the first fire of the old smiths/.test(epi) && /Heart of the Mountain/.test(epi)) || `the win said: ${said} | the epilogue: ${epi}`;
  });
};
