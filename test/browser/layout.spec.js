'use strict';
// Tablet and desktop: on a wide screen the floor about the hero is docked
// beside the view, live as the hero moves, and every control still on the
// screen and uncovered; a tablet held upright has a larger corner map; a phone
// keeps its own layout. (The device matrix: docs/DEVICES.md.)
const { test } = require('@playwright/test');
const { watchForErrors, startGame, clearBoons, expect } = require('./helpers');

/** Controls off the screen or under something else, and the page's sideways overflow. */
const lost = page => page.evaluate(() => {
  const out = [], W = innerWidth, H = innerHeight;
  if (document.documentElement.scrollWidth > W + 1) out.push('the page scrolls sideways');
  for (const e of document.querySelectorAll('#screen-game .ctl, #screen-game .bottombar button, #hud-quaff, #log-more')) {
    if (!e.getClientRects().length || getComputedStyle(e).display === 'none') continue;
    const r = e.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const top = document.elementFromPoint(Math.min(W - 1, Math.max(0, cx)), Math.min(H - 1, Math.max(0, cy)));
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1 || !top || !(e.contains(top) || top.contains(e))) out.push(e.id || e.dataset.act || e.dataset.tap || e.dataset.open);
  }
  return out;
});

for (const [name, w, h, touch] of [['a tablet held sideways', 1024, 768, true], ['a Steam Deck', 1280, 800, false], ['a desktop window', 1440, 900, false]]) {
  test(`on ${name} the map is docked beside the view and follows the hero; every control is on the screen`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: false });
    const page = await ctx.newPage();
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'docked', cls: 'mage' });
    await clearBoons(page);
    const dock = page.locator('#dock-map');
    await expect(dock).toBeVisible();
    await expect(page.locator('#minimap')).toBeHidden();
    const box = await dock.boundingBox();
    expect(box.width).toBeGreaterThan(240);
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    // beside the view, not over it
    const view = await page.locator('#view').boundingBox();
    expect(box.x >= view.x + view.width - 1 || box.x + box.width <= view.x + 1).toBe(true);
    expect(await lost(page)).toEqual([]);
    // drawn, and drawn again when the hero turns (the arrow turns with them)
    const ink = () => page.evaluate(() => { const c = /** @type {HTMLCanvasElement} */ (document.getElementById('dock-map')); return c.toDataURL().length; });
    await expect.poll(ink).toBeGreaterThan(1000);
    const before = await page.evaluate(() => document.getElementById('dock-map').toDataURL());
    await page.keyboard.press('KeyD');
    await expect.poll(() => page.evaluate(() => document.getElementById('dock-map').toDataURL())).not.toBe(before);
    // a tap opens the whole map
    await dock.click();
    await expect(page.locator('#ov-map')).toHaveClass(/open/);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('a tablet held upright keeps its corner map, larger, and a phone has no docked map', async ({ browser }) => {
  for (const [w, h, size] of [[768, 1024, 150], [393, 727, 76]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: w < 500 });
    const page = await ctx.newPage();
    const errors = watchForErrors(page);
    await startGame(page, { seed: 'upright' });
    await clearBoons(page);
    await expect(page.locator('#dock-map')).toBeHidden();
    const m = await page.locator('#minimap').boundingBox();
    expect(Math.round(m.width)).toBe(size);
    expect(await lost(page)).toEqual([]);
    expect(errors).toEqual([]);
    await ctx.close();
  }
});
