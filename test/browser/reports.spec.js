'use strict';
// Reports (js/telemetry.js): off unless turned on in the Menu, and then a note
// when a run ends and when something breaks, holding nothing that names anyone.
const { test } = require('@playwright/test');
const { expect, startGame, clearBoons, faceOpenGround, placeMonster } = require('./helpers');

/** Catch what the game sends, answering as the real endpoint does. */
async function catchReports(page) {
  const sent = [];
  await page.route('**/api/telemetry', async route => {
    sent.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 204, body: '' });
  });
  return sent;
}

/** The hero falls to an ogre, armour off so its blows land. */
async function fall(page) {
  await faceOpenGround(page, 2);
  await placeMonster(page, 'ogre', 1, { hp: 400, maxHp: 400, nextAct: 0 });
  await page.evaluate(() => { const p = Game.player(); p.hp = 1; p.eq.armor = null; p.eq.shield = null; });
  await expect.poll(() => page.evaluate(() => Game.state().status), { timeout: 20_000 }).toBe('dead');
}

test('reports are off unless turned on, and a run that ends says so when they are', async ({ page }) => {
  test.setTimeout(90_000);
  const sent = await catchReports(page);
  await startGame(page, { seed: 'reports', name: 'Hilda Secretname', cls: 'fighter' });
  await clearBoons(page);
  // off to begin with, and the Menu says what would be sent
  await page.click('[data-open="menu"]');
  await expect(page.locator('#m-reports')).toHaveText('Send reports: Off');
  await expect(page.locator('#ov-menu .menu-note', { hasText: 'Never the hero' })).toBeVisible();
  await page.keyboard.press('Escape');
  // a run that ends with them off sends nothing
  await fall(page);
  await page.waitForTimeout(500);
  expect(sent).toEqual([]);

  // turned on, the next run's end is sent once
  await startGame(page, { seed: 'reports2', name: 'Hilda Secretname', cls: 'fighter' });
  await clearBoons(page);
  await page.click('[data-open="menu"]');
  await page.click('#m-reports');
  await expect(page.locator('#m-reports')).toHaveText('Send reports: On');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);   // a few frames of play, to be counted
  await fall(page);
  await expect.poll(() => sent.length).toBe(1);
  const r = sent[0];
  expect(r).toMatchObject({ kind: 'run', outcome: 'death', cls: 'fighter', seed: 'reports2', depth: 1, levels: 8 });
  expect(r.cause).toMatch(/ogre/i);
  expect(r.fps.reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  expect(r.device.w).toBeGreaterThan(0);
  expect(JSON.stringify(r)).not.toContain('Secretname');
  // the switch is kept for the next visit
  expect(await page.evaluate(() => localStorage.getItem('deepdelve.reports'))).toBe('1');
  await page.waitForTimeout(500);
  expect(sent.length).toBe(1);
});

test('when something breaks, a report carries the error, the seed and the floor', async ({ page }) => {
  const sent = await catchReports(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.reports', '1'));
  await startGame(page, { seed: 'broken' });
  await page.evaluate(() => { setTimeout(() => { throw new Error('a test fault'); }, 0); });
  await page.evaluate(() => { setTimeout(() => { throw new Error('a test fault'); }, 0); });
  await expect.poll(() => sent.filter(s => s.kind === 'crash').length).toBe(1);
  const c = sent.find(s => s.kind === 'crash');
  expect(c.msg).toContain('a test fault');
  expect(c).toMatchObject({ seed: 'broken', depth: 1 });
  expect(c.save).toMatch(/^[0-9a-f]{8}$/);
  // the same fault twice is sent once
  await page.waitForTimeout(300);
  expect(sent.filter(s => s.kind === 'crash').length).toBe(1);
});

test('the dashboard sets the bot\'s figures out by class, and says when no store answers', async ({ page }) => {
  await page.goto('/dashboard.html');
  await expect(page.locator('#state')).toHaveText(/could not be reached|No store/);
  // the bot's side is read from the README's balance table
  const normal = page.locator('#rates tr', { has: page.locator('td', { hasText: /^Normal$/ }) });
  await expect(normal.locator('.bot')).toHaveCount(6);
  await expect(normal.locator('.bot').first()).toHaveText(/^bot \d+(\.\d)?%$/);
});
