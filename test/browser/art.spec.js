'use strict';
// What the view draws: walls that match what the floor says of them, the
// weapon in the hero's hands, and a monster right in front of them.
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster, expect } = require('./helpers');

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

  test('the two-handed sword is held in both fists, and is a far bigger blade than the long sword', async ({ page }) => {
    // it was drawn one-handed, and at a long sword's size looked like one
    const errors = watchForErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof Assets !== 'undefined' && Assets.themes.length > 0);
    const out = await page.evaluate(() => {
      const inked = fr => { const d = fr.img.getContext('2d').getImageData(0, 0, fr.img.width, fr.img.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
      const long = Assets.held('longsword', 'rest', 'fighter', false);
      const great = Assets.held('greatsword', 'rest', 'fighter', true), oneFist = Assets.held('greatsword', 'rest', 'fighter', false);
      return { longH: long.img.height, greatH: great.img.height, long: inked(long), great: inked(great), oneFist: inked(oneFist) };
    });
    expect(out.greatH / out.longH, 'taller in the hand than a long sword').toBeGreaterThan(1.3);
    expect(out.great / out.long, 'and much more of it').toBeGreaterThan(1.5);
    expect(out.great, 'a second fist on the grip').toBeGreaterThan(out.oneFist * 1.05);
    // and in the view it is the two-handed grip that is drawn
    await startGame(page, { seed: 'two-hands', cls: 'Fighter' });
    await clearBoons(page);
    const two = await page.evaluate(() => { const p = Game.player(); p.eq.weapon = { t: 'greatsword', q: 1, e: 0 }; p.eq.shield = null; return Game.renderState(performance.now()).fx.view; });
    expect(two && two.two, 'the view is told it takes both hands').toBe(true);
    expect(errors).toEqual([]);
  });

  for (const [label, vp] of Object.entries({ sideways: { width: 851, height: 393 }, upright: { width: 393, height: 851 } })) {
    test(`the lich right in front fits under its bar and is drawn finely, held ${label}`, async ({ page }) => {
      // point-blank it grew past the top of the view, head cut off, each of
      // its pixels a block four of the view's wide
      const errors = watchForErrors(page);
      await page.addInitScript(() => localStorage.setItem('deepdelve.tipsOff', '1'));
      await page.setViewportSize(vp);
      await startGame(page, { seed: 'lich-near', cls: 'Fighter' });
      await clearBoons(page);
      await page.evaluate(() => { Game.level().monsters.length = 0; });
      expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(1);
      expect(await placeMonster(page, 'lich', 1, { hp: 300, maxHp: 300 })).not.toBeNull();
      await page.waitForTimeout(600);
      const seen = await page.evaluate(() => Renderer.shown.filter(c => c.dist < 1.5));
      expect(seen.length, 'the lich is drawn').toBe(1);
      expect(seen[0].top, 'its crown below the top edge, and below the bar').toBeGreaterThanOrEqual(26);
      expect(seen[0].texel, 'drawn from the finer painting, not blown up').toBeLessThan(2);
      expect(errors).toEqual([]);
    });
  }
});
