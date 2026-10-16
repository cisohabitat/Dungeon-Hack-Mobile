'use strict';
const { test, expect } = require('@playwright/test');
const { watchForErrors } = require('./helpers');

test('touch controls release after a tap and returning to the page resumes its saved hero', { tag: '@mobile' }, async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.tipsOff', '1');
    localStorage.setItem('deepdelve.prelude', 'off');
    localStorage.setItem('deepdelve.sound', 'off');
  });
  await page.goto('/');
  await page.locator('#btn-new').tap();
  await page.locator('#c-name').fill('Mira');
  await page.locator('#c-seed').fill('mobile-resume');
  await page.locator('#c-begin').tap();
  await page.locator('#pro-begin').tap();
  await expect(page.locator('#screen-game')).toBeVisible();

  // Only inspect the starting floor; play through the real touch controls.
  const start = await page.evaluate(() => {
    const p = Game.player(), L = Game.level();
    const dir = Dungeon.DIRS.findIndex(([dx, dy]) => L.tiles[(p.y + dy) * L.w + p.x + dx] === Dungeon.T.FLOOR &&
      !L.monsters.some(m => m.x === p.x + dx && m.y === p.y + dy));
    return { x: p.x, y: p.y, dir: p.dir, target: dir };
  });
  expect(start.target).toBeGreaterThanOrEqual(0);
  // Four taps turn once around. Each released button must leave its pressed
  // appearance before the next tap, and each tap must turn just one quarter.
  for (let n = 1; n <= 4; n++) {
    await page.locator('[data-act="right"]').tap();
    await expect(page.locator('.ctl.held')).toHaveCount(0);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => Game.player().dir)).toBe((start.dir + n) % 4);
  }
  for (let dir = start.dir; dir !== start.target; dir = (dir + 1) % 4) {
    await page.locator('[data-act="right"]').tap();
    await expect(page.locator('.ctl.held')).toHaveCount(0);
    await page.waitForTimeout(350);
  }
  await page.locator('[data-act="forward"]').tap();
  await expect(page.locator('.ctl.held')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => [Game.player().x, Game.player().y])).not.toEqual([start.x, start.y]);
  await page.locator('[data-open="menu"]').tap();
  await expect(page.locator('#ov-menu')).toHaveClass(/open/);

  // pagehide is the save boundary on phones. Navigate away without pressing
  // Save, then start a fresh document; neither Game.save nor Game.load is called
  // by this test. Real OS process eviction remains a physical-device check.
  const snapshot = () => page.evaluate(() => {
    const G = Game.state(), p = G.player;
    return { name: p.name, depth: G.depth, x: p.x, y: p.y, dir: p.dir, hp: p.hp, gold: p.gold, inv: p.inv };
  });
  const before = await snapshot();
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.locator('#btn-continue')).toBeEnabled();
  await page.locator('#btn-continue').tap();
  await expect(page.locator('#screen-game')).toBeVisible();
  expect(await snapshot()).toEqual(before);
  await expect(page.locator('.ctl.held')).toHaveCount(0);
  expect(errors).toEqual([]);
});
