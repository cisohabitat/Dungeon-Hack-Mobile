// The run's own dice in the browser (ROADMAP Phase 7, honest dice): the same seed
// pressed the same way is the same run, and a run saved and taken up again rolls on
// from where it left off. The presses go through the game's own update with a fixed
// frame, since a browser's frames never come at the same moments twice.
const { test, expect } = require('@playwright/test');
const { watchForErrors, startGame } = require('./helpers');

/** A minute of the run pressed to a fixed round, then the run hashed: its state and every line of its log. */
async function playAndPrint(page, from, to) {
  return page.evaluate(([from, to]) => {
    const G = Game.state(), script = ['forward', null, null, 'attack', null, 'forward', null, 'left', null, 'attack', null, null, 'forward', 'right', null, 'attack'];
    // (the page's own clock goes on from where it is: a clock set back would hold the camera's move for ever)
    const base = performance.now();
    for (let t = from; t < to && G.status === 'playing'; t += 25) {
      // (a quiet half second before each half minute: the camera, which runs on the page's clock and is
      // not saved, has come to rest by then, so a run put down there and one played on agree)
      const act = t % 30000 >= 29500 ? null : script[Math.floor(t / 25) % script.length];
      if (act) Game.input(act);
      window.__update(base + (t - from) + 25, 25);
    }
    // (each part of the run hashed on its own, so a failure says which parted; a log line's `at` is
    // the page's own clock, kept for the moment the line shows, and no part of the run)
    // (the stamps of the page's own clock, kept on a creature or a line for the moment its picture
    // moves or shows, are no part of the run, and are left out: everything the rules read is kept)
    const SHOWN = ['at', 'moveT0', 'moveT1', 'flashAt', 'flashUntil', 'dressAt'];
    const hash = v => { const s = JSON.stringify(v, (k, x) => (SHOWN.includes(k) ? undefined : x)); let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
    // the log as it reads: "Game loaded." is the load's own line, and a line said again folds into a
    // count and leaves a place-holder, which the log's cap prunes at moments the load's line shifts
    const log = G.log.filter(e => !e.gone && e.m && e.m !== 'Game loaded.').map(e => ({ ...e, m: e.m.replace(/ \(\u00d7\d+\)$/, '') }));
    const parts = {};
    for (const k of Object.keys(G).sort()) if (!['created', 'log', 'logSeq'].includes(k)) parts[k] = hash(G[k]);
    // the hero's own fields apart too, so a failure names the one that parted
    const hero = {};
    for (const k of Object.keys(G.player).sort()) hero[k] = hash(G.player[k]);
    return { t: G.t, log: log.map(e => e.m), parts, hero };
  }, [from, to]);
}

/**
 * The page's own frames held off the run: between one evaluate and the next they would run the
 * clock on by however long the browser took, and after a load the controls tip is a quarter of a
 * second coming. The game's update is kept aside for the presses below, and the page's loop
 * given one that does nothing (the rest of a frame, the picture and the screens, goes on).
 */
async function holdFrames(page) {
  await page.addInitScript(() => {
    let g;
    Object.defineProperty(window, 'Game', { configurable: true, get: () => g, set: v => { g = v; window.__update = v.update; v.update = () => {}; } });
  });
}

/** The run brought to its end, so the next can begin from the title without the replace question. */
async function endRun(page) {
  await page.evaluate(() => { Game.hurtPlayer(9999, 'The dark takes them.', null, 'the dark'); });
  await expect(page.locator('#screen-end')).toBeVisible({ timeout: 15_000 });
  // (and nothing kept from it: a fallen hero's bones on the floor, or the Bestiary's knowledge, would make the next run another run)
  await page.evaluate(() => { for (const k of ['deepdelve.save', 'deepdelve.progress', 'deepdelve.fallen', 'deepdelve.bestiary', 'deepdelve.hall', 'deepdelve.lastrun', 'deepdelve.tipsSeen']) localStorage.removeItem(k); });
}

test('the same seed pressed the same way is the same run, in the browser, and a save taken up twice is twice the same run', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchForErrors(page);
  await holdFrames(page);
  // (tips on: the first tip holds the dungeon still until a press, so the page's own frames do not
  // run the clock on between one evaluate and the next; every press below is made in one evaluate)
  await startGame(page, { seed: 'browser-dice', cls: 'fighter', name: 'Dee', tips: true, buy: true });
  const whole = await playAndPrint(page, 0, 60000);
  // the same run again, from the title (the first ended, so no save lies there for the title to ask about)
  await endRun(page);
  await startGame(page, { seed: 'browser-dice', cls: 'fighter', name: 'Dee', tips: true, buy: true });
  const again = await playAndPrint(page, 0, 60000);
  expect(again.hero, 'the second run\'s hero').toEqual(whole.hero);
  expect(again.parts, 'the second run\'s state').toEqual(whole.parts);
  expect(again.log, 'the second run\'s log').toEqual(whole.log);
  // and once more, put down halfway and taken up twice from the one save: a load gives every
  // creature a moment's grace, so it is not the run never put down, but taken up twice it is twice the same
  await endRun(page);
  await startGame(page, { seed: 'browser-dice', cls: 'fighter', name: 'Dee', tips: true, buy: true });
  await playAndPrint(page, 0, 30000);
  await page.evaluate(() => Game.save(true));
  const saved = await page.evaluate(() => localStorage.getItem('deepdelve.save'));
  const taken = [];
  for (let i = 0; i < 2; i++) {
    // (the save as it was, put back once the title is up: a page left mid-run saves the run as it
    // stands on the way out, over whatever lay there; and the first tip again on the run taken up)
    await page.goto('/');
    await page.evaluate(s => { localStorage.setItem('deepdelve.save', s); localStorage.removeItem('deepdelve.tipsSeen'); }, saved);
    await page.click('#btn-continue');
    await expect(page.locator('#screen-game')).toBeVisible();
    taken.push(await playAndPrint(page, 30000, 60000));
    expect(taken[i].t, 'the clock of the run taken up').toBe(60000);
  }
  expect(taken[1].hero, 'the hero of the run taken up a second time').toEqual(taken[0].hero);
  expect(taken[1].parts, 'the state of the run taken up a second time').toEqual(taken[0].parts);
  expect(taken[1].log, 'the log of the run taken up a second time').toEqual(taken[0].log);
  expect(errors).toEqual([]);
});
