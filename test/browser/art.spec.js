'use strict';
// What the view draws: walls that match what the floor says of them, the
// weapon in the hero's hands, and a monster right in front of them.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, expect } = require('./helpers');

test.describe('art', () => {
  test('walls said to be black glass are drawn as glass, not the brick of the other floors', async ({ page }) => {
    // floor 8 said "black glass walls" over the same grey courses as floor 1
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof Assets !== 'undefined' && Assets.themes.length > 0);
    const out = await page.evaluate(() => {
      // how much of a row the brick layout gives to mortar is mortar here
      const mortarShare = (i, y) => {
        const t = Assets.themes[i], c = t.wall, d = c.getContext('2d').getImageData(0, y, c.width, 1).data;
        const n = parseInt(THEMES[i].mortar.slice(1), 16), m = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        let k = 0;
        for (let x = 0; x < c.width; x++) if (Math.abs(d[x * 4] - m[0]) + Math.abs(d[x * 4 + 1] - m[1]) + Math.abs(d[x * 4 + 2] - m[2]) < 6) k++;
        return k / c.width;
      };
      return THEMES.map((th, i) => ({ name: th.name, glass: /glass/i.test(th.flavor), bricks: mortarShare(i, 8) }));
    });
    expect(out.filter(t => t.glass).length, 'a floor speaks of black glass').toBeGreaterThan(0);
    for (const t of out) {
      if (t.glass) expect(t.bricks, `${t.name} should not be laid in brick courses`).toBeLessThan(0.3);
      else expect(t.bricks, `${t.name} is brick, with a course of mortar`).toBeGreaterThan(0.8);
    }
    expect(errors).toEqual([]);
  });
});
