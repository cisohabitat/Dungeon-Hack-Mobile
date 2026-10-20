'use strict';
const { test } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { expect, watchForErrors, startGame, customiseCreation, selectJournalTab } = require('./helpers');

test('a new hero can descend with optional setup folded, and all six classes remain available @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/'); await page.click('#btn-new');
  await expect(page.locator('#c-customise')).not.toHaveAttribute('open', '');
  await expect(page.locator('#c-seed')).toBeHidden();
  await expect(page.locator('#c-backgrounds')).toBeHidden();
  await expect(page.locator('.class-card')).toHaveCount(6);
  for (const cls of ['mage', 'thief', 'ranger', 'druid', 'cleric', 'fighter']) {
    await page.click(`[data-cls="${cls}"]`);
    await expect(page.locator(`[data-cls="${cls}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#c-customise')).not.toHaveAttribute('open', '');
  }
  await page.click('#c-begin'); await page.click('#pro-begin');
  expect(await page.evaluate(() => ({ levels: Game.state().opts.levels, life: Game.state().opts.permadeath, cls: Game.player().cls }))).toEqual({ levels: 8, life: true, cls: 'fighter' });
  expect(errors).toEqual([]);
});

test('custom choices survive folding and a class change, and the setup summary stays true @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/'); await page.click('#btn-new'); await customiseCreation(page);
  await page.fill('#c-name', 'Mira'); await page.fill('#c-seed', 'polish-custom');
  await page.selectOption('#c-levels', '4'); await page.uncheck('#c-permadeath');
  await page.click('[data-bg="debtor"]'); await page.click('[data-cls="ranger"]');
  await page.locator('#c-customise > summary').click();
  await expect(page.locator('#c-ready-note')).toContainText('4 floors, reload after defeat');
  await page.click('#c-begin'); await page.click('#pro-begin');
  expect(await page.evaluate(() => { const G = Game.state(); return [G.seed, G.opts.levels, G.opts.permadeath, G.player.name, G.player.cls, G.player.bg]; })).toEqual(['polish-custom', 4, false, 'Mira', 'ranger', 'debtor']);
  expect(errors).toEqual([]);
});

test('the Journal leads with quests and keeps every collection reachable without advancing the run @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'polish-journal' });
  await page.click('[data-open="journal"]');
  await expect(page.locator('[data-jtab="quests"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-jtab="beasts"]')).toBeHidden();
  await expect(page.locator('#journal-list')).toContainText('The Heart of the Mountain');
  // Finish any visual step begun before opening, then keep the full state check.
  await page.waitForFunction(() => Game.level().monsters.every(m => m.rx === m.x && m.ry === m.y));
  // Recording observes wall-clock frames while paused; gameplay (including saved dice) must stay fixed.
  const snapshot = () => page.evaluate(() => { const { recording, ...state } = Game.state(); return JSON.stringify(state); });
  const before = await snapshot();
  for (const tab of ['pages', 'beasts', 'companions', 'relics', 'combos', 'quests', 'effects', 'recap', 'haul']) {
    await selectJournalTab(page, tab);
    await expect(page.locator(`[data-jtab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
  }
  await selectJournalTab(page, 'beasts');
  await page.locator('#journal-collection > summary').click();
  await expect(page.locator('[data-jtab="quests"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-jtab="beasts"]')).toBeHidden();
  expect(await snapshot()).toBe(before);
  await page.click('#ov-journal [data-close]');
  await expect(page.locator('[data-open="journal"]')).toBeFocused();
  expect(errors).toEqual([]);
});

test('Attack names recovery until the actual cooldown is ready, without changing its timer @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'polish-cooldown' });
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().nextAttack = Game.state().t + 3000; });
  await expect(page.locator('#attack-state')).toHaveText('Recovering');
  await expect(page.locator('[data-act="attack"]')).toHaveAccessibleName('Attack: recovering');
  await page.click('[data-open="menu"]');
  const before = await page.evaluate(() => Game.player().nextAttack);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => Game.player().nextAttack)).toBe(before);
  await page.click('#ov-menu [data-close]');
  await page.evaluate(() => { Game.player().nextAttack = Game.state().t; });
  await expect(page.locator('#attack-state')).toHaveText('Ready');
  await expect(page.locator('[data-act="attack"]')).not.toHaveClass(/cooling/);
  expect(errors).toEqual([]);
});

test('map symbols expand into a readable key and Rest explains its recovery @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'polish-map' });
  await page.evaluate(() => { Game.level().monsters.length = 0; });
  await expect(page.locator('[data-tap="rest"]')).toHaveAccessibleName(/two thirds of maximum life and spell points/);
  await expect(page.locator('[data-tap="rest"]')).toContainText('+⅔ life');
  await page.click('[data-open="map"]');
  await expect(page.locator('#map-legend')).toBeHidden();
  await page.click('#map-key > summary');
  await expect(page.locator('#map-legend [data-key="player"]')).toBeVisible();
  await expect(page.locator('#map-legend')).toContainText('Locked door');
  await page.locator('#map-key > summary').click();
  await expect(page.locator('#map-legend')).toBeHidden();
  expect(errors).toEqual([]);
});

test('optional setup and Journal disclosures stay accessible at Double text @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await page.goto('/'); await page.click('#btn-new'); await customiseCreation(page);
  await page.locator('.create-mastery > summary').click();
  const audit = async () => {
    await page.waitForTimeout(250);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await audit();
  await page.click('#c-begin'); await page.click('#pro-begin');
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'pages'); await audit();
  await page.click('#ov-journal [data-close]');
  await page.click('[data-open="map"]'); await page.click('#map-key > summary'); await audit();
  expect(errors).toEqual([]);
});

test('a full Pack keeps long names readable, all twenty slots and item inspection at normal and Double text @mobile', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { seed: 'polish-full-pack' });
  const fullInventory = await page.evaluate(() => {
    const G = Game.state();
    G.player.inv = Object.keys(ITEMS).filter(t => ITEMS[t].name).sort((a, b) => ITEMS[b].name.length - ITEMS[a].name.length).slice(0, 20).map(t => ({ t, q: 1, e: 0 }));
    for (const it of G.player.inv) G.known[it.t] = 1;
    return G.player.inv;
  });
  for (const size of ['1', '4']) {
    await page.evaluate(size => { localStorage.setItem('deepdelve.textSize', size); Game.save(true); }, size);
    await page.reload(); await page.click('#btn-continue');
    await page.click('[data-open="inv"]');
    await expect(page.locator('#inv-grid button')).toHaveCount(20);
    const fit = await page.locator('#inv-grid').evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, names: [...el.querySelectorAll('button')].every(b => b.scrollWidth <= b.clientWidth && b.scrollHeight <= b.clientHeight) }));
    expect(fit.columns).toBe(size === '4' ? 3 : 4); expect(fit.names).toBe(true);
    await page.locator('#inv-grid button').last().click();
    await expect(page.locator('#item-detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#inv-grid button').last()).toBeFocused();
    await page.evaluate(() => { Game.player().inv = Game.player().inv.slice(0, 6); });
    const compact = page.locator('#inv-compact');
    if (await compact.getAttribute('aria-pressed') !== 'true') await compact.click();
    else await page.locator('[data-bag-filter="all"]').click();
    await expect(page.locator('#inv-grid .slot')).toHaveCount(size === '4' ? 6 : 8);
    await expect(page.locator('#inv-count')).toHaveText('6 of 20 squares');
    if (size === '1') {
      const portrait = page.viewportSize(), item = page.locator('#inv-grid button').first();
      await item.focus();
      await page.setViewportSize({ width: 851, height: 393 });
      await expect(page.locator('#inv-grid .slot')).toHaveCount(10);
      await expect(item).toBeFocused();
      await page.setViewportSize(portrait);
      await expect(page.locator('#inv-grid .slot')).toHaveCount(8);
      await expect(item).toBeFocused();
    }
    await page.evaluate(inv => { Game.player().inv = inv; }, fullInventory);
    await page.locator('#ov-inv [data-close]').click();
    // Let the native Back entry settle before the next reload, including WebKit.
    await page.waitForFunction(() => history.state?.dd === 'game');
  }
  expect(errors).toEqual([]);
});
