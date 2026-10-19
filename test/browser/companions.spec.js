'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, clearBoons, watchForErrors } = require('./helpers');
const kinds = ['hound', 'wolf', 'goblin', 'sellsword', 'mender', 'renegade'];

test('the companion collection remains accessible with double text', async ({ page }) => {
  const AxeBuilder = require('@axe-core/playwright').default;
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await page.goto('/');
  await page.evaluate(ids => localStorage.setItem('deepdelve.companions', JSON.stringify(ids)), kinds);
  await page.click('#btn-companions');
  await expect(page.locator('#companions-count')).toHaveText('6 of 6 met');
  await expect.poll(() => page.locator('#companions-list img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  expect(await page.evaluate(() => document.querySelector('#screen-companions').scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#companions-back').click();
  await expect(page.locator('#screen-title')).toHaveClass(/active/);
});

test('loading an older save recovers recorded encounters without revealing unseen kinds', async ({ page }) => {
  await startGame(page, { seed: 'companion-old-save' });
  await clearBoons(page);
  expect(await page.evaluate(() => {
    Game.state().metEncounters = ['stray', 'hire', 'stray_healer', 'exile', 'caged'];
    Game.state().companion = null;
    Game.save(true);
    localStorage.removeItem('deepdelve.companions');
    return Game.load();
  })).toBeTruthy();
  await page.click('[data-open="journal"]');
  await page.click('[data-jtab="companions"]');
  await expect(page.locator('#journal-count')).toHaveText('5 of 6 met');
  await expect(page.locator('#journal-list [data-companion="wolf"]')).toHaveClass(/unmet/);
  await expect(page.locator('#journal-list [data-companion="sellsword"]')).toContainText('Sellsword');
});

test('unmet companions stay hidden, and the title collection returns by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-companions');
  await expect(page.locator('#companions-count')).toHaveText('0 of 6 met');
  await expect(page.locator('#companions-list .unmet')).toHaveCount(6);
  await expect(page.locator('#companions-list img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-title')).toHaveClass(/active/);
});

test('meeting a companion without recruiting unlocks it in the Journal and survives reload', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'companion-collection' });
  await clearBoons(page);
  await page.evaluate(() => {
    localStorage.removeItem('deepdelve.companions');
    const p = Game.player(), L = Game.level();
    L.monsters.length = 0;
    const [dx, dy] = Dungeon.DIRS[p.dir];
    L.npcs = [{ id: 'stray', kind: 'encounter', x: p.x + dx, y: p.y + dy }];
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    Game.input('use');
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('deepdelve.companions') || '[]'))).toEqual(['hound']);
  expect(await page.evaluate(() => !!Game.state().companion)).toBe(false);
  const leave = page.getByRole('button', { name: 'Leave it be', exact: true });
  await expect(leave).not.toHaveClass(/arming/);
  await leave.click();
  await expect(page.locator('#enc-choices').getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ov-encounter')).not.toHaveClass(/open/);
  await page.click('[data-open="journal"]');
  await page.click('[data-jtab="companions"]');
  await expect(page.locator('#journal-count')).toHaveText('1 of 6 met');
  await expect(page.locator('#journal-list [data-companion="hound"]')).toContainText('Hound');
  await page.reload();
  await page.click('#btn-companions');
  await expect(page.locator('#companions-count')).toHaveText('1 of 6 met');
  expect(errors).toEqual([]);
});

test('all companion portraits load, zoom by touch and keyboard, and remain available offline', { tag: '@mobile' }, async ({ page, context }, testInfo) => {
  const errors = watchForErrors(page);
  await page.goto('/');
  await page.evaluate(ids => localStorage.setItem('deepdelve.companions', JSON.stringify(ids)), kinds);
  await page.click('#btn-companions');
  await expect(page.locator('#companions-count')).toHaveText('6 of 6 met');
  const faces = page.locator('#companions-list img');
  await expect(faces).toHaveCount(6);
  await expect.poll(() => faces.evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  const hound = page.locator('[data-companion="hound"] img');
  await hound.click(); await expect(hound).toHaveAttribute('aria-pressed', 'true');
  await hound.press(' '); await expect(hound).toHaveAttribute('aria-pressed', 'false');
  await hound.press('Enter'); await expect(hound).toHaveClass(/zoom/);
  await expect.poll(() => page.evaluate(() => document.querySelector('#screen-companions').scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('companion-collection.png') });
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload();
  await page.click('#btn-companions');
  await expect.poll(() => faces.evaluateAll(imgs => imgs.length === 6 && imgs.every(i => i.complete && i.naturalWidth === 512))).toBe(true);
  expect(errors).toEqual([]);
});

test('a missing companion painting falls back to its sprite', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/img/companions/mender.webp', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('deepdelve.companions', '["mender"]'));
  await page.click('#btn-companions');
  const face = page.locator('[data-companion="mender"] img');
  await expect(face).toHaveAttribute('src', /^data:image/);
  await expect.poll(() => face.evaluate(i => i.complete && i.naturalWidth > 0)).toBe(true);
  // The deliberately aborted image emits exactly one resource error; any
  // script error or additional failed resource still fails this check.
  expect(errors).toEqual(['error: Failed to load resource: net::ERR_FAILED']);
});
