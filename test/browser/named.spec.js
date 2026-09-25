'use strict';
// Named champions: a Goblin King beside the hero wakes, says so, and carries
// his name and life along the top of the view, the way the lich does.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

/** How many pixels of the named champion's gold bar show along the top of the view. */
const goldAtTop = () => {
  const c = document.getElementById('view'), d = c.getContext('2d').getImageData(8, 16, Math.round(c.width * 0.6), 5).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] > 120 && d[i + 1] < 190 && d[i + 2] < 90) n++;
  return n;
};

test.describe('named champions', () => {
  test('a named champion beside the hero shows its name and life along the top of the view', async ({ page }) => {
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'named-bar' });
    await clearBoons(page);
    await faceOpenGround(page, 2);
    await page.evaluate(() => { const p = Game.player(); p.maxHp = 999; p.hp = 999; Game.level().monsters.length = 0; });
    await page.waitForTimeout(200);
    expect(await page.evaluate(goldAtTop), 'no bar before the champion is there').toBe(0);
    // hurt, so the bar shows a part of it gone; still, so it strikes nothing while we look
    const placed = await placeMonster(page, 'grisk', 1, { hp: 30, maxHp: 50, nextAct: 1e12 });
    expect(placed, 'room in front of the hero for him').not.toBeNull();
    await expect(page.locator('#log')).toContainText('Who comes before Grisk', { timeout: 3000 });
    const bar = await page.evaluate(() => Game.renderState(performance.now()).fx.boss);
    expect(bar.name).toBe('Grisk, the Goblin King');
    expect(bar.named).toBe(true);
    expect([bar.hp, bar.maxHp]).toEqual([30, 50]);
    await page.waitForTimeout(300);
    // drawn: a gold bar about three fifths full across the top of the view
    const gold = await page.evaluate(goldAtTop);
    const full = await page.evaluate(() => Math.round(document.getElementById('view').width * 0.6) * 5);
    expect(gold, 'the gold bar along the top').toBeGreaterThan(full * 0.4);
    expect(gold, 'the bar shows the life he has lost').toBeLessThan(full * 0.8);
    // the status chips make way for it: they sit below the bar, not on its name
    await page.evaluate(() => { Game.player().riposteUntil = Game.state().t + 1e9; });
    await page.waitForTimeout(300);
    const lanes = await page.evaluate(() => {
      const v = document.getElementById('view').getBoundingClientRect(), s = document.getElementById('hud-status').getBoundingClientRect();
      return { chipsTop: s.top - v.top, barBottom: 24 / Renderer.H * v.height, chips: document.getElementById('hud-status').children.length };
    });
    expect(lanes.chips, 'a chip to show').toBeGreaterThan(0);
    expect(lanes.chipsTop, 'the chips below the bar').toBeGreaterThanOrEqual(lanes.barBottom);
    // and it goes when he does
    await page.evaluate(() => { Game.level().monsters.length = 0; });
    await page.waitForTimeout(300);
    expect(await page.evaluate(goldAtTop), 'the bar outlived him').toBe(0);
    expect(errors).toEqual([]);
  });
});
