'use strict';
// How the game feels between moments: overlays and screens fade up with a
// page's sound, the music steps back under a level gained, and the title opens
// out of the dark to a swell, skipped at a tap.
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

test('the title opens out of the dark once a visit, a tap ends it at once and starts the swell, and a calm view has none', async ({ page }) => {
  await page.goto('/');
  const title = page.locator('#screen-title');
  await expect(title).toHaveClass(/opening/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#screen-title .logo .l2')).animationName)).toBe('come-up');
  await page.evaluate(() => { window.__music = []; Music.listen((n, mood) => window.__music.push(mood)); });
  // a tap on the scene ends it, and the swell is heard, once
  await page.mouse.click(180, 120);
  await expect(title).not.toHaveClass(/opening/);
  expect(await page.evaluate(() => Music.state().swelled)).toBe(true);
  expect(await page.evaluate(() => window.__music.filter(m => m === 'swell').length)).toBeGreaterThan(0);
  const heard = await page.evaluate(() => window.__music.length);
  await page.mouse.click(180, 120);
  expect(await page.evaluate(() => window.__music.length)).toBe(heard);
  // back to the title from the making of a hero: no second opening
  await page.click('#btn-new');
  await page.click('#c-back');
  await expect(title).toHaveClass(/active/);
  await expect(title).not.toHaveClass(/opening/);
  // left alone, it ends of itself; and a button works while it plays
  await page.reload();
  await expect(title).toHaveClass(/opening/);
  await page.click('#btn-new');
  await expect(page.locator('#screen-create')).toHaveClass(/active/);
  await page.click('#c-back');
  await page.reload();
  await expect(title).not.toHaveClass(/opening/, { timeout: 5000 });
  // a calm view: no opening at all
  await page.evaluate(() => localStorage.setItem('deepdelve.calm', '1'));
  await page.reload();
  await expect(title).toHaveClass(/active/);
  expect(await title.evaluate(el => el.classList.contains('opening'))).toBe(false);
});
