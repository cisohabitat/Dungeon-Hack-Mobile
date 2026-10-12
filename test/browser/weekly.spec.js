'use strict';
// The Weekly Challenge (weekly.js): from the title, the week's hero and vows,
// a try that ends, the best kept and shared, and a try left waiting picked up.
const { test } = require('@playwright/test');
const { watchForErrors, expect } = require('./helpers');

async function quiet(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('deepdelve.tipsOff') === null) localStorage.setItem('deepdelve.tipsOff', '1');
    if (localStorage.getItem('deepdelve.firstSeen') === null) localStorage.setItem('deepdelve.firstSeen', '1');
  });
}

test('the Weekly Challenge deals the week\'s hero and vows, keeps the best try and shares it, and picks up a try left waiting', async ({ page }) => {
  const errors = watchForErrors(page);
  await quiet(page);
  await page.goto('/');
  // the title says what this week asks
  await expect(page.locator('#weekly-summary')).toContainText(/This week: .*Vow/);
  await page.click('#btn-weekly');
  await expect(page.locator('#screen-prologue')).toBeVisible();
  await expect(page.locator('#pro-rules')).toContainText(/The Weekly Challenge for the week of .*sworn to the .*Vow and .*Vow.*try as often as you like/);
  await page.click('#pro-begin');
  await expect(page.locator('#screen-game')).toBeVisible();
  const opts = await page.evaluate(() => Game.state().opts);
  expect(opts.weekly).toMatch(/^\d{4}-W\d{2}$/);
  expect(opts.vows.length).toBe(2);
  // the Menu names it
  await page.locator('[data-open="menu"]').click();
  await expect(page.locator('#m-seed')).toContainText(`Weekly Challenge ${opts.weekly}`);
  await page.keyboard.press('Escape');
  // put away mid-try, the title has it waiting, and the button takes it up again
  await page.evaluate(() => Game.save(true));
  await page.goto('/');
  await expect(page.locator('#weekly-summary')).toContainText(/This week's delve waits on floor \d/);
  await page.click('#btn-weekly');
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(await page.evaluate(() => Game.state().opts.weekly)).toBe(opts.weekly);
  // the try ends; the end offers the week's best to share, and the title says how it went
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0; p.hp = 1; p.eq.armor = null; p.eq.shield = null;
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.monsters.push({ uid: 900, id: 'ogre', x: p.x + dx, y: p.y + dy, hp: 400, maxHp: 400, awake: true, nextAct: 0, rx: p.x + dx, ry: p.y + dy, fromX: 0, fromY: 0, moveT0: 0, moveT1: 0, flashUntil: 0 });
  });
  await expect(page.locator('#screen-end')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('#end-share')).toHaveText('Share this week\'s best');
  await page.locator('#end-share').click();
  await expect(page.locator('#end-share-line')).toContainText(new RegExp(`^Deepdelve weekly ${opts.weekly} \\(.+Vow.*\\): .+, fell on floor \\d+ in \\d+m \\d\\ds, score \\d+, best of 1 try https?:\\/\\/\\S+$`));
  await page.click('#end-title-btn');
  await expect(page.locator('#weekly-summary')).toContainText(/Best: fell on floor \d+, score \d+ \(1 try\)/);
  expect(errors).toEqual([]);
});
