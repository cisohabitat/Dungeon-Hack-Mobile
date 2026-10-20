'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, watchForErrors } = require('./helpers');
async function journal(page, tab) { await page.click('[data-open="journal"]'); await page.click(`[data-jtab="${tab}"]`); }

test('@mobile quest tracker shows progress, payment and unfinished leads without changing the run', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-quests' });
  await page.evaluate(() => { const G = Game.state(); G.bounty = { kind: 'cull', depth: 1, from: 0, need: 6, got: 2, started: true, reward: { gold: 70, t: 'potion_heal' } }; G.threads = { lamp: true, mule: true, oath: true }; });
  const pure = await page.evaluate(async () => { const { questsView } = await import('/js/delveguide.js'); const before = JSON.stringify(Game.state()); questsView(); return JSON.stringify(Game.state()) === before; }); expect(pure).toBe(true);
  await journal(page, 'quests'); await expect(page.locator('#journal-list')).toContainText('2/6'); await expect(page.locator('#journal-list')).toContainText('before leaving'); await expect(page.locator('#journal-list')).toContainText('lost mule');
  await page.evaluate(() => { Game.state().bounty.done = true; }); await page.click('[data-jtab="pages"]'); await page.click('[data-jtab="quests"]'); await expect(page.locator('#journal-list')).toContainText('ready for payment');
  await page.keyboard.press('Escape'); await page.evaluate(() => Game.save(true)); await page.reload(); await page.click('#btn-continue'); await journal(page, 'quests'); await expect(page.locator('#journal-list')).toContainText('ready for payment'); expect(errors).toEqual([]);
});

test('@mobile map landmarks hide unexplored places, centre selections and remember resolved shrines', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-landmarks' });
  await page.evaluate(() => {
    const L = Game.level(), T = Dungeon.T; L.monsters = []; L.explored.fill(0);
    const points = [[2, 2], [3, 2], [4, 2]]; for (const [x, y] of points) { L.tiles[y * L.w + x] = T.FLOOR; L.explored[y * L.w + x] = 1; }
    L.npcs = [{ id: 'merchant', x: 2, y: 2, greeted: true, stock: [] }, { id: 'shrine', kind: 'encounter', x: 3, y: 2 }, { id: 'vigil', kind: 'encounter', x: L.w - 2, y: L.h - 2 }];
    L.tiles[2 * L.w + 4] = T.DOOR_LOCKED; L.locks['4,2'] = 'red';
  });
  expect(await page.evaluate(async () => { const { knownLandmarks } = await import('/js/maplandmarks.js'); const before = JSON.stringify(Game.state()); knownLandmarks(); return before === JSON.stringify(Game.state()); })).toBe(true);
  await page.click('[data-open="map"]'); await page.locator('#map-landmarks summary').click();
  const list = page.locator('#map-landmarks'); await expect(list).toContainText('Visited'); await expect(list).toContainText('red key needed'); await expect(list).not.toContainText('A Vigil Lamp');
  const shrine = list.locator('button', { hasText: '3, 2' }); await shrine.click(); await expect(shrine).toHaveAttribute('aria-pressed', 'true'); expect(await page.locator('#map-canvas').getAttribute('data-tile')).not.toBeNull();
  await page.keyboard.press('Escape'); await page.evaluate(() => { Game.level().npcs = Game.level().npcs.filter(n => n.id !== 'shrine'); Game.save(true); }); await page.reload(); await page.click('#btn-continue'); await page.click('[data-open="map"]'); await page.locator('#map-landmarks summary').click(); await expect(page.locator('#map-landmarks')).toContainText('Visited · resolved'); expect(errors).toEqual([]);
});

test('@mobile tapping a condition explains its effect and duration and preserves keyboard focus', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-effects' });
  await page.evaluate(() => { const p = Game.player(), G = Game.state(); Game.level().monsters = []; p.effects.ac = { amount: 3, until: G.t + 25000 }; p.effects.hit = { amount: 2, until: G.t + 20000 }; p.hexed = { kind: 'silence', until: G.t + 15000 }; });
  const chip = page.locator('#hud-status button', { hasText: 'Shielded' }); await expect(chip).toBeVisible(); await chip.focus(); await page.waitForTimeout(1100); await expect(chip).toBeFocused(); await chip.click();
  await expect(page.locator('[data-jtab="effects"]')).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('#journal-list h3').first()).toBeFocused(); await expect(page.locator('#journal-list')).toContainText('+3 armour class'); await expect(page.locator('#journal-list')).toContainText('remaining'); await expect(page.locator('#journal-list')).toContainText('cannot cast spells');
  const pure = await page.evaluate(async () => { const { activeEffects, effectsView } = await import('/js/delveguide.js'); const before = JSON.stringify(Game.state()); activeEffects(); effectsView(); return before === JSON.stringify(Game.state()); }); expect(pure).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('[data-open="journal"]')).toBeFocused(); expect(errors).toEqual([]);
});

test('@mobile companion commands use the normal facing and held restrictions', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-orders' });
  await page.evaluate(() => { const G = Game.state(), p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir]; L.monsters = []; L.npcs = []; L.items = {}; L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR; G.companion = { kind: 'hound', name: 'Brindle', hp: 12, maxHp: 12, mode: 'follow', depth: G.depth, joined: 1, floors: 0, x: p.x + dx, y: p.y + dy, nextAct: 1e9 }; });
  await journal(page, 'companions'); await page.locator('[data-companion-order="stay"]').click(); expect(await page.evaluate(() => Game.companion().mode)).toBe('stay'); await expect(page.locator('.companion-card')).toContainText('Staying here');
  await page.locator('[data-companion-order="follow"]').click(); expect(await page.evaluate(() => Game.companion().mode)).toBe('follow');
  await page.evaluate(() => { Game.player().held = Game.state().t + 10000; }); await page.click('[data-jtab="pages"]'); await page.click('[data-jtab="companions"]'); await expect(page.locator('[data-companion-order="stay"]')).toBeDisabled(); await expect(page.locator('.companion-card')).toContainText('held fast');
  await page.evaluate(() => { Game.player().held = 0; Game.companion().depth++; }); await page.click('[data-jtab="pages"]'); await page.click('[data-jtab="companions"]'); await expect(page.locator('.companion-card')).toContainText('waits on floor'); await expect(page.locator('[data-companion-order="stay"]')).toBeDisabled(); expect(errors).toEqual([]);
});

test('@mobile run recap combines known finds, jobs, companion milestones and defeated bosses', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-recap' });
  await page.evaluate(() => { const s = Game.state().stats; s.finds = [{ key: 'test', name: 'Grimtooth', grade: 'relic', depth: 1 }]; s.bounties = 2; s.bountiesLost = 1; s.kills.lich = 1; });
  await journal(page, 'recap'); await expect(page.locator('#journal-list')).toContainText('Grimtooth'); await expect(page.locator('#journal-list')).toContainText('2 completed and paid'); await expect(page.locator('#journal-list')).toContainText('Lich');
  expect(await page.evaluate(async () => { const { recapView } = await import('/js/delveguide.js'); const before = JSON.stringify(Game.state()); recapView(); return before === JSON.stringify(Game.state()); })).toBe(true);
  await page.keyboard.press('Escape'); await page.evaluate(() => Game.hurtPlayer(99999, 'The recap check')); await expect(page.locator('#screen-end')).toBeVisible(); await page.locator('#end-recap summary').click(); await expect(page.locator('#end-recap-body')).toContainText('Grimtooth'); expect(errors).toEqual([]);
});

test('@mobile inventory search combines filters, keeps item actions and hides unknown powers', async ({ page }) => {
  const errors = watchForErrors(page); await startGame(page, { seed: 'guide-search' });
  await page.evaluate(() => { Game.player().inv = [{ t: 'shortsword', q: 1, e: 1, pw: 'keen' }, { t: 'longsword', q: 1, e: 1, pw: 'swift', h: 1 }, { t: 'leather', q: 1, e: 0 }, { t: 'potion_heal', q: 2, e: 0 }]; });
  await page.click('[data-open="inv"]'); const search = page.locator('#inv-search'); await search.fill('keen'); await expect(page.locator('#inv-grid button')).toHaveCount(1); await expect(page.locator('#inv-grid')).toContainText('Short Sword');
  await search.fill('swift'); await expect(page.locator('#inv-grid button')).toHaveCount(0); await expect(page.locator('#inv-empty')).toContainText('No matching');
  await search.fill('armour'); await expect(page.locator('#inv-grid')).toContainText('Leather Armour'); await page.click('[data-bag-filter="weapon"]'); await expect(page.locator('#inv-grid button')).toHaveCount(0); await page.click('#inv-search-clear'); await expect(page.locator('#inv-grid button')).toHaveCount(2);
  await search.fill('short sword'); await page.locator('#inv-grid button').click(); await page.locator('#item-detail').getByRole('button', { name: 'Equip', exact: true }).click(); expect(await page.evaluate(() => Game.player().eq.weapon.t)).toBe('shortsword'); await expect(page.locator('#inv-count')).toHaveText('4 of 20 squares');
  await search.focus(); await page.keyboard.press('Escape'); await expect(page.locator('#ov-inv')).not.toHaveClass(/open/); expect(errors).toEqual([]);
});

test('@mobile guide pages, map landmarks and search remain accessible with double text', async ({ page }) => {
  test.setTimeout(120000);
  const Axe = require('@axe-core/playwright').default;
  const errors = watchForErrors(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => { localStorage.setItem('deepdelve.textSize', '4'); localStorage.setItem('deepdelve.palette', 'safe'); });
  await startGame(page, { seed: 'guide-a11y' }); await page.evaluate(() => { Game.level().monsters = []; });
  const audit = async () => {
    const r = await new Axe({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  await journal(page, 'quests'); await audit();
  await page.click('[data-jtab="effects"]'); await audit(); await page.click('[data-jtab="recap"]'); await audit();
  await page.keyboard.press('Escape'); await page.click('[data-open="map"]'); await page.locator('#map-landmarks summary').click(); await audit();
  await page.keyboard.press('Escape'); await page.click('[data-open="inv"]'); await page.locator('#inv-search').fill('ration'); await audit();
  const before = await page.evaluate(() => [Game.player().x, Game.player().y, Game.player().dir]);
  await page.locator('#inv-search').press('w'); expect(await page.evaluate(() => [Game.player().x, Game.player().y, Game.player().dir])).toEqual(before);
  await page.keyboard.press('Escape'); await expect(page.locator('#ov-inv')).not.toHaveClass(/open/); expect(errors).toEqual([]);
});
