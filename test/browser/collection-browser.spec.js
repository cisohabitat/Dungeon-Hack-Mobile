'use strict';
const { test, expect } = require('@playwright/test');
const { startGame, selectJournalTab, watchForErrors } = require('./helpers');

async function seed(page, extra = {}) {
  await page.addInitScript(extra => {
    if (!localStorage.getItem('deepdelve.bestiary')) localStorage.setItem('deepdelve.bestiary', JSON.stringify({ rat: { met: 1, kills: 0 }, skeleton: { met: 1, kills: 1 }, drow_warrior: { met: 1, kills: 1 } }));
    if (!localStorage.getItem('deepdelve.companions')) localStorage.setItem('deepdelve.companions', '["hound","goblin"]');
    if (!localStorage.getItem('deepdelve.progress')) localStorage.setItem('deepdelve.progress', '{"relics":["grimtooth","sisters_buckler"]}');
    localStorage.setItem('deepdelve.firstSeen', '1');
    localStorage.setItem('deepdelve.sound', 'off');
    localStorage.setItem('deepdelve.prelude', 'off');
    if (extra.large) localStorage.setItem('deepdelve.textSize', '4');
    if (extra.corrupt && !sessionStorage.getItem('corruptionTest')) { localStorage.setItem('deepdelve.collections', '{"version":1,"layout":"gallery","viewed":{"beasts":["__proto__"],"companions":[],"relics":[]}}'); sessionStorage.setItem('corruptionTest', '1'); }
    if (extra.corrupt) {
      const book = JSON.parse(localStorage.getItem('deepdelve.bestiary'));
      book.skeleton.met = { valueOf: 1, toString: 1 }; book.constructor = { met: 1 };
      localStorage.setItem('deepdelve.bestiary', JSON.stringify(book));
    }
    if (extra.blocked) { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'deepdelve.collections') throw new DOMException('Private storage', 'QuotaExceededError'); return set.call(this, key, value); }; }
  }, extra);
}
async function open(page, kind) {
  if (kind === 'relics') { await page.click('#btn-hall'); await page.click('#hall-relics'); }
  else await page.click(`#btn-${kind}`);
  return page.locator(`#${kind}-list`);
}
async function back(page, kind) { await page.click(`#${kind}-back`); if (kind === 'relics') await page.click('#hall-back'); }
async function filters(root) { const details = root.locator('.collection-filter-options'); if (!await details.evaluate(el => el.open)) await details.locator('summary').click(); }
const cards = root => root.locator('.beasts > .beast:visible, .codex > .relic-row:visible');

test('collection search and facets match only revealed names and learned traits @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await seed(page); await page.goto('/');
  const before = await page.evaluate(() => ['deepdelve.bestiary', 'deepdelve.companions', 'deepdelve.progress'].map(k => localStorage.getItem(k)));
  let root = await open(page, 'beasts');
  await expect(root.locator('.collection-new')).toHaveCount(0); // Older discoveries start viewed.
  const types = root.locator('[data-collection-type]');
  expect(await types.locator('option').allTextContents()).toContain('All types');
  expect(await types.locator('option').allTextContents()).toContain('Undead');
  expect(await types.locator('option').allTextContents()).not.toContain('Keeper');
  expect(await root.locator('[data-collection-region] option').allTextContents()).not.toContain("The lizardfolk's marsh");
  await filters(root); await types.selectOption('Undead'); await expect(cards(root)).toHaveCount(1);
  await expect(cards(root).first()).toHaveAttribute('data-beast', 'skeleton');
  await root.locator('[data-collection-clear]').click();
  await root.locator('[data-collection-search]').fill('ogre'); await expect(cards(root)).toHaveCount(0);
  await expect(root.locator('.collection-empty')).toBeVisible();
  await root.locator('[data-collection-search]').fill('rat'); await expect(cards(root)).toHaveCount(1);
  await expect(cards(root).first()).toHaveAttribute('data-beast', 'rat');
  await expect(cards(root).first()).toContainText('Kill one to take its measure.');
  await root.locator('[data-collection-search]').fill('<img onerror=alert(1)>'); await expect(cards(root)).toHaveCount(0);
  await expect(root.locator('.collection-browser img')).toHaveCount(0);
  await back(page, 'beasts');
  root = await open(page, 'companions');
  await root.locator('[data-collection-search]').fill('mender'); await expect(cards(root)).toHaveCount(0);
  await root.locator('[data-collection-search]').fill('hound'); await expect(cards(root)).toHaveCount(1);
  await back(page, 'companions');
  root = await open(page, 'relics');
  await filters(root); await root.locator('[data-collection-type]').selectOption('Shield'); await expect(cards(root)).toHaveCount(1);
  await root.locator('[data-collection-clear]').click();
  await root.locator('[data-collection-search]').fill('Whisper'); await expect(cards(root)).toHaveCount(0);
  await root.locator('[data-collection-search]').fill('Grimtooth'); await expect(cards(root)).toHaveCount(1);
  expect(await page.evaluate(() => ['deepdelve.bestiary', 'deepdelve.companions', 'deepdelve.progress'].map(k => localStorage.getItem(k)))).toEqual(before);
  expect(errors).toEqual([]);
});

test('layout survives reload and filters survive inspecting entries and changing collection surfaces @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await seed(page); await startGame(page, { seed: 'collection-controls' });
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'beasts');
  const root = page.locator('#journal-list');
  await root.locator('[data-collection-layout="gallery"]').click();
  await filters(root); await root.locator('[data-collection-discovery]').selectOption('known');
  await root.locator('[data-collection-type]').selectOption('Undead');
  const search = root.locator('[data-collection-search]'); await search.fill('skeleton');
  const before = await page.evaluate(async () => {
    const { recordingPrint, recordingStore } = await import('/js/recording.js');
    const { Dice, Odds } = await import('/js/rng.js');
    return { print: recordingPrint(Game.state()), dice: [Dice.s, Odds.s], store: Object.hasOwn(recordingStore(), 'deepdelve.collections') };
  });
  await search.press('End'); await search.press(' '); await search.press('Backspace');
  const portrait = cards(root).locator('img[role="button"]'); await portrait.focus(); await page.keyboard.press('Enter');
  await expect(portrait).toHaveClass(/zoom/);
  await portrait.press('Enter');
  await cards(root).locator('.collection-notes summary').first().click();
  const after = await page.evaluate(async () => { const { recordingPrint } = await import('/js/recording.js'), { Dice, Odds } = await import('/js/rng.js'); return { print: recordingPrint(Game.state()), dice: [Dice.s, Odds.s] }; });
  expect(after).toEqual({ print: before.print, dice: before.dice }); expect(before.store).toBe(false);
  await search.focus(); await search.press('Escape'); await expect(page.locator('#ov-journal')).not.toHaveClass(/open/);
  await page.click('[data-open="journal"]'); await selectJournalTab(page, 'beasts');
  await expect(search).toHaveValue('skeleton'); await expect(cards(root)).toHaveCount(1);
  await expect(root.locator('[data-collection-type]')).toHaveValue('Undead');
  await page.keyboard.press('Escape'); await page.evaluate(() => UI.showScreen('screen-title'));
  const title = await open(page, 'beasts');
  await expect(title.locator('[data-collection-search]')).toHaveValue('skeleton');
  await expect(title.locator('[data-collection-layout="gallery"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await page.click('#btn-companions');
  await expect(page.locator('#companions-list [data-collection-layout="gallery"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('new discoveries clear only through inspection and keep an open New-filter entry in place @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await seed(page); await page.goto('/');
  await page.evaluate(async () => {
    const known = JSON.parse(localStorage.getItem('deepdelve.bestiary')); known.acolyte = { met: 1, kills: 0 };
    localStorage.setItem('deepdelve.bestiary', JSON.stringify(known));
    localStorage.setItem('deepdelve.companions', '["hound","goblin","mender"]');
    const { Progress } = await import('/js/progress.js'); Progress.noteRelic('whisper');
  });
  for (const kind of ['beasts', 'companions', 'relics']) {
    const root = await open(page, kind);
    await root.locator('[data-collection-layout="gallery"]').click();
    await filters(root); await root.locator('[data-collection-discovery]').selectOption('new');
    await expect(cards(root)).toHaveCount(1); const card = cards(root).first();
    await expect(card.locator('.collection-new')).toHaveCount(1);
    if (kind === 'beasts') {
      expect(await root.locator('[data-collection-type] option').allTextContents()).not.toContain('Ranged');
      await card.locator('.collection-notes summary').focus(); await page.keyboard.press('Enter');
    } else if (kind === 'companions') await card.locator('img[role="button"]').click();
    else await card.locator('.collection-new').click();
    await expect(card).toBeVisible(); await expect(card.locator('.collection-new')).toHaveCount(0);
    await back(page, kind); const again = await open(page, kind);
    await expect(again.locator('[data-collection-discovery]')).toHaveValue('new');
    await expect(cards(again)).toHaveCount(0);
    await again.locator('[data-collection-clear]').click(); await back(page, kind);
  }
  await page.reload(); await page.click('#btn-beasts');
  await expect(page.locator('#beasts-list .collection-new')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('collection controls fit double text and remain accessible in gallery and empty states @mobile', async ({ page }, testInfo) => {
  const errors = watchForErrors(page); await seed(page, { large: true }); await page.goto('/');
  const AxeBuilder = require('@axe-core/playwright').default;
  for (const kind of ['beasts', 'companions', 'relics']) {
    const root = await open(page, kind); await root.locator('[data-collection-layout="gallery"]').click();
    await filters(root); await root.locator('[data-collection-discovery]').selectOption('known');
    expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).include(`#screen-${kind}`).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([]);
    await root.locator('[data-collection-search]').fill('no such discovery'); await expect(root.locator('.collection-empty')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${kind}-empty-double-text.png`) });
    await back(page, kind);
  }
  expect(errors).toEqual([]);
});

test('damaged or unavailable preference storage cannot reveal entries or break browsing @mobile', async ({ page }) => {
  const errors = watchForErrors(page); await seed(page, { corrupt: true, blocked: true }); await page.goto('/');
  const root = await open(page, 'beasts');
  await expect(root.locator('.collection-new')).toHaveCount(0);
  await root.locator('[data-collection-layout="notes"]').click();
  await root.locator('[data-collection-layout="gallery"]').click();
  await root.locator('[data-collection-search]').fill('ogre'); await expect(cards(root)).toHaveCount(0);
  await back(page, 'beasts'); await open(page, 'beasts');
  await expect(root.locator('[data-collection-layout="gallery"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('[data-beast="ogre"]')).toContainText('???');
  expect(errors).toEqual([]);
});
