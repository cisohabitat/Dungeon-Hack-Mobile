'use strict';
// The first ten minutes: a card for someone new, the hero being made named
// beside Descend, lessons explained, and the phone buzzing in the hand.
const { test } = require('@playwright/test');
const { expect, watchForErrors, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

/** Count what the game asks the phone to buzz. */
const catchBuzz = page => page.addInitScript(() => {
  window.__buzz = [];
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { window.__buzz.push(p); return true; } });
});

test('someone new is met by a card that says the game in a minute, and it stays away once put away', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  const card = page.locator('#first-time');
  await expect(card).toBeVisible();
  await expect(card).toContainText('First time here?');
  await expect(card.locator('li')).toHaveCount(5);
  await page.click('#ft-close');
  await expect(card).toBeHidden();
  await page.reload();
  await expect(page.locator('#btn-new')).toBeVisible();
  await expect(card).toBeHidden();
  expect(errors).toEqual([]);
});

test('the card can start a ready hero, and a returning player never sees it', async ({ page }) => {
  await page.goto('/');
  await page.click('#ft-quick');
  await expect(page.locator('#screen-prologue, #screen-game').first()).toBeVisible();
  // someone with a run behind them
  const other = await page.context().newPage();
  await other.addInitScript(() => { if (!localStorage.getItem('deepdelve.hall')) localStorage.setItem('deepdelve.hall', '[]'); localStorage.removeItem('deepdelve.firstSeen'); });
  await other.goto('/');
  await expect(other.locator('#btn-new')).toBeVisible();
  await expect(other.locator('#first-time')).toBeHidden();
});

test('the hero being made is named beside Descend, and follows each choice', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-new');
  const sum = page.locator('#c-summary');
  await expect(sum).toBeVisible();
  await expect(sum).toContainText('Normal');
  await page.locator('.class-card', { has: page.locator('b', { hasText: /^Mage$/ }) }).click();
  await expect(sum).toContainText(/^Mage /);
  await page.click('[data-diff="hard"]');
  await expect(sum).toContainText('Hard');
  const bg = page.locator('.bg-card:not(.locked)').nth(1);
  const name = (await bg.locator('b').first().textContent()).trim();
  await bg.click();
  await expect(sum).toContainText(name);
  // and it stays in sight with Descend
  const box = await sum.boundingBox(), begin = await page.locator('#c-begin').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(begin.y + 1);
  expect(begin.y + begin.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
});

test('a level\'s choice says what a lesson is', async ({ page }) => {
  await startGame(page, { seed: 'lesson-words' });
  await clearBoons(page);
  await page.evaluate(() => Game.testLevel());
  await expect(page.locator('#ov-boons')).toHaveClass(/open/);
  await expect(page.locator('#ov-boons')).toContainText(/lesson: a smaller gain|A lesson: a small gain/);
});

test('the phone buzzes when a blow lands, at a level and at a death; Vibration in the Menu stops it', async ({ page }) => {
  test.setTimeout(90_000);
  await catchBuzz(page);
  await startGame(page, { seed: 'buzz' });
  await clearBoons(page);
  await expect(page.locator('[data-open="menu"]')).toBeVisible();
  // a level
  await page.evaluate(() => { window.__buzz.length = 0; Game.testLevel(); });
  await expect.poll(() => page.evaluate(() => window.__buzz.some(p => Array.isArray(p) && p.length === 5))).toBe(true);
  await clearBoons(page);
  // off in the Menu: nothing more
  await page.click('[data-open="menu"]');
  await expect(page.locator('#m-haptics')).toHaveText('Vibration: On');
  await page.click('#m-haptics');
  await expect(page.locator('#m-haptics')).toHaveText('Vibration: Off');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__buzz.length = 0; Game.testLevel(); });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__buzz.length)).toBe(0);
  await clearBoons(page);
  // on again, and the hero falls to an ogre: blows, then the death
  await page.click('[data-open="menu"]');
  await page.click('#m-haptics');
  await expect(page.locator('#m-haptics')).toHaveText('Vibration: On');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__buzz.length = 0; });
  await faceOpenGround(page, 2);
  await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
  await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.eq.armor = null; p.eq.shield = null; });
  await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 20_000 }).toBe('dead');
  const got = await page.evaluate(() => window.__buzz);
  expect(got.some(p => Array.isArray(p) && p[0] === 150)).toBe(true);
});
