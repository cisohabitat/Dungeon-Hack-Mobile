'use strict';
// The bestiary: kept from one delve to the next, filled in by play, and
// readable from both the title screen and the Journal.
const { test } = require('@playwright/test');

/** How many kinds of creature the bestiary can hold, from the game's own table. */
const kinds = page => page.evaluate(() => Object.keys(MONSTERS).length);
const { selectJournalTab, expect, watchForErrors, startGame, clearBoons } = require('./helpers');

const LEARNED = { rat: { met: 9, kills: 7, deaths: 0 }, spider: { met: 2, kills: 1, deaths: 0, trick: 1 }, slime: { met: 3, kills: 5, deaths: 0, trick: 1, answer: 1 }, goblin: { met: 1, kills: 0, deaths: 2 } };

test.describe('bestiary', () => {
  test('an empty bestiary shows every monster as unmet, with where to look', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('deepdelve.bestiary'));
    await page.click('#btn-beasts');
    await expect(page.locator('#beasts-count')).toHaveText(`0 of ${await kinds(page)} met`);
    await expect(page.locator('#beasts-list .beast.unmet')).toHaveCount(await kinds(page));
    await expect(page.locator('#beasts-list .beast').first()).toContainText('Not yet met. From floor 1 down.');
    await page.click('#beasts-back');
    await expect(page.locator('#screen-title')).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('a met creature can be looked at close, by a tap or from the keyboard, and shows no row of poses', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(k => localStorage.setItem('deepdelve.bestiary', JSON.stringify(k)), { quillback: { met: 2, kills: 1, deaths: 0, trick: 1 }, basilisk: { met: 2, kills: 1, deaths: 0, trick: 1 }, rat: { met: 1, kills: 1, deaths: 0 } });
    await page.goto('/');
    await page.click('#btn-beasts');
    // one picture a creature, however many poses it is drawn in for the fight
    await expect(page.locator('#beasts-list .beast-poses')).toHaveCount(0);
    await expect(page.locator('[data-beast="quillback"] img')).toHaveCount(1);
    // the unmet cannot be looked at
    await expect(page.locator('[data-beast="ogre"] img[role="button"]')).toHaveCount(0);
    // a tap looks closer, and another steps back
    const art = page.locator('[data-beast="rat"] img.beast-art');
    const w0 = (await art.boundingBox()).width;
    await art.click();
    await expect(art).toHaveClass(/zoom/);
    await expect.poll(async () => (await art.boundingBox()).width).toBeGreaterThan(w0 * 2);
    await art.click();
    await expect(art).not.toHaveClass(/zoom/);
    // and from the keyboard
    const bas = page.locator('[data-beast="basilisk"] img.beast-art');
    await bas.focus(); await page.keyboard.press('Enter');
    await expect(bas).toHaveClass(/zoom/);
    await expect(bas).toHaveAttribute('aria-pressed', 'true');
    // every picture is a real one
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#beasts-list img')].every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    expect(errors).toEqual([]);
  });

  test('each stage of knowledge shows only what has been learned', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(k => localStorage.setItem('deepdelve.bestiary', JSON.stringify(k)), LEARNED);
    await page.goto('/');
    await page.click('#btn-beasts');
    await expect(page.locator('#beasts-count')).toHaveText(`4 of ${await kinds(page)} met`);
    // met, never killed: lore but no numbers, and the record says who killed whom
    const gob = page.locator('[data-beast="goblin"]');
    await expect(gob).toContainText('Goblin');
    await expect(gob).toContainText('Kill one to take its measure.');
    await expect(gob).toContainText('killed you twice');
    // killed once, trick seen: numbers and the trick, not the answer
    const spider = page.locator('[data-beast="spider"]');
    await expect(spider.locator('.beast-stats')).toContainText('AC 13');
    await expect(spider.locator('.trick')).toContainText('Spits a web');
    await expect(spider).toContainText('Answer: not yet learned.');
    // everything learned
    await expect(page.locator('[data-beast="slime"] .answer')).toContainText('Fire');
    // a monster with no trick shows no trick lines at all
    await expect(page.locator('[data-beast="rat"]')).not.toContainText('Trick');
    // the unmet stay hidden
    await expect(page.locator('[data-beast="ogre"]')).toContainText('???');
    await expect(page.locator('[data-beast="ogre"]')).not.toContainText('Ogre');
    expect(errors).toEqual([]);
  });

  test('the Journal has a Bestiary tab, and meeting a monster in play fills it in', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('deepdelve.bestiary'));
    await startGame(page, { seed: 'bestiary-tab' });
    await clearBoons(page);
    await page.evaluate(() => {
      // anything that woke while the game started is not what this test is about
      localStorage.removeItem('deepdelve.bestiary');
      const p = Game.player(), L = Game.level(), G = Game.state();
      const [dx, dy] = Dungeon.DIRS[p.dir];
      L.monsters.length = 0;
      L.monsters.push({ uid: 1, id: 'goblin', x: p.x + dx, y: p.y + dy, hp: 1, maxHp: 1, awake: true, nextAct: 1e12, rx: 0, ry: 0, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
      p.perkHit = 60;
      // a natural 1 misses whatever the bonus: swing until the goblin is down
      for (let i = 0; i < 10 && L.monsters.length; i++) { G.t = Math.max(G.t, p.nextAttack); Game.input('attack'); }
    });
    await page.click('[data-open="journal"]');
    await selectJournalTab(page, 'beasts');
    await expect(page.locator('#journal-count')).toHaveText(`1 of ${await kinds(page)} met`);
    await expect(page.locator('#journal-list [data-beast="goblin"] .beast-stats')).toContainText('AC 13');
    await selectJournalTab(page, 'pages');
    await expect(page.locator('#journal-list .beast')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('every creature has its own painting in the title bestiary and Journal', async ({ page }, testInfo) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('deepdelve.bestiary', JSON.stringify(Object.fromEntries(Object.keys(MONSTERS).map(id => [id, { met: 1, kills: 1 }])))));
    await page.click('#btn-beasts');
    async function paintings(root) {
      const faces = page.locator(`${root} img.bestiary-portrait`);
      await expect(faces).toHaveCount(await kinds(page));
      await expect.poll(() => faces.evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512 && i.naturalHeight === 512))).toBe(true);
      const srcs = await faces.evaluateAll(imgs => imgs.map(i => i.getAttribute('src')));
      expect(new Set(srcs).size).toBe(await kinds(page));
      expect(srcs.every(src => /^img\/(bestiary|bosses)\/[a-z_]+\.webp$/.test(src))).toBe(true);
      expect(await faces.evaluateAll(imgs => imgs.every(i => getComputedStyle(i).imageRendering === 'auto'))).toBe(true);
    }
    await paintings('#beasts-list');
    const rat = page.locator('[data-beast="rat"] .beast-art');
    await rat.focus(); await page.keyboard.press('Space');
    await expect(rat).toHaveAttribute('aria-pressed', 'true');
    const [w, h] = await rat.evaluate(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
    expect(Math.abs(w - h)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await rat.click();
    await page.screenshot({ path: testInfo.outputPath('painted-bestiary.png') });
    await page.click('#beasts-back');
    await startGame(page, { seed: 'painted-bestiary' });
    await clearBoons(page);
    await page.click('[data-open="journal"]'); await selectJournalTab(page, 'beasts');
    await paintings('#journal-list');
    expect(errors).toEqual([]);
  });

  test('all painted creatures are available after an offline reload', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('deepdelve.bestiary', JSON.stringify(Object.fromEntries(Object.keys(MONSTERS).map(id => [id, { met: 1 }]))));
      return navigator.serviceWorker.register('/sw.js');
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
    await context.setOffline(true); await page.reload(); await page.click('#btn-beasts');
    await expect.poll(() => page.locator('#beasts-list img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  });

  test('a missing champion painting falls back to its own sprite once', async ({ page }) => {
    await page.route('**/img/bestiary/grisk.webp', route => route.abort());
    await page.addInitScript(() => localStorage.setItem('deepdelve.bestiary', JSON.stringify({ grisk: { met: 1 } })));
    await page.goto('/'); await page.click('#btn-beasts');
    const face = page.locator('[data-beast="grisk"] .beast-art');
    await expect(face).toHaveAttribute('src', /^data:image\/png/);
    await expect.poll(() => face.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await face.evaluate(async i => {
      const { Assets } = await import('/js/assets.js');
      return i.src === Assets.sprites.goblin.elite.grisk.url && i.onerror === null;
    })).toBe(true);
    await face.click(); await expect(face).toHaveAttribute('aria-pressed', 'true');
  });
});
