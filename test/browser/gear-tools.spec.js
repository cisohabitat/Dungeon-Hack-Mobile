'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, watchForErrors } = require('./helpers');
const tools = page => page.locator('#item-detail .item-tools');
async function inspect(page, name) {
  await page.locator('#inv-grid button', { hasText: name }).first().click();
  await tools(page).locator('summary').click();
}
async function trader(page) {
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(), [dx, dy] = Dungeon.DIRS[p.dir];
    L.monsters.length = 0; L.npcs = []; p.gold = 2000;
    L.tiles[(p.y + dy) * L.w + p.x + dx] = Dungeon.T.FLOOR;
    L.npcs.push({ id: 'merchant', x: p.x + dx, y: p.y + dy, markup: 2, stock: [{ t: 'ration', q: 3, e: 0 }], greeted: false });
    Game.input('forward');
  });
  await expect(page.locator('#ov-shop')).toHaveClass(/open/);
}

test('@mobile three belt slots use existing actions, keep counts and survive reload', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-belt' });
  await page.evaluate(() => { const p = Game.player(); Game.level().monsters.length = 0; p.inv = [{ t: 'ration', q: 2, e: 0 }, { t: 'potion_heal', q: 2, e: 0 }, { t: 'scroll_map', q: 1, e: 0 }]; Game.state().known.scroll_map = 1; });
  await page.click('[data-open="inv"]');
  await inspect(page, 'Iron Ration'); await tools(page).getByRole('button', { name: 'Belt 1', exact: true }).click();
  await expect(tools(page).getByRole('button', { name: 'Belt 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await inspect(page, 'Potion of Healing'); await tools(page).getByRole('button', { name: 'Belt 2', exact: true }).click();
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await inspect(page, 'Scroll of Mapping'); await tools(page).getByRole('button', { name: 'Belt 3', exact: true }).click();
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#quick-belt button')).toHaveCount(3);
  await page.evaluate(() => { Game.player().food = 10; Game.player().hp = 1; });
  await page.locator('[data-belt="0"]').click();
  expect(await page.evaluate(() => Game.player().inv.find(it => it.t === 'ration').q)).toBe(1);
  await page.evaluate(() => { const p = Game.player(); p.held = Game.state().t + 10000; });
  await page.locator('[data-belt="1"]').click();
  expect(await page.evaluate(() => Game.player().inv.find(it => it.t === 'potion_heal').q)).toBe(2);
  await page.evaluate(() => { Game.player().held = 0; Game.save(true); });
  await page.reload(); await page.click('#btn-continue');
  await expect(page.locator('[data-belt="0"]')).toContainText('×1');
  await expect(page.locator('[data-belt="1"]')).toContainText('×2');
  await page.locator('[data-belt="2"]').click();
  await expect(page.locator('[data-belt="2"]')).toBeDisabled();
  expect(await page.evaluate(() => Game.player().inv.some(it => it.t === 'scroll_map'))).toBe(false);
  expect(errors).toEqual([]);
});

test('@mobile favourites block dropping, individual sales and bulk sales', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'mage', seed: 'gear-protect' });
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().inv = [{ t: 'plate', q: 1, e: 0 }, { t: 'greatsword', q: 1, e: 0 }, { t: 'shield', q: 1, e: 0 }]; });
  await page.click('[data-open="inv"]'); await inspect(page, 'Plate Mail');
  await tools(page).getByRole('button', { name: 'Protect favourite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Protected', exact: true })).toBeDisabled();
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Escape'); await trader(page);
  const plate = page.locator('#shop-sell .shop-row', { hasText: 'Plate Mail' }).filter({ has: page.locator('.shop-inspect') });
  await expect(plate.getByRole('button', { name: /^Protected/ })).toBeDisabled();
  await expect(page.locator('#shop-sell .junk-row')).not.toContainText('Plate Mail');
  const bulk = page.locator('#shop-sell .junk-row button');
  await page.waitForTimeout(450); await bulk.click();
  if (await bulk.count() && await bulk.evaluate(el => el.classList.contains('armed'))) await bulk.click();
  expect(await page.evaluate(() => Game.player().inv.map(it => it.t))).toEqual(['plate']);
  await page.click('#ov-shop [data-close]');
  await page.evaluate(() => Game.save(true)); await page.reload(); await page.click('#btn-continue');
  await page.click('[data-open="inv"]'); await inspect(page, 'Plate Mail');
  await expect(tools(page).getByRole('button', { name: 'Protect favourite', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tools(page).getByRole('button', { name: 'Protect favourite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Drop', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('@mobile both-hand previews describe stowed shields and blocked choices without equipping', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-hands' });
  await page.evaluate(() => { Game.player().inv = [{ t: 'shortsword', q: 1, e: 0 }, { t: 'greatsword', q: 1, e: 0 }]; });
  await page.click('[data-open="inv"]');
  const before = await page.evaluate(() => JSON.stringify({ eq: Game.player().eq, inv: Game.player().inv }));
  await page.locator('#inv-grid button', { hasText: 'Short Sword' }).click();
  await expect(page.locator('.hand-compare')).toContainText('Use right hand');
  await expect(page.locator('.hand-compare')).toContainText('Use left hand');
  await expect(page.locator('.hand-compare')).toContainText('Shield goes into your pack');
  expect(await page.evaluate(() => JSON.stringify({ eq: Game.player().eq, inv: Game.player().inv }))).toBe(before);
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#inv-grid button', { hasText: 'Two-handed Sword' }).click();
  await expect(page.locator('.hand-compare')).toContainText('Two-handed grip');
  expect(await page.evaluate(() => JSON.stringify({ eq: Game.player().eq, inv: Game.player().inv }))).toBe(before);
  await page.locator('#item-detail').getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => { Game.player().eq.shield.curse = 1; });
  await page.locator('#inv-grid button', { hasText: 'Two-handed Sword' }).click();
  await expect(page.locator('.hand-compare')).toContainText('A cursed item holds this slot');
  expect(errors).toEqual([]);
});

test('@mobile relic sets distinguish discoveries, carried pieces and active bonuses', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-sets' });
  await page.evaluate(async () => {
    const { Progress } = await import('/js/progress.js'); Progress.noteRelic('kests_bulwark'); Progress.noteRelic('rustwarden');
    const { RELICS } = await import('/js/relics.js'); const p = Game.player();
    p.eq.shield = { t: RELICS.kests_bulwark.t, u: 'kests_bulwark', e: 1, q: 1 };
    p.inv.push({ t: RELICS.rustwarden.t, u: 'rustwarden', e: 1, q: 1 });
  });
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="relics"]');
  await page.locator('.set-tracker summary').click();
  const set = page.locator('[data-set="stair"]');
  await expect(set).toContainText('2/2 discovered'); await expect(set).toContainText('1/2 worn'); await expect(set).toContainText('In pack'); await expect(set).toContainText('Bonus inactive');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const p = Game.player(); const it = p.inv.find(it => it.u === 'rustwarden'); Game.equip(it); });
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="relics"]'); await page.locator('.set-tracker summary').click();
  await expect(set).toContainText('2/2 worn'); await expect(set).toContainText('Bonus active');
  await expect(page.locator('[data-set="night"]')).toContainText('Undiscovered piece');
  expect(errors).toEqual([]);
});

test('@mobile current companion card shows health, learned abilities and waiting or fallen state', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-companion' });
  await page.evaluate(() => {
    const G = Game.state(); G.companion = { kind: 'hound', name: 'Brindle', hp: 4, maxHp: 18, mode: 'stay', depth: G.depth + 1, joined: 1, floors: 4, x: 1, y: 1, nextAct: 1e9 };
  });
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="companions"]');
  const card = page.locator('.companion-card');
  await expect(card).toContainText('Brindle'); await expect(card).toContainText('4/18'); await expect(card).toContainText('Veteran'); await expect(card).toContainText('Waiting on floor 2'); await expect(card).toContainText('Hamstring'); await expect(card).toContainText('Pack Hunter');
  await card.locator('img').click(); await expect(card.locator('img')).toHaveClass(/zoom/); await card.locator('img').press('Enter'); await expect(card.locator('img')).not.toHaveClass(/zoom/);
  await page.keyboard.press('Escape'); await page.evaluate(() => { Game.companion().fallen = 2; Game.companion().hp = 0; });
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="companions"]'); await expect(card).toContainText('Fallen on floor 2');
  expect(errors).toEqual([]);
});

test('@mobile floor haul records actual pickups once, excludes purchases and persists on reload', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-haul' });
  await page.evaluate(() => {
    const p = Game.player(), L = Game.level(); L.monsters.length = 0;
    L.items[p.x + ',' + p.y] = [{ t: 'gold', q: 37 }, { t: 'dagger', e: 0, q: 1 }];
    for (const it of [...Game.floorItems()]) Game.takeItem(it);
  });
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="haul"]');
  await expect(page.locator('#journal-list')).toContainText('37 gold collected · 1 item');
  await expect(page.locator('#journal-list')).toContainText('Dagger');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const it = Game.player().inv.find(it => it.t === 'dagger'); Game.dropItem(it); Game.takeItem(Game.floorItems().find(it => it.t === 'dagger')); Game.save(true); });
  await page.reload(); await page.click('#btn-continue');
  await trader(page); await page.waitForTimeout(450); await page.locator('#shop-stock .shop-row button.afford').click(); await page.click('#ov-shop [data-close]');
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="haul"]');
  await expect(page.locator('#journal-list')).toContainText('37 gold collected · 1 item');
  await expect(page.locator('#journal-list li')).toHaveCount(1);
  expect(errors).toEqual([]);
});

for (const [name, viewport] of [['upright', { width: 320, height: 568 }], ['sideways', { width: 740, height: 360 }]]) test(`@mobile gear tools remain accessible with double text ${name}`, async ({ page }) => {
  const AxeBuilder = require('@axe-core/playwright').default;
  const errors = watchForErrors(page);
  await page.setViewportSize(viewport);
  await page.addInitScript(() => localStorage.setItem('deepdelve.textSize', '4'));
  await startGame(page, { cls: 'fighter', seed: 'gear-a11y' });
  await page.evaluate(async () => {
    const { GearTools } = await import('/js/geartools.js'), p = Game.player(), G = Game.state(); Game.level().monsters.length = 0;
    p.inv = [{ t: 'ration', q: 2, e: 0 }, { t: 'potion_heal', q: 2, e: 0 }, { t: 'scroll_map', q: 1, e: 0 }]; G.known.scroll_map = 1;
    p.inv.forEach((it, i) => GearTools.pin(it, i));
    G.companion = { kind: 'mender', name: 'Ailsa', hp: 8, maxHp: 16, mode: 'follow', depth: G.depth, joined: 1, floors: 4, x: p.x, y: p.y, nextAct: 1e9, herbs: 4, herbsOn: G.depth };
  });
  await expect(page.locator('#quick-belt')).toBeVisible();
  const obscured = await page.locator('#quick-belt button').evaluateAll(buttons => buttons.filter(button => {
    const r = button.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.width < 44 || r.height < 44 || r.x < 0 || r.right > innerWidth || r.y < 0 || r.bottom > innerHeight || !button.contains(top);
  }).map(b => b.getAttribute('aria-label')));
  expect(obscured).toEqual([]);
  async function audit() {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await audit();
  await page.click('[data-open="inv"]'); await inspect(page, 'Iron Ration'); await audit();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="companions"]'); await audit();
  await page.click('[data-jtab="relics"]'); await page.locator('.set-tracker summary').click(); await audit();
  await page.click('[data-jtab="haul"]'); await audit();
  expect(errors).toEqual([]);
});

test('@mobile local gear preferences reject invalid ids, escape labels and reset for a new run', async ({ page }) => {
  const errors = watchForErrors(page);
  await startGame(page, { cls: 'fighter', seed: 'gear-untrusted' });
  await page.evaluate(() => {
    const G = Game.state();
    localStorage.setItem('deepdelve.gearTools', JSON.stringify({
      run: JSON.stringify([G.created, G.seed, G.player.name]), favourites: ['constructor'], belt: ['__proto__', 'constructor', 'ration'],
      receipts: [{ depth: 1, t: 'dagger', q: 1, key: 'safe', label: '<img src=x onerror="window.gearInjected=1">' }, { depth: 1, t: 'constructor', q: 999, key: 'bad', label: 'Invalid item' }],
    })); Game.save(true);
  });
  await page.reload(); await page.click('#btn-continue');
  await expect(page.locator('[data-belt="0"]')).toBeDisabled();
  await expect(page.locator('[data-belt="1"]')).toBeDisabled();
  await expect(page.locator('[data-belt="2"]')).toContainText('Iron Ration');
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="haul"]');
  await expect(page.locator('#journal-list')).toContainText('<img src=x onerror="window.gearInjected=1">');
  await expect(page.locator('#journal-list img')).toHaveCount(0);
  await expect(page.locator('#journal-list')).not.toContainText('Invalid item');
  expect(await page.evaluate(() => window.gearInjected)).toBeUndefined();
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const G = Game.state(); Game.newGame({ name: G.player.name, cls: 'fighter', stats: G.player.stats, seed: G.seed, opts: G.opts });
  });
  await expect(page.locator('#quick-belt')).toBeHidden();
  await page.click('[data-open="journal"]'); await page.click('[data-jtab="haul"]');
  await expect(page.locator('#journal-list')).toContainText('0 gold collected · 0 items');
  expect(errors).toEqual([]);
});
