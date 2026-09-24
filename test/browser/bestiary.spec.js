'use strict';
// The bestiary: kept from one delve to the next, filled in by play, and
// readable from both the title screen and the Journal.
const { test } = require('@playwright/test');

/** How many kinds of creature the bestiary can hold, from the game's own table. */
const kinds = page => page.evaluate(() => Object.keys(MONSTERS).length);
const { expect, watchForErrors, startGame, clearBoons } = require('./helpers');

const LEARNED = { rat: { met: 9, kills: 7, deaths: 0 }, spider: { met: 2, kills: 1, deaths: 0, trick: 1 }, slime: { met: 3, kills: 5, deaths: 0, trick: 1, answer: 1 }, goblin: { met: 1, kills: 0, deaths: 2 } };

test.describe('bestiary', () => {
  test('an empty bestiary shows every monster as unmet, with where to look', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('deepdelve.bestiary'));
    await page.click('#btn-beasts');
    await expect(page.locator('#beasts-count')).toHaveText(`0 of ${await kinds(page)} met`);
    await expect(page.locator('#beasts-list .beast.unmet')).toHaveCount(16);
    await expect(page.locator('#beasts-list .beast').first()).toContainText('Not yet met. From floor 1 down.');
    await page.click('#beasts-back');
    await expect(page.locator('#screen-title')).toHaveClass(/active/);
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
    await page.click('[data-jtab="beasts"]');
    await expect(page.locator('#journal-count')).toHaveText(`1 of ${await kinds(page)} met`);
    await expect(page.locator('#journal-list [data-beast="goblin"] .beast-stats')).toContainText('AC 13');
    await page.click('[data-jtab="pages"]');
    await expect(page.locator('#journal-list .beast')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
