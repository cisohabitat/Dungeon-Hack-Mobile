'use strict';
// How the game feels between moments: overlays and screens fade up with a
// page's sound, and the music steps back under a level gained.
const { test } = require('@playwright/test');
const { expect, startGame, clearBoons } = require('./helpers');

test('an overlay or a screen fades up with the sound of a page, and a calm view has no fade', async ({ page }) => {
  await startGame(page, { seed: 'fades' });
  await clearBoons(page);
  await page.evaluate(() => { window.__heard = []; Sound.listen(n => window.__heard.push(n)); });
  await page.click('[data-open="menu"]');
  await expect(page.locator('#ov-menu')).toHaveClass(/open/);
  const anim = await page.evaluate(() => { const st = getComputedStyle(document.getElementById('ov-menu')); return { name: st.animationName, ms: parseFloat(st.animationDuration) * 1000 }; });
  expect(anim.name).toBe('come-up');
  expect(anim.ms).toBeGreaterThanOrEqual(150);
  expect(anim.ms).toBeLessThanOrEqual(250);
  expect(await page.evaluate(() => window.__heard.includes('page'))).toBe(true);
  // put away, it fades out and lets taps through, then is gone
  await page.click('#ov-menu [data-close]');
  const closing = await page.evaluate(() => { const el = document.getElementById('ov-menu'), st = getComputedStyle(el); return { cls: el.classList.contains('closing'), name: st.animationName, taps: st.pointerEvents }; });
  expect(closing).toEqual({ cls: true, name: 'go-down', taps: 'none' });
  await expect(page.locator('#ov-menu')).toBeHidden();
  await page.click('[data-open="menu"]');
  // a calm view: no fade at all
  await page.click('#m-calm');
  await page.keyboard.press('Escape');
  await page.click('[data-open="map"]');
  await expect(page.locator('#ov-map')).toHaveClass(/open/);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('ov-map')).animationName)).toBe('none');
});

test('the mix has a limiter, and the music steps back under a level gained', async ({ page }) => {
  await startGame(page, { seed: 'mix' });
  await clearBoons(page);
  await page.evaluate(() => { if (!Sound.isEnabled()) Sound.toggle(); Sound.unlock(); });
  const before = await page.evaluate(() => Sound.mix());
  expect(before).toMatchObject({ limiter: true, music: true, ducked: false });
  await page.evaluate(() => Game.testLevel());
  expect(await page.evaluate(() => Sound.mix().ducked)).toBe(true);
});
