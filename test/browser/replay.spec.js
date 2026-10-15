'use strict';
const { test, expect } = require('@playwright/test');
const { watchForErrors } = require('./helpers');
const AxeBuilder = require('@axe-core/playwright').default;

async function recordedRun(page, end = true) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.tipsOff', '1');
    localStorage.setItem('deepdelve.prelude', 'on');
  });
  await page.goto('/'); await page.click('#btn-new');
  await page.fill('#c-name', 'Replay hero'); await page.fill('#c-seed', 'browser-recording');
  await page.click('#c-begin'); await page.click('#pro-begin');
  await page.locator('#view').tap();
  await page.locator('[data-act="left"]').tap();
  await page.waitForTimeout(400);
  await page.locator('[data-act="right"]').tap();
  await page.waitForTimeout(400);
  if (!end) return;
  await page.evaluate(() => Game.hurtPlayer(99999, 'The recorded trial'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-replay')).toBeVisible();
}

test('a finished run replays with the same outcome, pauses, and leaves saves and progress untouched', async ({ page }) => {
  const errors = watchForErrors(page);
  await recordedRun(page);
  const before = await page.evaluate(() => ({ store: { ...localStorage }, state: JSON.stringify(Game.state()) }));
  await page.locator('#end-replay').tap();
  await expect(page.locator('#run-replay')).toBeVisible();
  const view = page.frameLocator('#run-replay-frame');
  await expect(view.locator('#replay-pause')).toBeEnabled();
  await view.locator('#replay-pause').click();
  await expect(view.locator('#replay-status')).toContainText('paused');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await view.locator('#replay-speed').selectOption('4');
  await view.locator('#replay-pause').click();
  await expect(view.locator('#replay-status')).toContainText('Outcome verified', { timeout: 15000 });
  await page.locator('#run-replay-close').click();
  await expect(page.locator('#run-replay')).not.toBeVisible();
  const after = await page.evaluate(() => ({ store: { ...localStorage }, state: JSON.stringify(Game.state()) }));
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
});

test('Escape closes a replay and returns focus to the end-screen button', async ({ page }) => {
  await recordedRun(page);
  await page.setViewportSize({ width: 320, height: 667 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; document.body.classList.add('calm'); });
  await page.click('#end-replay');
  const view = page.frameLocator('#run-replay-frame');
  await expect(view.locator('#replay-pause')).toBeEnabled();
  expect(await view.locator('html').evaluate(el => getComputedStyle(el).fontSize)).toBe('32px');
  expect(await view.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#run-replay')).not.toBeVisible();
  await expect(page.locator('#end-replay')).toBeFocused();
});

test('an installed recording replays offline', async ({ page, context }) => {
  await recordedRun(page);
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true);
  await page.click('#end-replay');
  const view = page.frameLocator('#run-replay-frame');
  await expect(view.locator('#replay-pause')).toBeEnabled();
  await view.locator('#replay-speed').selectOption('4');
  await expect(view.locator('#replay-status')).toContainText('Outcome verified', { timeout: 15000 });
});

test('a saved run continues recording after a page reload and replays the load grace correctly', async ({ page }) => {
  await recordedRun(page, false);
  expect(await page.evaluate(() => Game.save(true))).toBe(true);
  await page.reload(); await page.click('#btn-continue');
  await expect(page.locator('#screen-game')).toBeVisible();
  await page.locator('[data-act="left"]').tap();
  await page.waitForTimeout(300);
  await page.evaluate(() => Game.hurtPlayer(99999, 'The resumed trial'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await page.click('#end-replay');
  const view = page.frameLocator('#run-replay-frame');
  await expect(view.locator('#replay-pause')).toBeEnabled();
  await view.locator('#replay-speed').selectOption('4');
  await expect(view.locator('#replay-status')).toContainText('Outcome verified', { timeout: 15000 });
});

test('an imported save plays normally without offering an incomplete recording', async ({ page }) => {
  await recordedRun(page, false);
  const imported = await page.evaluate(async () => Game.loadCode(await Game.saveCode()));
  expect(imported.ok).toBe(true);
  await page.evaluate(() => Game.hurtPlayer(99999, 'The imported trial'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-replay')).toBeHidden();
  await expect(page.locator('#end-replay-note')).toContainText('not available');
});
