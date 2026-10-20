'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { selectJournalTab, startGame, faceOpenGround, placeMonster, watchForErrors } = require('./helpers');

const bosses = { lich: 'Dread Lich', warlord: 'Goblin Warlord', heartforged: 'Heartforged' };
async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
  });
}
async function introduce(page, id) {
  await page.evaluate(() => { Game.level().monsters.length = 0; Game.player().hp = Game.player().maxHp = 999; });
  expect(await faceOpenGround(page, 2)).toBeGreaterThanOrEqual(2);
  await placeMonster(page, id, 2, { awake: false, nextAct: 0 });
  await expect(page.locator('#ov-boss')).toHaveClass(/open/);
}

for (const [id, name] of Object.entries(bosses)) test(`${name}: its introduction pauses play, unlocks the portrait and happens once`, async ({ page }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await startGame(page, { seed: 'boss-portrait-' + id });
  await introduce(page, id);
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#boss-title')).toHaveText(name);
  await expect(page.locator('#boss-speech')).toHaveText(await page.evaluate(id => MONSTERS[id].speech, id));
  await expect(page.locator('#boss-portrait')).toHaveAttribute('src', `img/bosses/${id}.webp`);
  await expect.poll(() => page.locator('#boss-portrait').evaluate(i => i.complete && i.naturalWidth === 512)).toBe(true);
  const time = await page.evaluate(() => Game.state().t);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => Game.state().t)).toBe(time);
  expect(await page.evaluate(id => Game.bestiary()[id].met, id)).toBeGreaterThan(0);
  expect(await page.locator('#screen-game .game-layout').evaluate(e => e.inert)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${id}-introduction.png`) });
  await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => Game.state().t)).toBeGreaterThan(time);
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'beasts');
  const portrait = page.locator(`#ov-journal [data-beast="${id}"] .boss-portrait`);
  await expect(portrait).toHaveAttribute('src', `img/bosses/${id}.webp`);
  await portrait.focus(); await page.keyboard.press('Enter');
  await expect(portrait).toHaveAttribute('aria-pressed', 'true');
  expect(await portrait.evaluate(e => getComputedStyle(e).imageRendering)).toBe('auto');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
  if (id === 'lich') {
    await page.evaluate(() => Game.save(true));
    await page.reload(); await page.click('#btn-continue');
    await expect(page.locator('#screen-game')).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => Game.level().monsters.find(m => m.id === 'lich').spoke)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('a level-up waits for the introduction rather than covering it', async ({ page }) => {
  await prepare(page); await startGame(page, { seed: 'boss-portrait-choice' });
  await introduce(page, 'lich');
  await page.evaluate(() => Game.testLevel());
  await expect.poll(() => page.evaluate(() => !!Game.pendingBoons())).toBe(true);
  await expect(page.locator('#ov-boss')).toHaveClass(/open/);
  await expect(page.locator('#ov-boons')).not.toHaveClass(/open/);
  await page.getByRole('button', { name: 'Face the keeper' }).click();
  await expect(page.locator('#ov-boons')).toHaveClass(/open/);
});

test('unmet keepers keep their portraits hidden; met portraits survive offline reload and enlarge without cropping', async ({ page, context }, testInfo) => {
  const errors = watchForErrors(page);
  await prepare(page); await page.goto('/'); await page.click('#btn-beasts');
  for (const id of Object.keys(bosses)) {
    await expect(page.locator(`[data-beast="${id}"]`)).toHaveClass(/unmet/);
    await expect(page.locator(`[data-beast="${id}"] .boss-portrait`)).toHaveCount(0);
  }
  await page.evaluate(() => localStorage.setItem('deepdelve.bestiary', JSON.stringify(Object.fromEntries(['lich', 'warlord', 'heartforged'].map(id => [id, { met: 1, kills: 0 }])))));
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true); await page.reload(); await page.click('#btn-beasts');
  for (const id of Object.keys(bosses)) {
    const face = page.locator(`[data-beast="${id}"] .boss-portrait`);
    await expect.poll(() => face.evaluate(e => e.complete && e.naturalWidth === 512)).toBe(true);
    await face.click(); await expect(face).toHaveAttribute('aria-pressed', 'true');
    const [w, h] = await face.evaluate(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
    expect(Math.abs(w - h)).toBeLessThan(2);
    await face.click();
  }
  await page.locator('[data-beast="lich"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('boss-bestiary.png') });
  expect(errors).toEqual([]);
});

test('a missing portrait uses the dungeon sprite and the introduction still closes by keyboard', async ({ page }) => {
  await prepare(page); await page.route('**/img/bosses/lich.webp', r => r.abort());
  await startGame(page, { seed: 'boss-missing-portrait' }); await introduce(page, 'lich');
  await expect(page.locator('#boss-portrait')).toHaveAttribute('src', /^data:image\/png/);
  await expect.poll(() => page.locator('#boss-portrait').evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ov-boss')).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => UI.paused())).toBe(false);
});
