'use strict';
const { test, expect } = require('@playwright/test');
const { selectJournalTab, startGame, watchForErrors } = require('./helpers');
const { gzipSync } = require('node:zlib');

test('a compressed save bomb is refused without replacing the hero @mobile', async ({ page }) => {
  await startGame(page, { seed: 'security-gzip' });
  const code = 'DD1.' + gzipSync(Buffer.alloc(16 * 1024 * 1024 + 1, 120)).toString('base64');
  const result = await page.evaluate(async code => {
    const before = Game.state();
    const result = await Game.loadCode(code);
    return { result, same: Game.state() === before };
  }, code);
  expect(result.result.ok).toBe(false);
  expect(result.result.why).toContain('too large');
  expect(result.same).toBe(true);
});

test('quoted hero names stay text in the hero portrait attributes @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  const name = 'X" data-x="1';
  await startGame(page, { name, seed: 'security-quotes' });
  await page.click('[data-open="char"]');
  await expect(page.locator('.sheet-face')).toHaveAttribute('alt', `${name}, the Fighter`);
  await expect(page.locator('[data-x]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const container of ['floor', 'trader']) test(`a forged ${container} item quantity is refused before replacing the hero @mobile`, async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: `security-${container}-item` });
  const result = await page.evaluate(async container => {
    Game.save(true);
    const before = Game.state(), saved = localStorage.getItem('deepdelve.save');
    const data = JSON.parse(saved), L = data.levels[data.depth], p = data.player;
    const item = { t: 'ration', q: '1" data-injected="yes"><img id="injected-belt" src="/icons/icon.svg">' };
    if (container === 'floor') L.items[`${p.x},${p.y}`] = [item];
    else L.npcs.push({ id: 'merchant', x: p.x, y: p.y, stock: [item] });
    const { encodeSave } = await import('/js/savecode.js');
    const imported = await Game.loadCode(await encodeSave(JSON.stringify(data)));
    return { imported, same: Game.state() === before, saved: localStorage.getItem('deepdelve.save') === saved };
  }, container);
  expect(result.imported.ok).toBe(false);
  expect(result.imported.why).toContain('valid dungeon');
  expect(result.same).toBe(true);
  expect(result.saved).toBe(true);
  await expect(page.locator('#injected-belt, [data-injected]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('belt counts remain text even if a live item has a malformed quantity @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'security-belt-text' });
  await page.evaluate(async () => {
    const it = Game.player().inv.find(it => it.t === 'ration');
    it.q = '1" data-injected="yes"><img id="injected-belt" src="/icons/icon.svg">';
    const { GearTools } = await import('/js/geartools.js');
    GearTools.pin(it, 0);
    GearTools.renderBelt(document.getElementById('quick-belt'));
  });
  await expect(page.locator('#quick-belt .belt-count').first()).toContainText('<img id="injected-belt"');
  await expect(page.locator('#quick-belt button').first()).toHaveAttribute('aria-label', /<img id="injected-belt"/);
  await expect(page.locator('#injected-belt, [data-injected]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('legacy Hall migration rejects inherited class IDs without polluting the page @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => {
    localStorage.removeItem('deepdelve.progress');
    localStorage.setItem('deepdelve.hall', JSON.stringify(['__proto__', 'constructor', 'toString'].map(cls => ({
      cls, name: 'Invalid hero', won: true, difficulty: 'normal', levels: 8,
    }))));
  });
  await page.goto('/');
  await expect(page.locator('#btn-new')).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(Object.prototype, 'normal'))).toBe(false);
  await page.click('#btn-hall');
  await expect(page.locator('#hall-list')).not.toContainText('Invalid hero');
  expect(errors).toEqual([]);
});

test('a hostile imported numeric field is refused through the code screen and keeps the saved hero', async ({ page }) => {
  await startGame(page, { seed: 'security-code' });
  const code = await page.evaluate(async () => {
    Game.save(true);
    const saved = localStorage.getItem('deepdelve.save');
    const data = JSON.parse(saved);
    data.player.steps = '<img id="injected-steps" src="/icons/icon.svg">';
    const { encodeSave } = await import('/js/savecode.js');
    return encodeSave(JSON.stringify(data));
  });
  await page.goto('/'); await page.click('#btn-code');
  const saved = await page.evaluate(() => localStorage.getItem('deepdelve.save'));
  await page.fill('#code-in', code); await page.click('#code-load');
  await expect(page.locator('#code-why')).toContainText('valid dungeon');
  await expect(page.locator('#code-load')).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('deepdelve.save'))).toBe(saved);
  await expect(page.locator('#injected-steps')).toHaveCount(0);
});

test('imported journal and end-screen values cannot create markup', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'security-rendering' });
  const result = await page.evaluate(async () => {
    const data = JSON.parse(JSON.stringify(Game.state()));
    data.stats.dealt = '<img id="injected-total" src="/icons/icon.svg">';
    data.stats.best = { dmg: '<img id="injected-best" src="/icons/icon.svg">', id: 'rat', to: 'a rat', how: 'a blow' };
    data.journal = [{ i: 0, depth: '<img id="injected-page" src="/icons/icon.svg">' }];
    const { encodeSave } = await import('/js/savecode.js');
    return Game.loadCode(await encodeSave(JSON.stringify(data)));
  });
  expect(result.ok).toBe(true);
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'pages');
  await expect(page.locator('#journal-list')).toContainText('<img id="injected-page"');
  await expect(page.locator('#injected-page')).toHaveCount(0);
  await page.locator('#ov-journal [data-close]').click();
  await page.evaluate(() => Game.hurtPlayer(99999, 'Security trial'));
  await expect(page.locator('#screen-end')).toBeVisible();
  await expect(page.locator('#end-summary')).toContainText('<img id="injected-best"');
  await expect(page.locator('#end-summary')).toContainText('<img id="injected-total"');
  await expect(page.locator('#injected-best, #injected-total')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the installed service worker never caches API responses', async ({ page, context }) => {
  await page.goto('/');
  await context.route('**/api/stats', route => route.fulfill({ contentType: 'application/json', body: '{"ready":false}' }));
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  expect(await page.evaluate(async () => {
    await fetch('/api/stats');
    return !!(await caches.match('/api/stats'));
  })).toBe(false);
});
