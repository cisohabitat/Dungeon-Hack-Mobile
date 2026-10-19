'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, watchForErrors } = require('./helpers');

test('all 47 discovered relic paintings load and enlarge accessibly @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const { RELICS } = await import('/js/relics.js');
    const { Progress } = await import('/js/progress.js');
    for (const id of Object.keys(RELICS)) Progress.noteRelic(id);
  });
  await page.click('#btn-hall'); await page.click('#hall-relics');
  const images = page.locator('#relics-list .relic-portrait');
  await expect(images).toHaveCount(47);
  await expect.poll(() => images.evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  const portrait = images.first();
  await portrait.click(); await expect(portrait).toHaveAttribute('aria-pressed', 'true');
  await portrait.press(' '); await expect(portrait).toHaveAttribute('aria-pressed', 'false');
  await portrait.press('Enter'); await expect(portrait).toHaveClass(/zoom/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('#screen-relics').evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  const artBox = await portrait.boundingBox();
  const textBox = await page.locator('#relics-list .relic-row > div').first().boundingBox();
  expect(textBox.y).toBeGreaterThanOrEqual(artBox.y + artBox.height);
  expect(textBox.width).toBeGreaterThan(200);
  await page.screenshot({ path: testInfo.outputPath('relic-codex.png') });
  const AxeBuilder = require('@axe-core/playwright').default;
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  expect(errors).toEqual([]);
});

test('hidden quality does not reveal a relic painting and pack slots stay pixel art', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'relic-painting' });
  await page.evaluate(() => {
    Game.player().inv = [{ t: 'dagger', u: 'grimtooth', e: 2, q: 1, h: true }, { t: 'ring_protect', u: 'cinder_ring', e: 1, q: 1 }];
    Game.state().looks.ring_protect = 'Plain ring';
    delete Game.state().known.ring_protect;
  });
  await page.click('[data-open="inv"]');
  await page.locator('#inv-grid button').first().click();
  await expect(page.locator('#item-detail .relic-portrait')).toHaveCount(0);
  await expect(page.locator('#inv-grid img').first()).toHaveAttribute('src', /^data:image/);
  await page.locator('#inv-grid button').nth(1).click();
  await expect(page.locator('#item-detail .relic-portrait')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an unavailable relic painting falls back to its named sprite', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/img/relics/grimtooth.webp', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('deepdelve.progress', JSON.stringify({ relics: ['grimtooth'] })));
  await page.click('#btn-hall'); await page.click('#hall-relics');
  const portrait = page.locator('[data-relic="grimtooth"] img');
  await expect(portrait).toHaveAttribute('src', /^data:image/);
  await expect.poll(() => portrait.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual(['error: Failed to load resource: net::ERR_FAILED']);
});
