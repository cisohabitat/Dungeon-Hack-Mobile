'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, watchForErrors } = require('./helpers');

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
    localStorage.setItem('deepdelve.tipsOff', '1');
  });
}

test('all six painted class portraits load with smooth scaling and the earned mastery frames', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/');
  await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ won: { fighter: { hard: 1 }, mage: { easy: 1 } }, relics: [] })));
  await page.click('#btn-new');
  const faces = page.locator('.class-face'); await expect(faces).toHaveCount(6);
  await expect.poll(() => faces.evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  const classes = await page.evaluate(() => Object.keys(CLASSES));
  for (const cls of classes) {
    const face = page.locator(`.class-card[data-cls="${cls}"] .class-face`);
    await expect(face).toHaveAttribute('src', `img/portraits/${cls}.webp`);
    expect(await face.evaluate(i => getComputedStyle(i).imageRendering)).toBe('auto');
  }
  await expect(page.locator('[data-cls="fighter"] .class-face')).toHaveClass(/frame-silver/);
  await expect(page.locator('[data-cls="mage"] .class-face')).toHaveClass(/frame-bronze/);
  await page.screenshot({ path: testInfo.outputPath('painted-class-picker.png') });
  expect(errors).toEqual([]);
});

test('the chosen portrait follows the hero into the story, hero sheet, ending and exported share card', async ({ page }) => {
  const errors = watchForErrors(page);
  await prepare(page); await startGame(page, { cls: 'Druid', seed: 'painted-hero' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  await expect(page.locator('#pro-face')).toHaveAttribute('src', 'img/portraits/druid.webp');
  await page.click('[data-open="char"]');
  await expect(page.locator('.sheet-face')).toHaveAttribute('src', 'img/portraits/druid.webp');
  await expect.poll(() => page.evaluate(() => Assets.sprites.portrait_druid.levels[0].width)).toBe(512);
  await page.click('#ov-char [data-close]');
  await page.evaluate(() => Game.hurtPlayer(99999, 'the portrait test'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-face')).toHaveAttribute('src', 'img/portraits/druid.webp');
  expect(await page.locator('#end-face').evaluate(i => i.naturalWidth)).toBe(512);
  await expect(page.locator('#end-face')).toHaveClass(/fallen/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#end-card')]);
  const png = require('node:fs').readFileSync(await download.path());
  expect(png.slice(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([800, 420]);
  expect(errors).toEqual([]);
});

test('a missing painted portrait falls back to the original face without blocking character creation', async ({ page }) => {
  await prepare(page);
  await page.route('**/img/portraits/fighter.webp', r => r.abort());
  await page.goto('/'); await page.click('#btn-new');
  const face = page.locator('[data-cls="fighter"] .class-face');
  await expect(face).toHaveAttribute('src', /^data:image\/png/);
  expect(await face.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  await page.click('#c-begin'); await expect(page.locator('#screen-prologue')).toBeVisible();
  await expect(page.locator('#pro-face')).toHaveAttribute('src', /^data:image\/png/);
});

test('the installed game retains all six class portraits offline', async ({ page, context }) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload(); await page.click('#btn-new');
  await expect.poll(() => page.locator('.class-face').evaluateAll(imgs => imgs.length === 6 && imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  expect(errors).toEqual([]);
});
